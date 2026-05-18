// Vercel serverless function: GET /api/supporter-status
//
// Returns whether the AUTHENTICATED caller is currently a monthly supporter.
// This is the single source of truth for "is this user a supporter right
// now" — used by the early-access gate (Step 2) and anything else that
// needs current supporter status.
//
// Why this endpoint exists:
//   Before this, the app had no reliable current-supporter check.
//   - list-supporters.js answers "who was on the wall last month" (historical,
//     public, no per-user lookup).
//   - IapManager.hasActiveSubscription() is RevenueCat-only (native iOS/Android
//     only) and says nothing for web users.
//   The early-access gate needs ONE answer that works on web AND native, for
//     both Stripe and RevenueCat subscribers. That is this endpoint.
//
// What counts as a "supporter" for early access (decided in Step 2):
//   - payment_type = 'monthly'   (one-time tippers do NOT get early access —
//                                  the subscription must carry the ongoing
//                                  value for Apple Guideline 3.1.2)
//   - status in ('active','past_due')   (past_due = renewal retrying; they
//                                          are still a supporter until the
//                                          subscription actually lapses)
//   A 'canceled' subscription does NOT count, even if canceled mid-period.
//   (Simple and predictable. If you later want to honor the paid-through
//   period after cancellation, that needs a period-end column to check.)
//
// Security:
//   - JWT-authed. A user can only ask about THEMSELVES — status is looked up
//     by the user_id inside their verified token, never from a query param.
//   - Returns no Stripe IDs, no emails — just { isSupporter, tier, since }.
//
// Required env vars:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = new Set([
  'https://henalytics.com',
  'https://www.henalytics.com',
]);

function getCorsOrigin(origin) {
  if (!origin) return 'https://henalytics.com';
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  // Native app uses capacitor://; localhost for dev. This endpoint requires
  // auth and returns only the caller's own status, so this is safe.
  if (origin.startsWith('capacitor://') || origin.startsWith('http://localhost')) return origin;
  return 'https://henalytics.com';
}

let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin not configured');
  _supabaseAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _supabaseAdmin;
}

// ============================================================================
// AUTH — verify Supabase JWT (same pattern as create-checkout-session)
// ============================================================================
async function verifyAuth(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authentication required');
  }
  const jwt = authHeader.slice(7).trim();
  if (!jwt) throw new Error('Authentication required');

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user) {
    throw new Error('Invalid or expired session');
  }
  return data.user;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
export default async function handler(req, res) {
  const corsOrigin = getCorsOrigin(req.headers.origin);

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', corsOrigin);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ---- Auth ----
  let user;
  try {
    user = await verifyAuth(req);
  } catch (e) {
    return res.status(401).json({ error: e.message || 'Authentication required' });
  }

  // ---- Query supporters for an active monthly subscription ----
  // A user may have more than one row (e.g. an old one-time tip plus a
  // current subscription, or a lapsed sub plus a new one). We fetch the
  // qualifying monthly rows and pick the highest tier as the reported tier.
  let rows;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('supporters')
      .select('payment_type, status, amount_dollars, started_at, original_started_at')
      .eq('user_id', user.id)
      .eq('payment_type', 'monthly')
      .in('status', ['active', 'past_due']);
    if (error) {
      console.error('[supporter-status] query failed:', error);
      return res.status(500).json({ error: 'Could not load supporter status.' });
    }
    rows = data || [];
  } catch (e) {
    console.error('[supporter-status] error:', e);
    return res.status(500).json({ error: 'Could not load supporter status.' });
  }

  if (rows.length === 0) {
    // Not a current monthly supporter. (They may still be a one-time tipper —
    // that is intentionally not reported here, because one-time tips do not
    // grant early access.)
    return res.status(200).json({ isSupporter: false, tier: null, since: null });
  }

  // Highest amount_dollars = reported tier. amount_dollars can be null on
  // legacy/unknown rows — treat null as 0 for ranking so a known tier wins.
  let best = rows[0];
  for (const r of rows) {
    const a = typeof r.amount_dollars === 'number' ? r.amount_dollars : 0;
    const b = typeof best.amount_dollars === 'number' ? best.amount_dollars : 0;
    if (a > b) best = r;
  }

  // "since" = the earliest start across qualifying rows (longest tenure).
  let since = null;
  for (const r of rows) {
    const s = r.original_started_at || r.started_at;
    if (s && (!since || s < since)) since = s;
  }

  // Short edge cache. Status changes rarely; this keeps the gate snappy
  // without hammering Supabase on every app open. Per-user (auth-scoped),
  // so a CDN won't cross-contaminate users — but keep it private to be safe.
  res.setHeader('Cache-Control', 'private, max-age=300');

  return res.status(200).json({
    isSupporter: true,
    tier: typeof best.amount_dollars === 'number' ? best.amount_dollars : null,
    since,
  });
}
