// ============================================================================
// GARDEN VALUE — "what would this harvest cost at the store?"
// ----------------------------------------------------------------------------
// Values harvest records (from collectGardenHarvests) at typical US grocery
// prices, so the garden home can say "your garden grew $412 of food". The
// defaults are rough conventional-produce averages, deliberately on the
// conservative side; every price is editable per plant
// (hobby.harvestPrices = { "<plant key>": { lb, each, bunch } }).
//
// Units in the app: lbs, oz, each/count, bunch, cups, pints/pint, quarts/quart.
// Volume is converted to weight at ~0.75 lb per pint (berries, beans, cherry
// tomatoes are all close to that), so a pint of blueberries is valued like
// 0.75 lb of blueberries.
// ============================================================================

// Price per lb, and per-item / per-bunch where those are how it's sold.
// Matched against the plant name by keyword (first match wins, so more
// specific keys come first).
export const DEFAULT_PRICES = [
  ["cherry tomato", { lb: 4.0, each: 0.1 }],
  // Fruit and herbs before vegetables so "peach"/"pear" don't match "pea"
  // and "peppermint" doesn't match "pepper".
  ["rhubarb", { lb: 4.0 }],
  ["strawberr", { lb: 4.0 }],
  ["blueberr", { lb: 5.0 }],
  ["raspberr", { lb: 8.0 }],
  ["blackberr", { lb: 6.0 }],
  ["berr", { lb: 6.0 }],
  ["grape", { lb: 3.0 }],
  ["apple", { lb: 2.0, each: 0.75 }],
  ["pear", { lb: 2.0, each: 0.9 }],
  ["peach", { lb: 2.5, each: 0.9 }],
  ["plum", { lb: 3.0, each: 0.5 }],
  ["cherr", { lb: 5.0 }],
  ["fig", { lb: 6.0 }],
  ["basil", { lb: 20.0, bunch: 2.5 }],
  ["cilantro", { lb: 10.0, bunch: 1.5 }],
  ["parsley", { lb: 10.0, bunch: 1.5 }],
  ["dill", { lb: 15.0, bunch: 2.5 }],
  ["mint", { lb: 20.0, bunch: 2.5 }],
  ["herb", { lb: 15.0, bunch: 2.5 }],
  ["tomato", { lb: 2.5, each: 0.75 }],
  ["bell pepper", { lb: 2.5, each: 1.25 }],
  ["jalape", { lb: 2.0, each: 0.15 }],
  ["hot pepper", { lb: 3.0, each: 0.25 }],
  ["pepper", { lb: 2.5, each: 1.0 }],
  ["cucumber", { lb: 1.5, each: 0.9 }],
  ["zucchini", { lb: 1.75, each: 1.25 }],
  ["summer squash", { lb: 1.75, each: 1.25 }],
  ["butternut", { lb: 1.5, each: 3.0 }],
  ["acorn", { lb: 1.5, each: 2.0 }],
  ["spaghetti squash", { lb: 1.5, each: 3.5 }],
  ["pumpkin", { lb: 0.9, each: 5.0 }],
  ["squash", { lb: 1.75, each: 2.0 }],
  ["watermelon", { lb: 0.6, each: 6.0 }],
  ["cantaloupe", { lb: 1.0, each: 3.0 }],
  ["melon", { lb: 1.0, each: 3.5 }],
  ["sweet potato", { lb: 1.5 }],
  ["potato", { lb: 1.0 }],
  ["garlic", { lb: 5.0, each: 0.75 }],
  ["onion", { lb: 1.25, each: 0.75, bunch: 1.5 }],
  ["shallot", { lb: 4.0 }],
  ["leek", { lb: 3.0, each: 1.5 }],
  ["carrot", { lb: 1.5, bunch: 2.5 }],
  ["beet", { lb: 2.0, bunch: 3.0 }],
  ["radish", { lb: 2.0, bunch: 1.5 }],
  ["turnip", { lb: 1.5, bunch: 2.5 }],
  ["parsnip", { lb: 3.0 }],
  ["green bean", { lb: 3.0 }],
  ["bean", { lb: 3.0 }],
  ["snap pea", { lb: 5.0 }],
  ["pea", { lb: 4.0 }],
  ["corn", { lb: 1.0, each: 0.6 }],
  ["broccoli", { lb: 2.5, each: 2.5 }],
  ["cauliflower", { lb: 2.5, each: 3.5 }],
  ["brussels", { lb: 4.0 }],
  ["cabbage", { lb: 1.0, each: 3.0 }],
  ["kale", { lb: 4.0, bunch: 2.5 }],
  ["chard", { lb: 4.0, bunch: 2.5 }],
  ["collard", { lb: 3.0, bunch: 2.5 }],
  ["spinach", { lb: 6.0, bunch: 2.5 }],
  ["arugula", { lb: 8.0, bunch: 2.5 }],
  ["lettuce", { lb: 3.0, each: 2.0, bunch: 2.0 }],
  ["salad", { lb: 6.0 }],
  ["celery", { lb: 1.5, each: 2.0 }],
  ["eggplant", { lb: 2.0, each: 1.5 }],
  ["okra", { lb: 4.0 }],
  ["asparagus", { lb: 4.0, bunch: 4.0 }],
];

