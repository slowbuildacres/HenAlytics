// ============================================================================
// pantry.js — SHARED PANTRY constants & unit conversion helpers
// ----------------------------------------------------------------------------
// LEAF MODULE: imports nothing from the app. Pure functions + constants only.
//
// Used by HomesteadApp.jsx (PantryModal, AddPantryItemModal) and each kitchen
// hobby file (Baking, Sourdough, Canning, Fermentation, FreezeDrying,
// Dehydrating) for the recipe ingredient picker and cost calculation.
//
// Densities come from standard culinary references (King Arthur, USDA) and
// reflect "typical" measurements for the most common baking/preserving
// ingredients. Users can override per-item via pantryItem.densityOzPerCup.
// ============================================================================

export const PANTRY_CATEGORIES = [
  "flour", "sugar", "brown_sugar", "powdered_sugar",
  "butter", "oil", "milk", "cream", "honey", "maple_syrup", "molasses",
  "salt", "cocoa", "baking_powder", "baking_soda", "yeast",
  "vinegar", "water", "egg", "spice", "other",
];

export const PANTRY_CATEGORY_LABELS = {
  flour: "Flour (AP, bread, etc.)",
  sugar: "Sugar (white granulated)",
  brown_sugar: "Brown sugar",
  powdered_sugar: "Powdered sugar",
  butter: "Butter",
  oil: "Oil",
  milk: "Milk",
  cream: "Cream",
  honey: "Honey",
  maple_syrup: "Maple syrup",
  molasses: "Molasses",
  salt: "Salt",
  cocoa: "Cocoa powder",
  baking_powder: "Baking powder",
  baking_soda: "Baking soda",
  yeast: "Yeast",
  vinegar: "Vinegar",
  water: "Water",
  egg: "Egg (each)",
  spice: "Spice / herb",
  other: "Other",
};

// Densities in oz/cup (weight per volume). null = no meaningful default;
// user must provide an override or buy in the same unit they cook in.
export const INGREDIENT_DENSITIES = {
  flour:           4.25,
  sugar:           7.05,
  brown_sugar:     7.50,
  powdered_sugar:  4.40,
  butter:          8.00,
  oil:             7.70,
  milk:            8.60,
  cream:           8.40,
  honey:          12.00,
  maple_syrup:    11.10,
  molasses:       11.50,
  salt:           10.40,
  cocoa:           3.00,
  baking_powder:   6.90,
  baking_soda:     7.70,
  yeast:           5.30,
  vinegar:         8.35,
  water:           8.35,
  egg:             null,
  spice:           null,
  other:           null,
};

export const PANTRY_WEIGHT_UNITS = ["g", "oz", "lb", "kg"];
export const PANTRY_VOLUME_UNITS = ["ml", "tsp", "tbsp", "fl_oz", "cup", "pint", "quart", "gallon", "l"];
export const PANTRY_COUNT_UNITS = ["each"];
export const PANTRY_ALL_UNITS = [...PANTRY_WEIGHT_UNITS, ...PANTRY_VOLUME_UNITS, ...PANTRY_COUNT_UNITS];

export const PANTRY_UNIT_LABELS = {
  g: "g", oz: "oz", lb: "lb", kg: "kg",
  ml: "ml", tsp: "tsp", tbsp: "tbsp", fl_oz: "fl oz",
  cup: "cup", pint: "pint", quart: "quart", gallon: "gallon", l: "L",
  each: "each",
};

const WEIGHT_TO_OZ = {
  g: 0.035274,
  oz: 1,
  lb: 16,
  kg: 35.274,
};

const VOLUME_TO_FLOZ = {
  ml: 0.033814,
  tsp: 1/6,
  tbsp: 0.5,
  fl_oz: 1,
  cup: 8,
  pint: 16,
  quart: 32,
  gallon: 128,
  l: 33.814,
};

export function pantryUnitKind(unit) {
  if (PANTRY_WEIGHT_UNITS.includes(unit)) return "weight";
  if (PANTRY_VOLUME_UNITS.includes(unit)) return "volume";
  if (PANTRY_COUNT_UNITS.includes(unit)) return "count";
  return null;
}

