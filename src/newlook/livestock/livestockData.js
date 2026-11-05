// ============================================================================
// Livestock (3.0) — goats and cattle share one set of screens
// ----------------------------------------------------------------------------
// Both hobbies keep the same records: hobby.animals (sex, purpose, dob,
// sireId, damId, pastureId), hobby.breedings (damId, sireId, breedDate,
// expectedBirthDate, birthedDate, offspringBorn) and entries (milk, a birth
// action, fed, weight, health, note …). A SPECIES entry says what differs:
// the words, which sexes give birth, the gestation, the birth action, how
// milk was stored (goats: oz; cattle: gallons, or oz on newer logs).
// Milk is always handled here in ounces (gallons × 128), so totals match
// GoatsAnalytics / CowsAnalytics.
// ============================================================================

import { isoDay, parseDay, prettyDay, DAY, costRows } from "../eggs/eggFacts.js";
import { fmtVolume, volumeUnitLabel } from "../../units.js";

export const SPECIES = {
  goats: {
    key: "goats", noun: "goat", plural: "goats", Noun: "Goats", emoji: "🐐",
    female: ["Doe"], male: ["Buck"], notBreeding: ["Wether"],
    groups: [{ key: "Doe", label: "Does" }, { key: "Buck", label: "Bucks" }, { key: "Wether", label: "Wethers" }, { key: "Kid", label: "Kids" }],
    sexWord: { Doe: "doe", Buck: "buck", Wether: "wether", Kid: "kid" },
    she: "doe", shePlural: "does", sire: "buck",
    birthAction: "kid", young: "kid", youngPlural: "kids", birthNoun: "kidding", birthLabel: "Kidding", born: "kidded", dueVerb: "due to kid",
    gestation: 150, milkOz: (e) => Number(e.oz) || 0,
    tally: ["Doe", "Buck", "Wether", "Kid", "Unsexed"],
  },
  cows: {
    key: "cows", noun: "cow", plural: "cattle", Noun: "Cattle", emoji: "🐄",
    female: ["Cow", "Heifer"], male: ["Bull"], notBreeding: ["Steer"],
    groups: [{ key: "Cow", label: "Cows" }, { key: "Heifer", label: "Heifers" }, { key: "Bull", label: "Bulls" }, { key: "Steer", label: "Steers" }, { key: "Calf", label: "Calves" }],
    sexWord: { Cow: "cow", Heifer: "heifer", Bull: "bull", Steer: "steer", Calf: "calf" },
    she: "cow", shePlural: "cows", sire: "bull",
    birthAction: "calf", young: "calf", youngPlural: "calves", birthNoun: "calving", birthLabel: "Calving", born: "calved", dueVerb: "due to calve",
    gestation: 283, milkOz: (e) => (e.oz != null ? Number(e.oz) || 0 : (Number(e.gallons) || 0) * 128),
    tally: ["Cow", "Bull", "Steer", "Heifer", "Calf"],
    // Extra breeding logs cattle people keep.
    extraLogs: [{ key: "heat", label: "Heat" }, { key: "ai", label: "AI" }, { key: "preg_test", label: "Preg check" }],
    groupBy: "pasture",
  },
};

// Milk as people log it: ounces under a gallon, then gallons (metric: L/mL).
export function milkText(o) {
  const v = Number(o) || 0;
  if (volumeUnitLabel() === "L" || v >= 128) return fmtVolume(v / 128);
  return `${Math.round(v)} oz`;
}
const addDays = (s, n) => isoDay(new Date(parseDay(s).getTime() + n * DAY));
export const daysFrom = (a, b) => Math.round((parseDay(b) - parseDay(a)) / DAY);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const liveAnimals = (hobby) => ((hobby && hobby.animals) || []).filter((a) => a && !a.archived);
export const isDairy = (a) => a && (a.purpose === "Dairy" || a.purpose === "Both");
export const isFemale = (sp, a) => !!a && sp.female.includes(a.sex);

// Animals that can be milked: dairy-purpose females (every live animal when
// no purposes are set yet — the same rule as the old Milk tile).
export function milkers(sp, hobby) {
  const live = liveAnimals(hobby);
  const pool = live.some((a) => a.purpose) ? live.filter(isDairy) : live;
  const females = pool.filter((a) => isFemale(sp, a));
  return females.length ? females : pool.filter((a) => !sp.male.includes(a.sex) && !sp.notBreeding.includes(a.sex));
}
export function showsMilk(hobby) {
  const live = liveAnimals(hobby);
  return !live.some((a) => a.purpose) || live.some(isDairy);
}

export function milkOz(sp, entries, { animalId, from, to } = {}) {
  let t = 0;
  for (const e of entries || []) {
    if (!e || e.action !== "milk") continue;
    if (animalId && e.animalId !== animalId) continue;
    if (from && e.date < from) continue;
    if (to && e.date > to) continue;
    t += sp.milkOz(e);
  }
  return t;
}

