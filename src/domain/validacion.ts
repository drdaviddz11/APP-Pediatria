// Validaciones de formularios y alertas de datos improbables.
// Las alertas son INFORMATIVAS: le piden al médico revisar el dato, no diagnostican.

import { calcularEdad, compararFechas, FechaSimple, hoy, leerFechaUsuario } from './fechas';
import { TipoMedicion } from './types';

export type Nivel = 'error' | 'aviso';

export interface Problema {
  campo: string;
  nivel: Nivel; // 'error' impide guardar; 'aviso' requiere confirmación del médico
  mensaje: string;
}

/** Convierte texto a número aceptando coma o punto decimal. Vacío → null. NaN si no es número. */
export function leerNumero(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  if (t === '') return null;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

export function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

// ---------------------------------------------------------------------------
// Paciente
// ---------------------------------------------------------------------------

export interface PacienteFormulario {
  numeroExpediente: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string; // DD/MM/AAAA
  sexo: '' | 'F' | 'M';
  semanasGestacion: string;
  telefonoPrincipal: string;
  whatsapp: string;
  correo: string;
}

export function validarPaciente(p: PacienteFormulario, referencia: FechaSimple = hoy()): Problema[] {
  const r: Problema[] = [];
  if (!p.numeroExpediente.trim()) r.push({ campo: 'numeroExpediente', nivel: 'error', mensaje: 'Escriba el número de expediente.' });
  if (!p.nombres.trim()) r.push({ campo: 'nombres', nivel: 'error', mensaje: 'Escriba el nombre.' });
  if (!p.apellidos.trim()) r.push({ campo: 'apellidos', nivel: 'error', mensaje: 'Escriba los apellidos.' });
  if (!p.sexo) r.push({ campo: 'sexo', nivel: 'error', mensaje: 'Seleccione el sexo (define las curvas de crecimiento).' });

  const nac = leerFechaUsuario(p.fechaNacimiento);
  if (!nac) {
    r.push({ campo: 'fechaNacimiento', nivel: 'error', mensaje: 'Use el formato DD/MM/AAAA con una fecha real.' });
  } else if (compararFechas(nac, referencia) > 0) {
    r.push({ campo: 'fechaNacimiento', nivel: 'error', mensaje: 'La fecha de nacimiento no puede ser futura.' });
  } else {
    const edad = calcularEdad(nac, referencia);
    if (edad && edad.anios >= 19) {
      r.push({ campo: 'fechaNacimiento', nivel: 'aviso', mensaje: `El paciente tiene ${edad.anios} años; las referencias pediátricas llegan hasta los 19.` });
    }
  }

  const sg = leerNumero(p.semanasGestacion);
  if (sg !== null) {
    if (Number.isNaN(sg) || !Number.isInteger(sg)) {
      r.push({ campo: 'semanasGestacion', nivel: 'error', mensaje: 'Escriba las semanas de gestación como número entero.' });
    } else if (sg < 22 || sg > 44) {
      r.push({ campo: 'semanasGestacion', nivel: 'error', mensaje: 'Las semanas de gestación deben estar entre 22 y 44.' });
    }
  }

  for (const campo of ['telefonoPrincipal', 'whatsapp'] as const) {
    const v = p[campo].trim();
    if (v && (soloDigitos(v).length < 8 || soloDigitos(v).length > 15)) {
      r.push({ campo, nivel: 'aviso', mensaje: 'El número parece incompleto. Para WhatsApp incluya el código de país (ej. 504 para Honduras).' });
    }
  }
  if (p.correo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.correo.trim())) {
    r.push({ campo: 'correo', nivel: 'error', mensaje: 'El correo electrónico no es válido.' });
  }
  return r;
}

// ---------------------------------------------------------------------------
// Mediciones y signos vitales de una consulta
// ---------------------------------------------------------------------------

export interface MedicionesFormulario {
  pesoKg: string;
  tallaCm: string;
  tipoMedicion: '' | TipoMedicion;
  perimetroCefalicoCm: string;
  temperaturaC: string;
  frecuenciaCardiaca: string;
  frecuenciaRespiratoria: string;
  saturacionO2: string;
  presionSistolica: string;
  presionDiastolica: string;
}

interface Rango {
  campo: keyof MedicionesFormulario;
  nombre: string;
  min: number; // por debajo: valor imposible o improbable
  max: number;
  unidad: string;
}

// Rangos amplios de plausibilidad fisiológica (no son rangos normales).
const RANGOS: Rango[] = [
  { campo: 'pesoKg', nombre: 'Peso', min: 0.3, max: 200, unidad: 'kg' },
  { campo: 'tallaCm', nombre: 'Talla/longitud', min: 25, max: 230, unidad: 'cm' },
  { campo: 'perimetroCefalicoCm', nombre: 'Perímetro cefálico', min: 18, max: 70, unidad: 'cm' },
  { campo: 'temperaturaC', nombre: 'Temperatura', min: 30, max: 44, unidad: '°C' },
  { campo: 'frecuenciaCardiaca', nombre: 'Frecuencia cardiaca', min: 30, max: 260, unidad: 'lpm' },
  { campo: 'frecuenciaRespiratoria', nombre: 'Frecuencia respiratoria', min: 5, max: 120, unidad: 'rpm' },
  { campo: 'saturacionO2', nombre: 'Saturación de O₂', min: 50, max: 100, unidad: '%' },
  { campo: 'presionSistolica', nombre: 'Presión sistólica', min: 40, max: 250, unidad: 'mmHg' },
  { campo: 'presionDiastolica', nombre: 'Presión diastólica', min: 20, max: 150, unidad: 'mmHg' },
];

