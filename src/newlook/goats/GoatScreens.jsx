// ============================================================================
// Goats (3.0) — Today · Herd · goat profile · Stats
// ----------------------------------------------------------------------------
// Today: milk today with a chip per doe, quick logs, what's coming up
// (kidding countdowns), feed supply and the latest logs. Herd: does, bucks
// and kids with one status each, kidding history, herd count, past goats.
// Profile: one goat's milk, weight, breeding and health. Stats: milk, cost
// per gallon, fun facts, milk by month and by doe, then every old number.
//
// The log forms are the goat page's own (milk, kidding, breeding, weight,
// health, note, remove); these screens call them through `act`, which
// GoatsNewLook in Goats.jsx provides.
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  Milk, Wheat, Stethoscope, Scale, MoreHorizontal, Heart, Baby, NotebookPen, Receipt, Snowflake, Plus,
  Users, BookOpen, ChevronLeft, GitBranch, History, Trophy, CalendarCheck, DollarSign, Archive, Pencil,
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
  liveGoats, milkingDoes, showsMilk, milkOz, goatStatus, ageText, SEX_GROUPS, upcomingKiddings,
  kiddingHistory, latest, lastKidding, openBreeding, daysFrom, milkByMonth, goatRange, goatSummary,
  milkByDoe, goatFunFacts, isDairy, milkText,
} from "./goatData.js";

const ic = (I, size = 20) => <I size={size} strokeWidth={1.8} />;
const gal = milkText;
const dayWithYear = (s) => (s ? `${prettyDay(s)}, ${s.slice(0, 4)}` : "");
const SEX_WORD = { Doe: "doe", Buck: "buck", Wether: "wether", Kid: "kid" };

function entryLine(e) {
  const who = e.animalName || "";
  switch (e.action) {
    case "milk": return { icon: Milk, title: `${gal(e.oz)} milk${who ? ` · ${who}` : ""}` };
    case "fed": return { icon: Wheat, title: `Fed${Number(e.lbs) > 0 ? ` ${fmtWeight(Number(e.lbs))}` : ""}${Number(e.cost) > 0 ? ` · ${fmtMoney(e.cost)}` : ""}` };
    case "weight": return { icon: Scale, title: `${who || "Goat"} weighed ${fmtWeight(Number(e.weight) || 0)}` };
    case "health": return { icon: Stethoscope, title: `${who ? `${who}: ` : ""}${e.notes || "Health"}` };
    case "kid": return { icon: Baby, title: `${who || "Doe"} had ${Number(e.count) || 1} kid${Number(e.count) === 1 ? "" : "s"}` };
    case "note": return { icon: NotebookPen, title: e.notes || "Note" };
    case "sale": return { icon: DollarSign, title: `Sold ${who || "a goat"}` };
    case "butcher": return { icon: Snowflake, title: `Butchered ${who || "a goat"}` };
    case "death": return { icon: Snowflake, title: `Lost ${who || "a goat"}` };
    default: return { icon: NotebookPen, title: e.label || e.customLabel || e.notes || "Log" };
  }
}

