// ============================================================================
// MERGE UNSYNCED LOCAL ENTRIES INTO CLOUD DATA
// ----------------------------------------------------------------------------
// When loadHomestead pulls fresh cloud data, local may have entries the user
// added since the last successful sync (e.g., during a stale-baseline skip
// window). Overwriting local with cloud would silently lose those entries.
//
// This function walks both objects and produces a merged result that:
//   - Takes cloud as the base (cloud wins for everything)
//   - Adds local-only entries (entries with an `id` that's in local but not
//     in cloud) to the corresponding arrays in cloud
//   - Never modifies an entry that exists in both
//   - Never removes anything from cloud
//   - For non-id'd arrays and scalars: cloud wins, no merging attempted
//
// The merge is intentionally CONSERVATIVE. We only add things we can be
// confident are clear additions (id'd entries with no matching id in cloud).
// Anything ambiguous, cloud wins.
//
// Returns: { merged, mergedCount }
//   merged       - the merged data object (or cloudData unchanged if nothing
//                  needed merging — safe to compare by reference)
//   mergedCount  - number of entries that got merged in from local
// ============================================================================

// Keys whose nested objects we DO NOT recurse into. These tend to be
// fetched-once metadata blobs (weather snapshots, location lookups) where
// recursion would be pointless and confusing.
const SKIP_RECURSE_KEYS = new Set([
  'weather',
  'homesteadLocation',  // {lat, lon, label} — scalar bundle
  'cloudBaselineAt',
  '_ownerUserId',
]);

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// True if every element of arr is an object with a non-empty id field.
function isIdArrayOfObjects(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  for (const item of arr) {
    if (!isPlainObject(item)) return false;
    if (!item.id || typeof item.id !== 'string') return false;
  }
  return true;
}

// Merge two id-arrays. Cloud is the base. Two things happen:
//   1. ADDITIONS: any local item whose id isn't in cloud is appended.
//   2. CONFLICTS: any local item whose id IS in cloud is compared by
//      `updatedAt` — if local's stamp is strictly newer, local's version
//      replaces cloud's in place (newer-wins). Without a newer local stamp,
//      cloud's version is kept (preserves the original cloud-wins behavior,
//      including for legacy records that have no updatedAt at all).
//
// This is the Phase 2 conflict-resolution change. Records are stamped with
// updatedAt by HomesteadApp's update() whenever they're edited, so "newer"
// means "more recently edited", not "more recently synced". Two devices that
// edit the same record offline resolve to whichever edit happened later.
//
// Returns { result, added, replaced } where `added` counts new appends and
// `replaced` counts conflict resolutions that took the local version.
function mergeIdArrays(cloudArr, localArr) {
  if (!Array.isArray(localArr)) return { result: cloudArr, added: 0, replaced: 0 };
  const cloudIndexById = new Map();
  cloudArr.forEach((item, i) => {
    if (isPlainObject(item) && item.id) cloudIndexById.set(item.id, i);
  });
  const additions = [];
  let replaced = 0;
  // Start from a shallow copy so we can replace conflicting entries in place
  // without mutating the caller's array.
  let result = cloudArr.slice();
  for (const localItem of localArr) {
    if (!isPlainObject(localItem) || !localItem.id) continue;
    if (cloudIndexById.has(localItem.id)) {
      // Same id on both sides — resolve by updatedAt (newer wins).
      const idx = cloudIndexById.get(localItem.id);
      const cloudItem = result[idx];
      const cloudStamp = Number(cloudItem && cloudItem.updatedAt) || 0;
      const localStamp = Number(localItem.updatedAt) || 0;
      if (localStamp > cloudStamp) {
        result[idx] = localItem;
        replaced++;
      }
      // else cloud wins (newer or tied or both unstamped) — leave as-is.
    } else {
      additions.push(localItem);
    }
  }
  if (additions.length === 0 && replaced === 0) {
    return { result: cloudArr, added: 0, replaced: 0 };
  }
  if (additions.length > 0) result = [...result, ...additions];
  return { result, added: additions.length, replaced };
}

