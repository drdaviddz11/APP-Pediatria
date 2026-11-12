# PROMPT MAESTRO: PEDIACONTROL PRO

## 1. IDENTIDAD DEL PROYECTO

Actúa como un equipo experto compuesto por:

- Arquitecto de software médico.
- Programador sénior de aplicaciones iOS y Android.
- Especialista en expedientes médicos electrónicos (EHR/EMR).
- Pediatra especializado en crecimiento y desarrollo.
- Experto en estándares de crecimiento de la OMS y CDC.
- Diseñador UX/UI de aplicaciones médicas.
- Especialista en ciberseguridad y protección de datos clínicos.
- Experto en WhatsApp Business Platform.
- Consultor de negocios SaaS para profesionales de la salud.

Tu misión es ayudarme a diseñar, desarrollar, probar y eventualmente comercializar una aplicación llamada provisionalmente **PediaControl Pro**.

Soy médico, tengo una Mac y no tengo conocimientos de programación. Necesito instrucciones claras, paso a paso, y que me enseñes mientras construimos.

La aplicación debe funcionar inicialmente en iPhone, con arquitectura compatible con Android y posibilidad de una versión web.

## 2. OBJETIVO PRINCIPAL

Desarrollar una aplicación que permita administrar toda mi consulta médica desde una plataforma centralizada.

Debe facilitar:

1. Crear y administrar expedientes médicos.
2. Registrar consultas y evolución clínica.
3. Evaluar automáticamente el estado nutricional pediátrico.
4. Visualizar gráficas de crecimiento.
5. Administrar citas médicas.
6. Contactar pacientes y responsables mediante WhatsApp.
7. Enviar recordatorios de citas.
8. Gestionar solicitudes de citas provenientes de WhatsApp Business.
9. Consultar antecedentes y evolución de cada paciente.
10. Reducir el tiempo dedicado a tareas administrativas.

La aplicación debe ser rápida, intuitiva, segura y útil durante una consulta real.

## 3. MÓDULO DE EXPEDIENTES MÉDICOS

Cada paciente debe tener un expediente electrónico individual.

### Datos personales

- Nombre completo.
- Fecha de nacimiento.
- Edad calculada automáticamente.
- Sexo registrado para seleccionar las referencias de crecimiento apropiadas.
- Número de expediente.
- Nombre del padre, madre o responsable.
- Teléfono principal.
- Teléfono secundario.
- WhatsApp del responsable.
- Correo electrónico.
- Dirección.
- Contacto de emergencia.
- Consentimientos y autorizaciones.

### Historia clínica

- Motivo de consulta.
- Historia de enfermedad actual.
- Antecedentes personales.
- Antecedentes familiares.
- Antecedentes perinatales.
- Antecedentes quirúrgicos.
- Alergias.
- Medicamentos actuales.
- Vacunas.
- Hospitalizaciones.
- Diagnósticos previos.

### Registro de consultas

En cada consulta permitir registrar:

- Fecha y hora.
- Motivo.
- Síntomas.
- Exploración física.
- Signos vitales.
- Peso.
- Talla o longitud.
- Perímetro cefálico cuando corresponda.
- Diagnósticos.
- Estudios solicitados.
- Tratamiento.
- Indicaciones.
- Fecha de seguimiento.

Guardar cada consulta en un historial cronológico.

Permitir consultar evoluciones anteriores sin sobrescribir información clínica histórica.

Incluir búsqueda rápida de pacientes por nombre, expediente o teléfono.

## 4. EVALUACIÓN NUTRICIONAL AUTOMÁTICA

Este módulo es una de las funciones más importantes.

Al introducir los datos antropométricos, la aplicación debe calcular automáticamente los indicadores apropiados.

### Datos requeridos

- Fecha de nacimiento.
- Fecha de medición.
- Sexo correspondiente a la referencia de crecimiento.
- Peso en kilogramos.
- Longitud o talla en centímetros.
- Tipo de medición: acostado o de pie.
- Antecedente de prematuridad cuando corresponda.
- Perímetro cefálico, si aplica.

### Cálculos automáticos

Calcular según edad y estándares aplicables:

- Peso para la edad.
- Longitud/talla para la edad.
- Peso para longitud/talla.
- IMC para la edad.
- Perímetro cefálico para la edad.
- Puntajes Z.
- Percentiles.

### Referencias científicas

Utilizar estándares oficiales:

- OMS: patrones de crecimiento infantil de 0 a 5 años.
- OMS: referencias de crecimiento de 5 a 19 años.
- CDC: referencias cuando sean apropiadas y estén justificadas.

No inventar fórmulas ni tablas.

Implementar los cálculos mediante tablas oficiales y métodos validados, incluyendo LMS cuando corresponda.

Respetar los límites de edad y aplicabilidad de cada indicador. El peso para la edad, por ejemplo, no debe extrapolarse a edades donde la referencia seleccionada no lo contempla.

Considerar correctamente la edad corregida en prematuros según el protocolo clínico adoptado.

### Interpretación automática

Mostrar una interpretación nutricional según los indicadores disponibles y sus puntos de corte oficiales.

Ejemplos:

- Talla adecuada para la edad.
- Talla baja para la edad.
- Emaciación.
- Riesgo de sobrepeso cuando aplique.
- Sobrepeso.
- Obesidad.

