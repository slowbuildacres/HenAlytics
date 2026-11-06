// ============================================================================
// Incubator (3.0) — Today · Hatches · Stats
// ----------------------------------------------------------------------------
// Today: one card per run in the incubator (day N of 21, a bar with the
// lockdown mark, what to do right now, Candle / Log hatch) and one per
// brooder batch (chicks left, age, about how warm the brooder should be this
// week). Hatches: past runs with their hatch rate and past brooder batches.
// Stats: eggs set, hatched, hatch rate, candling, by bird type, fun facts and
// the old analytics. Same records as the old page (hobby.runs,
// hobby.brooderBatches); the forms are its own, via `act` (IncubatorNewLook).
// ============================================================================

import React, { useMemo, useState } from "react";
import { Egg, Lightbulb, Bird, Thermometer, Plus, Receipt, NotebookPen, Pencil, LogOut, CheckCircle2, Lock, Trophy, Percent } from "lucide-react";
import { nl, font, type } from "../theme.js";
import { Card, CardHeader, Row, Badge, Button } from "../ui.jsx";
import { RangeChips, FactCarousel, factCard, AllNumbers } from "../StatsParts.jsx";
import { isoDay, prettyDay, parseDay, DAY } from "../eggs/eggFacts.js";
import { fmtTemp } from "../../units.js";

export const BIRD_INCUBATION = {
  Chicken: { lockdown: 18, hatch: 21 }, Duck: { lockdown: 25, hatch: 28 }, Turkey: { lockdown: 25, hatch: 28 },
  Quail: { lockdown: 14, hatch: 17 }, Goose: { lockdown: 27, hatch: 30 }, Guinea: { lockdown: 24, hatch: 28 }, Other: { lockdown: 18, hatch: 21 },
};
const ic = (I) => <I size={20} strokeWidth={1.8} />;
const daysFrom = (a, b) => Math.round((parseDay(b) - parseDay(a)) / DAY);
const dayYear = (s) => (s ? `${prettyDay(s)}, ${s.slice(0, 4)}` : "");
export const remaining = (b) => Math.max(0, (Number(b && b.initialCount) || 0) - ((b && b.dispositions) || []).reduce((s, d) => s + (Number(d.count) || 0), 0));
const activeRun = (r) => r && r.status !== "hatched" && r.status !== "closed";
const eggsIn = (r) => (r.candledCount != null && r.discardedAfterCandle ? r.candledCount : r.eggsSet) || 0;

export function runState(r, today = isoDay()) {
  const inc = BIRD_INCUBATION[r.birdType] || BIRD_INCUBATION.Chicken;
  const day = r.dateSet ? Math.max(0, daysFrom(r.dateSet, today)) : 0;
  const hatchDate = r.hatchDate || (r.dateSet ? isoDay(new Date(parseDay(r.dateSet).getTime() + inc.hatch * DAY)) : null);
  const lockdownDate = r.lockdownDate || (r.dateSet ? isoDay(new Date(parseDay(r.dateSet).getTime() + inc.lockdown * DAY)) : null);
  let tone = "quiet", text, todo;
  if (day > inc.hatch + 2) { tone = "alert"; text = "Past hatch day"; todo = "Log how many hatched, or close the run if they didn't."; }
  else if (day >= inc.hatch - 1) { tone = "ready"; text = "Hatch day"; todo = "Keep the lid closed while they zip. Log the hatch when they're dry."; }
  else if (day >= inc.lockdown) { tone = "ready"; text = "Lockdown"; todo = "Stop turning, raise the humidity and keep the lid shut."; }
  else if (day === inc.lockdown - 1) { tone = "ready"; text = "Lockdown tomorrow"; todo = "Last day of turning. Candle tonight if you haven't."; }
  else if (r.candledCount == null && day >= 7) { tone = "quiet"; text = `Day ${day}`; todo = "A good time to candle and take out clears."; }
  else { text = `Day ${day}`; todo = day < 7 ? "Turn the eggs a few times a day. Candle around day 7." : "Keep turning. Next up: lockdown."; }
  return { inc, day, hatchDate, lockdownDate, tone, text, todo, left: hatchDate ? daysFrom(today, hatchDate) : null };
}

// Brooder heat: about 95°F the first week, 5°F cooler each week after.
export function brooderHeat(startDate, today = isoDay()) {
  const week = Math.max(0, Math.floor(daysFrom(startDate, today) / 7));
  const f = 95 - week * 5;
  return f <= 70 ? null : f;
}
const ageText = (s, today) => { const d = daysFrom(s, today); return d < 14 ? `${d} day${d === 1 ? "" : "s"} old` : `${Math.floor(d / 7)} weeks old`; };

