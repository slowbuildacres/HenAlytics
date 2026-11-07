// ============================================================================
// New look (3.0) — Look & app icon
// ----------------------------------------------------------------------------
// Light / dark / match the phone (free), the three color looks (Farmhouse
// free, Meadow and Barn for Supporters), and the home-screen icon (iPhone,
// Supporters). Picking a look applies it right away.
// ============================================================================

import React, { useEffect, useState } from "react";
import { ChevronLeft, Lock, Check, Sun, Moon, Smartphone } from "lucide-react";
import { nl, font, type, LOOKS } from "./theme.js";
import { Card, CardHeader, Badge, Button } from "./ui.jsx";
import { APP_ICONS, getAppIcon, setAppIcon } from "./appIcon.js";

const MODES = [
  { key: "system", label: "Match phone", I: Smartphone },
  { key: "light", label: "Light", I: Sun },
  { key: "dark", label: "Dark", I: Moon },
];

function LookPreview({ p }) {
  // A tiny phone: page, a card with a number, the yolk button, the nav bar.
  return (
    <div aria-hidden="true" style={{ width: "100%", aspectRatio: "3 / 4", borderRadius: 14, overflow: "hidden", background: p.paper, border: `1px solid ${p.line}`, position: "relative", boxSizing: "border-box" }}>
      <div style={{ position: "absolute", left: 8, right: 8, top: 10, height: 8, width: "55%", borderRadius: 4, background: p.ink, opacity: 0.85 }} />
      <div style={{ position: "absolute", left: 8, right: 8, top: 26, bottom: 40, borderRadius: 10, background: p.card, border: `1px solid ${p.line}`, padding: 8, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ fontFamily: font.display, fontSize: 22, color: p.ink, lineHeight: 1 }}>9</div>
        <div style={{ height: 16, borderRadius: 6, background: p.yolk }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 28, background: p.nav, display: "flex", alignItems: "center", justifyContent: "space-around" }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: p.navActive }} />
        <span style={{ width: 8, height: 8, borderRadius: 4, background: p.navIdle }} />
        <span style={{ width: 8, height: 8, borderRadius: 4, background: p.navIdle }} />
      </div>
    </div>
  );
}

export default function LookScreen({ appearance, isSupporter, onBack, onChange, onSupport, toast }) {
  const [icon, setIcon] = useState({ supported: false, name: "default" });
  const [busy, setBusy] = useState("");
  useEffect(() => { let on = true; getAppIcon().then((r) => { if (on) setIcon(r); }); return () => { on = false; }; }, []);
  const dark = appearance.dark;

  const pickIcon = async (it) => {
    if (it.supporter && !isSupporter) { onSupport(); return; }
    setBusy(it.key);
    try {
      await setAppIcon(it.key);
      setIcon((v) => ({ ...v, name: it.key }));
      onChange({ icon: it.key });
    } catch (e) {
      if (toast) toast((e && e.message) || "Couldn't change the icon.", { kind: "error" });
    }
    setBusy("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: -10 }}>
        <button type="button" onClick={onBack} aria-label="Back to More" style={{ width: 44, height: 44, border: "none", background: "none", color: nl.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
        <h1 style={{ margin: 0, fontFamily: font.display, fontWeight: 400, fontSize: type.title, lineHeight: 1.1 }}>Look & app icon</h1>
      </div>

      <Card>
        <CardHeader title="Light or dark" right="Free" />
        <div role="radiogroup" aria-label="Light or dark" style={{ display: "flex", gap: 6, padding: "0 14px 14px" }}>
          {MODES.map((m) => {
            const on = appearance.mode === m.key;
            return (
              <button key={m.key} type="button" role="radio" aria-checked={on} onClick={() => onChange({ mode: m.key })} style={{
                flex: 1, minHeight: 64, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                borderRadius: 14, cursor: "pointer", font: `600 13px ${font.body}`,
                background: on ? nl.ink : nl.card, color: on ? nl.paper : nl.ink, border: `1.5px solid ${on ? nl.ink : nl.field}`,
              }}><m.I size={20} strokeWidth={1.8} aria-hidden="true" />{m.label}</button>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title="Colors" right={isSupporter ? null : <Button kind="link" onClick={onSupport}>Supporter perk</Button>} />
        <div role="radiogroup" aria-label="Colors" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, padding: "0 14px 14px" }}>
          {Object.values(LOOKS).map((L) => {
            const locked = L.supporter && !isSupporter;
            const on = appearance.look === L.key && !locked;
            return (
              <button key={L.key} type="button" role="radio" aria-checked={on} aria-label={`${L.name}${locked ? ", Supporter perk" : ""}`}
                onClick={() => (locked ? onSupport() : onChange({ look: L.key }))} style={{
                  display: "flex", flexDirection: "column", gap: 6, padding: 6, borderRadius: 16, cursor: "pointer", textAlign: "left",
                  background: "transparent", border: `2px solid ${on ? nl.ink : "transparent"}`, color: nl.ink, font: "inherit",
                }}>
                <LookPreview p={dark ? L.dark : L.light} />
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 14, fontWeight: 600 }}>
                  {L.name}
                  {on && <Check size={15} strokeWidth={2.6} color={nl.good} aria-hidden="true" />}
                  {locked && <Lock size={13} strokeWidth={2.2} color={nl.soft} aria-hidden="true" />}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ padding: "0 14px 14px", fontSize: 13, color: nl.soft }}>
          {LOOKS[appearance.look] ? LOOKS[appearance.look].blurb : ""}. The forms you log with keep their own colors for now.
        </div>
      </Card>

      <Card>
        <CardHeader title="App icon" right={isSupporter ? null : <Badge tone="ready">Supporters</Badge>} />
        {icon.supported ? (
          <div role="radiogroup" aria-label="App icon" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, padding: "0 14px 14px" }}>
            {APP_ICONS.map((it) => {
              const on = icon.name === it.key;
              const locked = it.supporter && !isSupporter;
              return (
                <button key={it.key} type="button" role="radio" aria-checked={on} aria-label={`${it.name} icon${locked ? ", Supporter perk" : ""}`} onClick={() => pickIcon(it)} disabled={!!busy} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: 4, background: "none", border: "none", cursor: "pointer", color: nl.ink, font: `600 12px ${font.body}`,
                }}>
                  <span style={{ position: "relative", width: "100%", maxWidth: 64, aspectRatio: "1", borderRadius: "22%", overflow: "hidden", boxShadow: on ? `0 0 0 2px ${nl.paper}, 0 0 0 4px ${nl.ink}` : `0 0 0 1px ${nl.line}`, opacity: busy && busy !== it.key ? 0.6 : 1 }}>
                    <img src={it.img} alt="" style={{ width: "100%", height: "100%", display: "block" }} />
                    {locked && <span style={{ position: "absolute", right: 3, bottom: 3, width: 20, height: 20, borderRadius: 10, background: nl.card, display: "flex", alignItems: "center", justifyContent: "center" }}><Lock size={11} strokeWidth={2.4} color={nl.ink} /></span>}
                  </span>
                  {it.name}
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "0 14px 14px", display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {APP_ICONS.slice(0, 4).map((it) => <img key={it.key} src={it.img} alt="" style={{ width: 40, height: 40, borderRadius: 9 }} />)}
            </div>
            <span style={{ fontSize: 13, color: nl.soft, lineHeight: 1.4 }}>Pick a new home-screen icon in the iPhone and iPad app. Android icons are coming later.</span>
          </div>
        )}
      </Card>
    </div>
  );
}
