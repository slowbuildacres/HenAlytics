// ============================================================================
// New look (3.0) — pieces every hobby's Stats tab shares
// ----------------------------------------------------------------------------
// Range chips, the swipeable fun-fact cards (with a share button each) and
// the "All the numbers" toggle that keeps the old detailed analytics one tap
// away. Egg layers, Garden and Goats use the same three so they match.
// ============================================================================

import React, { useState } from "react";
import { Share2, ChevronDown, Lightbulb } from "lucide-react";
import { nl, font } from "./theme.js";
import { Legacy } from "./ui.jsx";

export function RangeChips({ options, value, onPick, label = "Time range" }) {
  return (
    <div role="group" aria-label={label} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => {
        const on = o.key === value;
        return <button key={o.key} type="button" aria-pressed={on} onClick={() => onPick(o.key)} style={{
          minHeight: 36, padding: "0 13px", borderRadius: 999, cursor: "pointer", font: `600 13px ${font.body}`,
          background: on ? nl.ink : "transparent", color: on ? nl.paper : nl.ink, border: on ? "none" : `1.5px solid ${nl.field}`,
        }}>{o.label}</button>;
      })}
    </div>
  );
}

// facts: [{ key, icon, title, sub }]; icons: { [icon]: LucideIcon }.
export function FactCarousel({ facts, icons = {}, onShare, label = "Fun facts, swipe for more" }) {
  if (!facts || !facts.length) return null;
  return (
    <div role="region" aria-label={label} style={{
      display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory", margin: "0 -20px", padding: "0 20px", scrollPaddingLeft: 20, scrollbarWidth: "none",
    }}>
      {facts.map((f, i) => {
        const Icon = icons[f.icon] || Lightbulb;
        return (
          <div key={f.key} style={{
            flex: facts.length === 1 ? "1 0 100%" : "0 0 min(300px, 82%)", scrollSnapAlign: "start", boxSizing: "border-box",
            background: nl.yolkTint, borderRadius: 20, padding: "12px 12px 14px 16px", display: "flex", flexDirection: "column", gap: 4,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, color: nl.yolkInk }}>
              <Icon size={14} strokeWidth={2} aria-hidden="true" />Fun fact
              <span style={{ marginLeft: "auto", letterSpacing: 0, textTransform: "none", fontWeight: 600 }}>{i + 1} of {facts.length}</span>
              {onShare && (
                <button type="button" aria-label={`Share: ${f.title}`} onClick={() => onShare(f)} style={{
                  width: 32, height: 32, marginLeft: 2, border: "none", borderRadius: 16, background: "rgba(255,253,248,0.6)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", color: nl.yolkInk,
                }}><Share2 size={16} strokeWidth={2} /></button>
              )}
            </div>
            <div style={{ fontFamily: font.display, fontSize: 20, lineHeight: 1.15, color: nl.ink }}>{f.title}</div>
            <div style={{ fontSize: 12, lineHeight: 1.35, color: nl.quietInk }}>{f.sub}</div>
          </div>
        );
      })}
    </div>
  );
}

// The share card the old BragShareModal draws, from a fun fact.
export function factCard(fact, data, { emoji, kicker }) {
  const name = String((data && data.homesteadName) || "").trim();
  return {
    kind: fact.kind || `fact_${fact.key}`,
    emoji,
    kicker: name || kicker,
    big: fact.big || "",
    line: fact.line || fact.title,
    chips: [], list: [], stats: [],
    title: `${fact.title} ${emoji}`,
    subtitle: fact.sub,
  };
}

export function AllNumbers({ label, children }) {
  const [open, setOpen] = useState(false);
  if (!children) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48, borderRadius: 14, padding: "0 12px",
        border: `1.5px solid ${nl.field}`, background: "transparent", cursor: "pointer", color: nl.ink, font: `600 14px ${font.body}`,
      }}>
        {open ? "Hide the detailed numbers" : label}
        <ChevronDown size={16} style={{ transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }} aria-hidden="true" />
      </button>
      {open && <Legacy>{children}</Legacy>}
    </>
  );
}

// A plain bar chart for a handful of months: [{ key, label, value }].
export function MonthBars({ months, color = nl.yolk, format = (v) => v, height = 140, label }) {
  const max = Math.max(1, ...months.map((m) => m.value));
  return (
    <div role="img" aria-label={label || months.map((m) => `${m.label} ${format(m.value)}`).join(", ")}
      style={{ display: "grid", gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`, gap: 10, alignItems: "end", height, marginTop: 14 }}>
      {months.map((m) => (
        <div key={m.key} style={{ display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-end", height: "100%" }}>
          <div style={{ fontSize: 11, color: nl.soft, textAlign: "center", marginBottom: 4 }}>{m.value ? format(m.value) : ""}</div>
          <div style={{ height: `${(m.value / max) * (height - 44)}px`, minHeight: m.value ? 3 : 0, borderRadius: "6px 6px 0 0", background: color }} />
          <div style={{ fontSize: 11, color: nl.soft, textAlign: "center", marginTop: 6 }}>{m.label}</div>
        </div>
      ))}
    </div>
  );
}
