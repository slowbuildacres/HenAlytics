// ============================================================================
// Vercel serverless function: GET /api/send-chore-emails
// ----------------------------------------------------------------------------
// Triggered by Vercel Cron every Sunday at 23:00 UTC (5pm Central / 6pm Eastern
// / 3pm Pacific). Walks every homestead, builds the upcoming Mon-Sun chore
// list, and sends to each opted-in member (owner + opted-in farmhands).
//
// Mirrors the pattern of /api/weekly-digest:
//   - Direct fetch() to Supabase REST API (no SDK client) for fast cold starts
//   - Direct Resend API call with 429 retry + 250ms inter-send delay
//   - GET method (Vercel Cron sends GET by default)
//   - Three-way tracking: sent / skipped / failed
//
// Auth model:
//   - Cron sends Authorization: Bearer <CRON_SECRET>
//   - The unsubscribe URL inside each email is HMAC-signed so it can't be forged
//
// Required env vars (all already set in production from weekly-digest):
//   CRON_SECRET                — already exists
//   RESEND_API_KEY             — already exists
//   EMAIL_FROM (optional)      — already exists
//   SUPABASE_URL               — already exists
//   SUPABASE_SERVICE_ROLE_KEY  — already exists
// New env vars added for this feature:
//   UNSUBSCRIBE_TOKEN_SECRET   — random hex, signs unsubscribe URLs
//   APP_BASE_URL (optional)    — defaults to https://henalytics.com
// ============================================================================

import crypto from 'crypto';
import { getChoresForWeek, getUpcomingWeekWindow, formatWeekRange } from './_lib/chore-list.js';

