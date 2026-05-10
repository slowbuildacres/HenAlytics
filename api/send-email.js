// Vercel serverless function: POST /api/send-email
//
// Hardened version with:
//   - JWT verification (only authenticated Henalytics users can call this)
//   - Persistent per-user rate limiting via Upstash Redis (5 emails / 10 min)
//   - Database-trusted invite lookups (client can't forge inviter/recipient/link)
//   - Tightened CORS (only henalytics.com)
//   - Server-side enforcement of fromEmail/newUserEmail using JWT identity
//
// Required environment variables (set in Vercel dashboard):
//   RESEND_API_KEY                — Resend.com API key for sending mail
//   SUPABASE_URL                  — your Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY     — service-role key (NEVER expose to browser)
//   UPSTASH_REDIS_REST_URL        — Upstash Redis REST endpoint
//   UPSTASH_REDIS_REST_TOKEN      — Upstash Redis REST token
//   EMAIL_FROM (optional)         — defaults to Resend's shared sender
//   OWNER_EMAIL (optional)        — defaults to slowbuildacres@gmail.com

import { createClient } from '@supabase/supabase-js';

const RESEND_API = 'https://api.resend.com/emails';
const FROM_ADDRESS = process.env.EMAIL_FROM || 'Henalytics <onboarding@resend.dev>';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'slowbuildacres@gmail.com';

// Allowed origins — block everything else at the CORS layer. Add staging/preview
// URLs here if you ever deploy them. Same-origin requests from the deployed app
// don't actually need CORS, but pinning this prevents browser-based abuse from
// other sites trying to embed/iframe Henalytics.
const ALLOWED_ORIGINS = new Set([
  'https://henalytics.com',
  'https://www.henalytics.com',
]);

// Rate limit settings — per authenticated user, sliding window.
// 5 emails per 10 minutes is generous for normal use (logging feedback,
// inviting a farmhand, signup notify) but blocks abuse via scripts.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 600;

// Lazy-initialize the Supabase admin client. Uses the service-role key, so
// it bypasses RLS — we only use it to (a) verify JWTs and (b) look up invites.
// Never used to read other users' data.
let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase admin not configured');
  }
  _supabaseAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _supabaseAdmin;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
export default async function handler(req, res) {
  const origin = req.headers.origin;
  const corsOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://henalytics.com';

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', corsOrigin);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Required env vars
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  // ---- Step 1: Verify the JWT ----
  // Only authenticated Henalytics users can hit this endpoint. The browser
  // sends `Authorization: Bearer <jwt>` from the active Supabase session.
  let user;
  try {
    user = await verifyAuth(req);
  } catch (e) {
    return res.status(401).json({ error: e.message || 'Authentication required' });
  }

  // ---- Step 2: Rate limit ----
  // Per-user limit so one abusive account can't burn everyone else's quota.
  try {
    const allowed = await checkRateLimit(user.id);
    if (!allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded — too many emails recently. Try again in a few minutes.',
      });
    }
  } catch (e) {
    // Rate limiter failure shouldn't block legitimate users — log and continue.
    // If Upstash is down, we accept some abuse risk over breaking the app.
    console.error('Rate limit check failed (non-blocking):', e);
  }

  // ---- Step 3: Parse and validate body ----
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};
  const { kind } = body;

  // ---- Step 4: Build payload — server-trusted, never trusts client values
  //              for sender identity ----
  let payload;
  try {
    if (kind === 'feedback') {
      // Force fromEmail to the authenticated user's email — client value ignored.
      payload = buildFeedbackEmail({
        category: body.category,
        message: body.message,
        fromEmail: user.email,
      });
    } else if (kind === 'signup_notify') {
      // Force newUserEmail to the authenticated user's email.
      payload = buildSignupEmail({ newUserEmail: user.email });
    } else if (kind === 'farmhand_invite') {
      // Look up the invite from the DB using the inviteCode. We trust nothing
      // from the client beyond the code itself. The DB tells us:
      //   - who the invitee is (invited_email)
      //   - who the inviter is (looked up from auth.users)
      //   - which homestead this is for (looked up from homesteads.data)
      //
      // We also verify the caller is an owner of this homestead, so a random
      // user can't trigger sends on someone else's behalf.
      const inviteData = await lookupAndAuthorizeInvite(body.inviteCode, user.id);
      if (!inviteData) {
        return res.status(404).json({ error: 'Invite not found or not authorized' });
      }
      payload = buildFarmhandInviteEmail(inviteData);
    } else {
      return res.status(400).json({ error: 'Unknown email kind' });
    }
  } catch (e) {
    console.error('Payload build failed:', e);
    return res.status(400).json({ error: 'Invalid request', detail: String(e.message || e) });
  }

  // ---- Step 5: Send via Resend ----
  try {
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
      // Don't leak Resend's error details to the client — could reveal API
      // key issues, quota state, etc. Generic message instead.
      return res.status(502).json({ error: 'Email send failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Send email error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}

// ============================================================================
// AUTH — verify Supabase JWT from Authorization header
// ============================================================================
async function verifyAuth(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authentication required');
  }
  const jwt = authHeader.slice(7).trim();
  if (!jwt) throw new Error('Authentication required');

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user) {
    throw new Error('Invalid or expired session');
  }
  // Sanity: must have an email (Henalytics signs in via email)
  if (!data.user.email) {
    throw new Error('Account missing email');
  }
  return data.user;
}

// ============================================================================
// RATE LIMITING — per-user sliding window via Upstash Redis
// ============================================================================
//
// Algorithm: simple sorted-set sliding window.
//   - Key: rl:email:{userId}
//   - Each call: ZADD timestamp, ZREMRANGEBYSCORE older than window, ZCARD
//   - If count > MAX, reject. Otherwise proceed.
//
// We talk to Upstash via their REST API (no Redis client library needed,
// keeps the bundle small). All commands are idempotent — if Upstash is
// unreachable we log and let the request through (we'd rather have abuse
// than break the app for legit users).
async function checkRateLimit(userId) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn('Upstash not configured — skipping rate limit check');
    return true;
  }

  const key = `rl:email:${userId}`;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_SECONDS * 1000;

  // Pipeline three commands: prune old, count current, add new.
  // Using REST API's pipeline endpoint for one round-trip.
  const pipeline = [
    ['ZREMRANGEBYSCORE', key, '-inf', String(windowStart)],
    ['ZCARD', key],
    ['ZADD', key, String(now), `${now}-${Math.random().toString(36).slice(2, 8)}`],
    ['EXPIRE', key, String(RATE_LIMIT_WINDOW_SECONDS)],
  ];

  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pipeline),
  });

  if (!res.ok) {
    throw new Error(`Upstash error ${res.status}`);
  }

  const results = await res.json();
  // results[1] is the ZCARD result (count BEFORE we added the new entry)
  const countBefore = Number(results[1]?.result ?? 0);

  // We add one more after, so total would be countBefore + 1.
  // Reject if that would exceed the max.
  return countBefore < RATE_LIMIT_MAX;
}

