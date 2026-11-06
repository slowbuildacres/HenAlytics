// ============================================================================
// Monthly Wrapped (3.0, Supporter perk)
// ----------------------------------------------------------------------------
// On the 1st of every month, supporters get last month as a short story:
// eggs, garden, everything else they made, sales, how often they showed up,
// and a finale card. Same numbers as Year in Review (computeStats takes a
// "YYYY-MM" month too), same image export as the December Wrapped.
//
// Anyone can open last month's recap from the Supporter screen to see what
// it's like; sharing it is for supporters.
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Share2, Egg, Sprout, DollarSign, CalendarCheck, Sparkles, Heart } from "lucide-react";
import { computeStats } from "../YearInReview.jsx";
import { collectGardenHarvests } from "../analytics.js";
import { computeHarvestValue } from "../gardenValue.js";
import { buildYearReport } from "../Sales.jsx";
import { fmtMoney, weightFromLbs, weightUnitLabel } from "../units.js";
import { renderNodeToBlob } from "../shareCard.js";
import { moreFacts, shareFiles } from "../Wrapped.jsx";
import { font } from "./theme.js";

const W = 360, H = 640;

// ---- months --------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, "0");
export function recapMonthKey(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function prevKey(key) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function monthName(key, style = "long") {
  const [y, m] = String(key).split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: style });
}

// Each season gets its own colors, like the December Wrapped gets Christmas.
const SEASONS = {
  winter: { a: "#3D6A88", b: "#22445C", c: "#122638", text: "#EEF4F8", soft: "#C4D6E2", kicker: "#F2D58A", accent: "#F6E3A8", btnInk: "#122638" },
  spring: { a: "#7FA65A", b: "#4C6B2F", c: "#23361A", text: "#F4F7EC", soft: "#D7E5C6", kicker: "#F2D58A", accent: "#FCE7B8", btnInk: "#23361A" },
  summer: { a: "#D99A26", b: "#A8691A", c: "#5C340C", text: "#FFF8EA", soft: "#F7DDB0", kicker: "#FFE7A8", accent: "#FFF1C9", btnInk: "#5C340C" },
  fall: { a: "#C4622D", b: "#8E3A1A", c: "#4A1E0E", text: "#F6E9D8", soft: "#E9CDB3", kicker: "#F2B66B", accent: "#FCE7B8", btnInk: "#4A1E0E" },
};
export function seasonOf(key) {
  const m = Number(String(key).split("-")[1]);
  if (m === 12 || m <= 2) return SEASONS.winter;
  if (m <= 5) return SEASONS.spring;
  if (m <= 8) return SEASONS.summer;
  return SEASONS.fall;
}

// ---- numbers --------------------------------------------------------------------
const int = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");
const one = (n) => { const v = Math.round((Number(n) || 0) * 10) / 10; return v % 1 === 0 ? int(v) : v.toLocaleString("en-US"); };
const money = (n) => fmtMoney(Math.round(Number(n) || 0)).replace(/[.,]00(?=\D*$)/, "");
const plural = (n, a, b) => (Number(n) === 1 ? a : (b || `${a}s`));
const dayOf = (iso) => Number(String(iso).slice(8, 10));
const ordinal = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

function eggDays(data, key) {
  const days = new Map();
  for (const h of data.hobbies || []) {
    for (const e of (data.entries && data.entries[h.id]) || []) {
      if (!e || !String(e.date || "").startsWith(key)) continue;
      if (e.action !== "eggs" && e.action !== "eggs_laid") continue;
      const d = String(e.date).slice(0, 10);
      days.set(d, (days.get(d) || 0) + (Number(e.count) || 0));
    }
  }
  return days;
}

export function monthNumbers(data, key) {
  const s = computeStats(data, key);
  const p = computeStats(data, prevKey(key));
  const range = { start: `${key}-01`, end: `${key}-31` };
  const gardenHobby = (data.hobbies || []).find((h) => h && h.type === "garden");
  const garden = computeHarvestValue(collectGardenHarvests(data, { range }), (gardenHobby && gardenHobby.harvestPrices) || {});
  const [y, m] = key.split("-").map(Number);
  let revenue = 0, net = 0, bestSalesMonth = false;
  try {
    const r = buildYearReport(data, y, new Date(y, m, 0, 23, 59));
    const row = r.months[m - 1];
    revenue = row.revenue; net = row.net;
    bestSalesMonth = revenue > 0 && m > 2 && r.months.slice(0, m).every((x, i) => i === m - 1 || x.revenue < revenue);
  } catch (_) { /* no sales */ }
  return { s, p, garden, revenue, net, bestSalesMonth, eggDays: eggDays(data, key) };
}

