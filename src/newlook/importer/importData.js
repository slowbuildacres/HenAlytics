// ============================================================================
// Spreadsheet import (3.0) — reading the file and turning rows into logs
// ----------------------------------------------------------------------------
// People bring egg counts, garden harvests and sales from Excel or Google
// Sheets. We read .xlsx (read-excel-file, first sheet, loaded on demand), .csv, or cells
// pasted straight from a spreadsheet (tab separated), guess which column is
// which from the headings, and build the same records the app's own forms
// save. Every imported record carries `importId`, so one Undo takes the whole
// import back out.
// ============================================================================

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const newId = () => Math.random().toString(36).slice(2, 10);

// ---- reading ------------------------------------------------------------------
export function parseDelimited(text) {
  const src = String(text || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const first = src.split("\n").find((l) => l.trim()) || "";
  const count = (ch) => (first.match(new RegExp(ch === "\t" ? "\t" : `\\${ch}`, "g")) || []).length;
  const delim = count("\t") > 0 ? "\t" : count(";") > count(",") ? ";" : ",";
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"' && cell === "") q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

export async function readFile(file) {
  const name = String(file && file.name || "").toLowerCase();
  if (/\.xlsx$/.test(name)) {
    const { readSheet } = await import("read-excel-file/browser");
    const rows = await readSheet(file);
    return rows.map((r) => r.map((c) => (c == null ? "" : c))).filter((r) => r.some((c) => String(c).trim() !== ""));
  }
  if (/\.xls$/.test(name) || /\.numbers$/.test(name)) throw new Error("Save it as .xlsx or .csv first (File › Save As or Export), then try again.");
  return parseDelimited(await file.text());
}

// ---- values ---------------------------------------------------------------------
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
export function toDate(v, dayFirst = false) {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v)) return iso(new Date(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  if (typeof v === "number" && v > 20000 && v < 80000) { // Excel day number
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return iso(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    let y = +m[3]; if (y < 100) y += 2000;
    return dayFirst ? valid(y, +m[2], +m[1]) : valid(y, +m[1], +m[2]);
  }
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m && MONTHS[m[1].slice(0, 4).toLowerCase()] != null) return valid(+m[3], MONTHS[m[1].slice(0, 4).toLowerCase()] + 1, +m[2]);
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()] != null) return valid(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()] + 1, +m[2]);
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()] != null) return valid(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()] + 1, +m[1]);
  return null;
}
function valid(y, mo, d) {
  if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  return dt.getMonth() === mo - 1 ? iso(dt) : null;
}
// Numbers as people type them: "$1,234.56", "€ 3,00", "1.234,56", "2,5 kg",
// "1 234,50", "(12.50)". A comma followed by 1-2 digits (or after the last
// dot) is a decimal comma, as European spreadsheets write it; "1,234" is a
// thousands separator.
export function toNum(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v == null ? "" : v).trim();
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[$€£¥₹\s\u00a0']/g, "").replace(/[a-z]+\.?$/i, "");
  if (!s) return null;
  const comma = s.includes(","), dot = s.includes(".");
  if (comma && dot) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (comma) s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}

// Do slashed dates look day-first (13/04/2026)? Look for a first part > 12.
export function looksDayFirst(rows, col) {
  let dayFirst = 0, monthFirst = 0, dotted = 0, seen = 0;
  for (const r of rows.slice(0, 200)) {
    const m = String(r[col] == null ? "" : r[col]).trim().match(/^(\d{1,2})([-/.])(\d{1,2})[-/.]\d{2,4}$/);
    if (!m) continue;
    seen++;
    if (m[2] === ".") dotted++;
    if (+m[1] > 12) dayFirst++;
    if (+m[3] > 12) monthFirst++;
  }
  if (monthFirst > 0) return false;
  // One odd row shouldn't flip a whole US-style sheet: a few clear day-first
  // dates, or dates written with dots (05.08.2026 — European; US sheets never
  // use dots), or a clear one in a very small file.
  return dayFirst >= 2 || (seen > 0 && dotted >= seen / 2) || (dayFirst >= 1 && seen <= 5);
}

