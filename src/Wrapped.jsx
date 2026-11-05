// ============================================================================
// HOMESTEAD WRAPPED — the year on the homestead, Christmas edition 🎄
// ----------------------------------------------------------------------------
// A tap-through story (like Spotify Wrapped) of the year's numbers: eggs,
// garden value, the other critters and kitchen, sales, streaks, where your
// state finished in the Homestead Games, and a "Merry Christmas from <name>"
// finale. Every slide exports as a 1080×1920 story image; the finale also
// makes a Facebook link (share_cards, same as the other share cards).
//
// Open Dec 1 – Jan 15 (wrappedYear()). Outside that window it can be opened
// with ?wrapped=1 or henalytics://wrapped for previews; it then shows the
// year so far.
//
// Numbers come from the same helpers as Year in Review (computeStats), the
// garden value sheet (collectGardenHarvests + computeHarvestValue) and the
// year-end report (buildYearReport), so Wrapped never disagrees with them.
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { computeStats } from "./YearInReview.jsx";
import { collectGardenHarvests } from "./analytics.js";
import { computeHarvestValue } from "./gardenValue.js";
import { buildYearReport } from "./Sales.jsx";
import { loadMyRegion, fetchRegionBoards, GAMES_CATEGORIES } from "./games.js";
import { fmtMoney } from "./units.js";
import { renderNodeToBlob, canShareFiles, createShareLink, shareUrl } from "./shareCard.js";

const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

// Christmas palette (on brand: same cream and yolk-gold as the app).
const X = {
  pine: "#1F4A36", pineDeep: "#163628", berry: "#A32A2A", berryDeep: "#7E1F1F",
  snow: "#F6F1E7", gold: "#E8B547", goldSoft: "#F2D58A", ink: "#2C1810",
  mint: "#CFE3C8", rose: "#F3C9C0",
};
const THEMES = {
  pine: { bg: X.pine, bg2: X.pineDeep, text: X.snow, soft: "#CFE0D3", accent: X.gold },
  berry: { bg: X.berry, bg2: X.berryDeep, text: X.snow, soft: "#F3D3CC", accent: X.goldSoft },
  snow: { bg: X.snow, bg2: "#EADFCB", text: X.ink, soft: "#6B5440", accent: X.berry },
};

// Slide art is designed at 360×640 and exported at 1080×1920.
const W = 360, H = 640;

// ---- dates -------------------------------------------------------------------
export function wrappedYear(now = new Date()) {
  const m = now.getMonth(), d = now.getDate();
  if (m === 11) return now.getFullYear();
  if (m === 0 && d <= 15) return now.getFullYear() - 1;
  return null;
}
export function wrappedPreviewRequested() {
  try {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("wrapped") === "1";
  } catch (_) { return false; }
}
// The year Wrapped is about right now (season, or a preview of this year).
export function activeWrappedYear(now = new Date(), preview = false) {
  return wrappedYear(now) || (preview ? now.getFullYear() : null);
}

// ---- numbers ----------------------------------------------------------------
const int = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");
const money = (n) => fmtMoney(Math.round(Number(n) || 0)).replace(/[.,]00(?=\D*$)/, "");
const one = (n) => { const v = Math.round((Number(n) || 0) * 10) / 10; return v % 1 === 0 ? int(v) : v.toLocaleString("en-US"); };
const plural = (n, word, many) => `${Number(n) === 1 ? word : (many || `${word}s`)}`;
const MONTHS = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" };
const fullMonth = (m) => MONTHS[m] || m;
const prettyDate = (iso) => {
  if (!iso) return null;
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric" });
};

// Everything Wrapped needs for one year, in plain numbers.
export function wrappedNumbers(data, year) {
  const s = computeStats(data, year);
  const range = { start: `${year}-01-01`, end: `${year}-12-31` };
  const gardenHobby = (data.hobbies || []).find((h) => h && h.type === "garden");
  const harvests = collectGardenHarvests(data, { range });
  const garden = computeHarvestValue(harvests, (gardenHobby && gardenHobby.harvestPrices) || {});
  let report = null;
  try { report = buildYearReport(data, year); } catch (_) { report = null; }
  return { s, garden, report };
}

