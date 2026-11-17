// Línea de estado de la sincronización para el panel principal. Al tocarla abre la pantalla de sincronización.

import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colores, espacio, radio, texto } from '../ui/tema';
import { escuchar } from './eventos';
import { EstadoSync, leerEstadoSync } from './servicio';

function textoEstado(e: EstadoSync): { texto: string; tono: 'normal' | 'aviso' | 'error' } {
  if (!e.activo) return { texto: '☁️ Sincronización desactivada. Toque aquí para compartir los datos entre el teléfono y la computadora.', tono: 'normal' };
  const avisos = e.avisos > 0 ? ` · ${e.avisos} ${e.avisos === 1 ? 'aviso' : 'avisos'} por revisar` : '';
  if (e.sincronizando) return { texto: `☁️ Sincronizando…${avisos}`, tono: e.avisos > 0 ? 'aviso' : 'normal' };
  if (e.error) {
    const sinConexion = e.tipoError === 'sin_conexion';
    return {
      texto: `${sinConexion ? '📴 Sin conexión' : '⚠️ No se pudo sincronizar'}${e.pendientes > 0 ? ` · ${e.pendientes} cambios guardados en este equipo` : ''}${avisos}`,
      tono: sinConexion ? 'aviso' : 'error',
    };
  }
  if (e.pendientes > 0) return { texto: `☁️ ${e.pendientes} ${e.pendientes === 1 ? 'cambio' : 'cambios'} por enviar${avisos}`, tono: e.avisos > 0 ? 'aviso' : 'normal' };
  if (!e.ultimo) return { texto: `☁️ Sincronización activa${avisos}`, tono: e.avisos > 0 ? 'aviso' : 'normal' };
  const min = Math.floor((Date.now() - Date.parse(e.ultimo)) / 60000);
  return { texto: `☁️ Sincronizado ${min < 1 ? 'hace un momento' : `hace ${min} min`}${avisos}`, tono: e.avisos > 0 ? 'aviso' : 'normal' };
}

export function IndicadorSync() {
  const db = useSQLiteContext();
  const [estado, setEstado] = useState<EstadoSync | null>(null);

  useEffect(() => {
    let vivo = true;
    const cargar = () => void leerEstadoSync(db).then((e) => vivo && setEstado(e));
    cargar();
    const quitar = escuchar('estado', cargar);
    const intervalo = setInterval(cargar, 30_000);
    return () => {
      vivo = false;
      quitar();
      clearInterval(intervalo);
    };
  }, [db]);

  if (!estado) return null;
  const { texto: t, tono } = textoEstado(estado);
  return (
    <Pressable
      onPress={() => router.push('/sincronizacion')}
      accessibilityRole="button"
      style={({ pressed }) => [s.caja, tono === 'aviso' && s.aviso, tono === 'error' && s.error, pressed && { opacity: 0.8 }]}
    >
      <Text style={[s.texto, tono === 'error' && { color: colores.peligro, fontWeight: '700' }]}>{t}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  caja: {
    backgroundColor: colores.primarioSuave,
    borderRadius: radio.m,
    paddingVertical: espacio.s,
    paddingHorizontal: espacio.m,
    marginBottom: espacio.m,
  },
  aviso: { backgroundColor: colores.avisoSuave },
  error: { backgroundColor: colores.peligroSuave },
  texto: { fontSize: texto.pequeno, color: colores.texto },
});
