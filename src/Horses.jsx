// ============================================================================
// HORSES PAGE
// ----------------------------------------------------------------------------
// Mixed-purpose horse hobby. Tracks individual horses with breeding (mares +
// stallions, 11-month gestation), foaling, plus care logs that horse owners
// actually care about: farrier visits, vet visits, deworming, training rides.
//
// Data shape on the hobby:
//   hobby.animals[]    = [{ id, name, breed, birthdate, sex, role, purchaseCost,
//                            purchasedFrom, color, height, archived, archivedReason }]
//   hobby.breedings[]  = [{ id, mareId, stallionId, bredDate, expectedFoalDate,
//                            foaledDate, foalsBorn, foalsAlive, notes }]
//   hobby.farrier[]    = [{ id, date, horseId, type, cost, notes }]
//   hobby.vet[]        = [{ id, date, horseId, type, cost, vetName, notes }]
//   hobby.deworming[]  = [{ id, date, horseId, product, cost, notes }]
//   hobby.rides[]      = [{ id, date, horseId, durationMinutes, type, notes }]
//
// Sales: writes to data.sales[] with hobbyType: "horse", crop: horse name.
// ============================================================================

import React, { useState, useEffect } from "react";
import { X, Edit3 } from "lucide-react";
import { fmtMoney } from "./units.js";
import { SireDamPicker, PedigreeView } from "./PedigreeView.jsx";
import { AnimalHistoryView } from "./AnimalHistoryView.jsx";
import { profilePhotoOf, timelineOf, addPhotoToAnimal, removePhotoFromAnimal, withProfileSet, withPhotoEdited, resolveAnimalPhotoUrl } from "./animalPhotos.js";
// ADV_ANALYTICS: shared advanced-analytics layer (see analytics.js).
import {
  priorDateRange, computeDelta, StatTrend, personalRecord,
  monthlySeries, LockedStatOverlay,
} from "./analytics.js";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47", featherSoft: "#C9A77B",
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
// Resolves a hobby-page sale to a Sales-tab customer (data.customers[]).
// If the sale already has a buyerId (picked from the dropdown) this is a
// no-op. Otherwise, if it carries a non-empty `buyer` name, find a
// case-insensitive match or create a new customer record, then stamp
// sale.buyerId so the Sales tab links the sale and rolls up the spend.
// No-op when buyer is blank — keeps the buyer field genuinely optional.
const resolveSaleBuyer = (d, sale) => {
  if (!sale) return;
  if (sale.buyerId) return;
  const name = (sale.buyer != null) ? String(sale.buyer).trim() : "";
  if (!name) return;
  d.customers = d.customers || [];
  let c = d.customers.find(x => (x.name || "").trim().toLowerCase() === name.toLowerCase());
  if (!c) { c = { id: newId(), name, note: "" }; d.customers.push(c); }
  sale.buyerId = c.id;
};
const localDateStr = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const todayStr = () => localDateStr(new Date());
const parseLocalDate = (s) => { if (!s) return new Date(); const [y,m,d] = s.split("-").map(Number); return new Date(y,(m||1)-1,d||1); };
const fmtDate = (s) => { if (!s) return ""; return parseLocalDate(s).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); };
const ageYears = (birthdate) => {
  if (!birthdate) return null;
  const b = parseLocalDate(birthdate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
};

// Common horse breeds — picked from frequently-tracked US homestead breeds.
// "Other" lets users type in any breed not on the list (Friesian, Andalusian, etc.)
const HORSE_BREEDS = [
  "Quarter Horse", "Thoroughbred", "Arabian", "Appaloosa",
  "Paint", "Tennessee Walker", "Warmblood", "Sport horse",
  "Draft type", "Miniature", "Pony", "Other",
];

// 11 months ≈ 340 days for horse gestation (340-345 is the typical range)
const HORSE_GESTATION_DAYS = 340;

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

// ============ HORSE MODAL ============
// ============================================================================
// ANIMAL PHOTOS — profile pic + dated timeline, per individual animal
// ----------------------------------------------------------------------------
// Uploads go through the shared Supabase Storage helpers (animalPhotos.js,
// which wraps sync.js). Photos are stored as paths on animal.photos; the
// images themselves live in the `photos` storage bucket, never in the data
// blob. Each photo write happens immediately via update() — it does NOT wait
// for the modal's Save button — so a photo can't be lost by closing without
// saving. For that reason the section only appears on an already-saved
// animal (a brand-new unsaved animal has no record to attach a photo to yet).
// ============================================================================

// Resolves a storage path to a signed URL on mount and renders the thumbnail.
// Signed URLs are short-lived, so we resolve fresh each time the component
// mounts rather than caching a URL in the data.
function PhotoThumb({ path, size = 64, onClick }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    resolveAnimalPhotoUrl(path).then((u) => {
      if (cancelled) return;
      if (u) setUrl(u); else setFailed(true);
    });
    return () => { cancelled = true; };
  }, [path]);
  return (
    <div
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius: 8, flexShrink: 0,
        border: `1.5px solid ${palette.line}`, background: palette.bgAlt,
        backgroundImage: url ? `url(${url})` : "none",
        backgroundSize: "cover", backgroundPosition: "center",
        cursor: onClick ? "pointer" : "default",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, color: palette.inkSoft, textAlign: "center", overflow: "hidden",
      }}
    >
      {!url && (failed ? "image\nunavailable" : "…")}
    </div>
  );
}

