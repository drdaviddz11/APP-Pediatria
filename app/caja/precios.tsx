// Precios sugeridos de la consulta (primera vez y control) y símbolo de la moneda.

import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { leerMonto, montoParaCampo } from '../../src/caja/dinero';
import { guardarAjustesCaja, leerAjustesCaja } from '../../src/db/caja';
import { Boton, Campo, Cargando, PantallaFormulario, Seccion, estilos } from '../../src/ui/componentes';
import { Alert } from '../../src/ui/dialogo';

export default function Precios() {
  const db = useSQLiteContext();
  const [listo, setListo] = useState(false);
  const [moneda, setMoneda] = useState('L');
  const [primera, setPrimera] = useState('');
  const [control, setControl] = useState('');

  useEffect(() => {
    void leerAjustesCaja(db).then((a) => {
      setMoneda(a.moneda);
      setPrimera(a.precioPrimeraCentavos ? montoParaCampo(a.precioPrimeraCentavos) : '');
      setControl(a.precioControlCentavos ? montoParaCampo(a.precioControlCentavos) : '');
      setListo(true);
    });
  }, [db]);

  if (!listo) return <Cargando />;

  async function guardar() {
    const p = primera.trim() ? leerMonto(primera) : 0;
    const c = control.trim() ? leerMonto(control) : 0;
    if (p === null || c === null) {
      Alert.alert('Precios', 'Escriba los precios como 800 o 1,250.50 (o déjelos vacíos).');
      return;
    }
    try {
      await guardarAjustesCaja(db, { moneda, precioPrimeraCentavos: p, precioControlCentavos: c });
      router.back();
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <PantallaFormulario>
      <Seccion titulo="Precios sugeridos">
        <Text style={[estilos.pequeno, { marginBottom: 12 }]}>
          Al registrar una consulta, el cobro se llena con este precio; siempre puede cambiarlo antes de guardar.
        </Text>
        <Campo etiqueta="Consulta de primera vez" unidad={moneda} value={primera} onChangeText={setPrimera} keyboardType="decimal-pad" placeholder="0.00" />
        <Campo etiqueta="Consulta de control" unidad={moneda} value={control} onChangeText={setControl} keyboardType="decimal-pad" placeholder="0.00" />
        <Campo etiqueta="Símbolo de la moneda" value={moneda} onChangeText={setMoneda} autoCapitalize="characters" maxLength={5} />
      </Seccion>
      <Boton texto="Guardar" onPress={() => void guardar()} />
    </PantallaFormulario>
  );
}
