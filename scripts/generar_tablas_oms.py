"""Genera los módulos de datos con las tablas LMS oficiales de la OMS.

Fuente (sin modificar ni redondear los valores):
  - Patrones de crecimiento OMS 2006 (0-5 años): repositorio oficial
    https://github.com/WorldHealthOrganization/anthro  -> data-raw/growthstandards/*.txt
  - Referencia OMS 2007 (5-19 años): repositorio oficial
    https://github.com/WorldHealthOrganization/anthroplus -> data-raw/growthstandards/*.txt

Uso: python3 scripts/generar_tablas_oms.py <carpeta anthro> <carpeta anthroplus>
"""
import csv, os, sys

anthro, anthroplus = sys.argv[1], sys.argv[2]
salida = os.path.join(os.path.dirname(__file__), '..', 'src', 'crecimiento', 'datos')


def leer(ruta):
    with open(ruta, newline='') as f:
        return list(csv.DictReader(f, delimiter='\t'))


def por_sexo(filas, clave, inicio, paso, fin):
    """Arreglo plano [L, M, S, ...] por sexo, verificando que no falte ningún punto."""
    resultado = {}
    n = round((fin - inicio) / paso) + 1
    for sexo in ('1', '2'):
        datos = [None] * n
        for fila in filas:
            if fila['sex'] != sexo:
                continue
            i = round((float(fila[clave]) - inicio) / paso)
            assert 0 <= i < n, (clave, fila)
            assert datos[i] is None, ('duplicado', fila)
            datos[i] = (fila['l'], fila['m'], fila['s'])
        assert all(d is not None for d in datos), ('faltan puntos', clave, sexo)
        resultado[sexo] = datos
    return resultado


def escribir(nombre, encabezado, tablas):
    lineas = [f'// ARCHIVO GENERADO por scripts/generar_tablas_oms.py. No editar a mano.', encabezado, '']
    lineas.append("import type { TablaLMS } from '../tipos';")
    lineas.append('')
    lineas.append('/* eslint-disable */')
    claves = ' | '.join(repr(k) for k in tablas)
    lineas.append(f'export const {nombre}: Record<{claves}, TablaLMS> = {{')
    for clave, (inicio, paso, por_sexo_) in tablas.items():
        lineas.append(f'  {clave}: {{')
        lineas.append(f'    inicio: {inicio},')
        lineas.append(f'    paso: {paso},')
        for sexo, datos in por_sexo_.items():
            valores = ','.join(v for trio in datos for v in trio)
            lineas.append(f"    {'M' if sexo == '1' else 'F'}: [{valores}],")
        lineas.append('  },')
    lineas.append('};')
    with open(os.path.join(salida, nombre.lower() + '.ts'), 'w') as f:
        f.write('\n'.join(lineas) + '\n')


g = os.path.join(anthro, 'data-raw', 'growthstandards')
escribir(
    'OMS2006',
    '// Patrones de crecimiento infantil OMS 2006 (0 a 5 años). Edad en días; longitud/talla en cm.\n'
    '// Fuente: https://github.com/WorldHealthOrganization/anthro (data-raw/growthstandards).',
    {
        'pesoEdad': (0, 1, por_sexo(leer(f'{g}/weianthro.txt'), 'age', 0, 1, 1826)),
        'tallaEdad': (0, 1, por_sexo(leer(f'{g}/lenanthro.txt'), 'age', 0, 1, 1826)),
        'imcEdad': (0, 1, por_sexo(leer(f'{g}/bmianthro.txt'), 'age', 0, 1, 1826)),
        'pcEdad': (0, 1, por_sexo(leer(f'{g}/hcanthro.txt'), 'age', 0, 1, 1826)),
        'pesoLongitud': (45, 0.1, por_sexo(leer(f'{g}/wflanthro.txt'), 'length', 45, 0.1, 110)),
        'pesoTalla': (65, 0.1, por_sexo(leer(f'{g}/wfhanthro.txt'), 'height', 65, 0.1, 120)),
    },
)

g = os.path.join(anthroplus, 'data-raw', 'growthstandards')
escribir(
    'OMS2007',
    '// Referencia de crecimiento OMS 2007 (5 a 19 años). Edad en meses; talla en cm.\n'
    '// Fuente: https://github.com/WorldHealthOrganization/anthroplus (data-raw/growthstandards).',
    {
        'pesoEdad': (60, 1, por_sexo(leer(f'{g}/wfawho2007.txt'), 'age', 60, 1, 121)),
        'tallaEdad': (60, 1, por_sexo(leer(f'{g}/hfawho2007.txt'), 'age', 60, 1, 229)),
        'imcEdad': (60, 1, por_sexo(leer(f'{g}/bfawho2007.txt'), 'age', 60, 1, 229)),
    },
)
print('Tablas generadas')
