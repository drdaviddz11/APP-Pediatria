// Clave de acceso de la app: reglas, huella de la clave (nunca se guarda la clave) y esperas tras intentos fallidos.
// Protege contra quien tome el teléfono o la computadora con la app abierta. La clave es de cada equipo.

import { base64Codificar, base64Decodificar, utf8Codificar } from '../respaldo/codificacion';
import { pbkdf2Sha256 } from '../respaldo/pbkdf2';

export const LARGO_MINIMO_CLAVE = 4;
export const LARGO_MAXIMO_CLAVE = 8;
/** Iteraciones de PBKDF2: menos de 1 segundo en el teléfono. */
export const ITERACIONES_CLAVE = 120_000;

/** Minutos sin usar la app antes de bloquearse sola. */
export const OPCIONES_MINUTOS = [1, 2, 5, 10, 15, 30];
export const MINUTOS_PREDETERMINADOS = 5;

export interface HuellaClave {
  sal: string; // base64
  huella: string; // base64
  iteraciones: number;
}

const CLAVES_OBVIAS = new Set(['0000', '1111', '1234', '4321', '000000', '111111', '123456', '654321', '12345678']);

/** Mensaje de error, o null si la clave sirve. Solo números (se escribe rápido en el teclado del teléfono). */
export function validarClaveNueva(clave: string, confirmacion: string): string | null {
  if (!/^\d+$/.test(clave)) return 'La clave debe tener solo números.';
  if (clave.length < LARGO_MINIMO_CLAVE || clave.length > LARGO_MAXIMO_CLAVE)
    return `La clave debe tener de ${LARGO_MINIMO_CLAVE} a ${LARGO_MAXIMO_CLAVE} números.`;
  if (CLAVES_OBVIAS.has(clave) || /^(\d)\1+$/.test(clave)) return 'Esa clave es muy fácil de adivinar. Elija otra.';
  if (clave !== confirmacion) return 'Las dos claves no coinciden.';
  return null;
}

export async function crearHuella(clave: string, sal: Uint8Array, iteraciones = ITERACIONES_CLAVE): Promise<HuellaClave> {
  const huella = await pbkdf2Sha256(utf8Codificar(clave), sal, iteraciones);
  return { sal: base64Codificar(sal), huella: base64Codificar(huella), iteraciones };
}

/** Compara sin cortar en la primera diferencia. */
function iguales(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a[i] ^ b[i];
  return dif === 0;
}

export async function claveCorrecta(clave: string, h: HuellaClave): Promise<boolean> {
  if (!/^\d+$/.test(clave)) return false;
  const calculada = await pbkdf2Sha256(utf8Codificar(clave), base64Decodificar(h.sal), h.iteraciones);
  return iguales(calculada, base64Decodificar(h.huella));
}

/** Espera después de `fallos` intentos fallidos seguidos: los primeros 5 sin espera; luego 30 s, 1 min, 2 min… hasta 15 min. */
export function esperaTrasFallos(fallos: number): number {
  if (fallos < 5) return 0;
  return Math.min(30_000 * 2 ** (fallos - 5), 15 * 60_000);
}

/** "45 segundos", "2 minutos" */
export function textoEspera(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s} segundos`;
  const m = Math.ceil(s / 60);
  return `${m} ${m === 1 ? 'minuto' : 'minutos'}`;
}
