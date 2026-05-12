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

import React, { useState, useMemo } from "react";
import { X, Plus, Edit3, Trash2, ChevronDown, User } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fmtMoney } from "./units.js";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47", featherSoft: "#C9A77B",
  honey: "#E8961A", honeySoft: "#F5C96A",
  line: "#2C181030", card: "#FAF5EA",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
};

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
const HOBBY_META = {
  eggs:          { label: "Eggs",          emoji: "🥚", color: palette.yolk },
  honey:         { label: "Honey",         emoji: "🍯", color: palette.honey },
  meat_chickens: { label: "Meat Birds", emoji: "🍗", color: palette.feather },
  rabbits:       { label: "Rabbits",       emoji: "🐇", color: palette.leaf },
  garden:        { label: "Garden",        emoji: "🌱", color: palette.leaf },
  farmstand:     { label: "Farm Stand",    emoji: "🧾", color: palette.leaf },
  sourdough:     { label: "Sourdough",     emoji: "🍞", color: palette.yolk },
  baking:        { label: "Baking",        emoji: "🥧", color: palette.yolk },
  canning:       { label: "Canning",       emoji: "🫙", color: palette.leafSoft },
  horse:         { label: "Horses",        emoji: "🐴", color: palette.feather },
  other:         { label: "Other",         emoji: "💰", color: palette.inkSoft },
};

const EGG_TYPES = ["Chicken", "Duck", "Goose", "Turkey", "Quail", "Guinea", "Peafowl", "Other"];
const EGG_PURPOSES = ["Eating", "Hatching"];
const HONEY_FORMS = ["Raw comb", "Extracted", "Creamed", "Infused"];
const HONEY_CONTAINERS = ["Half-pint jar (1 cup)", "Pint jar (2 cups)", "Quart jar", "Half-gallon", "Gallon", "Bulk lb"];
const MEAT_FORMS = ["Whole bird", "Cuts / pieces", "Live bird"];
const RABBIT_FORMS = ["Whole rabbit", "Cuts / pieces", "Live rabbit"];

