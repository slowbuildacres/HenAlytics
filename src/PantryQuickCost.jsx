// ============================================================================
// PantryQuickCost.jsx — shared inline cost-builder for kitchen hobby batches
// ----------------------------------------------------------------------------
// Used by Canning, Fermentation, FreezeDrying, Dehydrating (and could be
// added to Sourdough). Sits inside each hobby's batch modal as an alternative
// way to populate the "ingredients cost" field.
//
// Flow:
//   1. User taps "+ Pick from pantry" → shows a sub-form
//   2. User picks a pantry item + amount + unit → "Add" appends to list
//   3. Running total displays at the bottom; when user closes the picker,
//      the parent's onApply callback is called with { total, deductions }
//   4. Parent stores deductions on the batch so deletion / future undo
//      can refund stock (left to parent — we just emit)
//   5. Parent also pushes deductions through update() so pantry stock
//      goes down — but on first creation only, not on edit (edits are
//      messy with deductions; defer for now)
//
// We deliberately keep this stateless about WHEN to deduct — the parent
// owns that. We just compute total cost and return the list of intended
// deductions; parent decides whether to actually apply them.
// ============================================================================

import React, { useState } from "react";
import {
  PANTRY_WEIGHT_UNITS, PANTRY_VOLUME_UNITS, PANTRY_COUNT_UNITS,
  PANTRY_UNIT_LABELS, pantryItemCostForUsage,
  convertPantryUnit, pantryItemDensity,
} from "./pantry.js";

const NEUTRAL = {
  text: "#2C1810",
  textSoft: "#5D4A3D",
  border: "#D4C7B8",
  bg: "#FFF9F0",
  bgAlt: "#F4EEE0",
  accent: "#A93621",
  ink: "#2C1810",
};

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: `1.5px solid ${NEUTRAL.border}`,
  background: NEUTRAL.bg,
  fontFamily: "inherit",
  fontSize: 13,
  color: NEUTRAL.text,
  boxSizing: "border-box",
};

function fmtMoneyLocal(n) {
  const v = Number(n) || 0;
  return `$${v.toFixed(2)}`;
}