// The "and that's not all" list: whatever else the homestead made this year.
export function moreFacts(s) {
  const f = [];
  const add = (cond, emoji, big, label) => { if (cond) f.push({ emoji, big, label }); };
  add(s.incubatorEggsHatched > 0, "🐣", int(s.incubatorEggsHatched), plural(s.incubatorEggsHatched, "chick") + " hatched");
  add(s.honeyHarvestedLbs > 0, "🍯", one(s.honeyHarvestedLbs), "lbs of honey");
  const goatGal = (Number(s.goatMilkOz) || 0) / 128;
  add(goatGal >= 1, "🐐", one(goatGal), "gallons of goat milk");
  add(s.cowMilkGal > 0, "🐄", one(s.cowMilkGal), "gallons of milk");
  add(s.totalMeatLbs > 0, "🍗", one(s.totalMeatLbs), "lbs of home-raised chicken");
  add(s.totalKitsAlive > 0, "🐇", int(s.totalKitsAlive), "rabbit " + plural(s.totalKitsAlive, "kit"));
  const babies = (Number(s.goatKids) || 0) + (Number(s.cowCalves) || 0) + (Number(s.sheepLambsAlive) || 0);
  add(babies > 0, "🍼", int(babies), "goat kids, calves & lambs");
  add(s.canningJarsMade > 0, "🫙", int(s.canningJarsMade), plural(s.canningJarsMade, "jar") + " canned");
  add(s.sourdoughLoaves > 0, "🍞", int(s.sourdoughLoaves), "sourdough " + plural(s.sourdoughLoaves, "loaf", "loaves"));
  add(s.bakingItems > 0, "🍪", int(s.bakingItems), "baked goods");
  add(s.mapleSyrupGal > 0, "🍁", one(s.mapleSyrupGal), "gallons of maple syrup");
  add(s.sheepWoolLbs > 0, "🐑", one(s.sheepWoolLbs), "lbs of wool");
  add(s.horseRides > 0, "🐴", int(s.horseRides), plural(s.horseRides, "ride") + " on horseback");
  return f;
}

