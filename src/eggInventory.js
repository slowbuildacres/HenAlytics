// ============================================================================
// Eggs on hand (moved out of HomesteadApp.jsx for 3.0)
// ============================================================================

export function computeEggsOnHand(hobby, entries, sales) {
  const inv = hobby && hobby.eggInventory;
  if (!inv || !inv.enabled) return null;
  const since = Number(inv.startTs) || 0;
  let n = Number(inv.startCount) || 0;
  const entryIds = new Set();
  (entries || []).forEach((e) => {
    if (!e) return;
    if (e.action === "sold_eggs") entryIds.add(e.id);
    if ((Number(e.created) || 0) < since) return;
    const c = Number(e.count) || 0;
    if (e.action === "eggs" || e.action === "eggs_laid") n += c;
    else if (e.action === "sold_eggs" || e.action === "used_eggs") n -= c;
  });
  // Egg sales logged directly on the Sales tab also leave the basket.
  // Skip anything that mirrors a sold_eggs entry (the entries→sales
  // migration copies those over with the same id, plus a flag) so a
  // tile-logged sale is never subtracted twice.
  (sales || []).forEach((s) => {
    if (!s || s.hobbyType !== "eggs") return;
    if (s.migratedFromEntries || entryIds.has(s.id)) return;
    if ((Number(s.created) || 0) < since) return;
    const qty = Number(s.qty) || 0;
    const perUnit = { eggs: 1, egg: 1, dozen: 12, dozens: 12 };
    n -= qty * (perUnit[String(s.unit || "eggs").toLowerCase()] || 1);
  });
  return n;
}
