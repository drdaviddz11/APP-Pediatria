// Nuevo expediente. Con ?citaId=… se prellena con los datos de la cita y se enlaza a ella.

import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert } from '../../src/ui/dialogo';
import { obtenerCita, vincularPaciente } from '../../src/db/agenda';
import { crearPaciente, sugerirNumeroExpediente } from '../../src/db/pacientes';
import { Cargando } from '../../src/ui/componentes';
import { FormularioPaciente, ValoresIniciales } from '../../src/ui/FormularioPaciente';

export default function NuevoPaciente() {
  const { citaId } = useLocalSearchParams<{ citaId?: string }>();
  const db = useSQLiteContext();
  const [numero, setNumero] = useState<string | null>(null);
  const [inicial, setInicial] = useState<ValoresIniciales>({});

  useEffect(() => {
    void (async () => {
      const [n, cita] = await Promise.all([
        sugerirNumeroExpediente(db).catch(() => ''),
        citaId ? obtenerCita(db, citaId) : Promise.resolve(null),
      ]);
      if (cita && !cita.pacienteId) {
        setInicial({ nombres: cita.nombreContacto, telefonoPrincipal: cita.telefonoContacto, whatsapp: cita.telefonoContacto });
      }
      setNumero(n);
    })();
  }, [db, citaId]);

  if (numero === null) return <Cargando />;

  return (
    <FormularioPaciente
      numeroSugerido={numero}
      inicial={inicial}
      textoGuardar="Crear expediente"
      alGuardar={async (datos) => {
        const id = await crearPaciente(db, datos);
        if (citaId) {
          try {
            await vincularPaciente(db, citaId, id);
          } catch (e) {
            Alert.alert('Expediente creado', `No se pudo enlazar con la cita: ${e instanceof Error ? e.message : String(e)}`);
          }
          router.back();
          return;
        }
        router.replace({ pathname: '/pacientes/[id]', params: { id } });
      }}
    />
  );
}
