// ============================================================================
// Rabbits (3.0) — Today · Rabbits · one rabbit · Stats
// ----------------------------------------------------------------------------
// Today: kindlings coming up (with the nest-box day), litters still nursing,
// quick logs, feed supply, latest logs. Rabbits: grouped by hutch when you
// use hutches (else Does / Bucks / Growers / Pets), one status each, herd
// count, litter history, past rabbits. One rabbit: weight, litters,
// breeding, health, hutch, family tree, history. Stats: litters, kits, meat,
// fun facts and the old analytics under "All the numbers".
// The forms are the rabbit page's own, opened through `act` (RabbitsNewLook
// in Rabbits.jsx).
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  Wheat, Heart, Baby, MoreHorizontal, Scale, Stethoscope, NotebookPen, Receipt, Plus, Users, Snowflake,
  BookOpen, ChevronLeft, GitBranch, History, Pencil, Archive, Home as HutchIcon, Rabbit, Trophy, Utensils, Box,
} from "lucide-react";
import { nl, font, type } from "../theme.js";
import { Card, CardHeader, Row, Badge, Button, Chip, Sheet } from "../ui.jsx";
import FeedCard from "../FeedCard.jsx";
import { Avatar } from "../eggs/EggBirds.jsx";
import { RangeChips, FactCarousel, factCard, AllNumbers } from "../StatsParts.jsx";
import { fmtWeight, fmtMoney } from "../../units.js";
import { isoDay, prettyDay } from "../eggs/eggFacts.js";
import {
  KINDLE_DAYS, liveRabbits, forAnimal, openBred, rabbitStatus, ageText, GROUPS, upcomingKindles,
  nursingLitters, litterHistory, rabbitSummary, daysFrom,
} from "./rabbitData.js";

const ic = (I) => <I size={20} strokeWidth={1.8} />;
const dayYear = (s) => (s ? `${prettyDay(s)}, ${s.slice(0, 4)}` : "");

function entryLine(e) {
  const who = e.animalName || "";
  switch (e.action) {
    case "fed": return { icon: Wheat, title: `Fed${Number(e.lbs) > 0 ? ` ${fmtWeight(Number(e.lbs))}` : ""}${Number(e.cost) > 0 ? ` · ${fmtMoney(e.cost)}` : ""}` };
    case "bred": return { icon: Heart, title: `${who || "Doe"} bred${e.buckName ? ` to ${e.buckName}` : ""}` };
    case "litter": return { icon: Baby, title: `${who || "Doe"} kindled ${Number(e.kitsAlive) || 0} kits` };
    case "weight": return { icon: Scale, title: `${who || "Rabbit"} weighed ${fmtWeight(Number(e.weight) || 0)}` };
    case "health": return { icon: Stethoscope, title: `${who ? `${who}: ` : ""}${e.notes || "Health"}` };
    case "butcher": return { icon: Snowflake, title: `Butchered ${e.count != null ? `${e.count}` : who || "a rabbit"}` };
    case "note": return { icon: NotebookPen, title: e.notes || e.note || "Note" };
    default: return { icon: NotebookPen, title: e.customLabel || e.notes || e.note || "Log" };
  }
}

