// ============================================================================
// HARDINESS ZONES — INTERNATIONAL
// ----------------------------------------------------------------------------
// Supports multiple hardiness zone systems used around the world:
//   - USDA          (United States, used by reference globally)
//   - Canada        (Canada Plant Hardiness Zones, similar to USDA but shifted)
//   - RHS           (Royal Horticultural Society, UK & most of Europe)
//   - ANHGA         (Australian National Hardiness Garden Atlas — 7 zones)
//   - NZ            (New Zealand, regional climate zones A-G)
//   - EU            (alias for RHS, used in most continental EU)
//
// Each system maps zones to approximate last/first frost dates. The rest of
// the app already uses these dates (not the zone string itself) to compute
// planting windows, so once a user picks the right system + zone, all the
// existing planting suggestion math works unchanged.
//
// IMPORTANT — SOUTHERN HEMISPHERE:
// Australia & New Zealand have inverted seasons. Their "last frost" (end of
// winter, time to plant) falls in August-October, and "first frost" (start of
// winter, harvest time) is in April-June. The frost dates here reflect that.
// ============================================================================

// ----------------------------------------------------------------------------
// USDA — already used in gardenAlmanac.js; replicated here for completeness
// so the per-system lookup is uniform across all systems.
// ----------------------------------------------------------------------------
const USDA_ZONES = {
  "1a":  { lastFrost: "06-15", firstFrost: "08-01", label: "Zone 1a" },
  "1b":  { lastFrost: "06-10", firstFrost: "08-15", label: "Zone 1b" },
  "2a":  { lastFrost: "06-01", firstFrost: "08-25", label: "Zone 2a" },
  "2b":  { lastFrost: "05-25", firstFrost: "09-01", label: "Zone 2b" },
  "3a":  { lastFrost: "05-15", firstFrost: "09-10", label: "Zone 3a" },
  "3b":  { lastFrost: "05-10", firstFrost: "09-15", label: "Zone 3b" },
  "4a":  { lastFrost: "05-05", firstFrost: "09-25", label: "Zone 4a" },
  "4b":  { lastFrost: "05-01", firstFrost: "10-01", label: "Zone 4b" },
  "5a":  { lastFrost: "04-25", firstFrost: "10-10", label: "Zone 5a" },
  "5b":  { lastFrost: "04-20", firstFrost: "10-15", label: "Zone 5b" },
  "6a":  { lastFrost: "04-15", firstFrost: "10-20", label: "Zone 6a" },
  "6b":  { lastFrost: "04-10", firstFrost: "10-25", label: "Zone 6b" },
  "7a":  { lastFrost: "04-05", firstFrost: "11-01", label: "Zone 7a" },
  "7b":  { lastFrost: "04-01", firstFrost: "11-10", label: "Zone 7b" },
  "8a":  { lastFrost: "03-15", firstFrost: "11-20", label: "Zone 8a" },
  "8b":  { lastFrost: "03-01", firstFrost: "11-30", label: "Zone 8b" },
  "9a":  { lastFrost: "02-15", firstFrost: "12-15", label: "Zone 9a" },
  "9b":  { lastFrost: "02-01", firstFrost: "12-20", label: "Zone 9b" },
  "10a": { lastFrost: "01-15", firstFrost: "12-31", label: "Zone 10a — generally frost-free" },
  "10b": { lastFrost: "01-15", firstFrost: "12-31", label: "Zone 10b — frost-free" },
  "11a": { lastFrost: "01-15", firstFrost: "12-31", label: "Zone 11a — frost-free" },
  "11b": { lastFrost: "01-15", firstFrost: "12-31", label: "Zone 11b — frost-free" },
  "12a": { lastFrost: "01-15", firstFrost: "12-31", label: "Zone 12a — tropical" },
  "12b": { lastFrost: "01-15", firstFrost: "12-31", label: "Zone 12b — tropical" },
  "13a": { lastFrost: "01-15", firstFrost: "12-31", label: "Zone 13a — tropical" },
  "13b": { lastFrost: "01-15", firstFrost: "12-31", label: "Zone 13b — tropical" },
};

