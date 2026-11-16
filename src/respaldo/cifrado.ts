// Cifrar y descifrar el contenido del respaldo con una contraseña.
// AES-256-GCM lo hace expo-crypto (nativo); la llave se deriva con PBKDF2-SHA256.

import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync, getRandomBytes } from 'expo-crypto';
import { base64Codificar, base64Decodificar, utf8Codificar, utf8Decodificar } from './codificacion';
import { ArchivoRespaldo, ContenidoRespaldo, FORMATO, ITERACIONES, ResumenRespaldo, VERSION_FORMATO } from './formato';
import { pbkdf2Sha256 } from './pbkdf2';

export async function cifrarRespaldo(
  contenido: ContenidoRespaldo,
  resumen: ResumenRespaldo,
  contrasena: string,
  alProgreso?: (fraccion: number) => void,
): Promise<ArchivoRespaldo> {
  const sal = getRandomBytes(16);
  const llave = await pbkdf2Sha256(utf8Codificar(contrasena), sal, ITERACIONES, alProgreso);
  const clave = await AESEncryptionKey.import(llave);
  const sellado = await aesEncryptAsync(utf8Codificar(JSON.stringify(contenido)), clave);
  const datos = await sellado.combined('base64');
  return {
    formato: FORMATO,
    version: VERSION_FORMATO,
    creado: new Date().toISOString(),
    esquema: contenido.esquema,
    resumen,
    kdf: { algoritmo: 'PBKDF2-SHA256', iteraciones: ITERACIONES, sal: base64Codificar(sal) },
    cifrado: { algoritmo: 'AES-256-GCM', datos: datos as string },
  };
}

export class ContrasenaIncorrectaError extends Error {
  constructor() {
    super('La contraseña es incorrecta o el archivo está dañado.');
  }
}

export async function descifrarRespaldo(
  archivo: ArchivoRespaldo,
  contrasena: string,
  alProgreso?: (fraccion: number) => void,
): Promise<ContenidoRespaldo> {
  const llave = await pbkdf2Sha256(utf8Codificar(contrasena), base64Decodificar(archivo.kdf.sal), archivo.kdf.iteraciones, alProgreso);
  const clave = await AESEncryptionKey.import(llave);
  let bytes: Uint8Array;
  try {
    const sellado = AESSealedData.fromCombined(base64Decodificar(archivo.cifrado.datos));
    bytes = (await aesDecryptAsync(sellado, clave, { output: 'bytes' })) as Uint8Array;
  } catch {
    throw new ContrasenaIncorrectaError();
  }
  const contenido = JSON.parse(utf8Decodificar(bytes)) as ContenidoRespaldo;
  if (typeof contenido?.esquema !== 'number' || typeof contenido.tablas !== 'object') {
    throw new Error('El contenido del respaldo no es válido.');
  }
  return contenido;
}
