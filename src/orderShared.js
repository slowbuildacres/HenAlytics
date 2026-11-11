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
//     menu: [{ id, name, unit, price, note, available }],
//     joinList, joinGroupId,           // "Get our what's fresh emails"
//     emailMe,                         // email the owner on each request
//   }
// Requests customers send live in public.order_requests (see
// supabase/migrations/20261111_order_requests.sql).
// No money changes hands: it's a request, the owner accepts or declines.
// ============================================================================

export const ORDER_LIMITS = {
  name: 60, email: 254, phone: 30, note: 600, pickup: 40, items: 25, qty: 999,
  menu: 40, menuName: 60, menuNote: 120, unit: 20, intro: 400, pickupText: 200, message: 600,
};
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
    }))
    .filter((m) => m.id && m.name && !seen.has(m.id) && seen.add(m.id))
    .slice(0, L.menu);
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
  };
}

// A customer's request from the form → a clean row, or { error }.
// fields: { kind, name, email, phone, note, pickupDate, qty: { [menuId]: n } }
export function cleanRequest(fields, menu) {
  const L = ORDER_LIMITS;
  const kind = fields.kind === 'join' ? 'join' : 'order';
  const name = clip(fields.name, L.name);
  const email = clip(fields.email, L.email).toLowerCase();
  const phone = clip(fields.phone, L.phone).replace(/[^0-9+()\-. x]/gi, '');
  const note = clip(fields.note, L.note);
  const pickup = /^\d{4}-\d{2}-\d{2}$/.test(String(fields.pickupDate || '')) ? String(fields.pickupDate) : '';
  if (!name) return { error: 'Please add your name.' };
  if (!EMAIL_RE.test(email)) return { error: 'Please add an email address that works, so they can reply.' };
  if (kind === 'join') return { row: { kind, customer_name: name, email, phone: '', items: [], note: '', pickup_date: null } };
  const byId = new Map(menu.filter((m) => m.available).map((m) => [m.id, m]));
  const items = [];
  const qty = fields.qty && typeof fields.qty === 'object' ? fields.qty : {};
  Object.keys(qty).slice(0, 100).forEach((id) => {
    const m = byId.get(id);
    const n = Math.floor(Number(qty[id]));
    if (m && n > 0) items.push({ id: m.id, name: m.name, unit: m.unit, price: m.price, qty: Math.min(L.qty, n) });
  });
  if (!items.length && !note) return { error: 'Pick at least one item, or tell them what you want in the note.' };
  return { row: { kind, customer_name: name, email, phone, items: items.slice(0, L.items), note, pickup_date: pickup || null } };
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
export function buildCustomerEmail({ status, farmName, items, note, pickupDate, message, pickupText }) {
  const farm = clip(farmName, 60) || 'the farm stand';
  const heads = {
    accepted: { subject: `${farm} got your order`, lead: `Good news! ${farm} has your order and will get it ready.` },
    ready: { subject: `Your order from ${farm} is ready`, lead: `Your order from ${farm} is ready to pick up.` },
    declined: { subject: `About your order from ${farm}`, lead: `${farm} can't fill this order right now.` },
  };
  const h = heads[status] || heads.accepted;
  const msg = clip(message, ORDER_LIMITS.message);
  const when = prettyDate(pickupDate);
  const html = wrap(`
<h1 style="font-family:Georgia,serif;font-weight:400;font-size:24px;margin:0 0 10px">${esc(h.subject)}</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 10px">${esc(h.lead)}</p>
${msg ? `<p style="font-size:15px;line-height:1.5;margin:0 0 10px;padding:12px 14px;background:#EBE0CC;border-radius:10px">${esc(msg).replace(/\n/g, '<br>')}</p>` : ''}
${itemsHtml(items)}
${note ? `<p style="font-size:14px;color:#5C4530;margin:6px 0">Your note: ${esc(note)}</p>` : ''}
${when && status !== 'declined' ? `<p style="font-size:14px;color:#5C4530;margin:6px 0">Pickup you asked for: ${esc(when)}</p>` : ''}
${pickupText && status !== 'declined' ? `<p style="font-size:14px;color:#5C4530;margin:6px 0">${esc(pickupText)}</p>` : ''}
<p style="font-size:13px;color:#5C4530;margin:14px 0 0">Questions? Just reply to this email. No payment was taken; settle up with ${esc(farm)} directly.</p>`);
  const text = [h.lead, msg, itemsText(items), note ? `Your note: ${note}` : '', when && status !== 'declined' ? `Pickup you asked for: ${when}` : '', pickupText && status !== 'declined' ? pickupText : '', `Questions? Just reply to this email. No payment was taken; settle up with ${farm} directly.`].filter(Boolean).join('\n\n');
  return { subject: h.subject, html, text };
}

// Email to the owner when a request comes in.
export function buildOwnerEmail({ kind, farmName, name, email, phone, items, note, pickupDate, appUrl }) {
  const who = clip(name, 60) || 'Someone';
  const subject = kind === 'join' ? `${who} wants to join your email list` : `New order request from ${who}`;
  const when = prettyDate(pickupDate);
  const html = wrap(`
<h1 style="font-family:Georgia,serif;font-weight:400;font-size:22px;margin:0 0 10px">${esc(subject)}</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 6px">${esc(who)} · <a href="mailto:${esc(email)}" style="color:#2C1810">${esc(email)}</a>${phone ? ` · ${esc(phone)}` : ''}</p>
${itemsHtml(items)}
${note ? `<p style="font-size:15px;line-height:1.5;margin:6px 0;padding:12px 14px;background:#EBE0CC;border-radius:10px">${esc(note).replace(/\n/g, '<br>')}</p>` : ''}
${when ? `<p style="font-size:14px;color:#5C4530;margin:6px 0">Would like it by ${esc(when)}</p>` : ''}
<p style="margin:16px 0 0"><a href="${esc(appUrl)}" style="display:inline-block;background:#2C1810;color:#F4EDE0;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:600">Open Orders in Henalytics</a></p>
<p style="font-size:12px;color:#5C4530;margin:14px 0 0">You get these because "Email me new requests" is on for ${esc(clip(farmName, 60) || 'your homestead')}'s order page. Turn it off in Henalytics under Orders.</p>`);
  const text = [subject, `${who} · ${email}${phone ? ` · ${phone}` : ''}`, itemsText(items), note, when ? `Would like it by ${when}` : '', `Open Orders in Henalytics: ${appUrl}`].filter(Boolean).join('\n\n');
  return { subject, html, text };
}
