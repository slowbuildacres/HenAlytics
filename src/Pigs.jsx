// ============================================================================
// PIGS — per-animal tracking, growth monitoring, FCR, litters, butcher
// ============================================================================
import React, { useState } from "react";
import { X, Edit3, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

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
function Field({label,children}){return <div style={{marginBottom:14}}><div style={{fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600}}>{label}</div>{children}</div>;}
function Modal({open,onClose,title,children}){
  if(!open)return null;
  return <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(44,24,16,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16}}><div onClick={e=>e.stopPropagation()} style={{background:palette.bg,borderRadius:16,maxWidth:480,width:"100%",maxHeight:"92vh",overflow:"auto",border:`2px solid ${palette.ink}`,boxShadow:`6px 8px 0 ${palette.line}`,fontFamily:FONT_BODY}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1.5px solid ${palette.line}`}}><div style={{fontFamily:FONT_DISPLAY,fontSize:22,color:palette.ink}}>{title}</div><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:palette.ink,padding:4}}><X size={22}/></button></div><div style={{padding:20}}>{children}</div></div></div>;
}
function StatCard({label,value,sub,accent=palette.accent}){return <div style={{background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,flex:"1 1 130px",minWidth:130,boxSizing:"border-box"}}><div style={{fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{label}</div><div style={{fontSize:22,fontFamily:FONT_DISPLAY,color:accent,lineHeight:1.1}}>{value}</div>{sub&&<div style={{fontSize:11,color:palette.inkSoft,marginTop:4}}>{sub}</div>}</div>;}
function ChartCard({title,children}){return <div style={{background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:12}}><div style={{fontFamily:FONT_DISPLAY,fontSize:18,marginBottom:10,color:palette.ink}}>{title}</div>{children}</div>;}

function AnimalModal({animal,hobbyId,update,onClose}){
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
  const save=()=>{
    if(!name.trim())return;
    const id=animal?.id||newId();
    update(d=>{const h=d.hobbies.find(x=>x.id===hobbyId);if(!h)return d;if(!Array.isArray(h.animals))h.animals=[];const data={id,name:name.trim(),breed:finalBreed,sex,dob,startWeight:Number(startWeight)||0,notes,created:animal?.created||Date.now(),archived:animal?.archived||false,archivedReason:animal?.archivedReason,archivedDate:animal?.archivedDate};if(isEdit){const idx=h.animals.findIndex(a=>a.id===id);if(idx!==-1)h.animals[idx]=data;else h.animals.push(data);}else h.animals.push(data);return d;});
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
  const save=()=>{
    const entry={id:newId(),date,action,animalId:animal.id,animalName:animal.name,notes,created:Date.now()};
    if(action==="fed"){entry.lbs=Number(lbs)||0;entry.cost=Number(cost)||0;}
    if(action==="weight")entry.weight=Number(weight)||0;
    if(action==="litter")entry.count=Number(count)||1;
    if(action==="butcher"){entry.weight=Number(weight)||0;entry.cost=Number(cost)||0;}
    update(d=>{d.entries[hobbyId]=d.entries[hobbyId]||[];d.entries[hobbyId].push(entry);return d;});
    onClose();
  };
  const titles={fed:"Log feed",weight:"Log weight",litter:"Log litter",health:"Health check",wean:"Log wean",butcher:"Log butcher",death:"Log death",note:"Add note"};
  return(
    <Modal open onClose={onClose} title={`${titles[action]||"Log"} — ${animal.name}`}>
      <Field label="Date"><input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)}/></Field>
      {action==="fed"&&<div style={{display:"flex",gap:12}}><div style={{flex:1}}><Field label="Feed (lbs)"><input type="number" min={0} step="0.1" style={inputStyle} value={lbs} onChange={e=>setLbs(e.target.value)} placeholder="0" autoFocus/></Field></div><div style={{flex:1}}><Field label="Cost ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$0.00"/></Field></div></div>}
      {action==="weight"&&<Field label="Current weight (lbs)"><input type="number" min={0} step="0.1" style={inputStyle} value={weight} onChange={e=>setWeight(e.target.value)} placeholder="0" autoFocus/></Field>}
      {action==="litter"&&<Field label="Piglets born (count)"><input type="number" min={1} style={inputStyle} value={count} onChange={e=>setCount(e.target.value)} placeholder="1" autoFocus/></Field>}
      {action==="butcher"&&<><Field label="Hanging weight (lbs)"><input type="number" min={0} step="0.1" style={inputStyle} value={weight} onChange={e=>setWeight(e.target.value)} placeholder="0" autoFocus/></Field><Field label="Processing cost ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$0.00"/></Field></>}
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      <Btn onClick={save}>Save</Btn>
    </Modal>
  );
}

function AnimalCard({animal,hobbyId,entries,update,setModal}){
  const[logAction,setLogAction]=useState(null);
  const animalEntries=entries.filter(e=>e.animalId===animal.id);
  const weightEntries=animalEntries.filter(e=>e.action==="weight").sort((a,b)=>b.date.localeCompare(a.date));
  const latestWeight=weightEntries[0]?.weight||null;
  const startWeight=animal.startWeight||0;
  const gain=latestWeight&&startWeight?latestWeight-startWeight:null;
  const LOG_ACTIONS=["fed","weight","litter","health","wean","butcher","death","note"];
  const actionLabels={fed:"🌾 Feed",weight:"⚖️ Weight",litter:"🐷 Litter",health:"💊 Health",wean:"🍼 Wean",butcher:"🔪 Butcher",death:"💀 Death",note:"📓 Note"};
  const recentEntries=animalEntries.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
  return(
    <div style={{background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:10}}>
      {logAction&&<LogModal animal={animal} hobbyId={hobbyId} action={logAction} update={update} onClose={()=>setLogAction(null)}/>}
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
                  <button onClick={()=>update(d=>{d.entries[hobbyId]=(d.entries[hobbyId]||[]).filter(x=>x.id!==e.id);return d;})} style={{background:"none",border:"none",cursor:"pointer",color:palette.accent,fontSize:11,padding:"0 2px",lineHeight:1}}>✕</button>
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
  if(modal.type==="addAnimal")return <AnimalModal hobbyId={hobby.id} update={update} onClose={onClose}/>;
  if(modal.type==="editAnimal"){const animal=(hobby.animals||[]).find(a=>a.id===modal.animalId);if(!animal){onClose();return null;}return <AnimalModal animal={animal} hobbyId={hobby.id} update={update} onClose={onClose}/>;}
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
      ):animals.map(a=><AnimalCard key={a.id} animal={a} hobbyId={hobby.id} entries={entries} update={update} setModal={setLocalModal}/>)}

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
