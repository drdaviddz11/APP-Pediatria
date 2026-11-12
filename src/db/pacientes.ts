// Acceso a datos de pacientes e historia clínica.
// Las pantallas solo usan estas funciones; así, más adelante se puede cambiar SQLite
// por un servidor (por ejemplo Supabase) sin reescribir la interfaz.

import type { SQLiteDatabase } from 'expo-sqlite';
import type { HistoriaClinica, HistoriaClinicaEntrada, Paciente, PacienteEntrada } from '../domain/types';
import { soloDigitos } from '../domain/validacion';
import { aBool, ahoraISO, normalizar, nuevoId, registrarBitacora } from './util';

interface FilaPaciente {
  id: string;
  numero_expediente: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  sexo: 'F' | 'M';
  semanas_gestacion: number | null;
  sindrome_down: number;
  responsable_nombre: string;
  responsable_parentesco: string;
  telefono_principal: string;
  telefono_secundario: string;
  whatsapp: string;
  correo: string;
  direccion: string;
  emergencia_nombre: string;
  emergencia_telefono: string;
  consentimiento_datos: number;
  consentimiento_whatsapp: number;
  es_demo: number;
  creado_en: string;
  actualizado_en: string;
}

function aPaciente(f: FilaPaciente): Paciente {
  return {
    id: f.id,
    numeroExpediente: f.numero_expediente,
    nombres: f.nombres,
    apellidos: f.apellidos,
    fechaNacimiento: f.fecha_nacimiento,
    sexo: f.sexo,
    semanasGestacion: f.semanas_gestacion,
    sindromeDown: aBool(f.sindrome_down),
    responsableNombre: f.responsable_nombre,
    responsableParentesco: f.responsable_parentesco,
    telefonoPrincipal: f.telefono_principal,
    telefonoSecundario: f.telefono_secundario,
    whatsapp: f.whatsapp,
    correo: f.correo,
    direccion: f.direccion,
    emergenciaNombre: f.emergencia_nombre,
    emergenciaTelefono: f.emergencia_telefono,
    consentimientoDatos: aBool(f.consentimiento_datos),
    consentimientoWhatsapp: aBool(f.consentimiento_whatsapp),
    esDemo: aBool(f.es_demo),
    creadoEn: f.creado_en,
    actualizadoEn: f.actualizado_en,
  };
}

function textoBusqueda(p: PacienteEntrada): string {
  const telefonos = [p.telefonoPrincipal, p.telefonoSecundario, p.whatsapp].map(soloDigitos).filter(Boolean);
  return [normalizar(`${p.nombres} ${p.apellidos}`), normalizar(p.numeroExpediente), normalizar(p.responsableNombre), ...telefonos].join(' | ');
}

function limpiar(p: PacienteEntrada): PacienteEntrada {
  return {
    ...p,
    numeroExpediente: p.numeroExpediente.trim(),
    nombres: p.nombres.trim(),
    apellidos: p.apellidos.trim(),
    responsableNombre: p.responsableNombre.trim(),
    responsableParentesco: p.responsableParentesco.trim(),
    telefonoPrincipal: p.telefonoPrincipal.trim(),
    telefonoSecundario: p.telefonoSecundario.trim(),
    whatsapp: p.whatsapp.trim(),
    correo: p.correo.trim(),
    direccion: p.direccion.trim(),
    emergenciaNombre: p.emergenciaNombre.trim(),
    emergenciaTelefono: p.emergenciaTelefono.trim(),
  };
}

export class ExpedienteDuplicadoError extends Error {
  constructor(numero: string) {
    super(`Ya existe un paciente con el expediente ${numero}.`);
  }
}

async function expedienteEnUso(db: SQLiteDatabase, numero: string, exceptoId?: string): Promise<boolean> {
  const fila = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM pacientes WHERE numero_expediente = ? AND id != ?',
    numero,
    exceptoId ?? '',
  );
  return (fila?.n ?? 0) > 0;
}

