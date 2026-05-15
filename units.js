// ============================================================================
// UNITS HELPER — currency, temperature, hemisphere, weight, volume
// ----------------------------------------------------------------------------
// Module-level state kept in sync with data.units by the main App component.
// All other files (Sheep.jsx, Farmstand.jsx, YearInReview.jsx, Bees.jsx,
// Sales.jsx, etc.) import these helpers and use them argument-free in render.
// ============================================================================

let _currentCurrency = "USD";
let _currentTempUnit = "F";
let _currentHemisphere = "north"; // resolved value: "north" | "south"
let _currentWeightUnit = "lbs";   // "lbs" | "kg"  — small weights auto-switch to oz / g
let _currentVolumeUnit = "gal";   // "gal" | "L"   — small volumes auto-switch to cups / mL

const CURRENCY_LOCALES = {
  USD: "en-US", AUD: "en-AU", CAD: "en-CA",
  GBP: "en-GB", EUR: "en-IE", NZD: "en-NZ",
};
const CURRENCY_SYMBOLS = {
  USD: "$", AUD: "A$", CAD: "C$",
  GBP: "£", EUR: "€", NZD: "NZ$",
};

export function setUserUnits(units, location) {
  _currentCurrency = (units && units.currency) || "USD";
  _currentTempUnit = (units && units.temperature) || "F";
  _currentWeightUnit = (units && units.weight) || "lbs";
  _currentVolumeUnit = (units && units.volume) || "gal";
  if (units && units.hemisphere === "south") _currentHemisphere = "south";
  else if (units && units.hemisphere === "north") _currentHemisphere = "north";
  else if (location && typeof location.lat === "number") {
    _currentHemisphere = location.lat < 0 ? "south" : "north";
  } else {
    _currentHemisphere = "north";
  }
}

export function getCurrentHemisphere() { return _currentHemisphere; }
export function getCurrentCurrency() { return _currentCurrency; }
export function getCurrentTempUnit() { return _currentTempUnit; }
export function getCurrentWeightUnit() { return _currentWeightUnit; }
export function getCurrentVolumeUnit() { return _currentVolumeUnit; }

