import React, { useState } from "react";
import { X, Edit3, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47", featherSoft: "#C9A77B",
  line: "#2C181030", card: "#FAF5EA",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
};

const RABBIT_BREEDS = [
  "New Zealand", "Californian", "Rex", "Holland Lop", "Mini Rex",
  "Flemish Giant", "Dutch", "Lionhead", "Angora", "Champagne d'Argent",
  "American Chinchilla", "Satin", "Silver Fox", "Palomino", "Mixed / Other",
];

const newId = () => Math.random().toString(36).slice(2, 10);
const localDateStr = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const todayStr = () => localDateStr(new Date());
const parseLocalDate = (s) => { if (!s) return new Date(); const [y,m,d] = s.split("-").map(Number); return new Date(y,(m||1)-1,d||1); };
const fmtDate = (s) => { if (!s) return ""; return parseLocalDate(s).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); };
const fmtMoney = (n) => `$${(Number(n)||0).toFixed(2)}`;
const addDays = (dateStr, days) => localDateStr(new Date(parseLocalDate(dateStr).getTime() + days*24*60*60*1000));

function Btn({ children, onClick, variant="primary", small=false, style={}, type="button", disabled=false }) {
  const styles = {
    primary: { background: palette.ink, color: palette.bg, border: `1.5px solid ${palette.ink}` },
    danger: { background: palette.accent, color: palette.bg, border: `1.5px solid ${palette.accent}` },
    ghost: { background: "transparent", color: palette.ink, border: `1.5px solid ${palette.line}` },
    accent: { background: palette.yolk, color: palette.ink, border: `1.5px solid ${palette.ink}` },
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

// ============ BREEDING REMINDERS CARD ============
function BreedingRemindersCard({ hutches, entries, update }) {
  const today = todayStr();

  const reminders = hutches.map(hutch => {
    const hutchBreedings = entries
      .filter(e => e.hatchId === hutch.id && e.action === "bred" && e.kindleDate)
      .sort((a,b) => (b.date||"").localeCompare(a.date||""));
    if (hutchBreedings.length === 0) return null;
    const lastBred = hutchBreedings[0];
    const breedDate = lastBred.date;
    const kindleDate = lastBred.kindleDate;

    const milestones = [
      { emoji: "👋", label: "Palpate doe", date: addDays(breedDate, 14), type: "rabbits" },
      { emoji: "📦", label: "Add nest box", date: addDays(breedDate, 28), type: "rabbits" },
      { emoji: "🍼", label: `Due to kindle${lastBred.doeName ? " ("+lastBred.doeName+")" : ""}`, date: kindleDate, type: "rabbits" },
      { emoji: "🥛", label: "Wean kits", date: addDays(kindleDate, 35), type: "rabbits" },
      { emoji: "❄️", label: "Process / butcher", date: addDays(kindleDate, 70), type: "rabbits" },
    ].filter(m => m.date >= today);

    if (milestones.length === 0) return null;
    return { hutch, lastBred, milestones };
  }).filter(Boolean);

  if (reminders.length === 0) return null;

  const addAllToCalendar = (r) => {
    update(d => {
      d.calendarEvents = d.calendarEvents || [];
      r.milestones.forEach(m => {
        const title = `🐇 ${r.hutch.name} — ${m.label}`;
        const exists = d.calendarEvents.some(e => e.title === title && e.date === m.date);
        if (!exists) {
          d.calendarEvents.push({
            id: newId(), date: m.date, title, type: "rabbits",
            notes: `Bred ${fmtDate(r.lastBred.date)}${r.lastBred.doeName ? " · " + r.lastBred.doeName : ""}`,
          });
        }
      });
      return d;
    });
  };

  return (
    <div style={{ marginBottom: 14 }}>
      {reminders.map(r => (
        <div key={r.hutch.id} style={{ background: palette.yolkSoft, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8 }}>
            <div>
              <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:2 }}>Breeding reminders</div>
              <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,color:palette.ink }}>{r.hutch.name}</div>
              <div style={{ fontSize:11,color:palette.inkSoft }}>Bred {fmtDate(r.lastBred.date)}{r.lastBred.doeName?" · "+r.lastBred.doeName:""}</div>
            </div>
            <button onClick={() => addAllToCalendar(r)} style={{
              padding:"8px 12px",borderRadius:8,background:palette.ink,color:palette.bg,
              border:`1.5px solid ${palette.ink}`,fontFamily:FONT_BODY,fontWeight:600,fontSize:12,
              cursor:"pointer",whiteSpace:"nowrap",boxShadow:"2px 2px 0 "+palette.line,
            }}>📅 Add all to Calendar</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {r.milestones.map((m, i) => (
              <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:palette.card,borderRadius:8,border:`1.5px solid ${palette.line}` }}>
                <div style={{ fontSize:18,flexShrink:0 }}>{m.emoji}</div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:13,color:palette.ink,fontWeight:500 }}>{m.label}</div>
                  <div style={{ fontSize:11,color:palette.inkSoft }}>{fmtDate(m.date)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ ADD / EDIT HUTCH MODAL ============
function HutchModal({ hutch, onSave, onClose }) {
  const [name, setName] = useState(hutch?.name || "");
  const [breed, setBreed] = useState(hutch?.breed || "New Zealand");
  const [does, setDoes] = useState(hutch?.does ?? 1);
  const [bucks, setBucks] = useState(hutch?.bucks ?? 1);
  const [startDate, setStartDate] = useState(hutch?.startDate || todayStr());
  const [notes, setNotes] = useState(hutch?.notes || "");

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ id: hutch?.id || newId(), name: name.trim(), breed, does: Number(does)||0, bucks: Number(bucks)||0, startDate, notes, active: hutch?.active !== false });
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(44,24,16,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:palette.bg,borderRadius:16,maxWidth:460,width:"100%",maxHeight:"90vh",overflow:"auto",border:`2px solid ${palette.ink}`,boxShadow:`6px 8px 0 ${palette.line}` }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1.5px solid ${palette.line}` }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:22,color:palette.ink }}>{hutch ? "Edit Hutch" : "Add Hutch"}</div>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:palette.ink,padding:4 }}><X size={22}/></button>
        </div>
        <div style={{ padding:20,display:"flex",flexDirection:"column",gap:14 }}>
          <label><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Hutch Name</div>
            <input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Hutch 1, East Run, Mama's hutch" autoFocus /></label>
          <label><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Breed</div>
            <select style={inputStyle} value={breed} onChange={e=>setBreed(e.target.value)}>{RABBIT_BREEDS.map(b => <option key={b} value={b}>{b}</option>)}</select></label>
          <div style={{ display:"flex",gap:12 }}>
            <label style={{ flex:1 }}><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Does (females)</div>
              <input style={inputStyle} type="number" min={0} value={does} onChange={e=>setDoes(e.target.value)} /></label>
            <label style={{ flex:1 }}><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Bucks (males)</div>
              <input style={inputStyle} type="number" min={0} value={bucks} onChange={e=>setBucks(e.target.value)} /></label>
          </div>
          <label><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Start Date</div>
            <input style={inputStyle} type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} /></label>
          <label><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Notes (optional)</div>
            <textarea style={{ ...inputStyle,minHeight:60,resize:"vertical" }} value={notes} onChange={e=>setNotes(e.target.value)} /></label>
          <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn onClick={handleSave} disabled={!name.trim()}>Save Hutch</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ LOG ENTRY MODAL ============
function LogEntryModal({ hutch, action, onSave, onClose }) {
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [breedDate, setBreedDate] = useState(todayStr());
  const [doeName, setDoeName] = useState("");
  const [kitsAlive, setKitsAlive] = useState("");
  const [kitsStillborn, setKitsStillborn] = useState("");
  const [litterDate, setLitterDate] = useState(todayStr());
  const [count, setCount] = useState("");
  const [avgWeight, setAvgWeight] = useState("");
  const [deathCount, setDeathCount] = useState(1);
  const [cause, setCause] = useState("Unknown");
  const [lbs, setLbs] = useState("");
  const [cost, setCost] = useState("");
  const [item, setItem] = useState("");
  const [infraCost, setInfraCost] = useState("");

  const kindleDate = breedDate ? localDateStr(new Date(parseLocalDate(breedDate).getTime() + 31*24*60*60*1000)) : "";

  const handleSave = () => {
    let entry = { id: newId(), date, action, hatchId: hutch.id, created: Date.now() };
    if (action === "bred") entry = { ...entry, date: breedDate, doeName, kindleDate };
    else if (action === "litter") entry = { ...entry, date: litterDate, kitsAlive: Number(kitsAlive)||0, kitsStillborn: Number(kitsStillborn)||0, note };
    else if (action === "butcher") entry = { ...entry, count: Number(count)||0, avgWeight: Number(avgWeight)||0, note };
    else if (action === "death") entry = { ...entry, count: Number(deathCount)||1, cause };
    else if (action === "fed") entry = { ...entry, lbs: Number(lbs)||0, cost: Number(cost)||0 };
    else if (action === "infrastructure") entry = { ...entry, item, cost: Number(infraCost)||0 };
    else entry = { ...entry, note };
    onSave(entry);
    onClose();
  };

  const titles = { bred:"🐇 Log Breeding", litter:"🍼 Log Litter", fed:"🌾 Log Feed", watered:"💧 Log Watering", butcher:"❄️ Log Butcher", death:"💀 Report Death", infrastructure:"🔨 Infrastructure", note:"📓 Note", free_range:"🌿 Free Range" };

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(44,24,16,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:palette.bg,borderRadius:16,maxWidth:460,width:"100%",maxHeight:"90vh",overflow:"auto",border:`2px solid ${palette.ink}`,boxShadow:`6px 8px 0 ${palette.line}` }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1.5px solid ${palette.line}` }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:22,color:palette.ink }}>{titles[action]||action}</div>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:palette.ink,padding:4 }}><X size={22}/></button>
        </div>
        <div style={{ padding:20,display:"flex",flexDirection:"column",gap:14 }}>
          {action === "bred" && <>
            <label><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Breed Date</div>
              <input style={inputStyle} type="date" value={breedDate} onChange={e=>setBreedDate(e.target.value)} /></label>
            <label><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Doe Name (optional)</div>
              <input style={inputStyle} value={doeName} onChange={e=>setDoeName(e.target.value)} placeholder="e.g. Biscuit" /></label>
            {kindleDate && <div style={{ padding:"10px 14px",background:palette.yolkSoft,borderRadius:8,fontSize:13,color:palette.ink }}>
              📅 Expected kindle: <strong>{fmtDate(kindleDate)}</strong> (31 days)
              <div style={{ fontSize:11,color:palette.inkSoft,marginTop:4 }}>Reminders will appear on the Hutches home page after saving.</div>
            </div>}
          </>}
          {action === "litter" && <>
            <label><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Kindle Date</div>
              <input style={inputStyle} type="date" value={litterDate} onChange={e=>setLitterDate(e.target.value)} /></label>
            <div style={{ display:"flex",gap:12 }}>
              <label style={{ flex:1 }}><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Kits Alive</div>
                <input style={inputStyle} type="number" min={0} value={kitsAlive} onChange={e=>setKitsAlive(e.target.value)} placeholder="0" /></label>
              <label style={{ flex:1 }}><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Stillborn</div>
                <input style={inputStyle} type="number" min={0} value={kitsStillborn} onChange={e=>setKitsStillborn(e.target.value)} placeholder="0" /></label>
            </div>
            <label><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Notes</div>
              <textarea style={{ ...inputStyle,minHeight:60,resize:"vertical" }} value={note} onChange={e=>setNote(e.target.value)} /></label>
          </>}
          {action === "fed" && <>
            <label><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Date</div>
              <input style={inputStyle} type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
            <div style={{ display:"flex",gap:12 }}>
              <label style={{ flex:1 }}><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Lbs of feed</div>
                <input style={inputStyle} type="number" min={0} step="0.1" value={lbs} onChange={e=>setLbs(e.target.value)} placeholder="0" /></label>
              <label style={{ flex:1 }}><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Cost ($)</div>
                <input style={inputStyle} type="number" min={0} step="0.01" value={cost} onChange={e=>setCost(e.target.value)} placeholder="0.00" /></label>
            </div>
          </>}
          {action === "watered" && <>
            <label><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Date</div>
              <input style={inputStyle} type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
            <label><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Notes (optional)</div>
              <input style={inputStyle} value={note} onChange={e=>setNote(e.target.value)} /></label>
          </>}
          {action === "butcher" && <>
            <label><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Date</div>
              <input style={inputStyle} type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
            <div style={{ display:"flex",gap:12 }}>
              <label style={{ flex:1 }}><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Count</div>
                <input style={inputStyle} type="number" min={0} value={count} onChange={e=>setCount(e.target.value)} /></label>
              <label style={{ flex:1 }}><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Avg Weight (lbs)</div>
                <input style={inputStyle} type="number" min={0} step="0.1" value={avgWeight} onChange={e=>setAvgWeight(e.target.value)} /></label>
            </div>
            <label><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Notes (optional)</div>
              <input style={inputStyle} value={note} onChange={e=>setNote(e.target.value)} /></label>
          </>}
          {action === "death" && <>
            <label><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Date</div>
              <input style={inputStyle} type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
            <div style={{ display:"flex",gap:12 }}>
              <label style={{ flex:1 }}><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Count</div>
                <input style={inputStyle} type="number" min={1} value={deathCount} onChange={e=>setDeathCount(e.target.value)} /></label>
              <label style={{ flex:1 }}><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Cause</div>
                <select style={inputStyle} value={cause} onChange={e=>setCause(e.target.value)}>
                  {["Unknown","Disease","Predator","Heat stress","Cold","Injury","Kit loss","Other"].map(c=><option key={c}>{c}</option>)}</select></label>
            </div>
          </>}
          {action === "infrastructure" && <>
            <label><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Date</div>
              <input style={inputStyle} type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
            <label><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Item</div>
              <input style={inputStyle} value={item} onChange={e=>setItem(e.target.value)} placeholder="e.g. Hutch build, feeders, wire..." /></label>
            <label><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Cost ($)</div>
              <input style={inputStyle} type="number" min={0} step="0.01" value={infraCost} onChange={e=>setInfraCost(e.target.value)} /></label>
          </>}
          {(action === "note" || action === "free_range") && <>
            <label><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>Date</div>
              <input style={inputStyle} type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
            <label><div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>{action === "free_range" ? "Notes" : "Note"}</div>
              <textarea style={{ ...inputStyle,minHeight:80,resize:"vertical" }} value={note} onChange={e=>setNote(e.target.value)} autoFocus /></label>
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

// ============ HUTCH DETAIL VIEW ============
function HutchDetail({ hutch, entries, onLog, onEdit, onDelete, onBack }) {
  const hutchEntries = entries.filter(e => e.hatchId === hutch.id).sort((a,b) => (b.date||"").localeCompare(a.date||""));
  const totalButchered = hutchEntries.filter(e=>e.action==="butcher").reduce((s,e)=>s+(Number(e.count)||0),0);
  const totalLitters = hutchEntries.filter(e=>e.action==="litter").length;
  const totalKits = hutchEntries.filter(e=>e.action==="litter").reduce((s,e)=>s+(Number(e.kitsAlive)||0),0);
  const feedCost = hutchEntries.filter(e=>e.action==="fed").reduce((s,e)=>s+(Number(e.cost)||0),0);
  const infraCost = hutchEntries.filter(e=>e.action==="infrastructure").reduce((s,e)=>s+(Number(e.cost)||0),0);
  const totalCost = feedCost + infraCost;
  const lastBred = [...hutchEntries].filter(e=>e.action==="bred").sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];

  return (
    <div>
      <button onClick={onBack} style={{ background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,fontFamily:FONT_BODY,fontSize:13,display:"flex",alignItems:"center",gap:6,marginBottom:16,padding:0 }}>← All Hutches</button>
      <div style={{ background:palette.ink,color:palette.bg,borderRadius:12,padding:14,marginBottom:12 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:10,opacity:0.7,textTransform:"uppercase",letterSpacing:1.5,marginBottom:4 }}>Active Hutch · {hutch.breed}</div>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:28,color:palette.yolk,lineHeight:1 }}>{hutch.name}</div>
            <div style={{ fontSize:13,opacity:0.85,marginTop:4 }}>{hutch.does} doe{hutch.does!==1?"s":""} · {hutch.bucks} buck{hutch.bucks!==1?"s":""} · since {fmtDate(hutch.startDate)}</div>
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={onEdit} style={{ background:"none",border:"none",cursor:"pointer",color:palette.bg,opacity:0.7,padding:4 }}><Edit3 size={16}/></button>
            <button onClick={onDelete} style={{ background:"none",border:"none",cursor:"pointer",color:palette.accent,padding:4 }}><Trash2 size={16}/></button>
          </div>
        </div>
      </div>
      {lastBred && lastBred.kindleDate && (
        <div style={{ background:palette.yolkSoft,border:`1.5px solid ${palette.line}`,borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:palette.ink }}>
          🍼 Next expected kindle: <strong>{fmtDate(lastBred.kindleDate)}</strong>{lastBred.doeName && ` (${lastBred.doeName})`}
        </div>
      )}
      {hutchEntries.length > 0 && (
        <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:12 }}>
          {totalLitters > 0 && <div style={{ flex:"1 1 120px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:10,padding:12 }}>
            <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Litters</div>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:24,color:palette.leaf }}>{totalLitters}</div>
            <div style={{ fontSize:11,color:palette.inkSoft }}>{totalKits} kits alive</div>
          </div>}
          {totalButchered > 0 && <div style={{ flex:"1 1 120px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:10,padding:12 }}>
            <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Butchered</div>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:24,color:palette.ink }}>{totalButchered}</div>
          </div>}
          {totalCost > 0 && <div style={{ flex:"1 1 120px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:10,padding:12 }}>
            <div style={{ fontSize:10,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:1,marginBottom:4 }}>Total Cost</div>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:24,color:palette.accent }}>{fmtMoney(totalCost)}</div>
          </div>}
        </div>
      )}
      <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:20,margin:"16px 0 10px",color:palette.ink }}>quick log</h3>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:10,marginBottom:20 }}>
        {[{action:"bred",label:"Breeding",emoji:"🐇"},{action:"litter",label:"Litter",emoji:"🍼"},{action:"fed",label:"Fed",emoji:"🌾"},{action:"watered",label:"Watered",emoji:"💧"},{action:"butcher",label:"Butcher",emoji:"❄️"},{action:"death",label:"Death",emoji:"💀"},{action:"free_range",label:"Free Range",emoji:"🌿"},{action:"infrastructure",label:"Infrastructure",emoji:"🔨"},{action:"note",label:"Note",emoji:"📓"}].map(({action,label,emoji}) => (
          <button key={action} onClick={()=>onLog(action)} style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:"14px 10px",display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer",fontFamily:FONT_BODY,color:palette.ink,boxShadow:`2px 3px 0 ${palette.line}`,minHeight:80 }}>
            <div style={{ fontSize:22 }}>{emoji}</div>
            <div style={{ fontSize:12,fontWeight:600,textAlign:"center",lineHeight:1.2 }}>{label}</div>
          </button>
        ))}
      </div>
      <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:20,margin:"0 0 10px",color:palette.ink }}>recent activity</h3>
      {hutchEntries.length === 0 ? (
        <div style={{ padding:24,background:palette.card,border:`1.5px dashed ${palette.line}`,borderRadius:12,textAlign:"center",color:palette.inkSoft }}>No entries yet — tap a tile above to get started.</div>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
          {hutchEntries.slice(0,10).map(e => <RabbitEntryRow key={e.id} entry={e} />)}
        </div>
      )}
    </div>
  );
}

