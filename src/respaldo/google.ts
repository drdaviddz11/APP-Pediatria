// Conexión con Google Drive en el TELÉFONO.
// Necesita la app propia (compilación de la App Store / TestFlight); en Expo Go todavía no está disponible.
// Por ahora el teléfono sigue guardando el respaldo con "Guardar en Archivos" (iCloud Drive o Google Drive).

import type { Drive } from './drive';

export function driveDisponible(): boolean {
  return false;
}

export function direccionDeRegreso(): string {
  return '';
}

export function conectarGoogle(): void {
  throw new Error('La conexión directa con Google Drive estará en el teléfono cuando la app se publique en la App Store.');
}

export async function recibirRespuestaGoogle(_hash: string): Promise<string | null> {
  return 'La conexión directa con Google Drive todavía no está disponible en el teléfono.';
}

export function driveActual(): Drive | null {
  return null;
}

export function cuentaRecordada(): string | null {
  return null;
}

export async function desconectarGoogle(): Promise<void> {}

export const DRIVE_AUTOMATICO = false;
