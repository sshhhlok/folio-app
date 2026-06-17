// Minimal, iOS-safe service worker.
// No fetch interception — avoids the CacheStorage ("caches") issue that
// breaks home-screen apps on some iPhones. App stays installable.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) { /* ignore */ }
    await self.clients.claim();
  })());
});
