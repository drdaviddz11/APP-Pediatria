// Registro de una consulta nueva. Una vez guardada no se modifica.

import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { crearConsulta, ultimaConsultaConPeso } from '../../../src/db/consultas';
import { obtenerPaciente } from '../../../src/db/pacientes';
import {
  aISO,
  calcularEdad,
  deDate,
  leerFechaISO,
  leerFechaUsuario,
  textoEdad,
  textoFechaHora,
} from '../../../src/domain/fechas';
import type { Consulta, Paciente, TipoMedicion } from '../../../src/domain/types';
import {
  alertaCambioPeso,
  leerNumero,
  MedicionesFormulario,
  Problema,
  validarMediciones,
} from '../../../src/domain/validacion';
import { Boton, Campo, Cargando, ListaProblemas, PantallaFormulario, Seccion, Selector, estilos } from '../../../src/ui/componentes';

interface Textos {
  motivo: string;
  enfermedadActual: string;
  sintomas: string;
  exploracionFisica: string;
  diagnosticos: string;
  estudiosSolicitados: string;
  tratamiento: string;
  indicaciones: string;
  fechaSeguimiento: string; // DD/MM/AAAA
}

const MEDICIONES_VACIAS: MedicionesFormulario = {
  pesoKg: '',
  tallaCm: '',
  tipoMedicion: '',
  perimetroCefalicoCm: '',
  temperaturaC: '',
  frecuenciaCardiaca: '',
  frecuenciaRespiratoria: '',
  saturacionO2: '',
  presionSistolica: '',
  presionDiastolica: '',
};

const TEXTOS_VACIOS: Textos = {
  motivo: '',
  enfermedadActual: '',
  sintomas: '',
  exploracionFisica: '',
  diagnosticos: '',
  estudiosSolicitados: '',
  tratamiento: '',
  indicaciones: '',
  fechaSeguimiento: '',
};

/** Número ya validado (vacío → null). */
function num(texto: string): number | null {
  const v = leerNumero(texto);
  return v === null || Number.isNaN(v) ? null : v;
}

