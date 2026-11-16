// ============================================================================
// Bring in old records (3.0) — Excel / Google Sheets / CSV / pasted cells
// ----------------------------------------------------------------------------
// 1 What: egg counts, garden harvests or sales
// 2 The file: pick a .xlsx or .csv, or paste cells copied from a sheet
// 3 Match: which column is the date, the eggs, the crop… (guessed for you),
//   where it goes (which flock, what was sold), and a preview
// 4 Add: one tap, with Undo for the whole batch
// ============================================================================

import React, { useMemo, useRef, useState } from "react";
import { ChevronLeft, Egg, Sprout, DollarSign, Upload, ClipboardPaste, Check, Info } from "lucide-react";
import { nl, font, type } from "../theme.js";
import { Card, CardHeader, Button, Chip } from "../ui.jsx";
import { showUndo, undoable } from "../UndoBar.jsx";
import { readFile, parseDelimited, headerRow, columnNames, guessColumns, buildRecords, KIND_FIELDS, loggedEggDays, newId } from "./importData.js";
import { fmtMoney } from "../../units.js";
import { scoreOf, noteBulkDelete } from "../../sync.js";

const KINDS = [
  { key: "eggs", label: "Egg counts", sub: "A date and how many eggs", I: Egg },
  { key: "harvest", label: "Garden harvests", sub: "A date, the crop and how much", I: Sprout },
  { key: "sales", label: "Sales", sub: "A date and how much you sold", I: DollarSign },
];
const SALE_TYPES = [
  { key: "eggs", label: "Eggs" }, { key: "garden", label: "Produce" }, { key: "honey", label: "Honey" },
  { key: "meat_chickens", label: "Meat birds" }, { key: "rabbits", label: "Rabbits" }, { key: "other", label: "Other" },
];
// Takes every record one import brought in back out, wherever it is now
// (egg logs under any hobby, garden harvests including closed seasons'
// copies, sales). Importing the same sheet twice is easy; this is the fix.
function removeImport(d, importId) {
  const before = scoreOf(d);
  const keep = (x) => !(x && x.importId === importId);
  Object.keys(d.entries || {}).forEach((k) => { if (Array.isArray(d.entries[k])) d.entries[k] = d.entries[k].filter(keep); });
  (d.hobbies || []).forEach((h) => {
    (Array.isArray(h && h.archivedSeasons) ? h.archivedSeasons : []).forEach((sn) => { if (Array.isArray(sn.finalEntries)) sn.finalEntries = sn.finalEntries.filter(keep); });
  });
  d.sales = (d.sales || []).filter(keep);
  d.imports = (d.imports || []).filter((x) => x.id !== importId);
  // Hundreds of records leaving at once is on purpose here; without this the
  // sync guard refuses the save and a refresh brings them all back.
  noteBulkDelete(d, before);
  return d;
}

const shortDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
const selStyle = () => ({ width: "100%", minHeight: 44, borderRadius: 12, border: `1.5px solid ${nl.field}`, background: nl.card, color: nl.ink, padding: "0 10px", font: `500 15px ${font.body}` });

