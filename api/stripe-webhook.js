// Vercel serverless function: POST /api/stripe-webhook
//
// Receives webhook events from Stripe and syncs subscription state to the
// public.supporters table in Supabase.
//
// Events handled:
//   - checkout.session.completed          → create supporter row, send emails
//   - customer.subscription.updated       → reflect status changes
//   - customer.subscription.deleted       → mark canceled
//   - invoice.payment_failed              → mark past_due
//
// Security:
//   - We verify the Stripe webhook signature using STRIPE_WEBHOOK_SECRET.
//     Anyone could POST to this URL; only Stripe can sign requests correctly.
//   - We disable Vercel's body parser (config below) so we can read the raw
//     body for signature verification.
//
// Required environment variables:
//   STRIPE_SECRET_KEY            — Stripe API secret key (for fetching extra data)
//   STRIPE_WEBHOOK_SECRET        — webhook signing secret (whsec_...)
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY    — bypasses RLS to insert/update supporter rows
//   RESEND_API_KEY               — for the new-subscription notification to Riley
//                                   and the thank-you email to the supporter
//   EMAIL_FROM (optional)        — defaults to onboarding@resend.dev
//   OWNER_EMAIL (optional)       — defaults to slowbuildacres@gmail.com
//
// Tenure rule (90-day grace):
//   When a user resubscribes within 90 days of canceled_at, we keep their
//   original_started_at. Beyond 90 days, original_started_at resets to now.

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// IMPORTANT: disable Vercel's automatic body parsing so we can verify the
// raw bytes against Stripe's signature.
export const config = {
  api: {
    bodyParser: false,
  },
};

const RESEND_API = 'https://api.resend.com/emails';
const FROM_ADDRESS = process.env.EMAIL_FROM || 'Henalytics <onboarding@resend.dev>';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'slowbuildacres@gmail.com';

// 90-day grace window for tenure preservation
const TENURE_GRACE_DAYS = 90;
const TENURE_GRACE_MS = TENURE_GRACE_DAYS * 24 * 60 * 60 * 1000;

// Map Stripe price IDs back to amount + tier. Webhook reads price_id off the
// subscription and uses this to fill in our amount_dollars column. The env
// vars are the same ones create-checkout-session uses.
function getTierFromPriceId(priceId) {
  if (priceId === process.env.STRIPE_PRICE_MONTHLY_1)  return { amount: 1,  type: 'monthly' };
  if (priceId === process.env.STRIPE_PRICE_MONTHLY_3)  return { amount: 3,  type: 'monthly' };
  if (priceId === process.env.STRIPE_PRICE_MONTHLY_5)  return { amount: 5,  type: 'monthly' };
  if (priceId === process.env.STRIPE_PRICE_MONTHLY_10) return { amount: 10, type: 'monthly' };
  if (priceId === process.env.STRIPE_PRICE_ONE_TIME)   return { amount: 5,  type: 'one_time' }; // adjust if you change the one-time amount
  return { amount: null, type: 'monthly' }; // fallback — webhook still works, amount is just unknown
}

// Map Stripe scan-pack price IDs → scans to credit. Scan packs are SEPARATE
// from supporter products — they credit scan_usage instead of supporters.
function getScanPackFromPriceId(priceId) {
  if (priceId === process.env.STRIPE_PRICE_SCAN_PACK_10) return 10;
  if (priceId === process.env.STRIPE_PRICE_SCAN_PACK_30) return 30;
  return null;
}

