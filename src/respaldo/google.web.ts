// Conexión con la cuenta de Google en la COMPUTADORA (navegador).
// Se usa la redirección de página completa: la app va a accounts.google.com y Google la regresa a /google con el permiso.
// (Las ventanas emergentes no sirven aquí porque la página está aislada para la base de datos.)
// El permiso dura una hora y solo se guarda en esta pestaña (sessionStorage); de la cuenta solo se recuerda el correo.

import { Drive, leerRespuesta, RespuestaGoogle, textoErrorPermiso, urlAutorizacion } from './drive';

const CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '').trim();
const BASE = (process.env.EXPO_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');

const CLAVE_ESTADO = 'pediacontrol.google.estado';
const CLAVE_SESION = 'pediacontrol.google.sesion';
const CLAVE_CUENTA = 'pediacontrol.google.cuenta';

function leer(alm: 'local' | 'sesion', clave: string): string | null {
  try {
    return (alm === 'local' ? localStorage : sessionStorage).getItem(clave);
  } catch {
    return null;
  }
}
function escribir(alm: 'local' | 'sesion', clave: string, valor: string | null) {
  try {
    const s = alm === 'local' ? localStorage : sessionStorage;
    if (valor === null) s.removeItem(clave);
    else s.setItem(clave, valor);
  } catch {
    // Sin almacenamiento (ventana privada): se pedirá permiso cada vez.
  }
}

/** ¿Está configurada la conexión con Google en esta versión? */
export function driveDisponible(): boolean {
  return CLIENT_ID.length > 0;
}

export function direccionDeRegreso(): string {
  return `${window.location.origin}${BASE}/google`;
}

/** Va a Google a pedir permiso. La página se recarga al volver. */
export function conectarGoogle(): void {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const estado = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  escribir('sesion', CLAVE_ESTADO, estado);
  window.location.assign(urlAutorizacion({ clientId: CLIENT_ID, redireccion: direccionDeRegreso(), estado, correo: cuentaRecordada() }));
}

/**
 * Procesa la respuesta de Google al volver. Devuelve null si todo salió bien, o el mensaje de error.
 * Comprueba que la respuesta sea de la solicitud que hizo esta misma pestaña (estado).
 */
export async function recibirRespuestaGoogle(hash: string): Promise<string | null> {
  const r: RespuestaGoogle | null = leerRespuesta(hash);
  const esperado = leer('sesion', CLAVE_ESTADO);
  escribir('sesion', CLAVE_ESTADO, null);
  if (!r) return 'No llegó respuesta de Google. Intente conectar de nuevo.';
  if (!esperado || r.estado !== esperado) return 'La respuesta de Google no corresponde a esta pestaña. Intente conectar de nuevo.';
  if (r.tipo === 'error') return textoErrorPermiso(r.error);
  if (r.alcances.length > 0 && !r.alcances.some((a) => a.endsWith('/auth/drive.file') || a.endsWith('/auth/drive')))
    return 'No se marcó el permiso para Google Drive. Conecte de nuevo y deje marcada la casilla de Drive.';
  escribir('sesion', CLAVE_SESION, JSON.stringify({ token: r.token, vence: Date.now() + (r.segundos - 60) * 1000 }));
  try {
    const correo = await new Drive(r.token).correo();
    if (correo) escribir('local', CLAVE_CUENTA, correo);
  } catch {
    // Sin el correo igual se puede respaldar.
  }
  return null;
}

/** Cliente de Drive si el permiso sigue vigente en esta pestaña; si no, null (hay que conectar). */
export function driveActual(): Drive | null {
  const s = leer('sesion', CLAVE_SESION);
  if (!s) return null;
  try {
    const { token, vence } = JSON.parse(s) as { token: string; vence: number };
    if (typeof token !== 'string' || !(vence > Date.now())) return null;
    return new Drive(token);
  } catch {
    return null;
  }
}

/** Correo de la cuenta de Google que se usó la última vez en esta computadora. */
export function cuentaRecordada(): string | null {
  return leer('local', CLAVE_CUENTA);
}

/** Quita el permiso (también en Google) y olvida la cuenta en esta computadora. Los respaldos en Drive no se borran. */
export async function desconectarGoogle(): Promise<void> {
  const s = leer('sesion', CLAVE_SESION);
  escribir('sesion', CLAVE_SESION, null);
  escribir('local', CLAVE_CUENTA, null);
  if (!s) return;
  try {
    const { token } = JSON.parse(s) as { token: string };
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    });
  } catch {
    // Si no se pudo avisar a Google, el permiso vence solo en menos de una hora.
  }
}

/** En la computadora el permiso dura una hora: se pide un toque para respaldar. */
export const DRIVE_AUTOMATICO = false;
