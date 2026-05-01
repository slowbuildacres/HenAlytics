// ============================================================================
// SYNC LAYER (Stage 4)
// ----------------------------------------------------------------------------
// Each user belongs to one or more homesteads via the homestead_members table.
// In v1 of farmhand sharing we assume one homestead per user — they're the
// owner of their own, and may also be a member of someone else's.
// For now we always operate on the user's "primary" homestead, which is:
//   - The first homestead they own (if they own any), or
//   - The first homestead they're a member of (if they don't own one).
//
// Photos go to Supabase Storage. Files are pathed by USER ID (not homestead),
// because Storage RLS uses auth.uid() to enforce per-user folders. Every member
// of a homestead can see every photo path stored in the data blob — that's by
// design. The path itself reveals only the uploader's user ID.
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase.js';

const STORAGE_KEY = 'homestead_data_v1';
const HOMESTEAD_ID_KEY = 'homestead_active_id_v1';

// ============================================================================
// LOCAL STORAGE HELPERS
// ============================================================================

export function readLocalHomestead() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? JSON.parse(v) : null;
  } catch (e) {
    return null;
  }
}

function writeLocalHomestead(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Local save failed', e);
  }
}

export function clearLocalHomestead() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(HOMESTEAD_ID_KEY);
  } catch (e) {}
}

function readActiveHomesteadId() {
  try { return localStorage.getItem(HOMESTEAD_ID_KEY) || null; } catch (e) { return null; }
}

function writeActiveHomesteadId(id) {
  try { localStorage.setItem(HOMESTEAD_ID_KEY, id); } catch (e) {}
}

// ============================================================================
// HOMESTEAD DISCOVERY / CREATION
// ============================================================================

// Find or create the user's primary homestead. Returns { id, role }.
// If they own none and aren't a member of any, creates a new one.
async function ensureHomestead(userId) {
  // Check membership
  const { data: memberships, error: mErr } = await supabase
    .from('homestead_members')
    .select('homestead_id, role')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });

  if (mErr) {
    console.error('Membership lookup failed', mErr);
    throw mErr;
  }

  if (memberships && memberships.length > 0) {
    // Prefer a homestead they own
    const owned = memberships.find((m) => m.role === 'owner');
    const chosen = owned || memberships[0];
    return { id: chosen.homestead_id, role: chosen.role };
  }

  // No memberships — create a brand-new homestead and make them owner
  const { data: created, error: cErr } = await supabase
    .from('homesteads')
    .insert({ data: {} })
    .select()
    .single();

  if (cErr) {
    console.error('Homestead create failed', cErr);
    throw cErr;
  }

  const { error: jErr } = await supabase
    .from('homestead_members')
    .insert({ homestead_id: created.id, user_id: userId, role: 'owner' });

  if (jErr) {
    console.error('Initial owner insert failed', jErr);
    throw jErr;
  }

  return { id: created.id, role: 'owner' };
}

// ============================================================================
// CLOUD READ / WRITE
// ============================================================================

async function readCloudHomestead(homesteadId) {
  const { data, error } = await supabase
    .from('homesteads')
    .select('data')
    .eq('id', homesteadId)
    .maybeSingle();

  if (error) {
    console.error('Cloud read failed', error);
    throw error;
  }
  return data ? data.data : null;
}

async function writeCloudHomestead(homesteadId, data) {
  const { error } = await supabase
    .from('homesteads')
    .update({ data, updated_at: new Date().toISOString() })
    .eq('id', homesteadId);

  if (error) {
    console.error('Cloud save failed', error);
    throw error;
  }
}

// ============================================================================
// PUBLIC LOAD / SAVE API
// ============================================================================

// Load homestead data. Returns { source, data, homesteadId, role }
//   source = "cloud"        — got existing data from cloud
//   source = "cloud-empty"  — homestead exists but data is empty
//   source = "local"        — signed out, loaded from localStorage
export async function loadHomestead(user) {
  if (user && isSupabaseConfigured) {
    try {
      const { id, role } = await ensureHomestead(user.id);
      writeActiveHomesteadId(id);
      const cloud = await readCloudHomestead(id);
      const hasContent = cloud && Object.keys(cloud).length > 0;
      if (hasContent) {
        writeLocalHomestead(cloud);
        return { source: 'cloud', data: cloud, homesteadId: id, role };
      }
      return { source: 'cloud-empty', data: null, homesteadId: id, role };
    } catch (e) {
      console.warn('Falling back to local cache after cloud error', e);
      return { source: 'local', data: readLocalHomestead() };
    }
  }
  return { source: 'local', data: readLocalHomestead() };
}

// Save homestead data. Writes both cloud (if signed in) and local cache.
export async function saveHomestead(user, data) {
  writeLocalHomestead(data);

  if (user && isSupabaseConfigured) {
    try {
      const homesteadId = readActiveHomesteadId();
      if (!homesteadId) {
        // No cached id — discover it. Rare; happens if storage was cleared.
        const { id } = await ensureHomestead(user.id);
        writeActiveHomesteadId(id);
        await writeCloudHomestead(id, data);
      } else {
        await writeCloudHomestead(homesteadId, data);
      }
      return { ok: true, location: 'cloud' };
    } catch (e) {
      return { ok: false, location: 'local', error: e };
    }
  }
  return { ok: true, location: 'local' };
}

// ============================================================================
// FARMHAND MANAGEMENT
// ============================================================================

