// ============================================================================
// Pre-orders: how much a homestead can promise, and by when
// ----------------------------------------------------------------------------
// Used by the public order page (api/order-page.js) and the Orders screen
// (src/Orders.jsx), so the customer and the owner see the same dates.
// Pure functions only, no browser or Node APIs.
//
// Each menu item can say where it comes from (owner-only, never sent to the
// public page as-is):
//
//   m.supply = {
//     from:  ''        not tracked: no limit, no estimates (the default)
//            'stand'   a farm stand item (m.standItemId): what's on the stand,
//                      ready back stock, and batches with a ready date
//            'eggs'    egg layer flocks: eggs on hand + what they lay
//            'milk'    goats, cows or sheep: what they give
//            'garden'  one garden crop: what it's been producing
//            'make'    made to order, with a limit per pickup day or week
//            'birds'   meat birds: live batches ready at N weeks, plus the
//                      freezer (butchered this year, less what's sold)
//            'hatch'   incubator: chicks from runs due to hatch, and recent
//                      hatches
//            'births'  goats, sheep, cows, pigs, rabbits: young from bred
//                      animals, ready N weeks after the due date
//     hobbyId, flocks: [flockId], animals: [animalId], plant,
//     readyWeeks    'birds': weeks from start to ready; 'births': weeks from
//                   birth until they can go home
//     perBirth      'births': young expected from each birth
//     rate          'hatch': share of eggs that hatch (0..1)
//     birdType      'hatch': only runs of this bird
//     per,          base units in one menu unit (12 eggs in a dozen, 128 oz
//                   in a gallon, 1 lb in a lb), guessed from the unit
//     keepPerWeek,  base units kept back for the family each week
//     cap, capPer,  'make': how many per 'pickup' day or per 'week'
//   }
//   m.preorder   'stand': let people order past what's ready (the others
//                always can, that's the point of them)
//   m.showAhead  show customers how much is already ordered ahead of them
//
// Live producers (eggs, milk, garden) are measured in the app, which has the
// logs, and saved as small snapshots the server can read without the logs:
//   data.orderPage.snaps = { [sourceKey]: { onHand, perDay, asOf, from, batches } }
// onHand and perDay are in base units (eggs, fl oz, the harvest unit, birds).
// from: the day perDay starts (a crop not harvesting yet, from its planned
// harvest date). batches: [{ on, qty }] coming in on a day (a batch of birds
// ready, a hatch, a kidding).
//
// Standing orders (repeat_weeks on an order) count again every N weeks.
//
// How the dates work. Every source has a supply curve in base units:
//   stock sources (stand, eggs, milk, garden): S(day) = what's ready now +
//     perDay × days + batches ready by that day. Units keep: eggs laid on
//     Monday can fill Saturday's order.
//   slot sources ('make'): a fixed number per pickup day or per week. Unused
//     room doesn't carry over.
// Open orders (new, accepted, ready) line up in the order they came in. Each
// is ready on the first day the curve covers it without taking from anyone
// ahead of it, and is promised for the day it wants (or the day it can be
// ready, if that's later). A new order can have whatever isn't promised to
// anyone yet, so taking it never makes an earlier order late, and the date a
// customer was told stays put as later orders come in.
// ============================================================================

import { computeEggsOnHand } from "./eggInventory.js";
import { hobbyAllEntries } from "./allEntries.js";

export const HORIZON = 180;            // days ahead the page plans for (Easter from November)
export const RATE_DAYS = 14;           // logs used to measure a rate
export const SNAP_STALE_DAYS = 21;     // older snapshots aren't trusted
export const SUPPLY_FROM = ["", "stand", "eggs", "milk", "garden", "make", "birds", "hatch", "births"];
export const LIVE_FROM = ["eggs", "milk", "garden", "birds", "hatch", "births"];
const LIVE_KEY = /^(eggs|milk|garden|birds|hatch|births):/;
// Weeks from chick to ready, by bird; weeks from birth to going home, and
// young per birth, by animal. Owners can change them per item.
export const BIRD_WEEKS = { Chicken: 8, Duck: 9, Turkey: 18, Goose: 16, Quail: 7, Guinea: 16 };
export const BIRTH_DEFAULTS = { goats: { perBirth: 2, readyWeeks: 8 }, sheep: { perBirth: 1.5, readyWeeks: 8 }, cows: { perBirth: 1, readyWeeks: 26 }, pigs: { perBirth: 8, readyWeeks: 8 }, rabbits: { perBirth: 6, readyWeeks: 8 } };
const OPEN = new Set(["new", "accepted", "ready"]);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const pos = (v) => Math.max(0, num(v));
const r3 = (n) => Math.round(n * 1000) / 1000;
const clipId = (s) => String(s == null ? "" : s).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);

// ---------------------------------------------------------------- dates
export function addDays(iso, n) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export function daysBetween(a, b) {
  if (!ISO.test(String(a)) || !ISO.test(String(b))) return NaN;
  const t = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}
