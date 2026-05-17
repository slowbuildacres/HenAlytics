// ============================================================================
// RABBITS — per-animal tracking, pedigree, breeding reminders, butcher stats
// ----------------------------------------------------------------------------
// Push 7b: redesigned from aggregate hutch counts to individual animals,
// matching the pattern used by Goats / Cows / Pigs / Sheep / Horses.
//
// Migration strategy:
//   - The legacy data shape was `hobby.hutches[]` with { name, breed, does, bucks }.
//   - On first load post-7b, for each hutch with does=N / bucks=M we generate
//     N placeholder doe animals and M placeholder buck animals, named
//     "{HutchName} Doe 1", "{HutchName} Buck 1", etc. They inherit breed,
//     birthdate (= hutch.startDate), and carry a `hutch` field preserving
//     the original grouping label.
//   - Old entries (litter / bred / fed / butcher / death / infrastructure /
//     etc.) STAY in data.entries["rabbits"] untouched. We can't perfectly
//     re-attribute them to individual rabbits, so they show in a collapsible
//     "Legacy log entries (before per-rabbit tracking)" section at the bottom
//     of the page, grouped by the original hutch via `hatchId`.
//   - New entries log per-animal via `animalId` (the new pattern).
//   - The migration is gated by `data.rabbitsMigratedV7b = true` so it runs
//     once. Hutch objects are PRESERVED on disk (not deleted) so we can
//     still resolve old `hatchId` references for the legacy log section.
//
// New data shape on each rabbit (matching other livestock):
//   { id, name, breed, sex, role, birthdate, purchaseCost, purchasedFrom,
//     sireId, sire, damId, dam, registryNumber, registryName, notes,
//     hutch,                  // text label, preserves grouping post-migration
//     archived, archivedReason, archivedDate, created }
//
// Sexes: Doe (female) / Buck (male). Roles: Doe (breeding), Buck (breeding),
// Kit (under ~8 weeks), Grower (between weaning and butcher), Pet (retained).
// Pedigree uses sex ["Doe"] for dam and ["Buck"] for sire — kits/growers/pets
// aren't eligible parents until promoted to Doe/Buck. (Mirrors goats exactly.)
// ============================================================================

import React, { useState, useEffect } from "react";
import { X, Edit3, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { SireDamPicker, PedigreeView } from "./PedigreeView.jsx";
import { AnimalHistoryView } from "./AnimalHistoryView.jsx";
import { fmtWeight, fmtCups, weightUnitLabel, lbsFromInput, weightFromLbs, getCurrentWeightUnit } from "./units.js";

const palette = {
  bg:"#F4EDE0",bgAlt:"#EBE0CC",ink:"#2C1810",inkSoft:"#5C4530",
  accent:"#C84B31",leaf:"#5A7A3C",leafSoft:"#A8C078",
  yolk:"#E8B547",yolkSoft:"#F2D58A",feather:"#8B6F47",
  line:"#2C181030",card:"#FAF5EA",
};
const FONT_DISPLAY=`'DM Serif Display', Georgia, serif`;
const FONT_BODY=`'Be Vietnam Pro', -apple-system, sans-serif`;
const inputStyle={width:"100%",padding:"10px 12px",borderRadius:8,border:`1.5px solid ${palette.line}`,background:palette.card,fontFamily:FONT_BODY,fontSize:15,color:palette.ink,boxSizing:"border-box"};
const newId=()=>Math.random().toString(36).slice(2,10);
const localDateStr=(d)=>{const dt=d instanceof Date?d:new Date(d);return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;};
const todayStr=()=>localDateStr(new Date());
const parseLocalDate=(s)=>{if(!s)return new Date();const[y,m,d]=s.split("-").map(Number);return new Date(y,(m||1)-1,d||1);};
const fmtDate=(s)=>{if(!s)return"";return parseLocalDate(s).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});};
const fmtMoney=(n)=>`$${(Number(n)||0).toFixed(2)}`;
const addDays=(dateStr,days)=>localDateStr(new Date(parseLocalDate(dateStr).getTime()+days*24*60*60*1000));

const RABBIT_BREEDS=[
  "New Zealand","Californian","Rex","Holland Lop","Mini Rex",
  "Flemish Giant","Dutch","Lionhead","Angora","Champagne d'Argent",
  "American Chinchilla","Satin","Silver Fox","Palomino","Mixed",
  "Other",
];
const RABBIT_SEXES=["Doe","Buck"];
const RABBIT_ROLES=[
  {key:"doe",label:"Doe (breeding female)",sex:"Doe"},
  {key:"buck",label:"Buck (breeding male)",sex:"Buck"},
  {key:"kit",label:"Kit (under 8 weeks)",sex:null},
  {key:"grower",label:"Grower (weaning–butcher)",sex:null},
  {key:"pet",label:"Pet / retained",sex:null},
];
const KINDLE_DAYS=31; // gestation

