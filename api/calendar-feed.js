// Vercel serverless function: GET /api/calendar-feed?t=<token>
// Pretty URL (vercel.json rewrite): /cal/<token>/henalytics.ics
//
// Live calendar subscription. Google Calendar, Outlook and Apple Calendar
// poll this URL and show the homestead's calendar events, so anything added
// in Henalytics shows up on the user's own calendar without re-exporting.
//
// How the token works:
//   - The app generates a random 160-bit token and stores it in the homestead
//     data blob as data.calendarFeedToken (Settings → calendar sync).
//   - This endpoint looks the homestead up by that token with the service
//     role key, and returns its data.calendarEvents as iCalendar text.
//   - "Turn off" in the app deletes the token; "new link" replaces it, which
//     instantly breaks the old URL.
//   - No database migration needed: it's a filter on the existing
//     homesteads.data jsonb column (same pattern as weekly-digest).
//
// Security:
//   - The URL is the credential (that is how every calendar subscription
//     works — calendar apps can't send auth headers). The token is 40 hex
//     chars of crypto randomness, validated strictly before any query.
//   - Returns only calendar titles/notes/dates. No other homestead data,
//     no emails, no IDs beyond the event UIDs.
//   - Unknown or malformed tokens get a plain 404 with no detail.
//
// Required env vars (already set for the other endpoints):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { buildICS } from '../src/calendarExport.js';

const TOKEN_RE = /^[a-f0-9]{40}$/;

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }

  const raw = req.query && (req.query.t || req.query.token);
  const token = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/\.ics$/, '') : '';
  if (!TOKEN_RE.test(token)) {
    return res.status(404).send('Not found');
  }

  const SUPABASE = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE || !SERVICE_KEY) {
    return res.status(500).send('Calendar feed not configured');
  }

  let row;
  try {
    const url = `${SUPABASE}/rest/v1/homesteads`
      + `?select=data&data->>calendarFeedToken=eq.${token}&limit=1`;
    const r = await fetch(url, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Accept: 'application/json',
      },
    });
    if (!r.ok) {
      console.error('[calendar-feed] lookup failed:', r.status, await r.text().catch(() => ''));
      return res.status(502).send('Could not load calendar');
    }
    const rows = await r.json();
    row = Array.isArray(rows) ? rows[0] : null;
  } catch (e) {
    console.error('[calendar-feed] error:', e);
    return res.status(502).send('Could not load calendar');
  }

  // Belt and braces: confirm the token on the row itself.
  if (!row || !row.data || row.data.calendarFeedToken !== token) {
    return res.status(404).send('Not found');
  }

  // Subscribed calendars only need recent history; keep the feed small.
  const { text } = buildICS(row.data, { includePastDays: 180 });

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="henalytics.ics"');
  // Calendar apps poll on their own schedule (Google: every several hours).
  // A short shared cache keeps repeated polls cheap without going stale.
  // Short edge cache only: turning the link off (or making a new one) in
  // the app should stop the old link soon, not after an hour of
  // stale-while-revalidate copies.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(text);
}
