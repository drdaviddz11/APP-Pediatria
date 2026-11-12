// Detalle de una consulta guardada (solo lectura) y sus notas aclaratorias.

import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { agregarNota, listarNotas, obtenerConsulta } from '../../src/db/consultas';
import { obtenerPaciente } from '../../src/db/pacientes';
import { calcularEdad, deDate, isoATextoCorto, leerFechaISO, textoEdad, textoFechaHora } from '../../src/domain/fechas';
import type { Consulta, NotaAclaratoria, Paciente } from '../../src/domain/types';
import { Boton, Campo, Cargando, Dato, EnlaceTexto, PantallaFormulario, Seccion, estilos } from '../../src/ui/componentes';

function conUnidad(v: number | null, unidad: string): string | null {
  return v == null ? null : `${v} ${unidad}`;
}

export default function VerConsulta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [notas, setNotas] = useState<NotaAclaratoria[]>([]);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const c = await obtenerConsulta(db, id);
    if (!c) return;
    const [p, n] = await Promise.all([obtenerPaciente(db, c.pacienteId), listarNotas(db, id)]);
    setConsulta(c);
    setPaciente(p);
    setNotas(n);
  }, [db, id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (!consulta || !paciente) return <Cargando />;

  const nacimiento = leerFechaISO(paciente.fechaNacimiento);
  const edad = nacimiento ? calcularEdad(nacimiento, deDate(new Date(consulta.fechaHora))) : null;
  const presion =
    consulta.presionSistolica != null || consulta.presionDiastolica != null
      ? `${consulta.presionSistolica ?? '—'}/${consulta.presionDiastolica ?? '—'} mmHg`
      : null;

  async function guardarNota() {
    setGuardando(true);
    try {
      await agregarNota(db, id, nota);
      setNota('');
      await cargar();
    } catch (e) {
      Alert.alert('No se pudo guardar la nota', e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <PantallaFormulario>
      <EnlaceTexto
        texto={`${paciente.nombres} ${paciente.apellidos} · ${paciente.numeroExpediente}`}
        onPress={() => router.dismissTo({ pathname: '/pacientes/[id]', params: { id: paciente.id } })}
      />
      <Text style={[estilos.suave, { marginTop: 4, marginBottom: 16 }]}>
        {textoFechaHora(consulta.fechaHora)} · Edad en la consulta: {textoEdad(edad)}
      </Text>

      <Seccion titulo="Motivo y padecimiento">
        <Dato etiqueta="Motivo" valor={consulta.motivo} />
        <Dato etiqueta="Enfermedad actual" valor={consulta.enfermedadActual} />
        <Dato etiqueta="Síntomas" valor={consulta.sintomas} />
      </Seccion>

      <Seccion titulo="Antropometría y signos vitales">
        <Dato etiqueta="Peso" valor={conUnidad(consulta.pesoKg, 'kg')} />
        <Dato
          etiqueta="Longitud / talla"
          valor={
            consulta.tallaCm == null
              ? null
              : `${consulta.tallaCm} cm (${consulta.tipoMedicion === 'acostado' ? 'acostado' : 'de pie'})`
          }
        />
        <Dato etiqueta="Perímetro cefálico" valor={conUnidad(consulta.perimetroCefalicoCm, 'cm')} />
        <Dato etiqueta="Temperatura" valor={conUnidad(consulta.temperaturaC, '°C')} />
        <Dato etiqueta="Frecuencia cardiaca" valor={conUnidad(consulta.frecuenciaCardiaca, 'lpm')} />
        <Dato etiqueta="Frecuencia respiratoria" valor={conUnidad(consulta.frecuenciaRespiratoria, 'rpm')} />
        <Dato etiqueta="Saturación de O₂" valor={conUnidad(consulta.saturacionO2, '%')} />
        <Dato etiqueta="Presión arterial" valor={presion} />
      </Seccion>

      <Seccion titulo="Exploración y plan">
        <Dato etiqueta="Exploración física" valor={consulta.exploracionFisica} />
        <Dato etiqueta="Diagnósticos" valor={consulta.diagnosticos} />
        <Dato etiqueta="Estudios solicitados" valor={consulta.estudiosSolicitados} />
        <Dato etiqueta="Tratamiento" valor={consulta.tratamiento} />
        <Dato etiqueta="Indicaciones" valor={consulta.indicaciones} />
        <Dato etiqueta="Seguimiento" valor={consulta.fechaSeguimiento ? isoATextoCorto(consulta.fechaSeguimiento) : null} />
      </Seccion>

      <Seccion titulo="Notas aclaratorias">
        <Text style={[estilos.suave, { marginBottom: 8 }]}>
          La consulta original no se modifica. Para corregir o completar información, agregue una nota con fecha.
        </Text>
        {notas.map((n) => (
          <View key={n.id} style={{ marginBottom: 8 }}>
            <Text style={[estilos.suave, { fontWeight: '700' }]}>{textoFechaHora(n.creadoEn)}</Text>
            <Text style={estilos.normal}>{n.texto}</Text>
          </View>
        ))}
        <Campo etiqueta="Nueva nota" value={nota} onChangeText={setNota} multiline autoCapitalize="sentences" />
        <Boton texto={guardando ? 'Guardando…' : 'Agregar nota'} variante="secundario" onPress={guardarNota} deshabilitado={guardando || !nota.trim()} />
      </Seccion>
    </PantallaFormulario>
  );
}
