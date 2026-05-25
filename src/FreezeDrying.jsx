// ============================================================================
// FREEZE DRYING PAGE
// ----------------------------------------------------------------------------
// Tracks freeze-drying batches: each run produces N oz of output across some
// number of trays after running the freeze dryer for some hours. Data lives
// on hobby.batches[], parallel to Canning's structure.
//
// Data shape:
//   hobby.batches[] = [{ id, date, item, runHours, trays, outputOz,
//                        containerType, ingredientsCost, notes, archived }]
//   data.entries["freeze_drying"] = [{ id, action: "use" | "sale", batchId, ... }]
//
// Modeled after Canning.jsx — same palette, same component patterns,
// same Modal shell. Differences: no "jars remaining" tracking (freeze-dried
// food is typically eaten or sold all at once from a batch's storage), no
// eat-by-date (most freeze-dried foods last 20-25 years if sealed properly,
// so we don't surface countdown UI).
// ============================================================================

import React, { useState, useMemo } from "react";
import { X, Edit3, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { fmtMoney } from "./units.js";
import PantryQuickCost, { applyPantryDeductions, applyPantryRefunds } from "./PantryQuickCost.jsx";
import { pantryItemCostForUsage } from "./pantry.js";

function computePantryLinesTotal(lines, pantry) {
  if (!Array.isArray(lines) || !Array.isArray(pantry)) return 0;
  let total = 0;
  for (const ln of lines) {
    const it = pantry.find(p => p.id === ln.pantryId);
    if (!it) continue;
    const r = pantryItemCostForUsage(it, ln.amount, ln.unit);
    if (r.ok) total += r.cost;
  }
  return total;
}
// ADV_ANALYTICS: shared advanced-analytics layer (see analytics.js).
import {
  priorDateRange, computeDelta, StatTrend, personalRecord,
  monthlySeries, LockedStatOverlay,
} from "./analytics.js";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", yolk: "#E8B547", yolkSoft: "#F2D58A",
  feather: "#8B6F47", line: "#2C181030", card: "#FAF5EA",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

const newId = () => Math.random().toString(36).slice(2, 10);
const todayIso = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

// ============================================================================
// SHARED UI PRIMITIVES (same as Canning's local components)
// ============================================================================
function Btn({ children, onClick, variant = "primary", small = false, style = {}, type = "button", disabled = false }) {
  const variants = {
    primary: { bg: palette.ink, color: palette.bg, border: palette.ink },
    leaf: { bg: palette.leaf, color: "#FAF5EA", border: palette.leaf },
    accent: { bg: palette.accent, color: "#FAF5EA", border: palette.accent },
    ghost: { bg: "transparent", color: palette.ink, border: palette.line },
    danger: { bg: palette.accent, color: palette.bg, border: palette.accent },
  };
  const v = variants[variant] || variants.primary;
  return (
    <button
      type={type} disabled={disabled} onClick={onClick}
      style={{
        background: v.bg, color: v.color, border: `1.5px solid ${v.border}`,
        borderRadius: 10, padding: small ? "8px 12px" : "10px 16px",
        fontFamily: FONT_BODY, fontWeight: 600, fontSize: small ? 13 : 14,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        boxShadow: variant === "ghost" ? "none" : "2px 2px 0 " + palette.line,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, sub, accent = palette.accent }) {
  return (
    <div style={{
      flex: 1, minWidth: 100, padding: "12px 14px",
      background: palette.card, border: `1.5px solid ${palette.line}`,
      borderRadius: 12,
    }}>
      <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, color: accent, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(44,24,16,0.55)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      zIndex: 200, padding: 0,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: palette.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        maxWidth: 540, width: "100%", maxHeight: "92vh", overflowY: "auto",
        border: `2px solid ${palette.ink}`, boxShadow: `0 -6px 0 ${palette.line}`,
        WebkitOverflowScrolling: "touch",
        padding: "18px 22px max(18px, env(safe-area-inset-bottom)) 22px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, margin: 0, color: palette.ink }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={{
            background: "none", border: "none", padding: 6, cursor: "pointer", color: palette.ink,
          }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
};

// ============================================================================
// BATCH MODAL — create/edit a freeze-drying batch
// ============================================================================
function BatchModal({ batch, pantry = [], onSave, onDelete, onClose }) {
  const editing = !!batch;
  const [date, setDate] = useState(batch?.date || todayIso());
  const [item, setItem] = useState(batch?.item || "");
  const [runHours, setRunHours] = useState(batch?.runHours?.toString() || "");
  const [trays, setTrays] = useState(batch?.trays?.toString() || "");
  const [outputOz, setOutputOz] = useState(batch?.outputOz?.toString() || "");
  const [containerType, setContainerType] = useState(batch?.containerType || "mylar");
  const [ingredientsCost, setIngredientsCost] = useState(batch?.ingredientsCost?.toString() || "");
  const [costTouched, setCostTouched] = useState(false);
  const [pantryLines, setPantryLines] = useState(() => Array.isArray(batch?._pantryLines) ? batch._pantryLines.map(l => ({ ...l })) : []);
  const [notes, setNotes] = useState(batch?.notes || "");

  const canSave = !!item.trim();

  // SHARED_PANTRY: auto-fill cost field from pantry lines.
  const pantryCostTotal = computePantryLinesTotal(pantryLines, pantry);
  React.useEffect(() => {
    if (costTouched) return;
    if (pantryLines.length === 0) return;
    setIngredientsCost(pantryCostTotal > 0 ? pantryCostTotal.toFixed(2) : "");
  }, [pantryCostTotal, costTouched, pantryLines.length]);

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: batch?.id || newId(),
      date, item: item.trim(),
      runHours: parseFloat(runHours) || 0,
      trays: parseInt(trays, 10) || 0,
      outputOz: parseFloat(outputOz) || 0,
      containerType,
      ingredientsCost: parseFloat(ingredientsCost) || 0,
      notes: notes.trim(),
      archived: batch?.archived || false,
      created: batch?.created || Date.now(),
      _pantryLinesToApply: pantryLines,
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={editing ? "✏️ Edit batch" : "❄️ New freeze-drying batch"}>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Item">
        <input style={inputStyle} value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Strawberries, beef stew, scrambled eggs" autoFocus />
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Run hours">
            <input type="number" step="0.5" min={0} style={inputStyle} value={runHours} onChange={(e) => setRunHours(e.target.value)} placeholder="0" inputMode="decimal" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Trays">
            <input type="number" min={0} style={inputStyle} value={trays} onChange={(e) => setTrays(e.target.value)} placeholder="0" inputMode="numeric" />
          </Field>
        </div>
      </div>
      <Field label="Output weight (oz)">
        <input type="number" step="0.1" min={0} style={inputStyle} value={outputOz} onChange={(e) => setOutputOz(e.target.value)} placeholder="0" inputMode="decimal" />
      </Field>
      <Field label="Storage container">
        <select style={inputStyle} value={containerType} onChange={(e) => setContainerType(e.target.value)}>
          <option value="mylar">Mylar bag</option>
          <option value="jar">Mason jar</option>
          <option value="vacuum">Vacuum-sealed bag</option>
          <option value="bucket">Mylar in bucket</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Ingredient cost ($)">
        <input
          type="number"
          step="0.01"
          min={0}
          style={inputStyle}
          value={ingredientsCost}
          onChange={(e) => { setIngredientsCost(e.target.value); setCostTouched(true); }}
          placeholder="0.00"
          inputMode="decimal"
        />
        <PantryQuickCost
          pantry={pantry}
          lines={pantryLines}
          onChange={setPantryLines}
          palette={{ ink: palette.ink, text: palette.ink, textSoft: palette.inkSoft, border: palette.line, bg: palette.card, bgAlt: palette.bgAlt, accent: palette.accent }}
        />
      </Field>
      <Field label="Notes">
        <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontFamily: FONT_BODY }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pretreatment, freezing notes, runtime quirks…" />
      </Field>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
        {editing && onDelete ? (
          <Btn variant="ghost" onClick={() => { if (confirm("Delete this batch?")) { onDelete(batch.id); onClose(); } }}>Delete</Btn>
        ) : <div />}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={!canSave}>Save</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// FREEZE DRYING PAGE
// ============================================================================
export default function FreezeDryingPage({ hobby, data, update, setModal }) {
  const [batchModal, setBatchModal] = useState({ open: false, batch: null });
  const batches = (hobby?.batches || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const active = batches.filter(b => !b.archived);
  const archived = batches.filter(b => b.archived);

  const saveBatch = (batch) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.batches)) h.batches = [];

      // SHARED_PANTRY: apply deductions before persisting. On EDIT, refund
      // prior deductions first so we don't double-count.
      const linesToApply = batch._pantryLinesToApply || [];
      const cleanBatch = { ...batch };
      delete cleanBatch._pantryLinesToApply;

      const existingIdx = h.batches.findIndex(x => x.id === cleanBatch.id);
      if (existingIdx >= 0) {
        const prior = h.batches[existingIdx];
        if (Array.isArray(prior?._pantryDeductions) && prior._pantryDeductions.length > 0) {
          applyPantryRefunds(d, prior._pantryDeductions);
        }
      }

      if (linesToApply.length > 0) {
        const deductions = applyPantryDeductions(d, linesToApply);
        if (deductions.length > 0) cleanBatch._pantryDeductions = deductions;
        cleanBatch._pantryLines = linesToApply;
      } else {
        delete cleanBatch._pantryDeductions;
        delete cleanBatch._pantryLines;
      }

      if (existingIdx >= 0) h.batches[existingIdx] = cleanBatch; else h.batches.push(cleanBatch);
      return d;
    });
  };

  const deleteBatch = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      // SHARED_PANTRY: refund any deducted stock.
      const target = (h.batches || []).find(b => b.id === id);
      if (target && Array.isArray(target._pantryDeductions)) {
        applyPantryRefunds(d, target._pantryDeductions);
      }
      h.batches = (h.batches || []).filter(b => b.id !== id);
      return d;
    });
  };

  const archiveBatch = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      const b = (h?.batches || []).find(x => x.id === id);
      if (b) b.archived = true;
      return d;
    });
  };

  // Quick stats
  const totalOz = active.reduce((s, b) => s + (b.outputOz || 0), 0);
  const totalCost = active.reduce((s, b) => s + (b.ingredientsCost || 0), 0);
  const avgRun = active.length > 0 ? active.reduce((s, b) => s + (b.runHours || 0), 0) / active.length : 0;

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 28, margin: 0, color: palette.ink }}>❄️ Freeze Drying</h1>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {setModal && (
            <Btn variant="ghost" small onClick={() => setModal({ type: "pantry" })}>🥫 Pantry</Btn>
          )}
          {setModal && (
            <Btn variant="ghost" small onClick={() => setModal({ type: "addExpense", hobbyId: hobby.id })}>💵 Add Expense</Btn>
          )}
          {setModal && (Array.isArray(hobby.customLogs) ? hobby.customLogs : []).map(c => (
            <Btn key={c.id} variant="ghost" small onClick={() => setModal({ type: "log", action: "custom", customLogId: c.id, hobbyIdOverride: hobby.id })}>{c.emoji || "📝"} {c.label}</Btn>
          ))}
          {setModal && (
            <Btn variant="ghost" small onClick={() => setModal({ type: "customLogPicker", hobbyId: hobby.id })}>➕ Custom</Btn>
          )}
          <Btn variant="primary" small onClick={() => setBatchModal({ open: true, batch: null })}>+ New batch</Btn>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Active batches" value={active.length} accent={palette.leaf} />
        <StatCard label="Total output" value={`${totalOz.toFixed(1)} oz`} accent={palette.feather} />
        <StatCard label="Avg run" value={`${avgRun.toFixed(1)} hr`} accent={palette.yolk} />
        <StatCard label="Cost" value={fmtMoney(totalCost)} accent={palette.accent} />
      </div>

      {active.length === 0 ? (
        <div style={{
          padding: "32px 16px", textAlign: "center",
          background: palette.card, border: `1.5px dashed ${palette.line}`, borderRadius: 12,
          color: palette.inkSoft, fontSize: 14, lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>❄️</div>
          No batches yet. Tap <strong>+ New batch</strong> after your next freeze-dry run.
        </div>
      ) : (
        active.map(b => (
          <div key={b.id} onClick={() => setBatchModal({ open: true, batch: b })} style={{
            padding: "12px 14px", background: palette.card,
            border: `1.5px solid ${palette.line}`, borderRadius: 10,
            marginBottom: 8, cursor: "pointer",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, lineHeight: 1.2 }}>{b.item}</div>
                <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 4 }}>
                  {b.date} · {b.outputOz || 0}oz · {b.trays || 0} trays · {b.runHours || 0}hr
                </div>
                {b.notes && <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 4, fontStyle: "italic" }}>{b.notes}</div>}
              </div>
              <button onClick={(e) => { e.stopPropagation(); if (confirm("Archive this batch?")) archiveBatch(b.id); }} style={{
                background: "none", border: "none", color: palette.inkSoft, cursor: "pointer", fontSize: 11, padding: 4,
              }}>Archive</button>
            </div>
          </div>
        ))
      )}

      {archived.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, marginBottom: 8 }}>
            Archived ({archived.length})
          </div>
          {archived.slice(0, 5).map(b => (
            <div key={b.id} style={{ padding: "8px 10px", fontSize: 12, color: palette.inkSoft, borderBottom: `1px solid ${palette.line}` }}>
              {b.date} · {b.item} · {b.outputOz || 0}oz
            </div>
          ))}
        </div>
      )}

      {batchModal.open && (
        <BatchModal
          batch={batchModal.batch}
          pantry={Array.isArray(data.pantry) ? data.pantry : []}
          onSave={saveBatch}
          onDelete={batchModal.batch ? deleteBatch : null}
          onClose={() => setBatchModal({ open: false, batch: null })}
        />
      )}
    </div>
  );
}

