// ============================================================================
// COWS — per-animal tracking, dairy or beef, milk/calves/butcher logging
// ============================================================================
import React, { useState, useEffect } from "react";
import { X, Edit3, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { SireDamPicker, PedigreeView } from "./PedigreeView.jsx";
import { AnimalHistoryView } from "./AnimalHistoryView.jsx";
import { fmtWeight, fmtVolume, weightUnitLabel, volumeUnitLabel, lbsFromInput, galFromInput, weightFromLbs, volumeFromGal, getCurrentWeightUnit, getCurrentVolumeUnit } from "./units.js";
import { profilePhotoOf, timelineOf, addPhotoToAnimal, removePhotoFromAnimal, withProfileSet, withPhotoEdited, resolveAnimalPhotoUrl } from "./animalPhotos.js";
// ADV_ANALYTICS: shared advanced-analytics layer (see analytics.js).
import {
  priorDateRange, computeDelta, StatTrend, personalRecord,
  monthlySeries, LockedStatOverlay,
} from "./analytics.js";

const palette = {
  bg:"#F4EDE0",bgAlt:"#EBE0CC",ink:"#2C1810",inkSoft:"#5C4530",
  accent:"#C84B31",leaf:"#5A7A3C",leafSoft:"#A8C078",
  yolk:"#E8B547",yolkSoft:"#F2D58A",feather:"#8B6F47",
  line:"#2C181030",card:"#FAF5EA",
}; /* COWS_UNIFY_V1 — added leafSoft (was referenced but undefined) + yolkSoft */
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
const ageInMonths=(dob)=>{if(!dob)return null;const b=parseLocalDate(dob);if(!b)return null;const n=new Date();return(n.getFullYear()-b.getFullYear())*12+(n.getMonth()-b.getMonth());};
const fmtAge=(dob)=>{const m=ageInMonths(dob);if(m==null)return"";if(m<12)return`${m}mo`;const y=Math.floor(m/12);const mm=m%12;return mm===0?`${y}y`:`${y}y ${mm}mo`;};
const fmtMoney=(n)=>`$${(Number(n)||0).toFixed(2)}`;

const COW_BREEDS=["Angus","Hereford","Holstein","Jersey","Ayrshire","Simmental","Charolais","Longhorn","Dexter","Highland","Brown Swiss","Guernsey","Limousin","Red Angus","Shorthorn","Mixed","Other"];
const COW_PURPOSES=["Dairy","Beef","Both"];
const COW_SEXES=["Cow","Bull","Steer","Heifer","Calf"];

function Btn({children,onClick,variant="primary",small=false,style={},disabled=false}){
  const styles={primary:{background:palette.ink,color:palette.bg,border:`1.5px solid ${palette.ink}`},danger:{background:palette.accent,color:palette.bg,border:`1.5px solid ${palette.accent}`},ghost:{background:"transparent",color:palette.ink,border:`1.5px solid ${palette.line}`},accent:{background:palette.yolk,color:palette.ink,border:`1.5px solid ${palette.ink}`},leaf:{background:palette.leaf,color:palette.bg,border:`1.5px solid ${palette.leaf}`}}; /* COWS_UNIFY_V1 — leaf variant */
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
// PASTURE / HERD MODAL — create or edit a grouping for cattle. The `type`
// flips the label between "pasture" (a fenced area) and "herd" (a
// management group), but functionally they behave the same. Each cow gets
// an optional pastureId, and the main page groups by pasture.
// ============================================================================
function PastureModal({pasture,hobbyId,update,onClose}){
  const isEdit = !!pasture;
  const [name, setName] = useState(pasture?.name || "");
  const [type, setType] = useState(pasture?.type || "pasture");
  const [acreage, setAcreage] = useState(pasture?.acreage ? String(pasture.acreage) : "");
  const [notes, setNotes] = useState(pasture?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    if (!name.trim()) return;
    const id = pasture?.id || newId();
    const data = {
      id,
      name: name.trim(),
      type,
      acreage: Number(acreage) || 0,
      notes: notes.trim(),
      created: pasture?.created || Date.now(),
    };
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      if (!Array.isArray(h.pastures)) h.pastures = [];
      if (isEdit) {
        const idx = h.pastures.findIndex(p => p.id === id);
        if (idx !== -1) h.pastures[idx] = data;
        else h.pastures.push(data);
      } else {
        h.pastures.push(data);
      }
      return d;
    });
    onClose();
  };

  // Deleting a pasture just unassigns its cattle (sets pastureId to null
  // on each cow); the cows stay, they just move to the Ungrouped section.
  // Less destructive than asking "are you sure" with no recovery path.
  const remove = () => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      (h.animals || []).forEach(a => {
        if (a.pastureId === pasture.id) a.pastureId = null;
      });
      h.pastures = (h.pastures || []).filter(p => p.id !== pasture.id);
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit ${type}` : "Add a pasture or herd"}>
      <Field label="Type">
        <div style={{display:"flex",gap:6}}>
          {[
            {v:"pasture", l:"🌾 Pasture", sub:"A fenced area"},
            {v:"herd", l:"🐂 Herd", sub:"A management group"},
          ].map(o => (
            <button key={o.v} onClick={()=>setType(o.v)} style={{
              flex:1, padding:"10px 12px", borderRadius:8,
              border:`1.5px solid ${type===o.v?palette.ink:palette.line}`,
              background:type===o.v?palette.ink:palette.card,
              color:type===o.v?palette.bg:palette.ink,
              fontFamily:FONT_BODY, fontWeight:600, fontSize:13, cursor:"pointer",
              textAlign:"left",
            }}>
              <div>{o.l}</div>
              <div style={{fontSize:10,opacity:0.75,marginTop:2,fontWeight:400}}>{o.sub}</div>
            </button>
          ))}
        </div>
      </Field>
      <Field label="Name">
        <input
          style={inputStyle}
          value={name}
          onChange={e=>setName(e.target.value)}
          placeholder={type==="pasture" ? "e.g. North Pasture, Barn Lot" : "e.g. Breeding herd, Yearlings"}
          autoFocus
        />
      </Field>
      <Field label={type==="pasture" ? "Acreage (optional)" : "Approx. acreage (optional)"}>
        <input
          type="number" min={0} step="0.1"
          style={inputStyle}
          value={acreage}
          onChange={e=>setAcreage(e.target.value)}
          placeholder="0"
          inputMode="decimal"
        />
      </Field>
      <Field label="Notes (optional)">
        <textarea
          style={{...inputStyle, minHeight: 60, resize: "vertical"}}
          value={notes}
          onChange={e=>setNotes(e.target.value)}
          placeholder={type==="pasture" ? "Water source, fencing notes, rotation schedule..." : "Purpose, rotation plan, etc."}
        />
      </Field>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginTop:6}}>
        <Btn onClick={save}>{isEdit ? "Save changes" : "Add"}</Btn>
        {isEdit && !confirmDelete && (
          <Btn variant="ghost" onClick={()=>setConfirmDelete(true)}>Delete</Btn>
        )}
        {isEdit && confirmDelete && (
          <Btn variant="danger" onClick={remove}>Confirm — delete</Btn>
        )}
      </div>
      {confirmDelete && (
        <div style={{fontSize:11,color:palette.inkSoft,marginTop:8,fontStyle:"italic",lineHeight:1.5}}>
          Deleting moves all cattle in this {type} back to "Ungrouped". The animals themselves are not affected.
        </div>
      )}
    </Modal>
  );
}

// ============================================================================
// MOVE ANIMAL MODAL — reassign a cow's pasture without the full edit form
// ----------------------------------------------------------------------------
// A lightweight quick-action. Writes only animal.pastureId. The full
// edit-cow form still has a pasture picker too; this is just the fast path.
// ============================================================================
function MoveAnimalModal({animal,hobbyId,pastures,update,onClose}){
  const [pastureId, setPastureId] = useState(animal?.pastureId || "");
  const groups = pastures || [];

  const save = () => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      const a = (h.animals || []).find(x => x.id === animal.id);
      if (a) a.pastureId = pastureId || null;
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Move ${animal?.name || "animal"}`}>
      <Field label="Pasture / herd">
        <select style={inputStyle} value={pastureId} onChange={e=>setPastureId(e.target.value)} autoFocus>
          <option value="">— Unassigned —</option>
          {groups.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </Field>
      {groups.length === 0 && (
        <div style={{fontSize:12,color:palette.inkSoft,marginTop:8,marginBottom:4}}>
          No pastures or herds yet. Add one from the cows page first.
        </div>
      )}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14}}>
        <button onClick={onClose} style={{padding:"9px 16px",borderRadius:8,background:palette.bgAlt,border:`1.5px solid ${palette.line}`,fontFamily:FONT_BODY,fontWeight:600,fontSize:13,cursor:"pointer",color:palette.ink}}>Cancel</button>
        <button onClick={save} style={{padding:"9px 16px",borderRadius:8,background:palette.yolk,border:`1.5px solid ${palette.ink}`,fontFamily:FONT_BODY,fontWeight:600,fontSize:13,cursor:"pointer",color:palette.ink}}>Move</button>
      </div>
    </Modal>
  );
}
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

