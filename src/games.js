// ============================================================================
// games.js — client helpers for the Homestead Games (regional standings)
// ----------------------------------------------------------------------------
// Data flow (mirrors the existing community stats pipeline):
//
//   local data blob
//     └─ computeStats / extractCommunityMetrics  (YearInReview.jsx — the
//        single source of truth for community numbers; reused here so the
//        Games and Year in Review can never disagree)
//          └─ upsert community_contributions (own row, RLS-guarded)
//               └─ daily recompute_region_stats() on the server
//                    └─ region_stats (read-only) → GamesHub boards
//
// Privacy invariants enforced client-side:
//   * No contribution is pushed unless the user has set a region AND
//     display_mode !== 'hidden'.
//   * Regional boards never include homestead names — anon_handle exists
//     for future individual boards, not used in v1 UI.
// ============================================================================

import { supabase, isSupabaseConfigured } from "./supabase.js";
// NOTE: computeStats / extractCommunityMetrics are pulled from YearInReview.jsx
// via dynamic import inside pushGamesContribution() — YearInReview.jsx imports
// from this module (closing-ceremony card), so a static import here would
// create a cycle. The dynamic import resolves to the same cached module.

// ----------------------------------------------------------------------------
// Games categories — keys MUST match extractCommunityMetrics() output and the
// rows seeded in games_category_config (supabase/homestead_games.sql).
// ----------------------------------------------------------------------------
export const GAMES_CATEGORIES = [
  { key: "eggs",    label: "Eggs collected",  noun: "eggs",    icon: "🥚" },
  { key: "harvest", label: "Garden harvest",  noun: "lbs",     icon: "🥕" },
  { key: "hatched", label: "Chicks hatched",  noun: "chicks",  icon: "🐣" },
  { key: "jars",    label: "Jars canned",     noun: "jars",    icon: "🫙" },
  { key: "honey",   label: "Honey harvested", noun: "lbs",     icon: "🍯" },
  { key: "milk",    label: "Milk collected",  noun: "gallons", icon: "🥛" },
];

// k-anonymity thresholds — display copy only; the real enforcement happens
// in recompute_region_stats(). Keep in sync with the SQL.
// A region appears on a board once it has MORE THAN 2 homesteads (>= 3) logging
// that category, uniformly across all levels. Keeps the k-anonymity guarantee
// consistent: a region's combined total is only shown once 3+ homesteads pool
// into it, so no single homestead's numbers can be read off the board.
export const REGION_K = { country: 3, subdivision: 3, county: 3 };

// ----------------------------------------------------------------------------
// Anonymous handle — generated once, stored on the region row, stable forever.
// Never derived from the user's name or email.
// ----------------------------------------------------------------------------
const HANDLE_FIRST = [
  "Maple", "Clover", "Willow", "Cedar", "Juniper", "Hickory", "Aspen",
  "Bramble", "Thistle", "Sorrel", "Hazel", "Rowan", "Alder", "Birch",
  "Chicory", "Yarrow", "Tansy", "Laurel", "Sumac", "Sassafras",
];
const HANDLE_SECOND = [
  "Hollow", "Ridge", "Creek", "Acres", "Meadow", "Bend", "Grove",
  "Run", "Flats", "Knoll", "Draw", "Bottom", "Rise", "Crossing",
];

export function genAnonHandle() {
  const a = HANDLE_FIRST[Math.floor(Math.random() * HANDLE_FIRST.length)];
  const b = HANDLE_SECOND[Math.floor(Math.random() * HANDLE_SECOND.length)];
  const n = 1000 + Math.floor(Math.random() * 9000);
  return `${a} ${b} #${n}`;
}

// Country code → flag emoji ("US" → 🇺🇸). Regional indicator math, no data.
export function countryFlag(cc) {
  if (!cc || cc.length !== 2) return "🏳️";
  return String.fromCodePoint(
    ...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))
  );
}

// ----------------------------------------------------------------------------
// Auto-placement — US states and Canadian provinces only.
// The onboarding wizard already stores homesteadLocation.label like
// "Atchison, KS" (from the zip lookup the user did for weather). If the
// trailing token is a US state or Canadian province abbreviation, we can
// place the homestead on its team with zero extra input — anonymous, never
// from device GPS, county never inferred. The two abbreviation sets are
// disjoint, so there's no ambiguity. Everything else (GB, AU, etc.) falls
// back to the manual region prompt.
// ----------------------------------------------------------------------------
const US_STATE_ABBRS = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC","PR","GU","VI","AS","MP",
]);
const CA_PROV_ABBRS = new Set([
  "AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT",
]);

