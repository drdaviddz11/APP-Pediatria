// UTF-8 y base64 en JavaScript puro (Hermes no trae TextDecoder).

export function utf8Codificar(texto: string): Uint8Array {
  const salida: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    let c = texto.charCodeAt(i);
    // Pares sustitutos → un solo punto de código
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < texto.length) {
      const d = texto.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) salida.push(c);
    else if (c < 0x800) salida.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) salida.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else salida.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(salida);
}

export function utf8Decodificar(bytes: Uint8Array): string {
  const partes: string[] = [];
  let bloque: number[] = [];
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let c: number;
    if (b < 0x80) {
      c = b;
      i += 1;
    } else if (b >= 0xc0 && b < 0xe0) {
      c = ((b & 31) << 6) | (bytes[i + 1] & 63);
      i += 2;
    } else if (b >= 0xe0 && b < 0xf0) {
      c = ((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63);
      i += 3;
    } else if (b >= 0xf0) {
      c = ((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63);
      i += 4;
    } else {
      throw new Error('Texto UTF-8 inválido.');
    }
    if (c >= 0x10000) {
      c -= 0x10000;
      bloque.push(0xd800 + (c >> 10), 0xdc00 + (c & 1023));
    } else {
      bloque.push(c);
    }
    if (bloque.length >= 8192) {
      partes.push(String.fromCharCode(...bloque));
      bloque = [];
    }
  }
  partes.push(String.fromCharCode(...bloque));
  return partes.join('');
}

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64Codificar(bytes: Uint8Array): string {
  const partes: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    partes.push(
      ALFABETO[(n >> 18) & 63] +
        ALFABETO[(n >> 12) & 63] +
        (i + 1 < bytes.length ? ALFABETO[(n >> 6) & 63] : '=') +
        (i + 2 < bytes.length ? ALFABETO[n & 63] : '='),
    );
  }
  return partes.join('');
}

export function base64Decodificar(texto: string): Uint8Array {
  const limpio = texto.replace(/[\s=]/g, '');
  if (/[^A-Za-z0-9+/]/.test(limpio)) throw new Error('Base64 inválido.');
  const salida = new Uint8Array(Math.floor((limpio.length * 3) / 4));
  let j = 0;
  for (let i = 0; i < limpio.length; i += 4) {
    const n =
      (ALFABETO.indexOf(limpio[i]) << 18) |
      (ALFABETO.indexOf(limpio[i + 1] ?? 'A') << 12) |
      (i + 2 < limpio.length ? ALFABETO.indexOf(limpio[i + 2]) << 6 : 0) |
      (i + 3 < limpio.length ? ALFABETO.indexOf(limpio[i + 3]) : 0);
    if (j < salida.length) salida[j++] = (n >> 16) & 255;
    if (j < salida.length) salida[j++] = (n >> 8) & 255;
    if (j < salida.length) salida[j++] = n & 255;
  }
  return salida;
}
