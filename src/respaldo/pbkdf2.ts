// PBKDF2-HMAC-SHA256 (RFC 8018) en JavaScript puro, para derivar la llave del respaldo
// a partir de la contraseña. El cifrado en sí (AES-256-GCM) lo hace el módulo nativo expo-crypto.
// Verificado contra crypto.pbkdf2Sync de Node.js (ver docs/VALIDACION.md).

const K = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const H0 = new Int32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);

const W = new Int32Array(64);

/** Procesa un bloque de 16 palabras de 32 bits sobre el estado H (modifica H). */
function bloque(H: Int32Array, M: Int32Array, desde = 0): void {
  for (let i = 0; i < 16; i++) W[i] = M[desde + i];
  for (let i = 16; i < 64; i++) {
    const x = W[i - 15];
    const y = W[i - 2];
    const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
    const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
  }
  let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const ch = (e & f) ^ (~e & g);
    const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const t2 = (S0 + maj) | 0;
    h = g;
    g = f;
    f = e;
    e = (d + t1) | 0;
    d = c;
    c = b;
    b = a;
    a = (t1 + t2) | 0;
  }
  H[0] = (H[0] + a) | 0;
  H[1] = (H[1] + b) | 0;
  H[2] = (H[2] + c) | 0;
  H[3] = (H[3] + d) | 0;
  H[4] = (H[4] + e) | 0;
  H[5] = (H[5] + f) | 0;
  H[6] = (H[6] + g) | 0;
  H[7] = (H[7] + h) | 0;
}

/** SHA-256 de `datos`, continuando desde `estado` que ya procesó `previos` bytes (múltiplo de 64). */
function sha256Desde(estado: Int32Array, previos: number, datos: Uint8Array): Uint8Array {
  const H = Int32Array.from(estado);
  const total = previos + datos.length;
  const relleno = ((datos.length + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(relleno);
  buf.set(datos);
  buf[datos.length] = 0x80;
  const bits = total * 8;
  const vista = new DataView(buf.buffer);
  vista.setUint32(relleno - 8, Math.floor(bits / 0x100000000));
  vista.setUint32(relleno - 4, bits >>> 0);
  const M = new Int32Array(16);
  for (let off = 0; off < relleno; off += 64) {
    for (let i = 0; i < 16; i++) M[i] = vista.getInt32(off + i * 4);
    bloque(H, M);
  }
  const salida = new Uint8Array(32);
  const vs = new DataView(salida.buffer);
  for (let i = 0; i < 8; i++) vs.setInt32(i * 4, H[i]);
  return salida;
}

export function sha256(datos: Uint8Array): Uint8Array {
  return sha256Desde(H0, 0, datos);
}

/** Estados de HMAC tras procesar la llave con ipad y opad (se calculan una sola vez). */
function estadosHmac(llave: Uint8Array): { interno: Int32Array; externo: Int32Array } {
  const bloqueLlave = new Uint8Array(64);
  bloqueLlave.set(llave.length > 64 ? sha256(llave) : llave);
  const estado = (pad: number) => {
    const H = Int32Array.from(H0);
    const M = new Int32Array(16);
    const v = new DataView(bloqueLlave.buffer);
    for (let i = 0; i < 16; i++) M[i] = v.getInt32(i * 4) ^ (pad * 0x01010101);
    bloque(H, M);
    return H;
  };
  return { interno: estado(0x36), externo: estado(0x5c) };
}

export function hmacSha256(llave: Uint8Array, mensaje: Uint8Array): Uint8Array {
  const { interno, externo } = estadosHmac(llave);
  return sha256Desde(externo, 64, sha256Desde(interno, 64, mensaje));
}

/**
 * PBKDF2-HMAC-SHA256 con llave de 32 bytes. Avanza en tramos y cede el control entre tramos
 * para que la pantalla no se congele; `alProgreso` recibe un valor de 0 a 1.
 */
export async function pbkdf2Sha256(
  contrasena: Uint8Array,
  sal: Uint8Array,
  iteraciones: number,
  alProgreso?: (fraccion: number) => void,
): Promise<Uint8Array> {
  if (!Number.isInteger(iteraciones) || iteraciones < 1) throw new Error('Número de iteraciones inválido.');
  const { interno, externo } = estadosHmac(contrasena);
  // U1 = HMAC(P, S || INT(1))
  const primero = new Uint8Array(sal.length + 4);
  primero.set(sal);
  primero[sal.length + 3] = 1;
  const u1 = sha256Desde(externo, 64, sha256Desde(interno, 64, primero));

  // Iteraciones siguientes: el mensaje siempre mide 32 bytes, así que cada HMAC son dos bloques fijos.
  const U = new Int32Array(8);
  const T = new Int32Array(8);
  const v1 = new DataView(u1.buffer);
  for (let i = 0; i < 8; i++) {
    U[i] = v1.getInt32(i * 4);
    T[i] = U[i];
  }
  const M = new Int32Array(16);
  const H = new Int32Array(8);
  const TRAMO = 4000;
  for (let n = 1; n < iteraciones; n++) {
    // Interno: estado(ipad) + U + relleno (longitud total 96 bytes = 768 bits)
    H.set(interno);
    M.set(U);
    M[8] = 0x80000000;
    M.fill(0, 9, 15);
    M[15] = 768;
    bloque(H, M);
    // Externo: estado(opad) + resultado interno + relleno
    M.set(H);
    H.set(externo);
    M[8] = 0x80000000;
    M.fill(0, 9, 15);
    M[15] = 768;
    bloque(H, M);
    for (let i = 0; i < 8; i++) {
      U[i] = H[i];
      T[i] ^= H[i];
    }
    if (n % TRAMO === 0) {
      alProgreso?.(n / iteraciones);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  alProgreso?.(1);
  const salida = new Uint8Array(32);
  const vs = new DataView(salida.buffer);
  for (let i = 0; i < 8; i++) vs.setInt32(i * 4, T[i]);
  return salida;
}
