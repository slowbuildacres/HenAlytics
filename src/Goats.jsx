// ============================================================================
// GOATS — per-animal tracking, dairy or meat, milk logging, kid tracking
// ============================================================================
import React, { useState, useEffect } from "react";
import { X, Edit3, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { SireDamPicker, PedigreeView } from "./PedigreeView.jsx";
import { AnimalHistoryView } from "./AnimalHistoryView.jsx";
import { fmtWeight, fmtVolume, weightUnitLabel, volumeUnitLabel, lbsFromInput, weightFromLbs, getCurrentWeightUnit, getCurrentVolumeUnit } from "./units.js";
import { photosOf, profilePhotoOf, timelineOf, addPhotoToAnimal, removePhotoFromAnimal, withProfileSet, withPhotoEdited, resolveAnimalPhotoUrl } from "./animalPhotos.js";
// ADV_ANALYTICS: shared advanced-analytics layer (see analytics.js).
import {
  priorDateRange, computeDelta, StatTrend, personalRecord,
  monthlySeries, filterByDateRange, LockedStatOverlay,
} from "./analytics.js";

const palette = {
  bg:"#F4EDE0",bgAlt:"#EBE0CC",ink:"#2C1810",inkSoft:"#5C4530",
  accent:"#C84B31",leaf:"#5A7A3C",leafSoft:"#A8C078",
  yolk:"#E8B547",yolkSoft:"#F2D58A",
  feather:"#8B6F47",line:"#2C181030",card:"#FAF5EA",
}; /* GOATS_UNIFY_V1 — added leafSoft */
const FONT_DISPLAY=`'DM Serif Display', Georgia, serif`;
const FONT_BODY=`'Be Vietnam Pro', -apple-system, sans-serif`;
const inputStyle={width:"100%",padding:"10px 12px",borderRadius:8,border:`1.5px solid ${palette.line}`,background:palette.card,fontFamily:FONT_BODY,fontSize:15,color:palette.ink,boxSizing:"border-box"};
const newId=()=>Math.random().toString(36).slice(2,10);
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
const localDateStr=(d)=>{const dt=d instanceof Date?d:new Date(d);return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;};
const todayStr=()=>localDateStr(new Date());
const parseLocalDate=(s)=>{if(!s)return new Date();const[y,m,d]=s.split("-").map(Number);return new Date(y,(m||1)-1,d||1);};
const fmtDate=(s)=>{if(!s)return"";return parseLocalDate(s).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});};
const fmtMoney=(n)=>`$${(Number(n)||0).toFixed(2)}`;

const GOAT_BREEDS=["Nubian","Boer","Alpine","LaMancha","Oberhasli","Saanen","Toggenburg","Nigerian Dwarf","Kiko","Myotonic (Fainting)","Angora","Pygmy","Mixed","Other"];
const GOAT_PURPOSES=["Dairy","Meat","Both"];
const GOAT_SEXES=["Doe","Buck","Wether","Kid"];

