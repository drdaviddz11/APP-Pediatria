# Hoja de ruta de PediaControl Pro

Basada en [PROMPT_MAESTRO.md](PROMPT_MAESTRO.md). Cada fase termina con algo que se puede probar en el teléfono.

## Fase 1 — Expedientes

- [x] Proyecto Expo (SDK 58) + TypeScript compatible con Expo Go del App Store.
- [x] Base de datos local con migraciones.
- [x] Pacientes: alta, edición, búsqueda rápida, edad y edad corregida.
- [x] Historia clínica con bitácora de versiones anteriores.
- [x] Consultas inalterables con notas aclaratorias.
- [x] Alertas de datos improbables y de unidades.
- [x] Pacientes de demostración ficticios.
- [x] Prueba en iPhone por el médico.

## Fase 2 — Evaluación nutricional

- [x] Tablas LMS oficiales de la OMS 2006 (0–5 años) y 2007 (5–19 años), tomadas de los repositorios oficiales de la OMS.
- [x] Puntaje Z y percentil con el método LMS, ajuste |Z| > 3, ajuste de 0.7 cm, límites de edad y talla de cada indicador.
- [x] Edad corregida en prematuros (< 37 semanas) hasta los 24 meses.
- [x] Interpretación con puntos de corte OMS, indicando indicador y referencia; con aviso de que requiere valoración médica.
- [x] Edema bilateral: excluye los indicadores basados en peso, como la OMS.
- [x] Validación contra los resultados del software de la OMS (ver [VALIDACION.md](VALIDACION.md)).
- [x] Gráficas con curvas OMS en puntajes Z o percentiles y mediciones del paciente.
- [x] Alertas de caída de puntaje Z y de paso por debajo de −2 DE.
- [x] Curvas CDC para síndrome de Down (Zemel 2015): evaluación, interpretación por percentil y gráficas.
- [x] Revisión médica de interpretaciones y alertas (21 nov 2026: puntos de corte OMS 2006/2007, caída de Z de 1 punto, límites de plausibilidad y síndrome de Down aprobados).
- [x] Decisión: solo OMS (sin CDC 2000); edad corregida hasta 24 meses en todos.
- [x] Curvas INTERGROWTH-21st para prematuros antes de las 40 semanas corregidas (decidido el 21 nov 2026): peso, longitud y perímetro cefálico por edad posmenstrual, con gráfica de 27 a 40 semanas.

## Fase 3 — Panel principal y agenda

- [x] Panel de inicio: citas de hoy, próxima cita, sala de espera, pendientes de confirmación, canceladas, resumen del día, búsqueda rápida de expedientes y accesos directos.
- [x] Agenda con vista diaria, semanal y mensual.
- [x] Horario de atención por día (mañana y tarde), duración de primera consulta y de control, intervalo entre horarios; configurables.
- [x] Nueva cita con horarios libres, hora manual, reprogramación y edición.
- [x] Estados: solicitada, pendiente de confirmación, confirmada, paciente presente, completada, cancelada, no asistió.
- [x] Prevención automática de citas duplicadas (en la app y con candados en la base de datos).
- [x] Bloqueo de horarios (por horas o días completos).
- [x] Citas de personas sin expediente y creación del expediente desde la cita.
- [x] Registrar la consulta desde la cita (la cita queda completada y enlazada).
- [x] Próximas citas en el expediente y "Agendar cita de seguimiento" desde la consulta.
- [ ] Prueba en iPhone por el médico y ajuste del horario real del consultorio.

## Fase 4 — WhatsApp (primera etapa) y controles (actual)

- [x] Botón "Enviar WhatsApp" en el expediente y en cada cita, con el enlace oficial `wa.me`.
- [x] Mensajes predefinidos (recordatorio, propuesta de control, general), editables antes de enviar y desde los ajustes; sin información clínica.
- [x] Solo a responsables que autorizaron mensajes por WhatsApp.
- [x] Lista diaria de controles por agendar: seguimiento indicado en la última consulta, control de niño sano según la edad (calendario AAP Bright Futures, editable) y pacientes sin consulta hace tiempo.
- [x] Apartar automáticamente la cita de control como "por confirmar" en el primer horario libre y preparar el mensaje.
- [x] Envío uno tras otro: la app abre cada chat con el mensaje listo; registro de mensajes abiertos.
- [x] Recordatorios de citas por día (mañana por defecto).
- [x] Atajos de fecha de seguimiento en la consulta (1 y 2 semanas, 1, 2, 3 y 6 meses).
- [x] Revisión médica del calendario de niño sano y de los textos de los mensajes (21 nov 2026: calendario AAP y reglas como están; hora de 12 horas; dirección del consultorio en recordatorios y propuestas).

## Versión de computadora (adelantada a petición del médico)

- [x] La misma app funciona en el navegador de la computadora (Chrome o Edge) con su propia base de datos local.
- [x] Pantallas centradas con ancho máximo para monitor; gráficas ajustadas.
- [x] Ventanas de confirmación propias en la computadora (las del sistema no existen en el navegador).
- [x] Respaldo: descarga del archivo y carga desde la computadora; compatible con los respaldos del teléfono.
- [x] WhatsApp Web en una sola pestaña.
- [x] Sincronización automática entre teléfono y computadora (ver fase 5).
- [ ] Publicarla como página web con https o como app instalable (después de la revisión de seguridad).

## Recetas (agregado a petición del médico)

