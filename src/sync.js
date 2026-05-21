import { supabase, isSupabaseConfigured } from './supabase.js';
import { mergeUnsyncedEntries } from './mergeUnsynced.js';
import { apiUrl } from './apiBase.js';

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

// Read local data ONLY if it's safe for the given user to use. The local
// mirror is tagged with _ownerUserId on every write (see writeLocalHomestead).
// Three cases:
//   - tag matches userId      → it's this user's data, return it
//   - tag is null (untagged)  → "unclaimed" data saved while signed-out;
//                               safe to adopt (a signed-out user who then
//                               creates an account keeps their work)
//   - tag is a DIFFERENT user → another account's data; return null so the
//                               caller uses defaults / cloud instead. This
//                               is the account-bleed guard.
// When userId is null (caller is signed-out) we likewise only return
// untagged data — never a signed-in account's tagged mirror.
export function readLocalHomesteadFor(userId) {
  const local = readLocalHomestead();
  if (!local) return null;
  const tag = local._ownerUserId || null;
  const want = userId || null;
  if (tag === want) return local;          // exact match
  if (tag === null) return local;          // untagged / unclaimed — safe to adopt
  // tag belongs to a different account — do not return it.
  console.warn('[LOAD] local cache belongs to a different account — ignoring it.');
  return null;
}

function writeLocalHomestead(data, ownerUserId) {
  try {
    // Tag the mirror with its owning user so a later load by a different
    // account can detect and reject it. When ownerUserId is omitted we
    // preserve any tag already on the data (callers that just re-save the
    // same object), defaulting to null for signed-out local-only data.
    const tagged = {
      ...data,
      _ownerUserId:
        ownerUserId !== undefined
          ? ownerUserId
          : (data && data._ownerUserId) || null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tagged));
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

    // 1. Honor the cached active homestead — the one the user was last on —
    //    whenever it's still a homestead they actually belong to. This is the
    //    user's "current context": for a farmhand who switched to a shared
    //    homestead, the cache IS the shared homestead and must win.
    //
    //    The cache is honored REGARDLESS of score. The old code required
    //    score > 0 here; that gate was the bug. A freshly-created shared
    //    homestead can legitimately score 0, and when the gate failed the
    //    code fell through to the owner-preference block below — silently
    //    stranding the farmhand on their own private homestead and never
    //    showing them the homestead they joined.
    if (cachedId) {
      const cachedMatch = scored.find((s) => s.membership.homestead_id === cachedId);
      if (cachedMatch) {
        return { id: cachedMatch.membership.homestead_id, role: cachedMatch.membership.role };
      }
    }

    // 2. Cold start only (no cache, or cache pointed at a homestead the user
    //    no longer belongs to): default to a homestead the user OWNS. Tie-break
    //    by score, then earliest joined_at.
    const owned = scored.filter((s) => s.membership.role === 'owner');
    if (owned.length > 0) {
      owned.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(a.membership.joined_at) - new Date(b.membership.joined_at);
      });
      const chosen = owned[0].membership;
      return { id: chosen.homestead_id, role: chosen.role };
    }

    // 3. No owned homestead at all (a farmhand who never created their own):
    //    fall back to the highest-scored shared homestead.
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

// Like readCloudHomestead, but also returns the row's updated_at so callers
// can do recency comparisons (stale-write protection). Kept separate so the
// existing readCloudHomestead callers are untouched.
async function readCloudHomesteadMeta(homesteadId) {
  const { data, error } = await supabase
    .from('homesteads')
    .select('data, updated_at')
    .eq('id', homesteadId)
    .maybeSingle();

  if (error) {
    console.error('Cloud read (meta) failed', error);
    throw error;
  }
  if (!data) return { data: null, updatedAt: null };
  return { data: data.data, updatedAt: data.updated_at || null };
}

