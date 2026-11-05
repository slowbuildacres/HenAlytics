// ============================================================================
// New look (3.0) — More
// ----------------------------------------------------------------------------
// Everything that used to live in header icons and the old bottom tabs:
// account + sync status, Sales, Year in review, Journal, Homestead Games,
// supporting the app, and settings.
// ============================================================================

import React, { useEffect, useState } from "react";
import {
  DollarSign, Sparkles, BookOpen, Trophy, Heart, Home as HomeIcon, MapPin, Settings,
  Cloud, CloudOff, Image as ImageIcon, Palette, GraduationCap, FileUp,
} from "lucide-react";
import { nl, font, type } from "./theme.js";
import { Card, Row, Badge } from "./ui.jsx";

const groupLabel = (text) => (
  <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: nl.soft, fontWeight: 600, padding: "14px 6px 6px" }}>{text}</div>
);

function ago(ts, now) {
  if (!ts) return null;
  const m = Math.floor((now - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.floor(h / 24)} days ago`;
}

// "Saved · synced 2 min ago" — the one place people check their data is safe.
export function syncLine({ signedIn, online, status, lastSyncAt, now = Date.now() }) {
  if (!signedIn) return { text: "Saved on this phone only. Sign in to back it up.", ok: false };
  if (!online) return { text: "Offline. Saved on this phone, will sync when you're back.", ok: false };
  if (status === "saving") return { text: "Saving…", ok: true };
  if (status === "error") return { text: "Couldn't sync. Your logs are saved on this phone.", ok: false };
  const when = ago(lastSyncAt, now);
  return { text: when ? `Saved · synced ${when}` : "Saved · synced", ok: true };
}

export default function MoreScreen({
  data, user, isSupporter, syncStatus, online, lastSyncAt, homesteadSwitcher,
  onAccount, onSales, onYear, onJournal, onGames, onPhotos, onSupport, supportLine,
  onHobbies, onBarn, onSettings, onLook, lookName, onProjects, projectsLine, onImport,
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const name = data.homesteadName || "Your homestead";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "H";
  const sync = syncLine({ signedIn: !!user, online, status: syncStatus, lastSyncAt, now });
  const ic = (Icon) => <Icon size={20} color={nl.ink} strokeWidth={1.8} />;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <h1 style={{ margin: "0 0 10px", fontFamily: font.display, fontWeight: 400, fontSize: type.title }}>More</h1>

      <Card>
        <Row first onClick={onAccount}
          icon={<span style={{ width: 40, height: 40, borderRadius: 20, background: nl.ink, color: nl.paper, display: "flex", alignItems: "center", justifyContent: "center", font: `700 14px ${font.body}` }}>{initials}</span>}
          iconBg="transparent"
          title={name}
          sub={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: sync.ok ? nl.soft : nl.alertInk }}>
              {sync.ok ? <Cloud size={13} strokeWidth={2} aria-hidden="true" /> : <CloudOff size={13} strokeWidth={2} aria-hidden="true" />}
              {sync.text}
            </span>
          }
          trailing={isSupporter ? <Badge tone="good">Supporter</Badge> : null} chevron />
        {homesteadSwitcher && <div style={{ padding: "0 14px 12px" }}>{homesteadSwitcher}</div>}
      </Card>

      {groupLabel("Your homestead")}
      <Card>
        {!data.salesHidden && <Row first icon={ic(DollarSign)} title="Sales & costs" onClick={onSales} chevron />}
        <Row first={!!data.salesHidden} icon={ic(Sparkles)} title="Year in review" onClick={onYear} chevron />
        <Row icon={ic(BookOpen)} title="Journal" onClick={onJournal} chevron />
        <Row icon={ic(ImageIcon)} title="Photos" onClick={onPhotos} chevron />
        {onProjects && <Row icon={ic(GraduationCap)} title="4-H & FFA" sub={projectsLine} onClick={onProjects} chevron />}
        <Row icon={ic(Trophy)} title="Homestead Games" onClick={onGames} chevron />
      </Card>

      <button type="button" onClick={onSupport} style={{
        marginTop: 14, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 18,
        background: nl.deep, color: nl.onDeep, border: "none", cursor: "pointer", textAlign: "left", font: "inherit",
      }}>
        <span style={{ width: 40, height: 40, borderRadius: 20, background: nl.yolk, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Heart size={20} color={nl.onYolk} strokeWidth={2} aria-hidden="true" />
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontWeight: 600, fontSize: 15 }}>{isSupporter ? "You're a Supporter" : "Support Henalytics"}</span>
          <span style={{ display: "block", fontSize: 13, color: nl.onDeepSoft }}>{supportLine || (isSupporter ? "Thank you for keeping it free" : "Free for every homestead, kept that way by supporters")}</span>
        </span>
      </button>

      {groupLabel("Settings")}
      <Card>
        <Row first icon={ic(HomeIcon)} title="Hobbies" sub="Add, hide or customize" onClick={onHobbies} chevron />
        <Row icon={ic(MapPin)} title="Homestead details" sub="Location, zone, farmhands" onClick={onBarn} chevron />
        {onImport && <Row icon={ic(FileUp)} title="Bring in old records" sub="From Excel or Google Sheets" onClick={onImport} chevron />}
        {onLook && <Row icon={ic(Palette)} title="Look & app icon" sub={lookName || "Farmhouse"} onClick={onLook} chevron />}
        <Row icon={ic(Settings)} title="All settings" sub="Reminders, units, export, help" onClick={onSettings} chevron />
      </Card>
    </div>
  );
}
