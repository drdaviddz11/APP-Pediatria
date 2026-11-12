# Hoja de ruta de PediaControl Pro

Basada en [PROMPT_MAESTRO.md](PROMPT_MAESTRO.md). Cada fase termina con algo que se puede probar en el teléfono.

## Fase 1 — Expedientes (actual)

- [x] Proyecto Expo (SDK 58) + TypeScript compatible con Expo Go del App Store.
- [x] Base de datos local con migraciones.
- [x] Pacientes: alta, edición, búsqueda rápida, edad y edad corregida.
- [x] Historia clínica con bitácora de versiones anteriores.
- [x] Consultas inalterables con notas aclaratorias.
- [x] Alertas de datos improbables y de unidades.
- [x] Pacientes de demostración ficticios.
- [ ] Prueba en iPhone por el médico y ajustes de uso real.

## Fase 2 — Evaluación nutricional

- [ ] Cargar las tablas LMS oficiales de la OMS (0–5 años: peso/edad, longitud-talla/edad, peso/longitud, peso/talla, IMC/edad, perímetro cefálico/edad; 5–19 años: talla/edad, IMC/edad, peso/edad hasta 10 años), obtenidas de los archivos publicados por la OMS, sin transcribir a mano.
- [ ] Cálculo de puntaje Z y percentil con el método LMS, incluido el ajuste OMS para |Z| > 3 en los indicadores de peso.
- [ ] Respetar los límites de edad de cada indicador y la diferencia acostado/de pie (0.7 cm).
- [ ] Edad corregida en prematuros según el protocolo que el médico adopte.
- [ ] Interpretación con puntos de corte OMS, indicando el indicador y la referencia usada; siempre como apoyo, sujeta a revisión médica.
- [ ] Pruebas automáticas contra los valores de ejemplo publicados por la OMS (WHO Anthro).
- [ ] Gráficas longitudinales con las curvas oficiales.
- [ ] Alertas de caídas importantes de puntaje Z.
- [ ] Decidir si se usarán referencias CDC y en qué casos.

## Fase 3 — Panel principal y agenda

- [ ] Panel: citas del día, próxima consulta, pendientes de confirmar, canceladas, accesos rápidos.
- [ ] Agenda diaria, semanal y mensual; duración configurable; primeras consultas y controles.
- [ ] Estados de cita y prevención de reservas duplicadas.
- [ ] Bloqueo de horarios.

## Fase 4 — WhatsApp (primera etapa)

- [ ] Botón "Enviar WhatsApp" que abre la conversación con el número autorizado mediante el enlace oficial `wa.me`.
- [ ] Plantillas de mensajes administrativos editables antes de enviar, sin información clínica.
- [ ] Solo disponible si el responsable dio su consentimiento.

## Fase 5 — Servidor, cuentas y seguridad

- [ ] Elegir y configurar Supabase (PostgreSQL) u otra alternativa, con costos explicados antes de contratar.
- [ ] Inicio de sesión seguro, roles (médico, asistente) y separación estricta por consultorio (Row Level Security).
- [ ] Cifrado en tránsito y en reposo, respaldos, bitácora de accesos.
- [ ] Cierre de sesión automático y bloqueo con Face ID.
- [ ] Exportación segura del expediente.
- [ ] Políticas de conservación y eliminación.
- [ ] Revisión de obligaciones legales en Honduras y requisitos de Apple, Google y Meta.
- [ ] **Revisión de seguridad, privacidad y confiabilidad clínica antes de usar datos reales.**

## Fase 6 — Documentos médicos

- [ ] Recetas, órdenes de laboratorio, referencias, constancias, resúmenes y reportes de crecimiento en PDF.

## Fase 7 — WhatsApp Business Platform

- [ ] Investigar requisitos de Meta, plantillas aprobadas, consentimiento, tarifas y límites.
- [ ] Recordatorios y confirmaciones automáticas.
- [ ] Flujo de solicitud de citas con verificación de disponibilidad.

## Fase 8 — Publicación

- [ ] Cuenta de Apple Developer, compilación propia (EAS Build) y TestFlight.
- [ ] Versión Android y versión web.
- [ ] Modelo de negocio SaaS para otros profesionales.
