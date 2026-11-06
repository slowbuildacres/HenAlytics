// ============================================================================
// HUNTING PAGE
// ----------------------------------------------------------------------------
// Tracks what a hunting season actually costs and what it puts in the freezer.
//
// Data shape on the hobby:
//   hobby.harvests[] = [{ id, date, species, sex, tagId, weapon, location,
//                         fieldDressedLbs, meatLbs, processingCost, processedBy,
//                         notes, created }]
//   hobby.tags[]     = [{ id, name, species, state, seasonYear, cost,
//                         purchaseDate, expires, filledHarvestId, notes }]
//   hobby.gear[]     = [{ id, date, item, category, cost, notes }]
//   hobby.meatValuePerLb = number   // what comparable meat costs at the store
//
// "Meat/price" = meat lbs packaged, total spent (tags + gear + processing),
// cost per lb, and what that meat would have cost at the store.
// ============================================================================

import { legacyPalette, legacyStyle } from "./newlook/legacyTheme.js";
import React, { useState } from "react";
// NEW_LOOK (3.0): shared kitchen & craft screens.
import { PantryView } from "./newlook/pantry/PantryScreens.jsx";
import { Hammer as NlHammer, Receipt as NlReceipt, NotebookPen as NlNote, Plus as NlPlus, Tag as NlTag, DollarSign as NlDollar } from "lucide-react";
import { X } from "lucide-react";
import { fmtMoney, fmtWeight } from "./units.js";

const palette = legacyPalette({
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47",
  line: "#2C181030", card: "#FAF5EA",
});
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;
const inputStyle = legacyStyle(() => ({
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
}));

const newId = () => Math.random().toString(36).slice(2, 10);
const localDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const todayStr = () => localDateStr(new Date());
const parseLocalDate = (s) => { if (!s) return new Date(); const [y,m,d] = s.split("-").map(Number); return new Date(y,(m||1)-1,d||1); };
const fmtDate = (s) => s ? parseLocalDate(s).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "";

export const HUNT_SPECIES = ["Deer", "Elk", "Moose", "Antelope", "Turkey", "Duck", "Goose", "Pheasant", "Grouse", "Dove", "Rabbit", "Squirrel", "Wild hog", "Bear", "Other"];
const WEAPONS = ["Rifle", "Bow", "Crossbow", "Shotgun", "Muzzleloader", "Handgun", "Other"];
const GEAR_CATEGORIES = ["Equipment", "Ammo / arrows", "Clothing", "Blind / stand", "Scent / calls", "Optics", "Processing supplies", "Fuel / travel", "Other"];
const DEFAULT_MEAT_VALUE = 8; // $/lb — roughly grass-fed ground beef / venison retail

// Shared math — used by the page, analytics, Year in Review, and share card.
export function huntingTotals(hobby, inRange = () => true) {
  const harvests = (hobby?.harvests || []).filter(h => inRange(h.date));
  const tags = (hobby?.tags || []).filter(t => inRange(t.purchaseDate || t.expires));
  const gear = (hobby?.gear || []).filter(g => inRange(g.date));
  const meatLbs = harvests.reduce((s, h) => s + (Number(h.meatLbs) || 0), 0);
  const processingCost = harvests.reduce((s, h) => s + (Number(h.processingCost) || 0), 0);
  const tagCost = tags.reduce((s, t) => s + (Number(t.cost) || 0), 0);
  const gearCost = gear.reduce((s, g) => s + (Number(g.cost) || 0), 0);
  const totalCost = processingCost + tagCost + gearCost;
  const valuePerLb = Number(hobby?.meatValuePerLb) > 0 ? Number(hobby.meatValuePerLb) : DEFAULT_MEAT_VALUE;
  return {
    harvests, tags, gear, meatLbs, processingCost, tagCost, gearCost, totalCost,
    costPerLb: meatLbs > 0 ? totalCost / meatLbs : 0,
    storeValue: meatLbs * valuePerLb,
    valuePerLb,
  };
}

