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

// Merge two id-arrays: cloud is the base, append any local items whose id
// isn't present in cloud. Preserves cloud's existing ordering, appends
// new local items at the end.
function mergeIdArrays(cloudArr, localArr) {
  if (!Array.isArray(localArr)) return { result: cloudArr, added: 0 };
  const cloudIds = new Set();
  for (const item of cloudArr) cloudIds.add(item.id);
  const additions = [];
  for (const localItem of localArr) {
    if (!isPlainObject(localItem) || !localItem.id) continue;
    if (!cloudIds.has(localItem.id)) {
      additions.push(localItem);
    }
  }
  if (additions.length === 0) return { result: cloudArr, added: 0 };
  return { result: [...cloudArr, ...additions], added: additions.length };
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
      const { result, added } = mergeIdArrays(base, local);

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
        return { merged: finalResult, addedCount: added + nestedAdded };
      }
      return { merged: result, addedCount: added };
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