async function writeCloudHomestead(homesteadId, data) {
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from('homesteads')
    .update({ data, updated_at: updatedAt })
    .eq('id', homesteadId);

  if (error) {
    console.error('Cloud save failed', error);
    throw error;
  }
  return updatedAt;
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
  let cloudUpdatedAt = null;
  let readFailed = false;
  try {
    const meta = await readCloudHomesteadMeta(homesteadId);
    currentCloud = meta.data;
    cloudUpdatedAt = meta.updatedAt;
  } catch (e) {
    console.warn('Cloud read failed during safe-write check; skipping save to avoid clobber.', e);
    readFailed = true;
  }

  if (readFailed) {
    return { skipped: true, reason: 'read-failed' };
  }

  // ---- Recency guard (stale-write protection) ----
  // The score guard below only catches a write that REMOVES a lot of data.
  // It cannot catch a stale device overwriting newer-but-similar-sized data
  // — e.g. two devices on one homestead, one of them working from an old
  // local copy. That's silent data loss (the May-16 farmhand bug).
  //
  // Rule: newData carries `cloudBaselineAt` — the cloud updated_at this
  // device saw the last time it successfully READ the cloud. If the cloud's
  // current updated_at is NEWER than that baseline, the cloud changed under
  // this device since it last synced — writing now would clobber changes
  // this device never saw. Reject and tell the caller to re-pull.
  //
  // Skipped only when we can actually compare. A first-ever save (no
  // baseline) or a row with no updated_at falls through to the score guard.
  const baseline = newData && newData.cloudBaselineAt;
  if (baseline && cloudUpdatedAt) {
    const cloudTime = new Date(cloudUpdatedAt).getTime();
    const baseTime = new Date(baseline).getTime();
    // Small slack (2s) absorbs clock skew / same-second writes.
    if (Number.isFinite(cloudTime) && Number.isFinite(baseTime) &&
        cloudTime > baseTime + 2000) {
      console.warn(
        `[STALE-WRITE] Cloud is newer than this device's baseline ` +
        `(cloud=${cloudUpdatedAt}, baseline=${baseline}). Skipping save to ` +
        `avoid clobbering unseen changes.`
      );
      return { skipped: true, reason: 'stale-baseline' };
    }
  }

  const currentScore = scoreData(currentCloud);
  const newScore = scoreData(newData);

  if (currentScore >= 5 && newScore < currentScore - 10) {
    console.warn(
      `Refusing to clobber cloud data (current score=${currentScore}, new=${newScore}). Skipping save.`
    );
    return { skipped: true, reason: 'would-clobber' };
  }

  const writtenAt = await writeCloudHomestead(homesteadId, newData);
  // Return the new cloud updated_at so the caller can refresh this device's
  // cloudBaselineAt — otherwise the very next save would see the cloud as
  // "newer than baseline" (because we just advanced it) and falsely trip
  // the stale-write guard.
  return { skipped: false, newBaselineAt: writtenAt };
}

export async function loadHomestead(user) {
  if (user && isSupabaseConfigured) {
    try {
      const { id, role } = await ensureHomestead(user.id);
      writeActiveHomesteadId(id);
      const { data: cloud, updatedAt } = await readCloudHomesteadMeta(id);
      const hasContent = cloud && Object.keys(cloud).length > 0;
      if (hasContent) {
        // Stamp the cloud's updated_at onto the data as cloudBaselineAt.
        // This records "the cloud state this device has actually seen".
        // safeWriteCloudHomestead later compares the live cloud updated_at
        // against this baseline and refuses a write if the cloud moved on
        // since — that's the stale-write / clobber protection. The stamp is
        // refreshed on every successful read, so a device that stays synced
        // always has a current baseline and writes normally.
        const stamped = { ...cloud, cloudBaselineAt: updatedAt || null };

        // Before overwriting local with cloud, check whether local has
        // unsynced entries cloud doesn't know about. If a previous save
        // was skipped (stale-baseline guard, dead refresh token, etc.) the
        // user's entries only exist in localStorage. Overwriting local with
        // cloud would silently lose them. Merge instead: cloud is the base,
        // any local entry whose id isn't in cloud gets appended. The next
        // save effect cycle pushes the merged result up.
        const existingLocal = readLocalHomesteadFor(user.id);
        if (existingLocal) {
          const { merged, mergedCount } = mergeUnsyncedEntries(stamped, existingLocal);
          if (mergedCount > 0) {
            console.warn(`[LOAD] preserved ${mergedCount} unsynced local entries during cloud load`);
            writeLocalHomestead(merged, user.id);
            return {
              source: 'cloud-merged',
              data: merged,
              homesteadId: id,
              role,
              recoveredCount: mergedCount,
            };
          }
        }

        // Tag the local mirror with this user's id so a later load by a
        // different account on this browser can't reuse it (account-bleed).
        writeLocalHomestead(stamped, user.id);
        return { source: 'cloud', data: stamped, homesteadId: id, role };
      }
      return { source: 'cloud-empty', data: null, homesteadId: id, role };
    } catch (e) {
      console.warn('[LOAD] cloud read failed — falling back to local cache', e);
      // Distinguish a genuine cloud-read FAILURE (signed-in user, cloud
      // unreachable / dead session) from the normal local path. The save
      // path already surfaces auth failures; the read path previously did
      // not — a signed-in user whose cloud read failed silently got a stale
      // local snapshot with no indication it was stale. cloudFailed lets
      // HomesteadApp surface the same "not synced" banner on load.
      const msg = String((e && (e.message || e.error_description || e.name)) || '').toLowerCase();
      const isAuth =
        msg.includes('refresh token') ||
        msg.includes('jwt') ||
        msg.includes('not authenticated') ||
        (e && (e.status === 401 || e.status === 403));
      // Owner-guarded read: only fall back to local data that actually
      // belongs to THIS user. If the local mirror is a different account's
      // (e.g. they switched accounts in the same browser), this returns
      // null and the app shows defaults instead of the wrong homestead.
      return {
        source: 'local',
        data: readLocalHomesteadFor(user.id),
        cloudFailed: true,
        reason: isAuth ? 'auth' : 'error',
      };
    }
  }
  // Signed-out / local-only path. Only return local data that was saved
  // while signed-out (untagged) — never another signed-in account's mirror.
  return { source: 'local', data: readLocalHomesteadFor(user ? user.id : null) };
}

