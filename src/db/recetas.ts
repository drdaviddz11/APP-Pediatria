// Recetas médicas y medicamentos favoritos. Las pantallas solo usan estas funciones.

import type { SQLiteDatabase } from 'expo-sqlite';
import { LARGO_MAXIMO_INDICACION, limpiarIndicaciones } from '../receta/hoja';
import { ahoraISO, normalizar, nuevoId, registrarBitacora } from './util';

export const MAXIMO_INDICACIONES = 40;
export const PESO_MINIMO = 0.3;
export const PESO_MAXIMO = 250;

/** Peso sugerido para la receta: el de la consulta, o el último registrado del paciente. */
export async function pesoParaReceta(
  db: SQLiteDatabase,
  pacienteId: string,
  consultaId?: string | null,
): Promise<{ pesoKg: number; fecha: string } | null> {
  const f = consultaId
    ? await db.getFirstAsync<{ peso_kg: number | null; fecha_hora: string }>('SELECT peso_kg, fecha_hora FROM consultas WHERE id = ?', consultaId)
    : null;
  if (f?.peso_kg != null) return { pesoKg: f.peso_kg, fecha: f.fecha_hora };
  const u = await db.getFirstAsync<{ peso_kg: number; fecha_hora: string }>(
    'SELECT peso_kg, fecha_hora FROM consultas WHERE paciente_id = ? AND peso_kg IS NOT NULL ORDER BY fecha_hora DESC LIMIT 1',
    pacienteId,
  );
  return u ? { pesoKg: u.peso_kg, fecha: u.fecha_hora } : null;
}

export interface Receta {
  id: string;
  pacienteId: string;
  consultaId: string | null;
  fecha: string;
  indicaciones: string[];
  pesoKg: number | null;
}

interface FilaReceta {
  id: string;
  paciente_id: string;
  consulta_id: string | null;
  fecha: string;
  indicaciones: string;
  peso_kg?: number | null;
}

function aReceta(f: FilaReceta): Receta {
  let indicaciones: string[] = [];
  try {
    const v = JSON.parse(f.indicaciones) as unknown;
    if (Array.isArray(v)) indicaciones = v.map(String);
  } catch {
    indicaciones = [];
  }
  return { id: f.id, pacienteId: f.paciente_id, consultaId: f.consulta_id, fecha: f.fecha, indicaciones, pesoKg: f.peso_kg ?? null };
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
  r: { pacienteId: string; consultaId?: string | null; indicaciones: string[]; fecha?: Date; pesoKg?: number | null },
): Promise<string> {
  const error = validarIndicaciones(r.indicaciones);
  if (error) throw new Error(error);
  const peso = r.pesoKg ?? null;
  if (peso !== null && !(peso >= PESO_MINIMO && peso <= PESO_MAXIMO)) throw new Error(`Revise el peso (entre ${PESO_MINIMO} y ${PESO_MAXIMO} kg).`);
  const id = nuevoId();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO recetas (id, paciente_id, consulta_id, fecha, indicaciones, creado_en, peso_kg) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      r.pacienteId,
      r.consultaId ?? null,
      (r.fecha ?? new Date()).toISOString(),
      JSON.stringify(limpiarIndicaciones(r.indicaciones)),
      ahoraISO(),
      peso,
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

/** Indicaciones de la receta que todavía no están en favoritos (para ofrecer guardarlas). */
export function indicacionesSinFavorito(indicaciones: string[], favoritos: { texto: string }[]): string[] {
  const ya = new Set(favoritos.map((f) => normalizar(f.texto)));
  const vistas = new Set<string>();
  return limpiarIndicaciones(indicaciones).filter((t) => {
    const n = normalizar(t);
    if (!n || ya.has(n) || vistas.has(n) || t.length > LARGO_MAXIMO_INDICACION) return false;
    vistas.add(n);
    return true;
  });
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
