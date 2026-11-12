// ============================================================================
// Customer orders — shared rules and email text
// ----------------------------------------------------------------------------
// Used by the public order page (api/order-page.js), the owner's actions
// (api/orders.js) and the app (src/Orders.jsx), so limits and wording match.
// Pure string building, no browser or Node APIs. Every customer value is
// cleaned here and escaped on output.
//
// The homestead's order page settings live in its own data:
//   data.orderPage = {
//     on, token,                       // token = 40 hex chars, the link
//     intro, pickup,                   // short text shown on the page
//     menu: [{ id, name, unit, price, note, available,
//              cost, credit, standItemId,       // owner only, src/orderSales.js
//              supply, preorder, showAhead }],  // owner only, src/orderSupply.js
//     snaps: { [source]: { onHand, perDay, asOf } },  // measured by the app
//     joinList, joinGroupId,           // "Get our what's fresh emails"
//     emailMe,                         // email the owner on each request
//     pay: { cash, card, check,        // true/false
//            venmo, cashapp, paypal, zelle },  // the farm's handle, or ''
//     payWhen,                         // 'order' (right away) | 'accepted'
//     pickupDays: [0..6],              // weekdays for pickup (Sun=0); [] = any
//     paused, pausedNote,              // stop taking orders for a while
//     delivery: { on, fee, note },     // offer delivery (porch drop-off...)
//     standing,                        // customers can ask for every 1-4 weeks
//     autoAccept,                      // accept on its own when there's enough
//     notifyBack,                      // "Email me when it's back" on sold out
//   }
// Menu items can also have maxEach: the most one order can ask for.
// Customers pay the farm directly (Venmo, Cash App, cash...). Henalytics
// only shows the farm's handle and a prefilled link; it never sees money.
// Requests customers send live in public.order_requests (see
// supabase/migrations/20261111_order_requests.sql).
// No money changes hands: it's a request, the owner accepts or declines.
// ============================================================================

import { cleanPublicSupply, HORIZON } from './orderSupply.js';

export const ORDER_LIMITS = {
  name: 60, email: 254, phone: 30, note: 600, pickup: 40, items: 25, qty: 999,
  menu: 40, menuName: 60, menuNote: 120, unit: 20, intro: 400, pickupText: 200, message: 600, pausedNote: 200,
  address: 200, deliveryNote: 200,
};
export const REPEAT_WEEKS = [1, 2, 3, 4];
export const repeatLabel = (w) => (w === 1 ? 'Every week' : w ? `Every ${w} weeks` : '');
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const ORDER_TOKEN_RE = /^[a-f0-9]{40}$/;
export const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
export const ORDER_STATUSES = ['new', 'accepted', 'ready', 'done', 'declined'];
export const JOIN_STATUSES = ['new', 'added', 'ignored'];

const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// The owner's menu, cleaned (the server never trusts the saved blob blindly).
export function cleanMenu(menu) {
  const L = ORDER_LIMITS;
  const seen = new Set();
  return (Array.isArray(menu) ? menu : [])
    .filter((m) => m && typeof m === 'object')
    .map((m) => ({
      id: clip(m.id, 24).replace(/[^a-zA-Z0-9_-]/g, ''),
      name: clip(m.name, L.menuName),
      unit: clip(m.unit, L.unit),
      price: Number.isFinite(Number(m.price)) && Number(m.price) > 0 ? Math.round(Number(m.price) * 100) / 100 : null,
      note: clip(m.note, L.menuNote),
      available: m.available !== false,
      ...(Number(m.maxEach) >= 1 ? { maxEach: Math.min(L.qty, Math.floor(Number(m.maxEach))) } : {}),
      ...(Number.isFinite(m.left) ? { left: Math.max(0, Math.floor(m.left)) } : {}),
      // Pre-orders: what the page needs to work out dates (api/order-page.js
      // adds it; it's never saved).
      ...(m.sup && typeof m.sup === 'object' ? { sup: cleanPublicSupply(m.sup) } : {}),
    }))
    .filter((m) => m.id && m.name && !seen.has(m.id) && seen.add(m.id))
    .slice(0, L.menu);
}

