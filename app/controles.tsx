// Lista diaria: controles por agendar y recordatorios de citas, con envío de WhatsApp uno tras otro.

import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffectConSync } from '../src/sincronizacion/eventos';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert } from '../src/ui/dialogo';
import { fechaDeMomento, horaDeMomento, hoyISO, sumarDias, textoDiaRelativo, textoFechaCorta, textoFechaLarga } from '../src/agenda/tiempo';
import { Cita, nombreCita } from '../src/agenda/tipos';
import { citasEntre } from '../src/db/agenda';
import {
  ControlConPaciente,
  controlesPendientes,
  descartarControl,
  fechaParaProponer,
  leerConfigMensajes,
  proponerCitaControl,
  recordatoriosEnviados,
  registrarMensaje,
} from '../src/db/seguimiento';
import { edadDesdeISO, textoFechaHora } from '../src/domain/fechas';
import { ConfigMensajes, normalizarTelefono, primerNombre, rellenarPlantilla } from '../src/seguimiento/mensajes';
import { BotonFlecha, ChipEstado } from '../src/ui/agenda';
import { Aviso, Boton, Cargando, EnlaceTexto, PantallaSimple, Seccion, Selector, estilos } from '../src/ui/componentes';
import { colores, espacio, radio, texto } from '../src/ui/tema';
import { Casilla, EnvioEnLote, MensajeEnCola } from '../src/ui/whatsapp';
import { usePlan } from '../src/plan/PlanProvider';
import { irAPlanes } from '../src/ui/pro';

type Pestana = 'controles' | 'recordatorios';

function numeroDeControl(c: ControlConPaciente, cfg: ConfigMensajes): string | null {
  return normalizarTelefono(c.whatsapp || c.telefonoPrincipal, cfg.codigoPais);
}

function numeroDeCita(c: Cita, cfg: ConfigMensajes): string | null {
  return normalizarTelefono(c.pacienteWhatsapp || c.pacienteTelefono || c.telefonoContacto, cfg.codigoPais);
}

/** Por qué no se le puede escribir (null si sí se puede). */
function impedimentoControl(c: ControlConPaciente, cfg: ConfigMensajes): string | null {
  if (!c.consentimientoWhatsapp) return 'Sin autorización para WhatsApp';
  if (!numeroDeControl(c, cfg)) return 'Sin número de WhatsApp válido';
  return null;
}

function impedimentoCita(c: Cita, cfg: ConfigMensajes): string | null {
  if (c.pacienteId && !c.pacienteConsentimientoWhatsapp) return 'Sin autorización para WhatsApp';
  if (!numeroDeCita(c, cfg)) return 'Sin número de WhatsApp válido';
  return null;
}

