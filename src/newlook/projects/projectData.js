// ============================================================================
// 4-H & FFA projects (3.0) — the numbers behind a project record
// ----------------------------------------------------------------------------
// A project is a kid's record book for one hobby over one program year:
//   data.projects    = [{ id, club: "4-H"|"FFA", kind, title, hobbyId, member,
//                         age, clubName, start, end, goals, story,
//                         money: "hobby"|"picked", saleIds, expenseIds,
//                         saeType, createdAt, archived }]
//   data.projectLogs = [{ id, projectId, kind: "hours"|"show", date, hours,
//                         activity, note, showName, cls, placing, award }]
// Everything else fills itself in from what the family already logs in the
// linked hobby: animals, production, health logs, photos, sales, expenses.
// With money "hobby", every sale and expense of the hobby in the project's
// dates counts; with "picked", only the ones ticked on the money screen
// (for a homestead where the project is part of a bigger flock).
// ============================================================================

import { collectAllSales, computeRevenue, saleKind } from "../../Sales.jsx";
import { extractHobbyExpenses } from "../../expenseFifo.js";
import { hobbyAllEntries } from "../../allEntries.js";
import { collectGardenHarvests } from "../../analytics.js";
import { computeHarvestValue } from "../../gardenValue.js";
import { SPECIES, liveAnimals, milkOz, birthHistory } from "../livestock/livestockData.js";
import { rabbitSummary } from "../rabbits/rabbitData.js";
import { rideTotals } from "../horses/horseData.js";

const pad = (n) => String(n).padStart(2, "0");
export const isoDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Project kinds, in the order the "Start a project" chips show them.
export const KINDS = [
  { key: "poultry", label: "Poultry", hobbyType: "egg_layers", saleTypes: ["eggs"], icon: "egg_layers" },
  { key: "broilers", label: "Meat birds", hobbyType: "meat_chickens", saleTypes: ["meat_chickens"], icon: "meat_chickens" },
  { key: "rabbits", label: "Rabbits", hobbyType: "rabbits", saleTypes: ["rabbits", "rabbit"], icon: "rabbits" },
  { key: "goats", label: "Goats", hobbyType: "goats", saleTypes: ["goat"], icon: "goats" },
  { key: "sheep", label: "Sheep", hobbyType: "sheep", saleTypes: ["sheep"], icon: "sheep" },
  { key: "swine", label: "Swine", hobbyType: "pigs", saleTypes: ["pig"], icon: "pigs" },
  { key: "cattle", label: "Cattle", hobbyType: "cows", saleTypes: ["cow"], icon: "cows" },
  { key: "horse", label: "Horse", hobbyType: "horses", saleTypes: ["horse"], icon: "horses" },
  { key: "garden", label: "Garden", hobbyType: "garden", saleTypes: ["garden"], icon: "garden" },
  { key: "bees", label: "Beekeeping", hobbyType: "bees", saleTypes: ["honey"], icon: "bees" },
];
export const kindOf = (key) => KINDS.find((k) => k.key === key) || { key: "other", label: "Project", hobbyType: null, saleTypes: [], icon: "other" };

export const SAE_TYPES = ["Entrepreneurship", "Placement", "Research", "Exploratory", "School-based"];
export const HOUR_ACTIVITIES = ["Daily care", "Feeding", "Health care", "Training or showing", "Building or repair", "Meeting or clinic", "Record keeping", "Community service", "Other"];

// 4-H and most FFA chapters run Oct 1 – Sep 30. Before October we're still in
// the year that started last fall.
export function programYear(today = new Date()) {
  const y = today.getMonth() >= 9 ? today.getFullYear() : today.getFullYear() - 1;
  return { start: `${y}-10-01`, end: `${y + 1}-09-30`, label: `${y}–${String(y + 1).slice(2)}` };
}
export function yearLabel(p) {
  const a = String(p.start || "").slice(0, 4), b = String(p.end || "").slice(0, 4);
  return a && b && a !== b ? `${a}–${b.slice(2)}` : a || "";
}

