// ============================================================================
// UNITS HELPER — currency, temperature, hemisphere
// ----------------------------------------------------------------------------
// Module-level state kept in sync with data.units by the main App component.
// All other files (Sheep.jsx, Farmstand.jsx, YearInReview.jsx, Bees.jsx,
// Sales.jsx, etc.) import these helpers and use them argument-free in render.
// ============================================================================

let _currentCurrency = "USD";
let _currentTempUnit = "F";
let _currentHemisphere = "north"; // resolved value: "north" | "south"

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
