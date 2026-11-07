// ============================================================================
// Rabbits (3.0) — pure helpers for the new rabbit screens
// ----------------------------------------------------------------------------
// Same records as the old rabbit page and RabbitsAnalytics: hobby.animals
// (sex, role, hutch, birthdate), "bred" entries (animalId = doe, kindleDate),
// "litter" entries (animalId = doe, kitsAlive, kitsStillborn, sireName),
// "weight", "health", "note", "butcher" (weight, or legacy count/avgWeight).
// ============================================================================

import { isoDay, parseDay, prettyDay, DAY } from "../eggs/eggFacts.js";
import { plusDays } from "../../dayMath.js";

export const KINDLE_DAYS = 31;
export const daysFrom = (a, b) => Math.round((parseDay(b) - parseDay(a)) / DAY);
const addDays = (s, n) => isoDay(plusDays(parseDay(s), n));
export const liveRabbits = (hobby) => ((hobby && hobby.animals) || []).filter((a) => a && !a.archived);
const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.created || 0) - (a.created || 0));

export function forAnimal(entries, action, id) {
  return (entries || []).filter((e) => e && (!action || e.action === action) && (!id || e.animalId === id || (Array.isArray(e.animalIds) && e.animalIds.includes(id)))).sort(byDateDesc);
}

// A doe's open breeding: bred, kindle date not long past, no litter since.
export function openBred(entries, id, today = isoDay()) {
  const bred = forAnimal(entries, "bred", id)[0];
  if (!bred || !bred.kindleDate) return null;
  const litterSince = forAnimal(entries, "litter", id).some((l) => l.date >= bred.date);
  if (litterSince || bred.kindleDate < addDays(today, -10)) return null;
  return bred;
}

// The newest litter still with its mother (under 8 weeks).
export function nursingLitter(entries, id, today = isoDay()) {
  const l = forAnimal(entries, "litter", id)[0];
  if (!l || daysFrom(l.date, today) > 56) return null;
  return l;
}

export function rabbitStatus(entries, a, today = isoDay()) {
  if (a.sex === "Doe") {
    const b = openBred(entries, a.id, today);
    if (b) {
      const left = daysFrom(today, b.kindleDate);
      return { tone: "ready", text: left < 0 ? `Overdue · was ${prettyDay(b.kindleDate)}` : left <= 4 ? (left === 0 ? "Kindling today" : `Kindle in ${left} day${left === 1 ? "" : "s"}`) : `Due ${prettyDay(b.kindleDate)}` };
    }
    const l = nursingLitter(entries, a.id, today);
    if (l) return { tone: "good", text: `${Number(l.kitsAlive) || 0} kits · week ${Math.floor(daysFrom(l.date, today) / 7) + 1}` };
  }
  if (a.role === "kit" || a.role === "grower") return { tone: "quiet", text: a.role === "kit" ? "Kit" : "Grower" };
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

export const GROUPS = [
  { key: "doe", label: "Does", test: (a) => a.role === "doe" || (!a.role && a.sex === "Doe") },
  { key: "buck", label: "Bucks", test: (a) => a.role === "buck" || (!a.role && a.sex === "Buck") },
  { key: "grow", label: "Growers", test: (a) => a.role === "kit" || a.role === "grower" },
  { key: "pet", label: "Pets", test: (a) => a.role === "pet" },
];

// Kindlings coming up across the herd, soonest first.
export function upcomingKindles(hobby, entries, today = isoDay()) {
  return liveRabbits(hobby).filter((a) => a.sex === "Doe").map((a) => {
    const b = openBred(entries, a.id, today);
    if (!b) return null;
    const day = Math.max(0, Math.min(KINDLE_DAYS, daysFrom(b.date, today)));
    return { doe: a, bred: b, day, left: daysFrom(today, b.kindleDate), nestBox: addDays(b.kindleDate, -3) };
  }).filter(Boolean).sort((x, y) => (x.bred.kindleDate < y.bred.kindleDate ? -1 : 1));
}

// Litters still nursing (under 8 weeks), newest first.
export function nursingLitters(hobby, entries, today = isoDay()) {
  const name = (id) => ((hobby.animals || []).find((a) => a.id === id) || {}).name;
  return (entries || []).filter((e) => e && e.action === "litter" && e.date && daysFrom(e.date, today) <= 56).sort(byDateDesc)
    .map((l) => ({ litter: l, doe: name(l.animalId) || l.doeName || l.animalName || "Doe", week: Math.floor(daysFrom(l.date, today) / 7) + 1, weanOn: addDays(l.date, 56) }));
}

export function litterHistory(hobby, entries) {
  const name = (id) => ((hobby.animals || []).find((a) => a.id === id) || {}).name;
  return (entries || []).filter((e) => e && e.action === "litter").sort(byDateDesc).map((l) => {
    const alive = Number(l.kitsAlive) || 0, still = Number(l.kitsStillborn) || 0;
    return { id: l.id, date: l.date, doe: name(l.animalId) || l.doeName || l.animalName || "Doe",
      sub: [`${alive} kit${alive === 1 ? "" : "s"}`, still ? `${still} stillborn` : null, l.sireName || l.buckName ? `sire ${l.sireName || l.buckName}` : null].filter(Boolean).join(" · ") };
  });
}

const butcherLbs = (e) => (e.count != null ? (Number(e.count) || 0) * (Number(e.avgWeight) || 0) : Number(e.weight) || 0);
const butcherN = (e) => (e.count != null ? Number(e.count) || 0 : 1);

export function rabbitSummary(entries, r) {
  const inR = (e) => e && e.date && (!r.start || e.date >= r.start) && e.date <= r.end;
  const ents = (entries || []).filter(inR);
  const litters = ents.filter((e) => e.action === "litter");
  const kits = litters.reduce((s, e) => s + (Number(e.kitsAlive) || 0), 0);
  const butcher = ents.filter((e) => e.action === "butcher");
  const lbs = butcher.reduce((s, e) => s + butcherLbs(e), 0);
  const butchered = butcher.reduce((s, e) => s + butcherN(e), 0);
  const cost = ents.filter((e) => e.action === "fed" || e.action === "infrastructure").reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const bred = ents.filter((e) => e.action === "bred").length;
  return { litters: litters.length, kits, avgLitter: litters.length ? kits / litters.length : null, lbs, butchered, cost, bred };
}
