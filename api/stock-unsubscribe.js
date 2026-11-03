// ============================================================================
// Vercel serverless function: /api/stock-unsubscribe?t=<token>
// ----------------------------------------------------------------------------
// Unsubscribe link in "Here's what's fresh" emails (api/stock-email.js).
//   GET  → a confirm page with one button (email security scanners open
//          links automatically, so a bare GET never unsubscribes anyone).
//   POST → records the unsubscribe for that homestead + email. Also handles
//          RFC 8058 one-click (List-Unsubscribe-Post) from Gmail/Apple Mail.
// The token is HMAC-signed (UNSUBSCRIBE_TOKEN_SECRET) over homestead id +
// email, so links can't be forged or edited.
// ============================================================================

import crypto from 'node:crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function verifyStockToken(token, secret = process.env.UNSUBSCRIBE_TOKEN_SECRET) {
  if (!secret || typeof token !== 'string' || token.length > 600) return null;
  let decoded;
  try { decoded = Buffer.from(token, 'base64url').toString('utf8'); } catch (_) { return null; }
  const parts = decoded.split('|');
  if (parts.length !== 3) return null;
  const [hid, email, sig] = parts;
  if (!UUID_RE.test(hid) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const expected = crypto.createHmac('sha256', secret).update(`stock|${hid}|${email}`).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return { homesteadId: hid, email };
}

function page(title, body, action) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)}</title></head>
<body style="margin:0;background:#F4EDE0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2C1810;">
<div style="max-width:460px;margin:64px auto;padding:28px 22px;background:#FAF5EA;border:1.5px solid #2C181030;border-radius:14px;text-align:center;">
  <div style="font-family:Georgia,serif;font-size:26px;margin-bottom:12px;">${esc(title)}</div>
  <div style="font-size:15px;line-height:1.6;">${body}</div>
  ${action ? `<form method="POST" style="margin-top:20px;"><button type="submit" style="padding:13px 22px;border-radius:10px;border:2px solid #2C1810;background:#2C1810;color:#F4EDE0;font-size:15px;font-weight:700;cursor:pointer;">${esc(action)}</button></form>` : ''}
  <div style="margin-top:22px;font-size:12px;color:#8B6F47;">Sent with <a href="https://henalytics.com" style="color:#8B6F47;">Henalytics</a></div>
</div></body></html>`;
}

async function homesteadName(hid) {
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/homesteads?select=data->>homesteadName,data->stockEmailSettings->>fromName&id=eq.${hid}&limit=1`, {
      headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    const rows = r.ok ? await r.json() : [];
    const row = rows && rows[0];
    return (row && (row.fromName || row.homesteadName)) || 'this farm stand';
  } catch (_) { return 'this farm stand'; }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const t = (req.query && req.query.t) || '';
  const v = verifyStockToken(String(t));
  if (!v) return res.status(400).send(page('Link not valid', 'This unsubscribe link is broken or incomplete. Reply to the email and ask to be removed.', null));
  const name = await homesteadName(v.homesteadId);

  if (req.method === 'GET') {
    return res.status(200).send(page('Unsubscribe?', `Stop getting "what's fresh" emails from <strong>${esc(name)}</strong> at <strong>${esc(v.email)}</strong>?`, 'Unsubscribe'));
  }
  if (req.method !== 'POST') return res.status(405).send(page('Not allowed', 'Unsupported request.', null));

  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/stock_email_unsubscribes?on_conflict=homestead_id,email`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates',
      },
      body: JSON.stringify({ homestead_id: v.homesteadId, email: v.email }),
    });
    if (!r.ok) throw new Error(String(r.status));
  } catch (e) {
    console.error('[stock-unsubscribe]', e);
    return res.status(500).send(page('Please try again', "We couldn't save that just now. Try the button again in a minute.", 'Unsubscribe'));
  }
  return res.status(200).send(page('Unsubscribed', `You won't get any more emails from <strong>${esc(name)}</strong> through Henalytics.`, null));
}
