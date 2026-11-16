// Lista y búsqueda de pacientes.
// Con ?seleccionar=consulta sirve para elegir a quién registrarle una consulta.

import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert } from '../../src/ui/dialogo';
import { borrarPacientesDemo, buscarPacientes, ResumenPaciente } from '../../src/db/pacientes';
import { cargarPacientesDemo } from '../../src/db/demo';
import { edadDesdeISO, textoFechaHora } from '../../src/domain/fechas';
import { Aviso, Boton, EnlaceTexto, estilos } from '../../src/ui/componentes';
import { ANCHO_MAXIMO, colores, espacio, radio, texto } from '../../src/ui/tema';
import { ESTE_EQUIPO } from '../../src/ui/plataforma';

export default function Pacientes() {
  const { seleccionar } = useLocalSearchParams<{ seleccionar?: string }>();
  const paraConsulta = seleccionar === 'consulta';
  const db = useSQLiteContext();
  const [busqueda, setBusqueda] = useState('');
  const [pacientes, setPacientes] = useState<ResumenPaciente[]>([]);
  const [cargado, setCargado] = useState(false);

  const cargar = useCallback(
    async (texto: string) => {
      setPacientes(await buscarPacientes(db, texto));
      setCargado(true);
    },
    [db],
  );

  // Recargar cada vez que se vuelve a esta pantalla (por ejemplo, después de crear un paciente).
  useFocusEffect(
    useCallback(() => {
      void cargar(busqueda);
    }, [cargar, busqueda]),
  );

  async function agregarDemo() {
    try {
      await cargarPacientesDemo(db);
      await cargar(busqueda);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    }
  }

  function quitarDemo() {
    Alert.alert('Borrar pacientes de demostración', 'Se borrarán solo los pacientes ficticios marcados como DEMO.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await borrarPacientesDemo(db);
          await cargar(busqueda);
        },
      },
    ]);
  }

  const hayDemo = pacientes.some((p) => p.esDemo);

  return (
    <View style={estilos.pantalla}>
      {paraConsulta && <Stack.Screen options={{ title: 'Elegir paciente' }} />}
      <View style={s.barraBusqueda}>
        <TextInput
          style={s.buscador}
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar por nombre, expediente o teléfono"
          placeholderTextColor="#98A6B0"
          clearButtonMode="while-editing"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={pacientes}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[estilos.contenido, { paddingBottom: 120 }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          paraConsulta ? (
            <Text style={[estilos.suave, { marginBottom: espacio.m }]}>Toque el paciente al que le registrará la consulta.</Text>
          ) : (
          <Aviso>
            Versión de desarrollo: use solo pacientes ficticios. Los datos se guardan únicamente en {ESTE_EQUIPO.toLowerCase()}; haga
            respaldos con frecuencia.
          </Aviso>
          )
        }
        ListEmptyComponent={
          cargado && !paraConsulta ? (
            <View style={s.vacio}>
              <Text style={[estilos.normal, { textAlign: 'center' }]}>
                {busqueda ? 'No se encontraron pacientes.' : 'Todavía no hay pacientes registrados.'}
              </Text>
              {!busqueda && <Boton texto="Cargar pacientes de demostración" variante="secundario" onPress={agregarDemo} />}
            </View>
          ) : null
        }
        ListFooterComponent={
          busqueda || paraConsulta || pacientes.length === 0 ? null : (
            <View style={{ gap: espacio.m, marginTop: espacio.s }}>
              {hayDemo ? (
                <EnlaceTexto texto="Borrar pacientes de demostración" onPress={quitarDemo} />
              ) : (
                <EnlaceTexto texto="Cargar pacientes y citas de demostración" onPress={agregarDemo} />
              )}
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [s.tarjeta, pressed && { opacity: 0.7 }]}
            onPress={() =>
              paraConsulta
                ? router.replace({ pathname: '/pacientes/[id]/consulta-nueva', params: { id: item.id } })
                : router.push({ pathname: '/pacientes/[id]', params: { id: item.id } })
            }
          >
            <View style={[s.avatar, { backgroundColor: item.sexo === 'F' ? colores.ninia : colores.ninio }]}>
              <Text style={s.avatarTexto}>
                {item.nombres.charAt(0)}
                {item.apellidos.charAt(0)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.nombre} numberOfLines={1}>
                {item.apellidos}, {item.nombres}
              </Text>
              <Text style={estilos.suave}>
                {item.numeroExpediente} · {edadDesdeISO(item.fechaNacimiento)}
                {item.esDemo ? ' · DEMO' : ''}
              </Text>
              <Text style={[estilos.suave, { fontSize: texto.mini }]}>
                {item.ultimaConsulta ? `Última consulta: ${textoFechaHora(item.ultimaConsulta)}` : 'Sin consultas'}
              </Text>
            </View>
          </Pressable>
        )}
      />

      {!paraConsulta && (
      <Pressable style={s.botonFlotante} onPress={() => router.push('/pacientes/nuevo')} accessibilityLabel="Nuevo paciente">
        <Text style={s.botonFlotanteTexto}>＋ Nuevo paciente</Text>
      </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  barraBusqueda: {
    padding: espacio.m,
    backgroundColor: colores.superficie,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.borde,
  },
  buscador: {
    width: '100%',
    maxWidth: ANCHO_MAXIMO - 2 * espacio.l,
    alignSelf: 'center',
    backgroundColor: colores.fondo,
    borderRadius: radio.m,
    paddingHorizontal: espacio.m,
    paddingVertical: 10,
    fontSize: texto.normal,
    color: colores.texto,
  },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    backgroundColor: colores.superficie,
    padding: espacio.m,
    borderRadius: radio.m,
    marginBottom: espacio.s,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { color: '#FFFFFF', fontWeight: '700', fontSize: texto.normal },
  nombre: { fontSize: texto.normal, fontWeight: '700', color: colores.texto },
  vacio: { paddingVertical: 32, gap: espacio.m },
  botonFlotante: {
    position: 'absolute',
    right: espacio.l,
    bottom: 32,
    backgroundColor: colores.primario,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  botonFlotanteTexto: { color: '#FFFFFF', fontWeight: '700', fontSize: texto.normal },
});
