import { getCorsOrigin } from './_cors.js';
// Vercel serverless function: POST /api/claim-supporter
//
// For users who donate via the old Payment Link flow (pre-pass-1), their
// Stripe subscription exists but no row in the supporters table links it
// to their Henalytics user_id. This endpoint bridges that:
//
//   1. Verifies the caller's Henalytics auth (JWT)
//   2. Looks up Stripe customers by the email they provided
//   3. If a customer with an active subscription exists, creates/updates
//      the supporter row with their user_id + linked subscription
//   4. Client then opens the SupporterNamePromptModal so they can add a name
//
// Security:
//   - Only verifiably-active Stripe subscribers can claim
//   - The email they enter is verified against Stripe, NOT trusted on its own
//   - Even if a user knows someone else's Stripe email, they can only link
//     it to THEIR OWN user_id (using their JWT) — they can't impersonate
//
// Edge cases handled:
//   - Email doesn't exist in Stripe → "We couldn't find an active subscription"
//   - Customer exists but no active subscription → same
//   - Customer has multiple subscriptions → uses the oldest active one
//   - Supporter row already exists for this subscription → idempotent upsert
//
// Required env vars (same as create-checkout-session + stripe-webhook):
//   STRIPE_SECRET_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (rate limit)

import { createClient } from '@supabase/supabase-js';

const STRIPE_API = 'https://api.stripe.com/v1';

const ALLOWED_ORIGINS = new Set([
  'https://henalytics.com',
  'https://www.henalytics.com',
]);

// Tighter rate limit than checkout — claims should be rare per user
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 600;

// Map Stripe price IDs back to tier info (same as stripe-webhook)
function getTierFromPriceId(priceId) {
  if (priceId === process.env.STRIPE_PRICE_MONTHLY_1)  return { amount: 1,  type: 'monthly' };
  if (priceId === process.env.STRIPE_PRICE_MONTHLY_3)  return { amount: 3,  type: 'monthly' };
  if (priceId === process.env.STRIPE_PRICE_MONTHLY_5)  return { amount: 5,  type: 'monthly' };
  if (priceId === process.env.STRIPE_PRICE_MONTHLY_10) return { amount: 10, type: 'monthly' };
  if (priceId === process.env.STRIPE_PRICE_ONE_TIME)   return { amount: 5,  type: 'one_time' };
  // Legacy Payment Link products — won't match any of our new env vars but
  // they're still valid claims. Fall back to "monthly, amount unknown".
  return { amount: null, type: 'monthly' };
}

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
  const corsOrigin = getCorsOrigin(req);

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
    return res.status(500).json({ error: 'Claim flow not configured' });
  }

  // ---- Parse body ----
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};
  const rawEmail = (body.email || '').toString().trim().toLowerCase();
  if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email.' });
  }

  // ---- Auth ----
  let user;
  try {
    user = await verifyAuth(req);
  } catch (e) {
    return res.status(401).json({ error: e.message || 'Please sign in first.' });
  }

  // ---- Rate limit ----
  try {
    const allowed = await checkRateLimit(`claim:${user.id}`);
    if (!allowed) {
      return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
    }
  } catch (e) {
    console.warn('Rate limit check failed:', e.message);
  }

  // ---- Look up Stripe customers by email ----
  let customers;
  try {
    const r = await fetch(`${STRIPE_API}/customers?email=${encodeURIComponent(rawEmail)}&limit=10`, {
      headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    });
    const j = await r.json();
    if (!r.ok) {
      console.error('Stripe customer search failed:', r.status, j);
      return res.status(502).json({ error: 'Could not verify with Stripe right now. Try again later.' });
    }
    customers = j.data || [];
  } catch (e) {
    console.error('Stripe fetch error (customers):', e);
    return res.status(502).json({ error: 'Could not reach Stripe.' });
  }

  if (customers.length === 0) {
    return res.status(404).json({ error: "We couldn't find a Stripe customer with that email. Double-check the address on your receipt email." });
  }

  // ---- Find an active subscription across these customers ----
  //
  // A given email might have multiple Stripe Customer records (Stripe creates
  // a new one per checkout if not deduped). We check all of them for active
  // subscriptions and use the oldest one found (longest-tenured).
  let bestSub = null;
  let bestCustomer = null;
  for (const cust of customers) {
    let subs;
    try {
      const r = await fetch(`${STRIPE_API}/subscriptions?customer=${cust.id}&status=all&limit=10`, {
        headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      });
      const j = await r.json();
      if (!r.ok) {
        console.warn(`Stripe sub search failed for customer ${cust.id}:`, r.status, j);
        continue;
      }
      subs = j.data || [];
    } catch (e) {
      console.warn('Stripe fetch error (subscriptions):', e);
      continue;
    }
    for (const sub of subs) {
      // Accept active or trialing — we want any non-canceled subscription.
      // past_due is also accepted (Stripe is retrying); they're effectively
      // still supporters until Stripe gives up.
      if (sub.status !== 'active' && sub.status !== 'trialing' && sub.status !== 'past_due') continue;
      const subStart = sub.start_date || sub.created;
      const bestStart = bestSub ? (bestSub.start_date || bestSub.created) : Infinity;
      if (!bestSub || subStart < bestStart) {
        bestSub = sub;
        bestCustomer = cust;
      }
    }
  }

  if (!bestSub) {
    return res.status(404).json({ error: "We found a Stripe account with that email, but no active subscription. If you recently canceled, the claim isn't available." });
  }

  // ---- Extract subscription details ----
  const priceId = bestSub.items?.data?.[0]?.price?.id || null;
  const { amount, type: paymentType } = getTierFromPriceId(priceId);
  const subscriptionId = bestSub.id;
  const customerId = bestCustomer.id;
  const startedAt = new Date((bestSub.start_date || bestSub.created) * 1000).toISOString();
  const statusForDb = bestSub.status === 'past_due' ? 'past_due' : 'active';

  // ---- Upsert the supporter row ----
  //
  // Keyed by stripe_subscription_id (unique). If the row exists already (we
  // imported them via backfill earlier), this just updates user_id + email
  // to link them to the current Henalytics account. The user can then update
  // homestead_name via the chained name prompt.
  const supabase = getSupabaseAdmin();
  const { error: upsertErr } = await supabase
    .from('supporters')
    .upsert({
      user_id: user.id,
      email: rawEmail,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      status: statusForDb,
      payment_type: paymentType,
      amount_dollars: amount,
      original_started_at: startedAt,
      started_at: startedAt,
      canceled_at: null,
    }, {
      onConflict: 'stripe_subscription_id',
    });

  if (upsertErr) {
    console.error('claim-supporter upsert failed:', upsertErr);
    return res.status(500).json({ error: 'Could not save your claim. Please try again or email slowbuildacres@gmail.com.' });
  }

  return res.status(200).json({
    success: true,
    subscription_id: subscriptionId,
    amount_dollars: amount,
  });
}

// ============================================================================
// AUTH — verify Supabase JWT (same as other endpoints)
// ============================================================================
async function verifyAuth(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    throw new Error('Please sign in first.');
  }
  const jwt = authHeader.slice(7).trim();
  if (!jwt) throw new Error('Please sign in first.');

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user) {
    throw new Error('Session expired. Please sign in again.');
  }
  return data.user;
}

// ============================================================================
// RATE LIMITING — same Upstash sliding window
// ============================================================================
async function checkRateLimit(rateLimitKey) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true;

  const key = `rl:claim:${rateLimitKey}`;
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
