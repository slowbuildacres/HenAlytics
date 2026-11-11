// ============================================================================
// Vercel serverless function: /api/order-page?t=<token>
// Pretty URL (vercel.json rewrite): henalytics.com/o/<token>
// ----------------------------------------------------------------------------
// The page a homestead shares (link or QR code at the stand) so customers can
// send a pre-order request or ask to join the "what's fresh" email list.
//
//   GET  → the order page (menu, request form, join-the-list form)
//   POST → saves the request in public.order_requests, emails the owner if
//          they turned that on, and shows a thank-you page.
// Plain HTML forms, so it works on any phone with or without JavaScript.
//
// Safety:
//   • The token (40 hex chars, made in the app) is the only way in. The page
//     only shows what the owner chose to share: name, intro, pickup text,
//     menu. Turning the page off or making a new link breaks the old one.
//   • Requests are cleaned and size-capped (src/orderShared.js), checked
//     against the owner's saved menu, and must come from this page: a signed
//     form time (at least 3 seconds, at most a day old) plus a hidden
//     honeypot field stop simple bots.
//   • Limits: 5 requests an hour per visitor per homestead (salted IP hash,
//     never the IP itself), 60 a day per homestead.
//   • No payments, no customer accounts. Customer emails are only used to
//     reply about their request (and the list, if they asked to join).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
//      ORDER_FORM_SECRET (falls back to UNSUBSCRIBE_TOKEN_SECRET),
//      STOCK_EMAIL_FROM (default hello@henalytics.com), APP_BASE_URL.
// Table: supabase/migrations/20261111_order_requests.sql
// ============================================================================

import crypto from 'node:crypto';
import { ORDER_TOKEN_RE, ORDER_LIMITS, cleanPageSettings, cleanRequest, buildOwnerEmail, esc, moneyText, itemLine, payOptions, payInstructions, orderTotal, payLabel, pickupDates, orderPrettyDate, WEEKDAYS } from '../src/orderShared.js';

const SITE = 'https://henalytics.com';
const MIN_SECONDS = 3;
const PER_VISITOR_HOUR = 5;
const PER_HOMESTEAD_DAY = 60;

