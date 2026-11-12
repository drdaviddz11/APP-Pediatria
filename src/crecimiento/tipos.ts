import type { SexoReferencia, TipoMedicion } from '../domain/types';

/** Tabla LMS: valores [L, M, S] consecutivos para cada punto desde `inicio` cada `paso`. */
export interface TablaLMS {
  inicio: number;
  paso: number;
  M: readonly number[]; // masculino
  F: readonly number[]; // femenino
}

export interface LMS {
  l: number;
  m: number;
  s: number;
}

export type Indicador = 'pesoEdad' | 'tallaEdad' | 'pesoTalla' | 'imcEdad' | 'pcEdad';

export type Referencia = 'OMS2006' | 'OMS2007';

export const NOMBRE_REFERENCIA: Record<Referencia, string> = {
  OMS2006: 'Patrones de crecimiento OMS 2006 (0–5 años)',
  OMS2007: 'Referencia de crecimiento OMS 2007 (5–19 años)',
};

export const NOMBRE_INDICADOR: Record<Indicador, string> = {
  pesoEdad: 'Peso para la edad',
  tallaEdad: 'Longitud/talla para la edad',
  pesoTalla: 'Peso para la longitud/talla',
  imcEdad: 'IMC para la edad',
  pcEdad: 'Perímetro cefálico para la edad',
};

export interface DatosEvaluacion {
  sexo: SexoReferencia;
  fechaNacimiento: string; // AAAA-MM-DD
  fechaMedicion: string; // AAAA-MM-DD
  semanasGestacion: number | null;
  pesoKg: number | null;
  tallaCm: number | null;
  tipoMedicion: TipoMedicion | null;
  perimetroCefalicoCm: number | null;
  /** Edema bilateral con fóvea: la OMS no calcula indicadores basados en peso. */
  edema: boolean;
}

export interface ResultadoIndicador {
  indicador: Indicador;
  referencia: Referencia;
  /** Puntaje Z redondeado a 2 decimales (como el software de la OMS), o null si no aplica. */
  z: number | null;
  /** Percentil (0–100) calculado a partir de Z. */
  percentil: number | null;
  /** Explica por qué no se calculó (fuera de rango de edad o de talla, falta un dato…). */
  motivoNoCalculado?: string;
  /** Valor fuera de los límites de plausibilidad de la OMS: probable error de medición o registro. */
  improbable: boolean;
  /** Valor usado para el cálculo (por ejemplo, talla ajustada o IMC). */
  valorUsado: number | null;
}

export interface ResultadoEvaluacion {
  edadDiasCronologica: number;
  /** Edad usada para las referencias (corregida en prematuros cuando corresponde). */
  edadDiasUsada: number | null;
  edadMesesUsada: number | null;
  usaEdadCorregida: boolean;
  referencia: Referencia | null;
  /** Talla con el ajuste OMS de ±0.7 cm según la posición de medición, si se aplicó. */
  tallaAjustadaCm: number | null;
  ajusteTalla: number; // +0.7, -0.7 o 0
  imc: number | null;
  indicadores: ResultadoIndicador[];
  notas: string[];
}
