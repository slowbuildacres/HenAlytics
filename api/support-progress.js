// Vercel serverless function: GET /api/support-progress
//
// How much of this month's running costs supporters cover, for the heart
// button on Home and the bar on the Support page. Public and anonymous: it
// returns only totals (no names, emails or IDs), so it needs no sign-in and
// can be cached at the edge.
//
// What counts toward a month:
//   - Every monthly membership that is active right now, at its monthly
//     amount (the steady amount coming in each month). Someone who turned off
//     auto-renew still counts until their paid month runs out, because the
//     webhooks keep them 'active' until then.
//   - Every one-time tip made this month.
//
// Amounts are after fees, so the bar never says more is covered than is:
//   - App Store / Google Play: they keep 15%
//   - Stripe (website): 2.9% + 30¢ per charge
//
// The goal is MONTHLY_COST_GOAL dollars (a Vercel env var; 300 if unset):
// servers, the plant scanner, email and store fees, not counting the time
// that goes into building Henalytics.
//
// Response: { month: "2026-11", goal, covered, percent, supporters }

import { createClient } from '@supabase/supabase-js';

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

// Pure math, exported for tests.
export function netDollars(row) {
  const amount = Number(row.amount_dollars) || 0;
  if (amount <= 0) return 0;
  const store = row.source === 'revenuecat' || (!row.source && row.revenuecat_user_id && !row.stripe_customer_id);
  const net = store ? amount * 0.85 : amount * 0.971 - 0.30;
  return Math.max(0, net);
}

export function summarize(rows, monthStart, monthEnd, goal) {
  let covered = 0;
  const people = new Set();
  for (const r of rows || []) {
    if (!r) continue;
    if (r.payment_type === 'monthly') {
      if (r.status !== 'active') continue;
    } else if (r.payment_type === 'one_time') {
      const t = r.started_at ? new Date(r.started_at) : null;
      if (!t || t < monthStart || t >= monthEnd) continue;
    } else continue;
    const net = netDollars(r);
    if (net <= 0) continue;
    covered += net;
    people.add(r.user_id || (r.email && String(r.email).toLowerCase()) || r.id);
  }
  covered = Math.round(covered);
  return {
    goal,
    covered,
    percent: goal > 0 ? Math.round((covered / goal) * 100) : 0,
    supporters: people.size,
  };
}

export default async function handler(req, res) {
  // Public totals only, so any origin may read it (and the edge cache can
  // serve one copy to the website and the apps alike).
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // This month in Central time (where Henalytics is run), as UTC bounds.
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: 'numeric' })
    .formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === 'year').value);
  const month = Number(parts.find((p) => p.type === 'month').value);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const goal = Number(process.env.MONTHLY_COST_GOAL) > 0 ? Number(process.env.MONTHLY_COST_GOAL) : 300;

  let rows;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('supporters')
      .select('id, user_id, email, source, revenuecat_user_id, stripe_customer_id, payment_type, status, amount_dollars, started_at')
      .or(`and(payment_type.eq.monthly,status.eq.active),and(payment_type.eq.one_time,started_at.gte.${monthStart.toISOString()})`);
    if (error) {
      console.error('[support-progress] query failed:', error);
      return res.status(500).json({ error: 'Could not load support totals.' });
    }
    rows = data || [];
  } catch (e) {
    console.error('[support-progress] error:', e);
    return res.status(500).json({ error: 'Could not load support totals.' });
  }

  // Ten minutes at the edge is plenty fresh for a progress bar.
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
  return res.status(200).json({
    month: `${year}-${String(month).padStart(2, '0')}`,
    ...summarize(rows, monthStart, monthEnd, goal),
  });
}
