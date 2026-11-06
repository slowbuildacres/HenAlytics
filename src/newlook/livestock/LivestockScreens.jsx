// ============================================================================
// Livestock (3.0) — Today · Herd · one animal · Stats (goats and cattle)
// ----------------------------------------------------------------------------
// Today: milk today with a chip per milker, quick logs, births coming up
// with a gestation bar, feed supply and the latest logs. Herd: grouped by
// sex (or by pasture for cattle that use pastures), one status each, herd
// count, birth history, past animals. One animal: milk, weight, breeding,
// health, pasture, family tree, history. Stats: milk, cost per gallon, fun
// facts, milk by month and by animal, then every old number.
//
// `sp` (SPECIES in livestockData.js) supplies the words and rules. The log
// forms are each hobby's own, opened through `act` (GoatsNewLook in
// Goats.jsx, CowsNewLook in Cows.jsx).
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  Milk, Wheat, Stethoscope, Scale, MoreHorizontal, Heart, Baby, NotebookPen, Receipt, Snowflake, Plus,
  Users, BookOpen, ChevronLeft, GitBranch, History, Trophy, CalendarCheck, DollarSign, Archive, Pencil,
  Flame, Syringe, ClipboardCheck, MapPin, Fence, Utensils, Scissors,
} from "lucide-react";
import { nl, font, type } from "../theme.js";
import { Card, CardHeader, Row, Badge, Button, Chip, Sheet } from "../ui.jsx";
import HobbyGlyph from "../HobbyGlyph.jsx";
import FeedCard from "../FeedCard.jsx";
import { Avatar } from "../eggs/EggBirds.jsx";
import { RangeChips, FactCarousel, factCard, AllNumbers, MonthBars } from "../StatsParts.jsx";
import { fmtWeight, fmtMoney } from "../../units.js";
import { isoDay, prettyDay, parseDay, DAY } from "../eggs/eggFacts.js";
import {
  liveAnimals, milkers, showsMilk, milkOz, animalStatus, ageText, upcomingBirths, birthHistory, latest,
  lastBirth, openBreeding, allBreedings, sexOf, dobOf, groupFieldOf, groupListOf, milkByMonth, statsRange, herdSummary, milkByAnimal, herdFunFacts, isDairy, isFemale, milkText,
} from "./livestockData.js";

const ic = (I) => <I size={20} strokeWidth={1.8} />;
const gal = milkText;
const dayYear = (s) => (s ? `${prettyDay(s)}, ${s.slice(0, 4)}` : "");
const EXTRA_ICONS = { heat: Flame, ai: Syringe, preg_test: ClipboardCheck, shear: Scissors };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function entryLine(sp, e) {
  const who = e.animalName || "";
  switch (e.action) {
    case "milk": return { icon: Milk, title: `${gal(sp.milkOz(e))} milk${who ? ` · ${who}` : ""}` };
    case "fed": return { icon: Wheat, title: `Fed${Number(e.lbs) > 0 ? ` ${fmtWeight(Number(e.lbs))}` : ""}${Number(e.cost) > 0 ? ` · ${fmtMoney(e.cost)}` : ""}` };
    case "weight": return { icon: Scale, title: `${who || sp.noun} weighed ${fmtWeight(Number(e.weight) || 0)}` };
    case "health": return { icon: Stethoscope, title: `${who ? `${who}: ` : ""}${e.notes || "Health"}` };
    case sp.birthAction: return { icon: Baby, title: `${who || sp.she} had ${plural(Number(e.count) || 1, sp.young, sp.youngPlural)}` };
    case "heat": return { icon: Flame, title: `${who || sp.she} in heat` };
    case "ai": return { icon: Syringe, title: `${who || sp.she} bred by AI` };
    case "preg_test": return { icon: ClipboardCheck, title: `${who || sp.she} preg check${e.pregResult || e.result ? `: ${e.pregResult || e.result}` : ""}` };
    case "note": return { icon: NotebookPen, title: e.notes || "Note" };
    case "sale": return { icon: DollarSign, title: `Sold ${who || `a ${sp.noun}`}` };
    case "butcher": return { icon: Snowflake, title: `Butchered ${who || `a ${sp.noun}`}` };
    case "death": return { icon: Snowflake, title: `Lost ${who || `a ${sp.noun}`}` };
    default: return { icon: NotebookPen, title: e.label || e.customLabel || e.notes || "Log" };
  }
}