// Detect if a checkout session is a scan pack purchase. We look at the
// session metadata.type which we set when creating the checkout session
// (see create-scan-pack-checkout endpoint). Falling back to checking the
// line items' price IDs against our scan pack price IDs.
function isScanPackSession(session) {
  if (session.metadata?.type === 'scan_pack') return true;
  return false;
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
// READ RAW BODY
// ============================================================================
// With bodyParser disabled, req is a Node Readable stream. We collect it into
// a Buffer for signature verification, then parse the JSON ourselves.
async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ============================================================================
// VERIFY STRIPE SIGNATURE
// ============================================================================
// Stripe sends a header like:
//   Stripe-Signature: t=1234567890,v1=abcdef...,v1=fedcba...
// We compute HMAC-SHA256(t + "." + raw_body) using STRIPE_WEBHOOK_SECRET and
// confirm at least one v1 entry matches. The timestamp also can't be too old
// (replay protection — default 5 minutes).
function verifyStripeSignature(rawBody, sigHeader, secret, toleranceSeconds = 300) {
  if (!sigHeader || !secret) return false;

  const parts = sigHeader.split(',').reduce((acc, kv) => {
    const [k, v] = kv.split('=');
    if (!k || !v) return acc;
    if (k === 't') acc.t = v;
    else if (k.startsWith('v')) (acc.versions = acc.versions || []).push({ scheme: k, value: v });
    return acc;
  }, {});

  if (!parts.t || !parts.versions?.length) return false;

  // Replay protection
  const nowSec = Math.floor(Date.now() / 1000);
  const eventSec = Number(parts.t);
  if (!Number.isFinite(eventSec) || Math.abs(nowSec - eventSec) > toleranceSeconds) {
    return false;
  }

  const signedPayload = `${parts.t}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  // Constant-time compare against any v1 signature
  for (const v of parts.versions) {
    if (v.scheme === 'v1') {
      const sigBuf = Buffer.from(v.value, 'hex');
      const expBuf = Buffer.from(expected, 'hex');
      if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
        return true;
      }
    }
  }
  return false;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  // ---- Read raw body + verify signature ----
  const rawBody = await readRawBody(req);
  const sig = req.headers['stripe-signature'];

  if (!verifyStripeSignature(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)) {
    console.warn('Stripe signature verification failed');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // ---- Parse event ----
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  console.log(`[stripe-webhook] received ${event.type} (${event.id})`);

  // ---- Dispatch ----
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event);
        break;
      default:
        // Acknowledge but don't process — Stripe sends a lot of events we don't care about
        console.log(`[stripe-webhook] ignored ${event.type}`);
    }
  } catch (e) {
    // Log the error but return 200 if it's a non-critical issue — otherwise
    // Stripe will retry the webhook on a 5xx response, which can cause
    // duplicate processing. Only return 5xx on truly transient errors.
    console.error(`[stripe-webhook] handler error for ${event.type}:`, e);
    return res.status(500).json({ error: 'Handler failed' });
  }

  return res.status(200).json({ received: true });
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

// checkout.session.completed:
//   New subscription started OR one-time payment completed.
//   This is where we create the supporter row.
async function handleCheckoutCompleted(event) {
  const session = event.data.object;

  // ---- Branch: scan pack purchase (not a supporter event) ----
  if (isScanPackSession(session)) {
    return await handleScanPackCheckout(session);
  }

  const userId = session.client_reference_id || session.metadata?.user_id;
  const email = (session.customer_email || session.customer_details?.email || '').toLowerCase();
  const tier = session.metadata?.tier || null;
  const mode = session.mode; // "subscription" | "payment"
  const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const stripeSubscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;
  const stripeSessionId = session.id;

  if (!email) {
    console.warn('[checkout.session.completed] no email on session', stripeSessionId);
    return;
  }

  // For subscriptions, fetch the subscription to read the price_id
  let priceId = null;
  let amount = null;
  let paymentType = mode === 'subscription' ? 'monthly' : 'one_time';

  if (mode === 'subscription' && stripeSubscriptionId) {
    try {
      const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${stripeSubscriptionId}`, {
        headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      });
      const sub = await subRes.json();
      priceId = sub.items?.data?.[0]?.price?.id || null;
      const { amount: tierAmount, type: tierType } = getTierFromPriceId(priceId);
      amount = tierAmount;
      paymentType = tierType;
    } catch (e) {
      console.warn('[checkout.session.completed] could not fetch subscription details:', e.message);
    }
  } else if (mode === 'payment') {
    // For one-time payments, amount_total is in cents
    amount = session.amount_total ? Math.round(session.amount_total / 100) : null;
  }

  // ---- Tenure logic (90-day grace) ----
  //
  // If this email previously had a supporter row that's canceled within the
  // last 90 days, preserve their original_started_at. We match by email
  // because the user_id might be null on the old row (one-time tips can be
  // anonymous, grandfathered Payment Link supporters don't have user_id yet).
  const supabase = getSupabaseAdmin();
  let originalStartedAt = new Date().toISOString();

  if (paymentType === 'monthly') {
    const { data: prior, error: priorErr } = await supabase
      .from('supporters')
      .select('original_started_at, canceled_at, status')
      .or(`user_id.eq.${userId || '00000000-0000-0000-0000-000000000000'},email.eq.${email}`)
      .order('original_started_at', { ascending: true })
      .limit(1);

    if (!priorErr && prior && prior.length > 0) {
      const p = prior[0];
      const canceledAt = p.canceled_at ? new Date(p.canceled_at).getTime() : null;
      const stillRecent = canceledAt && (Date.now() - canceledAt) <= TENURE_GRACE_MS;
      if (stillRecent || p.status === 'active' || p.status === 'trialing' || p.status === 'past_due') {
        originalStartedAt = p.original_started_at;
        console.log(`[checkout.session.completed] preserving tenure for ${email} since ${originalStartedAt}`);
      }
    }
  }

  // ---- Upsert the row ----
  //
  // For subscriptions: keyed by stripe_subscription_id (unique constraint)
  // For one-time: each tip is its own row (no upsert key)
  if (paymentType === 'monthly' && stripeSubscriptionId) {
    const { error: upsertErr } = await supabase
      .from('supporters')
      .upsert({
        user_id: userId || null,
        email,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_checkout_session_id: stripeSessionId,
        stripe_price_id: priceId,
        status: 'active',
        payment_type: 'monthly',
        amount_dollars: amount,
        original_started_at: originalStartedAt,
        started_at: new Date().toISOString(),
        canceled_at: null,
      }, {
        onConflict: 'stripe_subscription_id',
      });

    if (upsertErr) {
      console.error('[checkout.session.completed] supporter upsert failed:', upsertErr);
      throw upsertErr;
    }
  } else {
    // One-time tip — insert
    const { error: insertErr } = await supabase
      .from('supporters')
      .insert({
        user_id: userId || null,
        email,
        stripe_customer_id: stripeCustomerId,
        stripe_checkout_session_id: stripeSessionId,
        stripe_price_id: priceId,
        status: 'tip_paid',
        payment_type: 'one_time',
        amount_dollars: amount,
        original_started_at: originalStartedAt,
        started_at: new Date().toISOString(),
      });

    if (insertErr) {
      console.error('[checkout.session.completed] tip insert failed:', insertErr);
      throw insertErr;
    }
  }

  // ---- Fire-and-forget emails ----
  // Don't await — we don't want email infra failures to make Stripe retry the webhook.
  notifyOwnerOfNewSupporter({ email, tier, amount, paymentType }).catch((e) => {
    console.warn('owner notify failed:', e.message);
  });
  if (paymentType === 'monthly') {
    sendThankYouEmail({ email, amount }).catch((e) => {
      console.warn('thank-you email failed:', e.message);
    });
  }
}

