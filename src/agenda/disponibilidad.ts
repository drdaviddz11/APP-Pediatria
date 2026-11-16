// Horarios disponibles, traslapes y validación de la configuración de la agenda.

import {
  diaSemana,
  fechaDeMomento,
  horaDeMinutos,
  horaDeMomento,
  minutosDeHora,
  momento,
  sumarMinutos,
} from './tiempo';
import type { Bloqueo, Cita, ConfiguracionAgenda, RangoHorario } from './tipos';
import { esActiva } from './tipos';

export interface Intervalo {
  inicio: string; // momento
  fin: string; // momento
}

/** Dos intervalos se traslapan si uno empieza antes de que termine el otro (tocarse no cuenta). */
export function seTraslapan(a: Intervalo, b: Intervalo): boolean {
  return a.inicio < b.fin && a.fin > b.inicio;
}

/** Rangos de atención de una fecha según el día de la semana. */
export function rangosDelDia(config: ConfiguracionAgenda, fecha: string): RangoHorario[] {
  return config.horario[diaSemana(fecha)] ?? [];
}

/**
 * Horas de inicio libres para una cita de `duracion` minutos en `fecha`.
 * Descarta las que se traslapan con citas activas o bloqueos, y las que ya pasaron.
 */
export function horariosDisponibles(
  fecha: string,
  duracion: number,
  config: ConfiguracionAgenda,
  ocupados: Intervalo[],
  ahora?: string,
): string[] {
  const libres: string[] = [];
  const paso = Math.max(5, config.intervalo);
  for (const rango of rangosDelDia(config, fecha)) {
    const desde = minutosDeHora(rango.inicio);
    const hasta = minutosDeHora(rango.fin);
    if (desde == null || hasta == null) continue;
    for (let t = desde; t + duracion <= hasta; t += paso) {
      const inicio = momento(fecha, horaDeMinutos(t));
      if (ahora && inicio < ahora) continue;
      const intervalo = { inicio, fin: sumarMinutos(inicio, duracion) };
      if (ocupados.some((o) => seTraslapan(intervalo, o))) continue;
      libres.push(horaDeMinutos(t));
    }
  }
  return libres;
}

/** ¿El intervalo cae completo dentro de un rango de atención del mismo día? */
export function dentroDeHorario(intervalo: Intervalo, config: ConfiguracionAgenda): boolean {
  const fecha = fechaDeMomento(intervalo.inicio);
  if (fechaDeMomento(intervalo.fin) !== fecha && horaDeMomento(intervalo.fin) !== '00:00') return false;
  const ini = minutosDeHora(horaDeMomento(intervalo.inicio));
  const fin = fechaDeMomento(intervalo.fin) !== fecha ? 24 * 60 : minutosDeHora(horaDeMomento(intervalo.fin));
  if (ini == null || fin == null) return false;
  return rangosDelDia(config, fecha).some((r) => {
    const a = minutosDeHora(r.inicio);
    const b = minutosDeHora(r.fin);
    return a != null && b != null && ini >= a && fin <= b;
  });
}

/** Citas activas (de otra cita) y bloqueos que se traslapan con el intervalo. */
export function conflictos(
  intervalo: Intervalo & { id?: string },
  citas: Pick<Cita, 'id' | 'inicio' | 'fin' | 'estado'>[],
  bloqueos: Pick<Bloqueo, 'inicio' | 'fin'>[],
): { citas: typeof citas; bloqueos: typeof bloqueos } {
  return {
    citas: citas.filter((c) => c.id !== intervalo.id && esActiva(c.estado) && seTraslapan(intervalo, c)),
    bloqueos: bloqueos.filter((b) => seTraslapan(intervalo, b)),
  };
}

/** Errores de la configuración de horario (vacío si es válida). */
export function validarConfiguracion(config: ConfiguracionAgenda): string[] {
  const errores: string[] = [];
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  for (let d = 0; d < 7; d++) {
    const rangos = config.horario[d] ?? [];
    const leidos: [number, number][] = [];
    for (const r of rangos) {
      const a = minutosDeHora(r.inicio);
      const b = minutosDeHora(r.fin);
      if (a == null || b == null) {
        errores.push(`${dias[d]}: hora no válida (${r.inicio}–${r.fin}).`);
        continue;
      }
      if (a >= b) errores.push(`${dias[d]}: la hora de inicio (${r.inicio}) debe ser antes de la de fin (${r.fin}).`);
      leidos.push([a, b]);
    }
    leidos.sort((x, y) => x[0] - y[0]);
    for (let i = 1; i < leidos.length; i++) {
      if (leidos[i][0] < leidos[i - 1][1]) errores.push(`${dias[d]}: los horarios de mañana y tarde se traslapan.`);
    }
  }
  for (const [nombre, v] of [
    ['primera consulta', config.duracionPrimera],
    ['control', config.duracionControl],
  ] as const) {
    if (!Number.isInteger(v) || v < 5 || v > 240) errores.push(`Duración de ${nombre}: entre 5 y 240 minutos.`);
  }
  if (!Number.isInteger(config.intervalo) || config.intervalo < 5 || config.intervalo > 120) {
    errores.push('Intervalo entre horarios: entre 5 y 120 minutos.');
  }
  return errores;
}

/** Texto del horario de un día: "08:00–12:00 · 14:00–18:00" o "Sin atención". */
export function textoHorarioDia(config: ConfiguracionAgenda, fecha: string): string {
  const r = rangosDelDia(config, fecha);
  return r.length === 0 ? 'Sin atención este día' : r.map((x) => `${x.inicio}–${x.fin}`).join(' · ');
}
