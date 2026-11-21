// Cumpleaños de los pacientes: quién cumple hoy y en los próximos días, y cuántos años cumple.
// Los nacidos un 29 de febrero celebran el 28 de febrero en los años que no son bisiestos.

/** Hasta qué edad se felicita (consulta pediátrica). */
export const EDAD_MAXIMA_FELICITAR = 18;

function bisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

function dos(n: number): string {
  return String(n).padStart(2, '0');
}

/** Fecha (AAAA-MM-DD) del cumpleaños en ese año. */
export function cumpleanosEnAnio(fechaNacimiento: string, anio: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaNacimiento);
  if (!m) return null;
  let mes = Number(m[2]);
  let dia = Number(m[3]);
  if (mes === 2 && dia === 29 && !bisiesto(anio)) dia = 28;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return `${anio}-${dos(mes)}-${dos(dia)}`;
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export interface Cumpleanos {
  /** Fecha del cumpleaños (AAAA-MM-DD). */
  fecha: string;
  /** Años que cumple. */
  edad: number;
  /** 0 = hoy, 1 = mañana… */
  enDias: number;
}

/** Próximo cumpleaños desde hoy (incluido), si cae dentro de los próximos `dias` días y cumple de 1 a 18 años. */
export function proximoCumpleanos(fechaNacimiento: string, hoy: string, dias: number): Cumpleanos | null {
  const anioNac = Number(fechaNacimiento.slice(0, 4));
  const anioHoy = Number(hoy.slice(0, 4));
  const limite = sumarDias(hoy, dias);
  for (const anio of [anioHoy, anioHoy + 1]) {
    const fecha = cumpleanosEnAnio(fechaNacimiento, anio);
    if (!fecha || fecha < hoy) continue;
    if (fecha > limite) return null;
    const edad = anio - anioNac;
    if (edad < 1 || edad > EDAD_MAXIMA_FELICITAR) return null;
    const enDias = Math.round((Date.parse(`${fecha}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86400000);
    return { fecha, edad, enDias };
  }
  return null;
}

/** "1 año", "5 años" */
export function textoEdadCumple(edad: number): string {
  return `${edad} ${edad === 1 ? 'año' : 'años'}`;
}
