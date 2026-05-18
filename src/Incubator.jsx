// ============================================================================
// INCUBATOR — tracks hatching runs by bird type with auto calendar reminders
// ============================================================================
import React, { useState, useMemo } from "react";
import { X, Edit3, Trash2, Plus, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47", featherSoft: "#C9A77B",
  honey: "#E8961A", line: "#2C181030", card: "#FAF5EA",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
};

const newId = () => Math.random().toString(36).slice(2, 10);
const localDateStr = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const todayStr = () => localDateStr(new Date());
const parseLocalDate = (s) => { if (!s) return new Date(); const [y,m,d] = s.split("-").map(Number); return new Date(y,(m||1)-1,d||1); };
const fmtDate = (s) => { if (!s) return ""; return parseLocalDate(s).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); };
const addDays = (dateStr, days) => localDateStr(new Date(parseLocalDate(dateStr).getTime() + days*24*60*60*1000));

// Incubation periods per bird type
const BIRD_INCUBATION = {
  Chicken: { lockdown: 18, hatch: 21, turnStop: 18 },
  Duck:    { lockdown: 25, hatch: 28, turnStop: 25 },
  Turkey:  { lockdown: 25, hatch: 28, turnStop: 25 },
  Quail:   { lockdown: 14, hatch: 17, turnStop: 14 },
  Goose:   { lockdown: 27, hatch: 30, turnStop: 27 },
  Guinea:  { lockdown: 24, hatch: 28, turnStop: 24 },
  Other:   { lockdown: 18, hatch: 21, turnStop: 18 },
};

const BIRD_TYPES = Object.keys(BIRD_INCUBATION);
const BIRD_EMOJI = { Chicken:"🐔", Duck:"🦆", Turkey:"🦃", Quail:"🐦", Goose:"🪿", Guinea:"🐦‍⬛", Other:"🐣" };

// ============================================================================
// AGE FORMATTING — for chicks/birds since their hatch date.
// Format escalates from days → weeks → months → years so glance-readability
// matches how owners actually think about their birds at each stage.
// ============================================================================
const fmtAgeSince = (isoDate) => {
  if (!isoDate) return "";
  const days = Math.floor((new Date() - parseLocalDate(isoDate)) / (1000 * 60 * 60 * 24));
  if (days < 0) return "";
  if (days === 0) return "today";
  if (days === 1) return "1 day old";
  if (days < 14) return `${days} days old`;
  if (days < 60) {
    const w = Math.floor(days / 7);
    return `${w} week${w === 1 ? "" : "s"} old`;
  }
  if (days < 730) {
    const m = Math.floor(days / 30.44);
    return `${m} month${m === 1 ? "" : "s"} old`;
  }
  const yrs = Math.floor(days / 365.25);
  return `${yrs} year${yrs === 1 ? "" : "s"} old`;
};

// Sum disposition counts to get remaining chicks in a brooder batch.
const remainingInBrooder = (batch) => {
  if (!batch) return 0;
  const disposed = (batch.dispositions || []).reduce((s, d) => s + (Number(d.count) || 0), 0);
  return Math.max(0, (batch.initialCount || 0) - disposed);
};