// Full-name → abbreviation maps, so a label like "Atchison, Kansas" or
// "Brandon, Manitoba" auto-places just as well as the abbreviated form.
const US_STATE_NAMES = {
  "alabama":"AL","alaska":"AK","arizona":"AZ","arkansas":"AR","california":"CA",
  "colorado":"CO","connecticut":"CT","delaware":"DE","florida":"FL","georgia":"GA",
  "hawaii":"HI","idaho":"ID","illinois":"IL","indiana":"IN","iowa":"IA","kansas":"KS",
  "kentucky":"KY","louisiana":"LA","maine":"ME","maryland":"MD","massachusetts":"MA",
  "michigan":"MI","minnesota":"MN","mississippi":"MS","missouri":"MO","montana":"MT",
  "nebraska":"NE","nevada":"NV","new hampshire":"NH","new jersey":"NJ","new mexico":"NM",
  "new york":"NY","north carolina":"NC","north dakota":"ND","ohio":"OH","oklahoma":"OK",
  "oregon":"OR","pennsylvania":"PA","rhode island":"RI","south carolina":"SC",
  "south dakota":"SD","tennessee":"TN","texas":"TX","utah":"UT","vermont":"VT",
  "virginia":"VA","washington":"WA","west virginia":"WV","wisconsin":"WI","wyoming":"WY",
  "district of columbia":"DC","puerto rico":"PR","guam":"GU",
};
const CA_PROV_NAMES = {
  "alberta":"AB","british columbia":"BC","manitoba":"MB","new brunswick":"NB",
  "newfoundland and labrador":"NL","newfoundland":"NL","nova scotia":"NS",
  "northwest territories":"NT","nunavut":"NU","ontario":"ON","prince edward island":"PE",
  "quebec":"QC","québec":"QC","saskatchewan":"SK","yukon":"YT",
};
// Trailing country labels to skip past when scanning for the subdivision.
const COUNTRY_TOKENS = new Set([
  "us","usa","u.s.","u.s.a.","united states","united states of america",
  "ca","can","canada",
]);

// localStorage flag set when we auto-place — the hub shows a one-time
// "you're on Team X" notice keyed off this, then clears it on dismiss.
export const AUTO_JOIN_KEY = "games_auto_joined_v1";

export function deriveRegionFromLocation(data) {
  const label = data?.homesteadLocation?.label;
  if (typeof label !== "string") return null;
  // The state/province comes after the city, so scan comma-parts from the
  // end. Each part may carry a trailing zip ("KS 66002") or be a full name
  // ("Kansas"); a trailing country token ("US", "Canada") is skipped. This
  // catches every label shape the zip lookup, GPS reverse-geocode, and place
  // search produce — not just the bare "City, ST" form.
  const parts = label.split(",").map((p) => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    const lower = part.toLowerCase();
    if (COUNTRY_TOKENS.has(lower)) continue;
    const abbrTok = (part.match(/^([A-Za-z]{2})\b/) || [])[1];
    if (abbrTok) {
      const A = abbrTok.toUpperCase();
      if (US_STATE_ABBRS.has(A)) return { country_code: "US", subdivision_code: `US-${A}` };
      if (CA_PROV_ABBRS.has(A)) return { country_code: "CA", subdivision_code: `CA-${A}` };
    }
    if (US_STATE_NAMES[lower]) return { country_code: "US", subdivision_code: `US-${US_STATE_NAMES[lower]}` };
    if (CA_PROV_NAMES[lower]) return { country_code: "CA", subdivision_code: `CA-${CA_PROV_NAMES[lower]}` };
  }
  return null;
}

// ----------------------------------------------------------------------------
// Region row CRUD (homestead_regions — RLS lets users touch only their row)
// ----------------------------------------------------------------------------
export async function loadMyRegion() {
  if (!isSupabaseConfigured) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const { data, error } = await supabase
      .from("homestead_regions")
      .select("country_code, subdivision_code, county_code, display_mode, anon_handle")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}

