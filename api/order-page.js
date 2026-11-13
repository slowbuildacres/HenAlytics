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
import { ORDER_TOKEN_RE, ORDER_LIMITS, cleanPageSettings, cleanRequest, buildOwnerEmail, buildCustomerEmail, esc, moneyText, itemLine, payOptions, payInstructions, orderTotal, payLabel, pickupDates, orderPrettyDate, WEEKDAYS, cleanDays, REPEAT_WEEKS, repeatLabel } from '../src/orderShared.js';
import { planAll, sourceKey, takesPreorders, publicSupply, perUnit, estimateRequest, addDays, daysBetween, HORIZON } from '../src/orderSupply.js';

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
// One form, one order. A double tap, a page refresh after sending, or the
// browser re-sending the form gives the same key, so the same order isn't
// saved twice: the key is the order's status_token (unique in the table).
// Built from the signed form time plus who sent it and exactly what they
// filled in, so a changed order from the same form is a new order, and two
// people can never share a key.
export function orderOnceKey(token, ts, hash, values, qty) {
  const q = Object.keys(qty).sort().filter((k) => Number(qty[k]) > 0).map((k) => [k, String(qty[k])]);
  const what = JSON.stringify([values.email.trim().toLowerCase(), q, values.pickupDate, values.note, values.fulfil, values.address, values.repeat, values.payMethod]);
  return crypto.createHmac('sha256', secret() || 'missing').update(`once|${token}|${ts}|${hash}|${what}`).digest('hex').slice(0, 32);
}
function ipHash(req, homesteadId) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || String(req.headers['x-real-ip'] || '') || 'unknown';
  return crypto.createHash('sha256').update(`${secret()}|${homesteadId}|${fwd}`).digest('hex').slice(0, 40);
}

// Today in the US farm's rough time (Central), for pickup-day checks.
const usToday = () => new Date(Date.now() - 6 * 3600000).toISOString().slice(0, 10);

// Where each menu item comes from (src/orderSupply.js): the farm stand, the
// hens, the goats, a garden crop, or made to order. Items that take
// pre-orders get a small curve the page uses to work out ready dates; stand
// items that don't keep a hard limit (`left`). Only numbers leave here,
// never the logs, the stand or the other orders.
async function withSupply(row) {
  const raw = Array.isArray(row.op.menu) ? row.op.menu : [];
  if (!raw.some((m) => m && m.id && sourceKey(m))) return row.op;
  const today = usToday();
  const [h] = await rest(`homesteads?select=hobbies:data->hobbies&id=eq.${row.id}&limit=1`) || [];
  const open = await openOrders(row.id);
  const { plans, orderReady } = planAll(raw, open, { today, hobbies: h && h.hobbies, snaps: row.op.snaps, pickupDays: cleanDays(row.op.pickupDays) });
  row.orderReady = orderReady;
  const groupOf = new Map();
  const menu = raw.map((m) => {
    const key = m && m.id ? sourceKey(m) : '';
    const plan = key && plans.get(key);
    if (!plan) return m;
    if (!groupOf.has(key)) groupOf.set(key, groupOf.size + 1);
    if (takesPreorders(m)) return { ...m, sup: publicSupply(m, plan, groupOf.get(key)) };
    // A stand item without pre-orders: what's ready, less what's promised.
    return { ...m, left: plan.mode === 'stock' ? Math.floor((plan.free[0] ? plan.free[0][1] : 0) / perUnit(m)) : undefined };
  });
  return { ...row.op, menu };
}

// Open orders for planning (standing orders count every N weeks). Works
// before the repeat_weeks column exists.
async function openOrders(homesteadId) {
  const q = (cols) => rest(`order_requests?select=${cols}&homestead_id=eq.${homesteadId}&kind=eq.order&status=in.(new,accepted,ready)&order=created_at.asc&limit=500`);
  try { return await q('id,items,pickup_date,created_at,status,repeat_weeks') || []; } catch (e) {
    if (!/repeat_weeks/.test(String(e && e.message))) throw e;
    return await q('id,items,pickup_date,created_at,status') || [];
  }
}

// byId: a customer's status link still works after the farm makes a new
// page link (it finds the farm from the order instead).
// statusOnly: a customer checking on an order sees it even if the farm has
// turned the page off since.
async function findPage(token, byId, statusOnly) {
  const sel = 'id,farm:data->>homesteadName,op:data->orderPage,fromName:data->stockEmailSettings->>fromName,replyTo:data->stockEmailSettings->>replyTo';
  const rows = await rest(byId ? `homesteads?select=${sel}&id=eq.${byId}&limit=1` : `homesteads?select=${sel}&data->orderPage->>token=eq.${token}&limit=1`);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || !row.op) return null;
  try { row.op = await withSupply(row); } catch (e) { console.error('[order-page] supply', e); }
  const op = cleanPageSettings(row.op);
  if ((!op.on && !statusOnly) || (!byId && op.token !== token)) return null;
  const farm = String(row.fromName || row.farm || '').trim().slice(0, 60) || 'Our farm stand';
  return { id: row.id, farm, op, today: usToday(), orderReady: row.orderReady || new Map(), replyTo: /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(String(row.replyTo || '')) ? String(row.replyTo) : '' };
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
.back{display:flex;gap:8px;align-items:center;font-weight:400;font-size:14px;margin:0;max-width:150px}.back input{width:20px;height:20px;flex-shrink:0}
.est{background:var(--alt);border-radius:12px;padding:10px 12px;margin:10px 0 0;font-size:15px}.est .btn{margin-top:10px;min-height:44px;font-size:15px}.ahead{display:block;font-size:13px;margin-top:2px}
.err{background:#C84B3122;border:1px solid #C84B31;border-radius:12px;padding:10px 12px;margin:10px 0}
footer{text-align:center;font-size:13px;color:var(--soft);margin-top:24px}footer a{color:var(--soft)}
`;
function shell(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="robots" content="noindex"><style>${CSS}</style></head>
<body><main>${body}<footer>Order requests by <a href="${SITE}">Henalytics</a>, the homestead app.</footer></main></body></html>`;
}

