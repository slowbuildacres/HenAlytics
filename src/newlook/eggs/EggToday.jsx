// ============================================================================
// Egg layers (3.0) — Today tab
// ----------------------------------------------------------------------------
// The egg counter first (same basket as before: + as you collect, it saves to
// that day on its own), then quick actions, a short insight, feed supply,
// eggs on hand and the winter checklist. Everything the old page had is
// here, in More, or on the Birds tab (flocks, named birds, brooder).
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  Wheat, DollarSign, Receipt, MoreHorizontal, Lightbulb, AlertTriangle, Settings as Gear, X,
  Droplet, Bird, Truck, Egg, Utensils, Archive, NotebookPen, Skull, Hammer, Plus, Snowflake, BookOpen, History,
} from "lucide-react";
import { nl, font, type } from "../theme.js";
import { Card, CardHeader, Row, RoundButton, Sheet, Button } from "../ui.jsx";
import { flockEggSummary, broodyDay } from "../../flockTools.js";
import FeedCard from "../FeedCard.jsx";
import { computeEggsOnHand } from "../../eggInventory.js";
import { winterSeason, WINTER_ITEMS } from "../../winterChecklist.js";
import { eggInsight } from "../../eggInsights.js";
import { isoDay, prettyDay } from "./eggFacts.js";

const PLURAL = { Chicken: "chickens", Duck: "ducks", Turkey: "turkeys", Quail: "quail", Goose: "geese", Guinea: "guineas", Peafowl: "peafowl", Other: "birds" };
const SINGULAR = { Chicken: "chicken", Duck: "duck", Turkey: "turkey", Quail: "quail", Goose: "goose", Guinea: "guinea", Peafowl: "peafowl", Other: "bird" };
export const birdWord = (type, n) => (n === 1 ? SINGULAR[type] || "bird" : PLURAL[type] || "birds");

// Same basket the old page used (flock.eggBasket = { date, count }).
function bumpBasket(update, hobbyId, flockId, delta) {
  const today = isoDay();
  update((d) => {
    const h = d.hobbies.find((x) => x.id === hobbyId);
    const fl = h && (h.flocks || []).find((x) => x.id === flockId);
    if (!fl) return d;
    const cur = fl.eggBasket && fl.eggBasket.date === today ? Number(fl.eggBasket.count) || 0 : 0;
    const next = Math.max(0, cur + delta);
    fl.eggBasket = next > 0 ? { date: today, count: next } : null;
    return d;
  });
}
function saveBasketNow(update, hobbyId, flock, count) {
  if (!(count > 0)) return;
  const today = isoDay();
  update((d) => {
    d.entries[hobbyId] = d.entries[hobbyId] || [];
    d.entries[hobbyId].push({ id: Math.random().toString(36).slice(2, 10), date: today, action: "eggs_laid", count, flockId: flock.id, birdType: flock.birdType, created: Date.now() });
    const h = d.hobbies.find((x) => x.id === hobbyId);
    const fl = h && (h.flocks || []).find((x) => x.id === flock.id);
    if (fl) fl.eggBasket = null;
    return d;
  });
}

const ACTION_ICONS = { fed: Wheat, watered: Droplet, free_range: Bird, move_tractor: Truck, eggs: Egg, sold_eggs: DollarSign, used_eggs: Utensils, bedding: Archive, broody: Bird, death: Skull, infrastructure: Hammer, note: NotebookPen };
const BUILT_INS = [
  ["fed", "Fed"], ["watered", "Watered"], ["free_range", "Free range"], ["move_tractor", "Move tractor"],
  ["eggs", "Eggs laid (type a number)"], ["sold_eggs", "Sold eggs"], ["used_eggs", "Used eggs"], ["bedding", "Bedding"],
  ["broody", "Broody hen"], ["death", "Report a death"], ["infrastructure", "Coop and equipment"], ["note", "Note"],
];