// ============================================================================
// INVITE LOOKUP — pull invite data from the DB so client can't forge it
// ============================================================================
//
// We look up:
//   - the pending invite (must exist, not be expired, not be accepted)
//   - the inviter's email (from auth.users via service role)
//   - the homestead name (from homesteads.data)
//
// We also verify the caller is the inviter (or a homestead owner). This
// prevents a logged-in user from spamming invites on someone else's behalf.
//
// Returns null if invite not found OR caller not authorized.
async function lookupAndAuthorizeInvite(inviteCode, callerUserId) {
  if (!inviteCode || typeof inviteCode !== 'string') return null;

  const supabase = getSupabaseAdmin();

  // 1. Get the invite row
  const { data: invite, error: inviteErr } = await supabase
    .from('pending_invites')
    .select('id, homestead_id, invited_email, invite_code, invited_by, created_at, expires_at, accepted_at')
    .eq('invite_code', inviteCode)
    .maybeSingle();

  if (inviteErr || !invite) return null;
  if (invite.accepted_at) return null;
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return null;

  // 2. Authorize: caller must be the inviter OR an owner of this homestead
  if (invite.invited_by !== callerUserId) {
    const { data: membership } = await supabase
      .from('homestead_members')
      .select('role')
      .eq('homestead_id', invite.homestead_id)
      .eq('user_id', callerUserId)
      .maybeSingle();
    if (!membership || membership.role !== 'owner') {
      return null;
    }
  }

  // 3. Look up inviter's email (we use the inviter on the invite, not the caller,
  //    so the email shows the original sender even if an owner is re-sending)
  const { data: inviterUser } = await supabase.auth.admin.getUserById(invite.invited_by);
  const inviterEmail = inviterUser?.user?.email || 'A homesteader';

  // 4. Look up the homestead name from its data blob
  const { data: homestead } = await supabase
    .from('homesteads')
    .select('data')
    .eq('id', invite.homestead_id)
    .maybeSingle();
  const homesteadName =
    homestead?.data?.homesteadName?.trim?.() || 'their homestead';

  // 5. Build the invite link ourselves — not from the client
  const baseUrl = process.env.PUBLIC_BASE_URL || 'https://henalytics.com';
  const inviteLink = `${baseUrl}/?invite=${encodeURIComponent(inviteCode)}`;

  return {
    inviteEmail: invite.invited_email,
    inviterEmail,
    homesteadName,
    inviteLink,
  };
}

// ============================================================================
// EMAIL BUILDERS
// ============================================================================
function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function buildFeedbackEmail({ category, message, fromEmail }) {
  const safeCat = escape(category || 'other');
  const safeMsg = escape(message || '').replace(/\n/g, '<br>');
  const safeFrom = fromEmail ? escape(fromEmail) : 'unknown';

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
    text: `Category: ${category}\nFrom: ${fromEmail || 'unknown'}\n\n${message || ''}`,
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