// ----------------------------------------------------------------------------
// CANADA — Plant Hardiness Zones (0-9). Similar to USDA but shifted. Canadian
// zones run colder than US zones overall: Canada Zone 5 ≈ USDA Zone 4.
// Frost dates here reflect typical Canadian climate.
// ----------------------------------------------------------------------------
const CANADA_ZONES = {
  "0a": { lastFrost: "06-25", firstFrost: "07-25", label: "Zone 0a — Arctic" },
  "0b": { lastFrost: "06-20", firstFrost: "08-01", label: "Zone 0b — Arctic" },
  "1a": { lastFrost: "06-15", firstFrost: "08-10", label: "Zone 1a — Subarctic" },
  "1b": { lastFrost: "06-10", firstFrost: "08-15", label: "Zone 1b — Subarctic" },
  "2a": { lastFrost: "06-01", firstFrost: "08-25", label: "Zone 2a" },
  "2b": { lastFrost: "05-25", firstFrost: "09-01", label: "Zone 2b" },
  "3a": { lastFrost: "05-20", firstFrost: "09-10", label: "Zone 3a" },
  "3b": { lastFrost: "05-15", firstFrost: "09-15", label: "Zone 3b" },
  "4a": { lastFrost: "05-10", firstFrost: "09-25", label: "Zone 4a" },
  "4b": { lastFrost: "05-05", firstFrost: "10-01", label: "Zone 4b" },
  "5a": { lastFrost: "05-01", firstFrost: "10-05", label: "Zone 5a" },
  "5b": { lastFrost: "04-25", firstFrost: "10-15", label: "Zone 5b" },
  "6a": { lastFrost: "04-20", firstFrost: "10-20", label: "Zone 6a" },
  "6b": { lastFrost: "04-15", firstFrost: "10-25", label: "Zone 6b" },
  "7a": { lastFrost: "04-05", firstFrost: "11-01", label: "Zone 7a" },
  "7b": { lastFrost: "03-25", firstFrost: "11-10", label: "Zone 7b" },
  "8a": { lastFrost: "03-15", firstFrost: "11-20", label: "Zone 8a — Coastal BC" },
  "8b": { lastFrost: "03-01", firstFrost: "11-30", label: "Zone 8b — Coastal BC" },
  "9a": { lastFrost: "02-15", firstFrost: "12-10", label: "Zone 9a — Pacific BC" },
};

// ----------------------------------------------------------------------------
// RHS — Royal Horticultural Society (UK). Uses H1a-H7 where H7 is hardiest.
// H1a (warmest) is "heated greenhouse" territory, H7 is "very hardy".
// Frost dates here reflect the UK climate — generally mild winters, late
// spring frosts are the bigger concern.
// ----------------------------------------------------------------------------
const RHS_ZONES = {
  "H7":  { lastFrost: "05-20", firstFrost: "10-01", label: "H7 — Very hardy (Scotland, Highlands)" },
  "H6":  { lastFrost: "05-10", firstFrost: "10-15", label: "H6 — Hardy (Northern England)" },
  "H5":  { lastFrost: "04-25", firstFrost: "10-25", label: "H5 — Hardy (most of UK)" },
  "H4":  { lastFrost: "04-15", firstFrost: "11-05", label: "H4 — Average hardy (Southern UK)" },
  "H3":  { lastFrost: "03-25", firstFrost: "11-20", label: "H3 — Half-hardy (Cornwall, Isles)" },
  "H2":  { lastFrost: "03-01", firstFrost: "11-30", label: "H2 — Tender (warm coast)" },
  "H1c": { lastFrost: "02-15", firstFrost: "12-10", label: "H1c — Warm sheltered" },
  "H1b": { lastFrost: "01-15", firstFrost: "12-31", label: "H1b — Cool greenhouse" },
  "H1a": { lastFrost: "01-15", firstFrost: "12-31", label: "H1a — Heated greenhouse" },
};

// ----------------------------------------------------------------------------
// ANHGA — Australian National Hardiness Garden Atlas. 7 zones from 1 (coolest,
// alpine Tasmania) to 7 (tropical NT/QLD). NOTE SOUTHERN HEMISPHERE: "last
// frost" is end of winter (Aug-Oct), "first frost" is start of winter (Apr-Jun).
// ----------------------------------------------------------------------------
const ANHGA_ZONES = {
  "1": { lastFrost: "10-15", firstFrost: "04-15", label: "Zone 1 — Alpine (Tas. highlands)" },
  "2": { lastFrost: "09-30", firstFrost: "05-01", label: "Zone 2 — Cool (highlands, Tas.)" },
  "3": { lastFrost: "09-10", firstFrost: "05-15", label: "Zone 3 — Temperate (Melbourne, Canberra)" },
  "4": { lastFrost: "08-25", firstFrost: "06-01", label: "Zone 4 — Mild temperate (Sydney inland)" },
  "5": { lastFrost: "08-01", firstFrost: "06-15", label: "Zone 5 — Sub-tropical (Sydney coast, Perth)" },
  "6": { lastFrost: "07-15", firstFrost: "07-01", label: "Zone 6 — Warm sub-tropical (Brisbane)" },
  "7": { lastFrost: "01-15", firstFrost: "12-31", label: "Zone 7 — Tropical (Cairns, Darwin) — frost-free" },
};

