import { supabase, isSupabaseConfigured } from './supabase.js';

const STORAGE_KEY = 'homestead_data_v1';
const HOMESTEAD_ID_KEY = 'homestead_active_id_v1';

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

async function ensureHomestead(userId) {
  const cachedId = readActiveHomesteadId();

  const { data: memberships, error: mErr } = await supabase
    .from('homestead_members')
    .select('homestead_id, role, joined_at, homesteads(id, data, updated_at)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });

  if (mErr) {
    console.error('Membership lookup failed', mErr);
    throw mErr;
  }

  if (memberships && memberships.length > 0) {
    const scored = memberships.map((m) => {
      const data = (m.homesteads && m.homesteads.data) || {};
      // Use the same scoring function as the safe-write check so picking a
      // homestead from multiple memberships values the same kinds of data
      // (sales, customers, calendar events, etc.) — not just entries and
      // legacy flock counts.
      const score = scoreData(data);
      return { membership: m, score };
    });

    if (cachedId) {
      const cachedMatch = scored.find((s) => s.membership.homestead_id === cachedId);
      if (cachedMatch && cachedMatch.score > 0) {
        return { id: cachedMatch.membership.homestead_id, role: cachedMatch.membership.role };
      }
    }

    const owned = scored.filter((s) => s.membership.role === 'owner');
    if (owned.length > 0) {
      owned.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(a.membership.joined_at) - new Date(b.membership.joined_at);
      });
      const chosen = owned[0].membership;
      return { id: chosen.homestead_id, role: chosen.role };
    }

    scored.sort((a, b) => b.score - a.score);
    const chosen = scored[0].membership;
    return { id: chosen.homestead_id, role: chosen.role };
  }

  // Generate the new homestead id client-side so we don't need to .select()
  // it back. A SELECT after INSERT would trigger the SELECT RLS policy on
  // homesteads (is_homestead_member), which fails because the user isn't
  // a member yet — the membership row is inserted in the next step below.
  const newHomesteadId = crypto.randomUUID();

  const { error: cErr } = await supabase
    .from('homesteads')
    .insert({ id: newHomesteadId, data: {} });

  if (cErr) {
    console.error('Homestead create failed', cErr);
    throw cErr;
  }

  const { error: jErr } = await supabase
    .from('homestead_members')
    .insert({ homestead_id: newHomesteadId, user_id: userId, role: 'owner' });

  if (jErr) {
    console.error('Initial owner insert failed', jErr);
    throw jErr;
  }

  return { id: newHomesteadId, role: 'owner' };
}

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

function scoreData(data) {
  if (!data || typeof data !== 'object') return 0;
  let score = 0;
  if (typeof data.homesteadName === 'string' && data.homesteadName.trim()) score += 50;
  if (data.entries && typeof data.entries === 'object') {
    for (const arr of Object.values(data.entries)) {
      if (Array.isArray(arr)) score += arr.length;
    }
  }
  if (Array.isArray(data.plantings)) score += data.plantings.length;
  if (Array.isArray(data.hobbies)) {
    for (const h of data.hobbies) {
      if (h && typeof h === 'object') {
        if (h.flockSize > 0) score += 5;
        if (Array.isArray(h.flockHistory)) score += h.flockHistory.length;
        // Legacy single-batch field (pre-multi-batch support) — counts 5
        // for backward compat with old data shapes still in the wild.
        if (h.currentBatch) score += 5;
        // Multi-batch field (added in Push 4b). Each active batch counts the
        // same as the legacy single-batch did, so a finalize that moves a
        // batch from currentBatches[] to archivedBatches[] doesn't change
        // the net score and won't trip the clobber guard.
        if (Array.isArray(h.currentBatches)) score += h.currentBatches.length * 5;
        if (Array.isArray(h.archivedBatches)) {
          // Each archived batch counts the same as the active batch did (5)
          // AND the entries that moved into the archive's finalEntries[] count
          // the same as they did when they lived in data.entries. Without
          // this, finalizing a batch with N entries drops the score by N
          // and trips the clobber guard.
          for (const ab of h.archivedBatches) {
            score += 5;
            if (ab && Array.isArray(ab.finalEntries)) {
              score += ab.finalEntries.length;
            }
          }
        }
        if (h.currentSeason) score += 5;
        if (Array.isArray(h.archivedSeasons)) {
          // Same treatment as archived batches: each archived season counts
          // 5 (like the active one did), plus its absorbed finalEntries[].
          for (const as of h.archivedSeasons) {
            score += 5;
            if (as && Array.isArray(as.finalEntries)) {
              score += as.finalEntries.length;
            }
          }
        }
        // Perennials and their per-plant action/harvest history.
        if (Array.isArray(h.perennials)) {
          score += h.perennials.length;
          for (const p of h.perennials) {
            if (p && typeof p === 'object') {
              if (Array.isArray(p.actions)) score += p.actions.length;
              if (Array.isArray(p.harvests)) score += p.harvests.length;
            }
          }
        }
        // Animal lists for the per-animal hobbies (goats, cows, pigs, sheep,
        // horses, rabbits) — these are core data and need to count toward the
        // clobber-protection score too.
        if (Array.isArray(h.animals)) score += h.animals.length;
        if (Array.isArray(h.flocks)) score += h.flocks.length;
        if (Array.isArray(h.hives)) score += h.hives.length;
        if (Array.isArray(h.brooderBatches)) score += h.brooderBatches.length;
      }
    }
  }
  // Top-level collections that previously weren't counted. Without these,
  // a user could lose every sale, customer, variety, or calendar event
  // without the safe-write check kicking in (both sides scored as 0 there).
  if (Array.isArray(data.sales)) score += data.sales.length;
  if (Array.isArray(data.customers)) score += data.customers.length;
  if (Array.isArray(data.calendarEvents)) score += data.calendarEvents.length;
  if (data.varieties && typeof data.varieties === 'object') {
    for (const arr of Object.values(data.varieties)) {
      if (Array.isArray(arr)) score += arr.length;
    }
  }
  // Identity signals — location/zone setup is non-trivial user effort, so
  // their presence is worth a few points to discourage clobbering them with
  // a default-state save.
  if (data.homesteadLocation?.lat != null) score += 5;
  if (data.userZone) score += 2;
  if (data.userZoneSystem) score += 2;
  return score;
}

