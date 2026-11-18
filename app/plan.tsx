// Planes: qué trae la versión gratis, qué agrega Pro y el estado actual.
// La compra se conecta cuando la app esté publicada en la App Store / Google Play (suscripción mensual o anual).

import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { FUNCIONES_PRO, FuncionPro, INCLUIDO_GRATIS, nombreOrigen } from '../src/plan/plan';
import { usePlan } from '../src/plan/PlanProvider';
import { Aviso, Boton, Interruptor, PantallaFormulario, Seccion, estilos } from '../src/ui/componentes';
import { espacio } from '../src/ui/tema';

export default function Planes() {
  const { funcion } = useLocalSearchParams<{ funcion?: FuncionPro }>();
  const { origen, esPro, verComoGratis, setVerComoGratis } = usePlan();
  const pedida = funcion && FUNCIONES_PRO[funcion] ? FUNCIONES_PRO[funcion] : null;

  return (
    <PantallaFormulario>
      <Seccion titulo="Su versión">
        <Text style={[estilos.normal, { fontWeight: '700' }]}>{esPro ? nombreOrigen(origen) : 'Gratis'}</Text>
        {origen === 'desarrollador' && verComoGratis && (
          <Text style={estilos.suave}>Está viendo la app como la ve quien no tiene Pro.</Text>
        )}
      </Seccion>

      {pedida && !esPro && <Aviso tono="info">“{pedida.titulo}” es parte de la versión Pro.</Aviso>}

      <Seccion titulo="Pro">
        {(Object.keys(FUNCIONES_PRO) as FuncionPro[]).map((k) => (
          <View key={k} style={{ marginBottom: espacio.m }}>
            <Text style={[estilos.normal, { fontWeight: '700' }]}>✓ {FUNCIONES_PRO[k].titulo}</Text>
            <Text style={estilos.suave}>{FUNCIONES_PRO[k].descripcion}</Text>
          </View>
        ))}
        <Text style={estilos.suave}>Más todo lo de la versión gratis.</Text>
      </Seccion>

      <Seccion titulo="Gratis">
        {INCLUIDO_GRATIS.map((t) => (
          <Text key={t} style={[estilos.normal, { marginBottom: 4 }]}>
            ✓ {t}
          </Text>
        ))}
        <Text style={[estilos.suave, { marginTop: espacio.s }]}>
          Las recetas que ya se hicieron siempre se pueden ver, tenga o no Pro.
        </Text>
      </Seccion>

      {!esPro && origen !== 'desarrollador' && (
        <>
          <Boton texto="Suscribirse a Pro" onPress={() => undefined} deshabilitado />
          <Text style={[estilos.suave, { marginTop: espacio.s }]}>
            La suscripción mensual o anual estará disponible cuando la app esté publicada en la App Store y Google Play.
          </Text>
        </>
      )}

      {origen === 'desarrollador' && (
        <Seccion titulo="Pruebas">
          <Interruptor etiqueta="Ver la app como versión gratis" valor={verComoGratis} alCambiar={setVerComoGratis} />
          <Text style={estilos.suave}>Solo para revisar cómo la ve quien no paga. Al recargar o cerrar la app vuelve a Pro.</Text>
        </Seccion>
      )}
    </PantallaFormulario>
  );
}
