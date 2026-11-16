// ============================================================================
// Journal: the logs hobbies keep on their own records
// ----------------------------------------------------------------------------
// Most logs are rows in data.entries[hobbyId], and the Journal lists those.
// Some hobbies save their main log as a record on the hobby instead: canning,
// freeze-drying and dehydrating batches, ferments, tinctures, oils, salves,
// tea blends, soap, sourdough bakes, maple seasons, hunting harvests,
// incubator runs and brooder chicks, breedings, litters, shearings, rides,
// farrier, vet and dewormer visits. Since 3.0 the Log button opens those
// forms directly, so without these the Journal looked like logging had
// stopped. Each record becomes a read-only Journal row; tapping it opens the
// hobby, where the record is edited or deleted.
// ============================================================================

import { fmtWeight, fmtOz, fmtMoney } from "./units.js";

const plural = (n, one, many) => `${n} ${Number(n) === 1 ? one : many}`;
const num = (v) => (v == null || v === "" ? 0 : Number(v) || 0);
const firstDate = (r, keys) => {
  for (const k of keys) {
    const v = r && r[k];
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  }
  return "";
};

// Animal (or horse) names by id, for "Bred · Daisy × Buck".
const namesOf = (h) => {
  const m = new Map();
  for (const a of Array.isArray(h.animals) ? h.animals : []) if (a && a.id) m.set(a.id, a.name || "");
  return m;
};

// [array on the hobby, title, date keys, detail(record, names)]
const SOURCES = {
  batches: {
    canning: ["Canned", ["date"], (r) => [r.item, num(r.jarsMade) > 0 && plural(num(r.jarsMade), "jar", "jars")]],
    freeze_drying: ["Freeze-dried", ["date"], (r) => [r.item, num(r.trays) > 0 && plural(num(r.trays), "tray", "trays"), num(r.outputOz) > 0 && fmtOz(num(r.outputOz))]],
    dehydrating: ["Dehydrated", ["date"], (r) => [r.item, num(r.trays) > 0 && plural(num(r.trays), "tray", "trays"), num(r.outputOz) > 0 && fmtOz(num(r.outputOz))]],
    tincture: ["Started a tincture", ["startDate", "date"], (r) => [r.name || r.herb, num(r.jarsStarted) > 0 && plural(num(r.jarsStarted), "jar", "jars")]],
    oil_infusion: ["Started an oil infusion", ["startDate", "date"], (r) => [r.name || r.herb, r.carrierOil]],
    salve: ["Poured salve", ["pouredDate", "date"], (r) => [r.name || r.recipe, num(r.tinsMade) > 0 && plural(num(r.tinsMade), "tin", "tins")]],
    tea: ["Blended tea", ["madeDate", "date"], (r) => [r.name, num(r.sachetsMade) > 0 && plural(num(r.sachetsMade), "sachet", "sachets")]],
    soap: ["Made soap", ["madeDate", "date"], (r) => [r.name, num(r.bars) > 0 && plural(num(r.bars), "bar", "bars")]],
  },
  ferments: { fermentation: ["Started a ferment", ["startDate", "date"], (r) => [r.name, r.location]] },
  bakes: { sourdough: ["Baked", ["date"], (r) => [r.recipe, num(r.loafCount) > 0 && plural(num(r.loafCount), "loaf", "loaves")]] },
  seasons: { maple_syrup: ["Started the season", ["startDate"], (r) => [r.name || (r.year && `${r.year} season`), num(r.totalTaps) > 0 && plural(num(r.totalTaps), "tap", "taps")]] },
  harvests: { hunting: ["Harvest", ["date"], (r) => [r.species, r.sex, num(r.meatLbs) > 0 ? fmtWeight(num(r.meatLbs)) : num(r.fieldDressedLbs) > 0 && fmtWeight(num(r.fieldDressedLbs))]] },
  runs: { incubator: ["Set eggs", ["dateSet", "date"], (r) => [num(r.eggsSet) > 0 && `${num(r.eggsSet)} ${r.birdType ? String(r.birdType).toLowerCase() + " " : ""}eggs`, r.name, num(r.eggsHatched) > 0 && `${num(r.eggsHatched)} hatched`]] },
  brooderBatches: { incubator: ["Chicks in the brooder", ["startDate", "date"], (r) => [r.name, num(r.initialCount) > 0 && plural(num(r.initialCount), "chick", "chicks")]] },
  breedings: {
    "*": ["Bred", ["breedDate", "bredDate", "date"], (r, n) => {
      const dam = n.get(r.damId || r.eweId || r.mareId || r.doeId);
      const sire = n.get(r.sireId || r.ramId || r.stallionId || r.buckId) || r.externalSireName || r.sireExternal;
      return [dam && sire ? `${dam} × ${sire}` : dam || sire];
    }],
  },
  litters: { "*": ["Litter", ["whelpDate", "birthDate", "date"], (r) => [num(r.totalBorn) > 0 && `${num(r.totalBorn)} born`]] },
  attacks: { "*": ["Guarded the stock", ["date"], (r, n) => [n.get(r.dogId), r.predatorType]] },
  shearings: { sheep: ["Sheared", ["date"], (r, n) => [n.get(r.animalId), num(r.woolLbs) > 0 && `${fmtWeight(num(r.woolLbs))} wool`]] },
  rides: { horses: ["Ride", ["date"], (r, n) => [n.get(r.horseId), num(r.durationMinutes) > 0 && `${num(r.durationMinutes)} min`, r.type]] },
  farrier: { horses: ["Farrier", ["date"], (r, n) => [(r.horseIds || [r.horseId]).map((id) => n.get(id)).filter(Boolean).join(", "), r.type, num(r.cost) > 0 && fmtMoney(num(r.cost))]] },
  vet: { horses: ["Vet visit", ["date"], (r, n) => [(r.horseIds || [r.horseId]).map((id) => n.get(id)).filter(Boolean).join(", "), r.vetName, num(r.cost) > 0 && fmtMoney(num(r.cost))]] },
  deworming: { horses: ["Dewormed", ["date"], (r, n) => [(r.horseIds || [r.horseId]).map((id) => n.get(id)).filter(Boolean).join(", "), r.product]] },
};

// Journal rows for one hobby's own records:
// [{ id, date, title, detail, note, isRecord: true, recordKind }]
export function journalRecords(h) {
  if (!h || typeof h !== "object") return [];
  const out = [];
  let names = null;
  for (const [key, byType] of Object.entries(SOURCES)) {
    const def = byType[h.type] || byType["*"];
    const list = h[key];
    if (!def || !Array.isArray(list) || list.length === 0) continue;
    if (!names) names = namesOf(h);
    const [title, dateKeys, detailOf] = def;
    list.forEach((r, i) => {
      if (!r || typeof r !== "object") return;
      const date = firstDate(r, dateKeys);
      if (!date) return;
      let parts = [];
      try { parts = detailOf(r, names) || []; } catch (_) { parts = []; }
      const note = typeof r.notes === "string" ? r.notes : typeof r.note === "string" ? r.note : "";
      out.push({
        id: `${key}:${r.id || i}`,
        date,
        created: Number(r.created) || 0,
        title,
        detail: parts.filter((p) => p && typeof p === "string" && p.trim()).join(" · "),
        note: note.length > 50 ? note.slice(0, 50) + "…" : note,
        isRecord: true,
        recordKind: key,
      });
    });
  }
  return out;
}