export default function NuevaConsulta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [anterior, setAnterior] = useState<Consulta | null>(null);
  const [inicio] = useState(() => new Date()); // fecha y hora de la consulta
  const [m, setM] = useState<MedicionesFormulario>(MEDICIONES_VACIAS);
  const [t, setT] = useState<Textos>(TEXTOS_VACIOS);
  const [problemas, setProblemas] = useState<Problema[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void (async () => {
      const [p, a] = await Promise.all([obtenerPaciente(db, id), ultimaConsultaConPeso(db, id)]);
      setPaciente(p);
      setAnterior(a);
    })();
  }, [db, id]);

  if (!paciente) return <Cargando />;

  const fechaConsulta = deDate(inicio);
  const nacimiento = leerFechaISO(paciente.fechaNacimiento);
  const edad = nacimiento ? calcularEdad(nacimiento, fechaConsulta) : null;

  // Sugerir el tipo de medición según la edad (OMS: acostado < 24 meses, de pie desde 24 meses).
  const tipoSugerido: TipoMedicion | '' = edad ? (edad.totalMeses < 24 ? 'acostado' : 'de_pie') : '';

  const cambiarM = (campo: keyof MedicionesFormulario) => (v: string) => setM((prev) => ({ ...prev, [campo]: v }));
  const cambiarT = (campo: keyof Textos) => (v: string) => setT((prev) => ({ ...prev, [campo]: v }));
  const problemaDe = (campo: string) => problemas.find((p) => p.campo === campo);

  function revisar(): Problema[] {
    const medicionesConTipo = { ...m, tipoMedicion: m.tipoMedicion || (m.tallaCm.trim() ? tipoSugerido : '') };
    const lista = validarMediciones(medicionesConTipo, edad?.totalMeses ?? null);
    if (!t.motivo.trim()) lista.unshift({ campo: 'motivo', nivel: 'error', mensaje: 'Escriba el motivo de consulta.' });

    if (t.fechaSeguimiento.trim()) {
      const f = leerFechaUsuario(t.fechaSeguimiento);
      if (!f) lista.push({ campo: 'fechaSeguimiento', nivel: 'error', mensaje: 'Fecha de seguimiento: use DD/MM/AAAA.' });
    }

    const cambio = alertaCambioPeso(
      anterior?.pesoKg ?? null,
      anterior ? deDate(new Date(anterior.fechaHora)) : null,
      num(m.pesoKg),
      fechaConsulta,
    );
    if (cambio) lista.push(cambio);
    return lista;
  }

  async function guardarDefinitivo() {
    setGuardando(true);
    try {
      const seguimiento = leerFechaUsuario(t.fechaSeguimiento);
      const talla = num(m.tallaCm);
      const consultaId = await crearConsulta(db, id, {
        fechaHora: inicio.toISOString(),
        motivo: t.motivo,
        enfermedadActual: t.enfermedadActual,
        sintomas: t.sintomas,
        exploracionFisica: t.exploracionFisica,
        temperaturaC: num(m.temperaturaC),
        frecuenciaCardiaca: num(m.frecuenciaCardiaca),
        frecuenciaRespiratoria: num(m.frecuenciaRespiratoria),
        saturacionO2: num(m.saturacionO2),
        presionSistolica: num(m.presionSistolica),
        presionDiastolica: num(m.presionDiastolica),
        pesoKg: num(m.pesoKg),
        tallaCm: talla,
        tipoMedicion: talla == null ? null : m.tipoMedicion || tipoSugerido || null,
        perimetroCefalicoCm: num(m.perimetroCefalicoCm),
        diagnosticos: t.diagnosticos,
        estudiosSolicitados: t.estudiosSolicitados,
        tratamiento: t.tratamiento,
        indicaciones: t.indicaciones,
        fechaSeguimiento: seguimiento ? aISO(seguimiento) : null,
      });
      router.replace({ pathname: '/consultas/[id]', params: { id: consultaId } });
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
      setGuardando(false);
    }
  }

  function guardar() {
    const lista = revisar();
    setProblemas(lista);
    if (lista.some((p) => p.nivel === 'error')) {
      Alert.alert('Faltan datos', 'Revise los campos marcados en rojo.');
      return;
    }
    const avisos = lista.filter((p) => p.nivel === 'aviso');
    const confirmar = () =>
      Alert.alert('Guardar consulta', 'Una vez guardada, la consulta no se podrá modificar (solo agregar notas aclaratorias).', [
        { text: 'Revisar', style: 'cancel' },
        { text: 'Guardar', onPress: guardarDefinitivo },
      ]);
    if (avisos.length > 0) {
      Alert.alert('Revise estos datos', avisos.map((p) => `• ${p.mensaje}`).join('\n'), [
        { text: 'Corregir', style: 'cancel' },
        { text: 'Los datos son correctos', onPress: confirmar },
      ]);
      return;
    }
    confirmar();
  }

  return (
    <PantallaFormulario>
      <Text style={[estilos.normal, { fontWeight: '700' }]}>
        {paciente.nombres} {paciente.apellidos}
      </Text>
      <Text style={[estilos.suave, { marginBottom: 12 }]}>
        {textoFechaHora(inicio.toISOString())} · Edad: {textoEdad(edad)}
        {anterior?.pesoKg != null ? ` · Peso anterior: ${anterior.pesoKg} kg` : ''}
      </Text>

      <ListaProblemas problemas={problemas} />

      <Seccion titulo="Motivo y padecimiento">
        <Campo etiqueta="Motivo de consulta" value={t.motivo} onChangeText={cambiarT('motivo')} problema={problemaDe('motivo')} autoCapitalize="sentences" />
        <Campo etiqueta="Historia de la enfermedad actual" value={t.enfermedadActual} onChangeText={cambiarT('enfermedadActual')} multiline autoCapitalize="sentences" />
        <Campo etiqueta="Síntomas" value={t.sintomas} onChangeText={cambiarT('sintomas')} multiline autoCapitalize="sentences" />
      </Seccion>

      <Seccion titulo="Antropometría">
        <Campo etiqueta="Peso" unidad="kg" value={m.pesoKg} onChangeText={cambiarM('pesoKg')} keyboardType="decimal-pad" problema={problemaDe('pesoKg')} />
        <Campo etiqueta="Longitud / talla" unidad="cm" value={m.tallaCm} onChangeText={cambiarM('tallaCm')} keyboardType="decimal-pad" problema={problemaDe('tallaCm')} />
        <Selector<TipoMedicion>
          etiqueta={`Tipo de medición${tipoSugerido ? ` (sugerido: ${tipoSugerido === 'acostado' ? 'acostado' : 'de pie'})` : ''}`}
          opciones={[
            { valor: 'acostado', texto: 'Acostado' },
            { valor: 'de_pie', texto: 'De pie' },
          ]}
          valor={m.tipoMedicion || (m.tallaCm.trim() ? tipoSugerido : '')}
          alCambiar={(v) => setM((prev) => ({ ...prev, tipoMedicion: v }))}
          problema={problemaDe('tipoMedicion')}
        />
        <Campo
          etiqueta="Perímetro cefálico"
          unidad="cm"
          value={m.perimetroCefalicoCm}
          onChangeText={cambiarM('perimetroCefalicoCm')}
          keyboardType="decimal-pad"
          problema={problemaDe('perimetroCefalicoCm')}
        />
        <Text style={estilos.suave}>La evaluación nutricional con puntajes Z y percentiles OMS se agregará en la siguiente fase.</Text>
      </Seccion>

      <Seccion titulo="Signos vitales">
        <Campo etiqueta="Temperatura" unidad="°C" value={m.temperaturaC} onChangeText={cambiarM('temperaturaC')} keyboardType="decimal-pad" problema={problemaDe('temperaturaC')} />
        <Campo etiqueta="Frecuencia cardiaca" unidad="lpm" value={m.frecuenciaCardiaca} onChangeText={cambiarM('frecuenciaCardiaca')} keyboardType="number-pad" problema={problemaDe('frecuenciaCardiaca')} />
        <Campo etiqueta="Frecuencia respiratoria" unidad="rpm" value={m.frecuenciaRespiratoria} onChangeText={cambiarM('frecuenciaRespiratoria')} keyboardType="number-pad" problema={problemaDe('frecuenciaRespiratoria')} />
        <Campo etiqueta="Saturación de O₂" unidad="%" value={m.saturacionO2} onChangeText={cambiarM('saturacionO2')} keyboardType="number-pad" problema={problemaDe('saturacionO2')} />
        <Campo etiqueta="Presión sistólica" unidad="mmHg" value={m.presionSistolica} onChangeText={cambiarM('presionSistolica')} keyboardType="number-pad" problema={problemaDe('presionSistolica')} />
        <Campo etiqueta="Presión diastólica" unidad="mmHg" value={m.presionDiastolica} onChangeText={cambiarM('presionDiastolica')} keyboardType="number-pad" problema={problemaDe('presionDiastolica')} />
      </Seccion>

      <Seccion titulo="Exploración y plan">
        <Campo etiqueta="Exploración física" value={t.exploracionFisica} onChangeText={cambiarT('exploracionFisica')} multiline autoCapitalize="sentences" />
        <Campo etiqueta="Diagnósticos" value={t.diagnosticos} onChangeText={cambiarT('diagnosticos')} multiline autoCapitalize="sentences" />
        <Campo etiqueta="Estudios solicitados" value={t.estudiosSolicitados} onChangeText={cambiarT('estudiosSolicitados')} multiline autoCapitalize="sentences" />
        <Campo etiqueta="Tratamiento" value={t.tratamiento} onChangeText={cambiarT('tratamiento')} multiline autoCapitalize="sentences" />
        <Campo etiqueta="Indicaciones" value={t.indicaciones} onChangeText={cambiarT('indicaciones')} multiline autoCapitalize="sentences" />
        <Campo
          etiqueta="Fecha de seguimiento"
          value={t.fechaSeguimiento}
          onChangeText={cambiarT('fechaSeguimiento')}
          placeholder="DD/MM/AAAA"
          keyboardType="numbers-and-punctuation"
          problema={problemaDe('fechaSeguimiento')}
        />
      </Seccion>

      <Boton texto={guardando ? 'Guardando…' : 'Guardar consulta'} onPress={guardar} deshabilitado={guardando} />
    </PantallaFormulario>
  );
}