function Btn({ children, onClick, variant = "primary", small = false, style = {}, disabled = false }) {
  const v = {
    primary: { background: palette.ink, color: palette.bg, border: `1.5px solid ${palette.ink}` },
    danger: { background: palette.accent, color: palette.onColor, border: `1.5px solid ${palette.accent}` },
    ghost: { background: "transparent", color: palette.ink, border: `1.5px solid ${palette.line}` },
    accent: { background: palette.yolk, color: palette.onYolk, border: `1.5px solid ${palette.ink}` },
  };
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      padding: small ? "6px 12px" : "10px 18px", borderRadius: small ? 999 : 14, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: FONT_BODY, fontWeight: 600, fontSize: small ? 13 : 14, opacity: disabled ? 0.6 : 1,
      boxShadow: "none", ...v[variant], ...style,
    }}>{children}</button>
  );
}
function StatCard({ label, value, sub, accent = palette.accent }) {
  return (
    <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 16, padding: 14, flex: "1 1 140px", minWidth: 140, boxSizing: "border-box" }}>
      <div style={{ fontSize: 10, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontFamily: FONT_BODY }}>{label}</div>
      <div style={{ fontSize: 22, fontFamily: FONT_DISPLAY, color: palette.ink, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4, fontFamily: FONT_BODY }}>{sub}</div>}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>{label}</div>
      {children}
    </label>
  );
}
function ModalShell({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(44,24,16,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: palette.bg, borderRadius: 16, maxWidth: 460, width: "100%", maxHeight: "90vh", overflow: "auto", border: `2px solid ${palette.ink}`, boxShadow: `6px 8px 0 ${palette.line}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1.5px solid ${palette.line}`, position: "sticky", top: 0, background: palette.bg, zIndex: 1 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.ink }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: palette.ink, padding: 4 }}><X size={22} /></button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}
function DeleteRow({ onDelete, onCancel, onSave, saveDisabled, canDelete }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 8 }}>
      {canDelete && (!confirm
        ? <Btn variant="ghost" onClick={() => setConfirm(true)}>Delete</Btn>
        : <Btn variant="danger" onClick={onDelete}>Confirm delete</Btn>)}
      <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
      <Btn onClick={onSave} disabled={saveDisabled}>Save</Btn>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Harvest modal — picking an open tag marks it filled.
// ---------------------------------------------------------------------------
function HarvestModal({ harvest, tags, onSave, onDelete, onClose }) {
  const openTags = tags.filter(t => !t.filledHarvestId || t.filledHarvestId === harvest?.id);
  const [date, setDate] = useState(harvest?.date || todayStr());
  const [species, setSpecies] = useState(harvest?.species || "Deer");
  const [sex, setSex] = useState(harvest?.sex || "");
  const [tagId, setTagId] = useState(harvest?.tagId || "");
  const [weapon, setWeapon] = useState(harvest?.weapon || "Rifle");
  const [location, setLocation] = useState(harvest?.location || "");
  const [fieldDressedLbs, setFieldDressedLbs] = useState(harvest?.fieldDressedLbs ? String(harvest.fieldDressedLbs) : "");
  const [meatLbs, setMeatLbs] = useState(harvest?.meatLbs ? String(harvest.meatLbs) : "");
  const [processingCost, setProcessingCost] = useState(harvest?.processingCost ? String(harvest.processingCost) : "");
  const [processedBy, setProcessedBy] = useState(harvest?.processedBy || "self");
  const [notes, setNotes] = useState(harvest?.notes || "");

  const save = () => {
    onSave({
      id: harvest?.id || newId(), date, species, sex, tagId: tagId || null, weapon,
      location: location.trim(),
      fieldDressedLbs: parseFloat(fieldDressedLbs) || 0,
      meatLbs: parseFloat(meatLbs) || 0,
      processingCost: parseFloat(processingCost) || 0,
      processedBy, notes: notes.trim(),
      created: harvest?.created || Date.now(),
    });
    onClose();
  };

  return (
    <ModalShell title={harvest ? "Edit harvest" : "🦌 Log a harvest"} onClose={onClose}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><Field label="Date"><input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Species">
          <select style={inputStyle} value={species} onChange={e => setSpecies(e.target.value)}>
            {HUNT_SPECIES.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field></div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><Field label="Sex (optional)">
          <select style={inputStyle} value={sex} onChange={e => setSex(e.target.value)}>
            <option value="">—</option><option value="male">Male / buck / tom</option><option value="female">Female / doe / hen</option>
          </select>
        </Field></div>
        <div style={{ flex: 1 }}><Field label="Weapon">
          <select style={inputStyle} value={weapon} onChange={e => setWeapon(e.target.value)}>
            {WEAPONS.map(w => <option key={w}>{w}</option>)}
          </select>
        </Field></div>
      </div>
      <Field label="Tag used (optional)">
        <select style={inputStyle} value={tagId} onChange={e => setTagId(e.target.value)}>
          <option value="">— No tag / not required —</option>
          {openTags.map(t => <option key={t.id} value={t.id}>{t.name}{t.species ? ` (${t.species})` : ""}</option>)}
        </select>
        {tags.length === 0 && <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4 }}>Add your tags in the Tags section and they'll show up here.</div>}
      </Field>
      <Field label="Location (optional)"><input style={inputStyle} value={location} onChange={e => setLocation(e.target.value)} placeholder="Back 40, public land unit 12…" /></Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><Field label="Field-dressed lbs"><input type="number" inputMode="decimal" min={0} style={inputStyle} value={fieldDressedLbs} onChange={e => setFieldDressedLbs(e.target.value)} placeholder="optional" /></Field></div>
        <div style={{ flex: 1 }}><Field label="Meat packaged (lbs)"><input type="number" inputMode="decimal" min={0} style={inputStyle} value={meatLbs} onChange={e => setMeatLbs(e.target.value)} placeholder="can add later" /></Field></div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><Field label="Processed by">
          <select style={inputStyle} value={processedBy} onChange={e => setProcessedBy(e.target.value)}>
            <option value="self">Myself</option><option value="processor">Processor</option>
          </select>
        </Field></div>
        <div style={{ flex: 1 }}><Field label="Processing cost ($)"><input type="number" inputMode="decimal" step="0.01" min={0} style={inputStyle} value={processingCost} onChange={e => setProcessingCost(e.target.value)} placeholder="0" /></Field></div>
      </div>
      <Field label="Notes (optional)"><textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Points, conditions, cuts you got…" /></Field>
      <DeleteRow canDelete={!!harvest} onDelete={() => { onDelete(harvest.id); onClose(); }} onCancel={onClose} onSave={save} saveDisabled={!date} />
    </ModalShell>
  );
}

