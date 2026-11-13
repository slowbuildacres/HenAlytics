// ============================================================================
// MAPLE SYRUP PAGE
// ----------------------------------------------------------------------------
// Hobby for tracking maple sugaring seasons. Per-season aggregates rather
// than a complex per-tap or per-batch model — most sugarers just want to
// know "this year: 50 taps, 200 gallons sap, 5 gallons syrup, $X in supplies."
//
// Data shape on the hobby:
//   hobby.seasons[] = [{ id, name, year, startDate, endDate,
//                        totalTaps, totalSapGal, totalSyrupGal,
//                        archived }]
//   hobby.currentSeasonId = id of the active season (latest unarchived)
//
// Entries (data.entries["maple_syrup"]):
//   - action: "sap_collected" — sap collection event { gallons }
//   - action: "boil"          — boiling session { sapGal, syrupGal }
//   - action: "tap_set"       — taps placed (incremental) { count }
//   - action: "supplies"      — supplies cost { cost }
//   - action: "infrastructure"— infrastructure cost { cost }
//   - action: "note"          — free-form note
//
// Each entry attaches to a season via seasonId.
//
// Industry rule of thumb: 40 gal sap → 1 gal syrup. So total syrup yield
// is roughly totalSapGal / 40. The page surfaces both the actual logged
// syrup AND the theoretical (so users can see boiling efficiency).
// ============================================================================

import { legacyPalette } from "./newlook/legacyTheme.js";
import { undoable } from "./newlook/UndoBar.jsx";
import { Sheet, Button as NlButton } from "./newlook/ui.jsx";
import { font as NL_FONT } from "./newlook/theme.js";
import React, { useState, useMemo } from "react";
import { scoreOf, noteBulkDelete } from "./sync.js";
// NEW_LOOK (3.0): shared kitchen & craft screens.
import { PantryView } from "./newlook/pantry/PantryScreens.jsx";
import { Hammer as NlHammer, Receipt as NlReceipt, NotebookPen as NlNote, Plus as NlPlus, ShoppingBasket as NlBasket } from "lucide-react";
import { X, Plus, Edit3, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { fmtMoney, galToInput, galFromInput, volumeUnitLabel, fmtVolume, volumeFromGal, currencySymbol } from "./units.js";
// ADV_ANALYTICS: shared advanced-analytics layer (see analytics.js).
import { personalRecord, LockedStatOverlay } from "./analytics.js";
import { groupDigits } from "./numFmt.js";

const palette = legacyPalette({
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47", featherSoft: "#C9A77B",
  maple: "#B85518", mapleSoft: "#E89968",
  line: "#2C181030", card: "#FAF5EA",
});
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;
const inputStyle = () => ({
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
});

const newId = () => Math.random().toString(36).slice(2, 10);
const localDateStr = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const todayStr = () => localDateStr(new Date());
const parseLocalDate = (s) => { if (!s) return new Date(); const [y,m,d] = s.split("-").map(Number); return new Date(y,(m||1)-1,d||1); };
const fmtDate = (s) => { if (!s) return ""; return parseLocalDate(s).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); };

// Industry conversion: ~40 gal sap → 1 gal syrup (sugar maple, 2% sugar).
const SAP_TO_SYRUP_RATIO = 40;

