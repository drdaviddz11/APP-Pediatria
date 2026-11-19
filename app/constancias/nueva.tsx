// Nueva constancia: elegir el tipo, revisar el texto (ya escrito), diagnósticos, guardar e imprimir o crear el PDF.

import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { htmlConstancia, HOJA_CARTA, nombreArchivoConstancia, tamanoDiagnosticos, tamanoTexto } from '../../src/constancia/hoja';
import {
  diagnosticosSugeridos,
  DIAS_REPOSO_MAXIMO,
  edadParaConstancia,
  limpiarDiagnosticos,
  MAXIMO_DIAGNOSTICOS,
  textoConstancia,
  TipoConstancia,
  TIPOS_CONSTANCIA,
  validarConstancia,
} from '../../src/constancia/plantillas';
import { crearConstancia, errorDeEspacio, leerFirma, obtenerConstancia } from '../../src/db/constancias';
import { obtenerConsulta } from '../../src/db/consultas';
import { obtenerPaciente } from '../../src/db/pacientes';
import { aTextoUsuario, deDate, leerFechaUsuario } from '../../src/domain/fechas';
import type { Consulta, Paciente } from '../../src/domain/types';
import { usePlan } from '../../src/plan/PlanProvider';
import { FONDO_RECETA } from '../../src/receta/fondo';
import { fechaReceta, nombreEnReceta } from '../../src/receta/hoja';
import { compartirPdf, imprimirHtml, PDF_CON_DIALOGO_DE_IMPRESION } from '../../src/receta/imprimir';
import { Aviso, Boton, Campo, Cargando, EnlaceTexto, PantallaFormulario, Seccion, Selector, estilos } from '../../src/ui/componentes';
import { Alert } from '../../src/ui/dialogo';
import { PantallaSoloPro } from '../../src/ui/pro';
import { colores, espacio, texto } from '../../src/ui/tema';

export default function Pantalla() {
  const { esPro } = usePlan();
  return esPro ? <NuevaConstancia /> : <PantallaSoloPro funcion="constancia" />;
}

function fechaLocal(f: { anio: number; mes: number; dia: number }): Date {
  return new Date(f.anio, f.mes - 1, f.dia);
}

