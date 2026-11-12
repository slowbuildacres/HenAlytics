// ============================================================================
// At home: everything made and waiting, in one list (farm stand "At home")
// ----------------------------------------------------------------------------
// People make things before they put them out: soap curing for weeks, jars
// on the pantry shelf, eggs in the fridge, extra stock in the back. Each
// hobby already keeps its own count; this reads them all so the farm stand
// can show one list, and "Put out at the stand" moves some over:
//
//   farm stand back stock  item.backStock batches (src/Farmstand.jsx)
//   soap                   batches: bars − sold − used − gifted − at the stand
//                          (batch.uses kind "stand", see soapBatchStats)
//   canning                batches[].jarsRemaining
//   eggs                   eggs on hand (src/eggInventory.js), in dozens
//
// Moving takes it off the hobby's own count the way that hobby counts (a
// "stand" use on a soap batch, fewer jars remaining, a used_eggs log "Put out
// at the farm stand") and adds it to a farm stand item, made if needed and
// linked by item.fromSource so the next move finds it.
// Pure functions; putOut() changes an update() draft.
// ============================================================================

import { computeEggsOnHand } from "./eggInventory.js";
import { soapBatchStats } from "./SoapMaking.jsx";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const newId = () => Math.random().toString(36).slice(2, 10);

// Everything at home from the hobbies (farm stand back stock is listed by
// the farm stand itself). [{ key, kind, hobbyId, batchId, name, qty, unit,
// readyOn, price, note }]
export function homeFromHobbies(data, today) {
  const out = [];
  const hobbies = ((data && data.hobbies) || []).filter((h) => h && !h.hidden);
  hobbies.filter((h) => h.type === "soap").forEach((h) => {
    (h.batches || []).filter((b) => b && !b.archived).forEach((b) => {
      const st = soapBatchStats(b, (data && data.sales) || []);
      if (st.remaining <= 0) return;
      out.push({ key: `soap:${b.id}`, kind: "soap", hobbyId: h.id, batchId: b.id, name: b.name || "Soap", qty: st.remaining, unit: "bars", readyOn: st.cured ? "" : b.expectedCureDate, price: num(b.pricePerBar) || null, note: "Soap" });
    });
  });
  hobbies.filter((h) => h.type === "canning").forEach((h) => {
    (h.batches || []).filter((b) => b && !b.archived && num(b.jarsRemaining) > 0).forEach((b) => {
      out.push({ key: `canning:${b.id}`, kind: "canning", hobbyId: h.id, batchId: b.id, name: b.item || "Canned goods", qty: num(b.jarsRemaining), unit: b.jarType ? `${String(b.jarType).toLowerCase()} jars` : "jars", readyOn: "", price: null, note: "Canning" });
    });
  });
  hobbies.filter((h) => h.type === "egg_layers" && h.eggInventory && h.eggInventory.enabled).forEach((h) => {
    const n = computeEggsOnHand(h, (data && data.entries && data.entries[h.id]) || [], (data && data.sales) || []);
    const dozens = Math.floor(Math.max(0, num(n)) / 12);
    if (dozens > 0) out.push({ key: `eggs:${h.id}`, kind: "eggs", hobbyId: h.id, batchId: "", name: "Eggs", qty: dozens, unit: "dozen", readyOn: "", price: null, note: `${Math.max(0, Math.floor(num(n)))} eggs on hand` });
  });
  void today;
  return out;
}

// The farm stand item an entry goes to: linked before, or same name.
export function standItemFor(data, entry) {
  const h = ((data && data.hobbies) || []).find((x) => x && x.id === "farmstand");
  const items = (h && h.items) || [];
  const name = (i) => String((i && i.name) || "").trim().toLowerCase();
  return items.find((i) => i && i.fromSource === entry.key)
    || items.find((i) => i && !i.archived && name(i) === String(entry.name || "").trim().toLowerCase())
    // Eggs go to whatever the stand sells them as ("Farm fresh eggs", "Dozen eggs").
    || (entry.kind === "eggs" ? items.find((i) => i && !i.archived && /\beggs?\b/.test(name(i)) && !/eggplant/.test(name(i))) : null)
    || null;
}

// Moves qty from home to the stand, in place on the draft. Returns the farm
// stand item id, or "" if nothing moved.
export function putOut(d, entry, qty, today) {
  const n = Math.min(Math.floor(num(qty)), Math.floor(num(entry && entry.qty)));
  if (!(n > 0)) return "";
  const h = (d.hobbies || []).find((x) => x && x.id === entry.hobbyId);
  if (!h) return "";
  if (entry.kind === "soap") {
    const b = (h.batches || []).find((x) => x && x.id === entry.batchId);
    if (!b) return "";
    if (!Array.isArray(b.uses)) b.uses = [];
    b.uses.push({ id: newId(), kind: "stand", qty: n, date: today });
  } else if (entry.kind === "canning") {
    const b = (h.batches || []).find((x) => x && x.id === entry.batchId);
    if (!b) return "";
    b.jarsRemaining = Math.max(0, num(b.jarsRemaining) - n);
  } else if (entry.kind === "eggs") {
    if (!d.entries) d.entries = {};
    if (!Array.isArray(d.entries[h.id])) d.entries[h.id] = [];
    d.entries[h.id].push({ id: newId(), date: today, action: "used_eggs", useType: "stand", count: n * 12, notes: `${n} dozen to the farm stand`, created: Date.now() });
  } else return "";
  let stand = (d.hobbies || []).find((x) => x && x.id === "farmstand");
  if (!stand) return "";
  if (!Array.isArray(stand.items)) stand.items = [];
  let it = standItemFor(d, entry);
  if (!it) {
    it = { id: newId(), name: String(entry.name).slice(0, 60), unit: entry.kind === "eggs" ? "dozen" : entry.kind === "soap" ? "bar" : "jar", pricePerUnit: entry.price || 0, costPerUnit: 0, trackStock: true, stock: 0, backStock: [] };
    stand.items.push(it);
  }
  it.fromSource = entry.key;
  it.archived = false;
  it.onStand = true;
  it.trackStock = true;
  it.stock = Math.round((num(it.stock) + n) * 100) / 100;
  return it.id;
}

// For pre-orders: what's at home for each farm stand item on the order menu,
// so a stand item can be pre-ordered from soap that's still curing or jars
// on the shelf. { "stand:<itemId>": { onHand, perDay: 0, asOf, batches } }
// (onHand ready now, batches [{ on, qty }] ready later), in the stand
// item's own unit (eggs in dozens).
export function homeSnaps(data, menu, today) {
  const out = {};
  const entries = homeFromHobbies(data, today);
  (Array.isArray(menu) ? menu : []).forEach((m) => {
    const from = m && m.supply && m.supply.from;
    if (!m || !m.standItemId || (from && from !== "stand")) return;
    const key = `stand:${String(m.standItemId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}`;
    if (out[key]) return;
    const mine = entries.filter((e) => { const it = standItemFor(data, e); return it && it.id === m.standItemId; });
    if (!mine.length) return;
    const onHand = mine.filter((e) => !e.readyOn || e.readyOn <= today).reduce((n, e) => n + e.qty, 0);
    const batches = mine.filter((e) => e.readyOn && e.readyOn > today).map((e) => ({ on: e.readyOn, qty: e.qty }));
    out[key] = { onHand, perDay: 0, asOf: today, ...(batches.length ? { batches } : {}) };
  });
  return out;
}

