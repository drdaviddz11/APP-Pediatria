// Google regresa aquí después de pedir permiso (solo en la computadora). Se guarda el permiso y se vuelve a Respaldo.

import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { recibirRespuestaGoogle } from '../src/respaldo/google';
import { Cargando } from '../src/ui/componentes';

export default function RegresoDeGoogle() {
  useEffect(() => {
    let vigente = true;
    void (async () => {
      const hash = Platform.OS === 'web' ? window.location.hash : '';
      const error = await recibirRespuestaGoogle(hash);
      if (!vigente) return;
      // Se reemplaza la dirección para que el permiso no quede en el historial del navegador.
      router.replace({ pathname: '/respaldo', params: error ? { google: error } : { google: 'ok' } });
    })();
    return () => {
      vigente = false;
    };
  }, []);
  return <Cargando />;
}
