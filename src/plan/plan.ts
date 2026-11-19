// Versión Gratis y versión Pro.
// Pro incluye las recetas y constancias con formato propio y los mensajes de WhatsApp; todo lo demás es gratis.
// Nunca se bloquea el acceso a datos ya guardados: una receta hecha se puede ver aunque ya no se tenga Pro.

export type FuncionPro = 'receta' | 'constancia' | 'whatsapp';

/**
 * De dónde viene el plan:
 * - desarrollador: la edición del Dr. Díaz (pruebas en su teléfono y su página web); siempre Pro.
 * - suscripcion: compra dentro de la App Store / Google Play (se conecta al publicar la app).
 * - gratis: sin suscripción.
 */
export type OrigenPlan = 'desarrollador' | 'suscripcion' | 'gratis';

export const FUNCIONES_PRO: Record<FuncionPro, { titulo: string; descripcion: string }> = {
  receta: {
    titulo: 'Recetas con su formato',
    descripcion: 'Recetas impresas con el membrete del consultorio, peso del paciente, medicamentos favoritos y reimpresión.',
  },
  constancia: {
    titulo: 'Constancias médicas',
    descripcion: 'Constancias de atención, reposo y buena salud con su membrete, diagnósticos, firma y sello, listas para imprimir o enviar en PDF.',
  },
  whatsapp: {
    titulo: 'Mensajes de WhatsApp',
    descripcion: 'Recordatorios de citas y avisos de control listos para enviar, uno tras otro, con el WhatsApp del consultorio.',
  },
};

/** Lo que trae la versión gratis (para mostrarlo en la pantalla de planes). */
export const INCLUIDO_GRATIS = [
  'Expedientes, historia clínica y consultas',
  'Gráficas de crecimiento OMS',
  'Agenda y lista de controles',
  'Caja y cierre diario',
  'Respaldos cifrados',
];

/** Edición de la app según cómo se compiló. EXPO_PUBLIC_EDICION=desarrollador en la página del Dr. Díaz. */
export function origenInicial(edicion: string | undefined, enDesarrollo: boolean): OrigenPlan {
  if (enDesarrollo || (edicion ?? '').trim().toLowerCase() === 'desarrollador') return 'desarrollador';
  return 'gratis';
}

/** ¿Están disponibles las funciones Pro? "verComoGratis" sirve para probar cómo la ve quien no paga. */
export function tienePro(origen: OrigenPlan, verComoGratis: boolean): boolean {
  if (origen === 'gratis') return false;
  return !verComoGratis;
}

export function nombreOrigen(origen: OrigenPlan): string {
  if (origen === 'desarrollador') return 'Pro (edición del desarrollador)';
  if (origen === 'suscripcion') return 'Pro (suscripción)';
  return 'Gratis';
}
