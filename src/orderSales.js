// ============================================================================
// Orders → Sales
// ----------------------------------------------------------------------------
// When the owner marks a customer order picked up, each item can go into
// Sales (data.sales) in the same shape the Sales screen writes for that
// hobby, and a linked farm stand item can have its stock taken down.
//
// Menu items carry three private fields next to the public ones:
//   cost         what one costs to make (owner only)
//   credit       which Sales type it counts under ("eggs", "baking", ...)
//   standItemId  the farm stand item it comes from, if any
// The public page never sees these: api/order-page.js only ever sends
// cleanMenu() output (name, unit, price, note, available), and customer
// requests are built from that cleaned menu too.
//
// Pure functions only (no React), so the rules are easy to test.
// ============================================================================

import { cleanMenu, ORDER_LIMITS } from "./orderShared.js";
import { cleanSupply } from "./orderSupply.js";

export const CREDIT_TYPES = [
  { id: "farmstand", label: "Farm stand", hobby: "farmstand" },
  { id: "eggs", label: "Eggs", hobby: "egg_layers" },
  { id: "meat_chickens", label: "Meat birds", hobby: "meat_chickens" },
  { id: "baking", label: "Baking", hobby: "baking" },
  { id: "sourdough", label: "Sourdough", hobby: "sourdough" },
  { id: "canning", label: "Canning", hobby: "canning" },
  { id: "garden", label: "Garden", hobby: "garden" },
  { id: "honey", label: "Honey", hobby: "bees" },
  { id: "soap", label: "Soap", hobby: "soap" },
  { id: "maple_syrup", label: "Maple syrup", hobby: "maple_syrup" },
  { id: "other", label: "Other", hobby: null },
];
const CREDIT_IDS = new Set(CREDIT_TYPES.map((c) => c.id));
export const creditLabel = (id) => (CREDIT_TYPES.find((c) => c.id === id) || { label: "Other" }).label;

const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
const round2 = (n) => Math.round(n * 100) / 100;
const newId = () => Math.random().toString(36).slice(2, 10);

