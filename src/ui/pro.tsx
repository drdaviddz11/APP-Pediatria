// Avisos de "función Pro" para quien usa la versión gratis.

import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { FUNCIONES_PRO, FuncionPro } from '../plan/plan';
import { Boton, PantallaFormulario } from './componentes';
import { colores, espacio, radio, texto } from './tema';

export function irAPlanes(funcion?: FuncionPro) {
  router.push({ pathname: '/plan', params: funcion ? { funcion } : {} });
}

/** Tarjeta que explica la función Pro y lleva a la pantalla de planes. */
export function AvisoPro({ funcion, compacto }: { funcion: FuncionPro; compacto?: boolean }) {
  const f = FUNCIONES_PRO[funcion];
  return (
    <View style={s.tarjeta}>
      <Text style={s.titulo}>🔒 {f.titulo} · versión Pro</Text>
      {!compacto && <Text style={s.texto}>{f.descripcion}</Text>}
      <Boton texto="Ver versión Pro" variante="secundario" onPress={() => irAPlanes(funcion)} />
    </View>
  );
}

/** Pantalla completa para cuando se entra directo (por un enlace) a una función Pro. */
export function PantallaSoloPro({ funcion }: { funcion: FuncionPro }) {
  return (
    <PantallaFormulario>
      <AvisoPro funcion={funcion} />
    </PantallaFormulario>
  );
}

const s = StyleSheet.create({
  tarjeta: {
    backgroundColor: colores.primarioSuave,
    borderColor: colores.primario,
    borderWidth: 1,
    borderRadius: radio.m,
    padding: espacio.m,
    marginBottom: espacio.m,
    gap: espacio.s,
  },
  titulo: { fontSize: texto.normal, fontWeight: '700', color: colores.primarioOscuro },
  texto: { fontSize: texto.pequeno, color: colores.texto, lineHeight: 20 },
});
