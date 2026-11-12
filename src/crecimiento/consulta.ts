// Une los datos del expediente con el motor de evaluación OMS.

import { aISO, deDate } from '../domain/fechas';
import type { Consulta, Paciente } from '../domain/types';
import { evaluarCrecimiento } from './evaluacion';
import type { Indicador, ResultadoEvaluacion } from './tipos';
import { NOMBRE_INDICADOR } from './tipos';

/** Fecha de calendario (en el teléfono) de una consulta. */
export function fechaDeConsulta(c: Pick<Consulta, 'fechaHora'>): string {
  return aISO(deDate(new Date(c.fechaHora)));
}

export function evaluarConsulta(
  p: Pick<Paciente, 'sexo' | 'fechaNacimiento' | 'semanasGestacion' | 'sindromeDown'>,
  c: Pick<Consulta, 'fechaHora' | 'pesoKg' | 'tallaCm' | 'tipoMedicion' | 'perimetroCefalicoCm' | 'edema'>,
): ResultadoEvaluacion | null {
  if (c.pesoKg == null && c.tallaCm == null && c.perimetroCefalicoCm == null) return null;
  return evaluarCrecimiento({
    sexo: p.sexo,
    fechaNacimiento: p.fechaNacimiento,
    fechaMedicion: fechaDeConsulta(c),
    semanasGestacion: p.semanasGestacion,
    pesoKg: c.pesoKg,
    tallaCm: c.tallaCm,
    tipoMedicion: c.tipoMedicion,
    perimetroCefalicoCm: c.perimetroCefalicoCm,
    edema: c.edema,
    sindromeDown: p.sindromeDown,
  });
}

export interface AlertaTendencia {
  indicador: Indicador;
  mensaje: string;
}

/** Caída de este tamaño o mayor en el puntaje Z respecto a la medición anterior genera aviso. */
export const CAIDA_Z_ALERTA = 1;

/**
 * Compara una evaluación con la anterior del mismo paciente. Avisa caídas importantes de Z y
 * el paso por debajo de −2 DE. Solo compara indicadores calculados con la misma referencia.
 */
export function alertasTendencia(anterior: ResultadoEvaluacion | null, actual: ResultadoEvaluacion | null): AlertaTendencia[] {
  if (!anterior || !actual) return [];
  const alertas: AlertaTendencia[] = [];
  for (const a of actual.indicadores) {
    if (a.z == null || a.improbable) continue;
    const b = anterior.indicadores.find((x) => x.indicador === a.indicador && x.referencia === a.referencia);
    if (!b || b.z == null || b.improbable) continue;
    const caida = b.z - a.z;
    const nombre = NOMBRE_INDICADOR[a.indicador];
    if (caida >= CAIDA_Z_ALERTA) {
      alertas.push({ indicador: a.indicador, mensaje: `${nombre}: el puntaje Z bajó ${caida.toFixed(2)} (de ${b.z.toFixed(2)} a ${a.z.toFixed(2)}).` });
    } else if (b.z >= -2 && a.z < -2) {
      alertas.push({ indicador: a.indicador, mensaje: `${nombre}: cruzó por debajo de −2 DE (de ${b.z.toFixed(2)} a ${a.z.toFixed(2)}).` });
    }
  }
  return alertas;
}
