// Guardar y abrir el archivo de respaldo en el TELÉFONO (iPhone/Android).
// La versión de computadora está en archivos.web.ts; Expo elige automáticamente la que corresponde.

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface ArchivoElegido {
  nombre: string;
  texto: string;
}

/**
 * Crea el archivo temporal y abre la hoja de compartir (Guardar en Archivos, Drive, AirDrop…).
 * Devuelve una función para borrar el archivo temporal cuando ya no se necesite.
 */
export async function guardarArchivoRespaldo(nombre: string, texto: string): Promise<() => void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este teléfono no permite compartir archivos desde la app.');
  const archivo = new File(Paths.cache, nombre);
  const borrar = () => {
    try {
      if (archivo.exists) archivo.delete();
    } catch {
      // El sistema limpia la carpeta temporal por su cuenta.
    }
  };
  try {
    archivo.create({ overwrite: true });
    await archivo.write(texto);
    await Sharing.shareAsync(archivo.uri, {
      mimeType: 'application/octet-stream',
      UTI: 'public.data',
      dialogTitle: 'Guardar respaldo de PediaControl',
    });
  } catch (e) {
    borrar();
    throw e;
  }
  return borrar;
}

/** Abre el selector de archivos (Archivos, iCloud Drive, Google Drive). Devuelve null si se canceló. */
export async function elegirArchivoRespaldo(): Promise<ArchivoElegido | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (r.canceled) return null;
  const asset = r.assets[0];
  return { nombre: asset.name, texto: await new File(asset.uri).text() };
}

export const INSTRUCCIONES_GUARDAR = {
  confirmar: 'Confirme solo si eligió dónde guardarlo (Archivos, Drive, AirDrop…).',
};
