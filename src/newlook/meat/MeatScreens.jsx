// ============================================================================
// Meat birds (3.0) — Today · Batches · Stats
// ----------------------------------------------------------------------------
// Today: one card per active batch (birds alive, week N, how close to
// butcher age for Cornish Cross), quick logs, feed supply, the latest logs.
// Batches: active batches, start another, past batches with their results
// and a restore button. Stats: meat, cost per lb, survival, per-batch
// results, fun facts, then the old analytics under "All the numbers".
// Counts come from meatBatches.js, the same helpers the old page uses; the
// forms are the app's existing ones (hatchBatch, editBatch, butcher, log).
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  Bird, Wheat, Droplet, Truck, MoreHorizontal, Skull, Hammer, NotebookPen, Receipt, Plus, Snowflake,
  RotateCcw, BookOpen, Lightbulb, Scale, Trophy, Utensils, HeartPulse,
} from "lucide-react";
import { nl, font, type } from "../theme.js";
import { Card, CardHeader, Row, Button, Sheet, Badge } from "../ui.jsx";
import FeedCard from "../FeedCard.jsx";
import { RangeChips, FactCarousel, factCard, AllNumbers } from "../StatsParts.jsx";
import { batchAlive, batchAgeDays, batchTotals, restorePastBatch } from "../../meatBatches.js";
import { fmtWeight, fmtMoney, platesLine } from "../../units.js";
import { isoDay, prettyDay } from "../eggs/eggFacts.js";
import { showUndo } from "../UndoBar.jsx";

const ic = (I) => <I size={20} strokeWidth={1.8} />;
const dayYear = (s) => (s ? `${prettyDay(s)}, ${s.slice(0, 4)}` : "");
const TYPE_PLURAL = { Chicken: "birds", Turkey: "turkeys", Duck: "ducks", Goose: "geese", Quail: "quail", Guinea: "guineas" };
const LABELS = { fed: "Fed", watered: "Watered", move_tractor: "Moved the tractor", death: "Loss", infrastructure: "Build or repair", note: "Note", custom: "Log" };
const ICONS = { fed: Wheat, watered: Droplet, move_tractor: Truck, death: Skull, infrastructure: Hammer, note: NotebookPen };

function entryTitle(e) {
  if (e.action === "fed") return `Fed${Number(e.lbs) > 0 ? ` ${fmtWeight(Number(e.lbs))}` : ""}${Number(e.cost) > 0 ? ` · ${fmtMoney(e.cost)}` : ""}`;
  if (e.action === "death") return `${Number(e.count) || 1} lost${e.cause ? ` · ${e.cause}` : ""}`;
  if (e.action === "move_tractor") return `Moved the tractor${Number(e.distanceFeet) > 0 ? ` ${e.distanceFeet} ft` : ""}`;
  if (e.action === "infrastructure") return `${e.item || "Build or repair"}${Number(e.cost) > 0 ? ` · ${fmtMoney(e.cost)}` : ""}`;
  if (e.action === "note") return e.note || "Note";
  if (e.action === "custom") return e.customLabel || "Log";
  return LABELS[e.action] || e.action;
}

// Cornish Cross usually go to the freezer at 7–8 weeks; other birds vary.
function readiness(batch, days) {
  if ((batch.birdType || "Chicken") !== "Chicken") return null;
  const w = days / 7;
  if (w >= 9) return { tone: "alert", text: `${Math.floor(w)} weeks · past usual butcher age` };
  if (w >= 7) return { tone: "ready", text: "Ready for the freezer" };
  return { tone: "quiet", text: `Butcher in about ${Math.max(1, Math.ceil(7 - w))} week${Math.ceil(7 - w) === 1 ? "" : "s"}` };
}

function BatchCard({ batch, entries, hobby, setModal }) {
  const alive = batchAlive(batch, entries);
  const days = batchAgeDays(batch);
  const week = Math.floor(days / 7) + 1;
  const ready = readiness(batch, days);
  const pct = (batch.birdType || "Chicken") === "Chicken" ? Math.min(100, Math.round((days / 56) * 100)) : null;
  return (
    <Card padded style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button type="button" onClick={() => setModal({ type: "editBatch", hobbyId: hobby.id, batchId: batch.id })} aria-label={`Edit ${batch.name}`}
        style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, border: "none", background: "none", padding: 0, textAlign: "left", cursor: "pointer", color: nl.ink, font: "inherit" }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{batch.name}{batch.birdType && batch.birdType !== "Chicken" ? ` · ${batch.birdType}` : ""}</span>
        <span style={{ fontSize: type.small, color: nl.soft }}>Edit</span>
      </button>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: font.display, fontSize: 40, lineHeight: 1 }}>{alive}</span>
        <span style={{ fontSize: 14, color: nl.soft }}>{TYPE_PLURAL[batch.birdType] || "birds"} · week {week} · since {prettyDay(batch.startDate)}</span>
      </div>
      {pct != null && (
        <div>
          <div style={{ height: 8, borderRadius: 4, background: nl.chip, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: ready && ready.tone === "alert" ? nl.alert : nl.yolk }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: nl.soft, marginTop: 4 }}>
            <span>{ready ? ready.text : ""}</span><span>8 weeks</span>
          </div>
        </div>
      )}
      <Button kind={ready && ready.tone !== "quiet" ? "primary" : "quiet"} icon={ic(Snowflake)} onClick={() => setModal({ type: "butcher", batchId: batch.id })}>
        Butcher{ready && ready.tone !== "quiet" ? " this batch" : ""}
      </Button>
    </Card>
  );
}

