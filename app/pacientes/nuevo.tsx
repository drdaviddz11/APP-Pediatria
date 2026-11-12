import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { crearPaciente, sugerirNumeroExpediente } from '../../src/db/pacientes';
import { Cargando } from '../../src/ui/componentes';
import { FormularioPaciente } from '../../src/ui/FormularioPaciente';

export default function NuevoPaciente() {
  const db = useSQLiteContext();
  const [numero, setNumero] = useState<string | null>(null);

  useEffect(() => {
    sugerirNumeroExpediente(db).then(setNumero, () => setNumero(''));
  }, [db]);

  if (numero === null) return <Cargando />;

  return (
    <FormularioPaciente
      numeroSugerido={numero}
      textoGuardar="Crear expediente"
      alGuardar={async (datos) => {
        const id = await crearPaciente(db, datos);
        router.replace({ pathname: '/pacientes/[id]', params: { id } });
      }}
    />
  );
}