// ============================================================================
// ANALYTICS — basic counts and trend chart
// ============================================================================
export function FreezeDryingAnalytics({ hobby, spouseMode = false, /* ADV_ANALYTICS */ dateRange = null, earlyAccessConfig = null, isSupporter = false }) {
  const batches = (hobby?.batches || []).filter(b => !b.archived);
  const totalOz = batches.reduce((s, b) => s + (b.outputOz || 0), 0);
  const totalCost = batches.reduce((s, b) => s + (b.ingredientsCost || 0), 0);
  const totalHours = batches.reduce((s, b) => s + (b.runHours || 0), 0);

  // Monthly batch counts for chart
  const byMonth = useMemo(() => {
    const map = {};
    batches.forEach(b => {
      if (!b.date) return;
      const key = b.date.slice(0, 7); // YYYY-MM
      if (!map[key]) map[key] = { month: key, count: 0, oz: 0 };
      map[key].count += 1;
      map[key].oz += (b.outputOz || 0);
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  }, [batches]);

  // ── ADV_ANALYTICS ── output by month line + best output month + period delta.
  const ozMonthlyRaw = useMemo(
    () => monthlySeries(batches, b => b.date, b => Number(b.outputOz) || 0),
    [batches]
  );
  const ozMonthly = ozMonthlyRaw.map(p => ({
    month: p.month, oz: Number(p.value.toFixed(1)),
    label: (() => { const pr = String(p.month).split("-").map(Number); const d = new Date(pr[0], pr[1] - 1, 1); return isNaN(d) ? p.month : d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }); })(),
  }));
  const ozRecord = personalRecord(ozMonthlyRaw);
  const inR = (d, r) => d && (!r.start || d >= r.start) && (!r.end || d <= r.end);
  const prior = priorDateRange(dateRange);
  const curOz = dateRange && (dateRange.start || dateRange.end)
    ? batches.filter(b => inR(b.date, dateRange)).reduce((s, b) => s + (Number(b.outputOz) || 0), 0)
    : totalOz;
  const priorOz = prior ? batches.filter(b => inR(b.date, prior)).reduce((s, b) => s + (Number(b.outputOz) || 0), 0) : null;
  const ozDelta = prior ? computeDelta(curOz, priorOz) : null;
  const pFonts = { body: FONT_BODY, display: FONT_DISPLAY };

  return (
    <div style={{ paddingBottom: 80 }}>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, margin: "0 0 14px", color: palette.ink }}>❄️ Freeze Drying Stats</h1>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Batches" value={batches.length} accent={palette.leaf} />
        <StatCard label="Total output" value={`${totalOz.toFixed(1)} oz`} accent={palette.feather} />
        <StatCard label="Run hours" value={totalHours.toFixed(1)} accent={palette.yolk} />
        {!spouseMode && <StatCard label="Cost" value={fmtMoney(totalCost)} accent={palette.accent} />}
      </div>

      <LockedStatOverlay earlyAccessConfig={earlyAccessConfig} isSupporter={isSupporter} palette={palette} fonts={pFonts}>
        <div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {ozRecord && <StatCard label="Best output month" value={`${ozRecord.value.toFixed(1)} oz`} sub={ozRecord.label} accent={palette.feather} />}
            {ozDelta && (
              <div style={{ flex: "1 1 130px", minWidth: 130, boxSizing: "border-box", background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 10, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Output vs. prior period</div>
                <div style={{ fontSize: 22, fontFamily: FONT_DISPLAY, color: palette.feather, lineHeight: 1.1 }}>{curOz.toFixed(1)} oz</div>
                <div style={{ marginTop: 4 }}><StatTrend delta={ozDelta} palette={palette} fonts={pFonts} /></div>
              </div>
            )}
          </div>
          {ozMonthly.length > 1 && (
            <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 8 }}>❄️ Output by month</div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ozMonthly}>
                    <XAxis dataKey="label" style={{ fontSize: 11 }} />
                    <YAxis style={{ fontSize: 11 }} />
                    <Tooltip formatter={v => [`${v} oz`, "Output"]} />
                    <Line type="monotone" dataKey="oz" stroke={palette.feather} strokeWidth={3} dot={{ fill: palette.accent, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </LockedStatOverlay>

      {byMonth.length > 0 && (
        <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 8 }}>Output by month</div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byMonth}>
                <XAxis dataKey="month" style={{ fontSize: 11 }} />
                <YAxis style={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="oz" fill={palette.feather} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
