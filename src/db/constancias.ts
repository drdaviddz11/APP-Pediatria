// Constancias médicas y la imagen de firma y sello del médico. Las pantallas solo usan estas funciones.
// La firma NO va en el código de la app (que es público): el médico la sube en la app y queda en sus datos,
// protegida igual que los expedientes (sincronización y respaldos cifrados).

import type { SQLiteDatabase } from 'expo-sqlite';
import { tamanoDiagnosticos, tamanoTexto } from '../constancia/hoja';
import { limpiarDiagnosticos, TipoConstancia, validarConstancia } from '../constancia/plantillas';
import { ahoraISO, nuevoId, registrarBitacora } from './util';

export interface Constancia {
  id: string;
  pacienteId: string;
  consultaId: string | null;
  tipo: TipoConstancia;
  fecha: string;
  texto: string;
  diagnosticos: string[];
}

interface FilaConstancia {
  id: string;
  paciente_id: string;
  consulta_id: string | null;
  tipo: string;
  fecha: string;
  texto: string;
  diagnosticos: string;
}

const TIPOS: TipoConstancia[] = ['atencion', 'reposo', 'buena_salud', 'libre'];

function aConstancia(f: FilaConstancia): Constancia {
  let diagnosticos: string[] = [];
  try {
    const v = JSON.parse(f.diagnosticos) as unknown;
    if (Array.isArray(v)) diagnosticos = v.map(String);
  } catch {
    diagnosticos = [];
  }
  const tipo = (TIPOS as string[]).includes(f.tipo) ? (f.tipo as TipoConstancia) : 'libre';
  return { id: f.id, pacienteId: f.paciente_id, consultaId: f.consulta_id, tipo, fecha: f.fecha, texto: f.texto, diagnosticos };
}

/** ¿Cabe todo en la hoja? (texto arriba sin tapar la firma; diagnósticos y firma abajo). */
export function errorDeEspacio(texto: string, diagnosticos: string[]): string | null {
  if (!tamanoTexto(texto).cabe) return 'El texto no cabe en la hoja; acórtelo un poco.';
  if (!tamanoDiagnosticos(limpiarDiagnosticos(diagnosticos)).cabe) return 'Los diagnósticos no caben en la hoja; acórtelos o use menos.';
  return null;
}

export async function crearConstancia(
  db: SQLiteDatabase,
  c: { pacienteId: string; consultaId?: string | null; tipo: TipoConstancia; texto: string; diagnosticos: string[]; fecha?: Date },
): Promise<string> {
  const error = validarConstancia(c.texto, c.diagnosticos);
  if (error) throw new Error(error);
  if (!TIPOS.includes(c.tipo)) throw new Error('Tipo de constancia no válido.');
  const error2 = errorDeEspacio(c.texto, c.diagnosticos);
  if (error2) throw new Error(error2);
  const id = nuevoId();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO constancias (id, paciente_id, consulta_id, tipo, fecha, texto, diagnosticos, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      c.pacienteId,
      c.consultaId ?? null,
      c.tipo,
      (c.fecha ?? new Date()).toISOString(),
      c.texto.replace(/\r/g, '').trim(),
      JSON.stringify(limpiarDiagnosticos(c.diagnosticos)),
      ahoraISO(),
    );
    await registrarBitacora(db, 'constancia', id, 'crear');
  });
  return id;
}

export async function obtenerConstancia(db: SQLiteDatabase, id: string): Promise<Constancia | null> {
  const f = await db.getFirstAsync<FilaConstancia>('SELECT * FROM constancias WHERE id = ?', id);
  return f ? aConstancia(f) : null;
}

export async function constanciasDePaciente(db: SQLiteDatabase, pacienteId: string, limite = 50): Promise<Constancia[]> {
  const filas = await db.getAllAsync<FilaConstancia>('SELECT * FROM constancias WHERE paciente_id = ? ORDER BY fecha DESC LIMIT ?', pacienteId, limite);
  return filas.map(aConstancia);
}

export async function constanciasDeConsulta(db: SQLiteDatabase, consultaId: string): Promise<Constancia[]> {
  const filas = await db.getAllAsync<FilaConstancia>('SELECT * FROM constancias WHERE consulta_id = ? ORDER BY fecha', consultaId);
  return filas.map(aConstancia);
}

// ---------------------------------------------------------------------------
// Firma y sello
// ---------------------------------------------------------------------------

const CLAVE_FIRMA = 'firma_sello';
/** Tamaño máximo de la imagen (como texto data:…;base64). Unos 1.5 MB de imagen. */
export const TAMANO_MAXIMO_FIRMA = 2_000_000;

export function validarImagenFirma(dataUri: string): string | null {
  if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(dataUri)) return 'La firma debe ser una imagen PNG o JPG.';
  if (dataUri.length > TAMANO_MAXIMO_FIRMA) return 'La imagen es muy pesada (máximo 1.5 MB). Use una foto más pequeña o un PNG.';
  return null;
}

export async function leerFirma(db: SQLiteDatabase): Promise<string | null> {
  const f = await db.getFirstAsync<{ valor: string }>('SELECT valor FROM configuracion WHERE clave = ?', CLAVE_FIRMA);
  if (!f) return null;
  try {
    const v = JSON.parse(f.valor) as { imagen?: unknown };
    return typeof v.imagen === 'string' && validarImagenFirma(v.imagen) === null ? v.imagen : null;
  } catch {
    return null;
  }
}

export async function guardarFirma(db: SQLiteDatabase, dataUri: string): Promise<void> {
  const error = validarImagenFirma(dataUri);
  if (error) throw new Error(error);
  await db.runAsync(
    'INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor',
    CLAVE_FIRMA,
    JSON.stringify({ imagen: dataUri, actualizado: ahoraISO() }),
  );
  await registrarBitacora(db, 'firma', CLAVE_FIRMA, 'modificar');
}

export async function quitarFirma(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM configuracion WHERE clave = ?', CLAVE_FIRMA);
  await registrarBitacora(db, 'firma', CLAVE_FIRMA, 'eliminar');
}