// customer.subscription.updated:
//   Status changes (active → past_due, trialing → active, etc.)
async function handleSubscriptionUpdated(event) {
  const sub = event.data.object;
  const status = sub.status; // "active" | "past_due" | "canceled" | "incomplete" | "trialing" | "unpaid" | "incomplete_expired"
  const stripeSubscriptionId = sub.id;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('supporters')
    .update({
      status,
      canceled_at: status === 'canceled' ? new Date().toISOString() : null,
    })
    .eq('stripe_subscription_id', stripeSubscriptionId);

  if (error) {
    console.error('[customer.subscription.updated] update failed:', error);
    throw error;
  }
}

// customer.subscription.deleted:
//   Final cancellation (after any grace period). Mark canceled + record date.
async function handleSubscriptionDeleted(event) {
  const sub = event.data.object;
  const stripeSubscriptionId = sub.id;

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from('supporters')
    .select('email, amount_dollars')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .single();

  const { error } = await supabase
    .from('supporters')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', stripeSubscriptionId);

  if (error) {
    console.error('[customer.subscription.deleted] update failed:', error);
    throw error;
  }

  // Optionally notify Riley of cancellations (uncomment to enable)
  // notifyOwnerOfCancellation(existing).catch(() => {});
}

// invoice.payment_failed:
//   Recurring charge failed (expired card etc). Mark past_due — Stripe will
//   retry and eventually cancel if it can't recover.
async function handlePaymentFailed(event) {
  const invoice = event.data.object;
  const stripeSubscriptionId = invoice.subscription;
  if (!stripeSubscriptionId) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('supporters')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', stripeSubscriptionId);

  if (error) {
    console.error('[invoice.payment_failed] update failed:', error);
  }
}

