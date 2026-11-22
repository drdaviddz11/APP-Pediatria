// Caja: cobros, cierre diario y resumen mensual. Las pantallas solo usan estas funciones.

import type { SQLiteDatabase } from 'expo-sqlite';
import { csvCobros, diaLocal, esFormaPago, FormaPago, limitesDia, MONTO_MAXIMO_CENTAVOS, resumir, Resumen, sumarDiasADia } from '../caja/dinero';
import { ahoraISO, nuevoId, registrarBitacora } from './util';

export interface Cobro {
  id: string;
  fecha: string;
  dia: string;
  pacienteId: string | null;
  pacienteNombre: string | null;
  consultaId: string | null;
  concepto: string;
  montoCentavos: number;
  forma: FormaPago;
  nota: string;
  anulado: boolean;
  motivoAnulacion: string;
}

interface FilaCobro {
  id: string;
  fecha: string;
  dia: string;
  paciente_id: string | null;
  nombre: string | null;
  consulta_id: string | null;
  concepto: string;
  monto_centavos: number;
  forma: FormaPago;
  nota: string;
  anulado: number;
  motivo_anulacion: string;
}

const SELECT_COBRO = `
  SELECT c.id, c.fecha, c.dia, c.paciente_id, c.consulta_id, c.concepto, c.monto_centavos, c.forma, c.nota,
         c.anulado, c.motivo_anulacion,
         CASE WHEN p.id IS NULL THEN NULL ELSE p.nombres || ' ' || p.apellidos END AS nombre
  FROM cobros c LEFT JOIN pacientes p ON p.id = c.paciente_id`;

function aCobro(f: FilaCobro): Cobro {
  return {
    id: f.id,
    fecha: f.fecha,
    dia: f.dia,
    pacienteId: f.paciente_id,
    pacienteNombre: f.nombre,
    consultaId: f.consulta_id,
    concepto: f.concepto,
    montoCentavos: f.monto_centavos,
    forma: f.forma,
    nota: f.nota,
    anulado: f.anulado === 1,
    motivoAnulacion: f.motivo_anulacion,
  };
}

/** Traduce los errores de la base a mensajes claros. */
function mensajeCaja(e: unknown): Error {
  const m = e instanceof Error ? e.message : String(e);
  const i = m.indexOf('CERRADO:');
  if (i >= 0) return new Error(m.slice(i + 'CERRADO:'.length).trim());
  if (/no se borran/.test(m)) return new Error('Los cobros no se borran: anúlelos indicando el motivo.');
  return e instanceof Error ? e : new Error(m);
}

// ---------------------------------------------------------------------------
// Precios sugeridos
// ---------------------------------------------------------------------------

export interface AjustesCaja {
  moneda: string;
  precioPrimeraCentavos: number;
  precioControlCentavos: number;
}

export const AJUSTES_CAJA_INICIALES: AjustesCaja = { moneda: 'L', precioPrimeraCentavos: 0, precioControlCentavos: 0 };

export async function leerAjustesCaja(db: SQLiteDatabase): Promise<AjustesCaja> {
  const f = await db.getFirstAsync<{ valor: string }>("SELECT valor FROM configuracion WHERE clave = 'caja'");
  if (!f) return AJUSTES_CAJA_INICIALES;
  try {
    return { ...AJUSTES_CAJA_INICIALES, ...(JSON.parse(f.valor) as Partial<AjustesCaja>) };
  } catch {
    return AJUSTES_CAJA_INICIALES;
  }
}

export async function guardarAjustesCaja(db: SQLiteDatabase, a: AjustesCaja): Promise<void> {
  for (const v of [a.precioPrimeraCentavos, a.precioControlCentavos]) {
    if (!Number.isInteger(v) || v < 0 || v > MONTO_MAXIMO_CENTAVOS) throw new Error('Revise los precios.');
  }
  if (!a.moneda.trim() || a.moneda.trim().length > 5) throw new Error('Escriba el símbolo de la moneda (por ejemplo L).');
  await db.runAsync(
    "INSERT INTO configuracion (clave, valor) VALUES ('caja', ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor",
    JSON.stringify({ ...a, moneda: a.moneda.trim() }),
  );
}