const RESEND_API = 'https://api.resend.com/emails';
const FROM_ADDRESS = process.env.EMAIL_FROM || 'Henalytics <hello@henalytics.com>';
const SEND_DELAY_MS = 250;

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'Resend not configured' });
  }

  const SUPABASE = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dryRun = req.query?.dry_run === '1';

  const { weekStart, weekEnd } = getUpcomingWeekWindow();
  const weekStartIso = isoDate(weekStart);
  const weekRange = formatWeekRange(weekStart, weekEnd);

  console.log('[chore-email] cron started', { weekStart: weekStartIso, dryRun });

  try {
    // ---- Fetch opted-in homesteads (server-side filtered + paginated) ----
    // Supabase caps a single response at db-max-rows (1000 by default), so the
    // old unpaginated fetch silently dropped every homestead past the first
    // 1000 — opted-in owners beyond that never got an email. Filtering to
    // opted-in homesteads server-side both sidesteps the cap for the common
    // case and avoids pulling every homestead's full data blob into memory;
    // pagination covers the case where opt-ins ever exceed the cap.
    let homesteads;
    try {
      homesteads = await fetchAllRows(
        `${SUPABASE}/rest/v1/homesteads?select=id,data&data->>weeklyChoreEmailOptIn=eq.true`,
        SERVICE_KEY,
        'id.asc'
      );
    } catch (e) {
      return res.status(502).json({ error: 'Failed to fetch homesteads', detail: e.detail || e.message });
    }

    // ---- Fetch all memberships (paginated; with chore_emails_opt_in) ----
    // Unpaginated, this truncated at 1000 rows — members past the cap vanished
    // from the lookup and their homestead looked memberless. Page through all.
    let allMembers;
    try {
      allMembers = await fetchAllRows(
        `${SUPABASE}/rest/v1/homestead_members?select=homestead_id,user_id,role,chore_emails_opt_in`,
        SERVICE_KEY,
        'homestead_id.asc,user_id.asc'
      );
    } catch (e) {
      return res.status(502).json({ error: 'Failed to fetch members', detail: e.detail || e.message });
    }
    const membersByHomestead = {};
    allMembers.forEach((m) => {
      if (!membersByHomestead[m.homestead_id]) membersByHomestead[m.homestead_id] = [];
      membersByHomestead[m.homestead_id].push(m);
    });

    // ---- Fetch all users (for email lookup) ----
    //
    // Supabase's admin endpoint paginates. Loop until we've collected every
    // user — capping at 50 pages (50,000 users) as a safety brake. If you
    // ever exceed that, the cron logs a warning and continues with what it
    // got; better to send to most users than to fail entirely.
    const emailByUser = {};
    const USERS_PER_PAGE = 1000;
    const MAX_PAGES = 50;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const r = await fetch(
        `${SUPABASE}/auth/v1/admin/users?page=${page}&per_page=${USERS_PER_PAGE}`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      if (!r.ok) {
        const errText = await r.text();
        return res.status(502).json({ error: 'Failed to fetch users', detail: errText, page });
      }
      const j = await r.json();
      const list = Array.isArray(j) ? j : (j.users || []);
      list.forEach((u) => { if (u.id && u.email) emailByUser[u.id] = u.email.toLowerCase(); });
      // Stop when we get a short page — that means we've reached the end.
      if (list.length < USERS_PER_PAGE) break;
      if (page === MAX_PAGES) {
        console.warn('[chore-email] hit MAX_PAGES users cap; some users may be missing');
      }
    }

    // ---- Fetch the unsubscribe blocklist (paginated) ----
    let unsubList = [];
    try {
      unsubList = await fetchAllRows(
        `${SUPABASE}/rest/v1/chore_email_unsubscribes?select=email`,
        SERVICE_KEY,
        'email.asc'
      );
    } catch (e) {
      console.warn('[chore-email] unsubscribe fetch failed; proceeding without blocklist', e.message);
    }
    const unsubSet = new Set(unsubList.map((r) => r.email));

    // ---- Process each homestead ----
    const sent = [], skipped = [], failed = [];

    for (const h of homesteads) {
      const data = h.data || {};

      if (!data.weeklyChoreEmailOptIn) {
        skipped.push({ id: h.id, reason: 'not opted in' });
        continue;
      }

      const members = membersByHomestead[h.id] || [];
      if (members.length === 0) {
        skipped.push({ id: h.id, reason: 'no members' });
        continue;
      }

      const chores = getChoresForWeek(data, weekStart, weekEnd);
      const homesteadName = data.homesteadName || null;

      const eligibleMembers = members.filter((m) => {
        if (m.role === 'owner') return true;
        if (m.role === 'farmhand') return !!m.chore_emails_opt_in;
        return false;
      });

      const seenEmails = new Set();
      for (const m of eligibleMembers) {
        const email = emailByUser[m.user_id];
        if (!email) {
          skipped.push({ id: h.id, user_id: m.user_id, reason: 'no email' });
          continue;
        }
        if (seenEmails.has(email)) continue;
        seenEmails.add(email);

        if (unsubSet.has(email)) {
          skipped.push({ id: h.id, email, reason: 'unsubscribed' });
          await logSendDirect({ SUPABASE, SERVICE_KEY }, {
            recipient_email: email, user_id: m.user_id, homestead_id: h.id,
            recipient_role: m.role, week_start: weekStartIso,
            chore_count: chores.length, status: 'skipped_unsubscribed',
          });
          continue;
        }

        // Idempotency
        const dupeRes = await fetch(
          `${SUPABASE}/rest/v1/chore_email_sends?select=id&recipient_email=eq.${encodeURIComponent(email)}&week_start=eq.${weekStartIso}&status=eq.sent`,
          { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
        );
        if (dupeRes.ok) {
          const dupes = await dupeRes.json();
          if (Array.isArray(dupes) && dupes.length > 0) {
            skipped.push({ id: h.id, email, reason: 'already sent this week' });
            await logSendDirect({ SUPABASE, SERVICE_KEY }, {
              recipient_email: email, user_id: m.user_id, homestead_id: h.id,
              recipient_role: m.role, week_start: weekStartIso,
              chore_count: chores.length, status: 'skipped_duplicate',
            });
            continue;
          }
        }

        const unsubscribeUrl = buildUnsubscribeUrl(email);
        const payload = buildPayload({
          to: email, recipientRole: m.role, homesteadName, chores, weekRange, unsubscribeUrl,
        });

        if (dryRun) {
          console.log('[chore-email] DRY RUN would send to', email);
          sent.push({ id: h.id, email, dryRun: true });
          continue;
        }

        // Send with retry on 429 — matches weekly-digest
        let attempts = 0;
        let delivered = false;
        let lastError = null;
        let resendId = null;
        while (attempts < 3 && !delivered) {
          attempts++;
          try {
            const send = await fetch(RESEND_API, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            });
            if (send.ok) {
              const j = await send.json().catch(() => ({}));
              resendId = j.id || null;
              delivered = true;
              sent.push({ id: h.id, email });
            } else if (send.status === 429) {
              lastError = await send.text();
              await new Promise((r) => setTimeout(r, 1500));
            } else {
              lastError = await send.text();
              break;
            }
          } catch (e) {
            lastError = e.message || String(e);
            await new Promise((r) => setTimeout(r, 500));
          }
        }

        if (!delivered) {
          failed.push({ id: h.id, email, error: lastError });
        }

        await logSendDirect({ SUPABASE, SERVICE_KEY }, {
          recipient_email: email, user_id: m.user_id, homestead_id: h.id,
          recipient_role: m.role, week_start: weekStartIso,
          chore_count: chores.length,
          status: delivered ? 'sent' : 'failed',
          resend_id: resendId, error: delivered ? null : (lastError || 'unknown'),
        });

        await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
      }
    }

    console.log('[chore-email] cron complete', {
      sent: sent.length, skipped: skipped.length, failed: failed.length,
    });

    // Detail arrays are big at scale (one entry per homestead). Only include
    // them when explicitly requested via ?detail=1, OR include failures
    // unconditionally since they're rare and important.
    const includeDetail = req.query?.detail === '1';
    const body = {
      week: weekStartIso,
      weekRange,
      dryRun,
      sent: sent.length,
      skipped: skipped.length,
      failed: failed.length,
    };
    if (failed.length > 0) {
      // Always surface failures — they're rare enough to fit comfortably and
      // they're the thing we actually need to debug.
      body.failures = failed;
    }
    if (includeDetail) {
      body.detail = { sent, skipped, failed };
    }
    return res.status(200).json(body);
  } catch (e) {
    console.error('[chore-email] handler crashed', e);
    return res.status(500).json({ error: 'Cron crashed', message: e.message });
  }
}