function AnimalPhotoSection({ animal, hobbyId, update, user }) {
  const photos = timelineOf(animal);          // chronological, oldest first
  const profile = profilePhotoOf(animal);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // findAnimal locates the live animal object inside an update() draft.
  const findAnimal = (d) => {
    const h = d.hobbies.find((x) => x.id === hobbyId);
    return h ? (h.animals || []).find((a) => a.id === animal.id) : null;
  };

  const onPick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // reset so the same file can be re-picked later
    if (!file) return;
    if (!user) { setErr("You must be signed in to add photos."); return; }
    setErr("");
    setBusy(true);
    try {
      await addPhotoToAnimal({ user, animalId: animal.id, file, update, findAnimal });
    } catch (e2) {
      // Upload failed — surface it. Given the known refresh-token bug, a
      // silent failure here would be the worst outcome, so we show it.
      setErr("Photo upload failed. Check your connection and that you're signed in, then try again.");
    } finally {
      setBusy(false);
    }
  };

  const removeOne = async (path) => {
    setErr("");
    try {
      await removePhotoFromAnimal({ path, update, findAnimal });
    } catch (e2) {
      setErr("Could not remove photo.");
    }
  };

  const makeProfile = (path) => {
    update((d) => {
      const a = findAnimal(d);
      if (a) a.photos = withProfileSet(a, path);
      return d;
    });
  };

  const editDate = (path, date) => {
    update((d) => {
      const a = findAnimal(d);
      if (a) a.photos = withPhotoEdited(a, path, { date });
      return d;
    });
  };

  return (
    <div style={{ marginBottom: 14, padding: 12, background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 10 }}>
      <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, marginBottom: 8 }}>
        Photos {photos.length > 0 ? `· ${photos.length}` : ""}
      </div>

      {photos.length === 0 && (
        <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 8, lineHeight: 1.5 }}>
          Add a profile photo, then keep adding over time — the journal shows them as a timeline so you can see how this goat has grown.
        </div>
      )}

      {/* Timeline — oldest first. Each photo shows its date and quick actions. */}
      {photos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
          {photos.map((p) => {
            const isProfile = profile && profile.path === p.path;
            return (
              <div key={p.path} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <PhotoThumb path={p.path} size={56} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    type="date" style={{ ...inputStyle, padding: "6px 8px", fontSize: 13 }}
                    value={p.date || ""}
                    onChange={(e) => editDate(p.path, e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    {isProfile ? (
                      <span style={{ fontSize: 11, color: palette.leaf, fontWeight: 600 }}>★ Profile photo</span>
                    ) : (
                      <button onClick={() => makeProfile(p.path)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: palette.inkSoft, textDecoration: "underline" }}>
                        Set as profile
                      </button>
                    )}
                    <button onClick={() => removeOne(p.path)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: palette.accent, textDecoration: "underline" }}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {err && <div style={{ fontSize: 12, color: palette.accent, marginBottom: 8 }}>{err}</div>}

      <label style={{
        display: "inline-block", padding: "8px 14px", borderRadius: 8,
        background: busy ? palette.bgAlt : palette.yolk,
        border: `1.5px solid ${palette.ink}`, cursor: busy ? "default" : "pointer",
        fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13, color: palette.ink,
      }}>
        {busy ? "Uploading…" : (photos.length === 0 ? "+ Add photo" : "+ Add another photo")}
        <input type="file" accept="image/*" onChange={onPick} disabled={busy} style={{ display: "none" }} />
      </label>
    </div>
  );
}

// Small profile photo for the animal-card header. Falls back to the given
// emoji when the animal has no photos yet.
function LivestockProfileCircle({animal,emoji,size=20}){
  const profile=profilePhotoOf(animal);
  const[url,setUrl]=useState(null);
  useEffect(()=>{
    let cancelled=false;
    if(!profile){setUrl(null);return;}
    resolveAnimalPhotoUrl(profile.path).then(u=>{if(!cancelled)setUrl(u||null);});
    return()=>{cancelled=true;};
  },[profile&&profile.path]);
  if(!profile||!url){
    return <span style={{fontSize:18}}>{emoji}</span>;
  }
  return <span style={{
    display:"inline-block",width:size,height:size,borderRadius:"50%",
    flexShrink:0,border:`1.5px solid ${palette.line}`,background:palette.bgAlt,
    backgroundImage:`url(${url})`,backgroundSize:"cover",backgroundPosition:"center",
  }}/>;
}

function HorseModal({ horse, horses, onSave, onDelete, onClose, update, user, hobbyId }) {
  const [name, setName] = useState(horse?.name || "");
  // Breed: dropdown + "Other" custom option. Init from saved value.
  const initBreed = (horse?.breed || "").trim();
  const initIsKnown = HORSE_BREEDS.includes(initBreed);
  const [breedSelect, setBreedSelect] = useState(initBreed && initIsKnown ? initBreed : (initBreed ? "Other" : ""));
  const [breedCustom, setBreedCustom] = useState(initBreed && !initIsKnown ? initBreed : "");
  const [color, setColor] = useState(horse?.color || "");
  const [birthdate, setBirthdate] = useState(horse?.birthdate || "");
  const [sex, setSex] = useState(horse?.sex || "mare");
  const [role, setRole] = useState(horse?.role || "riding");
  const [purchaseCost, setPurchaseCost] = useState(horse?.purchaseCost ? String(horse.purchaseCost) : "");
  const [purchasedFrom, setPurchasedFrom] = useState(horse?.purchasedFrom || "");
  const [notes, setNotes] = useState(horse?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Push 7a — pedigree fields. ids link to other horses in this hobby for
  // the family tree; names always exist as a display label (even for
  // free-text "outside" parents the user never added to the app).
  const [sireId, setSireId] = useState(horse?.sireId || "");
  const [sire, setSire] = useState(horse?.sire || "");
  const [damId, setDamId] = useState(horse?.damId || "");
  const [dam, setDam] = useState(horse?.dam || "");
  const [registryNumber, setRegistryNumber] = useState(horse?.registryNumber || "");
  const [registryName, setRegistryName] = useState(horse?.registryName || "");

  const finalBreed = breedSelect === "Other" ? breedCustom.trim() : breedSelect;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: horse?.id || newId(),
      name: name.trim(),
      breed: finalBreed,
      color: color.trim(),
      birthdate, sex, role,
      purchaseCost: parseFloat(purchaseCost) || 0,
      purchasedFrom: purchasedFrom.trim(),
      notes: notes.trim(),
      // Push 7a — pedigree fields. sireId/damId null (not empty string) when
      // unset; sire/dam display names always saved (trimmed) so the family
      // tree can render names even for "outside" parents that aren't in the
      // app. These are SEPARATE from the breeding records (mareId/stallionId
      // on hobby.breedings[]) — those track when a horse was bred, this
      // tracks parentage.
      sireId: sireId || null,
      sire: sire.trim(),
      damId: damId || null,
      dam: dam.trim(),
      registryNumber: registryNumber.trim(),
      registryName: registryName.trim(),
      photos: horse?.photos || [],
      archived: horse?.archived || false,
      archivedReason: horse?.archivedReason,
      archivedDate: horse?.archivedDate,
    });
    onClose();
  };

  return (
    <ModalShell title={horse ? "Edit horse" : "Add horse"} onClose={onClose}>
      <Field label="Name">
        <input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Thunder, Buttercup" autoFocus />
      </Field>
      <Field label="Breed (optional)">
        <select style={inputStyle} value={breedSelect} onChange={e=>setBreedSelect(e.target.value)}>
          <option value="">— Select breed —</option>
          {HORSE_BREEDS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        {breedSelect === "Other" && (
          <input
            style={{ ...inputStyle, marginTop: 8 }}
            value={breedCustom}
            onChange={e => setBreedCustom(e.target.value)}
            placeholder="Type your breed (e.g. Friesian, Andalusian, Mustang)"
            autoFocus
          />
        )}
      </Field>
      <div style={{ display:"flex",gap:12 }}>
        <div style={{ flex:1 }}>
          <Field label="Color (optional)">
            <input style={inputStyle} value={color} onChange={e=>setColor(e.target.value)} placeholder="Bay, chestnut, palomino..." />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Birthdate (optional)">
            <input type="date" style={inputStyle} value={birthdate} onChange={e=>setBirthdate(e.target.value)} />
          </Field>
        </div>
      </div>
      <div style={{ display:"flex",gap:12 }}>
        <div style={{ flex:1 }}>
          <Field label="Sex">
            <select style={inputStyle} value={sex} onChange={e=>setSex(e.target.value)}>
              <option value="mare">Mare (female)</option>
              <option value="stallion">Stallion (intact male)</option>
              <option value="gelding">Gelding (castrated male)</option>
              <option value="foal">Foal (under 1yr)</option>
            </select>
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Role">
            <select style={inputStyle} value={role} onChange={e=>setRole(e.target.value)}>
              <option value="riding">Riding</option>
              <option value="breeding">Breeding</option>
              <option value="work">Work/draft</option>
              <option value="driving">Driving</option>
              <option value="show">Show</option>
              <option value="companion">Companion</option>
              <option value="retired">Retired</option>
            </select>
          </Field>
        </div>
      </div>
      <div style={{ display:"flex",gap:12 }}>
        <div style={{ flex:1 }}>
          <Field label="Purchase cost (optional)">
            <input type="number" step="0.01" style={inputStyle} value={purchaseCost} onChange={e=>setPurchaseCost(e.target.value)} placeholder="$" />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Where from (optional)">
            <input style={inputStyle} value={purchasedFrom} onChange={e=>setPurchasedFrom(e.target.value)} placeholder="Breeder, auction..." />
          </Field>
        </div>
      </div>
      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle,minHeight:60,resize:"vertical" }} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Markings, temperament, special needs..." />
      </Field>

      {/* Push 7a — Pedigree section. All fields optional. Sire/Dam pickers
          show only opposite-sex eligible horses: mares for dam, stallions
          for sire. Geldings (castrated males) and foals (under 1yr) are NOT
          valid parents and won't appear in either picker — eligibleSexes
          enforces this. The breeding records on this hobby are SEPARATE
          from pedigree — breeding tracks who was bred when, pedigree
          tracks who-came-from-who. */}
      <details style={{ marginBottom: 14 }}>
        <summary style={{ cursor:"pointer", padding:"8px 12px", background:palette.bgAlt, borderRadius:8, fontSize:13, fontWeight:600, color:palette.ink, userSelect:"none" }}>
          🧬 Pedigree & registry (optional)
        </summary>
        <div style={{ padding:"12px 4px 4px" }}>
          <SireDamPicker
            label="Dam"
            animals={horses || []}
            eligibleSexes={["mare"]}
            excludeId={horse?.id}
            selectedId={damId}
            selectedName={dam}
            onChange={({ id, name }) => { setDamId(id); setDam(name); }}
            placeholder="Type the dam's name"
          />
          <SireDamPicker
            label="Sire"
            animals={horses || []}
            eligibleSexes={["stallion"]}
            excludeId={horse?.id}
            selectedId={sireId}
            selectedName={sire}
            onChange={({ id, name }) => { setSireId(id); setSire(name); }}
            placeholder="Type the sire's name"
          />
          <Field label="Registry name (optional)">
            <input style={inputStyle} value={registryName} onChange={e=>setRegistryName(e.target.value)} placeholder="e.g. Silver Lining's Thunder" />
          </Field>
          <Field label="Registry number (optional)">
            <input style={inputStyle} value={registryNumber} onChange={e=>setRegistryNumber(e.target.value)} placeholder="e.g. AQHA #5123456" />
          </Field>
        </div>
      </details>

      <div style={{ display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap",marginTop:8 }}>
        {horse && onDelete && (
          !confirmDelete
            ? <Btn variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Btn>
            : <Btn variant="danger" onClick={() => { onDelete(horse.id); onClose(); }}>Confirm delete</Btn>
        )}
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={!name.trim()}>Save</Btn>
      </div>
      {horse && update && (
        <AnimalPhotoSection animal={horse} hobbyId={hobbyId} update={update} user={user} />
      )}
    </ModalShell>
  );
}

// ============ BREEDING MODAL ============
function BreedingModal({ horses, breeding, onSave, onDelete, onClose, calendarEvents, addCalendarEvent }) {
  const mares = horses.filter(h => !h.archived && (h.role === "breeding" || h.sex === "mare"));
  const stallions = horses.filter(h => !h.archived && (h.role === "breeding" || h.sex === "stallion"));

  const [mareId, setMareId] = useState(breeding?.mareId || mares[0]?.id || "");
  const [stallionId, setStallionId] = useState(breeding?.stallionId || stallions[0]?.id || "");
  const [bredDate, setBredDate] = useState(breeding?.bredDate || todayStr());
  const [foaledDate, setFoaledDate] = useState(breeding?.foaledDate || "");
  const [foalsBorn, setFoalsBorn] = useState(breeding?.foalsBorn ? String(breeding.foalsBorn) : "1");
  const [foalsAlive, setFoalsAlive] = useState(breeding?.foalsAlive ? String(breeding.foalsAlive) : "");
  const [notes, setNotes] = useState(breeding?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Auto-compute expected foaling date from bred date
  const expectedFoalDate = bredDate ? (() => {
    const d = parseLocalDate(bredDate);
    d.setDate(d.getDate() + HORSE_GESTATION_DAYS);
    return localDateStr(d);
  })() : "";

  const handleSave = () => {
    if (!mareId) return;
    const record = {
      id: breeding?.id || newId(),
      mareId, stallionId,
      bredDate, expectedFoalDate,
      foaledDate,
      foalsBorn: parseInt(foalsBorn) || 0,
      foalsAlive: foaledDate ? (parseInt(foalsAlive) || parseInt(foalsBorn) || 0) : 0,
      notes: notes.trim(),
    };
    onSave(record);

    // If this is a NEW breeding (no foaling date yet), add a calendar event
    // for the expected foaling date so owners have a reminder.
    if (!breeding && !foaledDate && expectedFoalDate && addCalendarEvent) {
      const mareName = horses.find(h => h.id === mareId)?.name || "mare";
      addCalendarEvent({
        id: newId(),
        date: expectedFoalDate,
        title: `🐴 Expected foaling: ${mareName}`,
        type: "horse_foaling",
        notes: `From breeding logged ${bredDate}`,
      });
    }
    onClose();
  };

  return (
    <ModalShell title={breeding ? "Edit breeding" : "Log breeding"} onClose={onClose}>
      <Field label="Mare (dam)">
        <select style={inputStyle} value={mareId} onChange={e=>setMareId(e.target.value)}>
          <option value="">— Select mare —</option>
          {mares.map(m => <option key={m.id} value={m.id}>{m.name}{m.breed ? ` (${m.breed})` : ""}</option>)}
        </select>
      </Field>
      <Field label="Stallion (sire, optional)">
        <select style={inputStyle} value={stallionId} onChange={e=>setStallionId(e.target.value)}>
          <option value="">— Outside stallion / unknown —</option>
          {stallions.map(s => <option key={s.id} value={s.id}>{s.name}{s.breed ? ` (${s.breed})` : ""}</option>)}
        </select>
      </Field>
      <Field label="Bred date">
        <input type="date" style={inputStyle} value={bredDate} onChange={e=>setBredDate(e.target.value)} />
      </Field>
      {expectedFoalDate && !foaledDate && (
        <div style={{ padding:"10px 12px",background:palette.bgAlt,borderRadius:8,fontSize:12,color:palette.inkSoft,marginBottom:12,lineHeight:1.5 }}>
          📅 Expected foaling: <strong style={{ color:palette.ink }}>{fmtDate(expectedFoalDate)}</strong> (~340 days). A calendar reminder will be added.
        </div>
      )}
      <Field label="Foaled date (leave blank if not yet foaled)">
        <input type="date" style={inputStyle} value={foaledDate} onChange={e=>setFoaledDate(e.target.value)} />
      </Field>
      {foaledDate && (
        <div style={{ display:"flex",gap:12 }}>
          <div style={{ flex:1 }}>
            <Field label="Foals born">
              <input type="number" min={0} style={inputStyle} value={foalsBorn} onChange={e=>setFoalsBorn(e.target.value)} />
            </Field>
          </div>
          <div style={{ flex:1 }}>
            <Field label="Foals alive">
              <input type="number" min={0} style={inputStyle} value={foalsAlive} onChange={e=>setFoalsAlive(e.target.value)} placeholder={foalsBorn} />
            </Field>
          </div>
        </div>
      )}
      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle,minHeight:50,resize:"vertical" }} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="AI vs live cover, vet observations, foal markings..." />
      </Field>
      <div style={{ display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap",marginTop:8 }}>
        {breeding && onDelete && (
          !confirmDelete
            ? <Btn variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Btn>
            : <Btn variant="danger" onClick={() => { onDelete(breeding.id); onClose(); }}>Confirm delete</Btn>
        )}
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={!mareId}>Save</Btn>
      </div>
    </ModalShell>
  );
}

// ============ CARE LOG MODAL (farrier / vet / deworming) ============
function CareLogModal({ kind, horses, log, onSave, onDelete, onClose }) {
  const liveHorses = horses.filter(h => !h.archived);
  // Multi-select: a single visit can apply to one horse or many.
  // - When editing an old log, prefer log.horseIds (new shape); fall back to
  //   [log.horseId] (legacy single-horse shape) so existing data still loads
  // - When creating new, default to the first horse selected
  const initialIds = log
    ? (Array.isArray(log.horseIds) && log.horseIds.length ? log.horseIds
       : log.horseId ? [log.horseId] : [])
    : (liveHorses[0] ? [liveHorses[0].id] : []);
  const [selectedIds, setSelectedIds] = useState(initialIds);
  const [date, setDate] = useState(log?.date || todayStr());
  const [type, setType] = useState(log?.type || (kind === "farrier" ? "Trim" : kind === "vet" ? "Routine checkup" : ""));
  const [product, setProduct] = useState(log?.product || "");
  const [cost, setCost] = useState(log?.cost ? String(log.cost) : "");
  const [vetName, setVetName] = useState(log?.vetName || "");
  const [notes, setNotes] = useState(log?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const FARRIER_TYPES = ["Trim", "Trim + reset shoes", "New shoes", "Pull shoes", "Therapeutic shoeing"];
  const VET_TYPES = ["Routine checkup", "Vaccinations", "Dental (float)", "Lameness exam", "Coggins test", "Emergency", "Other"];

  const allSelected = selectedIds.length === liveHorses.length && liveHorses.length > 0;
  const toggleHorse = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : liveHorses.map(h => h.id));
  };

  const handleSave = () => {
    if (selectedIds.length === 0 || !date) return;
    // Save horseIds (array) as the canonical field. Also write horseId
    // (singular = first id) so any legacy filter code that hasn't been
    // updated yet still sees the visit on at least one animal's history.
    // The history view checks both fields and de-duplicates.
    const record = {
      id: log?.id || newId(),
      date,
      horseIds: [...selectedIds],
      horseId: selectedIds[0],
      cost: parseFloat(cost) || 0,
      notes: notes.trim(),
    };
    if (kind === "farrier") record.type = type;
    if (kind === "vet") { record.type = type; record.vetName = vetName.trim(); }
    if (kind === "deworming") record.product = product.trim();
    onSave(kind, record);
    onClose();
  };

  const title = kind === "farrier" ? "Farrier visit" : kind === "vet" ? "Vet visit" : "Deworming";

  return (
    <ModalShell title={log ? `Edit ${title.toLowerCase()}` : `Log ${title.toLowerCase()}`} onClose={onClose}>
      <Field label={`Horse${selectedIds.length > 1 ? "s" : ""} (${selectedIds.length} selected)`}>
        <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:6 }}>
          {liveHorses.length > 1 && (
            <button
              type="button"
              onClick={toggleAll}
              style={{
                padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,
                border:`1.5px solid ${palette.ink}`,
                background: allSelected ? palette.ink : palette.bgAlt,
                color: allSelected ? palette.bg : palette.ink,
                cursor:"pointer",
              }}
            >{allSelected ? "✓ All horses" : "Select all"}</button>
          )}
          {liveHorses.map(h => {
            const on = selectedIds.includes(h.id);
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => toggleHorse(h.id)}
                style={{
                  padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,
                  border: on ? `1.5px solid ${palette.ink}` : `1.5px solid ${palette.line}`,
                  background: on ? palette.ink : palette.card,
                  color: on ? palette.bg : palette.ink,
                  cursor:"pointer",
                }}
              >{on ? "✓ " : ""}{h.name}</button>
            );
          })}
        </div>
        <div style={{ fontSize:11,color:palette.inkSoft,lineHeight:1.4 }}>
          {selectedIds.length > 1
            ? `This visit will show in all ${selectedIds.length} selected horses' histories. The cost stays as one number — not split.`
            : `Tap more horses to apply this visit to multiple at once.`}
        </div>
      </Field>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} />
      </Field>
      {kind === "farrier" && (
        <Field label="Type">
          <select style={inputStyle} value={type} onChange={e=>setType(e.target.value)}>
            {FARRIER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      )}
      {kind === "vet" && (
        <>
          <Field label="Type of visit">
            <select style={inputStyle} value={type} onChange={e=>setType(e.target.value)}>
              {VET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Vet name (optional)">
            <input style={inputStyle} value={vetName} onChange={e=>setVetName(e.target.value)} placeholder="Dr. Smith, Mobile Vet Co." />
          </Field>
        </>
      )}
      {kind === "deworming" && (
        <Field label="Product">
          <input style={inputStyle} value={product} onChange={e=>setProduct(e.target.value)} placeholder="e.g. Ivermectin, Quest Plus, Strongid" />
        </Field>
      )}
      <Field label="Cost (optional)">
        <input type="number" step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$" />
      </Field>
      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle,minHeight:50,resize:"vertical" }} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Observations, follow-up needed..." />
      </Field>
      <div style={{ display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap",marginTop:8 }}>
        {log && onDelete && (
          !confirmDelete
            ? <Btn variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Btn>
            : <Btn variant="danger" onClick={() => { onDelete(kind, log.id); onClose(); }}>Confirm delete</Btn>
        )}
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={selectedIds.length === 0 || !date}>Save</Btn>
      </div>
    </ModalShell>
  );
}

