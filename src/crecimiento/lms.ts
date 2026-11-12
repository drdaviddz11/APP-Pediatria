// Método LMS de la OMS para puntajes Z, tal como lo implementan los paquetes oficiales
// anthro (0–5 años) y anthroplus (5–19 años) de la OMS.
// Referencia: WHO Child Growth Standards, Methods and development, cap. 7.

import type { LMS, TablaLMS } from './tipos';
import type { SexoReferencia } from '../domain/types';

/** Puntaje Z sin ajuste: ((y/M)^L − 1) / (L·S). Se usa en longitud/talla y perímetro cefálico. */
export function zLMS(y: number, { l, m, s }: LMS): number {
  if (l === 0) return Math.log(y / m) / s;
  return (Math.pow(y / m, l) - 1) / (s * l);
}

/** Valor de la medida que corresponde a un puntaje Z. */
export function valorEnZ(z: number, { l, m, s }: LMS): number {
  if (l === 0) return m * Math.exp(s * z);
  return m * Math.pow(1 + l * s * z, 1 / l);
}

/**
 * Puntaje Z con la corrección OMS para |Z| > 3 (indicadores basados en peso):
 * más allá de ±3 se extrapola linealmente con la distancia entre las curvas de 2 y 3 DE.
 */
export function zLMSAjustado(y: number, lms: LMS): number {
  const z = zLMS(y, lms);
  if (z > 3) {
    const sd3 = valorEnZ(3, lms);
    const sd23 = sd3 - valorEnZ(2, lms);
    return 3 + (y - sd3) / sd23;
  }
  if (z < -3) {
    const sd3neg = valorEnZ(-3, lms);
    const sd23neg = valorEnZ(-2, lms) - sd3neg;
    return -3 + (y - sd3neg) / sd23neg;
  }
  return z;
}

function datosSexo(tabla: TablaLMS, sexo: SexoReferencia): readonly number[] {
  return sexo === 'M' ? tabla.M : tabla.F;
}

/** Número de puntos de la tabla. */
export function tamanoTabla(tabla: TablaLMS): number {
  return tabla.M.length / 3;
}

/** LMS en un índice exacto de la tabla, o null si está fuera de ella. */
export function lmsEnIndice(tabla: TablaLMS, sexo: SexoReferencia, indice: number): LMS | null {
  const d = datosSexo(tabla, sexo);
  if (!Number.isInteger(indice) || indice < 0 || indice * 3 + 2 >= d.length) return null;
  return { l: d[indice * 3], m: d[indice * 3 + 1], s: d[indice * 3 + 2] };
}

/** LMS en un punto de la tabla (sin interpolar). `x` debe coincidir con un punto de la tabla. */
export function lmsEnPunto(tabla: TablaLMS, sexo: SexoReferencia, x: number): LMS | null {
  return lmsEnIndice(tabla, sexo, Math.round((x - tabla.inicio) / tabla.paso));
}

/** LMS interpolado linealmente entre dos puntos consecutivos de la tabla. */
export function lmsInterpolado(tabla: TablaLMS, sexo: SexoReferencia, inferior: number, fraccion: number): LMS | null {
  const a = lmsEnPunto(tabla, sexo, inferior);
  if (!a) return null;
  if (fraccion <= 0) return a;
  const b = lmsEnPunto(tabla, sexo, inferior + tabla.paso);
  if (!b) return null;
  return {
    l: a.l + fraccion * (b.l - a.l),
    m: a.m + fraccion * (b.m - a.m),
    s: a.s + fraccion * (b.s - a.s),
  };
}

/** Redondeo a 2 decimales, como el software de la OMS. */
export function redondear2(z: number): number {
  const r = Math.round(z * 100) / 100;
  return r === 0 ? 0 : r; // evita mostrar "-0.00"
}

// ---------------------------------------------------------------------------
// Distribución normal: Z ↔ percentil
// ---------------------------------------------------------------------------

/** Función de distribución normal estándar (error < 1e-7). */
export function normalCDF(z: number): number {
  // Aproximación de erfc de W. J. Cody / Numerical Recipes (erfcc), precisión ~1.2e-7.
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.5 * x);
  const erfc =
    t *
    Math.exp(
      -x * x -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return z >= 0 ? 1 - erfc / 2 : erfc / 2;
}

/** Percentil (0–100) correspondiente a un puntaje Z. */
export function percentilDeZ(z: number): number {
  return normalCDF(z) * 100;
}

/** Puntaje Z correspondiente a un percentil (0–100). Algoritmo de Acklam. */
export function zDePercentil(percentil: number): number {
  const p = percentil / 100;
  if (p <= 0 || p >= 1) throw new Error('Percentil fuera de rango');
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771542, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const bajo = 0.02425;
  if (p < bajo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - bajo) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Texto del percentil: "<0.1", ">99.9" o con un decimal. */
export function textoPercentil(p: number | null): string {
  if (p == null) return '—';
  if (p < 0.1) return '<0.1';
  if (p > 99.9) return '>99.9';
  return p < 10 || p > 90 ? p.toFixed(1) : String(Math.round(p));
}
