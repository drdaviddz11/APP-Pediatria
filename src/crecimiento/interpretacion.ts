// Interpretación de puntajes Z con los puntos de corte de la OMS.
//   0–5 años: WHO Child Growth Standards, Training Course on Child Growth Assessment (2008).
//   5–19 años: WHO Growth Reference 2007 (de Onis et al., Bull WHO 2007).
//   Síndrome de Down: las curvas CDC (Zemel 2015) describen el crecimiento de niños con SD y no
//   definen puntos de corte de desnutrición; se describe la posición por percentil.
// Es apoyo a la decisión clínica: siempre requiere la valoración del médico.

import { percentilDeZ } from './lms';
import type { Indicador, Referencia, ResultadoEvaluacion, ResultadoIndicador } from './tipos';
import { esReferenciaDown, NOMBRE_INDICADOR, NOMBRE_REFERENCIA } from './tipos';

export type Nivel = 'normal' | 'vigilar' | 'alerta' | 'grave';

export interface Interpretacion {
  texto: string;
  nivel: Nivel;
}

function porCorte(z: number, cortes: [number, string, Nivel][], porDefecto: Interpretacion): Interpretacion {
  for (const [limite, texto, nivel] of cortes) {
    if (limite < 0 ? z < limite : z > limite) return { texto, nivel };
  }
  return porDefecto;
}

const NORMAL = (texto: string): Interpretacion => ({ texto, nivel: 'normal' });

function interpretarDown(indicador: Indicador, z: number): Interpretacion {
  const p = percentilDeZ(z);
  const nombre: Record<Indicador, string> = {
    pesoEdad: 'Peso',
    tallaEdad: 'Talla',
    pesoTalla: 'Peso para la longitud',
    imcEdad: 'IMC',
    pcEdad: 'Perímetro cefálico',
  };
  const n = nombre[indicador];
  if (p < 2) return { texto: `${n} muy bajo para niños con síndrome de Down (< P2)`, nivel: 'grave' };
  if (p < 5) return { texto: `${n} bajo para niños con síndrome de Down (< P5)`, nivel: 'alerta' };
  if (p > 98) return { texto: `${n} muy alto para niños con síndrome de Down (> P98)`, nivel: 'grave' };
  if (p > 95) return { texto: `${n} alto para niños con síndrome de Down (> P95)`, nivel: 'alerta' };
  return NORMAL(`${n} dentro de lo esperado para niños con síndrome de Down (P5–P95)`);
}

