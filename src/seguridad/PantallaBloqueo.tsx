// Pantalla que pide la clave (o Face ID en la app propia del teléfono). Tapa toda la app.

import { useSQLiteContext } from 'expo-sqlite';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { comprobarClave, esperaPendiente } from '../db/seguridad';
import { colores, espacio, radio, texto } from '../ui/tema';
import { biometriaDisponible, pedirBiometria } from './biometria';
import { LARGO_MAXIMO_CLAVE, textoEspera } from './clave';

export function PantallaBloqueo({ cargando, biometria, alAbrir }: { cargando: boolean; biometria: boolean; alAbrir: () => void }) {
  const db = useSQLiteContext();
  const [clave, setClave] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [esperaHasta, setEsperaHasta] = useState(0);
  const [ahora, setAhora] = useState(Date.now());
  const [conFaceId, setConFaceId] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  const entrada = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (cargando) return;
    void esperaPendiente(db).then((ms) => ms > 0 && setEsperaHasta(Date.now() + ms));
  }, [db, cargando]);

  // Face ID al aparecer (solo si está activado y disponible).
  useEffect(() => {
    if (cargando || !biometria) return;
    let vigente = true;
    void (async () => {
      const disponible = await biometriaDisponible();
      if (!vigente) return;
      setConFaceId(disponible);
      if (disponible && (await pedirBiometria()) && vigente) alAbrir();
    })();
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando, biometria]);

  // Cuenta regresiva mientras hay que esperar.
  useEffect(() => {
    if (esperaHasta <= Date.now()) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [esperaHasta]);

  const restante = Math.max(0, esperaHasta - ahora);

  async function intentar() {
    if (revisando || restante > 0 || clave.length === 0) return;
    setRevisando(true);
    const r = await comprobarClave(db, clave);
    setRevisando(false);
    setClave('');
    if (r.ok) {
      setMensaje(null);
      alAbrir();
      return;
    }
    if (r.esperarMs > 0) {
      setEsperaHasta(Date.now() + r.esperarMs);
      setAhora(Date.now());
      setMensaje(`Demasiados intentos (${r.fallos}). Por seguridad, espere antes de volver a intentar.`);
    } else {
      setMensaje(`Clave incorrecta.${r.fallos >= 3 ? ` Le quedan ${5 - r.fallos} intentos antes de tener que esperar.` : ''}`);
    }
    setTimeout(() => entrada.current?.focus(), 50);
  }

  return (
    <View style={s.fondo} accessibilityViewIsModal>
      {!cargando && (
        <View style={s.tarjeta}>
          <Text style={s.candado}>🔒</Text>
          <Text style={s.titulo}>PediaControl Pro</Text>
          <Text style={s.sub}>Escriba su clave para continuar</Text>
          <TextInput
            ref={entrada}
            value={clave}
            onChangeText={(v) => setClave(v.replace(/\D/g, '').slice(0, LARGO_MAXIMO_CLAVE))}
            onSubmitEditing={() => void intentar()}
            secureTextEntry
            keyboardType="number-pad"
            autoFocus={!biometria}
            editable={restante === 0 && !revisando}
            maxLength={LARGO_MAXIMO_CLAVE}
            style={s.entrada}
            accessibilityLabel="Clave de acceso"
            placeholder="••••"
            placeholderTextColor={colores.borde}
            autoComplete="off"
            textContentType="none"
          />
          {mensaje && <Text style={s.error}>{mensaje}</Text>}
          {restante > 0 && <Text style={s.error}>Puede intentar de nuevo en {textoEspera(restante)}.</Text>}
          <Pressable
            onPress={() => void intentar()}
            disabled={restante > 0 || revisando || clave.length === 0}
            style={({ pressed }) => [s.boton, (restante > 0 || revisando || clave.length === 0) && { opacity: 0.5 }, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
          >
            <Text style={s.botonTexto}>{revisando ? 'Revisando…' : 'Entrar'}</Text>
          </Pressable>
          {conFaceId && (
            <Pressable onPress={() => void pedirBiometria().then((ok) => ok && alAbrir())} style={s.enlace} accessibilityRole="button">
              <Text style={s.enlaceTexto}>Usar Face ID</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setAyuda((v) => !v)} style={s.enlace} accessibilityRole="button">
            <Text style={s.enlaceTexto}>¿Olvidó la clave?</Text>
          </Pressable>
          {ayuda && (
            <Text style={s.ayuda}>
              Por seguridad, no hay forma de saltarse la clave. Si la olvidó, hay que borrar la app de este equipo y recuperar los datos
              con la sincronización o con su respaldo: en la computadora, borre los datos de este sitio en la configuración de Chrome
              (Privacidad → Datos de sitios); en el teléfono, borre la app y vuelva a instalarla. Lo que no se haya sincronizado ni
              respaldado se pierde.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  fondo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colores.fondo,
    alignItems: 'center',
    justifyContent: 'center',
    padding: espacio.l,
    zIndex: 1000,
  },
  tarjeta: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colores.superficie,
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: espacio.xl,
    alignItems: 'center',
    gap: espacio.s,
  },
  candado: { fontSize: 36 },
  titulo: { fontSize: texto.titulo, fontWeight: '700', color: colores.texto },
  sub: { fontSize: texto.normal, color: colores.textoSuave, marginBottom: espacio.s },
  entrada: {
    width: 200,
    textAlign: 'center',
    fontSize: 28,
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radio.m,
    paddingVertical: espacio.s,
    color: colores.texto,
    backgroundColor: colores.fondo,
  },
  error: { color: colores.peligro, fontSize: texto.pequeno, textAlign: 'center' },
  boton: { marginTop: espacio.s, backgroundColor: colores.primario, borderRadius: radio.m, paddingVertical: 12, paddingHorizontal: 48 },
  botonTexto: { color: '#FFFFFF', fontSize: texto.normal, fontWeight: '700' },
  enlace: { paddingVertical: 6 },
  enlaceTexto: { color: colores.primario, fontSize: texto.pequeno, fontWeight: '600' },
  ayuda: { fontSize: texto.pequeno, color: colores.texto, lineHeight: 20, textAlign: 'left' },
});
