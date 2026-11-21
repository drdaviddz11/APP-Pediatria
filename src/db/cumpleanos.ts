// Cumpleaños de los pacientes y felicitaciones enviadas (una por paciente y año).

import type { SQLiteDatabase } from 'expo-sqlite';
import { Cumpleanos, proximoCumpleanos } from '../seguimiento/cumpleanos';
import { ahoraISO } from './util';

export interface CumpleanosPaciente extends Cumpleanos {
  pacienteId: string;
  nombres: string;
  apellidos: string;
  sexo: 'F' | 'M';
  whatsapp: string;
  telefonoPrincipal: string;
  consentimientoWhatsapp: boolean;
  /** Ya se le felicitó este año (fecha y hora), o null. */
  felicitado: string | null;
}

interface Fila {
  id: string;
  nombres: string;
  apellidos: string;
  sexo: 'F' | 'M';
  fecha_nacimiento: string;
  whatsapp: string;
  telefono_principal: string;
  consentimiento_whatsapp: number;
}

/** Pacientes que cumplen años de hoy a `dias` días (ordenados por fecha y nombre). */
export async function cumpleanosProximos(db: SQLiteDatabase, hoy: string, dias = 7): Promise<CumpleanosPaciente[]> {
  const filas = await db.getAllAsync<Fila>(
    `SELECT id, nombres, apellidos, sexo, fecha_nacimiento, whatsapp, telefono_principal, consentimiento_whatsapp
     FROM pacientes`,
  );
  const lista: CumpleanosPaciente[] = [];
  for (const f of filas) {
    const c = proximoCumpleanos(f.fecha_nacimiento, hoy, dias);
    if (!c) continue;
    lista.push({
      ...c,
      pacienteId: f.id,
      nombres: f.nombres,
      apellidos: f.apellidos,
      sexo: f.sexo,
      whatsapp: f.whatsapp,
      telefonoPrincipal: f.telefono_principal,
      consentimientoWhatsapp: f.consentimiento_whatsapp === 1,
      felicitado: null,
    });
  }
  if (lista.length > 0) {
    const felicitaciones = await db.getAllAsync<{ paciente_id: string; anio: number; creado_en: string }>(
      `SELECT paciente_id, anio, creado_en FROM felicitaciones WHERE anio IN (?, ?)`,
      Number(hoy.slice(0, 4)),
      Number(hoy.slice(0, 4)) + 1,
    );
    const mapa = new Map(felicitaciones.map((x) => [`${x.paciente_id}|${x.anio}`, x.creado_en]));
    for (const c of lista) c.felicitado = mapa.get(`${c.pacienteId}|${c.fecha.slice(0, 4)}`) ?? null;
  }
  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha) || `${a.nombres} ${a.apellidos}`.localeCompare(`${b.nombres} ${b.apellidos}`, 'es'));
}

/** Anota que se abrió la felicitación de ese año (si se repite, se conserva la primera). */
export async function registrarFelicitacion(db: SQLiteDatabase, pacienteId: string, anio: number, telefono: string): Promise<void> {
  await db.runAsync(
    'INSERT OR IGNORE INTO felicitaciones (paciente_id, anio, telefono, creado_en) VALUES (?, ?, ?, ?)',
    pacienteId,
    anio,
    telefono,
    ahoraISO(),
  );
}

/** Para el panel principal: cuántos cumplen hoy y a cuántos falta felicitar. */
export async function resumenCumpleanosHoy(db: SQLiteDatabase, hoy: string): Promise<{ hoy: number; porFelicitar: number }> {
  const deHoy = (await cumpleanosProximos(db, hoy, 0)).filter((c) => c.enDias === 0);
  return { hoy: deHoy.length, porFelicitar: deHoy.filter((c) => !c.felicitado).length };
}
