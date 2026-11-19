// Elegir una imagen (PNG o JPG) en la COMPUTADORA, como texto data:…;base64. Devuelve null si se canceló.

export function elegirImagen(): Promise<string | null> {
  return new Promise((resolver, rechazar) => {
    const entrada = document.createElement('input');
    entrada.type = 'file';
    entrada.accept = 'image/png,image/jpeg';
    entrada.style.display = 'none';
    const terminar = () => entrada.remove();
    entrada.addEventListener('change', () => {
      const archivo = entrada.files?.[0];
      terminar();
      if (!archivo) return resolver(null);
      const lector = new FileReader();
      lector.onload = () => resolver(typeof lector.result === 'string' ? lector.result : null);
      lector.onerror = () => rechazar(new Error('No se pudo leer la imagen.'));
      lector.readAsDataURL(archivo);
    });
    entrada.addEventListener('cancel', () => {
      terminar();
      resolver(null);
    });
    document.body.appendChild(entrada);
    entrada.click();
  });
}