function TagModal({ tag, onSave, onDelete, onClose }) {
  const [name, setName] = useState(tag?.name || "");
  const [species, setSpecies] = useState(tag?.species || "Deer");
  const [state, setState] = useState(tag?.state || "");
  const [seasonYear, setSeasonYear] = useState(tag?.seasonYear || String(new Date().getFullYear()));
  const [cost, setCost] = useState(tag?.cost ? String(tag.cost) : "");
  const [purchaseDate, setPurchaseDate] = useState(tag?.purchaseDate || todayStr());
  const [expires, setExpires] = useState(tag?.expires || "");
  const [notes, setNotes] = useState(tag?.notes || "");
  const save = () => {
    onSave({
      id: tag?.id || newId(), name: name.trim(), species, state: state.trim(), seasonYear: seasonYear.trim(),
      cost: parseFloat(cost) || 0, purchaseDate, expires, notes: notes.trim(),
      filledHarvestId: tag?.filledHarvestId || null,
    });
    onClose();
  };
  return (
    <ModalShell title={tag ? "Edit tag" : "🏷️ Add a tag / license"} onClose={onClose}>
      <Field label="Tag or license name"><input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Any-deer permit, Turkey tag #2" autoFocus /></Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><Field label="Species"><select style={inputStyle} value={species} onChange={e => setSpecies(e.target.value)}>{HUNT_SPECIES.map(s => <option key={s}>{s}</option>)}</select></Field></div>
        <div style={{ flex: 1 }}><Field label="State / unit"><input style={inputStyle} value={state} onChange={e => setState(e.target.value)} placeholder="KS, unit 4…" /></Field></div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><Field label="Season"><input style={inputStyle} value={seasonYear} onChange={e => setSeasonYear(e.target.value)} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Cost ($)"><input type="number" inputMode="decimal" step="0.01" min={0} style={inputStyle} value={cost} onChange={e => setCost(e.target.value)} /></Field></div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><Field label="Bought"><input type="date" style={inputStyle} value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Expires (optional)"><input type="date" style={inputStyle} value={expires} onChange={e => setExpires(e.target.value)} /></Field></div>
      </div>
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Draw results, bag limits…" /></Field>
      <DeleteRow canDelete={!!tag} onDelete={() => { onDelete(tag.id); onClose(); }} onCancel={onClose} onSave={save} saveDisabled={!name.trim()} />
    </ModalShell>
  );
}

