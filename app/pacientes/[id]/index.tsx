// Expediente como un solo documento (decisión del médico, 25 nov 2026):
// arriba nombre, teléfono, último peso y talla; abajo cada visita en orden, la más reciente al final;
// al final, la visita nueva con su receta, sin salir de esta pantalla.
// Lo demás (historia clínica, gráficas, constancias, WhatsApp…) queda en "Expediente completo".

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ComponentRef, useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { evaluarConsulta } from '../../../src/crecimiento/consulta';
import { resumenNutricional } from '../../../src/crecimiento/interpretacion';
import { agregarNota, corregirVisita, crearVisita, listarConsultas, listarNotas, puedeCorregirVisita, VisitaEntrada } from '../../../src/db/consultas';
import { vincularConsulta } from '../../../src/db/agenda';
import { corregirDatosBasicos, obtenerPaciente } from '../../../src/db/pacientes';
import { crearFavorito, crearReceta, indicacionesSinFavorito, listarFavoritos, PESO_MAXIMO, PESO_MINIMO, Receta, recetasDePaciente, usarFavorito, validarIndicaciones } from '../../../src/db/recetas';
import { sumarDias, sumarMeses } from '../../../src/agenda/tiempo';
import { aISO, aTextoUsuario, calcularEdad, deDate, hoy, leerFechaISO, leerFechaUsuario, textoEdad } from '../../../src/domain/fechas';
import { Pastilla } from '../../../src/ui/agenda';
import type { Consulta, NotaAclaratoria, Paciente } from '../../../src/domain/types';
import { leerNumero } from '../../../src/domain/validacion';
import { usePlan } from '../../../src/plan/PlanProvider';
import { FONDO_RECETA } from '../../../src/receta/fondo';
import { fechaReceta, htmlReceta, nombreEnReceta, textoPeso } from '../../../src/receta/hoja';
import { imprimirHtml } from '../../../src/receta/imprimir';
import { marcarActividad } from '../../../src/seguridad/actividad';
import { useFocusEffectConSync } from '../../../src/sincronizacion/eventos';
import { Cargando, EnlaceTexto, estilos } from '../../../src/ui/componentes';
import { Alert } from '../../../src/ui/dialogo';
import { AvisoPro } from '../../../src/ui/pro';
import { colores, espacio, radio, texto } from '../../../src/ui/tema';

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

interface Borrador {
  peso: string;
  talla: string;
  pc: string;
  texto: string;
  receta: string;
  /** Cita de control, DD/MM/AAAA. */
  control: string;
}
const BORRADOR_VACIO: Borrador = { peso: '', talla: '', pc: '', texto: '', receta: '', control: '' };
/** Lo que se está escribiendo de la visita nueva no se pierde al ir a otra pantalla y volver. */
const borradores = new Map<string, Borrador>();

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
function fechaVisita(iso: string): string {
  const d = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  const hora = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return `${DIAS[d.getDay()]} ${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} · ${hora}:${dos(d.getMinutes())} ${d.getHours() < 12 ? 'a. m.' : 'p. m.'}`;
}

/** Atajos para la cita de control, contados desde hoy. */
const CONTROLES: [string, (desde: string) => string][] = [
  ['1 semana', (d) => sumarDias(d, 7)],
  ['2 semanas', (d) => sumarDias(d, 14)],
  ['1 mes', (d) => sumarMeses(d, 1)],
  ['2 meses', (d) => sumarMeses(d, 2)],
  ['3 meses', (d) => sumarMeses(d, 3)],
  ['6 meses', (d) => sumarMeses(d, 6)],
];

/** Lee la cita de control escrita (DD/MM/AAAA): vacía = sin control. */
function leerControl(t: string, desde: string = aISO(hoy())): { error: string } | { iso: string | null } {
  if (!t.trim()) return { iso: null };
  const f = leerFechaUsuario(t);
  if (!f) return { error: 'Cita de control: escriba la fecha como DD/MM/AAAA.' };
  const iso = aISO(f);
  if (iso <= desde) return { error: 'La cita de control debe ser una fecha después de la visita.' };
  return { iso };
}

/** "martes 04/12/2026" */
function fechaControl(iso: string): string {
  const f = leerFechaISO(iso);
  if (!f) return iso;
  return `${DIAS[new Date(f.anio, f.mes - 1, f.dia).getDay()]} ${aTextoUsuario(f)}`;
}

function texto0(n: number | null): string {
  return n == null ? '' : String(n);
}

