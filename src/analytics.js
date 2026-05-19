// ============================================================================
// analytics.js — shared advanced-analytics layer (ADV_ANALYTICS)
// ----------------------------------------------------------------------------
// LEAF MODULE: imports nothing. Every hobby file and HomesteadApp.jsx can
// import from here with no circular-dependency risk. Because hobby files each
// define their own local `palette`/fonts (there is no shared theme module),
// the visual components here take styling as PROPS rather than importing it.
//
// Exports:
//   ADV_ANALYTICS_FEATURE_KEY   — the single feature flag gating all of this.
//   earlyAccessState()          — pure gate resolver (copy of HomesteadApp's).
//   formatEarlyAccessDate()     — friendly date for the lock message.
//   priorDateRange()            — prior equal-length window, for period-vs-period.
//   computeDelta()              — % change between current and prior values.
//   StatTrend                   — ▲/▼ badge (takes palette + fonts as props).
//   personalRecord()            — best month from a monthly series.
//   LockedStatOverlay           — gates the new block (takes palette + fonts).
//   monthKey()                  — "YYYY-MM" bucket key from an ISO date.
//   localDateStr()              — local YYYY-MM-DD (matches HomesteadApp's).
// ============================================================================
import React from "react";

// One flag gates ALL advanced analytics across every hobby. A single
// earlyAccessConfig.features.advancedAnalytics edit controls the whole rollout.
export const ADV_ANALYTICS_FEATURE_KEY = "advancedAnalytics";

// Local YYYY-MM-DD string (NOT UTC) — matches localDateStr in HomesteadApp.jsx
// so ranges computed here line up with ranges computed there.
export function localDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// "YYYY-MM" bucket key from an ISO date string. Returns "" for bad input.
export function monthKey(isoDate) {
  if (!isoDate || typeof isoDate !== "string" || isoDate.length < 7) return "";
  return isoDate.slice(0, 7);
}

// Pure gate resolver — a copy of earlyAccessState from HomesteadApp.jsx, kept
// here so hobby files can resolve the gate without importing the main file.
// Returns: "public" | "supporter" | "early-locked" | "hidden" | "ungated".
export function earlyAccessState(featureKey, config, isSupporter, now) {
  const today = now instanceof Date ? now : new Date();
  if (!featureKey) return "ungated";
  const features = config && config.features;
  if (!features || typeof features !== "object") return "ungated";
  const f = features[featureKey];
  if (!f || typeof f !== "object" || !f.publicDate) return "ungated";

  const parts = String(f.publicDate).split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return "ungated";
  const publicAt = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  if (isNaN(publicAt.getTime())) return "ungated";

  if (today.getTime() >= publicAt.getTime()) return "public";
  if (f.supporterEarlyAccess !== true) return "hidden";

  const days = Number(f.earlyAccessDays);
  const windowDays = (Number.isFinite(days) && days > 0) ? days : 7;
  const earlyAt = new Date(publicAt.getTime() - windowDays * 24 * 60 * 60 * 1000);

  if (today.getTime() < earlyAt.getTime()) return "hidden";
  return isSupporter ? "supporter" : "early-locked";
}

