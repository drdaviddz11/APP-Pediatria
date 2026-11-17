// Motor de sincronización entre equipos.
//
// Cómo funciona:
//  1. Cada cambio hecho en este equipo queda anotado en sync_pendientes (lo hacen los triggers de la base).
//  2. "Subir": se lee la fila actual, se cifra en el equipo y se envía al servidor como un registro nuevo.
//  3. "Bajar": se descargan los registros nuevos de los demás equipos, se descifran y se aplican.
//  4. Si la misma fila cambió en dos equipos, gana el cambio más reciente (fecha y hora con milisegundos).
//
// El servidor nunca puede leer los datos ni modificarlos: un registro alterado no se puede descifrar y se ignora.

import type { SQLiteDatabase } from 'expo-sqlite';
import { ClaveSync } from './llaves';
import type { RegistroNuevo, RegistroRemoto, Servidor } from './supabase';
import { CONFIGURACION_LOCAL, ordenTabla, TABLAS_SYNC, TablaSync, tablaSync } from './tablas';

type Valor = string | number | null;
type Fila = Record<string, Valor>;

/** Contenido de cada registro (antes de cifrarlo). */
export interface Carga {
  v: 1;
  /** Tabla */
  t: string;
  /** Llave de la fila: arreglo JSON de valores, por ejemplo ["id-del-paciente"]. */
  k: string;
  /** Momento del cambio (ISO con milisegundos). */
  m: string;
  /** Equipo donde se hizo el cambio. */
  d: string;
  /** Fila completa, o null si se borró. */
  f: Fila | null;
}

export interface ResultadoSync {
  subidos: number;
  bajados: number;
  aplicados: number;
  avisosNuevos: number;
}

/** Registros que se vuelven a leer en cada descarga, por si el servidor confirmó dos envíos casi simultáneos en otro orden. */
const SOLAPE = 50;
const LOTE_SUBIR = 100;
const LOTE_BAJAR = 500;
const INTENTOS_MAXIMOS = 5;
/** Cada cuánto se limpian en el servidor las versiones viejas (para no llenar el plan gratuito). */
const COMPACTAR_CADA = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Estado guardado en este equipo
// ---------------------------------------------------------------------------

export async function leerEstado<T>(db: SQLiteDatabase, clave: string): Promise<T | null> {
  const f = await db.getFirstAsync<{ valor: string }>('SELECT valor FROM sync_estado WHERE clave = ?', clave);
  if (!f) return null;
  try {
    return JSON.parse(f.valor) as T;
  } catch {
    return null;
  }
}

export async function guardarEstado(db: SQLiteDatabase, clave: string, valor: unknown): Promise<void> {
  await db.runAsync(
    'INSERT INTO sync_estado (clave, valor) VALUES (?, ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor',
    clave,
    JSON.stringify(valor),
  );
}

export async function sincronizacionActiva(db: SQLiteDatabase): Promise<boolean> {
  const f = await db.getFirstAsync<{ activo: number }>('SELECT activo FROM sync_control WHERE id = 1');
  return f?.activo === 1;
}

export async function contarPendientes(db: SQLiteDatabase): Promise<number> {
  const f = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_pendientes');
  return f?.n ?? 0;
}

export interface Aviso {
  id: number;
  momento: string;
  mensaje: string;
}

export async function leerAvisos(db: SQLiteDatabase): Promise<Aviso[]> {
  return db.getAllAsync<Aviso>('SELECT id, momento, mensaje FROM sync_avisos ORDER BY id DESC LIMIT 50');
}

export async function borrarAvisos(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM sync_avisos');
}

