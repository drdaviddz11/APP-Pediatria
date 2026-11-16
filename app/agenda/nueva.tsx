// Nueva cita, o edición/reprogramación de una existente (?citaId=…).
// Parámetros opcionales: fecha (AAAA-MM-DD), pacienteId, tipo (primera | control).

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { dentroDeHorario, horariosDisponibles, Intervalo, textoHorarioDia } from '../../src/agenda/disponibilidad';
import {
  ahoraMomento,
  fechaDeMomento,
  horaDeMomento,
  hoyISO,
  leerHoraUsuario,
  minutosEntre,
  momento,
  sumarDias,
  sumarMinutos,
  textoFechaLarga,
} from '../../src/agenda/tiempo';
import {
  Cita,
  CONFIG_PREDETERMINADA,
  ConfiguracionAgenda,
  duracionDeTipo,
  EstadoCita,
  esActiva,
  NOMBRE_ESTADO,
  TipoCita,
} from '../../src/agenda/tipos';
import { actualizarCita, bloqueosEntre, citasEntre, crearCita, leerConfiguracion, obtenerCita } from '../../src/db/agenda';
import { buscarPacientes, obtenerPaciente, ResumenPaciente } from '../../src/db/pacientes';
import { aISO, aTextoUsuario, edadDesdeISO, leerFechaISO, leerFechaUsuario } from '../../src/domain/fechas';
import { BotonFlecha, Pastilla } from '../../src/ui/agenda';
import { Boton, Campo, Cargando, EnlaceTexto, PantallaFormulario, Seccion, Selector, estilos } from '../../src/ui/componentes';
import { colores, espacio, radio, texto } from '../../src/ui/tema';

interface PacienteElegido {
  id: string;
  nombre: string;
  detalle: string;
}