// The small numbers for the teaser card ("214 · EGGS IN OCT").
export function monthTeaser(data, key) {
  const { s, garden, revenue } = monthNumbers(data, key);
  const short = monthName(key, "short").toUpperCase();
  if (s.eggsCollected > 0) return { big: int(s.eggsCollected), small: `EGGS IN ${short}` };
  if (garden.total > 0) return { big: money(garden.total), small: `GROWN IN ${short}` };
  if (revenue > 0) return { big: money(revenue), small: `SOLD IN ${short}` };
  if (s.totalEntries > 0) return { big: int(s.totalEntries), small: `LOGS IN ${short}` };
  return null;
}

export function monthHasStory(data, key) {
  try { return computeStats(data, key).totalEntries >= 5; } catch (_) { return false; }
}

// Slides: { key, kind: "cover"|"hero"|"list"|"finale", icon, kicker, lead, big, unit, sub, minis[], list[], grid[] }
export function buildMonthSlides(data, key) {
  const { s, p, garden, revenue, net, bestSalesMonth, eggDays: days } = monthNumbers(data, key);
  const month = monthName(key);
  const prevMonth = monthName(prevKey(key));
  const name = String(data.homesteadName || "").trim();
  const mm = Number(key.split("-")[1]);
  const slides = [];
  // Harvest weight in the homestead's unit (lbs or kg).
  const gardenLbs = weightFromLbs(Number(s.totalHarvestLbs) || 0);
  const wUnit = weightUnitLabel();
  const more = moreFacts(s);

  slides.push({
    key: "cover", kind: "cover", kicker: name ? `${name} · ${month}` : month,
    lead: "Your month on the homestead", big: month,
    minis: [
      s.activeDays > 0 ? { icon: "calendar", bold: int(s.activeDays), text: `${plural(s.activeDays, "day")} you logged something` } : null,
      s.totalEntries > 0 ? { icon: "spark", bold: int(s.totalEntries), text: `${plural(s.totalEntries, "thing")} logged` } : null,
    ].filter(Boolean),
  });

  if (s.eggsCollected > 0) {
    const diff = s.eggsCollected - (p.eggsCollected || 0);
    let sub = "";
    if (p.eggsCollected > 0 && Math.abs(diff) >= 3) {
      sub = `${int(Math.abs(diff))} ${diff > 0 ? "more" : "fewer"} than ${prevMonth}`;
      if (diff < 0 && (mm >= 9 || mm === 12)) sub += ", which is normal as the days get shorter";
      else if (diff > 0 && mm >= 2 && mm <= 5) sub += ". The longer days are kicking in";
      sub += ".";
    }
    let bestDay = null;
    days.forEach((c, d) => { if (!bestDay || c > bestDay.c) bestDay = { d, c }; });
    if (bestDay && bestDay.c > 1) sub += `${sub ? " " : ""}Best day was the ${ordinal(dayOf(bestDay.d))}, with ${int(bestDay.c)}.`;
    slides.push({
      key: "eggs", kind: "hero", icon: "egg", kicker: "From the coop", lead: "The flock laid",
      big: int(s.eggsCollected), unit: `${plural(s.eggsCollected, "egg")} in ${month}`, sub,
      minis: [
        `That's ${one(s.eggsCollected / 12)} dozen`,
        s.eggRevenue > 0 ? `${money(s.eggRevenue)} in egg sales` : null,
      ].filter(Boolean).map((t) => ({ icon: "egg", text: t })),
    });
  }

  if (garden.total > 0 || gardenLbs > 0) {
    const top = garden.rows[0] || (s.topPlants || [])[0];
    slides.push({
      key: "garden", kind: "hero", icon: "sprout", kicker: "From the garden", lead: "You grew",
      big: garden.total > 0 ? money(garden.total) : one(gardenLbs),
      unit: garden.total > 0 ? "worth of food" : `lbs in ${month}`,
      sub: garden.total > 0 ? "At grocery store prices." : "",
      minis: [
        garden.total > 0 && gardenLbs > 0 ? { icon: "sprout", bold: `${one(gardenLbs)} ${wUnit}`, text: "picked" } : null,
        top ? { icon: "sprout", bold: top.plant, text: "was the top crop" } : null,
        garden.rows.length > 1 ? { icon: "sprout", bold: int(garden.rows.length), text: "different crops" } : null,
      ].filter(Boolean),
    });
  }

  if (more.length) {
    slides.push({ key: "more", kind: "list", kicker: "And that's not all", lead: `Everything else from ${month}`, list: more.slice(0, 5) });
  }

  if (revenue > 0) {
    slides.push({
      key: "sales", kind: "hero", icon: "money", kicker: "Open for business", lead: "You sold",
      big: money(revenue), unit: `in ${month}`,
      sub: bestSalesMonth ? "Your best month this year so far." : "",
      minis: [
        net > 0 && net < revenue ? { icon: "money", bold: money(net), text: "ahead of costs" } : null,
        s.farmstandTopItem ? { icon: "money", bold: s.farmstandTopItem.name, text: "was the best seller" } : null,
      ].filter(Boolean),
    });
  }

  if (s.activeDays > 0) {
    const streak = Number(s.longestStreak) || 0;
    slides.push({
      key: "habits", kind: "hero", icon: "calendar", kicker: "You showed up", lead: streak >= 3 ? "Your longest streak" : "You logged on",
      big: streak >= 3 ? int(streak) : int(s.activeDays), unit: streak >= 3 ? plural(streak, "day") + " in a row" : plural(s.activeDays, "day"),
      sub: s.heaviestDay && s.heaviestDayCount > 3 ? `Your busiest day was the ${ordinal(dayOf(s.heaviestDay))}, with ${int(s.heaviestDayCount)} logs.` : "",
      minis: streak >= 3 ? [{ icon: "calendar", bold: int(s.activeDays), text: `${plural(s.activeDays, "day")} logged in all` }] : [],
    });
  }

  const grid = [];
  if (s.eggsCollected > 0) grid.push({ big: int(s.eggsCollected), label: "eggs" });
  if (garden.total > 0) grid.push({ big: money(garden.total), label: "of food grown" });
  else if (gardenLbs > 0) grid.push({ big: one(gardenLbs), label: `${wUnit} harvested` });
  more.slice(0, 2).forEach((x) => grid.push({ big: x.big, label: x.label }));
  if (revenue > 0) grid.push({ big: money(revenue), label: "in sales" });
  if (s.activeDays > 0) grid.push({ big: int(s.activeDays), label: plural(s.activeDays, "day") + " logged" });
  slides.push({
    key: "finale", kind: "finale", kicker: `${month} at ${name || "the homestead"}`,
    big: `That was ${month}`, grid: grid.slice(0, 4), foot: "Made with Henalytics · free at henalytics.com",
  });
  return slides;
}