// ----------------------------------------------------------------------------
// NEW ZEALAND — Climate zones A-G. NOTE SOUTHERN HEMISPHERE.
// A = warmest (Northland, sub-tropical) → G = coldest (Southern Alps).
// ----------------------------------------------------------------------------
const NZ_ZONES = {
  "A": { lastFrost: "08-01", firstFrost: "06-15", label: "Zone A — Sub-tropical (Northland)" },
  "B": { lastFrost: "08-20", firstFrost: "06-01", label: "Zone B — Warm temperate (Auckland)" },
  "C": { lastFrost: "09-01", firstFrost: "05-20", label: "Zone C — Temperate (Hamilton, BoP)" },
  "D": { lastFrost: "09-15", firstFrost: "05-10", label: "Zone D — Cool temperate (Wellington, Nelson)" },
  "E": { lastFrost: "10-01", firstFrost: "05-01", label: "Zone E — Cool (Christchurch, inland S. Island)" },
  "F": { lastFrost: "10-15", firstFrost: "04-20", label: "Zone F — Cold (Otago, Southland)" },
  "G": { lastFrost: "11-15", firstFrost: "04-01", label: "Zone G — Alpine (Southern Alps)" },
};

// ----------------------------------------------------------------------------
// EU — uses RHS H1a-H7 system, same data, but separate metadata so users
// in (say) Germany see "European hardiness" rather than "UK hardiness".
// Shallow-copied (rather than aliased) so future divergence — e.g. a Germany-
// specific tweak — doesn't accidentally mutate RHS_ZONES too. The zone values
// themselves are shared but the top-level container is independent.
// ----------------------------------------------------------------------------
const EU_ZONES = { ...RHS_ZONES };

// ============================================================================
// SYSTEM METADATA — what each one is called, which zones it contains, default
// ============================================================================
export const HARDINESS_SYSTEMS = {
  USDA: {
    label: "USDA (United States)",
    description: "Used in the US. Zones 1 (coldest) to 13 (warmest).",
    zones: USDA_ZONES,
    defaultZone: "6a",
    hemisphere: "north",
  },
  Canada: {
    label: "Canada Plant Hardiness",
    description: "Canadian plant hardiness zones. 0 (Arctic) to 9 (coastal BC).",
    zones: CANADA_ZONES,
    defaultZone: "4a",
    hemisphere: "north",
  },
  RHS: {
    label: "RHS (United Kingdom)",
    description: "Royal Horticultural Society. H1a (warmest) to H7 (hardiest).",
    zones: RHS_ZONES,
    defaultZone: "H5",
    hemisphere: "north",
  },
  EU: {
    label: "Europe (RHS-equivalent)",
    description: "European RHS-equivalent hardiness zones.",
    zones: EU_ZONES,
    defaultZone: "H5",
    hemisphere: "north",
  },
  ANHGA: {
    label: "Australia (ANHGA)",
    description: "Australian National Hardiness Garden Atlas. 7 zones, cool to tropical.",
    zones: ANHGA_ZONES,
    defaultZone: "4",
    hemisphere: "south",
  },
  NZ: {
    label: "New Zealand",
    description: "NZ climate zones A (warmest) to G (alpine).",
    zones: NZ_ZONES,
    defaultZone: "C",
    hemisphere: "south",
  },
};

// ============================================================================
// COUNTRY → DEFAULT SYSTEM MAPPING
// ----------------------------------------------------------------------------
// When we detect a user's country, this picks the most appropriate hardiness
// system. Any country not listed defaults to USDA (the most globally-known
// system, used as a reference even in countries without their own).
// ============================================================================
export const COUNTRY_TO_SYSTEM = {
  // North America
  US: "USDA",
  CA: "Canada",
  MX: "USDA",   // Mexico uses USDA reference

  // Oceania
  AU: "ANHGA",
  NZ: "NZ",

  // UK & Ireland
  GB: "RHS",
  IE: "RHS",

  // Continental Europe (RHS-equivalent)
  DE: "EU", FR: "EU", IT: "EU", ES: "EU", PT: "EU",
  NL: "EU", BE: "EU", LU: "EU", AT: "EU", CH: "EU",
  DK: "EU", SE: "EU", NO: "EU", FI: "EU", IS: "EU",
  PL: "EU", CZ: "EU", SK: "EU", HU: "EU", RO: "EU",
  BG: "EU", GR: "EU", HR: "EU", SI: "EU", EE: "EU",
  LV: "EU", LT: "EU",

  // Default for anywhere else: USDA (acts as a global reference)
};

// ============================================================================
// PUBLIC HELPERS
// ============================================================================

// Resolve the default hardiness system for a country code (ISO 3166-1 alpha-2).
// Falls back to USDA for unknown countries.
export function getDefaultSystemForCountry(countryCode) {
  if (!countryCode) return "USDA";
  return COUNTRY_TO_SYSTEM[countryCode.toUpperCase()] || "USDA";
}

