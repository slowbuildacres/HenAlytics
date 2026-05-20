// Vercel cron: GET /api/recalc-scan-quota
//
// Runs on the 1st of each month at 00:00 UTC. Snapshots the current month's
// scan quota based on supporter count and active user count, writes a row to
// monthly_scan_quotas. The scanner UI reads from this table to show users
// how many free scans they have and where the number came from.
//
// Formula:
//   free_quota_per_user = min(10, floor((supporter_count * $1) / $0.10 / active_user_count))
//
// No floor — if supporter funding doesn't cover everyone getting at least one
// scan, quota is 0 and the UI shows the math + a "become a supporter" CTA.
//
// "Active user" = has a user_homestead row updated in the last 30 days.
// "Supporter" = supporters row with status = 'active' AND payment_type = 'monthly'
//   (one-time tips don't count toward the monthly funding pool because they
//   don't recur — counting them would let one $5 tip in January fund free
//   scans every month forever).
//
// This endpoint is idempotent — running it twice in the same month just
// upserts the same row. Safe to manually trigger via curl if cron fails.
//
// Required env vars:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   CRON_SECRET (optional but recommended) — Vercel sends this as
//     Authorization: Bearer <secret> for scheduled crons. Manually triggered
//     calls without it return 401. Set in Vercel dashboard.
//
// Costs assumed:
//   $0.10/scan (Plant.id retail-ish — conservative)
//   $1/supporter/month (we count each supporter as $1 in the formula even
//     though tiers go up to $10/mo; this reflects that tiers above $1 cover
//     other operating costs, not just scans).
//
// Schema reminder:
//   monthly_scan_quotas (
//     month                date primary key,
//     supporter_count      int,
//     active_user_count    int,
//     free_quota_per_user  int,
//     total_pool_funded    int,  -- supporter_count * 10, displayed in UI
//     created_at           timestamptz
//   )

import { createClient } from '@supabase/supabase-js';

const SCAN_COST_DOLLARS = 0.10;
const SUPPORTER_AVG_DOLLARS = 1.00; // conservative; many tip more, but we plan for $1
const QUOTA_CEILING = 10; // never give more than 10 free scans/user even if math allows
const ACTIVE_USER_DAYS = 30;

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

// First-of-month UTC date string. We key the row by date (yyyy-mm-01).
function firstOfMonthUTC(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export default async function handler(req, res) {
  // ---- Auth — Vercel cron sends CRON_SECRET if configured ----
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${expectedSecret}`) {
      console.warn('[recalc-scan-quota] unauthorized cron call');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const supabase = getSupabaseAdmin();
    const month = firstOfMonthUTC();

    // ---- Count active monthly supporters ----
    // payment_type = 'monthly' AND status = 'active'. One-time tips and
    // past_due/canceled don't fund the pool.
    const { count: supporterCount, error: supporterErr } = await supabase
      .from('supporters')
      .select('id', { count: 'exact', head: true })
      .eq('payment_type', 'monthly')
      .eq('status', 'active');

    if (supporterErr) {
      console.error('[recalc-scan-quota] supporter count failed:', supporterErr);
      return res.status(500).json({ error: 'Supporter query failed' });
    }

    // ---- Count active users ----
    // user_homestead.updated_at within last 30 days = user logged something.
    const activeCutoff = new Date(Date.now() - ACTIVE_USER_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { count: activeUserCount, error: activeErr } = await supabase
      .from('homesteads')
      .select('id', { count: 'exact', head: true })
      .gte('updated_at', activeCutoff);

    if (activeErr) {
      console.error('[recalc-scan-quota] active user count failed:', activeErr);
      return res.status(500).json({ error: 'Active user query failed' });
    }

    // ---- Compute quota ----
    // Guard against division by zero when there are no active users (early days).
    let freeQuotaPerUser = 0;
    if (activeUserCount > 0) {
      const totalScansFunded = Math.floor((supporterCount * SUPPORTER_AVG_DOLLARS) / SCAN_COST_DOLLARS);
      const perUserRaw = Math.floor(totalScansFunded / activeUserCount);
      freeQuotaPerUser = Math.max(0, Math.min(QUOTA_CEILING, perUserRaw));
    }

    const totalPoolFunded = Math.floor((supporterCount * SUPPORTER_AVG_DOLLARS) / SCAN_COST_DOLLARS);

    // ---- Upsert ----
    const { error: upsertErr } = await supabase
      .from('monthly_scan_quotas')
      .upsert({
        month,
        supporter_count: supporterCount || 0,
        active_user_count: activeUserCount || 0,
        free_quota_per_user: freeQuotaPerUser,
        total_pool_funded: totalPoolFunded,
      }, { onConflict: 'month' });

    if (upsertErr) {
      console.error('[recalc-scan-quota] upsert failed:', upsertErr);
      return res.status(500).json({ error: 'Upsert failed' });
    }

    console.log(`[recalc-scan-quota] ${month}: ${supporterCount} supporters fund ${totalPoolFunded} scans / ${activeUserCount} active users = ${freeQuotaPerUser} per user`);

    return res.status(200).json({
      ok: true,
      month,
      supporter_count: supporterCount,
      active_user_count: activeUserCount,
      free_quota_per_user: freeQuotaPerUser,
      total_pool_funded: totalPoolFunded,
    });
  } catch (e) {
    console.error('[recalc-scan-quota] handler error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