export async function crearPaciente(db: SQLiteDatabase, entrada: PacienteEntrada, esDemo = false): Promise<string> {
  const p = limpiar(entrada);
  if (await expedienteEnUso(db, p.numeroExpediente)) throw new ExpedienteDuplicadoError(p.numeroExpediente);

  const id = nuevoId();
  const ahora = ahoraISO();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO pacientes (
        id, numero_expediente, nombres, apellidos, fecha_nacimiento, sexo, semanas_gestacion, sindrome_down,
        responsable_nombre, responsable_parentesco, telefono_principal, telefono_secundario, whatsapp,
        correo, direccion, emergencia_nombre, emergencia_telefono,
        consentimiento_datos, consentimiento_whatsapp, es_demo, busqueda, creado_en, actualizado_en
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      p.numeroExpediente,
      p.nombres,
      p.apellidos,
      p.fechaNacimiento,
      p.sexo,
      p.semanasGestacion,
      p.sindromeDown ? 1 : 0,
      p.responsableNombre,
      p.responsableParentesco,
      p.telefonoPrincipal,
      p.telefonoSecundario,
      p.whatsapp,
      p.correo,
      p.direccion,
      p.emergenciaNombre,
      p.emergenciaTelefono,
      p.consentimientoDatos ? 1 : 0,
      p.consentimientoWhatsapp ? 1 : 0,
      esDemo ? 1 : 0,
      textoBusqueda(p),
      ahora,
      ahora,
    );
    await db.runAsync('INSERT INTO historias_clinicas (paciente_id) VALUES (?)', id);
    await registrarBitacora(db, 'paciente', id, 'crear');
  });
  return id;
}