function Btn({ children, onClick, variant="primary", small=false, style={}, disabled=false }) {
  const styles = {
    primary: { background: palette.ink, color: palette.bg, border: `1.5px solid ${palette.ink}` },
    danger:  { background: palette.accent, color: palette.bg, border: `1.5px solid ${palette.accent}` },
    ghost:   { background: "transparent", color: palette.ink, border: `1.5px solid ${palette.line}` },
    accent:  { background: palette.yolk, color: palette.ink, border: `1.5px solid ${palette.ink}` },
  };
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      padding: small ? "6px 12px" : "10px 18px", borderRadius: 8,
      cursor: disabled ? "not-allowed" : "pointer", fontFamily: FONT_BODY,
      fontWeight: 600, fontSize: small ? 13 : 14, opacity: disabled ? 0.6 : 1,
      boxShadow: "2px 2px 0 " + palette.line, ...styles[variant], ...style,
    }}>{children}</button>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(44,24,16,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:palette.bg,borderRadius:16,maxWidth:480,width:"100%",maxHeight:"92vh",overflow:"auto",border:`2px solid ${palette.ink}`,boxShadow:`6px 8px 0 ${palette.line}`,fontFamily:FONT_BODY }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1.5px solid ${palette.line}` }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:22,color:palette.ink }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{ background:"none",border:"none",cursor:"pointer",color:palette.ink,padding:4 }}><X size={22}/></button>
        </div>
        <div style={{ padding:20 }}>{children}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent=palette.accent }) {
  return (
    <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,flex:"1 1 140px",minWidth:140,boxSizing:"border-box" }}>
      <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:22,fontFamily:FONT_DISPLAY,color:accent,lineHeight:1.1 }}>{value}</div>
      {sub && <div style={{ fontSize:11,color:palette.inkSoft,marginTop:4 }}>{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:12 }}>
      <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,marginBottom:10,color:palette.ink }}>{title}</div>
      {children}
    </div>
  );
}

// ============================================================================
// ADD / EDIT RUN MODAL
// ============================================================================
function RunModal({ run, hobbyId, update, onClose }) {
  const isEdit = !!run;
  const [name, setName] = useState(run?.name || "");
  const [birdType, setBirdType] = useState(run?.birdType || "Chicken");
  const [eggsSet, setEggsSet] = useState(run?.eggsSet != null ? String(run.eggsSet) : "");
  const [dateSet, setDateSet] = useState(run?.dateSet || todayStr());
  const [variety, setVariety] = useState(run?.variety || "");
  const [source, setSource] = useState(run?.source || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const incubation = BIRD_INCUBATION[birdType] || BIRD_INCUBATION.Chicken;
  const lockdownDate = dateSet ? addDays(dateSet, incubation.lockdown) : "";
  const hatchDate = dateSet ? addDays(dateSet, incubation.hatch) : "";

  const save = () => {
    const n = parseInt(eggsSet);
    if (!n || n < 1 || !dateSet) return;
    const id = run?.id || newId();
    const runData = {
      id, name: name.trim() || `${birdType} run`, birdType, variety, source,
      eggsSet: n, dateSet,
      lockdownDate, hatchDate,
      status: run?.status || "incubating", // incubating | lockdown | hatched | closed
      eggsHatched: run?.eggsHatched ?? null,
      notes: run?.notes || "",
      created: run?.created || Date.now(),
    };
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      if (!Array.isArray(h.runs)) h.runs = [];
      if (isEdit) {
        const idx = h.runs.findIndex(r => r.id === id);
        if (idx !== -1) h.runs[idx] = runData; else h.runs.push(runData);
      } else {
        h.runs.push(runData);
      }
      return d;
    });
    onClose();
  };

  const remove = () => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (h) h.runs = (h.runs||[]).filter(r => r.id !== run.id);
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit run" : "Start a new run"}>
      <Field label="Run name (optional)">
        <input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} placeholder={`${birdType} run`} autoFocus />
      </Field>
      <Field label="Bird type">
        <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
          {BIRD_TYPES.map(t => (
            <button key={t} onClick={() => setBirdType(t)} style={{
              padding:"8px 12px",borderRadius:8,fontFamily:FONT_BODY,fontWeight:600,fontSize:13,cursor:"pointer",
              border:`1.5px solid ${birdType===t?palette.ink:palette.line}`,
              background:birdType===t?palette.ink:palette.card,
              color:birdType===t?palette.bg:palette.ink,
            }}>{BIRD_EMOJI[t]} {t}</button>
          ))}
        </div>
      </Field>
      <div style={{ display:"flex",gap:12 }}>
        <div style={{ flex:1 }}>
          <Field label="Variety / breed (optional)">
            <input style={inputStyle} value={variety} onChange={e=>setVariety(e.target.value)} placeholder="e.g. Rhode Island Red" />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Source (optional)">
            <input style={inputStyle} value={source} onChange={e=>setSource(e.target.value)} placeholder="e.g. Own flock" />
          </Field>
        </div>
      </div>
      <div style={{ display:"flex",gap:12 }}>
        <div style={{ flex:1 }}>
          <Field label="Eggs set">
            <input type="number" min={1} style={inputStyle} value={eggsSet} onChange={e=>setEggsSet(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Date set">
            <input type="date" style={inputStyle} value={dateSet} onChange={e=>setDateSet(e.target.value)} />
          </Field>
        </div>
      </div>

      {dateSet && eggsSet && (
        <div style={{ background:palette.yolkSoft,borderRadius:10,padding:"12px 14px",marginBottom:14 }}>
          <div style={{ fontSize:12,fontWeight:700,color:palette.ink,marginBottom:8 }}>📅 Estimated dates for {birdType}</div>
          <div style={{ fontSize:13,color:palette.ink,display:"flex",flexDirection:"column",gap:4 }}>
            <div>🔒 Lockdown (stop turning): <strong>{fmtDate(lockdownDate)}</strong> <span style={{fontSize:11,color:palette.inkSoft}}>day {incubation.lockdown}</span></div>
            <div>🐣 Estimated hatch: <strong>{fmtDate(hatchDate)}</strong> <span style={{fontSize:11,color:palette.inkSoft}}>day {incubation.hatch}</span></div>
          </div>
        </div>
      )}

      <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
        <Btn onClick={save}>
          {isEdit ? "Save changes" : `Start run — ${eggsSet||0} eggs`}
        </Btn>
        {isEdit && !confirmDelete && <Btn variant="ghost" onClick={() => setConfirmDelete(true)}>Delete run</Btn>}
        {isEdit && confirmDelete && <Btn variant="danger" onClick={remove}>Confirm delete</Btn>}
      </div>
    </Modal>
  );
}

// ============================================================================
// LOG HATCH MODAL — record hatch results
// ============================================================================
// ============================================================================
// CANDLE MODAL — log mid-incubation fertility check. Around day 7-12 for
// chickens, day 10-14 for waterfowl, day 7 for quail (varies by species).
// User shines a light through each egg and removes ones with no development.
// We record `candledCount` (the number that made it through) and `candledOn`
// (the date) on the run. Two derived stats become available afterward:
//   - candling survival = candledCount / eggsSet
//   - hatch rate from candled = eggsHatched / candledCount
//   - overall hatch rate = eggsHatched / eggsSet (already shown)
// ============================================================================
function CandleModal({ run, hobbyId, update, onClose }) {
  // Pre-fill from existing values when editing a previously-logged candling.
  const [candled, setCandled] = useState(run.candledCount != null ? String(run.candledCount) : "");
  const [date, setDate] = useState(run.candledOn || todayStr());
  const [notes, setNotes] = useState(run.candleNotes || "");
  // Whether the user actually removed the undeveloped eggs from the
  // incubator (vs just checking and leaving everything in). Drives the
  // "active eggs in incubator" count displayed on the run card.
  // Default ON because that's by far the more common workflow — if you
  // candled, you usually pulled the duds. User can uncheck for the rare
  // "just observing" case.
  const [discard, setDiscard] = useState(
    run.discardedAfterCandle != null ? run.discardedAfterCandle : true
  );

  // Live preview of survival rate as user types
  const previewSurvival = candled && run.eggsSet
    ? ((Number(candled) / run.eggsSet) * 100).toFixed(1)
    : null;
  const removed = candled ? Math.max(0, run.eggsSet - (Number(candled) || 0)) : 0;

  const save = () => {
    const c = Number(candled);
    if (isNaN(c) || c < 0 || c > run.eggsSet) return;
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      const r = (h.runs || []).find(x => x.id === run.id);
      if (r) {
        r.candledCount = c;
        r.candledOn = date;
        r.candleNotes = notes.trim();
        r.discardedAfterCandle = discard;
      }
      return d;
    });
    onClose();
  };

  const isEdit = run.candledCount != null;

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit candling" : "Log candling"}>
      <div style={{
        background: palette.bgAlt, borderRadius: 8, padding: "10px 12px",
        marginBottom: 12, fontSize: 12, color: palette.inkSoft, lineHeight: 1.5,
      }}>
        💡 Candling shines a light through each egg to check for development.
        Typical days: chickens day 7-12 · waterfowl day 10-14 · quail day 7.
        Log the number that <strong>kept developing</strong> (the keepers).
      </div>
      <Field label="Date candled">
        <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <Field label={`Eggs that showed development (of ${run.eggsSet} set)`}>
        <input
          type="number" min={0} max={run.eggsSet}
          style={inputStyle} value={candled}
          onChange={e => setCandled(e.target.value)}
          placeholder="0" autoFocus inputMode="numeric"
        />
      </Field>
      {/* Discard checkbox — only meaningful when at least one egg was
          removed. Tapping the whole row flips the box so it works on
          touch without aiming at the tiny native checkbox. */}
      {removed > 0 && (
        <div
          onClick={() => setDiscard(!discard)}
          style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "10px 12px", marginBottom: 12,
            background: discard ? palette.yolkSoft : palette.card,
            border: `1.5px solid ${discard ? palette.yolk : palette.line}`,
            borderRadius: 8, cursor: "pointer",
          }}
        >
          <input
            type="checkbox" checked={discard}
            onChange={() => setDiscard(!discard)}
            onClick={e => e.stopPropagation()}
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <div style={{ fontSize: 13, color: palette.ink, lineHeight: 1.4 }}>
            <div style={{ fontWeight: 600 }}>Discard undeveloped eggs</div>
            <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 2 }}>
              Removes the {removed} undeveloped egg{removed === 1 ? "" : "s"} from the active count, so the incubator shows {candled} eggs going forward.
            </div>
          </div>
        </div>
      )}
      <Field label="Notes (optional)">
        <textarea
          style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
          value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="What you saw, which eggs you removed, etc."
        />
      </Field>
      {previewSurvival !== null && (
        <div style={{
          background: palette.yolkSoft, borderRadius: 8, padding: "10px 12px",
          fontSize: 13, color: palette.ink, marginBottom: 12, lineHeight: 1.5,
        }}>
          🥚 Survival to candling: <strong>{previewSurvival}%</strong>
          {" "}({candled} of {run.eggsSet})
          {removed > 0 && <> · {removed} removed</>}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!candled}>{isEdit ? "Save changes" : "Log candling"}</Btn>
      </div>
    </Modal>
  );
}
function LogHatchModal({ run, hobbyId, update, onClose, onAfterSave }) {

  const [hatched, setHatched] = useState(run.eggsHatched != null ? String(run.eggsHatched) : "");
  const [notes, setNotes] = useState(run.notes || "");
  const hatchRate = hatched && run.eggsSet ? ((Number(hatched)/run.eggsSet)*100).toFixed(1) : null;
  const wasAlreadyHatched = run.status === "hatched";

  const save = () => {
    const hatchedCount = Number(hatched) || 0;
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      const r = (h.runs||[]).find(x => x.id === run.id);
      if (r) {
        r.eggsHatched = hatchedCount;
        r.notes = notes;
        r.status = "hatched";
        // Preserve original hatch date on re-edits so age math stays anchored.
        if (!r.hatchedDate) r.hatchedDate = todayStr();
      }
      return d;
    });
    // If this is a NEW hatch (not re-editing) AND any chicks hatched,
    // chain into the "Move to brooder" prompt. The parent decides whether
    // to show the modal — we just signal that it should.
    if (!wasAlreadyHatched && hatchedCount > 0 && onAfterSave) {
      onAfterSave({ runId: run.id, hatchedCount });
    } else {
      onClose();
    }
  };

  return (
    <Modal open onClose={onClose} title="Log hatch results">
      <div style={{ marginBottom:14,padding:"10px 12px",background:palette.bgAlt,borderRadius:8,fontSize:13,color:palette.ink }}>
        <strong>{run.name}</strong> · {run.eggsSet} eggs set · {BIRD_EMOJI[run.birdType]} {run.birdType}
        {run.candledCount != null && (
          <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4 }}>
            💡 {run.candledCount} survived candling ({((run.candledCount / run.eggsSet) * 100).toFixed(0)}%)
            {run.discardedAfterCandle && (
              <> · {run.candledCount} active in incubator</>
            )}
          </div>
        )}
      </div>
      <Field label="Eggs hatched">
        {/* When the user discarded after candling, cap the hatch input at the
            active count rather than the original set count — otherwise the
            field would let them type more than physically possible. */}
        <input
          type="number" min={0}
          max={run.discardedAfterCandle && run.candledCount != null ? run.candledCount : run.eggsSet}
          style={inputStyle} value={hatched}
          onChange={e=>setHatched(e.target.value)}
          placeholder="0" autoFocus
        />
      </Field>
      {hatchRate && (
        <div style={{ background:palette.yolkSoft,borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:13,color:palette.ink }}>
          🐣 Hatch rate: <strong>{hatchRate}%</strong> ({hatched} of {run.eggsSet} overall)
          {run.candledCount != null && Number(hatched) > 0 && run.candledCount > 0 && (
            <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 3 }}>
              From candled keepers: {((Number(hatched) / run.candledCount) * 100).toFixed(0)}% ({hatched} of {run.candledCount})
            </div>
          )}
        </div>
      )}
      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle,minHeight:70 }} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Humidity, temp issues, quitters..." />
      </Field>
      <Btn onClick={save} disabled={!hatched}>Log hatch</Btn>
    </Modal>
  );
}

// ============================================================================
// MOVE TO BROODER MODAL
// ----------------------------------------------------------------------------
// Triggered either right after logging a fresh hatch (auto-chained), OR
// manually from a completed RunCard. Pre-populates initialCount from the
// run's eggsHatched but lets the user adjust (e.g., late losses before the
// chicks made it to the brooder, or splitting a run across brooders).
// ============================================================================
function MoveToBrooderModal({ run, hobbyId, update, onClose }) {
  const [name, setName] = useState(`${run.birdType} chicks from ${run.name}`);
  const [initialCount, setInitialCount] = useState(
    run.eggsHatched != null ? String(run.eggsHatched) : ""
  );
  const [startDate, setStartDate] = useState(run.hatchedDate || todayStr());
  const [notes, setNotes] = useState("");

  const canSave = parseInt(initialCount, 10) > 0;

  const save = () => {
    if (!canSave) return;
    const count = parseInt(initialCount, 10);
    const brooderBatchId = newId();
    // Reminder ~6 weeks out — typical age when chicks are feathered enough
    // to leave the heated brooder and move to outdoor coop. Stored alongside
    // other incubator calendar events using the existing `type` field convention.
    const readyDate = addDays(startDate, 42);
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      if (!Array.isArray(h.brooderBatches)) h.brooderBatches = [];
      h.brooderBatches.push({
        id: brooderBatchId,
        sourceBatchId: run.id,        // link back to the originating run
        name: name.trim() || `${run.birdType} chicks`,
        startDate,
        initialCount: count,
        birdType: run.birdType,
        variety: run.variety || "",
        notes: notes.trim(),
        dispositions: [],
        archived: false,
        created: Date.now(),
      });
      // Auto-add a "ready to move out" calendar reminder. Only add if no
      // existing event is tied to this brooder batch to avoid duplicates if
      // the user re-opens this flow somehow.
      if (!Array.isArray(d.calendarEvents)) d.calendarEvents = [];
      const alreadyHas = d.calendarEvents.some(e => e.brooderBatchId === brooderBatchId);
      if (!alreadyHas) {
        d.calendarEvents.push({
          id: newId(),
          date: readyDate,
          title: `🐥 Brooder ready: ${name.trim() || run.birdType}`,
          type: "brooder_ready",
          notes: `${count} ${run.birdType.toLowerCase()} chicks should be feathered enough to leave the brooder.`,
          brooderBatchId,
        });
      }
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="🐣 Move to brooder">
      <div style={{ marginBottom: 14, padding: "10px 12px", background: palette.leafSoft, borderRadius: 8, fontSize: 13, color: palette.ink, lineHeight: 1.5 }}>
        {run.eggsHatched} chicks hatched from <strong>{run.name}</strong>. Move them into a brooder batch so you can track what happens next.
      </div>
      <Field label="Brooder batch name">
        <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. May 2026 chicks" autoFocus />
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Chicks in brooder">
            <input type="number" min={1} style={inputStyle} value={initialCount} onChange={e => setInitialCount(e.target.value)} placeholder="0" inputMode="numeric" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Start date">
            <input type="date" style={inputStyle} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </Field>
        </div>
      </div>
      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle, minHeight: 60 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Brooder location, heat source, etc." />
      </Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Skip</Btn>
        <Btn onClick={save} disabled={!canSave}>Create brooder batch</Btn>
      </div>
    </Modal>
  );
}

// ============================================================================
// ADD BROODER MODAL — create a brooder batch directly, no hatch required
// ----------------------------------------------------------------------------
// Many keepers buy day-old chicks shipped from a hatchery — they never run an
// incubation. This modal creates a brooder batch from scratch. The batch it
// writes is IDENTICAL in shape to one created by MoveToBrooderModal, so every
// downstream feature (disposition: sold / moved to flock / died / kept, the
// BrooderBatchCard, survival analytics, the "ready to move out" calendar
// reminder) works the same way — those operate on the batch data, not on how
// it was created. The only differences vs. a hatch-created batch:
//   - sourceBatchId is null (there's no originating run)
//   - birdType is picked by the user instead of inherited from a run
//   - a `source` field records where the chicks came from (the hatchery)
// ============================================================================
function AddBrooderModal({ hobbyId, update, onClose }) {
  const [name, setName] = useState("");
  const [birdType, setBirdType] = useState("Chicken");
  const [initialCount, setInitialCount] = useState("");
  const [startDate, setStartDate] = useState(todayStr());
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");

  const canSave = parseInt(initialCount, 10) > 0;

  const save = () => {
    if (!canSave) return;
    const count = parseInt(initialCount, 10);
    const brooderBatchId = newId();
    // ~6 weeks out: typical age chicks are feathered enough to leave the
    // heated brooder. Same convention as the hatch-created flow.
    const readyDate = addDays(startDate, 42);
    const batchName = name.trim() || `${birdType} chicks`;
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      if (!Array.isArray(h.brooderBatches)) h.brooderBatches = [];
      h.brooderBatches.push({
        id: brooderBatchId,
        sourceBatchId: null,          // no originating run — added directly
        name: batchName,
        startDate,
        initialCount: count,
        birdType,
        variety: "",
        source: source.trim(),        // hatchery / where the chicks came from
        notes: notes.trim(),
        dispositions: [],
        archived: false,
        created: Date.now(),
      });
      if (!Array.isArray(d.calendarEvents)) d.calendarEvents = [];
      const alreadyHas = d.calendarEvents.some(e => e.brooderBatchId === brooderBatchId);
      if (!alreadyHas) {
        d.calendarEvents.push({
          id: newId(),
          date: readyDate,
          title: `🐥 Brooder ready: ${batchName}`,
          type: "brooder_ready",
          notes: `${count} ${birdType.toLowerCase()} chicks should be feathered enough to leave the brooder.`,
          brooderBatchId,
        });
      }
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="🐥 Add a brooder">
      <div style={{ marginBottom: 14, padding: "10px 12px", background: palette.leafSoft, borderRadius: 8, fontSize: 13, color: palette.ink, lineHeight: 1.5 }}>
        Got chicks without hatching them — shipped from a hatchery, or picked up locally? Add them as a brooder batch to track what happens next.
      </div>
      <Field label="Brooder batch name">
        <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. May 2026 shipped chicks" autoFocus />
      </Field>
      <Field label="Bird type">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {BIRD_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setBirdType(t)}
              style={{
                padding: "6px 12px", borderRadius: 8,
                border: `1.5px solid ${birdType === t ? palette.ink : palette.line}`,
                background: birdType === t ? palette.ink : palette.card,
                color: birdType === t ? palette.bg : palette.ink,
                fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              {(BIRD_EMOJI[t] || "🐣") + " " + t}
            </button>
          ))}
        </div>
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Chicks in brooder">
            <input type="number" min={1} style={inputStyle} value={initialCount} onChange={e => setInitialCount(e.target.value)} placeholder="0" inputMode="numeric" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Start date">
            <input type="date" style={inputStyle} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </Field>
        </div>
      </div>
      <Field label="Source (optional)">
        <input style={inputStyle} value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. Murray McMurray Hatchery, local feed store" />
      </Field>
      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle, minHeight: 60 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Brooder location, heat source, breed mix, etc." />
      </Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!canSave}>Create brooder batch</Btn>
      </div>
    </Modal>
  );
}

// ============================================================================
// EDIT BROODER BATCH MODAL
// ============================================================================
// Edit an existing brooder batch's core fields, delete it, or — if it was
// finalized (archived / fully dispositioned) — return it to active. Reachable
// from the edit pencil on any BrooderBatchCard. Mirrors how meat bird batches
// can be edited and restored.
function EditBrooderBatchModal({ batch, hobbyId, data, update, onClose }) {
  const [name, setName] = useState(batch.name || "");
  const [birdType, setBirdType] = useState(batch.birdType || "Chicken");
  const [initialCount, setInitialCount] = useState(String(batch.initialCount || 0));
  const [startDate, setStartDate] = useState(batch.startDate || todayStr());
  const [notes, setNotes] = useState(batch.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // A batch reads as "past" when archived OR every chick is dispositioned.
  const remaining = remainingInBrooder(batch);
  const isPast = !!batch.archived || remaining <= 0;
  // How many chicks went out via "sold" dispositions — used to warn the user
  // that deleting the batch leaves those Sales records in place.
  const soldCount = (batch.dispositions || [])
    .filter(d => d.type === "sold")
    .reduce((s, d) => s + (Number(d.count) || 0), 0);

  const canSave = parseInt(initialCount, 10) >= 0 && name.trim() !== "";

  const save = () => {
    if (!canSave) return;
    const n = parseInt(initialCount, 10) || 0;
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h || !Array.isArray(h.brooderBatches)) return d;
      const idx = h.brooderBatches.findIndex(b => b.id === batch.id);
      if (idx === -1) return d;
      h.brooderBatches[idx] = {
        ...h.brooderBatches[idx],
        name: name.trim(),
        birdType,
        initialCount: n,
        startDate,
        notes: notes.trim(),
      };
      return d;
    });
    onClose();
  };

  // Return to active: clear the archived flag. If every chick was already
  // dispositioned (remaining<=0) the batch would still filter as "past", so
  // we also bump initialCount to whatever the user has in the field — they're
  // told to raise it via the inline hint below.
  const returnToActive = () => {
    const n = parseInt(initialCount, 10) || 0;
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h || !Array.isArray(h.brooderBatches)) return d;
      const idx = h.brooderBatches.findIndex(b => b.id === batch.id);
      if (idx === -1) return d;
      h.brooderBatches[idx] = {
        ...h.brooderBatches[idx],
        archived: false,
        name: name.trim() || h.brooderBatches[idx].name,
        birdType,
        initialCount: n,
        startDate,
        notes: notes.trim(),
      };
      return d;
    });
    onClose();
  };

  // Delete: remove the batch outright. Linked chick-sale records in the Sales
  // tab are intentionally LEFT IN PLACE — a real sale is real revenue. Also
  // clears the "brooder ready" calendar reminder tied to this batch.
  const remove = () => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h || !Array.isArray(h.brooderBatches)) return d;
      h.brooderBatches = h.brooderBatches.filter(b => b.id !== batch.id);
      if (Array.isArray(d.calendarEvents)) {
        d.calendarEvents = d.calendarEvents.filter(e => e.brooderBatchId !== batch.id);
      }
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Edit brooder batch">
      <Field label="Batch name">
        <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Bird type">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {BIRD_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setBirdType(t)}
              style={{
                padding: "8px 12px", borderRadius: 8,
                border: `1.5px solid ${birdType === t ? palette.ink : palette.line}`,
                background: birdType === t ? palette.ink : palette.card,
                color: birdType === t ? palette.bg : palette.ink,
                fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >{BIRD_EMOJI[t]} {t}</button>
          ))}
        </div>
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Chicks (started with)">
            <input type="number" min={0} style={inputStyle} value={initialCount} onChange={e => setInitialCount(e.target.value)} inputMode="numeric" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Start date">
            <input type="date" style={inputStyle} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </Field>
        </div>
      </div>
      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle, minHeight: 60 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Brooder location, heat source, etc." />
      </Field>
      <Btn onClick={save} disabled={!canSave} style={{ width: "100%" }}>Save changes</Btn>

      {/* Past-batch / destructive actions, separated from the primary save. */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${palette.line}` }}>
        {isPast && (
          <>
            <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 8, lineHeight: 1.4 }}>
              This batch is finished. Return it to active if it was closed out by mistake.
              {remaining <= 0 && " Since every chick was dispositioned, raise the \"Chicks (started with)\" count above so the batch has birds in it again."}
            </div>
            <Btn small variant="ghost" onClick={returnToActive} style={{ marginBottom: 10 }}>↩️ Return to active</Btn>
          </>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {!confirmDelete ? (
            <Btn small variant="ghost" onClick={() => setConfirmDelete(true)}>🗑️ Delete batch</Btn>
          ) : (
            <>
              <Btn small variant="primary" onClick={remove}>Yes, delete</Btn>
              <Btn small variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Btn>
            </>
          )}
        </div>
        {confirmDelete && (
          <div style={{ fontSize: 11, color: palette.accent, marginTop: 8, lineHeight: 1.4 }}>
            ⚠️ Removes this brooder batch and its disposition history.
            {soldCount > 0
              ? ` The ${soldCount} chick sale${soldCount === 1 ? "" : "s"} from this batch will stay in your Sales tab.`
              : ""} This can't be undone.
          </div>
        )}
      </div>
    </Modal>
  );
}