// Recursive merge. Walks both objects in lock-step, applying rules:
//   - Array of id'd objects → merge by id
//   - Plain object         → recurse into each key
//   - Otherwise            → cloud wins
//
// Returns { merged, addedCount }.
function mergeRecursive(cloud, local) {
  // If either side isn't a usable object/array, cloud wins.
  if (!isPlainObject(cloud) && !Array.isArray(cloud)) return { merged: cloud, addedCount: 0 };

  // Array case
  if (Array.isArray(cloud)) {
    if (isIdArrayOfObjects(cloud) || isIdArrayOfObjects(local)) {
      // Allow merging even if cloud is empty (e.g., user added their first
      // entries on a stale-baseline device — cloud has [] but local has data).
      const base = Array.isArray(cloud) ? cloud : [];
      const { result, added, replaced } = mergeIdArrays(base, local);
      // Count both clean additions and conflict-resolutions (local won) as
      // "merged" so the load path reports/persists when either happened.
      const mergedHere = added + (replaced || 0);

      // We also recurse INTO each merged item if both sides had it — that
      // way nested id-arrays inside, e.g., a flock's `namedBirds`, also get
      // merged. Items that exist only in cloud are kept as-is; items only
      // in local were appended already.
      if (Array.isArray(local) && local.length > 0) {
        const localById = new Map();
        for (const item of local) {
          if (isPlainObject(item) && item.id) localById.set(item.id, item);
        }
        let nestedAdded = 0;
        const finalResult = result.map((cloudItem) => {
          if (!isPlainObject(cloudItem) || !cloudItem.id) return cloudItem;
          const localMatch = localById.get(cloudItem.id);
          if (!localMatch) return cloudItem;
          const { merged: mergedItem, addedCount } = mergeRecursive(cloudItem, localMatch);
          nestedAdded += addedCount;
          return mergedItem;
        });
        return { merged: finalResult, addedCount: mergedHere + nestedAdded };
      }
      return { merged: result, addedCount: mergedHere };
    }
    // Non-id arrays — cloud wins, no merging attempted.
    return { merged: cloud, addedCount: 0 };
  }

  // Object case — recurse into each key.
  if (!isPlainObject(local)) return { merged: cloud, addedCount: 0 };

  let totalAdded = 0;
  let changedAny = false;
  const result = {};
  for (const key of Object.keys(cloud)) {
    if (SKIP_RECURSE_KEYS.has(key)) {
      result[key] = cloud[key];
      continue;
    }
    const cloudVal = cloud[key];
    const localVal = local[key];
    if (Array.isArray(cloudVal) || isPlainObject(cloudVal)) {
      const { merged: mergedVal, addedCount } = mergeRecursive(cloudVal, localVal);
      result[key] = mergedVal;
      totalAdded += addedCount;
      if (addedCount > 0) changedAny = true;
    } else {
      // Scalar — cloud wins.
      result[key] = cloudVal;
    }
  }
  // Keys that exist in local but not in cloud. These are user-added things
  // the cloud doesn't know about yet. Add them. (Skip the SKIP_RECURSE_KEYS
  // bookkeeping fields.)
  for (const key of Object.keys(local)) {
    if (key in result) continue;
    if (SKIP_RECURSE_KEYS.has(key)) continue;
    result[key] = local[key];
    changedAny = true;
    // We don't increment totalAdded here because this is a key, not an
    // entry — but it does mean we changed something.
  }
  if (!changedAny && totalAdded === 0) {
    // Return cloud unchanged so callers can do a reference equality check.
    return { merged: cloud, addedCount: 0 };
  }
  return { merged: result, addedCount: totalAdded };
}

export function mergeUnsyncedEntries(cloudData, localData) {
  if (!isPlainObject(cloudData)) return { merged: cloudData, mergedCount: 0 };
  if (!isPlainObject(localData)) return { merged: cloudData, mergedCount: 0 };
  const { merged, addedCount } = mergeRecursive(cloudData, localData);
  return { merged, mergedCount: addedCount };
}

export const __testing = {
  mergeRecursive,
  isIdArrayOfObjects,
  mergeIdArrays,
};
