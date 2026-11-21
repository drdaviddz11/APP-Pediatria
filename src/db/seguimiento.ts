// Datos de controles por agendar, mensajes de WhatsApp y su configuración.

import type { SQLiteDatabase } from 'expo-sqlite';
import { sumarDias } from '../agenda/tiempo';
import { Cita, duracionDeTipo } from '../agenda/tipos';
import { aISO, deDate } from '../domain/fechas';
import {
  calcularControlesPendientes,
  CONFIG_CONTROLES_PREDETERMINADA,
  ConfigControles,
  ControlPendiente,
} from '../seguimiento/controles';
import { CONFIG_MENSAJES_PREDETERMINADA, ConfigMensajes, TipoMensaje } from '../seguimiento/mensajes';
import { buscarHorarioLibre, crearCita, leerConfiguracion, obtenerCita } from './agenda';
import { aBool, ahoraISO, nuevoId, registrarBitacora } from './util';

// ---------------------------------------------------------------------------
// Configuración (tabla "configuracion")
// ---------------------------------------------------------------------------

async function leerClave<T extends object>(db: SQLiteDatabase, clave: string, predeterminada: T): Promise<T> {
  const fila = await db.getFirstAsync<{ valor: string }>('SELECT valor FROM configuracion WHERE clave = ?', clave);
  if (!fila) return predeterminada;
  try {
    return { ...predeterminada, ...(JSON.parse(fila.valor) as Partial<T>) };
  } catch {
    return predeterminada;
  }
}

async function guardarClave(db: SQLiteDatabase, clave: string, valor: object, anterior: object): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor',
      clave,
      JSON.stringify(valor),
    );
    await registrarBitacora(db, 'configuracion', clave, 'modificar', anterior);
  });
}

export async function leerConfigMensajes(db: SQLiteDatabase): Promise<ConfigMensajes> {
  const c = await leerClave(db, 'mensajes', CONFIG_MENSAJES_PREDETERMINADA);
  return { ...c, plantillas: { ...CONFIG_MENSAJES_PREDETERMINADA.plantillas, ...c.plantillas } };
}

export async function guardarConfigMensajes(db: SQLiteDatabase, c: ConfigMensajes): Promise<void> {
  await guardarClave(db, 'mensajes', c, await leerConfigMensajes(db));
}

export async function leerConfigControles(db: SQLiteDatabase): Promise<ConfigControles> {
  return leerClave(db, 'controles', CONFIG_CONTROLES_PREDETERMINADA);
}

export async function guardarConfigControles(db: SQLiteDatabase, c: ConfigControles): Promise<void> {
  await guardarClave(db, 'controles', c, await leerConfigControles(db));
}

// ---------------------------------------------------------------------------
// Controles por agendar
// ---------------------------------------------------------------------------

export interface ControlConPaciente extends ControlPendiente {
  nombres: string;
  apellidos: string;
  numeroExpediente: string;
  fechaNacimiento: string;
  whatsapp: string;
  telefonoPrincipal: string;
  consentimientoWhatsapp: boolean;
  ultimoMensaje: string | null; // fecha y hora ISO
}

export async function controlesPendientes(db: SQLiteDatabase, hoy: string): Promise<ControlConPaciente[]> {
  const [config, pacientes, consultas, conCita, descartados, mensajes] = await Promise.all([
    leerConfigControles(db),
    db.getAllAsync<{
      id: string;
      nombres: string;
      apellidos: string;
      numero_expediente: string;
      fecha_nacimiento: string;
      whatsapp: string;
      telefono_principal: string;
      consentimiento_whatsapp: number;
    }>(
      'SELECT id, nombres, apellidos, numero_expediente, fecha_nacimiento, whatsapp, telefono_principal, consentimiento_whatsapp FROM pacientes',
    ),
    db.getAllAsync<{ paciente_id: string; fecha_hora: string; fecha_seguimiento: string | null }>(
      'SELECT paciente_id, fecha_hora, fecha_seguimiento FROM consultas',
    ),
    db.getAllAsync<{ paciente_id: string }>(
      `SELECT DISTINCT paciente_id FROM citas
       WHERE paciente_id IS NOT NULL AND estado IN ('solicitada', 'pendiente', 'confirmada', 'presente') AND inicio >= ?`,
      `${hoy}T00:00`,
    ),
    db.getAllAsync<{ paciente_id: string; clave: string }>('SELECT paciente_id, clave FROM controles_descartados'),
    db.getAllAsync<{ paciente_id: string; ultimo: string }>(
      'SELECT paciente_id, MAX(creado_en) AS ultimo FROM mensajes_whatsapp WHERE paciente_id IS NOT NULL GROUP BY paciente_id',
    ),
  ]);

  const pendientes = calcularControlesPendientes({
    pacientes: pacientes.map((p) => ({ id: p.id, fechaNacimiento: p.fecha_nacimiento })),
    consultas: consultas.map((c) => ({
      pacienteId: c.paciente_id,
      fecha: aISO(deDate(new Date(c.fecha_hora))),
      momento: c.fecha_hora,
      fechaSeguimiento: c.fecha_seguimiento,
    })),
    conCitaActiva: new Set(conCita.map((c) => c.paciente_id)),
    descartados: new Set(descartados.map((d) => `${d.paciente_id}|${d.clave}`)),
    config,
    hoy,
  });

  const porId = new Map(pacientes.map((p) => [p.id, p]));
  const ultimo = new Map(mensajes.map((m) => [m.paciente_id, m.ultimo]));
  return pendientes.map((c) => {
    const p = porId.get(c.pacienteId)!;
    return {
      ...c,
      nombres: p.nombres,
      apellidos: p.apellidos,
      numeroExpediente: p.numero_expediente,
      fechaNacimiento: p.fecha_nacimiento,
      whatsapp: p.whatsapp,
      telefonoPrincipal: p.telefono_principal,
      consentimientoWhatsapp: aBool(p.consentimiento_whatsapp),
      ultimoMensaje: ultimo.get(c.pacienteId) ?? null,
    };
  });
}

