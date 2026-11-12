// ============================================================================
// Vercel serverless function: POST /api/orders
// ----------------------------------------------------------------------------
// The homestead's side of customer order requests (src/Orders.jsx).
// Body: { action, homesteadId, ... }
//
//   action "count"  → { newOrders, newJoins, pickups }   (for the badge;
//                     pickups = orders to hand over on body.today)
//   action "list"   → { requests: [...] }                 (last 180 days)
//   action "update" → { id, status, message, notify }     sets the status;
//                     for orders, emails the customer when notify is true
//                     and the status is accepted, ready or declined
//   action "remove" → { id }                              deletes it
//   action "paid"   → { id, paid }                        marks it paid or not
//   action "next"   → { id }      a standing order was picked up: move it to
//                     its next day (accepted, not paid yet)
//   action "stop"   → { id }      ends a standing order (this one stays)
//   action "back"   → { itemId, message }  emails everyone who asked to hear
//                     when that item is back, and marks them done
//   (update also takes an optional paid: true|false)
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
import { ORDER_STATUSES, JOIN_STATUSES, ORDER_LIMITS, EMAIL_RE, buildCustomerEmail, buildBackEmail, cleanPageSettings } from '../src/orderShared.js';

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

const BASE_FIELDS = 'id,kind,status,customer_name,email,phone,items,note,pickup_date,owner_message,created_at,updated_at';
const PAY_FIELDS = `${BASE_FIELDS},pay_method,paid,text_ok`;
const FIELDS = `${PAY_FIELDS},status_token,repeat_weeks,fulfil,address`;
// Reads that still work if newer columns haven't been added yet.
const missingPayCols = (e) => /pay_method|text_ok|column .*paid|paid.*column|'paid'/.test(String(e && e.message));
const missingExtraCols = (e) => /status_token|repeat_weeks|fulfil|address/.test(String(e && e.message));
async function readRows(query) {
  try { return await rest(query.replace('{F}', FIELDS)); } catch (e) {
    if (!missingExtraCols(e) && !missingPayCols(e)) throw e;
    try { return await rest(query.replace('{F}', PAY_FIELDS)); } catch (e2) {
      if (!missingPayCols(e2)) throw e2;
      return rest(query.replace('{F}', BASE_FIELDS));
    }
  }
}
const SITE = 'https://henalytics.com';
const addDaysIso = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
async function farmInfo(hid, user) {
  const hs = await rest(`homesteads?select=farm:data->>homesteadName,settings:data->stockEmailSettings,op:data->orderPage&id=eq.${hid}&limit=1`) || [];
  const h = hs[0] || {};
  const settings = h.settings && typeof h.settings === 'object' ? h.settings : {};
  const farm = String(settings.fromName || h.farm || '').replace(/[<>"\r\n]/g, '').trim().slice(0, 60) || 'Our farm stand';
  const replyTo = EMAIL_RE.test(String(settings.replyTo || '')) ? String(settings.replyTo) : user.email;
  const op = cleanPageSettings(h.op || {});
  const base = process.env.APP_BASE_URL || SITE;
  return { farm, replyTo, op, orderUrl: op.on && op.token && !op.paused ? `${base}/o/${op.token}` : '', statusUrl: (st) => (op.on && op.token && st ? `${base}/o/${op.token}?s=${st}` : '') };
}
async function sentToday(hid) {
  const rows = await rest(`order_requests?select=id&homestead_id=eq.${hid}&emailed_at=gte.${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}&limit=${DAILY_EMAILS + 1}`) || [];
  return rows.length;
}

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
  if (!['count', 'list', 'update', 'remove', 'paid', 'next', 'stop', 'back'].includes(action) || !UUID_RE.test(hid)) return res.status(400).json({ error: 'Bad request' });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in to see orders.' });

  try {
    const member = await rest(`homestead_members?select=role&homestead_id=eq.${hid}&user_id=eq.${user.id}&limit=1`);
    if (!Array.isArray(member) || !member.length) return res.status(403).json({ error: "You're not a member of this homestead." });

    if (action === 'count') {
      const rows = await rest(`order_requests?select=kind&homestead_id=eq.${hid}&status=eq.new&limit=500`) || [];
      const today = /^\d{4}-\d{2}-\d{2}$/.test(String(body.today || '')) ? String(body.today) : '';
      const pickups = today ? (await rest(`order_requests?select=id,customer_name&homestead_id=eq.${hid}&kind=eq.order&status=in.(accepted,ready)&pickup_date=eq.${today}&limit=50`) || []).map((r) => ({ id: r.id, name: r.customer_name })) : [];
      return res.status(200).json({ newOrders: rows.filter((r) => r.kind === 'order').length, newJoins: rows.filter((r) => r.kind === 'join').length, pickups });
    }

    if (action === 'list') {
      const since = new Date(Date.now() - 180 * 86400000).toISOString();
      const rows = await readRows(`order_requests?select={F}&homestead_id=eq.${hid}&or=(status.in.(new,accepted,ready),created_at.gte.${encodeURIComponent(since)})&order=created_at.desc&limit=300`) || [];
      return res.status(200).json({ requests: rows });
    }

    if (action === 'back') {
      const itemId = String(body.itemId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
      if (!itemId) return res.status(400).json({ error: 'Bad request' });
      const asked = (await rest(`order_requests?select=id,email,items&homestead_id=eq.${hid}&kind=eq.notify&status=eq.new&limit=300`) || [])
        .filter((r) => Array.isArray(r.items) && r.items.some((i) => i && i.id === itemId) && EMAIL_RE.test(r.email || ''));
      // One email per address, even if they asked twice.
      const seen = new Set();
      const waiting = asked.filter((r) => { const e = String(r.email).toLowerCase(); if (seen.has(e)) return false; seen.add(e); return true; });
      const dupes = asked.filter((r) => !waiting.includes(r));
      if (!waiting.length) return res.status(200).json({ ok: true, sent: 0 });
      if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'Email is not set up.' });
      const left = DAILY_EMAILS - await sentToday(hid);
      if (left <= 0) return res.status(429).json({ error: 'Daily email limit reached. Try again tomorrow.' });
      const info = await farmInfo(hid, user);
      const item = (waiting[0].items.find((i) => i && i.id === itemId) || {}).name || 'It';
      const mail = buildBackEmail({ farmName: info.farm, itemName: item, orderUrl: info.orderUrl, message: String(body.message || '').slice(0, ORDER_LIMITS.message) });
      const from = process.env.STOCK_EMAIL_FROM || 'hello@henalytics.com';
      let sent = 0;
      // One email each, so no one sees anyone else's address.
      for (const r of waiting.slice(0, left)) {
        const ok = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: `${info.farm} <${from}>`, to: [r.email], reply_to: info.replyTo, subject: mail.subject, html: mail.html, text: mail.text }),
        }).then((x) => x.ok).catch(() => false);
        if (!ok) continue;
        sent++;
        await rest(`order_requests?id=eq.${r.id}&homestead_id=eq.${hid}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'done', emailed_at: new Date().toISOString(), updated_at: new Date().toISOString() }) }).catch(() => {});
      }
      // Their extra asks are covered by the one email.
      for (const r of dupes) await rest(`order_requests?id=eq.${r.id}&homestead_id=eq.${hid}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'done', updated_at: new Date().toISOString() }) }).catch(() => {});
      return res.status(200).json({ ok: true, sent, more: Math.max(0, waiting.length - sent) });
    }

    const id = String(body.id || '');
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Bad request' });
    const found = await readRows(`order_requests?select={F}&id=eq.${id}&homestead_id=eq.${hid}&limit=1`);
    const row = Array.isArray(found) ? found[0] : null;
    if (!row) return res.status(404).json({ error: "That request isn't here anymore." });

    if (action === 'remove') {
      await rest(`order_requests?id=eq.${id}&homestead_id=eq.${hid}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      return res.status(200).json({ ok: true });
    }

    if (action === 'paid') {
      if (row.kind !== 'order') return res.status(400).json({ error: 'Bad request' });
      try {
        await rest(`order_requests?id=eq.${id}&homestead_id=eq.${hid}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ paid: body.paid === true, updated_at: new Date().toISOString() }) });
      } catch (e) {
        if (missingPayCols(e)) return res.status(409).json({ error: 'Paid tracking needs a quick database update first.' });
        throw e;
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'next' || action === 'stop') {
      if (row.kind !== 'order' || !row.repeat_weeks) return res.status(400).json({ error: "That isn't a standing order." });
      if (action === 'stop') {
        await rest(`order_requests?id=eq.${id}&homestead_id=eq.${hid}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ repeat_weeks: null, updated_at: new Date().toISOString() }) });
        return res.status(200).json({ ok: true });
      }
      const today = /^\d{4}-\d{2}-\d{2}$/.test(String(body.today || '')) ? String(body.today) : new Date().toISOString().slice(0, 10);
      let next = /^\d{4}-\d{2}-\d{2}$/.test(String(row.pickup_date || '')) ? row.pickup_date : today;
      do { next = addDaysIso(next, row.repeat_weeks * 7); } while (next <= today);
      await rest(`order_requests?id=eq.${id}&homestead_id=eq.${hid}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'accepted', paid: false, pickup_date: next, updated_at: new Date().toISOString() }) });
      return res.status(200).json({ ok: true, next });
    }

    // update
    const status = String(body.status || '');
    const allowed = row.kind === 'join' ? JOIN_STATUSES : ORDER_STATUSES;
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Bad status' });
    const message = String(body.message || '').trim().slice(0, ORDER_LIMITS.message);
    await rest(`order_requests?id=eq.${id}&homestead_id=eq.${hid}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status, owner_message: message || row.owner_message || null, updated_at: new Date().toISOString(), ...(typeof body.paid === 'boolean' && row.kind === 'order' && 'paid' in row ? { paid: body.paid } : {}) }),
    });

    let emailed = false;
    let emailError = '';
    if (row.kind === 'order' && body.notify === true && ['accepted', 'ready', 'declined'].includes(status) && EMAIL_RE.test(row.email || '')) {
      if (!process.env.RESEND_API_KEY) emailError = 'Email is not set up.';
      else {
        if (await sentToday(hid) >= DAILY_EMAILS) emailError = 'Daily email limit reached. Try again tomorrow.';
        else {
          const { farm, replyTo, op, orderUrl, statusUrl } = await farmInfo(hid, user);
          const mail = buildCustomerEmail({ status, farmName: farm, items: row.items, note: row.note, pickupDate: row.pickup_date, message, pickupText: op.pickup, pay: row.pay_method ? { method: row.pay_method, op, paid: row.paid === true } : null, orderUrl, statusUrl: status === 'declined' ? '' : statusUrl(row.status_token), repeatWeeks: row.repeat_weeks || 0, address: row.fulfil === 'delivery' ? row.address : '' });
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