export const projectsOf = (data) => ((data && data.projects) || []).filter((p) => p && !p.archived);
export const logsFor = (data, id) => ((data && data.projectLogs) || []).filter((l) => l && l.projectId === id);
export const hobbyFor = (data, p) => (data.hobbies || []).find((h) => h && h.id === p.hobbyId) || null;
const inR = (d, p) => !!d && d >= p.start && d <= p.end;

// ---- money ------------------------------------------------------------------
export function candidateSales(data, p) {
  const k = kindOf(p.kind);
  return collectAllSales(data)
    .filter((s) => s && inR(s.date, p) && (s.hobbyId ? s.hobbyId === p.hobbyId : k.saleTypes.includes(s.hobbyType)))
    .map((s) => ({ id: s.id, date: s.date, what: s.item || saleKind(s), qty: s.qty, unit: s.unit, buyer: s.customerName || "", amount: Math.round(computeRevenue(s) * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
const SOURCE_LABEL = {
  fed: "Feed", feed: "Feed", bedding: "Bedding", infrastructure: "Building or repair", vet: "Vet", health: "Health care",
  medication: "Medicine", deworming: "Dewormer", flock_purchase: "Birds", chick_purchase: "Chicks", hive_purchase: "Hive",
  logged_expense: "Supplies", farrier: "Farrier", supplies: "Supplies",
};
const sourceLabel = (src) => SOURCE_LABEL[src] || (src ? String(src).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "Supplies");
export function candidateExpenses(data, p) {
  if (!p.hobbyId) return [];
  return extractHobbyExpenses(data, p.hobbyId)
    .filter((r) => r && inR(r.date, p) && (Number(r.cost) || 0) > 0)
    .map((r) => ({ id: r.id || `${r.source}:${r.date}:${r.cost}:${r.note || ""}`, date: r.date, what: r.note || r.label || sourceLabel(r.source), category: r.category || sourceLabel(r.source), amount: Math.round((Number(r.cost) || 0) * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function projectMoney(data, p) {
  const allS = candidateSales(data, p), allE = candidateExpenses(data, p);
  const picked = p.money === "picked";
  const sales = picked ? allS.filter((s) => (p.saleIds || []).includes(s.id)) : allS;
  const expenses = picked ? allE.filter((e) => (p.expenseIds || []).includes(e.id)) : allE;
  const sum = (a) => Math.round(a.reduce((t, x) => t + x.amount, 0) * 100) / 100;
  return { sales, expenses, income: sum(sales), spent: sum(expenses), net: Math.round((sum(sales) - sum(expenses)) * 100) / 100, allS, allE };
}

// ---- animals and production --------------------------------------------------
export function inventory(data, p) {
  const h = hobbyFor(data, p);
  const k = kindOf(p.kind);
  if (!h) return { count: 0, word: "", rows: [] };
  if (k.hobbyType === "egg_layers") {
    const flocks = (h.flocks || []).filter((f) => f && !f.archived);
    const PLURAL = { Chicken: "chickens", Duck: "ducks", Turkey: "turkeys", Quail: "quail", Goose: "geese", Guinea: "guineas", Peafowl: "peafowl" };
    const SINGULAR = { Chicken: "chicken", Duck: "duck", Turkey: "turkey", Quail: "quail", Goose: "goose", Guinea: "guinea", Peafowl: "peafowl" };
    const word = (t, n) => (n === 1 ? SINGULAR[t] || "bird" : PLURAL[t] || "birds");
    const rows = flocks.map((f) => { const n = Number(f.birdCount) || 0; return { name: f.name || "Flock", detail: `${n} ${word(f.birdType, n)}${f.breed ? ` · ${f.breed}` : ""}` }; });
    return { count: flocks.reduce((t, f) => t + (Number(f.birdCount) || 0), 0), word: "birds", rows };
  }
  if (k.hobbyType === "meat_chickens") {
    const seen = new Set();
    const batches = [...(h.currentBatches || []), h.currentBatch, ...(h.archivedBatches || [])]
      .filter((x) => x && inR(x.startDate, p) && !seen.has(x.id || x.startDate) && seen.add(x.id || x.startDate));
    const rows = batches.map((x) => ({ name: x.name || `Batch started ${x.startDate}`, detail: `${Number(x.startCount) || 0} ${x.birdType ? String(x.birdType).toLowerCase() : "birds"}${x.breed ? ` · ${x.breed}` : ""}` }));
    return { count: batches.reduce((t, x) => t + (Number(x.startCount) || 0), 0), word: "birds", rows };
  }
  if (k.hobbyType === "garden") {
    const s = h.currentSeason;
    const rows = (h.annuals || []).filter((a) => a && (!s || a.seasonId === s.id)).map((a) => ({ name: a.name, detail: a.variety || "" }));
    return { count: rows.length, word: "crops", rows };
  }
  if (k.hobbyType === "bees") {
    const rows = (h.hives || []).filter((x) => x && !x.archived && !x.lost).map((x) => ({ name: x.name || "Hive", detail: x.type || "" }));
    return { count: rows.length, word: "hives", rows };
  }
  const animals = k.hobbyType === "rabbits" ? (h.rabbits || h.animals || []).filter((a) => a && !a.archived) : liveAnimals(h);
  const rows = animals.map((a) => ({ name: a.name || a.tag || "Unnamed", detail: [a.breed, a.sex || a.gender, a.tag ? `tag ${a.tag}` : null, a.dob ? `born ${a.dob}` : null].filter(Boolean).join(" · ") }));
  return { count: animals.length, word: k.hobbyType === "horses" ? "horses" : "animals", rows };
}

const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
export function production(data, p) {
  const h = hobbyFor(data, p);
  const k = kindOf(p.kind);
  if (!h) return [];
  const ents = hobbyAllEntries(data, h.id);
  const r = { start: p.start, end: p.end };
  const out = [];
  try {
    if (k.hobbyType === "egg_layers") {
      const eggs = ents.filter((e) => (e.action === "eggs" || e.action === "eggs_laid") && inR(e.date, p)).reduce((t, e) => t + (Number(e.count) || 0), 0);
      out.push({ label: "Eggs collected", value: eggs, text: `${eggs.toLocaleString("en-US")} eggs` });
    } else if (k.hobbyType === "garden") {
      const hv = collectGardenHarvests(data, { range: r });
      const lbs = hv.reduce((t, x) => t + (/^lb/i.test(String(x.unit || "")) ? Number(x.quantity != null ? x.quantity : x.qty) || 0 : /^oz/i.test(String(x.unit || "")) ? (Number(x.quantity != null ? x.quantity : x.qty) || 0) / 16 : 0), 0);
      const val = computeHarvestValue(hv, h.harvestPrices || {});
      out.push({ label: "Harvested", value: lbs, text: `${r1(lbs)} lbs` });
      if (val.total > 0) out.push({ label: "Worth at store prices", value: val.total, text: `$${Math.round(val.total)}` });
    } else if (k.hobbyType === "rabbits") {
      const s = rabbitSummary(ents, r);
      out.push({ label: "Kits born alive", value: s.kits, text: `${s.kits} kits in ${s.litters} litters` });
      if (s.lbs > 0) out.push({ label: "Meat", value: s.lbs, text: `${r1(s.lbs)} lbs` });
    } else if (["goats", "cows", "sheep", "pigs"].includes(k.hobbyType)) {
      const sp = SPECIES[k.hobbyType];
      if (sp && sp.milk !== false) {
        const oz = milkOz(sp, ents, { from: p.start, to: p.end });
        if (oz > 0) out.push({ label: "Milk", value: oz, text: `${r1(oz / 128)} gallons` });
      }
      if (sp) {
        const born = birthHistory(sp, h, ents).filter((b) => inR(b.date, p)).reduce((t, b) => t + (Number(b.count) || 0), 0);
        if (born > 0) out.push({ label: `${sp.youngPlural || "Young"} born`, value: born, text: `${born}` });
      }
      const weights = ents.filter((e) => e.action === "weight" && inR(e.date, p)).length;
      if (weights) out.push({ label: "Weigh-ins", value: weights, text: `${weights}` });
    } else if (k.hobbyType === "horses") {
      const t = rideTotals(h, p.start, p.end);
      out.push({ label: "Rides", value: t.count, text: `${t.count} rides · ${r1(t.minutes / 60)} hours` });
    } else if (k.hobbyType === "bees") {
      const lbs = ents.filter((e) => e.action === "harvest" && inR(e.date, p)).reduce((t, e) => t + (Number(e.lbs) || 0), 0);
      out.push({ label: "Honey", value: lbs, text: `${r1(lbs)} lbs` });
    } else if (k.hobbyType === "meat_chickens") {
      const inv = inventory(data, p);
      out.push({ label: "Birds raised", value: inv.count, text: `${inv.count} birds` });
    }
  } catch (_) { /* fall through */ }
  return out;
}

const HEALTH = new Set(["health", "vet", "medication", "med", "deworming", "deworm", "vaccination", "vaccine", "treatment", "farrier", "mite_test"]);
export function healthLogs(data, p) {
  const h = hobbyFor(data, p);
  if (!h) return [];
  const rows = hobbyAllEntries(data, h.id).filter((e) => e && HEALTH.has(e.action) && inR(e.date, p))
    .map((e) => ({ date: e.date, what: [e.animalName, e.treatment || e.medication || e.condition || e.reason || e.note || e.notes || String(e.action).replace(/_/g, " ")].filter(Boolean).join(": ") }));
  for (const c of (h.careLogs || h.care || [])) {
    if (c && inR(c.date, p)) rows.push({ date: c.date, what: [c.kind || c.type, c.note || c.notes].filter(Boolean).join(": ") });
  }
  // Horses keep vet, deworming and farrier visits on the hobby.
  for (const [key, label] of [["vet", "Vet"], ["deworming", "Dewormed"], ["farrier", "Farrier"]]) {
    for (const c of Array.isArray(h[key]) ? h[key] : []) {
      if (c && inR(c.date, p)) rows.push({ date: c.date, what: [label, c.reason || c.product || c.work || c.notes || c.note].filter(Boolean).join(": ") });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function photoPaths(data, p) {
  const h = hobbyFor(data, p);
  if (!h) return [];
  const out = [];
  for (const e of hobbyAllEntries(data, h.id)) {
    if (!e || !inR(e.date, p)) continue;
    for (const path of e.photoPaths || []) out.push({ path, date: e.date, caption: e.note || e.notes || "" });
  }
  for (const a of h.animals || h.rabbits || []) {
    for (const ph of (a && Array.isArray(a.photos) ? a.photos : [])) {
      if (ph && ph.path && inR(ph.date, p)) out.push({ path: ph.path, date: ph.date, caption: ph.caption || a.name || "" });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function hoursTotal(logs) {
  return Math.round(logs.filter((l) => l.kind === "hours").reduce((t, l) => t + (Number(l.hours) || 0), 0) * 10) / 10;
}

// ---- the record --------------------------------------------------------------
// Each section: { key, title, source, status: "done"|"part"|"todo", value, need }
export function projectRecord(data, p) {
  const logs = logsFor(data, p.id).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const inv = inventory(data, p);
  const prod = production(data, p);
  const money = projectMoney(data, p);
  const health = healthLogs(data, p);
  const photos = photoPaths(data, p);
  const hours = hoursTotal(logs);
  const shows = logs.filter((l) => l.kind === "show");
  const k = kindOf(p.kind);
  const hobby = hobbyFor(data, p);
  const hobbyName = hobby ? (hobby.name || k.label) : k.label;
  const money$ = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  const sections = [
    { key: "goals", title: "Project goals", source: "You write these", status: (p.goals || "").trim() ? "done" : "todo", value: (p.goals || "").trim() ? "Written" : null, need: "goals", write: true },
    { key: "inventory", title: "Animal inventory", source: `From ${hobbyName}`, status: inv.count > 0 ? "done" : "todo", value: inv.count ? `${inv.count} ${inv.word}` : null, need: "inventory" },
    { key: "production", title: "Production", source: `From what you log in ${hobbyName}`, status: prod.some((x) => x.value > 0) ? "done" : "todo", value: prod[0] && prod[0].value > 0 ? prod[0].text : null, need: "production" },
    { key: "expenses", title: "Expenses", source: p.money === "picked" ? "From the expenses you picked" : `From costs logged in ${hobbyName}`, status: money.expenses.length ? "done" : "todo", value: money.expenses.length ? money$(money.spent) : null, need: "expenses" },
    { key: "income", title: "Income", source: "From Sales & costs", status: money.sales.length ? "done" : "part", value: money.sales.length ? money$(money.income) : "$0", need: null },
    { key: "hours", title: "Hours and activities", source: "From Log › Project hours", status: hours > 0 ? "done" : "todo", value: hours > 0 ? `${hours} hrs` : null, need: "hours" },
    { key: "health", title: "Health records", source: `From health logs in ${hobbyName}`, status: health.length ? "done" : "part", value: String(health.length), need: null },
    { key: "shows", title: "Shows and awards", source: "From Log › Show or fair", status: shows.length ? "done" : "part", value: String(shows.length), need: null },
    { key: "photos", title: "Photos", source: "From photos on your logs", status: photos.length >= 3 ? "done" : photos.length ? "part" : "todo", value: `${Math.min(photos.length, 3)} of 3`, need: photos.length >= 3 ? null : `${3 - photos.length} photo${3 - photos.length === 1 ? "" : "s"}` },
    { key: "story", title: "Project story", source: "You write this, with prompts to help", status: (p.story || "").trim() ? "done" : "todo", value: (p.story || "").trim() ? "Written" : null, need: "project story", write: true },
  ];
  const done = sections.filter((s) => s.status === "done").length;
  const missing = sections.filter((s) => s.status !== "done" && s.need).map((s) => s.need);
  return { sections, done, total: sections.length, missing, logs, inv, prod, money, health, photos, hours, shows, hobbyName };
}

export function progressLine(rec) {
  if (rec.done === rec.total) return "Everything's filled in. Ready to print.";
  const m = rec.missing.slice(0, 3);
  return `${rec.done} of ${rec.total} done${m.length ? ` · still need ${m.join(", ")}` : ""}`;
}

// Hours logged this calendar month (the FFA card line).
export function hoursThisMonth(logs, today = new Date()) {
  const key = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
  return hoursTotal(logs.filter((l) => String(l.date || "").startsWith(key)));
}

export const STORY_PROMPTS = [
  "Why did you pick this project?",
  "What did you do each week to take care of it?",
  "What went wrong, and what did you do about it?",
  "What are you proudest of this year?",
  "What will you do differently next year?",
];
export const GOAL_PROMPTS = [
  "Something you want to learn (like how to spot a sick bird)",
  "Something you want to do (like show at the county fair)",
  "A number to hit (like sell 50 dozen eggs, or keep feed under $200)",
];

// ---- next program year ------------------------------------------------------
// From 30 days before a project's year ends (September 1 for an Oct–Sep
// year), it offers "Start the 2027–28 record". The new record copies the
// member, club, animals, goals and money choice into the next year; the old
// one stays as it is under Past years, printable as before.
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (iso, n) => { const [y, m, d] = String(iso).split("-").map(Number); return isoOf(new Date(y, m - 1, d + n)); };

export function isPastProject(p, today = isoOf(new Date())) {
  return !!(p && p.end && p.end < today);
}

export function nextYearDue(data, p, today = isoOf(new Date())) {
  if (!p || !p.end || p.continuedTo) return false;
  if (((data && data.projects) || []).some((x) => x && x.continuedFrom === p.id)) return false;
  return today >= addDays(p.end, -30);
}

export function nextYearLabel(p) {
  const s = addDays(p.end, 1);
  const y = Number(s.slice(0, 4));
  const e = addDays(`${y + 1}${s.slice(4)}`, -1);
  return e.slice(0, 4) !== s.slice(0, 4) ? `${y}–${e.slice(2, 4)}` : String(y);
}

// The next year's record for `p` (a new object; the caller saves it).
export function nextYearProject(p, newId) {
  const start = addDays(p.end, 1);
  const end = addDays(`${Number(start.slice(0, 4)) + 1}${start.slice(4)}`, -1);
  const age = /^\d+$/.test(String(p.age || "").trim()) ? String(Number(p.age) + 1) : (p.age || "");
  return {
    ...p, id: newId, createdAt: Date.now(), continuedFrom: p.id, continuedTo: null,
    start, end, age, saleIds: [], expenseIds: [], story: "",
  };
}