// ---- columns --------------------------------------------------------------------
export const KIND_FIELDS = {
  eggs: [
    { key: "date", label: "Date", need: true, re: /date|day|when/i },
    { key: "count", label: "Eggs", need: true, multi: true, re: /egg|count|collected|laid|total|qty|quantity|#/i },
    { key: "note", label: "Notes", re: /note|comment/i },
  ],
  harvest: [
    { key: "date", label: "Date", need: true, re: /date|day|when/i },
    { key: "crop", label: "Crop", need: true, re: /crop|plant|veg|item|what|produce|variety/i },
    { key: "qty", label: "Amount", need: true, re: /lb|pound|weight|oz|kg|kilo|gram|qty|quantity|amount|count|harvest|menge|poids|peso/i },
    { key: "unit", label: "Unit (lbs, oz, each…)", re: /^unit|units/i },
    { key: "note", label: "Notes", re: /note|comment/i },
  ],
  sales: [
    { key: "date", label: "Date", need: true, re: /date|day|when/i },
    { key: "amount", label: "Total", need: true, re: /total|amount|revenue|\$|price|paid|income|sold for|money/i },
    { key: "item", label: "What sold", re: /item|what|product|crop|description|sold/i },
    { key: "qty", label: "How many", re: /qty|quantity|count|dozen|how many|#/i },
    { key: "buyer", label: "Buyer", re: /buyer|customer|who|sold to|name/i },
    { key: "note", label: "Notes", re: /note|comment/i },
  ],
};

export function headerRow(rows) {
  const r = rows[0] || [];
  const nonNum = r.filter((c) => String(c).trim() !== "" && toNum(c) == null && !toDate(c)).length;
  return nonNum >= Math.max(1, Math.ceil(r.filter((c) => String(c).trim() !== "").length / 2));
}

export function columnNames(rows, hasHeader) {
  const width = Math.max(0, ...rows.slice(0, 50).map((r) => r.length));
  return Array.from({ length: width }, (_, i) => {
    const h = hasHeader && rows[0] ? String(rows[0][i] == null ? "" : rows[0][i]).trim() : "";
    return h || `Column ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ""}`;
  });
}

// { date: 0, count: [1, 2], crop: 3 … } — -1 / [] when nothing fits.
export function guessColumns(kind, rows, hasHeader) {
  const names = columnNames(rows, hasHeader);
  const body = hasHeader ? rows.slice(1) : rows;
  const used = new Set();
  const out = {};
  // Either order counts here ("19.08.2026" is only a date day-first); which
  // order the column uses is worked out when the rows are built.
  const anyDate = (v) => toDate(v) || toDate(v, true);
  const dateCol = names.findIndex((_, i) => body.slice(0, 20).filter((r) => anyDate(r[i])).length >= Math.min(3, body.length));
  for (const f of KIND_FIELDS[kind]) {
    if (f.key === "date") { out.date = dateCol; if (dateCol >= 0) used.add(dateCol); continue; }
    const byName = names.map((n, i) => (f.re.test(n) && !used.has(i) ? i : -1)).filter((i) => i >= 0);
    const numeric = (i) => body.slice(0, 20).filter((r) => toNum(r[i]) != null).length >= Math.min(3, body.length);
    if (f.multi) {
      let cols = byName.filter(numeric);
      // A "Total" column next to per-flock columns would count eggs twice.
      const total = cols.find((i) => /total/i.test(names[i]));
      if (total != null) cols = [total];
      // No telling headings (e.g. "Coop A", "Coop B"): every number column.
      if (!cols.length) cols = names.map((_, i) => i).filter((i) => !used.has(i) && numeric(i) && !/note|comment|price|\$|cost/i.test(names[i]));
      cols.forEach((i) => used.add(i));
      out[f.key] = cols;
    } else {
      const wantNum = ["qty", "amount"].includes(f.key);
      let i = byName.find((x) => (wantNum ? numeric(x) : true));
      if (i == null && f.need) i = names.map((_, x) => x).find((x) => !used.has(x) && (wantNum ? numeric(x) : !numeric(x) && !toDate(body[0] && body[0][x])));
      out[f.key] = i == null ? -1 : i;
      if (i != null && i >= 0) used.add(i);
    }
  }
  return out;
}

// ---- building records -------------------------------------------------------------
const unitOf = (u, header) => {
  const s = String(u || header || "").toLowerCase();
  if (/\bkgs?\b|kilo/.test(s)) return "kg";
  if (/\bg\b|\bgr\b|grams?\b/.test(s)) return "g";
  if (/oz|ounce/.test(s)) return "oz";
  if (/each|count|ea\b|pcs|piece/.test(s)) return "each";
  if (/bunch/.test(s)) return "bunch";
  if (/pint/.test(s)) return "pints";
  if (/quart/.test(s)) return "quarts";
  return "lbs";
};
const cleanText = (v) => String(v == null ? "" : v).trim().slice(0, 120);

// Returns { records: [...], skipped: n, preview: [{date, a, b}] }
export function buildRecords(kind, rows, hasHeader, cols, opts) {
  const body = hasHeader ? rows.slice(1) : rows;
  const names = columnNames(rows, hasHeader);
  const dayFirst = cols.date >= 0 && looksDayFirst(body, cols.date);
  const importId = opts.importId;
  const now = Date.now();
  const records = [];
  let skipped = 0;
  for (const r of body) {
    const date = cols.date >= 0 ? toDate(r[cols.date], dayFirst) : null;
    if (!date) { skipped++; continue; }
    const note = cols.note >= 0 ? cleanText(r[cols.note]) : "";
    if (kind === "eggs") {
      const n = (cols.count || []).reduce((t, i) => t + (toNum(r[i]) || 0), 0);
      if (!(n > 0)) { skipped++; continue; }
      records.push({ id: newId(), date, action: "eggs_laid", count: Math.round(n), flockId: opts.flockId || null, birdType: opts.birdType || "Chicken", note, created: now, importId });
    } else if (kind === "harvest") {
      const qty = toNum(r[cols.qty]);
      const plant = cleanText(r[cols.crop]);
      if (!(qty > 0) || !plant) { skipped++; continue; }
      const suffix = (String(r[cols.qty] == null ? "" : r[cols.qty]).match(/[a-z]+\.?\s*$/i) || [""])[0];
      records.push({ id: newId(), date, action: "harvested", plant, quantity: qty, unit: unitOf(cols.unit >= 0 ? r[cols.unit] : suffix, names[cols.qty]), seasonId: opts.seasonFor ? opts.seasonFor(date) : null, notes: note, created: now, importId });
    } else {
      const amount = toNum(r[cols.amount]);
      if (!(amount > 0)) { skipped++; continue; }
      const qty = cols.qty >= 0 ? toNum(r[cols.qty]) || 0 : 0;
      const item = cols.item >= 0 ? cleanText(r[cols.item]) : "";
      const sale = { id: newId(), date, hobbyType: opts.hobbyType || "other", qty, totalRevenue: Math.round(amount * 100) / 100, note: [item && opts.hobbyType !== "garden" ? item : "", cols.buyer >= 0 ? cleanText(r[cols.buyer]) ? `Sold to ${cleanText(r[cols.buyer])}` : "" : "", note].filter(Boolean).join(" · "), buyerId: null, tip: 0, created: now, importId };
      if (opts.hobbyType === "eggs") Object.assign(sale, { eggType: "Chicken", eggPurpose: "Eating", unit: /egg/i.test(names[cols.qty] || "") && !/doz/i.test(names[cols.qty] || "") ? "eggs" : "dozen", pricePerUnit: qty ? Math.round((amount / qty) * 100) / 100 : 0 });
      if (opts.hobbyType === "garden") Object.assign(sale, { crop: item || "Produce", gardenUnit: "lbs", pricePerUnit: qty ? Math.round((amount / qty) * 100) / 100 : 0 });
      if (item && opts.hobbyType !== "eggs" && opts.hobbyType !== "garden") sale.item = item;
      records.push(sale);
    }
  }
  return { records, skipped };
}

// Days a flock already has eggs logged (so a re-import doesn't double up).
export function loggedEggDays(entries, flockId) {
  const s = new Set();
  for (const e of entries || []) if (e && (e.action === "eggs" || e.action === "eggs_laid") && (!flockId || !e.flockId || e.flockId === flockId)) s.add(e.date);
  return s;
}
