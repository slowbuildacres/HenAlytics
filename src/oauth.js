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
// Apple account deletion: Apple requires apps with Sign in with Apple to revoke
// the user's Apple tokens when they delete their account (App Store guideline
// 5.1.1(v)). Supabase hands us Apple's refresh token only once, right after
// sign-in (provider_refresh_token), so we stash it server-side then
// (save_apple_refresh_token RPC → public.apple_auth_tokens, unreadable from the
// app) and api/delete-account.js revokes it with Apple.
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
const PROVIDER_HINT_KEY = 'henalytics_oauth_provider';

export async function startOAuth(provider) {
  if (!isSupabaseConfigured) throw new Error("Sign-in isn't configured yet.");
  // Remember which provider this sign-in is for, so the provider token that
  // comes back can be attributed (a user may have both Google and Apple linked).
  try { localStorage.setItem(PROVIDER_HINT_KEY, provider); } catch (_) {}
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
    for (const k of ['access_token', 'refresh_token', 'provider_refresh_token', 'code', 'error', 'error_description']) {
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
      await captureProviderToken(p.provider_refresh_token);
      return { ok: true };
    }
    if (p.code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(p.code);
      await close();
      if (error) return { ok: false, message: error.message };
      await captureProviderToken(data?.session?.provider_refresh_token);
      return { ok: true };
    }
    await close();
    return { ok: false, message: 'Sign-in didn’t finish. Please try again.' };
  } catch (e) {
    await close();
    return { ok: false, message: e?.message || 'Sign-in failed. Please try again.' };
  }
}

// Called with the provider refresh token from a fresh OAuth sign-in (native
// callback above, or the web SIGNED_IN event in HomesteadApp). Only Apple's is
// kept. Never throws; a failure just means deletion can't revoke with Apple.
export async function captureProviderToken(providerRefreshToken) {
  let hint = null;
  try { hint = localStorage.getItem(PROVIDER_HINT_KEY); localStorage.removeItem(PROVIDER_HINT_KEY); } catch (_) {}
  if (!providerRefreshToken || hint !== 'apple' || !isSupabaseConfigured) return;
  try {
    await supabase.rpc('save_apple_refresh_token', { p_token: String(providerRefreshToken) });
  } catch (_) { /* table not created yet, offline, etc. */ }
}