export default function ImportScreen({ data, update, onBack, toast }) {
  const [kind, setKind] = useState(null);
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState("");
  const [pasting, setPasting] = useState(false);
  const [paste, setPaste] = useState("");
  const [err, setErr] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [cols, setCols] = useState(null);
  const [skipDupes, setSkipDupes] = useState(true);
  const [done, setDone] = useState(null);
  // A past import being taken back out: first tap asks, second does it.
  const [takeOut, setTakeOut] = useState(null);
  const fileRef = useRef(null);

  const eggHobby = (data.hobbies || []).find((h) => h && h.type === "egg_layers");
  const flocks = ((eggHobby && eggHobby.flocks) || []).filter((f) => f && !f.archived);
  const [flockId, setFlockId] = useState(flocks[0] ? flocks[0].id : "");
  const garden = (data.hobbies || []).find((h) => h && h.type === "garden");
  const [saleType, setSaleType] = useState("eggs");

  const load = (r, name) => {
    if (!r || r.length < 1) { setErr("That file looks empty."); return; }
    const hh = headerRow(r);
    setRows(r); setFileName(name); setHasHeader(hh); setCols(guessColumns(kind, r, hh)); setErr(""); setPasting(false);
  };
  const pick = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try { load(await readFile(f), f.name); } catch (x) { setErr((x && x.message) || "Couldn't read that file. Save it as .csv and try again."); }
  };
  const usePaste = () => { const r = parseDelimited(paste); if (!r.length) { setErr("Nothing to read yet. Copy the cells in your sheet, then paste them here."); return; } load(r, "Pasted cells"); };
  const toggleHeader = (v) => { setHasHeader(v); setCols(guessColumns(kind, rows, v)); };

  const names = rows ? columnNames(rows, hasHeader) : [];
  const flock = flocks.find((f) => f.id === flockId) || flocks[0];
  const seasonFor = (date) => {
    const s = garden && garden.currentSeason;
    if (!s) return null;
    const start = s.startDate || s.start || "";
    return !start || date >= start ? s.id : null;
  };
  const built = useMemo(() => {
    if (!rows || !cols || !kind) return null;
    const r = buildRecords(kind, rows, hasHeader, cols, { importId: "preview", flockId: flock && flock.id, birdType: flock && flock.birdType, seasonFor, hobbyType: saleType });
    let dupes = 0;
    if (kind === "eggs" && skipDupes && eggHobby) {
      const have = loggedEggDays(data.entries[eggHobby.id], flock && flock.id);
      const keep = r.records.filter((x) => !have.has(x.date));
      dupes = r.records.length - keep.length;
      r.records = keep;
    }
    return { ...r, dupes };
  }, [rows, cols, kind, hasHeader, flockId, saleType, skipDupes, data.entries]); // eslint-disable-line react-hooks/exhaustive-deps

  const fields = kind ? KIND_FIELDS[kind] : [];
  const missing = fields.filter((f) => f.need && (f.multi ? !(cols && cols[f.key] && cols[f.key].length) : !(cols && cols[f.key] >= 0)));
  const blocked = kind === "eggs" && !eggHobby ? "Turn on Egg Layers first (More › Hobbies)." : kind === "eggs" && !flock ? "Add a flock in Egg Layers first, so the eggs have somewhere to go." : kind === "harvest" && !garden ? "Turn on Garden first (More › Hobbies)." : null;

  const doImport = () => {
    if (!built || !built.records.length) return;
    const importId = `imp_${newId()}`;
    const recs = built.records.map((x) => ({ ...x, id: newId(), importId }));
    const n = recs.length;
    update((d) => {
      if (kind === "eggs") { d.entries[eggHobby.id] = [...(d.entries[eggHobby.id] || []), ...recs]; }
      else if (kind === "harvest") { d.entries.garden = [...(d.entries.garden || []), ...recs]; }
      else { d.sales = [...(d.sales || []), ...recs]; }
      d.imports = [...(d.imports || []), { id: importId, kind, count: n, file: fileName, at: Date.now() }];
      return d;
    });
    const undo = () => update((d) => removeImport(d, importId));
    const what = kind === "eggs" ? `${n} egg log${n === 1 ? "" : "s"}` : kind === "harvest" ? `${n} harvest${n === 1 ? "" : "s"}` : `${n} sale${n === 1 ? "" : "s"}`;
    showUndo(`Added ${what}`, () => { undo(); setDone(null); });
    setDone({ what, importId, undo });
  };

  const reset = () => { setKind(null); setRows(null); setCols(null); setDone(null); setErr(""); setPaste(""); setPasting(false); };
  const Back = (
    <div style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: -10 }}>
      <button type="button" onClick={rows && !done ? () => { setRows(null); setCols(null); } : kind && !done ? () => setKind(null) : onBack} aria-label="Back" style={{ width: 44, height: 44, border: "none", background: "none", color: nl.ink, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <ChevronLeft size={24} strokeWidth={2} />
      </button>
      <h1 style={{ margin: 0, fontFamily: font.display, fontWeight: 400, fontSize: type.title, lineHeight: 1.1 }}>Bring in old records</h1>
    </div>
  );

  if (done) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Back}
        <Card padded style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", padding: 24 }}>
          <span style={{ width: 52, height: 52, borderRadius: 26, background: nl.goodTint, color: nl.goodInk, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={28} strokeWidth={2.4} /></span>
          <div style={{ fontFamily: font.display, fontSize: 24 }}>Added {done.what}</div>
          <div style={{ fontSize: 14, color: nl.soft }}>They're in your Stats, Year in review and the Journal now.</div>
        </Card>
        <Button onClick={reset}>Bring in another file</Button>
        <Button kind="quiet" onClick={() => { done.undo(); setDone(null); if (toast) toast("Took that import back out"); }}>Undo this import</Button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Back}
      {!kind && (
        <>
          <p style={{ margin: "-4px 0 0", fontSize: 14, color: nl.soft, lineHeight: 1.45 }}>Kept records in Excel or Google Sheets before Henalytics? Bring them in so your stats go back further.</p>
          <Card>
            {KINDS.map((k, i) => (
              <button key={k.key} type="button" onClick={() => setKind(k.key)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 14px", minHeight: 60, border: "none", borderTop: i ? `1px solid ${nl.rule}` : "none", background: "transparent", color: nl.ink, textAlign: "left", font: "inherit", cursor: "pointer" }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: nl.chip, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><k.I size={20} strokeWidth={1.8} /></span>
                <span style={{ flex: 1 }}><span style={{ display: "block", fontWeight: 600, fontSize: 15 }}>{k.label}</span><span style={{ display: "block", fontSize: 13, color: nl.soft }}>{k.sub}</span></span>
              </button>
            ))}
          </Card>
          {(data.imports || []).length > 0 && (
            <Card>
              <CardHeader title="Brought in before" />
              {(data.imports || []).slice().reverse().slice(0, 5).map((x) => (
                <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 6px 6px 14px", borderTop: `1px solid ${nl.rule}`, fontSize: 14 }}>
                  <span style={{ flex: 1 }}>{x.count} {x.kind === "eggs" ? "egg logs" : x.kind === "harvest" ? "harvests" : "sales"}<span style={{ color: nl.soft }}> · {x.file} · {new Date(x.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></span>
                  <button type="button" onClick={() => {
                    if (takeOut !== x.id) { setTakeOut(x.id); return; }
                    setTakeOut(null);
                    undoable(update, `Took out ${x.count} ${x.kind === "eggs" ? "egg logs" : x.kind === "harvest" ? "harvests" : "sales"}`)((d) => removeImport(d, x.id));
                  }} style={{ minHeight: 44, padding: "0 10px", border: "none", background: "none", color: takeOut === x.id ? nl.alert : nl.soft, fontWeight: takeOut === x.id ? 700 : 500, font: "inherit", fontSize: 13, cursor: "pointer" }}>{takeOut === x.id ? "Tap again to take out" : "Take these out"}</button>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {kind && !rows && (
        <>
          <div style={{ fontFamily: font.display, fontSize: 21 }}>{KINDS.find((k) => k.key === kind).label}</div>
          {blocked ? <Card padded style={{ fontSize: 14 }}>{blocked}</Card> : (
            <>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.txt,.tsv,text/csv" onChange={pick} style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />
              <Button icon={<Upload size={20} strokeWidth={2} />} onClick={() => fileRef.current && fileRef.current.click()}>Pick a file (.xlsx or .csv)</Button>
              <Button kind="quiet" icon={<ClipboardPaste size={20} strokeWidth={2} />} onClick={() => setPasting((v) => !v)}>Paste from a spreadsheet</Button>
              {pasting && (
                <Card padded style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label htmlFor="imp-paste" style={{ fontSize: 13, color: nl.soft }}>In your sheet, select the cells (headings too), copy, and paste here.</label>
                  <textarea id="imp-paste" rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} style={{ ...selStyle(), minHeight: 120, padding: 10, fontFamily: "ui-monospace, monospace", fontSize: 13 }} />
                  <Button small kind="dark" onClick={usePaste}>Use these cells</Button>
                </Card>
              )}
              {err && <div role="alert" style={{ fontSize: 14, color: nl.alertInk }}>{err}</div>}
              <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 16, background: nl.yolkTint, color: nl.yolkInk, fontSize: 13, lineHeight: 1.45 }}>
                <Info size={18} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                <div>Google Sheets: File › Download › Comma-separated values (.csv), or just copy and paste the cells. Each row needs a date; {kind === "eggs" ? "one or more columns of egg counts" : kind === "harvest" ? "a crop and an amount" : "a dollar amount"}.</div>
              </div>
            </>
          )}
        </>
      )}

      {kind && rows && cols && (
        <>
          <div style={{ fontSize: 13, color: nl.soft, marginTop: -4 }}>{fileName} · {rows.length - (hasHeader ? 1 : 0)} rows</div>
          <Card padded style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontFamily: font.display, fontSize: 20 }}>Match your columns</div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, minHeight: 36 }}>
              <input type="checkbox" checked={hasHeader} onChange={(e) => toggleHeader(e.target.checked)} style={{ width: 20, height: 20, accentColor: nl.good }} />
              The first row is headings
            </label>
            {fields.map((f) => (
              <div key={f.key}>
                <div style={{ fontSize: 13, fontWeight: 600, color: nl.soft, marginBottom: 6 }}>{f.label}{f.need ? "" : " (optional)"}</div>
                {f.multi ? (
                  <div role="group" aria-label={f.label} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {names.map((n, i) => i === cols.date || i === cols.note ? null : (
                      <Chip key={i} selected={(cols[f.key] || []).includes(i)} onClick={() => setCols((c) => ({ ...c, [f.key]: (c[f.key] || []).includes(i) ? c[f.key].filter((x) => x !== i) : [...(c[f.key] || []), i] }))}>{n}</Chip>
                    ))}
                  </div>
                ) : (
                  <select aria-label={f.label} style={selStyle()} value={cols[f.key]} onChange={(e) => setCols((c) => ({ ...c, [f.key]: Number(e.target.value) }))}>
                    <option value={-1}>{f.need ? "Pick a column" : "None"}</option>
                    {names.map((n, i) => <option key={i} value={i}>{n}</option>)}
                  </select>
                )}
                {f.multi && <div style={{ fontSize: 12, color: nl.soft, marginTop: 4 }}>A column for each flock? Pick them all and they're added together.</div>}
              </div>
            ))}
          </Card>

          <Card padded style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontFamily: font.display, fontSize: 20 }}>Where it goes</div>
            {kind === "eggs" && (
              <>
                {flocks.length > 1 ? (
                  <select aria-label="Flock" style={selStyle()} value={flockId} onChange={(e) => setFlockId(e.target.value)}>{flocks.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
                ) : <div style={{ fontSize: 14 }}>Into {flock ? flock.name : "your flock"}</div>}
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, minHeight: 36 }}>
                  <input type="checkbox" checked={skipDupes} onChange={(e) => setSkipDupes(e.target.checked)} style={{ width: 20, height: 20, accentColor: nl.good }} />
                  Skip days that already have eggs logged
                </label>
              </>
            )}
            {kind === "harvest" && <div style={{ fontSize: 14 }}>Into your garden. Harvests from before this season count toward the year they were picked.</div>}
            {kind === "sales" && (
              <>
                <div style={{ fontSize: 13, color: nl.soft }}>What did you sell?</div>
                <div role="radiogroup" aria-label="What did you sell" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {SALE_TYPES.map((t) => <Chip key={t.key} selected={saleType === t.key} onClick={() => setSaleType(t.key)}>{t.label}</Chip>)}
                </div>
              </>
            )}
          </Card>

          {built && (
            <Card>
              <CardHeader title="Preview" right={`${built.records.length} to add`} />
              {built.records.slice(0, 6).map((r) => (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 14px", borderTop: `1px solid ${nl.rule}`, fontSize: 14 }}>
                  <span style={{ color: nl.soft, flexShrink: 0 }}>{shortDate(r.date)}</span>
                  <span style={{ fontWeight: 600, textAlign: "right", overflowWrap: "anywhere" }}>
                    {kind === "eggs" ? `${r.count} eggs` : kind === "harvest" ? `${r.quantity} ${r.unit} ${r.plant}` : `${fmtMoney(r.totalRevenue)}${r.crop || r.item ? ` · ${r.crop || r.item}` : ""}`}
                  </span>
                </div>
              ))}
              {(built.skipped > 0 || built.dupes > 0) && (
                <div style={{ padding: "8px 14px 12px", borderTop: `1px solid ${nl.rule}`, fontSize: 13, color: nl.soft }}>
                  {[built.skipped ? `${built.skipped} row${built.skipped === 1 ? "" : "s"} skipped (no date or no number)` : null, built.dupes ? `${built.dupes} day${built.dupes === 1 ? "" : "s"} already logged` : null].filter(Boolean).join(" · ")}
                </div>
              )}
            </Card>
          )}
          {missing.length > 0 && <div style={{ fontSize: 14, color: nl.alertInk }}>Pick a column for {missing.map((f) => f.label.toLowerCase()).join(" and ")}.</div>}
          <Button onClick={doImport} disabled={!!missing.length || !built || !built.records.length}>
            {built && built.records.length ? `Add ${built.records.length} ${kind === "eggs" ? "egg logs" : kind === "harvest" ? "harvests" : "sales"}` : "Nothing to add yet"}
          </Button>
        </>
      )}
    </div>
  );
}
