// Evaluación antropométrica con las referencias de la OMS.
// Reproduce las reglas de los paquetes oficiales anthro (0–5 años) y anthroplus (5–19 años):
//   - 0 a <60 meses: Patrones OMS 2006, edad en días, ajuste de ±0.7 cm según la posición.
//   - 60 a <229 meses: Referencia OMS 2007, edad en meses con interpolación.
//   - Corrección |Z| > 3 en los indicadores basados en peso.
// Síndrome de Down: curvas CDC (Zemel et al., Pediatrics 2015), ver evaluarDown().
// Decisión clínica del proyecto: edad corregida para nacidos < 37 semanas hasta los 24 meses cronológicos.

import { calcularEdad, leerFechaISO } from '../domain/fechas';
import { OMS2006 } from './datos/oms2006';
import { OMS2007 } from './datos/oms2007';
import { CDC_DOWN } from './datos/cdcDown';
import {
  extremosPorSexo,
  lmsEnPunto,
  lmsInterpolado,
  lmsPorSexo,
  percentilDeZ,
  redondear2,
  zLMS,
  zLMSAjustado,
} from './lms';
import type {
  DatosEvaluacion,
  Indicador,
  LMS,
  Referencia,
  ResultadoEvaluacion,
  ResultadoIndicador,
} from './tipos';

export const DIAS_POR_MES = 30.4375;
const ULTIMO_DIA_OMS2006 = 1826; // < 60 meses
const LIMITE_MESES_OMS2007 = 229; // talla e IMC hasta < 229 meses (19 años)
const LIMITE_MESES_PESO_OMS2007 = 121; // peso para la edad hasta < 121 meses (10 años)
const MOTIVO_EDEMA = 'Con edema bilateral la OMS no calcula indicadores basados en peso';

/** Límites de plausibilidad de la OMS (fuera de ellos el valor se marca como probable error). */
const LIMITES: Record<Indicador, [number, number]> = {
  pesoEdad: [-6, 5],
  tallaEdad: [-6, 6],
  pesoTalla: [-5, 5],
  imcEdad: [-5, 5],
  pcEdad: [-5, 5],
};

function diasEntre(desdeISO: string, hastaISO: string): number | null {
  const a = leerFechaISO(desdeISO);
  const b = leerFechaISO(hastaISO);
  if (!a || !b) return null;
  return Math.round((Date.UTC(b.anio, b.mes - 1, b.dia) - Date.UTC(a.anio, a.mes - 1, a.dia)) / 86400000);
}

function resultado(
  indicador: Indicador,
  referencia: Referencia,
  valor: number | null,
  lms: LMS | null,
  ajustado: boolean,
  motivo?: string,
): ResultadoIndicador {
  if (valor == null || valor <= 0) {
    return { indicador, referencia, z: null, percentil: null, improbable: false, valorUsado: null, motivoNoCalculado: motivo ?? 'Falta el dato' };
  }
  if (!lms || motivo) {
    return { indicador, referencia, z: null, percentil: null, improbable: false, valorUsado: valor, motivoNoCalculado: motivo ?? 'Fuera del rango de la referencia' };
  }
  const zSinRedondear = ajustado ? zLMSAjustado(valor, lms) : zLMS(valor, lms);
  const z = redondear2(zSinRedondear);
  const [min, max] = LIMITES[indicador];
  return {
    indicador,
    referencia,
    z,
    percentil: percentilDeZ(zSinRedondear),
    improbable: z < min || z > max,
    valorUsado: valor,
  };
}

