// ============================================================================
// OIL INFUSION PAGE
// ----------------------------------------------------------------------------
// Tracks herb-in-oil infusions used as base for salves, balms, or as
// stand-alone infused oils. Staged lifecycle:
//   started → infusing → ready (post-strain) → bottled → optionally sold.
//
// Differs from tinctures in:
//   - "Carrier oil" instead of menstruum (olive, jojoba, coconut, sweet
//     almond, sunflower, etc.)
//   - Method: cold (long sun infusion 4-6 weeks) vs heat (double boiler,
//     hours) vs warm (slow cooker 12-24h)
//   - Yield in fl oz of finished oil rather than tincture bottles
//   - Bottles typically larger (2-16oz)
//
// Data shape mirrors Tincture batches with these differences:
//   hobby.batches[] = [{
//     id, name, herb, carrierOil, method, startDate, jarsStarted,
//     status, readyDate, strainNotes,
//     bottledDate, bottlesMade, bottlesRemaining, totalYieldOz, bottleSize,
//     ingredientsCost, notes,
//     events: [{ id, kind, date, note }],
//     archived
//   }]
//   data.sales[] (hobbyType="oil_infusion", batchId=...)
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
const daysSince = (iso) => {
  if (!iso) return null;
  const ms = Date.now() - parseIso(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};
const addDaysIso = (iso, days) => {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

// Carrier oils — most common in herbal infusions. "Other" reveals free text.
const CARRIER_OILS = [
  "Olive oil",
  "Sweet almond oil",
  "Jojoba oil",
  "Coconut oil (fractionated)",
  "Coconut oil (solid)",
  "Sunflower oil",
  "Grapeseed oil",
  "Avocado oil",
  "Castor oil",
  "Hemp seed oil",
  "Argan oil",
  "Other",
];

// Method — drives the recommended steep time hint.
// - cold (solar): herb + oil in jar, 4-6 weeks in sun/warm spot
// - warm: slow cooker on low, 8-24 hours
// - heat (double boiler): herb + oil over simmering water, 1-4 hours
const METHODS = [
  { id: "cold",  label: "Cold / solar (4-6 weeks)",       defaultDays: 28 },
  { id: "warm",  label: "Warm / slow cooker (8-24 hrs)",   defaultDays: 1 },
  { id: "heat",  label: "Heat / double boiler (1-4 hrs)",  defaultDays: 1 },
  { id: "crock", label: "Crockpot low (12-48 hrs)",        defaultDays: 2 },
];

const BOTTLE_SIZES = [
  { value: "1oz",  label: "1 oz" },
  { value: "2oz",  label: "2 oz" },
  { value: "4oz",  label: "4 oz" },
  { value: "8oz",  label: "8 oz" },
  { value: "16oz", label: "16 oz" },
  { value: "32oz", label: "32 oz (quart)" },
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
  const [herb, setHerb] = useState(batch?.herb || "");
  const [carrierOil, setCarrierOil] = useState(batch?.carrierOil || "Olive oil");
  const [carrierCustom, setCarrierCustom] = useState(
    batch?.carrierOil && !CARRIER_OILS.includes(batch.carrierOil) ? batch.carrierOil : ""
  );
  const [method, setMethod] = useState(batch?.method || "cold");
  const [startDate, setStartDate] = useState(batch?.startDate || todayIso());
  const [jarsStarted, setJarsStarted] = useState(batch?.jarsStarted ? String(batch.jarsStarted) : "1");
  const [ingredientsCost, setIngredientsCost] = useState(batch?.ingredientsCost ? String(batch.ingredientsCost) : "");
  const [notes, setNotes] = useState(batch?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // If user picks "Other", carrierCustom is what's actually saved.
  // Anything else, the dropdown value wins.
  const carrierForSave = carrierOil === "Other" ? carrierCustom.trim() : carrierOil;

  const save = () => {
    if (!herb.trim()) return;
    const id = batch?.id || newId();
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      if (!Array.isArray(h.batches)) h.batches = [];
      const data = {
        id,
        name: name.trim() || `${herb.trim()} in ${carrierForSave || "oil"}`,
        herb: herb.trim(),
        carrierOil: carrierForSave,
        method,
        startDate,
        jarsStarted: Number(jarsStarted) || 1,
        ingredientsCost: Number(ingredientsCost) || 0,
        notes: notes.trim(),
        status: batch?.status || "infusing",
        readyDate: batch?.readyDate || "",
        strainNotes: batch?.strainNotes || "",
        bottledDate: batch?.bottledDate || "",
        bottlesMade: batch?.bottlesMade || 0,
        bottlesRemaining: batch?.bottlesRemaining != null ? batch.bottlesRemaining : (batch?.bottlesMade || 0),
        totalYieldOz: batch?.totalYieldOz || 0,
        bottleSize: batch?.bottleSize || "4oz",
        events: batch?.events || [{ id: newId(), kind: "started", date: startDate, note: "" }],
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
      // Strip sales tied to this batch (they'd be orphaned)
      if (Array.isArray(d.sales)) d.sales = d.sales.filter(s => s.batchId !== batch.id);
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit oil infusion" : "Start an oil infusion"}>
      <Field label="Herb / botanical">
        <input style={inputStyle} value={herb} onChange={e => setHerb(e.target.value)} placeholder="e.g. Calendula, St. John's wort, Plantain" autoFocus />
      </Field>
      <Field label="Batch name (optional)">
        <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder={herb ? `${herb} in ${carrierForSave || "oil"}` : "e.g. Summer Calendula"} />
      </Field>
      <Field label="Carrier oil">
        <select style={inputStyle} value={carrierOil} onChange={e => setCarrierOil(e.target.value)}>
          {CARRIER_OILS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        {carrierOil === "Other" && (
          <input style={{ ...inputStyle, marginTop: 8 }} value={carrierCustom} onChange={e => setCarrierCustom(e.target.value)} placeholder="e.g. Tamanu, Argan, etc." />
        )}
      </Field>
      <Field label="Method">
        <select style={inputStyle} value={method} onChange={e => setMethod(e.target.value)}>
          {METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Start date">
            <input type="date" style={inputStyle} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Jars (optional)">
            <input type="number" min={1} step="1" inputMode="numeric" style={inputStyle} value={jarsStarted} onChange={e => setJarsStarted(e.target.value)} placeholder="1" />
          </Field>
        </div>
      </div>
      <Field label="Ingredient cost (optional)">
        <input type="number" min={0} step="0.01" inputMode="decimal" style={inputStyle} value={ingredientsCost} onChange={e => setIngredientsCost(e.target.value)} placeholder="$0.00" />
      </Field>
      <Field label="Notes (optional)">
        <textarea
          style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
          value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Where the herb came from, intended use (salve base, massage oil, etc.)"
        />
      </Field>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
        <Btn onClick={save}>{isEdit ? "Save changes" : "Start batch"}</Btn>
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
// STRAIN MODAL — move from "infusing" to "ready"
// ============================================================================
function StrainModal({ batch, hobbyId, update, onClose }) {
  const [strainDate, setStrainDate] = useState(batch.readyDate || todayIso());
  const [strainNotes, setStrainNotes] = useState(batch.strainNotes || "");

  const save = () => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      const b = (h.batches || []).find(x => x.id === batch.id);
      if (b) {
        b.readyDate = strainDate;
        b.strainNotes = strainNotes.trim();
        b.status = "ready";
        b.events = b.events || [];
        b.events.push({ id: newId(), kind: "strained", date: strainDate, note: strainNotes.trim() });
      }
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Strain — ${batch.name}`}>
      <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Press the oil out of the herb. Cheesecloth, nut milk bag, or a press all work — get as much liquid as you can.
      </div>
      <Field label="Strain date">
        <input type="date" style={inputStyle} value={strainDate} onChange={e => setStrainDate(e.target.value)} />
      </Field>
      <Field label="Notes (optional)">
        <textarea
          style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
          value={strainNotes} onChange={e => setStrainNotes(e.target.value)}
          placeholder="Color, aroma, how much oil you recovered, etc."
        />
      </Field>
      <Btn onClick={save}>Mark as strained</Btn>
    </Modal>
  );
}

// ============================================================================
// BOTTLE MODAL — record finished bottles + yield
// ============================================================================
function BottleModal({ batch, hobbyId, update, onClose }) {
  const [bottledDate, setBottledDate] = useState(batch.bottledDate || todayIso());
  const [bottlesMade, setBottlesMade] = useState(batch.bottlesMade ? String(batch.bottlesMade) : "");
  const [bottleSize, setBottleSize] = useState(batch.bottleSize || "4oz");
  const [totalYieldOz, setTotalYieldOz] = useState(batch.totalYieldOz ? String(batch.totalYieldOz) : "");

  const save = () => {
    const made = Number(bottlesMade) || 0;
    if (made < 1) return;
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      const b = (h.batches || []).find(x => x.id === batch.id);
      if (b) {
        b.bottledDate = bottledDate;
        b.bottlesMade = made;
        b.bottlesRemaining = made;
        b.bottleSize = bottleSize;
        b.totalYieldOz = Number(totalYieldOz) || 0;
        b.status = "bottled";
        b.events = b.events || [];
        b.events.push({ id: newId(), kind: "bottled", date: bottledDate, note: `${made} × ${bottleSize}` });
      }
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Bottle — ${batch.name}`}>
      <Field label="Bottled date">
        <input type="date" style={inputStyle} value={bottledDate} onChange={e => setBottledDate(e.target.value)} />
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Bottles made">
            <input type="number" min={1} step="1" inputMode="numeric" style={inputStyle} value={bottlesMade} onChange={e => setBottlesMade(e.target.value)} placeholder="0" autoFocus />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Bottle size">
            <select style={inputStyle} value={bottleSize} onChange={e => setBottleSize(e.target.value)}>
              {BOTTLE_SIZES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </Field>
        </div>
      </div>
      <Field label="Total yield in fl oz (optional)">
        <input type="number" min={0} step="0.1" inputMode="decimal" style={inputStyle} value={totalYieldOz} onChange={e => setTotalYieldOz(e.target.value)} placeholder="e.g. 16" />
        <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4, lineHeight: 1.4 }}>
          For analytics. Helps track recovery rate per batch.
        </div>
      </Field>
      <Btn onClick={save} disabled={!bottlesMade || Number(bottlesMade) < 1}>Mark as bottled</Btn>
    </Modal>
  );
}

// ============================================================================
// SELL MODAL — creates data.sales row with hobbyType="oil_infusion"
// ============================================================================
function SellModal({ batch, hobbyId, update, onClose }) {
  const [date, setDate] = useState(todayIso());
  const [count, setCount] = useState("1");
  const [pricePerBottle, setPricePerBottle] = useState("");
  const [buyer, setBuyer] = useState("");
  const [saleNotes, setSaleNotes] = useState("");
  const max = Number(batch.bottlesRemaining) || 0;

  const total = (Number(count) || 0) * (Number(pricePerBottle) || 0);

  const save = () => {
    const n = Number(count);
    if (!n || n < 1 || n > max) return;
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      const b = (h.batches || []).find(x => x.id === batch.id);
      if (b) {
        b.bottlesRemaining = Math.max(0, (b.bottlesRemaining || 0) - n);
        b.events = b.events || [];
        b.events.push({ id: newId(), kind: "sold", date, note: `${n} × ${batch.bottleSize}${buyer.trim() ? ` to ${buyer.trim()}` : ""}` });
      }
      d.sales = d.sales || [];
      d.sales.push({
        id: newId(),
        date,
        hobbyType: "oil_infusion",
        hobbyId,
        batchId: batch.id,
        crop: batch.name,
        gardenUnit: batch.bottleSize,
        qty: n,
        pricePerUnit: Number(pricePerBottle) || 0,
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
          No bottles remaining in this batch. {batch.bottlesMade > 0 ? "Looks like everything has been sold already." : "Bottle the batch first."}
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
        {max} {batch.bottleSize} bottle{max === 1 ? "" : "s"} remaining
      </div>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label={`Bottles (max ${max})`}>
            <input type="number" min={1} max={max} step="1" inputMode="numeric" style={inputStyle} value={count} onChange={e => setCount(e.target.value)} placeholder="1" autoFocus />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Price per bottle">
            <input type="number" min={0} step="0.01" inputMode="decimal" style={inputStyle} value={pricePerBottle} onChange={e => setPricePerBottle(e.target.value)} placeholder="$0.00" />
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
  const days = daysSince(batch.startDate);
  const methodObj = METHODS.find(m => m.id === batch.method) || METHODS[0];
  const minRecommended = methodObj.defaultDays;
  const readyByDate = addDaysIso(batch.startDate, minRecommended);

  const batchSales = (sales || []).filter(s => s.batchId === batch.id);
  const revenue = batchSales.reduce((s, x) => s + (Number(x.totalRevenue) || 0), 0);

  const stageColor = batch.status === "infusing" ? palette.feather
    : batch.status === "ready" ? palette.yolk
    : batch.status === "bottled" ? palette.leaf
    : palette.inkSoft;
  const stageLabel = batch.status === "infusing" ? `Infusing · day ${days}`
    : batch.status === "ready" ? "Ready to bottle"
    : batch.status === "bottled" ? "Bottled"
    : "Archived";

  return (
    <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18 }}>🫒</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: palette.ink }}>{batch.name}</span>
            <span style={{ fontSize: 11, background: stageColor + "30", color: stageColor, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>{stageLabel}</span>
          </div>
          <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 3 }}>
            {batch.herb} · {batch.carrierOil} · {methodObj.label.split(" (")[0]}
          </div>
          <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 2 }}>
            Started {fmtDate(batch.startDate)}{batch.jarsStarted > 1 ? ` · ${batch.jarsStarted} jars` : ""}
          </div>
        </div>
        <button onClick={() => setLocalModal({ type: "editBatch", batchId: batch.id })} style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, padding: 4 }}><Edit3 size={14} /></button>
      </div>

      {batch.status === "infusing" && (
        <div style={{ background: palette.bgAlt, borderRadius: 8, padding: "10px 12px", marginBottom: 10, fontSize: 12, color: palette.ink, lineHeight: 1.4 }}>
          {days < minRecommended ? (
            <>
              Ready to strain around <strong>{fmtDate(readyByDate)}</strong>
              <span style={{ color: palette.inkSoft }}> ({minRecommended - days} days to go)</span>
            </>
          ) : (
            <span style={{ color: palette.leaf }}>
              ✓ Infused {days} {days === 1 ? "day" : "days"} — long enough to strain.
            </span>
          )}
        </div>
      )}
      {batch.status === "ready" && (
        <div style={{ background: palette.yolkSoft, borderRadius: 8, padding: "10px 12px", marginBottom: 10, fontSize: 12, color: palette.ink, lineHeight: 1.4 }}>
          Strained {fmtDate(batch.readyDate)}.
          {batch.strainNotes && <> <span style={{ color: palette.inkSoft }}>{batch.strainNotes}</span></>}
        </div>
      )}
      {batch.status === "bottled" && (
        <div style={{ background: palette.bgAlt, borderRadius: 8, padding: "10px 12px", marginBottom: 10, fontSize: 12, color: palette.ink, lineHeight: 1.4 }}>
          <div>
            <strong>{batch.bottlesMade}</strong> × {batch.bottleSize} bottled {fmtDate(batch.bottledDate)}
            {batch.bottlesRemaining < batch.bottlesMade && (
              <span style={{ color: palette.inkSoft }}> · {batch.bottlesRemaining} remaining</span>
            )}
          </div>
          {batch.totalYieldOz > 0 && (
            <div style={{ color: palette.inkSoft, marginTop: 4 }}>Total yield: {batch.totalYieldOz} fl oz</div>
          )}
          {revenue > 0 && (
            <div style={{ color: palette.leaf, fontWeight: 600, marginTop: 4 }}>Revenue: {fmtMoney(revenue)}</div>
          )}
        </div>
      )}
      {batch.notes && (
        <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 10, fontStyle: "italic", lineHeight: 1.4 }}>
          {batch.notes}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {batch.status === "infusing" && (
          <Btn small variant="accent" onClick={() => setLocalModal({ type: "strain", batchId: batch.id })}>
            🫗 Strain
          </Btn>
        )}
        {batch.status === "ready" && (
          <Btn small variant="accent" onClick={() => setLocalModal({ type: "bottle", batchId: batch.id })}>
            🧪 Bottle
          </Btn>
        )}
        {batch.status === "bottled" && batch.bottlesRemaining > 0 && (
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
function OilModalRouter({ modal, hobby, update, onClose }) {
  if (!modal) return null;
  if (modal.type === "addBatch") return <BatchModal hobbyId={hobby.id} update={update} onClose={onClose} />;
  if (modal.type === "editBatch") {
    const batch = (hobby.batches || []).find(b => b.id === modal.batchId);
    if (!batch) { onClose(); return null; }
    return <BatchModal batch={batch} hobbyId={hobby.id} update={update} onClose={onClose} />;
  }
  if (modal.type === "strain") {
    const batch = (hobby.batches || []).find(b => b.id === modal.batchId);
    if (!batch) { onClose(); return null; }
    return <StrainModal batch={batch} hobbyId={hobby.id} update={update} onClose={onClose} />;
  }
  if (modal.type === "bottle") {
    const batch = (hobby.batches || []).find(b => b.id === modal.batchId);
    if (!batch) { onClose(); return null; }
    return <BottleModal batch={batch} hobbyId={hobby.id} update={update} onClose={onClose} />;
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
export default function OilInfusionPage({ hobby, data, update }) {
  const [localModal, setLocalModal] = useState(null);
  const batches = hobby.batches || [];
  const active = batches.filter(b => !b.archived);
  const sales = (data.sales || []).filter(s => s.hobbyType === "oil_infusion");

  const infusing = active.filter(b => b.status === "infusing");
  const ready = active.filter(b => b.status === "ready");
  const bottled = active.filter(b => b.status === "bottled");

  return (
    <div>
      <OilModalRouter modal={localModal} hobby={hobby} update={update} onClose={() => setLocalModal(null)} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink }}>Your oil infusions</div>
        <button onClick={() => setLocalModal({ type: "addBatch" })} style={{ padding: "7px 14px", borderRadius: 8, background: palette.yolk, border: `1.5px solid ${palette.ink}`, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13, cursor: "pointer", color: palette.ink, display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} />New batch
        </button>
      </div>

      {batches.length === 0 ? (
        <div style={{ padding: 28, background: palette.card, border: `2px dashed ${palette.line}`, borderRadius: 12, textAlign: "center", color: palette.inkSoft }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🫒</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink, marginBottom: 6 }}>No oil infusions yet</div>
          <div style={{ fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
            Start a batch — pick your herb, carrier oil, and method, then follow it through to bottled.
          </div>
          <button onClick={() => setLocalModal({ type: "addBatch" })} style={{ padding: "10px 18px", borderRadius: 8, background: palette.yolk, border: `1.5px solid ${palette.ink}`, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14, cursor: "pointer", color: palette.ink }}>Start first batch</button>
        </div>
      ) : (
        <>
          {infusing.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>Infusing ({infusing.length})</div>
              {infusing.map(b => <BatchCard key={b.id} batch={b} hobbyId={hobby.id} sales={sales} update={update} setLocalModal={setLocalModal} />)}
            </div>
          )}
          {ready.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>Ready to bottle ({ready.length})</div>
              {ready.map(b => <BatchCard key={b.id} batch={b} hobbyId={hobby.id} sales={sales} update={update} setLocalModal={setLocalModal} />)}
            </div>
          )}
          {bottled.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>Bottled ({bottled.length})</div>
              {bottled.map(b => <BatchCard key={b.id} batch={b} hobbyId={hobby.id} sales={sales} update={update} setLocalModal={setLocalModal} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// ANALYTICS
// ============================================================================
export function OilInfusionAnalytics({ hobby, entries, /* ADV_ANALYTICS */ earlyAccessConfig = null, isSupporter = false }) {
  const batches = hobby.batches || [];
  const totalBatches = batches.length;
  const infusingCount = batches.filter(b => b.status === "infusing").length;
  const bottledCount = batches.filter(b => b.status === "bottled").length;
  const totalBottlesMade = batches.reduce((s, b) => s + (Number(b.bottlesMade) || 0), 0);
  const totalYieldOz = batches.reduce((s, b) => s + (Number(b.totalYieldOz) || 0), 0);
  const totalCost = batches.reduce((s, b) => s + (Number(b.ingredientsCost) || 0), 0);

  const byHerb = {};
  batches.forEach(b => {
    if (!b.herb) return;
    if (!byHerb[b.herb]) byHerb[b.herb] = { batches: 0, bottles: 0 };
    byHerb[b.herb].batches += 1;
    byHerb[b.herb].bottles += Number(b.bottlesMade) || 0;
  });
  const herbChart = Object.entries(byHerb)
    .sort((a, b) => b[1].batches - a[1].batches)
    .slice(0, 8)
    .map(([herb, stats]) => ({ name: herb.length > 12 ? herb.slice(0, 12) + "…" : herb, batches: stats.batches }));

  // ── ADV_ANALYTICS ── bottles made by month line + best bottling month.
  const bottlesMonthlyRaw = monthlySeries(batches, b => b.startDate, b => Number(b.bottlesMade) || 0);
  const bottlesMonthly = bottlesMonthlyRaw.map(p => ({
    month: p.month, bottles: p.value,
    label: (() => { const pr = String(p.month).split("-").map(Number); const d = new Date(pr[0], pr[1] - 1, 1); return isNaN(d) ? p.month : d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }); })(),
  }));
  const bottlesRecord = personalRecord(bottlesMonthlyRaw);
  const pFonts = { body: FONT_BODY, display: FONT_DISPLAY };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Total batches" value={totalBatches} accent={palette.leaf} />
        <StatCard label="Currently infusing" value={infusingCount} accent={palette.feather} />
        <StatCard label="Bottles made" value={totalBottlesMade} accent={palette.yolk} />
        <StatCard label="Ingredients spent" value={totalCost > 0 ? fmtMoney(totalCost) : "—"} accent={palette.accent} />
        {totalYieldOz > 0 && <StatCard label="Total yield" value={`${totalYieldOz.toFixed(1)} oz`} accent={palette.ink} />}
      </div>

      {bottlesMonthlyRaw.length > 0 && (
        <LockedStatOverlay earlyAccessConfig={earlyAccessConfig} isSupporter={isSupporter} palette={palette} fonts={pFonts}>
          <div>
            {bottlesRecord && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                <StatCard label="Best bottling month" value={`${bottlesRecord.value} bottles`} sub={bottlesRecord.label} accent={palette.leaf} />
              </div>
            )}
            {bottlesMonthly.length > 1 && (
              <ChartCard title="🫒 Bottles made by month">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={bottlesMonthly}>
                    <XAxis dataKey="label" stroke={palette.inkSoft} fontSize={11} />
                    <YAxis stroke={palette.inkSoft} fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: palette.card, border: `1.5px solid ${palette.ink}`, borderRadius: 8 }} formatter={v => [`${v} bottles`, "Made"]} />
                    <Line type="monotone" dataKey="bottles" stroke={palette.leaf} strokeWidth={3} dot={{ fill: palette.accent, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>
        </LockedStatOverlay>
      )}

      {herbChart.length > 1 && (
        <ChartCard title="🫒 Batches by herb">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={herbChart}>
              <XAxis dataKey="name" stroke={palette.inkSoft} fontSize={11} />
              <YAxis stroke={palette.inkSoft} fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: palette.card, border: `1.5px solid ${palette.ink}`, borderRadius: 8 }} />
              <Bar dataKey="batches" fill={palette.leaf} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {batches.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: palette.inkSoft, fontSize: 13, lineHeight: 1.5 }}>
          No data yet. Start a batch to see analytics here.
        </div>
      )}
    </div>
  );
}
