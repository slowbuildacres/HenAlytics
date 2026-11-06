// ============================================================================
// FLOCK TOOLS — small, pure helpers for the flock features
// ----------------------------------------------------------------------------
//  • Broody spells: when a hen went broody and how long it's been, plus past
//    spells (bird.broodySince, bird.broodyHistory [{ start, end }]).
//  • Hatch date / age on a bird (bird.hatchDate), and the brooder batches a
//    flock's birds came from (incubator hobby → brooderBatches).
//  • Egg counts per flock (today / 7 days / 30 days) and a per-flock daily
//    series for the Stats chart.
//  • Purchase history: every purchase in one list (Add Expense rows + feed,
//    bedding and infrastructure logs with a cost) and "last bought" per item.
// No React, no app state: everything takes plain data so it can be tested.
// ============================================================================

const pad = (n) => String(n).padStart(2, '0');
export const isoDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (s) => {
  const [y, m, d] = String(s || '').split('-').map(Number);
  return y ? new Date(y, (m || 1) - 1, d || 1) : null;
};
export const daysBetween = (a, b) => {
  const da = parseDay(a), db = parseDay(b);
  if (!da || !db) return null;
  return Math.round((db - da) / 86400000);
};
const fmtShort = (iso) => {
  const d = parseDay(iso);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
};

// ---- Broody ------------------------------------------------------------------

// Patch for a bird going broody (on=true) or breaking (on=false) on `date`.
// Closing a spell moves it into broodyHistory (newest last).
export function broodyPatch(bird, on, date = isoDay()) {
  if (on) {
    if (bird && bird.broody && bird.broodySince) return { broody: true };
    return { broody: true, broodySince: date };
  }
  const history = Array.isArray(bird && bird.broodyHistory) ? bird.broodyHistory.slice() : [];
  const since = bird && bird.broodySince;
  if (since && since <= date) history.push({ start: since, end: date });
  return { broody: false, broodySince: null, broodyHistory: history.slice(-20) };
}

// When the bird went broody: its own stamp, else the latest "started" broody
// log for it (older data, from before the stamp existed).
export function broodyStart(bird, entries = []) {
  if (!bird || !bird.broody) return null;
  if (bird.broodySince) return bird.broodySince;
  let best = null;
  for (const e of entries || []) {
    if (!e || e.action !== 'broody' || e.namedBirdId !== bird.id) continue;
    if ((e.broodyStatus || 'started') !== 'started') continue;
    if (!best || e.date > best) best = e.date;
  }
  return best;
}

// "day 6" style count: the first day counts as day 1.
export function broodyDay(bird, entries = [], today = isoDay()) {
  const start = broodyStart(bird, entries);
  if (!start) return null;
  const n = daysBetween(start, today);
  return n == null || n < 0 ? null : n + 1;
}

export function broodySpellLabel(spell) {
  if (!spell || !spell.start) return '';
  const n = daysBetween(spell.start, spell.end || spell.start);
  const days = n == null ? '' : ` (${n + 1} day${n === 0 ? '' : 's'})`;
  return `${fmtShort(spell.start)} – ${fmtShort(spell.end || spell.start)}${days}`;
}

// ---- Hatch date / age --------------------------------------------------------------

