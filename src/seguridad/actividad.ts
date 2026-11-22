// Último momento en que alguien usó la app (tocó la pantalla o escribió). Lo usa el bloqueo automático.
// Escribir con el teclado del teléfono no toca la pantalla de la app, así que los campos de texto también avisan.

let ultima = Date.now();

export function marcarActividad(): void {
  ultima = Date.now();
}

export function ultimaActividad(): number {
  return ultima;
}
