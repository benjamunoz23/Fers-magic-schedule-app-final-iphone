// sw.js — Service Worker para "Fer's Magic Schedule"
// Solo funciona en un dominio real (GitHub Pages, Netlify, Vercel, etc.), con
// sw.js en la MISMA carpeta que index.html. En una vista previa sin hosting
// propio el registro falla en silencio y la app funciona igual sin él.
//
// v2: estrategia "red primero" para el HTML. La versión anterior (v1) usaba
// "caché primero", lo que dejaba la app mostrando una versión vieja congelada
// cada vez que se actualizaba el código sin también cambiar este archivo —
// eso era lo que se sentía como que "la pantalla no se movía". Ahora, si hay
// internet, siempre se pide la versión más nueva; el caché solo se usa como
// respaldo cuando no hay conexión.

const CACHE_NAME = "fers-magic-schedule-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const isPage = event.request.mode === "navigate" || event.request.destination === "document";

  if (isPage) {
    // Red primero: siempre intenta traer la versión más nueva. Si funciona,
    // además actualiza el caché para que quede disponible offline. Si no hay
    // internet, recién ahí usa lo último que se guardó en caché.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Para el resto (fuentes, íconos, etc.): caché primero, con la red como respaldo.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).catch(() => cached)
      );
    })
  );
});

// Si en el futuro conectas un servidor de Web Push real, este handler
// recibiría el push y mostraría la notificación aunque la app esté cerrada.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || "Fer's Magic Schedule";
  const body = data.body || "";
  event.waitUntil(self.registration.showNotification(title, { body }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientsArr) => {
      if (clientsArr.length > 0) return clientsArr[0].focus();
      return self.clients.openWindow("./index.html");
    })
  );
});
