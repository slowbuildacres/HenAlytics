// ============================================================================
// New look (3.0) — Year in review (top of the screen)
// ----------------------------------------------------------------------------
// Opened from the "Year in review" button on Stats (and from More): the
// Wrapped teaser (or the Wrapped itself from Dec 1), two headline numbers,
// a row per hobby with this year's highlight, and the year-end report. The
// full year in review (goals, standings, badges, every section) follows
// underneath, unchanged.
// ============================================================================

import React, { useMemo } from "react";
import { Gift, ChevronLeft, FileText } from "lucide-react";
import { nl, font, type } from "./theme.js";
import { Card, Row, Button } from "./ui.jsx";
import HobbyGlyph from "./HobbyGlyph.jsx";
import { switcherEntries } from "./hobbies.js";
import { computeStats } from "../YearInReview.jsx";
import { computeHarvestValue } from "../gardenValue.js";
import { collectGardenHarvests } from "../analytics.js";
import { fmtMoney } from "../units.js";

const n0 = (v) => Math.round(Number(v) || 0).toLocaleString("en-US");

function highlight(type, st) {
  switch (type) {
    case "egg_layers": return st.eggsCollected ? `${n0(st.eggsCollected)} eggs${st.peakEggMonth ? ` · best month ${st.peakEggMonth}` : ""}` : null;
    case "garden": return st.totalHarvestLbs ? `${n0(st.totalHarvestLbs)} lbs harvested${st.topPlants && st.topPlants[0] ? ` · top crop ${String(st.topPlants[0].plant).toLowerCase()}` : ""}` : null;
    case "meat_chickens": return st.birdsRaised ? `${n0(st.birdsRaised)} birds raised${st.totalMeatLbs ? ` · ${n0(st.totalMeatLbs)} lbs of meat` : ""}` : null;
    case "goats": return st.goatMilkOz || st.goatKids ? [st.goatMilkOz ? `${(st.goatMilkOz / 128).toFixed(1)} gal milk` : null, st.goatKids ? `${st.goatKids} kids born` : null].filter(Boolean).join(" · ") : null;
    case "cows": return st.cowMilkGal || st.cowCalves ? [st.cowMilkGal ? `${n0(st.cowMilkGal)} gal milk` : null, st.cowCalves ? `${st.cowCalves} calves` : null].filter(Boolean).join(" · ") : null;
    case "rabbits": return st.totalLitters ? `${st.totalLitters} litters · ${n0(st.totalKitsAlive)} kits` : null;
    case "bees": return st.honeyHarvestedLbs ? `${n0(st.honeyHarvestedLbs)} lbs of honey` : null;
    case "incubator": return st.incubatorEggsSet ? `${n0(st.incubatorEggsHatched)} of ${n0(st.incubatorEggsSet)} eggs hatched` : null;
    case "sourdough": return st.sourdoughLoaves ? `${n0(st.sourdoughLoaves)} loaves` : null;
    case "baking": return st.bakingItems ? `${n0(st.bakingItems)} baked goods` : null;
    case "preserving": return st.canningJarsMade ? `${n0(st.canningJarsMade)} jars canned` : null;
    case "farmstand": return st.farmstandRevenue ? `${fmtMoney(st.farmstandRevenue)} sold` : null;
    case "maple_syrup": return st.mapleSyrupGal ? `${st.mapleSyrupGal} gal of syrup` : null;
    default: return null;
  }
}

export default function YearScreen({ data, year, years, onYear, onBack, wrappedOpen, wrappedYear, onOpenWrapped, onOpenHobby, onYearEndReport, children }) {
  const st = useMemo(() => computeStats(data, year), [data, year]);
  const grown = useMemo(() => {
    const gh = (data.hobbies || []).find((h) => h && h.type === "garden");
    const harvests = collectGardenHarvests(data, { range: { start: `${year}-01-01`, end: `${year}-12-31` } });
    return computeHarvestValue(harvests, (gh && gh.harvestPrices) || {}).total;
  }, [data, year]);
  const food = (Number(st.groceryStoreEquivalent) || 0) + (Number(grown) || 0);
  const current = year === new Date().getFullYear();
  const rows = switcherEntries(data.hobbies).map((e) => ({ e, line: highlight(e.type, st) || (st.entryCountByHobby && st.entryCountByHobby[e.hobby.type] ? `${n0(st.entryCountByHobby[e.hobby.type])} logs` : null) }))
    .filter((r) => r.line);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: -10 }}>
        <button type="button" aria-label="Back" onClick={onBack} style={{ width: 44, height: 44, border: "none", background: "none", cursor: "pointer", color: nl.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
        <h1 style={{ margin: 0, flex: 1, fontFamily: font.display, fontWeight: 400, fontSize: type.title }}>{current ? `${year} so far` : String(year)}</h1>
        {years.filter((y) => y !== year).slice(0, 2).map((y) => (
          <button key={y} type="button" onClick={() => onYear(y)} style={{ minHeight: 36, padding: "0 12px", borderRadius: 999, border: `1.5px solid ${nl.field}`, background: "transparent", color: nl.ink, font: `600 13px ${font.body}`, cursor: "pointer" }}>{y}</button>
        ))}
      </div>

      <button type="button" onClick={wrappedOpen ? onOpenWrapped : undefined} disabled={!wrappedOpen} style={{
        display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: 20, border: "none", textAlign: "left",
        background: nl.deep, color: nl.onDeep, cursor: wrappedOpen ? "pointer" : "default", font: "inherit",
      }}>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", color: nl.accentOnDeep, fontWeight: 600 }}>{wrappedOpen ? "Ready now" : "Opens December 1"}</span>
          <span style={{ display: "block", fontFamily: font.display, fontSize: 22, marginTop: 4 }}>Your Homestead Wrapped</span>
          <span style={{ display: "block", fontSize: 13, color: nl.onDeepSoft, marginTop: 2 }}>{wrappedOpen ? `Watch your ${wrappedYear} as a story, then share it` : "Your year as a story to share with family"}</span>
        </span>
        <Gift size={40} color={nl.accentOnDeep} strokeWidth={1.6} aria-hidden="true" />
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <Card padded><div style={{ fontFamily: font.display, fontSize: 30, lineHeight: 1.05 }}>{n0(st.activeDays)}</div><div style={{ fontSize: type.small, color: nl.soft }}>days you logged something</div></Card>
        <Card padded><div style={{ fontFamily: font.display, fontSize: 30, lineHeight: 1.05, color: nl.good }}>{fmtMoney(Math.round(food)).replace(/\.00$/, "")}</div><div style={{ fontSize: type.small, color: nl.soft }}>food grown and laid, at store prices</div></Card>
      </div>

      {rows.length > 0 && (
        <Card>
          {rows.map(({ e, line }, i) => (
            <Row key={e.key} first={i === 0} icon={<HobbyGlyph type={e.type} size={20} />} title={e.name} sub={line} onClick={() => onOpenHobby(e)} chevron />
          ))}
        </Card>
      )}

      <Button kind="outline" icon={<FileText size={18} />} onClick={onYearEndReport}>Year-end report</Button>

      {children && (
        <>
          <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: nl.soft, fontWeight: 600, padding: "14px 4px 0" }}>Everything from your year</div>
          <div>{children}</div>
        </>
      )}
    </div>
  );
}
