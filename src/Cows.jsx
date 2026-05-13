// ============================================================================
// COWS — per-animal tracking, dairy or beef, milk/calves/butcher logging
// ============================================================================
import React, { useState } from "react";
import { X, Edit3, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { SireDamPicker, PedigreeView } from "./PedigreeView.jsx";
import { AnimalHistoryView } from "./AnimalHistoryView.jsx";

const palette = {
  bg:"#F4EDE0",bgAlt:"#EBE0CC",ink:"#2C1810",inkSoft:"#5C4530",
  accent:"#C84B31",leaf:"#5A7A3C",yolk:"#E8B547",feather:"#8B6F47",
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

const COW_BREEDS=["Angus","Hereford","Holstein","Jersey","Simmental","Charolais","Longhorn","Dexter","Highland","Brown Swiss","Guernsey","Limousin","Red Angus","Shorthorn","Mixed","Other"];
const COW_PURPOSES=["Dairy","Beef","Both"];
const COW_SEXES=["Cow","Bull","Steer","Heifer","Calf"];

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

function AnimalModal({animal,hobbyId,animals,update,onClose}){
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
    update(d=>{const h=d.hobbies.find(x=>x.id===hobbyId);if(!h)return d;if(!Array.isArray(h.animals))h.animals=[];const data={id,name:name.trim(),breed:finalBreed,purpose,sex,dob,tagId,notes,sireId:sireId||null,sire:sire.trim(),damId:damId||null,dam:dam.trim(),registryNumber:registryNumber.trim(),registryName:registryName.trim(),created:animal?.created||Date.now(),archived:animal?.archived||false,archivedReason:animal?.archivedReason,archivedDate:animal?.archivedDate};if(isEdit){const idx=h.animals.findIndex(a=>a.id===id);if(idx!==-1)h.animals[idx]=data;else h.animals.push(data);}else h.animals.push(data);return d;});
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
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Color, markings, notes..."/></Field>

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

function LogModal({animal,hobbyId,action,update,onClose}){
  const[date,setDate]=useState(todayStr());
  const[gallons,setGallons]=useState("");
  const[lbs,setLbs]=useState("");
  const[cost,setCost]=useState("");
  const[count,setCount]=useState("");
  const[weight,setWeight]=useState("");
  const[notes,setNotes]=useState("");
  // Death-only: optional cause. Stored on the entry AND folded into archivedReason
  // so the existing "Archived cattle" section reads "Died: predator" etc.
  const[cause,setCause]=useState("");
  // Sale-only: buyer name, sale price, sold-vs-rehomed. On save these archive
  // the animal AND create a `data.sales[]` entry shaped like the existing
  // horse-sale shape so it shows up in the Sales tab.
  const[saleBuyer,setSaleBuyer]=useState("");
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
  const save=()=>{
    const entry={id:newId(),date,action,animalId:animal.id,animalName:animal.name,notes,created:Date.now()};
    if(action==="milk")entry.gallons=Number(gallons)||0;
    if(action==="fed"){entry.lbs=Number(lbs)||0;entry.cost=Number(cost)||0;}
    if(action==="calf")entry.count=Number(count)||1;
    if(action==="weight"||action==="butcher")entry.weight=Number(weight)||0;
    if(action==="butcher")entry.cost=Number(cost)||0;
    if(action==="death")entry.cause=cause.trim();
    if(action==="sale"){entry.buyer=saleBuyer.trim();entry.price=Number(salePrice)||0;entry.saleType=saleType;}
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
        d.sales.push({
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
          notes:notes||"",
        });
      }
      return d;
    });
    onClose();
  };
  const titles={milk:"Log milk",fed:"Log feed",calf:"Log calf born",weight:"Log weight",health:"Health check",butcher:"Log butcher",death:"Log death",sale:"Log sale",note:"Add note"};
  const isDeath=action==="death";
  const isSale=action==="sale";
  return(
    <Modal open onClose={onClose} title={`${titles[action]||"Log"} — ${animal.name}`}>
      <Field label="Date"><input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)}/></Field>
      {action==="milk"&&<Field label="Milk (gallons)"><input type="number" min={0} step="0.1" style={inputStyle} value={gallons} onChange={e=>setGallons(e.target.value)} placeholder="0" autoFocus/>{gallons&&<div style={{fontSize:12,color:palette.inkSoft,marginTop:4}}>{(Number(gallons)*3.785).toFixed(1)} liters · {(Number(gallons)*128).toFixed(0)} oz</div>}</Field>}
      {action==="fed"&&<div style={{display:"flex",gap:12}}><div style={{flex:1}}><Field label="Feed (lbs)"><input type="number" min={0} step="0.1" style={inputStyle} value={lbs} onChange={e=>setLbs(e.target.value)} placeholder="0"/></Field></div><div style={{flex:1}}><Field label="Cost ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$0.00"/></Field></div></div>}
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
      {(action==="weight"||action==="butcher")&&<Field label="Weight (lbs)"><input type="number" min={0} step="1" style={inputStyle} value={weight} onChange={e=>setWeight(e.target.value)} placeholder="0" autoFocus/></Field>}
      {action==="butcher"&&<Field label="Processing cost ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$0.00"/></Field>}
      {isDeath&&<Field label="Cause (optional)"><input style={inputStyle} value={cause} onChange={e=>setCause(e.target.value)} placeholder="predator, illness, unknown..." autoFocus/></Field>}
      {isSale&&<>
        <Field label="Type"><select style={inputStyle} value={saleType} onChange={e=>setSaleType(e.target.value)}><option value="sold">Sold</option><option value="leased">Leased</option><option value="rehomed">Rehomed (no payment)</option></select></Field>
        <Field label="Buyer / new home (optional)"><input style={inputStyle} value={saleBuyer} onChange={e=>setSaleBuyer(e.target.value)} placeholder="Name of buyer" autoFocus/></Field>
        {saleType!=="rehomed"&&<Field label="Price ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={salePrice} onChange={e=>setSalePrice(e.target.value)} placeholder="$0.00"/></Field>}
      </>}
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      {isDeath&&<div style={{fontSize:12,color:palette.inkSoft,marginBottom:10,padding:"8px 10px",background:palette.bgAlt,borderRadius:6,lineHeight:1.5}}>{animal.name} will move to your Archived cattle list. You can restore from there if this was a mistake.</div>}
      {isSale&&<div style={{fontSize:12,color:palette.inkSoft,marginBottom:10,padding:"8px 10px",background:palette.bgAlt,borderRadius:6,lineHeight:1.5}}>{animal.name} will move to your Archived cattle list and {saleType!=="rehomed"?"a sale record will appear in your Sales tab":"be marked as rehomed"}. You can restore from there if this was a mistake.</div>}
      <Btn onClick={save} variant={isDeath?"danger":"primary"}>{(isDeath||isSale)?"Save & archive":"Save"}</Btn>
    </Modal>
  );
}

