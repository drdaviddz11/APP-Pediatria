// Hoja de la receta: el formato del Dr. Díaz (media carta horizontal, 8.5 × 5.5 pulgadas) con el nombre,
// la fecha y las indicaciones escritos en los mismos lugares que en su plantilla de Word.
// Se imprime en la MITAD DE ARRIBA de una hoja carta (8.5 × 11), el papel normal de cualquier impresora;
// la mitad de abajo queda en blanco.
// Sirve igual para imprimir desde el teléfono (expo-print) y desde la computadora (navegador).

/** Posiciones medidas sobre la imagen de la plantilla (1753 × 1115 px), en % de la imagen. */
/** Cuánto queda el texto sobre la línea de Nombre/Fecha, en % del alto: negativo = la base de las letras casi toca la línea. */
export const SOBRE_LINEA = -0.9;

export const POS = {
  nombre: { izq: 15.8, der: 71.3, base: 22.0 },
  /** El peso va al final del renglón del nombre. */
  peso: { ancho: 13.5 },
  fecha: { izq: 76.6, der: 98.5, base: 22.0 },
  indicaciones: { izq: 13.6, der: 93.0, arriba: 27.0, abajo: 88.5 },
};

/** Hoja: media carta horizontal; la imagen ocupa el 96 % para no quedar en la orilla que la impresora no alcanza. */
export const HOJA = { ancho: 8.5, alto: 5.5, imgAncho: 8.16 };
export const IMG_ALTO = HOJA.imgAncho * (1115 / 1753);
/** Papel donde se imprime: carta vertical; la receta ocupa la mitad de arriba. */
export const PAPEL = { ancho: 8.5, alto: 11 };


/** Nombre como va en la receta: nombres y apellidos. */
export function nombreEnReceta(p: { nombres: string; apellidos: string }): string {
  return `${p.nombres} ${p.apellidos}`.replace(/\s+/g, ' ').trim();
}

