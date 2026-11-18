// Hoja de la receta: el formato del Dr. Díaz (media carta horizontal, 8.5 × 5.5 pulgadas) con el nombre,
// la fecha y las indicaciones escritos en los mismos lugares que en su plantilla de Word.
// Sirve igual para imprimir desde el teléfono (expo-print) y desde la computadora (navegador).

/** Posiciones medidas sobre la imagen de la plantilla (1753 × 1115 px), en % de la imagen. */
const POS = {
  nombre: { izq: 15.8, der: 71.3, base: 22.0 },
  fecha: { izq: 76.6, der: 98.5, base: 22.0 },
  indicaciones: { izq: 13.6, der: 93.0, arriba: 27.0, abajo: 88.5 },
};

/** Hoja: media carta horizontal; la imagen ocupa el 96 % para no quedar en la orilla que la impresora no alcanza. */
const HOJA = { ancho: 8.5, alto: 5.5, imgAncho: 8.16 };
const IMG_ALTO = HOJA.imgAncho * (1115 / 1753);

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Nombre como va en la receta: nombres y apellidos. */
export function nombreEnReceta(p: { nombres: string; apellidos: string }): string {
  return `${p.nombres} ${p.apellidos}`.replace(/\s+/g, ' ').trim();
}

/** Como en su Word: "17 de Noviembre, 2026". */
export function fechaReceta(d: Date): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]}, ${d.getFullYear()}`;
}

function escapar(t: string): string {
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

export interface DatosReceta {
  nombre: string;
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
  const letraNombre = d.nombre.length <= 40 ? 13 : d.nombre.length <= 55 ? 11 : 9.5;
  let numero = 1;
  const paginas = hojas
    .map((lista, i) => {
      const { puntos } = tamanoLetra(lista);
      const items = lista.map((t) => `<li>${escapar(t)}</li>`).join('');
      const html = `<div class="pagina"><div class="hoja">
  <img src="${d.fondo}" alt="">
  <div class="campo nombre">${escapar(d.nombre)}</div>
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
  @page { size: ${HOJA.ancho}in ${HOJA.alto}in; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .pagina { width: ${HOJA.ancho}in; height: ${HOJA.alto}in; position: relative; overflow: hidden; }
  .hoja { position: absolute; left: ${(HOJA.ancho - HOJA.imgAncho) / 2}in; top: ${(HOJA.alto - IMG_ALTO) / 2}in;
          width: ${HOJA.imgAncho}in; height: ${IMG_ALTO}in; }
  .hoja img { position: absolute; inset: 0; width: 100%; height: 100%; }
  .campo { position: absolute; font-family: Helvetica, Arial, sans-serif; color: #14232E; white-space: nowrap; overflow: hidden;
           text-overflow: ellipsis; line-height: 1; }
  .nombre { left: ${pctX(POS.nombre.izq)}; width: ${pctX(POS.nombre.der - POS.nombre.izq)}; bottom: ${pctX(100 - POS.nombre.base + 0.6)};
            font-size: ${letraNombre}pt; }
  .fecha { left: ${pctX(POS.fecha.izq)}; width: ${pctX(POS.fecha.der - POS.fecha.izq)}; bottom: ${pctX(100 - POS.fecha.base + 0.6)};
           font-size: 10pt; text-align: left; overflow: visible; }
  .pie { left: ${pctX(POS.indicaciones.izq)}; bottom: 2.5%; font-size: 8pt; color: #5A6B78; }
  ol { position: absolute; margin: 0; padding: 0 0 0 22pt; left: ${pctX(POS.indicaciones.izq)}; width: ${pctX(POS.indicaciones.der - POS.indicaciones.izq)};
       top: ${pctX(POS.indicaciones.arriba)}; height: ${pctX(POS.indicaciones.abajo - POS.indicaciones.arriba)}; overflow: hidden;
       font-family: Helvetica, Arial, sans-serif; line-height: 1.3; color: #14232E; }
  li { white-space: pre-wrap; padding-left: 2pt; overflow-wrap: anywhere; }
  .pagina + .pagina { page-break-before: always; break-before: page; }
</style></head>
<body>${paginas}</body></html>`;
}

/** Tamaño de la hoja en puntos (72 por pulgada), para expo-print. */
export const TAMANO_HOJA_PT = { ancho: HOJA.ancho * 72, alto: HOJA.alto * 72 };