/** Precio sugerido para la consulta que se está registrando: primera vez o control. */
export async function precioSugerido(db: SQLiteDatabase, pacienteId: string): Promise<{ concepto: string; centavos: number }> {
  const [ajustes, previas] = await Promise.all([
    leerAjustesCaja(db),
    db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM consultas WHERE paciente_id = ?', pacienteId),
  ]);
  return (previas?.n ?? 0) === 0
    ? { concepto: 'Consulta', centavos: ajustes.precioPrimeraCentavos }
    : { concepto: 'Control', centavos: ajustes.precioControlCentavos };
}

/** Precio sugerido para una consulta ya guardada (primera vez si no hubo consultas antes que ella). */
export async function precioParaConsulta(db: SQLiteDatabase, consultaId: string): Promise<{ concepto: string; centavos: number; pacienteId: string } | null> {
  const q = await db.getFirstAsync<{ paciente_id: string; fecha_hora: string }>('SELECT paciente_id, fecha_hora FROM consultas WHERE id = ?', consultaId);
  if (!q) return null;
  const [ajustes, previas] = await Promise.all([
    leerAjustesCaja(db),
    db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM consultas WHERE paciente_id = ? AND fecha_hora < ?', q.paciente_id, q.fecha_hora),
  ]);
  return (previas?.n ?? 0) === 0
    ? { concepto: 'Consulta', centavos: ajustes.precioPrimeraCentavos, pacienteId: q.paciente_id }
    : { concepto: 'Control', centavos: ajustes.precioControlCentavos, pacienteId: q.paciente_id };
}

// ---------------------------------------------------------------------------
// Cobros
// ---------------------------------------------------------------------------

export interface CobroEntrada {
  pacienteId?: string | null;
  consultaId?: string | null;
  concepto: string;
  montoCentavos: number;
  forma: string;
  nota?: string;
  /** Por defecto, ahora. */
  fecha?: Date;
}

export function validarCobro(c: CobroEntrada): string | null {
  if (!c.concepto.trim()) return 'Escriba el concepto del cobro.';
  if (!Number.isInteger(c.montoCentavos) || c.montoCentavos <= 0) return 'Escriba un monto mayor que cero.';
  if (c.montoCentavos > MONTO_MAXIMO_CENTAVOS) return 'El monto es demasiado grande; revíselo.';
  if (!esFormaPago(c.forma)) return 'Elija la forma de pago.';
  return null;
}

export async function crearCobro(db: SQLiteDatabase, c: CobroEntrada): Promise<string> {
  const error = validarCobro(c);
  if (error) throw new Error(error);
  if (c.consultaId) {
    const ya = await cobroDeConsulta(db, c.consultaId);
    if (ya) throw new Error('Esta consulta ya tiene un cobro registrado.');
  }
  const id = nuevoId();
  const fecha = c.fecha ?? new Date();
  const ahora = ahoraISO();
  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO cobros (id, fecha, dia, paciente_id, consulta_id, concepto, monto_centavos, forma, nota, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        fecha.toISOString(),
        diaLocal(fecha),
        c.pacienteId ?? null,
        c.consultaId ?? null,
        c.concepto.trim(),
        c.montoCentavos,
        c.forma,
        (c.nota ?? '').trim(),
        ahora,
        ahora,
      );
      await registrarBitacora(db, 'cobro', id, 'crear');
    });
  } catch (e) {
    throw mensajeCaja(e);
  }
  return id;
}

/** Anula un cobro (no se borra). Solo si el día no está cerrado. */
export async function anularCobro(db: SQLiteDatabase, id: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new Error('Escriba el motivo de la anulación.');
  const antes = await obtenerCobro(db, id);
  if (!antes) throw new Error('El cobro no existe.');
  if (antes.anulado) throw new Error('El cobro ya estaba anulado.');
  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'UPDATE cobros SET anulado = 1, motivo_anulacion = ?, actualizado_en = ? WHERE id = ?',
        motivo.trim(),
        ahoraISO(),
        id,
      );
      await registrarBitacora(db, 'cobro', id, 'modificar', antes);
    });
  } catch (e) {
    throw mensajeCaja(e);
  }
}

