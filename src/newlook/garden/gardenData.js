// ============================================================================
// Garden (3.0) — pure helpers for the new Garden screens
// ----------------------------------------------------------------------------
// Plant rows with a status, what to start next for the user's zone, harvest
// by crop and garden fun facts. Reads the same records as the old garden
// page (hobby.annuals, hobby.perennials, hobby.seedStarts, garden entries,
// collectGardenHarvests) so the two always agree.
// ============================================================================

import { CROPS, getFrostDates } from "../../gardenAlmanac.js";
import { autoDetectHardiness } from "../../hardiness.js";
import { collectGardenHarvests, totalHarvestLbs } from "../../analytics.js";
import { computeHarvestValue } from "../../gardenValue.js";
import { isoDay, parseDay, prettyDay, DAY } from "../eggs/eggFacts.js";

const key = (s) => String(s || "").trim().toLowerCase();
const UNIT = { lbs: "lbs", oz: "oz", each: "each", count: "", cups: "cups", pints: "pints", quarts: "quarts", bunch: "bunches", quart: "quarts", pint: "pints" };

export function harvestText(harvests) {
  const t = {};
  for (const h of harvests || []) {
    const u = (h && h.unit) || "lbs";
    t[u] = (t[u] || 0) + (Number(h.quantity != null ? h.quantity : h.qty) || 0);
  }
  return Object.keys(t).map((u) => {
    const whole = ["each", "count", "bunch"].includes(u);
    const n = whole ? Math.round(t[u]) : Number(t[u].toFixed(1));
    return `${n}${UNIT[u] ? " " + UNIT[u] : ""}`;
  }).join(" · ");
}

// This season's annuals with planted date, harvest so far and a status.
export function annualRows(hobby, data, today = isoDay()) {
  const season = hobby.currentSeason;
  if (!season) return { active: [], done: [] };
  const ents = ((data.entries && data.entries.garden) || []).filter((e) => e && e.seasonId === season.id);
  const rows = (hobby.annuals || []).filter((a) => a && a.seasonId === season.id).map((a) => {
    const k = key(a.name);
    const planted = ents.filter((e) => e.action === "planted" && key(e.plant || "Unnamed") === k).map((e) => e.date).filter(Boolean).sort()[0] || null;
    const harvests = ents.filter((e) => e.action === "harvested" && key(e.plant) === k);
    const lastHarvest = harvests.map((e) => e.date).filter(Boolean).sort().pop() || null;
    const recent = lastHarvest && (parseDay(today) - parseDay(lastHarvest)) / DAY <= 14;
    const status = a.archived ? "done" : recent ? "harvesting" : harvests.length ? "harvested" : "growing";
    const sub = [planted ? `Planted ${prettyDay(planted)}` : null, harvests.length ? `${harvestText(harvests)} picked` : null].filter(Boolean).join(" · ") || "No activity yet";
    return { id: a.id, name: a.name, status, sub, archived: !!a.archived };
  }).sort((x, y) => x.name.localeCompare(y.name));
  return { active: rows.filter((r) => !r.archived), done: rows.filter((r) => r.archived) };
}

