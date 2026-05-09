// Vercel serverless function: POST /api/send-email
//
// This runs on Vercel's servers (not in the user's browser), which is why
// we can safely use the secret RESEND_API_KEY here. The browser code sends
// requests here; this function then sends emails via Resend.
//
// Three email types supported, distinguished by `kind`:
//   "feedback"        — feedback from the in-app form, sent to OWNER_EMAIL
//   "farmhand_invite" — invitation email to a prospective farmhand

const RESEND_API = 'https://api.resend.com/emails';

// All emails go from this address. Resend's free shared sender works without
// any DNS setup. Switch to a verified custom domain later if desired.
const FROM_ADDRESS = process.env.EMAIL_FROM || 'Henalytics <onboarding@resend.dev>';

// Where the owner's notifications and feedback go.
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'slowbuildacres@gmail.com';

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  let body = req.body;
  // Vercel sometimes leaves req.body as a string; parse it ourselves to be safe.
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const { kind } = body;

  try {
    let payload;
    if (kind === 'feedback') {
      payload = buildFeedbackEmail(body);
    } else if (kind === 'signup_notify') {
      payload = buildSignupEmail(body);
    } else if (kind === 'farmhand_invite') {
      payload = buildFarmhandInviteEmail(body);
    } else {
      return res.status(400).json({ error: 'Unknown email kind' });
    }

    const response = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Resend error', response.status, errText);
      return res.status(502).json({ error: 'Email send failed', detail: errText });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Send email error', err);
    return res.status(500).json({ error: 'Internal error', detail: String(err) });
  }
}

// ---------- Email builders ----------

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function buildFeedbackEmail({ category, message, fromEmail }) {
  const safeCat = escape(category || 'other');
  const safeMsg = escape(message || '').replace(/\n/g, '<br>');
  const safeFrom = fromEmail ? escape(fromEmail) : 'anonymous';

  return {
    from: FROM_ADDRESS,
    to: [OWNER_EMAIL],
    reply_to: fromEmail || undefined,
    subject: `Henalytics feedback (${safeCat})`,
    html: `
      <h2>New Henalytics feedback</h2>
      <p><strong>Category:</strong> ${safeCat}</p>
      <p><strong>From:</strong> ${safeFrom}</p>
      <hr>
      <div>${safeMsg}</div>
      <hr>
      <p style="color:#888;font-size:12px">Sent from the Henalytics in-app feedback form.</p>
    `,
    text: `Category: ${category}\nFrom: ${fromEmail || 'anonymous'}\n\n${message}`,
  };
}

function buildSignupEmail({ newUserEmail }) {
  return {
    from: FROM_ADDRESS,
    to: [OWNER_EMAIL],
    subject: `New Henalytics signup: ${newUserEmail}`,
    html: `
      <h2>Someone new signed up for Henalytics 🎉</h2>
      <p><strong>Email:</strong> ${escape(newUserEmail)}</p>
      <p><strong>When:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} (Central)</p>
      <p style="color:#888;font-size:12px">Automatic notification from the Henalytics signup flow.</p>
    `,
    text: `New signup: ${newUserEmail}`,
  };
}

function buildFarmhandInviteEmail({ inviteEmail, inviterEmail, homesteadName, inviteLink }) {
  const homestead = homesteadName || 'a homestead';
  return {
    from: FROM_ADDRESS,
    to: [inviteEmail],
    reply_to: inviterEmail || undefined,
    subject: `${inviterEmail || 'Someone'} invited you to ${homestead} on Henalytics`,
    html: `
      <h2>You've been invited to a homestead 🌱</h2>
      <p><strong>${escape(inviterEmail || 'Someone')}</strong> invited you to share <strong>${escape(homestead)}</strong> on Henalytics.</p>
      <p>Henalytics is a simple tracker for gardens, egg layers, and meat chickens. As a farmhand you'll be able to log entries, view photos, and see analytics for the homestead.</p>
      <p style="margin: 24px 0;">
        <a href="${escape(inviteLink)}" style="background:#2C1810;color:#F4EDE0;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;font-family:sans-serif">Accept invitation</a>
      </p>
      <p style="color:#666;font-size:12px">Or copy this link: ${escape(inviteLink)}</p>
      <p style="color:#888;font-size:12px;margin-top:32px">If you didn't expect this, you can safely ignore the email.</p>
    `,
    text: `${inviterEmail || 'Someone'} invited you to ${homestead} on Henalytics.\n\nAccept here: ${inviteLink}\n\nIf you didn't expect this, ignore this email.`,
  };
}
