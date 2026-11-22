// Clave de acceso y bloqueo automático de ESTE equipo.

import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { comprobarClave, guardarClave, guardarOpcionesBloqueo, quitarClave } from '../src/db/seguridad';
import { useBloqueo } from '../src/seguridad/BloqueoProvider';
import { biometriaDisponible } from '../src/seguridad/biometria';
import { OPCIONES_MINUTOS, textoEspera, validarClaveNueva } from '../src/seguridad/clave';
import { Aviso, Boton, Campo, Cargando, Interruptor, PantallaFormulario, Seccion, Selector, estilos } from '../src/ui/componentes';
import { Alert } from '../src/ui/dialogo';
import { espacio } from '../src/ui/tema';

function soloNumeros(v: string) {
  return v.replace(/\D/g, '').slice(0, 8);
}

export default function Seguridad() {
  const db = useSQLiteContext();
  const { ajustes, recargar, bloquearAhora } = useBloqueo();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [hayFaceId, setHayFaceId] = useState(false);

  useEffect(() => {
    void biometriaDisponible().then(setHayFaceId);
  }, []);

  if (!ajustes) return <Cargando />;
  const conClave = !!ajustes.clave;

  function limpiar() {
    setActual('');
    setNueva('');
    setRepetida('');
  }

  /** Revisa la clave actual (cuenta como intento: también se espera tras varios errores). */
  async function claveActualBien(): Promise<boolean> {
    const r = await comprobarClave(db, actual);
    if (r.ok) return true;
    Alert.alert('Clave actual', r.esperarMs > 0 ? `Clave incorrecta. Espere ${textoEspera(r.esperarMs)} para volver a intentar.` : 'La clave actual no es correcta.');
    return false;
  }

  async function activarOCambiar() {
    const error = validarClaveNueva(nueva, repetida);
    if (error) {
      Alert.alert('Clave', error);
      return;
    }
    setTrabajando(true);
    try {
      if (conClave && !(await claveActualBien())) return;
      await guardarClave(db, nueva);
      await recargar();
      limpiar();
      Alert.alert(
        conClave ? 'Clave cambiada' : 'Clave activada',
        'Anótela en un lugar seguro: si la olvida, hay que borrar la app de este equipo y recuperar los datos con la sincronización o el respaldo.',
      );
    } finally {
      setTrabajando(false);
    }
  }

  async function quitar() {
    setTrabajando(true);
    try {
      if (!(await claveActualBien())) return;
      await quitarClave(db);
      await recargar();
      limpiar();
      Alert.alert('Clave quitada', 'La app ya no pide clave en este equipo.');
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <PantallaFormulario>
      <Seccion titulo="Clave de acceso">
        {conClave ? (
          <Text style={[estilos.normal, { fontWeight: '700', marginBottom: espacio.s }]}>✓ La app pide clave en este equipo.</Text>
        ) : (
          <Aviso>Sin clave: cualquiera que tome este equipo con la app abierta puede ver los expedientes y hacer constancias con su firma.</Aviso>
        )}
        <Text style={[estilos.pequeno, { marginBottom: espacio.m }]}>
          La clave es solo de este equipo (el teléfono y la computadora tienen cada uno la suya). Se pide al abrir la app y después de
          unos minutos sin usarla. Lo que esté escribiendo no se pierde al bloquearse.
        </Text>
        {conClave && (
          <Campo etiqueta="Clave actual" value={actual} onChangeText={(v) => setActual(soloNumeros(v))} secureTextEntry keyboardType="number-pad" />
        )}
        <Campo
          etiqueta={conClave ? 'Clave nueva' : 'Clave (4 a 8 números)'}
          value={nueva}
          onChangeText={(v) => setNueva(soloNumeros(v))}
          secureTextEntry
          keyboardType="number-pad"
        />
        <Campo etiqueta="Repita la clave" value={repetida} onChangeText={(v) => setRepetida(soloNumeros(v))} secureTextEntry keyboardType="number-pad" />
        <Boton texto={conClave ? 'Cambiar clave' : 'Activar clave'} onPress={() => void activarOCambiar()} deshabilitado={trabajando} />
        {conClave && <Boton texto="Quitar clave" variante="peligro" onPress={() => void quitar()} deshabilitado={trabajando || !actual} />}
      </Seccion>

      {conClave && (
        <Seccion titulo="Bloqueo automático">
          <Selector
            etiqueta="Bloquear después de estos minutos sin usar la app"
            opciones={OPCIONES_MINUTOS.map((m) => ({ valor: String(m), texto: `${m} min` }))}
            valor={String(ajustes.minutos)}
            alCambiar={(v) => void guardarOpcionesBloqueo(db, { minutos: Number(v) }).then(recargar)}
          />
          {hayFaceId && (
            <Interruptor
              etiqueta="Abrir con Face ID"
              valor={ajustes.biometria}
              alCambiar={(v) => void guardarOpcionesBloqueo(db, { biometria: v }).then(recargar)}
            />
          )}
          {!hayFaceId && (
            <Text style={estilos.suave}>Face ID estará disponible en la app propia del teléfono (TestFlight / App Store).</Text>
          )}
          <Boton texto="Bloquear ahora" variante="secundario" onPress={bloquearAhora} />
        </Seccion>
      )}
    </PantallaFormulario>
  );
}