// ── Today ───────────────────────────────────────────────────────────────────
export function LivestockToday({ sp, hobby, data, update, setModal, act, tallyTotal = 0, onOpenJournal, onOpenCalendar }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const live = liveAnimals(hobby);
  const [moreOpen, setMoreOpen] = useState(false);
  const custom = Array.isArray(hobby.customLogs) ? hobby.customLogs : [];

  if (!live.length && !tallyTotal) {
    return (
      <div style={{ textAlign: "center", padding: "28px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ width: 96, height: 96, borderRadius: 48, background: nl.yolkTint, display: "flex", alignItems: "center", justifyContent: "center" }}><HobbyGlyph type={sp.key} size={48} /></div>
        <h2 style={{ margin: "6px 0 0", fontFamily: font.display, fontWeight: 400, fontSize: 26 }}>Add your first {sp.noun}</h2>
        <p style={{ margin: 0, fontSize: 15, color: nl.soft, lineHeight: 1.45 }}>Add each {sp.noun} by name to track {(sp.milkFor ? sp.milkFor(hobby) : sp.milk !== false) ? "milk" : "weights"}, {sp.birthNoun} and health. Just want a head count? Count the herd instead.</p>
        <Button onClick={act.addAnimal} style={{ width: "100%", marginTop: 8 }}>Add a {sp.noun}</Button>
        <Button kind="quiet" onClick={act.herdCount} style={{ width: "100%" }}>Count the herd instead</Button>
      </div>
    );
  }

  const ms = showsMilk(hobby, sp) ? milkers(sp, hobby) : [];
  const todayOz = milkOz(sp, entries, { from: today, to: today });
  const weekStart = isoDay(new Date(parseDay(today).getTime() - 6 * DAY));
  const weekOz = milkOz(sp, entries, { from: weekStart, to: today });
  const inMilk = ms.filter((a) => { const s = animalStatus(sp, hobby, entries, a, today); return s && s.tone === "good"; }).length;
  const coming = upcomingBirths(sp, hobby, today, 3, entries);
  const recent = latest(entries, null).slice(0, 4);
  const anyFemale = live.some((a) => isFemale(sp, a));

  const quick = [
    { key: "fed", label: "Fed", icon: Wheat, run: act.fed },
    { key: "health", label: "Health", icon: Stethoscope, run: () => act.health() },
    { key: "weight", label: "Weight", icon: Scale, run: () => act.weight() },
    { key: "more", label: "More", icon: MoreHorizontal, run: () => setMoreOpen(true) },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {ms.length > 0 && (
        <Card padded style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Milk today</div>
            <div style={{ fontSize: type.small, color: nl.soft }}>
              {[inMilk ? `${inMilk} ${inMilk === 1 ? sp.she : sp.shePlural} in milk` : null, weekOz ? `${gal(weekOz)} this week` : null].filter(Boolean).join(" · ") || "Nothing logged this week"}
            </div>
          </div>
          <div style={{ fontFamily: font.display, fontSize: 40, lineHeight: 1 }}>{todayOz ? gal(todayOz) : "None yet"}</div>
          <div role="group" aria-label={`Milk by ${sp.she} today. Tap one to log her milk.`} style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", margin: "0 -16px", padding: "0 16px" }}>
            {ms.map((a) => {
              const v = milkOz(sp, entries, { animalId: a.id, from: today, to: today });
              return (
                <button key={a.id} type="button" onClick={() => act.milk(a.id)} aria-label={`${a.name}: ${v ? gal(v) : "nothing yet"} today. Log her milk.`} style={{
                  flex: "0 0 auto", minWidth: 72, minHeight: 52, padding: "6px 12px", borderRadius: 14, cursor: "pointer", textAlign: "center",
                  background: v ? nl.goodTint : "transparent", border: v ? "none" : `1.5px dashed ${nl.navIdle}`, color: nl.ink, font: `400 12px ${font.body}`,
                }}>
                  <span style={{ display: "block", font: `700 15px ${font.body}`, color: v ? nl.goodInk : nl.soft }}>{v ? gal(v) : "–"}</span>
                  <span style={{ display: "block", color: nl.soft }}>{a.name}</span>
                </button>
              );
            })}
          </div>
          <Button icon={ic(Milk)} onClick={() => act.milk()}>Log a milking</Button>
        </Card>
      )}

      {!ms.length && (
        <Card padded>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontFamily: font.display, fontSize: 40, lineHeight: 1 }}>{live.length + tallyTotal}</span>
            <span style={{ fontSize: 14, color: nl.soft }}>
              {[live.length + tallyTotal === 1 ? sp.noun : sp.plural, sp.groups.map((g) => ({ g, n: live.filter((a) => sexOf(sp, a) === g.key).length })).filter((x) => x.n).map((x) => `${x.n} ${(x.n === 1 ? (sp.sexWord[x.g.key] || x.g.label) : x.g.label).toLowerCase()}`).join(", "), tallyTotal ? `${tallyTotal} counted` : null].filter(Boolean).join(" · ")}
            </span>
          </div>
        </Card>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {quick.map((q) => (
          <button key={q.key} type="button" onClick={q.run} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 0", minHeight: 68,
            borderRadius: 16, background: nl.card, border: `1px solid ${nl.line}`, cursor: "pointer", color: nl.ink, font: `600 12px ${font.body}`,
          }}><q.icon size={22} strokeWidth={1.8} aria-hidden="true" />{q.label}</button>
        ))}
      </div>

      {(coming.length > 0 || anyFemale) && (
        <Card>
          <CardHeader title="Coming up" right={onOpenCalendar ? <Button kind="link" onClick={onOpenCalendar}>Calendar</Button> : null} />
          {coming.length ? coming.map(({ breeding: b, dam, day, of, left }) => (
            <button key={b.id} type="button" onClick={() => act.breeding(b)} style={{
              display: "flex", flexDirection: "column", gap: 8, width: "100%", padding: "10px 14px 12px", border: "none", textAlign: "left",
              borderTop: `1px solid ${nl.rule}`, background: "transparent", color: nl.ink, font: "inherit", cursor: "pointer",
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: nl.yolkTint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{ic(Baby)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: type.body, fontWeight: 600 }}>{(dam && dam.name) || sp.she} {left < 0 ? "is past her due date" : `${sp.dueVerb} ${prettyDay(b.expectedBirthDate)}`}</span>
                  <span style={{ display: "block", fontSize: type.small, color: nl.soft }}>
                    {[b.breedDate ? `Bred ${prettyDay(b.breedDate)}` : null, left < 0 ? `due ${prettyDay(b.expectedBirthDate)}` : left === 0 ? "due today" : `${plural(left, "day", "days")} to go`].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </span>
              {day != null && (
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ flex: 1, height: 8, borderRadius: 4, background: nl.chip, overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", width: `${Math.round((day / of) * 100)}%`, background: nl.yolk }} />
                  </span>
                  <span style={{ fontSize: 12, color: nl.soft, flexShrink: 0 }}>day {day} of {of}</span>
                </span>
              )}
            </button>
          )) : (
            <Row icon={ic(Heart)} title="Record a breeding" sub={`We'll count down to ${sp.birthNoun} day`} onClick={() => act.breeding(null)} chevron />
          )}
        </Card>
      )}

      <FeedCard hobby={hobby} entries={entries} update={update} setModal={setModal} eatWord={`your ${sp.plural} eat`} />

      <Card>
        {recent.length > 0 && <CardHeader title="Latest" />}
        {recent.map((e) => {
          const l = entryLine(sp, e.animalName || !e.animalId ? e : { ...e, animalName: (live.find((x) => x.id === e.animalId) || {}).name });
          return <Row key={e.id} icon={ic(l.icon)} title={l.title} sub={e.date === today ? "Today" : prettyDay(e.date)} />;
        })}
        <Row first={!recent.length} icon={ic(BookOpen)} title="Everything you've logged" sub="Edit or delete past entries in the Journal" onClick={onOpenJournal} chevron />
      </Card>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} label={`More ${sp.noun} logs`} showClose>
        <h2 style={{ margin: "0 4px 10px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>Log something else</h2>
        <Card>
          {[
            ...(ms.length ? [["milk", "Milk", Milk, () => act.milk()]] : []),
            ["breeding", "Breeding", Heart, () => act.breeding(null)],
            [sp.birthAction, sp.birthLabel, Baby, () => act.birth()],
            ...(sp.extraLogs || []).map((x) => [x.key, x.label, EXTRA_ICONS[x.key] || NotebookPen, () => act.log(x.key)]),
            ["note", "Note", NotebookPen, () => act.note()],
            ["expense", "Expense", Receipt, () => setModal({ type: "addExpense", hobbyId: hobby.id })],
          ].map(([k, label, I, run], i) => (
            <Row key={k} first={i === 0} icon={ic(I)} title={label} chevron onClick={() => { setMoreOpen(false); run(); }} />
          ))}
          {custom.map((c) => <Row key={c.id} icon={ic(NotebookPen)} title={c.label} chevron
            onClick={() => { setMoreOpen(false); setModal({ type: "log", action: "custom", customLogId: c.id, hobbyIdOverride: hobby.id }); }} />)}
          <Row icon={ic(Users)} title="Herd count" sub={`${sp.Noun} you count but don't name`} chevron onClick={() => { setMoreOpen(false); act.herdCount(); }} />
          {live.length > 0 && <Row icon={ic(Snowflake)} title={`Remove ${sp.plural}`} sub="Sold, butchered or died" chevron onClick={() => { setMoreOpen(false); act.remove(); }} />}
          <Row icon={<Plus size={20} strokeWidth={2} />} title="Make a custom log button" chevron onClick={() => { setMoreOpen(false); setModal({ type: "customLogPicker", hobbyId: hobby.id }); }} />
        </Card>
      </Sheet>
    </div>
  );
}

// ── Herd ────────────────────────────────────────────────────────────────────
export function LivestockHerd({ sp, hobby, data, act, tallyTotal = 0, tallyLine = "", extra = null }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const live = liveAnimals(hobby).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const archived = (hobby.animals || []).filter((a) => a && a.archived);
  const groups = sp.groups.map((g) => ({ ...g, n: live.filter((a) => sexOf(sp, a) === g.key).length })).filter((g) => g.n);
  const pastures = sp.groupBy === "pasture" ? groupListOf(sp, hobby) : [];
  const gf = groupFieldOf(sp);
  const penWord = sp.groupWord || "pasture";
  const [sel, setSel] = useState("all");
  const shown = live.filter((a) => sel === "all" || sel === "pasture" || sexOf(sp, a) === sel);
  const history = birthHistory(sp, hobby, entries);
  const [allBirths, setAllBirths] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const byPasture = pastures.length > 0 && (sel === "all" || sel === "pasture");

  const row = (a, i) => {
    const st = animalStatus(sp, hobby, entries, a, today);
    return (
      <Row key={a.id} first={i === 0} icon={<Avatar bird={a} />} iconBg="transparent" title={a.name}
        sub={[a.breed, a.tagId ? `#${a.tagId}` : null, ageText(dobOf(sp, a), today)].filter(Boolean).join(" · ") || sp.sexWord[sexOf(sp, a)] || sp.noun}
        trailing={st ? <Badge tone={st.tone}>{st.text}</Badge> : null} onClick={() => act.openProfile(a.id)} chevron />
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {(groups.length > 1 || pastures.length > 0) && (
        <div role="group" aria-label="Show" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -20px", padding: "0 20px", scrollbarWidth: "none" }}>
          <Chip selected={sel === "all" || sel === "pasture"} onClick={() => setSel("all")}>{pastures.length ? `By ${penWord}` : "All"} · {live.length}</Chip>
          {groups.map((g) => <Chip key={g.key} selected={sel === g.key} onClick={() => setSel(g.key)}>{g.label} · {g.n}</Chip>)}
        </div>
      )}

      {byPasture ? (
        <>
          {[...pastures, { id: null, name: `Not in a ${penWord}` }].map((p) => {
            const list = live.filter((a) => (a[gf] || null) === p.id || (p.id === null && a[gf] && !pastures.some((x) => x.id === a[gf])));
            if (!list.length && p.id === null) return null;
            return (
              <Card key={p.id || "_none"}>
                <CardHeader title={p.name || penWord} right={p.id ? <Button kind="link" onClick={() => act.editPasture(p.id)}>Edit</Button> : `${list.length}`} />
                {list.length ? list.map((a) => row(a, 1)) : <div style={{ padding: "2px 14px 14px", fontSize: 14, color: nl.soft }}>Nobody here right now.</div>}
              </Card>
            );
          })}
          <Card>
            <Row first icon={<Plus size={20} strokeWidth={2} />} title={`Add a ${sp.noun}`} onClick={act.addAnimal} chevron />
            <Row icon={ic(Fence)} title={`Add a ${penWord}`} onClick={act.addPasture} chevron />
          </Card>
        </>
      ) : (
        <Card>
          {shown.map((a, i) => row(a, i))}
          <Row first={!shown.length} icon={<Plus size={20} strokeWidth={2} />} title={`Add a ${sp.noun}`} onClick={act.addAnimal} chevron />
          {sp.groupBy === "pasture" && !pastures.length && live.length > 0 && <Row icon={ic(Fence)} title={`Group by ${penWord}`} sub={`Add a ${penWord} to sort your ${sp.plural}`} onClick={act.addPasture} chevron />}
        </Card>
      )}

      <Card>
        <Row first icon={ic(Users)} title={tallyTotal ? `Herd count · ${tallyTotal} head` : `Count ${sp.plural} you don't name`}
          sub={tallyTotal ? tallyLine : `A simple head count by sex, separate from your named ${sp.plural}`} onClick={act.herdCount} chevron />
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader title={`${sp.birthLabel} history`} right={history.length > 3 ? <Button kind="link" onClick={() => setAllBirths((v) => !v)}>{allBirths ? "Fewer" : `All (${history.length})`}</Button> : null} />
          {(allBirths ? history : history.slice(0, 3)).map((h) => (
            <Row key={h.id} icon={ic(Baby)} title={`${h.dam} · ${dayYear(h.date)}`} sub={h.sub}
              onClick={h.breeding ? () => act.breeding(h.breeding) : undefined} chevron={!!h.breeding} />
          ))}
        </Card>
      )}

      {extra}

      {archived.length > 0 && (
        <Card>
          <Row first icon={ic(Archive)} title={`Past ${sp.plural} (${archived.length})`} sub="Sold, butchered or died. Tap one to restore it." onClick={() => setShowPast((v) => !v)} chevron />
          {showPast && archived.map((a) => (
            <Row key={a.id} icon={<Avatar bird={a} size={36} />} iconBg="transparent" title={a.name}
              sub={[a.archivedReason || "Archived", a.archivedDate ? prettyDay(a.archivedDate) : null].filter(Boolean).join(" · ")} onClick={() => act.editAnimal(a.id)} chevron />
          ))}
        </Card>
      )}
    </div>
  );
}

// ── One animal ──────────────────────────────────────────────────────────────
export function LivestockProfile({ sp, hobby, data, animal: g, act, onBack }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const st = animalStatus(sp, hobby, entries, g, today);
  const female = isFemale(sp, g);
  const sireSex = sp.male.includes(sexOf(sp, g));
  const milker = showsMilk(hobby, sp) && female && (sp.milkFor ? true : (isDairy(g) || !liveAnimals(hobby).some((a) => a.purpose)));
  const born = lastBirth(sp, hobby, entries, g.id);
  const due = openBreeding(hobby, g.id, today, sp, entries);
  const weights = latest(entries, "weight", g.id);
  const health = latest(entries, "health", g.id).slice(0, 3);
  const births = birthHistory(sp, hobby, entries).filter((h) => h.damId === g.id);
  const youngTotal = births.reduce((s, h) => s + (h.count || 0), 0);
  const sired = allBreedings(sp, hobby, entries).filter((b) => b && b.sireId === g.id);
  const extra = (sp.extraLogs || []).map((x) => ({ ...x, last: latest(entries, x.key, g.id)[0] })).filter((x) => x.last);
  const animals = hobby.animals || [];
  const nameOf = (id) => (animals.find((a) => a.id === id) || {}).name;
  const sire = nameOf(g.sireId) || g.sireName || null;
  const dam = nameOf(g.damId) || g.damName || null;
  const kids = animals.filter((a) => a && (a.damId === g.id || a.sireId === g.id)).length;
  const pasture = groupListOf(sp, hobby).find((p) => p.id === g[groupFieldOf(sp)]);
  const penWord = sp.groupWord || "pasture";

  const stats = [];
  // Milk numbers only once she has been milked; before that, age and young.
  if (milker && milkOz(sp, entries, { animalId: g.id }) > 0) {
    stats.push(["Today", gal(milkOz(sp, entries, { animalId: g.id, from: today, to: today }))]);
    stats.push(born ? ["This lactation", gal(milkOz(sp, entries, { animalId: g.id, from: born.date }))] : ["All milk", gal(milkOz(sp, entries, { animalId: g.id }))]);
  } else {
    stats.push(["Age", ageText(dobOf(sp, g), today) || "—"]);
    stats.push([sireSex ? "Breedings" : sp.youngPlural[0].toUpperCase() + sp.youngPlural.slice(1), String(sireSex ? sired.length : youngTotal)]);
  }
  stats.push(["Weight", weights[0] ? fmtWeight(Number(weights[0].weight) || 0) : "—"]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: -10 }}>
        <button type="button" aria-label="Back to herd" onClick={onBack} style={{ width: 44, height: 44, border: "none", background: "none", cursor: "pointer", color: nl.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
        <span style={{ flex: 1 }} />
        <Button kind="link" icon={<Pencil size={15} />} onClick={() => act.editAnimal(g.id)}>Edit</Button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar bird={g} size={68} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontFamily: font.display, fontWeight: 400, fontSize: type.title, lineHeight: 1.1 }}>{g.name}</h1>
          <div style={{ fontSize: type.small, color: nl.soft, marginTop: 2 }}>
            {[[g.breed, sp.sexWord[sexOf(sp, g)]].filter(Boolean).join(" "), g.tagId ? `tag ${g.tagId}` : null, dobOf(sp, g) ? `born ${dayYear(dobOf(sp, g))}` : null, ageText(dobOf(sp, g), today)].filter(Boolean).join(" · ")}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            {st && <Badge tone={st.tone}>{st.text}</Badge>}
            {g.purpose && <Badge>{g.purpose}</Badge>}
          </div>
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

      {milker && <Button icon={ic(Milk)} onClick={() => act.milk(g.id)}>Log {g.name}'s milk</Button>}

      {(female || sireSex) && (
        <Card>
          <CardHeader title={`Breeding & ${sp.birthNoun}`} right={<Button kind="link" onClick={() => act.breeding(null, female ? g.id : null)}>Log</Button>} />
          {female && due && <Row icon={ic(Heart)} title={`Due ${dayYear(due.expectedBirthDate)}`} sub={[due.breedDate ? `Bred ${prettyDay(due.breedDate)}` : null, due.method && due.method !== "Natural" ? due.method : null, nameOf(due.sireId) || due.externalSireName ? `sire ${nameOf(due.sireId) || due.externalSireName}` : null].filter(Boolean).join(" · ")} onClick={() => act.breeding(due)} chevron />}
          {female && <Row icon={ic(Baby)} title={born ? `Last ${sp.born} ${dayYear(born.date)}` : `No ${sp.birthNoun}s yet`} sub={births.length ? `${plural(births.length, sp.birthNoun, `${sp.birthNoun}s`)} · ${plural(youngTotal, sp.young, sp.youngPlural)} total` : "Log one when she gives birth"} onClick={() => act.birth(g.id)} chevron />}
          {female && extra.map((x) => { const I = EXTRA_ICONS[x.key] || NotebookPen; return <Row key={x.key} icon={ic(I)} title={`${x.label}: ${dayYear(x.last.date)}`} sub={[x.last.pregResult || x.last.result, x.last.nextHeatExpected ? `next heat ${prettyDay(x.last.nextHeatExpected)}` : null, x.last.notes].filter(Boolean).join(" · ")} onClick={() => act.log(x.key, g.id)} chevron />; })}
          {sireSex && <Row icon={ic(Heart)} title={sired.length ? `${plural(sired.length, "breeding", "breedings")} as sire` : "No breedings yet"} sub={sired[0] ? `Last: ${nameOf(sired[0].damId) || `a ${sp.she}`} · ${prettyDay(sired[0].breedDate)}` : `Record one from the ${sp.she}'s page or here`} />}
        </Card>
      )}

      <Card>
        <CardHeader title="Health" right={<Button kind="link" onClick={() => act.health(g.id)}>Log</Button>} />
        {health.length ? health.map((e) => (
          <Row key={e.id} icon={ic(Stethoscope)} title={e.notes || "Health note"} sub={dayYear(e.date)} />
        )) : <div style={{ padding: "2px 14px 14px", fontSize: 14, color: nl.soft }}>Dewormers, vaccines and vet visits show up here.</div>}
        <Row icon={ic(Scale)} title={weights[0] ? `Weighed ${fmtWeight(Number(weights[0].weight) || 0)}` : "Log a weight"} sub={weights[0] ? `${dayYear(weights[0].date)}${weights[1] ? ` · was ${fmtWeight(Number(weights[1].weight) || 0)} on ${prettyDay(weights[1].date)}` : ""}` : "Track growth over time"} onClick={() => act.weight(g.id)} chevron />
      </Card>

      <Card>
        {sp.groupBy === "pasture" && <Row first icon={ic(MapPin)} title={pasture ? `${penWord[0].toUpperCase() + penWord.slice(1)}: ${pasture.name}` : `Not in a ${penWord}`} sub={`Move to another ${penWord}`} onClick={() => act.move(g.id)} chevron />}
        <Row first={sp.groupBy !== "pasture"} icon={ic(GitBranch)} title="Family tree" sub={[sire ? `Sire ${sire}` : null, dam ? `dam ${dam}` : null, kids ? `${plural(kids, sp.young, sp.youngPlural)} in the herd` : null].filter(Boolean).join(" · ") || "Add parents when you edit"} onClick={() => act.pedigree(g)} chevron />
        <Row icon={ic(History)} title="Full history" sub={`Every log, photo and sale for this ${sp.noun}`} onClick={() => act.history(g)} chevron />
        <Row icon={ic(NotebookPen)} title="Add a note" onClick={() => act.note(g.id)} chevron />
      </Card>

      {g.notes && <div style={{ fontSize: 14, color: nl.soft, padding: "0 4px", lineHeight: 1.45 }}>{g.notes}</div>}
    </div>
  );
}

// ── Stats ───────────────────────────────────────────────────────────────────
const FACT_ICONS = { milk: Milk, money: DollarSign, trophy: Trophy, calendar: CalendarCheck, kid: Baby, meals: Utensils };

export function LivestockStats({ sp, hobby, data, setModal, allNumbers }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const [rk, setRk] = useState("year");
  const r = statsRange(rk, today);
  const s = useMemo(() => herdSummary(sp, data, hobby, r), [data, hobby, rk]); // eslint-disable-line react-hooks/exhaustive-deps
  const milkPrice = Number(hobby.storeMilkPrice) > 0 ? Number(hobby.storeMilkPrice) : 0;
  const facts = useMemo(() => herdFunFacts(sp, { data, hobby, range: r, milkPrice }), [data, hobby, rk, milkPrice]); // eslint-disable-line react-hooks/exhaustive-deps
  const months = milkByMonth(sp, entries, today, 6).map((m) => ({ key: m.key, label: m.label, value: m.oz / 128 }));
  const byAnimal = milkByAnimal(sp, entries, hobby, r);
  const top = Math.max(1, ...byAnimal.map((d) => d.oz));
  const anyMilk = entries.some((e) => e && e.action === "milk");
  const priorWord = rk === "30d" ? "prior 30 days" : "this time last year";
  const Young = sp.youngPlural[0].toUpperCase() + sp.youngPlural.slice(1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <RangeChips options={["30d", "year", "all"].map((k) => ({ key: k, label: statsRange(k, today).label }))} value={rk} onPick={setRk} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {anyMilk ? (
          <Card padded>
            <div style={{ fontSize: type.small, color: nl.soft }}>Milk</div>
            <div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1 }}>{gal(s.milkOz)}</div>
            {s.delta != null && isFinite(s.delta) && (
              <div style={{ fontSize: 12, fontWeight: 600, color: s.delta >= 0 ? nl.good : nl.alert }}>
                {s.delta >= 0 ? "Up" : "Down"} {Math.abs(Math.round(s.delta * 100))}% vs. {priorWord}
              </div>
            )}
          </Card>
        ) : (
          <Card padded>
            <div style={{ fontSize: type.small, color: nl.soft }}>{Young} born</div>
            <div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1 }}>{s.young}</div>
          </Card>
        )}
        {!anyMilk && s.meatLbs > 0 ? (
          <Card padded>
            <div style={{ fontSize: type.small, color: nl.soft }}>Meat</div>
            <div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1 }}>{fmtWeight(s.meatLbs)}</div>
            <div style={{ fontSize: 12, color: nl.soft }}>{s.cost > 0 ? `${fmtMoney(s.cost / s.meatLbs)} a pound, all costs in` : `${s.butchered} butchered`}</div>
          </Card>
        ) : (
          <Card padded>
            <div style={{ fontSize: type.small, color: nl.soft }}>{anyMilk ? "Cost per gallon" : "Spent"}</div>
            <div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1 }}>{anyMilk ? (s.perGal != null ? fmtMoney(s.perGal) : "—") : fmtMoney(s.cost)}</div>
            <div style={{ fontSize: 12, color: nl.soft }}>
              {anyMilk ? (s.cost > 0 ? `${fmtMoney(s.cost)} on feed and supplies` : "Log feed costs to see this") : "Feed, supplies and expenses"}
            </div>
          </Card>
        )}
      </div>

      <FactCarousel facts={facts} icons={FACT_ICONS} label={`${sp.Noun} fun facts, swipe for more`}
        onShare={(f) => setModal({ type: "shareCard", card: factCard({ ...f, kind: `${sp.key}_fact_${f.key}` }, data, { emoji: sp.emoji, kicker: `Our ${sp.plural}` }) })} />

      {anyMilk && (
        <Card padded>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Milk by month</div>
          <MonthBars months={months} color={nl.good} format={(v) => (v >= 10 ? Math.round(v) : v.toFixed(1))}
            label={`Gallons of milk by month: ${months.map((m) => `${m.label} ${m.value.toFixed(1)}`).join(", ")}`} />
        </Card>
      )}

      {byAnimal.length > 1 && (
        <Card>
          <CardHeader title={`Milk by ${sp.she}`} right={r.label} />
          {byAnimal.map((d) => (
            <div key={d.id || d.name} style={{ padding: "8px 14px 10px", borderTop: `1px solid ${nl.rule}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ fontWeight: 600 }}>{d.name}</span><span>{gal(d.oz)}</span></div>
              <div style={{ height: 8, borderRadius: 4, background: nl.chip, marginTop: 6, overflow: "hidden" }}><div style={{ height: "100%", width: `${(d.oz / top) * 100}%`, background: nl.good }} /></div>
            </div>
          ))}
        </Card>
      )}

      <AllNumbers label={sp.milk === false ? `All the numbers: ${sp.youngPlural}, growth, meat, feed` : `All the numbers: milk trend, best month, ${sp.youngPlural}, feed`}>{allNumbers}</AllNumbers>
    </div>
  );
}