export function evaluarCrecimiento(d: DatosEvaluacion): ResultadoEvaluacion | null {
  const edadDiasCronologica = diasEntre(d.fechaNacimiento, d.fechaMedicion);
  if (edadDiasCronologica == null || edadDiasCronologica < 0) return null;

  const notas: string[] = [];
  const base: ResultadoEvaluacion = {
    edadDiasCronologica,
    edadDiasUsada: null,
    edadMesesUsada: null,
    usaEdadCorregida: false,
    referencia: null,
    tallaAjustadaCm: null,
    ajusteTalla: 0,
    imc: null,
    indicadores: [],
    notas,
    comparacionGeneral: null,
  };

  // --- Edad corregida en prematuros (< 37 semanas) hasta los 24 meses cronológicos ---
  let edadDias = edadDiasCronologica;
  const nacimiento = leerFechaISO(d.fechaNacimiento);
  const medicion = leerFechaISO(d.fechaMedicion);
  const edadCalendario = nacimiento && medicion ? calcularEdad(nacimiento, medicion) : null;
  if (d.semanasGestacion != null && d.semanasGestacion < 37 && edadCalendario && edadCalendario.totalMeses < 24) {
    edadDias = edadDiasCronologica - (40 - d.semanasGestacion) * 7;
    base.usaEdadCorregida = true;
    if (edadDias < 0) {
      notas.push(
        'Aún no cumple 40 semanas de edad corregida: las curvas empiezan al término. Use curvas para prematuros.',
      );
      return base;
    }
    notas.push(`Edad corregida por prematuridad (${d.semanasGestacion} semanas al nacer).`);
  }

  const edadMeses = edadDias / DIAS_POR_MES;
  base.edadDiasUsada = edadDias;
  base.edadMesesUsada = edadMeses;

  if (d.sindromeDown) return evaluarDown(d, base, edadMeses);

  if (edadDias <= ULTIMO_DIA_OMS2006 && edadMeses < 60) {
    return evaluarOMS2006(d, base, edadDias, edadMeses);
  }
  if (edadMeses < LIMITE_MESES_OMS2007) {
    return evaluarOMS2007(d, base, edadMeses);
  }
  notas.push('Tiene 19 años o más: fuera del rango de las referencias pediátricas de la OMS.');
  return base;
}

function evaluarOMS2006(d: DatosEvaluacion, r: ResultadoEvaluacion, edadDias: number, edadMeses: number): ResultadoEvaluacion {
  r.referencia = 'OMS2006';

  // Ajuste de longitud/talla: hasta 730 días se usa longitud acostado; desde 731, talla de pie.
  let talla = d.tallaCm;
  if (talla != null && talla > 0 && d.tipoMedicion) {
    if (d.tipoMedicion === 'de_pie' && edadMeses < 9) {
      r.notas.push('Talla de pie antes de los 9 meses: la OMS la considera improbable y no aplica el ajuste de 0.7 cm.');
    } else if (edadDias < 731 && d.tipoMedicion === 'de_pie') {
      talla = talla + 0.7;
      r.ajusteTalla = 0.7;
    } else if (edadDias >= 731 && d.tipoMedicion === 'acostado') {
      talla = talla - 0.7;
      r.ajusteTalla = -0.7;
    }
  }
  if (r.ajusteTalla !== 0) {
    r.notas.push(
      r.ajusteTalla > 0
        ? 'Se sumaron 0.7 cm porque se midió de pie antes de los 24 meses (la referencia usa longitud acostado).'
        : 'Se restaron 0.7 cm porque se midió acostado desde los 24 meses (la referencia usa talla de pie).',
    );
  }
  r.tallaAjustadaCm = talla != null && talla > 0 ? Math.round(talla * 10) / 10 : null;

  const peso = d.pesoKg != null && d.pesoKg > 0 ? d.pesoKg : null;
  const imc = peso != null && talla != null && talla > 0 ? peso / Math.pow(talla / 100, 2) : null;
  r.imc = imc;
  const sinPeso = d.edema ? MOTIVO_EDEMA : undefined;

  const s = d.sexo;
  r.indicadores.push(resultado('pesoEdad', 'OMS2006', peso, lmsEnPunto(OMS2006.pesoEdad, s, edadDias), true, sinPeso));
  r.indicadores.push(resultado('tallaEdad', 'OMS2006', talla, lmsEnPunto(OMS2006.tallaEdad, s, edadDias), false));

  // Peso para longitud (< 731 días, 45–110 cm) o para talla (≥ 731 días, 65–120 cm), interpolando cada 0.1 cm.
  if (peso == null || talla == null || talla <= 0) {
    r.indicadores.push(resultado('pesoTalla', 'OMS2006', null, null, true, 'Requiere peso y longitud/talla'));
  } else {
    const usaLongitud = edadDias < 731;
    const tabla = usaLongitud ? OMS2006.pesoLongitud : OMS2006.pesoTalla;
    const [min, max] = usaLongitud ? [45, 110] : [65, 120];
    if (talla < min || talla > max) {
      r.indicadores.push(
        resultado('pesoTalla', 'OMS2006', peso, null, true, `La ${usaLongitud ? 'longitud' : 'talla'} debe estar entre ${min} y ${max} cm`),
      );
    } else {
      const inferior = Math.trunc(talla * 10) / 10;
      const fraccion = (talla - inferior) / 0.1;
      r.indicadores.push(resultado('pesoTalla', 'OMS2006', peso, lmsInterpolado(tabla, s, inferior, fraccion), true, sinPeso));
    }
  }

  r.indicadores.push(resultado('imcEdad', 'OMS2006', imc, lmsEnPunto(OMS2006.imcEdad, s, edadDias), true, sinPeso));
  r.indicadores.push(resultado('pcEdad', 'OMS2006', d.perimetroCefalicoCm, lmsEnPunto(OMS2006.pcEdad, s, edadDias), false));
  return r;
}

