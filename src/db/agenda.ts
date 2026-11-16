// Acceso a datos de la agenda: citas, bloqueos de horario y configuración.

import type { SQLiteDatabase } from 'expo-sqlite';
import { conflictos, horariosDisponibles, rangosDelDia } from '../agenda/disponibilidad';
import {
  ahoraMomento,
  fechaDeMomento,
  horaDeMomento,
  momento,
  sumarDias,
  sumarMinutos,
  textoFechaCorta,
} from '../agenda/tiempo';
import {
  Bloqueo,
  Cita,
  CONFIG_PREDETERMINADA,
  ConfiguracionAgenda,
  EstadoCita,
  esActiva,
  nombreCita,
  TipoCita,
} from '../agenda/tipos';
import { ahoraISO, nuevoId, registrarBitacora } from './util';

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

const CLAVE_AGENDA = 'agenda';

export async function leerConfiguracion(db: SQLiteDatabase): Promise<ConfiguracionAgenda> {
  const fila = await db.getFirstAsync<{ valor: string }>('SELECT valor FROM configuracion WHERE clave = ?', CLAVE_AGENDA);
  if (!fila) return CONFIG_PREDETERMINADA;
  try {
    const guardada = JSON.parse(fila.valor) as Partial<ConfiguracionAgenda>;
    return {
      ...CONFIG_PREDETERMINADA,
      ...guardada,
      horario: { ...CONFIG_PREDETERMINADA.horario, ...(guardada.horario ?? {}) },
    };
  } catch {
    return CONFIG_PREDETERMINADA;
  }
}

