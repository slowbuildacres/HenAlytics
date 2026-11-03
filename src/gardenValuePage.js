// ============================================================================
// GARDEN VALUE PAGE: the public "What's your garden worth?" calculator at
// henalytics.com/garden-value (entry: /garden-value.html).
// ----------------------------------------------------------------------------
// Standalone, plain DOM, no React, no network, no analytics. All pricing goes
// through ./gardenValue.js, the same module the app's garden home uses, so
// the page and the app can never disagree about what a harvest is worth.
//
// State lives in localStorage (best effort) so a refresh keeps the list.
// ============================================================================

import { unitSlot, priceFor, computeHarvestValue, plantKey } from "./gardenValue.js";

const STORAGE_KEY = "henalytics.gardenValue.v1";
const SHARE_URL = "henalytics.com/garden-value";

const UNITS = ["lbs", "oz", "each", "bunch", "pints", "quarts", "cups", "kg"];
const UNIT_SINGULAR = { lbs: "lb", oz: "oz", each: "each", bunch: "bunch", pints: "pint", quarts: "quart", cups: "cup", kg: "kg" };
const SLOT_LABEL = { lb: "per lb", each: "each", bunch: "per bunch" };

// Display names for the crop suggestions. Every one of these matches a
// specific entry in DEFAULT_PRICES (not the fallback); prices are never
// stored here.
const SUGGESTIONS = [
  "Tomatoes", "Cherry tomatoes", "Zucchini", "Summer squash", "Butternut squash",
  "Acorn squash", "Spaghetti squash", "Pumpkins", "Cucumbers", "Bell peppers",
  "Jalapeños", "Hot peppers", "Green beans", "Snap peas", "Peas", "Sweet corn",
  "Potatoes", "Sweet potatoes", "Onions", "Garlic", "Shallots", "Leeks",
  "Carrots", "Beets", "Radishes", "Turnips", "Parsnips", "Lettuce",
  "Salad greens", "Spinach", "Kale", "Swiss chard", "Collards", "Arugula",
  "Cabbage", "Broccoli", "Cauliflower", "Brussels sprouts", "Celery",
  "Eggplant", "Okra", "Asparagus", "Rhubarb", "Strawberries", "Blueberries",
  "Raspberries", "Blackberries", "Grapes", "Apples", "Pears", "Peaches",
  "Plums", "Cherries", "Figs", "Watermelon", "Cantaloupe", "Basil",
  "Cilantro", "Parsley", "Dill", "Mint",
];

// ---------- helpers ----------
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function money(n) {
  return usd.format(n || 0);
}

// "38", "38.5", "1,200" → number; anything else → 0.
function parseAmount(s) {
  const n = Number(String(s ?? "").replace(/[,$\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parsePrice(s) {
  const t = String(s ?? "").replace(/[,$\s]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function blankRow() {
  return { id: uid(), name: "", qty: "", unit: "lbs", price: null };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.rows)) return null;
    const rows = data.rows
      .filter((r) => r && typeof r === "object")
      .map((r) => ({
        id: uid(),
        name: String(r.name ?? ""),
        qty: String(r.qty ?? ""),
        unit: UNITS.includes(r.unit) ? r.unit : "lbs",
        price: r.price == null || r.price === "" ? null : String(r.price),
      }));
    return { rows: rows.length ? rows : [blankRow()], spent: String(data.spent ?? "") };
  } catch {
    return null;
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      rows: state.rows.map(({ name, qty, unit, price }) => ({ name, qty, unit, price })),
      spent: state.spent,
    }));
  } catch {
    // Private mode, storage full or blocked: the calculator still works.
  }
}

// ---------- state ----------
const state = load() || { rows: [blankRow()], spent: "" };

// Custom prices keyed the way gardenValue.js expects:
// { "<plant key>": { lb, each, bunch } }. Rows that share a plant and price
// slot share one price, exactly as they do in the app.
function buildOverrides() {
  const overrides = {};
  for (const r of state.rows) {
    if (!r.name.trim() || r.price == null) continue;
    const p = parsePrice(r.price);
    if (p == null) continue;
    const { slot } = unitSlot(r.unit);
    const k = plantKey(r.name);
    overrides[k] = overrides[k] || {};
    if (overrides[k][slot] == null) overrides[k][slot] = p;
  }
  return overrides;
}

