// ============================================================================
// BAKING PAGE
// ----------------------------------------------------------------------------
// Simple baking tracker: save recipes (with optional URLs) and log bakes.
// Sales of baked goods flow into data.sales[] with hobbyType="baking" so they
// appear in the Sales tab and analytics. Modeled loosely on Farmstand but
// stripped down — no inventory, no presets, just recipes + bakes + sales.
//
// Data shape:
//   hobby.recipes[]  = [{ id, name, type, link, notes, archived }]
//   data.entries["baking"] = [{ id, date, recipeName, recipeId, qty, unit, cost, rating, note }]
//
// Sales are NOT stored on the bake entry — they're created separately via the
// "Sell" action, which writes to data.sales[] with hobbyType="baking".
// ============================================================================

import React, { useState, useMemo } from "react";
import { X, Edit3, Plus, ExternalLink, Star } from "lucide-react";
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

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
};

const RECIPE_TYPES = [
  { id: "bread", label: "🍞 Bread", unit: "loaves" },
  { id: "cookies", label: "🍪 Cookies", unit: "dozen" },
  { id: "pie", label: "🥧 Pie", unit: "pies" },
  { id: "cake", label: "🍰 Cake", unit: "cakes" },
  { id: "muffins", label: "🧁 Muffins", unit: "dozen" },
  { id: "other", label: "🍽 Other", unit: "items" },
];
const typeFor = (id) => RECIPE_TYPES.find(t => t.id === id) || RECIPE_TYPES[5];
const unitFor = (id) => typeFor(id).unit;

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

