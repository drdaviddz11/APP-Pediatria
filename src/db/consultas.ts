// Acceso a datos de consultas (visitas). Una visita se puede corregir solo el mismo día en que se hizo;
// después, para corregir o completar información se agregan notas aclaratorias con su fecha.

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
  texto?: string;
  creado_en: string;
  actualizado_en?: string | null;
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
    texto: f.texto ?? '',
    creadoEn: f.creado_en,
    actualizadoEn: f.actualizado_en ?? null,
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
        diagnosticos, estudios_solicitados, tratamiento, indicaciones, fecha_seguimiento, texto, creado_en
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      (c.texto ?? '').replace(/\r/g, '').trim(),
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

// ---------------------------------------------------------------------------
// Expediente como documento: visitas con texto libre, peso y talla
// ---------------------------------------------------------------------------

export interface VisitaEntrada {
  texto: string;
  pesoKg: number | null;
  tallaCm: number | null;
  perimetroCefalicoCm: number | null;
  /** Cita de control (AAAA-MM-DD): con ella la app recuerda que al paciente le toca control. */
  fechaSeguimiento?: string | null;
}

/** La OMS mide acostado antes de los 24 meses y de pie después. */
export function tipoMedicionPorEdad(edadMeses: number | null): 'acostado' | 'de_pie' {
  return edadMeses != null && edadMeses < 24 ? 'acostado' : 'de_pie';
}

/** ¿Se puede corregir todavía? Solo el mismo día (calendario local) en que se creó. */
export function puedeCorregirVisita(creadoEn: string, ahora = new Date()): boolean {
  const c = new Date(creadoEn);
  return c.getFullYear() === ahora.getFullYear() && c.getMonth() === ahora.getMonth() && c.getDate() === ahora.getDate();
}

function visitaVacia(v: VisitaEntrada): boolean {
  return !v.texto.trim() && v.pesoKg == null && v.tallaCm == null && v.perimetroCefalicoCm == null;
}

/** Nueva visita del expediente-documento. */
export async function crearVisita(
  db: SQLiteDatabase,
  pacienteId: string,
  v: VisitaEntrada,
  opciones: { edadMeses: number | null; fechaHora?: string },
): Promise<string> {
  if (visitaVacia(v)) throw new Error('Escriba algo de la visita o el peso o la talla.');
  return crearConsulta(db, pacienteId, {
    fechaHora: opciones.fechaHora ?? ahoraISO(),
    motivo: '',
    enfermedadActual: '',
    sintomas: '',
    exploracionFisica: '',
    temperaturaC: null,
    frecuenciaCardiaca: null,
    frecuenciaRespiratoria: null,
    saturacionO2: null,
    presionSistolica: null,
    presionDiastolica: null,
    pesoKg: v.pesoKg,
    tallaCm: v.tallaCm,
    tipoMedicion: v.tallaCm != null ? tipoMedicionPorEdad(opciones.edadMeses) : null,
    perimetroCefalicoCm: v.perimetroCefalicoCm,
    edema: false,
    diagnosticos: '',
    estudiosSolicitados: '',
    tratamiento: '',
    indicaciones: '',
    fechaSeguimiento: v.fechaSeguimiento ?? null,
    texto: v.texto,
  });
}

/** Corrige una visita del mismo día (texto, peso, talla, perímetro, cita de control). Guarda la versión anterior en la bitácora. */
export async function corregirVisita(db: SQLiteDatabase, id: string, v: VisitaEntrada, opciones: { edadMeses: number | null }, ahora = new Date()): Promise<void> {
  const anterior = await obtenerConsulta(db, id);
  if (!anterior) throw new Error('La visita no existe.');
  if (!puedeCorregirVisita(anterior.creadoEn, ahora)) throw new Error('Solo se puede corregir una visita el mismo día; después agregue una nota aclaratoria.');
  if (visitaVacia(v) && !anterior.motivo && !anterior.diagnosticos) throw new Error('La visita no puede quedar vacía.');
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE consultas SET texto = ?, peso_kg = ?, talla_cm = ?, tipo_medicion = ?, perimetro_cefalico_cm = ?, fecha_seguimiento = ?, actualizado_en = ? WHERE id = ?',
      v.texto.replace(/\r/g, '').trim(),
      v.pesoKg,
      v.tallaCm,
      v.tallaCm != null ? anterior.tipoMedicion ?? tipoMedicionPorEdad(opciones.edadMeses) : null,
      v.perimetroCefalicoCm,
      v.fechaSeguimiento === undefined ? anterior.fechaSeguimiento : v.fechaSeguimiento,
      ahoraISO(),
      id,
    );
    await registrarBitacora(db, 'consulta', id, 'modificar', anterior);
  });
}