/** Fecha corta, para que quepa en su línea: "17/11/2026". */
export function fechaReceta(d: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function escapar(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Indicaciones sin renglones vacíos al inicio o al final, y sin indicaciones vacías. */
export function limpiarIndicaciones(lista: string[]): string[] {
  return lista.map((t) => t.replace(/\r/g, '').replace(/^\s*\n|\n\s*$/g, '').trimEnd()).filter((t) => t.trim().length > 0);
}

const TAMANOS = [13, 12, 11, 10, 9];
const MINIMO = 9;

/** Alto estimado (pt) de las indicaciones con ese tamaño de letra. Estimación conservadora (ancho medio de carácter 0.58). */
function altoEstimado(indicaciones: string[], pt: number): number {
  const anchoPt = ((POS.indicaciones.der - POS.indicaciones.izq) / 100) * HOJA.imgAncho * 72 - 26; // menos la numeración
  const porRenglon = Math.max(10, Math.floor(anchoPt / (pt * 0.58)));
  let renglones = 0;
  for (const ind of indicaciones) {
    for (const linea of ind.split('\n')) {
      // Se cortan palabras completas: se estima por palabras para no quedarse corto.
      let usado = 0;
      let lineas = 1;
      for (const palabra of linea.split(' ')) {
        const largo = palabra.length + (usado > 0 ? 1 : 0);
        if (usado + largo > porRenglon && usado > 0) {
          lineas++;
          usado = palabra.length;
        } else usado += largo;
        while (usado > porRenglon) {
          lineas++;
          usado -= porRenglon;
        }
      }
      renglones += lineas;
    }
  }
  return renglones * pt * 1.3 + Math.max(0, indicaciones.length - 1) * pt * 0.45;
}

const ALTO_DISPONIBLE_PT = ((POS.indicaciones.abajo - POS.indicaciones.arriba) / 100) * IMG_ALTO * 72 * 0.95;

/** El tamaño de letra más grande (13 a 9 pt) con el que caben las indicaciones en una hoja. */
export function tamanoLetra(indicaciones: string[]): { puntos: number; cabe: boolean } {
  for (const pt of TAMANOS) if (altoEstimado(indicaciones, pt) <= ALTO_DISPONIBLE_PT) return { puntos: pt, cabe: true };
  return { puntos: MINIMO, cabe: false };
}

/**
 * Reparte las indicaciones en hojas (cada hoja con el formato completo) para que ninguna quede cortada.
 * Una indicación nunca se parte entre dos hojas.
 */
export function paginar(indicaciones: string[]): string[][] {
  const hojas: string[][] = [];
  let actual: string[] = [];
  for (const ind of indicaciones) {
    if (actual.length > 0 && !tamanoLetra([...actual, ind]).cabe) {
      hojas.push(actual);
      actual = [];
    }
    actual.push(ind);
  }
  if (actual.length > 0) hojas.push(actual);
  return hojas;
}

/** Límite de una indicación (cabe sola en una hoja con letra de 9 pt). */
export const LARGO_MAXIMO_INDICACION = 900;

/** 12.5 → "12.5 kg"; 12 → "12 kg"; 3.255 → "3.26 kg" */
export function textoPeso(kg: number): string {
  const factor = kg < 10 ? 100 : 10;
  return `${Math.round(kg * factor + 1e-9) / factor} kg`;
}

export interface DatosReceta {
  nombre: string;
  /** Peso en kg; si no hay, no se imprime. */
  pesoKg?: number | null;
  fecha: Date;
  indicaciones: string[];
  /** data: URI de la imagen de fondo (FONDO_RECETA). */
  fondo: string;
}

/** Documento HTML completo de una página, listo para imprimir. */
export function htmlReceta(d: DatosReceta): string {
  const indicaciones = limpiarIndicaciones(d.indicaciones);
  const hojas = paginar(indicaciones);
  if (hojas.length === 0) hojas.push([]);
  const pctX = (v: number) => `${v}%`;
  const conPeso = d.pesoKg != null;
  const largoNombre = conPeso ? d.nombre.length * 1.3 : d.nombre.length; // con el peso, hay menos espacio
  const letraNombre = largoNombre <= 40 ? 13 : largoNombre <= 55 ? 11 : 9.5;
  const peso = conPeso ? `<div class="campo peso">Peso: ${escapar(textoPeso(d.pesoKg as number))}</div>` : '';
  let numero = 1;
  const paginas = hojas
    .map((lista, i) => {
      const { puntos } = tamanoLetra(lista);
      const items = lista.map((t) => `<li>${escapar(t)}</li>`).join('');
      const html = `<div class="pagina"><div class="hoja">
  <img src="${d.fondo}" alt="">
  <div class="campo nombre${conPeso ? ' corto' : ''}">${escapar(d.nombre)}</div>${peso}
  <div class="campo fecha">${escapar(fechaReceta(d.fecha))}</div>
  <ol start="${numero}" style="font-size:${puntos}pt">${items.replace(/<li>/g, `<li style="margin-bottom:${puntos * 0.45}pt">`)}</ol>
  ${hojas.length > 1 ? `<div class="campo pie">Hoja ${i + 1} de ${hojas.length}</div>` : ''}
</div></div>`;
      numero += lista.length;
      return html;
    })
    .join('\n');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Receta</title>
<style>
  @page { size: ${PAPEL.ancho}in ${PAPEL.alto}in; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .pagina { width: ${PAPEL.ancho}in; height: ${PAPEL.alto}in; position: relative; overflow: hidden; }
  .hoja { position: absolute; left: ${(HOJA.ancho - HOJA.imgAncho) / 2}in; top: ${(HOJA.alto - IMG_ALTO) / 2}in;
          width: ${HOJA.imgAncho}in; height: ${IMG_ALTO}in; }
  .hoja img { position: absolute; inset: 0; width: 100%; height: 100%; }
  .campo { position: absolute; font-family: Helvetica, Arial, sans-serif; color: #14232E; white-space: nowrap; overflow: hidden;
           text-overflow: ellipsis; line-height: 1; }
  .nombre { left: ${pctX(POS.nombre.izq)}; width: ${pctX(POS.nombre.der - POS.nombre.izq)}; bottom: ${pctX(100 - POS.nombre.base + SOBRE_LINEA)};
            font-size: ${letraNombre}pt; }
  .nombre.corto { width: ${pctX(POS.nombre.der - POS.nombre.izq - POS.peso.ancho)}; }
  .peso { left: ${pctX(POS.nombre.der - POS.peso.ancho)}; width: ${pctX(POS.peso.ancho)}; bottom: ${pctX(100 - POS.nombre.base + SOBRE_LINEA)};
          font-size: 11pt; text-align: right; padding-right: 4pt; }
  .fecha { left: ${pctX(POS.fecha.izq)}; width: ${pctX(POS.fecha.der - POS.fecha.izq)}; bottom: ${pctX(100 - POS.fecha.base + SOBRE_LINEA)};
           font-size: 12pt; text-align: left; overflow: visible; padding-left: 5pt; }
  .pie { left: ${pctX(POS.indicaciones.izq)}; bottom: 2.5%; font-size: 8pt; color: #5A6B78; }
  ol { position: absolute; margin: 0; padding: 0 0 0 22pt; left: ${pctX(POS.indicaciones.izq)}; width: ${pctX(POS.indicaciones.der - POS.indicaciones.izq)};
       top: ${pctX(POS.indicaciones.arriba)}; height: ${pctX(POS.indicaciones.abajo - POS.indicaciones.arriba)}; overflow: hidden;
       font-family: Helvetica, Arial, sans-serif; line-height: 1.3; color: #14232E; }
  li { white-space: pre-wrap; padding-left: 2pt; overflow-wrap: anywhere; }
  .pagina + .pagina { page-break-before: always; break-before: page; }
</style></head>
<body>${paginas}</body></html>`;
}

/** Tamaño del papel en puntos (72 por pulgada), para expo-print: carta vertical. */
export const TAMANO_HOJA_PT = { ancho: PAPEL.ancho * 72, alto: PAPEL.alto * 72 };