function StarRating({ value, onChange, readOnly = false }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={readOnly ? undefined : () => onChange(n === value ? 0 : n)}
          style={{
            background: "none", border: "none", padding: 2,
            cursor: readOnly ? "default" : "pointer",
            color: n <= value ? palette.yolk : palette.line,
          }}
        >
          <Star size={20} fill={n <= value ? palette.yolk : "none"} />
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// MODALS
// ============================================================================

function RecipeModal({ recipe, onSave, onDelete, onClose }) {
  const isEdit = !!recipe;
  const [name, setName] = useState(recipe?.name || "");
  const [type, setType] = useState(recipe?.type || "bread");
  const [link, setLink] = useState(recipe?.link || "");
  const [notes, setNotes] = useState(recipe?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: recipe?.id || newId(),
      name: name.trim(),
      type,
      link: link.trim(),
      notes: notes.trim(),
      archived: recipe?.archived || false,
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit recipe" : "Add recipe"}>
      <Field label="Recipe name">
        <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mom's banana bread" autoFocus />
      </Field>
      <Field label="Type">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {RECIPE_TYPES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              style={{
                padding: "8px 12px", borderRadius: 8,
                border: `1.5px solid ${type === t.id ? palette.ink : palette.line}`,
                background: type === t.id ? palette.ink : palette.card,
                color: type === t.id ? palette.bg : palette.ink,
                fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Link (optional)">
        <input style={inputStyle} value={link} onChange={e => setLink(e.target.value)} placeholder="https://... or paste a URL" />
      </Field>
      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ingredients, method, tweaks..." />
      </Field>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Btn variant="primary" onClick={handleSave} disabled={!name.trim()} style={{ flex: 1 }}>
          {isEdit ? "Save" : "Add recipe"}
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
              Delete recipe
            </button>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: palette.ink, marginBottom: 8 }}>Delete this recipe? Bakes already logged will keep the recipe name.</div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="danger" small onClick={() => { onDelete(recipe.id); onClose(); }}>Yes, delete</Btn>
                <Btn variant="ghost" small onClick={() => setConfirmDelete(false)}>Keep</Btn>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function LogBakeModal({ recipes, presetRecipeId, onSave, onClose }) {
  const [date, setDate] = useState(todayIso());
  const [recipeId, setRecipeId] = useState(presetRecipeId || "");
  const [customName, setCustomName] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");

  const activeRecipes = recipes.filter(r => !r.archived);
  const selectedRecipe = activeRecipes.find(r => r.id === recipeId);
  const usingCustom = recipeId === "__custom";
  const effectiveName = usingCustom ? customName.trim() : selectedRecipe?.name || "";
  const effectiveUnit = selectedRecipe ? unitFor(selectedRecipe.type) : "items";

  const handleSave = () => {
    if (!effectiveName) return;
    const q = parseFloat(qty) || 0;
    if (q <= 0) return;
    onSave({
      id: newId(),
      date,
      recipeId: usingCustom ? null : recipeId,
      recipeName: effectiveName,
      recipeType: selectedRecipe?.type || "other",
      qty: q,
      unit: effectiveUnit,
      cost: parseFloat(cost) || 0,
      rating: rating || 0,
      note: note.trim(),
      created: Date.now(),
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Log a bake">
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <Field label="Recipe">
        <select style={inputStyle} value={recipeId} onChange={e => setRecipeId(e.target.value)}>
          <option value="">— pick a recipe —</option>
          {activeRecipes.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
          <option value="__custom">+ One-off (not saved)</option>
        </select>
      </Field>
      {usingCustom && (
        <Field label="One-off name">
          <input style={inputStyle} value={customName} onChange={e => setCustomName(e.target.value)} placeholder="What did you bake?" />
        </Field>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label={`Quantity (${effectiveUnit})`}>
            <input type="number" step="0.5" min="0" style={inputStyle} value={qty} onChange={e => setQty(e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Cost ($)">
            <input type="number" step="0.01" min="0" style={inputStyle} value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" />
          </Field>
        </div>
      </div>
      <Field label="Rating (optional)">
        <StarRating value={rating} onChange={setRating} />
      </Field>
      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={note} onChange={e => setNote(e.target.value)} placeholder="How did it turn out?" />
      </Field>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Btn variant="primary" onClick={handleSave} disabled={!effectiveName || !(parseFloat(qty) > 0)} style={{ flex: 1 }}>
          Log bake
        </Btn>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  );
}

function SellBakeModal({ bake, onSell, onClose }) {
  const [date, setDate] = useState(todayIso());
  const [qty, setQty] = useState(String(bake.qty || 1));
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [note, setNote] = useState("");

  const q = parseFloat(qty) || 0;
  const price = parseFloat(pricePerUnit) || 0;
  const revenue = q * price;
  const costPerUnit = bake.qty > 0 ? (Number(bake.cost) || 0) / bake.qty : 0;
  const cost = costPerUnit * q;
  const profit = revenue - cost;

  const handleSell = () => {
    if (q <= 0 || price <= 0) return;
    onSell({
      date,
      qty: q,
      pricePerUnit: price,
      costPerUnit,
      revenue,
      cost,
      note: note.trim(),
      bakeId: bake.id,
      recipeName: bake.recipeName,
      unit: bake.unit || "items",
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Sell ${bake.recipeName}`}>
      <Field label="Sale date">
        <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label={`Quantity (${bake.unit || "items"})`}>
            <input type="number" step="0.5" min="0" style={inputStyle} value={qty} onChange={e => setQty(e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Price per unit ($)">
            <input type="number" step="0.01" min="0" style={inputStyle} value={pricePerUnit} onChange={e => setPricePerUnit(e.target.value)} autoFocus />
          </Field>
        </div>
      </div>
      <Field label="Note (optional)">
        <input style={inputStyle} value={note} onChange={e => setNote(e.target.value)} placeholder="Buyer, occasion..." />
      </Field>
      <div style={{
        padding: 12, background: palette.yolkSoft, borderRadius: 8,
        marginBottom: 14, fontSize: 13, color: palette.ink, lineHeight: 1.6,
      }}>
        Revenue: <strong>{fmtMoney(revenue)}</strong> · Cost: {fmtMoney(cost)} · Profit: <strong>{fmtMoney(profit)}</strong>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="leaf" onClick={handleSell} disabled={q <= 0 || price <= 0} style={{ flex: 1 }}>
          Record sale
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
        <input style={inputStyle} value={item} onChange={e => setItem(e.target.value)} placeholder="e.g. stand mixer, new oven, baking sheets" autoFocus />
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

export default function BakingPage({ hobby, data, update, setModal }) {
  const [editRecipe, setEditRecipe] = useState(null); // recipe obj or "new"
  const [logBake, setLogBake] = useState(false);
  const [logBakeRecipeId, setLogBakeRecipeId] = useState("");
  const [sellingBake, setSellingBake] = useState(null);
  const [infraModal, setInfraModal] = useState({ open: false, entry: null });

  if (!hobby) return null;
  const recipes = Array.isArray(hobby.recipes) ? hobby.recipes : [];
  const bakes = data.entries?.["baking"] || [];
  const infraEntries = bakes.filter(e => e.action === "infrastructure");
  const recentInfra = infraEntries.slice().sort((a,b) => (b.date||"").localeCompare(a.date||"")).slice(0, 3);
  const activeRecipes = recipes.filter(r => !r.archived);

  const recentBakes = [...bakes].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.created || 0) - (a.created || 0)).slice(0, 12);

  const saveInfra = (entry) => {
    update(d => {
      if (!d.entries) d.entries = {};
      d.entries["baking"] = d.entries["baking"] || [];
      const idx = d.entries["baking"].findIndex(e => e.id === entry.id);
      if (idx >= 0) d.entries["baking"][idx] = entry;
      else d.entries["baking"].push(entry);
      return d;
    });
  };
  const deleteInfra = (id) => {
    update(d => {
      if (d.entries?.["baking"]) {
        d.entries["baking"] = d.entries["baking"].filter(e => e.id !== id);
      }
      return d;
    });
  };

  const saveRecipe = (rec) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.recipes)) h.recipes = [];
      const idx = h.recipes.findIndex(r => r.id === rec.id);
      if (idx >= 0) h.recipes[idx] = rec; else h.recipes.push(rec);
      return d;
    });
  };

  const deleteRecipe = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h && Array.isArray(h.recipes)) h.recipes = h.recipes.filter(r => r.id !== id);
      return d;
    });
  };

  const saveBake = (bake) => {
    update(d => {
      if (!d.entries) d.entries = {};
      if (!Array.isArray(d.entries["baking"])) d.entries["baking"] = [];
      d.entries["baking"].push(bake);
      return d;
    });
  };

  const deleteBake = (id) => {
    update(d => {
      if (d.entries?.["baking"]) {
        d.entries["baking"] = d.entries["baking"].filter(b => b.id !== id);
      }
      return d;
    });
  };

  const recordSale = (saleData) => {
    update(d => {
      if (!Array.isArray(d.sales)) d.sales = [];
      d.sales.push({
        id: newId(),
        date: saleData.date,
        hobbyType: "baking",
        crop: saleData.recipeName,
        gardenUnit: saleData.unit,
        qty: saleData.qty,
        unit: saleData.unit,
        pricePerUnit: saleData.pricePerUnit,
        costPerUnit: saleData.costPerUnit,
        totalRevenue: saleData.revenue,
        totalCost: saleData.cost,
        note: saleData.note || "",
        buyerId: null,
        created: Date.now(),
        fromBakeId: saleData.bakeId,
      });
      return d;
    });
  };

  return (
    <div>
      {/* Header actions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <Btn variant="primary" onClick={() => { setLogBakeRecipeId(""); setLogBake(true); }} style={{ flex: "1 1 140px" }}>
          + Log a bake
        </Btn>
        <Btn variant="ghost" onClick={() => setEditRecipe("new")} style={{ flex: "1 1 140px" }}>
          + Add recipe
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

      {/* Recipes section */}
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, margin: "12px 0 10px", color: palette.ink }}>Recipes</h2>
      {activeRecipes.length === 0 ? (
        <div style={{
          padding: 20, background: palette.card, border: `1.5px dashed ${palette.line}`,
          borderRadius: 10, textAlign: "center", color: palette.inkSoft, fontSize: 13, marginBottom: 16,
        }}>
          No recipes yet. Add your favorites to log bakes faster.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 16 }}>
          {activeRecipes.map(r => (
            <div key={r.id} style={{
              background: palette.card, border: `1.5px solid ${palette.line}`,
              borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 2 }}>{typeFor(r.type).label}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: palette.ink, wordBreak: "break-word" }}>{r.name}</div>
                </div>
                <button
                  onClick={() => setEditRecipe(r)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, padding: 4 }}
                  title="Edit recipe"
                >
                  <Edit3 size={16} />
                </button>
              </div>
              {r.notes && <div style={{ fontSize: 12, color: palette.inkSoft, lineHeight: 1.4 }}>{r.notes.length > 80 ? r.notes.slice(0, 80) + "…" : r.notes}</div>}
              <div style={{ display: "flex", gap: 6, marginTop: "auto", flexWrap: "wrap" }}>
                <Btn small variant="leaf" onClick={() => { setLogBakeRecipeId(r.id); setLogBake(true); }}>
                  Bake this
                </Btn>
                {r.link && (
                  <a
                    href={r.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "6px 10px", borderRadius: 8,
                      border: `1.5px solid ${palette.line}`, background: palette.bgAlt,
                      color: palette.ink, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 12,
                      textDecoration: "none",
                    }}
                  >
                    <ExternalLink size={12} /> Link
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent bakes */}
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, margin: "20px 0 10px", color: palette.ink }}>Recent bakes</h2>
      {recentBakes.length === 0 ? (
        <div style={{
          padding: 20, background: palette.card, border: `1.5px dashed ${palette.line}`,
          borderRadius: 10, textAlign: "center", color: palette.inkSoft, fontSize: 13,
        }}>
          No bakes logged yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recentBakes.map(b => (
            <div key={b.id} style={{
              background: palette.card, border: `1.5px solid ${palette.line}`,
              borderRadius: 10, padding: 12, display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: palette.ink }}>{b.recipeName}</div>
                  <div style={{ fontSize: 11, color: palette.inkSoft }}>{b.date}</div>
                </div>
                <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span>{b.qty} {b.unit || "items"}</span>
                  {b.cost > 0 && <span>· {fmtMoney(b.cost)}</span>}
                  {b.rating > 0 && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                      · <Star size={11} fill={palette.yolk} color={palette.yolk} /> {b.rating}/5
                    </span>
                  )}
                </div>
                {b.note && <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 4, fontStyle: "italic" }}>{b.note}</div>}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <Btn small variant="leaf" onClick={() => setSellingBake(b)}>Sell</Btn>
                <button
                  onClick={() => { if (window.confirm("Delete this bake entry?")) deleteBake(b.id); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: palette.accent, padding: 4 }}
                  title="Delete entry"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {editRecipe && (
        <RecipeModal
          recipe={editRecipe === "new" ? null : editRecipe}
          onSave={saveRecipe}
          onDelete={deleteRecipe}
          onClose={() => setEditRecipe(null)}
        />
      )}
      {logBake && (
        <LogBakeModal
          recipes={recipes}
          presetRecipeId={logBakeRecipeId}
          onSave={saveBake}
          onClose={() => { setLogBake(false); setLogBakeRecipeId(""); }}
        />
      )}
      {sellingBake && (
        <SellBakeModal
          bake={sellingBake}
          onSell={recordSale}
          onClose={() => setSellingBake(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// ANALYTICS
// ============================================================================

export function BakingAnalytics({ hobby, entries = [], sales = [], spouseMode = false }) {
  const bakingSales = useMemo(() => sales.filter(s => s.hobbyType === "baking"), [sales]);

  const totalBakes = entries.length;
  const totalCostRaw = entries.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const totalCost = spouseMode ? totalCostRaw * 0.1 : totalCostRaw;
  const totalRevenueRaw = bakingSales.reduce((s, x) => s + (Number(x.totalRevenue) || 0), 0);
  const totalRevenue = spouseMode ? totalRevenueRaw * 2 : totalRevenueRaw;
  const totalSalesCount = bakingSales.length;

  // By recipe count
  const byRecipe = {};
  entries.forEach(e => {
    const n = e.recipeName || "Unknown";
    byRecipe[n] = (byRecipe[n] || 0) + (Number(e.qty) || 0);
  });
  const topData = Object.entries(byRecipe)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name: name.length > 16 ? name.slice(0, 16) + "…" : name, value }));

  // Ratings avg
  const rated = entries.filter(e => e.rating > 0);
  const avgRating = rated.length > 0 ? (rated.reduce((s, e) => s + e.rating, 0) / rated.length).toFixed(1) : null;

  if (totalBakes === 0 && totalSalesCount === 0) {
    return (
      <div style={{
        padding: 24, background: palette.card, border: `1.5px solid ${palette.line}`,
        borderRadius: 12, textAlign: "center", color: palette.inkSoft, fontSize: 14,
      }}>
        No baking activity yet. Log a bake to see stats here.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Bakes logged" value={totalBakes} accent={palette.leaf} />
        <StatCard label="Total cost" value={fmtMoney(totalCost)} accent={palette.feather} />
        {totalSalesCount > 0 && <StatCard label="Sales" value={`${totalSalesCount}`} sub={fmtMoney(totalRevenue)} accent={palette.yolk} />}
        {avgRating && <StatCard label="Avg rating" value={`${avgRating}/5`} accent={palette.accent} />}
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
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, marginBottom: 10, color: palette.ink }}>Most baked</div>
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