// Last birth for a female from breedings (birthedDate) and birth entries.
export function lastBirth(sp, hobby, entries, id) {
  const marks = [];
  for (const b of (hobby.breedings || [])) if (b && b.damId === id && b.birthedDate) marks.push({ date: b.birthedDate, count: Number(b.offspringBorn) || null });
  for (const e of entries || []) if (e && e.action === sp.birthAction && e.animalId === id && e.date) marks.push({ date: e.date, count: Number(e.count) || 1 });
  marks.sort((a, b) => (a.date < b.date ? 1 : -1));
  return marks[0] || null;
}

// The female's open breeding (no birth recorded yet), if any.
export function openBreeding(hobby, id, today = isoDay()) {
  return (hobby.breedings || [])
    .filter((b) => b && b.damId === id && !b.birthedDate && b.expectedBirthDate && b.expectedBirthDate >= addDays(today, -21))
    .sort((a, b) => (a.expectedBirthDate < b.expectedBirthDate ? -1 : 1))[0] || null;
}

// One status badge per animal: due, in milk (day N of lactation), dry, open.
export function animalStatus(sp, hobby, entries, a, today = isoDay()) {
  const due = openBreeding(hobby, a.id, today);
  if (due) {
    const left = daysFrom(today, due.expectedBirthDate);
    return { tone: "ready", text: left < 0 ? `Overdue · was ${prettyDay(due.expectedBirthDate)}` : left <= 14 ? `Due in ${plural(left, "day", "days")}` : `Due ${prettyDay(due.expectedBirthDate)}` };
  }
  const milks = (entries || []).filter((e) => e && e.action === "milk" && e.animalId === a.id && e.date);
  if (milks.length) {
    const last = milks.reduce((m, e) => (e.date > m ? e.date : m), "");
    if (daysFrom(last, today) <= 10) {
      const k = lastBirth(sp, hobby, entries, a.id);
      return { tone: "good", text: k ? `In milk · day ${daysFrom(k.date, today) + 1}` : "In milk" };
    }
    return { tone: "quiet", text: "Dry" };
  }
  // Cattle: a positive pregnancy check with no breeding record.
  const preg = latest(entries, "preg_test", a.id)[0];
  if (preg && /pos|bred|preg/i.test(String(preg.pregResult || preg.result || "")) && daysFrom(preg.date, today) < sp.gestation) return { tone: "ready", text: "Bred" };
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

// Births coming up across the herd: [{ breeding, dam, day, of, left }].
export function upcomingBirths(sp, hobby, today = isoDay(), limit = 3) {
  const animals = (hobby.animals || []);
  return (hobby.breedings || [])
    .filter((b) => b && !b.birthedDate && b.expectedBirthDate && b.expectedBirthDate >= addDays(today, -21))
    .sort((a, b) => (a.expectedBirthDate < b.expectedBirthDate ? -1 : 1))
    .slice(0, limit)
    .map((b) => {
      const of = b.breedDate ? Math.max(1, daysFrom(b.breedDate, b.expectedBirthDate)) : sp.gestation;
      const day = b.breedDate ? Math.max(0, Math.min(of, daysFrom(b.breedDate, today))) : null;
      return { breeding: b, dam: animals.find((a) => a.id === b.damId) || null, day, of, left: daysFrom(today, b.expectedBirthDate) };
    });
}

// Birth history, newest first: breedings with a birth plus loose birth logs.
export function birthHistory(sp, hobby, entries) {
  const animals = hobby.animals || [];
  const name = (id) => (animals.find((a) => a.id === id) || {}).name;
  const rows = [];
  const seen = new Set();
  for (const b of (hobby.breedings || [])) {
    if (!b || !b.birthedDate) continue;
    seen.add(`${b.damId}|${b.birthedDate}`);
    const sire = name(b.sireId) || b.externalSireName || null;
    const n = Number(b.offspringBorn) || 0;
    rows.push({ id: b.id, breeding: b, damId: b.damId, count: n, date: b.birthedDate, dam: name(b.damId) || sp.she, sub: [n ? plural(n, sp.young, sp.youngPlural) : null, sire ? `sire ${sire}` : null].filter(Boolean).join(" · ") });
  }
  for (const e of entries || []) {
    if (!e || e.action !== sp.birthAction || seen.has(`${e.animalId}|${e.date}`)) continue;
    const n = Number(e.count) || 1;
    rows.push({ id: e.id, damId: e.animalId, count: n, date: e.date, dam: e.animalName || name(e.animalId) || sp.she, sub: `${plural(n, sp.young, sp.youngPlural)}${e.notes ? ` · ${e.notes}` : ""}` });
  }
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function latest(entries, action, id) {
  return (entries || []).filter((e) => e && (!action || e.action === action) && (!id || e.animalId === id || (Array.isArray(e.animalIds) && e.animalIds.includes(id))))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.created || 0) - (a.created || 0)));
}