/**
 * Revisa las mediciones. `edadMeses` es la edad en meses cumplidos el día de la consulta
 * (null si no se conoce).
 */
export function validarMediciones(m: MedicionesFormulario, edadMeses: number | null): Problema[] {
  const r: Problema[] = [];
  const valores: Partial<Record<keyof MedicionesFormulario, number | null>> = {};

  for (const rango of RANGOS) {
    const v = leerNumero(m[rango.campo]);
    valores[rango.campo] = v;
    if (v === null) continue;
    if (Number.isNaN(v)) {
      r.push({ campo: rango.campo, nivel: 'error', mensaje: `${rango.nombre}: escriba solo números.` });
      continue;
    }
    if (v <= 0) {
      r.push({ campo: rango.campo, nivel: 'error', mensaje: `${rango.nombre}: el valor debe ser mayor que cero.` });
      continue;
    }
    if (rango.campo === 'saturacionO2' && v > 100) {
      r.push({ campo: rango.campo, nivel: 'error', mensaje: 'La saturación de O₂ no puede ser mayor de 100 %.' });
      continue;
    }
    if (v < rango.min || v > rango.max) {
      r.push({
        campo: rango.campo,
        nivel: 'aviso',
        mensaje: `${rango.nombre} de ${v} ${rango.unidad} es improbable. Verifique el dato y la unidad.`,
      });
    }
  }

  // Posibles errores de unidades
  const talla = valores.tallaCm;
  if (talla != null && !Number.isNaN(talla) && talla > 0 && talla < 2.5) {
    r.push({ campo: 'tallaCm', nivel: 'aviso', mensaje: '¿Registró la talla en metros? Debe escribirse en centímetros.' });
  }
  const peso = valores.pesoKg;
  if (peso != null && !Number.isNaN(peso) && peso >= 300) {
    r.push({ campo: 'pesoKg', nivel: 'aviso', mensaje: '¿Registró el peso en gramos? Debe escribirse en kilogramos.' });
  }
  const temp = valores.temperaturaC;
  if (temp != null && !Number.isNaN(temp) && temp >= 90 && temp <= 110) {
    r.push({ campo: 'temperaturaC', nivel: 'aviso', mensaje: '¿Registró la temperatura en °F? Debe escribirse en °C.' });
  }

  const sis = valores.presionSistolica;
  const dia = valores.presionDiastolica;
  if (sis != null && dia != null && !Number.isNaN(sis) && !Number.isNaN(dia) && dia >= sis) {
    r.push({ campo: 'presionDiastolica', nivel: 'aviso', mensaje: 'La diastólica es igual o mayor que la sistólica.' });
  }

  // Tipo de medición: la OMS mide longitud acostado antes de los 24 meses y talla de pie después.
  if (talla != null && !Number.isNaN(talla)) {
    if (!m.tipoMedicion) {
      r.push({ campo: 'tipoMedicion', nivel: 'error', mensaje: 'Indique si la talla se midió acostado o de pie.' });
    } else if (edadMeses != null) {
      if (edadMeses < 24 && m.tipoMedicion === 'de_pie') {
        r.push({ campo: 'tipoMedicion', nivel: 'aviso', mensaje: 'Antes de los 24 meses la referencia OMS usa longitud acostado. Se registrará como medido de pie.' });
      } else if (edadMeses >= 24 && m.tipoMedicion === 'acostado') {
        r.push({ campo: 'tipoMedicion', nivel: 'aviso', mensaje: 'Desde los 24 meses la referencia OMS usa talla de pie. Se registrará como medido acostado.' });
      }
    }
  }

  return r;
}

/** Compara el peso actual con el anterior y avisa si hay un cambio brusco. */
export function alertaCambioPeso(
  pesoAnteriorKg: number | null,
  fechaAnterior: FechaSimple | null,
  pesoActualKg: number | null,
  fechaActual: FechaSimple,
): Problema | null {
  if (pesoAnteriorKg == null || pesoActualKg == null || !fechaAnterior) return null;
  if (Number.isNaN(pesoActualKg) || pesoAnteriorKg <= 0) return null;
  const dias =
    (Date.UTC(fechaActual.anio, fechaActual.mes - 1, fechaActual.dia) -
      Date.UTC(fechaAnterior.anio, fechaAnterior.mes - 1, fechaAnterior.dia)) /
    86400000;
  if (dias < 0 || dias > 90) return null;
  const cambio = (pesoActualKg - pesoAnteriorKg) / pesoAnteriorKg;
  if (cambio <= -0.1) {
    return { campo: 'pesoKg', nivel: 'aviso', mensaje: `El peso bajó ${Math.round(-cambio * 100)} % en ${Math.round(dias)} días respecto a la consulta anterior. Verifique el dato.` };
  }
  // En lactantes pequeños una ganancia rápida es esperable, por eso solo se revisa desde 10 kg.
  if (cambio >= 0.25 && dias <= 30 && pesoAnteriorKg >= 10) {
    return { campo: 'pesoKg', nivel: 'aviso', mensaje: `El peso subió ${Math.round(cambio * 100)} % en ${Math.round(dias)} días respecto a la consulta anterior. Verifique el dato.` };
  }
  return null;
}