const weekday = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };

// ---------------------------------------------------------------- units
// Base units per menu unit, guessed from the unit name.
export function eggsIn(unit) {
  const u = String(unit || "").toLowerCase();
  if (/half/.test(u) && /doz|dz/.test(u)) return 6;
  if (/doz|dz/.test(u)) return 12;
  if (/flat|tray/.test(u)) return 30;
  if (/^\s*eggs?\s*$/.test(u)) return 1;
  return 12;
}
export function ozIn(unit) {
  const u = String(unit || "").toLowerCase();
  if (/half/.test(u) && /gal/.test(u)) return 64;
  if (/gal/.test(u)) return 128;
  if (/quart|\bqt/.test(u)) return 32;
  if (/pint|\bpt/.test(u)) return 16;
  if (/cup/.test(u)) return 8;
  if (/\bml\b|millil/.test(u)) return 0.0338;
  if (/lit|^\s*l\s*$/.test(u)) return 33.814;
  if (/oz|ounce/.test(u)) return 1;
  return 128;
}
// Garden harvests are logged in lbs, oz, kg or a count ("each", "bunch").
export function harvestIn(menuUnit, harvestUnit) {
  const w = (u) => {
    const s = String(u || "").toLowerCase().trim();
    if (/^(lb|lbs|pound|pounds)$/.test(s)) return 16;
    if (/^(oz|ounce|ounces)$/.test(s)) return 1;
    if (/^(kg|kilo|kilos|kilogram|kilograms)$/.test(s)) return 35.274;
    if (/^(g|gram|grams)$/.test(s)) return 0.035274;
    return 0;
  };
  const a = w(menuUnit), b = w(harvestUnit || "lbs");
  return a && b ? r3(a / b) : 1;
}
export function guessPer(from, unit, harvestUnit) {
  if (from === "eggs") return eggsIn(unit);
  if (from === "milk") return ozIn(unit);
  if (from === "garden") return harvestIn(unit, harvestUnit);
  return 1;
}
export const baseLabel = (from, harvestUnit) => (from === "eggs" ? "eggs" : from === "milk" ? "oz" : from === "garden" ? (harvestUnit || "lbs") : "");

// ---------------------------------------------------------------- config
export function cleanSupply(s, unit) {
  const o = s && typeof s === "object" ? s : {};
  const from = SUPPLY_FROM.includes(o.from) ? o.from : "";
  const ids = (a) => [...new Set((Array.isArray(a) ? a : []).map(clipId).filter(Boolean))].sort().slice(0, 40);
  const out = { from };
  if (from === "eggs" || from === "milk" || from === "garden") {
    out.hobbyId = clipId(o.hobbyId);
    if (from === "eggs") out.flocks = ids(o.flocks);
    if (from === "milk") out.animals = ids(o.animals);
    if (from === "garden") out.plant = String(o.plant || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 60);
    out.per = pos(o.per) > 0 ? r3(Math.min(100000, pos(o.per))) : guessPer(from, unit);
    out.keepPerWeek = r3(Math.min(1000000, pos(o.keepPerWeek)));
  }
  if (from === "make") {
    out.cap = Math.min(9999, Math.floor(pos(o.cap)));
    out.capPer = o.capPer === "week" ? "week" : "pickup";
  }
  if (from === "birds" || from === "hatch" || from === "births") {
    out.hobbyId = clipId(o.hobbyId);
    out.per = 1;
    if (from !== "hatch") out.readyWeeks = pos(o.readyWeeks) > 0 ? Math.min(104, r3(pos(o.readyWeeks))) : 0;
    if (from === "births") out.perBirth = pos(o.perBirth) > 0 ? Math.min(30, r3(pos(o.perBirth))) : 0;
    if (from === "hatch") {
      out.rate = pos(o.rate) > 0 ? Math.min(1, r3(pos(o.rate))) : 0;
      out.birdType = String(o.birdType || "").replace(/[^A-Za-z ]/g, "").slice(0, 20);
    }
  }
  return out;
}

