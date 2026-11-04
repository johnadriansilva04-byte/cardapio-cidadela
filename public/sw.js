// Service worker — caching + push notifications.
//
// Responsibilities:
//   1. Cache hashed assets under /assets/ for offline resilience at the balcão.
//   2. Cache restaurant images (Cloudflare R2 + legacy Supabase Storage) — the heaviest egress source.
//   3. Handle native Web Push events so notifications appear
//      even when the app is closed or the browser is minimized.
//
// What this file deliberately does NOT do:
//   - Cache navigation or API responses.  HTML and data must always be fresh;
//     serving stale orders from cache would be worse than waiting for the network.

const VERSION = "cidadela-v4";
const STATIC_CACHE = `${VERSION}-static`;
const IMAGE_CACHE = `${VERSION}-images`;
// Teto de imagens guardadas. O cardápio de uma loja costuma ter < 60 fotos;
// 200 cobre várias lojas por dispositivo sem crescer sem limite.
const IMAGE_CACHE_LIMIT = 200;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(STATIC_CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * Fotos de restaurante entram no cache de imagens: as do R2
 * (images.pracinha.online, o destino novo) e as legadas do Supabase Storage.
 * No R2 a borda da Cloudflare já cacheia; o cache do navegador poupa a ida
 * seguinte, que é o que importa no celular do balcão.
 */
function isStorageImage(url) {
  if (url.hostname === "images.pracinha.online") return true;
  return (
    url.hostname.endsWith(".supabase.co") && url.pathname.includes("/storage/v1/object/public/")
  );
}

/** Mantém o cache de imagens dentro do teto, descartando as mais antigas. */
async function trimImageCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= IMAGE_CACHE_LIMIT) return;
  for (const key of keys.slice(0, keys.length - IMAGE_CACHE_LIMIT)) {
    await cache.delete(key);
  }
}

async function cacheFirstImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // URLs de imagem carregam timestamp no nome, então são imutáveis: guardar a
  // resposta (mesmo opaque, se houver) é seguro e economiza o próximo acesso.
  if (response.ok || response.type === "opaque") {
    await cache.put(request, response.clone());
    void trimImageCache(cache);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Imagens do Supabase Storage: cache-first (cross-origin, por isso vem antes
  // do filtro de mesma origem). Economiza egress do Supabase e acelera o
  // cardápio no segundo acesso.
  if (isStorageImage(url)) {
    event.respondWith(cacheFirstImage(request).catch(() => fetch(request)));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navegação e dados: sempre rede.
  if (request.mode === "navigate" || url.pathname.startsWith("/api/")) return;

  // Assets com hash no nome são imutáveis: cache-first é seguro.
  if (!url.pathname.startsWith("/assets/")) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    })(),
  );
});

// ──────────────────────────────────────────────────────────────
// Push notifications — Web Push nativo (payload plano enviado pela
// Edge Function notify-new-order)
// ──────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = { title: "Cardápio Cidadela", body: "Novo pedido recebido!", url: "/mobile" };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch {
      // If the push data isn't JSON, use it as the body
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || "cidadela-order",
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || "/mobile", orderId: data.orderId },
    actions: [
      { action: "open", title: "Ver pedido" },
      { action: "dismiss", title: "Dispensar" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/mobile";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url);
    }),
  );
});
