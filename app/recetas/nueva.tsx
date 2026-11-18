// Nueva receta: indicaciones (con favoritos para agregarlas de un toque), guardar en el expediente e imprimir.

import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { obtenerPaciente } from '../../src/db/pacientes';
import { crearFavorito, crearReceta, Favorito, listarFavoritos, obtenerReceta, PESO_MAXIMO, PESO_MINIMO, pesoParaReceta, usarFavorito, validarIndicaciones } from '../../src/db/recetas';
import { leerNumero } from '../../src/domain/validacion';
import { isoATextoCorto } from '../../src/domain/fechas';
import type { Paciente } from '../../src/domain/types';
import { FONDO_RECETA } from '../../src/receta/fondo';
import { fechaReceta, htmlReceta, limpiarIndicaciones, nombreEnReceta, paginar } from '../../src/receta/hoja';
import { imprimirHtml } from '../../src/receta/imprimir';
import { useFocusEffectConSync } from '../../src/sincronizacion/eventos';
import { Aviso, Boton, Campo, Cargando, EnlaceTexto, PantallaFormulario, Seccion, estilos } from '../../src/ui/componentes';
import { Alert } from '../../src/ui/dialogo';
import { colores, espacio, radio, texto } from '../../src/ui/tema';
import { usePlan } from '../../src/plan/PlanProvider';
import { PantallaSoloPro } from '../../src/ui/pro';

export default function Pantalla() {
  const { esPro } = usePlan();
  return esPro ? <NuevaReceta /> : <PantallaSoloPro funcion="receta" />;
}

