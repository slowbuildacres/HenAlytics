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
export const REGION_K = { country: 3, subdivision: 3, county: 5 };

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
const PUSH_TS_KEY = "games_contrib_pushed_at_v1";
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

    // Region gate: no region row → not in the Games; hidden → contributes
    // nothing. (Opted-in supporters' Year in Review pushes are unaffected —
    // that flow has its own hook.)
    const region = await loadMyRegion();
    if (!region || region.display_mode === "hidden") return;

    const year = new Date().getFullYear();
    const { computeStats, extractCommunityMetrics } = await import("./YearInReview.jsx");
    const stats = computeStats(data, year);
    const metrics = extractCommunityMetrics(stats);

    await supabase
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
    try { localStorage.setItem(PUSH_TS_KEY, String(Date.now())); } catch (_) {}
  } catch {
    /* best-effort — a missed push just means yesterday's numbers for a day */
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