function GearModal({ item, onSave, onDelete, onClose }) {
  const [name, setName] = useState(item?.item || "");
  const [category, setCategory] = useState(item?.category || "Equipment");
  const [cost, setCost] = useState(item?.cost ? String(item.cost) : "");
  const [date, setDate] = useState(item?.date || todayStr());
  const [notes, setNotes] = useState(item?.notes || "");
  const save = () => {
    onSave({ id: item?.id || newId(), item: name.trim(), category, cost: parseFloat(cost) || 0, date, notes: notes.trim() });
    onClose();
  };
  return (
    <ModalShell title={item ? "Edit gear / supply" : "🎒 Add equipment or supplies"} onClose={onClose}>
      <Field label="Item"><input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Tree stand, box of .308, game bags" autoFocus /></Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}><Field label="Category"><select style={inputStyle} value={category} onChange={e => setCategory(e.target.value)}>{GEAR_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></Field></div>
        <div style={{ flex: 1 }}><Field label="Cost ($)"><input type="number" inputMode="decimal" step="0.01" min={0} style={inputStyle} value={cost} onChange={e => setCost(e.target.value)} /></Field></div>
      </div>
      <Field label="Date"><input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} /></Field>
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      <DeleteRow canDelete={!!item} onDelete={() => { onDelete(item.id); onClose(); }} onCancel={onClose} onSave={save} saveDisabled={!name.trim()} />
    </ModalShell>
  );
}