// Which supply an item draws from. Items that share one (a dozen and a half
// dozen from the same hens) share a key, so they share the eggs.
export function sourceKey(m) {
  const s = cleanSupply(m && m.supply, m && m.unit);
  if (s.from === "stand" || (!s.from && m && m.standItemId)) return m.standItemId ? `stand:${clipId(m.standItemId)}` : "";
  if (s.from === "eggs") return `eggs:${s.hobbyId}:${s.flocks.join(",") || "all"}`;
  if (s.from === "milk") return `milk:${s.hobbyId}:${s.animals.join(",") || "all"}`;
  if (s.from === "garden") return `garden:${s.hobbyId}:${s.plant.toLowerCase()}`;
  if (s.from === "make") return `make:${clipId(m.id)}`;
  if (s.from === "birds" || s.from === "births") return `${s.from}:${s.hobbyId}:${s.readyWeeks || "d"}${s.from === "births" ? `:${s.perBirth || "d"}` : ""}`;
  if (s.from === "hatch") return `hatch:${s.hobbyId}:${s.birdType.toLowerCase() || "all"}:${s.rate || "d"}`;
  return "";
}
// Base units in one of this item's units.
export function perUnit(m) {
  const s = cleanSupply(m && m.supply, m && m.unit);
  return s.from === "eggs" || s.from === "milk" || s.from === "garden" ? s.per : 1;
}
// Upcoming dates of a standing order (its first day, then every N weeks).
export function repeatDates(firstIso, weeks, today, count = 4) {
  const out = [];
  if (!ISO.test(String(firstIso)) || !(weeks > 0)) return out;
  let d = firstIso;
  while (d < today) d = addDays(d, weeks * 7);
  for (let k = 0; k < count; k++) { out.push(d); d = addDays(d, weeks * 7); }
  return out;
}
// Can customers order past what's ready? Stand items only when the owner
// says so; live producers and made-to-order always; untracked has no limit.
export function takesPreorders(m) {
  const key = sourceKey(m);
  if (!key) return false;
  if (key.startsWith("stand:")) return m.preorder === true;
  return true;
}

// ---------------------------------------------------------------- measuring (app)
const inWindow = (e, from, to) => e && ISO.test(String(e.date)) && e.date >= from && e.date <= to;
// A daily rate from the last RATE_DAYS days of logs (ending yesterday, so a
// half-logged today doesn't drag it down). Needs at least 3 days of history.
function rateFrom(entries, today, amount) {
  const end = addDays(today, -1);
  const start = addDays(today, -RATE_DAYS);
  const all = entries.filter((e) => e && ISO.test(String(e.date)) && amount(e) > 0);
  if (!all.length) return null;
  const first = all.reduce((a, e) => (e.date < a ? e.date : a), all[0].date);
  const days = Math.min(RATE_DAYS, daysBetween(first, today));
  if (!(days >= 3)) return null;
  const total = all.filter((e) => inWindow(e, start, end)).reduce((n, e) => n + amount(e), 0);
  return r3(total / days);
}
const hobbyById = (data, id) => ((data && data.hobbies) || []).find((h) => h && h.id === id) || null;
const liveEntries = (data, id) => (data && data.entries && Array.isArray(data.entries[id]) ? data.entries[id] : []);

// { onHand, perDay } in base units for one live source, from the app's data.
export function measureSource(data, supply, today) {
  const s = cleanSupply(supply);
  const h = hobbyById(data, s.hobbyId);
  if (!h) return null;
  const entries = liveEntries(data, h.id);
  if (s.from === "eggs") {
    const want = s.flocks.length ? new Set(s.flocks) : null;
    const laid = entries.filter((e) => (e.action === "eggs" || e.action === "eggs_laid") && (!want || want.has(e.flockId)));
    const perDay = rateFrom(laid, today, (e) => num(e.count));
    // Eggs on hand is one count for the whole hobby (what's in the fridge).
    // When only some flocks count (layers, not the silkies), count their
    // share of it: the share of the last two weeks' eggs they laid.
    const total = computeEggsOnHand(h, entries, (data && data.sales) || []);
    let onHand = total == null ? 0 : Math.max(0, total);
    if (want && onHand > 0) {
      const all = rateFrom(entries.filter((e) => e.action === "eggs" || e.action === "eggs_laid"), today, (e) => num(e.count));
      onHand = all > 0 && perDay != null ? onHand * Math.min(1, perDay / all) : onHand;
    }
    return { onHand: Math.floor(onHand), perDay: perDay == null ? null : perDay, counted: total != null };
  }
  if (s.from === "milk") {
    const want = s.animals.length ? new Set(s.animals) : null;
    const milk = entries.filter((e) => e.action === "milk" && (!want || want.has(e.animalId)));
    const oz = (e) => (e.oz != null ? num(e.oz) : num(e.gallons) * 128);
    return { onHand: 0, perDay: rateFrom(milk, today, oz), counted: false };
  }
  if (s.from === "garden") {
    const name = s.plant.toLowerCase();
    const all = hobbyAllEntries(data, h.id);
    const unit = harvestUnitOf(all, s.plant);
    const isCrop = (e) => e && e.action === "harvested" && String(e.plant || "").trim().toLowerCase() === name;
    const amt = (e) => (String(e.unit || "lbs").toLowerCase() === unit.toLowerCase() ? num(e.quantity) : num(e.quantity) * harvestIn(e.unit || "lbs", unit));
    const perDay = rateFrom(entries.filter(isCrop), today, amt);
    if (perDay) return { onHand: 0, perDay, counted: false, unit };
    // Not harvesting yet: if it's planned on the calendar, expect last
    // year's pace from the planned harvest day.
    const planned = plannedHarvest(data, s.plant, today);
    const last = lastSeasonRate(all.filter(isCrop), amt, today);
    if (planned && last) return { onHand: 0, perDay: last, from: planned, counted: false, unit, planned: true };
    return { onHand: 0, perDay, counted: false, unit };
  }
  if (s.from === "birds") return measureBirds(data, h, s, today);
  if (s.from === "hatch") return measureHatch(h, s, today);
  if (s.from === "births") return measureBirths(data, h, s, today);
  return null;
}