// Slides, in order. Each: { key, theme, emoji, kicker, big, line, rows[], foot }.
export function buildWrappedSlides(data, year, extras = {}) {
  const { s, garden, report } = wrappedNumbers(data, year);
  const name = String(data.homesteadName || "").trim();
  const our = name ? "the homestead" : "your homestead";
  const slides = [];

  slides.push({
    key: "cover", theme: "pine", emoji: "🎄",
    kicker: `${year} Homestead Wrapped`,
    big: name || "Your homestead",
    line: "Your year, wrapped up with a bow",
    rows: [
      s.activeDays > 0 ? `${int(s.activeDays)} ${plural(s.activeDays, "day")} on ${our}` : null,
      s.totalEntries > 0 ? `${int(s.totalEntries)} things logged` : null,
    ].filter(Boolean),
    foot: "Tap to unwrap →",
  });

  if (s.eggsCollected > 0) {
    const saved = Number(s.moneySavedVsBuying) || 0;
    slides.push({
      key: "eggs", theme: "berry", emoji: "🥚",
      kicker: "The hens delivered",
      big: int(s.eggsCollected),
      line: plural(s.eggsCollected, "egg") + " collected",
      rows: [
        `That's ${one(s.dozensCollected)} dozen`,
        s.peakEggMonth ? `Best month: ${fullMonth(s.peakEggMonth)}` : null,
        saved > 1 ? `${money(saved)} saved vs. store-bought` : null,
        s.eggRevenue > 0 ? `${money(s.eggRevenue)} in egg sales` : null,
      ].filter(Boolean).slice(0, 3),
      foot: "Somebody give those girls a treat 🎁",
    });
  }

  const gardenLbs = Number(s.totalHarvestLbs) || 0;
  if (garden.total > 0 || gardenLbs > 0) {
    const top = garden.rows[0] || (s.topPlants || [])[0];
    slides.push({
      key: "garden", theme: "pine", emoji: "🌱",
      kicker: "From the garden",
      big: garden.total > 0 ? money(garden.total) : one(gardenLbs),
      line: garden.total > 0 ? "worth of food grown" : "lbs harvested",
      rows: [
        garden.total > 0 && gardenLbs > 0 ? `${one(gardenLbs)} lbs harvested` : null,
        top ? `Top crop: ${top.plant}` : null,
        garden.rows.length > 1 ? `${garden.rows.length} different crops` : null,
      ].filter(Boolean),
      foot: "At grocery store prices. Not bad for some dirt and seeds.",
    });
  }

  const more = moreFacts(s);
  if (more.length) {
    slides.push({
      key: "more", theme: "snow", emoji: "🎁",
      kicker: "And that's not all",
      big: null, line: null,
      list: more.slice(0, 5),
      foot: more.length > 5 ? `…and ${more.length - 5} more` : "Look at everything you made",
    });
  }

  const revenue = report ? Number(report.revenue) || 0 : 0;
  if (revenue > 0) {
    const topHobby = report.revenueByHobby && report.revenueByHobby[0];
    slides.push({
      key: "sales", theme: "berry", emoji: "💵",
      kicker: "Open for business",
      big: money(revenue),
      line: "in sales",
      rows: [
        report.salesCount ? `${int(report.salesCount)} ${plural(report.salesCount, "sale")}` : null,
        s.farmstandTopItem ? `Best seller: ${s.farmstandTopItem.name}` : (topHobby && report.revenueByHobby.length > 1 ? `Top earner: ${topHobby.name}` : null),
        report.net > 0 && report.expenses > 0 ? `${money(report.net)} ahead of costs` : null,
      ].filter(Boolean),
      foot: "Ka-ching! 🔔",
    });
  }

  if (s.activeDays > 0) {
    const streak = Number(s.longestStreak) || 0;
    slides.push({
      key: "habits", theme: "snow", emoji: "📅",
      kicker: "You showed up",
      big: streak >= 3 ? int(streak) : int(s.activeDays),
      line: streak >= 3 ? "day logging streak" : plural(s.activeDays, "day") + " logged",
      rows: [
        s.busiestMonth ? `Busiest month: ${fullMonth(s.busiestMonth)}` : null,
        s.heaviestDay && s.heaviestDayCount > 3 ? `Biggest day: ${prettyDate(s.heaviestDay)} (${int(s.heaviestDayCount)} logs)` : null,
        streak >= 3 ? `${int(s.activeDays)} days logged in all` : null,
      ].filter(Boolean),
      foot: "Rain, shine or snow ❄️",
    });
  }

  if (extras.region) {
    const r = extras.region;
    slides.push({
      key: "region", theme: "pine", emoji: "🏅",
      kicker: "Homestead Games",
      big: `#${r.rank}`,
      line: `${r.place} in ${r.of}`,
      rows: [`for ${r.cat.label.toLowerCase()} ${r.cat.icon}`, "Every log you made counted toward it"],
      foot: "Go team! 🎉",
    });
  }

  // Finale: the four biggest numbers.
  const best = [];
  if (s.eggsCollected > 0) best.push({ emoji: "🥚", big: int(s.eggsCollected), label: "eggs" });
  if (garden.total > 0) best.push({ emoji: "🌱", big: money(garden.total), label: "of food grown" });
  else if (gardenLbs > 0) best.push({ emoji: "🌱", big: one(gardenLbs), label: "lbs harvested" });
  more.slice(0, 2).forEach((m) => best.push({ emoji: m.emoji, big: m.big, label: m.label }));
  if (revenue > 0) best.push({ emoji: "💵", big: money(revenue), label: "in sales" });
  if (s.activeDays > 0) best.push({ emoji: "📅", big: int(s.activeDays), label: plural(s.activeDays, "day") + " logged" });
  slides.push({
    key: "finale", theme: "berry", emoji: "🎄",
    kicker: `${year} Homestead Wrapped`,
    big: name ? `Merry Christmas from ${name}` : "Merry Christmas from our homestead",
    line: null,
    grid: best.slice(0, 4),
    foot: "Made with Henalytics · free at henalytics.com",
  });
  return slides;
}