function FlockCounter({ flock, hobby, entries, update, today, big, onFocus }) {
  const count = flock.eggBasket && flock.eggBasket.date === today ? Number(flock.eggBasket.count) || 0 : 0;
  const sum = flockEggSummary(entries, flock.id, { today, basket: count });
  const n = Number(flock.birdCount) || 0;
  const broody = (flock.namedBirds || []).filter((b) => b && b.broody && !b.archived);
  const broodyText = broody.length === 1
    ? (() => { const dd = broodyDay(broody[0], entries, today); return `${broody[0].name} broody${dd ? `, day ${dd}` : ""}`; })()
    : broody.length > 1 ? `${broody.length} broody` : null;
  const sub = [`${n} ${birdWord(flock.birdType, n)}`, broodyText].filter(Boolean).join(" · ");

  if (!big) {
    return (
      <Card style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 10px 16px" }}>
        <button type="button" onClick={onFocus} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", color: nl.ink, font: "inherit" }}>
          <div style={{ fontSize: type.body, fontWeight: 600 }}>{flock.name}</div>
          <div style={{ fontSize: type.small, color: nl.soft }}>{sum.today} today · {sum.week} this week</div>
        </button>
        <RoundButton kind="minus" size={40} label={`One less ${flock.name} egg`} disabled={count === 0} onClick={() => bumpBasket(update, hobby.id, flock.id, -1)} />
        <span style={{ fontFamily: font.display, fontSize: 24, minWidth: 28, textAlign: "center" }}>{count}</span>
        <RoundButton kind="plus" size={44} label={`One more ${flock.name} egg`} onClick={() => bumpBasket(update, hobby.id, flock.id, 1)} />
      </Card>
    );
  }
  return (
    <Card padded>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{flock.name}</div>
          <div style={{ fontSize: type.small, color: nl.soft }}>{sub}</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: nl.chip, flexShrink: 0 }}>Today</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "14px 0 12px" }}>
        <RoundButton kind="minus" size={52} label="One less egg" disabled={count === 0} onClick={() => bumpBasket(update, hobby.id, flock.id, -1)} />
        <div style={{ textAlign: "center" }} aria-live="polite">
          <div style={{ fontFamily: font.display, fontSize: 54, lineHeight: 1 }}>{count}</div>
          <div style={{ fontSize: type.small, color: nl.soft }}>{count ? "collected so far" : "tap + as you collect"}</div>
        </div>
        <RoundButton kind="plus" size={60} label="One more egg" onClick={() => bumpBasket(update, hobby.id, flock.id, 1)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, paddingTop: 12, borderTop: `1px solid ${nl.rule}`, textAlign: "center" }}>
        {[["Today", sum.today], ["7 days", sum.week], ["30 days", sum.month]].map(([l, v]) => (
          <div key={l}>
            <div style={{ fontFamily: font.display, fontSize: 20, lineHeight: 1.1 }}>{v}</div>
            <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: nl.soft, fontWeight: 600 }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: nl.soft, textAlign: "center", marginTop: 10 }}>
        Saves to today on its own.
        {count > 0 && <> <button type="button" onClick={() => saveBasketNow(update, hobby.id, flock, count)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: nl.good, font: `600 12px ${font.body}` }}>Save now</button></>}
      </div>
    </Card>
  );
}

