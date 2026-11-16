// Detalle de una cita: datos, cambios de estado y acciones.

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AccionCita, accionesDisponibles, sePuedeRegistrarConsulta, sePuedeReprogramar } from '../../src/agenda/estados';
import { ahoraMomento, fechaDeMomento, horaDeMomento, minutosEntre, textoFechaLarga } from '../../src/agenda/tiempo';
import { Cita, NOMBRE_TIPO, nombreCita } from '../../src/agenda/tipos';
import { cambiarEstadoCita, obtenerCita } from '../../src/db/agenda';
import { textoFechaHora } from '../../src/domain/fechas';
import { ChipEstado } from '../../src/ui/agenda';
import { Aviso, Boton, Cargando, Dato, EnlaceTexto, PantallaSimple, Seccion, estilos } from '../../src/ui/componentes';
import { colores, espacio, texto } from '../../src/ui/tema';

export default function DetalleCita() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [cita, setCita] = useState<Cita | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const c = await obtenerCita(db, id);
    if (c) setCita(c);
    else setNoExiste(true);
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  if (noExiste) {
    return (
      <PantallaSimple>
        <Text style={estilos.normal}>Esta cita ya no existe.</Text>
      </PantallaSimple>
    );
  }
  if (!cita) return <Cargando />;

  const c = cita;
  const ahora = ahoraMomento();
  const acciones = accionesDisponibles(c, ahora);

  async function aplicar(a: AccionCita) {
    setOcupado(true);
    try {
      await cambiarEstadoCita(db, c.id, a.estado);
      await cargar();
    } catch (e) {
      Alert.alert('No se pudo cambiar el estado', e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }

  function elegir(a: AccionCita) {
    if (!a.confirmar) return void aplicar(a);
    Alert.alert(a.texto, a.confirmar, [
      { text: 'Volver', style: 'cancel' },
      { text: a.texto, style: a.variante === 'peligro' ? 'destructive' : 'default', onPress: () => void aplicar(a) },
    ]);
  }

  const telefono = c.pacienteWhatsapp || c.pacienteTelefono || c.telefonoContacto;

  return (
    <PantallaSimple>
      <View style={s.cabecera}>
        <Text style={s.nombre}>{nombreCita(c)}</Text>
        <Text style={s.cuando}>
          {textoFechaLarga(fechaDeMomento(c.inicio))}
          {'\n'}
          {horaDeMomento(c.inicio)}–{horaDeMomento(c.fin)} · {minutosEntre(c.inicio, c.fin)} min · {NOMBRE_TIPO[c.tipo]}
        </Text>
        <ChipEstado estado={c.estado} />
      </View>

      {!c.pacienteId && (
        <Aviso tono="info">Esta persona aún no tiene expediente. Créelo para poder registrar la consulta.</Aviso>
      )}

      <Seccion titulo="Acciones">
        {c.pacienteId && sePuedeRegistrarConsulta(c.estado) && fechaDeMomento(c.inicio) <= fechaDeMomento(ahora) && (
          <Boton
            texto="🩺 Registrar consulta"
            onPress={() =>
              router.push({ pathname: '/pacientes/[id]/consulta-nueva', params: { id: c.pacienteId as string, citaId: c.id } })
            }
          />
        )}
        {!c.pacienteId && (
          <Boton
            texto="Crear expediente"
            onPress={() => router.push({ pathname: '/pacientes/nuevo', params: { citaId: c.id } })}
          />
        )}
        {acciones.map((a) => (
          <Boton key={a.estado} texto={a.texto} variante={a.variante} onPress={() => elegir(a)} deshabilitado={ocupado} />
        ))}
        {sePuedeReprogramar(c.estado) && (
          <Boton
            texto="Reprogramar o editar"
            variante="secundario"
            onPress={() => router.push({ pathname: '/agenda/nueva', params: { citaId: c.id } })}
          />
        )}
        {c.consultaId && (
          <Boton
            texto="Ver consulta registrada"
            variante="secundario"
            onPress={() => router.push({ pathname: '/consultas/[id]', params: { id: c.consultaId as string } })}
          />
        )}
        {(c.estado === 'no_asistio' || c.estado === 'cancelada') && c.pacienteId && (
          <Boton
            texto="Agendar otra cita"
            variante="secundario"
            onPress={() => router.push({ pathname: '/agenda/nueva', params: { pacienteId: c.pacienteId as string, tipo: c.tipo } })}
          />
        )}
        {acciones.length === 0 && !sePuedeReprogramar(c.estado) && !c.consultaId && c.estado === 'completada' && (
          <Text style={estilos.suave}>Cita completada.</Text>
        )}
      </Seccion>

      <Seccion titulo="Datos de la cita">
        {c.pacienteId ? (
          <View style={{ marginBottom: espacio.s }}>
            <EnlaceTexto
              texto={`Ver expediente ${c.numeroExpediente ?? ''}`}
              onPress={() => router.push({ pathname: '/pacientes/[id]', params: { id: c.pacienteId as string } })}
            />
          </View>
        ) : null}
        <Dato etiqueta="Teléfono / WhatsApp" valor={telefono} />
        <Dato etiqueta="Motivo" valor={c.motivo} />
        <Dato etiqueta="Notas administrativas" valor={c.notas} />
        <Dato etiqueta="Creada" valor={textoFechaHora(c.creadoEn)} />
        <Dato etiqueta="Último cambio" valor={textoFechaHora(c.actualizadoEn)} />
      </Seccion>
    </PantallaSimple>
  );
}

const s = StyleSheet.create({
  cabecera: { marginBottom: espacio.l, gap: espacio.s },
  nombre: { fontSize: texto.titulo, fontWeight: '800', color: colores.texto },
  cuando: { fontSize: texto.normal, color: colores.texto, lineHeight: 22 },
});
