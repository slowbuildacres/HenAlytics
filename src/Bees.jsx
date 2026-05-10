import React, { useState } from "react";
import { X, Edit3, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { fmtMoney } from "./units.js";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47", featherSoft: "#C9A77B",
  line: "#2C181030", card: "#FAF5EA",
  honey: "#E8961A", honeySoft: "#F5C96A",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
};

const HIVE_TYPES = ["Langstroth", "Top Bar", "Warré", "Flow Hive", "Long Langstroth", "Other"];
const HIVE_SOURCES = ["Package", "Nucleus (nuc)", "Swarm", "Split", "Purchased colony", "Other"];
const MITE_TREATMENTS = ["Oxalic acid (dribble)", "Oxalic acid (vaporize)", "Apivar strips", "Mite Away Quick Strips", "HopGuard", "Formic Pro", "Other"];
const TEMPERAMENT = ["Calm", "Mild", "Defensive", "Aggressive"];

const newId = () => Math.random().toString(36).slice(2, 10);
const localDateStr = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const todayStr = () => localDateStr(new Date());
const parseLocalDate = (s) => { if (!s) return new Date(); const [y,m,d] = s.split("-").map(Number); return new Date(y,(m||1)-1,d||1); };
const fmtDate = (s) => { if (!s) return ""; return parseLocalDate(s).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); };

function Btn({ children, onClick, variant="primary", small=false, style={}, type="button", disabled=false }) {
  const styles = {
    primary: { background: palette.ink, color: palette.bg, border: `1.5px solid ${palette.ink}` },
    danger: { background: palette.accent, color: palette.bg, border: `1.5px solid ${palette.accent}` },
    ghost: { background: "transparent", color: palette.ink, border: `1.5px solid ${palette.line}` },
    accent: { background: palette.yolk, color: palette.ink, border: `1.5px solid ${palette.ink}` },
    honey: { background: palette.honey, color: palette.bg, border: `1.5px solid ${palette.honey}` },
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

function ChartCard({ title, children }) {
  return (
    <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, marginBottom: 10, color: palette.ink }}>{title}</div>
      {children}
    </div>
  );
}

