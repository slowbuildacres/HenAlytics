// ============================================================================
// FROST ALERTS — "Frost tonight, cover your tomatoes"
// ----------------------------------------------------------------------------
// Phone notifications scheduled on the device from the 7-day forecast, only
// for gardens that have frost-tender crops in the ground right now. Each time
// the app opens (or the garden changes), the app re-reads the forecast and
// reschedules up to MAX_ALERTS alerts at ALERT_HOUR on the afternoon before
// each frost night. No server, no push keys.
//
// "In the ground" = this season's annuals that haven't been closed out
// (archived). Seed starts are indoors, so they don't count.
//
// Thresholds (forecast overnight low):
//   tender crops (tomatoes, peppers, squash, beans, basil...): <= 34°F
//     (frost can form on plants a few degrees above the air-temp reading)
//   semi-tender crops (lettuce, cauliflower, potatoes...):     <= 30°F
//   hardy crops (kale, garlic, carrots, spinach...):           never
//
// Settings: data.frostAlerts = { enabled: false } turns it off. On by default
// once reminders are allowed.
// ============================================================================

export const FROST_ID_BASE = 300000;
export const MAX_ALERTS = 3;          // keeps us well under iOS's 64 pending cap
export const ALERT_HOUR = 15;         // 3 PM the afternoon before

// Keyword match against the crop name, lowercased. Hardy exclusions are
// checked first so "garlic chives", "kale", "fava bean" etc. never trigger.
const HARDY = [
  "garlic", "onion", "shallot", "leek", "kale", "collard", "spinach", "carrot",
  "parsnip", "beet", "radish", "turnip", "rutabaga", "brussels", "cabbage",
  "broccoli", "kohlrabi", "mache", "claytonia", "arugula", "mustard", "asparagus",
  "rhubarb", "chive", "parsley", "thyme", "sage", "oregano", "rosemary", "mint",
  "fava", "pea", "cover crop", "winter rye", "clover", "vetch", "horseradish",
  "strawberr", "raspberr", "blackberr", "blueberr", "apple", "pear", "plum",
];
const TENDER = [
  "tomato", "tomatillo", "ground cherry", "pepper", "jalape", "chile", "chili",
  "eggplant", "cucumber", "squash", "zucchini", "pumpkin", "gourd", "melon",
  "cantaloupe", "watermelon", "bean", "corn", "okra", "basil", "sweet potato",
  "peanut", "sunflower", "cowpea", "edamame", "luffa", "cilantro", "dill",
  "nasturtium", "zinnia", "marigold", "dahlia", "cosmos",
];
const SEMI = ["lettuce", "cauliflower", "potato", "celery", "endive", "chard", "bok choy", "pak choi", "napa"];

// Some words contain hardy keywords by accident ("peanut" has "pea",
// "pepper" has "pep"... "sweet potato" has "potato"). Tender wins in these.
const TENDER_OVERRIDES = ["peanut", "sweet potato", "pepper", "snap bean", "green bean", "pole bean", "bush bean", "black-eyed pea", "cowpea", "southern pea"];

export function frostClass(name) {
  const n = String(name || "").toLowerCase();
  if (!n) return "unknown";
  if (TENDER_OVERRIDES.some((k) => n.includes(k))) return "tender";
  if (HARDY.some((k) => n.includes(k))) return "hardy";
  if (TENDER.some((k) => n.includes(k))) return "tender";
  if (SEMI.some((k) => n.includes(k))) return "semi";
  return "unknown";
}

// Crops currently in the ground, grouped by frost class.
// hobby: the garden hobby object (currentSeason, annuals[]).
export function cropsAtRisk(hobby) {
  const out = { tender: [], semi: [] };
  if (!hobby || !hobby.currentSeason) return out;
  const sid = hobby.currentSeason.id;
  const seen = new Set();
  for (const a of hobby.annuals || []) {
    if (!a || a.archived || a.seasonId !== sid) continue;
    const name = String(a.name || "").trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    const c = frostClass(name);
    if (c === "tender") out.tender.push(name);
    else if (c === "semi") out.semi.push(name);
  }
  return out;
}

function listNames(names, max = 3) {
  const n = names.slice(0, max);
  const extra = names.length - n.length;
  const base = n.length <= 1 ? (n[0] || "") : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
  return extra > 0 ? `${n.join(", ")} + ${extra} more` : base;
}

function localDate(dateStr, hour) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

// Pure: forecastDays = [{ date: "YYYY-MM-DD", lowF }], crops = cropsAtRisk().
// Returns local-notification payloads. A night "D" is the low reported for
// calendar day D (the pre-dawn low), so the alert fires at ALERT_HOUR on D-1.
export function buildFrostSchedule({ forecastDays = [], crops = { tender: [], semi: [] }, now = new Date(), hour = ALERT_HOUR, fmtTemp = (f) => `${f}°F` } = {}) {
  if (!crops.tender.length && !crops.semi.length) return [];
  const out = [];
  for (const day of forecastDays) {
    if (out.length >= MAX_ALERTS) break;
    if (!day || typeof day.lowF !== "number") continue;
    const tenderHit = crops.tender.length && day.lowF <= 34;
    const semiHit = crops.semi.length && day.lowF <= 30;
    if (!tenderHit && !semiHit) continue;
    const night = localDate(day.date, hour);
    if (!night) continue;
    const at = new Date(night.getTime() - 24 * 60 * 60 * 1000); // afternoon before
    if (at.getTime() <= now.getTime()) continue;                  // too late; the in-app card covers today
    const names = [...(tenderHit ? crops.tender : []), ...(semiHit ? crops.semi : [])];
    const hard = day.lowF <= 28;
    out.push({
      id: FROST_ID_BASE + out.length,
      title: hard ? `🥶 Hard freeze tonight: low ${fmtTemp(day.lowF)}` : `❄️ Frost tonight: low ${fmtTemp(day.lowF)}`,
      body: hard
        ? `Pick what's ripe and cover ${listNames(names)}. A hard freeze will kill unprotected plants.`
        : `Cover ${listNames(names)} before dark, or pick anything that's ready.`,
      schedule: { at, allowWhileIdle: true },
      extra: { kind: "frost", url: "henalytics://open?page=garden", date: day.date },
    });
  }
  return out;
}