function Btn({children,onClick,variant="primary",small=false,style={},disabled=false}){
  const styles={primary:{background:palette.ink,color:palette.bg,border:`1.5px solid ${palette.ink}`},danger:{background:palette.accent,color:palette.bg,border:`1.5px solid ${palette.accent}`},ghost:{background:"transparent",color:palette.ink,border:`1.5px solid ${palette.line}`},accent:{background:palette.yolk,color:palette.ink,border:`1.5px solid ${palette.ink}`},leaf:{background:palette.leaf,color:palette.bg,border:`1.5px solid ${palette.leaf}`}}; /* GOATS_UNIFY_V1 — leaf variant */
  return <button onClick={disabled?undefined:onClick} disabled={disabled} style={{padding:small?"6px 12px":"10px 18px",borderRadius:8,cursor:disabled?"not-allowed":"pointer",fontFamily:FONT_BODY,fontWeight:600,fontSize:small?13:14,opacity:disabled?0.6:1,boxShadow:"2px 2px 0 "+palette.line,...styles[variant],...style}}>{children}</button>;
}
function Field({label,children}){return <label style={{display:"block",marginBottom:14}}><div style={{fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600}}>{label}</div>{children}</label>;}
function Modal({open,onClose,title,children}){
  if(!open)return null;
  return <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(44,24,16,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16}}><div onClick={e=>e.stopPropagation()} style={{background:palette.bg,borderRadius:16,maxWidth:480,width:"100%",maxHeight:"92vh",overflow:"auto",border:`2px solid ${palette.ink}`,boxShadow:`6px 8px 0 ${palette.line}`,fontFamily:FONT_BODY}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1.5px solid ${palette.line}`}}><div style={{fontFamily:FONT_DISPLAY,fontSize:22,color:palette.ink}}>{title}</div><button onClick={onClose} aria-label="Close" style={{background:"none",border:"none",cursor:"pointer",color:palette.ink,padding:4}}><X size={22}/></button></div><div style={{padding:20}}>{children}</div></div></div>;
}
function StatCard({label,value,sub,accent=palette.accent}){return <div style={{background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,flex:"1 1 130px",minWidth:130,boxSizing:"border-box"}}><div style={{fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{label}</div><div style={{fontSize:22,fontFamily:FONT_DISPLAY,color:accent,lineHeight:1.1}}>{value}</div>{sub&&<div style={{fontSize:11,color:palette.inkSoft,marginTop:4}}>{sub}</div>}</div>;}
function ChartCard({title,children}){return <div style={{background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:12}}><div style={{fontFamily:FONT_DISPLAY,fontSize:18,marginBottom:10,color:palette.ink}}>{title}</div>{children}</div>;}

// ============================================================================
// HERD TALLY — count-only tracking that coexists with individual animals
// ----------------------------------------------------------------------------
// For users who don't want to create an individual record for every animal
// (e.g. a meat herd), the herd tally lets them record simple per-sex counts.
// It lives ALONGSIDE the individual animal list — it does not replace it, and
// it deliberately does NOT feed breeding, pedigree, history, or sales, all of
// which remain individual-animal-only. It's purely a headcount.
//
// Stored as hobby.herdTally — an object keyed by the hobby's own sex labels
// (GOAT_SEXES here) plus an "Unsexed" catch-all bucket. Absent/empty means the
// user hasn't used the feature; the card then shows a low-key prompt instead.
// ============================================================================

// The categories shown in the tally: this hobby's sexes plus an Unsexed bucket.
const HERD_TALLY_CATEGORIES = [...GOAT_SEXES, "Unsexed"];

// Sum a herdTally object safely (handles undefined / missing keys).
function herdTallyTotal(tally){
  if(!tally||typeof tally!=="object")return 0;
  return HERD_TALLY_CATEGORIES.reduce((s,k)=>s+(Number(tally[k])||0),0);
}

function HerdTallyCard({hobby,setModal}){
  const tally=hobby.herdTally||{};
  const total=herdTallyTotal(tally);
  // Only the categories with a positive count, for a compact summary line.
  const present=HERD_TALLY_CATEGORIES.filter(k=>(Number(tally[k])||0)>0);
  return (
    <div style={{background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:total>0?10:0}}>
        <div style={{fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1}}>
          Herd tally{total>0?` · ${total} head`:""}
        </div>
        <Btn small variant="ghost" onClick={()=>setModal({type:"herdTally",hobbyId:hobby.id})}>
          {total>0?"Edit tally":"Set up tally"}
        </Btn>
      </div>
      {total>0 ? (
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {present.map(k=>(
            <div key={k} style={{display:"flex",alignItems:"baseline",gap:6,background:palette.bgAlt,borderRadius:8,padding:"6px 10px"}}>
              <span style={{fontFamily:FONT_DISPLAY,fontSize:18,color:palette.ink,lineHeight:1}}>{Number(tally[k])||0}</span>
              <span style={{fontSize:12,color:palette.inkSoft}}>{k}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{fontSize:12,color:palette.inkSoft,marginTop:6,lineHeight:1.5}}>
          Got animals you don't want to name individually? Record a simple head count by sex here — separate from your named goats above.
        </div>
      )}
    </div>
  );
}

function HerdTallyModal({hobby,update,onClose}){
  const existing=hobby.herdTally||{};
  // Local string state per category so the inputs can be cleared while editing.
  const [counts,setCounts]=useState(()=>{
    const init={};
    HERD_TALLY_CATEGORIES.forEach(k=>{init[k]=String(Number(existing[k])||0);});
    return init;
  });
  const setOne=(k,v)=>setCounts(c=>({...c,[k]:v}));
  const previewTotal=HERD_TALLY_CATEGORIES.reduce((s,k)=>s+(Number(counts[k])||0),0);

  const save=()=>{
    update(d=>{
      const h=d.hobbies.find(x=>x.id===hobby.id);
      if(!h)return d;
      const tally={};
      HERD_TALLY_CATEGORIES.forEach(k=>{
        const n=Math.max(0,Math.floor(Number(counts[k])||0));
        if(n>0)tally[k]=n;
      });
      // Store the object; if everything is zero we still store {} so the
      // feature reads as "set up but empty" consistently.
      h.herdTally=tally;
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Herd tally">
      <div style={{fontSize:13,color:palette.inkSoft,marginBottom:14,lineHeight:1.5}}>
        Record a head count by sex for animals you don't want to track individually. This is separate from your named goats — it doesn't affect breeding, history, or sales.
      </div>
      {HERD_TALLY_CATEGORIES.map(k=>(
        <Field key={k} label={k}>
          <input
            type="number" inputMode="numeric" min={0} style={inputStyle}
            value={counts[k]}
            onChange={e=>setOne(k,e.target.value)}
            placeholder="0"
          />
        </Field>
      ))}
      <div style={{fontSize:13,color:palette.ink,marginBottom:14}}>
        Total: <strong>{previewTotal}</strong> head
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="accent" onClick={save}>Save tally</Btn>
      </div>
    </Modal>
  );
}

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

function AnimalModal({animal,hobbyId,animals,update,user,onClose}){
  const isEdit=!!animal;
  const[name,setName]=useState(animal?.name||"");
  // Breed: dropdown with common breeds, "Other" shows a custom text field.
  // On edit, preselect "Other" if the saved breed isn't in the dropdown.
  const initBreed = (animal?.breed || "").trim();
  const initIsKnown = GOAT_BREEDS.includes(initBreed);
  const[breedSelect,setBreedSelect]=useState(initBreed && initIsKnown ? initBreed : (initBreed ? "Other" : "Mixed"));
  const[breedCustom,setBreedCustom]=useState(initBreed && !initIsKnown ? initBreed : "");
  const finalBreed = breedSelect === "Other" ? breedCustom.trim() : breedSelect;
  const[purpose,setPurpose]=useState(animal?.purpose||"Dairy");
  const[sex,setSex]=useState(animal?.sex||"Doe");
  const[dob,setDob]=useState(animal?.dob||"");
  const[notes,setNotes]=useState(animal?.notes||"");
  const[confirmDelete,setConfirmDelete]=useState(false);
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
  const save=()=>{
    if(!name.trim())return;
    const id=animal?.id||newId();
    update(d=>{const h=d.hobbies.find(x=>x.id===hobbyId);if(!h)return d;if(!Array.isArray(h.animals))h.animals=[];const data={id,name:name.trim(),breed:finalBreed,purpose,sex,dob,notes,sireId:sireId||null,sire:sire.trim(),damId:damId||null,dam:dam.trim(),registryNumber:registryNumber.trim(),registryName:registryName.trim(),photos:animal?.photos||[],created:animal?.created||Date.now(),archived:animal?.archived||false,archivedReason:animal?.archivedReason,archivedDate:animal?.archivedDate};if(isEdit){const idx=h.animals.findIndex(a=>a.id===id);if(idx!==-1)h.animals[idx]=data;else h.animals.push(data);}else h.animals.push(data);return d;});
    onClose();
  };
  const remove=()=>{update(d=>{const h=d.hobbies.find(x=>x.id===hobbyId);if(h)h.animals=(h.animals||[]).filter(a=>a.id!==animal.id);return d;});onClose();};
  // Archive preserves the animal's record (keeps all related logs intact) but
  // removes it from active lists. Use this when an animal is sold, given away,
  // butchered, or has died — Delete is for record-keeping mistakes only.
  const [showArchive,setShowArchive]=useState(false);
  const [archiveReason,setArchiveReason]=useState("sold");
  const archive=()=>{
    update(d=>{
      const h=d.hobbies.find(x=>x.id===hobbyId);
      const a=(h?.animals||[]).find(x=>x.id===animal.id);
      if(a){a.archived=true;a.archivedReason=archiveReason;a.archivedDate=localDateStr(new Date());}
      return d;
    });
    onClose();
  };
  const restore=()=>{
    update(d=>{
      const h=d.hobbies.find(x=>x.id===hobbyId);
      const a=(h?.animals||[]).find(x=>x.id===animal.id);
      if(a){a.archived=false;delete a.archivedReason;delete a.archivedDate;}
      return d;
    });
    onClose();
  };
  return(
    <Modal open onClose={onClose} title={isEdit?"Edit goat":"Add a goat"}>
      <Field label="Name"><input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Buttercup" autoFocus/></Field>
      <Field label="Breed">
        <select style={inputStyle} value={breedSelect} onChange={e=>setBreedSelect(e.target.value)}>{GOAT_BREEDS.map(b=><option key={b}>{b}</option>)}</select>
        {breedSelect === "Other" && (
          <input style={{...inputStyle, marginTop: 8}} value={breedCustom} onChange={e=>setBreedCustom(e.target.value)} placeholder="Type your breed (e.g. Spanish, Pygora, San Clemente)" autoFocus />
        )}
      </Field>
      <div style={{display:"flex",gap:12}}>
        <div style={{flex:1}}><Field label="Purpose"><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{GOAT_PURPOSES.map(p=><button key={p} onClick={()=>setPurpose(p)} style={{padding:"7px 12px",borderRadius:8,fontFamily:FONT_BODY,fontWeight:600,fontSize:13,cursor:"pointer",border:`1.5px solid ${purpose===p?palette.ink:palette.line}`,background:purpose===p?palette.ink:palette.card,color:purpose===p?palette.bg:palette.ink}}>{p}</button>)}</div></Field></div>
        <div style={{flex:1}}><Field label="Sex"><select style={inputStyle} value={sex} onChange={e=>setSex(e.target.value)}>{GOAT_SEXES.map(s=><option key={s}>{s}</option>)}</select></Field></div>
      </div>
      <Field label="Date of birth (optional)"><input type="date" style={inputStyle} value={dob} onChange={e=>setDob(e.target.value)}/></Field>
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Color, ear tag, any notes..."/></Field>

      {/* Push 7a — Pedigree section. All fields optional. Sire/Dam pickers
          show only opposite-sex same-hobby animals (does for the dam slot,
          bucks for the sire slot), with a free-text fallback for parents
          that aren't tracked in this app. Wethers and kids aren't valid
          parents and won't appear in either picker. */}
      <details style={{marginBottom:14}}>
        <summary style={{cursor:"pointer",padding:"8px 12px",background:palette.bgAlt,borderRadius:8,fontSize:13,fontWeight:600,color:palette.ink,userSelect:"none"}}>
          🧬 Pedigree & registry (optional)
        </summary>
        <div style={{padding:"12px 4px 4px"}}>
          <SireDamPicker
            label="Dam"
            animals={animals||[]}
            eligibleSexes={["Doe"]}
            excludeId={animal?.id}
            selectedId={damId}
            selectedName={dam}
            onChange={({id,name})=>{setDamId(id);setDam(name);}}
            placeholder="Type the dam's name"
          />
          <SireDamPicker
            label="Sire"
            animals={animals||[]}
            eligibleSexes={["Buck"]}
            excludeId={animal?.id}
            selectedId={sireId}
            selectedName={sire}
            onChange={({id,name})=>{setSireId(id);setSire(name);}}
            placeholder="Type the sire's name"
          />
          <Field label="Registry name (optional)">
            <input style={inputStyle} value={registryName} onChange={e=>setRegistryName(e.target.value)} placeholder="e.g. Sycamore Sky Buttercup"/>
          </Field>
          <Field label="Registry number (optional)">
            <input style={inputStyle} value={registryNumber} onChange={e=>setRegistryNumber(e.target.value)} placeholder="e.g. ADGA #1234567"/>
          </Field>
        </div>
      </details>

      {/* Photos — only on a saved animal; uploads attach to its record
          immediately. A brand-new animal must be saved first (no record to
          attach to yet), so the section is hidden until then. */}
      {isEdit && animal && (
        <AnimalPhotoSection animal={animal} hobbyId={hobbyId} update={update} user={user} />
      )}

      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <Btn onClick={save}>{isEdit?"Save changes":"Add goat"}</Btn>
        {isEdit && animal?.archived && (
          <Btn variant="ghost" onClick={restore}>Restore from archive</Btn>
        )}
        {isEdit && !animal?.archived && !showArchive && !confirmDelete && (
          <Btn variant="ghost" onClick={()=>setShowArchive(true)}>Archive</Btn>
        )}
        {isEdit && !animal?.archived && !showArchive && !confirmDelete && (
          <Btn variant="ghost" onClick={()=>setConfirmDelete(true)} style={{color:palette.accent,borderColor:palette.accent}}>Delete</Btn>
        )}
        {isEdit && confirmDelete && (
          <>
            <span style={{fontSize:12,color:palette.inkSoft,marginRight:4}}>Permanently delete (loses all records)?</span>
            <Btn variant="danger" onClick={remove}>Yes, delete</Btn>
            <Btn variant="ghost" onClick={()=>setConfirmDelete(false)}>Cancel</Btn>
          </>
        )}
      </div>
      {isEdit && showArchive && !animal?.archived && (
        <div style={{marginTop:12,padding:12,background:palette.bgAlt,borderRadius:8,border:`1.5px solid ${palette.line}`}}>
          <div style={{fontSize:13,color:palette.ink,fontWeight:600,marginBottom:6}}>Archive {animal?.name}</div>
          <div style={{fontSize:12,color:palette.inkSoft,marginBottom:10,lineHeight:1.5}}>
            Keeps the animal's history but removes them from your active list. You can restore them later.
          </div>
          <Field label="Reason">
            <select style={inputStyle} value={archiveReason} onChange={e=>setArchiveReason(e.target.value)}>
              <option value="sold">Sold</option>
              <option value="butchered">Butchered</option>
              <option value="died">Died (illness/age)</option>
              <option value="lost">Lost / predator</option>
              <option value="given away">Given away / rehomed</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={archive}>Archive</Btn>
            <Btn variant="ghost" onClick={()=>setShowArchive(false)}>Cancel</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ============================================================================
// GOATS_UNIFY_V1 — top-bar quick-action modals
// ----------------------------------------------------------------------------
// Mirrors the post-Phase-1/2 Rabbits/Pigs pattern. Each modal lets the user
// pick one goat, multiple goats, or "all live goats" via an All/Custom mode
// picker (goats have no group/herd/pen field, so no per-group chips).
//
// Entry shapes match what the old per-card LogModal wrote, so existing
// analytics, history views, and archive logic keep working unchanged.
//
// PRESERVED: the existing rich BreedingModal (see below) is unchanged — it
// continues to drive the lifecycle record on hobby.breedings[] and the
// goat_kidding calendar events. We just give it a tile-bar entry point.
// The simple per-card `kid` action is replaced by a top-bar 🍼 Kidding tile
// that writes the same { action:"kid", count } entry shape so analytics
// (GoatsAnalytics.totalKids) continues to work without changes.
// ============================================================================

// --- Shared selection helpers (no group chips; goats are a flat list) -------

function pillStyleG(active) {
  return {
    padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,
    border: active ? `1.5px solid ${palette.ink}` : `1.5px solid ${palette.line}`,
    background: active ? palette.ink : palette.bgAlt,
    color: active ? palette.bg : palette.ink,
    cursor:"pointer",
  };
}

function selectionButtonsG({ live, mode, setMode }) {
  return (
    <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:8 }}>
      <button type="button" onClick={()=>setMode("all")} style={pillStyleG(mode==="all")}>
        {mode==="all" ? "✓ " : ""}All ({live.length})
      </button>
      <button type="button" onClick={()=>setMode("custom")} style={pillStyleG(mode==="custom")}>
        {mode==="custom" ? "✓ " : ""}Custom…
      </button>
    </div>
  );
}

function multiToggleRowG({ live, selectedIds, setSelectedIds }) {
  return (
    <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:8 }}>
      {live.map(a => {
        const on = selectedIds.includes(a.id);
        return (
          <button
            key={a.id}
            type="button"
            onClick={()=>setSelectedIds(prev => prev.includes(a.id) ? prev.filter(x=>x!==a.id) : [...prev, a.id])}
            style={{
              padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,
              border: on ? `1.5px solid ${palette.ink}` : `1.5px solid ${palette.line}`,
              background: on ? palette.ink : palette.card,
              color: on ? palette.bg : palette.ink,
              cursor:"pointer",
            }}
          >{on ? "✓ " : ""}{a.name}{a.sex?` · ${a.sex}`:""}</button>
        );
      })}
    </div>
  );
}

function resolveSelectedIdsG({ mode, customIds, live }) {
  if (mode === "all") return live.map(a => a.id);
  if (mode === "custom") return customIds;
  return [];
}

// --- 🌾 FedGoatModal --------------------------------------------------------

function FedGoatModal({ hobby, hobbyId, update, onClose }) {
  const live = (hobby.animals||[]).filter(a=>!a.archived);
  const [date, setDate] = useState(todayStr());
  const [lbs, setLbs] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState(live.length ? "all" : "custom");
  const [customIds, setCustomIds] = useState([]);

  const targetIds = resolveSelectedIdsG({ mode, customIds, live });
  const canSave = (mode === "all") || targetIds.length > 0;

  const save = () => {
    if (!canSave) return;
    update(d => {
      d.entries = d.entries || {};
      d.entries[hobbyId] = d.entries[hobbyId] || [];
      const entry = {
        id: newId(),
        date,
        action: "fed",
        animalIds: [...targetIds],
        animalId: targetIds[0] || null,
        animalName: (live.find(a=>a.id===targetIds[0])?.name) || "",
        lbs: Number(lbs) || 0,
        cost: Number(cost) || 0,
        notes: notes.trim(),
        herdWide: mode === "all",
        created: Date.now(),
      };
      d.entries[hobbyId].push(entry);
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="🌾 Log feeding">
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} />
      </Field>
      <Field label={`Who is this for? (${targetIds.length} goat${targetIds.length===1?"":"s"})`}>
        {selectionButtonsG({ live, mode, setMode })}
        {mode === "custom" && multiToggleRowG({ live, selectedIds: customIds, setSelectedIds: setCustomIds })}
      </Field>
      {(()=>{
        const isMetricW = getCurrentWeightUnit()==="kg";
        const shown = lbs===""||lbs==null ? "" : (isMetricW ? String(Math.round(weightFromLbs(Number(lbs))*100)/100) : lbs);
        return (
          <Field label={isMetricW?"Feed (kg)":"Feed (lbs)"}>
            <input type="number" min={0} step="0.1" style={inputStyle} value={shown}
              onChange={e=>{const r=e.target.value;setLbs(r===""?"":(isMetricW?String(lbsFromInput(r)):r));}}
              placeholder="0"/>
          </Field>
        );
      })()}
      <Field label="Cost ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$0.00"/></Field>
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!canSave}>Save</Btn>
      </div>
    </Modal>
  );
}

// --- ⚖️ 💊 📝 LogGoatEntryModal (shared for weight / health / note) --------

function LogGoatEntryModal({ hobby, hobbyId, action, update, onClose }) {
  const live = (hobby.animals||[]).filter(a=>!a.archived);

  // Weight is single-select (one number per goat). Health & note are multi.
  const isMulti = action === "health" || action === "note";

  const [date, setDate] = useState(todayStr());
  const [animalId, setAnimalId] = useState(live[0]?.id || "");
  const [mode, setMode] = useState(live.length ? "all" : "custom");
  const [customIds, setCustomIds] = useState([]);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");

  const targetIds = isMulti ? resolveSelectedIdsG({ mode, customIds, live }) : (animalId ? [animalId] : []);

  const titles = { weight:"⚖️ Log weight", health:"💊 Vet / meds", note:"📝 Add note" };
  const subtexts = {
    weight: "Track growth over time.",
    health: "Treatments, dewormers, vaccines, vet visits — anything worth remembering.",
    note: "Anything else worth tracking against a goat or the herd.",
  };

  const noteRequired = action === "health" || action === "note";
  const canSave = (() => {
    if (action === "weight" && (!animalId || !(Number(weight) > 0))) return false;
    if (isMulti && targetIds.length === 0) return false;
    if (noteRequired && !notes.trim()) return false;
    return true;
  })();

  const save = () => {
    if (!canSave) return;
    update(d => {
      d.entries = d.entries || {};
      d.entries[hobbyId] = d.entries[hobbyId] || [];
      if (action === "weight") {
        const a = live.find(x => x.id === animalId);
        d.entries[hobbyId].push({
          id: newId(), date, action: "weight",
          animalId, animalName: a?.name || "",
          weight: Number(weight) || 0,
          notes: notes.trim(),
          created: Date.now(),
        });
      } else {
        // health / note: one entry per goat so per-animal history filters
        // (which key off animalId) still surface them.
        const stem = newId();
        targetIds.forEach((id, i) => {
          const a = live.find(x => x.id === id);
          d.entries[hobbyId].push({
            id: i === 0 ? stem : `${stem}-${i}`,
            date, action,
            animalId: id, animalName: a?.name || "",
            animalIds: [...targetIds],
            notes: notes.trim(),
            created: Date.now(),
          });
        });
      }
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={titles[action]}>
      <div style={{fontSize:12,color:palette.inkSoft,marginBottom:12,lineHeight:1.5}}>{subtexts[action]}</div>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)}/>
      </Field>
      {action === "weight" ? (
        <Field label="Goat">
          <select style={inputStyle} value={animalId} onChange={e=>setAnimalId(e.target.value)}>
            {live.length === 0 && <option value="">— No live goats —</option>}
            {live.map(a => <option key={a.id} value={a.id}>{a.name}{a.sex?` · ${a.sex}`:""}</option>)}
          </select>
        </Field>
      ) : (
        <Field label={`Who? (${targetIds.length} goat${targetIds.length===1?"":"s"})`}>
          {selectionButtonsG({ live, mode, setMode })}
          {mode === "custom" && multiToggleRowG({ live, selectedIds: customIds, setSelectedIds: setCustomIds })}
        </Field>
      )}
      {action === "weight" && (()=>{
        const isMetricW = getCurrentWeightUnit()==="kg";
        const shown = weight===""||weight==null ? "" : (isMetricW ? String(Math.round(weightFromLbs(Number(weight))*100)/100) : weight);
        return (
          <Field label={isMetricW?"Weight (kg)":"Weight (lbs)"}>
            <input type="number" min={0} step="0.1" style={inputStyle} value={shown}
              onChange={e=>{const r=e.target.value;setWeight(r===""?"":(isMetricW?String(lbsFromInput(r)):r));}}
              placeholder="0" autoFocus inputMode="decimal"/>
          </Field>
        );
      })()}
      <Field label={noteRequired ? "Notes" : "Notes (optional)"}>
        <input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}
          placeholder={
            action === "health" ? "e.g. Ivermectin — dewormer round" :
            action === "note" ? "What happened" : ""
          }
          autoFocus={action !== "weight"}/>
      </Field>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!canSave}>Save</Btn>
      </div>
    </Modal>
  );
}

// --- 🥛 MilkGoatModal -------------------------------------------------------

function MilkGoatModal({ hobby, hobbyId, update, onClose }) {
  const live = (hobby.animals||[]).filter(a=>!a.archived);
  // Milk is logged per-doe. Restrict the picker to does with a dairy
  // purpose (Dairy or Both); fall back to all live goats if the user
  // hasn't set purposes yet (don't be obstinate).
  const dairy = live.filter(a => a.purpose === "Dairy" || a.purpose === "Both");
  const choosable = dairy.length > 0 ? dairy : live;

  const [date, setDate] = useState(todayStr());
  const [animalId, setAnimalId] = useState(choosable[0]?.id || "");
  const [oz, setOz] = useState("");
  const [notes, setNotes] = useState("");

  const canSave = !!animalId && !!date && Number(oz) > 0;

  const save = () => {
    if (!canSave) return;
    const a = choosable.find(x => x.id === animalId);
    update(d => {
      d.entries = d.entries || {};
      d.entries[hobbyId] = d.entries[hobbyId] || [];
      d.entries[hobbyId].push({
        id: newId(), date, action: "milk",
        animalId, animalName: a?.name || "",
        oz: Number(oz) || 0,
        notes: notes.trim(),
        created: Date.now(),
      });
      return d;
    });
    onClose();
  };

  const isMetricV = getCurrentVolumeUnit() === "L";

  return (
    <Modal open onClose={onClose} title="🥛 Log milk">
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)}/>
      </Field>
      <Field label="Doe">
        <select style={inputStyle} value={animalId} onChange={e=>setAnimalId(e.target.value)} autoFocus>
          {choosable.length === 0 && <option value="">— No goats available —</option>}
          {choosable.map(a => <option key={a.id} value={a.id}>{a.name}{a.purpose?` · ${a.purpose}`:""}</option>)}
        </select>
      </Field>
      <Field label="Milk collected (oz)">
        <input type="number" min={0} step="0.1" style={inputStyle} value={oz}
          onChange={e=>setOz(e.target.value)} placeholder="0" inputMode="decimal"/>
        {oz && (
          <div style={{fontSize:12,color:palette.inkSoft,marginTop:4}}>
            {isMetricV ? fmtVolume(Number(oz)/128) : `${(Number(oz)/128).toFixed(2)} gallons`}
          </div>
        )}
      </Field>
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!canSave}>Save</Btn>
      </div>
    </Modal>
  );
}

// --- 🍼 KiddingGoatModal ----------------------------------------------------
//
// Light kidding entry that mirrors the OLD per-card `kid` action shape so
// GoatsAnalytics.totalKids keeps working. For full breed-through-kidding
// lifecycle records (dam, sire, method, expected/actual dates, offspring
// alive at weaning), use the 💕 Breeding tile, which opens the existing
// rich BreedingModal — that's the canonical breeding flow for goats.

function KiddingGoatModal({ hobby, hobbyId, update, onClose }) {
  const live = (hobby.animals||[]).filter(a=>!a.archived);
  const does = live.filter(a => a.sex === "Doe");
  const choosable = does.length > 0 ? does : live;

  const [date, setDate] = useState(todayStr());
  const [animalId, setAnimalId] = useState(choosable[0]?.id || "");
  const [count, setCount] = useState("");
  const [notes, setNotes] = useState("");

  const canSave = !!animalId && !!date && Number(count) > 0;

  const save = () => {
    if (!canSave) return;
    const a = choosable.find(x => x.id === animalId);
    update(d => {
      d.entries = d.entries || {};
      d.entries[hobbyId] = d.entries[hobbyId] || [];
      d.entries[hobbyId].push({
        id: newId(), date, action: "kid",
        animalId, animalName: a?.name || "",
        count: Number(count) || 1,
        notes: notes.trim(),
        created: Date.now(),
      });
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="🍼 Log kidding">
      <div style={{fontSize:12,color:palette.inkSoft,marginBottom:12,lineHeight:1.5}}>
        Quick log of how many kids a doe just had. For the full breed-through-kidding record (dam, sire, dates, kids alive at weaning) use the 💕 Breeding tile instead.
      </div>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)}/>
      </Field>
      <Field label="Dam">
        <select style={inputStyle} value={animalId} onChange={e=>setAnimalId(e.target.value)} autoFocus>
          {choosable.length === 0 && <option value="">— No does available —</option>}
          {choosable.map(a => <option key={a.id} value={a.id}>{a.name}{a.sex?` · ${a.sex}`:""}</option>)}
        </select>
      </Field>
      <Field label="Kids born">
        <input type="number" min={1} style={inputStyle} value={count}
          onChange={e=>setCount(e.target.value)} placeholder="1" inputMode="numeric"/>
      </Field>
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!canSave}>Save</Btn>
      </div>
    </Modal>
  );
}

// --- ❄️ RemoveGoatModal (unified butcher / sold / rehomed / died / ...) ----

function RemoveGoatModal({ hobby, hobbyId, update, onClose }) {
  const live = (hobby.animals||[]).filter(a=>!a.archived);

  const [animalId, setAnimalId] = useState(live[0]?.id || "");
  const [reason, setReason] = useState("butchered");
  const [date, setDate] = useState(todayStr());
  // butcher
  const [weight, setWeight] = useState("");
  const [cost, setCost] = useState("");
  // sold
  const [buyer, setBuyer] = useState("");
  const [price, setPrice] = useState("");
  // rehomed / given away
  const [recipient, setRecipient] = useState("");
  // died
  const [cause, setCause] = useState("Unknown");
  // culled
  const [cullReason, setCullReason] = useState("");
  // shared notes
  const [notes, setNotes] = useState("");

  const canSave = !!animalId && !!date;

  const REASONS = [
    { k:"butchered",   label:"🥩 Butchered" },
    { k:"sold",        label:"🏷️ Sold" },
    { k:"rehomed",     label:"🏠 Rehomed" },
    { k:"given_away",  label:"🎁 Given away" },
    { k:"died",        label:"🪦 Died" },
    { k:"culled",      label:"⚠️ Culled" },
    { k:"other",       label:"📋 Other" },
  ];

  const save = () => {
    if (!canSave) return;
    const animal = live.find(a => a.id === animalId);
    if (!animal) return;

    update(d => {
      d.entries = d.entries || {};
      d.entries[hobbyId] = d.entries[hobbyId] || [];
      const h = d.hobbies.find(x => x.id === hobbyId);
      const target = (h?.animals || []).find(x => x.id === animalId);
      if (!target) return d;

      if (reason === "butchered") {
        const entry = {
          id: newId(), date, action: "butcher",
          animalId, animalName: animal.name,
          weight: Number(weight) || 0,
          cost: Number(cost) || 0,
          notes: notes.trim(),
          created: Date.now(),
        };
        d.entries[hobbyId].push(entry);
        target.archived = true;
        target.archivedReason = "butchered";
        target.archivedDate = date;
      } else if (reason === "sold" || reason === "rehomed" || reason === "given_away") {
        const saleType = reason === "sold" ? "sold" : "rehomed";
        const verb = reason === "sold" ? "Sold" : reason === "rehomed" ? "Rehomed" : "Given away";
        const partyName = reason === "sold" ? buyer.trim() : recipient.trim();
        const numericPrice = reason === "sold" ? (Number(price) || 0) : 0;
        const entry = {
          id: newId(), date, action: "sale",
          animalId, animalName: animal.name,
          buyer: partyName,
          price: numericPrice,
          saleType,
          reasonTag: reason,
          notes: notes.trim(),
          created: Date.now(),
        };
        d.entries[hobbyId].push(entry);
        const priceStr = numericPrice > 0 ? ` for $${numericPrice.toFixed(2)}` : "";
        const partyStr = partyName ? ` to ${partyName}` : "";
        target.archived = true;
        target.archivedReason = `${verb}${partyStr}${priceStr}`;
        target.archivedDate = date;
        target.saleId = entry.id;
        d.sales = d.sales || [];
        const _saleRow = {
          id: entry.id, date, hobbyType: "goat", crop: animal.name, saleType,
          pricePerUnit: numericPrice, totalRevenue: numericPrice,
          qty: 1, animalId, buyer: partyName, buyerId: null,
          notes: notes.trim() || "",
        };
        resolveSaleBuyer(d, _saleRow);
        d.sales.push(_saleRow);
      } else if (reason === "died") {
        const entry = {
          id: newId(), date, action: "death",
          animalId, animalName: animal.name,
          cause,
          notes: notes.trim(),
          created: Date.now(),
        };
        d.entries[hobbyId].push(entry);
        target.archived = true;
        target.archivedReason = cause && cause !== "Unknown" ? `Died: ${cause}` : "Died";
        target.archivedDate = date;
      } else if (reason === "culled") {
        const causeStr = cullReason.trim() ? `culled: ${cullReason.trim()}` : "culled";
        const entry = {
          id: newId(), date, action: "death",
          animalId, animalName: animal.name,
          cause: causeStr,
          notes: notes.trim(),
          created: Date.now(),
        };
        d.entries[hobbyId].push(entry);
        target.archived = true;
        target.archivedReason = `Culled${cullReason.trim() ? ": " + cullReason.trim() : ""}`;
        target.archivedDate = date;
      } else {
        const entry = {
          id: newId(), date, action: "note",
          animalId, animalName: animal.name,
          notes: notes.trim() ? `Removed: ${notes.trim()}` : "Removed (other)",
          reasonTag: "other_removal",
          created: Date.now(),
        };
        d.entries[hobbyId].push(entry);
        target.archived = true;
        target.archivedReason = notes.trim() ? `Removed: ${notes.trim()}` : "Removed (other)";
        target.archivedDate = date;
      }
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="❄️ Remove goat">
      <Field label="Which goat?">
        <select style={inputStyle} value={animalId} onChange={e=>setAnimalId(e.target.value)} autoFocus>
          {live.length === 0 && <option value="">— No live goats —</option>}
          {live.map(a => <option key={a.id} value={a.id}>{a.name}{a.sex?` · ${a.sex}`:""}{a.breed?` · ${a.breed}`:""}</option>)}
        </select>
      </Field>
      <Field label="Why?">
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {REASONS.map(r => (
            <button key={r.k} type="button" onClick={()=>setReason(r.k)} style={{
              padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,
              border: reason===r.k ? `1.5px solid ${palette.ink}` : `1.5px solid ${palette.line}`,
              background: reason===r.k ? palette.ink : palette.bgAlt,
              color: reason===r.k ? palette.bg : palette.ink,
              cursor:"pointer",
            }}>{r.label}</button>
          ))}
        </div>
      </Field>
      <Field label="Date"><input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)}/></Field>

      {reason === "butchered" && (()=>{
        const isMetricW = getCurrentWeightUnit()==="kg";
        const shownW = weight===""||weight==null ? "" : (isMetricW ? String(Math.round(weightFromLbs(Number(weight))*100)/100) : weight);
        return (
          <>
            <Field label={isMetricW?"Hanging weight (kg)":"Hanging weight (lbs)"}>
              <input type="number" min={0} step="0.1" style={inputStyle} value={shownW}
                onChange={e=>{const r=e.target.value;setWeight(r===""?"":(isMetricW?String(lbsFromInput(r)):r));}} placeholder="0"/>
            </Field>
            <Field label="Processing cost ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$0.00"/></Field>
          </>
        );
      })()}

      {reason === "sold" && (
        <>
          <Field label="Buyer (optional)"><input style={inputStyle} value={buyer} onChange={e=>setBuyer(e.target.value)} placeholder="Name of buyer"/></Field>
          <Field label="Price ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={price} onChange={e=>setPrice(e.target.value)} placeholder="$0.00"/></Field>
        </>
      )}

      {(reason === "rehomed" || reason === "given_away") && (
        <Field label="Recipient (optional)"><input style={inputStyle} value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="Who took them"/></Field>
      )}

      {reason === "died" && (
        <Field label="Cause">
          <select style={inputStyle} value={cause} onChange={e=>setCause(e.target.value)}>
            {["Unknown","Disease","Predator","Heat stress","Cold","Injury","Kidding complications","Bloat","Parasites","Other"].map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
      )}

      {reason === "culled" && (
        <Field label="Reason (optional)"><input style={inputStyle} value={cullReason} onChange={e=>setCullReason(e.target.value)} placeholder="e.g. temperament, poor producer"/></Field>
      )}

      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>

      <div style={{fontSize:12,color:palette.inkSoft,marginBottom:10,padding:"8px 10px",background:palette.bgAlt,borderRadius:6,lineHeight:1.5}}>
        {(()=>{const a = live.find(x=>x.id===animalId); return a?.name || "This goat";})()} will move to your Archived goats list{(reason==="sold")?" and a sale record will appear in your Sales tab":""}. You can restore from there if this was a mistake.
      </div>

      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant={reason==="died"||reason==="culled"?"danger":"primary"} onClick={save} disabled={!canSave}>Save &amp; archive</Btn>
      </div>
    </Modal>
  );
}

// ============================================================================
// /GOATS_UNIFY_V1
// ============================================================================

function LogModal({animal,hobbyId,action,update,onClose,customers=[]}){
  const[date,setDate]=useState(todayStr());
  const[oz,setOz]=useState("");
  const[lbs,setLbs]=useState("");
  const[cost,setCost]=useState("");
  const[count,setCount]=useState("");
  const[weight,setWeight]=useState("");
  const[notes,setNotes]=useState("");
  // Death-only: optional cause. Stored on the entry AND folded into archivedReason
  // so the existing "Archived goats" section reads "Died: predator" etc.
  const[cause,setCause]=useState("");
  // Sale-only: buyer name, sale price, sold-vs-rehomed. On save these archive
  // the animal AND create a `data.sales[]` entry so it shows up in the Sales tab.
  const[saleBuyer,setSaleBuyer]=useState("");
  const[buyerId,setBuyerId]=useState("");
  const[showNewBuyer,setShowNewBuyer]=useState(false);
  const[salePrice,setSalePrice]=useState("");
  const[saleType,setSaleType]=useState("sold");
  const save=()=>{
    const entry={id:newId(),date,action,animalId:animal.id,animalName:animal.name,notes,created:Date.now()};
    if(action==="milk")entry.oz=Number(oz)||0;
    if(action==="fed"){entry.lbs=Number(lbs)||0;entry.cost=Number(cost)||0;}
    if(action==="kid")entry.count=Number(count)||1;
    if(action==="weight"||action==="butcher")entry.weight=Number(weight)||0;
    if(action==="butcher")entry.cost=Number(cost)||0;
    if(action==="death")entry.cause=cause.trim();
    if(action==="sale"){entry.buyer=saleBuyer.trim();entry.price=Number(salePrice)||0;entry.saleType=saleType;}
    update(d=>{
      d.entries[hobbyId]=d.entries[hobbyId]||[];
      d.entries[hobbyId].push(entry);
      // Death also archives the animal so it drops out of the active list and
      // shows up under "Archived goats". Mirrors Sheep/Dogs behavior.
      if(action==="death"){
        const h=d.hobbies.find(x=>x.id===hobbyId);
        const a=(h?.animals||[]).find(x=>x.id===animal.id);
        if(a&&!a.archived){
          a.archived=true;
          a.archivedReason=cause.trim()?`Died: ${cause.trim()}`:"Died";
          a.archivedDate=date;
        }
      }
      // Sale also archives the animal and creates a Sales entry.
      if(action==="sale"){
        const h=d.hobbies.find(x=>x.id===hobbyId);
        const a=(h?.animals||[]).find(x=>x.id===animal.id);
        if(a&&!a.archived){
          a.archived=true;
          const verb=saleType==="leased"?"Leased":saleType==="rehomed"?"Rehomed":"Sold";
          const priceStr=Number(salePrice)>0?` for $${Number(salePrice).toFixed(2)}`:"";
          const buyerStr=saleBuyer.trim()?` to ${saleBuyer.trim()}`:"";
          a.archivedReason=`${verb}${buyerStr}${priceStr}`;
          a.archivedDate=date;
          a.saleId=entry.id;
        }
        d.sales=d.sales||[];
        const _saleRow={
          id:entry.id,
          date,
          hobbyType:"goat",
          crop:animal.name,
          saleType,
          pricePerUnit:Number(salePrice)||0,
          totalRevenue:Number(salePrice)||0,
          qty:1,
          animalId:animal.id,
          buyer:saleBuyer.trim(),
          buyerId:buyerId||null,
          notes:notes||"",
        };
        resolveSaleBuyer(d,_saleRow);
        d.sales.push(_saleRow);
      }
      return d;
    });
    onClose();
  };
  const titles={milk:"Log milk",fed:"Log feed",kid:"Log kids born",weight:"Log weight",health:"Health check",butcher:"Log butcher",death:"Log death",sale:"Log sale",note:"Add note"};
  const isDeath=action==="death";
  const isSale=action==="sale";
  return(
    <Modal open onClose={onClose} title={`${titles[action]||"Log"} — ${animal.name}`}>
      <Field label="Date"><input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)}/></Field>
      {action==="milk"&&(()=>{
        // Milk stored in oz. In metric mode show a mL/L hint instead of the
        // gallons hint. The input value stays in oz (canonical) — only the
        // helper text adapts. (oz → mL ≈ ×29.5735)
        const isMetricV=getCurrentVolumeUnit()==="L";
        return <Field label="Milk collected (oz)"><input type="number" min={0} step="0.1" style={inputStyle} value={oz} onChange={e=>setOz(e.target.value)} placeholder="0" autoFocus/>{oz&&<div style={{fontSize:12,color:palette.inkSoft,marginTop:4}}>{isMetricV?fmtVolume(Number(oz)/128):`${(Number(oz)/128).toFixed(2)} gallons`}</div>}</Field>;
      })()}
      {action==="fed"&&(()=>{
        const isMetricW=getCurrentWeightUnit()==="kg";
        const shownLbs=lbs===""||lbs==null?"":(isMetricW?String(Math.round(weightFromLbs(Number(lbs))*100)/100):lbs);
        return <div style={{display:"flex",gap:12}}><div style={{flex:1}}><Field label={isMetricW?"Feed (kg)":"Feed (lbs)"}><input type="number" min={0} step="0.1" style={inputStyle} value={shownLbs} onChange={e=>{const r=e.target.value;setLbs(r===""?"":(isMetricW?String(lbsFromInput(r)):r));}} placeholder="0"/></Field></div><div style={{flex:1}}><Field label="Cost ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$0.00"/></Field></div></div>;
      })()}
      {action==="kid"&&<Field label="Kids born (count)"><input type="number" min={1} style={inputStyle} value={count} onChange={e=>setCount(e.target.value)} placeholder="1" autoFocus/></Field>}
      {(action==="weight"||action==="butcher")&&(()=>{
        const isMetricW=getCurrentWeightUnit()==="kg";
        const shownW=weight===""||weight==null?"":(isMetricW?String(Math.round(weightFromLbs(Number(weight))*100)/100):weight);
        return <Field label={isMetricW?"Weight (kg)":"Weight (lbs)"}><input type="number" min={0} step="0.1" style={inputStyle} value={shownW} onChange={e=>{const r=e.target.value;setWeight(r===""?"":(isMetricW?String(lbsFromInput(r)):r));}} placeholder="0" autoFocus/></Field>;
      })()}
      {action==="butcher"&&<Field label="Processing cost ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$0.00"/></Field>}
      {isDeath&&<Field label="Cause (optional)"><input style={inputStyle} value={cause} onChange={e=>setCause(e.target.value)} placeholder="predator, illness, unknown..." autoFocus/></Field>}
      {isSale&&<>
        <Field label="Type"><select style={inputStyle} value={saleType} onChange={e=>setSaleType(e.target.value)}><option value="sold">Sold</option><option value="leased">Leased</option><option value="rehomed">Rehomed (no payment)</option></select></Field>
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
        {saleType!=="rehomed"&&<Field label="Price ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={salePrice} onChange={e=>setSalePrice(e.target.value)} placeholder="$0.00"/></Field>}
      </>}
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      {isDeath&&<div style={{fontSize:12,color:palette.inkSoft,marginBottom:10,padding:"8px 10px",background:palette.bgAlt,borderRadius:6,lineHeight:1.5}}>{animal.name} will move to your Archived goats list. You can restore from there if this was a mistake.</div>}
      {isSale&&<div style={{fontSize:12,color:palette.inkSoft,marginBottom:10,padding:"8px 10px",background:palette.bgAlt,borderRadius:6,lineHeight:1.5}}>{animal.name} will move to your Archived goats list and {saleType!=="rehomed"?"a sale record will appear in your Sales tab":"be marked as rehomed"}. You can restore from there if this was a mistake.</div>}
      <Btn onClick={save} variant={isDeath?"danger":"primary"}>{(isDeath||isSale)?"Save & archive":"Save"}</Btn>
    </Modal>
  );
}

function AnimalCard({animal,hobbyId,animals,entries,sales,hobby,update,setModal,customers=[]}){
  /* GOATS_UNIFY_V1 — logAction state removed (action buttons moved to top tile bar) */
  // Push 7a — pedigree modal state. Toggled by the 🧬 Pedigree button.
  const[showPedigree,setShowPedigree]=useState(false);
  const[showHistory,setShowHistory]=useState(false);
  const animalEntries=entries.filter(e=>e.animalId===animal.id);
  const today=todayStr();
  const milkEntries=animalEntries.filter(e=>e.action==="milk");
  const totalMilkOz=milkEntries.reduce((s,e)=>s+(Number(e.oz)||0),0);
  const todayMilk=milkEntries.filter(e=>e.date===today).reduce((s,e)=>s+(Number(e.oz)||0),0);
  const lastMilk=milkEntries.sort((a,b)=>b.date.localeCompare(a.date))[0];
  const purposeColor={Dairy:palette.leaf,Meat:palette.accent,Both:palette.feather};
  const sexLabel={Doe:"♀",Buck:"♂",Wether:"⚧",Kid:"🐣"};
  /* GOATS_UNIFY_V1 — LOG_ACTIONS array removed (per-card row gone) */
  const actionLabels={milk:"🥛 Milk",fed:"🌾 Feed",kid:"🍼 Kids",weight:"⚖️ Weight",health:"💊 Health",butcher:"🔪 Butcher",death:"💀 Death",sale:"🏷️ Sale",note:"📓 Note"};
  const recentEntries=animalEntries.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
  return(
    <div style={{background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:10}}>
      {/* GOATS_UNIFY_V1 — per-card LogModal mount removed; tile bar drives logging now */}
      {showPedigree && (
        <PedigreeView
          animal={animal}
          animals={animals||[]}
          onClose={()=>setShowPedigree(false)}
          onJumpTo={(id)=>{
            // Tapping a linked ancestor/descendant in the tree opens THAT
            // animal's edit screen. The user can then open its own pedigree
            // from there. We close the current pedigree view first so we
            // don't stack modals.
            setShowPedigree(false);
            setTimeout(()=>setModal({type:"editAnimal",hobbyId,animalId:id}),0);
          }}
        />
      )}
      {showHistory && (
        <AnimalHistoryView
          update={update}
          animal={animal}
          hobby={hobby}
          entries={entries}
          sales={sales||[]}
          species="goat"
          onClose={()=>setShowHistory(false)}
        />
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:18}}>🐐</span>
            <span style={{fontWeight:700,fontSize:15,color:palette.ink}}>{animal.name}</span>
            <span style={{fontSize:11,background:palette.bgAlt,padding:"2px 8px",borderRadius:4,color:palette.inkSoft}}>{animal.breed}</span>
            <span style={{fontSize:11,background:purposeColor[animal.purpose]+"25",padding:"2px 8px",borderRadius:4,color:purposeColor[animal.purpose],fontWeight:600}}>{animal.purpose}</span>
            <span style={{fontSize:12,color:palette.inkSoft}}>{sexLabel[animal.sex]}</span>
          </div>
          {animal.dob&&<div style={{fontSize:11,color:palette.inkSoft,marginTop:2,marginLeft:26}}>Born {fmtDate(animal.dob)}</div>}
        </div>
        <button onClick={()=>setModal({type:"editAnimal",hobbyId,animalId:animal.id})} style={{background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,padding:4}}><Edit3 size={14}/></button>
      </div>
      {(animal.purpose==="Dairy"||animal.purpose==="Both")&&(
        <div style={{background:palette.bgAlt,borderRadius:8,padding:"8px 12px",marginBottom:10,display:"flex",gap:16,flexWrap:"wrap"}}>
          <div style={{fontSize:12,color:palette.ink}}><span style={{color:palette.inkSoft}}>Today: </span><strong>{todayMilk>0?fmtVolume(todayMilk/128):"—"}</strong></div>
          <div style={{fontSize:12,color:palette.ink}}><span style={{color:palette.inkSoft}}>All-time: </span><strong>{totalMilkOz>0?fmtVolume(totalMilkOz/128):"—"}</strong></div>
          {lastMilk&&<div style={{fontSize:12,color:palette.inkSoft}}>Last: {fmtDate(lastMilk.date)}</div>}
        </div>
      )}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:recentEntries.length>0?10:0}}>
        {/* GOATS_UNIFY_V1 — per-card action buttons removed; log via top tile bar */}
        {/* Push 7a — Pedigree view. Always shown so the entry point is
            consistent across animals; the modal handles the "no data yet"
            case internally with a friendly empty state. */}
        <button onClick={()=>setShowPedigree(true)} style={{padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.ink}}>🧬 Pedigree</button>
        <button onClick={()=>setShowHistory(true)} style={{padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.ink}}>📜 History</button>
      </div>
      {recentEntries.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          {recentEntries.map(e=>{
            let detail="";
            if(e.action==="milk")detail=fmtVolume((e.oz!=null?Number(e.oz)/128:Number(e.gallons))||0);
            else if(e.action==="fed")detail=`${fmtWeight(Number(e.lbs)||0)}${e.cost>0?` · ${fmtMoney(e.cost)}`:""}`;
            else if(e.action==="kid"||e.action==="calf"||e.action==="litter")detail=`${e.count} ${e.action==="litter"?"piglets":e.action==="calf"?"calf":"kid"}${e.count!==1?"s":""}`;
            else if(e.action==="weight"||e.action==="butcher")detail=fmtWeight(Number(e.weight)||0);
            return (
              <div key={e.id} style={{fontSize:12,color:palette.inkSoft,padding:"4px 8px",background:palette.bgAlt,borderRadius:6,display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
                <span>{fmtDate(e.date)} · {actionLabels[e.action]||e.action}</span>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span>{detail}</span>
                  <button onClick={()=>update(d=>{d.entries[hobbyId]=(d.entries[hobbyId]||[]).filter(x=>x.id!==e.id);return d;})} aria-label="Delete entry" style={{background:"none",border:"none",cursor:"pointer",color:palette.accent,fontSize:11,padding:"0 2px",lineHeight:1}}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Goat gestation = ~150 days (typically 145–155). User can override.
const GOAT_GESTATION_DAYS = 150;

const addDays = (dateStr, days) => {
  if (!dateStr) return "";
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return localDateStr(d);
};

// ============ BREEDING / KIDDING MODAL ============
function BreedingModal({ animals, breeding, onSave, onDelete, onClose, addCalendarEvent }) {
  const dams = animals.filter(a => !a.archived && a.sex === "Doe");
  const sires = animals.filter(a => !a.archived && a.sex === "Buck");

  const [damId, setDamId] = useState(breeding?.damId || dams[0]?.id || "");
  const [sireId, setSireId] = useState(breeding?.sireId || "");
  const [externalSireName, setExternalSireName] = useState(breeding?.externalSireName || "");
  const [useUnknownSire, setUseUnknownSire] = useState(
    !!breeding?.externalSireName || (!breeding?.sireId && sires.length === 0)
  );
  const [method, setMethod] = useState(breeding?.method || "Natural");
  const [breedDate, setBreedDate] = useState(breeding?.breedDate || todayStr());
  const [expectedBirthDate, setExpectedBirthDate] = useState(
    breeding?.expectedBirthDate ||
    (breeding?.breedDate ? addDays(breeding.breedDate, GOAT_GESTATION_DAYS) : addDays(todayStr(), GOAT_GESTATION_DAYS))
  );
  const [birthedDate, setBirthedDate] = useState(breeding?.birthedDate || "");
  const [offspringBorn, setOffspringBorn] = useState(breeding?.offspringBorn != null ? String(breeding.offspringBorn) : "");
  const [offspringAlive, setOffspringAlive] = useState(breeding?.offspringAlive != null ? String(breeding.offspringAlive) : "");
  const [notes, setNotes] = useState(breeding?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const defaultExpected = breedDate ? addDays(breedDate, GOAT_GESTATION_DAYS) : "";
  const isOverridden = expectedBirthDate !== defaultExpected;
  const resetExpected = () => setExpectedBirthDate(defaultExpected);

  const lastSeenBreedDate = React.useRef(breedDate);
  React.useEffect(() => {
    if (lastSeenBreedDate.current !== breedDate) {
      const oldDefault = lastSeenBreedDate.current ? addDays(lastSeenBreedDate.current, GOAT_GESTATION_DAYS) : "";
      if (expectedBirthDate === oldDefault) {
        setExpectedBirthDate(addDays(breedDate, GOAT_GESTATION_DAYS));
      }
      lastSeenBreedDate.current = breedDate;
    }
  }, [breedDate, expectedBirthDate]);

  const handleSave = () => {
    if (!damId || !breedDate) return;
    const id = breeding?.id || newId();
    const finalSireId = useUnknownSire ? "" : sireId;
    const finalExternal = useUnknownSire ? externalSireName.trim() : "";
    onSave({
      id,
      damId,
      sireId: finalSireId,
      externalSireName: finalExternal,
      method,
      breedDate,
      expectedBirthDate,
      birthedDate: birthedDate || null,
      offspringBorn: parseInt(offspringBorn) || null,
      offspringAlive: parseInt(offspringAlive) || null,
      notes: notes.trim(),
    });
    if (!breeding && expectedBirthDate && addCalendarEvent) {
      const damName = animals.find(a => a.id === damId)?.name || "doe";
      addCalendarEvent({
        id: newId(),
        date: expectedBirthDate,
        title: `🐐 Expected kidding — ${damName}`,
        kind: "goat_kidding",
        relatedId: id,
      });
    }
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={breeding ? "Edit breeding record" : "Log breeding"}>
      {dams.length === 0 && (
        <div style={{padding:12,background:palette.bgAlt,borderRadius:8,fontSize:13,color:palette.inkSoft,marginBottom:12}}>
          You'll need at least one doe to log a breeding. Add a goat first (mark its sex as Doe).
        </div>
      )}
      <div style={{display:"flex",gap:12}}>
        <div style={{flex:1}}>
          <Field label="Doe (dam)">
            <select style={inputStyle} value={damId} onChange={e=>setDamId(e.target.value)}>
              <option value="">— Pick one —</option>
              {dams.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        </div>
        <div style={{flex:1}}>
          <Field label="Buck (sire)">
            {useUnknownSire ? (
              <input
                style={inputStyle}
                value={externalSireName}
                onChange={e => setExternalSireName(e.target.value)}
                placeholder="External / unknown sire"
              />
            ) : (
              <select style={inputStyle} value={sireId} onChange={e=>setSireId(e.target.value)}>
                <option value="">— Pick a buck —</option>
                {sires.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
            <button
              type="button"
              onClick={() => setUseUnknownSire(v => !v)}
              style={{background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,fontSize:11,padding:"4px 0 0",textDecoration:"underline",fontFamily:FONT_BODY}}
            >
              {useUnknownSire ? "Use a tracked buck instead" : "External / unknown sire"}
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
        <input type="date" style={inputStyle} value={breedDate} onChange={e=>setBreedDate(e.target.value)}/>
      </Field>
      <Field label="Expected kidding date">
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <input
            type="date"
            style={{...inputStyle,flex:1}}
            value={expectedBirthDate}
            onChange={e=>setExpectedBirthDate(e.target.value)}
          />
          {isOverridden && (
            <button
              type="button"
              onClick={resetExpected}
              style={{background:"none",border:`1.5px solid ${palette.line}`,borderRadius:8,cursor:"pointer",color:palette.inkSoft,fontSize:11,padding:"8px 10px",fontFamily:FONT_BODY,whiteSpace:"nowrap"}}
              title="Reset to breed date + 150 days"
            >
              ↻ Default
            </button>
          )}
        </div>
        <div style={{fontSize:11,color:palette.inkSoft,marginTop:4}}>
          Auto-filled at +150 days (goat gestation, ~5 months). Most breeds run 145–155 days. Edit if your herd runs different.
        </div>
      </Field>
      {!breeding && expectedBirthDate && (
        <div style={{padding:"10px 12px",background:palette.yolkSoft,borderRadius:8,fontSize:13,marginBottom:12,color:palette.ink}}>
          🐐 Expected kidding <strong>{fmtDate(expectedBirthDate)}</strong> will be added to your calendar.
        </div>
      )}
      <hr style={{border:"none",borderTop:`1px solid ${palette.line}`,margin:"14px 0"}}/>
      <div style={{fontSize:11,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:8}}>
        After kidding (fill in when it happens)
      </div>
      <Field label="Kidded date">
        <input type="date" style={inputStyle} value={birthedDate} onChange={e=>setBirthedDate(e.target.value)}/>
      </Field>
      <div style={{display:"flex",gap:12}}>
        <div style={{flex:1}}>
          <Field label="Kids born">
            <input type="number" min={0} style={inputStyle} value={offspringBorn} onChange={e=>setOffspringBorn(e.target.value)} placeholder="0"/>
          </Field>
        </div>
        <div style={{flex:1}}>
          <Field label="Alive at weaning">
            <input type="number" min={0} style={inputStyle} value={offspringAlive} onChange={e=>setOffspringAlive(e.target.value)} placeholder="0"/>
          </Field>
        </div>
      </div>
      <Field label="Notes (optional)">
        <textarea style={{...inputStyle,minHeight:60,resize:"vertical"}} value={notes} onChange={e=>setNotes(e.target.value)}/>
      </Field>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap"}}>
        {breeding && onDelete && (
          !confirmDelete
            ? <Btn variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Btn>
            : <Btn variant="danger" onClick={() => { onDelete(breeding.id); onClose(); }}>Confirm delete</Btn>
        )}
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={!damId || !breedDate || dams.length === 0}>Save</Btn>
      </div>
    </Modal>
  );
}

function GoatHome({hobby,entries,sales,update,setModal,setAppModal,customers=[]}){
  const allAnimals=hobby.animals||[];
  const animals=allAnimals.filter(a=>!a.archived);
  const archived=allAnimals.filter(a=>a.archived);
  const[breedingModal,setBreedingModal]=useState({open:false,breeding:null});
  // GOATS_UNIFY_V1 — top-bar modal state
  const [fedOpen, setFedOpen] = useState(false);
  const [milkOpen, setMilkOpen] = useState(false);
  const [kiddingOpen, setKiddingOpen] = useState(false);
  const [logEntryAction, setLogEntryAction] = useState(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  // Milk tile visibility: any live goat with a dairy purpose, OR none
  // have a purpose set at all (don't hide the tile if the user just
  // hasn't labeled their goats yet).
  const anyPurposeSet = animals.some(a => a.purpose);
  const hasDairy = animals.some(a => a.purpose === "Dairy" || a.purpose === "Both");
  const showMilkTile = !anyPurposeSet || hasDairy;
  const breedings=(hobby.breedings||[]).slice().sort((a,b)=>(b.breedDate||"").localeCompare(a.breedDate||""));
  const upcomingKiddings=breedings.filter(b=>!b.birthedDate&&b.expectedBirthDate>=todayStr()).slice(0,3);

  const saveBreeding=(breeding)=>{
    update(d=>{
      const h=d.hobbies.find(x=>x.id===hobby.id);
      if(!h)return d;
      if(!Array.isArray(h.breedings))h.breedings=[];
      const idx=h.breedings.findIndex(x=>x.id===breeding.id);
      if(idx>=0)h.breedings[idx]=breeding;else h.breedings.push(breeding);
      return d;
    });
  };
  const deleteBreeding=(id)=>{
    update(d=>{
      const h=d.hobbies.find(x=>x.id===hobby.id);
      if(h)h.breedings=(h.breedings||[]).filter(b=>b.id!==id);
      if(Array.isArray(d.calendarEvents)){
        d.calendarEvents=d.calendarEvents.filter(e=>e.relatedId!==id);
      }
      return d;
    });
  };
  const addCalendarEvent=(event)=>{
    update(d=>{
      if(!Array.isArray(d.calendarEvents))d.calendarEvents=[];
      d.calendarEvents.push(event);
      return d;
    });
  };

  return(
    <div>
      {breedingModal.open && (
        <BreedingModal
          animals={allAnimals}
          breeding={breedingModal.breeding}
          onClose={()=>setBreedingModal({open:false,breeding:null})}
          onSave={saveBreeding}
          onDelete={deleteBreeding}
          addCalendarEvent={addCalendarEvent}
        />
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:8,flexWrap:"wrap"}}>
        <div style={{fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink}}>Your goats</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {/* GOATS_UNIFY_V1 — 💕 Breeding moved into the tile bar below; the Add goat button stays as the page-action. */}
          <Btn small variant="accent" onClick={()=>setModal({type:"addAnimal",hobbyId:hobby.id})}><Plus size={14} style={{marginRight:4}}/>Add goat</Btn>
        </div>
      </div>

      {/* GOATS_UNIFY_V1 — quick action tile bar (mirrors Sheep/Rabbits/Pigs) */}
      {fedOpen && <FedGoatModal hobby={hobby} hobbyId={hobby.id} update={update} onClose={()=>setFedOpen(false)} />}
      {milkOpen && <MilkGoatModal hobby={hobby} hobbyId={hobby.id} update={update} onClose={()=>setMilkOpen(false)} />}
      {kiddingOpen && <KiddingGoatModal hobby={hobby} hobbyId={hobby.id} update={update} onClose={()=>setKiddingOpen(false)} />}
      {logEntryAction && <LogGoatEntryModal hobby={hobby} hobbyId={hobby.id} action={logEntryAction} update={update} onClose={()=>setLogEntryAction(null)} />}
      {removeOpen && <RemoveGoatModal hobby={hobby} hobbyId={hobby.id} update={update} onClose={()=>setRemoveOpen(false)} />}

      {animals.length > 0 && (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:8,marginBottom:18 }}>
          {showMilkTile && (
            <Btn small variant="leaf" onClick={() => setMilkOpen(true)} style={{ width:"100%" }}>🥛 Milk</Btn>
          )}
          <Btn small onClick={() => setFedOpen(true)} style={{ width:"100%" }}>🌾 Feed</Btn>
          <Btn small onClick={() => setLogEntryAction("weight")} style={{ width:"100%" }}>⚖️ Weight</Btn>
          <Btn small variant="leaf" onClick={() => setBreedingModal({open:true,breeding:null})} style={{ width:"100%" }}>💕 Breeding</Btn>
          <Btn small variant="leaf" onClick={() => setKiddingOpen(true)} style={{ width:"100%" }}>🍼 Kidding</Btn>
          <Btn small onClick={() => setLogEntryAction("health")} style={{ width:"100%" }}>💊 Vet / meds</Btn>
          <Btn small onClick={() => setLogEntryAction("note")} style={{ width:"100%" }}>📝 Note</Btn>
          {/* Add Expense — opens the shared AddExpenseModal via the app-level
              ModalRouter (setAppModal). Logs a hobby-attributed row to
              data.expenses[] for FIFO matching in the Sales tab. */}
          {setAppModal && (
            <Btn small onClick={() => setAppModal({ type: "addExpense", hobbyId: hobby.id })} style={{ width:"100%" }}>💵 Add Expense</Btn>
          )}
          {/* Custom logs — user-defined quick-log actions (e.g. "Hoof trim").
              Each writes to data.entries[hobby.id] via the global LogModal. */}
          {setAppModal && (Array.isArray(hobby.customLogs) ? hobby.customLogs : []).map(c => (
            <Btn key={c.id} small onClick={() => setAppModal({ type: "log", action: "custom", customLogId: c.id, hobbyIdOverride: hobby.id })} style={{ width:"100%" }}>{c.emoji || "📝"} {c.label}</Btn>
          ))}
          {setAppModal && (
            <Btn small onClick={() => setAppModal({ type: "customLogPicker", hobbyId: hobby.id })} style={{ width:"100%" }}>➕ Custom</Btn>
          )}
          <Btn small variant="danger" onClick={() => setRemoveOpen(true)} style={{ width:"100%" }}>❄️ Remove</Btn>
        </div>
      )}
      <HerdTallyCard hobby={hobby} setModal={setModal}/>
      {upcomingKiddings.length>0 && (
        <div style={{padding:"10px 12px",background:palette.bgAlt,borderRadius:8,fontSize:13,marginBottom:12,color:palette.ink}}>
          <div style={{fontSize:11,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:6}}>Upcoming kiddings</div>
          {upcomingKiddings.map(b=>{
            const dam=allAnimals.find(a=>a.id===b.damId);
            return <div key={b.id} style={{padding:"4px 0",cursor:"pointer"}} onClick={()=>setBreedingModal({open:true,breeding:b})}>🐐 {dam?.name||"doe"} — {fmtDate(b.expectedBirthDate)}{b.method&&b.method!=="Natural"?` · ${b.method}`:""}</div>;
          })}
        </div>
      )}
      {animals.length===0?(
        <div style={{padding:28,background:palette.card,border:`2px dashed ${palette.line}`,borderRadius:12,textAlign:"center",color:palette.inkSoft}}>
          <div style={{fontSize:36,marginBottom:10}}>🐐</div>
          <div style={{fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink,marginBottom:6}}>No goats yet</div>
          <div style={{fontSize:13,marginBottom:14}}>Add your first goat to start tracking milk, feed, and kids.</div>
          <Btn variant="accent" onClick={()=>setModal({type:"addAnimal",hobbyId:hobby.id})}>Add first goat</Btn>
        </div>
      ):animals.map(a=><AnimalCard key={a.id} animal={a} hobbyId={hobby.id} animals={allAnimals} entries={entries} sales={sales} hobby={hobby} update={update} setModal={setModal} customers={customers}/>)}

      {breedings.length>0 && (
        <details style={{marginTop:18}}>
          <summary style={{cursor:"pointer",color:palette.inkSoft,fontSize:13,padding:8,background:palette.bgAlt,borderRadius:8,userSelect:"none"}}>
            Recent breedings ({breedings.length}) — tap to view
          </summary>
          <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:6}}>
            {breedings.slice(0,10).map(b=>{
              const dam=allAnimals.find(a=>a.id===b.damId);
              const sire=allAnimals.find(a=>a.id===b.sireId);
              const sireName=sire?.name||b.externalSireName||"unknown sire";
              return (
                <div
                  key={b.id}
                  onClick={()=>setBreedingModal({open:true,breeding:b})}
                  style={{padding:"8px 12px",background:palette.bgAlt,borderRadius:8,fontSize:13,color:palette.inkSoft,cursor:"pointer"}}
                >
                  <strong style={{color:palette.ink}}>{dam?.name||"doe"}</strong> × {sireName} · {fmtDate(b.breedDate)} {b.method&&`· ${b.method}`}
                  {b.birthedDate ? <span style={{color:palette.leaf}}> ✓ kidded {fmtDate(b.birthedDate)} ({b.offspringBorn||0} born)</span> : <span> · expected {fmtDate(b.expectedBirthDate)}</span>}
                </div>
              );
            })}
          </div>
        </details>
      )}

      {archived.length>0 && (
        <details style={{marginTop:18}}>
          <summary style={{cursor:"pointer",color:palette.inkSoft,fontSize:13,padding:8,background:palette.bgAlt,borderRadius:8,userSelect:"none"}}>
            Archived goats ({archived.length}) — tap to view
          </summary>
          <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:6}}>
            {archived.map(a=>(
              <div
                key={a.id}
                onClick={()=>setModal({type:"editAnimal",hobbyId:hobby.id,animalId:a.id})}
                style={{padding:"8px 12px",background:palette.bgAlt,borderRadius:8,fontSize:13,color:palette.inkSoft,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}
              >
                <span><strong style={{color:palette.ink}}>{a.name}</strong>{a.breed?` · ${a.breed}`:""} — {a.archivedReason||"archived"}{a.archivedDate?` · ${a.archivedDate}`:""}</span>
                <span style={{fontSize:11,opacity:0.6}}>Tap to restore</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export function GoatsAnalytics({hobby,entries,/* ADV_ANALYTICS */ allEntries=null,dateRange=null,earlyAccessConfig=null,isSupporter=false}){
  // Live animals = headcount in the UI. All entries (including from archived
  // animals) are still counted in totals — those are historical facts.
  const animals=(hobby.animals||[]).filter(a=>!a.archived);
  const milkEntries=entries.filter(e=>e.action==="milk");
  const feedEntries=entries.filter(e=>e.action==="fed");
  const kidEntries=entries.filter(e=>e.action==="kid");
  const butcherEntries=entries.filter(e=>e.action==="butcher");
  const totalMilkOz=milkEntries.reduce((s,e)=>s+(Number(e.oz)||0),0);
  const totalFeedCost=feedEntries.reduce((s,e)=>s+(Number(e.cost)||0),0);
  const totalFeedLbs=feedEntries.reduce((s,e)=>s+(Number(e.lbs)||0),0);
  const totalKids=kidEntries.reduce((s,e)=>s+(Number(e.count)||1),0);
  const totalMeatLbs=butcherEntries.reduce((s,e)=>s+(Number(e.weight)||0),0);
  const fcr=totalFeedLbs>0&&totalMeatLbs>0?(totalFeedLbs/totalMeatLbs).toFixed(2):"—";
  const byDate={};
  milkEntries.forEach(e=>{byDate[e.date]=(byDate[e.date]||0)+(Number(e.oz)||0);});
  const milkTrend=Object.entries(byDate).sort().slice(-14).map(([date,oz])=>({date:date.slice(5),oz:Number(oz.toFixed(1))}));
  const milkByAnimal={};
  milkEntries.forEach(e=>{milkByAnimal[e.animalName||e.animalId]=(milkByAnimal[e.animalName||e.animalId]||0)+(Number(e.oz)||0);});
  const milkChart=Object.entries(milkByAnimal).map(([name,oz])=>({name,oz:Number(oz.toFixed(1))})).sort((a,b)=>b.oz-a.oz);

  // ── ADV_ANALYTICS ─────────────────────────────────────────────────────────
  // Personal record + monthly line chart scan ALL-TIME entries (allEntries),
  // not the filtered window — a record should not change when you change the
  // date filter. The period-vs-period delta DOES respect the filter.
  const advAll = allEntries || entries;            // fallback if not injected
  const advAllMilk = advAll.filter(e=>e.action==="milk");
  // Monthly milk series (gallons) for the line chart + record.
  const milkMonthlyOz = monthlySeries(advAllMilk, e=>e.date, e=>Number(e.oz)||0);
  const milkMonthly = milkMonthlyOz.map(p=>({month:p.month,gal:Number((p.value/128).toFixed(2)),
    label:(()=>{const pr=String(p.month).split("-").map(Number);const d=new Date(pr[0],pr[1]-1,1);return isNaN(d)?p.month:d.toLocaleDateString("en-US",{month:"short",year:"2-digit"});})()}));
  const milkRecord = personalRecord(milkMonthlyOz);   // best month by oz
  // Period-vs-period: current filtered milk vs. the prior equal-length window.
  const prior = priorDateRange(dateRange);
  const priorMilkOz = prior
    ? filterByDateRange(advAllMilk, prior, e=>e.date).reduce((s,e)=>s+(Number(e.oz)||0),0)
    : null;
  const milkDelta = prior ? computeDelta(totalMilkOz, priorMilkOz) : null;
  const pFonts = { body: FONT_BODY, display: FONT_DISPLAY };

  return(
    <div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
        <StatCard label="Total milk" value={fmtVolume(totalMilkOz/128)} accent={palette.leaf}/>
        <StatCard label="Animals" value={animals.length} accent={palette.ink}/>
        <StatCard label="Kids born" value={totalKids} accent={palette.yolk}/>
        <StatCard label="Feed cost" value={fmtMoney(totalFeedCost)} accent={palette.feather}/>
        {butcherEntries.length>0&&<StatCard label="Butchered" value={butcherEntries.length} sub={fmtWeight(totalMeatLbs)} accent={palette.accent}/>}
        {fcr!=="—"&&<StatCard label="FCR" value={fcr} sub="lbs feed / lb meat" accent={palette.feather}/>}
      </div>

      {/* ADV_ANALYTICS: gated advanced block — milk trend, record, period delta */}
      <LockedStatOverlay earlyAccessConfig={earlyAccessConfig} isSupporter={isSupporter} palette={palette} fonts={pFonts}>
        <div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
            {milkRecord&&<StatCard label="Best milk month" value={fmtVolume(milkRecord.value/128)} sub={milkRecord.label} accent={palette.leaf}/>}
            {milkDelta&&(
              <div style={{flex:"1 1 140px",minWidth:140,boxSizing:"border-box",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14}}>
                <div style={{fontSize:10,fontFamily:FONT_BODY,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Milk vs. prior period</div>
                <div style={{fontSize:22,fontFamily:FONT_DISPLAY,color:palette.leaf,lineHeight:1.1}}>{fmtVolume(totalMilkOz/128)}</div>
                <div style={{marginTop:4}}><StatTrend delta={milkDelta} palette={palette} fonts={pFonts}/></div>
              </div>
            )}
          </div>
          {milkMonthly.length>1&&(
            <ChartCard title="🥛 Milk by month">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={milkMonthly}>
                  <XAxis dataKey="label" stroke={palette.inkSoft} fontSize={11}/>
                  <YAxis stroke={palette.inkSoft} fontSize={11}/>
                  <Tooltip contentStyle={{background:palette.card,border:`1.5px solid ${palette.ink}`,borderRadius:8}} formatter={v=>[`${v} gal`,"Milk"]}/>
                  <Line type="monotone" dataKey="gal" stroke={palette.leaf} strokeWidth={3} dot={{fill:palette.accent,r:4}}/>
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </div>
      </LockedStatOverlay>

      {milkTrend.length>1&&<ChartCard title="🥛 Daily milk (oz)"><ResponsiveContainer width="100%" height={180}><BarChart data={milkTrend}><XAxis dataKey="date" stroke={palette.inkSoft} fontSize={11}/><YAxis stroke={palette.inkSoft} fontSize={11}/><Tooltip contentStyle={{background:palette.card,border:`1.5px solid ${palette.ink}`,borderRadius:8}} formatter={v=>[`${v} oz`,"Milk"]}/><Bar dataKey="oz" fill={palette.leaf} radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></ChartCard>}
      {milkChart.length>1&&<ChartCard title="🐐 Milk by animal"><div style={{display:"flex",flexDirection:"column",gap:6}}>{milkChart.map(a=><div key={a.name} style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",background:palette.bgAlt,borderRadius:8,fontSize:13}}><span>🐐 {a.name}</span><strong>{fmtVolume((Number(a.oz)||0)/128)}</strong></div>)}</div></ChartCard>}
      {animals.length===0&&<div style={{padding:24,textAlign:"center",color:palette.inkSoft,fontSize:13}}>No goat entries yet.</div>}
    </div>
  );
}

function GoatModalRouter({modal,hobby,update,user,onClose}){
  if(!modal)return null;
  if(modal.type==="addAnimal")return <AnimalModal hobbyId={hobby.id} animals={hobby.animals||[]} update={update} user={user} onClose={onClose}/>;
  if(modal.type==="editAnimal"){const animal=(hobby.animals||[]).find(a=>a.id===modal.animalId);if(!animal){onClose();return null;}return <AnimalModal animal={animal} hobbyId={hobby.id} animals={hobby.animals||[]} update={update} user={user} onClose={onClose}/>;}
  if(modal.type==="herdTally")return <HerdTallyModal hobby={hobby} update={update} onClose={onClose}/>;
  return null;
}

export default function GoatsPage({hobby,data,update,user,setModal:setAppModal}){
  const[localModal,setLocalModal]=useState(null);
  const entries=data.entries[hobby.id]||[];
  return(
    <div>
      <GoatModalRouter modal={localModal} hobby={hobby} update={update} user={user} onClose={()=>setLocalModal(null)}/>
      <GoatHome hobby={hobby} entries={entries} sales={data.sales||[]} update={update} setModal={setLocalModal} setAppModal={setAppModal} customers={data.customers||[]}/>
    </div>
  );
}