// ── Today ───────────────────────────────────────────────────────────────────
export function IncubatorToday({ hobby, setModal, act }) {
  const today = isoDay();
  const runs = (hobby.runs || []).filter(activeRun).sort((a, b) => (a.dateSet < b.dateSet ? -1 : 1));
  const brooders = (hobby.brooderBatches || []).filter((b) => !b.archived && remaining(b) > 0);
  const custom = Array.isArray(hobby.customLogs) ? hobby.customLogs : [];

  if (!runs.length && !brooders.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ textAlign: "center", padding: "28px 12px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ width: 96, height: 96, borderRadius: 48, background: nl.yolkTint, display: "flex", alignItems: "center", justifyContent: "center" }}><Egg size={48} strokeWidth={1.6} /></div>
          <h2 style={{ margin: "6px 0 0", fontFamily: font.display, fontWeight: 400, fontSize: 26 }}>Nothing in the incubator</h2>
          <p style={{ margin: 0, fontSize: 15, color: nl.soft, lineHeight: 1.45 }}>Set some eggs and Henalytics counts the days: when to candle, lockdown and hatch day.</p>
          <Button onClick={act.newRun} style={{ width: "100%", marginTop: 8 }}>Set eggs</Button>
          <Button kind="quiet" onClick={act.newBrooder} style={{ width: "100%" }}>Add chicks to the brooder</Button>
        </div>
        {(hobby.runs || []).length > 0 && <Card><Row first icon={ic(CheckCircle2)} title="Past hatches" sub={`${(hobby.runs || []).length} runs`} onClick={act.toHistory} chevron /></Card>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {runs.map((r) => {
        const s = runState(r, today);
        const pct = Math.min(100, Math.round((s.day / s.inc.hatch) * 100));
        const lockPct = Math.round((s.inc.lockdown / s.inc.hatch) * 100);
        return (
          <Card key={r.id} padded style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{r.name}</span>
              <Button kind="link" icon={<Pencil size={14} />} onClick={() => act.editRun(r.id)}>Edit</Button>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontFamily: font.display, fontSize: 40, lineHeight: 1 }}>Day {Math.min(s.day, s.inc.hatch + 9)}</span>
              <span style={{ fontSize: 14, color: nl.soft }}>of {s.inc.hatch} · {eggsIn(r)} {String(r.birdType || "chicken").toLowerCase()} eggs{r.variety ? ` · ${r.variety}` : ""}</span>
            </div>
            <div>
              <div style={{ position: "relative", height: 10, borderRadius: 5, background: nl.chip }}>
                <div style={{ height: "100%", width: `${pct}%`, borderRadius: 5, background: s.tone === "alert" ? nl.alert : nl.yolk }} />
                <div aria-hidden="true" style={{ position: "absolute", top: -3, bottom: -3, left: `${lockPct}%`, width: 2, background: nl.ink, opacity: 0.5 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: nl.soft, marginTop: 4 }}>
                <span>Set {prettyDay(r.dateSet)}</span>
                <span>Lockdown {s.lockdownDate ? prettyDay(s.lockdownDate) : `day ${s.inc.lockdown}`}</span>
                <span>Hatch {s.hatchDate ? prettyDay(s.hatchDate) : `day ${s.inc.hatch}`}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 14, background: s.tone === "alert" ? nl.alertTint : s.tone === "ready" ? nl.yolkTint : nl.chip }}>
              {s.day >= s.inc.lockdown ? <Lock size={18} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /> : <Lightbulb size={18} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />}
              <div style={{ fontSize: 13, lineHeight: 1.45 }}><b>{s.text}.</b> {s.todo}</div>
            </div>
            {r.candledCount != null && <div style={{ fontSize: 13, color: nl.soft }}>Candled {r.candledOn ? prettyDay(r.candledOn) : ""}: {r.candledCount} of {r.eggsSet} developing</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              <Button kind={s.day >= s.inc.lockdown ? "primary" : "quiet"} icon={ic(CheckCircle2)} onClick={() => act.logHatch(r.id)}>Log hatch</Button>
              <Button kind={s.day >= 7 && r.candledCount == null && s.day < s.inc.lockdown ? "primary" : "quiet"} icon={ic(Lightbulb)} onClick={() => act.candle(r.id)}>{r.candledCount != null ? "Re-candle" : "Candle"}</Button>
            </div>
          </Card>
        );
      })}

      {brooders.map((b) => {
        const heat = brooderHeat(b.startDate, today);
        return (
          <Card key={b.id} padded style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Brooder · {b.name}</span>
              <Button kind="link" icon={<Pencil size={14} />} onClick={() => act.editBrooder(b.id)}>Edit</Button>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontFamily: font.display, fontSize: 40, lineHeight: 1 }}>{remaining(b)}</span>
              <span style={{ fontSize: 14, color: nl.soft }}>{String(b.birdType || "chick").toLowerCase() === "chicken" ? "chicks" : `${String(b.birdType || "chick").toLowerCase()}s`} · {ageText(b.startDate, today)}</span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 14, background: nl.chip }}>
              <Thermometer size={18} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, lineHeight: 1.45 }}>{heat ? <><b>About {fmtTemp(heat)} under the lamp this week.</b> Chicks huddled under it are cold; spread far from it are too warm.</> : <><b>They're feathered out.</b> Most chicks can go without extra heat now unless nights are cold.</>}</div>
            </div>
            <Button kind="quiet" icon={ic(LogOut)} onClick={() => act.brooderOut(b.id)}>Chicks left the brooder</Button>
          </Card>
        );
      })}

      <Card>
        <Row first icon={ic(Egg)} title="Set more eggs" onClick={act.newRun} chevron />
        <Row icon={ic(Bird)} title="Add chicks to the brooder" sub="Shipped, store-bought or from a hen" onClick={act.newBrooder} chevron />
        <Row icon={ic(Receipt)} title="Expense" onClick={() => setModal({ type: "addExpense", hobbyId: hobby.id })} chevron />
        {custom.map((c) => <Row key={c.id} icon={ic(NotebookPen)} title={c.label} onClick={() => setModal({ type: "log", action: "custom", customLogId: c.id, hobbyIdOverride: hobby.id })} chevron />)}
        <Row icon={<Plus size={20} strokeWidth={2} />} title="Make a custom log button" onClick={() => setModal({ type: "customLogPicker", hobbyId: hobby.id })} chevron />
      </Card>
    </div>
  );
}