// ---------------------------------------------------------------- paying
export const PAY_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'venmo', label: 'Venmo', handle: true },
  { id: 'cashapp', label: 'Cash App', handle: true },
  { id: 'paypal', label: 'PayPal', handle: true },
  { id: 'zelle', label: 'Zelle', handle: true },
  { id: 'card', label: 'Card at pickup' },
  { id: 'check', label: 'Check' },
];
export const PAY_IDS = PAY_METHODS.map((m) => m.id);
export const payLabel = (id) => (PAY_METHODS.find((m) => m.id === id) || { label: '' }).label;

// Handles as people type them ("@Fro-Farms", "$frofarms", "paypal.me/fro")
// → the bare handle, or '' if it can't be one.
export function cleanHandle(id, v) {
  const s = String(v == null ? '' : v).trim();
  if (id === 'venmo') { const h = s.replace(/^(https?:\/\/)?(www\.)?(account\.)?venmo\.com\/(u\/)?/i, '').replace(/^@/, ''); return /^[A-Za-z0-9_-]{1,30}$/.test(h) ? h : ''; }
  if (id === 'cashapp') { const h = s.replace(/^(https?:\/\/)?(www\.)?cash\.app\//i, '').replace(/^\$/, ''); return /^[A-Za-z0-9_]{1,20}$/.test(h) && /[A-Za-z]/.test(h) ? h : ''; }
  if (id === 'paypal') { const h = s.replace(/^(https?:\/\/)?(www\.)?paypal\.me\//i, '').replace(/\/.*$/, ''); return /^[A-Za-z0-9]{1,20}$/.test(h) ? h : ''; }
  if (id === 'zelle') return clip(s, 80).replace(/[<>"]/g, '');
  return '';
}
export function cleanPay(p) {
  const o = p && typeof p === 'object' ? p : {};
  return {
    cash: o.cash === true, card: o.card === true, check: o.check === true,
    venmo: cleanHandle('venmo', o.venmo), cashapp: cleanHandle('cashapp', o.cashapp),
    paypal: cleanHandle('paypal', o.paypal), zelle: cleanHandle('zelle', o.zelle),
  };
}
// The ways this farm takes payment, in display order.
export function payOptions(op) {
  const pay = cleanPay(op && op.pay);
  return PAY_METHODS.filter((m) => (m.handle ? !!pay[m.id] : pay[m.id] === true)).map((m) => ({ ...m, handleValue: m.handle ? pay[m.id] : '' }));
}
const amt = (n) => (Number(n) > 0 ? Number(n).toFixed(2) : '');
// A link that opens the app with the farm filled in (and the amount where
// the app allows it). Zelle lives inside each bank's app, so it has none.
export function payLink(id, handle, amount, note) {
  const h = cleanHandle(id, handle);
  if (!h) return '';
  const a = amt(amount);
  if (id === 'venmo') return `https://venmo.com/${encodeURIComponent(h)}?txn=pay${a ? `&amount=${a}` : ''}${note ? `&note=${encodeURIComponent(String(note).slice(0, 60))}` : ''}`;
  if (id === 'cashapp') return `https://cash.app/$${encodeURIComponent(h)}${a ? `/${a}` : ''}`;
  if (id === 'paypal') return `https://paypal.me/${encodeURIComponent(h)}${a ? `/${a}USD` : ''}`;
  return '';
}
// What to tell the customer about paying: { line, link, button }.
export function payInstructions({ method, op, amount, farm }) {
  const opt = payOptions(op).find((m) => m.id === method);
  if (!opt) return null;
  const money = Number(amount) > 0 ? moneyText(amount) : '';
  const f = clip(farm, 60) || 'the farm';
  const note = `${f} order`;
  const link = payLink(opt.id, opt.handleValue, amount, note);
  const what = money || 'your total';
  if (opt.id === 'venmo') return { line: `Pay ${what} on Venmo to @${opt.handleValue}.`, link, button: `Pay${money ? ` ${money}` : ''} on Venmo` };
  if (opt.id === 'cashapp') return { line: `Pay ${what} on Cash App to $${opt.handleValue}.`, link, button: `Pay${money ? ` ${money}` : ''} on Cash App` };
  if (opt.id === 'paypal') return { line: `Pay ${what} on PayPal to paypal.me/${opt.handleValue}.`, link, button: `Pay${money ? ` ${money}` : ''} on PayPal` };
  if (opt.id === 'zelle') return { line: `Send ${what} with Zelle to ${opt.handleValue} from your bank's app.`, link: '', button: '' };
  if (opt.id === 'cash') return { line: `Bring ${money ? `${money} in cash` : 'cash'} when you pick up.`, link: '', button: '' };
  if (opt.id === 'check') return { line: `Bring a check${money ? ` for ${money}` : ''} when you pick up.`, link: '', button: '' };
  if (opt.id === 'card') return { line: `Pay by card when you pick up.`, link: '', button: '' };
  return null;
}

export function cleanPageSettings(op = {}) {
  const L = ORDER_LIMITS;
  return {
    on: op.on === true,
    token: ORDER_TOKEN_RE.test(String(op.token || '')) ? String(op.token) : '',
    intro: clip(op.intro, L.intro),
    pickup: clip(op.pickup, L.pickupText),
    menu: cleanMenu(op.menu),
    joinList: op.joinList !== false,
    joinGroupId: clip(op.joinGroupId, 40),
    emailMe: op.emailMe !== false,
    pay: cleanPay(op.pay),
    payWhen: op.payWhen === 'accepted' ? 'accepted' : 'order',
    pickupDays: cleanDays(op.pickupDays),
    paused: op.paused === true,
    pausedNote: clip(op.pausedNote, L.pausedNote),
    delivery: cleanDelivery(op.delivery),
    standing: op.standing === true,
    autoAccept: op.autoAccept === true,
    notifyBack: op.notifyBack === true,  // opt-in: you send the note from Orders
  };
}
export function cleanDelivery(d) {
  const o = d && typeof d === 'object' ? d : {};
  const fee = Number(o.fee);
  return { on: o.on === true, fee: Number.isFinite(fee) && fee > 0 ? Math.min(999, Math.round(fee * 100) / 100) : null, note: clip(o.note, ORDER_LIMITS.deliveryNote) };
}
export function cleanDays(days) {
  return [...new Set((Array.isArray(days) ? days : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
}
// Weekday of a YYYY-MM-DD date (0 = Sunday), or -1.
export function weekdayOf(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return -1;
  const [y, m, d] = String(s).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 ? t.getUTCDay() : -1;
}
// The next pickup dates on the chosen weekdays, from `from` (YYYY-MM-DD),
// as far ahead as the page plans (so "5 dozen for Easter" can be asked early).
export function pickupDates(days, from, count = 60, span = HORIZON) {
  const ok = cleanDays(days);
  if (!ok.length || weekdayOf(from) < 0) return [];
  const [y, m, d] = from.split('-').map(Number);
  const out = [];
  for (let i = 0; i <= span && out.length < count; i++) {
    const t = new Date(Date.UTC(y, m - 1, d + i));
    if (ok.includes(t.getUTCDay())) out.push(t.toISOString().slice(0, 10));
  }
  return out;
}

const yearAfter = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y + 1, m - 1, d)).toISOString().slice(0, 10); };

// A customer's request from the form → a clean row, or { error }.
// fields: { kind, name, email, phone, textOk, note, pickupDate, payMethod, qty: { [menuId]: n } }
// payIds: the pay methods the farm offers; when there are any, one is required.
// rules: { pickupDays, today } — when pickup days are set, the date must be
// one of them (and not in the past).
export function cleanRequest(fields, menu, payIds = [], rules = {}) {
  const L = ORDER_LIMITS;
  const kind = fields.kind === 'join' ? 'join' : 'order';
  const name = clip(fields.name, L.name);
  const email = clip(fields.email, L.email).toLowerCase();
  const phone = clip(fields.phone, L.phone).replace(/[^0-9+()\-. x]/gi, '');
  const note = clip(fields.note, L.note);
  const pickup = /^\d{4}-\d{2}-\d{2}$/.test(String(fields.pickupDate || '')) ? String(fields.pickupDate) : '';
  if (!name) return { error: 'Please add your name.' };
  if (!EMAIL_RE.test(email)) return { error: 'Please add an email address that works, so they can reply.' };
  // "OK to text" only counts with a phone number; without one it's ignored
  // (the phone stays optional).
  const textOk = !!(fields.textOk === true || fields.textOk === '1') && phone.replace(/[^0-9]/g, '').length >= 7;
  if (kind === 'join') {
    const row = { kind, customer_name: name, email, phone: textOk ? phone : '', items: [], note: '', pickup_date: null };
    if (textOk) row.text_ok = true;
    return { row };
  }
  const days = cleanDays(rules.pickupDays);
  if (days.length) {
    if (!pickup) return { error: 'Please pick a pickup day.' };
    if (!days.includes(weekdayOf(pickup)) || (rules.today && pickup < rules.today)) return { error: 'Please pick one of the pickup days.' };
  }
  if (pickup && rules.today && pickup > yearAfter(rules.today)) return { error: 'Please pick a day within the next year.' };
  const delivery = rules.delivery && rules.delivery.on && fields.fulfil === 'delivery';
  const address = delivery ? clip(fields.address, L.address) : '';
  if (delivery && address.length < 5) return { error: 'Please add the address to deliver to.' };
  const repeat = rules.standing && REPEAT_WEEKS.includes(Number(fields.repeat)) ? Number(fields.repeat) : 0;
  if (repeat && !pickup) return { error: 'Please pick the first day for your standing order.' };
  const byId = new Map(menu.filter((m) => m.available && !(Number.isFinite(m.left) && m.left <= 0)).map((m) => [m.id, m]));
  const items = [];
  const qty = fields.qty && typeof fields.qty === 'object' ? fields.qty : {};
  Object.keys(qty).slice(0, 100).forEach((id) => {
    const m = byId.get(id);
    const n = Math.floor(Number(qty[id]));
    if (m && n > 0) items.push({ id: m.id, name: m.name, unit: m.unit, price: m.price, qty: Math.min(L.qty, Number.isFinite(m.left) ? m.left : L.qty, m.maxEach || L.qty, n) });
  });
  // Delivery is a line on the order, so totals and Sales include the fee.
  if (delivery && items.length && rules.delivery.fee) items.push({ id: 'delivery', name: 'Delivery', unit: '', price: rules.delivery.fee, qty: 1 });
  if (!items.length && !note) return { error: 'Pick at least one item, or tell them what you want in the note.' };
  const pay = String(fields.payMethod || '');
  if (payIds.length && !payIds.includes(pay)) return { error: "Please pick how you'll pay." };
  const row = { kind, customer_name: name, email, phone, items: items.slice(0, L.items), note, pickup_date: pickup || null };
  if (payIds.length) row.pay_method = pay;
  if (textOk) row.text_ok = true;
  if (delivery) { row.fulfil = 'delivery'; row.address = address; }
  if (repeat) row.repeat_weeks = repeat;
  return { row };
}

export function moneyText(n) {
  if (!Number.isFinite(Number(n))) return '';
  return `$${Number(n).toFixed(2).replace(/\.00$/, '')}`;
}
export function itemLine(i) {
  const unit = i.unit ? ` ${i.unit}` : '';
  return `${i.qty}${unit} ${i.name}`.replace(/\s+/g, ' ');
}
export function orderTotal(items) {
  const priced = (items || []).filter((i) => Number(i.price) > 0);
  if (!priced.length) return null;
  return priced.reduce((t, i) => t + Number(i.price) * Number(i.qty || 0), 0);
}
const prettyDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return '';
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
};
export { prettyDate as orderPrettyDate };

const wrap = (inner) => `<!doctype html><html><body style="margin:0;background:#F4EDE0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#2C1810">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#FAF5EA;border:1px solid #2C181022;border-radius:16px;padding:22px">${inner}</div>
<p style="font-size:12px;color:#5C4530;text-align:center;margin:14px 0 0">Sent with <a href="https://henalytics.com" style="color:#5C4530">Henalytics</a></p>
</div></body></html>`;

function itemsHtml(items) {
  if (!items || !items.length) return '';
  const rows = items.map((i) => `<tr><td style="padding:6px 0;font-size:15px">${esc(itemLine(i))}</td><td style="padding:6px 0;font-size:15px;text-align:right;color:#5C4530">${Number(i.price) > 0 ? esc(moneyText(Number(i.price) * Number(i.qty))) : ''}</td></tr>`).join('');
  const total = orderTotal(items);
  return `<table style="width:100%;border-collapse:collapse;margin:10px 0">${rows}${total != null ? `<tr><td style="padding:8px 0;border-top:1px solid #2C181022;font-weight:600">About</td><td style="padding:8px 0;border-top:1px solid #2C181022;text-align:right;font-weight:600">${esc(moneyText(total))}</td></tr>` : ''}</table>`;
}
const itemsText = (items) => (items || []).map((i) => `- ${itemLine(i)}`).join('\n');

// Email to the customer when the owner updates their order.
// status: accepted | ready | declined
// pay: { method, op, paid } adds how to pay (accepted/ready), or a refund
// note when a digital payment may already have been sent (declined).
export function buildCustomerEmail({ status, farmName, items, note, pickupDate, message, pickupText, pay, orderUrl, statusUrl, repeatWeeks, address }) {
  const farm = clip(farmName, 60) || 'the farm stand';
  const heads = {
    accepted: { subject: `${farm} got your order`, lead: `Good news! ${farm} has your order and will get it ready.` },
    ready: { subject: `Your order from ${farm} is ready`, lead: `Your order from ${farm} is ready to pick up.` },
    declined: { subject: `About your order from ${farm}`, lead: `${farm} can't fill this order right now.` },
    // Right after they send it (the order page), before the farm has looked.
    received: { subject: `${farm} got your request`, lead: `Thanks! ${farm} has your request and will let you know when they've looked at it.` },
  };
  if (address) heads.ready = { subject: `Your order from ${farm} is ready`, lead: `Your order from ${farm} is ready for delivery.` };
  const h = heads[status] || heads.accepted;
  const msg = clip(message, ORDER_LIMITS.message);
  const when = prettyDate(pickupDate);
  const payNow = status !== 'declined' && !(status === 'received' && pay && pay.op && pay.op.payWhen === 'accepted');
  const p = pay && pay.method && !pay.paid && payNow ? payInstructions({ method: pay.method, op: pay.op, amount: orderTotal(items), farm }) : null;
  const refund = pay && status === 'declined' && ['venmo', 'cashapp', 'paypal', 'zelle'].includes(pay.method) && (pay.paid || (pay.op && pay.op.payWhen !== 'accepted'))
    ? `If you already paid, ${farm} will send it back.` : '';
  const payHtml = p ? `<div style="margin:12px 0;padding:12px 14px;border:1px solid #2C181022;border-radius:12px"><p style="font-size:15px;margin:0 0 ${p.link ? 10 : 0}px"><b>Paying:</b> ${esc(p.line)}${pay.op && pay.op.payWhen === 'order' ? ' (If you already paid, you\'re all set.)' : ''}</p>${p.link ? `<a href="${esc(p.link)}" style="display:inline-block;background:#E8B547;color:#2C1810;text-decoration:none;padding:11px 16px;border-radius:12px;font-weight:700">${esc(p.button)}</a>` : ''}<p style="font-size:12px;color:#5C4530;margin:10px 0 0">Check the name before you send. Payments go straight to ${esc(farm)}; Henalytics doesn't process, hold or refund payments.</p></div>` : '';
  const html = wrap(`
<h1 style="font-family:Georgia,serif;font-weight:400;font-size:24px;margin:0 0 10px">${esc(h.subject)}</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 10px">${esc(h.lead)}</p>
${msg ? `<p style="font-size:15px;line-height:1.5;margin:0 0 10px;padding:12px 14px;background:#EBE0CC;border-radius:10px">${esc(msg).replace(/\n/g, '<br>')}</p>` : ''}
${itemsHtml(items)}
${note ? `<p style="font-size:14px;color:#5C4530;margin:6px 0">Your note: ${esc(note)}</p>` : ''}
${when && status !== 'declined' ? `<p style="font-size:14px;color:#5C4530;margin:6px 0">${address ? 'Delivery' : 'Pickup'} you asked for: ${esc(when)}${repeatWeeks ? ` (${esc(repeatLabel(repeatWeeks).toLowerCase())})` : ''}</p>` : ''}
${address && status !== 'declined' ? `<p style="font-size:14px;color:#5C4530;margin:6px 0">Delivering to ${esc(address)}</p>` : ''}
${pickupText && status !== 'declined' && !address ? `<p style="font-size:14px;color:#5C4530;margin:6px 0">${esc(pickupText)}</p>` : ''}
${payHtml}
${statusUrl ? `<p style="font-size:14px;margin:10px 0 0"><a href="${esc(statusUrl)}" style="color:#2C1810">Check on your order</a></p>` : ''}${refund ? `<p style="font-size:14px;margin:6px 0">${esc(refund)}</p>` : ''}
<p style="font-size:13px;color:#5C4530;margin:14px 0 0">Questions? Just reply to this email.${p || refund ? '' : ` No payment was taken; settle up with ${esc(farm)} directly.`}</p>
${orderUrl ? `<p style="font-size:13px;margin:8px 0 0"><a href="${esc(orderUrl)}" style="color:#2C1810">${status === 'declined' ? 'See what else they have' : 'Order again'} from ${esc(farm)}</a></p>` : ''}`);
  const text = [h.lead, msg, itemsText(items), note ? `Your note: ${note}` : '', when && status !== 'declined' ? `${address ? 'Delivery' : 'Pickup'} you asked for: ${when}${repeatWeeks ? ` (${repeatLabel(repeatWeeks).toLowerCase()})` : ''}` : '', address && status !== 'declined' ? `Delivering to ${address}` : '', pickupText && status !== 'declined' && !address ? pickupText : '', statusUrl ? `Check on your order: ${statusUrl}` : '', p ? `Paying: ${p.line}${p.link ? ` ${p.link}` : ''}\nCheck the name before you send. Payments go straight to ${farm}; Henalytics doesn't process, hold or refund payments.` : '', refund, `Questions? Just reply to this email.${p || refund ? '' : ` No payment was taken; settle up with ${farm} directly.`}`, orderUrl ? `Order again: ${orderUrl}` : ''].filter(Boolean).join('\n\n');
  return { subject: h.subject, html, text };
}

// Email to the owner when a request comes in.
// estimate: a short line like "Likely ready around Sat, Dec 6" (pre-orders).
export function buildOwnerEmail({ kind, farmName, name, email, phone, items, note, pickupDate, appUrl, payMethod, estimate, repeatWeeks, address }) {
  const who = clip(name, 60) || 'Someone';
  const subject = kind === 'join' ? `${who} wants to join your email list` : kind === 'notify' ? `${who} wants to know when ${(items && items[0] && items[0].name) || 'it'}'s back` : `New ${repeatWeeks ? 'standing order' : 'order request'} from ${who}`;
  const when = prettyDate(pickupDate);
  const html = wrap(`
<h1 style="font-family:Georgia,serif;font-weight:400;font-size:22px;margin:0 0 10px">${esc(subject)}</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 6px">${esc(who)}${email ? ` · <a href="mailto:${esc(email)}" style="color:#2C1810">${esc(email)}</a>` : ''}${phone ? ` · ${esc(phone)}` : ''}</p>
${itemsHtml(items)}
${note ? `<p style="font-size:15px;line-height:1.5;margin:6px 0;padding:12px 14px;background:#EBE0CC;border-radius:10px">${esc(note).replace(/\n/g, '<br>')}</p>` : ''}
${when ? `<p style="font-size:14px;color:#5C4530;margin:6px 0">Would like it by ${esc(when)}${repeatWeeks ? `, then ${esc(repeatLabel(repeatWeeks).toLowerCase())}` : ''}</p>` : ''}
${address ? `<p style="font-size:14px;color:#5C4530;margin:6px 0">Deliver to ${esc(address)}</p>` : ''}
${estimate ? `<p style="font-size:14px;color:#5C4530;margin:6px 0">${esc(estimate)}</p>` : ''}
${payLabel(payMethod) ? `<p style="font-size:14px;color:#5C4530;margin:6px 0">Paying with ${esc(payLabel(payMethod))}</p>` : ''}
<p style="margin:16px 0 0"><a href="${esc(appUrl)}" style="display:inline-block;background:#2C1810;color:#F4EDE0;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:600">Open Orders in Henalytics</a></p>
<p style="font-size:12px;color:#5C4530;margin:14px 0 0">You get these because "Email me new requests" is on for ${esc(clip(farmName, 60) || 'your homestead')}'s order page. Turn it off in Henalytics under Orders.</p>`);
  const text = [subject, [who, email, phone].filter(Boolean).join(' · '), itemsText(items), note, when ? `Would like it by ${when}${repeatWeeks ? `, then ${repeatLabel(repeatWeeks).toLowerCase()}` : ''}` : '', address ? `Deliver to ${address}` : '', estimate || '', payLabel(payMethod) ? `Paying with ${payLabel(payMethod)}` : '', `Open Orders in Henalytics: ${appUrl}`].filter(Boolean).join('\n\n');
  return { subject, html, text };
}

// "It's back" note to people who asked on the order page.
export function buildBackEmail({ farmName, itemName, orderUrl, message }) {
  const farm = clip(farmName, 60) || 'the farm stand';
  const item = clip(itemName, 60) || 'it';
  const subject = `${item} is back at ${farm}`;
  const msg = clip(message, ORDER_LIMITS.message);
  const html = wrap(`
<h1 style="font-family:Georgia,serif;font-weight:400;font-size:24px;margin:0 0 10px">${esc(subject)}</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 10px">You asked ${esc(farm)} to let you know when ${esc(item)} was back. It is!</p>
${msg ? `<p style="font-size:15px;line-height:1.5;margin:0 0 10px;padding:12px 14px;background:#EBE0CC;border-radius:10px">${esc(msg).replace(/\n/g, '<br>')}</p>` : ''}
${orderUrl ? `<p style="margin:14px 0 0"><a href="${esc(orderUrl)}" style="display:inline-block;background:#E8B547;color:#2C1810;text-decoration:none;padding:11px 16px;border-radius:12px;font-weight:700">Order from ${esc(farm)}</a></p>` : ''}
<p style="font-size:13px;color:#5C4530;margin:14px 0 0">You get this one email because you asked. Questions? Just reply.</p>`);
  const text = [`You asked ${farm} to let you know when ${item} was back. It is!`, msg, orderUrl ? `Order: ${orderUrl}` : '', 'You get this one email because you asked. Questions? Just reply.'].filter(Boolean).join('\n\n');
  return { subject, html, text };
}

// ---------------------------------------------------------------- texting
// Texts go out from the owner's own phone: the app opens Messages with the
// number and words filled in. "?&body=" works on both iPhone and Android.
export function smsHref(phone, body) {
  const num = String(phone || '').replace(/[^0-9+]/g, '');
  return `sms:${num}?&body=${encodeURIComponent(String(body || '').slice(0, 900))}`;
}
// One text to several people at once (a group text in Messages). iPhone
// uses sms:/open?addresses=…, Android a comma list. Everyone in it can see
// the other numbers on iPhone, so the app warns before using it.
export function smsGroupHref(phones, body, ios) {
  const nums = (phones || []).map((p) => String(p || '').replace(/[^0-9+]/g, '')).filter((p) => p.length >= 7);
  const text = encodeURIComponent(String(body || '').slice(0, 900));
  return ios ? `sms:/open?addresses=${nums.join(',')}&body=${text}` : `sms:${nums.join(',')}?body=${text}`;
}
export const GROUP_TEXT_MAX = 20;
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'there';
// A short text for an order update. status: accepted | ready | declined | other
export function orderText({ status, name, farm, items, message, pickupText, payLine, delivery }) {
  const f = clip(farm, 60) || 'the farm';
  const what = (items || []).map(itemLine).join(', ');
  const msg = clip(message, ORDER_LIMITS.message);
  const parts = {
    accepted: [`Hi ${firstName(name)}, it's ${f}. We got your order${what ? ` (${what})` : ''} and will get it ready.`, msg, payLine],
    ready: [`Hi ${firstName(name)}, your order from ${f} is ready${delivery ? " and we'll bring it by" : ' to pick up'}!`, msg, delivery ? '' : clip(pickupText, ORDER_LIMITS.pickupText), payLine],
    declined: [`Hi ${firstName(name)}, it's ${f}. Sorry, we can't fill your order right now.`, msg],
  }[status] || [`Hi ${firstName(name)}, it's ${f}.`, msg];
  return parts.filter(Boolean).join(' ');
}
