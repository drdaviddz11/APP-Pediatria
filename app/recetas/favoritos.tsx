// Medicamentos favoritos: agregar, corregir o quitar las indicaciones frecuentes.

import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { actualizarFavorito, borrarFavorito, crearFavorito, Favorito, listarFavoritos } from '../../src/db/recetas';
import { useFocusEffectConSync } from '../../src/sincronizacion/eventos';
import { Boton, Campo, EnlaceTexto, PantallaFormulario, Seccion, estilos } from '../../src/ui/componentes';
import { Alert } from '../../src/ui/dialogo';
import { colores, espacio } from '../../src/ui/tema';
import { usePlan } from '../../src/plan/PlanProvider';
import { PantallaSoloPro } from '../../src/ui/pro';

export default function Pantalla() {
  const { esPro } = usePlan();
  return esPro ? <Favoritos /> : <PantallaSoloPro funcion="receta" />;
}

function Favoritos() {
  const db = useSQLiteContext();
  const [lista, setLista] = useState<Favorito[]>([]);
  const [nuevo, setNuevo] = useState('');
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);

  const cargar = useCallback(() => {
    let vigente = true;
    void listarFavoritos(db).then((l) => vigente && setLista(l));
    return () => {
      vigente = false;
    };
  }, [db]);
  useFocusEffectConSync(cargar);

  async function agregar() {
    try {
      await crearFavorito(db, nuevo);
      setNuevo('');
      cargar();
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    }
  }

  async function guardarEdicion() {
    if (!editando) return;
    try {
      await actualizarFavorito(db, editando.id, editando.texto);
      setEditando(null);
      cargar();
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    }
  }

  function quitar(f: Favorito) {
    Alert.alert('Quitar de favoritos', f.texto, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          await borrarFavorito(db, f.id);
          cargar();
        },
      },
    ]);
  }

  return (
    <PantallaFormulario>
      <Seccion titulo="Nuevo favorito">
        <Campo
          etiqueta="Indicación completa, tal como se imprime"
          value={nuevo}
          onChangeText={setNuevo}
          multiline
          autoCapitalize="sentences"
          placeholder={'Amoxicilina suspensión 250 mg/5 ml\nTomar 5 ml cada 8 horas por 7 días'}
        />
        <Boton texto="Agregar a favoritos" onPress={() => void agregar()} deshabilitado={!nuevo.trim()} />
      </Seccion>

      <Seccion titulo={`Favoritos (${lista.length})`}>
        {lista.length === 0 && <Text style={estilos.suave}>Todavía no hay favoritos.</Text>}
        {lista.map((f) => (
          <View key={f.id} style={{ borderBottomWidth: 1, borderBottomColor: colores.borde, paddingVertical: espacio.s }}>
            {editando?.id === f.id ? (
              <>
                <Campo etiqueta="" value={editando.texto} onChangeText={(v) => setEditando({ id: f.id, texto: v })} multiline autoCapitalize="sentences" />
                <Boton texto="Guardar cambios" onPress={() => void guardarEdicion()} />
                <EnlaceTexto texto="Cancelar" onPress={() => setEditando(null)} />
              </>
            ) : (
              <>
                <Text style={estilos.normal}>{f.texto}</Text>
                <View style={{ flexDirection: 'row', gap: espacio.l, marginTop: espacio.xs }}>
                  <Text style={estilos.suave}>Usado {f.usos} {f.usos === 1 ? 'vez' : 'veces'}</Text>
                  <EnlaceTexto texto="Editar" onPress={() => setEditando({ id: f.id, texto: f.texto })} />
                  <EnlaceTexto texto="Quitar" onPress={() => quitar(f)} />
                </View>
              </>
            )}
          </View>
        ))}
      </Seccion>
    </PantallaFormulario>
  );
}
