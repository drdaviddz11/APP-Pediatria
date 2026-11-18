// Caja del consultorio: montos, formas de pago, resumen del día y exportación para la contabilidad.
// Los montos se guardan en CENTAVOS (números enteros) para que las sumas nunca tengan errores de redondeo.

export type FormaPago = 'efectivo' | 'tarjeta' | 'transferencia';

export const FORMAS_PAGO: { valor: FormaPago; texto: string }[] = [
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'tarjeta', texto: 'Tarjeta' },
  { valor: 'transferencia', texto: 'Transferencia' },
];

export function textoFormaPago(f: string): string {
  return FORMAS_PAGO.find((x) => x.valor === f)?.texto ?? f;
}

export function esFormaPago(f: string): f is FormaPago {
  return FORMAS_PAGO.some((x) => x.valor === f);
}

/** Conceptos frecuentes para "otros ingresos" (se puede escribir cualquier otro). */
export const CONCEPTOS = ['Consulta', 'Control', 'Vacuna', 'Procedimiento', 'Certificado', 'Otro'];

export const MONTO_MAXIMO_CENTAVOS = 100_000_000; // 1 000 000.00, para detectar errores de escritura

/**
 * Lee un monto escrito por la persona: "1250", "1,250.50", "L 1250", "1250.5".
 * Devuelve centavos, o null si no es un monto válido (vacío, negativo, más de 2 decimales, demasiado grande).
 */
export function leerMonto(texto: string): number | null {
  const limpio = texto.replace(/[Ll$\s]/g, '').replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const [enteros, dec = ''] = limpio.split('.');
  const centavos = Number(enteros) * 100 + Number(dec.padEnd(2, '0'));
  if (!Number.isSafeInteger(centavos) || centavos > MONTO_MAXIMO_CENTAVOS) return null;
  return centavos;
}

/** 125050 → "L 1,250.50" */
export function textoDinero(centavos: number, moneda = 'L'): string {
  const negativo = centavos < 0;
  const abs = Math.abs(Math.round(centavos));
  const enteros = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const dec = String(abs % 100).padStart(2, '0');
  return `${negativo ? '-' : ''}${moneda ? `${moneda} ` : ''}${enteros}.${dec}`;
}

/** Monto para mostrar en un campo de texto editable: 125050 → "1250.50"; 125000 → "1250". */
export function montoParaCampo(centavos: number): string {
  return centavos % 100 === 0 ? String(centavos / 100) : (centavos / 100).toFixed(2);
}

/** Día local "AAAA-MM-DD" de una fecha (zona horaria del equipo). */
export function diaLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Límites del día local en ISO UTC, para buscar consultas guardadas con toISOString(). */
export function limitesDia(dia: string): { desde: string; hasta: string } {
  const [a, m, d] = dia.split('-').map(Number);
  return { desde: new Date(a, m - 1, d).toISOString(), hasta: new Date(a, m - 1, d + 1).toISOString() };
}

export function sumarDiasADia(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number);
  return diaLocal(new Date(a, m - 1, d + n));
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "2026-11-17" → "martes 17 de noviembre de 2026" */
export function textoDia(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number);
  const f = new Date(a, m - 1, d);
  return `${DIAS[f.getDay()]} ${d} de ${MESES[m - 1]} de ${a}`;
}

/** "2026-11" → "noviembre de 2026" */
export function textoMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

export function sumarMesesAMes(mes: string, n: number): string {
  const [a, m] = mes.split('-').map(Number);
  const f = new Date(a, m - 1 + n, 1);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
}

export interface CobroResumible {
  montoCentavos: number;
  forma: string;
  anulado: boolean;
}

export interface Resumen {
  totalCentavos: number;
  cantidad: number;
  porForma: Record<FormaPago, { centavos: number; cantidad: number }>;
  anulados: number;
}

/** Totales del día (los cobros anulados no suman, pero se cuentan aparte). */
export function resumir(cobros: CobroResumible[]): Resumen {
  const porForma = Object.fromEntries(FORMAS_PAGO.map((f) => [f.valor, { centavos: 0, cantidad: 0 }])) as Resumen['porForma'];
  let total = 0;
  let cantidad = 0;
  let anulados = 0;
  for (const c of cobros) {
    if (c.anulado) {
      anulados++;
      continue;
    }
    total += c.montoCentavos;
    cantidad++;
    if (esFormaPago(c.forma)) {
      porForma[c.forma].centavos += c.montoCentavos;
      porForma[c.forma].cantidad++;
    }
  }
  return { totalCentavos: total, cantidad, porForma, anulados };
}

export interface FilaCsv {
  fecha: string; // ISO
  dia: string;
  paciente: string;
  concepto: string;
  montoCentavos: number;
  forma: string;
  anulado: boolean;
  motivoAnulacion: string;
  nota: string;
}

function celda(v: string): string {
  // Evita que una hoja de cálculo interprete el texto como fórmula y escapa comillas.
  const seguro = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r;]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** Archivo CSV (se abre en Excel, Numbers o Google Sheets) con los cobros, para el contador. */
export function csvCobros(filas: FilaCsv[]): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const lineas = [['Día', 'Hora', 'Paciente', 'Concepto', 'Forma de pago', 'Monto', 'Estado', 'Motivo de anulación', 'Nota'].join(',')];
  for (const f of filas) {
    const d = new Date(f.fecha);
    lineas.push(
      [
        f.dia,
        `${p(d.getHours())}:${p(d.getMinutes())}`,
        celda(f.paciente),
        celda(f.concepto),
        textoFormaPago(f.forma),
        (f.montoCentavos / 100).toFixed(2),
        f.anulado ? 'Anulado' : 'Válido',
        celda(f.motivoAnulacion),
        celda(f.nota),
      ].join(','),
    );
  }
  // BOM para que Excel reconozca los acentos.
  return '﻿' + lineas.join('\r\n') + '\r\n';
}
