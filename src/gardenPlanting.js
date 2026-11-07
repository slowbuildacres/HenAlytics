// ============================================================================
// Garden: plant an annual from the planting planner (PlanCropModal onConfirm)
// ----------------------------------------------------------------------------
// Moved out of HomePage (HomesteadApp.jsx) for 3.0 so the new Garden screens
// share it: logs a "planted" entry, a plantings[] record and the season's
// annual record, then offers to mark a matching seed packet as used.
// ============================================================================

import { matchingPackets } from "./SeedInventory.jsx";

const pad2 = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const newId = () => {
  try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch (_) {}
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
};

export function planAnnualConfirm({ data, update, setModal }, payload) {
    if (!payload) return;
    const { cropId, cropName, variety, method, events, isCustom, customDate } = payload;
    // Pick the planting date based on what kind of event matches the method.
    // Falls back to today if no matching event (defensive — shouldn't happen).
    let plantingDate;
    if (isCustom) {
      plantingDate = customDate || todayStr();
    } else if (Array.isArray(events) && events.length > 0) {
      const matchKind = method === "indoor" ? "indoor"
        : method === "direct" ? "direct"
        : method === "transplant" ? "transplant"
        : null;
      const matchEvent = matchKind ? events.find(e => e.kind === matchKind) : null;
      plantingDate = matchEvent ? matchEvent.date : todayStr();
    } else {
      plantingDate = todayStr();
    }
    // Display name for the planting record: variety name takes precedence,
    // then the crop's display name, then the raw cropName fallback for custom.
    const plantName = (variety && variety.name) || cropName || "Unknown";
    update((d) => {
      const gh = d.hobbies.find(x => x.type === "garden");
      const sid = gh?.currentSeason?.id || "";

      // Push a `planted` entry into data.entries.garden so Recent Activity,
      // analytics, and the journal pick it up. Without this the planting was
      // silently missing from Recent Activity (BUGFIX: previously this flow
      // only created plantings[] + annuals[] but skipped the entry, so users
      // saw the calendar event but no "Planted X" row appeared in recent
      // activity. Mirrors step 1 of the legacy seed-start-transplant save.)
      //
      // Date selection for the Recent Activity row:
      //   - Custom crop path: use customDate (user-picked).
      //   - User edited the date in the modal: use plantingDate (they
      //     deliberately backdated/forward-dated, respect that).
      //   - User didn't edit: use today. plantingDate is the almanac's
      //     suggested sow/transplant date and is usually weeks off — using
      //     it as the entry date would bury the row far down the feed.
      // The `plantings[]` record below keeps `plantingDate` regardless —
      // that record represents the actual planting event/plan.
      let entryDate;
      if (isCustom) {
        entryDate = plantingDate; // already user-picked
      } else {
        const matchKind = method === "indoor" ? "indoor"
          : method === "direct" ? "direct"
          : method === "transplant" ? "transplant"
          : null;
        const matchEvent = matchKind && Array.isArray(events)
          ? events.find(e => e.kind === matchKind)
          : null;
        entryDate = (matchEvent && matchEvent.userEdited) ? plantingDate : todayStr();
      }
      if (!d.entries) d.entries = {};
      if (!Array.isArray(d.entries.garden)) d.entries.garden = [];
      d.entries.garden.push({
        id: newId(),
        date: entryDate,
        action: "planted",
        plant: plantName,
        quantity: "",
        seasonId: sid,
        created: Date.now(),
      });

      // Create planting record
      d.plantings = d.plantings || [];
      d.plantings.push({
        id: newId(),
        plant: plantName,
        quantity: "",
        date: plantingDate,
        harvested: false,
      });
      // Ensure annual record exists for this plant in the current season.
      // Mirrors the logic in the legacy quick-log "planted" save handler.
      if (gh) {
        if (!Array.isArray(gh.annuals)) gh.annuals = [];
        const nm = plantName.trim() || "Unnamed";
        // If this annual was previously deleted (tombstoned), the new
        // planting expresses intent to bring it back. Clear the tombstone
        // so migrateData rebuilds the record on next load too.
        const tombKey = `${nm.toLowerCase()}|${sid}`;
        if (Array.isArray(gh.deletedAnnualKeys) && gh.deletedAnnualKeys.includes(tombKey)) {
          gh.deletedAnnualKeys = gh.deletedAnnualKeys.filter(k => k !== tombKey);
        }
        const exists = gh.annuals.some(
          a => String(a.name || "").trim().toLowerCase() === nm.toLowerCase() &&
               (a.seasonId || "") === sid
        );
        if (!exists) {
          gh.annuals.push({
            id: newId(),
            name: nm,
            seasonId: sid,
            actions: [],
            created: Date.now(),
          });
        }
      }
      return d;
    });
    // Seed box: offer to mark the packet used. PlanCropModal closes itself
    // right after onConfirm, so open ours on the next tick.
    const gardenH = (data.hobbies || []).find((x) => x.type === "garden");
    const seedName = [variety && variety.name, cropName].filter(Boolean).join(" ");
    if (gardenH && matchingPackets(gardenH.seeds, seedName).length) {
      setTimeout(() => setModal({ type: "seedUse", plantName: seedName }), 0);
    }
}
