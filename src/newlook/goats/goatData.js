// ============================================================================
// Goats (3.0) — pure helpers for the new goat screens
// ----------------------------------------------------------------------------
// Reads the same records the old goat page and GoatsAnalytics use:
// hobby.animals (sex, purpose, dob, sireId, damId), hobby.breedings (damId,
// breedDate, expectedBirthDate, birthedDate, offspringBorn) and goat entries
// (milk {oz}, kid {count}, fed {lbs, cost}, weight {weight}, health, note).
// Milk totals are oz / 128 gallons, exactly like GoatsAnalytics.
// ============================================================================

import { isoDay, parseDay, prettyDay, DAY, costRows } from "../eggs/eggFacts.js";
import { fmtVolume, volumeUnitLabel } from "../../units.js";

export const GESTATION = 150;

// Milk as people log it: ounces under a gallon, then gallons (metric: L/mL).
export function milkText(o) {
  const v = Number(o) || 0;
  if (volumeUnitLabel() === "L" || v >= 128) return fmtVolume(v / 128);
  return `${Math.round(v)} oz`;
}
const addDays = (s, n) => isoDay(new Date(parseDay(s).getTime() + n * DAY));
export const daysFrom = (a, b) => Math.round((parseDay(b) - parseDay(a)) / DAY);

export const liveGoats = (hobby) => ((hobby && hobby.animals) || []).filter((a) => a && !a.archived);
export const isDairy = (a) => a && (a.purpose === "Dairy" || a.purpose === "Both");
const oz = (e) => Number(e.oz) || 0;

// Does that can be milked: dairy-purpose does (or every live goat when no
// purposes are set yet, the same rule as the old Milk tile).
export function milkingDoes(hobby) {
  const live = liveGoats(hobby);
  const anyPurpose = live.some((a) => a.purpose);
  const pool = anyPurpose ? live.filter(isDairy) : live;
  const does = pool.filter((a) => a.sex === "Doe");
  return does.length ? does : pool.filter((a) => a.sex !== "Buck" && a.sex !== "Wether");
}
export function showsMilk(hobby) {
  const live = liveGoats(hobby);
  return !live.some((a) => a.purpose) || live.some(isDairy);
}

export function milkOz(entries, { animalId, from, to } = {}) {
  let t = 0;
  for (const e of entries || []) {
    if (!e || e.action !== "milk") continue;
    if (animalId && e.animalId !== animalId) continue;
    if (from && e.date < from) continue;
    if (to && e.date > to) continue;
    t += oz(e);
  }
  return t;
}

// Last kidding for a doe from breedings (birthedDate) and kid entries.
export function lastKidding(hobby, entries, id) {
  const marks = [];
  for (const b of (hobby.breedings || [])) if (b && b.damId === id && b.birthedDate) marks.push({ date: b.birthedDate, count: Number(b.offspringBorn) || null, sireId: b.sireId, externalSireName: b.externalSireName });
  for (const e of entries || []) if (e && e.action === "kid" && e.animalId === id && e.date) marks.push({ date: e.date, count: Number(e.count) || 1 });
  marks.sort((a, b) => (a.date < b.date ? 1 : -1));
  return marks[0] || null;
}

// The doe's open breeding (no birth recorded yet), if any.
export function openBreeding(hobby, id, today = isoDay()) {
  return (hobby.breedings || [])
    .filter((b) => b && b.damId === id && !b.birthedDate && b.expectedBirthDate && b.expectedBirthDate >= addDays(today, -21))
    .sort((a, b) => (a.expectedBirthDate < b.expectedBirthDate ? -1 : 1))[0] || null;
}

// One status badge per goat: due to kid, in milk (day N of lactation), dry.
export function goatStatus(hobby, entries, a, today = isoDay()) {
  const due = openBreeding(hobby, a.id, today);
  if (due) {
    const left = daysFrom(today, due.expectedBirthDate);
    return { tone: "ready", text: left < 0 ? `Overdue · was ${prettyDay(due.expectedBirthDate)}` : left <= 14 ? `Due in ${left} day${left === 1 ? "" : "s"}` : `Due ${prettyDay(due.expectedBirthDate)}` };
  }
  const milks = (entries || []).filter((e) => e && e.action === "milk" && e.animalId === a.id && e.date);
  if (milks.length) {
    const last = milks.reduce((m, e) => (e.date > m ? e.date : m), "");
    if (daysFrom(last, today) <= 10) {
      const k = lastKidding(hobby, entries, a.id);
      return { tone: "good", text: k ? `In milk · day ${daysFrom(k.date, today) + 1}` : "In milk" };
    }
    return { tone: "quiet", text: "Dry" };
  }
  return null;
}

