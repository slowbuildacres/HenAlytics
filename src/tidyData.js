// ============================================================================
// Tidy saved data on load
// ----------------------------------------------------------------------------
// Years of app versions, sync hiccups, imports and the odd hand-edited backup
// can leave records that aren't quite the right shape: a date saved as a
// timestamp or "11/05/2026", a list that became null, an empty slot in a
// list. Screens expect text dates ("YYYY-MM-DD") and real lists, and one bad
// record used to be enough to stop a whole screen.
//
// tidyData() fixes those shapes in place, once, when the data loads
// (migrateData calls it). It never deletes a real record: a date it can't read
// falls back to when the record was created, and is left alone otherwise.
// ============================================================================

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// Lists every hobby may carry (from the hobby screens).
const HOBBY_LISTS = [
  "animals", "annuals", "archivedBatches", "archivedSeasons", "attacks", "bakes", "batches", "breedings",
  "brooderBatches", "currentBatches", "deworming", "farrier", "ferments", "flockHistory", "flocks", "gear",
  "harvests", "hives", "hutches", "items", "litters", "paddocks", "pastures", "pendingMapPins", "perennials",
  "recipes", "rides", "runs", "seasons", "seedStarts", "seeds", "shearings", "starters", "tags", "vet",
  "hiddenQuickLogs", "customLogs",
];
const TOP_LISTS = ["plantings", "calendarEvents", "sales", "expenses", "goals", "customers", "freezerLog", "pantry", "projects", "projectLogs"];

// The exact sex values these hobbies' screens look for.
const SEXES = {
  goats: ["Doe", "Buck", "Wether", "Kid"],
  cows: ["Cow", "Bull", "Steer", "Heifer", "Calf"],
  pigs: ["Sow", "Boar", "Barrow", "Gilt", "Piglet"],
  rabbits: ["Doe", "Buck"],
};

function pad(n) { return String(n).padStart(2, "0"); }
function dayOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// A date as "YYYY-MM-DD", or null when it can't be read.
export function readDay(v) {
  if (typeof v === "string") {
    const s = v.trim();
    if (ISO_DAY.test(s)) {
      const [y, m, d] = s.split("-").map(Number);
      return m >= 1 && m <= 12 && d >= 1 && d <= 31 ? s : null;
    }
    // "2026-11-05T14:00:00Z" style: keep the calendar day it names.
    const iso = s.match(/^(\d{4}-\d{2}-\d{2})T/);
    if (iso) return readDay(iso[1]);
    // "11/05/2026" (US style)
    const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (us) return readDay(`${us[3]}-${pad(us[1])}-${pad(us[2])}`);
    return null;
  }
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    const ms = v < 1e11 ? v * 1000 : v; // seconds or milliseconds
    const d = new Date(ms);
    return d.getFullYear() > 1970 && d.getFullYear() < 2200 ? dayOf(d) : null;
  }
  return null;
}

function tidyDated(rec) {
  if (!rec || typeof rec !== "object") return;
  if ("date" in rec && !(typeof rec.date === "string" && ISO_DAY.test(rec.date))) {
    const day = readDay(rec.date) || readDay(rec.created) || readDay(rec.createdAt);
    if (day) rec.date = day; else delete rec.date;
  }
}

function tidyList(list) {
  // An object of records keyed by id (some old saves) becomes a list.
  if (list && typeof list === "object" && !Array.isArray(list)) list = Object.values(list);
  if (!Array.isArray(list)) return [];
  const kept = list.filter((x) => x && typeof x === "object" && !Array.isArray(x));
  kept.forEach(tidyDated);
  // Two records with one id (a sync hiccup): an exact copy is dropped; a
  // different record gets its own id, so editing or deleting one doesn't
  // touch the other.
  const seen = new Map();
  const out = [];
  for (const rec of kept) {
    const id = rec.id;
    if (id == null || id === "") { out.push(rec); continue; }
    const key = String(id);
    if (!seen.has(key)) { seen.set(key, JSON.stringify(rec)); out.push(rec); continue; }
    if (seen.get(key) === JSON.stringify(rec)) continue;
    let n = 2;
    while (seen.has(`${key}-${n}`)) n++;
    rec.id = typeof id === "number" ? `${id}-${n}` : `${key}-${n}`;
    seen.set(rec.id, JSON.stringify(rec));
    out.push(rec);
  }
  return out;
}

export function tidyData(data) {
  if (!data || typeof data !== "object") return data;
  if (data.entries && typeof data.entries === "object") {
    for (const k of Object.keys(data.entries)) data.entries[k] = tidyList(data.entries[k]);
  }
  for (const k of TOP_LISTS) if (k in data) data[k] = tidyList(data[k]);
  if (Array.isArray(data.hobbies)) {
    data.hobbies = data.hobbies.filter((h) => h && typeof h === "object" && h.id);
    for (const h of data.hobbies) {
      if (typeof h.name !== "string" || !h.name.trim()) {
        h.name = typeof h.name === "number" ? String(h.name) : String(h.type || "Hobby").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
      }
      for (const k of HOBBY_LISTS) {
        if (!(k in h)) continue;
        if (!Array.isArray(h[k])) { h[k] = h[k] && typeof h[k] === "object" ? Object.values(h[k]) : []; }
        if (k === "hiddenQuickLogs") { h[k] = h[k].filter((x) => typeof x === "string"); continue; }
        h[k] = h[k].filter((x) => x && typeof x === "object");
        for (const item of h[k]) {
          // Closed garden seasons and finished batches keep their logs here.
          if ("finalEntries" in item) item.finalEntries = tidyList(item.finalEntries);
          // Animals: the screens match sex exactly ("Doe", "Sow"); an
          // imported "doe" would hide her from the breeding forms. Only the
          // hobbies whose values are capitalized (sheep, horses, dogs and
          // cats use their own spellings and are left alone).
          const sexes = SEXES[h.type];
          if (k === "animals" && sexes && typeof item.sex === "string") {
            const match = sexes.find((x) => x.toLowerCase() === item.sex.trim().toLowerCase());
            if (match) item.sex = match;
          }
        }
      }
    }
  }
  return data;
}
