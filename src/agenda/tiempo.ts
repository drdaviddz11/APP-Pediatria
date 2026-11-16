// Manejo de fechas y horas de la agenda, en hora local del consultorio.

import { aISO, deDate, leerFechaISO } from '../domain/fechas';

export const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const NOMBRES_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function dos(n: number): string {
  return String(n).padStart(2, '0');
}

/** "08:30" → 510. Devuelve null si no es una hora válida. Acepta "24:00" como fin de día. */
export function minutosDeHora(hora: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

/** 510 → "08:30". */
export function horaDeMinutos(minutos: number): string {
  return `${dos(Math.floor(minutos / 60))}:${dos(minutos % 60)}`;
}

/** Lee una hora escrita por el usuario: "8", "8:30", "08:30", "830", "0830". */
export function leerHoraUsuario(texto: string): string | null {
  const t = texto.trim().replace('.', ':');
  let m = /^(\d{1,2})$/.exec(t);
  if (m) return validar(Number(m[1]), 0);
  m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (m) return validar(Number(m[1]), Number(m[2]));
  m = /^(\d{1,2})(\d{2})$/.exec(t);
  if (m) return validar(Number(m[1]), Number(m[2]));
  return null;

  function validar(h: number, min: number): string | null {
    if (h > 23 || min > 59) return null;
    return `${dos(h)}:${dos(min)}`;
  }
}

export function momento(fecha: string, hora: string): string {
  return `${fecha}T${hora}`;
}

export function fechaDeMomento(m: string): string {
  return m.slice(0, 10);
}

export function horaDeMomento(m: string): string {
  return m.slice(11, 16);
}

function aUTC(fecha: string): number {
  const f = leerFechaISO(fecha);
  if (!f) throw new Error(`Fecha inválida: ${fecha}`);
  return Date.UTC(f.anio, f.mes - 1, f.dia);
}

function deUTC(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
}

export function sumarDias(fecha: string, dias: number): string {
  return deUTC(aUTC(fecha) + dias * 86400000);
}

/** Suma minutos a un momento (puede pasar al día siguiente). */
export function sumarMinutos(m: string, minutos: number): string {
  const base = aUTC(fechaDeMomento(m)) + ((minutosDeHora(horaDeMomento(m)) ?? 0) + minutos) * 60000;
  const d = new Date(base);
  return `${deUTC(base)}T${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`;
}

/** Minutos entre dos momentos. */
export function minutosEntre(desde: string, hasta: string): number {
  const a = aUTC(fechaDeMomento(desde)) / 60000 + (minutosDeHora(horaDeMomento(desde)) ?? 0);
  const b = aUTC(fechaDeMomento(hasta)) / 60000 + (minutosDeHora(horaDeMomento(hasta)) ?? 0);
  return Math.round(b - a);
}

/** 0 = domingo … 6 = sábado. */
export function diaSemana(fecha: string): number {
  return new Date(aUTC(fecha)).getUTCDay();
}

/** Lunes de la semana de la fecha. */
export function inicioSemana(fecha: string): string {
  const d = diaSemana(fecha);
  return sumarDias(fecha, d === 0 ? -6 : 1 - d);
}

export function primerDiaMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

export function sumarMeses(fecha: string, meses: number): string {
  const f = leerFechaISO(fecha);
  if (!f) throw new Error(`Fecha inválida: ${fecha}`);
  const indice = f.anio * 12 + (f.mes - 1) + meses;
  const anio = Math.floor(indice / 12);
  const mes = (indice % 12) + 1;
  const ultimo = new Date(anio, mes, 0).getDate();
  return `${anio}-${dos(mes)}-${dos(Math.min(f.dia, ultimo))}`;
}

/** Semanas (de lunes a domingo) que cubren el mes; cada día es una fecha o null si es de otro mes. */
export function semanasDelMes(fecha: string): (string | null)[][] {
  const primero = primerDiaMes(fecha);
  const mes = primero.slice(0, 7);
  let dia = inicioSemana(primero);
  const semanas: (string | null)[][] = [];
  do {
    const semana: (string | null)[] = [];
    for (let i = 0; i < 7; i++) {
      semana.push(dia.slice(0, 7) === mes ? dia : null);
      dia = sumarDias(dia, 1);
    }
    semanas.push(semana);
  } while (dia.slice(0, 7) === mes);
  return semanas;
}

export function hoyISO(): string {
  return aISO(deDate(new Date()));
}

/** Momento actual en hora local del teléfono. */
export function ahoraMomento(d: Date = new Date()): string {
  return `${aISO(deDate(d))}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** "lunes 16 de noviembre de 2026" */
export function textoFechaLarga(fecha: string, conAnio = true): string {
  const f = leerFechaISO(fecha);
  if (!f) return fecha;
  const base = `${NOMBRES_DIA[diaSemana(fecha)]} ${f.dia} de ${NOMBRES_MES[f.mes - 1]}`;
  return conAnio ? `${base} de ${f.anio}` : base;
}

/** "lun 16 nov" */
export function textoFechaCorta(fecha: string): string {
  const f = leerFechaISO(fecha);
  if (!f) return fecha;
  return `${DIAS_CORTOS[diaSemana(fecha)]} ${f.dia} ${MESES_CORTOS[f.mes - 1]}`;
}

/** "noviembre 2026" */
export function textoMes(fecha: string): string {
  const f = leerFechaISO(fecha);
  return f ? `${NOMBRES_MES[f.mes - 1]} ${f.anio}` : fecha;
}

/** "16–22 nov 2026" o "30 nov – 6 dic 2026" */
export function textoSemana(lunes: string): string {
  const domingo = sumarDias(lunes, 6);
  const a = leerFechaISO(lunes);
  const b = leerFechaISO(domingo);
  if (!a || !b) return lunes;
  if (a.mes === b.mes) return `${a.dia}–${b.dia} ${MESES_CORTOS[b.mes - 1]} ${b.anio}`;
  return `${a.dia} ${MESES_CORTOS[a.mes - 1]} – ${b.dia} ${MESES_CORTOS[b.mes - 1]} ${b.anio}`;
}

/** Texto relativo: "Hoy", "Mañana" o la fecha corta. */
export function textoDiaRelativo(fecha: string, hoy: string = hoyISO()): string {
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, 1)) return 'Mañana';
  if (fecha === sumarDias(hoy, -1)) return 'Ayer';
  return textoFechaCorta(fecha);
}
