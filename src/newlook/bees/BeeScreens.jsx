// ============================================================================
// Bees (3.0) — Today · Hives · one hive · Stats
// ----------------------------------------------------------------------------
// Today: hives that need a look (inspection due, high mite count, lost),
// quick logs (inspect, harvest, mite test, more — each asks which hive when
// you have more than one), honey this year, the latest logs. Hives: one row
// per hive with a status. One hive: honey, inspections, last mite test, the
// last inspection in plain words, every log (tap to edit). Stats: honey,
// jars, spending, honey by hive, fun facts, then the old analytics.
// Same records as the old page (hobby.hives, entries with hiveId); the forms
// are its own HiveModal / LogEntryModal, opened through `act` (BeesNewLook).
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  Search, ShoppingBasket, Bug, MoreHorizontal, Wheat, Pill, Split, Wind, Snowflake, Flower2, Hammer, Skull,
  NotebookPen, Receipt, Plus, Hexagon, BookOpen, ChevronLeft, Pencil, AlertTriangle, Lightbulb, Trophy, Plane, Trash2,
} from "lucide-react";
import { nl, font, type } from "../theme.js";
import { Card, CardHeader, Row, Badge, Button, Sheet } from "../ui.jsx";
import { RangeChips, FactCarousel, factCard, AllNumbers } from "../StatsParts.jsx";
import { fmtMoney, fmtWeight } from "../../units.js";
import { isoDay, prettyDay, parseDay, DAY } from "../eggs/eggFacts.js";

const ic = (I) => <I size={20} strokeWidth={1.8} />;
const dayYear = (s) => (s ? `${prettyDay(s)}, ${s.slice(0, 4)}` : "");
const daysFrom = (a, b) => Math.round((parseDay(b) - parseDay(a)) / DAY);
export const BEE_ACTIONS = [
  { action: "inspect", label: "Inspect", icon: Search },
  { action: "harvest", label: "Harvest", icon: ShoppingBasket },
  { action: "varroa", label: "Mite test", icon: Bug },
  { action: "feed", label: "Feed", icon: Wheat },
  { action: "treatment", label: "Treatment", icon: Pill },
  { action: "split", label: "Split", icon: Split },
  { action: "swarm", label: "Swarm", icon: Wind },
  { action: "winter_prep", label: "Winter prep", icon: Snowflake },
  { action: "spring_buildup", label: "Spring check", icon: Flower2 },
  { action: "infrastructure", label: "Equipment", icon: Hammer },
  { action: "death", label: "Colony loss", icon: Skull },
  { action: "note", label: "Note", icon: NotebookPen },
];
const ICON = Object.fromEntries(BEE_ACTIONS.map((a) => [a.action, a.icon]));
const LABEL = Object.fromEntries(BEE_ACTIONS.map((a) => [a.action, a.label]));
const desc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.created || 0) - (a.created || 0));
const activeSeason = (today) => { const m = Number(today.slice(5, 7)); return m >= 3 && m <= 10; };

export function hiveFacts(hive, entries, today = isoDay()) {
  const es = (entries || []).filter((e) => e && e.hiveId === hive.id).sort(desc);
  const lastInspect = es.find((e) => e.action === "inspect");
  const lastMite = es.find((e) => e.action === "varroa");
  const lost = es.some((e) => e.action === "death");
  const honey = es.filter((e) => e.action === "harvest").reduce((s, e) => s + (Number(e.lbs) || 0), 0);
  const sinceInspect = lastInspect ? daysFrom(lastInspect.date, today) : null;
  const highMites = !lost && lastMite && Number(lastMite.varroaCount) >= 3 && !lastMite.varroaTreatedAfter
    && !es.some((e) => e.action === "treatment" && e.date >= lastMite.date);
  const inspectDue = !lost && activeSeason(today) && (sinceInspect == null || sinceInspect > 14);
  return { es, lastInspect, lastMite, lost, honey, sinceInspect, highMites, inspectDue };
}

