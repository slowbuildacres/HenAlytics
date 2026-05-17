// ============================================================================
// ANIMAL HISTORY VIEW — unified timeline for any animal across any species
// ----------------------------------------------------------------------------
// Renders a chronological timeline of every event tied to a single animal:
//   - data.entries[hobbyId] filtered by animalId (milk, fed, weight, health,
//     death, sale, note, bred, butcher, calf, litter, etc.)
//   - hobby.vet[] / farrier[] / deworming[] (horses) filtered by horseId
//   - hobby.rides[] (horses) filtered by horseId
//   - hobby.shearings[] (sheep) filtered by animalId
//   - hobby.breedings[] (horses: mareId/stallionId, dogs: damId/sireId)
//   - data.sales filtered by animalId
//   - animal.archived/archivedReason/archivedDate as the final event
//
// Sorted newest-first. Each row: emoji + action label + date + key detail.
// TAPPING a row opens a detail modal showing all fields of the source record,
// with Edit-notes and Delete actions.
//
// Usage: any species page does
//   <AnimalHistoryView
//     animal={animal}
//     hobby={hobby}
//     entries={entries}              // already-scoped entries for this hobby
//     sales={data.sales || []}
//     species="cow"                  // controls emoji + which extras to read
//     update={update}                // REQUIRED for edit/delete to work
//     onClose={() => setShowHistory(false)}
//   />
// The component is the modal shell itself (mirrors PedigreeView's contract).
// ============================================================================

import React, { useState } from "react";
import { X, Trash2, Save, Edit3 } from "lucide-react";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", yolk: "#E8B547", feather: "#8B6F47",
  line: "#2C181030", card: "#FAF5EA",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

