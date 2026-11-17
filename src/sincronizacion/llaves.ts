// Llaves de la sincronización a partir de UNA contraseña del médico.
//
// De la contraseña se obtienen dos llaves distintas (PBKDF2-SHA256 y luego HMAC):
//  - "secretoAcceso": lo que se envía al servidor para iniciar sesión. El servidor nunca ve la contraseña real.
//  - "llave": cifra cada registro con AES-256-GCM antes de enviarlo. Nunca sale del equipo.
// Así el servidor (Supabase) guarda solo datos ilegibles: cifrado de extremo a extremo.

import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import { base64Codificar, base64Decodificar, utf8Codificar, utf8Decodificar } from '../respaldo/codificacion';
import { ITERACIONES } from '../respaldo/formato';
import { hmacSha256, pbkdf2Sha256 } from '../respaldo/pbkdf2';

export interface Secretos {
  /** Texto hexadecimal de 64 caracteres: contraseña de la cuenta en el servidor. */
  secretoAcceso: string;
  /** 32 bytes en base64: llave AES-256 para cifrar los registros. */
  llave: string;
}

function hex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

export async function derivarSecretos(correo: string, contrasena: string, alProgreso?: (f: number) => void): Promise<Secretos> {
  // La sal depende del correo: el mismo correo y contraseña dan las mismas llaves en todos los equipos.
  const sal = utf8Codificar(`pediacontrol-sync-v1|${normalizarCorreo(correo)}`);
  const maestra = await pbkdf2Sha256(utf8Codificar(contrasena), sal, ITERACIONES, alProgreso);
  return {
    secretoAcceso: hex(hmacSha256(maestra, utf8Codificar('acceso'))),
    llave: base64Codificar(hmacSha256(maestra, utf8Codificar('cifrado'))),
  };
}

export class ClaveSync {
  private constructor(
    private readonly clave: AESEncryptionKey,
    private readonly llaveEtiqueta: Uint8Array,
  ) {}

  static async desde(llaveBase64: string): Promise<ClaveSync> {
    const bytes = base64Decodificar(llaveBase64);
    return new ClaveSync(await AESEncryptionKey.import(bytes), hmacSha256(bytes, utf8Codificar('etiqueta-fila')));
  }

  /**
   * Etiqueta anónima de la fila: igual para todas las versiones de la misma fila, pero no revela de qué tabla ni de qué
   * paciente se trata. Permite al servidor borrar las versiones viejas y quedarse solo con la más reciente.
   */
  etiqueta(tabla: string, clave: string): string {
    return hex(hmacSha256(this.llaveEtiqueta, utf8Codificar(`${tabla}|${clave}`))).slice(0, 32);
  }

  async cifrar(texto: string): Promise<string> {
    const sellado = await aesEncryptAsync(utf8Codificar(texto), this.clave);
    return (await sellado.combined('base64')) as string;
  }

  /** Lanza un error si el registro fue alterado o se cifró con otra contraseña. */
  async descifrar(datos: string): Promise<string> {
    const sellado = AESSealedData.fromCombined(base64Decodificar(datos));
    const bytes = (await aesDecryptAsync(sellado, this.clave, { output: 'bytes' })) as Uint8Array;
    return utf8Decodificar(bytes);
  }
}
