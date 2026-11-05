// ============================================================================
// New look (3.0) — first-time setup for new users
// ----------------------------------------------------------------------------
// Three short steps instead of the old wizard + two welcome popups:
//   1. Welcome + "What do you call your place?"
//   2. "What do you keep?" — hobby chips grouped like the switcher
//   3. "Where's your homestead?" — use my location or type a town; shows the
//      growing zone and frost dates right away. Skippable.
// Making an account isn't forced here; it shows up later as an announcement.
// ============================================================================

import React, { useMemo, useState } from "react";
import { Check, ChevronLeft, MapPin, Sprout } from "lucide-react";
import { nl, font } from "./theme.js";
import { groupedEntries } from "./hobbies.js";
import HobbyGlyph from "./HobbyGlyph.jsx";
import { requestBrowserLocation, reverseGeocode, geocodePlace } from "../weather.js";
import { autoDetectHardiness } from "../hardiness.js";
import { getFrostDates } from "../gardenAlmanac.js";

const DEFAULT_ON = ["garden", "egg_layers"];

function Dots({ step }) {
  return (
    <div aria-label={`Step ${step + 1} of 3`} style={{ display: "flex", gap: 6, justifyContent: "center" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, background: i === step ? nl.ink : nl.field }} />
      ))}
    </div>
  );
}

const cta = {
  width: "100%", minHeight: 54, borderRadius: 16, border: "none", background: nl.yolk, color: nl.ink,
  font: `700 16px ${font.body}`, cursor: "pointer",
};
const linkBtn = {
  background: "none", border: "none", minHeight: 40, cursor: "pointer", color: nl.good, font: `600 15px ${font.body}`,
};
const field = {
  width: "100%", minHeight: 54, boxSizing: "border-box", borderRadius: 14, border: `1.5px solid ${nl.ink}`,
  background: nl.card, padding: "0 16px", font: `500 17px ${font.body}`, color: nl.ink,
};
const h1 = { margin: 0, fontFamily: font.display, fontWeight: 400, fontSize: 32, lineHeight: 1.1, color: nl.ink };
const lead = { fontSize: 15, lineHeight: 1.45, color: nl.soft, margin: 0 };

function zoneFor(loc) {
  try {
    const { system, zone } = autoDetectHardiness(loc.countryCode, loc.lat, loc.lon);
    const f = getFrostDates(zone, new Date().getFullYear(), system);
    const fmt = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return { system, zone, label: f.label || `Zone ${zone}`, last: fmt(f.lastFrost), first: fmt(f.firstFrost) };
  } catch (_) {
    return null;
  }
}