// The first planned harvest for a crop on the calendar (Plan a crop), on or
// after a week ago.
function plannedHarvest(data, plant, today) {
  const want = String(plant || "").trim().toLowerCase().replace(/(es|s)$/, "");
  if (!want) return "";
  const soon = addDays(today, -7);
  const hit = ((data && data.calendarEvents) || [])
    .filter((e) => e && e.kind === "harvest" && ISO.test(String(e.date)) && e.date >= soon)
    .filter((e) => `${e.cropId || ""} ${e.title || ""} ${e.varietyName || ""}`.toLowerCase().replace(/-/g, " ").includes(want))
    .map((e) => e.date).sort()[0];
  return hit ? (hit < today ? today : hit) : "";
}
// A crop's pace in its last season: what it gave over the days it gave it.
function lastSeasonRate(harvests, amt, today) {
  const past = harvests.filter((e) => ISO.test(String(e.date)) && e.date < addDays(today, -RATE_DAYS));
  if (!past.length) return null;
  const year = past.map((e) => e.date.slice(0, 4)).sort().pop();
  const that = past.filter((e) => e.date.startsWith(year));
  const dates = that.map((e) => e.date).sort();
  const days = Math.max(RATE_DAYS, daysBetween(dates[0], dates[dates.length - 1]) + 1);
  const total = that.reduce((n, e) => n + amt(e), 0);
  return total > 0 ? r3(total / days) : null;
}

// Meat birds: each live batch is ready readyWeeks after it started; birds
// already past that count as ready now, plus what's in the freezer (birds
// butchered in the last year, less meat bird sales in the last year).
function measureBirds(data, h, s, today) {
  const entries = liveEntries(data, h.id);
  const batches = [];
  let onHand = 0;
  (h.currentBatches || []).filter((b) => b && b.id && ISO.test(String(b.startDate))).forEach((b) => {
    const deaths = entries.filter((e) => e && e.action === "death" && e.batchId === b.id).reduce((n, e) => n + (num(e.count) || 1), 0);
    const culled = entries.filter((e) => e && e.action === "note" && e.batchId === b.id && num(e.cullCount) > 0).reduce((n, e) => n + num(e.cullCount), 0);
    const butchered = (b.butchered || []).reduce((n, x) => n + num(x && x.count), 0);
    const live = Math.max(0, num(b.startCount) - deaths - culled - butchered + num(b.countAdjustment));
    if (!live) return;
    const weeks = s.readyWeeks || BIRD_WEEKS[b.birdType] || 10;
    const on = addDays(b.startDate, Math.round(weeks * 7));
    if (on <= today) onHand += live; else batches.push({ on, qty: live });
  });
  const yearAgo = addDays(today, -365);
  const inFreezer = [...(h.currentBatches || []), ...(h.archivedBatches || [])]
    .reduce((n, b) => n + ((b && b.butchered) || []).filter((x) => x && (!x.date || x.date >= yearAgo)).reduce((k, x) => k + num(x.count), 0), 0);
  const sold = ((data && data.sales) || []).filter((x) => x && x.hobbyType === "meat_chickens" && String(x.date || "") >= yearAgo).reduce((n, x) => n + pos(x.qty), 0);
  onHand += Math.max(0, inFreezer - sold);
  return { onHand: Math.floor(onHand), perDay: 0, counted: true, batches };
}

// Incubator: runs still incubating hatch on their hatch day (eggs set ×
// hatch rate); runs that hatched in the last 3 weeks count as chicks now.
function measureHatch(h, s, today) {
  const runs = (h.runs || []).filter((r) => r && (!s.birdType || String(r.birdType || "").toLowerCase() === s.birdType.toLowerCase()));
  const done = runs.filter((r) => r.status === "hatched" && num(r.eggsSet) > 0 && r.eggsHatched != null);
  const past = done.length ? done.reduce((n, r) => n + num(r.eggsHatched), 0) / done.reduce((n, r) => n + num(r.eggsSet), 0) : 0;
  const rate = s.rate || (past > 0 ? Math.min(1, past) : 0.7);
  const recent = addDays(today, -21);
  let onHand = 0;
  const batches = [];
  runs.forEach((r) => {
    if (r.status === "hatched" && ISO.test(String(r.hatchedDate || r.hatchDate)) && String(r.hatchedDate || r.hatchDate) >= recent) onHand += num(r.eggsHatched);
    else if ((r.status === "incubating" || r.status === "lockdown") && ISO.test(String(r.hatchDate)) && num(r.eggsSet) > 0) {
      const qty = Math.floor(num(r.eggsSet) * rate);
      if (r.hatchDate <= today) onHand += qty; else batches.push({ on: r.hatchDate, qty });
    }
  });
  return { onHand: Math.floor(onHand), perDay: 0, counted: true, batches, rate: r3(rate) };
}