// ============================================================================
// BROODER DISPOSITION MODAL
// ----------------------------------------------------------------------------
// The interesting one. Lets the user record what happened to N chicks from
// a brooder batch. Four disposition types:
//   - sold (records price/buyer; pushes to data.sales with hobbyType="incubator")
//   - moved_to_flock (picks a target egg-layer flock or meat-bird batch;
//     increments that target's count)
//   - died (records cause, no further integration)
//   - kept (no-op, just shrinks remaining count)
// Supports partial dispositions: user can disposition 5 of 14, leaving 9
// in the brooder for later.
// ============================================================================
function BrooderDispositionModal({ batch, hobbyId, data, update, onClose }) {
  const remaining = remainingInBrooder(batch);
  const [type, setType] = useState("sold");
  const [count, setCount] = useState("1");
  const [date, setDate] = useState(todayStr());

  // Type-specific fields
  const [pricePerBird, setPricePerBird] = useState("");
  const [soldTo, setSoldTo] = useState("");
  const [targetFlockKey, setTargetFlockKey] = useState(""); // "egg_layers:<flockId>" or "meat_chickens:<batchId>"
  const [cause, setCause] = useState("");
  const [dispNotes, setDispNotes] = useState("");

  // Build target options for "moved to flock" — pulls live flocks/batches
  // from elsewhere in the data tree. Each option carries hobby type + id
  // so the save fn knows where to push the count.
  const flockOptions = useMemo(() => {
    const out = [];
    const eggLayers = (data.hobbies || []).find(h => h.type === "egg_layers");
    if (eggLayers && Array.isArray(eggLayers.flocks)) {
      eggLayers.flocks.forEach(fl => {
        out.push({
          key: `egg_layers:${fl.id}`,
          label: `🥚 ${fl.name || "Flock"} (${fl.birdCount || 0} birds)`,
          hobbyType: "egg_layers",
          targetId: fl.id,
        });
      });
    }
    const meat = (data.hobbies || []).find(h => h.type === "meat_chickens");
    if (meat && Array.isArray(meat.currentBatches)) {
      meat.currentBatches.forEach(b => {
        out.push({
          key: `meat_chickens:${b.id}`,
          label: `🍗 ${b.name || "Meat batch"} (${b.startCount || 0} birds)`,
          hobbyType: "meat_chickens",
          targetId: b.id,
        });
      });
    }
    return out;
  }, [data.hobbies]);

  // Default the target selection to the first option once flocks exist.
  // Skipping this caused targetFlockKey="" and a broken save if user just
  // tapped Save without touching the dropdown.
  React.useEffect(() => {
    if (type === "moved_to_flock" && !targetFlockKey && flockOptions.length > 0) {
      setTargetFlockKey(flockOptions[0].key);
    }
  }, [type, targetFlockKey, flockOptions]);

  const n = parseInt(count, 10) || 0;
  const validCount = n > 0 && n <= remaining;
  const canSave = (() => {
    if (!validCount) return false;
    if (type === "moved_to_flock") return !!targetFlockKey;
    return true;
  })();

  const save = () => {
    if (!canSave) return;
    const disposition = {
      id: newId(),
      date, type, count: n,
      notes: dispNotes.trim(),
      created: Date.now(),
    };
    if (type === "sold") {
      disposition.pricePerBird = parseFloat(pricePerBird) || 0;
      disposition.soldTo = soldTo.trim();
    } else if (type === "moved_to_flock") {
      const opt = flockOptions.find(o => o.key === targetFlockKey);
      if (opt) {
        disposition.targetFlockId = opt.targetId;
        disposition.targetFlockType = opt.hobbyType;
      }
    } else if (type === "died") {
      disposition.cause = cause.trim();
    }

    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      const b = (h.brooderBatches || []).find(x => x.id === batch.id);
      if (!b) return d;
      if (!Array.isArray(b.dispositions)) b.dispositions = [];
      b.dispositions.push(disposition);

      // Sales integration: push to data.sales so the chick income shows up
      // in the unified sales ledger. We tag with hobbyType="incubator" so
      // the Sales page can filter / attribute it correctly.
      //
      // Field names (qty, pricePerUnit, note) match Sales.jsx conventions so
      // the row renders correctly AND can be edited from the Sales tab.
      // brooderBatchId + dispositionId give us a backlink so edits made in
      // the Sales tab can sync the disposition record.
      if (type === "sold" && disposition.pricePerBird > 0) {
        if (!Array.isArray(d.sales)) d.sales = [];
        const saleId = newId();
        disposition.saleId = saleId;
        d.sales.push({
          id: saleId,
          date,
          hobbyId: h.id,
          hobbyType: "incubator",
          // Sales.jsx schema:
          qty: n,
          pricePerUnit: disposition.pricePerBird,
          totalRevenue: disposition.pricePerBird * n,
          note: disposition.notes,
          buyerId: null,
          // Chick-specific fields, used by the chicks render branch in Sales.jsx:
          birdType: b.birdType || "Bird",
          brooderBatchName: b.name || "",
          // Backlink so Sales-tab edits can update the disposition record:
          brooderBatchId: b.id,
          dispositionId: disposition.id,
          // Customer name as plain text (no buyer directory entry created):
          customerName: disposition.soldTo,
          created: Date.now(),
        });
      }

      // Flock integration: bump the target flock/batch count. We branch on
      // hobbyType because egg_layers and meat_chickens use different field
      // names (birdCount vs startCount).
      if (type === "moved_to_flock" && disposition.targetFlockId) {
        if (disposition.targetFlockType === "egg_layers") {
          const eggH = d.hobbies.find(x => x.type === "egg_layers");
          const fl = eggH?.flocks?.find(x => x.id === disposition.targetFlockId);
          if (fl) {
            fl.birdCount = (fl.birdCount || 0) + n;
            // History entry so the user can see why the count jumped.
            if (!Array.isArray(fl.history)) fl.history = [];
            fl.history.push({
              date,
              count: fl.birdCount,
              cost: 0,
              purchasedFrom: `Brooder transfer (${b.name})`,
            });
          }
        } else if (disposition.targetFlockType === "meat_chickens") {
          const meatH = d.hobbies.find(x => x.type === "meat_chickens");
          const bt = meatH?.currentBatches?.find(x => x.id === disposition.targetFlockId);
          if (bt) {
            bt.startCount = (bt.startCount || 0) + n;
          }
        }
      }

      // Auto-archive batch if it's been fully dispositioned.
      const newRemaining = remainingInBrooder(b);
      if (newRemaining <= 0) b.archived = true;

      return d;
    });
    onClose();
  };

  const TYPE_OPTIONS = [
    { key: "sold",           label: "💰 Sold",            help: "Record a sale (price logged to your sales ledger)" },
    { key: "moved_to_flock", label: "🐔 Move to flock",   help: "Graduate to layer flock or meat-bird batch" },
    { key: "kept",           label: "📝 Kept (other)",     help: "Just remove from brooder — kept for some other purpose" },
    { key: "died",           label: "🪦 Died",            help: "Record loss with cause" },
  ];

  return (
    <Modal open onClose={onClose} title="Log brooder disposition">
      <div style={{ marginBottom: 14, padding: "10px 12px", background: palette.bgAlt, borderRadius: 8, fontSize: 13, color: palette.ink }}>
        <strong>{batch.name}</strong> · {remaining} chick{remaining === 1 ? "" : "s"} remaining
      </div>

      <Field label="What happened?">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setType(opt.key)}
              style={{
                padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                border: `1.5px solid ${type === opt.key ? palette.ink : palette.line}`,
                background: type === opt.key ? palette.ink : palette.card,
                color: type === opt.key ? palette.bg : palette.ink,
                fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13,
                textAlign: "left",
              }}
            >
              <div>{opt.label}</div>
              <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85, fontWeight: 400 }}>{opt.help}</div>
            </button>
          ))}
        </div>
      </Field>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="How many">
            <input
              type="number" min={1} max={remaining}
              style={inputStyle} value={count}
              onChange={e => setCount(e.target.value)}
              inputMode="numeric"
            />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Date">
            <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
          </Field>
        </div>
      </div>

      {!validCount && n > 0 && (
        <div style={{ marginBottom: 12, fontSize: 12, color: palette.accent }}>
          Only {remaining} chick{remaining === 1 ? "" : "s"} remaining in this batch.
        </div>
      )}

      {/* Type-specific fields */}
      {type === "sold" && (
        <>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Field label="Price each ($)">
                <input type="number" step="0.01" min={0} style={inputStyle} value={pricePerBird} onChange={e => setPricePerBird(e.target.value)} placeholder="0.00" inputMode="decimal" />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Sold to">
                <input style={inputStyle} value={soldTo} onChange={e => setSoldTo(e.target.value)} placeholder="Buyer name" />
              </Field>
            </div>
          </div>
          {pricePerBird && n > 0 && (
            <div style={{ marginBottom: 12, padding: "8px 12px", background: palette.leafSoft, borderRadius: 8, fontSize: 13, color: palette.ink }}>
              Total: <strong>${(parseFloat(pricePerBird) * n).toFixed(2)}</strong>
            </div>
          )}
        </>
      )}

      {type === "moved_to_flock" && (
        flockOptions.length === 0 ? (
          <div style={{ marginBottom: 14, padding: "10px 12px", background: palette.yolkSoft, borderRadius: 8, fontSize: 13, color: palette.ink, lineHeight: 1.5 }}>
            No layer flocks or meat-bird batches to move them into. Create a flock first, or pick a different option.
          </div>
        ) : (
          <Field label="Target">
            <select style={inputStyle} value={targetFlockKey} onChange={e => setTargetFlockKey(e.target.value)}>
              {flockOptions.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </Field>
        )
      )}

      {type === "died" && (
        <Field label="Cause (optional)">
          <input style={inputStyle} value={cause} onChange={e => setCause(e.target.value)} placeholder="e.g. failure to thrive, pasty butt" />
        </Field>
      )}

      <Field label="Notes (optional)">
        <input style={inputStyle} value={dispNotes} onChange={e => setDispNotes(e.target.value)} placeholder="Anything else worth noting" />
      </Field>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!canSave}>Save</Btn>
      </div>
    </Modal>
  );
}