// ── Hatches (history) ───────────────────────────────────────────────────────
export function IncubatorHistory({ hobby, act }) {
  const today = isoDay();
  const runs = (hobby.runs || []).slice().sort((a, b) => ((b.hatchedDate || b.dateSet || "") < (a.hatchedDate || a.dateSet || "") ? -1 : 1));
  const done = runs.filter((r) => !activeRun(r));
  const going = runs.filter(activeRun);
  const brooders = (hobby.brooderBatches || []).slice().sort((a, b) => ((b.startDate || "") < (a.startDate || "") ? -1 : 1));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card>
        <CardHeader title="Hatches" right={`${runs.length}`} />
        {going.map((r) => { const s = runState(r, today); return <Row key={r.id} icon={ic(Egg)} title={r.name} sub={`${r.eggsSet} ${String(r.birdType || "").toLowerCase()} eggs · set ${prettyDay(r.dateSet)}`} trailing={<Badge tone={s.tone === "quiet" ? "good" : s.tone}>{s.text}</Badge>} onClick={() => act.editRun(r.id)} chevron />; })}
        {done.map((r) => {
          const rate = r.eggsHatched != null && r.eggsSet ? Math.round((r.eggsHatched / r.eggsSet) * 100) : null;
          return <Row key={r.id} icon={ic(CheckCircle2)} title={r.name}
            sub={[r.hatchedDate ? dayYear(r.hatchedDate) : dayYear(r.dateSet), r.eggsHatched != null ? `${r.eggsHatched} of ${r.eggsSet} hatched` : r.status === "closed" ? "Closed" : null, r.birdType].filter(Boolean).join(" · ")}
            trailing={rate != null ? <Badge tone={rate >= 75 ? "good" : rate >= 50 ? "ready" : "alert"}>{rate}%</Badge> : null}
            onClick={() => (r.status === "hatched" ? act.logHatch(r.id) : act.editRun(r.id))} chevron />;
        })}
        <Row first={!runs.length} icon={<Plus size={20} strokeWidth={2} />} title="Set more eggs" onClick={act.newRun} chevron />
      </Card>
      {brooders.length > 0 && (
        <Card>
          <CardHeader title="Brooder batches" right={`${brooders.length}`} />
          {brooders.map((b) => {
            const left = remaining(b);
            const gone = (b.dispositions || []).reduce((s, d) => s + (Number(d.count) || 0), 0);
            return <Row key={b.id} icon={ic(Bird)} title={b.name} sub={[`Started ${dayYear(b.startDate)}`, `${b.initialCount || 0} chicks`, gone ? `${gone} moved out` : null].filter(Boolean).join(" · ")}
              trailing={left > 0 && !b.archived ? <Badge tone="good">{left} in brooder</Badge> : null} onClick={() => act.editBrooder(b.id)} chevron />;
          })}
        </Card>
      )}
    </div>
  );
}

