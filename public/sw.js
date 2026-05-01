/* Henalytics service worker — minimal, safe, and self-updating.
 *
 * What this does:
 *  - Caches the app shell (HTML/CSS/JS/icons) so the app loads instantly
 *    on repeat visits and works offline once it's been opened once.
 *  - Uses "stale-while-revalidate" for static assets: serve from cache
 *    immediately, refresh from network in the background.
 *  - Bypasses caching entirely for:
 *     - API calls (/api/*)
 *     - Supabase requests (auth, database, storage)
 *     - Resend, weather APIs, anything cross-origin we don't control
 *
 * What this does NOT do:
 *  - Cache user data. The app already handles that via localStorage
 *    + Supabase. Service worker has no business caching API responses
 *    here — users could see stale data and that's worse than offline.
 */

const CACHE_NAME = "henalytics-v1";

// On install: pre-cache the bare minimum so first-load offline works.
// We don't pre-cache JS bundles because their filenames are hashed by Vite —
// the runtime fetch handler will cache them as they're requested.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        "/",
        "/manifest.webmanifest",
        "/icon-192.png",
        "/icon-512.png",
        "/apple-touch-icon.png",
      ]).catch(() => { /* Ignore individual asset failures */ })
    )
  );
  self.skipWaiting(); // Activate immediately — don't wait for old tabs
});

// On activate: clean up old caches from previous deploys.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => k !== CACHE_NAME ? caches.delete(k) : null))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Bypass for cross-origin (Supabase, Resend, weather APIs, etc.)
  if (url.origin !== self.location.origin) return;

  // Bypass for API routes (our serverless functions)
  if (url.pathname.startsWith("/api/")) return;

  // Bypass for Supabase storage signed URLs (just in case they're somehow same-origin)
  if (url.pathname.includes("/storage/")) return;

  // App shell + assets: stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            // Only cache same-origin successful responses
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        })
        .catch(() => cached); // If network fails, fall back to cached

      // Return cached immediately if we have it; otherwise wait for network
      return cached || network;
    })
  );
});
