// Change this version when changing the offline app's files.
const CACHE_PREFIX = "electromart-ccc-";
const CACHE_NAME = CACHE_PREFIX + "v1";
const APP_FILES = [
  "./", "./index.html", "./styles.css", "./ccc.js", "./app.js",
  "./manifest.webmanifest", "./data/electromart.csv", "./data/assumptions.csv",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_FILES.map((path) => new Request(
      new URL(path, self.registration.scope), { cache: "reload" }
    )));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) =>
      name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME
    ).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin ||
      !url.href.startsWith(self.registration.scope)) return;

  // Always try the latest file first; use the saved copy when offline.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request, { cache: "no-cache" });
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch (err) {
      const saved = await cache.match(request);
      if (saved) return saved;
      throw err;
    }
  })());
});
