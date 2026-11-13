// ============================================================================
// SALES PAGE
// ----------------------------------------------------------------------------
// Unified sales log across all hobbies. Tracks eggs (eating/hatching, by bird
// type), honey (by form/container), meat chickens, rabbits, garden produce,
// and custom items. Includes a customer directory for repeat buyers.
//
// Data lives in:
//   data.sales[]     — individual sale entries
//   data.customers[] — repeat buyer directory
//
// Backwards compat: old sold_eggs entries in data.entries["egg_layers"] are
// read alongside data.sales for egg revenue stats (never deleted).
// ============================================================================

import { legacyPalette } from "./newlook/legacyTheme.js";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { X, Plus, Edit3, Trash2, ChevronDown, User } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { fmtMoney, fmtMoneyWhole, perLbToInput, perLbFromInput, perWeightLabel, lbsToInput, lbsFromInput, weightUnitLabel, fmtWeight, currencySymbol } from "./units.js";
import { computeFifoStats, computeSimpleStats, resolveWindow, WINDOW_OPTIONS, extractHobbyExpenses, extractBuildCosts } from "./expenseFifo.js";
import { askConfirm, askChoice } from "./newlook/ConfirmHost.jsx";
import { unwindAnimalSale } from "./animalSale.js";
import { restockForSale, unwindShelfSale } from "./saleLinks.js";

const palette = legacyPalette({
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47", featherSoft: "#C9A77B",
  honey: "#E8961A", honeySoft: "#F5C96A",
  line: "#2C181030", card: "#FAF5EA",
});
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

const inputStyle = () => ({
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
});

// Generate a unique ID. Prefers crypto.randomUUID() (available on all modern
// browsers + iOS/Android WebViews); falls back to Math.random for ancient
// runtimes.
const newId = () => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (_) {}
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6)
  );
};
const parseLocalDate = (s) => { if (!s) return new Date(); const [y,m,d] = s.split("-").map(Number); return new Date(y,(m||1)-1,d||1); };
const localDateStr = (date) => { const d = date instanceof Date ? date : new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const todayStr = () => localDateStr(new Date());
const fmtDate = (s) => { if (!s) return ""; return parseLocalDate(s).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); };
const thisMonthStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };

// Hobby type colors and labels
const HOBBY_META = () => ({
  eggs:          { label: "Eggs",          emoji: "🥚", color: palette.yolk },
  honey:         { label: "Honey",         emoji: "🍯", color: palette.honey },
  meat_chickens: { label: "Meat Birds", emoji: "🍗", color: palette.feather },
  rabbits:       { label: "Rabbits",       emoji: "🐇", color: palette.leaf },
  rabbit:        { label: "Rabbits",       emoji: "🐇", color: palette.leaf },
  garden:        { label: "Garden",        emoji: "🌱", color: palette.leaf },
  farmstand:     { label: "Farm Stand",    emoji: "🧾", color: palette.leaf },
  sourdough:     { label: "Sourdough",     emoji: "🍞", color: palette.yolk },
  baking:        { label: "Baking",        emoji: "🥧", color: palette.yolk },
  canning:       { label: "Canning",       emoji: "🫙", color: palette.leafSoft },
  tincture:      { label: "Tinctures",     emoji: "🌿", color: palette.leaf },
  oil_infusion:  { label: "Oil Infusions", emoji: "🫒", color: palette.leaf },
  salve:         { label: "Salves",        emoji: "🪻", color: palette.leaf },
  tea:           { label: "Tea Blends",    emoji: "🍵", color: palette.leaf },
  incubator:     { label: "Chicks",         emoji: "🐣", color: palette.yolkSoft },
  horse:         { label: "Horses",        emoji: "🐴", color: palette.feather },
  cow:           { label: "Cattle",        emoji: "🐄", color: palette.feather },
  goat:          { label: "Goats",         emoji: "🐐", color: palette.leaf },
  sheep:         { label: "Sheep",         emoji: "🐑", color: palette.yolk },
  pig:           { label: "Pigs",          emoji: "🐷", color: palette.accent },
  dog:           { label: "Dogs",          emoji: "🐕", color: palette.feather },
  cat:           { label: "Cats",          emoji: "🐈", color: palette.feather },
  maple_syrup:   { label: "Maple Syrup",   emoji: "🍁", color: palette.honey },
  // Soap sales (from Soap Making) showed as "Other" without this.
  soap:          { label: "Soap",          emoji: "🧼", color: palette.leaf },
  other:         { label: "Other",         emoji: "💰", color: palette.inkSoft },
});

const EGG_TYPES = ["Chicken", "Duck", "Goose", "Turkey", "Quail", "Guinea", "Peafowl", "Other"];

// Livestock that sell as one flat-priced transaction per animal (qty is always
// 1, pricePerUnit === totalRevenue === the flat sale price). Horses were the
// original member; cow/goat/sheep/pig/dog/cat were added later and write the
// SAME sale shape from their hobby pages. The Sales edit modal must treat them
// identically to horses or the flat price is lost on edit (Bug 5).
// "rabbit" is a rabbit sold as an animal from the Rabbits page (meat sales
// are "rabbits"); without it here, editing one dropped its name and type.
const LIVESTOCK_FLAT_TYPES = ["horse", "cow", "goat", "sheep", "pig", "dog", "cat", "rabbit"];
// Things sold by the piece from a hobby's shelf. Their pages log the sale;
// the Sales edit form shows item, unit, how many and price for them.
const SHELF_TYPES = ["tincture", "oil_infusion", "salve", "tea", "soap", "maple_syrup"];
const SHELF_WORDS = { tincture: "Bottles", oil_infusion: "Bottles", salve: "Tins", tea: "Sachets or oz", soap: "Bars", maple_syrup: "Bottles or jars" };
// Maps a flat-livestock sale's hobbyType to the matching hobby id, so the edit
// modal can offer a "sell an existing animal" dropdown for any of them.
const LIVESTOCK_HOBBY_ID = { horse: "horses", cow: "cows", goat: "goats", sheep: "sheep", pig: "pigs", dog: "dogs", cat: "cats", rabbit: "rabbits" };
const EGG_PURPOSES = ["Eating", "Hatching"];
const HONEY_FORMS = ["Raw comb", "Extracted", "Creamed", "Infused"];
const HONEY_CONTAINERS = ["Half-pint jar (1 cup)", "Pint jar (2 cups)", "Quart jar", "Half-gallon", "Gallon", "Bulk lb"];
const MEAT_FORMS = ["Whole bird", "Cuts / pieces", "Live bird"];
const RABBIT_FORMS = ["Whole rabbit", "Cuts / pieces", "Live rabbit"];

// ============================================================================
// COMPUTE REVENUE from a sale entry
// ============================================================================
export function computeRevenue(sale) {
  if (sale.totalRevenue != null) return Number(sale.totalRevenue) || 0;
  const qty = Number(sale.qty) || 0;
  const price = Number(sale.pricePerUnit) || 0;
  if (sale.hobbyType === "farmstand") {
    return qty * price;
  }
  if (sale.hobbyType === "baking" || sale.hobbyType === "canning") {
    // Both flow through Baking/Canning pages with totalRevenue prefilled (caught
    // by the early return above), but fall back to qty × pricePerUnit if a
    // user creates the sale directly from the Sales tab.
    return qty * price;
  }
  // Herbalism types — tincture, oil infusion, salve, tea. Each sub-page
  // prefills totalRevenue when creating the sale (caught by early-return
  // above); the fallback below handles direct-from-Sales-tab creation,
  // and computes qty × pricePerUnit which is the natural model for all
  // four (bottles × $/bottle, tins × $/tin, sachets × $/sachet, oz × $/oz).
  if (sale.hobbyType === "tincture" || sale.hobbyType === "oil_infusion" ||
      sale.hobbyType === "salve" || sale.hobbyType === "tea") {
    return qty * price;
  }
  if (sale.hobbyType === "eggs") {
    if (sale.unit === "dozen") return (qty * price);
    if (sale.unit === "eggs") return (qty / 12) * price; // price is per dozen
    return qty * price;
  }
  if (sale.pricingMethod === "per_lb") {
    return qty * (Number(sale.avgWeightLbs) || 1) * (Number(sale.pricePerLb) || 0);
  }
  return qty * price;
}

// ============================================================================
// DERIVE REVENUE from a legacy sold_eggs entry
// ----------------------------------------------------------------------------
// Different versions of the sold_eggs form have written different field
// combinations over time. A user reported that sales were landing in the
// Sales tab at $0 because the original derivation only looked at
// `e.pricePerDozen` — which can be missing on entries created before the
// unit-based selling form was introduced, or when the form's derivation
// guard didn't fire (e.g. empty unitQty at save time).
//
// Try every known shape before giving up at 0. Returns { revenue,
// pricePerDozen } so callers can use both. Mirrors the matching helper in
// HomesteadApp.jsx so the migration and read-time paths agree.
// ============================================================================
function deriveSoldEggsRevenue(e) {
  // qty starts from canonical e.count; if that's missing we'll derive from
  // unitQty × eggsPerUnit below. Returning the derived qty lets the sales
  // log display "12 eggs" instead of "0 eggs" for entries where the save-
  // time derivation never ran.
  let qty = Number(e.count) || 0;
  let pricePerDozen = Number(e.pricePerDozen) || 0;
  let revenue = 0;
  if (pricePerDozen > 0 && qty > 0) {
    // Canonical path — current form writes both fields.
    revenue = (qty / 12) * pricePerDozen;
  } else if (Number(e.unitQty) > 0) {
    // Form-fields path — raw inputs survived but derivation didn't run.
    // Price intentionally NOT required: $0 sales (donated / given away
    // eggs) are real and their egg count must still derive. Mirrors the
    // same fix in HomesteadApp.jsx and YearInReview.jsx.
    const unitToCount = {
      single: 1, half_dozen: 6, dozen: 12, eighteen: 18, flat: 30,
      custom: Number(e.customEggsPerUnit) || 0,
    };
    const eggsPerUnit = unitToCount[e.unit] || 12;
    const totalEggs = Number(e.unitQty) * eggsPerUnit;
    revenue = Number(e.unitQty) * (Number(e.pricePerUnit) || 0);
    if (totalEggs > 0) {
      pricePerDozen = revenue / (totalEggs / 12);
      if (qty === 0) qty = totalEggs;
    }
  } else if (Number(e.pricePerUnit) > 0 && qty > 0) {
    // Old-old shape — pricePerUnit was stored as $/dozen with total eggs in count.
    pricePerDozen = Number(e.pricePerUnit);
    revenue = (qty / 12) * pricePerDozen;
  } else if (Number(e.totalRevenue) > 0) {
    // Last-ditch — entry has a stashed totalRevenue from some other path.
    revenue = Number(e.totalRevenue);
    if (qty > 0) pricePerDozen = revenue / (qty / 12);
  }
  return { revenue, pricePerDozen, qty };
}