function AnimalCard({animal,hobbyId,animals,entries,sales,hobby,update,setModal}){
  const[logAction,setLogAction]=useState(null);
  const[showPedigree,setShowPedigree]=useState(false);
  const[showHistory,setShowHistory]=useState(false);
  const animalEntries=entries.filter(e=>e.animalId===animal.id);
  const today=todayStr();
  const milkEntries=animalEntries.filter(e=>e.action==="milk");
  const totalMilkGal=milkEntries.reduce((s,e)=>s+(Number(e.gallons)||0),0);
  const todayMilk=milkEntries.filter(e=>e.date===today).reduce((s,e)=>s+(Number(e.gallons)||0),0);
  const purposeColor={Dairy:palette.leaf,Beef:palette.accent,Both:palette.feather};
  const LOG_ACTIONS=animal.purpose==="Beef"?["fed","weight","health","butcher","death","sale","note"]:animal.purpose==="Dairy"?["milk","fed","calf","health","death","sale","note"]:["milk","fed","calf","weight","health","butcher","death","sale","note"];
  const actionLabels={milk:"🥛 Milk",fed:"🌾 Feed",calf:"🍼 Calf",weight:"⚖️ Weight",health:"💊 Health",butcher:"🔪 Butcher",death:"💀 Death",sale:"🏷️ Sale",note:"📓 Note"};
  const recentEntries=animalEntries.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
  return(
    <div style={{background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:10}}>
      {logAction&&<LogModal animal={animal} hobbyId={hobbyId} action={logAction} update={update} onClose={()=>setLogAction(null)}/>}
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
            <span style={{fontSize:18}}>🐄</span>
            <span style={{fontWeight:700,fontSize:15,color:palette.ink}}>{animal.name}</span>
            <span style={{fontSize:11,background:palette.bgAlt,padding:"2px 8px",borderRadius:4,color:palette.inkSoft}}>{animal.breed}</span>
            <span style={{fontSize:11,background:purposeColor[animal.purpose]+"25",padding:"2px 8px",borderRadius:4,color:purposeColor[animal.purpose],fontWeight:600}}>{animal.purpose}</span>
            {animal.tagId&&<span style={{fontSize:11,color:palette.inkSoft}}>#{animal.tagId}</span>}
          </div>
          {animal.dob&&<div style={{fontSize:11,color:palette.inkSoft,marginTop:2,marginLeft:26}}>Born {fmtDate(animal.dob)}</div>}
        </div>
        <button onClick={()=>setModal({type:"editAnimal",hobbyId,animalId:animal.id})} style={{background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,padding:4}}><Edit3 size={14}/></button>
      </div>
      {(animal.purpose==="Dairy"||animal.purpose==="Both")&&(
        <div style={{background:palette.bgAlt,borderRadius:8,padding:"8px 12px",marginBottom:10,display:"flex",gap:16,flexWrap:"wrap"}}>
          <div style={{fontSize:12,color:palette.ink}}><span style={{color:palette.inkSoft}}>Today: </span><strong>{todayMilk>0?`${todayMilk} gal`:"—"}</strong></div>
          <div style={{fontSize:12,color:palette.ink}}><span style={{color:palette.inkSoft}}>All-time: </span><strong>{totalMilkGal>0?`${totalMilkGal.toFixed(1)} gal`:"—"}</strong></div>
        </div>
      )}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:recentEntries.length>0?10:0}}>
        {LOG_ACTIONS.map(a=><button key={a} onClick={()=>setLogAction(a)} style={{padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.ink}}>{actionLabels[a]}</button>)}
        <button onClick={()=>setShowPedigree(true)} style={{padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.ink}}>🧬 Pedigree</button>
        <button onClick={()=>setShowHistory(true)} style={{padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.ink}}>📜 History</button>
      </div>
      {recentEntries.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          {recentEntries.map(e=>{
            let detail="";
            if(e.action==="milk")detail=`${e.gallons} gal`;
            else if(e.action==="fed")detail=`${e.lbs} lbs${e.cost>0?` · ${fmtMoney(e.cost)}`:""}`;
            else if(e.action==="calf")detail=`${e.count} calf`;
            else if(e.action==="weight"||e.action==="butcher")detail=`${e.weight} lbs`;
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

export function CowsAnalytics({hobby,entries}){
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
  return(
    <div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
        <StatCard label="Total milk" value={`${totalMilkGal.toFixed(1)} gal`} accent={palette.leaf}/>
        <StatCard label="Animals" value={animals.length} accent={palette.ink}/>
        <StatCard label="Calves born" value={totalCalves} accent={palette.yolk}/>
        <StatCard label="Feed cost" value={fmtMoney(totalFeedCost)} accent={palette.feather}/>
        {butcherEntries.length>0&&<StatCard label="Butchered" value={butcherEntries.length} sub={`${totalMeatLbs.toFixed(0)} lbs`} accent={palette.accent}/>}
        {fcr!=="—"&&<StatCard label="FCR" value={fcr} sub="lbs feed / lb meat" accent={palette.feather}/>}
      </div>
      {milkTrend.length>1&&<ChartCard title="🥛 Daily milk (gallons)"><ResponsiveContainer width="100%" height={180}><BarChart data={milkTrend}><XAxis dataKey="date" stroke={palette.inkSoft} fontSize={11}/><YAxis stroke={palette.inkSoft} fontSize={11}/><Tooltip contentStyle={{background:palette.card,border:`1.5px solid ${palette.ink}`,borderRadius:8}} formatter={v=>[`${v} gal`,"Milk"]}/><Bar dataKey="gal" fill={palette.leaf} radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></ChartCard>}
      {milkChart.length>1&&<ChartCard title="🐄 Milk by animal"><div style={{display:"flex",flexDirection:"column",gap:6}}>{milkChart.map(a=><div key={a.name} style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",background:palette.bgAlt,borderRadius:8,fontSize:13}}><span>🐄 {a.name}</span><strong>{a.gal} gal</strong></div>)}</div></ChartCard>}
      {animals.length===0&&<div style={{padding:24,textAlign:"center",color:palette.inkSoft,fontSize:13}}>No cow entries yet.</div>}
    </div>
  );
}

function CowModalRouter({modal,hobby,update,onClose}){
  if(!modal)return null;
  if(modal.type==="addAnimal")return <AnimalModal hobbyId={hobby.id} animals={hobby.animals||[]} update={update} onClose={onClose}/>;
  if(modal.type==="editAnimal"){const animal=(hobby.animals||[]).find(a=>a.id===modal.animalId);if(!animal){onClose();return null;}return <AnimalModal animal={animal} hobbyId={hobby.id} animals={hobby.animals||[]} update={update} onClose={onClose}/>;}
  return null;
}

export default function CowsPage({hobby,data,update}){
  const[localModal,setLocalModal]=useState(null);
  const entries=data.entries[hobby.id]||[];
  const allAnimals=hobby.animals||[];
  const animals=allAnimals.filter(a=>!a.archived);
  const archived=allAnimals.filter(a=>a.archived);
  return(
    <div>
      <CowModalRouter modal={localModal} hobby={hobby} update={update} onClose={()=>setLocalModal(null)}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink}}>Your cattle</div>
        <button onClick={()=>setLocalModal({type:"addAnimal",hobbyId:hobby.id})} style={{padding:"7px 14px",borderRadius:8,background:palette.yolk,border:`1.5px solid ${palette.ink}`,fontFamily:FONT_BODY,fontWeight:600,fontSize:13,cursor:"pointer",color:palette.ink,display:"flex",alignItems:"center",gap:6}}><Plus size={14}/>Add cow</button>
      </div>
      {animals.length===0?(
        <div style={{padding:28,background:palette.card,border:`2px dashed ${palette.line}`,borderRadius:12,textAlign:"center",color:palette.inkSoft}}>
          <div style={{fontSize:36,marginBottom:10}}>🐄</div>
          <div style={{fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink,marginBottom:6}}>No cattle yet</div>
          <div style={{fontSize:13,marginBottom:14}}>Add your first cow to start tracking milk, feed, and calves.</div>
          <button onClick={()=>setLocalModal({type:"addAnimal",hobbyId:hobby.id})} style={{padding:"10px 18px",borderRadius:8,background:palette.yolk,border:`1.5px solid ${palette.ink}`,fontFamily:FONT_BODY,fontWeight:600,fontSize:14,cursor:"pointer",color:palette.ink}}>Add first cow</button>
        </div>
      ):animals.map(a=><AnimalCard key={a.id} animal={a} hobbyId={hobby.id} animals={allAnimals} entries={entries} sales={data.sales||[]} hobby={hobby} update={update} setModal={setLocalModal}/>)}

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