function tagStatus(t) {
  if (t.filledHarvestId) return { label: "Filled", color: palette.leaf };
  if (t.expires && t.expires < todayStr()) return { label: "Expired", color: palette.inkSoft };
  return { label: "Open", color: palette.accent };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function HuntingPage({ hobby, data, update, setModal, nl = null }) {
  const [harvestModal, setHarvestModal] = useState({ open: false, item: null });
  const [tagModal, setTagModal] = useState({ open: false, item: null });
  const [gearModal, setGearModal] = useState({ open: false, item: null });
  const [editPrice, setEditPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState("");
  if (!hobby) return null;

  const tags = hobby.tags || [];
  const year = String(new Date().getFullYear());
  const t = huntingTotals(hobby, (d) => (d || "").startsWith(year));
  const openTags = tags.filter(x => tagStatus(x).label === "Open");

  const mutate = (fn) => update(d => {
    const h = d.hobbies.find(x => x.id === hobby.id);
    if (!h) return d;
    ["harvests", "tags", "gear"].forEach(k => { if (!Array.isArray(h[k])) h[k] = []; });
    fn(h, d);
    return d;
  });
  const upsert = (arr, rec) => { const i = arr.findIndex(x => x.id === rec.id); if (i >= 0) arr[i] = rec; else arr.push(rec); };

  const saveHarvest = (rec) => mutate(h => {
    const prev = h.harvests.find(x => x.id === rec.id);
    // Unfill the previously used tag if it changed, then fill the new one.
    if (prev && prev.tagId && prev.tagId !== rec.tagId) {
      const old = h.tags.find(x => x.id === prev.tagId);
      if (old && old.filledHarvestId === rec.id) old.filledHarvestId = null;
    }
    if (rec.tagId) {
      const tg = h.tags.find(x => x.id === rec.tagId);
      if (tg) tg.filledHarvestId = rec.id;
    }
    upsert(h.harvests, rec);
  });
  const deleteHarvest = (id) => mutate(h => {
    h.harvests = h.harvests.filter(x => x.id !== id);
    h.tags.forEach(tg => { if (tg.filledHarvestId === id) tg.filledHarvestId = null; });
  });
  const saveTag = (rec) => mutate(h => upsert(h.tags, rec));
  const deleteTag = (id) => mutate(h => {
    h.tags = h.tags.filter(x => x.id !== id);
    h.harvests.forEach(hv => { if (hv.tagId === id) hv.tagId = null; });
  });
  const saveGear = (rec) => mutate(h => upsert(h.gear, rec));
  const deleteGear = (id) => mutate(h => { h.gear = h.gear.filter(x => x.id !== id); });

  const sectionH = { fontFamily: FONT_DISPLAY, fontSize: 18, margin: "0 0 10px", color: palette.ink };
  const row = { padding: "10px 12px", background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 8, cursor: "pointer" };

  if (nl) {
    const harvests = (hobby.harvests || []).slice().sort((a, b) => ((b.date || "") < (a.date || "") ? -1 : 1));
    const gear = (hobby.gear || []).slice().sort((a, b) => ((b.date || "") < (a.date || "") ? -1 : 1));
    const ctx = {
      key: "hunting",
      summary: { big: t.meatLbs ? fmtWeight(t.meatLbs) : "0", small: `of meat in ${year}`, line: [`${t.harvests.length} harvest${t.harvests.length === 1 ? "" : "s"}`, t.meatLbs ? `${fmtMoney(t.costPerLb)} a lb vs. ${fmtMoney(t.valuePerLb)} at the store` : null, openTags.length ? `${openTags.length} open tag${openTags.length === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ") },
      newLabel: "Log a harvest", onNew: () => setHarvestModal({ open: true, item: null }),
      goingTitle: "Open tags",
      going: openTags.map((tg) => ({ id: tg.id, title: tg.name || `${tg.species || ""} tag`.trim(), onOpen: () => setTagModal({ open: true, item: tg }),
        sub: [tg.species, tg.state, tg.expires ? `expires ${fmtDate(tg.expires)}` : null, Number(tg.cost) ? fmtMoney(tg.cost) : null].filter(Boolean).join(" · "),
        actions: [{ label: "Fill it", run: () => setHarvestModal({ open: true, item: null }) }] })),
      shelfTitle: "Harvests", shelfEmpty: "No harvests logged yet. Good luck out there.",
      shelf: harvests.map((hv) => ({ id: hv.id, title: [hv.species, hv.sex].filter(Boolean).join(" · ") || "Harvest", onOpen: () => setHarvestModal({ open: true, item: hv }),
        sub: [fmtDate(hv.date), hv.weapon, hv.meatLbs ? `${fmtWeight(Number(hv.meatLbs))} of meat` : null, hv.location || null].filter(Boolean).join(" · ") })),
      past: gear.map((g) => ({ id: g.id, title: g.item || "Gear", sub: [g.category, fmtDate(g.date), Number(g.cost) ? fmtMoney(g.cost) : null].filter(Boolean).join(" · "), onOpen: () => setGearModal({ open: true, item: g }) })),
      pastTitle: "Gear", pastSub: "Tap one to edit it.",
      extras: [
        { key: "tag", label: "Add a tag", sub: "Licenses and tags you bought", icon: NlTag, run: () => setTagModal({ open: true, item: null }) },
        { key: "gear", label: "Add gear", sub: "Ammo, blinds, processing tools", icon: NlHammer, run: () => setGearModal({ open: true, item: null }) },
        { key: "price", label: `Store meat price: ${fmtMoney(t.valuePerLb)} a lb`, sub: "What you'd pay for meat at the store", icon: NlDollar, run: () => { setPriceDraft(String(t.valuePerLb)); setEditPrice(true); } },
        { key: "expense", label: "Expense", icon: NlReceipt, run: () => setModal && setModal({ type: "addExpense", hobbyId: hobby.id }) },
        ...(Array.isArray(hobby.customLogs) ? hobby.customLogs : []).map((c) => ({ key: c.id, label: c.label, icon: NlNote, run: () => setModal && setModal({ type: "log", action: "custom", customLogId: c.id, hobbyIdOverride: hobby.id }) })),
        { key: "customlog", label: "Make a custom log button", icon: NlPlus, run: () => setModal && setModal({ type: "customLogPicker", hobbyId: hobby.id }) },
      ],
    };
    return (
      <div>
        {harvestModal.open && <HarvestModal harvest={harvestModal.item} tags={tags} onSave={saveHarvest} onDelete={deleteHarvest} onClose={() => setHarvestModal({ open: false, item: null })} />}
        {tagModal.open && <TagModal tag={tagModal.item} onSave={saveTag} onDelete={deleteTag} onClose={() => setTagModal({ open: false, item: null })} />}
        {gearModal.open && <GearModal item={gearModal.item} onSave={saveGear} onDelete={deleteGear} onClose={() => setGearModal({ open: false, item: null })} />}
        {editPrice && (
          <ModalShell title="Store meat price" onClose={() => setEditPrice(false)}>
            <Field label="Price per lb at the store"><input type="number" step="0.01" min={0} value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)} style={inputStyle} /></Field>
            <Btn onClick={() => { const v = parseFloat(priceDraft); mutate((h) => { h.meatValuePerLb = v > 0 ? v : DEFAULT_MEAT_VALUE; }); setEditPrice(false); }}>Save</Btn>
          </ModalShell>
        )}
        <PantryView tab={nl.tab} ctx={ctx} onOpenJournal={nl.onOpenJournal} onSeeAll={nl.onSeeAll} />
      </div>
    );
  }

  return (
    <div>
      {harvestModal.open && <HarvestModal harvest={harvestModal.item} tags={tags} onSave={saveHarvest} onDelete={deleteHarvest} onClose={() => setHarvestModal({ open: false, item: null })} />}
      {tagModal.open && <TagModal tag={tagModal.item} onSave={saveTag} onDelete={deleteTag} onClose={() => setTagModal({ open: false, item: null })} />}
      {gearModal.open && <GearModal item={gearModal.item} onSave={saveGear} onDelete={deleteGear} onClose={() => setGearModal({ open: false, item: null })} />}

      <div style={{ fontSize: 10, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{year} season</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <StatCard label="Harvested" value={t.harvests.length} accent={palette.feather} />
        <StatCard label="Meat in freezer" value={t.meatLbs > 0 ? fmtWeight(t.meatLbs) : "—"} accent={palette.leaf} />
        <StatCard label="Spent" value={fmtMoney(t.totalCost)} sub="tags + gear + processing" accent={palette.accent} />
        <StatCard label="Cost / lb" value={t.meatLbs > 0 ? fmtMoney(t.costPerLb) : "—"} sub={t.meatLbs > 0 ? `store value ≈ ${fmtMoney(t.storeValue)}` : null} accent={palette.yolk} />
      </div>

      <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 16 }}>
        {editPrice ? (
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            Store price per lb: <input type="number" step="0.01" min={0} value={priceDraft} onChange={e => setPriceDraft(e.target.value)} style={{ ...inputStyle, width: 90, padding: "4px 8px", fontSize: 13 }} />
            <Btn small onClick={() => { const v = parseFloat(priceDraft); mutate(h => { h.meatValuePerLb = v > 0 ? v : DEFAULT_MEAT_VALUE; }); setEditPrice(false); }}>Save</Btn>
          </span>
        ) : (
          <>Comparing against {fmtMoney(t.valuePerLb)}/lb store meat · <button onClick={() => { setPriceDraft(String(t.valuePerLb)); setEditPrice(true); }} style={{ background: "none", border: "none", padding: 0, color: palette.inkSoft, textDecoration: "underline", cursor: "pointer", fontSize: 12 }}>change</button></>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 8, marginBottom: 18 }}>
        <Btn variant="accent" onClick={() => setHarvestModal({ open: true, item: null })} style={{ width: "100%" }}>🦌 Log harvest</Btn>
        <Btn small variant="ghost" onClick={() => setTagModal({ open: true, item: null })} style={{ width: "100%" }}>🏷️ Add tag</Btn>
        <Btn small variant="ghost" onClick={() => setGearModal({ open: true, item: null })} style={{ width: "100%" }}>🎒 Gear / supplies</Btn>
        {setModal && (Array.isArray(hobby.customLogs) ? hobby.customLogs : []).map(c => (
          <Btn key={c.id} small variant="ghost" onClick={() => setModal({ type: "log", action: "custom", customLogId: c.id, hobbyIdOverride: hobby.id })} style={{ width: "100%" }}>{c.emoji || "📝"} {c.label}</Btn>
        ))}
        {setModal && <Btn small variant="ghost" onClick={() => setModal({ type: "customLogPicker", hobbyId: hobby.id })} style={{ width: "100%" }}>➕ Custom</Btn>}
      </div>

      {/* Tags */}
      <div style={{ marginBottom: 22 }}>
        <h3 style={sectionH}>🏷️ Tags & licenses {openTags.length > 0 && <span style={{ fontSize: 13, color: palette.accent, fontFamily: FONT_BODY }}>· {openTags.length} open</span>}</h3>
        {tags.length === 0 ? (
          <div style={{ fontSize: 12, color: palette.inkSoft, fontStyle: "italic" }}>No tags yet. Add the tags and licenses you bought this season — they'll mark as filled when you log a harvest.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tags.slice().sort((a, b) => (b.purchaseDate || "").localeCompare(a.purchaseDate || "")).map(tg => {
              const st = tagStatus(tg);
              return (
                <div key={tg.id} onClick={() => setTagModal({ open: true, item: tg })} style={{ ...row, display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: palette.ink }}>{tg.name}</div>
                    <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 2 }}>{[tg.species, tg.state, tg.seasonYear, tg.cost > 0 ? fmtMoney(tg.cost) : null, tg.expires ? `expires ${fmtDate(tg.expires)}` : null].filter(Boolean).join(" · ")}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: st.color, flexShrink: 0 }}>{st.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Harvests */}
      <div style={{ marginBottom: 22 }}>
        <h3 style={sectionH}>🦌 Harvests</h3>
        {(hobby.harvests || []).length === 0 ? (
          <div style={{ fontSize: 12, color: palette.inkSoft, fontStyle: "italic" }}>Nothing logged yet. Good luck out there.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(hobby.harvests || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(hv => (
              <div key={hv.id} onClick={() => setHarvestModal({ open: true, item: hv })} style={row}>
                <div style={{ fontWeight: 600, fontSize: 13, color: palette.ink }}>{hv.species}{hv.sex ? ` (${hv.sex})` : ""} · {hv.weapon}</div>
                <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 2 }}>
                  {[fmtDate(hv.date), hv.meatLbs > 0 ? `${fmtWeight(hv.meatLbs)} meat` : "meat lbs not entered", hv.processingCost > 0 ? `${fmtMoney(hv.processingCost)} processing` : null, hv.location].filter(Boolean).join(" · ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gear */}
      <div style={{ marginBottom: 22 }}>
        <h3 style={sectionH}>🎒 Equipment & supplies {t.gearCost > 0 && <span style={{ fontSize: 13, color: palette.inkSoft, fontFamily: FONT_BODY }}>· {fmtMoney(t.gearCost)} this year</span>}</h3>
        {(hobby.gear || []).length === 0 ? (
          <div style={{ fontSize: 12, color: palette.inkSoft, fontStyle: "italic" }}>Log stands, ammo, optics, game bags — anything you buy for hunting.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(hobby.gear || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(g => (
              <div key={g.id} onClick={() => setGearModal({ open: true, item: g })} style={{ ...row, display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: palette.ink }}>{g.item}</div>
                  <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 2 }}>{g.category} · {fmtDate(g.date)}</div>
                </div>
                <strong style={{ fontSize: 13, color: palette.ink, flexShrink: 0 }}>{fmtMoney(g.cost)}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analytics (Stats tab). Wrapped by AnalyticsShareWrapper, which injects a
// dateRange — we filter harvests/tags/gear to it ourselves since these
// records live on the hobby, not in data.entries.
// ---------------------------------------------------------------------------
// 3.0 Stats: harvests, meat, cost per lb vs. the store, by species.
export function huntingStats(hobby, data, range = "year") {
  const year = String(new Date().getFullYear());
  const t = huntingTotals(hobby, (d) => range === "all" || (d || "").startsWith(year));
  const by = new Map(); for (const h of t.harvests) { const k = h.species || "Other"; by.set(k, (by.get(k) || 0) + (Number(h.meatLbs) || 0)); }
  const rows = [...by.entries()].sort((a, b) => b[1] - a[1]).map(([name, v]) => ({ key: name, name, value: v, label: `${Math.round(v)} lbs` }));
  const facts = [];
  if (t.meatLbs >= 10) facts.push({ key: "meals", icon: "trophy", big: String(Math.round(t.meatLbs * 2)), line: "family dinners we hunted", title: `About ${Math.round(t.meatLbs * 2)} family dinners`, sub: `${Math.round(t.meatLbs)} lbs at half a pound a plate.` });
  if (t.meatLbs && t.storeValue > t.totalCost) facts.push({ key: "saved", icon: "money", big: fmtMoney(t.storeValue - t.totalCost), line: "less than buying it at the store", title: `${fmtMoney(t.storeValue - t.totalCost)} less than the store`, sub: `At ${fmtMoney(t.valuePerLb)} a lb.` });
  return {
    cards: [
      { label: "Harvests", value: t.harvests.length, sub: rows.map((r) => r.name).slice(0, 3).join(", ") },
      { label: "Meat", value: t.meatLbs ? fmtWeight(t.meatLbs) : "—", sub: t.meatLbs ? `store value ${fmtMoney(t.storeValue)}` : "" },
      { label: "Spent", value: fmtMoney(t.totalCost), sub: "Tags, gear, processing" },
      { label: "Cost per lb", value: t.meatLbs ? fmtMoney(t.costPerLb) : "—", sub: `vs. ${fmtMoney(t.valuePerLb)} at the store` },
    ],
    bars: rows.length ? { title: "Meat by species", right: range === "all" ? "All time" : year, rows } : null,
    facts, emoji: "🦌", kicker: "Our hunt",
  };
}

export function HuntingAnalytics({ hobby, dateRange = null }) {
  if (!hobby) return null;
  const inRange = (d) => {
    if (!dateRange || (!dateRange.start && !dateRange.end)) return true;
    if (!d) return false;
    if (dateRange.start && d < dateRange.start) return false;
    if (dateRange.end && d > dateRange.end) return false;
    return true;
  };
  const t = huntingTotals(hobby, inRange);
  if (t.harvests.length === 0 && t.tags.length === 0 && t.gear.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", color: palette.inkSoft }}>No hunting data in this view yet.</div>;
  }
  const bySpecies = {};
  t.harvests.forEach(h => {
    const k = h.species || "Other";
    bySpecies[k] = bySpecies[k] || { count: 0, lbs: 0 };
    bySpecies[k].count += 1;
    bySpecies[k].lbs += Number(h.meatLbs) || 0;
  });
  const gearByCat = {};
  t.gear.forEach(g => { gearByCat[g.category || "Other"] = (gearByCat[g.category || "Other"] || 0) + (Number(g.cost) || 0); });
  const filled = t.tags.filter(x => x.filledHarvestId).length;
  const box = { background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, marginBottom: 12 };
  const line = { display: "flex", justifyContent: "space-between", padding: "8px 10px", background: palette.bgAlt, borderRadius: 6, fontSize: 13, marginBottom: 6 };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Harvested" value={t.harvests.length} accent={palette.feather} />
        <StatCard label="Meat" value={t.meatLbs > 0 ? fmtWeight(t.meatLbs) : "—"} accent={palette.leaf} />
        <StatCard label="Cost / lb" value={t.meatLbs > 0 ? fmtMoney(t.costPerLb) : "—"} sub={`vs ${fmtMoney(t.valuePerLb)}/lb store`} accent={palette.yolk} />
        <StatCard label="Store value" value={fmtMoney(t.storeValue)} sub={t.storeValue - t.totalCost >= 0 ? `${fmtMoney(t.storeValue - t.totalCost)} ahead` : `${fmtMoney(t.totalCost - t.storeValue)} behind`} accent={palette.leaf} />
        <StatCard label="Tags filled" value={`${filled}/${t.tags.length}`} accent={palette.accent} />
      </div>
      <div style={box}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, marginBottom: 10, color: palette.ink }}>📊 Where the money went</div>
        <div style={line}><span>Tags & licenses</span><strong>{fmtMoney(t.tagCost)}</strong></div>
        <div style={line}><span>Equipment & supplies</span><strong>{fmtMoney(t.gearCost)}</strong></div>
        <div style={line}><span>Processing</span><strong>{fmtMoney(t.processingCost)}</strong></div>
        <div style={{ ...line, background: palette.ink, color: palette.bg, fontWeight: 600 }}><span>Total</span><span>{fmtMoney(t.totalCost)}</span></div>
      </div>
      {Object.keys(bySpecies).length > 0 && (
        <div style={box}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, marginBottom: 10, color: palette.ink }}>🦌 By species</div>
          {Object.entries(bySpecies).sort((a, b) => b[1].count - a[1].count).map(([sp, v]) => (
            <div key={sp} style={line}><span>{sp} × {v.count}</span><strong>{v.lbs > 0 ? fmtWeight(v.lbs) : "—"}</strong></div>
          ))}
        </div>
      )}
      {Object.keys(gearByCat).length > 0 && (
        <div style={box}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, marginBottom: 10, color: palette.ink }}>🎒 Gear by category</div>
          {Object.entries(gearByCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
            <div key={c} style={line}><span>{c}</span><strong>{fmtMoney(v)}</strong></div>
          ))}
        </div>
      )}
    </div>
  );
}