// Best Homestead Games finish for the user's state/province (rank among the
// states of its country, top 10 only), or null. Reads the same pre-aggregated
// region_stats as Year in Review; never another homestead's numbers.
async function loadRegionHighlight(year) {
  try {
    const [region, boards] = await Promise.all([loadMyRegion(), fetchRegionBoards(year)]);
    const code = region && region.subdivision_code;
    if (!code || !boards || !boards.length) return null;
    const cc = String(code).split("-")[0];
    let best = null;
    GAMES_CATEGORIES.forEach((cat) => {
      const rows = boards.filter((b) => b.region_level === "subdivision" && b.category === cat.key && b.visible && String(b.region_code).startsWith(`${cc}-`))
        .sort((a, b) => Number(b.total) - Number(a.total));
      const idx = rows.findIndex((r) => r.region_code === code);
      if (idx < 0 || idx > 9 || rows.length < 3) return;
      if (!best || idx + 1 < best.rank) best = { rank: idx + 1, cat };
    });
    if (!best) return null;
    let stateName = null;
    try {
      const m = await import("./data/subdivisions.json");
      const subs = (m.default || m)[cc];
      const hit = ((subs && subs.subs) || []).find(([c]) => c === code);
      stateName = hit ? hit[1] : null;
    } catch (_) {}
    return { ...best, place: stateName || "Your state", of: cc === "US" ? "the US" : cc === "CA" ? "Canada" : "the country" };
  } catch (_) { return null; }
}

// ---- art ------------------------------------------------------------------------
const LIGHT_COLORS = ["#E8483A", "#E8B547", "#4FA35B", "#4C8FD6", "#E8483A", "#E8B547", "#4FA35B", "#4C8FD6", "#E8483A", "#E8B547"];

function Lights({ width }) {
  // A sagging string of bulbs across the top.
  const n = LIGHT_COLORS.length;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width, height: 46, pointerEvents: "none" }}>
      {LIGHT_COLORS.map((c, i) => {
        const t = (i + 0.5) / n;
        const x = t * width;
        const y = 10 + Math.sin(t * Math.PI) * 18;
        return (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", left: x - 1, top: y - 6, width: 2, height: 6, background: "#2B2B2B", opacity: 0.6 }} />
            <div style={{ position: "absolute", left: x - 6, top: y, width: 12, height: 16, borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%", background: c, boxShadow: `0 0 10px ${c}` }} />
          </React.Fragment>
        );
      })}
    </div>
  );
}

const FLAKES = [[24, 92, 13], [318, 118, 17], [60, 520, 15], [300, 560, 12], [176, 70, 10], [330, 360, 11], [18, 300, 10], [250, 610, 14]];
function Flakes({ color }) {
  return FLAKES.map(([x, y, size], i) => (
    <div key={i} style={{ position: "absolute", left: x, top: y, fontSize: size, color, opacity: 0.35, lineHeight: 1, pointerEvents: "none" }}>❄</div>
  ));
}

