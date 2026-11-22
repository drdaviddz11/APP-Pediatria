// Apertura de WhatsApp y envío de mensajes uno tras otro ("en lote").
// WhatsApp normal no permite enviar automáticamente: la app abre cada conversación con el mensaje
// escrito y la persona toca Enviar. Así se usa el enlace oficial wa.me, sin riesgo de bloqueo.

import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert } from './dialogo';
import { EN_COMPUTADORA, WEB_EN_TELEFONO } from './plataforma';
import { enlaceWhatsApp, enlaceWhatsAppWeb, TipoMensaje } from '../seguimiento/mensajes';
import { Boton, EnlaceTexto, Seccion, estilos } from './componentes';
import { colores, espacio, radio, texto } from './tema';
import { marcarActividad } from '../seguridad/actividad';

/** Abre WhatsApp con el mensaje escrito. Devuelve false si no se pudo. */
export async function abrirWhatsApp(numero: string, mensaje: string): Promise<boolean> {
  if (WEB_EN_TELEFONO) {
    // Versión web en el teléfono: el enlace oficial wa.me abre la app de WhatsApp.
    const ventana = window.open(enlaceWhatsApp(numero, mensaje), '_blank');
    if (!ventana) window.location.assign(enlaceWhatsApp(numero, mensaje));
    return true;
  }
  if (EN_COMPUTADORA) {
    // Siempre en la misma pestaña de WhatsApp Web, para no llenar el navegador de pestañas al enviar varios.
    const ventana = window.open(enlaceWhatsAppWeb(numero, mensaje), 'pediacontrol-whatsapp');
    if (!ventana) {
      Alert.alert('No se pudo abrir WhatsApp Web', 'El navegador bloqueó la ventana. Permita las ventanas emergentes para esta página e intente de nuevo.');
      return false;
    }
    return true;
  }
  try {
    await Linking.openURL(enlaceWhatsApp(numero, mensaje));
    return true;
  } catch {
    Alert.alert('No se pudo abrir WhatsApp', 'Revise que WhatsApp esté instalado en este teléfono.');
    return false;
  }
}

export function Casilla({ marcada, onPress, deshabilitada }: { marcada: boolean; onPress: () => void; deshabilitada?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitada}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada, disabled: deshabilitada }}
      style={[s.casilla, marcada && s.casillaMarcada, deshabilitada && { opacity: 0.35 }]}
    >
      {marcada ? <Text style={s.palomita}>✓</Text> : null}
    </Pressable>
  );
}

export interface MensajeEnCola {
  clave: string;
  nombre: string;
  detalle: string; // por ejemplo "lun 23 nov 09:20"
  numero: string;
  texto: string;
  tipo: TipoMensaje;
  pacienteId: string | null;
  citaId: string | null;
}

/** Cola de mensajes: un toque abre el siguiente chat con el mensaje listo. */
export function EnvioEnLote({
  mensajes,
  alAbrir,
  alTerminar,
}: {
  mensajes: MensajeEnCola[];
  alAbrir: (m: MensajeEnCola) => Promise<void>;
  alTerminar: () => void;
}) {
  const [textos, setTextos] = useState<Record<string, string>>(() => Object.fromEntries(mensajes.map((m) => [m.clave, m.texto])));
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [saltados, setSaltados] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState<string | null>(null);

  const siguiente = mensajes.find((m) => !abiertos.has(m.clave) && !saltados.has(m.clave));
  const hechos = abiertos.size + saltados.size;

  async function abrir(m: MensajeEnCola) {
    const texto = textos[m.clave] ?? m.texto;
    if (await abrirWhatsApp(m.numero, texto)) {
      setAbiertos((prev) => new Set(prev).add(m.clave));
      setEditando(null);
      await alAbrir({ ...m, texto });
    }
  }

  return (
    <View>
      <Seccion titulo={`Enviar mensajes (${hechos} de ${mensajes.length})`}>
        <Text style={[estilos.suave, { marginBottom: espacio.s }]}>
          {EN_COMPUTADORA && !WEB_EN_TELEFONO
            ? 'Cada clic abre WhatsApp Web (en la misma pestaña) con el mensaje ya escrito. Revíselo, presione Enviar y regrese a esta pestaña para el siguiente.'
            : 'Cada toque abre WhatsApp con el mensaje ya escrito. Revíselo, toque Enviar y regrese a esta app para el siguiente.'}
        </Text>
        {siguiente ? (
          <Boton texto={`Abrir WhatsApp: ${siguiente.nombre}`} onPress={() => void abrir(siguiente)} />
        ) : (
          <Text style={[estilos.normal, { fontWeight: '700', color: colores.exito }]}>Listo: ya se abrieron todos los mensajes.</Text>
        )}
        <Boton texto={siguiente ? 'Terminar después' : 'Terminar'} variante="secundario" onPress={alTerminar} />
      </Seccion>

      <Seccion titulo="Mensajes">
        {mensajes.map((m) => {
          const abierto = abiertos.has(m.clave);
          const saltado = saltados.has(m.clave);
          const esSiguiente = siguiente?.clave === m.clave;
          return (
            <View key={m.clave} style={[s.mensaje, esSiguiente && s.mensajeSiguiente]}>
              <View style={s.filaMensaje}>
                <Text style={s.estado}>{abierto ? '✅' : saltado ? '⏭️' : esSiguiente ? '👉' : '•'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[estilos.normal, { fontWeight: '700' }]}>{m.nombre}</Text>
                  <Text style={estilos.suave}>
                    {m.detalle} · +{m.numero}
                  </Text>
                </View>
              </View>
              {editando === m.clave ? (
                <TextInput
                  style={s.editor}
                  multiline
                  value={textos[m.clave]}
                  onChangeText={(v) => {
                    marcarActividad();
                    setTextos((prev) => ({ ...prev, [m.clave]: v }));
                  }}
                />
              ) : (
                <Text style={s.texto}>{textos[m.clave]}</Text>
              )}
              <View style={s.acciones}>
                <EnlaceTexto texto={editando === m.clave ? 'Listo' : 'Editar'} onPress={() => setEditando(editando === m.clave ? null : m.clave)} />
                <EnlaceTexto texto={abierto ? 'Abrir de nuevo' : 'Abrir'} onPress={() => void abrir(m)} />
                {!abierto && !saltado && (
                  <EnlaceTexto texto="Saltar" onPress={() => setSaltados((prev) => new Set(prev).add(m.clave))} />
                )}
              </View>
            </View>
          );
        })}
      </Seccion>
    </View>
  );
}

const s = StyleSheet.create({
  casilla: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colores.primario,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.superficie,
  },
  casillaMarcada: { backgroundColor: colores.primario },
  palomita: { color: '#FFFFFF', fontWeight: '900', fontSize: 16, marginTop: -1 },
  mensaje: { paddingVertical: espacio.m, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colores.borde, gap: espacio.s },
  mensajeSiguiente: { backgroundColor: colores.primarioSuave, borderRadius: radio.m, paddingHorizontal: espacio.s },
  filaMensaje: { flexDirection: 'row', gap: espacio.s, alignItems: 'center' },
  estado: { width: 24, fontSize: 16, textAlign: 'center' },
  texto: { fontSize: texto.pequeno, color: colores.texto, lineHeight: 20 },
  editor: {
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radio.s,
    padding: espacio.s,
    minHeight: 100,
    fontSize: texto.pequeno,
    color: colores.texto,
    backgroundColor: colores.superficie,
    textAlignVertical: 'top',
  },
  acciones: { flexDirection: 'row', gap: espacio.l },
});
