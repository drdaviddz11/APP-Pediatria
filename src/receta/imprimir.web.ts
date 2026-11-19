// Imprimir desde la COMPUTADORA: se arma la hoja en un marco invisible y se abre el cuadro de
// impresión del navegador (con vista previa). En Chrome, elegir el tamaño de papel "media carta" si no sale solo.
// Para el PDF se usa el mismo cuadro con el destino "Guardar como PDF" (el nombre sale del <title> del documento).

export interface TamanoHoja {
  ancho: number;
  alto: number;
  horizontal: boolean;
}

/** El tamaño lo pone la hoja misma (@page); se conserva el parámetro para que el código sea igual al del teléfono. */
export const HOJA_RECETA: TamanoHoja = { ancho: 612, alto: 396, horizontal: true };

export async function compartirPdf(html: string, _nombreArchivo: string, _hoja: TamanoHoja = HOJA_RECETA): Promise<void> {
  await imprimirHtml(html);
}

/** En la computadora el PDF se guarda desde el cuadro de impresión (destino "Guardar como PDF"). */
export const PDF_CON_DIALOGO_DE_IMPRESION = true;

export function imprimirHtml(html: string, _hoja: TamanoHoja = HOJA_RECETA): Promise<void> {
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
