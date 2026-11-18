// Registrar un cobro: de una consulta (precio sugerido) u otro ingreso (vacuna, certificado, procedimiento…).

import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { CONCEPTOS, diaLocal, FORMAS_PAGO, FormaPago, leerMonto, montoParaCampo, textoDia } from '../../src/caja/dinero';
import { crearCobro, leerAjustesCaja, precioParaConsulta } from '../../src/db/caja';
import { obtenerPaciente } from '../../src/db/pacientes';
import { Pastilla } from '../../src/ui/agenda';
import { Boton, Campo, Cargando, PantallaFormulario, Seccion, Selector, estilos } from '../../src/ui/componentes';
import { Alert } from '../../src/ui/dialogo';
import { espacio } from '../../src/ui/tema';

export default function NuevoCobro() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ consultaId?: string; pacienteId?: string; dia?: string }>();
  const [listo, setListo] = useState(false);
  const [moneda, setMoneda] = useState('L');
  const [paciente, setPaciente] = useState<string | null>(null);
  const [pacienteId, setPacienteId] = useState<string | null>(params.pacienteId ?? null);
  const [concepto, setConcepto] = useState(params.consultaId ? 'Consulta' : 'Vacuna');
  const [otroConcepto, setOtroConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [forma, setForma] = useState<FormaPago>('efectivo');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  const hoy = diaLocal(new Date());
  const dia = params.dia && /^\d{4}-\d{2}-\d{2}$/.test(params.dia) && params.dia < hoy ? params.dia : hoy;

  useEffect(() => {
    void (async () => {
      const ajustes = await leerAjustesCaja(db);
      setMoneda(ajustes.moneda);
      let idPaciente = params.pacienteId ?? null;
      if (params.consultaId) {
        const sugerido = await precioParaConsulta(db, params.consultaId);
        if (sugerido) {
          setConcepto(sugerido.concepto);
          if (sugerido.centavos > 0) setMonto(montoParaCampo(sugerido.centavos));
          idPaciente = sugerido.pacienteId;
          setPacienteId(sugerido.pacienteId);
        }
      }
      if (idPaciente) {
        const p = await obtenerPaciente(db, idPaciente);
        if (p) setPaciente(`${p.nombres} ${p.apellidos}`);
      }
      setListo(true);
    })();
  }, [db, params.consultaId, params.pacienteId]);

  if (!listo) return <Cargando />;

  async function guardar() {
    const centavos = leerMonto(monto);
    if (centavos === null || centavos === 0) {
      Alert.alert('Monto', 'Escriba el monto, por ejemplo 800 o 1,250.50.');
      return;
    }
    const conceptoFinal = concepto === 'Otro' ? otroConcepto.trim() : concepto;
    if (!conceptoFinal) {
      Alert.alert('Concepto', 'Escriba qué se cobró.');
      return;
    }
    setGuardando(true);
    try {
      const [a, m, d] = dia.split('-').map(Number);
      await crearCobro(db, {
        pacienteId,
        consultaId: params.consultaId ?? null,
        concepto: conceptoFinal,
        montoCentavos: centavos,
        forma,
        nota,
        // Un ingreso de un día anterior (que no se registró a tiempo) queda a mediodía de ese día.
        fecha: dia === hoy ? new Date() : new Date(a, m - 1, d, 12, 0),
      });
      router.back();
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
      setGuardando(false);
    }
  }

  return (
    <PantallaFormulario>
      <Seccion titulo={params.consultaId ? 'Cobro de la consulta' : 'Otro ingreso'}>
        {paciente && <Text style={[estilos.normal, { marginBottom: espacio.s }]}>Paciente: {paciente}</Text>}
        {dia !== hoy && <Text style={[estilos.suave, { marginBottom: espacio.s }]}>Se registrará en el día {textoDia(dia)}.</Text>}
        {!params.consultaId && (
          <View style={{ marginBottom: espacio.m }}>
            <Text style={estilos.etiqueta}>Concepto</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
              {CONCEPTOS.map((c) => (
                <Pastilla key={c} texto={c} activa={concepto === c} onPress={() => setConcepto(c)} />
              ))}
            </View>
          </View>
        )}
        {concepto === 'Otro' && <Campo etiqueta="¿Qué se cobró?" value={otroConcepto} onChangeText={setOtroConcepto} placeholder="Por ejemplo: nebulización" />}
        {params.consultaId && (
          <Selector<string>
            etiqueta="Tipo"
            opciones={[
              { valor: 'Consulta', texto: 'Primera vez' },
              { valor: 'Control', texto: 'Control' },
            ]}
            valor={concepto}
            alCambiar={setConcepto}
          />
        )}
        <Campo etiqueta="Monto" unidad={moneda} value={monto} onChangeText={setMonto} keyboardType="decimal-pad" placeholder="0.00" />
        <Selector<FormaPago> etiqueta="Forma de pago" opciones={FORMAS_PAGO} valor={forma} alCambiar={setForma} />
        <View style={{ height: espacio.m }} />
        <Campo etiqueta="Nota (opcional)" value={nota} onChangeText={setNota} placeholder="Por ejemplo: número de recibo o de transferencia" />
      </Seccion>
      <Boton texto={guardando ? 'Guardando…' : 'Guardar cobro'} onPress={() => void guardar()} deshabilitado={guardando} />
    </PantallaFormulario>
  );
}