/** Lee peso, talla y perímetro; devuelve el error o los valores. */
function leerMedidas(b: { peso: string; talla: string; pc: string }): { error: string } | { pesoKg: number | null; tallaCm: number | null; pc: number | null } {
  const peso = leerNumero(b.peso);
  const talla = leerNumero(b.talla);
  const pc = leerNumero(b.pc);
  if (peso !== null && (Number.isNaN(peso) || peso < PESO_MINIMO || peso > PESO_MAXIMO)) return { error: `Revise el peso: en kilogramos, entre ${PESO_MINIMO} y ${PESO_MAXIMO}.` };
  if (talla !== null && (Number.isNaN(talla) || talla < 25 || talla > 230)) return { error: 'Revise la talla: en centímetros, entre 25 y 230.' };
  if (pc !== null && (Number.isNaN(pc) || pc < 18 || pc > 70)) return { error: 'Revise el perímetro cefálico: en centímetros, entre 18 y 70.' };
  return { pesoKg: peso, tallaCm: talla, pc };
}

/** Un medicamento por párrafo: los renglones vacíos separan las indicaciones. */
function indicacionesDe(textoReceta: string): string[] {
  return textoReceta
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean);
}

async function imprimirReceta(p: Paciente, indicaciones: string[], pesoKg: number | null, fecha: Date) {
  try {
    await imprimirHtml(htmlReceta({ nombre: nombreEnReceta(p), pesoKg, fecha, indicaciones, fondo: FONDO_RECETA }));
  } catch {
    // Cancelar la impresión no es un error: la receta ya quedó guardada.
  }
}

// ---------------------------------------------------------------------------
// Pantalla
// ---------------------------------------------------------------------------

interface Datos {
  paciente: Paciente;
  visitas: Consulta[]; // de la más antigua a la más reciente
  recetas: Map<string, Receta[]>; // por visita
  notas: Map<string, NotaAclaratoria[]>;
}

