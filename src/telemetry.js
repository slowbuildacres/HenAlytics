// ============================================================================
// TELEMETRY — crash reports + "used the app today"
// ----------------------------------------------------------------------------
// Both write straight to Supabase tables created by
// supabase/migrations/20261103_activity_and_errors.sql:
//
//   client_errors  — uncaught errors, unhandled promise rejections, and React
//                    render crashes (ErrorBoundary). Insert-only from the
//                    app; read them in the dashboard: select * from admin.top_errors
//   activity_days  — one row per signed-in user per day they open the app.
//                    Feeds admin.retention_by_signup_week / admin.weekly_actives.
//
// Privacy: no homestead data, no emails. Errors carry the message, a trimmed
// stack, the page/hobby name, platform and app version. Activity is just
// (user id, date, platform).
//
// Everything fails silently: if the tables don't exist yet, or the device is
// offline, nothing breaks.
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase.js';
import { version as APP_VERSION } from '../package.json';

function platform() {
  try {
    const cap = typeof window !== 'undefined' && window.Capacitor;
    if (cap && cap.isNativePlatform && cap.isNativePlatform()) return cap.getPlatform();
  } catch (_) {}
  return 'web';
}

function localDay(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// Crash reports
// ---------------------------------------------------------------------------

// Noise that isn't a bug in Henalytics: browser quirks, extensions, offline.
const IGNORE = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /Failed to fetch/i,
  /Load failed/i,
  /NetworkError/i,
  /The network connection was lost/i,
  /AbortError/i,
  /chrome-extension:\/\//i,
  /safari-extension:\/\//i,
];

const MAX_PER_SESSION = 15;
let _sent = 0;
const _seen = new Set();
let _context = () => ({});

function trim(s, n) {
  if (s == null) return null;
  const str = String(s);
  return str.length > n ? str.slice(0, n) : str;
}

export function reportError(err, info = {}) {
  try {
    if (!isSupabaseConfigured || !supabase) return;
    const message = trim(
      (err && (err.message || err.reason?.message)) || (typeof err === 'string' ? err : '') || String(err),
      500,
    ) || 'Unknown error';
    if (IGNORE.some((re) => re.test(message))) return;
    if (_sent >= MAX_PER_SESSION) return;
    const key = `${info.kind || 'error'}|${message}`;
    if (_seen.has(key)) return; // once per session per distinct error
    _seen.add(key);
    _sent += 1;

    let ctx = {};
    try { ctx = _context() || {}; } catch (_) {}
    const stack = [err && err.stack, info.componentStack].filter(Boolean).join('\n--- component ---\n');

    let url = null;
    try { url = trim(window.location.pathname + window.location.search.replace(/token=[^&]+/gi, 'token=…'), 300); } catch (_) {}

    supabase.from('client_errors').insert({
      platform: platform(),
      app_version: trim(APP_VERSION, 40),
      page: trim(info.page || ctx.page || null, 120),
      kind: trim(info.kind || 'error', 40),
      message,
      stack: trim(stack || null, 4000),
      url,
    }).then(() => {}, () => {});
  } catch (_) { /* never let reporting throw */ }
}

// Call once at startup. getContext() should return { page } describing where
// the user is (e.g. "garden/home") so reports say which screen broke.
export function initErrorReporting(getContext) {
  if (typeof window === 'undefined' || window.__henalyticsErrorsInit) return;
  window.__henalyticsErrorsInit = true;
  if (typeof getContext === 'function') _context = getContext;

  window.addEventListener('error', (ev) => {
    // Resource load errors (img/script 404) have no .error — skip those.
    if (!ev || (!ev.error && !ev.message)) return;
    reportError(ev.error || ev.message, { kind: 'uncaught' });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev && ev.reason;
    if (!r) return;
    reportError(r instanceof Error ? r : (r.message ? r : String(r)), { kind: 'promise' });
  });
}

// ---------------------------------------------------------------------------
// Activity — "this person used the app today" (once per user per day)
// ---------------------------------------------------------------------------
export function recordActiveDay(userId) {
  try {
    if (!userId || !isSupabaseConfigured || !supabase) return;
    const today = localDay();
    const key = `henalytics_active_day_${userId}`;
    try { if (localStorage.getItem(key) === today) return; } catch (_) {}
    supabase.from('activity_days')
      .upsert({ user_id: userId, day: today, platform: platform() }, { onConflict: 'user_id,day', ignoreDuplicates: true })
      .then(({ error }) => {
        if (!error) { try { localStorage.setItem(key, today); } catch (_) {} }
      }, () => {});
  } catch (_) {}
}
