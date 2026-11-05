// ============================================================================
// New look (3.0) — Home
// ----------------------------------------------------------------------------
// The whole homestead at a glance: what needs you today (frost, feed running
// low, today's calendar), the one announcement card, and a tile per hobby
// with today's number. Tapping a tile opens that hobby.
// ============================================================================

import React from "react";
import { Snowflake, Wheat, CalendarDays, Plus, ChevronRight } from "lucide-react";
import { nl, font, type } from "./theme.js";
import { Card, CardHeader, Row } from "./ui.jsx";
import { switcherEntries } from "./hobbies.js";
import HobbyGlyph from "./HobbyGlyph.jsx";
import { computeHarvestValue } from "../gardenValue.js";
import { collectGardenHarvests } from "../analytics.js";
import { fmtMoney } from "../units.js";
import { SPECIES, milkOz, upcomingBirths, milkText } from "./livestock/livestockData.js";
import { batchAlive, batchAgeDays } from "../meatBatches.js";
import { upcomingKindles } from "./rabbits/rabbitData.js";

const DAY = 86400000;
const parseDay = (s) => { const p = String(s || "").split("-").map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); };

function lastLogLine(entries, today) {
  let last = null;
  for (const e of entries) if (e && e.date && e.date <= today && (!last || e.date > last)) last = e.date;
  if (!last) return "Nothing logged yet";
  const days = Math.round((parseDay(today) - parseDay(last)) / DAY);
  if (days <= 0) return "Logged today";
  if (days === 1) return "Logged yesterday";
  return `Last log ${days} days ago`;
}

// The one number each tile shows. Hobbies without a headline number yet show
// when they were last logged; each gets its own number when it is rebuilt.
export function tileStat(entry, data, today) {
  const ents = entry.ids.flatMap((id) => (data.entries && data.entries[id]) || []);
  if (entry.type === "egg_layers") {
    const logged = ents.filter((e) => e && e.date === today && (e.action === "eggs" || e.action === "eggs_laid"))
      .reduce((s, e) => s + (Number(e.count) || 0), 0);
    const basket = (entry.hobby.flocks || []).filter((f) => f && !f.archived && f.eggBasket && f.eggBasket.date === today)
      .reduce((s, f) => s + (Number(f.eggBasket.count) || 0), 0);
    const n = logged + basket;
    return { big: String(n), small: n === 1 ? "egg today" : "eggs today" };
  }
  if (entry.type === "garden") {
    // Same numbers as the garden page's "food grown" card: this season's
    // harvests at grocery prices.
    const season = entry.hobby.currentSeason;
    if (season) {
      const harvests = collectGardenHarvests(data, { seasonId: season.id, season });
      if (harvests.length) {
        const { total } = computeHarvestValue(harvests, entry.hobby.harvestPrices || {});
        return { big: fmtMoney(Math.round(total)).replace(/\.00$/, ""), small: "grown" };
      }
    }
  }
  if (entry.type === "meat_chickens") {
    const active = entry.hobby.currentBatches || [];
    if (active.length) {
      const alive = active.reduce((s, b) => s + batchAlive(b, ents), 0);
      const weeks = Math.floor(Math.max(...active.map((b) => batchAgeDays(b))) / 7) + 1;
      return { big: String(alive), small: `birds · week ${weeks}` };
    }
  }
  if (entry.type === "rabbits") {
    const next = upcomingKindles(entry.hobby, ents, today)[0];
    if (next && next.left >= 0 && next.left <= 14) return { big: null, small: `${next.doe.name} kindles ${next.left === 0 ? "today" : `in ${next.left} day${next.left === 1 ? "" : "s"}`}` };
  }
  if (entry.type === "goats" || entry.type === "cows") {
    // Milk today (oz, same as the herd page), else the next birth.
    const sp = SPECIES[entry.type];
    const oz = milkOz(sp, ents, { from: today, to: today });
    if (oz > 0) return { big: milkText(oz), small: "milk today" };
    const next = upcomingBirths(sp, entry.hobby, today, 1)[0];
    if (next && next.left >= 0 && next.left <= 30) return { big: null, small: `${(next.dam && next.dam.name) || `A ${sp.she}`} due ${next.left === 0 ? "today" : `in ${next.left} day${next.left === 1 ? "" : "s"}`}` };
  }
  return { big: null, small: lastLogLine(ents, today) };
}

