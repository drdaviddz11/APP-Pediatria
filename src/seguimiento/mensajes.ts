// Mensajes de WhatsApp: plantillas, números y enlaces oficiales (wa.me).
// Solo mensajes administrativos: nunca diagnósticos, resultados ni información clínica.

import { textoFechaLarga } from '../agenda/tiempo';

export type TipoMensaje = 'recordatorio' | 'propuesta' | 'general' | 'cumpleanos';

export interface ConfigMensajes {
  /** Cómo se presenta el consultorio, por ejemplo "la consulta del Dr. Díaz". */
  nombreConsultorio: string;
  /** Código de país que se agrega a los números de 8 dígitos. */
  codigoPais: string;
  /** Dirección del consultorio para [DIRECCION] (vacía: no se menciona). */
  direccion: string;
  plantillas: Record<TipoMensaje, string>;
}

export const MARCAS = ['[SALUDO]', '[CONSULTORIO]', '[NOMBRE]', '[FECHA]', '[HORA]', '[DIRECCION]', '[EDAD]'];

export const CONFIG_MENSAJES_PREDETERMINADA: ConfigMensajes = {
  nombreConsultorio: 'la consulta médica',
  codigoPais: '504',
  direccion: '',
  plantillas: {
    recordatorio:
      '[SALUDO]. Le saludamos de [CONSULTORIO]. Le recordamos la cita de [NOMBRE] programada para el [FECHA] a las [HORA]. [DIRECCION] ¿Nos confirma su asistencia?',
    propuesta:
      '[SALUDO]. Le saludamos de [CONSULTORIO]. A [NOMBRE] le corresponde su cita de control. Le reservamos el [FECHA] a las [HORA]. [DIRECCION] ¿Nos confirma su asistencia o prefiere otro horario?',
    general: '[SALUDO]. Le saludamos de [CONSULTORIO]. ',
    cumpleanos:
      '[SALUDO]. De parte de [CONSULTORIO], le deseamos un muy feliz cumpleaños a [NOMBRE], que hoy cumple [EDAD]. ¡Que tenga un día lleno de alegría! 🎂🎉',
  },
};

/** Textos predeterminados de versiones anteriores: si el consultorio no los cambió, se actualizan solos. */
export const PLANTILLAS_ANTERIORES: Partial<Record<TipoMensaje, string[]>> = {
  recordatorio: [
    '[SALUDO]. Le saludamos de [CONSULTORIO]. Le recordamos la cita de [NOMBRE] programada para el [FECHA] a las [HORA]. ¿Nos confirma su asistencia?',
  ],
  propuesta: [
    '[SALUDO]. Le saludamos de [CONSULTORIO]. A [NOMBRE] le corresponde su cita de control. Le reservamos el [FECHA] a las [HORA]. ¿Nos confirma su asistencia o prefiere otro horario?',
  ],
};

/** "15:30" → "3:30 p. m."; "09:05" → "9:05 a. m."; "12:00" → "12:00 m." (mediodía). */
export function hora12(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  const min = m[2];
  if (h === 12 && min === '00') return '12:00 m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

export const NOMBRE_TIPO_MENSAJE: Record<TipoMensaje, string> = {
  recordatorio: 'Recordatorio de cita',
  propuesta: 'Propuesta de cita de control',
  general: 'Mensaje general',
  cumpleanos: 'Felicitación de cumpleaños',
};

/** "Buenos días" / "Buenas tardes" / "Buenas noches" según la hora local. */
export function saludo(hora: number): string {
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * Número para wa.me: solo dígitos y con código de país.
 * Un número de 8 dígitos se toma como local y se le agrega el código de país.
 * Devuelve null si no parece un número válido.
 */
export function normalizarTelefono(texto: string | null | undefined, codigoPais: string): string | null {
  if (!texto) return null;
  let d = texto.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 8) d = `${codigoPais.replace(/\D/g, '')}${d}`;
  if (d.length < 10 || d.length > 15) return null;
  return d;
}

/** Primer nombre para el mensaje ("Ana Sofía" → "Ana Sofía"; "Ana Sofía Pérez López" se pasa ya separado). */
export function primerNombre(nombres: string): string {
  return nombres.trim().split(/\s+/)[0] ?? '';
}

export function rellenarPlantilla(
  plantilla: string,
  datos: {
    nombre: string;
    fecha?: string | null;
    hora?: string | null;
    edad?: string | null;
    direccion?: string | null;
    consultorio: string;
    horaActual: number;
  },
): string {
  return plantilla
    .replaceAll('[SALUDO]', saludo(datos.horaActual))
    .replaceAll('[CONSULTORIO]', datos.consultorio)
    .replaceAll('[NOMBRE]', datos.nombre)
    .replaceAll('[FECHA]', datos.fecha ? textoFechaLarga(datos.fecha, false) : '[FECHA]')
    .replaceAll('[HORA]', datos.hora ? hora12(datos.hora) : '[HORA]')
    .replaceAll('[EDAD]', datos.edad ?? '[EDAD]')
    .replaceAll('[DIRECCION]', datos.direccion?.trim() ? `Le esperamos en ${datos.direccion.trim().replace(/[.\s]+$/, '')}.` : '')
    // "3:30 p. m." al final de una oración no lleva doble punto.
    .replace(/ (a\. |p\. )?m\.\./g, (x) => x.slice(0, -1))
    .replace(/[ \t]{2,}/g, ' ');
}

/** Enlace oficial de WhatsApp que abre la conversación con el mensaje escrito (sin enviarlo). */
export function enlaceWhatsApp(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/** En la computadora: abre directamente WhatsApp Web con la conversación y el mensaje escrito (sin enviarlo). */
export function enlaceWhatsAppWeb(numero: string, texto: string): string {
  return `https://web.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(texto)}`;
}