// ── Today ───────────────────────────────────────────────────────────────────
export function GoatToday({ hobby, data, update, setModal, act, tallyTotal = 0, onOpenJournal, onOpenCalendar }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const live = liveGoats(hobby);
  const [moreOpen, setMoreOpen] = useState(false);
  const custom = Array.isArray(hobby.customLogs) ? hobby.customLogs : [];

  if (!live.length && !tallyTotal) {
    return (
      <div style={{ textAlign: "center", padding: "28px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ width: 96, height: 96, borderRadius: 48, background: nl.yolkTint, display: "flex", alignItems: "center", justifyContent: "center" }}><HobbyGlyph type="goats" size={48} /></div>
        <h2 style={{ margin: "6px 0 0", fontFamily: font.display, fontWeight: 400, fontSize: 26 }}>Add your first goat</h2>
        <p style={{ margin: 0, fontSize: 15, color: nl.soft, lineHeight: 1.45 }}>Add each goat by name to track milk, kidding and health. Just want a head count? Count the herd instead.</p>
        <Button onClick={act.addGoat} style={{ width: "100%", marginTop: 8 }}>Add a goat</Button>
        <Button kind="quiet" onClick={act.herdCount} style={{ width: "100%" }}>Count the herd instead</Button>
      </div>
    );
  }

  const does = showsMilk(hobby) ? milkingDoes(hobby) : [];
  const todayOz = milkOz(entries, { from: today, to: today });
  const weekStart = isoDay(new Date(parseDay(today).getTime() - 6 * DAY));
  const weekOz = milkOz(entries, { from: weekStart, to: today });
  const inMilk = does.filter((a) => { const s = goatStatus(hobby, entries, a, today); return s && s.tone === "good"; }).length;
  const coming = upcomingKiddings(hobby, today, 3);
  const recent = latest(entries.filter((e) => e && e.action !== "eggs"), null).slice(0, 4);
  const anyDoe = live.some((a) => a.sex === "Doe");

  const quick = [
    { key: "fed", label: "Fed", icon: Wheat, run: act.fed },
    { key: "health", label: "Health", icon: Stethoscope, run: () => act.health() },
    { key: "weight", label: "Weight", icon: Scale, run: () => act.weight() },
    { key: "more", label: "More", icon: MoreHorizontal, run: () => setMoreOpen(true) },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {does.length > 0 && (
        <Card padded style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Milk today</div>
            <div style={{ fontSize: type.small, color: nl.soft }}>
              {[inMilk ? `${inMilk} ${inMilk === 1 ? "doe" : "does"} in milk` : null, weekOz ? `${gal(weekOz)} this week` : null].filter(Boolean).join(" · ") || "Nothing logged this week"}
            </div>
          </div>
          <div style={{ fontFamily: font.display, fontSize: 40, lineHeight: 1 }}>{todayOz ? gal(todayOz) : "None yet"}</div>
          <div role="group" aria-label="Milk by doe today. Tap a doe to log her milk." style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", margin: "0 -16px", padding: "0 16px" }}>
            {does.map((a) => {
              const v = milkOz(entries, { animalId: a.id, from: today, to: today });
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

      <div style={{ display: "flex", gap: 8 }}>
        {quick.map((q) => (
          <button key={q.key} type="button" onClick={q.run} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 0", minHeight: 68,
            borderRadius: 16, background: nl.card, border: `1px solid ${nl.line}`, cursor: "pointer", color: nl.ink, font: `600 12px ${font.body}`,
          }}><q.icon size={22} strokeWidth={1.8} aria-hidden="true" />{q.label}</button>
        ))}
      </div>

      {(coming.length > 0 || anyDoe) && (
        <Card>
          <CardHeader title="Coming up" right={onOpenCalendar ? <Button kind="link" onClick={onOpenCalendar}>Calendar</Button> : null} />
          {coming.length ? coming.map(({ breeding: b, dam, day, of, left }, i) => (
            <button key={b.id} type="button" onClick={() => act.breeding(b)} style={{
              display: "flex", flexDirection: "column", gap: 8, width: "100%", padding: "10px 14px 12px", border: "none", textAlign: "left",
              borderTop: i === 0 ? `1px solid ${nl.rule}` : `1px solid ${nl.rule}`, background: "transparent", color: nl.ink, font: "inherit", cursor: "pointer",
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: nl.yolkTint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{ic(Baby)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: type.body, fontWeight: 600 }}>{(dam && dam.name) || "Doe"} {left < 0 ? "is past her due date" : `due to kid ${prettyDay(b.expectedBirthDate)}`}</span>
                  <span style={{ display: "block", fontSize: type.small, color: nl.soft }}>
                    {[b.breedDate ? `Bred ${prettyDay(b.breedDate)}` : null, left < 0 ? `due ${prettyDay(b.expectedBirthDate)}` : left === 0 ? "due today" : `${left} day${left === 1 ? "" : "s"} to go`].filter(Boolean).join(" · ")}
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
            <Row icon={ic(Heart)} title="Record a breeding" sub="We'll count down to kidding day" onClick={() => act.breeding(null)} chevron />
          )}
        </Card>
      )}

      <FeedCard hobby={hobby} entries={entries} update={update} setModal={setModal} eatWord="your goats eat" />

      <Card>
        {recent.length > 0 && <CardHeader title="Latest" />}
        {recent.map((e) => {
          const l = entryLine(e);
          return <Row key={e.id} icon={ic(l.icon)} title={l.title} sub={e.date === today ? "Today" : prettyDay(e.date)} />;
        })}
        <Row first={!recent.length} icon={ic(BookOpen)} title="Everything you've logged" sub="Edit or delete past entries in the Journal" onClick={onOpenJournal} chevron />
      </Card>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} label="More goat logs" showClose>
        <h2 style={{ margin: "0 4px 10px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>Log something else</h2>
        <Card>
          {[
            ["milk", "Milk", Milk, () => act.milk()],
            ["breeding", "Breeding", Heart, () => act.breeding(null)],
            ["kid", "Kidding", Baby, () => act.kidding()],
            ["note", "Note", NotebookPen, () => act.note()],
            ["expense", "Expense", Receipt, () => setModal({ type: "addExpense", hobbyId: hobby.id })],
          ].filter(([k]) => k !== "milk" || does.length).map(([k, label, I, run], i) => (
            <Row key={k} first={i === 0} icon={ic(I)} title={label} chevron onClick={() => { setMoreOpen(false); run(); }} />
          ))}
          {custom.map((c) => <Row key={c.id} icon={ic(NotebookPen)} title={c.label} chevron
            onClick={() => { setMoreOpen(false); setModal({ type: "log", action: "custom", customLogId: c.id, hobbyIdOverride: hobby.id }); }} />)}
          <Row icon={ic(Users)} title="Herd count" sub="Goats you count but don't name" chevron onClick={() => { setMoreOpen(false); act.herdCount(); }} />
          {live.length > 0 && <Row icon={ic(Snowflake)} title="Remove goats" sub="Sold, butchered or died" chevron onClick={() => { setMoreOpen(false); act.remove(); }} />}
          <Row icon={<Plus size={20} strokeWidth={2} />} title="Make a custom log button" chevron onClick={() => { setMoreOpen(false); setModal({ type: "customLogPicker", hobbyId: hobby.id }); }} />
        </Card>
      </Sheet>
    </div>
  );
}

// ── Herd ────────────────────────────────────────────────────────────────────
export function GoatHerd({ hobby, data, act, tallyTotal = 0, tallyLine = "" }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const live = liveGoats(hobby);
  const archived = (hobby.animals || []).filter((a) => a && a.archived);
  const groups = SEX_GROUPS.map((g) => ({ ...g, n: live.filter((a) => a.sex === g.key).length })).filter((g) => g.n);
  const other = live.filter((a) => !SEX_GROUPS.some((g) => g.key === a.sex)).length;
  const [sel, setSel] = useState("all");
  const shown = live.filter((a) => sel === "all" || a.sex === sel).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const history = kiddingHistory(hobby, entries);
  const [allKids, setAllKids] = useState(false);
  const [showPast, setShowPast] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {(groups.length > 1 || (groups.length && other)) && (
        <div role="group" aria-label="Show" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -20px", padding: "0 20px", scrollbarWidth: "none" }}>
          <Chip selected={sel === "all"} onClick={() => setSel("all")}>All · {live.length}</Chip>
          {groups.map((g) => <Chip key={g.key} selected={sel === g.key} onClick={() => setSel(g.key)}>{g.label} · {g.n}</Chip>)}
        </div>
      )}

      <Card>
        {shown.map((a, i) => {
          const st = goatStatus(hobby, entries, a, today);
          return (
            <Row key={a.id} first={i === 0} icon={<Avatar bird={a} />} iconBg="transparent" title={a.name}
              sub={[a.breed, ageText(a.dob, today)].filter(Boolean).join(" · ") || SEX_WORD[a.sex] || "Goat"}
              trailing={st ? <Badge tone={st.tone}>{st.text}</Badge> : null} onClick={() => act.openProfile(a.id)} chevron />
          );
        })}
        <Row first={!shown.length} icon={<Plus size={20} strokeWidth={2} />} title="Add a goat" onClick={act.addGoat} chevron />
      </Card>

      <Card>
        <Row first icon={ic(Users)} title={tallyTotal ? `Herd count · ${tallyTotal} head` : "Count goats you don't name"}
          sub={tallyTotal ? tallyLine : "A simple head count by sex, separate from your named goats"} onClick={act.herdCount} chevron />
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader title="Kidding history" right={history.length > 3 ? <Button kind="link" onClick={() => setAllKids((v) => !v)}>{allKids ? "Fewer" : `All (${history.length})`}</Button> : null} />
          {(allKids ? history : history.slice(0, 3)).map((h) => (
            <Row key={h.id} icon={ic(Baby)} title={`${h.dam} · ${dayWithYear(h.date)}`} sub={h.sub}
              onClick={h.breeding ? () => act.breeding(h.breeding) : undefined} chevron={!!h.breeding} />
          ))}
        </Card>
      )}

      {archived.length > 0 && (
        <Card>
          <Row first icon={ic(Archive)} title={`Past goats (${archived.length})`} sub="Sold, butchered or died. Tap one to restore it." onClick={() => setShowPast((v) => !v)} chevron />
          {showPast && archived.map((a) => (
            <Row key={a.id} icon={<Avatar bird={a} size={36} />} iconBg="transparent" title={a.name}
              sub={[a.archivedReason || "Archived", a.archivedDate ? prettyDay(a.archivedDate) : null].filter(Boolean).join(" · ")} onClick={() => act.editGoat(a.id)} chevron />
          ))}
        </Card>
      )}
    </div>
  );
}

// ── One goat ────────────────────────────────────────────────────────────────
export function GoatProfile({ hobby, data, goat, act, onBack }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const st = goatStatus(hobby, entries, goat, today);
  const doe = goat.sex === "Doe";
  const milker = doe && (isDairy(goat) || !liveGoats(hobby).some((a) => a.purpose));
  const kidded = lastKidding(hobby, entries, goat.id);
  const due = openBreeding(hobby, goat.id, today);
  const weights = latest(entries, "weight", goat.id);
  const health = latest(entries, "health", goat.id).slice(0, 3);
  const kiddings = kiddingHistory(hobby, entries).filter((h) => (h.breeding ? h.breeding.damId === goat.id : entries.some((e) => e.id === h.id && e.animalId === goat.id)));
  const kidsTotal = kiddings.reduce((s, h) => s + (h.breeding ? Number(h.breeding.offspringBorn) || 0 : Number((entries.find((e) => e.id === h.id) || {}).count) || 1), 0);
  const sired = (hobby.breedings || []).filter((b) => b && b.sireId === goat.id);
  const animals = hobby.animals || [];
  const nameOf = (id) => (animals.find((a) => a.id === id) || {}).name;
  const sire = nameOf(goat.sireId) || goat.sireName || null;
  const dam = nameOf(goat.damId) || goat.damName || null;
  const kids = animals.filter((a) => a && (a.damId === goat.id || a.sireId === goat.id)).length;

  const stats = [];
  if (milker) {
    stats.push(["Today", gal(milkOz(entries, { animalId: goat.id, from: today, to: today }))]);
    stats.push(kidded ? ["This lactation", gal(milkOz(entries, { animalId: goat.id, from: kidded.date }))] : ["All milk", gal(milkOz(entries, { animalId: goat.id }))]);
  } else {
    stats.push(["Age", ageText(goat.dob, today) || "—"]);
    stats.push([goat.sex === "Buck" ? "Breedings" : "Kids", String(goat.sex === "Buck" ? sired.length : kidsTotal)]);
  }
  stats.push(["Weight", weights[0] ? fmtWeight(Number(weights[0].weight) || 0) : "—"]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: -10 }}>
        <button type="button" aria-label="Back to herd" onClick={onBack} style={{ width: 44, height: 44, border: "none", background: "none", cursor: "pointer", color: nl.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
        <span style={{ flex: 1 }} />
        <Button kind="link" icon={<Pencil size={15} />} onClick={() => act.editGoat(goat.id)}>Edit</Button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar bird={goat} size={68} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontFamily: font.display, fontWeight: 400, fontSize: type.title, lineHeight: 1.1 }}>{goat.name}</h1>
          <div style={{ fontSize: type.small, color: nl.soft, marginTop: 2 }}>
            {[[goat.breed, SEX_WORD[goat.sex]].filter(Boolean).join(" "), goat.dob ? `born ${dayWithYear(goat.dob)}` : null, ageText(goat.dob, today)].filter(Boolean).join(" · ")}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            {st && <Badge tone={st.tone}>{st.text}</Badge>}
            {goat.purpose && <Badge>{goat.purpose}</Badge>}
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

      {milker && <Button icon={ic(Milk)} onClick={() => act.milk(goat.id)}>Log {goat.name}'s milk</Button>}

      {(doe || goat.sex === "Buck") && (
        <Card>
          <CardHeader title="Breeding & kidding" right={<Button kind="link" onClick={() => act.breeding(null, doe ? goat.id : null)}>Log</Button>} />
          {doe && due && <Row icon={ic(Heart)} title={`Due ${dayWithYear(due.expectedBirthDate)}`} sub={[due.breedDate ? `Bred ${prettyDay(due.breedDate)}` : null, nameOf(due.sireId) || due.externalSireName ? `sire ${nameOf(due.sireId) || due.externalSireName}` : null].filter(Boolean).join(" · ")} onClick={() => act.breeding(due)} chevron />}
          {doe && <Row icon={ic(Baby)} title={kidded ? `Last kidded ${dayWithYear(kidded.date)}` : "No kiddings yet"} sub={kiddings.length ? `${kiddings.length} kidding${kiddings.length === 1 ? "" : "s"} · ${kidsTotal} kid${kidsTotal === 1 ? "" : "s"} total` : "Log one when she kids"} onClick={() => act.kidding(goat.id)} chevron />}
          {!doe && <Row icon={ic(Heart)} title={sired.length ? `${sired.length} breeding${sired.length === 1 ? "" : "s"} as sire` : "No breedings yet"} sub={sired[0] ? `Last: ${nameOf(sired[0].damId) || "a doe"} · ${prettyDay(sired[0].breedDate)}` : "Record one from the doe's page or here"} />}
        </Card>
      )}

      <Card>
        <CardHeader title="Health" right={<Button kind="link" onClick={() => act.health(goat.id)}>Log</Button>} />
        {health.length ? health.map((e) => (
          <Row key={e.id} icon={ic(Stethoscope)} title={e.notes || "Health note"} sub={dayWithYear(e.date)} />
        )) : <div style={{ padding: "2px 14px 14px", fontSize: 14, color: nl.soft }}>Dewormers, vaccines and vet visits show up here.</div>}
        <Row icon={ic(Scale)} title={weights[0] ? `Weighed ${fmtWeight(Number(weights[0].weight) || 0)}` : "Log a weight"} sub={weights[0] ? `${dayWithYear(weights[0].date)}${weights[1] ? ` · was ${fmtWeight(Number(weights[1].weight) || 0)} on ${prettyDay(weights[1].date)}` : ""}` : "Track growth over time"} onClick={() => act.weight(goat.id)} chevron />
      </Card>

      <Card>
        <Row first icon={ic(GitBranch)} title="Family tree" sub={[sire ? `Sire ${sire}` : null, dam ? `dam ${dam}` : null, kids ? `${kids} kid${kids === 1 ? "" : "s"} in the herd` : null].filter(Boolean).join(" · ") || "Add parents when you edit"} onClick={() => act.pedigree(goat)} chevron />
        <Row icon={ic(History)} title="Full history" sub="Every log, photo and sale for this goat" onClick={() => act.history(goat)} chevron />
        <Row icon={ic(NotebookPen)} title="Add a note" onClick={() => act.note(goat.id)} chevron />
      </Card>

      {goat.notes && <div style={{ fontSize: 14, color: nl.soft, padding: "0 4px", lineHeight: 1.45 }}>{goat.notes}</div>}
    </div>
  );
}

// ── Stats ───────────────────────────────────────────────────────────────────
const FACT_ICONS = { milk: Milk, money: DollarSign, trophy: Trophy, calendar: CalendarCheck, kid: Baby };

export function GoatStats({ hobby, data, setModal, allNumbers }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const [rk, setRk] = useState("year");
  const r = goatRange(rk, today);
  const s = useMemo(() => goatSummary(data, hobby, r), [data, hobby, rk]); // eslint-disable-line react-hooks/exhaustive-deps
  const milkPrice = Number(hobby.storeMilkPrice) > 0 ? Number(hobby.storeMilkPrice) : 0;
  const facts = useMemo(() => goatFunFacts({ data, hobby, range: r, today, milkPrice }), [data, hobby, rk, milkPrice]); // eslint-disable-line react-hooks/exhaustive-deps
  const months = milkByMonth(entries, today, 6).map((m) => ({ key: m.key, label: m.label, value: m.oz / 128 }));
  const byDoe = milkByDoe(entries, hobby, r);
  const top = Math.max(1, ...byDoe.map((d) => d.oz));
  const anyMilk = entries.some((e) => e && e.action === "milk");
  const priorWord = rk === "30d" ? "prior 30 days" : "this time last year";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <RangeChips options={["30d", "year", "all"].map((k) => ({ key: k, label: goatRange(k, today).label }))} value={rk} onPick={setRk} />

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
            <div style={{ fontSize: type.small, color: nl.soft }}>Kids born</div>
            <div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1 }}>{s.kids}</div>
          </Card>
        )}
        <Card padded>
          <div style={{ fontSize: type.small, color: nl.soft }}>{anyMilk ? "Cost per gallon" : "Spent"}</div>
          <div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1 }}>{anyMilk ? (s.perGal != null ? fmtMoney(s.perGal) : "—") : fmtMoney(s.cost)}</div>
          <div style={{ fontSize: 12, color: nl.soft }}>
            {anyMilk ? (s.cost > 0 ? `${fmtMoney(s.cost)} on feed and supplies` : "Log feed costs to see this") : "Feed, supplies and expenses"}
          </div>
        </Card>
      </div>

      <FactCarousel facts={facts} icons={FACT_ICONS} label="Goat fun facts, swipe for more"
        onShare={(f) => setModal({ type: "shareCard", card: factCard({ ...f, kind: `goat_fact_${f.key}` }, data, { emoji: "🐐", kicker: "Our goats" }) })} />

      {anyMilk && (
        <Card padded>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Milk by month</div>
          <MonthBars months={months} color={nl.good} format={(v) => (v >= 10 ? Math.round(v) : v.toFixed(1))}
            label={`Gallons of milk by month: ${months.map((m) => `${m.label} ${m.value.toFixed(1)}`).join(", ")}`} />
        </Card>
      )}

      {byDoe.length > 1 && (
        <Card>
          <CardHeader title="Milk by doe" right={r.label} />
          {byDoe.map((d) => (
            <div key={d.id || d.name} style={{ padding: "8px 14px 10px", borderTop: `1px solid ${nl.rule}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ fontWeight: 600 }}>{d.name}</span><span>{gal(d.oz)}</span></div>
              <div style={{ height: 8, borderRadius: 4, background: nl.chip, marginTop: 6, overflow: "hidden" }}><div style={{ height: "100%", width: `${(d.oz / top) * 100}%`, background: nl.good }} /></div>
            </div>
          ))}
        </Card>
      )}

      <AllNumbers label="All the numbers: milk trend, best month, kids, feed">{allNumbers}</AllNumbers>
    </div>
  );
}
