// Ventanas de aviso y confirmación que funcionan igual en el teléfono y en la computadora.
// En iPhone/Android se usa la ventana nativa del sistema. En el navegador, Alert.alert de React Native
// no hace nada, así que la app muestra su propia ventana con los mismos botones.
// Se usa igual que Alert.alert: Alert.alert(titulo, mensaje, [{ text, style, onPress }]).

import { useEffect, useState } from 'react';
import { Alert as AlertNativo, AlertButton, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { EN_COMPUTADORA } from './plataforma';
import { colores, espacio, radio, texto } from './tema';

export interface Dialogo {
  titulo: string;
  mensaje?: string;
  botones: AlertButton[];
}

type Oyente = (d: Dialogo) => void;
let oyente: Oyente | null = null;
const enEspera: Dialogo[] = [];

/** Normaliza los botones: sin botones, uno solo "Aceptar". */
export function prepararDialogo(titulo: string, mensaje?: string, botones?: AlertButton[]): Dialogo {
  return { titulo, mensaje, botones: botones && botones.length > 0 ? botones : [{ text: 'Aceptar' }] };
}

/** Botón que se usa al cerrar con Escape o tocando fuera: el de cancelar, o el único que haya. */
export function botonAlCerrar(d: Dialogo): AlertButton | null {
  return d.botones.find((b) => b.style === 'cancel') ?? (d.botones.length === 1 ? d.botones[0] : null);
}

export const Alert = {
  alert(titulo: string, mensaje?: string, botones?: AlertButton[]): void {
    if (!EN_COMPUTADORA) {
      AlertNativo.alert(titulo, mensaje, botones);
      return;
    }
    const d = prepararDialogo(titulo, mensaje, botones);
    if (oyente) oyente(d);
    else enEspera.push(d);
  },
};

/** Se coloca una vez en la raíz de la app. Muestra las ventanas en orden, una a la vez. */
export function AnfitrionDialogos() {
  const [cola, setCola] = useState<Dialogo[]>([]);

  useEffect(() => {
    if (!EN_COMPUTADORA) return;
    oyente = (d) => setCola((c) => [...c, d]);
    if (enEspera.length > 0) setCola((c) => [...c, ...enEspera.splice(0)]);
    return () => {
      oyente = null;
    };
  }, []);

  const actual = cola[0];
  if (!EN_COMPUTADORA || !actual) return null;

  function elegir(b: AlertButton | null) {
    setCola((c) => c.slice(1));
    // Después de cerrar, para que un nuevo aviso abierto desde el botón se muestre a continuación.
    if (b?.onPress) setTimeout(() => b.onPress?.(), 0);
  }

  const alCerrar = botonAlCerrar(actual);
  // Cancelar a la izquierda y la acción principal a la derecha, como en las ventanas de la computadora.
  const ordenados = [...actual.botones].sort((a, b) => Number(b.style === 'cancel') - Number(a.style === 'cancel'));

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => alCerrar && elegir(alCerrar)}>
      <Pressable style={s.fondo} onPress={() => alCerrar && elegir(alCerrar)}>
        {/* Pressable vacío: evita que un clic dentro de la ventana la cierre. */}
        <Pressable style={s.ventana} onPress={() => undefined} accessibilityRole="alert">
          <Text style={s.titulo}>{actual.titulo}</Text>
          {actual.mensaje ? <Text style={s.mensaje}>{actual.mensaje}</Text> : null}
          <View style={s.botones}>
            {ordenados.map((b, i) => {
              const cancelar = b.style === 'cancel';
              const peligro = b.style === 'destructive';
              return (
                <Pressable
                  key={`${i}-${b.text}`}
                  onPress={() => elegir(b)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    s.boton,
                    cancelar ? s.botonCancelar : peligro ? s.botonPeligro : s.botonPrincipal,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[s.botonTexto, cancelar && { color: colores.primario }]}>{b.text ?? 'Aceptar'}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(20, 35, 46, 0.45)', alignItems: 'center', justifyContent: 'center', padding: espacio.l },
  ventana: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colores.superficie,
    borderRadius: radio.l,
    padding: espacio.xl,
    gap: espacio.m,
  },
  titulo: { fontSize: texto.subtitulo, fontWeight: '700', color: colores.texto },
  mensaje: { fontSize: texto.normal, color: colores.texto, lineHeight: 22 },
  botones: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: espacio.s, marginTop: espacio.s },
  boton: { paddingVertical: 10, paddingHorizontal: espacio.l, borderRadius: radio.m, borderWidth: 1 },
  botonPrincipal: { backgroundColor: colores.primario, borderColor: colores.primario },
  botonPeligro: { backgroundColor: colores.peligro, borderColor: colores.peligro },
  botonCancelar: { backgroundColor: colores.superficie, borderColor: colores.borde },
  botonTexto: { fontSize: texto.normal, fontWeight: '600', color: '#FFFFFF' },
});