// ============================================================================
// RUN CARD — shown on home tab
// ============================================================================
function RunCard({ run, hobbyId, update, setModal, calendarEvents, brooderBatches = [] }) {
  const today = todayStr();
  const incubation = BIRD_INCUBATION[run.birdType] || BIRD_INCUBATION.Chicken;
  const daysIn = run.dateSet ? Math.floor((parseLocalDate(today) - parseLocalDate(run.dateSet)) / (24*60*60*1000)) : 0;
  const daysLeft = Math.max(0, incubation.hatch - daysIn);
  const isLockdown = daysIn >= incubation.lockdown && run.status === "incubating";
  const isOverdue = today > run.hatchDate && run.status !== "hatched" && run.status !== "closed";
  const pct = Math.min(100, Math.round((daysIn / incubation.hatch) * 100));

  const hasCalendarEvents = calendarEvents.some(e => e.runId === run.id);

  const addToCalendar = () => {
    update(d => {
      d.calendarEvents = d.calendarEvents || [];
      const existing = d.calendarEvents.filter(e => e.runId === run.id).map(e => e.type);
      if (!existing.includes("incubator_lockdown")) {
        d.calendarEvents.push({ id:newId(), date:run.lockdownDate, title:`🔒 Lockdown: ${run.name}`, type:"incubator_lockdown", notes:`Stop turning eggs. Move to hatcher. ${run.birdType} — ${run.eggsSet} eggs.`, runId:run.id });
      }
      if (!existing.includes("incubator_hatch")) {
        d.calendarEvents.push({ id:newId(), date:run.hatchDate, title:`🐣 Hatch day: ${run.name}`, type:"incubator_hatch", notes:`Expected hatch. ${run.birdType} — ${run.eggsSet} eggs set.`, runId:run.id });
      }
      return d;
    });
  };

  return (
    <div style={{ background:palette.card,border:`1.5px solid ${isLockdown||isOverdue?palette.accent:palette.line}`,borderRadius:12,padding:14,marginBottom:10 }}>
      {/* Header */}
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10 }}>
        <div>
          <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
            <span style={{ fontSize:18 }}>{BIRD_EMOJI[run.birdType]}</span>
            <span style={{ fontWeight:700,fontSize:15,color:palette.ink }}>{run.name}</span>
            {(() => {
              // After a candling discard, the "active in incubator" count is
              // the candled count, not the original set count. We show the
              // active number prominently and surface the original as
              // "from N set" so the math still reads cleanly.
              const isDiscarded = run.candledCount != null && run.discardedAfterCandle && run.status === "incubating";
              if (isDiscarded) {
                return (
                  <span style={{ fontSize:11,background:palette.bgAlt,padding:"2px 8px",borderRadius:4,color:palette.inkSoft }}>
                    {run.birdType} · <strong style={{ color: palette.ink }}>{run.candledCount}</strong> active <span style={{ opacity: 0.7 }}>(from {run.eggsSet} set)</span>
                  </span>
                );
              }
              return (
                <span style={{ fontSize:11,background:palette.bgAlt,padding:"2px 8px",borderRadius:4,color:palette.inkSoft }}>{run.birdType} · {run.eggsSet} eggs</span>
              );
            })()}
            {run.variety && <span style={{ fontSize:11,color:palette.inkSoft }}>{run.variety}</span>}
          </div>
          <div style={{ fontSize:11,color:palette.inkSoft,marginTop:3 }}>Set {fmtDate(run.dateSet)}</div>
        </div>
        <button onClick={() => setModal({ type:"editRun", runId:run.id })} style={{ background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,padding:4 }}><Edit3 size={14}/></button>
      </div>

      {run.status === "hatched" ? (() => {
        // Find any brooder batch already created from this run. We hide the
        // "Move to brooder" CTA if one exists (avoiding duplicate creation)
        // but still surface a link so users can jump to the batch.
        const existingBrooder = brooderBatches.find(b => b.sourceBatchId === run.id);
        const overall = ((run.eggsHatched / run.eggsSet) * 100).toFixed(0);
        const hasCandle = run.candledCount != null && run.candledCount > 0;
        const survival = hasCandle
          ? ((run.candledCount / run.eggsSet) * 100).toFixed(0)
          : null;
        const fromCandled = hasCandle
          ? ((run.eggsHatched / run.candledCount) * 100).toFixed(0)
          : null;
        return (
          <div style={{ padding:"10px 12px",background:palette.yolkSoft,borderRadius:8,fontSize:13,color:palette.ink }}>
            <div>
              🐣 Hatched <strong>{run.eggsHatched}</strong> of {run.eggsSet} ({overall}% overall)
            </div>
            {hasCandle && (
              <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4, lineHeight: 1.5 }}>
                💡 Candling survival: <strong style={{ color: palette.ink }}>{run.candledCount}/{run.eggsSet}</strong> ({survival}%)
                {" · "}🐣 Hatch from candled: <strong style={{ color: palette.ink }}>{fromCandled}%</strong>
              </div>
            )}
            {run.hatchedDate && (
              <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4 }}>
                {fmtDate(run.hatchedDate)} · {fmtAgeSince(run.hatchedDate)}
              </div>
            )}
            {run.notes && <div style={{ fontSize:11,color:palette.inkSoft,marginTop:4 }}>{run.notes}</div>}
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {existingBrooder ? (
                <div style={{ fontSize: 11, color: palette.leaf, fontWeight: 600 }}>
                  ✓ In brooder: {existingBrooder.name}
                </div>
              ) : (
                run.eggsHatched > 0 && (
                  <Btn small variant="accent" onClick={() => setModal({ type: "moveToBrooder", runId: run.id })}>
                    🐣 Move to brooder
                  </Btn>
                )
              )}
            </div>
          </div>
        );
      })() : (
        <>
          {/* Progress bar */}
          <div style={{ marginBottom:8 }}>
            <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:palette.inkSoft,marginBottom:4 }}>
              <span>Day {daysIn} of {incubation.hatch}</span>
              <span>{isOverdue ? "⚠️ Overdue" : isLockdown ? "🔒 Lockdown!" : `${daysLeft} days to hatch`}</span>
            </div>
            <div style={{ height:8,background:palette.bgAlt,borderRadius:4,overflow:"hidden" }}>
              <div style={{ height:"100%",width:`${pct}%`,background:isOverdue?palette.accent:isLockdown?palette.yolk:palette.leaf,borderRadius:4,transition:"width 0.3s" }} />
            </div>
          </div>

          {/* Key dates */}
          <div style={{ display:"flex",gap:8,marginBottom:10,flexWrap:"wrap" }}>
            <div style={{ fontSize:12,color:palette.inkSoft,background:palette.bgAlt,borderRadius:6,padding:"4px 8px" }}>
              🔒 Lockdown: {fmtDate(run.lockdownDate)}
            </div>
            <div style={{ fontSize:12,color:palette.inkSoft,background:palette.bgAlt,borderRadius:6,padding:"4px 8px" }}>
              🐣 Hatch: {fmtDate(run.hatchDate)}
            </div>
          </div>

          {/* Candling badge — if already candled, show survival stat right
              on the card. Same line as the date pills above feels tight,
              so we put it just below them. */}
          {run.candledCount != null && (
            <div style={{
              background: palette.yolkSoft, border: `1px solid ${palette.yolk}`,
              borderRadius: 6, padding: "6px 10px",
              fontSize: 12, color: palette.ink, marginBottom: 10, lineHeight: 1.4,
            }}>
              🥚 Candled <strong>{run.candledCount}/{run.eggsSet}</strong>
              {" "}({((run.candledCount / run.eggsSet) * 100).toFixed(0)}% survival)
              {run.discardedAfterCandle && run.candledCount < run.eggsSet && (
                <> · <span style={{ color: palette.inkSoft }}>{run.eggsSet - run.candledCount} discarded</span></>
              )}
              {run.candledOn && <span style={{ color: palette.inkSoft }}> · {fmtDate(run.candledOn)}</span>}
            </div>
          )}

          {isLockdown && (
            <div style={{ background:"#FFF3CD",border:"1.5px solid "+palette.yolk,borderRadius:8,padding:"8px 12px",fontSize:13,color:palette.ink,marginBottom:10 }}>
              ⚠️ <strong>Lockdown time!</strong> Stop turning eggs and increase humidity.
            </div>
          )}

          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            <Btn small variant="accent" onClick={() => setModal({ type:"logHatch", runId:run.id })}>
              🐣 Log hatch results
            </Btn>
            <Btn small variant="ghost" onClick={() => setModal({ type:"candle", runId:run.id })}>
              💡 {run.candledCount != null ? "Edit candling" : "Candle eggs"}
            </Btn>
            {!hasCalendarEvents && (
              <Btn small variant="ghost" onClick={addToCalendar}>
                <Calendar size={13} style={{ marginRight:4 }} />Add to Calendar
              </Btn>
            )}
            {hasCalendarEvents && (
              <span style={{ fontSize:12,color:palette.leaf,padding:"6px 0",display:"flex",alignItems:"center",gap:4 }}>✓ On calendar</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// BROODER BATCH CARD — shows a single brooder batch with its remaining count
// and a quick action to log a disposition. Tapping the card itself surfaces
// the full disposition history.
// ============================================================================
function BrooderBatchCard({ batch, hobbyId, data, update, setModal }) {
  const [showHistory, setShowHistory] = useState(false);
  const remaining = remainingInBrooder(batch);
  const totalDisposed = (batch.dispositions || []).reduce((s, d) => s + (Number(d.count) || 0), 0);
  const age = fmtAgeSince(batch.startDate);

  // Pre-archived / fully-dispositioned batches still render but with a
  // muted style so they don't crowd active batches.
  const isFullyDisposed = remaining <= 0;

  return (
    <div style={{
      background: palette.card,
      border: `1.5px solid ${isFullyDisposed ? palette.line : palette.leaf}`,
      borderRadius: 12, padding: 14, marginBottom: 10,
      opacity: isFullyDisposed ? 0.7 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18 }}>{BIRD_EMOJI[batch.birdType] || "🐣"}</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: palette.ink }}>{batch.name}</span>
          </div>
          <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 3 }}>
            Started {fmtDate(batch.startDate)} · {age}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          <button
            onClick={() => setModal({ type: "editBrooderBatch", batchId: batch.id })}
            aria-label="Edit batch"
            style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, padding: 4 }}
          >
            <Edit3 size={14} />
          </button>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: isFullyDisposed ? palette.inkSoft : palette.leaf, lineHeight: 1 }}>
            {remaining}
          </div>
          <div style={{ fontSize: 10, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 0.6 }}>
            of {batch.initialCount}
          </div>
        </div>
        </div>
      </div>

      {batch.notes && (
        <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 8, fontStyle: "italic" }}>{batch.notes}</div>
      )}

      {/* Disposition history (collapsible). Useful as the batch ages and the
          user wants to look back at where chicks went. */}
      {(batch.dispositions || []).length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <button onClick={() => setShowHistory(s => !s)} style={{
            background: "none", border: "none", padding: 0, cursor: "pointer",
            fontSize: 11, color: palette.inkSoft, fontFamily: FONT_BODY, fontWeight: 600,
            textDecoration: "underline",
          }}>
            {showHistory ? "Hide history" : `${batch.dispositions.length} disposition${batch.dispositions.length === 1 ? "" : "s"} (${totalDisposed} chick${totalDisposed === 1 ? "" : "s"})`}
          </button>
          {showHistory && (
            <div style={{ marginTop: 6, padding: "8px 10px", background: palette.bgAlt, borderRadius: 6 }}>
              {batch.dispositions.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(d => {
                let label = "";
                if (d.type === "sold") label = `💰 Sold ${d.count} @ $${(d.pricePerBird || 0).toFixed(2)} ea`;
                else if (d.type === "moved_to_flock") label = `🐔 Moved ${d.count} to flock`;
                else if (d.type === "died") label = `🪦 ${d.count} died${d.cause ? ` — ${d.cause}` : ""}`;
                else label = `📝 ${d.count} ${d.notes || "removed"}`;
                return (
                  <div key={d.id} style={{ fontSize: 11, color: palette.ink, padding: "2px 0" }}>
                    <span style={{ color: palette.inkSoft }}>{fmtDate(d.date)}</span> · {label}
                    {d.soldTo && <span style={{ color: palette.inkSoft }}> · {d.soldTo}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!isFullyDisposed && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn small variant="accent" onClick={() => setModal({ type: "brooderDispose", batchId: batch.id })}>
            Log disposition
          </Btn>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// INCUBATOR HOME PAGE
// ============================================================================
function IncubatorHome({ hobby, update, setModal, data }) {
  const runs = hobby.runs || [];
  const activeRuns = runs.filter(r => r.status !== "hatched" && r.status !== "closed");
  const completedRuns = runs.filter(r => r.status === "hatched" || r.status === "closed");
  const calendarEvents = data.calendarEvents || [];
  const allBrooderBatches = hobby.brooderBatches || [];
  // Active brooder batches = anything with chicks still in it. Archived
  // batches drop out of the headline section but stay readable inside the
  // RunCard "✓ In brooder: ..." link plus the disposition history.
  const activeBrooders = allBrooderBatches.filter(b => !b.archived && remainingInBrooder(b) > 0);
  const fullyDisposedBrooders = allBrooderBatches.filter(b => b.archived || remainingInBrooder(b) <= 0);

  return (
    <div>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
        <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink }}>Active runs</div>
        <Btn small variant="accent" onClick={() => setModal({ type:"addRun", hobbyId:hobby.id })}>
          <Plus size={14} style={{ marginRight:4 }} />New run
        </Btn>
      </div>

      {activeRuns.length === 0 ? (
        <div style={{ padding:28,background:palette.card,border:`2px dashed ${palette.line}`,borderRadius:12,textAlign:"center",color:palette.inkSoft,marginBottom:14 }}>
          <div style={{ fontSize:36,marginBottom:10 }}>🥚</div>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink,marginBottom:6 }}>No active runs</div>
          <div style={{ fontSize:13,marginBottom:14 }}>Start a new incubation run to track your hatch.</div>
          <Btn variant="accent" onClick={() => setModal({ type:"addRun", hobbyId:hobby.id })}>Start first run</Btn>
        </div>
      ) : (
        activeRuns.map(run => (
          <RunCard key={run.id} run={run} hobbyId={hobby.id} update={update} setModal={setModal} calendarEvents={calendarEvents} brooderBatches={allBrooderBatches} />
        ))
      )}

      {/* BROODER SECTION — always visible so the "New brooder" entry point
          is reachable (chicks can be added directly, not just via a hatch).
          Sits between Active Runs and Completed so the workflow flows
          top-to-bottom: incubating → brooding → completed. */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,marginTop:20 }}>
        <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink }}>
          🐣 Brooder
        </div>
        <Btn small variant="accent" onClick={() => setModal({ type:"addBrooder", hobbyId:hobby.id })}>
          <Plus size={14} style={{ marginRight:4 }} />New brooder
        </Btn>
      </div>
      {activeBrooders.length > 0 ? (
        activeBrooders.map(batch => (
          <BrooderBatchCard key={batch.id} batch={batch} hobbyId={hobby.id} data={data} update={update} setModal={setModal} />
        ))
      ) : (
        <div style={{ padding:20,background:palette.card,border:`2px dashed ${palette.line}`,borderRadius:12,textAlign:"center",color:palette.inkSoft,marginBottom:14 }}>
          <div style={{ fontSize:13,lineHeight:1.5 }}>
            No chicks in the brooder. Hatch a run, or tap <strong>New brooder</strong> to add shipped or store-bought chicks.
          </div>
        </div>
      )}

      {completedRuns.length > 0 && (
        <>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,color:palette.ink,marginBottom:10,marginTop:20 }}>Completed</div>
          {completedRuns.slice(0,5).map(run => (
            <RunCard key={run.id} run={run} hobbyId={hobby.id} update={update} setModal={setModal} calendarEvents={calendarEvents} brooderBatches={allBrooderBatches} />
          ))}
        </>
      )}

      {/* Past brooder batches (fully dispositioned) — only show if user has
          some history. Smaller heading + collapsed by default to keep the
          home page clean. */}
      {fullyDisposedBrooders.length > 0 && (
        <>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:16,color:palette.inkSoft,marginBottom:10,marginTop:20 }}>
            Past brooder batches ({fullyDisposedBrooders.length})
          </div>
          {fullyDisposedBrooders.slice(0,3).map(batch => (
            <BrooderBatchCard key={batch.id} batch={batch} hobbyId={hobby.id} data={data} update={update} setModal={setModal} />
          ))}
        </>
      )}
    </div>
  );
}