// `lines` is the controlled list of { id, pantryId, amount, unit }.
// onChange(nextLines) is called whenever the user adds/removes/edits.
// onApply(total) lets the parent grab the running total at any time.
//
// We also expose computeDeductions() shape via the lines themselves — the
// parent reads lines back to apply deductions on save.
export default function PantryQuickCost({ pantry, lines, onChange, palette }) {
  const p = { ...NEUTRAL, ...(palette || {}) };
  const activePantry = (pantry || []).filter(x => !x.archived);
  const [showPicker, setShowPicker] = useState(lines && lines.length > 0);
  const [pickerPantryId, setPickerPantryId] = useState("");
  const [pickerAmount, setPickerAmount] = useState("");
  const [pickerUnit, setPickerUnit] = useState("cup");

  const safeLines = Array.isArray(lines) ? lines : [];

  let runningCost = 0;
  let missingCount = 0;
  for (const ln of safeLines) {
    const it = activePantry.find(x => x.id === ln.pantryId);
    if (!it) { missingCount += 1; continue; }
    const r = pantryItemCostForUsage(it, ln.amount, ln.unit);
    if (!r.ok) { missingCount += 1; continue; }
    runningCost += r.cost;
  }

  const addLine = () => {
    if (!pickerPantryId) return;
    const amt = parseFloat(pickerAmount);
    if (!(amt > 0)) return;
    const next = [
      ...safeLines,
      { id: "pl_" + Math.random().toString(36).slice(2, 8), pantryId: pickerPantryId, amount: amt, unit: pickerUnit },
    ];
    onChange(next);
    // reset picker
    setPickerPantryId("");
    setPickerAmount("");
  };

  const removeLine = (id) => {
    onChange(safeLines.filter(x => x.id !== id));
  };

  if (activePantry.length === 0) {
    return (
      <div style={{ padding: 10, background: p.bgAlt, border: `1.5px dashed ${p.border}`, borderRadius: 6, marginTop: 6, fontSize: 12, color: p.textSoft, lineHeight: 1.5 }}>
        No pantry items yet — tap the 🥫 Pantry button at the top of this page to add some, then come back to link them here.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      {!showPicker ? (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          style={{ background: "none", border: `1.5px solid ${p.border}`, borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: p.ink }}
        >
          🥫 Pick from pantry
        </button>
      ) : (
        <div style={{ padding: 10, background: p.bgAlt, border: `1.5px solid ${p.border}`, borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: p.ink }}>From pantry</div>
            <button
              type="button"
              onClick={() => setShowPicker(false)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: p.textSoft }}
            >
              Hide
            </button>
          </div>

          {safeLines.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
              {safeLines.map(ln => {
                const it = activePantry.find(x => x.id === ln.pantryId);
                const r = it ? pantryItemCostForUsage(it, ln.amount, ln.unit) : { cost: 0, ok: false };
                return (
                  <div key={ln.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", background: p.bg, borderRadius: 4, fontSize: 12 }}>
                    <span style={{ color: p.ink, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {it ? it.name : "(missing)"} · {ln.amount} {PANTRY_UNIT_LABELS[ln.unit] || ln.unit}
                    </span>
                    <span style={{ color: r.ok ? p.textSoft : p.accent, marginLeft: 8, whiteSpace: "nowrap" }}>
                      {r.ok ? fmtMoneyLocal(r.cost) : "⚠️"}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(ln.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: p.accent, marginLeft: 6, padding: 0, fontSize: 12 }}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 4 }}>
            <select
              style={{ ...inputStyle, fontSize: 12 }}
              value={pickerPantryId}
              onChange={e => setPickerPantryId(e.target.value)}
            >
              <option value="">— Pick item —</option>
              {activePantry.map(it => (
                <option key={it.id} value={it.id}>{it.name}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              style={{ ...inputStyle, fontSize: 12 }}
              value={pickerAmount}
              onChange={e => setPickerAmount(e.target.value)}
              placeholder="Amount"
            />
            <select
              style={{ ...inputStyle, fontSize: 12 }}
              value={pickerUnit}
              onChange={e => setPickerUnit(e.target.value)}
            >
              <optgroup label="Volume">
                {PANTRY_VOLUME_UNITS.map(u => <option key={u} value={u}>{PANTRY_UNIT_LABELS[u]}</option>)}
              </optgroup>
              <optgroup label="Weight">
                {PANTRY_WEIGHT_UNITS.map(u => <option key={u} value={u}>{PANTRY_UNIT_LABELS[u]}</option>)}
              </optgroup>
              <optgroup label="Count">
                {PANTRY_COUNT_UNITS.map(u => <option key={u} value={u}>{PANTRY_UNIT_LABELS[u]}</option>)}
              </optgroup>
            </select>
            <button
              type="button"
              onClick={addLine}
              disabled={!pickerPantryId || !(parseFloat(pickerAmount) > 0)}
              style={{ background: p.ink, color: p.bg, border: `1.5px solid ${p.ink}`, borderRadius: 4, padding: "0 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, opacity: (!pickerPantryId || !(parseFloat(pickerAmount) > 0)) ? 0.5 : 1 }}
            >
              Add
            </button>
          </div>

          {safeLines.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px dashed ${p.border}`, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: p.textSoft }}>
                Total{missingCount > 0 ? ` (${missingCount} missing)` : ""}
              </span>
              <span style={{ fontWeight: 700, color: p.ink }}>{fmtMoneyLocal(runningCost)}</span>
            </div>
          )}
          <div style={{ fontSize: 10, color: p.textSoft, marginTop: 6, lineHeight: 1.4 }}>
            Stock will be deducted from pantry when you save the batch.
          </div>
        </div>
      )}
    </div>
  );
}

// Helper for parent code: apply deductions from a list of pantry-cost lines
// onto a working data object. Mutates d.pantry in-place. Safe to call inside
// an update() function. Returns the list of recorded deductions (for storing
// on the batch entry for traceability).
export function applyPantryDeductions(d, lines) {
  if (!d || !Array.isArray(lines) || lines.length === 0) return [];
  if (!Array.isArray(d.pantry)) return [];
  const deductions = [];
  for (const ln of lines) {
    const it = d.pantry.find(p => p.id === ln.pantryId);
    if (!it || it.archived) continue;
    // Need to import the conversion helpers here too. Avoid the import by
    // duplicating the math: cost is computed elsewhere, here we just need
    // the amount in purchase units. Use the same helper from pantry.js by
    // requiring our caller to give us the converted amount. To keep this
    // module self-contained, we re-import the conversion helper lazily.
    // (Imported at top below.)
    const inPurchaseUnits = convertForDeduction(ln.amount, ln.unit, it);
    if (inPurchaseUnits == null) continue;
    const current = Number(it.currentAmount) || 0;
    const newAmt = Math.max(0, current - inPurchaseUnits);
    it.currentAmount = newAmt;
    deductions.push({ pantryId: it.id, amount: inPurchaseUnits, unit: it.purchaseUnit });
  }
  return deductions;
}

// Refund a list of previously-applied deductions back into pantry stock.
// Used when a batch/bake that consumed pantry items is deleted, so the
// stock numbers stay honest. `deductions` is the array stored on the batch
// as `_pantryDeductions` (each row already in the pantry item's purchase
// unit, so no conversion needed). Refund caps at the original purchase
// amount — we never overshoot the bag's capacity, since the user may have
// since edited purchaseAmount down.
//
// Safe no-op when d, deductions, or d.pantry are missing/empty.
export function applyPantryRefunds(d, deductions) {
  if (!d || !Array.isArray(deductions) || deductions.length === 0) return;
  if (!Array.isArray(d.pantry)) return;
  for (const ded of deductions) {
    if (!ded || !ded.pantryId) continue;
    const it = d.pantry.find(p => p.id === ded.pantryId);
    if (!it) continue;
    const amt = Number(ded.amount) || 0;
    if (amt <= 0) continue;
    const current = Number(it.currentAmount) || 0;
    const cap = Number(it.purchaseAmount) || Infinity;
    it.currentAmount = Math.min(cap, current + amt);
  }
}

// Inline conversion using pantry.js helpers (imported at top).
function convertForDeduction(amount, fromUnit, item) {
  if (!item) return null;
  return convertPantryUnit(amount, fromUnit, item.purchaseUnit, pantryItemDensity(item));
}