export default function Expediente() {
  const db = useSQLiteContext();
  // citaId: se abrió desde una cita de la agenda; al guardar la visita, la cita queda completada.
  const { id, citaId } = useLocalSearchParams<{ id: string; citaId?: string }>();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [favoritos, setFavoritos] = useState<{ id: string; texto: string }[]>([]);
  const recargarFavoritos = useCallback(() => {
    void listarFavoritos(db).then((favs) => setFavoritos(favs.map((f) => ({ id: f.id, texto: f.texto }))));
  }, [db]);
  const desplazar = useRef<ComponentRef<typeof ScrollView>>(null);
  const yaBajo = useRef(false);

  const cargar = useCallback(() => {
    let vigente = true;
    void (async () => {
      const paciente = await obtenerPaciente(db, id);
      if (!paciente) return;
      const [lista, recetas, favs] = await Promise.all([listarConsultas(db, id), recetasDePaciente(db, id, 500), listarFavoritos(db)]);
      const visitas = [...lista].reverse();
      const porVisita = new Map<string, Receta[]>();
      for (const r of [...recetas].reverse()) if (r.consultaId) porVisita.set(r.consultaId, [...(porVisita.get(r.consultaId) ?? []), r]);
      const notas = new Map<string, NotaAclaratoria[]>();
      for (const v of visitas) {
        const n = await listarNotas(db, v.id);
        if (n.length > 0) notas.set(v.id, n);
      }
      if (!vigente) return;
      setDatos({ paciente, visitas, recetas: porVisita, notas });
      setFavoritos(favs.map((f) => ({ id: f.id, texto: f.texto })));
    })();
    return () => {
      vigente = false;
    };
  }, [db, id]);
  useFocusEffectConSync(cargar);

  if (!datos) return <Cargando />;
  const { paciente: p, visitas } = datos;
  const nac = leerFechaISO(p.fechaNacimiento);
  const edad = nac ? calcularEdad(nac, deDate(new Date())) : null;
  const edadMeses = edad ? edad.totalMeses : null;
  const ultimaConPeso = [...visitas].reverse().find((v) => v.pesoKg != null || v.tallaCm != null) ?? null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: `${p.nombres} ${p.apellidos}` }} />
      <ScrollView
        ref={desplazar}
        style={estilos.pantalla}
        contentContainerStyle={[estilos.contenido, { paddingBottom: 120 }]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          // Al abrir, bajar hasta la última visita y la visita nueva.
          if (!yaBajo.current && visitas.length > 0) {
            yaBajo.current = true;
            desplazar.current?.scrollToEnd({ animated: false });
          }
        }}
      >
        <Encabezado paciente={p} edadTexto={textoEdad(edad)} ultima={ultimaConPeso} alCambiar={cargar} />

        {visitas.length === 0 ? (
          <Text style={[estilos.suave, { marginVertical: espacio.l, textAlign: 'center' }]}>Todavía no hay visitas. Escriba la primera abajo.</Text>
        ) : (
          visitas.map((v) => (
            <BloqueVisita
              key={v.id}
              paciente={p}
              visita={v}
              recetas={datos.recetas.get(v.id) ?? []}
              notas={datos.notas.get(v.id) ?? []}
              edadMeses={edadMeses}
              favoritos={favoritos}
              alCambiarFavoritos={recargarFavoritos}
              alCambiar={cargar}
            />
          ))
        )}

        <NuevaVisita
          paciente={p}
          edadMeses={edadMeses}
          favoritos={favoritos}
          alCambiarFavoritos={recargarFavoritos}
          citaId={citaId}
          alGuardar={() => {
            if (citaId) router.setParams({ citaId: undefined });
            void cargar();
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Encabezado: nombre y teléfono (se corrigen aquí mismo), último peso y talla
// ---------------------------------------------------------------------------

function Encabezado({ paciente: p, edadTexto, ultima, alCambiar }: { paciente: Paciente; edadTexto: string; ultima: Consulta | null; alCambiar: () => void }) {
  const db = useSQLiteContext();
  const [editando, setEditando] = useState<'nombre' | 'telefono' | null>(null);
  const [nombres, setNombres] = useState(p.nombres);
  const [apellidos, setApellidos] = useState(p.apellidos);
  const [telefono, setTelefono] = useState(p.telefonoPrincipal);

  async function guardar() {
    try {
      await corregirDatosBasicos(db, p.id, editando === 'nombre' ? { nombres, apellidos } : { telefonoPrincipal: telefono });
      setEditando(null);
      alCambiar();
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <View style={s.encabezado}>
      {editando === 'nombre' ? (
        <View style={{ gap: espacio.s }}>
          <Entrada valor={nombres} alCambiar={setNombres} placeholder="Nombres" autoFocus />
          <Entrada valor={apellidos} alCambiar={setApellidos} placeholder="Apellidos" />
          <FilaBotones guardar={() => void guardar()} cancelar={() => { setNombres(p.nombres); setApellidos(p.apellidos); setEditando(null); }} />
        </View>
      ) : (
        <Pressable onPress={() => setEditando('nombre')} accessibilityRole="button" accessibilityHint="Corregir el nombre">
          <Text style={s.nombre}>
            {p.nombres} {p.apellidos} <Text style={s.lapiz}>✎</Text>
          </Text>
        </Pressable>
      )}
      <Text style={estilos.suave}>
        {[edadTexto, p.sexo === 'F' ? 'Femenino' : 'Masculino', `Exp. ${p.numeroExpediente}`].filter(Boolean).join(' · ')}
      </Text>

      {editando === 'telefono' ? (
        <View style={{ gap: espacio.s, marginTop: espacio.s }}>
          <Entrada valor={telefono} alCambiar={setTelefono} placeholder="Teléfono de contacto" teclado="phone-pad" autoFocus />
          <FilaBotones guardar={() => void guardar()} cancelar={() => { setTelefono(p.telefonoPrincipal); setEditando(null); }} />
        </View>
      ) : (
        <Pressable onPress={() => setEditando('telefono')} accessibilityRole="button" style={{ marginTop: espacio.s }}>
          <Text style={estilos.normal}>
            📞 {p.telefonoPrincipal || 'Sin teléfono de contacto'} <Text style={s.lapiz}>✎</Text>
          </Text>
        </Pressable>
      )}

      <Text style={[estilos.normal, { marginTop: espacio.xs }]}>
        ⚖️ {ultima ? [ultima.pesoKg != null ? textoPeso(ultima.pesoKg) : null, ultima.tallaCm != null ? `${ultima.tallaCm} cm` : null].filter(Boolean).join(' · ') : 'Sin peso ni talla'}
        {ultima ? <Text style={estilos.suave}> (último, {fechaReceta(new Date(ultima.fechaHora))})</Text> : null}
      </Text>

      <View style={s.enlaces}>
        <EnlaceTexto texto="Gráficas" onPress={() => router.push({ pathname: '/pacientes/[id]/crecimiento', params: { id: p.id } })} />
        <EnlaceTexto texto="Constancia" onPress={() => router.push({ pathname: '/constancias/nueva', params: { pacienteId: p.id } })} />
        <EnlaceTexto texto="Expediente completo" onPress={() => router.push({ pathname: '/pacientes/[id]/detalle', params: { id: p.id } })} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Una visita del historial
// ---------------------------------------------------------------------------

function BloqueVisita({
  paciente: p,
  visita: v,
  recetas,
  notas,
  edadMeses,
  favoritos,
  alCambiarFavoritos,
  alCambiar,
}: {
  paciente: Paciente;
  visita: Consulta;
  recetas: Receta[];
  notas: NotaAclaratoria[];
  edadMeses: number | null;
  favoritos: { id: string; texto: string }[];
  alCambiarFavoritos: () => void;
  alCambiar: () => void;
}) {
  const db = useSQLiteContext();
  const [corrigiendo, setCorrigiendo] = useState(false);
  const controlInicial = leerFechaISO(v.fechaSeguimiento);
  const [b, setB] = useState({
    peso: texto0(v.pesoKg),
    talla: texto0(v.tallaCm),
    pc: texto0(v.perimetroCefalicoCm),
    texto: v.texto,
    control: controlInicial ? aTextoUsuario(controlInicial) : '',
  });
  const [conReceta, setConReceta] = useState(false);
  const [conNota, setConNota] = useState(false);
  const [nota, setNota] = useState('');
  const mismoDia = puedeCorregirVisita(v.creadoEn);

  const ev = evaluarConsulta(p, v);
  const resumen = ev ? resumenNutricional(ev).map((r) => r.texto).join(' · ') : '';
  const medidas = [
    v.pesoKg != null ? `Peso ${textoPeso(v.pesoKg)}` : null,
    v.tallaCm != null ? `Talla ${v.tallaCm} cm` : null,
    v.perimetroCefalicoCm != null ? `PC ${v.perimetroCefalicoCm} cm` : null,
  ].filter(Boolean);
  // Visitas hechas con la pantalla anterior (por apartados): se muestran sus apartados escritos.
  const anteriores: [string, string][] = (
    [
      ['Motivo', v.motivo],
      ['Enfermedad actual', v.enfermedadActual],
      ['Síntomas', v.sintomas],
      ['Exploración', v.exploracionFisica],
      ['Diagnósticos', v.diagnosticos],
      ['Estudios', v.estudiosSolicitados],
      ['Tratamiento', v.tratamiento],
      ['Indicaciones', v.indicaciones],
    ] as [string, string][]
  ).filter(([, t]) => t.trim() !== '');

  async function guardarCorreccion() {
    const m = leerMedidas(b);
    if ('error' in m) {
      Alert.alert('Visita', m.error);
      return;
    }
    const c = leerControl(b.control, aISO(deDate(new Date(v.fechaHora))));
    if ('error' in c) {
      Alert.alert('Visita', c.error);
      return;
    }
    try {
      await corregirVisita(db, v.id, { texto: b.texto, pesoKg: m.pesoKg, tallaCm: m.tallaCm, perimetroCefalicoCm: m.pc, fechaSeguimiento: c.iso }, { edadMeses });
      setCorrigiendo(false);
      alCambiar();
    } catch (e) {
      Alert.alert('No se pudo corregir', e instanceof Error ? e.message : String(e));
    }
  }

  async function guardarNota() {
    try {
      await agregarNota(db, v.id, nota);
      setNota('');
      setConNota(false);
      alCambiar();
    } catch (e) {
      Alert.alert('Nota', e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <View style={s.visita}>
      <View style={s.visitaCabecera}>
        <Text style={s.visitaFecha}>{fechaVisita(v.fechaHora)}</Text>
        {mismoDia && !corrigiendo && <EnlaceTexto texto="Corregir" onPress={() => setCorrigiendo(true)} />}
      </View>

      {corrigiendo ? (
        <View style={{ gap: espacio.s }}>
          <CamposMedidas b={b} setB={(x) => setB((a) => ({ ...a, ...x }))} conPC={edadMeses != null && edadMeses < 36} />
          <Entrada valor={b.texto} alCambiar={(t) => setB((a) => ({ ...a, texto: t }))} multilinea placeholder="Escriba la visita" />
          <CitaControl valor={b.control} alCambiar={(t) => setB((a) => ({ ...a, control: t }))} desde={aISO(deDate(new Date(v.fechaHora)))} />
          <FilaBotones guardar={() => void guardarCorreccion()} cancelar={() => setCorrigiendo(false)} />
        </View>
      ) : (
        <>
          {medidas.length > 0 && <Text style={s.medidas}>{medidas.join(' · ')}</Text>}
          {resumen !== '' && <Text style={s.resumen}>{resumen}</Text>}
          {anteriores.map(([t, x]) => (
            <Text key={t} style={s.textoVisita}>
              <Text style={{ fontWeight: '700' }}>{t}: </Text>
              {x}
            </Text>
          ))}
          {v.texto !== '' && <Text style={s.textoVisita}>{v.texto}</Text>}
          {v.actualizadoEn && <Text style={s.mini}>Corregida el mismo día.</Text>}
        </>
      )}

      {notas.map((n) => (
        <Text key={n.id} style={s.nota}>
          <Text style={{ fontWeight: '700' }}>Nota ({fechaReceta(new Date(n.creadoEn))}): </Text>
          {n.texto}
        </Text>
      ))}

      {recetas.map((r) => (
        <View key={r.id} style={s.receta}>
          <View style={s.visitaCabecera}>
            <Text style={{ fontWeight: '700', color: colores.texto }}>℞ Receta</Text>
            <EnlaceTexto texto="Reimprimir" onPress={() => void imprimirReceta(p, r.indicaciones, r.pesoKg, new Date(r.fecha))} />
          </View>
          {r.indicaciones.map((t, i) => (
            <Text key={i} style={s.textoVisita}>
              {i + 1}. {t}
            </Text>
          ))}
        </View>
      ))}

      {v.fechaSeguimiento && !corrigiendo && (
        <Text style={s.control}>📅 Cita de control: {fechaControl(v.fechaSeguimiento)}</Text>
      )}

      {conReceta ? (
        <EditorReceta
          paciente={p}
          consultaId={v.id}
          pesoKg={v.pesoKg}
          favoritos={favoritos}
          alCambiarFavoritos={alCambiarFavoritos}
          alTerminar={() => {
            setConReceta(false);
            alCambiar();
          }}
        />
      ) : conNota ? (
        <View style={{ gap: espacio.s, marginTop: espacio.s }}>
          <Entrada valor={nota} alCambiar={setNota} multilinea placeholder="Nota aclaratoria (queda con la fecha de hoy)" autoFocus />
          <FilaBotones guardar={() => void guardarNota()} cancelar={() => setConNota(false)} />
        </View>
      ) : (
        !corrigiendo && (
          <View style={s.enlaces}>
            <EnlaceTexto texto={recetas.length > 0 ? '＋ Otra receta' : '＋ Receta'} onPress={() => setConReceta(true)} />
            {!mismoDia && <EnlaceTexto texto="＋ Nota" onPress={() => setConNota(true)} />}
          </View>
        )
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Visita nueva (al final del documento) con su receta
// ---------------------------------------------------------------------------

function NuevaVisita({
  paciente: p,
  edadMeses,
  favoritos,
  alCambiarFavoritos,
  citaId,
  alGuardar,
}: {
  paciente: Paciente;
  edadMeses: number | null;
  favoritos: { id: string; texto: string }[];
  alCambiarFavoritos: () => void;
  citaId?: string;
  alGuardar: () => void;
}) {
  const db = useSQLiteContext();
  const { esPro } = usePlan();
  const [b, setBEstado] = useState<Borrador>(() => borradores.get(p.id) ?? BORRADOR_VACIO);
  const [guardando, setGuardando] = useState(false);
  const setB = (x: Partial<Borrador>) =>
    setBEstado((a) => {
      const nuevo = { ...a, ...x };
      borradores.set(p.id, nuevo);
      return nuevo;
    });

  async function guardar(conImpresion: boolean) {
    const m = leerMedidas(b);
    if ('error' in m) {
      Alert.alert('Visita', m.error);
      return;
    }
    const c = leerControl(b.control);
    if ('error' in c) {
      Alert.alert('Visita', c.error);
      return;
    }
    const indicaciones = indicacionesDe(b.receta);
    if (conImpresion || indicaciones.length > 0) {
      const error = validarIndicaciones(indicaciones);
      if (error) {
        Alert.alert('Receta', error);
        return;
      }
    }
    setGuardando(true);
    try {
      const visita: VisitaEntrada = { texto: b.texto, pesoKg: m.pesoKg, tallaCm: m.tallaCm, perimetroCefalicoCm: m.pc, fechaSeguimiento: c.iso };
      const consultaId = await crearVisita(db, p.id, visita, { edadMeses });
      if (indicaciones.length > 0) {
        await crearReceta(db, { pacienteId: p.id, consultaId, indicaciones, pesoKg: m.pesoKg });
        if (conImpresion) await imprimirReceta(p, indicaciones, m.pesoKg, new Date());
      }
      if (citaId) {
        // La visita ya quedó guardada; si falla el enlace con la cita, solo se avisa.
        try {
          await vincularConsulta(db, citaId, consultaId);
        } catch (e) {
          Alert.alert('Visita guardada', `No se pudo marcar la cita como completada: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      borradores.delete(p.id);
      setBEstado(BORRADOR_VACIO);
      alGuardar();
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  const hayReceta = indicacionesDe(b.receta).length > 0;
  return (
    <View style={[s.visita, s.nueva]}>
      <Text style={s.visitaFecha}>Visita de hoy · {fechaReceta(new Date())}</Text>
      <CamposMedidas b={b} setB={setB} conPC={edadMeses != null && edadMeses < 36} />
      <Entrada valor={b.texto} alCambiar={(t) => setB({ texto: t })} multilinea alto={200} placeholder="Escriba la visita: lo que necesite, como en su cuaderno." />

      <Text style={[s.visitaFecha, { marginTop: espacio.m }]}>℞ Receta</Text>
      {esPro ? (
        <>
          <Entrada
            valor={b.receta}
            alCambiar={(t) => setB({ receta: t })}
            multilinea
            placeholder={'Un medicamento por párrafo.\nDeje un renglón vacío entre cada uno.'}
          />
          <Favoritos
            favoritos={favoritos}
            alElegir={(f) => {
              setB({ receta: b.receta.trim() ? `${b.receta.trim()}\n\n${f.texto}` : f.texto });
              void usarFavorito(db, f.id);
            }}
          />
          <GuardarFavoritos indicaciones={indicacionesDe(b.receta)} favoritos={favoritos} alGuardar={alCambiarFavoritos} />
          {b.peso.trim() !== '' && hayReceta && <Text style={s.mini}>La receta lleva el peso de esta visita.</Text>}
        </>
      ) : (
        <AvisoPro funcion="receta" compacto />
      )}

      <CitaControl valor={b.control} alCambiar={(t) => setB({ control: t })} />

      <View style={{ gap: espacio.s, marginTop: espacio.m }}>
        {esPro && hayReceta && (
          <Boton1 texto={guardando ? 'Guardando…' : 'Guardar visita e imprimir receta'} onPress={() => void guardar(true)} deshabilitado={guardando} />
        )}
        <Boton1
          texto={guardando ? 'Guardando…' : hayReceta ? 'Guardar sin imprimir' : 'Guardar visita'}
          onPress={() => void guardar(false)}
          deshabilitado={guardando}
          secundario={esPro && hayReceta}
        />
      </View>
    </View>
  );
}

// Receta agregada a una visita ya guardada.
function EditorReceta({
  paciente: p,
  consultaId,
  pesoKg,
  favoritos,
  alCambiarFavoritos,
  alTerminar,
}: {
  paciente: Paciente;
  consultaId: string;
  pesoKg: number | null;
  favoritos: { id: string; texto: string }[];
  alCambiarFavoritos: () => void;
  alTerminar: () => void;
}) {
  const db = useSQLiteContext();
  const { esPro } = usePlan();
  const [t, setT] = useState('');
  if (!esPro) return <AvisoPro funcion="receta" compacto />;

  async function guardar(conImpresion: boolean) {
    const indicaciones = indicacionesDe(t);
    const error = validarIndicaciones(indicaciones);
    if (error) {
      Alert.alert('Receta', error);
      return;
    }
    try {
      await crearReceta(db, { pacienteId: p.id, consultaId, indicaciones, pesoKg });
      if (conImpresion) await imprimirReceta(p, indicaciones, pesoKg, new Date());
      alTerminar();
    } catch (e) {
      Alert.alert('No se pudo guardar la receta', e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <View style={{ gap: espacio.s, marginTop: espacio.s }}>
      <Entrada valor={t} alCambiar={setT} multilinea autoFocus placeholder={'Un medicamento por párrafo.\nDeje un renglón vacío entre cada uno.'} />
      <Favoritos
        favoritos={favoritos}
        alElegir={(f) => {
          setT((a) => (a.trim() ? `${a.trim()}\n\n${f.texto}` : f.texto));
          void usarFavorito(db, f.id);
        }}
      />
      <GuardarFavoritos indicaciones={indicacionesDe(t)} favoritos={favoritos} alGuardar={alCambiarFavoritos} />
      <Boton1 texto="Guardar e imprimir receta" onPress={() => void guardar(true)} />
      <View style={s.enlaces}>
        <EnlaceTexto texto="Guardar sin imprimir" onPress={() => void guardar(false)} />
        <EnlaceTexto texto="Cancelar" onPress={alTerminar} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Piezas pequeñas
// ---------------------------------------------------------------------------

function CamposMedidas({ b, setB, conPC }: { b: { peso: string; talla: string; pc: string }; setB: (x: Partial<Borrador>) => void; conPC: boolean }) {
  return (
    <View style={s.filaMedidas}>
      <Medida etiqueta="Peso (kg)" valor={b.peso} alCambiar={(v) => setB({ peso: v })} />
      <Medida etiqueta="Talla (cm)" valor={b.talla} alCambiar={(v) => setB({ talla: v })} />
      {conPC && <Medida etiqueta="PC (cm)" valor={b.pc} alCambiar={(v) => setB({ pc: v })} />}
    </View>
  );
}

function Medida({ etiqueta, valor, alCambiar }: { etiqueta: string; valor: string; alCambiar: (v: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.etiqueta}>{etiqueta}</Text>
      <Entrada valor={valor} alCambiar={(v) => alCambiar(v.replace(',', '.'))} teclado="decimal-pad" />
    </View>
  );
}

function Entrada({
  valor,
  alCambiar,
  placeholder,
  multilinea,
  alto,
  teclado,
  autoFocus,
}: {
  valor: string;
  alCambiar: (v: string) => void;
  placeholder?: string;
  multilinea?: boolean;
  alto?: number;
  teclado?: 'decimal-pad' | 'phone-pad' | 'numbers-and-punctuation';
  autoFocus?: boolean;
}) {
  return (
    <TextInput
      value={valor}
      onChangeText={(v) => {
        marcarActividad();
        alCambiar(v);
      }}
      placeholder={placeholder}
      placeholderTextColor={colores.textoSuave}
      multiline={multilinea}
      keyboardType={teclado}
      autoFocus={autoFocus}
      textAlignVertical={multilinea ? 'top' : 'center'}
      autoCapitalize="sentences"
      style={[s.entrada, multilinea && { minHeight: alto ?? 110 }]}
    />
  );
}

function Favoritos({ favoritos, alElegir }: { favoritos: { id: string; texto: string }[]; alElegir: (f: { id: string; texto: string }) => void }) {
  if (favoritos.length === 0) return null;
  return (
    <View style={s.chips}>
      {favoritos.slice(0, 12).map((f) => (
        <Pressable key={f.id} onPress={() => alElegir(f)} style={({ pressed }) => [s.chip, pressed && { opacity: 0.7 }]} accessibilityRole="button">
          <Text style={s.chipTexto} numberOfLines={1}>
            ＋ {f.texto.split('\n')[0]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Cita de control: fecha escrita o con un toque (1 semana, 1 mes…). La usan los recordatorios de controles. */
function CitaControl({ valor, alCambiar, desde = aISO(hoy()) }: { valor: string; alCambiar: (t: string) => void; desde?: string }) {
  const c = leerControl(valor, desde);
  return (
    <View style={{ gap: espacio.s, marginTop: espacio.m }}>
      <Text style={s.visitaFecha}>📅 Cita de control</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CONTROLES.map(([etiqueta, calcular]) => {
          const f = leerFechaISO(calcular(desde));
          const t = f ? aTextoUsuario(f) : '';
          return <Pastilla key={etiqueta} texto={etiqueta} activa={valor === t} onPress={() => alCambiar(valor === t ? '' : t)} />;
        })}
      </View>
      <Entrada valor={valor} alCambiar={alCambiar} placeholder="DD/MM/AAAA (vacío = sin control)" teclado="numbers-and-punctuation" />
      {'iso' in c && c.iso && <Text style={s.mini}>Control el {fechaControl(c.iso)}. La app le recordará cuando se acerque.</Text>}
      {'error' in c && <Text style={[s.mini, { color: colores.peligro }]}>{c.error}</Text>}
    </View>
  );
}

/** Cada medicamento escrito que aún no es favorito tiene su botón para guardarlo. */
function GuardarFavoritos({
  indicaciones,
  favoritos,
  alGuardar,
}: {
  indicaciones: string[];
  favoritos: { texto: string }[];
  alGuardar: () => void;
}) {
  const db = useSQLiteContext();
  const [guardando, setGuardando] = useState<string | null>(null);
  const nuevas = indicacionesSinFavorito(indicaciones, favoritos);
  if (nuevas.length === 0) return null;

  async function guardar(t: string) {
    setGuardando(t);
    try {
      await crearFavorito(db, t);
      alGuardar();
    } catch (e) {
      Alert.alert('No se pudo guardar en favoritos', e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(null);
    }
  }

  return (
    <View style={{ gap: 4 }}>
      {nuevas.map((t) => (
        <Pressable
          key={t}
          onPress={() => void guardar(t)}
          disabled={guardando !== null}
          style={({ pressed }) => [s.guardarFav, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={`Guardar como favorito: ${t}`}
        >
          <Text style={s.guardarFavTexto} numberOfLines={1}>
            {guardando === t ? 'Guardando…' : `☆ Guardar como favorito: ${t.split('\n')[0]}`}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function FilaBotones({ guardar, cancelar }: { guardar: () => void; cancelar: () => void }) {
  return (
    <View style={s.enlaces}>
      <Boton1 texto="Guardar" onPress={guardar} />
      <EnlaceTexto texto="Cancelar" onPress={cancelar} />
    </View>
  );
}

function Boton1({ texto: t, onPress, deshabilitado, secundario }: { texto: string; onPress: () => void; deshabilitado?: boolean; secundario?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      style={({ pressed }) => [s.boton, secundario && s.botonSecundario, (pressed || deshabilitado) && { opacity: 0.7 }]}
    >
      <Text style={[s.botonTexto, secundario && { color: colores.primario }]}>{t}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  encabezado: {
    backgroundColor: colores.superficie,
    borderRadius: radio.m,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: espacio.m,
    marginBottom: espacio.m,
  },
  nombre: { fontSize: texto.titulo, fontWeight: '700', color: colores.texto },
  lapiz: { fontSize: texto.normal, color: colores.primario },
  enlaces: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espacio.l, marginTop: espacio.s },
  visita: {
    backgroundColor: colores.superficie,
    borderRadius: radio.m,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: espacio.m,
    marginBottom: espacio.m,
    gap: 4,
  },
  nueva: { borderColor: colores.primario, borderWidth: 2 },
  visitaCabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  visitaFecha: { fontSize: texto.normal, fontWeight: '700', color: colores.primario, textTransform: 'capitalize' },
  medidas: { fontSize: texto.normal, color: colores.texto, fontWeight: '600' },
  resumen: { fontSize: texto.pequeno, color: colores.textoSuave },
  textoVisita: { fontSize: texto.normal, color: colores.texto, lineHeight: 22 },
  nota: { fontSize: texto.pequeno, color: colores.texto, backgroundColor: colores.fondo, padding: espacio.s, borderRadius: radio.s, marginTop: 4 },
  receta: { borderTopWidth: 1, borderTopColor: colores.borde, marginTop: espacio.s, paddingTop: espacio.s, gap: 2 },
  mini: { fontSize: texto.mini, color: colores.textoSuave },
  control: { fontSize: texto.normal, color: colores.texto, fontWeight: '600', marginTop: espacio.s },
  etiqueta: { fontSize: texto.pequeno, color: colores.textoSuave, marginBottom: 2 },
  filaMedidas: { flexDirection: 'row', gap: espacio.s, marginTop: espacio.s },
  entrada: {
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radio.s,
    paddingHorizontal: espacio.s,
    paddingVertical: 10,
    fontSize: texto.normal,
    color: colores.texto,
    backgroundColor: '#FFFFFF',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s },
  chip: { borderWidth: 1, borderColor: colores.primario, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 260 },
  chipTexto: { fontSize: texto.pequeno, color: colores.primario },
  guardarFav: { alignSelf: 'flex-start', paddingVertical: 4, maxWidth: '100%' },
  guardarFavTexto: { fontSize: texto.pequeno, color: colores.primario, fontWeight: '600' },
  boton: { backgroundColor: colores.primario, borderRadius: radio.m, paddingVertical: 12, paddingHorizontal: espacio.l, alignItems: 'center' },
  botonSecundario: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colores.primario },
  botonTexto: { color: '#FFFFFF', fontSize: texto.normal, fontWeight: '700' },
});