// ============================================================================
// FUNCTION
// ============================================================================
function Btn({ children, onClick, variant="primary", small=false, style={}, type="button", disabled=false }) {
  const styles = {
    primary: { background: palette.ink, color: palette.bg, border: `1.5px solid ${palette.ink}` },
    danger:  { background: palette.accent, color: palette.onColor, border: `1.5px solid ${palette.accent}` },
    ghost:   { background: "transparent", color: palette.ink, border: `1.5px solid ${palette.line}` },
    accent:  { background: palette.yolk, color: palette.onYolk, border: `1.5px solid ${palette.ink}` },
  };
  return (
    <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled} style={{minHeight: small ? 36 : 44, 
      padding: small ? "6px 12px" : "10px 18px", borderRadius: small ? 999 : 14,
      cursor: disabled ? "not-allowed" : "pointer", fontFamily: FONT_BODY,
      fontWeight: 600, fontSize: small ? 13 : 14, opacity: disabled ? 0.6 : 1,
      boxShadow: "none", ...styles[variant], ...style,
    }}>{children}</button>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

// ============================================================================
// ADD / EDIT SALE MODAL — 3-step wizard
// ============================================================================
export function AddSaleModal({ data, update, onClose, existingSale }) {
  const isEdit = !!existingSale;
  const customers = data.customers || [];
  const visibleHobbies = (data.hobbies || []).filter(h => !h.hidden);

  const [step, setStep] = useState(isEdit ? 2 : 1);
  const [hobbyType, setHobbyType] = useState(existingSale?.hobbyType || "eggs");

  // Shared fields
  const [date, setDate] = useState(existingSale?.date || todayStr());
  const [qty, setQty] = useState(existingSale?.qty != null ? String(existingSale.qty) : "");
  // Sales logged on a hobby page keep their note in `notes`.
  const [note, setNote] = useState(existingSale?.note || existingSale?.notes || "");
  // Tip — extra a customer leaves beyond the item price. Optional, applies to
  // any sale type. Kept separate from revenue so it shows as its own line.
  const [tip, setTip] = useState(existingSale?.tip != null ? String(existingSale.tip) : "");
  const [buyerId, setBuyerId] = useState(existingSale?.buyerId || "");
  const [newBuyerName, setNewBuyerName] = useState("");
  const [showNewBuyer, setShowNewBuyer] = useState(false);

  // Eggs
  const [eggType, setEggType] = useState(existingSale?.eggType || "Chicken");
  // When eggType is "Other", we capture a free-text name so users with less
  // common species (emu, ostrich, partridge, etc.) can still log sales.
  const [eggTypeCustom, setEggTypeCustom] = useState(existingSale?.eggTypeCustom || "");
  const [eggPurpose, setEggPurpose] = useState(existingSale?.eggPurpose || "Eating");
  const [unit, setUnit] = useState(existingSale?.unit || "dozen");
  // Imported sales and some older ones carry only a total: show the price
  // it works out to, rather than a blank that would save the sale at $0.
  const derivedPrice = (() => {
    const s = existingSale;
    if (!s || s.pricePerUnit != null || s.pricingMethod === "per_lb" || s.pricingMethod === "flat") return "";
    const q = Number(s.qty) || 0; const r = Number(s.totalRevenue) || 0;
    if (!(q > 0 && r > 0)) return "";
    const per = s.hobbyType === "eggs" && String(s.unit || "eggs") === "eggs" ? q / 12 : q;
    return String(Math.round((r / per) * 100) / 100);
  })();
  const [pricePerUnit, setPricePerUnit] = useState(existingSale?.pricePerUnit != null ? String(existingSale.pricePerUnit) : derivedPrice);

  // Honey
  const [honeyForm, setHoneyForm] = useState(existingSale?.honeyForm || "Extracted");
  const [honeyContainer, setHoneyContainer] = useState(existingSale?.honeyContainer || "Pint jar (2 cups)");

  // Meat / rabbits
  const [saleForm, setSaleForm] = useState(existingSale?.saleForm || "Whole bird");
  const [pricingMethod, setPricingMethod] = useState(existingSale?.pricingMethod || "per_bird");
  // Meat sold by weight is typed in lbs or kg (and price per lb or kg);
  // stored per lb. For other sales pricePerLb holds a cost per unit.
  const byWeight = existingSale?.pricingMethod === "per_lb";
  const [pricePerLb, setPricePerLb] = useState(existingSale?.pricePerLb != null ? (byWeight ? perLbToInput(existingSale.pricePerLb) : String(existingSale.pricePerLb)) : "");
  const [avgWeightLbs, setAvgWeightLbs] = useState(existingSale?.avgWeightLbs != null ? lbsToInput(existingSale.avgWeightLbs) : "");

  // Garden
  const [crop, setCrop] = useState(existingSale?.crop || "");
  const [gardenUnit, setGardenUnit] = useState(existingSale?.gardenUnit || "lbs");

  // Other
  // An animal sale keeps sold / leased / rehomed in saleType (the form uses
  // otherItem for it); reading it here keeps a lease a lease on edit.
  const [otherItem, setOtherItem] = useState(existingSale?.otherItem || (existingSale?.hobbyType === "other" ? existingSale?.crop || "" : LIVESTOCK_FLAT_TYPES.includes(existingSale?.hobbyType) ? existingSale?.saleType || "" : ""));
  const [flatPrice, setFlatPrice] = useState(existingSale?.flatPrice != null ? String(existingSale.flatPrice) : (existingSale?.hobbyType === "other" && existingSale?.totalRevenue != null ? String(existingSale.totalRevenue) : ""));

  // What the money fields said when the form opened. If they're unchanged on
  // save (only the date, buyer or note was fixed), the sale keeps its total.
  const moneyNow = () => JSON.stringify([qty, pricePerUnit, flatPrice, pricePerLb, avgWeightLbs, unit, pricingMethod]);
  const moneyAtOpen = useRef(null);
  if (moneyAtOpen.current == null) moneyAtOpen.current = moneyNow();

  // Incubator / chicks (brooder sales). birdType + brooderBatchName are
  // free-text so the user can edit if needed; the underlying brooder batch
  // is the source of truth for "remaining chicks", but the sale is editable
  // on its own.
  const [chickBirdType, setChickBirdType] = useState(existingSale?.birdType || "Chicken");
  const [chickBrooderName, setChickBrooderName] = useState(existingSale?.brooderBatchName || "");

  // Horse-sale: if user picks an existing horse from the dropdown, this
  // holds its id. On save, the matching horse is archived in the Horses
  // hobby so the user doesn't have to do that step manually.
  const [selectedAnimalId, setSelectedAnimalId] = useState(existingSale?.animalId || "");

  // Compute preview revenue
  const previewRevenue = useMemo(() => {
    const q = Number(qty) || 0;
    if (hobbyType === "eggs") {
      if (unit === "dozen") return q * (Number(pricePerUnit) || 0);
      return (q / 12) * (Number(pricePerUnit) || 0);
    }
    if (hobbyType === "honey") return q * (Number(pricePerUnit) || 0);
    if (hobbyType === "meat_chickens" || hobbyType === "rabbits") {
      if (pricingMethod === "per_lb") return q * (Number(avgWeightLbs) || 0) * (Number(pricePerLb) || 0);
      if (pricingMethod === "per_bird") return q * (Number(pricePerUnit) || 0);
      return Number(flatPrice) || 0;
    }
    if (hobbyType === "farmstand") return q * (Number(pricePerUnit) || 0);
    if (hobbyType === "sourdough") return q * (Number(pricePerUnit) || 0);
    if (hobbyType === "baking") return q * (Number(pricePerUnit) || 0);
    if (hobbyType === "canning") return q * (Number(pricePerUnit) || 0);
    // Herbalism types follow qty × price pattern (bottles, tins, sachets, or oz)
    if (SHELF_TYPES.includes(hobbyType)) return q * (Number(pricePerUnit) || 0);
    if (LIVESTOCK_FLAT_TYPES.includes(hobbyType)) return Number(pricePerUnit) || 0;
    if (hobbyType === "garden") return q * (Number(pricePerUnit) || 0);
    if (hobbyType === "incubator") return q * (Number(pricePerUnit) || 0);
    return Number(flatPrice) || 0;
  }, [hobbyType, qty, unit, pricePerUnit, pricingMethod, avgWeightLbs, pricePerLb, flatPrice]);

  const availableHobbyTypes = useMemo(() => {
    const types = new Set(["other"]);
    visibleHobbies.forEach(h => {
      if (h.type === "egg_layers") types.add("eggs");
      else if (h.type === "bees") types.add("honey");
      else if (h.type === "meat_chickens") types.add("meat_chickens");
      else if (h.type === "rabbits") types.add("rabbits");
      else if (h.type === "garden") types.add("garden");
      else if (h.type === "sourdough") types.add("sourdough");
      else if (h.type === "baking") types.add("baking");
      else if (h.type === "canning") types.add("canning");
      else if (h.type === "tincture") types.add("tincture");
      else if (h.type === "oil_infusion") types.add("oil_infusion");
      else if (h.type === "salve") types.add("salve");
      else if (h.type === "tea") types.add("tea");
      else if (h.type === "horses") types.add("horse");
      else if (h.type === "incubator") types.add("incubator");
    });
    // Always include eggs and farmstand
    types.add("eggs");
    types.add("farmstand");
    return Array.from(types);
  }, [visibleHobbies]);

  const save = () => {
    let sale = {
      id: existingSale?.id || newId(),
      // A cleared date box saved a sale with no date, which no month, year
      // report or chart counts. Today instead.
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayStr(), hobbyType, qty: Number(qty) || 0,
      note, buyerId: buyerId || null,
      tip: Number(tip) || 0,
      created: existingSale?.created || Date.now(),
    };
    // Editing keeps where the sale came from: an order (so the order still
    // shows "In Sales" and isn't added twice), a farm stand item, how they paid.
    // The same goes for the batch it came off (salve tins, canning jars,
    // soap bars count their sales by batchId), its hobby, and an import.
    ["fromOrder", "fromOrderItem", "fromFarmstandItem", "payMethod", "batchId", "hobbyId", "fromCanningBatchId", "fromCanningEntryId", "fromBakeId", "importId", "flockId", "buyer", "customerName"].forEach((k) => { if (existingSale && existingSale[k] != null && existingSale[k] !== "") sale[k] = existingSale[k]; });

    if (hobbyType === "eggs") {
      sale = { ...sale, eggType, eggPurpose, unit, pricePerUnit: Number(pricePerUnit) || 0 };
      // Only persist the custom name when actually using "Other" — keeps
      // existing sales clean and prevents stale ghosts when users flip back
      // to a standard type.
      if (eggType === "Other") {
        sale.eggTypeCustom = eggTypeCustom.trim();
      } else if (existingSale?.eggTypeCustom) {
        // Explicitly drop the field if the user just switched away from
        // "Other" — otherwise the stale name would still be on the sale
        // object and pre-fill the input the next time it was opened.
        sale.eggTypeCustom = "";
      }
    } else if (hobbyType === "honey") {
      sale = { ...sale, honeyForm, honeyContainer, pricePerUnit: Number(pricePerUnit) || 0 };
    } else if (hobbyType === "meat_chickens" || hobbyType === "rabbits") {
      sale = { ...sale, saleForm, pricingMethod,
        pricePerLb: pricingMethod === "per_lb" ? perLbFromInput(pricePerLb) : Number(pricePerLb) || 0,
        avgWeightLbs: lbsFromInput(avgWeightLbs),
        pricePerUnit: Number(pricePerUnit) || 0,
        flatPrice: Number(flatPrice) || 0,
      };
    } else if (hobbyType === "farmstand") {
      const saleRev = (Number(qty)||0) * (Number(pricePerUnit)||0);
      const costTotal = (Number(qty)||0) * (Number(pricePerLb)||0);
      sale = { ...sale, crop, gardenUnit, pricePerUnit: Number(pricePerUnit)||0, costPerUnit: Number(pricePerLb)||0, totalRevenue: saleRev, totalCost: costTotal };
    } else if (hobbyType === "sourdough") {
      // Sourdough sales: loaf count × price per loaf, with optional cost per loaf
      // for profit math. Recipe goes in the `crop` field for consistency with farmstand.
      const saleRev = (Number(qty)||0) * (Number(pricePerUnit)||0);
      const costTotal = (Number(qty)||0) * (Number(pricePerLb)||0);
      sale = { ...sale, crop, pricePerUnit: Number(pricePerUnit)||0, costPerUnit: Number(pricePerLb)||0, totalRevenue: saleRev, totalCost: costTotal };
    } else if (hobbyType === "baking") {
      // Baking sales: item count × price per item, optional cost per item.
      // Recipe goes in `crop`, mirrors how Baking.jsx writes from its own page.
      const saleRev = (Number(qty)||0) * (Number(pricePerUnit)||0);
      const costTotal = (Number(qty)||0) * (Number(pricePerLb)||0);
      sale = { ...sale, crop, gardenUnit: gardenUnit || "items", pricePerUnit: Number(pricePerUnit)||0, costPerUnit: Number(pricePerLb)||0, totalRevenue: saleRev, totalCost: costTotal };
    } else if (hobbyType === "canning") {
      // Canning sales: jar count × price per jar, optional cost per jar.
      // Item name goes in `crop`, jar type in `gardenUnit` — mirrors Canning.jsx.
      const saleRev = (Number(qty)||0) * (Number(pricePerUnit)||0);
      const costTotal = (Number(qty)||0) * (Number(pricePerLb)||0);
      sale = { ...sale, crop, gardenUnit: gardenUnit || "jars", pricePerUnit: Number(pricePerUnit)||0, costPerUnit: Number(pricePerLb)||0, totalRevenue: saleRev, totalCost: costTotal };
    } else if (LIVESTOCK_FLAT_TYPES.includes(hobbyType)) {
      // Flat-livestock sales (horse/cow/goat/sheep/pig/dog/cat): one
      // transaction = one animal (or a lease). pricePerUnit is the flat
      // sale/lease price, qty is always 1, crop holds the animal's name.
      // Preserving pricePerUnit + totalPrice here is the Bug 5 fix: without
      // an explicit branch these fell to the `other` path, which dropped the
      // price and let `sale.totalRevenue = previewRevenue` (0) overwrite it.
      const saleRev = Number(pricePerUnit) || 0;
      // saleType (sold vs leased) goes in the otherItem field for now.
      // If the user picked an existing animal from the dropdown, animalId
      // travels with the sale so we can archive that animal on save.
      sale = { ...sale, crop, saleType: otherItem || "sold", pricePerUnit: saleRev, totalRevenue: saleRev };
      if (selectedAnimalId) sale.animalId = selectedAnimalId;
    } else if (SHELF_TYPES.includes(hobbyType)) {
      // Salve tins, tincture and oil bottles, tea, soap bars, syrup: what it
      // was, the unit, how many and the price each. The unit (tin size,
      // "bars", "oz" for loose tea) isn't on the form, so it stays as logged.
      sale = { ...sale, crop, pricePerUnit: Number(pricePerUnit) || 0 };
      if (existingSale?.gardenUnit != null) sale.gardenUnit = existingSale.gardenUnit;
      if (existingSale?.unit != null) sale.unit = existingSale.unit;
    } else if (hobbyType === "garden") {
      sale = { ...sale, crop, gardenUnit, pricePerUnit: Number(pricePerUnit) || 0 };
    } else if (hobbyType === "incubator") {
      // Chick sales (typically created automatically by the brooder
      // disposition flow, but also editable from here).
      // Preserve brooder backlink fields if present on the existing sale so
      // edits stay linked to the source disposition.
      sale = {
        ...sale,
        birdType: chickBirdType,
        brooderBatchName: chickBrooderName,
        pricePerUnit: Number(pricePerUnit) || 0,
      };
      if (existingSale?.brooderBatchId) sale.brooderBatchId = existingSale.brooderBatchId;
      if (existingSale?.dispositionId) sale.dispositionId = existingSale.dispositionId;
      if (existingSale?.hobbyId) sale.hobbyId = existingSale.hobbyId;
    } else {
      sale = { ...sale, otherItem, flatPrice: Number(flatPrice) || 0 };
    }

    sale.totalRevenue = isEdit && existingSale.totalRevenue != null && moneyNow() === moneyAtOpen.current
      ? Number(existingSale.totalRevenue) || 0
      : previewRevenue;

    // If new buyer name entered, create customer first
    let finalBuyerId = buyerId;
    if (showNewBuyer && newBuyerName.trim()) {
      // Someone already saved under that name (from an order, say): them.
      const nm = newBuyerName.trim().replace(/\s+/g, " ");
      const same = (customers || []).find((c) => c && String(c.name || "").trim().replace(/\s+/g, " ").toLowerCase() === nm.toLowerCase());
      finalBuyerId = same ? same.id : newId();
      sale.buyerId = finalBuyerId;
      if (!same) update(d => {
        d.customers = d.customers || [];
        d.customers.push({ id: finalBuyerId, name: nm, note: "" });
        return d;
      });
    }

    update(d => {
      d.sales = d.sales || [];
      if (isEdit) {
        const idx = d.sales.findIndex(s => s.id === sale.id);
        // Selling more or fewer off a batch moves its shelf count to match.
        if (idx !== -1 && d.sales[idx].hobbyType === sale.hobbyType) restockForSale(d, d.sales[idx], (Number(d.sales[idx].qty) || 0) - (Number(sale.qty) || 0));
        if (idx !== -1) d.sales[idx] = sale;
        else d.sales.push(sale);
      } else {
        d.sales.push(sale);
      }
      // If we just edited a legacy `sold_eggs` entry, remove the underlying
      // source so the editable copy in `d.sales` is the only version visible.
      // Without this, the entry would keep appearing alongside the edited copy
      // every time the user reopens the Sales tab.
      // A Sold Eggs log's copy (migratedFromEntries) is the same: once edited
      // here, Sales holds the numbers, so the log goes and eggs on hand
      // count this sale instead of the old log.
      if (isEdit && (existingSale?.isLegacy || existingSale?.migratedFromEntries) && d.entries?.["egg_layers"]) {
        d.entries["egg_layers"] = d.entries["egg_layers"].filter(
          e => !(e.action === "sold_eggs" && e.id === sale.id)
        );
      }
      // If the user picked an existing animal (horse) from the dropdown,
      // archive that animal so it disappears from the active herd list.
      // Skip on edits — we don't want to archive an animal that was already
      // archived by a prior save.
      if (!isEdit && LIVESTOCK_FLAT_TYPES.includes(hobbyType) && selectedAnimalId) {
        const livestockHobby = (d.hobbies || []).find(h => h.id === LIVESTOCK_HOBBY_ID[hobbyType]);
        if (livestockHobby) {
          const a = (livestockHobby.animals || []).find(x => x.id === selectedAnimalId);
          if (a && !a.archived) {
            a.archived = true;
            const verb = (otherItem || "sold") === "leased" ? "Leased" : otherItem === "rehomed" ? "Rehomed" : "Sold";
            const priceStr = Number(pricePerUnit) > 0 ? ` for ${fmtMoney(Number(pricePerUnit))}` : "";
            a.archivedReason = `${verb}${priceStr}`;
            a.archivedDate = date;
            a.saleId = sale.id;
          }
        }
      }
      // If editing a brooder-linked chick sale, sync the matching brooder
      // disposition so price/count/date/notes stay consistent between the
      // Sales tab and the Incubator page. The brooder's remaining-chick
      // count is derived from disposition counts, so changing qty here must
      // update the disposition or the brooder will look wrong.
      if (isEdit && hobbyType === "incubator" && sale.brooderBatchId && sale.dispositionId) {
        const incHobby = (d.hobbies || []).find(h => h.id === sale.hobbyId);
        const batch = incHobby?.brooderBatches?.find(b => b.id === sale.brooderBatchId);
        const disp = batch?.dispositions?.find(x => x.id === sale.dispositionId);
        if (disp) {
          disp.count = Number(sale.qty) || disp.count;
          disp.pricePerBird = Number(sale.pricePerUnit) || disp.pricePerBird;
          disp.date = sale.date;
          disp.notes = sale.note || "";
          if (sale.customerName != null) disp.soldTo = sale.customerName;
        }
      }
      return d;
    });
    onClose();
  };

  const buyer = customers.find(c => c.id === buyerId);

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(44,24,16,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:palette.bg,borderRadius:16,maxWidth:480,width:"100%",maxHeight:"92vh",overflow:"auto",border:`2px solid ${palette.ink}`,boxShadow:"0 12px 32px rgba(0,0,0,0.22)",fontFamily:FONT_BODY }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1.5px solid ${palette.line}` }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:22,color:palette.ink }}>{isEdit ? "Edit sale" : "Log a sale"}</div>
          <button onClick={onClose} aria-label="Close" style={{ background:"none",border:"none",cursor:"pointer",color:palette.ink,padding:4 }}><X size={22}/></button>
        </div>

        <div style={{ padding:20 }}>
          {/* Step 1: pick hobby type */}
          {step === 1 && (
            <>
              <div style={{ fontSize:13,color:palette.inkSoft,marginBottom:14 }}>What did you sell?</div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8,marginBottom:20 }}>
                {Object.entries(HOBBY_META()).filter(([k]) => availableHobbyTypes.includes(k)).map(([key, meta]) => (
                  <button key={key} onClick={() => { setHobbyType(key); setStep(2); }} style={{
                    padding:"14px 10px",background:palette.card,border:`1.5px solid ${palette.line}`,
                    borderRadius:10,cursor:"pointer",fontFamily:FONT_BODY,color:palette.ink,
                    display:"flex",flexDirection:"column",alignItems:"center",gap:6,
                    boxShadow:"none",
                  }}>
                    <span style={{ fontSize:28 }}>{meta.emoji}</span>
                    <span style={{ fontSize:13,fontWeight:600 }}>{meta.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 2: product details */}
          {step === 2 && (
            <>
              {!isEdit && (
                <button onClick={() => setStep(1)} style={{ background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,fontFamily:FONT_BODY,fontSize:13,padding:"0 0 14px",display:"flex",alignItems:"center",gap:4 }}>
                  ← {HOBBY_META()[hobbyType]?.emoji} {HOBBY_META()[hobbyType]?.label}
                </button>
              )}

              <Field label="Date">
                <input type="date" style={inputStyle()} value={date} onChange={e=>setDate(e.target.value)} />
              </Field>

              {/* Eggs */}
              {hobbyType === "eggs" && <>
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1,minWidth:130 }}>
                    <Field label="Bird type">
                      <select style={inputStyle()} value={eggType} onChange={e=>setEggType(e.target.value)}>
                        {EGG_TYPES.map(t=><option key={t}>{t}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div style={{ flex:1,minWidth:130 }}>
                    <Field label="Purpose">
                      <select style={inputStyle()} value={eggPurpose} onChange={e=>setEggPurpose(e.target.value)}>
                        {EGG_PURPOSES.map(p=><option key={p}>{p}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
                {eggType === "Other" && (
                  <Field label="What kind?">
                    <input style={inputStyle()} value={eggTypeCustom} onChange={e=>setEggTypeCustom(e.target.value)} placeholder="e.g. emu, ostrich, partridge" />
                  </Field>
                )}
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1,minWidth:100 }}>
                    <Field label="Qty">
                      <input type="number" min={0} style={inputStyle()} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                  <div style={{ flex:1,minWidth:100 }}>
                    <Field label="Unit">
                      <select style={inputStyle()} value={unit} onChange={e=>setUnit(e.target.value)}>
                        <option value="dozen">Dozen</option>
                        <option value="eggs">Individual eggs</option>
                      </select>
                    </Field>
                  </div>
                  <div style={{ flex:1,minWidth:120 }}>
                    <Field label={unit === "dozen" ? "Price / dozen" : "Price / dozen (equiv)"}>
                      <input type="number" min={0} step="0.01" style={inputStyle()} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                    </Field>
                  </div>
                </div>
              </>}

              {/* Honey */}
              {hobbyType === "honey" && <>
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1,minWidth:130 }}>
                    <Field label="Form">
                      <select style={inputStyle()} value={honeyForm} onChange={e=>setHoneyForm(e.target.value)}>
                        {HONEY_FORMS.map(f=><option key={f}>{f}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div style={{ flex:1,minWidth:130 }}>
                    <Field label="Container / unit">
                      <select style={inputStyle()} value={honeyContainer} onChange={e=>setHoneyContainer(e.target.value)}>
                        {HONEY_CONTAINERS.map(c=><option key={c}>{c}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
                <div style={{ display:"flex",gap:12 }}>
                  <div style={{ flex:1 }}>
                    <Field label="Qty (units sold)">
                      <input type="number" min={0} style={inputStyle()} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label="Price per unit">
                      <input type="number" min={0} step="0.01" style={inputStyle()} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                    </Field>
                  </div>
                </div>
              </>}

              {/* Meat chickens */}
              {hobbyType === "meat_chickens" && <>
                <Field label="Form">
                  <select style={inputStyle()} value={saleForm} onChange={e=>setSaleForm(e.target.value)}>
                    {MEAT_FORMS.map(f=><option key={f}>{f}</option>)}
                  </select>
                </Field>
                <Field label="Number of birds / units">
                  <input type="number" min={0} style={inputStyle()} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                </Field>
                <Field label="Pricing method">
                  <select style={inputStyle()} value={pricingMethod} onChange={e=>setPricingMethod(e.target.value)}>
                    <option value="per_bird">Per bird / unit</option>
                    <option value="per_lb">Per lb</option>
                    <option value="flat">Flat price (total)</option>
                  </select>
                </Field>
                {pricingMethod === "per_lb" && <>
                  <div style={{ display:"flex",gap:12 }}>
                    <div style={{ flex:1 }}>
                      <Field label={`Avg weight (${weightUnitLabel()})`}>
                        <input type="number" min={0} step="0.1" style={inputStyle()} value={avgWeightLbs} onChange={e=>setAvgWeightLbs(e.target.value)} placeholder="0.0" />
                      </Field>
                    </div>
                    <div style={{ flex:1 }}>
                      <Field label={`Price / ${perWeightLabel()}`}>
                        <input type="number" min={0} step="0.01" style={inputStyle()} value={pricePerLb} onChange={e=>setPricePerLb(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                      </Field>
                    </div>
                  </div>
                </>}
                {pricingMethod === "per_bird" && (
                  <Field label="Price / bird">
                    <input type="number" min={0} step="0.01" style={inputStyle()} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                  </Field>
                )}
                {pricingMethod === "flat" && (
                  <Field label={`Total price (${currencySymbol()})`}>
                    <input type="number" min={0} step="0.01" style={inputStyle()} value={flatPrice} onChange={e=>setFlatPrice(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                  </Field>
                )}
              </>}

              {/* Rabbits */}
              {hobbyType === "rabbits" && <>
                <Field label="Form">
                  <select style={inputStyle()} value={saleForm} onChange={e=>setSaleForm(e.target.value)}>
                    {RABBIT_FORMS.map(f=><option key={f}>{f}</option>)}
                  </select>
                </Field>
                <Field label="Quantity">
                  <input type="number" min={0} style={inputStyle()} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                </Field>
                <Field label="Pricing method">
                  <select style={inputStyle()} value={pricingMethod} onChange={e=>setPricingMethod(e.target.value)}>
                    <option value="per_bird">Per rabbit</option>
                    <option value="per_lb">Per lb</option>
                    <option value="flat">Flat price (total)</option>
                  </select>
                </Field>
                {pricingMethod === "per_lb" && (
                  <div style={{ display:"flex",gap:12 }}>
                    <div style={{ flex:1 }}>
                      <Field label={`Avg weight (${weightUnitLabel()})`}>
                        <input type="number" min={0} step="0.1" style={inputStyle()} value={avgWeightLbs} onChange={e=>setAvgWeightLbs(e.target.value)} placeholder="0.0" />
                      </Field>
                    </div>
                    <div style={{ flex:1 }}>
                      <Field label={`Price / ${perWeightLabel()}`}>
                        <input type="number" min={0} step="0.01" style={inputStyle()} value={pricePerLb} onChange={e=>setPricePerLb(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                      </Field>
                    </div>
                  </div>
                )}
                {pricingMethod === "per_bird" && (
                  <Field label="Price / rabbit">
                    <input type="number" min={0} step="0.01" style={inputStyle()} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                  </Field>
                )}
                {pricingMethod === "flat" && (
                  <Field label={`Total price (${currencySymbol()})`}>
                    <input type="number" min={0} step="0.01" style={inputStyle()} value={flatPrice} onChange={e=>setFlatPrice(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                  </Field>
                )}
              </>}

              {/* Garden */}
              {hobbyType === "garden" && <>
                <Field label="Crop / product">
                  <input style={inputStyle()} value={crop} onChange={e=>setCrop(e.target.value)} placeholder="Tomatoes, corn, cut flowers..." />
                </Field>
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1,minWidth:80 }}>
                    <Field label="Qty">
                      <input type="number" min={0} step="0.1" style={inputStyle()} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                  <div style={{ flex:1,minWidth:100 }}>
                    <Field label="Unit">
                      <select style={inputStyle()} value={gardenUnit} onChange={e=>setGardenUnit(e.target.value)}>
                        {["lbs","oz","count","bunch","quart","pint","bag","basket"].map(u=><option key={u}>{u}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div style={{ flex:1,minWidth:110 }}>
                    <Field label={`Price / ${gardenUnit}`}>
                      <input type="number" min={0} step="0.01" style={inputStyle()} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                    </Field>
                  </div>
                </div>
              </>}

              {/* Farm Stand */}
              {hobbyType === "farmstand" && <>
                <Field label="Item name">
                  <input style={inputStyle()} value={crop} onChange={e=>setCrop(e.target.value)} placeholder="Tomatoes, eggs, honey, baked goods..." />
                </Field>
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1,minWidth:80 }}>
                    <Field label="Qty sold">
                      <input type="number" min={0} step="0.1" style={inputStyle()} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                  <div style={{ flex:1,minWidth:100 }}>
                    <Field label="Unit">
                      <select style={inputStyle()} value={gardenUnit} onChange={e=>setGardenUnit(e.target.value)}>
                        {["each","lbs","dozen","quart","pint","bunch","bag","jar","loaf"].map(u=><option key={u}>{u}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1 }}>
                    <Field label="Your cost per unit">
                      <input type="number" min={0} step="0.01" style={inputStyle()} value={pricePerLb} onChange={e=>setPricePerLb(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label="Sale price per unit">
                      <input type="number" min={0} step="0.01" style={inputStyle()} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                    </Field>
                  </div>
                </div>
              </>}

              {/* Sourdough */}
              {hobbyType === "sourdough" && <>
                <Field label="Recipe / loaf type">
                  <input style={inputStyle()} list="sourdough-recipes" value={crop} onChange={e=>setCrop(e.target.value)} placeholder="Country Loaf, Boule, Cinnamon Raisin..." />
                  <datalist id="sourdough-recipes">
                    {["Country Loaf","Boule","Batard","Whole Wheat","Rye","Multigrain","Sandwich Loaf","Focaccia","Baguette","Cinnamon Raisin","Jalapeño Cheddar","Pizza Dough","Discard Crackers"].map(r => <option key={r} value={r} />)}
                  </datalist>
                </Field>
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1,minWidth:80 }}>
                    <Field label="Loaves sold">
                      <input type="number" min={0} step="1" style={inputStyle()} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label="Cost per loaf (optional)">
                      <input type="number" min={0} step="0.01" style={inputStyle()} value={pricePerLb} onChange={e=>setPricePerLb(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label="Sale price per loaf">
                      <input type="number" min={0} step="0.01" style={inputStyle()} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                    </Field>
                  </div>
                </div>
              </>}

              {/* Baking */}
              {hobbyType === "baking" && <>
                <Field label="Recipe / item">
                  <input style={inputStyle()} value={crop} onChange={e=>setCrop(e.target.value)} placeholder="Apple Pie, Banana Bread, Croissants..." />
                </Field>
                <Field label="Unit (optional)">
                  <input style={inputStyle()} value={gardenUnit} onChange={e=>setGardenUnit(e.target.value)} placeholder="loaves, pies, dozen cookies..." />
                </Field>
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1,minWidth:80 }}>
                    <Field label="Quantity sold">
                      <input type="number" min={0} step="1" style={inputStyle()} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label="Cost per item (optional)">
                      <input type="number" min={0} step="0.01" style={inputStyle()} value={pricePerLb} onChange={e=>setPricePerLb(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label="Sale price per item">
                      <input type="number" min={0} step="0.01" style={inputStyle()} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                    </Field>
                  </div>
                </div>
              </>}

              {/* Canning */}
              {hobbyType === "canning" && <>
                <Field label="Item">
                  <input style={inputStyle()} value={crop} onChange={e=>setCrop(e.target.value)} placeholder="Strawberry Jam, Dill Pickles, Tomato Sauce..." />
                </Field>
                <Field label="Jar type">
                  <input style={inputStyle()} value={gardenUnit} onChange={e=>setGardenUnit(e.target.value)} placeholder="pint jars, quart jars, half-pints..." />
                </Field>
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1,minWidth:80 }}>
                    <Field label="Jars sold">
                      <input type="number" min={0} step="1" style={inputStyle()} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label="Cost per jar (optional)">
                      <input type="number" min={0} step="0.01" style={inputStyle()} value={pricePerLb} onChange={e=>setPricePerLb(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label="Sale price per jar">
                      <input type="number" min={0} step="0.01" style={inputStyle()} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                    </Field>
                  </div>
                </div>
              </>}

              {/* Flat-livestock (horse/cow/goat/sheep/pig/dog/cat) */}
              {LIVESTOCK_FLAT_TYPES.includes(hobbyType) && <>
                {/* If the user has live animals of this type tracked, offer to
                    pick one. Picking pre-fills the name AND archives the animal
                    on save so the Sales tab can retire it in one tap. */}
                {(() => {
                  const speciesLabel = (HOBBY_META()[hobbyType]?.label || "Animal");
                  const lsHobby = (data.hobbies || []).find(h => h.id === LIVESTOCK_HOBBY_ID[hobbyType]);
                  const liveAnimals = (lsHobby?.animals || []).filter(a => !a.archived);
                  if (liveAnimals.length === 0) return null;
                  return (
                    <Field label={`Sell an existing animal? (optional)`}>
                      <select
                        style={inputStyle()}
                        value={selectedAnimalId}
                        onChange={e => {
                          const id = e.target.value;
                          setSelectedAnimalId(id);
                          if (id) {
                            const h = liveAnimals.find(x => x.id === id);
                            if (h) setCrop(h.name);
                          }
                        }}
                      >
                        <option value="">— Type a name below instead —</option>
                        {liveAnimals.map(h => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                      </select>
                    </Field>
                  );
                })()}
                <Field label="Animal name">
                  <input style={inputStyle()} value={crop} onChange={e=>{setCrop(e.target.value); setSelectedAnimalId("");}} placeholder="e.g. Bessie, Thunder" />
                </Field>
                <Field label="Type of transaction">
                  <select style={inputStyle()} value={otherItem || "sold"} onChange={e=>setOtherItem(e.target.value)}>
                    <option value="sold">Sold</option>
                    <option value="leased">Leased</option>
                    <option value="rehomed">Rehomed</option>
                  </select>
                </Field>
                <Field label="Sale / lease price">
                  <input type="number" min={0} step="0.01" style={inputStyle()} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                </Field>
                {selectedAnimalId && (
                  <div style={{ fontSize:12, color:palette.inkSoft, marginBottom:10, padding:"8px 10px", background:palette.bgAlt, borderRadius:6, lineHeight:1.5 }}>
                    Saving will also archive this animal so it disappears from your active list.
                  </div>
                )}
              </>}

              {/* Incubator / chicks */}
              {hobbyType === "incubator" && <>
                <Field label="Bird type">
                  <input style={inputStyle()} value={chickBirdType} onChange={e=>setChickBirdType(e.target.value)} placeholder="e.g. Chicken, Duck, Quail" />
                </Field>
                <Field label="Brooder batch (optional)">
                  <input style={inputStyle()} value={chickBrooderName} onChange={e=>setChickBrooderName(e.target.value)} placeholder="e.g. Spring batch #1" />
                </Field>
                <div style={{ display:"flex",gap:12 }}>
                  <div style={{ flex:1 }}>
                    <Field label="Chicks sold">
                      <input type="number" min={0} style={inputStyle()} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label="Price per chick">
                      <input type="number" min={0} step="0.01" style={inputStyle()} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                    </Field>
                  </div>
                </div>
                {existingSale?.brooderBatchId && (
                  <div style={{ fontSize:12, color:palette.inkSoft, marginBottom:10, padding:"8px 10px", background:palette.bgAlt, borderRadius:6, lineHeight:1.5 }}>
                    Linked to a brooder batch — edits sync to the Incubator page.
                  </div>
                )}
              </>}

              {/* Salve, tincture, oil, tea, soap, syrup */}
              {SHELF_TYPES.includes(hobbyType) && <>
                <Field label="Item">
                  <input style={inputStyle()} value={crop} onChange={e=>setCrop(e.target.value)} placeholder="Calendula salve, Elderberry tincture..." />
                </Field>
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1,minWidth:80 }}>
                    <Field label={`${SHELF_WORDS[hobbyType]} sold`}>
                      <input type="number" min={0} step="any" style={inputStyle()} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label="Price each">
                      <input type="number" min={0} step="0.01" style={inputStyle()} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                    </Field>
                  </div>
                </div>
              </>}

              {/* Other */}
              {hobbyType === "other" && <>
                <Field label="What was sold?">
                  <input style={inputStyle()} value={otherItem} onChange={e=>setOtherItem(e.target.value)} placeholder="e.g. Quail eggs, seedlings, crafts..." />
                </Field>
                <div style={{ display:"flex",gap:12 }}>
                  <div style={{ flex:1 }}>
                    <Field label="Qty">
                      <input type="number" min={0} style={inputStyle()} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label={`Total price (${currencySymbol()})`}>
                      <input type="number" min={0} step="0.01" style={inputStyle()} value={flatPrice} onChange={e=>setFlatPrice(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
                    </Field>
                  </div>
                </div>
              </>}

              {/* Revenue preview */}
              {previewRevenue > 0 && (
                <div style={{ padding:"10px 14px",background:palette.yolkSoft,borderRadius:8,fontSize:13,color:palette.ink,marginBottom:14,textAlign:"center" }}>
                  Revenue: <strong>{fmtMoney(previewRevenue)}</strong>
                </div>
              )}

              {/* Buyer */}
              <Field label="Customer (optional)">
                {!showNewBuyer ? (
                  <div style={{ display:"flex",gap:8 }}>
                    <select style={{ ...inputStyle(),flex:1 }} value={buyerId} onChange={e=>setBuyerId(e.target.value)}>
                      <option value="">— No customer —</option>
                      {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button onClick={()=>setShowNewBuyer(true)} style={{ padding:"10px 12px",borderRadius:8,border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",fontFamily:FONT_BODY,fontSize:13,fontWeight:600,color:palette.ink,whiteSpace:"nowrap" }}>
                      + New
                    </button>
                  </div>
                ) : (
                  <div style={{ display:"flex",gap:8 }}>
                    <input style={{ ...inputStyle(),flex:1 }} value={newBuyerName} onChange={e=>setNewBuyerName(e.target.value)} placeholder="Customer name" autoFocus />
                    <button onClick={()=>setShowNewBuyer(false)} style={{ padding:"10px 12px",borderRadius:8,border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",fontFamily:FONT_BODY,fontSize:13,color:palette.inkSoft }}>Cancel</button>
                  </div>
                )}
              </Field>

              <Field label="Notes (optional)">
                <input style={inputStyle()} value={note} onChange={e=>setNote(e.target.value)} placeholder="Farmers market, neighbor, online..." />
              </Field>

              <Field label="Tip (optional)">
                <input type="number" step="0.01" min={0} style={inputStyle()} value={tip} onChange={e=>setTip(e.target.value)} placeholder="Extra the customer left, e.g. 2.00" />
              </Field>

              <Btn variant="primary" onClick={save} style={{ width:"100%" }}>
                {isEdit ? "Save changes" : "Log sale"}
              </Btn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CUSTOMER MODAL — add/edit a customer
// ============================================================================
function CustomerModal({ customer, onSave, onClose }) {
  const [name, setName] = useState(customer?.name || "");
  const [note, setNote] = useState(customer?.note || "");
  const [email, setEmail] = useState(customer?.email || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [textOk, setTextOk] = useState(customer?.textOk === true);
  const phoneOk = phone.replace(/[^0-9]/g, "").length >= 7;
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(44,24,16,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:palette.bg,borderRadius:16,maxWidth:400,width:"100%",border:`2px solid ${palette.ink}`,boxShadow:"0 12px 32px rgba(0,0,0,0.22)",fontFamily:FONT_BODY }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1.5px solid ${palette.line}` }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink }}>{customer ? "Edit customer" : "Add customer"}</div>
          <button onClick={onClose} aria-label="Close" style={{ background:"none",border:"none",cursor:"pointer",color:palette.ink }}><X size={20}/></button>
        </div>
        <div style={{ padding:20 }}>
          <Field label="Name">
            <input style={inputStyle()} value={name} onChange={e=>setName(e.target.value)} placeholder="Jane Smith" autoFocus />
          </Field>
          <Field label="Email (optional)">
            <input style={inputStyle()} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="jane@example.com" autoCapitalize="none" />
          </Field>
          <Field label="Phone (optional)">
            <input style={inputStyle()} type="tel" value={phone} onChange={e=>setPhone(e.target.value.slice(0, 30))} placeholder="555-123-4567" />
          </Field>
          {phoneOk && (
            <label style={{ display:"flex",alignItems:"flex-start",gap:10,fontSize:14,color:palette.ink,margin:"-4px 0 14px" }}>
              <input type="checkbox" checked={textOk} onChange={e=>setTextOk(e.target.checked)} style={{ width:20,height:20,marginTop:1 }} />
              <span>OK to text<br/><span style={{ fontSize:12,color:palette.inkSoft }}>Only turn on if they said you can text them.</span></span>
            </label>
          )}
          <Field label="Notes (optional)">
            <input style={inputStyle()} value={note} onChange={e=>setNote(e.target.value)} placeholder="Neighbor, prefers hatching eggs..." />
          </Field>
          <Btn onClick={() => { if (!name.trim()) return; onSave({ ...(customer || {}), id: customer?.id || newId(), name: name.trim(), note, email: email.trim().toLowerCase(), phone: phone.trim(), textOk: phoneOk && textOk }); onClose(); }} style={{ width:"100%" }}>Save</Btn>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SALE ROW