export async function obtenerCobro(db: SQLiteDatabase, id: string): Promise<Cobro | null> {
  const f = await db.getFirstAsync<FilaCobro>(`${SELECT_COBRO} WHERE c.id = ?`, id);
  return f ? aCobro(f) : null;
}

/** Cobro válido (no anulado) de una consulta, si existe. */
export async function cobroDeConsulta(db: SQLiteDatabase, consultaId: string): Promise<Cobro | null> {
  const f = await db.getFirstAsync<FilaCobro>(`${SELECT_COBRO} WHERE c.consulta_id = ? AND c.anulado = 0`, consultaId);
  return f ? aCobro(f) : null;
}

export async function cobrosDelDia(db: SQLiteDatabase, dia: string): Promise<Cobro[]> {
  const filas = await db.getAllAsync<FilaCobro>(`${SELECT_COBRO} WHERE c.dia = ? ORDER BY c.fecha`, dia);
  return filas.map(aCobro);
}

export interface ConsultaSinCobro {
  consultaId: string;
  pacienteId: string;
  pacienteNombre: string;
  fechaHora: string;
}

/** Consultas registradas ese día que todavía no tienen un cobro válido. */
export async function consultasSinCobro(db: SQLiteDatabase, dia: string): Promise<ConsultaSinCobro[]> {
  const { desde, hasta } = limitesDia(dia);
  return db.getAllAsync<ConsultaSinCobro>(
    `SELECT q.id AS consultaId, q.paciente_id AS pacienteId, p.nombres || ' ' || p.apellidos AS pacienteNombre, q.fecha_hora AS fechaHora
     FROM consultas q JOIN pacientes p ON p.id = q.paciente_id
     WHERE q.fecha_hora >= ? AND q.fecha_hora < ?
       AND NOT EXISTS (SELECT 1 FROM cobros c WHERE c.consulta_id = q.id AND c.anulado = 0)
     ORDER BY q.fecha_hora`,
    desde,
    hasta,
  );
}

// ---------------------------------------------------------------------------
// Cierre diario
// ---------------------------------------------------------------------------

export interface Cierre {
  dia: string;
  cerradoEn: string;
  totalCentavos: number;
  cantidad: number;
  resumen: Resumen;
  nota: string;
}

interface FilaCierre {
  dia: string;
  cerrado_en: string;
  total_centavos: number;
  cantidad: number;
  resumen: string;
  nota: string;
}

function aCierre(f: FilaCierre): Cierre {
  let resumen: Resumen;
  try {
    resumen = JSON.parse(f.resumen) as Resumen;
  } catch {
    resumen = resumir([]);
  }
  return { dia: f.dia, cerradoEn: f.cerrado_en, totalCentavos: f.total_centavos, cantidad: f.cantidad, resumen, nota: f.nota };
}

export async function leerCierre(db: SQLiteDatabase, dia: string): Promise<Cierre | null> {
  const f = await db.getFirstAsync<FilaCierre>('SELECT * FROM cierres WHERE dia = ?', dia);
  return f ? aCierre(f) : null;
}

/** Cierra el día: guarda el total por forma de pago y bloquea cambios en los cobros de ese día. */
export async function cerrarDia(db: SQLiteDatabase, dia: string, nota = ''): Promise<Cierre> {
  if (await leerCierre(db, dia)) throw new Error('Ese día ya está cerrado.');
  if (dia > diaLocal(new Date())) throw new Error('No se puede cerrar un día que todavía no llega.');
  const resumen = resumir(await cobrosDelDia(db, dia));
  const cerradoEn = ahoraISO();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO cierres (dia, cerrado_en, total_centavos, cantidad, resumen, nota) VALUES (?, ?, ?, ?, ?, ?)',
      dia,
      cerradoEn,
      resumen.totalCentavos,
      resumen.cantidad,
      JSON.stringify(resumen),
      nota.trim(),
    );
    await registrarBitacora(db, 'cierre', dia, 'crear');
  });
  return { dia, cerradoEn, totalCentavos: resumen.totalCentavos, cantidad: resumen.cantidad, resumen, nota: nota.trim() };
}