export async function actualizarPaciente(db: SQLiteDatabase, id: string, entrada: PacienteEntrada): Promise<void> {
  const p = limpiar(entrada);
  const anterior = await obtenerPaciente(db, id);
  if (!anterior) throw new Error('El paciente no existe.');
  if (await expedienteEnUso(db, p.numeroExpediente, id)) throw new ExpedienteDuplicadoError(p.numeroExpediente);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE pacientes SET
        numero_expediente = ?, nombres = ?, apellidos = ?, fecha_nacimiento = ?, sexo = ?, semanas_gestacion = ?, sindrome_down = ?,
        responsable_nombre = ?, responsable_parentesco = ?, telefono_principal = ?, telefono_secundario = ?,
        whatsapp = ?, correo = ?, direccion = ?, emergencia_nombre = ?, emergencia_telefono = ?,
        consentimiento_datos = ?, consentimiento_whatsapp = ?, busqueda = ?, actualizado_en = ?
      WHERE id = ?`,
      p.numeroExpediente,
      p.nombres,
      p.apellidos,
      p.fechaNacimiento,
      p.sexo,
      p.semanasGestacion,
      p.sindromeDown ? 1 : 0,
      p.responsableNombre,
      p.responsableParentesco,
      p.telefonoPrincipal,
      p.telefonoSecundario,
      p.whatsapp,
      p.correo,
      p.direccion,
      p.emergenciaNombre,
      p.emergenciaTelefono,
      p.consentimientoDatos ? 1 : 0,
      p.consentimientoWhatsapp ? 1 : 0,
      textoBusqueda(p),
      ahoraISO(),
      id,
    );
    // Se guarda la versión anterior para poder rastrear quién cambió qué.
    await registrarBitacora(db, 'paciente', id, 'modificar', anterior);
  });
}

export async function obtenerPaciente(db: SQLiteDatabase, id: string): Promise<Paciente | null> {
  const fila = await db.getFirstAsync<FilaPaciente>('SELECT * FROM pacientes WHERE id = ?', id);
  return fila ? aPaciente(fila) : null;
}

export interface ResumenPaciente {
  id: string;
  numeroExpediente: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  sexo: 'F' | 'M';
  esDemo: boolean;
  ultimaConsulta: string | null;
}

/** Lista de pacientes. Busca por nombre, apellidos, expediente, responsable o teléfono. */
export async function buscarPacientes(db: SQLiteDatabase, texto: string, limite = 200): Promise<ResumenPaciente[]> {
  const termino = normalizar(texto);
  const digitos = soloDigitos(texto);
  const palabras = termino.split(' ').filter(Boolean);

  const condiciones: string[] = [];
  const parametros: (string | number)[] = [];
  for (const palabra of palabras) {
    condiciones.push('p.busqueda LIKE ?');
    parametros.push(`%${palabra}%`);
  }
  // Si el usuario escribió un teléfono con espacios o guiones, buscar también solo los dígitos.
  const where =
    condiciones.length === 0
      ? ''
      : digitos.length >= 4 && digitos !== termino
        ? `WHERE ((${condiciones.join(' AND ')}) OR p.busqueda LIKE ?)`
        : `WHERE ${condiciones.join(' AND ')}`;
  if (condiciones.length > 0 && digitos.length >= 4 && digitos !== termino) parametros.push(`%${digitos}%`);
  parametros.push(limite);

  const filas = await db.getAllAsync<{
    id: string;
    numero_expediente: string;
    nombres: string;
    apellidos: string;
    fecha_nacimiento: string;
    sexo: 'F' | 'M';
    es_demo: number;
    ultima_consulta: string | null;
  }>(
    `SELECT p.id, p.numero_expediente, p.nombres, p.apellidos, p.fecha_nacimiento, p.sexo, p.es_demo,
       (SELECT MAX(c.fecha_hora) FROM consultas c WHERE c.paciente_id = p.id) AS ultima_consulta
     FROM pacientes p
     ${where}
     ORDER BY p.apellidos COLLATE NOCASE, p.nombres COLLATE NOCASE
     LIMIT ?`,
    ...parametros,
  );

  return filas.map((f) => ({
    id: f.id,
    numeroExpediente: f.numero_expediente,
    nombres: f.nombres,
    apellidos: f.apellidos,
    fechaNacimiento: f.fecha_nacimiento,
    sexo: f.sexo,
    esDemo: aBool(f.es_demo),
    ultimaConsulta: f.ultima_consulta,
  }));
}

/** Número de expediente sugerido para el siguiente paciente (EXP-0001, EXP-0002, ...). */
export async function sugerirNumeroExpediente(db: SQLiteDatabase): Promise<string> {
  const filas = await db.getAllAsync<{ numero_expediente: string }>(
    "SELECT numero_expediente FROM pacientes WHERE numero_expediente LIKE 'EXP-%'",
  );
  let max = 0;
  for (const f of filas) {
    const n = Number(f.numero_expediente.slice(4));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `EXP-${String(max + 1).padStart(4, '0')}`;
}

// ---------------------------------------------------------------------------
// Historia clínica
// ---------------------------------------------------------------------------

interface FilaHistoria {
  paciente_id: string;
  antecedentes_personales: string;
  antecedentes_familiares: string;
  antecedentes_perinatales: string;
  antecedentes_quirurgicos: string;
  alergias: string;
  medicamentos_actuales: string;
  vacunas: string;
  hospitalizaciones: string;
  diagnosticos_previos: string;
  actualizado_en: string | null;
}

export async function obtenerHistoria(db: SQLiteDatabase, pacienteId: string): Promise<HistoriaClinica> {
  const f = await db.getFirstAsync<FilaHistoria>('SELECT * FROM historias_clinicas WHERE paciente_id = ?', pacienteId);
  return {
    pacienteId,
    antecedentesPersonales: f?.antecedentes_personales ?? '',
    antecedentesFamiliares: f?.antecedentes_familiares ?? '',
    antecedentesPerinatales: f?.antecedentes_perinatales ?? '',
    antecedentesQuirurgicos: f?.antecedentes_quirurgicos ?? '',
    alergias: f?.alergias ?? '',
    medicamentosActuales: f?.medicamentos_actuales ?? '',
    vacunas: f?.vacunas ?? '',
    hospitalizaciones: f?.hospitalizaciones ?? '',
    diagnosticosPrevios: f?.diagnosticos_previos ?? '',
    actualizadoEn: f?.actualizado_en ?? null,
  };
}

export async function guardarHistoria(db: SQLiteDatabase, pacienteId: string, h: HistoriaClinicaEntrada): Promise<void> {
  const anterior = await obtenerHistoria(db, pacienteId);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO historias_clinicas (
        paciente_id, antecedentes_personales, antecedentes_familiares, antecedentes_perinatales,
        antecedentes_quirurgicos, alergias, medicamentos_actuales, vacunas, hospitalizaciones,
        diagnosticos_previos, actualizado_en
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (paciente_id) DO UPDATE SET
        antecedentes_personales = excluded.antecedentes_personales,
        antecedentes_familiares = excluded.antecedentes_familiares,
        antecedentes_perinatales = excluded.antecedentes_perinatales,
        antecedentes_quirurgicos = excluded.antecedentes_quirurgicos,
        alergias = excluded.alergias,
        medicamentos_actuales = excluded.medicamentos_actuales,
        vacunas = excluded.vacunas,
        hospitalizaciones = excluded.hospitalizaciones,
        diagnosticos_previos = excluded.diagnosticos_previos,
        actualizado_en = excluded.actualizado_en`,
      pacienteId,
      h.antecedentesPersonales.trim(),
      h.antecedentesFamiliares.trim(),
      h.antecedentesPerinatales.trim(),
      h.antecedentesQuirurgicos.trim(),
      h.alergias.trim(),
      h.medicamentosActuales.trim(),
      h.vacunas.trim(),
      h.hospitalizaciones.trim(),
      h.diagnosticosPrevios.trim(),
      ahoraISO(),
    );
    await registrarBitacora(db, 'historia_clinica', pacienteId, 'modificar', anterior);
  });
}

/** Borra solo los pacientes ficticios de demostración (los reales están protegidos). */
export async function borrarPacientesDemo(db: SQLiteDatabase): Promise<number> {
  const r = await db.runAsync('DELETE FROM pacientes WHERE es_demo = 1');
  return r.changes;
}
