// Lo que usan las pantallas: activar con correo y contraseña, sincronizar ahora, leer el estado.

import type { SQLiteDatabase } from 'expo-sqlite';
import { nuevoId } from '../db/util';
import { emitir } from './eventos';
import { derivarSecretos, normalizarCorreo } from './llaves';
import {
  activarSincronizacion,
  contarPendientes,
  CuentaSync,
  guardarEstado,
  hayDatosLocales,
  leerEstado,
  ModoActivacion,
  ResultadoSync,
  sincronizacionActiva,
  sincronizar,
} from './motor';
import { ConfigServidor, ErrorSync, iniciarSesion, registrarCuenta, Sesion, ServidorSupabase } from './supabase';

/** Valores por defecto desde el archivo .env de la Mac (opcional); si no, se escriben en la pantalla. */
export function servidorPorDefecto(): ConfigServidor {
  return {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    clavePublica: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '',
  };
}

export async function leerServidorGuardado(db: SQLiteDatabase): Promise<ConfigServidor> {
  return (await leerEstado<ConfigServidor>(db, 'servidor')) ?? servidorPorDefecto();
}

export interface EstadoSync {
  activo: boolean;
  correo: string | null;
  pendientes: number;
  /** ISO de la última sincronización completa. */
  ultimo: string | null;
  /** Mensaje del último error (null si la última vez salió bien). */
  error: string | null;
  tipoError: ErrorSync['tipo'] | null;
  avisos: number;
  sincronizando: boolean;
}

let sincronizando = false;

export async function leerEstadoSync(db: SQLiteDatabase): Promise<EstadoSync> {
  const activo = await sincronizacionActiva(db);
  const cuenta = activo ? await leerEstado<CuentaSync>(db, 'cuenta') : null;
  const error = await leerEstado<{ mensaje: string; tipo: ErrorSync['tipo'] }>(db, 'error');
  const avisos = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_avisos');
  return {
    activo,
    correo: cuenta?.correo ?? null,
    pendientes: activo ? await contarPendientes(db) : 0,
    ultimo: await leerEstado<string>(db, 'ultimo'),
    error: activo ? (error?.mensaje ?? null) : null,
    tipoError: activo ? (error?.tipo ?? null) : null,
    avisos: avisos?.n ?? 0,
    sincronizando,
  };
}

async function servidorDe(db: SQLiteDatabase, cuenta: CuentaSync): Promise<ServidorSupabase> {
  const cfg = { url: cuenta.url, clavePublica: cuenta.clavePublica };
  let sesion = await leerEstado<Sesion>(db, 'sesion');
  if (!sesion) {
    sesion = await iniciarSesion(cfg, cuenta.correo, cuenta.secretoAcceso);
    await guardarEstado(db, 'sesion', sesion);
  }
  return new ServidorSupabase(cfg, sesion, { correo: cuenta.correo, secretoAcceso: cuenta.secretoAcceso }, (s) => guardarEstado(db, 'sesion', s));
}

/** Sincroniza ahora. Devuelve null si la sincronización no está activa en este equipo. Nunca lanza errores: los guarda en el estado. */
export async function sincronizarAhora(db: SQLiteDatabase): Promise<ResultadoSync | null> {
  if (!(await sincronizacionActiva(db))) return null;
  const cuenta = await leerEstado<CuentaSync>(db, 'cuenta');
  if (!cuenta) return null;
  sincronizando = true;
  emitir('estado');
  try {
    const servidor = await servidorDe(db, cuenta);
    const r = await sincronizar(db, servidor, cuenta.llave, cuenta.dispositivo);
    await db.runAsync("DELETE FROM sync_estado WHERE clave = 'error'");
    if (r.aplicados > 0) emitir('datos');
    return r;
  } catch (e) {
    const error = e instanceof ErrorSync ? { mensaje: e.message, tipo: e.tipo } : { mensaje: e instanceof Error ? e.message : String(e), tipo: 'otro' };
    await guardarEstado(db, 'error', error);
    return null;
  } finally {
    sincronizando = false;
    emitir('estado');
  }
}

export interface CuentaPreparada {
  cuenta: CuentaSync;
  sesion: Sesion;
  servidorTieneDatos: boolean;
  equipoTieneDatos: boolean;
}

/**
 * Crea la cuenta o entra a una existente. No cambia nada en este equipo todavía.
 * Devuelve null si Supabase pide confirmar el correo antes de entrar.
 */
export async function prepararCuenta(
  db: SQLiteDatabase,
  datos: { servidor: ConfigServidor; correo: string; contrasena: string; crear: boolean },
  alProgreso?: (f: number) => void,
): Promise<CuentaPreparada | null> {
  const servidor = { url: datos.servidor.url.trim().replace(/\/+$/, ''), clavePublica: datos.servidor.clavePublica.trim() };
  await guardarEstado(db, 'servidor', servidor);
  const correo = normalizarCorreo(datos.correo);
  const secretos = await derivarSecretos(correo, datos.contrasena, alProgreso);
  let sesion: Sesion | null;
  if (datos.crear) {
    sesion = await registrarCuenta(servidor, correo, secretos.secretoAcceso);
    if (!sesion) return null;
  } else {
    sesion = await iniciarSesion(servidor, correo, secretos.secretoAcceso);
  }
  const cuenta: CuentaSync = {
    ...servidor,
    correo,
    usuarioId: sesion.usuarioId,
    dispositivo: nuevoId(),
    secretoAcceso: secretos.secretoAcceso,
    llave: secretos.llave,
  };
  const remoto = new ServidorSupabase(servidor, sesion, { correo, secretoAcceso: secretos.secretoAcceso }, async (s) => {
    sesion = s;
  });
  const servidorTieneDatos = (await remoto.bajar(0, 1)).length > 0;
  return { cuenta, sesion, servidorTieneDatos, equipoTieneDatos: await hayDatosLocales(db) };
}

/** Modo que no necesita preguntar al médico, o null si hay datos en los dos lados. */
export function modoAutomatico(p: CuentaPreparada): ModoActivacion | null {
  if (!p.servidorTieneDatos) return 'subir';
  if (!p.equipoTieneDatos) return 'reemplazar';
  return null;
}

export async function activarYSincronizar(db: SQLiteDatabase, p: CuentaPreparada, modo: ModoActivacion): Promise<ResultadoSync | null> {
  await activarSincronizacion(db, p.cuenta, modo);
  await guardarEstado(db, 'sesion', p.sesion);
  emitir('estado');
  const r = await sincronizarAhora(db);
  if (modo === 'reemplazar') emitir('datos');
  return r;
}
