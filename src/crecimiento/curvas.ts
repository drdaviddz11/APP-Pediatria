// Curvas de referencia OMS para las gráficas de crecimiento.

import type { SexoReferencia } from '../domain/types';
import { OMS2006 } from './datos/oms2006';
import { OMS2007 } from './datos/oms2007';
import { DIAS_POR_MES } from './evaluacion';
import { lmsEnIndice, tamanoTabla, valorEnZ, zDePercentil } from './lms';
import type { Indicador, ResultadoEvaluacion, TablaLMS } from './tipos';

export type Rango = '0-2' | '2-5' | '5-19';
export type Escala = 'z' | 'percentil';

export const NOMBRE_RANGO: Record<Rango, string> = { '0-2': '0–2 años', '2-5': '2–5 años', '5-19': '5–19 años' };

export interface LineaReferencia {
  etiqueta: string; // "0", "-2", "P50"…
  tipo: 'mediana' | 'media' | 'extrema' | 'leve';
  puntos: { x: number; y: number }[];
}

export interface ConfigGrafica {
  disponible: boolean;
  motivo?: string;
  ejeX: { titulo: string; min: number; max: number; marcas: number[]; textoMarca: (x: number) => string };
  unidadY: string;
  lineas: LineaReferencia[];
}

export const LINEAS_Z = [-3, -2, -1, 0, 1, 2, 3];
export const LINEAS_PERCENTIL = [3, 15, 50, 85, 97];

function tipoZ(z: number): LineaReferencia['tipo'] {
  if (z === 0) return 'mediana';
  if (Math.abs(z) === 2) return 'media';
  if (Math.abs(z) === 3) return 'extrema';
  return 'leve';
}

function tipoPercentil(p: number): LineaReferencia['tipo'] {
  if (p === 50) return 'mediana';
  if (p === 3 || p === 97) return 'media';
  return 'leve';
}

/** Recorre la tabla entre dos índices, cada `salto` puntos, y devuelve (x, LMS). */
function* recorrer(tabla: TablaLMS, sexo: SexoReferencia, desde: number, hasta: number, salto: number) {
  const ultimo = Math.min(hasta, tamanoTabla(tabla) - 1);
  for (let i = desde; i <= ultimo; i += salto) {
    const lms = lmsEnIndice(tabla, sexo, i);
    if (lms) yield { x: tabla.inicio + i * tabla.paso, lms };
    if (i < ultimo && i + salto > ultimo) {
      const fin = lmsEnIndice(tabla, sexo, ultimo);
      if (fin) yield { x: tabla.inicio + ultimo * tabla.paso, lms: fin };
    }
  }
}

function lineas(
  tabla: TablaLMS,
  sexo: SexoReferencia,
  desde: number,
  hasta: number,
  salto: number,
  aX: (x: number) => number,
  escala: Escala,
): LineaReferencia[] {
  const valores = escala === 'z' ? LINEAS_Z : LINEAS_PERCENTIL;
  return valores.map((v) => {
    const z = escala === 'z' ? v : zDePercentil(v);
    const puntos: { x: number; y: number }[] = [];
    for (const { x, lms } of recorrer(tabla, sexo, desde, hasta, salto)) {
      puntos.push({ x: aX(x), y: valorEnZ(z, lms) });
    }
    return {
      etiqueta: escala === 'z' ? (v > 0 ? `+${v}` : String(v)) : `P${v}`,
      tipo: escala === 'z' ? tipoZ(v) : tipoPercentil(v),
      puntos,
    };
  });
}

const enMeses = (dias: number) => dias / DIAS_POR_MES;
const marcasCada = (min: number, max: number, paso: number) => {
  const r: number[] = [];
  for (let x = Math.ceil(min / paso) * paso; x <= max + 1e-9; x += paso) r.push(Math.round(x * 10) / 10);
  return r;
};
const textoMeses = (x: number) => `${Math.round(x)}`;
const textoAnios = (x: number) => `${Math.round(x / 12)}`;

