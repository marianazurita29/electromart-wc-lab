// sw.js: service worker for the ElectroMart CCC app.
// Network-first: always try the network so a merged change shows up,
// and fall back to the saved copy when the device is offline.
// Every path is relative, because the site lives at
// https://<username>.github.io/<repository>/ and not at the root of a domain.

const CACHE = "electromart-ccc-v1";

const APP_FILES = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "ccc.js",
  "manifest.webmanifest",
  "data/electromart.csv",
  "data/assumptions.csv",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

// Save a first copy of every app file so the app opens offline after one visit.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_FILES)).then(() => self.skipWaiting())
  );
});

// Remove copies left by older versions of this service worker.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests for this app's own files.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    // "no-cache" makes the browser check with the server instead of reusing a stale copy.
    fetch(request, { cache: "no-cache" })
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request, { ignoreSearch: true }).then((saved) => {
          if (saved) return saved;
          // Offline and not saved: for a page visit, show the app's main page.
          if (request.mode === "navigate") return caches.match("index.html");
          return Response.error();
        })
      )
  );
});
