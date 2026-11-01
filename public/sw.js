/* Only public assets are cached. Tasks, notes, attachments, auth and RSC stay on the network. */
const CACHE_PREFIX = "tasktracker-public-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const OFFLINE_URL = "/offline.html";
const PUBLIC_ASSETS = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PUBLIC_ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

// Updating is explicit so an open form or note is never reloaded without consent.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      return (await caches.match(OFFLINE_URL)) || Response.error();
    }));
    return;
  }

  if (!url.pathname.startsWith("/_next/static/") && !PUBLIC_ASSETS.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      const cache = await caches.open(CACHE_NAME);
      // Full storage must not prevent loading an otherwise successful network response.
      await cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  })());
});