// ============================================================================
// INCUBATOR STATS (exported for AnalyticsPage)
// ============================================================================
export function IncubatorAnalytics({ hobby }) {
  const runs = hobby.runs || [];
  const completed = runs.filter(r => r.eggsHatched != null);
  const totalSet = runs.reduce((s,r) => s+(r.eggsSet||0), 0);
  const totalHatched = completed.reduce((s,r) => s+(r.eggsHatched||0), 0);
  const avgHatchRate = completed.length > 0
    ? (completed.reduce((s,r) => s + (r.eggsHatched/r.eggsSet)*100, 0) / completed.length).toFixed(1)
    : "—";

  // Candling stats — only meaningful for runs where the user actually logged
  // a candling check. We compute survival-to-candling as candledCount/eggsSet
  // averaged across runs that have candling data.
  const candledRuns = runs.filter(r => r.candledCount != null && r.eggsSet > 0);
  const avgCandlingSurvival = candledRuns.length > 0
    ? (candledRuns.reduce((s,r) => s + (r.candledCount/r.eggsSet)*100, 0) / candledRuns.length).toFixed(1)
    : "—";

  // By bird type
  const byType = {};
  runs.forEach(r => {
    if (!byType[r.birdType]) byType[r.birdType] = { set:0, hatched:0, runs:0 };
    byType[r.birdType].set += r.eggsSet||0;
    byType[r.birdType].hatched += r.eggsHatched||0;
    byType[r.birdType].runs++;
  });

  // Hatch rate by run (chart)
  const hatchChart = completed.slice(-10).map(r => ({
    name: r.name.slice(0,12),
    rate: Number(((r.eggsHatched/r.eggsSet)*100).toFixed(1)),
  }));

  return (
    <div>
      <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:16 }}>
        <StatCard label="Total eggs set" value={totalSet} accent={palette.yolk} />
        <StatCard label="Total hatched" value={totalHatched} accent={palette.leaf} />
        <StatCard label="Avg hatch rate" value={avgHatchRate === "—" ? "—" : `${avgHatchRate}%`} accent={palette.feather} />
        {candledRuns.length > 0 && (
          <StatCard
            label="Avg candling survival"
            value={`${avgCandlingSurvival}%`}
            sub={`across ${candledRuns.length} candled run${candledRuns.length === 1 ? "" : "s"}`}
            accent={palette.honey}
          />
        )}
        <StatCard label="Runs completed" value={completed.length} accent={palette.ink} />
      </div>

      {hatchChart.length > 1 && (
        <ChartCard title="🐣 Hatch rate by run">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={hatchChart}>
              <XAxis dataKey="name" stroke={palette.inkSoft} fontSize={11} />
              <YAxis stroke={palette.inkSoft} fontSize={11} tickFormatter={v=>`${v}%`} domain={[0,100]} />
              <Tooltip contentStyle={{ background:palette.card,border:`1.5px solid ${palette.ink}`,borderRadius:8 }} formatter={v=>[`${v}%`,"Hatch rate"]} />
              <Bar dataKey="rate" fill={palette.leaf} radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {Object.keys(byType).length > 0 && (
        <ChartCard title="By bird type">
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {Object.entries(byType).map(([type, stats]) => {
              const rate = stats.set > 0 ? ((stats.hatched/stats.set)*100).toFixed(0) : "—";
              return (
                <div key={type} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:palette.bgAlt,borderRadius:8,fontSize:13 }}>
                  <div>
                    <strong>{BIRD_EMOJI[type]} {type}</strong>
                    <div style={{ fontSize:11,color:palette.inkSoft }}>{stats.runs} run{stats.runs!==1?"s":""} · {stats.set} eggs set</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontWeight:700,color:palette.leaf }}>{stats.hatched} hatched</div>
                    <div style={{ fontSize:11,color:palette.inkSoft }}>{rate}{rate!=="—"?"%":""} rate</div>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}

      {/* BROODER ANALYTICS — only renders if user has brooder data.
          Survival = initial chicks minus those marked "died" in dispositions.
          Note: we count died, not just "remaining at end" because chicks that
          were sold/moved/kept are all survivors — only "died" reduces survival. */}
      {(() => {
        const brooderBatches = hobby.brooderBatches || [];
        if (brooderBatches.length === 0) return null;
        const totalChicks = brooderBatches.reduce((s, b) => s + (b.initialCount || 0), 0);
        const totalDied = brooderBatches.reduce((s, b) =>
          s + (b.dispositions || []).filter(d => d.type === "died").reduce((ds, d) => ds + (d.count || 0), 0)
        , 0);
        const overallSurvivalRate = totalChicks > 0
          ? (((totalChicks - totalDied) / totalChicks) * 100).toFixed(1)
          : "—";
        // Per-batch chart data — newest 10 batches
        const survivalChart = brooderBatches.slice(-10).map(b => {
          const died = (b.dispositions || []).filter(d => d.type === "died").reduce((s, d) => s + (d.count || 0), 0);
          const surviving = (b.initialCount || 0) - died;
          const rate = (b.initialCount || 0) > 0 ? Number(((surviving / b.initialCount) * 100).toFixed(1)) : 0;
          return { name: (b.name || "Batch").slice(0, 12), rate };
        });

        return (
          <>
            <div style={{ display:"flex",gap:10,flexWrap:"wrap",margin:"20px 0 16px" }}>
              <StatCard label="Brooder batches" value={brooderBatches.length} accent={palette.feather} />
              <StatCard label="Chicks brooded" value={totalChicks} accent={palette.yolk} />
              <StatCard label="Brooder survival" value={overallSurvivalRate === "—" ? "—" : `${overallSurvivalRate}%`} accent={palette.leaf} />
              {totalDied > 0 && <StatCard label="Lost in brooder" value={totalDied} accent={palette.accent} />}
            </div>

            {survivalChart.length > 1 && (
              <ChartCard title="🐥 Brooder survival rate by batch">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={survivalChart}>
                    <XAxis dataKey="name" stroke={palette.inkSoft} fontSize={11} />
                    <YAxis stroke={palette.inkSoft} fontSize={11} tickFormatter={v=>`${v}%`} domain={[0,100]} />
                    <Tooltip contentStyle={{ background:palette.card,border:`1.5px solid ${palette.ink}`,borderRadius:8 }} formatter={v=>[`${v}%`,"Survival rate"]} />
                    <Bar dataKey="rate" fill={palette.leaf} radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </>
        );
      })()}

      {runs.length === 0 && (
        <div style={{ padding:24,textAlign:"center",color:palette.inkSoft,fontSize:13 }}>No incubation runs yet.</div>
      )}
    </div>
  );
}

// ============================================================================
// MODAL ROUTER for Incubator modals
// ============================================================================
function IncubatorModalRouter({ modal, hobby, data, update, setModal, onClose }) {
  if (!modal) return null;

  if (modal.type === "addRun") {
    return <RunModal hobbyId={hobby.id} update={update} onClose={onClose} />;
  }
  if (modal.type === "editRun") {
    const run = (hobby.runs||[]).find(r => r.id === modal.runId);
    if (!run) { onClose(); return null; }
    return <RunModal run={run} hobbyId={hobby.id} update={update} onClose={onClose} />;
  }
  if (modal.type === "logHatch") {
    const run = (hobby.runs||[]).find(r => r.id === modal.runId);
    if (!run) { onClose(); return null; }
    // After logging a fresh hatch (not an edit), chain into the brooder
    // creation modal so chicks don't fall into limbo. Passing onAfterSave
    // gives LogHatchModal a hook to transition rather than just close.
    return (
      <LogHatchModal
        run={run}
        hobbyId={hobby.id}
        update={update}
        onClose={onClose}
        onAfterSave={({ runId }) => setModal({ type: "moveToBrooder", runId })}
      />
    );
  }
  if (modal.type === "candle") {
    const run = (hobby.runs||[]).find(r => r.id === modal.runId);
    if (!run) { onClose(); return null; }
    return <CandleModal run={run} hobbyId={hobby.id} update={update} onClose={onClose} />;
  }
  if (modal.type === "moveToBrooder") {
    const run = (hobby.runs||[]).find(r => r.id === modal.runId);
    if (!run) { onClose(); return null; }
    return <MoveToBrooderModal run={run} hobbyId={hobby.id} update={update} onClose={onClose} />;
  }
  if (modal.type === "addBrooder") {
    return <AddBrooderModal hobbyId={hobby.id} update={update} onClose={onClose} />;
  }
  if (modal.type === "brooderDispose") {
    const batch = (hobby.brooderBatches||[]).find(b => b.id === modal.batchId);
    if (!batch) { onClose(); return null; }
    return <BrooderDispositionModal batch={batch} hobbyId={hobby.id} data={data} update={update} onClose={onClose} />;
  }
  if (modal.type === "editBrooderBatch") {
    const batch = (hobby.brooderBatches||[]).find(b => b.id === modal.batchId);
    if (!batch) { onClose(); return null; }
    return <EditBrooderBatchModal batch={batch} hobbyId={hobby.id} data={data} update={update} onClose={onClose} />;
  }
  return null;
}

// ============================================================================
// MAIN INCUBATOR PAGE
// ============================================================================
// The app's main nav already provides Home and Stats tabs. The Stats tab
// routes to <IncubatorAnalytics /> in HomesteadApp.jsx, so this page only
// renders the Home content — no internal tab bar needed.
export default function IncubatorPage({ hobby, data, update, setModal }) {
  const [localModal, setLocalModal] = useState(null);
  const closeModal = () => setLocalModal(null);

  return (
    <div>
      <IncubatorModalRouter modal={localModal} hobby={hobby} data={data} update={update} setModal={setLocalModal} onClose={closeModal} />
      <IncubatorHome hobby={hobby} update={update} setModal={setLocalModal} data={data} />
    </div>
  );
}
