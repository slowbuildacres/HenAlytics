// ============================================================================
// SHEEP PAGE
// ----------------------------------------------------------------------------
// Hobby for tracking sheep: dairy, meat, wool, or mixed flocks.
//
// Data shape on the hobby:
//   hobby.subType: "milk" | "meat" | "wool" | "mixed" (default "mixed")
//   hobby.animals[] = [{ id, name, breed, birthdate, sex, role, purchaseCost,
//                        purchasedFrom, archived, archivedReason, archivedDate }]
//     role: "ewe" | "ram" | "lamb" | "wether"
//   hobby.breedings[] = [{ id, eweId, ramId, breedDate, expectedLambDate,
//                          lambedDate, lambsBorn, lambsAlive, notes }]
//   hobby.shearings[] = [{ id, date, animalId|null, woolLbs, woolGrade, notes }]
//
// Entries (data.entries["sheep"]): fed, milk, butcher, note, issue, death
//
// Sheep gestation = 145–155 days. We default expected lambing to +147 days.
// ============================================================================

import React, { useState, useMemo } from "react";
import { X, Edit3, Plus, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fmtMoney } from "./units.js";
import { SireDamPicker, PedigreeView } from "./PedigreeView.jsx";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47", featherSoft: "#C9A77B",
  line: "#2C181030", card: "#FAF5EA",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

const SHEEP_GESTATION_DAYS = 147;

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

const addDays = (dateStr, days) => {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return localDateStr(d);
};

const ageInMonths = (birthdate) => {
  if (!birthdate) return null;
  const b = parseLocalDate(birthdate);
  const now = new Date();
  return Math.floor((now - b) / (1000 * 60 * 60 * 24 * 30.44));
};

const fmtAge = (birthdate) => {
  const m = ageInMonths(birthdate);
  if (m === null) return "—";
  if (m < 12) return `${m} mo`;
  const yrs = Math.floor(m / 12);
  const remMo = m % 12;
  return remMo > 0 ? `${yrs}y ${remMo}m` : `${yrs}y`;
};

// ============ SHARED UI HELPERS ============
function Btn({ children, onClick, variant="primary", small=false, style={}, type="button", disabled=false }) {
  const styles = {
    primary: { background: palette.ink, color: palette.bg, border: `1.5px solid ${palette.ink}` },
    danger: { background: palette.accent, color: palette.bg, border: `1.5px solid ${palette.accent}` },
    ghost: { background: "transparent", color: palette.ink, border: `1.5px solid ${palette.line}` },
    accent: { background: palette.yolk, color: palette.ink, border: `1.5px solid ${palette.ink}` },
    leaf: { background: palette.leaf, color: palette.bg, border: `1.5px solid ${palette.leaf}` },
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

function StatCard({ label, value, sub, accent = palette.accent }) {
  return (
    <div style={{
      background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12,
      padding: 14, flex: "1 1 140px", minWidth: 140, boxSizing: "border-box", wordBreak: "break-word",
    }}>
      <div style={{ fontSize: 10, fontFamily: FONT_BODY, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontFamily: FONT_DISPLAY, color: accent, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4, fontFamily: FONT_BODY }}>{sub}</div>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display:"block",marginBottom:12 }}>
      <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>{label}</div>
      {children}
    </label>
  );
}

