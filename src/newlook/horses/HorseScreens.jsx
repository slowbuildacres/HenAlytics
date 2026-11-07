// ============================================================================
// Horses (3.0) — Today · Horses · one horse · Stats
// ----------------------------------------------------------------------------
// Today: rides this week with a chip per horse (tap to log a ride on that
// horse), quick logs (fed, farrier, vet, more), what's coming up (farrier
// due, foaling), feed supply, the latest rides and care. Horses: one row
// each with a status, herd count, past horses. One horse: rides, farrier /
// vet / dewormer, foaling for mares, family tree, history. Stats: rides and
// hours, care spending, hours by horse, fun facts, then the old analytics.
// Forms are the horse page's own, opened through `act` (HorsesNewLook).
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  Wheat, Hammer, Stethoscope, MoreHorizontal, Pill, Heart, Receipt, Plus, Users, NotebookPen, DollarSign,
  Snowflake, BookOpen, ChevronLeft, GitBranch, History, Pencil, Archive, Timer, Baby, Trophy, Mountain,
} from "lucide-react";
import { nl, font, type } from "../theme.js";
import { Card, CardHeader, Row, Badge, Button, Chip, Sheet } from "../ui.jsx";
import HobbyGlyph from "../HobbyGlyph.jsx";
import FeedCard from "../FeedCard.jsx";
import { Avatar } from "../eggs/EggBirds.jsx";
import { RangeChips, FactCarousel, factCard, AllNumbers } from "../StatsParts.jsx";
import { fmtWeight, fmtMoney } from "../../units.js";
import { isoDay, prettyDay, parseDay, DAY } from "../eggs/eggFacts.js";
import { plusDays } from "../../dayMath.js";
import {
  FARRIER_WEEKS, liveHorses, careIds, CARE, SEX_LABEL, careFor, ridesFor, farrierDue, openFoaling, horseStatus,
  ageText, rideTotals, careCost, hoursText, daysFrom,
} from "./horseData.js";