function AnimalModal({animal,hobbyId,animals,pastures=[],update,user,onClose}){
  const isEdit=!!animal;
  const[name,setName]=useState(animal?.name||"");
  // Breed: dropdown + "Other" custom text field
  const initBreed = (animal?.breed || "").trim();
  const initIsKnown = COW_BREEDS.includes(initBreed);
  const[breedSelect,setBreedSelect]=useState(initBreed && initIsKnown ? initBreed : (initBreed ? "Other" : "Mixed"));
  const[breedCustom,setBreedCustom]=useState(initBreed && !initIsKnown ? initBreed : "");
  const finalBreed = breedSelect === "Other" ? breedCustom.trim() : breedSelect;
  const[purpose,setPurpose]=useState(animal?.purpose||"Dairy");
  const[sex,setSex]=useState(animal?.sex||"Cow");
  const[dob,setDob]=useState(animal?.dob||"");
  const[tagId,setTagId]=useState(animal?.tagId||"");
  // Pasture / herd assignment — optional. Empty string = "Ungrouped" on
  // the main page. Cows can move between pastures freely.
  const[pastureId,setPastureId]=useState(animal?.pastureId||"");
  // RFID tag — required for cattle movement in Canada. Free-text since
  // barcode scanning requires ML Kit which excludes too many older devices.
  const[rfidNumber,setRfidNumber]=useState(animal?.rfidNumber||"");
  // Brand date + location (e.g. "left hip", "right shoulder"). Both optional
  // since not every cattle keeper brands their animals.
  const[brandDate,setBrandDate]=useState(animal?.brandDate||"");
  const[brandLocation,setBrandLocation]=useState(animal?.brandLocation||"");
  const[notes,setNotes]=useState(animal?.notes||"");
  const[confirmDelete,setConfirmDelete]=useState(false);
  // Push 7a — pedigree fields. See Goats.jsx for the design rationale; same
  // pattern across all 5 livestock hobbies (linked picker + free-text fallback).
  const [sireId, setSireId] = useState(animal?.sireId || "");
  const [sire, setSire] = useState(animal?.sire || "");
  const [damId, setDamId] = useState(animal?.damId || "");
  const [dam, setDam] = useState(animal?.dam || "");
  const [registryNumber, setRegistryNumber] = useState(animal?.registryNumber || "");
  const [registryName, setRegistryName] = useState(animal?.registryName || "");
  const save=()=>{
    if(!name.trim())return;
    const id=animal?.id||newId();
    update(d=>{const h=d.hobbies.find(x=>x.id===hobbyId);if(!h)return d;if(!Array.isArray(h.animals))h.animals=[];const data={id,name:name.trim(),breed:finalBreed,purpose,sex,dob,tagId,rfidNumber:rfidNumber.trim(),brandDate,brandLocation:brandLocation.trim(),pastureId:pastureId||null,notes,sireId:sireId||null,sire:sire.trim(),damId:damId||null,dam:dam.trim(),registryNumber:registryNumber.trim(),registryName:registryName.trim(),photos:animal?.photos||[],created:animal?.created||Date.now(),archived:animal?.archived||false,archivedReason:animal?.archivedReason,archivedDate:animal?.archivedDate};if(isEdit){const idx=h.animals.findIndex(a=>a.id===id);if(idx!==-1)h.animals[idx]=data;else h.animals.push(data);}else h.animals.push(data);return d;});
    onClose();
  };
  const remove=()=>{update(d=>{const h=d.hobbies.find(x=>x.id===hobbyId);if(h)h.animals=(h.animals||[]).filter(a=>a.id!==animal.id);return d;});onClose();};
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
    <Modal open onClose={onClose} title={isEdit?"Edit cow":"Add a cow"}>
      <Field label="Name"><input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Bessie" autoFocus/></Field>
      <Field label="Breed">
        <select style={inputStyle} value={breedSelect} onChange={e=>setBreedSelect(e.target.value)}>{COW_BREEDS.map(b=><option key={b}>{b}</option>)}</select>
        {breedSelect === "Other" && (
          <input style={{...inputStyle, marginTop: 8}} value={breedCustom} onChange={e=>setBreedCustom(e.target.value)} placeholder="Type your breed (e.g. Wagyu, Belted Galloway, Devon)" autoFocus />
        )}
      </Field>
      <div style={{display:"flex",gap:12}}>
        <div style={{flex:1}}><Field label="Purpose"><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{COW_PURPOSES.map(p=><button key={p} onClick={()=>setPurpose(p)} style={{padding:"7px 12px",borderRadius:8,fontFamily:FONT_BODY,fontWeight:600,fontSize:13,cursor:"pointer",border:`1.5px solid ${purpose===p?palette.ink:palette.line}`,background:purpose===p?palette.ink:palette.card,color:purpose===p?palette.bg:palette.ink}}>{p}</button>)}</div></Field></div>
        <div style={{flex:1}}><Field label="Sex"><select style={inputStyle} value={sex} onChange={e=>setSex(e.target.value)}>{COW_SEXES.map(s=><option key={s}>{s}</option>)}</select></Field></div>
      </div>
      <div style={{display:"flex",gap:12}}>
        <div style={{flex:1}}><Field label="Date of birth (optional)"><input type="date" style={inputStyle} value={dob} onChange={e=>setDob(e.target.value)}/></Field></div>
        <div style={{flex:1}}><Field label="Ear tag / ID (optional)"><input style={inputStyle} value={tagId} onChange={e=>setTagId(e.target.value)} placeholder="e.g. #42"/></Field></div>
      </div>
      {/* Pasture / herd assignment — only shown when at least one exists.
          Users who haven't created a pasture yet don't see this field at
          all, keeping the form short for simple setups. */}
      {pastures.length > 0 && (
        <Field label="Pasture / herd (optional)">
          <select style={inputStyle} value={pastureId} onChange={e=>setPastureId(e.target.value)}>
            <option value="">— Ungrouped —</option>
            {pastures.map(p => (
              <option key={p.id} value={p.id}>
                {p.type === "herd" ? "🐂" : "🌾"} {p.name}{p.acreage ? ` · ${p.acreage} acres` : ""}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Color, markings, notes..."/></Field>

      {/* Identification — RFID tag (Canada requires this for movement) and
          branding details. Collapsed by default since not every herd needs
          this level of detail; opens for users in regulated jurisdictions
          or anyone who brands their cattle. */}
      <details style={{marginBottom:14}}>
        <summary style={{cursor:"pointer",padding:"8px 12px",background:palette.bgAlt,borderRadius:8,fontSize:13,fontWeight:600,color:palette.ink,userSelect:"none"}}>
          🏷️ Identification & branding (optional)
        </summary>
        <div style={{padding:"12px 4px 4px"}}>
          <Field label="RFID tag number (optional)">
            <div style={{display:"flex",gap:8}}>
              <input
                style={{...inputStyle, flex:1}}
                value={rfidNumber}
                onChange={e=>setRfidNumber(e.target.value)}
                placeholder="124 000 000 000 000"
                inputMode="numeric"
              />
            </div>
            <div style={{fontSize:11,color:palette.inkSoft,marginTop:4,lineHeight:1.4}}>
              Required by CCIA / CFIA for cattle movement in Canada. Type the 15-digit number from the tag.
            </div>
          </Field>
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}>
              <Field label="Brand date (optional)">
                <input type="date" style={inputStyle} value={brandDate} onChange={e=>setBrandDate(e.target.value)}/>
              </Field>
            </div>
            <div style={{flex:1}}>
              <Field label="Brand location (optional)">
                <input style={inputStyle} value={brandLocation} onChange={e=>setBrandLocation(e.target.value)} placeholder="e.g. left hip"/>
              </Field>
            </div>
          </div>
        </div>
      </details>

      {/* Push 7a — Pedigree. Sire = Bull only (Steers are castrated, can't sire);
          Dam = Cow or Heifer (heifers can be mothers too). */}
      <details style={{marginBottom:14}}>
        <summary style={{cursor:"pointer",padding:"8px 12px",background:palette.bgAlt,borderRadius:8,fontSize:13,fontWeight:600,color:palette.ink,userSelect:"none"}}>
          🧬 Pedigree & registry (optional)
        </summary>
        <div style={{padding:"12px 4px 4px"}}>
          <SireDamPicker
            label="Dam"
            animals={animals||[]}
            eligibleSexes={["Cow","Heifer"]}
            excludeId={animal?.id}
            selectedId={damId}
            selectedName={dam}
            onChange={({id,name})=>{setDamId(id);setDam(name);}}
            placeholder="Type the dam's name"
          />
          <SireDamPicker
            label="Sire"
            animals={animals||[]}
            eligibleSexes={["Bull"]}
            excludeId={animal?.id}
            selectedId={sireId}
            selectedName={sire}
            onChange={({id,name})=>{setSireId(id);setSire(name);}}
            placeholder="Type the sire's name"
          />
          <Field label="Registry name (optional)">
            <input style={inputStyle} value={registryName} onChange={e=>setRegistryName(e.target.value)} placeholder="e.g. Maplewood Daisy"/>
          </Field>
          <Field label="Registry number (optional)">
            <input style={inputStyle} value={registryNumber} onChange={e=>setRegistryNumber(e.target.value)} placeholder="e.g. AAA #12345678"/>
          </Field>
        </div>
      </details>

      {isEdit && animal && (
        <AnimalPhotoSection animal={animal} hobbyId={hobbyId} update={update} user={user} />
      )}

      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <Btn onClick={save}>{isEdit?"Save changes":"Add cow"}</Btn>
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
            Keeps the cow's history but removes them from your active list. You can restore them later.
          </div>
          <Field label="Reason">
            <select style={inputStyle} value={archiveReason} onChange={e=>setArchiveReason(e.target.value)}>
              <option value="sold">Sold</option>
              <option value="butchered">Butchered</option>
              <option value="died">Died (illness/age)</option>
              <option value="lost">Lost</option>
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
// COWS_UNIFY_V1 — top-bar quick-action modals
// ----------------------------------------------------------------------------
// Mirrors the post-Phase-1/2/3 Rabbits/Pigs/Goats pattern, with a twist:
// cows have a real grouping field (pastureId → hobby.pastures[]), so the
// selection picker shows per-pasture chips — closer to Rabbits' hutch
// picker than the flat All+Custom picker used in Pigs/Goats.
//
// Entry shapes match exactly what the old per-card LogModal wrote, so
// existing analytics, history views, and archive logic keep working
// unchanged.
//
// PRESERVED: the existing rich BreedingModal (hobby.breedings[] lifecycle,
// cow_calving calendar events) — unchanged. The tile bar just gives it
// a relocated trigger.
// PRESERVED: calf-as-tracked-animal — when the user enters a calf name
// the modal creates a new animal record with damId pointing at the cow.
// PRESERVED: heat (cow_heat_expected calendar at +21d) and AI
// (cow_preg_check_due calendar at +30d) side-effects.
// PRESERVED: FEAT6-FED herdWide flag for feed entries.
// ============================================================================

// --- Shared selection helpers (per-pasture chips + Custom + All) ----------

function pillStyleC(active) {
  return {
    padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,
    border: active ? `1.5px solid ${palette.ink}` : `1.5px solid ${palette.line}`,
    background: active ? palette.ink : palette.bgAlt,
    color: active ? palette.bg : palette.ink,
    cursor:"pointer",
  };
}

// Returns the list of pasture objects that actually contain at least one
// live animal. Plus a synthetic "Ungrouped" entry if there are unassigned
// live animals. Used to render the per-group chips.
function pastureBucketsOf(live, pastures) {
  const buckets = [];
  (pastures || []).forEach(p => {
    const n = live.filter(a => a.pastureId === p.id).length;
    if (n > 0) buckets.push({ id: p.id, label: p.name, count: n, kind: p.type || "pasture" });
  });
  const ungroupedCount = live.filter(a => !a.pastureId).length;
  if (ungroupedCount > 0) buckets.push({ id: "__ungrouped__", label: "Ungrouped", count: ungroupedCount, kind: "ungrouped" });
  return buckets;
}

function selectionButtonsC({ live, pastures, mode, setMode }) {
  const buckets = pastureBucketsOf(live, pastures);
  return (
    <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:8 }}>
      <button type="button" onClick={()=>setMode("all")} style={pillStyleC(mode==="all")}>
        {mode==="all" ? "✓ " : ""}All ({live.length})
      </button>
      {buckets.map(b => {
        const k = `group:${b.id}`;
        const emoji = b.kind === "herd" ? "🐂" : b.kind === "ungrouped" ? "🐄" : "🌾";
        return (
          <button key={b.id} type="button" onClick={()=>setMode(k)} style={pillStyleC(mode===k)}>
            {mode===k ? "✓ " : ""}{emoji} {b.label} ({b.count})
          </button>
        );
      })}
      <button type="button" onClick={()=>setMode("custom")} style={pillStyleC(mode==="custom")}>
        {mode==="custom" ? "✓ " : ""}Custom…
      </button>
    </div>
  );
}

function multiToggleRowC({ live, pastures, selectedIds, setSelectedIds }) {
  const pastureName = (id) => (pastures || []).find(p => p.id === id)?.name || "";
  return (
    <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:8 }}>
      {live.map(a => {
        const on = selectedIds.includes(a.id);
        const pn = a.pastureId ? pastureName(a.pastureId) : "";
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
          >{on ? "✓ " : ""}{a.name}{pn?` · ${pn}`:""}</button>
        );
      })}
    </div>
  );
}

function resolveSelectedIdsC({ mode, customIds, live }) {
  if (mode === "all") return live.map(a => a.id);
  if (mode === "custom") return customIds;
  if (mode.startsWith("group:")) {
    const id = mode.slice("group:".length);
    if (id === "__ungrouped__") return live.filter(a => !a.pastureId).map(a => a.id);
    return live.filter(a => a.pastureId === id).map(a => a.id);
  }
  return [];
}

// --- 🌾 FedCowModal ---------------------------------------------------------