// Births: animals bred with a due date coming up; the young can go home
// readyWeeks after they're born.
function measureBirths(data, h, s, today) {
  const d = BIRTH_DEFAULTS[h.type] || { perBirth: 1, readyWeeks: 8 };
  const per = s.perBirth || d.perBirth;
  const weeks = s.readyWeeks || d.readyWeeks;
  const dues = [];
  (h.breedings || []).forEach((b) => {
    if (!b || b.birthedDate) return;
    const due = b.expectedBirthDate || b.expectedLambDate || "";
    if (ISO.test(String(due))) dues.push(due);
  });
  // Pigs and rabbits keep it on the breeding log.
  liveEntries(data, h.id).forEach((e) => {
    if (!e || e.action !== "bred") return;
    const due = e.farrowDate || e.kindleDate || "";
    if (ISO.test(String(due)) && !e.birthedDate) dues.push(due);
  });
  const batches = [];
  let onHand = 0;
  dues.filter((due) => due >= addDays(today, -Math.round(weeks * 7) - 14)).forEach((due) => {
    const on = addDays(due, Math.round(weeks * 7));
    const qty = per;
    if (on <= today) onHand += qty; else batches.push({ on, qty });
  });
  return { onHand: Math.floor(onHand), perDay: 0, counted: true, batches: batches.map((b) => ({ ...b, qty: r3(b.qty) })) };
}
// The unit a crop's harvests are mostly logged in.
export function harvestUnitOf(entries, plant) {
  const name = String(plant || "").trim().toLowerCase();
  const n = {};
  (entries || []).forEach((e) => { if (e && e.action === "harvested" && String(e.plant || "").trim().toLowerCase() === name) { const u = String(e.unit || "lbs"); n[u] = (n[u] || 0) + 1; } });
  return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || "lbs";
}

// Snapshots for every live source on the menu. Returns the snaps object.
export function measureSnaps(data, menu, today) {
  const out = {};
  (Array.isArray(menu) ? menu : []).forEach((m) => {
    const key = sourceKey(m);
    if (!key || out[key] || !LIVE_KEY.test(key)) return;
    const got = measureSource(data, m.supply, today);
    if (!got) return;
    const snap = { onHand: got.onHand, perDay: got.perDay == null ? null : got.perDay, asOf: today };
    if (got.from && got.from > today) snap.from = got.from;
    if (got.batches && got.batches.length) snap.batches = got.batches.slice(0, 40);
    out[key] = snap;
  });
  return out;
}
// Same snapshots, ignoring asOf? Used to skip writes that change nothing.
export function sameSnaps(a, b) {
  const ka = Object.keys(a || {}).sort(), kb = Object.keys(b || {}).sort();
  if (ka.join("|") !== kb.join("|")) return false;
  return ka.every((k) => a[k].onHand === b[k].onHand && a[k].perDay === b[k].perDay && a[k].asOf === b[k].asOf
    && (a[k].from || "") === (b[k].from || "") && JSON.stringify(a[k].batches || []) === JSON.stringify(b[k].batches || []));
}

