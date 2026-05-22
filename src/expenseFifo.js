// ============================================================================
// expenseFifo.js — per-hobby FIFO expense matching for the Sales tab
// ----------------------------------------------------------------------------
// LEAF MODULE: imports nothing from the app. Pure functions only.
//
// What this does:
//   Given a user's full data, extracts all expenses tagged to each hobby and
//   all sales, then matches them FIFO — oldest expense is "consumed" first by
//   each sale (within the same hobby). Returns per-hobby and aggregate stats
//   that are dramatically more honest than period-bucket comparisons.
//
// Per-hobby FIFO means: feed for the goats is consumed only by goat sales,
// not by tomato sales. A homesteader who's $400 deep in goat feed but only
// sold $50 of goat milk has an unmatched-backlog of $350 on goats. They
// also see it explicitly broken out so they know which hobby is the drag.
//
// Excluded categories (per Riley's call, May 2026):
//   - "infrastructure" entries — these are one-time, durable, capital-like
//     costs (coops, fencing, brooders). Including them in FIFO would make
//     a brand-new hobby look unprofitable for years even when the *ongoing*
//     economics are healthy. Excluded from both totals and backlog.
//
// Hobby ID ↔ sale.hobbyType mapping:
//   Sales use singular flat-livestock types ("horse", "cow", etc.) while
//   data.entries[] is keyed by hobby ID ("horses", "cows"). The SALE_TO_HOBBY
//   table reconciles them. Sales without a mapped hobby (or with hobbyType
//   "other") are still counted in totals but have no expenses to match.
// ============================================================================

// ---------------------------------------------------------------------------
// Mapping: sale.hobbyType  →  hobby.id (where the expenses live)
// ---------------------------------------------------------------------------
// Sales tab and hobby pages were built at different times so names diverged.
// This table is the single source of truth for "where do the expenses for
// this kind of sale live?"
//
// Keep this in sync with Sales.jsx's HOBBY_META + LIVESTOCK_HOBBY_ID.
export const SALE_TO_HOBBY = {
  eggs:          "egg_layers",
  honey:         "bees",
  meat_chickens: "meat_chickens",
  rabbits:       "rabbits",
  rabbit:        "rabbits",
  garden:        "garden",
  farmstand:     "farmstand",
  sourdough:     "sourdough",
  baking:        "baking",
  canning:       "canning",
  tincture:      "canning",
  oil_infusion:  "canning",
  salve:         "canning",
  tea:           "canning",
  incubator:     "incubator",
  horse:         "horses",
  cow:           "cows",
  goat:          "goats",
  sheep:         "sheep",
  pig:           "pigs",
  dog:           "dogs",
  cat:           "cats",
  maple_syrup:   "maple_syrup",
  // "other" intentionally absent — those sales have revenue but no matchable
  // expense bucket.
};

// Display labels for hobby IDs. Used by the chart and backlog list when
// rendering per-hobby breakdowns. Mirrors Sales.jsx's HOBBY_META labels
// (keyed by hobby ID, not sale.hobbyType).
export const HOBBY_LABEL = {
  egg_layers:    { label: "Eggs",         emoji: "🥚" },
  bees:          { label: "Honey",        emoji: "🍯" },
  meat_chickens: { label: "Meat Birds",   emoji: "🍗" },
  rabbits:       { label: "Rabbits",      emoji: "🐇" },
  garden:        { label: "Garden",       emoji: "🌱" },
  farmstand:     { label: "Farm Stand",   emoji: "🧾" },
  sourdough:     { label: "Sourdough",    emoji: "🍞" },
  baking:        { label: "Baking",       emoji: "🥧" },
  canning:       { label: "Preserving",   emoji: "🫙" },
  incubator:     { label: "Chicks",       emoji: "🐣" },
  horses:        { label: "Horses",       emoji: "🐴" },
  cows:          { label: "Cattle",       emoji: "🐄" },
  goats:         { label: "Goats",        emoji: "🐐" },
  sheep:         { label: "Sheep",        emoji: "🐑" },
  pigs:          { label: "Pigs",         emoji: "🐷" },
  dogs:          { label: "Dogs",         emoji: "🐕" },
  cats:          { label: "Cats",         emoji: "🐈" },
  maple_syrup:   { label: "Maple Syrup",  emoji: "🍁" },
  other:         { label: "Other",        emoji: "💰" },
};

