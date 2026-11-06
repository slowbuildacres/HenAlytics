// ============================================================================
// Egg layers (3.0) — numbers for the new Stats screen and its fun facts
// ----------------------------------------------------------------------------
// Pure functions over the same data the old Stats page reads, so the two
// never disagree: eggs = "eggs"/"eggs_laid" entries; cost = feed, bedding and
// infrastructure entries + expenses logged to this hobby (recurring ones
// expanded up to today), infrastructure included like the old Cost/Egg card.
// ============================================================================

import { expandRecurringExpenses } from "../../Sales.jsx";
import { daylightHours, fmtHours } from "../../eggInsights.js";

export const DAY = 86400000;
const pad = (n) => String(n).padStart(2, "0");
export const isoDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDay = (s) => { const p = String(s || "").split("-").map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); };
const addDays = (s, n) => isoDay(new Date(parseDay(s).getTime() + n * DAY));
const isEgg = (e) => e && (e.action === "eggs" || e.action === "eggs_laid");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
export const prettyDay = (s) => { const d = parseDay(s); return `${MONTHS[d.getMonth()]} ${d.getDate()}`; };

// Ranges for the chips. `start` null = all time.
export function rangeFor(key, today = isoDay()) {
  if (key === "6m") return { key, start: addDays(today, -182), end: today, label: "6 months", prior: { start: addDays(today, -365), end: addDays(today, -183) } };
  if (key === "year") {
    const start = `${today.slice(0, 4)}-01-01`;
    const priorYear = String(Number(today.slice(0, 4)) - 1);
    return { key, start, end: today, label: "This year", prior: { start: `${priorYear}-01-01`, end: `${priorYear}${today.slice(4)}` } };
  }
  return { key: "all", start: null, end: today, label: "All time", prior: null };
}
const inRange = (d, r) => d && (!r.start || d >= r.start) && (!r.end || d <= r.end);

export function eggsIn(entries, r) {
  return (entries || []).filter((e) => isEgg(e) && inRange(e.date, r)).reduce((s, e) => s + (Number(e.count) || 0), 0);
}

// Every dated cost for this hobby: [{ date, amount }].
export function costRows(data, hobby, today = isoDay()) {
  const ents = (data.entries && data.entries[hobby.id]) || [];
  const fromEntries = ents
    .filter((e) => e && e.date && ["fed", "bedding", "infrastructure"].includes(e.action) && Number(e.cost) > 0)
    .map((e) => ({ date: e.date, amount: Number(e.cost) }));
  const logged = expandRecurringExpenses((data.expenses || []).filter((x) => x && x.hobbyId === hobby.id))
    .filter((x) => x && x.date && x.date <= today && Number(x.amount) > 0)
    .map((x) => ({ date: x.date, amount: Number(x.amount) }));
  return fromEntries.concat(logged);
}

export function summary(data, hobby, r) {
  const ents = (data.entries && data.entries[hobby.id]) || [];
  const eggs = eggsIn(ents, r);
  const cost = costRows(data, hobby, r.end).filter((c) => inRange(c.date, r)).reduce((s, c) => s + c.amount, 0);
  const priorEggs = r.prior ? eggsIn(ents, r.prior) : null;
  const delta = priorEggs ? (eggs - priorEggs) / priorEggs : null;
  return { eggs, cost, perDozen: eggs > 0 ? (cost / eggs) * 12 : null, priorEggs, delta };
}

// The last `n` months (oldest first) with eggs per flock:
// [{ key: "2026-06", label: "Jun", total, byFlock: { [flockId]: n } }].
export function monthlyByFlock(entries, flocks, today = isoDay(), n = 6) {
  const t = parseDay(today);
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(t.getFullYear(), t.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: MONTHS[d.getMonth()], total: 0, byFlock: {} });
  }
  const ids = new Set((flocks || []).map((f) => f.id));
  for (const e of entries || []) {
    if (!isEgg(e) || !e.date) continue;
    const m = months.find((x) => x.key === e.date.slice(0, 7));
    if (!m) continue;
    const c = Number(e.count) || 0;
    const k = ids.has(e.flockId) ? e.flockId : "_other";
    m.byFlock[k] = (m.byFlock[k] || 0) + c;
    m.total += c;
  }
  return months;
}

// Daylight comes from the same function as the Today tab's egg insight, so
// the two never show different numbers.
export { daylightHours };

