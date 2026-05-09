// ============================================================================
// COWS — per-animal tracking, dairy or beef, milk/calves/butcher logging
// ============================================================================
import React, { useState } from "react";
import { X, Edit3, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

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

const COW_BREEDS=["Angus","Hereford","Holstein","Jersey","Simmental","Charolais","Longhorn","Dexter","Highland","Brown Swiss","Guernsey","Limousin","Red Angus","Shorthorn","Mixed/Other"];
const COW_PURPOSES=["Dairy","Beef","Both"];
const COW_SEXES=["Cow","Bull","Steer","Heifer","Calf"];

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
  const[breed,setBreed]=useState(animal?.breed||"Mixed/Other");
  const[purpose,setPurpose]=useState(animal?.purpose||"Dairy");
  const[sex,setSex]=useState(animal?.sex||"Cow");
  const[dob,setDob]=useState(animal?.dob||"");
  const[tagId,setTagId]=useState(animal?.tagId||"");
  const[notes,setNotes]=useState(animal?.notes||"");
  const[confirmDelete,setConfirmDelete]=useState(false);
  const save=()=>{
    if(!name.trim())return;
    const id=animal?.id||newId();
    update(d=>{const h=d.hobbies.find(x=>x.id===hobbyId);if(!h)return d;if(!Array.isArray(h.animals))h.animals=[];const data={id,name:name.trim(),breed,purpose,sex,dob,tagId,notes,created:animal?.created||Date.now()};if(isEdit){const idx=h.animals.findIndex(a=>a.id===id);if(idx!==-1)h.animals[idx]=data;else h.animals.push(data);}else h.animals.push(data);return d;});
    onClose();
  };
  const remove=()=>{update(d=>{const h=d.hobbies.find(x=>x.id===hobbyId);if(h)h.animals=(h.animals||[]).filter(a=>a.id!==animal.id);return d;});onClose();};
  return(
    <Modal open onClose={onClose} title={isEdit?"Edit cow":"Add a cow"}>
      <Field label="Name"><input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Bessie" autoFocus/></Field>
      <Field label="Breed"><select style={inputStyle} value={breed} onChange={e=>setBreed(e.target.value)}>{COW_BREEDS.map(b=><option key={b}>{b}</option>)}</select></Field>
      <div style={{display:"flex",gap:12}}>
        <div style={{flex:1}}><Field label="Purpose"><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{COW_PURPOSES.map(p=><button key={p} onClick={()=>setPurpose(p)} style={{padding:"7px 12px",borderRadius:8,fontFamily:FONT_BODY,fontWeight:600,fontSize:13,cursor:"pointer",border:`1.5px solid ${purpose===p?palette.ink:palette.line}`,background:purpose===p?palette.ink:palette.card,color:purpose===p?palette.bg:palette.ink}}>{p}</button>)}</div></Field></div>
        <div style={{flex:1}}><Field label="Sex"><select style={inputStyle} value={sex} onChange={e=>setSex(e.target.value)}>{COW_SEXES.map(s=><option key={s}>{s}</option>)}</select></Field></div>
      </div>
      <div style={{display:"flex",gap:12}}>
        <div style={{flex:1}}><Field label="Date of birth (optional)"><input type="date" style={inputStyle} value={dob} onChange={e=>setDob(e.target.value)}/></Field></div>
        <div style={{flex:1}}><Field label="Ear tag / ID (optional)"><input style={inputStyle} value={tagId} onChange={e=>setTagId(e.target.value)} placeholder="e.g. #42"/></Field></div>
      </div>
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Color, markings, notes..."/></Field>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <Btn onClick={save}>{isEdit?"Save changes":"Add cow"}</Btn>
        {isEdit&&!confirmDelete&&<Btn variant="ghost" onClick={()=>setConfirmDelete(true)}>Delete</Btn>}
        {isEdit&&confirmDelete&&<Btn variant="danger" onClick={remove}>Confirm delete</Btn>}
      </div>
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
  const save=()=>{
    const entry={id:newId(),date,action,animalId:animal.id,animalName:animal.name,notes,created:Date.now()};
    if(action==="milk")entry.gallons=Number(gallons)||0;
    if(action==="fed"){entry.lbs=Number(lbs)||0;entry.cost=Number(cost)||0;}
    if(action==="calf")entry.count=Number(count)||1;
    if(action==="weight"||action==="butcher")entry.weight=Number(weight)||0;
    if(action==="butcher")entry.cost=Number(cost)||0;
    update(d=>{d.entries[hobbyId]=d.entries[hobbyId]||[];d.entries[hobbyId].push(entry);return d;});
    onClose();
  };
  const titles={milk:"Log milk",fed:"Log feed",calf:"Log calf born",weight:"Log weight",health:"Health check",butcher:"Log butcher",death:"Log death",note:"Add note"};
  return(
    <Modal open onClose={onClose} title={`${titles[action]||"Log"} — ${animal.name}`}>
      <Field label="Date"><input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)}/></Field>
      {action==="milk"&&<Field label="Milk (gallons)"><input type="number" min={0} step="0.1" style={inputStyle} value={gallons} onChange={e=>setGallons(e.target.value)} placeholder="0" autoFocus/>{gallons&&<div style={{fontSize:12,color:palette.inkSoft,marginTop:4}}>{(Number(gallons)*3.785).toFixed(1)} liters · {(Number(gallons)*128).toFixed(0)} oz</div>}</Field>}
      {action==="fed"&&<div style={{display:"flex",gap:12}}><div style={{flex:1}}><Field label="Feed (lbs)"><input type="number" min={0} step="0.1" style={inputStyle} value={lbs} onChange={e=>setLbs(e.target.value)} placeholder="0"/></Field></div><div style={{flex:1}}><Field label="Cost ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$0.00"/></Field></div></div>}
      {action==="calf"&&<Field label="Calves born"><input type="number" min={1} style={inputStyle} value={count} onChange={e=>setCount(e.target.value)} placeholder="1" autoFocus/></Field>}
      {(action==="weight"||action==="butcher")&&<Field label="Weight (lbs)"><input type="number" min={0} step="1" style={inputStyle} value={weight} onChange={e=>setWeight(e.target.value)} placeholder="0" autoFocus/></Field>}
      {action==="butcher"&&<Field label="Processing cost ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$0.00"/></Field>}
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      <Btn onClick={save}>Save</Btn>
    </Modal>
  );
}