// "loaf" → "loaves", "dozen" stays "dozen", "jar" → "jars".
function plural(unit, n) {
  const u = String(unit || '').trim();
  if (n === 1 || !u || /doz|dz/i.test(u) || /s$/i.test(u)) return u;
  if (/[^aeiou]y$/i.test(u)) return `${u.slice(0, -1)}ies`;
  if (/(af|lf)$/i.test(u)) return `${u.slice(0, -1)}ves`;
  if (/(ch|sh|x)$/i.test(u)) return `${u}es`;
  return `${u}s`;
}

// The page's ready-date estimate, worked out in the browser as people change
// how many they want or the day. Same rules as readyForNew() in
// src/orderSupply.js; the server works it out again when they send it.
function estimateScript(sup, today, farm) {
  const data = JSON.stringify({ sup, today, farm }).replace(/</g, '\\u003c');
  return `(function(){var D=${data},el=document.getElementById('o-est');if(!el)return;
function rd(p,u,from){if(p.mode==='slot'){var f=p.free,i=-1,k,cap=0;for(k=0;k<f.length;k++){if(f[k][3]>cap)cap=f[k][3];if(i<0&&f[k][1]>=from)i=k;}if(i<0)return null;if(f[i][4]!=null)cap=f[i][4];if(u<=cap+1e-9){for(;i<f.length;i++)if(f[i][3]+1e-9>=u)return f[i][2];return null;}var l=u;for(;i<f.length;i++){l-=f[i][3];if(l<=1e-9)return f[i][2];}return null;}for(var j=0;j<p.free.length;j++)if(p.free[j][1]+1e-9>=u)return Math.max(p.free[j][0],0);return null;}
var t0=D.today.split('-').map(Number),F=String(D.farm).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});function day(iso){if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(iso||''))return -1;var a=iso.split('-').map(Number);return Math.round((Date.UTC(a[0],a[1]-1,a[2])-Date.UTC(t0[0],t0[1]-1,t0[2]))/864e5);}
function iso(d){return new Date(Date.UTC(t0[0],t0[1]-1,t0[2]+d)).toISOString().slice(0,10);}
function pretty(d){return new Date(Date.UTC(t0[0],t0[1]-1,t0[2]+d)).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'});}
var dt=document.getElementById('o-date');
function upd(){var any=false,never=false,r=0,w=dt?day(dt.value):-1,from=Math.max(0,w);
var G={};Object.keys(D.sup).forEach(function(id){var i=document.querySelector('input[name="qty_'+id+'"]');var n=i?Math.floor(Number(i.value)||0):0;if(n<=0)return;any=true;var p=D.sup[id];var k=p.mode==='slot'?'s'+id:'g'+(p.g||0);if(!G[k])G[k]={p:p,u:0};G[k].u+=p.mode==='slot'?n:n*p.per;});
Object.keys(G).forEach(function(k){var p=G[k].p;var d=rd(p,G[k].u,p.mode==='slot'?from:0);if(d===null)never=true;else if(d>r)r=d;});
if(!any){el.hidden=true;el.innerHTML='';return;}el.hidden=false;var msg,btn='';
if(never)msg='That\\'s more than '+F+' expects to have in the next few months. You can still send it, and they\\'ll let you know when they can fill it.';
else if(w>=0&&r<=w)msg='<b>\\u2713 Should be ready by '+pretty(w)+'.</b>';
else{var opt=null;if(dt&&dt.tagName==='SELECT'){for(var k=0;k<dt.options.length;k++){if(dt.options[k].value&&day(dt.options[k].value)>=r){opt=dt.options[k];break;}}}
var when=opt?'for '+opt.text:'around '+pretty(r);
if(w>=0){msg='<b>Probably not ready by '+pretty(w)+'.</b> Likely ready '+when+'.';btn=opt?'<button type="button" class="btn alt" id="o-later" data-v="'+opt.value+'">Pick '+opt.text+' instead</button>':(dt&&dt.tagName!=='SELECT'?'<button type="button" class="btn alt" id="o-later" data-v="'+iso(r)+'">Ask for '+pretty(r)+' instead</button>':'');}
else msg=r===0?'<b>Should be ready now.</b>':'<b>Likely ready '+when+'.</b>';}
el.innerHTML=msg+(never?'':' <span class="soft">An estimate from what '+F+' has and makes; they\\'ll confirm.</span>')+btn;
var b=document.getElementById('o-later');if(b)b.addEventListener('click',function(){dt.value=b.getAttribute('data-v');upd();});}
document.addEventListener('input',upd);document.addEventListener('change',upd);upd();})();`;
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
    const max = Math.min(ORDER_LIMITS.qty, Number.isFinite(m.left) ? m.left : ORDER_LIMITS.qty, m.maxEach || ORDER_LIMITS.qty);
    const tags = [];
    if (m.maxEach && !out) tags.push(`Up to ${m.maxEach} an order`);
    if (out) tags.push('Sold out for now');
    else if (Number.isFinite(m.left) && m.left <= 10) tags.push(`${m.left} left`);
    let ahead = '';
    if (m.sup) {
      if (m.sup.mode === 'slot') tags.push('Made to order');
      else {
        const now = m.sup.free.length && m.sup.free[0][0] === 0 ? Math.floor(m.sup.free[0][1] / m.sup.per) : 0;
        tags.push(now > 0 ? (now <= 24 ? `${now} ready now` : 'Ready now') : 'Pre-order');
      }
      if (m.sup.mode === 'stock' && m.sup.ahead > 0) ahead = `<span class="soft ahead">${m.sup.ahead} ${esc(plural(m.unit || 'more', m.sup.ahead))} already ordered for the next 2 weeks</span>`;
    }
    return `
    <div class="item${out ? ' out' : ''}"><div class="n"><b>${esc(m.name)}</b><span class="soft">${[m.price ? `${moneyText(m.price)}${m.unit ? ` a ${esc(m.unit)}` : ''}` : (m.unit ? esc(m.unit) : ''), esc(m.note)].filter(Boolean).join(' · ')}</span>${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}${ahead}</div>
      ${out ? (op.notifyBack ? `<label class="back"><input type="checkbox" name="back_${esc(m.id)}" value="1"${values[`back_${m.id}`] ? ' checked' : ''}> Email me when it's back</label>` : '') : `<div class="qty" data-max="${max}"><button type="button" aria-label="Fewer ${esc(m.name)}" data-d="-1">−</button><input type="number" inputmode="numeric" min="0" max="${max}" name="qty_${esc(m.id)}" value="${esc(values[`qty_${m.id}`] || '0')}" aria-label="How many ${esc(m.name)}"><button type="button" aria-label="More ${esc(m.name)}" data-d="1">+</button></div>`}</div>`;
  }).join('');
  const days = op.pickupDays;
  const dates = pickupDates(days, page.today || usToday());
  const dateHtml = days.length
    ? `<label for="o-date">Pickup day</label><select id="o-date" name="pickupDate" required data-days="${days.join(',')}"><option value="">Pick a day</option>${dates.map((d) => `<option value="${d}"${values.pickupDate === d ? ' selected' : ''}>${esc(orderPrettyDate(d))}</option>`).join('')}</select>
  <p class="soft" style="margin:6px 2px 0">Pickups on ${days.map((d) => WEEKDAYS[d]).join(', ')}.</p>`
    : `<label for="o-date">When would you like it? (optional)</label><input id="o-date" type="date" name="pickupDate" min="${esc(page.today || usToday())}" value="${v('pickupDate')}">`;
  // Pre-orders: the numbers the page needs to say when an order is likely
  // ready (see src/orderSupply.js). Only items that take pre-orders.
  const sup = {};
  avail.forEach((m) => { if (m.sup) sup[m.id] = m.sup; });
  const hasSup = Object.keys(sup).length > 0;
  const estHtml = hasSup ? '<p id="o-est" class="est" aria-live="polite" hidden></p>' : '';
  const dl = op.delivery;
  const fulfilHtml = dl.on ? `<fieldset style="border:none;padding:0;margin:0"><legend style="font-weight:600;font-size:14px;margin:12px 2px 6px">Pickup or delivery?</legend>
  <div class="pay"><label><input type="radio" name="fulfil" value="pickup"${values.fulfil !== 'delivery' ? ' checked' : ''}> Pickup${op.pickup ? ` <small>${esc(op.pickup)}</small>` : ''}</label>
  <label><input type="radio" name="fulfil" value="delivery"${values.fulfil === 'delivery' ? ' checked' : ''}> Delivery${dl.fee ? ` <small>+${esc(moneyText(dl.fee))}</small>` : ''}${dl.note ? ` <small>${esc(dl.note)}</small>` : ''}</label></div>
  <div id="o-addr-wrap"${values.fulfil === 'delivery' ? '' : ' hidden'}><label for="o-addr">Address to deliver to</label><input id="o-addr" type="text" name="address" maxlength="${ORDER_LIMITS.address}" autocomplete="street-address" value="${v('address')}"></div></fieldset>` : '';
  const standingHtml = op.standing && days.length ? `<label for="o-repeat">How often?</label><select id="o-repeat" name="repeat"><option value="">Just this once</option>${REPEAT_WEEKS.map((w) => `<option value="${w}"${String(values.repeat) === String(w) ? ' selected' : ''}>${esc(repeatLabel(w))}</option>`).join('')}</select>
  <p class="soft" style="margin:6px 2px 0">A standing order repeats from the day you pick until you stop it from your order link.</p>` : '';
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
  ${fulfilHtml}
  ${dateHtml}
  ${standingHtml}
  ${estHtml}
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
<script>document.querySelectorAll('form[method=post]').forEach(function(f){var sent=false,b=f.querySelector('button[type=submit]'),t=b&&b.textContent;f.addEventListener('submit',function(e){if(sent){e.preventDefault();return;}sent=true;setTimeout(function(){if(b){b.disabled=true;b.textContent='Sending\u2026';}},0);});window.addEventListener('pageshow',function(){sent=false;if(b){b.disabled=false;b.textContent=t;}});});
document.querySelectorAll('.qty').forEach(function(q){var i=q.querySelector('input'),mx=Number(q.getAttribute('data-max'))||${ORDER_LIMITS.qty};q.querySelectorAll('button').forEach(function(b){b.addEventListener('click',function(){var n=Math.max(0,Math.min(mx,(parseInt(i.value,10)||0)+Number(b.getAttribute('data-d'))));i.value=n;i.dispatchEvent(new Event('input',{bubbles:true}));});});});
(function(){var s=document.querySelector('select[data-days]');if(!s)return;var days=s.getAttribute('data-days').split(',').map(Number),keep=s.value,now=new Date(),out=[];for(var k=0;k<=${HORIZON}&&out.length<80;k++){var t=new Date(now.getFullYear(),now.getMonth(),now.getDate()+k);if(days.indexOf(t.getDay())>-1)out.push(t);}
var p=function(n){return(n<10?'0':'')+n};s.innerHTML='<option value="">Pick a day</option>'+out.map(function(t){var v=t.getFullYear()+'-'+p(t.getMonth()+1)+'-'+p(t.getDate());return '<option value="'+v+'"'+(v===keep?' selected':'')+'>'+t.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+'</option>'}).join('');})();
${hasSup ? estimateScript(sup, page.today || usToday(), farm) : ''}
(function(){var w=document.getElementById('o-addr-wrap');if(!w)return;function f(){var d=document.querySelector('input[name="fulfil"][value="delivery"]');var on=d&&d.checked;w.hidden=!on;var a=document.getElementById('o-addr');if(a)a.required=!!on;var l=document.querySelector('label[for="o-date"]');if(l&&!l.getAttribute('data-p'))l.setAttribute('data-p',l.textContent);if(l)l.textContent=on?l.getAttribute('data-p').replace('Pickup day','Delivery day'):l.getAttribute('data-p');}document.querySelectorAll('input[name="fulfil"]').forEach(function(r){r.addEventListener('change',f);});f();})();</script>`;
  return shell(`${farm} · Order`, body);
}

function op_nextPickup(days, fromIso) {
  return (days && days.length ? pickupDates(days, fromIso, 1, 14)[0] : '') || '';
}

// The ready estimate for a request that just came in: { forCustomer, forOwner }.
function requestEstimate(page, row) {
  if (!row || row.kind !== 'order' || !row.items || !row.items.length) return null;
  const today = page.today || usToday();
  const want = row.pickup_date ? Math.max(0, daysBetween(today, row.pickup_date)) : -1;
  const qty = {};
  row.items.forEach((i) => { qty[i.id] = (qty[i.id] || 0) + Number(i.qty || 0); });
  const d = estimateRequest(page.op.menu, qty, Math.max(0, want));
  if (d === undefined) return null;
  if (d === null) return { forCustomer: `That's more than ${page.farm} expects to have in the next few months, so they'll let you know when they can fill it.`, forOwner: "Henalytics estimate: more than you have or have coming in the next 6 months." };
  // With pickup days, say the first pickup day it'll be ready for.
  const readyIso = addDays(today, d);
  const pick = op_nextPickup(page.op.pickupDays, readyIso);
  const when = orderPrettyDate(pick || readyIso);
  if (want >= 0 && d > want) return { forCustomer: `It's probably not ready by ${orderPrettyDate(row.pickup_date)}. ${page.farm} expects it around ${when} and will let you know.`, forOwner: `Henalytics estimate: likely ready around ${when}, after the day they asked for.` };
  if (d === 0) return { forCustomer: `${page.farm} should have it ready${want > 0 ? ` by ${orderPrettyDate(row.pickup_date)}` : ''}.`, forOwner: 'Henalytics estimate: you have enough ready now.' };
  return { forCustomer: want >= 0 ? `${page.farm} expects to have it ready by ${orderPrettyDate(row.pickup_date)}.` : `${page.farm} expects to have it ready around ${when}.`, forOwner: `Henalytics estimate: likely ready around ${when}.` };
}