export default function SetupFlow({ hobbies, onSignIn, onFinish }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const all = useMemo(() => groupedEntries((hobbies || []).map((h) => ({ ...h, hidden: false }))), [hobbies]);
  const [picked, setPicked] = useState(() => new Set(all.flatMap((g) => g.items).filter((e) => DEFAULT_ON.includes(e.type)).map((e) => e.key)));
  const [place, setPlace] = useState("");
  const [loc, setLoc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const zone = loc ? zoneFor(loc) : null;

  const toggle = (key) => setPicked((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const useMine = async () => {
    setBusy(true); setErr("");
    try {
      const { lat, lon } = await requestBrowserLocation();
      const r = await reverseGeocode(lat, lon);
      setLoc({ lat, lon, label: (r && r.label) || "Your location", countryCode: r && r.countryCode });
      if (r && r.label) setPlace(r.label);
    } catch (e) {
      setErr("Couldn't get your location. Type your town instead.");
    }
    setBusy(false);
  };
  const lookUp = async () => {
    if (!place.trim()) return;
    setBusy(true); setErr("");
    const r = await geocodePlace(place);
    if (r) setLoc(r); else setErr("Couldn't find that place. Try a town and state, or a ZIP code.");
    setBusy(false);
  };
  const finish = (withLocation) => {
    const ids = all.flatMap((g) => g.items).filter((e) => picked.has(e.key)).flatMap((e) => e.ids);
    onFinish({ name: name.trim(), showIds: ids, location: withLocation && loc ? { ...loc, zone } : null });
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Set up Henalytics" style={{
      position: "fixed", inset: 0, zIndex: 300, background: nl.paper, color: nl.ink, fontFamily: font.body,
      overflowY: "auto", paddingTop: "env(safe-area-inset-top)",
    }}>
      <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100%", boxSizing: "border-box", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {step > 0 && (
          <button type="button" aria-label="Back" onClick={() => setStep(step - 1)} style={{ alignSelf: "flex-start", width: 44, height: 44, marginLeft: -12, border: "none", background: "none", cursor: "pointer", color: nl.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft size={24} strokeWidth={2} />
          </button>
        )}

        {step === 0 && (
          <>
            <div style={{ width: 88, height: 88, borderRadius: 26, background: nl.yolkTint, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 40 }}>
              <Sprout size={48} strokeWidth={1.6} aria-hidden="true" />
            </div>
            <h1 style={{ ...h1, fontSize: 36, marginTop: 10 }}>Welcome to Henalytics</h1>
            <p style={{ ...lead, fontSize: 16 }}>Your animals, garden and kitchen, all in one place. Free for every homestead.</p>
            <label htmlFor="nl-hs-name" style={{ marginTop: 18, fontSize: 14, fontWeight: 600 }}>What do you call your place?</label>
            <input id="nl-hs-name" style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Slow Build Acres" autoComplete="off" />
            <p style={{ ...lead, fontSize: 13, marginTop: -6 }}>Shows on your home screen. Change it anytime.</p>
          </>
        )}

        {step === 1 && (
          <>
            <h1 style={h1}>What do you keep?</h1>
            <p style={lead}>Pick as many as you like. You can add more later.</p>
            {all.map((g) => (
              <div key={g.key}>
                <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: nl.soft, fontWeight: 600, margin: "4px 2px 8px" }}>{g.label}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {g.items.map((e) => {
                    const on = picked.has(e.key);
                    return (
                      <button key={e.key} type="button" aria-pressed={on} onClick={() => toggle(e.key)} style={{
                        display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 13px", borderRadius: 999,
                        cursor: "pointer", font: `600 14px ${font.body}`,
                        background: on ? nl.ink : "transparent", color: on ? nl.paper : nl.ink,
                        border: `1.5px solid ${on ? nl.ink : nl.field}`,
                      }}>
                        {on ? <Check size={15} strokeWidth={2.6} aria-hidden="true" /> : <HobbyGlyph type={e.type} size={15} strokeWidth={2} />}
                        {e.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {step === 2 && (
          <>
            <h1 style={h1}>Where's your homestead?</h1>
            <p style={lead}>For frost alerts, planting dates and your growing zone. Only your town is saved.</p>
            <button type="button" onClick={useMine} disabled={busy} style={{ ...cta, background: "transparent", border: `1.5px solid ${nl.ink}`, font: `600 16px ${font.body}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}>
              <MapPin size={20} strokeWidth={2} aria-hidden="true" />Use my location
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: nl.soft, fontSize: 13 }}>
              <span style={{ flex: 1, height: 1, background: nl.line }} />or<span style={{ flex: 1, height: 1, background: nl.line }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input aria-label="Town or ZIP code" style={{ ...field, flex: 1 }} value={place} placeholder="Town or ZIP code"
                onChange={(e) => { setPlace(e.target.value); setLoc(null); }} onKeyDown={(e) => { if (e.key === "Enter") lookUp(); }} />
              <button type="button" onClick={lookUp} disabled={busy || !place.trim()} style={{ minHeight: 54, padding: "0 16px", borderRadius: 14, border: "none", background: nl.ink, color: nl.paper, font: `600 15px ${font.body}`, cursor: "pointer", opacity: place.trim() ? 1 : 0.5 }}>Find</button>
            </div>
            {err && <p role="alert" style={{ ...lead, color: "#8E3420" }}>{err}</p>}
            {loc && (
              <div style={{ background: nl.card, border: `1px solid ${nl.line}`, borderRadius: 20, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: nl.goodTint, display: "flex", alignItems: "center", justifyContent: "center" }}><Sprout size={20} color={nl.goodInk} strokeWidth={2} /></span>
                  <div><div style={{ fontWeight: 600 }}>{zone ? zone.label : "Location found"}</div><div style={{ fontSize: 13, color: nl.soft }}>{loc.label}</div></div>
                </div>
                {zone && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, borderTop: `1px solid ${nl.rule}`, paddingTop: 10 }}>
                    <div><div style={{ fontSize: 13, color: nl.soft }}>Last spring frost</div><div style={{ fontWeight: 600 }}>About {zone.last}</div></div>
                    <div><div style={{ fontSize: 13, color: nl.soft }}>First fall frost</div><div style={{ fontWeight: 600 }}>About {zone.first}</div></div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: "auto", paddingTop: 20, display: "flex", flexDirection: "column", gap: 12, paddingBottom: "env(safe-area-inset-bottom)" }}>
          <Dots step={step} />
          {step === 0 && <button type="button" style={cta} onClick={() => setStep(1)}>Continue</button>}
          {step === 1 && <button type="button" style={{ ...cta, opacity: picked.size ? 1 : 0.5 }} disabled={!picked.size} onClick={() => setStep(2)}>{picked.size ? `Continue with ${picked.size}` : "Pick at least one"}</button>}
          {step === 2 && <button type="button" style={cta} onClick={() => finish(true)}>Start my homestead</button>}
          {step === 0 && <button type="button" style={linkBtn} onClick={onSignIn}>I already have an account</button>}
          {step === 2 && <button type="button" style={{ ...linkBtn, color: nl.soft }} onClick={() => finish(false)}>Skip for now</button>}
        </div>
      </div>
    </div>
  );
}
