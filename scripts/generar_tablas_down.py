"""Genera las tablas LMS de crecimiento para niños con síndrome de Down (CDC).

Fuente: Zemel BS et al. Growth Charts for Children With Down Syndrome in the United States.
Pediatrics 2015;136(5):e1204-11. Supplemental Tables 4-19 (archivo PEDS_20151652SupplementaryData.pdf).
Son los datos de las curvas publicadas por el CDC para niños con síndrome de Down.

Al extraer el texto del PDF, el signo menos aparece como un "2" delante del número
(por ejemplo "20.045" es -0.045). Como |L| < 10 en todas las tablas, todo L >= 10 se corrige.
Cada fila se verifica contra los 9 percentiles impresos en la misma tabla; si alguno no coincide,
el script se detiene.

Uso: python3 scripts/generar_tablas_down.py <PDF suplementario>
"""
import os, re, subprocess, sys
from statistics import NormalDist

pdf = sys.argv[1]
texto = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, text=True, check=True).stdout
salida = os.path.join(os.path.dirname(__file__), '..', 'src', 'crecimiento', 'datos', 'cdcDown.ts')

# número de tabla -> (indicador, sexo, unidad de x)
TABLAS = {
    4: ('pesoEdad036', 'F'), 5: ('tallaEdad036', 'F'), 6: ('pcEdad036', 'F'), 7: ('pesoLongitud036', 'F'),
    8: ('pesoEdad036', 'M'), 9: ('tallaEdad036', 'M'), 10: ('pcEdad036', 'M'), 11: ('pesoLongitud036', 'M'),
    12: ('pesoEdad220', 'F'), 13: ('tallaEdad220', 'F'), 14: ('pcEdad220', 'F'), 15: ('imcEdad220', 'F'),
    16: ('pesoEdad220', 'M'), 17: ('tallaEdad220', 'M'), 18: ('pcEdad220', 'M'), 19: ('imcEdad220', 'M'),
}
PERCENTILES = [2, 5, 10, 25, 50, 75, 90, 95, 98]

filas = {}
actual = None
for linea in texto.replace('\f', '\n').split('\n'):
    m = re.match(r'\s*SUPPLEMENTAL TABLE (\d+)', linea)
    if m:
        actual = int(m.group(1))
        filas[actual] = []
        continue
    if actual in TABLAS:
        t = linea.split()
        if len(t) == 13 and all(re.match(r'^\d+(\.\d+)?$', x) for x in t):
            filas[actual].append(t)


datos = {}
maxdif = 0.0
total = 0
for n, (clave, sexo) in TABLAS.items():
    v = filas[n]
    assert v, f'Tabla {n} vacía'
    xs = [float(r[0]) for r in v]
    paso = round(xs[1] - xs[0], 3)
    assert all(abs((b - a) - paso) < 1e-9 for a, b in zip(xs, xs[1:])), f'Tabla {n}: puntos irregulares'
    lms = []
    for r in v:
        l = float(r[1])
        if l >= 10:  # "2" en lugar del signo menos
            l = -float(r[1][1:])
        m_, s_ = float(r[2]), float(r[3])
        for p, impreso in zip(PERCENTILES, r[4:]):
            # Diferencia en unidades Z entre el percentil impreso y el esperado. Los percentiles están
            # impresos a 1 decimal y L, M, S a 3 decimales, lo que explica diferencias de hasta ~0.2 Z
            # en medidas pequeñas; un error de extracción (por ejemplo, un signo) da varias unidades Z.
            y = float(impreso)
            z_impreso = ((y / m_) ** l - 1) / (l * s_)
            dif = abs(z_impreso - NormalDist().inv_cdf(p / 100))
            maxdif = max(maxdif, dif)
            total += 1
            assert dif <= 0.25, f'Tabla {n}, x={r[0]}, P{p}: impreso {impreso}, diferencia {dif:.3f} Z'
        lms.append((l, m_, s_))
    datos.setdefault(clave, {})[sexo] = (xs[0], paso, lms)

lineas = [
    '// ARCHIVO GENERADO por scripts/generar_tablas_down.py. No editar a mano.',
    '// Curvas de crecimiento para niños con síndrome de Down (CDC).',
    '// Fuente: Zemel BS et al. Pediatrics 2015;136(5):e1204-11, Supplemental Tables 4-19.',
    '// 0-36 meses: edad en meses (peso desde 0, longitud y PC desde 1 mes); peso para longitud en cm.',
    '// 2-20 años: edad en años, cada 0.5.',
    '',
    "import type { TablaLMSPorSexo } from '../tipos';",
    '',
    '/* eslint-disable */',
    f"export const CDC_DOWN: Record<{' | '.join(repr(k) for k in datos)}, TablaLMSPorSexo> = {{",
]
for clave, por_sexo in datos.items():
    pasos = {p for (_, p, _) in por_sexo.values()}
    assert len(pasos) == 1
    lineas.append(f'  {clave}: {{')
    lineas.append(f'    paso: {pasos.pop()},')
    for sexo in ('M', 'F'):
        inicio, _, lms = por_sexo[sexo]
        valores = ','.join(f'{l:g},{m:g},{s:g}' for l, m, s in lms)
        lineas.append(f'    {sexo}: {{ inicio: {inicio:g}, v: [{valores}] }},')
    lineas.append('  },')
lineas.append('};')
with open(salida, 'w') as f:
    f.write('\n'.join(lineas) + '\n')
print(f'Tablas generadas. {total} percentiles verificados; diferencia máxima {maxdif:.3f} Z')