function WinterCard({ data, update, types }) {
  const season = winterSeason();
  if (!season) return null;
  const st = (data.winterChecklist && data.winterChecklist[season]) || {};
  if (st.hidden) return null;
  const items = types.flatMap((t) => (WINTER_ITEMS[t] || []).map((it) => ({ ...it, key: `${t}:${it.id}` })));
  if (!items.length) return null;
  const done = st.done || {};
  const doneCount = items.filter((it) => done[it.key]).length;
  const set = (fn) => update((d) => {
    d.winterChecklist = d.winterChecklist || {};
    const cur = d.winterChecklist[season] || {};
    d.winterChecklist[season] = fn({ ...cur, done: { ...(cur.done || {}) } });
    return d;
  });
  return (
    <Card>
      <CardHeader title="Winter checklist" right={`${doneCount} of ${items.length}`} />
      {items.map((it, i) => {
        const on = !!done[it.key];
        return (
          <button key={it.key} type="button" onClick={() => set((s) => { if (s.done[it.key]) delete s.done[it.key]; else s.done[it.key] = true; return s; })}
            aria-pressed={on} style={{
              display: "flex", alignItems: "flex-start", gap: 12, width: "100%", padding: "11px 14px", textAlign: "left",
              border: "none", borderTop: `1px solid ${nl.rule}`, background: "transparent", cursor: "pointer", color: nl.ink, font: "inherit",
            }}>
            <span style={{ width: 26, height: 26, borderRadius: 13, flexShrink: 0, marginTop: 1, boxSizing: "border-box",
              border: on ? "none" : `1.5px solid ${nl.navIdle}`, background: on ? nl.good : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: type.body, fontWeight: 600, textDecoration: on ? "line-through" : "none", color: on ? nl.soft : nl.ink }}>{it.text}</span>
              {!on && <span style={{ display: "block", fontSize: type.small, color: nl.soft, marginTop: 1 }}>{it.sub}</span>}
            </span>
          </button>
        );
      })}
      <div style={{ borderTop: `1px solid ${nl.rule}`, padding: "6px 14px" }}>
        <Button kind="link" onClick={() => set((s) => ({ ...s, hidden: true }))} style={{ color: nl.soft, fontSize: 13 }}>Hide for this winter</Button>
      </div>
    </Card>
  );
}

