// ============================================================================
// New look (3.0) — Log picker
// ----------------------------------------------------------------------------
// Tapping the Log button raises this panel above the nav bar: hobby chips on
// top (opening on the hobby you're in), that hobby's quick actions below.
// Tapping an action opens the existing log form for it. Hobbies that don't
// have picker actions yet offer "Open <hobby>" (their logs live on their page
// until each is rebuilt).
// ============================================================================

import React, { useEffect, useState } from "react";
import {
  Egg, Wheat, DollarSign, Utensils, Bird, Archive, NotebookPen, ShoppingBasket,
  Droplet, MoreHorizontal, Truck, ArrowRight, Milk, Stethoscope, Scale, Baby, Heart, Flame, Scissors, Mountain, Hammer, Pill,
} from "lucide-react";
import { nl, font } from "./theme.js";
import { Sheet, Chip } from "./ui.jsx";
import { switcherEntries, LOG_ACTIONS } from "./hobbies.js";
import { NAV_HEIGHT } from "./theme.js";
import HobbyGlyph from "./HobbyGlyph.jsx";

const ICONS = {
  egg: Egg, feed: Wheat, sold: DollarSign, used: Utensils, nest: Bird, bedding: Archive,
  note: NotebookPen, harvest: ShoppingBasket, water: Droplet, more: MoreHorizontal, move: Truck,
  milk: Milk, health: Stethoscope, weight: Scale, kid: Baby, heart: Heart, heat: Flame, shear: Scissors, ride: Mountain, farrier: Hammer, pill: Pill,
};

export default function LogPicker({ open, onClose, hobbies, activeHobbyId, onAction, onOpenHobby, HobbyIcon }) {
  const entries = switcherEntries(hobbies);
  const startKey = (entries.find((e) => e.ids.includes(activeHobbyId)) || entries[0] || {}).key;
  const [sel, setSel] = useState(startKey);
  // Re-open on the hobby you're in.
  useEffect(() => { if (open) setSel(startKey); }, [open, startKey]);
  const entry = entries.find((e) => e.key === sel) || entries[0];
  const actions = entry ? LOG_ACTIONS[entry.type] : null;

  return (
    <Sheet open={open} onClose={onClose} label="Log something" above={`calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom))`} maxHeight="70vh">
      <h2 style={{ margin: "0 0 10px", fontFamily: font.display, fontWeight: 400, fontSize: 22 }}>What are you logging?</h2>
      {entries.length > 1 && (
        <div role="group" aria-label="Pick a hobby" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -16px", padding: "0 16px 2px", scrollbarWidth: "none" }}>
          {entries.map((e) => (
            <Chip key={e.key} selected={e.key === entry?.key} onClick={() => setSel(e.key)}
              icon={<HobbyGlyph type={e.type} size={16} strokeWidth={2} />}>
              {e.name}
            </Chip>
          ))}
        </div>
      )}
      {entry && actions && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>
          {actions.map((a) => {
            const Icon = ICONS[a.icon] || NotebookPen;
            return (
              <button key={a.key} type="button" onClick={() => onAction(entry, a)} style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                minHeight: 68, padding: "8px 4px", borderRadius: 16, cursor: "pointer",
                background: a.primary ? nl.yolk : nl.card, border: `1px solid ${a.primary ? nl.yolk : nl.line}`,
                color: nl.ink, font: `600 12px ${font.body}`, textAlign: "center",
              }}>
                <Icon size={22} strokeWidth={1.9} aria-hidden="true" />
                {a.label}
              </button>
            );
          })}
        </div>
      )}
      {entry && !actions && (
        <button type="button" onClick={() => onOpenHobby(entry)} style={{
          display: "flex", alignItems: "center", gap: 12, width: "100%", marginTop: 12, padding: "14px 16px",
          borderRadius: 16, background: nl.yolk, border: "none", cursor: "pointer", color: nl.ink, textAlign: "left",
          font: `700 15px ${font.body}`,
        }}>
          <span style={{ flex: 1 }}>Open {entry.name} to log</span>
          <ArrowRight size={20} strokeWidth={2.2} aria-hidden="true" />
        </button>
      )}
      {!entry && (
        <div style={{ fontSize: 14, color: nl.soft, marginTop: 8 }}>Turn on a hobby first: More › Homestead and hobbies.</div>
      )}
    </Sheet>
  );
}
