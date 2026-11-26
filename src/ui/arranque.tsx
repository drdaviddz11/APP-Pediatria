// Arranque de la app en el navegador: si la base de datos no abre (por ejemplo, en un iPhone que no la permite),
// en lugar de una pantalla en blanco se explica qué pasó, con los datos técnicos para revisarlo.

import { Component, ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { EN_COMPUTADORA, WEB_EN_TELEFONO } from './plataforma';
import { colores, espacio, radio, texto } from './tema';

type G = {
  navigator?: {
    userAgent?: string;
    serviceWorker?: { controller?: unknown };
    storage?: { getDirectory?: unknown };
    standalone?: boolean;
  };
  crossOriginIsolated?: boolean;
  isSecureContext?: boolean;
  SharedArrayBuffer?: unknown;
  Atomics?: unknown;
  Worker?: unknown;
  WebAssembly?: unknown;
  matchMedia?: (q: string) => { matches: boolean };
  location?: { reload(): void; href?: string };
};
const g = globalThis as G;

const ES_IOS = /iPhone|iPad|iPod/i.test(g.navigator?.userAgent ?? '');
/** Chrome, Firefox o Edge en el iPhone (no Safari). */
const NAVEGADOR_IOS_NO_SAFARI = ES_IOS && /CriOS|FxiOS|EdgiOS/i.test(g.navigator?.userAgent ?? '');

function versionIOS(): string | null {
  const m = /OS (\d+)[_.](\d+)/.exec(g.navigator?.userAgent ?? '');
  return ES_IOS && m ? `${m[1]}.${m[2]}` : null;
}

/** Lo que necesita la base de datos del navegador, para mostrarlo si algo falla. */
export function datosDelNavegador(): string[] {
  const si = (v: boolean) => (v ? 'sí' : 'NO');
  const n = g.navigator;
  const instalada = !!n?.standalone || !!g.matchMedia?.('(display-mode: standalone)').matches;
  const v = versionIOS();
  const navegador = NAVEGADOR_IOS_NO_SAFARI ? 'Chrome/otro (iPhone)' : ES_IOS ? 'Safari' : 'Computadora/Android';
  return [
    `Equipo: ${v ? `iPhone/iPad, iOS ${v}` : WEB_EN_TELEFONO ? 'teléfono' : 'computadora'} · ${navegador}${instalada ? ' · instalada en la pantalla de inicio' : ''}`,
    `Conexión segura: ${si(g.isSecureContext !== false)} · Aislada: ${si(g.crossOriginIsolated === true)} · Service worker: ${si(!!n?.serviceWorker)}${n?.serviceWorker ? ` (activo: ${si(!!n.serviceWorker.controller)})` : ''}`,
    `Memoria compartida: ${si(typeof g.SharedArrayBuffer === 'function')} · Atomics: ${si(!!g.Atomics)} · Worker: ${si(typeof g.Worker === 'function')} · WebAssembly: ${si(!!g.WebAssembly)} · Archivos privados (OPFS): ${si(typeof n?.storage?.getDirectory === 'function')}`,
  ];
}

/** Qué hacer, en palabras simples, según el equipo. */
export function consejoDelNavegador(): string {
  if (NAVEGADOR_IOS_NO_SAFARI)
    return 'En el iPhone, Chrome no permite guardar la base de datos de la app. Abra la misma dirección en Safari y, ya abierta, toque Compartir → "Agregar a pantalla de inicio".';
  const v = versionIOS();
  if (v && Number(v.split('.')[0]) < 17)
    return `Este iPhone tiene iOS ${v}. La app necesita iOS 17 o más reciente: actualícelo en Configuración → General → Actualización de software.`;
  if (ES_IOS)
    return 'Revise que Safari no esté en "navegación privada" (la pestaña se ve oscura) y recargue. Si sigue igual, mándele una captura de esta pantalla a quien le da soporte.';
  return 'Recargue la página. Si sigue igual, ábrala en Google Chrome o Microsoft Edge actualizados.';
}

function PantallaProblema({ titulo, detalle }: { titulo: string; detalle?: string }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colores.fondo }} contentContainerStyle={{ padding: espacio.xl, alignItems: 'center', gap: espacio.m }}>
      <Text style={{ fontSize: texto.titulo, fontWeight: '700', color: colores.texto, marginTop: espacio.xl }}>PediaControl Pro</Text>
      <Text style={{ fontSize: texto.normal, fontWeight: '700', color: colores.texto, textAlign: 'center' }}>{titulo}</Text>
      <Text style={{ fontSize: texto.normal, color: colores.texto, maxWidth: 520, textAlign: 'center', lineHeight: 24 }}>{consejoDelNavegador()}</Text>
      <Pressable
        onPress={() => g.location?.reload()}
        accessibilityRole="button"
        style={({ pressed }) => [{ backgroundColor: colores.primario, borderRadius: radio.m, paddingVertical: 12, paddingHorizontal: 32 }, pressed && { opacity: 0.8 }]}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: texto.normal }}>Volver a intentar</Text>
      </Pressable>
      <View style={{ maxWidth: 560, borderWidth: 1, borderColor: colores.borde, borderRadius: radio.m, padding: espacio.m, gap: 4 }}>
        <Text style={{ fontSize: texto.pequeno, fontWeight: '700', color: colores.textoSuave }}>Datos técnicos (no incluyen datos de pacientes)</Text>
        {detalle ? <Text style={{ fontSize: texto.pequeno, color: colores.peligro }}>{detalle}</Text> : null}
        {datosDelNavegador().map((l) => (
          <Text key={l} style={{ fontSize: texto.pequeno, color: colores.textoSuave }}>
            {l}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

/** Mientras abre la base de datos. Si tarda demasiado, explica en vez de dar vueltas para siempre. */
export function CargandoBase() {
  const [tarde, setTarde] = useState(false);
  useEffect(() => {
    if (!EN_COMPUTADORA) return;
    const t = setTimeout(() => setTarde(true), 25_000);
    return () => clearTimeout(t);
  }, []);
  if (tarde) return <PantallaProblema titulo="La app está tardando demasiado en abrir la base de datos." />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colores.fondo }}>
      <ActivityIndicator size="large" color={colores.primario} />
    </View>
  );
}

/** Si la base de datos no abre, muestra el motivo en lugar de dejar la pantalla en blanco. */
export class ProtectorArranque extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message || e.name : String(e) };
  }

  render() {
    if (this.state.error) return <PantallaProblema titulo="La app no pudo abrir su base de datos en este navegador." detalle={this.state.error.slice(0, 300)} />;
    return this.props.children;
  }
}

export { PantallaProblema };