export default function EggToday({ hobby, data, update, setModal, onOpenJournal }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const flocks = (hobby.flocks || []).filter((f) => f && !f.archived);
  const [focusId, setFocusId] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const focus = flocks.find((f) => f.id === focusId) || flocks[0];
  const lat = data.homesteadLocation ? data.homesteadLocation.lat : null;
  const insight = useMemo(() => eggInsight({ entries, lat }), [entries, lat]);
  const onHand = computeEggsOnHand(hobby, entries, data.sales || []);
  const log = (action) => setModal({ type: "log", action, hobbyIdOverride: hobby.id });
  const hidden = Array.isArray(hobby.hiddenQuickLogs) ? hobby.hiddenQuickLogs : [];
  const custom = Array.isArray(hobby.customLogs) ? hobby.customLogs : [];
  const hasBirds = flocks.some((f) => (Number(f.birdCount) || 0) > 0);

  if (!flocks.length) {
    return (
      <div style={{ textAlign: "center", padding: "28px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ width: 96, height: 96, borderRadius: 48, background: nl.yolkTint, display: "flex", alignItems: "center", justifyContent: "center" }}><Egg size={48} strokeWidth={1.6} /></div>
        <h2 style={{ margin: "6px 0 0", fontFamily: font.display, fontWeight: 400, fontSize: 26 }}>Add your first flock</h2>
        <p style={{ margin: 0, fontSize: 15, color: nl.soft, lineHeight: 1.45 }}>Tell Henalytics how many birds you keep. Then tap + each time you collect eggs.</p>
        <Button onClick={() => setModal({ type: "addFlock", hobbyId: hobby.id })} style={{ width: "100%", marginTop: 8 }}>Add a flock</Button>
      </div>
    );
  }

  const quick = [
    { key: "fed", label: "Fed", icon: Wheat, run: () => log("fed") },
    { key: "sold", label: "Sold", icon: DollarSign, run: () => log("sold_eggs") },
    { key: "expense", label: "Expense", icon: Receipt, run: () => setModal({ type: "addExpense", hobbyId: hobby.id }) },
    { key: "more", label: "More", icon: MoreHorizontal, run: () => setMoreOpen(true) },
  ];
  const insightTone = insight && insight.tone === "check" ? { bg: nl.alertTint, ic: nl.alert, Icon: AlertTriangle } : { bg: nl.goodTint, ic: nl.goodInk, Icon: Lightbulb };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <FlockCounter big flock={focus} hobby={hobby} entries={entries} update={update} today={today} />
      {flocks.filter((f) => f.id !== focus.id).map((f) => (
        <FlockCounter key={f.id} flock={f} hobby={hobby} entries={entries} update={update} today={today} onFocus={() => setFocusId(f.id)} />
      ))}

      <div style={{ display: "flex", gap: 8 }}>
        {quick.map((q) => (
          <button key={q.key} type="button" onClick={q.run} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 0", minHeight: 68,
            borderRadius: 16, background: nl.card, border: `1px solid ${nl.line}`, cursor: "pointer", color: nl.ink, font: `600 12px ${font.body}`,
          }}><q.icon size={22} strokeWidth={1.8} aria-hidden="true" />{q.label}</button>
        ))}
      </div>

      {insight && (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", borderRadius: 18, background: insightTone.bg }}>
          <insightTone.Icon size={20} color={insightTone.ic} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <div><div style={{ fontSize: 14, fontWeight: 600 }}>{insight.title}</div><div style={{ fontSize: 13, color: nl.soft, marginTop: 2, lineHeight: 1.45 }}>{insight.body}</div></div>
        </div>
      )}

      <FeedCard hobby={hobby} entries={entries} update={update} setModal={setModal} />

      {onHand != null && (
        <Card>
          <Row first icon={<Egg size={20} strokeWidth={1.8} />} title={`${onHand} egg${Math.abs(onHand) === 1 ? "" : "s"} on hand`}
            sub={onHand < 0 ? "Below zero. Recount your eggs in settings." : `Since your count on ${hobby.eggInventory.startDate ? prettyDay(hobby.eggInventory.startDate) : "—"}`}
            trailing={<span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Button kind="link" onClick={() => log("used_eggs")}>Use eggs</Button>
              <button type="button" aria-label="Eggs on hand settings" onClick={() => setModal({ type: "eggInventorySetup", hobbyId: hobby.id })}
                style={{ width: 36, height: 36, border: "none", background: "none", cursor: "pointer", color: nl.soft, display: "flex", alignItems: "center", justifyContent: "center" }}><Gear size={18} /></button>
            </span>} />
        </Card>
      )}

      <WinterCard data={data} update={update} types={["egg_layers"]} />

      <Card>
        <Row first icon={<BookOpen size={20} strokeWidth={1.8} />} title="Everything you've logged" sub="Edit or delete past entries in the Journal" onClick={onOpenJournal} chevron />
      </Card>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} label="More egg layer logs" showClose>
        <h2 style={{ margin: "0 4px 10px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>Log something else</h2>
        <Card>
          {BUILT_INS.filter(([a]) => !hidden.includes(a)).map(([a, label], i) => {
            const Icon = ACTION_ICONS[a] || NotebookPen;
            return <Row key={a} first={i === 0} icon={<Icon size={20} strokeWidth={1.8} />} title={label} chevron
              onClick={() => { setMoreOpen(false); if (a === "used_eggs" && !(hobby.eggInventory && hobby.eggInventory.enabled)) setModal({ type: "eggInventorySetup", hobbyId: hobby.id }); else log(a); }} />;
          })}
          {custom.map((c) => <Row key={c.id} icon={<NotebookPen size={20} strokeWidth={1.8} />} title={c.label} chevron
            onClick={() => { setMoreOpen(false); setModal({ type: "log", action: "custom", customLogId: c.id, hobbyIdOverride: hobby.id }); }} />)}
          <Row icon={<Egg size={20} strokeWidth={1.8} />} title="Hatch eggs" sub="Start an incubator batch" chevron onClick={() => { setMoreOpen(false); setModal({ type: "hatchEggs", hobbyId: hobby.id }); }} />
          {hasBirds && <Row icon={<Snowflake size={20} strokeWidth={1.8} />} title="Remove birds" sub="Sold, rehomed, butchered or died" chevron onClick={() => { setMoreOpen(false); setModal({ type: "butcherFlock", hobbyId: hobby.id }); }} />}
          <Row icon={<History size={20} strokeWidth={1.8} />} title="Backfill old egg counts" sub="Add past days in bulk" chevron onClick={() => { setMoreOpen(false); setModal({ type: "bulkEggs", hobbyId: hobby.id }); }} />
          <Row icon={<Plus size={20} strokeWidth={2} />} title="Make a custom log button" chevron onClick={() => { setMoreOpen(false); setModal({ type: "customLogPicker", hobbyId: hobby.id }); }} />
        </Card>
      </Sheet>
    </div>
  );
}
