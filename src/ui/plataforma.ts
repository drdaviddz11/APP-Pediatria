// Diferencias entre el teléfono y la computadora (navegador).

import { Platform } from 'react-native';

export const EN_COMPUTADORA = Platform.OS === 'web';

/** Cómo llamar al equipo donde se guardan los datos, para los textos de la app. */
export const ESTE_EQUIPO = EN_COMPUTADORA ? 'Esta computadora' : 'Este teléfono';

type Global = {
  crossOriginIsolated?: boolean;
  isSecureContext?: boolean;
  navigator?: { serviceWorker?: { register(url: string, o?: { scope: string }): Promise<unknown>; ready: Promise<unknown> } };
  sessionStorage?: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
  location?: { reload(): void };
};
const g = globalThis as Global;
const CLAVE_INTENTOS = 'pediacontrol-aislamiento';

/**
 * En la computadora, la base de datos necesita que la página esté "aislada" (cross-origin isolated).
 * - 'listo': se puede usar.
 * - 'preparar': falta activar el service worker (public/aislamiento-sw.js) y recargar; ver prepararNavegador().
 * - un texto: no se puede usar en este navegador (el mensaje explica qué hacer).
 */
export function estadoDelNavegador(): 'listo' | 'preparar' | string {
  if (!EN_COMPUTADORA) return 'listo';
  if (g.isSecureContext === false)
    return 'Abra la app con su dirección segura (https://… o http://localhost:8081 en la Mac). Por seguridad, el navegador no permite cifrar datos en direcciones sin https.';
  if (g.crossOriginIsolated !== false) {
    try {
      g.sessionStorage?.removeItem(CLAVE_INTENTOS);
    } catch {
      // Sin acceso al almacenamiento de la sesión: no importa.
    }
    return 'listo';
  }
  let intentos = 0;
  try {
    intentos = Number(g.sessionStorage?.getItem(CLAVE_INTENTOS) ?? 0);
  } catch {
    intentos = 0;
  }
  if (g.navigator?.serviceWorker && intentos < 2) return 'preparar';
  return 'Este navegador no pudo preparar la base de datos de la app. Ábrala en Google Chrome o Microsoft Edge y recargue la página.';
}

/** Activa el service worker que agrega los encabezados de aislamiento y recarga la página (como máximo dos veces). */
export async function prepararNavegador(): Promise<void> {
  const sw = g.navigator?.serviceWorker;
  if (!sw) return;
  try {
    const intentos = Number(g.sessionStorage?.getItem(CLAVE_INTENTOS) ?? 0);
    g.sessionStorage?.setItem(CLAVE_INTENTOS, String(intentos + 1));
  } catch {
    // Sin almacenamiento de sesión se intenta igual una vez.
  }
  // En GitHub Pages la app vive en una carpeta (/APP-Pediatria); en la Mac, en la raíz.
  const base = (process.env.EXPO_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
  await sw.register(`${base}/aislamiento-sw.js`, { scope: `${base}/` });
  await sw.ready;
  g.location?.reload();
}

/**
 * Pide al navegador que no borre los datos de la app cuando falte espacio en disco.
 * (No evita que se borren si alguien elimina manualmente los datos de navegación.)
 */
export function pedirAlmacenamientoPersistente(): void {
  if (!EN_COMPUTADORA) return;
  const nav = (globalThis as { navigator?: { storage?: { persist?: () => Promise<boolean> } } }).navigator;
  void nav?.storage?.persist?.().catch(() => undefined);
}