function RabbitEntryRow({ entry }) {
  const labels = { bred:"Breeding logged", litter:"Litter born", fed:"Fed", watered:"Watered", butcher:"Butchered", death:"Death reported", free_range:"Free ranged", infrastructure:"Infrastructure", note:"Note" };
  const emojis = { bred:"🐇", litter:"🍼", fed:"🌾", watered:"💧", butcher:"❄️", death:"💀", free_range:"🌿", infrastructure:"🔨", note:"📓" };
  let detail = "";
  if (entry.action==="bred") detail = `Expected kindle ${fmtDate(entry.kindleDate)}${entry.doeName?" · "+entry.doeName:""}`;
  else if (entry.action==="litter") detail = `${entry.kitsAlive||0} alive${entry.kitsStillborn>0?" · "+entry.kitsStillborn+" stillborn":""}`;
  else if (entry.action==="fed") detail = `${entry.lbs||0} lbs · ${fmtMoney(entry.cost)}`;
  else if (entry.action==="butcher") detail = `${entry.count||0} rabbits · avg ${entry.avgWeight||0} lbs`;
  else if (entry.action==="death") detail = `${entry.count||1} · ${entry.cause||"unknown"}`;
  else if (entry.action==="infrastructure") detail = `${entry.item||""} · ${fmtMoney(entry.cost)}`;
  else if (entry.note) detail = entry.note.length > 50 ? entry.note.slice(0,50)+"…" : entry.note;
  return (
    <div style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:10 }}>
      <div style={{ fontSize:22,flexShrink:0 }}>{emojis[entry.action]||"📝"}</div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ fontWeight:600,fontSize:14,color:palette.ink }}>{labels[entry.action]||entry.action}</div>
        <div style={{ fontSize:12,color:palette.inkSoft,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{fmtDate(entry.date)}{detail?" · "+detail:""}</div>
      </div>
    </div>
  );
}