function NuevaReceta() {
  const db = useSQLiteContext();
  // base: id de otra receta cuyas indicaciones se copian (para repetirla o corregirla).
  const { pacienteId, consultaId, base } = useLocalSearchParams<{ pacienteId: string; consultaId?: string; base?: string }>();
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [indicaciones, setIndicaciones] = useState<string[]>(['']);
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [buscar, setBuscar] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [fecha] = useState(() => new Date());
  const [peso, setPeso] = useState('');
  const [origenPeso, setOrigenPeso] = useState<string | null>(null);

  useEffect(() => {
    void obtenerPaciente(db, pacienteId).then(setPaciente);
    void pesoParaReceta(db, pacienteId, consultaId).then((p) => {
      if (!p) return;
      setPeso(String(Number(p.pesoKg.toFixed(2))));
      setOrigenPeso(isoATextoCorto(p.fecha));
    });
    if (base) void obtenerReceta(db, base).then((r) => r && r.indicaciones.length > 0 && setIndicaciones(r.indicaciones));
  }, [db, pacienteId, consultaId, base]);

  const cargarFavoritos = useCallback(() => {
    let vigente = true;
    void listarFavoritos(db, buscar).then((f) => vigente && setFavoritos(f));
    return () => {
      vigente = false;
    };
  }, [db, buscar]);
  useFocusEffectConSync(cargarFavoritos);

  if (!paciente) return <Cargando />;

  const limpias = limpiarIndicaciones(indicaciones);
  const hojas = paginar(limpias).length;

  function cambiar(i: number, v: string) {
    setIndicaciones((l) => l.map((x, j) => (j === i ? v : x)));
  }

  function quitar(i: number) {
    setIndicaciones((l) => (l.length === 1 ? [''] : l.filter((_, j) => j !== i)));
  }

  async function agregarFavorito(f: Favorito) {
    // Si el último renglón está vacío, se usa; si no, se agrega uno nuevo.
    setIndicaciones((l) => (l[l.length - 1].trim() === '' ? [...l.slice(0, -1), f.texto] : [...l, f.texto]));
    await usarFavorito(db, f.id);
  }

  async function guardarComoFavorito(t: string) {
    try {
      await crearFavorito(db, t);
      cargarFavoritos();
      Alert.alert('Guardado en favoritos', 'La próxima vez la agrega con un toque.');
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    }
  }

  async function guardarEImprimir() {
    if (!paciente) return;
    const error = validarIndicaciones(indicaciones);
    if (error) {
      Alert.alert('Receta', error);
      return;
    }
    const pesoKg = peso.trim() ? leerNumero(peso) : null;
    if (peso.trim() && (pesoKg === null || pesoKg < PESO_MINIMO || pesoKg > PESO_MAXIMO)) {
      Alert.alert('Peso', `Escriba el peso en kg (por ejemplo 12.5), o déjelo vacío para no imprimirlo.`);
      return;
    }
    setGuardando(true);
    let id: string;
    try {
      id = await crearReceta(db, { pacienteId, consultaId: consultaId ?? null, indicaciones, fecha, pesoKg });
    } catch (e) {
      setGuardando(false);
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
      return;
    }
    try {
      await imprimirHtml(htmlReceta({ nombre: nombreEnReceta(paciente), pesoKg, fecha, indicaciones: limpias, fondo: FONDO_RECETA }));
    } catch {
      // Si se cancela la impresión, la receta ya está guardada y se puede imprimir desde su detalle.
    }
    router.replace({ pathname: '/recetas/[id]', params: { id } });
  }

  return (
    <PantallaFormulario>
      <Seccion titulo="Receta">
        <Text style={estilos.normal}>
          <Text style={{ fontWeight: '700' }}>Nombre: </Text>
          {nombreEnReceta(paciente)}
        </Text>
        <Text style={[estilos.normal, { marginBottom: espacio.m }]}>
          <Text style={{ fontWeight: '700' }}>Fecha: </Text>
          {fechaReceta(fecha)}
        </Text>
        <Campo
          etiqueta="Peso"
          unidad="kg"
          value={peso}
          onChangeText={setPeso}
          keyboardType="decimal-pad"
          placeholder="Sin peso registrado"
          ayuda={origenPeso ? `Tomado de la consulta del ${origenPeso}. Puede cambiarlo; si lo deja vacío no se imprime.` : 'Si lo deja vacío no se imprime.'}
        />
      </Seccion>

      <Seccion titulo="℞ Indicaciones">
        {indicaciones.map((t, i) => (
          <View key={i} style={s.indicacion}>
            <Text style={s.numero}>{i + 1}.</Text>
            <View style={{ flex: 1 }}>
              <Campo
                etiqueta=""
                value={t}
                onChangeText={(v) => cambiar(i, v)}
                multiline
                autoCapitalize="sentences"
                placeholder={'Medicamento y presentación\nDosis, cada cuánto y por cuántos días'}
              />
              <View style={s.acciones}>
                {t.trim() !== '' && <EnlaceTexto texto="☆ Guardar en favoritos" onPress={() => void guardarComoFavorito(t)} />}
                {(indicaciones.length > 1 || t.trim() !== '') && <EnlaceTexto texto="Quitar" onPress={() => quitar(i)} />}
              </View>
            </View>
          </View>
        ))}
        <Boton texto="+ Agregar indicación" variante="secundario" onPress={() => setIndicaciones((l) => [...l, ''])} />
      </Seccion>

      <Seccion titulo="⭐ Favoritos" accion={<EnlaceTexto texto="Administrar" onPress={() => router.push('/recetas/favoritos')} />}>
        <Campo etiqueta="" value={buscar} onChangeText={setBuscar} placeholder="Buscar: amoxi, salbutamol…" autoCapitalize="none" />
        {favoritos.length === 0 ? (
          <Text style={estilos.suave}>
            {buscar ? 'Ningún favorito coincide.' : 'Todavía no hay favoritos. Escriba una indicación y toque "☆ Guardar en favoritos".'}
          </Text>
        ) : (
          favoritos.slice(0, 30).map((f) => (
            <Pressable key={f.id} onPress={() => void agregarFavorito(f)} style={({ pressed }) => [s.favorito, pressed && { opacity: 0.7 }]}>
              <Text style={s.mas}>＋</Text>
              <Text style={[estilos.pequeno, { flex: 1 }]}>{f.texto}</Text>
            </Pressable>
          ))
        )}
      </Seccion>

      {hojas > 1 && <Aviso tono="info">Son muchas indicaciones para una hoja: se imprimirá en {hojas} hojas, cada una con su formato.</Aviso>}
      <Boton texto={guardando ? 'Guardando…' : 'Guardar e imprimir'} onPress={() => void guardarEImprimir()} deshabilitado={guardando || limpias.length === 0} />
      <Text style={[estilos.suave, { fontSize: texto.mini, marginTop: espacio.s }]}>
        La receta queda guardada en el expediente y se puede volver a imprimir. Para corregirla, haga una nueva.
      </Text>
    </PantallaFormulario>
  );
}

const s = StyleSheet.create({
  indicacion: { flexDirection: 'row', gap: espacio.s, alignItems: 'flex-start' },
  numero: { fontSize: texto.normal, fontWeight: '700', color: colores.texto, width: 24, marginTop: 12 },
  acciones: { flexDirection: 'row', gap: espacio.l, marginTop: -espacio.s, marginBottom: espacio.m },
  favorito: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacio.s,
    padding: espacio.m,
    borderRadius: radio.m,
    borderWidth: 1,
    borderColor: colores.borde,
    marginBottom: espacio.s,
    backgroundColor: colores.superficie,
  },
  mas: { fontSize: texto.normal, fontWeight: '700', color: colores.primario },
});