// ── Today ───────────────────────────────────────────────────────────────────
export function MeatToday({ hobby, data, update, setModal, onOpenJournal, onTab }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const active = hobby.currentBatches || [];
  const past = hobby.archivedBatches || [];
  const [moreOpen, setMoreOpen] = useState(false);
  const log = (action) => setModal({ type: "log", action, hobbyIdOverride: hobby.id });
  const hidden = Array.isArray(hobby.hiddenQuickLogs) ? hobby.hiddenQuickLogs : [];
  const custom = Array.isArray(hobby.customLogs) ? hobby.customLogs : [];

  if (!active.length) {
    return (
      <div style={{ textAlign: "center", padding: "28px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ width: 96, height: 96, borderRadius: 48, background: nl.yolkTint, display: "flex", alignItems: "center", justifyContent: "center" }}><Bird size={48} strokeWidth={1.6} /></div>
        <h2 style={{ margin: "6px 0 0", fontFamily: font.display, fontWeight: 400, fontSize: 26 }}>{past.length ? "No batch going right now" : "Start your first batch"}</h2>
        <p style={{ margin: 0, fontSize: 15, color: nl.soft, lineHeight: 1.45 }}>Add a batch when your chicks arrive. Henalytics counts the weeks, the feed and the losses, then the cost per pound when they're done.</p>
        <Button onClick={() => setModal({ type: "hatchBatch" })} style={{ width: "100%", marginTop: 8 }}>Start a batch</Button>
        {past.length > 0 && <Button kind="quiet" onClick={() => onTab("animals")} style={{ width: "100%" }}>See past batches ({past.length})</Button>}
      </div>
    );
  }

  const quick = [
    { key: "fed", label: "Fed", icon: Wheat },
    { key: "watered", label: "Watered", icon: Droplet },
    { key: "move_tractor", label: "Tractor", icon: Truck },
  ].filter((q) => !hidden.includes(q.key));
  const recent = entries.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.created || 0) - (a.created || 0))).slice(0, 4);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {active.map((b) => <BatchCard key={b.id} batch={b} entries={entries} hobby={hobby} setModal={setModal} />)}

      <div style={{ display: "flex", gap: 8 }}>
        {[...quick, { key: "more", label: "More", icon: MoreHorizontal }].map((q) => (
          <button key={q.key} type="button" onClick={() => (q.key === "more" ? setMoreOpen(true) : log(q.key))} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 0", minHeight: 68,
            borderRadius: 16, background: nl.card, border: `1px solid ${nl.line}`, cursor: "pointer", color: nl.ink, font: `600 12px ${font.body}`,
          }}><q.icon size={22} strokeWidth={1.8} aria-hidden="true" />{q.label}</button>
        ))}
      </div>

      <FeedCard hobby={hobby} entries={entries} update={update} setModal={setModal} eatWord="your birds eat" />

      <Card>
        {recent.length > 0 && <CardHeader title="Latest" />}
        {recent.map((e) => <Row key={e.id} icon={ic(ICONS[e.action] || NotebookPen)} title={entryTitle(e)} sub={e.date === today ? "Today" : prettyDay(e.date)} />)}
        <Row first={!recent.length} icon={ic(BookOpen)} title="Everything you've logged" sub="Edit or delete past entries in the Journal" onClick={onOpenJournal} chevron />
      </Card>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} label="More meat bird logs" showClose>
        <h2 style={{ margin: "0 4px 10px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>Log something else</h2>
        <Card>
          {[
            ["death", "Report a loss", Skull], ["infrastructure", "Build or repair", Hammer], ["note", "Note", NotebookPen],
          ].filter(([a]) => !hidden.includes(a)).map(([a, label, I], i) => (
            <Row key={a} first={i === 0} icon={ic(I)} title={label} chevron onClick={() => { setMoreOpen(false); log(a); }} />
          ))}
          <Row icon={ic(Receipt)} title="Expense" chevron onClick={() => { setMoreOpen(false); setModal({ type: "addExpense", hobbyId: hobby.id }); }} />
          {custom.map((c) => <Row key={c.id} icon={ic(NotebookPen)} title={c.label} chevron
            onClick={() => { setMoreOpen(false); setModal({ type: "log", action: "custom", customLogId: c.id, hobbyIdOverride: hobby.id }); }} />)}
          <Row icon={ic(Bird)} title="Start another batch" chevron onClick={() => { setMoreOpen(false); setModal({ type: "hatchBatch" }); }} />
          <Row icon={<Plus size={20} strokeWidth={2} />} title="Make a custom log button" chevron onClick={() => { setMoreOpen(false); setModal({ type: "customLogPicker", hobbyId: hobby.id }); }} />
        </Card>
      </Sheet>
    </div>
  );
}

