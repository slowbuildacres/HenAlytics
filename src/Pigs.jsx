// ============================================================================
// PIGS — per-animal tracking, growth monitoring, FCR, litters, butcher
// ============================================================================
import React, { useState } from "react";
import { X, Edit3, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
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

const PIG_BREEDS=["Berkshire","Duroc","Hampshire","Yorkshire","Landrace","Tamworth","Spotted","Mangalitsa","Kunekune","Chester White","Poland China","American Guinea Hog","Mixed","Other"];
const PIG_SEXES=["Sow","Boar","Barrow","Gilt","Piglet"];

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
  const initIsKnown = PIG_BREEDS.includes(initBreed);
  const[breedSelect,setBreedSelect]=useState(initBreed && initIsKnown ? initBreed : (initBreed ? "Other" : "Mixed"));
  const[breedCustom,setBreedCustom]=useState(initBreed && !initIsKnown ? initBreed : "");
  const finalBreed = breedSelect === "Other" ? breedCustom.trim() : breedSelect;
  const[sex,setSex]=useState(animal?.sex||"Barrow");
  const[dob,setDob]=useState(animal?.dob||"");
  const[startWeight,setStartWeight]=useState(animal?.startWeight!=null?String(animal.startWeight):"");
  const[notes,setNotes]=useState(animal?.notes||"");
  const[confirmDelete,setConfirmDelete]=useState(false);
  // Push 7a — pedigree fields. Sow/Gilt for dam (Gilt = young female who can
  // still be a mother); Boar for sire (Barrow is castrated, not viable).
  const [sireId, setSireId] = useState(animal?.sireId || "");
  const [sire, setSire] = useState(animal?.sire || "");
  const [damId, setDamId] = useState(animal?.damId || "");
  const [dam, setDam] = useState(animal?.dam || "");
  const [registryNumber, setRegistryNumber] = useState(animal?.registryNumber || "");
  const [registryName, setRegistryName] = useState(animal?.registryName || "");
  const save=()=>{
    if(!name.trim())return;
    const id=animal?.id||newId();
    update(d=>{const h=d.hobbies.find(x=>x.id===hobbyId);if(!h)return d;if(!Array.isArray(h.animals))h.animals=[];const data={id,name:name.trim(),breed:finalBreed,sex,dob,startWeight:Number(startWeight)||0,notes,sireId:sireId||null,sire:sire.trim(),damId:damId||null,dam:dam.trim(),registryNumber:registryNumber.trim(),registryName:registryName.trim(),created:animal?.created||Date.now(),archived:animal?.archived||false,archivedReason:animal?.archivedReason,archivedDate:animal?.archivedDate};if(isEdit){const idx=h.animals.findIndex(a=>a.id===id);if(idx!==-1)h.animals[idx]=data;else h.animals.push(data);}else h.animals.push(data);return d;});
    onClose();
  };
  const remove=()=>{update(d=>{const h=d.hobbies.find(x=>x.id===hobbyId);if(h)h.animals=(h.animals||[]).filter(a=>a.id!==animal.id);return d;});onClose();};
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
    <Modal open onClose={onClose} title={isEdit?"Edit pig":"Add a pig"}>
      <Field label="Name"><input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Wilbur" autoFocus/></Field>
      <Field label="Breed">
        <select style={inputStyle} value={breedSelect} onChange={e=>setBreedSelect(e.target.value)}>{PIG_BREEDS.map(b=><option key={b}>{b}</option>)}</select>
        {breedSelect === "Other" && (
          <input style={{...inputStyle, marginTop: 8}} value={breedCustom} onChange={e=>setBreedCustom(e.target.value)} placeholder="Type your breed (e.g. Ossabaw, Gloucester Old Spot, Iberian)" autoFocus />
        )}
      </Field>
      <div style={{display:"flex",gap:12}}>
        <div style={{flex:1}}><Field label="Sex"><select style={inputStyle} value={sex} onChange={e=>setSex(e.target.value)}>{PIG_SEXES.map(s=><option key={s}>{s}</option>)}</select></Field></div>
        <div style={{flex:1}}><Field label="Start weight (lbs)"><input type="number" min={0} step="0.1" style={inputStyle} value={startWeight} onChange={e=>setStartWeight(e.target.value)} placeholder="0"/></Field></div>
      </div>
      <Field label="Date of birth / arrival (optional)"><input type="date" style={inputStyle} value={dob} onChange={e=>setDob(e.target.value)}/></Field>
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Color, markings, notes..."/></Field>

      {/* Push 7a — Pedigree. Sow/Gilt for dam, Boar for sire. */}
      <details style={{marginBottom:14}}>
        <summary style={{cursor:"pointer",padding:"8px 12px",background:palette.bgAlt,borderRadius:8,fontSize:13,fontWeight:600,color:palette.ink,userSelect:"none"}}>
          🧬 Pedigree & registry (optional)
        </summary>
        <div style={{padding:"12px 4px 4px"}}>
          <SireDamPicker
            label="Dam"
            animals={animals||[]}
            eligibleSexes={["Sow","Gilt"]}
            excludeId={animal?.id}
            selectedId={damId}
            selectedName={dam}
            onChange={({id,name})=>{setDamId(id);setDam(name);}}
            placeholder="Type the dam's name"
          />
          <SireDamPicker
            label="Sire"
            animals={animals||[]}
            eligibleSexes={["Boar"]}
            excludeId={animal?.id}
            selectedId={sireId}
            selectedName={sire}
            onChange={({id,name})=>{setSireId(id);setSire(name);}}
            placeholder="Type the sire's name"
          />
          <Field label="Registry name (optional)">
            <input style={inputStyle} value={registryName} onChange={e=>setRegistryName(e.target.value)} placeholder="e.g. Maplewood Hampshire Star"/>
          </Field>
          <Field label="Registry number (optional)">
            <input style={inputStyle} value={registryNumber} onChange={e=>setRegistryNumber(e.target.value)} placeholder="e.g. NSR #123456"/>
          </Field>
        </div>
      </details>

      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <Btn onClick={save}>{isEdit?"Save changes":"Add pig"}</Btn>
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
            Keeps the pig's history but removes them from your active list.
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

function LogModal({animal,hobbyId,action,update,onClose}){
  const[date,setDate]=useState(todayStr());
  const[lbs,setLbs]=useState("");
  const[cost,setCost]=useState("");
  const[weight,setWeight]=useState("");
  const[count,setCount]=useState("");
  const[notes,setNotes]=useState("");
  // Death-only: optional cause. Stored on the entry AND folded into archivedReason
  // so the existing "Archived pigs" section reads "Died: predator" etc.
  const[cause,setCause]=useState("");
  // Sale-only: buyer name, sale price, sold-vs-rehomed.
  const[saleBuyer,setSaleBuyer]=useState("");
  const[salePrice,setSalePrice]=useState("");
  const[saleType,setSaleType]=useState("sold");
  const save=()=>{
    const entry={id:newId(),date,action,animalId:animal.id,animalName:animal.name,notes,created:Date.now()};
    if(action==="fed"){entry.lbs=Number(lbs)||0;entry.cost=Number(cost)||0;}
    if(action==="weight")entry.weight=Number(weight)||0;
    if(action==="litter")entry.count=Number(count)||1;
    if(action==="butcher"){entry.weight=Number(weight)||0;entry.cost=Number(cost)||0;}
    if(action==="death")entry.cause=cause.trim();
    if(action==="sale"){entry.buyer=saleBuyer.trim();entry.price=Number(salePrice)||0;entry.saleType=saleType;}
    update(d=>{
      d.entries[hobbyId]=d.entries[hobbyId]||[];
      d.entries[hobbyId].push(entry);
      // Death also archives the animal so it drops out of the active list and
      // shows up under "Archived pigs". Mirrors Sheep/Dogs behavior.
      if(action==="death"){
        const h=d.hobbies.find(x=>x.id===hobbyId);
        const a=(h?.animals||[]).find(x=>x.id===animal.id);
        if(a&&!a.archived){
          a.archived=true;
          a.archivedReason=cause.trim()?`Died: ${cause.trim()}`:"Died";
          a.archivedDate=date;
        }
      }
      // Sale archives the animal and creates a Sales entry.
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
          id:entry.id,date,hobbyType:"pig",crop:animal.name,saleType,
          pricePerUnit:Number(salePrice)||0,totalRevenue:Number(salePrice)||0,
          qty:1,animalId:animal.id,buyer:saleBuyer.trim(),notes:notes||"",
        });
      }
      return d;
    });
    onClose();
  };
  const titles={fed:"Log feed",weight:"Log weight",litter:"Log litter",health:"Health check",wean:"Log wean",butcher:"Log butcher",death:"Log death",sale:"Log sale",note:"Add note"};
  const isDeath=action==="death";
  const isSale=action==="sale";
  return(
    <Modal open onClose={onClose} title={`${titles[action]||"Log"} — ${animal.name}`}>
      <Field label="Date"><input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)}/></Field>
      {action==="fed"&&<div style={{display:"flex",gap:12}}><div style={{flex:1}}><Field label="Feed (lbs)"><input type="number" min={0} step="0.1" style={inputStyle} value={lbs} onChange={e=>setLbs(e.target.value)} placeholder="0" autoFocus/></Field></div><div style={{flex:1}}><Field label="Cost ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$0.00"/></Field></div></div>}
      {action==="weight"&&<Field label="Current weight (lbs)"><input type="number" min={0} step="0.1" style={inputStyle} value={weight} onChange={e=>setWeight(e.target.value)} placeholder="0" autoFocus/></Field>}
      {action==="litter"&&<Field label="Piglets born (count)"><input type="number" min={1} style={inputStyle} value={count} onChange={e=>setCount(e.target.value)} placeholder="1" autoFocus/></Field>}
      {action==="butcher"&&<><Field label="Hanging weight (lbs)"><input type="number" min={0} step="0.1" style={inputStyle} value={weight} onChange={e=>setWeight(e.target.value)} placeholder="0" autoFocus/></Field><Field label="Processing cost ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$0.00"/></Field></>}
      {isDeath&&<Field label="Cause (optional)"><input style={inputStyle} value={cause} onChange={e=>setCause(e.target.value)} placeholder="predator, illness, unknown..." autoFocus/></Field>}
      {isSale&&<>
        <Field label="Type"><select style={inputStyle} value={saleType} onChange={e=>setSaleType(e.target.value)}><option value="sold">Sold</option><option value="leased">Leased</option><option value="rehomed">Rehomed (no payment)</option></select></Field>
        <Field label="Buyer / new home (optional)"><input style={inputStyle} value={saleBuyer} onChange={e=>setSaleBuyer(e.target.value)} placeholder="Name of buyer" autoFocus/></Field>
        {saleType!=="rehomed"&&<Field label="Price ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={salePrice} onChange={e=>setSalePrice(e.target.value)} placeholder="$0.00"/></Field>}
      </>}
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      {isDeath&&<div style={{fontSize:12,color:palette.inkSoft,marginBottom:10,padding:"8px 10px",background:palette.bgAlt,borderRadius:6,lineHeight:1.5}}>{animal.name} will move to your Archived pigs list. You can restore from there if this was a mistake.</div>}
      {isSale&&<div style={{fontSize:12,color:palette.inkSoft,marginBottom:10,padding:"8px 10px",background:palette.bgAlt,borderRadius:6,lineHeight:1.5}}>{animal.name} will move to your Archived pigs list and {saleType!=="rehomed"?"a sale record will appear in your Sales tab":"be marked as rehomed"}. You can restore from there if this was a mistake.</div>}
      <Btn onClick={save} variant={isDeath?"danger":"primary"}>{(isDeath||isSale)?"Save & archive":"Save"}</Btn>
    </Modal>
  );
}