function AnimalCard({animal,hobbyId,entries,update,setModal}){
  const[logAction,setLogAction]=useState(null);
  const animalEntries=entries.filter(e=>e.animalId===animal.id);
  const today=todayStr();
  const milkEntries=animalEntries.filter(e=>e.action==="milk");
  const totalMilkGal=milkEntries.reduce((s,e)=>s+(Number(e.gallons)||0),0);
  const todayMilk=milkEntries.filter(e=>e.date===today).reduce((s,e)=>s+(Number(e.gallons)||0),0);
  const purposeColor={Dairy:palette.leaf,Beef:palette.accent,Both:palette.feather};
  const LOG_ACTIONS=animal.purpose==="Beef"?["fed","weight","health","butcher","death","note"]:animal.purpose==="Dairy"?["milk","fed","calf","health","death","note"]:["milk","fed","calf","weight","health","butcher","death","note"];
  const actionLabels={milk:"🥛 Milk",fed:"🌾 Feed",calf:"🍼 Calf",weight:"⚖️ Weight",health:"💊 Health",butcher:"🔪 Butcher",death:"💀 Death",note:"📓 Note"};
  const recentEntries=animalEntries.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
  return(
    <div style={{background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:10}}>
      {logAction&&<LogModal animal={animal} hobbyId={hobbyId} action={logAction} update={update} onClose={()=>setLogAction(null)}/>}
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

export function CowsAnalytics({hobby,entries}){
  const animals=hobby.animals||[];
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
  if(modal.type==="addAnimal")return <AnimalModal hobbyId={hobby.id} update={update} onClose={onClose}/>;
  if(modal.type==="editAnimal"){const animal=(hobby.animals||[]).find(a=>a.id===modal.animalId);if(!animal){onClose();return null;}return <AnimalModal animal={animal} hobbyId={hobby.id} update={update} onClose={onClose}/>;}
  return null;
}

export default function CowsPage({hobby,data,update}){
  const[localModal,setLocalModal]=useState(null);
  const entries=data.entries[hobby.id]||[];
  const animals=hobby.animals||[];
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
      ):animals.map(a=><AnimalCard key={a.id} animal={a} hobbyId={hobby.id} entries={entries} update={update} setModal={setLocalModal}/>)}
    </div>
  );
}
