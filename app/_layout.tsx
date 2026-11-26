import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect, useState } from 'react';
import { migrarBaseDeDatos } from '../src/db/esquema';
import { PlanProvider } from '../src/plan/PlanProvider';
import { BloqueoProvider } from '../src/seguridad/BloqueoProvider';
import { SincronizacionAutomatica } from '../src/sincronizacion/automatica';
import { CargandoBase, PantallaProblema, ProtectorArranque } from '../src/ui/arranque';
import { AnfitrionDialogos } from '../src/ui/dialogo';
import { estadoDelNavegador, pedirAlmacenamientoPersistente, prepararInstalacion, prepararNavegador } from '../src/ui/plataforma';
import { colores } from '../src/ui/tema';

export default function Raiz() {
  useEffect(pedirAlmacenamientoPersistente, []);
  useEffect(prepararInstalacion, []);

  // En la computadora: la primera vez se prepara el navegador (se recarga solo); si no se puede, se explica qué hacer.
  const [navegador, setNavegador] = useState(estadoDelNavegador);
  useEffect(() => {
    if (navegador !== 'preparar') return;
    prepararNavegador().catch(() =>
      setNavegador('Este navegador no pudo preparar la base de datos de la app.'),
    );
  }, [navegador]);
  if (navegador === 'preparar') return <CargandoBase />;
  const problema = navegador === 'listo' ? null : navegador;
  if (problema) return <PantallaProblema titulo={problema} />;

  return (
    <ProtectorArranque>
    <Suspense fallback={<CargandoBase />}>
      <SQLiteProvider databaseName="pediacontrol.db" onInit={migrarBaseDeDatos} useSuspense>
        <StatusBar style="dark" />
        <BloqueoProvider>
        <PlanProvider>
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
          <Stack.Screen name="recetas/nueva" options={{ title: 'Nueva receta' }} />
          <Stack.Screen name="recetas/[id]" options={{ title: 'Receta' }} />
          <Stack.Screen name="recetas/favoritos" options={{ title: 'Medicamentos favoritos' }} />
          <Stack.Screen name="plan" options={{ title: 'Versión Gratis y Pro' }} />
          <Stack.Screen name="constancias/nueva" options={{ title: 'Nueva constancia' }} />
          <Stack.Screen name="constancias/[id]" options={{ title: 'Constancia' }} />
          <Stack.Screen name="firma" options={{ title: 'Firma y sello' }} />
          <Stack.Screen name="cumpleanos" options={{ title: 'Cumpleaños' }} />
          <Stack.Screen name="seguridad" options={{ title: 'Clave y bloqueo' }} />
          <Stack.Screen name="google" options={{ title: 'Conectando con Google…' }} />
          <Stack.Screen name="pacientes/nuevo" options={{ title: 'Nuevo paciente', presentation: 'modal' }} />
          <Stack.Screen name="pacientes/[id]/index" options={{ title: 'Expediente' }} />
          <Stack.Screen name="pacientes/[id]/detalle" options={{ title: 'Expediente completo' }} />
          <Stack.Screen name="pacientes/[id]/editar" options={{ title: 'Editar datos' }} />
          <Stack.Screen name="pacientes/[id]/historia" options={{ title: 'Historia clínica' }} />
          <Stack.Screen name="pacientes/[id]/consulta-nueva" options={{ title: 'Nueva consulta' }} />
          <Stack.Screen name="pacientes/[id]/crecimiento" options={{ title: 'Gráficas de crecimiento' }} />
          <Stack.Screen name="consultas/[id]" options={{ title: 'Consulta' }} />
        </Stack>
        </PlanProvider>
        </BloqueoProvider>
        <SincronizacionAutomatica />
        <AnfitrionDialogos />
      </SQLiteProvider>
    </Suspense>
    </ProtectorArranque>
  );
}
