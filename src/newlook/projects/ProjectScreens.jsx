// ============================================================================
// 4-H & FFA (3.0) — projects, record book, PDF guide, AET summary
// ----------------------------------------------------------------------------
// More › 4-H & FFA. A kid starts a project for one hobby; the record fills in
// from what the family already logs, plus two new logs (Project hours, Show
// or fair) and two things they write (goals, project story). Download PDF
// makes the record book; FFA projects also get an AET summary to type from.
// ============================================================================

import React, { useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, Check, FileText, Clock, Users, Download, Plus, Award, Trash2, Copy, Pencil, Info,
} from "lucide-react";
import { nl, font, type } from "../theme.js";
import { Card, CardHeader, Row, Button, Sheet, Chip } from "../ui.jsx";
import HobbyGlyph from "../HobbyGlyph.jsx";
import { showUndo } from "../UndoBar.jsx";
import {
  KINDS, kindOf, SAE_TYPES, HOUR_ACTIVITIES, programYear, yearLabel, projectsOf, logsFor, projectRecord, progressLine,
  isPastProject, nextYearDue, nextYearLabel,
  hoursThisMonth, isoDay, STORY_PROMPTS, GOAL_PROMPTS,
} from "./projectData.js";
import { buildProjectPdf, aetRows } from "./projectPdf.js";
import { shareOrDownload } from "../../Sales.jsx";
import { fmtMoney, fmtMoneyWhole } from "../../units.js";

const uid = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const ic = (I) => <I size={20} strokeWidth={1.8} aria-hidden="true" />;
const money0 = (n) => fmtMoneyWhole(Number(n) || 0);
const shortDate = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };

function ClubTag({ club }) {
  const ffa = club === "FFA";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, padding: "3px 8px", borderRadius: 6, flexShrink: 0, background: ffa ? "#DCE6F0" : nl.goodTint, color: ffa ? "#1F3B57" : nl.goodInk }}>{club}</span>
  );
}

function Bar({ pct, club }) {
  return (
    <div style={{ height: 8, borderRadius: 4, background: nl.rule, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, borderRadius: 4, background: club === "FFA" ? "#3F6E8F" : nl.good }} />
    </div>
  );
}

function Back({ label, onBack, title, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: -10 }}>
      <button type="button" onClick={onBack} aria-label={`Back to ${label}`} style={{ width: 44, height: 44, border: "none", background: "none", color: nl.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
        <ChevronLeft size={24} strokeWidth={2} />
      </button>
      <h1 style={{ margin: 0, fontFamily: font.display, fontWeight: 400, fontSize: type.title, lineHeight: 1.1, flex: 1, minWidth: 0 }}>{title}</h1>
      {right}
    </div>
  );
}

const fieldStyle = () => ({ width: "100%", boxSizing: "border-box", minHeight: 48, borderRadius: 12, border: `1.5px solid ${nl.field}`, background: nl.card, color: nl.ink, padding: "0 12px", font: `500 16px ${font.body}` });
const labelStyle = () => ({ display: "block", fontSize: 13, fontWeight: 600, color: nl.soft, margin: "12px 2px 6px" });
function Field({ label, children, id }) {
  return <div><label htmlFor={id} style={labelStyle()}>{label}</label>{children}</div>;
}

