// ============================================================================
// Kitchen & craft hobbies (3.0) — one Today / Shelf / Stats layout
// ----------------------------------------------------------------------------
// Canning, freeze drying, dehydrating, fermentation, tinctures, oils,
// salves, tea, soap, sourdough, baking, maple syrup… all boil down to the
// same shape: batches being made (with a ready date), what's on the shelf
// (jars, bottles, bars left), and what you made and sold. Each hobby page
// keeps its own forms and save logic and hands these screens a `ctx`:
//
//   ctx = {
//     summary: { big, small, line },          top card
//     newLabel, onNew,                        the one main button
//     going:  [{ id, title, sub, pct, badge:{tone,text}, actions:[{label, run, primary}] }],
//     goingTitle,                             "Curing", "Infusing", …
//     shelf:  [{ id, title, sub, left, unit, badge, actions:[{label, run}], onOpen }],
//     shelfTitle, shelfEmpty,
//     past:   [{ id, title, sub, onOpen }],   archived / finished batches
//     extras: [{ key, label, sub, icon, run }],  equipment, expense, custom logs…
//     tabs:   [{ key, label, selected, onPick }] sub-hobby chips (Preserving, Herbalism)
//   }
// ============================================================================

import React, { useState } from "react";
import { Plus, BookOpen, Archive, ChevronDown, NotebookPen, Trophy, CalendarCheck, DollarSign, Timer, Leaf, Wheat, Droplet, ShoppingBasket, Sparkles } from "lucide-react";
import { nl, font, type } from "../theme.js";
import { Card, CardHeader, Row, Badge, Button, Chip } from "../ui.jsx";
import { RangeChips, FactCarousel, factCard, AllNumbers } from "../StatsParts.jsx";

const ic = (I) => (I ? <I size={20} strokeWidth={1.8} /> : null);

export function SubTabs({ tabs }) {
  if (!tabs || tabs.length < 2) return null;
  return (
    <div role="group" aria-label="Kind" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -20px", padding: "0 20px", scrollbarWidth: "none" }}>
      {tabs.map((t) => <Chip key={t.key} selected={t.selected} onClick={t.onPick}>{t.label}</Chip>)}
    </div>
  );
}

