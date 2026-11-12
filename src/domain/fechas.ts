// Utilidades de fechas y cálculo de edad.
// Se trabaja con fechas de calendario (sin horas) para evitar errores por zona horaria.

export interface FechaSimple {
  anio: number;
  mes: number; // 1-12
  dia: number; // 1-31
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function diasEnMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate();
}

function dos(n: number): string {
  return String(n).padStart(2, '0');
}

/** "AAAA-MM-DD" → FechaSimple, o null si el texto no es una fecha real. */
export function leerFechaISO(texto: string | null | undefined): FechaSimple | null {
  if (!texto) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto.trim());
  if (!m) return null;
  const f = { anio: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
  return esFechaValida(f) ? f : null;
}

/** "DD/MM/AAAA" (como lo escribe el usuario) → FechaSimple, o null si no es válida. */
export function leerFechaUsuario(texto: string): FechaSimple | null {
  const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const f = { anio: Number(m[3]), mes: Number(m[2]), dia: Number(m[1]) };
  return esFechaValida(f) ? f : null;
}

export function esFechaValida(f: FechaSimple): boolean {
  return (
    Number.isInteger(f.anio) &&
    f.anio >= 1900 &&
    f.anio <= 2200 &&
    f.mes >= 1 &&
    f.mes <= 12 &&
    f.dia >= 1 &&
    f.dia <= diasEnMes(f.anio, f.mes)
  );
}

export function aISO(f: FechaSimple): string {
  return `${f.anio}-${dos(f.mes)}-${dos(f.dia)}`;
}

/** FechaSimple → "DD/MM/AAAA" */
export function aTextoUsuario(f: FechaSimple): string {
  return `${dos(f.dia)}/${dos(f.mes)}/${f.anio}`;
}

/** "AAAA-MM-DD" → "DD/MM/AAAA" (o el texto original si no se puede leer). */
export function isoATextoUsuario(iso: string | null | undefined): string {
  const f = leerFechaISO(iso);
  return f ? aTextoUsuario(f) : iso ?? '';
}

/** "AAAA-MM-DD" → "12 nov 2026" */
export function isoATextoCorto(iso: string | null | undefined): string {
  const f = leerFechaISO(iso);
  return f ? `${f.dia} ${MESES_CORTOS[f.mes - 1]} ${f.anio}` : iso ?? '';
}

export function hoy(): FechaSimple {
  return deDate(new Date());
}

/** Fecha local (calendario del teléfono) de un objeto Date. */
export function deDate(d: Date): FechaSimple {
  return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
}

export function compararFechas(a: FechaSimple, b: FechaSimple): number {
  return a.anio - b.anio || a.mes - b.mes || a.dia - b.dia;
}

export interface Edad {
  anios: number;
  meses: number;
  dias: number;
  totalMeses: number; // meses cumplidos
  totalDias: number; // días transcurridos
}

function aDiaUTC(f: FechaSimple): number {
  return Date.UTC(f.anio, f.mes - 1, f.dia) / 86400000;
}

/**
 * Edad cronológica cumplida entre el nacimiento y una fecha de referencia.
 * Devuelve null si la fecha de referencia es anterior al nacimiento.
 */
export function calcularEdad(nacimiento: FechaSimple, referencia: FechaSimple): Edad | null {
  if (compararFechas(referencia, nacimiento) < 0) return null;

  // Meses cumplidos: el mayor número de meses que, sumados al nacimiento, no pasan de la referencia.
  // Si el día no existe en el mes destino (ej. 31 → febrero), se usa el último día de ese mes.
  let totalMeses = (referencia.anio - nacimiento.anio) * 12 + (referencia.mes - nacimiento.mes);
  if (compararFechas(sumarMeses(nacimiento, totalMeses), referencia) > 0) totalMeses -= 1;
  const cumpleMes = sumarMeses(nacimiento, totalMeses);

  return {
    anios: Math.floor(totalMeses / 12),
    meses: totalMeses % 12,
    dias: Math.round(aDiaUTC(referencia) - aDiaUTC(cumpleMes)),
    totalMeses,
    totalDias: Math.round(aDiaUTC(referencia) - aDiaUTC(nacimiento)),
  };
}

function sumarMeses(f: FechaSimple, meses: number): FechaSimple {
  const indice = f.anio * 12 + (f.mes - 1) + meses;
  const anio = Math.floor(indice / 12);
  const mes = (indice % 12) + 1;
  return { anio, mes, dia: Math.min(f.dia, diasEnMes(anio, mes)) };
}

/** Texto legible de la edad, con el detalle útil en pediatría según la etapa. */
export function textoEdad(e: Edad | null): string {
  if (!e) return '—';
  if (e.totalMeses < 1) return `${e.totalDias} ${e.totalDias === 1 ? 'día' : 'días'}`;
  if (e.anios < 2) {
    const m = `${e.totalMeses} ${e.totalMeses === 1 ? 'mes' : 'meses'}`;
    return e.dias > 0 ? `${m} ${e.dias} d` : m;
  }
  const a = `${e.anios} ${e.anios === 1 ? 'año' : 'años'}`;
  return e.meses > 0 ? `${a} ${e.meses} ${e.meses === 1 ? 'mes' : 'meses'}` : a;
}

export function edadDesdeISO(nacimientoISO: string, referencia: FechaSimple = hoy()): string {
  const n = leerFechaISO(nacimientoISO);
  return n ? textoEdad(calcularEdad(n, referencia)) : '—';
}

/**
 * Edad corregida para prematuros: edad cronológica menos las semanas que faltaron para 40.
 * Solo se calcula si nació antes de las 37 semanas y tiene menos de 24 meses cronológicos
 * (límite de uso habitual; el protocolo clínico definitivo lo decide el médico).
 * Devuelve el texto de la edad corregida o null si no aplica.
 */
export function textoEdadCorregida(
  nacimiento: FechaSimple,
  semanasGestacion: number | null,
  referencia: FechaSimple = hoy(),
): string | null {
  if (semanasGestacion == null || semanasGestacion >= 37) return null;
  const cronologica = calcularEdad(nacimiento, referencia);
  if (!cronologica || cronologica.totalMeses >= 24) return null;
  const diasPrematuro = (40 - semanasGestacion) * 7;
  const d = new Date(Date.UTC(nacimiento.anio, nacimiento.mes - 1, nacimiento.dia));
  d.setUTCDate(d.getUTCDate() + diasPrematuro);
  const nacimientoCorregido = { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
  const corregida = calcularEdad(nacimientoCorregido, referencia);
  return corregida ? textoEdad(corregida) : 'aún no cumple 40 semanas corregidas';
}

/** Fecha y hora ISO → "12 nov 2026, 09:30" en hora local. */
export function textoFechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const f = deDate(d);
  return `${f.dia} ${MESES_CORTOS[f.mes - 1]} ${f.anio}, ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}
