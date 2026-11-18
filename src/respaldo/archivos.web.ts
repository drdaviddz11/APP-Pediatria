// Guardar y abrir el archivo de respaldo en la COMPUTADORA (navegador).
// Guardar = descargarlo a la carpeta Descargas. Abrir = elegir el archivo con el explorador de archivos.

export interface ArchivoElegido {
  nombre: string;
  texto: string;
}

/** Descarga el archivo. Devuelve una función de limpieza (aquí no hay archivo temporal que borrar). */
export async function guardarArchivoRespaldo(nombre: string, texto: string): Promise<() => void> {
  return guardarArchivo(nombre, texto, { mimeType: 'application/octet-stream', UTI: 'public.data', titulo: '' });
}

export interface TipoArchivo {
  mimeType: string;
  UTI: string;
  titulo: string;
}

/** Descarga cualquier archivo de texto a la carpeta Descargas. */
export async function guardarArchivo(nombre: string, texto: string, tipo: TipoArchivo): Promise<() => void> {
  const blob = new Blob([texto], { type: tipo.mimeType });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.style.display = 'none';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Se libera la memoria después de que el navegador empezó la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return () => undefined;
}

/** Abre el explorador de archivos de la computadora. Devuelve null si se canceló. */
export function elegirArchivoRespaldo(): Promise<ArchivoElegido | null> {
  return new Promise((resolver, rechazar) => {
    const entrada = document.createElement('input');
    entrada.type = 'file';
    entrada.accept = '.pediacontrol,application/octet-stream,application/json';
    entrada.style.display = 'none';
    const terminar = () => entrada.remove();
    entrada.addEventListener('change', () => {
      const archivo = entrada.files?.[0];
      terminar();
      if (!archivo) return resolver(null);
      archivo.text().then((texto) => resolver({ nombre: archivo.name, texto }), rechazar);
    });
    entrada.addEventListener('cancel', () => {
      terminar();
      resolver(null);
    });
    document.body.appendChild(entrada);
    entrada.click();
  });
}

export const INSTRUCCIONES_GUARDAR = {
  confirmar: 'El archivo se descarga en la carpeta Descargas de la computadora. Confirme solo si lo ve ahí.',
};
