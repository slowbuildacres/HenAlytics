import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Service worker config for offline app-shell support.
//
// Why this exists: without a service worker, opening henalytics.com with
// no network shows the browser's connection-error page — the user never
// reaches our React code, so all the work the app does to handle offline
// state in JS is moot. With the service worker, the built JS/CSS/HTML
// are cached on first visit and served from cache on subsequent loads,
// so the app opens even with no network and the in-app offline UX takes
// over from there.
//
// Native (Capacitor) users don't need this — their HTML/JS are bundled
// into the app binary and always load offline. The service worker only
// matters on the web build (henalytics.com via Vercel). VitePWA's
// auto-detection of asset paths handles both fine.
//
// Critical: Supabase API calls (auth + data) must NEVER be served from
// cache. Serving stale auth tokens or stale data blobs would corrupt the
// sync layer. The runtimeCaching rule below uses NetworkOnly for any
// supabase.co URL — meaning the service worker doesn't intercept those
// requests at all, they go straight to the network. If the network is
// down, they fail (which is what we want — sync.js's catch blocks handle
// that gracefully and the app shows the offline banner).
//
// registerType 'autoUpdate' means new versions install in the background
// and activate on next page load. No "please reload" prompt — users get
// updates seamlessly. cleanupOutdatedCaches removes old cached assets
// from prior builds so the user's storage doesn't fill up.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Henalytics',
        short_name: 'Henalytics',
        description: 'Homestead tracking — gardens, chickens, eggs, and everything in between',
        theme_color: '#2C1810',
        background_color: '#F4EDE0',
        display: 'standalone',
      },
      workbox: {
        // Precache the built static assets (JS, CSS, HTML, fonts, images).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // The main app bundle is large (~2.4 MB) because HomesteadApp.jsx is
        // a single big file. The default precache size limit is 2 MiB, which
        // would exclude the main chunk from the service worker — meaning the
        // app shell wouldn't actually load offline (the whole point). Raise
        // the limit to 5 MiB to fit it with headroom. If the bundle ever
        // grows past this, bump it again (or code-split, which is the real
        // long-term fix per the build warning).
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Clean up assets from earlier builds.
        cleanupOutdatedCaches: true,
        // Fall back to index.html for navigation requests so SPA routes
        // work offline (e.g. /chickens, /garden).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /\/rest\/v1\//,
          /\/auth\/v1\//,
        ],
        runtimeCaching: [
          {
            // Supabase API: always go to network. NEVER cache auth or data.
            urlPattern: /^https:\/\/[^.]+\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Google Fonts: cache-first, fonts rarely change.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
});