function evaluarOMS2007(d: DatosEvaluacion, r: ResultadoEvaluacion, edadMeses: number): ResultadoEvaluacion {
  r.referencia = 'OMS2007';
  const s = d.sexo;
  const inferior = Math.trunc(edadMeses);
  const fraccion = edadMeses - inferior;

  // La referencia 2007 usa la talla tal como se midió (de pie); no aplica el ajuste de 0.7 cm.
  const talla = d.tallaCm != null && d.tallaCm > 0 ? d.tallaCm : null;
  const peso = d.pesoKg != null && d.pesoKg > 0 ? d.pesoKg : null;
  r.tallaAjustadaCm = talla;
  const imc = peso != null && talla != null ? peso / Math.pow(talla / 100, 2) : null;
  r.imc = imc;
  if (talla != null && d.tipoMedicion === 'acostado') {
    r.notas.push('La referencia OMS 2007 usa talla de pie; la talla se tomó tal como se registró.');
  }

  const sinPeso = d.edema ? MOTIVO_EDEMA : undefined;
  r.indicadores.push(
    edadMeses < LIMITE_MESES_PESO_OMS2007
      ? resultado('pesoEdad', 'OMS2007', peso, lmsInterpolado(OMS2007.pesoEdad, s, inferior, fraccion), true, sinPeso)
      : resultado('pesoEdad', 'OMS2007', peso, null, true, 'La OMS no usa peso para la edad después de los 10 años; use IMC para la edad'),
  );
  r.indicadores.push(resultado('tallaEdad', 'OMS2007', talla, lmsInterpolado(OMS2007.tallaEdad, s, inferior, fraccion), false));
  r.indicadores.push(resultado('pesoTalla', 'OMS2007', peso, null, true, 'Sin referencia OMS después de los 5 años; use IMC para la edad'));
  r.indicadores.push(resultado('imcEdad', 'OMS2007', imc, lmsInterpolado(OMS2007.imcEdad, s, inferior, fraccion), true, sinPeso));
  r.indicadores.push(resultado('pcEdad', 'OMS2007', d.perimetroCefalicoCm, null, false, 'Sin referencia OMS después de los 5 años'));
  return r;
}

// ---------------------------------------------------------------------------
// Síndrome de Down: curvas CDC (Zemel BS et al., Pediatrics 2015;136:e1204)
// ---------------------------------------------------------------------------
// - 0 a 36 meses: peso, longitud, perímetro cefálico (por mes) y peso para la longitud (por cm).
// - 2 a 20 años: peso, talla, perímetro cefálico e IMC (cada 0.5 años).
// - Entre 24 y 36 meses se usan las tablas de 2–20 años solo si la talla se midió de pie.
// - Se interpola linealmente L, M y S entre los puntos de la tabla. Puntaje Z con el método LMS
//   (sin la corrección |Z| > 3, que es propia de la OMS). La medida se usa tal como se tomó.
// - Desde los 2 años se agrega el IMC para la edad con la referencia general (OMS) para valorar
//   sobrepeso u obesidad, como recomienda el CDC.