// ---- art --------------------------------------------------------------------------
const ICONS = { egg: Egg, sprout: Sprout, money: DollarSign, calendar: CalendarCheck, spark: Sparkles };

function Mini({ m, t }) {
  const I = ICONS[m.icon] || Sparkles;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 16, background: "rgba(255,255,255,0.1)" }}>
      <I size={20} color={t.accent} strokeWidth={1.8} />
      <span style={{ flex: 1, fontSize: 14, lineHeight: 1.3 }}>{m.bold != null && <b style={{ fontWeight: 700 }}>{m.bold} </b>}{m.text}</span>
    </div>
  );
}

export function MonthSlideArt({ slide, season, innerRef, rounded = true }) {
  const t = season;
  return (
    <div ref={innerRef} style={{
      width: W, height: H, position: "relative", overflow: "hidden", borderRadius: rounded ? 22 : 0, boxSizing: "border-box",
      background: `linear-gradient(165deg, ${t.a} 0%, ${t.b} 48%, ${t.c} 100%)`, color: t.text, fontFamily: font.body,
    }}>
      <div style={{ position: "absolute", right: -46, bottom: 30, opacity: 0.1 }}>
        <Sprout size={230} color={t.accent} strokeWidth={1.1} />
      </div>
      <div style={{ position: "absolute", left: 24, right: 24, top: 34, fontSize: 13, fontWeight: 700, color: t.kicker, letterSpacing: 0.3 }}>{slide.kicker}</div>
      <div style={{ position: "absolute", left: 24, right: 24, top: slide.kind === "list" ? 86 : 118, bottom: 70, display: "flex", flexDirection: "column", gap: 10 }}>
        {slide.lead && <div style={{ fontSize: 15, color: t.soft }}>{slide.lead}</div>}
        {slide.kind === "cover" && <div style={{ fontFamily: font.display, fontSize: 76, lineHeight: 0.95, color: t.accent }}>{slide.big}</div>}
        {slide.kind === "hero" && (
          <div>
            <div style={{ fontFamily: font.display, fontSize: String(slide.big).length > 6 ? 72 : 96, lineHeight: 0.95, color: t.accent, overflowWrap: "anywhere" }}>{slide.big}</div>
            <div style={{ fontFamily: font.display, fontSize: 28, lineHeight: 1.1, marginTop: 4 }}>{slide.unit}</div>
            {slide.sub && <div style={{ fontSize: 14, lineHeight: 1.45, color: t.soft, marginTop: 10 }}>{slide.sub}</div>}
          </div>
        )}
        {slide.kind === "list" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
            {slide.list.map((x) => (
              <div key={x.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, background: "rgba(255,255,255,0.1)" }}>
                <span style={{ fontSize: 24, lineHeight: 1 }}>{x.emoji}</span>
                <span style={{ fontFamily: font.display, fontSize: 28, color: t.accent, lineHeight: 1 }}>{x.big}</span>
                <span style={{ fontSize: 14, lineHeight: 1.25 }}>{x.label}</span>
              </div>
            ))}
          </div>
        )}
        {slide.kind === "finale" && (
          <div>
            <div style={{ fontFamily: font.display, fontSize: 44, lineHeight: 1.02 }}>{slide.big}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 22 }}>
              {slide.grid.map((g) => (
                <div key={g.label} style={{ padding: "14px 12px", borderRadius: 16, background: "rgba(255,255,255,0.1)" }}>
                  <div style={{ fontFamily: font.display, fontSize: 30, color: t.accent, lineHeight: 1.05, overflowWrap: "anywhere" }}>{g.big}</div>
                  <div style={{ fontSize: 12.5, color: t.soft, marginTop: 4 }}>{g.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {(slide.minis || []).length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: slide.kind === "cover" ? 26 : 14 }}>
            {slide.minis.map((m, i) => <Mini key={i} m={m} t={t} />)}
          </div>
        )}
      </div>
      <div style={{ position: "absolute", left: 20, right: 20, bottom: 24, textAlign: "center", fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: t.soft }}>
        {slide.foot || "Henalytics · henalytics.com"}
      </div>
    </div>
  );
}

