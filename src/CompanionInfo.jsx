// ============================================================================
// COMPANION INFO — shared UI
// ----------------------------------------------------------------------------
// Two small, host-agnostic components used in both the crop planner
// (CalendarModals) and the garden map (GardenMap):
//
//   <CompanionPanel cropId palette fonts /> — collapsible "good & bad
//       neighbors" guidance + the crop's family. Renders nothing for crops we
//       have no companion data for (e.g. custom crops).
//
//   <RotationNote cropId priorCropIds palette fonts /> — a one-line warning
//       when the same bed grew a same-family crop in a prior season.
//
// Both take the host's `palette` (bg/bgAlt/ink/inkSoft/accent/leaf/card/line…)
// and `fonts` ({ display, body }) so they match whichever screen they're on.
// All companion/rotation lore is traditional guidance — framed as a nudge.
// ============================================================================

import React, { useState } from "react";
import { getCompanions, getCropFamily, rotationConflict } from "./gardenAlmanac.js";

// Fallback palette/fonts so the components are safe to render even if a host
// forgets to pass them. Values mirror the app's parchment theme.
const DEFAULT_PALETTE = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", card: "#FAF5EA", line: "#2C181030",
};
const DEFAULT_FONTS = {
  display: `'DM Serif Display', Georgia, serif`,
  body: `'Be Vietnam Pro', -apple-system, sans-serif`,
};

function Chip({ item, tone, fonts }) {
  const colors = tone === "good"
    ? { bg: "#E8F0DC", border: "#5A7A3C", ink: "#3D5226" }
    : { bg: "#FBE5DE", border: "#C84B31", ink: "#8A2E1C" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "4px 9px", borderRadius: 999, fontSize: 12,
      background: colors.bg, border: `1px solid ${colors.border}55`,
      color: colors.ink, fontFamily: fonts.body, whiteSpace: "nowrap",
    }}>
      {item.emoji && <span style={{ fontSize: 13 }}>{item.emoji}</span>}
      {item.label}
    </span>
  );
}

export function CompanionPanel({ cropId, palette = DEFAULT_PALETTE, fonts = DEFAULT_FONTS, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const companions = getCompanions(cropId);
  const family = getCropFamily(cropId);
  if (!companions) return null; // no data (e.g. custom crop)

  return (
    <div style={{
      marginTop: 14, border: `1.5px solid ${palette.line}`,
      borderRadius: 10, overflow: "hidden", background: palette.card,
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", padding: "10px 12px", background: "transparent",
          border: "none", cursor: "pointer", fontFamily: fonts.body,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          color: palette.ink,
        }}
        aria-expanded={open}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
          🌿 Good &amp; bad neighbors
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {family && (
            <span style={{ fontSize: 11, color: palette.inkSoft, fontStyle: "italic" }}>{family.label}</span>
          )}
          <span style={{ fontSize: 11, color: palette.inkSoft, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 12px 12px" }}>
          {companions.good.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: palette.leaf, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>
                ✓ Plant near
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {companions.good.map((it, i) => <Chip key={`g${i}`} item={it} tone="good" fonts={fonts} />)}
              </div>
            </div>
          )}

          {companions.bad.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: palette.accent, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>
                ✗ Keep apart
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {companions.bad.map((it, i) => <Chip key={`b${i}`} item={it} tone="bad" fonts={fonts} />)}
              </div>
            </div>
          )}

          {companions.note && (
            <div style={{ fontSize: 12, color: palette.inkSoft, lineHeight: 1.5, fontStyle: "italic" }}>
              {companions.note}
            </div>
          )}

          {family && (
            <div style={{ fontSize: 11, color: palette.inkSoft, lineHeight: 1.5, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${palette.line}` }}>
              In the <strong>{family.label}</strong> family — rotate so it doesn&rsquo;t follow another {family.label.toLowerCase()} crop in the same bed year to year.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Inline rotation warning. Renders nothing unless `priorCropIds` (what grew in
// this same bed in a prior season) shares a family with `cropId`.
export function RotationNote({ cropId, priorCropIds = [], palette = DEFAULT_PALETTE, fonts = DEFAULT_FONTS }) {
  const conflict = rotationConflict(cropId, priorCropIds);
  if (!conflict) return null;

  const list = conflict.conflictingCrops.join(", ");
  return (
    <div style={{
      marginTop: 12, padding: "10px 12px",
      background: "#FBE5DE", border: `1.5px solid ${palette.accent}`,
      borderRadius: 8, fontSize: 12, color: "#8A2E1C", lineHeight: 1.5,
    }}>
      <strong>🔄 Rotation heads-up:</strong> this bed recently grew {list}
      {" "}— also in the {conflict.family.label.toLowerCase()} family.
      {conflict.tip ? ` ${conflict.tip}` : " Consider a different family here this year."}
    </div>
  );
}
