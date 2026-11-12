// Tipos de datos del expediente clínico.
// Todas las fechas se guardan como texto ISO:
//   - Fechas sin hora: "AAAA-MM-DD" (por ejemplo, fecha de nacimiento).
//   - Fechas con hora: "AAAA-MM-DDTHH:mm:ss.sssZ".

/** Sexo registrado para elegir las referencias de crecimiento (OMS/CDC). */
export type SexoReferencia = 'F' | 'M';

export type TipoMedicion = 'acostado' | 'de_pie';

export interface Paciente {
  id: string;
  numeroExpediente: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string; // AAAA-MM-DD
  sexo: SexoReferencia;
  semanasGestacion: number | null; // edad gestacional al nacer, para edad corregida
  responsableNombre: string;
  responsableParentesco: string;
  telefonoPrincipal: string;
  telefonoSecundario: string;
  whatsapp: string;
  correo: string;
  direccion: string;
  emergenciaNombre: string;
  emergenciaTelefono: string;
  consentimientoDatos: boolean; // autorización para el manejo de datos clínicos
  consentimientoWhatsapp: boolean; // autorización para recibir mensajes administrativos
  esDemo: boolean; // true = paciente ficticio de demostración
  creadoEn: string;
  actualizadoEn: string;
}

/** Datos que el usuario llena en el formulario (el resto lo genera la app). */
export type PacienteEntrada = Omit<Paciente, 'id' | 'creadoEn' | 'actualizadoEn' | 'esDemo'>;

export interface HistoriaClinica {
  pacienteId: string;
  antecedentesPersonales: string;
  antecedentesFamiliares: string;
  antecedentesPerinatales: string;
  antecedentesQuirurgicos: string;
  alergias: string;
  medicamentosActuales: string;
  vacunas: string;
  hospitalizaciones: string;
  diagnosticosPrevios: string;
  actualizadoEn: string | null;
}

export type HistoriaClinicaEntrada = Omit<HistoriaClinica, 'pacienteId' | 'actualizadoEn'>;

export interface SignosVitales {
  temperaturaC: number | null;
  frecuenciaCardiaca: number | null;
  frecuenciaRespiratoria: number | null;
  saturacionO2: number | null;
  presionSistolica: number | null;
  presionDiastolica: number | null;
}

export interface Consulta extends SignosVitales {
  id: string;
  pacienteId: string;
  fechaHora: string; // ISO con hora
  motivo: string;
  enfermedadActual: string;
  sintomas: string;
  exploracionFisica: string;
  pesoKg: number | null;
  tallaCm: number | null;
  tipoMedicion: TipoMedicion | null;
  perimetroCefalicoCm: number | null;
  edema: boolean; // edema bilateral con fóvea
  diagnosticos: string;
  estudiosSolicitados: string;
  tratamiento: string;
  indicaciones: string;
  fechaSeguimiento: string | null; // AAAA-MM-DD
  creadoEn: string;
}

export type ConsultaEntrada = Omit<Consulta, 'id' | 'pacienteId' | 'creadoEn'>;

/** Nota agregada a una consulta ya guardada (las consultas no se editan). */
export interface NotaAclaratoria {
  id: string;
  consultaId: string;
  texto: string;
  creadoEn: string;
}
