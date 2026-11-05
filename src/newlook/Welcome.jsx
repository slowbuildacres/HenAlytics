// ============================================================================
// New look (3.0) — "Things look a little different" for existing users
// ----------------------------------------------------------------------------
// Shown once after updating to 3.0 (never to brand-new users, who get setup
// instead): a short note from the maker, where things moved, and how logging
// works now. Then one-time tips point at the Log button, the hobby name and
// Year in review the first time each screen is opened.
// ============================================================================

import React, { useEffect, useLayoutEffect, useState } from "react";
import { ChevronLeft, Plus, ChevronDown, Check, DollarSign, Sparkles, Heart, Settings, BookOpen, Trophy } from "lucide-react";
import { nl, font } from "./theme.js";

const MOVES = [
  { icon: DollarSign, what: "Sales", now: "in More", was: "its own tab at the bottom" },
  { icon: Sparkles, what: "Year in review", now: "at the top of Stats", was: "its own tab at the bottom" },
  { icon: Heart, what: "Tip & Supporters", now: "in More", was: "the heart in the middle" },
  { icon: ChevronDown, what: "Switching hobbies", now: "the hobby's name", was: "the list at the top of Home" },
  { icon: Settings, what: "Settings", now: "in More", was: "the gear and barn icons" },
  { icon: BookOpen, what: "Journal and Games", now: "in More", was: "icons at the top" },
];

const h1 = { margin: 0, fontFamily: font.display, fontWeight: 400, fontSize: 34, lineHeight: 1.08, color: nl.ink };
const body = { fontSize: 16, lineHeight: 1.5, color: "#4A3628", margin: 0 };
const cta = { width: "100%", minHeight: 54, borderRadius: 16, border: "none", background: nl.yolk, color: nl.ink, font: `700 16px ${font.body}`, cursor: "pointer" };

