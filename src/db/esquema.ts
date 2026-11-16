// Estructura de la base de datos local (SQLite en el teléfono).
// Cada versión nueva se agrega al final de MIGRACIONES; nunca se modifican las anteriores.

import type { SQLiteDatabase } from 'expo-sqlite';

const MIGRACIONES: string[] = [
  // Versión 1: expedientes, historia clínica, consultas, notas y bitácora
  `
  CREATE TABLE pacientes (
    id TEXT PRIMARY KEY NOT NULL,
    numero_expediente TEXT NOT NULL UNIQUE,
    nombres TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    fecha_nacimiento TEXT NOT NULL,
    sexo TEXT NOT NULL CHECK (sexo IN ('F', 'M')),
    semanas_gestacion INTEGER,
    responsable_nombre TEXT NOT NULL DEFAULT '',
    responsable_parentesco TEXT NOT NULL DEFAULT '',
    telefono_principal TEXT NOT NULL DEFAULT '',
    telefono_secundario TEXT NOT NULL DEFAULT '',
    whatsapp TEXT NOT NULL DEFAULT '',
    correo TEXT NOT NULL DEFAULT '',
    direccion TEXT NOT NULL DEFAULT '',
    emergencia_nombre TEXT NOT NULL DEFAULT '',
    emergencia_telefono TEXT NOT NULL DEFAULT '',
    consentimiento_datos INTEGER NOT NULL DEFAULT 0,
    consentimiento_whatsapp INTEGER NOT NULL DEFAULT 0,
    es_demo INTEGER NOT NULL DEFAULT 0,
    busqueda TEXT NOT NULL DEFAULT '',
    creado_en TEXT NOT NULL,
    actualizado_en TEXT NOT NULL
  );
  CREATE INDEX idx_pacientes_busqueda ON pacientes (busqueda);
  CREATE INDEX idx_pacientes_apellidos ON pacientes (apellidos, nombres);

  CREATE TABLE historias_clinicas (
    paciente_id TEXT PRIMARY KEY NOT NULL REFERENCES pacientes (id) ON DELETE CASCADE,
    antecedentes_personales TEXT NOT NULL DEFAULT '',
    antecedentes_familiares TEXT NOT NULL DEFAULT '',
    antecedentes_perinatales TEXT NOT NULL DEFAULT '',
    antecedentes_quirurgicos TEXT NOT NULL DEFAULT '',
    alergias TEXT NOT NULL DEFAULT '',
    medicamentos_actuales TEXT NOT NULL DEFAULT '',
    vacunas TEXT NOT NULL DEFAULT '',
    hospitalizaciones TEXT NOT NULL DEFAULT '',
    diagnosticos_previos TEXT NOT NULL DEFAULT '',
    actualizado_en TEXT
  );

  CREATE TABLE consultas (
    id TEXT PRIMARY KEY NOT NULL,
    paciente_id TEXT NOT NULL REFERENCES pacientes (id) ON DELETE CASCADE,
    fecha_hora TEXT NOT NULL,
    motivo TEXT NOT NULL DEFAULT '',
    enfermedad_actual TEXT NOT NULL DEFAULT '',
    sintomas TEXT NOT NULL DEFAULT '',
    exploracion_fisica TEXT NOT NULL DEFAULT '',
    temperatura_c REAL,
    frecuencia_cardiaca REAL,
    frecuencia_respiratoria REAL,
    saturacion_o2 REAL,
    presion_sistolica REAL,
    presion_diastolica REAL,
    peso_kg REAL,
    talla_cm REAL,
    tipo_medicion TEXT CHECK (tipo_medicion IN ('acostado', 'de_pie')),
    perimetro_cefalico_cm REAL,
    diagnosticos TEXT NOT NULL DEFAULT '',
    estudios_solicitados TEXT NOT NULL DEFAULT '',
    tratamiento TEXT NOT NULL DEFAULT '',
    indicaciones TEXT NOT NULL DEFAULT '',
    fecha_seguimiento TEXT,
    creado_en TEXT NOT NULL
  );
  CREATE INDEX idx_consultas_paciente ON consultas (paciente_id, fecha_hora);

  CREATE TABLE notas_aclaratorias (
    id TEXT PRIMARY KEY NOT NULL,
    consulta_id TEXT NOT NULL REFERENCES consultas (id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    creado_en TEXT NOT NULL
  );
  CREATE INDEX idx_notas_consulta ON notas_aclaratorias (consulta_id, creado_en);

  CREATE TABLE bitacora (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    entidad TEXT NOT NULL,
    entidad_id TEXT NOT NULL,
    accion TEXT NOT NULL,
    datos_anteriores TEXT
  );
  CREATE INDEX idx_bitacora_entidad ON bitacora (entidad, entidad_id);

  -- Las consultas guardadas no se pueden modificar: las correcciones se agregan como notas.
  CREATE TRIGGER consultas_sin_modificar BEFORE UPDATE ON consultas
  BEGIN
    SELECT RAISE(ABORT, 'Las consultas guardadas no se modifican; agregue una nota aclaratoria.');
  END;
  CREATE TRIGGER notas_sin_modificar BEFORE UPDATE ON notas_aclaratorias
  BEGIN
    SELECT RAISE(ABORT, 'Las notas aclaratorias no se modifican.');
  END;

  -- Solo se pueden borrar datos de pacientes ficticios de demostración.
  CREATE TRIGGER pacientes_reales_sin_borrar BEFORE DELETE ON pacientes
  WHEN OLD.es_demo = 0
  BEGIN
    SELECT RAISE(ABORT, 'Los expedientes reales no se eliminan desde la app.');
  END;
  `,

  // Versión 2: edema bilateral (la OMS no calcula indicadores de peso si hay edema)
  `
  ALTER TABLE consultas ADD COLUMN edema INTEGER NOT NULL DEFAULT 0;
  `,

  // Versión 3: síndrome de Down (usa las curvas de crecimiento específicas del CDC)
  `
  ALTER TABLE pacientes ADD COLUMN sindrome_down INTEGER NOT NULL DEFAULT 0;
  `,

  // Versión 4: agenda (citas, bloqueos de horario y configuración)
  // Las horas son hora local del consultorio, en texto "AAAA-MM-DDTHH:mm".
  `
  CREATE TABLE configuracion (
    clave TEXT PRIMARY KEY NOT NULL,
    valor TEXT NOT NULL
  );

  CREATE TABLE citas (
    id TEXT PRIMARY KEY NOT NULL,
    paciente_id TEXT REFERENCES pacientes (id) ON DELETE CASCADE,
    nombre_contacto TEXT NOT NULL DEFAULT '',
    telefono_contacto TEXT NOT NULL DEFAULT '',
    inicio TEXT NOT NULL,
    fin TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('primera', 'control')),
    estado TEXT NOT NULL CHECK (estado IN ('solicitada', 'pendiente', 'confirmada', 'presente', 'completada', 'cancelada', 'no_asistio')),
    motivo TEXT NOT NULL DEFAULT '',
    notas TEXT NOT NULL DEFAULT '',
    consulta_id TEXT REFERENCES consultas (id),
    creado_en TEXT NOT NULL,
    actualizado_en TEXT NOT NULL,
    CHECK (fin > inicio),
    CHECK (paciente_id IS NOT NULL OR nombre_contacto != '')
  );
  CREATE INDEX idx_citas_inicio ON citas (inicio);
  CREATE INDEX idx_citas_paciente ON citas (paciente_id, inicio);

  CREATE TABLE bloqueos (
    id TEXT PRIMARY KEY NOT NULL,
    inicio TEXT NOT NULL,
    fin TEXT NOT NULL,
    motivo TEXT NOT NULL DEFAULT '',
    creado_en TEXT NOT NULL,
    CHECK (fin > inicio)
  );
  CREATE INDEX idx_bloqueos_inicio ON bloqueos (inicio);

  -- Candados contra citas duplicadas: una cita activa no puede traslaparse con otra cita activa
  -- ni con un horario bloqueado. Las canceladas y las de "no asistió" liberan el horario.
  CREATE TRIGGER citas_sin_traslape_al_crear BEFORE INSERT ON citas
  WHEN NEW.estado NOT IN ('cancelada', 'no_asistio')
  BEGIN
    SELECT RAISE(ABORT, 'TRASLAPE: ya existe una cita en ese horario.')
    WHERE EXISTS (
      SELECT 1 FROM citas c
      WHERE c.estado NOT IN ('cancelada', 'no_asistio') AND c.inicio < NEW.fin AND c.fin > NEW.inicio
    );
    SELECT RAISE(ABORT, 'BLOQUEO: ese horario está bloqueado.')
    WHERE EXISTS (SELECT 1 FROM bloqueos b WHERE b.inicio < NEW.fin AND b.fin > NEW.inicio);
  END;

  CREATE TRIGGER citas_sin_traslape_al_cambiar BEFORE UPDATE ON citas
  WHEN NEW.estado NOT IN ('cancelada', 'no_asistio')
  BEGIN
    SELECT RAISE(ABORT, 'TRASLAPE: ya existe una cita en ese horario.')
    WHERE EXISTS (
      SELECT 1 FROM citas c
      WHERE c.id != NEW.id AND c.estado NOT IN ('cancelada', 'no_asistio') AND c.inicio < NEW.fin AND c.fin > NEW.inicio
    );
  END;

  CREATE TRIGGER citas_sin_bloqueo_al_mover BEFORE UPDATE ON citas
  WHEN NEW.estado NOT IN ('cancelada', 'no_asistio')
    AND (NEW.inicio != OLD.inicio OR NEW.fin != OLD.fin OR OLD.estado IN ('cancelada', 'no_asistio'))
  BEGIN
    SELECT RAISE(ABORT, 'BLOQUEO: ese horario está bloqueado.')
    WHERE EXISTS (SELECT 1 FROM bloqueos b WHERE b.inicio < NEW.fin AND b.fin > NEW.inicio);
  END;

  CREATE TRIGGER bloqueos_sin_citas BEFORE INSERT ON bloqueos
  BEGIN
    SELECT RAISE(ABORT, 'TRASLAPE: hay citas activas en ese horario.')
    WHERE EXISTS (
      SELECT 1 FROM citas c
      WHERE c.estado NOT IN ('cancelada', 'no_asistio') AND c.inicio < NEW.fin AND c.fin > NEW.inicio
    );
  END;
  `,

  // Versión 5: mensajes de WhatsApp abiertos desde la app y controles descartados
  // (no se guarda el texto de los mensajes, solo el tipo y la fecha).
  `
  CREATE TABLE mensajes_whatsapp (
    id TEXT PRIMARY KEY NOT NULL,
    paciente_id TEXT REFERENCES pacientes (id) ON DELETE CASCADE,
    cita_id TEXT REFERENCES citas (id) ON DELETE SET NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('recordatorio', 'propuesta', 'general')),
    telefono TEXT NOT NULL,
    creado_en TEXT NOT NULL
  );
  CREATE INDEX idx_mensajes_paciente ON mensajes_whatsapp (paciente_id, creado_en);
  CREATE INDEX idx_mensajes_cita ON mensajes_whatsapp (cita_id);

  CREATE TABLE controles_descartados (
    paciente_id TEXT NOT NULL REFERENCES pacientes (id) ON DELETE CASCADE,
    clave TEXT NOT NULL,
    creado_en TEXT NOT NULL,
    PRIMARY KEY (paciente_id, clave)
  );
  `,
];

export async function migrarBaseDeDatos(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = fila?.user_version ?? 0;

  while (version < MIGRACIONES.length) {
    const sql = MIGRACIONES[version];
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
    });
    version += 1;
    // PRAGMA no acepta parámetros; `version` es un número controlado por la app.
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}