export function ageText(dob, today = isoDay()) {
  if (!dob) return "";
  const n = daysFrom(dob, today);
  if (n < 0) return "";
  if (n < 70) return n < 14 ? `${n} day${n === 1 ? "" : "s"}` : `${Math.floor(n / 7)} weeks`;
  const months = Math.floor(n / 30.44);
  if (months < 12) return `${months} mo`;
  const y = Math.floor(months / 12), m = months % 12;
  return `${y} yr${y === 1 ? "" : "s"}${m ? ` ${m} mo` : ""}`;
}

export const SEX_GROUPS = [
  { key: "Doe", label: "Does" },
  { key: "Buck", label: "Bucks" },
  { key: "Wether", label: "Wethers" },
  { key: "Kid", label: "Kids" },
];

// Upcoming kiddings across the herd: [{ breeding, dam, day, of }].
export function upcomingKiddings(hobby, today = isoDay(), limit = 3) {
  const animals = (hobby.animals || []);
  return (hobby.breedings || [])
    .filter((b) => b && !b.birthedDate && b.expectedBirthDate && b.expectedBirthDate >= addDays(today, -21))
    .sort((a, b) => (a.expectedBirthDate < b.expectedBirthDate ? -1 : 1))
    .slice(0, limit)
    .map((b) => {
      const of = b.breedDate ? Math.max(1, daysFrom(b.breedDate, b.expectedBirthDate)) : GESTATION;
      const day = b.breedDate ? Math.max(0, Math.min(of, daysFrom(b.breedDate, today))) : null;
      return { breeding: b, dam: animals.find((a) => a.id === b.damId) || null, day, of, left: daysFrom(today, b.expectedBirthDate) };
    });
}

// Kidding history, newest first: breedings with a birth plus loose kid entries.
export function kiddingHistory(hobby, entries) {
  const animals = hobby.animals || [];
  const name = (id) => (animals.find((a) => a.id === id) || {}).name;
  const rows = [];
  const seen = new Set();
  for (const b of (hobby.breedings || [])) {
    if (!b || !b.birthedDate) continue;
    seen.add(`${b.damId}|${b.birthedDate}`);
    const sire = name(b.sireId) || b.externalSireName || null;
    const n = Number(b.offspringBorn) || 0;
    rows.push({ id: b.id, breeding: b, date: b.birthedDate, dam: name(b.damId) || "Doe", sub: [n ? `${n} kid${n === 1 ? "" : "s"}` : null, sire ? `sire ${sire}` : null].filter(Boolean).join(" · ") });
  }
  for (const e of entries || []) {
    if (!e || e.action !== "kid" || seen.has(`${e.animalId}|${e.date}`)) continue;
    const n = Number(e.count) || 1;
    rows.push({ id: e.id, date: e.date, dam: e.animalName || name(e.animalId) || "Doe", sub: `${n} kid${n === 1 ? "" : "s"}${e.notes ? ` · ${e.notes}` : ""}` });
  }
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function latest(entries, action, id) {
  return (entries || []).filter((e) => e && (!action || e.action === action) && (!id || e.animalId === id || (Array.isArray(e.animalIds) && e.animalIds.includes(id))))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.created || 0) - (a.created || 0)));
}

// Milk by month for the last n months: [{ key, label, oz }].
export function milkByMonth(entries, today = isoDay(), n = 6) {
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const t = parseDay(today);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(t.getFullYear(), t.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ key, label: MON[d.getMonth()], oz: 0 });
  }
  const idx = new Map(out.map((m, i) => [m.key, i]));
  for (const e of entries || []) if (e && e.action === "milk" && e.date && idx.has(e.date.slice(0, 7))) out[idx.get(e.date.slice(0, 7))].oz += oz(e);
  return out;
}

