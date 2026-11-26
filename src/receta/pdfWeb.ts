// PDF hecho por la propia app en el navegador, para cuando no se puede imprimir: la app instalada en la
// pantalla de inicio del iPhone (ahí Apple no permite el cuadro de impresión).
//
// La hoja (receta o constancia) se acomoda en un marco invisible con el mismo HTML que se imprime; luego se lee
// dónde quedó cada palabra, imagen y línea, y se escribe un PDF con eso. Así el PDF queda igual que la hoja
// impresa, sin una segunda forma de acomodar el texto. Usa las letras estándar de PDF (Helvetica/Times).

const PX_A_PT = 0.75; // 96 px por pulgada en el navegador; 72 puntos por pulgada en el PDF

// ---------------------------------------------------------------------------
// Texto en la codificación de las letras estándar (WinAnsi)
// ---------------------------------------------------------------------------

const WIN_ANSI_EXTRA: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a,
  '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
  '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};
const REEMPLAZOS: Record<string, string> = { '≥': '>=', '≤': '<=', '→': '->', '←': '<-', '×': 'x', ' ': ' ', ' ': ' ', ' ': ' ' };

/** Signos que no están en WinAnsi pero sí en la letra estándar Symbol (se dibujan uno por uno con ella). */
export const SIMBOLOS: Record<string, number> = { '≥': 0xb3, '≤': 0xa3, '→': 0xae, '←': 0xac, '×': 0xb4, '≈': 0xbb, '≠': 0xb9 };
const HAY_SIMBOLO = /[≥≤→←×≈≠]/;

/** Texto PDF entre paréntesis; las letras fuera de ASCII van como \ooo en WinAnsi. */
export function textoPdf(t: string): string {
  let r = '(';
  for (const ch0 of t.normalize('NFC')) {
    const ch = REEMPLAZOS[ch0] ?? ch0;
    for (const ch2 of ch) {
      const c = ch2.codePointAt(0) as number;
      let b: number;
      if (c >= 0x20 && c < 0x7f) b = c;
      else if (c >= 0xa0 && c <= 0xff) b = c;
      else b = WIN_ANSI_EXTRA[ch2] ?? 0x3f; // ?
      if (b === 0x28 || b === 0x29 || b === 0x5c) r += '\\' + String.fromCharCode(b);
      else if (b < 0x7f) r += String.fromCharCode(b);
      else r += '\\' + b.toString(8).padStart(3, '0');
    }
  }
  return r + ')';
}

// Anchos (milésimas del tamaño de letra) de lo que se usa en la numeración "12. ".
const ANCHOS = { helvetica: { digito: 556, punto: 278, espacio: 278 }, times: { digito: 500, punto: 250, espacio: 250 } };

// ---------------------------------------------------------------------------
// Armado del archivo PDF
// ---------------------------------------------------------------------------

const cod = new TextEncoder();

class EscritorPdf {
  private partes: Uint8Array[] = [];
  private largo = 0;
  private posiciones: number[] = [];

  private poner(d: Uint8Array | string) {
    const b = typeof d === 'string' ? cod.encode(d) : d;
    this.partes.push(b);
    this.largo += b.length;
  }

  /** Reserva el número de un objeto (se escribe después con `escribir`). */
  reservar(): number {
    this.posiciones.push(-1);
    return this.posiciones.length;
  }

