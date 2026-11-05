// ============================================================================
// New look (3.0) — shared building blocks
// ----------------------------------------------------------------------------
// One card, one row, one button family, one sheet. New-look screens use only
// these (plus lucide line icons), never one-off styles — that is what keeps
// the app from looking "assembled".
// ============================================================================

import React, { useEffect } from "react";
import { ChevronRight, X } from "lucide-react";
import { nl, font, type, radius } from "./theme.js";

export function Card({ children, style, padded = false, onClick, as = "div", ...rest }) {
  const Tag = onClick ? "button" : as;
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{
        display: "block", width: "100%", boxSizing: "border-box", textAlign: "left",
        background: nl.card, border: `1px solid ${nl.line}`, borderRadius: radius.card,
        overflow: "hidden", padding: padded ? "14px 16px" : 0, color: nl.ink,
        font: "inherit", cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ title, right, style }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "14px 14px 8px", ...style }}>
      <div style={{ fontFamily: font.display, fontSize: type.section, lineHeight: 1.15 }}>{title}</div>
      {right != null && <div style={{ fontSize: type.small, color: nl.soft, flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

// A row inside a card: icon well · title/subtitle · trailing thing.
export function Row({ icon, iconBg, title, sub, trailing, onClick, tint, first, chevron }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", boxSizing: "border-box",
        padding: "12px 14px", minHeight: 56, textAlign: "left",
        border: "none", borderTop: first ? "none" : `1px solid ${nl.rule}`,
        background: tint || "transparent", color: nl.ink, font: "inherit",
        cursor: onClick ? "pointer" : undefined,
      }}
    >
      {icon && (
        <span style={{
          width: 36, height: 36, borderRadius: 10, background: iconBg || nl.chip, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{icon}</span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: type.body, fontWeight: 600, overflowWrap: "anywhere" }}>{title}</span>
        {sub && <span style={{ display: "block", fontSize: type.small, color: nl.soft, overflowWrap: "anywhere" }}>{sub}</span>}
      </span>
      {trailing}
      {chevron && <ChevronRight size={18} color={nl.soft} strokeWidth={2} aria-hidden="true" />}
    </Tag>
  );
}

// Buttons: "primary" (yolk, the one main action), "dark", "outline", "link".
export function Button({ kind = "primary", children, onClick, icon, style, small, disabled, ...rest }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    minHeight: small ? 36 : 50, padding: small ? "0 14px" : "0 18px",
    borderRadius: small ? radius.pill : radius.button, cursor: disabled ? "default" : "pointer",
    font: `${kind === "primary" ? 700 : 600} ${small ? type.small : type.body}px ${font.body}`,
    opacity: disabled ? 0.5 : 1, boxSizing: "border-box", textDecoration: "none",
  };
  const kinds = {
    primary: { background: nl.yolk, color: nl.ink, border: "none" },
    dark: { background: nl.ink, color: nl.paper, border: "none" },
    outline: { background: "transparent", color: nl.ink, border: `1.5px solid ${nl.ink}` },
    quiet: { background: "transparent", color: nl.ink, border: `1.5px solid ${nl.field}` },
    link: { background: "transparent", color: nl.good, border: "none", padding: 0, minHeight: 32 },
  };
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} style={{ ...base, ...kinds[kind], ...style }} {...rest}>
      {icon}{children}
    </button>
  );
}

