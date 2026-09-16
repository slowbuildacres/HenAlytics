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

// ============================================================================
// SCAN PACK PRODUCT MAPPING
// ----------------------------------------------------------------------------
// Scan packs are consumables (one-time purchases) that credit scan_usage
// instead of supporters. Keep in sync with src/IapManager.js SCAN_PACK_PRODUCTS.
// ============================================================================
const SCAN_PACK_SCAN_COUNTS = {
  'com.henalytics.app.consumable.scan_pack_10': 10,
  'com.henalytics.app.consumable.scan_pack_30': 30,
};

function isScanPackProduct(productId) {
  return Object.prototype.hasOwnProperty.call(SCAN_PACK_SCAN_COUNTS, productId);
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

  // ---- Branch: scan pack consumable ----
  // Scan packs are NON_RENEWING_PURCHASE events but should credit
  // scan_usage.extra_remaining instead of writing to supporters.
  if (isScanPackProduct(productId)) {
    if (eventType !== 'NON_RENEWING_PURCHASE') {
      // Scan packs are consumables — they only ever generate NON_RENEWING_PURCHASE.
      // Other event types on these product IDs would be unexpected.
      console.warn('[rc-webhook] unexpected event type for scan pack:', eventType, productId);
      return res.status(200).json({ ok: true, ignored: eventType });
    }
    return await handleScanPackPurchase(res, userId, productId, originalTransactionId);
  }

  const meta = tierMetaFromProductId(productId);
  const purchasedAt = purchasedAtMs ? new Date(purchasedAtMs).toISOString() : new Date().toISOString();
  const expirationAt = expirationAtMs ? new Date(expirationAtMs).toISOString() : null;
  // Use when the event actually happened for cancel/expire. purchased_at_ms is
  // the last *purchase* (renewal) time, not the cancellation time.
  const eventAt = event.event_timestamp_ms
    ? new Date(event.event_timestamp_ms).toISOString()
    : new Date().toISOString();
  const canceledAt = (status === 'canceled') ? eventAt : null;

  const supabase = getSupabaseAdmin();

  // ---- Does this subscription already have a row? ----
  // Keyed by stripe_subscription_id (we store RC's original_transaction_id
  // there for native rows). Apple/Google's original_transaction_id is stable
  // across renewals, so RENEWAL events land on the same row.
  const { data: existing, error: existingErr } = await supabase
    .from('supporters')
    .select('id, original_started_at, started_at')
    .eq('stripe_subscription_id', originalTransactionId)
    .maybeSingle();

  if (existingErr) {
    console.error('[rc-webhook] existing-row lookup failed:', existingErr);
    return res.status(500).json({ error: 'Could not read supporter row' });
  }

  let error;

  if (existing) {
    // ---- Existing subscription (RENEWAL, CANCELLATION, BILLING_ISSUE, etc.) ----
    // Only update state. NEVER touch original_started_at / started_at here —
    // previously every renewal overwrote them, which made long-time app
    // supporters' "since" month slide forward every month.
    ({ error } = await supabase
      .from('supporters')
      .update({
        user_id: userId,
        revenuecat_user_id: userId,
        stripe_price_id: productId,
        status,
        payment_type: meta.type,
        amount_dollars: meta.amount,
        canceled_at: canceledAt,
      })
      .eq('stripe_subscription_id', originalTransactionId));
  } else {
    // ---- New subscription or tip: work out tenure (90-day grace) ----
    // Same rule as stripe-webhook.js: if this person has an earlier monthly
    // supporter row that's still active or was canceled within 90 days, keep
    // its original_started_at. This covers someone moving from web (Stripe)
    // to the app, or resubscribing in the app.
    let originalStartedAt = purchasedAt;
    if (meta.type === 'monthly') {
      try {
        originalStartedAt = await findPreservedTenure(supabase, userId, purchasedAt);
      } catch (e) {
        // Tenure is cosmetic — never fail the purchase over it.
        console.warn('[rc-webhook] tenure lookup failed, using purchase date:', e.message);
      }
    }

    ({ error } = await supabase
      .from('supporters')
      .upsert({
        user_id: userId,
        source: 'revenuecat',
        revenuecat_user_id: userId,
        stripe_customer_id: null,                      // not applicable on native
        stripe_subscription_id: originalTransactionId, // reused field
        stripe_price_id: productId,                    // reused field — store product ID
        status,
        payment_type: meta.type,
        amount_dollars: meta.amount,
        original_started_at: originalStartedAt,
        started_at: purchasedAt,
        canceled_at: canceledAt,
        // Optional analytic fields if your schema includes them:
        // current_period_end: expirationAt,
        // last_payment_cents: priceCents,
      }, {
        onConflict: 'stripe_subscription_id',
      }));
  }

  if (error) {
    console.error('[rc-webhook] supabase upsert failed:', error);
    return res.status(500).json({ error: 'Could not save supporter row' });
  }

  console.log('[rc-webhook] processed:', eventType, productId, 'for user', userId.slice(0, 8) + '...');
  return res.status(200).json({ ok: true });
}

// ============================================================================
// TENURE LOOKUP (90-day grace, mirrors stripe-webhook.js)
// ----------------------------------------------------------------------------
// Finds the earliest original_started_at among this person's prior MONTHLY
// supporter rows that still qualify: status active/trialing/past_due, or
// canceled within 90 days. Matches by user_id, and also by the account's
// email — web (Stripe) rows sometimes have an email but no user_id, and
// native rows have a user_id but no email.
// ============================================================================
const TENURE_GRACE_MS = 90 * 24 * 60 * 60 * 1000;