function ItemRow({ it, first }) {
  return (
    <div style={{ borderTop: first ? "none" : `1px solid ${nl.rule}`, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <button type="button" onClick={it.onOpen} disabled={!it.onOpen} style={{ display: "flex", alignItems: "center", gap: 12, border: "none", background: "none", padding: 0, textAlign: "left", cursor: it.onOpen ? "pointer" : "default", color: nl.ink, font: "inherit" }}>
        {it.left != null && (
          <span style={{ minWidth: 44, height: 44, borderRadius: 12, background: it.left > 0 ? nl.goodTint : nl.chip, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: "0 6px" }}>
            <span style={{ font: `700 16px ${font.body}`, color: it.left > 0 ? nl.goodInk : nl.soft, lineHeight: 1 }}>{it.left}</span>
            {it.unit && <span style={{ fontSize: 10, color: nl.soft }}>{it.unit}</span>}
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: type.body, fontWeight: 600, overflowWrap: "anywhere" }}>{it.title}</span>
          {it.sub && <span style={{ display: "block", fontSize: type.small, color: nl.soft, overflowWrap: "anywhere" }}>{it.sub}</span>}
        </span>
        {it.badge && <Badge tone={it.badge.tone}>{it.badge.text}</Badge>}
      </button>
      {it.pct != null && (
        <div style={{ height: 8, borderRadius: 4, background: nl.chip, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, it.pct))}%`, background: it.pct >= 100 ? nl.good : nl.yolk }} />
        </div>
      )}
      {it.actions && it.actions.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {it.actions.map((a) => <Button key={a.label} small kind={a.primary ? "primary" : "quiet"} onClick={a.run}>{a.label}</Button>)}
        </div>
      )}
    </div>
  );
}

export function PantryToday({ ctx, onOpenJournal, onSeeAll }) {
  const { summary, going = [], shelf = [], extras = [] } = ctx;
  const shelfShown = shelf.slice(0, 6);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SubTabs tabs={ctx.tabs} />
      {summary && (
        <Card padded>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontFamily: font.display, fontSize: 40, lineHeight: 1 }}>{summary.big}</span>
            <span style={{ fontSize: 14, color: nl.soft }}>{summary.small}</span>
          </div>
          {summary.line && <div style={{ fontSize: 13, color: nl.soft, marginTop: 6 }}>{summary.line}</div>}
        </Card>
      )}
      {ctx.onNew && <Button icon={<Plus size={20} strokeWidth={2.2} />} onClick={ctx.onNew}>{ctx.newLabel || "New batch"}</Button>}
      {going.length > 0 && (
        <Card>
          <CardHeader title={ctx.goingTitle || "Going now"} right={`${going.length}`} />
          {going.map((it) => <ItemRow key={it.id} it={it} first={false} />)}
        </Card>
      )}
      {(shelf.length > 0 || ctx.shelfEmpty) && (
        <Card>
          <CardHeader title={ctx.shelfTitle || "On the shelf"} right={shelf.length > shelfShown.length && onSeeAll ? <Button kind="link" onClick={onSeeAll}>All ({shelf.length})</Button> : null} />
          {shelfShown.length ? shelfShown.map((it) => <ItemRow key={it.id} it={it} first={false} />)
            : <div style={{ padding: "2px 14px 14px", fontSize: 14, color: nl.soft }}>{ctx.shelfEmpty}</div>}
        </Card>
      )}
      <Card>
        {extras.map((x, i) => <Row key={x.key} first={i === 0} icon={ic(x.icon || NotebookPen)} title={x.label} sub={x.sub} onClick={x.run} chevron />)}
        {onOpenJournal && <Row first={!extras.length} icon={ic(BookOpen)} title="Everything you've logged" sub="Edit or delete past entries in the Journal" onClick={onOpenJournal} chevron />}
      </Card>
    </div>
  );
}

export function PantryShelf({ ctx }) {
  const { shelf = [], going = [], past = [] } = ctx;
  const [showPast, setShowPast] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SubTabs tabs={ctx.tabs} />
      {going.length > 0 && (
        <Card>
          <CardHeader title={ctx.goingTitle || "Going now"} right={`${going.length}`} />
          {going.map((it) => <ItemRow key={it.id} it={it} />)}
        </Card>
      )}
      <Card>
        <CardHeader title={ctx.shelfTitle || "On the shelf"} right={`${shelf.length}`} />
        {shelf.length ? shelf.map((it) => <ItemRow key={it.id} it={it} />) : <div style={{ padding: "2px 14px 14px", fontSize: 14, color: nl.soft }}>{ctx.shelfEmpty || "Nothing here yet."}</div>}
        {ctx.onNew && <Row icon={<Plus size={20} strokeWidth={2} />} title={ctx.newLabel || "New batch"} onClick={ctx.onNew} chevron />}
      </Card>
      {past.length > 0 && (
        <Card>
          <Row first icon={ic(Archive)} title={`${ctx.pastTitle || "Finished and archived"} (${past.length})`} sub={ctx.pastSub || "Tap one to see or restore it."} onClick={() => setShowPast((v) => !v)}
            trailing={<ChevronDown size={18} color={nl.soft} style={{ transform: showPast ? "rotate(180deg)" : "none" }} aria-hidden="true" />} />
          {showPast && past.map((p) => <Row key={p.id} title={p.title} sub={p.sub} onClick={p.onOpen} chevron={!!p.onOpen} />)}
        </Card>
      )}
    </div>
  );
}

const DEFAULT_FACT_ICONS = { jar: ShoppingBasket, trophy: Trophy, calendar: CalendarCheck, money: DollarSign, clock: Timer, leaf: Leaf, bread: Wheat, drop: Droplet, spark: Sparkles };

// stats = { cards:[{label, value, sub}], bars:{ title, right, rows:[{key, name, value, label}] }, facts:[], emoji, kicker }
export function PantryStats({ ctx, data, setModal, allNumbers, range, onRange, allLabel }) {
  const s = ctx.stats || {};
  const rows = (s.bars && s.bars.rows) || [];
  const top = Math.max(1, ...rows.map((r) => r.value));
  const year = String(new Date().getFullYear());
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SubTabs tabs={ctx.tabs} />
      {onRange && <RangeChips options={[{ key: "year", label: year }, { key: "all", label: "All time" }]} value={range} onPick={onRange} />}
      {s.cards && s.cards.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          {s.cards.slice(0, 4).map((c) => (
            <Card key={c.label} padded>
              <div style={{ fontSize: type.small, color: nl.soft }}>{c.label}</div>
              <div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1, overflowWrap: "anywhere" }}>{c.value}</div>
              {c.sub && <div style={{ fontSize: 12, color: nl.soft }}>{c.sub}</div>}
            </Card>
          ))}
        </div>
      )}
      <FactCarousel facts={s.facts || []} icons={{ ...DEFAULT_FACT_ICONS, ...(s.factIcons || {}) }} label="Fun facts, swipe for more"
        onShare={(f) => setModal({ type: "shareCard", card: factCard({ ...f, kind: `${ctx.key || "pantry"}_fact_${f.key}` }, data, { emoji: s.emoji || "🫙", kicker: s.kicker || "Our homestead" }) })} />
      {rows.length > 0 && (
        <Card>
          <CardHeader title={s.bars.title} right={s.bars.right} />
          {rows.map((r) => (
            <div key={r.key || r.name} style={{ padding: "8px 14px 10px", borderTop: `1px solid ${nl.rule}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}><span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{r.name}</span><span style={{ flexShrink: 0 }}>{r.label}</span></div>
              <div style={{ height: 8, borderRadius: 4, background: nl.chip, marginTop: 6, overflow: "hidden" }}><div style={{ height: "100%", width: `${(r.value / top) * 100}%`, background: nl.yolk }} /></div>
            </div>
          ))}
        </Card>
      )}
      <AllNumbers label={allLabel || "All the numbers"}>{allNumbers}</AllNumbers>
    </div>
  );
}

// The page on screen's main action (ctx.onNew), so the Log picker can start
// a batch from anywhere: the app opens the page, then calls pantryNew.fn().
export const pantryNew = { fn: null };

// Pick the screen for the tab the app is on.
export function PantryView({ tab, ctx, onOpenJournal, onSeeAll }) {
  pantryNew.fn = ctx.onNew || null;
  return tab === "animals" ? <PantryShelf ctx={ctx} /> : <PantryToday ctx={ctx} onOpenJournal={onOpenJournal} onSeeAll={onSeeAll} />;
}

// Stats tab with its own year / all-time choice. statsFn(hobby, data, range).
export function PantryStatsPage({ hobby, data, setModal, statsFn, tabs, allNumbers, allLabel, keyName }) {
  const [range, setRange] = useState("year");
  const ctx = { key: keyName || (hobby && hobby.type), tabs, stats: statsFn ? statsFn(hobby, data, range) : {} };
  return <PantryStats ctx={ctx} data={data} setModal={setModal} allNumbers={allNumbers} range={range} onRange={setRange} allLabel={allLabel} />;
}