// Convert `amount` from `fromUnit` to `toUnit`. Returns null on impossible
// conversions (cross-dim with no density, count↔non-count, unknown units).
export function convertPantryUnit(amount, fromUnit, toUnit, densityOzPerCup) {
  const a = Number(amount);
  if (!isFinite(a)) return null;
  if (fromUnit === toUnit) return a;
  const fromKind = pantryUnitKind(fromUnit);
  const toKind = pantryUnitKind(toUnit);
  if (!fromKind || !toKind) return null;
  if (fromKind === "count" || toKind === "count") {
    return fromUnit === toUnit ? a : null;
  }
  if (fromKind === toKind) {
    if (fromKind === "weight") {
      return a * WEIGHT_TO_OZ[fromUnit] / WEIGHT_TO_OZ[toUnit];
    } else {
      return a * VOLUME_TO_FLOZ[fromUnit] / VOLUME_TO_FLOZ[toUnit];
    }
  }
  const d = Number(densityOzPerCup);
  if (!isFinite(d) || d <= 0) return null;
  if (fromKind === "volume" && toKind === "weight") {
    const flOz = a * VOLUME_TO_FLOZ[fromUnit];
    const oz = flOz * (d / 8);
    return oz / WEIGHT_TO_OZ[toUnit];
  }
  if (fromKind === "weight" && toKind === "volume") {
    const oz = a * WEIGHT_TO_OZ[fromUnit];
    const flOz = oz / (d / 8);
    return flOz / VOLUME_TO_FLOZ[toUnit];
  }
  return null;
}

// Effective density for a pantry item: explicit override wins, else lookup
// by category, else null.
export function pantryItemDensity(item) {
  if (!item) return null;
  const explicit = Number(item.densityOzPerCup);
  if (isFinite(explicit) && explicit > 0) return explicit;
  const fromTable = INGREDIENT_DENSITIES[item.category];
  return (isFinite(fromTable) && fromTable > 0) ? fromTable : null;
}

// Cost per "purchase unit" derived from the original purchase.
export function pantryItemCostPerPurchaseUnit(item) {
  if (!item) return 0;
  const cost = Number(item.purchaseCost) || 0;
  const amt = Number(item.purchaseAmount) || 0;
  if (cost <= 0 || amt <= 0) return 0;
  return cost / amt;
}

// Cost of using `amount` of `useUnit` of a pantry item. Returns
// { cost, ok }. ok=false signals an impossible conversion — caller should
// hide cost rather than show $0.
export function pantryItemCostForUsage(item, amount, useUnit) {
  if (!item) return { cost: 0, ok: false };
  const a = Number(amount);
  if (!isFinite(a) || a <= 0) return { cost: 0, ok: false };
  const inPurchaseUnits = convertPantryUnit(a, useUnit, item.purchaseUnit, pantryItemDensity(item));
  if (inPurchaseUnits == null) return { cost: 0, ok: false };
  const perUnit = pantryItemCostPerPurchaseUnit(item);
  return { cost: inPurchaseUnits * perUnit, ok: true };
}

// Sum the cost of an array of recipe ingredients against the user's pantry.
// Returns { cost, missingCount } — missingCount is how many ingredients
// couldn't be priced (no pantryId, or unit conversion failed). Caller can
// surface "+N ingredient(s) not priced" when missingCount > 0.
export function computeRecipeCost(ingredients, pantry) {
  let cost = 0;
  let missingCount = 0;
  const byId = {};
  (pantry || []).forEach(p => { byId[p.id] = p; });
  (ingredients || []).forEach(ing => {
    if (!ing) return;
    if (!ing.pantryId) { missingCount += 1; return; }
    const item = byId[ing.pantryId];
    if (!item) { missingCount += 1; return; }
    const res = pantryItemCostForUsage(item, ing.amount, ing.unit);
    if (!res.ok) { missingCount += 1; return; }
    cost += res.cost;
  });
  return { cost, missingCount };
}