async function agregarAviso(db: SQLiteDatabase, mensaje: string): Promise<void> {
  await db.runAsync('INSERT INTO sync_avisos (momento, mensaje) VALUES (?, ?)', new Date().toISOString(), mensaje);
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Compara dos versiones: primero la hora, y si es la misma, el identificador del equipo (para que todos decidan igual). */
export function compararVersion(a: { m: string; d: string }, b: { m: string; d: string }): number {
  if (a.m !== b.m) return a.m < b.m ? -1 : 1;
  if (a.d !== b.d) return a.d < b.d ? -1 : 1;
  return 0;
}

function valoresLlave(t: TablaSync, k: string): Valor[] | null {
  try {
    const v = JSON.parse(k) as unknown;
    if (!Array.isArray(v) || v.length !== t.llave.length) return null;
    if (!v.every((x) => typeof x === 'string' || typeof x === 'number')) return null;
    return v as Valor[];
  } catch {
    return null;
  }
}

const dondeLlave = (t: TablaSync) => t.llave.map((c) => `"${c}" = ?`).join(' AND ');

const columnasCache = new WeakMap<object, Map<string, Set<string>>>();
async function columnas(db: SQLiteDatabase, tabla: string): Promise<Set<string>> {
  let porTabla = columnasCache.get(db as object);
  if (!porTabla) {
    porTabla = new Map();
    columnasCache.set(db as object, porTabla);
  }
  let c = porTabla.get(tabla);
  if (!c) {
    c = new Set((await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tabla})`)).map((x) => x.name));
    porTabla.set(tabla, c);
  }
  return c;
}

// ---------------------------------------------------------------------------
// Subir
// ---------------------------------------------------------------------------

async function leerFila(db: SQLiteDatabase, t: TablaSync, llave: Valor[]): Promise<Fila | null> {
  const fila = await db.getFirstAsync<Fila>(`SELECT * FROM ${t.nombre} WHERE ${dondeLlave(t)}`, ...llave);
  if (!fila) return null;
  const limpia: Fila = {};
  for (const [c, v] of Object.entries(fila)) if (!t.columnasLocales?.includes(c)) limpia[c] = v;
  return limpia;
}

async function subir(db: SQLiteDatabase, servidor: Servidor, clave: ClaveSync, dispositivo: string): Promise<number> {
  const pendientes = await db.getAllAsync<{ tabla: string; clave: string; momento: string }>(
    'SELECT tabla, clave, momento FROM sync_pendientes',
  );
  // Primero las tablas referenciadas (expediente antes que sus consultas), luego por hora.
  pendientes.sort((a, b) => ordenTabla(a.tabla) - ordenTabla(b.tabla) || (a.momento < b.momento ? -1 : a.momento > b.momento ? 1 : 0));

  let subidos = 0;
  for (let i = 0; i < pendientes.length; i += LOTE_SUBIR) {
    const lote = pendientes.slice(i, i + LOTE_SUBIR);
    const registros: RegistroNuevo[] = [];
    const enviados: typeof lote = [];
    for (const p of lote) {
      const t = tablaSync(p.tabla);
      const llave = t && valoresLlave(t, p.clave);
      if (!t || !llave) {
        await db.runAsync('DELETE FROM sync_pendientes WHERE tabla = ? AND clave = ?', p.tabla, p.clave);
        continue;
      }
      const carga: Carga = { v: 1, t: t.nombre, k: p.clave, m: p.momento, d: dispositivo, f: await leerFila(db, t, llave) };
      registros.push({ dispositivo, fila: clave.etiqueta(t.nombre, p.clave), momento: p.momento, datos: await clave.cifrar(JSON.stringify(carga)) });
      enviados.push(p);
    }
    await servidor.subir(registros);
    await db.withTransactionAsync(async () => {
      for (const p of enviados) {
        await db.runAsync(
          `INSERT INTO sync_versiones (tabla, clave, momento, dispositivo) VALUES (?, ?, ?, ?)
           ON CONFLICT (tabla, clave) DO UPDATE SET momento = excluded.momento, dispositivo = excluded.dispositivo
           WHERE excluded.momento > sync_versiones.momento
              OR (excluded.momento = sync_versiones.momento AND excluded.dispositivo > sync_versiones.dispositivo)`,
          p.tabla,
          p.clave,
          p.momento,
          dispositivo,
        );
        // Si la fila volvió a cambiar mientras se enviaba, queda pendiente para la próxima vez.
        await db.runAsync('DELETE FROM sync_pendientes WHERE tabla = ? AND clave = ? AND momento = ?', p.tabla, p.clave, p.momento);
      }
    });
    subidos += enviados.length;
  }
  return subidos;
}

// ---------------------------------------------------------------------------
// Bajar y aplicar
// ---------------------------------------------------------------------------

type Resultado = 'aplicado' | 'ignorado';

async function numeroLibre(db: SQLiteDatabase, base: string): Promise<string> {
  for (let n = 2; ; n++) {
    const candidato = `${base}-${n}`;
    const f = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM pacientes WHERE numero_expediente = ?', candidato);
    if ((f?.n ?? 0) === 0) return candidato;
  }
}

async function escribirFila(db: SQLiteDatabase, t: TablaSync, llave: Valor[], fila: Fila | null): Promise<void> {
  if (fila === null) {
    await db.runAsync(`DELETE FROM ${t.nombre} WHERE ${dondeLlave(t)}`, ...llave);
    return;
  }
  const existentes = await columnas(db, t.nombre);
  // Solo columnas que existen en esta versión de la app, y la llave tomada del registro.
  const datos: Fila = {};
  for (const [c, v] of Object.entries(fila)) if (existentes.has(c) && !t.columnasLocales?.includes(c)) datos[c] = v;
  t.llave.forEach((c, i) => (datos[c] = llave[i]));
  const nombres = Object.keys(datos);
  const lista = nombres.map((n) => `"${n}"`).join(', ');
  const signos = nombres.map(() => '?').join(', ');
  const valores = nombres.map((n) => datos[n]);
  if (t.inmutable) {
    await db.runAsync(`INSERT OR IGNORE INTO ${t.nombre} (${lista}) VALUES (${signos})`, ...valores);
    return;
  }
  const cambiar = nombres.filter((n) => !t.llave.includes(n));
  const accion = cambiar.length > 0 ? `DO UPDATE SET ${cambiar.map((n) => `"${n}" = excluded."${n}"`).join(', ')}` : 'DO NOTHING';
  await db.runAsync(
    `INSERT INTO ${t.nombre} (${lista}) VALUES (${signos}) ON CONFLICT (${t.llave.map((c) => `"${c}"`).join(', ')}) ${accion}`,
    ...valores,
  );
}

async function fijarAplicando(db: SQLiteDatabase, valor: 0 | 1): Promise<void> {
  await db.runAsync('UPDATE sync_control SET aplicando = ? WHERE id = 1', valor);
}

/**
 * Número de expediente repetido entre dos equipos (dos pacientes distintos con el mismo número).
 * Todos los equipos deciden igual: se le cambia el número al paciente con el identificador mayor.
 */
async function resolverExpedienteRepetido(db: SQLiteDatabase, fila: Fila): Promise<Fila> {
  const numero = String(fila.numero_expediente);
  const local = await db.getFirstAsync<{ id: string; nombres: string; apellidos: string }>(
    'SELECT id, nombres, apellidos FROM pacientes WHERE numero_expediente = ? AND id != ?',
    numero,
    fila.id,
  );
  if (!local) return fila;
  const nuevo = await numeroLibre(db, numero);
  if (local.id > String(fila.id)) {
    // Se cambia el del paciente de este equipo, como un cambio normal (se envía a los demás equipos).
    await fijarAplicando(db, 0);
    await db.runAsync('UPDATE pacientes SET numero_expediente = ?, actualizado_en = ? WHERE id = ?', nuevo, new Date().toISOString(), local.id);
    await fijarAplicando(db, 1);
    await agregarAviso(db, `El número de expediente ${numero} estaba repetido en dos equipos. El de ${local.nombres} ${local.apellidos} ahora es ${nuevo}.`);
    return fila;
  }
  await agregarAviso(db, `El número de expediente ${numero} estaba repetido en dos equipos. El de ${fila.nombres} ${fila.apellidos} ahora es ${nuevo}.`);
  return { ...fila, numero_expediente: nuevo };
}

async function avisarCitasEncimadas(db: SQLiteDatabase, idCita: string): Promise<void> {
  const choques = await db.getAllAsync<{ inicio: string; a: string; b: string }>(
    `SELECT x.inicio AS inicio,
            COALESCE(px.nombres || ' ' || px.apellidos, x.nombre_contacto) AS a,
            COALESCE(py.nombres || ' ' || py.apellidos, y.nombre_contacto) AS b
     FROM citas x JOIN citas y ON y.id != x.id
     LEFT JOIN pacientes px ON px.id = x.paciente_id
     LEFT JOIN pacientes py ON py.id = y.paciente_id
     WHERE x.id = ? AND x.estado NOT IN ('cancelada', 'no_asistio') AND y.estado NOT IN ('cancelada', 'no_asistio')
       AND x.inicio < y.fin AND x.fin > y.inicio`,
    idCita,
  );
  for (const c of choques) {
    const [fecha, hora] = c.inicio.split('T');
    const [anio, mes, dia] = fecha.split('-');
    await agregarAviso(db, `Citas encimadas el ${dia}/${mes}/${anio} a las ${hora}: ${c.a} y ${c.b} (se agendaron en equipos distintos). Reprograme una.`);
  }
  const bloqueada = await db.getFirstAsync<{ inicio: string }>(
    `SELECT x.inicio FROM citas x JOIN bloqueos b ON b.inicio < x.fin AND b.fin > x.inicio
     WHERE x.id = ? AND x.estado NOT IN ('cancelada', 'no_asistio')`,
    idCita,
  );
  if (bloqueada) await agregarAviso(db, `Hay una cita en un horario bloqueado (${bloqueada.inicio.replace('T', ' ')}). Revise la agenda.`);
}

/** Aplica un registro recibido. Debe llamarse dentro de una transacción. */
async function aplicarCarga(db: SQLiteDatabase, carga: Carga, dispositivo: string): Promise<Resultado> {
  const t = tablaSync(carga.t);
  const llave = t && valoresLlave(t, carga.k);
  if (!t || !llave || typeof carga.m !== 'string' || typeof carga.d !== 'string') return 'ignorado';
  if (t.nombre === 'configuracion' && CONFIGURACION_LOCAL.includes(String(llave[0]))) return 'ignorado';

  const version = await db.getFirstAsync<{ momento: string; dispositivo: string }>(
    'SELECT momento, dispositivo FROM sync_versiones WHERE tabla = ? AND clave = ?',
    t.nombre,
    carga.k,
  );
  if (version && compararVersion({ m: version.momento, d: version.dispositivo }, carga) >= 0) return 'ignorado';
  const pendiente = await db.getFirstAsync<{ momento: string }>('SELECT momento FROM sync_pendientes WHERE tabla = ? AND clave = ?', t.nombre, carga.k);
  if (pendiente) {
    // Un cambio local más reciente gana; si el que llega es más reciente, el local se descarta.
    if (compararVersion({ m: pendiente.momento, d: dispositivo }, carga) >= 0) return 'ignorado';
    await db.runAsync('DELETE FROM sync_pendientes WHERE tabla = ? AND clave = ?', t.nombre, carga.k);
  }

  let fila = carga.f;
  await fijarAplicando(db, 1);
  try {
    try {
      await escribirFila(db, t, llave, fila);
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      if (t.nombre === 'pacientes' && fila && /UNIQUE/i.test(mensaje) && /numero_expediente/.test(mensaje)) {
        fila = await resolverExpedienteRepetido(db, fila);
        await escribirFila(db, t, llave, fila);
      } else {
        throw e;
      }
    }
    await db.runAsync(
      `INSERT INTO sync_versiones (tabla, clave, momento, dispositivo) VALUES (?, ?, ?, ?)
       ON CONFLICT (tabla, clave) DO UPDATE SET momento = excluded.momento, dispositivo = excluded.dispositivo`,
      t.nombre,
      carga.k,
      carga.m,
      carga.d,
    );
    if (t.nombre === 'citas' && fila) await avisarCitasEncimadas(db, String(llave[0]));
  } finally {
    await fijarAplicando(db, 0);
  }
  return 'aplicado';
}

/** Aplica varios registros en una transacción; cada uno en su propio punto de guardado para que un error no frene a los demás. */
async function aplicarLote(
  db: SQLiteDatabase,
  items: { seq: number; carga: Carga; intentos: number }[],
  dispositivo: string,
): Promise<number> {
  let aplicados = 0;
  await db.withTransactionAsync(async () => {
    for (const it of items) {
      await db.execAsync('SAVEPOINT registro');
      try {
        if ((await aplicarCarga(db, it.carga, dispositivo)) === 'aplicado') aplicados++;
        await db.execAsync('RELEASE registro');
        await db.runAsync('DELETE FROM sync_por_aplicar WHERE seq = ?', it.seq);
      } catch (e) {
        await db.execAsync('ROLLBACK TO registro');
        await db.execAsync('RELEASE registro');
        const mensaje = e instanceof Error ? e.message : String(e);
        if (it.intentos >= INTENTOS_MAXIMOS) {
          await db.runAsync('DELETE FROM sync_por_aplicar WHERE seq = ?', it.seq);
          await agregarAviso(db, `No se pudo aplicar un cambio que llegó de otro equipo (${it.carga.t}): ${mensaje}`);
        } else {
          await db.runAsync(
            `INSERT INTO sync_por_aplicar (seq, carga, error, intentos) VALUES (?, ?, ?, ?)
             ON CONFLICT (seq) DO UPDATE SET error = excluded.error, intentos = excluded.intentos`,
            it.seq,
            JSON.stringify(it.carga),
            mensaje,
            it.intentos + 1,
          );
        }
      }
    }
  });
  return aplicados;
}

async function bajar(
  db: SQLiteDatabase,
  servidor: Servidor,
  clave: ClaveSync,
  dispositivo: string,
): Promise<{ bajados: number; aplicados: number }> {
  let aplicados = 0;
  // Primero, lo que quedó pendiente de aplicar la vez anterior.
  const atrasados = await db.getAllAsync<{ seq: number; carga: string; intentos: number }>('SELECT seq, carga, intentos FROM sync_por_aplicar ORDER BY seq');
  if (atrasados.length > 0) {
    aplicados += await aplicarLote(
      db,
      atrasados.map((a) => ({ seq: a.seq, carga: JSON.parse(a.carga) as Carga, intentos: a.intentos })),
      dispositivo,
    );
  }

  const enEspera = new Set((await db.getAllAsync<{ seq: number }>('SELECT seq FROM sync_por_aplicar')).map((f) => f.seq));
  let cursor = (await leerEstado<number>(db, 'cursor')) ?? 0;
  let desde = Math.max(0, cursor - SOLAPE);
  let bajados = 0;
  let ilegibles = 0;
  for (;;) {
    const lote: RegistroRemoto[] = await servidor.bajar(desde, LOTE_BAJAR);
    if (lote.length === 0) break;
    const items: { seq: number; carga: Carga; intentos: number }[] = [];
    for (const r of lote) {
      if (r.seq > cursor) bajados++;
      if (r.dispositivo === dispositivo || enEspera.has(r.seq)) continue; // Lo envió este equipo, o ya está en espera.
      try {
        const carga = JSON.parse(await clave.descifrar(r.datos)) as Carga;
        if (carga?.v === 1) items.push({ seq: r.seq, carga, intentos: 0 });
      } catch {
        if (r.seq > cursor) ilegibles++;
      }
    }
    if (items.length > 0) aplicados += await aplicarLote(db, items, dispositivo);
    const ultimo = lote[lote.length - 1].seq;
    if (ultimo > cursor) {
      cursor = ultimo;
      await guardarEstado(db, 'cursor', cursor);
    }
    if (lote.length < LOTE_BAJAR) break;
    desde = ultimo;
  }
  // Si llegó lo que faltaba (por ejemplo, el expediente de una consulta en espera), se reintenta enseguida.
  if (aplicados > 0) {
    const otraVez = await db.getAllAsync<{ seq: number; carga: string; intentos: number }>('SELECT seq, carga, intentos FROM sync_por_aplicar ORDER BY seq');
    if (otraVez.length > 0) {
      aplicados += await aplicarLote(
        db,
        otraVez.map((x) => ({ seq: x.seq, carga: JSON.parse(x.carga) as Carga, intentos: x.intentos })),
        dispositivo,
      );
    }
  }
  if (ilegibles > 0) {
    await agregarAviso(db, `Se ignoraron ${ilegibles} registros del servidor que no se pudieron descifrar (alterados o de otra contraseña).`);
  }
  return { bajados, aplicados };
}

// ---------------------------------------------------------------------------
// Operaciones públicas
// ---------------------------------------------------------------------------

const enCurso = new WeakMap<object, Promise<ResultadoSync>>();

/** Envía los cambios de este equipo y recibe los de los demás. Si ya hay una sincronización en curso, espera esa. */
export function sincronizar(db: SQLiteDatabase, servidor: Servidor, llave: string, dispositivo: string): Promise<ResultadoSync> {
  const actual = enCurso.get(db as object);
  if (actual) return actual;
  const promesa = (async () => {
    const clave = await ClaveSync.desde(llave);
    const avisosAntes = (await db.getFirstAsync<{ n: number }>('SELECT COALESCE(MAX(id), 0) AS n FROM sync_avisos'))?.n ?? 0;
    const subidos = await subir(db, servidor, clave, dispositivo);
    const { bajados, aplicados } = await bajar(db, servidor, clave, dispositivo);
    // Lo que cambió al resolver conflictos (por ejemplo, un número de expediente) se envía de una vez.
    const extra = (await contarPendientes(db)) > 0 ? await subir(db, servidor, clave, dispositivo) : 0;
    const avisosDespues = (await db.getFirstAsync<{ n: number }>('SELECT COALESCE(MAX(id), 0) AS n FROM sync_avisos'))?.n ?? 0;
    await guardarEstado(db, 'ultimo', new Date().toISOString());
    const compactado = await leerEstado<string>(db, 'compactado');
    if (servidor.compactar && (!compactado || Date.now() - Date.parse(compactado) > COMPACTAR_CADA)) {
      try {
        await servidor.compactar();
        await guardarEstado(db, 'compactado', new Date().toISOString());
      } catch {
        // No es urgente: se intentará en la próxima sincronización.
      }
    }
    return { subidos: subidos + extra, bajados, aplicados, avisosNuevos: avisosDespues - avisosAntes };
  })().finally(() => {
    enCurso.delete(db as object);
  });
  enCurso.set(db as object, promesa);
  return promesa;
}

/** ¿Este equipo tiene expedientes, consultas o citas? */
export async function hayDatosLocales(db: SQLiteDatabase): Promise<boolean> {
  const f = await db.getFirstAsync<{ n: number }>(
    'SELECT (SELECT COUNT(*) FROM pacientes) + (SELECT COUNT(*) FROM consultas) + (SELECT COUNT(*) FROM citas) AS n',
  );
  return (f?.n ?? 0) > 0;
}

/** Anota todas las filas de este equipo para enviarlas (al activar la sincronización con datos ya existentes). */
async function anotarTodo(db: SQLiteDatabase): Promise<void> {
  for (const t of TABLAS_SYNC) {
    const cols = await columnas(db, t.nombre);
    const fecha = (t.columnasFecha ?? []).filter((c) => cols.has(c)).map((c) => `"${c}"`);
    // Se usa la fecha del último cambio de cada fila: al combinar con otro equipo, gana la versión más reciente.
    const momento = fecha.length > 0 ? `COALESCE(${[...fecha, "'1970-01-01T00:00:00.000Z'"].join(', ')})` : "'1970-01-01T00:00:00.000Z'";
    const filtro =
      t.nombre === 'configuracion'
        ? ` WHERE clave NOT IN (${CONFIGURACION_LOCAL.map((c) => `'${c}'`).join(', ')})`
        : t.nombre === 'bitacora'
          ? ' WHERE uid IS NOT NULL'
          : '';
    await db.runAsync(
      `INSERT OR REPLACE INTO sync_pendientes (tabla, clave, momento)
       SELECT '${t.nombre}', json_array(${t.llave.map((c) => `"${c}"`).join(', ')}), ${momento} FROM ${t.nombre}${filtro}`,
    );
  }
}

/** Borra los datos de este equipo para recibir los del servidor (se conserva la fecha del último respaldo). */
async function vaciarDatosLocales(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    const candados = await db.getAllAsync<{ name: string; sql: string }>(
      "SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND sql IS NOT NULL",
    );
    for (const c of candados) await db.execAsync(`DROP TRIGGER "${c.name.replace(/"/g, '""')}"`);
    for (const t of [...TABLAS_SYNC].reverse()) {
      if (t.nombre === 'configuracion') {
        await db.runAsync(`DELETE FROM configuracion WHERE clave NOT IN (${CONFIGURACION_LOCAL.map(() => '?').join(', ')})`, ...CONFIGURACION_LOCAL);
      } else {
        await db.runAsync(`DELETE FROM ${t.nombre}`);
      }
    }
    for (const c of candados) await db.execAsync(c.sql);
  });
}

