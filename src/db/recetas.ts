// Recetas médicas y medicamentos favoritos. Las pantallas solo usan estas funciones.

import type { SQLiteDatabase } from 'expo-sqlite';
import { LARGO_MAXIMO_INDICACION, limpiarIndicaciones } from '../receta/hoja';
import { ahoraISO, normalizar, nuevoId, registrarBitacora } from './util';

export const MAXIMO_INDICACIONES = 40;

export interface Receta {
  id: string;
  pacienteId: string;
  consultaId: string | null;
  fecha: string;
  indicaciones: string[];
}

interface FilaReceta {
  id: string;
  paciente_id: string;
  consulta_id: string | null;
  fecha: string;
  indicaciones: string;
}

function aReceta(f: FilaReceta): Receta {
  let indicaciones: string[] = [];
  try {
    const v = JSON.parse(f.indicaciones) as unknown;
    if (Array.isArray(v)) indicaciones = v.map(String);
  } catch {
    indicaciones = [];
  }
  return { id: f.id, pacienteId: f.paciente_id, consultaId: f.consulta_id, fecha: f.fecha, indicaciones };
}

export function validarIndicaciones(lista: string[]): string | null {
  const limpias = limpiarIndicaciones(lista);
  if (limpias.length === 0) return 'Escriba al menos una indicación.';
  if (limpias.length > MAXIMO_INDICACIONES) return `Una receta admite hasta ${MAXIMO_INDICACIONES} indicaciones.`;
  const larga = limpias.findIndex((t) => t.length > LARGO_MAXIMO_INDICACION);
  if (larga >= 0) return `La indicación ${larga + 1} es demasiado larga (máximo ${LARGO_MAXIMO_INDICACION} caracteres); divídala en dos.`;
  return null;
}

export async function crearReceta(
  db: SQLiteDatabase,
  r: { pacienteId: string; consultaId?: string | null; indicaciones: string[]; fecha?: Date },
): Promise<string> {
  const error = validarIndicaciones(r.indicaciones);
  if (error) throw new Error(error);
  const id = nuevoId();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO recetas (id, paciente_id, consulta_id, fecha, indicaciones, creado_en) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      r.pacienteId,
      r.consultaId ?? null,
      (r.fecha ?? new Date()).toISOString(),
      JSON.stringify(limpiarIndicaciones(r.indicaciones)),
      ahoraISO(),
    );
    await registrarBitacora(db, 'receta', id, 'crear');
  });
  return id;
}

export async function obtenerReceta(db: SQLiteDatabase, id: string): Promise<Receta | null> {
  const f = await db.getFirstAsync<FilaReceta>('SELECT * FROM recetas WHERE id = ?', id);
  return f ? aReceta(f) : null;
}

export async function recetasDePaciente(db: SQLiteDatabase, pacienteId: string, limite = 50): Promise<Receta[]> {
  const filas = await db.getAllAsync<FilaReceta>('SELECT * FROM recetas WHERE paciente_id = ? ORDER BY fecha DESC LIMIT ?', pacienteId, limite);
  return filas.map(aReceta);
}

export async function recetasDeConsulta(db: SQLiteDatabase, consultaId: string): Promise<Receta[]> {
  const filas = await db.getAllAsync<FilaReceta>('SELECT * FROM recetas WHERE consulta_id = ? ORDER BY fecha', consultaId);
  return filas.map(aReceta);
}

// ---------------------------------------------------------------------------
// Medicamentos favoritos
// ---------------------------------------------------------------------------

export interface Favorito {
  id: string;
  texto: string;
  usos: number;
}

/** Favoritos, los más usados primero. Con filtro, busca sin importar acentos ni mayúsculas. */
export async function listarFavoritos(db: SQLiteDatabase, filtro = ''): Promise<Favorito[]> {
  const filas = await db.getAllAsync<Favorito>('SELECT id, texto, usos FROM medicamentos_favoritos ORDER BY usos DESC, texto COLLATE NOCASE');
  const f = normalizar(filtro);
  return f ? filas.filter((x) => normalizar(x.texto).includes(f)) : filas;
}

function validarFavorito(texto: string): string {
  const t = limpiarIndicaciones([texto])[0] ?? '';
  if (!t) throw new Error('Escriba la indicación.');
  if (t.length > LARGO_MAXIMO_INDICACION) throw new Error('La indicación es demasiado larga.');
  return t;
}

/** Guarda una indicación como favorita. Si ya existe igual, devuelve la existente. */
export async function crearFavorito(db: SQLiteDatabase, texto: string): Promise<string> {
  const t = validarFavorito(texto);
  const igual = (await listarFavoritos(db)).find((x) => normalizar(x.texto) === normalizar(t));
  if (igual) return igual.id;
  const id = nuevoId();
  const ahora = ahoraISO();
  await db.runAsync('INSERT INTO medicamentos_favoritos (id, texto, usos, creado_en, actualizado_en) VALUES (?, ?, 0, ?, ?)', id, t, ahora, ahora);
  return id;
}

export async function actualizarFavorito(db: SQLiteDatabase, id: string, texto: string): Promise<void> {
  const t = validarFavorito(texto);
  await db.runAsync('UPDATE medicamentos_favoritos SET texto = ?, actualizado_en = ? WHERE id = ?', t, ahoraISO(), id);
}

export async function borrarFavorito(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM medicamentos_favoritos WHERE id = ?', id);
}

/** Cuenta un uso (los más usados aparecen primero). */
export async function usarFavorito(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE medicamentos_favoritos SET usos = usos + 1, actualizado_en = ? WHERE id = ?', ahoraISO(), id);
}