function Btn({ children, onClick, variant="primary", small=false, style={}, type="button", disabled=false }) {
  const styles = {
    primary: { background: palette.ink, color: palette.bg, border: `1.5px solid ${palette.ink}` },
    danger:  { background: palette.accent, color: palette.onColor, border: `1.5px solid ${palette.accent}` },
    ghost:   { background: "transparent", color: palette.ink, border: `1.5px solid ${palette.line}` },
    accent:  { background: palette.maple, color: palette.onColor, border: `1.5px solid ${palette.maple}` },
    leaf:    { background: palette.leaf, color: palette.onColor, border: `1.5px solid ${palette.leaf}` },
  };
  return (
    <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled} style={{minHeight: small ? 36 : 44, 
      padding: small ? "6px 12px" : "10px 18px", borderRadius: small ? 999 : 14, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: FONT_BODY, fontWeight: 600, fontSize: small ? 13 : 14,
      opacity: disabled ? 0.6 : 1, boxShadow: "none", ...styles[variant], ...style,
    }}>{children}</button>
  );
}
function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>{label}</div>
      {children}
    </label>
  );
}
function StatCard({ label, value, sub, accent = palette.accent }) {
  return (
    <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 16, padding: 14, flex: "1 1 130px", minWidth: 130, boxSizing: "border-box" }}>
      <div style={{ fontSize: 10, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontFamily: FONT_DISPLAY, color: palette.ink, lineHeight: 1.1 }}>{groupDigits(value)}</div>
      {sub && <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(44,24,16,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: palette.bg, borderRadius: 16, maxWidth: 460, width: "100%",
        maxHeight: "92vh", overflow: "auto", border: `2px solid ${palette.ink}`,
        boxShadow: "0 12px 32px rgba(0,0,0,0.22)", fontFamily: FONT_BODY,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1.5px solid ${palette.line}` }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.ink }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: palette.ink, padding: 4 }}>
            <X size={22} />
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

// ============ SEASON MODAL ============
function SeasonModal({ season, onSave, onDelete, onClose }) {
  const [name, setName] = useState(season?.name || `${new Date().getFullYear()} season`);
  const [year, setYear] = useState(season?.year ? String(season.year) : String(new Date().getFullYear()));
  const [startDate, setStartDate] = useState(season?.startDate || todayStr());
  const [endDate, setEndDate] = useState(season?.endDate || "");
  const [totalTaps, setTotalTaps] = useState(season?.totalTaps != null ? String(season.totalTaps) : "");
  const [notes, setNotes] = useState(season?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: season?.id || newId(),
      name: name.trim(),
      year: parseInt(year) || new Date().getFullYear(),
      startDate,
      endDate: endDate || null,
      totalTaps: parseInt(totalTaps) || 0,
      notes: notes.trim(),
      created: season?.created || Date.now(),
      archived: season?.archived || false,
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={season ? "Edit season" : "New season"}>
      <Field label="Season name">
        <input style={inputStyle()} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 2026 season" autoFocus />
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Year">
            <input type="number" min={2000} max={2100} style={inputStyle()} value={year} onChange={e => setYear(e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Total taps set">
            <input type="number" min={0} style={inputStyle()} value={totalTaps} onChange={e => setTotalTaps(e.target.value)} placeholder="0" />
          </Field>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Start date">
            <input type="date" style={inputStyle()} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="End date (optional)">
            <input type="date" style={inputStyle()} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </Field>
        </div>
      </div>
      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle(), minHeight: 60, resize: "vertical" }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Weather notes, tree count, sugarbush conditions..." />
      </Field>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {season && onDelete && (
          !confirmDelete
            ? <Btn variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Btn>
            : <Btn variant="danger" onClick={() => { onDelete(season.id); onClose(); }}>Confirm delete</Btn>
        )}
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={!name.trim()}>Save</Btn>
      </div>
    </Modal>
  );
}

// ============ ENTRY LOG MODAL ============
// Single modal that handles all entry types via the `action` prop.
function LogEntryModal({ action, season, entry, onSave, onClose }) {
  const [date, setDate] = useState(entry?.date || todayStr());
  const [sapGal, setSapGal] = useState(entry?.sapGal != null ? galToInput(entry.sapGal) : "");
  const [syrupGal, setSyrupGal] = useState(entry?.syrupGal != null ? galToInput(entry.syrupGal) : "");
  const [gallons, setGallons] = useState(entry?.gallons != null ? galToInput(entry.gallons) : "");
  const [count, setCount] = useState(entry?.count != null ? String(entry.count) : "");
  const [cost, setCost] = useState(entry?.cost != null ? String(entry.cost) : "");
  const [item, setItem] = useState(entry?.item || "");
  const [note, setNote] = useState(entry?.note || "");

  const handleSave = () => {
    const out = {
      id: entry?.id || newId(),
      action, date,
      seasonId: season?.id || null,
      created: entry?.created || Date.now(),
      note: note.trim(),
    };
    if (action === "sap_collected") out.gallons = galFromInput(gallons);
    if (action === "boil") { out.sapGal = galFromInput(sapGal); out.syrupGal = galFromInput(syrupGal); }
    if (action === "tap_set") out.count = parseInt(count) || 0;
    if (action === "supplies" || action === "infrastructure") { out.cost = parseFloat(cost) || 0; out.item = item.trim(); }
    onSave(out);
    onClose();
  };

  const titles = {
    sap_collected: "Log sap collected",
    boil: "Log boil",
    tap_set: "Log taps set",
    supplies: "Log supplies cost",
    infrastructure: "Log infrastructure cost",
    note: "Add note",
  };

  return (
    <Modal open onClose={onClose} title={titles[action] || "Log"}>
      <Field label="Date">
        <input type="date" style={inputStyle()} value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      {action === "sap_collected" && (
        <Field label={`Sap collected (${volumeUnitLabel() === "L" ? "liters" : "gallons"})`}>
          <input type="number" min={0} step="0.1" style={inputStyle()} value={gallons} onChange={e => setGallons(e.target.value)} placeholder="0" autoFocus />
        </Field>
      )}
      {action === "boil" && (
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field label={`Sap boiled (${volumeUnitLabel()})`}>
              <input type="number" min={0} step="0.1" style={inputStyle()} value={sapGal} onChange={e => setSapGal(e.target.value)} placeholder="0" autoFocus />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label={`Syrup produced (${volumeUnitLabel()})`}>
              <input type="number" min={0} step="0.01" style={inputStyle()} value={syrupGal} onChange={e => setSyrupGal(e.target.value)} placeholder="0" />
            </Field>
          </div>
        </div>
      )}
      {action === "boil" && Number(sapGal) > 0 && (
        <div style={{ padding: "8px 12px", background: palette.bgAlt, borderRadius: 6, fontSize: 12, color: palette.inkSoft, marginBottom: 12, lineHeight: 1.5 }}>
          Rule of thumb: about 40 parts sap make 1 part syrup. Your boil ratio: {Number(syrupGal) > 0 ? `${(Number(sapGal) / Number(syrupGal)).toFixed(1)}:1` : "—"}
        </div>
      )}
      {action === "tap_set" && (
        <Field label="Taps set today">
          <input type="number" min={0} style={inputStyle()} value={count} onChange={e => setCount(e.target.value)} placeholder="0" autoFocus />
        </Field>
      )}
      {(action === "supplies" || action === "infrastructure") && (
        <>
          <Field label={action === "supplies" ? "What was purchased?" : "What was built / bought?"}>
            <input style={inputStyle()} value={item} onChange={e => setItem(e.target.value)} placeholder={action === "supplies" ? "e.g. spiles, filters, bottles" : "e.g. evaporator, sugar shack, RO machine"} autoFocus />
          </Field>
          <Field label={`Cost (${currencySymbol()})`}>
            <input type="number" min={0} step="0.01" style={inputStyle()} value={cost} onChange={e => setCost(e.target.value)} placeholder={`${currencySymbol()}0.00`} />
          </Field>
        </>
      )}
      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle(), minHeight: 50, resize: "vertical" }} value={note} onChange={e => setNote(e.target.value)} />
      </Field>
      <Btn onClick={handleSave}>Save</Btn>
    </Modal>
  );
}

// ============ MAIN PAGE ============
export default function MapleSyrupPage({ hobby, data, update, setModal, nl = null }) {
  const seasons = (hobby.seasons || []).slice().sort((a, b) => (b.year || 0) - (a.year || 0));
  const allEntries = data.entries[hobby.id] || [];

  // The "current" season is whichever the user marked, else the latest one.
  const currentSeason = useMemo(() => {
    if (hobby.currentSeasonId) {
      const cs = seasons.find(s => s.id === hobby.currentSeasonId);
      if (cs) return cs;
    }
    return seasons.find(s => !s.archived) || seasons[0] || null;
  }, [seasons, hobby.currentSeasonId]);

  const [askSeason, setAskSeason] = useState(false);
  const [seasonModal, setSeasonModal] = useState({ open: false, season: null });
  const [entryModal, setEntryModal] = useState({ open: false, action: null, entry: null });

  const saveSeason = (s) => {
    undoable(update, `Saved ${s.name || "season"}`)(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.seasons)) h.seasons = [];
      const idx = h.seasons.findIndex(x => x.id === s.id);
      if (idx >= 0) h.seasons[idx] = s; else h.seasons.push(s);
      // A season you just started becomes the current one (it used to only
      // when it was the first, so a new year's logs kept going to last year).
      if (idx < 0 || h.seasons.length === 1) h.currentSeasonId = s.id;
      return d;
    });
  };
  const deleteSeason = (id) => {
    undoable(update, "Deleted season")(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      const before = scoreOf(d);
      h.seasons = (h.seasons || []).filter(s => s.id !== id);
      // Also remove entries tagged to this season so we don't keep orphans.
      if (Array.isArray(d.entries[hobby.id])) {
        d.entries[hobby.id] = d.entries[hobby.id].filter(e => e.seasonId !== id);
      }
      if (h.currentSeasonId === id) h.currentSeasonId = (h.seasons[0] || {}).id || null;
      // Its logs going with it is on purpose: tell the sync guard (sync.js).
      noteBulkDelete(d, before);
      return d;
    });
  };
  const setCurrentSeason = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h) h.currentSeasonId = id;
      return d;
    });
  };
  const saveEntry = (entry) => {
    undoable(update, "Saved")(d => {
      d.entries[hobby.id] = d.entries[hobby.id] || [];
      const idx = d.entries[hobby.id].findIndex(e => e.id === entry.id);
      if (idx >= 0) d.entries[hobby.id][idx] = entry;
      else d.entries[hobby.id].push(entry);
      return d;
    });
  };
  const deleteEntry = (id) => {
    undoable(update, "Deleted")(d => {
      if (Array.isArray(d.entries[hobby.id])) {
        d.entries[hobby.id] = d.entries[hobby.id].filter(e => e.id !== id);
      }
      return d;
    });
  };

  // Aggregates for the current season
  const stats = useMemo(() => {
    if (!currentSeason) return null;
    const entries = allEntries.filter(e => e.seasonId === currentSeason.id);
    const totalSapGal = entries.filter(e => e.action === "sap_collected").reduce((s, e) => s + (Number(e.gallons) || 0), 0);
    const totalSyrupGal = entries.filter(e => e.action === "boil").reduce((s, e) => s + (Number(e.syrupGal) || 0), 0);
    const totalSapBoiled = entries.filter(e => e.action === "boil").reduce((s, e) => s + (Number(e.sapGal) || 0), 0);
    const tapEntries = entries.filter(e => e.action === "tap_set");
    const incrementalTaps = tapEntries.reduce((s, e) => s + (Number(e.count) || 0), 0);
    const effectiveTaps = (currentSeason.totalTaps || 0) + incrementalTaps;
    const suppliesCost = entries.filter(e => e.action === "supplies").reduce((s, e) => s + (Number(e.cost) || 0), 0);
    const infraCost = entries.filter(e => e.action === "infrastructure").reduce((s, e) => s + (Number(e.cost) || 0), 0);
    const totalCost = suppliesCost + infraCost;
    const expectedSyrup = totalSapGal / SAP_TO_SYRUP_RATIO;
    const boilEfficiency = totalSapBoiled > 0 && totalSyrupGal > 0 ? (totalSapBoiled / totalSyrupGal) : null;
    return {
      totalSapGal, totalSyrupGal, totalSapBoiled,
      effectiveTaps,
      suppliesCost, infraCost, totalCost,
      expectedSyrup, boilEfficiency,
      entries,
    };
  }, [currentSeason, allEntries]);

  // Sort entries newest first for the activity log
  const recentEntries = useMemo(() => {
    if (!stats) return [];
    return stats.entries.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 30);
  }, [stats]);

  if (nl) {
    const LABEL = { sap_collected: "Sap collected", boil: "Boil", tap_set: "Taps set", supplies: "Supplies", infrastructure: "Equipment", note: "Note" };
    const open = (action, entry = null) => setEntryModal({ open: true, action, entry });
    const st = stats;
    // From January 15 through April, if the current season is from a past
    // year: offer the new year's season (taps carried over) before logging.
    const todayIso = todayStr();
    const thisYear = Number(todayIso.slice(0, 4));
    const md = todayIso.slice(5);
    const curYear = currentSeason ? (Number(currentSeason.year) || Number(String(currentSeason.startDate || "").slice(0, 4))) : null;
    const seasonDue = !!(currentSeason && curYear && curYear < thisYear && md >= "01-15" && md <= "04-30" && !((hobby.seasonPrompt || {})[thisYear]));
    const taps = (st && st.effectiveTaps) || currentSeason?.totalTaps || 0;
    const startNewSeason = () => undoable(update, `Started the ${thisYear} season`)((d) => {
      const h = d.hobbies.find((x) => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.seasons)) h.seasons = [];
      const prev = h.seasons.find((x) => x.id === h.currentSeasonId);
      if (prev && !prev.endDate) prev.endDate = todayIso;
      const ns = { id: newId(), name: `${thisYear} season`, year: thisYear, startDate: todayIso, endDate: null, totalTaps: taps, notes: "", created: Date.now(), archived: false };
      h.seasons.push(ns);
      h.currentSeasonId = ns.id;
      return d;
    });
    const ctx = {
      key: "maple_syrup",
      summary: currentSeason
        ? { big: `${fmtVolume((st.totalSyrupGal || 0), { forceBig: true, decimals: 1 })}`, small: `of syrup in ${currentSeason.name || currentSeason.year || "this season"}`, line: [st.totalSapGal ? `${fmtVolume(st.totalSapGal, { forceBig: true, decimals: 0 })} of sap` : null, st.effectiveTaps ? `${st.effectiveTaps} taps` : null, st.boilEfficiency ? `${st.boilEfficiency.toFixed(0)} to 1 sap to syrup` : null].filter(Boolean).join(" · ") }
        : { big: "0", small: "seasons yet", line: "Start a season when you tap your trees." },
      notice: seasonDue ? {
        title: `Start the ${thisYear} sugaring season`,
        sub: `New logs still go to ${currentSeason.name || curYear}. Start ${thisYear}${taps ? ` with your ${taps} taps carried over` : ""}.`,
        action: `Start ${thisYear}`, onAction: startNewSeason,
        onDismiss: () => update((d) => { const h = d.hobbies.find((x) => x.id === hobby.id); if (h) h.seasonPrompt = { ...(h.seasonPrompt || {}), [thisYear]: true }; return d; }),
      } : null,
      newLabel: currentSeason ? "Log sap collected" : "Start a season", onNew: () => (currentSeason ? (seasonDue ? setAskSeason(true) : open("sap_collected")) : setSeasonModal({ open: true, season: null })),
      goingTitle: "This season",
      going: currentSeason ? [{ id: currentSeason.id, title: currentSeason.name || String(currentSeason.year || "Season"), onOpen: () => setSeasonModal({ open: true, season: currentSeason }),
        sub: [`${(st.totalSapBoiled || 0).toFixed(0)} of ${fmtVolume((st.totalSapGal || 0), { forceBig: true, decimals: 0 })} of sap boiled`, st.expectedSyrup ? `about ${fmtVolume(st.expectedSyrup, { forceBig: true, decimals: 1 })} of syrup in what you've collected` : null].filter(Boolean).join(" · "),
        pct: st.totalSapGal ? (st.totalSapBoiled / st.totalSapGal) * 100 : null,
        actions: [{ label: "Boil", primary: st.totalSapGal > st.totalSapBoiled, run: () => open("boil") }, { label: "Set taps", run: () => open("tap_set") }] }] : [],
      shelfTitle: "Logs this season", shelfEmpty: currentSeason ? "Nothing logged this season yet." : "Start a season to log sap and boils.",
      shelf: recentEntries.map((e) => ({ id: e.id, title: LABEL[e.action] || e.customLabel || "Log", onOpen: () => open(e.action, e),
        sub: [e.date ? new Date(e.date + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "", e.action === "sap_collected" ? `${fmtVolume(e.gallons, { forceBig: true })} sap` : e.action === "boil" ? `${fmtVolume(e.sapGal, { forceBig: true })} sap to ${fmtVolume(e.syrupGal, { forceBig: true })} syrup` : e.action === "tap_set" ? `${e.count} taps` : e.cost ? `${fmtMoney(Number(e.cost))}${e.item ? ` · ${e.item}` : ""}` : null, e.note || null].filter(Boolean).join(" · ") })),
      past: seasons.filter((x) => !currentSeason || x.id !== currentSeason.id).map((x) => ({ id: x.id, title: x.name || String(x.year || "Season"), sub: "Tap to make this the current season", onOpen: () => setCurrentSeason(x.id) })),
      pastTitle: "Other seasons", pastSub: "Tap one to switch to it.",
      extras: [
        ...(currentSeason ? [
          { key: "supplies", label: "Supplies cost", sub: "Buckets, filters, bottles", icon: NlBasket, run: () => open("supplies") },
          { key: "infra", label: "Equipment", sub: "Evaporators, tubing, the sugar shack", icon: NlHammer, run: () => open("infrastructure") },
          { key: "note", label: "Note", icon: NlNote, run: () => open("note") },
        ] : []),
        { key: "season", label: "Start a new season", icon: NlPlus, run: () => setSeasonModal({ open: true, season: null }) },
        { key: "expense", label: "Expense", icon: NlReceipt, run: () => setModal && setModal({ type: "addExpense", hobbyId: hobby.id }) },
        ...(Array.isArray(hobby.customLogs) ? hobby.customLogs : []).map((c) => ({ key: c.id, label: c.label, icon: NlNote, run: () => setModal && setModal({ type: "log", action: "custom", customLogId: c.id, hobbyIdOverride: hobby.id }) })),
        { key: "customlog", label: "Make a custom log button", icon: NlPlus, run: () => setModal && setModal({ type: "customLogPicker", hobbyId: hobby.id }) },
      ],
    };
    return (
      <div>
        {seasonModal.open && <SeasonModal season={seasonModal.season} onSave={saveSeason} onDelete={deleteSeason} onClose={() => setSeasonModal({ open: false, season: null })} />}
        {askSeason && (
          <Sheet open onClose={() => setAskSeason(false)} label="Which season?" showClose>
            <div style={{ padding: 4, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontFamily: NL_FONT.display, fontSize: 22 }}>Start the {thisYear} season?</div>
              <div style={{ fontSize: 15, lineHeight: 1.5 }}>The current season is {currentSeason.name || curYear}.{taps ? ` Your ${taps} taps carry over.` : ""}</div>
              <NlButton onClick={() => { setAskSeason(false); startNewSeason(); open("sap_collected"); }}>Start {thisYear} and log sap</NlButton>
              <NlButton kind="quiet" onClick={() => { setAskSeason(false); open("sap_collected"); }}>Log to {currentSeason.name || curYear}</NlButton>
            </div>
          </Sheet>
        )}
        {entryModal.open && <LogEntryModal action={entryModal.action} season={currentSeason} entry={entryModal.entry} onSave={saveEntry} onClose={() => setEntryModal({ open: false, action: null, entry: null })} />}
        <PantryView tab={nl.tab} ctx={ctx} onOpenJournal={nl.onOpenJournal} onSeeAll={nl.onSeeAll} />
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      {seasonModal.open && (
        <SeasonModal season={seasonModal.season} onSave={saveSeason} onDelete={deleteSeason} onClose={() => setSeasonModal({ open: false, season: null })} />
      )}
      {entryModal.open && (
        <LogEntryModal action={entryModal.action} season={currentSeason} entry={entryModal.entry} onSave={saveEntry} onClose={() => setEntryModal({ open: false, action: null, entry: null })} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.ink }}>🍁 Maple syrup</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {setModal && (
            <Btn small variant="ghost" onClick={() => setModal({ type: "addExpense", hobbyId: hobby.id })}>💵 Add Expense</Btn>
          )}
          {setModal && (Array.isArray(hobby.customLogs) ? hobby.customLogs : []).map(c => (
            <Btn key={c.id} small variant="ghost" onClick={() => setModal({ type: "log", action: "custom", customLogId: c.id, hobbyIdOverride: hobby.id })}>{c.emoji || "📝"} {c.label}</Btn>
          ))}
          {setModal && (
            <Btn small variant="ghost" onClick={() => setModal({ type: "customLogPicker", hobbyId: hobby.id })}>➕ Custom</Btn>
          )}
          <Btn small variant="accent" onClick={() => setSeasonModal({ open: true, season: null })}><Plus size={14} style={{ marginRight: 4 }} />New season</Btn>
        </div>
      </div>

      {!currentSeason ? (
        <div style={{ padding: 28, background: palette.card, border: `2px dashed ${palette.line}`, borderRadius: 12, textAlign: "center", color: palette.inkSoft }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🍁</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink, marginBottom: 6 }}>No sugaring seasons yet</div>
          <div style={{ fontSize: 13, marginBottom: 14 }}>Start a new season to track taps, sap, and syrup yield.</div>
          <Btn variant="accent" onClick={() => setSeasonModal({ open: true, season: null })}>Start first season</Btn>
        </div>
      ) : (
        <>
          {/* Season picker (only if more than 1) */}
          {seasons.length > 1 && (
            <div style={{ marginBottom: 14 }}>
              <select
                style={inputStyle()}
                value={currentSeason.id}
                onChange={e => setCurrentSeason(e.target.value)}
              >
                {seasons.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.year})</option>
                ))}
              </select>
            </div>
          )}

          {/* Season header */}
          <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink }}>{currentSeason.name}</div>
              <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 4 }}>
                {fmtDate(currentSeason.startDate)}{currentSeason.endDate ? ` – ${fmtDate(currentSeason.endDate)}` : " – ongoing"}
              </div>
              {currentSeason.notes && (
                <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 6, fontStyle: "italic" }}>{currentSeason.notes}</div>
              )}
            </div>
            <button onClick={() => setSeasonModal({ open: true, season: currentSeason })} aria-label="Edit season" style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, padding: 4 }}>
              <Edit3 size={16} />
            </button>
          </div>

          {/* Stats grid */}
          {stats && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <StatCard label="Taps set" value={stats.effectiveTaps} accent={palette.feather} />
              <StatCard label="Sap collected" value={`${fmtVolume(stats.totalSapGal, { forceBig: true, decimals: 1 })}`} accent={palette.leaf} />
              <StatCard label="Syrup made" value={`${fmtVolume(stats.totalSyrupGal, { forceBig: true, decimals: 2 })}`} sub={stats.expectedSyrup > 0 ? `expected: ${fmtVolume(stats.expectedSyrup, { forceBig: true, decimals: 2 })}` : null} accent={palette.maple} />
              {stats.totalCost > 0 && <StatCard label="Costs" value={fmtMoney(stats.totalCost)} sub={stats.infraCost > 0 ? `${fmtMoney(stats.infraCost)} infra` : null} accent={palette.accent} />}
              {stats.boilEfficiency && <StatCard label="Boil ratio" value={`${stats.boilEfficiency.toFixed(1)}:1`} sub="sap : syrup" accent={palette.feather} />}
            </div>
          )}

          {/* Quick log actions */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <Btn small variant="leaf" onClick={() => setEntryModal({ open: true, action: "sap_collected", entry: null })}>💧 Sap collected</Btn>
            <Btn small variant="accent" onClick={() => setEntryModal({ open: true, action: "boil", entry: null })}>🔥 Boil</Btn>
            <Btn small variant="ghost" onClick={() => setEntryModal({ open: true, action: "tap_set", entry: null })}>🪵 Set taps</Btn>
            <Btn small variant="ghost" onClick={() => setEntryModal({ open: true, action: "supplies", entry: null })}>🧰 Supplies cost</Btn>
            <Btn small variant="ghost" onClick={() => setEntryModal({ open: true, action: "infrastructure", entry: null })}>🏗️ Infrastructure</Btn>
            <Btn small variant="ghost" onClick={() => setEntryModal({ open: true, action: "note", entry: null })}>📝 Note</Btn>
          </div>

          {/* Recent activity log */}
          {recentEntries.length > 0 && (
            <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 10 }}>Recent activity</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {recentEntries.map(e => {
                  let detail = "";
                  if (e.action === "sap_collected") detail = `💧 ${fmtVolume(e.gallons, { forceBig: true })} sap`;
                  else if (e.action === "boil") detail = `🔥 ${fmtVolume(e.sapGal, { forceBig: true })} sap → ${fmtVolume(e.syrupGal, { forceBig: true })} syrup`;
                  else if (e.action === "tap_set") detail = `🪵 ${e.count} taps set`;
                  else if (e.action === "supplies") detail = `🧰 ${e.item || "supplies"} · ${fmtMoney(e.cost)}`;
                  else if (e.action === "infrastructure") detail = `🏗️ ${e.item || "infrastructure"} · ${fmtMoney(e.cost)}`;
                  else if (e.action === "note") detail = `📝 ${e.note || "note"}`;
                  return (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: palette.bgAlt, borderRadius: 8, fontSize: 13 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: palette.ink }}>{detail}</div>
                        <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 2 }}>{fmtDate(e.date)}{e.note && e.action !== "note" ? ` · ${e.note}` : ""}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setEntryModal({ open: true, action: e.action, entry: e })} aria-label="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, padding: 2 }}>
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => deleteEntry(e.id)} aria-label="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: palette.accent, padding: 2 }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============ ANALYTICS ============
// 3.0 Stats: syrup and sap by season.
export function mapleStats(hobby, data, range = "year") {
  const year = String(new Date().getFullYear());
  const seasons = (hobby && hobby.seasons) || [];
  const ents = ((data.entries && data.entries[hobby.id]) || []).filter((e) => range === "all" || String(e.date || "").startsWith(year));
  const syrup = ents.filter((e) => e.action === "boil").reduce((t, e) => t + (Number(e.syrupGal) || 0), 0);
  const sap = ents.filter((e) => e.action === "sap_collected").reduce((t, e) => t + (Number(e.gallons) || 0), 0);
  const boiled = ents.filter((e) => e.action === "boil").reduce((t, e) => t + (Number(e.sapGal) || 0), 0);
  const cost = ents.filter((e) => e.action === "supplies" || e.action === "infrastructure").reduce((t, e) => t + (Number(e.cost) || 0), 0);
  const rows = seasons.map((x) => { const v = ((data.entries && data.entries[hobby.id]) || []).filter((e) => e.seasonId === x.id && e.action === "boil").reduce((t, e) => t + (Number(e.syrupGal) || 0), 0); return { key: x.id, name: x.name || String(x.year || "Season"), value: v, label: `${fmtVolume(v, { forceBig: true, decimals: 1 })}` }; }).filter((r) => r.value > 0);
  const facts = [];
  if (syrup >= 0.5) facts.push({ key: "pancakes", icon: "drop", big: String(Math.round(syrup * 128 / 2)), line: "pancake breakfasts of our own syrup", title: `About ${Math.round(syrup * 128 / 2)} pancake breakfasts`, sub: "At 2 oz of syrup a plate." });
  if (sap >= 40) facts.push({ key: "sap", icon: "leaf", big: `${fmtVolume(sap, { forceBig: true, decimals: 0 })}`, line: "of sap carried from our trees", title: `${fmtVolume(sap, { forceBig: true, decimals: 0 })} of sap`, sub: "Every drop carried by hand or tubing." });
  return {
    cards: [
      { label: "Syrup", value: `${fmtVolume(syrup, { forceBig: true, decimals: 1 })}`, sub: boiled && syrup ? `${(boiled / syrup).toFixed(0)} to 1 sap to syrup` : "" },
      { label: "Sap", value: `${fmtVolume(sap, { forceBig: true, decimals: 0 })}`, sub: `${fmtVolume(boiled, { forceBig: true, decimals: 0 })} boiled` },
      ...(cost ? [{ label: "Spent", value: fmtMoney(cost), sub: syrup ? `${fmtMoney(cost / volumeFromGal(syrup))} a ${volumeUnitLabel() === "L" ? "liter" : "gallon"} of syrup` : "" }] : []),
    ],
    bars: rows.length ? { title: "Syrup by season", right: "", rows } : null,
    facts, emoji: "🍁", kicker: "Our sugarbush",
  };
}