// ============================================================================
function ExpenseRow({ expense, hobbies, onEdit, onDelete, readOnly }) {
  const hobby = (hobbies || []).find(h => h.id === expense.hobbyId);
  const hobbyLabel = hobby ? hobby.name : "General overhead";
  return (
    <div style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:palette.dangerBg,border:`1.5px solid ${palette.accent}40`,borderRadius:10 }}>
      <div style={{ fontSize:22,flexShrink:0 }}>💸</div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontWeight:600,fontSize:14,color:palette.ink,display:"flex",alignItems:"center",gap:8 }}>
          −{fmtMoney(expense.amount)}
          <span style={{ fontSize:11,background:palette.accent+"25",color:palette.ink,padding:"1px 6px",borderRadius:4,fontWeight:500 }}>{expense.category || "Expense"}</span>
        </div>
        <div style={{ fontSize:12,color:palette.inkSoft,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>
          {fmtDate(expense.date)} · {hobbyLabel}{expense.note ? ` · ${expense.note}` : ""}{readOnly ? " · logged on hobby page" : ""}
        </div>
      </div>
      {readOnly ? (
        // Entry-sourced cost (logged on a hobby's quick-log, e.g. a feed cost,
        // or a structural buy like a flock/chick purchase). It lives in
        // data.entries / the hobby object, not data.expenses, so it can't be
        // edited or deleted from here — the user edits it on the hobby page.
        // Shown read-only so the log reconciles with the profit total.
        <span style={{ fontSize:11,color:palette.inkSoft,fontStyle:"italic",flexShrink:0,whiteSpace:"nowrap" }}>hobby page</span>
      ) : (
        <>
          <button onClick={onEdit} aria-label="Edit expense" style={{ background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,padding:4 }}><Edit3 size={16}/></button>
          <button onClick={onDelete} aria-label="Delete expense" style={{ background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,padding:4 }}><Trash2 size={16}/></button>
        </>
      )}
    </div>
  );
}