async function safeWriteCloudHomestead(homesteadId, newData) {
  let currentCloud = null;
  let readFailed = false;
  try {
    currentCloud = await readCloudHomestead(homesteadId);
  } catch (e) {
    console.warn('Cloud read failed during safe-write check; skipping save to avoid clobber.', e);
    readFailed = true;
  }

  if (readFailed) {
    return { skipped: true, reason: 'read-failed' };
  }

  const currentScore = scoreData(currentCloud);
  const newScore = scoreData(newData);

  if (currentScore >= 5 && newScore < currentScore - 10) {
    console.warn(
      `Refusing to clobber cloud data (current score=${currentScore}, new=${newScore}). Skipping save.`
    );
    return { skipped: true, reason: 'would-clobber' };
  }

  await writeCloudHomestead(homesteadId, newData);
  return { skipped: false };
}

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

export async function saveHomestead(user, data, cloudReady = true) {
  writeLocalHomestead(data);

  if (user && isSupabaseConfigured) {
    if (!cloudReady) {
      return { ok: false, location: 'local', skipped: true };
    }
    try {
      let homesteadId = readActiveHomesteadId();
      if (!homesteadId) {
        const { id } = await ensureHomestead(user.id);
        writeActiveHomesteadId(id);
        homesteadId = id;
      }
      const result = await safeWriteCloudHomestead(homesteadId, data);
      if (result.skipped) {
        return { ok: false, location: 'local', skipped: true };
      }
      return { ok: true, location: 'cloud' };
    } catch (e) {
      return { ok: false, location: 'local', error: e };
    }
  }
  return { ok: true, location: 'local' };
}

export async function listMembers(user) {
  if (!user || !isSupabaseConfigured) return [];
  const homesteadId = readActiveHomesteadId();
  if (!homesteadId) return [];

  const { data, error } = await supabase
    .from('homestead_members')
    .select('user_id, role, joined_at, chore_emails_opt_in')
    .eq('homestead_id', homesteadId);

  if (error) {
    console.error('Member list failed', error);
    return [];
  }

  return (data || []).map((m) => ({
    ...m,
    email: m.user_id === user.id ? user.email : null,
    isYou: m.user_id === user.id,
  }));
}

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

export async function cancelInvite(inviteId) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('pending_invites')
    .delete()
    .eq('id', inviteId);
  if (error) throw error;
}

export async function acceptInvite(user, inviteCode) {
  if (!user || !isSupabaseConfigured) throw new Error('Sign in first');

  const { data, error } = await supabase.rpc('accept_invite_by_code', {
    p_code: inviteCode,
  });

  if (error) {
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
  writeActiveHomesteadId(homesteadId);
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}

  return homesteadId;
}