export function WelcomeNewLook({ onDone }) {
  const [step, setStep] = useState(0);
  return (
    <div role="dialog" aria-modal="true" aria-label="The new Henalytics" style={{
      position: "fixed", inset: 0, zIndex: 300, background: nl.paper, color: nl.ink, fontFamily: font.body,
      overflowY: "auto", paddingTop: "env(safe-area-inset-top)",
    }}>
      <div style={{ maxWidth: 520, margin: "0 auto", minHeight: "100%", boxSizing: "border-box", padding: "24px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
        {step > 0 && (
          <button type="button" aria-label="Back" onClick={() => setStep(step - 1)} style={{ alignSelf: "flex-start", width: 44, height: 44, marginLeft: -12, border: "none", background: "none", cursor: "pointer", color: nl.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft size={24} strokeWidth={2} />
          </button>
        )}
        {step === 0 && (
          <>
            <span style={{ alignSelf: "flex-start", marginTop: 36, fontSize: 12, fontWeight: 700, letterSpacing: 1, padding: "5px 10px", borderRadius: 999, background: nl.yolkTint, color: nl.yolkInk }}>THE NEW HENALYTICS</span>
            <h1 style={h1}>Things look a little different</h1>
            <p style={body}>Henalytics has grown a lot this year. With every new feature it got harder to find things, so I rebuilt the screens to make everything easier to get to.</p>
            <p style={body}>Your animals, logs and numbers are all exactly where you left them.</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 40, height: 40, borderRadius: 20, background: nl.ink, color: nl.paper, display: "flex", alignItems: "center", justifyContent: "center", font: `700 14px ${font.body}` }}>RL</span>
              <div><div style={{ fontWeight: 600 }}>Riley</div><div style={{ fontSize: 13, color: nl.soft }}>Made in Kansas, one feature at a time</div></div>
            </div>
            <div style={{ background: nl.card, border: `1px solid ${nl.line}`, borderRadius: 20, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              {[[Plus, "One Log button for everything"], [ChevronDown, "Tap a hobby's name to switch"], [Check, "Less clutter, no popup pile-ups"]].map(([Icon, t]) => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: nl.chip, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={20} strokeWidth={2} aria-hidden="true" /></span>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{t}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h1 style={h1}>Where things moved</h1>
            <p style={{ ...body, fontSize: 15, color: nl.soft }}>Nothing was removed. A few things just have a new home.</p>
            <div style={{ background: nl.card, border: `1px solid ${nl.line}`, borderRadius: 20, overflow: "hidden" }}>
              {MOVES.map((m, i) => (
                <div key={m.what} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderTop: i ? `1px solid ${nl.rule}` : "none" }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: nl.chip, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><m.icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{m.what} <span style={{ fontWeight: 400, color: nl.soft }}>is now</span> <span style={{ color: nl.good }}>{m.now}</span></div>
                    <div style={{ fontSize: 12, color: nl.soft, textDecoration: "line-through", textDecorationColor: nl.navIdle }}>Used to be: {m.was}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h1 style={h1}>Logging is two taps</h1>
            <p style={{ ...body, fontSize: 15, color: nl.soft }}>Tap the yellow Log button, pick a hobby, then pick what you did. Your widgets and the egg counter work just like before.</p>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 14, borderRadius: 18, background: nl.goodTint, marginTop: 8 }}>
              <Check size={22} color={nl.goodInk} strokeWidth={2.4} aria-hidden="true" />
              <div><div style={{ fontWeight: 600, color: nl.goodInk }}>Your data didn't change</div><div style={{ fontSize: 14, lineHeight: 1.4, color: nl.goodInk }}>Every egg, harvest and sale you've logged is still here, and syncing works the same.</div></div>
            </div>
          </>
        )}
        <div style={{ marginTop: "auto", paddingTop: 20, display: "flex", flexDirection: "column", gap: 12, paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div aria-label={`Step ${step + 1} of 3`} style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            {[0, 1, 2].map((i) => <span key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, background: i === step ? nl.ink : nl.field }} />)}
          </div>
          {step < 2
            ? <button type="button" style={cta} onClick={() => setStep(step + 1)}>{step === 0 ? "Show me what moved" : "Next"}</button>
            : <button type="button" style={cta} onClick={onDone}>Start exploring</button>}
          {step === 0 && <button type="button" onClick={onDone} style={{ background: "none", border: "none", minHeight: 40, cursor: "pointer", color: nl.soft, font: `600 15px ${font.body}` }}>Skip</button>}
          {step === 2 && <span style={{ textAlign: "center", fontSize: 13, color: nl.soft }}>See this again anytime in More › All settings</span>}
        </div>
      </div>
    </div>
  );
}

// One-time tips: dims the screen except the target (found by data-tip) and
// points a short bubble at it.
export const TIPS = {
  log: { title: "Log anything from here", body: "Eggs, feedings, harvests, sales and more.", n: 1 },
  "hobby-title": { title: "Tap the name to switch hobbies", body: "Every hobby has the same Today, animals and Stats layout.", n: 2 },
  yir: { title: "Year in review lives here now", body: "Plus Wrapped in December.", n: 3 },
};

export function TipSpotlight({ tipKey, onDone }) {
  const tip = TIPS[tipKey];
  const [rect, setRect] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = document.querySelector(`[data-tip="${tipKey}"]`);
      const r = el && el.getBoundingClientRect();
      setRect(r && r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null);
    };
    measure();
    const t = setTimeout(measure, 300);
    window.addEventListener("resize", measure);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
  }, [tipKey]);
  useEffect(() => { if (!tip) onDone(); }, [tip, onDone]);
  if (!tip || !rect) return null;
  const pad = 8;
  const below = rect.y < window.innerHeight / 2;
  const cx = rect.x + rect.w / 2;
  const bubbleW = Math.min(320, window.innerWidth - 32);
  const left = Math.max(16, Math.min(window.innerWidth - bubbleW - 16, cx - bubbleW / 2));
  return (
    <div role="dialog" aria-label="Tip" style={{ position: "fixed", inset: 0, zIndex: 250 }}>
      <div aria-hidden="true" style={{
        position: "absolute", left: rect.x - pad, top: rect.y - pad, width: rect.w + pad * 2, height: rect.h + pad * 2,
        borderRadius: Math.min(36, (rect.h + pad * 2) / 2), boxShadow: "0 0 0 4000px rgba(42,26,18,0.62)", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", left, width: bubbleW, boxSizing: "border-box",
        ...(below ? { top: rect.y + rect.h + pad + 14 } : { bottom: window.innerHeight - rect.y + pad + 14 }),
        background: nl.card, borderRadius: 18, padding: "14px 16px", boxShadow: "0 10px 30px rgba(0,0,0,0.25)", color: nl.ink, fontFamily: font.body,
      }}>
        <span aria-hidden="true" style={{
          position: "absolute", width: 16, height: 16, background: nl.card, transform: "rotate(45deg)",
          left: Math.max(14, Math.min(bubbleW - 30, cx - left - 8)), ...(below ? { top: -8 } : { bottom: -8 }),
        }} />
        <div style={{ fontFamily: font.display, fontSize: 20 }}>{tip.title}</div>
        <div style={{ fontSize: 14, color: nl.soft, marginTop: 2 }}>{tip.body}</div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 10 }}>
          <span style={{ fontSize: 12, color: nl.soft }}>{tip.n} of 3 tips</span>
          <button type="button" onClick={onDone} style={{ marginLeft: "auto", minHeight: 36, padding: "0 16px", borderRadius: 999, background: nl.ink, color: nl.paper, border: "none", font: `600 14px ${font.body}`, cursor: "pointer" }}>Got it</button>
        </div>
      </div>
    </div>
  );
}
