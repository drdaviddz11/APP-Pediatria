// Face ID / huella en el TELÉFONO. Solo en la app propia (TestFlight / App Store): en Expo Go Apple no permite Face ID.

import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';

export async function biometriaDisponible(): Promise<boolean> {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false; // Expo Go
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** true si la persona se identificó con Face ID / huella. */
export async function pedirBiometria(): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Abrir PediaControl Pro',
      cancelLabel: 'Usar clave',
      disableDeviceFallback: true,
      fallbackLabel: '',
    });
    return r.success;
  } catch {
    return false;
  }
}