export async function saveMyRegion({ country_code, subdivision_code = null, county_code = null, display_mode }) {
  if (!isSupabaseConfigured) return { ok: false, reason: "offline" };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { ok: false, reason: "signed_out" };

    // Preserve an existing handle so it never changes once minted.
    const existing = await loadMyRegion();
    const row = {
      user_id: session.user.id,
      country_code,
      subdivision_code: subdivision_code || null,
      county_code: county_code || null,
      display_mode: display_mode || existing?.display_mode || "anonymous",
      anon_handle: existing?.anon_handle || genAnonHandle(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("homestead_regions")
      .upsert(row, { onConflict: "user_id" });
    if (error) return { ok: false, reason: error.message };
    return { ok: true, region: row };
  } catch (e) {
    return { ok: false, reason: e?.message || "unknown" };
  }
}

// ----------------------------------------------------------------------------
// Contribution push — writes this homestead's current-year metrics so the
// nightly rollup can include them. Fire-and-forget, throttled to once per
// 6 hours unless forced (the Games page forces on open so a user who just
// set a region lands in tomorrow's recompute).
// ----------------------------------------------------------------------------
// v2: the v1 push armed this throttle even on failed writes, so existing
// installs carry a stale timestamp. Bumping the key ignores those so every
// client pushes fresh once on the first load after this fix.
const PUSH_TS_KEY = "games_contrib_pushed_at_v2";
const PUSH_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

export async function pushGamesContribution(data, { force = false } = {}) {
  if (!isSupabaseConfigured || !data) return;
  try {
    if (!force) {
      const last = Number(localStorage.getItem(PUSH_TS_KEY) || 0);
      if (Date.now() - last < PUSH_MIN_INTERVAL_MS) return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // Region — auto-placed from the homestead's saved location, no manual step
    // and no opt-in required. Everyone with a recognizable US state / Canadian
    // province is placed on that team automatically and anonymously. A user can
    // still override the placement from the Games page; a saved region always
    // wins over re-derivation.
    let region = await loadMyRegion();
    if (!region) {
      const derived = deriveRegionFromLocation(data);
      if (derived) {
        const res = await saveMyRegion({ ...derived, display_mode: "anonymous" });
        if (res.ok) {
          region = res.region;
          try { localStorage.setItem(AUTO_JOIN_KEY, derived.subdivision_code); } catch (_) {}
        }
      }
    }
    // No team to attribute to yet: no saved region and no recognizable location
    // (e.g. a non-US/CA label). They can pick a region manually from the Games
    // page; until then there's nothing to contribute to.
    if (!region) return;
    // `hidden` is the only opt-OUT — there is no opt-in step. A homestead the
    // user has explicitly hidden contributes nothing.
    if (region.display_mode === "hidden") return;

    const year = new Date().getFullYear();

    // computeStats is a proven export; extractCommunityMetrics is read the same
    // guarded way GamesHub does, so a missing/renamed export can never hard-throw
    // and silently kill the push (which is what kept the boards empty before).
    const mod = await import("./YearInReview.jsx");
    const computeStats = mod.computeStats;
    const extractCommunityMetrics = mod.extractCommunityMetrics;
    if (typeof computeStats !== "function" || typeof extractCommunityMetrics !== "function") {
      console.warn("[games] stats helpers unavailable — skipping contribution");
      return;
    }
    const metrics = extractCommunityMetrics(computeStats(data, year)) || {};

    const { error } = await supabase
      .from("community_contributions")
      .upsert(
        {
          user_id: session.user.id,
          year,
          metrics,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,year" }
      );

    // Only arm the throttle on a genuinely successful write. The old code set it
    // unconditionally, so a single failed push soft-locked all retries for six
    // hours — which is how one silent failure kept a homestead off the boards
    // indefinitely. On failure we log and leave the throttle unset so the next
    // open retries.
    if (error) {
      console.warn("[games] contribution push failed:", error.message || error);
      return;
    }
    try { localStorage.setItem(PUSH_TS_KEY, String(Date.now())); } catch (_) {}
  } catch (e) {
    console.warn("[games] contribution push threw:", e?.message || e);
  }
}

// ----------------------------------------------------------------------------
// Board fetch — one read of the pre-aggregated table for the year. The UI
// slices it by level/category/mode locally; no per-board round trips.
// ----------------------------------------------------------------------------
export async function fetchRegionBoards(year) {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from("region_stats")
      .select("category, region_level, region_code, total, homestead_count, per_homestead, visible")
      .eq("year", year);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}
