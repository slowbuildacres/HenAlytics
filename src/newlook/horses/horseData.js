// ============================================================================
// Horses (3.0) — pure helpers for the new horse screens
// ----------------------------------------------------------------------------
// Same records as the old horse page: hobby.animals (sex mare / stallion /
// gelding / foal, birthdate), hobby.rides (horseId, date, durationMinutes,
// type), hobby.farrier / vet / deworming (horseIds or legacy horseId, date,
// type, product, cost), hobby.breedings (mareId, stallionId, bredDate,
// expectedFoalDate, foaledDate, foalsBorn) and feed / death entries.
// ============================================================================

import { isoDay, parseDay, prettyDay, DAY } from "../eggs/eggFacts.js";

export const FARRIER_WEEKS = 6;  // most horses are trimmed every 6–8 weeks
export const daysFrom = (a, b) => Math.round((parseDay(b) - parseDay(a)) / DAY);
const addDays = (s, n) => isoDay(new Date(parseDay(s).getTime() + n * DAY));
export const liveHorses = (hobby) => ((hobby && hobby.animals) || []).filter((a) => a && !a.archived);
export const careIds = (r) => (Array.isArray(r && r.horseIds) && r.horseIds.length ? r.horseIds : r && r.horseId ? [r.horseId] : []);
const desc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

export const CARE = [
  { kind: "farrier", label: "Farrier", detail: (r) => r.type || "Visit" },
  { kind: "vet", label: "Vet", detail: (r) => [r.type, r.vetName].filter(Boolean).join(" · ") || "Visit" },
  { kind: "deworming", label: "Dewormer", detail: (r) => r.product || "Dose" },
];
export const SEX_LABEL = { mare: "Mares", stallion: "Stallions", gelding: "Geldings", foal: "Foals" };

export function careFor(hobby, kind, id) {
  return ((hobby && hobby[kind]) || []).filter((r) => r && r.date && (!id || careIds(r).includes(id))).sort(desc);
}
export function ridesFor(hobby, id) {
  return ((hobby && hobby.rides) || []).filter((r) => r && r.date && (!id || r.horseId === id)).sort(desc);
}

// Farrier due per horse: last visit + 6 weeks.
export function farrierDue(hobby, today = isoDay()) {
  return liveHorses(hobby).filter((h) => h.sex !== "foal").map((h) => {
    const last = careFor(hobby, "farrier", h.id)[0];
    if (!last) return { horse: h, last: null, due: null, left: null };
    const due = addDays(last.date, FARRIER_WEEKS * 7);
    return { horse: h, last, due, left: daysFrom(today, due) };
  });
}

export function openFoaling(hobby, mareId, today = isoDay()) {
  return ((hobby && hobby.breedings) || [])
    .filter((b) => b && !b.foaledDate && b.expectedFoalDate && (!mareId || b.mareId === mareId) && b.expectedFoalDate >= addDays(today, -21))
    .sort((a, b) => (a.expectedFoalDate < b.expectedFoalDate ? -1 : 1));
}

export function horseStatus(hobby, h, today = isoDay()) {
  const f = openFoaling(hobby, h.id, today)[0];
  if (f) return { tone: "ready", text: `Foal due ${prettyDay(f.expectedFoalDate)}` };
  if (h.sex !== "foal") {
    const fd = farrierDue(hobby, today).find((x) => x.horse.id === h.id);
    if (fd && fd.left != null && fd.left < 0) return { tone: "alert", text: "Farrier overdue" };
    if (fd && fd.left != null && fd.left <= 7) return { tone: "ready", text: "Farrier this week" };
  }
  const r = ridesFor(hobby, h.id)[0];
  if (r && daysFrom(r.date, today) <= 3) return { tone: "good", text: daysFrom(r.date, today) === 0 ? "Ridden today" : `Ridden ${prettyDay(r.date)}` };
  return null;
}

export function ageText(dob, today = isoDay()) {
  if (!dob) return "";
  const n = daysFrom(dob, today);
  if (n < 0) return "";
  const months = Math.floor(n / 30.44);
  if (months < 12) return `${months} mo`;
  const y = Math.floor(months / 12);
  return `${y} yr${y === 1 ? "" : "s"}`;
}

export function rideTotals(hobby, start, end, id = null) {
  const rides = ridesFor(hobby, id).filter((r) => (!start || r.date >= start) && r.date <= end);
  const minutes = rides.reduce((s, r) => s + (Number(r.durationMinutes) || 0), 0);
  return { count: rides.length, minutes, rides };
}

export function careCost(hobby, start, end) {
  let t = 0;
  for (const c of CARE) for (const r of careFor(hobby, c.kind)) if ((!start || r.date >= start) && r.date <= end) t += Number(r.cost) || 0;
  return t;
}

export const hoursText = (min) => (min >= 60 ? `${(min / 60).toFixed(min >= 600 ? 0 : 1)} hr` : `${Math.round(min)} min`);
