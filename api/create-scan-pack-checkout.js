// Vercel serverless function: POST /api/create-scan-pack-checkout
//
// Creates a Stripe Checkout Session for a scan pack purchase. Mirrors the
// pattern your existing create-checkout-session.js uses for supporter subs,
// but for one-time scan pack purchases.
//
// Auth: requires Supabase JWT.
//
// Request body:
//   { pack: '10' | '30' }
//
// Response:
//   { url: 'https://checkout.stripe.com/...' }
//
// The client redirects the user to the returned URL. On success, Stripe sends
// checkout.session.completed to /api/stripe-webhook, which credits scan_usage.

import { createClient } from '@supabase/supabase-js';
import { getCorsOrigin } from './_cors.js';

const PACK_TO_PRICE_ENV = {
  '10': 'STRIPE_PRICE_SCAN_PACK_10',
  '30': 'STRIPE_PRICE_SCAN_PACK_30',
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

async function getUserFromAuthHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export default async function handler(req, res) {
  // ---- CORS ----
  const corsOrigin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getUserFromAuthHeader(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const pack = String(body?.pack || '');
  const priceEnvVar = PACK_TO_PRICE_ENV[pack];
  if (!priceEnvVar) {
    return res.status(400).json({ error: 'Invalid pack — must be "10" or "30"' });
  }

  const priceId = process.env[priceEnvVar];
  if (!priceId) {
    console.error(`[create-scan-pack-checkout] ${priceEnvVar} not configured`);
    return res.status(500).json({ error: 'Checkout not configured' });
  }

  // Build the success/cancel URLs based on the request origin
  const origin = req.headers.origin || req.headers.referer || 'https://henalytics.com';
  const cleanOrigin = origin.replace(/\/$/, '');

  // ---- Create Stripe Checkout Session ----
  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('line_items[0][price]', priceId);
  params.append('line_items[0][quantity]', '1');
  params.append('client_reference_id', user.id);
  params.append('customer_email', user.email || '');
  params.append('metadata[type]', 'scan_pack');
  params.append('metadata[pack]', pack);
  params.append('metadata[user_id]', user.id);
  params.append('success_url', `${cleanOrigin}/?scan_pack_success=1`);
  params.append('cancel_url', `${cleanOrigin}/?scan_pack_canceled=1`);

  try {
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!stripeRes.ok) {
      const errText = await stripeRes.text();
      console.error('[create-scan-pack-checkout] Stripe error:', stripeRes.status, errText);
      return res.status(500).json({ error: 'Could not create checkout' });
    }

    const session = await stripeRes.json();
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('[create-scan-pack-checkout] error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