export function perennialRows(hobby, today = isoDay()) {
  return (hobby.perennials || []).filter((p) => p && !p.archived && !p.removed).map((p) => {
    const hs = Array.isArray(p.harvests) ? p.harvests : [];
    const year = today.slice(0, 4);
    const thisYear = hs.filter((h) => String(h.date || "").startsWith(year));
    return {
      id: p.id, name: p.name || "Perennial", tree: p.category === "tree",
      sub: [p.category === "tree" ? "Tree" : "Plant", p.variety || null, p.plantDate ? `planted ${String(p.plantDate).slice(0, 4)}` : null, thisYear.length ? `${harvestText(thisYear)} this year` : null].filter(Boolean).join(" · "),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function seedStartRows(hobby) {
  const season = hobby.currentSeason;
  return (hobby.seedStarts || []).filter((b) => b && (!season || b.seasonId === season.id) && !b.archived && !b.failed).map((b) => {
    const transplanted = (b.transplants || []).reduce((s, t) => s + (Number(t.count) || 0), 0);
    const remaining = b.germinated == null ? Number(b.seedsSown) || 0 : Math.max(0, (Number(b.germinated) || 0) - transplanted - (Number(b.lost) || 0));
    const status = b.germinated == null ? "sprouting" : remaining > 0 ? "ready" : "done";
    return {
      id: b.id, name: [b.plant, b.variety].filter(Boolean).join(", ") || "Seed start",
      sub: b.germinated == null ? `${Number(b.seedsSown) || 0} sown ${b.sowDate ? prettyDay(b.sowDate) : ""}`.trim() : `${remaining} ready to transplant`,
      status,
    };
  });
}

// The zone and frost dates to plan with (saved zone, else from location).
export function frostFor(data, year) {
  let system = data.userZoneSystem, zone = data.userZone;
  const loc = data.homesteadLocation;
  if (!zone && loc && loc.lat != null) {
    try { const d = autoDetectHardiness(null, loc.lat, loc.lon); system = d.system; zone = d.zone; } catch (_) {}
  }
  if (!zone) return null;
  try { return { ...getFrostDates(zone, year, system || "USDA"), zone, system: system || "USDA" }; } catch (_) { return null; }
}

// Upcoming spring planting jobs, grouped by date: [{ date, label, crops: [] }].
export function plantingWindows(data, today = isoDay(), limit = 3) {
  const t = parseDay(today);
  let f = frostFor(data, t.getFullYear());
  if (!f) return null;
  if (f.lastFrost < new Date(t.getTime() - 60 * DAY)) f = frostFor(data, t.getFullYear() + 1);
  const jobs = [];
  for (const c of CROPS) {
    const m = c.methods || {};
    const short = String(c.name || "").replace(/\s*\(.*\)\s*/, "").trim();
    if (m.indoor && m.indoor.weeksBeforeLastFrost != null) jobs.push({ when: new Date(f.lastFrost.getTime() - m.indoor.weeksBeforeLastFrost * 7 * DAY), verb: "Start indoors", crop: short });
    else if (m.direct && m.direct.weeksRelativeToLastFrost != null) jobs.push({ when: new Date(f.lastFrost.getTime() + m.direct.weeksRelativeToLastFrost * 7 * DAY), verb: "Sow outside", crop: short });
  }
  const groups = new Map();
  for (const j of jobs) {
    if (j.when < t) continue;
    const d = isoDay(j.when);
    const k = `${d}|${j.verb}`;
    const g = groups.get(k) || { date: d, verb: j.verb, crops: [] };
    g.crops.push(j.crop);
    groups.set(k, g);
  }
  const list = [...groups.values()].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, limit);
  return { zone: f.zone, label: f.label, lastFrost: isoDay(f.lastFrost), firstFrost: isoDay(f.firstFrost), list };
}

export function seasonHarvests(data, hobby) {
  const season = hobby.currentSeason;
  return season ? collectGardenHarvests(data, { seasonId: season.id, season }) : [];
}

// Harvest by crop for the bar list: [{ plant, lbs, value }], by weight.
export function harvestByCrop(harvests, overrides) {
  const { rows, total } = computeHarvestValue(harvests, overrides || {});
  const byPlant = new Map();
  for (const h of harvests) {
    const p = String(h.plant || "Unknown").trim() || "Unknown";
    const g = byPlant.get(key(p)) || { plant: p, lbs: 0, value: 0 };
    if (!h.unit || h.unit === "lbs") g.lbs += Number(h.quantity != null ? h.quantity : h.qty) || 0;
    if (h.unit === "oz") g.lbs += (Number(h.quantity != null ? h.quantity : h.qty) || 0) / 16;
    byPlant.set(key(p), g);
  }
  for (const r of rows) { const g = byPlant.get(key(r.plant)); if (g) g.value += r.value; }
  return { total, crops: [...byPlant.values()].sort((a, b) => b.value - a.value || b.lbs - a.lbs) };
}

export function gardenFunFacts({ data, hobby, harvests, today = isoDay() }) {
  const facts = [];
  const { crops } = harvestByCrop(harvests, hobby.harvestPrices);
  const money = (v) => `$${Math.round(v).toLocaleString("en-US")}`;
  if (crops[0] && crops[0].value >= 5) {
    facts.push({ key: "topcrop", icon: "harvest", big: money(crops[0].value), line: `of ${key(crops[0].plant)} from our garden`,
      title: `Your ${key(crops[0].plant)} alone were worth ${money(crops[0].value)}`, sub: "At grocery store prices." });
  }
  const byDay = new Map();
  for (const h of harvests) if (h.date && (!h.unit || h.unit === "lbs")) byDay.set(h.date, (byDay.get(h.date) || 0) + (Number(h.quantity != null ? h.quantity : h.qty) || 0));
  if (byDay.size >= 3) {
    const [d, lbs] = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
    if (lbs >= 2) facts.push({ key: "bigday", icon: "trophy", big: `${Math.round(lbs)} lbs`, line: `our biggest harvest, ${prettyDay(d)}`, title: `Biggest haul: ${Math.round(lbs)} lbs on ${prettyDay(d)}`, sub: "Your best picking day this season." });
  }
  const season = hobby.currentSeason;
  const waters = ((data.entries && data.entries.garden) || []).filter((e) => e && e.action === "watered" && (!season || e.seasonId === season.id)).length;
  if (waters >= 5) facts.push({ key: "water", icon: "water", big: String(waters), line: "times we watered this season", title: `You watered ${waters} times this season`, sub: waters >= 50 ? "That's dedication." : "Every one of them counted." });
  const lbs = totalHarvestLbs(harvests);
  if (lbs >= 10) facts.push({ key: "salads", icon: "leaf", big: `${Math.round(lbs).toLocaleString("en-US")} lbs`, line: "of food from our garden", title: `That's about ${Math.round(lbs * 4).toLocaleString("en-US")} side dishes`, sub: `${Math.round(lbs)} lbs at roughly a quarter pound each.` });
  return facts;
}

// "Start your 2027 garden": from February 1, or six weeks before the last
// spring frost if that's earlier, through June, when the garden's open
// season started in a past year (or the last one was closed and nothing has
// started this year). Never closes anything by itself; the user taps.
// Returns { year, open: season|null, last: season|null } or null.
export function gardenNewSeasonDue(hobby, data, today = isoDay()) {
  if (!hobby || hobby.hidden) return null;
  const year = Number(today.slice(0, 4));
  if (today > `${year}-06-30`) return null;
  if ((data.gardenSeasonPrompt || {})[year]) return null;
  let start = `${year}-02-01`;
  const f = frostFor(data, year);
  if (f && f.lastFrost) {
    const early = new Date(f.lastFrost.getTime() - 42 * DAY);
    const iso = isoDay(early);
    if (iso < start) start = iso;
  }
  if (today < start) return null;
  const cur = hobby.currentSeason;
  if (cur) {
    const y = Number(String(cur.startDate || "").slice(0, 4));
    return y && y < year ? { year, open: cur, last: null } : null;
  }
  const past = (hobby.archivedSeasons || []).filter(Boolean)
    .sort((a, b) => String(b.endDate || b.startDate || "").localeCompare(String(a.endDate || a.startDate || "")));
  if (!past.length) return null;
  const y = Number(String(past[0].startDate || "").slice(0, 4));
  return y && y < year ? { year, open: null, last: past[0] } : null;
}