function status(f) {
  if (f.lost) return { tone: "alert", text: "Lost" };
  if (f.highMites) return { tone: "alert", text: `Mites ${Number(f.lastMite.varroaCount).toFixed(1)}%` };
  if (f.inspectDue) return { tone: "ready", text: f.sinceInspect == null ? "Not inspected yet" : `Inspected ${f.sinceInspect} days ago` };
  if (f.sinceInspect != null) return { tone: "good", text: f.sinceInspect === 0 ? "Inspected today" : `Inspected ${f.sinceInspect}d ago` };
  return null;
}

function entryText(e) {
  switch (e.action) {
    case "inspect": return [e.population, e.queenSeen ? "queen seen" : null, e.broodPattern ? `${String(e.broodPattern).toLowerCase()} brood` : null, e.honeyStores ? `${String(e.honeyStores).toLowerCase()} stores` : null].filter(Boolean).join(" · ") || "Inspection";
    case "harvest": return `${fmtWeight(Number(e.lbs) || 0)} honey${Number(e.jars) ? ` · ${e.jars} jars` : ""}`;
    case "varroa": return `${Number(e.varroaCount || 0).toFixed(1)} mites per 100 bees${e.varroaMethod ? ` · ${String(e.varroaMethod).toLowerCase()}` : ""}`;
    case "feed": return `${e.feedType || "Fed"}${Number(e.cost) ? ` · ${fmtMoney(e.cost)}` : ""}`;
    case "treatment": return `${e.treatmentType || "Treatment"}${Number(e.cost) ? ` · ${fmtMoney(e.cost)}` : ""}`;
    case "infrastructure": return `${e.item || "Equipment"}${Number(e.cost) ? ` · ${fmtMoney(e.cost)}` : ""}`;
    case "death": return `Colony lost · ${e.cause || "unknown cause"}`;
    case "split": case "swarm": return e.detail || LABEL[e.action];
    default: return e.note || e.customLabel || LABEL[e.action] || "Log";
  }
}