const sb = () => ({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
const secret = () => process.env.ORDER_FORM_SECRET || process.env.UNSUBSCRIBE_TOKEN_SECRET || '';
async function rest(path, opts = {}) {
  const { url, key } = sb();
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json', ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}

export function formSig(token, ts) {
  return crypto.createHmac('sha256', secret() || 'missing').update(`order|${token}|${ts}`).digest('base64url').slice(0, 32);
}
function ipHash(req, homesteadId) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || String(req.headers['x-real-ip'] || '') || 'unknown';
  return crypto.createHash('sha256').update(`${secret()}|${homesteadId}|${fwd}`).digest('hex').slice(0, 40);
}

// Today in the US farm's rough time (Central), for pickup-day checks.
const usToday = () => new Date(Date.now() - 6 * 3600000).toISOString().slice(0, 10);

// How many of a farm stand item are left to order: on the stand (when
// stock is tracked) plus ready back stock, minus what open orders already
// asked for. null = not tracked, no limit. Only numbers leave this function.
function standLeft(hobbies, standItemId, reserved) {
  const stand = (Array.isArray(hobbies) ? hobbies : []).find((h) => h && h.id === 'farmstand');
  const it = stand && Array.isArray(stand.items) ? stand.items.find((i) => i && i.id === standItemId && !i.archived) : null;
  if (!it) return null;
  const today = usToday();
  const back = (Array.isArray(it.backStock) ? it.backStock : []).filter((b) => b && Number(b.qty) > 0 && (!b.readyOn || b.readyOn <= today)).reduce((n, b) => n + Number(b.qty), 0);
  if (!it.trackStock && !back) return null;
  const have = (it.trackStock ? Math.max(0, Number(it.stock) || 0) : 0) + back;
  return Math.max(0, Math.floor(have - (reserved || 0)));
}

async function findPage(token) {
  const rows = await rest(`homesteads?select=id,farm:data->>homesteadName,op:data->orderPage,fromName:data->stockEmailSettings->>fromName&data->orderPage->>token=eq.${token}&limit=1`);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || !row.op) return null;
  const raw = Array.isArray(row.op.menu) ? row.op.menu : [];
  const linked = raw.filter((m) => m && m.id && m.standItemId);
  if (linked.length) {
    // Stock-aware menu: only fetched when some item is linked to the stand.
    try {
      const [h] = await rest(`homesteads?select=hobbies:data->hobbies&id=eq.${row.id}&limit=1`) || [];
      const open = await rest(`order_requests?select=items&homestead_id=eq.${row.id}&kind=eq.order&status=in.(new,accepted,ready)&limit=500`) || [];
      const reserved = {};
      open.forEach((o) => (Array.isArray(o.items) ? o.items : []).forEach((i) => { if (i && i.id) reserved[i.id] = (reserved[i.id] || 0) + (Number(i.qty) || 0); }));
      const left = new Map(linked.map((m) => [String(m.id), standLeft(h && h.hobbies, m.standItemId, reserved[m.id])]));
      row.op = { ...row.op, menu: raw.map((m) => (m && left.get(String(m.id)) != null ? { ...m, left: left.get(String(m.id)) } : m)) };
    } catch (e) { console.error('[order-page] stock', e); }
  }
  const op = cleanPageSettings(row.op);
  if (!op.on || op.token !== token) return null;
  const farm = String(row.fromName || row.farm || '').trim().slice(0, 60) || 'Our farm stand';
  return { id: row.id, farm, op };
}

// ---------------------------------------------------------------- HTML
const CSS = `
:root{color-scheme:light dark;--bg:#F4EDE0;--card:#FAF5EA;--ink:#2C1810;--soft:#5C4530;--line:#2C181026;--yolk:#E8B547;--leaf:#5A7A3C;--alt:#EBE0CC}
@media (prefers-color-scheme:dark){:root{--bg:#1F1813;--card:#2A211A;--ink:#F4EDE0;--soft:#CDBFAE;--line:#F4EDE026;--alt:#352A21}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 -apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:560px;margin:0 auto;padding:20px 16px 40px}
h1{font:400 30px/1.15 Georgia,serif;margin:6px 0 6px}h2{font:400 22px Georgia,serif;margin:0 0 10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;margin:14px 0}
.soft{color:var(--soft);font-size:15px}.item{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--line)}
.item:first-of-type{border-top:none}.item .n{flex:1;min-width:0}.item .n b{display:block;font-weight:600;overflow-wrap:anywhere}
.qty{display:flex;align-items:center;gap:4px}.qty button{width:44px;height:44px;border-radius:12px;border:1.5px solid var(--line);background:var(--bg);color:var(--ink);font-size:22px;cursor:pointer}
.qty input{width:56px;height:44px;text-align:center;border-radius:12px;border:1.5px solid var(--line);background:var(--bg);color:var(--ink);font-size:17px}
label{display:block;font-weight:600;font-size:14px;margin:12px 2px 6px}
input[type=text],input[type=email],input[type=tel],input[type=date],textarea{width:100%;min-height:48px;padding:10px 12px;border-radius:12px;border:1.5px solid var(--line);background:var(--bg);color:var(--ink);font-size:16px;font-family:inherit}
textarea{min-height:90px}.check{display:flex;gap:10px;align-items:flex-start;font-weight:400;margin-top:14px}.check input{width:22px;height:22px;margin-top:1px}
.btn{display:block;width:100%;min-height:52px;border:none;border-radius:14px;background:var(--yolk);color:#2C1810;font-weight:700;font-size:17px;cursor:pointer;margin-top:16px}
.btn.alt{background:transparent;border:1.5px solid var(--line);color:var(--ink)}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}.tag{display:inline-block;margin:4px 0 0 6px;font-size:13px;font-weight:600;color:var(--soft);background:var(--alt);border-radius:8px;padding:2px 8px}.item.out b{opacity:.6}
select{width:100%;min-height:48px;padding:10px 12px;border-radius:12px;border:1.5px solid var(--line);background:var(--bg);color:var(--ink);font-size:16px;font-family:inherit}
.pay{display:flex;flex-direction:column;gap:8px;margin-top:4px}.pay label{display:flex;align-items:center;gap:10px;font-weight:400;font-size:16px;margin:0;padding:10px 12px;border:1.5px solid var(--line);border-radius:12px;background:var(--bg);cursor:pointer}.pay input{width:20px;height:20px;margin:0}.pay small{color:var(--soft);font-size:14px}
.paybox{border:1.5px solid var(--yolk);border-radius:14px;padding:14px;margin-top:12px}.btn.link{text-decoration:none;text-align:center;line-height:52px;margin-top:10px}
.err{background:#C84B3122;border:1px solid #C84B31;border-radius:12px;padding:10px 12px;margin:10px 0}
footer{text-align:center;font-size:13px;color:var(--soft);margin-top:24px}footer a{color:var(--soft)}
`;
function shell(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="robots" content="noindex"><style>${CSS}</style></head>
<body><main>${body}<footer>Order requests by <a href="${SITE}">Henalytics</a>, the homestead app.</footer></main></body></html>`;
}

function orderPageHtml(page, token, { error, values = {} } = {}) {
  const { farm, op } = page;
  const ts = String(Date.now());
  const sig = formSig(token, ts);
  const avail = op.menu.filter((m) => m.available);
  const v = (k) => esc(values[k] || '');
  const pays = payOptions(op);
  const payHtml = pays.length ? `<fieldset style="border:none;padding:0;margin:0"><legend style="font-weight:600;font-size:14px;margin:12px 2px 6px">How will you pay?</legend>
  <div class="pay">${pays.map((m) => `<label><input type="radio" name="payMethod" value="${m.id}" required${values.payMethod === m.id ? ' checked' : ''}> ${esc(m.label)}${m.id === 'venmo' ? ` <small>@${esc(m.handleValue)}</small>` : m.id === 'cashapp' ? ` <small>$${esc(m.handleValue)}</small>` : ''}</label>`).join('')}</div>
  <p class="soft" style="margin:8px 2px 0">${op.payWhen === 'accepted' ? `You'll pay ${esc(farm)} directly once they accept your order.` : `After you send this, you'll see how to pay ${esc(farm)} directly.`} Payments go straight to ${esc(farm)}, not through Henalytics.</p></fieldset>` : '';
  const menuHtml = avail.map((m) => {
    const out = Number.isFinite(m.left) && m.left <= 0;
    const max = Number.isFinite(m.left) ? Math.min(ORDER_LIMITS.qty, m.left) : ORDER_LIMITS.qty;
    const leftText = out ? '<span class="tag">Sold out for now</span>' : Number.isFinite(m.left) && m.left <= 10 ? `<span class="tag">${m.left} left</span>` : '';
    return `
    <div class="item${out ? ' out' : ''}"><div class="n"><b>${esc(m.name)}</b><span class="soft">${[m.price ? `${moneyText(m.price)}${m.unit ? ` a ${esc(m.unit)}` : ''}` : (m.unit ? esc(m.unit) : ''), esc(m.note)].filter(Boolean).join(' · ')}</span>${leftText}</div>
      ${out ? '' : `<div class="qty" data-max="${max}"><button type="button" aria-label="Fewer ${esc(m.name)}" data-d="-1">−</button><input type="number" inputmode="numeric" min="0" max="${max}" name="qty_${esc(m.id)}" value="${esc(values[`qty_${m.id}`] || '0')}" aria-label="How many ${esc(m.name)}"><button type="button" aria-label="More ${esc(m.name)}" data-d="1">+</button></div>`}</div>`;
  }).join('');
  const days = op.pickupDays;
  const dates = pickupDates(days, usToday());
  const dateHtml = days.length
    ? `<label for="o-date">Pickup day</label><select id="o-date" name="pickupDate" required data-days="${days.join(',')}"><option value="">Pick a day</option>${dates.map((d) => `<option value="${d}"${values.pickupDate === d ? ' selected' : ''}>${esc(orderPrettyDate(d))}</option>`).join('')}</select>
  <p class="soft" style="margin:6px 2px 0">Pickups on ${days.map((d) => WEEKDAYS[d]).join(', ')}.</p>`
    : `<label for="o-date">When would you like it? (optional)</label><input id="o-date" type="date" name="pickupDate" value="${v('pickupDate')}">`;
  const hidden = `<input type="hidden" name="ts" value="${ts}"><input type="hidden" name="sig" value="${sig}"><div class="hp" aria-hidden="true"><label>Leave this empty<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>`;
  const body = `
<h1>${esc(farm)}</h1>
${op.intro ? `<p class="soft">${esc(op.intro)}</p>` : ''}
${op.pickup ? `<p class="soft"><b>Pickup:</b> ${esc(op.pickup)}</p>` : ''}
${error ? `<div class="err" role="alert">${esc(error)}</div>` : ''}
${op.paused ? `<div class="card"><h2>Not taking orders right now</h2><p class="soft" style="margin:0">${esc(op.pausedNote || `${farm} is taking a break from orders. Check back soon!`)}</p></div>` : `<form class="card" method="post" action="/o/${token}">
  <h2>Request an order</h2>
  <p class="soft" style="margin-top:-4px">This sends a request. Nothing is charged here; ${esc(farm)} will email you back.</p>
  ${avail.length ? `<div>${menuHtml}</div>` : ''}
  ${hidden}<input type="hidden" name="kind" value="order">
  <label for="o-name">Your name</label><input id="o-name" type="text" name="name" required maxlength="${ORDER_LIMITS.name}" autocomplete="name" value="${v('name')}">
  <label for="o-email">Email</label><input id="o-email" type="email" name="email" required maxlength="${ORDER_LIMITS.email}" autocomplete="email" value="${v('email')}">
  <label for="o-phone">Phone (optional)</label><input id="o-phone" type="tel" name="phone" maxlength="${ORDER_LIMITS.phone}" autocomplete="tel" value="${v('phone')}">
  <label class="check" style="margin-top:8px"><input type="checkbox" name="textOk" value="1"${values.textOk ? ' checked' : ''}> It's OK to text me about my order <span class="soft" style="font-size:14px">(add your phone above)</span></label>
  ${dateHtml}
  <label for="o-note">${avail.length ? 'Anything else? (optional)' : 'What would you like?'}</label><textarea id="o-note" name="note" maxlength="${ORDER_LIMITS.note}" placeholder="${avail.length ? 'A dozen extra for Saturday, please' : '2 dozen eggs and a loaf of sourdough'}">${v('note')}</textarea>
  ${payHtml}
  ${op.joinList ? `<label class="check"><input type="checkbox" name="alsoJoin" value="1"${values.alsoJoin ? ' checked' : ''}> Also email me when there's something fresh</label>` : ''}
  <button class="btn" type="submit">Send my request</button>
</form>`}
${op.joinList ? `<form class="card" method="post" action="/o/${token}">
  <h2>Just want to hear what's fresh?</h2>
  <p class="soft" style="margin-top:-4px">Get an email when ${esc(farm)} has something new. Unsubscribe anytime.</p>
  ${hidden}<input type="hidden" name="kind" value="join">
  <label for="j-name">Your name</label><input id="j-name" type="text" name="name" required maxlength="${ORDER_LIMITS.name}" autocomplete="name">
  <label for="j-email">Email</label><input id="j-email" type="email" name="email" required maxlength="${ORDER_LIMITS.email}" autocomplete="email">
  <label for="j-phone">Phone (optional)</label><input id="j-phone" type="tel" name="phone" maxlength="${ORDER_LIMITS.phone}" autocomplete="tel">
  <label class="check" style="margin-top:8px"><input type="checkbox" name="textOk" value="1"> Text me too when there's something fresh</label>
  <button class="btn alt" type="submit">Add me to the list</button>
</form>` : ''}
<script>document.querySelectorAll('.qty').forEach(function(q){var i=q.querySelector('input'),mx=Number(q.getAttribute('data-max'))||${ORDER_LIMITS.qty};q.querySelectorAll('button').forEach(function(b){b.addEventListener('click',function(){var n=Math.max(0,Math.min(mx,(parseInt(i.value,10)||0)+Number(b.getAttribute('data-d'))));i.value=n;});});});
(function(){var s=document.querySelector('select[data-days]');if(!s)return;var days=s.getAttribute('data-days').split(',').map(Number),keep=s.value,now=new Date(),out=[];for(var k=0;k<60&&out.length<8;k++){var t=new Date(now.getFullYear(),now.getMonth(),now.getDate()+k);if(days.indexOf(t.getDay())>-1)out.push(t);}
var p=function(n){return(n<10?'0':'')+n};s.innerHTML='<option value="">Pick a day</option>'+out.map(function(t){var v=t.getFullYear()+'-'+p(t.getMonth()+1)+'-'+p(t.getDate());return '<option value="'+v+'"'+(v===keep?' selected':'')+'>'+t.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+'</option>'}).join('');})();</script>`;
  return shell(`${farm} · Order`, body);
}

function thanksHtml(page, token, row, joined) {
  const items = (row.items || []).map((i) => `<li>${esc(itemLine(i))}</li>`).join('');
  const body = row.kind === 'join'
    ? `<h1>You're on the list</h1><div class="card"><p>Thanks, ${esc(row.customer_name)}! ${esc(page.farm)} will email ${esc(row.email)} when there's something fresh.</p></div>`
    : `<h1>Request sent</h1><div class="card"><p>Thanks, ${esc(row.customer_name)}! ${esc(page.farm)} got your request and will email ${esc(row.email)} when they've looked at it.</p>
${items ? `<ul>${items}</ul>` : ''}${row.note ? `<p class="soft">Your note: ${esc(row.note)}</p>` : ''}
${joined ? `<p class="soft">You'll also get their "what's fresh" emails.</p>` : ''}
${row.text_ok ? `<p class="soft">They may text you at ${esc(row.phone)} about this order.</p>` : ''}
${payBlock(page, row)}</div>`;
  return shell(`${page.farm} · Thank you`, `${body}<p style="text-align:center"><a href="/o/${token}" style="color:inherit">Back to ${esc(page.farm)}</a></p>`);
}

// How to pay, right after ordering (or a note that it comes later).
function payBlock(page, row) {
  const none = '<p class="soft">No payment was taken. Settle up with them when you pick up.</p>';
  if (!row.pay_method) return none;
  const total = orderTotal(row.items);
  if (page.op.payWhen === 'accepted') {
    return `<p class="soft">You picked ${esc(payLabel(row.pay_method))}. Once ${esc(page.farm)} accepts your order, they'll email you how to pay${total != null ? ` (about ${esc(moneyText(total))})` : ''}.</p>`;
  }
  // No total yet (they wrote what they want in the note): don't ask them to
  // pay an unknown amount. The accepted email carries the pay button.
  if (total == null) {
    return `<p class="soft">You picked ${esc(payLabel(row.pay_method))}. ${esc(page.farm)} will confirm the total and send you how to pay when they accept your order.</p>`;
  }
  const p = payInstructions({ method: row.pay_method, op: page.op, amount: total, farm: page.farm });
  if (!p) return none;
  return `<div class="paybox"><b>How to pay</b><p style="margin:6px 0 0">${esc(p.line)}</p>
${p.link ? `<a class="btn link" href="${esc(p.link)}" rel="noopener">${esc(p.button)}</a><p class="soft" style="margin:8px 0 0">Opens the app on your phone. If it doesn't, send it to the name above.</p>` : ''}
${['venmo', 'cashapp', 'paypal', 'zelle'].includes(row.pay_method) ? `<p class="soft" style="margin:8px 0 0">Check the name before you send. If ${esc(page.farm)} can't fill the order, they'll send your money back.</p>` : ''}
<p class="soft" style="margin:8px 0 0;font-size:13px">Payments go straight to ${esc(page.farm)}. Henalytics doesn't process, hold or refund payments.</p></div>`;
}

const notFound = () => shell('Order page not found', `<h1>This order page isn't available</h1><div class="card"><p>The farm may have turned it off or made a new link. Ask them for the current one.</p></div>`);

// ---------------------------------------------------------------- owner email
async function ownerEmails(homesteadId) {
  const { url, key } = sb();
  const members = await rest(`homestead_members?select=user_id&homestead_id=eq.${homesteadId}&role=eq.owner&limit=3`) || [];
  const out = [];
  for (const m of members) {
    try {
      const r = await fetch(`${url}/auth/v1/admin/users/${m.user_id}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      if (r.ok) { const u = await r.json(); if (u && u.email) out.push(String(u.email).toLowerCase()); }
    } catch (_) { /* skip */ }
  }
  return out;
}
async function notifyOwner(page, row) {
  if (!page.op.emailMe || !process.env.RESEND_API_KEY) return;
  const to = await ownerEmails(page.id);
  if (!to.length) return;
  const { subject, html, text } = buildOwnerEmail({
    kind: row.kind, farmName: page.farm, name: row.customer_name, email: row.email, phone: row.phone,
    items: row.items, note: row.note, pickupDate: row.pickup_date, payMethod: row.pay_method, appUrl: `${process.env.APP_BASE_URL || SITE}/?open=orders`,
  });
  const from = process.env.STOCK_EMAIL_FROM || 'hello@henalytics.com';
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Henalytics <${from}>`, to, reply_to: row.email, subject, html, text }),
  }).catch((e) => console.error('[order-page] owner email failed', e));
}