// ============================================================================
// COMPUTE REVENUE from a sale entry
// ============================================================================
function computeRevenue(sale) {
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
// FUNCTION
// ============================================================================
function Btn({ children, onClick, variant="primary", small=false, style={}, type="button", disabled=false }) {
  const styles = {
    primary: { background: palette.ink, color: palette.bg, border: `1.5px solid ${palette.ink}` },
    danger:  { background: palette.accent, color: palette.bg, border: `1.5px solid ${palette.accent}` },
    ghost:   { background: "transparent", color: palette.ink, border: `1.5px solid ${palette.line}` },
    accent:  { background: palette.yolk, color: palette.ink, border: `1.5px solid ${palette.ink}` },
  };
  return (
    <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      padding: small ? "6px 12px" : "10px 18px", borderRadius: 8,
      cursor: disabled ? "not-allowed" : "pointer", fontFamily: FONT_BODY,
      fontWeight: 600, fontSize: small ? 13 : 14, opacity: disabled ? 0.6 : 1,
      boxShadow: "2px 2px 0 " + palette.line, ...styles[variant], ...style,
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
function AddSaleModal({ data, update, onClose, existingSale }) {
  const isEdit = !!existingSale;
  const customers = data.customers || [];
  const visibleHobbies = (data.hobbies || []).filter(h => !h.hidden);

  const [step, setStep] = useState(isEdit ? 2 : 1);
  const [hobbyType, setHobbyType] = useState(existingSale?.hobbyType || "eggs");

  // Shared fields
  const [date, setDate] = useState(existingSale?.date || todayStr());
  const [qty, setQty] = useState(existingSale?.qty != null ? String(existingSale.qty) : "");
  const [note, setNote] = useState(existingSale?.note || "");
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
  const [pricePerUnit, setPricePerUnit] = useState(existingSale?.pricePerUnit != null ? String(existingSale.pricePerUnit) : "");

  // Honey
  const [honeyForm, setHoneyForm] = useState(existingSale?.honeyForm || "Extracted");
  const [honeyContainer, setHoneyContainer] = useState(existingSale?.honeyContainer || "Pint jar (2 cups)");

  // Meat / rabbits
  const [saleForm, setSaleForm] = useState(existingSale?.saleForm || "Whole bird");
  const [pricingMethod, setPricingMethod] = useState(existingSale?.pricingMethod || "per_bird");
  const [pricePerLb, setPricePerLb] = useState(existingSale?.pricePerLb != null ? String(existingSale.pricePerLb) : "");
  const [avgWeightLbs, setAvgWeightLbs] = useState(existingSale?.avgWeightLbs != null ? String(existingSale.avgWeightLbs) : "");

  // Garden
  const [crop, setCrop] = useState(existingSale?.crop || "");
  const [gardenUnit, setGardenUnit] = useState(existingSale?.gardenUnit || "lbs");

  // Other
  const [otherItem, setOtherItem] = useState(existingSale?.otherItem || "");
  const [flatPrice, setFlatPrice] = useState(existingSale?.flatPrice != null ? String(existingSale.flatPrice) : "");

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
    if (hobbyType === "horse") return Number(pricePerUnit) || 0;
    if (hobbyType === "garden") return q * (Number(pricePerUnit) || 0);
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
      else if (h.type === "horses") types.add("horse");
    });
    // Always include eggs and farmstand
    types.add("eggs");
    types.add("farmstand");
    return Array.from(types);
  }, [visibleHobbies]);

  const save = () => {
    let sale = {
      id: existingSale?.id || newId(),
      date, hobbyType, qty: Number(qty) || 0,
      note, buyerId: buyerId || null,
      created: existingSale?.created || Date.now(),
    };

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
        pricePerLb: Number(pricePerLb) || 0,
        avgWeightLbs: Number(avgWeightLbs) || 0,
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
    } else if (hobbyType === "horse") {
      // Horse sales: one transaction = one horse (or a lease). pricePerUnit is
      // the sale/lease price, qty is always 1, crop holds the horse's name.
      const saleRev = Number(pricePerUnit) || 0;
      // saleType (sold vs leased) goes in the otherItem field for now
      sale = { ...sale, crop, saleType: otherItem || "sold", pricePerUnit: saleRev, totalRevenue: saleRev };
    } else if (hobbyType === "garden") {
      sale = { ...sale, crop, gardenUnit, pricePerUnit: Number(pricePerUnit) || 0 };
    } else {
      sale = { ...sale, otherItem, flatPrice: Number(flatPrice) || 0 };
    }

    sale.totalRevenue = previewRevenue;

    // If new buyer name entered, create customer first
    let finalBuyerId = buyerId;
    if (showNewBuyer && newBuyerName.trim()) {
      finalBuyerId = newId();
      sale.buyerId = finalBuyerId;
      update(d => {
        d.customers = d.customers || [];
        d.customers.push({ id: finalBuyerId, name: newBuyerName.trim(), note: "" });
        return d;
      });
    }

    update(d => {
      d.sales = d.sales || [];
      if (isEdit) {
        const idx = d.sales.findIndex(s => s.id === sale.id);
        if (idx !== -1) d.sales[idx] = sale;
        else d.sales.push(sale);
      } else {
        d.sales.push(sale);
      }
      // If we just edited a legacy `sold_eggs` entry, remove the underlying
      // source so the editable copy in `d.sales` is the only version visible.
      // Without this, the entry would keep appearing alongside the edited copy
      // every time the user reopens the Sales tab.
      if (isEdit && existingSale?.isLegacy && d.entries?.["egg_layers"]) {
        d.entries["egg_layers"] = d.entries["egg_layers"].filter(
          e => !(e.action === "sold_eggs" && e.id === sale.id)
        );
      }
      return d;
    });
    onClose();
  };

  const buyer = customers.find(c => c.id === buyerId);

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(44,24,16,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:palette.bg,borderRadius:16,maxWidth:480,width:"100%",maxHeight:"92vh",overflow:"auto",border:`2px solid ${palette.ink}`,boxShadow:`6px 8px 0 ${palette.line}`,fontFamily:FONT_BODY }}>
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
                {Object.entries(HOBBY_META).filter(([k]) => availableHobbyTypes.includes(k)).map(([key, meta]) => (
                  <button key={key} onClick={() => { setHobbyType(key); setStep(2); }} style={{
                    padding:"14px 10px",background:palette.card,border:`1.5px solid ${palette.line}`,
                    borderRadius:10,cursor:"pointer",fontFamily:FONT_BODY,color:palette.ink,
                    display:"flex",flexDirection:"column",alignItems:"center",gap:6,
                    boxShadow:`2px 2px 0 ${palette.line}`,
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
                  ← {HOBBY_META[hobbyType]?.emoji} {HOBBY_META[hobbyType]?.label}
                </button>
              )}

              <Field label="Date">
                <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} />
              </Field>

              {/* Eggs */}
              {hobbyType === "eggs" && <>
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1,minWidth:130 }}>
                    <Field label="Bird type">
                      <select style={inputStyle} value={eggType} onChange={e=>setEggType(e.target.value)}>
                        {EGG_TYPES.map(t=><option key={t}>{t}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div style={{ flex:1,minWidth:130 }}>
                    <Field label="Purpose">
                      <select style={inputStyle} value={eggPurpose} onChange={e=>setEggPurpose(e.target.value)}>
                        {EGG_PURPOSES.map(p=><option key={p}>{p}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
                {eggType === "Other" && (
                  <Field label="What kind?">
                    <input style={inputStyle} value={eggTypeCustom} onChange={e=>setEggTypeCustom(e.target.value)} placeholder="e.g. emu, ostrich, partridge" />
                  </Field>
                )}
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1,minWidth:100 }}>
                    <Field label="Qty">
                      <input type="number" min={0} style={inputStyle} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                  <div style={{ flex:1,minWidth:100 }}>
                    <Field label="Unit">
                      <select style={inputStyle} value={unit} onChange={e=>setUnit(e.target.value)}>
                        <option value="dozen">Dozen</option>
                        <option value="eggs">Individual eggs</option>
                      </select>
                    </Field>
                  </div>
                  <div style={{ flex:1,minWidth:120 }}>
                    <Field label={unit === "dozen" ? "Price / dozen" : "Price / dozen (equiv)"}>
                      <input type="number" min={0} step="0.01" style={inputStyle} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder="$0.00" />
                    </Field>
                  </div>
                </div>
              </>}

              {/* Honey */}
              {hobbyType === "honey" && <>
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1,minWidth:130 }}>
                    <Field label="Form">
                      <select style={inputStyle} value={honeyForm} onChange={e=>setHoneyForm(e.target.value)}>
                        {HONEY_FORMS.map(f=><option key={f}>{f}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div style={{ flex:1,minWidth:130 }}>
                    <Field label="Container / unit">
                      <select style={inputStyle} value={honeyContainer} onChange={e=>setHoneyContainer(e.target.value)}>
                        {HONEY_CONTAINERS.map(c=><option key={c}>{c}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
                <div style={{ display:"flex",gap:12 }}>
                  <div style={{ flex:1 }}>
                    <Field label="Qty (units sold)">
                      <input type="number" min={0} style={inputStyle} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label="Price per unit">
                      <input type="number" min={0} step="0.01" style={inputStyle} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder="$0.00" />
                    </Field>
                  </div>
                </div>
              </>}

              {/* Meat chickens */}
              {hobbyType === "meat_chickens" && <>
                <Field label="Form">
                  <select style={inputStyle} value={saleForm} onChange={e=>setSaleForm(e.target.value)}>
                    {MEAT_FORMS.map(f=><option key={f}>{f}</option>)}
                  </select>
                </Field>
                <Field label="Number of birds / units">
                  <input type="number" min={0} style={inputStyle} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                </Field>
                <Field label="Pricing method">
                  <select style={inputStyle} value={pricingMethod} onChange={e=>setPricingMethod(e.target.value)}>
                    <option value="per_bird">Per bird / unit</option>
                    <option value="per_lb">Per lb</option>
                    <option value="flat">Flat price (total)</option>
                  </select>
                </Field>
                {pricingMethod === "per_lb" && <>
                  <div style={{ display:"flex",gap:12 }}>
                    <div style={{ flex:1 }}>
                      <Field label="Avg weight (lbs)">
                        <input type="number" min={0} step="0.1" style={inputStyle} value={avgWeightLbs} onChange={e=>setAvgWeightLbs(e.target.value)} placeholder="0.0" />
                      </Field>
                    </div>
                    <div style={{ flex:1 }}>
                      <Field label="Price / lb">
                        <input type="number" min={0} step="0.01" style={inputStyle} value={pricePerLb} onChange={e=>setPricePerLb(e.target.value)} placeholder="$0.00" />
                      </Field>
                    </div>
                  </div>
                </>}
                {pricingMethod === "per_bird" && (
                  <Field label="Price / bird">
                    <input type="number" min={0} step="0.01" style={inputStyle} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder="$0.00" />
                  </Field>
                )}
                {pricingMethod === "flat" && (
                  <Field label="Total price ($)">
                    <input type="number" min={0} step="0.01" style={inputStyle} value={flatPrice} onChange={e=>setFlatPrice(e.target.value)} placeholder="$0.00" />
                  </Field>
                )}
              </>}

              {/* Rabbits */}
              {hobbyType === "rabbits" && <>
                <Field label="Form">
                  <select style={inputStyle} value={saleForm} onChange={e=>setSaleForm(e.target.value)}>
                    {RABBIT_FORMS.map(f=><option key={f}>{f}</option>)}
                  </select>
                </Field>
                <Field label="Quantity">
                  <input type="number" min={0} style={inputStyle} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                </Field>
                <Field label="Pricing method">
                  <select style={inputStyle} value={pricingMethod} onChange={e=>setPricingMethod(e.target.value)}>
                    <option value="per_bird">Per rabbit</option>
                    <option value="per_lb">Per lb</option>
                    <option value="flat">Flat price (total)</option>
                  </select>
                </Field>
                {pricingMethod === "per_lb" && (
                  <div style={{ display:"flex",gap:12 }}>
                    <div style={{ flex:1 }}>
                      <Field label="Avg weight (lbs)">
                        <input type="number" min={0} step="0.1" style={inputStyle} value={avgWeightLbs} onChange={e=>setAvgWeightLbs(e.target.value)} placeholder="0.0" />
                      </Field>
                    </div>
                    <div style={{ flex:1 }}>
                      <Field label="Price / lb">
                        <input type="number" min={0} step="0.01" style={inputStyle} value={pricePerLb} onChange={e=>setPricePerLb(e.target.value)} placeholder="$0.00" />
                      </Field>
                    </div>
                  </div>
                )}
                {pricingMethod === "per_bird" && (
                  <Field label="Price / rabbit">
                    <input type="number" min={0} step="0.01" style={inputStyle} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder="$0.00" />
                  </Field>
                )}
                {pricingMethod === "flat" && (
                  <Field label="Total price ($)">
                    <input type="number" min={0} step="0.01" style={inputStyle} value={flatPrice} onChange={e=>setFlatPrice(e.target.value)} placeholder="$0.00" />
                  </Field>
                )}
              </>}

              {/* Garden */}
              {hobbyType === "garden" && <>
                <Field label="Crop / product">
                  <input style={inputStyle} value={crop} onChange={e=>setCrop(e.target.value)} placeholder="Tomatoes, corn, cut flowers..." />
                </Field>
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1,minWidth:80 }}>
                    <Field label="Qty">
                      <input type="number" min={0} step="0.1" style={inputStyle} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                  <div style={{ flex:1,minWidth:100 }}>
                    <Field label="Unit">
                      <select style={inputStyle} value={gardenUnit} onChange={e=>setGardenUnit(e.target.value)}>
                        {["lbs","oz","count","bunch","quart","pint","bag","basket"].map(u=><option key={u}>{u}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div style={{ flex:1,minWidth:110 }}>
                    <Field label={`Price / ${gardenUnit}`}>
                      <input type="number" min={0} step="0.01" style={inputStyle} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder="$0.00" />
                    </Field>
                  </div>
                </div>
              </>}

              {/* Farm Stand */}
              {hobbyType === "farmstand" && <>
                <Field label="Item name">
                  <input style={inputStyle} value={crop} onChange={e=>setCrop(e.target.value)} placeholder="Tomatoes, eggs, honey, baked goods..." />
                </Field>
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1,minWidth:80 }}>
                    <Field label="Qty sold">
                      <input type="number" min={0} step="0.1" style={inputStyle} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                  <div style={{ flex:1,minWidth:100 }}>
                    <Field label="Unit">
                      <select style={inputStyle} value={gardenUnit} onChange={e=>setGardenUnit(e.target.value)}>
                        {["each","lbs","dozen","quart","pint","bunch","bag","jar","loaf"].map(u=><option key={u}>{u}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1 }}>
                    <Field label="Your cost per unit">
                      <input type="number" min={0} step="0.01" style={inputStyle} value={pricePerLb} onChange={e=>setPricePerLb(e.target.value)} placeholder="$0.00" />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label="Sale price per unit">
                      <input type="number" min={0} step="0.01" style={inputStyle} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder="$0.00" />
                    </Field>
                  </div>
                </div>
              </>}

              {/* Sourdough */}
              {hobbyType === "sourdough" && <>
                <Field label="Recipe / loaf type">
                  <input style={inputStyle} list="sourdough-recipes" value={crop} onChange={e=>setCrop(e.target.value)} placeholder="Country Loaf, Boule, Cinnamon Raisin..." />
                  <datalist id="sourdough-recipes">
                    {["Country Loaf","Boule","Batard","Whole Wheat","Rye","Multigrain","Sandwich Loaf","Focaccia","Baguette","Cinnamon Raisin","Jalapeño Cheddar","Pizza Dough","Discard Crackers"].map(r => <option key={r} value={r} />)}
                  </datalist>
                </Field>
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1,minWidth:80 }}>
                    <Field label="Loaves sold">
                      <input type="number" min={0} step="1" style={inputStyle} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label="Cost per loaf (optional)">
                      <input type="number" min={0} step="0.01" style={inputStyle} value={pricePerLb} onChange={e=>setPricePerLb(e.target.value)} placeholder="$0.00" />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label="Sale price per loaf">
                      <input type="number" min={0} step="0.01" style={inputStyle} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder="$0.00" />
                    </Field>
                  </div>
                </div>
              </>}

              {/* Baking */}
              {hobbyType === "baking" && <>
                <Field label="Recipe / item">
                  <input style={inputStyle} value={crop} onChange={e=>setCrop(e.target.value)} placeholder="Apple Pie, Banana Bread, Croissants..." />
                </Field>
                <Field label="Unit (optional)">
                  <input style={inputStyle} value={gardenUnit} onChange={e=>setGardenUnit(e.target.value)} placeholder="loaves, pies, dozen cookies..." />
                </Field>
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1,minWidth:80 }}>
                    <Field label="Quantity sold">
                      <input type="number" min={0} step="1" style={inputStyle} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label="Cost per item (optional)">
                      <input type="number" min={0} step="0.01" style={inputStyle} value={pricePerLb} onChange={e=>setPricePerLb(e.target.value)} placeholder="$0.00" />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label="Sale price per item">
                      <input type="number" min={0} step="0.01" style={inputStyle} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder="$0.00" />
                    </Field>
                  </div>
                </div>
              </>}

              {/* Canning */}
              {hobbyType === "canning" && <>
                <Field label="Item">
                  <input style={inputStyle} value={crop} onChange={e=>setCrop(e.target.value)} placeholder="Strawberry Jam, Dill Pickles, Tomato Sauce..." />
                </Field>
                <Field label="Jar type">
                  <input style={inputStyle} value={gardenUnit} onChange={e=>setGardenUnit(e.target.value)} placeholder="pint jars, quart jars, half-pints..." />
                </Field>
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1,minWidth:80 }}>
                    <Field label="Jars sold">
                      <input type="number" min={0} step="1" style={inputStyle} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label="Cost per jar (optional)">
                      <input type="number" min={0} step="0.01" style={inputStyle} value={pricePerLb} onChange={e=>setPricePerLb(e.target.value)} placeholder="$0.00" />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label="Sale price per jar">
                      <input type="number" min={0} step="0.01" style={inputStyle} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder="$0.00" />
                    </Field>
                  </div>
                </div>
              </>}

              {/* Horse */}
              {hobbyType === "horse" && <>
                <Field label="Horse name">
                  <input style={inputStyle} value={crop} onChange={e=>setCrop(e.target.value)} placeholder="e.g. Thunder, Buttercup" />
                </Field>
                <Field label="Type of transaction">
                  <select style={inputStyle} value={otherItem || "sold"} onChange={e=>setOtherItem(e.target.value)}>
                    <option value="sold">Sold</option>
                    <option value="leased">Leased</option>
                  </select>
                </Field>
                <Field label="Sale / lease price">
                  <input type="number" min={0} step="0.01" style={inputStyle} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder="$0.00" />
                </Field>
              </>}

              {/* Other */}
              {hobbyType === "other" && <>
                <Field label="What was sold?">
                  <input style={inputStyle} value={otherItem} onChange={e=>setOtherItem(e.target.value)} placeholder="e.g. Quail eggs, seedlings, crafts..." />
                </Field>
                <div style={{ display:"flex",gap:12 }}>
                  <div style={{ flex:1 }}>
                    <Field label="Qty">
                      <input type="number" min={0} style={inputStyle} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" />
                    </Field>
                  </div>
                  <div style={{ flex:1 }}>
                    <Field label="Total price ($)">
                      <input type="number" min={0} step="0.01" style={inputStyle} value={flatPrice} onChange={e=>setFlatPrice(e.target.value)} placeholder="$0.00" />
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
                    <select style={{ ...inputStyle,flex:1 }} value={buyerId} onChange={e=>setBuyerId(e.target.value)}>
                      <option value="">— No customer —</option>
                      {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button onClick={()=>setShowNewBuyer(true)} style={{ padding:"10px 12px",borderRadius:8,border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",fontFamily:FONT_BODY,fontSize:13,fontWeight:600,color:palette.ink,whiteSpace:"nowrap" }}>
                      + New
                    </button>
                  </div>
                ) : (
                  <div style={{ display:"flex",gap:8 }}>
                    <input style={{ ...inputStyle,flex:1 }} value={newBuyerName} onChange={e=>setNewBuyerName(e.target.value)} placeholder="Customer name" autoFocus />
                    <button onClick={()=>setShowNewBuyer(false)} style={{ padding:"10px 12px",borderRadius:8,border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",fontFamily:FONT_BODY,fontSize:13,color:palette.inkSoft }}>Cancel</button>
                  </div>
                )}
              </Field>

              <Field label="Notes (optional)">
                <input style={inputStyle} value={note} onChange={e=>setNote(e.target.value)} placeholder="Farmers market, neighbor, online..." />
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
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(44,24,16,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:palette.bg,borderRadius:16,maxWidth:400,width:"100%",border:`2px solid ${palette.ink}`,boxShadow:`6px 8px 0 ${palette.line}`,fontFamily:FONT_BODY }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1.5px solid ${palette.line}` }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink }}>{customer ? "Edit customer" : "Add customer"}</div>
          <button onClick={onClose} aria-label="Close" style={{ background:"none",border:"none",cursor:"pointer",color:palette.ink }}><X size={20}/></button>
        </div>
        <div style={{ padding:20 }}>
          <Field label="Name">
            <input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} placeholder="Jane Smith" autoFocus />
          </Field>
          <Field label="Notes (optional)">
            <input style={inputStyle} value={note} onChange={e=>setNote(e.target.value)} placeholder="Neighbor, prefers hatching eggs..." />
          </Field>
          <Btn onClick={() => { if (!name.trim()) return; onSave({ id: customer?.id || newId(), name: name.trim(), note }); onClose(); }} style={{ width:"100%" }}>Save</Btn>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SALE ROW
// ============================================================================
function SaleRow({ sale, customers, onEdit, onDelete }) {
  const meta = HOBBY_META[sale.hobbyType] || HOBBY_META.other;
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
    if (sale.pricingMethod === "per_lb" && sale.avgWeightLbs) detail += ` · ${sale.avgWeightLbs} lbs avg`;
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
  } else if (sale.hobbyType === "horse") {
    detail = `${sale.crop || "Horse"} · ${sale.saleType || "sold"}`;
  } else if (sale.hobbyType === "garden") {
    detail = `${sale.crop} · ${sale.qty} ${sale.gardenUnit || ""}`;
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
export default function SalesPage({ data, update }) {
  const [showAddSale, setShowAddSale] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [showCustomers, setShowCustomers] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const sales = data.sales || [];
  const customers = data.customers || [];

  // Also pull legacy sold_eggs from entries
  const legacyEggSales = useMemo(() => {
    const eggEntries = (data.entries?.["egg_layers"] || []).filter(e => e.action === "sold_eggs");
    return eggEntries.map(e => ({
      id: e.id,
      date: e.date,
      hobbyType: "eggs",
      eggType: "Chicken",
      eggPurpose: "Eating",
      qty: Number(e.count) || 0,
      unit: "eggs",
      pricePerUnit: Number(e.pricePerDozen) || 0,
      totalRevenue: ((Number(e.count)||0) / 12) * (Number(e.pricePerDozen)||0),
      note: e.note || "",
      buyerId: null,
      isLegacy: true,
    }));
  }, [data.entries]);

  const allSales = useMemo(() => {
    // Merge `data.sales` (modern, editable) with legacy `sold_eggs` entries
    // (from old per-flock egg-sale logger). When IDs collide, `data.sales`
    // WINS — the migration in HomesteadApp.jsx copies legacy entries into
    // `data.sales`, and the editable version should always take precedence.
    // Previously the priority was reversed, which silently locked users out
    // of editing/deleting sales that had already been migrated.
    const saleIds = new Set(sales.map(s => s.id));
    const legacyOnly = legacyEggSales.filter(s => !saleIds.has(s.id));
    return [...sales, ...legacyOnly].sort((a,b) => (b.date||"").localeCompare(a.date||""));
  }, [sales, legacyEggSales]);

  const filtered = filterType === "all" ? allSales : allSales.filter(s => s.hobbyType === filterType);

  // Revenue stats
  const totalRevenue = allSales.reduce((s,sale) => s + computeRevenue(sale), 0);
  const thisMonth = thisMonthStr();
  const thisMonthRevenue = allSales.filter(s => s.date?.startsWith(thisMonth)).reduce((s,sale) => s + computeRevenue(sale), 0);

  // Revenue by hobby type (for bar chart)
  const byType = useMemo(() => {
    const acc = {};
    allSales.forEach(sale => {
      const t = sale.hobbyType;
      acc[t] = (acc[t] || 0) + computeRevenue(sale);
    });
    return Object.entries(acc).map(([type, revenue]) => ({
      name: HOBBY_META[type]?.label || type,
      revenue: parseFloat(revenue.toFixed(2)),
      emoji: HOBBY_META[type]?.emoji || "💰",
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

  const deleteSale = (id) => {
    update(d => {
      d.sales = (d.sales||[]).filter(s => s.id !== id);
      // Also remove any legacy `sold_eggs` entry with the same id. Otherwise
      // a sale that was migrated from the old per-flock egg-sale logger would
      // "resurrect" itself after deletion — the user would delete from data.sales,
      // but the entry in data.entries["egg_layers"] would re-appear on next render.
      if (d.entries?.["egg_layers"]) {
        d.entries["egg_layers"] = d.entries["egg_layers"].filter(
          e => !(e.action === "sold_eggs" && e.id === id)
        );
      }
      return d;
    });
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
      {showAddCustomer && <CustomerModal onSave={saveCustomer} onClose={() => setShowAddCustomer(false)} />}
      {editingCustomer && <CustomerModal customer={editingCustomer} onSave={saveCustomer} onClose={() => setEditingCustomer(null)} />}

      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10 }}>
        <h2 style={{ fontFamily:FONT_DISPLAY,fontSize:26,margin:0,color:palette.ink }}>sales</h2>
        <Btn onClick={() => setShowAddSale(true)}>+ Log sale</Btn>
      </div>

      {/* Revenue summary cards */}
      <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:16 }}>
        <div style={{ flex:"1 1 140px",background:palette.ink,color:palette.bg,borderRadius:12,padding:14 }}>
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
      </div>

      {/* Revenue by month chart */}
      {/* Revenue by month chart — only when at least one month has revenue */}
      {byMonth.some(m => m.revenue > 0) && (
        <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:14 }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,marginBottom:10,color:palette.ink }}>Revenue over time</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byMonth}>
              <XAxis dataKey="month" stroke={palette.inkSoft} fontSize={11} />
              <YAxis stroke={palette.inkSoft} fontSize={11} tickFormatter={v=>`$${v}`} />
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
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8 }}>
        <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink }}>Sales log</div>
        <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
          {availableTypes.map(t => (
            <button key={t} onClick={() => setFilterType(t)} style={{
              padding:"5px 10px",borderRadius:6,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,
              background: filterType===t ? palette.ink : palette.card,
              color: filterType===t ? palette.bg : palette.ink,
              border:`1.5px solid ${palette.line}`,cursor:"pointer",
            }}>
              {t === "all" ? "All" : (HOBBY_META[t]?.emoji + " " + HOBBY_META[t]?.label)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding:32,background:palette.card,border:`1.5px dashed ${palette.line}`,borderRadius:12,textAlign:"center",color:palette.inkSoft }}>
          {allSales.length === 0 ? (
            <>
              <div style={{ fontSize:32,marginBottom:10 }}>💰</div>
              <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink,marginBottom:6 }}>No sales logged yet</div>
              <div style={{ fontSize:13,marginBottom:14 }}>Tap "Log sale" to record your first sale.</div>
              <Btn onClick={() => setShowAddSale(true)}>+ Log your first sale</Btn>
            </>
          ) : "No sales for this category."}
        </div>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:20 }}>
          {filtered.map(sale => (
            <SaleRow
              key={sale.id}
              sale={sale}
              customers={customers}
              onEdit={() => setEditingSale(sale)}
              onDelete={() => deleteSale(sale.id)}
            />
          ))}
        </div>
      )}

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
      <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,overflow:"hidden",marginBottom:14 }}>
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
export function getSalesForHobby(data, hobbyType) {
  const sales = (data.sales || []).filter(s => s.hobbyType === hobbyType);
  if (hobbyType === "eggs") {
    const legacy = (data.entries?.["egg_layers"] || [])
      .filter(e => e.action === "sold_eggs")
      .map(e => ({
        id: e.id, date: e.date, hobbyType: "eggs",
        eggType: "Chicken", eggPurpose: "Eating",
        qty: Number(e.count)||0, unit: "eggs",
        pricePerUnit: Number(e.pricePerDozen)||0,
        totalRevenue: ((Number(e.count)||0)/12)*(Number(e.pricePerDozen)||0),
        note: e.note||"", isLegacy: true,
      }));
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
