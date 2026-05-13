// Vercel serverless function: POST /api/create-checkout-session
//
// Creates a Stripe Checkout Session and returns the redirect URL. The user's
// Henalytics ID is attached via `client_reference_id` AND `metadata.user_id`
// so the webhook can match the subscription back to the user.
//
// Why this exists (vs Payment Links):
//   Payment Links don't let you attach arbitrary metadata at click-time. With
//   Checkout Sessions we generate a fresh session per click, bake in the
//   user_id, and the webhook receives it. No email-matching guesswork.
//
// Required environment variables (set in Vercel dashboard):
//   STRIPE_SECRET_KEY            — Stripe API secret key (sk_live_...)
//   STRIPE_PRICE_MONTHLY_1       — Stripe price ID for the $1/mo tier
//   STRIPE_PRICE_MONTHLY_3       — Stripe price ID for the $3/mo tier
//   STRIPE_PRICE_MONTHLY_5       — Stripe price ID for the $5/mo tier
//   STRIPE_PRICE_MONTHLY_10      — Stripe price ID for the $10/mo tier
//   STRIPE_PRICE_ONE_TIME        — Stripe price ID for the one-time tip
//   SUPABASE_URL                 — your Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY    — service-role key (verifies the user's JWT)
//   UPSTASH_REDIS_REST_URL       — for rate limiting
//   UPSTASH_REDIS_REST_TOKEN
//   SUCCESS_URL_BASE (optional)  — defaults to https://henalytics.com
//
// Request body:
//   { tier: "monthly_1" | "monthly_3" | "monthly_5" | "monthly_10" | "one_time" }

import { createClient } from '@supabase/supabase-js';

const STRIPE_API = 'https://api.stripe.com/v1';

const ALLOWED_ORIGINS = new Set([
  'https://henalytics.com',
  'https://www.henalytics.com',
]);

// Rate limit: 10 checkout attempts / 10 min / user. Generous (people change
// their mind, hit back, try again) but blocks scripted abuse.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 600;

// Map our tier IDs → env var names. Adding a new tier = new env var + new key here.
const TIER_TO_PRICE_ENV = {
  monthly_1:  'STRIPE_PRICE_MONTHLY_1',
  monthly_3:  'STRIPE_PRICE_MONTHLY_3',
  monthly_5:  'STRIPE_PRICE_MONTHLY_5',
  monthly_10: 'STRIPE_PRICE_MONTHLY_10',
  one_time:   'STRIPE_PRICE_ONE_TIME',
};

// Map tier → checkout mode (subscription vs one-time payment)
const TIER_TO_MODE = {
  monthly_1:  'subscription',
  monthly_3:  'subscription',
  monthly_5:  'subscription',
  monthly_10: 'subscription',
  one_time:   'payment',
};

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

// ============================================================================
// MAIN HANDLER
// ============================================================================
export default async function handler(req, res) {
  const origin = req.headers.origin;
  const corsOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://henalytics.com';

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

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY not configured');
    return res.status(500).json({ error: 'Checkout not configured' });
  }

  // ---- Parse body ----
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};
  const { tier } = body;

  if (!tier || !TIER_TO_PRICE_ENV[tier]) {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  const priceId = process.env[TIER_TO_PRICE_ENV[tier]];
  if (!priceId) {
    console.error(`Price env var ${TIER_TO_PRICE_ENV[tier]} not configured`);
    return res.status(500).json({ error: 'Tier not configured' });
  }

  // ---- Auth ----
  let user;
  try {
    user = await verifyAuth(req);
  } catch (e) {
    return res.status(401).json({ error: e.message || 'Authentication required' });
  }

  // ---- Rate limit ----
  try {
    const allowed = await checkRateLimit(`checkout:${user.id}`);
    if (!allowed) {
      return res.status(429).json({ error: 'Too many checkout attempts. Try again in a few minutes.' });
    }
  } catch (e) {
    // Don't block on rate-limit infra failure — log and continue
    console.warn('Rate limit check failed:', e.message);
  }

  // ---- Build the Stripe Checkout Session ----
  //
  // We use the form-encoded API directly rather than the @stripe/stripe-node
  // SDK to keep the cold-start light. The Stripe REST API is stable and the
  // form-encoded format is well-documented.
  const successBase = process.env.SUCCESS_URL_BASE || 'https://henalytics.com';
  const mode = TIER_TO_MODE[tier];

  const params = new URLSearchParams();
  params.append('mode', mode);
  params.append('line_items[0][price]', priceId);
  params.append('line_items[0][quantity]', '1');
  // client_reference_id lands in webhook event.data.object.client_reference_id
  params.append('client_reference_id', user.id);
  // metadata is the more flexible route — appears in webhook events for both
  // the Checkout Session AND the resulting Subscription / Payment Intent.
  params.append('metadata[user_id]', user.id);
  params.append('metadata[tier]', tier);
  // Lock the customer email so users don't accidentally pay with a different
  // email than they use to log in. They CAN still change it on the Stripe page,
  // but the default is correct.
  params.append('customer_email', user.email);
  // Where to send them after success/cancel
  params.append('success_url', `${successBase}/?supported=${tier}&session_id={CHECKOUT_SESSION_ID}`);
  params.append('cancel_url', `${successBase}/?support_canceled=1`);
  // Allow promotion codes (in case Riley ever wants to do a thank-you discount)
  params.append('allow_promotion_codes', 'true');
  // Auto-collect billing address for tax reporting
  params.append('billing_address_collection', 'auto');

  let session;
  try {
    const stripeRes = await fetch(`${STRIPE_API}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const json = await stripeRes.json();
    if (!stripeRes.ok) {
      console.error('Stripe session create failed:', stripeRes.status, json);
      return res.status(502).json({
        error: json.error?.message || 'Could not start checkout',
      });
    }
    session = json;
  } catch (e) {
    console.error('Stripe fetch error:', e);
    return res.status(502).json({ error: 'Could not reach Stripe' });
  }

  // Return the redirect URL — client does window.location.href = url
  return res.status(200).json({
    url: session.url,
    sessionId: session.id,
  });
}

// ============================================================================
// AUTH — verify Supabase JWT
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
  if (!data.user.email) {
    throw new Error('Account missing email');
  }
  return data.user;
}

// ============================================================================
// RATE LIMITING — sliding window via Upstash REST
// ============================================================================
async function checkRateLimit(rateLimitKey) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true;

  const key = `rl:checkout:${rateLimitKey}`;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_SECONDS * 1000;

  const pipeline = [
    ['ZREMRANGEBYSCORE', key, '-inf', String(windowStart)],
    ['ZCARD', key],
    ['ZADD', key, String(now), `${now}-${Math.random().toString(36).slice(2, 8)}`],
    ['EXPIRE', key, String(RATE_LIMIT_WINDOW_SECONDS)],
  ];

  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(pipeline),
  });
  if (!res.ok) throw new Error(`Upstash error ${res.status}`);
  const results = await res.json();
  const countBefore = Number(results[1]?.result ?? 0);
  return countBefore < RATE_LIMIT_MAX;
}
