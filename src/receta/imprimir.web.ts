// Imprimir desde la COMPUTADORA: se arma la hoja en un marco invisible y se abre el cuadro de
// impresión del navegador (con vista previa). En Chrome, elegir el tamaño de papel "media carta" si no sale solo.
// Para el PDF se usa el mismo cuadro con el destino "Guardar como PDF" (el nombre sale del <title> del documento).
//
// En el TELÉFONO (Safari del iPhone) el marco invisible no se imprime: ahí la hoja se pone dentro de la propia
// página, oculta en pantalla, y se imprime la página entera (solo se ve la hoja en la impresión).

import { Alert } from '../ui/dialogo';
import { WEB_EN_TELEFONO } from '../ui/plataforma';
import { pdfDesdeHtml } from './pdfWeb';

/**
 * App agregada a la pantalla de inicio del iPhone: ahí Apple no permite imprimir desde la página,
 * así que se hace el PDF y se abre "Compartir" (WhatsApp, Correo, Archivos, Imprimir…).
 */
export const EN_PANTALLA_DE_INICIO =
  WEB_EN_TELEFONO &&
  typeof window !== 'undefined' &&
  ((navigator as Navigator & { standalone?: boolean }).standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches);

export interface TamanoHoja {
  ancho: number;
  alto: number;
  horizontal: boolean;
}

/** El tamaño lo pone la hoja misma (@page); se conserva el parámetro para que el código sea igual al del teléfono. */
export const HOJA_RECETA: TamanoHoja = { ancho: 612, alto: 396, horizontal: true };

export async function compartirPdf(html: string, nombreArchivo: string, hoja: TamanoHoja = HOJA_RECETA): Promise<void> {
  if (EN_PANTALLA_DE_INICIO) return entregarPdf(html, nombreArchivo);
  await imprimirHtml(html, hoja);
}

function tituloDe(html: string): string {
  const m = /<title>([^<]*)<\/title>/i.exec(html);
  const t = (m?.[1] ?? 'Documento').replace(/&amp;/g, '&').replace(/[\\/:*?"<>|]/g, '-').trim();
  return t || 'Documento';
}

/** Hace el PDF y, con un toque (el iPhone lo exige), abre Compartir. */
export async function entregarPdf(html: string, nombreArchivo: string): Promise<void> {
  const bytes = await pdfDesdeHtml(html);
  const nombre = /\.pdf$/i.test(nombreArchivo) ? nombreArchivo : `${nombreArchivo}.pdf`;
  const archivo = new File([bytes as BlobPart], nombre, { type: 'application/pdf' });
  const abrir = () => {
    const url = URL.createObjectURL(archivo);
    window.open(url, '_blank') ?? (window.location.href = url);
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000);
  };
  const compartir = () => {
    if (navigator.canShare?.({ files: [archivo] })) {
      navigator.share({ files: [archivo], title: nombre.replace(/\.pdf$/i, '') }).catch((e: unknown) => {
        if (!(e instanceof Error && e.name === 'AbortError')) abrir();
      });
    } else abrir();
  };
  Alert.alert('PDF listo', 'Toque Compartir y elija WhatsApp, Correo, "Guardar en Archivos" o "Imprimir".', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Compartir', onPress: compartir },
  ]);
}

/** En la computadora el PDF se guarda desde el cuadro de impresión (destino "Guardar como PDF"). */
export const PDF_CON_DIALOGO_DE_IMPRESION = true;

/** Cómo guardar o enviar el PDF, para los textos de las pantallas. */
export const AYUDA_PDF = EN_PANTALLA_DE_INICIO
  ? 'Se prepara el PDF y se abre Compartir: elija WhatsApp, Correo, "Guardar en Archivos" o "Imprimir". '
  : WEB_EN_TELEFONO
  ? 'En el iPhone se abre la vista de impresión: para el PDF toque Compartir (arriba) y elija WhatsApp, Correo o "Guardar en Archivos". '
  : 'Para el PDF se abre el cuadro de impresión: en "Destino" elija "Guardar como PDF". ';

export function imprimirHtml(html: string, hoja: TamanoHoja = HOJA_RECETA): Promise<void> {
  if (EN_PANTALLA_DE_INICIO) return entregarPdf(html, tituloDe(html));
  return WEB_EN_TELEFONO ? imprimirEnLaPagina(html) : imprimirEnMarco(html, hoja);
}

const ID_IMPRESION = 'pediacontrol-impresion';

/** Encierra las reglas de la hoja en @media print, para que no cambien la app en pantalla. */
export function estiloSoloImpresion(css: string): string {
  return `@media screen { #${ID_IMPRESION} { display: none !important; } }
@media print {
  body > *:not(#${ID_IMPRESION}) { display: none !important; }
  #${ID_IMPRESION} { display: block !important; }
${css}
}`;
}

/** Imprime la hoja desde la propia página (Safari del iPhone no imprime marcos invisibles). */
export async function imprimirEnLaPagina(html: string): Promise<void> {
  document.getElementById(ID_IMPRESION)?.remove();
  document.getElementById(`${ID_IMPRESION}-estilo`)?.remove();
  const hoja = new DOMParser().parseFromString(html, 'text/html');
  const estilo = document.createElement('style');
  estilo.id = `${ID_IMPRESION}-estilo`;
  estilo.textContent = estiloSoloImpresion([...hoja.querySelectorAll('style')].map((e) => e.textContent ?? '').join('\n'));
  const contenedor = document.createElement('div');
  contenedor.id = ID_IMPRESION;
  contenedor.innerHTML = hoja.body.innerHTML;
  document.head.appendChild(estilo);
  document.body.appendChild(contenedor);
  // Las imágenes (fondo, firma) deben estar listas antes de abrir la impresión.
  await Promise.all(
    [...contenedor.querySelectorAll('img')].map((img) =>
      img.decode ? img.decode().catch(() => undefined) : Promise.resolve(),
    ),
  );
  const tituloAnterior = document.title;
  if (hoja.title) document.title = hoja.title; // nombre del PDF
  const limpiar = () => {
    document.title = tituloAnterior;
    contenedor.remove();
    estilo.remove();
  };
  window.addEventListener('afterprint', () => setTimeout(limpiar, 500), { once: true });
  window.print();
  // Por si el navegador no avisa "afterprint": la hoja está oculta en pantalla, así que no estorba mientras tanto.
  setTimeout(() => contenedor.isConnected && limpiar(), 10 * 60_000);
}

function imprimirEnMarco(html: string, _hoja: TamanoHoja): Promise<void> {
  return new Promise((resolver, rechazar) => {
    const marco = document.createElement('iframe');
    marco.setAttribute('aria-hidden', 'true');
    Object.assign(marco.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', opacity: '0' });
    let listo = false;
    marco.onload = () => {
      if (listo) return;
      listo = true;
      const ventana = marco.contentWindow;
      if (!ventana) {
        marco.remove();
        rechazar(new Error('El navegador no permitió preparar la impresión.'));
        return;
      }
      const quitar = () => setTimeout(() => marco.remove(), 1000);
      ventana.addEventListener('afterprint', quitar, { once: true });
      // Las imágenes ya están incrustadas; se espera un instante a que el navegador termine de dibujarlas.
      setTimeout(() => {
        try {
          ventana.focus();
          ventana.print();
          resolver();
        } catch (e) {
          marco.remove();
          rechazar(e instanceof Error ? e : new Error(String(e)));
        }
        // Por si el navegador no avisa "afterprint".
        setTimeout(() => marco.isConnected && marco.remove(), 120_000);
      }, 300);
    };
    marco.srcdoc = html;
    document.body.appendChild(marco);
  });
}