const ic = (I) => <I size={20} strokeWidth={1.8} />;
const dayYear = (s) => (s ? `${prettyDay(s)}, ${s.slice(0, 4)}` : "");
const CARE_ICON = { farrier: Hammer, vet: Stethoscope, deworming: Pill };
const ago = (d, today) => { const n = daysFrom(d, today); return n === 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`; };

// Rides, care visits and logs in one newest-first list.
function activity(hobby, entries, horses) {
  const name = (id) => (horses.find((h) => h.id === id) || {}).name || "";
  const out = [];
  for (const r of ridesFor(hobby)) out.push({ id: `r${r.id}`, date: r.date, icon: Mountain, title: `${name(r.horseId) || "Ride"} · ${r.type || "Ride"}, ${Number(r.durationMinutes) || 0} min` });
  for (const c of CARE) for (const r of careFor(hobby, c.kind)) out.push({ id: `${c.kind}${r.id}`, date: r.date, icon: CARE_ICON[c.kind], title: `${c.label}: ${c.detail(r)}${careIds(r).length ? ` · ${careIds(r).map(name).filter(Boolean).join(", ")}` : ""}` });
  for (const e of entries || []) {
    if (!e || !e.date) continue;
    if (e.action === "fed") out.push({ id: e.id, date: e.date, icon: Wheat, title: `Fed${Number(e.lbs) > 0 ? ` ${fmtWeight(Number(e.lbs))}` : ""}${Number(e.cost) > 0 ? ` · ${fmtMoney(e.cost)}` : ""}` });
    else if (e.action === "custom" || e.action === "note") out.push({ id: e.id, date: e.date, icon: NotebookPen, title: e.customLabel || e.notes || e.note || "Note" });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// ── Today ───────────────────────────────────────────────────────────────────
export function HorseToday({ hobby, data, update, setModal, act, tallyTotal = 0, onOpenJournal, onOpenCalendar }) {
  const today = isoDay();
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const live = liveHorses(hobby);
  const [moreOpen, setMoreOpen] = useState(false);
  const custom = Array.isArray(hobby.customLogs) ? hobby.customLogs : [];

  if (!live.length && !tallyTotal) {
    return (
      <div style={{ textAlign: "center", padding: "28px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ width: 96, height: 96, borderRadius: 48, background: nl.yolkTint, display: "flex", alignItems: "center", justifyContent: "center" }}><HobbyGlyph type="horses" size={48} /></div>
        <h2 style={{ margin: "6px 0 0", fontFamily: font.display, fontWeight: 400, fontSize: 26 }}>Add your first horse</h2>
        <p style={{ margin: 0, fontSize: 15, color: nl.soft, lineHeight: 1.45 }}>Add each horse to log rides, farrier and vet visits, dewormers and foaling.</p>
        <Button onClick={act.addHorse} style={{ width: "100%", marginTop: 8 }}>Add a horse</Button>
      </div>
    );
  }

  const weekStart = isoDay(plusDays(parseDay(today), -6));
  const week = rideTotals(hobby, weekStart, today);
  const riders = live.filter((h) => h.sex !== "foal");
  const due = farrierDue(hobby, today).filter((x) => x.left != null && x.left <= 14).sort((a, b) => a.left - b.left);
  const foalings = openFoaling(hobby, null, today).slice(0, 2);
  const recent = activity(hobby, entries, hobby.animals || []).slice(0, 4);
  const quick = [
    { key: "fed", label: "Fed", icon: Wheat, run: act.fed },
    { key: "farrier", label: "Farrier", icon: Hammer, run: () => act.care("farrier") },
    { key: "vet", label: "Vet", icon: Stethoscope, run: () => act.care("vet") },
    { key: "more", label: "More", icon: MoreHorizontal, run: () => setMoreOpen(true) },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {riders.length > 0 && (
        <Card padded style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Rides this week</div>
            <div style={{ fontSize: type.small, color: nl.soft }}>{week.minutes ? `${hoursText(week.minutes)} in the saddle` : "None yet"}</div>
          </div>
          <div style={{ fontFamily: font.display, fontSize: 40, lineHeight: 1 }}>{week.count}</div>
          <div role="group" aria-label="Last ride per horse. Tap a horse to log a ride." style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", margin: "0 -16px", padding: "0 16px" }}>
            {riders.map((h) => {
              const last = ridesFor(hobby, h.id)[0];
              const fresh = last && daysFrom(last.date, today) <= 6;
              return (
                <button key={h.id} type="button" onClick={() => act.ride(h.id)} aria-label={`${h.name}: ${last ? `last ridden ${ago(last.date, today)}` : "not ridden yet"}. Log a ride.`} style={{
                  flex: "0 0 auto", minWidth: 84, minHeight: 52, padding: "6px 12px", borderRadius: 14, cursor: "pointer", textAlign: "center",
                  background: fresh ? nl.goodTint : "transparent", border: fresh ? "none" : `1.5px dashed ${nl.navIdle}`, color: nl.ink, font: `400 12px ${font.body}`,
                }}>
                  <span style={{ display: "block", font: `700 14px ${font.body}`, color: fresh ? nl.goodInk : nl.ink }}>{h.name}</span>
                  <span style={{ display: "block", color: nl.soft }}>{last ? ago(last.date, today) : "not yet"}</span>
                </button>
              );
            })}
          </div>
          <Button icon={ic(Mountain)} onClick={() => act.ride()}>Log a ride</Button>
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

      {(due.length > 0 || foalings.length > 0) && (
        <Card>
          <CardHeader title="Coming up" right={onOpenCalendar ? <Button kind="link" onClick={onOpenCalendar}>Calendar</Button> : null} />
          {foalings.map((b) => {
            const mare = live.find((h) => h.id === b.mareId);
            const of = b.bredDate ? Math.max(1, daysFrom(b.bredDate, b.expectedFoalDate)) : 340;
            const day = b.bredDate ? Math.max(0, Math.min(of, daysFrom(b.bredDate, today))) : null;
            const left = daysFrom(today, b.expectedFoalDate);
            return (
              <button key={b.id} type="button" onClick={() => act.breeding(b)} style={{
                display: "flex", flexDirection: "column", gap: 8, width: "100%", padding: "10px 14px 12px", border: "none", borderTop: `1px solid ${nl.rule}`,
                textAlign: "left", background: "transparent", color: nl.ink, font: "inherit", cursor: "pointer",
              }}>
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: nl.yolkTint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{ic(Baby)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: type.body, fontWeight: 600 }}>{(mare && mare.name) || "Mare"} {left < 0 ? "is past her due date" : `due to foal ${prettyDay(b.expectedFoalDate)}`}</span>
                    <span style={{ display: "block", fontSize: type.small, color: nl.soft }}>{left >= 0 ? `${left} days to go` : `due ${prettyDay(b.expectedFoalDate)}`}</span>
                  </span>
                </span>
                {day != null && (
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ flex: 1, height: 8, borderRadius: 4, background: nl.chip, overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${Math.round((day / of) * 100)}%`, background: nl.yolk }} /></span>
                    <span style={{ fontSize: 12, color: nl.soft, flexShrink: 0 }}>day {day} of {of}</span>
                  </span>
                )}
              </button>
            );
          })}
          {due.map(({ horse, last, due: d, left }) => (
            <Row key={horse.id} icon={ic(Hammer)} iconBg={left < 0 ? nl.alertChip : nl.yolkTint} tint={left < 0 ? nl.alertTint : undefined}
              title={`${horse.name}'s feet ${left < 0 ? "are overdue" : left === 0 ? "are due today" : `are due ${prettyDay(d)}`}`}
              sub={`Last ${(last.type || "visit").toLowerCase()} ${prettyDay(last.date)} · every ${FARRIER_WEEKS} weeks or so`}
              onClick={() => act.care("farrier", horse.id)} chevron />
          ))}
        </Card>
      )}

      <FeedCard hobby={hobby} entries={entries} update={update} setModal={setModal} eatWord="your horses eat" />

      <Card>
        {recent.length > 0 && <CardHeader title="Latest" />}
        {recent.map((r) => <Row key={r.id} icon={ic(r.icon)} title={r.title} sub={r.date === today ? "Today" : prettyDay(r.date)} />)}
        <Row first={!recent.length} icon={ic(BookOpen)} title="Everything you've logged" sub="Edit or delete past entries in the Journal" onClick={onOpenJournal} chevron />
      </Card>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} label="More horse logs" showClose>
        <h2 style={{ margin: "0 4px 10px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>Log something else</h2>
        <Card>
          {[
            ["ride", "Ride", Mountain, () => act.ride()],
            ["deworming", "Dewormer", Pill, () => act.care("deworming")],
            ["breeding", "Breeding", Heart, () => act.breeding(null)],
            ["expense", "Expense", Receipt, () => setModal({ type: "addExpense", hobbyId: hobby.id })],
          ].map(([k, label, I, run], i) => <Row key={k} first={i === 0} icon={ic(I)} title={label} chevron onClick={() => { setMoreOpen(false); run(); }} />)}
          {custom.map((c) => <Row key={c.id} icon={ic(NotebookPen)} title={c.label} chevron
            onClick={() => { setMoreOpen(false); setModal({ type: "log", action: "custom", customLogId: c.id, hobbyIdOverride: hobby.id }); }} />)}
          <Row icon={ic(Users)} title="Herd count" sub="Horses you count but don't name" chevron onClick={() => { setMoreOpen(false); act.herdCount(); }} />
          {live.length > 0 && <Row icon={ic(DollarSign)} title="Sold a horse" chevron onClick={() => { setMoreOpen(false); act.sale(); }} />}
          {live.length > 0 && <Row icon={ic(Snowflake)} title="A horse died" chevron onClick={() => { setMoreOpen(false); act.death(); }} />}
          <Row icon={<Plus size={20} strokeWidth={2} />} title="Make a custom log button" chevron onClick={() => { setMoreOpen(false); setModal({ type: "customLogPicker", hobbyId: hobby.id }); }} />
        </Card>
      </Sheet>
    </div>
  );
}

