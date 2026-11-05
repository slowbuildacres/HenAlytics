// ============================================================================
// New look (3.0) — "Saved 9 eggs · Undo"
// ----------------------------------------------------------------------------
// After a save (and, as screens are rebuilt, a delete) a small bar shows for
// six seconds above the nav bar with an Undo button, instead of asking
// "Are you sure?" first. showUndo() can be called from anywhere; the bar only
// appears where <UndoHost /> is mounted (the new look).
// ============================================================================

import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { nl, font, NAV_HEIGHT } from "./theme.js";

const EVENT = "henalytics-undo";
const SHOW_MS = 6000;

export function showUndo(message, onUndo) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, onUndo } }));
}

export function UndoHost() {
  const [item, setItem] = useState(null);
  const timer = useRef(null);
  useEffect(() => {
    const on = (e) => {
      const { message, onUndo } = (e && e.detail) || {};
      if (!message) return;
      clearTimeout(timer.current);
      setItem({ message, onUndo, id: Math.random() });
      timer.current = setTimeout(() => setItem(null), SHOW_MS);
    };
    window.addEventListener(EVENT, on);
    return () => { window.removeEventListener(EVENT, on); clearTimeout(timer.current); };
  }, []);
  if (!item) return null;
  return (
    <div role="status" aria-live="polite" style={{
      position: "fixed", left: 16, right: 16, zIndex: 90, maxWidth: 688, margin: "0 auto",
      bottom: `calc(${NAV_HEIGHT + 12}px + env(safe-area-inset-bottom))`,
      display: "flex", alignItems: "center", gap: 10, padding: "10px 10px 10px 14px", borderRadius: 16,
      background: nl.deep, color: nl.onDeep, boxShadow: `0 8px 24px ${nl.shadow}`, font: `500 15px ${font.body}`,
    }}>
      <Check size={18} color={nl.accentOnDeep} strokeWidth={2.6} aria-hidden="true" />
      <span style={{ flex: 1, minWidth: 0 }}>{item.message}</span>
      {typeof item.onUndo === "function" && (
        <button type="button" onClick={() => { clearTimeout(timer.current); setItem(null); item.onUndo(); }} style={{
          minHeight: 36, padding: "0 14px", borderRadius: 999, border: "none", cursor: "pointer",
          background: nl.yolk, color: nl.onYolk, font: `700 14px ${font.body}`,
        }}>Undo</button>
      )}
    </div>
  );
}