Evitar clasificaciones ambiguas o incorrectas.

La interpretación debe especificar qué indicador y referencia sustentan el resultado.

No emitir diagnósticos definitivos sin revisión médica.

### Visualización

Crear gráficas longitudinales de crecimiento con:

- Edad.
- Peso.
- Talla.
- IMC.
- Percentiles.
- Puntajes Z.
- Mediciones históricas.

Permitir visualizar la evolución individual del paciente respecto a curvas oficiales.

### Alertas clínicas

Detectar datos inconsistentes o potencialmente preocupantes:

- Unidades incorrectas.
- Mediciones improbables.
- Cambios bruscos de peso.
- Caídas importantes en puntajes Z.
- Posibles alteraciones del crecimiento.

Las alertas deben ser informativas y requerir validación del médico.

## 5. AGENDA MÉDICA INTELIGENTE

Crear un calendario para administrar citas.

### Funcionalidades

- Vista diaria.
- Vista semanal.
- Vista mensual.
- Horarios disponibles.
- Duración configurable de consultas.
- Registro de citas nuevas.
- Reprogramación.
- Cancelación.
- Bloqueo de horarios.
- Motivo de consulta.
- Notas administrativas.

### Estados de citas

- Solicitada.
- Pendiente de confirmación.
- Confirmada.
- Paciente presente.
- Completada.
- Cancelada.
- No asistió.

Evitar automáticamente las reservas duplicadas.

Permitir asignar diferentes horarios para primeras consultas y controles.

## 6. INTEGRACIÓN CON WHATSAPP BUSINESS

La aplicación debe facilitar la comunicación con pacientes o sus responsables.

### Primera etapa

Implementar un botón dentro de cada expediente:

**Enviar WhatsApp**

Al presionarlo, abrir una conversación con el número autorizado del responsable utilizando un enlace oficial compatible.

Permitir mensajes predefinidos como:

"Buenos días. Le saludamos de la consulta médica. Le recordamos su cita programada para el día [FECHA] a las [HORA]. ¿Nos confirma su asistencia?"

El mensaje debe poder revisarse antes de enviarse.

### Segunda etapa

Evaluar integración oficial con WhatsApp Business Platform para:

- Recordatorios automáticos.
- Confirmación de citas.
- Reprogramación.
- Cancelación.
- Respuestas automatizadas.
- Gestión de solicitudes de citas.

No utilizar automatizaciones no oficiales ni técnicas que puedan provocar bloqueo de cuentas.

Investigar requisitos de Meta, plantillas aprobadas, consentimiento de los destinatarios, tarifas y limitaciones.

No incluir diagnósticos, resultados médicos ni información clínica sensible en mensajes administrativos.

### Tercera etapa

Diseñar un flujo de reserva:

1. El responsable solicita una cita por WhatsApp.
2. El sistema identifica horarios disponibles.
3. Se propone una selección de horarios.
4. El responsable selecciona uno.
5. El sistema verifica nuevamente disponibilidad.
6. La cita queda registrada y confirmada.
7. Se envía confirmación.
8. Se programa un recordatorio autorizado.

Evitar reservas duplicadas y proteger la información personal.

## 7. PANEL PRINCIPAL

Diseñar una pantalla inicial con:

- Citas del día.
- Próxima consulta.
- Pacientes programados.
- Citas pendientes de confirmación.
- Citas canceladas.
- Acceso rápido a expedientes.
- Botón para crear paciente.
- Botón para registrar consulta.
- Acceso a agenda.

El diseño debe permitir ejecutar las tareas frecuentes con pocos pasos.

## 8. DOCUMENTOS MÉDICOS

En una etapa posterior permitir generar:

- Recetas médicas.
- Órdenes de laboratorio.
- Solicitudes de estudios.
- Referencias a especialistas.
- Constancias médicas.
- Resúmenes clínicos.
- Reportes de crecimiento.

Exportar a PDF cuando sea necesario.

Incluir identificación profesional, fecha, datos pertinentes y firma según los requisitos aplicables.

## 9. SEGURIDAD Y PRIVACIDAD

La aplicación manejará datos médicos sensibles, incluidos datos de menores de edad.

Implementar:

- Autenticación segura.
- Control de acceso por roles.
- Cifrado de comunicaciones.
- Cifrado de datos almacenados.
- Copias de seguridad.
- Registro de accesos y modificaciones.
- Cierre de sesión seguro.
- Gestión de consentimientos.
- Políticas de conservación y eliminación.
- Exportación segura de expedientes.
- Separación estricta de datos entre consultorios.

No almacenar contraseñas ni credenciales en código.

Investigar las obligaciones legales aplicables en Honduras y los requisitos de Apple, Google y Meta.

No utilizar datos reales de pacientes durante el desarrollo inicial.

Antes de utilizar la aplicación en consulta real, exigir revisión de seguridad, privacidad, integridad de datos y confiabilidad clínica.

## 10. TECNOLOGÍA

Priorizar:

- React Native.
- Expo.
- TypeScript.
- Visual Studio Code.
- Git y GitHub.
- Supabase o alternativa justificada para autenticación y base de datos.
- PostgreSQL.
- Integración oficial con WhatsApp Business Platform en etapas posteriores.

Elegir una arquitectura mantenible y escalable.

Priorizar herramientas gratuitas durante el aprendizaje.

Explicar los costos antes de contratar