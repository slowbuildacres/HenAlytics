// ============================================================================
// "HERE'S WHAT'S FRESH" EMAIL — shared template
// ----------------------------------------------------------------------------
// Used by the in-app preview (StockEmails.jsx) and by the server that sends
// it (api/stock-email.js), so the preview is exactly what customers get.
// Pure string building, no browser or Node APIs. Every user-supplied value
// is escaped; the server re-validates photos and limits before sending.
//
// draft = { subject, note, items: [{ name, qty, unit, price }], photos: [url] }
// settings = { fromName, mailingAddress }
// ============================================================================

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

export const STOCK_EMAIL_LIMITS = { items: 20, photos: 3, note: 1000, subject: 120, name: 60, qty: 30, price: 30 };

export function cleanDraft(draft = {}) {
  const L = STOCK_EMAIL_LIMITS;
  const items = (Array.isArray(draft.items) ? draft.items : [])
    .map((i) => ({ name: clip(i && i.name, L.name), qty: clip(i && i.qty, L.qty), unit: clip(i && i.unit, 20), price: clip(i && i.price, L.price) }))
    .filter((i) => i.name)
    .slice(0, L.items);
  const photos = (Array.isArray(draft.photos) ? draft.photos : [])
    .filter((u) => typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(u))
    .slice(0, L.photos);
  return { subject: clip(draft.subject, L.subject), note: clip(draft.note, L.note), items, photos };
}

const SAME_PLURAL = /^(dozen|each|ea|lb|lbs|oz|kg|g|ml|l|qt|pt|gal|bulk|half dozen|half-dozen)$/i;
export function pluralUnit(unit, qty) {
  const u = String(unit || '').trim();
  const n = Number(String(qty).replace(/[^0-9.]/g, ''));
  if (!u || n === 1 || SAME_PLURAL.test(u) || /s$/i.test(u)) return u;
  if (/(x|ch|sh)$/i.test(u)) return `${u}es`;
  if (/[^aeiou]y$/i.test(u)) return `${u.slice(0, -1)}ies`;
  if (/f$/i.test(u) && !/ff$/i.test(u)) return `${u.slice(0, -1)}ves`; // loaf → loaves
  return `${u}s`;
}

export function stockFromName(settings = {}) {
  return clip(settings.fromName, 60).replace(/[<>"\r\n]/g, '') || 'Our farm stand';
}

export function defaultSubject(fromName, items = []) {
  const names = items.map((i) => i.name).filter(Boolean);
  const list = names.length > 3 ? `${names.slice(0, 3).join(', ')} & more` : names.join(', ');
  return list ? `Fresh at ${fromName}: ${list}` : `What's fresh at ${fromName}`;
}

// Returns { subject, html, text }.
// opts.unsubscribeUrl — per-recipient link (preview/test use a placeholder).
// opts.isTest — adds a "this is a test" ribbon.
export function buildStockEmail(draftIn, settings = {}, opts = {}) {
  const d = cleanDraft(draftIn);
  const name = stockFromName(settings);
  const subject = d.subject || defaultSubject(name, d.items);
  const address = clip(settings.mailingAddress, 200);
  const unsub = opts.unsubscribeUrl || '#';
  const qtyText = (i) => {
    if (!i.qty) return '';
    if (!i.unit || /[a-z]/i.test(i.qty)) return i.qty; // "6 dozen", "plenty" — as typed
    return `${i.qty} ${pluralUnit(i.unit, i.qty)}`;
  };

  // Two columns (item + amount on the left, price on the right) so it fits
  // a narrow phone screen.
  const rows = d.items.map((i) => `
        <tr>
          <td style="padding:12px 12px 12px 14px;border-bottom:1px solid #E6DAC4;">
            <div style="font-size:16px;color:#2C1810;font-weight:600;line-height:1.3;">${esc(i.name)}</div>
            ${qtyText(i) ? `<div style="font-size:13px;color:#5C4530;margin-top:2px;">${esc(qtyText(i))} available</div>` : ''}
          </td>
          <td style="padding:12px 14px 12px 6px;border-bottom:1px solid #E6DAC4;font-size:15px;color:#5A7A3C;font-weight:700;text-align:right;vertical-align:middle;">${esc(i.price)}</td>
        </tr>`).join('');

  const photos = d.photos.map((u) => `
      <tr><td style="padding:0 0 10px;"><img src="${esc(u)}" alt="" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:12px;border:0;"></td></tr>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#F4EDE0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EDE0;"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    ${opts.isTest ? `<tr><td style="padding:8px 14px;background:#E8B547;color:#2C1810;font-size:13px;font-weight:700;border-radius:10px;text-align:center;">Test email: this is how your customers will see it.</td></tr><tr><td style="height:12px;"></td></tr>` : ''}
    <tr><td style="background:#2C1810;border-radius:16px 16px 0 0;padding:26px 24px 22px;text-align:center;">
      <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#CDBBA5;">${esc(name)}</div>
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:#F4EDE0;margin-top:8px;">Here's what's fresh at ${esc(name)}</div>
    </td></tr>
    <tr><td style="background:#FAF5EA;border-radius:0 0 16px 16px;padding:20px 20px 24px;border:1.5px solid #E6DAC4;border-top:0;">
      ${d.note ? `<div style="font-size:16px;line-height:1.55;color:#2C1810;margin:0 0 18px;white-space:pre-line;">${esc(d.note)}</div>` : ''}
      ${photos ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${photos}</table>` : ''}
      ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E6DAC4;border-radius:12px;border-collapse:separate;overflow:hidden;background:#FFFDF8;margin-top:4px;">${rows}</table>` : ''}
      <div style="font-size:15px;line-height:1.5;color:#2C1810;margin-top:18px;text-align:center;">
        <strong>Want some?</strong> Just reply to this email.
      </div>
    </td></tr>
    <tr><td style="padding:18px 10px 0;text-align:center;font-size:12px;line-height:1.6;color:#8B6F47;">
      Sent by ${esc(name)} with Henalytics, the free homestead app.${address ? `<br>${esc(address)}` : ''}<br>
      <a href="${esc(unsub)}" style="color:#8B6F47;">Unsubscribe from ${esc(name)}'s emails</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const text = [
    opts.isTest ? 'TEST EMAIL: this is how your customers will see it.\n' : '',
    `Here's what's fresh at ${name}`,
    '',
    d.note || null,
    d.note ? '' : null,
    ...d.items.map((i) => `• ${i.name}${qtyText(i) ? ` (${qtyText(i)})` : ''}${i.price ? `: ${i.price}` : ''}`),
    '',
    'Want some? Just reply to this email.',
    '',
    `Sent by ${name} with Henalytics.${address ? ` ${address}` : ''}`,
    `Unsubscribe: ${unsub}`,
  ].filter((x) => x != null).join('\n');

  return { subject, html, text };
}