const parseLocalDate = (s) => {
  if (!s) return new Date();
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const fmtDate = (s) => {
  if (!s) return "";
  return parseLocalDate(s).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
};
const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;

// ----------------------------------------------------------------------------
// Action label/emoji map — covers every per-animal action across all species.
// Falls back to the raw action name if we hit something new.
// ----------------------------------------------------------------------------
const ACTION_META = {
  milk:     { emoji: "🥛", label: "Milking" },
  fed:      { emoji: "🌾", label: "Feed" },
  weight:   { emoji: "⚖️", label: "Weight" },
  health:   { emoji: "💊", label: "Health" },
  butcher:  { emoji: "🔪", label: "Butcher" },
  death:    { emoji: "💀", label: "Death" },
  sale:     { emoji: "🏷️", label: "Sale" },
  note:     { emoji: "📓", label: "Note" },
  bred:     { emoji: "💕", label: "Bred" },
  calf:     { emoji: "🍼", label: "Calf born" },
  litter:   { emoji: "🍼", label: "Litter" },
  lambing:  { emoji: "🐑", label: "Lambing" },
  farrowing:{ emoji: "🐷", label: "Farrowing" },
  kidding:  { emoji: "🐐", label: "Kidding" },
  foaling:  { emoji: "🐴", label: "Foaling" },
  training: { emoji: "🎓", label: "Training" },
  walk:     { emoji: "🚶", label: "Walk" },
  groom:    { emoji: "✂️", label: "Groom" },
};
const actionMeta = (action) => ACTION_META[action] || { emoji: "•", label: action };

// ----------------------------------------------------------------------------
// Build the "detail" string for an entry. Falls through gracefully when the
// expected fields aren't present — different species use slightly different
// shapes (e.g. butcher has weight vs. count+avgWeight on rabbits).
// ----------------------------------------------------------------------------
const detailForEntry = (e) => {
  const bits = [];
  if (e.action === "milk" && e.gallons != null) bits.push(`${e.gallons} gal`);
  if (e.action === "fed") {
    // Newer entries store feedAmount + feedUnit; legacy entries only have lbs.
    if (e.feedUnit === "cups" && e.feedAmount != null) {
      bits.push(`${e.feedAmount} cups`);
    } else if (e.lbs != null && Number(e.lbs) > 0) {
      bits.push(`${e.lbs} lbs`);
    } else if (e.feedAmount != null && Number(e.feedAmount) > 0) {
      // Defensive fallback: feedAmount present but feedUnit missing — default to lbs
      bits.push(`${e.feedAmount} lbs`);
    }
    if (e.cost > 0) bits.push(fmtMoney(e.cost));
  }
  if (e.action === "weight" && e.weight != null) bits.push(`${e.weight} lbs`);
  if (e.action === "butcher") {
    if (e.weight != null) bits.push(`${e.weight} lbs`);
    else if (e.count != null && e.avgWeight != null) bits.push(`${e.count} × ${e.avgWeight} lbs`);
    if (e.cost > 0) bits.push(fmtMoney(e.cost));
  }
  if (e.action === "death" && e.cause) bits.push(e.cause);
  if (e.action === "sale") {
    if (e.saleType && e.saleType !== "sold") bits.push(e.saleType);
    if (e.price > 0) bits.push(fmtMoney(e.price));
    if (e.buyer) bits.push(`to ${e.buyer}`);
  }
  if (e.action === "bred" && e.buckName) bits.push(`sire ${e.buckName}`);
  if (e.action === "calf" && e.count) bits.push(`${e.count} calf`);
  if (e.action === "litter") {
    if (e.kitsAlive != null) bits.push(`${e.kitsAlive} alive`);
    if (e.kitsStillborn > 0) bits.push(`${e.kitsStillborn} stillborn`);
  }
  // BUG1-NOTES-FALLBACK: per-animal entries store their text in `notes`
  // (plural). The old code checked `e.note` (singular) for note/health
  // entries, so the timeline preview was always blank for them. This
  // general fallback surfaces the notes for ANY action that has no other
  // detail — covering health, note, and kids/litter/lambing entries —
  // while leaving actions that already built a detail (milk, fed, etc.)
  // untouched. `e.note` is kept as a defensive fallback for legacy data.
  if (bits.length === 0) {
    const noteText = (e.notes != null && String(e.notes).trim() !== "")
      ? String(e.notes).trim()
      : (e.note != null && String(e.note).trim() !== "")
        ? String(e.note).trim()
        : "";
    if (noteText) bits.push(noteText);
  }
  return bits.join(" · ");
};

// ----------------------------------------------------------------------------
// Collect every event tied to this animal from every source available on the
// hobby. Returns a flat list of { date, emoji, label, detail, kind, source,
// recordId, sourceKey } objects. Sort happens at render time.
//
// New fields used by the detail modal:
//   - source: the raw source record (full fields, used to render detail view)
//   - recordId: the record's id (used to find + delete the record on update)
//   - sourceKey: where to find the record for update/delete operations.
//       "entry"        → data.entries[hobbyId][i]
//       "sale"         → data.sales[i]
//       "vet" | "farrier" | "deworming" | "ride" → hobby[sourceKey][i]
//       "shearing"     → hobby.shearings[i]
//       "breeding"     → hobby.breedings[i]
//       "archive"      → animal.archived* (not deletable/editable — virtual)
// ----------------------------------------------------------------------------
function collectEvents({ animal, hobby, entries, sales, species }) {
  const out = [];
  const animalId = animal.id;

  // 1. Per-animal entries (every species uses this)
  (entries || []).filter(e => e.animalId === animalId).forEach(e => {
    const meta = actionMeta(e.action);
    out.push({
      date: e.date,
      emoji: meta.emoji,
      label: meta.label,
      detail: detailForEntry(e),
      kind: "entry",
      source: e,
      recordId: e.id,
      sourceKey: "entry",
    });
  });

  // 2. Sales (cross-species — data.sales is global)
  (sales || []).filter(s => s.animalId === animalId).forEach(s => {
    const bits = [];
    if (s.type && s.type !== "sold") bits.push(s.type);
    if (s.price > 0) bits.push(fmtMoney(s.price));
    if (s.buyer) bits.push(`to ${s.buyer}`);
    out.push({
      date: s.date,
      emoji: "🏷️",
      label: "Sale",
      detail: bits.join(" · "),
      kind: "sale",
      source: s,
      recordId: s.id,
      sourceKey: "sale",
    });
  });

  // 3. Species-specific extras
  if (species === "horse") {
    // Horse vet/farrier/deworming records may have horseId (singular, legacy)
    // OR horseIds: [...] (new shape — supports apply-to-all where one visit
    // applies to multiple horses). Match on either: the visit shows up in
    // every selected horse's history.
    const includesAnimal = (rec) =>
      rec.horseId === animalId ||
      (Array.isArray(rec.horseIds) && rec.horseIds.includes(animalId));
    (hobby.vet || []).filter(includesAnimal).forEach(v => {
      const bits = [];
      if (v.type) bits.push(v.type);
      if (v.vetName) bits.push(v.vetName);
      if (v.cost > 0) bits.push(fmtMoney(v.cost));
      if (Array.isArray(v.horseIds) && v.horseIds.length > 1) bits.push(`+ ${v.horseIds.length - 1} more`);
      if (v.notes) bits.push(v.notes);
      out.push({
        date: v.date, emoji: "🩺", label: "Vet", detail: bits.join(" · "),
        kind: "vet", source: v, recordId: v.id, sourceKey: "vet",
      });
    });
    (hobby.farrier || []).filter(includesAnimal).forEach(f => {
      const bits = [];
      if (f.type) bits.push(f.type);
      if (f.cost > 0) bits.push(fmtMoney(f.cost));
      if (Array.isArray(f.horseIds) && f.horseIds.length > 1) bits.push(`+ ${f.horseIds.length - 1} more`);
      if (f.notes) bits.push(f.notes);
      out.push({
        date: f.date, emoji: "🔨", label: "Farrier", detail: bits.join(" · "),
        kind: "farrier", source: f, recordId: f.id, sourceKey: "farrier",
      });
    });
    (hobby.deworming || []).filter(includesAnimal).forEach(d => {
      const bits = [];
      if (d.product) bits.push(d.product);
      if (d.cost > 0) bits.push(fmtMoney(d.cost));
      if (Array.isArray(d.horseIds) && d.horseIds.length > 1) bits.push(`+ ${d.horseIds.length - 1} more`);
      if (d.notes) bits.push(d.notes);
      out.push({
        date: d.date, emoji: "💊", label: "Dewormer", detail: bits.join(" · "),
        kind: "dewormer", source: d, recordId: d.id, sourceKey: "deworming",
      });
    });
    (hobby.rides || []).filter(r => r.horseId === animalId).forEach(r => {
      const bits = [];
      if (r.type) bits.push(r.type);
      if (r.durationMinutes) bits.push(`${r.durationMinutes} min`);
      if (r.notes) bits.push(r.notes);
      out.push({
        date: r.date, emoji: "🐴", label: "Ride", detail: bits.join(" · "),
        kind: "ride", source: r, recordId: r.id, sourceKey: "rides",
      });
    });
    // Horse breedings use mareId/stallionId
    (hobby.breedings || []).filter(b => b.mareId === animalId || b.stallionId === animalId).forEach(b => {
      const role = b.mareId === animalId ? "as mare" : "as stallion";
      const otherId = b.mareId === animalId ? b.stallionId : b.mareId;
      const other = (hobby.animals || []).find(a => a.id === otherId);
      const bits = [role];
      if (other) bits.push(`with ${other.name}`);
      else if (b.stallionExternal) bits.push(`with ${b.stallionExternal}`);
      if (b.notes) bits.push(b.notes);
      out.push({
        date: b.bredDate || b.date,
        emoji: "💕", label: "Breeding",
        detail: bits.join(" · "),
        kind: "breeding", source: b, recordId: b.id, sourceKey: "breedings",
      });
    });
  }

  if (species === "sheep") {
    (hobby.shearings || []).filter(s => s.animalId === animalId).forEach(s => {
      const bits = [];
      if (s.woolLbs) bits.push(`${s.woolLbs} lbs wool`);
      if (s.woolGrade) bits.push(s.woolGrade);
      if (s.notes) bits.push(s.notes);
      out.push({
        date: s.date, emoji: "✂️", label: "Shearing", detail: bits.join(" · "),
        kind: "shearing", source: s, recordId: s.id, sourceKey: "shearings",
      });
    });
    // Sheep breedings: legacy used eweId/ramId; new code also writes damId/sireId
    // for parity with cows/goats/dogs. Match on either.
    (hobby.breedings || []).filter(b =>
      b.eweId === animalId || b.ramId === animalId ||
      b.damId === animalId || b.sireId === animalId
    ).forEach(b => {
      const isDam = b.eweId === animalId || b.damId === animalId;
      const role = isDam ? "as ewe" : "as ram";
      const otherId = isDam ? (b.ramId || b.sireId) : (b.eweId || b.damId);
      const other = (hobby.animals || []).find(a => a.id === otherId);
      const bits = [role];
      if (other) bits.push(`with ${other.name}`);
      else if (b.externalSireName) bits.push(`with ${b.externalSireName}`);
      if (b.method) bits.push(b.method);
      if (b.notes) bits.push(b.notes);
      out.push({
        date: b.breedDate || b.bredDate || b.date,
        emoji: "💕", label: "Breeding",
        detail: bits.join(" · "),
        kind: "breeding", source: b, recordId: b.id, sourceKey: "breedings",
      });
    });
  }

  if (species === "cow" || species === "goat") {
    // Cows + goats: use damId/sireId. The vocabulary differs (cow/bull → dam/sire,
    // doe/buck → dam/sire) but the data shape is identical.
    const damLabel = species === "cow" ? "as cow (dam)" : "as doe (dam)";
    const sireLabel = species === "cow" ? "as bull (sire)" : "as buck (sire)";
    (hobby.breedings || []).filter(b => b.damId === animalId || b.sireId === animalId).forEach(b => {
      const isDam = b.damId === animalId;
      const role = isDam ? damLabel : sireLabel;
      const otherId = isDam ? b.sireId : b.damId;
      const other = (hobby.animals || []).find(a => a.id === otherId);
      const bits = [role];
      if (other) bits.push(`with ${other.name}`);
      else if (b.externalSireName) bits.push(`with ${b.externalSireName}`);
      if (b.method) bits.push(b.method);
      if (b.notes) bits.push(b.notes);
      out.push({
        date: b.breedDate || b.bredDate || b.date,
        emoji: "💕", label: "Breeding",
        detail: bits.join(" · "),
        kind: "breeding", source: b, recordId: b.id, sourceKey: "breedings",
      });
    });
  }

  if (species === "dog" || species === "cat") {
    // Dogs and cats use damId/sireId with optional sireExternal for unknown sires
    (hobby.breedings || []).filter(b => b.damId === animalId || b.sireId === animalId).forEach(b => {
      const role = b.damId === animalId ? "as dam" : "as sire";
      const otherId = b.damId === animalId ? b.sireId : b.damId;
      const other = (hobby.animals || []).find(a => a.id === otherId);
      const bits = [role];
      if (other) bits.push(`with ${other.name}`);
      else if (b.sireExternal) bits.push(`with ${b.sireExternal}`);
      if (b.notes) bits.push(b.notes);
      out.push({
        date: b.breedDate || b.bredDate || b.date,
        emoji: "💕", label: "Breeding",
        detail: bits.join(" · "),
        kind: "breeding", source: b, recordId: b.id, sourceKey: "breedings",
      });
    });
  }

  // 4. Archive event (final, if archived)
  // Skip if a matching sale/death entry already covered it to avoid double rows.
  if (animal.archived && animal.archivedDate) {
    const reason = animal.archivedReason || "archived";
    const hasMatchingSale = out.some(e => e.kind === "sale" && e.date === animal.archivedDate);
    const hasMatchingDeath = out.some(e => e.label === "Death" && e.date === animal.archivedDate);
    if (!hasMatchingSale && !hasMatchingDeath) {
      out.push({
        date: animal.archivedDate,
        emoji: "📦",
        label: "Archived",
        detail: reason,
        kind: "archive",
        source: { date: animal.archivedDate, reason },
        recordId: null,
        sourceKey: "archive",  // virtual — not editable/deletable
      });
    }
  }

  return out;
}

// ----------------------------------------------------------------------------
// HistoryDetailModal — full-field view of a single history record with
// edit-notes and delete actions.
//
// Why edit-notes only: building 9 specialized edit forms (one per kind) would
// be a significant project. Notes is the single most-commonly-edited field
// (correcting a typo, adding context to a vet visit, etc.). Other fields are
// read-only — if a user needs to change a date or cost, they can delete and
// re-log. This unblocks the 80% case while keeping scope manageable.
//
// Field rendering: walks the source record and shows each k/v pair with
// human-friendly labels and formatting. Skips fields that are internal
// machinery (id, animalId, created) or already shown in the header.
// ----------------------------------------------------------------------------

// Map a field name to a human-friendly label. Falls back to the raw key
// with first letter capitalized if we don't have a specific override.
const FIELD_LABELS = {
  action: "Type",
  date: "Date",
  weight: "Weight",
  lbs: "Amount (lbs)",
  feedAmount: "Amount",
  feedUnit: "Unit",
  cost: "Cost",
  gallons: "Gallons",
  cause: "Cause",
  buyer: "Buyer",
  price: "Sale price",
  saleType: "Sale type",
  type: "Type",
  vetName: "Veterinarian",
  product: "Product",
  durationMinutes: "Duration (minutes)",
  notes: "Notes",
  note: "Notes",
  woolLbs: "Wool (lbs)",
  woolGrade: "Wool grade",
  count: "Count",
  avgWeight: "Average weight (lbs)",
  method: "Method",
  bredDate: "Breeding date",
  breedDate: "Breeding date",
  expectedBirthDate: "Expected birth date",
  buckName: "Sire name",
  externalSireName: "External sire",
  stallionExternal: "External stallion",
  sireExternal: "External sire",
  kitsAlive: "Kits alive",
  kitsStillborn: "Kits stillborn",
  reason: "Reason",
};

// Fields we always hide — internal machinery or fields rendered in the header.
const HIDDEN_FIELDS = new Set([
  "id", "animalId", "animalName", "horseId", "horseIds",
  "mareId", "stallionId", "damId", "sireId", "buckId",
  "eweId", "ramId", "hobbyType", "created", "archived",
  // Sale: hobby-specific noise
  "hobbyId", "isLegacy",
]);

function HistoryDetailModal({ event, animal, hobby, species, onClose, onSave, onDelete, canEdit }) {
  const [editingNotes, setEditingNotes] = useState(false);
  // Notes field can be stored as either `notes` or `note` depending on the
  // record kind. Find whichever exists and lock onto it for the lifetime of
  // this modal session.
  const noteFieldName = (event.source && "notes" in event.source) ? "notes" :
                        (event.source && "note" in event.source) ? "note" : "notes";
  const [notesDraft, setNotesDraft] = useState((event.source && event.source[noteFieldName]) || "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const fmtFieldValue = (key, val) => {
    if (val == null || val === "") return null;
    if (key === "date" || key === "bredDate" || key === "breedDate" ||
        key === "expectedBirthDate" || key === "archivedDate") {
      return fmtDate(val);
    }
    if (key === "cost" || key === "price") return fmtMoney(val);
    if (typeof val === "boolean") return val ? "Yes" : "No";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  const labelFor = (key) => {
    if (FIELD_LABELS[key]) return FIELD_LABELS[key];
    // Camel-case to "Camel case"
    const spaced = key.replace(/([A-Z])/g, " $1").toLowerCase();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  };

  // Build the list of fields to display.
  // Skip the notes field — it gets its own dedicated section at the bottom
  // (where edit lives) so we don't double-render it.
  const fieldsToShow = [];
  if (event.source && typeof event.source === "object") {
    for (const [key, val] of Object.entries(event.source)) {
      if (HIDDEN_FIELDS.has(key)) continue;
      if (key === noteFieldName) continue;
      const display = fmtFieldValue(key, val);
      if (display == null) continue;
      fieldsToShow.push({ key, label: labelFor(key), value: display });
    }
  }

  // Save notes — only the notes field changes; everything else preserved.
  const handleSaveNotes = () => {
    onSave({ noteFieldName, newValue: notesDraft });
    setEditingNotes(false);
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  const isArchive = event.sourceKey === "archive";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(44,24,16,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 150, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: palette.bg, borderRadius: 16,
          maxWidth: 480, width: "100%", maxHeight: "92vh", overflow: "auto",
          border: `2px solid ${palette.ink}`,
          boxShadow: `6px 8px 0 ${palette.line}`,
          fontFamily: FONT_BODY,
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: `1.5px solid ${palette.line}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>{event.emoji}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink, lineHeight: 1.15 }}>
                {event.label}
              </div>
              <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 1 }}>
                {fmtDate(event.date)}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", color: palette.ink, padding: 4, flexShrink: 0 }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          {isArchive && (
            <div style={{
              padding: "12px 14px", background: palette.bgAlt,
              border: `1.5px solid ${palette.line}`, borderRadius: 10,
              fontSize: 12, color: palette.inkSoft, marginBottom: 12, lineHeight: 1.5,
            }}>
              This is an archive entry, generated automatically from the
              animal's archived state. To remove it, un-archive the animal
              from their card.
            </div>
          )}

          {fieldsToShow.length === 0 && !isArchive && (
            <div style={{
              padding: "20px 14px", textAlign: "center",
              fontSize: 13, color: palette.inkSoft,
              background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 10,
              marginBottom: 12,
            }}>
              No additional details on this record.
            </div>
          )}

          {fieldsToShow.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {fieldsToShow.map(f => (
                <div key={f.key} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                  gap: 10, padding: "8px 12px",
                  background: palette.card,
                  border: `1.5px solid ${palette.line}`,
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: 11, color: palette.inkSoft, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0, paddingTop: 1 }}>
                    {f.label}
                  </span>
                  <span style={{ fontSize: 13, color: palette.ink, textAlign: "right", wordBreak: "break-word", lineHeight: 1.4 }}>
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Notes section — view OR edit */}
          {!isArchive && (
            <div style={{
              padding: 12,
              background: palette.card,
              border: `1.5px solid ${palette.line}`,
              borderRadius: 10,
              marginBottom: 14,
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 8,
              }}>
                <span style={{ fontSize: 11, color: palette.inkSoft, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Notes
                </span>
                {canEdit && !editingNotes && (
                  <button
                    onClick={() => setEditingNotes(true)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: palette.feather, fontSize: 12, fontWeight: 600,
                      display: "flex", alignItems: "center", gap: 4,
                      padding: 2,
                    }}
                  >
                    <Edit3 size={13} /> Edit
                  </button>
                )}
              </div>
              {editingNotes ? (
                <>
                  <textarea
                    value={notesDraft}
                    onChange={e => setNotesDraft(e.target.value)}
                    rows={3}
                    style={{
                      width: "100%", padding: 8, borderRadius: 6,
                      border: `1.5px solid ${palette.line}`,
                      fontFamily: FONT_BODY, fontSize: 13,
                      background: palette.bg, color: palette.ink,
                      resize: "vertical", boxSizing: "border-box",
                    }}
                    placeholder="Add notes..."
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => {
                        setNotesDraft((event.source && event.source[noteFieldName]) || "");
                        setEditingNotes(false);
                      }}
                      style={{
                        padding: "6px 12px", borderRadius: 6,
                        border: `1.5px solid ${palette.line}`,
                        background: palette.bg, color: palette.ink,
                        fontFamily: FONT_BODY, fontWeight: 600, fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveNotes}
                      style={{
                        padding: "6px 12px", borderRadius: 6, border: "none",
                        background: palette.ink, color: palette.bg,
                        fontFamily: FONT_BODY, fontWeight: 600, fontSize: 12,
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <Save size={13} /> Save
                    </button>
                  </div>
                </>
              ) : (
                <div style={{
                  fontSize: 13, color: notesDraft ? palette.ink : palette.inkSoft,
                  fontStyle: notesDraft ? "normal" : "italic",
                  lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {notesDraft || "No notes."}
                </div>
              )}
            </div>
          )}

          {/* Delete section */}
          {canEdit && !isArchive && (
            confirmingDelete ? (
              <div style={{
                padding: 12,
                background: palette.accent + "15",
                border: `1.5px solid ${palette.accent}`,
                borderRadius: 10,
              }}>
                <div style={{ fontSize: 13, color: palette.accent, fontWeight: 600, marginBottom: 8 }}>
                  Delete this {event.label.toLowerCase()} record?
                </div>
                <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 10, lineHeight: 1.4 }}>
                  This can't be undone. The record will be removed from {animal.name}'s history.
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    style={{
                      padding: "6px 12px", borderRadius: 6,
                      border: `1.5px solid ${palette.line}`,
                      background: palette.bg, color: palette.ink,
                      fontFamily: FONT_BODY, fontWeight: 600, fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    style={{
                      padding: "6px 12px", borderRadius: 6, border: "none",
                      background: palette.accent, color: "#FFFFFF",
                      fontFamily: FONT_BODY, fontWeight: 600, fontSize: 12,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8,
                  border: `1.5px solid ${palette.accent}`,
                  background: "transparent", color: palette.accent,
                  fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                <Trash2 size={14} /> Delete this record
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Modal shell — mirrors PedigreeView's contract: self-contained, takes onClose.
// Now also takes `update` for edit/delete capability. If update is missing
// (older callers), the detail modal opens in read-only mode.
// ----------------------------------------------------------------------------
export function AnimalHistoryView({ animal, hobby, entries, sales, species, update, onClose }) {
  // The selected event is what's shown in the detail modal. Re-collected
  // every render so it stays in sync after edits/deletes.
  const [selectedEvent, setSelectedEvent] = useState(null);

  const events = collectEvents({ animal, hobby, entries: entries || [], sales: sales || [], species })
    .slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // After an edit or delete, find the corresponding "fresh" event from the
  // re-collected list (the source data has changed). If it's gone (deleted),
  // selectedEvent stays null and the detail modal closes.
  React.useEffect(() => {
    if (!selectedEvent) return;
    const stillExists = events.find(e =>
      e.sourceKey === selectedEvent.sourceKey &&
      e.recordId === selectedEvent.recordId
    );
    if (!stillExists) {
      setSelectedEvent(null);
    } else if (stillExists !== selectedEvent) {
      setSelectedEvent(stillExists);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length, JSON.stringify(events.map(e => e.recordId + ":" + (e.source?.notes || e.source?.note || "")))]);

  // Generic save handler — updates the source record's notes field in place
  // and lets sync flow handle persistence. Handles all sourceKey variants.
  const handleSaveNotes = ({ noteFieldName, newValue }) => {
    if (!update || !selectedEvent) return;
    const { sourceKey, recordId } = selectedEvent;
    update(d => {
      // Find the hobby on the data
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (sourceKey === "entry") {
        // Per-animal entries live in data.entries[hobbyId]
        const arr = d.entries?.[hobby.id];
        if (!Array.isArray(arr)) return d;
        const idx = arr.findIndex(e => e.id === recordId);
        if (idx === -1) return d;
        arr[idx] = { ...arr[idx], [noteFieldName]: newValue };
      } else if (sourceKey === "sale") {
        // Sales live in data.sales (global)
        const arr = d.sales;
        if (!Array.isArray(arr)) return d;
        const idx = arr.findIndex(s => s.id === recordId);
        if (idx === -1) return d;
        arr[idx] = { ...arr[idx], [noteFieldName]: newValue };
      } else if (h && Array.isArray(h[sourceKey])) {
        // Hobby-scoped collections: vet, farrier, deworming, rides, shearings, breedings
        const idx = h[sourceKey].findIndex(r => r.id === recordId);
        if (idx === -1) return d;
        h[sourceKey][idx] = { ...h[sourceKey][idx], [noteFieldName]: newValue };
      }
      return d;
    });
  };

  // Generic delete handler — removes the source record from wherever it lives.
  const handleDelete = () => {
    if (!update || !selectedEvent) return;
    const { sourceKey, recordId } = selectedEvent;
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (sourceKey === "entry") {
        const arr = d.entries?.[hobby.id];
        if (!Array.isArray(arr)) return d;
        d.entries[hobby.id] = arr.filter(e => e.id !== recordId);
      } else if (sourceKey === "sale") {
        if (!Array.isArray(d.sales)) return d;
        d.sales = d.sales.filter(s => s.id !== recordId);
      } else if (h && Array.isArray(h[sourceKey])) {
        h[sourceKey] = h[sourceKey].filter(r => r.id !== recordId);
      }
      return d;
    });
  };

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
        onClick={e => e.stopPropagation()}
        style={{
          background: palette.bg, borderRadius: 16,
          maxWidth: 520, width: "100%", maxHeight: "92vh", overflow: "auto",
          border: `2px solid ${palette.ink}`,
          boxShadow: `6px 8px 0 ${palette.line}`,
          fontFamily: FONT_BODY,
        }}
      >
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: `1.5px solid ${palette.line}`,
        }}>
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.ink, lineHeight: 1.1 }}>
              📜 {animal.name}'s history
            </div>
            <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 2 }}>
              {events.length} event{events.length === 1 ? "" : "s"} logged · tap any to see details
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", color: palette.ink, padding: 4 }}
          >
            <X size={22} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {events.length === 0 ? (
            <div style={{
              padding: "30px 16px", textAlign: "center",
              fontSize: 13, color: palette.inkSoft,
              background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12,
            }}>
              No history yet. Log an action on this animal to see it appear here.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {events.map((e, i) => (
                <button
                  key={`${e.sourceKey}-${e.recordId || i}`}
                  onClick={() => setSelectedEvent(e)}
                  style={{
                    background: palette.card,
                    border: `1.5px solid ${palette.line}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    display: "flex", gap: 10, alignItems: "flex-start",
                    width: "100%", textAlign: "left",
                    fontFamily: FONT_BODY,
                    cursor: "pointer",
                    color: palette.ink,
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{e.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: palette.ink }}>{e.label}</span>
                      <span style={{ fontSize: 11, color: palette.inkSoft, flexShrink: 0 }}>{fmtDate(e.date)}</span>
                    </div>
                    {e.detail && (
                      <div style={{ fontSize: 12, color: palette.inkSoft, lineHeight: 1.4, wordBreak: "break-word" }}>
                        {e.detail}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedEvent && (
        <HistoryDetailModal
          event={selectedEvent}
          animal={animal}
          hobby={hobby}
          species={species}
          canEdit={!!update}
          onClose={() => setSelectedEvent(null)}
          onSave={handleSaveNotes}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

export default AnimalHistoryView;
