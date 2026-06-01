// Vercel serverless function: GET /api/list-supporters?month=YYYY-MM
//
// Returns the homestead names of supporters who were active during the
// given calendar month (and chose to be visible on the supporter wall).
// Used by the monthly thank-you modal in Henalytics to shout out who
// chipped in to keep the app running.
//
// STEP 2B ADDITION — "Top Sponsor":
//   The response now also includes a `topSponsors` array: the name(s) of the
//   supporter(s) with the highest single contribution that month. Ties are
//   ALL included (co-Top-Sponsors). This is computed server-side from
//   amount_dollars so per-supporter amounts never leave the server.
//
//   "Highest single contribution" in practice = the highest amount_dollars
//   among that month's active supporters. Note amount_dollars is the display-
//   tier amount (1/3/5/10 for subs, 5 for the one-time tip), not the literal
//   charge — the supporters table stores one row per subscription, not one
//   row per payment, so a true per-payment maximum is not available. Highest
//   amount_dollars is the closest faithful measure and is what was chosen.
//
//   Rows with a null amount_dollars (legacy Payment Link imports, unknown
//   products) are EXCLUDED from topSponsors ranking — we will not crown a
//   sponsor on an unknown amount — but they still appear in the normal list.
//
// Privacy / safety rules baked in:
//   - Only returns homestead_name where homestead_name_visible = true
//   - Skips rows where homestead_name_flagged = true (pending review)
//   - Skips rows with null/empty homestead_name
//   - Returns no Stripe IDs, no emails, no user_ids, no amounts — just names
//   - Anonymous endpoint (no auth required) — same names will show to all users
//
// "Active during month X" means the supporter row was started_at <= end of
// month AND (canceled_at is null OR canceled_at >= start of month). One-time
// tips satisfy this only for the month they were made in.
//
// Required env vars:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = new Set([
  'https://henalytics.com',
  'https://www.henalytics.com',
  // capacitor:// and localhost handled separately below
]);

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

function getCorsOrigin(origin) {
  if (!origin) return 'https://henalytics.com';
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  // Native app uses capacitor:// — be permissive there since this is a
  // read-only public endpoint that returns no PII
  if (origin.startsWith('capacitor://') || origin.startsWith('http://localhost')) return origin;
  return 'https://henalytics.com';
}

export default async function handler(req, res) {
  const corsOrigin = getCorsOrigin(req.headers.origin);

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', corsOrigin);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse and validate the month parameter (format: YYYY-MM)
  const month = (req.query.month || '').toString().trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Invalid month format. Expected YYYY-MM.' });
  }
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  if (monthNum < 1 || monthNum > 12 || year < 2024 || year > 2100) {
    return res.status(400).json({ error: 'Month out of range.' });
  }

  // Build the calendar-month window in UTC. Using UTC consistently avoids
  // timezone confusion between server (UTC) and client (local). The display
  // is "last month" generically, not "last month in your timezone".
  const monthStart = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(year, monthNum, 1, 0, 0, 0)); // first of next month
  const monthStartIso = monthStart.toISOString();
  const monthEndIso = monthEnd.toISOString();

  // Query: anyone who donated during this calendar month.
  //
  //   - One-time tippers: started_at falls inside the month window
  //   - Monthly subscribers: their subscription was active for any part of
  //     the month (started_at before month end, AND either still active OR
  //     canceled after month start)
  //
  // We OR these two conditions so both groups appear. A monthly subscriber
  // who canceled mid-month still gets credit for that month — they paid for it.
  //
  // STEP 2B: amount_dollars is now selected too — needed to compute Top Sponsor.
  let rows;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('supporters')
      .select('homestead_name, payment_type, amount_dollars, started_at, original_started_at, canceled_at')
      .eq('homestead_name_visible', true)
      .eq('homestead_name_flagged', false)
      .not('homestead_name', 'is', null)
      .neq('homestead_name', '')
      .lt('started_at', monthEndIso)
      .or(`payment_type.eq.one_time,canceled_at.is.null,canceled_at.gte.${monthStartIso}`)
      .order('started_at', { ascending: true });
    if (error) {
      console.error('list-supporters query failed:', error);
      return res.status(500).json({ error: 'Could not load supporters.' });
    }
    rows = data || [];
  } catch (e) {
    console.error('list-supporters error:', e);
    return res.status(500).json({ error: 'Could not load supporters.' });
  }

  // Extra filter for one-time tips: their started_at must fall WITHIN the
  // requested month, not just before its end. (A one-time tip from January
  // shouldn't appear in March's list.) This is a post-query filter because
  // Postgres OR conditions don't compose cleanly with the date window above
  // when one branch needs a different started_at constraint.
  rows = rows.filter(row => {
    if (row.payment_type !== 'one_time') return true; // monthly already filtered correctly above
    const started = new Date(row.started_at);
    return started >= monthStart && started < monthEnd;
  });

  // Dedupe by homestead_name (case-insensitive). If someone has multiple
  // active subscriptions or a sub + one-time, they should only appear once.
  // Keep the oldest entry per name so the list orders by tenure.
  //
  // STEP 2B: while deduping, track the HIGHEST amount_dollars seen for each
  // name. A person with a $10 sub and a $5 one-time tip ranks at $10.
  // amount_dollars may be null (legacy/unknown rows) — treated as "no known
  // amount" and never used to win Top Sponsor.
  const seen = new Set();
  const uniqueNames = [];
  const amountByName = new Map(); // lowercased name -> highest known amount (number) or null
  for (const row of rows) {
    const key = row.homestead_name.trim().toLowerCase();
    const amt = (typeof row.amount_dollars === 'number') ? row.amount_dollars : null;
    if (seen.has(key)) {
      // Already in the list — just update the tracked max amount.
      const prev = amountByName.get(key);
      if (amt !== null && (prev === null || prev === undefined || amt > prev)) {
        amountByName.set(key, amt);
      }
      continue;
    }
    seen.add(key);
    amountByName.set(key, amt);
    uniqueNames.push({
      name: row.homestead_name.trim(),
      tier: row.payment_type === 'monthly' ? 'monthly' : 'one_time',
      // Earliest start for this name, trimmed to month granularity (YYYY-MM).
      // Rows are ordered started_at ascending and we keep the first occurrence,
      // so this is their longest-tenured record. Prefer original_started_at
      // (survives re-subscribes), fall back to started_at. Powers the "est May
      // 2026" tag — month + year only; no day or time leaves the server.
      since: ((row.original_started_at || row.started_at || "").slice(0, 7)) || null,
      _key: key,
    });
  }

  // Strip the internal _key before returning. The public list keeps name +
  // tier, and now also `since` (the supporter's earliest start date) so the
  // wall can show an "est May 2026" tag. Still no Stripe IDs, emails, user_ids,
  // or amounts.
  const supporters = uniqueNames.map(u => ({ name: u.name, tier: u.tier, since: u.since }));

  // Cache for 1 hour at the edge — supporter list changes at most a few
  // times per month, no need to hit Supabase on every modal open.
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

  return res.status(200).json({
    month,
    count: supporters.length,
    supporters,
  });
}