// ---------------------------------------------------------------- sources
// Turns the menu + what the server (or app) knows into sources:
//   { key, mode: 'stock', now, perDay, batches: [{ day, qty }] }   base units
//   { key, mode: 'slot', slots: [{ start, end, show, cap }] }      menu units
// ctx: { today, hobbies, snaps, pickupDays }
export function buildSources(menu, ctx) {
  const today = ctx.today;
  const stand = ((ctx.hobbies || []).find((h) => h && h.id === "farmstand") || {}).items || [];
  const groups = new Map();
  (Array.isArray(menu) ? menu : []).forEach((m) => {
    const key = sourceKey(m);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  });
  const out = new Map();
  groups.forEach((items, key) => {
    const m = items[0];
    const s = cleanSupply(m.supply, m.unit);
    if (key.startsWith("stand:")) {
      const found = stand.find((i) => i && i.id === m.standItemId);
      if (!found) return;
      // Taken off the stand: nothing at the stand to sell (what's left in
      // back stock or at home still counts).
      const it = found.archived ? { ...found, trackStock: true, stock: 0 } : found;
      const back = (Array.isArray(it.backStock) ? it.backStock : []).filter((b) => b && num(b.qty) > 0);
      let readyNow = back.filter((b) => !b.readyOn || b.readyOn <= today).reduce((n, b) => n + num(b.qty), 0);
      const batches = back.filter((b) => b.readyOn && b.readyOn > today).map((b) => ({ day: daysBetween(today, b.readyOn), qty: num(b.qty) })).filter((b) => b.day > 0);
      // What the app saw waiting at home for this item in other hobbies
      // (curing soap, jars on the shelf, eggs on hand; src/homeInventory.js).
      const home = ctx.snaps && ctx.snaps[key];
      if (home && ISO.test(String(home.asOf)) && daysBetween(home.asOf, today) <= SNAP_STALE_DAYS) {
        readyNow += pos(home.onHand);
        (Array.isArray(home.batches) ? home.batches : []).forEach((b) => {
          if (!b || !ISO.test(String(b.on)) || !(pos(b.qty) > 0)) return;
          const day = daysBetween(today, b.on);
          if (day <= 0) readyNow += pos(b.qty); else batches.push({ day, qty: pos(b.qty) });
        });
      }
      if (!it.trackStock && !readyNow && !batches.length) return; // not counted: no limit
      out.set(key, { key, mode: "stock", now: (it.trackStock ? Math.max(0, num(it.stock)) : 0) + readyNow, perDay: 0, batches });
      return;
    }
    if (key.startsWith("make:")) {
      if (!(s.cap > 0)) return;
      out.set(key, { key, mode: "slot", slots: makeSlots(today, s.cap, s.capPer, ctx.pickupDays) });
      return;
    }
    const snap = ctx.snaps && ctx.snaps[key];
    if (!snap || !ISO.test(String(snap.asOf))) return;
    // The app dates it in the owner's time zone, the server in Central, so
    // a snapshot can look a day "ahead"; treat that as today.
    const age = Math.max(0, daysBetween(snap.asOf, today));
    if (!(daysBetween(snap.asOf, today) >= -2) || age > SNAP_STALE_DAYS) return;
    const keep = Math.max(...items.map((x) => cleanSupply(x.supply, x.unit).keepPerWeek || 0)) / 7;
    const perDay = snap.perDay == null ? 0 : Math.max(0, num(snap.perDay) - keep);
    // A rate that starts later (a crop not harvesting yet) starts from that day.
    const start = ISO.test(String(snap.from || "")) ? daysBetween(today, snap.from) : -age;
    const grown = perDay * Math.max(0, Math.min(age, -start));
    const batches = (Array.isArray(snap.batches) ? snap.batches : []).filter((b) => b && ISO.test(String(b.on)) && pos(b.qty) > 0)
      .map((b) => ({ day: daysBetween(today, b.on), qty: pos(b.qty) }));
    const due = batches.filter((b) => b.day <= 0).reduce((n, b) => n + b.qty, 0);
    out.set(key, { key, mode: "stock", now: Math.max(0, num(snap.onHand)) + grown + due, perDay, start: Math.max(0, start), batches: batches.filter((b) => b.day > 0) });
  });
  return out;
}
// Pickup days (or weeks) ahead, each with room for `cap`.
export function makeSlots(today, cap, per, pickupDays) {
  const days = Array.isArray(pickupDays) ? pickupDays : [];
  const slots = [];
  if (per === "week") {
    // Weeks run Monday to Sunday; the week we're in counts.
    const back = (weekday(today) + 6) % 7;
    for (let w = 0; w * 7 - back <= HORIZON; w++) {
      const start = Math.max(0, w * 7 - back), end = w * 7 - back + 6;
      if (end < 0) continue;
      let show = start;
      if (days.length) { for (let d = start; d <= end; d++) if (days.includes(weekday(addDays(today, d)))) { show = d; break; } }
      slots.push({ start, end, show, cap });
    }
    return slots;
  }
  for (let d = 0; d <= HORIZON; d++) {
    if (!days.length || days.includes(weekday(addDays(today, d)))) slots.push({ start: d, end: d, show: d, cap });
  }
  return slots;
}

// ---------------------------------------------------------------- demand
// Open orders → per source, the units each order needs, lined up.
// orders: [{ id, status, items: [{ id, qty }], pickup_date, created_at }]
export function demandBySource(menu, orders, today) {
  const byId = new Map((Array.isArray(menu) ? menu : []).map((m) => [String(m.id), m]));
  const out = new Map();
  (Array.isArray(orders) ? orders : []).forEach((o, seq) => {
    if (!o || (o.status && !OPEN.has(o.status)) || (o.kind && o.kind !== "order")) return;
    const due = ISO.test(String(o.pickup_date || "")) ? Math.max(0, daysBetween(today, o.pickup_date)) : 0;
    // A standing order counts again every N weeks, as far as we plan.
    const every = Math.floor(num(o.repeat_weeks)) * 7;
    const dues = [due];
    if (every > 0) for (let d = due + every; d <= HORIZON; d += every) dues.push(d);
    (Array.isArray(o.items) ? o.items : []).forEach((i) => {
      const m = i && byId.get(String(i.id));
      const key = m && sourceKey(m);
      if (!key) return;
      const units = key.startsWith("make:") ? pos(i.qty) : pos(i.qty) * perUnit(m);
      if (!(units > 0)) return;
      if (!out.has(key)) out.set(key, []);
      dues.forEach((d, k) => out.get(key).push({ id: k ? `${o.id}#${k}` : o.id, due: d, at: String(o.created_at || ""), seq, units }));
    });
  });
  // First come, first served: in the order they came in (a standing order's
  // weeks in date order).
  out.forEach((list) => list.sort((a, b) => a.at.localeCompare(b.at) || a.seq - b.seq || a.due - b.due));
  return out;
}

