// Pacientes FICTICIOS para probar la app. No representan personas reales.

import type { SQLiteDatabase } from 'expo-sqlite';
import { aISO, deDate } from '../domain/fechas';
import type { ConsultaEntrada, PacienteEntrada } from '../domain/types';
import { crearConsulta } from './consultas';
import { crearPaciente, guardarHistoria, obtenerHistoria } from './pacientes';

function haceDias(dias: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(9, 30, 0, 0);
  return d;
}

function nacimientoHace(meses: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - meses);
  return aISO(deDate(d));
}

const BASE: Omit<PacienteEntrada, 'numeroExpediente' | 'nombres' | 'apellidos' | 'fechaNacimiento' | 'sexo'> = {
  semanasGestacion: null,
  responsableNombre: '',
  responsableParentesco: 'Madre',
  telefonoPrincipal: '504 0000-0000',
  telefonoSecundario: '',
  whatsapp: '504 0000-0000',
  correo: '',
  direccion: 'Dirección de prueba',
  emergenciaNombre: '',
  emergenciaTelefono: '',
  consentimientoDatos: true,
  consentimientoWhatsapp: true,
};

function consulta(diasAtras: number, datos: Partial<ConsultaEntrada>): ConsultaEntrada {
  return {
    fechaHora: haceDias(diasAtras).toISOString(),
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
    pesoKg: null,
    tallaCm: null,
    tipoMedicion: null,
    perimetroCefalicoCm: null,
    diagnosticos: '',
    estudiosSolicitados: '',
    tratamiento: '',
    indicaciones: '',
    fechaSeguimiento: null,
    ...datos,
  };
}

export async function cargarPacientesDemo(db: SQLiteDatabase): Promise<void> {
  const prefijo = `DEMO-${Date.now().toString().slice(-4)}`;

  const ana = await crearPaciente(
    db,
    {
      ...BASE,
      numeroExpediente: `${prefijo}-1`,
      nombres: 'Ana Prueba',
      apellidos: 'Ficticia Uno',
      fechaNacimiento: nacimientoHace(8),
      sexo: 'F',
      semanasGestacion: 34,
      responsableNombre: 'Madre Ficticia Uno',
    },
    true,
  );
  await guardarHistoria(db, ana, {
    ...(await obtenerHistoria(db, ana)),
    antecedentesPerinatales: 'Nacimiento a las 34 semanas (dato ficticio).',
    alergias: 'Ninguna conocida',
    vacunas: 'Esquema al día según cartilla (dato ficticio).',
  });
  await crearConsulta(db, ana, consulta(120, {
    motivo: 'Control de niño sano',
    pesoKg: 5.6, tallaCm: 59.5, tipoMedicion: 'acostado', perimetroCefalicoCm: 39.5,
    temperaturaC: 36.7, frecuenciaCardiaca: 138, frecuenciaRespiratoria: 40,
    diagnosticos: 'Lactante sano (ejemplo)',
    indicaciones: 'Lactancia materna exclusiva (ejemplo).',
  }));
  await crearConsulta(db, ana, consulta(30, {
    motivo: 'Control de niño sano',
    pesoKg: 7.1, tallaCm: 65.0, tipoMedicion: 'acostado', perimetroCefalicoCm: 42.0,
    temperaturaC: 36.6, frecuenciaCardiaca: 130, frecuenciaRespiratoria: 36,
    diagnosticos: 'Lactante sano (ejemplo)',
    indicaciones: 'Inicio de alimentación complementaria (ejemplo).',
  }));

  const luis = await crearPaciente(
    db,
    {
      ...BASE,
      numeroExpediente: `${prefijo}-2`,
      nombres: 'Luis Prueba',
      apellidos: 'Ficticio Dos',
      fechaNacimiento: nacimientoHace(46),
      sexo: 'M',
      responsableNombre: 'Padre Ficticio Dos',
      responsableParentesco: 'Padre',
    },
    true,
  );
  await guardarHistoria(db, luis, {
    ...(await obtenerHistoria(db, luis)),
    alergias: 'Amoxicilina (dato ficticio)',
    antecedentesPersonales: 'Asma leve intermitente (dato ficticio).',
  });
  await crearConsulta(db, luis, consulta(10, {
    motivo: 'Tos y fiebre de 2 días',
    sintomas: 'Tos, rinorrea, fiebre 38.5 °C',
    pesoKg: 15.8, tallaCm: 101.0, tipoMedicion: 'de_pie',
    temperaturaC: 38.2, frecuenciaCardiaca: 118, frecuenciaRespiratoria: 28, saturacionO2: 97,
    diagnosticos: 'Infección respiratoria alta (ejemplo)',
    tratamiento: 'Tratamiento sintomático (ejemplo).',
    fechaSeguimiento: aISO(deDate(haceDias(-3))),
  }));

  await crearPaciente(
    db,
    {
      ...BASE,
      numeroExpediente: `${prefijo}-3`,
      nombres: 'Sofía Prueba',
      apellidos: 'Ficticia Tres',
      fechaNacimiento: nacimientoHace(120),
      sexo: 'F',
      responsableNombre: 'Abuela Ficticia Tres',
      responsableParentesco: 'Abuela',
    },
    true,
  );
}
