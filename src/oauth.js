// ============================================================================
// GOOGLE / APPLE SIGN-IN (Supabase OAuth)
// ----------------------------------------------------------------------------
// Web: a normal redirect. Supabase sends the user back to this site and
//   supabase-js (detectSessionInUrl) picks the session out of the URL.
//
// Native (Capacitor): Google blocks sign-in inside embedded WebViews, so we
//   open the provider page in the system browser sheet (@capacitor/browser:
//   SFSafariViewController / Chrome Custom Tab). Supabase redirects to
//   henalytics://auth-callback#access_token=...&refresh_token=..., the OS hands
//   that URL to the app (appUrlOpen), and handleAuthCallbackUrl() turns it into
//   a session.
//
// Which buttons show is controlled remotely by the app_config row
// id = "auth_providers", value = { "google": true, "apple": true }, so the
// buttons can be switched on after the providers are configured in Supabase,
// without shipping an app update. No row → no buttons.
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase.js';

export const NATIVE_AUTH_REDIRECT = 'henalytics://auth-callback';

export function isNativeApp() {
  if (typeof window === 'undefined') return false;
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

export function nativePlatform() {
  try { return window.Capacitor?.getPlatform?.() || 'web'; } catch (_) { return 'web'; }
}

let _browser = null;
function browserPlugin() {
  if (_browser) return _browser;
  try {
    const cap = window.Capacitor;
    _browser = (cap && cap.Plugins && cap.Plugins.Browser) || (cap && cap.registerPlugin && cap.registerPlugin('Browser')) || null;
  } catch (_) { _browser = null; }
  return _browser;
}

// Remote switch for which providers are offered. Cached for the session.
let _providersPromise = null;
export function loadEnabledProviders() {
  if (!isSupabaseConfigured) return Promise.resolve({ google: false, apple: false });
  if (!_providersPromise) {
    _providersPromise = supabase
      .from('app_config').select('value').eq('id', 'auth_providers').maybeSingle()
      .then(({ data, error }) => {
        const v = !error && data && data.value && typeof data.value === 'object' ? data.value : {};
        return { google: v.google === true, apple: v.apple === true };
      })
      .catch(() => ({ google: false, apple: false }));
  }
  return _providersPromise;
}

// Start sign-in. On web this navigates away; on native it opens the browser
// sheet and resolves once it's open (the session arrives via the deep link).
export async function startOAuth(provider) {
  if (!isSupabaseConfigured) throw new Error("Sign-in isn't configured yet.");
  const native = isNativeApp();
  const queryParams = provider === 'google' ? { prompt: 'select_account' } : undefined;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: native ? NATIVE_AUTH_REDIRECT : window.location.origin,
      skipBrowserRedirect: native,
      ...(queryParams ? { queryParams } : {}),
    },
  });
  if (error) throw error;
  if (native) {
    const Browser = browserPlugin();
    if (!data?.url) throw new Error('Could not start sign-in.');
    if (Browser && typeof Browser.open === 'function') {
      await Browser.open({ url: data.url, presentationStyle: 'popover' });
    } else {
      window.location.href = data.url;
    }
  }
}

export function isAuthCallbackUrl(url) {
  return typeof url === 'string' && url.toLowerCase().startsWith(NATIVE_AUTH_REDIRECT);
}

// Pull tokens / code / error out of henalytics://auth-callback?...#...
export function parseAuthCallbackUrl(url) {
  const out = {};
  if (!isAuthCallbackUrl(url)) return out;
  const hashIdx = url.indexOf('#');
  const qIdx = url.indexOf('?');
  const query = qIdx !== -1 ? url.slice(qIdx + 1, hashIdx !== -1 && hashIdx > qIdx ? hashIdx : undefined) : '';
  const hash = hashIdx !== -1 ? url.slice(hashIdx + 1) : '';
  for (const part of [query, hash]) {
    const p = new URLSearchParams(part);
    for (const k of ['access_token', 'refresh_token', 'code', 'error', 'error_description']) {
      if (p.get(k)) out[k] = p.get(k);
    }
  }
  return out;
}

// Finish native sign-in. Returns { ok: true } or { ok: false, message }.
export async function handleAuthCallbackUrl(url) {
  const p = parseAuthCallbackUrl(url);
  const close = async () => {
    try { const B = browserPlugin(); if (B && B.close) await B.close(); } catch (_) {}
  };
  try {
    if (p.error || p.error_description) {
      await close();
      const msg = (p.error_description || p.error || '').replace(/\+/g, ' ');
      return { ok: false, message: msg || 'Sign-in was cancelled.' };
    }
    if (p.access_token && p.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: p.access_token, refresh_token: p.refresh_token,
      });
      await close();
      if (error) return { ok: false, message: error.message };
      return { ok: true };
    }
    if (p.code) {
      const { error } = await supabase.auth.exchangeCodeForSession(p.code);
      await close();
      if (error) return { ok: false, message: error.message };
      return { ok: true };
    }
    await close();
    return { ok: false, message: 'Sign-in didn’t finish. Please try again.' };
  } catch (e) {
    await close();
    return { ok: false, message: e?.message || 'Sign-in failed. Please try again.' };
  }
}