export function ageLabel(hatchDate, today = isoDay()) {
  const n = daysBetween(hatchDate, today);
  if (n == null || n < 0) return '';
  if (n < 14) return `${n} day${n === 1 ? '' : 's'} old`;
  if (n < 70) return `${Math.floor(n / 7)} weeks old`;
  const months = Math.floor(n / 30.44);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} old`;
  const y = Math.floor(months / 12), m = months % 12;
  return `${y} yr${y === 1 ? '' : 's'}${m ? ` ${m} mo` : ''} old`;
}

// All brooder batches (they live on the incubator hobby, which may be hidden),
// newest first, with a summary of where the chicks went.
export function brooderHistory(data) {
  const inc = ((data && data.hobbies) || []).find((h) => h && (h.id === 'incubator' || h.type === 'incubator'));
  const flocks = [];
  for (const h of (data && data.hobbies) || []) {
    if (h && h.type === 'egg_layers') (h.flocks || []).forEach((f) => flocks.push(f));
    if (h && h.type === 'meat_chickens') (h.currentBatches || []).forEach((b) => flocks.push({ id: b.id, name: b.name || 'Meat birds' }));
  }
  const flockName = (id) => (flocks.find((f) => f.id === id) || {}).name || 'a flock';
  return (((inc && inc.brooderBatches) || []).filter(Boolean))
    .map((b) => {
      const disp = Array.isArray(b.dispositions) ? b.dispositions : [];
      const sum = (type) => disp.filter((x) => x && x.type === type).reduce((n, x) => n + (Number(x.count) || 0), 0);
      const moved = disp.filter((x) => x && x.type === 'moved_to_flock');
      const out = sum('moved_to_flock') + sum('sold') + sum('died');
      const initial = Number(b.initialCount) || 0;
      return {
        id: b.id,
        name: b.name || `${b.birdType || 'Chicks'}`,
        hatchDate: b.startDate || null,
        birdType: b.birdType || '',
        source: b.source || (b.sourceBatchId ? 'Incubator' : ''),
        initial,
        moved: sum('moved_to_flock'),
        movedTo: [...new Set(moved.map((x) => flockName(x.targetFlockId)))],
        movedFlockIds: [...new Set(moved.map((x) => x.targetFlockId).filter(Boolean))],
        sold: sum('sold'),
        died: sum('died'),
        remaining: Math.max(0, initial - out),
        active: !b.archived && initial - out > 0,
      };
    })
    .sort((a, b) => String(b.hatchDate || '').localeCompare(String(a.hatchDate || '')));
}

// Brooder batches whose chicks went into this flock: quick picks for a
// bird's hatch date.
export function hatchChoicesForFlock(data, flockId) {
  return brooderHistory(data).filter((b) => b.hatchDate && b.movedFlockIds.includes(flockId));
}

// ---- Eggs by flock ------------------------------------------------------------------

const isEgg = (e) => e && (e.action === 'eggs' || e.action === 'eggs_laid');

// { today, week, month } for one flock. `basket` (today's in-app counter) is
// added to today and the totals, since those eggs are real but not saved yet.
export function flockEggSummary(entries, flockId, { today = isoDay(), basket = 0 } = {}) {
  let t = 0, w = 0, m = 0;
  for (const e of entries || []) {
    if (!isEgg(e) || e.flockId !== flockId || !e.date) continue;
    const ago = daysBetween(e.date, today);
    if (ago == null || ago < 0) continue;
    const n = Number(e.count) || 0;
    if (ago === 0) t += n;
    if (ago < 7) w += n;
    if (ago < 30) m += n;
  }
  const b = Math.max(0, Number(basket) || 0);
  return { today: t + b, week: w + b, month: m + b };
}

// Daily rows for a chart: [{ date, total, [flockId]: n }], sorted by date.
export function eggSeriesByFlock(entries, flocks = []) {
  const ids = new Set((flocks || []).map((f) => f.id));
  const byDate = new Map();
  for (const e of entries || []) {
    if (!isEgg(e) || !e.date) continue;
    const row = byDate.get(e.date) || { date: e.date, total: 0 };
    const n = Number(e.count) || 0;
    row.total += n;
    const key = ids.has(e.flockId) ? e.flockId : '_other';
    row[key] = (row[key] || 0) + n;
    byDate.set(e.date, row);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ---- Purchases -----------------------------------------------------------------------

const LOG_PURCHASE_LABEL = { infrastructure: 'Infrastructure' };

// Every purchase, newest first: Add Expense rows (incl. feed-tracker buys)
// plus infrastructure logs with a cost. Daily feed/bedding logs are left out
// on purpose: their cost is what was used that day, not a purchase.
// Recurring expenses appear once (their start), marked `repeats`.
export function collectPurchases(data) {
  const out = [];
  const hobbies = (data && data.hobbies) || [];
  const hobbyName = (id) => {
    const h = hobbies.find((x) => x && x.id === id);
    return h ? String(h.name || h.type || '').replace(/\s*\p{Extended_Pictographic}️?\s*$/u, '').trim() : '';
  };
  for (const x of (data && data.expenses) || []) {
    if (!x || !x.date || !(Number(x.amount) > 0)) continue;
    const note = String(x.note || '').trim();
    const fromTracker = /^Feed purchase:/i.test(note);
    const item = !note || fromTracker ? (x.category || 'Purchase') : note;
    out.push({
      id: `x:${x.id}`, date: x.date, amount: Number(x.amount) || 0,
      item: item.slice(0, 80), category: x.category || 'Other',
      detail: fromTracker ? note.replace(/^Feed purchase:\s*/i, '') : '',
      hobby: hobbyName(x.hobbyId), repeats: x.recurrence && x.recurrence !== 'none' ? x.recurrence : null,
    });
  }
  for (const h of hobbies) {
    if (!h) continue;
    for (const e of (data.entries && data.entries[h.id]) || []) {
      if (!e || !e.date || !(Number(e.cost) > 0) || !LOG_PURCHASE_LABEL[e.action]) continue;
      const note = String(e.note || e.notes || '').trim();
      const label = LOG_PURCHASE_LABEL[e.action];
      out.push({
        id: `e:${h.id}:${e.id}`, date: e.date, amount: Number(e.cost) || 0,
        item: (e.item || note || label).slice(0, 80),
        category: label, detail: '', hobby: hobbyName(h.id), repeats: null,
      });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);
}

// Group purchases into "items" (same wording, ignoring case, sizes and
// punctuation) with last bought, last price, times bought and the typical
// gap between buys.
export function itemKey(label) {
  return String(label || '').toLowerCase()
    .replace(/\d+(\.\d+)?\s*(lbs?|pounds?|oz|kg|g|bags?|ct|count|pk|pack|gal|gallons?)\b/g, ' ')
    .replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim() || 'purchase';
}

export function lastBoughtByItem(purchases, today = isoDay()) {
  const groups = new Map();
  for (const p of purchases || []) {
    const k = itemKey(p.item);
    const g = groups.get(k) || { key: k, item: p.item, dates: [], last: null };
    g.dates.push(p.date);
    if (!g.last || p.date > g.last.date) { g.last = p; g.item = p.item; }
    groups.set(k, g);
  }
  return [...groups.values()].map((g) => {
    const ds = [...new Set(g.dates)].sort();
    let gap = null;
    if (ds.length > 1) {
      const span = daysBetween(ds[0], ds[ds.length - 1]);
      gap = span != null ? Math.round(span / (ds.length - 1)) : null;
    }
    return {
      key: g.key, item: g.item, lastDate: g.last.date, lastAmount: g.last.amount, category: g.last.category,
      times: g.dates.length, everyDays: gap, daysAgo: daysBetween(g.last.date, today),
    };
  }).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

export function agoLabel(days) {
  if (days == null) return '';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30.44)} months ago`;
}

