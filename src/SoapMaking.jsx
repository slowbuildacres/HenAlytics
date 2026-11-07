// ============================================================================
// SOAP MAKING PAGE
// ----------------------------------------------------------------------------
// Batch-based, like Canning: each batch records its ingredients (with cost),
// when it was made, and how long it cures. The expected cure date drops a
// reminder on the calendar. Bars then leave the batch by being SOLD (writes a
// data.sales row, hobbyType "soap", so it shows in the Sales tab) or USED
// (kept for the house / given away — logged on the batch).
//
// Data shape on the hobby:
//   hobby.batches[] = [{ id, name, method, madeDate, cureWeeks, expectedCureDate,
//                        bars, ingredients: [{ id, name, amount, unit, cost }],
//                        uses: [{ id, date, qty, kind: "used"|"gifted", note }],
//                        notes, archived, created }]
// Sold bars are derived from data.sales where batchId === batch.id.
// ============================================================================

import { legacyPalette } from "./newlook/legacyTheme.js";
import { undoable } from "./newlook/UndoBar.jsx";
import React, { useState } from "react";
// NEW_LOOK (3.0): shared kitchen & craft screens.
import { PantryView } from "./newlook/pantry/PantryScreens.jsx";
import { Receipt as NlReceipt, NotebookPen as NlNote, Plus as NlPlus, DollarSign as NlDollar, Gift as NlGift } from "lucide-react";
import { X, Trash2 } from "lucide-react";
import { fmtMoney, currencySymbol } from "./units.js";
import { groupDigits } from "./numFmt.js";

const palette = legacyPalette({
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47",
  line: "#2C181030", card: "#FAF5EA",
});
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;
const inputStyle = () => ({
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
});

const newId = () => Math.random().toString(36).slice(2, 10);
const localDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const todayStr = () => localDateStr(new Date());
const parseLocalDate = (s) => { if (!s) return new Date(); const [y,m,d] = s.split("-").map(Number); return new Date(y,(m||1)-1,d||1); };
const fmtDate = (s) => s ? parseLocalDate(s).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "";
const addDays = (s, n) => { const d = parseLocalDate(s); d.setDate(d.getDate() + n); return localDateStr(d); };

// Default cure times by method (weeks). Cold process needs the full cure for
// saponification + hardening; hot process is usable sooner but still benefits
// from a short cure; melt & pour is ready once set.
const METHODS = [
  { id: "cold", label: "Cold process", cureWeeks: 4 },
  { id: "hot", label: "Hot process", cureWeeks: 1 },
  { id: "melt_pour", label: "Melt & pour", cureWeeks: 0 },
  { id: "liquid", label: "Liquid soap", cureWeeks: 2 },
];
const UNITS = ["oz", "lb", "g", "kg", "fl oz", "ml", "tsp", "tbsp", "cup", "each"];

// Shared batch math — used by the page, analytics, YIR and share card.
export function soapBatchStats(batch, sales = []) {
  const soldSales = (sales || []).filter(s => s && s.hobbyType === "soap" && s.batchId === batch.id);
  const sold = soldSales.reduce((s, x) => s + (Number(x.qty) || 0), 0);
  const revenue = soldSales.reduce((s, x) => s + (Number(x.totalRevenue) || 0), 0);
  const used = (batch.uses || []).filter(u => u.kind !== "gifted").reduce((s, u) => s + (Number(u.qty) || 0), 0);
  const gifted = (batch.uses || []).filter(u => u.kind === "gifted").reduce((s, u) => s + (Number(u.qty) || 0), 0);
  const bars = Number(batch.bars) || 0;
  const cost = (batch.ingredients || []).reduce((s, i) => s + (Number(i.cost) || 0), 0);
  const today = todayStr();
  const cured = !batch.expectedCureDate || batch.expectedCureDate <= today;
  const daysLeft = cured ? 0 : Math.ceil((parseLocalDate(batch.expectedCureDate) - parseLocalDate(today)) / 86400000);
  return {
    bars, sold, used, gifted, revenue, cost,
    remaining: Math.max(0, bars - sold - used - gifted),
    costPerBar: bars > 0 ? cost / bars : 0,
    cured, daysLeft,
  };
}