export async function guardarConfiguracion(db: SQLiteDatabase, config: ConfiguracionAgenda): Promise<void> {
  const anterior = await leerConfiguracion(db);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO configuracion (clave, valor) VALUES (?, ?)
       ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor`,
      CLAVE_AGENDA,
      JSON.stringify(config),
    );
    await registrarBitacora(db, 'configuracion', CLAVE_AGENDA, 'modificar', anterior);
  });
}

// ---------------------------------------------------------------------------
// Citas
// ---------------------------------------------------------------------------

interface FilaCita {
  id: string;
  paciente_id: string | null;
  nombre_contacto: string;
  telefono_contacto: string;
  inicio: string;
  fin: string;
  tipo: TipoCita;
  estado: EstadoCita;
  motivo: string;
  notas: string;
  consulta_id: string | null;
  creado_en: string;
  actualizado_en: string;
  paciente_nombre: string | null;
  numero_expediente: string | null;
  paciente_whatsapp: string | null;
  paciente_telefono: string | null;
  paciente_consentimiento_whatsapp: number | null;
}

const SELECT_CITA = `
  SELECT c.*,
    CASE WHEN p.id IS NULL THEN NULL ELSE p.nombres || ' ' || p.apellidos END AS paciente_nombre,
    p.numero_expediente AS numero_expediente,
    p.whatsapp AS paciente_whatsapp,
    p.telefono_principal AS paciente_telefono,
    p.consentimiento_whatsapp AS paciente_consentimiento_whatsapp
  FROM citas c
  LEFT JOIN pacientes p ON p.id = c.paciente_id`;

function aCita(f: FilaCita): Cita {
  return {
    id: f.id,
    pacienteId: f.paciente_id,
    nombreContacto: f.nombre_contacto,
    telefonoContacto: f.telefono_contacto,
    inicio: f.inicio,
    fin: f.fin,
    tipo: f.tipo,
    estado: f.estado,
    motivo: f.motivo,
    notas: f.notas,
    consultaId: f.consulta_id,
    creadoEn: f.creado_en,
    actualizadoEn: f.actualizado_en,
    pacienteNombre: f.paciente_nombre,
    numeroExpediente: f.numero_expediente,
    pacienteWhatsapp: f.paciente_whatsapp,
    pacienteTelefono: f.paciente_telefono,
    pacienteConsentimientoWhatsapp: f.paciente_consentimiento_whatsapp == null ? null : f.paciente_consentimiento_whatsapp === 1,
  };
}

/** El horario ya está ocupado por otra cita o por un bloqueo. */
export class HorarioOcupadoError extends Error {}

function describirConflicto(citas: Cita[], bloqueos: Bloqueo[]): string {
  const partes: string[] = [];
  for (const c of citas.slice(0, 3)) {
    partes.push(`${textoFechaCorta(fechaDeMomento(c.inicio))} ${horaDeMomento(c.inicio)}–${horaDeMomento(c.fin)}: ${nombreCita(c)}`);
  }
  for (const b of bloqueos.slice(0, 3)) {
    partes.push(`Bloqueado ${horaDeMomento(b.inicio)}–${horaDeMomento(b.fin)}${b.motivo ? ` (${b.motivo})` : ''}`);
  }
  return partes.join('\n');
}

/** Revisa que el horario esté libre; lanza HorarioOcupadoError con el detalle si no lo está. */
async function verificarHorarioLibre(db: SQLiteDatabase, inicio: string, fin: string, excluirId?: string): Promise<void> {
  const [citas, bloqueos] = await Promise.all([citasEntre(db, inicio, fin), bloqueosEntre(db, inicio, fin)]);
  const c = conflictos({ inicio, fin, id: excluirId }, citas, bloqueos);
  if (c.citas.length > 0 || c.bloqueos.length > 0) {
    throw new HorarioOcupadoError(`El horario ya está ocupado:\n${describirConflicto(c.citas as Cita[], c.bloqueos as Bloqueo[])}`);
  }
}

/** Traduce los mensajes de los candados de la base de datos. */
function traducirError(e: unknown): Error {
  const mensaje = e instanceof Error ? e.message : String(e);
  if (mensaje.includes('TRASLAPE')) return new HorarioOcupadoError('Ya existe una cita en ese horario.');
  if (mensaje.includes('BLOQUEO')) return new HorarioOcupadoError('Ese horario está bloqueado.');
  return e instanceof Error ? e : new Error(mensaje);
}

export interface CitaEntrada {
  pacienteId: string | null;
  nombreContacto: string;
  telefonoContacto: string;
  inicio: string;
  fin: string;
  tipo: TipoCita;
  estado: EstadoCita;
  motivo: string;
  notas: string;
}

export async function crearCita(db: SQLiteDatabase, c: CitaEntrada): Promise<string> {
  if (!c.pacienteId && !c.nombreContacto.trim()) throw new Error('Indique el paciente o el nombre de la persona.');
  if (c.fin <= c.inicio) throw new Error('La hora de fin debe ser posterior a la de inicio.');
  if (esActiva(c.estado)) await verificarHorarioLibre(db, c.inicio, c.fin);
  const id = nuevoId();
  const ahora = ahoraISO();
  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO citas (
          id, paciente_id, nombre_contacto, telefono_contacto, inicio, fin, tipo, estado,
          motivo, notas, consulta_id, creado_en, actualizado_en
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        id,
        c.pacienteId,
        c.nombreContacto.trim(),
        c.telefonoContacto.trim(),
        c.inicio,
        c.fin,
        c.tipo,
        c.estado,
        c.motivo.trim(),
        c.notas.trim(),
        ahora,
        ahora,
      );
      await registrarBitacora(db, 'cita', id, 'crear');
    });
  } catch (e) {
    throw traducirError(e);
  }
  return id;
}

export type CambiosCita = Partial<CitaEntrada & { consultaId: string | null }>;

/** Actualiza una cita, revisando que el nuevo horario esté libre si la cita queda activa. */
export async function actualizarCita(db: SQLiteDatabase, id: string, cambios: CambiosCita): Promise<void> {
  const anterior = await obtenerCita(db, id);
  if (!anterior) throw new Error('La cita no existe.');
  const nueva = { ...anterior, ...cambios };
  if (nueva.fin <= nueva.inicio) throw new Error('La hora de fin debe ser posterior a la de inicio.');
  const cambiaHorario = nueva.inicio !== anterior.inicio || nueva.fin !== anterior.fin;
  const seReactiva = !esActiva(anterior.estado) && esActiva(nueva.estado);
  if (esActiva(nueva.estado) && (cambiaHorario || seReactiva)) {
    await verificarHorarioLibre(db, nueva.inicio, nueva.fin, id);
  }
  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE citas SET
          paciente_id = ?, nombre_contacto = ?, telefono_contacto = ?, inicio = ?, fin = ?, tipo = ?, estado = ?,
          motivo = ?, notas = ?, consulta_id = ?, actualizado_en = ?
        WHERE id = ?`,
        nueva.pacienteId,
        nueva.nombreContacto.trim(),
        nueva.telefonoContacto.trim(),
        nueva.inicio,
        nueva.fin,
        nueva.tipo,
        nueva.estado,
        nueva.motivo.trim(),
        nueva.notas.trim(),
        nueva.consultaId,
        ahoraISO(),
        id,
      );
      await registrarBitacora(db, 'cita', id, 'modificar', anterior);
    });
  } catch (e) {
    throw traducirError(e);
  }
}

export async function cambiarEstadoCita(db: SQLiteDatabase, id: string, estado: EstadoCita): Promise<void> {
  await actualizarCita(db, id, { estado });
}

/** Marca la cita como completada y la enlaza con la consulta registrada. */
export async function vincularConsulta(db: SQLiteDatabase, citaId: string, consultaId: string): Promise<void> {
  await actualizarCita(db, citaId, { estado: 'completada', consultaId });
}

/** Enlaza una cita de una persona sin expediente con el expediente recién creado. */
export async function vincularPaciente(db: SQLiteDatabase, citaId: string, pacienteId: string): Promise<void> {
  await actualizarCita(db, citaId, { pacienteId });
}

export async function obtenerCita(db: SQLiteDatabase, id: string): Promise<Cita | null> {
  const f = await db.getFirstAsync<FilaCita>(`${SELECT_CITA} WHERE c.id = ?`, id);
  return f ? aCita(f) : null;
}