function SaleRow({ sale, customers, onEdit, onDelete }) {
  const meta = HOBBY_META()[sale.hobbyType] || HOBBY_META().other;
  const customer = customers.find(c => c.id === sale.buyerId);
  const revenue = computeRevenue(sale);

  // Build detail string
  let detail = "";
  if (sale.hobbyType === "eggs") {
    const qtyLabel = sale.unit === "dozen" ? `${sale.qty} dz` : `${sale.qty} eggs`;
    // For "Other" eggs, show the custom name the user typed (emu, ostrich, etc.)
    // rather than the generic "Other" label.
    const typeLabel = sale.eggType === "Other" && sale.eggTypeCustom
      ? sale.eggTypeCustom
      : sale.eggType;
    detail = `${typeLabel} · ${sale.eggPurpose} · ${qtyLabel}`;
  } else if (sale.hobbyType === "honey") {
    detail = `${sale.qty} × ${sale.honeyContainer} · ${sale.honeyForm}`;
  } else if (sale.hobbyType === "meat_chickens" || sale.hobbyType === "rabbits") {
    detail = `${sale.qty} ${sale.saleForm || ""}`;
    if (sale.pricingMethod === "per_lb" && sale.avgWeightLbs) detail += ` · ${fmtWeight(sale.avgWeightLbs, { forceBig: true })} avg`;
  } else if (sale.hobbyType === "farmstand") {
    detail = `${sale.crop} · ${sale.qty} ${sale.gardenUnit||""} @ ${fmtMoney(sale.pricePerUnit||0)}/unit`;
  } else if (sale.hobbyType === "sourdough") {
    detail = `${sale.crop || "Bread"} · ${sale.qty} loa${sale.qty === 1 ? "f" : "ves"} @ ${fmtMoney(sale.pricePerUnit||0)}/loaf`;
  } else if (sale.hobbyType === "baking") {
    const unitLabel = sale.gardenUnit || sale.unit || "items";
    detail = `${sale.crop || "Baked goods"} · ${sale.qty} ${unitLabel} @ ${fmtMoney(sale.pricePerUnit||0)}/${unitLabel.replace(/s$/, "") || "item"}`;
  } else if (sale.hobbyType === "canning") {
    const unitLabel = sale.gardenUnit || sale.unit || "jars";
    detail = `${sale.crop || "Canning"} · ${sale.qty} ${unitLabel} @ ${fmtMoney(sale.pricePerUnit||0)}/jar`;
  } else if (sale.hobbyType === "tincture") {
    const unit = sale.gardenUnit || "bottle";
    detail = `${sale.crop || "Tincture"} · ${sale.qty} × ${unit} @ ${fmtMoney(sale.pricePerUnit||0)}/bottle`;
  } else if (sale.hobbyType === "oil_infusion") {
    const unit = sale.gardenUnit || "bottle";
    detail = `${sale.crop || "Infused oil"} · ${sale.qty} × ${unit} @ ${fmtMoney(sale.pricePerUnit||0)}/bottle`;
  } else if (sale.hobbyType === "salve") {
    const unit = sale.gardenUnit || "tin";
    detail = `${sale.crop || "Salve"} · ${sale.qty} × ${unit} @ ${fmtMoney(sale.pricePerUnit||0)}/tin`;
  } else if (sale.hobbyType === "tea") {
    const unit = sale.gardenUnit || "unit";
    const unitLabel = unit === "oz" ? "oz" : `× ${unit}`;
    detail = `${sale.crop || "Tea blend"} · ${sale.qty} ${unitLabel} @ ${fmtMoney(sale.pricePerUnit||0)}/${unit === "oz" ? "oz" : "sachet"}`;
  } else if (sale.hobbyType === "horse" || sale.hobbyType === "cow" ||
             sale.hobbyType === "goat" || sale.hobbyType === "sheep" ||
             sale.hobbyType === "pig") {
    // Flat-livestock detail: animal name + transaction type. cat/dog have
    // their own (identical-shaped) branch just below for the species label.
    const lsLabel = { horse: "Horse", cow: "Cow", goat: "Goat", sheep: "Sheep", pig: "Pig", dog: "Dog", cat: "Cat", rabbit: "Rabbit" }[sale.hobbyType] || "Animal";
    detail = `${sale.crop || lsLabel} · ${sale.saleType || "sold"}`;
  } else if (sale.hobbyType === "incubator") {
    const birdLabel = sale.birdType ? sale.birdType.toLowerCase() : "chick";
    const batchLabel = sale.brooderBatchName ? ` (${sale.brooderBatchName})` : "";
    detail = `${sale.qty} ${birdLabel}${sale.qty === 1 ? "" : "s"}${batchLabel} @ ${fmtMoney(sale.pricePerUnit||0)}/chick`;
  } else if (sale.hobbyType === "garden") {
    detail = `${sale.crop} · ${sale.qty} ${sale.gardenUnit || ""}`;
  } else if (sale.hobbyType === "cat" || sale.hobbyType === "dog") {
    // Cat/dog sales are usually a single animal or a kitten/puppy placement.
    const species = sale.hobbyType === "cat" ? "Cat" : "Dog";
    detail = `${sale.crop || species} · ${sale.saleType || "sold"}`;
  } else if (sale.hobbyType === "maple_syrup") {
    const unit = sale.unit || "pints";
    detail = `${sale.qty || 0} ${unit} syrup${sale.pricePerUnit ? ` @ ${fmtMoney(sale.pricePerUnit)}/${unit.replace(/s$/, "")}` : ""}`;
  } else {
    detail = sale.otherItem || "";
  }

  return (
    <div style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:10 }}>
      <div style={{ fontSize:22,flexShrink:0 }}>{meta.emoji}</div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontWeight:600,fontSize:14,color:palette.ink,display:"flex",alignItems:"center",gap:8 }}>
          {fmtMoney(revenue)}
          <span style={{ fontSize:11,background:meta.color+"25",color:palette.ink,padding:"1px 6px",borderRadius:4,fontWeight:500 }}>{meta.label}</span>
          {(Number(sale.tip) || 0) > 0 && (
            <span style={{ fontSize:11,background:palette.leaf+"22",color:palette.leaf,padding:"1px 6px",borderRadius:4,fontWeight:600 }}>+{fmtMoney(Number(sale.tip))} tip</span>
          )}
        </div>
        <div style={{ fontSize:12,color:palette.inkSoft,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>
          {fmtDate(sale.date)} · {detail}{customer ? ` · ${customer.name}` : ""}{sale.note ? ` · ${sale.note}` : ""}
        </div>
      </div>
      <button onClick={onEdit} aria-label="Edit sale" style={{ background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,padding:4 }}><Edit3 size={16}/></button>
      <button onClick={onDelete} aria-label="Delete sale" style={{ background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,padding:4 }}><Trash2 size={16}/></button>
    </div>
  );
}

// ============================================================================
// MAIN SALES PAGE
// ============================================================================
const EXPENSE_CATEGORIES = [
  "Feed", "Bedding", "Equipment", "Medical/Vet",
  "Infrastructure", "Supplies", "Other",
];

// Recurrence options for expenses. Mirrors the calendar's set so users see a
// familiar interface. "none" stores the expense with no `recurrence` field so
// pre-existing one-off expenses stay one-offs.
const RECUR_OPTIONS = [
  { id: "none",     label: "Does not repeat" },
  { id: "daily",    label: "Daily" },
  { id: "weekly",   label: "Weekly" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly",  label: "Monthly" },
  { id: "yearly",   label: "Yearly" },
];

// Expand recurring expense templates into virtual occurrences. A non-recurring
// expense passes through unchanged. A recurring expense produces a virtual
// occurrence for each matching date from its anchor date forward, bounded by
// recurEnd (if set) or a 24-month horizon. Each virtual occurrence carries
// _parentId so callers can route edit/delete to the template.
function addMonthsIso(isoStr, months) {
  const [y, m, d] = isoStr.split("-").map(Number);
  const base = new Date(y, (m - 1) + months, d);
  if (base.getDate() !== d) base.setDate(0);
  return isoDate(base);
}
function addDaysIso(isoStr, days) {
  const [y, m, d] = isoStr.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d + days));
}
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function expandRecurringExpenses(expenses) {
  const out = [];
  const today = new Date();
  const horizon = isoDate(new Date(today.getFullYear() + 2, today.getMonth(), today.getDate()));
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
      if (e.recurrence === "daily") cursor = addDaysIso(e.date, n);
      else if (e.recurrence === "weekly") cursor = addDaysIso(e.date, n * 7);
      else if (e.recurrence === "biweekly") cursor = addDaysIso(e.date, n * 14);
      else if (e.recurrence === "monthly") cursor = addMonthsIso(e.date, n);
      else if (e.recurrence === "yearly") cursor = addMonthsIso(e.date, n * 12);
      else { cursor = e.date; }
      if (cursor > stop) break;
      if (!skipped.has(cursor)) {
        out.push({ ...e, date: cursor, _parentId: e.id, _occKey: `${e.id}@${cursor}` });
      }
      if (!["daily", "weekly", "biweekly", "monthly", "yearly"].includes(e.recurrence)) break;
      n += 1;
      guard += 1;
    }
  }
  return out;
}