// Bottom sheet over a dimmed screen. `above` = distance from the bottom
// (the Log picker sits on top of the nav bar).
export function Sheet({ open, onClose, children, label, above = 0, maxHeight = "85vh", showClose = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    // Sheets cover the nav bar, except the Log picker, which sits on top of it.
    <div style={{ position: "fixed", inset: 0, zIndex: above ? 70 : 95 }}>
      <button type="button" aria-label="Close" onClick={onClose} style={{
        position: "absolute", inset: 0, bottom: above, border: "none", background: nl.scrim, cursor: "default",
      }} />
      <section role="dialog" aria-modal="true" aria-label={label} style={{
        position: "absolute", left: 0, right: 0, bottom: above, maxHeight, overflowY: "auto",
        background: nl.paper, borderRadius: "26px 26px 0 0", padding: "10px 16px 18px",
        boxSizing: "border-box", boxShadow: "0 -10px 30px rgba(42,26,18,0.18)",
        maxWidth: 720, margin: "0 auto", color: nl.ink, fontFamily: font.body,
        paddingBottom: above ? 18 : "max(18px, env(safe-area-inset-bottom))",
      }}>
        <div style={{ width: 40, height: 5, borderRadius: 3, background: nl.field, margin: "0 auto 8px" }} />
        {showClose && (
          <button type="button" aria-label="Close" onClick={onClose} style={{
            position: "absolute", right: 8, top: 8, width: 44, height: 44, border: "none", background: "transparent",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: nl.ink,
          }}><X size={22} strokeWidth={2} /></button>
        )}
        {children}
      </section>
    </div>
  );
}

export function Chip({ selected, children, onClick, icon }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={!!selected} style={{
      flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 7, minHeight: 40, padding: "0 14px",
      borderRadius: radius.pill, cursor: "pointer", whiteSpace: "nowrap",
      font: `600 14px ${font.body}`,
      background: selected ? nl.ink : "transparent", color: selected ? nl.paper : nl.ink,
      border: selected ? `1.5px solid ${nl.ink}` : `1.5px solid ${nl.field}`,
    }}>
      {icon}{children}
    </button>
  );
}

export function Badge({ tone = "quiet", children }) {
  const tones = {
    quiet: { background: nl.chip, color: "#5A4433" },
    ready: { background: nl.yolkTint, color: nl.yolkInk },
    good: { background: nl.goodTint, color: nl.goodInk },
    alert: { background: nl.alertTint, color: "#8E3420" },
  };
  return (
    <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 9px", borderRadius: radius.pill, whiteSpace: "nowrap", ...tones[tone] }}>
      {children}
    </span>
  );
}

// The tab row under a hobby's name: Today · Birds/Herd/Plants · Stats.
export function HobbyTabs({ tabs, active, onPick, label = "Sections" }) {
  return (
    <nav aria-label={label} style={{ display: "flex", borderBottom: `1px solid ${nl.line}`, margin: "-4px 0 14px" }}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button key={t.key} type="button" onClick={() => onPick(t.key)} aria-current={on ? "page" : undefined} style={{
            flex: 1, minHeight: 44, background: "none", border: "none", cursor: "pointer",
            borderBottom: `2px solid ${on ? nl.ink : "transparent"}`, marginBottom: -1,
            color: on ? nl.ink : nl.soft, font: `600 14px ${font.body}`,
          }}>{t.label}</button>
        );
      })}
    </nav>
  );
}

// A circular +/− button (the egg counter).
export function RoundButton({ kind = "plus", size = 52, onClick, label, disabled }) {
  const plus = kind === "plus";
  return (
    <button type="button" onClick={onClick} aria-label={label} disabled={disabled} style={{
      width: size, height: size, borderRadius: size / 2, flexShrink: 0, cursor: disabled ? "default" : "pointer",
      border: plus ? "none" : `1.5px solid ${nl.field}`, background: plus ? nl.yolk : nl.card, opacity: disabled ? 0.4 : 1,
      display: "flex", alignItems: "center", justifyContent: "center", color: nl.ink,
    }}>
      <svg width={size * 0.44} height={size * 0.44} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={plus ? 2.4 : 2.2} strokeLinecap="round" aria-hidden="true">
        {plus ? <path d="M12 5v14M5 12h14" /> : <path d="M5 12h14" />}
      </svg>
    </button>
  );
}

export function ScreenTitle({ children, right, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 44 }}>
      <div>
        {sub && <div style={{ fontSize: type.small, color: nl.soft }}>{sub}</div>}
        <h1 style={{ margin: 0, fontFamily: font.display, fontWeight: 400, fontSize: type.title, lineHeight: 1.1, color: nl.ink }}>{children}</h1>
      </div>
      {right}
    </div>
  );
}