// ============ ADD / EDIT HIVE MODAL ============
function HiveModal({ hive, onSave, onClose }) {
  const [name, setName] = useState(hive?.name || "");
  const [type, setType] = useState(hive?.type || "Langstroth");
  const [source, setSource] = useState(hive?.source || "Package");
  const [installDate, setInstallDate] = useState(hive?.installDate || todayStr());
  const [location, setLocation] = useState(hive?.location || "");
  const [purchaseCost, setPurchaseCost] = useState(hive?.purchaseCost ? String(hive.purchaseCost) : "");
  const [purchasedFrom, setPurchasedFrom] = useState(hive?.purchasedFrom || "");
  const [notes, setNotes] = useState(hive?.notes || "");

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: hive?.id || newId(),
      name: name.trim(), type, source, installDate, location, notes,
      purchaseCost: parseFloat(purchaseCost) || 0,
      purchasedFrom: purchasedFrom.trim(),
      active: hive?.active !== false,
    });
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(44,24,16,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:palette.bg,borderRadius:16,maxWidth:460,width:"100%",maxHeight:"90vh",overflow:"auto",border:`2px solid ${palette.ink}`,boxShadow:`6px 8px 0 ${palette.line}` }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1.5px solid ${palette.line}` }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:22,color:palette.ink }}>{hive ? "Edit Hive" : "Add Hive"}</div>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:palette.ink,padding:4 }}><X size={22}/></button>
        </div>
        <div style={{ padding:20,display:"flex",flexDirection:"column",gap:14 }}>
          <label style={{ display:"block" }}>
            <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Hive Name</div>
            <input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Hive 1, Back yard, East meadow" autoFocus />
          </label>
          <div style={{ display:"flex",gap:12 }}>
            <label style={{ flex:1 }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Hive Type</div>
              <select style={inputStyle} value={type} onChange={e=>setType(e.target.value)}>
                {HIVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label style={{ flex:1 }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Source</div>
              <select style={inputStyle} value={source} onChange={e=>setSource(e.target.value)}>
                {HIVE_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <label style={{ display:"block" }}>
            <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Install / Start Date</div>
            <input style={inputStyle} type="date" value={installDate} onChange={e=>setInstallDate(e.target.value)} />
          </label>
          <label style={{ display:"block" }}>
            <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Location / spot (optional)</div>
            <input style={inputStyle} value={location} onChange={e=>setLocation(e.target.value)} placeholder="e.g. Back of orchard, facing east" />
          </label>
          <div style={{ display:"flex",gap:12 }}>
            <label style={{ flex:1 }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Hive cost (optional)</div>
              <input type="number" step="0.01" style={inputStyle} value={purchaseCost} onChange={e=>setPurchaseCost(e.target.value)} placeholder="$" />
            </label>
            <label style={{ flex:1 }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Where from (optional)</div>
              <input style={inputStyle} value={purchasedFrom} onChange={e=>setPurchasedFrom(e.target.value)} placeholder="e.g. Mann Lake, local apiary" />
            </label>
          </div>
          <label style={{ display:"block" }}>
            <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Notes (optional)</div>
            <textarea style={{ ...inputStyle,minHeight:60,resize:"vertical" }} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Anything notable about this hive..." />
          </label>
          <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn onClick={handleSave} disabled={!name.trim()}>Save Hive</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ LOG ENTRY MODAL ============
function LogEntryModal({ hive, action, onSave, onClose }) {
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  // Inspection fields
  const [queenSeen, setQueenSeen] = useState(false);
  const [broodPattern, setBroodPattern] = useState("Good");
  const [temperament, setTemperament] = useState("Calm");
  const [honeyStores, setHoneyStores] = useState("Adequate");
  const [population, setPopulation] = useState("Strong");
  const [supersedureCells, setSupersedureCells] = useState(false);
  const [swarmCells, setSwarmCells] = useState(false);
  // Harvest fields
  const [harvestLbs, setHarvestLbs] = useState("");
  const [harvestJars, setHarvestJars] = useState("");
  const [harvestRevenue, setHarvestRevenue] = useState("");
  // Feed fields
  const [feedType, setFeedType] = useState("Sugar syrup (2:1)");
  const [feedQty, setFeedQty] = useState("");
  const [feedCost, setFeedCost] = useState("");
  // Treatment fields
  const [treatmentType, setTreatmentType] = useState(MITE_TREATMENTS[0]);
  const [miteCount, setMiteCount] = useState("");
  const [treatmentCost, setTreatmentCost] = useState("");
  // Infrastructure
  const [item, setItem] = useState("");
  const [infraCost, setInfraCost] = useState("");
  // Split/swarm
  const [splitDetails, setSplitDetails] = useState("");
  // Death/loss
  const [deathCause, setDeathCause] = useState("Unknown");
  // Varroa testing
  const [varroaMethod, setVarroaMethod] = useState("Sugar roll");
  const [varroaCount, setVarroaCount] = useState("");
  const [varroaTreatedAfter, setVarroaTreatedAfter] = useState(false);

  const handleSave = () => {
    let entry = { id: newId(), date, action, hiveId: hive.id, created: Date.now() };
    if (action === "inspect") {
      entry = { ...entry, queenSeen, broodPattern, temperament, honeyStores, population, supersedureCells, swarmCells, note };
    } else if (action === "harvest") {
      entry = { ...entry, lbs: Number(harvestLbs)||0, jars: Number(harvestJars)||0, revenue: Number(harvestRevenue)||0, note };
    } else if (action === "feed") {
      entry = { ...entry, feedType, qty: Number(feedQty)||0, cost: Number(feedCost)||0 };
    } else if (action === "treatment") {
      entry = { ...entry, treatmentType, miteCount: Number(miteCount)||0, cost: Number(treatmentCost)||0, note };
    } else if (action === "varroa") {
      // Varroa test entry — count is mites per 100 bees (the standard metric)
      entry = { ...entry, varroaMethod, varroaCount: Number(varroaCount)||0, varroaTreatedAfter, note };
    } else if (action === "infrastructure") {
      entry = { ...entry, item, cost: Number(infraCost)||0 };
    } else if (action === "split" || action === "swarm") {
      entry = { ...entry, detail: splitDetails, note };
    } else if (action === "death") {
      entry = { ...entry, cause: deathCause, note };
    } else {
      entry = { ...entry, note };
    }
    onSave(entry);
    onClose();
  };

  const titles = {
    inspect: "🔍 Hive Inspection", harvest: "🍯 Harvest Honey",
    feed: "🌾 Log Feed", treatment: "💊 Log Treatment",
    varroa: "🦠 Varroa Mite Test",
    infrastructure: "🔨 Infrastructure", split: "✂️ Log Split",
    swarm: "🐝 Log Swarm", death: "💀 Colony Loss", note: "📓 Note",
    winter_prep: "❄️ Winter Prep", spring_buildup: "🌸 Spring Buildup",
  };

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(44,24,16,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:palette.bg,borderRadius:16,maxWidth:460,width:"100%",maxHeight:"90vh",overflow:"auto",border:`2px solid ${palette.ink}`,boxShadow:`6px 8px 0 ${palette.line}` }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1.5px solid ${palette.line}` }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:22,color:palette.ink }}>{titles[action]||action}</div>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:palette.ink,padding:4 }}><X size={22}/></button>
        </div>
        <div style={{ padding:20,display:"flex",flexDirection:"column",gap:14 }}>

          <label style={{ display:"block" }}>
            <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Date</div>
            <input style={inputStyle} type="date" value={date} onChange={e=>setDate(e.target.value)} />
          </label>

          {action === "inspect" && <>
            {/* Queen */}
            <div style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:queenSeen?palette.yolkSoft:palette.bgAlt,borderRadius:8,border:`1.5px solid ${palette.line}`,cursor:"pointer" }}
              onClick={()=>setQueenSeen(!queenSeen)}>
              <div style={{ fontSize:22 }}>{queenSeen ? "👑" : "🔍"}</div>
              <div>
                <div style={{ fontWeight:600,fontSize:13,color:palette.ink }}>Queen seen</div>
                <div style={{ fontSize:11,color:palette.inkSoft }}>{queenSeen ? "Yes — spotted her" : "Not seen"}</div>
              </div>
              <div style={{ marginLeft:"auto",width:22,height:22,borderRadius:4,border:`2px solid ${queenSeen?palette.ink:palette.line}`,background:queenSeen?palette.ink:"transparent",display:"flex",alignItems:"center",justifyContent:"center" }}>
                {queenSeen && <span style={{ color:palette.bg,fontSize:14,lineHeight:1,fontWeight:700 }}>✓</span>}
              </div>
            </div>
            <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
              <label style={{ flex:1,minWidth:140 }}>
                <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Brood pattern</div>
                <select style={inputStyle} value={broodPattern} onChange={e=>setBroodPattern(e.target.value)}>
                  {["Excellent","Good","Spotty","Poor","None"].map(v=><option key={v}>{v}</option>)}
                </select>
              </label>
              <label style={{ flex:1,minWidth:140 }}>
                <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Temperament</div>
                <select style={inputStyle} value={temperament} onChange={e=>setTemperament(e.target.value)}>
                  {TEMPERAMENT.map(v=><option key={v}>{v}</option>)}
                </select>
              </label>
            </div>
            <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
              <label style={{ flex:1,minWidth:140 }}>
                <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Honey stores</div>
                <select style={inputStyle} value={honeyStores} onChange={e=>setHoneyStores(e.target.value)}>
                  {["Plentiful","Adequate","Low","Critical"].map(v=><option key={v}>{v}</option>)}
                </select>
              </label>
              <label style={{ flex:1,minWidth:140 }}>
                <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Population</div>
                <select style={inputStyle} value={population} onChange={e=>setPopulation(e.target.value)}>
                  {["Strong","Medium","Weak","Critical"].map(v=><option key={v}>{v}</option>)}
                </select>
              </label>
            </div>
            <div style={{ display:"flex",gap:12 }}>
              {[["supersedureCells","🔴 Supersedure cells",supersedureCells,setSupersedureCells],
                ["swarmCells","🟡 Swarm cells",swarmCells,setSwarmCells]].map(([key,label,val,setter])=>(
                <div key={key} onClick={()=>setter(!val)}
                  style={{ flex:1,padding:"10px 12px",background:val?palette.yolkSoft:palette.bgAlt,borderRadius:8,border:`1.5px solid ${palette.line}`,cursor:"pointer",display:"flex",alignItems:"center",gap:8 }}>
                  <div style={{ fontSize:13,color:palette.ink,fontWeight:500,flex:1 }}>{label}</div>
                  <div style={{ width:18,height:18,borderRadius:3,border:`2px solid ${val?palette.ink:palette.line}`,background:val?palette.ink:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                    {val && <span style={{ color:palette.bg,fontSize:12,fontWeight:700 }}>✓</span>}
                  </div>
                </div>
              ))}
            </div>
            <label style={{ display:"block" }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Notes</div>
              <textarea style={{ ...inputStyle,minHeight:70,resize:"vertical" }} value={note} onChange={e=>setNote(e.target.value)} placeholder="What did you observe?" autoFocus />
            </label>
          </>}

          {action === "harvest" && <>
            <div style={{ display:"flex",gap:12 }}>
              <label style={{ flex:1 }}>
                <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Pounds harvested</div>
                <input style={inputStyle} type="number" min={0} step="0.1" value={harvestLbs} onChange={e=>setHarvestLbs(e.target.value)} placeholder="0.0" />
              </label>
              <label style={{ flex:1 }}>
                <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Jars filled</div>
                <input style={inputStyle} type="number" min={0} value={harvestJars} onChange={e=>setHarvestJars(e.target.value)} placeholder="0" />
              </label>
            </div>
            <label style={{ display:"block" }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Revenue (optional)</div>
              <input style={inputStyle} type="number" min={0} step="0.01" value={harvestRevenue} onChange={e=>setHarvestRevenue(e.target.value)} placeholder="$0.00" />
            </label>
            <label style={{ display:"block" }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Notes (optional)</div>
              <input style={inputStyle} value={note} onChange={e=>setNote(e.target.value)} placeholder="Color, flavor, which super..." />
            </label>
          </>}

          {action === "feed" && <>
            <label style={{ display:"block" }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Feed type</div>
              <select style={inputStyle} value={feedType} onChange={e=>setFeedType(e.target.value)}>
                {["Sugar syrup (1:1)","Sugar syrup (2:1)","Dry sugar","Pollen patty","Fondant","Protein supplement","Other"].map(v=><option key={v}>{v}</option>)}
              </select>
            </label>
            <div style={{ display:"flex",gap:12 }}>
              <label style={{ flex:1 }}>
                <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Quantity (lbs or oz)</div>
                <input style={inputStyle} type="number" min={0} step="0.1" value={feedQty} onChange={e=>setFeedQty(e.target.value)} placeholder="0" />
              </label>
              <label style={{ flex:1 }}>
                <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Cost ($)</div>
                <input style={inputStyle} type="number" min={0} step="0.01" value={feedCost} onChange={e=>setFeedCost(e.target.value)} placeholder="0.00" />
              </label>
            </div>
          </>}

          {action === "treatment" && <>
            <label style={{ display:"block" }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Treatment type</div>
              <select style={inputStyle} value={treatmentType} onChange={e=>setTreatmentType(e.target.value)}>
                {MITE_TREATMENTS.map(v=><option key={v}>{v}</option>)}
              </select>
            </label>
            <div style={{ display:"flex",gap:12 }}>
              <label style={{ flex:1 }}>
                <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Mite count (per 100 bees)</div>
                <input style={inputStyle} type="number" min={0} step="0.1" value={miteCount} onChange={e=>setMiteCount(e.target.value)} placeholder="0" />
              </label>
              <label style={{ flex:1 }}>
                <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Cost ($)</div>
                <input style={inputStyle} type="number" min={0} step="0.01" value={treatmentCost} onChange={e=>setTreatmentCost(e.target.value)} placeholder="0.00" />
              </label>
            </div>
            <label style={{ display:"block" }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Notes (optional)</div>
              <input style={inputStyle} value={note} onChange={e=>setNote(e.target.value)} placeholder="Dosage, conditions, result..." />
            </label>
          </>}

          {action === "varroa" && <>
            <div style={{ padding:"10px 12px",background:palette.bgAlt,borderRadius:8,fontSize:12,color:palette.inkSoft,lineHeight:1.5 }}>
              💡 <strong>Mite count</strong> is mites per 100 bees. Most beekeepers treat at 3+ mites/100 bees in late summer or fall.
            </div>
            <label style={{ display:"block" }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Method</div>
              <select style={inputStyle} value={varroaMethod} onChange={e=>setVarroaMethod(e.target.value)}>
                <option value="Sugar roll">Sugar roll</option>
                <option value="Alcohol wash">Alcohol wash</option>
                <option value="Sticky board">Sticky board (24hr drop)</option>
              </select>
            </label>
            <label style={{ display:"block" }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Mite count (optional — per 100 bees)</div>
              <input style={inputStyle} type="number" min={0} step="0.1" value={varroaCount} onChange={e=>setVarroaCount(e.target.value)} placeholder="e.g. 2 = 2 mites per 100 bees" />
            </label>
            {Number(varroaCount) >= 3 && (
              <div style={{ padding:"10px 12px",background:palette.accent,color:palette.bg,borderRadius:8,fontSize:13,fontWeight:600,lineHeight:1.5 }}>
                ⚠️ {Number(varroaCount).toFixed(1)} mites/100 bees is at or above the 3% treatment threshold. Most beekeepers recommend treating soon to protect the hive heading into winter.
              </div>
            )}
            <label style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer" }}>
              <input type="checkbox" checked={varroaTreatedAfter} onChange={e=>setVarroaTreatedAfter(e.target.checked)} />
              <span style={{ fontSize:13,color:palette.ink }}>Treated after this test</span>
            </label>
            <label style={{ display:"block" }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Notes (optional)</div>
              <input style={inputStyle} value={note} onChange={e=>setNote(e.target.value)} placeholder="Sample size, conditions, treatment plan..." />
            </label>
          </>}

          {action === "infrastructure" && <>
            <label style={{ display:"block" }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Item</div>
              <input style={inputStyle} value={item} onChange={e=>setItem(e.target.value)} placeholder="e.g. New super, frames, hive stand..." />
            </label>
            <label style={{ display:"block" }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Cost ($)</div>
              <input style={inputStyle} type="number" min={0} step="0.01" value={infraCost} onChange={e=>setInfraCost(e.target.value)} placeholder="0.00" />
            </label>
          </>}

          {(action === "split" || action === "swarm") && <>
            <label style={{ display:"block" }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Details</div>
              <input style={inputStyle} value={splitDetails} onChange={e=>setSplitDetails(e.target.value)} placeholder={action==="split"?"Where did the split go?":"Where did the swarm land?"} />
            </label>
            <label style={{ display:"block" }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Notes (optional)</div>
              <textarea style={{ ...inputStyle,minHeight:60,resize:"vertical" }} value={note} onChange={e=>setNote(e.target.value)} />
            </label>
          </>}

          {action === "death" && <>
            <label style={{ display:"block" }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Likely cause</div>
              <select style={inputStyle} value={deathCause} onChange={e=>setDeathCause(e.target.value)}>
                {["Unknown","Varroa mites","Starvation","Winter loss","Queen failure","Pesticides","Disease","Absconded","Other"].map(v=><option key={v}>{v}</option>)}
              </select>
            </label>
            <label style={{ display:"block" }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Notes</div>
              <textarea style={{ ...inputStyle,minHeight:60,resize:"vertical" }} value={note} onChange={e=>setNote(e.target.value)} placeholder="What you observed..." />
            </label>
          </>}

          {(action === "note" || action === "winter_prep" || action === "spring_buildup") && <>
            <label style={{ display:"block" }}>
              <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Notes</div>
              <textarea style={{ ...inputStyle,minHeight:90,resize:"vertical" }} value={note} onChange={e=>setNote(e.target.value)} placeholder="What did you do / observe?" autoFocus />
            </label>
          </>}

          <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn onClick={handleSave}>Save</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ HIVE DETAIL VIEW ============
function HiveDetail({ hive, entries, onLog, onEdit, onDelete, onBack, onDeleteEntry, onEditEntry }) {
  const hiveEntries = entries.filter(e => e.hiveId === hive.id).sort((a,b) => (b.date||"").localeCompare(a.date||""));
  const totalHarvestLbs = hiveEntries.filter(e=>e.action==="harvest").reduce((s,e)=>s+(Number(e.lbs)||0),0);
  const totalJars = hiveEntries.filter(e=>e.action==="harvest").reduce((s,e)=>s+(Number(e.jars)||0),0);
  const totalInspections = hiveEntries.filter(e=>e.action==="inspect").length;
  const lastInspect = [...hiveEntries].filter(e=>e.action==="inspect")[0];
  const feedCost = hiveEntries.filter(e=>e.action==="feed").reduce((s,e)=>s+(Number(e.cost)||0),0);
  const treatCost = hiveEntries.filter(e=>e.action==="treatment").reduce((s,e)=>s+(Number(e.cost)||0),0);
  const infraCost = hiveEntries.filter(e=>e.action==="infrastructure").reduce((s,e)=>s+(Number(e.cost)||0),0);
  const hiveCost = Number(hive.purchaseCost) || 0;
  const totalCost = feedCost + treatCost + infraCost + hiveCost;
  const isDead = hiveEntries.some(e=>e.action==="death");

  // Varroa testing — find most recent test, alert if untreated and high
  const varroaTests = hiveEntries.filter(e => e.action === "varroa");
  const lastVarroa = varroaTests[0]; // already sorted desc
  const showHighMiteAlert = lastVarroa && Number(lastVarroa.varroaCount) >= 3 && !lastVarroa.varroaTreatedAfter && !isDead;

  return (
    <div>
      <button onClick={onBack} style={{ background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,fontFamily:FONT_BODY,fontSize:13,display:"flex",alignItems:"center",gap:6,marginBottom:16,padding:0 }}>
        ← All Hives
      </button>

      <div style={{ background:isDead?palette.accent:palette.ink,color:palette.bg,borderRadius:12,padding:14,marginBottom:12 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:10,opacity:0.7,textTransform:"uppercase",letterSpacing:1.5,marginBottom:4 }}>
              {isDead?"Lost Colony":"Active Hive"} · {hive.type}
            </div>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:28,color:palette.honey,lineHeight:1 }}>{hive.name}</div>
            <div style={{ fontSize:13,opacity:0.85,marginTop:4 }}>
              {hive.source} · installed {fmtDate(hive.installDate)}
              {hive.location && ` · ${hive.location}`}
            </div>
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={onEdit} style={{ background:"none",border:"none",cursor:"pointer",color:palette.bg,opacity:0.7,padding:4 }}><Edit3 size={16}/></button>
            <button onClick={onDelete} style={{ background:"none",border:"none",cursor:"pointer",color:palette.accent,padding:4 }}><Trash2 size={16}/></button>
          </div>
        </div>
      </div>

      {showHighMiteAlert && (
        <div style={{
          background:palette.accent, color:palette.bg,
          border:`1.5px solid ${palette.ink}`, borderRadius:10,
          padding:"12px 14px", marginBottom:12, fontSize:13, lineHeight:1.5,
        }}>
          <div style={{ fontWeight:700, marginBottom:4 }}>
            ⚠️ High mite count detected — treatment recommended
          </div>
          <div style={{ fontSize:12, opacity:0.92 }}>
            Last test: <strong>{Number(lastVarroa.varroaCount).toFixed(1)} mites/100 bees</strong> on {fmtDate(lastVarroa.date)} ({lastVarroa.varroaMethod}). The 3% threshold is the standard treatment trigger. Tap 💊 Treatment to log a treatment.
          </div>
        </div>
      )}

      {lastInspect && (
        <div style={{ background:palette.yolkSoft,border:`1.5px solid ${palette.line}`,borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:palette.ink }}>
          🔍 Last inspected: <strong>{fmtDate(lastInspect.date)}</strong>
          {lastInspect.broodPattern && ` · Brood: ${lastInspect.broodPattern}`}
          {lastInspect.queenSeen && " · 👑 Queen seen"}
        </div>
      )}

      {hiveEntries.length > 0 && (
        <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:12 }}>
          {totalHarvestLbs > 0 && <div style={{ flex:"1 1 120px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:10,padding:12 }}>
            <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Honey</div>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:24,color:palette.honey }}>{totalHarvestLbs.toFixed(1)} lbs</div>
            <div style={{ fontSize:11,color:palette.inkSoft }}>{totalJars} jars</div>
          </div>}
          {totalInspections > 0 && <div style={{ flex:"1 1 120px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:10,padding:12 }}>
            <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Inspections</div>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:24,color:palette.ink }}>{totalInspections}</div>
          </div>}
          {totalCost > 0 && <div style={{ flex:"1 1 120px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:10,padding:12 }}>
            <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Total Cost</div>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:24,color:palette.accent }}>{fmtMoney(totalCost)}</div>
            {hiveCost > 0 && <div style={{ fontSize:10,color:palette.inkSoft,marginTop:2 }}>incl. {fmtMoney(hiveCost)} hive</div>}
          </div>}
          {lastVarroa && <div style={{ flex:"1 1 120px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:10,padding:12 }}>
            <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Last mite test</div>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:24,color:Number(lastVarroa.varroaCount) >= 3 ? palette.accent : palette.leaf }}>
              {Number(lastVarroa.varroaCount).toFixed(1)}<span style={{ fontSize:12,color:palette.inkSoft,marginLeft:2 }}>/100</span>
            </div>
            <div style={{ fontSize:10,color:palette.inkSoft,marginTop:2 }}>{fmtDate(lastVarroa.date)} · {varroaTests.length} test{varroaTests.length===1?"":"s"}</div>
          </div>}
        </div>
      )}

      <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:20,margin:"16px 0 10px",color:palette.ink }}>quick log</h3>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:10,marginBottom:20 }}>
        {[
          { action:"inspect", label:"Inspect", emoji:"🔍" },
          { action:"harvest", label:"Harvest", emoji:"🍯" },
          { action:"feed", label:"Feed", emoji:"🌾" },
          { action:"treatment", label:"Treatment", emoji:"💊" },
          { action:"varroa", label:"Mite Test", emoji:"🦠" },
          { action:"split", label:"Split", emoji:"✂️" },
          { action:"swarm", label:"Swarm", emoji:"🐝" },
          { action:"winter_prep", label:"Winter Prep", emoji:"❄️" },
          { action:"spring_buildup", label:"Spring Check", emoji:"🌸" },
          { action:"infrastructure", label:"Equipment", emoji:"🔨" },
          { action:"death", label:"Colony Loss", emoji:"💀" },
          { action:"note", label:"Note", emoji:"📓" },
        ].map(({action,label,emoji}) => (
          <button key={action} onClick={()=>onLog(action)} style={{
            background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,
            padding:"14px 10px",display:"flex",flexDirection:"column",alignItems:"center",
            gap:6,cursor:"pointer",fontFamily:FONT_BODY,color:palette.ink,
            boxShadow:`2px 3px 0 ${palette.line}`,minHeight:80,
          }}>
            <div style={{ fontSize:22 }}>{emoji}</div>
            <div style={{ fontSize:12,fontWeight:600,textAlign:"center",lineHeight:1.2 }}>{label}</div>
          </button>
        ))}
      </div>

      <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:20,margin:"0 0 10px",color:palette.ink }}>recent activity</h3>
      {hiveEntries.length === 0 ? (
        <div style={{ padding:24,background:palette.card,border:`1.5px dashed ${palette.line}`,borderRadius:12,textAlign:"center",color:palette.inkSoft }}>
          No entries yet — tap a tile above to get started.
        </div>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
          {hiveEntries.slice(0,10).map(e => <BeeEntryRow key={e.id} entry={e} onDelete={() => onDeleteEntry(e.id)} onEdit={() => onEditEntry(e)} />)}
        </div>
      )}
    </div>
  );
}

function BeeEntryRow({ entry, onDelete, onEdit }) {
  const labels = {
    inspect:"Inspection", harvest:"Honey harvested", feed:"Fed",
    treatment:"Treatment applied", infrastructure:"Equipment",
    split:"Split logged", swarm:"Swarm logged", death:"Colony lost",
    note:"Note", winter_prep:"Winter prep", spring_buildup:"Spring buildup",
  };
  const emojis = {
    inspect:"🔍", harvest:"🍯", feed:"🌾", treatment:"💊",
    infrastructure:"🔨", split:"✂️", swarm:"🐝", death:"💀",
    note:"📓", winter_prep:"❄️", spring_buildup:"🌸",
  };
  let detail = "";
  if (entry.action==="inspect") {
    const bits = [];
    if (entry.queenSeen) bits.push("👑 queen seen");
    if (entry.broodPattern) bits.push(`brood: ${entry.broodPattern}`);
    if (entry.temperament && entry.temperament !== "Calm") bits.push(entry.temperament);
    detail = bits.join(" · ");
  } else if (entry.action==="harvest") {
    detail = `${entry.lbs||0} lbs · ${entry.jars||0} jars${entry.revenue>0?" · "+fmtMoney(entry.revenue):""}`;
  } else if (entry.action==="feed") {
    detail = `${entry.feedType||""} · ${fmtMoney(entry.cost)}`;
  } else if (entry.action==="treatment") {
    detail = `${entry.treatmentType||""}${entry.miteCount>0?" · "+entry.miteCount+" mites/100":""}`;
  } else if (entry.action==="infrastructure") {
    detail = `${entry.item||""} · ${fmtMoney(entry.cost)}`;
  } else if (entry.action==="death") {
    detail = entry.cause || "cause unknown";
  } else if (entry.note) {
    detail = entry.note.length > 50 ? entry.note.slice(0,50)+"…" : entry.note;
  }

  return (
    <div style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:10 }}>
      <div style={{ fontSize:22,flexShrink:0 }}>{emojis[entry.action]||"📝"}</div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontWeight:600,fontSize:14,color:palette.ink }}>{labels[entry.action]||entry.action}</div>
        <div style={{ fontSize:12,color:palette.inkSoft,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>
          {fmtDate(entry.date)}{detail?" · "+detail:""}
        </div>
      </div>
      {onEdit && (
        <button onClick={onEdit} style={{ background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,padding:4 }} title="Edit"><Edit3 size={16}/></button>
      )}
      {onDelete && (
        <button onClick={onDelete} style={{ background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,padding:4 }} title="Delete"><Trash2 size={16}/></button>
      )}
    </div>
  );
}

// ============ STATS — exported for AnalyticsPage ============
export function BeesAnalytics({ hobby, entries }) {
  const hives = hobby.hives || [];

  const allInspections = entries.filter(e=>e.action==="inspect");
  const allHarvests = entries.filter(e=>e.action==="harvest");
  const allTreatments = entries.filter(e=>e.action==="treatment");
  const allFeed = entries.filter(e=>e.action==="feed");
  const allInfra = entries.filter(e=>e.action==="infrastructure");

  const totalHarvestLbs = allHarvests.reduce((s,e)=>s+(Number(e.lbs)||0),0);
  const totalJars = allHarvests.reduce((s,e)=>s+(Number(e.jars)||0),0);
  const totalRevenue = allHarvests.reduce((s,e)=>s+(Number(e.revenue)||0),0);

  const feedCost = allFeed.reduce((s,e)=>s+(Number(e.cost)||0),0);
  const treatCost = allTreatments.reduce((s,e)=>s+(Number(e.cost)||0),0);
  const infraCost = allInfra.reduce((s,e)=>s+(Number(e.cost)||0),0);
  const totalCost = feedCost + treatCost + infraCost;
  const costPerLb = totalHarvestLbs > 0 ? totalCost / totalHarvestLbs : 0;

  const avgMiteCount = (() => {
    const withMites = allTreatments.filter(e=>Number(e.miteCount)>0);
    if (withMites.length === 0) return null;
    return (withMites.reduce((s,e)=>s+(Number(e.miteCount)||0),0) / withMites.length).toFixed(1);
  })();

  // Brood pattern distribution
  const broodCounts = {};
  allInspections.forEach(e => {
    if (e.broodPattern) broodCounts[e.broodPattern] = (broodCounts[e.broodPattern]||0)+1;
  });

  // Harvest by month chart
  const harvestByMonth = {};
  allHarvests.forEach(e => {
    if (e.date) {
      const key = e.date.slice(0,7);
      harvestByMonth[key] = (harvestByMonth[key]||0) + (Number(e.lbs)||0);
    }
  });
  const harvestChart = Object.entries(harvestByMonth).sort().map(([month,lbs]) => ({ month: month.slice(5), lbs: parseFloat(lbs.toFixed(1)) }));

  // Per-hive breakdown
  const hiveStats = hives.map(h => {
    const he = entries.filter(e=>e.hiveId===h.id);
    const lbs = he.filter(e=>e.action==="harvest").reduce((s,e)=>s+(Number(e.lbs)||0),0);
    const inspections = he.filter(e=>e.action==="inspect").length;
    const cost = he.filter(e=>["feed","treatment","infrastructure"].includes(e.action)).reduce((s,e)=>s+(Number(e.cost)||0),0);
    const dead = he.some(e=>e.action==="death");
    return { name: h.name, lbs, inspections, cost, dead };
  });

  if (entries.length === 0) {
    return (
      <div style={{ padding:32,background:palette.card,border:`1.5px dashed ${palette.line}`,borderRadius:12,textAlign:"center",color:palette.inkSoft }}>
        No beekeeping entries yet. Add hives and start logging from the Home tab.
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:20,margin:"0 0 12px",color:palette.ink }}>honey production</h3>
      <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:16 }}>
        <StatCard label="Total Harvested" value={`${totalHarvestLbs.toFixed(1)} lbs`} accent={palette.honey} />
        <StatCard label="Total Jars" value={totalJars} sub="filled" accent={palette.honey} />
        {totalRevenue > 0 && <StatCard label="Honey Revenue" value={fmtMoney(totalRevenue)} accent={palette.leaf} />}
        <StatCard label="Inspections" value={allInspections.length} accent={palette.feather} />
      </div>

      {harvestChart.length > 0 && (
        <ChartCard title="Harvest over time (lbs)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={harvestChart}>
              <XAxis dataKey="month" stroke={palette.inkSoft} fontSize={11} />
              <YAxis stroke={palette.inkSoft} fontSize={11} />
              <Tooltip contentStyle={{ background:palette.card,border:`1.5px solid ${palette.ink}`,borderRadius:8 }} />
              <Bar dataKey="lbs" fill={palette.honey} radius={[6,6,0,0]} name="lbs honey" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:20,margin:"12px 0 12px",color:palette.ink }}>costs</h3>
      <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:16 }}>
        <StatCard label="Total Cost" value={fmtMoney(totalCost)} accent={palette.accent} />
        <StatCard label="Feed" value={fmtMoney(feedCost)} accent={palette.feather} />
        <StatCard label="Treatments" value={fmtMoney(treatCost)} accent={palette.feather} />
        {infraCost > 0 && <StatCard label="Equipment" value={fmtMoney(infraCost)} accent={palette.feather} />}
        {costPerLb > 0 && <StatCard label="Cost / lb honey" value={fmtMoney(costPerLb)} sub="all-in" accent={palette.yolk} />}
      </div>

      {avgMiteCount && (
        <div style={{ background:palette.ink,color:palette.bg,borderRadius:12,padding:14,marginBottom:12 }}>
          <div style={{ fontSize:10,opacity:0.7,textTransform:"uppercase",letterSpacing:1.5 }}>Avg mite count</div>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:28,color:palette.honey,marginTop:4 }}>{avgMiteCount}</div>
          <div style={{ fontSize:13,opacity:0.85 }}>mites per 100 bees · action threshold is typically 2-3</div>
        </div>
      )}

      {Object.keys(broodCounts).length > 0 && (
        <ChartCard title="Brood pattern across inspections">
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {Object.entries(broodCounts).sort((a,b)=>b[1]-a[1]).map(([pattern,count]) => (
              <div key={pattern} style={{ display:"flex",justifyContent:"space-between",padding:"8px 10px",background:palette.bgAlt,borderRadius:6,fontSize:13 }}>
                <span>{pattern}</span>
                <strong>{count} inspection{count!==1?"s":""}</strong>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {hiveStats.length > 0 && (
        <ChartCard title="Per hive breakdown">
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {hiveStats.map(h => (
              <div key={h.name} style={{ padding:"10px 12px",background:palette.bgAlt,borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6 }}>
                <div>
                  <strong>{h.name}</strong>
                  {h.dead && <span style={{ background:palette.accent,color:palette.bg,fontSize:10,padding:"2px 6px",borderRadius:4,marginLeft:8 }}>LOST</span>}
                  <div style={{ fontSize:12,color:palette.inkSoft }}>{h.inspections} inspection{h.inspections!==1?"s":""}</div>
                </div>
                <div style={{ fontSize:12,color:palette.inkSoft,textAlign:"right" }}>
                  {h.lbs > 0 && <div>{h.lbs.toFixed(1)} lbs honey</div>}
                  {h.cost > 0 && <div>{fmtMoney(h.cost)} spent</div>}
                  {h.lbs===0 && h.cost===0 && <div style={{ fontStyle:"italic" }}>No data yet</div>}
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}

// ============ MAIN BEES PAGE (hives list + hive detail) ============
export default function BeesPage({ hobby, data, update }) {
  const [selectedHive, setSelectedHive] = useState(null);
  const [showAddHive, setShowAddHive] = useState(false);
  const [editingHive, setEditingHive] = useState(null);
  const [logAction, setLogAction] = useState(null);

  const hives = hobby.hives || [];
  const entries = data.entries[hobby.id] || [];

  const addHive = (hive) => {
    update(d => { const h = d.hobbies.find(x=>x.id===hobby.id); if (!h) return d; if (!h.hives) h.hives=[]; h.hives.push(hive); return d; });
  };

  const editHive = (hive) => {
    update(d => { const h = d.hobbies.find(x=>x.id===hobby.id); if (!h) return d; h.hives=(h.hives||[]).map(x=>x.id===hive.id?hive:x); return d; });
  };

  const deleteHive = (hiveId) => {
    if (!window.confirm("Delete this hive and all its entries?")) return;
    update(d => { const h = d.hobbies.find(x=>x.id===hobby.id); if (!h) return d; h.hives=(h.hives||[]).filter(x=>x.id!==hiveId); d.entries[hobby.id]=(d.entries[hobby.id]||[]).filter(e=>e.hiveId!==hiveId); return d; });
    setSelectedHive(null);
  };

  const saveEntry = (entry) => {
    update(d => { if (!d.entries[hobby.id]) d.entries[hobby.id]=[]; d.entries[hobby.id].push(entry); return d; });
  };
  const deleteEntry = (entryId) => { update(d => { d.entries[hobby.id] = (d.entries[hobby.id]||[]).filter(e=>e.id!==entryId); return d; }); };
  const [editingEntry, setEditingEntry] = useState(null);
  const saveEditedEntry = (entry) => { update(d => { const idx = (d.entries[hobby.id]||[]).findIndex(e=>e.id===entry.id); if (idx!==-1) d.entries[hobby.id][idx]=entry; return d; }); };

  const currentHive = hives.find(h=>h.id===selectedHive);

  return (
    <div>
      {showAddHive && <HiveModal onSave={addHive} onClose={()=>setShowAddHive(false)} />}
      {editingHive && <HiveModal hive={editingHive} onSave={editHive} onClose={()=>setEditingHive(null)} />}
      {logAction && currentHive && (
        <LogEntryModal hive={currentHive} action={logAction} onSave={saveEntry} onClose={()=>setLogAction(null)} />
      )}
      {editingEntry && currentHive && (
        <LogEntryModal hive={currentHive} action={editingEntry.action} onSave={saveEditedEntry} onClose={()=>setEditingEntry(null)} existingEntry={editingEntry} />
      )}

      {currentHive ? (
        <HiveDetail
          hive={currentHive}
          entries={entries}
          onLog={setLogAction}
          onEdit={()=>setEditingHive(currentHive)}
          onDelete={()=>deleteHive(currentHive.id)}
          onBack={()=>setSelectedHive(null)}
          onDeleteEntry={deleteEntry}
          onEditEntry={setEditingEntry}
        />
      ) : (
        <div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <h2 style={{ fontFamily:FONT_DISPLAY,fontSize:26,margin:0,color:palette.ink }}>your hives</h2>
            <Btn small onClick={()=>setShowAddHive(true)}>+ Add Hive</Btn>
          </div>

          {hives.length === 0 ? (
            <div style={{ padding:32,background:palette.card,border:`2px dashed ${palette.ink}`,borderRadius:12,textAlign:"center" }}>
              <div style={{ fontSize:40,marginBottom:10 }}>🐝</div>
              <div style={{ fontFamily:FONT_DISPLAY,fontSize:22,marginBottom:6,color:palette.ink }}>No hives yet</div>
              <div style={{ color:palette.inkSoft,marginBottom:16,fontSize:14 }}>Add your first hive to start tracking your bees.</div>
              <Btn variant="accent" onClick={()=>setShowAddHive(true)}>+ Add your first hive</Btn>
            </div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              {hives.map(hive => {
                const hiveEntries = entries.filter(e=>e.hiveId===hive.id);
                const lastInspect = [...hiveEntries].filter(e=>e.action==="inspect").sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
                const totalLbs = hiveEntries.filter(e=>e.action==="harvest").reduce((s,e)=>s+(Number(e.lbs)||0),0);
                const isDead = hiveEntries.some(e=>e.action==="death");
                const daysSinceInspect = lastInspect ? Math.floor((Date.now()-new Date(lastInspect.date+"T12:00").getTime())/(1000*60*60*24)) : null;
                return (
                  <div key={hive.id} onClick={()=>setSelectedHive(hive.id)} style={{ background:palette.card,border:`1.5px solid ${isDead?palette.accent:palette.line}`,borderRadius:12,padding:14,cursor:"pointer",display:"flex",alignItems:"center",gap:14 }}>
                    <div style={{ fontSize:32,flexShrink:0 }}>{isDead?"🪦":"🐝"}</div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink,lineHeight:1.2 }}>{hive.name}</div>
                      <div style={{ fontSize:12,color:palette.inkSoft,marginTop:2 }}>
                        {hive.type} · {hive.source} · since {fmtDate(hive.installDate)}
                      </div>
                      <div style={{ display:"flex",gap:10,marginTop:4,flexWrap:"wrap" }}>
                        {totalLbs > 0 && <span style={{ fontSize:11,background:palette.honeySoft,color:palette.ink,padding:"2px 6px",borderRadius:4,fontWeight:600 }}>🍯 {totalLbs.toFixed(1)} lbs</span>}
                        {lastInspect && <span style={{ fontSize:11,background:palette.bgAlt,color:palette.ink,padding:"2px 6px",borderRadius:4,fontWeight:600 }}>🔍 {daysSinceInspect}d ago</span>}
                        {isDead && <span style={{ fontSize:11,background:palette.accent,color:palette.bg,padding:"2px 6px",borderRadius:4,fontWeight:600 }}>Lost</span>}
                        {daysSinceInspect !== null && daysSinceInspect > 14 && !isDead && <span style={{ fontSize:11,background:palette.yolkSoft,color:palette.ink,padding:"2px 6px",borderRadius:4,fontWeight:600 }}>⚠️ Due for inspection</span>}
                      </div>
                    </div>
                    <div style={{ color:palette.inkSoft,fontSize:18 }}>›</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