- [x] Formato propio (Recetario_HMC.docx): fondo idéntico, nombre, fecha e indicaciones en su lugar; media carta.
- [x] Peso del paciente en la receta (de la consulta o el último registrado; se guarda el de ese momento).
- [x] Medicamentos favoritos (los más usados primero), búsqueda sin acentos.
- [x] Guardadas en el expediente y en la consulta; no se modifican; reimprimir o copiar para hacer otra.
- [x] Varias hojas automáticas si no caben (ninguna indicación queda cortada).
- [ ] Enviar la receta en PDF por WhatsApp (si se necesita).
- [ ] Cálculo de dosis por peso (requiere revisión clínica de cada fórmula).

## Constancias (agregado a petición del médico)

- [x] Hoja carta según su PDF: receta arriba (texto de la constancia, firma y sello) y diagnósticos abajo (firma y sello).
- [x] Tipos: atención médica, reposo/incapacidad, buena salud, texto libre; el texto se puede corregir antes de guardar.
- [x] Guardadas en el expediente sin modificarse, con folio; imprimir o crear PDF; "hacer otra igual".
- [x] Firma y sello como imagen subida por el médico (fuera del código público; viaja cifrada en sincronización y respaldos).
- [x] Revisión del médico de la redacción de los textos (21 nov 2026: "en mi consulta" sin especialidad, "reposo en casa", al menos un diagnóstico).

## Cumpleaños (agregado a petición del médico)

- [x] Aviso en el panel y pantalla de cumpleaños (hoy y próximos 7 días), de 1 a 18 años.
- [x] Felicitación por WhatsApp uno tras otro, solo con autorización; plantilla editable con [EDAD]; anotada para no repetirla (migración 11, sincronización y respaldos).
- [ ] Envío automático (requiere WhatsApp Business Platform, fase 7).

## Caja y cierre diario (agregado a petición del médico)

- [x] Cobro en cada consulta con precio sugerido (primera vez / control) y otros ingresos.
- [x] Formas de pago: efectivo, tarjeta, transferencia. Montos en centavos (sumas exactas).
- [x] Anulación con motivo (los cobros no se borran) y bitácora.
- [x] Cierre diario que bloquea cambios; reapertura registrada; aviso de días sin cerrar.
- [x] Resumen mensual y exportación CSV para la contabilidad; todo se sincroniza cifrado.
- [ ] Gastos del día (opcional, si se necesita más adelante).
- [ ] Recibos o facturas (requisitos fiscales del SAR de Honduras: revisar antes).

## Fase 5 — Servidor, cuentas y seguridad

- [x] Sincronizar los datos entre teléfono y computadora: Supabase plan gratuito, cifrado de extremo a extremo, funciona sin internet, último cambio gana, avisos de expediente repetido y citas encimadas, limpieza diaria de versiones viejas.
- [x] Elegir Supabase (PostgreSQL), plan gratuito ($0); costos del plan Pro (desde US$25/mes) explicados en docs/SINCRONIZACION.md.
- [x] Inicio de sesión (la contraseña nunca llega al servidor) y separación estricta por cuenta (Row Level Security).
- [ ] Roles (médico, asistente) y consultorios con varias personas.
- [x] Respaldo manual cifrado con contraseña (PBKDF2-SHA256 310 000 iteraciones + AES-256-GCM), guardado en iCloud Drive, Google Drive o la computadora, y restauración completa con verificación. Adelantado a petición del médico.
- [ ] Respaldo automático en el servidor.
- [ ] Cifrado en tránsito y en reposo, bitácora de accesos.
- [x] Clave de acceso por equipo y bloqueo automático por inactividad (21 nov 2026).
- [ ] Face ID en la app propia del teléfono (código listo; Expo Go no lo permite).
- [ ] Exportación segura del expediente.
- [ ] Políticas de conservación y eliminación.
- [ ] Revisión de obligaciones legales en Honduras y requisitos de Apple, Google y Meta.
- [ ] **Revisión de seguridad, privacidad y confiabilidad clínica antes de usar datos reales.**

## Fase 6 — Documentos médicos

- [ ] Recetas, órdenes de laboratorio, referencias, constancias, resúmenes y reportes de crecimiento en PDF.

## Fase 7 — WhatsApp Business Platform

- [ ] Investigar requisitos de Meta, plantillas aprobadas, consentimiento, tarifas y límites.
- [ ] Recordatorios y confirmaciones automáticas (sin tocar Enviar en cada chat).
- [ ] Flujo de solicitud de citas con verificación de disponibilidad.

## Fase 8 — Publicación y venta

Decisiones del médico (18 nov 2026): versión Gratis y Pro (Pro = recetas y WhatsApp), cobro por suscripción mensual/anual;
la cuenta de Google se conecta solo para respaldos (la app abre sin cuenta, así no se exige "Entrar con Apple").

- [x] División Gratis / Pro en la app (edición del desarrollador siempre Pro; interruptor para probar la versión gratis).
- [x] Proyecto de Google Cloud "PediaControl Pro" (gratuito, sin facturación): API de Google Drive habilitada, pantalla de consentimiento (Externo, en pruebas) y cliente OAuth web.
- [x] Respaldo en el Google Drive del usuario desde la computadora (permiso drive.file; cifrado antes de subir; últimos 30; restaurar desde Drive).
- [ ] Respaldo automático en el teléfono (app propia, cliente OAuth de iOS) y verificación de la app por Google antes de abrirla al público.
- [ ] Empresa o entidad legal para publicar (Apple pide que las apps de salud las publique una entidad, no una persona) y número D-U-N-S.
- [ ] Cuenta de Apple Developer ($99 al año), compilación propia (EAS Build) y TestFlight; inscripción en el programa de pequeños desarrolladores (comisión 15 %).
- [ ] Suscripción dentro de la app (App Store / Google Play, $25 una vez) y verificación de la compra.
- [ ] Aviso de privacidad, términos de uso y revisión de seguridad y legal antes de vender.
- [ ] Versión Android.
