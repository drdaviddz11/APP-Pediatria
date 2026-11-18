// Exportar todos los datos de la app y restaurarlos desde un respaldo.

import type { SQLiteDatabase } from 'expo-sqlite';
import type { ContenidoRespaldo, ResumenRespaldo } from '../respaldo/formato';
import { ahoraISO, registrarBitacora } from './util';

/** Tablas en orden de inserción (primero las que otras referencian). */
const TABLAS = [
  'pacientes',
  'historias_clinicas',
  'consultas',
  'notas_aclaratorias',
  'bitacora',
  'configuracion',
  'bloqueos',
  'citas',
  'mensajes_whatsapp',
  'controles_descartados',
  'cobros',
  'cierres',
  'recetas',
  'medicamentos_favoritos',
];

async function versionEsquema(db: SQLiteDatabase): Promise<number> {
  const f = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return f?.user_version ?? 0;
}

async function tablasExistentes(db: SQLiteDatabase): Promise<Set<string>> {
  const filas = await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'");
  return new Set(filas.map((f) => f.name));
}

async function contar(db: SQLiteDatabase, tabla: string): Promise<number> {
  const f = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabla}`);
  return f?.n ?? 0;
}

export async function resumenActual(db: SQLiteDatabase): Promise<ResumenRespaldo> {
  const [pacientes, consultas, citas] = await Promise.all([contar(db, 'pacientes'), contar(db, 'consultas'), contar(db, 'citas')]);
  return { pacientes, consultas, citas };
}

export async function exportarDatos(db: SQLiteDatabase): Promise<{ contenido: ContenidoRespaldo; resumen: ResumenRespaldo }> {
  const existentes = await tablasExistentes(db);
  const tablas: Record<string, Record<string, unknown>[]> = {};
  for (const t of TABLAS) {
    if (existentes.has(t)) tablas[t] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${t}`);
  }
  return { contenido: { esquema: await versionEsquema(db), tablas }, resumen: await resumenActual(db) };
}

function resumenDe(contenido: ContenidoRespaldo): ResumenRespaldo {
  return {
    pacientes: contenido.tablas.pacientes?.length ?? 0,
    consultas: contenido.tablas.consultas?.length ?? 0,
    citas: contenido.tablas.citas?.length ?? 0,
  };
}

/**
 * Reemplaza TODOS los datos de la app con los del respaldo, en una sola transacción:
 * si algo falla, no se cambia nada. Los candados (triggers) se quitan durante la carga y se
 * vuelven a crear al final; después se verifica la integridad antes de confirmar.
 */
export async function restaurarDatos(db: SQLiteDatabase, contenido: ContenidoRespaldo): Promise<ResumenRespaldo> {
  const esquemaActual = await versionEsquema(db);
  if (contenido.esquema > esquemaActual) {
    throw new Error('Este respaldo viene de una versión más nueva de la app. Actualice la app antes de restaurarlo.');
  }
  const existentes = await tablasExistentes(db);
  if (existentes.has('sync_control')) {
    const c = await db.getFirstAsync<{ activo: number }>('SELECT activo FROM sync_control WHERE id = 1');
    if (c?.activo === 1) {
      throw new Error(
        'La sincronización está activa en este equipo. Para restaurar un respaldo, primero desactívela en Sincronización (los datos de los demás equipos no se tocan).',
      );
    }
  }

  try {
    await cargar(db, contenido, existentes);
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    if (mensaje.includes('FOREIGN KEY')) throw new Error('El respaldo tiene referencias rotas entre tablas; no se restauró nada.');
    if (mensaje.includes('constraint')) throw new Error(`El respaldo tiene datos inválidos; no se restauró nada. (${mensaje})`);
    throw e;
  }
  return resumenDe(contenido);
}