// initialHobbyId pre-fills the hobby dropdown when the modal is opened from
// a hobby's "Add Expense" quick-log tile. Ignored when editing an existing
// expense (the existing record's hobbyId wins). Falls back to "" if no
// initial hobby is provided.
export function AddExpenseModal({ data, update, onClose, existingExpense, occurrenceDate, initialHobbyId }) {
  const isEdit = !!existingExpense;
  const visibleHobbies = (data.hobbies || []).filter(h => !h.hidden);

  const [date, setDate] = useState(occurrenceDate || existingExpense?.date || todayStr());
  const [amount, setAmount] = useState(existingExpense?.amount != null ? String(existingExpense.amount) : "");
  const [category, setCategory] = useState(existingExpense?.category || "Feed");
  const [hobbyId, setHobbyId] = useState(existingExpense?.hobbyId || initialHobbyId || "");
  // Optional flock attribution. Only meaningful for hobbies that have flocks
  // (egg layers, meat chickens); lets per-flock cost/egg include this expense.
  const [flockId, setFlockId] = useState(existingExpense?.flockId || "");
  const [note, setNote] = useState(existingExpense?.note || "");
  const [recurrence, setRecurrence] = useState(existingExpense?.recurrence || "none");
  const [recurEnd, setRecurEnd] = useState(existingExpense?.recurEnd || "");
  const [error, setError] = useState("");

  // True when we're editing a virtual instance of a recurring template.
  // In that case, save offers a choice: this occurrence only, or whole series.
  const isRecurringInstanceEdit = isEdit && occurrenceDate && existingExpense?.recurrence && existingExpense.recurrence !== "none";

  // Shared field validation + base expense shape. Returns null if invalid.
  const buildBaseExpense = () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) { setError("Enter a valid amount."); return null; }
    if (!category.trim()) { setError("Pick or type a category."); return null; }
    // No date: no month, report or repeat schedule would count it.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError("Pick a date."); return null; }
    // Only persist flockId if the chosen hobby actually has that flock — guards
    // against a stale selection if the hobby was changed after picking a flock.
    const selHobby = visibleHobbies.find(h => h.id === hobbyId);
    const flockValid = !!(flockId && selHobby && (selHobby.flocks || []).some(f => f.id === flockId));
    return {
      amount: n,
      category: category.trim(),
      hobbyId: hobbyId || null,
      flockId: flockValid ? flockId : null,
      note: note.trim(),
    };
  };

  // Save changes to the whole series (or save a non-recurring expense).
  // This is the existing default save behavior.
  const saveSeries = () => {
    const base = buildBaseExpense();
    if (!base) return;
    // CRITICAL: when editing a recurring instance, the modal's `date` field
    // was pre-filled with the occurrence's date — NOT the original anchor
    // date. If we used `date` as the anchor for the series, we'd shift the
    // entire series forward and wipe all earlier occurrences. Preserve the
    // parent's original anchor date instead.
    const seriesAnchorDate = isRecurringInstanceEdit
      ? existingExpense.date
      : date;
    const expense = {
      id: existingExpense?.id || ("ex_" + Math.random().toString(36).slice(2, 10)),
      date: seriesAnchorDate,
      ...base,
      created: existingExpense?.created || Date.now(),
    };
    if (recurrence && recurrence !== "none") {
      expense.recurrence = recurrence;
      if (recurEnd) expense.recurEnd = recurEnd;
      if (existingExpense?.skippedDates) expense.skippedDates = existingExpense.skippedDates;
    } else {
      delete expense.recurrence;
      delete expense.recurEnd;
    }
    update((d) => {
      if (!Array.isArray(d.expenses)) d.expenses = [];
      if (isEdit) {
        const idx = d.expenses.findIndex(e => e.id === expense.id);
        if (idx !== -1) d.expenses[idx] = expense;
        else d.expenses.push(expense);
      } else {
        d.expenses.push(expense);
      }
      return d;
    });
    onClose();
  };

  // Save changes for THIS occurrence only:
  //   - Add occurrenceDate to parent's skippedDates (so the virtual won't render).
  //   - Create a new standalone expense at the modal's `date` field with the
  //     edited values. (date may have been changed by the user; default was
  //     the occurrence's date.)
  const saveOccurrenceOnly = () => {
    const base = buildBaseExpense();
    if (!base) return;
    const standalone = {
      id: "ex_" + Math.random().toString(36).slice(2, 10),
      date,
      ...base,
      created: Date.now(),
    };
    update((d) => {
      if (!Array.isArray(d.expenses)) d.expenses = [];
      // Mark this occurrence skipped on the parent template.
      const parent = d.expenses.find(e => e.id === existingExpense.id);
      if (parent) {
        const skipped = Array.isArray(parent.skippedDates) ? parent.skippedDates : [];
        if (!skipped.includes(occurrenceDate)) skipped.push(occurrenceDate);
        parent.skippedDates = skipped;
      }
      // Push the new standalone record.
      d.expenses.push(standalone);
      return d;
    });
    onClose();
  };

  // Default action button — used when not editing a virtual instance.
  const save = saveSeries;

  const remove = async () => {
    if (!isEdit) return;
    if (!(await askConfirm({ title: "Delete this expense?", confirmLabel: "Delete" }))) return;
    update((d) => {
      d.expenses = (d.expenses || []).filter(e => e.id !== existingExpense.id);
      return d;
    });
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(44,24,16,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:palette.bg,borderRadius:16,maxWidth:480,width:"100%",maxHeight:"92vh",overflow:"auto",border:`2px solid ${palette.ink}`,boxShadow:"0 12px 32px rgba(0,0,0,0.22)",fontFamily:FONT_BODY }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1.5px solid ${palette.line}` }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:22,color:palette.ink }}>{isEdit ? "Edit expense" : "Log expense"}</div>
          <button onClick={onClose} aria-label="Close" style={{ background:"none",border:"none",cursor:"pointer",color:palette.ink,padding:4 }}><X size={22}/></button>
        </div>
        <div style={{ padding:20 }}>
      <Field label="Date">
        <input type="date" style={inputStyle()} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      <Field label={`Amount (${currencySymbol()})`}>
        <input
          type="number"
          step="0.01"
          min="0"
          style={inputStyle()}
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setError(""); }}
          placeholder="0.00"
          autoFocus
        />
      </Field>

      <Field label="Category">
        <input
          list="expense-categories"
          style={inputStyle()}
          value={category}
          onChange={(e) => { setCategory(e.target.value); setError(""); }}
          placeholder="Feed, Bedding, etc."
        />
        <datalist id="expense-categories">
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c} />)}
        </datalist>
      </Field>

      <Field label="For which hobby? (optional)">
        <select style={inputStyle()} value={hobbyId} onChange={(e) => { setHobbyId(e.target.value); setFlockId(""); }}>
          <option value="">— All / unspecified —</option>
          {visibleHobbies.map(h => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
      </Field>

      {/* Flock attribution — only shown when the chosen hobby has flocks.
          Tagging a flock lets the expense roll into that flock's cost/egg;
          "All flocks / general" leaves it at the hobby level only. */}
      {(() => {
        const selHobby = visibleHobbies.find(h => h.id === hobbyId);
        const flocks = (selHobby && selHobby.flocks) || [];
        if (flocks.length === 0) return null;
        return (
          <Field label="Which flock? (optional)">
            <select style={inputStyle()} value={flockId} onChange={(e) => setFlockId(e.target.value)}>
              <option value="">— All flocks / general —</option>
              {flocks.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </Field>
        );
      })()}

      <Field label="Note (optional)">
        <input
          style={inputStyle()}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="20lb layer pellets at TSC"
        />
      </Field>

      <Field label="Repeats">
        <select style={inputStyle()} value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
          {RECUR_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </Field>

      {recurrence !== "none" && (
        <Field label="End date (optional)">
          <input type="date" style={inputStyle()} value={recurEnd} onChange={(e) => setRecurEnd(e.target.value)} />
        </Field>
      )}

      {recurrence !== "none" && isEdit && (
        <div style={{ fontSize:12,color:palette.inkSoft,marginTop:-6,marginBottom:10,fontStyle:"italic" }}>
          Editing or deleting affects the whole repeating series.
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: palette.accent, marginBottom: 10 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 8 }}>
        {isEdit ? (
          <button onClick={remove} style={{ padding: "9px 14px", borderRadius: 8, background: "transparent", border: `1.5px solid ${palette.accent}`, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13, cursor: "pointer", color: palette.accent }}>
            Delete
          </button>
        ) : <div />}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 8, background: palette.bgAlt, border: `1.5px solid ${palette.line}`, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13, cursor: "pointer", color: palette.ink }}>Cancel</button>
          {isRecurringInstanceEdit ? (
            <>
              <button onClick={saveOccurrenceOnly} style={{ padding: "9px 12px", borderRadius: 8, background: palette.card, border: `1.5px solid ${palette.ink}`, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 12, cursor: "pointer", color: palette.ink }}>Save this occurrence only</button>
              <button onClick={saveSeries} style={{ padding: "9px 12px", borderRadius: 8, background: palette.ink, border: `1.5px solid ${palette.ink}`, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 12, cursor: "pointer", color: palette.bg }}>Save whole series</button>
            </>
          ) : (
            <button onClick={save} style={{ padding: "9px 16px", borderRadius: 8, background: palette.ink, border: `1.5px solid ${palette.ink}`, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13, cursor: "pointer", color: palette.bg }}>{isEdit ? "Save" : "Log expense"}</button>
          )}
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}

// What a sale was, in a few words ("Eggs", "Honey"), for one-line summaries.
export function saleKind(sale) {
  const meta = HOBBY_META()[sale && sale.hobbyType] || HOBBY_META().other || { label: "Sale" };
  if (sale && sale.hobbyType === "eggs" && sale.qty) return `${sale.qty} ${sale.unit === "dozen" ? "dozen eggs" : "eggs"}`;
  if (sale && sale.crop) return sale.crop;
  return meta.label;
}

// Delete a sale and unwind what it touched (legacy sold_eggs twin, brooder
// disposition). Shared by the Sales log and the 3.0 Undo bar.
export function removeSale(d, id) {
  const target = (d.sales || []).find(s => s.id === id);
  d.sales = (d.sales||[]).filter(s => s.id !== id);
  if (d.entries?.["egg_layers"]) {
    d.entries["egg_layers"] = d.entries["egg_layers"].filter(
      e => !(e.action === "sold_eggs" && e.id === id)
    );
  }
  // An animal sale: bring the animal back and drop its "sale" log entry.
  unwindAnimalSale(d, id);
  // A sale off a batch (salve, tincture, oil, tea, canning): stock goes back.
  unwindShelfSale(d, target);
  if (target?.brooderBatchId && target?.dispositionId) {
    const incHobby = (d.hobbies || []).find(h => h.id === target.hobbyId);
    const batch = incHobby?.brooderBatches?.find(b => b.id === target.brooderBatchId);
    if (batch && Array.isArray(batch.dispositions)) {
      batch.dispositions = batch.dispositions.filter(x => x.id !== target.dispositionId);
      if (batch.archived) batch.archived = false;
    }
  }
  return d;
}

// Sold / spent / profit for a window, the Sales page's numbers. Legacy
// per-flock egg sales are merged into data.sales so they count, exactly as
// the totals above them do. Shared with the 3.0 Sales screen.
export function profitStats(data, windowKey, mode, legacyEggSales = null) {
  const window = resolveWindow(windowKey, new Date());
  const legacy = legacyEggSales || collectAllSales(data).filter(s => s.isLegacy);
  const saleIds = new Set((data.sales || []).map(s => s.id));
  const mergedData = { ...data, sales: [...(data.sales || []), ...legacy.filter(s => !saleIds.has(s.id))] };
  return mode === "fifo" ? computeFifoStats(mergedData, window) : computeSimpleStats(mergedData, window);
}

// `embedded` (3.0): shown under the new Sales screen, so its own title and
// shortcut buttons are hidden. `focus` scrolls to "log" or "customers".
export default function SalesPage({ data, update, onEmailCustomers, onPurchaseHistory, embedded = false, focus = null }) {
  const [showAddSale, setShowAddSale] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingOccurrenceDate, setEditingOccurrenceDate] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [showCustomers, setShowCustomers] = useState(focus === "customers");
  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(focus === "customers" ? "sales-customers" : focus === "log" ? "sales-log" : null);
    if (el) setTimeout(() => el.scrollIntoView({ block: "start" }), 50);
  }, [focus]);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showYearReport, setShowYearReport] = useState(false);

  // Profit/expense window — defaults to last 12 months so brand-new homesteads
  // and long-time users both see something meaningful immediately. Users can
  // narrow it with the chip selector below the revenue cards.
  const [profitWindow, setProfitWindow] = useState("twelve_months");

  // PROFIT_MODE — toggles between FIFO accounting (true cost-per-unit math)
  // and Simple cash-in / cash-out math (sums revenue and expenses dated in
  // the window, ignores expense-to-sale matching). Default is "simple" since
  // it matches the homesteader mental model — FIFO is opt-in for users who
  // want the deeper analysis. Persisted to data.profitMode so the choice
  // sticks across sessions.
  const [profitMode, setProfitMode] = useState(data.profitMode || "simple");
  const setProfitModeAndPersist = (mode) => {
    setProfitMode(mode);
    update(d => { d.profitMode = mode; return d; });
  };

  const sales = data.sales || [];
  const customers = data.customers || [];

  // data.sales + legacy sold_eggs entries, normalized (see collectAllSales).
  const allSales = useMemo(() => collectAllSales(data), [data.sales, data.entries]); // eslint-disable-line react-hooks/exhaustive-deps
  // Legacy sold_eggs rows only (for the FIFO profit view below).
  const legacyEggSales = useMemo(() => allSales.filter(s => s.isLegacy), [allSales]);

  const filtered = filterType === "all" ? allSales : allSales.filter(s => s.hobbyType === filterType);

  // Revenue stats
  const totalRevenue = allSales.reduce((s,sale) => s + computeRevenue(sale), 0);
  const thisMonth = thisMonthStr();
  const thisMonthRevenue = allSales.filter(s => s.date?.startsWith(thisMonth)).reduce((s,sale) => s + computeRevenue(sale), 0);
  // Tips are tracked separately from revenue (they're extra a customer leaves,
  // not item price), so they get their own total rather than inflating revenue.
  const totalTips = allSales.reduce((s,sale) => s + (Number(sale.tip) || 0), 0);

  // Revenue by hobby type (for bar chart)
  const byType = useMemo(() => {
    const acc = {};
    allSales.forEach(sale => {
      const t = sale.hobbyType;
      acc[t] = (acc[t] || 0) + computeRevenue(sale);
    });
    return Object.entries(acc).map(([type, revenue]) => ({
      name: HOBBY_META()[type]?.label || type,
      revenue: parseFloat(revenue.toFixed(2)),
      emoji: HOBBY_META()[type]?.emoji || "💰",
    })).sort((a,b) => b.revenue - a.revenue);
  }, [allSales]);

  // Revenue by month — last 12 calendar months, with gaps filled as 0 so the
  // chart shows an honest time axis (previously consecutive months with no
  // sales were collapsed, making the chart misleading).
  const byMonth = useMemo(() => {
    const acc = {};
    allSales.forEach(sale => {
      if (!sale.date) return;
      const key = sale.date.slice(0,7);
      acc[key] = (acc[key] || 0) + computeRevenue(sale);
    });
    // Generate the 12-month rolling window ending at the current month
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        month: key.slice(5),
        revenue: parseFloat((acc[key] || 0).toFixed(2)),
      });
    }
    return months;
  }, [allSales]);

  // Top customers
  const customerRevenue = useMemo(() => {
    const acc = {};
    allSales.forEach(sale => {
      if (!sale.buyerId) return;
      acc[sale.buyerId] = (acc[sale.buyerId] || 0) + computeRevenue(sale);
    });
    return Object.entries(acc).map(([id, revenue]) => {
      const c = customers.find(x => x.id === id);
      return { id, name: c?.name || "Unknown", revenue };
    }).sort((a,b) => b.revenue - a.revenue);
  }, [allSales, customers]);

  // ---------------------------------------------------------------------------
  // FIFO or Simple profit/expense stats — per-hobby, infrastructure excluded
  // ---------------------------------------------------------------------------
  // Pulls expenses from data.entries[hobbyId] (fed, bedding, fertilized,
  // supplies, restock) plus structural costs (flock buys, chick cost,
  // hive cost). Infrastructure is intentionally NOT included — it's one-time
  // capital and would distort ongoing profitability for years.
  //
  // FIFO mode: matches oldest expenses to sales chronologically; surfaces an
  // unmatched-backlog list. Expenses outside the window are still consumable.
  //
  // Simple mode: cash in vs cash out within the window. No backlog tracking.
  // Matches the standard homesteader mental model ("did I spend more than I
  // made this month?").
  const fifoStats = useMemo(() => profitStats(data, profitWindow, profitMode, legacyEggSales), [data, legacyEggSales, profitWindow, profitMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteSale = (id) => {
    update(d => removeSale(d, id));
  };

  const saveCustomer = (customer) => {
    update(d => {
      d.customers = d.customers || [];
      const idx = d.customers.findIndex(c => c.id === customer.id);
      if (idx !== -1) d.customers[idx] = customer;
      else d.customers.push(customer);
      return d;
    });
  };

  const deleteCustomer = (id) => {
    update(d => { d.customers = (d.customers||[]).filter(c => c.id !== id); return d; });
  };

  const availableTypes = ["all", ...Array.from(new Set(allSales.map(s => s.hobbyType)))];

  return (
    <div>
      {showAddSale && <AddSaleModal data={data} update={update} onClose={() => setShowAddSale(false)} />}
      {editingSale && <AddSaleModal data={data} update={update} onClose={() => setEditingSale(null)} existingSale={editingSale} />}
      {showAddExpense && <AddExpenseModal data={data} update={update} onClose={() => setShowAddExpense(false)} />}
      {editingExpense && <AddExpenseModal data={data} update={update} onClose={() => { setEditingExpense(null); setEditingOccurrenceDate(null); }} existingExpense={editingExpense} occurrenceDate={editingOccurrenceDate} />}
      {showAddCustomer && <CustomerModal onSave={saveCustomer} onClose={() => setShowAddCustomer(false)} />}
      {editingCustomer && <CustomerModal customer={editingCustomer} onSave={saveCustomer} onClose={() => setEditingCustomer(null)} />}
      {showYearReport && <YearEndReportModal data={data} onClose={() => setShowYearReport(false)} />}

      {!embedded && <>
      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10 }}>
        <h2 style={{ fontFamily:FONT_DISPLAY,fontSize:26,margin:0,color:palette.ink }}>sales</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={() => setShowAddSale(true)}>+ Log sale</Btn>
          <Btn onClick={() => setShowAddExpense(true)}>+ Log expense</Btn>
        </div>
      </div>

      <button type="button" onClick={() => setShowYearReport(true)} style={{
        width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 14px",marginBottom:14,
        background:palette.card,border:`1.5px solid ${palette.ink}`,borderRadius:12,cursor:"pointer",
        fontFamily:FONT_BODY,textAlign:"left",color:palette.ink,boxShadow:"none",
      }}>
        <span style={{ fontSize:22 }}>📄</span>
        <span style={{ flex:1 }}>
          <span style={{ display:"block",fontWeight:700,fontSize:14 }}>Year-end report</span>
          <span style={{ display:"block",fontSize:12,color:palette.inkSoft }}>Sales, expenses and profit by month and category. Download a PDF or spreadsheet for your records or taxes.</span>
        </span>
        <span style={{ fontSize:18,color:palette.inkSoft }}>›</span>
      </button>

      {onPurchaseHistory && (
        <button type="button" onClick={onPurchaseHistory} style={{
          width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 14px",marginBottom:14,
          background:palette.card,border:`1.5px solid ${palette.ink}`,borderRadius:12,cursor:"pointer",
          fontFamily:FONT_BODY,textAlign:"left",color:palette.ink,boxShadow:"none",
        }}>
          <span style={{ fontSize:22 }}>🧾</span>
          <span style={{ flex:1 }}>
            <span style={{ display:"block",fontWeight:700,fontSize:14 }}>Purchase history</span>
            <span style={{ display:"block",fontSize:12,color:palette.inkSoft }}>When you last bought each thing, what it cost, and how often you buy it.</span>
          </span>
          <span style={{ fontSize:18,color:palette.inkSoft }}>›</span>
        </button>
      )}

      {onEmailCustomers && (
        <button type="button" onClick={onEmailCustomers} style={{
          width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 14px",marginBottom:14,
          background:palette.card,border:`1.5px solid ${palette.ink}`,borderRadius:12,cursor:"pointer",
          fontFamily:FONT_BODY,textAlign:"left",color:palette.ink,boxShadow:"none",
        }}>
          <span style={{ fontSize:22 }}>📧</span>
          <span style={{ flex:1 }}>
            <span style={{ display:"block",fontWeight:700,fontSize:14 }}>Email your customers</span>
            <span style={{ display:"block",fontSize:12,color:palette.inkSoft }}>Tell them what's in stock. Tap items, pick a list (eggs, milk…), send.</span>
          </span>
          <span style={{ fontSize:18,color:palette.inkSoft }}>›</span>
        </button>
      )}

      </>}

      {/* Revenue summary cards */}
      <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:16 }}>
        <div style={{ flex:"1 1 140px",background:palette.deep,color:palette.onDeep,borderRadius:12,padding:14 }}>
          <div style={{ fontSize:10,opacity:0.7,textTransform:"uppercase",letterSpacing:1,marginBottom:6 }}>All-time revenue</div>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:32,color:palette.yolk,lineHeight:1 }}>{fmtMoney(totalRevenue)}</div>
          <div style={{ fontSize:11,opacity:0.7,marginTop:4 }}>{allSales.length} sale{allSales.length===1?"":"s"}</div>
        </div>
        <div style={{ flex:"1 1 140px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14 }}>
          <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:6 }}>This month</div>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:32,color:palette.leaf,lineHeight:1 }}>{fmtMoney(thisMonthRevenue)}</div>
        </div>
        {byType.length > 0 && byType.slice(0,1).map(t => (
          <div key={t.name} style={{ flex:"1 1 140px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14 }}>
            <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:6 }}>Top category</div>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:24,color:palette.ink,lineHeight:1 }}>{t.emoji} {t.name}</div>
            <div style={{ fontSize:12,color:palette.inkSoft,marginTop:4 }}>{fmtMoney(t.revenue)}</div>
          </div>
        ))}
        {totalTips > 0 && (
          <div style={{ flex:"1 1 140px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14 }}>
            <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:6 }}>Tips</div>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:32,color:palette.leaf,lineHeight:1 }}>{fmtMoney(totalTips)}</div>
            <div style={{ fontSize:11,color:palette.inkSoft,marginTop:4 }}>on top of revenue</div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* Profit & Expenses (FIFO, per-hobby, infrastructure excluded)   */}
      {/* ============================================================== */}
      {/* Only show this section if there's actual data to discuss. New
          users with no expenses and no sales would just see empty zeros,
          which is more confusing than helpful. */}
      {(fifoStats.totalRevenue > 0 || fifoStats.totalExpenses > 0 || fifoStats.totalBacklog > 0) && (
        <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:14 }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8 }}>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,color:palette.ink }}>Profit & expenses</div>
            <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
              {WINDOW_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setProfitWindow(opt.key)}
                  style={{
                    padding:"4px 9px",borderRadius:6,fontSize:11,fontWeight:600,fontFamily:FONT_BODY,
                    background: profitWindow===opt.key ? palette.ink : palette.bgAlt,
                    color: profitWindow===opt.key ? palette.bg : palette.ink,
                    border:`1px solid ${palette.line}`,cursor:"pointer",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode toggle — Simple (cash in vs cash out, matches homesteader
              mental model) vs FIFO (true cost-per-unit accounting). Default
              is Simple; FIFO is opt-in for users who want deeper analysis. */}
          <div style={{ display:"flex",gap:0,marginBottom:10,background:palette.bgAlt,borderRadius:8,padding:3,border:`1px solid ${palette.line}` }}>
            {[
              { key: "simple", label: "Simple", help: "Cash in vs cash out, dated within the window" },
              { key: "fifo", label: "FIFO", help: "Match expenses to sales chronologically for true cost-per-unit" },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setProfitModeAndPersist(opt.key)}
                title={opt.help}
                style={{
                  flex:1,padding:"6px 10px",borderRadius:6,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,
                  background: profitMode===opt.key ? palette.ink : "transparent",
                  color: profitMode===opt.key ? palette.bg : palette.inkSoft,
                  border:"none",cursor:"pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Mode-specific disclaimer */}
          <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:12,lineHeight:1.4 }}>
            {profitMode === "simple"
              ? "Simple math: revenue and expenses dated within the window above. Excludes one-time infrastructure costs (coops, fencing, etc)."
              : "FIFO matching: oldest expenses are paid off first by sales, within each hobby. Excludes one-time infrastructure costs (coops, fencing, etc)."}
          </div>

          {/* Helpful nudge when revenue > 0 but expenses == 0 — most likely
              the user hasn't logged expenses yet, which makes profit look
              identical to revenue. Without this hint, users often think the
              app is broken. */}
          {fifoStats.totalRevenue > 0 && fifoStats.totalExpenses === 0 && (
            <div style={{ fontSize:12,color:palette.ink,background:palette.bgAlt,border:`1px solid ${palette.line}`,borderRadius:8,padding:"10px 12px",marginBottom:12,lineHeight:1.5 }}>
              💡 You have revenue but no expenses logged yet, so profit equals revenue.
              Tap <strong>💵 Add Expense</strong> on any hobby's quick-log to track feed, bedding,
              supplies, etc. — then you'll see real profit numbers here.
            </div>
          )}

          {/* Three headline cards: revenue, expenses, net profit */}
          <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:14 }}>
            <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
              <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Revenue</div>
              <div style={{ fontFamily:FONT_DISPLAY,fontSize:22,color:palette.leaf,lineHeight:1 }}>{fmtMoney(fifoStats.totalRevenue)}</div>
            </div>
            <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
              <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Expenses</div>
              <div style={{ fontFamily:FONT_DISPLAY,fontSize:22,color:palette.accent,lineHeight:1 }}>{fmtMoney(fifoStats.totalExpenses)}</div>
            </div>
            <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
              <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Net profit</div>
              <div style={{ fontFamily:FONT_DISPLAY,fontSize:22,color:fifoStats.netProfit>=0?palette.leaf:palette.accent,lineHeight:1 }}>{fmtMoney(fifoStats.netProfit)}</div>
            </div>
          </div>

          {/* Per-hobby profit bar chart — only when 2+ hobbies have activity.
              Single-hobby users would see a one-bar chart which adds no info. */}
          {fifoStats.byHobby.length >= 2 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12,fontWeight:600,color:palette.inkSoft,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5 }}>Profit by hobby</div>
              <ResponsiveContainer width="100%" height={Math.max(140, fifoStats.byHobby.length * 32)}>
                <BarChart
                  data={fifoStats.byHobby.map(h => ({
                    name: `${h.emoji} ${h.label}`,
                    profit: parseFloat(h.profit.toFixed(2)),
                  }))}
                  layout="vertical"
                  margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
                >
                  <XAxis type="number" stroke={palette.inkSoft} fontSize={10} tickFormatter={(v) => fmtMoneyWhole(v)} />
                  <YAxis type="category" dataKey="name" stroke={palette.inkSoft} fontSize={11} width={110} />
                  <Tooltip
                    contentStyle={{ background:palette.card,border:`1.5px solid ${palette.ink}`,borderRadius:8 }}
                    formatter={v=>[fmtMoney(v),"Net profit"]}
                  />
                  <Bar dataKey="profit" radius={[0,4,4,0]}>
                    {fifoStats.byHobby.map((h, i) => (
                      <Cell
                        key={i}
                        fill={h.profit >= 0 ? palette.leaf : palette.accent}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Per-hobby unmatched backlog — only when backlog actually exists. 
              This is the "money in, not yet recouped" view. Honest and useful:
              tells you which hobby is the cash drag. Each row shows hobby +
              dollar amount of unmatched expenses. */}
          {fifoStats.backlog.length > 0 && (
            <div>
              <div style={{ fontSize:12,fontWeight:600,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5 }}>
                Unmatched expense backlog
              </div>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:8,lineHeight:1.4 }}>
                Money spent that hasn't been recouped by sales yet — broken out per hobby.
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {fifoStats.backlog.map(b => (
                  <div key={b.hobbyId} style={{
                    display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"8px 10px",background:palette.bgAlt,borderRadius:6,fontSize:13,
                  }}>
                    <span>{b.emoji} {b.label}</span>
                    <strong style={{ color:palette.accent }}>{fmtMoney(b.unmatched)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Revenue by month chart */}
      {/* Revenue by month chart — only when at least one month has revenue */}
      {byMonth.some(m => m.revenue > 0) && (
        <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:14 }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,marginBottom:10,color:palette.ink }}>Revenue over time</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byMonth}>
              <XAxis dataKey="month" stroke={palette.inkSoft} fontSize={11} />
              <YAxis stroke={palette.inkSoft} fontSize={11} tickFormatter={(v) => fmtMoneyWhole(v)} />
              <Tooltip contentStyle={{ background:palette.card,border:`1.5px solid ${palette.ink}`,borderRadius:8 }} formatter={v=>[fmtMoney(v),"Revenue"]} />
              <Bar dataKey="revenue" fill={palette.leaf} radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Revenue by category */}
      {byType.length > 1 && (
        <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:14 }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,marginBottom:10,color:palette.ink }}>By category</div>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {byType.map(t => (
              <div key={t.name} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:palette.bgAlt,borderRadius:6,fontSize:13 }}>
                <span>{t.emoji} {t.name}</span>
                <strong>{fmtMoney(t.revenue)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top customers */}
      {customerRevenue.length > 0 && (
        <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:14 }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,marginBottom:10,color:palette.ink }}>Top customers</div>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {customerRevenue.slice(0,5).map(c => (
              <div key={c.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:palette.bgAlt,borderRadius:6,fontSize:13 }}>
                <span>👤 {c.name}</span>
                <strong>{fmtMoney(c.revenue)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter + log */}
      <div id="sales-log" style={{ scrollMarginTop: 16, display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8 }}>
        <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink }}>Sales &amp; expenses log</div>
        <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
          {availableTypes.map(t => (
            <button key={t} onClick={() => setFilterType(t)} style={{
              padding:"5px 10px",borderRadius:6,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,
              background: filterType===t ? palette.ink : palette.card,
              color: filterType===t ? palette.bg : palette.ink,
              border:`1.5px solid ${palette.line}`,cursor:"pointer",
            }}>
              {t === "all" ? "All" : (HOBBY_META()[t]?.emoji + " " + HOBBY_META()[t]?.label)}
            </button>
          ))}
        </div>
      </div>

      {(() => {
        // Merge sales + expenses into a single date-sorted timeline.
        // Sale.hobbyType maps to a hobby id via SALE_TO_HOBBY for filter matching.
        const allExpensesExpanded = expandRecurringExpenses(data.expenses || []);
        const filteredExpenses = filterType === "all"
          ? allExpensesExpanded
          : allExpensesExpanded.filter(ex => {
              // filterType is a hobbyType (e.g. "eggs"); map back to hobbyId for expense matching.
              const SALE_TO_HOBBY_LOCAL = { eggs: "egg_layers", honey: "bees", meat_chickens: "meat_chickens", rabbits: "rabbits", garden: "garden", farmstand: "farmstand", sourdough: "sourdough", baking: "baking", canning: "canning", incubator: "incubator", horse: "horses", cow: "cows", goat: "goats", sheep: "sheep", pig: "pigs", dog: "dogs", cat: "cats", maple_syrup: "maple_syrup", tincture: "tincture", oil_infusion: "oil_infusion", salve: "salve", tea: "tea", rabbit: "rabbits", soap: "soap" };
              return ex.hobbyId === SALE_TO_HOBBY_LOCAL[filterType];
            });

        // Entry-sourced expenses — costs that were logged on a hobby's page
        // (feed/bedding/fertilizer/supplies/restock) PLUS structural buys
        // (flock/chick/hive/animal purchases). These live in data.entries and
        // the hobby objects, NOT in data.expenses, so historically they never
        // showed up in this log even though they DO count toward the profit
        // totals — which is exactly why a logged feed cost "disappeared."
        // We surface them here as READ-ONLY rows so the log reconciles with
        // the headline total. They're edited on the hobby page, not here.
        //
        // We exclude source "logged_expense": those ARE data.expenses rows and
        // are already rendered from allExpensesExpanded above — pulling them in
        // again would show every Add-Expense row twice.
        const ENTRY_EXP_LABEL = {
          fed: "Feed", bedding: "Bedding", fertilized: "Fertilizer",
          supplies: "Supplies", restock: "Restock",
          flock_purchase: "Birds", chick_purchase: "Chicks",
          hive_purchase: "Hive", animal_purchase: "Animal",
        };
        const entrySourcedExpenses = [];
        for (const h of (data.hobbies || [])) {
          const rows = extractHobbyExpenses(data, h.id);
          for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (r.source === "logged_expense") continue; // already shown via data.expenses
            entrySourcedExpenses.push({
              id: `entry:${h.id}:${r.date}:${r.source}:${i}`,
              date: r.date,
              amount: r.cost,
              category: ENTRY_EXP_LABEL[r.source] || "Expense",
              hobbyId: h.id,
              note: r.note || "",
              _entrySourced: true,
            });
          }
        }
        const filteredEntrySourced = filterType === "all"
          ? entrySourcedExpenses
          : entrySourcedExpenses.filter(ex => {
              const SALE_TO_HOBBY_LOCAL = { eggs: "egg_layers", honey: "bees", meat_chickens: "meat_chickens", rabbits: "rabbits", garden: "garden", farmstand: "farmstand", sourdough: "sourdough", baking: "baking", canning: "canning", incubator: "incubator", horse: "horses", cow: "cows", goat: "goats", sheep: "sheep", pig: "pigs", dog: "dogs", cat: "cats", maple_syrup: "maple_syrup", tincture: "tincture", oil_infusion: "oil_infusion", salve: "salve", tea: "tea", rabbit: "rabbits", soap: "soap" };
              return ex.hobbyId === SALE_TO_HOBBY_LOCAL[filterType];
            });

        const merged = [
          ...filtered.map(s => ({ kind: "sale", item: s, date: s.date || "" })),
          ...filteredExpenses.map(e => ({ kind: "expense", item: e, date: e.date || "" })),
          ...filteredEntrySourced.map(e => ({ kind: "expense", item: e, date: e.date || "" })),
        ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

        if (merged.length === 0) {
          return (
            <div style={{ padding:32,background:palette.card,border:`1.5px dashed ${palette.line}`,borderRadius:12,textAlign:"center",color:palette.inkSoft }}>
              {allSales.length === 0 && allExpensesExpanded.length === 0 ? (
                <>
                  <div style={{ fontSize:32,marginBottom:10 }}>💰</div>
                  <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink,marginBottom:6 }}>Nothing logged yet</div>
                  <div style={{ fontSize:13,marginBottom:14 }}>Tap "Log sale" or "Log expense" to get started.</div>
                  <Btn onClick={() => setShowAddSale(true)}>+ Log your first sale</Btn>
                </>
              ) : "Nothing in this category."}
            </div>
          );
        }
        return (
          <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:20 }}>
            {merged.map(row => row.kind === "sale" ? (
              <SaleRow
                key={"s:" + row.item.id}
                sale={row.item}
                customers={customers}
                onEdit={() => setEditingSale(row.item)}
                onDelete={() => deleteSale(row.item.id)}
              />
            ) : (
              <ExpenseRow
                key={"e:" + (row.item._occKey || row.item.id)}
                expense={row.item}
                hobbies={data.hobbies}
                readOnly={!!row.item._entrySourced}
                onEdit={() => {
                  // Virtual instance from a recurring template: open the
                  // template (parent) so user can edit the series — OR pick
                  // "this occurrence only" to detach.
                  const parentId = row.item._parentId;
                  if (parentId) {
                    const parent = (data.expenses || []).find(x => x.id === parentId);
                    if (parent) {
                      setEditingExpense(parent);
                      setEditingOccurrenceDate(row.item.date);
                    }
                  } else {
                    setEditingExpense(row.item);
                    setEditingOccurrenceDate(null);
                  }
                }}
                onDelete={async () => {
                  const parentId = row.item._parentId;
                  if (!parentId) {
                    // Non-recurring expense — simple delete.
                    if (!(await askConfirm({ title: "Delete this expense?", confirmLabel: "Delete" }))) return;
                    update(d => {
                      d.expenses = (d.expenses || []).filter(e => e.id !== row.item.id);
                      return d;
                    });
                    return;
                  }
                  // One of a repeating expense's months: skip just this one, or
                  // delete the whole series.
                  const occurrenceDateText = fmtDate(row.item.date);
                  const pick = await askChoice({ title: "Delete a repeating expense", message: `This expense repeats. Delete just the ${occurrenceDateText} one, or every one?`,
                    choices: [{ label: `Just ${occurrenceDateText}`, value: "one", danger: true }, { label: "The whole series", value: "all", danger: true }] });
                  if (pick === "one") {
                    update(d => {
                      const parent = (d.expenses || []).find(e => e.id === parentId);
                      if (!parent) return d;
                      const skipped = Array.isArray(parent.skippedDates) ? parent.skippedDates : [];
                      if (!skipped.includes(row.item.date)) skipped.push(row.item.date);
                      parent.skippedDates = skipped;
                      return d;
                    });
                    return;
                  }
                  if (pick === "all") {
                    update(d => {
                      d.expenses = (d.expenses || []).filter(e => e.id !== parentId);
                      return d;
                    });
                  }
                }}
              />
            ))}
          </div>
        );
      })()}

      {/* Farm Stand profit section */}
      {allSales.filter(s=>s.hobbyType==="farmstand").length > 0 && (() => {
        const fsSales = allSales.filter(s=>s.hobbyType==="farmstand");
        const fsRevenue = fsSales.reduce((s,x)=>s+computeRevenue(x),0);
        const fsCost = fsSales.reduce((s,x)=>s+(Number(x.totalCost)||0),0);
        const fsProfit = fsRevenue - fsCost;
        const fsMargin = fsRevenue > 0 ? ((fsProfit/fsRevenue)*100).toFixed(1) : "—";
        // Most popular item
        const itemCounts = {};
        fsSales.forEach(s=>{ if(s.crop) itemCounts[s.crop]=(itemCounts[s.crop]||0)+(Number(s.qty)||1); });
        const topItem = Object.entries(itemCounts).sort((a,b)=>b[1]-a[1])[0];
        return (
          <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:14 }}>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,marginBottom:10,color:palette.ink }}>🧾 Farm Stand</div>
            <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:10 }}>
              <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
                <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Revenue</div>
                <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.leaf }}>{fmtMoney(fsRevenue)}</div>
              </div>
              <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
                <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Profit</div>
                <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:fsProfit>=0?palette.leaf:palette.accent }}>{fmtMoney(fsProfit)}</div>
              </div>
              <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
                <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Margin</div>
                <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.feather }}>{fsMargin}{fsMargin!=="—"?"%":""}</div>
              </div>
              {topItem && (
                <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
                  <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Top item</div>
                  <div style={{ fontSize:14,fontWeight:700,color:palette.ink }}>{topItem[0]}</div>
                  <div style={{ fontSize:11,color:palette.inkSoft }}>{topItem[1]} units sold</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Sourdough profit section */}
      {allSales.filter(s=>s.hobbyType==="sourdough").length > 0 && (() => {
        const sdSales = allSales.filter(s=>s.hobbyType==="sourdough");
        const sdRevenue = sdSales.reduce((s,x)=>s+computeRevenue(x),0);
        const sdCost = sdSales.reduce((s,x)=>s+(Number(x.totalCost)||0),0);
        const sdProfit = sdRevenue - sdCost;
        const sdMargin = sdRevenue > 0 ? ((sdProfit/sdRevenue)*100).toFixed(1) : "—";
        const sdLoaves = sdSales.reduce((s,x)=>s+(Number(x.qty)||0),0);
        // Most popular recipe
        const recipeCounts = {};
        sdSales.forEach(s=>{ if(s.crop) recipeCounts[s.crop]=(recipeCounts[s.crop]||0)+(Number(s.qty)||1); });
        const topRecipe = Object.entries(recipeCounts).sort((a,b)=>b[1]-a[1])[0];
        return (
          <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:14 }}>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,marginBottom:10,color:palette.ink }}>🍞 Sourdough</div>
            <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:10 }}>
              <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
                <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Loaves sold</div>
                <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.yolk }}>{sdLoaves}</div>
              </div>
              <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
                <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Revenue</div>
                <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.leaf }}>{fmtMoney(sdRevenue)}</div>
              </div>
              <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
                <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Profit</div>
                <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:sdProfit>=0?palette.leaf:palette.accent }}>{fmtMoney(sdProfit)}</div>
              </div>
              <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
                <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Margin</div>
                <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.feather }}>{sdMargin}{sdMargin!=="—"?"%":""}</div>
              </div>
              {topRecipe && (
                <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
                  <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Top recipe</div>
                  <div style={{ fontSize:14,fontWeight:700,color:palette.ink }}>{topRecipe[0]}</div>
                  <div style={{ fontSize:11,color:palette.inkSoft }}>{topRecipe[1]} loa{topRecipe[1] === 1 ? "f" : "ves"} sold</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Baking profit section */}
      {allSales.filter(s=>s.hobbyType==="baking").length > 0 && (() => {
        const bSales = allSales.filter(s=>s.hobbyType==="baking");
        const bRevenue = bSales.reduce((s,x)=>s+computeRevenue(x),0);
        const bCost = bSales.reduce((s,x)=>s+(Number(x.totalCost)||0),0);
        const bProfit = bRevenue - bCost;
        const bMargin = bRevenue > 0 ? ((bProfit/bRevenue)*100).toFixed(1) : "—";
        const bItems = bSales.reduce((s,x)=>s+(Number(x.qty)||0),0);
        const recipeCounts = {};
        bSales.forEach(s=>{ if(s.crop) recipeCounts[s.crop]=(recipeCounts[s.crop]||0)+(Number(s.qty)||1); });
        const topRecipe = Object.entries(recipeCounts).sort((a,b)=>b[1]-a[1])[0];
        return (
          <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:14 }}>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,marginBottom:10,color:palette.ink }}>🥧 Baking</div>
            <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:10 }}>
              <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
                <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Items sold</div>
                <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.yolk }}>{bItems}</div>
              </div>
              <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
                <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Revenue</div>
                <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.leaf }}>{fmtMoney(bRevenue)}</div>
              </div>
              <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
                <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Profit</div>
                <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:bProfit>=0?palette.leaf:palette.accent }}>{fmtMoney(bProfit)}</div>
              </div>
              <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
                <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Margin</div>
                <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.feather }}>{bMargin}{bMargin!=="—"?"%":""}</div>
              </div>
              {topRecipe && (
                <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
                  <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Top recipe</div>
                  <div style={{ fontSize:14,fontWeight:700,color:palette.ink }}>{topRecipe[0]}</div>
                  <div style={{ fontSize:11,color:palette.inkSoft }}>{topRecipe[1]} sold</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Canning profit section */}
      {allSales.filter(s=>s.hobbyType==="canning").length > 0 && (() => {
        const cSales = allSales.filter(s=>s.hobbyType==="canning");
        const cRevenue = cSales.reduce((s,x)=>s+computeRevenue(x),0);
        const cCost = cSales.reduce((s,x)=>s+(Number(x.totalCost)||0),0);
        const cProfit = cRevenue - cCost;
        const cMargin = cRevenue > 0 ? ((cProfit/cRevenue)*100).toFixed(1) : "—";
        const cJars = cSales.reduce((s,x)=>s+(Number(x.qty)||0),0);
        const itemCounts = {};
        cSales.forEach(s=>{ if(s.crop) itemCounts[s.crop]=(itemCounts[s.crop]||0)+(Number(s.qty)||1); });
        const topItem = Object.entries(itemCounts).sort((a,b)=>b[1]-a[1])[0];
        return (
          <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:14 }}>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,marginBottom:10,color:palette.ink }}>🫙 Canning</div>
            <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:10 }}>
              <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
                <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Jars sold</div>
                <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.leafSoft }}>{cJars}</div>
              </div>
              <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
                <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Revenue</div>
                <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.leaf }}>{fmtMoney(cRevenue)}</div>
              </div>
              <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
                <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Profit</div>
                <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:cProfit>=0?palette.leaf:palette.accent }}>{fmtMoney(cProfit)}</div>
              </div>
              <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
                <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Margin</div>
                <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.feather }}>{cMargin}{cMargin!=="—"?"%":""}</div>
              </div>
              {topItem && (
                <div style={{ flex:"1 1 100px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
                  <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Top item</div>
                  <div style={{ fontSize:14,fontWeight:700,color:palette.ink }}>{topItem[0]}</div>
                  <div style={{ fontSize:11,color:palette.inkSoft }}>{topItem[1]} jar{topItem[1] === 1 ? "" : "s"} sold</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Customers section */}
      <div id="sales-customers" style={{ scrollMarginTop: 16, background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,overflow:"hidden",marginBottom:14 }}>
        <button onClick={() => setShowCustomers(!showCustomers)} style={{ width:"100%",padding:"14px 16px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:FONT_BODY }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <User size={16} color={palette.inkSoft} />
            <span style={{ fontFamily:FONT_DISPLAY,fontSize:18,color:palette.ink }}>Customers ({customers.length})</span>
          </div>
          <ChevronDown size={16} color={palette.inkSoft} style={{ transform: showCustomers?"rotate(180deg)":"", transition:"transform 0.2s" }} />
        </button>
        {showCustomers && (
          <div style={{ padding:"0 16px 16px",borderTop:`1px solid ${palette.line}` }}>
            <div style={{ display:"flex",justifyContent:"flex-end",marginBottom:10,paddingTop:10 }}>
              <Btn small onClick={() => setShowAddCustomer(true)}>+ Add customer</Btn>
            </div>
            {customers.length === 0 ? (
              <div style={{ fontSize:13,color:palette.inkSoft,textAlign:"center",padding:"12px 0" }}>No customers yet. Add them when logging a sale.</div>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {customers.map(c => {
                  const spent = allSales.filter(s=>s.buyerId===c.id).reduce((sum,s)=>sum+computeRevenue(s),0);
                  return (
                    <div key={c.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:palette.bgAlt,borderRadius:8 }}>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontWeight:600,fontSize:14,color:palette.ink }}>{c.name}</div>
                        {c.note && <div style={{ fontSize:11,color:palette.inkSoft }}>{c.note}</div>}
                        {(c.phone || c.email) && <div style={{ fontSize:11,color:palette.inkSoft,overflowWrap:"anywhere" }}>{[c.phone, c.textOk ? "OK to text" : null, c.email].filter(Boolean).join(" · ")}</div>}
                        {spent > 0 && <div style={{ fontSize:11,color:palette.leaf,fontWeight:600 }}>{fmtMoney(spent)} total</div>}
                      </div>
                      <button onClick={() => setEditingCustomer(c)} style={{ background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,padding:4 }}><Edit3 size={14}/></button>
                      <button onClick={() => deleteCustomer(c.id)} style={{ background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,padding:4 }}><Trash2 size={14}/></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// EXPORTED HELPERS — used by hobby Stats pages to show sales section
// ============================================================================

// Get all sales for a given hobbyType (includes legacy sold_eggs for eggs)
// Every sale on the homestead: `data.sales` (modern, editable) merged with
// legacy `sold_eggs` entries (from the old per-flock egg-sale logger), newest
// first. When IDs collide, `data.sales` WINS — the migration in
// HomesteadApp.jsx copies legacy entries into `data.sales`, and the editable
// version must take precedence (the reverse once locked people out of editing
// migrated sales). Legacy rows use deriveSoldEggsRevenue so entries without a
// clean pricePerDozen still carry the right revenue.
//
// Also a read-time fix for OLD brooder-disposition sales written with the
// wrong field names (quantity/item/customer/notes instead of qty/
// pricePerUnit/customerName/note), so they render and edit correctly. The
// write-time fix is in Incubator.jsx.
export function collectAllSales(data) {
  const sales = (data && data.sales) || [];
  const legacyEggSales = ((data && data.entries && data.entries["egg_layers"]) || [])
    .filter(e => e.action === "sold_eggs")
    .map(e => {
      const { revenue, pricePerDozen, qty } = deriveSoldEggsRevenue(e);
      return {
        id: e.id, date: e.date, hobbyType: "eggs",
        eggType: "Chicken", eggPurpose: "Eating",
        qty, unit: "eggs",
        pricePerUnit: pricePerDozen,
        totalRevenue: revenue,
        note: e.note || "", buyerId: null, isLegacy: true,
      };
    });
  const saleIds = new Set(sales.map(s => s.id));
  const legacyOnly = legacyEggSales.filter(s => !saleIds.has(s.id));
  const normalized = [...sales, ...legacyOnly].map(s => {
    if (s.hobbyType !== "incubator") return s;
    const out = { ...s };
    if (out.qty == null && out.quantity != null) out.qty = out.quantity;
    if (out.note == null && out.notes != null) out.note = out.notes;
    if (out.customerName == null && out.customer != null) out.customerName = out.customer;
    if (!out.birdType && typeof out.item === "string") {
      const m = out.item.match(/^(\S+)\s+chicks/i);
      if (m) out.birdType = m[1];
    }
    return out;
  });
  return normalized.sort((a,b) => (b.date||"").localeCompare(a.date||""));
}

// ============================================================================
// YEAR-END REPORT — sales, expenses and net for one calendar year
// ----------------------------------------------------------------------------
// Same sources as the Sales tab totals: every sale (collectAllSales), every
// Add-Expense row (recurring ones expanded, only dates that have happened),
// and the costs logged on hobby pages (feed, bedding, animal purchases… via
// extractHobbyExpenses, skipping "logged_expense" which are data.expenses
// rows already counted). Pure, so the screen, the PDF and the CSV agree.
// ============================================================================
const ENTRY_EXPENSE_LABEL = {
  fed: "Feed", bedding: "Bedding", fertilized: "Fertilizer",
  supplies: "Supplies", restock: "Restock",
  flock_purchase: "Birds", chick_purchase: "Chicks",
  hive_purchase: "Hive", animal_purchase: "Animals",
  infrastructure: "Building and equipment",
};

export function reportYears(data) {
  const ys = new Set([new Date().getFullYear()]);
  collectAllSales(data).forEach(s => { if (s.date) ys.add(Number(s.date.slice(0, 4))); });
  (data.expenses || []).forEach(e => { if (e && e.date) ys.add(Number(e.date.slice(0, 4))); });
  return [...ys].filter(y => y > 1990 && y < 2100).sort((a, b) => b - a);
}

export function buildYearReport(data, year, now = new Date()) {
  const y = String(year);
  const todayIso = isoDate(now);
  const inYear = (d) => typeof d === "string" && d.slice(0, 4) === y && d <= todayIso;
  const hobbyName = (id) => {
    const h = (data.hobbies || []).find(x => x.id === id);
    return h ? (h.name || h.type) : (id ? String(id) : "General");
  };

  // Sales name their buyer by buyerId (customerName is only on chick sales),
  // so the report's Customer column was blank for nearly every sale.
  const who = new Map((data.customers || []).filter((c) => c && c.id).map((c) => [c.id, c.name || ""]));
  const sales = collectAllSales(data).filter(s => inYear(s.date)).map(s => ({
    date: s.date,
    hobby: (HOBBY_META()[s.hobbyType] || HOBBY_META().other).label,
    item: s.item || s.eggType || s.crop || s.saleForm || s.birdType || (HOBBY_META()[s.hobbyType] || HOBBY_META().other).label,
    customer: (s.buyerId && who.get(s.buyerId)) || s.customerName || s.buyer || "",
    qty: s.qty != null ? `${s.qty}${s.unit ? ` ${s.unit}` : ""}` : "",
    amount: Math.round(computeRevenue(s) * 100) / 100,
    tip: Number(s.tip) || 0,
    note: s.note || "",
  }));

  const expenses = [];
  for (const e of expandRecurringExpenses(data.expenses || [])) {
    if (!e || !inYear(e.date)) continue;
    const amount = Number(e.amount) || 0;
    if (amount <= 0) continue;
    expenses.push({ date: e.date, hobby: hobbyName(e.hobbyId), category: e.category || "Other", amount, note: e.description || e.note || "" });
  }
  for (const h of (data.hobbies || [])) {
    // Building and equipment (coops, fencing) is left out of profit but is
    // part of what the homestead spent this year.
    for (const r of [...extractHobbyExpenses(data, h.id), ...extractBuildCosts(data, h.id)]) {
      if (r.source === "logged_expense" || !inYear(r.date)) continue;
      expenses.push({ date: r.date, hobby: h.name || h.type, category: ENTRY_EXPENSE_LABEL[r.source] || "Supplies", amount: Number(r.cost) || 0, note: r.note || "" });
    }
  }
  sales.sort((a, b) => a.date.localeCompare(b.date));
  expenses.sort((a, b) => a.date.localeCompare(b.date));

  const sum = (arr, k = "amount") => Math.round(arr.reduce((t, x) => t + (Number(x[k]) || 0), 0) * 100) / 100;
  const group = (arr, key) => {
    const m = new Map();
    arr.forEach(x => m.set(x[key], (m.get(x[key]) || 0) + (Number(x.amount) || 0)));
    return [...m.entries()].map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 })).sort((a, b) => b.amount - a.amount);
  };
  const months = Array.from({ length: 12 }, (_, i) => {
    const mm = `${y}-${String(i + 1).padStart(2, "0")}`;
    const rev = sum(sales.filter(s => s.date.startsWith(mm)));
    const exp = sum(expenses.filter(e => e.date.startsWith(mm)));
    return { month: new Date(Number(y), i, 1).toLocaleDateString("en-US", { month: "short" }), revenue: rev, expenses: exp, net: Math.round((rev - exp) * 100) / 100 };
  });

  const revenue = sum(sales);
  const spent = sum(expenses);
  return {
    year: Number(y),
    partial: Number(y) === now.getFullYear(),
    homesteadName: data.homesteadName || "My Homestead",
    revenue, tips: sum(sales, "tip"), expenses: spent, net: Math.round((revenue - spent) * 100) / 100,
    salesCount: sales.length, expenseCount: expenses.length,
    revenueByHobby: group(sales, "hobby"),
    expensesByCategory: group(expenses, "category"),
    expensesByHobby: group(expenses, "hobby"),
    months, sales, expensesList: expenses,
  };
}

// Said on the report screen, in the PDF and in the spreadsheet.
export const YEAR_REPORT_NOTE = "This report is here to help you run and grow your homestead. It isn't tax advice, and Henalytics isn't made by an accountant. If you're filing taxes, go over these numbers with a tax professional.";

export function yearReportCsv(r) {
  // A customer name or note starting with = + - @ would run as a formula in
  // a spreadsheet; amounts like -12.00 stay numbers.
  const esc = (v) => { let s = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows = [["Type", "Date", "Hobby", "Item / Category", "Customer", "Quantity", "Amount", "Tip", "Note"]];
  r.sales.forEach(s => rows.push(["Sale", s.date, s.hobby, s.item, s.customer, s.qty, s.amount.toFixed(2), s.tip ? s.tip.toFixed(2) : "", s.note]));
  r.expensesList.forEach(e => rows.push(["Expense", e.date, e.hobby, e.category, "", "", (-e.amount).toFixed(2), "", e.note]));
  rows.push([]);
  rows.push(["Total sales", "", "", "", "", "", r.revenue.toFixed(2)]);
  rows.push(["Total tips", "", "", "", "", "", r.tips.toFixed(2)]);
  rows.push(["Total expenses", "", "", "", "", "", (-r.expenses).toFixed(2)]);
  rows.push(["Net", "", "", "", "", "", r.net.toFixed(2)]);
  rows.push([]);
  rows.push(["Note", YEAR_REPORT_NOTE]);
  return rows.map(row => row.map(esc).join(",")).join("\n");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
// Phones: hand the file to the share sheet (Save to Files, Mail, Drive…).
// Elsewhere (or if sharing files isn't supported): download it.
export async function shareOrDownload(blob, filename, title) {
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return;
  }
  downloadBlob(blob, filename);
}

const money2 = (n) => {
  const v = Number(n) || 0;
  return `${v < 0 ? "-" : ""}${fmtMoney(Math.abs(v))}`;
};

// A plain, printable PDF: summary, monthly table, breakdowns, then every line
// item. jsPDF is loaded only when someone taps the button.
async function buildYearReportPdf(r) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;
  const ensure = (h) => { if (y + h > H - M) { doc.addPage(); y = M; } };
  const text = (t, x, opts = {}) => doc.text(String(t), x, y, opts);
  const line = () => { doc.setDrawColor(200); doc.line(M, y, W - M, y); };

  doc.setFont("helvetica", "bold"); doc.setFontSize(20);
  text(`${r.homesteadName}: ${r.year} year-end report`, M); y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(110);
  text(`${r.partial ? `Year to date, through ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : `January 1 to December 31, ${r.year}`} · Generated by Henalytics`, M); y += 16;
  // Up top so nobody files from it thinking it's tax advice.
  {
    const lines = doc.splitTextToSize(YEAR_REPORT_NOTE, doc.internal.pageSize.getWidth() - 2 * M);
    doc.setFontSize(9); doc.setTextColor(90); doc.text(lines, M, y); y += lines.length * 11 + 14;
  }
  doc.setTextColor(0);

  const boxes = [["Sales", r.revenue], ["Expenses", r.expenses], ["Net", r.net]];
  if (r.tips) boxes.splice(1, 0, ["Tips", r.tips]);
  const bw = (W - 2 * M - (boxes.length - 1) * 10) / boxes.length;
  boxes.forEach(([label, v], i) => {
    const x = M + i * (bw + 10);
    doc.setDrawColor(180); doc.roundedRect(x, y, bw, 52, 6, 6);
    doc.setFontSize(9); doc.setTextColor(110); doc.text(label.toUpperCase(), x + 10, y + 16);
    doc.setFontSize(16); doc.setTextColor(0); doc.setFont("helvetica", "bold"); doc.text(money2(v), x + 10, y + 38);
    doc.setFont("helvetica", "normal");
  });
  y += 76;

  const table = (title, head, rows, widths, alignRight = []) => {
    ensure(40);
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); text(title, M); y += 14;
    doc.setFontSize(9); doc.setTextColor(110);
    let x = M;
    head.forEach((h, i) => { doc.text(h, alignRight.includes(i) ? x + widths[i] - 4 : x, y, { align: alignRight.includes(i) ? "right" : "left" }); x += widths[i]; });
    y += 6; line(); y += 12;
    doc.setFont("helvetica", "normal"); doc.setTextColor(0); doc.setFontSize(9);
    rows.forEach((row) => {
      ensure(14);
      let cx = M;
      row.forEach((cell, i) => {
        const c = doc.splitTextToSize(String(cell == null ? "" : cell), widths[i] - 6)[0] || "";
        doc.text(c, alignRight.includes(i) ? cx + widths[i] - 4 : cx, y, { align: alignRight.includes(i) ? "right" : "left" });
        cx += widths[i];
      });
      y += 13;
    });
    y += 12;
  };
  const cw = W - 2 * M;
  table("By month", ["Month", "Sales", "Expenses", "Net"],
    r.months.map((m) => [m.month, money2(m.revenue), money2(m.expenses), money2(m.net)]),
    [cw * 0.25, cw * 0.25, cw * 0.25, cw * 0.25], [1, 2, 3]);
  if (r.revenueByHobby.length) table("Sales by hobby", ["Hobby", "Amount"], r.revenueByHobby.map((g) => [g.name, money2(g.amount)]), [cw * 0.7, cw * 0.3], [1]);
  if (r.expensesByCategory.length) table("Expenses by category", ["Category", "Amount"], r.expensesByCategory.map((g) => [g.name, money2(g.amount)]), [cw * 0.7, cw * 0.3], [1]);
  if (r.expensesByHobby.length) table("Expenses by hobby", ["Hobby", "Amount"], r.expensesByHobby.map((g) => [g.name, money2(g.amount)]), [cw * 0.7, cw * 0.3], [1]);
  if (r.sales.length) table(`All sales (${r.sales.length})`, ["Date", "Hobby", "Item", "Customer", "Amount"],
    r.sales.map((s) => [s.date, s.hobby, s.item, s.customer, money2(s.amount + (s.tip || 0))]),
    [cw * 0.15, cw * 0.18, cw * 0.32, cw * 0.18, cw * 0.17], [4]);
  if (r.expensesList.length) table(`All expenses (${r.expensesList.length})`, ["Date", "Hobby", "Category", "Note", "Amount"],
    r.expensesList.map((e) => [e.date, e.hobby, e.category, e.note, money2(e.amount)]),
    [cw * 0.15, cw * 0.18, cw * 0.2, cw * 0.3, cw * 0.17], [4]);

  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150);
    doc.text(`henalytics.com · page ${i} of ${pages}`, W - M, H - 24, { align: "right" });
  }
  return doc.output("blob");
}

