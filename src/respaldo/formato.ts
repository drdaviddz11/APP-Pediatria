// Formato del archivo de respaldo (.pediacontrol).
// Es un JSON con un encabezado legible (fecha, conteos) y los datos cifrados:
//   - Llave: PBKDF2-HMAC-SHA256 de la contraseña con una sal aleatoria de 16 bytes.
//   - Cifrado: AES-256-GCM (autenticado: detecta contraseña incorrecta o archivo alterado).

export const FORMATO = 'pediacontrol-respaldo';
export const VERSION_FORMATO = 1;
export const EXTENSION = 'pediacontrol';
/** Iteraciones de PBKDF2 para respaldos nuevos (se guardan en el archivo). */
export const ITERACIONES = 310000;
export const LONGITUD_MINIMA_CONTRASENA = 8;

export interface ResumenRespaldo {
  pacientes: number;
  consultas: number;
  citas: number;
}

export interface ArchivoRespaldo {
  formato: typeof FORMATO;
  version: number;
  creado: string; // ISO
  esquema: number; // versión de la base de datos
  resumen: ResumenRespaldo;
  kdf: { algoritmo: 'PBKDF2-SHA256'; iteraciones: number; sal: string /* base64 */ };
  cifrado: { algoritmo: 'AES-256-GCM'; datos: string /* base64: IV (12) + texto cifrado + etiqueta (16) */ };
}

/** Contenido descifrado: todas las tablas con sus filas. */
export interface ContenidoRespaldo {
  esquema: number;
  tablas: Record<string, Record<string, unknown>[]>;
}

/** Lee y valida el encabezado de un archivo de respaldo. Lanza un error claro si no es válido. */
export function leerArchivo(texto: string): ArchivoRespaldo {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new Error('El archivo no es un respaldo de PediaControl.');
  }
  const a = datos as Partial<ArchivoRespaldo>;
  if (a?.formato !== FORMATO) throw new Error('El archivo no es un respaldo de PediaControl.');
  if (typeof a.version !== 'number' || a.version > VERSION_FORMATO) {
    throw new Error('Este respaldo se hizo con una versión más nueva de la app. Actualice la app para abrirlo.');
  }
  if (
    a.kdf?.algoritmo !== 'PBKDF2-SHA256' ||
    !Number.isInteger(a.kdf.iteraciones) ||
    a.kdf.iteraciones < 1 ||
    typeof a.kdf.sal !== 'string' ||
    a.cifrado?.algoritmo !== 'AES-256-GCM' ||
    typeof a.cifrado.datos !== 'string' ||
    typeof a.esquema !== 'number' ||
    typeof a.creado !== 'string'
  ) {
    throw new Error('El archivo de respaldo está incompleto o dañado.');
  }
  return a as ArchivoRespaldo;
}

/** "PediaControl_2026-11-16_1430.pediacontrol" */
export function nombreArchivo(fecha: Date): string {
  const d = (n: number) => String(n).padStart(2, '0');
  return `PediaControl_${fecha.getFullYear()}-${d(fecha.getMonth() + 1)}-${d(fecha.getDate())}_${d(fecha.getHours())}${d(
    fecha.getMinutes(),
  )}.${EXTENSION}`;
}

export function validarContrasena(contrasena: string, confirmacion: string): string | null {
  if (contrasena.length < LONGITUD_MINIMA_CONTRASENA) {
    return `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`;
  }
  if (contrasena !== confirmacion) return 'Las contraseñas no coinciden.';
  return null;
}