const statusUrl = (token, st) => (st ? `${SITE}/o/${token}?s=${st}` : '');
const whenLine = (row) => {
  const when = orderPrettyDate(row.pickup_date);
  const how = row.fulfil === 'delivery' ? 'Delivery' : 'Pickup';
  return when ? `${how}: ${when}${row.repeat_weeks ? `, then ${repeatLabel(row.repeat_weeks).toLowerCase()}` : ''}` : '';
};

function thanksHtml(page, token, row, { joined, backItems = [], accepted } = {}) {
  if (row.kind === 'join') return shell(`${page.farm} · Thank you`, `<h1>You're on the list</h1><div class="card"><p>Thanks, ${esc(row.customer_name)}! ${esc(page.farm)} will email ${esc(row.email)} when there's something fresh.</p></div>`);
  const back = backItems.length ? `<p>${esc(page.farm)} will email ${esc(row.email)} when ${esc(backItems.map((i) => i.name).join(' or '))} ${backItems.length === 1 ? "is" : "are"} back.</p>` : '';
  if (row.kind === 'notify') {
    return shell(`${page.farm} · Thank you`, `<h1>We'll let you know</h1><div class="card">${back}</div><p style="text-align:center"><a href="/o/${token}" style="color:inherit">Back to ${esc(page.farm)}</a></p>`);
  }
  const est = requestEstimate(page, row);
  const items = (row.items || []).map((i) => `<li>${esc(itemLine(i))}</li>`).join('');
  const link = statusUrl(token, row.status_token);
  const body = `<h1>${accepted ? 'Order accepted' : 'Request sent'}</h1><div class="card"><p>Thanks, ${esc(row.customer_name)}! ${accepted ? `${esc(page.farm)} has enough for this, so it's accepted. They'll email ${esc(row.email)} when it's ready.` : `${esc(page.farm)} got your request and will email ${esc(row.email)} when they've looked at it.`}</p>
${items ? `<ul>${items}</ul>` : ''}${row.note ? `<p class="soft">Your note: ${esc(row.note)}</p>` : ''}
${whenLine(row) ? `<p class="soft">${esc(whenLine(row))}${row.address ? ` · ${esc(row.address)}` : ''}</p>` : ''}
${est ? `<p class="est">${esc(est.forCustomer)} <span class="soft">It's an estimate; they'll confirm.</span></p>` : ''}
${back}
${joined ? `<p class="soft">You'll also get their "what's fresh" emails.</p>` : ''}
${row.text_ok ? `<p class="soft">They may text you at ${esc(row.phone)} about this order.</p>` : ''}
${link ? `<p><a class="btn alt link" href="${esc(link)}">Check on your order anytime</a></p><p class="soft" style="margin-top:6px">Save this link. ${row.repeat_weeks ? 'You can stop your standing order there too.' : 'You can cancel there if plans change.'}</p>` : ''}
${payBlock(page, row)}</div>`;
  return shell(`${page.farm} · Thank you`, `${body}<p style="text-align:center"><a href="/o/${token}" style="color:inherit">Back to ${esc(page.farm)}</a></p>`);
}

// A customer's own order, from the link in their emails (?s=<status_token>).
const STATUS_TEXT = {
  new: (f) => `Waiting for ${f} to look at it.`,
  accepted: (f) => `${f} has your order and is getting it ready.`,
  ready: () => 'Ready for you!',
  done: () => 'Picked up. Thanks!',
  declined: (f) => `${f} couldn't fill this one.`,
  cancelled: () => 'You cancelled this order.',
};
function statusHtml(page, token, row, { notice } = {}) {
  const ts = String(Date.now());
  const sig = formSig(token, ts);
  const items = (row.items || []).map((i) => `<li>${esc(itemLine(i))}</li>`).join('');
  const open = ['new', 'accepted', 'ready'].includes(row.status);
  const d = page.orderReady && page.orderReady.get(row.id);
  const today = page.today || usToday();
  const want = row.pickup_date ? daysBetween(today, row.pickup_date) : -1;
  const readyIso = d != null ? addDays(today, d) : '';
  const est = !open || row.status === 'ready' || d === undefined ? ''
    : d === null ? `${page.farm} will let you know when they can fill it.`
    : want >= 0 && d <= want ? `Should be ready by ${orderPrettyDate(row.pickup_date)}.`
    : want >= 0 ? `Likely ready around ${orderPrettyDate(op_nextPickup(page.op.pickupDays, readyIso) || readyIso)}, a bit after the day you asked for. ${page.farm} will be in touch.`
    : d === 0 ? 'They should have enough for it now.' : `Likely ready around ${orderPrettyDate(readyIso)}.`;
  const form = (action, label, alt) => `<form method="post" action="/o/${token}?s=${esc(row.status_token)}" style="margin:0"><input type="hidden" name="ts" value="${ts}"><input type="hidden" name="sig" value="${sig}"><input type="hidden" name="act" value="${action}"><button class="btn${alt ? ' alt' : ''}" type="submit">${esc(label)}</button></form>`;
  const pageLink = page.op.on && page.op.token && !page.op.paused ? `/o/${page.op.token}` : '';
  const body = `<h1>Your order from ${esc(page.farm)}</h1>
${notice ? `<div class="est" role="status">${esc(notice)}</div>` : ''}
<div class="card"><p><b>${esc(row.status === 'ready' && row.fulfil === 'delivery' ? `Ready! ${page.farm} will bring it by.` : row.status === 'done' && row.fulfil === 'delivery' ? 'Delivered. Thanks!' : (STATUS_TEXT[row.status] || STATUS_TEXT.new)(page.farm))}</b></p>
${items ? `<ul>${items}</ul>` : ''}${row.note ? `<p class="soft">Your note: ${esc(row.note)}</p>` : ''}
${whenLine(row) ? `<p class="soft">${esc(whenLine(row))}${row.address ? ` · ${esc(row.address)}` : ''}</p>` : ''}
${est ? `<p class="est">${esc(est)} <span class="soft">An estimate; they'll confirm.</span></p>` : ''}
${open && row.owner_message ? `<p class="soft">From ${esc(page.farm)}: ${esc(row.owner_message)}</p>` : ''}
${open ? payBlock(page, row) : ''}
${open && row.repeat_weeks ? form('stop', 'Stop my standing order after this one', true) : ''}
${open && row.status !== 'ready' ? form('cancel', 'Cancel this order', true) : ''}</div>
${pageLink ? `<p style="text-align:center"><a href="${pageLink}" style="color:inherit">${open ? 'Order something else' : 'Order again'} from ${esc(page.farm)}</a></p>` : ''}`;
  return shell(`${page.farm} · Your order`, body);
}

// How to pay, right after ordering (or a note that it comes later).
function payBlock(page, row) {
  const none = `<p class="soft">No payment was taken. Settle up with them when you ${row.fulfil === 'delivery' ? 'get your order' : 'pick up'}.</p>`;
  if (!row.pay_method) return none;
  if (row.paid) return `<p class="soft">Marked paid with ${esc(payLabel(row.pay_method))}. Thanks!</p>`;
  const total = orderTotal(row.items);
  if (page.op.payWhen === 'accepted' && !['accepted', 'ready'].includes(row.status)) {
    return `<p class="soft">You picked ${esc(payLabel(row.pay_method))}. Once ${esc(page.farm)} accepts your order, they'll email you how to pay${total != null ? ` (about ${esc(moneyText(total))})` : ''}.</p>`;
  }
  // No total yet (they wrote what they want in the note): don't ask them to
  // pay an unknown amount. The accepted email carries the pay button.
  if (total == null) {
    return `<p class="soft">You picked ${esc(payLabel(row.pay_method))}. ${esc(page.farm)} will confirm the total and send you how to pay when they accept your order.</p>`;
  }
  const p = payInstructions({ method: row.pay_method, op: page.op, amount: total, farm: page.farm, delivery: row.fulfil === 'delivery' });
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
// "We got your request" (or "accepted", when it was accepted on its own) to
// the customer, with their status link: the thank-you page is easy to lose.
async function confirmCustomer(page, token, row) {
  if (!process.env.RESEND_API_KEY || !row || row.kind !== 'order' || !row.status_token) return;
  try {
    const sent = await rest(`order_requests?select=id&homestead_id=eq.${page.id}&emailed_at=gte.${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}&limit=201`) || [];
    if (sent.length >= 200) return;
    const replyTo = page.replyTo || (await ownerEmails(page.id))[0] || '';
    const mail = buildCustomerEmail({
      status: row.status === 'accepted' ? 'accepted' : 'received', farmName: page.farm, items: row.items, note: row.note, pickupDate: row.pickup_date,
      pickupText: page.op.pickup, pay: row.pay_method ? { method: row.pay_method, op: page.op, paid: false } : null,
      statusUrl: statusUrl(token, row.status_token), repeatWeeks: row.repeat_weeks || 0, address: row.fulfil === 'delivery' ? row.address : '',
    });
    const from = process.env.STOCK_EMAIL_FROM || 'hello@henalytics.com';
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${page.farm.replace(/[<>"\r\n]/g, '')} <${from}>`, to: [row.email], ...(replyTo ? { reply_to: replyTo } : {}), subject: mail.subject, html: mail.html, text: `${mail.text}\n\nDidn't ask for this? You can ignore this email.` }),
    });
    if (r.ok) await rest(`order_requests?status_token=eq.${row.status_token}&homestead_id=eq.${page.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ emailed_at: new Date().toISOString() }) }).catch(() => {});
  } catch (e) { console.error('[order-page] confirm email', e); }
}

// subject: for a customer's change from their status link (cancel, stop).
async function notifyOwner(page, row, subjectOverride) {
  if (!page.op.emailMe || !process.env.RESEND_API_KEY) return;
  const to = await ownerEmails(page.id);
  if (!to.length) return;
  const built = buildOwnerEmail({
    kind: row.kind, farmName: page.farm, name: row.customer_name, email: row.email, phone: row.phone,
    items: row.items, note: row.note, pickupDate: row.pickup_date, payMethod: row.pay_method, estimate: row.kind === 'order' && !row.noEstimate && ['new', 'accepted'].includes(row.status || 'new') ? (requestEstimate(page, row) || {}).forOwner || '' : '', repeatWeeks: row.repeat_weeks, address: row.address, appUrl: `${process.env.APP_BASE_URL || SITE}/?open=orders`,
  });
  const { html, text } = built;
  const subject = subjectOverride || built.subject;
  const from = process.env.STOCK_EMAIL_FROM || 'hello@henalytics.com';
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Henalytics <${from}>`, to, ...(row.email ? { reply_to: row.email } : {}), subject, html, text }),
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

// Columns added by 20261112_order_extras.sql. Until it runs, requests are
// saved without them (standing and delivery go in the note) so orders never
// stop coming in.
const EXTRA_COLS = /status_token|repeat_weeks|fulfil|address|kind_check|order_requests_kind/;
// Saves each row on its own: a batch insert needs every row to have the same
// keys, and an order, a "tell me when it's back" and a list sign-up don't.
// Returns the rows as saved (an old table keeps standing/delivery in the note
// and has no status link, and can't take "tell me when it's back" yet).
async function saveRows(rows) {
  const out = [];
  for (const r of rows) {
    const saved = await saveRow(r);
    if (saved) out.push(saved);
  }
  return out;
}
async function saveRow(row) {
  const post = (r) => rest('order_requests', { method: 'POST', body: JSON.stringify(r), headers: { Prefer: 'return=minimal' } });
  try { await post(row); return row; } catch (e) {
    const msg = String(e && e.message);
    if (/23505|duplicate key/.test(msg)) throw e;
    if (!EXTRA_COLS.test(msg) && !/pay_method|text_ok/.test(msg)) throw e;
  }
  if (row.kind === 'notify') return null;
  const { status_token: _s, repeat_weeks: rw, fulfil, address, ...rest2 } = row;
  const extra = [rw ? repeatLabel(rw) : '', fulfil === 'delivery' ? `Deliver to ${address}` : ''].filter(Boolean).join('. ');
  const legacy = { ...rest2, note: [row.note, extra].filter(Boolean).join('\n').slice(0, ORDER_LIMITS.note) };
  try { await post(legacy); return legacy; } catch (e2) {
    if (!/pay_method|text_ok/.test(String(e2 && e2.message))) throw e2;
  }
  const { pay_method: pm, text_ok: _t, ...bare } = legacy;
  const label = payLabel(pm);
  if (label) bare.note = `${bare.note ? `${bare.note}\n` : ''}Paying with ${label}`.slice(0, ORDER_LIMITS.note);
  await post(bare);
  return bare;
}

// Would this order be ready in time with what's there? (auto-accept)
function coveredNow(page, row) {
  // A standing order is a promise for every week to come: the owner decides.
  if (!row.items.length || row.repeat_weeks) return false;
  const tracked = new Set(page.op.menu.filter((m) => m.sup || Number.isFinite(m.left)).map((m) => m.id));
  if (!row.items.every((i) => i.id === 'delivery' || tracked.has(i.id))) return false;
  const today = page.today || usToday();
  const want = row.pickup_date ? Math.max(0, daysBetween(today, row.pickup_date)) : -1;
  const qty = {};
  row.items.forEach((i) => { qty[i.id] = (qty[i.id] || 0) + Number(i.qty || 0); });
  const d = estimateRequest(page.op.menu, qty, Math.max(0, want));
  if (d === undefined) return row.items.every((i) => i.id === 'delivery' || page.op.menu.some((m) => m.id === i.id && Number.isFinite(m.left)));
  return d !== null && (want < 0 ? d === 0 : d <= want);
}

export default async function handler(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const raw = req.query && (req.query.t || req.query.token);
  const token = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  const sRaw = req.query && req.query.s;
  const stToken = typeof sRaw === 'string' && /^[a-f0-9]{32}$/.test(sRaw.trim().toLowerCase()) ? sRaw.trim().toLowerCase() : '';
  const send = (status, html) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); return res.status(status).send(html); };
  if (!['GET', 'HEAD', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD, POST'); return res.status(405).send('Method not allowed'); }
  if (!ORDER_TOKEN_RE.test(token)) return send(404, notFound());
  const { url, key } = sb();
  if (!url || !key) return send(500, shell('Not available', '<h1>Ordering is down for a moment</h1><div class="card"><p>Please try again soon.</p></div>'));

  let page;
  try {
    page = await findPage(token, null, !!stToken);
    if (!page && stToken) {
      const o = await rest(`order_requests?select=homestead_id&status_token=eq.${stToken}&limit=1`).catch(() => null);
      if (Array.isArray(o) && o[0] && /^[0-9a-f-]{36}$/i.test(String(o[0].homestead_id))) page = await findPage(token, o[0].homestead_id, true);
    }
  } catch (e) { console.error('[order-page] lookup', e); return send(502, shell('Not available', '<h1>Ordering is down for a moment</h1><div class="card"><p>Please try again soon.</p></div>')); }
  if (!page) return send(404, notFound());
  const b = req.method === 'POST' ? parseBody(req) : {};
  const signed = () => {
    const ts = Number(b.ts);
    const age = (Date.now() - ts) / 1000;
    return !b.website && Number.isFinite(ts) && typeof b.sig === 'string' && b.sig === formSig(token, String(b.ts)) && age <= 86400;
  };

  // A customer's own order: look, cancel, or stop a standing order.
  if (stToken) {
    let row = null;
    try {
      const found = await rest(`order_requests?select=id,kind,status,customer_name,items,note,pickup_date,owner_message,pay_method,paid,repeat_weeks,fulfil,address,status_token&homestead_id=eq.${page.id}&status_token=eq.${stToken}&kind=eq.order&limit=1`);
      row = Array.isArray(found) ? found[0] : null;
    } catch (e) { console.error('[order-page] status', e); }
    if (!row) return send(404, shell('Order not found', `<h1>We couldn't find that order</h1><div class="card"><p>The link may be old. Ask ${esc(page.farm)}, or <a href="/o/${token}">send a new request</a>.</p></div>`));
    if (req.method !== 'POST') return send(200, statusHtml(page, token, row, { notice: req.query && req.query.again === '1' ? 'You already sent this order, so it went in once. Here it is.' : '' }));
    if (!signed()) return send(400, statusHtml(page, token, row, { notice: 'Something went wrong. Please try again.' }));
    const open = ['new', 'accepted', 'ready'].includes(row.status);
    let notice = '';
    if (b.act === 'cancel' && open && row.status !== 'ready') {
      await rest(`order_requests?id=eq.${row.id}&homestead_id=eq.${page.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'cancelled', updated_at: new Date().toISOString() }) });
      row.status = 'cancelled';
      notice = `Cancelled. ${page.farm} can see that in their orders.`;
      await notifyOwner(page, { ...row, kind: 'order', note: 'Cancelled this order.', email: '', customer_name: row.customer_name }, `${row.customer_name} cancelled their order`).catch(() => {});
    } else if (b.act === 'stop' && open && row.repeat_weeks) {
      await rest(`order_requests?id=eq.${row.id}&homestead_id=eq.${page.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ repeat_weeks: null, updated_at: new Date().toISOString() }) });
      row.repeat_weeks = null;
      notice = `Done. This is your last one; ${page.farm} won't repeat it.`;
      await notifyOwner(page, { ...row, kind: 'order', note: 'Stopped their standing order after this one.', email: '', noEstimate: true }, `${row.customer_name} stopped their standing order`).catch(() => {});
    }
    return send(200, statusHtml(page, token, row, { notice }));
  }

  if (req.method !== 'POST') return send(200, orderPageHtml(page, token));

  const values = {};
  ['name', 'email', 'phone', 'note', 'pickupDate', 'payMethod', 'fulfil', 'address', 'repeat'].forEach((k) => { values[k] = typeof b[k] === 'string' ? b[k].slice(0, 700) : ''; });
  values.alsoJoin = b.alsoJoin === '1' || b.alsoJoin === true;
  values.textOk = b.textOk === '1' || b.textOk === true;
  const qty = {};
  Object.keys(b).filter((k) => k.startsWith('qty_')).slice(0, 100).forEach((k) => { qty[k.slice(4)] = b[k]; values[k] = String(b[k]).slice(0, 4); });
  const backIds = Object.keys(b).filter((k) => k.startsWith('back_') && (b[k] === '1' || b[k] === true)).slice(0, 40).map((k) => k.slice(5));
  backIds.forEach((id) => { values[`back_${id}`] = true; });
  const again = (msg, status = 400) => send(status, orderPageHtml(page, token, { error: msg, values }));

  // Bot checks: honeypot, signed form time.
  if (!signed()) return again(Number(b.ts) && Date.now() - Number(b.ts) > 86400000 ? 'This page was open a while, so please check your order and send it again.' : 'Something went wrong with the form. Please try again.');
  if ((Date.now() - Number(b.ts)) / 1000 < MIN_SECONDS) return again('That was quick! Please check your request and send it again.');

  const kind = b.kind === 'join' ? 'join' : 'order';
  if (kind === 'join' && !page.op.joinList) return again("This farm isn't taking email list sign-ups here.");
  if (kind === 'order' && page.op.paused) return again(page.op.pausedNote || "They're not taking orders right now. Check back soon!");
  // Sent before? Show that order instead of saving it again (before the
  // stock checks: the first one may have taken the last of it).
  const hash = ipHash(req, page.id);
  const anyQty = Object.values(qty).some((n) => Number(n) > 0);
  const onceKey = kind === 'order' && (anyQty || String(values.note || '').trim()) ? orderOnceKey(token, String(b.ts), hash, values, qty) : '';
  const already = () => { res.setHeader('Location', `/o/${token}?s=${onceKey}&again=1`); res.setHeader('Cache-Control', 'no-store'); return res.status(303).send(''); };
  if (onceKey) {
    const dup = await rest(`order_requests?select=id&homestead_id=eq.${page.id}&status_token=eq.${onceKey}&limit=1`).catch(() => null);
    if (Array.isArray(dup) && dup.length) return already();
  }
  // "Email me when it's back" only, with nothing to order: just the note.
  const backItems = kind === 'order' && page.op.notifyBack ? page.op.menu.filter((m) => backIds.includes(m.id) && m.available && Number.isFinite(m.left) && m.left <= 0).map((m) => ({ id: m.id, name: m.name })) : [];
  const backOnly = backItems.length && !anyQty && !String(values.note || '').trim();
  // Something sold out between opening the page and sending it.
  const goneNow = kind === 'order' ? page.op.menu.filter((m) => Number(qty[m.id]) > 0 && Number.isFinite(m.left) && m.left <= 0).map((m) => m.name) : [];
  // More than is left now (someone else ordered since the page opened): say
  // so, rather than quietly sending fewer.
  const tooMany = kind === 'order' && !backOnly ? page.op.menu.filter((m) => Number(qty[m.id]) > 0 && Number.isFinite(m.left) && m.left > 0 && Number(qty[m.id]) > m.left) : [];
  if (tooMany.length) return again(`Only ${tooMany.map((m) => `${m.left} ${m.name}`).join(' and ')} left now. Change the amount and send it again.`);
  if (goneNow.length && !backOnly) return again(`Sorry, ${goneNow.join(' and ')} just sold out. ${page.op.notifyBack ? "Tick \"Email me when it's back\" to hear when there's more, or pick something else." : 'Pick something else, or check back soon.'}`);
  const cleaned = cleanRequest({ ...values, kind, qty, ...(backOnly ? { note: 'back' } : {}) }, page.op.menu, backOnly ? [] : payOptions(page.op).map((m) => m.id), { pickupDays: backOnly ? [] : page.op.pickupDays, today: new Date(Date.now() - 36 * 3600000).toISOString().slice(0, 10), delivery: page.op.delivery, standing: page.op.standing });
  if (cleaned.error) return again(cleaned.error);

  try {
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const mine = await rest(`order_requests?select=id&homestead_id=eq.${page.id}&ip_hash=eq.${hash}&created_at=gte.${encodeURIComponent(hourAgo)}&limit=${PER_VISITOR_HOUR + 1}`) || [];
    if (mine.length >= PER_VISITOR_HOUR) return again("You've sent a few requests already. Please wait a bit, or reach out to the farm directly.", 429);
    const all = await rest(`order_requests?select=id&homestead_id=eq.${page.id}&created_at=gte.${encodeURIComponent(dayAgo)}&limit=${PER_HOMESTEAD_DAY + 1}`) || [];
    if (all.length >= PER_HOMESTEAD_DAY) return again('This farm has a lot of requests today. Please try again tomorrow, or reach out to them directly.', 429);

    const who = { customer_name: cleaned.row.customer_name, email: cleaned.row.email, phone: cleaned.row.text_ok ? cleaned.row.phone : '', homestead_id: page.id, ip_hash: hash, ...(cleaned.row.text_ok ? { text_ok: true } : {}) };
    // Already asked to join and waiting for the farm: don't add them twice.
    const wantsJoin = kind === 'join' || (kind === 'order' && values.alsoJoin && page.op.joinList);
    const onList = wantsJoin && who.email ? ((await rest(`order_requests?select=id&homestead_id=eq.${page.id}&kind=eq.join&status=eq.new&email=eq.${encodeURIComponent(who.email)}&limit=1`).catch(() => null)) || []).length > 0 : false;
    if (kind === 'join' && onList) return send(200, thanksHtml(page, token, { ...who, kind: 'join' }));
    const rows = [];
    let main = null;
    if (!backOnly) {
      const accepted = kind === 'order' && page.op.autoAccept && coveredNow(page, cleaned.row);
      main = { ...cleaned.row, homestead_id: page.id, ip_hash: hash, ...(kind === 'order' ? { status_token: onceKey || crypto.randomBytes(16).toString('hex') } : {}), ...(accepted ? { status: 'accepted' } : {}) };
      rows.push(main);
    }
    if (backItems.length) rows.push({ ...who, kind: 'notify', items: backItems, note: '', pickup_date: null });
    const joined = kind === 'order' && values.alsoJoin && page.op.joinList;
    if (joined && !onList) rows.push({ ...who, kind: 'join', items: [], note: '', pickup_date: null });
    const saved = await saveRows(rows);
    const savedMain = main ? saved.find((r) => r.kind === main.kind) || main : null;
    const savedBack = saved.some((r) => r.kind === 'notify') ? backItems : [];
    if (main) {
      await notifyOwner(page, savedMain, savedMain.status === 'accepted' ? `New order from ${savedMain.customer_name} (accepted, you have enough)` : undefined);
      await confirmCustomer(page, token, savedMain);
    }
    else if (savedBack.length) await notifyOwner(page, { ...who, kind: 'notify', items: savedBack, note: '' });
    if (!main) return send(200, thanksHtml(page, token, { ...who, kind: 'notify' }, { backItems: savedBack }));
    return send(200, thanksHtml(page, token, savedMain, { joined, backItems: savedBack, accepted: savedMain.status === 'accepted' }));
  } catch (e) {
    // The same form sent twice at once: the second one hits the unique key.
    if (onceKey && /23505|duplicate key/.test(String(e && e.message))) return already();
    console.error('[order-page] save', e);
    return again("Your request didn't go through. Please try again in a minute.", 502);
  }
}