// ── Horses list ─────────────────────────────────────────────────────────────
export function HorseHerd({ hobby, act, tallyTotal = 0, tallyLine = "" }) {
  const today = isoDay();
  const live = liveHorses(hobby).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const archived = (hobby.animals || []).filter((a) => a && a.archived);
  const groups = Object.keys(SEX_LABEL).map((k) => ({ key: k, label: SEX_LABEL[k], n: live.filter((h) => h.sex === k).length })).filter((g) => g.n);
  const [sel, setSel] = useState("all");
  const [showPast, setShowPast] = useState(false);
  const shown = live.filter((h) => sel === "all" || h.sex === sel);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {groups.length > 1 && (
        <div role="group" aria-label="Show" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -20px", padding: "0 20px", scrollbarWidth: "none" }}>
          <Chip selected={sel === "all"} onClick={() => setSel("all")}>All · {live.length}</Chip>
          {groups.map((g) => <Chip key={g.key} selected={sel === g.key} onClick={() => setSel(g.key)}>{g.label} · {g.n}</Chip>)}
        </div>
      )}
      <Card>
        {shown.map((h, i) => {
          const st = horseStatus(hobby, h, today);
          return <Row key={h.id} first={i === 0} icon={<Avatar bird={h} />} iconBg="transparent" title={h.name}
            sub={[h.breed, h.color, ageText(h.birthdate, today)].filter(Boolean).join(" · ") || h.sex}
            trailing={st ? <Badge tone={st.tone}>{st.text}</Badge> : null} onClick={() => act.openProfile(h.id)} chevron />;
        })}
        <Row first={!shown.length} icon={<Plus size={20} strokeWidth={2} />} title="Add a horse" onClick={act.addHorse} chevron />
      </Card>
      <Card>
        <Row first icon={ic(Users)} title={tallyTotal ? `Herd count · ${tallyTotal}` : "Count horses you don't name"}
          sub={tallyTotal ? tallyLine : "A simple head count, separate from your named horses"} onClick={act.herdCount} chevron />
      </Card>
      {archived.length > 0 && (
        <Card>
          <Row first icon={ic(Archive)} title={`Past horses (${archived.length})`} sub="Sold or died. Tap one to see or restore it." onClick={() => setShowPast((v) => !v)} chevron />
          {showPast && archived.map((h) => (
            <Row key={h.id} icon={<Avatar bird={h} size={36} />} iconBg="transparent" title={h.name}
              sub={[h.archivedReason || "Archived", h.archivedDate ? prettyDay(h.archivedDate) : null].filter(Boolean).join(" · ")} onClick={() => act.editHorse(h.id)} chevron />
          ))}
        </Card>
      )}
    </div>
  );
}