export function WrappedSlideArt({ slide, innerRef, rounded = true }) {
  const t = THEMES[slide.theme] || THEMES.pine;
  const isCover = slide.key === "cover";
  const isFinale = slide.key === "finale";
  return (
    <div ref={innerRef} style={{
      width: W, height: H, position: "relative", overflow: "hidden", borderRadius: rounded ? 18 : 0,
      background: `linear-gradient(170deg, ${t.bg} 0%, ${t.bg2} 100%)`, color: t.text,
      fontFamily: FONT_BODY, boxSizing: "border-box",
    }}>
      <Lights width={W} />
      <Flakes color={slide.theme === "snow" ? X.berry : "#FFFFFF"} />
      <div style={{ position: "absolute", left: 28, right: 28, top: 70, bottom: 64, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
        <div style={{ fontSize: isCover || isFinale ? 64 : 54, lineHeight: 1, marginBottom: 14 }}>{slide.emoji}</div>
        <div style={{ fontSize: 12, letterSpacing: 2.5, textTransform: "uppercase", color: t.soft, fontWeight: 700, marginBottom: 12 }}>{slide.kicker}</div>
        {slide.big != null && (
          <div style={{
            fontFamily: FONT_DISPLAY, lineHeight: 1.05, color: isCover || isFinale ? t.text : t.accent,
            fontSize: isFinale ? 34 : isCover ? (String(slide.big).length > 18 ? 36 : 44) : (String(slide.big).length > 7 ? 60 : 76),
            marginBottom: 8, wordBreak: "break-word",
          }}>{slide.big}</div>
        )}
        {slide.line && <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 22 }}>{slide.line}</div>}
        {(slide.rows || []).length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 9, alignItems: "center" }}>
            {slide.rows.map((r) => (
              <div key={r} style={{
                fontSize: 15, padding: "8px 14px", borderRadius: 999, maxWidth: "100%",
                background: slide.theme === "snow" ? "rgba(163,42,42,0.10)" : "rgba(255,255,255,0.14)",
                border: `1px solid ${slide.theme === "snow" ? "rgba(163,42,42,0.25)" : "rgba(255,255,255,0.25)"}`,
              }}>{r}</div>
            ))}
          </div>
        )}
        {slide.list && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6, textAlign: "left" }}>
            {slide.list.map((m) => (
              <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 14, background: "#FFFFFF", border: "1.5px solid #E6DAC4" }}>
                <span style={{ fontSize: 26 }}>{m.emoji}</span>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: X.berry, lineHeight: 1 }}>{m.big}</span>
                <span style={{ fontSize: 14, color: X.ink, lineHeight: 1.25 }}>{m.label}</span>
              </div>
            ))}
          </div>
        )}
        {slide.grid && slide.grid.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: slide.grid.length === 1 ? "1fr" : "1fr 1fr", gap: 10, marginTop: 18 }}>
            {slide.grid.map((g) => (
              <div key={g.label} style={{ padding: "12px 8px", borderRadius: 14, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.28)" }}>
                <div style={{ fontSize: 22, lineHeight: 1 }}>{g.emoji}</div>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, color: X.goldSoft, lineHeight: 1.1, marginTop: 6 }}>{g.big}</div>
                <div style={{ fontSize: 12, color: t.soft, marginTop: 2 }}>{g.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ position: "absolute", left: 20, right: 20, bottom: 22, textAlign: "center", fontSize: 12.5, color: t.soft, lineHeight: 1.4 }}>
        {slide.foot}
        {!isFinale && <div style={{ marginTop: 6, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", opacity: 0.8 }}>Henalytics · henalytics.com</div>}
      </div>
    </div>
  );
}

// 1200×630 (designed at 600×315) Facebook link preview of the finale.
function WrappedWideArt({ slide, innerRef }) {
  return (
    <div ref={innerRef} style={{ width: 600, height: 315, position: "relative", overflow: "hidden", background: `linear-gradient(160deg, ${X.berry}, ${X.berryDeep})`, color: X.snow, fontFamily: FONT_BODY }}>
      <Lights width={600} />
      <div style={{ position: "absolute", left: 30, right: 30, top: 54, display: "flex", gap: 22, alignItems: "center" }}>
        <div style={{ fontSize: 76, lineHeight: 1 }}>🎄</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase", color: "#F3D3CC", fontWeight: 700 }}>{slide.kicker}</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, lineHeight: 1.1, marginTop: 6 }}>{slide.big}</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 30, right: 30, bottom: 48, display: "flex", gap: 10 }}>
        {(slide.grid || []).slice(0, 4).map((g) => (
          <div key={g.label} style={{ flex: 1, padding: "10px 8px", borderRadius: 12, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.28)", textAlign: "center" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: X.goldSoft, lineHeight: 1.1 }}>{g.emoji} {g.big}</div>
            <div style={{ fontSize: 11, color: "#F3D3CC", marginTop: 3 }}>{g.label}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 16, textAlign: "center", fontSize: 11, color: "#F3D3CC", letterSpacing: 1.2 }}>MADE WITH HENALYTICS · FREE AT HENALYTICS.COM</div>
    </div>
  );
}

// ---- falling snow (viewer only, never in the exported image) ----------------
const SNOW_CSS = `
@keyframes hw-fall { 0% { transform: translateY(-20px); } 100% { transform: translateY(105vh); } }
@media (prefers-reduced-motion: reduce) { .hw-snow { display: none; } }
`;
function Snowfall() {
  const flakes = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    left: (i * 53) % 100, size: 8 + ((i * 7) % 9), dur: 7 + ((i * 3) % 7), delay: -((i * 1.7) % 9), op: 0.35 + ((i * 13) % 40) / 100,
  })), []);
  return (
    <div className="hw-snow" aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <style>{SNOW_CSS}</style>
      {flakes.map((f, i) => (
        <div key={i} style={{ position: "absolute", top: 0, left: `${f.left}%`, fontSize: f.size, color: "#fff", opacity: f.op, animation: `hw-fall ${f.dur}s linear ${f.delay}s infinite` }}>❄</div>
      ))}
    </div>
  );
}

