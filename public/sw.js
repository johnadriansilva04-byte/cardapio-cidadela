// Service worker — caching + push notifications.
//
// Responsibilities:
//   1. Cache hashed assets under /assets/ for offline resilience at the balcão.
//   2. Handle Firebase Cloud Messaging (FCM) push events so notifications
//      appear even when the app is closed or the browser is minimized.
//
// What this file deliberately does NOT do:
//   - Cache navigation or API responses.  HTML and data must always be fresh;
//     serving stale orders from cache would be worse than waiting for the network.

const VERSION = "cidadela-v2";
const STATIC_CACHE = `${VERSION}-static`;

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

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
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
// Push notifications (FCM)
// ──────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = { title: "Cardápio Cidadela", body: "Novo pedido recebido!", url: "/mobile" };

  if (event.data) {
    try {
      const payload = event.data.json();
      // FCM HTTP v1 delivers { message: { notification, data } } — older
      // code merged the envelope directly and lost title/body.
      const message = payload.message || payload;
      const notification = message.notification || {};
      const msgData = message.data || {};

      data = {
        ...data,
        title: notification.title || msgData.title || data.title,
        body: notification.body || msgData.body || data.body,
        url: msgData.url || data.url,
        orderId: msgData.orderId,
        tag: msgData.tag,
      };
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

// Handle FCM background messages (when app is closed)
// This is the Firebase-specific handler — it fires for messages sent via
// Firebase Messaging SDK (admin) with the `data` field.
self.addEventListener("message", (event) => {
  if (event.data?.type === "FCM_MSG") {
    const payload = event.data.payload || event.data;
    const notification = payload.notification || {};
    const data = payload.data || {};

    self.registration.showNotification(notification.title || "Cardápio Cidadela", {
      body: notification.body || "Novo pedido recebido!",
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
    });
  }
});
