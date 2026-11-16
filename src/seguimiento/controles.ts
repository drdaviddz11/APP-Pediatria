// ¿A quién le toca cita de control?
// Tres fuentes (cada una se puede activar o desactivar en Horario y ajustes):
//   1. Seguimiento indicado: la fecha de seguimiento de la consulta más reciente.
//   2. Niño sano según la edad: calendario de visitas (por defecto, AAP Bright Futures).
//   3. Sin consulta hace tiempo: pacientes que no vienen desde hace N meses.
// Un paciente con una cita activa desde hoy ya está agendado y no aparece.

import { sumarDias, sumarMeses } from '../agenda/tiempo';

export type FuenteControl = 'seguimiento' | 'nino_sano' | 'sin_consulta';

export interface ConfigControles {
  seguimientoActivo: boolean;
  ninoSanoActivo: boolean;
  sinConsultaActivo: boolean;
  /** Edades de control de niño sano, en meses. */
  edadesNinoSano: number[];
  mesesSinConsulta: number;
  /** Mostrar con esta anticipación (días) los controles que están por vencer. */
  diasAnticipacion: number;
}

/**
 * Calendario de visitas de niño sano de la AAP (Bright Futures): 1, 2, 4, 6, 9, 12, 15, 18, 24 y 30 meses,
 * 3 años y luego cada año. Aquí hasta los 18 años. Es editable.
 */
export const EDADES_AAP = [1, 2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168, 180, 192, 204, 216];

export const CONFIG_CONTROLES_PREDETERMINADA: ConfigControles = {
  seguimientoActivo: true,
  ninoSanoActivo: true,
  sinConsultaActivo: true,
  edadesNinoSano: EDADES_AAP,
  mesesSinConsulta: 12,
  diasAnticipacion: 7,
};

/** Un control de niño sano que ya pasó hace más de esto ya no se ofrece (lo cubre "sin consulta"). */
const DIAS_VIGENCIA_NINO_SANO = 90;
const EDAD_MAXIMA_MESES = 228; // 19 años

export interface PacienteControl {
  id: string;
  fechaNacimiento: string; // AAAA-MM-DD
}

export interface ConsultaControl {
  pacienteId: string;
  fecha: string; // AAAA-MM-DD (fecha local de la consulta)
  momento: string; // para ordenar consultas del mismo día
  fechaSeguimiento: string | null;
}

export interface MotivoControl {
  fuente: FuenteControl;
  fechaObjetivo: string; // AAAA-MM-DD
  texto: string;
  /** Identifica este motivo para poder descartarlo sin ocultar motivos futuros. */
  clave: string;
}

export interface ControlPendiente {
  pacienteId: string;
  fechaObjetivo: string; // la más temprana de sus motivos
  motivos: MotivoControl[];
  vencido: boolean;
}

function textoEdadMeses(meses: number): string {
  if (meses < 24) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  if (meses % 12 === 0) return `${meses / 12} años`;
  return `${Math.floor(meses / 12)} años ${meses % 12} meses`;
}

function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

export function calcularControlesPendientes(entrada: {
  pacientes: PacienteControl[];
  consultas: ConsultaControl[];
  /** Pacientes con una cita activa (solicitada, pendiente, confirmada o presente) desde hoy. */
  conCitaActiva: Set<string>;
  /** Claves descartadas, en formato `${pacienteId}|${clave}`. */
  descartados: Set<string>;
  config: ConfigControles;
  hoy: string;
}): ControlPendiente[] {
  const { config, hoy } = entrada;
  const limite = sumarDias(hoy, config.diasAnticipacion);
  const porPaciente = new Map<string, ConsultaControl[]>();
  for (const c of entrada.consultas) {
    const lista = porPaciente.get(c.pacienteId) ?? [];
    lista.push(c);
    porPaciente.set(c.pacienteId, lista);
  }
  const edades = [...config.edadesNinoSano].filter((m) => Number.isFinite(m) && m > 0).sort((a, b) => a - b);

  const resultado: ControlPendiente[] = [];
  for (const p of entrada.pacientes) {
    if (entrada.conCitaActiva.has(p.id)) continue;
    const consultas = (porPaciente.get(p.id) ?? []).sort((a, b) => a.momento.localeCompare(b.momento));
    const ultima = consultas[consultas.length - 1];
    const edadMeses = (diasEntre(p.fechaNacimiento, hoy) / 30.4375) | 0;
    const motivos: MotivoControl[] = [];

    // 1. Seguimiento indicado en la consulta más reciente
    if (config.seguimientoActivo && ultima?.fechaSeguimiento && ultima.fechaSeguimiento <= limite) {
      motivos.push({
        fuente: 'seguimiento',
        fechaObjetivo: ultima.fechaSeguimiento,
        texto: 'Seguimiento indicado en la última consulta',
        clave: `seguimiento:${ultima.fechaSeguimiento}`,
      });
    }

    // 2. Niño sano: el último hito de edad alcanzado (o por alcanzar) sin consulta desde entonces
    if (config.ninoSanoActivo && edadMeses < EDAD_MAXIMA_MESES) {
      for (let i = edades.length - 1; i >= 0; i--) {
        const fecha = sumarMeses(p.fechaNacimiento, edades[i]);
        if (fecha > limite) continue;
        if (diasEntre(fecha, hoy) > DIAS_VIGENCIA_NINO_SANO) break;
        const anterior = i > 0 ? sumarMeses(p.fechaNacimiento, edades[i - 1]) : p.fechaNacimiento;
        const tolerancia = Math.min(30, Math.floor(diasEntre(anterior, fecha) / 2));
        const cubierto = consultas.some((c) => c.fecha >= sumarDias(fecha, -tolerancia));
        if (!cubierto) {
          motivos.push({
            fuente: 'nino_sano',
            fechaObjetivo: fecha,
            texto: `Control de niño sano de ${textoEdadMeses(edades[i])}`,
            clave: `nino_sano:${edades[i]}`,
          });
        }
        break;
      }
    }

    // 3. Sin consulta hace tiempo
    if (config.sinConsultaActivo && ultima && edadMeses < EDAD_MAXIMA_MESES) {
      const fecha = sumarMeses(ultima.fecha, config.mesesSinConsulta);
      if (fecha <= hoy) {
        motivos.push({
          fuente: 'sin_consulta',
          fechaObjetivo: fecha,
          texto: `Sin consulta desde hace más de ${config.mesesSinConsulta} meses`,
          clave: `sin_consulta:${ultima.fecha}`,
        });
      }
    }

    const vigentes = motivos.filter((m) => !entrada.descartados.has(`${p.id}|${m.clave}`));
    if (vigentes.length === 0) continue;
    const fechaObjetivo = vigentes.map((m) => m.fechaObjetivo).sort()[0];
    resultado.push({ pacienteId: p.id, fechaObjetivo, motivos: vigentes, vencido: fechaObjetivo < hoy });
  }
  return resultado.sort((a, b) => a.fechaObjetivo.localeCompare(b.fechaObjetivo));
}

/** Lee la lista de edades escrita por el usuario: "1, 2, 4, 6" → [1, 2, 4, 6]. */
export function leerEdades(texto: string): number[] | null {
  const partes = texto.split(/[,;\s]+/).filter(Boolean);
  const valores = partes.map(Number);
  if (valores.length === 0 || valores.some((v) => !Number.isInteger(v) || v <= 0 || v > EDAD_MAXIMA_MESES)) return null;
  return [...new Set(valores)].sort((a, b) => a - b);
}
