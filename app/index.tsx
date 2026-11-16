// Panel principal: el día de hoy de un vistazo y accesos rápidos.

import { Href, router, Stack, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ahoraMomento, fechaDeMomento, hoyISO, sumarDias, textoFechaLarga } from '../src/agenda/tiempo';
import { Cita, esActiva, nombreCita } from '../src/agenda/tipos';
import { citasEntre, citasPorEstado } from '../src/db/agenda';
import { buscarPacientes, ResumenPaciente } from '../src/db/pacientes';
import { edadDesdeISO } from '../src/domain/fechas';
import { FilaCita } from '../src/ui/agenda';
import { Aviso, PantallaSimple, Seccion, estilos } from '../src/ui/componentes';
import { colores, espacio, radio, texto } from '../src/ui/tema';

interface Datos {
  hoy: Cita[];
  proxima: Cita | null;
  pendientes: Cita[];
  canceladas: Cita[];
}

const ACCESOS: { texto: string; icono: string; ruta: Href }[] = [
  { texto: 'Agenda', icono: '📅', ruta: '/agenda' },
  { texto: 'Pacientes', icono: '🗂️', ruta: '/pacientes' },
  { texto: 'Nueva cita', icono: '＋', ruta: '/agenda/nueva' },
  { texto: 'Nuevo paciente', icono: '👶', ruta: '/pacientes/nuevo' },
  { texto: 'Registrar consulta', icono: '🩺', ruta: { pathname: '/pacientes', params: { seleccionar: 'consulta' } } },
  { texto: 'Horario y ajustes', icono: '⚙️', ruta: '/configuracion' },
];

export default function Panel() {
  const db = useSQLiteContext();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [encontrados, setEncontrados] = useState<ResumenPaciente[]>([]);
  const hoy = hoyISO();

  useFocusEffect(
    useCallback(() => {
      let activo = true;
      void (async () => {
        const ahora = ahoraMomento();
        const dia = hoyISO();
        const en30 = `${sumarDias(dia, 30)}T00:00`;
        const [citasHoy, proximas, pendientes, canceladas] = await Promise.all([
          citasEntre(db, `${dia}T00:00`, `${sumarDias(dia, 1)}T00:00`),
          citasPorEstado(db, ['solicitada', 'pendiente', 'confirmada'], ahora, en30, 1),
          citasPorEstado(db, ['solicitada', 'pendiente'], ahora, en30, 10),
          citasPorEstado(db, ['cancelada'], `${dia}T00:00`, `${sumarDias(dia, 8)}T00:00`, 10),
        ]);
        if (activo) setDatos({ hoy: citasHoy, proxima: proximas[0] ?? null, pendientes, canceladas });
      })();
      return () => {
        activo = false;
      };
    }, [db]),
  );

  async function buscar(t: string) {
    setBusqueda(t);
    setEncontrados(t.trim().length >= 2 ? await buscarPacientes(db, t, 5) : []);
  }

  const abrirCita = (c: Cita) => router.push({ pathname: '/agenda/[id]', params: { id: c.id } });
  const citasHoy = datos?.hoy ?? [];
  const activasHoy = citasHoy.filter((c) => esActiva(c.estado));
  const enEspera = citasHoy.filter((c) => c.estado === 'presente');
  const personasHoy = new Set(activasHoy.map((c) => c.pacienteId ?? `contacto:${nombreCita(c)}`)).size;
  const resumen = [
    { texto: 'Pacientes programados', valor: personasHoy },
    { texto: 'Confirmadas', valor: citasHoy.filter((c) => c.estado === 'confirmada').length },
    { texto: 'Por confirmar', valor: citasHoy.filter((c) => c.estado === 'solicitada' || c.estado === 'pendiente').length },
    { texto: 'Atendidas', valor: citasHoy.filter((c) => c.estado === 'completada').length },
    { texto: 'Canceladas / no asistió', valor: citasHoy.length - activasHoy.length },
  ];

  return (
    <PantallaSimple>
      <Stack.Screen options={{ title: 'PediaControl Pro' }} />
      <Text style={s.fecha}>Hoy, {textoFechaLarga(hoy, false)}</Text>

      <Aviso>Versión de desarrollo: use solo pacientes ficticios. Los datos se guardan únicamente en este teléfono.</Aviso>

      <View style={s.accesos}>
        {ACCESOS.map((a) => (
          <Pressable
            key={a.texto}
            onPress={() => router.push(a.ruta)}
            accessibilityRole="button"
            style={({ pressed }) => [s.acceso, pressed && { opacity: 0.7 }]}
          >
            <Text style={s.accesoIcono}>{a.icono}</Text>
            <Text style={s.accesoTexto}>{a.texto}</Text>
          </Pressable>
        ))}
      </View>

      <View style={s.buscadorCaja}>
        <TextInput
          style={s.buscador}
          value={busqueda}
          onChangeText={buscar}
          placeholder="Abrir expediente: nombre, expediente o teléfono"
          placeholderTextColor="#98A6B0"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {encontrados.map((p) => (
          <Pressable
            key={p.id}
            style={({ pressed }) => [s.encontrado, pressed && { opacity: 0.7 }]}
            onPress={() => {
              setBusqueda('');
              setEncontrados([]);
              router.push({ pathname: '/pacientes/[id]', params: { id: p.id } });
            }}
          >
            <Text style={estilos.normal}>
              {p.apellidos}, {p.nombres}
            </Text>
            <Text style={estilos.suave}>
              {p.numeroExpediente} · {edadDesdeISO(p.fechaNacimiento)}
            </Text>
          </Pressable>
        ))}
        {busqueda.trim().length >= 2 && encontrados.length === 0 && (
          <Text style={[estilos.suave, { padding: espacio.s }]}>Sin resultados.</Text>
        )}
      </View>

      <View style={s.resumen}>
        {resumen.map((r) => (
          <View key={r.texto} style={s.resumenItem}>
            <Text style={s.resumenValor}>{r.valor}</Text>
            <Text style={s.resumenTexto}>{r.texto}</Text>
          </View>
        ))}
      </View>

      {enEspera.length > 0 && (
        <Seccion titulo={`En sala de espera (${enEspera.length})`}>
          {enEspera.map((c) => (
            <FilaCita key={c.id} cita={c} onPress={() => abrirCita(c)} />
          ))}
        </Seccion>
      )}

      <Seccion titulo="Próxima cita">
        {datos?.proxima ? (
          <FilaCita cita={datos.proxima} onPress={() => abrirCita(datos.proxima as Cita)} conFecha={fechaDeMomento(datos.proxima.inicio) !== hoy} />
        ) : (
          <Text style={estilos.suave}>No hay citas próximas en los siguientes 30 días.</Text>
        )}
      </Seccion>

      <Seccion titulo={`Citas de hoy (${citasHoy.length})`}>
        {citasHoy.length === 0 ? (
          <Text style={estilos.suave}>No hay citas para hoy.</Text>
        ) : (
          citasHoy.map((c) => <FilaCita key={c.id} cita={c} onPress={() => abrirCita(c)} />)
        )}
      </Seccion>

      <Seccion titulo={`Pendientes de confirmación (${datos?.pendientes.length ?? 0})`}>
        {(datos?.pendientes.length ?? 0) === 0 ? (
          <Text style={estilos.suave}>Ninguna cita por confirmar.</Text>
        ) : (
          datos?.pendientes.map((c) => <FilaCita key={c.id} cita={c} onPress={() => abrirCita(c)} conFecha />)
        )}
      </Seccion>

      <Seccion titulo="Canceladas (hoy y próximos 7 días)">
        {(datos?.canceladas.length ?? 0) === 0 ? (
          <Text style={estilos.suave}>Sin cancelaciones.</Text>
        ) : (
          datos?.canceladas.map((c) => <FilaCita key={c.id} cita={c} onPress={() => abrirCita(c)} conFecha />)
        )}
      </Seccion>
    </PantallaSimple>
  );
}