// Returns the list of members in the user's primary homestead.
// Each member: { user_id, role, email, joined_at }
export async function listMembers(user) {
  if (!user || !isSupabaseConfigured) return [];
  const homesteadId = readActiveHomesteadId();
  if (!homesteadId) return [];

  const { data, error } = await supabase
    .from('homestead_members')
    .select('user_id, role, joined_at')
    .eq('homestead_id', homesteadId);

  if (error) {
    console.error('Member list failed', error);
    return [];
  }

  // We can't directly query auth.users from the client, but we can get our own
  // user's email. For other members we show a partial label.
  return (data || []).map((m) => ({
    ...m,
    email: m.user_id === user.id ? user.email : null,
    isYou: m.user_id === user.id,
  }));
}

// Returns pending invites for the user's homestead.
export async function listPendingInvites(user) {
  if (!user || !isSupabaseConfigured) return [];
  const homesteadId = readActiveHomesteadId();
  if (!homesteadId) return [];

  const { data, error } = await supabase
    .from('pending_invites')
    .select('id, invited_email, invite_code, created_at, expires_at, accepted_at')
    .eq('homestead_id', homesteadId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Invite list failed', error);
    return [];
  }
  return data || [];
}

// Create a farmhand invite. Returns the invite code so we can email it.
export async function createInvite(user, email) {
  if (!user || !isSupabaseConfigured) throw new Error('Sign in first');
  const homesteadId = readActiveHomesteadId();
  if (!homesteadId) throw new Error('No active homestead');

  const trimmed = (email || '').trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) {
    throw new Error('Please enter a valid email address');
  }

  const { data, error } = await supabase
    .from('pending_invites')
    .insert({
      homestead_id: homesteadId,
      invited_email: trimmed,
      invited_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Invite create failed', error);
    throw new Error(error.message || 'Could not create invite');
  }
  return data;
}

// Cancel a pending invite.
export async function cancelInvite(inviteId) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('pending_invites')
    .delete()
    .eq('id', inviteId);
  if (error) throw error;
}

// Accept an invite by code. Adds the current user as a member of the
// invite's homestead. Should be called after sign-in.
// Uses a SECURITY DEFINER function so the lookup, validation, and insert
// happen atomically and bypass RLS quirks.
export async function acceptInvite(user, inviteCode) {
  if (!user || !isSupabaseConfigured) throw new Error('Sign in first');

  const { data, error } = await supabase.rpc('accept_invite_by_code', {
    p_code: inviteCode,
  });

  if (error) {
    // The function raises useful messages — surface them
    const msg = error.message || '';
    if (msg.includes('different email')) {
      throw new Error("This invite is for a different email address than the one you signed in with.");
    }
    if (msg.includes('expired')) {
      throw new Error('This invite has expired.');
    }
    if (msg.includes('already been used')) {
      throw new Error('This invite was already used.');
    }
    if (msg.includes('not found')) {
      throw new Error('This invite was not found. Check the link or ask for a new invitation.');
    }
    throw new Error(msg || 'Could not accept invite');
  }

  const homesteadId = data;

  // Switch their active homestead to the one they just joined
  writeActiveHomesteadId(homesteadId);
  // Clear local cache so the joined homestead's data loads fresh
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}

  return homesteadId;
}

// Remove a member (kick a farmhand, or leave). Owner-only for kicking; anyone
// for leaving themselves.
export async function removeMember(homesteadId, userId) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('homestead_members')
    .delete()
    .eq('homestead_id', homesteadId)
    .eq('user_id', userId);
  if (error) throw error;
}

// Get the active homestead's ID (used by Farmhand UI).
export function getActiveHomesteadId() {
  return readActiveHomesteadId();
}

// ============================================================================
// EMAIL via /api/send-email (Vercel serverless function)
// ============================================================================

async function sendEmail(payload) {
  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Email send failed: ${res.status} ${err}`);
  }
  return res.json();
}

export function sendFeedback({ category, message, fromEmail }) {
  return sendEmail({ kind: 'feedback', category, message, fromEmail });
}

export function notifySignup({ newUserEmail }) {
  return sendEmail({ kind: 'signup_notify', newUserEmail });
}

export function sendFarmhandInvite({ inviteEmail, inviterEmail, homesteadName, inviteCode, baseUrl }) {
  const inviteLink = `${baseUrl}/?invite=${encodeURIComponent(inviteCode)}`;
  return sendEmail({
    kind: 'farmhand_invite',
    inviteEmail,
    inviterEmail,
    homesteadName,
    inviteLink,
  });
}

// ============================================================================
// PHOTO UPLOADS  (unchanged from Stage 3)
// ============================================================================

export async function compressImage(file, maxDim = 1600, quality = 0.85) {
  const img = await fileToImage(file);

  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round(height * (maxDim / width));
      width = maxDim;
    } else {
      width = Math.round(width * (maxDim / height));
      height = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
      'image/jpeg',
      quality
    );
  });
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export async function uploadPhoto(user, entryId, file) {
  if (!user || !isSupabaseConfigured) {
    throw new Error('You must be signed in to upload photos.');
  }

  const blob = await compressImage(file);
  const random = Math.random().toString(36).slice(2, 8);
  const path = `${user.id}/${entryId}-${random}.jpg`;

  const { error } = await supabase.storage
    .from('photos')
    .upload(path, blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
    });

  if (error) {
    console.error('Photo upload failed', error);
    throw error;
  }

  return path;
}

export async function getPhotoUrl(path) {
  if (!path || !isSupabaseConfigured) return null;
  const { data, error } = await supabase.storage
    .from('photos')
    .createSignedUrl(path, 3600);
  if (error) {
    console.warn('Signed URL failed', error);
    return null;
  }
  return data.signedUrl;
}

export async function deletePhoto(path) {
  if (!path || !isSupabaseConfigured) return;
  await supabase.storage.from('photos').remove([path]);
}