// ---- Long ranges on a line chart --------------------------------------------------
// A chart with one point per day turns into a solid block after a few months
// (five years is ~1,800 points on a 300px phone chart). Rows are { date:
// "YYYY-MM-DD", ...numbers }. Up to 120 days stay daily; up to two years are
// summed by week (starting Monday); anything longer is summed by month. Each
// row gets a short `label` ("Nov 5", "Wk of Nov 2", "Nov '26") for the axis.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function ymd(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
function isoOf(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function chartPeriodRows(rows) {
  const list = (rows || []).filter((r) => r && r.date).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) return { rows: [], by: 'day' };
  const days = (ymd(list[list.length - 1].date) - ymd(list[0].date)) / 86400000;
  const multiYear = list[0].date.slice(0, 4) !== list[list.length - 1].date.slice(0, 4);
  if (days <= 120) {
    return { by: 'day', rows: list.map((r) => { const d = ymd(r.date); return { ...r, label: `${MON[d.getMonth()]} ${d.getDate()}${multiYear ? ` '${String(d.getFullYear()).slice(2)}` : ''}` }; }) };
  }
  const by = days <= 730 ? 'week' : 'month';
  const groups = new Map();
  for (const r of list) {
    const d = ymd(r.date);
    let key;
    if (by === 'week') { const s = new Date(d); s.setDate(d.getDate() - ((d.getDay() + 6) % 7)); key = isoOf(s); } else key = r.date.slice(0, 7) + '-01';
    const g = groups.get(key) || { date: key };
    for (const [k, v] of Object.entries(r)) if (k !== 'date' && k !== 'label' && typeof v === 'number') g[k] = (g[k] || 0) + v;
    groups.set(key, g);
  }
  const out = [...groups.values()].sort((a, b) => a.date.localeCompare(b.date)).map((g) => {
    const d = ymd(g.date);
    const yy = `'${String(d.getFullYear()).slice(2)}`;
    return { ...g, label: by === 'week' ? `${MON[d.getMonth()]} ${d.getDate()}${multiYear ? ` ${yy}` : ''}` : `${MON[d.getMonth()]} ${yy}` };
  });
  return { by, rows: out };
}