export default function Controles() {
  const { esPro } = usePlan();
  const params = useLocalSearchParams<{ pestana?: Pestana }>();
  const db = useSQLiteContext();
  const hoy = hoyISO();
  const [pestana, setPestana] = useState<Pestana>(params.pestana ?? 'controles');
  const [cfg, setCfg] = useState<ConfigMensajes | null>(null);
  const [controles, setControles] = useState<ControlConPaciente[]>([]);
  const [diaRecordatorio, setDiaRecordatorio] = useState(sumarDias(hoy, 1));
  const [citas, setCitas] = useState<Cita[]>([]);
  const [enviados, setEnviados] = useState<Map<string, string>>(new Map());
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [cola, setCola] = useState<MensajeEnCola[] | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [version, setVersion] = useState(0);

  useFocusEffectConSync(
    useCallback(() => {
      if (cola) return; // no recargar mientras se envían mensajes
      let activo = true;
      void (async () => {
        const config = await leerConfigMensajes(db);
        const [lista, delDia] = await Promise.all([
          controlesPendientes(db, hoyISO()),
          citasEntre(db, `${diaRecordatorio}T00:00`, `${sumarDias(diaRecordatorio, 1)}T00:00`),
        ]);
        const porRecordar = delDia.filter((c) => c.estado === 'solicitada' || c.estado === 'pendiente' || c.estado === 'confirmada');
        const yaEnviados = await recordatoriosEnviados(db, porRecordar.map((c) => c.id));
        if (!activo) return;
        setCfg(config);
        setControles(lista);
        setCitas(porRecordar);
        setEnviados(yaEnviados);
        // Selección inicial: a quienes se les puede escribir y aún no se les escribió.
        setMarcados(
          new Set(
            pestana === 'controles'
              ? lista.filter((c) => !impedimentoControl(c, config)).map((c) => c.pacienteId)
              : porRecordar.filter((c) => !impedimentoCita(c, config) && !yaEnviados.has(c.id)).map((c) => c.id),
          ),
        );
      })();
      return () => {
        activo = false;
      };
    }, [db, pestana, diaRecordatorio, version, cola]),
  );

  if (!cfg) return <Cargando />;
  const config = cfg;

  const alternar = (clave: string) =>
    setMarcados((prev) => {
      const n = new Set(prev);
      if (n.has(clave)) n.delete(clave);
      else n.add(clave);
      return n;
    });

  async function registrarApertura(m: MensajeEnCola) {
    await registrarMensaje(db, { pacienteId: m.pacienteId, citaId: m.citaId, tipo: m.tipo, telefono: m.numero });
  }

  function terminar() {
    setCola(null);
    setVersion((v) => v + 1);
  }

  // --- Controles: apartar citas y preparar mensajes ---
  function prepararControles() {
    if (!esPro) return irAPlanes('whatsapp');
    const elegidos = controles.filter((c) => marcados.has(c.pacienteId) && !impedimentoControl(c, config));
    if (elegidos.length === 0) return;
    Alert.alert(
      'Apartar citas de control',
      `Se apartarán ${elegidos.length} citas de control como "por confirmar" en los primeros horarios libres (desde mañana o desde la fecha que les toca) y se prepararán los mensajes.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apartar y preparar', onPress: () => void apartar(elegidos) },
      ],
    );
  }

  async function apartar(elegidos: ControlConPaciente[]) {
    setTrabajando(true);
    const mensajes: MensajeEnCola[] = [];
    const sinHorario: string[] = [];
    const horaActual = new Date().getHours();
    for (const c of elegidos) {
      try {
        const cita = await proponerCitaControl(db, c.pacienteId, fechaParaProponer(c.fechaObjetivo, hoy), c.motivos[0].texto);
        if (!cita) {
          sinHorario.push(`${c.nombres} ${c.apellidos}`);
          continue;
        }
        const fecha = fechaDeMomento(cita.inicio);
        const hora = horaDeMomento(cita.inicio);
        mensajes.push({
          clave: cita.id,
          nombre: `${c.nombres} ${c.apellidos}`,
          detalle: `${textoFechaCorta(fecha)} ${hora}`,
          numero: numeroDeControl(c, config) as string,
          texto: rellenarPlantilla(config.plantillas.propuesta, {
            nombre: primerNombre(c.nombres),
            fecha,
            hora,
            consultorio: config.nombreConsultorio,
            horaActual,
          }),
          tipo: 'propuesta',
          pacienteId: c.pacienteId,
          citaId: cita.id,
        });
      } catch (e) {
        sinHorario.push(`${c.nombres} ${c.apellidos} (${e instanceof Error ? e.message : String(e)})`);
      }
    }
    setTrabajando(false);
    if (sinHorario.length > 0) {
      Alert.alert('Sin horario disponible', `No se encontró horario libre en los próximos 30 días para:\n${sinHorario.join('\n')}`);
    }
    if (mensajes.length > 0) setCola(mensajes);
    else setVersion((v) => v + 1);
  }

  function descartar(c: ControlConPaciente) {
    Alert.alert(
      'Quitar de la lista',
      `${c.nombres} ${c.apellidos} no volverá a aparecer por estos motivos. Volverá a aparecer si más adelante le toca otro control.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            await descartarControl(db, c.pacienteId, c.motivos.map((m) => m.clave));
            setVersion((v) => v + 1);
          },
        },
      ],
    );
  }

  // --- Recordatorios de citas ---
  function prepararRecordatorios() {
    if (!esPro) return irAPlanes('whatsapp');
    const horaActual = new Date().getHours();
    const mensajes: MensajeEnCola[] = citas
      .filter((c) => marcados.has(c.id) && !impedimentoCita(c, config))
      .map((c) => ({
        clave: c.id,
        nombre: nombreCita(c),
        detalle: `${textoFechaCorta(fechaDeMomento(c.inicio))} ${horaDeMomento(c.inicio)}`,
        numero: numeroDeCita(c, config) as string,
        texto: rellenarPlantilla(config.plantillas.recordatorio, {
          nombre: primerNombre(nombreCita(c)),
          fecha: fechaDeMomento(c.inicio),
          hora: horaDeMomento(c.inicio),
          consultorio: config.nombreConsultorio,
          horaActual,
        }),
        tipo: 'recordatorio',
        pacienteId: c.pacienteId,
        citaId: c.id,
      }));
    if (mensajes.length > 0) setCola(mensajes);
  }

  if (cola && esPro) {
    return (
      <PantallaSimple>
        <EnvioEnLote mensajes={cola} alAbrir={registrarApertura} alTerminar={terminar} />
      </PantallaSimple>
    );
  }

  const elegiblesControl = controles.filter((c) => !impedimentoControl(c, config));
  const marcadosControl = elegiblesControl.filter((c) => marcados.has(c.pacienteId)).length;
  const elegiblesCita = citas.filter((c) => !impedimentoCita(c, config));
  const marcadosCita = elegiblesCita.filter((c) => marcados.has(c.id)).length;
  const vencidos = controles.filter((c) => c.vencido);
  const proximos = controles.filter((c) => !c.vencido);

  const filaControl = (c: ControlConPaciente) => {
    const impedimento = impedimentoControl(c, config);
    return (
      <View key={c.pacienteId} style={s.fila}>
        <Casilla marcada={marcados.has(c.pacienteId)} onPress={() => alternar(c.pacienteId)} deshabilitada={Boolean(impedimento)} />
        <View style={{ flex: 1, gap: 2 }}>
          <Pressable onPress={() => router.push({ pathname: '/pacientes/[id]', params: { id: c.pacienteId } })}>
            <Text style={s.nombre}>
              {c.nombres} {c.apellidos}
            </Text>
          </Pressable>
          <Text style={estilos.suave}>
            {c.numeroExpediente} · {edadDesdeISO(c.fechaNacimiento)}
          </Text>
          {c.motivos.map((m) => (
            <Text key={m.clave} style={[estilos.pequeno, m.fechaObjetivo < hoy && { color: colores.peligro }]}>
              • {m.texto} ({textoDiaRelativo(m.fechaObjetivo, hoy)})
            </Text>
          ))}
          {impedimento && (
            <Text style={s.impedimento}>
              {impedimento}
              {c.telefonoPrincipal ? ` · llamar al ${c.telefonoPrincipal}` : ''}
            </Text>
          )}
          {c.ultimoMensaje && <Text style={estilos.suave}>Último WhatsApp: {textoFechaHora(c.ultimoMensaje)}</Text>}
          <View style={s.accionesFila}>
            <EnlaceTexto
              texto="Agendar a mano"
              onPress={() =>
                router.push({
                  pathname: '/agenda/nueva',
                  params: { pacienteId: c.pacienteId, tipo: 'control', fecha: fechaParaProponer(c.fechaObjetivo, hoy) },
                })
              }
            />
            <EnlaceTexto texto="Quitar de la lista" onPress={() => descartar(c)} />
          </View>
        </View>
      </View>
    );
  };

  return (
    <PantallaSimple>
      <Selector<Pestana>
        etiqueta="Lista"
        opciones={[
          { valor: 'controles', texto: `Controles (${controles.length})` },
          { valor: 'recordatorios', texto: 'Recordatorios' },
        ]}
        valor={pestana}
        alCambiar={setPestana}
      />

      {pestana === 'controles' ? (
        <>
          <Aviso tono="info">
            Pacientes a quienes les toca control (seguimiento indicado, control de niño sano por edad o sin consulta hace tiempo) y que
            todavía no tienen cita. La app les aparta un horario "por confirmar" y prepara el mensaje.
          </Aviso>
          {controles.length === 0 ? (
            <Seccion titulo="Al día">
              <Text style={estilos.suave}>No hay controles pendientes por agendar.</Text>
            </Seccion>
          ) : (
            <>
              <Boton
                texto={trabajando ? 'Apartando citas…' : `Apartar citas y preparar mensajes (${marcadosControl})${esPro ? '' : ' 🔒 Pro'}`}
                onPress={prepararControles}
                deshabilitado={trabajando || marcadosControl === 0}
              />
              <View style={s.seleccion}>
                <EnlaceTexto texto="Marcar todos" onPress={() => setMarcados(new Set(elegiblesControl.map((c) => c.pacienteId)))} />
                <EnlaceTexto texto="Desmarcar todos" onPress={() => setMarcados(new Set())} />
              </View>
              {vencidos.length > 0 && <Seccion titulo={`Ya les tocaba (${vencidos.length})`}>{vencidos.map(filaControl)}</Seccion>}
              {proximos.length > 0 && <Seccion titulo={`Próximos días (${proximos.length})`}>{proximos.map(filaControl)}</Seccion>}
            </>
          )}
        </>
      ) : (
        <>
          <View style={s.navegacion}>
            <BotonFlecha texto="‹" etiqueta="Día anterior" onPress={() => setDiaRecordatorio(sumarDias(diaRecordatorio, -1))} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.titulo}>{textoDiaRelativo(diaRecordatorio, hoy)}</Text>
              <Text style={estilos.suave}>{textoFechaLarga(diaRecordatorio, false)}</Text>
            </View>
            <BotonFlecha texto="›" etiqueta="Día siguiente" onPress={() => setDiaRecordatorio(sumarDias(diaRecordatorio, 1))} />
          </View>
          {citas.length === 0 ? (
            <Seccion titulo="Sin citas">
              <Text style={estilos.suave}>No hay citas por recordar este día.</Text>
            </Seccion>
          ) : (
            <>
              <Boton
                texto={`Preparar recordatorios (${marcadosCita})${esPro ? '' : ' 🔒 Pro'}`}
                onPress={prepararRecordatorios}
                deshabilitado={marcadosCita === 0}
              />
              <Seccion titulo={`Citas (${citas.length})`}>
                {citas.map((c) => {
                  const impedimento = impedimentoCita(c, config);
                  return (
                    <View key={c.id} style={s.fila}>
                      <Casilla marcada={marcados.has(c.id)} onPress={() => alternar(c.id)} deshabilitada={Boolean(impedimento)} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Pressable onPress={() => router.push({ pathname: '/agenda/[id]', params: { id: c.id } })}>
                          <Text style={s.nombre}>
                            {horaDeMomento(c.inicio)} · {nombreCita(c)}
                          </Text>
                        </Pressable>
                        <ChipEstado estado={c.estado} />
                        {enviados.has(c.id) && (
                          <Text style={estilos.suave}>Recordatorio abierto en WhatsApp: {textoFechaHora(enviados.get(c.id) as string)}</Text>
                        )}
                        {impedimento && <Text style={s.impedimento}>{impedimento}</Text>}
                      </View>
                    </View>
                  );
                })}
              </Seccion>
            </>
          )}
        </>
      )}

      <EnlaceTexto texto="Ajustar mensajes y criterios de control" onPress={() => router.push('/configuracion-mensajes')} />
    </PantallaSimple>
  );
}

const s = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    gap: espacio.m,
    paddingVertical: espacio.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.borde,
  },
  nombre: { fontSize: texto.normal, fontWeight: '700', color: colores.primarioOscuro },
  impedimento: { fontSize: texto.mini, fontWeight: '700', color: colores.aviso },
  accionesFila: { flexDirection: 'row', gap: espacio.l, marginTop: espacio.xs },
  seleccion: { flexDirection: 'row', gap: espacio.l, marginVertical: espacio.m },
  navegacion: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, marginBottom: espacio.m, backgroundColor: colores.superficie, padding: espacio.s, borderRadius: radio.m },
  titulo: { fontSize: texto.subtitulo, fontWeight: '800', color: colores.texto },
});