const LIMITE_MESES_DOWN = 240; // 20 años

function evaluarDown(d: DatosEvaluacion, r: ResultadoEvaluacion, edadMeses: number): ResultadoEvaluacion {
  const s = d.sexo;
  const peso = d.pesoKg != null && d.pesoKg > 0 ? d.pesoKg : null;
  const talla = d.tallaCm != null && d.tallaCm > 0 ? d.tallaCm : null;
  r.tallaAjustadaCm = talla;
  r.imc = peso != null && talla != null ? peso / Math.pow(talla / 100, 2) : null;
  const sinPeso = d.edema ? 'Con edema bilateral no se valoran los indicadores basados en peso' : undefined;

  if (edadMeses > LIMITE_MESES_DOWN) {
    r.notas.push('Tiene más de 20 años: fuera del rango de las curvas para síndrome de Down.');
    return r;
  }

  const usaInfantil = edadMeses < 24 || (edadMeses <= 36 && d.tipoMedicion !== 'de_pie');
  if (usaInfantil) {
    r.referencia = 'SD036';
    const desdeUnMes = edadMeses < 1 ? 'Las curvas de longitud y perímetro cefálico empiezan al mes de edad' : undefined;
    r.indicadores.push(resultado('pesoEdad', 'SD036', peso, lmsPorSexo(CDC_DOWN.pesoEdad036, s, edadMeses), false, sinPeso));
    r.indicadores.push(resultado('tallaEdad', 'SD036', talla, lmsPorSexo(CDC_DOWN.tallaEdad036, s, edadMeses), false, desdeUnMes));
    if (peso == null || talla == null) {
      r.indicadores.push(resultado('pesoTalla', 'SD036', null, null, false, 'Requiere peso y longitud'));
    } else {
      const [min, max] = extremosPorSexo(CDC_DOWN.pesoLongitud036, s);
      r.indicadores.push(
        talla < min || talla > max
          ? resultado('pesoTalla', 'SD036', peso, null, false, `La longitud debe estar entre ${min} y ${max} cm`)
          : resultado('pesoTalla', 'SD036', peso, lmsPorSexo(CDC_DOWN.pesoLongitud036, s, talla), false, sinPeso),
      );
    }
    r.indicadores.push(resultado('imcEdad', 'SD036', r.imc, null, false, 'Las curvas para síndrome de Down tienen IMC desde los 2 años'));
    r.indicadores.push(resultado('pcEdad', 'SD036', d.perimetroCefalicoCm, lmsPorSexo(CDC_DOWN.pcEdad036, s, edadMeses), false, desdeUnMes));
  } else {
    r.referencia = 'SD220';
    const anios = edadMeses / 12;
    r.indicadores.push(resultado('pesoEdad', 'SD220', peso, lmsPorSexo(CDC_DOWN.pesoEdad220, s, anios), false, sinPeso));
    r.indicadores.push(resultado('tallaEdad', 'SD220', talla, lmsPorSexo(CDC_DOWN.tallaEdad220, s, anios), false));
    r.indicadores.push(resultado('pesoTalla', 'SD220', peso, null, false, 'Las curvas para síndrome de Down tienen peso para la longitud solo hasta los 36 meses; use IMC'));
    r.indicadores.push(resultado('imcEdad', 'SD220', r.imc, lmsPorSexo(CDC_DOWN.imcEdad220, s, anios), false, sinPeso));
    r.indicadores.push(resultado('pcEdad', 'SD220', d.perimetroCefalicoCm, lmsPorSexo(CDC_DOWN.pcEdad220, s, anios), false));
  }
  if (talla != null) r.notas.push('La talla se usa tal como se midió (las curvas para síndrome de Down no aplican el ajuste de 0.7 cm).');

  // Referencia general para sobrepeso/obesidad desde los 2 años.
  if (edadMeses >= 24 && r.imc != null && !d.edema) {
    const general = evaluarCrecimiento({ ...d, sindromeDown: false });
    r.comparacionGeneral = general?.indicadores.find((i) => i.indicador === 'imcEdad' && i.z != null) ?? null;
  }
  return r;
}