// Actions in data.entries[hobbyId] that represent recurring/consumable costs.
// "infrastructure" is intentionally excluded (one-time capital — distorts
// FIFO matching). "restock" is included because it's Farmstand's per-batch
// inventory cost — the actual cost of goods sold.
const EXPENSE_ACTIONS = new Set([
  "fed",
  "bedding",
  "fertilized",
  "supplies",
  "restock",
]);

// ---------------------------------------------------------------------------
// Extract all expenses for a given hobby ID into a flat, dated, normalized list
// ---------------------------------------------------------------------------
// Returns: [{ date, cost, source, note }] sorted oldest→newest.
//
// Sources of expenses considered:
//   1. data.entries[hobbyId][] with action in EXPENSE_ACTIONS and cost > 0
//   2. hobby.flocks[].cost + flock.history[].cost  (egg_layers initial buys)
//   3. hobby.currentBatches[].chickCost + archivedBatches[]  (meat_chickens)
//   4. hobby.hives[].cost  (bees) — one-time hive purchase, but it IS the
//      consumable startup cost for honey production, so include it
//   5. hobby.animals[].purchaseCost  (livestock — if/when that field exists)
//
// Note: this is read-only. We never mutate input data.

// Expand recurring expense templates into virtual occurrences. Mirrors the
// expansion logic in Sales.jsx but kept local so this leaf module imports
// nothing. Each virtual occurrence carries _parentId for traceability.
function _addMonthsIsoExp(isoStr, months) {
  const [y, m, d] = isoStr.split("-").map(Number);
  const base = new Date(y, (m - 1) + months, d);
  if (base.getDate() !== d) base.setDate(0);
  return _isoDateExp(base);
}
function _addDaysIsoExp(isoStr, days) {
  const [y, m, d] = isoStr.split("-").map(Number);
  return _isoDateExp(new Date(y, m - 1, d + days));
}
function _isoDateExp(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function _expandRecurringExpenses(expenses) {
  const out = [];
  const today = new Date();
  const horizon = _isoDateExp(new Date(today.getFullYear() + 2, today.getMonth(), today.getDate()));
  for (const e of (expenses || [])) {
    if (!e || !e.recurrence || e.recurrence === "none") {
      out.push(e);
      continue;
    }
    const skipped = new Set(Array.isArray(e.skippedDates) ? e.skippedDates : []);
    const stop = (e.recurEnd && e.recurEnd < horizon) ? e.recurEnd : horizon;
    let n = 0;
    let guard = 0;
    while (guard < 1000) {
      let cursor;
      if (e.recurrence === "daily") cursor = _addDaysIsoExp(e.date, n);
      else if (e.recurrence === "weekly") cursor = _addDaysIsoExp(e.date, n * 7);
      else if (e.recurrence === "biweekly") cursor = _addDaysIsoExp(e.date, n * 14);
      else if (e.recurrence === "monthly") cursor = _addMonthsIsoExp(e.date, n);
      else if (e.recurrence === "yearly") cursor = _addMonthsIsoExp(e.date, n * 12);
      else { cursor = e.date; }
      if (cursor > stop) break;
      if (!skipped.has(cursor)) out.push({ ...e, date: cursor });
      if (!["daily", "weekly", "biweekly", "monthly", "yearly"].includes(e.recurrence)) break;
      n += 1;
      guard += 1;
    }
  }
  return out;
}

export function extractHobbyExpenses(data, hobbyId) {
  const out = [];
  if (!data || !hobbyId) return out;

  // (1) Entry-based expenses
  const entries = (data.entries && data.entries[hobbyId]) || [];
  for (const e of entries) {
    if (!EXPENSE_ACTIONS.has(e.action)) continue;
    const cost = Number(e.cost) || 0;
    if (cost <= 0) continue;
    if (!e.date) continue;
    out.push({
      date: e.date,
      cost,
      source: e.action,
      note: e.note || e.item || e.product || "",
    });
  }

  // Find the hobby object for structural costs
  const hobby = (data.hobbies || []).find((h) => h.id === hobbyId);
  if (!hobby) {
    return out.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }

  // (2) Egg layers — per-flock purchase cost (and history adds)
  if (Array.isArray(hobby.flocks)) {
    for (const fl of hobby.flocks) {
      // Prefer history (richer; each add is dated). Fall back to flock.cost +
      // flock.startDate only if no history entries are present.
      if (Array.isArray(fl.history) && fl.history.length > 0) {
        for (const h of fl.history) {
          const c = Number(h.cost) || 0;
          if (c <= 0 || !h.date) continue;
          out.push({ date: h.date, cost: c, source: "flock_purchase", note: `${fl.name || "Flock"} (${h.count || "?"} birds)` });
        }
      } else if (fl.cost && fl.startDate) {
        const c = Number(fl.cost) || 0;
        if (c > 0) out.push({ date: fl.startDate, cost: c, source: "flock_purchase", note: fl.name || "Flock" });
      }
    }
  }

  // (3) Meat chickens — chick purchase cost per batch
  const batches = [
    ...(hobby.currentBatches || []),
    ...(hobby.archivedBatches || []),
  ];
  for (const b of batches) {
    const c = Number(b.chickCost) || 0;
    if (c <= 0) continue;
    const d = b.startDate || b.date;
    if (!d) continue;
    out.push({ date: d, cost: c, source: "chick_purchase", note: b.name || `Batch ${b.id || ""}` });
  }

  // (4) Bees — hive setup costs (treated as the startup-for-honey)
  if (Array.isArray(hobby.hives)) {
    for (const hv of hobby.hives) {
      const c = Number(hv.cost) || 0;
      if (c <= 0) continue;
      const d = hv.startDate || hv.installDate || hv.date;
      if (!d) continue;
      out.push({ date: d, cost: c, source: "hive_purchase", note: hv.name || "Hive" });
    }
  }

  // (5) Livestock animals — purchase cost if present
  if (Array.isArray(hobby.animals)) {
    for (const a of hobby.animals) {
      const c = Number(a.purchaseCost || a.cost) || 0;
      if (c <= 0) continue;
      const d = a.purchaseDate || a.acquiredDate || a.dob || a.startDate;
      if (!d) continue;
      out.push({ date: d, cost: c, source: "animal_purchase", note: a.name || "Animal" });
    }
  }

  // (6) User-logged expenses from the Sales tab's "+ Log expense" button.
  // These live in data.expenses[] with an optional hobbyId. Entries with
  // a matching hobbyId are pulled into this hobby's FIFO pool; entries
  // with no hobbyId are treated as general overhead (handled elsewhere
  // by computeFifoStats, not here).
  const userExpenses = _expandRecurringExpenses(Array.isArray(data.expenses) ? data.expenses : []);
  for (const ex of userExpenses) {
    if (ex.hobbyId !== hobbyId) continue;
    const cost = Number(ex.amount) || 0;
    if (cost <= 0 || !ex.date) continue;
    out.push({
      date: ex.date,
      cost,
      source: "logged_expense",
      note: ex.note || ex.category || "Expense",
    });
  }

  return out.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

// Sum of "general overhead" — user-logged expenses with no hobbyId.
// These are real money out the door but can't be attributed to a single
// hobby for FIFO matching, so we subtract them from netProfit as a
// flat overhead deduction.
export function generalOverheadTotal(data, window) {
  const userExpenses = _expandRecurringExpenses(Array.isArray(data.expenses) ? data.expenses : []);
  let total = 0;
  for (const ex of userExpenses) {
    if (ex.hobbyId) continue; // hobby-attributed expenses handled by extractHobbyExpenses
    const cost = Number(ex.amount) || 0;
    if (cost <= 0 || !ex.date) continue;
    if (window && window.start && ex.date < window.start) continue;
    if (window && window.end && ex.date > window.end) continue;
    total += cost;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Normalize a sale into the shape FIFO matching needs
// ---------------------------------------------------------------------------
// We need: { date, revenue, hobbyId }
// hobbyId is the *expense bucket* hobby — looked up via SALE_TO_HOBBY.
// If a sale has no mapped hobby, hobbyId is null and FIFO skips it for
// matching (but its revenue still counts in totals).
export function normalizeSale(sale) {
  const date = sale.date || "";
  const revenue = computeSaleRevenue(sale);
  const hobbyId = SALE_TO_HOBBY[sale.hobbyType] || null;
  return { date, revenue, hobbyId, raw: sale };
}

// Mirrors Sales.jsx computeRevenue but kept here so this module stands alone.
// Worth keeping in sync if computeRevenue ever changes meaningfully.
function computeSaleRevenue(sale) {
  if (sale.totalRevenue != null) return Number(sale.totalRevenue) || 0;
  const qty = Number(sale.qty) || 0;
  const price = Number(sale.pricePerUnit) || 0;
  return qty * price;
}

// ---------------------------------------------------------------------------
// Filter a date by an inclusive [start,end] window (YYYY-MM-DD)
// ---------------------------------------------------------------------------
// Both bounds optional. Returns true if the date falls inside the window.
// "Inside" means lexicographic comparison since YYYY-MM-DD sorts correctly.
function inWindow(date, window) {
  if (!window) return true;
  if (!date) return false;
  if (window.start && date < window.start) return false;
  if (window.end && date > window.end) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Core FIFO matcher: consume expenses oldest-first against sales by date
// ---------------------------------------------------------------------------
// Inputs:
//   expenses: [{ date, cost, source, note }]  — already sorted oldest→newest
//   sales:    [{ date, revenue }]             — for a single hobby
//
// Returns:
//   { consumed, unmatched, revenue, profit }
//     consumed  = total expense $ that was matched against sales
//     unmatched = total expense $ NOT yet matched (the backlog)
//     revenue   = total sale $ in the window
//     profit    = revenue - consumed
//
// Algorithm: walk sales in date order; for each sale, consume from the
// expense queue (oldest first) until the sale's revenue is "covered" — once
// the queue's running consumed amount catches up to the sale's revenue,
// stop. If the queue runs out, the sale is partially uncovered (which is
// fine — that's actual profit). Whatever's left in the queue at the end
// is the unmatched backlog.
//
// One subtlety: an expense whose date is AFTER the last sale's date can
// still be "available" to a sale that hasn't happened yet — but for this
// snapshot view, we just count it as backlog. Real FIFO accounting would
// be tighter, but homestead users care about "have my sales paid back my
// inputs so far?" which this answers honestly.
export function fifoMatch(expenses, sales) {
  // Copy + sort defensively — caller should already have done this but
  // a future caller might forget.
  const exp = [...expenses].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const sal = [...sales].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const totalRevenue = sal.reduce((s, x) => s + (Number(x.revenue) || 0), 0);
  const totalExpense = exp.reduce((s, x) => s + (Number(x.cost) || 0), 0);

  // FIFO: consume up to totalRevenue worth of expenses, oldest first.
  // This is the simplest correct interpretation: each dollar of revenue
  // "pays off" a dollar of the oldest still-unpaid expense.
  let consumed = 0;
  let remaining = totalRevenue;
  for (const e of exp) {
    if (remaining <= 0) break;
    const take = Math.min(e.cost, remaining);
    consumed += take;
    remaining -= take;
  }

  const unmatched = Math.max(0, totalExpense - consumed);
  const profit = totalRevenue - consumed;

  return { consumed, unmatched, revenue: totalRevenue, profit };
}

// ---------------------------------------------------------------------------
// TOP-LEVEL: compute everything the Sales tab needs for a given window
// ---------------------------------------------------------------------------
// Returns:
//   {
//     window,                  // echoed back
//     totalRevenue,            // sum of revenue across all hobbies in window
//     totalExpenses,           // sum of expenses consumed (FIFO-matched)
//     netProfit,               // totalRevenue - totalExpenses
//     byHobby: [               // sorted by profit desc
//       { hobbyId, label, emoji, revenue, consumed, profit, unmatched }
//     ],
//     backlog: [               // sorted by unmatched desc — backlog rows
//       { hobbyId, label, emoji, unmatched }
//     ],
//     totalBacklog,            // sum of all unmatched (for reference)
//   }
//
// Window filtering happens at the SALE level — we only include sales whose
// date falls in [window.start, window.end]. Expenses are NOT window-filtered
// because the FIFO concept is "this revenue paid off this much of my prior
// spending, oldest first." If you bought feed in March and sold eggs in
// May, the March feed should count against the May sale even if the user
// is viewing "May only." That's the whole point of FIFO over period buckets.
//
// However, unmatched backlog DOES exclude expenses dated AFTER the window
// end, because those are "future" costs that haven't been incurred yet from
// the viewing perspective.
export function computeFifoStats(data, window) {
  const sales = (data.sales || []).map(normalizeSale);
  const inWindowSales = sales.filter((s) => inWindow(s.date, window));

  // Group sales by hobbyId. Sales with no mapped hobby still go into a
  // bucket so their revenue is included in totals, but they get no expense
  // matching (no expense bucket exists).
  const salesByHobby = {};
  for (const s of inWindowSales) {
    const key = s.hobbyId || "_unmapped";
    (salesByHobby[key] = salesByHobby[key] || []).push(s);
  }

  // Collect every hobby that has either sales or expenses (so backlog-only
  // hobbies still appear).
  const allHobbyIds = new Set(Object.keys(salesByHobby).filter((k) => k !== "_unmapped"));
  for (const h of (data.hobbies || [])) allHobbyIds.add(h.id);

  const byHobby = [];
  let totalRevenue = 0;
  let totalConsumed = 0;
  let totalBacklog = 0;

  for (const hobbyId of allHobbyIds) {
    const hobbySales = salesByHobby[hobbyId] || [];
    // Expenses: filter to those dated on or before window.end (if set).
    // Don't filter by window.start — older expenses are still consumable.
    let expenses = extractHobbyExpenses(data, hobbyId);
    if (window && window.end) {
      expenses = expenses.filter((e) => !e.date || e.date <= window.end);
    }

    if (hobbySales.length === 0 && expenses.length === 0) continue;

    const { consumed, unmatched, revenue, profit } = fifoMatch(expenses, hobbySales);
    const meta = HOBBY_LABEL[hobbyId] || { label: hobbyId, emoji: "•" };
    byHobby.push({
      hobbyId,
      label: meta.label,
      emoji: meta.emoji,
      revenue,
      consumed,
      profit,
      unmatched,
    });
    totalRevenue += revenue;
    totalConsumed += consumed;
    totalBacklog += unmatched;
  }

  // Add unmapped-revenue sales to the totals (they have no expense to match)
  const unmappedSales = salesByHobby["_unmapped"] || [];
  for (const s of unmappedSales) totalRevenue += s.revenue;

  // General overhead — user-logged expenses with no hobby attribution.
  // Counted in totals + netProfit but not attributed to any per-hobby
  // bucket (no FIFO matching possible).
  const overhead = generalOverheadTotal(data, window);

  // Sort: profit desc for chart, unmatched desc for backlog list
  byHobby.sort((a, b) => b.profit - a.profit);
  const backlog = byHobby
    .filter((h) => h.unmatched > 0)
    .map((h) => ({ hobbyId: h.hobbyId, label: h.label, emoji: h.emoji, unmatched: h.unmatched }))
    .sort((a, b) => b.unmatched - a.unmatched);

  return {
    window: window || null,
    totalRevenue,
    totalExpenses: totalConsumed + overhead,
    overhead,
    netProfit: totalRevenue - totalConsumed - overhead,
    byHobby,
    backlog,
    totalBacklog,
  };
}

// ---------------------------------------------------------------------------
// Date window helpers (used by the Sales-tab window selector)
// ---------------------------------------------------------------------------
function pad2(n) { return String(n).padStart(2, "0"); }
function ymd(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

// Returns YYYY-MM-DD bounds for the named window. "all" returns no bounds
// (the caller treats null as "no filter"). All windows are inclusive.
export function resolveWindow(windowKey, now) {
  const today = now instanceof Date ? now : new Date();
  switch (windowKey) {
    case "month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: ymd(start), end: ymd(today) };
    }
    case "quarter": {
      const qStartMonth = Math.floor(today.getMonth() / 3) * 3;
      const start = new Date(today.getFullYear(), qStartMonth, 1);
      return { start: ymd(start), end: ymd(today) };
    }
    case "year": {
      const start = new Date(today.getFullYear(), 0, 1);
      return { start: ymd(start), end: ymd(today) };
    }
    case "twelve_months": {
      const start = new Date(today.getFullYear(), today.getMonth() - 11, 1);
      return { start: ymd(start), end: ymd(today) };
    }
    case "all":
    default:
      return null;
  }
}

export const WINDOW_OPTIONS = [
  { key: "month",         label: "This month" },
  { key: "quarter",       label: "This quarter" },
  { key: "year",          label: "This year" },
  { key: "twelve_months", label: "Last 12 months" },
  { key: "all",           label: "All time" },
];
