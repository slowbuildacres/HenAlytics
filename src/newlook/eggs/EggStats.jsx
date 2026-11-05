// ============================================================================
// Egg layers (3.0) — Stats
// ----------------------------------------------------------------------------
// The headline numbers for a period (eggs, cost per dozen vs. the store),
// swipeable fun facts with a share button, eggs by month split by flock and
// the last few purchases. Every number the old Stats page had stays one tap
// away under "All the numbers".
// ============================================================================

import React, { useMemo, useState } from "react";
import { CalendarCheck, BarChart3, Sun, Trophy, Egg, Layers, Share2, ChevronDown } from "lucide-react";
import { nl, font, type } from "../theme.js";
import { Card, Button } from "../ui.jsx";
import { collectPurchases, lastBoughtByItem, agoLabel } from "../../flockTools.js";
import { fmtMoney } from "../../units.js";
import { isoDay, prettyDay, rangeFor, summary, monthlyByFlock, eggFunFacts } from "./eggFacts.js";
import { cleanName } from "../hobbies.js";

const FACT_ICONS = { calendar: CalendarCheck, chart: BarChart3, sun: Sun, trophy: Trophy, egg: Egg, stack: Layers };
const FLOCK_COLORS = ["#E3A92B", "#3F6E8F", "#4C6B2F", "#B4472E", "#8B6F47", "#7A5C9E"];
const DEFAULT_STORE = 4;

export function factShareCard(fact, data) {
  const name = String(data.homesteadName || "").trim();
  return {
    kind: `egg_fact_${fact.key}`,
    emoji: "🥚",
    kicker: name || "Our flock",
    big: fact.big || "",
    line: fact.line || fact.title,
    chips: [],
    list: [],
    title: `${fact.title} 🥚`,
    subtitle: fact.sub,
    stats: [],
  };
}