// ============================================================================
// Paginated PostgREST fetch
// ============================================================================
// Supabase caps a single REST response at db-max-rows (1000 by default), so an
// unpaginated list fetch silently truncates once a table grows past it. Page
// through with limit/offset plus a stable order until a short page signals the
// end. `urlBase` should already include any select/filter; `order` is the
// column(s) that make offset paging deterministic (e.g. 'id.asc').
async function fetchAllRows(urlBase, serviceKey, order, pageSize = 1000) {
  const all = [];
  const MAX_PAGES = 200; // 200k-row safety brake
  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * pageSize;
    const sep = urlBase.includes('?') ? '&' : '?';
    const url = `${urlBase}${sep}order=${order}&limit=${pageSize}&offset=${offset}`;
    const r = await fetch(url, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!r.ok) {
      const detail = await r.text();
      const err = new Error(`Paginated fetch failed (${r.status})`);
      err.status = r.status;
      err.detail = detail;
      throw err;
    }
    const rows = await r.json();
    const list = Array.isArray(rows) ? rows : [];
    all.push(...list);
    if (list.length < pageSize) break;
  }
  return all;
}

// ============================================================================
// Direct-REST audit log write
// ============================================================================
async function logSendDirect({ SUPABASE, SERVICE_KEY }, row) {
  try {
    const r = await fetch(`${SUPABASE}/rest/v1/chore_email_sends`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!r.ok) {
      const txt = await r.text();
      if (!txt.toLowerCase().includes('duplicate') && !txt.includes('23505')) {
        console.warn('[chore-email] audit log failed', txt);
      }
    }
  } catch (e) {
    console.warn('[chore-email] audit log error', e.message);
  }
}

