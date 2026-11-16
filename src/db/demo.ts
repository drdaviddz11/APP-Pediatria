// Pacientes FICTICIOS para probar la app. No representan personas reales.

import type { SQLiteDatabase } from 'expo-sqlite';
import { aISO, deDate } from '../domain/fechas';
import type { ConsultaEntrada, PacienteEntrada } from '../domain/types';
import { horariosDisponibles } from '../agenda/disponibilidad';
import { ahoraMomento, hoyISO, momento, sumarDias, sumarMinutos } from '../agenda/tiempo';
import { duracionDeTipo, esActiva, EstadoCita, TipoCita } from '../agenda/tipos';
import { bloqueosEntre, citasEntre, crearCita, leerConfiguracion } from './agenda';
import { crearConsulta } from './consultas';
import { crearPaciente, guardarHistoria, obtenerHistoria } from './pacientes';

/** Agenda una cita de prueba en el primer día con horario libre a partir de `desdeDias`. */
async function agendarDemo(
  db: SQLiteDatabase,
  pacienteId: string,
  desdeDias: number,
  tipo: TipoCita,
  estado: EstadoCita,
  motivo: string,
): Promise<void> {
  const config = await leerConfiguracion(db);
  const duracion = duracionDeTipo(config, tipo);
  for (let d = desdeDias; d < desdeDias + 14; d++) {
    const fecha = sumarDias(hoyISO(), d);
    const [citas, bloqueos] = await Promise.all([
      citasEntre(db, `${fecha}T00:00`, `${sumarDias(fecha, 1)}T00:00`),
      bloqueosEntre(db, `${fecha}T00:00`, `${sumarDias(fecha, 1)}T00:00`),
    ]);
    const libres = horariosDisponibles(fecha, duracion, config, [...citas.filter((c) => esActiva(c.estado)), ...bloqueos], ahoraMomento());
    if (libres.length === 0) continue;
    const inicio = momento(fecha, libres[Math.min(3, libres.length - 1)]);
    await crearCita(db, {
      pacienteId,
      nombreContacto: '',
      telefonoContacto: '',
      inicio,
      fin: sumarMinutos(inicio, duracion),
      tipo,
      estado,
      motivo,
      notas: 'Cita de demostración',
    });
    return;
  }
}

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
  sindromeDown: false,
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
    edema: false,
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

  const sofia = await crearPaciente(
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

  // Pacientes sin cita a quienes les toca control (para probar la lista de controles).
  const mateo = await crearPaciente(
    db,
    {
      ...BASE,
      numeroExpediente: `${prefijo}-4`,
      nombres: 'Mateo Prueba',
      apellidos: 'Ficticio Cuatro',
      fechaNacimiento: nacimientoHace(6),
      sexo: 'M',
      responsableNombre: 'Madre Ficticia Cuatro',
    },
    true,
  );
  await crearConsulta(db, mateo, consulta(60, {
    motivo: 'Control de niño sano',
    pesoKg: 6.4, tallaCm: 63.0, tipoMedicion: 'acostado', perimetroCefalicoCm: 41.0,
    diagnosticos: 'Lactante sano (ejemplo)',
  }));

  const valeria = await crearPaciente(
    db,
    {
      ...BASE,
      numeroExpediente: `${prefijo}-5`,
      nombres: 'Valeria Prueba',
      apellidos: 'Ficticia Cinco',
      fechaNacimiento: nacimientoHace(70),
      sexo: 'F',
      responsableNombre: 'Padre Ficticio Cinco',
      responsableParentesco: 'Padre',
    },
    true,
  );
  await crearConsulta(db, valeria, consulta(20, {
    motivo: 'Diarrea aguda',
    pesoKg: 20.1, tallaCm: 113.0, tipoMedicion: 'de_pie',
    diagnosticos: 'Gastroenteritis aguda (ejemplo)',
    fechaSeguimiento: aISO(deDate(haceDias(5))),
  }));

  // Citas de prueba (si no hay horario libre, simplemente no se crean).
  try {
    await agendarDemo(db, ana, 0, 'control', 'confirmada', 'Control de niño sano');
    await agendarDemo(db, luis, 1, 'control', 'pendiente', 'Revisión de infección respiratoria');
    await agendarDemo(db, sofia, 2, 'primera', 'solicitada', 'Valoración nutricional');
  } catch {
    // Las citas de prueba son opcionales.
  }
}