function Btn({children,onClick,variant="primary",small=false,style={},disabled=false}){
  const styles={primary:{background:palette.ink,color:palette.bg,border:`1.5px solid ${palette.ink}`},danger:{background:palette.accent,color:palette.bg,border:`1.5px solid ${palette.accent}`},ghost:{background:"transparent",color:palette.ink,border:`1.5px solid ${palette.line}`},accent:{background:palette.yolk,color:palette.ink,border:`1.5px solid ${palette.ink}`}};
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
// MIGRATION — runs once, on mount, if rabbitsMigratedV7b flag is missing.
// Converts each legacy hutch's doe/buck counts into placeholder animals.
// ============================================================================
function runMigrationIfNeeded(data, hobby, update) {
  if (data.rabbitsMigratedV7b) return;
  // Existing per-animal data shouldn't be touched; only seed if animals is empty
  // and there are legacy hutches with counts.
  const hasAnimals = Array.isArray(hobby.animals) && hobby.animals.length > 0;
  const hutches = hobby.hutches || [];
  if (hasAnimals || hutches.length === 0) {
    // Nothing to migrate; just mark the flag so we don't re-check every render.
    update(d => { d.rabbitsMigratedV7b = true; return d; });
    return;
  }
  update(d => {
    const h = d.hobbies.find(x => x.id === hobby.id);
    if (!h) { d.rabbitsMigratedV7b = true; return d; }
    if (!Array.isArray(h.animals)) h.animals = [];
    const now = Date.now();
    (h.hutches || []).forEach(hutch => {
      const doeCount = Number(hutch.does) || 0;
      const buckCount = Number(hutch.bucks) || 0;
      for (let i = 1; i <= doeCount; i++) {
        h.animals.push({
          id: newId(),
          name: `${hutch.name} Doe ${doeCount > 1 ? i : ""}`.trim(),
          breed: hutch.breed || "Mixed",
          sex: "Doe",
          role: "doe",
          birthdate: hutch.startDate || "",
          purchaseCost: 0,
          purchasedFrom: "(migrated from hutch)",
          sireId: null, sire: "",
          damId: null, dam: "",
          registryNumber: "", registryName: "",
          notes: hutch.notes || "",
          hutch: hutch.name,
          archived: false,
          created: now,
        });
      }
      for (let i = 1; i <= buckCount; i++) {
        h.animals.push({
          id: newId(),
          name: `${hutch.name} Buck ${buckCount > 1 ? i : ""}`.trim(),
          breed: hutch.breed || "Mixed",
          sex: "Buck",
          role: "buck",
          birthdate: hutch.startDate || "",
          purchaseCost: 0,
          purchasedFrom: "(migrated from hutch)",
          sireId: null, sire: "",
          damId: null, dam: "",
          registryNumber: "", registryName: "",
          notes: hutch.notes || "",
          hutch: hutch.name,
          archived: false,
          created: now,
        });
      }
    });
    d.rabbitsMigratedV7b = true;
    return d;
  });
}

// ============================================================================
// ANIMAL MODAL — add / edit / archive / delete a rabbit
// ============================================================================
function AnimalModal({animal,hobbyId,animals,update,onClose}){
  const isEdit=!!animal;
  const[name,setName]=useState(animal?.name||"");
  // Breed: dropdown + "Other" custom text field
  const initBreed = (animal?.breed || "").trim();
  const initIsKnown = RABBIT_BREEDS.includes(initBreed);
  const[breedSelect,setBreedSelect]=useState(initBreed && initIsKnown ? initBreed : (initBreed ? "Other" : "Mixed"));
  const[breedCustom,setBreedCustom]=useState(initBreed && !initIsKnown ? initBreed : "");
  const finalBreed = breedSelect === "Other" ? breedCustom.trim() : breedSelect;
  const[sex,setSex]=useState(animal?.sex||"Doe");
  const[role,setRole]=useState(animal?.role||"doe");
  const[birthdate,setBirthdate]=useState(animal?.birthdate||"");
  const[purchaseCost,setPurchaseCost]=useState(animal?.purchaseCost!=null?String(animal.purchaseCost):"");
  const[purchasedFrom,setPurchasedFrom]=useState(animal?.purchasedFrom||"");
  const[hutch,setHutch]=useState(animal?.hutch||"");
  const[notes,setNotes]=useState(animal?.notes||"");
  const[confirmDelete,setConfirmDelete]=useState(false);
  // Push 7a — pedigree fields. Dam eligible: Doe. Sire eligible: Buck.
  // Kits / growers / pets aren't viable parents until promoted, so they're
  // filtered out by the sex check.
  const [sireId, setSireId] = useState(animal?.sireId || "");
  const [sire, setSire] = useState(animal?.sire || "");
  const [damId, setDamId] = useState(animal?.damId || "");
  const [dam, setDam] = useState(animal?.dam || "");
  const [registryNumber, setRegistryNumber] = useState(animal?.registryNumber || "");
  const [registryName, setRegistryName] = useState(animal?.registryName || "");

  const save=()=>{
    if(!name.trim())return;
    const id=animal?.id||newId();
    update(d=>{
      const h=d.hobbies.find(x=>x.id===hobbyId);
      if(!h)return d;
      if(!Array.isArray(h.animals))h.animals=[];
      const dataObj={
        id,name:name.trim(),breed:finalBreed,sex,role,birthdate,
        purchaseCost:Number(purchaseCost)||0,
        purchasedFrom:purchasedFrom.trim(),
        hutch:hutch.trim(),
        notes:notes.trim(),
        sireId:sireId||null,sire:sire.trim(),
        damId:damId||null,dam:dam.trim(),
        registryNumber:registryNumber.trim(),
        registryName:registryName.trim(),
        created:animal?.created||Date.now(),
        archived:animal?.archived||false,
        archivedReason:animal?.archivedReason,
        archivedDate:animal?.archivedDate,
      };
      if(isEdit){
        const idx=h.animals.findIndex(a=>a.id===id);
        if(idx!==-1)h.animals[idx]=dataObj;else h.animals.push(dataObj);
      } else h.animals.push(dataObj);
      return d;
    });
    onClose();
  };

  const remove=()=>{
    update(d=>{
      const h=d.hobbies.find(x=>x.id===hobbyId);
      if(h)h.animals=(h.animals||[]).filter(a=>a.id!==animal.id);
      return d;
    });
    onClose();
  };

  const [showArchive,setShowArchive]=useState(false);
  const [archiveReason,setArchiveReason]=useState("butchered");
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
    <Modal open onClose={onClose} title={isEdit?"Edit rabbit":"Add a rabbit"}>
      <Field label="Name / tag"><input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Biscuit, Tag #042" autoFocus/></Field>
      <Field label="Breed">
        <select style={inputStyle} value={breedSelect} onChange={e=>setBreedSelect(e.target.value)}>{RABBIT_BREEDS.map(b=><option key={b}>{b}</option>)}</select>
        {breedSelect === "Other" && (
          <input style={{...inputStyle, marginTop: 8}} value={breedCustom} onChange={e=>setBreedCustom(e.target.value)} placeholder="Type your breed (e.g. Tan, Beveren, Florida White)" autoFocus />
        )}
      </Field>
      <div style={{display:"flex",gap:12}}>
        <div style={{flex:1}}>
          <Field label="Sex">
            <select style={inputStyle} value={sex} onChange={e=>setSex(e.target.value)}>{RABBIT_SEXES.map(s=><option key={s}>{s}</option>)}</select>
          </Field>
        </div>
        <div style={{flex:1}}>
          <Field label="Role">
            <select style={inputStyle} value={role} onChange={e=>setRole(e.target.value)}>
              {RABBIT_ROLES.map(r=><option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </Field>
        </div>
      </div>
      <Field label="Birthdate (optional)"><input type="date" style={inputStyle} value={birthdate} onChange={e=>setBirthdate(e.target.value)}/></Field>
      <Field label="Hutch / location (optional)"><input style={inputStyle} value={hutch} onChange={e=>setHutch(e.target.value)} placeholder="e.g. Hutch 1, East run, Colony A"/></Field>
      <div style={{display:"flex",gap:12}}>
        <div style={{flex:1}}><Field label="Purchase cost (optional)"><input type="number" min={0} step="0.01" style={inputStyle} value={purchaseCost} onChange={e=>setPurchaseCost(e.target.value)} placeholder="$"/></Field></div>
        <div style={{flex:1}}><Field label="Purchased from (optional)"><input style={inputStyle} value={purchasedFrom} onChange={e=>setPurchasedFrom(e.target.value)} placeholder="Breeder, friend, etc"/></Field></div>
      </div>
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Color, markings, temperament..."/></Field>

      {/* Push 7a — Pedigree. Doe eligible for dam; Buck eligible for sire. */}
      <details style={{marginBottom:14}}>
        <summary style={{cursor:"pointer",padding:"8px 12px",background:palette.bgAlt,borderRadius:8,fontSize:13,fontWeight:600,color:palette.ink,userSelect:"none"}}>
          🧬 Pedigree & registry (optional)
        </summary>
        <div style={{padding:"12px 4px 4px"}}>
          <SireDamPicker
            label="Dam"
            animals={animals}
            eligibleSexes={["Doe"]}
            excludeId={animal?.id}
            selectedId={damId}
            selectedName={dam}
            onChange={({id,name})=>{setDamId(id);setDam(name);}}
            placeholder="Type the dam's name"
          />
          <SireDamPicker
            label="Sire"
            animals={animals}
            eligibleSexes={["Buck"]}
            excludeId={animal?.id}
            selectedId={sireId}
            selectedName={sire}
            onChange={({id,name})=>{setSireId(id);setSire(name);}}
            placeholder="Type the sire's name"
          />
          <Field label="Registry name (optional)">
            <input style={inputStyle} value={registryName} onChange={e=>setRegistryName(e.target.value)} placeholder="e.g. Briarwood Biscuit"/>
          </Field>
          <Field label="Registry number (optional)">
            <input style={inputStyle} value={registryNumber} onChange={e=>setRegistryNumber(e.target.value)} placeholder="e.g. ARBA #1234567"/>
          </Field>
        </div>
      </details>

      <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!name.trim()}>{isEdit?"Save":"Add"}</Btn>
        {isEdit && animal?.archived && (
          <Btn variant="ghost" onClick={restore}>Restore</Btn>
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
            Keeps the rabbit's history but removes them from your active list.
          </div>
          <Field label="Reason">
            <select style={inputStyle} value={archiveReason} onChange={e=>setArchiveReason(e.target.value)}>
              <option value="butchered">Butchered</option>
              <option value="sold">Sold</option>
              <option value="died">Died</option>
              <option value="given away">Given away</option>
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
// LOG MODAL — per-animal log entry. For "bred" we let the user pick a buck
// from existing bucks (filtered) and compute a kindle date 31d out.
// ============================================================================
function LogModal({animal,hobbyId,animals,action,update,onClose}){
  const[date,setDate]=useState(todayStr());
  const[lbs,setLbs]=useState("");
  // Feed unit picker. Default lbs (matches legacy behavior + rabbit pellet
  // bag norm); cups for users who measure by scoop. Stored on entry as
  // feedUnit + feedAmount. Legacy `lbs` field still written when unit=lbs
  // for back-compat with old analytics.
  const[feedUnit,setFeedUnit]=useState("lbs");
  const[herdWide,setHerdWide]=useState(false); // FEAT6-FED
  const[cost,setCost]=useState("");
  const[weight,setWeight]=useState("");
  const[kitsAlive,setKitsAlive]=useState("");
  const[kitsStillborn,setKitsStillborn]=useState("");
  const[cause,setCause]=useState("Unknown");
  const[buckId,setBuckId]=useState("");
  const[notes,setNotes]=useState("");
  // Sale-only: buyer + price + sold-vs-rehomed.
  const[saleBuyer,setSaleBuyer]=useState("");
  const[salePrice,setSalePrice]=useState("");
  const[saleType,setSaleType]=useState("sold");

  // For "bred": list of bucks from this hobby's animals.
  const availableBucks = (animals||[]).filter(a=>!a.archived && a.sex==="Buck" && a.id!==animal.id);
  const kindleDate = date ? addDays(date, KINDLE_DAYS) : "";

  const save=()=>{
    const entry={id:newId(),date,action,animalId:animal.id,animalName:animal.name,notes,created:Date.now()};
    if(action==="fed"){
      // Write unit-aware fields; keep legacy `lbs` populated when unit=lbs
      // so existing analytics (totals in lbs) keep working unchanged.
      entry.feedAmount=Number(lbs)||0;
      entry.feedUnit=feedUnit;
      entry.lbs=feedUnit==="lbs"?(Number(lbs)||0):0;
      entry.cost=Number(cost)||0;
    }
    // FEAT6-FED: a herd-wide feeding is not tied to one animal.
    if(action==="fed"&&herdWide){entry.animalId=null;entry.animalName="";entry.herdWide=true;}
    if(action==="weight")entry.weight=Number(weight)||0;
    if(action==="bred"){
      const buck=availableBucks.find(b=>b.id===buckId);
      entry.buckId=buckId||null;
      entry.buckName=buck?.name||"";
      entry.kindleDate=kindleDate;
    }
    if(action==="litter"){
      entry.kitsAlive=Number(kitsAlive)||0;
      entry.kitsStillborn=Number(kitsStillborn)||0;
    }
    if(action==="butcher"){entry.weight=Number(weight)||0;entry.cost=Number(cost)||0;}
    if(action==="death")entry.cause=cause;
    if(action==="sale"){entry.buyer=saleBuyer.trim();entry.price=Number(salePrice)||0;entry.saleType=saleType;}
    update(d=>{
      d.entries[hobbyId]=d.entries[hobbyId]||[];
      d.entries[hobbyId].push(entry);
      // Kindle reminder: when a doe is bred, add a 31-day calendar event.
      if(action==="bred" && kindleDate){
        d.calendarEvents = d.calendarEvents || [];
        d.calendarEvents.push({
          id:newId(),date:kindleDate,
          title:`🍼 ${animal.name} — kindle expected`,
          type:"rabbits",
          notes:`Bred ${fmtDate(date)}${entry.buckName?" · sire "+entry.buckName:""}`,
        });
      }
      // Death archives the rabbit so it disappears from the active list.
      if(action==="death"){
        const h=d.hobbies.find(x=>x.id===hobbyId);
        const a=(h?.animals||[]).find(x=>x.id===animal.id);
        if(a&&!a.archived){
          a.archived=true;
          a.archivedReason=cause&&cause!=="Unknown"?`Died: ${cause}`:"Died";
          a.archivedDate=date;
        }
      }
      // Sale archives the rabbit and creates a Sales row.
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
        d.sales.push({
          id:entry.id,date,hobbyType:"rabbit",crop:animal.name,saleType,
          pricePerUnit:Number(salePrice)||0,totalRevenue:Number(salePrice)||0,
          qty:1,animalId:animal.id,buyer:saleBuyer.trim(),notes:notes||"",
        });
      }
      return d;
    });
    onClose();
  };

  const titles={fed:"Log feed",weight:"Log weight",bred:"Log breeding",litter:"Log litter",butcher:"Log butcher",death:"Log death",sale:"Log sale",note:"Add note"};
  const isDeath=action==="death";
  const isSale=action==="sale";

  return(
    <Modal open onClose={onClose} title={`${titles[action]||"Log"} — ${animal.name}`}>
      <Field label="Date"><input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)}/></Field>
      {action==="fed" && (
        <>
          <Field label="How much feed?">
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              {["lbs","cups"].map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setFeedUnit(u)}
                  style={{
                    flex:1,padding:"8px 10px",borderRadius:8,
                    border:`1.5px solid ${feedUnit===u?palette.ink:palette.line}`,
                    background: feedUnit===u?palette.ink:palette.card,
                    color: feedUnit===u?palette.bg:palette.ink,
                    fontFamily:FONT_BODY,fontSize:13,fontWeight:600,cursor:"pointer",
                  }}
                >{u === "lbs" ? weightUnitLabel() : u}</button>
              ))}
            </div>
            {(()=>{
              const metricW=getCurrentWeightUnit()==="kg";
              const isCups=feedUnit==="cups";
              const shown=isCups?lbs:(lbs===""||lbs==null?"":(metricW?String(Math.round(weightFromLbs(Number(lbs))*100)/100):lbs));
              const ph=isCups?"Cups of feed":(metricW?"Kilograms of feed":"Pounds of feed");
              return <input type="number" min={0} step="0.1" style={inputStyle} value={shown} onChange={e=>{const r=e.target.value;if(isCups){setLbs(r);return;}if(r===""){setLbs("");return;}setLbs(metricW?String(lbsFromInput(r)):r);}} placeholder={ph} autoFocus/>;
            })()}
          </Field>
          <Field label="Cost ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$0.00"/></Field>
          {/* FEAT6-FED: log this feeding for the whole herd instead of
              just this animal. */}
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
        </>
      )}
      {action==="weight" && (()=>{
        const isMetricW=getCurrentWeightUnit()==="kg";
        const shownW=weight===""||weight==null?"":(isMetricW?String(Math.round(weightFromLbs(Number(weight))*100)/100):weight);
        return <Field label={isMetricW?"Current weight (kg)":"Current weight (lbs)"}><input type="number" min={0} step="0.1" style={inputStyle} value={shownW} onChange={e=>{const r=e.target.value;setWeight(r===""?"":(isMetricW?String(lbsFromInput(r)):r));}} placeholder="0" autoFocus/></Field>;
      })()}
      {action==="bred" && (
        <>
          <Field label="Buck (optional)">
            <select style={inputStyle} value={buckId} onChange={e=>setBuckId(e.target.value)}>
              <option value="">— Not specified —</option>
              {availableBucks.map(b=><option key={b.id} value={b.id}>{b.name}{b.breed?` · ${b.breed}`:""}</option>)}
            </select>
          </Field>
          {kindleDate && (
            <div style={{padding:"10px 14px",background:palette.yolkSoft,borderRadius:8,fontSize:13,color:palette.ink,marginBottom:14}}>
              📅 Expected kindle: <strong>{fmtDate(kindleDate)}</strong> ({KINDLE_DAYS} days)
              <div style={{fontSize:11,color:palette.inkSoft,marginTop:4}}>A reminder will be added to your calendar after saving.</div>
            </div>
          )}
        </>
      )}
      {action==="litter" && (
        <div style={{display:"flex",gap:12}}>
          <div style={{flex:1}}><Field label="Kits alive"><input type="number" min={0} style={inputStyle} value={kitsAlive} onChange={e=>setKitsAlive(e.target.value)} placeholder="0" autoFocus/></Field></div>
          <div style={{flex:1}}><Field label="Stillborn"><input type="number" min={0} style={inputStyle} value={kitsStillborn} onChange={e=>setKitsStillborn(e.target.value)} placeholder="0"/></Field></div>
        </div>
      )}
      {action==="butcher" && (
        <>
          <Field label="Hanging weight (lbs)"><input type="number" min={0} step="0.1" style={inputStyle} value={weight} onChange={e=>setWeight(e.target.value)} placeholder="0" autoFocus/></Field>
          <Field label="Processing cost ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$0.00"/></Field>
        </>
      )}
      {action==="death" && (
        <Field label="Cause">
          <select style={inputStyle} value={cause} onChange={e=>setCause(e.target.value)}>
            {["Unknown","Disease","Predator","Heat stress","Cold","Injury","Kit loss","Other"].map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
      )}
      {isSale && (
        <>
          <Field label="Type">
            <select style={inputStyle} value={saleType} onChange={e=>setSaleType(e.target.value)}>
              <option value="sold">Sold</option>
              <option value="leased">Leased</option>
              <option value="rehomed">Rehomed (no payment)</option>
            </select>
          </Field>
          <Field label="Buyer / new home (optional)"><input style={inputStyle} value={saleBuyer} onChange={e=>setSaleBuyer(e.target.value)} placeholder="Name of buyer" autoFocus/></Field>
          {saleType!=="rehomed" && <Field label="Price ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={salePrice} onChange={e=>setSalePrice(e.target.value)} placeholder="$0.00"/></Field>}
        </>
      )}
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      {(isDeath||isSale)&&<div style={{fontSize:12,color:palette.inkSoft,marginBottom:10,padding:"8px 10px",background:palette.bgAlt,borderRadius:6,lineHeight:1.5}}>{animal.name} will move to your Archived rabbits list{isSale&&saleType!=="rehomed"?" and a sale record will appear in your Sales tab":""}. You can restore from there if this was a mistake.</div>}
      <Btn onClick={save} variant={isDeath?"danger":"primary"}>{(isDeath||isSale)?"Save & archive":"Save"}</Btn>
    </Modal>
  );
}

// ============================================================================
// ANIMAL CARD — single rabbit row with action buttons, recent activity,
// and pedigree button. Matches Pigs/Goats/Cows pattern.
// ============================================================================
function AnimalCard({animal,hobbyId,animals,entries,sales,hobby,update,setModal,hideHutchChip}){
  const[logAction,setLogAction]=useState(null);
  const[showPedigree,setShowPedigree]=useState(false);
  const[showHistory,setShowHistory]=useState(false);
  const animalEntries=entries.filter(e=>e.animalId===animal.id);
  const weightEntries=animalEntries.filter(e=>e.action==="weight").sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const latestWeight=weightEntries[0]?.weight||null;

  // Last breeding for does shows next-kindle pill
  const lastBred = animal.sex==="Doe"
    ? animalEntries.filter(e=>e.action==="bred").sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0]
    : null;
  const kindleStillUpcoming = lastBred?.kindleDate && lastBred.kindleDate >= todayStr();

  // Action set differs slightly by sex. Bred + litter only show for does.
  const baseActions = ["fed","weight","butcher","death","sale","note"];
  const doeActions = ["bred","litter"];
  const LOG_ACTIONS = animal.sex==="Doe" ? [...baseActions.slice(0,2), ...doeActions, ...baseActions.slice(2)] : baseActions;
  const actionLabels = {
    fed:"🌾 Feed", weight:"⚖️ Weight", bred:"🐇 Bred", litter:"🍼 Litter",
    butcher:"❄️ Butcher", death:"💀 Death", sale:"🏷️ Sale", note:"📓 Note",
  };
  const recentEntries=animalEntries.sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,3);

  // Friendly role label for the chip (strips parenthetical hint)
  const roleLabel = (RABBIT_ROLES.find(r=>r.key===animal.role)?.label || animal.role || "").replace(/\s*\(.*\)\s*/,"").trim();

  return(
    <div style={{background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:10}}>
      {logAction && <LogModal animal={animal} hobbyId={hobbyId} animals={animals} action={logAction} update={update} onClose={()=>setLogAction(null)}/>}
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
          species="rabbit"
          onClose={()=>setShowHistory(false)}
        />
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:18}}>🐇</span>
            <span style={{fontWeight:700,fontSize:15,color:palette.ink}}>{animal.name}</span>
            {animal.breed && <span style={{fontSize:11,background:palette.bgAlt,padding:"2px 8px",borderRadius:4,color:palette.inkSoft}}>{animal.breed}</span>}
            <span style={{fontSize:11,background:palette.bgAlt,padding:"2px 8px",borderRadius:4,color:palette.inkSoft}}>{animal.sex}</span>
            {roleLabel && roleLabel !== animal.sex && <span style={{fontSize:11,background:palette.bgAlt,padding:"2px 8px",borderRadius:4,color:palette.inkSoft}}>{roleLabel}</span>}
            {animal.hutch && !hideHutchChip && <span style={{fontSize:11,background:palette.leafSoft,padding:"2px 8px",borderRadius:4,color:palette.ink}}>{animal.hutch}</span>}
            {kindleStillUpcoming && <span style={{fontSize:11,background:palette.yolkSoft,padding:"2px 8px",borderRadius:4,color:palette.ink,fontWeight:600}}>🍼 {fmtDate(lastBred.kindleDate)}</span>}
          </div>
          {animal.birthdate && <div style={{fontSize:11,color:palette.inkSoft,marginTop:2,marginLeft:26}}>Born {fmtDate(animal.birthdate)}</div>}
        </div>
        <button onClick={()=>setModal({type:"editAnimal",hobbyId,animalId:animal.id})} style={{background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,padding:4}} aria-label="Edit"><Edit3 size={14}/></button>
      </div>
      {latestWeight && (
        <div style={{background:palette.bgAlt,borderRadius:8,padding:"8px 12px",marginBottom:10,display:"flex",gap:16,flexWrap:"wrap"}}>
          <div style={{fontSize:12,color:palette.ink}}><span style={{color:palette.inkSoft}}>Current: </span><strong>{fmtWeight(Number(latestWeight)||0)}</strong></div>
        </div>
      )}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:recentEntries.length>0?10:0}}>
        {LOG_ACTIONS.map(a=>(
          <button key={a} onClick={()=>setLogAction(a)} style={{padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.ink}}>{actionLabels[a]}</button>
        ))}
        <button onClick={()=>setShowPedigree(true)} style={{padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.ink}}>🧬 Pedigree</button>
        <button onClick={()=>setShowHistory(true)} style={{padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.ink}}>📜 History</button>
      </div>
      {recentEntries.length>0 && (
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          {recentEntries.map(e=>{
            let detail="";
            if(e.action==="fed"){
              const u=e.feedUnit||"lbs";
              const a=u==="cups"?(Number(e.feedAmount)||0):(Number(e.lbs)||Number(e.feedAmount)||0);
              const amtLabel=u==="cups"?fmtCups(a):fmtWeight(a);
              detail=`${amtLabel}${e.cost>0?` · ${fmtMoney(e.cost)}`:""}`;
            }
            else if(e.action==="weight")detail=fmtWeight(Number(e.weight)||0);
            else if(e.action==="bred")detail=`${e.buckName?"sire: "+e.buckName+" · ":""}kindle ${fmtDate(e.kindleDate)}`;
            else if(e.action==="litter")detail=`${e.kitsAlive||0} alive${e.kitsStillborn>0?` · ${e.kitsStillborn} stillborn`:""}`;
            else if(e.action==="butcher")detail=`${fmtWeight(Number(e.weight)||0)}${e.cost>0?` · ${fmtMoney(e.cost)}`:""}`;
            else if(e.action==="death")detail=e.cause||"unknown";
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

// ============================================================================
// LEGACY LOG — pre-migration entries grouped by their original hutch.
// Read-only display so users don't lose their history. Includes a delete
// button per entry in case they want to clean up after migration.
// ============================================================================
function LegacyLogSection({hutches, entries, hobbyId, update}){
  // Only entries that reference a legacy hatchId AND don't have a new-style
  // animalId. Anything logged after migration uses animalId only.
  const legacy = entries.filter(e => e.hatchId && !e.animalId);
  if (legacy.length === 0 || hutches.length === 0) return null;

  // Group by hutch.
  const byHutch = {};
  hutches.forEach(h => { byHutch[h.id] = { hutch: h, entries: [] }; });
  // Orphaned-hutch bucket for entries pointing to a deleted hutch.
  byHutch.__orphan = { hutch: { id:"__orphan", name:"(unknown hutch)" }, entries: [] };
  legacy.forEach(e => {
    if (byHutch[e.hatchId]) byHutch[e.hatchId].entries.push(e);
    else byHutch.__orphan.entries.push(e);
  });

  const labels = {bred:"🐇 Breeding",litter:"🍼 Litter",fed:"🌾 Fed",watered:"💧 Watered",butcher:"❄️ Butchered",death:"💀 Death",free_range:"🌿 Free range",infrastructure:"🔨 Infrastructure",note:"📓 Note"};

  const deleteEntry = (id) => {
    update(d=>{
      d.entries[hobbyId] = (d.entries[hobbyId]||[]).filter(e=>e.id!==id);
      return d;
    });
  };

  return (
    <details style={{marginTop:18}}>
      <summary style={{cursor:"pointer",color:palette.inkSoft,fontSize:13,padding:8,background:palette.bgAlt,borderRadius:8,userSelect:"none"}}>
        Legacy log entries ({legacy.length}) — from before per-rabbit tracking
      </summary>
      <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:12}}>
        <div style={{padding:"10px 12px",background:palette.bgAlt,borderRadius:8,fontSize:12,color:palette.inkSoft,lineHeight:1.5}}>
          These entries were logged against your old hutches before this update. They still count toward your stats. You can delete them individually if they're no longer useful.
        </div>
        {Object.values(byHutch).filter(g=>g.entries.length>0).map(group => (
          <div key={group.hutch.id} style={{background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:10,padding:12}}>
            <div style={{fontFamily:FONT_DISPLAY,fontSize:16,color:palette.ink,marginBottom:8}}>{group.hutch.name}</div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {group.entries.sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(e=>{
                let detail = "";
                if(e.action==="bred") detail = `kindle ${fmtDate(e.kindleDate)}${e.doeName?" · "+e.doeName:""}`;
                else if(e.action==="litter") detail = `${e.kitsAlive||0} alive${e.kitsStillborn>0?` · ${e.kitsStillborn} stillborn`:""}`;
                else if(e.action==="fed") {
                  const u=e.feedUnit||"lbs";
                  const a=u==="cups"?(Number(e.feedAmount)||0):(Number(e.lbs)||Number(e.feedAmount)||0);
                  const amtLabel=u==="cups"?fmtCups(a):fmtWeight(a);
                  detail = `${amtLabel} · ${fmtMoney(e.cost)}`;
                }
                else if(e.action==="butcher") detail = `${e.count||0} · avg ${fmtWeight(Number(e.avgWeight)||0)}`;
                else if(e.action==="death") detail = `${e.count||1} · ${e.cause||"unknown"}`;
                else if(e.action==="infrastructure") detail = `${e.item||""} · ${fmtMoney(e.cost)}`;
                else if(e.note) detail = e.note.length>50 ? e.note.slice(0,50)+"…" : e.note;
                return (
                  <div key={e.id} style={{fontSize:12,color:palette.inkSoft,padding:"6px 8px",background:palette.bgAlt,borderRadius:6,display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
                    <span>{fmtDate(e.date)} · {labels[e.action]||e.action}{detail?" · "+detail:""}</span>
                    <button onClick={()=>deleteEntry(e.id)} aria-label="Delete entry" style={{background:"none",border:"none",cursor:"pointer",color:palette.accent,fontSize:11,padding:"0 2px",lineHeight:1}}>✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

// ============================================================================
// MODAL ROUTER — handles addAnimal / editAnimal local modals
// ============================================================================
function RabbitsModalRouter({modal,hobby,update,onClose}){
  if(!modal)return null;
  if(modal.type==="addAnimal")return <AnimalModal hobbyId={hobby.id} animals={hobby.animals||[]} update={update} onClose={onClose}/>;
  if(modal.type==="editAnimal"){
    const animal=(hobby.animals||[]).find(a=>a.id===modal.animalId);
    if(!animal){onClose();return null;}
    return <AnimalModal animal={animal} hobbyId={hobby.id} animals={hobby.animals||[]} update={update} onClose={onClose}/>;
  }
  return null;
}

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function RabbitsPage({hobby,data,update}){
  // Run migration once on mount. useEffect ensures we don't loop on the
  // update-triggered re-render — the flag check inside guards against it.
  useEffect(() => {
    runMigrationIfNeeded(data, hobby, update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const[localModal,setLocalModal]=useState(null);
  const entries=data.entries[hobby.id]||[];
  const allAnimals=hobby.animals||[];
  const animals=allAnimals.filter(a=>!a.archived);
  const archived=allAnimals.filter(a=>a.archived);
  const hutches=hobby.hutches||[];

  const does = animals.filter(a=>a.sex==="Doe").length;
  const bucks = animals.filter(a=>a.sex==="Buck").length;

  return(
    <div>
      <RabbitsModalRouter modal={localModal} hobby={hobby} update={update} onClose={()=>setLocalModal(null)}/>

      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
        <StatCard label="Does" value={does} accent={palette.leaf}/>
        <StatCard label="Bucks" value={bucks} accent={palette.feather}/>
        <StatCard label="Total" value={animals.length} sub="live rabbits" accent={palette.accent}/>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink}}>Your rabbits</div>
        <button onClick={()=>setLocalModal({type:"addAnimal",hobbyId:hobby.id})} style={{padding:"7px 14px",borderRadius:8,background:palette.yolk,border:`1.5px solid ${palette.ink}`,fontFamily:FONT_BODY,fontWeight:600,fontSize:13,cursor:"pointer",color:palette.ink,display:"flex",alignItems:"center",gap:6}}><Plus size={14}/>Add rabbit</button>
      </div>

      {animals.length===0 ? (
        <div style={{padding:28,background:palette.card,border:`2px dashed ${palette.line}`,borderRadius:12,textAlign:"center",color:palette.inkSoft}}>
          <div style={{fontSize:36,marginBottom:10}}>🐇</div>
          <div style={{fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink,marginBottom:6}}>No rabbits yet</div>
          <div style={{fontSize:13,marginBottom:14}}>Add your first rabbit to track breeding, growth, and butcher stats.</div>
          <button onClick={()=>setLocalModal({type:"addAnimal",hobbyId:hobby.id})} style={{padding:"10px 18px",borderRadius:8,background:palette.yolk,border:`1.5px solid ${palette.ink}`,fontFamily:FONT_BODY,fontWeight:600,fontSize:14,cursor:"pointer",color:palette.ink}}>Add first rabbit</button>
        </div>
      ) : (
        // Group by hutch when 2+ distinct hutch labels exist among live
        // rabbits. With 0 or 1 hutch, a flat list is cleaner — no point
        // adding section headers for a tiny setup. Rabbits without a hutch
        // label end up in a "Not assigned to a hutch" bucket so they're
        // still visible.
        (() => {
          const hutchLabels = Array.from(new Set(animals.map(a => (a.hutch || "").trim()).filter(Boolean)));
          if (hutchLabels.length < 2) {
            // Flat list — keep showing the hutch chip on the card since
            // there's no section header to convey it.
            return animals.map(a => (
              <AnimalCard
                key={a.id}
                animal={a}
                hobbyId={hobby.id}
                animals={allAnimals}
                entries={entries}
                sales={data.sales||[]}
                hobby={hobby}
                update={update}
                setModal={setLocalModal}
              />
            ));
          }
          // Grouped list. Sort hutch labels alphabetically; unassigned bucket
          // goes last so the user's named groupings come first.
          hutchLabels.sort((a, b) => a.localeCompare(b));
          const unassigned = animals.filter(a => !(a.hutch || "").trim());
          return (
            <>
              {hutchLabels.map(label => {
                const hutchAnimals = animals.filter(a => (a.hutch || "").trim() === label);
                if (hutchAnimals.length === 0) return null;
                const hutchDoes = hutchAnimals.filter(a=>a.sex==="Doe").length;
                const hutchBucks = hutchAnimals.filter(a=>a.sex==="Buck").length;
                return (
                  <div key={label} style={{marginBottom:18}}>
                    <div style={{
                      display:"flex",alignItems:"baseline",gap:10,
                      padding:"8px 12px",marginBottom:10,
                      background:palette.leafSoft,
                      border:`1.5px solid ${palette.line}`,
                      borderRadius:8,
                    }}>
                      <div style={{fontFamily:FONT_DISPLAY,fontSize:17,color:palette.ink}}>{label}</div>
                      <div style={{fontSize:11,color:palette.inkSoft}}>
                        {hutchAnimals.length} rabbit{hutchAnimals.length!==1?"s":""}
                        {hutchDoes>0 && ` · ${hutchDoes} doe${hutchDoes!==1?"s":""}`}
                        {hutchBucks>0 && ` · ${hutchBucks} buck${hutchBucks!==1?"s":""}`}
                      </div>
                    </div>
                    {hutchAnimals.map(a => (
                      <AnimalCard
                        key={a.id}
                        animal={a}
                        hobbyId={hobby.id}
                        animals={allAnimals}
                        entries={entries}
                        sales={data.sales||[]}
                        hobby={hobby}
                        update={update}
                        setModal={setLocalModal}
                        hideHutchChip
                      />
                    ))}
                  </div>
                );
              })}
              {unassigned.length > 0 && (
                <div style={{marginBottom:18}}>
                  <div style={{
                    display:"flex",alignItems:"baseline",gap:10,
                    padding:"8px 12px",marginBottom:10,
                    background:palette.bgAlt,
                    border:`1.5px dashed ${palette.line}`,
                    borderRadius:8,
                  }}>
                    <div style={{fontFamily:FONT_DISPLAY,fontSize:17,color:palette.inkSoft}}>Not assigned to a hutch</div>
                    <div style={{fontSize:11,color:palette.inkSoft}}>
                      {unassigned.length} rabbit{unassigned.length!==1?"s":""}
                    </div>
                  </div>
                  {unassigned.map(a => (
                    <AnimalCard
                      key={a.id}
                      animal={a}
                      hobbyId={hobby.id}
                      animals={allAnimals}
                      entries={entries}
                      sales={data.sales||[]}
                      hobby={hobby}
                      update={update}
                      setModal={setLocalModal}
                      hideHutchChip
                    />
                  ))}
                </div>
              )}
            </>
          );
        })()
      )}

      {archived.length>0 && (
        <details style={{marginTop:18}}>
          <summary style={{cursor:"pointer",color:palette.inkSoft,fontSize:13,padding:8,background:palette.bgAlt,borderRadius:8,userSelect:"none"}}>
            Archived rabbits ({archived.length}) — tap to view
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

      <LegacyLogSection hutches={hutches} entries={entries} hobbyId={hobby.id} update={update}/>
    </div>
  );
}

// ============================================================================
// ANALYTICS — totals over animals + legacy entries (so historical data
// still counts), but breakdowns now use the per-animal data when available.
// ============================================================================
export function RabbitsAnalytics({hobby,entries}){
  const animals=(hobby.animals||[]).filter(a=>!a.archived);
  const allLitters = entries.filter(e=>e.action==="litter");
  const allBreedings = entries.filter(e=>e.action==="bred");
  const allButcher = entries.filter(e=>e.action==="butcher");
  const allDeaths = entries.filter(e=>e.action==="death");
  const allFeed = entries.filter(e=>e.action==="fed");
  const allInfra = entries.filter(e=>e.action==="infrastructure");

  const totalLitters = allLitters.length;
  const totalKitsAlive = allLitters.reduce((s,e)=>s+(Number(e.kitsAlive)||0),0);
  const totalStillborn = allLitters.reduce((s,e)=>s+(Number(e.kitsStillborn)||0),0);
  const totalKitsBorn = totalKitsAlive + totalStillborn;
  const avgLitterSize = totalLitters > 0 ? (totalKitsAlive/totalLitters).toFixed(1) : "—";
  const stillbornRate = totalKitsBorn > 0 ? ((totalStillborn/totalKitsBorn)*100).toFixed(1) : "0";
  const breedingSuccessRate = allBreedings.length > 0 ? ((totalLitters/allBreedings.length)*100).toFixed(0) : "—";

  // Butcher entries: new shape uses `weight` (single rabbit); legacy uses
  // `count` + `avgWeight` (aggregate from a hutch). Handle both.
  const totalButchered = allButcher.reduce((s,e)=>{
    if (e.count != null) return s + (Number(e.count)||0);   // legacy
    return s + 1;                                            // new per-rabbit
  },0);
  const totalMeatLbs = allButcher.reduce((s,e)=>{
    if (e.count != null) return s + (Number(e.count)||0)*(Number(e.avgWeight)||0); // legacy
    return s + (Number(e.weight)||0);                                              // new
  },0);
  const avgButcherWeight = totalButchered > 0 ? (totalMeatLbs/totalButchered).toFixed(2) : "—";

  const totalDeaths = allDeaths.reduce((s,e)=>s+(Number(e.count)||1),0);
  const feedCost = allFeed.reduce((s,e)=>s+(Number(e.cost)||0),0);
  const infraCost = allInfra.reduce((s,e)=>s+(Number(e.cost)||0),0);
  const totalCost = feedCost + infraCost;
  const costPerRabbit = totalButchered > 0 ? (totalCost/totalButchered).toFixed(2) : "—";

  const deathCauses = {};
  allDeaths.forEach(e => { const c = e.cause || "Unknown"; deathCauses[c] = (deathCauses[c]||0) + (Number(e.count)||1); });

  // Per-doe litter count (uses new animalId; legacy litter entries aren't
  // attributed to an animal, so they won't appear here).
  const littersByDoe = animals
    .filter(a=>a.sex==="Doe")
    .map(a => ({ name: a.name, kits: entries.filter(e=>e.animalId===a.id&&e.action==="litter").reduce((s,e)=>s+(Number(e.kitsAlive)||0),0) }))
    .filter(d => d.kits > 0);

  if (animals.length === 0 && entries.length === 0) return (
    <div style={{padding:32,background:palette.card,border:`1.5px dashed ${palette.line}`,borderRadius:12,textAlign:"center",color:palette.inkSoft}}>No rabbit data yet. Add a rabbit and start logging.</div>
  );

  return (
    <div>
      <h3 style={{fontFamily:FONT_DISPLAY,fontSize:20,margin:"0 0 12px",color:palette.ink}}>breeding</h3>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
        <StatCard label="Total litters" value={totalLitters} accent={palette.leaf}/>
        <StatCard label="Avg litter size" value={avgLitterSize} sub="kits alive" accent={palette.leaf}/>
        <StatCard label="Breeding success" value={breedingSuccessRate !== "—" ? breedingSuccessRate+"%" : "—"} sub="breedings → litters" accent={palette.feather}/>
        <StatCard label="Stillborn rate" value={stillbornRate+"%"} sub={`${totalStillborn} of ${totalKitsBorn} kits`} accent={totalStillborn > 0 ? palette.accent : palette.inkSoft}/>
      </div>
      <h3 style={{fontFamily:FONT_DISPLAY,fontSize:20,margin:"0 0 12px",color:palette.ink}}>meat production</h3>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
        <StatCard label="Butchered" value={totalButchered} accent={palette.ink}/>
        <StatCard label="Avg final weight" value={avgButcherWeight !== "—" ? fmtWeight(Number(avgButcherWeight)||0) : "—"} accent={palette.feather}/>
        <StatCard label="Total meat" value={totalMeatLbs > 0 ? fmtWeight(totalMeatLbs) : "—"} accent={palette.leaf}/>
        {totalDeaths > 0 && <StatCard label="Deaths" value={totalDeaths} accent={palette.accent}/>}
      </div>
      <h3 style={{fontFamily:FONT_DISPLAY,fontSize:20,margin:"0 0 12px",color:palette.ink}}>costs</h3>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
        <StatCard label="Total cost" value={fmtMoney(totalCost)} accent={palette.accent}/>
        <StatCard label="Feed cost" value={fmtMoney(feedCost)} accent={palette.feather}/>
        {infraCost > 0 && <StatCard label="Infrastructure" value={fmtMoney(infraCost)} accent={palette.feather}/>}
        <StatCard label="Cost / rabbit" value={costPerRabbit !== "—" ? fmtMoney(Number(costPerRabbit)) : "—"} sub="all-in" accent={palette.yolk}/>
      </div>
      {littersByDoe.length > 1 && (
        <ChartCard title="Kits born by doe">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={littersByDoe}>
              <XAxis dataKey="name" stroke={palette.inkSoft} fontSize={11}/>
              <YAxis stroke={palette.inkSoft} fontSize={11}/>
              <Tooltip contentStyle={{background:palette.card,border:`1.5px solid ${palette.ink}`,borderRadius:8}}/>
              <Bar dataKey="kits" fill={palette.leaf} radius={[6,6,0,0]} name="Kits alive"/>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
      {Object.keys(deathCauses).length > 0 && (
        <ChartCard title={`Deaths by cause (${totalDeaths} total)`}>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {Object.entries(deathCauses).sort((a,b)=>b[1]-a[1]).map(([cause,count]) => (
              <div key={cause} style={{display:"flex",justifyContent:"space-between",padding:"8px 10px",background:palette.bgAlt,borderRadius:6,fontSize:13}}>
                <span style={{textTransform:"capitalize"}}>{cause}</span><strong>{count}</strong>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}
