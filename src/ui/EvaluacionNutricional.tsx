// Tarjeta con la evaluación nutricional OMS de una medición.

import { StyleSheet, Text, View } from 'react-native';
import type { AlertaTendencia } from '../crecimiento/consulta';
import { AVISO_CLINICO, interpretarIndicador, Nivel, NOTA_DOWN, resumenNutricional } from '../crecimiento/interpretacion';
import { textoPercentil } from '../crecimiento/lms';
import { esReferenciaDown, NOMBRE_INDICADOR, NOMBRE_REFERENCIA, ResultadoEvaluacion } from '../crecimiento/tipos';
import { colores, espacio, radio, texto } from './tema';

const COLOR_NIVEL: Record<Nivel, { fondo: string; texto: string }> = {
  normal: { fondo: '#E6F4EA', texto: colores.exito },
  vigilar: { fondo: colores.avisoSuave, texto: colores.aviso },
  alerta: { fondo: '#FDECDD', texto: '#A14A00' },
  grave: { fondo: colores.peligroSuave, texto: colores.peligro },
};

function textoEdadDias(dias: number): string {
  const meses = Math.floor(dias / 30.4375);
  if (meses < 1) return `${dias} ${dias === 1 ? 'día' : 'días'}`;
  if (meses < 24) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  return resto ? `${anios} años ${resto} m` : `${anios} años`;
}

function textoZ(z: number): string {
  return `${z > 0 ? '+' : ''}${z.toFixed(2)}`;
}

export function EvaluacionNutricional({
  evaluacion,
  alertas = [],
  compacta = false,
}: {
  evaluacion: ResultadoEvaluacion | null;
  alertas?: AlertaTendencia[];
  compacta?: boolean;
}) {
  if (!evaluacion) {
    return <Text style={s.suave}>Registre peso, talla o perímetro cefálico para calcular la evaluación.</Text>;
  }
  const e = evaluacion;
  const calculados = e.indicadores.filter((i) => i.z != null);
  const noAplican = e.indicadores.filter((i) => i.z == null && i.motivoNoCalculado && i.motivoNoCalculado !== 'Falta el dato');
  const resumen = resumenNutricional(e);

  return (
    <View style={{ gap: espacio.s }}>
      {e.edadDiasUsada != null && (
        <Text style={s.suave}>
          Edad {e.usaEdadCorregida ? 'corregida' : ''}: {textoEdadDias(e.edadDiasUsada)}
          {e.usaEdadCorregida ? ` (cronológica ${textoEdadDias(e.edadDiasCronologica)})` : ''}
          {e.referencia ? ` · ${NOMBRE_REFERENCIA[e.referencia]}` : ''}
        </Text>
      )}

      {resumen.map((r, i) => (
        <View key={i} style={[s.resumen, { backgroundColor: COLOR_NIVEL[r.nivel].fondo }]}>
          <Text style={[s.resumenTexto, { color: COLOR_NIVEL[r.nivel].texto }]}>{r.texto}</Text>
          <Text style={s.sustento}>Según {r.sustento}</Text>
        </View>
      ))}

      {alertas.map((a, i) => (
        <View key={`a${i}`} style={[s.resumen, { backgroundColor: colores.avisoSuave }]}>
          <Text style={[s.resumenTexto, { color: colores.aviso }]}>Cambio respecto a la consulta anterior</Text>
          <Text style={s.sustento}>{a.mensaje}</Text>
        </View>
      ))}

      {calculados.length > 0 && (
        <View style={s.tabla}>
          <View style={[s.fila, s.filaCabecera]}>
            <Text style={[s.celdaNombre, s.cabecera]}>Indicador</Text>
            <Text style={[s.celdaNum, s.cabecera]}>Z</Text>
            <Text style={[s.celdaNum, s.cabecera]}>Pctl</Text>
          </View>
          {calculados.map((r) => {
            const i = interpretarIndicador(r);
            return (
              <View key={r.indicador} style={s.filaBloque}>
                <View style={s.fila}>
                  <Text style={s.celdaNombre}>{NOMBRE_INDICADOR[r.indicador]}</Text>
                  <Text style={[s.celdaNum, s.numero]}>{textoZ(r.z as number)}</Text>
                  <Text style={[s.celdaNum, s.numero]}>{textoPercentil(r.percentil)}</Text>
                </View>
                {i && !compacta && <Text style={[s.interpretacion, { color: COLOR_NIVEL[i.nivel].texto }]}>{i.texto}</Text>}
              </View>
            );
          })}
        </View>
      )}

      {e.imc != null && !compacta && (
        <Text style={s.suave}>
          IMC: {e.imc.toFixed(1)} kg/m²
          {e.tallaAjustadaCm != null && e.ajusteTalla !== 0 ? ` · talla usada ${e.tallaAjustadaCm} cm` : ''}
        </Text>
      )}

      {!compacta &&
        noAplican.map((r) => (
          <Text key={r.indicador} style={s.suave}>
            {NOMBRE_INDICADOR[r.indicador]}: {r.motivoNoCalculado}.
          </Text>
        ))}

      {e.notas.map((n, i) => (
        <Text key={`n${i}`} style={s.nota}>
          {n}
        </Text>
      ))}

      {esReferenciaDown(e.referencia) && <Text style={s.nota}>{NOTA_DOWN}</Text>}
      <Text style={s.aviso}>{AVISO_CLINICO}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  suave: { fontSize: texto.pequeno, color: colores.textoSuave },
  nota: { fontSize: texto.mini, color: colores.aviso },
  aviso: { fontSize: texto.mini, color: colores.textoSuave, fontStyle: 'italic' },
  resumen: { borderRadius: radio.m, padding: espacio.m },
  resumenTexto: { fontSize: texto.normal, fontWeight: '800' },
  sustento: { fontSize: texto.mini, color: colores.texto, marginTop: 2 },
  tabla: { borderWidth: 1, borderColor: colores.borde, borderRadius: radio.s, overflow: 'hidden' },
  filaCabecera: { backgroundColor: colores.fondo },
  cabecera: { fontSize: texto.mini, fontWeight: '700', color: colores.textoSuave },
  filaBloque: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colores.borde, paddingBottom: 6 },
  fila: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: espacio.s, paddingTop: 6 },
  celdaNombre: { flex: 1, fontSize: texto.pequeno, color: colores.texto },
  celdaNum: { width: 56, textAlign: 'right' },
  numero: { fontSize: texto.pequeno, fontWeight: '700', color: colores.texto, fontVariant: ['tabular-nums'] },
  interpretacion: { fontSize: texto.mini, fontWeight: '600', paddingHorizontal: espacio.s, marginTop: 2 },
});