  escribir(n: number, dic: string, flujo?: Uint8Array) {
    if (this.largo === 0) this.poner('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
    this.posiciones[n - 1] = this.largo;
    if (flujo) {
      this.poner(`${n} 0 obj\n${dic.replace(/>>\s*$/, `/Length ${flujo.length}>>`)}\nstream\n`);
      this.poner(flujo);
      this.poner('\nendstream\nendobj\n');
    } else this.poner(`${n} 0 obj\n${dic}\nendobj\n`);
  }

  terminar(raiz: number): Uint8Array {
    const inicio = this.largo;
    let x = `xref\n0 ${this.posiciones.length + 1}\n0000000000 65535 f \n`;
    for (const p of this.posiciones) x += `${String(p).padStart(10, '0')} 00000 n \n`;
    this.poner(`${x}trailer\n<</Size ${this.posiciones.length + 1}/Root ${raiz} 0 R>>\nstartxref\n${inicio}\n%%EOF\n`);
    const r = new Uint8Array(this.largo);
    let o = 0;
    for (const p of this.partes) {
      r.set(p, o);
      o += p.length;
    }
    return r;
  }
}

async function comprimir(datos: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const s = new Blob([datos as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  } catch {
    return null;
  }
}

function base64ABytes(b64: string): Uint8Array {
  const s = atob(b64);
  const r = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) r[i] = s.charCodeAt(i);
  return r;
}

/** Alto, ancho y colores de un JPEG; null si conviene pasarlo por el lienzo (rotado por EXIF, CMYK…). */
export function datosJpeg(b: Uint8Array): { ancho: number; alto: number; componentes: number } | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length && b[i] === 0xff) {
    const m = b[i + 1];
    const largo = (b[i + 2] << 8) | b[i + 3];
    if (m === 0xe1) return null; // EXIF: puede venir girada
    if (m >= 0xc0 && m <= 0xc3) {
      const componentes = b[i + 9];
      if (componentes !== 1 && componentes !== 3) return null;
      return { alto: (b[i + 5] << 8) | b[i + 6], ancho: (b[i + 7] << 8) | b[i + 8], componentes };
    }
    i += 2 + largo;
  }
  return null;
}

interface ImagenPdf {
  dic: string;
  datos: Uint8Array;
  mascara?: { dic: string; datos: Uint8Array };
}

async function imagenParaPdf(img: HTMLImageElement): Promise<ImagenPdf | null> {
  const m = /^data:image\/jpeg;base64,(.+)$/.exec(img.src);
  if (m) {
    const datos = base64ABytes(m[1]);
    const info = datosJpeg(datos);
    if (info)
      return {
        dic: `<</Type/XObject/Subtype/Image/Width ${info.ancho}/Height ${info.alto}/ColorSpace/${info.componentes === 1 ? 'DeviceGray' : 'DeviceRGB'}/BitsPerComponent 8/Filter/DCTDecode>>`,
        datos,
      };
  }
  // Otras (PNG con transparencia, fotos giradas): se dibujan en un lienzo y se separa la transparencia.
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  if (!w0 || !h0) return null;
  const escala = Math.min(1, 1600 / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * escala));
  const h = Math.max(1, Math.round(h0 * escala));
  const lienzo = document.createElement('canvas');
  lienzo.width = w;
  lienzo.height = h;
  const ctx = lienzo.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const rgb = new Uint8Array(w * h * 3);
  const alfa = new Uint8Array(w * h);
  let conTransparencia = false;
  for (let i = 0, j = 0, k = 0; i < px.length; i += 4, j += 3, k++) {
    rgb[j] = px[i];
    rgb[j + 1] = px[i + 1];
    rgb[j + 2] = px[i + 2];
    alfa[k] = px[i + 3];
    if (px[i + 3] < 255) conTransparencia = true;
  }
  const base = `/Type/XObject/Subtype/Image/Width ${w}/Height ${h}/BitsPerComponent 8`;
  const rgbZ = await comprimir(rgb);
  const imagen: ImagenPdf = {
    dic: `<<${base}/ColorSpace/DeviceRGB${rgbZ ? '/Filter/FlateDecode' : ''}>>`,
    datos: rgbZ ?? rgb,
  };
  if (conTransparencia) {
    const alfaZ = await comprimir(alfa);
    imagen.mascara = { dic: `<<${base}/ColorSpace/DeviceGray${alfaZ ? '/Filter/FlateDecode' : ''}>>`, datos: alfaZ ?? alfa };
  }
  return imagen;
}

// ---------------------------------------------------------------------------
// Lectura de la hoja acomodada
// ---------------------------------------------------------------------------