function AnimalCard({animal,hobbyId,animals,entries,sales,hobby,update,setModal}){
  const[logAction,setLogAction]=useState(null);
  const[showPedigree,setShowPedigree]=useState(false);
  const[showHistory,setShowHistory]=useState(false);
  const animalEntries=entries.filter(e=>e.animalId===animal.id);
  const weightEntries=animalEntries.filter(e=>e.action==="weight").sort((a,b)=>b.date.localeCompare(a.date));
  const latestWeight=weightEntries[0]?.weight||null;
  const startWeight=animal.startWeight||0;
  const gain=latestWeight&&startWeight?latestWeight-startWeight:null;
  const LOG_ACTIONS=["fed","weight","litter","health","wean","butcher","death","sale","note"];
  const actionLabels={fed:"🌾 Feed",weight:"⚖️ Weight",litter:"🐷 Litter",health:"💊 Health",wean:"🍼 Wean",butcher:"🔪 Butcher",death:"💀 Death",sale:"🏷️ Sale",note:"📓 Note"};
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
          species="pig"
          onClose={()=>setShowHistory(false)}
        />
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:18}}>🐷</span>
            <span style={{fontWeight:700,fontSize:15,color:palette.ink}}>{animal.name}</span>
            <span style={{fontSize:11,background:palette.bgAlt,padding:"2px 8px",borderRadius:4,color:palette.inkSoft}}>{animal.breed}</span>
            <span style={{fontSize:11,background:palette.bgAlt,padding:"2px 8px",borderRadius:4,color:palette.inkSoft}}>{animal.sex}</span>
          </div>
          {animal.dob&&<div style={{fontSize:11,color:palette.inkSoft,marginTop:2,marginLeft:26}}>Born {fmtDate(animal.dob)}</div>}
        </div>
        <button onClick={()=>setModal({type:"editAnimal",hobbyId,animalId:animal.id})} style={{background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,padding:4}}><Edit3 size={14}/></button>
      </div>
      {(latestWeight||startWeight>0)&&(
        <div style={{background:palette.bgAlt,borderRadius:8,padding:"8px 12px",marginBottom:10,display:"flex",gap:16,flexWrap:"wrap"}}>
          {startWeight>0&&<div style={{fontSize:12,color:palette.ink}}><span style={{color:palette.inkSoft}}>Start: </span><strong>{startWeight} lbs</strong></div>}
          {latestWeight&&<div style={{fontSize:12,color:palette.ink}}><span style={{color:palette.inkSoft}}>Current: </span><strong>{latestWeight} lbs</strong></div>}
          {gain!==null&&<div style={{fontSize:12,color:gain>0?palette.leaf:palette.accent}}><strong>+{gain.toFixed(1)} lbs gained</strong></div>}
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
            if(e.action==="fed")detail=`${e.lbs} lbs${e.cost>0?` · ${fmtMoney(e.cost)}`:""}`;
            else if(e.action==="weight")detail=`${e.weight} lbs`;
            else if(e.action==="litter")detail=`${e.count} piglets`;
            else if(e.action==="butcher")detail=`${e.weight} lbs`;
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

export function PigsAnalytics({hobby,entries}){
  const animals=(hobby.animals||[]).filter(a=>!a.archived);
  const feedEntries=entries.filter(e=>e.action==="fed");
  const butcherEntries=entries.filter(e=>e.action==="butcher");
  const litterEntries=entries.filter(e=>e.action==="litter");
  const totalFeedCost=feedEntries.reduce((s,e)=>s+(Number(e.cost)||0),0);
  const totalFeedLbs=feedEntries.reduce((s,e)=>s+(Number(e.lbs)||0),0);
  const totalMeatLbs=butcherEntries.reduce((s,e)=>s+(Number(e.weight)||0),0);
  const totalPiglets=litterEntries.reduce((s,e)=>s+(Number(e.count)||1),0);
  const fcr=totalFeedLbs>0&&totalMeatLbs>0?(totalFeedLbs/totalMeatLbs).toFixed(2):"—";
  const costPerLb=totalMeatLbs>0?(totalFeedCost/totalMeatLbs).toFixed(2):"—";
  const weightByAnimal={};
  entries.filter(e=>e.action==="weight").forEach(e=>{
    if(!weightByAnimal[e.animalName||e.animalId])weightByAnimal[e.animalName||e.animalId]=[];
    weightByAnimal[e.animalName||e.animalId].push({date:e.date,weight:Number(e.weight)||0});
  });
  return(
    <div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
        <StatCard label="Pigs" value={animals.length} accent={palette.ink}/>
        <StatCard label="Total feed cost" value={fmtMoney(totalFeedCost)} accent={palette.feather}/>
        <StatCard label="Meat produced" value={`${totalMeatLbs.toFixed(0)} lbs`} accent={palette.leaf}/>
        <StatCard label="Piglets born" value={totalPiglets} accent={palette.yolk}/>
        {fcr!=="—"&&<StatCard label="FCR" value={fcr} sub="lbs feed / lb meat" accent={palette.feather}/>}
        {costPerLb!=="—"&&<StatCard label="Feed cost / lb" value={`$${costPerLb}`} accent={palette.accent}/>}
      </div>
      {Object.keys(weightByAnimal).length>0&&(
        <ChartCard title="⚖️ Weight by animal">
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {Object.entries(weightByAnimal).map(([name,weights])=>{
              const latest=weights.sort((a,b)=>b.date.localeCompare(a.date))[0];
              const animal=animals.find(a=>a.name===name);
              const gain=latest&&animal?.startWeight?latest.weight-animal.startWeight:null;
              return <div key={name} style={{display:"flex",justifyContent:"space-between",padding:"10px 12px",background:palette.bgAlt,borderRadius:8,fontSize:13}}><div><strong>🐷 {name}</strong>{animal?.breed&&<div style={{fontSize:11,color:palette.inkSoft}}>{animal.breed}</div>}</div><div style={{textAlign:"right"}}><div style={{fontWeight:700}}>{latest.weight} lbs</div>{gain!==null&&<div style={{fontSize:11,color:palette.leaf}}>+{gain.toFixed(1)} lbs gained</div>}</div></div>;
            })}
          </div>
        </ChartCard>
      )}
      {animals.length===0&&<div style={{padding:24,textAlign:"center",color:palette.inkSoft,fontSize:13}}>No pig entries yet.</div>}
    </div>
  );
}

function PigModalRouter({modal,hobby,update,onClose}){
  if(!modal)return null;
  if(modal.type==="addAnimal")return <AnimalModal hobbyId={hobby.id} animals={hobby.animals||[]} update={update} onClose={onClose}/>;
  if(modal.type==="editAnimal"){const animal=(hobby.animals||[]).find(a=>a.id===modal.animalId);if(!animal){onClose();return null;}return <AnimalModal animal={animal} hobbyId={hobby.id} animals={hobby.animals||[]} update={update} onClose={onClose}/>;}
  return null;
}

export default function PigsPage({hobby,data,update}){
  const[localModal,setLocalModal]=useState(null);
  const entries=data.entries[hobby.id]||[];
  const allAnimals=hobby.animals||[];
  const animals=allAnimals.filter(a=>!a.archived);
  const archived=allAnimals.filter(a=>a.archived);
  return(
    <div>
      <PigModalRouter modal={localModal} hobby={hobby} update={update} onClose={()=>setLocalModal(null)}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink}}>Your pigs</div>
        <button onClick={()=>setLocalModal({type:"addAnimal",hobbyId:hobby.id})} style={{padding:"7px 14px",borderRadius:8,background:palette.yolk,border:`1.5px solid ${palette.ink}`,fontFamily:FONT_BODY,fontWeight:600,fontSize:13,cursor:"pointer",color:palette.ink,display:"flex",alignItems:"center",gap:6}}><Plus size={14}/>Add pig</button>
      </div>
      {animals.length===0?(
        <div style={{padding:28,background:palette.card,border:`2px dashed ${palette.line}`,borderRadius:12,textAlign:"center",color:palette.inkSoft}}>
          <div style={{fontSize:36,marginBottom:10}}>🐷</div>
          <div style={{fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink,marginBottom:6}}>No pigs yet</div>
          <div style={{fontSize:13,marginBottom:14}}>Add your first pig to track growth, feed, and butcher stats.</div>
          <button onClick={()=>setLocalModal({type:"addAnimal",hobbyId:hobby.id})} style={{padding:"10px 18px",borderRadius:8,background:palette.yolk,border:`1.5px solid ${palette.ink}`,fontFamily:FONT_BODY,fontWeight:600,fontSize:14,cursor:"pointer",color:palette.ink}}>Add first pig</button>
        </div>
      ):animals.map(a=><AnimalCard key={a.id} animal={a} hobbyId={hobby.id} animals={allAnimals} entries={entries} sales={data.sales||[]} hobby={hobby} update={update} setModal={setLocalModal}/>)}

      {archived.length>0 && (
        <details style={{marginTop:18}}>
          <summary style={{cursor:"pointer",color:palette.inkSoft,fontSize:13,padding:8,background:palette.bgAlt,borderRadius:8,userSelect:"none"}}>
            Archived pigs ({archived.length}) — tap to view
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
