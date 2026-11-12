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
          <Stack.Screen name="index" options={{ title: 'Pacientes' }} />
          <Stack.Screen name="pacientes/nuevo" options={{ title: 'Nuevo paciente', presentation: 'modal' }} />
          <Stack.Screen name="pacientes/[id]/index" options={{ title: 'Expediente' }} />
          <Stack.Screen name="pacientes/[id]/editar" options={{ title: 'Editar datos' }} />
          <Stack.Screen name="pacientes/[id]/historia" options={{ title: 'Historia clínica' }} />
          <Stack.Screen name="pacientes/[id]/consulta-nueva" options={{ title: 'Nueva consulta' }} />
          <Stack.Screen name="consultas/[id]" options={{ title: 'Consulta' }} />
        </Stack>
      </SQLiteProvider>
    </Suspense>
  );
}
