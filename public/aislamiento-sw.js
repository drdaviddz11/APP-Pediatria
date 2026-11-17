// PediaControl Pro: "service worker" para la versión de computadora (navegador).
//
// La base de datos SQLite del navegador necesita que la página esté "aislada" (cross-origin isolated).
// Para eso cada respuesta del propio sitio debe llevar dos encabezados de seguridad. Este archivo los agrega
// en el navegador, así funciona con cualquier servidor (el de Expo en la Mac o un alojamiento web futuro)
// y también en Safari. Solo toca archivos del propio sitio; las conexiones a Supabase pasan sin cambios.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (new URL(pedido.url).origin !== self.location.origin) return;
  if (pedido.cache === 'only-if-cached' && pedido.mode !== 'same-origin') return;

  evento.respondWith(
    fetch(pedido).then((respuesta) => {
      if (respuesta.status === 0 || respuesta.type === 'opaque') return respuesta;
      const encabezados = new Headers(respuesta.headers);
      encabezados.set('Cross-Origin-Embedder-Policy', 'require-corp');
      encabezados.set('Cross-Origin-Opener-Policy', 'same-origin');
      encabezados.set('Cross-Origin-Resource-Policy', 'same-origin');
      return new Response(respuesta.body, { status: respuesta.status, statusText: respuesta.statusText, headers: encabezados });
    }),
  );
});