async function findPreservedTenure(supabase, userId, fallbackIso) {
  const rows = [];

  const { data: byUser, error: userErr } = await supabase
    .from('supporters')
    .select('original_started_at, canceled_at, status, payment_type')
    .eq('user_id', userId)
    .eq('payment_type', 'monthly');
  if (userErr) throw userErr;
  if (byUser) rows.push(...byUser);

  // Look up the account email so we can catch email-only Stripe rows.
  try {
    const { data: authData } = await supabase.auth.admin.getUserById(userId);
    const email = authData?.user?.email?.toLowerCase();
    if (email) {
      const { data: byEmail, error: emailErr } = await supabase
        .from('supporters')
        .select('original_started_at, canceled_at, status, payment_type')
        .ilike('email', email)
        .eq('payment_type', 'monthly');
      if (!emailErr && byEmail) rows.push(...byEmail);
    }
  } catch (e) {
    console.warn('[rc-webhook] could not read account email for tenure:', e.message);
  }

  const now = Date.now();
  let earliest = null;
  for (const r of rows) {
    if (!r.original_started_at) continue;
    const canceledMs = r.canceled_at ? new Date(r.canceled_at).getTime() : null;
    const qualifies =
      ['active', 'trialing', 'past_due'].includes(r.status) ||
      (canceledMs != null && now - canceledMs <= TENURE_GRACE_MS);
    if (!qualifies) continue;
    const startedMs = new Date(r.original_started_at).getTime();
    if (earliest == null || startedMs < earliest) earliest = startedMs;
  }

  if (earliest != null && earliest < new Date(fallbackIso).getTime()) {
    const preserved = new Date(earliest).toISOString();
    console.log(`[rc-webhook] preserving tenure for user ${userId.slice(0, 8)}... since ${preserved}`);
    return preserved;
  }
  return fallbackIso;
}

// Vercel needs the raw body for some webhook signature schemes, but RC uses
// Authorization header verification, not body signature — so we can let
// Vercel parse the JSON normally.
export const config = {
  api: {
    bodyParser: true,
  },
};

// ============================================================================
// SCAN PACK PURCHASE HANDLER
// ----------------------------------------------------------------------------
// When a user purchases a scan pack (consumable), credit their scan_usage row
// with the appropriate number of scans. Idempotent on original_transaction_id —
// if RevenueCat retries the webhook, we don't double-credit.
//
// Schema we touch:
//   scan_usage (user_id, month, free_used, extra_remaining)
//   scan_pack_purchases (idempotency table — see below)
//
// Idempotency: Apple/RC can resend NON_RENEWING_PURCHASE events. We keep a
// scan_pack_purchases table keyed by transaction_id to detect replays.
// ============================================================================
async function handleScanPackPurchase(res, userId, productId, originalTransactionId) {
  const scansToAdd = SCAN_PACK_SCAN_COUNTS[productId];
  if (!scansToAdd) {
    console.error('[rc-webhook] unknown scan pack product:', productId);
    return res.status(400).json({ error: 'Unknown scan pack' });
  }

  const supabase = getSupabaseAdmin();

  // ---- Idempotency check ----
  // Insert into scan_pack_purchases with unique constraint on transaction_id.
  // If insert fails due to unique violation, this is a replay — return 200.
  const { error: dedupeErr } = await supabase
    .from('scan_pack_purchases')
    .insert({
      user_id: userId,
      transaction_id: originalTransactionId,
      product_id: productId,
      scans_purchased: scansToAdd,
      source: 'revenuecat',
    });

  if (dedupeErr) {
    // Postgres unique violation code is 23505
    if (dedupeErr.code === '23505') {
      console.log('[rc-webhook] scan pack already processed:', originalTransactionId);
      return res.status(200).json({ ok: true, dedup: true });
    }
    console.error('[rc-webhook] scan_pack_purchases insert failed:', dedupeErr);
    return res.status(500).json({ error: 'Idempotency check failed' });
  }

  // ---- Credit the user's scan_usage row for current month ----
  const month = firstOfMonthUTC();

  // Read current row (if any) to know what to add to.
  const { data: usageRow } = await supabase
    .from('scan_usage')
    .select('free_used, extra_remaining')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle();

  // If no current-month row, carry forward extra_remaining from most recent prior month.
  let currentExtra = usageRow?.extra_remaining;
  if (currentExtra == null) {
    const { data: priorRow } = await supabase
      .from('scan_usage')
      .select('extra_remaining')
      .eq('user_id', userId)
      .gt('extra_remaining', 0)
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle();
    currentExtra = priorRow?.extra_remaining || 0;
  }

  const { error: upsertErr } = await supabase
    .from('scan_usage')
    .upsert({
      user_id: userId,
      month,
      free_used: usageRow?.free_used || 0,
      extra_remaining: currentExtra + scansToAdd,
    }, { onConflict: 'user_id,month' });

  if (upsertErr) {
    console.error('[rc-webhook] scan_usage credit failed:', upsertErr);
    // We already wrote to scan_pack_purchases — manual reconciliation may be needed.
    // Returning 500 will trigger RC retry; the dedupe check will catch the replay.
    return res.status(500).json({ error: 'Credit failed' });
  }

  console.log(`[rc-webhook] credited ${scansToAdd} scans to user ${userId.slice(0, 8)}...`);
  return res.status(200).json({ ok: true, scans_credited: scansToAdd });
}

function firstOfMonthUTC(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}