async function cargar(db: SQLiteDatabase, contenido: ContenidoRespaldo, existentes: Set<string>): Promise<void> {
  await db.withTransactionAsync(async () => {
    const candados = await db.getAllAsync<{ name: string; sql: string }>(
      "SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND sql IS NOT NULL",
    );
    for (const c of candados) await db.execAsync(`DROP TRIGGER "${c.name.replace(/"/g, '""')}"`);

    for (const t of [...TABLAS].reverse()) {
      if (existentes.has(t)) await db.runAsync(`DELETE FROM ${t}`);
    }

    for (const t of TABLAS) {
      if (!existentes.has(t)) continue;
      const filas = contenido.tablas[t] ?? [];
      if (filas.length === 0) continue;
      const columnas = new Set(
        (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name),
      );
      for (const fila of filas) {
        // Solo columnas que existen en esta versión (los respaldos viejos usan los valores por defecto).
        const nombres = Object.keys(fila).filter((k) => columnas.has(k));
        if (nombres.length === 0) continue;
        const valores = nombres.map((k) => fila[k] as string | number | null);
        await db.runAsync(
          `INSERT INTO ${t} (${nombres.map((n) => `"${n}"`).join(', ')}) VALUES (${nombres.map(() => '?').join(', ')})`,
          ...valores,
        );
      }
    }

    for (const c of candados) await db.execAsync(c.sql);
    // Respaldos de versiones anteriores no traen el identificador común de la bitácora.
    const colsBitacora = await db.getAllAsync<{ name: string }>('PRAGMA table_info(bitacora)');
    if (colsBitacora.some((c) => c.name === 'uid')) {
      await db.runAsync('UPDATE bitacora SET uid = lower(hex(randomblob(16))) WHERE uid IS NULL');
    }

    // Verificaciones de integridad antes de confirmar.
    const huerfanos = await db.getAllAsync('PRAGMA foreign_key_check');
    if (huerfanos.length > 0) throw new Error('El respaldo tiene referencias rotas entre tablas; no se restauró nada.');
    const traslapes = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM citas x JOIN citas y ON x.id < y.id
       WHERE x.estado NOT IN ('cancelada', 'no_asistio') AND y.estado NOT IN ('cancelada', 'no_asistio')
         AND x.inicio < y.fin AND x.fin > y.inicio`,
    );
    if ((traslapes?.n ?? 0) > 0) throw new Error('El respaldo tiene citas encimadas; no se restauró nada.');

    await registrarBitacora(db, 'respaldo', 'restaurar', 'modificar', resumenDe(contenido));
  });
}

// ---------------------------------------------------------------------------
// Fecha del último respaldo
// ---------------------------------------------------------------------------

export interface InfoRespaldo {
  ultimo: string | null; // ISO
  resumen: ResumenRespaldo | null;
}

export async function leerInfoRespaldo(db: SQLiteDatabase): Promise<InfoRespaldo> {
  const f = await db.getFirstAsync<{ valor: string }>("SELECT valor FROM configuracion WHERE clave = 'respaldo'");
  if (!f) return { ultimo: null, resumen: null };
  try {
    return JSON.parse(f.valor) as InfoRespaldo;
  } catch {
    return { ultimo: null, resumen: null };
  }
}

export async function registrarRespaldoHecho(db: SQLiteDatabase, resumen: ResumenRespaldo): Promise<void> {
  const info: InfoRespaldo = { ultimo: ahoraISO(), resumen };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "INSERT INTO configuracion (clave, valor) VALUES ('respaldo', ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor",
      JSON.stringify(info),
    );
    await registrarBitacora(db, 'respaldo', 'crear', 'crear', resumen);
  });
}

/** Días desde el último respaldo (null si nunca se ha hecho). */
export function diasDesde(ultimoISO: string | null, ahora: Date = new Date()): number | null {
  if (!ultimoISO) return null;
  const t = Date.parse(ultimoISO);
  return Number.isNaN(t) ? null : Math.floor((ahora.getTime() - t) / 86400000);
}