function FedCowModal({ hobby, hobbyId, update, onClose }) {
  const live = (hobby.animals||[]).filter(a=>!a.archived);
  const pastures = hobby.pastures || [];

  const [date, setDate] = useState(todayStr());
  const [lbs, setLbs] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState(live.length ? "all" : "custom");
  const [customIds, setCustomIds] = useState([]);

  const targetIds = resolveSelectedIdsC({ mode, customIds, live });
  const canSave = (mode === "all") || targetIds.length > 0;

  const save = () => {
    if (!canSave) return;
    update(d => {
      d.entries = d.entries || {};
      d.entries[hobbyId] = d.entries[hobbyId] || [];
      // FEAT6-FED preserved: when mode is "all", set herdWide=true and
      // animalId=null so the entry isn't pinned to any single cow but
      // still counts in totals. Otherwise pin to the first id (legacy
      // history filter) and store the full set in animalIds.
      const isHerdWide = mode === "all";
      const entry = {
        id: newId(),
        date,
        action: "fed",
        animalIds: isHerdWide ? [] : [...targetIds],
        animalId: isHerdWide ? null : (targetIds[0] || null),
        animalName: isHerdWide ? "" : (live.find(a=>a.id===targetIds[0])?.name || ""),
        lbs: Number(lbs) || 0,
        cost: Number(cost) || 0,
        notes: notes.trim(),
        herdWide: isHerdWide,
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
      <Field label={`Who is this for? (${targetIds.length} ${targetIds.length===1?"animal":"animals"})`}>
        {selectionButtonsC({ live, pastures, mode, setMode })}
        {mode === "custom" && multiToggleRowC({ live, pastures, selectedIds: customIds, setSelectedIds: setCustomIds })}
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

// --- 🥛 MilkCowModal --------------------------------------------------------

function MilkCowModal({ hobby, hobbyId, update, onClose }) {
  const live = (hobby.animals||[]).filter(a=>!a.archived);
  const dairy = live.filter(a => a.purpose === "Dairy" || a.purpose === "Both");
  // Surface dairy/both cows first; fall back to all live cows if no
  // purposes are set yet (don't be obstinate about labeling).
  const choosable = dairy.length > 0 ? dairy : live;

  const [date, setDate] = useState(todayStr());
  const [animalId, setAnimalId] = useState(choosable[0]?.id || "");
  const [gallons, setGallons] = useState("");
  const [notes, setNotes] = useState("");

  const canSave = !!animalId && !!date && Number(gallons) > 0;

  const save = () => {
    if (!canSave) return;
    const a = choosable.find(x => x.id === animalId);
    update(d => {
      d.entries = d.entries || {};
      d.entries[hobbyId] = d.entries[hobbyId] || [];
      d.entries[hobbyId].push({
        id: newId(), date, action: "milk",
        animalId, animalName: a?.name || "",
        gallons: Number(gallons) || 0,
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
      <Field label="Cow">
        <select style={inputStyle} value={animalId} onChange={e=>setAnimalId(e.target.value)} autoFocus>
          {choosable.length === 0 && <option value="">— No cows available —</option>}
          {choosable.map(a => <option key={a.id} value={a.id}>{a.name}{a.purpose?` · ${a.purpose}`:""}</option>)}
        </select>
      </Field>
      {(()=>{
        // Same dual-unit pattern as the old LogModal.
        const shown = gallons===""||gallons==null ? "" : (isMetricV ? String(Math.round(volumeFromGal(Number(gallons))*100)/100) : gallons);
        return (
          <Field label={isMetricV?"Milk (liters)":"Milk (gallons)"}>
            <input type="number" min={0} step="0.1" style={inputStyle} value={shown}
              onChange={e=>{const r=e.target.value;setGallons(r===""?"":(isMetricV?String(galFromInput(r)):r));}}
              placeholder="0" inputMode="decimal"/>
          </Field>
        );
      })()}
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!canSave}>Save</Btn>
      </div>
    </Modal>
  );
}

// --- ⚖️ 💊 📝 LogCowEntryModal (shared for weight / health / note) ---------

function LogCowEntryModal({ hobby, hobbyId, action, update, onClose }) {
  const live = (hobby.animals||[]).filter(a=>!a.archived);
  const pastures = hobby.pastures || [];

  const isMulti = action === "health" || action === "note";

  const [date, setDate] = useState(todayStr());
  const [animalId, setAnimalId] = useState(live[0]?.id || "");
  const [mode, setMode] = useState(live.length ? "all" : "custom");
  const [customIds, setCustomIds] = useState([]);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");

  const targetIds = isMulti ? resolveSelectedIdsC({ mode, customIds, live }) : (animalId ? [animalId] : []);

  const titles = { weight:"⚖️ Log weight", health:"💊 Vet / meds", note:"📝 Add note" };
  const subtexts = {
    weight: "Track growth over time.",
    health: "Treatments, dewormers, vaccines, vet visits — anything worth remembering.",
    note: "Anything else worth tracking against a cow or the herd.",
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
        // health / note: one entry per cow so per-animal history filters
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
        <Field label="Cow">
          <select style={inputStyle} value={animalId} onChange={e=>setAnimalId(e.target.value)}>
            {live.length === 0 && <option value="">— No live cattle —</option>}
            {live.map(a => <option key={a.id} value={a.id}>{a.name}{a.sex?` · ${a.sex}`:""}</option>)}
          </select>
        </Field>
      ) : (
        <Field label={`Who? (${targetIds.length} ${targetIds.length===1?"animal":"animals"})`}>
          {selectionButtonsC({ live, pastures, mode, setMode })}
          {mode === "custom" && multiToggleRowC({ live, pastures, selectedIds: customIds, setSelectedIds: setCustomIds })}
        </Field>
      )}
      {action === "weight" && (()=>{
        const isMetricW = getCurrentWeightUnit()==="kg";
        const shown = weight===""||weight==null ? "" : (isMetricW ? String(Math.round(weightFromLbs(Number(weight))*100)/100) : weight);
        return (
          <Field label={isMetricW?"Weight (kg)":"Weight (lbs)"}>
            <input type="number" min={0} step="1" style={inputStyle} value={shown}
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

// --- 🍼 CalfCowModal --------------------------------------------------------
//
// Light calf-born entry that mirrors the old per-card `calf` action shape
// so CowsAnalytics.totalCalves keeps working. Critically, when the user
// fills in a calf name, this ALSO creates a new tracked animal with
// damId pointing at the cow — same behavior as the old LogModal.
// For full breed-through-calving lifecycle records use the 💕 Breeding
// tile, which opens the existing rich BreedingModal.

function CalfCowModal({ hobby, hobbyId, update, onClose }) {
  const live = (hobby.animals||[]).filter(a=>!a.archived);
  // Calving picker = Cows (cows that have already calved at least once).
  // We include Heifers too because a heifer's first calving makes her
  // a cow, and the user often hasn't relabeled her yet.
  const dams = live.filter(a => a.sex === "Cow" || a.sex === "Heifer");
  const choosable = dams.length > 0 ? dams : live;

  const [date, setDate] = useState(todayStr());
  const [animalId, setAnimalId] = useState(choosable[0]?.id || "");
  const [count, setCount] = useState("");
  const [calfName, setCalfName] = useState("");
  const [calfSex, setCalfSex] = useState("Calf");
  const [calfTagId, setCalfTagId] = useState("");
  const [notes, setNotes] = useState("");

  const canSave = !!animalId && !!date && Number(count) > 0;

  const save = () => {
    if (!canSave) return;
    const dam = choosable.find(x => x.id === animalId);
    update(d => {
      d.entries = d.entries || {};
      d.entries[hobbyId] = d.entries[hobbyId] || [];
      d.entries[hobbyId].push({
        id: newId(), date, action: "calf",
        animalId, animalName: dam?.name || "",
        count: Number(count) || 1,
        notes: notes.trim(),
        created: Date.now(),
      });
      // Calf-as-tracked-animal: mirrors the old per-card LogModal behavior.
      // If a name is given, also create a fresh animal record so the user
      // can log milk/feed/health/etc. for the calf and the pedigree links
      // back to the dam.
      if (calfName.trim()) {
        const h = d.hobbies.find(x => x.id === hobbyId);
        const damLive = (h?.animals || []).find(x => x.id === animalId);
        if (h) {
          if (!Array.isArray(h.animals)) h.animals = [];
          h.animals.push({
            id: newId(),
            name: calfName.trim(),
            breed: damLive?.breed || "",
            purpose: damLive?.purpose || "Beef",
            sex: calfSex || "Calf",
            dob: date,
            tagId: calfTagId.trim(),
            notes: "",
            sireId: null,
            sire: "",
            damId: animalId,
            dam: damLive?.name || "",
            registryNumber: "",
            registryName: "",
            created: Date.now(),
            archived: false,
          });
        }
      }
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="🍼 Log calf born">
      <div style={{fontSize:12,color:palette.inkSoft,marginBottom:12,lineHeight:1.5}}>
        Quick log of a birth. Adding a calf name below ALSO creates that calf as a tracked animal (with dam set to the cow you pick) so you can log milk/feed/health for it later.
        For the full breed-through-calving record (sire, method, dates, alive at weaning) use the 💕 Breeding tile.
      </div>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)}/>
      </Field>
      <Field label="Dam">
        <select style={inputStyle} value={animalId} onChange={e=>setAnimalId(e.target.value)} autoFocus>
          {choosable.length === 0 && <option value="">— No cows available —</option>}
          {choosable.map(a => <option key={a.id} value={a.id}>{a.name}{a.sex?` · ${a.sex}`:""}</option>)}
        </select>
      </Field>
      <Field label="Calves born">
        <input type="number" min={1} style={inputStyle} value={count}
          onChange={e=>setCount(e.target.value)} placeholder="1" inputMode="numeric"/>
      </Field>
      <Field label="Calf name (optional — also creates a tracked calf)">
        <input style={inputStyle} value={calfName} onChange={e=>setCalfName(e.target.value)} placeholder="e.g. Bluebell"/>
      </Field>
      {calfName.trim() && (
        <div style={{display:"flex",gap:12}}>
          <div style={{flex:1}}>
            <Field label="Sex">
              <select style={inputStyle} value={calfSex} onChange={e=>setCalfSex(e.target.value)}>
                {COW_SEXES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div style={{flex:1}}>
            <Field label="Tag # (optional)"><input style={inputStyle} value={calfTagId} onChange={e=>setCalfTagId(e.target.value)} placeholder="123"/></Field>
          </div>
        </div>
      )}
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!canSave}>Save</Btn>
      </div>
    </Modal>
  );
}

// --- 🔥 HeatCowModal --------------------------------------------------------

function HeatCowModal({ hobby, hobbyId, update, onClose }) {
  const live = (hobby.animals||[]).filter(a=>!a.archived);
  const dams = live.filter(a => a.sex === "Cow" || a.sex === "Heifer");
  const choosable = dams.length > 0 ? dams : live;

  const [date, setDate] = useState(todayStr());
  const [animalId, setAnimalId] = useState(choosable[0]?.id || "");
  const [heatIntensity, setHeatIntensity] = useState("standing");
  const [notes, setNotes] = useState("");

  const nextHeatExpected = date ? addDays(date, 21) : "";
  const canSave = !!animalId && !!date;

  const save = () => {
    if (!canSave) return;
    const a = choosable.find(x => x.id === animalId);
    update(d => {
      d.entries = d.entries || {};
      d.entries[hobbyId] = d.entries[hobbyId] || [];
      const entry = {
        id: newId(), date, action: "heat",
        animalId, animalName: a?.name || "",
        heatIntensity,
        nextHeatExpected,
        notes: notes.trim(),
        created: Date.now(),
      };
      d.entries[hobbyId].push(entry);
      if (nextHeatExpected) {
        d.calendarEvents = d.calendarEvents || [];
        d.calendarEvents.push({
          id: newId(),
          date: nextHeatExpected,
          title: `🔥 Next heat expected — ${a?.name || "cow"}`,
          kind: "cow_heat_expected",
          relatedId: entry.id,
          animalId,
        });
      }
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="🔥 Log heat">
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)}/>
      </Field>
      <Field label="Cow / heifer">
        <select style={inputStyle} value={animalId} onChange={e=>setAnimalId(e.target.value)} autoFocus>
          {choosable.length === 0 && <option value="">— No breeding-capable cattle —</option>}
          {choosable.map(a => <option key={a.id} value={a.id}>{a.name}{a.sex?` · ${a.sex}`:""}</option>)}
        </select>
      </Field>
      <Field label="Intensity">
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[
            {v:"standing", l:"💯 Standing heat", sub:"clearest sign"},
            {v:"mounting", l:"⬆️ Mounting", sub:"others or being mounted"},
            {v:"quiet", l:"🤫 Quiet", sub:"suspected, weak signs"},
            {v:"bloody", l:"🩸 Bloody", sub:"post-heat spotting"},
          ].map(o => (
            <button key={o.v} type="button" onClick={()=>setHeatIntensity(o.v)} style={{
              flex:"1 1 calc(50% - 3px)", padding:"10px 12px", borderRadius:8,
              border:`1.5px solid ${heatIntensity===o.v?palette.ink:palette.line}`,
              background:heatIntensity===o.v?palette.ink:palette.card,
              color:heatIntensity===o.v?palette.bg:palette.ink,
              fontFamily:FONT_BODY, fontWeight:600, fontSize:12, cursor:"pointer",
              textAlign:"left",
            }}>
              <div>{o.l}</div>
              <div style={{fontSize:10,opacity:0.7,marginTop:2,fontWeight:400}}>{o.sub}</div>
            </button>
          ))}
        </div>
      </Field>
      {nextHeatExpected && (
        <div style={{padding:"10px 14px",background:palette.yolkSoft,borderRadius:8,fontSize:13,color:palette.ink,marginBottom:14}}>
          📅 Next heat expected: <strong>{fmtDate(nextHeatExpected)}</strong> (~21 days)
          <div style={{fontSize:11,color:palette.inkSoft,marginTop:4}}>A reminder will be added to your calendar after saving.</div>
        </div>
      )}
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!canSave}>Save</Btn>
      </div>
    </Modal>
  );
}

// --- 💉 AICowModal (artificial insemination / breeding) --------------------

function AICowModal({ hobby, hobbyId, update, onClose }) {
  const live = (hobby.animals||[]).filter(a=>!a.archived);
  const dams = live.filter(a => a.sex === "Cow" || a.sex === "Heifer");
  const choosableDams = dams.length > 0 ? dams : live;
  const sires = live.filter(a => a.sex === "Bull");
  const noInternalSires = sires.length === 0;

  const [date, setDate] = useState(todayStr());
  const [animalId, setAnimalId] = useState(choosableDams[0]?.id || "");
  const [aiMethod, setAiMethod] = useState("AI (cervical)");
  const [aiUseExternal, setAiUseExternal] = useState(noInternalSires);
  const [aiSireId, setAiSireId] = useState("");
  const [aiSireName, setAiSireName] = useState("");
  const [aiTechnician, setAiTechnician] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");

  const pregCheckDue = date ? addDays(date, 30) : "";
  const canSave = !!animalId && !!date && (aiUseExternal ? aiSireName.trim().length > 0 : true);

  const save = () => {
    if (!canSave) return;
    const a = choosableDams.find(x => x.id === animalId);
    const sireAnimal = sires.find(s => s.id === aiSireId);
    update(d => {
      d.entries = d.entries || {};
      d.entries[hobbyId] = d.entries[hobbyId] || [];
      const entry = {
        id: newId(), date, action: "ai",
        animalId, animalName: a?.name || "",
        aiMethod,
        aiSireId: aiUseExternal ? null : (aiSireId || null),
        aiSireName: aiUseExternal ? aiSireName.trim() : (sireAnimal?.name || ""),
        aiTechnician: aiTechnician.trim(),
        cost: Number(cost) || 0,
        pregCheckDue,
        notes: notes.trim(),
        created: Date.now(),
      };
      d.entries[hobbyId].push(entry);
      if (pregCheckDue) {
        d.calendarEvents = d.calendarEvents || [];
        d.calendarEvents.push({
          id: newId(),
          date: pregCheckDue,
          title: `🤰 Preg check due — ${a?.name || "cow"}`,
          kind: "cow_preg_check_due",
          relatedId: entry.id,
          animalId,
        });
      }
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="💉 Log breeding (AI)">
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)}/>
      </Field>
      <Field label="Cow / heifer">
        <select style={inputStyle} value={animalId} onChange={e=>setAnimalId(e.target.value)} autoFocus>
          {choosableDams.length === 0 && <option value="">— No breeding-capable cattle —</option>}
          {choosableDams.map(a => <option key={a.id} value={a.id}>{a.name}{a.sex?` · ${a.sex}`:""}</option>)}
        </select>
      </Field>
      <Field label="Method">
        <select style={inputStyle} value={aiMethod} onChange={e=>setAiMethod(e.target.value)}>
          <option>AI (cervical)</option>
          <option>AI (deep horn)</option>
          <option>Embryo transfer</option>
          <option>Pasture mating</option>
          <option>Hand mating</option>
        </select>
      </Field>
      {!noInternalSires && (
        <Field label="Sire source">
          <div style={{display:"flex",gap:6}}>
            <button type="button" onClick={()=>setAiUseExternal(false)} style={{
              flex:1, padding:"8px 10px", borderRadius:8,
              border:`1.5px solid ${!aiUseExternal?palette.ink:palette.line}`,
              background:!aiUseExternal?palette.ink:palette.card,
              color:!aiUseExternal?palette.bg:palette.ink,
              fontFamily:FONT_BODY, fontWeight:600, fontSize:13, cursor:"pointer",
            }}>🐂 Your bull</button>
            <button type="button" onClick={()=>setAiUseExternal(true)} style={{
              flex:1, padding:"8px 10px", borderRadius:8,
              border:`1.5px solid ${aiUseExternal?palette.ink:palette.line}`,
              background:aiUseExternal?palette.ink:palette.card,
              color:aiUseExternal?palette.bg:palette.ink,
              fontFamily:FONT_BODY, fontWeight:600, fontSize:13, cursor:"pointer",
            }}>📦 Outside semen</button>
          </div>
        </Field>
      )}
      {(noInternalSires || aiUseExternal) ? (
        <Field label="Sire (name / code)">
          <input style={inputStyle} value={aiSireName} onChange={e=>setAiSireName(e.target.value)} placeholder="e.g. Select Sires #14HO12345" />
        </Field>
      ) : (
        <Field label="Sire">
          <select style={inputStyle} value={aiSireId} onChange={e=>setAiSireId(e.target.value)}>
            <option value="">— Select a bull —</option>
            {sires.map(s => <option key={s.id} value={s.id}>{s.name}{s.breed?` · ${s.breed}`:""}</option>)}
          </select>
        </Field>
      )}
      <div style={{display:"flex",gap:12}}>
        <div style={{flex:1}}>
          <Field label="Cost (optional)">
            <input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$0.00"/>
          </Field>
        </div>
        <div style={{flex:1}}>
          <Field label="Technician (optional)">
            <input style={inputStyle} value={aiTechnician} onChange={e=>setAiTechnician(e.target.value)} placeholder="Name or service"/>
          </Field>
        </div>
      </div>
      {pregCheckDue && (
        <div style={{padding:"10px 14px",background:palette.yolkSoft,borderRadius:8,fontSize:13,color:palette.ink,marginBottom:14}}>
          📅 Preg check due: <strong>{fmtDate(pregCheckDue)}</strong> (~30 days from breeding)
          <div style={{fontSize:11,color:palette.inkSoft,marginTop:4}}>A reminder will be added to your calendar after saving.</div>
        </div>
      )}
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!canSave}>Save</Btn>
      </div>
    </Modal>
  );
}

// --- 🤰 PregTestCowModal ---------------------------------------------------

function PregTestCowModal({ hobby, hobbyId, update, onClose }) {
  const live = (hobby.animals||[]).filter(a=>!a.archived);
  const dams = live.filter(a => a.sex === "Cow" || a.sex === "Heifer");
  const choosable = dams.length > 0 ? dams : live;

  const [date, setDate] = useState(todayStr());
  const [animalId, setAnimalId] = useState(choosable[0]?.id || "");
  const [pregResult, setPregResult] = useState("pregnant");
  const [pregMethod, setPregMethod] = useState("palpation");
  const [pregExpectedCalving, setPregExpectedCalving] = useState("");
  const [notes, setNotes] = useState("");

  const defaultCalving = date ? addDays(date, COW_GESTATION_DAYS) : "";
  const canSave = !!animalId && !!date;

  const save = () => {
    if (!canSave) return;
    const a = choosable.find(x => x.id === animalId);
    update(d => {
      d.entries = d.entries || {};
      d.entries[hobbyId] = d.entries[hobbyId] || [];
      const entry = {
        id: newId(), date, action: "preg_test",
        animalId, animalName: a?.name || "",
        pregResult,
        pregMethod,
        notes: notes.trim(),
        created: Date.now(),
      };
      if (pregResult === "pregnant") {
        entry.expectedCalving = pregExpectedCalving || defaultCalving;
      }
      d.entries[hobbyId].push(entry);
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="🤰 Pregnancy check">
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)}/>
      </Field>
      <Field label="Cow / heifer">
        <select style={inputStyle} value={animalId} onChange={e=>setAnimalId(e.target.value)} autoFocus>
          {choosable.length === 0 && <option value="">— No breeding-capable cattle —</option>}
          {choosable.map(a => <option key={a.id} value={a.id}>{a.name}{a.sex?` · ${a.sex}`:""}</option>)}
        </select>
      </Field>
      <Field label="Result">
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[{v:"pregnant",l:"🤰 Pregnant"},{v:"open",l:"❌ Open"},{v:"inconclusive",l:"❓ Inconclusive"}].map(o=>(
            <button key={o.v} type="button" onClick={()=>setPregResult(o.v)} style={{
              flex:"1 1 auto", padding:"8px 12px", borderRadius:8,
              border:`1.5px solid ${pregResult===o.v?palette.ink:palette.line}`,
              background:pregResult===o.v?palette.ink:palette.card,
              color:pregResult===o.v?palette.bg:palette.ink,
              fontFamily:FONT_BODY, fontWeight:600, fontSize:13, cursor:"pointer",
            }}>{o.l}</button>
          ))}
        </div>
      </Field>
      <Field label="Method">
        <select style={inputStyle} value={pregMethod} onChange={e=>setPregMethod(e.target.value)}>
          <option value="palpation">Rectal palpation</option>
          <option value="ultrasound">Ultrasound</option>
          <option value="blood">Blood test (BioPRYN/PAG)</option>
          <option value="milk">Milk test</option>
          <option value="visual">Visual / behavioral</option>
          <option value="other">Other</option>
        </select>
      </Field>
      {pregResult === "pregnant" && (
        <Field label="Expected calving date (optional)">
          <input type="date" style={inputStyle} value={pregExpectedCalving} onChange={e=>setPregExpectedCalving(e.target.value)} placeholder={defaultCalving} />
          <div style={{fontSize:11,color:palette.inkSoft,marginTop:4}}>
            Leave blank to auto-set to {defaultCalving} (test date + 283 days, typical bovine gestation).
          </div>
        </Field>
      )}
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!canSave}>Save</Btn>
      </div>
    </Modal>
  );
}

// --- ❄️ RemoveCowModal -----------------------------------------------------

function RemoveCowModal({ hobby, hobbyId, update, onClose }) {
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
          id: entry.id, date, hobbyType: "cow", crop: animal.name, saleType,
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
    <Modal open onClose={onClose} title="❄️ Remove cow">
      <Field label="Which cow?">
        <select style={inputStyle} value={animalId} onChange={e=>setAnimalId(e.target.value)} autoFocus>
          {live.length === 0 && <option value="">— No live cattle —</option>}
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
              <input type="number" min={0} step="1" style={inputStyle} value={shownW}
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
            {["Unknown","Disease","Predator","Heat stress","Cold","Injury","Calving complications","Bloat","Parasites","Old age","Other"].map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
      )}

      {reason === "culled" && (
        <Field label="Reason (optional)"><input style={inputStyle} value={cullReason} onChange={e=>setCullReason(e.target.value)} placeholder="e.g. temperament, low production, open after multiple breedings"/></Field>
      )}

      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>

      <div style={{fontSize:12,color:palette.inkSoft,marginBottom:10,padding:"8px 10px",background:palette.bgAlt,borderRadius:6,lineHeight:1.5}}>
        {(()=>{const a = live.find(x=>x.id===animalId); return a?.name || "This cow";})()} will move to your Archived cattle list{(reason==="sold")?" and a sale record will appear in your Sales tab":""}. You can restore from there if this was a mistake.
      </div>

      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant={reason==="died"||reason==="culled"?"danger":"primary"} onClick={save} disabled={!canSave}>Save &amp; archive</Btn>
      </div>
    </Modal>
  );
}

// ============================================================================
// /COWS_UNIFY_V1
// ============================================================================

function LogModal({animal,hobbyId,action,animals=[],hobby,update,onClose,customers=[]}){
  const[date,setDate]=useState(todayStr());
  const[gallons,setGallons]=useState("");
  const[lbs,setLbs]=useState("");
  const[cost,setCost]=useState("");
  const[herdWide,setHerdWide]=useState(false); // FEAT6-FED
  const[count,setCount]=useState("");
  const[weight,setWeight]=useState("");
  const[notes,setNotes]=useState("");
  // Death-only: optional cause. Stored on the entry AND folded into archivedReason
  // so the existing "Archived cattle" section reads "Died: predator" etc.
  const[cause,setCause]=useState("");
  // Heat-only: intensity describes how strong the signs were. We also use it
  // to grade missed-vs-caught heats over time (a "quiet" heat is easy to
  // miss; tracking these helps identify cows with subtle estrus).
  const[heatIntensity,setHeatIntensity]=useState("standing");
  // AI-only: who the sire is, the method used, optional cost + technician.
  // Sire is either a Bull picked from your existing animals (`aiSireId`)
  // OR free-text for outside semen with a code like "Select Sires #14HO12345"
  // (`aiSireName`). Toggle which mode via aiUseExternal.
  const[aiSireId,setAiSireId]=useState("");
  const[aiSireName,setAiSireName]=useState("");
  const[aiUseExternal,setAiUseExternal]=useState(false);
  const[aiMethod,setAiMethod]=useState("AI (cervical)");
  const[aiTechnician,setAiTechnician]=useState("");
  // Sale-only: buyer name, sale price, sold-vs-rehomed. On save these archive
  // the animal AND create a `data.sales[]` entry shaped like the existing
  // horse-sale shape so it shows up in the Sales tab.
  const[saleBuyer,setSaleBuyer]=useState("");
  const[buyerId,setBuyerId]=useState("");
  const[showNewBuyer,setShowNewBuyer]=useState(false);
  const[salePrice,setSalePrice]=useState("");
  const[saleType,setSaleType]=useState("sold");
  // Calf-only: when the user logs a calf-born entry, they can optionally
  // name the calf and give it a sex/tag. If a name is provided, we create
  // a new animal with sex="Calf" (so existing filters keep working), the
  // birth date as dob, and damId pointing at the current cow. The animal
  // becomes fully trackable — milk/feed/health/sale/death buttons and a
  // pedigree row to its mother all work automatically. If no name, the
  // entry stays a simple counter like before.
  const[calfName,setCalfName]=useState("");
  const[calfSex,setCalfSex]=useState("Calf");
  const[calfTagId,setCalfTagId]=useState("");
  // Preg-check: result (pregnant / open / inconclusive), how it was determined
  // (palpation, ultrasound, blood test), and expected calving date if positive.
  // Default calving date = test date + 283 days (typical bovine gestation).
  const[pregResult,setPregResult]=useState("pregnant");
  const[pregMethod,setPregMethod]=useState("palpation");
  const[pregExpectedCalving,setPregExpectedCalving]=useState("");
  const save=()=>{
    const entry={id:newId(),date,action,animalId:animal.id,animalName:animal.name,notes,created:Date.now()};
    if(action==="milk")entry.gallons=Number(gallons)||0;
    if(action==="fed"){entry.lbs=Number(lbs)||0;entry.cost=Number(cost)||0;}
    // FEAT6-FED: a herd-wide feeding is not tied to one animal.
    if(action==="fed"&&herdWide){entry.animalId=null;entry.animalName="";entry.herdWide=true;}
    if(action==="calf")entry.count=Number(count)||1;
    if(action==="weight"||action==="butcher")entry.weight=Number(weight)||0;
    if(action==="butcher")entry.cost=Number(cost)||0;
    if(action==="death")entry.cause=cause.trim();
    if(action==="sale"){entry.buyer=saleBuyer.trim();entry.price=Number(salePrice)||0;entry.saleType=saleType;}
    if(action==="preg_test"){
      entry.pregResult=pregResult;
      entry.pregMethod=pregMethod;
      if(pregResult==="pregnant"){
        // Auto-fill expected calving (test date + 283 days) when the user
        // didn't pick one. Stored as a regular date string so it shows up
        // in chronological history naturally.
        entry.expectedCalving = pregExpectedCalving || (() => {
          const t = new Date(date + "T12:00");
          t.setDate(t.getDate() + 283);
          return t.toISOString().slice(0, 10);
        })();
      }
    }
    if(action==="heat"){
      // Heat intensity describes how visible the signs were. Used downstream
      // for grading missed-vs-caught heats over time.
      entry.heatIntensity = heatIntensity;
      // Compute expected next heat (~21 days). Stored on the entry so the
      // animal-history view and stats can reason about cycle regularity
      // without re-calculating each time.
      entry.nextHeatExpected = addDays(date, 21);
    }
    if(action==="ai"){
      // Sire reference: either an internal Bull (aiSireId) or external
      // semen identified by name. We persist whichever the user chose.
      entry.aiMethod = aiMethod;
      if(aiUseExternal){
        entry.aiSireId = null;
        entry.aiSireName = aiSireName.trim();
      } else {
        entry.aiSireId = aiSireId || null;
        // Snapshot the sire name at log time so it stays readable even if
        // the bull is later archived/renamed.
        const sireAnimal = animals.find(a => a.id === aiSireId);
        entry.aiSireName = sireAnimal?.name || "";
      }
      entry.aiTechnician = aiTechnician.trim();
      // Cost shares the `cost` state used by feed/butcher — repurposed
      // since each action only renders one cost field at a time.
      entry.cost = Number(cost) || 0;
      // Expected preg check ~30 days after AI. Most ranchers do palpation
      // at 35-45d, ultrasound at 28-35d, blood at 28d+. 30 hits the sweet
      // spot of "earliest reliable test for most methods".
      entry.pregCheckDue = addDays(date, 30);
    }
    update(d=>{
      d.entries[hobbyId]=d.entries[hobbyId]||[];
      d.entries[hobbyId].push(entry);
      // Calf-born with a name → also create a tracked animal so the calf
      // can be milked/weighed/etc. just like the dam. The dam's breed is
      // inherited as a default (most herds are single-breed). The calf is
      // linked to the dam via damId, so the pedigree view shows the lineage.
      if(action==="calf" && calfName.trim()){
        const h=d.hobbies.find(x=>x.id===hobbyId);
        const dam=(h?.animals||[]).find(x=>x.id===animal.id);
        if(h){
          if(!Array.isArray(h.animals))h.animals=[];
          h.animals.push({
            id:newId(),
            name:calfName.trim(),
            breed:dam?.breed||"",
            purpose:dam?.purpose||"Beef",
            sex:calfSex||"Calf",
            dob:date,
            tagId:calfTagId.trim(),
            notes:"",
            sireId:dam?.sireId?null:null, // calf's sire is the dam's mate — unknown unless user sets it later
            sire:"",
            damId:animal.id,
            dam:animal.name,
            registryNumber:"",
            registryName:"",
            created:Date.now(),
            archived:false,
          });
        }
      }
      // Death also archives the animal so it drops out of the active list and
      // shows up under "Archived cattle". Mirrors Sheep/Dogs behavior.
      if(action==="death"){
        const h=d.hobbies.find(x=>x.id===hobbyId);
        const a=(h?.animals||[]).find(x=>x.id===animal.id);
        if(a&&!a.archived){
          a.archived=true;
          a.archivedReason=cause.trim()?`Died: ${cause.trim()}`:"Died";
          a.archivedDate=date;
        }
      }
      // Sale also archives the animal and creates a Sales entry so the
      // transaction shows up under the Sales tab alongside other sales.
      if(action==="sale"){
        const h=d.hobbies.find(x=>x.id===hobbyId);
        const a=(h?.animals||[]).find(x=>x.id===animal.id);
        if(a&&!a.archived){
          a.archived=true;
          const verb=saleType==="leased"?"Leased":"Sold";
          const priceStr=Number(salePrice)>0?` for $${Number(salePrice).toFixed(2)}`:"";
          const buyerStr=saleBuyer.trim()?` to ${saleBuyer.trim()}`:"";
          a.archivedReason=`${verb}${buyerStr}${priceStr}`;
          a.archivedDate=date;
          a.saleId=entry.id;
        }
        // Create the Sales row. Uses hobbyType "horse" shape (same data model
        // as existing horse sales) so it displays in the Sales tab.
        d.sales=d.sales||[];
        const _saleRow={
          id:entry.id,
          date,
          hobbyType:"cow",
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
      // Heat-cycle calendar event: next expected heat ~21 days out, so the
      // user gets a reminder to watch for signs again. Linked to the entry
      // via relatedId so editing/deleting the heat entry could clean it
      // up later.
      if(action==="heat"){
        d.calendarEvents = d.calendarEvents || [];
        d.calendarEvents.push({
          id: newId(),
          date: entry.nextHeatExpected,
          title: `🔥 Next heat expected — ${animal.name}`,
          kind: "cow_heat_expected",
          relatedId: entry.id,
          animalId: animal.id,
        });
      }
      // AI calendar event: preg check due ~30 days out.
      if(action==="ai"){
        d.calendarEvents = d.calendarEvents || [];
        d.calendarEvents.push({
          id: newId(),
          date: entry.pregCheckDue,
          title: `🤰 Preg check due — ${animal.name}`,
          kind: "cow_preg_check_due",
          relatedId: entry.id,
          animalId: animal.id,
        });
      }
      return d;
    });
    onClose();
  };
  const titles={milk:"Log milk",fed:"Log feed",calf:"Log calf born",weight:"Log weight",health:"Health check",butcher:"Log butcher",death:"Log death",sale:"Log sale",note:"Add note",preg_test:"Pregnancy check",heat:"Log heat",ai:"Log breeding (AI)"};
  const isDeath=action==="death";
  const isSale=action==="sale";
  return(
    <Modal open onClose={onClose} title={`${titles[action]||"Log"} — ${animal.name}`}>
      <Field label="Date"><input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)}/></Field>
      {action==="milk"&&(()=>{
        // Milk volume input. Canonical storage is gallons. In L-mode the
        // field shows/accepts liters and converts at the boundary.
        const isMetricV=getCurrentVolumeUnit()==="L";
        const shown=gallons===""||gallons==null?"":(isMetricV?String(Math.round(volumeFromGal(Number(gallons))*100)/100):gallons);
        return <Field label={isMetricV?"Milk (liters)":"Milk (gallons)"}><input type="number" min={0} step="0.1" style={inputStyle} value={shown} onChange={e=>{const r=e.target.value;setGallons(r===""?"":(isMetricV?String(galFromInput(r)):r));}} placeholder="0" autoFocus/></Field>;
      })()}
      {action==="fed"&&(()=>{
        // Feed weight input. Canonical storage is pounds. In kg-mode the
        // field shows/accepts kg and converts at the boundary.
        const isMetricW=getCurrentWeightUnit()==="kg";
        const shownLbs=lbs===""||lbs==null?"":(isMetricW?String(Math.round(weightFromLbs(Number(lbs))*100)/100):lbs);
        return <div style={{display:"flex",gap:12}}><div style={{flex:1}}><Field label={isMetricW?"Feed (kg)":"Feed (lbs)"}><input type="number" min={0} step="0.1" style={inputStyle} value={shownLbs} onChange={e=>{const r=e.target.value;setLbs(r===""?"":(isMetricW?String(lbsFromInput(r)):r));}} placeholder="0"/></Field></div><div style={{flex:1}}><Field label="Cost ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$0.00"/></Field></div></div>;
      })()}
          {/* FEAT6-FED: log this feeding for the whole herd instead of just
              this animal. A herd-wide feeding isn't pinned to one animal —
              it still counts in total feed cost/amount analytics. */}
          <Field label="Who is this for?">
            <div style={{display:"flex",gap:8}}>
              <button type="button" onClick={()=>setHerdWide(false)} style={{flex:1,padding:"8px 10px",borderRadius:8,border:`1.5px solid ${!herdWide?palette.ink:palette.line}`,background:!herdWide?palette.ink:palette.card,color:!herdWide?palette.bg:palette.ink,fontFamily:FONT_BODY,fontSize:12.5,fontWeight:600,cursor:"pointer"}}>Just {animal.name}</button>
              <button type="button" onClick={()=>setHerdWide(true)} style={{flex:1,padding:"8px 10px",borderRadius:8,border:`1.5px solid ${herdWide?palette.ink:palette.line}`,background:herdWide?palette.ink:palette.card,color:herdWide?palette.bg:palette.ink,fontFamily:FONT_BODY,fontSize:12.5,fontWeight:600,cursor:"pointer"}}>Whole herd</button>
            </div>
            {herdWide && (
              <div style={{fontSize:11,color:palette.inkSoft,marginTop:6,lineHeight:1.4}}>
                Recorded once for the whole herd — not attributed to {animal.name}. It still counts toward total feed cost and amount.
              </div>
            )}
          </Field>
      {action==="calf"&&<>
        <Field label="Calves born"><input type="number" min={1} style={inputStyle} value={count} onChange={e=>setCount(e.target.value)} placeholder="1" autoFocus/></Field>
        <div style={{fontSize:11,color:palette.inkSoft,marginBottom:8,padding:"8px 10px",background:palette.bgAlt,borderRadius:6,lineHeight:1.5}}>
          Optional: name the calf below to track it as its own animal. You'll be able to log milk, feed, health, and more for it, and the pedigree will link it back to {animal.name}. Leave blank to just record the birth count.
        </div>
        <Field label="Calf name (optional)"><input style={inputStyle} value={calfName} onChange={e=>setCalfName(e.target.value)} placeholder="e.g. Bluebell"/></Field>
        {calfName.trim() && (
          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}>
              <Field label="Sex (optional)">
                <select style={inputStyle} value={calfSex} onChange={e=>setCalfSex(e.target.value)}>
                  {COW_SEXES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div style={{flex:1}}>
              <Field label="Tag # (optional)"><input style={inputStyle} value={calfTagId} onChange={e=>setCalfTagId(e.target.value)} placeholder="123"/></Field>
            </div>
          </div>
        )}
      </>}
      {(action==="weight"||action==="butcher")&&(()=>{
        const isMetricW=getCurrentWeightUnit()==="kg";
        const shownW=weight===""||weight==null?"":(isMetricW?String(Math.round(weightFromLbs(Number(weight))*100)/100):weight);
        return <Field label={isMetricW?"Weight (kg)":"Weight (lbs)"}><input type="number" min={0} step="1" style={inputStyle} value={shownW} onChange={e=>{const r=e.target.value;setWeight(r===""?"":(isMetricW?String(lbsFromInput(r)):r));}} placeholder="0" autoFocus/></Field>;
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
      {action==="preg_test"&&<>
        <Field label="Result">
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[{v:"pregnant",l:"🤰 Pregnant",c:palette.leaf},{v:"open",l:"❌ Open",c:palette.accent},{v:"inconclusive",l:"❓ Inconclusive",c:palette.feather}].map(o=>(
              <button key={o.v} onClick={()=>setPregResult(o.v)} style={{
                flex:"1 1 auto", padding:"8px 12px", borderRadius:8,
                border:`1.5px solid ${pregResult===o.v?palette.ink:palette.line}`,
                background:pregResult===o.v?palette.ink:palette.card,
                color:pregResult===o.v?palette.bg:palette.ink,
                fontFamily:FONT_BODY, fontWeight:600, fontSize:13, cursor:"pointer",
              }}>{o.l}</button>
            ))}
          </div>
        </Field>
        <Field label="Method">
          <select style={inputStyle} value={pregMethod} onChange={e=>setPregMethod(e.target.value)}>
            <option value="palpation">Rectal palpation</option>
            <option value="ultrasound">Ultrasound</option>
            <option value="blood">Blood test (BioPRYN/PAG)</option>
            <option value="milk">Milk test</option>
            <option value="visual">Visual / behavioral</option>
            <option value="other">Other</option>
          </select>
        </Field>
        {pregResult==="pregnant"&&(() => {
          // Compute the default expected calving date (test date + 283 days)
          // for the placeholder so the user sees what we'd save if they
          // leave it blank.
          let defaultCalving = "";
          try {
            const t = new Date(date + "T12:00");
            t.setDate(t.getDate() + 283);
            defaultCalving = t.toISOString().slice(0, 10);
          } catch (e) {}
          return (
            <Field label="Expected calving date (optional)">
              <input type="date" style={inputStyle} value={pregExpectedCalving} onChange={e=>setPregExpectedCalving(e.target.value)} placeholder={defaultCalving} />
              <div style={{fontSize:11,color:palette.inkSoft,marginTop:4}}>
                Leave blank to auto-set to {defaultCalving} (test date + 283 days, typical bovine gestation).
              </div>
            </Field>
          );
        })()}
      </>}
      {action==="heat"&&<>
        <Field label="Intensity">
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[
              {v:"standing", l:"💯 Standing heat", sub:"clearest sign"},
              {v:"mounting", l:"⬆️ Mounting", sub:"others or being mounted"},
              {v:"quiet", l:"🤫 Quiet", sub:"suspected, weak signs"},
              {v:"bloody", l:"🩸 Bloody", sub:"post-heat spotting"},
            ].map(o => (
              <button key={o.v} onClick={()=>setHeatIntensity(o.v)} style={{
                flex:"1 1 calc(50% - 3px)", padding:"10px 12px", borderRadius:8,
                border:`1.5px solid ${heatIntensity===o.v?palette.ink:palette.line}`,
                background:heatIntensity===o.v?palette.ink:palette.card,
                color:heatIntensity===o.v?palette.bg:palette.ink,
                fontFamily:FONT_BODY, fontWeight:600, fontSize:12, cursor:"pointer",
                textAlign:"left",
              }}>
                <div>{o.l}</div>
                <div style={{fontSize:10,opacity:0.7,marginTop:2,fontWeight:400}}>{o.sub}</div>
              </button>
            ))}
          </div>
        </Field>
        <div style={{fontSize:11,color:palette.inkSoft,marginBottom:8,padding:"8px 10px",background:palette.bgAlt,borderRadius:6,lineHeight:1.5}}>
          📅 We'll add "Next heat expected" to your calendar for {addDays(date, 21)} (~21 days from today). Useful for catching the next breeding window.
        </div>
      </>}
      {action==="ai"&&(() => {
        // Sire picker — surface only Bulls in this hobby. If user doesn't
        // have any tracked Bulls, default to external mode so the form is
        // immediately usable.
        const sires = animals.filter(a => !a.archived && a.sex === "Bull");
        const noInternalSires = sires.length === 0;
        return (
          <>
            <Field label="Method">
              <select style={inputStyle} value={aiMethod} onChange={e=>setAiMethod(e.target.value)}>
                <option>AI (cervical)</option>
                <option>AI (deep horn)</option>
                <option>Embryo transfer</option>
                <option>Pasture mating</option>
                <option>Hand mating</option>
              </select>
            </Field>
            {!noInternalSires && (
              <Field label="Sire source">
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>setAiUseExternal(false)} style={{
                    flex:1, padding:"8px 10px", borderRadius:8,
                    border:`1.5px solid ${!aiUseExternal?palette.ink:palette.line}`,
                    background:!aiUseExternal?palette.ink:palette.card,
                    color:!aiUseExternal?palette.bg:palette.ink,
                    fontFamily:FONT_BODY, fontWeight:600, fontSize:13, cursor:"pointer",
                  }}>🐂 Your bull</button>
                  <button onClick={()=>setAiUseExternal(true)} style={{
                    flex:1, padding:"8px 10px", borderRadius:8,
                    border:`1.5px solid ${aiUseExternal?palette.ink:palette.line}`,
                    background:aiUseExternal?palette.ink:palette.card,
                    color:aiUseExternal?palette.bg:palette.ink,
                    fontFamily:FONT_BODY, fontWeight:600, fontSize:13, cursor:"pointer",
                  }}>📦 Outside semen</button>
                </div>
              </Field>
            )}
            {(noInternalSires || aiUseExternal) ? (
              <Field label="Sire (name / code)">
                <input style={inputStyle} value={aiSireName} onChange={e=>setAiSireName(e.target.value)} placeholder="e.g. Select Sires #14HO12345" />
              </Field>
            ) : (
              <Field label="Sire">
                <select style={inputStyle} value={aiSireId} onChange={e=>setAiSireId(e.target.value)}>
                  <option value="">— Select a bull —</option>
                  {sires.map(s => <option key={s.id} value={s.id}>{s.name}{s.breed?` · ${s.breed}`:""}</option>)}
                </select>
              </Field>
            )}
            <div style={{display:"flex",gap:12}}>
              <div style={{flex:1}}>
                <Field label="Cost (optional)">
                  <input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$0.00"/>
                </Field>
              </div>
              <div style={{flex:1}}>
                <Field label="Technician (optional)">
                  <input style={inputStyle} value={aiTechnician} onChange={e=>setAiTechnician(e.target.value)} placeholder="Name or service"/>
                </Field>
              </div>
            </div>
            <div style={{fontSize:11,color:palette.inkSoft,marginBottom:8,padding:"8px 10px",background:palette.bgAlt,borderRadius:6,lineHeight:1.5}}>
              📅 We'll add "Preg check due" to your calendar for {addDays(date, 30)} (~30 days from breeding). Most checks are accurate by then.
            </div>
          </>
        );
      })()}
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      {isDeath&&<div style={{fontSize:12,color:palette.inkSoft,marginBottom:10,padding:"8px 10px",background:palette.bgAlt,borderRadius:6,lineHeight:1.5}}>{animal.name} will move to your Archived cattle list. You can restore from there if this was a mistake.</div>}
      {isSale&&<div style={{fontSize:12,color:palette.inkSoft,marginBottom:10,padding:"8px 10px",background:palette.bgAlt,borderRadius:6,lineHeight:1.5}}>{animal.name} will move to your Archived cattle list and {saleType!=="rehomed"?"a sale record will appear in your Sales tab":"be marked as rehomed"}. You can restore from there if this was a mistake.</div>}
      <Btn onClick={save} variant={isDeath?"danger":"primary"}>{(isDeath||isSale)?"Save & archive":"Save"}</Btn>
    </Modal>
  );
}

function AnimalCard({animal,hobbyId,animals,entries,sales,hobby,update,setModal,customers=[]}){
  /* COWS_UNIFY_V1 — logAction state removed (action buttons moved to top tile bar) */
  const[showPedigree,setShowPedigree]=useState(false);
  const[showHistory,setShowHistory]=useState(false);
  const animalEntries=entries.filter(e=>e.animalId===animal.id);
  const today=todayStr();
  const milkEntries=animalEntries.filter(e=>e.action==="milk");
  const totalMilkGal=milkEntries.reduce((s,e)=>s+(Number(e.gallons)||0),0);
  const todayMilk=milkEntries.filter(e=>e.date===today).reduce((s,e)=>s+(Number(e.gallons)||0),0);
  const purposeColor={Dairy:palette.leaf,Beef:palette.accent,Both:palette.feather};
  // COWS_UNIFY_V1 — per-card action arrays removed (tile bar drives logging).
  // canCarry kept for the pregnancy badge below.
  const canCarry = animal.sex === "Cow" || animal.sex === "Heifer";
  const actionLabels={milk:"🥛 Milk",fed:"🌾 Feed",calf:"🍼 Calf",weight:"⚖️ Weight",health:"💊 Health",butcher:"🔪 Butcher",death:"💀 Death",sale:"🏷️ Sale",note:"📓 Note",preg_test:"🤰 Preg check",heat:"🔥 Heat",ai:"💉 Breed"};
  const recentEntries=animalEntries.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
  return(
    <div style={{background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:10}}>
      {/* COWS_UNIFY_V1 — per-card LogModal mount removed; tile bar drives logging now */}
      {showPedigree && (
        <PedigreeView
          animal={animal}
          animals={animals||[]}
          onClose={()=>setShowPedigree(false)}
          onJumpTo={(id)=>{setShowPedigree(false);setTimeout(()=>setModal({type:"editAnimal",hobbyId,animalId:id}),0);}}
        />
      )}
      {showHistory && (
        <AnimalHistoryView
          update={update}
          animal={animal}
          hobby={hobby}
          entries={entries}
          sales={sales||[]}
          species="cow"
          onClose={()=>setShowHistory(false)}
        />
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <LivestockProfileCircle animal={animal} emoji="🐄" />
            <span style={{fontWeight:700,fontSize:15,color:palette.ink}}>{animal.name}</span>
            <span style={{fontSize:11,background:palette.bgAlt,padding:"2px 8px",borderRadius:4,color:palette.inkSoft}}>{animal.breed}</span>
            <span style={{fontSize:11,background:purposeColor[animal.purpose]+"25",padding:"2px 8px",borderRadius:4,color:purposeColor[animal.purpose],fontWeight:600}}>{animal.purpose}</span>
            {animal.tagId&&<span style={{fontSize:11,color:palette.inkSoft}}>#{animal.tagId}</span>}
            {(() => {
              // Latest preg-test for this animal — surface a badge in the
              // header so users can see "pregnant, due X" at a glance.
              // Only "pregnant" gets a badge (open/inconclusive doesn't
              // need to be advertised on the card; it's in the history).
              if (!canCarry) return null;
              const latestPreg = animalEntries
                .filter(e => e.action === "preg_test")
                .sort((a, b) => b.date.localeCompare(a.date))[0];
              if (!latestPreg || latestPreg.pregResult !== "pregnant") return null;
              return (
                <span style={{
                  fontSize: 11, background: palette.leafSoft + "60",
                  padding: "2px 8px", borderRadius: 4,
                  color: palette.leaf, fontWeight: 600,
                }}>
                  🤰 {latestPreg.expectedCalving ? `due ${fmtDate(latestPreg.expectedCalving)}` : "pregnant"}
                </span>
              );
            })()}
          </div>
          {animal.dob&&<div style={{fontSize:11,color:palette.inkSoft,marginTop:2,marginLeft:26}}>Born {fmtDate(animal.dob)} · {fmtAge(animal.dob)}</div>}
        </div>
        <button onClick={()=>setModal({type:"editAnimal",hobbyId,animalId:animal.id})} style={{background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,padding:4}}><Edit3 size={14}/></button>
      </div>
      {(animal.purpose==="Dairy"||animal.purpose==="Both")&&(
        <div style={{background:palette.bgAlt,borderRadius:8,padding:"8px 12px",marginBottom:10,display:"flex",gap:16,flexWrap:"wrap"}}>
          <div style={{fontSize:12,color:palette.ink}}><span style={{color:palette.inkSoft}}>Today: </span><strong>{todayMilk>0?fmtVolume(todayMilk):"—"}</strong></div>
          <div style={{fontSize:12,color:palette.ink}}><span style={{color:palette.inkSoft}}>All-time: </span><strong>{totalMilkGal>0?fmtVolume(totalMilkGal):"—"}</strong></div>
        </div>
      )}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:recentEntries.length>0?10:0}}>
        {/* COWS_UNIFY_V1 — per-card action buttons removed; log via top tile bar */}
        <button onClick={()=>setShowPedigree(true)} style={{padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.ink}}>🧬 Pedigree</button>
        <button onClick={()=>setShowHistory(true)} style={{padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.ink}}>📜 History</button>
        <button onClick={()=>setModal({type:"moveAnimal",hobbyId,animalId:animal.id})} style={{padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.ink}}>↔️ Move</button>
      </div>
      {recentEntries.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          {recentEntries.map(e=>{
            let detail="";
            if(e.action==="milk")detail=fmtVolume(Number(e.gallons)||0);
            else if(e.action==="fed")detail=`${fmtWeight(Number(e.lbs)||0)}${e.cost>0?` · ${fmtMoney(e.cost)}`:""}`;
            else if(e.action==="calf")detail=`${e.count} calf`;
            else if(e.action==="weight"||e.action==="butcher")detail=fmtWeight(Number(e.weight)||0);
            else if(e.action==="preg_test"){
              const r = e.pregResult==="pregnant"?"🤰 pregnant":e.pregResult==="open"?"❌ open":"❓ inconclusive";
              const m = e.pregMethod && e.pregMethod!=="other" ? ` · ${e.pregMethod}` : "";
              const ec = e.pregResult==="pregnant" && e.expectedCalving ? ` · due ${fmtDate(e.expectedCalving)}` : "";
              detail = `${r}${m}${ec}`;
            }
            else if(e.action==="heat"){
              const i = e.heatIntensity === "standing" ? "standing" :
                e.heatIntensity === "mounting" ? "mounting" :
                e.heatIntensity === "bloody" ? "bloody" : "quiet";
              const next = e.nextHeatExpected ? ` · next ${fmtDate(e.nextHeatExpected)}` : "";
              detail = `${i}${next}`;
            }
            else if(e.action==="ai"){
              const sire = e.aiSireName || "unknown sire";
              const m = e.aiMethod ? ` · ${e.aiMethod}` : "";
              const c = e.cost > 0 ? ` · ${fmtMoney(e.cost)}` : "";
              detail = `× ${sire}${m}${c}`;
            }
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

export function CowsAnalytics({hobby,entries,/* ADV_ANALYTICS */ allEntries=null,dateRange=null,earlyAccessConfig=null,isSupporter=false}){
  const animals=(hobby.animals||[]).filter(a=>!a.archived);
  const milkEntries=entries.filter(e=>e.action==="milk");
  const feedEntries=entries.filter(e=>e.action==="fed");
  const calfEntries=entries.filter(e=>e.action==="calf");
  const butcherEntries=entries.filter(e=>e.action==="butcher");
  const totalMilkGal=milkEntries.reduce((s,e)=>s+(Number(e.gallons)||0),0);
  const totalFeedCost=feedEntries.reduce((s,e)=>s+(Number(e.cost)||0),0);
  const totalFeedLbs=feedEntries.reduce((s,e)=>s+(Number(e.lbs)||0),0);
  const totalCalves=calfEntries.reduce((s,e)=>s+(Number(e.count)||1),0);
  const totalMeatLbs=butcherEntries.reduce((s,e)=>s+(Number(e.weight)||0),0);
  const fcr=totalFeedLbs>0&&totalMeatLbs>0?(totalFeedLbs/totalMeatLbs).toFixed(2):"—";
  const byDate={};
  milkEntries.forEach(e=>{byDate[e.date]=(byDate[e.date]||0)+(Number(e.gallons)||0);});
  const milkTrend=Object.entries(byDate).sort().slice(-14).map(([date,gal])=>({date:date.slice(5),gal:Number(gal.toFixed(2))}));
  const milkByAnimal={};
  milkEntries.forEach(e=>{milkByAnimal[e.animalName||e.animalId]=(milkByAnimal[e.animalName||e.animalId]||0)+(Number(e.gallons)||0);});
  const milkChart=Object.entries(milkByAnimal).map(([name,gal])=>({name,gal:Number(gal.toFixed(1))})).sort((a,b)=>b.gal-a.gal);

  // ── ADV_ANALYTICS ── monthly milk line + record (all-time) + period delta.
  const advAll=allEntries||entries;
  const advAllMilk=advAll.filter(e=>e.action==="milk");
  const milkMonthlyRaw=monthlySeries(advAllMilk,e=>e.date,e=>Number(e.gallons)||0);
  const milkMonthly=milkMonthlyRaw.map(p=>({month:p.month,gal:Number(p.value.toFixed(2)),
    label:(()=>{const pr=String(p.month).split("-").map(Number);const d=new Date(pr[0],pr[1]-1,1);return isNaN(d)?p.month:d.toLocaleDateString("en-US",{month:"short",year:"2-digit"});})()}));
  const milkRecord=personalRecord(milkMonthlyRaw);
  const prior=priorDateRange(dateRange);
  const priorMilk=prior?advAllMilk.filter(e=>e.date&&(!prior.start||e.date>=prior.start)&&(!prior.end||e.date<=prior.end)).reduce((s,e)=>s+(Number(e.gallons)||0),0):null;
  const milkDelta=prior?computeDelta(totalMilkGal,priorMilk):null;
  const pFonts={body:FONT_BODY,display:FONT_DISPLAY};

  return(
    <div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
        <StatCard label="Total milk" value={fmtVolume(totalMilkGal)} accent={palette.leaf}/>
        <StatCard label="Animals" value={animals.length} accent={palette.ink}/>
        <StatCard label="Calves born" value={totalCalves} accent={palette.yolk}/>
        <StatCard label="Feed cost" value={fmtMoney(totalFeedCost)} accent={palette.feather}/>
        {butcherEntries.length>0&&<StatCard label="Butchered" value={butcherEntries.length} sub={fmtWeight(totalMeatLbs)} accent={palette.accent}/>}
        {fcr!=="—"&&<StatCard label="FCR" value={fcr} sub="lbs feed / lb meat" accent={palette.feather}/>}
      </div>

      <LockedStatOverlay earlyAccessConfig={earlyAccessConfig} isSupporter={isSupporter} palette={palette} fonts={pFonts}>
        <div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
            {milkRecord&&<StatCard label="Best milk month" value={fmtVolume(milkRecord.value)} sub={milkRecord.label} accent={palette.leaf}/>}
            {milkDelta&&(
              <div style={{flex:"1 1 130px",minWidth:130,boxSizing:"border-box",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14}}>
                <div style={{fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Milk vs. prior period</div>
                <div style={{fontSize:22,fontFamily:FONT_DISPLAY,color:palette.leaf,lineHeight:1.1}}>{fmtVolume(totalMilkGal)}</div>
                <div style={{marginTop:4}}><StatTrend delta={milkDelta} palette={palette} fonts={pFonts}/></div>
              </div>
            )}
          </div>
          {milkMonthly.length>1&&<ChartCard title="🥛 Milk by month"><ResponsiveContainer width="100%" height={200}><LineChart data={milkMonthly}><XAxis dataKey="label" stroke={palette.inkSoft} fontSize={11}/><YAxis stroke={palette.inkSoft} fontSize={11}/><Tooltip contentStyle={{background:palette.card,border:`1.5px solid ${palette.ink}`,borderRadius:8}} formatter={v=>[fmtVolume(Number(v)||0),"Milk"]}/><Line type="monotone" dataKey="gal" stroke={palette.leaf} strokeWidth={3} dot={{fill:palette.accent,r:4}}/></LineChart></ResponsiveContainer></ChartCard>}
        </div>
      </LockedStatOverlay>

      {milkTrend.length>1&&<ChartCard title={`🥛 Daily milk (${volumeUnitLabel()})`}><ResponsiveContainer width="100%" height={180}><BarChart data={milkTrend}><XAxis dataKey="date" stroke={palette.inkSoft} fontSize={11}/><YAxis stroke={palette.inkSoft} fontSize={11}/><Tooltip contentStyle={{background:palette.card,border:`1.5px solid ${palette.ink}`,borderRadius:8}} formatter={v=>[fmtVolume(Number(v)||0),"Milk"]}/><Bar dataKey="gal" fill={palette.leaf} radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></ChartCard>}
      {milkChart.length>1&&<ChartCard title="🐄 Milk by animal"><div style={{display:"flex",flexDirection:"column",gap:6}}>{milkChart.map(a=><div key={a.name} style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",background:palette.bgAlt,borderRadius:8,fontSize:13}}><span>🐄 {a.name}</span><strong>{fmtVolume(Number(a.gal)||0)}</strong></div>)}</div></ChartCard>}
      {animals.length===0&&<div style={{padding:24,textAlign:"center",color:palette.inkSoft,fontSize:13}}>No cow entries yet.</div>}
    </div>
  );
}

// Cow gestation = ~283 days (varies 279–287 by breed; user can override).
const COW_GESTATION_DAYS = 283;

const addDays = (dateStr, days) => {
  if (!dateStr) return "";
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return localDateStr(d);
};

// ============ BREEDING / CALVING MODAL ============
function BreedingModal({ animals, breeding, onSave, onDelete, onClose, addCalendarEvent }) {
  const dams = animals.filter(a => !a.archived && (a.sex === "Cow" || a.sex === "Heifer"));
  const sires = animals.filter(a => !a.archived && a.sex === "Bull");

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
    (breeding?.breedDate ? addDays(breeding.breedDate, COW_GESTATION_DAYS) : addDays(todayStr(), COW_GESTATION_DAYS))
  );
  const [birthedDate, setBirthedDate] = useState(breeding?.birthedDate || "");
  const [offspringBorn, setOffspringBorn] = useState(breeding?.offspringBorn != null ? String(breeding.offspringBorn) : "");
  const [offspringAlive, setOffspringAlive] = useState(breeding?.offspringAlive != null ? String(breeding.offspringAlive) : "");
  const [notes, setNotes] = useState(breeding?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const defaultExpected = breedDate ? addDays(breedDate, COW_GESTATION_DAYS) : "";
  const isOverridden = expectedBirthDate !== defaultExpected;
  const resetExpected = () => setExpectedBirthDate(defaultExpected);

  // Slide expectedBirthDate along when user changes breedDate (unless they've
  // manually edited it — detected by comparing against the prior default).
  const lastSeenBreedDate = React.useRef(breedDate);
  React.useEffect(() => {
    if (lastSeenBreedDate.current !== breedDate) {
      const oldDefault = lastSeenBreedDate.current ? addDays(lastSeenBreedDate.current, COW_GESTATION_DAYS) : "";
      if (expectedBirthDate === oldDefault) {
        setExpectedBirthDate(addDays(breedDate, COW_GESTATION_DAYS));
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
      const damName = animals.find(a => a.id === damId)?.name || "cow";
      addCalendarEvent({
        id: newId(),
        date: expectedBirthDate,
        title: `🐄 Expected calving — ${damName}`,
        kind: "cow_calving",
        relatedId: id,
      });
    }
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={breeding ? "Edit breeding record" : "Log breeding"}>
      {dams.length === 0 && (
        <div style={{padding:12,background:palette.bgAlt,borderRadius:8,fontSize:13,color:palette.inkSoft,marginBottom:12}}>
          You'll need at least one cow or heifer to log a breeding. Add one first.
        </div>
      )}
      <div style={{display:"flex",gap:12}}>
        <div style={{flex:1}}>
          <Field label="Cow / heifer (dam)">
            <select style={inputStyle} value={damId} onChange={e=>setDamId(e.target.value)}>
              <option value="">— Pick one —</option>
              {dams.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        </div>
        <div style={{flex:1}}>
          <Field label="Bull (sire)">
            {useUnknownSire ? (
              <input
                style={inputStyle}
                value={externalSireName}
                onChange={e => setExternalSireName(e.target.value)}
                placeholder="External / unknown sire"
              />
            ) : (
              <select style={inputStyle} value={sireId} onChange={e=>setSireId(e.target.value)}>
                <option value="">— Pick a bull —</option>
                {sires.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
            <button
              type="button"
              onClick={() => setUseUnknownSire(v => !v)}
              style={{background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,fontSize:11,padding:"4px 0 0",textDecoration:"underline",fontFamily:FONT_BODY}}
            >
              {useUnknownSire ? "Use a tracked bull instead" : "External / unknown sire"}
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
      <Field label="Expected calving date">
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
              title="Reset to breed date + 283 days"
            >
              ↻ Default
            </button>
          )}
        </div>
        <div style={{fontSize:11,color:palette.inkSoft,marginTop:4}}>
          Auto-filled at +283 days (cow gestation, ~9.5 months). Most breeds run 279–287 days. Edit if your herd runs different.
        </div>
      </Field>
      {!breeding && expectedBirthDate && (
        <div style={{padding:"10px 12px",background:palette.yolkSoft || palette.bgAlt,borderRadius:8,fontSize:13,marginBottom:12,color:palette.ink}}>
          🐄 Expected calving <strong>{fmtDate(expectedBirthDate)}</strong> will be added to your calendar.
        </div>
      )}
      <hr style={{border:"none",borderTop:`1px solid ${palette.line}`,margin:"14px 0"}}/>
      <div style={{fontSize:11,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:8}}>
        After calving (fill in when it happens)
      </div>
      <Field label="Calved date">
        <input type="date" style={inputStyle} value={birthedDate} onChange={e=>setBirthedDate(e.target.value)}/>
      </Field>
      <div style={{display:"flex",gap:12}}>
        <div style={{flex:1}}>
          <Field label="Calves born">
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


// ============================================================================
// HERD TALLY — count-only tracking that coexists with individual animals
// ----------------------------------------------------------------------------
// Lets users record a simple per-sex head count for cattle they don't want to
// track as individual records. Lives ALONGSIDE the individual animal list — it
// does not replace it, and deliberately does NOT feed breeding, pedigree,
// history, or sales (all of which stay individual-animal-only). Stored as
// hobby.herdTally, an object keyed by these category labels.
// ============================================================================
function HerdTallySection({ hobby, update }) {
  const HERD_TALLY_CATEGORIES = ["Cow","Bull","Steer","Heifer","Calf","Unsexed"];
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
            Got cattle you don't want to name individually? Record a simple head count by sex here — separate from your named animals.
          </div>
        )}
      </div>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="Herd tally">
          <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
            Record a head count by sex for cattle you don't want to track individually. Separate from your named animals — it doesn't affect breeding, history, or sales.
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

function CowModalRouter({modal,hobby,update,user,onClose}){
  if(!modal)return null;
  const pastures = hobby.pastures || [];
  if(modal.type==="addAnimal")return <AnimalModal hobbyId={hobby.id} animals={hobby.animals||[]} pastures={pastures} update={update} user={user} onClose={onClose}/>;
  if(modal.type==="editAnimal"){const animal=(hobby.animals||[]).find(a=>a.id===modal.animalId);if(!animal){onClose();return null;}return <AnimalModal animal={animal} hobbyId={hobby.id} animals={hobby.animals||[]} pastures={pastures} update={update} user={user} onClose={onClose}/>;}
  if(modal.type==="addPasture")return <PastureModal hobbyId={hobby.id} update={update} onClose={onClose}/>;
  if(modal.type==="editPasture"){const pasture=pastures.find(p=>p.id===modal.pastureId);if(!pasture){onClose();return null;}return <PastureModal pasture={pasture} hobbyId={hobby.id} update={update} onClose={onClose}/>;}
  if(modal.type==="moveAnimal"){const animal=(hobby.animals||[]).find(a=>a.id===modal.animalId);if(!animal){onClose();return null;}return <MoveAnimalModal animal={animal} hobbyId={hobby.id} pastures={pastures} update={update} onClose={onClose}/>;}
  return null;
}

export default function CowsPage({hobby,data,update,user}){
  const[localModal,setLocalModal]=useState(null);
  const[breedingModal,setBreedingModal]=useState({open:false,breeding:null});
  // COWS_UNIFY_V1 — top-bar modal state
  const [fedOpen, setFedOpen] = useState(false);
  const [milkOpen, setMilkOpen] = useState(false);
  const [calfOpen, setCalfOpen] = useState(false);
  const [heatOpen, setHeatOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [pregOpen, setPregOpen] = useState(false);
  const [logEntryAction, setLogEntryAction] = useState(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const entries=data.entries[hobby.id]||[];
  const allAnimals=hobby.animals||[];
  const animals=allAnimals.filter(a=>!a.archived);
  const archived=allAnimals.filter(a=>a.archived);
  const breedings=(hobby.breedings||[]).slice().sort((a,b)=>(b.breedDate||"").localeCompare(a.breedDate||""));
  const upcomingCalvings=breedings.filter(b=>!b.birthedDate&&b.expectedBirthDate>=todayStr()).slice(0,3);

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
      // Also remove the matching calendar event so the reminder disappears.
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
      <CowModalRouter modal={localModal} hobby={hobby} update={update} user={user} onClose={()=>setLocalModal(null)}/>
      <HerdTallySection hobby={hobby} update={update}/>
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
        <div style={{fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink}}>Your cattle</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {/* COWS_UNIFY_V1 — 💕 Breeding moved into the tile bar below; Pasture and Add cow stay as structural page-actions. */}
          {animals.length>0 && (
            <button onClick={()=>setLocalModal({type:"addPasture",hobbyId:hobby.id})} style={{padding:"7px 14px",borderRadius:8,background:palette.bgAlt,border:`1.5px solid ${palette.line}`,fontFamily:FONT_BODY,fontWeight:600,fontSize:13,cursor:"pointer",color:palette.ink}}>🌾 Pasture</button>
          )}
          <button onClick={()=>setLocalModal({type:"addAnimal",hobbyId:hobby.id})} style={{padding:"7px 14px",borderRadius:8,background:palette.yolk,border:`1.5px solid ${palette.ink}`,fontFamily:FONT_BODY,fontWeight:600,fontSize:13,cursor:"pointer",color:palette.ink,display:"flex",alignItems:"center",gap:6}}><Plus size={14}/>Add cow</button>
        </div>
      </div>

      {/* COWS_UNIFY_V1 — quick action tile bar (mirrors Sheep/Rabbits/Pigs/Goats) */}
      {fedOpen && <FedCowModal hobby={hobby} hobbyId={hobby.id} update={update} onClose={()=>setFedOpen(false)} />}
      {milkOpen && <MilkCowModal hobby={hobby} hobbyId={hobby.id} update={update} onClose={()=>setMilkOpen(false)} />}
      {calfOpen && <CalfCowModal hobby={hobby} hobbyId={hobby.id} update={update} onClose={()=>setCalfOpen(false)} />}
      {heatOpen && <HeatCowModal hobby={hobby} hobbyId={hobby.id} update={update} onClose={()=>setHeatOpen(false)} />}
      {aiOpen && <AICowModal hobby={hobby} hobbyId={hobby.id} update={update} onClose={()=>setAiOpen(false)} />}
      {pregOpen && <PregTestCowModal hobby={hobby} hobbyId={hobby.id} update={update} onClose={()=>setPregOpen(false)} />}
      {logEntryAction && <LogCowEntryModal hobby={hobby} hobbyId={hobby.id} action={logEntryAction} update={update} onClose={()=>setLogEntryAction(null)} />}
      {removeOpen && <RemoveCowModal hobby={hobby} hobbyId={hobby.id} update={update} onClose={()=>setRemoveOpen(false)} />}

      {animals.length > 0 && (() => {
        // Milk tile visibility: any live cow with Dairy/Both purpose, OR no
        // purposes set at all (don't hide before user has labeled cattle).
        const anyPurposeSet = animals.some(a => a.purpose);
        const hasDairy = animals.some(a => a.purpose === "Dairy" || a.purpose === "Both");
        const showMilkTile = !anyPurposeSet || hasDairy;
        return (
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:8,marginBottom:18 }}>
            {showMilkTile && (
              <Btn small variant="leaf" onClick={() => setMilkOpen(true)} style={{ width:"100%" }}>🥛 Milk</Btn>
            )}
            <Btn small onClick={() => setFedOpen(true)} style={{ width:"100%" }}>🌾 Feed</Btn>
            <Btn small onClick={() => setLogEntryAction("weight")} style={{ width:"100%" }}>⚖️ Weight</Btn>
            <Btn small variant="leaf" onClick={() => setBreedingModal({open:true,breeding:null})} style={{ width:"100%" }}>💕 Breeding</Btn>
            <Btn small variant="leaf" onClick={() => setCalfOpen(true)} style={{ width:"100%" }}>🍼 Calf</Btn>
            <Btn small variant="leaf" onClick={() => setPregOpen(true)} style={{ width:"100%" }}>🤰 Preg check</Btn>
            <Btn small variant="leaf" onClick={() => setHeatOpen(true)} style={{ width:"100%" }}>🔥 Heat</Btn>
            <Btn small variant="leaf" onClick={() => setAiOpen(true)} style={{ width:"100%" }}>💉 AI</Btn>
            <Btn small onClick={() => setLogEntryAction("health")} style={{ width:"100%" }}>💊 Vet / meds</Btn>
            <Btn small onClick={() => setLogEntryAction("note")} style={{ width:"100%" }}>📝 Note</Btn>
            <Btn small variant="danger" onClick={() => setRemoveOpen(true)} style={{ width:"100%" }}>❄️ Remove</Btn>
          </div>
        );
      })()}
      {upcomingCalvings.length>0 && (
        <div style={{padding:"10px 12px",background:palette.bgAlt,borderRadius:8,fontSize:13,marginBottom:12,color:palette.ink}}>
          <div style={{fontSize:11,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,fontWeight:600,marginBottom:6}}>Upcoming calvings</div>
          {upcomingCalvings.map(b=>{
            const dam=allAnimals.find(a=>a.id===b.damId);
            return <div key={b.id} style={{padding:"4px 0",cursor:"pointer"}} onClick={()=>setBreedingModal({open:true,breeding:b})}>🐄 {dam?.name||"cow"} — {fmtDate(b.expectedBirthDate)}{b.method&&b.method!=="Natural"?` · ${b.method}`:""}</div>;
          })}
        </div>
      )}
      {animals.length===0?(
        <div style={{padding:28,background:palette.card,border:`2px dashed ${palette.line}`,borderRadius:12,textAlign:"center",color:palette.inkSoft}}>
          <div style={{fontSize:36,marginBottom:10}}>🐄</div>
          <div style={{fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink,marginBottom:6}}>No cattle yet</div>
          <div style={{fontSize:13,marginBottom:14}}>Add your first cow to start tracking milk, feed, and calves.</div>
          <button onClick={()=>setLocalModal({type:"addAnimal",hobbyId:hobby.id})} style={{padding:"10px 18px",borderRadius:8,background:palette.yolk,border:`1.5px solid ${palette.ink}`,fontFamily:FONT_BODY,fontWeight:600,fontSize:14,cursor:"pointer",color:palette.ink}}>Add first cow</button>
        </div>
      ):(() => {
        // Pasture grouping: only kicks in when the user has created at
        // least one pasture/herd. Otherwise the original flat list is
        // preserved exactly (zero-impact for users who don't care about
        // grouping).
        const pastures = hobby.pastures || [];
        if (pastures.length === 0) {
          return animals.map(a => <AnimalCard key={a.id} animal={a} hobbyId={hobby.id} animals={allAnimals} entries={entries} sales={data.sales||[]} hobby={hobby} update={update} setModal={setLocalModal} customers={data.customers||[]}/>);
        }
        // Build groups: one per existing pasture, plus a synthetic
        // "Ungrouped" group for cows with no pastureId. Empty groups still
        // show (so the user can tap an empty pasture's header to assign
        // cows to it).
        const buckets = new Map();
        pastures.forEach(p => buckets.set(p.id, { pasture: p, animals: [] }));
        const ungrouped = [];
        animals.forEach(a => {
          if (a.pastureId && buckets.has(a.pastureId)) {
            buckets.get(a.pastureId).animals.push(a);
          } else {
            ungrouped.push(a);
          }
        });
        // Per-pasture cost analytics — sum feed + butcher entries for the
        // cows that live in each pasture. Cheap O(n*m) since herds are
        // small; could index by animalId if it ever matters.
        const costFor = (groupAnimals) => {
          const animalIds = new Set(groupAnimals.map(a => a.id));
          let feedCost = 0, feedLbs = 0;
          entries.forEach(e => {
            if (!animalIds.has(e.animalId)) return;
            if (e.action === "fed") {
              feedCost += Number(e.cost) || 0;
              feedLbs += Number(e.lbs) || 0;
            }
          });
          return { feedCost, feedLbs };
        };

        const renderGroup = (label, emoji, pasture, list) => {
          const stats = costFor(list);
          const acreage = pasture?.acreage || 0;
          const isUngrouped = !pasture;
          return (
            <details
              key={pasture?.id || "__ungrouped__"}
              open={list.length > 0}
              style={{marginBottom:14, background:palette.bgAlt, borderRadius:10, padding:10}}
            >
              <summary style={{cursor:"pointer", userSelect:"none", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"4px 6px"}}>
                <span style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:16}}>{emoji}</span>
                  <span style={{fontFamily:FONT_DISPLAY,fontSize:17,color:palette.ink}}>{label}</span>
                  <span style={{fontSize:11,color:palette.inkSoft,background:palette.card,padding:"2px 8px",borderRadius:4}}>
                    {list.length} {list.length === 1 ? "cow" : "cattle"}
                    {acreage > 0 && <> · {acreage} ac</>}
                    {stats.feedCost > 0 && <> · {fmtMoney(stats.feedCost)} feed</>}
                  </span>
                </span>
                {!isUngrouped && (
                  <button
                    type="button"
                    onClick={(e)=>{e.preventDefault();e.stopPropagation();setLocalModal({type:"editPasture",hobbyId:hobby.id,pastureId:pasture.id});}}
                    style={{background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,padding:4}}
                    aria-label={`Edit ${pasture.name}`}
                  ><Edit3 size={13}/></button>
                )}
              </summary>
              <div style={{marginTop:10}}>
                {list.length === 0 ? (
                  <div style={{padding:"14px 10px", fontSize:12, color:palette.inkSoft, fontStyle:"italic", textAlign:"center"}}>
                    No cattle assigned. Edit a cow and pick this {pasture?.type === "herd" ? "herd" : "pasture"} to assign.
                  </div>
                ) : (
                  list.map(a => <AnimalCard key={a.id} animal={a} hobbyId={hobby.id} animals={allAnimals} entries={entries} sales={data.sales||[]} hobby={hobby} update={update} setModal={setLocalModal} customers={data.customers||[]}/>)
                )}
              </div>
            </details>
          );
        };

        return (
          <>
            {pastures.map(p => renderGroup(
              p.name,
              p.type === "herd" ? "🐂" : "🌾",
              p,
              buckets.get(p.id)?.animals || []
            ))}
            {ungrouped.length > 0 && renderGroup("Ungrouped", "🐄", null, ungrouped)}
          </>
        );
      })()}

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
                  <strong style={{color:palette.ink}}>{dam?.name||"cow"}</strong> × {sireName} · {fmtDate(b.breedDate)} {b.method&&`· ${b.method}`}
                  {b.birthedDate ? <span style={{color:palette.leaf}}> ✓ calved {fmtDate(b.birthedDate)} ({b.offspringBorn||0} born)</span> : <span> · expected {fmtDate(b.expectedBirthDate)}</span>}
                </div>
              );
            })}
          </div>
        </details>
      )}

      {archived.length>0 && (
        <details style={{marginTop:18}}>
          <summary style={{cursor:"pointer",color:palette.inkSoft,fontSize:13,padding:8,background:palette.bgAlt,borderRadius:8,userSelect:"none"}}>
            Archived cattle ({archived.length}) — tap to view
          </summary>
          <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:6}}>
            {archived.map(a=>(
              <div
                key={a.id}
                onClick={()=>setLocalModal({type:"editAnimal",hobbyId:hobby.id,animalId:a.id})}
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
