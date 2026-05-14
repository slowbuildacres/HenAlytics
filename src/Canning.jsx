// ============================================================================
// CANNING PAGE
// ----------------------------------------------------------------------------
// Tracks canning batches with pantry inventory and expiration awareness.
// Each batch is a canning session producing N jars of one item. Batches
// have a date, item name, jar type (pint/quart/etc), jarsMade, jarsRemaining
// (decremented as jars are used or sold), eat-by date, ingredient cost,
// and notes. Sales flow into data.sales with hobbyType="canning".
//
// Data shape:
//   hobby.batches[] = [{ id, date, item, jarType, jarsMade, jarsRemaining,
//                        eatByDate, ingredientsCost, notes, archived }]
//   data.entries["canning"] = [{ id, action: "use" | "sale", batchId, ... }]
//     — entries log usage history but the source of truth for jar counts
//     is batch.jarsRemaining.
// ============================================================================

import React, { useState, useMemo } from "react";
import { X, Edit3, Plus, AlertTriangle } from "lucide-react";
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
const addDaysIso = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};
const daysUntil = (iso) => {
  if (!iso) return null;
  const target = new Date(iso + "T12:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const ms = target.getTime() - now.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
};

const JAR_TYPES = ["Half-pint", "Pint", "Quart", "Half-gallon", "Other"];

// Common canned items for the suggestion dropdown
const COMMON_ITEMS = [
  "Tomato sauce", "Salsa", "Pickles", "Jam", "Jelly", "Apple butter",
  "Pickled beets", "Green beans", "Peaches", "Pears", "Applesauce",
  "Strawberry jam", "Pizza sauce", "Bread & butter pickles", "Dill pickles",
  "Chicken stock", "Beef stock", "Vegetable stock",
];

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

function Btn({ children, onClick, variant = "primary", small = false, style = {}, type = "button", disabled = false }) {
  const variants = {
    primary: { bg: palette.ink, color: palette.bg, border: palette.ink },
    ghost: { bg: palette.bgAlt, color: palette.ink, border: palette.line },
    leaf: { bg: palette.leaf, color: "#fff", border: palette.leaf },
    danger: { bg: palette.accent, color: "#fff", border: palette.accent },
  };
  const v = variants[variant] || variants.primary;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? "6px 12px" : "10px 18px",
        background: v.bg, color: v.color, border: `1.5px solid ${v.border}`,
        borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: FONT_BODY, fontWeight: 600, fontSize: small ? 12 : 14,
        opacity: disabled ? 0.6 : 1,
        boxShadow: "2px 2px 0 " + palette.line,
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
      background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12,
      padding: 14, flex: "1 1 130px", minWidth: 130, boxSizing: "border-box",
    }}>
      <div style={{ fontSize: 10, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontFamily: FONT_DISPLAY, color: accent, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>
        {label}
      </div>
      {children}
    </label>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(44,24,16,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: palette.bg, borderRadius: 16, maxWidth: 480, width: "100%",
          maxHeight: "90vh", overflow: "auto",
          border: `2px solid ${palette.ink}`,
          boxShadow: "6px 8px 0 " + palette.line,
        }}
      >
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: `1.5px solid ${palette.line}`,
        }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.ink }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: palette.ink, padding: 4 }}>
            <X size={22} />
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

// Compute the expiration "state" for a batch.
function expiryState(batch) {
  if (!batch.eatByDate) return { state: "none", label: null, color: palette.inkSoft };
  const days = daysUntil(batch.eatByDate);
  if (days == null) return { state: "none", label: null, color: palette.inkSoft };
  if (days < 0) return { state: "expired", label: `Expired ${Math.abs(days)}d ago`, color: palette.accent };
  if (days <= 30) return { state: "soon", label: `${days}d left`, color: palette.yolk };
  if (days <= 90) return { state: "ok", label: `${days}d left`, color: palette.leaf };
  return { state: "good", label: `Good until ${batch.eatByDate}`, color: palette.leaf };
}

// ============================================================================
// MODALS
// ============================================================================

