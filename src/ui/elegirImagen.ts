// Elegir una imagen (PNG o JPG) en el TELÉFONO, como texto data:…;base64. Devuelve null si se canceló.

import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

export async function elegirImagen(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['image/png', 'image/jpeg'], copyToCacheDirectory: true });
  if (r.canceled) return null;
  const asset = r.assets[0];
  const tipo = /\.png$/i.test(asset.name) || asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  const base64 = await new File(asset.uri).base64();
  return `data:${tipo};base64,${base64}`;
}
