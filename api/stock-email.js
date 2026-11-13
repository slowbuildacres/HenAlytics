// ============================================================================
// Vercel serverless function: POST /api/stock-email
// ----------------------------------------------------------------------------
// "Here's what's fresh" emails from a homestead to its own customer lists
// (src/StockEmails.jsx). Body: { action, homesteadId, draft, lists }.
//
//   action "status" → { unsubscribed: [email], sentToday, dailyLimit }
//   action "test"   → sends the draft to the signed-in user's own email
//   action "send"   → sends the draft to the chosen lists ("all" or ids)
//
// Safety:
//   • Signed-in members of the homestead only (JWT + homestead_members).
//   • Recipients are read server-side from that homestead's own saved
//     contacts (data.customers), never taken from the request, so the
//     endpoint can't be pointed at arbitrary addresses.
//   • Each email is sent individually (no one sees other addresses) with a
//     per-recipient HMAC-signed unsubscribe link + List-Unsubscribe headers;
//     unsubscribes are honored per homestead (stock_email_unsubscribes).
//   • A real send requires a mailing address in the sender details
//     (US CAN-SPAM). Replies go to the seller (reply_to).
//   • Daily cap per homestead (STOCK_EMAIL_DAILY_LIMIT, default 100
//     recipients) and 10 tests a day; logged in stock_email_sends.
//   • Content is rebuilt from structured fields with the shared template
//     (src/stockEmail.js); photos must be in the user's own folder of the
//     public "email-photos" bucket.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
//      UNSUBSCRIBE_TOKEN_SECRET (shared with chore emails),
//      STOCK_EMAIL_FROM (default hello@henalytics.com),
//      STOCK_EMAIL_DAILY_LIMIT (default 100), APP_BASE_URL.
// Tables: supabase/migrations/20261104b_stock_emails.sql
// ============================================================================

import crypto from 'node:crypto';
import { getCorsOrigin } from './_cors.js';
import { buildStockEmail, cleanDraft, stockFromName } from '../src/stockEmail.js';
import { fromLine } from '../src/orderShared.js';

const RESEND_BATCH = 'https://api.resend.com/emails/batch';
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEST_LIMIT = 10;
const MAX_PER_SEND = 500;

