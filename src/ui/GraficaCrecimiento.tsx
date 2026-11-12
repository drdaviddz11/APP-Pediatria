// Gráfica de crecimiento: curvas OMS (Z o percentiles) y mediciones del paciente.

import { useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import type { ConfigGrafica, LineaReferencia, PuntoPaciente } from '../crecimiento/curvas';
import { colores } from './tema';

const ESTILO_LINEA: Record<LineaReferencia['tipo'], { color: string; grosor: number; guiones?: string }> = {
  mediana: { color: '#1E7B34', grosor: 2 },
  media: { color: '#C62828', grosor: 1.5 },
  extrema: { color: '#14232E', grosor: 1.5 },
  leve: { color: '#E08A00', grosor: 1, guiones: '4 3' },
};

const MARGEN = { izq: 38, der: 34, arriba: 12, abajo: 40 };

function pasoAgradable(rango: number, marcas = 6): number {
  const bruto = rango / marcas;
  const potencia = Math.pow(10, Math.floor(Math.log10(bruto)));
  const n = bruto / potencia;
  const base = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return base * potencia;
}

export function GraficaCrecimiento({ config, puntos }: { config: ConfigGrafica; puntos: PuntoPaciente[] }) {
  const { width } = useWindowDimensions();
  const ancho = Math.max(280, width - 64);
  const alto = 320;
  const { ejeX } = config;

  // Rango vertical: todas las curvas y los puntos del paciente.
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const l of config.lineas) for (const p of l.puntos) {
    yMin = Math.min(yMin, p.y);
    yMax = Math.max(yMax, p.y);
  }
  for (const p of puntos) {
    yMin = Math.min(yMin, p.y);
    yMax = Math.max(yMax, p.y);
  }
  if (!Number.isFinite(yMin)) return null;
  const pasoY = pasoAgradable(yMax - yMin);
  yMin = Math.floor(yMin / pasoY) * pasoY;
  yMax = Math.ceil(yMax / pasoY) * pasoY;

  const areaAncho = ancho - MARGEN.izq - MARGEN.der;
  const areaAlto = alto - MARGEN.arriba - MARGEN.abajo;
  const X = (x: number) => MARGEN.izq + ((x - ejeX.min) / (ejeX.max - ejeX.min)) * areaAncho;
  const Y = (y: number) => MARGEN.arriba + (1 - (y - yMin) / (yMax - yMin)) * areaAlto;

  const marcasY: number[] = [];
  for (let y = yMin; y <= yMax + 1e-9; y += pasoY) marcasY.push(Math.round(y * 1000) / 1000);

  const camino = (ps: { x: number; y: number }[]) =>
    ps.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');

  return (
    <View>
      <Svg width={ancho} height={alto}>
        {/* Cuadrícula y ejes */}
        {marcasY.map((y) => (
          <G key={`y${y}`}>
            <Line x1={MARGEN.izq} x2={ancho - MARGEN.der} y1={Y(y)} y2={Y(y)} stroke={colores.borde} strokeWidth={0.5} />
            <SvgText x={MARGEN.izq - 4} y={Y(y) + 3} fontSize={9} fill={colores.textoSuave} textAnchor="end">
              {Number.isInteger(y) ? y : y.toFixed(1)}
            </SvgText>
          </G>
        ))}
        {ejeX.marcas.map((x) => (
          <G key={`x${x}`}>
            <Line x1={X(x)} x2={X(x)} y1={MARGEN.arriba} y2={alto - MARGEN.abajo} stroke={colores.borde} strokeWidth={0.5} />
            <SvgText x={X(x)} y={alto - MARGEN.abajo + 12} fontSize={9} fill={colores.textoSuave} textAnchor="middle">
              {ejeX.textoMarca(x)}
            </SvgText>
          </G>
        ))}
        <SvgText x={MARGEN.izq + areaAncho / 2} y={alto - 8} fontSize={10} fill={colores.texto} textAnchor="middle">
          {ejeX.titulo}
        </SvgText>
        <SvgText x={4} y={MARGEN.arriba + 2} fontSize={10} fill={colores.texto}>
          {config.unidadY}
        </SvgText>

        {/* Curvas de referencia */}
        {config.lineas.map((l) => {
          const e = ESTILO_LINEA[l.tipo];
          const ultimo = l.puntos[l.puntos.length - 1];
          return (
            <G key={l.etiqueta}>
              <Path d={camino(l.puntos)} stroke={e.color} strokeWidth={e.grosor} strokeDasharray={e.guiones} fill="none" />
              {ultimo && (
                <SvgText x={X(ultimo.x) + 3} y={Y(ultimo.y) + 3} fontSize={9} fill={e.color} fontWeight="bold">
                  {l.etiqueta}
                </SvgText>
              )}
            </G>
          );
        })}

        {/* Mediciones del paciente */}
        {puntos.length > 1 && <Path d={camino(puntos)} stroke={colores.primario} strokeWidth={2} fill="none" />}
        {puntos.map((p, i) => (
          <Circle key={i} cx={X(p.x)} cy={Y(p.y)} r={4.5} fill={colores.primario} stroke="#FFFFFF" strokeWidth={1.5} />
        ))}
      </Svg>
    </View>
  );
}