export function YearEndReportModal({ data, onClose }) {
  const years = useMemo(() => reportYears(data), [data]);
  const [year, setYear] = useState(() => {
    // Early in the year, default to last year (that's the one people file).
    const now = new Date();
    return now.getMonth() <= 3 && years.includes(now.getFullYear() - 1) ? now.getFullYear() - 1 : years[0];
  });
  const [busy, setBusy] = useState("");
  const r = useMemo(() => buildYearReport(data, year), [data, year]);
  const safe = (r.homesteadName || "homestead").replace(/[^a-zA-Z0-9-_]+/g, "_");
  const maxMonth = Math.max(1, ...r.months.map((m) => Math.max(m.revenue, m.expenses)));

  const doPdf = async () => {
    setBusy("pdf");
    try { await shareOrDownload(await buildYearReportPdf(r), `${safe}-${r.year}-report.pdf`, `${r.year} year-end report`); }
    catch (e) { console.warn("PDF failed", e); }
    setBusy("");
  };
  const doCsv = async () => {
    setBusy("csv");
    try { await shareOrDownload(new Blob([yearReportCsv(r)], { type: "text/csv" }), `${safe}-${r.year}-report.csv`, `${r.year} year-end report`); }
    catch (e) { console.warn("CSV failed", e); }
    setBusy("");
  };

  const stat = (label, v, color) => (
    <div style={{ flex: "1 1 30%", minWidth: 90, background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 10, padding: "10px 10px" }}>
      <div style={{ fontSize: 10, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: color || palette.ink, lineHeight: 1.1, marginTop: 4 }}>{money2(v)}</div>
    </div>
  );
  const groupList = (title, rows) => rows.length > 0 && (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{title}</div>
      {rows.slice(0, 8).map((g) => (
        <div key={g.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderBottom: `1px solid ${palette.line}` }}>
          <span style={{ color: palette.ink }}>{g.name}</span><span style={{ fontWeight: 600 }}>{money2(g.amount)}</span>
        </div>
      ))}
      {rows.length > 8 && <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4 }}>+{rows.length - 8} more in the PDF</div>}
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(44,24,16,0.55)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "max(16px, env(safe-area-inset-top)) 12px 24px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: palette.bg, borderRadius: 16, border: `2px solid ${palette.ink}`, width: "100%", maxWidth: 520, padding: 16, fontFamily: FONT_BODY, color: palette.ink }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, flex: 1 }}>{r.year} year-end report</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: palette.ink }}><X size={20} /></button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {years.map((y) => (
            <button key={y} type="button" onClick={() => setYear(y)} style={{
              padding: "6px 12px", borderRadius: 999, fontSize: 13, cursor: "pointer", fontFamily: FONT_BODY,
              border: `1.5px solid ${y === year ? palette.ink : palette.line}`,
              background: y === year ? palette.ink : "transparent", color: y === year ? palette.bg : palette.ink,
            }}>{y}</button>
          ))}
        </div>
        {r.partial && <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 10 }}>Year to date. Totals keep updating through December 31.</div>}
        <div role="note" style={{ fontSize: 12.5, lineHeight: 1.5, color: palette.ink, background: palette.warnBg, border: `1px solid ${palette.line}`, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
          {YEAR_REPORT_NOTE}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {stat("Sales", r.revenue, palette.leaf)}
          {stat("Expenses", r.expenses)}
          {stat("Net", r.net, r.net >= 0 ? palette.leaf : palette.accent)}
        </div>
        {r.tips > 0 && <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: -6, marginBottom: 12 }}>Plus {money2(r.tips)} in tips.</div>}

        {r.salesCount + r.expenseCount === 0 ? (
          <div style={{ fontSize: 13, color: palette.inkSoft, padding: 14, background: palette.bgAlt, borderRadius: 10, marginBottom: 14 }}>
            Nothing logged for {r.year} yet. Sales and expenses you log (including feed and supply costs on hobby pages) show up here.
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>By month</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 90, marginBottom: 4 }}>
              {r.months.map((m) => (
                <div key={m.month} title={`${m.month}: ${money2(m.revenue)} sales, ${money2(m.expenses)} expenses`} style={{ flex: 1, display: "flex", gap: 1, alignItems: "flex-end", height: "100%" }}>
                  <div style={{ flex: 1, height: `${(m.revenue / maxMonth) * 100}%`, minHeight: m.revenue ? 2 : 0, background: palette.leaf, borderRadius: "3px 3px 0 0" }} />
                  <div style={{ flex: 1, height: `${(m.expenses / maxMonth) * 100}%`, minHeight: m.expenses ? 2 : 0, background: palette.featherSoft, borderRadius: "3px 3px 0 0" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
              {r.months.map((m) => <div key={m.month} style={{ flex: 1, fontSize: 9, color: palette.inkSoft, textAlign: "center" }}>{m.month[0]}</div>)}
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 11, color: palette.inkSoft, marginBottom: 14 }}>
              <span><span style={{ display: "inline-block", width: 9, height: 9, background: palette.leaf, borderRadius: 2, marginRight: 4 }} />Sales</span>
              <span><span style={{ display: "inline-block", width: 9, height: 9, background: palette.featherSoft, borderRadius: 2, marginRight: 4 }} />Expenses</span>
            </div>
            {groupList("Sales by hobby", r.revenueByHobby)}
            {groupList("Expenses by category", r.expensesByCategory)}
          </>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button type="button" onClick={doPdf} disabled={!!busy} style={{ padding: 13, borderRadius: 10, border: `2px solid ${palette.ink}`, background: palette.ink, color: palette.bg, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 15, cursor: busy ? "wait" : "pointer", opacity: busy === "pdf" ? 0.7 : 1 }}>
            {busy === "pdf" ? "Making your PDF…" : "📄 Download PDF report"}
          </button>
          <button type="button" onClick={doCsv} disabled={!!busy} style={{ padding: 12, borderRadius: 10, border: `2px solid ${palette.ink}`, background: palette.yolk, color: palette.onYolk, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, cursor: busy ? "wait" : "pointer" }}>
            📊 Download spreadsheet (CSV)
          </button>
        </div>
        <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 10, lineHeight: 1.5 }}>
          Totals include every sale, every expense you added, and costs logged on hobby pages (feed, bedding, animals bought, building and equipment). It's a record of what you logged.
        </div>
      </div>
    </div>
  );
}

