// ============================================================================
// DEHYDRATING PAGE
// ----------------------------------------------------------------------------
// Tracks dehydrating batches: each run produces N oz of output across some
// number of trays after running the dehydrator for some hours. Data lives
// on hobby.batches[], parallel to Canning's structure.
//
// Data shape:
//   hobby.batches[] = [{ id, date, item, dryerHours, trays, outputOz,
//                        temperatureF, containerType, ingredientsCost, notes,
//                        archived }]
//   data.entries["dehydrating"] = [{ id, action: "use" | "sale", batchId, ... }]
//
// Note on temperature: dehydrating is sensitive to temperature settings
// (meat at 165°F, herbs at 95°F, etc.) so we surface that as a tracked field
// where freeze-drying didn't need it.
// ============================================================================

import React, { useState, useMemo } from "react";
import { X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fmtMoney } from "./units.js";

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

function BatchModal({ batch, onSave, onDelete, onClose }) {
  const editing = !!batch;
  const [date, setDate] = useState(batch?.date || todayIso());
  const [item, setItem] = useState(batch?.item || "");
  const [dryerHours, setDryerHours] = useState(batch?.dryerHours?.toString() || "");
  const [trays, setTrays] = useState(batch?.trays?.toString() || "");
  const [outputOz, setOutputOz] = useState(batch?.outputOz?.toString() || "");
  const [temperatureF, setTemperatureF] = useState(batch?.temperatureF?.toString() || "");
  const [containerType, setContainerType] = useState(batch?.containerType || "jar");
  const [ingredientsCost, setIngredientsCost] = useState(batch?.ingredientsCost?.toString() || "");
  const [notes, setNotes] = useState(batch?.notes || "");

  const canSave = !!item.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: batch?.id || newId(),
      date, item: item.trim(),
      dryerHours: parseFloat(dryerHours) || 0,
      trays: parseInt(trays, 10) || 0,
      outputOz: parseFloat(outputOz) || 0,
      temperatureF: parseInt(temperatureF, 10) || 0,
      containerType,
      ingredientsCost: parseFloat(ingredientsCost) || 0,
      notes: notes.trim(),
      archived: batch?.archived || false,
      created: batch?.created || Date.now(),
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={editing ? "✏️ Edit batch" : "🌬️ New dehydrating batch"}>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Item">
        <input style={inputStyle} value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Apple slices, jerky, herbs" autoFocus />
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Dryer hours">
            <input type="number" step="0.5" min={0} style={inputStyle} value={dryerHours} onChange={(e) => setDryerHours(e.target.value)} placeholder="0" inputMode="decimal" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Temp (°F)">
            <input type="number" min={0} style={inputStyle} value={temperatureF} onChange={(e) => setTemperatureF(e.target.value)} placeholder="e.g. 135" inputMode="numeric" />
          </Field>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Trays">
            <input type="number" min={0} style={inputStyle} value={trays} onChange={(e) => setTrays(e.target.value)} placeholder="0" inputMode="numeric" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Output (oz)">
            <input type="number" step="0.1" min={0} style={inputStyle} value={outputOz} onChange={(e) => setOutputOz(e.target.value)} placeholder="0" inputMode="decimal" />
          </Field>
        </div>
      </div>
      <Field label="Storage container">
        <select style={inputStyle} value={containerType} onChange={(e) => setContainerType(e.target.value)}>
          <option value="jar">Mason jar</option>
          <option value="vacuum">Vacuum-sealed bag</option>
          <option value="mylar">Mylar bag</option>
          <option value="ziploc">Ziploc / freezer bag</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Ingredient cost ($)">
        <input type="number" step="0.01" min={0} style={inputStyle} value={ingredientsCost} onChange={(e) => setIngredientsCost(e.target.value)} placeholder="0.00" inputMode="decimal" />
      </Field>
      <Field label="Notes">
        <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontFamily: FONT_BODY }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pretreatment, slice thickness, rotation schedule…" />
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

export default function DehydratingPage({ hobby, data, update, setModal }) {
  const [batchModal, setBatchModal] = useState({ open: false, batch: null });
  const batches = (hobby?.batches || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const active = batches.filter(b => !b.archived);
  const archived = batches.filter(b => b.archived);

  const saveBatch = (batch) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.batches)) h.batches = [];
      const idx = h.batches.findIndex(x => x.id === batch.id);
      if (idx >= 0) h.batches[idx] = batch; else h.batches.push(batch);
      return d;
    });
  };

  const deleteBatch = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h) h.batches = (h.batches || []).filter(b => b.id !== id);
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

  const totalOz = active.reduce((s, b) => s + (b.outputOz || 0), 0);
  const totalCost = active.reduce((s, b) => s + (b.ingredientsCost || 0), 0);
  const avgRun = active.length > 0 ? active.reduce((s, b) => s + (b.dryerHours || 0), 0) / active.length : 0;

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 28, margin: 0, color: palette.ink }}>🌬️ Dehydrating</h1>
        <Btn variant="primary" small onClick={() => setBatchModal({ open: true, batch: null })}>+ New batch</Btn>
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
          <div style={{ fontSize: 32, marginBottom: 6 }}>🌬️</div>
          No batches yet. Tap <strong>+ New batch</strong> after your next dehydrator run.
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
                  {b.date} · {b.outputOz || 0}oz · {b.trays || 0} trays · {b.dryerHours || 0}hr{b.temperatureF ? ` @ ${b.temperatureF}°F` : ""}
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
          onSave={saveBatch}
          onDelete={batchModal.batch ? deleteBatch : null}
          onClose={() => setBatchModal({ open: false, batch: null })}
        />
      )}
    </div>
  );
}

export function DehydratingAnalytics({ hobby, spouseMode = false }) {
  const batches = (hobby?.batches || []).filter(b => !b.archived);
  const totalOz = batches.reduce((s, b) => s + (b.outputOz || 0), 0);
  const totalCost = batches.reduce((s, b) => s + (b.ingredientsCost || 0), 0);
  const totalHours = batches.reduce((s, b) => s + (b.dryerHours || 0), 0);

  const byMonth = useMemo(() => {
    const map = {};
    batches.forEach(b => {
      if (!b.date) return;
      const key = b.date.slice(0, 7);
      if (!map[key]) map[key] = { month: key, count: 0, oz: 0 };
      map[key].count += 1;
      map[key].oz += (b.outputOz || 0);
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  }, [batches]);

  return (
    <div style={{ paddingBottom: 80 }}>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, margin: "0 0 14px", color: palette.ink }}>🌬️ Dehydrating Stats</h1>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Batches" value={batches.length} accent={palette.leaf} />
        <StatCard label="Total output" value={`${totalOz.toFixed(1)} oz`} accent={palette.feather} />
        <StatCard label="Dryer hours" value={totalHours.toFixed(1)} accent={palette.yolk} />
        {!spouseMode && <StatCard label="Cost" value={fmtMoney(totalCost)} accent={palette.accent} />}
      </div>

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