function NuevaConstancia() {
  const db = useSQLiteContext();
  const { pacienteId, consultaId, base } = useLocalSearchParams<{ pacienteId: string; consultaId?: string; base?: string }>();
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [firma, setFirma] = useState<string | null>(null);
  const [fecha] = useState(() => new Date());
  const [tipo, setTipo] = useState<TipoConstancia>('atencion');
  const [dias, setDias] = useState('3');
  const [desde, setDesde] = useState('');
  const [actividades, setActividades] = useState('escolares y deportivas');
  const [textoConst, setTextoConst] = useState('');
  const [editado, setEditado] = useState(false);
  const [diagnosticos, setDiagnosticos] = useState<string[]>(['']);
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);

  // Día de la atención: el de la consulta, o hoy.
  const fechaAtencion = consulta ? new Date(consulta.fechaHora) : fecha;

  useEffect(() => {
    void (async () => {
      const p = await obtenerPaciente(db, pacienteId);
      const c = consultaId ? await obtenerConsulta(db, consultaId) : null;
      setPaciente(p);
      setConsulta(c);
      setFirma(await leerFirma(db));
      setDesde(aTextoUsuario(deDate(c ? new Date(c.fechaHora) : new Date())));
      const anterior = base ? await obtenerConstancia(db, base) : null;
      if (anterior) {
        setTipo(anterior.tipo);
        setTextoConst(anterior.texto);
        setEditado(true);
        setDiagnosticos(anterior.diagnosticos.length > 0 ? anterior.diagnosticos : ['']);
      } else if (p) {
        const dx = diagnosticosSugeridos('atencion', c?.diagnosticos ?? '', p.sexo);
        setDiagnosticos(dx.length > 0 ? dx : ['']);
      }
      setListo(true);
    })();
  }, [db, pacienteId, consultaId, base]);

  const inicioReposo = leerFechaUsuario(desde);
  const diasReposo = Number(dias.trim());
  const reposoValido = Number.isInteger(diasReposo) && diasReposo >= 1 && diasReposo <= DIAS_REPOSO_MAXIMO && inicioReposo !== null;

  function generar(t: TipoConstancia): string {
    if (!paciente) return '';
    return textoConstancia(t, {
      nombre: nombreEnReceta(paciente),
      sexo: paciente.sexo,
      edad: edadParaConstancia(paciente.fechaNacimiento, fechaAtencion),
      fechaAtencion,
      diasReposo: reposoValido ? diasReposo : 1,
      inicioReposo: inicioReposo ? fechaLocal(inicioReposo) : fechaAtencion,
      actividades,
    });
  }

  // Mientras no lo haya cambiado a mano, el texto se actualiza solo con los datos.
  useEffect(() => {
    if (listo && !editado) setTextoConst(generar(tipo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, editado, tipo, dias, desde, actividades, paciente, consulta]);

  if (!paciente || !listo) return <Cargando />;
  const p = paciente;

  function cambiarTipo(nuevo: TipoConstancia) {
    const aplicar = () => {
      // Los diagnósticos sugeridos cambian solo si no se habían tocado.
      const antes = limpiarDiagnosticos(diagnosticos);
      const sugeridosAntes = diagnosticosSugeridos(tipo, consulta?.diagnosticos ?? '', p.sexo);
      if (antes.length === 0 || antes.join('\n') === sugeridosAntes.join('\n')) {
        const dx = diagnosticosSugeridos(nuevo, consulta?.diagnosticos ?? '', p.sexo);
        setDiagnosticos(dx.length > 0 ? dx : ['']);
      }
      setTipo(nuevo);
      setEditado(false);
    };
    if (editado && textoConst.trim()) {
      Alert.alert('Cambiar el tipo', 'Usted cambió el texto a mano. ¿Reemplazarlo por el texto del nuevo tipo?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reemplazar', onPress: aplicar },
      ]);
    } else aplicar();
  }

  const limpios = limpiarDiagnosticos(diagnosticos);
  const avisoEspacio = textoConst.trim() && limpios.length > 0 ? errorDeEspacio(textoConst, limpios) : null;
  const letra = tamanoTexto(textoConst).puntos;
  const letraDx = tamanoDiagnosticos(limpios).puntos;

  async function guardar(accion: 'imprimir' | 'pdf') {
    const error =
      (tipo === 'reposo' && !reposoValido ? `Reposo: escriba de 1 a ${DIAS_REPOSO_MAXIMO} días y la fecha de inicio (DD/MM/AAAA).` : null) ??
      validarConstancia(textoConst, diagnosticos) ??
      errorDeEspacio(textoConst, diagnosticos);
    if (error) {
      Alert.alert('Constancia', error);
      return;
    }
    setGuardando(true);
    let id: string;
    try {
      id = await crearConstancia(db, { pacienteId, consultaId: consultaId ?? null, tipo, texto: textoConst, diagnosticos, fecha });
    } catch (e) {
      setGuardando(false);
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
      return;
    }
    const nombreArchivo = nombreArchivoConstancia(nombreEnReceta(p), fecha);
    const html = htmlConstancia({
      id,
      titulo: nombreArchivo.replace(/\.pdf$/, ''),
      nombre: nombreEnReceta(p),
      fecha,
      texto: textoConst,
      diagnosticos: limpios,
      fondo: FONDO_RECETA,
      firma,
    });
    try {
      if (accion === 'pdf') await compartirPdf(html, nombreArchivo, HOJA_CARTA);
      else await imprimirHtml(html, HOJA_CARTA);
    } catch {
      // Si se cancela, la constancia ya está guardada y se puede imprimir desde su detalle.
    }
    router.replace({ pathname: '/constancias/[id]', params: { id } });
  }

  return (
    <PantallaFormulario>
      <Seccion titulo="Constancia">
        <Text style={estilos.normal}>
          <Text style={{ fontWeight: '700' }}>Nombre: </Text>
          {nombreEnReceta(p)}
        </Text>
        <Text style={[estilos.normal, { marginBottom: espacio.m }]}>
          <Text style={{ fontWeight: '700' }}>Fecha: </Text>
          {fechaReceta(fecha)}
        </Text>
        <Selector
          etiqueta="Tipo"
          opciones={TIPOS_CONSTANCIA.map((t) => ({ valor: t.tipo, texto: t.titulo }))}
          valor={tipo}
          alCambiar={cambiarTipo}
        />
        {tipo === 'reposo' && (
          <View style={s.fila}>
            <View style={{ flex: 1 }}>
              <Campo etiqueta="Días de reposo" value={dias} onChangeText={setDias} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Campo etiqueta="Desde" value={desde} onChangeText={setDesde} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" />
            </View>
          </View>
        )}
        {tipo === 'reposo' && !reposoValido && (
          <Text style={[estilos.pequeno, { color: colores.peligro, marginBottom: espacio.s }]}>
            Escriba de 1 a {DIAS_REPOSO_MAXIMO} días y la fecha de inicio como DD/MM/AAAA.
          </Text>
        )}
        {tipo === 'buena_salud' && (
          <Campo etiqueta="Apto(a) para actividades" value={actividades} onChangeText={setActividades} ayuda="Por ejemplo: escolares y deportivas; de natación; de campamento." />
        )}
      </Seccion>

      <Seccion
        titulo="Texto de la constancia"
        accion={tipo !== 'libre' && editado ? <EnlaceTexto texto="Volver a generar" onPress={() => setEditado(false)} /> : undefined}
      >
        <Campo
          etiqueta=""
          value={textoConst}
          onChangeText={(v) => {
            setTextoConst(v);
            setEditado(true);
          }}
          multiline
          style={{ minHeight: 180 }}
          placeholder="Escriba el texto de la constancia. Deje un renglón vacío entre párrafos."
          ayuda={
            tipo === 'libre'
              ? 'Deje un renglón vacío entre párrafos.'
              : editado
                ? 'Usted cambió el texto: los datos de arriba ya no lo actualizan (toque "Volver a generar").'
                : 'Ya está escrito con los datos del paciente; puede corregir lo que necesite.'
          }
        />
        {textoConst.trim() !== '' && letra < 11 && <Text style={estilos.suave}>Texto largo: se imprimirá con letra de {letra} pt.</Text>}
      </Seccion>

      <Seccion titulo="Diagnósticos">
        {diagnosticos.map((d, i) => (
          <View key={i} style={s.dx}>
            <Text style={s.numero}>{i + 1}.</Text>
            <View style={{ flex: 1 }}>
              <Campo etiqueta="" value={d} onChangeText={(v) => setDiagnosticos((l) => l.map((x, j) => (j === i ? v : x)))} autoCapitalize="sentences" />
            </View>
            {(diagnosticos.length > 1 || d.trim() !== '') && (
              <View style={{ marginTop: 12 }}>
                <EnlaceTexto texto="Quitar" onPress={() => setDiagnosticos((l) => (l.length === 1 ? [''] : l.filter((_, j) => j !== i)))} />
              </View>
            )}
          </View>
        ))}
        {diagnosticos.length < MAXIMO_DIAGNOSTICOS && (
          <Boton texto="+ Agregar diagnóstico" variante="secundario" onPress={() => setDiagnosticos((l) => [...l, ''])} />
        )}
        {limpios.length > 0 && letraDx < 11 && <Text style={estilos.suave}>Se imprimirán con letra de {letraDx} pt para que quepan.</Text>}
      </Seccion>

      {!firma && (
        <Aviso>
          No ha subido su firma y sello: la constancia saldrá con espacio para firmar a mano.{' '}
          <Text style={{ fontWeight: '700', color: colores.primario }} onPress={() => router.push('/firma')}>
            Subir firma y sello
          </Text>
        </Aviso>
      )}
      {avisoEspacio && <Aviso>{avisoEspacio}</Aviso>}

      <Boton texto={guardando ? 'Guardando…' : 'Guardar e imprimir'} onPress={() => void guardar('imprimir')} deshabilitado={guardando} />
      <Boton texto="Guardar y crear PDF" variante="secundario" onPress={() => void guardar('pdf')} deshabilitado={guardando} />
      <Text style={[estilos.suave, { fontSize: texto.mini, marginTop: espacio.s }]}>
        {PDF_CON_DIALOGO_DE_IMPRESION
          ? 'Para el PDF se abre el cuadro de impresión: en "Destino" elija "Guardar como PDF". '
          : 'El PDF se puede enviar por WhatsApp o correo, o guardar en Archivos. '}
        La constancia queda guardada en el expediente; para corregirla, haga una nueva.
      </Text>
    </PantallaFormulario>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', gap: espacio.m },
  dx: { flexDirection: 'row', gap: espacio.s, alignItems: 'flex-start' },
  numero: { fontSize: texto.normal, fontWeight: '700', color: colores.texto, width: 24, marginTop: 12 },
});