// ---------------------------------------------------------------- planning
const supplyAt = (src, d) => src.now + src.perDay * Math.max(0, d - (src.start || 0)) + src.batches.reduce((n, b) => n + (b.day <= d ? b.qty : 0), 0);
// First day (0..HORIZON) the curve reaches `need`, or null.
function firstDay(src, need) {
  if (need <= src.now + 1e-9) return 0;
  // The curve only steps up on whole days and batch days; check each day.
  for (let d = 1; d <= HORIZON; d++) if (supplyAt(src, d) + 1e-9 >= need) return d;
  return null;
}

// Plans one source. Returns
//   ready: Map(orderId → day or null)  when each open order should be ready
//   free:  [[day, units]]  what a new order could have by each day (stock),
//          rising steps; or [[start, end, show, room]] per slot (slots)
//   ahead: units already ordered
export const AHEAD_DAYS = 14;
export function planSource(src, demand) {
  const list = demand || [];
  const ready = new Map();
  // Already in line for the next two weeks: each order once (a standing
  // order's later weeks, or an order for Easter, aren't "ahead" of someone
  // who wants eggs this week).
  const ahead = list.filter((x) => !String(x.id).includes("#") && x.due <= AHEAD_DAYS).reduce((n, x) => n + x.units, 0);
  const setReady = (id, at) => { const prev = ready.has(id) ? ready.get(id) : 0; ready.set(id, at == null || prev == null ? null : Math.max(prev, at)); };
  if (src.mode === "slot") {
    const room = src.slots.map((s) => s.cap);
    list.forEach((x) => {
      let i = src.slots.findIndex((s) => s.end >= x.due);
      if (i < 0) { setReady(x.id, null); return; }
      // An order picks up all at once: the first slot with room for all of
      // it. Only an order bigger than a whole slot is spread over the slots
      // from here (same as readyForNew below).
      let at = null;
      const one = x.units <= src.slots[i].cap + 1e-9 ? room.findIndex((r, k) => k >= i && r + 1e-9 >= x.units) : -1;
      if (one >= 0) { room[one] -= x.units; at = src.slots[one].show; }
      else if (x.units <= src.slots[i].cap + 1e-9) at = null;
      else {
        let left = x.units;
        const take = [];
        for (let k = i; k < room.length && left > 1e-9; k++) { const t = Math.min(room[k], left); if (t > 0) take.push([k, t]); left -= t; at = src.slots[k].show; }
        if (left > 1e-9) at = null; else take.forEach(([k, t]) => { room[k] -= t; });
      }
      setReady(x.id, at);
    });
    return { mode: "slot", ready, ahead, free: src.slots.map((s, k) => [s.start, s.end, s.show, Math.max(0, r3(room[k])), s.cap]) };
  }
  // Stock. Each order, in the order they came in, gets the first day the
  // eggs (or birds, or jars) not promised to anyone before it cover it, and
  // is then promised on its own day (or that day, if it can't be on time).
  // That's exactly what the page told each customer when they ordered, so a
  // later order never moves an earlier one back.
  const S = new Array(HORIZON + 1);
  for (let t = 0; t <= HORIZON; t++) S[t] = supplyAt(src, t);
  const dueBy = new Array(HORIZON + 1).fill(0);
  const slackNow = () => {
    const sl = new Array(HORIZON + 1);
    let cum = 0;
    for (let t = 0; t <= HORIZON; t++) { cum += dueBy[t]; sl[t] = S[t] - cum; }
    for (let t = HORIZON - 1; t >= 0; t--) sl[t] = Math.min(sl[t], sl[t + 1]);
    return sl;
  };
  list.forEach((x) => {
    const sl = slackNow();
    let d = null;
    for (let t = 0; t <= HORIZON; t++) if (sl[t] + 1e-9 >= x.units) { d = t; break; }
    setReady(x.id, d);
    // Can't be filled within the horizon: it waits for the farm, and doesn't
    // block everyone behind it.
    if (d != null) dueBy[Math.min(HORIZON, Math.max(x.due, d))] += x.units;
  });
  // What isn't promised yet, for a new order.
  const slack = slackNow();
  const free = [];
  let last = -1;
  for (let t = 0; t <= HORIZON; t++) {
    const v = Math.max(0, Math.floor(slack[t] + 1e-9));
    if (v !== last) { free.push([t, v]); last = v; }
  }
  return { mode: "stock", ready, ahead, free };
}