export type ModoActivacion =
  /** El servidor está vacío: se envían los datos de este equipo. */
  | 'subir'
  /** Se borran los datos de este equipo y se reciben los del servidor. */
  | 'reemplazar'
  /** Se envían los de este equipo y se reciben los del servidor; si una misma fila está en los dos, gana la más reciente. */
  | 'combinar';

export interface CuentaSync {
  url: string;
  clavePublica: string;
  correo: string;
  usuarioId: string;
  dispositivo: string;
  secretoAcceso: string;
  llave: string;
}

/** Activa la sincronización en este equipo. Después hay que llamar a sincronizar(). */
export async function activarSincronizacion(db: SQLiteDatabase, cuenta: CuentaSync, modo: ModoActivacion): Promise<void> {
  if (modo === 'reemplazar') await vaciarDatosLocales(db);
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM sync_pendientes');
    await db.runAsync('DELETE FROM sync_versiones');
    await db.runAsync('DELETE FROM sync_por_aplicar');
    await guardarEstado(db, 'cuenta', cuenta);
    await guardarEstado(db, 'cursor', 0);
    await db.runAsync("DELETE FROM sync_estado WHERE clave = 'ultimo'");
    if (modo !== 'reemplazar') await anotarTodo(db);
    await db.runAsync('UPDATE sync_control SET activo = 1, aplicando = 0 WHERE id = 1');
  });
}

/** Deja de sincronizar en este equipo. Los datos de este equipo y los del servidor no se borran. */
export async function desactivarSincronizacion(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE sync_control SET activo = 0, aplicando = 0 WHERE id = 1');
    for (const t of ['sync_pendientes', 'sync_versiones', 'sync_por_aplicar', 'sync_avisos']) await db.runAsync(`DELETE FROM ${t}`);
    // Se conserva solo la dirección del servidor, para no tener que escribirla otra vez.
    await db.runAsync("DELETE FROM sync_estado WHERE clave != 'servidor'");
  });
}