function ModalShell({ title, onClose, children, maxWidth = 460 }) {
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(44,24,16,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:palette.bg,borderRadius:16,maxWidth,width:"100%",maxHeight:"90vh",overflow:"auto",border:`2px solid ${palette.ink}`,boxShadow:`6px 8px 0 ${palette.line}` }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1.5px solid ${palette.line}`,position:"sticky",top:0,background:palette.bg,zIndex:1 }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:22,color:palette.ink }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{ background:"none",border:"none",cursor:"pointer",color:palette.ink,padding:4 }}><X size={22}/></button>
        </div>
        <div style={{ padding:20 }}>{children}</div>
      </div>
    </div>
  );
}

// ============ ANIMAL MODAL ============
function AnimalModal({ animal, animals, onSave, onDelete, onClose }) {
  const [name, setName] = useState(animal?.name || "");
  // Breed: dropdown with common sheep breeds + "Other" → free-text input.
  // We init based on whether the saved breed matches a known option.
  const SHEEP_BREEDS = ["Suffolk", "Dorset", "Katahdin", "Merino", "Hampshire", "Polypay", "Romney", "East Friesian", "Icelandic", "Other"];
  const initBreed = (animal?.breed || "").trim();
  const initIsKnown = SHEEP_BREEDS.includes(initBreed);
  const [breedSelect, setBreedSelect] = useState(initBreed && initIsKnown ? initBreed : (initBreed ? "Other" : ""));
  const [breedCustom, setBreedCustom] = useState(initBreed && !initIsKnown ? initBreed : "");
  const [birthdate, setBirthdate] = useState(animal?.birthdate || "");
  const [sex, setSex] = useState(animal?.sex || "female");
  const [role, setRole] = useState(animal?.role || "ewe");
  const [purchaseCost, setPurchaseCost] = useState(animal?.purchaseCost ? String(animal.purchaseCost) : "");
  const [purchasedFrom, setPurchasedFrom] = useState(animal?.purchasedFrom || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Push 7a — pedigree fields. Both ids and names are tracked; ids link to
  // animals in the same hobby for the family tree, names always exist as a
  // display label (even for free-text "outside" parents). Registry # and
  // registry name are both optional free-text fields.
  const [sireId, setSireId] = useState(animal?.sireId || "");
  const [sire, setSire] = useState(animal?.sire || "");
  const [damId, setDamId] = useState(animal?.damId || "");
  const [dam, setDam] = useState(animal?.dam || "");
  const [registryNumber, setRegistryNumber] = useState(animal?.registryNumber || "");
  const [registryName, setRegistryName] = useState(animal?.registryName || "");

  // Push 7a — pre-filter animals for pedigree pickers. Sheep uses `role`
  // ("ewe","ram","lamb","wether") as the canonical parent-eligibility marker
  // (vs the simpler `sex` field which is just "female"/"male"). Lambs and
  // wethers are NOT valid parents — lambs are too young, wethers are
  // castrated. The SireDamPicker also checks `eligibleSexes` against
  // `a.sex` as a safety net, so we pass female/male to match. Pre-filtering
  // by role here is what actually keeps lambs/wethers out of the dropdown.
  const damCandidates = (animals || []).filter(a => a.role === "ewe");
  const sireCandidates = (animals || []).filter(a => a.role === "ram");


  // Compute the final breed value to save: custom value if "Other" selected,
  // otherwise the dropdown selection itself (or empty string for "no breed").
  const finalBreed = breedSelect === "Other" ? breedCustom.trim() : breedSelect;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: animal?.id || newId(),
      name: name.trim(),
      breed: finalBreed,
      birthdate,
      sex,
      role,
      purchaseCost: parseFloat(purchaseCost) || 0,
      purchasedFrom: purchasedFrom.trim(),
      // Push 7a — pedigree fields. sireId/damId are null (not empty string)
      // when unset, so the SireDamPicker's "no parent" state round-trips
      // cleanly. sire/dam display names are always saved (trimmed) so the
      // tree can render even for free-text "outside" parents.
      sireId: sireId || null,
      sire: sire.trim(),
      damId: damId || null,
      dam: dam.trim(),
      registryNumber: registryNumber.trim(),
      registryName: registryName.trim(),
      archived: animal?.archived || false,
      archivedReason: animal?.archivedReason,
      archivedDate: animal?.archivedDate,
    });
    onClose();
  };

  return (
    <ModalShell title={animal ? "Edit sheep" : "Add sheep"} onClose={onClose}>
      <Field label="Name / tag">
        <input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Daisy, Tag #042" autoFocus />
      </Field>
      <Field label="Breed (optional)">
        <select style={inputStyle} value={breedSelect} onChange={e=>setBreedSelect(e.target.value)}>
          <option value="">— Select breed —</option>
          {SHEEP_BREEDS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        {breedSelect === "Other" && (
          <input
            style={{ ...inputStyle, marginTop: 8 }}
            value={breedCustom}
            onChange={e => setBreedCustom(e.target.value)}
            placeholder="Type your breed (e.g. Targhee, Jacob, Shetland)"
            autoFocus
          />
        )}
      </Field>
      <Field label="Birthdate (optional)">
        <input type="date" style={inputStyle} value={birthdate} onChange={e=>setBirthdate(e.target.value)} />
      </Field>
      <div style={{ display:"flex",gap:12 }}>
        <div style={{ flex:1 }}>
          <Field label="Sex">
            <select style={inputStyle} value={sex} onChange={e=>setSex(e.target.value)}>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Role">
            <select style={inputStyle} value={role} onChange={e=>setRole(e.target.value)}>
              <option value="ewe">Ewe (breeding female)</option>
              <option value="ram">Ram (breeding male)</option>
              <option value="lamb">Lamb (under 1yr)</option>
              <option value="wether">Wether (castrated male)</option>
            </select>
          </Field>
        </div>
      </div>
      <Field label="Purchase cost (optional)">
        <input type="number" step="0.01" style={inputStyle} value={purchaseCost} onChange={e=>setPurchaseCost(e.target.value)} placeholder="$" />
      </Field>
      <Field label="Where purchased (optional)">
        <input style={inputStyle} value={purchasedFrom} onChange={e=>setPurchasedFrom(e.target.value)} placeholder="Breeder, auction, neighbor" />
      </Field>

      {/* Push 7a — Pedigree section. All fields optional. Sire/Dam pickers
          show only ewes (for dam) and rams (for sire) — lambs and wethers
          aren't valid parents. Pre-filtering by role above means the picker's
          eligibleSexes is mostly a safety net here. Free-text fallback covers
          parents that aren't tracked in this app. The breeding records on
          this hobby are SEPARATE from pedigree — breeding tracks who was
          bred when, pedigree tracks who-came-from-who. */}
      <details style={{ marginBottom: 14 }}>
        <summary style={{ cursor:"pointer", padding:"8px 12px", background:palette.bgAlt, borderRadius:8, fontSize:13, fontWeight:600, color:palette.ink, userSelect:"none" }}>
          🧬 Pedigree & registry (optional)
        </summary>
        <div style={{ padding:"12px 4px 4px" }}>
          <SireDamPicker
            label="Dam"
            animals={damCandidates}
            eligibleSexes={["female"]}
            excludeId={animal?.id}
            selectedId={damId}
            selectedName={dam}
            onChange={({ id, name }) => { setDamId(id); setDam(name); }}
            placeholder="Type the dam's name"
          />
          <SireDamPicker
            label="Sire"
            animals={sireCandidates}
            eligibleSexes={["male"]}
            excludeId={animal?.id}
            selectedId={sireId}
            selectedName={sire}
            onChange={({ id, name }) => { setSireId(id); setSire(name); }}
            placeholder="Type the sire's name"
          />
          <Field label="Registry name (optional)">
            <input style={inputStyle} value={registryName} onChange={e=>setRegistryName(e.target.value)} placeholder="e.g. Rocky Top Daisy" />
          </Field>
          <Field label="Registry number (optional)">
            <input style={inputStyle} value={registryNumber} onChange={e=>setRegistryNumber(e.target.value)} placeholder="e.g. NSIP #ABC1234" />
          </Field>
        </div>
      </details>

      <div style={{ display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap",marginTop:8 }}>
        {animal && onDelete && (
          !confirmDelete
            ? <Btn variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Btn>
            : <Btn variant="danger" onClick={() => { onDelete(animal.id); onClose(); }}>Confirm delete</Btn>
        )}
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={!name.trim()}>Save</Btn>
      </div>
    </ModalShell>
  );
}

// ============ BREEDING / LAMBING MODAL ============
function BreedingModal({ animals, breeding, onSave, onDelete, onClose, calendarEvents, addCalendarEvent }) {
  const ewes = animals.filter(a => !a.archived && (a.role === "ewe" || a.sex === "female"));
  const rams = animals.filter(a => !a.archived && (a.role === "ram" || a.sex === "male"));

  const [eweId, setEweId] = useState(breeding?.eweId || ewes[0]?.id || "");
  const [ramId, setRamId] = useState(breeding?.ramId || rams[0]?.id || "");
  const [breedDate, setBreedDate] = useState(breeding?.breedDate || todayStr());
  const [lambedDate, setLambedDate] = useState(breeding?.lambedDate || "");
  const [lambsBorn, setLambsBorn] = useState(breeding?.lambsBorn ? String(breeding.lambsBorn) : "");
  const [lambsAlive, setLambsAlive] = useState(breeding?.lambsAlive ? String(breeding.lambsAlive) : "");
  const [notes, setNotes] = useState(breeding?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const expectedLambDate = breedDate ? addDays(breedDate, SHEEP_GESTATION_DAYS) : "";

  const handleSave = () => {
    if (!eweId || !breedDate) return;
    const id = breeding?.id || newId();
    onSave({
      id,
      eweId,
      ramId,
      breedDate,
      expectedLambDate,
      lambedDate: lambedDate || null,
      lambsBorn: parseInt(lambsBorn) || null,
      lambsAlive: parseInt(lambsAlive) || null,
      notes: notes.trim(),
    });
    // Add calendar event for expected lambing if user provided one and we have it
    if (!breeding && expectedLambDate && addCalendarEvent) {
      const eweName = animals.find(a => a.id === eweId)?.name || "ewe";
      addCalendarEvent({
        id: newId(),
        date: expectedLambDate,
        title: `🐑 Expected lambing — ${eweName}`,
        kind: "sheep_lambing",
        relatedId: id,
      });
    }
    onClose();
  };

  return (
    <ModalShell title={breeding ? "Edit breeding record" : "Log breeding"} onClose={onClose}>
      {ewes.length === 0 && (
        <div style={{ padding:12,background:palette.bgAlt,borderRadius:8,fontSize:13,color:palette.inkSoft,marginBottom:12 }}>
          You'll need at least one ewe to log a breeding. Add a sheep first.
        </div>
      )}
      <div style={{ display:"flex",gap:12 }}>
        <div style={{ flex:1 }}>
          <Field label="Ewe">
            <select style={inputStyle} value={eweId} onChange={e=>setEweId(e.target.value)}>
              {ewes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Ram (optional)">
            <select style={inputStyle} value={ramId} onChange={e=>setRamId(e.target.value)}>
              <option value="">— None / external —</option>
              {rams.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        </div>
      </div>
      <Field label="Breed date">
        <input type="date" style={inputStyle} value={breedDate} onChange={e=>setBreedDate(e.target.value)} />
      </Field>
      {breedDate && (
        <div style={{ padding:"10px 12px",background:palette.yolkSoft,borderRadius:8,fontSize:13,marginBottom:12,color:palette.ink }}>
          🐑 Expected lambing: <strong>{fmtDate(expectedLambDate)}</strong> (~147 days)
          {!breeding && <div style={{ fontSize:11,color:palette.inkSoft,marginTop:3 }}>This will be added to your calendar.</div>}
        </div>
      )}
      <hr style={{ border:"none",borderTop:`1px solid ${palette.line}`,margin:"14px 0" }} />
      <div style={{ fontSize:11,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:8 }}>
        After lambing (fill in when it happens)
      </div>
      <Field label="Lambed date">
        <input type="date" style={inputStyle} value={lambedDate} onChange={e=>setLambedDate(e.target.value)} />
      </Field>
      <div style={{ display:"flex",gap:12 }}>
        <div style={{ flex:1 }}>
          <Field label="Lambs born">
            <input type="number" min={0} style={inputStyle} value={lambsBorn} onChange={e=>setLambsBorn(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Alive at weaning">
            <input type="number" min={0} style={inputStyle} value={lambsAlive} onChange={e=>setLambsAlive(e.target.value)} placeholder="0" />
          </Field>
        </div>
      </div>
      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle,minHeight:60,resize:"vertical" }} value={notes} onChange={e=>setNotes(e.target.value)} />
      </Field>
      <div style={{ display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap" }}>
        {breeding && onDelete && (
          !confirmDelete
            ? <Btn variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Btn>
            : <Btn variant="danger" onClick={() => { onDelete(breeding.id); onClose(); }}>Confirm delete</Btn>
        )}
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={!eweId || !breedDate || ewes.length === 0}>Save</Btn>
      </div>
    </ModalShell>
  );
}

// ============ SHEARING MODAL ============
function ShearingModal({ animals, shearing, onSave, onDelete, onClose }) {
  const liveAnimals = animals.filter(a => !a.archived);
  const [date, setDate] = useState(shearing?.date || todayStr());
  const [animalId, setAnimalId] = useState(shearing?.animalId || "");
  const [woolLbs, setWoolLbs] = useState(shearing?.woolLbs ? String(shearing.woolLbs) : "");
  const [woolGrade, setWoolGrade] = useState(shearing?.woolGrade || "");
  const [notes, setNotes] = useState(shearing?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    if (!date) return;
    onSave({
      id: shearing?.id || newId(),
      date,
      animalId: animalId || null,
      woolLbs: parseFloat(woolLbs) || 0,
      woolGrade: woolGrade.trim(),
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <ModalShell title={shearing ? "Edit shearing" : "Log shearing"} onClose={onClose}>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} />
      </Field>
      <Field label="Animal (optional — leave blank for whole-flock shearing)">
        <select style={inputStyle} value={animalId} onChange={e=>setAnimalId(e.target.value)}>
          <option value="">— Whole flock —</option>
          {liveAnimals.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <div style={{ display:"flex",gap:12 }}>
        <div style={{ flex:1 }}>
          <Field label="Wool (lbs)">
            <input type="number" step="0.1" style={inputStyle} value={woolLbs} onChange={e=>setWoolLbs(e.target.value)} placeholder="0.0" />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Grade (optional)">
            <input style={inputStyle} value={woolGrade} onChange={e=>setWoolGrade(e.target.value)} placeholder="e.g. fine, medium" />
          </Field>
        </div>
      </div>
      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle,minHeight:50,resize:"vertical" }} value={notes} onChange={e=>setNotes(e.target.value)} />
      </Field>
      <div style={{ display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap" }}>
        {shearing && onDelete && (
          !confirmDelete
            ? <Btn variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Btn>
            : <Btn variant="danger" onClick={() => { onDelete(shearing.id); onClose(); }}>Confirm delete</Btn>
        )}
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave}>Save</Btn>
      </div>
    </ModalShell>
  );
}

// ============ MILK / BUTCHER LOG (write to entries) ============
function MilkLogModal({ animals, onSave, onClose }) {
  const milkers = animals.filter(a => !a.archived && (a.sex === "female" || a.role === "ewe"));
  const [date, setDate] = useState(todayStr());
  const [animalId, setAnimalId] = useState("");
  const [oz, setOz] = useState("");
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    const ozNum = parseFloat(oz);
    if (!ozNum) return;
    onSave({ id: newId(), date, action: "milk", animalId: animalId || null, oz: ozNum, notes: notes.trim(), created: Date.now() });
    onClose();
  };

  return (
    <ModalShell title="🥛 Log milk" onClose={onClose}>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} />
      </Field>
      <Field label="Animal (optional)">
        <select style={inputStyle} value={animalId} onChange={e=>setAnimalId(e.target.value)}>
          <option value="">— Whole flock —</option>
          {milkers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="Ounces">
        <input type="number" step="0.1" style={inputStyle} value={oz} onChange={e=>setOz(e.target.value)} placeholder="0" autoFocus />
      </Field>
      <Field label="Notes (optional)">
        <input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)} />
      </Field>
      <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={!parseFloat(oz)}>Save</Btn>
      </div>
    </ModalShell>
  );
}

function ButcherLogModal({ animals, onSave, onClose }) {
  const live = animals.filter(a => !a.archived);
  const [date, setDate] = useState(todayStr());
  const [animalId, setAnimalId] = useState(live[0]?.id || "");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    if (!animalId) return;
    onSave({
      entry: { id: newId(), date, action: "butcher", animalId, weight: parseFloat(weight) || 0, notes: notes.trim(), created: Date.now() },
      animalId,
    });
    onClose();
  };

  return (
    <ModalShell title="🥩 Butcher" onClose={onClose}>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} />
      </Field>
      <Field label="Sheep">
        <select style={inputStyle} value={animalId} onChange={e=>setAnimalId(e.target.value)}>
          {live.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="Hanging weight (lbs)">
        <input type="number" step="0.1" style={inputStyle} value={weight} onChange={e=>setWeight(e.target.value)} placeholder="0" />
      </Field>
      <Field label="Notes (optional)">
        <input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)} />
      </Field>
      <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" onClick={handleSave} disabled={!animalId}>Butcher</Btn>
      </div>
    </ModalShell>
  );
}

function FedLogModal({ onSave, onClose }) {
  const [date, setDate] = useState(todayStr());
  const [lbs, setLbs] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const handleSave = () => {
    onSave({ id: newId(), date, action: "fed", lbs: parseFloat(lbs)||0, cost: parseFloat(cost)||0, notes: notes.trim(), created: Date.now() });
    onClose();
  };
  return (
    <ModalShell title="🌾 Log feeding" onClose={onClose}>
      <Field label="Date"><input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} /></Field>
      <Field label="Pounds fed (optional)"><input type="number" step="0.1" style={inputStyle} value={lbs} onChange={e=>setLbs(e.target.value)} /></Field>
      <Field label="Cost (optional)"><input type="number" step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$" /></Field>
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)} /></Field>
      <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave}>Save</Btn>
      </div>
    </ModalShell>
  );
}

// ============ MAIN HOME PAGE ============
export default function SheepPage({ hobby, data, update, setModal }) {
  const [animalModal, setAnimalModal] = useState({ open: false, animal: null });
  // Push 7a — pedigree view state. The 🧬 chip on each animal row opens
  // this; jumping to an ancestor/descendant from the tree swaps the
  // animal in here without ever opening the edit modal.
  const [pedigreeAnimal, setPedigreeAnimal] = useState(null);
  const [breedingModal, setBreedingModal] = useState({ open: false, breeding: null });
  const [shearingModal, setShearingModal] = useState({ open: false, shearing: null });
  const [milkOpen, setMilkOpen] = useState(false);
  const [fedOpen, setFedOpen] = useState(false);
  const [butcherOpen, setButcherOpen] = useState(false);

  const animals = (hobby?.animals || []).filter(a => !a.archived);
  const archived = (hobby?.animals || []).filter(a => a.archived);
  const breedings = (hobby?.breedings || []).slice().sort((a,b) => (b.breedDate||"").localeCompare(a.breedDate||""));
  const shearings = (hobby?.shearings || []).slice().sort((a,b) => (b.date||"").localeCompare(a.date||""));
  const subType = hobby?.subType || "mixed";
  const showMilk = subType === "milk" || subType === "mixed";
  const showWool = subType === "wool" || subType === "mixed";

  const saveAnimal = (animal) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.animals)) h.animals = [];
      const idx = h.animals.findIndex(x => x.id === animal.id);
      if (idx >= 0) h.animals[idx] = animal; else h.animals.push(animal);
      return d;
    });
  };
  const deleteAnimal = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h) h.animals = (h.animals||[]).filter(a => a.id !== id);
      return d;
    });
  };
  const saveBreeding = (breeding) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.breedings)) h.breedings = [];
      const idx = h.breedings.findIndex(x => x.id === breeding.id);
      if (idx >= 0) h.breedings[idx] = breeding; else h.breedings.push(breeding);
      return d;
    });
  };
  const deleteBreeding = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h) h.breedings = (h.breedings||[]).filter(b => b.id !== id);
      return d;
    });
  };
  const addCalendarEvent = (event) => {
    update(d => {
      if (!Array.isArray(d.calendarEvents)) d.calendarEvents = [];
      d.calendarEvents.push(event);
      return d;
    });
  };
  const saveShearing = (shearing) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.shearings)) h.shearings = [];
      const idx = h.shearings.findIndex(x => x.id === shearing.id);
      if (idx >= 0) h.shearings[idx] = shearing; else h.shearings.push(shearing);
      return d;
    });
  };
  const deleteShearing = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h) h.shearings = (h.shearings||[]).filter(s => s.id !== id);
      return d;
    });
  };
  const addEntry = (entry) => {
    update(d => {
      if (!d.entries) d.entries = {};
      if (!Array.isArray(d.entries[hobby.id])) d.entries[hobby.id] = [];
      d.entries[hobby.id].push(entry);
      return d;
    });
  };
  const archiveAnimal = (id, reason) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      const a = (h?.animals || []).find(x => x.id === id);
      if (a) {
        a.archived = true;
        a.archivedReason = reason;
        a.archivedDate = todayStr();
      }
      return d;
    });
  };

  // Quick stats
  const ewes = animals.filter(a => a.role === "ewe").length;
  const rams = animals.filter(a => a.role === "ram").length;
  const lambs = animals.filter(a => a.role === "lamb").length;
  const upcomingLambings = breedings.filter(b => !b.lambedDate && b.expectedLambDate >= todayStr()).slice(0, 3);

  return (
    <div>
      {animalModal.open && (
        <AnimalModal
          animal={animalModal.animal}
          animals={hobby?.animals || []}
          onClose={() => setAnimalModal({ open: false, animal: null })}
          onSave={saveAnimal}
          onDelete={deleteAnimal}
        />
      )}
      {/* Push 7a — Pedigree modal. Renders above everything else (its own
          z-index 110 in PedigreeView is below SheepPage's modal z-index 200,
          but we never open pedigree at the same time as the edit modal, so
          ordering doesn't matter here). onJumpTo swaps the focused animal
          rather than stacking — tapping an ancestor closes nothing, just
          re-targets the same view. */}
      {pedigreeAnimal && (
        <PedigreeView
          animal={pedigreeAnimal}
          animals={hobby?.animals || []}
          onClose={() => setPedigreeAnimal(null)}
          onJumpTo={(id) => {
            const next = (hobby?.animals || []).find(a => a.id === id);
            if (next) setPedigreeAnimal(next);
          }}
        />
      )}
      {breedingModal.open && (
        <BreedingModal
          animals={hobby?.animals || []}
          breeding={breedingModal.breeding}
          onClose={() => setBreedingModal({ open: false, breeding: null })}
          onSave={saveBreeding}
          onDelete={deleteBreeding}
          calendarEvents={data.calendarEvents}
          addCalendarEvent={addCalendarEvent}
        />
      )}
      {shearingModal.open && (
        <ShearingModal
          animals={hobby?.animals || []}
          shearing={shearingModal.shearing}
          onClose={() => setShearingModal({ open: false, shearing: null })}
          onSave={saveShearing}
          onDelete={deleteShearing}
        />
      )}
      {milkOpen && <MilkLogModal animals={hobby?.animals || []} onSave={addEntry} onClose={() => setMilkOpen(false)} />}
      {fedOpen && <FedLogModal onSave={addEntry} onClose={() => setFedOpen(false)} />}
      {butcherOpen && (
        <ButcherLogModal
          animals={hobby?.animals || []}
          onSave={({ entry, animalId }) => {
            addEntry(entry);
            archiveAnimal(animalId, "butchered");
          }}
          onClose={() => setButcherOpen(false)}
        />
      )}

      {/* Quick stats */}
      <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:16 }}>
        <StatCard label="Ewes" value={ewes} accent={palette.leaf} />
        <StatCard label="Rams" value={rams} accent={palette.feather} />
        <StatCard label="Lambs" value={lambs} accent={palette.yolk} />
        <StatCard label="Total" value={animals.length} sub="live sheep" accent={palette.accent} />
      </div>

      {/* Sub-type picker — what kind of sheep operation */}
      <div style={{ marginBottom:16,padding:"10px 12px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:10 }}>
        <div style={{ fontSize:11,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600,marginBottom:6 }}>Operation type</div>
        <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
          {[{ k:"mixed",l:"Mixed" },{ k:"milk",l:"Dairy" },{ k:"meat",l:"Meat" },{ k:"wool",l:"Wool" }].map(o => (
            <button
              key={o.k}
              onClick={() => update(d => { const h = d.hobbies.find(x=>x.id===hobby.id); if (h) h.subType = o.k; return d; })}
              style={{
                padding:"6px 12px",borderRadius:8,
                border:`1.5px solid ${subType===o.k?palette.ink:palette.line}`,
                background:subType===o.k?palette.ink:palette.card,
                color:subType===o.k?palette.bg:palette.ink,
                fontFamily:FONT_BODY,fontSize:13,fontWeight:600,cursor:"pointer",
              }}
            >{o.l}</button>
          ))}
        </div>
      </div>

      {/* Quick action tiles */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:8,marginBottom:18 }}>
        <Btn small onClick={() => setFedOpen(true)} style={{ width:"100%" }}>🌾 Fed</Btn>
        {showMilk && <Btn small variant="leaf" onClick={() => setMilkOpen(true)} style={{ width:"100%" }}>🥛 Milk</Btn>}
        <Btn small variant="leaf" onClick={() => setBreedingModal({ open: true, breeding: null })} style={{ width:"100%" }}>🐑 Breeding</Btn>
        {showWool && <Btn small variant="accent" onClick={() => setShearingModal({ open: true, shearing: null })} style={{ width:"100%" }}>✂️ Shear</Btn>}
        <Btn small variant="danger" onClick={() => setButcherOpen(true)} style={{ width:"100%" }}>🥩 Butcher</Btn>
      </div>

      {/* Upcoming lambings banner */}
      {upcomingLambings.length > 0 && (
        <div style={{ marginBottom:16,padding:"12px 14px",background:palette.yolkSoft,borderRadius:10,border:`1.5px solid ${palette.line}` }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:16,marginBottom:6,color:palette.ink }}>🐑 Upcoming lambings</div>
          {upcomingLambings.map(b => {
            const ewe = (hobby.animals || []).find(a => a.id === b.eweId);
            const daysUntil = Math.ceil((parseLocalDate(b.expectedLambDate) - new Date()) / (1000*60*60*24));
            return (
              <div key={b.id} style={{ fontSize:13,color:palette.ink,marginTop:2 }}>
                <strong>{ewe?.name || "Ewe"}</strong> — {fmtDate(b.expectedLambDate)} ({daysUntil > 0 ? `in ${daysUntil} day${daysUntil===1?"":"s"}` : "today!"})
              </div>
            );
          })}
        </div>
      )}

      {/* Animals list */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
          <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:20,margin:0,color:palette.ink }}>Your sheep</h3>
          <Btn small onClick={() => setAnimalModal({ open: true, animal: null })}>+ Add sheep</Btn>
        </div>
        {animals.length === 0 ? (
          <div style={{ background:palette.card,border:`1.5px dashed ${palette.line}`,borderRadius:12,padding:32,textAlign:"center" }}>
            <div style={{ fontSize:32,marginBottom:8 }}>🐑</div>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,color:palette.ink,marginBottom:6 }}>No sheep yet</div>
            <div style={{ fontSize:13,color:palette.inkSoft,marginBottom:14 }}>Add your first sheep to start tracking.</div>
            <Btn variant="accent" onClick={() => setAnimalModal({ open: true, animal: null })}>+ Add your first sheep</Btn>
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {animals.map(a => {
              const roleLabel = { ewe: "Ewe", ram: "Ram", lamb: "Lamb", wether: "Wether" }[a.role] || a.role;
              return (
                <div key={a.id}
                  onClick={() => setAnimalModal({ open: true, animal: a })}
                  style={{
                    padding:"10px 12px",background:palette.card,border:`1.5px solid ${palette.line}`,
                    borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",gap:8,
                  }}
                >
                  <div style={{ minWidth:0,flex:1 }}>
                    <div style={{ fontWeight:600,fontSize:14,color:palette.ink }}>🐑 {a.name}</div>
                    <div style={{ fontSize:11,color:palette.inkSoft }}>
                      {roleLabel}{a.breed ? ` · ${a.breed}` : ""}{a.birthdate ? ` · ${fmtAge(a.birthdate)}` : ""}
                    </div>
                  </div>
                  {/* Push 7a — pedigree pill. stopPropagation keeps the row's
                      edit-on-click behavior intact for the rest of the row. */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setPedigreeAnimal(a); }}
                    aria-label={`View pedigree for ${a.name}`}
                    style={{
                      padding:"4px 8px",borderRadius:6,fontSize:11,fontWeight:600,fontFamily:FONT_BODY,
                      border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.ink,
                      flexShrink:0,
                    }}
                  >🧬 Pedigree</button>
                  <Edit3 size={14} style={{ color:palette.inkSoft,flexShrink:0 }} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Breeding records */}
      {breedings.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:18,margin:"0 0 10px",color:palette.ink }}>🐑 Breeding records</h3>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {breedings.slice(0, 6).map(b => {
              const ewe = (hobby.animals||[]).find(a => a.id === b.eweId);
              const ram = (hobby.animals||[]).find(a => a.id === b.ramId);
              return (
                <div key={b.id}
                  onClick={() => setBreedingModal({ open: true, breeding: b })}
                  style={{ padding:"10px 12px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:8,cursor:"pointer" }}
                >
                  <div style={{ fontWeight:600,fontSize:13,color:palette.ink }}>
                    {ewe?.name || "?"} {ram ? `× ${ram.name}` : ""}
                  </div>
                  <div style={{ fontSize:11,color:palette.inkSoft,marginTop:2 }}>
                    Bred {fmtDate(b.breedDate)}
                    {b.lambedDate
                      ? ` · 🎉 Lambed ${fmtDate(b.lambedDate)} (${b.lambsBorn || 0} born, ${b.lambsAlive || 0} alive)`
                      : ` · Expected ${fmtDate(b.expectedLambDate)}`
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Shearings */}
      {showWool && shearings.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:18,margin:"0 0 10px",color:palette.ink }}>✂️ Recent shearings</h3>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {shearings.slice(0, 5).map(s => {
              const a = s.animalId ? (hobby.animals||[]).find(x => x.id === s.animalId) : null;
              return (
                <div key={s.id}
                  onClick={() => setShearingModal({ open: true, shearing: s })}
                  style={{ padding:"10px 12px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:8,display:"flex",justifyContent:"space-between",cursor:"pointer" }}
                >
                  <div>
                    <div style={{ fontWeight:600,fontSize:13,color:palette.ink }}>
                      {a ? a.name : "Whole flock"}{s.woolGrade ? ` · ${s.woolGrade}` : ""}
                    </div>
                    <div style={{ fontSize:11,color:palette.inkSoft }}>{fmtDate(s.date)}</div>
                  </div>
                  <div style={{ fontWeight:700,fontSize:14,color:palette.feather,fontFamily:FONT_DISPLAY }}>
                    {s.woolLbs.toFixed(1)} lbs
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Archived animals (collapsible) */}
      {archived.length > 0 && (
        <div style={{ marginTop:16 }}>
          <details>
            <summary style={{ cursor:"pointer",color:palette.inkSoft,fontSize:13,padding:6 }}>
              Archived sheep ({archived.length})
            </summary>
            <div style={{ marginTop:8,display:"flex",flexDirection:"column",gap:4 }}>
              {archived.map(a => (
                <div key={a.id} style={{ padding:"6px 10px",background:palette.bgAlt,borderRadius:6,fontSize:12,color:palette.inkSoft }}>
                  {a.name} — {a.archivedReason || "removed"}
                  {a.archivedDate ? ` · ${fmtDate(a.archivedDate)}` : ""}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SHEEP ANALYTICS
// ============================================================================
export function SheepAnalytics({ hobby, entries = [] }) {
  if (!hobby) {
    return <div style={{ padding:40,textAlign:"center",color:palette.inkSoft }}>Loading…</div>;
  }

  const animals = hobby.animals || [];
  const liveAnimals = animals.filter(a => !a.archived);
  const breedings = hobby.breedings || [];
  const shearings = hobby.shearings || [];

  // Milk
  const milkEntries = entries.filter(e => e.action === "milk");
  const milkOz = milkEntries.reduce((s,e) => s + (Number(e.oz)||0), 0);
  const milkGal = milkOz / 128;

  // Feed
  const feedEntries = entries.filter(e => e.action === "fed");
  const feedLbs = feedEntries.reduce((s,e) => s + (Number(e.lbs)||0), 0);
  const feedCost = feedEntries.reduce((s,e) => s + (Number(e.cost)||0), 0);

  // Butcher
  const butcherEntries = entries.filter(e => e.action === "butcher");
  const totalMeatLbs = butcherEntries.reduce((s,e) => s + (Number(e.weight)||0), 0);

  // Lambing stats
  const completedLambings = breedings.filter(b => b.lambedDate);
  const totalLambsBorn = completedLambings.reduce((s,b) => s + (Number(b.lambsBorn)||0), 0);
  const totalLambsAlive = completedLambings.reduce((s,b) => s + (Number(b.lambsAlive)||0), 0);
  const lambSurvivalRate = totalLambsBorn > 0 ? (totalLambsAlive / totalLambsBorn) * 100 : 0;
  const avgLambsPerLambing = completedLambings.length > 0 ? totalLambsBorn / completedLambings.length : 0;

  // Wool
  const totalWoolLbs = shearings.reduce((s,sh) => s + (Number(sh.woolLbs)||0), 0);

  // Purchase costs
  const totalPurchaseCost = animals.reduce((s,a) => s + (Number(a.purchaseCost)||0), 0);

  const subType = hobby.subType || "mixed";

  if (animals.length === 0 && entries.length === 0) {
    return (
      <div style={{ padding:40,textAlign:"center",color:palette.inkSoft }}>
        <div style={{ fontSize:36,marginBottom:8 }}>📊</div>
        <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,color:palette.ink,marginBottom:6 }}>No sheep data yet</div>
        <div style={{ fontSize:13 }}>Add some sheep and log activity to see stats.</div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:20,margin:"0 0 12px",color:palette.ink }}>🐑 Flock totals</h3>
      <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:18 }}>
        <StatCard label="Live sheep" value={liveAnimals.length} accent={palette.leaf} />
        <StatCard label="Total invested" value={fmtMoney(totalPurchaseCost + feedCost)} sub={`${fmtMoney(feedCost)} feed`} accent={palette.feather} />
        {(subType === "milk" || subType === "mixed") && milkOz > 0 && (
          <StatCard label="Milk" value={`${milkGal.toFixed(1)} gal`} sub={`${milkOz.toFixed(0)} oz total`} accent={palette.leafSoft} />
        )}
        {(subType === "wool" || subType === "mixed") && totalWoolLbs > 0 && (
          <StatCard label="Wool" value={`${totalWoolLbs.toFixed(1)} lbs`} sub={`${shearings.length} shearings`} accent={palette.yolk} />
        )}
        {totalMeatLbs > 0 && (
          <StatCard label="Meat" value={`${totalMeatLbs.toFixed(0)} lbs`} sub={`${butcherEntries.length} butchered`} accent={palette.accent} />
        )}
      </div>

      {completedLambings.length > 0 && (
        <>
          <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:18,margin:"0 0 10px",color:palette.ink }}>🐑 Lambing</h3>
          <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:18 }}>
            <StatCard label="Lambings" value={completedLambings.length} accent={palette.leaf} />
            <StatCard label="Lambs born" value={totalLambsBorn} sub={`${avgLambsPerLambing.toFixed(1)} per ewe`} accent={palette.yolk} />
            <StatCard label="Survival rate" value={`${lambSurvivalRate.toFixed(0)}%`} sub={`${totalLambsAlive} alive`} accent={lambSurvivalRate >= 80 ? palette.leaf : palette.accent} />
          </div>
        </>
      )}

      {feedLbs > 0 && (
        <>
          <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:18,margin:"0 0 10px",color:palette.ink }}>Feed</h3>
          <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:18 }}>
            <StatCard label="Feed used" value={`${feedLbs.toFixed(0)} lbs`} accent={palette.feather} />
            <StatCard label="Feed cost" value={fmtMoney(feedCost)} accent={palette.accent} />
            {liveAnimals.length > 0 && <StatCard label="Cost / sheep" value={fmtMoney(feedCost / liveAnimals.length)} sub="lifetime" accent={palette.feather} />}
          </div>
        </>
      )}
    </div>
  );
}