// Everything at once: plans per source, plus each order's ready day.
export function planAll(menu, orders, ctx) {
  const sources = buildSources(menu, ctx);
  const demand = demandBySource(menu, orders, ctx.today);
  const plans = new Map();
  sources.forEach((src, key) => plans.set(key, planSource(src, demand.get(key))));
  // An order is ready when its slowest item is. Items with no source (not
  // tracked) don't hold it up.
  const orderReady = new Map();
  (Array.isArray(orders) ? orders : []).forEach((o) => {
    if (!o || (o.status && !OPEN.has(o.status))) return;
    let day = 0, known = false, never = false;
    plans.forEach((p) => {
      if (!p.ready.has(o.id)) return;
      known = true;
      const d = p.ready.get(o.id);
      if (d == null) never = true; else day = Math.max(day, d);
    });
    if (known) orderReady.set(o.id, never ? null : day);
  });
  return { sources, plans, orderReady };
}

// For a new order of `units` from a plan: the first day it could be ready
// (on or after `from`, for slots the day it's wanted), or null.
export function readyForNew(plan, units, from = 0) {
  if (!plan) return 0;
  if (plan.mode === "slot") {
    const slots = plan.free;
    const i = slots.findIndex((s) => s[1] >= from);
    if (i < 0) return null;
    // The first slot with room for all of it; only an order bigger than a
    // whole slot is spread over the slots.
    const cap = slots[i][4] != null ? slots[i][4] : Math.max(...slots.map((x) => x[3]), 0);
    if (units <= cap + 1e-9) {
      for (let k = i; k < slots.length; k++) if (slots[k][3] + 1e-9 >= units) return slots[k][2];
      return null;
    }
    let left = units;
    for (let k = i; k < slots.length; k++) { left -= slots[k][3]; if (left <= 1e-9) return slots[k][2]; }
    return null;
  }
  for (const [d, v] of plan.free) if (v + 1e-9 >= units) return Math.max(d, 0);
  return null;
}

// ---------------------------------------------------------------- public page
// What the public page gets for an item: only what it shows or needs to work
// out dates. pre: can order past what's ready. per: base units in one.
// free: the plan's free curve (stock, base units) or slots (menu units).
// ahead: units already ordered in this item's own unit (only if shown).
// g: which source it shares (items with the same g draw from the same eggs,
// so a dozen and a half dozen in one order add up).
export function publicSupply(m, plan, g = 0) {
  if (!plan) return null;
  const per = plan.mode === "slot" ? 1 : perUnit(m);
  return {
    mode: plan.mode, per, g: Math.max(0, Math.floor(num(g))),
    free: plan.free.slice(0, 400),
    ...(m.showAhead !== false ? { ahead: Math.ceil(plan.ahead / per - 1e-9) } : {}),
  };
}
// Cleans what the public page reads back (cleanMenu keeps only this).
export function cleanPublicSupply(p) {
  if (!p || typeof p !== "object") return null;
  const mode = p.mode === "slot" ? "slot" : "stock";
  const free = (Array.isArray(p.free) ? p.free : []).slice(0, 400)
    .map((r) => (Array.isArray(r) ? r.map((x) => r3(pos(x))) : null))
    .filter((r) => r && (mode === "slot" ? r.length === 4 || r.length === 5 : r.length === 2));
  const out = { mode, per: pos(p.per) > 0 ? r3(pos(p.per)) : 1, g: Math.min(9999, Math.floor(pos(p.g))), free };
  if (Number.isFinite(Number(p.ahead))) out.ahead = Math.floor(pos(p.ahead));
  return out;
}

// For a request (menu items + qty, a wanted day): the day it's likely ready,
// null if not within the horizon, or undefined if nothing in it is tracked.
export function estimateRequest(menu, qty, wantDay = 0) {
  let day, any = false, never = false;
  // Items from the same source add up before asking when it's ready.
  const groups = new Map();
  (Array.isArray(menu) ? menu : []).forEach((m) => {
    const n = Math.floor(num(qty && qty[m.id]));
    if (!(n > 0) || !m.sup) return;
    any = true;
    const p = m.sup;
    const k = p.mode === "slot" ? `s:${m.id}` : `g:${p.g || 0}`;
    const g = groups.get(k) || { p, units: 0 };
    g.units += p.mode === "slot" ? n : n * p.per;
    groups.set(k, g);
  });
  groups.forEach(({ p, units }) => {
    const d = readyForNew(p, units, p.mode === "slot" ? wantDay : 0);
    if (d == null) never = true; else day = Math.max(day || 0, d);
  });
  if (!any) return undefined;
  return never ? null : day;
}
