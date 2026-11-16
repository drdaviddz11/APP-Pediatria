// Tipos de la agenda médica.
// Las horas se guardan como hora local del consultorio:
//   - fecha: "AAAA-MM-DD"
//   - hora: "HH:mm"
//   - momento: "AAAA-MM-DDTHH:mm" (se puede comparar como texto)

export type EstadoCita =
  | 'solicitada'
  | 'pendiente'
  | 'confirmada'
  | 'presente'
  | 'completada'
  | 'cancelada'
  | 'no_asistio';

export type TipoCita = 'primera' | 'control';

export const NOMBRE_ESTADO: Record<EstadoCita, string> = {
  solicitada: 'Solicitada',
  pendiente: 'Pendiente de confirmación',
  confirmada: 'Confirmada',
  presente: 'Paciente presente',
  completada: 'Completada',
  cancelada: 'Cancelada',
  no_asistio: 'No asistió',
};

export const NOMBRE_TIPO: Record<TipoCita, string> = {
  primera: 'Primera consulta',
  control: 'Control',
};

/** Estados que ya no ocupan el horario. */
export const ESTADOS_INACTIVOS: readonly EstadoCita[] = ['cancelada', 'no_asistio'];

export function esActiva(estado: EstadoCita): boolean {
  return !ESTADOS_INACTIVOS.includes(estado);
}

export interface Cita {
  id: string;
  pacienteId: string | null;
  /** Para personas sin expediente (por ejemplo, una solicitud nueva). */
  nombreContacto: string;
  telefonoContacto: string;
  inicio: string; // momento
  fin: string; // momento
  tipo: TipoCita;
  estado: EstadoCita;
  motivo: string;
  notas: string; // notas administrativas
  consultaId: string | null;
  creadoEn: string;
  actualizadoEn: string;
  // Datos del paciente (si tiene expediente)
  pacienteNombre: string | null;
  numeroExpediente: string | null;
  pacienteWhatsapp: string | null;
  pacienteTelefono: string | null;
  /** El responsable autorizó mensajes administrativos por WhatsApp (null si no tiene expediente). */
  pacienteConsentimientoWhatsapp: boolean | null;
}

export interface Bloqueo {
  id: string;
  inicio: string; // momento
  fin: string; // momento
  motivo: string;
  creadoEn: string;
}

export interface RangoHorario {
  inicio: string; // HH:mm
  fin: string; // HH:mm
}

export interface ConfiguracionAgenda {
  /** Rangos de atención por día de la semana (0 = domingo … 6 = sábado). */
  horario: Record<number, RangoHorario[]>;
  duracionPrimera: number; // minutos
  duracionControl: number; // minutos
  /** Cada cuántos minutos se ofrecen horarios de inicio. */
  intervalo: number;
}

export const CONFIG_PREDETERMINADA: ConfiguracionAgenda = {
  horario: {
    0: [],
    1: [
      { inicio: '08:00', fin: '12:00' },
      { inicio: '14:00', fin: '18:00' },
    ],
    2: [
      { inicio: '08:00', fin: '12:00' },
      { inicio: '14:00', fin: '18:00' },
    ],
    3: [
      { inicio: '08:00', fin: '12:00' },
      { inicio: '14:00', fin: '18:00' },
    ],
    4: [
      { inicio: '08:00', fin: '12:00' },
      { inicio: '14:00', fin: '18:00' },
    ],
    5: [
      { inicio: '08:00', fin: '12:00' },
      { inicio: '14:00', fin: '18:00' },
    ],
    6: [{ inicio: '08:00', fin: '12:00' }],
  },
  duracionPrimera: 30,
  duracionControl: 20,
  intervalo: 10,
};

export function duracionDeTipo(config: ConfiguracionAgenda, tipo: TipoCita): number {
  return tipo === 'primera' ? config.duracionPrimera : config.duracionControl;
}

/** Nombre para mostrar de la persona citada. */
export function nombreCita(c: Pick<Cita, 'pacienteNombre' | 'nombreContacto'>): string {
  return c.pacienteNombre || c.nombreContacto || 'Sin nombre';
}
