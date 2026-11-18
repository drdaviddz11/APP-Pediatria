// Receta guardada: ver e imprimir de nuevo. No se modifica (para corregir, se hace una nueva).

import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { obtenerPaciente } from '../../src/db/pacientes';
import { obtenerReceta, Receta } from '../../src/db/recetas';
import type { Paciente } from '../../src/domain/types';
import { FONDO_RECETA } from '../../src/receta/fondo';
import { fechaReceta, htmlReceta, nombreEnReceta, textoPeso } from '../../src/receta/hoja';
import { imprimirHtml } from '../../src/receta/imprimir';
import { Boton, Cargando, PantallaFormulario, Seccion, estilos } from '../../src/ui/componentes';
import { Alert } from '../../src/ui/dialogo';
import { espacio } from '../../src/ui/tema';
import { usePlan } from '../../src/plan/PlanProvider';
import { AvisoPro } from '../../src/ui/pro';

export default function VerReceta() {
  const { esPro } = usePlan();
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [datos, setDatos] = useState<{ receta: Receta; paciente: Paciente } | null>(null);

  useEffect(() => {
    void (async () => {
      const receta = await obtenerReceta(db, id);
      const paciente = receta ? await obtenerPaciente(db, receta.pacienteId) : null;
      if (receta && paciente) setDatos({ receta, paciente });
    })();
  }, [db, id]);

  if (!datos) return <Cargando />;
  const { receta, paciente } = datos;

  async function imprimir() {
    try {
      await imprimirHtml(
        htmlReceta({ nombre: nombreEnReceta(paciente), pesoKg: receta.pesoKg, fecha: new Date(receta.fecha), indicaciones: receta.indicaciones, fondo: FONDO_RECETA }),
      );
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (!/cancel/i.test(m)) Alert.alert('No se pudo imprimir', m);
    }
  }

  return (
    <PantallaFormulario>
      <Seccion titulo="Receta">
        <Text style={estilos.normal}>
          <Text style={{ fontWeight: '700' }}>Nombre: </Text>
          {nombreEnReceta(paciente)}
        </Text>
        <Text style={estilos.normal}>
          <Text style={{ fontWeight: '700' }}>Fecha: </Text>
          {fechaReceta(new Date(receta.fecha))}
        </Text>
        <Text style={[estilos.normal, { marginBottom: espacio.m }]}>
          <Text style={{ fontWeight: '700' }}>Peso: </Text>
          {receta.pesoKg != null ? textoPeso(receta.pesoKg) : 'no se imprimió'}
        </Text>
        <Text style={[estilos.normal, { fontWeight: '700' }]}>℞</Text>
        {receta.indicaciones.map((t, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: espacio.s, marginTop: espacio.s }}>
            <Text style={[estilos.normal, { width: 24 }]}>{i + 1}.</Text>
            <Text style={[estilos.normal, { flex: 1 }]}>{t}</Text>
          </View>
        ))}
      </Seccion>
      {!esPro && <AvisoPro funcion="receta" compacto />}
      {esPro && <Boton texto="Imprimir" onPress={() => void imprimir()} />}
      {esPro && <Boton
        texto="Hacer otra receta con estas indicaciones"
        variante="secundario"
        onPress={() =>
          router.push({ pathname: '/recetas/nueva', params: { pacienteId: receta.pacienteId, base: receta.id } })
        }
      />}
      <Text style={[estilos.suave, { marginTop: espacio.s }]}>Una receta emitida no se modifica. Para corregirla, haga una nueva.</Text>
    </PantallaFormulario>
  );
}