export default function HomeScreen({
  data, today, frost, feedAlerts = [], announcement,
  onOpenCalendar, onOpenHobby, onOpenSwitcher, onManage, onOpenMore, HobbyIcon,
}) {
  const now = parseDay(today);
  const dateLine = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const name = data.homesteadName || "Your homestead";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "H";
  const tasks = (data.calendarEvents || [])
    .filter((e) => e && e.date === today && !e.done && !e.completed)
    .slice(0, 3);
  const entries = switcherEntries(data.hobbies);

  const items = [];
  if (frost) {
    items.push(<Row key="frost" first={!items.length} tint={nl.alertTint} iconBg={nl.alertChip}
      icon={<Snowflake size={20} color={nl.alert} strokeWidth={2} />}
      title={`Frost tonight, ${frost.lowText}`}
      sub={frost.crops && frost.crops.length ? `Cover ${frost.crops.join(", ").toLowerCase()}` : "Cover anything tender"} />);
  }
  feedAlerts.forEach((f) => {
    items.push(<Row key={`feed-${f.hobbyId}`} first={!items.length} onClick={() => onOpenHobby(f.entry)}
      icon={<Wheat size={20} color={nl.ink} strokeWidth={1.8} />}
      title={f.state === "out" ? "Out of feed" : `Feed runs out in about ${Math.max(1, Math.round(f.daysLeft))} day${Math.round(f.daysLeft) === 1 ? "" : "s"}`}
      sub={f.hobbyName} chevron />);
  });
  tasks.forEach((t) => {
    items.push(<Row key={`task-${t.id || t.title}`} first={!items.length} onClick={onOpenCalendar}
      icon={<CalendarDays size={20} color={nl.ink} strokeWidth={1.8} />}
      title={String(t.title || "Reminder").replace(/^[^\p{L}\p{N}]+/u, "")} sub="Calendar · today" chevron />);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontSize: type.small, color: nl.soft }}>{dateLine}</div>
          <h1 style={{ margin: "4px 0 0", fontFamily: font.display, fontWeight: 400, fontSize: 30, lineHeight: 1.1 }}>{name}</h1>
        </div>
        <button type="button" onClick={onOpenMore} aria-label="Account and settings" style={{
          width: 44, height: 44, borderRadius: 22, background: nl.ink, color: nl.paper, border: "none",
          font: `700 15px ${font.body}`, cursor: "pointer", flexShrink: 0,
        }}>{initials}</button>
      </div>

      <Card>
        <CardHeader title="Today" right={items.length ? `${items.length} thing${items.length === 1 ? "" : "s"}` : null} />
        {items.length ? items : (
          <div style={{ padding: "4px 14px 16px", fontSize: 14, color: nl.soft }}>Nothing needs you today. Enjoy it.</div>
        )}
      </Card>

      {announcement}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
        <div style={{ fontFamily: font.display, fontSize: type.section }}>Your homestead</div>
        <button type="button" onClick={onOpenSwitcher} style={{
          display: "flex", alignItems: "center", gap: 4, minHeight: 36, padding: "0 12px", borderRadius: 999,
          background: nl.ink, color: nl.paper, border: "none", font: `600 14px ${font.body}`, cursor: "pointer",
        }}>Switch hobby<ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {entries.map((e) => {
          const s = tileStat(e, data, today);
          return (
            <button key={e.key} type="button" onClick={() => onOpenHobby(e)} style={{
              background: nl.card, border: `1px solid ${nl.line}`, borderRadius: 18, padding: 14, cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, color: nl.ink, textAlign: "left",
              font: "inherit", minHeight: 112,
            }}>
              <HobbyGlyph type={e.type} size={22} strokeWidth={1.8} />
              <span style={{ fontSize: type.body, fontWeight: 600 }}>{e.name}</span>
              <span>
                {s.big && <span style={{ fontFamily: font.display, fontSize: 26, lineHeight: 1 }}>{s.big} </span>}
                <span style={{ fontSize: type.small, color: nl.soft }}>{s.small}</span>
              </span>
            </button>
          );
        })}
        <button type="button" onClick={onManage} style={{
          border: `1.5px dashed #B9A88F`, borderRadius: 18, padding: 14, background: "transparent", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
          color: nl.ink, font: "inherit", minHeight: 112,
        }}>
          <span style={{ width: 36, height: 36, borderRadius: 18, background: nl.yolk, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Plus size={20} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <span style={{ fontSize: type.body, fontWeight: 600 }}>Manage hobbies</span>
          <span style={{ fontSize: type.small, color: nl.soft }}>Add or hide</span>
        </button>
      </div>
    </div>
  );
}