// ── One horse ───────────────────────────────────────────────────────────────
export function HorseProfile({ hobby, horse: h, act, onBack }) {
  const today = isoDay();
  const st = horseStatus(hobby, h, today);
  const rides = ridesFor(hobby, h.id);
  const month = rideTotals(hobby, isoDay(plusDays(parseDay(today), -29)), today, h.id);
  const fd = farrierDue(hobby, today).find((x) => x.horse.id === h.id);
  const foal = h.sex === "mare" ? openFoaling(hobby, h.id, today)[0] : null;
  const foaled = ((hobby.breedings || []).filter((b) => b && b.mareId === h.id && b.foaledDate)).sort((a, b) => (a.foaledDate < b.foaledDate ? 1 : -1));
  const animals = hobby.animals || [];
  const nameOf = (id) => (animals.find((a) => a.id === id) || {}).name;
  const sire = nameOf(h.sireId) || h.sire || null;
  const dam = nameOf(h.damId) || h.dam || null;
  const stats = [
    ["Age", ageText(h.birthdate, today) || "—"],
    ["Rides, 30 days", month.count ? `${month.count} · ${hoursText(month.minutes)}` : "0"],
    ["Last trim", fd && fd.last ? `${daysFrom(fd.last.date, today)} days` : "—"],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: -10 }}>
        <button type="button" aria-label="Back to horses" onClick={onBack} style={{ width: 44, height: 44, border: "none", background: "none", cursor: "pointer", color: nl.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
        <span style={{ flex: 1 }} />
        <Button kind="link" icon={<Pencil size={15} />} onClick={() => act.editHorse(h.id)}>Edit</Button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar bird={h} size={68} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontFamily: font.display, fontWeight: 400, fontSize: type.title, lineHeight: 1.1 }}>{h.name}</h1>
          <div style={{ fontSize: type.small, color: nl.soft, marginTop: 2 }}>{[[h.color, h.breed, h.sex].filter(Boolean).join(" "), h.birthdate ? `born ${dayYear(h.birthdate)}` : null].filter(Boolean).join(" · ")}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>{st && <Badge tone={st.tone}>{st.text}</Badge>}{h.role && <Badge>{h.role}</Badge>}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {stats.map(([k, v]) => (
          <Card key={k} padded style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 12, color: nl.soft }}>{k}</div>
            <div style={{ fontFamily: font.display, fontSize: 20, lineHeight: 1.15, overflowWrap: "anywhere" }}>{v}</div>
          </Card>
        ))}
      </div>
      {h.sex !== "foal" && <Button icon={ic(Mountain)} onClick={() => act.ride(h.id)}>Log a ride on {h.name}</Button>}

      <Card>
        <CardHeader title="Care" />
        {CARE.map((c) => {
          const last = careFor(hobby, c.kind, h.id)[0];
          const I = CARE_ICON[c.kind];
          const sub = last
            ? [`${dayYear(last.date)}`, c.detail(last), Number(last.cost) > 0 ? fmtMoney(last.cost) : null, c.kind === "farrier" && fd && fd.due ? `next around ${prettyDay(fd.due)}` : null].filter(Boolean).join(" · ")
            : "Nothing logged yet";
          return <Row key={c.kind} icon={ic(I)} title={last ? `${c.label}: ${ago(last.date, today)}` : c.label} sub={sub} onClick={() => act.care(c.kind, h.id)} chevron />;
        })}
      </Card>

      {rides.length > 0 && (
        <Card>
          <CardHeader title="Rides" right={`${rides.length} logged`} />
          {rides.slice(0, 3).map((r) => <Row key={r.id} icon={ic(Mountain)} title={`${r.type || "Ride"} · ${Number(r.durationMinutes) || 0} min`} sub={[dayYear(r.date), r.notes].filter(Boolean).join(" · ")} onClick={() => act.editRide(r)} chevron />)}
        </Card>
      )}

      {h.sex === "mare" && (
        <Card>
          <CardHeader title="Breeding & foaling" right={<Button kind="link" onClick={() => act.breeding(null, h.id)}>Log</Button>} />
          {foal ? <Row icon={ic(Heart)} title={`Foal due ${dayYear(foal.expectedFoalDate)}`} sub={[foal.bredDate ? `Bred ${prettyDay(foal.bredDate)}` : null, nameOf(foal.stallionId) ? `to ${nameOf(foal.stallionId)}` : null].filter(Boolean).join(" · ")} onClick={() => act.breeding(foal)} chevron />
            : <Row icon={ic(Heart)} title="Not in foal" sub="Log a breeding to count down to foaling" onClick={() => act.breeding(null, h.id)} chevron />}
          {foaled[0] && <Row icon={ic(Baby)} title={`Last foaled ${dayYear(foaled[0].foaledDate)}`} sub={`${foaled.length} foaling${foaled.length === 1 ? "" : "s"}`} onClick={() => act.breeding(foaled[0])} chevron />}
        </Card>
      )}

      <Card>
        <Row first icon={ic(GitBranch)} title="Family tree" sub={[sire ? `Sire ${sire}` : null, dam ? `dam ${dam}` : null].filter(Boolean).join(" · ") || "Add parents when you edit"} onClick={() => act.pedigree(h)} chevron />
        <Row icon={ic(History)} title="Full history" sub="Every ride, visit, photo and sale" onClick={() => act.history(h)} chevron />
      </Card>
      {h.notes && <div style={{ fontSize: 14, color: nl.soft, padding: "0 4px", lineHeight: 1.45 }}>{h.notes}</div>}
    </div>
  );
}

