// ============================================================================
// Meat bird batches — shared counts (old Home page + 3.0 Meat birds screens)
// ----------------------------------------------------------------------------
// A batch lives in hobby.currentBatches until it is finalized, then in
// hobby.archivedBatches with its entries snapshotted as finalEntries. Live
// birds = start − deaths − butchered − soft culls + manual adjustment, the
// same formula the batch card and the edit modal use.
// ============================================================================

const toDate = (s) => { const p = String(s || "").split("-").map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); };

export function batchEntries(batch, entries) {
  return Array.isArray(batch.finalEntries) ? batch.finalEntries : (entries || []).filter((e) => e && e.batchId === batch.id);
}

export function batchAlive(batch, entries) {
  const ents = batchEntries(batch, entries);
  const deaths = ents.filter((e) => e.action === "death").reduce((s, e) => s + (Number(e.count) || 1), 0);
  const butchered = (batch.butchered || []).reduce((s, x) => s + (Number(x.count) || 0), 0);
  const culled = ents.filter((e) => e.action === "note" && Number(e.cullCount) > 0).reduce((s, e) => s + Number(e.cullCount), 0);
  return Math.max(0, (Number(batch.startCount) || 0) - deaths - butchered - culled + (Number(batch.countAdjustment) || 0));
}

export function batchAgeDays(batch, today = new Date()) {
  if (!batch.startDate) return 0;
  return Math.max(0, Math.floor((today.getTime() - toDate(batch.startDate).getTime()) / 86400000));
}

// Totals for one batch: birds, losses, meat, cost (chicks + feed + build).
export function batchTotals(batch, entries) {
  const ents = batchEntries(batch, entries);
  const deaths = ents.filter((e) => e.action === "death").reduce((s, e) => s + (Number(e.count) || 1), 0);
  const butchered = (batch.butchered || []).reduce((s, x) => s + (Number(x.count) || 0), 0);
  const lbs = (batch.butchered || []).reduce((s, x) => s + (Number(x.count) || 0) * (Number(x.avgWeight) || 0), 0);
  const feed = ents.filter((e) => e.action === "fed").reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const infra = ents.filter((e) => e.action === "infrastructure").reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const chicks = Number(batch.chickCost) || 0;
  const feedLbs = ents.filter((e) => e.action === "fed" && e.feedUnit !== "cups").reduce((s, e) => s + (Number(e.lbs) || Number(e.feedAmount) || 0), 0);
  return { start: Number(batch.startCount) || 0, deaths, butchered, lbs, cost: feed + infra + chicks, feed, infra, chicks, feedLbs };
}

// Un-finalize a past batch: back to active, with its entries restored.
export function restorePastBatch(d, hobbyId, batchId) {
  const h = d.hobbies.find((x) => x.id === hobbyId);
  if (!h || !Array.isArray(h.archivedBatches)) return d;
  const idx = h.archivedBatches.findIndex((b) => b.id === batchId);
  if (idx === -1) return d;
  const restored = JSON.parse(JSON.stringify(h.archivedBatches[idx]));
  const snapshot = Array.isArray(restored.finalEntries) ? restored.finalEntries : [];
  delete restored.finalEntries;
  restored.endDate = "";
  h.currentBatches = h.currentBatches || [];
  h.currentBatches.push(restored);
  h.archivedBatches.splice(idx, 1);
  d.entries[hobbyId] = d.entries[hobbyId] || [];
  const existing = new Set(d.entries[hobbyId].map((e) => e.id).filter(Boolean));
  for (const e of snapshot) {
    if (!e || (e.id && existing.has(e.id))) continue;
    d.entries[hobbyId].push(e);
  }
  return d;
}
