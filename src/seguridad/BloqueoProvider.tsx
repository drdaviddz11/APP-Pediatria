// Bloqueo de la app con clave: al abrir y después de unos minutos sin usarla.
// La pantalla de bloqueo tapa todo; lo que estaba escrito debajo (una consulta a medias) no se pierde.

import { useSQLiteContext } from 'expo-sqlite';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { AjustesBloqueo, leerAjustesBloqueo } from '../db/seguridad';
import { marcarActividad, ultimaActividad } from './actividad';
import { PantallaBloqueo } from './PantallaBloqueo';

interface EstadoBloqueo {
  ajustes: AjustesBloqueo | null;
  bloquearAhora: () => void;
  /** Volver a leer los ajustes después de cambiarlos. */
  recargar: () => Promise<void>;
}

const ContextoBloqueo = createContext<EstadoBloqueo | null>(null);

export function useBloqueo(): EstadoBloqueo {
  const v = useContext(ContextoBloqueo);
  if (!v) throw new Error('useBloqueo fuera de BloqueoProvider');
  return v;
}

const REVISAR_CADA_MS = 15_000;

export function BloqueoProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [ajustes, setAjustes] = useState<AjustesBloqueo | null>(null);
  const [bloqueada, setBloqueada] = useState(true);
  const ocultaDesde = useRef<number | null>(null);

  const recargar = useCallback(async () => {
    const a = await leerAjustesBloqueo(db);
    setAjustes(a);
    if (!a.clave) setBloqueada(false);
  }, [db]);

  // Al abrir: bloqueada si hay clave.
  useEffect(() => {
    void leerAjustesBloqueo(db).then((a) => {
      setAjustes(a);
      setBloqueada(!!a.clave);
    });
  }, [db]);

  const conClave = !!ajustes?.clave;
  const limiteMs = (ajustes?.minutos ?? 5) * 60_000;

  const registrarActividad = useCallback(() => marcarActividad(), []);

  // Sin usar la app por N minutos → se bloquea.
  useEffect(() => {
    if (!conClave) return;
    const t = setInterval(() => {
      if (Date.now() - ultimaActividad() >= limiteMs) setBloqueada(true);
    }, REVISAR_CADA_MS);
    return () => clearInterval(t);
  }, [conClave, limiteMs]);

  // La app se fue al fondo (teléfono) o la pestaña quedó oculta (computadora) por N minutos → se bloquea al volver.
  useEffect(() => {
    if (!conClave) return;
    const alOcultar = () => {
      ocultaDesde.current = Date.now();
    };
    const alMostrar = () => {
      const desde = ocultaDesde.current;
      ocultaDesde.current = null;
      if (desde != null && Date.now() - desde >= limiteMs) setBloqueada(true);
    };
    if (Platform.OS === 'web') {
      const cambio = () => (document.visibilityState === 'hidden' ? alOcultar() : alMostrar());
      const eventos = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
      document.addEventListener('visibilitychange', cambio);
      eventos.forEach((e) => document.addEventListener(e, registrarActividad, { capture: true, passive: true }));
      return () => {
        document.removeEventListener('visibilitychange', cambio);
        eventos.forEach((e) => document.removeEventListener(e, registrarActividad, { capture: true }));
      };
    }
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? alMostrar() : alOcultar()));
    return () => sub.remove();
  }, [conClave, limiteMs, registrarActividad]);

  const valor = useMemo<EstadoBloqueo>(
    () => ({
      ajustes,
      recargar,
      bloquearAhora: () => {
        if (ajustes?.clave) setBloqueada(true);
      },
    }),
    [ajustes, recargar],
  );

  const tapada = ajustes === null || (conClave && bloqueada);
  return (
    <ContextoBloqueo.Provider value={valor}>
      <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        aria-hidden={tapada}
        onStartShouldSetResponderCapture={() => {
          registrarActividad();
          return false;
        }}
        accessibilityElementsHidden={tapada}
        importantForAccessibility={tapada ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {tapada && (
        <PantallaBloqueo
          cargando={ajustes === null}
          biometria={!!ajustes?.biometria}
          alAbrir={() => {
            marcarActividad();
            setBloqueada(false);
          }}
        />
      )}
      </View>
    </ContextoBloqueo.Provider>
  );
}
