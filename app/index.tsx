// Panel principal: el día de hoy de un vistazo y accesos rápidos.

import { Href, router, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffectConSync } from '../src/sincronizacion/eventos';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ahoraMomento, fechaDeMomento, hoyISO, sumarDias, textoFechaLarga } from '../src/agenda/tiempo';
import { Cita, esActiva, nombreCita } from '../src/agenda/tipos';
import { citasEntre, citasPorEstado } from '../src/db/agenda';
import { buscarPacientes, ResumenPaciente } from '../src/db/pacientes';
import { contarControlesPendientes } from '../src/db/seguimiento';
import { resumenCumpleanosHoy } from '../src/db/cumpleanos';
import { diasDesde, leerInfoRespaldo, resumenActual } from '../src/db/respaldo';
import { edadDesdeISO } from '../src/domain/fechas';
import { FilaCita } from '../src/ui/agenda';
import { Aviso, PantallaSimple, Seccion, estilos } from '../src/ui/componentes';
import { colores, espacio, radio, texto } from '../src/ui/tema';
import { IndicadorSync } from '../src/sincronizacion/IndicadorSync';
import { textoDinero } from '../src/caja/dinero';
import { diasSinCerrar, leerAjustesCaja, totalDeHoy } from '../src/db/caja';

interface Datos {
  hoy: Cita[];
  proxima: Cita | null;
  pendientes: Cita[];
  canceladas: Cita[];
  controles: number;
  citasManana: number;
  /** Días desde el último respaldo (null: nunca); solo si hay pacientes. */
  diasRespaldo: number | null;
  hayPacientes: boolean;
  caja: { totalCentavos: number; cantidad: number; moneda: string; sinCerrar: string[] };
  cumpleanos: { hoy: number; porFelicitar: number };
}

const ACCESOS: { texto: string; icono: string; ruta: Href }[] = [
  { texto: 'Agenda', icono: '📅', ruta: '/agenda' },
  { texto: 'Pacientes', icono: '🗂️', ruta: '/pacientes' },
  { texto: 'Nueva cita', icono: '＋', ruta: '/agenda/nueva' },
  { texto: 'Nuevo paciente', icono: '👶', ruta: '/pacientes/nuevo' },
  { texto: 'Registrar consulta', icono: '🩺', ruta: { pathname: '/pacientes', params: { seleccionar: 'consulta' } } },
  { texto: 'Caja del día', icono: '💵', ruta: '/caja' },
  { texto: 'Horario y ajustes', icono: '⚙️', ruta: '/configuracion' },
  { texto: 'Respaldo', icono: '💾', ruta: '/respaldo' },
  { texto: 'Sincronización', icono: '☁️', ruta: '/sincronizacion' },
  { texto: 'Controles y WhatsApp', icono: '💬', ruta: '/controles' },
  { texto: 'Cumpleaños', icono: '🎂', ruta: '/cumpleanos' },
];

