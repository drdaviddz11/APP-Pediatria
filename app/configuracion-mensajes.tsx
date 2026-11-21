// Ajustes de los mensajes de WhatsApp y de los criterios para saber a quién le toca control.

import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Alert } from '../src/ui/dialogo';
import { guardarConfigControles, guardarConfigMensajes, leerConfigControles, leerConfigMensajes } from '../src/db/seguimiento';
import { ConfigControles, EDADES_AAP, leerEdades } from '../src/seguimiento/controles';
import { ConfigMensajes, MARCAS, NOMBRE_TIPO_MENSAJE, TipoMensaje } from '../src/seguimiento/mensajes';
import { Boton, Campo, Cargando, EnlaceTexto, Interruptor, PantallaFormulario, Seccion, estilos } from '../src/ui/componentes';

const TIPOS: TipoMensaje[] = ['recordatorio', 'propuesta', 'general', 'cumpleanos'];

export default function ConfiguracionMensajes() {
  const db = useSQLiteContext();
  const [mensajes, setMensajes] = useState<ConfigMensajes | null>(null);
  const [controles, setControles] = useState<ConfigControles | null>(null);
  const [edades, setEdades] = useState('');
  const [meses, setMeses] = useState('');
  const [dias, setDias] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void (async () => {
      const [m, c] = await Promise.all([leerConfigMensajes(db), leerConfigControles(db)]);
      setMensajes(m);
      setControles(c);
      setEdades(c.edadesNinoSano.join(', '));
      setMeses(String(c.mesesSinConsulta));
      setDias(String(c.diasAnticipacion));
    })();
  }, [db]);

  if (!mensajes || !controles) return <Cargando />;
  const m = mensajes;
  const c = controles;

  async function guardar() {
    const errores: string[] = [];
    if (!m.nombreConsultorio.trim()) errores.push('Escriba cómo se presenta el consultorio.');
    if (!/^\d{1,3}$/.test(m.codigoPais.trim())) errores.push('El código de país debe tener de 1 a 3 dígitos (Honduras: 504).');
    for (const t of TIPOS) if (!m.plantillas[t].trim()) errores.push(`El mensaje "${NOMBRE_TIPO_MENSAJE[t]}" está vacío.`);
    const listaEdades = leerEdades(edades);
    if (c.ninoSanoActivo && !listaEdades) errores.push('Edades de niño sano: escriba meses separados por comas (por ejemplo 1, 2, 4, 6).');
    const nMeses = Number(meses);
    const nDias = Number(dias);
    if (!Number.isInteger(nMeses) || nMeses < 1 || nMeses > 60) errores.push('Meses sin consulta: entre 1 y 60.');
    if (!Number.isInteger(nDias) || nDias < 0 || nDias > 60) errores.push('Días de anticipación: entre 0 y 60.');
    if (errores.length > 0) {
      Alert.alert('Revise los datos', errores.join('\n'));
      return;
    }
    setGuardando(true);
    try {
      await guardarConfigMensajes(db, { ...m, nombreConsultorio: m.nombreConsultorio.trim(), codigoPais: m.codigoPais.trim() });
      await guardarConfigControles(db, {
        ...c,
        edadesNinoSano: listaEdades ?? c.edadesNinoSano,
        mesesSinConsulta: nMeses,
        diasAnticipacion: nDias,
      });
      router.back();
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
      setGuardando(false);
    }
  }

  return (
    <PantallaFormulario>
      <Seccion titulo="Mensajes de WhatsApp">
        <Campo
          etiqueta="Cómo se presenta el consultorio"
          value={m.nombreConsultorio}
          onChangeText={(v) => setMensajes({ ...m, nombreConsultorio: v })}
          placeholder="la consulta del Dr. …"
          ayuda='Se usa en "Le saludamos de …".'
        />
        <Campo
          etiqueta="Código de país"
          value={m.codigoPais}
          onChangeText={(v) => setMensajes({ ...m, codigoPais: v })}
          keyboardType="number-pad"
          ayuda="Se agrega a los números de 8 dígitos."
        />
        {TIPOS.map((t) => (
          <Campo
            key={t}
            etiqueta={NOMBRE_TIPO_MENSAJE[t]}
            value={m.plantillas[t]}
            onChangeText={(v) => setMensajes({ ...m, plantillas: { ...m.plantillas, [t]: v } })}
            multiline
            autoCapitalize="sentences"
          />
        ))}
        <Text style={estilos.suave}>
          Marcas que la app reemplaza: {MARCAS.join(', ')}. No incluya diagnósticos ni información clínica.
        </Text>
      </Seccion>

      <Seccion titulo="¿A quién le toca control?">
        <Interruptor
          etiqueta="Fecha de seguimiento indicada en la última consulta"
          valor={c.seguimientoActivo}
          alCambiar={(v) => setControles({ ...c, seguimientoActivo: v })}
        />
        <Interruptor
          etiqueta="Control de niño sano según la edad"
          valor={c.ninoSanoActivo}
          alCambiar={(v) => setControles({ ...c, ninoSanoActivo: v })}
        />
        {c.ninoSanoActivo && (
          <>
            <Campo
              etiqueta="Edades de control de niño sano (meses)"
              value={edades}
              onChangeText={setEdades}
              keyboardType="numbers-and-punctuation"
              ayuda="Por defecto, calendario de visitas de la AAP (Bright Futures): 1, 2, 4, 6, 9, 12, 15, 18, 24, 30 meses, 3 años y luego cada año."
            />
            <EnlaceTexto texto="Restaurar calendario de la AAP" onPress={() => setEdades(EDADES_AAP.join(', '))} />
          </>
        )}
        <Interruptor
          etiqueta="Pacientes sin consulta hace tiempo"
          valor={c.sinConsultaActivo}
          alCambiar={(v) => setControles({ ...c, sinConsultaActivo: v })}
        />
        {c.sinConsultaActivo && (
          <Campo etiqueta="Sin consulta desde hace" unidad="meses" value={meses} onChangeText={setMeses} keyboardType="number-pad" />
        )}
        <Campo
          etiqueta="Mostrar con anticipación"
          unidad="días"
          value={dias}
          onChangeText={setDias}
          keyboardType="number-pad"
          ayuda="Los controles que vencen en estos días ya aparecen en la lista."
        />
      </Seccion>

      <Boton texto={guardando ? 'Guardando…' : 'Guardar ajustes'} onPress={guardar} deshabilitado={guardando} />
    </PantallaFormulario>
  );
}