function BatchModal({ batch, onSave, onDelete, onClose }) {
  const isEdit = !!batch;
  const [date, setDate] = useState(batch?.date || todayIso());
  const [item, setItem] = useState(batch?.item || "");
  const [jarType, setJarType] = useState(batch?.jarType || "Pint");
  const [jarsMade, setJarsMade] = useState(batch?.jarsMade != null ? String(batch.jarsMade) : "");
  const [jarsRemaining, setJarsRemaining] = useState(batch?.jarsRemaining != null ? String(batch.jarsRemaining) : "");
  // Default eat-by = 12 months out for new batches
  const [eatByDate, setEatByDate] = useState(batch?.eatByDate || (isEdit ? "" : addDaysIso(365)));
  const [ingredientsCost, setIngredientsCost] = useState(batch?.ingredientsCost != null ? String(batch.ingredientsCost) : "");
  const [notes, setNotes] = useState(batch?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const made = parseInt(jarsMade) || 0;
  const remaining = parseInt(jarsRemaining) || 0;
  // Default jarsRemaining to jarsMade for new batches
  const effectiveRemaining = isEdit ? remaining : (jarsRemaining === "" ? made : remaining);

  const handleSave = () => {
    if (!item.trim() || made <= 0) return;
    onSave({
      id: batch?.id || newId(),
      date,
      item: item.trim(),
      jarType,
      jarsMade: made,
      jarsRemaining: Math.max(0, effectiveRemaining),
      eatByDate: eatByDate || null,
      ingredientsCost: parseFloat(ingredientsCost) || 0,
      notes: notes.trim(),
      archived: batch?.archived || false,
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit batch" : "New canning batch"}>
      <Field label="Date canned">
        <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <Field label="What did you can?">
        <input
          style={inputStyle}
          value={item}
          onChange={e => setItem(e.target.value)}
          placeholder="e.g. Tomato sauce"
          list="canning-items"
          autoFocus
        />
        <datalist id="canning-items">
          {COMMON_ITEMS.map(c => <option key={c} value={c} />)}
        </datalist>
      </Field>
      <Field label="Jar size">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {JAR_TYPES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setJarType(t)}
              style={{
                padding: "8px 12px", borderRadius: 8,
                border: `1.5px solid ${jarType === t ? palette.ink : palette.line}`,
                background: jarType === t ? palette.ink : palette.card,
                color: jarType === t ? palette.bg : palette.ink,
                fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Jars made">
            <input type="number" min="0" style={inputStyle} value={jarsMade} onChange={e => setJarsMade(e.target.value)} placeholder="12" />
          </Field>
        </div>
        {isEdit && (
          <div style={{ flex: 1 }}>
            <Field label="Jars remaining">
              <input type="number" min="0" style={inputStyle} value={jarsRemaining} onChange={e => setJarsRemaining(e.target.value)} />
            </Field>
          </div>
        )}
      </div>
      <Field label="Eat by (optional)">
        <input type="date" style={inputStyle} value={eatByDate} onChange={e => setEatByDate(e.target.value)} />
      </Field>
      <Field label="Ingredients cost ($, optional)">
        <input type="number" step="0.01" min="0" style={inputStyle} value={ingredientsCost} onChange={e => setIngredientsCost(e.target.value)} placeholder="0.00" />
      </Field>
      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Recipe, water bath time, pressure..." />
      </Field>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Btn variant="primary" onClick={handleSave} disabled={!item.trim() || made <= 0} style={{ flex: 1 }}>
          {isEdit ? "Save" : "Add batch"}
        </Btn>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      </div>

      {isEdit && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1.5px solid ${palette.line}` }}>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ background: "none", border: "none", color: palette.accent, fontFamily: FONT_BODY, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
            >
              Delete batch
            </button>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: palette.ink, marginBottom: 8 }}>Delete this batch entirely?</div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="danger" small onClick={() => { onDelete(batch.id); onClose(); }}>Yes, delete</Btn>
                <Btn variant="ghost" small onClick={() => setConfirmDelete(false)}>Keep</Btn>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function UseJarsModal({ batch, onUse, onClose }) {
  const [qty, setQty] = useState("1");
  const [date, setDate] = useState(todayIso());
  const [reason, setReason] = useState("personal"); // "personal" | "sale" | "gift"
  const [pricePerJar, setPricePerJar] = useState("");
  const [note, setNote] = useState("");

  const q = parseInt(qty) || 0;
  const price = parseFloat(pricePerJar) || 0;
  const revenue = reason === "sale" ? q * price : 0;
  const costPerJar = batch.jarsMade > 0 ? (Number(batch.ingredientsCost) || 0) / batch.jarsMade : 0;
  const cost = reason === "sale" ? costPerJar * q : 0;

  const exceedsStock = q > (batch.jarsRemaining || 0);

  const handleSubmit = () => {
    if (q <= 0) return;
    onUse({
      batchId: batch.id,
      qty: q,
      date,
      reason,
      pricePerJar: reason === "sale" ? price : 0,
      costPerJar: reason === "sale" ? costPerJar : 0,
      revenue,
      cost,
      note: note.trim(),
      item: batch.item,
      jarType: batch.jarType,
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Use ${batch.item}`}>
      <div style={{
        padding: 10, marginBottom: 14, background: palette.bgAlt, borderRadius: 8,
        fontSize: 13, color: palette.ink,
      }}>
        <strong>{batch.jarsRemaining}</strong> {batch.jarType.toLowerCase()} jars left from this batch.
      </div>

      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <Field label="Jars used">
        <input type="number" min="1" max={batch.jarsRemaining} style={inputStyle} value={qty} onChange={e => setQty(e.target.value)} autoFocus />
      </Field>
      <Field label="Reason">
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { id: "personal", label: "🏠 Personal use" },
            { id: "gift", label: "🎁 Gift" },
            { id: "sale", label: "💰 Sale" },
          ].map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => setReason(r.id)}
              style={{
                flex: 1, padding: "8px 6px", borderRadius: 8,
                border: `1.5px solid ${reason === r.id ? palette.ink : palette.line}`,
                background: reason === r.id ? palette.ink : palette.card,
                color: reason === r.id ? palette.bg : palette.ink,
                fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </Field>
      {reason === "sale" && (
        <>
          <Field label="Price per jar ($)">
            <input type="number" step="0.01" min="0" style={inputStyle} value={pricePerJar} onChange={e => setPricePerJar(e.target.value)} placeholder="0.00" />
          </Field>
          <div style={{
            padding: 12, background: palette.yolkSoft, borderRadius: 8,
            marginBottom: 14, fontSize: 13, color: palette.ink, lineHeight: 1.6,
          }}>
            Revenue: <strong>{fmtMoney(revenue)}</strong> · Cost: {fmtMoney(cost)} · Profit: <strong>{fmtMoney(revenue - cost)}</strong>
          </div>
        </>
      )}
      <Field label="Note (optional)">
        <input style={inputStyle} value={note} onChange={e => setNote(e.target.value)} placeholder={reason === "sale" ? "Buyer, occasion..." : "What did you use it for?"} />
      </Field>

      {exceedsStock && (
        <div style={{
          padding: 10, background: "#FBE5DE", border: `1.5px solid ${palette.accent}`,
          borderRadius: 8, fontSize: 13, color: palette.accent, marginBottom: 14,
          display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Only {batch.jarsRemaining} jars left. This will take you {q - batch.jarsRemaining} below zero.</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Btn
          variant={reason === "sale" ? "leaf" : "primary"}
          onClick={handleSubmit}
          disabled={q <= 0 || (reason === "sale" && price <= 0)}
          style={{ flex: 1 }}
        >
          {reason === "sale" ? "Record sale" : "Log usage"}
        </Btn>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  );
}

// ============================================================================
// PAGE
// ============================================================================

function InfrastructureModal({ entry, onSave, onDelete, onClose }) {
  const [date, setDate] = useState(entry?.date || todayStr());
  const [item, setItem] = useState(entry?.item || "");
  const [cost, setCost] = useState(entry?.cost != null ? String(entry.cost) : "");
  const [note, setNote] = useState(entry?.note || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const handleSave = () => {
    if (!item.trim()) return;
    onSave({
      id: entry?.id || newId(),
      action: "infrastructure",
      date,
      item: item.trim(),
      cost: parseFloat(cost) || 0,
      note: note.trim(),
      created: entry?.created || Date.now(),
    });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={entry ? "Edit infrastructure" : "🔨 Log infrastructure"}>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <Field label="What was built / repaired / bought?">
        <input style={inputStyle} value={item} onChange={e => setItem(e.target.value)} placeholder="e.g. pressure canner, jar storage shelves" autoFocus />
      </Field>
      <Field label="Cost ($)">
        <input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e => setCost(e.target.value)} placeholder="$0.00" />
      </Field>
      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={note} onChange={e => setNote(e.target.value)} placeholder="Materials, supplier, etc." />
      </Field>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {entry && onDelete && (
          !confirmDelete
            ? <Btn variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Btn>
            : <Btn variant="danger" onClick={() => { onDelete(entry.id); onClose(); }}>Confirm delete</Btn>
        )}
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={!item.trim()}>Save</Btn>
      </div>
    </Modal>
  );
}

export default function CanningPage({ hobby, data, update, setModal }) {
  const [editBatch, setEditBatch] = useState(null); // batch obj | "new" | null
  const [usingBatch, setUsingBatch] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [infraModal, setInfraModal] = useState({ open: false, entry: null });

  if (!hobby) return null;
  const batches = Array.isArray(hobby.batches) ? hobby.batches : [];
  const canningEntries = data.entries?.["canning"] || [];
  const infraEntries = canningEntries.filter(e => e.action === "infrastructure");
  const recentInfra = infraEntries.slice().sort((a,b) => (b.date||"").localeCompare(a.date||"")).slice(0, 3);

  const saveInfra = (entry) => {
    update(d => {
      if (!d.entries) d.entries = {};
      d.entries["canning"] = d.entries["canning"] || [];
      const idx = d.entries["canning"].findIndex(e => e.id === entry.id);
      if (idx >= 0) d.entries["canning"][idx] = entry;
      else d.entries["canning"].push(entry);
      return d;
    });
  };
  const deleteInfra = (id) => {
    update(d => {
      if (d.entries?.["canning"]) {
        d.entries["canning"] = d.entries["canning"].filter(e => e.id !== id);
      }
      return d;
    });
  };

  // Active batches = not archived AND (has jars remaining OR not auto-archived)
  // We show empty batches in the pantry until the user manually archives them.
  const activeBatches = batches.filter(b => !b.archived);
  const archivedBatches = batches.filter(b => b.archived);

  // Sort active: expiring soonest first (with no eat-by date last)
  const sortedActive = [...activeBatches].sort((a, b) => {
    const aDays = a.eatByDate ? daysUntil(a.eatByDate) : Infinity;
    const bDays = b.eatByDate ? daysUntil(b.eatByDate) : Infinity;
    return aDays - bDays;
  });

  const totalJarsInPantry = activeBatches.reduce((s, b) => s + (Number(b.jarsRemaining) || 0), 0);
  const expiringSoon = activeBatches.filter(b => {
    const d = b.eatByDate ? daysUntil(b.eatByDate) : null;
    return d != null && d >= 0 && d <= 30 && (Number(b.jarsRemaining) || 0) > 0;
  }).length;
  const expired = activeBatches.filter(b => {
    const d = b.eatByDate ? daysUntil(b.eatByDate) : null;
    return d != null && d < 0 && (Number(b.jarsRemaining) || 0) > 0;
  }).length;

  const saveBatch = (b) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.batches)) h.batches = [];
      const idx = h.batches.findIndex(x => x.id === b.id);
      if (idx >= 0) h.batches[idx] = b; else h.batches.push(b);
      return d;
    });
  };

  const deleteBatch = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h && Array.isArray(h.batches)) h.batches = h.batches.filter(b => b.id !== id);
      return d;
    });
  };

  const archiveBatch = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      const target = (h.batches || []).find(b => b.id === id);
      if (target) target.archived = true;
      return d;
    });
  };

  const unarchiveBatch = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      const target = (h.batches || []).find(b => b.id === id);
      if (target) target.archived = false;
      return d;
    });
  };

  const useJars = (useData) => {
    update(d => {
      // Decrement remaining on the batch
      const h = d.hobbies.find(x => x.id === hobby.id);
      const target = h?.batches?.find(b => b.id === useData.batchId);
      if (target) {
        target.jarsRemaining = Math.max(0, (Number(target.jarsRemaining) || 0) - useData.qty);
      }
      // Log entry for history
      if (!d.entries) d.entries = {};
      if (!Array.isArray(d.entries["canning"])) d.entries["canning"] = [];
      d.entries["canning"].push({
        id: newId(),
        date: useData.date,
        action: useData.reason === "sale" ? "sale" : "use",
        reason: useData.reason,
        batchId: useData.batchId,
        item: useData.item,
        jarType: useData.jarType,
        qty: useData.qty,
        pricePerJar: useData.pricePerJar || 0,
        revenue: useData.revenue || 0,
        cost: useData.cost || 0,
        note: useData.note || "",
        created: Date.now(),
      });
      // Sale record
      if (useData.reason === "sale") {
        if (!Array.isArray(d.sales)) d.sales = [];
        d.sales.push({
          id: newId(),
          date: useData.date,
          hobbyType: "canning",
          crop: useData.item,
          gardenUnit: `${useData.jarType.toLowerCase()} jars`,
          qty: useData.qty,
          unit: `${useData.jarType.toLowerCase()} jars`,
          pricePerUnit: useData.pricePerJar,
          costPerUnit: useData.costPerJar,
          totalRevenue: useData.revenue,
          totalCost: useData.cost,
          note: useData.note || "",
          buyerId: null,
          created: Date.now(),
          fromCanningBatchId: useData.batchId,
        });
      }
      return d;
    });
  };

  return (
    <div>
      {/* Header actions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <Btn variant="primary" onClick={() => setEditBatch("new")} style={{ flex: "1 1 140px" }}>
          + New batch
        </Btn>
        <Btn variant="ghost" onClick={() => setInfraModal({ open: true, entry: null })} style={{ flex: "1 1 140px" }}>
          🔨 Infrastructure
        </Btn>
      </div>
      {infraModal.open && (
        <InfrastructureModal
          entry={infraModal.entry}
          onSave={saveInfra}
          onDelete={deleteInfra}
          onClose={() => setInfraModal({ open: false, entry: null })}
        />
      )}

      {/* Summary stats */}
      {activeBatches.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <StatCard label="Jars in pantry" value={totalJarsInPantry} accent={palette.leaf} />
          <StatCard label="Active batches" value={activeBatches.length} accent={palette.feather} />
          {expiringSoon > 0 && <StatCard label="Expiring soon" value={expiringSoon} sub="within 30 days" accent={palette.yolk} />}
          {expired > 0 && <StatCard label="Expired" value={expired} accent={palette.accent} />}
        </div>
      )}

      {/* Pantry inventory */}
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, margin: "12px 0 10px", color: palette.ink }}>Pantry</h2>
      {sortedActive.length === 0 ? (
        <div style={{
          padding: 20, background: palette.card, border: `1.5px dashed ${palette.line}`,
          borderRadius: 10, textAlign: "center", color: palette.inkSoft, fontSize: 13,
        }}>
          No batches in your pantry yet. Tap "+ New batch" after your next canning session.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sortedActive.map(b => {
            const exp = expiryState(b);
            const remaining = Number(b.jarsRemaining) || 0;
            const made = Number(b.jarsMade) || 0;
            const empty = remaining === 0;
            return (
              <div
                key={b.id}
                style={{
                  background: palette.card,
                  border: `1.5px solid ${exp.state === "expired" ? palette.accent : palette.line}`,
                  borderRadius: 10, padding: 12,
                  opacity: empty ? 0.7 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, color: palette.ink }}>{b.item}</div>
                      <div style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                        background: exp.state === "expired" ? "#FBE5DE" : exp.state === "soon" ? palette.yolkSoft : palette.bgAlt,
                        color: exp.color, textTransform: "uppercase", letterSpacing: 0.5,
                      }}>
                        {exp.label || "No eat-by"}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 4 }}>
                      <strong style={{ color: palette.ink }}>{remaining}</strong> of {made} {b.jarType.toLowerCase()} jars left · canned {b.date}
                    </div>
                    {b.ingredientsCost > 0 && (
                      <div style={{ fontSize: 12, color: palette.inkSoft }}>
                        {fmtMoney(b.ingredientsCost)} ingredients · {fmtMoney(b.ingredientsCost / Math.max(1, made))}/jar
                      </div>
                    )}
                    {b.notes && (
                      <div style={{ fontSize: 12, color: palette.inkSoft, fontStyle: "italic", marginTop: 4 }}>
                        {b.notes.length > 100 ? b.notes.slice(0, 100) + "…" : b.notes}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                    {!empty ? (
                      <Btn small variant="leaf" onClick={() => setUsingBatch(b)}>Use jar</Btn>
                    ) : (
                      <Btn small variant="ghost" onClick={() => archiveBatch(b.id)}>Archive</Btn>
                    )}
                    <button
                      onClick={() => setEditBatch(b)}
                      style={{
                        background: "none", border: `1.5px solid ${palette.line}`,
                        borderRadius: 8, padding: "6px 10px", cursor: "pointer",
                        fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: palette.inkSoft,
                        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                      }}
                    >
                      <Edit3 size={12} /> Edit
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Archived */}
      {archivedBatches.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => setShowArchived(!showArchived)}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              fontFamily: FONT_BODY, fontSize: 13, color: palette.inkSoft,
              textDecoration: "underline",
            }}
          >
            {showArchived ? "▼" : "▶"} Archived batches ({archivedBatches.length})
          </button>
          {showArchived && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {archivedBatches.map(b => (
                <div key={b.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", background: palette.bgAlt, borderRadius: 8,
                  fontSize: 13, color: palette.inkSoft,
                }}>
                  <span>{b.item} — {b.jarsMade} {b.jarType.toLowerCase()} jars · {b.date}</span>
                  <button
                    onClick={() => unarchiveBatch(b.id)}
                    style={{ background: "none", border: "none", color: palette.leaf, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {editBatch && (
        <BatchModal
          batch={editBatch === "new" ? null : editBatch}
          onSave={saveBatch}
          onDelete={deleteBatch}
          onClose={() => setEditBatch(null)}
        />
      )}
      {usingBatch && (
        <UseJarsModal
          batch={usingBatch}
          onUse={useJars}
          onClose={() => setUsingBatch(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// ANALYTICS
// ============================================================================

export function CanningAnalytics({ hobby, entries = [], sales = [], spouseMode = false }) {
  const batches = Array.isArray(hobby?.batches) ? hobby.batches : [];
  const canningSales = useMemo(() => sales.filter(s => s.hobbyType === "canning"), [sales]);

  const activeBatches = batches.filter(b => !b.archived);
  const totalJarsInPantry = activeBatches.reduce((s, b) => s + (Number(b.jarsRemaining) || 0), 0);
  const totalJarsMade = batches.reduce((s, b) => s + (Number(b.jarsMade) || 0), 0);
  const totalCostRaw = batches.reduce((s, b) => s + (Number(b.ingredientsCost) || 0), 0);
  const totalCost = spouseMode ? totalCostRaw * 0.1 : totalCostRaw;

  const totalRevenueRaw = canningSales.reduce((s, x) => s + (Number(x.totalRevenue) || 0), 0);
  const totalRevenue = spouseMode ? totalRevenueRaw * 2 : totalRevenueRaw;

  // By item
  const byItem = {};
  batches.forEach(b => {
    const n = b.item || "Unknown";
    byItem[n] = (byItem[n] || 0) + (Number(b.jarsMade) || 0);
  });
  const topData = Object.entries(byItem)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name: name.length > 16 ? name.slice(0, 16) + "…" : name, value }));

  if (batches.length === 0 && canningSales.length === 0) {
    return (
      <div style={{
        padding: 24, background: palette.card, border: `1.5px solid ${palette.line}`,
        borderRadius: 12, textAlign: "center", color: palette.inkSoft, fontSize: 14,
      }}>
        No canning activity yet. Add a batch to see stats here.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Jars in pantry" value={totalJarsInPantry} accent={palette.leaf} />
        <StatCard label="Total jars made" value={totalJarsMade} accent={palette.feather} />
        <StatCard label="Total cost" value={fmtMoney(totalCost)} accent={palette.ink} />
        {canningSales.length > 0 && <StatCard label="Sales" value={canningSales.length} sub={fmtMoney(totalRevenue)} accent={palette.yolk} />}
        {(() => {
          const infraTotal = (entries || []).filter(e => e.action === "infrastructure").reduce((s, e) => s + (Number(e.cost) || 0), 0);
          return infraTotal > 0 ? <StatCard label="Infrastructure" value={fmtMoney(infraTotal)} accent={palette.feather} /> : null;
        })()}
      </div>

      {topData.length > 0 && (
        <div style={{
          background: palette.card, border: `1.5px solid ${palette.line}`,
          borderRadius: 12, padding: 14, marginBottom: 12,
        }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, marginBottom: 10, color: palette.ink }}>Most canned</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topData}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: palette.inkSoft }} />
              <YAxis tick={{ fontSize: 11, fill: palette.inkSoft }} />
              <Tooltip />
              <Bar dataKey="value" fill={palette.leaf} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
