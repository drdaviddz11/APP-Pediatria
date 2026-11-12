import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { actualizarPaciente, obtenerPaciente } from '../../../src/db/pacientes';
import type { Paciente } from '../../../src/domain/types';
import { Cargando } from '../../../src/ui/componentes';
import { FormularioPaciente } from '../../../src/ui/FormularioPaciente';

export default function EditarPaciente() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [paciente, setPaciente] = useState<Paciente | null>(null);

  useEffect(() => {
    void obtenerPaciente(db, id).then(setPaciente);
  }, [db, id]);

  if (!paciente) return <Cargando />;

  return (
    <FormularioPaciente
      paciente={paciente}
      textoGuardar="Guardar cambios"
      alGuardar={async (datos) => {
        await actualizarPaciente(db, id, datos);
        router.back();
      }}
    />
  );
}
