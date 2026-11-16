import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { migrarBaseDeDatos } from '../src/db/esquema';
import { Cargando } from '../src/ui/componentes';
import { colores } from '../src/ui/tema';

export default function Raiz() {
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
          <Stack.Screen name="pacientes/nuevo" options={{ title: 'Nuevo paciente', presentation: 'modal' }} />
          <Stack.Screen name="pacientes/[id]/index" options={{ title: 'Expediente' }} />
          <Stack.Screen name="pacientes/[id]/editar" options={{ title: 'Editar datos' }} />
          <Stack.Screen name="pacientes/[id]/historia" options={{ title: 'Historia clínica' }} />
          <Stack.Screen name="pacientes/[id]/consulta-nueva" options={{ title: 'Nueva consulta' }} />
          <Stack.Screen name="pacientes/[id]/crecimiento" options={{ title: 'Gráficas de crecimiento' }} />
          <Stack.Screen name="consultas/[id]" options={{ title: 'Consulta' }} />
        </Stack>
      </SQLiteProvider>
    </Suspense>
  );
}