export function interpretar(indicador: Indicador, referencia: Referencia, z: number): Interpretacion {
  if (esReferenciaDown(referencia)) return interpretarDown(indicador, z);
  if (referencia === 'OMS2006') {
    switch (indicador) {
      case 'tallaEdad':
        return porCorte(
          z,
          [
            [-3, 'Talla baja severa', 'grave'],
            [-2, 'Talla baja', 'alerta'],
            [3, 'Talla muy alta (> +3 DE): descartar causa endocrina', 'vigilar'],
          ],
          NORMAL('Talla adecuada para la edad'),
        );
      case 'pesoEdad':
        return porCorte(
          z,
          [
            [-3, 'Bajo peso severo', 'grave'],
            [-2, 'Bajo peso', 'alerta'],
            [1, 'Peso alto para la edad: valorar con peso para la talla o IMC', 'vigilar'],
          ],
          NORMAL('Peso adecuado para la edad'),
        );
      case 'pesoTalla':
      case 'imcEdad':
        return porCorte(
          z,
          [
            [-3, 'Emaciación severa', 'grave'],
            [-2, 'Emaciación', 'alerta'],
            [3, 'Obesidad', 'grave'],
            [2, 'Sobrepeso', 'alerta'],
            [1, 'Riesgo de sobrepeso', 'vigilar'],
          ],
          NORMAL('Estado nutricional adecuado'),
        );
      case 'pcEdad':
        return porCorte(
          z,
          [
            [-3, 'Perímetro cefálico muy bajo (< −3 DE)', 'grave'],
            [-2, 'Perímetro cefálico bajo (< −2 DE)', 'alerta'],
            [3, 'Perímetro cefálico muy alto (> +3 DE)', 'grave'],
            [2, 'Perímetro cefálico alto (> +2 DE)', 'alerta'],
          ],
          NORMAL('Perímetro cefálico adecuado'),
        );
    }
  }
  // OMS 2007 (5–19 años)
  switch (indicador) {
    case 'imcEdad':
      return porCorte(
        z,
        [
          [-3, 'Delgadez severa', 'grave'],
          [-2, 'Delgadez', 'alerta'],
          [2, 'Obesidad', 'grave'],
          [1, 'Sobrepeso', 'alerta'],
        ],
        NORMAL('IMC adecuado para la edad'),
      );
    case 'tallaEdad':
      return porCorte(
        z,
        [
          [-3, 'Talla baja severa', 'grave'],
          [-2, 'Talla baja', 'alerta'],
          [3, 'Talla muy alta (> +3 DE): descartar causa endocrina', 'vigilar'],
        ],
        NORMAL('Talla adecuada para la edad'),
      );
    case 'pesoEdad':
      return porCorte(
        z,
        [
          [-3, 'Bajo peso severo', 'grave'],
          [-2, 'Bajo peso', 'alerta'],
        ],
        NORMAL('Peso para la edad sin bajo peso (valorar el exceso con IMC)'),
      );
    default:
      return NORMAL('Sin interpretación para esta referencia');
  }
}

export function interpretarIndicador(r: ResultadoIndicador): Interpretacion | null {
  if (r.z == null) return null;
  if (r.improbable) {
    return { texto: 'Valor biológicamente improbable: verificar medición y registro', nivel: 'grave' };
  }
  return interpretar(r.indicador, r.referencia, r.z);
}

/** Texto que sustenta el resultado: indicador, referencia y puntaje Z. */
export function sustento(r: ResultadoIndicador): string {
  const z = r.z == null ? '' : `, Z ${r.z > 0 ? '+' : ''}${r.z.toFixed(2)}`;
  return `${NOMBRE_INDICADOR[r.indicador]} (${NOMBRE_REFERENCIA[r.referencia]}${z})`;
}

/**
 * Resumen del estado nutricional usando el indicador principal según la edad:
 * peso para la talla en < 5 años (o IMC si no hay peso/talla) e IMC para la edad desde los 5 años,
 * más la talla para la edad.
 */
export function resumenNutricional(e: ResultadoEvaluacion): { texto: string; nivel: Nivel; sustento: string }[] {
  const resumen: { texto: string; nivel: Nivel; sustento: string }[] = [];
  const buscar = (i: Indicador) => e.indicadores.find((x) => x.indicador === i && x.z != null);
  const principal =
    e.referencia === 'OMS2006' || e.referencia === 'SD036' ? buscar('pesoTalla') ?? buscar('imcEdad') : buscar('imcEdad');
  const talla = buscar('tallaEdad');
  for (const r of [principal, talla]) {
    if (!r) continue;
    const i = interpretarIndicador(r);
    if (i) resumen.push({ ...i, sustento: sustento(r) });
  }
  // Síndrome de Down desde los 2 años: sobrepeso/obesidad con la referencia general.
  if (e.comparacionGeneral) {
    const i = interpretarIndicador(e.comparacionGeneral);
    if (i) resumen.push({ ...i, sustento: `${sustento(e.comparacionGeneral)}; referencia general para sobrepeso u obesidad` });
  }
  return resumen;
}

export const NOTA_DOWN =
  'Curvas CDC para síndrome de Down (Zemel et al., Pediatrics 2015), de una muestra de EE. UU. que puede no representar a todos los niños con SD. Para sobrepeso u obesidad desde los 2 años se usa la referencia general.';

export const AVISO_CLINICO =
  'Apoyo a la decisión clínica. La interpretación no es un diagnóstico y requiere valoración médica.';
