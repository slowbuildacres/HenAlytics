// ============================================================================
// Every log a hobby has, including closed garden seasons and finished batches
// ----------------------------------------------------------------------------
// Closing a garden season or finishing a meat-bird batch moves its logs out
// of data.entries[hobbyId] into the closed season / finished batch
// (finalEntries). Anything that is about history or money (the Journal, cost
// totals, the year-end report, the years Year in review offers, 4-H records,
// Photos) must read both places, or a closed season silently drops out.
//
// Screens about "now" (today's counts, the current season) keep reading
// data.entries directly.
// ============================================================================

// Logs of one hobby: live first, then each closed season and finished batch.
// Each id appears once (a log can't be in two places, but a half-finished
// sync or an old bug could leave a copy; the live one wins).
export function hobbyAllEntries(data, hobbyId) {
  const live = (data && data.entries && Array.isArray(data.entries[hobbyId])) ? data.entries[hobbyId] : [];
  const hobby = ((data && data.hobbies) || []).find((h) => h && h.id === hobbyId);
  const closed = [];
  if (hobby) {
    for (const s of hobby.archivedSeasons || []) if (s && Array.isArray(s.finalEntries)) closed.push(...s.finalEntries);
    for (const b of hobby.archivedBatches || []) if (b && Array.isArray(b.finalEntries)) closed.push(...b.finalEntries);
  }
  if (!closed.length) return live;
  const seen = new Set(live.map((e) => e && e.id).filter(Boolean));
  const out = live.slice();
  for (const e of closed) {
    if (!e) continue;
    if (e.id && seen.has(e.id)) continue;
    if (e.id) seen.add(e.id);
    out.push(e);
  }
  return out;
}

// Same, for every hobby: { [hobbyId]: entries[] }. Keys of data.entries that
// don't belong to a hobby (old data) are kept as they are.
export function allEntriesByHobby(data) {
  const out = { ...((data && data.entries) || {}) };
  for (const h of (data && data.hobbies) || []) if (h && h.id) out[h.id] = hobbyAllEntries(data, h.id);
  return out;
}

// Remove one log wherever it lives (live log, closed season, finished batch).
// Mutates `d` (an update() draft) and returns it.
export function removeEntryEverywhere(d, hobbyId, entryId) {
  if (d.entries && Array.isArray(d.entries[hobbyId])) d.entries[hobbyId] = d.entries[hobbyId].filter((x) => !x || x.id !== entryId);
  const h = (d.hobbies || []).find((x) => x && x.id === hobbyId);
  if (h) {
    for (const s of h.archivedSeasons || []) if (s && Array.isArray(s.finalEntries)) s.finalEntries = s.finalEntries.filter((x) => !x || x.id !== entryId);
    for (const b of h.archivedBatches || []) if (b && Array.isArray(b.finalEntries)) b.finalEntries = b.finalEntries.filter((x) => !x || x.id !== entryId);
  }
  return d;
}