function harvests() {
  return state.rows
    .filter((r) => r.name.trim() && parseAmount(r.qty) > 0)
    .map((r) => ({ plant: r.name.trim(), quantity: parseAmount(r.qty), unit: r.unit }));
}

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const list = $("crops");
const addBtn = $("add");
const spentInput = $("spent");
const totalEl = $("total");
const balanceEl = $("balance");
const shareBtn = $("share");
const shareStatus = $("share-status");

const datalist = $("crop-list");
for (const s of SUGGESTIONS) {
  const o = document.createElement("option");
  o.value = s;
  datalist.appendChild(o);
}

const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
shareBtn.textContent = canShare ? "Share my total" : "Copy my total";

const rowEls = new Map(); // row id → { li, name, qty, unit, price, value, slotLabel, note, reset }

function el(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k in n && typeof v !== "string") n[k] = v;
    else n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return n;
}

function renderRow(row) {
  const base = `crop-${row.id}`;
  const name = el("input", {
    class: "field crop-name", id: `${base}-name`, type: "text", list: "crop-list",
    placeholder: "Crop, e.g. Tomatoes", autocomplete: "off", autocapitalize: "words",
    enterkeyhint: "next", "aria-label": "Crop",
  });
  name.value = row.name;
  const remove = el("button", { class: "remove", type: "button", "aria-label": "Remove this crop", text: "×" });

  const qty = el("input", {
    class: "field qty", id: `${base}-qty`, type: "text", inputmode: "decimal",
    placeholder: "Amount", autocomplete: "off", "aria-label": "Amount",
  });
  qty.value = row.qty;
  const unit = el("select", { class: "field unit", id: `${base}-unit`, "aria-label": "Unit" },
    UNITS.map((u) => el("option", { value: u, text: u })));
  unit.value = row.unit;
  const value = el("output", { class: "crop-value", for: `${base}-qty ${base}-unit ${base}-price` });

  const price = el("input", {
    class: "field price", id: `${base}-price`, type: "text", inputmode: "decimal",
    autocomplete: "off", "aria-label": "Price",
  });
  const slotLabel = el("span", { class: "slot" });
  const note = el("span", { class: "note" });
  const reset = el("button", { class: "reset", type: "button" });

  const li = el("li", { class: "crop" }, [
    el("div", { class: "crop-top" }, [name, remove]),
    el("div", { class: "crop-mid" }, [qty, unit, value]),
    el("div", { class: "crop-price" }, [
      el("label", { class: "price-label", for: `${base}-price` }, ["at", el("span", { class: "price-box" }, [price]), slotLabel]),
      note,
      reset,
    ]),
  ]);

  name.addEventListener("input", () => { row.name = name.value; update(); });
  qty.addEventListener("input", () => { row.qty = qty.value; update(); });
  unit.addEventListener("change", () => {
    const before = unitSlot(row.unit).slot;
    row.unit = unit.value;
    // A custom price per lb means nothing once the row is counted "each".
    if (unitSlot(row.unit).slot !== before) row.price = null;
    update();
  });
  price.addEventListener("input", () => {
    row.price = price.value.trim() === "" ? null : price.value;
    // Same plant + slot share one price (as in the app), so carry it over.
    const k = plantKey(row.name);
    const { slot } = unitSlot(row.unit);
    for (const other of state.rows) {
      if (other !== row && plantKey(other.name) === k && unitSlot(other.unit).slot === slot) other.price = row.price;
    }
    update();
  });
  price.addEventListener("blur", () => update());
  reset.addEventListener("click", () => {
    const k = plantKey(row.name);
    const { slot } = unitSlot(row.unit);
    for (const r of state.rows) {
      if (plantKey(r.name) === k && unitSlot(r.unit).slot === slot) r.price = null;
    }
    update();
  });
  remove.addEventListener("click", () => {
    if (state.rows.length === 1) {
      Object.assign(row, { name: "", qty: "", unit: "lbs", price: null });
      name.value = ""; qty.value = ""; unit.value = "lbs";
      update();
      name.focus();
      return;
    }
    const i = state.rows.indexOf(row);
    state.rows.splice(i, 1);
    rowEls.delete(row.id);
    li.remove();
    update();
    const next = state.rows[Math.min(i, state.rows.length - 1)];
    rowEls.get(next.id)?.name.focus();
  });

  rowEls.set(row.id, { li, name, qty, unit, price, value, slotLabel, note, reset, remove });
  list.appendChild(li);
  return rowEls.get(row.id);
}

