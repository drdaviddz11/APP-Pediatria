import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { migrarBaseDeDatos } from '../src/db/esquema';
import { SincronizacionAutomatica } from '../src/sincronizacion/automatica';
import { Cargando } from '../src/ui/componentes';
import { AnfitrionDialogos } from '../src/ui/dialogo';
import { estadoDelNavegador, pedirAlmacenamientoPersistente, prepararNavegador } from '../src/ui/plataforma';
import { colores, espacio, texto } from '../src/ui/tema';

export default function Raiz() {
  useEffect(pedirAlmacenamientoPersistente, []);

  // En la computadora: la primera vez se prepara el navegador (se recarga solo); si no se puede, se explica qué hacer.
  const [navegador, setNavegador] = useState(estadoDelNavegador);
  useEffect(() => {
    if (navegador !== 'preparar') return;
    prepararNavegador().catch(() =>
      setNavegador('Este navegador no pudo preparar la base de datos de la app. Ábrala en Google Chrome o Microsoft Edge y recargue la página.'),
    );
  }, [navegador]);
  if (navegador === 'preparar') return <Cargando />;
  const problema = navegador === 'listo' ? null : navegador;
  if (problema) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xl, backgroundColor: colores.fondo }}>
        <Text style={{ fontSize: texto.titulo, fontWeight: '700', color: colores.texto, marginBottom: espacio.m }}>PediaControl Pro</Text>
        <Text style={{ fontSize: texto.normal, color: colores.texto, maxWidth: 520, textAlign: 'center', lineHeight: 24 }}>{problema}</Text>
      </View>
    );
  }

  return (
    <Suspense fallback={<Cargando />}>
      <SQLiteProvider databaseName="pediacontrol.db" onInit={migrarBaseDeDatos} useSuspense>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            // Encabezado sólido: el contenido empieza debajo (iOS 26+ lo haría transparente).
            headerTransparent: false,
            headerStyle: { backgroundColor: colores.superficie },
            headerTintColor: colores.primario,
            headerTitleStyle: { color: colores.texto, fontWeight: '700' },
            headerBackTitle: 'Atrás',
            contentStyle: { backgroundColor: colores.fondo },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'PediaControl Pro' }} />
          <Stack.Screen name="pacientes/index" options={{ title: 'Pacientes' }} />
          <Stack.Screen name="agenda/index" options={{ title: 'Agenda' }} />
          <Stack.Screen name="agenda/nueva" options={{ title: 'Nueva cita' }} />
          <Stack.Screen name="agenda/[id]" options={{ title: 'Cita' }} />
          <Stack.Screen name="agenda/bloqueo" options={{ title: 'Bloquear horario' }} />
          <Stack.Screen name="configuracion" options={{ title: 'Horario y ajustes' }} />
          <Stack.Screen name="controles" options={{ title: 'Controles y recordatorios' }} />
          <Stack.Screen name="whatsapp" options={{ title: 'Mensaje de WhatsApp', presentation: 'modal' }} />
          <Stack.Screen name="configuracion-mensajes" options={{ title: 'Mensajes y controles' }} />
          <Stack.Screen name="respaldo" options={{ title: 'Respaldo' }} />
          <Stack.Screen name="sincronizacion" options={{ title: 'Sincronización' }} />
          <Stack.Screen name="caja/index" options={{ title: 'Caja del día' }} />
          <Stack.Screen name="caja/cobro" options={{ title: 'Registrar cobro', presentation: 'modal' }} />
          <Stack.Screen name="caja/mes" options={{ title: 'Ingresos del mes' }} />
          <Stack.Screen name="caja/precios" options={{ title: 'Precios sugeridos' }} />
          <Stack.Screen name="pacientes/nuevo" options={{ title: 'Nuevo paciente', presentation: 'modal' }} />
          <Stack.Screen name="pacientes/[id]/index" options={{ title: 'Expediente' }} />
          <Stack.Screen name="pacientes/[id]/editar" options={{ title: 'Editar datos' }} />
          <Stack.Screen name="pacientes/[id]/historia" options={{ title: 'Historia clínica' }} />
          <Stack.Screen name="pacientes/[id]/consulta-nueva" options={{ title: 'Nueva consulta' }} />
          <Stack.Screen name="pacientes/[id]/crecimiento" options={{ title: 'Gráficas de crecimiento' }} />
          <Stack.Screen name="consultas/[id]" options={{ title: 'Consulta' }} />
        </Stack>
        <SincronizacionAutomatica />
        <AnfitrionDialogos />
      </SQLiteProvider>
    </Suspense>
  );
}