// ------------------------------------------------------------------ home
export function ProjectsHome({ data, onBack, onOpen, onNew, onGuide, onInfo, onContinue }) {
  const all = projectsOf(data);
  // This year's records first; finished years under Past years.
  const projects = all.filter((p) => !isPastProject(p));
  const pastYears = all.filter((p) => isPastProject(p)).sort((a, b) => String(b.end).localeCompare(String(a.end)));
  const due = all.filter((p) => nextYearDue(data, p));
  const [showPast, setShowPast] = useState(false);
  const hobbies = (data.hobbies || []).filter((h) => h && !h.hidden);
  const kinds = KINDS.filter((k) => hobbies.some((h) => h.type === k.hobbyType));
  const py = programYear();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Back label="More" onBack={onBack} title="4-H & FFA" />
      <div style={{ background: nl.deep, color: nl.onDeep, borderRadius: 20, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontFamily: font.display, fontSize: 21, lineHeight: 1.15 }}>Your record book fills itself in</div>
        <div style={{ fontSize: 13, color: nl.onDeepSoft, lineHeight: 1.4 }}>Log your animals and garden like normal. Henalytics sorts it into your project records, ready to print.</div>
        <button type="button" onClick={onGuide} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 4, minHeight: 36, padding: "0 12px", borderRadius: 999, border: "none", background: nl.yolk, color: nl.onYolk, font: `700 13px ${font.body}`, cursor: "pointer" }}>
          See how it works<ChevronRight size={15} strokeWidth={2.4} />
        </button>
      </div>

      {due.length > 0 && onContinue && (
        <Card padded style={{ display: "flex", flexDirection: "column", gap: 10, background: nl.yolkTint, borderColor: nl.yolkTint }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: nl.yolkInk }}>Time to start next year's record</div>
            <div style={{ fontSize: 13, color: nl.quietInk, marginTop: 2, lineHeight: 1.4 }}>The member, animals and goals carry over. This year's record stays as it is, ready to print.</div>
          </div>
          {due.map((p) => (
            <Button key={p.id} small onClick={() => onContinue(p)} style={{ alignSelf: "flex-start" }}>
              Start the {nextYearLabel(p)} {p.title || kindOf(p.kind).label}{p.member ? ` (${p.member})` : ""}
            </Button>
          ))}
        </Card>
      )}

      {projects.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 2px", marginTop: 2 }}>
            <span style={{ fontFamily: font.display, fontSize: 21 }}>Your projects</span>
            <span style={{ fontSize: 13, color: nl.soft }}>{py.label}</span>
          </div>
          {projects.map((p) => {
            const rec = projectRecord(data, p);
            const line = p.club === "FFA" && rec.hours > 0 ? `${hoursThisMonth(rec.logs)} hours this month · AET summary ready` : progressLine(rec);
            return (
              <Card key={p.id} onClick={() => onOpen(p.id)} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ClubTag club={p.club} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: type.body, fontWeight: 600, overflowWrap: "anywhere" }}>{p.title || kindOf(p.kind).label}{p.member ? <span style={{ fontWeight: 400, color: nl.soft }}> · {p.member}</span> : null}</span>
                  <ChevronRight size={18} color={nl.soft} strokeWidth={2} aria-hidden="true" />
                </span>
                <Bar pct={(rec.done / rec.total) * 100} club={p.club} />
                <span style={{ fontSize: 13, color: nl.soft }}>{line}</span>
              </Card>
            );
          })}
        </>
      )}

      {pastYears.length > 0 && (
        <Card>
          <Row first icon={ic(Clock)} title={`Past years · ${pastYears.length}`} sub="Finished records, still here to read and print"
            onClick={() => setShowPast((v) => !v)} trailing={<ChevronRight size={18} color={nl.soft} style={{ transform: showPast ? "rotate(90deg)" : "none" }} aria-hidden="true" />} />
          {showPast && pastYears.map((p) => (
            <Row key={p.id} icon={<HobbyGlyph type={kindOf(p.kind).icon} size={20} />} title={`${p.title || kindOf(p.kind).label}${p.member ? ` · ${p.member}` : ""}`} sub={yearLabel(p)} onClick={() => onOpen(p.id)} chevron />
          ))}
        </Card>
      )}

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: nl.soft, margin: "2px 2px 8px" }}>{projects.length ? "Start another project" : "Start a project"}</div>
        <div role="group" aria-label="Start a project" style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -16px", padding: "0 16px 2px", scrollbarWidth: "none" }}>
          {kinds.map((k) => <Chip key={k.key} onClick={() => onNew(k.key)} icon={<HobbyGlyph type={k.icon} size={16} strokeWidth={2} />}>{k.label}</Chip>)}
          <Chip onClick={() => onNew("other")} icon={<Plus size={16} strokeWidth={2} />}>Something else</Chip>
        </div>
        {!kinds.length && <div style={{ fontSize: 13, color: nl.soft, marginTop: 8 }}>Turn on a hobby (More › Hobbies) and its project fills in on its own.</div>}
      </div>

      <Card>
        <Row first icon={ic(FileText)} title="Where your PDF comes from" sub="Which tab fills each page" onClick={onGuide} chevron />
        <Row icon={ic(Clock)} title="Tracking project hours" sub="For SAE hours and 4-H activities" onClick={() => onInfo("hours")} chevron />
        <Row icon={ic(Users)} title="For parents and leaders" sub="Check progress and sign off" onClick={() => onInfo("leaders")} chevron />
      </Card>
    </div>
  );
}