export default function EggStats({ hobby, data, setModal, allNumbers }) {
  const today = isoDay();
  const [rk, setRk] = useState("6m");
  const [showAll, setShowAll] = useState(false);
  const r = rangeFor(rk, today);
  const s = useMemo(() => summary(data, hobby, r), [data, hobby, rk]); // eslint-disable-line react-hooks/exhaustive-deps
  const store = Number(hobby.storeEggPrice) > 0 ? Number(hobby.storeEggPrice) : DEFAULT_STORE;
  const facts = useMemo(() => eggFunFacts({ data, hobby, range: r, today, storePrice: store }), [data, hobby, rk, store]); // eslint-disable-line react-hooks/exhaustive-deps
  const flocks = (hobby.flocks || []).filter((f) => f && !f.archived);
  const months = useMemo(() => monthlyByFlock((data.entries && data.entries[hobby.id]) || [], flocks, today, 6), [data, hobby]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxMonth = Math.max(1, ...months.map((m) => m.total));
  const name = cleanName(hobby.name);
  const bought = useMemo(() => {
    const all = collectPurchases(data);
    const mine = all.filter((p) => !p.hobby || p.hobby === name);
    return lastBoughtByItem(mine.length ? mine : all, today).slice(0, 2);
  }, [data, name]); // eslint-disable-line react-hooks/exhaustive-deps

  const delta = s.delta;
  const priorWord = rk === "6m" ? "prior 6 mo" : "this time last year";
  const saving = s.perDozen != null ? store - s.perDozen : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div role="group" aria-label="Time range" style={{ display: "flex", gap: 6 }}>
        {["6m", "year", "all"].map((k) => {
          const on = k === rk;
          return <button key={k} type="button" aria-pressed={on} onClick={() => setRk(k)} style={{
            minHeight: 36, padding: "0 13px", borderRadius: 999, cursor: "pointer", font: `600 13px ${font.body}`,
            background: on ? nl.ink : "transparent", color: on ? nl.paper : nl.ink, border: on ? "none" : `1.5px solid ${nl.field}`,
          }}>{rangeFor(k, today).label}</button>;
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <Card padded>
          <div style={{ fontSize: type.small, color: nl.soft }}>Eggs</div>
          <div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1 }}>{s.eggs.toLocaleString("en-US")}</div>
          {delta != null && isFinite(delta) && (
            <div style={{ fontSize: 12, fontWeight: 600, color: delta >= 0 ? nl.good : nl.alert }}>
              {delta >= 0 ? "Up" : "Down"} {Math.abs(Math.round(delta * 100))}% vs. {priorWord}
            </div>
          )}
        </Card>
        <Card padded onClick={() => setModal({ type: "eggShare", hobbyId: hobby.id })} aria-label="Cost per dozen. Tap to share or change the store price.">
          <div style={{ fontSize: type.small, color: nl.soft }}>Cost per dozen</div>
          <div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1 }}>{s.perDozen != null && s.cost > 0 ? fmtMoney(s.perDozen) : "—"}</div>
          <div style={{ fontSize: 12, color: nl.soft }}>
            {s.cost > 0 && saving != null
              ? (saving > 0 ? `Store: ${fmtMoney(store)} · you save ${fmtMoney(saving)}` : `Store: ${fmtMoney(store)}`)
              : "Log feed costs to see this"}
          </div>
        </Card>
      </div>

      {facts.length > 0 && (
        <div role="region" aria-label="Fun facts, swipe for more" style={{
          display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory", margin: "0 -20px", padding: "0 20px", scrollPaddingLeft: 20, scrollbarWidth: "none",
        }}>
          {facts.map((f, i) => {
            const Icon = FACT_ICONS[f.icon] || Egg;
            return (
              <div key={f.key} style={{
                flex: facts.length === 1 ? "1 0 100%" : "0 0 min(300px, 82%)", scrollSnapAlign: "start", boxSizing: "border-box",
                background: nl.yolkTint, borderRadius: 20, padding: "12px 12px 14px 16px", display: "flex", flexDirection: "column", gap: 4,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, color: nl.yolkInk }}>
                  <Icon size={14} strokeWidth={2} aria-hidden="true" />Fun fact
                  <span style={{ marginLeft: "auto", letterSpacing: 0, textTransform: "none", fontWeight: 600 }}>{i + 1} of {facts.length}</span>
                  <button type="button" aria-label={`Share: ${f.title}`} onClick={() => setModal({ type: "shareCard", card: factShareCard(f, data) })} style={{
                    width: 32, height: 32, marginLeft: 2, border: "none", borderRadius: 16, background: "rgba(255,253,248,0.6)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", color: nl.yolkInk,
                  }}><Share2 size={16} strokeWidth={2} /></button>
                </div>
                <div style={{ fontFamily: font.display, fontSize: 20, lineHeight: 1.15, color: nl.ink }}>{f.title}</div>
                <div style={{ fontSize: 12, lineHeight: 1.35, color: nl.quietInk }}>{f.sub}</div>
              </div>
            );
          })}
        </div>
      )}

      <Card padded>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Eggs by month</div>
          {flocks.length > 1 && (
            <div style={{ display: "flex", gap: 10, fontSize: 12, color: nl.soft, flexWrap: "wrap" }}>
              {flocks.map((f, i) => (
                <span key={f.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: FLOCK_COLORS[i % FLOCK_COLORS.length] }} />{f.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div role="img" aria-label={`Eggs by month: ${months.map((m) => `${m.label} ${m.total}`).join(", ")}`}
          style={{ display: "grid", gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`, gap: 10, alignItems: "end", height: 140, marginTop: 14 }}>
          {months.map((m) => (
            <div key={m.key} style={{ display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-end", height: "100%" }}>
              <div style={{ fontSize: 11, color: nl.soft, textAlign: "center", marginBottom: 4 }}>{m.total || ""}</div>
              <div style={{ height: `${(m.total / maxMonth) * 96}px`, minHeight: m.total ? 3 : 0, borderRadius: "6px 6px 0 0", overflow: "hidden", display: "flex", flexDirection: "column-reverse" }}>
                {flocks.map((f, i) => {
                  const v = m.byFlock[f.id] || 0;
                  return v ? <div key={f.id} style={{ flex: v, background: FLOCK_COLORS[i % FLOCK_COLORS.length] }} /> : null;
                })}
                {m.byFlock._other ? <div style={{ flex: m.byFlock._other, background: nl.navIdle }} /> : null}
              </div>
              <div style={{ fontSize: 11, color: nl.soft, textAlign: "center", marginTop: 6 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "12px 16px 6px" }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Last bought</div>
          <Button kind="link" onClick={() => setModal({ type: "purchases" })}>All purchases</Button>
        </div>
        {bought.length ? bought.map((b) => (
          <div key={b.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: `1px solid ${nl.rule}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{b.item}</div>
              <div style={{ fontSize: 12, color: nl.soft }}>{prettyDay(b.lastDate)} · {b.everyDays ? `about every ${b.everyDays} days` : agoLabel(b.daysAgo)}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtMoney(b.lastAmount)}</div>
          </div>
        )) : <div style={{ padding: "4px 16px 14px", fontSize: 14, color: nl.soft }}>Log a feed or supply cost and it shows up here.</div>}
      </Card>

      <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48, borderRadius: 14,
        border: `1.5px solid ${nl.field}`, background: "transparent", cursor: "pointer", color: nl.ink, font: `600 14px ${font.body}`,
      }}>
        {showAll ? "Hide the detailed numbers" : "All the numbers: cost breakdown, per flock, egg use"}
        <ChevronDown size={16} style={{ transform: showAll ? "rotate(180deg)" : "none" }} aria-hidden="true" />
      </button>
      {showAll && <div>{allNumbers}</div>}
    </div>
  );
}