const TABLAS_EDAD: Record<Exclude<Indicador, 'pesoTalla'>, { oms2006: TablaLMS; oms2007?: TablaLMS; unidad: string }> = {
  pesoEdad: { oms2006: OMS2006.pesoEdad, oms2007: OMS2007.pesoEdad, unidad: 'kg' },
  tallaEdad: { oms2006: OMS2006.tallaEdad, oms2007: OMS2007.tallaEdad, unidad: 'cm' },
  imcEdad: { oms2006: OMS2006.imcEdad, oms2007: OMS2007.imcEdad, unidad: 'kg/m²' },
  pcEdad: { oms2006: OMS2006.pcEdad, unidad: 'cm' },
};

export function configurarGrafica(indicador: Indicador, sexo: SexoReferencia, rango: Rango, escala: Escala): ConfigGrafica {
  const noDisponible = (motivo: string): ConfigGrafica => ({
    disponible: false,
    motivo,
    ejeX: { titulo: '', min: 0, max: 1, marcas: [], textoMarca: String },
    unidadY: '',
    lineas: [],
  });

  if (indicador === 'pesoTalla') {
    if (rango === '5-19') return noDisponible('La OMS no tiene referencia de peso para la talla después de los 5 años. Use IMC para la edad.');
    const usaLongitud = rango === '0-2';
    const tabla = usaLongitud ? OMS2006.pesoLongitud : OMS2006.pesoTalla;
    const [min, max] = usaLongitud ? [45, 110] : [65, 120];
    return {
      disponible: true,
      ejeX: { titulo: usaLongitud ? 'Longitud (cm)' : 'Talla (cm)', min, max, marcas: marcasCada(min, max, 10), textoMarca: (x) => `${x}` },
      unidadY: 'kg',
      lineas: lineas(tabla, sexo, 0, tamanoTabla(tabla) - 1, 10, (x) => x, escala),
    };
  }

  const t = TABLAS_EDAD[indicador];
  if (rango === '5-19') {
    if (!t.oms2007) return noDisponible('La OMS no tiene referencia de perímetro cefálico después de los 5 años.');
    const ultimoMes = indicador === 'pesoEdad' ? 120 : 228;
    return {
      disponible: true,
      ejeX: { titulo: 'Edad (años)', min: 60, max: ultimoMes, marcas: marcasCada(60, ultimoMes, 12), textoMarca: textoAnios },
      unidadY: t.unidad,
      lineas: lineas(t.oms2007, sexo, 0, ultimoMes - 60, 1, (x) => x, escala),
    };
  }
  const [desde, hasta] = rango === '0-2' ? [0, 730] : [731, 1826];
  const [mMin, mMax] = rango === '0-2' ? [0, 24] : [24, 60];
  return {
    disponible: true,
    ejeX: {
      titulo: rango === '0-2' ? 'Edad (meses)' : 'Edad (meses)',
      min: mMin,
      max: mMax,
      marcas: marcasCada(mMin, mMax, rango === '0-2' ? 3 : 6),
      textoMarca: textoMeses,
    },
    unidadY: t.unidad,
    lineas: lineas(t.oms2006, sexo, desde, hasta, 7, enMeses, escala),
  };
}

/** Rango que corresponde a una edad en meses. */
export function rangoParaEdad(meses: number): Rango {
  if (meses < 24) return '0-2';
  if (meses < 60) return '2-5';
  return '5-19';
}

export interface PuntoPaciente {
  x: number;
  y: number;
  z: number | null;
  fecha: string;
}

/** Mediciones del paciente que caen en la gráfica elegida. */
export function puntosPaciente(
  indicador: Indicador,
  rango: Rango,
  evaluaciones: { fecha: string; e: ResultadoEvaluacion }[],
): PuntoPaciente[] {
  const puntos: PuntoPaciente[] = [];
  for (const { fecha, e } of evaluaciones) {
    if (e.edadMesesUsada == null) continue;
    const r = e.indicadores.find((i) => i.indicador === indicador);
    if (!r || r.valorUsado == null || r.z == null) continue;
    const meses = e.edadMesesUsada;
    const enRango = rango === '0-2' ? meses < 24 : rango === '2-5' ? meses >= 24 && meses < 60 : meses >= 60;
    if (!enRango) continue;
    if (indicador === 'pesoTalla') {
      if (e.tallaAjustadaCm == null) continue;
      puntos.push({ x: e.tallaAjustadaCm, y: r.valorUsado, z: r.z, fecha });
    } else {
      puntos.push({ x: meses, y: r.valorUsado, z: r.z, fecha });
    }
  }
  return puntos.sort((a, b) => a.x - b.x);
}
