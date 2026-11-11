// ============================================================================
// Vercel serverless function: POST /api/orders
// ----------------------------------------------------------------------------
// The homestead's side of customer order requests (src/Orders.jsx).
// Body: { action, homesteadId, ... }
//
//   action "count"  → { newOrders, newJoins }            (for the badge)
//   action "list"   → { requests: [...] }                 (last 180 days)
//   action "update" → { id, status, message, notify }     sets the status;
//                     for orders, emails the customer when notify is true
//                     and the status is accepted, ready or declined
//   action "remove" → { id }                              deletes it
//
// Safety:
//   • Signed-in members of the homestead only (JWT + homestead_members).
//   • Rows are always filtered by that homestead id, so one homestead can't
//     touch another's requests.
//   • The customer email goes only to the address on the request, built
//     from the shared template (src/orderShared.js); replies go to the
//     seller's reply-to address (or the member's own email).
//   • 200 customer emails a day per homestead.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
//      STOCK_EMAIL_FROM (default hello@henalytics.com).
// Table: supabase/migrations/20261111_order_requests.sql
// ============================================================================

import { getCorsOrigin } from './_cors.js';
import { ORDER_STATUSES, JOIN_STATUSES, ORDER_LIMITS, EMAIL_RE, buildCustomerEmail, cleanPageSettings } from '../src/orderShared.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAILY_EMAILS = 200;

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

const FIELDS = 'id,kind,status,customer_name,email,phone,items,note,pickup_date,owner_message,created_at,updated_at';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', getCorsOrigin(req));
  res.setHeader('Cache-Control', 'no-store');
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
  if (!['count', 'list', 'update', 'remove'].includes(action) || !UUID_RE.test(hid)) return res.status(400).json({ error: 'Bad request' });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to see orders.' });

  try {
    const member = await rest(`homestead_members?select=role&homestead_id=eq.${hid}&user_id=eq.${user.id}&limit=1`);
    if (!Array.isArray(member) || !member.length) return res.status(403).json({ error: "You're not a member of this homestead." });

    if (action === 'count') {
      const rows = await rest(`order_requests?select=kind&homestead_id=eq.${hid}&status=eq.new&limit=500`) || [];
      return res.status(200).json({ newOrders: rows.filter((r) => r.kind === 'order').length, newJoins: rows.filter((r) => r.kind === 'join').length });
    }

    if (action === 'list') {
      const since = new Date(Date.now() - 180 * 86400000).toISOString();
      const rows = await rest(`order_requests?select=${FIELDS}&homestead_id=eq.${hid}&or=(status.in.(new,accepted,ready),created_at.gte.${encodeURIComponent(since)})&order=created_at.desc&limit=300`) || [];
      return res.status(200).json({ requests: rows });
    }

    const id = String(body.id || '');
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Bad request' });
    const found = await rest(`order_requests?select=${FIELDS}&id=eq.${id}&homestead_id=eq.${hid}&limit=1`);
    const row = Array.isArray(found) ? found[0] : null;
    if (!row) return res.status(404).json({ error: "That request isn't here anymore." });

    if (action === 'remove') {
      await rest(`order_requests?id=eq.${id}&homestead_id=eq.${hid}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      return res.status(200).json({ ok: true });
    }

    // update
    const status = String(body.status || '');
    const allowed = row.kind === 'join' ? JOIN_STATUSES : ORDER_STATUSES;
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Bad status' });
    const message = String(body.message || '').trim().slice(0, ORDER_LIMITS.message);
    await rest(`order_requests?id=eq.${id}&homestead_id=eq.${hid}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status, owner_message: message || row.owner_message || null, updated_at: new Date().toISOString() }),
    });

    let emailed = false;
    let emailError = '';
    if (row.kind === 'order' && body.notify === true && ['accepted', 'ready', 'declined'].includes(status) && EMAIL_RE.test(row.email || '')) {
      if (!process.env.RESEND_API_KEY) emailError = 'Email is not set up.';
      else {
        const sentToday = await rest(`order_requests?select=id&homestead_id=eq.${hid}&emailed_at=gte.${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}&limit=${DAILY_EMAILS + 1}`) || [];
        if (sentToday.length >= DAILY_EMAILS) emailError = 'Daily email limit reached. Try again tomorrow.';
        else {
          const hs = await rest(`homesteads?select=farm:data->>homesteadName,settings:data->stockEmailSettings,op:data->orderPage&id=eq.${hid}&limit=1`) || [];
          const h = hs[0] || {};
          const settings = h.settings && typeof h.settings === 'object' ? h.settings : {};
          const farm = String(settings.fromName || h.farm || '').replace(/[<>"\r\n]/g, '').trim().slice(0, 60) || 'Our farm stand';
          const replyTo = EMAIL_RE.test(String(settings.replyTo || '')) ? String(settings.replyTo) : user.email;
          const op = cleanPageSettings(h.op || {});
          const mail = buildCustomerEmail({ status, farmName: farm, items: row.items, note: row.note, pickupDate: row.pickup_date, message, pickupText: op.pickup });
          const from = process.env.STOCK_EMAIL_FROM || 'hello@henalytics.com';
          const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: `${farm} <${from}>`, to: [row.email], reply_to: replyTo, subject: mail.subject, html: mail.html, text: mail.text }),
          });
          if (r.ok) {
            emailed = true;
            await rest(`order_requests?id=eq.${id}&homestead_id=eq.${hid}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ emailed_at: new Date().toISOString() }) }).catch(() => {});
          }
          else { emailError = "The email didn't send."; console.error('[orders] email', r.status, (await r.text()).slice(0, 200)); }
        }
      }
    }
    return res.status(200).json({ ok: true, emailed, emailError });
  } catch (e) {
    console.error('[orders]', e);
    return res.status(502).json({ error: 'Something went wrong. Please try again.' });
  }
}