// ---- viewer -----------------------------------------------------------------------
export function MonthlyRecapViewer({ data, update, monthKey, isSupporter, onClose, onBecomeSupporter, toast }) {
  const slides = useMemo(() => buildMonthSlides(data, monthKey), [data, monthKey]);
  const season = seasonOf(monthKey);
  const month = monthName(monthKey);
  const [i, setI] = useState(0);
  const idx = Math.min(i, slides.length - 1);
  const slide = slides[idx];
  const last = idx === slides.length - 1;
  const refs = useRef({});
  const [busy, setBusy] = useState(false);
  const say = (m, o) => { if (toast) toast(m, o); };

  useEffect(() => {
    if (!isSupporter) return;
    update((d) => {
      d.monthlyRecaps = { ...(d.monthlyRecaps || {}) };
      d.monthlyRecaps[monthKey] = { ...(d.monthlyRecaps[monthKey] || {}), seenAt: (d.monthlyRecaps[monthKey] && d.monthlyRecaps[monthKey].seenAt) || Date.now() };
      return d;
    });
  }, [monthKey, isSupporter]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => setI((v) => Math.min(slides.length - 1, v + 1));
  const prev = () => setI((v) => Math.max(0, v - 1));
  useEffect(() => {
    const onKey = (e) => { if (e.key === "ArrowRight") next(); else if (e.key === "ArrowLeft") prev(); else if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const name = String(data.homesteadName || "").trim();
  const shareText = `${name ? `${name}'s` : "My"} ${month} on the homestead. Made with Henalytics, free at henalytics.com`;
  const share = async () => {
    setBusy(true);
    try {
      const list = last ? slides : [slide];
      const files = [];
      for (const sl of list) {
        const node = refs.current[sl.key];
        if (!node) continue;
        const blob = await renderNodeToBlob(node, { width: 1080 });
        files.push(new File([blob], `henalytics-${monthKey}-${files.length + 1}-${sl.key}.png`, { type: "image/png" }));
      }
      const r = await shareFiles(files, { title: shareText, text: shareText });
      if (r === "downloaded") say(files.length > 1 ? `Saved ${files.length} pictures` : "Saved the picture");
    } catch (_) { say("Couldn't make the picture. Try again.", { kind: "error" }); }
    setBusy(false);
  };

  const vw = typeof window !== "undefined" ? window.innerWidth : 390;
  const vh = typeof window !== "undefined" ? window.innerHeight : 844;
  const scale = Math.min((vw - 24) / W, (vh - 200) / H, 1.3);
  const width = W * scale;

  return (
    <div role="dialog" aria-modal="true" aria-label={`${month} recap`} style={{
      position: "fixed", inset: 0, zIndex: 300, background: season.c, display: "flex", flexDirection: "column", alignItems: "center",
      paddingTop: "max(12px, env(safe-area-inset-top))", paddingBottom: "max(14px, env(safe-area-inset-bottom))", fontFamily: font.body, color: season.text,
    }}>
      <div style={{ display: "flex", gap: 4, width, marginBottom: 6 }}>
        {slides.map((sl, k) => <span key={sl.key} style={{ flex: 1, height: 3, borderRadius: 2, background: k <= idx ? season.text : "rgba(255,255,255,0.3)" }} />)}
      </div>
      <div style={{ display: "flex", width, justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, opacity: 0.85 }}>{idx + 1} of {slides.length}</span>
        <button type="button" onClick={onClose} aria-label="Close" style={{ width: 44, height: 44, marginRight: -10, border: "none", background: "none", color: season.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X size={22} strokeWidth={2} />
        </button>
      </div>
      <div style={{ width, height: H * scale, position: "relative", flexShrink: 0 }}>
        <div style={{ position: "absolute", left: 0, top: 0, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <MonthSlideArt slide={slide} season={season} />
        </div>
        <button type="button" aria-label="Previous" onClick={prev} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "35%", background: "transparent", border: "none", cursor: idx > 0 ? "pointer" : "default" }} />
        <button type="button" aria-label="Next" onClick={next} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "65%", background: "transparent", border: "none", cursor: last ? "default" : "pointer" }} />
      </div>
      <div style={{ width: Math.max(width, 300), marginTop: 12, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        {isSupporter ? (
          <button type="button" onClick={share} disabled={busy} style={{ width: "100%", minHeight: 52, borderRadius: 16, border: "none", background: season.accent, color: season.btnInk, font: `700 16px ${font.body}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: busy ? "wait" : "pointer" }}>
            <Share2 size={20} strokeWidth={2} />{busy ? "Making it…" : last ? `Share ${month}` : "Share this"}
          </button>
        ) : (
          <button type="button" onClick={onBecomeSupporter} style={{ width: "100%", minHeight: 52, borderRadius: 16, border: "none", background: season.accent, color: season.btnInk, font: `700 16px ${font.body}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
            <Heart size={20} strokeWidth={2} />Get one every month
          </button>
        )}
        <span style={{ fontSize: 12, color: season.soft, textAlign: "center" }}>
          {isSupporter ? "Supporter recap · a new one every 1st of the month" : "A Supporter perk · a new recap every 1st of the month"}
        </span>
      </div>
      <div aria-hidden="true" style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
        {slides.map((sl) => <MonthSlideArt key={sl.key} slide={sl} season={season} rounded={false} innerRef={(n) => { refs.current[sl.key] = n; }} />)}
      </div>
    </div>
  );
}
