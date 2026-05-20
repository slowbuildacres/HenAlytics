// Vercel serverless function: GET /api/scan-quota-status
//
// Returns the calling user's current scan quota state, plus the community
// numbers behind it (supporter_count, active_user_count, formula breakdown).
// The scanner UI uses this to render the transparency block + decide whether
// to enable the "Scan Plant" button.
//
// Auth: requires a valid Supabase JWT in Authorization: Bearer <token>.
// We need to know which user is asking so we can return their per-user usage.
//
// Response shape:
// {
//   month: "2026-05-01",
//   free_quota_per_user: 0,        // this month's allocation
//   free_used: 0,                   // how many they've used this month
//   free_remaining: 0,              // max(0, free_quota_per_user - free_used)
//   extra_remaining: 12,            // from pack purchases (carries over months)
//   total_remaining: 12,            // free_remaining + extra_remaining
//   supporter_count: 20,            // for transparency UI
//   active_user_count: 630,         // for transparency UI
//   total_pool_funded: 200,         // supporter_count * 10
//   supporters_needed_for_1_scan: 63 // for the "we need N more supporters" CTA
// }
//
// Required env vars:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   — bypasses RLS to read another user's quota row

import { createClient } from '@supabase/supabase-js';
import { getCorsOrigin } from './_cors.js';

const SCAN_COST_DOLLARS = 0.10;
const SUPPORTER_AVG_DOLLARS = 1.00;

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

function firstOfMonthUTC(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

// Validate the caller's JWT and return their user_id. We do this by calling
// supabase.auth.getUser() with the token — Supabase verifies it server-side
// against the JWT secret and tells us who it belongs to.
async function getUserIdFromAuthHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

export default async function handler(req, res) {
  // ---- CORS ----
  const corsOrigin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = await getUserIdFromAuthHeader(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const month = firstOfMonthUTC();

    // ---- Read this month's quota row (snapshot from cron) ----
    let { data: quotaRow, error: quotaErr } = await supabase
      .from('monthly_scan_quotas')
      .select('*')
      .eq('month', month)
      .maybeSingle();

    if (quotaErr) {
      console.error('[scan-quota-status] quota fetch failed:', quotaErr);
      return res.status(500).json({ error: 'Quota query failed' });
    }

    // If the cron hasn't run yet for this month (e.g. fresh deploy on day 5),
    // compute on the fly so the UI doesn't break. The cron will overwrite this
    // value on the next 1st-of-month run with proper numbers.
    if (!quotaRow) {
      console.log('[scan-quota-status] no quota row for', month, '— computing on the fly');
      const { count: supporterCount } = await supabase
        .from('supporters')
        .select('id', { count: 'exact', head: true })
        .eq('payment_type', 'monthly')
        .eq('status', 'active');

      const activeCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: activeUserCount } = await supabase
        .from('user_homestead')
        .select('user_id', { count: 'exact', head: true })
        .gte('updated_at', activeCutoff);

      const totalPoolFunded = Math.floor((supporterCount || 0) / SCAN_COST_DOLLARS * SUPPORTER_AVG_DOLLARS);
      const perUserRaw = activeUserCount > 0 ? Math.floor(totalPoolFunded / activeUserCount) : 0;
      const freeQuotaPerUser = Math.max(0, Math.min(10, perUserRaw));

      quotaRow = {
        month,
        supporter_count: supporterCount || 0,
        active_user_count: activeUserCount || 0,
        free_quota_per_user: freeQuotaPerUser,
        total_pool_funded: totalPoolFunded,
      };
    }

    // ---- Read this user's usage row for current month ----
    const { data: usageRow, error: usageErr } = await supabase
      .from('scan_usage')
      .select('free_used, extra_remaining')
      .eq('user_id', userId)
      .eq('month', month)
      .maybeSingle();

    if (usageErr) {
      console.error('[scan-quota-status] usage fetch failed:', usageErr);
      return res.status(500).json({ error: 'Usage query failed' });
    }

    const freeUsed = usageRow?.free_used || 0;
    // extra_remaining carries from previous month — find the most recent row.
    // The simplest model: extra_remaining lives on the CURRENT month row.
    // If the user has no current-month row, we look back to find their carryover.
    let extraRemaining = usageRow?.extra_remaining;
    if (extraRemaining == null) {
      // Look for the most recent scan_usage row with extra_remaining > 0
      const { data: prevRow } = await supabase
        .from('scan_usage')
        .select('extra_remaining, month')
        .eq('user_id', userId)
        .gt('extra_remaining', 0)
        .order('month', { ascending: false })
        .limit(1)
        .maybeSingle();
      extraRemaining = prevRow?.extra_remaining || 0;
    }

    const freeQuota = quotaRow.free_quota_per_user || 0;
    const freeRemaining = Math.max(0, freeQuota - freeUsed);

    // For the "become a supporter" CTA: how many supporters would we need to
    // give every active user 1 free scan?
    // active_user_count * $0.10 = total dollars needed; / $1 per supporter
    const supportersNeededFor1Scan = Math.max(
      0,
      Math.ceil((quotaRow.active_user_count * SCAN_COST_DOLLARS) / SUPPORTER_AVG_DOLLARS) - quotaRow.supporter_count
    );

    return res.status(200).json({
      month,
      free_quota_per_user: freeQuota,
      free_used: freeUsed,
      free_remaining: freeRemaining,
      extra_remaining: extraRemaining,
      total_remaining: freeRemaining + extraRemaining,
      supporter_count: quotaRow.supporter_count,
      active_user_count: quotaRow.active_user_count,
      total_pool_funded: quotaRow.total_pool_funded,
      supporters_needed_for_1_scan: supportersNeededFor1Scan,
    });
  } catch (e) {
    console.error('[scan-quota-status] handler error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