// Fun facts for the swipeable card. Each: { key, icon, title, sub }.
// Only facts there's real data for are returned.
export function eggFunFacts({ data, hobby, range, today = isoDay(), storePrice = 4 }) {
  const ents = ((data.entries && data.entries[hobby.id]) || []).filter((e) => isEgg(e) && e.date && e.date <= today);
  const r = range || rangeFor("all", today);
  const inR = ents.filter((e) => inRange(e.date, r));
  const total = inR.reduce((s, e) => s + (Number(e.count) || 0), 0);
  const facts = [];
  const fmtMoney0 = (v) => `$${Math.round(v).toLocaleString("en-US")}`;

  // 1. Break-even: the day eggs (at store prices) passed everything spent.
  const costs = costRows(data, hobby, today);
  const spent = costs.reduce((s, c) => s + c.amount, 0);
  if (spent > 0 && ents.length) {
    const events = ents.map((e) => ({ date: e.date, v: (Number(e.count) || 0) * storePrice / 12 }))
      .concat(costs.map((c) => ({ date: c.date, v: -c.amount })))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : b.v - a.v));
    let run = 0, paidOn = null, wasNeg = false;
    for (const ev of events) {
      run += ev.v;
      if (run < 0) { wasNeg = true; paidOn = null; }
      else if (wasNeg && !paidOn) paidOn = ev.date;
    }
    if (run >= 0 && paidOn) {
      facts.push({ key: "breakeven", icon: "calendar", big: prettyDay(paidOn), line: "the day our flock paid for itself", title: `Your flock paid for itself on ${prettyDay(paidOn)}${paidOn.slice(0, 4) !== today.slice(0, 4) ? ", " + paidOn.slice(0, 4) : ""}`,
        // What had been spent by that day, not since: a flock that paid back
        // its start-up costs years ago has spent far more since.
        sub: (() => { const by = costs.filter((c) => c.date <= paidOn).reduce((s, c) => s + c.amount, 0);
          return by < spent - 0.5
            ? `Eggs at store prices passed the ${fmtMoney0(by)} spent by then, and they've kept up with every cost since (${fmtMoney0(spent)} in all).`
            : `Eggs at store prices passed the ${fmtMoney0(spent)} you've spent on feed, supplies and the coop.`; })() });
    } else if (run < 0) {
      const dozens = Math.ceil(-run / storePrice);
      facts.push({ key: "breakeven", icon: "calendar", big: `${dozens.toLocaleString("en-US")} dozen`, line: "to go until our flock pays for itself", title: `${dozens.toLocaleString("en-US")} more dozen until your flock pays for itself`,
        sub: `Counting eggs at ${fmtMoney0(storePrice)} a dozen against ${fmtMoney0(spent)} spent so far.` });
    }
  }

  // 2. Stacked up.
  if (total >= 50) {
    const feet = Math.round((total * 2.25) / 12);
    const stories = Math.round(feet / 11);
    facts.push({ key: "stack", icon: "stack", big: `${feet.toLocaleString("en-US")} ft`, line: "of eggs, if we stacked them up", title: `Stacked up, these eggs would stand ${feet.toLocaleString("en-US")} feet tall`,
      sub: stories >= 2 ? `About a ${stories}-story building, at 2¼ inches per egg.` : "At about 2¼ inches per egg." });
  }

  // 3. Daylight (needs the homestead's location).
  const lat = data.homesteadLocation && data.homesteadLocation.lat;
  const hrs = lat != null && isFinite(lat) ? daylightHours(lat, parseDay(today)) : null;
  if (hrs != null) {
    const h = Math.floor(hrs), m = Math.floor((hrs - h) * 60);
    const north = lat >= 0;
    const md = today.slice(5);
    const lengthening = north ? (md >= "12-21" || md < "06-21") : (md >= "06-21" && md < "12-21");
    const turn = north ? "Dec 21" : "Jun 21";
    facts.push({ key: "daylight", icon: "sun", big: fmtHours(hrs), line: "of daylight today. Hens like 14+ hours", title: `${fmtHours(hrs)} of daylight today`,
      sub: hrs < 14
        ? (lengthening ? "Hens lay best with 14+ hours. Days are getting longer now." : `Hens lay best with 14+ hours. Days start getting longer ${turn}.`)
        : "Plenty of light for laying. Hens like 14+ hours." });
  }

  // 4. Record day.
  const byDay = new Map();
  for (const e of inR) byDay.set(e.date, (byDay.get(e.date) || 0) + (Number(e.count) || 0));
  if (byDay.size >= 7) {
    const [bestDate, best] = [...byDay.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))[0];
    facts.push({ key: "record", icon: "trophy", big: `${best} eggs`, line: `our best day, ${prettyDay(bestDate)}`, title: `Best day: ${best} eggs on ${prettyDay(bestDate)}`, sub: bestDate.slice(0, 4) !== today.slice(0, 4) ? `Back in ${bestDate.slice(0, 4)}.` : "Your record so far." });
  }

  // 5. Best weekday (needs about 4 weeks of logs).
  if (byDay.size >= 28) {
    const sum = [0, 0, 0, 0, 0, 0, 0], n = [0, 0, 0, 0, 0, 0, 0];
    for (const [d, c] of byDay) { const w = parseDay(d).getDay(); sum[w] += c; n[w] += 1; }
    const avg = sum.map((s, i) => (n[i] ? s / n[i] : 0));
    const best = avg.indexOf(Math.max(...avg));
    const low = avg.indexOf(Math.min(...avg.filter((v, i) => n[i])));
    if (avg[best] > avg[low]) {
      facts.push({ key: "weekday", icon: "chart", big: WEEKDAYS[best], line: "are our hens' best laying day", title: `Your hens lay the most on ${WEEKDAYS[best]}`,
        sub: `${avg[best].toFixed(1)} eggs on an average ${WEEKDAYS[best].slice(0, -1)}, ${avg[low].toFixed(1)} on ${WEEKDAYS[low]}.` });
    }
  }

  // 6. Breakfasts.
  if (total >= 24) {
    facts.push({ key: "breakfast", icon: "egg", big: Math.floor(total / 2).toLocaleString("en-US"), line: "two-egg breakfasts from our flock", title: `That's ${Math.floor(total / 2).toLocaleString("en-US")} two-egg breakfasts`,
      sub: `Or about ${Math.floor(total / 3).toLocaleString("en-US")} batches of cookies.` });
  }
  return facts;
}