// ── Today ───────────────────────────────────────────────────────────────────
export function BeeToday({ hobby, data, setModal, act, onOpenJournal }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const hives = hobby.hives || [];
  const [moreOpen, setMoreOpen] = useState(false);
  const custom = Array.isArray(hobby.customLogs) ? hobby.customLogs : [];

  if (!hives.length) {
    return (
      <div style={{ textAlign: "center", padding: "28px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ width: 96, height: 96, borderRadius: 48, background: nl.yolkTint, display: "flex", alignItems: "center", justifyContent: "center" }}><Hexagon size={48} strokeWidth={1.6} /></div>
        <h2 style={{ margin: "6px 0 0", fontFamily: font.display, fontWeight: 400, fontSize: 26 }}>Add your first hive</h2>
        <p style={{ margin: 0, fontSize: 15, color: nl.soft, lineHeight: 1.45 }}>Log inspections, mite tests and honey for each hive. Henalytics reminds you when one is due a look.</p>
        <Button onClick={act.addHive} style={{ width: "100%", marginTop: 8 }}>Add a hive</Button>
      </div>
    );
  }
  const facts = hives.map((h) => ({ h, f: hiveFacts(h, entries, today) }));
  const alive = facts.filter((x) => !x.f.lost);
  const attention = facts.filter((x) => x.f.lost ? false : x.f.highMites || x.f.inspectDue);
  const year = today.slice(0, 4);
  const harvests = entries.filter((e) => e && e.action === "harvest" && String(e.date).startsWith(year));
  const lbs = harvests.reduce((s, e) => s + (Number(e.lbs) || 0), 0);
  const jars = harvests.reduce((s, e) => s + (Number(e.jars) || 0), 0);
  const recent = entries.filter((e) => e && e.date).sort(desc).slice(0, 4);
  const name = (id) => (hives.find((h) => h.id === id) || {}).name || "Hive";
  const quick = [
    { key: "inspect", label: "Inspect", icon: Search },
    { key: "harvest", label: "Harvest", icon: ShoppingBasket },
    { key: "varroa", label: "Mite test", icon: Bug },
    { key: "more", label: "More", icon: MoreHorizontal },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card padded>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Honey in {year}</div>
          <div style={{ fontSize: type.small, color: nl.soft }}>{alive.length} hive{alive.length === 1 ? "" : "s"} going</div>
        </div>
        <div style={{ fontFamily: font.display, fontSize: 40, lineHeight: 1.05, marginTop: 6 }}>{lbs ? fmtWeight(lbs) : "None yet"}</div>
        {jars > 0 && <div style={{ fontSize: 13, color: nl.soft }}>{jars} jars</div>}
      </Card>

      <div style={{ display: "flex", gap: 8 }}>
        {quick.map((q) => (
          <button key={q.key} type="button" onClick={() => (q.key === "more" ? setMoreOpen(true) : act.log(q.key))} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 0", minHeight: 68,
            borderRadius: 16, background: nl.card, border: `1px solid ${nl.line}`, cursor: "pointer", color: nl.ink, font: `600 12px ${font.body}`,
          }}><q.icon size={22} strokeWidth={1.8} aria-hidden="true" />{q.label}</button>
        ))}
      </div>

      {attention.length > 0 ? (
        <Card>
          <CardHeader title="Needs a look" />
          {attention.map(({ h, f }) => f.highMites ? (
            <Row key={h.id} tint={nl.alertTint} iconBg={nl.alertChip} icon={ic(AlertTriangle)} title={`${h.name}: ${Number(f.lastMite.varroaCount).toFixed(1)} mites per 100 bees`}
              sub={`Tested ${prettyDay(f.lastMite.date)}. At 3 or more, most beekeepers treat soon.`} onClick={() => act.openHive(h.id)} chevron />
          ) : (
            <Row key={h.id} icon={ic(Search)} iconBg={nl.yolkTint} title={`${h.name} is due an inspection`}
              sub={f.sinceInspect == null ? "No inspection logged yet" : `Last looked ${f.sinceInspect} days ago`} onClick={() => act.log("inspect", h.id)} chevron />
          ))}
        </Card>
      ) : !activeSeason(today) && alive.length > 0 ? (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", borderRadius: 18, background: nl.goodTint }}>
          <Lightbulb size={20} color={nl.goodInk} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <div style={{ fontSize: 13, lineHeight: 1.45 }}><b>Bees are clustered for winter.</b> Keep the hive closed on cold days. Lift the back to check it still feels heavy with stores.</div>
        </div>
      ) : null}

      <Card>
        {recent.length > 0 && <CardHeader title="Latest" />}
        {recent.map((e) => { const I = ICON[e.action] || NotebookPen; return <Row key={e.id} icon={ic(I)} title={`${name(e.hiveId)}: ${entryText(e)}`} sub={e.date === today ? "Today" : prettyDay(e.date)} />; })}
        <Row first={!recent.length} icon={ic(BookOpen)} title="Everything you've logged" sub="Edit or delete past entries in the Journal" onClick={onOpenJournal} chevron />
      </Card>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} label="More bee logs" showClose>
        <h2 style={{ margin: "0 4px 10px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>Log something else</h2>
        <Card>
          {BEE_ACTIONS.slice(3).map((a, i) => <Row key={a.action} first={i === 0} icon={ic(a.icon)} title={a.label} chevron onClick={() => { setMoreOpen(false); act.log(a.action); }} />)}
          <Row icon={ic(Receipt)} title="Expense" chevron onClick={() => { setMoreOpen(false); setModal({ type: "addExpense", hobbyId: hobby.id }); }} />
          {custom.map((c) => <Row key={c.id} icon={ic(NotebookPen)} title={c.label} chevron onClick={() => { setMoreOpen(false); setModal({ type: "log", action: "custom", customLogId: c.id, hobbyIdOverride: hobby.id }); }} />)}
          <Row icon={ic(Hexagon)} title="Add a hive" chevron onClick={() => { setMoreOpen(false); act.addHive(); }} />
          <Row icon={<Plus size={20} strokeWidth={2} />} title="Make a custom log button" chevron onClick={() => { setMoreOpen(false); setModal({ type: "customLogPicker", hobbyId: hobby.id }); }} />
        </Card>
      </Sheet>
    </div>
  );
}

// "Which hive?" when a log is started without one.
export function HivePicker({ open, onClose, hives, entries, action, onPick }) {
  const today = isoDay();
  return (
    <Sheet open={open} onClose={onClose} label="Which hive?" showClose>
      <h2 style={{ margin: "0 4px 10px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>{LABEL[action] || "Log"}: which hive?</h2>
      <Card>
        {(hives || []).map((h, i) => {
          const f = hiveFacts(h, entries, today);
          const st = status(f);
          return <Row key={h.id} first={i === 0} icon={ic(Hexagon)} title={h.name} sub={[h.type, h.location].filter(Boolean).join(" · ")} trailing={st ? <Badge tone={st.tone}>{st.text}</Badge> : null} onClick={() => onPick(h.id)} chevron />;
        })}
      </Card>
    </Sheet>
  );
}

// ── Hives list ──────────────────────────────────────────────────────────────
export function BeeHives({ hobby, data, act }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const hives = hobby.hives || [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card>
        {hives.map((h, i) => {
          const f = hiveFacts(h, entries, today);
          const st = status(f);
          return <Row key={h.id} first={i === 0} icon={ic(f.lost ? Skull : Hexagon)} iconBg={f.lost ? nl.alertChip : nl.yolkTint} title={h.name}
            sub={[h.type, h.installDate ? `since ${prettyDay(h.installDate)} ${h.installDate.slice(0, 4)}` : null, f.honey ? `${fmtWeight(f.honey)} honey` : null].filter(Boolean).join(" · ")}
            trailing={st ? <Badge tone={st.tone}>{st.text}</Badge> : null} onClick={() => act.openHive(h.id)} chevron />;
        })}
        <Row first={!hives.length} icon={<Plus size={20} strokeWidth={2} />} title="Add a hive" onClick={act.addHive} chevron />
      </Card>
    </div>
  );
}

// ── One hive ────────────────────────────────────────────────────────────────
export function BeeHive({ hobby, data, hive, act, onBack }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const f = hiveFacts(hive, entries, today);
  const st = status(f);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const inspections = f.es.filter((e) => e.action === "inspect").length;
  const jars = f.es.filter((e) => e.action === "harvest").reduce((s, e) => s + (Number(e.jars) || 0), 0);
  const cost = f.es.filter((e) => ["feed", "treatment", "infrastructure"].includes(e.action)).reduce((s, e) => s + (Number(e.cost) || 0), 0) + (Number(hive.purchaseCost) || 0);
  const li = f.lastInspect;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: -10 }}>
        <button type="button" aria-label="Back to hives" onClick={onBack} style={{ width: 44, height: 44, border: "none", background: "none", cursor: "pointer", color: nl.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
        <span style={{ flex: 1 }} />
        <Button kind="link" icon={<Pencil size={15} />} onClick={() => act.editHive(hive)}>Edit</Button>
      </div>
      <div>
        <h1 style={{ margin: 0, fontFamily: font.display, fontWeight: 400, fontSize: type.title, lineHeight: 1.1 }}>{hive.name}</h1>
        <div style={{ fontSize: type.small, color: nl.soft, marginTop: 2 }}>{[hive.type, hive.source, hive.installDate ? `since ${dayYear(hive.installDate)}` : null, hive.location].filter(Boolean).join(" · ")}</div>
        {st && <div style={{ marginTop: 6 }}><Badge tone={st.tone}>{st.text}</Badge></div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {[["Honey", f.honey ? fmtWeight(f.honey) : "—"], ["Inspections", String(inspections)], ["Mite test", f.lastMite ? `${Number(f.lastMite.varroaCount).toFixed(1)}%` : "—"]].map(([k, v]) => (
          <Card key={k} padded style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 12, color: nl.soft }}>{k}</div>
            <div style={{ fontFamily: font.display, fontSize: 22, lineHeight: 1.15, color: k === "Mite test" && f.lastMite && Number(f.lastMite.varroaCount) >= 3 ? nl.alert : nl.ink }}>{v}</div>
          </Card>
        ))}
      </div>
      {!f.lost && (
        <div style={{ display: "flex", gap: 8 }}>
          {[...BEE_ACTIONS.slice(0, 3), { action: "more", label: "More", icon: MoreHorizontal }].map((q) => (
            <button key={q.action} type="button" onClick={() => (q.action === "more" ? setMoreOpen(true) : act.log(q.action, hive.id))} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 0", minHeight: 68,
              borderRadius: 16, background: q.action === "inspect" ? nl.yolk : nl.card, border: `1px solid ${q.action === "inspect" ? nl.yolk : nl.line}`, cursor: "pointer", color: q.action === "inspect" ? nl.onYolk : nl.ink, font: `600 12px ${font.body}`,
            }}><q.icon size={22} strokeWidth={1.8} aria-hidden="true" />{q.label}</button>
          ))}
        </div>
      )}
      {li && (
        <Card padded>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Last inspection · {prettyDay(li.date)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px 12px", marginTop: 10, fontSize: 14 }}>
            {[["Queen", li.queenSeen ? "Seen" : "Not seen"], ["Brood", li.broodPattern], ["Population", li.population], ["Stores", li.honeyStores], ["Temper", li.temperament], ["Queen cells", li.swarmCells ? "Swarm cells" : li.supersedureCells ? "Supersedure" : "None"]].filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><div style={{ fontSize: 12, color: nl.soft }}>{k}</div><div style={{ fontWeight: 600 }}>{v}</div></div>
            ))}
          </div>
          {li.note && <div style={{ fontSize: 13, color: nl.soft, marginTop: 10, lineHeight: 1.45 }}>{li.note}</div>}
        </Card>
      )}
      <Card>
        <CardHeader title="Logs" right={f.es.length > 6 ? <Button kind="link" onClick={() => setShowAll((v) => !v)}>{showAll ? "Fewer" : `All (${f.es.length})`}</Button> : null} />
        {f.es.length ? (showAll ? f.es : f.es.slice(0, 6)).map((e) => { const I = ICON[e.action] || NotebookPen; return <Row key={e.id} icon={ic(I)} title={entryText(e)} sub={`${LABEL[e.action] || "Log"} · ${dayYear(e.date)}`} onClick={() => act.editEntry(e, hive.id)} chevron />; })
          : <div style={{ padding: "2px 14px 14px", fontSize: 14, color: nl.soft }}>Nothing logged for this hive yet.</div>}
      </Card>
      <Card>
        <Row first icon={ic(Receipt)} title={`Spent on this hive: ${fmtMoney(cost)}`} sub={jars ? `${jars} jars of honey so far` : "Bees, feed, treatments and equipment"} />
        <Row icon={<Trash2 size={20} strokeWidth={1.8} color={nl.alert} />} title="Delete this hive" sub="Removes the hive and its logs. You can undo right after." onClick={() => act.deleteHive(hive)} />
      </Card>
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} label={`More logs for ${hive.name}`} showClose>
        <h2 style={{ margin: "0 4px 10px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>Log for {hive.name}</h2>
        <Card>{BEE_ACTIONS.slice(3).map((a, i) => <Row key={a.action} first={i === 0} icon={ic(a.icon)} title={a.label} chevron onClick={() => { setMoreOpen(false); act.log(a.action, hive.id); }} />)}</Card>
      </Sheet>
    </div>
  );
}

