// Service worker mínimo.
//
// Existe por dois motivos:
//   1. O Chrome só considera o app instalável (e só dispara o
//      `beforeinstallprompt`) quando há um service worker com handler de fetch.
//   2. No balcão a rede oscila — assets estáticos servidos do cache evitam
//      rebaixar o app inteiro a cada oscilação.
//
// O que este arquivo deliberadamente NÃO faz: cachear navegação ou respostas de
// API. HTML e dados precisam ser sempre frescos; servir uma tela de pedidos
// desatualizada do cache seria pior do que esperar a rede.

const VERSION = "cidadela-v1";
const STATIC_CACHE = `${VERSION}-static`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(STATIC_CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)));
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
