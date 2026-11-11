// ============================================================================
// Compost (garden) — piles, bins, tumblers and worm bins
// ----------------------------------------------------------------------------
// Lives on the garden hobby, not a season, because a pile runs across seasons:
//   hobby.compost = {
//     piles: [{ id, name, kind, method, startedOn, turnEveryDays, finishedOn }],
//     logs:  [{ id, pileId, date, kind, type, what, amount, amountUnit,
//               tempF, bed, note }]
//   }
// log kinds: add (type green | brown | manure), turn, temp, water, harvest
// (finished compost taken out, optionally where it went).
// Everything is read through clean() so odd saved data can't break the sheet.
// ============================================================================

import React, { useMemo, useState } from "react";
import { Plus, RotateCw, Thermometer, Droplet, ShoppingBasket, Trash2, ChevronLeft, Recycle } from "lucide-react";
import { nl, font, type } from "../theme.js";
import { Sheet, Card, CardHeader, Row, Button, Badge, Chip } from "../ui.jsx";
import { fmtTemp, tempUnitLabel, tempFromF, fFromInput, weightUnitLabel } from "../../units.js";

const DAY = 86400000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, "0");
export const isoDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const daysSince = (s, today) => (ISO.test(s || "") ? Math.max(0, Math.round((parseDay(today) - parseDay(s)) / DAY)) : null);
const newId = () => Math.random().toString(36).slice(2, 10);
const text = (v) => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const shortDate = (s) => (ISO.test(s || "") ? parseDay(s).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");

export const PILE_KINDS = [
  { key: "pile", label: "Open pile" },
  { key: "bin", label: "Bin" },
  { key: "tumbler", label: "Tumbler" },
  { key: "worms", label: "Worm bin" },
  { key: "leaves", label: "Leaf mold" },
];
const METHODS = [
  { key: "hot", label: "Hot (turned often)", turn: 7 },
  { key: "cold", label: "Cold (let it sit)", turn: 0 },
];
const ADD_TYPES = [
  { key: "green", label: "Greens", hint: "Kitchen scraps, grass clippings, garden waste" },
  { key: "brown", label: "Browns", hint: "Dry leaves, straw, cardboard, wood chips" },
  { key: "manure", label: "Manure & bedding", hint: "Chicken, rabbit, goat, horse" },
];
const AMOUNT_UNITS = () => [
  { key: "bucket", label: "buckets" },
  { key: "wheelbarrow", label: "wheelbarrows" },
  { key: "bag", label: "bags" },
  { key: "weight", label: weightUnitLabel() },
];
const unitLabel = (u, n) => {
  const one = { bucket: "bucket", wheelbarrow: "wheelbarrow", bag: "bag" }[u];
  if (u === "weight") return weightUnitLabel();
  return one ? (n === 1 ? one : `${one}s`) : "";
};

// Saved data → safe shapes.
export function compostOf(hobby) {
  const c = hobby && hobby.compost && typeof hobby.compost === "object" ? hobby.compost : {};
  const piles = (Array.isArray(c.piles) ? c.piles : []).filter((p) => p && typeof p === "object" && p.id).map((p) => ({
    ...p,
    name: text(p.name) || "Compost pile",
    kind: PILE_KINDS.some((k) => k.key === p.kind) ? p.kind : "pile",
    method: p.method === "cold" ? "cold" : "hot",
    startedOn: ISO.test(p.startedOn || "") ? p.startedOn : "",
    turnEveryDays: Math.max(0, Math.min(90, Math.round(Number(p.turnEveryDays) || 0))),
    finishedOn: ISO.test(p.finishedOn || "") ? p.finishedOn : "",
  }));
  const logs = (Array.isArray(c.logs) ? c.logs : []).filter((l) => l && typeof l === "object" && l.pileId && ISO.test(l.date || "")).map((l) => ({
    ...l,
    kind: ["add", "turn", "temp", "water", "harvest"].includes(l.kind) ? l.kind : "add",
    amount: Number(l.amount) > 0 ? Number(l.amount) : 0,
    tempF: l.tempF != null && Number.isFinite(Number(l.tempF)) ? Number(l.tempF) : null,
    what: text(l.what), bed: text(l.bed), note: text(l.note),
  }));
  return { piles, logs };
}

// What a pile needs, worked out from its logs.
export function pileStatus(pile, logs, today = isoDay()) {
  const mine = logs.filter((l) => l.pileId === pile.id).sort((a, b) => a.date.localeCompare(b.date));
  const lastTurn = mine.filter((l) => l.kind === "turn").pop();
  const lastTemp = mine.filter((l) => l.kind === "temp" && l.tempF != null).pop();
  const sinceTurnFrom = lastTurn ? lastTurn.date : pile.startedOn;
  const sinceTurn = daysSince(sinceTurnFrom, today);
  const dueTurn = !pile.finishedOn && pile.turnEveryDays > 0 && sinceTurn != null && sinceTurn >= pile.turnEveryDays;
  const adds = mine.filter((l) => l.kind === "add");
  const greens = adds.filter((l) => l.type === "green" || l.type === "manure").length;
  const browns = adds.filter((l) => l.type === "brown").length;
  let mix = null;
  if (greens + browns >= 3) {
    if (greens > browns * 1.5) mix = { tone: "ready", text: "Heavy on greens. Add browns so it doesn't get slimy or smelly." };
    else if (browns > greens * 4) mix = { tone: "quiet", text: "Mostly browns. Some greens or manure will heat it up." };
    else mix = { tone: "good", text: "Good mix of greens and browns." };
  }
  let tempNote = null;
  if (lastTemp) {
    const f = lastTemp.tempF;
    tempNote = f >= 160 ? "Very hot. Turn it so it doesn't burn out." : f >= 130 ? "Cooking nicely." : f >= 90 ? "Warm. Turning or more greens will heat it up." : "Cool. Fine for a cold pile, or nearly finished.";
  }
  return { lastTurn, lastTemp, sinceTurn, dueTurn, greens, browns, mix, tempNote, age: daysSince(pile.startedOn, today), count: mine.length };
}

// Piles that are due a turn (for the garden Today card).
export function compostDue(hobby, today = isoDay()) {
  const { piles, logs } = compostOf(hobby);
  return piles.filter((p) => !p.finishedOn).map((p) => ({ pile: p, st: pileStatus(p, logs, today) })).filter((x) => x.st.dueTurn);
}

export function compostSummary(hobby, today = isoDay()) {
  const { piles, logs } = compostOf(hobby);
  const active = piles.filter((p) => !p.finishedOn);
  const year = today.slice(0, 4);
  const yearLogs = logs.filter((l) => l.date.startsWith(year));
  const added = yearLogs.filter((l) => l.kind === "add");
  const harvested = yearLogs.filter((l) => l.kind === "harvest");
  return { active: active.length, total: piles.length, adds: added.length, harvests: harvested.length };
}

const inputStyle = {
  width: "100%", minHeight: 48, padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${nl.line}`,
  background: nl.card, color: nl.ink, font: `400 16px ${font.body}`, boxSizing: "border-box",
};
const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: nl.soft, margin: "10px 2px 6px" };
const Ico = ({ I }) => <I size={20} strokeWidth={1.8} aria-hidden="true" />;

function PileForm({ pile, onSave, onCancel, onDelete }) {
  const [name, setName] = useState(pile ? pile.name : "");
  const [kind, setKind] = useState(pile ? pile.kind : "pile");
  const [method, setMethod] = useState(pile ? pile.method : "hot");
  const [startedOn, setStartedOn] = useState(pile && pile.startedOn ? pile.startedOn : isoDay());
  const [turnEvery, setTurnEvery] = useState(pile ? String(pile.turnEveryDays || "") : "7");
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <div>
      <h2 style={{ margin: "0 4px 6px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>{pile ? "Edit pile" : "Start a compost pile"}</h2>
      <label style={labelStyle} htmlFor="cp-name">Name</label>
      <input id="cp-name" style={inputStyle} value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="Back bin, Pile 1, Worm bin" />
      <div style={labelStyle}>What kind</div>
      <div role="radiogroup" aria-label="What kind" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {PILE_KINDS.map((k) => <Chip key={k.key} selected={kind === k.key} onClick={() => setKind(k.key)}>{k.label}</Chip>)}
      </div>
      <div style={labelStyle}>How you run it</div>
      <div role="radiogroup" aria-label="How you run it" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {METHODS.map((m) => <Chip key={m.key} selected={method === m.key} onClick={() => { setMethod(m.key); if (!pile) setTurnEvery(m.turn ? String(m.turn) : ""); }}>{m.label}</Chip>)}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle} htmlFor="cp-start">Started</label>
          <input id="cp-start" type="date" style={inputStyle} value={startedOn} onChange={(e) => setStartedOn(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle} htmlFor="cp-turn">Remind me to turn every</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input id="cp-turn" type="number" inputMode="numeric" min={0} max={90} style={inputStyle} value={turnEvery} onChange={(e) => setTurnEvery(e.target.value)} placeholder="No reminder" />
            <span style={{ fontSize: 14, color: nl.soft }}>days</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <Button onClick={() => onSave({ ...(pile || {}), id: pile ? pile.id : newId(), name: name.trim() || "Compost pile", kind, method, startedOn: ISO.test(startedOn) ? startedOn : isoDay(), turnEveryDays: Math.max(0, Math.min(90, Math.round(Number(turnEvery) || 0))), finishedOn: pile ? pile.finishedOn || "" : "" })}>
          {pile ? "Save" : "Start the pile"}
        </Button>
        <Button kind="quiet" onClick={onCancel}>Cancel</Button>
        {pile && onDelete && (confirmDel
          ? <Button kind="quiet" onClick={() => onDelete(pile.id)} style={{ color: nl.alert }}>Delete pile and its logs</Button>
          : <Button kind="quiet" icon={<Trash2 size={18} />} onClick={() => setConfirmDel(true)}>Delete</Button>)}
      </div>
    </div>
  );
}

function LogForm({ pile, kind, onSave, onCancel }) {
  const [date, setDate] = useState(isoDay());
  const [addType, setAddType] = useState("green");
  const [what, setWhat] = useState("");
  const [amount, setAmount] = useState("");
  const [amountUnit, setAmountUnit] = useState(kind === "harvest" ? "wheelbarrow" : "bucket");
  const [temp, setTemp] = useState("");
  const [bed, setBed] = useState("");
  const [note, setNote] = useState("");
  const titles = { add: `Add to ${pile.name}`, turn: `Turned ${pile.name}`, temp: `${pile.name} temperature`, water: `Watered ${pile.name}`, harvest: `Finished compost from ${pile.name}` };
  const canSave = kind !== "temp" || (temp !== "" && fFromInput(temp) != null);
  const save = () => {
    if (!canSave) return;
    const n = Number(amount);
    onSave({
      id: newId(), pileId: pile.id, date: ISO.test(date) ? date : isoDay(), kind,
      ...(kind === "add" ? { type: addType, what: what.trim().slice(0, 80) } : {}),
      ...((kind === "add" || kind === "harvest") && n > 0 ? { amount: Math.round(n * 100) / 100, amountUnit } : {}),
      ...(kind === "temp" ? { tempF: fFromInput(temp) } : {}),
      ...(kind === "harvest" && bed.trim() ? { bed: bed.trim().slice(0, 60) } : {}),
      ...(note.trim() ? { note: note.trim().slice(0, 200) } : {}),
    });
  };
  return (
    <div>
      <h2 style={{ margin: "0 4px 6px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>{titles[kind]}</h2>
      {kind === "add" && (
        <>
          <div role="radiogroup" aria-label="What did you add" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            {ADD_TYPES.map((t) => <Chip key={t.key} selected={addType === t.key} onClick={() => setAddType(t.key)}>{t.label}</Chip>)}
          </div>
          <div style={{ fontSize: 13, color: nl.soft, margin: "6px 4px 0" }}>{ADD_TYPES.find((t) => t.key === addType).hint}</div>
          <label style={labelStyle} htmlFor="cl-what">What was it? (optional)</label>
          <input id="cl-what" style={inputStyle} value={what} onChange={(e) => setWhat(e.target.value)} placeholder={addType === "brown" ? "Fall leaves" : addType === "manure" ? "Coop cleanout" : "Kitchen scraps"} />
        </>
      )}
      {(kind === "add" || kind === "harvest") && (
        <>
          <label style={labelStyle} htmlFor="cl-amt">How much (optional)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input id="cl-amt" type="number" inputMode="decimal" min={0} style={{ ...inputStyle, flex: "0 0 110px" }} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2" />
            <select aria-label="Amount unit" style={{ ...inputStyle, flex: 1 }} value={amountUnit} onChange={(e) => setAmountUnit(e.target.value)}>
              {AMOUNT_UNITS().map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
            </select>
          </div>
        </>
      )}
      {kind === "temp" && (
        <>
          <label style={labelStyle} htmlFor="cl-temp">Temperature in the middle ({tempUnitLabel()})</label>
          <input id="cl-temp" type="number" inputMode="decimal" style={inputStyle} value={temp} onChange={(e) => setTemp(e.target.value)} placeholder={String(tempFromF(140))} autoFocus />
          <div style={{ fontSize: 13, color: nl.soft, margin: "6px 4px 0" }}>A hot pile runs {fmtTemp(130)} to {fmtTemp(160)}.</div>
        </>
      )}
      {kind === "harvest" && (
        <>
          <label style={labelStyle} htmlFor="cl-bed">Where did it go? (optional)</label>
          <input id="cl-bed" style={inputStyle} value={bed} onChange={(e) => setBed(e.target.value)} placeholder="Tomato bed, raised beds, orchard" />
        </>
      )}
      <label style={labelStyle} htmlFor="cl-date">Date</label>
      <input id="cl-date" type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      <label style={labelStyle} htmlFor="cl-note">Note (optional)</label>
      <input id="cl-note" style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "turn" ? "Steaming in the middle" : ""} />
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Button onClick={save} disabled={!canSave}>Save</Button>
        <Button kind="quiet" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function logLine(l) {
  if (l.kind === "add") {
    const t = ADD_TYPES.find((x) => x.key === l.type);
    return [`Added ${l.what || (t ? t.label.toLowerCase() : "material")}`, l.amount ? `${l.amount} ${unitLabel(l.amountUnit, l.amount)}` : ""].filter(Boolean).join(", ");
  }
  if (l.kind === "turn") return "Turned it";
  if (l.kind === "temp") return `Temperature ${fmtTemp(l.tempF)}`;
  if (l.kind === "water") return "Watered it";
  if (l.kind === "harvest") return [`Took out finished compost${l.amount ? `, ${l.amount} ${unitLabel(l.amountUnit, l.amount)}` : ""}`, l.bed ? `for ${l.bed}` : ""].filter(Boolean).join(" ");
  return "Logged";
}

function PileDetail({ pile, logs, today, onLog, onEdit, onFinish, onReopen, onDeleteLog, onBack }) {
  const st = pileStatus(pile, logs, today);
  const mine = logs.filter((l) => l.pileId === pile.id).sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
  return (
    <div>
      <button type="button" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 44, border: "none", background: "none", color: nl.ink, font: `600 14px ${font.body}`, cursor: "pointer", padding: "0 4px" }}>
        <ChevronLeft size={20} /> All piles
      </button>
      <h2 style={{ margin: "0 4px 2px", fontFamily: font.display, fontWeight: 400, fontSize: 26, overflowWrap: "anywhere" }}>{pile.name}</h2>
      <div style={{ fontSize: 14, color: nl.soft, margin: "0 4px 10px" }}>
        {[PILE_KINDS.find((k) => k.key === pile.kind).label, pile.method === "hot" ? "hot" : "cold", st.age != null ? (st.age === 0 ? "started today" : `started ${st.age} day${st.age === 1 ? "" : "s"} ago`) : null, pile.finishedOn ? `finished ${shortDate(pile.finishedOn)}` : null].filter(Boolean).join(" · ")}
      </div>
      <StatusCard pile={pile} st={st} />
      {!pile.finishedOn && <ActionButtons onLog={(k) => onLog(pile, k)} />}
      <Card style={{ marginTop: 12 }}>
        <CardHeader title="History" right={mine.length ? `${mine.length}` : null} />
        {mine.length === 0 && <div style={{ padding: "2px 14px 14px", fontSize: 14, color: nl.soft }}>Nothing logged yet.</div>}
        {mine.slice(0, 60).map((l) => (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: `1px solid ${nl.rule}` }}>
            <span style={{ width: 52, flexShrink: 0, fontSize: 13, color: nl.soft }}>{shortDate(l.date)}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 15, overflowWrap: "anywhere" }}>{logLine(l)}{l.note ? <span style={{ display: "block", fontSize: 13, color: nl.soft }}>{l.note}</span> : null}</span>
            <button type="button" aria-label={`Delete: ${logLine(l)}, ${shortDate(l.date)}`} onClick={() => onDeleteLog(l.id)} style={{ width: 44, height: 44, border: "none", background: "none", color: nl.soft, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </Card>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <Button kind="quiet" onClick={() => onEdit(pile)}>Edit pile</Button>
        {pile.finishedOn
          ? <Button kind="quiet" onClick={() => onReopen(pile.id)}>Start it up again</Button>
          : <Button kind="quiet" onClick={() => onFinish(pile.id)}>It's all used up</Button>}
      </div>
    </div>
  );
}

function StatusCard({ pile, st }) {
  const lines = [];
  if (!pile.finishedOn) {
    lines.push(st.lastTurn ? `Turned ${st.sinceTurn === 0 ? "today" : `${st.sinceTurn} day${st.sinceTurn === 1 ? "" : "s"} ago`}` : pile.method === "hot" ? "Not turned yet" : null);
    if (st.lastTemp) lines.push(`${fmtTemp(st.lastTemp.tempF)} on ${shortDate(st.lastTemp.date)}. ${st.tempNote}`);
    if (st.mix) lines.push(st.mix.text);
  }
  const shown = lines.filter(Boolean);
  if (!shown.length && !st.dueTurn) return null;
  return (
    <Card padded style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {st.dueTurn && <div><Badge tone="ready">Time to turn</Badge></div>}
      {shown.map((t) => <div key={t} style={{ fontSize: 14, lineHeight: 1.45 }}>{t}</div>)}
    </Card>
  );
}

function ActionButtons({ onLog }) {
  const acts = [
    { k: "add", label: "Added", I: Plus, primary: true },
    { k: "turn", label: "Turned", I: RotateCw },
    { k: "temp", label: "Temp", I: Thermometer },
    { k: "water", label: "Watered", I: Droplet },
    { k: "harvest", label: "Took out", I: ShoppingBasket },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6, marginTop: 10 }}>
      {acts.map((a) => (
        <button key={a.k} type="button" onClick={() => onLog(a.k)} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 0", minHeight: 64, borderRadius: 14, cursor: "pointer",
          background: a.primary ? nl.yolk : nl.card, border: `1px solid ${a.primary ? nl.yolk : nl.line}`, color: a.primary ? nl.onYolk : nl.ink, font: `600 12px ${font.body}`,
        }}><a.I size={20} strokeWidth={1.8} aria-hidden="true" />{a.label}</button>
      ))}
    </div>
  );
}

export default function CompostSheet({ open, onClose, hobby, update, startPileId = null }) {
  const today = isoDay();
  const { piles, logs } = useMemo(() => compostOf(hobby), [hobby]);
  const [view, setView] = useState(startPileId ? { v: "pile", id: startPileId } : { v: "list" });
  const [showDone, setShowDone] = useState(false);
  const write = (fn) => update((d) => {
    const h = (d.hobbies || []).find((x) => x.id === hobby.id);
    if (!h) return d;
    const c = compostOf(h);
    fn(c);
    h.compost = { piles: c.piles, logs: c.logs.slice(-2000) };
    return d;
  });
  const savePile = (p) => {
    write((c) => { const i = c.piles.findIndex((x) => x.id === p.id); if (i >= 0) c.piles[i] = p; else c.piles.push(p); });
    setView({ v: "pile", id: p.id });
  };
  const deletePile = (id) => { write((c) => { c.piles = c.piles.filter((x) => x.id !== id); c.logs = c.logs.filter((l) => l.pileId !== id); }); setView({ v: "list" }); };
  const saveLog = (l) => { write((c) => { c.logs.push(l); }); setView({ v: "pile", id: l.pileId }); };
  const quickLog = (pile, kind) => {
    if (kind === "turn" || kind === "water") saveLog({ id: newId(), pileId: pile.id, date: today, kind });
    else setView({ v: "log", id: pile.id, kind });
  };
  const deleteLog = (id) => write((c) => { c.logs = c.logs.filter((l) => l.id !== id); });
  const setFinished = (id, on) => write((c) => { const p = c.piles.find((x) => x.id === id); if (p) p.finishedOn = on ? today : ""; });

  const active = piles.filter((p) => !p.finishedOn);
  const done = piles.filter((p) => p.finishedOn);
  const pile = view.id ? piles.find((p) => p.id === view.id) : null;

  let body;
  if (view.v === "new" || (view.v === "edit" && pile)) {
    body = <PileForm pile={view.v === "edit" ? pile : null} onSave={savePile} onCancel={() => setView(pile ? { v: "pile", id: pile.id } : { v: "list" })} onDelete={deletePile} />;
  } else if (view.v === "log" && pile) {
    body = <LogForm pile={pile} kind={view.kind} onSave={saveLog} onCancel={() => setView({ v: "pile", id: pile.id })} />;
  } else if (view.v === "pile" && pile) {
    body = <PileDetail pile={pile} logs={logs} today={today} onLog={quickLog} onEdit={(p) => setView({ v: "edit", id: p.id })}
      onFinish={(id) => setFinished(id, true)} onReopen={(id) => setFinished(id, false)} onDeleteLog={deleteLog} onBack={() => setView({ v: "list" })} />;
  } else {
    body = (
      <div>
        <h2 style={{ margin: "0 4px 4px", fontFamily: font.display, fontWeight: 400, fontSize: 26 }}>Compost</h2>
        {piles.length === 0 ? (
          <>
            <p style={{ margin: "0 4px 12px", fontSize: 15, color: nl.soft, lineHeight: 1.5 }}>
              Keep track of what goes in, when you turned it, how hot it's running, and where the finished compost went. It'll remind you when a pile is due for a turn.
            </p>
            <Button icon={<Plus size={20} />} onClick={() => setView({ v: "new" })}>Start a compost pile</Button>
          </>
        ) : (
          <>
            {active.map((p) => {
              const st = pileStatus(p, logs, today);
              return (
                <Card key={p.id} style={{ marginTop: 10 }}>
                  <Row first icon={<Ico I={Recycle} />} iconBg={st.dueTurn ? nl.yolkTint : undefined}
                    title={p.name}
                    sub={[st.lastTurn ? `Turned ${st.sinceTurn === 0 ? "today" : `${st.sinceTurn}d ago`}` : null, st.lastTemp ? fmtTemp(st.lastTemp.tempF) : null, st.age != null ? (st.age === 0 ? "started today" : `${st.age} day${st.age === 1 ? "" : "s"} old`) : null].filter(Boolean).join(" · ") || PILE_KINDS.find((k) => k.key === p.kind).label}
                    trailing={st.dueTurn ? <Badge tone="ready">Turn it</Badge> : null}
                    onClick={() => setView({ v: "pile", id: p.id })} chevron />
                  <div style={{ padding: "0 14px 12px" }}><ActionButtons onLog={(k) => quickLog(p, k)} /></div>
                </Card>
              );
            })}
            <div style={{ marginTop: 12 }}><Button kind="quiet" icon={<Plus size={18} />} onClick={() => setView({ v: "new" })}>Start another pile</Button></div>
            {done.length > 0 && (
              <Card style={{ marginTop: 12 }}>
                <Row first title={`Finished piles (${done.length})`} sub="Tap to look back or start one up again" onClick={() => setShowDone((v) => !v)} chevron />
                {showDone && done.map((p) => <Row key={p.id} title={p.name} sub={`Finished ${shortDate(p.finishedOn)}`} onClick={() => setView({ v: "pile", id: p.id })} chevron />)}
              </Card>
            )}
          </>
        )}
      </div>
    );
  }
  return (
    <Sheet open={open} onClose={onClose} label="Compost" showClose maxHeight="92vh">
      <div style={{ fontSize: type.body }}>{body}</div>
    </Sheet>
  );
}
