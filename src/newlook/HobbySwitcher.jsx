// ============================================================================
// New look (3.0) — hobby title + grouped hobby switcher
// ----------------------------------------------------------------------------
// On every hobby screen (and Stats) the hobby's name is the title, with a
// chevron: tapping it opens the switcher sheet, grouped into Animals,
// Garden & land, Kitchen & pantry, Crafts & herbal and Selling.
// ============================================================================

import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { nl, font, type } from "./theme.js";
import { Sheet, Button } from "./ui.jsx";
import { groupedEntries } from "./hobbies.js";
import HobbyGlyph from "./HobbyGlyph.jsx";

export function HobbyTitle({ name, onOpen, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <button type="button" data-tip="hobby-title" onClick={onOpen} aria-label={`Switch hobby, currently ${name}`} style={{
        display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: 0, background: "none",
        border: "none", cursor: "pointer", color: nl.ink, textAlign: "left",
      }}>
        <span style={{ fontFamily: font.display, fontSize: type.title, lineHeight: 1.1 }}>{name}</span>
        <ChevronDown size={18} strokeWidth={2} aria-hidden="true" />
      </button>
      {right}
    </div>
  );
}

export function HobbySwitcherSheet({ open, onClose, hobbies, activeKey, onPick, onManage, HobbyIcon }) {
  const groups = groupedEntries(hobbies);
  return (
    <Sheet open={open} onClose={onClose} label="Your hobbies" showClose>
      <h2 style={{ margin: "0 4px 4px", fontFamily: font.display, fontWeight: 400, fontSize: 26 }}>Your hobbies</h2>
      {groups.map((g) => (
        <div key={g.key}>
          <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: nl.soft, fontWeight: 600, padding: "14px 4px 6px" }}>{g.label}</div>
          {g.items.map((e) => {
            const on = e.key === activeKey;
            return (
              <button key={e.key} type="button" onClick={() => onPick(e)} aria-current={on ? "true" : undefined} style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 12px", marginBottom: 2,
                borderRadius: 14, cursor: "pointer", textAlign: "left", color: nl.ink, font: "inherit",
                background: on ? nl.card : "transparent", border: on ? `1.5px solid ${nl.ink}` : "1.5px solid transparent",
              }}>
                <span style={{ width: 38, height: 38, borderRadius: 11, background: nl.chip, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <HobbyGlyph type={e.type} size={20} strokeWidth={1.7} />
                </span>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{e.name}</span>
                <ChevronRight size={18} color={nl.soft} strokeWidth={2} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ))}
      <Button kind="outline" onClick={onManage} style={{ width: "100%", marginTop: 16 }}>Add or hide hobbies</Button>
    </Sheet>
  );
}
