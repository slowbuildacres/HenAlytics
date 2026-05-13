// Vercel serverless function: GET /api/list-supporters?month=YYYY-MM
//
// Returns the homestead names of supporters who were active during the
// given calendar month (and chose to be visible on the supporter wall).
// Used by the monthly thank-you modal in Henalytics to shout out who
// chipped in to keep the app running.
//
// Privacy / safety rules baked in:
//   - Only returns homestead_name where homestead_name_visible = true
//   - Skips rows where homestead_name_flagged = true (pending review)
//   - Skips rows with null/empty homestead_name
//   - Returns no Stripe IDs, no emails, no user_ids — just names
//   - Anonymous endpoint (no auth required) — same names will show to all users
//
// "Active during month X" means the supporter row was started_at <= end of month
// AND (canceled_at is null OR canceled_at >= start of month). One-time tips
// satisfy this only for the month they were made in (started_at == end window).
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
  let names;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('supporters')
      .select('homestead_name, payment_type, started_at, canceled_at')
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
    names = data || [];
  } catch (e) {
    console.error('list-supporters error:', e);
    return res.status(500).json({ error: 'Could not load supporters.' });
  }

  // Extra filter for one-time tips: their started_at must fall WITHIN the
  // requested month, not just before its end. (A one-time tip from January
  // shouldn't appear in March's list.) This is a post-query filter because
  // Postgres OR conditions don't compose cleanly with the date window above
  // when one branch needs a different started_at constraint.
  names = names.filter(row => {
    if (row.payment_type !== 'one_time') return true; // monthly already filtered correctly above
    const started = new Date(row.started_at);
    return started >= monthStart && started < monthEnd;
  });

  // Dedupe by homestead_name (case-insensitive). If someone has multiple
  // active subscriptions or a sub + one-time, they should only appear once.
  // Keep the oldest entry per name so the list orders by tenure.
  const seen = new Set();
  const uniqueNames = [];
  for (const row of names) {
    const key = row.homestead_name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueNames.push({
      name: row.homestead_name.trim(),
      tier: row.payment_type === 'monthly' ? 'monthly' : 'one_time',
    });
  }

  // Cache for 1 hour at the edge — supporter list changes at most a few
  // times per month, no need to hit Supabase on every modal open.
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

  return res.status(200).json({
    month,
    count: uniqueNames.length,
    supporters: uniqueNames,
  });
}