const s = StyleSheet.create({
  fecha: { fontSize: texto.titulo, fontWeight: '800', color: colores.texto, marginBottom: espacio.m },
  accesos: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, marginBottom: espacio.m },
  acceso: {
    width: '48.5%',
    backgroundColor: colores.superficie,
    borderRadius: radio.m,
    borderWidth: 1,
    borderColor: colores.borde,
    paddingVertical: espacio.m,
    paddingHorizontal: espacio.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
  },
  accesoIcono: { fontSize: 20, color: colores.primario, fontWeight: '800' },
  accesoTexto: { fontSize: texto.pequeno, fontWeight: '700', color: colores.texto, flexShrink: 1 },
  buscadorCaja: { marginBottom: espacio.l },
  buscador: {
    backgroundColor: colores.superficie,
    borderRadius: radio.m,
    borderWidth: 1,
    borderColor: colores.borde,
    paddingHorizontal: espacio.m,
    paddingVertical: 12,
    fontSize: texto.normal,
    color: colores.texto,
  },
  encontrado: {
    backgroundColor: colores.superficie,
    paddingHorizontal: espacio.m,
    paddingVertical: espacio.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.borde,
  },
  resumen: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, marginBottom: espacio.l },
  resumenItem: {
    flexGrow: 1,
    minWidth: '30%',
    backgroundColor: colores.primarioSuave,
    borderRadius: radio.m,
    padding: espacio.m,
  },
  resumenValor: { fontSize: 24, fontWeight: '800', color: colores.primarioOscuro, fontVariant: ['tabular-nums'] },
  resumenTexto: { fontSize: texto.mini, fontWeight: '600', color: colores.primarioOscuro },
});