// ============ STATS — exported ============
export function RabbitsAnalytics({ hobby, entries }) {
  const hutches = hobby.hutches || [];
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
  const totalButchered = allButcher.reduce((s,e)=>s+(Number(e.count)||0),0);
  const totalWeight = allButcher.reduce((s,e)=>s+(Number(e.count)||0)*(Number(e.avgWeight)||0),0);
  const avgButcherWeight = totalButchered > 0 ? (totalWeight/totalButchered).toFixed(2) : "—";
  const totalDeaths = allDeaths.reduce((s,e)=>s+(Number(e.count)||1),0);
  const feedCost = allFeed.reduce((s,e)=>s+(Number(e.cost)||0),0);
  const infraCost = allInfra.reduce((s,e)=>s+(Number(e.cost)||0),0);
  const totalCost = feedCost + infraCost;
  const costPerRabbit = totalButchered > 0 ? (totalCost/totalButchered).toFixed(2) : "—";
  const deathCauses = {};
  allDeaths.forEach(e => { const c = e.cause || "Unknown"; deathCauses[c] = (deathCauses[c]||0) + (Number(e.count)||1); });
  const littersByHutch = hutches.map(h => ({ name: h.name, kits: entries.filter(e=>e.hatchId===h.id&&e.action==="litter").reduce((s,e)=>s+(Number(e.kitsAlive)||0),0) })).filter(h=>h.kits>0);

  if (entries.length === 0) return (
    <div style={{ padding:32,background:palette.card,border:`1.5px dashed ${palette.line}`,borderRadius:12,textAlign:"center",color:palette.inkSoft }}>No rabbit entries yet. Add hutches and start logging from the Home tab.</div>
  );

  return (
    <div>
      <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:20,margin:"0 0 12px",color:palette.ink }}>breeding</h3>
      <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:16 }}>
        <StatCard label="Total Litters" value={totalLitters} accent={palette.leaf} />
        <StatCard label="Avg Litter Size" value={avgLitterSize} sub="kits alive" accent={palette.leaf} />
        <StatCard label="Breeding Success" value={breedingSuccessRate !== "—" ? breedingSuccessRate+"%" : "—"} sub="breedings → litters" accent={palette.feather} />
        <StatCard label="Stillborn Rate" value={stillbornRate+"%"} sub={`${totalStillborn} of ${totalKitsBorn} kits`} accent={totalStillborn > 0 ? palette.accent : palette.inkSoft} />
      </div>
      <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:20,margin:"0 0 12px",color:palette.ink }}>meat production</h3>
      <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:16 }}>
        <StatCard label="Total Butchered" value={totalButchered} accent={palette.ink} />
        <StatCard label="Avg Final Weight" value={avgButcherWeight !== "—" ? avgButcherWeight+" lbs" : "—"} accent={palette.feather} />
        <StatCard label="Total Meat" value={totalWeight > 0 ? totalWeight.toFixed(1)+" lbs" : "—"} accent={palette.leaf} />
        {totalDeaths > 0 && <StatCard label="Total Deaths" value={totalDeaths} accent={palette.accent} />}
      </div>
      <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:20,margin:"0 0 12px",color:palette.ink }}>costs</h3>
      <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:16 }}>
        <StatCard label="Total Cost" value={fmtMoney(totalCost)} accent={palette.accent} />
        <StatCard label="Feed Cost" value={fmtMoney(feedCost)} accent={palette.feather} />
        {infraCost > 0 && <StatCard label="Infrastructure" value={fmtMoney(infraCost)} accent={palette.feather} />}
        <StatCard label="Cost / Rabbit" value={costPerRabbit !== "—" ? fmtMoney(Number(costPerRabbit)) : "—"} sub="all-in" accent={palette.yolk} />
      </div>
      {littersByHutch.length > 1 && (
        <ChartCard title="Kits born by hutch">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={littersByHutch}>
              <XAxis dataKey="name" stroke={palette.inkSoft} fontSize={11} />
              <YAxis stroke={palette.inkSoft} fontSize={11} />
              <Tooltip contentStyle={{ background:palette.card,border:`1.5px solid ${palette.ink}`,borderRadius:8 }} />
              <Bar dataKey="kits" fill={palette.leaf} radius={[6,6,0,0]} name="Kits alive" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
      {Object.keys(deathCauses).length > 0 && (
        <ChartCard title={`Deaths by cause (${totalDeaths} total)`}>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {Object.entries(deathCauses).sort((a,b)=>b[1]-a[1]).map(([cause,count]) => (
              <div key={cause} style={{ display:"flex",justifyContent:"space-between",padding:"8px 10px",background:palette.bgAlt,borderRadius:6,fontSize:13 }}>
                <span style={{ textTransform:"capitalize" }}>{cause}</span><strong>{count}</strong>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
      {hutches.length > 0 && (
        <ChartCard title="Per hutch breakdown">
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {hutches.map(h => {
              const he = entries.filter(e=>e.hatchId===h.id);
              const litters = he.filter(e=>e.action==="litter").length;
              const kits = he.filter(e=>e.action==="litter").reduce((s,e)=>s+(Number(e.kitsAlive)||0),0);
              const butchered = he.filter(e=>e.action==="butcher").reduce((s,e)=>s+(Number(e.count)||0),0);
              const cost = he.filter(e=>e.action==="fed"||e.action==="infrastructure").reduce((s,e)=>s+(Number(e.cost)||0),0);
              return (
                <div key={h.id} style={{ padding:"10px 12px",background:palette.bgAlt,borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6 }}>
                  <div><strong>{h.name}</strong><div style={{ fontSize:12,color:palette.inkSoft }}>{h.breed} · {h.does} does · {h.bucks} bucks</div></div>
                  <div style={{ fontSize:12,color:palette.inkSoft,textAlign:"right" }}>
                    {litters > 0 && <div>{litters} litters · {kits} kits</div>}
                    {butchered > 0 && <div>{butchered} butchered</div>}
                    {cost > 0 && <div>{fmtMoney(cost)}</div>}
                    {litters === 0 && butchered === 0 && cost === 0 && <div style={{ fontStyle:"italic" }}>No entries yet</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}
    </div>
  );
}

// ============ MAIN RABBITS PAGE ============
export default function RabbitsPage({ hobby, data, update }) {
  const [selectedHutch, setSelectedHutch] = useState(null);
  const [showAddHutch, setShowAddHutch] = useState(false);
  const [editingHutch, setEditingHutch] = useState(null);
  const [logAction, setLogAction] = useState(null);

  const hutches = hobby.hutches || [];
  const entries = data.entries[hobby.id] || [];

  const addHutch = (hutch) => { update(d => { const h = d.hobbies.find(x=>x.id===hobby.id); if (!h) return d; if (!h.hutches) h.hutches=[]; h.hutches.push(hutch); return d; }); };
  const editHutch = (hutch) => { update(d => { const h = d.hobbies.find(x=>x.id===hobby.id); if (!h) return d; h.hutches=(h.hutches||[]).map(x=>x.id===hutch.id?hutch:x); return d; }); };
  const deleteHutch = (hutchId) => {
    if (!window.confirm("Delete this hutch and all its entries?")) return;
    update(d => { const h = d.hobbies.find(x=>x.id===hobby.id); if (!h) return d; h.hutches=(h.hutches||[]).filter(x=>x.id!==hutchId); d.entries[hobby.id]=(d.entries[hobby.id]||[]).filter(e=>e.hatchId!==hutchId); return d; });
    setSelectedHutch(null);
  };
  const saveEntry = (entry) => { update(d => { if (!d.entries[hobby.id]) d.entries[hobby.id]=[]; d.entries[hobby.id].push(entry); return d; }); };
  const currentHutch = hutches.find(h=>h.id===selectedHutch);

  return (
    <div>
      {showAddHutch && <HutchModal onSave={addHutch} onClose={()=>setShowAddHutch(false)} />}
      {editingHutch && <HutchModal hutch={editingHutch} onSave={editHutch} onClose={()=>setEditingHutch(null)} />}
      {logAction && currentHutch && <LogEntryModal hutch={currentHutch} action={logAction} onSave={saveEntry} onClose={()=>setLogAction(null)} />}
      {currentHutch ? (
        <HutchDetail hutch={currentHutch} entries={entries} onLog={setLogAction} onEdit={()=>setEditingHutch(currentHutch)} onDelete={()=>deleteHutch(currentHutch.id)} onBack={()=>setSelectedHutch(null)} />
      ) : (
        <div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <h2 style={{ fontFamily:FONT_DISPLAY,fontSize:26,margin:0,color:palette.ink }}>your hutches</h2>
            <Btn small onClick={()=>setShowAddHutch(true)}>+ Add Hutch</Btn>
          </div>
          {hutches.length > 0 && <BreedingRemindersCard hutches={hutches} entries={entries} update={update} />}
          {hutches.length === 0 ? (
            <div style={{ padding:32,background:palette.card,border:`2px dashed ${palette.ink}`,borderRadius:12,textAlign:"center" }}>
              <div style={{ fontSize:40,marginBottom:10 }}>🐇</div>
              <div style={{ fontFamily:FONT_DISPLAY,fontSize:22,marginBottom:6,color:palette.ink }}>No hutches yet</div>
              <div style={{ color:palette.inkSoft,marginBottom:16,fontSize:14 }}>Add your first hutch to start tracking your rabbits.</div>
              <Btn variant="accent" onClick={()=>setShowAddHutch(true)}>+ Add your first hutch</Btn>
            </div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              {hutches.map(hutch => {
                const hutchEntries = entries.filter(e=>e.hatchId===hutch.id);
                const lastBred = [...hutchEntries].filter(e=>e.action==="bred").sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
                const totalKits = hutchEntries.filter(e=>e.action==="litter").reduce((s,e)=>s+(Number(e.kitsAlive)||0),0);
                const totalButchered = hutchEntries.filter(e=>e.action==="butcher").reduce((s,e)=>s+(Number(e.count)||0),0);
                return (
                  <div key={hutch.id} onClick={()=>setSelectedHutch(hutch.id)} style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,cursor:"pointer",display:"flex",alignItems:"center",gap:14 }}>
                    <div style={{ fontSize:32,flexShrink:0 }}>🐇</div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontFamily:FONT_DISPLAY,fontSize:20,color:palette.ink,lineHeight:1.2 }}>{hutch.name}</div>
                      <div style={{ fontSize:12,color:palette.inkSoft,marginTop:2 }}>{hutch.breed} · {hutch.does} doe{hutch.does!==1?"s":""} · {hutch.bucks} buck{hutch.bucks!==1?"s":""}</div>
                      <div style={{ display:"flex",gap:10,marginTop:4,flexWrap:"wrap" }}>
                        {totalKits > 0 && <span style={{ fontSize:11,background:palette.leafSoft,color:palette.ink,padding:"2px 6px",borderRadius:4,fontWeight:600 }}>{totalKits} kits</span>}
                        {totalButchered > 0 && <span style={{ fontSize:11,background:palette.bgAlt,color:palette.ink,padding:"2px 6px",borderRadius:4,fontWeight:600 }}>{totalButchered} butchered</span>}
                        {lastBred?.kindleDate && <span style={{ fontSize:11,background:palette.yolkSoft,color:palette.ink,padding:"2px 6px",borderRadius:4,fontWeight:600 }}>🍼 {fmtDate(lastBred.kindleDate)}</span>}
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
