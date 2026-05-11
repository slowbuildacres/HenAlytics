// ============================================================================
// GOATS — per-animal tracking, dairy or meat, milk logging, kid tracking
// ============================================================================
import React, { useState } from "react";
import { X, Edit3, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { SireDamPicker, PedigreeView } from "./PedigreeView.jsx";

const palette = {
  bg:"#F4EDE0",bgAlt:"#EBE0CC",ink:"#2C1810",inkSoft:"#5C4530",
  accent:"#C84B31",leaf:"#5A7A3C",yolk:"#E8B547",yolkSoft:"#F2D58A",
  feather:"#8B6F47",line:"#2C181030",card:"#FAF5EA",
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

const GOAT_BREEDS=["Nubian","Boer","Alpine","LaMancha","Oberhasli","Saanen","Toggenburg","Nigerian Dwarf","Kiko","Myotonic (Fainting)","Angora","Pygmy","Mixed","Other"];
const GOAT_PURPOSES=["Dairy","Meat","Both"];
const GOAT_SEXES=["Doe","Buck","Wether","Kid"];

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
    update(d=>{const h=d.hobbies.find(x=>x.id===hobbyId);if(!h)return d;if(!Array.isArray(h.animals))h.animals=[];const data={id,name:name.trim(),breed:finalBreed,purpose,sex,dob,notes,sireId:sireId||null,sire:sire.trim(),damId:damId||null,dam:dam.trim(),registryNumber:registryNumber.trim(),registryName:registryName.trim(),created:animal?.created||Date.now(),archived:animal?.archived||false,archivedReason:animal?.archivedReason,archivedDate:animal?.archivedDate};if(isEdit){const idx=h.animals.findIndex(a=>a.id===id);if(idx!==-1)h.animals[idx]=data;else h.animals.push(data);}else h.animals.push(data);return d;});
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

function LogModal({animal,hobbyId,action,update,onClose}){
  const[date,setDate]=useState(todayStr());
  const[oz,setOz]=useState("");
  const[lbs,setLbs]=useState("");
  const[cost,setCost]=useState("");
  const[count,setCount]=useState("");
  const[weight,setWeight]=useState("");
  const[notes,setNotes]=useState("");
  const save=()=>{
    const entry={id:newId(),date,action,animalId:animal.id,animalName:animal.name,notes,created:Date.now()};
    if(action==="milk")entry.oz=Number(oz)||0;
    if(action==="fed"){entry.lbs=Number(lbs)||0;entry.cost=Number(cost)||0;}
    if(action==="kid")entry.count=Number(count)||1;
    if(action==="weight"||action==="butcher")entry.weight=Number(weight)||0;
    if(action==="butcher")entry.cost=Number(cost)||0;
    update(d=>{d.entries[hobbyId]=d.entries[hobbyId]||[];d.entries[hobbyId].push(entry);return d;});
    onClose();
  };
  const titles={milk:"Log milk",fed:"Log feed",kid:"Log kids born",weight:"Log weight",health:"Health check",butcher:"Log butcher",death:"Log death",note:"Add note"};
  return(
    <Modal open onClose={onClose} title={`${titles[action]||"Log"} — ${animal.name}`}>
      <Field label="Date"><input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)}/></Field>
      {action==="milk"&&<Field label="Milk collected (oz)"><input type="number" min={0} step="0.1" style={inputStyle} value={oz} onChange={e=>setOz(e.target.value)} placeholder="0" autoFocus/>{oz&&<div style={{fontSize:12,color:palette.inkSoft,marginTop:4}}>{(Number(oz)/128).toFixed(2)} gallons</div>}</Field>}
      {action==="fed"&&<div style={{display:"flex",gap:12}}><div style={{flex:1}}><Field label="Feed (lbs)"><input type="number" min={0} step="0.1" style={inputStyle} value={lbs} onChange={e=>setLbs(e.target.value)} placeholder="0"/></Field></div><div style={{flex:1}}><Field label="Cost ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$0.00"/></Field></div></div>}
      {action==="kid"&&<Field label="Kids born (count)"><input type="number" min={1} style={inputStyle} value={count} onChange={e=>setCount(e.target.value)} placeholder="1" autoFocus/></Field>}
      {(action==="weight"||action==="butcher")&&<Field label="Weight (lbs)"><input type="number" min={0} step="0.1" style={inputStyle} value={weight} onChange={e=>setWeight(e.target.value)} placeholder="0" autoFocus/></Field>}
      {action==="butcher"&&<Field label="Processing cost ($)"><input type="number" min={0} step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$0.00"/></Field>}
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
      <Btn onClick={save}>Save</Btn>
    </Modal>
  );
}

function AnimalCard({animal,hobbyId,animals,entries,update,setModal}){
  const[logAction,setLogAction]=useState(null);
  // Push 7a — pedigree modal state. Toggled by the 🧬 Pedigree button.
  const[showPedigree,setShowPedigree]=useState(false);
  const animalEntries=entries.filter(e=>e.animalId===animal.id);
  const today=todayStr();
  const milkEntries=animalEntries.filter(e=>e.action==="milk");
  const totalMilkOz=milkEntries.reduce((s,e)=>s+(Number(e.oz)||0),0);
  const todayMilk=milkEntries.filter(e=>e.date===today).reduce((s,e)=>s+(Number(e.oz)||0),0);
  const lastMilk=milkEntries.sort((a,b)=>b.date.localeCompare(a.date))[0];
  const purposeColor={Dairy:palette.leaf,Meat:palette.accent,Both:palette.feather};
  const sexLabel={Doe:"♀",Buck:"♂",Wether:"⚧",Kid:"🐣"};
  const LOG_ACTIONS=animal.purpose==="Meat"?["fed","weight","health","butcher","death","note"]:animal.purpose==="Dairy"?["milk","fed","kid","health","death","note"]:["milk","fed","kid","weight","health","butcher","death","note"];
  const actionLabels={milk:"🥛 Milk",fed:"🌾 Feed",kid:"🍼 Kids",weight:"⚖️ Weight",health:"💊 Health",butcher:"🔪 Butcher",death:"💀 Death",note:"📓 Note"};
  const recentEntries=animalEntries.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
  return(
    <div style={{background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:10}}>
      {logAction&&<LogModal animal={animal} hobbyId={hobbyId} action={logAction} update={update} onClose={()=>setLogAction(null)}/>}
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
          <div style={{fontSize:12,color:palette.ink}}><span style={{color:palette.inkSoft}}>Today: </span><strong>{todayMilk>0?`${todayMilk} oz`:"—"}</strong></div>
          <div style={{fontSize:12,color:palette.ink}}><span style={{color:palette.inkSoft}}>All-time: </span><strong>{totalMilkOz>0?`${totalMilkOz} oz (${(totalMilkOz/128).toFixed(1)} gal)`:"—"}</strong></div>
          {lastMilk&&<div style={{fontSize:12,color:palette.inkSoft}}>Last: {fmtDate(lastMilk.date)}</div>}
        </div>
      )}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:recentEntries.length>0?10:0}}>
        {LOG_ACTIONS.map(a=><button key={a} onClick={()=>setLogAction(a)} style={{padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.ink}}>{actionLabels[a]}</button>)}
        {/* Push 7a — Pedigree view. Always shown so the entry point is
            consistent across animals; the modal handles the "no data yet"
            case internally with a friendly empty state. */}
        <button onClick={()=>setShowPedigree(true)} style={{padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,fontFamily:FONT_BODY,border:`1.5px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",color:palette.ink}}>🧬 Pedigree</button>
      </div>
      {recentEntries.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          {recentEntries.map(e=>{
            let detail="";
            if(e.action==="milk")detail=`${e.oz||e.gallons} ${e.oz!=null?"oz":"gal"}`;
            else if(e.action==="fed")detail=`${e.lbs} lbs${e.cost>0?` · ${fmtMoney(e.cost)}`:""}`;
            else if(e.action==="kid"||e.action==="calf"||e.action==="litter")detail=`${e.count} ${e.action==="litter"?"piglets":e.action==="calf"?"calf":"kid"}${e.count!==1?"s":""}`;
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

function GoatHome({hobby,entries,update,setModal}){
  const allAnimals=hobby.animals||[];
  const animals=allAnimals.filter(a=>!a.archived);
  const archived=allAnimals.filter(a=>a.archived);
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink}}>Your goats</div>
        <Btn small variant="accent" onClick={()=>setModal({type:"addAnimal",hobbyId:hobby.id})}><Plus size={14} style={{marginRight:4}}/>Add goat</Btn>
      </div>
      {animals.length===0?(
        <div style={{padding:28,background:palette.card,border:`2px dashed ${palette.line}`,borderRadius:12,textAlign:"center",color:palette.inkSoft}}>
          <div style={{fontSize:36,marginBottom:10}}>🐐</div>
          <div style={{fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink,marginBottom:6}}>No goats yet</div>
          <div style={{fontSize:13,marginBottom:14}}>Add your first goat to start tracking milk, feed, and kids.</div>
          <Btn variant="accent" onClick={()=>setModal({type:"addAnimal",hobbyId:hobby.id})}>Add first goat</Btn>
        </div>
      ):animals.map(a=><AnimalCard key={a.id} animal={a} hobbyId={hobby.id} animals={allAnimals} entries={entries} update={update} setModal={setModal}/>)}

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

export function GoatsAnalytics({hobby,entries}){
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
  return(
    <div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
        <StatCard label="Total milk" value={`${(totalMilkOz/128).toFixed(1)} gal`} sub={`${totalMilkOz.toFixed(0)} oz`} accent={palette.leaf}/>
        <StatCard label="Animals" value={animals.length} accent={palette.ink}/>
        <StatCard label="Kids born" value={totalKids} accent={palette.yolk}/>
        <StatCard label="Feed cost" value={fmtMoney(totalFeedCost)} accent={palette.feather}/>
        {butcherEntries.length>0&&<StatCard label="Butchered" value={butcherEntries.length} sub={`${totalMeatLbs.toFixed(0)} lbs`} accent={palette.accent}/>}
        {fcr!=="—"&&<StatCard label="FCR" value={fcr} sub="lbs feed / lb meat" accent={palette.feather}/>}
      </div>
      {milkTrend.length>1&&<ChartCard title="🥛 Daily milk (oz)"><ResponsiveContainer width="100%" height={180}><BarChart data={milkTrend}><XAxis dataKey="date" stroke={palette.inkSoft} fontSize={11}/><YAxis stroke={palette.inkSoft} fontSize={11}/><Tooltip contentStyle={{background:palette.card,border:`1.5px solid ${palette.ink}`,borderRadius:8}} formatter={v=>[`${v} oz`,"Milk"]}/><Bar dataKey="oz" fill={palette.leaf} radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></ChartCard>}
      {milkChart.length>1&&<ChartCard title="🐐 Milk by animal"><div style={{display:"flex",flexDirection:"column",gap:6}}>{milkChart.map(a=><div key={a.name} style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",background:palette.bgAlt,borderRadius:8,fontSize:13}}><span>🐐 {a.name}</span><strong>{a.oz} oz ({(a.oz/128).toFixed(1)} gal)</strong></div>)}</div></ChartCard>}
      {animals.length===0&&<div style={{padding:24,textAlign:"center",color:palette.inkSoft,fontSize:13}}>No goat entries yet.</div>}
    </div>
  );
}

function GoatModalRouter({modal,hobby,update,onClose}){
  if(!modal)return null;
  if(modal.type==="addAnimal")return <AnimalModal hobbyId={hobby.id} animals={hobby.animals||[]} update={update} onClose={onClose}/>;
  if(modal.type==="editAnimal"){const animal=(hobby.animals||[]).find(a=>a.id===modal.animalId);if(!animal){onClose();return null;}return <AnimalModal animal={animal} hobbyId={hobby.id} animals={hobby.animals||[]} update={update} onClose={onClose}/>;}
  return null;
}

export default function GoatsPage({hobby,data,update}){
  const[localModal,setLocalModal]=useState(null);
  const entries=data.entries[hobby.id]||[];
  return(
    <div>
      <GoatModalRouter modal={localModal} hobby={hobby} update={update} onClose={()=>setLocalModal(null)}/>
      <GoatHome hobby={hobby} entries={entries} update={update} setModal={setLocalModal}/>
    </div>
  );
}