export const INFO = {
  hours: {
    title: "Tracking project hours",
    body: [
      "Tap the yellow Log button, pick 4-H & FFA, then Project hours. Say how long, what kind of work it was, and a few words about it.",
      "Count the time you spend on the project: chores, feeding, health care, training, building pens, meetings and clinics, and keeping records.",
      "FFA members: these are your SAE hours. The AET summary lists them in the order The AET asks for them, so you can type them in quickly.",
      "Shows and fairs go under Show or fair, with your class and placing.",
    ],
  },
  leaders: {
    title: "For parents and leaders",
    body: [
      "Open a project to see what's filled in. A green check means the record has what it needs; a dashed circle means something's still missing.",
      "Download PDF makes the whole record book, with lines at the end for the member, a parent and the leader or advisor to sign.",
      "Numbers come from the family's logs in Henalytics: animals, eggs, milk or harvests, health logs, sales and costs. Goals and the project story are the member's own words.",
      "If the project is only part of a bigger flock or herd, open Expenses or Income and pick just the ones that belong to it.",
    ],
  },
};

export function InfoSheet({ which, onClose }) {
  const it = INFO[which];
  return (
    <Sheet open={!!it} onClose={onClose} label={it ? it.title : ""} showClose>
      {it && (
        <div style={{ paddingRight: 30 }}>
          <h2 style={{ margin: "0 0 8px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>{it.title}</h2>
          {it.body.map((t) => <p key={t} style={{ margin: "0 0 10px", fontSize: 15, lineHeight: 1.5 }}>{t}</p>)}
        </div>
      )}
    </Sheet>
  );
}

// ------------------------------------------------------------------ new / edit
export function ProjectForm({ open, data, kindKey, project, onClose, onSave }) {
  const editing = !!project;
  const py = programYear();
  const initial = project || {};
  const k = kindOf(editing ? initial.kind : kindKey);
  const hobbies = (data.hobbies || []).filter((h) => h && !h.hidden && (!k.hobbyType || h.type === k.hobbyType));
  const [club, setClub] = useState(initial.club || "4-H");
  const [title, setTitle] = useState(initial.title || (k.key === "other" ? "" : k.label));
  const [member, setMember] = useState(initial.member || "");
  const [age, setAge] = useState(initial.age || "");
  const [clubName, setClubName] = useState(initial.clubName || "");
  const [saeType, setSaeType] = useState(initial.saeType || "Entrepreneurship");
  const [start, setStart] = useState(initial.start || py.start);
  const [end, setEnd] = useState(initial.end || py.end);
  const [hobbyId, setHobbyId] = useState(initial.hobbyId || (hobbies[0] && hobbies[0].id) || "");
  const ok = title.trim() && start && end && start <= end;
  const save = () => {
    if (!ok) return;
    onSave({
      ...(project || { id: uid(), kind: k.key, createdAt: Date.now(), money: "hobby", saleIds: [], expenseIds: [], goals: "", story: "" }),
      club, title: title.trim(), member: member.trim(), age: String(age).trim(), clubName: clubName.trim(),
      saeType: club === "FFA" ? saeType : null, start, end, hobbyId: k.hobbyType ? hobbyId || null : null,
    });
  };
  return (
    <Sheet open={open} onClose={onClose} label={editing ? "Edit project" : "New project"} showClose maxHeight="92vh">
      <h2 style={{ margin: "0 0 4px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>{editing ? "Project details" : `New ${k.key === "other" ? "" : `${k.label.toLowerCase()} `}project`}</h2>
      <div role="radiogroup" aria-label="Club" style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {["4-H", "FFA"].map((c) => <Chip key={c} selected={club === c} onClick={() => setClub(c)}>{c}</Chip>)}
      </div>
      <Field label="Project name" id="pj-title"><input id="pj-title" style={fieldStyle()} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Poultry" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
        <Field label="Member's name" id="pj-member"><input id="pj-member" style={fieldStyle()} value={member} onChange={(e) => setMember(e.target.value)} placeholder="First name and last initial" autoComplete="off" /></Field>
        <Field label="Age" id="pj-age"><input id="pj-age" style={fieldStyle()} inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} /></Field>
      </div>
      <Field label={club === "FFA" ? "Chapter" : "Club"} id="pj-club"><input id="pj-club" style={fieldStyle()} value={clubName} onChange={(e) => setClubName(e.target.value)} placeholder={club === "FFA" ? "Chapter name" : "Club name"} /></Field>
      {club === "FFA" && (
        <Field label="SAE type" id="pj-sae">
          <select id="pj-sae" style={fieldStyle()} value={saeType} onChange={(e) => setSaeType(e.target.value)}>{SAE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
      )}
      {k.hobbyType && hobbies.length > 1 && (
        <Field label="Which one" id="pj-hobby">
          <select id="pj-hobby" style={fieldStyle()} value={hobbyId} onChange={(e) => setHobbyId(e.target.value)}>{hobbies.map((h) => <option key={h.id} value={h.id}>{h.name || h.type}</option>)}</select>
        </Field>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Starts" id="pj-start"><input id="pj-start" type="date" style={fieldStyle()} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Ends" id="pj-end"><input id="pj-end" type="date" style={fieldStyle()} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <div style={{ fontSize: 12, color: nl.soft, margin: "6px 2px 0" }}>Most clubs run October 1 to September 30. Change it if yours doesn't.</div>
      <Button style={{ width: "100%", marginTop: 16 }} onClick={save} disabled={!ok}>{editing ? "Save" : "Start project"}</Button>
    </Sheet>
  );
}

// ------------------------------------------------------------------ record
const StatusDot = ({ s }) => (
  <span aria-hidden="true" style={{
    width: 26, height: 26, borderRadius: 13, flexShrink: 0, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center",
    background: s === "done" ? nl.good : s === "part" ? nl.yolkTint : "transparent",
    border: s === "done" ? "none" : s === "part" ? `1.5px solid ${nl.yolk}` : `1.5px dashed ${nl.faint}`,
  }}>{s === "done" && <Check size={15} color={nl.card} strokeWidth={2.6} />}</span>
);

export function ProjectRecord({ data, project: p, onBack, onSection, onEdit, onAet, onDelete, toast }) {
  const rec = useMemo(() => projectRecord(data, p), [data, p]);
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const blob = await buildProjectPdf(data, p);
      const safe = `${p.member || "member"}-${p.title || "project"}-${yearLabel(p)}`.replace(/[^a-zA-Z0-9-_]+/g, "_");
      await shareOrDownload(blob, `${safe}.pdf`, `${p.title} record book`);
    } catch (e) { if (toast) toast("Couldn't make the PDF. Try again.", { kind: "error" }); }
    setBusy(false);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Back label="4-H and FFA" onBack={onBack} title={`${p.title || kindOf(p.kind).label} project`} right={<ClubTag club={p.club} />} />
      <div style={{ fontSize: 13, color: nl.soft, marginTop: -8 }}>
        {shortDate(p.start)} – {shortDate(p.end)}{p.member ? ` · ${p.member}${p.age ? `, age ${p.age}` : ""}` : ""}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1 }}><Bar pct={(rec.done / rec.total) * 100} club={p.club} /></div>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{rec.done} of {rec.total}</span>
      </div>
      <Card>
        {rec.sections.map((s, i) => (
          <button key={s.key} type="button" onClick={() => onSection(s.key)} style={{
            display: "flex", alignItems: "center", gap: 12, width: "100%", boxSizing: "border-box", padding: "10px 14px", minHeight: 54, textAlign: "left",
            border: "none", borderTop: i ? `1px solid ${nl.rule}` : "none", background: "transparent", color: nl.ink, font: "inherit", cursor: "pointer",
          }}>
            <StatusDot s={s.status} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{s.title}</span>
              <span style={{ display: "block", fontSize: 12, color: nl.soft }}>{s.source}</span>
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", color: s.write && s.status !== "done" ? nl.good : nl.ink }}>{s.write && s.status !== "done" ? "Write" : s.value || "Add"}</span>
          </button>
        ))}
      </Card>
      <Button style={{ width: "100%" }} icon={<Download size={20} strokeWidth={2.2} />} onClick={download} disabled={busy}>{busy ? "Making the PDF…" : "Download PDF"}</Button>
      <Card>
        <Row first icon={ic(Pencil)} title="Project details" sub="Name, member, club, dates" onClick={onEdit} chevron />
        {p.club === "FFA" && <Row icon={ic(FileText)} title="AET summary" sub="Your hours and money in the order The AET asks" onClick={onAet} chevron />}
        <Row icon={ic(Trash2)} title="Delete project" sub="Your animals and logs stay; only this record goes" onClick={onDelete} />
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ sections
export function SectionSheet({ which, data, project: p, update, onClose, onLog, onOpenHobby }) {
  const rec = useMemo(() => projectRecord(data, p), [data, p]);
  const open = !!which;
  const s = rec.sections.find((x) => x.key === which);
  const setP = (patch) => update((d) => { d.projects = (d.projects || []).map((x) => (x.id === p.id ? { ...x, ...patch } : x)); return d; });
  const removeLog = (l) => {
    update((d) => { d.projectLogs = (d.projectLogs || []).filter((x) => x.id !== l.id); return d; });
    showUndo(l.kind === "show" ? "Show removed" : `${l.hours} hours removed`, () => update((d) => { d.projectLogs = [...(d.projectLogs || []), l]; return d; }));
  };
  return (
    <Sheet open={open} onClose={onClose} label={s ? s.title : ""} showClose maxHeight="88vh">
      {s && (
        <div>
          <h2 style={{ margin: "0 40px 2px 0", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>{s.title}</h2>
          <div style={{ fontSize: 13, color: nl.soft, marginBottom: 10 }}>{s.source}</div>
          {(which === "goals" || which === "story") && <WriteBox key={which} which={which} value={p[which] || ""} onSave={(v) => { setP({ [which]: v }); onClose(); }} />}
          {which === "inventory" && <List rows={rec.inv.rows.map((r) => ({ k: r.name, a: r.name, b: r.detail }))} empty="Nothing here yet. Add your animals in the hobby and they show up." />}
          {which === "production" && <List rows={rec.prod.map((x) => ({ k: x.label, a: x.label, b: x.text }))} empty="Nothing logged in these dates yet." />}
          {which === "health" && <List rows={rec.health.map((h, i) => ({ k: `${h.date}${i}`, a: h.what, b: shortDate(h.date) }))} empty="No health logs in these dates. Log treatments, vet visits and checkups in the hobby." />}
          {which === "photos" && <List rows={rec.photos.map((x, i) => ({ k: `${x.path}${i}`, a: x.caption || "Photo", b: shortDate(x.date) }))} empty="Add photos to your logs in the hobby. The first six go in the PDF." />}
          {["inventory", "production", "health", "photos"].includes(which) && p.hobbyId && <Button kind="quiet" style={{ width: "100%", marginTop: 12 }} onClick={() => { onClose(); onOpenHobby(p.hobbyId); }}>Open {rec.hobbyName}</Button>}
          {(which === "expenses" || which === "income") && <MoneyPicker which={which} rec={rec} project={p} setP={setP} />}
          {which === "hours" && (
            <>
              <List rows={rec.logs.filter((l) => l.kind === "hours").map((l) => ({ k: l.id, a: `${l.hours} hrs · ${l.activity || "Project work"}`, b: [shortDate(l.date), l.note].filter(Boolean).join(" · "), onDelete: () => removeLog(l) }))} empty="No hours yet." />
              <Button style={{ width: "100%", marginTop: 12 }} icon={<Clock size={18} strokeWidth={2} />} onClick={() => onLog("hours")}>Log project hours</Button>
            </>
          )}
          {which === "shows" && (
            <>
              <List rows={rec.shows.map((l) => ({ k: l.id, a: l.showName || "Show", b: [shortDate(l.date), l.cls, l.placing, l.award].filter(Boolean).join(" · "), onDelete: () => removeLog(l) }))} empty="No shows yet." />
              <Button style={{ width: "100%", marginTop: 12 }} icon={<Award size={18} strokeWidth={2} />} onClick={() => onLog("show")}>Log a show or fair</Button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

function List({ rows, empty }) {
  if (!rows.length) return <div style={{ fontSize: 14, color: nl.soft, padding: "6px 2px" }}>{empty}</div>;
  return (
    <Card>
      {rows.map((r, i) => (
        <div key={r.k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: i ? `1px solid ${nl.rule}` : "none" }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>{r.a}</span>
            {r.b && <span style={{ display: "block", fontSize: 12, color: nl.soft, overflowWrap: "anywhere" }}>{r.b}</span>}
          </span>
          {r.right && <span style={{ fontSize: 14, fontWeight: 600 }}>{r.right}</span>}
          {r.onDelete && <button type="button" aria-label={`Remove ${r.a}`} onClick={r.onDelete} style={{ width: 40, height: 40, border: "none", background: "none", color: nl.soft, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={18} strokeWidth={1.8} /></button>}
        </div>
      ))}
    </Card>
  );
}

function WriteBox({ which, value, onSave }) {
  const [v, setV] = useState(value);
  const prompts = which === "story" ? STORY_PROMPTS : GOAL_PROMPTS;
  return (
    <div>
      <div style={{ background: nl.yolkTint, color: nl.yolkInk, borderRadius: 14, padding: "10px 12px", fontSize: 13, lineHeight: 1.45, marginBottom: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{which === "story" ? "Ideas to write about" : "Try writing 3 goals"}</div>
        {prompts.map((t) => <div key={t}>• {t}</div>)}
      </div>
      <label htmlFor={`pj-${which}`} style={{ position: "absolute", left: -9999 }}>{which === "story" ? "Project story" : "Project goals"}</label>
      <textarea id={`pj-${which}`} value={v} onChange={(e) => setV(e.target.value)} rows={which === "story" ? 10 : 6}
        placeholder={which === "story" ? "This year I…" : "1. \n2. \n3. "}
        style={{ ...fieldStyle(), minHeight: 140, padding: 12, lineHeight: 1.5, resize: "vertical" }} />
      <Button style={{ width: "100%", marginTop: 12 }} onClick={() => onSave(v.trim())}>Save</Button>
    </div>
  );
}

function MoneyPicker({ which, rec, project: p, setP }) {
  const isIncome = which === "income";
  const all = isIncome ? rec.money.allS : rec.money.allE;
  const ids = new Set((isIncome ? p.saleIds : p.expenseIds) || []);
  const picked = p.money === "picked";
  const toggle = (id) => {
    const next = new Set(ids);
    if (next.has(id)) next.delete(id); else next.add(id);
    setP(isIncome ? { saleIds: [...next] } : { expenseIds: [...next] });
  };
  const shown = picked ? all.filter((x) => ids.has(x.id)) : all;
  const total = shown.reduce((t, x) => t + x.amount, 0);
  return (
    <div>
      <div role="radiogroup" aria-label="Which ones count" style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <Chip selected={!picked} onClick={() => setP({ money: "hobby" })}>All of {rec.hobbyName}</Chip>
        <Chip selected={picked} onClick={() => setP({ money: "picked", saleIds: p.saleIds || [], expenseIds: p.expenseIds || [] })}>Only ones I pick</Chip>
      </div>
      {picked && <div style={{ fontSize: 13, color: nl.soft, marginBottom: 8 }}>Tick the {isIncome ? "sales" : "expenses"} that belong to this project. The rest stay on the homestead's books.</div>}
      {all.length ? (
        <Card>
          {all.map((x, i) => {
            const on = ids.has(x.id);
            const Tag = picked ? "button" : "div";
            return (
              <Tag key={x.id} type={picked ? "button" : undefined} role={picked ? "checkbox" : undefined} aria-checked={picked ? on : undefined} onClick={picked ? () => toggle(x.id) : undefined} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", boxSizing: "border-box", padding: "10px 14px", textAlign: "left",
                border: "none", borderTop: i ? `1px solid ${nl.rule}` : "none", background: "transparent", color: nl.ink, font: "inherit", cursor: picked ? "pointer" : "default",
                opacity: picked && !on ? 0.6 : 1,
              }}>
                {picked && <span style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, border: on ? "none" : `1.5px solid ${nl.field}`, background: on ? nl.good : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{on && <Check size={15} color={nl.card} strokeWidth={2.6} />}</span>}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>{x.what}</span>
                  <span style={{ display: "block", fontSize: 12, color: nl.soft }}>{[shortDate(x.date), isIncome ? x.buyer : x.category !== x.what ? x.category : null].filter(Boolean).join(" · ")}</span>
                </span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{fmtMoney(x.amount)}</span>
              </Tag>
            );
          })}
        </Card>
      ) : <div style={{ fontSize: 14, color: nl.soft }}>{isIncome ? "No sales in these dates yet. Log them in Sales & costs." : "No costs in these dates yet. Log feed and supplies in the hobby or in Sales & costs."}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, margin: "12px 4px 0" }}><span>Total {isIncome ? "income" : "expenses"}</span><span>{fmtMoney(total)}</span></div>
    </div>
  );
}

// ------------------------------------------------------------------ log sheets
export function ProjectLogSheet({ kind, data, defaultProjectId, onClose, onSave }) {
  const projects = projectsOf(data);
  const [pid, setPid] = useState(defaultProjectId || (projects[0] && projects[0].id) || "");
  const [date, setDate] = useState(isoDay());
  const [hours, setHours] = useState("1");
  const [activity, setActivity] = useState(HOUR_ACTIVITIES[0]);
  const [note, setNote] = useState("");
  const [showName, setShowName] = useState("");
  const [cls, setCls] = useState("");
  const [placing, setPlacing] = useState("");
  const [award, setAward] = useState("");
  const isShow = kind === "show";
  const ok = pid && date && (isShow ? showName.trim() : Number(hours) > 0);
  const save = () => {
    if (!ok) return;
    const base = { id: uid(), projectId: pid, kind: isShow ? "show" : "hours", date, note: note.trim() };
    onSave(isShow ? { ...base, showName: showName.trim(), cls: cls.trim(), placing: placing.trim(), award: award.trim() } : { ...base, hours: Math.round(Number(hours) * 4) / 4, activity });
  };
  return (
    <Sheet open={!!kind} onClose={onClose} label={isShow ? "Log a show or fair" : "Log project hours"} showClose maxHeight="92vh">
      <h2 style={{ margin: "0 40px 4px 0", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>{isShow ? "Show or fair" : "Project hours"}</h2>
      {!projects.length ? (
        <div style={{ fontSize: 14, color: nl.soft }}>Start a project first in More › 4-H & FFA.</div>
      ) : (
        <>
          {projects.length > 1 && (
            <Field label="Project" id="pl-proj">
              <select id="pl-proj" style={fieldStyle()} value={pid} onChange={(e) => setPid(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.club} · {p.title}{p.member ? ` (${p.member})` : ""}</option>)}</select>
            </Field>
          )}
          <Field label="Date" id="pl-date"><input id="pl-date" type="date" style={fieldStyle()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          {isShow ? (
            <>
              <Field label="Show or fair" id="pl-show"><input id="pl-show" style={fieldStyle()} value={showName} onChange={(e) => setShowName(e.target.value)} placeholder="County fair" /></Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Class" id="pl-cls"><input id="pl-cls" style={fieldStyle()} value={cls} onChange={(e) => setCls(e.target.value)} placeholder="Market pen" /></Field>
                <Field label="Placing" id="pl-place"><input id="pl-place" style={fieldStyle()} value={placing} onChange={(e) => setPlacing(e.target.value)} placeholder="Blue ribbon" /></Field>
              </div>
              <Field label="Award (optional)" id="pl-award"><input id="pl-award" style={fieldStyle()} value={award} onChange={(e) => setAward(e.target.value)} placeholder="Reserve champion" /></Field>
            </>
          ) : (
            <>
              <Field label="Hours" id="pl-hours">
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input id="pl-hours" style={{ ...fieldStyle(), width: 100 }} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value.replace(/[^0-9.]/g, "").slice(0, 5))} />
                  {["0.5", "1", "2"].map((h) => <Chip key={h} selected={hours === h} onClick={() => setHours(h)}>{h}</Chip>)}
                </div>
              </Field>
              <div style={labelStyle()}>What kind of work</div>
              <div role="radiogroup" aria-label="What kind of work" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {HOUR_ACTIVITIES.map((a) => <Chip key={a} selected={activity === a} onClick={() => setActivity(a)}>{a}</Chip>)}
              </div>
            </>
          )}
          <Field label="Notes (optional)" id="pl-note"><input id="pl-note" style={fieldStyle()} value={note} onChange={(e) => setNote(e.target.value)} placeholder={isShow ? "What the judge said" : "What you did"} /></Field>
          <Button style={{ width: "100%", marginTop: 16 }} onClick={save} disabled={!ok}>Save</Button>
        </>
      )}
    </Sheet>
  );
}

// ------------------------------------------------------------------ guide
export function PdfGuide({ data, project, onBack }) {
  const p = project || projectsOf(data)[0] || null;
  const rec = p ? projectRecord(data, p) : null;
  const k = p ? kindOf(p.kind) : kindOf("poultry");
  const name = rec ? rec.hobbyName : "your hobby";
  const rows = [
    ["Animal inventory", `${name}: your animals, flocks or plantings`],
    ["Production", `What you log in ${name}: eggs, milk, harvests, litters`],
    ["Expenses", `Costs you log in ${name} or in Sales & costs`],
    ["Income", "Sales & costs: anything you sold from this hobby"],
    ["Hours and activities", "Log › 4-H & FFA › Project hours"],
    ["Health records", `Health, vet and treatment logs in ${name}`],
    ["Shows and awards", "Log › 4-H & FFA › Show or fair"],
    ["Photos", "Photos you add to your logs"],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Back label="4-H and FFA" onBack={onBack} title="Where your PDF comes from" />
      <div aria-hidden="true" data-allow-light="paper preview of the PDF" style={{ background: "#FFFFFF", borderRadius: 6, padding: "16px 18px", boxShadow: `0 1px 2px ${nl.shadow}, 0 10px 28px ${nl.shadow}`, display: "flex", flexDirection: "column", gap: 12, margin: "0 10px", color: "#2A1A12" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1.5px solid #2A1A12", paddingBottom: 6, gap: 8 }}>
          <span style={{ fontFamily: font.display, fontSize: 15 }}>{p ? p.title : k.label} Project Record</span>
          <span style={{ fontSize: 9, color: "#6B5646" }}>{p ? [p.member, yearLabel(p)].filter(Boolean).join(" · ") : programYear().label}</span>
        </div>
        {rows.slice(0, 4).map(([t], i) => (
          <div key={t} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ width: 22, height: 22, borderRadius: 11, background: "#E3A92B", color: "#2A1A12", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 2}</span>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6 }}>{t.toUpperCase()}</div>
              {[100, 82, 90].slice(0, 2 + (i % 2)).map((w) => <div key={w} style={{ height: 5, borderRadius: 3, background: "#E6DED0", width: `${w}%` }} />)}
            </div>
          </div>
        ))}
      </div>
      <Card>
        {rows.map(([t, src], i) => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 14px", borderTop: i ? `1px solid ${nl.rule}` : "none" }}>
            <span style={{ width: 22, height: 22, borderRadius: 11, background: nl.yolk, color: nl.onYolk, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 2}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{t}</span>
              <span style={{ display: "block", fontSize: 12, color: nl.soft }}>Fills from <b style={{ color: nl.good, fontWeight: 600 }}>{src}</b></span>
            </span>
          </div>
        ))}
      </Card>
      <div style={{ fontSize: 13, color: nl.soft, padding: "0 4px" }}>Goals (page 1) and the project story (the last page) are in your own words. Write them right on the project.</div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 16, background: nl.yolkTint, color: nl.yolkInk }}>
        <Info size={20} strokeWidth={1.8} style={{ flexShrink: 0 }} aria-hidden="true" />
        <div style={{ fontSize: 13, lineHeight: 1.4 }}>Something missing? Log it where the list says and it shows up on your PDF next time you download.</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ AET
export function AetSummary({ data, project: p, onBack, toast }) {
  const rec = projectRecord(data, p);
  const rows = aetRows(p, rec);
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); if (toast) toast("Copied"); } catch (_) { if (toast) toast("Couldn't copy. Long-press to select instead.", { kind: "error" }); }
  };
  const block = (title, list, line, sub) => (
    <Card>
      <CardHeader title={title} right={`${list.length}`} />
      {list.length ? list.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderTop: `1px solid ${nl.rule}` }}>
          <span style={{ flex: 1, minWidth: 0, userSelect: "text" }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>{line(r)}</span>
            <span style={{ display: "block", fontSize: 12, color: nl.soft, overflowWrap: "anywhere" }}>{sub(r)}</span>
          </span>
          <button type="button" aria-label="Copy this row" onClick={() => copy(`${line(r)}\t${sub(r)}`)} style={{ width: 40, height: 40, border: "none", background: "none", color: nl.soft, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Copy size={17} strokeWidth={1.8} /></button>
        </div>
      )) : <div style={{ padding: "0 14px 14px", fontSize: 14, color: nl.soft }}>Nothing yet.</div>}
    </Card>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Back label="project" onBack={onBack} title="AET summary" />
      <div style={{ fontSize: 14, color: nl.soft, marginTop: -6, lineHeight: 1.45 }}>Everything in the order The AET asks for it. Work down each list and type the rows in. It's also the last page of your PDF.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {[["Hours", String(rec.hours)], ["Income", money0(rec.money.income)], ["Expenses", money0(rec.money.spent)]].map(([l, v]) => (
          <Card key={l} padded><div style={{ fontSize: 12, color: nl.soft }}>{l}</div><div style={{ fontFamily: font.display, fontSize: 24 }}>{v}</div></Card>
        ))}
      </div>
      {block("Journal", rows.journal, (r) => `${r.date} · ${r.hours ? `${r.hours} hrs · ` : ""}${r.category}`, (r) => r.description)}
      {block("Expenses", rows.expenses, (r) => `${r.date} · ${fmtMoney(r.amount)}`, (r) => (r.description === r.category ? r.description : `${r.description} · ${r.category}`))}
      {block("Income", rows.income, (r) => `${r.date} · ${fmtMoney(r.amount)}`, (r) => [r.description, r.qty].filter(Boolean).join(" · "))}
      {block("Inventory", rows.inventory, (r) => r.item, (r) => r.details)}
    </div>
  );
}