// Format a YYYY-MM-DD publicDate as e.g. "July 1". Empty string on bad input.
export function formatEarlyAccessDate(publicDate) {
  const parts = String(publicDate || "").split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return "";
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

// Given a resolved {start,end} range (ISO date strings), return the prior
// comparable window of the SAME length immediately before it. All-time (both
// bounds empty) or a one-sided range has no defined length → returns null,
// and callers should hide the delta in that case.
export function priorDateRange(range) {
  if (!range || !range.start || !range.end) return null;
  const startMs = new Date(range.start + "T00:00:00").getTime();
  const endMs = new Date(range.end + "T00:00:00").getTime();
  if (isNaN(startMs) || isNaN(endMs) || endMs < startMs) return null;
  const spanDays = Math.round((endMs - startMs) / 86400000);
  const priorEnd = new Date(startMs - 86400000);
  const priorStart = new Date(priorEnd.getTime() - spanDays * 86400000);
  return { start: localDateStr(priorStart), end: localDateStr(priorEnd) };
}

// Filter records to a {start,end} range (inclusive) via a date accessor.
// Mirrors filterByDateRange in HomesteadApp.jsx so hobby files can compute
// the prior-period slice the same way the current slice was computed.
export function filterByDateRange(records, range, getDate) {
  if (!range || (!range.start && !range.end)) return records || [];
  return (records || []).filter((r) => {
    const d = getDate(r);
    if (!d) return false;
    if (range.start && d < range.start) return false;
    if (range.end && d > range.end) return false;
    return true;
  });
}

// Compute a delta between current and prior values. Returns null when there
// is no basis for comparison (missing value, or prior is zero so percent is
// undefined). `pct` is a rounded integer; `dir` is "up" | "down" | "flat".
export function computeDelta(current, prior) {
  if (prior == null || current == null || !isFinite(prior) || !isFinite(current)) return null;
  if (prior === 0) return null;
  const diff = current - prior;
  const pct = Math.round((diff / Math.abs(prior)) * 100);
  return { diff, pct, dir: diff > 0 ? "up" : diff < 0 ? "down" : "flat" };
}

// Small ▲/▼ trend badge. Pass the hobby file's local `palette` and `fonts`
// ({ body }) so this module needs no shared theme. `invertColor` flips the
// good/bad coloring for cost stats, where a decrease is the desired outcome.
export function StatTrend({ delta, invertColor = false, palette, fonts }) {
  if (!delta) return null;
  const fontBody = (fonts && fonts.body) || "inherit";
  const soft = (palette && palette.inkSoft) || "#5C4530";
  if (delta.dir === "flat") {
    return React.createElement(
      "span",
      { style: { fontSize: 11, color: soft, fontFamily: fontBody } },
      "— no change"
    );
  }
  const isGood = invertColor ? delta.dir === "down" : delta.dir === "up";
  const color = isGood ? "#3f7d3f" : "#b4503c";
  const arrow = delta.dir === "up" ? "▲" : "▼";
  return React.createElement(
    "span",
    { style: { fontSize: 11, color, fontFamily: fontBody, fontWeight: 600 } },
    `${arrow} ${Math.abs(delta.pct)}% vs. prior period`
  );
}

// Given a series of { month: "YYYY-MM", value: number }, return the best one
// as { value, month, label } — label is a friendly "Aug 2025". Null if empty.
export function personalRecord(monthlySeries) {
  if (!Array.isArray(monthlySeries) || monthlySeries.length === 0) return null;
  let best = null;
  for (const pt of monthlySeries) {
    if (pt == null || !isFinite(pt.value)) continue;
    if (best == null || pt.value > best.value) best = pt;
  }
  if (!best) return null;
  const parts = String(best.month).split("-").map(Number);
  let label = best.month;
  if (parts.length === 2 && !parts.some(isNaN)) {
    const d = new Date(parts[0], parts[1] - 1, 1);
    if (!isNaN(d.getTime())) label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  return { value: best.value, month: best.month, label };
}

// Bucket dated records into a { month: "YYYY-MM", value } series, summing the
// value accessor per month and sorting chronologically. Convenience for the
// personalRecord input and month-over-month line charts.
export function monthlySeries(records, getDate, getValue) {
  const byMonth = {};
  for (const r of records || []) {
    const k = monthKey(getDate(r));
    if (!k) continue;
    const v = Number(getValue(r));
    if (!isFinite(v)) continue;
    byMonth[k] = (byMonth[k] || 0) + v;
  }
  return Object.entries(byMonth)
    .map(([month, value]) => ({ month, value }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// Wraps a hobby's advanced-analytics block. Resolves the single shared gate:
//   "hidden"                       → render nothing (window not open yet)
//   "early-locked"                 → blurred preview + lock message + date
//   "supporter"/"public"/"ungated" → render children normally
// Takes the hobby file's local `palette` and `fonts` ({ body, display }).
export function LockedStatOverlay({ earlyAccessConfig, isSupporter, palette, fonts, children }) {
  const gate = earlyAccessState(ADV_ANALYTICS_FEATURE_KEY, earlyAccessConfig, isSupporter);
  if (gate === "hidden") return null;
  if (gate !== "early-locked") return children;

  const f = (earlyAccessConfig && earlyAccessConfig.features)
    ? earlyAccessConfig.features[ADV_ANALYTICS_FEATURE_KEY] : null;
  const when = f ? formatEarlyAccessDate(f.publicDate) : "";
  const fontBody = (fonts && fonts.body) || "inherit";
  const fontDisplay = (fonts && fonts.display) || "Georgia, serif";
  const ink = (palette && palette.ink) || "#2C1810";
  const inkSoft = (palette && palette.inkSoft) || "#5C4530";
  const line = (palette && palette.line) || "#2C181030";

  return React.createElement(
    "div",
    { style: { position: "relative", border: `1.5px dashed ${line}`, borderRadius: 12, overflow: "hidden" } },
    React.createElement(
      "div",
      { style: { filter: "blur(5px)", pointerEvents: "none", userSelect: "none", opacity: 0.7 }, "aria-hidden": "true" },
      children
    ),
    React.createElement(
      "div",
      {
        style: {
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", textAlign: "center",
          padding: 20, background: "rgba(255,255,255,0.35)",
        },
      },
      React.createElement("div", { style: { fontSize: 26, marginBottom: 6 } }, "🔒"),
      React.createElement(
        "div",
        { style: { fontFamily: fontDisplay, fontSize: 16, color: ink, marginBottom: 4 } },
        "New analytics — supporter early access"
      ),
      React.createElement(
        "div",
        { style: { fontFamily: fontBody, fontSize: 12, color: inkSoft, maxWidth: 280 } },
        when
          ? `Charts and trends unlock for everyone on ${when}. Supporters get them now.`
          : "Charts and trends are unlocking soon. Supporters get them now."
      )
    )
  );
}
