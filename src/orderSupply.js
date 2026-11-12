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
//     hobbyId, flocks: [flockId], animals: [animalId], plant,
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
//   data.orderPage.snaps = { [sourceKey]: { onHand, perDay, asOf } }
// onHand and perDay are in base units (eggs, fl oz, the harvest unit).
//
// How the dates work. Every source has a supply curve in base units:
//   stock sources (stand, eggs, milk, garden): S(day) = what's ready now +
//     perDay × days + batches ready by that day. Units keep: eggs laid on
//     Monday can fill Saturday's order.
//   slot sources ('make'): a fixed number per pickup day or per week. Unused
//     room doesn't carry over.
// Open orders (new, accepted, ready) are lined up by the day they want it
// (no day = as soon as possible), then by when they came in. An order is
// ready on the first day the curve covers it and everything lined up before
// it. A new order can have whatever isn't promised to anyone yet, so taking
// it never makes an earlier order late.
// ============================================================================

import { computeEggsOnHand } from "./eggInventory.js";

export const HORIZON = 120;            // days ahead the page plans for
export const RATE_DAYS = 14;           // logs used to measure a rate
export const SNAP_STALE_DAYS = 21;     // older snapshots aren't trusted
export const SUPPLY_FROM = ["", "stand", "eggs", "milk", "garden", "make"];
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
  return "";
}
// Base units in one of this item's units.
export function perUnit(m) {
  const s = cleanSupply(m && m.supply, m && m.unit);
  return s.from === "eggs" || s.from === "milk" || s.from === "garden" ? s.per : 1;
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
    const unit = harvestUnitOf(entries, s.plant);
    const crop = entries.filter((e) => e.action === "harvested" && String(e.plant || "").trim().toLowerCase() === name);
    const amt = (e) => (String(e.unit || "lbs").toLowerCase() === unit.toLowerCase() ? num(e.quantity) : num(e.quantity) * harvestIn(e.unit || "lbs", unit));
    return { onHand: 0, perDay: rateFrom(crop, today, amt), counted: false, unit };
  }
  return null;
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
    if (!key || out[key] || !/^(eggs|milk|garden):/.test(key)) return;
    const got = measureSource(data, m.supply, today);
    if (got) out[key] = { onHand: got.onHand, perDay: got.perDay == null ? null : got.perDay, asOf: today };
  });
  return out;
}
// Same snapshots, ignoring asOf? Used to skip writes that change nothing.
export function sameSnaps(a, b) {
  const ka = Object.keys(a || {}).sort(), kb = Object.keys(b || {}).sort();
  if (ka.join("|") !== kb.join("|")) return false;
  return ka.every((k) => a[k].onHand === b[k].onHand && a[k].perDay === b[k].perDay && a[k].asOf === b[k].asOf);
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
      const it = stand.find((i) => i && i.id === m.standItemId && !i.archived);
      if (!it) return;
      const back = (Array.isArray(it.backStock) ? it.backStock : []).filter((b) => b && num(b.qty) > 0);
      const readyNow = back.filter((b) => !b.readyOn || b.readyOn <= today).reduce((n, b) => n + num(b.qty), 0);
      const batches = back.filter((b) => b.readyOn && b.readyOn > today).map((b) => ({ day: daysBetween(today, b.readyOn), qty: num(b.qty) })).filter((b) => b.day > 0);
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
    const age = daysBetween(snap.asOf, today);
    if (!(age >= 0) || age > SNAP_STALE_DAYS) return;
    const keep = Math.max(...items.map((x) => cleanSupply(x.supply, x.unit).keepPerWeek || 0)) / 7;
    const perDay = snap.perDay == null ? 0 : Math.max(0, num(snap.perDay) - keep);
    out.set(key, { key, mode: "stock", now: Math.max(0, num(snap.onHand)) + perDay * age, perDay, batches: [] });
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
    (Array.isArray(o.items) ? o.items : []).forEach((i) => {
      const m = i && byId.get(String(i.id));
      const key = m && sourceKey(m);
      if (!key) return;
      const units = key.startsWith("make:") ? pos(i.qty) : pos(i.qty) * perUnit(m);
      if (!(units > 0)) return;
      if (!out.has(key)) out.set(key, []);
      out.get(key).push({ id: o.id, due, at: String(o.created_at || ""), seq, units });
    });
  });
  out.forEach((list) => list.sort((a, b) => a.due - b.due || a.at.localeCompare(b.at) || a.seq - b.seq));
  return out;
}

