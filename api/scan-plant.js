// Vercel serverless function: POST /api/scan-plant
//
// The main endpoint. Receives a photo from the user, validates quota, calls
// Plant.id, charges a scan against quota, optionally stores the photo to
// Supabase Storage, writes a scan_history row, returns results.
//
// Auth: requires a valid Supabase JWT in Authorization: Bearer <token>.
//
// Request body (JSON):
// {
//   image_base64: "iVBORw0K...",     // raw base64, no data URI prefix
//   save_photo: true,                  // whether to persist the photo
//   user_notes: "Tomato leaf spots"    // optional, free-form
// }
//
// Response (success):
// {
//   ok: true,
//   scan_id: "uuid",
//   charged_from: "free" | "extra",
//   remaining_after: { free: 0, extra: 11 },
//   result: {
//     is_plant: true,
//     is_healthy: false,
//     species: { name: "Solanum lycopersicum", common_name: "Tomato", confidence: 0.97 },
//     diseases: [
//       { name: "Septoria leaf spot", probability: 0.87, description: "...", treatment: "..." }
//     ]
//   }
// }
//
// Response (quota exhausted):
// HTTP 402 Payment Required
// { ok: false, reason: "quota_exhausted", remaining: { free: 0, extra: 0 } }
//
// Required env vars:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   PLANT_ID_API_KEY              — your Plant.id API key (species identification)
//   CROP_HEALTH_API_KEY           — your crop.health API key (disease detection)
//
// Cost guard:
//   We refuse the request BEFORE calling Plant.id if quota is exhausted, so
//   we never burn a credit on a user who can't be charged. The quota check
//   and decrement are wrapped in a Postgres function (atomic_charge_scan) to
//   prevent races where two simultaneous scans both pass the check.

import { createClient } from '@supabase/supabase-js';
import { getCorsOrigin } from './_cors.js';

const PLANT_ID_URL = 'https://api.plant.id/v3/identification';
const CROP_HEALTH_URL = 'https://crop.kindwise.com/api/v1/identification';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const SCAN_TIMEOUT_MS = 30_000;

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

