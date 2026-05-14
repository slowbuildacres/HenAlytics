// Vercel serverless function: POST /api/revenuecat-webhook
//
// Receives server-to-server webhooks from RevenueCat about purchase events on
// iOS (and later Android). Mirrors the role of api/stripe-webhook.js for the
// native side: keeps the `supporters` Supabase table in sync with what the
// user has paid for.
//
// Event flow:
//   1. User taps a tip/subscribe button in the iOS app
//   2. Apple's purchase sheet completes successfully
//   3. RevenueCat receives the receipt server-side from Apple
//   4. RevenueCat fires a webhook to THIS endpoint
//   5. We upsert a row in `supporters` so the supporter wall + monthly
//      thank-you popup include this user
//
// RC event types we care about:
//   INITIAL_PURCHASE      — first time a user buys this product
//   RENEWAL               — subscription renewed for another period
//   PRODUCT_CHANGE        — user switched tiers (e.g. coffee → sustaining)
//   CANCELLATION          — user canceled (still active until period ends)
//   EXPIRATION            — subscription period ended without renewal
//   BILLING_ISSUE         — Apple couldn't charge them; in grace period
//   UNCANCELLATION        — user un-canceled before period ended
//   NON_RENEWING_PURCHASE — one-time tip (consumable)
//   TRANSFER              — purchase moved between accounts (rare)
//
// What we DON'T handle here:
//   - Restore purchases (RC re-fires INITIAL_PURCHASE events for the new
//     user, which we treat as a fresh row — idempotent on subscription_id)
//   - SUBSCRIBER_ALIAS / TEST events (ignored — for RC's own bookkeeping)
//
// Schema this writes to (matches stripe-webhook output, so the supporter
// wall query doesn't change):
//   supporters (
//     user_id              uuid,
//     stripe_customer_id   text,  -- null for iOS; we use revenuecat_user_id
//     stripe_subscription_id text, -- holds RC original_transaction_id for iOS
//     stripe_price_id      text,  -- holds Apple product ID
//     status               text,  -- 'active' | 'past_due' | 'canceled'
//     payment_type         text,  -- 'monthly' | 'one_time'
//     amount_dollars       int,
//     original_started_at  timestamptz,
//     started_at           timestamptz,
//     canceled_at          timestamptz,
//     source               text   -- NEW: 'stripe' | 'revenuecat'
//     revenuecat_user_id   text,  -- NEW: RC's appUserID (our Supabase user ID)
//     ...
//   )
//
// Schema migration required (run once in Supabase SQL editor):
//   alter table supporters add column if not exists source text default 'stripe';
//   alter table supporters add column if not exists revenuecat_user_id text;
//   create index if not exists supporters_revenuecat_user_id_idx
//     on supporters(revenuecat_user_id);
//
// Required env vars:
//   REVENUECAT_WEBHOOK_SECRET  — RC sends this as Authorization: Bearer
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// PRODUCT ID → TIER METADATA
// ----------------------------------------------------------------------------
// Mirrors src/IapManager.js IAP_PRODUCTS. Keep in sync — if you add a product
// in one place, add it in the other. The amount_dollars values are the
// "display tier" amounts (matching the Stripe-era tier display), NOT the
// actual price paid (which is Apple's $X.99 amount).
// ============================================================================
function tierMetaFromProductId(productId) {
  switch (productId) {
    case 'com.henalytics.app.sub.seedling':
      return { type: 'monthly',  amount: 1,  tier: 'monthly_1'  };
    case 'com.henalytics.app.sub.coffee':
      return { type: 'monthly',  amount: 3,  tier: 'monthly_3'  };
    case 'com.henalytics.app.sub.sustaining':
      return { type: 'monthly',  amount: 5,  tier: 'monthly_5'  };
    case 'com.henalytics.app.sub.generous':
      return { type: 'monthly',  amount: 10, tier: 'monthly_10' };
    case 'com.henalytics.app.tip.one_time':
      return { type: 'one_time', amount: 5,  tier: 'one_time'   };
    default:
      // Unknown product — log and default to one_time so we don't lose the
      // record. The admin can fix the amount in Supabase if this fires.
      console.warn('[rc-webhook] unknown product ID:', productId);
      return { type: 'one_time', amount: null, tier: 'one_time' };
  }
}

