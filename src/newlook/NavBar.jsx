// ============================================================================
// New look (3.0) — bottom bar: Home · Stats · Log · Calendar · More
// ----------------------------------------------------------------------------
// The yellow Log button in the middle opens the Log picker; while it is open
// the button turns into a dark X ("Close").
// ============================================================================

import React from "react";
import { Home, BarChart3, Plus, X, Calendar, Menu } from "lucide-react";
import { nl, font } from "./theme.js";

function Tab({ label, icon: Icon, active, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? "page" : undefined} style={{
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
      background: "none", border: "none", padding: "2px 0", cursor: "pointer",
      color: active ? nl.navActive : nl.navIdle, font: `600 11px ${font.body}`, minHeight: 48,
    }}>
      <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
      {label}
    </button>
  );
}

export default function NavBar({ tab, logOpen, onHome, onStats, onLog, onCalendar, onMore }) {
  return (
    <nav aria-label="Main" style={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 80, background: nl.nav,
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", maxWidth: 720, margin: "0 auto", padding: "8px 8px 6px" }}>
        <Tab label="Home" icon={Home} active={!logOpen && tab === "home"} onClick={onHome} />
        <Tab label="Stats" icon={BarChart3} active={!logOpen && tab === "stats"} onClick={onStats} />
        <button type="button" data-tip="log" onClick={onLog} aria-label={logOpen ? "Close" : "Log something"} aria-expanded={!!logOpen} style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          background: "none", border: "none", marginTop: -22, cursor: "pointer",
          color: logOpen ? nl.onDeep : nl.navIdle, font: `600 11px ${font.body}`,
        }}>
          <span style={{
            width: 56, height: 56, borderRadius: 28, boxSizing: "border-box",
            background: logOpen ? nl.deep : nl.yolk, border: `4px solid ${nl.paper}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {logOpen
              ? <X size={22} color={nl.onDeep} strokeWidth={2.4} aria-hidden="true" />
              : <Plus size={26} color={nl.onYolk} strokeWidth={2.4} aria-hidden="true" />}
          </span>
          {logOpen ? "Close" : "Log"}
        </button>
        <Tab label="Calendar" icon={Calendar} active={!logOpen && tab === "calendar"} onClick={onCalendar} />
        <Tab label="More" icon={Menu} active={!logOpen && tab === "more"} onClick={onMore} />
      </div>
    </nav>
  );
}
