// Vercel cron: GET /api/recompute-region-stats
//
// Runs daily at 09:00 UTC (see vercel.json). Recomputes the Homestead Games
// regional standings (country / state / county rollups) for the current year
// and, during January, also the previous year so late log entries still land
// in last year's final standings.
//
// All the real work lives in the SQL function recompute_region_stats(year)
// (see supabase/homestead_games.sql) — caps, k-anonymity, and the three
// region levels are applied there. This route just calls it with the service
// role key, which is the only role allowed to execute it.
//
// Idempotent — safe to trigger manually:
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     https://henalytics.com/api/recompute-region-stats
//
// Required env vars:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   CRON_SECRET (optional but recommended) — Vercel sends this as
//     Authorization: Bearer <secret> for scheduled crons.

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Auth: accept Vercel's cron bearer when CRON_SECRET is set.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase env vars not configured' });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const now = new Date();
  const years = [now.getUTCFullYear()];
  if (now.getUTCMonth() === 0) years.push(now.getUTCFullYear() - 1); // January grace window

  const results = {};
  for (const year of years) {
    const { error } = await supabase.rpc('recompute_region_stats', { p_year: year });
    results[year] = error ? `error: ${error.message}` : 'ok';
    if (error) {
      console.error(`recompute_region_stats(${year}) failed:`, error.message);
    }
  }

  const failed = Object.values(results).some((v) => v !== 'ok');
  return res.status(failed ? 500 : 200).json({ recomputed: results });
}
