// Diferencias entre el teléfono y la computadora (navegador).

import { Platform } from 'react-native';

export const EN_COMPUTADORA = Platform.OS === 'web';

/** Cómo llamar al equipo donde se guardan los datos, para los textos de la app. */
export const ESTE_EQUIPO = EN_COMPUTADORA ? 'Esta computadora' : 'Este teléfono';

/**
 * En la computadora la base de datos necesita que el navegador permita el "aislamiento de origen"
 * (Chrome y Edge lo permiten con la configuración de metro.config.js). Devuelve un mensaje si no se puede usar.
 */
export function problemaDelNavegador(): string | null {
  if (!EN_COMPUTADORA) return null;
  const g = globalThis as { crossOriginIsolated?: boolean; isSecureContext?: boolean };
  if (g.isSecureContext === false)
    return 'Abra la app con la dirección http://localhost:8081 en esta misma computadora. Por seguridad, el navegador no permite cifrar datos en otras direcciones sin https.';
  if (g.crossOriginIsolated === false)
    return 'Este navegador no puede guardar la base de datos de la app. Ábrala en Google Chrome o Microsoft Edge, con la dirección http://localhost:8081.';
  return null;
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
