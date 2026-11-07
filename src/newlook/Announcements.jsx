// ============================================================================
// New look (3.0) — one announcement card instead of stacked popups
// ----------------------------------------------------------------------------
// The giveaway, what's new, supporter thank-you, account nudge, milestone and
// app-store notices used to open as popups on top of each other at launch.
// In the new look they queue here, on Home, one at a time ("1 of 3", › for
// the next). Tapping the action opens the full screen for that notice; X
// dismisses it the same way closing its popup did.
// ============================================================================

import React, { useEffect, useState } from "react";
import { Gift, Sparkles, Heart, ShieldCheck, PartyPopper, Smartphone, ChevronRight, X, Sprout, CalendarDays } from "lucide-react";
import { nl, font } from "./theme.js";

const ICONS = { gift: Gift, sparkles: Sparkles, heart: Heart, shield: ShieldCheck, party: PartyPopper, phone: Smartphone, sprout: Sprout, calendar: CalendarDays };

// notices: [{ key, icon, title, sub, action, onAction, onDismiss }]
export default function AnnouncementCard({ notices }) {
  const [i, setI] = useState(0);
  const n = notices.length;
  useEffect(() => { if (i >= n) setI(0); }, [i, n]);
  if (!n) return null;
  const cur = notices[Math.min(i, n - 1)];
  const Icon = ICONS[cur.icon] || Sparkles;
  return (
    <section role="region" aria-label={`Announcements, ${Math.min(i, n - 1) + 1} of ${n}`} style={{
      background: nl.card, border: `1px solid ${nl.line}`, borderRadius: 20, padding: "12px 14px",
      display: "flex", gap: 12, alignItems: "flex-start",
    }}>
      <span style={{ width: 36, height: 36, borderRadius: 10, background: nl.yolkTint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={20} color={nl.yolkInk} strokeWidth={2} aria-hidden="true" />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: nl.ink }}>{cur.title}</div>
        {cur.sub && <div style={{ fontSize: 13, color: nl.soft, marginTop: 1 }}>{cur.sub}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <button type="button" onClick={cur.onAction} style={{
            background: "none", border: "none", padding: 0, minHeight: 32, cursor: "pointer",
            color: nl.good, font: `600 14px ${font.body}`,
          }}>{cur.action}</button>
          {n > 1 && (
            <>
              <span style={{ marginLeft: "auto", fontSize: 12, color: nl.soft }}>{Math.min(i, n - 1) + 1} of {n}</span>
              <button type="button" aria-label="Next announcement" onClick={() => setI((i + 1) % n)} style={{
                width: 40, height: 40, border: "none", background: "none", cursor: "pointer", color: nl.good,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><ChevronRight size={18} strokeWidth={2.2} /></button>
            </>
          )}
        </div>
      </div>
      <button type="button" aria-label={`Dismiss: ${cur.title}`} onClick={cur.onDismiss} style={{
        width: 40, height: 40, margin: "-10px -12px 0 0", border: "none", background: "none", cursor: "pointer",
        color: nl.soft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}><X size={18} strokeWidth={2} /></button>
    </section>
  );
}
