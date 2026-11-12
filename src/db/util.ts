import type { SQLiteDatabase } from 'expo-sqlite';

/** Identificador único (UUID v4) generado en el teléfono. */
export function nuevoId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function ahoraISO(): string {
  return new Date().toISOString();
}

const ACENTOS: Record<string, string> = {
  á: 'a', à: 'a', ä: 'a', â: 'a',
  é: 'e', è: 'e', ë: 'e', ê: 'e',
  í: 'i', ì: 'i', ï: 'i', î: 'i',
  ó: 'o', ò: 'o', ö: 'o', ô: 'o',
  ú: 'u', ù: 'u', ü: 'u', û: 'u',
  ñ: 'n', ç: 'c',
};

/** Minúsculas y sin acentos, para que "Pérez" se encuentre escribiendo "perez". */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/[áàäâéèëêíìïîóòöôúùüûñç]/g, (c) => ACENTOS[c] ?? c)
    .replace(/\s+/g, ' ')
    .trim();
}

export function aBool(v: unknown): boolean {
  return v === 1 || v === true;
}

/** Registra en la bitácora una creación o modificación. */
export async function registrarBitacora(
  db: SQLiteDatabase,
  entidad: string,
  entidadId: string,
  accion: 'crear' | 'modificar' | 'eliminar',
  datosAnteriores?: unknown,
): Promise<void> {
  await db.runAsync(
    'INSERT INTO bitacora (fecha, entidad, entidad_id, accion, datos_anteriores) VALUES (?, ?, ?, ?, ?)',
    ahoraISO(),
    entidad,
    entidadId,
    accion,
    datosAnteriores === undefined ? null : JSON.stringify(datosAnteriores),
  );
}