// Look up zone info (lastFrost/firstFrost/label) for a system+zone combo.
// Falls back to the system's defaultZone if the zone isn't recognized.
export function getZoneInfo(system, zone) {
  const sys = HARDINESS_SYSTEMS[system] || HARDINESS_SYSTEMS.USDA;
  return sys.zones[zone] || sys.zones[sys.defaultZone];
}

// List the zone IDs for a system (used to populate dropdowns).
export function getZonesForSystem(system) {
  const sys = HARDINESS_SYSTEMS[system] || HARDINESS_SYSTEMS.USDA;
  return Object.keys(sys.zones);
}

// Estimate a zone from latitude for a given system. Each system has its
// own approximation since the climate-to-zone mapping varies.
// For southern-hemisphere systems, latitude is negative — we use absolute
// value but the seasons in the zone data are already inverted.
export function estimateZoneForSystem(system, lat, lon) {
  if (lat == null) {
    return HARDINESS_SYSTEMS[system]?.defaultZone || "6a";
  }
  const absLat = Math.abs(lat);

  if (system === "USDA") {
    if (absLat >= 48) return "3b";
    if (absLat >= 46) return "4a";
    if (absLat >= 44) return "4b";
    if (absLat >= 42) return "5a";
    if (absLat >= 40.5) return "5b";
    if (absLat >= 39) return "6a";
    if (absLat >= 37.5) return "6b";
    if (absLat >= 36) return "7a";
    if (absLat >= 34) return "7b";
    if (absLat >= 32) return "8a";
    if (absLat >= 30) return "8b";
    if (absLat >= 28) return "9a";
    if (absLat >= 26) return "9b";
    if (absLat >= 24) return "10a";
    return "10b";
  }

  if (system === "Canada") {
    // Canada is colder than US at same latitude due to continental position
    if (absLat >= 65) return "0a";
    if (absLat >= 60) return "1a";
    if (absLat >= 56) return "2a";
    if (absLat >= 53) return "3a";
    if (absLat >= 50) return "4a";
    if (absLat >= 47) return "5a";
    if (absLat >= 45) return "6a";
    if (absLat >= 43) return "7a";
    return "8a"; // coastal southern BC
  }

  if (system === "RHS" || system === "EU") {
    // UK/EU is moderated by the Gulf Stream — milder than latitude suggests
    if (absLat >= 60) return "H6";    // northern Scotland/Scandinavia
    if (absLat >= 55) return "H5";    // most of UK, S Scandinavia
    if (absLat >= 50) return "H4";    // southern UK, N Europe
    if (absLat >= 45) return "H4";    // central Europe
    if (absLat >= 40) return "H3";    // southern Europe (Italy, Spain)
    return "H2";                      // Mediterranean coast
  }

  if (system === "ANHGA") {
    // Australia uses negative latitudes; absLat 10 = tropical north, 43 = Tasmania
    if (absLat >= 42) return "1";     // Tasmania highlands
    if (absLat >= 38) return "2";     // Tasmania lowlands, Victorian alps
    if (absLat >= 35) return "3";     // Melbourne, Canberra, ACT
    if (absLat >= 32) return "4";     // Sydney inland, Perth hills
    if (absLat >= 28) return "5";     // Sydney coast, Brisbane south, Perth
    if (absLat >= 22) return "6";     // Brisbane, central QLD
    return "7";                       // Cairns, Darwin
  }

  if (system === "NZ") {
    // NZ negative latitudes; absLat 34 = Northland, 47 = Stewart Island
    if (absLat >= 46) return "F";     // Southland, Stewart Island
    if (absLat >= 44) return "E";     // Central Otago, Canterbury
    if (absLat >= 42) return "D";     // Nelson, Wellington
    if (absLat >= 39) return "C";     // Hamilton, Bay of Plenty
    if (absLat >= 37) return "B";     // Auckland
    return "A";                       // Northland, sub-tropical
  }

  // Unknown system — return its default zone
  return HARDINESS_SYSTEMS[system]?.defaultZone || "6a";
}

// ============================================================================
// AUTO-DETECT: pick the right hardiness system + zone for a user based on
// their country code and lat/lng. This is what we call after the user sets
// their homestead location, so they don't have to manually configure the
// zone system if their country has a sensible default.
//
// Returns { system, zone, source } where source is "country" (we knew the
// country and matched it) or "fallback" (no match, defaulted to USDA).
// ============================================================================
export function autoDetectHardiness(countryCode, lat, lon) {
  const system = getDefaultSystemForCountry(countryCode);
  const zone = estimateZoneForSystem(system, lat, lon);
  const source = (countryCode && COUNTRY_TO_SYSTEM[countryCode.toUpperCase()]) ? "country" : "fallback";
  return { system, zone, source };
}
