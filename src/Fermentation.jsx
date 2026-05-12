// ============================================================================
// FERMENTATION PAGE
// ----------------------------------------------------------------------------
// Tracks active fermentations day-by-day. Fundamentally different from other
// preserving methods because the *process* is the thing being tracked — not
// a one-shot batch but a multi-day sequence of observations.
//
// Two entities:
//   1. ferments[] = ongoing or completed fermentations. Each has its own
//      stages[] array of day-by-day log entries (date, dayNumber, temp,
//      observation, optional stage label).
//   2. recipes[] = saved templates (item, expectedDays, default ingredients,
//      typical temp range, notes). Lets users quickly start a new ferment
//      from a known recipe without retyping everything.
//
// Data shape:
//   hobby.ferments[]   = [{ id, name, recipeId?, startDate, expectedFinishDate,
//                            startedTemperatureF, location, ingredients,
//                            stages: [{ date, dayNumber, temperatureF,
//                                       stageLabel, observation }],
//                            finishDate?, finalNotes?, archived }]
//   hobby.recipes[]    = [{ id, name, expectedDays, defaultTempLow,
//                            defaultTempHigh, ingredients, notes }]
// ============================================================================

import React, { useState, useMemo } from "react";
import { X, Plus, Trash2 } from "lucide-react";

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
  return new Date(y, m - 1, d);
};
const daysBetween = (isoA, isoB) => {
  const a = parseIso(isoA);
  const b = parseIso(isoB);
  if (!a || !b) return 0;
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
};
const addDaysIso = (iso, days) => {
  const d = parseIso(iso);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

// ============================================================================
// SHARED UI
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
    <button type={type} disabled={disabled} onClick={onClick}
      style={{
        background: v.bg, color: v.color, border: `1.5px solid ${v.border}`,
        borderRadius: 10, padding: small ? "8px 12px" : "10px 16px",
        fontFamily: FONT_BODY, fontWeight: 600, fontSize: small ? 13 : 14,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        boxShadow: variant === "ghost" ? "none" : "2px 2px 0 " + palette.line,
        ...style,
      }}>
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
// NEW / EDIT FERMENT MODAL
// ============================================================================
function FermentModal({ ferment, recipes, onSave, onDelete, onClose }) {
  const editing = !!ferment;
  const [name, setName] = useState(ferment?.name || "");
  const [startDate, setStartDate] = useState(ferment?.startDate || todayIso());
  const [expectedDays, setExpectedDays] = useState(ferment?.expectedFinishDate ? daysBetween(ferment.startDate, ferment.expectedFinishDate).toString() : "7");
  const [recipeId, setRecipeId] = useState(ferment?.recipeId || "");
  const [startedTemperatureF, setStartedTemperatureF] = useState(ferment?.startedTemperatureF?.toString() || "");
  const [location, setLocation] = useState(ferment?.location || "");
  const [ingredients, setIngredients] = useState(ferment?.ingredients || "");

  const onPickRecipe = (id) => {
    setRecipeId(id);
    const r = recipes.find(x => x.id === id);
    if (r) {
      if (!name) setName(r.name);
      setExpectedDays(r.expectedDays?.toString() || "7");
      if (!ingredients) setIngredients(r.ingredients || "");
    }
  };

  const canSave = !!name.trim();

  const handleSave = () => {
    if (!canSave) return;
    const days = parseInt(expectedDays, 10) || 7;
    onSave({
      id: ferment?.id || newId(),
      name: name.trim(),
      recipeId: recipeId || null,
      startDate,
      expectedFinishDate: addDaysIso(startDate, days),
      startedTemperatureF: parseFloat(startedTemperatureF) || null,
      location: location.trim(),
      ingredients: ingredients.trim(),
      stages: ferment?.stages || [],
      finishDate: ferment?.finishDate || null,
      finalNotes: ferment?.finalNotes || "",
      archived: ferment?.archived || false,
      created: ferment?.created || Date.now(),
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={editing ? "✏️ Edit ferment" : "🫧 New fermentation"}>
      {recipes.length > 0 && !editing && (
        <Field label="Start from recipe (optional)">
          <select style={inputStyle} value={recipeId} onChange={(e) => onPickRecipe(e.target.value)}>
            <option value="">— Custom (no recipe) —</option>
            {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Name">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sauerkraut Batch #3, Hot sauce, Kombucha SCOBY" autoFocus />
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Start date">
            <input type="date" style={inputStyle} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Expected days">
            <input type="number" min={1} style={inputStyle} value={expectedDays} onChange={(e) => setExpectedDays(e.target.value)} placeholder="7" inputMode="numeric" />
          </Field>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Starting temp (°F)">
            <input type="number" min={0} style={inputStyle} value={startedTemperatureF} onChange={(e) => setStartedTemperatureF(e.target.value)} placeholder="e.g. 68" inputMode="numeric" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Location">
            <input style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Kitchen counter, basement…" />
          </Field>
        </div>
      </div>
      <Field label="Ingredients / recipe details">
        <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontFamily: FONT_BODY }} value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder="2 heads cabbage, 1 tbsp salt, etc." />
      </Field>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
        {editing && onDelete ? (
          <Btn variant="ghost" onClick={() => { if (confirm("Delete this ferment? All stage logs will be lost.")) { onDelete(ferment.id); onClose(); } }}>Delete</Btn>
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
// LOG STAGE MODAL — add a daily observation to an active ferment
// ============================================================================
function LogStageModal({ ferment, onSave, onClose }) {
  const dayNumber = ferment ? daysBetween(ferment.startDate, todayIso()) + 1 : 1;
  const [date, setDate] = useState(todayIso());
  const [temperatureF, setTemperatureF] = useState("");
  const [stageLabel, setStageLabel] = useState("");
  const [observation, setObservation] = useState("");

  const canSave = !!observation.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      date,
      dayNumber: daysBetween(ferment.startDate, date) + 1,
      temperatureF: parseFloat(temperatureF) || null,
      stageLabel: stageLabel.trim(),
      observation: observation.trim(),
      created: Date.now(),
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Day ${dayNumber} log`}>
      <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 12, lineHeight: 1.5 }}>
        Logging an observation for <strong>{ferment.name}</strong>. Temperature is optional but helpful for reflection later.
      </div>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Temp (°F)">
            <input type="number" min={0} style={inputStyle} value={temperatureF} onChange={(e) => setTemperatureF(e.target.value)} placeholder="e.g. 70" inputMode="numeric" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Stage label">
            <input style={inputStyle} value={stageLabel} onChange={(e) => setStageLabel(e.target.value)} placeholder="e.g. Primary, Bubbling, Done" />
          </Field>
        </div>
      </div>
      <Field label="Observation">
        <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical", fontFamily: FONT_BODY }} value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="What does it look/smell/taste like today? Any changes since yesterday?" autoFocus />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={handleSave} disabled={!canSave}>Log day {dayNumber}</Btn>
      </div>
    </Modal>
  );
}

// ============================================================================
// FINISH FERMENT MODAL — mark complete, archive
// ============================================================================
function FinishFermentModal({ ferment, onFinish, onClose }) {
  const [finalNotes, setFinalNotes] = useState("");
  return (
    <Modal open onClose={onClose} title="🎉 Mark complete">
      <p style={{ fontSize: 14, color: palette.ink, lineHeight: 1.5, marginTop: 0 }}>
        Wrap up <strong>{ferment.name}</strong>. This archives the ferment with its full stage history for later reference.
      </p>
      <Field label="Final notes (taste, yield, lessons learned)">
        <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical", fontFamily: FONT_BODY }} value={finalNotes} onChange={(e) => setFinalNotes(e.target.value)} placeholder="Came out great / too salty / would let go 2 more days…" autoFocus />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={() => { onFinish(finalNotes.trim()); onClose(); }}>Mark complete</Btn>
      </div>
    </Modal>
  );
}

// ============================================================================
// RECIPE MODAL — save/edit recipe template
// ============================================================================
function RecipeModal({ recipe, onSave, onDelete, onClose }) {
  const editing = !!recipe;
  const [name, setName] = useState(recipe?.name || "");
  const [expectedDays, setExpectedDays] = useState(recipe?.expectedDays?.toString() || "7");
  const [defaultTempLow, setDefaultTempLow] = useState(recipe?.defaultTempLow?.toString() || "");
  const [defaultTempHigh, setDefaultTempHigh] = useState(recipe?.defaultTempHigh?.toString() || "");
  const [ingredients, setIngredients] = useState(recipe?.ingredients || "");
  const [notes, setNotes] = useState(recipe?.notes || "");

  const canSave = !!name.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: recipe?.id || newId(),
      name: name.trim(),
      expectedDays: parseInt(expectedDays, 10) || 7,
      defaultTempLow: parseFloat(defaultTempLow) || null,
      defaultTempHigh: parseFloat(defaultTempHigh) || null,
      ingredients: ingredients.trim(),
      notes: notes.trim(),
      created: recipe?.created || Date.now(),
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={editing ? "✏️ Edit recipe" : "📋 New recipe"}>
      <Field label="Recipe name">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Classic sauerkraut, Tibicos water kefir" autoFocus />
      </Field>
      <Field label="Expected days">
        <input type="number" min={1} style={inputStyle} value={expectedDays} onChange={(e) => setExpectedDays(e.target.value)} placeholder="7" inputMode="numeric" />
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Temp low (°F)">
            <input type="number" min={0} style={inputStyle} value={defaultTempLow} onChange={(e) => setDefaultTempLow(e.target.value)} placeholder="65" inputMode="numeric" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Temp high (°F)">
            <input type="number" min={0} style={inputStyle} value={defaultTempHigh} onChange={(e) => setDefaultTempHigh(e.target.value)} placeholder="72" inputMode="numeric" />
          </Field>
        </div>
      </div>
      <Field label="Ingredients">
        <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical", fontFamily: FONT_BODY }} value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder="Cabbage, salt at 2% by weight, optional caraway seeds…" />
      </Field>
      <Field label="Notes / instructions">
        <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical", fontFamily: FONT_BODY }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Shred cabbage, salt, massage, pack into jar…" />
      </Field>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
        {editing && onDelete ? (
          <Btn variant="ghost" onClick={() => { if (confirm("Delete this recipe?")) { onDelete(recipe.id); onClose(); } }}>Delete</Btn>
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
// FERMENTATION PAGE
// ============================================================================
export default function FermentationPage({ hobby, data, update, setModal }) {
  const [fermentModal, setFermentModal] = useState({ open: false, ferment: null });
  const [stageModal, setStageModal] = useState({ open: false, ferment: null });
  const [finishModal, setFinishModal] = useState({ open: false, ferment: null });
  const [recipeModal, setRecipeModal] = useState({ open: false, recipe: null });
  const [view, setView] = useState("active"); // active | recipes | archive

  const ferments = hobby?.ferments || [];
  const recipes = hobby?.recipes || [];
  const active = ferments.filter(f => !f.archived);
  const archived = ferments.filter(f => f.archived);

  const saveFerment = (ferment) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.ferments)) h.ferments = [];
      const idx = h.ferments.findIndex(x => x.id === ferment.id);
      if (idx >= 0) h.ferments[idx] = ferment; else h.ferments.push(ferment);
      return d;
    });
  };

  const deleteFerment = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h) h.ferments = (h.ferments || []).filter(f => f.id !== id);
      return d;
    });
  };

  const addStage = (fermentId, stage) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      const f = (h?.ferments || []).find(x => x.id === fermentId);
      if (f) {
        if (!Array.isArray(f.stages)) f.stages = [];
        f.stages.push({ ...stage, id: newId() });
      }
      return d;
    });
  };

  const deleteStage = (fermentId, stageIdx) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      const f = (h?.ferments || []).find(x => x.id === fermentId);
      if (f && Array.isArray(f.stages)) {
        f.stages.splice(stageIdx, 1);
      }
      return d;
    });
  };

  const finishFerment = (fermentId, finalNotes) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      const f = (h?.ferments || []).find(x => x.id === fermentId);
      if (f) {
        f.archived = true;
        f.finishDate = todayIso();
        f.finalNotes = finalNotes;
      }
      return d;
    });
  };

  const saveRecipe = (recipe) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.recipes)) h.recipes = [];
      const idx = h.recipes.findIndex(x => x.id === recipe.id);
      if (idx >= 0) h.recipes[idx] = recipe; else h.recipes.push(recipe);
      return d;
    });
  };

  const deleteRecipe = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h) h.recipes = (h.recipes || []).filter(r => r.id !== id);
      return d;
    });
  };

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 28, margin: 0, color: palette.ink }}>🫧 Fermentation</h1>
        {view === "active" && (
          <Btn variant="primary" small onClick={() => setFermentModal({ open: true, ferment: null })}>+ New ferment</Btn>
        )}
        {view === "recipes" && (
          <Btn variant="primary" small onClick={() => setRecipeModal({ open: true, recipe: null })}>+ New recipe</Btn>
        )}
      </div>

      {/* View toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[
          { key: "active", label: `Active (${active.length})` },
          { key: "recipes", label: `Recipes (${recipes.length})` },
          { key: "archive", label: `Archive (${archived.length})` },
        ].map(o => (
          <button key={o.key} onClick={() => setView(o.key)} style={{
            flex: 1, padding: "8px 6px", borderRadius: 8,
            border: `1.5px solid ${view === o.key ? palette.ink : palette.line}`,
            background: view === o.key ? palette.ink : palette.card,
            color: view === o.key ? palette.bg : palette.ink,
            fontFamily: FONT_BODY, fontWeight: 600, fontSize: 12, cursor: "pointer",
          }}>{o.label}</button>
        ))}
      </div>

      {/* ACTIVE VIEW */}
      {view === "active" && (
        active.length === 0 ? (
          <div style={{
            padding: "32px 16px", textAlign: "center",
            background: palette.card, border: `1.5px dashed ${palette.line}`, borderRadius: 12,
            color: palette.inkSoft, fontSize: 14, lineHeight: 1.6,
          }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>🫧</div>
            No active fermentations. Tap <strong>+ New ferment</strong> to start one.
          </div>
        ) : (
          active.map(f => {
            const currentDay = daysBetween(f.startDate, todayIso()) + 1;
            const totalDays = daysBetween(f.startDate, f.expectedFinishDate);
            const progress = Math.min(100, Math.max(0, (currentDay / Math.max(1, totalDays)) * 100));
            const overdue = currentDay > totalDays;
            const stages = (f.stages || []).slice().sort((a, b) => (b.dayNumber || 0) - (a.dayNumber || 0));
            return (
              <div key={f.id} style={{
                padding: "14px 16px", background: palette.card,
                border: `1.5px solid ${palette.line}`, borderRadius: 12,
                marginBottom: 12,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink, lineHeight: 1.2 }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 4 }}>
                      Day {currentDay} of ~{totalDays}{overdue ? " (overdue)" : ""}
                      {f.location && ` · ${f.location}`}
                    </div>
                  </div>
                  <button onClick={() => setFermentModal({ open: true, ferment: f })} style={{
                    background: "none", border: "none", color: palette.inkSoft, cursor: "pointer", fontSize: 12, padding: 4,
                  }}>Edit</button>
                </div>
                <div style={{ height: 6, background: palette.line, borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
                  <div style={{ width: `${progress}%`, height: "100%", background: overdue ? palette.accent : palette.leaf }} />
                </div>
                {/* Recent stage logs */}
                {stages.length > 0 && (
                  <div style={{ marginBottom: 10, padding: "8px 10px", background: palette.bg, borderRadius: 8 }}>
                    {stages.slice(0, 3).map((s, i) => (
                      <div key={s.id || i} style={{ fontSize: 12, color: palette.ink, marginBottom: i < Math.min(2, stages.length - 1) ? 6 : 0, lineHeight: 1.4 }}>
                        <strong>Day {s.dayNumber}</strong>
                        {s.stageLabel && ` · ${s.stageLabel}`}
                        {s.temperatureF != null && ` · ${s.temperatureF}°F`}
                        <div style={{ color: palette.inkSoft }}>{s.observation}</div>
                      </div>
                    ))}
                    {stages.length > 3 && (
                      <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 6, fontStyle: "italic" }}>
                        + {stages.length - 3} earlier log{stages.length - 3 === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn variant="leaf" small onClick={() => setStageModal({ open: true, ferment: f })} style={{ flex: 1 }}>+ Log day</Btn>
                  <Btn variant="primary" small onClick={() => setFinishModal({ open: true, ferment: f })} style={{ flex: 1 }}>✓ Mark done</Btn>
                </div>
              </div>
            );
          })
        )
      )}

      {/* RECIPES VIEW */}
      {view === "recipes" && (
        recipes.length === 0 ? (
          <div style={{
            padding: "32px 16px", textAlign: "center",
            background: palette.card, border: `1.5px dashed ${palette.line}`, borderRadius: 12,
            color: palette.inkSoft, fontSize: 14, lineHeight: 1.6,
          }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>📋</div>
            No saved recipes yet. Save your go-to ferments here for quick re-use.
          </div>
        ) : (
          recipes.map(r => (
            <div key={r.id} onClick={() => setRecipeModal({ open: true, recipe: r })} style={{
              padding: "12px 14px", background: palette.card,
              border: `1.5px solid ${palette.line}`, borderRadius: 10,
              marginBottom: 8, cursor: "pointer",
            }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: palette.ink }}>{r.name}</div>
              <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 2 }}>
                ~{r.expectedDays} days
                {r.defaultTempLow && r.defaultTempHigh && ` · ${r.defaultTempLow}–${r.defaultTempHigh}°F`}
              </div>
              {r.notes && <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 4, fontStyle: "italic" }}>{r.notes}</div>}
            </div>
          ))
        )
      )}

      {/* ARCHIVE VIEW */}
      {view === "archive" && (
        archived.length === 0 ? (
          <div style={{
            padding: "32px 16px", textAlign: "center",
            background: palette.card, border: `1.5px dashed ${palette.line}`, borderRadius: 12,
            color: palette.inkSoft, fontSize: 14, lineHeight: 1.6,
          }}>
            Completed ferments will appear here for reflection later.
          </div>
        ) : (
          archived.slice().sort((a, b) => (b.finishDate || "").localeCompare(a.finishDate || "")).map(f => (
            <div key={f.id} style={{
              padding: "12px 14px", background: palette.card,
              border: `1.5px solid ${palette.line}`, borderRadius: 10, marginBottom: 8,
            }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: palette.ink }}>{f.name}</div>
              <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 2 }}>
                {f.startDate} → {f.finishDate || "?"} · {(f.stages || []).length} log{(f.stages || []).length === 1 ? "" : "s"}
              </div>
              {f.finalNotes && <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 6, fontStyle: "italic" }}>{f.finalNotes}</div>}
            </div>
          ))
        )
      )}

      {fermentModal.open && (
        <FermentModal
          ferment={fermentModal.ferment}
          recipes={recipes}
          onSave={saveFerment}
          onDelete={fermentModal.ferment ? deleteFerment : null}
          onClose={() => setFermentModal({ open: false, ferment: null })}
        />
      )}
      {stageModal.open && stageModal.ferment && (
        <LogStageModal
          ferment={stageModal.ferment}
          onSave={(stage) => addStage(stageModal.ferment.id, stage)}
          onClose={() => setStageModal({ open: false, ferment: null })}
        />
      )}
      {finishModal.open && finishModal.ferment && (
        <FinishFermentModal
          ferment={finishModal.ferment}
          onFinish={(notes) => finishFerment(finishModal.ferment.id, notes)}
          onClose={() => setFinishModal({ open: false, ferment: null })}
        />
      )}
      {recipeModal.open && (
        <RecipeModal
          recipe={recipeModal.recipe}
          onSave={saveRecipe}
          onDelete={recipeModal.recipe ? deleteRecipe : null}
          onClose={() => setRecipeModal({ open: false, recipe: null })}
        />
      )}
    </div>
  );
}

// ============================================================================
// ANALYTICS
// ============================================================================
export function FermentationAnalytics({ hobby }) {
  const ferments = hobby?.ferments || [];
  const recipes = hobby?.recipes || [];
  const active = ferments.filter(f => !f.archived);
  const completed = ferments.filter(f => f.archived);
  const totalLogs = ferments.reduce((s, f) => s + (f.stages?.length || 0), 0);

  return (
    <div style={{ paddingBottom: 80 }}>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, margin: "0 0 14px", color: palette.ink }}>🫧 Fermentation Stats</h1>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Active" value={active.length} accent={palette.leaf} />
        <StatCard label="Completed" value={completed.length} accent={palette.feather} />
        <StatCard label="Stage logs" value={totalLogs} accent={palette.yolk} />
        <StatCard label="Recipes" value={recipes.length} accent={palette.accent} />
      </div>
      {completed.length > 0 && (
        <div style={{
          background: palette.card, border: `1.5px solid ${palette.line}`,
          borderRadius: 12, padding: 14,
        }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 8 }}>Recent completions</div>
          {completed.slice().sort((a, b) => (b.finishDate || "").localeCompare(a.finishDate || "")).slice(0, 5).map(f => (
            <div key={f.id} style={{ padding: "6px 0", borderBottom: `1px solid ${palette.line}`, fontSize: 13, color: palette.ink }}>
              <strong>{f.name}</strong> — {f.finishDate || "?"} ({(f.stages || []).length} logs)
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