// ── Stats ───────────────────────────────────────────────────────────────────
const FACT_ICONS = { jar: ShoppingBasket, trophy: Trophy, plane: Plane, bug: Bug };

export function BeeStats({ hobby, data, setModal, allNumbers }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const hives = hobby.hives || [];
  const [rk, setRk] = useState("year");
  const year = today.slice(0, 4);
  const inR = (e) => e && e.date && (rk === "all" || String(e.date).startsWith(year));
  const s = useMemo(() => {
    const es = entries.filter(inR);
    const h = es.filter((e) => e.action === "harvest");
    return {
      lbs: h.reduce((t, e) => t + (Number(e.lbs) || 0), 0), jars: h.reduce((t, e) => t + (Number(e.jars) || 0), 0),
      revenue: h.reduce((t, e) => t + (Number(e.revenue) || 0), 0),
      cost: es.filter((e) => ["feed", "treatment", "infrastructure"].includes(e.action)).reduce((t, e) => t + (Number(e.cost) || 0), 0),
      inspections: es.filter((e) => e.action === "inspect").length, tests: es.filter((e) => e.action === "varroa"),
    };
  }, [entries, rk]); // eslint-disable-line react-hooks/exhaustive-deps
  const byHive = hives.map((h) => ({ h, lbs: entries.filter((e) => inR(e) && e.hiveId === h.id && e.action === "harvest").reduce((t, e) => t + (Number(e.lbs) || 0), 0) })).filter((x) => x.lbs > 0).sort((a, b) => b.lbs - a.lbs);
  const top = Math.max(1, ...byHive.map((x) => x.lbs));
  const facts = [];
  if (s.lbs >= 1) facts.push({ key: "miles", icon: "plane", big: `${Math.round(s.lbs * 55000).toLocaleString("en-US")} mi`, line: "flown by our bees for this honey", title: `Your bees flew about ${Math.round(s.lbs * 55000).toLocaleString("en-US")} miles`, sub: "Bees fly roughly 55,000 miles for each pound of honey." });
  if (s.lbs >= 5) facts.push({ key: "jars", icon: "jar", big: String(s.jars || Math.round(s.lbs)), line: s.jars ? "jars of our own honey" : "pounds of our own honey", title: s.jars ? `${s.jars} jars of honey` : `${Math.round(s.lbs)} lbs of honey`, sub: "Straight from your hives." });
  if (byHive.length > 1) facts.push({ key: "top", icon: "trophy", big: byHive[0].h.name, line: "our best hive", title: `${byHive[0].h.name} made the most honey`, sub: `${fmtWeight(byHive[0].lbs)} of the total.` });
  if (s.tests.length >= 3) facts.push({ key: "tests", icon: "bug", big: String(s.tests.length), line: "mite tests done", title: `${s.tests.length} mite tests`, sub: "Testing is the best thing you can do for your bees." });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <RangeChips options={[{ key: "year", label: year }, { key: "all", label: "All time" }]} value={rk} onPick={setRk} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <Card padded>
          <div style={{ fontSize: type.small, color: nl.soft }}>Honey</div>
          <div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1 }}>{s.lbs ? fmtWeight(s.lbs) : "—"}</div>
          <div style={{ fontSize: 12, color: nl.soft }}>{s.jars ? `${s.jars} jars` : `${s.inspections} inspections`}</div>
        </Card>
        <Card padded>
          <div style={{ fontSize: type.small, color: nl.soft }}>{s.revenue ? "Honey sales" : "Spent"}</div>
          <div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1 }}>{fmtMoney(s.revenue || s.cost)}</div>
          <div style={{ fontSize: 12, color: nl.soft }}>{s.revenue ? `${fmtMoney(s.cost)} on feed, treatments, gear` : "Feed, treatments and equipment"}</div>
        </Card>
      </div>
      <FactCarousel facts={facts} icons={FACT_ICONS} label="Bee fun facts, swipe for more"
        onShare={(f) => setModal({ type: "shareCard", card: factCard({ ...f, kind: `bee_fact_${f.key}` }, data, { emoji: "🐝", kicker: "Our bees" }) })} />
      {byHive.length > 0 && (
        <Card>
          <CardHeader title="Honey by hive" />
          {byHive.map(({ h, lbs }) => (
            <div key={h.id} style={{ padding: "8px 14px 10px", borderTop: `1px solid ${nl.rule}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ fontWeight: 600 }}>{h.name}</span><span>{fmtWeight(lbs)}</span></div>
              <div style={{ height: 8, borderRadius: 4, background: nl.chip, marginTop: 6, overflow: "hidden" }}><div style={{ height: "100%", width: `${(lbs / top) * 100}%`, background: nl.yolk }} /></div>
            </div>
          ))}
        </Card>
      )}
      <AllNumbers label="All the numbers: honey, inspections, mites, losses, costs">{allNumbers}</AllNumbers>
    </div>
  );
}
