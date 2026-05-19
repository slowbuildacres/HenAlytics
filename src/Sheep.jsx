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

import React, { useState, useMemo, useEffect } from "react";
import { X, Edit3, Plus, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { fmtMoney, fmtWeight, fmtVolume, weightUnitLabel, lbsFromInput, weightFromLbs, getCurrentWeightUnit, getCurrentVolumeUnit } from "./units.js";
import { SireDamPicker, PedigreeView } from "./PedigreeView.jsx";
import { AnimalHistoryView } from "./AnimalHistoryView.jsx";
import { profilePhotoOf, timelineOf, addPhotoToAnimal, removePhotoFromAnimal, withProfileSet, withPhotoEdited, resolveAnimalPhotoUrl } from "./animalPhotos.js";
// ADV_ANALYTICS: shared advanced-analytics layer (see analytics.js).
import {
  priorDateRange, computeDelta, StatTrend, personalRecord,
  monthlySeries, LockedStatOverlay,
} from "./analytics.js";

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

function AnimalModal({ animal, animals, paddocks, onSave, onDelete, onClose, update, user, hobbyId }) {
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
  const [paddockId, setPaddockId] = useState(animal?.paddockId || "");
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
      paddockId: paddockId || null,
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
      photos: animal?.photos || [],
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
      {(paddocks || []).length > 0 && (
        <Field label="Paddock (optional)">
          <select style={inputStyle} value={paddockId} onChange={e=>setPaddockId(e.target.value)}>
            <option value="">— Unassigned —</option>
            {(paddocks || []).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
      )}

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

      {animal && update && (
        <AnimalPhotoSection animal={animal} hobbyId={hobbyId} update={update} user={user} />
      )}
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

  const [eweId, setEweId] = useState(breeding?.eweId || breeding?.damId || ewes[0]?.id || "");
  // Sire can be a tracked ram OR an unknown/external sire entered as free text.
  // useUnknownSire=true switches to a text input. Defaults to "use a tracked ram"
  // if any rams exist.
  const [ramId, setRamId] = useState(breeding?.ramId || breeding?.sireId || "");
  const [externalSireName, setExternalSireName] = useState(breeding?.externalSireName || "");
  const [useUnknownSire, setUseUnknownSire] = useState(
    !!breeding?.externalSireName || (!breeding?.ramId && !breeding?.sireId && rams.length === 0)
  );
  const [method, setMethod] = useState(breeding?.method || "Natural");
  const [breedDate, setBreedDate] = useState(breeding?.breedDate || todayStr());
  // Expected lamb date is user-editable. Auto-recompute when breedDate changes
  // UNLESS the user has manually overridden it (the "manually overridden" flag
  // is just whether the current value differs from breedDate + gestation).
  const [expectedLambDate, setExpectedLambDate] = useState(
    breeding?.expectedLambDate || breeding?.expectedBirthDate ||
    (breeding?.breedDate ? addDays(breeding.breedDate, SHEEP_GESTATION_DAYS) : addDays(todayStr(), SHEEP_GESTATION_DAYS))
  );
  const [lambedDate, setLambedDate] = useState(breeding?.lambedDate || breeding?.birthedDate || "");
  const [lambsBorn, setLambsBorn] = useState(
    breeding?.lambsBorn != null ? String(breeding.lambsBorn) :
    breeding?.offspringBorn != null ? String(breeding.offspringBorn) : ""
  );
  const [lambsAlive, setLambsAlive] = useState(
    breeding?.lambsAlive != null ? String(breeding.lambsAlive) :
    breeding?.offspringAlive != null ? String(breeding.offspringAlive) : ""
  );
  const [notes, setNotes] = useState(breeding?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Default-based expected (for the "reset to default" affordance and for
  // tracking whether the user has overridden the auto-computed date).
  const defaultExpected = breedDate ? addDays(breedDate, SHEEP_GESTATION_DAYS) : "";
  const isOverridden = expectedLambDate !== defaultExpected;
  const resetExpected = () => setExpectedLambDate(defaultExpected);
  // When the user changes breedDate, auto-update expectedLambDate ONLY if they
  // haven't manually edited it (i.e. it currently equals what the old default
  // would have been). This is a one-way check on every render: if the current
  // expected date matches the would-be default for the OLD breedDate, slide it
  // along. We track that via a ref of the last seen breedDate.
  const lastSeenBreedDate = React.useRef(breedDate);
  React.useEffect(() => {
    if (lastSeenBreedDate.current !== breedDate) {
      const oldDefault = lastSeenBreedDate.current ? addDays(lastSeenBreedDate.current, SHEEP_GESTATION_DAYS) : "";
      if (expectedLambDate === oldDefault) {
        // Auto-tracking — slide it along.
        setExpectedLambDate(addDays(breedDate, SHEEP_GESTATION_DAYS));
      }
      lastSeenBreedDate.current = breedDate;
    }
  }, [breedDate, expectedLambDate]);

  const handleSave = () => {
    if (!eweId || !breedDate) return;
    const id = breeding?.id || newId();
    const finalSireId = useUnknownSire ? "" : ramId;
    const finalExternalSire = useUnknownSire ? externalSireName.trim() : "";
    onSave({
      id,
      // Old field names (back-compat with existing data):
      eweId,
      ramId: finalSireId,
      breedDate,
      expectedLambDate,
      lambedDate: lambedDate || null,
      lambsBorn: parseInt(lambsBorn) || null,
      lambsAlive: parseInt(lambsAlive) || null,
      // New generic field names (shared with cows + goats):
      damId: eweId,
      sireId: finalSireId,
      externalSireName: finalExternalSire,
      method,
      expectedBirthDate: expectedLambDate,
      birthedDate: lambedDate || null,
      offspringBorn: parseInt(lambsBorn) || null,
      offspringAlive: parseInt(lambsAlive) || null,
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
          <Field label="Ewe (dam)">
            <select style={inputStyle} value={eweId} onChange={e=>setEweId(e.target.value)}>
              {ewes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Ram (sire)">
            {useUnknownSire ? (
              <input
                style={inputStyle}
                value={externalSireName}
                onChange={e => setExternalSireName(e.target.value)}
                placeholder="External / unknown sire name"
              />
            ) : (
              <select style={inputStyle} value={ramId} onChange={e=>setRamId(e.target.value)}>
                <option value="">— Pick a ram —</option>
                {rams.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
            <button
              type="button"
              onClick={() => setUseUnknownSire(v => !v)}
              style={{ background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,fontSize:11,padding:"4px 0 0",textDecoration:"underline",fontFamily:FONT_BODY }}
            >
              {useUnknownSire ? "Use a tracked ram instead" : "External / unknown sire"}
            </button>
          </Field>
        </div>
      </div>
      <Field label="Breeding method">
        <select style={inputStyle} value={method} onChange={e=>setMethod(e.target.value)}>
          <option value="Natural">Natural / live cover</option>
          <option value="AI">AI (artificial insemination)</option>
          <option value="Embryo transfer">Embryo transfer</option>
          <option value="Other">Other</option>
        </select>
      </Field>
      <Field label="Breed date">
        <input type="date" style={inputStyle} value={breedDate} onChange={e=>setBreedDate(e.target.value)} />
      </Field>
      <Field label="Expected lambing date">
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          <input
            type="date"
            style={{ ...inputStyle,flex:1 }}
            value={expectedLambDate}
            onChange={e => setExpectedLambDate(e.target.value)}
          />
          {isOverridden && (
            <button
              type="button"
              onClick={resetExpected}
              style={{ background:"none",border:`1.5px solid ${palette.line}`,borderRadius:8,cursor:"pointer",color:palette.inkSoft,fontSize:11,padding:"8px 10px",fontFamily:FONT_BODY,whiteSpace:"nowrap" }}
              title="Reset to breed date + 147 days"
            >
              ↻ Default
            </button>
          )}
        </div>
        <div style={{ fontSize:11,color:palette.inkSoft,marginTop:4 }}>
          Auto-filled at +147 days (sheep gestation). Edit if your breed runs shorter or longer.
        </div>
      </Field>
      {!breeding && expectedLambDate && (
        <div style={{ padding:"10px 12px",background:palette.yolkSoft,borderRadius:8,fontSize:13,marginBottom:12,color:palette.ink }}>
          🐑 Expected lambing <strong>{fmtDate(expectedLambDate)}</strong> will be added to your calendar.
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
          {(()=>{
            const isMetricW=getCurrentWeightUnit()==="kg";
            const shown=woolLbs===""||woolLbs==null?"":(isMetricW?String(Math.round(weightFromLbs(Number(woolLbs))*100)/100):woolLbs);
            return <Field label={isMetricW?"Wool (kg)":"Wool (lbs)"}>
              <input type="number" step="0.1" style={inputStyle} value={shown} onChange={e=>{const r=e.target.value;setWoolLbs(r===""?"":(isMetricW?String(lbsFromInput(r)):r));}} placeholder="0.0" />
            </Field>;
          })()}
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
        {oz && getCurrentVolumeUnit() === "L" && (
          <div style={{ fontSize:12, color:palette.inkSoft, marginTop:4 }}>{fmtVolume(Number(oz)/128)}</div>
        )}
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
      {(()=>{
        const isMetricW=getCurrentWeightUnit()==="kg";
        const shown=lbs===""||lbs==null?"":(isMetricW?String(Math.round(weightFromLbs(Number(lbs))*100)/100):lbs);
        return <Field label={isMetricW?"Kilograms fed (optional)":"Pounds fed (optional)"}><input type="number" step="0.1" style={inputStyle} value={shown} onChange={e=>{const r=e.target.value;setLbs(r===""?"":(isMetricW?String(lbsFromInput(r)):r));}} /></Field>;
      })()}
      <Field label="Cost (optional)"><input type="number" step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$" /></Field>
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)} /></Field>
      <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave}>Save</Btn>
      </div>
    </ModalShell>
  );
}

// ============================================================================
// LOG ENTRY MODAL — shared modal for weight / health / death / note
// ----------------------------------------------------------------------------
// Sheep originally had per-action modals (Milk, Butcher, Fed). For the broader
// set of entry types (weight check, vet/meds, death, general note) we use a
// single cows-style modal that branches on action. Keeps the per-action modals
// for milk/butcher/feeding intact (they have unique side-effects and fields)
// while still letting the user log weight + meds + notes + deaths without
// four separate modals.
//
// Animal selection is required for weight/health/death; optional for note.
// Death also archives the animal (same pattern as butcher).
// ============================================================================
function LogEntryModal({ animals, action, onSave, onClose, customers = [] }) {
  const live = animals.filter(a => !a.archived);
  const [date, setDate] = useState(todayStr());
  const [animalId, setAnimalId] = useState(live[0]?.id || "");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  // Sale-only fields
  const [saleBuyer, setSaleBuyer] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [showNewBuyer, setShowNewBuyer] = useState(false);
  const [salePrice, setSalePrice] = useState("");
  const [saleType, setSaleType] = useState("sold");

  const animalRequired = action === "weight" || action === "health" || action === "death" || action === "sale";

  const titles = {
    weight: "⚖️ Log weight",
    health: "💊 Vet / meds",
    death:  "🪦 Log death",
    sale:   "🏷️ Log sale",
    note:   "📝 Add note",
  };

  const subtexts = {
    weight: "Weigh-ins help track growth and butcher-readiness.",
    health: "Record treatments, dewormers, vaccinations, vet visits, or anything else worth remembering.",
    death:  "This will archive the animal. Cause of death goes in the notes.",
    sale:   "This will archive the animal and create a sale record in your Sales tab.",
    note:   "Anything else worth tracking against this animal or the flock.",
  };

  const noteRequired = action === "note" || action === "health" || action === "death";
  const canSave = (() => {
    if (animalRequired && !animalId) return false;
    if (action === "weight" && !parseFloat(weight)) return false;
    if (noteRequired && !notes.trim()) return false;
    return true;
  })();

  const handleSave = () => {
    if (!canSave) return;
    const entry = {
      id: newId(),
      date,
      action,
      animalId: animalId || null,
      notes: notes.trim(),
      created: Date.now(),
    };
    if (action === "weight") entry.weight = parseFloat(weight) || 0;
    if (action === "sale") {
      entry.buyer = saleBuyer.trim();
      entry.price = Number(salePrice) || 0;
      entry.saleType = saleType;
    }
    if (action === "death") {
      // Pass {entry, animalId} so the caller can archive the animal (same
      // shape as ButcherLogModal). Note action also has animalId on the entry
      // so we can pull historical notes per-animal later.
      onSave({ entry, animalId, archiveReason: "died" });
    } else if (action === "sale") {
      // Pass sale payload so the page can archive AND create a Sales entry.
      const verb = saleType === "leased" ? "Leased" : saleType === "rehomed" ? "Rehomed" : "Sold";
      const priceStr = Number(salePrice) > 0 ? ` for $${Number(salePrice).toFixed(2)}` : "";
      const buyerStr = saleBuyer.trim() ? ` to ${saleBuyer.trim()}` : "";
      onSave({
        entry,
        animalId,
        archiveReason: `${verb}${buyerStr}${priceStr}`,
        saleData: {
          id: entry.id,
          date,
          hobbyType: "sheep",
          crop: (live.find(a => a.id === animalId) || {}).name || "",
          saleType,
          pricePerUnit: Number(salePrice) || 0,
          totalRevenue: Number(salePrice) || 0,
          qty: 1,
          animalId,
          buyer: saleBuyer.trim(),
          buyerId: buyerId || null,
          notes: notes.trim() || "",
        },
      });
    } else {
      onSave(entry);
    }
    onClose();
  };

  return (
    <ModalShell title={titles[action] || "Log entry"} onClose={onClose}>
      <div style={{
        fontSize: 12, color: palette.inkSoft, marginBottom: 12, lineHeight: 1.5,
      }}>
        {subtexts[action]}
      </div>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <Field label={animalRequired ? "Sheep" : "Sheep (optional)"}>
        <select style={inputStyle} value={animalId} onChange={e => setAnimalId(e.target.value)}>
          {!animalRequired && <option value="">— Whole flock —</option>}
          {live.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      {action === "weight" && (()=>{
        const isMetricW=getCurrentWeightUnit()==="kg";
        const shown=weight===""||weight==null?"":(isMetricW?String(Math.round(weightFromLbs(Number(weight))*100)/100):weight);
        return (
        <Field label={isMetricW?"Weight (kg)":"Weight (lbs)"}>
          <input
            type="number" step="0.1" min={0}
            style={inputStyle} value={shown}
            onChange={e => {const r=e.target.value;setWeight(r===""?"":(isMetricW?String(lbsFromInput(r)):r));}}
            placeholder="0" autoFocus inputMode="decimal"
          />
        </Field>
        );
      })()}
      {action === "sale" && (
        <>
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
                  setSaleBuyer(c ? c.name : "");
                }}>
                  <option value="">— No customer —</option>
                  {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => { setShowNewBuyer(true); setBuyerId(""); setSaleBuyer(""); }} style={{ padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${palette.line}`, background: palette.bgAlt, cursor: "pointer", fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: palette.ink, whiteSpace: "nowrap" }}>+ New</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inputStyle, flex: 1 }} value={saleBuyer} onChange={e => setSaleBuyer(e.target.value)} placeholder="New customer name" autoFocus />
                <button onClick={() => { setShowNewBuyer(false); setSaleBuyer(""); }} style={{ padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${palette.line}`, background: palette.bgAlt, cursor: "pointer", fontFamily: FONT_BODY, fontSize: 13, color: palette.inkSoft }}>Cancel</button>
              </div>
            )}
          </Field>
          {saleType !== "rehomed" && (
            <Field label="Price ($)">
              <input type="number" min={0} step="0.01" style={inputStyle} value={salePrice} onChange={e => setSalePrice(e.target.value)} placeholder="$0.00" />
            </Field>
          )}
        </>
      )}
      <Field label={noteRequired ? "Notes" : "Notes (optional)"}>
        <input
          style={inputStyle} value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={
            action === "health" ? "e.g. Ivermectin 1cc — dewormer round" :
            action === "death" ? "Cause / circumstances" :
            action === "sale" ? "Additional notes" :
            action === "note" ? "What happened" :
            ""
          }
          autoFocus={action !== "weight"}
        />
      </Field>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn
          variant={action === "death" ? "danger" : "primary"}
          onClick={handleSave}
          disabled={!canSave}
        >
          {(action === "death" || action === "sale") ? "Save & archive" : "Save"}
        </Btn>
      </div>
    </ModalShell>
  );
}

// ============ MAIN HOME PAGE ============

// ============================================================================
// HERD TALLY — count-only tracking that coexists with individual animals
// ----------------------------------------------------------------------------
// Lets users record a simple per-sex head count for sheep they don't want to
// track as individual records. Lives ALONGSIDE the individual animal list — it
// does not replace it, and deliberately does NOT feed breeding, pedigree,
// history, or sales (all of which stay individual-animal-only). Stored as
// hobby.herdTally, an object keyed by these category labels.
// ============================================================================
function HerdTallySection({ hobby, update }) {
  const HERD_TALLY_CATEGORIES = ["Ewe","Ram","Lamb","Wether","Unsexed"];
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
            Got sheep you don't want to name individually? Record a simple head count by sex here — separate from your named animals.
          </div>
        )}
      </div>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="Herd tally">
          <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
            Record a head count by sex for sheep you don't want to track individually. Separate from your named animals — it doesn't affect breeding, history, or sales.
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

// ============================================================================
// PADDOCK MODAL — add / edit a paddock (a grouping for sheep)
// ----------------------------------------------------------------------------
// Modeled on the Cows pasture system. Deleting a paddock just unassigns its
// sheep (sets paddockId to null) — it never deletes animals.
// ============================================================================
function PaddockModal({ paddock, hobbyId, update, onClose }) {
  const isEdit = !!paddock;
  const [name, setName] = useState(paddock?.name || "");
  const [acreage, setAcreage] = useState(paddock?.acreage ? String(paddock.acreage) : "");
  const [notes, setNotes] = useState(paddock?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    if (!name.trim()) return;
    const id = paddock?.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const data = {
      id,
      name: name.trim(),
      acreage: Number(acreage) || 0,
      notes: notes.trim(),
      created: paddock?.created || Date.now(),
    };
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      if (!Array.isArray(h.paddocks)) h.paddocks = [];
      if (isEdit) {
        const idx = h.paddocks.findIndex(p => p.id === id);
        if (idx !== -1) h.paddocks[idx] = data; else h.paddocks.push(data);
      } else {
        h.paddocks.push(data);
      }
      return d;
    });
    onClose();
  };

  const del = () => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      // Unassign sheep in this paddock — never delete the animals.
      (h.animals || []).forEach(a => {
        if (a.paddockId === paddock.id) a.paddockId = null;
      });
      h.paddocks = (h.paddocks || []).filter(p => p.id !== paddock.id);
      return d;
    });
    onClose();
  };

  return (
    <ModalShell title={isEdit ? "Edit paddock" : "Add a paddock"} onClose={onClose}>
      <Field label="Name">
        <input
          style={inputStyle}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. North Paddock, Lambing Pen"
          autoFocus
        />
      </Field>
      <Field label="Acreage (optional)">
        <input
          type="number" min={0} step="0.1" inputMode="decimal"
          style={inputStyle}
          value={acreage}
          onChange={e => setAcreage(e.target.value)}
          placeholder="0"
        />
      </Field>
      <Field label="Notes (optional)">
        <textarea
          style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 4 }}>
        {isEdit ? (
          confirmDelete ? (
            <Btn variant="danger" small onClick={del}>Confirm delete</Btn>
          ) : (
            <Btn variant="ghost" small onClick={() => setConfirmDelete(true)}>Delete</Btn>
          )
        ) : <span />}
        <Btn onClick={save}>{isEdit ? "Save" : "Add paddock"}</Btn>
      </div>
    </ModalShell>
  );
}