// ── Stats ───────────────────────────────────────────────────────────────────
const FACT_ICONS = { timer: Timer, trophy: Trophy, mountain: Mountain, hammer: Hammer };

export function HorseStats({ hobby, data, setModal, allNumbers }) {
  const today = isoDay();
  const [rk, setRk] = useState("year");
  const year = today.slice(0, 4);
  const start = rk === "year" ? `${year}-01-01` : rk === "30d" ? isoDay(plusDays(parseDay(today), -29)) : null;
  const t = useMemo(() => rideTotals(hobby, start, today), [hobby, start, today]);
  const care = careCost(hobby, start, today);
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const feed = entries.filter((e) => e && e.action === "fed" && (!start || e.date >= start)).reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const byHorse = liveHorses(hobby).map((h) => ({ h, m: rideTotals(hobby, start, today, h.id) })).filter((x) => x.m.count).sort((a, b) => b.m.minutes - a.m.minutes);
  const top = Math.max(1, ...byHorse.map((x) => x.m.minutes));
  const types = new Map(); for (const r of t.rides) types.set(r.type || "Ride", (types.get(r.type || "Ride") || 0) + 1);
  const topType = [...types.entries()].sort((a, b) => b[1] - a[1])[0];
  const trims = careFor(hobby, "farrier").filter((r) => !start || r.date >= start).length;

  const facts = [];
  if (t.minutes >= 120) facts.push({ key: "hours", icon: "timer", big: hoursText(t.minutes), line: "in the saddle", title: `${hoursText(t.minutes)} in the saddle`, sub: `Across ${t.count} rides.` });
  if (byHorse.length > 1) facts.push({ key: "most", icon: "trophy", big: byHorse[0].h.name, line: "our most-ridden horse", title: `${byHorse[0].h.name} got ridden the most`, sub: `${hoursText(byHorse[0].m.minutes)} over ${byHorse[0].m.count} rides.` });
  if (topType && t.count >= 5) facts.push({ key: "type", icon: "mountain", big: topType[0], line: "our favorite kind of ride", title: `Your favorite: ${topType[0].toLowerCase()}`, sub: `${topType[1]} of ${t.count} rides.` });
  if (trims >= 3) facts.push({ key: "trims", icon: "hammer", big: String(trims), line: "farrier visits", title: `${trims} farrier visits`, sub: "Good feet, happy horses." });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <RangeChips options={[{ key: "30d", label: "30 days" }, { key: "year", label: year }, { key: "all", label: "All time" }]} value={rk} onPick={setRk} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <Card padded>
          <div style={{ fontSize: type.small, color: nl.soft }}>Rides</div>
          <div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1 }}>{t.count}</div>
          <div style={{ fontSize: 12, color: nl.soft }}>{t.minutes ? `${hoursText(t.minutes)} in the saddle` : "Log a ride to see this"}</div>
        </Card>
        <Card padded>
          <div style={{ fontSize: type.small, color: nl.soft }}>Care and feed</div>
          <div style={{ fontFamily: font.display, fontSize: type.big, lineHeight: 1.1 }}>{fmtMoney(care + feed)}</div>
          <div style={{ fontSize: 12, color: nl.soft }}>{care ? `${fmtMoney(care)} farrier, vet, dewormer` : "Add costs to visits to see this"}</div>
        </Card>
      </div>
      <FactCarousel facts={facts} icons={FACT_ICONS} label="Horse fun facts, swipe for more"
        onShare={(f) => setModal({ type: "shareCard", card: factCard({ ...f, kind: `horse_fact_${f.key}` }, data, { emoji: "🐴", kicker: "Our horses" }) })} />
      {byHorse.length > 0 && (
        <Card>
          <CardHeader title="Time by horse" />
          {byHorse.map(({ h, m }) => (
            <div key={h.id} style={{ padding: "8px 14px 10px", borderTop: `1px solid ${nl.rule}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span style={{ fontWeight: 600 }}>{h.name}</span><span>{hoursText(m.minutes)} · {m.count} rides</span></div>
              <div style={{ height: 8, borderRadius: 4, background: nl.chip, marginTop: 6, overflow: "hidden" }}><div style={{ height: "100%", width: `${(m.minutes / top) * 100}%`, background: nl.good }} /></div>
            </div>
          ))}
        </Card>
      )}
      <AllNumbers label="All the numbers: rides, care, breeding, sales">{allNumbers}</AllNumbers>
    </div>
  );
}
