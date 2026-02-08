// Lilo PWA Service Worker
// Provides full offline support via cache-first strategy.

const CACHE_VERSION = "v1";
const CACHE_NAME = `lilo-${CACHE_VERSION}`;

// Local app shell files.
const APP_SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/pdf-export.js",
  "/dmc-palette.js",
  "/dmc-anchor-map.js",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/manifest.json",
];

// CDN dependencies — pinned versions for reliable caching.
const CDN_DEPS = [
  "https://cdn.jsdelivr.net/npm/alpinejs@3.15.8/dist/cdn.min.js",
  "https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js",
  "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
  "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js",
  "https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/solid.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/fa-solid-900.ttf",
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&display=swap",
];

// Install: pre-cache app shell and CDN deps.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache local files (same-origin, simple).
      const localPromise = cache.addAll(APP_SHELL);

      // Cache CDN deps one-by-one so failures are isolated and logged.
      // Use no-cors for cross-origin resources that don't send CORS headers.
      const cdnPromise = Promise.all(
        CDN_DEPS.map((url) =>
          fetch(url, { mode: "cors" })
            .catch(() => fetch(url, { mode: "no-cors" }))
            .then((response) => cache.put(url, response))
            .catch((err) =>
              console.warn(`[SW] Failed to cache CDN dep: ${url}`, err)
            )
        )
      );

      return Promise.all([localPromise, cdnPromise]);
    })
  );
  // Activate immediately instead of waiting for old tabs to close.
  self.skipWaiting();
});

// Activate: clean up old versioned caches.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("lilo-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  // Take control of all open tabs immediately.
  self.clients.claim();
});

// Fetch: cache-first, fall back to network, cache successful network responses.
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests.
  if (request.method !== "GET") return;

  // Skip chrome-extension and other non-http(s) schemes.
  if (!request.url.startsWith("http")) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Don't cache non-ok responses or opaque responses from no-cors.
          if (!response || response.status !== 200) return response;

          // Cache the new response for future use.
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // If both cache and network fail, return a basic offline response
          // for navigation requests.
          if (request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });
    })
  );
});