export async function removeMember(homesteadId, userId) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('homestead_members')
    .delete()
    .eq('homestead_id', homesteadId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function updateMemberChoreEmails(memberUserId, optIn) {
  if (!isSupabaseConfigured) return;
  const homesteadId = readActiveHomesteadId();
  if (!homesteadId) throw new Error('No active homestead');

  const { error } = await supabase
    .from('homestead_members')
    .update({ chore_emails_opt_in: optIn })
    .eq('homestead_id', homesteadId)
    .eq('user_id', memberUserId);

  if (error) {
    console.error('Update chore email pref failed', error);
    throw new Error(error.message || 'Could not update preference');
  }
}

export function getActiveHomesteadId() {
  return readActiveHomesteadId();
}

async function sendEmail(payload) {
  // Pull the current Supabase session JWT and pass it to the server. The
  // hardened /api/send-email endpoint requires this — it verifies the JWT
  // server-side before sending anything. If there's no active session,
  // we surface a clear error.
  const headers = { 'Content-Type': 'application/json' };
  if (isSupabaseConfigured) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch (e) {
      // Fall through — server will reject with 401, client handles it
    }
  }
  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    // Read body ONCE as text — fetch responses can only be consumed once,
    // so trying res.text() after res.json() would throw. We then attempt
    // to JSON.parse it ourselves.
    const rawBody = await res.text().catch(() => '');
    let parsed = null;
    if (rawBody) {
      try { parsed = JSON.parse(rawBody); } catch (_) { /* not JSON */ }
    }
    // The server returns `{ error: 'rate_limit', message: '...' }` with status
    // 503 when it detects Resend's daily/monthly quota was hit. The UI uses
    // .kind to switch between a friendly info card and a generic error.
    if (parsed && parsed.error === 'rate_limit') {
      const e = new Error(parsed.message || "We've hit our daily email send limit.");
      e.kind = 'rate_limit';
      e.status = res.status;
      throw e;
    }
    // Server returned a structured error with a different kind — surface it.
    if (parsed && parsed.error) {
      const e = new Error(parsed.message || parsed.error);
      e.kind = parsed.error;
      e.status = res.status;
      throw e;
    }
    // Last-resort: plain-text body or empty
    const e = new Error(`Email send failed: ${res.status}${rawBody ? ' ' + rawBody : ''}`);
    e.status = res.status;
    throw e;
  }
  return res.json();
}

export function sendFeedback({ category, message, fromEmail }) {
  return sendEmail({ kind: 'feedback', category, message, fromEmail });
}

export function notifySignup({ newUserEmail }) {
  return sendEmail({ kind: 'signup_notify', newUserEmail });
}

export function sendFarmhandInvite({ inviteCode }) {
  // The server-side handler looks up the invite by code, pulls the inviter's
  // email and homestead name from the database, and constructs the link.
  // Client is no longer trusted with any of those fields.
  return sendEmail({
    kind: 'farmhand_invite',
    inviteCode,
  });
}

// Account deletion — calls the server-side /api/delete-account endpoint.
// This is destructive and irreversible. The client UI requires typing
// "DELETE" to confirm; we forward that confirmation to the server, which
// requires it as defense-in-depth.
//
// On success, the local cache is cleared. The caller should also call
// supabase.auth.signOut() after this resolves (though by then the user
// already won't exist server-side).
export async function deleteAccount() {
  if (!isSupabaseConfigured) {
    throw new Error('Cannot delete account when not configured');
  }
  // Pull the active session's JWT for the Authorization header
  const headers = { 'Content-Type': 'application/json' };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  } catch (e) {
    // Server will return 401 if no JWT — handled below
  }

  const res = await fetch('/api/delete-account', {
    method: 'POST',
    headers,
    body: JSON.stringify({ confirmation: 'DELETE' }),
  });

  const text = await res.text().catch(() => '');
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (e) { /* not JSON */ }

  if (!res.ok && res.status !== 207) {
    const msg = parsed?.error || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  // Clear local state. The session will become invalid since the auth row
  // is gone, but we still call signOut() in the caller for a clean state.
  clearLocalHomestead();
  return parsed || { ok: true };
}

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
  // 24h lifetime so long planning sessions don't see broken images. The
  // GardenMap and entry photo viewers also refresh the URL on mount, so
  // anyone who opens a stale session naturally re-fetches a fresh URL.
  const { data, error } = await supabase.storage
    .from('photos')
    .createSignedUrl(path, 24 * 60 * 60);
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
