// Agenda: vista diaria, semanal y mensual.

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { horariosDisponibles, rangosDelDia, textoHorarioDia } from '../../src/agenda/disponibilidad';
import {
  ahoraMomento,
  fechaDeMomento,
  horaDeMomento,
  hoyISO,
  inicioSemana,
  primerDiaMes,
  semanasDelMes,
  sumarDias,
  sumarMeses,
  textoFechaCorta,
  textoFechaLarga,
  textoMes,
  textoSemana,
} from '../../src/agenda/tiempo';
import { Bloqueo, Cita, CONFIG_PREDETERMINADA, ConfiguracionAgenda, esActiva, nombreCita } from '../../src/agenda/tipos';
import { bloqueosEntre, borrarBloqueo, citasEntre, leerConfiguracion } from '../../src/db/agenda';
import { BotonFlecha, FilaBloqueo, FilaCita } from '../../src/ui/agenda';
import { Boton, PantallaSimple, Seccion, Selector, estilos } from '../../src/ui/componentes';
import { colores, espacio, radio, texto } from '../../src/ui/tema';

type Vista = 'dia' | 'semana' | 'mes';

/** Rango de fechas [desde, hasta) que muestra cada vista. */
function periodo(vista: Vista, fecha: string): [string, string] {
  if (vista === 'dia') return [fecha, sumarDias(fecha, 1)];
  if (vista === 'semana') {
    const lunes = inicioSemana(fecha);
    return [lunes, sumarDias(lunes, 7)];
  }
  const semanas = semanasDelMes(fecha);
  const primero = inicioSemana(primerDiaMes(fecha));
  return [primero, sumarDias(primero, semanas.length * 7)];
}

