// Hoja de la constancia: hoja carta (8.5 × 11 pulgadas), como el formato del Dr. Díaz.
// - Mitad de arriba: la receta (membrete, nombre, fecha) con el texto de la constancia en el área de la receta,
//   y la firma y sello sobre la línea de firma.
// - Mitad de abajo: "Diagnósticos:" con la lista y otra vez firma y sello.
// La imagen de firma y sello la sube el médico en la app (no está en el código).

import { escapar, fechaReceta, HOJA, IMG_ALTO, POS, SOBRE_LINEA } from '../receta/hoja';
import { folioConstancia } from './plantillas';

const CARTA = { ancho: 8.5, alto: 11 };

/** Posiciones en la mitad de arriba, en % de la imagen de la receta (igual que su PDF). */
const ARRIBA = {
  texto: { izq: 13.6, der: 93.0, arriba: 28.0, abajo: 66.5 },
  firma: { izq: 65.5, ancho: 24.8, arriba: 68.5 },
};

/** Mitad de abajo, en pulgadas desde la orilla de la hoja (medido en su PDF). */
const ABAJO = { izq: 2.68, arriba: 7.05, ancho: 5.0, limite: 10.75, firmaIzq: 1.72, firmaAncho: 1.89 };
/** Proporción de la imagen de firma (ancho / alto) para reservar su lugar. */
const PROPORCION_FIRMA = 1.44;

function anchoTextoPt(): number {
  return ((ARRIBA.texto.der - ARRIBA.texto.izq) / 100) * HOJA.imgAncho * 72;
}
function altoTextoPt(): number {
  return ((ARRIBA.texto.abajo - ARRIBA.texto.arriba) / 100) * IMG_ALTO * 72 * 0.95;
}

/** Renglones que ocupa un texto con ese ancho y tamaño de letra (estimación conservadora, por palabras). */
function renglones(texto: string, anchoPt: number, pt: number, anchoLetra = 0.55): number {
  const porRenglon = Math.max(10, Math.floor(anchoPt / (pt * anchoLetra)));
  let total = 0;
  for (const linea of texto.split('\n')) {
    let usado = 0;
    let n = 1;
    for (const palabra of linea.split(' ')) {
      const largo = palabra.length + (usado > 0 ? 1 : 0);
      if (usado + largo > porRenglon && usado > 0) {
        n++;
        usado = palabra.length;
      } else usado += largo;
      while (usado > porRenglon) {
        n++;
        usado -= porRenglon;
      }
    }
    total += n;
  }
  return total;
}

const TAMANOS_TEXTO = [13, 12, 11, 10, 9];
const INTERLINEADO = 1.35;

/** Tamaño de letra del texto de la constancia (13 a 9 pt) para que quepa sin tapar la firma. */
export function tamanoTexto(texto: string): { puntos: number; cabe: boolean } {
  for (const pt of TAMANOS_TEXTO) {
    if (renglones(texto.trim(), anchoTextoPt(), pt) * pt * INTERLINEADO <= altoTextoPt()) return { puntos: pt, cabe: true };
  }
  return { puntos: 9, cabe: false };
}

const TAMANOS_DX = [12, 11, 10, 9];

/** Tamaño de letra de los diagnósticos para que quepan con la firma en la mitad de abajo. */
export function tamanoDiagnosticos(diagnosticos: string[]): { puntos: number; cabe: boolean } {
  const altoFirmaPt = (ABAJO.firmaAncho / PROPORCION_FIRMA) * 72 + 12;
  const disponible = (ABAJO.limite - ABAJO.arriba) * 72 - altoFirmaPt;
  for (const pt of TAMANOS_DX) {
    const encabezado = pt * 1.5 + 6;
    const lista = diagnosticos.reduce((s, d) => s + renglones(d, ABAJO.ancho * 72 - 24, pt) * pt * INTERLINEADO + pt * 0.3, 0);
    if (encabezado + lista <= disponible) return { puntos: pt, cabe: true };
  }
  return { puntos: 9, cabe: false };
}

export interface DatosHojaConstancia {
  id: string;
  /** Título del documento (en la computadora es el nombre sugerido del PDF). */
  titulo?: string;
  nombre: string;
  fecha: Date;
  texto: string;
  diagnosticos: string[];
  /** data: URI de la receta (FONDO_RECETA). */
  fondo: string;
  /** data: URI de la firma y sello; si no hay, queda el espacio para firmar a mano. */
  firma: string | null;
}