// ── Stats ───────────────────────────────────────────────────────────────────
const FACT_ICONS = { egg: Egg, trophy: Trophy, percent: Percent };

export function IncubatorStats({ hobby, data, setModal, allNumbers }) {
  const today = isoDay();
  const [rk, setRk] = useState("all");
  const year = today.slice(0, 4);
  const runs = useMemo(() => (hobby.runs || []).filter((r) => rk === "all" || String(r.dateSet || "").startsWith(year)), [hobby, rk, year]);
  const done = runs.filter((r) => r.eggsHatched != null);
  const set = done.reduce((s, r) => s + (Number(r.eggsSet) || 0), 0);
  const hatched = done.reduce((s, r) => s + (Number(r.eggsHatched) || 0), 0);
  const rate = set ? Math.round((hatched / set) * 100) : null;
  const candled = runs.filter((r) => r.candledCount != null && r.eggsSet);
  const fert = candled.length ? Math.round((candled.reduce((s, r) => s + r.candledCount, 0) / candled.reduce((s, r) => s + r.eggsSet, 0)) * 100) : null;
  const byType = new Map();
  for (const r of done) { const g = byType.get(r.birdType || "Other") || { set: 0, hatched: 0, runs: 0 }; g.set += Number(r.eggsSet) || 0; g.hatched += Number(r.eggsHatched) || 0; g.runs += 1; byType.set(r.birdType || "Other", g); }
  const best = done.filter((r) => r.eggsSet >= 6).sort((a, b) => b.eggsHatched / b.eggsSet - a.eggsHatched / a.eggsSet)[0];
  const facts = [];
  if (hatched >= 5) facts.push({ key: "hatched", icon: "egg", big: String(hatched), line: "chicks hatched in our incubator", title: `${hatched} chicks hatched`, sub: `From ${set} eggs set.` });
  if (best) facts.push({ key: "best", icon: "trophy", big: `${Math.round((best.eggsHatched / best.eggsSet) * 100)}%`, line: `our best hatch, ${best.name}`, title: `Best hatch: ${best.name}`, sub: `${best.eggsHatched} of ${best.eggsSet} eggs.` });
  if (fert != null && candled.length >= 2) facts.push({ key: "fert", icon: "percent", big: `${fert}%`, line: "of our eggs were developing at candling", title: `${fert}% developing at candling`, sub: `Across ${candled.length} candled runs.` });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <RangeChips options={[{ key: "year", label: year }, { key: "all", label: "All time" }]} value={rk} onPick={setRk} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <Card padded>
          <div style={{ fontSize: type.small, color: nl.soft }}>Hatched</div>
          <div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1 }}>{hatched}</div>
          <div style={{ fontSize: 12, color: nl.soft }}>{done.length ? `from ${set} eggs in ${done.length} run${done.length === 1 ? "" : "s"}` : "Log a hatch to see this"}</div>
        </Card>
        <Card padded>
          <div style={{ fontSize: type.small, color: nl.soft }}>Hatch rate</div>
          <div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1 }}>{rate != null ? `${rate}%` : "—"}</div>
          <div style={{ fontSize: 12, color: nl.soft }}>{fert != null ? `${fert}% developing at candling` : "Of all eggs set"}</div>
        </Card>
      </div>
      <FactCarousel facts={facts} icons={FACT_ICONS} label="Incubator fun facts, swipe for more"
        onShare={(f) => setModal({ type: "shareCard", card: factCard({ ...f, kind: `hatch_fact_${f.key}` }, data, { emoji: "🐣", kicker: "Our hatchery" }) })} />
      {byType.size > 0 && (
        <Card>
          <CardHeader title="By bird" />
          {[...byType.entries()].map(([t, g]) => (
            <div key={t} style={{ padding: "8px 14px 10px", borderTop: `1px solid ${nl.rule}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ fontWeight: 600 }}>{t}</span><span>{g.hatched} of {g.set} · {g.set ? Math.round((g.hatched / g.set) * 100) : 0}%</span></div>
              <div style={{ height: 8, borderRadius: 4, background: nl.chip, marginTop: 6, overflow: "hidden" }}><div style={{ height: "100%", width: `${g.set ? (g.hatched / g.set) * 100 : 0}%`, background: nl.yolk }} /></div>
            </div>
          ))}
        </Card>
      )}
      <AllNumbers label="All the numbers: every run, candling, hatch chart">{allNumbers}</AllNumbers>
    </div>
  );
}
