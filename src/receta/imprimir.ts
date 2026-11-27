// Imprimir desde el TELÉFONO (AirPrint en iPhone): se abre el cuadro de impresión del sistema,
// con vista previa, para elegir la impresora. La versión de computadora está en imprimir.web.ts.

import * as Print from 'expo-print';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { TAMANO_HOJA_PT } from './hoja';

export interface TamanoHoja {
  ancho: number;
  alto: number;
  horizontal: boolean;
}

/** En el teléfono el PDF se envía con la hoja de compartir; no hace falta ayuda extra. */
export const AYUDA_PDF = '';

/** Carta vertical; la receta va en la mitad de arriba. */
export const HOJA_RECETA: TamanoHoja = { ancho: TAMANO_HOJA_PT.ancho, alto: TAMANO_HOJA_PT.alto, horizontal: false };

export async function imprimirHtml(html: string, hoja: TamanoHoja = HOJA_RECETA): Promise<void> {
  await Print.printAsync({
    html,
    width: hoja.ancho,
    height: hoja.alto,
    orientation: hoja.horizontal ? Print.Orientation.landscape : Print.Orientation.portrait,
  });
}

/** Crea el PDF y abre la hoja de compartir (WhatsApp, correo, Archivos…). */
export async function compartirPdf(html: string, nombreArchivo: string, hoja: TamanoHoja = HOJA_RECETA): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este teléfono no permite compartir archivos desde la app.');
  const { uri } = await Print.printToFileAsync({ html, width: hoja.ancho, height: hoja.alto });
  const generado = new File(uri);
  const destino = new File(Paths.cache, nombreArchivo);
  try {
    if (destino.exists) destino.delete();
    await generado.move(destino);
  } catch {
    // Si no se pudo renombrar, se comparte con el nombre que puso el sistema.
  }
  const final = destino.exists ? destino : generado;
  try {
    await Sharing.shareAsync(final.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: nombreArchivo });
  } finally {
    try {
      if (final.exists) final.delete();
    } catch {
      // El sistema limpia la carpeta temporal por su cuenta.
    }
  }
}

/** En el teléfono el PDF se comparte directo. */
export const PDF_CON_DIALOGO_DE_IMPRESION = false;
