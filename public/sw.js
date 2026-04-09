// CapitalOS PWA service worker — read-only offline cache for the iPad PWA.
// Network-first for pages and GET API calls; falls back to the cache when
// offline so previously-viewed data stays visible. Mutations (POST/PUT/
// PATCH/DELETE) are NEVER cached and will fail naturally when offline.

const CACHE = "capitalos-v1";
const OFFLINE_ALLOWLIST = ["/", "/login"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_ALLOWLIST)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle same-origin GETs. Everything else (mutations, cross-origin)
  // passes through untouched.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache auth-sensitive endpoints.
  if (url.pathname.startsWith("/api/login") || url.pathname === "/login") {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request);
        // Only cache successful responses.
        if (fresh.ok) {
          const cache = await caches.open(CACHE);
          cache.put(request, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        // For navigation requests, fall back to root.
        if (request.mode === "navigate") {
          const rootFallback = await caches.match("/");
          if (rootFallback) return rootFallback;
        }
        return new Response("Offline", {
          status: 503,
          headers: { "content-type": "text/plain" },
        });
      }
    })(),
  );
});