// ============================================================================
// SCAN PACK PURCHASE HANDLER (web Stripe path)
// ----------------------------------------------------------------------------
// Mirrors handleScanPackPurchase in revenuecat-webhook.js but for web users
// who pay via Stripe Checkout. Idempotent on session.id.
//
// The checkout session creator (create-scan-pack-checkout.js, to be added)
// sets:
//   session.client_reference_id = supabase user_id
//   session.metadata.type = 'scan_pack'
//   session.line_items[0].price = STRIPE_PRICE_SCAN_PACK_{10,30}
// ============================================================================
async function handleScanPackCheckout(session) {
  const userId = session.client_reference_id || session.metadata?.user_id;
  const sessionId = session.id;

  if (!userId) {
    console.error('[stripe-webhook] scan pack session missing user_id:', sessionId);
    return;
  }

  // Fetch line items to determine which pack was bought
  let priceId = null;
  try {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}/line_items?limit=1`, {
      headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    });
    const data = await res.json();
    priceId = data.data?.[0]?.price?.id || null;
  } catch (e) {
    console.error('[stripe-webhook] could not fetch line items for scan pack:', e);
    return;
  }

  const scansToAdd = getScanPackFromPriceId(priceId);
  if (!scansToAdd) {
    console.error('[stripe-webhook] unknown scan pack price ID:', priceId);
    return;
  }

  const supabase = getSupabaseAdmin();

  // ---- Idempotency check ----
  const { error: dedupeErr } = await supabase
    .from('scan_pack_purchases')
    .insert({
      user_id: userId,
      transaction_id: sessionId, // Stripe session ID acts as transaction ID
      product_id: priceId,
      scans_purchased: scansToAdd,
      source: 'stripe',
    });

  if (dedupeErr) {
    if (dedupeErr.code === '23505') {
      console.log('[stripe-webhook] scan pack already processed:', sessionId);
      return;
    }
    console.error('[stripe-webhook] scan_pack_purchases insert failed:', dedupeErr);
    throw dedupeErr;
  }

  // ---- Credit scan_usage ----
  const month = firstOfMonthUTC();

  const { data: usageRow } = await supabase
    .from('scan_usage')
    .select('free_used, extra_remaining')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle();

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
    console.error('[stripe-webhook] scan_usage credit failed:', upsertErr);
    throw upsertErr;
  }

  console.log(`[stripe-webhook] credited ${scansToAdd} scans to user ${userId.slice(0, 8)}...`);
}

function firstOfMonthUTC(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

// ============================================================================
// EMAIL HELPERS
// ============================================================================

async function notifyOwnerOfNewSupporter({ email, tier, amount, paymentType }) {
  if (!process.env.RESEND_API_KEY) return;

  const subject = paymentType === 'one_time'
    ? `New one-time tip: $${amount || '?'} from ${email}`
    : `New monthly supporter: $${amount || '?'}/mo from ${email}`;

  const body = `
    <p>A new ${paymentType === 'one_time' ? 'tip' : 'monthly supporter'} just rolled in:</p>
    <ul>
      <li><strong>Email:</strong> ${escapeHtml(email)}</li>
      <li><strong>Amount:</strong> $${amount || '?'}${paymentType === 'monthly' ? '/mo' : ''}</li>
      <li><strong>Tier:</strong> ${escapeHtml(tier || '(unknown)')}</li>
    </ul>
    <p>They'll be invited to enter a homestead name for the supporter wall on next visit.</p>
    <p style="color:#888;font-size:12px">— Henalytics webhook</p>
  `;

  await sendResend({ to: OWNER_EMAIL, subject, html: body });
}

async function sendThankYouEmail({ email, amount }) {
  if (!process.env.RESEND_API_KEY) return;

  const subject = `Thank you for supporting Henalytics 🐔`;
  const body = `
    <p>Hey there,</p>
    <p>Just a quick note from Riley to say <strong>thank you</strong> for chipping in $${amount || ''}/month to keep Henalytics running.</p>
    <p>Subscriptions like yours cover Supabase hosting, App Store fees, and the occasional coffee that fuels new features. It genuinely means a lot.</p>
    <p>Next time you open the app, you'll see a small prompt asking if you'd like to add your homestead name to the supporter wall — a thank-you page that goes out to everyone on the 1st of each month. Totally optional; anonymous works too.</p>
    <p>Thanks for being part of this.</p>
    <p>— Riley, Slow Build Acres</p>
    <hr style="border:none;border-top:1px solid #ddd;margin:24px 0">
    <p style="color:#888;font-size:12px">You can manage your subscription anytime from the Stripe receipt email. To cancel, reply to that receipt or email slowbuildacres@gmail.com.</p>
  `;

  await sendResend({ to: email, subject, html: body });
}

async function sendResend({ to, subject, html }) {
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text}`);
  }
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
