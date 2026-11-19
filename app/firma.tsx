// Firma y sello del médico para las constancias. Se sube una imagen (PNG con fondo transparente, idealmente).
// Queda en los datos de la app (cifrada en respaldos y sincronización); no se publica en internet.

import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { guardarFirma, leerFirma, quitarFirma } from '../src/db/constancias';
import { useFocusEffectConSync } from '../src/sincronizacion/eventos';
import { Aviso, Boton, PantallaFormulario, Seccion, estilos } from '../src/ui/componentes';
import { Alert } from '../src/ui/dialogo';
import { elegirImagen } from '../src/ui/elegirImagen';
import { colores, espacio, radio } from '../src/ui/tema';

export default function FirmaYSello() {
  const db = useSQLiteContext();
  const [firma, setFirma] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);

  const cargar = useCallback(() => {
    let vigente = true;
    void leerFirma(db).then((f) => {
      if (!vigente) return;
      setFirma(f);
      setCargado(true);
    });
    return () => {
      vigente = false;
    };
  }, [db]);
  useFocusEffectConSync(cargar);

  async function elegir() {
    try {
      const imagen = await elegirImagen();
      if (!imagen) return;
      await guardarFirma(db, imagen);
      setFirma(imagen);
      Alert.alert('Firma y sello guardados', 'Desde ahora las constancias salen con esta imagen.');
    } catch (e) {
      Alert.alert('No se pudo guardar la imagen', e instanceof Error ? e.message : String(e));
    }
  }

  function quitar() {
    Alert.alert('Quitar firma y sello', 'Las constancias saldrán con el espacio para firmar a mano.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          await quitarFirma(db);
          setFirma(null);
        },
      },
    ]);
  }

  return (
    <PantallaFormulario>
      <Seccion titulo="Firma y sello">
        <Text style={[estilos.pequeno, { marginBottom: espacio.m }]}>
          Esta imagen se imprime en las constancias, sobre la línea de firma y debajo de los diagnósticos. Use un PNG con fondo
          transparente (firma y sello juntos).
        </Text>
        {cargado && firma ? (
          <View style={{ backgroundColor: '#FFFFFF', borderColor: colores.borde, borderWidth: 1, borderRadius: radio.m, padding: espacio.m, alignItems: 'center', marginBottom: espacio.m }}>
            <Image source={{ uri: firma }} style={{ width: 260, height: 180 }} resizeMode="contain" accessibilityLabel="Firma y sello" />
          </View>
        ) : cargado ? (
          <Aviso>Todavía no ha subido su firma y sello. Las constancias saldrán con espacio para firmar a mano.</Aviso>
        ) : null}
        <Boton texto={firma ? 'Cambiar imagen' : 'Elegir imagen (PNG o JPG)'} onPress={() => void elegir()} />
        {firma && <Boton texto="Quitar firma y sello" variante="peligro" onPress={quitar} />}
      </Seccion>
      <Aviso tono="info">
        Por seguridad, la firma no está en el código de la app ni en internet: queda guardada solo en sus datos (y viaja cifrada a
        sus otros equipos y a sus respaldos). Quien tenga acceso a esta app abierta podría emitir constancias: no deje la
        computadora sin bloquear.
      </Aviso>
    </PantallaFormulario>
  );
}
