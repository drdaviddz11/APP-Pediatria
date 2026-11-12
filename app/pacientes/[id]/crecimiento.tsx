// Gráficas de crecimiento del paciente con las curvas OMS.

import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { evaluarConsulta, fechaDeConsulta } from '../../../src/crecimiento/consulta';
import {
  configurarGrafica,
  Escala,
  NOMBRE_RANGO,
  puntosPaciente,
  Rango,
  rangoParaEdad,
  rangosDisponibles,
  referenciaDeRango,
} from '../../../src/crecimiento/curvas';
import { NOTA_DOWN } from '../../../src/crecimiento/interpretacion';
import { NOMBRE_INDICADOR, NOMBRE_REFERENCIA, Indicador, ResultadoEvaluacion } from '../../../src/crecimiento/tipos';
import { listarConsultas } from '../../../src/db/consultas';
import { obtenerPaciente } from '../../../src/db/pacientes';
import { isoATextoCorto } from '../../../src/domain/fechas';
import type { Paciente } from '../../../src/domain/types';
import { Cargando, PantallaSimple, Seccion, Selector, estilos } from '../../../src/ui/componentes';
import { GraficaCrecimiento } from '../../../src/ui/GraficaCrecimiento';
import { colores, espacio, radio, texto } from '../../../src/ui/tema';

const INDICADORES: Indicador[] = ['pesoEdad', 'tallaEdad', 'imcEdad', 'pesoTalla', 'pcEdad'];
const CORTO: Record<Indicador, string> = {
  pesoEdad: 'Peso/edad',
  tallaEdad: 'Talla/edad',
  imcEdad: 'IMC/edad',
  pesoTalla: 'Peso/talla',
  pcEdad: 'PC/edad',
};
const UNIDAD: Record<Indicador, string> = { pesoEdad: 'kg', tallaEdad: 'cm', imcEdad: 'kg/m²', pesoTalla: 'kg', pcEdad: 'cm' };

export default function Crecimiento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [evaluaciones, setEvaluaciones] = useState<{ fecha: string; e: ResultadoEvaluacion }[]>([]);
  const [indicador, setIndicador] = useState<Indicador>('pesoEdad');
  const [rango, setRango] = useState<Rango | null>(null);
  const [escala, setEscala] = useState<Escala>('z');

  useFocusEffect(
    useCallback(() => {
      let activo = true;
      void (async () => {
        const p = await obtenerPaciente(db, id);
        if (!p || !activo) return;
        const consultas = await listarConsultas(db, id);
        const lista: { fecha: string; e: ResultadoEvaluacion }[] = [];
        for (const c of [...consultas].reverse()) {
          const e = evaluarConsulta(p, c);
          if (e) lista.push({ fecha: fechaDeConsulta(c), e });
        }
        if (!activo) return;
        setPaciente(p);
        setEvaluaciones(lista);
        // Rango inicial: el de la medición más reciente.
        const ultima = [...lista].reverse().find((x) => x.e.edadMesesUsada != null);
        setRango((r) =>
          r && rangosDisponibles(p.sindromeDown).includes(r) ? r : rangoParaEdad(ultima?.e.edadMesesUsada ?? 0, p.sindromeDown),
        );
      })();
      return () => {
        activo = false;
      };
    }, [db, id]),
  );

  if (!paciente || !rango) return <Cargando />;

  const config = configurarGrafica(indicador, paciente.sexo, rango, escala);
  const puntos = puntosPaciente(indicador, rango, evaluaciones);
  const referencia = NOMBRE_REFERENCIA[referenciaDeRango(rango)];

  return (
    <PantallaSimple>
      <Text style={[estilos.normal, { fontWeight: '700' }]}>
        {paciente.nombres} {paciente.apellidos}
      </Text>
      <Text style={[estilos.suave, { marginBottom: espacio.m }]}>
        {paciente.sexo === 'F' ? 'Niña' : 'Niño'} · curvas {paciente.sexo === 'F' ? 'femeninas' : 'masculinas'}
        {paciente.sindromeDown ? ' para síndrome de Down' : ''}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: espacio.s, paddingBottom: espacio.m }}>
        {INDICADORES.map((i) => {
          const activo = i === indicador;
          return (
            <Pressable key={i} onPress={() => setIndicador(i)} style={[s.chip, activo && s.chipActivo]} accessibilityRole="button">
              <Text style={[s.chipTexto, activo && s.chipTextoActivo]}>{CORTO[i]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Selector<Rango>
        etiqueta="Edad"
        opciones={rangosDisponibles(paciente.sindromeDown).map((r) => ({ valor: r, texto: NOMBRE_RANGO[r] }))}
        valor={rango}
        alCambiar={setRango}
      />
      <Selector<Escala>
        etiqueta="Líneas de referencia"
        opciones={[
          { valor: 'z', texto: 'Puntajes Z' },
          { valor: 'percentil', texto: 'Percentiles' },
        ]}
        valor={escala}
        alCambiar={setEscala}
      />

      <Seccion titulo={NOMBRE_INDICADOR[indicador]}>
        {config.disponible ? (
          <>
            <GraficaCrecimiento config={config} puntos={puntos} />
            <Text style={estilos.suave}>{referencia}</Text>
            {paciente.sindromeDown && <Text style={[estilos.suave, { marginTop: espacio.xs }]}>{NOTA_DOWN}</Text>}
            {puntos.length === 0 && (
              <Text style={[estilos.suave, { marginTop: espacio.s }]}>No hay mediciones del paciente en este rango de edad.</Text>
            )}
          </>
        ) : (
          <Text style={estilos.suave}>{config.motivo}</Text>
        )}
      </Seccion>

      {puntos.length > 0 && (
        <Seccion titulo="Mediciones">
          {[...puntos].reverse().map((p, i) => (
            <View key={i} style={s.medicion}>
              <Text style={[estilos.pequeno, { flex: 1 }]}>{isoATextoCorto(p.fecha)}</Text>
              <Text style={[estilos.pequeno, s.valor]}>
                {Number(p.y.toFixed(indicador === 'imcEdad' ? 1 : 2))} {UNIDAD[indicador]}
              </Text>
              <Text style={[estilos.pequeno, s.valor]}>{p.z == null ? '—' : `Z ${p.z > 0 ? '+' : ''}${p.z.toFixed(2)}`}</Text>
            </View>
          ))}
          <Text style={[estilos.suave, { marginTop: espacio.s }]}>
            Las longitudes/tallas incluyen el ajuste OMS de 0.7 cm cuando corresponde. En prematuros se grafica la edad corregida
            hasta los 24 meses.
          </Text>
        </Seccion>
      )}
    </PantallaSimple>
  );
}

const s = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
  },
  chipActivo: { backgroundColor: colores.primario, borderColor: colores.primario },
  chipTexto: { fontSize: texto.pequeno, color: colores.texto, fontWeight: '600' },
  chipTextoActivo: { color: '#FFFFFF' },
  medicion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.borde,
    gap: espacio.s,
  },
  valor: { fontWeight: '700', fontVariant: ['tabular-nums'] },
});