// ── Today ───────────────────────────────────────────────────────────────────
export function RabbitToday({ hobby, data, update, setModal, act, tallyTotal = 0, onOpenJournal, onOpenCalendar }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const live = liveRabbits(hobby);
  const [moreOpen, setMoreOpen] = useState(false);
  const custom = Array.isArray(hobby.customLogs) ? hobby.customLogs : [];

  if (!live.length && !tallyTotal) {
    return (
      <div style={{ textAlign: "center", padding: "28px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ width: 96, height: 96, borderRadius: 48, background: nl.yolkTint, display: "flex", alignItems: "center", justifyContent: "center" }}><Rabbit size={48} strokeWidth={1.6} /></div>
        <h2 style={{ margin: "6px 0 0", fontFamily: font.display, fontWeight: 400, fontSize: 26 }}>Add your first rabbit</h2>
        <p style={{ margin: 0, fontSize: 15, color: nl.soft, lineHeight: 1.45 }}>Add your does and bucks to track breeding, litters and growth. Just want a head count? Count them instead.</p>
        <Button onClick={act.addRabbit} style={{ width: "100%", marginTop: 8 }}>Add a rabbit</Button>
        <Button kind="quiet" onClick={act.herdCount} style={{ width: "100%" }}>Count them instead</Button>
      </div>
    );
  }

  const coming = upcomingKindles(hobby, entries, today);
  const nursing = nursingLitters(hobby, entries, today).slice(0, 3);
  const recent = forAnimal(entries, null, null).slice(0, 4);
  const does = live.filter((a) => a.sex === "Doe").length;
  const bucks = live.filter((a) => a.sex === "Buck").length;
  const quick = [
    { key: "fed", label: "Fed", icon: Wheat, run: act.fed },
    { key: "bred", label: "Bred", icon: Heart, run: () => act.bred() },
    { key: "litter", label: "Litter", icon: Baby, run: () => act.litter() },
    { key: "more", label: "More", icon: MoreHorizontal, run: () => setMoreOpen(true) },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card padded>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: font.display, fontSize: 40, lineHeight: 1 }}>{live.length + tallyTotal}</span>
          <span style={{ fontSize: 14, color: nl.soft }}>{live.length + tallyTotal === 1 ? "rabbit" : "rabbits"}{does || bucks ? ` · ${does} doe${does === 1 ? "" : "s"}, ${bucks} buck${bucks === 1 ? "" : "s"}` : ""}{tallyTotal ? ` · ${tallyTotal} counted` : ""}</span>
        </div>
      </Card>

      <div style={{ display: "flex", gap: 8 }}>
        {quick.map((q) => (
          <button key={q.key} type="button" onClick={q.run} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 0", minHeight: 68,
            borderRadius: 16, background: nl.card, border: `1px solid ${nl.line}`, cursor: "pointer", color: nl.ink, font: `600 12px ${font.body}`,
          }}><q.icon size={22} strokeWidth={1.8} aria-hidden="true" />{q.label}</button>
        ))}
      </div>

      {(coming.length > 0 || nursing.length > 0) && (
        <Card>
          <CardHeader title="Coming up" right={onOpenCalendar ? <Button kind="link" onClick={onOpenCalendar}>Calendar</Button> : null} />
          {coming.map(({ doe, bred, day, left, nestBox }) => (
            <button key={bred.id} type="button" onClick={() => act.openProfile(doe.id)} style={{
              display: "flex", flexDirection: "column", gap: 8, width: "100%", padding: "10px 14px 12px", border: "none", borderTop: `1px solid ${nl.rule}`,
              textAlign: "left", background: "transparent", color: nl.ink, font: "inherit", cursor: "pointer",
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: nl.yolkTint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{ic(Baby)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: type.body, fontWeight: 600 }}>{doe.name} {left < 0 ? "is past her kindle date" : left === 0 ? "kindles today" : `kindles ${prettyDay(bred.kindleDate)}`}</span>
                  <span style={{ display: "block", fontSize: type.small, color: nl.soft }}>
                    {left > 3 ? `Nest box in by ${prettyDay(nestBox)}` : left >= 0 ? "Nest box should be in now" : `Due ${prettyDay(bred.kindleDate)}`}{bred.buckName ? ` · bred to ${bred.buckName}` : ""}
                  </span>
                </span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ flex: 1, height: 8, borderRadius: 4, background: nl.chip, overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${Math.round((day / KINDLE_DAYS) * 100)}%`, background: nl.yolk }} />
                </span>
                <span style={{ fontSize: 12, color: nl.soft, flexShrink: 0 }}>day {day} of {KINDLE_DAYS}</span>
              </span>
            </button>
          ))}
          {nursing.map(({ litter, doe, week, weanOn }) => (
            <Row key={litter.id} icon={ic(Rabbit)} iconBg={nl.goodTint} title={`${doe}'s litter · ${Number(litter.kitsAlive) || 0} kits`}
              sub={`Week ${week} · wean around ${prettyDay(weanOn)}`} onClick={litter.animalId ? () => act.openProfile(litter.animalId) : undefined} chevron={!!litter.animalId} />
          ))}
        </Card>
      )}

      <FeedCard hobby={hobby} entries={entries} update={update} setModal={setModal} eatWord="your rabbits eat" />

      <Card>
        {recent.length > 0 && <CardHeader title="Latest" />}
        {recent.map((e) => { const l = entryLine(e); return <Row key={e.id} icon={ic(l.icon)} title={l.title} sub={e.date === today ? "Today" : prettyDay(e.date)} />; })}
        <Row first={!recent.length} icon={ic(BookOpen)} title="Everything you've logged" sub="Edit or delete past entries in the Journal" onClick={onOpenJournal} chevron />
      </Card>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} label="More rabbit logs" showClose>
        <h2 style={{ margin: "0 4px 10px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>Log something else</h2>
        <Card>
          {[
            ["weight", "Weight", Scale, () => act.weight()],
            ["health", "Health", Stethoscope, () => act.health()],
            ["note", "Note", NotebookPen, () => act.note()],
            ["expense", "Expense", Receipt, () => setModal({ type: "addExpense", hobbyId: hobby.id })],
          ].map(([k, label, I, run], i) => <Row key={k} first={i === 0} icon={ic(I)} title={label} chevron onClick={() => { setMoreOpen(false); run(); }} />)}
          {custom.map((c) => <Row key={c.id} icon={ic(NotebookPen)} title={c.label} chevron
            onClick={() => { setMoreOpen(false); setModal({ type: "log", action: "custom", customLogId: c.id, hobbyIdOverride: hobby.id }); }} />)}
          <Row icon={ic(Users)} title="Herd count" sub="Rabbits you count but don't name" chevron onClick={() => { setMoreOpen(false); act.herdCount(); }} />
          {live.length > 0 && <Row icon={ic(Snowflake)} title="Remove rabbits" sub="Butchered, sold or died" chevron onClick={() => { setMoreOpen(false); act.remove(); }} />}
          <Row icon={<Plus size={20} strokeWidth={2} />} title="Make a custom log button" chevron onClick={() => { setMoreOpen(false); setModal({ type: "customLogPicker", hobbyId: hobby.id }); }} />
        </Card>
      </Sheet>
    </div>
  );
}