/** Documento HTML de una hoja carta, listo para imprimir o guardar como PDF. */
export function htmlConstancia(d: DatosHojaConstancia): string {
  const pct = (v: number) => `${v}%`;
  const letraNombre = d.nombre.length <= 40 ? 13 : d.nombre.length <= 55 ? 11 : 9.5;
  const { puntos } = tamanoTexto(d.texto);
  const dx = tamanoDiagnosticos(d.diagnosticos);
  const parrafos = d.texto
    .replace(/\r/g, '')
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${escapar(p)}</p>`)
    .join('');
  const firma = (clase: string) => (d.firma ? `<img class="${clase}" src="${d.firma}" alt="">` : '');
  const items = d.diagnosticos.map((t) => `<li>${escapar(t)}</li>`).join('');
  const izqHoja = (HOJA.ancho - HOJA.imgAncho) / 2;
  const arribaHoja = (HOJA.alto - IMG_ALTO) / 2;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${escapar(d.titulo ?? 'Constancia')}</title>
<style>
  @page { size: ${CARTA.ancho}in ${CARTA.alto}in; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .pagina { width: ${CARTA.ancho}in; height: ${CARTA.alto}in; position: relative; overflow: hidden; font-family: Helvetica, Arial, sans-serif; color: #14232E; }
  .hoja { position: absolute; left: ${izqHoja}in; top: ${arribaHoja}in; width: ${HOJA.imgAncho}in; height: ${IMG_ALTO}in; }
  .hoja > img.fondo { position: absolute; inset: 0; width: 100%; height: 100%; }
  .campo { position: absolute; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1; }
  .nombre { left: ${pct(POS.nombre.izq)}; width: ${pct(POS.nombre.der - POS.nombre.izq)}; bottom: ${pct(100 - POS.nombre.base + SOBRE_LINEA)}; font-size: ${letraNombre}pt; }
  .fecha { left: ${pct(POS.fecha.izq)}; width: ${pct(POS.fecha.der - POS.fecha.izq)}; bottom: ${pct(100 - POS.fecha.base + SOBRE_LINEA)}; font-size: 12pt; overflow: visible; padding-left: 5pt; }
  .texto { position: absolute; left: ${pct(ARRIBA.texto.izq)}; width: ${pct(ARRIBA.texto.der - ARRIBA.texto.izq)}; top: ${pct(ARRIBA.texto.arriba)};
           height: ${pct(ARRIBA.texto.abajo - ARRIBA.texto.arriba)}; overflow: hidden; font-size: ${puntos}pt; line-height: ${INTERLINEADO}; text-align: justify; }
  .texto p { margin: 0 0 ${puntos * 0.7}pt 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .firma-arriba { position: absolute; left: ${pct(ARRIBA.firma.izq)}; width: ${pct(ARRIBA.firma.ancho)}; top: ${pct(ARRIBA.firma.arriba)}; }
  .abajo { position: absolute; left: ${ABAJO.izq}in; top: ${ABAJO.arriba}in; width: ${ABAJO.ancho}in; max-height: ${ABAJO.limite - ABAJO.arriba}in; overflow: hidden; }
  .abajo h2 { font-size: ${dx.puntos}pt; font-weight: 400; margin: 0 0 6pt 0; }
  .abajo ol { margin: 0; padding: 0 0 0 20pt; font-size: ${dx.puntos}pt; line-height: ${INTERLINEADO}; }
  .abajo li { margin-bottom: ${dx.puntos * 0.3}pt; overflow-wrap: anywhere; }
  .firma-abajo { display: block; margin: 10pt 0 0 ${ABAJO.firmaIzq}in; width: ${ABAJO.firmaAncho}in; }
  .espacio-firma { margin: 10pt 0 0 ${ABAJO.firmaIzq}in; width: ${ABAJO.firmaAncho}in; height: ${ABAJO.firmaAncho / PROPORCION_FIRMA}in; border-bottom: 1px solid #14232E; }
  .folio { position: absolute; right: 0.35in; bottom: 0.25in; font-size: 7pt; color: #5A6B78; }
</style></head>
<body><div class="pagina">
  <div class="hoja">
    <img class="fondo" src="${d.fondo}" alt="">
    <div class="campo nombre">${escapar(d.nombre)}</div>
    <div class="campo fecha">${escapar(fechaReceta(d.fecha))}</div>
    <div class="texto">${parrafos}</div>
    ${firma('firma-arriba')}
  </div>
  <div class="abajo">
    <h2>Diagnósticos:</h2>
    <ol>${items}</ol>
    ${d.firma ? firma('firma-abajo') : '<div class="espacio-firma"></div>'}
  </div>
  <div class="folio">Constancia ${escapar(folioConstancia(d.id))}</div>
</div></body></html>`;
}

/** Hoja carta vertical en puntos (72 por pulgada), para imprimir y para el PDF. */
export const HOJA_CARTA = { ancho: CARTA.ancho * 72, alto: CARTA.alto * 72, horizontal: false };

/** Nombre del archivo PDF: "Constancia Juan Perez 2026-11-19.pdf" (sin caracteres que den problemas). */
export function nombreArchivoConstancia(nombre: string, fecha: Date): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `Constancia ${limpio} ${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}.pdf`;
}