const sb = () => ({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
async function rest(path, opts = {}) {
  const { url, key } = sb();
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json', ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}

async function getUser(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const jwt = typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!jwt) return null;
  const { url, key } = sb();
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${jwt}` } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u && u.id ? u : null;
}

export function unsubscribeToken(homesteadId, email, secret = process.env.UNSUBSCRIBE_TOKEN_SECRET) {
  const payload = `${homesteadId}|${String(email).toLowerCase()}`;
  const sig = crypto.createHmac('sha256', secret || 'missing').update(`stock|${payload}`).digest('base64url');
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}

const appBase = () => process.env.APP_BASE_URL || 'https://henalytics.com';
const unsubscribeUrl = (hid, email) => `${appBase()}/api/stock-unsubscribe?t=${unsubscribeToken(hid, email)}`;

function photoOk(url, userId) {
  const { url: base } = sb();
  return typeof url === 'string' && url.startsWith(`${base}/storage/v1/object/public/email-photos/${userId}/`)
    && /\.(jpe?g|png)$/i.test(url);
}

function dayAgoIso() { return new Date(Date.now() - 86400000).toISOString(); }

async function usage(hid) {
  const rows = await rest(`stock_email_sends?select=kind,recipients&homestead_id=eq.${hid}&created_at=gte.${encodeURIComponent(dayAgoIso())}`) || [];
  return {
    sentToday: rows.filter((r) => r.kind === 'send').reduce((t, r) => t + (Number(r.recipients) || 0), 0),
    testsToday: rows.filter((r) => r.kind === 'test').length,
  };
}

async function sendBatch(messages) {
  let sent = 0;
  const failures = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    let attempt = 0;
    for (;;) {
      const r = await fetch(RESEND_BATCH, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (r.ok) { sent += chunk.length; break; }
      if (r.status === 429 && attempt < 2) { attempt++; await new Promise((ok) => setTimeout(ok, 1200 * attempt)); continue; }
      failures.push(`${r.status} ${(await r.text()).slice(0, 160)}`);
      break;
    }
  }
  return { sent, failures };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', getCorsOrigin(req));
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { url, key } = sb();
  if (!url || !key) return res.status(500).json({ error: 'Not configured' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};
  const action = body.action;
  const hid = String(body.homesteadId || '');
  if (!['status', 'test', 'send'].includes(action) || !UUID_RE.test(hid)) return res.status(400).json({ error: 'Bad request' });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to email customers.' });

  try {
    const member = await rest(`homestead_members?select=role&homestead_id=eq.${hid}&user_id=eq.${user.id}&limit=1`);
    if (!Array.isArray(member) || !member.length) return res.status(403).json({ error: "You're not a member of this homestead." });

    const limit = Math.max(1, Number(process.env.STOCK_EMAIL_DAILY_LIMIT) || 100);
    const unsubRows = await rest(`stock_email_unsubscribes?select=email&homestead_id=eq.${hid}`) || [];
    const unsubscribed = new Set(unsubRows.map((r) => String(r.email).toLowerCase()));
    const use = await usage(hid);

    if (action === 'status') {
      return res.status(200).json({ unsubscribed: [...unsubscribed], sentToday: use.sentToday, dailyLimit: limit, testsToday: use.testsToday, testLimit: TEST_LIMIT, accountEmail: user.email || null });
    }

    if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'Email sending is not set up yet.' });

    const rows = await rest(`homesteads?select=data&id=eq.${hid}&limit=1`);
    const data = (rows && rows[0] && rows[0].data) || {};
    const settings = data.stockEmailSettings || {};
    const fromName = stockFromName({ fromName: settings.fromName || data.homesteadName });
    const replyTo = EMAIL_RE.test(String(settings.replyTo || '')) ? String(settings.replyTo) : (user.email || undefined);

    const draft = cleanDraft(body.draft || {});
    draft.photos = draft.photos.filter((p) => photoOk(p, user.id));
    if (!draft.items.length && !draft.note) return res.status(400).json({ error: 'Add at least one item or a note.' });

    // fromLine drops punctuation Resend can trip on ("Lulay Farm, LLC").
    const from = fromLine(`${fromName} via Henalytics`, process.env.STOCK_EMAIL_FROM || 'hello@henalytics.com');
    const message = (to, isTest) => {
      const unsub = isTest ? `${appBase()}/` : unsubscribeUrl(hid, to);
      const e = buildStockEmail(draft, { fromName, mailingAddress: settings.mailingAddress }, { unsubscribeUrl: unsub, isTest });
      const m = { from, to: [to], subject: isTest ? `[Test] ${e.subject}` : e.subject, html: e.html, text: e.text };
      if (replyTo) m.reply_to = replyTo;
      if (!isTest) m.headers = { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
      return m;
    };

    if (action === 'test') {
      if (!user.email) return res.status(400).json({ error: 'Your account has no email address.' });
      if (use.testsToday >= TEST_LIMIT) return res.status(429).json({ error: `That's ${TEST_LIMIT} test emails today. Try again tomorrow.` });
      const r = await sendBatch([message(user.email, true)]);
      await rest('stock_email_sends', { method: 'POST', body: JSON.stringify({ homestead_id: hid, user_id: user.id, kind: 'test', recipients: r.sent, subject: draft.subject || null }) });
      if (!r.sent) return res.status(502).json({ error: "The test email didn't send. Try again in a moment." });
      return res.status(200).json({ ok: true, sent: r.sent, to: user.email });
    }

    // action === "send"
    if (!String(settings.mailingAddress || '').trim()) {
      return res.status(400).json({ error: 'Add your mailing address in Sender details first. The law requires one on promotional email (a PO box is fine).' });
    }
    const lists = body.lists === 'all' ? 'all' : (Array.isArray(body.lists) ? body.lists.map(String) : []);
    if (lists !== 'all' && !lists.length) return res.status(400).json({ error: 'Pick at least one list.' });
    const seen = new Set();
    const recipients = [];
    for (const c of Array.isArray(data.customers) ? data.customers : []) {
      const em = String((c && c.email) || '').trim().toLowerCase();
      if (!EMAIL_RE.test(em) || seen.has(em) || unsubscribed.has(em) || c.emailOk === false) continue;
      if (lists !== 'all' && !(Array.isArray(c.groups) && c.groups.some((g) => lists.includes(String(g))))) continue;
      seen.add(em);
      recipients.push(em);
    }
    if (!recipients.length) return res.status(400).json({ error: 'Nobody on those lists has an email address yet.' });
    if (recipients.length > MAX_PER_SEND) return res.status(400).json({ error: `That's more than ${MAX_PER_SEND} people. Pick smaller lists.` });
    if (use.sentToday + recipients.length > limit) {
      const left = Math.max(0, limit - use.sentToday);
      return res.status(429).json({ error: `Daily limit: ${left} more email${left === 1 ? '' : 's'} today (${limit} a day). Pick a smaller list or send tomorrow.` });
    }

    const r = await sendBatch(recipients.map((em) => message(em, false)));
    await rest('stock_email_sends', { method: 'POST', body: JSON.stringify({ homestead_id: hid, user_id: user.id, kind: 'send', recipients: r.sent, subject: draft.subject || null }) });
    if (!r.sent) return res.status(502).json({ error: "The emails didn't send. Try again in a moment.", detail: r.failures[0] || null });
    return res.status(200).json({ ok: true, sent: r.sent, failed: recipients.length - r.sent });
  } catch (e) {
    console.error('[stock-email]', e);
    return res.status(500).json({ error: 'Something went wrong. Try again in a moment.' });
  }
}