interface Caja {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const n2 = (v: number) => (Math.round(v * 100) / 100).toString();

function colorPdf(css: string, op: 'rg' | 'RG'): string {
  const m = /rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(css);
  const [r, g, b] = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
  return `${n2(r / 255)} ${n2(g / 255)} ${n2(b / 255)} ${op}`;
}

function fuentePdf(e: CSSStyleDeclaration): { nombre: string; familia: 'helvetica' | 'times' } {
  const fam = e.fontFamily.toLowerCase();
  const times = /times|georgia|(^|[ ,])serif/.test(fam) && !/sans-serif/.test(fam.split(',')[0]);
  const negrita = Number(e.fontWeight) >= 600 || e.fontWeight === 'bold';
  const cursiva = e.fontStyle === 'italic' || e.fontStyle === 'oblique';
  const i = (negrita ? 1 : 0) + (cursiva ? 2 : 0);
  return times ? { nombre: `T${i}`, familia: 'times' } : { nombre: `H${i}`, familia: 'helvetica' };
}

const FUENTES: Record<string, string> = {
  H0: 'Helvetica', H1: 'Helvetica-Bold', H2: 'Helvetica-Oblique', H3: 'Helvetica-BoldOblique',
  T0: 'Times-Roman', T1: 'Times-Bold', T2: 'Times-Italic', T3: 'Times-BoldItalic',
};
const SYMBOL = 'S0';

/** Intersección de las cajas que recortan (overflow) desde el elemento hasta la página. */
function recorte(el: Element, pagina: Element, ventana: Window): Caja {
  let c: Caja = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 };
  for (let e: Element | null = el; e; e = e.parentElement) {
    const est = ventana.getComputedStyle(e);
    if (e === pagina || est.overflowX !== 'visible' || est.overflowY !== 'visible') {
      const r = e.getBoundingClientRect();
      c = { left: Math.max(c.left, r.left), top: Math.max(c.top, r.top), right: Math.min(c.right, r.right), bottom: Math.min(c.bottom, r.bottom) };
    }
    if (e === pagina) break;
  }
  return c;
}

/** ¿Se ve la palabra? Completa a lo ancho; a lo alto basta su centro (la caja del texto es algo más alta que el renglón). */
const dentro = (r: Caja, c: Caja) => r.left >= c.left - 1 && r.right <= c.right + 1 && (r.top + r.bottom) / 2 >= c.top && (r.top + r.bottom) / 2 <= c.bottom;