// ── Batches ─────────────────────────────────────────────────────────────────
export function MeatBatches({ hobby, data, update, setModal }) {
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const active = hobby.currentBatches || [];
  const past = (hobby.archivedBatches || []).slice().sort((a, b) => ((b.endDate || b.startDate || "") < (a.endDate || a.startDate || "") ? -1 : 1));
  const restore = (b) => {
    update((d) => restorePastBatch(d, hobby.id, b.id), { immediate: true });
    showUndo(`${b.name} is active again`, () => update((d) => {
      // Put it back the way it was: finalize again with the same snapshot.
      const h = d.hobbies.find((x) => x.id === hobby.id); if (!h) return d;
      h.currentBatches = (h.currentBatches || []).filter((x) => x.id !== b.id);
      h.archivedBatches = [...(h.archivedBatches || []), JSON.parse(JSON.stringify(b))];
      const ids = new Set((b.finalEntries || []).map((e) => e.id));
      d.entries[hobby.id] = (d.entries[hobby.id] || []).filter((e) => !ids.has(e.id));
      return d;
    }, { immediate: true }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card>
        {active.length > 0 && <CardHeader title="Going now" />}
        {active.map((b) => (
          <Row key={b.id} icon={ic(Bird)} title={`${b.name}${b.birdType && b.birdType !== "Chicken" ? ` · ${b.birdType}` : ""}`}
            sub={`${batchAlive(b, entries)} alive of ${Number(b.startCount) || 0} · week ${Math.floor(batchAgeDays(b) / 7) + 1}`}
            onClick={() => setModal({ type: "editBatch", hobbyId: hobby.id, batchId: b.id })} chevron />
        ))}
        <Row first={!active.length} icon={<Plus size={20} strokeWidth={2} />} title={active.length ? "Start another batch" : "Start a batch"} onClick={() => setModal({ type: "hatchBatch" })} chevron />
      </Card>

      {past.length > 0 && (
        <Card>
          <CardHeader title="Past batches" right={`${past.length}`} />
          {past.map((b) => {
            const t = batchTotals(b, entries);
            return (
              <Row key={b.id} icon={ic(Snowflake)} title={`${b.name}${b.birdType && b.birdType !== "Chicken" ? ` · ${b.birdType}` : ""}`}
                sub={[`${dayYear(b.startDate)}${b.endDate ? ` to ${prettyDay(b.endDate)}` : ""}`, t.butchered ? `${t.butchered} butchered` : null, t.lbs ? fmtWeight(t.lbs) : null, t.deaths ? `${t.deaths} lost` : null, t.lbs && t.cost ? `${fmtMoney(t.cost / t.lbs)}/lb` : null].filter(Boolean).join(" · ")}
                trailing={<Button kind="link" icon={<RotateCcw size={15} />} onClick={() => restore(b)} aria-label={`Make ${b.name} active again`}>Restore</Button>} />
            );
          })}
        </Card>
      )}
    </div>
  );
}

// ── Stats ───────────────────────────────────────────────────────────────────
const FACT_ICONS = { scale: Scale, trophy: Trophy, meals: Utensils, heart: HeartPulse, truck: Truck };

export function MeatStats({ hobby, data, setModal, allNumbers }) {
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const [rk, setRk] = useState("year");
  const year = String(new Date().getFullYear());
  const batches = useMemo(() => {
    const all = [...(hobby.archivedBatches || []), ...(hobby.currentBatches || []).map((b) => ({ ...b, active: true }))];
    return all.filter((b) => rk === "all" || String(b.endDate || b.startDate || "").startsWith(year) || (b.active && String(b.startDate || "") <= `${year}-12-31`))
      .map((b) => ({ b, t: batchTotals(b, entries) }));
  }, [hobby, entries, rk, year]);
  const sum = (k) => batches.reduce((s, x) => s + x.t[k], 0);
  const lbs = sum("lbs"), cost = sum("cost"), start = sum("start"), deaths = sum("deaths"), butchered = sum("butchered");
  const survival = start ? Math.round(((start - deaths) / start) * 100) : null;
  const done = batches.filter((x) => x.t.lbs > 0);

  const facts = [];
  if (lbs >= 10) facts.push({ key: "meals", icon: "meals", big: Math.round(lbs * 2).toLocaleString("en-US"), line: "family dinners in our freezer", title: `About ${Math.round(lbs * 2).toLocaleString("en-US")} family dinners`, sub: platesLine(lbs) });
  if (done.length > 1) {
    const best = done.slice().sort((a, b) => (a.t.cost / a.t.lbs) - (b.t.cost / b.t.lbs))[0];
    if (best.t.cost > 0) facts.push({ key: "best", icon: "trophy", big: best.b.name, line: "our cheapest batch per pound", title: `${best.b.name} was your best batch`, sub: `${fmtMoney(best.t.cost / best.t.lbs)} a pound, all costs in.` });
  }
  if (butchered && lbs) facts.push({ key: "avg", icon: "scale", big: fmtWeight(lbs / butchered), line: "average bird off our place", title: `Your average bird: ${fmtWeight(lbs / butchered)}`, sub: `Across ${butchered} birds.` });
  const moves = entries.filter((e) => e && e.action === "move_tractor" && (rk === "all" || String(e.date).startsWith(year)));
  if (moves.length >= 5) {
    const ft = moves.reduce((s, e) => s + (Number(e.distanceFeet) || 0), 0);
    facts.push({ key: "tractor", icon: "truck", big: String(moves.length), line: "times we moved the chicken tractor", title: `You moved the tractor ${moves.length} times`, sub: ft ? `About ${ft.toLocaleString("en-US")} feet of fresh grass.` : "Fresh grass every time." });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <RangeChips options={[{ key: "year", label: year }, { key: "all", label: "All time" }]} value={rk} onPick={setRk} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <Card padded>
          <div style={{ fontSize: type.small, color: nl.soft }}>In the freezer</div>
          <div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1 }}>{lbs ? fmtWeight(lbs) : "—"}</div>
          <div style={{ fontSize: 12, color: nl.soft }}>{butchered ? `${butchered} birds` : "Butcher a batch to see this"}</div>
        </Card>
        <Card padded>
          <div style={{ fontSize: type.small, color: nl.soft }}>Cost per pound</div>
          <div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1 }}>{lbs && cost ? fmtMoney(cost / lbs) : "—"}</div>
          <div style={{ fontSize: 12, color: nl.soft }}>{cost ? `${fmtMoney(cost)} on chicks, feed and builds` : "Log feed costs to see this"}</div>
        </Card>
      </div>
      {survival != null && (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", borderRadius: 18, background: survival >= 90 ? nl.goodTint : nl.alertTint }}>
          <Lightbulb size={20} color={survival >= 90 ? nl.goodInk : nl.alert} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <div style={{ fontSize: 13, lineHeight: 1.45 }}><b>{survival}% made it</b>: {start - deaths} of {start} birds{deaths ? `, ${deaths} lost` : ""}. {survival >= 95 ? "That's excellent." : survival >= 90 ? "That's a good batch." : "The full numbers show when losses happened."}</div>
        </div>
      )}
      <FactCarousel facts={facts} icons={FACT_ICONS} label="Meat bird fun facts, swipe for more"
        onShare={(f) => setModal({ type: "shareCard", card: factCard({ ...f, kind: `meat_fact_${f.key}` }, data, { emoji: "🍗", kicker: "Our meat birds" }) })} />
      {batches.length > 0 && (
        <Card>
          <CardHeader title="By batch" />
          {batches.slice().reverse().map(({ b, t }) => (
            <Row key={b.id} icon={ic(b.active ? Bird : Snowflake)} title={b.name}
              sub={[t.butchered ? `${t.butchered} birds · ${fmtWeight(t.lbs)}` : `${t.start} started`, t.lbs && t.cost ? `${fmtMoney(t.cost / t.lbs)}/lb` : null, t.deaths ? `${t.deaths} lost` : null].filter(Boolean).join(" · ")}
              trailing={b.active ? <Badge tone="good">Going</Badge> : null} />
          ))}
        </Card>
      )}
      <AllNumbers label="All the numbers: feed conversion, losses, costs">{allNumbers}</AllNumbers>
    </div>
  );
}
