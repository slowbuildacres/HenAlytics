// ============================================================================
// DOGS PAGE
// ----------------------------------------------------------------------------
// Hobby for tracking dogs: pets, breeding stock, working dogs, livestock
// guardian dogs (LGDs). LGDs unlock attack-prevention tracking — a real
// differentiator for homesteaders who depend on their dogs to protect
// chickens, sheep, goats, etc.
//
// Data shape on the hobby:
//   hobby.animals[] = [{ id, name, breed, birthdate, sex, isLGD, color,
//                        microchipId, purchaseCost, purchasedFrom,
//                        sireId, sire, damId, dam, registryNumber,
//                        registryName, archived, archivedReason, archivedDate }]
//   hobby.breedings[] = [{ id, damId, sireId, sireExternal, breedDate,
//                           expectedWhelpDate, whelpedDate, puppiesBorn,
//                           puppiesAlive, notes }]
//   hobby.litters[] = [{ id, breedingId, whelpDate, totalBorn, notes,
//                         puppies: [{ id, name, sex, color, status,
//                                     placedTo, placePrice, placeDate,
//                                     notes }] }]
//   hobby.attacks[] = [{ id, date, dogId, predatorType, livestockSpecies,
//                         attackResult, notes }]
//
// Entries (data.entries["dogs"]): weight, health, note, death — shared
// LogEntryModal pattern from Sheep.
//
// Dog gestation = 58–68 days. Default expected whelp = +63 days.
// ============================================================================

import React, { useState, useMemo, useEffect } from "react";
import { X, Edit3, Plus, Trash2, Shield } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fmtMoney, weightUnitLabel, lbsFromInput, weightFromLbs, getCurrentWeightUnit } from "./units.js";
import { AnimalHistoryView } from "./AnimalHistoryView.jsx";
import { profilePhotoOf, timelineOf, addPhotoToAnimal, removePhotoFromAnimal, withProfileSet, withPhotoEdited, resolveAnimalPhotoUrl } from "./animalPhotos.js";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47", featherSoft: "#C9A77B",
  line: "#2C181030", card: "#FAF5EA",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

const DOG_GESTATION_DAYS = 63;

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
  return remMo ? `${yrs}y ${remMo}mo` : `${yrs}y`;
};

// ============ SHARED UI ============
function Btn({ children, onClick, variant = "primary", small = false, style = {}, type = "button", disabled = false }) {
  const variants = {
    primary: { bg: palette.ink, color: palette.bg, border: palette.ink },
    leaf: { bg: palette.leaf, color: "#FAF5EA", border: palette.leaf },
    accent: { bg: palette.accent, color: "#FAF5EA", border: palette.accent },
    ghost: { bg: "transparent", color: palette.ink, border: palette.line },
    danger: { bg: palette.accent, color: palette.bg, border: palette.accent },
  };
  const v = variants[variant] || variants.primary;
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      style={{
        background: v.bg, color: v.color, border: `1.5px solid ${v.border}`,
        borderRadius: 10, padding: small ? "8px 12px" : "10px 16px",
        fontFamily: FONT_BODY, fontWeight: 600, fontSize: small ? 13 : 14,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        boxShadow: variant === "ghost" ? "none" : "2px 2px 0 " + palette.line,
        ...style,
      }}>
      {children}
    </button>
  );
}

