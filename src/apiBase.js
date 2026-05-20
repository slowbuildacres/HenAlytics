const PRODUCTION_API_HOST = 'https://henalytics.com';

function isNative() {
  if (typeof window === 'undefined') return false;
  return !!(
    window.Capacitor &&
    window.Capacitor.isNativePlatform &&
    window.Capacitor.isNativePlatform()
  );
}

export const API_BASE = isNative() ? PRODUCTION_API_HOST : '';

export function apiUrl(path) {
  if (!path) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return API_BASE + path;
}