// ── Rabbits list ────────────────────────────────────────────────────────────
export function RabbitHerd({ hobby, data, act, tallyTotal = 0, tallyLine = "" }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const live = liveRabbits(hobby).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const archived = (hobby.animals || []).filter((a) => a && a.archived);
  const hutches = [...new Set(live.map((a) => (a.hutch || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const groups = GROUPS.map((g) => ({ ...g, n: live.filter(g.test).length })).filter((g) => g.n);
  const [sel, setSel] = useState("all");
  const [showPast, setShowPast] = useState(false);
  const [allLitters, setAllLitters] = useState(false);
  const history = litterHistory(hobby, entries);
  const g = GROUPS.find((x) => x.key === sel);
  const shown = live.filter((a) => !g || g.test(a));

  const row = (a, i, showHutch) => {
    const st = rabbitStatus(entries, a, today);
    return (
      <Row key={a.id} first={i === 0} icon={<Avatar bird={a} />} iconBg="transparent" title={a.name}
        sub={[a.breed, ageText(a.birthdate, today), showHutch && a.hutch ? a.hutch : null].filter(Boolean).join(" · ") || a.sex || "Rabbit"}
        trailing={st ? <Badge tone={st.tone}>{st.text}</Badge> : null} onClick={() => act.openProfile(a.id)} chevron />
    );
  };
  const byHutch = hutches.length >= 2 && sel === "all";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {groups.length > 1 && (
        <div role="group" aria-label="Show" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -20px", padding: "0 20px", scrollbarWidth: "none" }}>
          <Chip selected={sel === "all"} onClick={() => setSel("all")}>{byHutch || hutches.length >= 2 ? "By hutch" : "All"} · {live.length}</Chip>
          {groups.map((x) => <Chip key={x.key} selected={sel === x.key} onClick={() => setSel(x.key)}>{x.label} · {x.n}</Chip>)}
        </div>
      )}

      {byHutch ? (
        <>
          {[...hutches, ""].map((h) => {
            const list = live.filter((a) => (a.hutch || "").trim() === h);
            if (!list.length) return null;
            return (
              <Card key={h || "_none"}>
                <CardHeader title={h || "No hutch yet"} right={`${list.length}`} />
                {list.map((a) => row(a, 1, false))}
              </Card>
            );
          })}
          <Card><Row first icon={<Plus size={20} strokeWidth={2} />} title="Add a rabbit" onClick={act.addRabbit} chevron /></Card>
        </>
      ) : (
        <Card>
          {shown.map((a, i) => row(a, i, true))}
          <Row first={!shown.length} icon={<Plus size={20} strokeWidth={2} />} title="Add a rabbit" onClick={act.addRabbit} chevron />
        </Card>
      )}

      <Card>
        <Row first icon={ic(Users)} title={tallyTotal ? `Herd count · ${tallyTotal}` : "Count rabbits you don't name"}
          sub={tallyTotal ? tallyLine : "A head count of growers or a colony, separate from named rabbits"} onClick={act.herdCount} chevron />
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader title="Litters" right={history.length > 3 ? <Button kind="link" onClick={() => setAllLitters((v) => !v)}>{allLitters ? "Fewer" : `All (${history.length})`}</Button> : null} />
          {(allLitters ? history : history.slice(0, 3)).map((h) => <Row key={h.id} icon={ic(Baby)} title={`${h.doe} · ${dayYear(h.date)}`} sub={h.sub} />)}
        </Card>
      )}

      {archived.length > 0 && (
        <Card>
          <Row first icon={ic(Archive)} title={`Past rabbits (${archived.length})`} sub="Butchered, sold or died. Tap one to restore it." onClick={() => setShowPast((v) => !v)} chevron />
          {showPast && archived.map((a) => (
            <Row key={a.id} icon={<Avatar bird={a} size={36} />} iconBg="transparent" title={a.name}
              sub={[a.archivedReason || "Archived", a.archivedDate ? prettyDay(a.archivedDate) : null].filter(Boolean).join(" · ")} onClick={() => act.editRabbit(a.id)} chevron />
          ))}
        </Card>
      )}
    </div>
  );
}

// ── One rabbit ──────────────────────────────────────────────────────────────
export function RabbitProfile({ hobby, data, rabbit: r, act, onBack }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const st = rabbitStatus(entries, r, today);
  const doe = r.sex === "Doe";
  const weights = forAnimal(entries, "weight", r.id);
  const health = forAnimal(entries, "health", r.id).slice(0, 3);
  const litters = doe ? forAnimal(entries, "litter", r.id) : (entries || []).filter((e) => e && e.action === "litter" && (e.sireId === r.id || e.buckId === r.id));
  const kits = litters.reduce((s, l) => s + (Number(l.kitsAlive) || 0), 0);
  const bred = doe ? openBred(entries, r.id, today) : null;
  const lastBred = forAnimal(entries, "bred", r.id)[0] || (!doe ? (entries || []).filter((e) => e && e.action === "bred" && e.buckId === r.id).sort((a, b) => (a.date < b.date ? 1 : -1))[0] : null);
  const animals = hobby.animals || [];
  const nameOf = (id) => (animals.find((a) => a.id === id) || {}).name;
  const sire = nameOf(r.sireId) || r.sireName || null;
  const dam = nameOf(r.damId) || r.damName || null;
  const role = { doe: "breeding doe", buck: "breeding buck", kit: "kit", grower: "grower", pet: "pet" }[r.role] || (r.sex || "").toLowerCase();
  const stats = [
    ["Age", ageText(r.birthdate, today) || "—"],
    [doe ? "Litters" : "Sired", doe ? String(litters.length) : `${kits} kits`],
    ["Weight", weights[0] ? fmtWeight(Number(weights[0].weight) || 0) : "—"],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: -10 }}>
        <button type="button" aria-label="Back to rabbits" onClick={onBack} style={{ width: 44, height: 44, border: "none", background: "none", cursor: "pointer", color: nl.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
        <span style={{ flex: 1 }} />
        <Button kind="link" icon={<Pencil size={15} />} onClick={() => act.editRabbit(r.id)}>Edit</Button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar bird={r} size={68} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontFamily: font.display, fontWeight: 400, fontSize: type.title, lineHeight: 1.1 }}>{r.name}</h1>
          <div style={{ fontSize: type.small, color: nl.soft, marginTop: 2 }}>
            {[[r.breed, role].filter(Boolean).join(" "), r.birthdate ? `born ${dayYear(r.birthdate)}` : null].filter(Boolean).join(" · ")}
          </div>
          {st && <div style={{ marginTop: 6 }}><Badge tone={st.tone}>{st.text}</Badge></div>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {stats.map(([k, v]) => (
          <Card key={k} padded style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 12, color: nl.soft }}>{k}</div>
            <div style={{ fontFamily: font.display, fontSize: 22, lineHeight: 1.15, overflowWrap: "anywhere" }}>{v}</div>
          </Card>
        ))}
      </div>

      {(doe || r.sex === "Buck") && (
        <Card>
          <CardHeader title="Breeding & litters" right={<span style={{ display: "flex", gap: 12 }}><Button kind="link" onClick={() => act.bred(doe ? r.id : null)}>Bred</Button>{doe && <Button kind="link" onClick={() => act.litter(r.id)}>Litter</Button>}</span>} />
          {bred && <Row icon={ic(Heart)} title={`Kindles ${dayYear(bred.kindleDate)}`} sub={[`Bred ${prettyDay(bred.date)}`, bred.buckName ? `to ${bred.buckName}` : null, daysFrom(today, bred.kindleDate) > 3 ? `nest box in by ${prettyDay(isoDay(new Date(new Date(bred.kindleDate + "T12:00").getTime() - 3 * 864e5)))}` : null].filter(Boolean).join(" · ")} />}
          {!bred && lastBred && <Row icon={ic(Heart)} title={`Last bred ${dayYear(lastBred.date)}`} sub={doe ? (lastBred.buckName ? `to ${lastBred.buckName}` : "") : lastBred.animalName ? `to ${lastBred.animalName}` : ""} />}
          <Row icon={ic(Baby)} title={litters[0] ? `${doe ? "Last litter" : "Last sired"} ${dayYear(litters[0].date)}` : doe ? "No litters yet" : "No litters sired yet"}
            sub={litters.length ? `${litters.length} litter${litters.length === 1 ? "" : "s"} · ${kits} kits alive${litters.length ? ` · ${(kits / litters.length).toFixed(1)} a litter` : ""}` : doe ? "Log one when she kindles" : ""} />
        </Card>
      )}

      <Card>
        <CardHeader title="Health" right={<Button kind="link" onClick={() => act.health(r.id)}>Log</Button>} />
        {health.length ? health.map((e) => <Row key={e.id} icon={ic(Stethoscope)} title={e.notes || "Health note"} sub={dayYear(e.date)} />)
          : <div style={{ padding: "2px 14px 14px", fontSize: 14, color: nl.soft }}>Treatments and vet visits show up here.</div>}
        <Row icon={ic(Scale)} title={weights[0] ? `Weighed ${fmtWeight(Number(weights[0].weight) || 0)}` : "Log a weight"}
          sub={weights[0] ? `${dayYear(weights[0].date)}${weights[1] ? ` · was ${fmtWeight(Number(weights[1].weight) || 0)} on ${prettyDay(weights[1].date)}` : ""}` : "Track growth over time"} onClick={() => act.weight(r.id)} chevron />
      </Card>

      <Card>
        <Row first icon={ic(HutchIcon)} title={r.hutch ? `Hutch: ${r.hutch}` : "Not in a hutch yet"} sub="Move to another hutch" onClick={() => act.move(r.id)} chevron />
        <Row icon={ic(GitBranch)} title="Family tree" sub={[sire ? `Sire ${sire}` : null, dam ? `dam ${dam}` : null].filter(Boolean).join(" · ") || "Add parents when you edit"} onClick={() => act.pedigree(r)} chevron />
        <Row icon={ic(History)} title="Full history" sub="Every log, photo and sale for this rabbit" onClick={() => act.history(r)} chevron />
        <Row icon={ic(NotebookPen)} title="Add a note" onClick={() => act.note(r.id)} chevron />
      </Card>
      {r.notes && <div style={{ fontSize: 14, color: nl.soft, padding: "0 4px", lineHeight: 1.45 }}>{r.notes}</div>}
    </div>
  );
}

