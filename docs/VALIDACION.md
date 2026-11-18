# Validación de la evaluación nutricional y del respaldo

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

## Respaldo cifrado

| Prueba | Resultado |
|---|---|
| SHA-256 y HMAC-SHA256 propios contra Node.js (longitudes 0–300, llaves cortas, de 64 y largas) | Idénticos |
| PBKDF2-SHA256 propio contra Node.js (vector de RFC 7914 y casos aleatorios) | Idénticos |
| Codificación UTF-8 (acentos, ñ, emojis) y base64 | Ida y vuelta exacta |
| Crear respaldo y restaurarlo en una base vacía | Todas las tablas idénticas; las protecciones de la base siguen activas |
| Contenido del archivo | No contiene ningún dato legible |
| Contraseña incorrecta o archivo alterado | Se rechaza sin cambiar nada |
| Respaldo dañado (referencias rotas) | Se rechaza y los datos del teléfono quedan intactos |
| Respaldo de una versión más nueva de la app | Se rechaza con aviso |
| Respaldo de una versión anterior | Se restaura; las columnas nuevas toman su valor por defecto |

## Sincronización

Probada con dos, tres y cuatro equipos simulados (SQLite real) y un servidor Supabase simulado (inicio de sesión y API REST con seguridad por usuario); el SQL del servidor (`docs/supabase.sql`) se probó en PostgreSQL 16 real con los roles y la función `auth.uid()` de Supabase.

| Prueba | Resultado |
|---|---|
| Primer equipo envía todo; equipo vacío recibe todo | Bases idénticas en todas las tablas sincronizadas |
| Lo recibido no se vuelve a enviar; sincronizar de nuevo no cambia nada | Correcto |
| Edición en un equipo, consulta y nota nuevas en otro | Llegan al otro equipo |
| Mismo expediente editado en dos equipos | Gana el cambio más reciente en los dos |
| Sin conexión | Los cambios esperan y se envían al volver |
| Mismo número de expediente creado en dos equipos | Uno conserva el número, el otro recibe "-2" en ambos equipos; aviso |
| Misma hora agendada en dos equipos | Se conservan las dos citas y se avisa; en un mismo equipo el candado sigue activo |
| Ajustes, bloqueos creados y quitados, borrado de pacientes de demostración (con sus consultas) | Se reflejan en el otro equipo; la fecha de respaldo es de cada equipo |
| Consulta que llega antes que su expediente | Espera y se aplica en cuanto llega |
| Registro confirmado fuera de orden por el servidor | No se pierde |
| Sesión vencida | Se renueva sola |
| Registro alterado en el servidor | Se ignora con aviso |
| Lo que ve el servidor | Ningún nombre, dirección, número de expediente ni nombre de tabla |
| Otra cuenta | No ve ni puede borrar, modificar ni suplantar registros ajenos (PostgreSQL real); sin sesión no hay acceso |
| Limpieza de versiones viejas | Queda la versión más reciente aunque una más vieja haya llegado después; un equipo nuevo recibe exactamente lo mismo |
| Combinar un equipo con datos propios | Todos los equipos quedan iguales |
| Actualización de una base existente (versión 5 → 6) | No se pierde nada; la sincronización empieza desactivada |
| 300 expedientes con consulta | Enviados y recibidos en menos de 1 segundo cada uno (en computadora) |

## Caja y cierre diario

| Prueba | Resultado |
|---|---|
| Lectura de montos ("1250", "1,250.50", "L 1250"; rechaza negativos, >2 decimales, texto) | Correcta |
| Sumas exactas en centavos (0.10 + 0.20 = 0.30) | Correctas |
| Precio sugerido: primera vez si el paciente no tiene consultas previas, control si sí | Correcto |
| Consultas del día sin cobro | Aparecen hasta que se cobran |
| Un cobro por consulta; validaciones de concepto, monto y forma de pago | Correctas |
| Anular con motivo; no se pueden borrar cobros | Correcto |
| Cerrar el día: totales por forma de pago, sin contar anulados | Correctos |
| Día cerrado: no acepta cobros nuevos ni anulaciones; reabrir y volver a cerrar | Correcto, con bitácora |
| No se puede cerrar un día futuro | Correcto |
| Resumen mensual y CSV (acentos, comas, comillas y protección contra fórmulas) | Correctos |
| Cobros y cierres entre dos equipos sincronizados (incluye reapertura) | Iguales en ambos |
| Actualización de una base existente a la versión 7 | Sin pérdida de datos |

## Recetas

| Prueba | Resultado |
|---|---|
| Hoja impresa a PDF en Chromium (media carta 612 × 396 pt) comparada con la plantilla de Word | Mismo diseño; nombre, fecha e indicaciones en su lugar |
| 300 recetas al azar (3 196 indicaciones, palabras muy largas, hasta 16 indicaciones) medidas en el navegador | Ninguna indicación cortada ni perdida; hojas extra cuando hace falta |
| Numeración continua entre hojas y "Hoja N de M" | Correcta |
| Texto con caracteres especiales (<, >, &, comillas) | Se imprime tal cual, sin romper la hoja |
| Validaciones (vacía, más de 40 indicaciones, indicación muy larga) | Correctas |
| Receta emitida no se modifica; queda en la bitácora | Correcto |
| Peso en la receta: se guarda el de ese momento, rechaza valores fuera de 0.3–250 kg, redondeo (3.255 → 3.26 kg), sin peso no se imprime | Correcto |
| Favoritos: sin duplicados, búsqueda sin acentos, los más usados primero, editar y quitar | Correcto |
| Recetas y favoritos entre dos equipos sincronizados | Iguales en ambos |
| Impresión desde la computadora (marco oculto + cuadro de impresión) | Correcta en Chromium |
| Impresión desde el iPhone (AirPrint) | Pendiente de probar en el teléfono |

## Versión Gratis y Pro

| Prueba | Resultado |
|---|---|
| Edición según compilación: sin variable → gratis; `EXPO_PUBLIC_EDICION=desarrollador` o modo de pruebas → Pro | Correcto |
| "Ver como versión gratis" quita Pro solo en la edición del desarrollador; la versión gratis no puede activarlo | Correcto |
| Recetas guardadas visibles en la versión gratis; hacer, imprimir, copiar y favoritos piden Pro | Revisado en el código |
| WhatsApp (expediente, cita, controles y recordatorios) pide Pro; la lista de controles sigue visible | Revisado en el código |

## Pendiente antes de uso clínico

- Revisión por el médico de los textos de interpretación y de los criterios de alerta (caída de Z ≥ 1 o paso por debajo de −2 DE).
- Definir si se usarán curvas para prematuros (Fenton o INTERGROWTH-21st) antes de las 40 semanas de edad corregida.
- Definir si se usarán referencias CDC en algún caso.
- Síndrome de Down: confirmar el uso de la referencia general OMS para el IMC (el CDC remite a sus propias curvas generales) y revisar los textos de interpretación por percentil.
