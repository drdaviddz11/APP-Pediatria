// En la computadora no hay Face ID: se usa la clave.

export async function biometriaDisponible(): Promise<boolean> {
  return false;
}

export async function pedirBiometria(): Promise<boolean> {
  return false;
}