// ---------------------------------------------------------------- handler
function parseBody(req) {
  let b = req.body;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch (_) { b = Object.fromEntries(new URLSearchParams(b)); }
  }
  return b && typeof b === 'object' ? b : {};
}

export default async function handler(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const raw = req.query && (req.query.t || req.query.token);
  const token = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  const send = (status, html) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); return res.status(status).send(html); };
  if (!['GET', 'HEAD', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD, POST'); return res.status(405).send('Method not allowed'); }
  if (!ORDER_TOKEN_RE.test(token)) return send(404, notFound());
  const { url, key } = sb();
  if (!url || !key) return send(500, shell('Not available', '<h1>Ordering is down for a moment</h1><div class="card"><p>Please try again soon.</p></div>'));

  let page;
  try { page = await findPage(token); } catch (e) { console.error('[order-page] lookup', e); return send(502, shell('Not available', '<h1>Ordering is down for a moment</h1><div class="card"><p>Please try again soon.</p></div>')); }
  if (!page) return send(404, notFound());
  if (req.method !== 'POST') return send(200, orderPageHtml(page, token));

  const b = parseBody(req);
  const values = {};
  ['name', 'email', 'phone', 'note', 'pickupDate', 'payMethod'].forEach((k) => { values[k] = typeof b[k] === 'string' ? b[k].slice(0, 700) : ''; });
  values.alsoJoin = b.alsoJoin === '1' || b.alsoJoin === true;
  values.textOk = b.textOk === '1' || b.textOk === true;
  const qty = {};
  Object.keys(b).filter((k) => k.startsWith('qty_')).slice(0, 100).forEach((k) => { qty[k.slice(4)] = b[k]; values[k] = String(b[k]).slice(0, 4); });
  const again = (msg, status = 400) => send(status, orderPageHtml(page, token, { error: msg, values }));

  // Bot checks: honeypot, signed form time.
  const ts = Number(b.ts);
  const age = (Date.now() - ts) / 1000;
  if (b.website || !Number.isFinite(ts) || typeof b.sig !== 'string' || b.sig !== formSig(token, String(b.ts)) || age > 86400) {
    return again('Something went wrong with the form. Please try again.');
  }
  if (age < MIN_SECONDS) return again('That was quick! Please check your request and send it again.');

  const kind = b.kind === 'join' ? 'join' : 'order';
  if (kind === 'join' && !page.op.joinList) return again("This farm isn't taking email list sign-ups here.");
  if (kind === 'order' && page.op.paused) return again(page.op.pausedNote || "They're not taking orders right now. Check back soon!");
  const cleaned = cleanRequest({ ...values, kind, qty }, page.op.menu, payOptions(page.op).map((m) => m.id), { pickupDays: page.op.pickupDays, today: new Date(Date.now() - 36 * 3600000).toISOString().slice(0, 10) });
  if (cleaned.error) return again(cleaned.error);

  const hash = ipHash(req, page.id);
  try {
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const mine = await rest(`order_requests?select=id&homestead_id=eq.${page.id}&ip_hash=eq.${hash}&created_at=gte.${encodeURIComponent(hourAgo)}&limit=${PER_VISITOR_HOUR + 1}`) || [];
    if (mine.length >= PER_VISITOR_HOUR) return again("You've sent a few requests already. Please wait a bit, or reach out to the farm directly.", 429);
    const all = await rest(`order_requests?select=id&homestead_id=eq.${page.id}&created_at=gte.${encodeURIComponent(dayAgo)}&limit=${PER_HOMESTEAD_DAY + 1}`) || [];
    if (all.length >= PER_HOMESTEAD_DAY) return again('This farm has a lot of requests today. Please try again tomorrow, or reach out to them directly.', 429);

    const rows = [{ ...cleaned.row, homestead_id: page.id, ip_hash: hash }];
    const joined = kind === 'order' && values.alsoJoin && page.op.joinList;
    if (joined) rows.push({ kind: 'join', customer_name: cleaned.row.customer_name, email: cleaned.row.email, phone: cleaned.row.text_ok ? cleaned.row.phone : '', items: [], note: '', pickup_date: null, homestead_id: page.id, ip_hash: hash, ...(cleaned.row.text_ok ? { text_ok: true } : {}) });
    // Every row in one insert must have the same keys (PostgREST rejects a
    // batch where they differ), so fill in the defaults for the extras.
    const same = (list) => list.map((r) => ({ pay_method: null, text_ok: false, ...r }));
    try {
      await rest('order_requests', { method: 'POST', body: JSON.stringify(same(rows)), headers: { Prefer: 'return=minimal' } });
    } catch (e) {
      // Table made before the pay_method column: save the order anyway, with
      // the pay choice in the note, so orders never stop coming in.
      if (!/pay_method|text_ok/.test(String(e && e.message))) throw e;
      const label = payLabel(rows[0].pay_method);
      const legacy = rows.map(({ pay_method: _p, text_ok: _t, ...r }) => r);
      if (label) legacy[0].note = `${legacy[0].note ? `${legacy[0].note}\n` : ''}Paying with ${label}`.slice(0, ORDER_LIMITS.note);
      await rest('order_requests', { method: 'POST', body: JSON.stringify(legacy), headers: { Prefer: 'return=minimal' } });
    }
    await notifyOwner(page, cleaned.row);
    return send(200, thanksHtml(page, token, cleaned.row, joined));
  } catch (e) {
    console.error('[order-page] save', e);
    return again("Your request didn't go through. Please try again in a minute.", 502);
  }
}
