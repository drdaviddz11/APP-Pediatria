// Clave de acceso y bloqueo automático: se guardan solo en ESTE equipo (tabla ajustes_locales:
// no se sincroniza ni entra en los respaldos). Nunca se guarda la clave, solo su huella.

import type { SQLiteDatabase } from 'expo-sqlite';
import { getRandomBytes } from 'expo-crypto';
import { claveCorrecta, crearHuella, esperaTrasFallos, HuellaClave, MINUTOS_PREDETERMINADOS } from '../seguridad/clave';
import { registrarBitacora } from './util';

const CLAVE = 'bloqueo';
const INTENTOS = 'bloqueo_intentos';

export interface AjustesBloqueo {
  /** null = la app no pide clave. */
  clave: HuellaClave | null;
  minutos: number;
  /** Usar Face ID / huella además de la clave (solo en la app propia del teléfono). */
  biometria: boolean;
}

interface Intentos {
  fallos: number;
  /** Momento (ms) desde el que se puede volver a intentar. */
  esperarHasta: number;
}

async function leer<T>(db: SQLiteDatabase, clave: string, predeterminado: T): Promise<T> {
  const f = await db.getFirstAsync<{ valor: string }>('SELECT valor FROM ajustes_locales WHERE clave = ?', clave);
  if (!f) return predeterminado;
  try {
    return { ...predeterminado, ...(JSON.parse(f.valor) as T) };
  } catch {
    return predeterminado;
  }
}

async function escribir(db: SQLiteDatabase, clave: string, valor: unknown): Promise<void> {
  await db.runAsync(
    'INSERT INTO ajustes_locales (clave, valor) VALUES (?, ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor',
    clave,
    JSON.stringify(valor),
  );
}

export function leerAjustesBloqueo(db: SQLiteDatabase): Promise<AjustesBloqueo> {
  return leer<AjustesBloqueo>(db, CLAVE, { clave: null, minutos: MINUTOS_PREDETERMINADOS, biometria: false });
}

export async function guardarClave(db: SQLiteDatabase, claveNueva: string): Promise<void> {
  const actual = await leerAjustesBloqueo(db);
  const huella = await crearHuella(claveNueva, getRandomBytes(16));
  await escribir(db, CLAVE, { ...actual, clave: huella });
  await escribir(db, INTENTOS, { fallos: 0, esperarHasta: 0 });
  await registrarBitacora(db, 'seguridad', 'clave', actual.clave ? 'modificar' : 'crear');
}

export async function quitarClave(db: SQLiteDatabase): Promise<void> {
  const actual = await leerAjustesBloqueo(db);
  await escribir(db, CLAVE, { ...actual, clave: null, biometria: false });
  await registrarBitacora(db, 'seguridad', 'clave', 'eliminar');
}

export async function guardarOpcionesBloqueo(db: SQLiteDatabase, cambios: { minutos?: number; biometria?: boolean }): Promise<void> {
  const actual = await leerAjustesBloqueo(db);
  await escribir(db, CLAVE, { ...actual, ...cambios });
}

export type ResultadoClave = { ok: true } | { ok: false; esperarMs: number; fallos: number };

/** Revisa la clave, cuenta los intentos fallidos (aunque se recargue la página) y aplica la espera. */
export async function comprobarClave(db: SQLiteDatabase, clave: string, ahora = Date.now()): Promise<ResultadoClave> {
  const ajustes = await leerAjustesBloqueo(db);
  if (!ajustes.clave) return { ok: true };
  const intentos = await leer<Intentos>(db, INTENTOS, { fallos: 0, esperarHasta: 0 });
  if (intentos.esperarHasta > ahora) return { ok: false, esperarMs: intentos.esperarHasta - ahora, fallos: intentos.fallos };
  if (await claveCorrecta(clave, ajustes.clave)) {
    if (intentos.fallos > 0) await escribir(db, INTENTOS, { fallos: 0, esperarHasta: 0 });
    return { ok: true };
  }
  const fallos = intentos.fallos + 1;
  const espera = esperaTrasFallos(fallos);
  await escribir(db, INTENTOS, { fallos, esperarHasta: ahora + espera });
  if (fallos === 5 || (fallos > 5 && fallos % 5 === 0)) await registrarBitacora(db, 'seguridad', 'intentos_fallidos', 'crear', { fallos });
  return { ok: false, esperarMs: espera, fallos };
}

/** Espera pendiente (ms) por intentos fallidos anteriores. */
export async function esperaPendiente(db: SQLiteDatabase, ahora = Date.now()): Promise<number> {
  const intentos = await leer<Intentos>(db, INTENTOS, { fallos: 0, esperarHasta: 0 });
  return Math.max(0, intentos.esperarHasta - ahora);
}
