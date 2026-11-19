// Textos de las constancias médicas. El médico revisa y puede corregir el texto antes de guardarlo;
// lo que se guarda e imprime es el texto final.

import { calcularEdad, deDate, leerFechaISO } from '../domain/fechas';

export type TipoConstancia = 'atencion' | 'reposo' | 'buena_salud' | 'libre';

export const TIPOS_CONSTANCIA: { tipo: TipoConstancia; titulo: string; descripcion: string }[] = [
  { tipo: 'atencion', titulo: 'Atención médica', descripcion: 'Fue atendido(a) en la consulta tal día.' },
  { tipo: 'reposo', titulo: 'Reposo / incapacidad', descripcion: 'Atención + días de reposo, del … al …' },
  { tipo: 'buena_salud', titulo: 'Buena salud', descripcion: 'En buen estado de salud, apto(a) para actividades.' },
  { tipo: 'libre', titulo: 'Texto libre', descripcion: 'Usted escribe todo el texto.' },
];

export function tituloTipo(tipo: string): string {
  return TIPOS_CONSTANCIA.find((t) => t.tipo === tipo)?.titulo ?? 'Constancia';
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "19 de noviembre de 2026" */
export function fechaEnTexto(d: Date): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** Último día del reposo: 3 días desde el 19 → hasta el 21 (inclusive). */
export function finDeReposo(desde: Date, dias: number): Date {
  const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  d.setDate(d.getDate() + Math.max(1, Math.round(dias)) - 1);
  return d;
}

/** Edad como va en una constancia: "15 días", "8 meses", "3 años". */
export function edadParaConstancia(nacimientoISO: string, referencia: Date): string {
  const n = leerFechaISO(nacimientoISO);
  const e = n ? calcularEdad(n, deDate(referencia)) : null;
  if (!e) return '';
  if (e.totalMeses < 1) return `${e.totalDias} ${e.totalDias === 1 ? 'día' : 'días'}`;
  if (e.anios < 2) return `${e.totalMeses} ${e.totalMeses === 1 ? 'mes' : 'meses'}`;
  return `${e.anios} años`;
}

export interface DatosPlantilla {
  nombre: string;
  sexo: 'F' | 'M';
  /** Texto de la edad ("3 años"); vacío si no se conoce. */
  edad: string;
  /** Día de la consulta o evaluación. */
  fechaAtencion: Date;
  /** Reposo: días y fecha de inicio. */
  diasReposo?: number;
  inicioReposo?: Date;
  /** Buena salud: para qué actividades (por defecto, escolares y deportivas). */
  actividades?: string;
}

const CIERRE = 'Se extiende la presente a solicitud de la parte interesada, para los fines que estime convenientes.';

export function textoConstancia(tipo: TipoConstancia, d: DatosPlantilla): string {
  if (tipo === 'libre') return '';
  const f = d.sexo === 'F';
  const o = f ? 'a' : 'o';
  const quien = `${f ? 'la' : 'el'} paciente ${d.nombre.trim()}${d.edad ? `, de ${d.edad} de edad` : ''}`;
  const dia = fechaEnTexto(d.fechaAtencion);
  if (tipo === 'atencion') {
    return `Por medio de la presente hago constar que ${quien}, fue atendid${o} en mi consulta de Pediatría el día ${dia}.\n\n${CIERRE}`;
  }
  if (tipo === 'reposo') {
    const dias = Math.max(1, Math.round(d.diasReposo ?? 1));
    const inicio = d.inicioReposo ?? d.fechaAtencion;
    const fin = finDeReposo(inicio, dias);
    const periodo =
      dias === 1 ? `el día ${fechaEnTexto(inicio)}` : `del ${fechaEnTexto(inicio)} al ${fechaEnTexto(fin)}, inclusive`;
    return (
      `Por medio de la presente hago constar que ${quien}, fue atendid${o} en mi consulta de Pediatría el día ${dia}, ` +
      `y por su condición de salud amerita reposo en casa por ${dias} ${dias === 1 ? 'día' : 'días'}, ${periodo}.\n\n${CIERRE}`
    );
  }
  const actividades = (d.actividades ?? '').trim() || 'escolares y deportivas';
  return (
    `Por medio de la presente hago constar que ${quien}, fue evaluad${o} en mi consulta de Pediatría el día ${dia}, ` +
    `encontrándose en buen estado de salud y apt${o} para realizar actividades ${actividades}.\n\n${CIERRE}`
  );
}

/** Diagnósticos sugeridos: los de la consulta (uno por renglón) o, para buena salud, "Niño sano". */
export function diagnosticosSugeridos(tipo: TipoConstancia, diagnosticosConsulta: string, sexo: 'F' | 'M'): string[] {
  const deConsulta = diagnosticosConsulta
    .split(/\r?\n|;/)
    .map((t) => t.replace(/^\s*(\d+[.)-]|[-•*])\s*/, '').trim())
    .filter(Boolean);
  if (tipo === 'buena_salud') return [sexo === 'F' ? 'Niña sana' : 'Niño sano'];
  return deConsulta;
}

export const LARGO_MAXIMO_TEXTO = 1400;
export const MAXIMO_DIAGNOSTICOS = 8;
export const LARGO_MAXIMO_DIAGNOSTICO = 160;
export const DIAS_REPOSO_MAXIMO = 60;

export function limpiarDiagnosticos(lista: string[]): string[] {
  return lista.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

export function validarConstancia(texto: string, diagnosticos: string[]): string | null {
  const t = texto.trim();
  if (!t) return 'Escriba el texto de la constancia.';
  if (t.length > LARGO_MAXIMO_TEXTO) return `El texto es demasiado largo (máximo ${LARGO_MAXIMO_TEXTO} caracteres) para que quepa en la hoja.`;
  const dx = limpiarDiagnosticos(diagnosticos);
  if (dx.length === 0) return 'Escriba al menos un diagnóstico.';
  if (dx.length > MAXIMO_DIAGNOSTICOS) return `Una constancia admite hasta ${MAXIMO_DIAGNOSTICOS} diagnósticos.`;
  const largo = dx.findIndex((d) => d.length > LARGO_MAXIMO_DIAGNOSTICO);
  if (largo >= 0) return `El diagnóstico ${largo + 1} es demasiado largo (máximo ${LARGO_MAXIMO_DIAGNOSTICO} caracteres).`;
  return null;
}

/** Folio impreso en la constancia (los primeros 8 caracteres del identificador), para poder verificarla en el expediente. */
export function folioConstancia(id: string): string {
  return `C-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