export function MapleSyrupAnalytics({ hobby, entries, /* ADV_ANALYTICS */ earlyAccessConfig = null, isSupporter = false }) {
  const seasons = (hobby.seasons || []).slice().sort((a, b) => (a.year || 0) - (b.year || 0));
  const allEntries = entries || [];

  // Per-season summary
  const perSeason = useMemo(() => {
    return seasons.map(s => {
      const e = allEntries.filter(x => x.seasonId === s.id);
      const sap = e.filter(x => x.action === "sap_collected").reduce((sum, x) => sum + (Number(x.gallons) || 0), 0);
      const syrup = e.filter(x => x.action === "boil").reduce((sum, x) => sum + (Number(x.syrupGal) || 0), 0);
      const cost = e.filter(x => x.action === "supplies" || x.action === "infrastructure").reduce((sum, x) => sum + (Number(x.cost) || 0), 0);
      const taps = (s.totalTaps || 0) + e.filter(x => x.action === "tap_set").reduce((sum, x) => sum + (Number(x.count) || 0), 0);
      return {
        id: s.id,
        name: s.name,
        year: s.year,
        sap: Number(sap.toFixed(1)),
        syrup: Number(syrup.toFixed(2)),
        taps,
        cost: Number(cost.toFixed(2)),
        syrupPerTap: taps > 0 ? Number((syrup / taps).toFixed(3)) : 0,
        // ADV_ANALYTICS: gallons of sap per gallon of syrup. Lower is better
        // (richer sap). Only meaningful when both sap and syrup are logged.
        ratio: (sap > 0 && syrup > 0) ? Number((sap / syrup).toFixed(1)) : null,
      };
    });
  }, [seasons, allEntries]);

  // Lifetime totals
  const totals = useMemo(() => {
    return perSeason.reduce((acc, s) => ({
      sap: acc.sap + s.sap,
      syrup: acc.syrup + s.syrup,
      cost: acc.cost + s.cost,
      seasons: acc.seasons + 1,
      taps: Math.max(acc.taps, s.taps), // peak tap count, not sum
    }), { sap: 0, syrup: 0, cost: 0, seasons: 0, taps: 0 });
  }, [perSeason]);

  return (
    <div style={{ paddingBottom: 80 }}>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, margin: "0 0 14px", color: palette.ink }}>🍁 Maple syrup stats</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Seasons tracked" value={totals.seasons} accent={palette.leaf} />
        <StatCard label="Lifetime sap" value={`${fmtVolume(totals.sap, { forceBig: true, decimals: 0 })}`} accent={palette.leafSoft} />
        <StatCard label="Lifetime syrup" value={`${fmtVolume(totals.syrup, { forceBig: true, decimals: 2 })}`} accent={palette.maple} />
        {totals.cost > 0 && <StatCard label="Lifetime cost" value={fmtMoney(totals.cost)} accent={palette.accent} />}
        {totals.taps > 0 && <StatCard label="Most taps" value={totals.taps} sub="in a single season" accent={palette.feather} />}
      </div>

      {perSeason.length >= 2 && (
        <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 8 }}>🍁 Syrup yield by year</div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perSeason.map((s) => ({ ...s, syrupShown: Number(volumeFromGal(s.syrup).toFixed(2)) }))}>
                <XAxis dataKey="year" style={{ fontSize: 11 }} />
                <YAxis style={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v} ${volumeUnitLabel()}`, "Syrup"]} />
                <Bar dataKey="syrupShown" fill={palette.maple} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ADV_ANALYTICS: gated block — sap-to-syrup ratio trend + best-ratio
          record. Maple is season-based (no rolling date window), so there is
          no period-vs-period delta here — chart + record only. */}
      {(() => {
        const ratioSeasons = perSeason.filter(s => s.ratio != null);
        if (ratioSeasons.length === 0) return null;
        // Best ratio = lowest sap:syrup. personalRecord() finds the MAX, so
        // feed it negated ratios, then read the season back by id.
        const recNeg = personalRecord(ratioSeasons.map(s => ({ month: s.id, value: -s.ratio })));
        const bestSeason = recNeg ? ratioSeasons.find(s => s.id === recNeg.month) : null;
        const pFonts = { body: FONT_BODY, display: FONT_DISPLAY };
        return (
          <LockedStatOverlay earlyAccessConfig={earlyAccessConfig} isSupporter={isSupporter} palette={palette} fonts={pFonts}>
            <div>
              {bestSeason && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                  <StatCard
                    label="Best sap-to-syrup ratio"
                    value={`${bestSeason.ratio}:1`}
                    sub={`${bestSeason.name} — your richest sap`}
                    accent={palette.maple}
                  />
                </div>
              )}
              {ratioSeasons.length >= 2 && (
                <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 8 }}>📈 Sap-to-syrup ratio by year</div>
                  <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 8, fontFamily: FONT_BODY }}>
                    Gallons of sap boiled down per gallon of syrup. Lower means richer sap.
                  </div>
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={ratioSeasons}>
                        <XAxis dataKey="year" style={{ fontSize: 11 }} />
                        <YAxis style={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => [`${v}:1`, "Sap : Syrup"]} />
                        <Line type="monotone" dataKey="ratio" stroke={palette.maple} strokeWidth={3} dot={{ fill: palette.accent, r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </LockedStatOverlay>
        );
      })()}

      {perSeason.length > 0 && (
        <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 10 }}>Season breakdown</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {perSeason.slice().reverse().map(s => (
              <div key={s.id} style={{ padding: "10px 12px", background: palette.bgAlt, borderRadius: 8, fontSize: 13 }}>
                <div style={{ fontWeight: 700, color: palette.ink, marginBottom: 4 }}>{s.name}</div>
                <div style={{ color: palette.inkSoft, fontSize: 12 }}>
                  {s.taps} taps · {fmtVolume(s.sap, { forceBig: true })} sap → {fmtVolume(s.syrup, { forceBig: true, decimals: 2 })} syrup
                  {s.cost > 0 && ` · ${fmtMoney(s.cost)} cost`}
                  {s.syrupPerTap > 0 && ` · ${fmtVolume(s.syrupPerTap)} a tap`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {perSeason.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: palette.inkSoft, fontSize: 13 }}>No maple syrup data yet. Start a season on the main page.</div>
      )}
    </div>
  );
}
