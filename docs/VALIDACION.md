# Validación de la evaluación nutricional

## Origen de las tablas

Las tablas LMS se tomaron sin modificar de los repositorios oficiales de la OMS y se convierten a código con `scripts/generar_tablas_oms.py`:

| Referencia | Fuente oficial | Archivos / medidas |
|---|---|---|
| Patrones de crecimiento OMS 2006 (0–5 años) | github.com/WorldHealthOrganization/anthro | `weianthro`, `lenanthro`, `bmianthro`, `hcanthro`, `wflanthro`, `wfhanthro` |
| Referencia de crecimiento OMS 2007 (5–19 años) | github.com/WorldHealthOrganization/anthroplus | `wfawho2007`, `hfawho2007`, `bfawho2007` |
| Curvas CDC para síndrome de Down (0–36 meses y 2–20 años) | Zemel BS et al., *Pediatrics* 2015;136:e1204, Supplemental Tables 4–19 (PDF suplementario) | Peso, longitud/talla, perímetro cefálico, peso para la longitud e IMC |

El script comprueba que no falte ni se repita ningún punto de las tablas.

Las tablas de síndrome de Down se extraen del PDF con `scripts/generar_tablas_down.py`. En el texto del PDF el signo menos aparece como "2" delante del número (por ejemplo "20.045" = −0.045); el script lo corrige y verifica cada fila contra los 9 percentiles impresos.

## Reglas reproducidas del software de la OMS

- Puntaje Z: `((y/M)^L − 1) / (L·S)`. En peso para la edad, peso para la longitud/talla e IMC para la edad, corrección de la OMS para |Z| > 3.
- 0–5 años: edad en días (tablas diarias hasta 1826 días). Longitud acostado antes de 731 días y talla de pie desde 731 días; ajuste de +0.7 / −0.7 cm cuando la posición no corresponde. Talla de pie antes de 9 meses: no se ajusta.
- Peso para longitud (45–110 cm) antes de 731 días y peso para talla (65–120 cm) después, con interpolación cada 0.1 cm.
- 5–19 años: edad en meses (días / 30.4375) con interpolación entre meses. Talla e IMC hasta < 229 meses; peso para la edad hasta < 121 meses.
- Edema bilateral: no se calculan los indicadores basados en peso.
- Límites de plausibilidad: peso/edad < −6 o > +5; talla/edad |Z| > 6; peso/talla, IMC y perímetro cefálico |Z| > 5.
- Decisión clínica del proyecto: edad corregida para nacidos antes de las 37 semanas, hasta los 24 meses cronológicos.

## Reglas para síndrome de Down

- 0–36 meses: edad en meses con interpolación lineal de L, M y S; peso desde el nacimiento, longitud y perímetro cefálico desde 1 mes; peso para la longitud según el rango de cada sexo (niñas 52–90 cm, niños 49–93 cm).
- 2–20 años: edad en años (cada 0.5) con interpolación; peso, talla, perímetro cefálico e IMC.
- Entre 24 y 36 meses se usan las tablas de 2–20 años solo si la talla se midió de pie.
- Puntaje Z con el método LMS, sin la corrección |Z| > 3 de la OMS. La medida se usa tal como se tomó (sin ajuste de 0.7 cm).
- Interpretación descriptiva por percentil (< P2, < P5, P5–P95, > P95, > P98): las curvas describen el crecimiento de niños con SD y no definen puntos de corte de desnutrición.
- Desde los 2 años se muestra además el IMC para la edad con la referencia general (OMS) para valorar sobrepeso u obesidad, siguiendo la indicación del CDC de usar curvas de la población general para el IMC.
- Limitación señalada por el CDC: la muestra (637 niños, mayormente de Filadelfia) puede no representar a todos los niños con SD.

## Resultados

| Prueba | Resultado |
|---|---|
| Encuesta de referencia del paquete anthroplus (933 niños de 5–19 años, puntajes calculados por la OMS) | **2101 de 2101 puntajes Z coinciden** (diferencia ≤ 0.01, por el redondeo de la edad en el archivo de la OMS) |
| Caso de prueba del paquete anthro (niña, 1522 días, 17 kg) | Z = 0.24, igual que la OMS |
| Tablas simplificadas publicadas por la OMS (peso/edad niños 12 meses, longitud/edad niñas 24 meses, perímetro cefálico al nacer) | Coinciden a 1 decimal |
| Ajuste de 0.7 cm, cambio de tabla a los 731 días, límites de edad y de longitud/talla, edad corregida | Correctos |
| Percentiles (función normal) | Error < 0.00001 percentiles |
| Curvas de las gráficas (26 combinaciones) | Completas y ordenadas |
| Síndrome de Down: 5382 percentiles impresos contra los L, M, S extraídos | Diferencia máxima 0.21 Z, explicada porque los percentiles están impresos con 1 decimal y L, M, S con 3 |
| Síndrome de Down: 5328 percentiles impresos evaluados con la app completa (edad, interpolación, elección de tabla) | Diferencia máxima 0.21 Z |
| Síndrome de Down: elección de tabla a los 24–36 meses, edema, comparación con la referencia general, 32 gráficas | Correctas |

## Pendiente antes de uso clínico

- Revisión por el médico de los textos de interpretación y de los criterios de alerta (caída de Z ≥ 1 o paso por debajo de −2 DE).
- Definir si se usarán curvas para prematuros (Fenton o INTERGROWTH-21st) antes de las 40 semanas de edad corregida.
- Definir si se usarán referencias CDC en algún caso.
- Síndrome de Down: confirmar el uso de la referencia general OMS para el IMC (el CDC remite a sus propias curvas generales) y revisar los textos de interpretación por percentil.
