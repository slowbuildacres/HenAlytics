// ============================================================================
// SHARED CORS HELPER
// ----------------------------------------------------------------------------
// Returns the Access-Control-Allow-Origin value for a request, accepting:
//   - Production web origins (henalytics.com, www.henalytics.com)
//   - Native app origins (capacitor://localhost) — for the Capacitor iOS/
//     Android builds, which load from a capacitor:// scheme
//   - Local dev origins (http://localhost:*) — for `npm run dev`
//
// Anything else falls back to the production origin, which effectively
// blocks the request via CORS (the browser will refuse the response).
//
// Defense-in-depth: endpoints still verify JWT auth server-side, so a
// successful CORS check by itself doesn't grant access. CORS just decides
// which origins are allowed to receive a response.
// ============================================================================

const ALLOWED_WEB_ORIGINS = new Set([
  'https://henalytics.com',
  'https://www.henalytics.com',
]);

export function getCorsOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return 'https://henalytics.com';
  if (ALLOWED_WEB_ORIGINS.has(origin)) return origin;
  // Capacitor native build (iOS, Android)
  if (origin.startsWith('capacitor://')) return origin;
  // Local dev (any port on localhost)
  if (origin.startsWith('http://localhost') || origin.startsWith('https://localhost')) return origin;
  return 'https://henalytics.com';
}
