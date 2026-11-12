// Edición de la historia clínica (antecedentes). Cada cambio guarda la versión anterior en la bitácora.

import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { guardarHistoria, obtenerHistoria } from '../../../src/db/pacientes';
import { textoFechaHora } from '../../../src/domain/fechas';
import type { HistoriaClinicaEntrada } from '../../../src/domain/types';
import { Boton, Campo, Cargando, PantallaFormulario, Seccion, estilos } from '../../../src/ui/componentes';

const CAMPOS: { campo: keyof HistoriaClinicaEntrada; etiqueta: string; ayuda?: string }[] = [
  { campo: 'alergias', etiqueta: 'Alergias', ayuda: 'Escriba "Ninguna conocida" si se interrogó y no hay.' },
  { campo: 'medicamentosActuales', etiqueta: 'Medicamentos actuales' },
  { campo: 'antecedentesPersonales', etiqueta: 'Antecedentes personales patológicos' },
  { campo: 'antecedentesFamiliares', etiqueta: 'Antecedentes familiares' },
  { campo: 'antecedentesPerinatales', etiqueta: 'Antecedentes perinatales', ayuda: 'Embarazo, parto, peso al nacer, APGAR, complicaciones.' },
  { campo: 'antecedentesQuirurgicos', etiqueta: 'Antecedentes quirúrgicos' },
  { campo: 'hospitalizaciones', etiqueta: 'Hospitalizaciones' },
  { campo: 'vacunas', etiqueta: 'Vacunas' },
  { campo: 'diagnosticosPrevios', etiqueta: 'Diagnósticos previos' },
];

export default function EditarHistoria() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [h, setH] = useState<HistoriaClinicaEntrada | null>(null);
  const [actualizado, setActualizado] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void obtenerHistoria(db, id).then(({ pacienteId: _p, actualizadoEn, ...resto }) => {
      setH(resto);
      setActualizado(actualizadoEn);
    });
  }, [db, id]);

  if (!h) return <Cargando />;

  async function guardar() {
    if (!h) return;
    setGuardando(true);
    try {
      await guardarHistoria(db, id, h);
      router.back();
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <PantallaFormulario>
      {actualizado && <Text style={[estilos.suave, { marginBottom: 12 }]}>Última actualización: {textoFechaHora(actualizado)}</Text>}
      <Seccion titulo="Antecedentes">
        {CAMPOS.map(({ campo, etiqueta, ayuda }) => (
          <Campo
            key={campo}
            etiqueta={etiqueta}
            ayuda={ayuda}
            value={h[campo]}
            onChangeText={(v) => setH((prev) => (prev ? { ...prev, [campo]: v } : prev))}
            multiline
            autoCapitalize="sentences"
          />
        ))}
      </Seccion>
      <Boton texto={guardando ? 'Guardando…' : 'Guardar historia clínica'} onPress={guardar} deshabilitado={guardando} />
    </PantallaFormulario>
  );
}
