// Qué tablas se sincronizan entre equipos y cómo se identifica cada fila.
// El orden importa: primero las tablas que otras referencian (igual que en los respaldos).

export interface TablaSync {
  nombre: string;
  /** Columnas que identifican la fila en todos los equipos. */
  llave: string[];
  /** Filas que nunca cambian una vez creadas (consultas, notas, bitácora): si ya existe, se ignora. */
  inmutable?: boolean;
  /** Columnas que solo valen en este equipo y no se envían (por ejemplo, un número consecutivo local). */
  columnasLocales?: string[];
  /** Columna con la fecha del último cambio de la fila, si existe (para combinar datos de dos equipos). */
  columnasFecha?: string[];
}

export const TABLAS_SYNC: TablaSync[] = [
  { nombre: 'pacientes', llave: ['id'], columnasFecha: ['actualizado_en', 'creado_en'] },
  { nombre: 'historias_clinicas', llave: ['paciente_id'], columnasFecha: ['actualizado_en'] },
  { nombre: 'consultas', llave: ['id'], inmutable: true, columnasFecha: ['creado_en'] },
  { nombre: 'notas_aclaratorias', llave: ['id'], inmutable: true, columnasFecha: ['creado_en'] },
  { nombre: 'bitacora', llave: ['uid'], inmutable: true, columnasLocales: ['id'], columnasFecha: ['fecha'] },
  { nombre: 'configuracion', llave: ['clave'] },
  { nombre: 'bloqueos', llave: ['id'], columnasFecha: ['creado_en'] },
  { nombre: 'citas', llave: ['id'], columnasFecha: ['actualizado_en', 'creado_en'] },
  { nombre: 'mensajes_whatsapp', llave: ['id'], columnasFecha: ['creado_en'] },
  { nombre: 'controles_descartados', llave: ['paciente_id', 'clave'], columnasFecha: ['creado_en'] },
  // Versión 7 (caja). Siempre al final: el orden de las anteriores no cambia.
  { nombre: 'cobros', llave: ['id'], columnasFecha: ['actualizado_en', 'creado_en'] },
  { nombre: 'cierres', llave: ['dia'], columnasFecha: ['cerrado_en'] },
];

/** Ajustes que pertenecen a cada equipo y no se comparten (la fecha del último respaldo de ESTE equipo). */
export const CONFIGURACION_LOCAL = ['respaldo'];

export function tablaSync(nombre: string): TablaSync | undefined {
  return TABLAS_SYNC.find((t) => t.nombre === nombre);
}

export function ordenTabla(nombre: string): number {
  return TABLAS_SYNC.findIndex((t) => t.nombre === nombre);
}

/** Fecha y hora UTC con milisegundos, el mismo formato que Date.toISOString(). */
export const AHORA_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** Verdadero cuando la sincronización está activa y el cambio lo hizo la persona (no uno que llegó de otro equipo). */
const CAPTURAR = '(SELECT activo = 1 AND aplicando = 0 FROM sync_control WHERE id = 1)';

function anotar(t: TablaSync, fila: 'NEW' | 'OLD'): string {
  const llave = t.llave.map((c) => `${fila}."${c}"`).join(', ');
  return `INSERT OR REPLACE INTO sync_pendientes (tabla, clave, momento) VALUES ('${t.nombre}', json_array(${llave}), ${AHORA_SQL});`;
}

function condicionExtra(t: TablaSync, fila: 'NEW' | 'OLD'): string {
  if (t.nombre === 'configuracion') return ` AND ${fila}.clave NOT IN (${CONFIGURACION_LOCAL.map((c) => `'${c}'`).join(', ')})`;
  if (t.nombre === 'bitacora') return ` AND ${fila}.uid IS NOT NULL`;
  return '';
}

/**
 * Triggers que anotan en sync_pendientes cada fila creada, cambiada o borrada.
 * Así cualquier cambio queda registrado, venga de la pantalla que venga.
 * NO cambiar: forma parte de la migración 6. Tablas nuevas necesitan sus triggers en una migración nueva.
 */
export function sqlTriggersCaptura(tablas: TablaSync[]): string {
  return tablas
    .map((t) => {
      const n = t.nombre;
      // En la bitácora el identificador común (uid) se asigna justo después de insertar, así que se anota al asignarlo.
      const alCrear =
        n === 'bitacora'
          ? `CREATE TRIGGER sync_${n}_crear AFTER UPDATE OF uid ON ${n} WHEN ${CAPTURAR} AND OLD.uid IS NULL AND NEW.uid IS NOT NULL BEGIN ${anotar(t, 'NEW')} END;`
          : `CREATE TRIGGER sync_${n}_crear AFTER INSERT ON ${n} WHEN ${CAPTURAR}${condicionExtra(t, 'NEW')} BEGIN ${anotar(t, 'NEW')} END;`;
      const alCambiar =
        n === 'bitacora'
          ? ''
          : `CREATE TRIGGER sync_${n}_cambiar AFTER UPDATE ON ${n} WHEN ${CAPTURAR}${condicionExtra(t, 'NEW')} BEGIN ${anotar(t, 'NEW')} END;`;
      const alBorrar = `CREATE TRIGGER sync_${n}_borrar AFTER DELETE ON ${n} WHEN ${CAPTURAR}${condicionExtra(t, 'OLD')} BEGIN ${anotar(t, 'OLD')} END;`;
      return [alCrear, alCambiar, alBorrar].filter(Boolean).join('\n');
    })
    .join('\n');
}
