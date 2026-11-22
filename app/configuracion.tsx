// Horario de atención, duración de las consultas e intervalo entre horarios.

import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Alert } from '../src/ui/dialogo';
import { validarConfiguracion } from '../src/agenda/disponibilidad';
import { leerHoraUsuario, NOMBRES_DIA } from '../src/agenda/tiempo';
import { ConfiguracionAgenda, RangoHorario } from '../src/agenda/tipos';
import { guardarConfiguracion, leerConfiguracion } from '../src/db/agenda';
import { Boton, Campo, Cargando, Interruptor, PantallaFormulario, Seccion, Selector, estilos } from '../src/ui/componentes';
import { colores, espacio, texto } from '../src/ui/tema';

// Orden de la semana empezando en lunes.
const ORDEN = [1, 2, 3, 4, 5, 6, 0];

interface DiaFormulario {
  atiende: boolean;
  manana: [string, string];
  tarde: [string, string];
}

function aFormulario(rangos: RangoHorario[]): DiaFormulario {
  return {
    atiende: rangos.length > 0,
    manana: rangos[0] ? [rangos[0].inicio, rangos[0].fin] : ['', ''],
    tarde: rangos[1] ? [rangos[1].inicio, rangos[1].fin] : ['', ''],
  };
}

export default function Configuracion() {
  const db = useSQLiteContext();
  const [dias, setDias] = useState<Record<number, DiaFormulario> | null>(null);
  const [primera, setPrimera] = useState('');
  const [control, setControl] = useState('');
  const [intervalo, setIntervalo] = useState('10');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void leerConfiguracion(db).then((c) => {
      const d: Record<number, DiaFormulario> = {};
      for (const n of ORDEN) d[n] = aFormulario(c.horario[n] ?? []);
      setDias(d);
      setPrimera(String(c.duracionPrimera));
      setControl(String(c.duracionControl));
      setIntervalo(String(c.intervalo));
    });
  }, [db]);

  if (!dias) return <Cargando />;

  const cambiarDia = (n: number, cambio: Partial<DiaFormulario>) => setDias((prev) => (prev ? { ...prev, [n]: { ...prev[n], ...cambio } } : prev));

  async function guardar() {
    if (!dias) return;
    const errores: string[] = [];
    const horario: Record<number, RangoHorario[]> = {};
    for (const n of ORDEN) {
      const d = dias[n];
      horario[n] = [];
      if (!d.atiende) continue;
      const erroresAntes = errores.length;
      for (const [nombre, [a, b]] of [
        ['mañana', d.manana],
        ['tarde', d.tarde],
      ] as const) {
        if (!a.trim() && !b.trim()) continue;
        const ini = leerHoraUsuario(a);
        const fin = leerHoraUsuario(b);
        if (!ini || !fin) {
          errores.push(`${NOMBRES_DIA[n]} (${nombre}): escriba hora de inicio y de fin, por ejemplo 08:00 y 12:00.`);
          continue;
        }
        horario[n].push({ inicio: ini, fin });
      }
      if (horario[n].length === 0 && errores.length === erroresAntes) errores.push(`${NOMBRES_DIA[n]}: indique al menos un horario o desactive "Atiende".`);
      horario[n].sort((x, y) => x.inicio.localeCompare(y.inicio));
    }
    const config: ConfiguracionAgenda = {
      horario,
      duracionPrimera: Number(primera),
      duracionControl: Number(control),
      intervalo: Number(intervalo),
    };
    errores.push(...validarConfiguracion(config));
    if (errores.length > 0) {
      Alert.alert('Revise el horario', errores.join('\n'));
      return;
    }
    setGuardando(true);
    try {
      await guardarConfiguracion(db, config);
      router.back();
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
      setGuardando(false);
    }
  }

  return (
    <PantallaFormulario>
      <Seccion titulo="Duración de las consultas">
        <Campo etiqueta="Primera consulta" unidad="min" value={primera} onChangeText={setPrimera} keyboardType="number-pad" />
        <Campo etiqueta="Control" unidad="min" value={control} onChangeText={setControl} keyboardType="number-pad" />
        <Selector<string>
          etiqueta="Ofrecer horarios cada"
          opciones={['5', '10', '15', '20', '30'].map((v) => ({ valor: v, texto: `${v} min` }))}
          valor={intervalo}
          alCambiar={setIntervalo}
        />
        <Text style={estilos.suave}>Los cambios no modifican las citas ya agendadas.</Text>
      </Seccion>

      <Seccion titulo="Horario de atención">
        {ORDEN.map((n) => {
          const d = dias[n];
          return (
            <View key={n} style={s.dia}>
              <Interruptor etiqueta={`${NOMBRES_DIA[n][0].toUpperCase()}${NOMBRES_DIA[n].slice(1)} · atiende`} valor={d.atiende} alCambiar={(v) => cambiarDia(n, { atiende: v })} />
              {d.atiende && (
                <>
                  <Text style={s.subtitulo}>Mañana</Text>
                  <View style={s.fila}>
                    <View style={{ flex: 1 }}>
                      <Campo etiqueta="Desde" value={d.manana[0]} onChangeText={(v) => cambiarDia(n, { manana: [v, d.manana[1]] })} placeholder="08:00" keyboardType="numbers-and-punctuation" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Campo etiqueta="Hasta" value={d.manana[1]} onChangeText={(v) => cambiarDia(n, { manana: [d.manana[0], v] })} placeholder="12:00" keyboardType="numbers-and-punctuation" />
                    </View>
                  </View>
                  <Text style={s.subtitulo}>Tarde (opcional)</Text>
                  <View style={s.fila}>
                    <View style={{ flex: 1 }}>
                      <Campo etiqueta="Desde" value={d.tarde[0]} onChangeText={(v) => cambiarDia(n, { tarde: [v, d.tarde[1]] })} placeholder="14:00" keyboardType="numbers-and-punctuation" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Campo etiqueta="Hasta" value={d.tarde[1]} onChangeText={(v) => cambiarDia(n, { tarde: [d.tarde[0], v] })} placeholder="18:00" keyboardType="numbers-and-punctuation" />
                    </View>
                  </View>
                </>
              )}
            </View>
          );
        })}
      </Seccion>

      <Boton texto={guardando ? 'Guardando…' : 'Guardar horario'} onPress={guardar} deshabilitado={guardando} />
      <Boton texto="Mensajes de WhatsApp y criterios de control" variante="secundario" onPress={() => router.push('/configuracion-mensajes')} />
      <Boton texto="Respaldo de los datos" variante="secundario" onPress={() => router.push('/respaldo')} />
      <Boton texto="Sincronización entre equipos" variante="secundario" onPress={() => router.push('/sincronizacion')} />
      <Boton texto="Clave de acceso y bloqueo" variante="secundario" onPress={() => router.push('/seguridad')} />
      <Boton texto="Firma y sello (constancias)" variante="secundario" onPress={() => router.push('/firma')} />
      <Boton texto="Versión Gratis y Pro" variante="secundario" onPress={() => router.push('/plan')} />
    </PantallaFormulario>
  );
}

const s = StyleSheet.create({
  dia: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colores.borde, paddingBottom: espacio.s, marginBottom: espacio.s },
  subtitulo: { fontSize: texto.mini, fontWeight: '700', color: colores.textoSuave, marginBottom: espacio.xs },
  fila: { flexDirection: 'row', gap: espacio.m },
});