// ---------------------------------------------------------------- planning
const supplyAt = (src, d) => src.now + src.perDay * d + src.batches.reduce((n, b) => n + (b.day <= d ? b.qty : 0), 0);
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
export function planSource(src, demand) {
  const list = demand || [];
  const ready = new Map();
  const ahead = list.reduce((n, x) => n + x.units, 0);
  if (src.mode === "slot") {
    const room = src.slots.map((s) => s.cap);
    list.forEach((x) => {
      let i = src.slots.findIndex((s) => s.end >= x.due);
      if (i < 0) { ready.set(x.id, null); return; }
      let left = x.units, at = null;
      // Fits in one slot: the first with room for all of it. Bigger than a
      // slot: spread it over the slots from here.
      if (left <= src.slots[i].cap) {
        while (i < room.length && room[i] + 1e-9 < left) i++;
        if (i < room.length) { room[i] -= left; at = src.slots[i].show; }
      } else {
        for (; i < room.length && left > 1e-9; i++) { const t = Math.min(room[i], left); room[i] -= t; left -= t; at = src.slots[i].show; }
        if (left > 1e-9) at = null;
      }
      const prev = ready.has(x.id) ? ready.get(x.id) : 0;
      ready.set(x.id, at == null || prev == null ? null : Math.max(prev, at));
    });
    return { mode: "slot", ready, ahead, free: src.slots.map((s, k) => [s.start, s.end, s.show, Math.max(0, r3(room[k]))]) };
  }
  // Stock: line up by due day, each ready once the curve covers it and all
  // before it.
  let need = 0;
  list.forEach((x) => {
    need += x.units;
    const d = firstDay(src, need);
    const prev = ready.has(x.id) ? ready.get(x.id) : 0;
    ready.set(x.id, d == null || prev == null ? null : Math.max(prev, d));
  });
  // What isn't promised yet: free(d) = min over t ≥ d of S(t) − D(t), where
  // D(t) is everything due by t (orders due after the horizon count at it).
  const dueBy = new Array(HORIZON + 1).fill(0);
  list.forEach((x) => { dueBy[Math.min(HORIZON, x.due)] += x.units; });
  const slack = new Array(HORIZON + 1);
  let cum = 0;
  for (let t = 0; t <= HORIZON; t++) { cum += dueBy[t]; slack[t] = supplyAt(src, t) - cum; }
  for (let t = HORIZON - 1; t >= 0; t--) slack[t] = Math.min(slack[t], slack[t + 1]);
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
    let i = slots.findIndex((s) => s[1] >= from);
    if (i < 0) return null;
    const cap = Math.max(...slots.map((s) => s[3]), 0);
    if (units <= cap || cap === 0) {
      for (; i < slots.length; i++) if (slots[i][3] + 1e-9 >= units) return slots[i][2];
      return null;
    }
    let left = units;
    for (; i < slots.length; i++) { left -= slots[i][3]; if (left <= 1e-9) return slots[i][2]; }
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
export function publicSupply(m, plan) {
  if (!plan) return null;
  const per = plan.mode === "slot" ? 1 : perUnit(m);
  return {
    mode: plan.mode, per,
    free: plan.free.slice(0, 200),
    ...(m.showAhead !== false ? { ahead: Math.ceil(plan.ahead / per - 1e-9) } : {}),
  };
}
// Cleans what the public page reads back (cleanMenu keeps only this).
export function cleanPublicSupply(p) {
  if (!p || typeof p !== "object") return null;
  const mode = p.mode === "slot" ? "slot" : "stock";
  const free = (Array.isArray(p.free) ? p.free : []).slice(0, 200)
    .map((r) => (Array.isArray(r) ? r.map((x) => r3(pos(x))) : null))
    .filter((r) => r && r.length === (mode === "slot" ? 4 : 2));
  const out = { mode, per: pos(p.per) > 0 ? r3(pos(p.per)) : 1, free };
  if (Number.isFinite(Number(p.ahead))) out.ahead = Math.floor(pos(p.ahead));
  return out;
}

// For a request (menu items + qty, a wanted day): the day it's likely ready,
// null if not within the horizon, or undefined if nothing in it is tracked.
export function estimateRequest(menu, qty, wantDay = 0) {
  let day, any = false, never = false;
  (Array.isArray(menu) ? menu : []).forEach((m) => {
    const n = Math.floor(num(qty && qty[m.id]));
    if (!(n > 0) || !m.sup) return;
    any = true;
    const p = m.sup;
    const d = readyForNew(p, p.mode === "slot" ? n : n * p.per, p.mode === "slot" ? wantDay : 0);
    if (d == null) never = true; else day = Math.max(day || 0, d);
  });
  if (!any) return undefined;
  return never ? null : day;
}
