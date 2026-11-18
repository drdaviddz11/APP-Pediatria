// Caja del día: cobros, consultas sin cobro y cierre diario.

import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { diaLocal, FORMAS_PAGO, resumir, sumarDiasADia, textoDia, textoDinero, textoFormaPago } from '../../src/caja/dinero';
import {
  AjustesCaja,
  anularCobro,
  cerrarDia,
  Cierre,
  Cobro,
  cobrosDelDia,
  ConsultaSinCobro,
  consultasSinCobro,
  leerAjustesCaja,
  leerCierre,
  reabrirDia,
} from '../../src/db/caja';
import { textoFechaHora } from '../../src/domain/fechas';
import { useFocusEffectConSync } from '../../src/sincronizacion/eventos';
import { BotonFlecha } from '../../src/ui/agenda';
import { Aviso, Boton, Campo, Cargando, EnlaceTexto, PantallaFormulario, Seccion, estilos } from '../../src/ui/componentes';
import { Alert } from '../../src/ui/dialogo';
import { colores, espacio, radio, texto } from '../../src/ui/tema';

function hora(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function Caja() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ dia?: string }>();
  const hoy = diaLocal(new Date());
  const [dia, setDia] = useState(params.dia && /^\d{4}-\d{2}-\d{2}$/.test(params.dia) ? params.dia : hoy);
  const [datos, setDatos] = useState<{ cobros: Cobro[]; sinCobro: ConsultaSinCobro[]; cierre: Cierre | null; ajustes: AjustesCaja } | null>(null);
  const [nota, setNota] = useState('');
  const [anulando, setAnulando] = useState<{ id: string; motivo: string } | null>(null);

  const cargar = useCallback(() => {
    let vigente = true;
    void Promise.all([cobrosDelDia(db, dia), consultasSinCobro(db, dia), leerCierre(db, dia), leerAjustesCaja(db)]).then(
      ([cobros, sinCobro, cierre, ajustes]) => {
        if (vigente) setDatos({ cobros, sinCobro, cierre, ajustes });
      },
    );
    return () => {
      vigente = false;
    };
  }, [db, dia]);
  useFocusEffectConSync(cargar);

  if (!datos) return <Cargando />;
  const { cobros, sinCobro, cierre, ajustes } = datos;
  const m = ajustes.moneda;
  const resumen = resumir(cobros);
  const cerrado = cierre !== null;

  function cambiarDia(n: number) {
    setDatos(null);
    setAnulando(null);
    setDia((d) => sumarDiasADia(d, n));
  }

  function irAHoy() {
    setDatos(null);
    setAnulando(null);
    setDia(hoy);
  }

  function confirmarCierre() {
    const detalle = FORMAS_PAGO.map((f) => `${f.texto}: ${textoDinero(resumen.porForma[f.valor].centavos, m)}`).join('\n');
    const avisoSinCobro = sinCobro.length > 0 ? `\n\nAtención: ${sinCobro.length} ${sinCobro.length === 1 ? 'consulta quedó' : 'consultas quedaron'} sin cobro.` : '';
    Alert.alert('Cerrar el día', `Total: ${textoDinero(resumen.totalCentavos, m)} (${resumen.cantidad} cobros)\n\n${detalle}${avisoSinCobro}\n\nDespués de cerrar no se podrán agregar ni anular cobros de este día, salvo que lo reabra.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar el día',
        onPress: async () => {
          try {
            await cerrarDia(db, dia, nota);
            setNota('');
            cargar();
          } catch (e) {
            Alert.alert('No se pudo cerrar', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  }

  function confirmarReabrir() {
    Alert.alert('Reabrir el día', 'Podrá agregar o anular cobros de este día. Luego tendrá que cerrarlo otra vez. Quedará registrado en la bitácora.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Reabrir',
        style: 'destructive',
        onPress: async () => {
          try {
            await reabrirDia(db, dia);
            cargar();
          } catch (e) {
            Alert.alert('No se pudo reabrir', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  }

  async function guardarAnulacion() {
    if (!anulando) return;
    try {
      await anularCobro(db, anulando.id, anulando.motivo);
      setAnulando(null);
      cargar();
    } catch (e) {
      Alert.alert('No se pudo anular', e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <PantallaFormulario>
      <View style={s.navegacion}>
        <BotonFlecha texto="‹" etiqueta="Día anterior" onPress={() => cambiarDia(-1)} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.titulo}>{dia === hoy ? 'Hoy' : textoDia(dia).split(' de ')[0]}</Text>
          <Text style={estilos.suave}>{textoDia(dia)}</Text>
          {dia !== hoy && <EnlaceTexto texto="Ir a hoy" onPress={irAHoy} />}
        </View>
        <BotonFlecha texto="›" etiqueta="Día siguiente" onPress={() => cambiarDia(1)} />
      </View>

      {cerrado && (
        <View style={s.cerrado}>
          <Text style={s.cerradoTexto}>🔒 Día cerrado · {textoFechaHora(cierre.cerradoEn)}</Text>
          {cierre.nota ? <Text style={estilos.pequeno}>Nota: {cierre.nota}</Text> : null}
        </View>
      )}

      <Seccion titulo="Total del día">
        <Text style={s.total}>{textoDinero(resumen.totalCentavos, m)}</Text>
        <Text style={estilos.suave}>
          {resumen.cantidad} {resumen.cantidad === 1 ? 'cobro' : 'cobros'}
          {resumen.anulados > 0 ? ` · ${resumen.anulados} ${resumen.anulados === 1 ? 'anulado' : 'anulados'} (no suman)` : ''}
        </Text>
        <View style={s.formas}>
          {FORMAS_PAGO.map((f) => (
            <View key={f.valor} style={s.forma}>
              <Text style={estilos.suave}>{f.texto}</Text>
              <Text style={s.formaMonto}>{textoDinero(resumen.porForma[f.valor].centavos, m)}</Text>
            </View>
          ))}
        </View>
      </Seccion>

      {sinCobro.length > 0 && (
        <Seccion titulo={`Consultas sin cobro (${sinCobro.length})`}>
          {sinCobro.map((c) => (
            <View key={c.consultaId} style={s.fila}>
              <View style={{ flex: 1 }}>
                <Text style={estilos.normal}>{c.pacienteNombre}</Text>
                <Text style={estilos.suave}>Consulta de las {hora(c.fechaHora)}</Text>
              </View>
              {!cerrado && (
                <EnlaceTexto
                  texto="Cobrar"
                  onPress={() => router.push({ pathname: '/caja/cobro', params: { consultaId: c.consultaId, pacienteId: c.pacienteId } })}
                />
              )}
            </View>
          ))}
          <Text style={[estilos.suave, { fontSize: texto.mini, marginTop: espacio.s }]}>
            Si alguna fue sin costo (cortesía), puede dejarla así; solo es un recordatorio.
          </Text>
        </Seccion>
      )}

      <Seccion
        titulo="Cobros"
        accion={!cerrado && dia <= hoy ? <EnlaceTexto texto="+ Otro ingreso" onPress={() => router.push({ pathname: '/caja/cobro', params: { dia } })} /> : undefined}
      >
        {cobros.length === 0 ? (
          <Text style={estilos.suave}>No hay cobros registrados este día.</Text>
        ) : (
          cobros.map((c) => (
            <View key={c.id}>
              <Pressable
                style={s.fila}
                disabled={cerrado || c.anulado}
                onPress={() => setAnulando(anulando?.id === c.id ? null : { id: c.id, motivo: '' })}
              >
                <Text style={s.hora}>{hora(c.fecha)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[estilos.normal, c.anulado && s.tachado]}>
                    {c.concepto}
                    {c.pacienteNombre ? ` · ${c.pacienteNombre}` : ''}
                  </Text>
                  <Text style={estilos.suave}>
                    {textoFormaPago(c.forma)}
                    {c.nota ? ` · ${c.nota}` : ''}
                    {c.anulado ? ` · ANULADO: ${c.motivoAnulacion}` : ''}
                  </Text>
                </View>
                <Text style={[s.monto, c.anulado && s.tachado]}>{textoDinero(c.montoCentavos, m)}</Text>
              </Pressable>
              {anulando?.id === c.id && (
                <View style={s.anular}>
                  <Campo
                    etiqueta="Motivo para anular este cobro"
                    value={anulando.motivo}
                    onChangeText={(v) => setAnulando({ id: c.id, motivo: v })}
                    placeholder="Por ejemplo: se registró dos veces"
                  />
                  <Boton texto="Anular cobro" variante="peligro" onPress={() => void guardarAnulacion()} />
                  <EnlaceTexto texto="Cancelar" onPress={() => setAnulando(null)} />
                </View>
              )}
            </View>
          ))
        )}
        {!cerrado && cobros.some((c) => !c.anulado) && (
          <Text style={[estilos.suave, { fontSize: texto.mini, marginTop: espacio.s }]}>Toque un cobro para anularlo (no se borra).</Text>
        )}
      </Seccion>

      {cerrado ? (
        <Boton texto="Reabrir el día" variante="secundario" onPress={confirmarReabrir} />
      ) : dia <= hoy ? (
        <Seccion titulo="Cierre del día">
          <Campo etiqueta="Nota del cierre (opcional)" value={nota} onChangeText={setNota} placeholder="Por ejemplo: depósito en el banco mañana" />
          <Boton texto={`Cerrar el día · ${textoDinero(resumen.totalCentavos, m)}`} onPress={confirmarCierre} />
        </Seccion>
      ) : (
        <Aviso tono="info">Este día todavía no llega.</Aviso>
      )}

      <Boton texto="Resumen del mes y exportar" variante="secundario" onPress={() => router.push({ pathname: '/caja/mes', params: { mes: dia.slice(0, 7) } })} />
      <Boton texto="Precios sugeridos" variante="secundario" onPress={() => router.push('/caja/precios')} />
    </PantallaFormulario>
  );
}

const s = StyleSheet.create({
  navegacion: { flexDirection: 'row', alignItems: 'center', marginBottom: espacio.l, gap: espacio.s },
  titulo: { fontSize: texto.titulo, fontWeight: '700', color: colores.texto, textTransform: 'capitalize' },
  cerrado: { backgroundColor: colores.primarioSuave, borderRadius: radio.m, padding: espacio.m, marginBottom: espacio.l, gap: 2 },
  cerradoTexto: { fontSize: texto.normal, fontWeight: '700', color: colores.primarioOscuro },
  total: { fontSize: 32, fontWeight: '800', color: colores.texto },
  formas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.m, marginTop: espacio.m },
  forma: { flexGrow: 1, minWidth: 110, backgroundColor: colores.fondo, borderRadius: radio.s, padding: espacio.m },
  formaMonto: { fontSize: texto.normal, fontWeight: '700', color: colores.texto, marginTop: 2 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.m,
    paddingVertical: espacio.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.borde,
  },
  hora: { fontSize: texto.pequeno, color: colores.textoSuave, width: 44 },
  monto: { fontSize: texto.normal, fontWeight: '700', color: colores.texto },
  tachado: { textDecorationLine: 'line-through', color: colores.textoSuave },
  anular: { backgroundColor: colores.peligroSuave, borderRadius: radio.m, padding: espacio.m, marginVertical: espacio.s },
});
