// Bloquear un horario (vacaciones, congreso, almuerzo extendido…). ?fecha=AAAA-MM-DD

import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { hoyISO, leerHoraUsuario, minutosDeHora, momento, sumarDias } from '../../src/agenda/tiempo';
import { crearBloqueo } from '../../src/db/agenda';
import { aISO, aTextoUsuario, leerFechaISO, leerFechaUsuario } from '../../src/domain/fechas';
import { Boton, Campo, Interruptor, PantallaFormulario, Seccion, estilos } from '../../src/ui/componentes';

export default function BloquearHorario() {
  const params = useLocalSearchParams<{ fecha?: string }>();
  const db = useSQLiteContext();
  const inicial = leerFechaISO(params.fecha ?? '') ?? leerFechaISO(hoyISO());
  const [desdeFecha, setDesdeFecha] = useState(inicial ? aTextoUsuario(inicial) : '');
  const [hastaFecha, setHastaFecha] = useState('');
  const [todoElDia, setTodoElDia] = useState(false);
  const [desdeHora, setDesdeHora] = useState('');
  const [hastaHora, setHastaHora] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const f1 = leerFechaUsuario(desdeFecha);
    const f2 = hastaFecha.trim() ? leerFechaUsuario(hastaFecha) : f1;
    const errores: string[] = [];
    if (!f1) errores.push('Fecha de inicio: use DD/MM/AAAA.');
    if (hastaFecha.trim() && !f2) errores.push('Fecha de fin: use DD/MM/AAAA.');
    let inicio = '';
    let fin = '';
    if (f1 && f2) {
      const a = aISO(f1);
      const b = aISO(f2);
      if (b < a) errores.push('La fecha de fin es anterior a la de inicio.');
      if (todoElDia) {
        inicio = momento(a, '00:00');
        fin = momento(sumarDias(b, 1), '00:00');
      } else {
        const h1 = leerHoraUsuario(desdeHora);
        const h2 = leerHoraUsuario(hastaHora);
        if (!h1 || !h2) errores.push('Escriba las horas de inicio y fin (por ejemplo 12:00 y 14:00).');
        else {
          inicio = momento(a, h1);
          fin = momento(b, h2);
          if (a === b && (minutosDeHora(h2) ?? 0) <= (minutosDeHora(h1) ?? 0)) errores.push('La hora de fin debe ser después de la de inicio.');
        }
      }
    }
    if (errores.length > 0) {
      Alert.alert('Revise los datos', errores.join('\n'));
      return;
    }
    setGuardando(true);
    try {
      await crearBloqueo(db, inicio, fin, motivo);
      router.back();
    } catch (e) {
      Alert.alert('No se pudo bloquear', e instanceof Error ? e.message : String(e));
      setGuardando(false);
    }
  }

  return (
    <PantallaFormulario>
      <Text style={[estilos.suave, { marginBottom: 12 }]}>
        En un horario bloqueado no se pueden agendar citas. Para quitar el bloqueo, tóquelo en la vista diaria de la agenda.
      </Text>
      <Seccion titulo="Periodo">
        <Campo etiqueta="Desde (fecha)" value={desdeFecha} onChangeText={setDesdeFecha} placeholder="DD/MM/AAAA" keyboardType="numbers-and-punctuation" />
        <Campo
          etiqueta="Hasta (fecha, opcional)"
          value={hastaFecha}
          onChangeText={setHastaFecha}
          placeholder="DD/MM/AAAA"
          keyboardType="numbers-and-punctuation"
          ayuda="Déjelo vacío para bloquear un solo día."
        />
        <Interruptor etiqueta="Todo el día" valor={todoElDia} alCambiar={setTodoElDia} />
        {!todoElDia && (
          <>
            <Campo etiqueta="Desde (hora)" value={desdeHora} onChangeText={setDesdeHora} placeholder="12:00" keyboardType="numbers-and-punctuation" />
            <Campo etiqueta="Hasta (hora)" value={hastaHora} onChangeText={setHastaHora} placeholder="14:00" keyboardType="numbers-and-punctuation" />
          </>
        )}
        <Campo etiqueta="Motivo (opcional)" value={motivo} onChangeText={setMotivo} placeholder="Vacaciones, congreso…" autoCapitalize="sentences" />
      </Seccion>
      <Boton texto={guardando ? 'Guardando…' : 'Bloquear horario'} onPress={guardar} deshabilitado={guardando} />
    </PantallaFormulario>
  );
}
