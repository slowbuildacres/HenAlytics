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

import React, { useState, useMemo } from "react";
import { X, Plus, Edit3, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fmtMoney } from "./units.js";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47", featherSoft: "#C9A77B",
  maple: "#B85518", mapleSoft: "#E89968",
  line: "#2C181030", card: "#FAF5EA",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;
const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
};

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
    danger:  { background: palette.accent, color: palette.bg, border: `1.5px solid ${palette.accent}` },
    ghost:   { background: "transparent", color: palette.ink, border: `1.5px solid ${palette.line}` },
    accent:  { background: palette.maple, color: palette.bg, border: `1.5px solid ${palette.maple}` },
    leaf:    { background: palette.leaf, color: palette.bg, border: `1.5px solid ${palette.leaf}` },
  };
  return (
    <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      padding: small ? "6px 12px" : "10px 18px", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: FONT_BODY, fontWeight: 600, fontSize: small ? 13 : 14,
      opacity: disabled ? 0.6 : 1, boxShadow: "2px 2px 0 " + palette.line, ...styles[variant], ...style,
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
    <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, flex: "1 1 130px", minWidth: 130, boxSizing: "border-box" }}>
      <div style={{ fontSize: 10, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontFamily: FONT_DISPLAY, color: accent, lineHeight: 1.1 }}>{value}</div>
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
        boxShadow: `6px 8px 0 ${palette.line}`, fontFamily: FONT_BODY,
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
        <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 2026 season" autoFocus />
      </Field>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Year">
            <input type="number" min={2000} max={2100} style={inputStyle} value={year} onChange={e => setYear(e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Total taps set">
            <input type="number" min={0} style={inputStyle} value={totalTaps} onChange={e => setTotalTaps(e.target.value)} placeholder="0" />
          </Field>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Start date">
            <input type="date" style={inputStyle} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="End date (optional)">
            <input type="date" style={inputStyle} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </Field>
        </div>
      </div>
      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Weather notes, tree count, sugarbush conditions..." />
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
  const [sapGal, setSapGal] = useState(entry?.sapGal != null ? String(entry.sapGal) : "");
  const [syrupGal, setSyrupGal] = useState(entry?.syrupGal != null ? String(entry.syrupGal) : "");
  const [gallons, setGallons] = useState(entry?.gallons != null ? String(entry.gallons) : "");
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
    if (action === "sap_collected") out.gallons = parseFloat(gallons) || 0;
    if (action === "boil") { out.sapGal = parseFloat(sapGal) || 0; out.syrupGal = parseFloat(syrupGal) || 0; }
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
        <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      {action === "sap_collected" && (
        <Field label="Sap collected (gallons)">
          <input type="number" min={0} step="0.1" style={inputStyle} value={gallons} onChange={e => setGallons(e.target.value)} placeholder="0" autoFocus />
        </Field>
      )}
      {action === "boil" && (
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field label="Sap boiled (gal)">
              <input type="number" min={0} step="0.1" style={inputStyle} value={sapGal} onChange={e => setSapGal(e.target.value)} placeholder="0" autoFocus />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Syrup produced (gal)">
              <input type="number" min={0} step="0.01" style={inputStyle} value={syrupGal} onChange={e => setSyrupGal(e.target.value)} placeholder="0" />
            </Field>
          </div>
        </div>
      )}
      {action === "boil" && Number(sapGal) > 0 && (
        <div style={{ padding: "8px 12px", background: palette.bgAlt, borderRadius: 6, fontSize: 12, color: palette.inkSoft, marginBottom: 12, lineHeight: 1.5 }}>
          Industry rule of thumb: 40 gal sap → 1 gal syrup. Your boil ratio: {Number(syrupGal) > 0 ? `${(Number(sapGal) / Number(syrupGal)).toFixed(1)}:1` : "—"}
        </div>
      )}
      {action === "tap_set" && (
        <Field label="Taps set today">
          <input type="number" min={0} style={inputStyle} value={count} onChange={e => setCount(e.target.value)} placeholder="0" autoFocus />
        </Field>
      )}
      {(action === "supplies" || action === "infrastructure") && (
        <>
          <Field label={action === "supplies" ? "What was purchased?" : "What was built / bought?"}>
            <input style={inputStyle} value={item} onChange={e => setItem(e.target.value)} placeholder={action === "supplies" ? "e.g. spiles, filters, bottles" : "e.g. evaporator, sugar shack, RO machine"} autoFocus />
          </Field>
          <Field label="Cost ($)">
            <input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e => setCost(e.target.value)} placeholder="$0.00" />
          </Field>
        </>
      )}
      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} value={note} onChange={e => setNote(e.target.value)} />
      </Field>
      <Btn onClick={handleSave}>Save</Btn>
    </Modal>
  );
}

