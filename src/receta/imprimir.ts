// Imprimir la receta desde el TELÉFONO (AirPrint en iPhone): se abre el cuadro de impresión del sistema,
// con vista previa, para elegir la impresora. La versión de computadora está en imprimir.web.ts.

import * as Print from 'expo-print';
import { TAMANO_HOJA_PT } from './hoja';

export async function imprimirHtml(html: string): Promise<void> {
  await Print.printAsync({
    html,
    width: TAMANO_HOJA_PT.ancho,
    height: TAMANO_HOJA_PT.alto,
    orientation: Print.Orientation.landscape,
  });
}
