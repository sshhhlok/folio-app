// Caches the app shell so re-opening (after iOS suspends the PWA) is instant.
// All caches use is guarded so it never throws on iOS standalone.
const CACHE = "folio-v3";
const has = (typeof caches !== "undefined");

self.addEventListener("install", (e) => {
  self.skipWaiting();
  if (has) e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/index.html"])).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  if (has) e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).catch(() => {}));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (!has) return;
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/") || url.hostname.includes("supabase")) return; // never cache data/auth
  // Cache-first for the app shell (instant relaunch), network-update in background.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const net = fetch(e.request).then((res) => {
        caches.open(CACHE).then((c) => c.put(e.request, res.clone())).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