// Milk by month for the last n months: [{ key, label, oz }].
export function milkByMonth(sp, entries, today = isoDay(), n = 6) {
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const t = parseDay(today);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(t.getFullYear(), t.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ key, label: MON[d.getMonth()], oz: 0 });
  }
  const idx = new Map(out.map((m, i) => [m.key, i]));
  for (const e of entries || []) if (e && e.action === "milk" && e.date && idx.has(e.date.slice(0, 7))) out[idx.get(e.date.slice(0, 7))].oz += sp.milkOz(e);
  return out;
}

// Ranges for the Stats chips.
export function statsRange(key, today = isoDay()) {
  if (key === "30d") return { key, label: "30 days", start: addDays(today, -29), end: today, prior: { start: addDays(today, -59), end: addDays(today, -30) } };
  if (key === "year") { const y = Number(today.slice(0, 4)); return { key, label: String(y), start: `${y}-01-01`, end: today, prior: { start: `${y - 1}-01-01`, end: `${y - 1}${today.slice(4)}` } }; }
  return { key: "all", label: "All time", start: null, end: today, prior: null };
}

export function herdSummary(sp, data, hobby, r) {
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const inR = (e) => e && e.date && (!r.start || e.date >= r.start) && e.date <= r.end;
  const milk = milkOz(sp, entries.filter(inR));
  const priorMilk = r.prior ? milkOz(sp, entries, { from: r.prior.start, to: r.prior.end }) : null;
  const young = entries.filter((e) => inR(e) && e.action === sp.birthAction).reduce((s, e) => s + (Number(e.count) || 1), 0);
  // Same cost rows the egg page uses: feed/bedding costs on logs + expenses.
  const cost = costRows(data, hobby, r.end).filter(inR).reduce((s, c) => s + c.amount, 0);
  const gal = milk / 128;
  return { milkOz: milk, gal, young, cost, delta: priorMilk ? (milk - priorMilk) / priorMilk : null, perGal: gal >= 1 && cost > 0 ? cost / gal : null };
}

export function milkByAnimal(sp, entries, hobby, r) {
  const t = new Map();
  for (const e of entries || []) {
    if (!e || e.action !== "milk" || !e.date || (r.start && e.date < r.start) || e.date > r.end) continue;
    const k = e.animalId || e.animalName || "?";
    const g = t.get(k) || { id: e.animalId, name: e.animalName || ((hobby.animals || []).find((a) => a.id === e.animalId) || {}).name || "Unknown", oz: 0 };
    g.oz += sp.milkOz(e);
    t.set(k, g);
  }
  return [...t.values()].sort((a, b) => b.oz - a.oz);
}

export function herdFunFacts(sp, { data, hobby, range, milkPrice = 0 }) {
  const entries = (data.entries && data.entries[hobby.id]) || [];
  const inR = (e) => e && e.date && (!range.start || e.date >= range.start) && e.date <= range.end;
  const facts = [];
  const total = milkOz(sp, entries.filter(inR));
  if (total >= 64) {
    const glasses = Math.round(total / 8);
    facts.push({ key: "glasses", icon: "milk", big: glasses.toLocaleString("en-US"), line: `glasses of milk from our ${sp.plural}`,
      title: `That's ${glasses.toLocaleString("en-US")} glasses of milk`, sub: "At 8 oz a glass." });
  }
  if (total >= 128 && milkPrice > 0) {
    const v = (total / 128) * milkPrice;
    facts.push({ key: "worth", icon: "money", big: `$${Math.round(v).toLocaleString("en-US")}`, line: "of milk, at store prices",
      title: `Worth about $${Math.round(v).toLocaleString("en-US")} at the store`, sub: `At $${milkPrice.toFixed(2)} a gallon.` });
  }
  const top = milkByAnimal(sp, entries, hobby, range);
  if (top.length > 1 && top[0].oz > 0) {
    facts.push({ key: "topmilker", icon: "trophy", big: top[0].name, line: "our top milker",
      title: `${top[0].name} is your top milker`, sub: `${(top[0].oz / 128).toFixed(1)} gallons, ${Math.round((top[0].oz / total) * 100)}% of the herd's milk.` });
  }
  const byDay = new Map();
  for (const e of entries) if (inR(e) && e.action === "milk") byDay.set(e.date, (byDay.get(e.date) || 0) + sp.milkOz(e));
  if (byDay.size >= 5) {
    const [d, v] = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
    facts.push({ key: "bestday", icon: "calendar", big: `${(v / 128).toFixed(1)} gal`, line: `our best milking day, ${prettyDay(d)}`,
      title: `Best day: ${(v / 128).toFixed(1)} gal on ${prettyDay(d)}`, sub: `Your biggest milking day${range.start ? " in this range" : ""}.` });
  }
  const young = entries.filter((e) => inR(e) && e.action === sp.birthAction).reduce((s, e) => s + (Number(e.count) || 1), 0);
  if (young >= 2) facts.push({ key: "young", icon: "kid", big: String(young), line: `${sp.youngPlural} born on our homestead`,
    title: `${young} ${sp.youngPlural} born`, sub: `Welcome to the ${sp.key === "cows" ? "herd" : "herd"}.` });
  return facts;
}
