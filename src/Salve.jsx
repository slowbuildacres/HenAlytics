// ============================================================================
// SALVE PAGE
// ----------------------------------------------------------------------------
// Tracks salve batches. Salves are made by combining infused oil(s) with
// beeswax (and optionally butters / essential oils), heating, and pouring
// into tins or jars. Unlike tinctures/oil-infusions, there's no long
// infusion period — a salve batch goes straight from "made" to "available".
//
// Lifecycle is simpler:
//   poured → optionally sold
// (No infusing/ready stages since salves are immediate.)
//
// Data shape:
//   hobby.batches[] = [{
//     id, name, recipe, infusedOilUsed, beeswaxOz, butterOz, essentialOils,
//     pouredDate, tinsMade, tinsRemaining, tinSize, totalYieldOz,
//     ingredientsCost, notes,
//     events, archived
//   }]
//   data.sales[] (hobbyType="salve", batchId=...)
// ============================================================================

import React, { useState } from "react";
import { X, Edit3, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { fmtMoney } from "./units.js";
// ADV_ANALYTICS: shared advanced-analytics layer (see analytics.js).
import {
  personalRecord, monthlySeries, LockedStatOverlay,
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
const parseIso = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const fmtDate = (s) => {
  if (!s) return "";
  return parseIso(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const TIN_SIZES = [
  { value: "0.5oz", label: "0.5 oz lip balm" },
  { value: "1oz",   label: "1 oz" },
  { value: "2oz",   label: "2 oz" },
  { value: "4oz",   label: "4 oz" },
  { value: "8oz",   label: "8 oz jar" },
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
  const [recipe, setRecipe] = useState(batch?.recipe || "");
  const [infusedOilUsed, setInfusedOilUsed] = useState(batch?.infusedOilUsed || "");
  const [beeswaxOz, setBeeswaxOz] = useState(batch?.beeswaxOz ? String(batch.beeswaxOz) : "");
  const [butterOz, setButterOz] = useState(batch?.butterOz ? String(batch.butterOz) : "");
  const [essentialOils, setEssentialOils] = useState(batch?.essentialOils || "");
  const [pouredDate, setPouredDate] = useState(batch?.pouredDate || todayIso());
  const [tinsMade, setTinsMade] = useState(batch?.tinsMade ? String(batch.tinsMade) : "");
  const [tinSize, setTinSize] = useState(batch?.tinSize || "1oz");
  const [totalYieldOz, setTotalYieldOz] = useState(batch?.totalYieldOz ? String(batch.totalYieldOz) : "");
  const [ingredientsCost, setIngredientsCost] = useState(batch?.ingredientsCost ? String(batch.ingredientsCost) : "");
  const [notes, setNotes] = useState(batch?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    if (!name.trim() && !recipe.trim()) return;
    const id = batch?.id || newId();
    const made = Number(tinsMade) || 0;
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      if (!Array.isArray(h.batches)) h.batches = [];
      const data = {
        id,
        name: name.trim() || recipe.trim(),
        recipe: recipe.trim(),
        infusedOilUsed: infusedOilUsed.trim(),
        beeswaxOz: Number(beeswaxOz) || 0,
        butterOz: Number(butterOz) || 0,
        essentialOils: essentialOils.trim(),
        pouredDate,
        tinsMade: made,
        tinsRemaining: batch?.tinsRemaining != null
          ? batch.tinsRemaining + (made - (batch?.tinsMade || 0))
          : made,
        tinSize,
        totalYieldOz: Number(totalYieldOz) || 0,
        ingredientsCost: Number(ingredientsCost) || 0,
        notes: notes.trim(),
        events: batch?.events || [{ id: newId(), kind: "poured", date: pouredDate, note: made > 0 ? `${made} × ${tinSize}` : "" }],
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
    <Modal open onClose={onClose} title={isEdit ? "Edit salve batch" : "Make a salve"}>
      <Field label="Salve name">
        <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Calendula healing salve, Cuts & scrapes balm" autoFocus />
      </Field>
      <Field label="Recipe / purpose (optional)">
        <input style={inputStyle} value={recipe} onChange={e => setRecipe(e.target.value)} placeholder="e.g. Skin healing, sore muscles" />
      </Field>
      <Field label="Infused oil(s) used (optional)">
        <input style={inputStyle} value={infusedOilUsed} onChange={e => setInfusedOilUsed(e.target.value)} placeholder="e.g. Calendula in olive oil, plantain in jojoba" />
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Beeswax (oz)">
            <input type="number" min={0} step="0.1" inputMode="decimal" style={inputStyle} value={beeswaxOz} onChange={e => setBeeswaxOz(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Butters (oz)">
            <input type="number" min={0} step="0.1" inputMode="decimal" style={inputStyle} value={butterOz} onChange={e => setButterOz(e.target.value)} placeholder="0" />
            <div style={{ fontSize: 10, color: palette.inkSoft, marginTop: 2, lineHeight: 1.3 }}>Shea, cocoa, mango, etc.</div>
          </Field>
        </div>
      </div>
      <Field label="Essential oils (optional)">
        <input style={inputStyle} value={essentialOils} onChange={e => setEssentialOils(e.target.value)} placeholder="e.g. 20 drops lavender, 10 drops tea tree" />
      </Field>
      <Field label="Poured / made on">
        <input type="date" style={inputStyle} value={pouredDate} onChange={e => setPouredDate(e.target.value)} />
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Tins made">
            <input type="number" min={0} step="1" inputMode="numeric" style={inputStyle} value={tinsMade} onChange={e => setTinsMade(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Tin size">
            <select style={inputStyle} value={tinSize} onChange={e => setTinSize(e.target.value)}>
              {TIN_SIZES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </div>
      </div>
      <Field label="Total yield in fl oz (optional)">
        <input type="number" min={0} step="0.1" inputMode="decimal" style={inputStyle} value={totalYieldOz} onChange={e => setTotalYieldOz(e.target.value)} placeholder="e.g. 8" />
      </Field>
      <Field label="Ingredient cost (optional)">
        <input type="number" min={0} step="0.01" inputMode="decimal" style={inputStyle} value={ingredientsCost} onChange={e => setIngredientsCost(e.target.value)} placeholder="$0.00" />
      </Field>
      <Field label="Notes (optional)">
        <textarea
          style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
          value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Recipe ratios, how it set up, anything to remember next time..."
        />
      </Field>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
        <Btn onClick={save}>{isEdit ? "Save changes" : "Save batch"}</Btn>
        {isEdit && !confirmDelete && (
          <Btn variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Btn>
        )}
        {isEdit && confirmDelete && (
          <Btn variant="danger" onClick={remove}>Confirm — delete</Btn>
        )}
      </div>
      {confirmDelete && (
        <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 8, fontStyle: "italic", lineHeight: 1.5 }}>
          Deleting removes this batch and any associated sale records permanently.
        </div>
      )}
    </Modal>
  );
}

// ============================================================================
// SELL MODAL — sale of N tins from a batch
// ============================================================================
function SellModal({ batch, hobbyId, update, onClose }) {
  const [date, setDate] = useState(todayIso());
  const [count, setCount] = useState("1");
  const [pricePerTin, setPricePerTin] = useState("");
  const [buyer, setBuyer] = useState("");
  const [saleNotes, setSaleNotes] = useState("");
  const max = Number(batch.tinsRemaining) || 0;

  const total = (Number(count) || 0) * (Number(pricePerTin) || 0);

  const save = () => {
    const n = Number(count);
    if (!n || n < 1 || n > max) return;
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      const b = (h.batches || []).find(x => x.id === batch.id);
      if (b) {
        b.tinsRemaining = Math.max(0, (b.tinsRemaining || 0) - n);
        b.events = b.events || [];
        b.events.push({ id: newId(), kind: "sold", date, note: `${n} × ${batch.tinSize}${buyer.trim() ? ` to ${buyer.trim()}` : ""}` });
      }
      d.sales = d.sales || [];
      d.sales.push({
        id: newId(),
        date,
        hobbyType: "salve",
        hobbyId,
        batchId: batch.id,
        crop: batch.name,
        gardenUnit: batch.tinSize,
        qty: n,
        pricePerUnit: Number(pricePerTin) || 0,
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
          No tins remaining in this batch. {batch.tinsMade > 0 ? "All sold or given away." : "Add tins-made first."}
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
        {max} {batch.tinSize} tin{max === 1 ? "" : "s"} remaining
      </div>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label={`Tins (max ${max})`}>
            <input type="number" min={1} max={max} step="1" inputMode="numeric" style={inputStyle} value={count} onChange={e => setCount(e.target.value)} placeholder="1" autoFocus />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Price per tin">
            <input type="number" min={0} step="0.01" inputMode="decimal" style={inputStyle} value={pricePerTin} onChange={e => setPricePerTin(e.target.value)} placeholder="$0.00" />
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
      <Btn onClick={save} disabled={!count || Number(count) < 1 || Number(count) > max}>Log sale</Btn>
    </Modal>
  );
}

// ============================================================================
// BATCH CARD
// ============================================================================
function BatchCard({ batch, hobbyId, sales, update, setLocalModal }) {
  const batchSales = (sales || []).filter(s => s.batchId === batch.id);
  const revenue = batchSales.reduce((s, x) => s + (Number(x.totalRevenue) || 0), 0);
  const soldCount = (batch.tinsMade || 0) - (batch.tinsRemaining || 0);

  // Status: if no tins left, "Sold out"; otherwise "Available"
  const isSoldOut = (batch.tinsRemaining || 0) <= 0 && (batch.tinsMade || 0) > 0;
  const stageColor = isSoldOut ? palette.feather : palette.leaf;
  const stageLabel = isSoldOut ? "Sold out" : "Available";

  return (
    <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18 }}>🪻</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: palette.ink }}>{batch.name}</span>
            {batch.tinsMade > 0 && (
              <span style={{ fontSize: 11, background: stageColor + "30", color: stageColor, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>{stageLabel}</span>
            )}
          </div>
          {batch.recipe && (
            <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 3 }}>{batch.recipe}</div>
          )}
          <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 2 }}>
            Poured {fmtDate(batch.pouredDate)}
            {batch.beeswaxOz > 0 && ` · ${batch.beeswaxOz} oz beeswax`}
            {batch.butterOz > 0 && ` · ${batch.butterOz} oz butters`}
          </div>
        </div>
        <button onClick={() => setLocalModal({ type: "editBatch", batchId: batch.id })} style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, padding: 4 }}><Edit3 size={14} /></button>
      </div>

      {batch.tinsMade > 0 && (
        <div style={{ background: palette.bgAlt, borderRadius: 8, padding: "10px 12px", marginBottom: 10, fontSize: 12, color: palette.ink, lineHeight: 1.4 }}>
          <div>
            <strong>{batch.tinsMade}</strong> × {batch.tinSize}{soldCount > 0 && <span style={{ color: palette.inkSoft }}> · {soldCount} sold · {batch.tinsRemaining} remaining</span>}
          </div>
          {batch.totalYieldOz > 0 && (
            <div style={{ color: palette.inkSoft, marginTop: 4 }}>Total yield: {batch.totalYieldOz} fl oz</div>
          )}
          {revenue > 0 && (
            <div style={{ color: palette.leaf, fontWeight: 600, marginTop: 4 }}>Revenue: {fmtMoney(revenue)}</div>
          )}
        </div>
      )}
      {batch.infusedOilUsed && (
        <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 8, lineHeight: 1.4 }}>
          🫒 Oil: {batch.infusedOilUsed}
        </div>
      )}
      {batch.essentialOils && (
        <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 8, lineHeight: 1.4 }}>
          💧 EOs: {batch.essentialOils}
        </div>
      )}
      {batch.notes && (
        <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 10, fontStyle: "italic", lineHeight: 1.4 }}>{batch.notes}</div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {batch.tinsRemaining > 0 && (
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
function SalveModalRouter({ modal, hobby, update, onClose }) {
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
export default function SalvePage({ hobby, data, update }) {
  const [localModal, setLocalModal] = useState(null);
  const batches = hobby.batches || [];
  const active = batches.filter(b => !b.archived);
  const sales = (data.sales || []).filter(s => s.hobbyType === "salve");

  // Group: available (tins > 0) and sold out (tins == 0 & made > 0)
  const available = active.filter(b => (b.tinsRemaining || 0) > 0);
  const soldOut = active.filter(b => (b.tinsRemaining || 0) <= 0 && (b.tinsMade || 0) > 0);
  const noInventory = active.filter(b => (b.tinsMade || 0) === 0);

  return (
    <div>
      <SalveModalRouter modal={localModal} hobby={hobby} update={update} onClose={() => setLocalModal(null)} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink }}>Your salves</div>
        <button onClick={() => setLocalModal({ type: "addBatch" })} style={{ padding: "7px 14px", borderRadius: 8, background: palette.yolk, border: `1.5px solid ${palette.ink}`, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13, cursor: "pointer", color: palette.ink, display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} />New batch
        </button>
      </div>

      {batches.length === 0 ? (
        <div style={{ padding: 28, background: palette.card, border: `2px dashed ${palette.line}`, borderRadius: 12, textAlign: "center", color: palette.inkSoft }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🪻</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink, marginBottom: 6 }}>No salves yet</div>
          <div style={{ fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
            Record your salve batches — what infused oils and beeswax you used, how many tins it made.
          </div>
          <button onClick={() => setLocalModal({ type: "addBatch" })} style={{ padding: "10px 18px", borderRadius: 8, background: palette.yolk, border: `1.5px solid ${palette.ink}`, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14, cursor: "pointer", color: palette.ink }}>Make first salve</button>
        </div>
      ) : (
        <>
          {available.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>Available ({available.length})</div>
              {available.map(b => <BatchCard key={b.id} batch={b} hobbyId={hobby.id} sales={sales} update={update} setLocalModal={setLocalModal} />)}
            </div>
          )}
          {noInventory.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>Recipes (no tins recorded)</div>
              {noInventory.map(b => <BatchCard key={b.id} batch={b} hobbyId={hobby.id} sales={sales} update={update} setLocalModal={setLocalModal} />)}
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
export function SalveAnalytics({ hobby, entries, /* ADV_ANALYTICS */ earlyAccessConfig = null, isSupporter = false }) {
  const batches = hobby.batches || [];
  const totalBatches = batches.length;
  const totalTinsMade = batches.reduce((s, b) => s + (Number(b.tinsMade) || 0), 0);
  const totalTinsRemaining = batches.reduce((s, b) => s + (Number(b.tinsRemaining) || 0), 0);
  const totalTinsSold = totalTinsMade - totalTinsRemaining;
  const totalBeeswax = batches.reduce((s, b) => s + (Number(b.beeswaxOz) || 0), 0);
  const totalCost = batches.reduce((s, b) => s + (Number(b.ingredientsCost) || 0), 0);

  const byName = {};
  batches.forEach(b => {
    if (!b.name) return;
    if (!byName[b.name]) byName[b.name] = { tins: 0, sold: 0 };
    byName[b.name].tins += Number(b.tinsMade) || 0;
    byName[b.name].sold += (Number(b.tinsMade) || 0) - (Number(b.tinsRemaining) || 0);
  });
  const chart = Object.entries(byName)
    .sort((a, b) => b[1].tins - a[1].tins)
    .slice(0, 8)
    .map(([name, stats]) => ({ name: name.length > 14 ? name.slice(0, 14) + "…" : name, tins: stats.tins, sold: stats.sold }));

  // ── ADV_ANALYTICS ── tins made by month line + best tin month record.
  const tinsMonthlyRaw = monthlySeries(batches, b => b.pouredDate, b => Number(b.tinsMade) || 0);
  const tinsMonthly = tinsMonthlyRaw.map(p => ({
    month: p.month, tins: p.value,
    label: (() => { const pr = String(p.month).split("-").map(Number); const d = new Date(pr[0], pr[1] - 1, 1); return isNaN(d) ? p.month : d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }); })(),
  }));
  const tinsRecord = personalRecord(tinsMonthlyRaw);
  const pFonts = { body: FONT_BODY, display: FONT_DISPLAY };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Total batches" value={totalBatches} accent={palette.leaf} />
        <StatCard label="Tins made" value={totalTinsMade} accent={palette.yolk} />
        <StatCard label="Tins sold" value={totalTinsSold} accent={palette.feather} />
        <StatCard label="Tins on hand" value={totalTinsRemaining} accent={palette.leaf} />
        {totalBeeswax > 0 && <StatCard label="Beeswax used" value={`${totalBeeswax.toFixed(1)} oz`} accent={palette.ink} />}
        {totalCost > 0 && <StatCard label="Ingredients spent" value={fmtMoney(totalCost)} accent={palette.accent} />}
      </div>

      {tinsMonthlyRaw.length > 0 && (
        <LockedStatOverlay earlyAccessConfig={earlyAccessConfig} isSupporter={isSupporter} palette={palette} fonts={pFonts}>
          <div>
            {tinsRecord && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                <StatCard label="Best tin month" value={`${tinsRecord.value} tins`} sub={tinsRecord.label} accent={palette.leaf} />
              </div>
            )}
            {tinsMonthly.length > 1 && (
              <ChartCard title="🪻 Tins made by month">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={tinsMonthly}>
                    <XAxis dataKey="label" stroke={palette.inkSoft} fontSize={11} />
                    <YAxis stroke={palette.inkSoft} fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: palette.card, border: `1.5px solid ${palette.ink}`, borderRadius: 8 }} formatter={v => [`${v} tins`, "Made"]} />
                    <Line type="monotone" dataKey="tins" stroke={palette.leaf} strokeWidth={3} dot={{ fill: palette.accent, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>
        </LockedStatOverlay>
      )}

      {chart.length > 1 && (
        <ChartCard title="🪻 Tins by salve">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chart}>
              <XAxis dataKey="name" stroke={palette.inkSoft} fontSize={11} />
              <YAxis stroke={palette.inkSoft} fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: palette.card, border: `1.5px solid ${palette.ink}`, borderRadius: 8 }} />
              <Bar dataKey="tins" fill={palette.leaf} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {batches.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: palette.inkSoft, fontSize: 13, lineHeight: 1.5 }}>
          No data yet. Make a salve to see analytics here.
        </div>
      )}
    </div>
  );
}