export function getSalesForHobby(data, hobbyType) {
  const sales = (data.sales || []).filter(s => s.hobbyType === hobbyType);
  if (hobbyType === "eggs") {
    const legacy = (data.entries?.["egg_layers"] || [])
      .filter(e => e.action === "sold_eggs")
      .map(e => {
        const { revenue, pricePerDozen, qty } = deriveSoldEggsRevenue(e);
        return {
          id: e.id, date: e.date, hobbyType: "eggs",
          eggType: "Chicken", eggPurpose: "Eating",
          qty, unit: "eggs",
          pricePerUnit: pricePerDozen,
          totalRevenue: revenue,
          note: e.note||"", isLegacy: true,
        };
      });
    const newIds = new Set(sales.map(s=>s.id));
    return [...sales, ...legacy.filter(s=>!newIds.has(s.id))];
  }
  return sales;
}

export function SalesStatsSection({ data, hobbyType }) {
  const sales = useMemo(() => getSalesForHobby(data, hobbyType), [data, hobbyType]);
  if (sales.length === 0) return null;

  const totalRevenue = sales.reduce((s,sale) => s+computeRevenue(sale), 0);
  const customers = data.customers || [];

  // Eggs-specific breakdown
  const eggBreakdown = hobbyType === "eggs" ? (() => {
    const byType = {};
    const byPurpose = {};
    sales.forEach(s => {
      const t = s.eggType || "Chicken";
      const p = s.eggPurpose || "Eating";
      byType[t] = (byType[t]||0) + computeRevenue(s);
      byPurpose[p] = (byPurpose[p]||0) + computeRevenue(s);
    });
    return { byType, byPurpose };
  })() : null;

  return (
    <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:12 }}>
      <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,marginBottom:10,color:palette.ink }}>💰 Sales</div>
      <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:eggBreakdown?12:0 }}>
        <div style={{ flex:"1 1 120px",background:palette.bgAlt,borderRadius:8,padding:"10px 12px" }}>
          <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Total revenue</div>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:22,color:palette.leaf }}>{fmtMoney(totalRevenue)}</div>
          <div style={{ fontSize:11,color:palette.inkSoft }}>{sales.length} sale{sales.length===1?"":"s"}</div>
        </div>
      </div>
      {eggBreakdown && Object.keys(eggBreakdown.byType).length > 1 && (
        <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
          {Object.entries(eggBreakdown.byType).sort((a,b)=>b[1]-a[1]).map(([type,rev]) => (
            <div key={type} style={{ display:"flex",justifyContent:"space-between",padding:"6px 8px",background:palette.bgAlt,borderRadius:6,fontSize:12 }}>
              <span>{type} eggs</span><strong>{fmtMoney(rev)}</strong>
            </div>
          ))}
        </div>
      )}
      {eggBreakdown && Object.keys(eggBreakdown.byPurpose).length > 1 && (
        <div style={{ display:"flex",flexDirection:"column",gap:4,marginTop:6 }}>
          {Object.entries(eggBreakdown.byPurpose).sort((a,b)=>b[1]-a[1]).map(([purpose,rev]) => (
            <div key={purpose} style={{ display:"flex",justifyContent:"space-between",padding:"6px 8px",background:palette.yolkSoft,borderRadius:6,fontSize:12 }}>
              <span>{purpose} eggs</span><strong>{fmtMoney(rev)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