// Map RC event_type → DB status
function statusFromEventType(eventType) {
  switch (eventType) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
    case 'NON_RENEWING_PURCHASE':
      return 'active';
    case 'BILLING_ISSUE':
      return 'past_due';
    case 'CANCELLATION':
    case 'EXPIRATION':
      return 'canceled';
    default:
      return null; // event we don't update on
  }
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
// AUTH — verify RevenueCat webhook secret
// ----------------------------------------------------------------------------
// RC sends Authorization: Bearer <your-secret>. We compare in constant time
// against the configured secret. Spoofed webhooks would be a way to fake
// supporter status — guard carefully.
// ============================================================================
function verifyWebhookAuth(req) {
  const expected = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!expected) {
    console.error('[rc-webhook] REVENUECAT_WEBHOOK_SECRET not configured');
    return false;
  }
  const auth = req.headers.authorization || req.headers.Authorization;
  if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) return false;
  const provided = auth.slice(7).trim();

  // Constant-time comparison to avoid timing-attack info leakage.
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < provided.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ---- Verify webhook signature ----
  if (!verifyWebhookAuth(req)) {
    console.warn('[rc-webhook] unauthorized webhook attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ---- Parse body ----
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  if (!body || !body.event) {
    return res.status(400).json({ error: 'Missing event payload' });
  }

  const event = body.event;
  const eventType = event.type;
  const userId = event.app_user_id;        // our Supabase user ID (we set this via initIap)
  const productId = event.product_id;       // Apple product identifier
  const originalTransactionId = event.original_transaction_id || event.transaction_id;
  const purchasedAtMs = event.purchased_at_ms;
  const expirationAtMs = event.expiration_at_ms;
  const priceCents = typeof event.price === 'number' ? Math.round(event.price * 100) : null;

  // ---- Ignore non-actionable events ----
  const status = statusFromEventType(eventType);
  if (!status) {
    // TEST event, SUBSCRIBER_ALIAS, TRANSFER, etc.
    console.log('[rc-webhook] ignoring event type:', eventType);
    return res.status(200).json({ ok: true, ignored: eventType });
  }

  // ---- Validate userId — RC anonymous IDs start with $RCAnonymousID: and
  //      mean the user never signed in. We can't link a purchase to a
  //      Supabase account without a real user ID, so park it for later. ----
  if (!userId || userId.startsWith('$RCAnonymousID:')) {
    // Anonymous purchase. Could happen if user tips before signing in.
    // We don't have a way to credit it without a user_id, so we log and
    // skip. RC will keep the purchase associated with the device; when the
    // user later signs in, RC's logIn() merges the anonymous purchases into
    // the real user ID and we'll get a TRANSFER event we can act on.
    console.log('[rc-webhook] anonymous purchase, awaiting user identification:', originalTransactionId);
    return res.status(200).json({ ok: true, anonymous: true });
  }

  if (!productId || !originalTransactionId) {
    console.warn('[rc-webhook] missing required fields:', { productId, originalTransactionId, eventType });
    return res.status(400).json({ error: 'Missing required event fields' });
  }

  const meta = tierMetaFromProductId(productId);
  const purchasedAt = purchasedAtMs ? new Date(purchasedAtMs).toISOString() : new Date().toISOString();
  const expirationAt = expirationAtMs ? new Date(expirationAtMs).toISOString() : null;
  const canceledAt = (status === 'canceled') ? purchasedAt : null;

  // ---- Upsert supporters row ----
  // Keyed by stripe_subscription_id (we store RC's original_transaction_id
  // there for iOS rows). Apple's original_transaction_id is stable across
  // renewals — same value on every renewal of the same subscription — so
  // this naturally de-duplicates renewal events into a single supporters row.
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('supporters')
    .upsert({
      user_id: userId,
      source: 'revenuecat',
      revenuecat_user_id: userId,
      stripe_customer_id: null,                  // not applicable on iOS
      stripe_subscription_id: originalTransactionId, // reused field
      stripe_price_id: productId,                // reused field — Apple product ID
      status: status,
      payment_type: meta.type,
      amount_dollars: meta.amount,
      original_started_at: purchasedAt,
      started_at: purchasedAt,
      canceled_at: canceledAt,
      // Optional analytic fields if your schema includes them:
      // current_period_end: expirationAt,
      // last_payment_cents: priceCents,
    }, {
      onConflict: 'stripe_subscription_id',
    });

  if (error) {
    console.error('[rc-webhook] supabase upsert failed:', error);
    return res.status(500).json({ error: 'Could not save supporter row' });
  }

  console.log('[rc-webhook] processed:', eventType, productId, 'for user', userId.slice(0, 8) + '...');
  return res.status(200).json({ ok: true });
}

// Vercel needs the raw body for some webhook signature schemes, but RC uses
// Authorization header verification, not body signature — so we can let
// Vercel parse the JSON normally.
export const config = {
  api: {
    bodyParser: true,
  },
};