// ============ RIDE LOG MODAL ============
function RideModal({ horses, ride, onSave, onDelete, onClose }) {
  const liveHorses = horses.filter(h => !h.archived);
  const [horseId, setHorseId] = useState(ride?.horseId || liveHorses[0]?.id || "");
  const [date, setDate] = useState(ride?.date || todayStr());
  const [durationMinutes, setDurationMinutes] = useState(ride?.durationMinutes ? String(ride.durationMinutes) : "30");
  const [type, setType] = useState(ride?.type || "Training");
  const [notes, setNotes] = useState(ride?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const RIDE_TYPES = ["Training", "Trail", "Trails", "Arena work", "Lesson", "Show", "Conditioning", "Driving", "Lunging", "Liberty/groundwork", "Other"];

  const handleSave = () => {
    if (!horseId || !date) return;
    onSave({
      id: ride?.id || newId(),
      date, horseId,
      durationMinutes: parseInt(durationMinutes) || 0,
      type, notes: notes.trim(),
    });
    onClose();
  };

  return (
    <ModalShell title={ride ? "Edit ride" : "Log a ride"} onClose={onClose}>
      <Field label="Horse">
        <select style={inputStyle} value={horseId} onChange={e=>setHorseId(e.target.value)}>
          {liveHorses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </Field>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} />
      </Field>
      <div style={{ display:"flex",gap:12 }}>
        <div style={{ flex:1 }}>
          <Field label="Type">
            <select style={inputStyle} value={type} onChange={e=>setType(e.target.value)}>
              {RIDE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Minutes">
            <input type="number" min={0} style={inputStyle} value={durationMinutes} onChange={e=>setDurationMinutes(e.target.value)} />
          </Field>
        </div>
      </div>
      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle,minHeight:50,resize:"vertical" }} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Progress, behavior, what you worked on..." />
      </Field>
      <div style={{ display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap",marginTop:8 }}>
        {ride && onDelete && (
          !confirmDelete
            ? <Btn variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Btn>
            : <Btn variant="danger" onClick={() => { onDelete(ride.id); onClose(); }}>Confirm delete</Btn>
        )}
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={!horseId || !date}>Save</Btn>
      </div>
    </ModalShell>
  );
}

// ============ HORSE SALE MODAL ============
// Logs a sale of a specific horse — sold / leased / rehomed. The parent
// component (HorsesPage) handles archiving + Sales row insertion.
function HorseSaleModal({ horse, horses, onClose, onSave, customers = [] }) {
  // When called from the row, `horse` is preselected. When called from the
  // page-level "🏷️ Sale" quick action, `horse` is null and the user picks
  // from `horses` (defaults to first live horse). Mirrors how CareLogModal
  // handles its horse selection inline.
  const liveHorses = (horses || []).filter(h => !h.archived);
  const [horseId, setHorseId] = useState(horse?.id || liveHorses[0]?.id || "");
  const selectedHorse = horse || liveHorses.find(h => h.id === horseId) || null;
  const [date, setDate] = useState(todayStr());
  const [saleType, setSaleType] = useState("sold");
  const [buyer, setBuyer] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [showNewBuyer, setShowNewBuyer] = useState(false);
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  if (!selectedHorse && liveHorses.length === 0) {
    return (
      <ModalShell title="🏷️ Sell a horse" onClose={onClose}>
        <div style={{ fontSize: 13, color: palette.inkSoft, padding: "10px 0" }}>
          No live horses to sell. Add a horse first.
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={onClose}>Close</Btn>
        </div>
      </ModalShell>
    );
  }
  if (!selectedHorse) return null;
  const handleSave = () => {
    const id = newId();
    const verb = saleType === "leased" ? "Leased" : saleType === "rehomed" ? "Rehomed" : "Sold";
    const priceStr = Number(price) > 0 ? ` for $${Number(price).toFixed(2)}` : "";
    const buyerStr = buyer.trim() ? ` to ${buyer.trim()}` : "";
    onSave({
      horseId: selectedHorse.id,
      saleId: id,
      date,
      archiveReason: `${verb}${buyerStr}${priceStr}`,
      saleData: {
        id, date,
        hobbyType: "horse",
        crop: selectedHorse.name,
        saleType,
        pricePerUnit: Number(price) || 0,
        totalRevenue: Number(price) || 0,
        qty: 1,
        animalId: selectedHorse.id,
        buyer: buyer.trim(),
        buyerId: buyerId || null,
        notes: notes.trim() || "",
      },
    });
  };
  return (
    <ModalShell title={horse ? `🏷️ Sell — ${selectedHorse.name}` : "🏷️ Sell a horse"} onClose={onClose}>
      {!horse && (
        <Field label="Which horse?">
          <select style={inputStyle} value={horseId} onChange={e => setHorseId(e.target.value)}>
            {liveHorses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </Field>
      )}
      <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 12, lineHeight: 1.5 }}>
        {selectedHorse.name} will move to your Archived horses list. A sale record will appear in your Sales tab.
      </div>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <Field label="Type">
        <select style={inputStyle} value={saleType} onChange={e => setSaleType(e.target.value)}>
          <option value="sold">Sold</option>
          <option value="leased">Leased</option>
          <option value="rehomed">Rehomed (no payment)</option>
        </select>
      </Field>
      <Field label="Customer (optional)">
        {!showNewBuyer ? (
          <div style={{ display: "flex", gap: 8 }}>
            <select style={{ ...inputStyle, flex: 1 }} value={buyerId} onChange={e => {
              const id = e.target.value;
              setBuyerId(id);
              const c = (customers || []).find(x => x.id === id);
              setBuyer(c ? c.name : "");
            }}>
              <option value="">— No customer —</option>
              {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={() => { setShowNewBuyer(true); setBuyerId(""); setBuyer(""); }} style={{ padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${palette.line}`, background: palette.bgAlt, cursor: "pointer", fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: palette.ink, whiteSpace: "nowrap" }}>+ New</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...inputStyle, flex: 1 }} value={buyer} onChange={e => setBuyer(e.target.value)} placeholder="New customer name" autoFocus />
            <button onClick={() => { setShowNewBuyer(false); setBuyer(""); }} style={{ padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${palette.line}`, background: palette.bgAlt, cursor: "pointer", fontFamily: FONT_BODY, fontSize: 13, color: palette.inkSoft }}>Cancel</button>
          </div>
        )}
      </Field>
      {saleType !== "rehomed" && (
        <Field label="Price ($)">
          <input type="number" min={0} step="0.01" style={inputStyle} value={price} onChange={e => setPrice(e.target.value)} placeholder="$0.00" />
        </Field>
      )}
      <Field label="Notes (optional)">
        <input style={inputStyle} value={notes} onChange={e => setNotes(e.target.value)} />
      </Field>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave}>Save & archive</Btn>
      </div>
    </ModalShell>
  );
}

// ============ HORSE DEATH MODAL ============
// Logs the death of a specific horse. Parent handles archive + entry insertion.
function HorseDeathModal({ horse, horses, onClose, onSave }) {
  // When called from the row, `horse` is preselected. When called from the
  // page-level "🪦 Died" quick action, `horse` is null and the user picks
  // from `horses` (defaults to first live horse).
  const liveHorses = (horses || []).filter(h => !h.archived);
  const [horseId, setHorseId] = useState(horse?.id || liveHorses[0]?.id || "");
  const selectedHorse = horse || liveHorses.find(h => h.id === horseId) || null;
  const [date, setDate] = useState(todayStr());
  const [cause, setCause] = useState("");
  const [notes, setNotes] = useState("");
  if (!selectedHorse && liveHorses.length === 0) {
    return (
      <ModalShell title="🪦 Log a horse death" onClose={onClose}>
        <div style={{ fontSize: 13, color: palette.inkSoft, padding: "10px 0" }}>
          No live horses to log a death for.
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={onClose}>Close</Btn>
        </div>
      </ModalShell>
    );
  }
  if (!selectedHorse) return null;
  const handleSave = () => {
    const entry = {
      id: newId(),
      date,
      action: "death",
      animalId: selectedHorse.id,
      animalName: selectedHorse.name,
      cause: cause.trim(),
      notes: notes.trim(),
      created: Date.now(),
    };
    const archiveReason = cause.trim() ? `Died: ${cause.trim()}` : "Died";
    onSave({ horseId: selectedHorse.id, date, archiveReason, entry });
  };
  return (
    <ModalShell title={horse ? `🪦 Log death — ${selectedHorse.name}` : "🪦 Log a horse death"} onClose={onClose}>
      {!horse && (
        <Field label="Which horse?">
          <select style={inputStyle} value={horseId} onChange={e => setHorseId(e.target.value)}>
            {liveHorses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </Field>
      )}
      <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 12, lineHeight: 1.5 }}>
        {selectedHorse.name} will move to your Archived horses list. You can restore from there if this was a mistake.
      </div>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <Field label="Cause (optional)">
        <input style={inputStyle} value={cause} onChange={e => setCause(e.target.value)} placeholder="colic, age, accident, illness..." />
      </Field>
      <Field label="Notes (optional)">
        <input style={inputStyle} value={notes} onChange={e => setNotes(e.target.value)} />
      </Field>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" onClick={handleSave}>Save & archive</Btn>
      </div>
    </ModalShell>
  );
}