/** Distancia del borde de abajo del texto a la línea base, medida en la misma hoja, por tipo de letra. */
function medidorDescenso(doc: Document) {
  const cache = new Map<string, number>();
  return (e: CSSStyleDeclaration): number => {
    const clave = `${e.fontFamily}|${e.fontSize}|${e.fontWeight}|${e.fontStyle}`;
    const ya = cache.get(clave);
    if (ya !== undefined) return ya;
    const caja = doc.createElement('div');
    caja.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;line-height:normal;font-family:${e.fontFamily};font-size:${e.fontSize};font-weight:${e.fontWeight};font-style:${e.fontStyle}`;
    const texto = doc.createElement('span');
    texto.textContent = 'Hg';
    const base = doc.createElement('span');
    base.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    caja.append(texto, base);
    doc.body.appendChild(caja);
    const d = texto.getBoundingClientRect().bottom - base.getBoundingClientRect().bottom;
    caja.remove();
    cache.set(clave, d);
    return d;
  };
}

interface Pagina {
  ancho: number;
  alto: number;
  contenido: string;
  imagenes: Map<string, HTMLImageElement>;
}

function leerPagina(pagina: Element, doc: Document, ventana: Window, nombreImagen: (img: HTMLImageElement) => string): Pagina {
  const p = pagina.getBoundingClientRect();
  const alto = p.height * PX_A_PT;
  const X = (x: number) => n2((x - p.left) * PX_A_PT);
  const Y = (y: number) => n2(alto - (y - p.top) * PX_A_PT);
  const descenso = medidorDescenso(doc);
  const ops: string[] = [];
  const imagenes = new Map<string, HTMLImageElement>();

  const texto = (t: string, x: number, base: number, est: CSSStyleDeclaration) => {
    const tam = parseFloat(est.fontSize) * PX_A_PT;
    const simbolo = t.length === 1 && HAY_SIMBOLO.test(t) ? SIMBOLOS[t] : undefined;
    const letra = simbolo !== undefined ? SYMBOL : fuentePdf(est).nombre;
    const cadena = simbolo !== undefined ? `(\\${simbolo.toString(8)})` : textoPdf(t);
    ops.push(`BT /${letra} ${n2(tam)} Tf ${colorPdf(est.color, 'rg')} ${X(x)} ${Y(base)} Td ${cadena} Tj ET`);
  };

  const recorrido = doc.createTreeWalker(pagina, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let nodo: Node | null = recorrido.currentNode; nodo; nodo = recorrido.nextNode()) {
    if (nodo.nodeType === Node.ELEMENT_NODE) {
      const el = nodo as Element;
      const est = ventana.getComputedStyle(el);
      if (est.display === 'none' || est.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (el.tagName === 'IMG') {
        const img = el as HTMLImageElement;
        const c = recorte(el.parentElement ?? el, pagina, ventana);
        if (r.width <= 0 || r.height <= 0 || r.right < c.left || r.left > c.right || r.bottom < c.top || r.top > c.bottom) continue;
        const nombre = nombreImagen(img);
        imagenes.set(nombre, img);
        // Recortada a lo visible (la hoja oculta lo que se sale), en un solo renglón: q … Q.
        const recorteImg = `${X(Math.max(c.left, r.left))} ${Y(Math.min(c.bottom, r.bottom))} ${n2((Math.min(c.right, r.right) - Math.max(c.left, r.left)) * PX_A_PT)} ${n2((Math.min(c.bottom, r.bottom) - Math.max(c.top, r.top)) * PX_A_PT)} re W n`;
        ops.push(`q ${recorteImg} ${n2(r.width * PX_A_PT)} 0 0 ${n2(r.height * PX_A_PT)} ${X(r.left)} ${Y(r.bottom)} cm /${nombre} Do Q`);
        continue;
      }
      const bw = parseFloat(est.borderBottomWidth);
      if (bw > 0 && est.borderBottomStyle !== 'none' && r.width > 0) {
        const y = r.bottom - bw / 2;
        ops.push(`${colorPdf(est.borderBottomColor, 'RG')} ${n2(bw * PX_A_PT)} w ${X(r.left)} ${Y(y)} m ${X(r.right)} ${Y(y)} l S`);
      }
      if (el.tagName === 'LI' && el.parentElement?.tagName === 'OL' && est.listStyleType !== 'none') {
        // Numeración "1." (el navegador la dibuja aparte del texto).
        const lista = el.parentElement as HTMLOListElement;
        const numero = lista.start + [...lista.children].filter((h) => h.tagName === 'LI').indexOf(el);
        const rango = doc.createRange();
        rango.selectNodeContents(el);
        const primera = rango.getClientRects()[0];
        if (primera) {
          const f = fuentePdf(est);
          const tam = parseFloat(est.fontSize) * PX_A_PT;
          const a = ANCHOS[f.familia];
          const marca = `${numero}.`;
          const anchoPt = ((String(numero).length * a.digito + a.punto + a.espacio) / 1000) * tam;
          const x = r.left - anchoPt / PX_A_PT;
          texto(marca, x, primera.bottom - descenso(est), est);
        }
      }
      continue;
    }
    // Texto: cada palabra donde quedó (así se respetan la justificación y los saltos de línea).
    const t = nodo as Text;
    const padre = t.parentElement;
    if (!padre || !t.data.trim()) continue;
    const est = ventana.getComputedStyle(padre);
    if (est.visibility === 'hidden') continue;
    const c = recorte(padre, pagina, ventana);
    const d = descenso(est);
    const rango = doc.createRange();
    for (const m of t.data.matchAll(/\S+/g)) {
      const inicio = m.index ?? 0;
      rango.setStart(t, inicio);
      rango.setEnd(t, inicio + m[0].length);
      const cajas = [...rango.getClientRects()].filter((q) => q.width > 0);
      if (cajas.length === 1 && !HAY_SIMBOLO.test(m[0])) {
        if (dentro(cajas[0], c)) texto(m[0], cajas[0].left, cajas[0].bottom - d, est);
        continue;
      }
      // Palabra partida en dos renglones, o con signos como ≥: letra por letra.
      let trozo = '';
      let caja: DOMRect | null = null;
      for (let i = 0; i < m[0].length; i++) {
        rango.setStart(t, inicio + i);
        rango.setEnd(t, inicio + i + 1);
        const q = rango.getBoundingClientRect();
        if (HAY_SIMBOLO.test(m[0][i])) {
          if (caja && trozo && dentro(caja, c)) texto(trozo, caja.left, caja.bottom - d, est);
          trozo = '';
          caja = null;
          if (dentro(q, c)) texto(m[0][i], q.left, q.bottom - d, est);
          continue;
        }
        if (caja && Math.abs(q.top - caja.top) > 2) {
          if (dentro(caja, c)) texto(trozo, caja.left, caja.bottom - d, est);
          trozo = '';
          caja = null;
        }
        if (!caja) caja = q;
        trozo += m[0][i];
      }
      if (caja && trozo && dentro(caja, c)) texto(trozo, caja.left, caja.bottom - d, est);
    }
  }
  return { ancho: p.width * PX_A_PT, alto, contenido: ops.join('\n'), imagenes };
}

/** Hace el PDF de una hoja (el mismo HTML que se imprime). Cada elemento .pagina es una página. */
export async function pdfDesdeHtml(html: string): Promise<Uint8Array> {
  const marco = document.createElement('iframe');
  marco.setAttribute('aria-hidden', 'true');
  // Fuera de la vista pero con su tamaño real, para que el navegador acomode la hoja igual que al imprimir.
  Object.assign(marco.style, { position: 'fixed', left: '-30000px', top: '0', width: '1400px', height: '1200px', border: '0', opacity: '0', pointerEvents: 'none' });
  const cargado = new Promise<void>((ok) => (marco.onload = () => ok()));
  marco.srcdoc = html;
  document.body.appendChild(marco);
  try {
    await cargado;
    const doc = marco.contentDocument;
    const ventana = marco.contentWindow;
    if (!doc || !ventana) throw new Error('El navegador no permitió preparar el PDF.');
    await Promise.all([...doc.images].map((i) => (i.decode ? i.decode().catch(() => undefined) : undefined)));
    await (doc.fonts?.ready ?? Promise.resolve());

    const nombres = new Map<string, string>();
    const porNombre = new Map<string, HTMLImageElement>();
    const nombreImagen = (img: HTMLImageElement) => {
      let n = nombres.get(img.src);
      if (!n) {
        n = `Im${nombres.size + 1}`;
        nombres.set(img.src, n);
        porNombre.set(n, img);
      }
      return n;
    };
    const elementos = [...doc.querySelectorAll('.pagina')];
    const paginas = (elementos.length ? elementos : [doc.body]).map((p) => leerPagina(p, doc, ventana, nombreImagen));

    const w = new EscritorPdf();
    const catalogo = w.reservar();
    const arbol = w.reservar();
    const fuentes: Record<string, number> = {};
    for (const [clave, nombre] of Object.entries(FUENTES)) {
      fuentes[clave] = w.reservar();
      w.escribir(fuentes[clave], `<</Type/Font/Subtype/Type1/BaseFont/${nombre}/Encoding/WinAnsiEncoding>>`);
    }
    fuentes[SYMBOL] = w.reservar();
    w.escribir(fuentes[SYMBOL], '<</Type/Font/Subtype/Type1/BaseFont/Symbol>>');
    const imagenes: Record<string, number> = {};
    for (const [nombre, img] of porNombre) {
      const datos = await imagenParaPdf(img);
      if (!datos) continue;
      let mascara = '';
      if (datos.mascara) {
        const nm = w.reservar();
        w.escribir(nm, datos.mascara.dic, datos.mascara.datos);
        mascara = `/SMask ${nm} 0 R`;
      }
      imagenes[nombre] = w.reservar();
      w.escribir(imagenes[nombre], datos.dic.replace(/>>$/, `${mascara}>>`), datos.datos);
    }
    const recursos = `<</Font<<${Object.entries(fuentes).map(([k, n]) => `/${k} ${n} 0 R`).join('')}>>/XObject<<${Object.entries(imagenes).map(([k, n]) => `/${k} ${n} 0 R`).join('')}>>>>`;
    const hijos: number[] = [];
    for (const p of paginas) {
      // Se quita lo que dibuja imágenes que no se pudieron leer.
      const contenido = p.contenido
        .split('\n')
        .filter((l) => !/\/(Im\d+) Do/.test(l) || imagenes[(/\/(Im\d+) Do/.exec(l) as RegExpExecArray)[1]])
        .join('\n');
      const bytes = cod.encode(contenido);
      const z = await comprimir(bytes);
      const nc = w.reservar();
      w.escribir(nc, `<<${z ? '/Filter/FlateDecode' : ''}>>`, z ?? bytes);
      const np = w.reservar();
      w.escribir(np, `<</Type/Page/Parent ${arbol} 0 R/MediaBox[0 0 ${n2(p.ancho)} ${n2(p.alto)}]/Resources ${recursos}/Contents ${nc} 0 R>>`);
      hijos.push(np);
    }
    w.escribir(arbol, `<</Type/Pages/Kids[${hijos.map((h) => `${h} 0 R`).join(' ')}]/Count ${hijos.length}>>`);
    w.escribir(catalogo, `<</Type/Catalog/Pages ${arbol} 0 R>>`);
    return w.terminar(catalogo);
  } finally {
    marco.remove();
  }
}