export default function Panel() {
  const db = useSQLiteContext();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [encontrados, setEncontrados] = useState<ResumenPaciente[]>([]);
  const hoy = hoyISO();

  useFocusEffectConSync(
    useCallback(() => {
      let activo = true;
      void (async () => {
        const ahora = ahoraMomento();
        const dia = hoyISO();
        const en30 = `${sumarDias(dia, 30)}T00:00`;
        const [citasHoy, proximas, pendientes, canceladas, controles, manana, respaldo, totales] = await Promise.all([
          citasEntre(db, `${dia}T00:00`, `${sumarDias(dia, 1)}T00:00`),
          citasPorEstado(db, ['solicitada', 'pendiente', 'confirmada'], ahora, en30, 1),
          citasPorEstado(db, ['solicitada', 'pendiente'], ahora, en30, 10),
          citasPorEstado(db, ['cancelada'], `${dia}T00:00`, `${sumarDias(dia, 8)}T00:00`, 10),
          contarControlesPendientes(db, dia),
          citasPorEstado(db, ['solicitada', 'pendiente', 'confirmada'], `${sumarDias(dia, 1)}T00:00`, `${sumarDias(dia, 2)}T00:00`, 200),
          leerInfoRespaldo(db),
          resumenActual(db),
        ]);
        const [hoyCaja, ajustesCaja, sinCerrar, cumpleanos] = await Promise.all([
          totalDeHoy(db),
          leerAjustesCaja(db),
          diasSinCerrar(db),
          resumenCumpleanosHoy(db, dia),
        ]);
        if (activo) {
          setDatos({
            hoy: citasHoy,
            proxima: proximas[0] ?? null,
            pendientes,
            canceladas,
            controles,
            citasManana: manana.length,
            diasRespaldo: diasDesde(respaldo.ultimo),
            hayPacientes: totales.pacientes > 0,
            caja: { ...hoyCaja, moneda: ajustesCaja.moneda, sinCerrar },
            cumpleanos,
          });
        }
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

      <Aviso>Versión de desarrollo: use solo pacientes ficticios.</Aviso>

      <IndicadorSync />

      {datos?.hayPacientes && (datos.diasRespaldo === null || datos.diasRespaldo > 7) && (
        <Pressable onPress={() => router.push('/respaldo')} style={({ pressed }) => [s.avisoRespaldo, pressed && { opacity: 0.8 }]}>
          <Text style={s.avisoRespaldoTexto}>
            💾 {datos.diasRespaldo === null ? 'Todavía no hay respaldo de los expedientes.' : `Último respaldo hace ${datos.diasRespaldo} días.`}{' '}
            Toque aquí para hacer uno.
          </Text>
        </Pressable>
      )}

      <Pressable
        onPress={() => router.push('/controles')}
        accessibilityRole="button"
        style={({ pressed }) => [s.tarjetaControles, pressed && { opacity: 0.8 }]}
      >
        <Text style={s.tarjetaTitulo}>📋 Controles y recordatorios</Text>
        <Text style={s.tarjetaTexto}>
          {datos?.controles ?? 0} {datos?.controles === 1 ? 'paciente necesita' : 'pacientes necesitan'} cita de control ·{' '}
          {datos?.citasManana ?? 0} {datos?.citasManana === 1 ? 'cita' : 'citas'} mañana por recordar
        </Text>
        <Text style={s.tarjetaAccion}>Ver lista y enviar WhatsApp ›</Text>
      </Pressable>

      {datos && datos.cumpleanos.hoy > 0 && (
        <Pressable
          onPress={() => router.push('/cumpleanos')}
          accessibilityRole="button"
          style={({ pressed }) => [s.tarjetaCaja, pressed && { opacity: 0.8 }]}
        >
          <Text style={s.cajaTexto}>
            🎂 Hoy {datos.cumpleanos.hoy === 1 ? 'cumple años 1 paciente' : `cumplen años ${datos.cumpleanos.hoy} pacientes`}
            {datos.cumpleanos.porFelicitar > 0 ? ` · ${datos.cumpleanos.porFelicitar} por felicitar` : ' · todos felicitados'} ›
          </Text>
        </Pressable>
      )}

      {datos && (
        <Pressable
          onPress={() => router.push(datos.caja.sinCerrar.length > 0 ? { pathname: '/caja', params: { dia: datos.caja.sinCerrar[datos.caja.sinCerrar.length - 1] } } : '/caja')}
          accessibilityRole="button"
          style={({ pressed }) => [s.tarjetaCaja, datos.caja.sinCerrar.length > 0 && s.tarjetaCajaAviso, pressed && { opacity: 0.8 }]}
        >
          <Text style={s.cajaTexto}>
            💵 Caja de hoy: <Text style={{ fontWeight: '800' }}>{textoDinero(datos.caja.totalCentavos, datos.caja.moneda)}</Text> ·{' '}
            {datos.caja.cantidad} {datos.caja.cantidad === 1 ? 'cobro' : 'cobros'} ›
          </Text>
          {datos.caja.sinCerrar.length > 0 && (
            <Text style={[s.cajaTexto, { color: colores.aviso, fontWeight: '700' }]}>
              {datos.caja.sinCerrar.length === 1 ? 'Hay 1 día anterior sin cerrar.' : `Hay ${datos.caja.sinCerrar.length} días anteriores sin cerrar.`} Toque para
              revisarlo.
            </Text>
          )}
        </Pressable>
      )}

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
  avisoRespaldo: {
    backgroundColor: colores.peligroSuave,
    borderColor: colores.peligro,
    borderWidth: 1,
    borderRadius: radio.m,
    padding: espacio.m,
    marginBottom: espacio.m,
  },
  avisoRespaldoTexto: { color: colores.peligro, fontWeight: '700', fontSize: texto.pequeno },
  tarjetaCaja: {
    backgroundColor: colores.superficie,
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: espacio.m,
    marginBottom: espacio.l,
    gap: 4,
  },
  tarjetaCajaAviso: { backgroundColor: colores.avisoSuave, borderColor: colores.aviso },
  cajaTexto: { fontSize: texto.normal, color: colores.texto },
  tarjetaControles: {
    backgroundColor: colores.primario,
    borderRadius: radio.l,
    padding: espacio.l,
    marginBottom: espacio.m,
    gap: 4,
  },
  tarjetaTitulo: { color: '#FFFFFF', fontSize: texto.subtitulo, fontWeight: '800' },
  tarjetaTexto: { color: '#FFFFFF', fontSize: texto.pequeno },
  tarjetaAccion: { color: '#FFFFFF', fontSize: texto.pequeno, fontWeight: '800', marginTop: 4 },
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
