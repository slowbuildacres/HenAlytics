// ============================================================================
// Vercel serverless function: GET/POST /api/unsubscribe-chore-email
// ----------------------------------------------------------------------------
// Public endpoint hit when a recipient clicks the unsubscribe link in any
// chore email, OR when their email client uses the one-click List-Unsubscribe
// header (RFC 8058).
//
// Both GET and POST are accepted:
//   GET  → renders a tiny HTML confirmation page (for browser clicks)
//   POST → JSON-style 204 response (for one-click clients like Gmail)
//
// Token format: base64url("email:hmac-sha256-of-email").
// We verify the HMAC matches, then upsert the email into chore_email_unsubscribes.
//
// No auth required — that's the point. Anyone who has a valid signed token
// for an email can unsubscribe that email. Since the token was generated and
// sent to that exact email's owner, this is the correct security model.
//
// Required env vars:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   UNSUBSCRIBE_TOKEN_SECRET
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin not configured');
  _supabaseAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _supabaseAdmin;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = (req.query?.token || req.body?.token || '').toString();
  const fallbackEmail = (req.query?.email || req.body?.email || '').toString();

  let email = null;
  if (token) {
    email = verifyToken(token);
  } else if (fallbackEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fallbackEmail)) {
    // Fallback: an unsigned ?email=… link. Only honored if UNSUBSCRIBE_TOKEN_SECRET
    // is not set (dev mode). Production should reject this branch.
    if (!process.env.UNSUBSCRIBE_TOKEN_SECRET) {
      email = fallbackEmail.toLowerCase();
    }
  }

  if (!email) {
    return respond(req, res, 400, 'Invalid or expired unsubscribe link.', false);
  }

  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('chore_email_unsubscribes').upsert({
      email,
      reason: req.method === 'POST' ? 'one-click' : 'web-link',
    }, { onConflict: 'email' });
  } catch (e) {
    console.error('[unsubscribe] failed to record', email, e);
    return respond(req, res, 500, 'Could not process unsubscribe. Please try again.', false);
  }

  return respond(req, res, 200, `You've been unsubscribed from Henalytics chore emails.`, true, email);
}

// ============================================================================
// Verify HMAC-signed token. Returns the email or null.
// ============================================================================
function verifyToken(token) {
  const secret = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  if (!secret) return null;
  let decoded;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const colonIdx = decoded.lastIndexOf(':');
  if (colonIdx === -1) return null;
  const email = decoded.slice(0, colonIdx).toLowerCase();
  const sig = decoded.slice(colonIdx + 1);

  const expected = crypto.createHmac('sha256', secret).update(email).digest('base64url');
  // Constant-time comparison to defeat timing attacks
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

// ============================================================================
// Render response — HTML for browser GETs, JSON for POSTs
// ============================================================================
function respond(req, res, status, message, success, email) {
  if (req.method === 'POST') {
    return res.status(status).json({ ok: success, message });
  }
  // HTML response for clicks from email clients
  const html = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <title>${success ? 'Unsubscribed' : 'Unsubscribe'} — Henalytics</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0; padding:0; background:#F4EDE0; font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
  <div style="max-width:480px; margin:80px auto; padding:32px 24px; background:#FAF5EA; border:1.5px solid #2C181030; border-radius:12px; box-shadow:3px 4px 0 #2C181020;">
    <div style="font-family:Georgia, serif; font-size:28px; color:#2C1810; margin-bottom:16px; text-align:center;">
      ${success ? '🌾 Unsubscribed' : 'Unable to unsubscribe'}
    </div>
    <div style="font-size:15px; color:#2C1810; line-height:1.6; text-align:center; margin-bottom:20px;">
      ${escapeHtml(message)}
    </div>
    ${success && email ? `
    <div style="font-size:13px; color:#5C4530; text-align:center; line-height:1.5;">
      <strong>${escapeHtml(email)}</strong> will no longer receive weekly chore emails.<br><br>
      If this was a mistake, you can resubscribe from the Settings menu inside the Henalytics app.
    </div>
    ` : ''}
    <div style="text-align:center; margin-top:24px;">
      <a href="https://henalytics.com" style="font-size:13px; color:#5A7A3C; text-decoration:underline;">
        Back to Henalytics
      </a>
    </div>
  </div>
</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(status).send(html);
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
