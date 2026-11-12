// Acceso a datos de consultas. Las consultas se guardan una sola vez y no se modifican;
// para corregir o completar información se agregan notas aclaratorias con su fecha.

import type { SQLiteDatabase } from 'expo-sqlite';
import type { Consulta, ConsultaEntrada, NotaAclaratoria } from '../domain/types';
import { ahoraISO, nuevoId, registrarBitacora } from './util';

interface FilaConsulta {
  id: string;
  paciente_id: string;
  fecha_hora: string;
  motivo: string;
  enfermedad_actual: string;
  sintomas: string;
  exploracion_fisica: string;
  temperatura_c: number | null;
  frecuencia_cardiaca: number | null;
  frecuencia_respiratoria: number | null;
  saturacion_o2: number | null;
  presion_sistolica: number | null;
  presion_diastolica: number | null;
  peso_kg: number | null;
  talla_cm: number | null;
  tipo_medicion: 'acostado' | 'de_pie' | null;
  perimetro_cefalico_cm: number | null;
  edema: number;
  diagnosticos: string;
  estudios_solicitados: string;
  tratamiento: string;
  indicaciones: string;
  fecha_seguimiento: string | null;
  creado_en: string;
}

function aConsulta(f: FilaConsulta): Consulta {
  return {
    id: f.id,
    pacienteId: f.paciente_id,
    fechaHora: f.fecha_hora,
    motivo: f.motivo,
    enfermedadActual: f.enfermedad_actual,
    sintomas: f.sintomas,
    exploracionFisica: f.exploracion_fisica,
    temperaturaC: f.temperatura_c,
    frecuenciaCardiaca: f.frecuencia_cardiaca,
    frecuenciaRespiratoria: f.frecuencia_respiratoria,
    saturacionO2: f.saturacion_o2,
    presionSistolica: f.presion_sistolica,
    presionDiastolica: f.presion_diastolica,
    pesoKg: f.peso_kg,
    tallaCm: f.talla_cm,
    tipoMedicion: f.tipo_medicion,
    perimetroCefalicoCm: f.perimetro_cefalico_cm,
    edema: f.edema === 1,
    diagnosticos: f.diagnosticos,
    estudiosSolicitados: f.estudios_solicitados,
    tratamiento: f.tratamiento,
    indicaciones: f.indicaciones,
    fechaSeguimiento: f.fecha_seguimiento,
    creadoEn: f.creado_en,
  };
}

export async function crearConsulta(db: SQLiteDatabase, pacienteId: string, c: ConsultaEntrada): Promise<string> {
  const id = nuevoId();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO consultas (
        id, paciente_id, fecha_hora, motivo, enfermedad_actual, sintomas, exploracion_fisica,
        temperatura_c, frecuencia_cardiaca, frecuencia_respiratoria, saturacion_o2,
        presion_sistolica, presion_diastolica, peso_kg, talla_cm, tipo_medicion, perimetro_cefalico_cm, edema,
        diagnosticos, estudios_solicitados, tratamiento, indicaciones, fecha_seguimiento, creado_en
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      pacienteId,
      c.fechaHora,
      c.motivo.trim(),
      c.enfermedadActual.trim(),
      c.sintomas.trim(),
      c.exploracionFisica.trim(),
      c.temperaturaC,
      c.frecuenciaCardiaca,
      c.frecuenciaRespiratoria,
      c.saturacionO2,
      c.presionSistolica,
      c.presionDiastolica,
      c.pesoKg,
      c.tallaCm,
      c.tipoMedicion,
      c.perimetroCefalicoCm,
      c.edema ? 1 : 0,
      c.diagnosticos.trim(),
      c.estudiosSolicitados.trim(),
      c.tratamiento.trim(),
      c.indicaciones.trim(),
      c.fechaSeguimiento,
      ahoraISO(),
    );
    await registrarBitacora(db, 'consulta', id, 'crear');
  });
  return id;
}

export async function obtenerConsulta(db: SQLiteDatabase, id: string): Promise<Consulta | null> {
  const f = await db.getFirstAsync<FilaConsulta>('SELECT * FROM consultas WHERE id = ?', id);
  return f ? aConsulta(f) : null;
}

/** Consultas del paciente, de la más reciente a la más antigua. */
export async function listarConsultas(db: SQLiteDatabase, pacienteId: string): Promise<Consulta[]> {
  const filas = await db.getAllAsync<FilaConsulta>(
    'SELECT * FROM consultas WHERE paciente_id = ? ORDER BY fecha_hora DESC',
    pacienteId,
  );
  return filas.map(aConsulta);
}

/** Consulta anterior (por fecha) a la indicada, para comparar la evolución. */
export async function consultaAnterior(db: SQLiteDatabase, pacienteId: string, fechaHora: string): Promise<Consulta | null> {
  const f = await db.getFirstAsync<FilaConsulta>(
    'SELECT * FROM consultas WHERE paciente_id = ? AND fecha_hora < ? ORDER BY fecha_hora DESC LIMIT 1',
    pacienteId,
    fechaHora,
  );
  return f ? aConsulta(f) : null;
}

/** Última consulta con peso registrado (para detectar cambios bruscos). */
export async function ultimaConsultaConPeso(db: SQLiteDatabase, pacienteId: string): Promise<Consulta | null> {
  const f = await db.getFirstAsync<FilaConsulta>(
    'SELECT * FROM consultas WHERE paciente_id = ? AND peso_kg IS NOT NULL ORDER BY fecha_hora DESC LIMIT 1',
    pacienteId,
  );
  return f ? aConsulta(f) : null;
}

export async function listarNotas(db: SQLiteDatabase, consultaId: string): Promise<NotaAclaratoria[]> {
  const filas = await db.getAllAsync<{ id: string; consulta_id: string; texto: string; creado_en: string }>(
    'SELECT * FROM notas_aclaratorias WHERE consulta_id = ? ORDER BY creado_en ASC',
    consultaId,
  );
  return filas.map((f) => ({ id: f.id, consultaId: f.consulta_id, texto: f.texto, creadoEn: f.creado_en }));
}

export async function agregarNota(db: SQLiteDatabase, consultaId: string, texto: string): Promise<void> {
  const limpio = texto.trim();
  if (!limpio) throw new Error('La nota está vacía.');
  const id = nuevoId();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO notas_aclaratorias (id, consulta_id, texto, creado_en) VALUES (?, ?, ?, ?)',
      id,
      consultaId,
      limpio,
      ahoraISO(),
    );
    await registrarBitacora(db, 'nota_aclaratoria', id, 'crear');
  });
}
