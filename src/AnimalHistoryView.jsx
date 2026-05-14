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
//
// Usage: any species page does
//   <AnimalHistoryView
//     animal={animal}
//     hobby={hobby}
//     entries={entries}              // already-scoped entries for this hobby
//     sales={data.sales || []}
//     species="cow"                  // controls emoji + which extras to read
//     onClose={() => setShowHistory(false)}
//   />
// The component is the modal shell itself (mirrors PedigreeView's contract).
// ============================================================================

import React from "react";
import { X } from "lucide-react";

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
  if (e.action === "note" && e.note) bits.push(e.note);
  if (e.action === "health" && e.note) bits.push(e.note);
  return bits.join(" · ");
};

// ----------------------------------------------------------------------------
// Collect every event tied to this animal from every source available on the
// hobby. Returns a flat list of { date, emoji, label, detail, kind } objects.
// Sort happens at render time.
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
      out.push({ date: v.date, emoji: "🩺", label: "Vet", detail: bits.join(" · "), kind: "vet" });
    });
    (hobby.farrier || []).filter(includesAnimal).forEach(f => {
      const bits = [];
      if (f.type) bits.push(f.type);
      if (f.cost > 0) bits.push(fmtMoney(f.cost));
      if (Array.isArray(f.horseIds) && f.horseIds.length > 1) bits.push(`+ ${f.horseIds.length - 1} more`);
      if (f.notes) bits.push(f.notes);
      out.push({ date: f.date, emoji: "🔨", label: "Farrier", detail: bits.join(" · "), kind: "farrier" });
    });
    (hobby.deworming || []).filter(includesAnimal).forEach(d => {
      const bits = [];
      if (d.product) bits.push(d.product);
      if (d.cost > 0) bits.push(fmtMoney(d.cost));
      if (Array.isArray(d.horseIds) && d.horseIds.length > 1) bits.push(`+ ${d.horseIds.length - 1} more`);
      if (d.notes) bits.push(d.notes);
      out.push({ date: d.date, emoji: "💊", label: "Dewormer", detail: bits.join(" · "), kind: "dewormer" });
    });
    (hobby.rides || []).filter(r => r.horseId === animalId).forEach(r => {
      const bits = [];
      if (r.type) bits.push(r.type);
      if (r.durationMinutes) bits.push(`${r.durationMinutes} min`);
      if (r.notes) bits.push(r.notes);
      out.push({ date: r.date, emoji: "🐴", label: "Ride", detail: bits.join(" · "), kind: "ride" });
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
        emoji: "💕",
        label: "Breeding",
        detail: bits.join(" · "),
        kind: "breeding",
      });
    });
  }

  if (species === "sheep") {
    (hobby.shearings || []).filter(s => s.animalId === animalId).forEach(s => {
      const bits = [];
      if (s.woolLbs) bits.push(`${s.woolLbs} lbs wool`);
      if (s.woolGrade) bits.push(s.woolGrade);
      if (s.notes) bits.push(s.notes);
      out.push({ date: s.date, emoji: "✂️", label: "Shearing", detail: bits.join(" · "), kind: "shearing" });
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
        emoji: "💕",
        label: "Breeding",
        detail: bits.join(" · "),
        kind: "breeding",
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
        emoji: "💕",
        label: "Breeding",
        detail: bits.join(" · "),
        kind: "breeding",
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
        emoji: "💕",
        label: "Breeding",
        detail: bits.join(" · "),
        kind: "breeding",
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
      });
    }
  }

  return out;
}

// ----------------------------------------------------------------------------
// Modal shell — mirrors PedigreeView's contract: self-contained, takes onClose.
// ----------------------------------------------------------------------------
export function AnimalHistoryView({ animal, hobby, entries, sales, species, onClose }) {
  const events = collectEvents({ animal, hobby, entries: entries || [], sales: sales || [], species })
    .slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

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
              {events.length} event{events.length === 1 ? "" : "s"} logged
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
                <div
                  key={i}
                  style={{
                    background: palette.card,
                    border: `1.5px solid ${palette.line}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    display: "flex", gap: 10, alignItems: "flex-start",
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AnimalHistoryView;