function unitNote(unit) {
  if (unit === "oz") return "16 oz = 1 lb";
  const { slot, factor } = unitSlot(unit);
  if (slot !== "lb" || factor === 1) return "";
  return `1 ${UNIT_SINGULAR[unit]} ≈ ${+factor.toFixed(2)} lb`;
}

function update() {
  const overrides = buildOverrides();
  const result = computeHarvestValue(harvests(), overrides);

  for (const row of state.rows) {
    const r = rowEls.get(row.id);
    if (!r) continue;
    const { slot, factor } = unitSlot(row.unit);
    const named = row.name.trim() !== "";
    const eff = priceFor(named ? row.name : "", slot, overrides);
    const def = priceFor(named ? row.name : "", slot);

    // Keep the price box in step with the effective price, except while
    // the visitor is typing in it.
    if (document.activeElement !== r.price) {
      r.price.value = eff.price.toFixed(2);
      if (row.price != null) row.price = eff.custom ? r.price.value : null;
    }
    r.price.classList.toggle("custom", eff.custom);
    r.slotLabel.textContent = SLOT_LABEL[slot];
    r.note.textContent = unitNote(row.unit);
    r.note.hidden = !r.note.textContent;
    r.reset.hidden = !eff.custom || eff.price === def.price;
    r.reset.textContent = `Reset to ${money(def.price)}`;

    const qty = parseAmount(row.qty);
    const v = named && qty > 0 ? +(qty * factor * eff.price).toFixed(2) : 0;
    r.value.textContent = money(v);
    r.value.classList.toggle("empty", v === 0);
    r.remove.setAttribute("aria-label", named ? `Remove ${row.name.trim()}` : "Remove this crop");
  }

  const total = result.total;
  const dollars = Math.floor(total);
  const cents = Math.round((total - dollars) * 100);
  totalEl.textContent = usdWhole.format(dollars);
  if (cents > 0) totalEl.appendChild(el("span", { class: "cents", text: String(cents).padStart(2, "0") }));
  totalEl.setAttribute("aria-label", money(total));
  totalEl.dataset.total = String(total);

  const spent = parseAmount(state.spent);
  balanceEl.className = "balance";
  if (spent > 0) {
    const net = +(total - spent).toFixed(2);
    if (net >= 0) {
      balanceEl.textContent = `You spent ${money(spent)}, so you're ahead by ${money(net)}.`;
      balanceEl.classList.add("ahead");
    } else {
      balanceEl.textContent = `You spent ${money(spent)}. ${money(-net)} to break even.`;
      balanceEl.classList.add("behind");
    }
  } else {
    balanceEl.textContent = total > 0 ? "" : "Add a crop and an amount to see what it's worth.";
  }

  shareBtn.disabled = total <= 0;
  save();
  return result;
}

function shareText() {
  const total = computeHarvestValue(harvests(), buildOverrides()).total;
  return `My garden grew ${usdWhole.format(Math.round(total))} of food this year 🌱 (calculated with Henalytics: ${SHARE_URL})`;
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = el("textarea", { readonly: "" });
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

let statusTimer;
function setStatus(msg) {
  clearTimeout(statusTimer);
  shareStatus.textContent = msg;
  if (msg) statusTimer = setTimeout(() => { shareStatus.textContent = ""; }, 6000);
}

shareBtn.addEventListener("click", async () => {
  const text = shareText();
  if (canShare) {
    try {
      await navigator.share({ text });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return; // they closed the sheet
      // Otherwise fall back to copying.
    }
  }
  if (await copyText(text)) setStatus("Copied. Paste it wherever you like.");
  else setStatus(text);
});

addBtn.addEventListener("click", () => {
  const row = blankRow();
  state.rows.push(row);
  const r = renderRow(row);
  update();
  r.name.focus();
});

spentInput.value = state.spent;
spentInput.addEventListener("input", () => { state.spent = spentInput.value; update(); });

for (const row of state.rows) renderRow(row);
update();
