import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { computeHarvestValue, FALLBACK_PRICE } from './src/gardenValue.js';

// The public calculator page (henalytics.com/garden-value, garden-value.html).
// Two small build hooks, both scoped to that one HTML file:
//
// 1. Its static copy quotes a few example prices. Fill them in from
//    gardenValue.js so the copy can't drift from the price table:
//      {{price:<crop>|<unit>}} → value of 1 <unit> of <crop>, e.g. "$2.50"
//      {{fallback|<slot>}}     → FALLBACK_PRICE[slot]
// 2. vite-plugin-pwa injects the manifest link and service-worker
//    registration into every HTML entry. The calculator is a landing page,
//    not the app: registering there would precache the whole ~3.5 MB app
//    on a visitor's phone data, and the manifest (no start_url) would make
//    "Add to Home Screen" install the calculator instead of the app. So
//    strip both from this page only. Must run after VitePWA, hence the
//    'post' order and its place after VitePWA() in the plugin list.
const isGardenValuePage = (ctx) => /garden-value\.html$/.test(ctx.filename || ctx.path || '');
function gardenValuePage() {
  const usd = (n) => '$' + Number(n).toFixed(2);
  return [
    {
      name: 'henalytics-garden-value-copy',
      transformIndexHtml: {
        order: 'pre',
        handler(html, ctx) {
          if (!isGardenValuePage(ctx)) return html;
          return html
            .replace(/\{\{price:([^|}]+)\|([a-z]+)\}\}/g, (_, plant, unit) =>
              usd(computeHarvestValue([{ plant, quantity: 1, unit }]).total))
            .replace(/\{\{fallback\|(lb|each|bunch)\}\}/g, (_, slot) => usd(FALLBACK_PRICE[slot]));
        },
      },
    },
    {
      name: 'henalytics-garden-value-no-pwa',
      enforce: 'post',
      apply: 'build',
      transformIndexHtml: {
        order: 'post',
        handler(html, ctx) {
          if (!isGardenValuePage(ctx)) return html;
          return html
            .replace(/<link rel="manifest"[^>]*>/g, '')
            .replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/g, '');
        },
      },
    },
  ];
}

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
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        // Public "What's your garden worth?" calculator, served at /garden-value
        gardenValue: fileURLToPath(new URL('./garden-value.html', import.meta.url)),
      },
    },
  },
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
          /^\/cal\//,          // live calendar feed (.ics)
          /^\/garden-value/,   // public garden value calculator (own page)
          /^\/s\//,            // public share-card pages (henalytics.com/s/<id>)
          /^\/o\//,            // public order pages (henalytics.com/o/<token>)
          /^\/\.well-known\//,  // Apple / Android app association files
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
    gardenValuePage(),
  ],
});
