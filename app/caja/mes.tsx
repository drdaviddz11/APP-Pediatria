// Resumen del mes para la contabilidad: total por forma de pago, total por día y exportación a CSV (Excel).

import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { diaLocal, FORMAS_PAGO, sumarMesesAMes, textoDia, textoDinero, textoMes } from '../../src/caja/dinero';
import { exportarMesCsv, leerAjustesCaja, ResumenMes, resumenDelMes } from '../../src/db/caja';
import { guardarArchivo } from '../../src/respaldo/archivos';
import { useFocusEffectConSync } from '../../src/sincronizacion/eventos';
import { BotonFlecha } from '../../src/ui/agenda';
import { Boton, Cargando, PantallaFormulario, Seccion, estilos } from '../../src/ui/componentes';
import { Alert } from '../../src/ui/dialogo';
import { EN_COMPUTADORA } from '../../src/ui/plataforma';
import { colores, espacio, radio, texto } from '../../src/ui/tema';

export default function ResumenDelMes() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ mes?: string }>();
  const [mes, setMes] = useState(params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : diaLocal(new Date()).slice(0, 7));
  const [datos, setDatos] = useState<{ r: ResumenMes; moneda: string } | null>(null);
  const [exportando, setExportando] = useState(false);

  const cargar = useCallback(() => {
    let vigente = true;
    void Promise.all([resumenDelMes(db, mes), leerAjustesCaja(db)]).then(([r, a]) => vigente && setDatos({ r, moneda: a.moneda }));
    return () => {
      vigente = false;
    };
  }, [db, mes]);
  useFocusEffectConSync(cargar);

  if (!datos) return <Cargando />;
  const { r, moneda } = datos;
  const abiertos = r.dias.filter((d) => !d.cerrado && d.dia < diaLocal(new Date())).length;

  async function exportar() {
    setExportando(true);
    try {
      const csv = await exportarMesCsv(db, mes);
      await guardarArchivo(`Ingresos_${mes}.csv`, csv, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', titulo: 'Ingresos del mes' });
    } catch (e) {
      Alert.alert('No se pudo exportar', e instanceof Error ? e.message : String(e));
    } finally {
      setExportando(false);
    }
  }

  return (
    <PantallaFormulario>
      <View style={s.navegacion}>
        <BotonFlecha texto="‹" etiqueta="Mes anterior" onPress={() => { setDatos(null); setMes((m) => sumarMesesAMes(m, -1)); }} />
        <Text style={[s.titulo, { flex: 1, textAlign: 'center' }]}>{textoMes(mes)}</Text>
        <BotonFlecha texto="›" etiqueta="Mes siguiente" onPress={() => { setDatos(null); setMes((m) => sumarMesesAMes(m, 1)); }} />
      </View>

      <Seccion titulo="Ingresos del mes">
        <Text style={s.total}>{textoDinero(r.resumen.totalCentavos, moneda)}</Text>
        <Text style={estilos.suave}>
          {r.resumen.cantidad} cobros{r.resumen.anulados > 0 ? ` · ${r.resumen.anulados} anulados (no suman)` : ''}
        </Text>
        <View style={s.formas}>
          {FORMAS_PAGO.map((f) => (
            <View key={f.valor} style={s.forma}>
              <Text style={estilos.suave}>{f.texto}</Text>
              <Text style={s.formaMonto}>{textoDinero(r.resumen.porForma[f.valor].centavos, moneda)}</Text>
            </View>
          ))}
        </View>
        {abiertos > 0 && (
          <Text style={[estilos.pequeno, { color: colores.aviso, marginTop: espacio.m }]}>
            {abiertos} {abiertos === 1 ? 'día pasado sin cerrar' : 'días pasados sin cerrar'}.
          </Text>
        )}
      </Seccion>

      <Seccion titulo="Por día">
        {r.dias.length === 0 ? (
          <Text style={estilos.suave}>No hay cobros este mes.</Text>
        ) : (
          r.dias.map((d) => (
            <Pressable key={d.dia} style={s.fila} onPress={() => router.push({ pathname: '/caja', params: { dia: d.dia } })}>
              <Text style={[estilos.normal, { flex: 1 }]}>{textoDia(d.dia).replace(/ de \d{4}$/, '')}</Text>
              <Text style={[estilos.suave, { width: 90 }]}>{d.cerrado ? '🔒 cerrado' : 'abierto'}</Text>
              <Text style={s.monto}>{textoDinero(d.totalCentavos, moneda)}</Text>
            </Pressable>
          ))
        )}
      </Seccion>

      <Boton texto={exportando ? 'Preparando…' : 'Exportar el mes (Excel / CSV)'} onPress={() => void exportar()} deshabilitado={exportando} />
      <Text style={[estilos.suave, { fontSize: texto.mini, marginTop: espacio.s }]}>
        {EN_COMPUTADORA
          ? 'El archivo se descarga en la carpeta Descargas y se abre con Excel, Numbers o Google Sheets. Incluye cada cobro con hora, paciente, concepto, forma de pago y anulaciones.'
          : 'Puede enviarlo por correo a su contador o guardarlo en Archivos/Drive. Se abre con Excel, Numbers o Google Sheets.'}
      </Text>
    </PantallaFormulario>
  );
}

const s = StyleSheet.create({
  navegacion: { flexDirection: 'row', alignItems: 'center', marginBottom: espacio.l, gap: espacio.s },
  titulo: { fontSize: texto.titulo, fontWeight: '700', color: colores.texto, textTransform: 'capitalize' },
  total: { fontSize: 32, fontWeight: '800', color: colores.texto },
  formas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.m, marginTop: espacio.m },
  forma: { flexGrow: 1, minWidth: 110, backgroundColor: colores.fondo, borderRadius: radio.s, padding: espacio.m },
  formaMonto: { fontSize: texto.normal, fontWeight: '700', color: colores.texto, marginTop: 2 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colores.borde },
  monto: { fontSize: texto.normal, fontWeight: '700', color: colores.texto, minWidth: 110, textAlign: 'right' },
});