// Anything we don't recognise. Conservative on purpose.
export const FALLBACK_PRICE = { lb: 2.0, each: 1.0, bunch: 2.0 };

export function plantKey(name) {
  return String(name || "").trim().toLowerCase();
}

export function defaultPriceFor(name) {
  const k = plantKey(name);
  for (const [kw, price] of DEFAULT_PRICES) {
    if (k.includes(kw)) return price;
  }
  return FALLBACK_PRICE;
}

// Which price slot a unit uses, and how many of that slot one unit is.
// Returns { slot: "lb" | "each" | "bunch", factor }.
export function unitSlot(unit) {
  switch (String(unit || "lbs").toLowerCase()) {
    case "lbs": case "lb": return { slot: "lb", factor: 1 };
    case "oz": return { slot: "lb", factor: 1 / 16 };
    case "kg": return { slot: "lb", factor: 2.20462 };
    case "g": return { slot: "lb", factor: 0.00220462 };
    case "each": case "count": return { slot: "each", factor: 1 };
    case "bunch": case "bunches": return { slot: "bunch", factor: 1 };
    case "cups": case "cup": return { slot: "lb", factor: 0.375 };
    case "pints": case "pint": return { slot: "lb", factor: 0.75 };
    case "quarts": case "quart": return { slot: "lb", factor: 1.5 };
    default: return { slot: "lb", factor: 1 };
  }
}

// Effective price for (plant, slot): custom override → default for that slot
// → derived from another slot (each ≈ lb × 0.5, bunch ≈ lb × 0.25) → fallback.
export function priceFor(name, slot, overrides = {}) {
  const custom = overrides[plantKey(name)];
  if (custom && Number(custom[slot]) >= 0 && custom[slot] !== "" && custom[slot] != null) {
    return { price: Number(custom[slot]), custom: true };
  }
  const d = defaultPriceFor(name);
  if (d[slot] != null) return { price: d[slot], custom: false };
  if (slot === "each" && d.lb != null) return { price: +(d.lb * 0.5).toFixed(2), custom: false };
  if (slot === "bunch" && d.lb != null) return { price: +(d.lb * 0.25).toFixed(2), custom: false };
  return { price: FALLBACK_PRICE[slot] ?? FALLBACK_PRICE.lb, custom: false };
}

// harvests: [{ plant, quantity|qty, unit }]
// Returns { total, rows: [{ plant, slot, qty, price, value, custom }] } with
// rows grouped by plant + price slot, sorted by value (largest first).
export function computeHarvestValue(harvests, overrides = {}) {
  const groups = new Map();
  for (const h of harvests || []) {
    if (!h) continue;
    const qtyRaw = Number(h.quantity != null ? h.quantity : h.qty) || 0;
    if (qtyRaw <= 0) continue;
    const plant = String(h.plant || "Unknown").trim() || "Unknown";
    const { slot, factor } = unitSlot(h.unit);
    const key = `${plantKey(plant)}|${slot}`;
    const g = groups.get(key) || { plant, slot, qty: 0 };
    g.qty += qtyRaw * factor;
    groups.set(key, g);
  }
  const rows = [...groups.values()].map((g) => {
    const { price, custom } = priceFor(g.plant, g.slot, overrides);
    return { ...g, qty: +g.qty.toFixed(2), price, value: +(g.qty * price).toFixed(2), custom };
  }).sort((a, b) => b.value - a.value);
  const total = +rows.reduce((s, r) => s + r.value, 0).toFixed(2);
  return { total, rows };
}
