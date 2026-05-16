// ============================================================================
// TEA PAGE
// ----------------------------------------------------------------------------
// Tracks dried herb tea blends. Each blend records the recipe (which herbs
// and in what amounts), total weight produced, and packaging. Like salves,
// there's no infusion period — a blend is "made" and then "available".
//
// Two natural ways to package a blend:
//   - Bulk: sold by weight (e.g. 1 oz of blend at $X per oz)
//   - Sachets/bags: pre-packaged single servings (e.g. 30 tea bags)
// The model supports either via the "packaging" field on each batch.
//
// Data shape:
//   hobby.batches[] = [{
//     id, name, ingredients (free text or array), totalWeightOz,
//     packaging: "bulk" | "sachets",
//     sachetsMade, sachetsRemaining, sachetSize,  // sachet mode
//     bulkRemainingOz,                              // bulk mode
//     madeDate, ingredientsCost, notes,
//     events, archived
//   }]
//   data.sales[] (hobbyType="tea", batchId=...)
// ============================================================================

import React, { useState } from "react";
import { X, Edit3, Plus } from "lucide-react";
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
const parseIso = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const fmtDate = (s) => {
  if (!s) return "";
  return parseIso(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const SACHET_SIZES = [
  { value: "1tsp",  label: "1 tsp (single cup)" },
  { value: "1tbsp", label: "1 tbsp (large mug)" },
  { value: "0.1oz", label: "0.1 oz" },
  { value: "0.25oz", label: "0.25 oz" },
];

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
};

function Btn({ children, onClick, variant = "primary", small = false, style = {}, disabled = false }) {
  const base = {
    padding: small ? "6px 12px" : "10px 18px",
    borderRadius: 8, fontFamily: FONT_BODY,
    fontWeight: 600, fontSize: small ? 12 : 14,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    border: `1.5px solid ${palette.ink}`,
  };
  const variants = {
    primary: { background: palette.ink, color: palette.bg },
    accent:  { background: palette.accent, color: "#fff", border: `1.5px solid ${palette.accent}` },
    ghost:   { background: "transparent", color: palette.ink, border: `1.5px solid ${palette.line}` },
    danger:  { background: palette.accent, color: "#fff", border: `1.5px solid ${palette.accent}` },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>{label}</div>
      {children}
    </label>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(44,24,16,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: palette.bg, borderRadius: 16, maxWidth: 480, width: "100%", maxHeight: "92vh", overflow: "auto", border: `2px solid ${palette.ink}`, boxShadow: `6px 8px 0 ${palette.line}`, fontFamily: FONT_BODY }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1.5px solid ${palette.line}` }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.ink }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: palette.ink, padding: 4 }}><X size={22} /></button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent = palette.accent }) {
  return (
    <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, flex: "1 1 130px", minWidth: 130, boxSizing: "border-box" }}>
      <div style={{ fontSize: 10, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontFamily: FONT_DISPLAY, color: accent, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, marginBottom: 10, color: palette.ink }}>{title}</div>
      {children}
    </div>
  );
}

// ============================================================================
// NEW / EDIT BATCH MODAL
// ============================================================================
function BatchModal({ batch, hobbyId, update, onClose }) {
  const isEdit = !!batch;
  const [name, setName] = useState(batch?.name || "");
  const [ingredients, setIngredients] = useState(batch?.ingredients || "");
  const [totalWeightOz, setTotalWeightOz] = useState(batch?.totalWeightOz ? String(batch.totalWeightOz) : "");
  const [packaging, setPackaging] = useState(batch?.packaging || "bulk");
  const [sachetsMade, setSachetsMade] = useState(batch?.sachetsMade ? String(batch.sachetsMade) : "");
  const [sachetSize, setSachetSize] = useState(batch?.sachetSize || "1tsp");
  const [madeDate, setMadeDate] = useState(batch?.madeDate || todayIso());
  const [ingredientsCost, setIngredientsCost] = useState(batch?.ingredientsCost ? String(batch.ingredientsCost) : "");
  const [notes, setNotes] = useState(batch?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    if (!name.trim()) return;
    const id = batch?.id || newId();
    const weight = Number(totalWeightOz) || 0;
    const sachets = Number(sachetsMade) || 0;
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      if (!Array.isArray(h.batches)) h.batches = [];
      const data = {
        id,
        name: name.trim(),
        ingredients: ingredients.trim(),
        totalWeightOz: weight,
        packaging,
        sachetsMade: sachets,
        sachetsRemaining: batch?.sachetsRemaining != null
          ? batch.sachetsRemaining + (sachets - (batch?.sachetsMade || 0))
          : sachets,
        sachetSize,
        bulkRemainingOz: batch?.bulkRemainingOz != null
          ? batch.bulkRemainingOz + (weight - (batch?.totalWeightOz || 0))
          : weight,
        madeDate,
        ingredientsCost: Number(ingredientsCost) || 0,
        notes: notes.trim(),
        events: batch?.events || [{ id: newId(), kind: "made", date: madeDate, note: packaging === "bulk" ? `${weight} oz` : `${sachets} × ${sachetSize}` }],
        archived: batch?.archived || false,
        created: batch?.created || Date.now(),
      };
      if (isEdit) {
        const idx = h.batches.findIndex(b => b.id === id);
        if (idx !== -1) h.batches[idx] = data;
        else h.batches.push(data);
      } else {
        h.batches.push(data);
      }
      return d;
    });
    onClose();
  };

  const remove = () => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (h) h.batches = (h.batches || []).filter(b => b.id !== batch.id);
      if (Array.isArray(d.sales)) d.sales = d.sales.filter(s => s.batchId !== batch.id);
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit tea blend" : "New tea blend"}>
      <Field label="Blend name">
        <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Calm Belly, Cold & Flu Support, Sleepytime" autoFocus />
      </Field>
      <Field label="Ingredients / recipe">
        <textarea
          style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
          value={ingredients} onChange={e => setIngredients(e.target.value)}
          placeholder="e.g. 2 parts chamomile, 1 part lemon balm, 1 part lavender, 1/2 part valerian"
        />
      </Field>
      <Field label="Made on">
        <input type="date" style={inputStyle} value={madeDate} onChange={e => setMadeDate(e.target.value)} />
      </Field>
      <Field label="Packaging">
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { v: "bulk",    l: "📦 Bulk",    sub: "sold by weight" },
            { v: "sachets", l: "🫖 Sachets", sub: "pre-portioned" },
          ].map(o => (
            <button key={o.v} type="button" onClick={() => setPackaging(o.v)} style={{
              flex: 1, padding: "10px 12px", borderRadius: 8,
              border: `1.5px solid ${packaging === o.v ? palette.ink : palette.line}`,
              background: packaging === o.v ? palette.ink : palette.card,
              color: packaging === o.v ? palette.bg : palette.ink,
              fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13, cursor: "pointer",
              textAlign: "left",
            }}>
              <div>{o.l}</div>
              <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2, fontWeight: 400 }}>{o.sub}</div>
            </button>
          ))}
        </div>
      </Field>
      {packaging === "bulk" ? (
        <Field label="Total weight (oz)">
          <input type="number" min={0} step="0.1" inputMode="decimal" style={inputStyle} value={totalWeightOz} onChange={e => setTotalWeightOz(e.target.value)} placeholder="0" />
        </Field>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Field label="Sachets made">
                <input type="number" min={0} step="1" inputMode="numeric" style={inputStyle} value={sachetsMade} onChange={e => setSachetsMade(e.target.value)} placeholder="0" />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Sachet size">
                <select style={inputStyle} value={sachetSize} onChange={e => setSachetSize(e.target.value)}>
                  {SACHET_SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
            </div>
          </div>
          <Field label="Total weight (oz, optional)">
            <input type="number" min={0} step="0.1" inputMode="decimal" style={inputStyle} value={totalWeightOz} onChange={e => setTotalWeightOz(e.target.value)} placeholder="0" />
            <div style={{ fontSize: 10, color: palette.inkSoft, marginTop: 2, lineHeight: 1.3 }}>For analytics. The grand total of all your sachets combined.</div>
          </Field>
        </>
      )}
      <Field label="Ingredient cost (optional)">
        <input type="number" min={0} step="0.01" inputMode="decimal" style={inputStyle} value={ingredientsCost} onChange={e => setIngredientsCost(e.target.value)} placeholder="$0.00" />
      </Field>
      <Field label="Notes (optional)">
        <textarea
          style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
          value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Brewing instructions, flavor notes, etc."
        />
      </Field>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
        <Btn onClick={save}>{isEdit ? "Save changes" : "Save blend"}</Btn>
        {isEdit && !confirmDelete && (
          <Btn variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Btn>
        )}
        {isEdit && confirmDelete && (
          <Btn variant="danger" onClick={remove}>Confirm — delete</Btn>
        )}
      </div>
      {confirmDelete && (
        <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 8, fontStyle: "italic", lineHeight: 1.5 }}>
          Deleting removes this blend and any associated sale records permanently.
        </div>
      )}
    </Modal>
  );
}

// ============================================================================
// SELL MODAL — handles bulk (by oz) or sachets (by count)
// ============================================================================
function SellModal({ batch, hobbyId, update, onClose }) {
  const [date, setDate] = useState(todayIso());
  const [qty, setQty] = useState("1");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [buyer, setBuyer] = useState("");
  const [saleNotes, setSaleNotes] = useState("");

  const isBulk = batch.packaging === "bulk";
  const max = isBulk ? Number(batch.bulkRemainingOz) || 0 : Number(batch.sachetsRemaining) || 0;
  const unitLabel = isBulk ? "oz" : "sachet";
  const unitLabelPlural = isBulk ? "oz" : "sachets";

  const total = (Number(qty) || 0) * (Number(pricePerUnit) || 0);

  const save = () => {
    const n = Number(qty);
    if (!n || n <= 0 || n > max) return;
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      const b = (h.batches || []).find(x => x.id === batch.id);
      if (b) {
        if (isBulk) {
          b.bulkRemainingOz = Math.max(0, (b.bulkRemainingOz || 0) - n);
        } else {
          b.sachetsRemaining = Math.max(0, (b.sachetsRemaining || 0) - n);
        }
        b.events = b.events || [];
        b.events.push({ id: newId(), kind: "sold", date, note: `${n} ${isBulk ? "oz" : `× ${batch.sachetSize}`}${buyer.trim() ? ` to ${buyer.trim()}` : ""}` });
      }
      d.sales = d.sales || [];
      d.sales.push({
        id: newId(),
        date,
        hobbyType: "tea",
        hobbyId,
        batchId: batch.id,
        crop: batch.name,
        gardenUnit: isBulk ? "oz" : batch.sachetSize,
        qty: n,
        pricePerUnit: Number(pricePerUnit) || 0,
        totalRevenue: total,
        buyer: buyer.trim(),
        notes: saleNotes.trim(),
        created: Date.now(),
      });
      return d;
    });
    onClose();
  };

  if (max <= 0) {
    return (
      <Modal open onClose={onClose} title={`Sell — ${batch.name}`}>
        <div style={{ fontSize: 13, color: palette.inkSoft, lineHeight: 1.5 }}>
          No {unitLabelPlural} remaining. {isBulk ? (batch.totalWeightOz > 0 ? "All sold." : "Add weight to the blend first.") : (batch.sachetsMade > 0 ? "All sold." : "Add sachets to the blend first.")}
        </div>
        <div style={{ marginTop: 14 }}>
          <Btn variant="ghost" onClick={onClose}>Close</Btn>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={`Sell — ${batch.name}`}>
      <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 12, lineHeight: 1.5, padding: "8px 10px", background: palette.bgAlt, borderRadius: 6 }}>
        {max} {unitLabelPlural} remaining{!isBulk && ` (${batch.sachetSize} each)`}
      </div>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label={`${isBulk ? "Ounces" : "Sachets"} (max ${max})`}>
            <input type="number" min={0.1} max={max} step={isBulk ? "0.1" : "1"} inputMode={isBulk ? "decimal" : "numeric"} style={inputStyle} value={qty} onChange={e => setQty(e.target.value)} placeholder="1" autoFocus />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label={`Price per ${unitLabel}`}>
            <input type="number" min={0} step="0.01" inputMode="decimal" style={inputStyle} value={pricePerUnit} onChange={e => setPricePerUnit(e.target.value)} placeholder="$0.00" />
          </Field>
        </div>
      </div>
      <Field label="Buyer (optional)">
        <input style={inputStyle} value={buyer} onChange={e => setBuyer(e.target.value)} placeholder="Name of buyer" />
      </Field>
      <Field label="Notes (optional)">
        <input style={inputStyle} value={saleNotes} onChange={e => setSaleNotes(e.target.value)} placeholder="Anything to remember..." />
      </Field>
      {total > 0 && (
        <div style={{ background: palette.yolkSoft, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: palette.ink, marginBottom: 12 }}>
          Total: <strong>{fmtMoney(total)}</strong>
        </div>
      )}
      <Btn onClick={save} disabled={!qty || Number(qty) <= 0 || Number(qty) > max}>Log sale</Btn>
    </Modal>
  );
}

// ============================================================================
// BATCH CARD
// ============================================================================
function BatchCard({ batch, hobbyId, sales, update, setLocalModal }) {
  const batchSales = (sales || []).filter(s => s.batchId === batch.id);
  const revenue = batchSales.reduce((s, x) => s + (Number(x.totalRevenue) || 0), 0);
  const isBulk = batch.packaging === "bulk";

  const remaining = isBulk ? Number(batch.bulkRemainingOz) || 0 : Number(batch.sachetsRemaining) || 0;
  const made = isBulk ? Number(batch.totalWeightOz) || 0 : Number(batch.sachetsMade) || 0;
  const isSoldOut = remaining <= 0 && made > 0;
  const stageColor = isSoldOut ? palette.feather : palette.leaf;
  const stageLabel = isSoldOut ? "Sold out" : "Available";

  return (
    <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18 }}>🍵</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: palette.ink }}>{batch.name}</span>
            {made > 0 && (
              <span style={{ fontSize: 11, background: stageColor + "30", color: stageColor, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>{stageLabel}</span>
            )}
            <span style={{ fontSize: 10, color: palette.inkSoft, background: palette.bgAlt, padding: "2px 6px", borderRadius: 4 }}>
              {isBulk ? "bulk" : "sachets"}
            </span>
          </div>
          <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 3 }}>
            Made {fmtDate(batch.madeDate)}
          </div>
        </div>
        <button onClick={() => setLocalModal({ type: "editBatch", batchId: batch.id })} style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, padding: 4 }}><Edit3 size={14} /></button>
      </div>

      {batch.ingredients && (
        <div style={{ fontSize: 12, color: palette.ink, marginBottom: 10, padding: "8px 10px", background: palette.bgAlt, borderRadius: 6, lineHeight: 1.4 }}>
          {batch.ingredients}
        </div>
      )}

      {made > 0 && (
        <div style={{ background: palette.bgAlt, borderRadius: 8, padding: "10px 12px", marginBottom: 10, fontSize: 12, color: palette.ink, lineHeight: 1.4 }}>
          {isBulk ? (
            <div>
              <strong>{batch.totalWeightOz}</strong> oz blend
              {remaining < made && <span style={{ color: palette.inkSoft }}> · {remaining.toFixed(1)} oz remaining</span>}
            </div>
          ) : (
            <div>
              <strong>{batch.sachetsMade}</strong> × {batch.sachetSize}
              {remaining < made && <span style={{ color: palette.inkSoft }}> · {remaining} remaining</span>}
              {batch.totalWeightOz > 0 && <span style={{ color: palette.inkSoft }}> · {batch.totalWeightOz} oz total</span>}
            </div>
          )}
          {revenue > 0 && (
            <div style={{ color: palette.leaf, fontWeight: 600, marginTop: 4 }}>Revenue: {fmtMoney(revenue)}</div>
          )}
        </div>
      )}

      {batch.notes && (
        <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 10, fontStyle: "italic", lineHeight: 1.4 }}>{batch.notes}</div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {remaining > 0 && (
          <Btn small variant="accent" onClick={() => setLocalModal({ type: "sell", batchId: batch.id })}>
            💵 Sell
          </Btn>
        )}
      </div>

      {batch.events && batch.events.length > 1 && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontSize: 11, color: palette.inkSoft, userSelect: "none" }}>
            History ({batch.events.length} event{batch.events.length === 1 ? "" : "s"})
          </summary>
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
            {batch.events.slice().reverse().map(e => (
              <div key={e.id} style={{ fontSize: 11, color: palette.inkSoft, padding: "4px 8px", background: palette.bgAlt, borderRadius: 6 }}>
                {fmtDate(e.date)} · {e.kind}{e.note ? ` — ${e.note}` : ""}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ============================================================================
// MODAL ROUTER
// ============================================================================
function TeaModalRouter({ modal, hobby, update, onClose }) {
  if (!modal) return null;
  if (modal.type === "addBatch") return <BatchModal hobbyId={hobby.id} update={update} onClose={onClose} />;
  if (modal.type === "editBatch") {
    const batch = (hobby.batches || []).find(b => b.id === modal.batchId);
    if (!batch) { onClose(); return null; }
    return <BatchModal batch={batch} hobbyId={hobby.id} update={update} onClose={onClose} />;
  }
  if (modal.type === "sell") {
    const batch = (hobby.batches || []).find(b => b.id === modal.batchId);
    if (!batch) { onClose(); return null; }
    return <SellModal batch={batch} hobbyId={hobby.id} update={update} onClose={onClose} />;
  }
  return null;
}

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function TeaPage({ hobby, data, update }) {
  const [localModal, setLocalModal] = useState(null);
  const batches = hobby.batches || [];
  const active = batches.filter(b => !b.archived);
  const sales = (data.sales || []).filter(s => s.hobbyType === "tea");

  // A batch is "available" if it still has stock OR nothing has been
  // made yet (a freshly created blend the user may stock later — it must
  // still be visible, otherwise it silently disappears). "soldOut" is
  // only a batch that HAD stock and ran out.
  const available = active.filter(b => {
    const remaining = b.packaging === "bulk" ? (b.bulkRemainingOz || 0) : (b.sachetsRemaining || 0);
    const made = b.packaging === "bulk" ? (b.totalWeightOz || 0) : (b.sachetsMade || 0);
    return remaining > 0 || made <= 0;
  });
  const soldOut = active.filter(b => {
    const remaining = b.packaging === "bulk" ? (b.bulkRemainingOz || 0) : (b.sachetsRemaining || 0);
    const made = b.packaging === "bulk" ? (b.totalWeightOz || 0) : (b.sachetsMade || 0);
    return remaining <= 0 && made > 0;
  });

  return (
    <div>
      <TeaModalRouter modal={localModal} hobby={hobby} update={update} onClose={() => setLocalModal(null)} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink }}>Your tea blends</div>
        <button onClick={() => setLocalModal({ type: "addBatch" })} style={{ padding: "7px 14px", borderRadius: 8, background: palette.yolk, border: `1.5px solid ${palette.ink}`, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13, cursor: "pointer", color: palette.ink, display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} />New blend
        </button>
      </div>

      {batches.length === 0 ? (
        <div style={{ padding: 28, background: palette.card, border: `2px dashed ${palette.line}`, borderRadius: 12, textAlign: "center", color: palette.inkSoft }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🍵</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink, marginBottom: 6 }}>No tea blends yet</div>
          <div style={{ fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
            Track your blends — recipe, weight, and packaging (bulk or sachets).
          </div>
          <button onClick={() => setLocalModal({ type: "addBatch" })} style={{ padding: "10px 18px", borderRadius: 8, background: palette.yolk, border: `1.5px solid ${palette.ink}`, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14, cursor: "pointer", color: palette.ink }}>Create first blend</button>
        </div>
      ) : (
        <>
          {available.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>Available ({available.length})</div>
              {available.map(b => <BatchCard key={b.id} batch={b} hobbyId={hobby.id} sales={sales} update={update} setLocalModal={setLocalModal} />)}
            </div>
          )}
          {soldOut.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", color: palette.inkSoft, fontSize: 13, padding: 8, background: palette.bgAlt, borderRadius: 8, userSelect: "none" }}>
                Sold out ({soldOut.length})
              </summary>
              <div style={{ marginTop: 10 }}>
                {soldOut.map(b => <BatchCard key={b.id} batch={b} hobbyId={hobby.id} sales={sales} update={update} setLocalModal={setLocalModal} />)}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// ANALYTICS
// ============================================================================
export function TeaAnalytics({ hobby, entries }) {
  const batches = hobby.batches || [];
  const totalBatches = batches.length;
  const totalWeightOz = batches.reduce((s, b) => s + (Number(b.totalWeightOz) || 0), 0);
  const totalSachetsMade = batches.reduce((s, b) => s + (Number(b.sachetsMade) || 0), 0);
  const totalCost = batches.reduce((s, b) => s + (Number(b.ingredientsCost) || 0), 0);

  const chart = batches
    .filter(b => b.name && (b.totalWeightOz || b.sachetsMade))
    .map(b => ({
      name: b.name.length > 14 ? b.name.slice(0, 14) + "…" : b.name,
      oz: Number(b.totalWeightOz) || 0,
    }))
    .filter(x => x.oz > 0)
    .sort((a, b) => b.oz - a.oz)
    .slice(0, 8);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Total blends" value={totalBatches} accent={palette.leaf} />
        {totalWeightOz > 0 && <StatCard label="Total weight" value={`${totalWeightOz.toFixed(1)} oz`} accent={palette.yolk} />}
        {totalSachetsMade > 0 && <StatCard label="Sachets made" value={totalSachetsMade} accent={palette.feather} />}
        {totalCost > 0 && <StatCard label="Ingredients spent" value={fmtMoney(totalCost)} accent={palette.accent} />}
      </div>

      {chart.length > 1 && (
        <ChartCard title="🍵 Blends by weight">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chart}>
              <XAxis dataKey="name" stroke={palette.inkSoft} fontSize={11} />
              <YAxis stroke={palette.inkSoft} fontSize={11} />
              <Tooltip contentStyle={{ background: palette.card, border: `1.5px solid ${palette.ink}`, borderRadius: 8 }} formatter={(v) => `${v} oz`} />
              <Bar dataKey="oz" fill={palette.leaf} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {batches.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: palette.inkSoft, fontSize: 13, lineHeight: 1.5 }}>
          No data yet. Create a blend to see analytics here.
        </div>
      )}
    </div>
  );
}