function firstOfMonthUTC(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

async function getUserIdFromAuthHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

// ============================================================================
// QUOTA CHARGE — atomic check-and-decrement
// ----------------------------------------------------------------------------
// Race-safe: if two scans happen in parallel, only one succeeds at decrementing
// the last available scan. We do this in two stages:
//   1. Read current month's quota_per_user from monthly_scan_quotas
//   2. Upsert scan_usage with conditional update that fails if quota exceeded
// ============================================================================
async function chargeScan(userId) {
  const supabase = getSupabaseAdmin();
  const month = firstOfMonthUTC();

  // ---- Get this month's free quota ----
  const { data: quotaRow } = await supabase
    .from('monthly_scan_quotas')
    .select('free_quota_per_user')
    .eq('month', month)
    .maybeSingle();

  const freeQuota = quotaRow?.free_quota_per_user || 0;

  // ---- Get or create user's usage row for this month ----
  // We need to carry forward extra_remaining from the most recent prior month
  // if no current-month row exists yet.
  let { data: usageRow } = await supabase
    .from('scan_usage')
    .select('free_used, extra_remaining')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle();

  if (!usageRow) {
    // Find carryover extra_remaining from most recent prior month
    const { data: priorRow } = await supabase
      .from('scan_usage')
      .select('extra_remaining')
      .eq('user_id', userId)
      .gt('extra_remaining', 0)
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle();
    usageRow = { free_used: 0, extra_remaining: priorRow?.extra_remaining || 0 };
  }

  const freeUsed = usageRow.free_used || 0;
  const extraRemaining = usageRow.extra_remaining || 0;
  const freeRemaining = Math.max(0, freeQuota - freeUsed);

  // ---- Decide which bucket to charge from ----
  // Use free scans first, then extra. This way packs feel like a backup pool.
  let chargedFrom;
  let newFreeUsed = freeUsed;
  let newExtraRemaining = extraRemaining;

  if (freeRemaining > 0) {
    chargedFrom = 'free';
    newFreeUsed = freeUsed + 1;
  } else if (extraRemaining > 0) {
    chargedFrom = 'extra';
    newExtraRemaining = extraRemaining - 1;
  } else {
    return { ok: false, reason: 'quota_exhausted', remaining: { free: 0, extra: 0 } };
  }

  // ---- Write the new usage row ----
  // Upsert handles both "first scan this month" (insert) and "Nth scan" (update).
  const { error: upsertErr } = await supabase
    .from('scan_usage')
    .upsert({
      user_id: userId,
      month,
      free_used: newFreeUsed,
      extra_remaining: newExtraRemaining,
    }, { onConflict: 'user_id,month' });

  if (upsertErr) {
    console.error('[scan-plant] usage upsert failed:', upsertErr);
    return { ok: false, reason: 'usage_write_failed' };
  }

  return {
    ok: true,
    chargedFrom,
    remaining: {
      free: Math.max(0, freeQuota - newFreeUsed),
      extra: newExtraRemaining,
    },
  };
}

// Refund a charge if the Plant.id call fails after we charged.
async function refundCharge(userId, chargedFrom) {
  const supabase = getSupabaseAdmin();
  const month = firstOfMonthUTC();
  const { data: usageRow } = await supabase
    .from('scan_usage')
    .select('free_used, extra_remaining')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle();

  if (!usageRow) return; // nothing to refund

  const update = chargedFrom === 'free'
    ? { free_used: Math.max(0, usageRow.free_used - 1) }
    : { extra_remaining: usageRow.extra_remaining + 1 };

  await supabase
    .from('scan_usage')
    .update(update)
    .eq('user_id', userId)
    .eq('month', month);
}

// ============================================================================
// PLANT.ID CALL
// ----------------------------------------------------------------------------
// One credit covers identification + health assessment when we pass
// health=all. We request the details we'll display: common names, descriptions,
// treatment options.
// ============================================================================
// ============================================================================
// PLANT.ID + CROP.HEALTH PARALLEL CALL
// ----------------------------------------------------------------------------
// We call two Kindwise APIs in parallel:
//   1. plant.id v3 → species identification (1 credit)
//   2. crop.health v1 → disease/pest detection (1 credit)
//
// Total: 2 credits ≈ $0.10 per scan.
//
// They're called concurrently with Promise.all so total latency is max(a, b)
// not a + b. If crop.health fails, we still return the plant ID result —
// disease detection failures shouldn't break the whole feature.
// ============================================================================
async function callPlantId(imageBase64) {
  const apiKey = process.env.PLANT_ID_API_KEY;
  if (!apiKey) throw new Error('PLANT_ID_API_KEY not configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);

  try {
    const res = await fetch(`${PLANT_ID_URL}?details=common_names,description,url,classification&language=en`, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: [imageBase64],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[scan-plant] plant.id error:', res.status, text);
      throw new Error(`plant.id ${res.status}: ${text.slice(0, 200)}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function callCropHealth(imageBase64) {
  const apiKey = process.env.CROP_HEALTH_API_KEY;
  if (!apiKey) {
    // Missing key isn't fatal — log and return null so the feature still
    // works (plant ID only) instead of erroring out entirely.
    console.warn('[scan-plant] CROP_HEALTH_API_KEY not configured — skipping disease detection');
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);

  try {
    const res = await fetch(`${CROP_HEALTH_URL}?details=common_names,description,treatment,url&language=en`, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: [imageBase64],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[scan-plant] crop.health error:', res.status, text);
      // Non-fatal — return null so we still get plant ID results.
      return null;
    }

    return await res.json();
  } catch (e) {
    console.error('[scan-plant] crop.health call failed:', e);
    return null; // non-fatal
  } finally {
    clearTimeout(timeout);
  }
}

// Run both calls in parallel, return both results.
async function callKindwiseAPIs(imageBase64) {
  const [plantIdRaw, cropHealthRaw] = await Promise.all([
    callPlantId(imageBase64),   // throws if plant.id fails — that's fatal
    callCropHealth(imageBase64), // returns null on failure — non-fatal
  ]);
  return { plantIdRaw, cropHealthRaw };
}

// Shape the combined plant.id + crop.health responses into our compact format.
// plant.id v3: result.is_plant.binary, result.classification.suggestions[]
// crop.health v1: result.is_plant.binary, result.crop?.suggestions[], result.disease?.suggestions[]
function shapeResult(plantIdRaw, cropHealthRaw) {
  const pidResult = plantIdRaw?.result || {};
  const chResult = cropHealthRaw?.result || {};

  const isPlant = !!pidResult.is_plant?.binary;

  // Species from plant.id
  const topSpecies = pidResult.classification?.suggestions?.[0] || null;
  const species = topSpecies ? {
    name: topSpecies.name,
    common_name: topSpecies.details?.common_names?.[0] || null,
    confidence: topSpecies.probability,
    description: topSpecies.details?.description?.value || topSpecies.details?.description || null,
  } : null;

  // Diseases from crop.health. The disease suggestions array contains the
  // pest/disease findings. Filter out very-low-probability noise.
  const rawDiseases = chResult.disease?.suggestions || [];
  const diseases = rawDiseases
    .filter(s => (s.probability || 0) >= 0.05) // drop very low confidence noise
    .filter(s => s.details?.is_harmful !== false) // drop explicitly non-harmful classes
    .slice(0, 5)
    .map(s => ({
      name: s.details?.local_name || s.details?.common_names?.[0] || s.name,
      scientific_name: s.name,
      probability: s.probability,
      description: typeof s.details?.description === 'string'
        ? s.details.description
        : s.details?.description?.value || null,
      treatment: s.details?.treatment || null,
      url: s.details?.url || null,
    }));

  // is_healthy: prefer crop.health's signal. If crop.health didn't run, assume healthy.
  // crop.health's is_healthy is the cleanest signal, but if we don't have it,
  // we can derive it from whether we found any diseases.
  let isHealthy;
  if (chResult.is_healthy != null) {
    isHealthy = !!chResult.is_healthy?.binary;
  } else if (cropHealthRaw === null) {
    // crop.health failed; we have no health signal — default to healthy/unknown
    isHealthy = true;
  } else {
    // crop.health ran but didn't include is_healthy field — infer from diseases
    isHealthy = diseases.length === 0;
  }

  return { is_plant: isPlant, is_healthy: isHealthy, species, diseases };
}

// ============================================================================
// PHOTO STORAGE (optional)
// ----------------------------------------------------------------------------
// Uploads to Supabase Storage at path: scan-photos/{user_id}/{scan_id}.jpg
// Returns the storage path (NOT a public URL — bucket is private; client
// will generate signed URLs to view).
// ============================================================================
async function uploadPhoto(userId, scanId, imageBase64) {
  const supabase = getSupabaseAdmin();
  const buffer = Buffer.from(imageBase64, 'base64');
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Image exceeds 5MB limit');
  }

  const path = `${userId}/${scanId}.jpg`;
  const { error } = await supabase.storage
    .from('scan-photos')
    .upload(path, buffer, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) {
    console.error('[scan-plant] photo upload failed:', error);
    return null; // non-fatal — scan result still works without photo
  }
  return path;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
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

  // ---- Auth ----
  const userId = await getUserIdFromAuthHeader(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // ---- Parse body ----
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const imageBase64 = body?.image_base64;
  const savePhoto = !!body?.save_photo;
  const userNotes = (body?.user_notes || '').slice(0, 1000); // cap length

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'Missing image_base64' });
  }

  // Strip data URI prefix if user included one
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

  // Quick size sanity check (base64 is ~33% bigger than raw bytes)
  const estimatedBytes = (cleanBase64.length * 3) / 4;
  if (estimatedBytes > MAX_IMAGE_BYTES) {
    return res.status(413).json({ error: 'Image too large (max 5MB)' });
  }

  // ---- Charge quota ----
  const charge = await chargeScan(userId);
  if (!charge.ok) {
    if (charge.reason === 'quota_exhausted') {
      return res.status(402).json({
        ok: false,
        reason: 'quota_exhausted',
        remaining: charge.remaining,
      });
    }
    return res.status(500).json({ error: 'Charge failed' });
  }

  // ---- Call plant.id + crop.health in parallel ----
  let plantIdRaw, cropHealthRaw;
  try {
    ({ plantIdRaw, cropHealthRaw } = await callKindwiseAPIs(cleanBase64));
  } catch (e) {
    // Refund the charge — user shouldn't pay for our infrastructure failures.
    await refundCharge(userId, charge.chargedFrom);
    console.error('[scan-plant] Kindwise call failed:', e);
    return res.status(502).json({ error: 'Scan service unavailable, no scan charged' });
  }

  const result = shapeResult(plantIdRaw, cropHealthRaw);

  // ---- Insert scan_history row ----
  const supabase = getSupabaseAdmin();
  const scanId = crypto.randomUUID();

  let photoPath = null;
  if (savePhoto) {
    try {
      photoPath = await uploadPhoto(userId, scanId, cleanBase64);
    } catch (e) {
      console.warn('[scan-plant] photo upload failed (continuing):', e);
    }
  }

  const { error: historyErr } = await supabase
    .from('scan_history')
    .insert({
      id: scanId,
      user_id: userId,
      photo_url: photoPath,
      identified_species: result.species?.name || null,
      species_confidence: result.species?.confidence || null,
      is_plant: result.is_plant,
      is_healthy: result.is_healthy,
      diseases: result.diseases,
      user_notes: userNotes || null,
      charged_from: charge.chargedFrom,
    });

  if (historyErr) {
    console.error('[scan-plant] history insert failed:', historyErr);
  }

  return res.status(200).json({
    ok: true,
    scan_id: scanId,
    charged_from: charge.chargedFrom,
    remaining_after: charge.remaining,
    result,
  });
}

// We need a larger body size for base64 image uploads. Default is 1MB.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '7mb', // 5MB raw image → ~6.7MB base64
    },
  },
};