export async function saveHomestead(user, data, cloudReady = true) {
  // Tag the local mirror with the current user (null when signed out) so a
  // later load by a different account can't reuse it (account-bleed bug).
  writeLocalHomestead(data, user ? user.id : null);

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
        // Pass the skip reason through so the caller can tell a benign
        // clobber-guard skip apart from a read-failed skip (the latter is
        // the refresh-token-bug signature and should surface to the user).
        // 'stale-baseline' tells the caller this device is behind and should
        // re-pull from cloud before its next save.
        return { ok: false, location: 'local', skipped: true, reason: result.reason };
      }
      // Write succeeded. Refresh this device's local cloudBaselineAt to the
      // updated_at the cloud now holds, so the next save isn't falsely
      // flagged stale against the cloud state we just created.
      if (result.newBaselineAt) {
        try {
          writeLocalHomestead(
            { ...data, cloudBaselineAt: result.newBaselineAt },
            user.id
          );
        } catch (e) { /* local mirror is best-effort */ }
      }
      return { ok: true, location: 'cloud', newBaselineAt: result.newBaselineAt };
    } catch (e) {
      // Classify the failure. An auth/session error (dead refresh token) is
      // the bug we care about surfacing — distinguish it from generic
      // network/server errors so the UI can prompt re-authentication only
      // when that's actually the problem.
      const msg = String((e && (e.message || e.error_description || e.name)) || '').toLowerCase();
      const isAuth =
        msg.includes('refresh token') ||
        msg.includes('jwt') ||
        msg.includes('not authenticated') ||
        msg.includes('access control') ||
        (e && (e.status === 401 || e.status === 403));
      if (isAuth) {
        console.warn('[SAVE] cloud save failed — auth/session error (likely dead refresh token):', e);
      } else {
        console.warn('[SAVE] cloud save failed — non-auth error:', e);
      }
      return { ok: false, location: 'local', error: e, reason: isAuth ? 'auth' : 'error' };
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

// List every homestead the user belongs to — both ones they own and ones
// they're a farmhand on. Powers the homestead switcher UI. Returns an array
// of { homesteadId, role, joinedAt, name, isActive } sorted owner-first.
export async function listMyHomesteads(user) {
  if (!user || !isSupabaseConfigured) return [];

  const { data: memberships, error } = await supabase
    .from('homestead_members')
    .select('homestead_id, role, joined_at, homesteads(id, data)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true });

  if (error) {
    console.error('listMyHomesteads failed', error);
    throw new Error(error.message || 'Could not load your homesteads');
  }

  const activeId = readActiveHomesteadId();

  return (memberships || [])
    .map((m) => {
      const data = (m.homesteads && m.homesteads.data) || {};
      const name =
        (typeof data.homesteadName === 'string' && data.homesteadName.trim()) ||
        (m.role === 'owner' ? 'My Homestead' : 'Shared Homestead');
      // A content hint so the switcher can tell apart homesteads that share
      // a name (e.g. two unnamed homesteads both showing "My Homestead").
      // Counts logged entries across all entry buckets; falls back to a
      // short id suffix when there's nothing logged yet.
      let entryCount = 0;
      const entries = data && data.entries;
      if (entries && typeof entries === 'object') {
        for (const k of Object.keys(entries)) {
          if (Array.isArray(entries[k])) entryCount += entries[k].length;
        }
      }
      const idTail = String(m.homestead_id || '').slice(0, 4);
      const hint =
        entryCount > 0
          ? `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`
          : `empty · ${idTail}`;
      return {
        homesteadId: m.homestead_id,
        role: m.role,
        joinedAt: m.joined_at,
        name,
        hint,
        entryCount,
        isActive: m.homestead_id === activeId,
      };
    })
    .sort((a, b) => {
      // Owned homesteads first, then by join order.
      if (a.role !== b.role) return a.role === 'owner' ? -1 : 1;
      return new Date(a.joinedAt) - new Date(b.joinedAt);
    });
}

// Deliberately switch the active homestead. Validates that the target is a
// homestead the user actually belongs to (so a stale or bad id can't strand
// them), writes it to the cache, and clears the local data mirror so the
// next loadHomestead() pulls fresh cloud data for the new homestead instead
// of showing the previous homestead's cached rows.
export async function setActiveHomestead(user, homesteadId) {
  if (!user || !isSupabaseConfigured) throw new Error('Sign in first');
  if (!homesteadId) throw new Error('No homestead specified');

  const { data: membership, error } = await supabase
    .from('homestead_members')
    .select('homestead_id, role')
    .eq('user_id', user.id)
    .eq('homestead_id', homesteadId)
    .maybeSingle();

  if (error) {
    console.error('setActiveHomestead membership check failed', error);
    throw new Error(error.message || 'Could not switch homestead');
  }
  if (!membership) {
    throw new Error('You are not a member of that homestead.');
  }

  writeActiveHomesteadId(homesteadId);
  // Drop the local mirror — it belongs to the old homestead. The caller
  // should follow this with a loadHomestead() to repopulate from cloud.
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}

  return { homesteadId, role: membership.role };
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
  const res = await fetch(apiUrl('/api/send-email'), {
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

  const res = await fetch(apiUrl('/api/delete-account'), {
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