// ============================================================================
// Build the Resend payload
// ============================================================================
function buildPayload({ to, recipientRole, homesteadName, chores, weekRange, unsubscribeUrl }) {
  const farm = homesteadName || 'your homestead';

  const subject = chores.length === 0
    ? `🌾 All quiet at ${farm} this week (${weekRange})`
    : `🌾 ${farm} — ${chores.length} ${chores.length === 1 ? 'chore' : 'chores'} this week (${weekRange})`;

  const greeting = `Here's what's coming up at ${farm} this week:`;

  const byDate = {};
  chores.forEach((c) => {
    if (!byDate[c.date]) byDate[c.date] = [];
    byDate[c.date].push(c);
  });
  const sortedDates = Object.keys(byDate).sort();

  const choreSections = chores.length === 0 ? '' : sortedDates.map((date) => {
    const items = byDate[date];
    const dayName = items[0].dayOfWeek;
    const formattedDate = formatDateForEmail(date);
    return `
      <div style="margin-bottom:18px;">
        <div style="font-size:13px; color:#5C4530; text-transform:uppercase; letter-spacing:1px; font-weight:600; margin-bottom:6px;">
          ${dayName}, ${formattedDate}
        </div>
        ${items.map((it) => `
          <div style="background:#FAF5EA; border-left:4px solid #5A7A3C; padding:10px 12px; border-radius:4px; margin-bottom:6px;">
            <div style="font-size:15px; color:#2C1810; font-weight:500;">
              ${escapeHtml(it.emoji)} ${escapeHtml(it.title)}
            </div>
            ${it.notes ? `<div style="font-size:13px; color:#5C4530; margin-top:4px; line-height:1.4;">${escapeHtml(it.notes)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }).join('');

  const emptyMessage = chores.length === 0 ? `
    <div style="background:#FAF5EA; border:1.5px dashed #2C181030; border-radius:8px; padding:24px; text-align:center; margin-bottom:18px;">
      <div style="font-family:Georgia, serif; font-size:20px; color:#2C1810; margin-bottom:6px;">
        ☕ Nothing planned this week
      </div>
      <div style="font-size:14px; color:#5C4530; line-height:1.5;">
        A quiet week is a gift. Sit with a cup of coffee, watch the chickens, and let the homestead breathe.
      </div>
    </div>
  ` : '';

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0; padding:0; background:#F4EDE0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px; margin:0 auto; padding:24px 20px;">
    <div style="text-align:center; margin-bottom:24px;">
      <div style="font-family:Georgia, serif; font-size:28px; color:#2C1810; margin-bottom:4px;">
        Henalytics
      </div>
      <div style="font-size:12px; color:#5C4530; text-transform:uppercase; letter-spacing:1.5px;">
        Week of ${escapeHtml(weekRange)}
      </div>
    </div>

    <div style="background:#FAF5EA; border:1.5px solid #2C181030; border-radius:12px; padding:20px; box-shadow:2px 3px 0 #2C181020;">
      <div style="font-size:15px; color:#2C1810; line-height:1.5; margin-bottom:18px;">
        ${escapeHtml(greeting)}
      </div>

      ${emptyMessage}
      ${choreSections}

      <div style="border-top:1.5px solid #2C181030; margin-top:8px; padding-top:14px; font-size:13px; color:#5C4530; line-height:1.5;">
        Add or adjust chores in the Calendar tab of your Henalytics app any time.
      </div>
    </div>

    <div style="text-align:center; margin-top:24px; font-size:11px; color:#5C4530; line-height:1.5;">
      You're receiving this because you opted into weekly chore emails for ${escapeHtml(farm)}.<br>
      <a href="${unsubscribeUrl}" style="color:#5C4530; text-decoration:underline;">Unsubscribe</a> from chore emails.<br><br>
      Henalytics · Atchison, Kansas
    </div>
  </div>
</body></html>`;

  const textChores = chores.length === 0
    ? 'Nothing planned this week — a quiet week is a gift.\n\nSit with a cup of coffee, watch the chickens, and let the homestead breathe.\n'
    : sortedDates.map((date) => {
      const items = byDate[date];
      return `${items[0].dayOfWeek}, ${formatDateForEmail(date)}\n`
        + items.map((it) => `  ${it.emoji} ${it.title}${it.notes ? `\n     ${it.notes}` : ''}`).join('\n');
    }).join('\n\n');

  const text = `Henalytics — week of ${weekRange}
${'-'.repeat(40)}

${greeting}

${textChores}

${'-'.repeat(40)}
Add or adjust chores in the Calendar tab of your Henalytics app.

Unsubscribe: ${unsubscribeUrl}
Henalytics · Atchison, Kansas
`;

  return {
    from: FROM_ADDRESS,
    to,
    subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

// ============================================================================
// Helpers
// ============================================================================
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateForEmail(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthShort[m - 1]} ${d}`;
}

function buildUnsubscribeUrl(email) {
  const baseUrl = process.env.APP_BASE_URL || 'https://henalytics.com';
  const secret = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  if (!secret) {
    return `${baseUrl}/api/unsubscribe-chore-email?email=${encodeURIComponent(email)}`;
  }
  const sig = crypto.createHmac('sha256', secret).update(email).digest('base64url');
  const token = Buffer.from(`${email}:${sig}`).toString('base64url');
  return `${baseUrl}/api/unsubscribe-chore-email?token=${token}`;
}
