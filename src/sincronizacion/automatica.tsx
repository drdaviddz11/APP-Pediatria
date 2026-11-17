// Sincronización automática mientras la app está abierta:
// al abrirla, al volver a ella, pocos segundos después de cada cambio y cada minuto para recibir lo de otros equipos.

import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { contarPendientes, sincronizacionActiva } from './motor';
import { leerEstadoSync, sincronizarAhora } from './servicio';

const REVISAR_CADA = 5_000;
const RECIBIR_CADA = 60_000;
/** Después de un error (sin internet, servidor pausado), se espera más antes de reintentar. */
const ESPERA_TRAS_ERROR = 30_000;

export function SincronizacionAutomatica() {
  const db = useSQLiteContext();

  useEffect(() => {
    let vivo = true;
    let ultimo = 0;

    async function ciclo(forzar: boolean) {
      if (!vivo) return;
      try {
        if (!(await sincronizacionActiva(db))) return;
        const ahora = Date.now();
        const estado = await leerEstadoSync(db);
        if (estado.sincronizando) return;
        const espera = estado.error ? ESPERA_TRAS_ERROR : 0;
        const pendientes = await contarPendientes(db);
        const toca = forzar || (pendientes > 0 && ahora - ultimo > Math.max(REVISAR_CADA, espera)) || ahora - ultimo > Math.max(RECIBIR_CADA, espera);
        if (!toca) return;
        ultimo = ahora;
        await sincronizarAhora(db);
      } catch {
        // sincronizarAhora guarda sus propios errores; aquí solo se evita que el ciclo se detenga.
      }
    }

    void ciclo(true);
    const intervalo = setInterval(() => void ciclo(false), REVISAR_CADA);
    const suscripcion = AppState.addEventListener('change', (s) => {
      if (s === 'active') void ciclo(true);
    });
    return () => {
      vivo = false;
      clearInterval(intervalo);
      suscripcion.remove();
    };
  }, [db]);

  return null;
}