export function isoToday(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

// Sales types this homestead uses: the hobbies it has turned on, plus
// farm stand, eggs and other, which the Sales screen always offers.
export function creditChoices(data, keep = "") {
  const have = new Set((data && Array.isArray(data.hobbies) ? data.hobbies : [])
    .filter((h) => h && !h.hidden).map((h) => h.type));
  return CREDIT_TYPES.filter((c) => c.id === "farmstand" || c.id === "eggs" || c.id === "other" || c.id === keep || have.has(c.hobby));
}

// A sensible first guess from the item's name, so most people never touch it.
export function guessCredit(item, data) {
  if (item && item.standItemId) return "farmstand";
  const ok = new Set(creditChoices(data).map((c) => c.id));
  const pick = (...ids) => ids.find((id) => ok.has(id));
  const s = `${(item && item.name) || ""} ${(item && item.unit) || ""}`.toLowerCase();
  if (/\beggs?\b|dozen|\bdoz\b/.test(s) && !/eggplant/.test(s)) return "eggs";
  if (/sourdough/.test(s)) return pick("sourdough", "baking") || "farmstand";
  if (/bread|loa(f|ves)|muffin|cookie|\bpies?\b|cake|\brolls?\b|bagel|scone|biscuit|brownie|cinnamon|focaccia/.test(s)) return pick("baking", "sourdough") || "farmstand";
  if (/broiler|meat bird|whole bird|whole chicken|\bchickens?\b|turkey|\bbirds?\b/.test(s)) return pick("meat_chickens") || "farmstand";
  if (/\bjams?\b|jelly|salsa|pickle|canned|preserves?|\bjars?\b|relish|applesauce/.test(s)) return pick("canning") || "farmstand";
  if (/honey|comb/.test(s)) return pick("honey") || "farmstand";
  if (/soap/.test(s)) return pick("soap") || "farmstand";
  if (/syrup|maple/.test(s)) return pick("maple_syrup") || "farmstand";
  if (/eggplant|tomato|pepper|lettuce|veg|squash|zucchini|cucumber|herb|beans?\b|potato|garlic|onion|berr|greens|kale|carrot|flower|bouquet|melon|corn|pumpkin/.test(s)) return pick("garden") || "farmstand";
  return "farmstand";
}

// The owner's menu with the private fields kept (the public cleanMenu drops
// them). Used by the app when editing and saving the menu.
export function ownerMenu(menu) {
  const raw = new Map((Array.isArray(menu) ? menu : []).filter((m) => m && typeof m === "object").map((m) => [String(m.id || ""), m]));
  return cleanMenu(menu).map((m) => {
    const o = raw.get(m.id) || {};
    const cost = Number(o.cost);
    return {
      ...m,
      cost: Number.isFinite(cost) && cost >= 0 && o.cost !== "" && o.cost != null ? round2(cost) : null,
      credit: CREDIT_IDS.has(o.credit) ? o.credit : "",
      standItemId: String(o.standItemId || "").slice(0, 24),
      // Pre-orders (src/orderSupply.js): where it comes from, and whether
      // people can order past what's ready.
      supply: cleanSupply(o.supply, m.unit),
      preorder: o.preorder === true,
      showAhead: o.showAhead !== false,
    };
  });
}

// How many eggs are in one of the item's units ("dozen" → 12).
export function eggsPerUnit(unit) {
  const u = String(unit || "").toLowerCase();
  if (/half/.test(u) && /doz|dz/.test(u)) return 6;
  if (/doz|dz/.test(u)) return 12;
  if (/flat|tray/.test(u)) return 30;
  if (/^eggs?$/.test(u.trim())) return 1;
  return 12;
}

// Lines for the "Picked up" sheet, one per ordered item, with the owner's
// current price, cost and credit filled in. An order that's only a note gets
// one blank line the owner can fill in.
export function orderLines(req, menu, data) {
  const byId = new Map(ownerMenu(menu).map((m) => [m.id, m]));
  const stand = standItems(data);
  const items = Array.isArray(req && req.items) ? req.items : [];
  if (!items.length) {
    const note = String((req && req.note) || "").replace(/\s+/g, " ").trim();
    return [{ key: "note", itemId: "", name: note.slice(0, ORDER_LIMITS.menuName) || "Order", unit: "", qty: "1", price: "", cost: "", credit: guessCredit({ name: note }, data), standItemId: "", eggsPer: 12, from: "none", free: true }];
  }
  return items.map((i, k) => {
    const m = byId.get(i.id) || {};
    const standItemId = m.standItemId && stand.some((s) => s.id === m.standItemId) ? m.standItemId : "";
    const credit = m.credit || guessCredit({ ...m, name: i.name, unit: i.unit, standItemId }, data);
    const price = num(i.price) || num(m.price);
    const line = {
      key: `${i.id || "item"}-${k}`, itemId: i.id || "", name: i.name || m.name || "Item", unit: i.unit || m.unit || "",
      qty: String(Math.max(0, Math.floor(Number(i.qty) || 0))), price: price ? String(price) : "", cost: m.cost != null ? String(m.cost) : "",
      credit, standItemId, eggsPer: eggsPerUnit(i.unit || m.unit), from: "none", free: false,
    };
    line.from = defaultStockSource(stand.find((s) => s.id === standItemId), Number(line.qty) || 0);
    return line;
  });
}

export function standItems(data) {
  const h = ((data && data.hobbies) || []).find((x) => x && x.id === "farmstand");
  return (h && Array.isArray(h.items) ? h.items : []).filter((i) => i && i.id && i.name && !i.archived);
}
const backQty = (item) => (Array.isArray(item && item.backStock) ? item.backStock : [])
  .reduce((n, b) => n + (b && Number(b.qty) > 0 ? Number(b.qty) : 0), 0);
export const stockOnStand = (item) => (item && item.trackStock ? Number(item.stock) || 0 : null);
export const stockInBack = backQty;

export function defaultStockSource(item, qty) {
  if (!item) return "none";
  const onStand = stockOnStand(item);
  if (onStand != null && onStand >= qty) return "stand";
  if (backQty(item) >= qty) return "back";
  if (onStand != null) return "stand";
  if (backQty(item) > 0) return "back";
  return "none";
}

// Takes qty off a farm stand item, in place. "stand" mirrors a stand sale
// (only for items with stock tracking, may go negative like a stand sale);
// "back" takes from back stock, ready batches first, then the oldest.
export function takeStock(item, qty, from, today = isoToday()) {
  let left = num(qty);
  if (!item || !left) return 0;
  if (from === "stand") {
    if (!item.trackStock) return 0;
    item.stock = round2((Number(item.stock) || 0) - left);
    return left;
  }
  if (from !== "back") return 0;
  const ready = (b) => !b.readyOn || b.readyOn <= today;
  const batches = (Array.isArray(item.backStock) ? item.backStock : [])
    .filter((b) => b && typeof b === "object" && Number(b.qty) > 0)
    .map((b) => ({ ...b, qty: Number(b.qty) }))
    .sort((a, b) => (ready(a) ? 0 : 1) - (ready(b) ? 0 : 1) || String(a.readyOn || a.madeOn || "").localeCompare(String(b.readyOn || b.madeOn || "")));
  let taken = 0;
  for (const b of batches) {
    if (left <= 0) break;
    const t = Math.min(b.qty, left);
    b.qty = round2(b.qty - t);
    left = round2(left - t);
    taken = round2(taken + t);
  }
  item.backStock = batches.filter((b) => b.qty > 0);
  return taken;
}

export function lineTotals(lines) {
  return (lines || []).reduce((t, l) => {
    const q = num(l.qty);
    return { revenue: round2(t.revenue + q * num(l.price)), cost: round2(t.cost + q * num(l.cost)), count: t.count + (q > 0 ? 1 : 0) };
  }, { revenue: 0, cost: 0, count: 0 });
}

// One Sales record per line, shaped like the Sales screen's own records for
// that type, so lists, stats and profit read them the same way.
export function salesFromLines(lines, { req, date, buyerId = null, now = Date.now() } = {}) {
  const who = String((req && req.customer_name) || "").trim().slice(0, 60);
  const note = who ? `Order from ${who}` : "Customer order";
  return (lines || []).filter((l) => num(l.qty) > 0).map((l) => {
    const qty = num(l.qty);
    const price = num(l.price);
    const cost = num(l.cost);
    const name = String(l.name || "").trim().slice(0, ORDER_LIMITS.menuName) || "Order";
    const unit = String(l.unit || "").trim().slice(0, ORDER_LIMITS.unit);
    const credit = CREDIT_IDS.has(l.credit) ? l.credit : "other";
    const sale = {
      id: newId(), date, hobbyType: credit, qty, note, buyerId: buyerId || null, tip: 0, created: now,
      pricePerUnit: price, costPerUnit: cost, totalRevenue: round2(qty * price), totalCost: round2(qty * cost),
      fromOrder: (req && req.id) || "", fromOrderItem: l.itemId || "",
    };
    if (credit === "eggs") {
      const per = Math.max(1, Math.floor(Number(l.eggsPer) || 12));
      Object.assign(sale, { eggType: "Chicken", eggPurpose: "Eating" });
      if (per === 12) Object.assign(sale, { unit: "dozen" });
      else Object.assign(sale, { unit: "eggs", qty: qty * per, pricePerUnit: round2((price / per) * 12), costPerUnit: round2((cost / per) * 12) });
    } else if (credit === "meat_chickens") {
      Object.assign(sale, { saleForm: "Whole bird", pricingMethod: "per_bird", pricePerLb: 0, avgWeightLbs: 0, flatPrice: 0 });
    } else if (credit === "honey") {
      Object.assign(sale, { honeyForm: "Extracted", honeyContainer: unit || name });
    } else if (credit === "maple_syrup") {
      Object.assign(sale, { unit: unit || "pints" });
    } else if (credit === "other") {
      Object.assign(sale, { otherItem: `${qty}${unit ? ` ${unit}` : ""} ${name}`.replace(/\s+/g, " "), flatPrice: sale.totalRevenue });
    } else {
      const fallbackUnit = credit === "canning" ? "jars" : credit === "baking" ? "items" : "";
      Object.assign(sale, { crop: name, gardenUnit: unit || fallbackUnit, unit: unit || fallbackUnit });
      if (credit === "farmstand" && l.standItemId) sale.fromFarmstandItem = l.standItemId;
    }
    return sale;
  });
}

export const orderInSales = (data, reqId) => !!reqId && Array.isArray(data && data.sales) && data.sales.some((s) => s && s.fromOrder === reqId);