// ============ MAIN PAGE ============
export default function MapleSyrupPage({ hobby, data, update }) {
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

  const [seasonModal, setSeasonModal] = useState({ open: false, season: null });
  const [entryModal, setEntryModal] = useState({ open: false, action: null, entry: null });

  const saveSeason = (s) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.seasons)) h.seasons = [];
      const idx = h.seasons.findIndex(x => x.id === s.id);
      if (idx >= 0) h.seasons[idx] = s; else h.seasons.push(s);
      // If this is the very first season, auto-mark it as current.
      if (h.seasons.length === 1) h.currentSeasonId = s.id;
      return d;
    });
  };
  const deleteSeason = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      h.seasons = (h.seasons || []).filter(s => s.id !== id);
      // Also remove entries tagged to this season so we don't keep orphans.
      if (Array.isArray(d.entries[hobby.id])) {
        d.entries[hobby.id] = d.entries[hobby.id].filter(e => e.seasonId !== id);
      }
      if (h.currentSeasonId === id) h.currentSeasonId = (h.seasons[0] || {}).id || null;
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
    update(d => {
      d.entries[hobby.id] = d.entries[hobby.id] || [];
      const idx = d.entries[hobby.id].findIndex(e => e.id === entry.id);
      if (idx >= 0) d.entries[hobby.id][idx] = entry;
      else d.entries[hobby.id].push(entry);
      return d;
    });
  };
  const deleteEntry = (id) => {
    update(d => {
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
        <Btn small variant="accent" onClick={() => setSeasonModal({ open: true, season: null })}><Plus size={14} style={{ marginRight: 4 }} />New season</Btn>
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
                style={inputStyle}
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
              <StatCard label="Sap collected" value={`${stats.totalSapGal.toFixed(1)} gal`} accent={palette.leaf} />
              <StatCard label="Syrup made" value={`${stats.totalSyrupGal.toFixed(2)} gal`} sub={stats.expectedSyrup > 0 ? `expected: ${stats.expectedSyrup.toFixed(2)} gal` : null} accent={palette.maple} />
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
                  if (e.action === "sap_collected") detail = `💧 ${e.gallons} gal sap`;
                  else if (e.action === "boil") detail = `🔥 ${e.sapGal} gal sap → ${e.syrupGal} gal syrup`;
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
export function MapleSyrupAnalytics({ hobby, entries }) {
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
        <StatCard label="Lifetime sap" value={`${totals.sap.toFixed(0)} gal`} accent={palette.leafSoft} />
        <StatCard label="Lifetime syrup" value={`${totals.syrup.toFixed(2)} gal`} accent={palette.maple} />
        {totals.cost > 0 && <StatCard label="Lifetime cost" value={fmtMoney(totals.cost)} accent={palette.accent} />}
        {totals.taps > 0 && <StatCard label="Most taps" value={totals.taps} sub="in a single season" accent={palette.feather} />}
      </div>

      {perSeason.length >= 2 && (
        <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 8 }}>🍁 Syrup yield by year</div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perSeason}>
                <XAxis dataKey="year" style={{ fontSize: 11 }} />
                <YAxis style={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v} gal`, "Syrup"]} />
                <Bar dataKey="syrup" fill={palette.maple} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {perSeason.length > 0 && (
        <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 10 }}>Season breakdown</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {perSeason.slice().reverse().map(s => (
              <div key={s.id} style={{ padding: "10px 12px", background: palette.bgAlt, borderRadius: 8, fontSize: 13 }}>
                <div style={{ fontWeight: 700, color: palette.ink, marginBottom: 4 }}>{s.name}</div>
                <div style={{ color: palette.inkSoft, fontSize: 12 }}>
                  {s.taps} taps · {s.sap} gal sap → {s.syrup} gal syrup
                  {s.cost > 0 && ` · ${fmtMoney(s.cost)} cost`}
                  {s.syrupPerTap > 0 && ` · ${s.syrupPerTap} gal/tap`}
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