export async function descartarControl(db: SQLiteDatabase, pacienteId: string, claves: string[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const clave of claves) {
      await db.runAsync(
        'INSERT OR IGNORE INTO controles_descartados (paciente_id, clave, creado_en) VALUES (?, ?, ?)',
        pacienteId,
        clave,
        ahoraISO(),
      );
    }
    await registrarBitacora(db, 'control_descartado', pacienteId, 'crear', claves);
  });
}

/**
 * Aparta la primera cita de control libre desde `desdeFecha` como "pendiente de confirmación".
 * Devuelve la cita creada o null si no hay horario libre en los siguientes 30 días.
 */
export async function proponerCitaControl(
  db: SQLiteDatabase,
  pacienteId: string,
  desdeFecha: string,
  motivo: string,
): Promise<Cita | null> {
  const config = await leerConfiguracion(db);
  const horario = await buscarHorarioLibre(db, desdeFecha, duracionDeTipo(config, 'control'));
  if (!horario) return null;
  const id = await crearCita(db, {
    pacienteId,
    nombreContacto: '',
    telefonoContacto: '',
    inicio: horario.inicio,
    fin: horario.fin,
    tipo: 'control',
    estado: 'pendiente',
    motivo,
    notas: 'Propuesta automática de control: esperar confirmación por WhatsApp.',
  });
  return obtenerCita(db, id);
}

/** Fecha desde la que se propone la cita: la fecha objetivo, pero nunca antes de mañana. */
export function fechaParaProponer(fechaObjetivo: string, hoy: string): string {
  const manana = sumarDias(hoy, 1);
  return fechaObjetivo > manana ? fechaObjetivo : manana;
}

// ---------------------------------------------------------------------------
// Registro de mensajes
// ---------------------------------------------------------------------------

export async function registrarMensaje(
  db: SQLiteDatabase,
  m: { pacienteId: string | null; citaId: string | null; tipo: TipoMensaje; telefono: string },
): Promise<void> {
  await db.runAsync(
    'INSERT INTO mensajes_whatsapp (id, paciente_id, cita_id, tipo, telefono, creado_en) VALUES (?, ?, ?, ?, ?, ?)',
    nuevoId(),
    m.pacienteId,
    m.citaId,
    // Las felicitaciones se anotan en su propia tabla (felicitaciones); aquí quedarían como mensaje general.
    m.tipo === 'cumpleanos' ? 'general' : m.tipo,
    m.telefono,
    ahoraISO(),
  );
}

/** Último recordatorio enviado por cita, para las citas indicadas. */
export async function recordatoriosEnviados(db: SQLiteDatabase, citaIds: string[]): Promise<Map<string, string>> {
  if (citaIds.length === 0) return new Map();
  const marcas = citaIds.map(() => '?').join(', ');
  const filas = await db.getAllAsync<{ cita_id: string; ultimo: string }>(
    `SELECT cita_id, MAX(creado_en) AS ultimo FROM mensajes_whatsapp
     WHERE tipo = 'recordatorio' AND cita_id IN (${marcas}) GROUP BY cita_id`,
    ...citaIds,
  );
  return new Map(filas.map((f) => [f.cita_id, f.ultimo]));
}

/** Número de controles por agendar (para el panel principal). */
export async function contarControlesPendientes(db: SQLiteDatabase, hoy: string): Promise<number> {
  return (await controlesPendientes(db, hoy)).length;
}
