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

## Fase 2 — Evaluación nutricional (actual)

- [x] Tablas LMS oficiales de la OMS 2006 (0–5 años) y 2007 (5–19 años), tomadas de los repositorios oficiales de la OMS.
- [x] Puntaje Z y percentil con el método LMS, ajuste |Z| > 3, ajuste de 0.7 cm, límites de edad y talla de cada indicador.
- [x] Edad corregida en prematuros (< 37 semanas) hasta los 24 meses.
- [x] Interpretación con puntos de corte OMS, indicando indicador y referencia; con aviso de que requiere valoración médica.
- [x] Edema bilateral: excluye los indicadores basados en peso, como la OMS.
- [x] Validación contra los resultados del software de la OMS (ver [VALIDACION.md](VALIDACION.md)).
- [x] Gráficas con curvas OMS en puntajes Z o percentiles y mediciones del paciente.
- [x] Alertas de caída de puntaje Z y de paso por debajo de −2 DE.
- [x] Curvas CDC para síndrome de Down (Zemel 2015): evaluación, interpretación por percentil y gráficas.
- [ ] Revisión médica de interpretaciones y alertas.
- [ ] Decidir curvas para prematuros antes de 40 semanas corregidas y uso de referencias CDC.

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