function StatCard({ label, value, sub, accent = palette.accent }) {
  return (
    <div style={{
      flex: 1, minWidth: 100, padding: "12px 14px",
      background: palette.card, border: `1.5px solid ${palette.line}`,
      borderRadius: 12,
    }}>
      <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, color: accent, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

function ModalShell({ title, onClose, children, maxWidth = 460 }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(44,24,16,0.55)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      zIndex: 200, padding: 0,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: palette.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
        maxWidth, width: "100%", maxHeight: "92vh", overflowY: "auto",
        border: `2px solid ${palette.ink}`, boxShadow: `0 -6px 0 ${palette.line}`,
        WebkitOverflowScrolling: "touch",
        padding: "18px 22px max(18px, env(safe-area-inset-bottom)) 22px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, margin: 0, color: palette.ink }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={{
            background: "none", border: "none", padding: 6, cursor: "pointer", color: palette.ink,
          }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ============ DOG MODAL ============
const DOG_BREEDS = [
  "Great Pyrenees", "Anatolian Shepherd", "Maremma", "Akbash", "Kangal",
  "Border Collie", "Australian Shepherd", "German Shepherd",
  "Labrador Retriever", "Golden Retriever", "Mixed", "Other",
];

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

function DogModal({ dog, dogs, onSave, onDelete, onClose, update, user, hobbyId }) {
  const [name, setName] = useState(dog?.name || "");
  const initBreed = (dog?.breed || "").trim();
  const initIsKnown = DOG_BREEDS.includes(initBreed);
  const [breedSelect, setBreedSelect] = useState(initBreed && initIsKnown ? initBreed : (initBreed ? "Other" : ""));
  const [breedCustom, setBreedCustom] = useState(initBreed && !initIsKnown ? initBreed : "");
  const [birthdate, setBirthdate] = useState(dog?.birthdate || "");
  const [sex, setSex] = useState(dog?.sex || "female");
  const [isLGD, setIsLGD] = useState(!!dog?.isLGD);
  const [color, setColor] = useState(dog?.color || "");
  const [microchipId, setMicrochipId] = useState(dog?.microchipId || "");
  const [purchaseCost, setPurchaseCost] = useState(dog?.purchaseCost ? String(dog.purchaseCost) : "");
  const [purchasedFrom, setPurchasedFrom] = useState(dog?.purchasedFrom || "");
  const [sireId, setSireId] = useState(dog?.sireId || "");
  const [sire, setSire] = useState(dog?.sire || "");
  const [damId, setDamId] = useState(dog?.damId || "");
  const [dam, setDam] = useState(dog?.dam || "");
  const [registryNumber, setRegistryNumber] = useState(dog?.registryNumber || "");
  const [registryName, setRegistryName] = useState(dog?.registryName || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const finalBreed = breedSelect === "Other" ? breedCustom.trim() : breedSelect;
  const males = (dogs || []).filter(a => a.sex === "male" && a.id !== dog?.id && !a.archived);
  const females = (dogs || []).filter(a => a.sex === "female" && a.id !== dog?.id && !a.archived);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: dog?.id || newId(),
      name: name.trim(),
      breed: finalBreed,
      birthdate,
      sex,
      isLGD,
      color: color.trim(),
      microchipId: microchipId.trim(),
      purchaseCost: parseFloat(purchaseCost) || 0,
      purchasedFrom: purchasedFrom.trim(),
      sireId: sireId || null,
      sire: sire.trim(),
      damId: damId || null,
      dam: dam.trim(),
      registryNumber: registryNumber.trim(),
      registryName: registryName.trim(),
      photos: dog?.photos || [],
      archived: dog?.archived || false,
      created: dog?.created || Date.now(),
    });
    onClose();
  };

  return (
    <ModalShell title={dog ? "Edit dog" : "Add a dog"} onClose={onClose}>
      <Field label="Name">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Beau, Maggie" autoFocus />
      </Field>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Sex">
            <select style={inputStyle} value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Birthdate">
            <input type="date" style={inputStyle} value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
          </Field>
        </div>
      </div>

      <Field label="Breed">
        <select style={inputStyle} value={breedSelect} onChange={(e) => setBreedSelect(e.target.value)}>
          <option value="">— pick a breed —</option>
          {DOG_BREEDS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        {breedSelect === "Other" && (
          <input style={{ ...inputStyle, marginTop: 8 }} value={breedCustom} onChange={(e) => setBreedCustom(e.target.value)} placeholder="Breed name" />
        )}
      </Field>

      <Field label="Color / markings">
        <input style={inputStyle} value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. White with black mask" />
      </Field>

      {/* LGD toggle */}
      <div style={{
        padding: "12px 14px", marginBottom: 12,
        background: isLGD ? palette.leafSoft : palette.bgAlt,
        border: `1.5px solid ${isLGD ? palette.leaf : palette.line}`,
        borderRadius: 10, cursor: "pointer",
        display: "flex", alignItems: "center", gap: 12,
      }} onClick={() => setIsLGD(!isLGD)}>
        <div style={{
          width: 22, height: 22, borderRadius: 6,
          border: `1.5px solid ${palette.ink}`,
          background: isLGD ? palette.ink : palette.bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, color: palette.bg, fontSize: 14, fontWeight: 700,
        }}>
          {isLGD ? "✓" : ""}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: palette.ink }}>🛡️ Livestock Guardian Dog</div>
          <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 2, lineHeight: 1.4 }}>
            Unlocks attack-prevention tracking — log each predator threat this dog deterred.
          </div>
        </div>
      </div>

      <Field label="Microchip ID (optional)">
        <input style={inputStyle} value={microchipId} onChange={(e) => setMicrochipId(e.target.value)} placeholder="15-digit ID" />
      </Field>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Purchase cost ($)">
            <input type="number" step="0.01" min={0} style={inputStyle} value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} placeholder="0.00" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Purchased from">
            <input style={inputStyle} value={purchasedFrom} onChange={(e) => setPurchasedFrom(e.target.value)} placeholder="Breeder name" />
          </Field>
        </div>
      </div>

      {/* Pedigree section */}
      <div style={{ marginTop: 14, marginBottom: 8, fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>
        Pedigree (optional)
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Sire (father)">
            <select style={inputStyle} value={sireId} onChange={(e) => { setSireId(e.target.value); const m = males.find(x => x.id === e.target.value); if (m) setSire(m.name); }}>
              <option value="">— pick or type —</option>
              {males.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {!sireId && (
              <input style={{ ...inputStyle, marginTop: 6 }} value={sire} onChange={(e) => setSire(e.target.value)} placeholder="External sire name" />
            )}
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Dam (mother)">
            <select style={inputStyle} value={damId} onChange={(e) => { setDamId(e.target.value); const f = females.find(x => x.id === e.target.value); if (f) setDam(f.name); }}>
              <option value="">— pick or type —</option>
              {females.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {!damId && (
              <input style={{ ...inputStyle, marginTop: 6 }} value={dam} onChange={(e) => setDam(e.target.value)} placeholder="External dam name" />
            )}
          </Field>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Registry #">
            <input style={inputStyle} value={registryNumber} onChange={(e) => setRegistryNumber(e.target.value)} placeholder="AKC, UKC, etc." />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Registered name">
            <input style={inputStyle} value={registryName} onChange={(e) => setRegistryName(e.target.value)} placeholder="Show name" />
          </Field>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        {dog && onDelete ? (
          confirmDelete ? (
            <div style={{ display: "flex", gap: 6 }}>
              <Btn variant="ghost" small onClick={() => setConfirmDelete(false)}>Cancel</Btn>
              <Btn variant="danger" small onClick={() => { onDelete(dog.id); onClose(); }}>Confirm delete</Btn>
            </div>
          ) : (
            <Btn variant="ghost" small onClick={() => setConfirmDelete(true)}>Delete</Btn>
          )
        ) : <div />}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={!name.trim()}>Save</Btn>
        </div>
      </div>
      {dog && update && (
        <AnimalPhotoSection animal={dog} hobbyId={hobbyId} update={update} user={user} />
      )}
    </ModalShell>
  );
}

// ============ BREEDING MODAL ============
function BreedingModal({ animals, breeding, onSave, onDelete, onClose, addCalendarEvent }) {
  const dams = animals.filter(a => !a.archived && a.sex === "female");
  const sires = animals.filter(a => !a.archived && a.sex === "male");

  const [damId, setDamId] = useState(breeding?.damId || dams[0]?.id || "");
  const [sireId, setSireId] = useState(breeding?.sireId || sires[0]?.id || "");
  const [sireExternal, setSireExternal] = useState(breeding?.sireExternal || "");
  const [useSireExternal, setUseSireExternal] = useState(!!breeding?.sireExternal);
  const [breedDate, setBreedDate] = useState(breeding?.breedDate || todayStr());
  const [notes, setNotes] = useState(breeding?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const expectedWhelpDate = breedDate ? addDays(breedDate, DOG_GESTATION_DAYS) : "";

  const handleSave = () => {
    if (!damId || !breedDate) return;
    const id = breeding?.id || newId();
    onSave({
      id,
      damId,
      sireId: useSireExternal ? null : sireId,
      sireExternal: useSireExternal ? sireExternal.trim() : "",
      breedDate,
      expectedWhelpDate,
      whelpedDate: breeding?.whelpedDate || null,
      puppiesBorn: breeding?.puppiesBorn || null,
      puppiesAlive: breeding?.puppiesAlive || null,
      notes: notes.trim(),
    });
    if (!breeding && expectedWhelpDate && addCalendarEvent) {
      const damName = animals.find(a => a.id === damId)?.name || "dam";
      addCalendarEvent({
        id: newId(),
        date: expectedWhelpDate,
        title: `🐕 Expected whelp — ${damName}`,
        kind: "dogs_whelping",
        relatedId: id,
      });
    }
    onClose();
  };

  return (
    <ModalShell title={breeding ? "Edit breeding" : "Log breeding"} onClose={onClose}>
      {dams.length === 0 && (
        <div style={{ padding: 12, background: palette.bgAlt, borderRadius: 8, fontSize: 13, color: palette.inkSoft, marginBottom: 12 }}>
          You'll need at least one female dog to log a breeding.
        </div>
      )}
      <Field label="Dam (mother)">
        <select style={inputStyle} value={damId} onChange={(e) => setDamId(e.target.value)}>
          {dams.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>

      <Field label="Sire (father)">
        {!useSireExternal ? (
          <>
            <select style={inputStyle} value={sireId} onChange={(e) => setSireId(e.target.value)}>
              {sires.length === 0 && <option value="">No male dogs — switch to external</option>}
              {sires.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button onClick={() => setUseSireExternal(true)} style={{
              marginTop: 6, background: "none", border: "none", padding: 0,
              color: palette.inkSoft, fontSize: 12, textDecoration: "underline", cursor: "pointer",
            }}>Or use external stud</button>
          </>
        ) : (
          <>
            <input style={inputStyle} value={sireExternal} onChange={(e) => setSireExternal(e.target.value)} placeholder="External stud name" />
            <button onClick={() => setUseSireExternal(false)} style={{
              marginTop: 6, background: "none", border: "none", padding: 0,
              color: palette.inkSoft, fontSize: 12, textDecoration: "underline", cursor: "pointer",
            }}>Pick from my dogs instead</button>
          </>
        )}
      </Field>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Breed date">
            <input type="date" style={inputStyle} value={breedDate} onChange={(e) => setBreedDate(e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Expected whelp">
            <input type="date" style={{ ...inputStyle, opacity: 0.7 }} value={expectedWhelpDate} readOnly />
          </Field>
        </div>
      </div>

      <Field label="Notes">
        <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontFamily: FONT_BODY }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Heat cycle notes, conditions, etc." />
      </Field>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        {breeding && onDelete ? (
          confirmDelete ? (
            <div style={{ display: "flex", gap: 6 }}>
              <Btn variant="ghost" small onClick={() => setConfirmDelete(false)}>Cancel</Btn>
              <Btn variant="danger" small onClick={() => { onDelete(breeding.id); onClose(); }}>Confirm delete</Btn>
            </div>
          ) : (
            <Btn variant="ghost" small onClick={() => setConfirmDelete(true)}>Delete</Btn>
          )
        ) : <div />}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={!damId || !breedDate}>Save</Btn>
        </div>
      </div>
    </ModalShell>
  );
}

// ============ LITTER MODAL ============
// Create a litter from a breeding. Handles whelp date, total born, and
// individual puppy records (name, sex, color, status).
function LitterModal({ animals, breedings, litter, onSave, onDelete, onClose }) {
  const editing = !!litter;
  const eligibleBreedings = breedings.filter(b => !b.archived);
  const [breedingId, setBreedingId] = useState(litter?.breedingId || eligibleBreedings[0]?.id || "");
  const [whelpDate, setWhelpDate] = useState(litter?.whelpDate || todayStr());
  const [totalBorn, setTotalBorn] = useState(litter?.totalBorn ? String(litter.totalBorn) : "");
  const [notes, setNotes] = useState(litter?.notes || "");
  const [puppies, setPuppies] = useState(() =>
    litter?.puppies?.length
      ? litter.puppies.map(p => ({ ...p }))
      : []
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const addPuppy = () => {
    setPuppies(p => [...p, {
      id: newId(),
      name: `Puppy ${p.length + 1}`,
      sex: "female",
      color: "",
      status: "kept",
      placedTo: "",
      placePrice: "",
      placeDate: "",
      notes: "",
    }]);
  };

  const updatePuppy = (idx, patch) => {
    setPuppies(p => p.map((x, i) => i === idx ? { ...x, ...patch } : x));
  };

  const removePuppy = (idx) => {
    setPuppies(p => p.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    if (!breedingId || !whelpDate) return;
    onSave({
      id: litter?.id || newId(),
      breedingId,
      whelpDate,
      totalBorn: parseInt(totalBorn) || puppies.length,
      notes: notes.trim(),
      puppies: puppies.map(p => ({
        ...p,
        placePrice: parseFloat(p.placePrice) || 0,
        name: (p.name || "").trim(),
        color: (p.color || "").trim(),
        placedTo: (p.placedTo || "").trim(),
        notes: (p.notes || "").trim(),
      })),
    });
    onClose();
  };

  const breeding = eligibleBreedings.find(b => b.id === breedingId);
  const dam = animals.find(a => a.id === breeding?.damId);

  return (
    <ModalShell title={editing ? "Edit litter" : "Record litter"} onClose={onClose} maxWidth={520}>
      {eligibleBreedings.length === 0 ? (
        <div style={{ padding: 14, background: palette.bgAlt, borderRadius: 8, fontSize: 13, color: palette.inkSoft, marginBottom: 12, lineHeight: 1.5 }}>
          You'll need to log a breeding first before recording a litter.
        </div>
      ) : (
        <>
          <Field label="From breeding">
            <select style={inputStyle} value={breedingId} onChange={(e) => setBreedingId(e.target.value)}>
              {eligibleBreedings.map(b => {
                const damName = animals.find(a => a.id === b.damId)?.name || "?";
                return <option key={b.id} value={b.id}>{damName} · {fmtDate(b.breedDate)}</option>;
              })}
            </select>
          </Field>

          {dam && (
            <div style={{ padding: "8px 12px", background: palette.yolkSoft, borderRadius: 8, fontSize: 12, color: palette.ink, marginBottom: 12, lineHeight: 1.4 }}>
              Dam: <strong>{dam.name}</strong>{breeding?.expectedWhelpDate ? ` · expected ${fmtDate(breeding.expectedWhelpDate)}` : ""}
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Field label="Whelp date">
                <input type="date" style={inputStyle} value={whelpDate} onChange={(e) => setWhelpDate(e.target.value)} />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Total born">
                <input type="number" min={0} style={inputStyle} value={totalBorn} onChange={(e) => setTotalBorn(e.target.value)} placeholder="auto from puppy count" />
              </Field>
            </div>
          </div>

          <Field label="Notes">
            <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical", fontFamily: FONT_BODY }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Complications, vet intervention, etc." />
          </Field>

          {/* PUPPIES */}
          <div style={{ marginTop: 18, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>
              Puppies ({puppies.length})
            </div>
            <Btn small variant="leaf" onClick={addPuppy}>+ Add puppy</Btn>
          </div>

          {puppies.length === 0 && (
            <div style={{ padding: 14, background: palette.card, border: `1.5px dashed ${palette.line}`, borderRadius: 8, fontSize: 12, color: palette.inkSoft, textAlign: "center", marginBottom: 10 }}>
              Tap "+ Add puppy" for each pup in the litter.
            </div>
          )}

          {puppies.map((p, idx) => (
            <div key={p.id} style={{
              padding: 12, marginBottom: 10,
              background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 10,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <input
                  style={{ ...inputStyle, fontWeight: 600, padding: "6px 10px", width: "60%" }}
                  value={p.name}
                  onChange={(e) => updatePuppy(idx, { name: e.target.value })}
                  placeholder="Puppy name"
                />
                <button onClick={() => removePuppy(idx)} aria-label="Remove puppy" style={{
                  background: "none", border: "none", color: palette.accent, cursor: "pointer", padding: 4,
                }}><Trash2 size={16} /></button>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <select style={{ ...inputStyle, flex: 1 }} value={p.sex} onChange={(e) => updatePuppy(idx, { sex: e.target.value })}>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
                <input style={{ ...inputStyle, flex: 1 }} value={p.color} onChange={(e) => updatePuppy(idx, { color: e.target.value })} placeholder="Color" />
              </div>
              <select style={inputStyle} value={p.status} onChange={(e) => updatePuppy(idx, { status: e.target.value })}>
                <option value="kept">Keeping</option>
                <option value="sold">Sold</option>
                <option value="gifted">Gifted</option>
                <option value="died">Died</option>
              </select>
              {(p.status === "sold" || p.status === "gifted") && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <input style={{ ...inputStyle, flex: 2 }} value={p.placedTo} onChange={(e) => updatePuppy(idx, { placedTo: e.target.value })} placeholder="Placed with" />
                    {p.status === "sold" && (
                      <input type="number" step="0.01" min={0} style={{ ...inputStyle, flex: 1 }} value={p.placePrice} onChange={(e) => updatePuppy(idx, { placePrice: e.target.value })} placeholder="$" />
                    )}
                  </div>
                  <input type="date" style={inputStyle} value={p.placeDate} onChange={(e) => updatePuppy(idx, { placeDate: e.target.value })} />
                </div>
              )}
            </div>
          ))}
        </>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        {editing && onDelete ? (
          confirmDelete ? (
            <div style={{ display: "flex", gap: 6 }}>
              <Btn variant="ghost" small onClick={() => setConfirmDelete(false)}>Cancel</Btn>
              <Btn variant="danger" small onClick={() => { onDelete(litter.id); onClose(); }}>Confirm delete</Btn>
            </div>
          ) : (
            <Btn variant="ghost" small onClick={() => setConfirmDelete(true)}>Delete</Btn>
          )
        ) : <div />}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={!breedingId || !whelpDate}>Save</Btn>
        </div>
      </div>
    </ModalShell>
  );
}

// ============ ATTACK PREVENTED MODAL ============
const PREDATOR_TYPES = ["Coyote", "Fox", "Hawk", "Eagle", "Owl", "Bear", "Cougar", "Bobcat", "Stray dog", "Unknown", "Other"];
const LIVESTOCK_SPECIES = ["Chickens", "Ducks", "Turkeys", "Sheep", "Goats", "Cattle", "Pigs", "Rabbits", "Multiple", "Other"];

function AttackModal({ dogs, attack, onSave, onDelete, onClose }) {
  const lgds = dogs.filter(d => !d.archived && d.isLGD);
  const [date, setDate] = useState(attack?.date || todayStr());
  const [dogId, setDogId] = useState(attack?.dogId || lgds[0]?.id || "");
  const [predatorType, setPredatorType] = useState(attack?.predatorType || "Coyote");
  const [livestockSpecies, setLivestockSpecies] = useState(attack?.livestockSpecies || "Chickens");
  const [attackResult, setAttackResult] = useState(attack?.attackResult || "deterred");
  const [livestockLost, setLivestockLost] = useState(attack?.livestockLost ? String(attack.livestockLost) : "");
  const [predatorsKilled, setPredatorsKilled] = useState(attack?.predatorsKilled ? String(attack.predatorsKilled) : "");
  const [notes, setNotes] = useState(attack?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    if (!dogId || !date) return;
    onSave({
      id: attack?.id || newId(),
      date, dogId, predatorType, livestockSpecies, attackResult,
      // Only persist the relevant count field; clear the other so we don't
      // carry stale data if the user toggled between outcomes.
      livestockLost: attackResult === "partial" ? (parseInt(livestockLost, 10) || 0) : null,
      predatorsKilled: attackResult === "killed_predator" ? (parseInt(predatorsKilled, 10) || 1) : null,
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <ModalShell title={attack ? "Edit attack record" : "🛡️ Log attack prevented"} onClose={onClose}>
      {lgds.length === 0 ? (
        <div style={{ padding: 14, background: palette.bgAlt, borderRadius: 8, fontSize: 13, color: palette.inkSoft, marginBottom: 12, lineHeight: 1.5 }}>
          Mark at least one dog as a Livestock Guardian Dog (LGD) to log attacks. Open a dog and toggle the LGD checkbox.
        </div>
      ) : (
        <>
          <Field label="Date">
            <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Guardian dog">
            <select style={inputStyle} value={dogId} onChange={(e) => setDogId(e.target.value)}>
              {lgds.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Field label="Predator">
                <select style={inputStyle} value={predatorType} onChange={(e) => setPredatorType(e.target.value)}>
                  {PREDATOR_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Threatened">
                <select style={inputStyle} value={livestockSpecies} onChange={(e) => setLivestockSpecies(e.target.value)}>
                  {LIVESTOCK_SPECIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          </div>
          <Field label="Outcome">
            <select style={inputStyle} value={attackResult} onChange={(e) => setAttackResult(e.target.value)}>
              <option value="deterred">Deterred — no losses</option>
              <option value="partial">Some losses, prevented more</option>
              <option value="killed_predator">Dog killed the predator</option>
            </select>
          </Field>

          {/* Conditional fields based on outcome */}
          {attackResult === "partial" && (
            <Field label={`${livestockSpecies} lost`}>
              <input
                type="number" min={0} inputMode="numeric"
                style={inputStyle}
                value={livestockLost}
                onChange={(e) => setLivestockLost(e.target.value)}
                placeholder="How many were lost?"
                autoFocus
              />
            </Field>
          )}
          {attackResult === "killed_predator" && (
            <Field label={`${predatorType === "Other" || predatorType === "Unknown" ? "Predators" : `${predatorType.toLowerCase()}${predatorType.endsWith("s") ? "" : "s"}`} killed`}>
              <input
                type="number" min={1} inputMode="numeric"
                style={inputStyle}
                value={predatorsKilled}
                onChange={(e) => setPredatorsKilled(e.target.value)}
                placeholder="Usually 1, but track multiples"
                autoFocus
              />
            </Field>
          )}

          <Field label="Notes">
            <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical", fontFamily: FONT_BODY }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Time of day, observation, etc." />
          </Field>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        {attack && onDelete ? (
          confirmDelete ? (
            <div style={{ display: "flex", gap: 6 }}>
              <Btn variant="ghost" small onClick={() => setConfirmDelete(false)}>Cancel</Btn>
              <Btn variant="danger" small onClick={() => { onDelete(attack.id); onClose(); }}>Confirm delete</Btn>
            </div>
          ) : (
            <Btn variant="ghost" small onClick={() => setConfirmDelete(true)}>Delete</Btn>
          )
        ) : <div />}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={!dogId || !date || lgds.length === 0}>Save</Btn>
        </div>
      </div>
    </ModalShell>
  );
}

// ============ LOG ENTRY MODAL (weight / health / note / death / sale) ============
function LogEntryModal({ animals, action, onSave, onClose, customers = [] }) {
  const live = animals.filter(a => !a.archived);
  const [date, setDate] = useState(todayStr());
  const [animalId, setAnimalId] = useState(live[0]?.id || "");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  // Feed action fields. Stored on entry as feedAmount + feedUnit; the legacy
  // `lbs` field also gets written when unit=lbs for back-compat with shared
  // analytics that scan for it. Default unit is lbs (matches buying kibble
  // by the bag); cups for users who measure by scoop.
  const [feedAmount, setFeedAmount] = useState("");
  const [feedUnit, setFeedUnit] = useState("lbs");
  const [feedCost, setFeedCost] = useState("");
  // Sale-only fields
  const [saleBuyer, setSaleBuyer] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [showNewBuyer, setShowNewBuyer] = useState(false);
  const [salePrice, setSalePrice] = useState("");
  const [saleType, setSaleType] = useState("sold");

  const animalRequired = action === "weight" || action === "health" || action === "death" || action === "sale";

  const titles = {
    weight: "⚖️ Log weight",
    fed:    "🍖 Log feeding",
    health: "💊 Vet / meds",
    death:  "🪦 Log death",
    sale:   "🏷️ Log sale",
    note:   "📝 Add note",
  };
  const subtexts = {
    weight: "Weight check — useful for growth tracking and dosage calculations.",
    fed:    "Log how much food you went through — for the whole pack or a specific dog. Picking a dog is optional.",
    health: "Vaccines, dewormer, heartworm, vet visits — anything health-related.",
    death:  "This will archive the dog. Cause of death goes in notes.",
    sale:   "This will archive the dog and create a sale record in your Sales tab.",
    note:   "General observation about a specific dog or the pack overall.",
  };
  const noteRequired = action === "note" || action === "health" || action === "death";

  const canSave = (() => {
    if (animalRequired && !animalId) return false;
    if (action === "weight" && !parseFloat(weight)) return false;
    if (action === "fed" && !parseFloat(feedAmount)) return false;
    if (noteRequired && !notes.trim()) return false;
    return true;
  })();

  const handleSave = () => {
    if (!canSave) return;
    const entry = {
      id: newId(), date, action,
      animalId: animalId || null,
      notes: notes.trim(),
      created: Date.now(),
    };
    if (action === "weight") entry.weight = parseFloat(weight) || 0;
    if (action === "fed") {
      // Write unit-aware fields; also fill legacy `lbs` when unit=lbs so any
      // shared "sum total feed bought" code that scans across hobbies keeps
      // working without needing per-species awareness.
      entry.feedAmount = parseFloat(feedAmount) || 0;
      entry.feedUnit = feedUnit;
      entry.lbs = feedUnit === "lbs" ? (parseFloat(feedAmount) || 0) : 0;
      entry.cost = parseFloat(feedCost) || 0;
    }
    if (action === "sale") {
      entry.buyer = saleBuyer.trim();
      entry.price = Number(salePrice) || 0;
      entry.saleType = saleType;
    }
    if (action === "death") {
      onSave({ entry, animalId, archiveReason: "died" });
    } else if (action === "sale") {
      const verb = saleType === "leased" ? "Leased" : saleType === "rehomed" ? "Rehomed" : "Sold";
      const priceStr = Number(salePrice) > 0 ? ` for $${Number(salePrice).toFixed(2)}` : "";
      const buyerStr = saleBuyer.trim() ? ` to ${saleBuyer.trim()}` : "";
      onSave({
        entry, animalId,
        archiveReason: `${verb}${buyerStr}${priceStr}`,
        saleData: {
          id: entry.id, date, hobbyType: "dog",
          crop: (live.find(a => a.id === animalId) || {}).name || "",
          saleType,
          pricePerUnit: Number(salePrice) || 0,
          totalRevenue: Number(salePrice) || 0,
          qty: 1, animalId, buyer: saleBuyer.trim(), buyerId: buyerId || null,
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
      <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 12, lineHeight: 1.5 }}>{subtexts[action]}</div>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <Field label={animalRequired ? "Dog" : "Dog (optional)"}>
        <select style={inputStyle} value={animalId} onChange={e => setAnimalId(e.target.value)}>
          {!animalRequired && <option value="">— Whole pack —</option>}
          {live.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      {action === "weight" && (()=>{
        const isMetricW=getCurrentWeightUnit()==="kg";
        const shown=weight===""||weight==null?"":(isMetricW?String(Math.round(weightFromLbs(Number(weight))*100)/100):weight);
        return (
        <Field label={isMetricW?"Weight (kg)":"Weight (lbs)"}>
          <input type="number" step="0.1" min={0} style={inputStyle} value={shown} onChange={e => {const r=e.target.value;setWeight(r===""?"":(isMetricW?String(lbsFromInput(r)):r));}} placeholder="0" autoFocus inputMode="decimal" />
        </Field>
        );
      })()}
      {action === "fed" && (
        <>
          <Field label="How much feed?">
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              {["lbs", "cups"].map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setFeedUnit(u)}
                  style={{
                    flex: 1, padding: "8px 10px", borderRadius: 8,
                    border: `1.5px solid ${feedUnit === u ? palette.ink : palette.line}`,
                    background: feedUnit === u ? palette.ink : palette.card,
                    color: feedUnit === u ? palette.bg : palette.ink,
                    fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >{/* storage stays "lbs"; label shows "kg" in metric mode */}
                  {u === "lbs" ? weightUnitLabel() : u}</button>
              ))}
            </div>
            {(()=>{
              // feedAmount is stored in lbs when feedUnit==="lbs". In kg-mode
              // the field shows/accepts kg and converts on the boundary.
              const metricW=getCurrentWeightUnit()==="kg";
              const isCups=feedUnit==="cups";
              const shown=isCups
                ? feedAmount
                : (feedAmount===""||feedAmount==null
                    ? ""
                    : (metricW?String(Math.round(weightFromLbs(Number(feedAmount))*100)/100):feedAmount));
              const ph=isCups?"Cups of feed":(metricW?"Kilograms of feed":"Pounds of feed");
              return <input
                type="number" inputMode="decimal" step="0.1" min={0}
                style={inputStyle}
                value={shown}
                onChange={e => {
                  const r=e.target.value;
                  if(isCups){setFeedAmount(r);return;}
                  if(r===""){setFeedAmount("");return;}
                  setFeedAmount(metricW?String(lbsFromInput(r)):r);
                }}
                placeholder={ph}
                autoFocus
              />;
            })()}
          </Field>
          <Field label="Cost ($, optional)">
            <input
              type="number" inputMode="decimal" step="0.01" min={0}
              style={inputStyle}
              value={feedCost}
              onChange={e => setFeedCost(e.target.value)}
              placeholder="$0.00"
            />
          </Field>
        </>
      )}
      {action === "sale" && (
        <>
          <Field label="Type">
            <select style={inputStyle} value={saleType} onChange={e => setSaleType(e.target.value)}>
              <option value="sold">Sold</option>
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
            action === "health" ? "e.g. Rabies vaccine, heartworm prevention" :
            action === "death" ? "Cause / circumstances" :
            action === "sale" ? "Additional notes" :
            action === "fed" ? "e.g. bag of Purina Pro Plan, brand of food" :
            action === "note" ? "What happened" : ""
          }
          autoFocus={action !== "weight" && action !== "fed"}
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

// ============================================================================
// MAIN DOGS PAGE
// ============================================================================

// ============================================================================
// HERD TALLY — count-only tracking that coexists with individual animals
// ----------------------------------------------------------------------------
// Lets users record a simple per-sex head count for dogs they don't want to
// track as individual records. Lives ALONGSIDE the individual animal list — it
// does not replace it, and deliberately does NOT feed breeding, pedigree,
// history, or sales (all of which stay individual-animal-only). Stored as
// hobby.herdTally, an object keyed by these category labels.
// ============================================================================
function HerdTallySection({ hobby, update }) {
  const HERD_TALLY_CATEGORIES = ["Female","Male","Unsexed"];
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
            Got dogs you don't want to name individually? Record a simple head count by sex here — separate from your named animals.
          </div>
        )}
      </div>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="Herd tally">
          <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
            Record a head count by sex for dogs you don't want to track individually. Separate from your named animals — it doesn't affect breeding, history, or sales.
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

export default function DogsPage({ hobby, data, update, setModal, user }) {
  const [dogModal, setDogModal] = useState({ open: false, dog: null });
  const [breedingModal, setBreedingModal] = useState({ open: false, breeding: null });
  const [litterModal, setLitterModal] = useState({ open: false, litter: null });
  const [attackModal, setAttackModal] = useState({ open: false, attack: null });
  const [logEntryAction, setLogEntryAction] = useState(null);
  const [historyAnimal, setHistoryAnimal] = useState(null);

  const dogs = (hobby?.animals || []).filter(a => !a.archived);
  const archived = (hobby?.animals || []).filter(a => a.archived);
  const lgds = dogs.filter(d => d.isLGD);
  const breedings = (hobby?.breedings || []).slice().sort((a, b) => (b.breedDate || "").localeCompare(a.breedDate || ""));
  const litters = (hobby?.litters || []).slice().sort((a, b) => (b.whelpDate || "").localeCompare(a.whelpDate || ""));
  const attacks = (hobby?.attacks || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const saveDog = (dog) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.animals)) h.animals = [];
      const idx = h.animals.findIndex(x => x.id === dog.id);
      if (idx >= 0) h.animals[idx] = dog; else h.animals.push(dog);
      return d;
    });
  };
  const deleteDog = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h) h.animals = (h.animals || []).filter(a => a.id !== id);
      return d;
    });
  };
  const archiveDog = (id, reason) => {
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
  const saveBreeding = (b) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.breedings)) h.breedings = [];
      const idx = h.breedings.findIndex(x => x.id === b.id);
      if (idx >= 0) h.breedings[idx] = b; else h.breedings.push(b);
      return d;
    });
  };
  const deleteBreeding = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h) h.breedings = (h.breedings || []).filter(b => b.id !== id);
      return d;
    });
  };
  const saveLitter = (l) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.litters)) h.litters = [];
      const idx = h.litters.findIndex(x => x.id === l.id);
      if (idx >= 0) h.litters[idx] = l; else h.litters.push(l);
      return d;
    });
  };
  const deleteLitter = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h) h.litters = (h.litters || []).filter(l => l.id !== id);
      return d;
    });
  };
  const saveAttack = (a) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.attacks)) h.attacks = [];
      const idx = h.attacks.findIndex(x => x.id === a.id);
      if (idx >= 0) h.attacks[idx] = a; else h.attacks.push(a);
      return d;
    });
  };
  const deleteAttack = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h) h.attacks = (h.attacks || []).filter(a => a.id !== id);
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
  const addCalendarEvent = (event) => {
    update(d => {
      if (!Array.isArray(d.calendarEvents)) d.calendarEvents = [];
      d.calendarEvents.push(event);
      return d;
    });
  };

  // Active upcoming whelpings (within next 21 days, no whelpedDate yet)
  const upcomingWhelpings = breedings.filter(b => {
    if (b.whelpedDate) return false;
    if (!b.expectedWhelpDate) return false;
    const d = parseLocalDate(b.expectedWhelpDate);
    const now = new Date();
    const diff = (d - now) / (1000 * 60 * 60 * 24);
    return diff >= -3 && diff <= 30; // include slightly overdue
  });

  const totalAttacks = attacks.length;
  const totalPuppiesBorn = litters.reduce((s, l) => s + (l.totalBorn || (l.puppies?.length || 0)), 0);
  const totalRevenue = litters.reduce((s, l) =>
    s + (l.puppies || []).reduce((ps, p) => ps + (p.status === "sold" ? (p.placePrice || 0) : 0), 0)
  , 0);

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 28, margin: 0, color: palette.ink }}>🐕 Dogs</h1>
        <Btn variant="primary" small onClick={() => setDogModal({ open: true, dog: null })}>+ Add dog</Btn>
      </div>

      {/* Quick stats */}
      <HerdTallySection hobby={hobby} update={update}/>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Dogs" value={dogs.length} accent={palette.leaf} />
        {lgds.length > 0 && <StatCard label="LGDs" value={lgds.length} accent={palette.feather} />}
        {lgds.length > 0 && <StatCard label="Attacks prevented" value={totalAttacks} accent={palette.accent} />}
        {litters.length > 0 && <StatCard label="Litters" value={litters.length} sub={`${totalPuppiesBorn} pups`} accent={palette.yolk} />}
      </div>

      {/* LGD ATTACK QUICK-LOG (only if any LGDs exist) */}
      {lgds.length > 0 && (
        <div style={{
          marginBottom: 16, padding: "12px 14px",
          background: palette.leafSoft, border: `1.5px solid ${palette.leaf}`,
          borderRadius: 12,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: palette.ink, lineHeight: 1.2 }}>🛡️ Guardian protection</div>
              <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 2 }}>
                {totalAttacks === 0 ? "No attacks logged yet" : `${totalAttacks} threat${totalAttacks === 1 ? "" : "s"} deterred`}
              </div>
            </div>
            <Btn small variant="leaf" onClick={() => setAttackModal({ open: true, attack: null })}>+ Log attack</Btn>
          </div>
        </div>
      )}

      {/* UPCOMING WHELPINGS */}
      {upcomingWhelpings.length > 0 && (
        <div style={{ marginBottom: 16, padding: "12px 14px", background: palette.yolkSoft, borderRadius: 10, border: `1.5px solid ${palette.line}` }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, marginBottom: 6, color: palette.ink }}>🐕 Upcoming whelpings</div>
          {upcomingWhelpings.map(b => {
            const dam = dogs.find(a => a.id === b.damId);
            const daysUntil = Math.ceil((parseLocalDate(b.expectedWhelpDate) - new Date()) / (1000 * 60 * 60 * 24));
            return (
              <div key={b.id} style={{ fontSize: 13, color: palette.ink, marginTop: 2 }}>
                <strong>{dam?.name || "Dam"}</strong> — {fmtDate(b.expectedWhelpDate)} ({daysUntil > 0 ? `in ${daysUntil} day${daysUntil === 1 ? "" : "s"}` : daysUntil === 0 ? "today!" : `${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? "" : "s"} overdue`})
              </div>
            );
          })}
        </div>
      )}

      {/* QUICK ACTIONS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8, marginBottom: 18 }}>
        <Btn small variant="leaf" onClick={() => setBreedingModal({ open: true, breeding: null })} style={{ width: "100%" }}>🐕 Breeding</Btn>
        <Btn small variant="leaf" onClick={() => setLitterModal({ open: true, litter: null })} style={{ width: "100%" }}>👶 Litter</Btn>
        <Btn small onClick={() => setLogEntryAction("weight")} style={{ width: "100%" }}>⚖️ Weight</Btn>
        <Btn small onClick={() => setLogEntryAction("fed")} style={{ width: "100%" }}>🍖 Fed</Btn>
        <Btn small onClick={() => setLogEntryAction("health")} style={{ width: "100%" }}>💊 Vet / meds</Btn>
        <Btn small onClick={() => setLogEntryAction("note")} style={{ width: "100%" }}>📝 Note</Btn>
        <Btn small variant="danger" onClick={() => setLogEntryAction("death")} style={{ width: "100%" }}>🪦 Died</Btn>
        <Btn small onClick={() => setLogEntryAction("sale")} style={{ width: "100%" }}>🏷️ Sale</Btn>
      </div>

      {/* DOGS LIST */}
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 20, margin: "16px 0 10px", color: palette.ink }}>The pack</h2>
      {dogs.length === 0 ? (
        <div style={{ padding: "24px 16px", textAlign: "center", background: palette.card, border: `1.5px dashed ${palette.line}`, borderRadius: 12, color: palette.inkSoft, fontSize: 14, lineHeight: 1.6 }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🐕</div>
          No dogs yet. Tap <strong>+ Add dog</strong>.
        </div>
      ) : (
        dogs.map(d => {
          const dogAttacks = d.isLGD ? attacks.filter(a => a.dogId === d.id) : [];
          return (
            <div key={d.id} onClick={() => setDogModal({ open: true, dog: d })} style={{
              padding: "12px 14px", background: palette.card,
              border: `1.5px solid ${palette.line}`, borderRadius: 10,
              marginBottom: 8, cursor: "pointer",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, lineHeight: 1.2, display: "flex", alignItems: "center", gap: 8 }}>
                    <LivestockProfileCircle animal={d} emoji="🐕" size={20} />
                    {d.name}
                    {d.isLGD && <span style={{ fontSize: 11, padding: "2px 6px", background: palette.leafSoft, color: palette.ink, borderRadius: 999, fontFamily: FONT_BODY, fontWeight: 600 }}>🛡️ LGD</span>}
                  </div>
                  <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 4 }}>
                    {d.sex === "female" ? "♀" : "♂"} · {fmtAge(d.birthdate)}
                    {d.breed && ` · ${d.breed}`}
                    {d.color && ` · ${d.color}`}
                  </div>
                  {d.isLGD && dogAttacks.length > 0 && (
                    <div style={{ fontSize: 12, color: palette.leaf, marginTop: 4, fontWeight: 600 }}>
                      🛡️ {dogAttacks.length} attack{dogAttacks.length === 1 ? "" : "s"} deterred
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setHistoryAnimal(d); }}
                  aria-label={`View history for ${d.name}`}
                  style={{
                    padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: FONT_BODY,
                    border: `1.5px solid ${palette.line}`, background: palette.bgAlt, cursor: "pointer", color: palette.ink,
                    flexShrink: 0,
                  }}
                >📜 History</button>
              </div>
            </div>
          );
        })
      )}

      {/* BREEDINGS */}
      {breedings.length > 0 && (
        <>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 20, margin: "20px 0 10px", color: palette.ink }}>Breedings</h2>
          {breedings.slice(0, 6).map(b => {
            const dam = dogs.find(a => a.id === b.damId) || archived.find(a => a.id === b.damId);
            const sire = b.sireExternal || (dogs.find(a => a.id === b.sireId) || archived.find(a => a.id === b.sireId))?.name || "?";
            return (
              <div key={b.id} onClick={() => setBreedingModal({ open: true, breeding: b })} style={{
                padding: "10px 12px", background: palette.card,
                border: `1.5px solid ${palette.line}`, borderRadius: 10,
                marginBottom: 8, cursor: "pointer",
              }}>
                <div style={{ fontSize: 13, color: palette.ink }}>
                  <strong>{dam?.name || "Dam"}</strong> × {sire}
                </div>
                <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 2 }}>
                  Bred {fmtDate(b.breedDate)}
                  {b.expectedWhelpDate && ` · expected ${fmtDate(b.expectedWhelpDate)}`}
                  {b.whelpedDate && ` · whelped ${fmtDate(b.whelpedDate)}`}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* LITTERS */}
      {litters.length > 0 && (
        <>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 20, margin: "20px 0 10px", color: palette.ink }}>Litters</h2>
          {litters.map(l => {
            const breeding = breedings.find(b => b.id === l.breedingId);
            const dam = dogs.find(a => a.id === breeding?.damId) || archived.find(a => a.id === breeding?.damId);
            return (
              <div key={l.id} onClick={() => setLitterModal({ open: true, litter: l })} style={{
                padding: "12px 14px", background: palette.card,
                border: `1.5px solid ${palette.line}`, borderRadius: 10,
                marginBottom: 8, cursor: "pointer",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: palette.ink }}>
                    {dam?.name || "Dam"}'s litter
                  </div>
                  <div style={{ fontSize: 11, color: palette.inkSoft }}>{fmtDate(l.whelpDate)}</div>
                </div>
                <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 4 }}>
                  {l.puppies?.length || 0} pup{(l.puppies?.length || 0) === 1 ? "" : "s"}
                  {l.puppies && ` · ${l.puppies.filter(p => p.status === "sold").length} sold, ${l.puppies.filter(p => p.status === "kept").length} kept`}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ATTACK LOG (LGD only) */}
      {lgds.length > 0 && attacks.length > 0 && (
        <>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 20, margin: "20px 0 10px", color: palette.ink }}>🛡️ Attacks deterred</h2>
          {attacks.slice(0, 10).map(a => {
            const dog = dogs.find(d => d.id === a.dogId) || archived.find(d => d.id === a.dogId);
            // Build outcome detail string based on what we tracked
            let outcomeDetail = "";
            if (a.attackResult === "partial" && a.livestockLost) {
              outcomeDetail = ` · ${a.livestockLost} lost`;
            } else if (a.attackResult === "killed_predator") {
              const n = a.predatorsKilled || 1;
              outcomeDetail = ` · ${n} predator${n === 1 ? "" : "s"} killed`;
            }
            return (
              <div key={a.id} onClick={() => setAttackModal({ open: true, attack: a })} style={{
                padding: "10px 12px", background: palette.card,
                border: `1.5px solid ${palette.line}`, borderRadius: 10,
                marginBottom: 8, cursor: "pointer",
              }}>
                <div style={{ fontSize: 13, color: palette.ink }}>
                  <strong>{dog?.name || "Dog"}</strong> vs {a.predatorType.toLowerCase()} — protecting {a.livestockSpecies.toLowerCase()}
                </div>
                <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 2 }}>{fmtDate(a.date)}{outcomeDetail}</div>
                {a.notes && <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 4, fontStyle: "italic" }}>{a.notes}</div>}
              </div>
            );
          })}
        </>
      )}

      {/* ARCHIVED DOGS */}
      {archived.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, marginBottom: 8 }}>
            Past dogs ({archived.length})
          </div>
          {archived.slice(0, 5).map(a => (
            <div key={a.id} style={{ padding: "6px 10px", fontSize: 12, color: palette.inkSoft, borderBottom: `1px solid ${palette.line}` }}>
              {a.name} {a.archivedDate ? `· ${fmtDate(a.archivedDate)}` : ""} {a.archivedReason ? `· ${a.archivedReason}` : ""}
            </div>
          ))}
        </div>
      )}

      {/* MODALS */}
      {dogModal.open && (
        <DogModal
          dog={dogModal.dog} dogs={hobby?.animals || []}
          onSave={saveDog}
          onDelete={dogModal.dog ? deleteDog : null}
          onClose={() => setDogModal({ open: false, dog: null })}
          update={update}
          user={user}
          hobbyId={hobby.id}
        />
      )}
      {breedingModal.open && (
        <BreedingModal
          animals={hobby?.animals || []}
          breeding={breedingModal.breeding}
          onSave={saveBreeding}
          onDelete={breedingModal.breeding ? deleteBreeding : null}
          onClose={() => setBreedingModal({ open: false, breeding: null })}
          addCalendarEvent={addCalendarEvent}
        />
      )}
      {litterModal.open && (
        <LitterModal
          animals={hobby?.animals || []}
          breedings={hobby?.breedings || []}
          litter={litterModal.litter}
          onSave={saveLitter}
          onDelete={litterModal.litter ? deleteLitter : null}
          onClose={() => setLitterModal({ open: false, litter: null })}
        />
      )}
      {attackModal.open && (
        <AttackModal
          dogs={hobby?.animals || []}
          attack={attackModal.attack}
          onSave={saveAttack}
          onDelete={attackModal.attack ? deleteAttack : null}
          onClose={() => setAttackModal({ open: false, attack: null })}
        />
      )}
      {historyAnimal && (
        <AnimalHistoryView
          update={update}
          animal={historyAnimal}
          hobby={hobby}
          entries={(data?.entries?.[hobby.id]) || []}
          sales={data?.sales || []}
          species="dog"
          onClose={() => setHistoryAnimal(null)}
        />
      )}
      {logEntryAction && (
        <LogEntryModal
          animals={hobby?.animals || []}
          customers={data.customers || []}
          action={logEntryAction}
          onSave={(payload) => {
            if (payload && payload.entry) {
              addEntry(payload.entry);
              if (payload.archiveReason && payload.animalId) {
                archiveDog(payload.animalId, payload.archiveReason);
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
    </div>
  );
}

// ============================================================================
// ANALYTICS
// ============================================================================
export function DogsAnalytics({ hobby }) {
  const dogs = (hobby?.animals || []).filter(a => !a.archived);
  const lgds = dogs.filter(d => d.isLGD);
  const attacks = hobby?.attacks || [];
  const litters = hobby?.litters || [];

  // Aggregate puppies across litters
  const allPuppies = litters.flatMap(l => l.puppies || []);
  const totalBorn = litters.reduce((s, l) => s + (l.totalBorn || (l.puppies?.length || 0)), 0);
  const sold = allPuppies.filter(p => p.status === "sold");
  const kept = allPuppies.filter(p => p.status === "kept").length;
  const gifted = allPuppies.filter(p => p.status === "gifted").length;
  const died = allPuppies.filter(p => p.status === "died").length;
  const revenue = sold.reduce((s, p) => s + (p.placePrice || 0), 0);

  // LGD efficacy stats — separate from raw "attacks logged" count so the
  // user can see (a) how often they intervened, (b) how successful those
  // interventions were, (c) the harder truth: how many losses still happened.
  const totalPredatorsKilled = attacks.reduce((s, a) => s + (a.predatorsKilled || 0), 0);
  const totalLivestockLost = attacks.reduce((s, a) => s + (a.livestockLost || 0), 0);
  const cleanDeters = attacks.filter(a => a.attackResult === "deterred").length;

  // Attacks per dog
  const attacksByDog = useMemo(() => {
    const map = {};
    attacks.forEach(a => {
      if (!map[a.dogId]) map[a.dogId] = 0;
      map[a.dogId] += 1;
    });
    return lgds
      .map(d => ({ name: d.name, attacks: map[d.id] || 0 }))
      .sort((a, b) => b.attacks - a.attacks);
  }, [attacks, lgds]);

  // Attacks by predator type
  const attacksByPredator = useMemo(() => {
    const map = {};
    attacks.forEach(a => {
      const k = a.predatorType || "Unknown";
      if (!map[k]) map[k] = 0;
      map[k] += 1;
    });
    return Object.entries(map).map(([predator, count]) => ({ predator, count })).sort((a, b) => b.count - a.count);
  }, [attacks]);

  return (
    <div style={{ paddingBottom: 80 }}>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, margin: "0 0 14px", color: palette.ink }}>🐕 Dogs Stats</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Dogs" value={dogs.length} accent={palette.leaf} />
        {lgds.length > 0 && <StatCard label="Guardians" value={lgds.length} accent={palette.feather} />}
        {lgds.length > 0 && <StatCard label="Attacks deterred" value={attacks.length} accent={palette.accent} />}
        {litters.length > 0 && <StatCard label="Litters" value={litters.length} accent={palette.yolk} />}
      </div>

      {/* LGD protection summary — only shows when LGDs are tracking attacks */}
      {lgds.length > 0 && attacks.length > 0 && (
        <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 10 }}>🛡️ Protection summary</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatCard label="Clean deters" value={cleanDeters} sub="no losses" accent={palette.leaf} />
            {totalPredatorsKilled > 0 && <StatCard label="Predators killed" value={totalPredatorsKilled} accent={palette.feather} />}
            {totalLivestockLost > 0 && <StatCard label="Losses despite" value={totalLivestockLost} sub="livestock lost" accent={palette.accent} />}
          </div>
        </div>
      )}

      {/* LGD chart */}
      {lgds.length > 0 && attacks.length > 0 && (
        <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 8 }}>🛡️ Attacks deterred per dog</div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attacksByDog}>
                <XAxis dataKey="name" style={{ fontSize: 11 }} />
                <YAxis style={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="attacks" fill={palette.leaf} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Predator breakdown */}
      {attacksByPredator.length > 0 && (
        <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 8 }}>Predators deterred</div>
          {attacksByPredator.map(({ predator, count }) => (
            <div key={predator} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${palette.line}`, fontSize: 13, color: palette.ink }}>
              <span>{predator}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      )}

      {/* Litter / puppy stats */}
      {litters.length > 0 && (
        <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 8 }}>Puppies</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatCard label="Born" value={totalBorn} accent={palette.leaf} />
            <StatCard label="Sold" value={sold.length} accent={palette.accent} />
            <StatCard label="Kept" value={kept} accent={palette.feather} />
            <StatCard label="Gifted" value={gifted} accent={palette.yolk} />
            {revenue > 0 && <StatCard label="Revenue" value={fmtMoney(revenue)} accent={palette.leaf} />}
          </div>
        </div>
      )}
    </div>
  );
}
