/* Henalytics service worker — KILL SWITCH.
 *
 * Previous versions of the app registered a service worker that turned out
 * to interfere with auth redirects (specifically, password recovery from
 * Supabase). This file replaces the old service worker with one that
 * deliberately removes itself on activation.
 *
 * Once every active client has loaded this new version of sw.js, the old
 * cached service worker is gone and the site behaves like a normal SPA
 * again (no offline caching, no fetch interception).
 *
 * To bring caching back later, we'll wire up vite-plugin-pwa properly with
 * an explicit allowlist of routes that excludes auth callbacks.
 */

self.addEventListener("install", () => {
  // Don't wait for old SW to finish; activate this kill-switch immediately.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Delete all caches this SW (or its predecessor) created.
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) { /* ignore */ }

    // Take control of all open clients so we can unregister mid-session.
    try { await self.clients.claim(); } catch (_) {}

    // Unregister ourselves. Any future fetches will go straight to the
    // network with no SW interception.
    try { await self.registration.unregister(); } catch (_) {}

    // Force-reload all open clients so they see the freshly-fetched HTML
    // without the SW middleman. Without this, the current tab keeps using
    // the now-unregistered SW until the user manually refreshes.
    try {
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.navigate(client.url);
      }
    } catch (_) { /* not all browsers support client.navigate; ignore */ }
  })());
});

// No fetch handler — we don't want to intercept anything.