export default function NuevaCita() {
  const params = useLocalSearchParams<{ fecha?: string; pacienteId?: string; citaId?: string; tipo?: TipoCita }>();
  const db = useSQLiteContext();
  const editando = Boolean(params.citaId);

  const [listo, setListo] = useState(false);
  const [config, setConfig] = useState<ConfiguracionAgenda>(CONFIG_PREDETERMINADA);
  const [original, setOriginal] = useState<Cita | null>(null);

  const [modo, setModo] = useState<'expediente' | 'nuevo'>('expediente');
  const [paciente, setPaciente] = useState<PacienteElegido | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<ResumenPaciente[]>([]);
  const [nombreContacto, setNombreContacto] = useState('');
  const [telefonoContacto, setTelefonoContacto] = useState('');

  const [tipo, setTipo] = useState<TipoCita>(params.tipo ?? (params.pacienteId ? 'control' : 'primera'));
  const [duracion, setDuracion] = useState('');
  const [fecha, setFecha] = useState(leerFechaISO(params.fecha) ? (params.fecha as string) : hoyISO());
  const [fechaTexto, setFechaTexto] = useState('');
  const [hora, setHora] = useState('');
  const [horaManual, setHoraManual] = useState('');
  const [motivo, setMotivo] = useState('');
  const [notas, setNotas] = useState('');
  const [estado, setEstado] = useState<EstadoCita>('pendiente');
  const [ocupados, setOcupados] = useState<Intervalo[]>([]);
  const [guardando, setGuardando] = useState(false);

  // Carga inicial: configuración, cita a editar o paciente indicado.
  useEffect(() => {
    void (async () => {
      const cfg = await leerConfiguracion(db);
      setConfig(cfg);
      let dur = duracionDeTipo(cfg, params.tipo ?? (params.pacienteId ? 'control' : 'primera'));
      if (params.citaId) {
        const c = await obtenerCita(db, params.citaId);
        if (c) {
          setOriginal(c);
          setTipo(c.tipo);
          dur = minutosEntre(c.inicio, c.fin);
          setFecha(fechaDeMomento(c.inicio));
          setHora(horaDeMomento(c.inicio));
          setMotivo(c.motivo);
          setNotas(c.notas);
          setEstado(c.estado);
          if (c.pacienteId) {
            setPaciente({ id: c.pacienteId, nombre: c.pacienteNombre ?? '', detalle: c.numeroExpediente ?? '' });
          } else {
            setModo('nuevo');
            setNombreContacto(c.nombreContacto);
            setTelefonoContacto(c.telefonoContacto);
          }
        }
      } else if (params.pacienteId) {
        const p = await obtenerPaciente(db, params.pacienteId);
        if (p) setPaciente({ id: p.id, nombre: `${p.nombres} ${p.apellidos}`, detalle: `${p.numeroExpediente} · ${edadDesdeISO(p.fechaNacimiento)}` });
      }
      setDuracion(String(dur));
      setListo(true);
    })();
  }, [db, params.citaId, params.pacienteId, params.tipo]);

  // Horarios ocupados del día elegido (sin contar la cita que se edita).
  useEffect(() => {
    setFechaTexto(aTextoUsuario(leerFechaISO(fecha) ?? { anio: 2000, mes: 1, dia: 1 }));
    let activo = true;
    void (async () => {
      const [c, b] = await Promise.all([
        citasEntre(db, `${fecha}T00:00`, `${sumarDias(fecha, 1)}T00:00`),
        bloqueosEntre(db, `${fecha}T00:00`, `${sumarDias(fecha, 1)}T00:00`),
      ]);
      if (activo) setOcupados([...c.filter((x) => esActiva(x.estado) && x.id !== params.citaId), ...b]);
    })();
    return () => {
      activo = false;
    };
  }, [db, fecha, params.citaId]);

  if (!listo) return <Cargando />;

  const minutos = Number(duracion);
  const duracionValida = Number.isInteger(minutos) && minutos >= 5 && minutos <= 240;
  const libres = duracionValida ? horariosDisponibles(fecha, minutos, config, ocupados, ahoraMomento()) : [];
  // Al editar, la hora original siempre se ofrece aunque ya haya pasado.
  if (editando && original && fechaDeMomento(original.inicio) === fecha && !libres.includes(horaDeMomento(original.inicio))) {
    libres.unshift(horaDeMomento(original.inicio));
  }

  async function buscar(t: string) {
    setBusqueda(t);
    setResultados(t.trim().length >= 2 ? await buscarPacientes(db, t, 6) : []);
  }

  function cambiarTipo(t: TipoCita) {
    setTipo(t);
    setDuracion(String(duracionDeTipo(config, t)));
  }

  function cambiarFecha(nueva: string) {
    setFecha(nueva);
    setHora('');
  }

  function escribirFecha(t: string) {
    setFechaTexto(t);
    const f = leerFechaUsuario(t);
    if (f) cambiarFecha(aISO(f));
  }

  async function guardarDefinitivo(inicio: string, fin: string) {
    setGuardando(true);
    try {
      const datos = {
        pacienteId: modo === 'expediente' ? paciente?.id ?? null : null,
        nombreContacto: modo === 'nuevo' ? nombreContacto : '',
        telefonoContacto: modo === 'nuevo' ? telefonoContacto : '',
        inicio,
        fin,
        tipo,
        motivo,
        notas,
      };
      if (editando && params.citaId) {
        await actualizarCita(db, params.citaId, datos);
        router.back();
      } else {
        const id = await crearCita(db, { ...datos, estado });
        router.replace({ pathname: '/agenda/[id]', params: { id } });
      }
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
      setGuardando(false);
    }
  }

  function guardar() {
    const errores: string[] = [];
    if (modo === 'expediente' && !paciente) errores.push('Elija el paciente o cambie a "Persona sin expediente".');
    if (modo === 'nuevo' && !nombreContacto.trim()) errores.push('Escriba el nombre de la persona.');
    if (!leerFechaISO(fecha)) errores.push('La fecha no es válida.');
    if (!duracionValida) errores.push('La duración debe estar entre 5 y 240 minutos.');
    const manual = horaManual.trim() ? leerHoraUsuario(horaManual) : null;
    if (horaManual.trim() && !manual) errores.push('La hora escrita no es válida (use por ejemplo 15:30).');
    const horaFinal = manual ?? hora;
    if (!horaFinal) errores.push('Elija un horario o escriba una hora.');
    if (errores.length > 0) {
      Alert.alert('Faltan datos', errores.join('\n'));
      return;
    }
    const inicio = momento(fecha, horaFinal);
    const fin = sumarMinutos(inicio, minutos);
    const avisos: string[] = [];
    if (inicio < ahoraMomento() && !(editando && original?.inicio === inicio)) avisos.push('La cita queda en una fecha u hora que ya pasó.');
    if (!dentroDeHorario({ inicio, fin }, config)) avisos.push(`Queda fuera del horario de atención (${textoHorarioDia(config, fecha)}).`);
    if (avisos.length > 0) {
      Alert.alert('Revise antes de guardar', avisos.join('\n'), [
        { text: 'Corregir', style: 'cancel' },
        { text: 'Guardar de todos modos', onPress: () => void guardarDefinitivo(inicio, fin) },
      ]);
      return;
    }
    void guardarDefinitivo(inicio, fin);
  }

  return (
    <PantallaFormulario>
      <Stack.Screen options={{ title: editando ? 'Reprogramar o editar cita' : 'Nueva cita' }} />

      <Seccion titulo="Paciente">
        <Selector<'expediente' | 'nuevo'>
          etiqueta="¿Quién viene?"
          opciones={[
            { valor: 'expediente', texto: 'Con expediente' },
            { valor: 'nuevo', texto: 'Sin expediente' },
          ]}
          valor={modo}
          alCambiar={setModo}
        />
        {modo === 'expediente' ? (
          paciente ? (
            <View style={s.elegido}>
              <View style={{ flex: 1 }}>
                <Text style={[estilos.normal, { fontWeight: '700' }]}>{paciente.nombre}</Text>
                {paciente.detalle ? <Text style={estilos.suave}>{paciente.detalle}</Text> : null}
              </View>
              <EnlaceTexto texto="Cambiar" onPress={() => setPaciente(null)} />
            </View>
          ) : (
            <>
              <Campo etiqueta="Buscar paciente" value={busqueda} onChangeText={buscar} placeholder="Nombre, expediente o teléfono" autoCorrect={false} />
              {resultados.map((p) => (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [s.resultado, pressed && { opacity: 0.7 }]}
                  onPress={() => {
                    setPaciente({ id: p.id, nombre: `${p.nombres} ${p.apellidos}`, detalle: `${p.numeroExpediente} · ${edadDesdeISO(p.fechaNacimiento)}` });
                    setBusqueda('');
                    setResultados([]);
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
              {busqueda.trim().length >= 2 && resultados.length === 0 && (
                <Text style={estilos.suave}>Sin resultados. Si es la primera vez, use "Sin expediente".</Text>
              )}
            </>
          )
        ) : (
          <>
            <Campo etiqueta="Nombre del paciente" value={nombreContacto} onChangeText={setNombreContacto} autoCapitalize="words" />
            <Campo
              etiqueta="Teléfono o WhatsApp del responsable"
              value={telefonoContacto}
              onChangeText={setTelefonoContacto}
              keyboardType="phone-pad"
              placeholder="504 9999-9999"
            />
            <Text style={estilos.suave}>Después podrá crear su expediente desde la cita.</Text>
          </>
        )}
      </Seccion>

      <Seccion titulo="Tipo y duración">
        <Selector<TipoCita>
          etiqueta="Tipo de consulta"
          opciones={[
            { valor: 'primera', texto: `Primera (${config.duracionPrimera} min)` },
            { valor: 'control', texto: `Control (${config.duracionControl} min)` },
          ]}
          valor={tipo}
          alCambiar={cambiarTipo}
        />
        <Campo etiqueta="Duración" unidad="min" value={duracion} onChangeText={setDuracion} keyboardType="number-pad" />
      </Seccion>

      <Seccion titulo="Fecha y hora">
        <View style={s.navegacion}>
          <BotonFlecha texto="‹" etiqueta="Día anterior" onPress={() => cambiarFecha(sumarDias(fecha, -1))} />
          <Text style={s.fecha}>{textoFechaLarga(fecha)}</Text>
          <BotonFlecha texto="›" etiqueta="Día siguiente" onPress={() => cambiarFecha(sumarDias(fecha, 1))} />
        </View>
        <Campo etiqueta="Fecha" value={fechaTexto} onChangeText={escribirFecha} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" />
        <Text style={[estilos.suave, { marginBottom: espacio.s }]}>Horario de atención: {textoHorarioDia(config, fecha)}</Text>

        {libres.length > 0 ? (
          <>
            <Text style={s.etiqueta}>Horarios libres</Text>
            <View style={s.pastillas}>
              {libres.map((h) => (
                <Pastilla
                  key={h}
                  texto={h}
                  activa={!horaManual.trim() && hora === h}
                  onPress={() => {
                    setHora(h);
                    setHoraManual('');
                  }}
                />
              ))}
            </View>
          </>
        ) : (
          <Text style={[estilos.suave, { marginBottom: espacio.s }]}>
            {fecha < hoyISO() ? 'Es una fecha pasada.' : 'No hay horarios libres este día con esta duración.'} Puede escribir una hora.
          </Text>
        )}
        <Campo
          etiqueta="Otra hora (opcional)"
          value={horaManual}
          onChangeText={setHoraManual}
          placeholder="Ej. 18:30"
          keyboardType="numbers-and-punctuation"
          ayuda="Úsela para citas fuera del horario o en un horario no listado. Se revisa que no choque con otra cita."
        />
      </Seccion>

      <Seccion titulo="Detalles">
        <Campo etiqueta="Motivo de consulta" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
        <Campo etiqueta="Notas administrativas" value={notas} onChangeText={setNotas} multiline autoCapitalize="sentences" />
        {!editando && (
          <Selector<EstadoCita>
            etiqueta="Estado inicial"
            opciones={(['solicitada', 'pendiente', 'confirmada'] as EstadoCita[]).map((e) => ({
              valor: e,
              texto: e === 'pendiente' ? 'Por confirmar' : NOMBRE_ESTADO[e],
            }))}
            valor={estado}
            alCambiar={setEstado}
          />
        )}
      </Seccion>

      <Boton texto={guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Agendar cita'} onPress={guardar} deshabilitado={guardando} />
    </PantallaFormulario>
  );
}

const s = StyleSheet.create({
  elegido: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    backgroundColor: colores.primarioSuave,
    borderRadius: radio.m,
    padding: espacio.m,
  },
  resultado: {
    paddingVertical: espacio.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.borde,
  },
  navegacion: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, marginBottom: espacio.m },
  fecha: { flex: 1, textAlign: 'center', fontSize: texto.normal, fontWeight: '800', color: colores.texto },
  etiqueta: { fontSize: texto.pequeno, fontWeight: '600', color: colores.textoSuave, marginBottom: espacio.xs },
  pastillas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, marginBottom: espacio.m },
});