/** Citas (de cualquier estado) que se traslapan con [desde, hasta), ordenadas por hora. */
export async function citasEntre(db: SQLiteDatabase, desde: string, hasta: string): Promise<Cita[]> {
  const filas = await db.getAllAsync<FilaCita>(
    `${SELECT_CITA} WHERE c.inicio < ? AND c.fin > ? ORDER BY c.inicio, c.creado_en`,
    hasta,
    desde,
  );
  return filas.map(aCita);
}

/** Citas de un paciente desde un momento (por defecto todas), ordenadas por hora. */
export async function citasDePaciente(db: SQLiteDatabase, pacienteId: string, desde = ''): Promise<Cita[]> {
  const filas = await db.getAllAsync<FilaCita>(
    `${SELECT_CITA} WHERE c.paciente_id = ? AND c.inicio >= ? ORDER BY c.inicio`,
    pacienteId,
    desde,
  );
  return filas.map(aCita);
}

/** Próximas citas con alguno de los estados indicados, desde `desde`. */
export async function citasPorEstado(
  db: SQLiteDatabase,
  estados: EstadoCita[],
  desde: string,
  hasta: string,
  limite = 20,
): Promise<Cita[]> {
  const marcas = estados.map(() => '?').join(', ');
  const filas = await db.getAllAsync<FilaCita>(
    `${SELECT_CITA} WHERE c.estado IN (${marcas}) AND c.inicio >= ? AND c.inicio < ? ORDER BY c.inicio LIMIT ?`,
    ...estados,
    desde,
    hasta,
    limite,
  );
  return filas.map(aCita);
}

/**
 * Primer horario libre de `duracion` minutos desde `desdeFecha` (inclusive), buscando hasta `maxDias` días.
 * Respeta el horario de atención, las citas activas, los bloqueos y la hora actual.
 */
export async function buscarHorarioLibre(
  db: SQLiteDatabase,
  desdeFecha: string,
  duracion: number,
  maxDias = 30,
): Promise<{ inicio: string; fin: string } | null> {
  const config = await leerConfiguracion(db);
  const ahora = ahoraMomento();
  for (let d = 0; d < maxDias; d++) {
    const fecha = sumarDias(desdeFecha, d);
    if (rangosDelDia(config, fecha).length === 0) continue;
    const desde = `${fecha}T00:00`;
    const hasta = `${sumarDias(fecha, 1)}T00:00`;
    const [citas, bloqueos] = await Promise.all([citasEntre(db, desde, hasta), bloqueosEntre(db, desde, hasta)]);
    const libres = horariosDisponibles(fecha, duracion, config, [...citas.filter((c) => esActiva(c.estado)), ...bloqueos], ahora);
    if (libres.length > 0) {
      const inicio = momento(fecha, libres[0]);
      return { inicio, fin: sumarMinutos(inicio, duracion) };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Bloqueos de horario
// ---------------------------------------------------------------------------

interface FilaBloqueo {
  id: string;
  inicio: string;
  fin: string;
  motivo: string;
  creado_en: string;
}

function aBloqueo(f: FilaBloqueo): Bloqueo {
  return { id: f.id, inicio: f.inicio, fin: f.fin, motivo: f.motivo, creadoEn: f.creado_en };
}

export async function bloqueosEntre(db: SQLiteDatabase, desde: string, hasta: string): Promise<Bloqueo[]> {
  const filas = await db.getAllAsync<FilaBloqueo>(
    'SELECT * FROM bloqueos WHERE inicio < ? AND fin > ? ORDER BY inicio',
    hasta,
    desde,
  );
  return filas.map(aBloqueo);
}

export async function crearBloqueo(db: SQLiteDatabase, inicio: string, fin: string, motivo: string): Promise<string> {
  if (fin <= inicio) throw new Error('La hora de fin debe ser posterior a la de inicio.');
  const activas = (await citasEntre(db, inicio, fin)).filter((c) => esActiva(c.estado));
  if (activas.length > 0) {
    throw new HorarioOcupadoError(
      `Hay citas activas en ese horario. Reprográmelas o cancélelas primero:\n${describirConflicto(activas, [])}`,
    );
  }
  const id = nuevoId();
  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        'INSERT INTO bloqueos (id, inicio, fin, motivo, creado_en) VALUES (?, ?, ?, ?, ?)',
        id,
        inicio,
        fin,
        motivo.trim(),
        ahoraISO(),
      );
      await registrarBitacora(db, 'bloqueo', id, 'crear');
    });
  } catch (e) {
    throw traducirError(e);
  }
  return id;
}

export async function borrarBloqueo(db: SQLiteDatabase, id: string): Promise<void> {
  const anterior = await db.getFirstAsync<FilaBloqueo>('SELECT * FROM bloqueos WHERE id = ?', id);
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM bloqueos WHERE id = ?', id);
    await registrarBitacora(db, 'bloqueo', id, 'eliminar', anterior ?? undefined);
  });
}
