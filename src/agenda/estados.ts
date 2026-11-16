// Cambios de estado permitidos para una cita.

import { fechaDeMomento } from './tiempo';
import type { Cita, EstadoCita } from './tipos';

export interface AccionCita {
  estado: EstadoCita;
  texto: string;
  variante: 'primario' | 'secundario' | 'peligro';
  /** Si existe, se pide confirmación con este texto. */
  confirmar?: string;
  /** Solo se ofrece el día de la cita o después. */
  soloDesdeElDia?: boolean;
  /** Solo se ofrece si la cita todavía no pasó. */
  soloFutura?: boolean;
}

const CANCELAR: AccionCita = {
  estado: 'cancelada',
  texto: 'Cancelar cita',
  variante: 'peligro',
  confirmar: 'La cita quedará cancelada y el horario se liberará.',
};
const NO_ASISTIO: AccionCita = {
  estado: 'no_asistio',
  texto: 'No asistió',
  variante: 'peligro',
  confirmar: 'Se registrará que el paciente no asistió y el horario se liberará.',
  soloDesdeElDia: true,
};

export const ACCIONES: Record<EstadoCita, AccionCita[]> = {
  solicitada: [
    { estado: 'confirmada', texto: 'Confirmar cita', variante: 'primario' },
    { estado: 'pendiente', texto: 'Marcar pendiente de confirmación', variante: 'secundario' },
    CANCELAR,
  ],
  pendiente: [{ estado: 'confirmada', texto: 'Confirmar cita', variante: 'primario' }, NO_ASISTIO, CANCELAR],
  confirmada: [
    { estado: 'presente', texto: 'Paciente presente', variante: 'primario', soloDesdeElDia: true },
    NO_ASISTIO,
    CANCELAR,
  ],
  presente: [{ estado: 'completada', texto: 'Marcar como completada (sin registrar consulta)', variante: 'secundario' }],
  completada: [],
  cancelada: [
    {
      estado: 'pendiente',
      texto: 'Reactivar cita',
      variante: 'secundario',
      confirmar: 'La cita volverá a quedar pendiente de confirmación en el mismo horario.',
      soloFutura: true,
    },
  ],
  no_asistio: [],
};

/** Acciones que se pueden ofrecer ahora para la cita. */
export function accionesDisponibles(cita: Pick<Cita, 'estado' | 'inicio'>, ahora: string): AccionCita[] {
  const hoy = fechaDeMomento(ahora);
  return ACCIONES[cita.estado].filter((a) => {
    if (a.soloDesdeElDia && fechaDeMomento(cita.inicio) > hoy) return false;
    if (a.soloFutura && cita.inicio <= ahora) return false;
    return true;
  });
}

/** Se puede mover de horario o editar. */
export function sePuedeReprogramar(estado: EstadoCita): boolean {
  return estado === 'solicitada' || estado === 'pendiente' || estado === 'confirmada';
}

/** Se puede registrar la consulta desde la cita. */
export function sePuedeRegistrarConsulta(estado: EstadoCita): boolean {
  return estado === 'confirmada' || estado === 'presente' || estado === 'pendiente';
}

export const COLOR_ESTADO: Record<EstadoCita, { fondo: string; texto: string }> = {
  solicitada: { fondo: '#EDE7F6', texto: '#5E35B1' },
  pendiente: { fondo: '#FFF4E0', texto: '#8A5300' },
  confirmada: { fondo: '#E2F3F4', texto: '#0A5D65' },
  presente: { fondo: '#E3F2FD', texto: '#1565C0' },
  completada: { fondo: '#E6F4EA', texto: '#1E7B34' },
  cancelada: { fondo: '#ECEFF1', texto: '#5A6B78' },
  no_asistio: { fondo: '#FBE9E7', texto: '#B3261E' },
};