function Btn({ children, onClick, variant = "primary", small = false, style = {}, disabled = false }) {
  const v = {
    primary: { background: palette.ink, color: palette.bg, border: `1.5px solid ${palette.ink}` },
    danger: { background: palette.accent, color: palette.onColor, border: `1.5px solid ${palette.accent}` },
    ghost: { background: "transparent", color: palette.ink, border: `1.5px solid ${palette.line}` },
    accent: { background: palette.yolk, color: palette.onYolk, border: `1.5px solid ${palette.ink}` },
  };
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} style={{minHeight: small ? 36 : 44, 
      padding: small ? "6px 12px" : "10px 18px", borderRadius: small ? 999 : 14, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: FONT_BODY, fontWeight: 600, fontSize: small ? 13 : 14, opacity: disabled ? 0.6 : 1,
      boxShadow: "none", ...v[variant], ...style,
    }}>{children}</button>
  );
}
function StatCard({ label, value, sub, accent = palette.accent }) {
  return (
    <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 16, padding: 14, flex: "1 1 130px", minWidth: 130, boxSizing: "border-box" }}>
      <div style={{ fontSize: 10, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontFamily: FONT_BODY }}>{label}</div>
      <div style={{ fontSize: 22, fontFamily: FONT_DISPLAY, color: palette.ink, lineHeight: 1.1 }}>{groupDigits(value)}</div>
      {sub && <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4, fontFamily: FONT_BODY }}>{sub}</div>}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>{label}</div>
      {children}
    </label>
  );
}
function ModalShell({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(44,24,16,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: palette.bg, borderRadius: 16, maxWidth: 480, width: "100%", maxHeight: "90vh", overflow: "auto", border: `2px solid ${palette.ink}`, boxShadow: "0 12px 32px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1.5px solid ${palette.line}`, position: "sticky", top: 0, background: palette.bg, zIndex: 1 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.ink }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: palette.ink, padding: 4 }}><X size={22} /></button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Batch modal — ingredients, made date, cure time.
// ---------------------------------------------------------------------------
function BatchModal({ batch, onSave, onDelete, onClose }) {
  const [name, setName] = useState(batch?.name || "");
  const [method, setMethod] = useState(batch?.method || "cold");
  const [madeDate, setMadeDate] = useState(batch?.madeDate || todayStr());
  const [cureWeeks, setCureWeeks] = useState(batch ? String(batch.cureWeeks ?? 4) : "4");
  const [bars, setBars] = useState(batch?.bars ? String(batch.bars) : "");
  const [ingredients, setIngredients] = useState(() =>
    (batch?.ingredients || []).length ? batch.ingredients.map(i => ({ ...i, amount: String(i.amount ?? ""), cost: String(i.cost ?? "") }))
      : [{ id: newId(), name: "", amount: "", unit: "oz", cost: "" }]
  );
  const [notes, setNotes] = useState(batch?.notes || "");
  const [confirm, setConfirm] = useState(false);

  const weeks = Math.max(0, parseFloat(cureWeeks) || 0);
  const cureDate = madeDate ? addDays(madeDate, Math.round(weeks * 7)) : "";
  const totalCost = ingredients.reduce((s, i) => s + (parseFloat(i.cost) || 0), 0);
  const setIng = (id, k, v) => setIngredients(arr => arr.map(i => i.id === id ? { ...i, [k]: v } : i));

  const save = () => {
    onSave({
      id: batch?.id || newId(),
      name: name.trim(), method, madeDate, cureWeeks: weeks, expectedCureDate: cureDate,
      bars: parseInt(bars, 10) || 0,
      ingredients: ingredients
        .filter(i => i.name.trim())
        .map(i => ({ id: i.id, name: i.name.trim(), amount: parseFloat(i.amount) || 0, unit: i.unit, cost: parseFloat(i.cost) || 0 })),
      uses: batch?.uses || [],
      notes: notes.trim(),
      archived: batch?.archived || false,
      created: batch?.created || Date.now(),
    });
    onClose();
  };

  return (
    <ModalShell title={batch ? "Edit batch" : "🧼 New soap batch"} onClose={onClose}>
      <Field label="Batch / recipe name"><input style={inputStyle()} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Oatmeal honey, Lavender goat milk" autoFocus /></Field>
      <Field label="Method">
        <select style={inputStyle()} value={method} onChange={e => {
          setMethod(e.target.value);
          const m = METHODS.find(x => x.id === e.target.value);
          if (m && !batch) setCureWeeks(String(m.cureWeeks));
        }}>
          {METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><Field label="Made on"><input type="date" style={inputStyle()} value={madeDate} onChange={e => setMadeDate(e.target.value)} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Cure (weeks)"><input type="number" inputMode="decimal" min={0} step="0.5" style={inputStyle()} value={cureWeeks} onChange={e => setCureWeeks(e.target.value)} /></Field></div>
      </div>
      {cureDate && (
        <div style={{ padding: "8px 12px", background: palette.bgAlt, borderRadius: 8, fontSize: 12, color: palette.inkSoft, marginBottom: 12 }}>
          📅 Ready on <strong style={{ color: palette.ink }}>{fmtDate(cureDate)}</strong>{!batch ? " — we'll put a reminder on your calendar." : ""}
        </div>
      )}
      <Field label="Bars made"><input type="number" inputMode="numeric" min={0} style={inputStyle()} value={bars} onChange={e => setBars(e.target.value)} placeholder="e.g. 12" /></Field>

      <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>Ingredients</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
        {ingredients.map(i => (
          <div key={i.id} style={{ display: "grid", gridTemplateColumns: "1fr 64px 72px 72px 28px", gap: 4, alignItems: "center" }}>
            <input style={{ ...inputStyle(), padding: "8px", fontSize: 13 }} value={i.name} onChange={e => setIng(i.id, "name", e.target.value)} placeholder="Olive oil" />
            <input style={{ ...inputStyle(), padding: "8px", fontSize: 13 }} type="number" inputMode="decimal" min={0} value={i.amount} onChange={e => setIng(i.id, "amount", e.target.value)} placeholder="Amt" />
            <select style={{ ...inputStyle(), padding: "8px 4px", fontSize: 13 }} value={i.unit} onChange={e => setIng(i.id, "unit", e.target.value)}>{UNITS.map(u => <option key={u}>{u}</option>)}</select>
            <input style={{ ...inputStyle(), padding: "8px", fontSize: 13 }} type="number" inputMode="decimal" min={0} step="0.01" value={i.cost} onChange={e => setIng(i.id, "cost", e.target.value)} placeholder={`${currencySymbol()}`} />
            <button onClick={() => setIngredients(arr => arr.filter(x => x.id !== i.id))} aria-label="Remove ingredient" style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Btn small variant="ghost" onClick={() => setIngredients(arr => [...arr, { id: newId(), name: "", amount: "", unit: "oz", cost: "" }])}>+ Ingredient</Btn>
        <span style={{ fontSize: 12, color: palette.inkSoft }}>
          Batch cost <strong style={{ color: palette.ink }}>{fmtMoney(totalCost)}</strong>
          {parseInt(bars, 10) > 0 ? ` · ${fmtMoney(totalCost / parseInt(bars, 10))}/bar` : ""}
        </span>
      </div>
      <Field label="Notes (optional)"><textarea style={{ ...inputStyle(), minHeight: 50, resize: "vertical" }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Superfat %, fragrance, how it traced…" /></Field>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {batch && (!confirm
          ? <Btn variant="ghost" onClick={() => setConfirm(true)}>Delete</Btn>
          : <Btn variant="danger" onClick={() => { onDelete(batch.id); onClose(); }}>Confirm delete</Btn>)}
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!name.trim() || !madeDate}>Save</Btn>
      </div>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Sell / use modal — one modal, two modes.
// ---------------------------------------------------------------------------
function MoveBarsModal({ mode, batches, sales, customers, presetBatchId, onSale, onUse, onClose }) {
  const avail = batches.filter(b => !b.archived && soapBatchStats(b, sales).remaining > 0);
  const [batchId, setBatchId] = useState(presetBatchId || avail[0]?.id || "");
  const batch = batches.find(b => b.id === batchId);
  const st = batch ? soapBatchStats(batch, sales) : null;
  const [date, setDate] = useState(todayStr());
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [kind, setKind] = useState("used");
  const [buyerId, setBuyerId] = useState("");
  const [buyer, setBuyer] = useState("");
  const [note, setNote] = useState("");
  const n = parseInt(qty, 10) || 0;
  const ok = batch && n > 0 && n <= (st?.remaining || 0);

  if (avail.length === 0 && !presetBatchId) {
    return (
      <ModalShell title={mode === "sell" ? "💵 Sell bars" : "🧺 Use bars"} onClose={onClose}>
        <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 12 }}>No bars left in any batch. Make a batch first.</div>
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
      </ModalShell>
    );
  }

  const save = () => {
    if (!ok) return;
    if (mode === "sell") {
      const p = parseFloat(price) || 0;
      onSale({
        id: newId(), date, hobbyType: "soap", crop: batch.name, batchId: batch.id,
        qty: n, unit: "bars", pricePerUnit: p, totalRevenue: p * n,
        totalCost: Math.round(st.costPerBar * n * 100) / 100,
        buyerId: buyerId || null, buyer: buyer.trim(), note: note.trim(), created: Date.now(),
      });
    } else {
      onUse(batch.id, { id: newId(), date, qty: n, kind, note: note.trim() });
    }
    onClose();
  };

  return (
    <ModalShell title={mode === "sell" ? "💵 Sell bars" : "🧺 Use / give bars"} onClose={onClose}>
      <Field label="Batch">
        <select style={inputStyle()} value={batchId} onChange={e => setBatchId(e.target.value)}>
          {(presetBatchId ? batches.filter(b => b.id === presetBatchId) : avail).map(b => (
            <option key={b.id} value={b.id}>{b.name} — {soapBatchStats(b, sales).remaining} left</option>
          ))}
        </select>
        {st && !st.cured && <div style={{ fontSize: 11, color: palette.accent, marginTop: 4 }}>Heads up: still curing — {st.daysLeft} day{st.daysLeft === 1 ? "" : "s"} to go.</div>}
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><Field label="Date"><input type="date" style={inputStyle()} value={date} onChange={e => setDate(e.target.value)} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Bars"><input type="number" inputMode="numeric" min={1} max={st?.remaining || undefined} style={inputStyle()} value={qty} onChange={e => setQty(e.target.value)} /></Field></div>
      </div>
      {mode === "sell" ? (
        <>
          <Field label={`Price per bar (${currencySymbol()})`}><input type="number" inputMode="decimal" step="0.01" min={0} style={inputStyle()} value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 7.00" /></Field>
          <Field label="Customer (optional)">
            <select style={inputStyle()} value={buyerId} onChange={e => { setBuyerId(e.target.value); setBuyer(""); }}>
              <option value="">— No customer / new below —</option>
              {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {!buyerId && <input style={{ ...inputStyle(), marginTop: 6 }} value={buyer} onChange={e => setBuyer(e.target.value)} placeholder="New customer name (optional)" />}
          </Field>
          {n > 0 && <div style={{ padding: 10, background: palette.yolkSoft, borderRadius: 6, fontSize: 13, textAlign: "center", marginBottom: 12 }}>Revenue <strong>{fmtMoney((parseFloat(price) || 0) * n)}</strong>{st?.costPerBar > 0 ? ` · cost ${fmtMoney(st.costPerBar * n)}` : ""}</div>}
        </>
      ) : (
        <Field label="What happened to them?">
          <select style={inputStyle()} value={kind} onChange={e => setKind(e.target.value)}>
            <option value="used">Used at home</option>
            <option value="gifted">Gave away / gifted</option>
          </select>
        </Field>
      )}
      <Field label="Note (optional)"><input style={inputStyle()} value={note} onChange={e => setNote(e.target.value)} /></Field>
      {batch && n > (st?.remaining || 0) && <div style={{ fontSize: 12, color: palette.accent, marginBottom: 8 }}>Only {st.remaining} left in this batch.</div>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!ok}>Save</Btn>
      </div>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function SoapMakingPage({ hobby, data, update, setModal, nl = null }) {
  const [batchModal, setBatchModal] = useState({ open: false, batch: null });
  const [moveModal, setMoveModal] = useState({ open: false, mode: "sell", batchId: null });
  if (!hobby) return null;
  const sales = data.sales || [];
  const batches = hobby.batches || [];
  const active = batches.filter(b => !b.archived);
  const archived = batches.filter(b => b.archived);

  const curing = active.filter(b => !soapBatchStats(b, sales).cured);
  const readyBars = active.filter(b => soapBatchStats(b, sales).cured).reduce((s, b) => s + soapBatchStats(b, sales).remaining, 0);
  const curingBars = curing.reduce((s, b) => s + soapBatchStats(b, sales).remaining, 0);
  const year = String(new Date().getFullYear());
  const yearRevenue = sales.filter(s => s.hobbyType === "soap" && (s.date || "").startsWith(year)).reduce((s, x) => s + (Number(x.totalRevenue) || 0), 0);

  const saveBatch = (rec) => undoable(update, `Saved ${rec.name || "batch"}`)(d => {
    const h = d.hobbies.find(x => x.id === hobby.id);
    if (!h) return d;
    if (!Array.isArray(h.batches)) h.batches = [];
    const i = h.batches.findIndex(x => x.id === rec.id);
    const isNew = i < 0;
    if (isNew) h.batches.push(rec); else h.batches[i] = rec;
    // Cure-date reminder: add for new batches; keep in step on edits.
    if (!Array.isArray(d.calendarEvents)) d.calendarEvents = [];
    const ev = d.calendarEvents.find(e => e.soapBatchId === rec.id);
    if (rec.expectedCureDate && rec.cureWeeks > 0) {
      if (ev) { ev.date = rec.expectedCureDate; ev.title = `🧼 Soap cured: ${rec.name}`; }
      else d.calendarEvents.push({ id: newId(), date: rec.expectedCureDate, title: `🧼 Soap cured: ${rec.name}`, type: "soap_cured", notes: `${rec.bars || 0} bars made ${rec.madeDate}.`, soapBatchId: rec.id });
    } else if (ev) {
      d.calendarEvents = d.calendarEvents.filter(e => e.soapBatchId !== rec.id);
    }
    return d;
  });
  const deleteBatch = (id) => undoable(update, "Deleted batch")(d => {
    const h = d.hobbies.find(x => x.id === hobby.id);
    if (h) h.batches = (h.batches || []).filter(b => b.id !== id);
    if (Array.isArray(d.calendarEvents)) d.calendarEvents = d.calendarEvents.filter(e => e.soapBatchId !== id);
    return d;
  });
  const setArchived = (id, val) => undoable(update, val ? "Archived batch" : "Restored batch")(d => {
    const h = d.hobbies.find(x => x.id === hobby.id);
    const b = h && (h.batches || []).find(x => x.id === id);
    if (b) b.archived = val;
    return d;
  });
  const addSale = (sale) => undoable(update, "Saved sale")(d => {
    d.sales = d.sales || [];
    if (!sale.buyerId && sale.buyer) {
      d.customers = d.customers || [];
      let c = d.customers.find(x => (x.name || "").trim().toLowerCase() === sale.buyer.toLowerCase());
      if (!c) { c = { id: newId(), name: sale.buyer, note: "" }; d.customers.push(c); }
      sale.buyerId = c.id;
    }
    d.sales.push(sale);
    return d;
  });
  const addUse = (batchId, use) => undoable(update, "Saved")(d => {
    const h = d.hobbies.find(x => x.id === hobby.id);
    const b = h && (h.batches || []).find(x => x.id === batchId);
    if (b) { if (!Array.isArray(b.uses)) b.uses = []; b.uses.push(use); }
    return d;
  });

  const renderBatch = (b) => {
    const st = soapBatchStats(b, sales);
    const methodLabel = (METHODS.find(m => m.id === b.method) || {}).label || "";
    return (
      <div key={b.id} style={{ padding: "12px 14px", background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 10, opacity: b.archived ? 0.7 : 1 }}>
        <div onClick={() => setBatchModal({ open: true, batch: b })} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: palette.ink }}>{b.name}</div>
            <span style={{ fontSize: 11, fontWeight: 700, color: st.cured ? palette.leaf : palette.accent, flexShrink: 0 }}>
              {st.cured ? "✓ Cured" : `${st.daysLeft}d to cure`}
            </span>
          </div>
          <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 2 }}>
            {[methodLabel, `made ${fmtDate(b.madeDate)}`, b.expectedCureDate ? `ready ${fmtDate(b.expectedCureDate)}` : null].filter(Boolean).join(" · ")}
          </div>
          <div style={{ fontSize: 12, color: palette.ink, marginTop: 6 }}>
            <strong>{st.remaining}</strong> of {st.bars} left · {st.sold} sold · {st.used} used{st.gifted > 0 ? ` · ${st.gifted} gifted` : ""}
            {st.cost > 0 ? <span style={{ color: palette.inkSoft }}> · {fmtMoney(st.costPerBar)}/bar</span> : null}
          </div>
          {(b.ingredients || []).length > 0 && (
            <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4 }}>
              {(b.ingredients || []).map(i => i.name).join(", ")}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {!b.archived && st.remaining > 0 && <Btn small variant="accent" onClick={() => setMoveModal({ open: true, mode: "sell", batchId: b.id })}>💵 Sell</Btn>}
          {!b.archived && st.remaining > 0 && <Btn small variant="ghost" onClick={() => setMoveModal({ open: true, mode: "use", batchId: b.id })}>🧺 Use</Btn>}
          <Btn small variant="ghost" onClick={() => setArchived(b.id, !b.archived)}>{b.archived ? "Restore" : "Archive"}</Btn>
        </div>
      </div>
    );
  };

  if (nl) {
    const shortDate = (x) => (x ? fmtDate(x) : "");
    const row = (b) => {
      const st = soapBatchStats(b, sales);
      return {
        id: b.id, title: b.name || "Soap", left: st.remaining, unit: "bars", onOpen: () => setBatchModal({ open: true, batch: b }),
        sub: [`${st.remaining} of ${st.bars} bars`, b.madeDate ? `made ${shortDate(b.madeDate)}` : null, st.costPerBar ? `${fmtMoney(st.costPerBar)} a bar` : null].filter(Boolean).join(" · "),
        pct: !st.cured && b.madeDate && b.cureWeeks ? (1 - st.daysLeft / (b.cureWeeks * 7)) * 100 : null,
        badge: st.cured ? null : { tone: "ready", text: `Ready ${shortDate(b.expectedCureDate)}` },
        actions: st.remaining > 0 ? [{ label: "Sell", run: () => setMoveModal({ open: true, mode: "sell", batchId: b.id }) }, { label: "Use or gift", run: () => setMoveModal({ open: true, mode: "use", batchId: b.id }) }] : [{ label: "Archive", run: () => setArchived(b.id, true) }],
      };
    };
    const ctx = {
      key: "soap",
      summary: { big: readyBars, small: `bar${readyBars === 1 ? "" : "s"} ready to use or sell`, line: [curingBars ? `${curingBars} still curing` : null, yearRevenue ? `${fmtMoney(yearRevenue)} sold this year` : null].filter(Boolean).join(" · ") },
      newLabel: "Make a batch", onNew: () => setBatchModal({ open: true, batch: null }),
      goingTitle: "Curing", going: curing.map(row),
      shelfTitle: "Ready", shelfEmpty: "No cured bars yet.",
      shelf: active.filter((b) => soapBatchStats(b, sales).cured).map(row),
      past: archived.map((b) => ({ id: b.id, title: b.name || "Soap", sub: `${b.bars || 0} bars · made ${shortDate(b.madeDate)} · tap to restore`, onOpen: () => setArchived(b.id, false) })),
      pastTitle: "Archived batches",
      extras: [
        { key: "sell", label: "Sell bars", icon: NlDollar, run: () => setMoveModal({ open: true, mode: "sell", batchId: null }) },
        { key: "use", label: "Use or gift bars", icon: NlGift, run: () => setMoveModal({ open: true, mode: "use", batchId: null }) },
        { key: "expense", label: "Expense", sub: "Lye, oils, molds", icon: NlReceipt, run: () => setModal && setModal({ type: "addExpense", hobbyId: hobby.id }) },
        ...(Array.isArray(hobby.customLogs) ? hobby.customLogs : []).map((c) => ({ key: c.id, label: c.label, icon: NlNote, run: () => setModal && setModal({ type: "log", action: "custom", customLogId: c.id, hobbyIdOverride: hobby.id }) })),
        { key: "customlog", label: "Make a custom log button", icon: NlPlus, run: () => setModal && setModal({ type: "customLogPicker", hobbyId: hobby.id }) },
      ],
    };
    return (
      <div>
        {batchModal.open && <BatchModal batch={batchModal.batch} onSave={saveBatch} onDelete={deleteBatch} onClose={() => setBatchModal({ open: false, batch: null })} />}
        {moveModal.open && <MoveBarsModal mode={moveModal.mode} batches={batches} sales={sales} customers={data.customers || []} presetBatchId={moveModal.batchId} onSale={addSale} onUse={addUse} onClose={() => setMoveModal({ open: false, mode: "sell", batchId: null })} />}
        <PantryView tab={nl.tab} ctx={ctx} onOpenJournal={nl.onOpenJournal} onSeeAll={nl.onSeeAll} />
      </div>
    );
  }

  return (
    <div>
      {batchModal.open && <BatchModal batch={batchModal.batch} onSave={saveBatch} onDelete={deleteBatch} onClose={() => setBatchModal({ open: false, batch: null })} />}
      {moveModal.open && <MoveBarsModal mode={moveModal.mode} batches={batches} sales={sales} customers={data.customers || []} presetBatchId={moveModal.batchId} onSale={addSale} onUse={addUse} onClose={() => setMoveModal({ open: false, mode: "sell", batchId: null })} />}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Ready to use/sell" value={readyBars} sub="cured bars" accent={palette.leaf} />
        <StatCard label="Curing" value={curingBars} sub={`${curing.length} batch${curing.length === 1 ? "" : "es"}`} accent={palette.accent} />
        <StatCard label={`Sales ${year}`} value={fmtMoney(yearRevenue)} accent={palette.yolk} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 8, marginBottom: 18 }}>
        <Btn variant="accent" onClick={() => setBatchModal({ open: true, batch: null })} style={{ width: "100%" }}>🧼 New batch</Btn>
        <Btn small variant="ghost" onClick={() => setMoveModal({ open: true, mode: "sell", batchId: null })} style={{ width: "100%" }}>💵 Sell bars</Btn>
        <Btn small variant="ghost" onClick={() => setMoveModal({ open: true, mode: "use", batchId: null })} style={{ width: "100%" }}>🧺 Use bars</Btn>
        {setModal && <Btn small variant="ghost" onClick={() => setModal({ type: "addExpense", hobbyId: hobby.id })} style={{ width: "100%" }}>💵 Add Expense</Btn>}
        {setModal && (Array.isArray(hobby.customLogs) ? hobby.customLogs : []).map(c => (
          <Btn key={c.id} small variant="ghost" onClick={() => setModal({ type: "log", action: "custom", customLogId: c.id, hobbyIdOverride: hobby.id })} style={{ width: "100%" }}>{c.emoji || "📝"} {c.label}</Btn>
        ))}
        {setModal && <Btn small variant="ghost" onClick={() => setModal({ type: "customLogPicker", hobbyId: hobby.id })} style={{ width: "100%" }}>➕ Custom</Btn>}
      </div>

      <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 18, margin: "0 0 10px", color: palette.ink }}>🧼 Batches</h3>
      {active.length === 0 ? (
        <div style={{ background: palette.card, border: `1.5px dashed ${palette.line}`, borderRadius: 12, padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🧼</div>
          <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 12 }}>Log your first batch — ingredients, when you made it, and how long it cures.</div>
          <Btn variant="accent" onClick={() => setBatchModal({ open: true, batch: null })}>+ New batch</Btn>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {active.slice().sort((a, b) => (b.madeDate || "").localeCompare(a.madeDate || "")).map(renderBatch)}
        </div>
      )}
      {archived.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", color: palette.inkSoft, fontSize: 13, padding: 6 }}>Archived batches ({archived.length})</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>{archived.map(renderBatch)}</div>
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analytics — filters by batch madeDate and sale date within dateRange.
// ---------------------------------------------------------------------------
// 3.0 Stats: bars made, sold, used, revenue, by batch.
export function soapStats(hobby, data, range = "year") {
  const year = String(new Date().getFullYear());
  const inR = (d) => range === "all" || String(d || "").startsWith(year);
  const sales = data.sales || [];
  const bs = (hobby && Array.isArray(hobby.batches) ? hobby.batches : []).filter((b) => inR(b.madeDate));
  const st = bs.map((b) => ({ b, s: soapBatchStats(b, sales) }));
  const bars = st.reduce((t, x) => t + x.s.bars, 0);
  const sold = st.reduce((t, x) => t + x.s.sold, 0);
  const revenue = sales.filter((x) => x && x.hobbyType === "soap" && inR(x.date)).reduce((t, x) => t + (Number(x.totalRevenue) || 0), 0);
  const cost = st.reduce((t, x) => t + x.s.cost, 0);
  const gifted = st.reduce((t, x) => t + x.s.gifted, 0);
  const rows = st.map(({ b, s }) => ({ key: b.id, name: b.name || "Soap", value: s.bars, label: `${s.bars} bars` })).sort((a, b) => b.value - a.value).slice(0, 8);
  const facts = [];
  if (bars >= 10) facts.push({ key: "bars", icon: "spark", big: String(bars), line: "bars of soap made by hand", title: `${bars} bars of soap`, sub: `That's about ${Math.round(bars * 30)} showers.` });
  if (gifted >= 3) facts.push({ key: "gifts", icon: "spark", big: String(gifted), line: "bars given as gifts", title: `${gifted} bars given away`, sub: "Lucky friends." });
  return {
    cards: [
      { label: "Bars made", value: bars, sub: `${bs.length} batch${bs.length === 1 ? "" : "es"}` },
      { label: "Sold", value: revenue ? fmtMoney(revenue) : sold, sub: `${sold} bars` },
      ...(cost ? [{ label: "Ingredients", value: fmtMoney(cost), sub: bars ? `${fmtMoney((cost / bars))} a bar` : "" }] : []),
    ],
    bars: rows.length ? { title: "Your batches", right: range === "all" ? "All time" : year, rows } : null,
    facts, emoji: "🧼", kicker: "Our soap",
  };
}

export function SoapMakingAnalytics({ hobby, sales = [], dateRange = null }) {
  if (!hobby) return null;
  const inRange = (d) => {
    if (!dateRange || (!dateRange.start && !dateRange.end)) return true;
    if (!d) return false;
    if (dateRange.start && d < dateRange.start) return false;
    if (dateRange.end && d > dateRange.end) return false;
    return true;
  };
  const batches = (hobby.batches || []).filter(b => inRange(b.madeDate));
  const soapSales = (sales || []).filter(s => s.hobbyType === "soap" && inRange(s.date));
  if (batches.length === 0 && soapSales.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", color: palette.inkSoft }}>No soap batches in this view yet.</div>;
  }
  const barsMade = batches.reduce((s, b) => s + (Number(b.bars) || 0), 0);
  const ingredientCost = batches.reduce((s, b) => s + soapBatchStats(b, sales).cost, 0);
  const barsSold = soapSales.reduce((s, x) => s + (Number(x.qty) || 0), 0);
  const revenue = soapSales.reduce((s, x) => s + (Number(x.totalRevenue) || 0), 0);
  const costOfSold = soapSales.reduce((s, x) => s + (Number(x.totalCost) || 0), 0);
  const allUses = (hobby.batches || []).flatMap(b => b.uses || []).filter(u => inRange(u.date));
  const barsUsed = allUses.filter(u => u.kind !== "gifted").reduce((s, u) => s + (Number(u.qty) || 0), 0);
  const barsGifted = allUses.filter(u => u.kind === "gifted").reduce((s, u) => s + (Number(u.qty) || 0), 0);

  const byRecipe = {};
  soapSales.forEach(s => { byRecipe[s.crop || "Other"] = (byRecipe[s.crop || "Other"] || 0) + (Number(s.qty) || 0); });
  const ingCount = {};
  batches.forEach(b => (b.ingredients || []).forEach(i => { const k = i.name.toLowerCase(); ingCount[k] = ingCount[k] || { name: i.name, cost: 0, batches: 0 }; ingCount[k].cost += Number(i.cost) || 0; ingCount[k].batches += 1; }));
  const line = { display: "flex", justifyContent: "space-between", padding: "8px 10px", background: palette.bgAlt, borderRadius: 6, fontSize: 13, marginBottom: 6 };
  const box = { background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, marginBottom: 12 };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Batches" value={batches.length} accent={palette.feather} />
        <StatCard label="Bars made" value={barsMade} sub={barsMade > 0 && ingredientCost > 0 ? `${fmtMoney(ingredientCost / barsMade)}/bar` : null} accent={palette.leaf} />
        <StatCard label="Bars sold" value={barsSold} sub={revenue > 0 ? fmtMoney(revenue) : null} accent={palette.yolk} />
        <StatCard label="Used / gifted" value={barsUsed + barsGifted} sub={barsGifted > 0 ? `${barsGifted} gifted` : null} accent={palette.accent} />
        {revenue > 0 && <StatCard label="Profit on sold bars" value={fmtMoney(revenue - costOfSold)} accent={revenue - costOfSold >= 0 ? palette.leaf : palette.accent} />}
      </div>
      {Object.keys(byRecipe).length > 0 && (
        <div style={box}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, marginBottom: 10, color: palette.ink }}>🏆 Best sellers</div>
          {Object.entries(byRecipe).sort((a, b) => b[1] - a[1]).map(([r, q]) => <div key={r} style={line}><span>{r}</span><strong>{q} bars</strong></div>)}
        </div>
      )}
      {Object.keys(ingCount).length > 0 && (
        <div style={box}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, marginBottom: 10, color: palette.ink }}>🫒 Ingredients</div>
          {Object.values(ingCount).sort((a, b) => b.cost - a.cost).map(i => <div key={i.name} style={line}><span>{i.name} <span style={{ color: palette.inkSoft, fontSize: 11 }}>· {i.batches} batch{i.batches === 1 ? "" : "es"}</span></span><strong>{fmtMoney(i.cost)}</strong></div>)}
        </div>
      )}
    </div>
  );
}