// ── Stats ───────────────────────────────────────────────────────────────────
const FACT_ICONS = { baby: Baby, trophy: Trophy, meals: Utensils, box: Box };

export function RabbitStats({ hobby, data, setModal, allNumbers }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const [rk, setRk] = useState("year");
  const year = today.slice(0, 4);
  const r = rk === "year" ? { start: `${year}-01-01`, end: today } : { start: null, end: today };
  const s = useMemo(() => rabbitSummary(entries, r), [entries, rk]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = (id) => ((hobby.animals || []).find((a) => a.id === id) || {}).name;
  const byDoe = useMemo(() => {
    const m = new Map();
    for (const e of entries) {
      if (!e || e.action !== "litter" || !e.animalId || (r.start && e.date < r.start)) continue;
      const g = m.get(e.animalId) || { id: e.animalId, name: name(e.animalId) || e.animalName || "Doe", litters: 0, kits: 0 };
      g.litters += 1; g.kits += Number(e.kitsAlive) || 0; m.set(e.animalId, g);
    }
    return [...m.values()].sort((a, b) => b.kits - a.kits);
  }, [entries, rk]); // eslint-disable-line react-hooks/exhaustive-deps
  const top = Math.max(1, ...byDoe.map((d) => d.kits));

  const facts = [];
  if (s.kits >= 4) facts.push({ key: "kits", icon: "baby", big: String(s.kits), line: "kits born on our homestead", title: `${s.kits} kits born`, sub: s.avgLitter ? `${s.avgLitter.toFixed(1)} a litter on average.` : "" });
  if (byDoe.length > 1) facts.push({ key: "topdoe", icon: "trophy", big: byDoe[0].name, line: "our best mama rabbit", title: `${byDoe[0].name} is your best mama`, sub: `${byDoe[0].kits} kits in ${byDoe[0].litters} litter${byDoe[0].litters === 1 ? "" : "s"}.` });
  if (s.lbs >= 5) facts.push({ key: "meals", icon: "meals", big: Math.round(s.lbs * 2).toLocaleString("en-US"), line: "family dinners from our rabbits", title: `About ${Math.round(s.lbs * 2)} family dinners`, sub: `${fmtWeight(s.lbs)} of meat at half a pound a plate.` });
  if (s.bred >= 3 && s.litters) facts.push({ key: "success", icon: "box", big: `${Math.min(100, Math.round((s.litters / s.bred) * 100))}%`, line: "of breedings became litters", title: `${Math.min(100, Math.round((s.litters / s.bred) * 100))}% of breedings took`, sub: `${s.litters} litters from ${s.bred} breedings.` });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <RangeChips options={[{ key: "year", label: year }, { key: "all", label: "All time" }]} value={rk} onPick={setRk} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <Card padded>
          <div style={{ fontSize: type.small, color: nl.soft }}>Kits born alive</div>
          <div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1 }}>{s.kits}</div>
          <div style={{ fontSize: 12, color: nl.soft }}>{s.litters ? `${s.litters} litter${s.litters === 1 ? "" : "s"} · ${s.avgLitter.toFixed(1)} each` : "Log a litter to see this"}</div>
        </Card>
        <Card padded>
          <div style={{ fontSize: type.small, color: nl.soft }}>{s.lbs ? "Meat" : "Spent"}</div>
          <div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1 }}>{s.lbs ? fmtWeight(s.lbs) : fmtMoney(s.cost)}</div>
          <div style={{ fontSize: 12, color: nl.soft }}>{s.lbs ? (s.cost ? `${fmtMoney(s.cost / s.lbs)} a pound` : `${s.butchered} rabbits`) : "Feed and builds"}</div>
        </Card>
      </div>
      <FactCarousel facts={facts} icons={FACT_ICONS} label="Rabbit fun facts, swipe for more"
        onShare={(f) => setModal({ type: "shareCard", card: factCard({ ...f, kind: `rabbit_fact_${f.key}` }, data, { emoji: "🐇", kicker: "Our rabbitry" }) })} />
      {byDoe.length > 0 && (
        <Card>
          <CardHeader title="Kits by doe" right={rk === "year" ? year : "All time"} />
          {byDoe.map((d) => (
            <div key={d.id} style={{ padding: "8px 14px 10px", borderTop: `1px solid ${nl.rule}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ fontWeight: 600 }}>{d.name}</span><span>{d.kits} kits · {d.litters} litter{d.litters === 1 ? "" : "s"}</span></div>
              <div style={{ height: 8, borderRadius: 4, background: nl.chip, marginTop: 6, overflow: "hidden" }}><div style={{ height: "100%", width: `${(d.kits / top) * 100}%`, background: nl.good }} /></div>
            </div>
          ))}
        </Card>
      )}
      <AllNumbers label="All the numbers: breeding success, stillborn, meat, costs">{allNumbers}</AllNumbers>
    </div>
  );
}