export default function Agenda() {
  const params = useLocalSearchParams<{ fecha?: string; vista?: Vista }>();
  const db = useSQLiteContext();
  const [vista, setVista] = useState<Vista>(params.vista ?? 'dia');
  const [fecha, setFecha] = useState<string>(params.fecha ?? hoyISO());
  const [citas, setCitas] = useState<Cita[]>([]);
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const [config, setConfig] = useState<ConfiguracionAgenda>(CONFIG_PREDETERMINADA);
  const [version, setVersion] = useState(0);
  const hoy = hoyISO();

  useFocusEffect(
    useCallback(() => {
      let activo = true;
      void (async () => {
        const [desde, hasta] = periodo(vista, fecha);
        const [c, b, cfg] = await Promise.all([
          citasEntre(db, `${desde}T00:00`, `${hasta}T00:00`),
          bloqueosEntre(db, `${desde}T00:00`, `${hasta}T00:00`),
          leerConfiguracion(db),
        ]);
        if (!activo) return;
        setCitas(c);
        setBloqueos(b);
        setConfig(cfg);
      })();
      return () => {
        activo = false;
      };
    }, [db, vista, fecha, version]),
  );

  function mover(sentido: 1 | -1) {
    if (vista === 'dia') setFecha(sumarDias(fecha, sentido));
    else if (vista === 'semana') setFecha(sumarDias(fecha, 7 * sentido));
    else setFecha(sumarMeses(fecha, sentido));
  }

  function abrirDia(f: string) {
    setFecha(f);
    setVista('dia');
  }

  function quitarBloqueo(b: Bloqueo) {
    Alert.alert('Quitar bloqueo', `¿Liberar el horario ${horaDeMomento(b.inicio)}–${horaDeMomento(b.fin)}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Quitar bloqueo',
        style: 'destructive',
        onPress: async () => {
          await borrarBloqueo(db, b.id);
          setVersion((v) => v + 1);
        },
      },
    ]);
  }

  const delDia = (f: string) => citas.filter((c) => fechaDeMomento(c.inicio) === f);
  const activasDelDia = (f: string) => delDia(f).filter((c) => esActiva(c.estado));
  const titulo =
    vista === 'dia' ? textoFechaLarga(fecha) : vista === 'semana' ? textoSemana(inicioSemana(fecha)) : textoMes(fecha);

  return (
    <PantallaSimple>
      <Selector<Vista>
        etiqueta="Vista"
        opciones={[
          { valor: 'dia', texto: 'Día' },
          { valor: 'semana', texto: 'Semana' },
          { valor: 'mes', texto: 'Mes' },
        ]}
        valor={vista}
        alCambiar={setVista}
      />

      <View style={s.navegacion}>
        <BotonFlecha texto="‹" etiqueta="Anterior" onPress={() => mover(-1)} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.titulo}>{titulo}</Text>
          {fecha !== hoy && (
            <Pressable onPress={() => setFecha(hoy)} hitSlop={8}>
              <Text style={s.irHoy}>Ir a hoy</Text>
            </Pressable>
          )}
        </View>
        <BotonFlecha texto="›" etiqueta="Siguiente" onPress={() => mover(1)} />
      </View>

      {vista === 'dia' && (
        <VistaDia
          fecha={fecha}
          citas={delDia(fecha)}
          bloqueos={bloqueos}
          config={config}
          ahora={ahoraMomento()}
          onCita={(c) => router.push({ pathname: '/agenda/[id]', params: { id: c.id } })}
          onBloqueo={quitarBloqueo}
        />
      )}

      {vista === 'semana' && (
        <Seccion titulo="Semana">
          {Array.from({ length: 7 }, (_, i) => sumarDias(inicioSemana(fecha), i)).map((d) => {
            const activas = activasDelDia(d);
            const sinAtencion = rangosDelDia(config, d).length === 0;
            return (
              <Pressable key={d} onPress={() => abrirDia(d)} style={({ pressed }) => [s.diaSemana, pressed && { opacity: 0.7 }]}>
                <View style={{ width: 92 }}>
                  <Text style={[s.diaNombre, d === hoy && { color: colores.primario }]}>{textoFechaCorta(d)}</Text>
                  {d === hoy && <Text style={s.etiquetaHoy}>HOY</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  {activas.length === 0 ? (
                    <Text style={estilos.suave}>{sinAtencion ? 'Sin atención' : 'Sin citas'}</Text>
                  ) : (
                    activas.slice(0, 4).map((c) => (
                      <Text key={c.id} style={estilos.pequeno} numberOfLines={1}>
                        {horaDeMomento(c.inicio)} {nombreCita(c)}
                      </Text>
                    ))
                  )}
                  {activas.length > 4 && <Text style={estilos.suave}>y {activas.length - 4} más</Text>}
                </View>
                <View style={[s.contador, activas.length === 0 && { backgroundColor: colores.fondo }]}>
                  <Text style={[s.contadorTexto, activas.length === 0 && { color: colores.textoSuave }]}>{activas.length}</Text>
                </View>
              </Pressable>
            );
          })}
        </Seccion>
      )}

      {vista === 'mes' && (
        <Seccion titulo="Mes">
          <View style={s.filaMes}>
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
              <Text key={i} style={s.cabeceraMes}>
                {d}
              </Text>
            ))}
          </View>
          {semanasDelMes(fecha).map((semana, i) => (
            <View key={i} style={s.filaMes}>
              {semana.map((d, j) => {
                if (!d) return <View key={j} style={s.celda} />;
                const n = activasDelDia(d).length;
                const sinAtencion = rangosDelDia(config, d).length === 0;
                return (
                  <Pressable
                    key={j}
                    onPress={() => abrirDia(d)}
                    style={({ pressed }) => [s.celda, d === hoy && s.celdaHoy, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={[s.numeroDia, sinAtencion && { color: colores.textoSuave }, d === hoy && { color: colores.primario }]}>
                      {Number(d.slice(8))}
                    </Text>
                    {n > 0 && (
                      <View style={s.puntoCitas}>
                        <Text style={s.puntoTexto}>{n}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
          <Text style={[estilos.suave, { marginTop: espacio.s }]}>El número indica las citas activas. Toque un día para verlo.</Text>
        </Seccion>
      )}

      <Boton texto="＋ Nueva cita" onPress={() => router.push({ pathname: '/agenda/nueva', params: { fecha } })} />
      <Boton
        texto="Bloquear horario"
        variante="secundario"
        onPress={() => router.push({ pathname: '/agenda/bloqueo', params: { fecha } })}
      />
    </PantallaSimple>
  );
}

function VistaDia({
  fecha,
  citas,
  bloqueos,
  config,
  ahora,
  onCita,
  onBloqueo,
}: {
  fecha: string;
  citas: Cita[];
  bloqueos: Bloqueo[];
  config: ConfiguracionAgenda;
  ahora: string;
  onCita: (c: Cita) => void;
  onBloqueo: (b: Bloqueo) => void;
}) {
  const bloqueosDia = bloqueos.filter((b) => fechaDeMomento(b.inicio) <= fecha && fechaDeMomento(b.fin) >= fecha);
  const elementos: ({ tipo: 'cita'; c: Cita } | { tipo: 'bloqueo'; b: Bloqueo })[] = [
    ...citas.map((c) => ({ tipo: 'cita' as const, c })),
    ...bloqueosDia.map((b) => ({ tipo: 'bloqueo' as const, b })),
  ].sort((x, y) => (x.tipo === 'cita' ? x.c.inicio : x.b.inicio).localeCompare(y.tipo === 'cita' ? y.c.inicio : y.b.inicio));
  const ocupados = [...citas.filter((c) => esActiva(c.estado)), ...bloqueosDia];
  const libresControl = horariosDisponibles(fecha, config.duracionControl, config, ocupados, ahora).length;
  const libresPrimera = horariosDisponibles(fecha, config.duracionPrimera, config, ocupados, ahora).length;
  const sinAtencion = rangosDelDia(config, fecha).length === 0;

  return (
    <Seccion titulo={`Citas (${citas.filter((c) => esActiva(c.estado)).length})`}>
      <Text style={estilos.suave}>Horario: {textoHorarioDia(config, fecha)}</Text>
      {!sinAtencion && (
        <Text style={[estilos.suave, { marginBottom: espacio.s }]}>
          Horarios libres: {libresControl} para control · {libresPrimera} para primera consulta
        </Text>
      )}
      {elementos.length === 0 ? (
        <Text style={[estilos.suave, { marginTop: espacio.s }]}>No hay citas este día.</Text>
      ) : (
        elementos.map((e) =>
          e.tipo === 'cita' ? (
            <FilaCita key={e.c.id} cita={e.c} onPress={() => onCita(e.c)} />
          ) : (
            <FilaBloqueo key={e.b.id} bloqueo={e.b} onPress={() => onBloqueo(e.b)} />
          ),
        )
      )}
    </Seccion>
  );
}

const s = StyleSheet.create({
  navegacion: { flexDirection: 'row', alignItems: 'center', gap: espacio.m, marginBottom: espacio.l },
  titulo: { fontSize: texto.subtitulo, fontWeight: '800', color: colores.texto, textAlign: 'center' },
  irHoy: { color: colores.primario, fontWeight: '700', fontSize: texto.pequeno, marginTop: 2 },
  diaSemana: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.s,
    paddingVertical: espacio.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.borde,
  },
  diaNombre: { fontSize: texto.normal, fontWeight: '700', color: colores.texto },
  etiquetaHoy: { fontSize: texto.mini, fontWeight: '800', color: colores.primario },
  contador: { minWidth: 32, height: 32, borderRadius: 16, backgroundColor: colores.primario, alignItems: 'center', justifyContent: 'center' },
  contadorTexto: { color: '#FFFFFF', fontWeight: '800' },
  filaMes: { flexDirection: 'row' },
  cabeceraMes: { flex: 1, textAlign: 'center', fontSize: texto.mini, fontWeight: '700', color: colores.textoSuave, paddingVertical: 4 },
  celda: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 6, borderRadius: radio.s },
  celdaHoy: { backgroundColor: colores.primarioSuave },
  numeroDia: { fontSize: texto.normal, fontWeight: '600', color: colores.texto },
  puntoCitas: {
    marginTop: 2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: colores.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },
  puntoTexto: { color: '#FFFFFF', fontSize: texto.mini, fontWeight: '800' },
});