// Ranges for the Stats chips.
export function goatRange(key, today = isoDay()) {
  if (key === "30d") return { key, label: "30 days", start: addDays(today, -29), end: today, prior: { start: addDays(today, -59), end: addDays(today, -30) } };
  if (key === "year") { const y = Number(today.slice(0, 4)); return { key, label: String(y), start: `${y}-01-01`, end: today, prior: { start: `${y - 1}-01-01`, end: `${y - 1}${today.slice(4)}` } }; }
  return { key: "all", label: "All time", start: null, end: today, prior: null };
}

export function goatSummary(data, hobby, r) {
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const inR = (e) => e && e.date && (!r.start || e.date >= r.start) && e.date <= r.end;
  const milk = milkOz(entries.filter(inR));
  const priorMilk = r.prior ? milkOz(entries, { from: r.prior.start, to: r.prior.end }) : null;
  const kids = entries.filter((e) => inR(e) && e.action === "kid").reduce((s, e) => s + (Number(e.count) || 1), 0);
  // Same cost rows the egg page uses: feed/bedding costs on logs + expenses.
  const cost = costRows(data, hobby, r.end).filter(inR).reduce((s, c) => s + c.amount, 0);
  const gal = milk / 128;
  return {
    milkOz: milk, gal, kids, cost,
    delta: priorMilk ? (milk - priorMilk) / priorMilk : null,
    perGal: gal >= 1 && cost > 0 ? cost / gal : null,
  };
}

export function milkByDoe(entries, hobby, r) {
  const t = new Map();
  for (const e of entries || []) {
    if (!e || e.action !== "milk" || !e.date || (r.start && e.date < r.start) || e.date > r.end) continue;
    const k = e.animalId || e.animalName || "?";
    const g = t.get(k) || { id: e.animalId, name: e.animalName || ((hobby.animals || []).find((a) => a.id === e.animalId) || {}).name || "Unknown", oz: 0 };
    g.oz += oz(e);
    t.set(k, g);
  }
  return [...t.values()].sort((a, b) => b.oz - a.oz);
}

export function goatFunFacts({ data, hobby, range, today = isoDay(), milkPrice = 0 }) {
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const inR = (e) => e && e.date && (!range.start || e.date >= range.start) && e.date <= range.end;
  const facts = [];
  const total = milkOz(entries.filter(inR));
  if (total >= 64) {
    const glasses = Math.round(total / 8);
    facts.push({ key: "glasses", icon: "milk", big: glasses.toLocaleString("en-US"), line: "glasses of milk from our goats",
      title: `That's ${glasses.toLocaleString("en-US")} glasses of milk`, sub: "At 8 oz a glass." });
  }
  if (total >= 128 && milkPrice > 0) {
    const v = (total / 128) * milkPrice;
    facts.push({ key: "worth", icon: "money", big: `$${Math.round(v).toLocaleString("en-US")}`, line: "of milk, at store prices",
      title: `Worth about $${Math.round(v).toLocaleString("en-US")} at the store`, sub: `At $${milkPrice.toFixed(2)} a gallon.` });
  }
  const does = milkByDoe(entries, hobby, range);
  if (does.length > 1 && does[0].oz > 0) {
    facts.push({ key: "topdoe", icon: "trophy", big: does[0].name, line: "our top milker",
      title: `${does[0].name} is your top milker`, sub: `${(does[0].oz / 128).toFixed(1)} gallons, ${Math.round((does[0].oz / total) * 100)}% of the herd's milk.` });
  }
  const byDay = new Map();
  for (const e of entries) if (inR(e) && e.action === "milk") byDay.set(e.date, (byDay.get(e.date) || 0) + oz(e));
  if (byDay.size >= 5) {
    const [d, v] = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
    facts.push({ key: "bestday", icon: "calendar", big: `${(v / 128).toFixed(1)} gal`, line: `our best milking day, ${prettyDay(d)}`,
      title: `Best day: ${(v / 128).toFixed(1)} gal on ${prettyDay(d)}`, sub: `Your biggest milking day${range.start ? " in this range" : ""}.` });
  }
  const kids = entries.filter((e) => inR(e) && e.action === "kid").reduce((s, e) => s + (Number(e.count) || 1), 0);
  if (kids >= 2) facts.push({ key: "kids", icon: "kid", big: String(kids), line: "kids born on our homestead",
    title: `${kids} kids born`, sub: kids >= 6 ? "That's a lot of bottle feeding." : "Welcome to the herd." });
  return facts;
}
