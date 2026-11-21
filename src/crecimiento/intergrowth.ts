// Estándares INTERGROWTH-21st de crecimiento posnatal para prematuros
// (Villar J et al. Postnatal growth standards for preterm infants: the Preterm Postnatal Follow-up Study
//  of the INTERGROWTH-21st Project. Lancet Glob Health 2015;3:e681–91, ecuaciones del apéndice).
// - Edad posmenstrual (EPM) de 27 a 64 semanas; peso y longitud en escala logarítmica, perímetro cefálico lineal.
// - Media y DE dependen de la EPM; el sexo cambia solo la media.
// - Decisión clínica del proyecto (21 nov 2026): se usan antes de las 40 semanas de edad corregida;
//   desde las 40 semanas se usan los patrones OMS con edad corregida.

import type { SexoReferencia } from '../domain/types';

export type IndicadorIG = 'pesoEdad' | 'tallaEdad' | 'pcEdad';

export const EPM_MINIMA = 27;
export const EPM_MAXIMA = 64;

/** Hasta qué edad posmenstrual se usa INTERGROWTH-21st (después: OMS con edad corregida). */
export const EPM_LIMITE_USO = 40;

interface MediaDE {
  media: number;
  de: number;
  /** La media y la DE están en logaritmo natural de la medida. */
  logaritmica: boolean;
}

/** Media y DE de la medida a esa edad posmenstrual (semanas exactas). */
export function mediaDE(indicador: IndicadorIG, sexo: SexoReferencia, epm: number): MediaDE | null {
  if (!(epm >= EPM_MINIMA && epm <= EPM_MAXIMA)) return null;
  const x = epm;
  const varon = sexo === 'M' ? 1 : 0;
  switch (indicador) {
    case 'pesoEdad': // ln(peso en kg)
      return {
        media: 2.591277 - 0.01155 * Math.sqrt(x) - 2201.705 / (x * x) + 0.0911639 * varon,
        de: 0.1470258 + 505.92394 / (x * x) - (140.0576 / (x * x)) * Math.log(x),
        logaritmica: true,
      };
    case 'tallaEdad': // ln(longitud en cm)
      return {
        media: 4.136244 - 547.0018 / (x * x) + 0.0026066 * x + 0.0314961 * varon,
        de: 0.050489 + 310.44761 / (x * x) - (90.0742 / (x * x)) * Math.log(x),
        logaritmica: true,
      };
    case 'pcEdad': // perímetro cefálico en cm
      return {
        media: 55.53617 - 852.0059 / x + 0.7957903 * varon,
        de: 3.0582292 + 3910.05 / (x * x) - 180.5625 / x,
        logaritmica: false,
      };
  }
}

/** Puntaje Z de una medida (peso en kg, longitud y perímetro en cm). */
export function zIntergrowth(indicador: IndicadorIG, sexo: SexoReferencia, epm: number, valor: number): number | null {
  const p = mediaDE(indicador, sexo, epm);
  if (!p || !(valor > 0)) return null;
  const y = p.logaritmica ? Math.log(valor) : valor;
  return (y - p.media) / p.de;
}

/** Medida que corresponde a un puntaje Z (para dibujar las curvas). */
export function valorDeZ(indicador: IndicadorIG, sexo: SexoReferencia, epm: number, z: number): number | null {
  const p = mediaDE(indicador, sexo, epm);
  if (!p) return null;
  const y = p.media + z * p.de;
  return p.logaritmica ? Math.exp(y) : y;
}

/** Edad posmenstrual en semanas exactas: semanas al nacer + días de vida / 7. */
export function edadPosmenstrual(semanasGestacion: number, diasDeVida: number): number {
  return semanasGestacion + diasDeVida / 7;
}

/** "34 3/7 semanas" */
export function textoEPM(epm: number): string {
  const semanas = Math.floor(epm + 1e-9);
  const dias = Math.round((epm - semanas) * 7);
  return dias === 0 || dias === 7 ? `${dias === 7 ? semanas + 1 : semanas} semanas` : `${semanas} ${dias}/7 semanas`;
}