export function fmtMoney(n) {
  const num = Number(n) || 0;
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALES[_currentCurrency] || "en-US", {
      style: "currency",
      currency: _currentCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch (e) {
    const sym = CURRENCY_SYMBOLS[_currentCurrency] || "$";
    return `${sym}${num.toFixed(2)}`;
  }
}

// fmtTemp takes Fahrenheit (the canonical storage unit, since weather APIs
// return F here) and renders in user's preferred unit.
export function fmtTemp(f) {
  if (f === null || f === undefined || isNaN(Number(f))) return "—";
  const num = Number(f);
  if (_currentTempUnit === "C") {
    return `${Math.round((num - 32) * 5 / 9)}°C`;
  }
  return `${Math.round(num)}°F`;
}

export function currencySymbol() {
  return CURRENCY_SYMBOLS[_currentCurrency] || "$";
}

// ============================================================================
// WEIGHT
// ----------------------------------------------------------------------------
// Canonical storage unit: POUNDS (lbs). Every weight stored in data is lbs.
// User-facing display converts based on _currentWeightUnit.
//
// "lbs" mode  → renders 1.0+ as "X.X lbs", < 1.0 as "X oz" (16 oz = 1 lb)
// "kg" mode   → renders 1.0+ as "X.X kg",  < 1.0 as "X g"  (1000 g = 1 kg)
//
// We always store and accept LBS, then convert at the display boundary. New
// input forms can accept the user's preferred unit and convert back to lbs
// before saving via the lbsFromInput helper below.
// ============================================================================

const LBS_PER_KG = 2.20462262;
const G_PER_LB = 453.59237;
const OZ_PER_LB = 16;

// Format a weight stored in pounds into the user's preferred unit. Auto-picks
// the small unit (oz / g) when the value is under 1 of the big unit.
//   fmtWeight(2.4)  → "2.4 lbs"  (US)  /  "1.1 kg"  (metric)
//   fmtWeight(0.5)  → "8 oz"     (US)  /  "227 g"   (metric)
//   fmtWeight(0)    → "0 lbs" / "0 kg"
//   decimals optional, defaults to 1 for big-unit and 0 for small-unit.
export function fmtWeight(lbs, opts = {}) {
  if (lbs === null || lbs === undefined || isNaN(Number(lbs))) return "—";
  const n = Number(lbs);
  const decimals = opts.decimals;  // undefined → auto

  if (_currentWeightUnit === "kg") {
    const kg = n / LBS_PER_KG;
    if (Math.abs(kg) < 1 && !opts.forceBig) {
      const g = n * G_PER_LB;
      return `${Math.round(g)} g`;
    }
    return `${kg.toFixed(decimals == null ? 1 : decimals)} kg`;
  }

  // US (lbs)
  if (Math.abs(n) < 1 && !opts.forceBig) {
    const oz = n * OZ_PER_LB;
    return `${Math.round(oz)} oz`;
  }
  return `${n.toFixed(decimals == null ? 1 : decimals)} lbs`;
}

// Just the unit label (no number). Useful for placeholders in forms.
// Returns "lbs" or "kg" depending on user preference.
export function weightUnitLabel() {
  return _currentWeightUnit === "kg" ? "kg" : "lbs";
}

// Convert lbs ↔ user preferred unit (for input defaulting). Pass in a value
// stored as lbs in data, get back the number the user expects to see in
// their preferred unit. NOT auto-switching to small units — that's a
// display-only convenience. Input forms always use the big unit.
export function weightFromLbs(lbs) {
  const n = Number(lbs) || 0;
  return _currentWeightUnit === "kg" ? n / LBS_PER_KG : n;
}

// Inverse: take a number the user typed in their preferred unit and convert
// back to lbs for storage. Use when saving form input.
export function lbsFromInput(n) {
  const v = Number(n) || 0;
  return _currentWeightUnit === "kg" ? v * LBS_PER_KG : v;
}

// ============================================================================
// VOLUME
// ----------------------------------------------------------------------------
// Canonical storage unit: GALLONS (US gal). Every volume stored in data is
// in gallons. User-facing display converts based on _currentVolumeUnit.
//
// "gal" mode → renders 1.0+ as "X.X gal", < 1.0 as "X cups" (16 cups = 1 gal)
// "L" mode   → renders 1.0+ as "X.X L",   < 1.0 as "X mL"   (1000 mL = 1 L)
// ============================================================================

const L_PER_GAL = 3.78541;
const ML_PER_GAL = 3785.41;
const CUPS_PER_GAL = 16;

export function fmtVolume(gal, opts = {}) {
  if (gal === null || gal === undefined || isNaN(Number(gal))) return "—";
  const n = Number(gal);
  const decimals = opts.decimals;

  if (_currentVolumeUnit === "L") {
    const liters = n * L_PER_GAL;
    if (Math.abs(liters) < 1 && !opts.forceBig) {
      const mL = n * ML_PER_GAL;
      return `${Math.round(mL)} mL`;
    }
    return `${liters.toFixed(decimals == null ? 1 : decimals)} L`;
  }

  // US (gal)
  if (Math.abs(n) < 1 && !opts.forceBig) {
    const cups = n * CUPS_PER_GAL;
    return `${cups.toFixed(decimals == null ? 1 : decimals)} cups`;
  }
  return `${n.toFixed(decimals == null ? 1 : decimals)} gal`;
}

export function volumeUnitLabel() {
  return _currentVolumeUnit === "L" ? "L" : "gal";
}

export function volumeFromGal(gal) {
  const n = Number(gal) || 0;
  return _currentVolumeUnit === "L" ? n * L_PER_GAL : n;
}

export function galFromInput(n) {
  const v = Number(n) || 0;
  return _currentVolumeUnit === "L" ? v / L_PER_GAL : v;
}

// ============================================================================
// SMALL UNIT HELPERS — for cases where the storage unit IS the small unit
// (cups or oz directly stored). Some legacy data stores feed amounts in
// cups directly. These render those values consistently with the user's
// preferred system.
// ============================================================================

// Render a value stored in cups. Used for feed amounts where data.feedUnit
// is "cups". Converts to mL/L in metric mode.
//   fmtCups(2)    → "2 cups"  (US)  /  "473 mL" (metric)
//   fmtCups(20)   → "20 cups" (US)  /  "4.7 L"  (metric)
export function fmtCups(cups) {
  if (cups === null || cups === undefined || isNaN(Number(cups))) return "—";
  const n = Number(cups);

  if (_currentVolumeUnit === "L") {
    const mL = n * 236.588;  // 1 cup = 236.588 mL
    if (Math.abs(mL) >= 1000) {
      return `${(mL / 1000).toFixed(1)} L`;
    }
    return `${Math.round(mL)} mL`;
  }
  return `${n} cup${n === 1 ? "" : "s"}`;
}

// Render a value stored in ounces. Used for some sourdough / baking flows
// where things are weighed in oz directly.
//   fmtOz(8)  → "8 oz" (US)  /  "227 g" (metric)
export function fmtOz(oz) {
  if (oz === null || oz === undefined || isNaN(Number(oz))) return "—";
  const n = Number(oz);
  if (_currentWeightUnit === "kg") {
    const g = n * 28.3495;
    if (Math.abs(g) >= 1000) return `${(g / 1000).toFixed(1)} kg`;
    return `${Math.round(g)} g`;
  }
  return `${n} oz`;
}