// ============ HORSES HOME PAGE ============

// ============================================================================
// HERD TALLY — count-only tracking that coexists with individual animals
// ----------------------------------------------------------------------------
// Lets users record a simple per-sex head count for horses they don't want to
// track as individual records. Lives ALONGSIDE the individual animal list — it
// does not replace it, and deliberately does NOT feed breeding, pedigree,
// history, or sales (all of which stay individual-animal-only). Stored as
// hobby.herdTally, an object keyed by these category labels.
// ============================================================================
function HerdTallySection({ hobby, update }) {
  const HERD_TALLY_CATEGORIES = ["Mare","Stallion","Gelding","Foal","Unsexed"];
  const [open, setOpen] = useState(false);
  const tally = hobby.herdTally || {};
  const total = HERD_TALLY_CATEGORIES.reduce((s, k) => s + (Number(tally[k]) || 0), 0);
  const present = HERD_TALLY_CATEGORIES.filter(k => (Number(tally[k]) || 0) > 0);

  // Local string state per category so inputs can be cleared while editing.
  const [counts, setCounts] = useState(() => {
    const init = {};
    HERD_TALLY_CATEGORIES.forEach(k => { init[k] = String(Number(tally[k]) || 0); });
    return init;
  });
  const openModal = () => {
    const init = {};
    HERD_TALLY_CATEGORIES.forEach(k => { init[k] = String(Number((hobby.herdTally || {})[k]) || 0); });
    setCounts(init);
    setOpen(true);
  };
  const previewTotal = HERD_TALLY_CATEGORIES.reduce((s, k) => s + (Number(counts[k]) || 0), 0);
  const save = () => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      const next = {};
      HERD_TALLY_CATEGORIES.forEach(k => {
        const n = Math.max(0, Math.floor(Number(counts[k]) || 0));
        if (n > 0) next[k] = n;
      });
      h.herdTally = next;
      return d;
    });
    setOpen(false);
  };

  return (
    <>
      <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: total > 0 ? 10 : 0 }}>
          <div style={{ fontSize: 10, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1 }}>
            Herd tally{total > 0 ? ` · ${total} head` : ""}
          </div>
          <Btn small variant="ghost" onClick={openModal}>{total > 0 ? "Edit tally" : "Set up tally"}</Btn>
        </div>
        {total > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {present.map(k => (
              <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 6, background: palette.bgAlt, borderRadius: 8, padding: "6px 10px" }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, lineHeight: 1 }}>{Number(tally[k]) || 0}</span>
                <span style={{ fontSize: 12, color: palette.inkSoft }}>{k}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 6, lineHeight: 1.5 }}>
            Got horses you don't want to name individually? Record a simple head count by sex here — separate from your named animals.
          </div>
        )}
      </div>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="Herd tally">
          <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
            Record a head count by sex for horses you don't want to track individually. Separate from your named animals — it doesn't affect breeding, history, or sales.
          </div>
          {HERD_TALLY_CATEGORIES.map(k => (
            <Field key={k} label={k}>
              <input
                type="number" inputMode="numeric" min={0} style={inputStyle}
                value={counts[k]}
                onChange={e => setCounts(c => ({ ...c, [k]: e.target.value }))}
                placeholder="0"
              />
            </Field>
          ))}
          <div style={{ fontSize: 13, color: palette.ink, marginBottom: 14 }}>
            Total: <strong>{previewTotal}</strong> head
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn variant="accent" onClick={save}>Save tally</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function HorsesPage({ hobby, data, update, setModal, user }) {
  const [horseModal, setHorseModal] = useState({ open: false, horse: null });
  const [breedingModal, setBreedingModal] = useState({ open: false, breeding: null });
  const [careModal, setCareModal] = useState({ open: false, kind: null, log: null });
  const [rideModal, setRideModal] = useState({ open: false, ride: null });
  // Sale and death modals — both archive the horse and (for sale) push a row
  // into data.sales[] so it shows up in the Sales tab next to other livestock.
  const [saleModal, setSaleModal] = useState({ open: false, horse: null });
  const [deathModal, setDeathModal] = useState({ open: false, horse: null });
  // Push 7a — pedigree view state. The 🧬 chip on each horse row opens this;
  // jumping to an ancestor/descendant from the tree swaps the horse in here
  // without ever opening the edit modal.
  const [pedigreeHorse, setPedigreeHorse] = useState(null);
  const [historyHorse, setHistoryHorse] = useState(null);

  const horses = (hobby?.animals || []);
  const liveHorses = horses.filter(h => !h.archived);
  const archivedHorses = horses.filter(h => h.archived);

  // Save/delete handlers
  const saveHorse = (horse) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.animals)) h.animals = [];
      const idx = h.animals.findIndex(x => x.id === horse.id);
      if (idx >= 0) h.animals[idx] = horse; else h.animals.push(horse);
      return d;
    });
  };
  const deleteHorse = (id) => {
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
  const saveCare = (kind, record) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h[kind])) h[kind] = [];
      const idx = h[kind].findIndex(x => x.id === record.id);
      if (idx >= 0) h[kind][idx] = record; else h[kind].push(record);
      return d;
    });
  };
  const deleteCare = (kind, id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h && Array.isArray(h[kind])) h[kind] = h[kind].filter(r => r.id !== id);
      return d;
    });
  };
  const saveRide = (ride) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.rides)) h.rides = [];
      const idx = h.rides.findIndex(x => x.id === ride.id);
      if (idx >= 0) h.rides[idx] = ride; else h.rides.push(ride);
      return d;
    });
  };
  const deleteRide = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h) h.rides = (h.rides||[]).filter(r => r.id !== id);
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

  // Stats
  const breedings = hobby?.breedings || [];
  const pregnant = breedings.filter(b => !b.foaledDate);
  const foaledThisYear = breedings.filter(b => {
    if (!b.foaledDate) return false;
    return parseLocalDate(b.foaledDate).getFullYear() === new Date().getFullYear();
  });
  const foalsBornThisYear = foaledThisYear.reduce((s,b) => s + (Number(b.foalsBorn)||0), 0);

  // 7-day ride stats
  const rides = hobby?.rides || [];
  const ridesLast7 = rides.filter(r => {
    if (!r.date) return false;
    return Date.now() - parseLocalDate(r.date).getTime() < 7 * 24 * 60 * 60 * 1000;
  });
  const minutesLast7 = ridesLast7.reduce((s,r) => s + (Number(r.durationMinutes)||0), 0);

  return (
    <div>
      {horseModal.open && (
        <HorseModal
          horse={horseModal.horse}
          horses={horses}
          onClose={() => setHorseModal({ open: false, horse: null })}
          onSave={saveHorse}
          onDelete={deleteHorse}
          update={update}
          user={user}
          hobbyId={hobby.id}
        />
      )}
      {breedingModal.open && (
        <BreedingModal
          horses={horses}
          breeding={breedingModal.breeding}
          onClose={() => setBreedingModal({ open: false, breeding: null })}
          onSave={saveBreeding}
          onDelete={deleteBreeding}
          calendarEvents={data?.calendarEvents || []}
          addCalendarEvent={addCalendarEvent}
        />
      )}
      {careModal.open && (
        <CareLogModal
          kind={careModal.kind}
          horses={horses}
          log={careModal.log}
          onClose={() => setCareModal({ open: false, kind: null, log: null })}
          onSave={saveCare}
          onDelete={deleteCare}
        />
      )}
      {rideModal.open && (
        <RideModal
          horses={horses}
          ride={rideModal.ride}
          onClose={() => setRideModal({ open: false, ride: null })}
          onSave={saveRide}
          onDelete={deleteRide}
        />
      )}
      {saleModal.open && (
        <HorseSaleModal
          horse={saleModal.horse}
          horses={horses}
          customers={data.customers || []}
          onClose={() => setSaleModal({ open: false, horse: null })}
          onSave={(payload) => {
            update(d => {
              const h = d.hobbies.find(x => x.id === hobby.id);
              if (!h) return d;
              const a = (h.animals || []).find(x => x.id === payload.horseId);
              if (a) {
                a.archived = true;
                a.archivedReason = payload.archiveReason;
                a.archivedDate = payload.date;
                a.saleId = payload.saleId;
              }
              d.sales = d.sales || [];
              resolveSaleBuyer(d, payload.saleData);
              d.sales.push(payload.saleData);
              return d;
            });
            setSaleModal({ open: false, horse: null });
          }}
        />
      )}
      {deathModal.open && (
        <HorseDeathModal
          horse={deathModal.horse}
          horses={horses}
          onClose={() => setDeathModal({ open: false, horse: null })}
          onSave={(payload) => {
            update(d => {
              const h = d.hobbies.find(x => x.id === hobby.id);
              if (!h) return d;
              // Death entry lives on data.entries so it shows up in journals
              // and analytics. Mirrors how cows/goats/etc. log deaths.
              d.entries = d.entries || {};
              d.entries[hobby.id] = d.entries[hobby.id] || [];
              d.entries[hobby.id].push(payload.entry);
              const a = (h.animals || []).find(x => x.id === payload.horseId);
              if (a) {
                a.archived = true;
                a.archivedReason = payload.archiveReason;
                a.archivedDate = payload.date;
              }
              return d;
            });
            setDeathModal({ open: false, horse: null });
          }}
        />
      )}
      {/* Push 7a — Pedigree modal. onJumpTo swaps the focused horse rather
          than stacking — tapping an ancestor closes nothing, just re-targets
          the same view to the relative the user tapped. */}
      {pedigreeHorse && (
        <PedigreeView
          animal={pedigreeHorse}
          animals={horses}
          onClose={() => setPedigreeHorse(null)}
          onJumpTo={(id) => {
            const next = horses.find(h => h.id === id);
            if (next) setPedigreeHorse(next);
          }}
        />
      )}
      {historyHorse && (
        <AnimalHistoryView
          update={update}
          animal={historyHorse}
          hobby={hobby}
          entries={(data?.entries?.[hobby.id]) || []}
          sales={data?.sales || []}
          species="horse"
          onClose={() => setHistoryHorse(null)}
        />
      )}

      {/* Top stats */}
      <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:16 }}>
        <StatCard label="Horses" value={liveHorses.length} accent={palette.feather} />
        {pregnant.length > 0 && <StatCard label="Pregnant" value={pregnant.length} sub="expecting" accent={palette.accent} />}
        {foalsBornThisYear > 0 && <StatCard label={`Foals ${new Date().getFullYear()}`} value={foalsBornThisYear} accent={palette.leaf} />}
        <StatCard label="Rides last 7d" value={ridesLast7.length} sub={`${minutesLast7} min`} accent={palette.yolk} />
      </div>
      <HerdTallySection hobby={hobby} update={update}/>

      {/* Quick actions */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8,marginBottom:18 }}>
        <Btn variant="accent" onClick={() => setRideModal({ open: true, ride: null })} style={{ width:"100%" }}>🐴 Log ride</Btn>
        <Btn small variant="ghost" onClick={() => setCareModal({ open: true, kind: "farrier", log: null })} style={{ width:"100%" }}>🔨 Farrier</Btn>
        <Btn small variant="ghost" onClick={() => setCareModal({ open: true, kind: "vet", log: null })} style={{ width:"100%" }}>🩺 Vet</Btn>
        <Btn small variant="ghost" onClick={() => setCareModal({ open: true, kind: "deworming", log: null })} style={{ width:"100%" }}>💊 Dewormer</Btn>
        <Btn small variant="leaf" onClick={() => setBreedingModal({ open: true, breeding: null })} style={{ width:"100%" }}>💕 Log breeding</Btn>
        <Btn small variant="ghost" onClick={() => setSaleModal({ open: true, horse: null })} style={{ width:"100%" }}>🏷️ Sale</Btn>
        <Btn small variant="ghost" onClick={() => setDeathModal({ open: true, horse: null })} style={{ width:"100%" }}>🪦 Died</Btn>
        {setModal && (
          <Btn small variant="ghost" onClick={() => setModal({ type: "addExpense", hobbyId: hobby.id })} style={{ width:"100%" }}>💵 Add Expense</Btn>
        )}
        {setModal && (Array.isArray(hobby.customLogs) ? hobby.customLogs : []).map(c => (
          <Btn key={c.id} small variant="ghost" onClick={() => setModal({ type: "log", action: "custom", customLogId: c.id, hobbyIdOverride: hobby.id })} style={{ width:"100%" }}>{c.emoji || "📝"} {c.label}</Btn>
        ))}
        {setModal && (
          <Btn small variant="ghost" onClick={() => setModal({ type: "customLogPicker", hobbyId: hobby.id })} style={{ width:"100%" }}>➕ Custom</Btn>
        )}
        <Btn small variant="ghost" onClick={() => setHorseModal({ open: true, horse: null })} style={{ width:"100%" }}>+ Add horse</Btn>
      </div>

      {/* Pregnant alerts */}
      {pregnant.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:16,margin:"0 0 8px",color:palette.ink }}>💕 Expecting foals</h3>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {pregnant.map(b => {
              const mare = horses.find(h => h.id === b.mareId);
              const stallion = horses.find(h => h.id === b.stallionId);
              const daysToFoaling = b.expectedFoalDate
                ? Math.ceil((parseLocalDate(b.expectedFoalDate).getTime() - Date.now()) / (1000*60*60*24))
                : null;
              return (
                <div
                  key={b.id}
                  onClick={() => setBreedingModal({ open: true, breeding: b })}
                  style={{ padding:"10px 12px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:8,cursor:"pointer" }}
                >
                  <div style={{ fontWeight:600,fontSize:14,color:palette.ink }}>
                    {mare?.name || "Mare"}{stallion ? ` × ${stallion.name}` : ""}
                  </div>
                  <div style={{ fontSize:12,color:daysToFoaling !== null && daysToFoaling <= 14 ? palette.accent : palette.inkSoft,marginTop:2,fontWeight: daysToFoaling !== null && daysToFoaling <= 14 ? 600 : 400 }}>
                    {daysToFoaling !== null
                      ? daysToFoaling > 0
                        ? `~${daysToFoaling} day${daysToFoaling===1?"":"s"} to foaling (${fmtDate(b.expectedFoalDate)})`
                        : `Expected to foal ${Math.abs(daysToFoaling)} day${Math.abs(daysToFoaling)===1?"":"s"} ago — check in soon`
                      : "Awaiting foaling"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Horses list */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
          <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:18,margin:0,color:palette.ink }}>🐴 Your horses</h3>
          {liveHorses.length > 0 && <Btn small onClick={() => setHorseModal({ open: true, horse: null })}>+ Add</Btn>}
        </div>
        {liveHorses.length === 0 ? (
          <div style={{ background:palette.card,border:`1.5px dashed ${palette.line}`,borderRadius:12,padding:32,textAlign:"center" }}>
            <div style={{ fontSize:32,marginBottom:8 }}>🐴</div>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,color:palette.ink,marginBottom:6 }}>No horses yet</div>
            <div style={{ fontSize:13,color:palette.inkSoft,marginBottom:14 }}>Add your first horse to start tracking rides, farrier visits, and breeding.</div>
            <Btn variant="accent" onClick={() => setHorseModal({ open: true, horse: null })}>+ Add your first horse</Btn>
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {liveHorses.map(h => {
              const age = ageYears(h.birthdate);
              return (
                <div
                  key={h.id}
                  onClick={() => setHorseModal({ open: true, horse: h })}
                  style={{ padding:"12px 14px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:10,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8 }}
                >
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:700,fontSize:15,color:palette.ink,display:"flex",alignItems:"center",gap:6 }}><LivestockProfileCircle animal={h} emoji="🐴" size={18} /><span>{h.name}</span></div>
                    <div style={{ fontSize:11,color:palette.inkSoft,marginTop:2 }}>
                      {[
                        h.breed,
                        h.color,
                        age !== null ? `${age}yr` : null,
                        h.sex,
                        h.role,
                      ].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {/* Push 7a — pedigree pill. stopPropagation keeps the row's
                      edit-on-click behavior intact for the rest of the row. */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setPedigreeHorse(h); }}
                    aria-label={`View pedigree for ${h.name}`}
                    style={{
                      padding:"4px 8px",borderRadius:6,fontSize:11,fontWeight:600,fontFamily:FONT_BODY,
                      border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.ink,
                      flexShrink:0,
                    }}
                  >🧬 Pedigree</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setHistoryHorse(h); }}
                    aria-label={`View history for ${h.name}`}
                    style={{
                      padding:"4px 8px",borderRadius:6,fontSize:11,fontWeight:600,fontFamily:FONT_BODY,
                      border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.ink,
                      flexShrink:0,
                    }}
                  >📜 History</button>
                  <Edit3 size={14} style={{ color:palette.inkSoft,flexShrink:0 }} />
                </div>
              );
            })}
          </div>
        )}
        {archivedHorses.length > 0 && (
          <details style={{ marginTop:8 }}>
            <summary style={{ cursor:"pointer",color:palette.inkSoft,fontSize:13,padding:6 }}>Archived horses ({archivedHorses.length})</summary>
            <div style={{ marginTop:8,display:"flex",flexDirection:"column",gap:4 }}>
              {archivedHorses.map(h => (
                <div key={h.id} style={{ padding:"6px 10px",background:palette.bgAlt,borderRadius:6,fontSize:12,color:palette.inkSoft }}>
                  {h.name} — {h.archivedReason || "archived"}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Recent rides */}
      {rides.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:18,margin:"0 0 10px",color:palette.ink }}>🐎 Recent rides</h3>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {rides.slice().sort((a,b) => (b.date||"").localeCompare(a.date||"")).slice(0, 5).map(r => {
              const horse = horses.find(h => h.id === r.horseId);
              return (
                <div
                  key={r.id}
                  onClick={() => setRideModal({ open: true, ride: r })}
                  style={{ padding:"10px 12px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:8,cursor:"pointer" }}
                >
                  <div style={{ fontWeight:600,fontSize:13,color:palette.ink }}>{horse?.name || "Horse"} · {r.type} · {r.durationMinutes}min</div>
                  <div style={{ fontSize:11,color:palette.inkSoft,marginTop:2 }}>{fmtDate(r.date)}{r.notes ? ` · ${r.notes.slice(0,50)}${r.notes.length>50?"…":""}` : ""}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HORSES ANALYTICS
// ============================================================================
export function HorsesAnalytics({ hobby, sales = [], /* ADV_ANALYTICS */ dateRange = null, earlyAccessConfig = null, isSupporter = false }) {
  if (!hobby) {
    return <div style={{ padding:40,textAlign:"center",color:palette.inkSoft }}>Loading…</div>;
  }

  const horses = hobby.animals || [];
  const rides = hobby.rides || [];
  const farrier = hobby.farrier || [];
  const vet = hobby.vet || [];
  const deworming = hobby.deworming || [];
  const breedings = hobby.breedings || [];

  if (horses.length === 0) {
    return (
      <div style={{ padding:40,textAlign:"center",color:palette.inkSoft }}>
        <div style={{ fontSize:36,marginBottom:8 }}>📊</div>
        <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,color:palette.ink,marginBottom:6 }}>No horse data yet</div>
        <div style={{ fontSize:13 }}>Add a horse to see stats here.</div>
      </div>
    );
  }

  const liveCount = horses.filter(h => !h.archived).length;
  const totalRides = rides.length;
  const totalRideMinutes = rides.reduce((s,r) => s + (Number(r.durationMinutes)||0), 0);
  const totalRideHours = (totalRideMinutes / 60).toFixed(1);

  const totalFarrierCost = farrier.reduce((s,r) => s + (Number(r.cost)||0), 0);
  const totalVetCost = vet.reduce((s,r) => s + (Number(r.cost)||0), 0);
  const totalDewormCost = deworming.reduce((s,r) => s + (Number(r.cost)||0), 0);
  const totalPurchaseCost = horses.reduce((s,h) => s + (Number(h.purchaseCost)||0), 0);
  const totalCareCost = totalFarrierCost + totalVetCost + totalDewormCost;
  const totalCost = totalPurchaseCost + totalCareCost;

  // Foaling stats
  const completedFoalings = breedings.filter(b => b.foaledDate);
  const foalsBorn = completedFoalings.reduce((s,b) => s + (Number(b.foalsBorn)||0), 0);
  const foalsAlive = completedFoalings.reduce((s,b) => s + (Number(b.foalsAlive)||0), 0);

  // Sales
  const horseSales = (sales || []).filter(s => s.hobbyType === "horse");
  const totalRevenue = horseSales.reduce((s,x) => s + (Number(x.totalRevenue)||0), 0);

  return (
    <div>
      <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:20,margin:"0 0 12px",color:palette.ink }}>🐴 Herd overview</h3>
      <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:18 }}>
        <StatCard label="Horses" value={liveCount} accent={palette.feather} />
        <StatCard label="Total rides" value={totalRides} sub={`${totalRideHours} hrs`} accent={palette.yolk} />
        {foalsBorn > 0 && <StatCard label="Foals born" value={foalsBorn} sub={foalsAlive !== foalsBorn ? `${foalsAlive} alive` : null} accent={palette.leaf} />}
        {totalCost > 0 && <StatCard label="Total cost" value={fmtMoney(totalCost)} sub={totalPurchaseCost > 0 ? `incl. ${fmtMoney(totalPurchaseCost)} purchases` : null} accent={palette.accent} />}
      </div>

      {totalCareCost > 0 && (
        <>
          <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:18,margin:"0 0 10px",color:palette.ink }}>💰 Care costs</h3>
          <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:18 }}>
            {totalFarrierCost > 0 && <StatCard label="Farrier" value={fmtMoney(totalFarrierCost)} sub={`${farrier.length} visit${farrier.length===1?"":"s"}`} accent={palette.feather} />}
            {totalVetCost > 0 && <StatCard label="Vet" value={fmtMoney(totalVetCost)} sub={`${vet.length} visit${vet.length===1?"":"s"}`} accent={palette.accent} />}
            {totalDewormCost > 0 && <StatCard label="Dewormer" value={fmtMoney(totalDewormCost)} sub={`${deworming.length} dose${deworming.length===1?"":"s"}`} accent={palette.leafSoft} />}
          </div>
        </>
      )}

      {horseSales.length > 0 && (
        <>
          <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:18,margin:"0 0 10px",color:palette.ink }}>💵 Sales</h3>
          <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:18 }}>
            <StatCard label="Horses sold/leased" value={horseSales.length} accent={palette.leaf} />
            <StatCard label="Revenue" value={fmtMoney(totalRevenue)} accent={palette.leaf} />
          </div>
        </>
      )}

      {/* Per-horse breakdown */}
      <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:18,margin:"0 0 10px",color:palette.ink }}>📋 Per horse</h3>
      <div style={{ display:"flex",flexDirection:"column",gap:6,marginBottom:18 }}>
        {horses.filter(h => !h.archived).map(h => {
          const horseRides = rides.filter(r => r.horseId === h.id);
          const horseMinutes = horseRides.reduce((s,r) => s + (Number(r.durationMinutes)||0), 0);
          const lastRide = horseRides.sort((a,b) => (b.date||"").localeCompare(a.date||""))[0];
          return (
            <div key={h.id} style={{ padding:"10px 12px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:8 }}>
              <div style={{ fontWeight:600,fontSize:14,color:palette.ink }}>{h.name}{h.breed ? ` · ${h.breed}` : ""}</div>
              <div style={{ fontSize:12,color:palette.inkSoft,marginTop:2 }}>
                {horseRides.length} ride{horseRides.length===1?"":"s"} · {(horseMinutes/60).toFixed(1)} hrs
                {lastRide ? ` · last: ${fmtDate(lastRide.date)}` : " · no rides yet"}
              </div>
            </div>
          );
        })}
      </div>

      {/* ADV_ANALYTICS: gated block — ride hours by month line, best riding
          month, rides vs. prior period. Rides carry a date + durationMinutes. */}
      {(() => {
        if (rides.length === 0) return null;
        const hoursMonthlyRaw = monthlySeries(rides, r => r.date, r => (Number(r.durationMinutes) || 0) / 60);
        const hoursMonthly = hoursMonthlyRaw.map(p => ({
          month: p.month, hours: Number(p.value.toFixed(1)),
          label: (() => { const pr = String(p.month).split("-").map(Number); const d = new Date(pr[0], pr[1] - 1, 1); return isNaN(d) ? p.month : d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }); })(),
        }));
        const hoursRecord = personalRecord(hoursMonthlyRaw);
        const prior = priorDateRange(dateRange);
        const inR = (d, r) => d && (!r.start || d >= r.start) && (!r.end || d <= r.end);
        const curRides = dateRange && (dateRange.start || dateRange.end)
          ? rides.filter(r => inR(r.date, dateRange)).length
          : rides.length;
        const priorRides = prior ? rides.filter(r => inR(r.date, prior)).length : null;
        const ridesDelta = prior ? computeDelta(curRides, priorRides) : null;
        const pFonts = { body: FONT_BODY, display: FONT_DISPLAY };
        return (
          <LockedStatOverlay earlyAccessConfig={earlyAccessConfig} isSupporter={isSupporter} palette={palette} fonts={pFonts}>
            <div>
              <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:18,margin:"0 0 10px",color:palette.ink }}>📈 Riding trend</h3>
              <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:12 }}>
                {hoursRecord && <StatCard label="Best riding month" value={`${hoursRecord.value.toFixed(1)} hrs`} sub={hoursRecord.label} accent={palette.yolk} />}
                {ridesDelta && (
                  <div style={{ flex:"1 1 130px",minWidth:130,boxSizing:"border-box",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14 }}>
                    <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:6 }}>Rides vs. prior period</div>
                    <div style={{ fontSize:22,fontFamily:FONT_DISPLAY,color:palette.yolk,lineHeight:1.1 }}>{curRides} rides</div>
                    <div style={{ marginTop:4 }}><StatTrend delta={ridesDelta} palette={palette} fonts={pFonts} /></div>
                  </div>
                )}
              </div>
              {hoursMonthly.length > 1 && (
                <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:18 }}>
                  <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,marginBottom:10,color:palette.ink }}>🐴 Ride hours by month</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={hoursMonthly}>
                      <XAxis dataKey="label" stroke={palette.inkSoft} fontSize={11} />
                      <YAxis stroke={palette.inkSoft} fontSize={11} />
                      <Tooltip contentStyle={{ background:palette.card,border:`1.5px solid ${palette.ink}`,borderRadius:8 }} formatter={v => [`${v} hrs`, "Riding"]} />
                      <Line type="monotone" dataKey="hours" stroke={palette.yolk} strokeWidth={3} dot={{ fill:palette.accent,r:4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </LockedStatOverlay>
        );
      })()}
    </div>
  );
}