// ============================================================================
// MOVE SHEEP MODAL — reassign a sheep's paddock without the full edit form
// ============================================================================
function MoveSheepModal({ animal, paddocks, hobbyId, update, onClose }) {
  const [paddockId, setPaddockId] = useState(animal?.paddockId || "");
  const groups = paddocks || [];

  const save = () => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      const a = (h.animals || []).find(x => x.id === animal.id);
      if (a) a.paddockId = paddockId || null;
      return d;
    });
    onClose();
  };

  return (
    <ModalShell title={`Move ${animal?.name || "sheep"}`} onClose={onClose}>
      <Field label="Paddock">
        <select style={inputStyle} value={paddockId} onChange={e => setPaddockId(e.target.value)} autoFocus>
          <option value="">— Unassigned —</option>
          {groups.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </Field>
      {groups.length === 0 && (
        <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 8 }}>
          No paddocks yet. Add one from the sheep page first.
        </div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
        <Btn variant="ghost" small onClick={onClose}>Cancel</Btn>
        <Btn onClick={save}>Move</Btn>
      </div>
    </ModalShell>
  );
}

export default function SheepPage({ hobby, data, update, setModal, user }) {
  const [animalModal, setAnimalModal] = useState({ open: false, animal: null });
  // Push 7a — pedigree view state. The 🧬 chip on each animal row opens
  // this; jumping to an ancestor/descendant from the tree swaps the
  // animal in here without ever opening the edit modal.
  const [pedigreeAnimal, setPedigreeAnimal] = useState(null);
  const [historyAnimal, setHistoryAnimal] = useState(null);
  const [breedingModal, setBreedingModal] = useState({ open: false, breeding: null });
  const [shearingModal, setShearingModal] = useState({ open: false, shearing: null });
  const [milkOpen, setMilkOpen] = useState(false);
  const [fedOpen, setFedOpen] = useState(false);
  const [butcherOpen, setButcherOpen] = useState(false);
  // Shared modal for the broader entry types (weight, health/vet, death, note).
  // null when closed; one of the action strings when open.
  const [logEntryAction, setLogEntryAction] = useState(null);
  // Paddock grouping: paddockModal holds {open, paddock} for add/edit;
  // moveModal holds {open, animal} for the quick Move action.
  const [paddockModal, setPaddockModal] = useState({ open: false, paddock: null });
  const [moveModal, setMoveModal] = useState({ open: false, animal: null });

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
          paddocks={hobby?.paddocks || []}
          onClose={() => setAnimalModal({ open: false, animal: null })}
          onSave={saveAnimal}
          onDelete={deleteAnimal}
          update={update}
          user={user}
          hobbyId={hobby.id}
        />
      )}
      {paddockModal.open && (
        <PaddockModal
          paddock={paddockModal.paddock}
          hobbyId={hobby.id}
          update={update}
          onClose={() => setPaddockModal({ open: false, paddock: null })}
        />
      )}
      {moveModal.open && (
        <MoveSheepModal
          animal={moveModal.animal}
          paddocks={hobby?.paddocks || []}
          hobbyId={hobby.id}
          update={update}
          onClose={() => setMoveModal({ open: false, animal: null })}
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
      {historyAnimal && (
        <AnimalHistoryView
          update={update}
          animal={historyAnimal}
          hobby={hobby}
          entries={(data?.entries?.[hobby.id]) || []}
          sales={data?.sales || []}
          species="sheep"
          onClose={() => setHistoryAnimal(null)}
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
      {logEntryAction && (
        <LogEntryModal
          animals={hobby?.animals || []}
          customers={data.customers || []}
          action={logEntryAction}
          onSave={(payload) => {
            // death returns { entry, animalId, archiveReason } so the page
            // can archive the animal. Sale also passes saleData so we can
            // create a row in data.sales[]. Other actions just return the entry.
            if (payload && payload.entry) {
              addEntry(payload.entry);
              if (payload.archiveReason && payload.animalId) {
                archiveAnimal(payload.animalId, payload.archiveReason);
              }
              if (payload.saleData) {
                update(d => {
                  d.sales = d.sales || [];
                  resolveSaleBuyer(d, payload.saleData);
                  d.sales.push(payload.saleData);
                  return d;
                });
              }
            } else {
              addEntry(payload);
            }
          }}
          onClose={() => setLogEntryAction(null)}
        />
      )}
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
      <HerdTallySection hobby={hobby} update={update}/>
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
        <Btn small onClick={() => setLogEntryAction("weight")} style={{ width:"100%" }}>⚖️ Weight</Btn>
        <Btn small onClick={() => setLogEntryAction("health")} style={{ width:"100%" }}>💊 Vet / meds</Btn>
        <Btn small onClick={() => setLogEntryAction("note")} style={{ width:"100%" }}>📝 Note</Btn>
        <Btn small variant="danger" onClick={() => setButcherOpen(true)} style={{ width:"100%" }}>🥩 Butcher</Btn>
        <Btn small variant="danger" onClick={() => setLogEntryAction("death")} style={{ width:"100%" }}>🪦 Died</Btn>
        <Btn small onClick={() => setLogEntryAction("sale")} style={{ width:"100%" }}>🏷️ Sale</Btn>
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

      {/* Animals list — grouped by paddock when paddocks exist */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
          <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:20,margin:0,color:palette.ink }}>Your sheep</h3>
          <div style={{ display:"flex",gap:6 }}>
            <Btn small variant="ghost" onClick={() => setPaddockModal({ open: true, paddock: null })}>+ Paddock</Btn>
            <Btn small onClick={() => setAnimalModal({ open: true, animal: null })}>+ Add sheep</Btn>
          </div>
        </div>
        {animals.length === 0 ? (
          <div style={{ background:palette.card,border:`1.5px dashed ${palette.line}`,borderRadius:12,padding:32,textAlign:"center" }}>
            <div style={{ fontSize:32,marginBottom:8 }}>🐑</div>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,color:palette.ink,marginBottom:6 }}>No sheep yet</div>
            <div style={{ fontSize:13,color:palette.inkSoft,marginBottom:14 }}>Add your first sheep to start tracking.</div>
            <Btn variant="accent" onClick={() => setAnimalModal({ open: true, animal: null })}>+ Add your first sheep</Btn>
          </div>
        ) : (() => {
          // Render one sheep row.
          const renderRow = (a) => {
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
                  <div style={{ fontWeight:600,fontSize:14,color:palette.ink,display:"flex",alignItems:"center",gap:6 }}>
                    <LivestockProfileCircle animal={a} emoji="🐑" size={18} />
                    <span>{a.name}</span>
                  </div>
                  <div style={{ fontSize:11,color:palette.inkSoft }}>
                    {roleLabel}{a.breed ? ` · ${a.breed}` : ""}{a.birthdate ? ` · ${fmtAge(a.birthdate)}` : ""}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setPedigreeAnimal(a); }}
                  aria-label={`View pedigree for ${a.name}`}
                  style={{
                    padding:"4px 8px",borderRadius:6,fontSize:11,fontWeight:600,fontFamily:FONT_BODY,
                    border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.ink,
                    flexShrink:0,
                  }}
                >🧬 Pedigree</button>
                <button
                  onClick={(e) => { e.stopPropagation(); setHistoryAnimal(a); }}
                  aria-label={`View history for ${a.name}`}
                  style={{
                    padding:"4px 8px",borderRadius:6,fontSize:11,fontWeight:600,fontFamily:FONT_BODY,
                    border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.ink,
                    flexShrink:0,
                  }}
                >📜 History</button>
                <button
                  onClick={(e) => { e.stopPropagation(); setMoveModal({ open: true, animal: a }); }}
                  aria-label={`Move ${a.name}`}
                  style={{
                    padding:"4px 8px",borderRadius:6,fontSize:11,fontWeight:600,fontFamily:FONT_BODY,
                    border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.ink,
                    flexShrink:0,
                  }}
                >↔️ Move</button>
                <Edit3 size={14} style={{ color:palette.inkSoft,flexShrink:0 }} />
              </div>
            );
          };

          const paddocks = hobby.paddocks || [];
          // No paddocks defined → flat list, same as before.
          if (paddocks.length === 0) {
            return (
              <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                {animals.map(renderRow)}
              </div>
            );
          }
          // Paddocks defined → bucket animals by paddockId, plus an Ungrouped
          // bucket. Empty paddocks still show (so you can move sheep into them).
          const buckets = paddocks.map(p => ({
            paddock: p,
            list: animals.filter(a => a.paddockId === p.id),
          }));
          const ungrouped = animals.filter(a => !a.paddockId || !paddocks.some(p => p.id === a.paddockId));
          return (
            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
              {buckets.map(({ paddock, list }) => (
                <div key={paddock.id}>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6 }}>
                    <div style={{ fontFamily:FONT_DISPLAY,fontSize:15,color:palette.ink }}>
                      {paddock.name}
                      <span style={{ fontSize:12,color:palette.inkSoft,fontFamily:FONT_BODY,marginLeft:6 }}>
                        ({list.length})
                      </span>
                    </div>
                    <button
                      onClick={() => setPaddockModal({ open: true, paddock })}
                      style={{
                        padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:600,fontFamily:FONT_BODY,
                        border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.inkSoft,
                      }}
                    >Edit</button>
                  </div>
                  {list.length === 0 ? (
                    <div style={{ fontSize:12,color:palette.inkSoft,fontStyle:"italic",padding:"4px 2px" }}>
                      No sheep in this paddock.
                    </div>
                  ) : (
                    <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                      {list.map(renderRow)}
                    </div>
                  )}
                </div>
              ))}
              {ungrouped.length > 0 && (
                <div>
                  <div style={{ fontFamily:FONT_DISPLAY,fontSize:15,color:palette.ink,marginBottom:6 }}>
                    Unassigned
                    <span style={{ fontSize:12,color:palette.inkSoft,fontFamily:FONT_BODY,marginLeft:6 }}>
                      ({ungrouped.length})
                    </span>
                  </div>
                  <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                    {ungrouped.map(renderRow)}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
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
                    {fmtWeight(Number(s.woolLbs)||0)}
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
export function SheepAnalytics({ hobby, entries = [], /* ADV_ANALYTICS */ allEntries = null, dateRange = null, earlyAccessConfig = null, isSupporter = false }) {
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
          <StatCard label="Milk" value={fmtVolume(milkGal)} accent={palette.leafSoft} />
        )}
        {(subType === "wool" || subType === "mixed") && totalWoolLbs > 0 && (
          <StatCard label="Wool" value={fmtWeight(totalWoolLbs)} sub={`${shearings.length} shearings`} accent={palette.yolk} />
        )}
        {totalMeatLbs > 0 && (
          <StatCard label="Meat" value={fmtWeight(totalMeatLbs)} sub={`${butcherEntries.length} butchered`} accent={palette.accent} />
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
            <StatCard label="Feed used" value={fmtWeight(feedLbs)} accent={palette.feather} />
            <StatCard label="Feed cost" value={fmtMoney(feedCost)} accent={palette.accent} />
            {liveAnimals.length > 0 && <StatCard label="Cost / sheep" value={fmtMoney(feedCost / liveAnimals.length)} sub="lifetime" accent={palette.feather} />}
          </div>
        </>
      )}

      {/* ADV_ANALYTICS: gated block — milk by month line, best milk month,
          milk vs. prior period. Milk entries carry a date so monthly
          bucketing works; lambing/wool records have no per-event dates. */}
      {(() => {
        const advAll = allEntries || entries;
        const advMilk = advAll.filter(e => e.action === "milk");
        if (advMilk.length === 0) return null;
        const milkMonthlyRaw = monthlySeries(advMilk, e => e.date, e => Number(e.oz) || 0);
        const milkMonthly = milkMonthlyRaw.map(p => ({
          month: p.month, gal: Number((p.value / 128).toFixed(2)),
          label: (() => { const pr = String(p.month).split("-").map(Number); const d = new Date(pr[0], pr[1] - 1, 1); return isNaN(d) ? p.month : d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }); })(),
        }));
        const milkRecord = personalRecord(milkMonthlyRaw);
        const prior = priorDateRange(dateRange);
        const inR = (d, r) => d && (!r.start || d >= r.start) && (!r.end || d <= r.end);
        const priorMilk = prior ? advMilk.filter(e => inR(e.date, prior)).reduce((s, e) => s + (Number(e.oz) || 0), 0) : null;
        const milkDelta = prior ? computeDelta(milkOz, priorMilk) : null;
        const pFonts = { body: FONT_BODY, display: FONT_DISPLAY };
        return (
          <LockedStatOverlay earlyAccessConfig={earlyAccessConfig} isSupporter={isSupporter} palette={palette} fonts={pFonts}>
            <div>
              <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:18,margin:"0 0 10px",color:palette.ink }}>📈 Milk trend</h3>
              <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:12 }}>
                {milkRecord && <StatCard label="Best milk month" value={fmtVolume(milkRecord.value / 128)} sub={milkRecord.label} accent={palette.leaf} />}
                {milkDelta && (
                  <div style={{ flex:"1 1 130px",minWidth:130,boxSizing:"border-box",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14 }}>
                    <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:6 }}>Milk vs. prior period</div>
                    <div style={{ fontSize:22,fontFamily:FONT_DISPLAY,color:palette.leaf,lineHeight:1.1 }}>{fmtVolume(milkOz / 128)}</div>
                    <div style={{ marginTop:4 }}><StatTrend delta={milkDelta} palette={palette} fonts={pFonts} /></div>
                  </div>
                )}
              </div>
              {milkMonthly.length > 1 && (
                <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:18 }}>
                  <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,marginBottom:10,color:palette.ink }}>🥛 Milk by month</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={milkMonthly}>
                      <XAxis dataKey="label" stroke={palette.inkSoft} fontSize={11} />
                      <YAxis stroke={palette.inkSoft} fontSize={11} />
                      <Tooltip contentStyle={{ background:palette.card,border:`1.5px solid ${palette.ink}`,borderRadius:8 }} formatter={v => [`${v} gal`, "Milk"]} />
                      <Line type="monotone" dataKey="gal" stroke={palette.leaf} strokeWidth={3} dot={{ fill:palette.accent,r:4 }} />
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