/** Reabre un día cerrado (queda registrado en la bitácora con el cierre anterior). */
export async function reabrirDia(db: SQLiteDatabase, dia: string): Promise<void> {
  const antes = await leerCierre(db, dia);
  if (!antes) throw new Error('Ese día no está cerrado.');
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM cierres WHERE dia = ?', dia);
    await registrarBitacora(db, 'cierre', dia, 'eliminar', antes);
  });
}

// ---------------------------------------------------------------------------
// Resumen mensual y exportación
// ---------------------------------------------------------------------------

export interface DiaDelMes {
  dia: string;
  totalCentavos: number;
  cantidad: number;
  cerrado: boolean;
}

export interface ResumenMes {
  mes: string;
  resumen: Resumen;
  dias: DiaDelMes[];
}

/** mes = "AAAA-MM" */
export async function resumenDelMes(db: SQLiteDatabase, mes: string): Promise<ResumenMes> {
  const cobros = (await db.getAllAsync<FilaCobro>(`${SELECT_COBRO} WHERE c.dia LIKE ? ORDER BY c.fecha`, `${mes}-%`)).map(aCobro);
  const cierres = new Set(
    (await db.getAllAsync<{ dia: string }>('SELECT dia FROM cierres WHERE dia LIKE ?', `${mes}-%`)).map((c) => c.dia),
  );
  const porDia = new Map<string, Cobro[]>();
  for (const c of cobros) porDia.set(c.dia, [...(porDia.get(c.dia) ?? []), c]);
  for (const d of cierres) if (!porDia.has(d)) porDia.set(d, []);
  const dias = [...porDia.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([dia, lista]) => {
      const r = resumir(lista);
      return { dia, totalCentavos: r.totalCentavos, cantidad: r.cantidad, cerrado: cierres.has(dia) };
    });
  return { mes, resumen: resumir(cobros), dias };
}

/** CSV con todos los cobros del mes (incluye los anulados, marcados). */
/**
 * CSV del mes para la contabilidad. Por privacidad, sin nombres de pacientes salvo que se pidan
 * (el archivo no lleva contraseña).
 */
export async function exportarMesCsv(db: SQLiteDatabase, mes: string, opciones: { conNombres?: boolean } = {}): Promise<string> {
  const cobros = (await db.getAllAsync<FilaCobro>(`${SELECT_COBRO} WHERE c.dia LIKE ? ORDER BY c.fecha`, `${mes}-%`)).map(aCobro);
  return csvCobros(
    cobros.map((c) => ({
      fecha: c.fecha,
      dia: c.dia,
      paciente: opciones.conNombres ? c.pacienteNombre ?? '' : '',
      concepto: c.concepto,
      montoCentavos: c.montoCentavos,
      forma: c.forma,
      anulado: c.anulado,
      motivoAnulacion: c.motivoAnulacion,
      nota: c.nota,
    })),
  );
}

/** Días anteriores a hoy (últimos 60) con cobros válidos que no se cerraron. */
export async function diasSinCerrar(db: SQLiteDatabase): Promise<string[]> {
  const hoy = diaLocal(new Date());
  const desde = sumarDiasADia(hoy, -60);
  const filas = await db.getAllAsync<{ dia: string }>(
    `SELECT DISTINCT c.dia FROM cobros c
     WHERE c.anulado = 0 AND c.dia < ? AND c.dia >= ? AND NOT EXISTS (SELECT 1 FROM cierres x WHERE x.dia = c.dia)
     ORDER BY c.dia`,
    hoy,
    desde,
  );
  return filas.map((f) => f.dia);
}

/** Total cobrado hoy (para el panel principal). */
export async function totalDeHoy(db: SQLiteDatabase): Promise<{ totalCentavos: number; cantidad: number }> {
  const f = await db.getFirstAsync<{ total: number | null; n: number }>(
    'SELECT SUM(monto_centavos) AS total, COUNT(*) AS n FROM cobros WHERE dia = ? AND anulado = 0',
    diaLocal(new Date()),
  );
  return { totalCentavos: f?.total ?? 0, cantidad: f?.n ?? 0 };
}
