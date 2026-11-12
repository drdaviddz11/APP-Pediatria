# Validación de la evaluación nutricional

## Origen de las tablas

Las tablas LMS se tomaron sin modificar de los repositorios oficiales de la OMS y se convierten a código con `scripts/generar_tablas_oms.py`:

| Referencia | Repositorio oficial | Archivos |
|---|---|---|
| Patrones de crecimiento OMS 2006 (0–5 años) | github.com/WorldHealthOrganization/anthro | `weianthro`, `lenanthro`, `bmianthro`, `hcanthro`, `wflanthro`, `wfhanthro` |
| Referencia de crecimiento OMS 2007 (5–19 años) | github.com/WorldHealthOrganization/anthroplus | `wfawho2007`, `hfawho2007`, `bfawho2007` |

El script comprueba que no falte ni se repita ningún punto de las tablas.

## Reglas reproducidas del software de la OMS

- Puntaje Z: `((y/M)^L − 1) / (L·S)`. En peso para la edad, peso para la longitud/talla e IMC para la edad, corrección de la OMS para |Z| > 3.
- 0–5 años: edad en días (tablas diarias hasta 1826 días). Longitud acostado antes de 731 días y talla de pie desde 731 días; ajuste de +0.7 / −0.7 cm cuando la posición no corresponde. Talla de pie antes de 9 meses: no se ajusta.
- Peso para longitud (45–110 cm) antes de 731 días y peso para talla (65–120 cm) después, con interpolación cada 0.1 cm.
- 5–19 años: edad en meses (días / 30.4375) con interpolación entre meses. Talla e IMC hasta < 229 meses; peso para la edad hasta < 121 meses.
- Edema bilateral: no se calculan los indicadores basados en peso.
- Límites de plausibilidad: peso/edad < −6 o > +5; talla/edad |Z| > 6; peso/talla, IMC y perímetro cefálico |Z| > 5.
- Decisión clínica del proyecto: edad corregida para nacidos antes de las 37 semanas, hasta los 24 meses cronológicos.

## Resultados

| Prueba | Resultado |
|---|---|
| Encuesta de referencia del paquete anthroplus (933 niños de 5–19 años, puntajes calculados por la OMS) | **2101 de 2101 puntajes Z coinciden** (diferencia ≤ 0.01, por el redondeo de la edad en el archivo de la OMS) |
| Caso de prueba del paquete anthro (niña, 1522 días, 17 kg) | Z = 0.24, igual que la OMS |
| Tablas simplificadas publicadas por la OMS (peso/edad niños 12 meses, longitud/edad niñas 24 meses, perímetro cefálico al nacer) | Coinciden a 1 decimal |
| Ajuste de 0.7 cm, cambio de tabla a los 731 días, límites de edad y de longitud/talla, edad corregida | Correctos |
| Percentiles (función normal) | Error < 0.00001 percentiles |
| Curvas de las gráficas (26 combinaciones) | Completas y ordenadas |

## Pendiente antes de uso clínico

- Revisión por el médico de los textos de interpretación y de los criterios de alerta (caída de Z ≥ 1 o paso por debajo de −2 DE).
- Definir si se usarán curvas para prematuros (Fenton o INTERGROWTH-21st) antes de las 40 semanas de edad corregida.
- Definir si se usarán referencias CDC en algún caso.