// ---- viewer ------------------------------------------------------------------------
export async function shareFiles(files, { title, text }) {
  if (canShareFiles()) {
    try {
      if (!navigator.canShare || navigator.canShare({ files })) {
        await navigator.share({ files, title, text });
        return "shared";
      }
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
    }
  }
  files.forEach((f, i) => setTimeout(() => {
    const url = URL.createObjectURL(f);
    const a = document.createElement("a");
    a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, i * 350));
  return "downloaded";
}

export default function WrappedViewer({ data, update, user, year, onClose, onSignIn, toast }) {
  const [region, setRegion] = useState(null);
  useEffect(() => {
    let on = true;
    loadRegionHighlight(year).then((r) => { if (on && r) setRegion(r); });
    return () => { on = false; };
  }, [year]);
  const slides = useMemo(() => buildWrappedSlides(data, year, { region }), [data, year, region]);
  const [i, setI] = useState(0);
  const idx = Math.min(i, slides.length - 1);
  const slide = slides[idx];
  const exportRef = useRef(null);
  const wideRef = useRef(null);
  const allRefs = useRef({});
  const [busy, setBusy] = useState("");
  const [link, setLink] = useState(null);
  const say = (m, opts) => { if (toast) toast(m, opts); };

  // Remember that this year's Wrapped was opened (the banner changes to "share").
  useEffect(() => {
    update((d) => {
      d.wrapped = { ...(d.wrapped || {}) };
      d.wrapped[year] = { ...(d.wrapped[year] || {}), seenAt: (d.wrapped[year] && d.wrapped[year].seenAt) || Date.now() };
      return d;
    });
  }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => setI((v) => Math.min(slides.length - 1, v + 1));
  const prev = () => setI((v) => Math.max(0, v - 1));
  useEffect(() => {
    const onKey = (e) => { if (e.key === "ArrowRight") next(); else if (e.key === "ArrowLeft") prev(); else if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const name = String(data.homesteadName || "").trim();
  const shareText = `${name ? `${name}'s` : "My"} ${year} Homestead Wrapped 🎄 Made with Henalytics, free at henalytics.com`;

  const shareThis = async () => {
    setBusy("one");
    try {
      const blob = await renderNodeToBlob(exportRef.current, { width: 1080 });
      const r = await shareFiles([new File([blob], `homestead-wrapped-${year}-${slide.key}.png`, { type: "image/png" })], { title: shareText, text: shareText });
      if (r === "downloaded") say("Saved! Post it to your story 📸");
    } catch (_) { say("Couldn't make the image. Try again.", { kind: "error" }); }
    setBusy("");
  };
  const shareAll = async () => {
    setBusy("all");
    try {
      const files = [];
      for (const sl of slides) {
        const node = allRefs.current[sl.key];
        if (!node) continue;
        const blob = await renderNodeToBlob(node, { width: 1080 });
        files.push(new File([blob], `homestead-wrapped-${year}-${files.length + 1}-${sl.key}.png`, { type: "image/png" }));
      }
      const r = await shareFiles(files, { title: shareText, text: shareText });
      if (r === "downloaded") say(`Saved ${files.length} pictures! 📸`);
      update((d) => { d.wrapped = { ...(d.wrapped || {}) }; d.wrapped[year] = { ...(d.wrapped[year] || {}), sharedAt: Date.now() }; return d; });
    } catch (_) { say("Couldn't make the pictures. Try again.", { kind: "error" }); }
    setBusy("");
  };
  const shareLink = async () => {
    if (!user) { onSignIn && onSignIn(); return; }
    setBusy("link");
    try {
      const fin = slides[slides.length - 1];
      const card = {
        kind: "wrapped", emoji: "🎄",
        title: `${name ? `${name}'s` : "Our"} ${year} Homestead Wrapped 🎄`,
        subtitle: (fin.grid || []).map((g) => `${g.big} ${g.label}`).join(" · ") || "A year on the homestead, tracked with Henalytics.",
        stats: (fin.grid || []).map((g) => ({ label: g.label, value: g.big })),
      };
      const url = link || await createShareLink(card, wideRef.current);
      setLink(url);
      const r = await shareUrl(url, card.title);
      if (r === "copied") say("Link copied. Paste it into your Facebook post! 📋");
      update((d) => { d.wrapped = { ...(d.wrapped || {}) }; d.wrapped[year] = { ...(d.wrapped[year] || {}), sharedAt: Date.now() }; return d; });
    } catch (e) { say(e && e.message ? e.message : "Couldn't make the link.", { kind: "error", ms: 6000 }); }
    setBusy("");
  };

  // Fit the 360×640 slide on screen.
  const vw = typeof window !== "undefined" ? window.innerWidth : 390;
  const vh = typeof window !== "undefined" ? window.innerHeight : 844;
  const scale = Math.min((vw - 24) / W, (vh - 190) / H, 1.25);
  const last = idx === slides.length - 1;
  const btn = (primary) => ({
    flex: 1, padding: "12px 10px", borderRadius: 12, cursor: busy ? "wait" : "pointer", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14,
    border: `2px solid ${primary ? X.gold : "rgba(255,255,255,0.6)"}`, background: primary ? X.gold : "transparent", color: primary ? X.ink : "#fff",
  });

  return (
    <div role="dialog" aria-label={`${year} Homestead Wrapped`} style={{ position: "fixed", inset: 0, zIndex: 300, background: "#0E1F17", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "max(12px, env(safe-area-inset-top))", paddingBottom: "max(14px, env(safe-area-inset-bottom))", fontFamily: FONT_BODY }}>
      <Snowfall />
      {/* progress */}
      <div style={{ display: "flex", gap: 4, width: Math.min(vw - 24, W * scale), marginBottom: 10, position: "relative" }}>
        {slides.map((sl, k) => (
          <div key={sl.key} style={{ flex: 1, height: 3, borderRadius: 2, background: k <= idx ? "#fff" : "rgba(255,255,255,0.3)" }} />
        ))}
      </div>
      <div style={{ display: "flex", width: Math.min(vw - 24, W * scale), justifyContent: "space-between", alignItems: "center", marginBottom: 8, color: "#fff", position: "relative" }}>
        <span style={{ fontSize: 13, opacity: 0.85 }}>{idx + 1} of {slides.length}</span>
        <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "#fff", fontSize: 26, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
      </div>
      {/* the slide, tap left/right */}
      <div style={{ width: W * scale, height: H * scale, position: "relative", flexShrink: 0 }}>
        <div style={{ position: "absolute", left: 0, top: 0, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <WrappedSlideArt slide={slide} />
        </div>
        <button type="button" aria-label="Previous" onClick={prev} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "35%", background: "transparent", border: "none", cursor: idx > 0 ? "pointer" : "default" }} />
        <button type="button" aria-label="Next" onClick={next} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "65%", background: "transparent", border: "none", cursor: last ? "default" : "pointer" }} />
      </div>
      {/* actions */}
      <div style={{ display: "flex", gap: 8, width: Math.min(vw - 24, Math.max(W * scale, 320)), marginTop: 12, position: "relative" }}>
        {!last ? (
          <>
            <button type="button" onClick={shareThis} disabled={!!busy} style={btn(false)}>{busy === "one" ? "Making it…" : "📸 Share this"}</button>
            <button type="button" onClick={next} style={btn(true)}>Next →</button>
          </>
        ) : (
          <>
            <button type="button" onClick={shareAll} disabled={!!busy} style={btn(true)}>{busy === "all" ? "Wrapping…" : "🎁 Share my Wrapped"}</button>
            <button type="button" onClick={shareLink} disabled={!!busy} style={btn(false)}>{busy === "link" ? "Making link…" : user ? "🔗 Facebook link" : "🔗 Sign in for a link"}</button>
          </>
        )}
      </div>
      {last && (
        <button type="button" onClick={() => setI(0)} style={{ marginTop: 10, background: "none", border: "none", color: "rgba(255,255,255,0.8)", fontSize: 13, textDecoration: "underline", cursor: "pointer", fontFamily: FONT_BODY, position: "relative" }}>
          Watch it again
        </button>
      )}
      {/* exact-size copies for export */}
      <div aria-hidden="true" style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
        <WrappedSlideArt slide={slide} innerRef={exportRef} rounded={false} />
        {slides.map((sl) => <WrappedSlideArt key={sl.key} slide={sl} rounded={false} innerRef={(n) => { allRefs.current[sl.key] = n; }} />)}
        <WrappedWideArt slide={slides[slides.length - 1]} innerRef={wideRef} />
      </div>
    </div>
  );
}

// ---- banner (Home and Year in Review) ----------------------------------------------
export function WrappedBanner({ data, update, year, onOpen, compact = false }) {
  const w = (data.wrapped && data.wrapped[year]) || {};
  const totalLogs = useMemo(() => Object.values(data.entries || {}).reduce((n, arr) => n + (Array.isArray(arr) ? arr.filter((e) => e && String(e.date || "").startsWith(String(year))).length : 0), 0), [data.entries, year]);
  if (!year || w.bannerDismissed || totalLogs < 5) return null;
  const seen = !!w.seenAt;
  return (
    <div style={{
      position: "relative", overflow: "hidden", borderRadius: 16, marginBottom: 14, padding: compact ? "14px 16px" : "16px 18px 18px",
      background: `linear-gradient(150deg, ${X.pine}, ${X.pineDeep})`, color: X.snow, fontFamily: FONT_BODY, boxShadow: "3px 4px 0 #2C181030",
    }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0 }}><Lights width={420} /></div>
      {!compact && (
        <button type="button" aria-label="Hide" onClick={() => update((d) => { d.wrapped = { ...(d.wrapped || {}) }; d.wrapped[year] = { ...(d.wrapped[year] || {}), bannerDismissed: true }; return d; })}
          style={{ position: "absolute", right: 8, top: 34, background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 20, cursor: "pointer" }}>×</button>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 30 }}>
        <div style={{ fontSize: 40, lineHeight: 1 }}>{seen ? "🎁" : "🎄"}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 21, lineHeight: 1.15 }}>{seen ? `Share your ${year} Wrapped` : `Your ${year} Homestead Wrapped is here!`}</div>
          <div style={{ fontSize: 13, color: "#CFE0D3", marginTop: 4, lineHeight: 1.4 }}>
            {seen ? "Post it to your story or send it to family. It makes a sweet Christmas card." : "Your year in eggs, harvests and more, wrapped up with a bow."}
          </div>
        </div>
      </div>
      <button type="button" onClick={onOpen} style={{ marginTop: 12, width: "100%", padding: "11px", borderRadius: 10, border: `2px solid ${X.gold}`, background: X.gold, color: X.ink, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
        {seen ? "Open my Wrapped" : "Unwrap it 🎁"}
      </button>
    </div>
  );
}
