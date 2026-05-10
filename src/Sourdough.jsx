// ============================================================================
// SOURDOUGH PAGE
// ----------------------------------------------------------------------------
// Hobby for tracking sourdough baking. Two equal pillars: starter management
// (feed schedule, days-since-fed, multiple starters optional) and bakes
// (loaves baked, recipe, cost/profit, sales tied through data.sales).
//
// Data shape on the hobby:
//   hobby.starters[] = [{ id, name, createdAt, lastFedAt, hydration, notes,
//                         archived, archivedReason }]
//   hobby.bakes[]    = [{ id, date, recipe, loafCount, weightPerLoafG, costPerLoaf,
//                         starterId, notes, crumbRating }]
//
// Sales: writes to data.sales[] with hobbyType: "sourdough", crop: recipe.
// Year in Review and weekly digest read these to surface stats.
// ============================================================================

import React, { useState, useMemo } from "react";
import { X, Edit3, Plus, Trash2, ChevronDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fmtMoney } from "./units.js";

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

const newId = () => Math.random().toString(36).slice(2, 10);
const localDateStr = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const todayStr = () => localDateStr(new Date());
const parseLocalDate = (s) => { if (!s) return new Date(); const [y,m,d] = s.split("-").map(Number); return new Date(y,(m||1)-1,d||1); };
const fmtDate = (s) => { if (!s) return ""; return parseLocalDate(s).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); };

const daysSince = (timestamp) => {
  if (!timestamp) return null;
  const ms = Date.now() - new Date(timestamp).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};

const RECIPE_SUGGESTIONS = [
  "Country Loaf", "Boule", "Batard", "Whole Wheat", "Rye", "Multigrain",
  "Sandwich Loaf", "Focaccia", "Baguette", "Cinnamon Raisin", "Jalapeño Cheddar",
  "Discard Pancakes", "Discard Crackers", "Pizza Dough",
];

// ============ SHARED UI HELPERS ============
function Btn({ children, onClick, variant="primary", small=false, style={}, type="button", disabled=false }) {
  const styles = {
    primary: { background: palette.ink, color: palette.bg, border: `1.5px solid ${palette.ink}` },
    danger: { background: palette.accent, color: palette.bg, border: `1.5px solid ${palette.accent}` },
    ghost: { background: "transparent", color: palette.ink, border: `1.5px solid ${palette.line}` },
    accent: { background: palette.yolk, color: palette.ink, border: `1.5px solid ${palette.ink}` },
    leaf: { background: palette.leaf, color: palette.bg, border: `1.5px solid ${palette.leaf}` },
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

function Field({ label, children }) {
  return (
    <label style={{ display:"block",marginBottom:12 }}>
      <div style={{ fontSize:11,color:palette.inkSoft,marginBottom:6,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600 }}>{label}</div>
      {children}
    </label>
  );
}

function ModalShell({ title, onClose, children, maxWidth = 460 }) {
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(44,24,16,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:palette.bg,borderRadius:16,maxWidth,width:"100%",maxHeight:"90vh",overflow:"auto",border:`2px solid ${palette.ink}`,boxShadow:`6px 8px 0 ${palette.line}` }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1.5px solid ${palette.line}`,position:"sticky",top:0,background:palette.bg,zIndex:1 }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:22,color:palette.ink }}>{title}</div>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:palette.ink,padding:4 }}><X size={22}/></button>
        </div>
        <div style={{ padding:20 }}>{children}</div>
      </div>
    </div>
  );
}

// ============ STARTER MODAL ============
function StarterModal({ starter, onSave, onDelete, onClose }) {
  const [name, setName] = useState(starter?.name || "");
  const [hydration, setHydration] = useState(starter?.hydration ? String(starter.hydration) : "100");
  const [notes, setNotes] = useState(starter?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: starter?.id || newId(),
      name: name.trim(),
      hydration: parseInt(hydration) || 100,
      notes: notes.trim(),
      createdAt: starter?.createdAt || Date.now(),
      lastFedAt: starter?.lastFedAt || null,
      archived: starter?.archived || false,
      archivedReason: starter?.archivedReason,
    });
    onClose();
  };

  return (
    <ModalShell title={starter ? "Edit starter" : "New starter"} onClose={onClose}>
      <Field label="Name">
        <input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Doris, Yeasty Boys, Backup" autoFocus />
      </Field>
      <Field label="Hydration % (optional)">
        <input type="number" style={inputStyle} value={hydration} onChange={e=>setHydration(e.target.value)} placeholder="100" />
      </Field>
      <Field label="Notes (origin, flour type, etc.)">
        <textarea style={{ ...inputStyle,minHeight:60,resize:"vertical" }} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Started from neighbor's culture, fed with KA bread flour" />
      </Field>
      <div style={{ display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap" }}>
        {starter && onDelete && (
          !confirmDelete
            ? <Btn variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Btn>
            : <Btn variant="danger" onClick={() => { onDelete(starter.id); onClose(); }}>Confirm delete</Btn>
        )}
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={!name.trim()}>Save</Btn>
      </div>
    </ModalShell>
  );
}

// ============ BAKE MODAL ============
function BakeModal({ bake, starters, onSave, onDelete, onClose }) {
  const liveStarters = (starters || []).filter(s => !s.archived);
  const [date, setDate] = useState(bake?.date || todayStr());
  const [recipe, setRecipe] = useState(bake?.recipe || "Country Loaf");
  const [loafCount, setLoafCount] = useState(bake?.loafCount ? String(bake.loafCount) : "1");
  const [weightPerLoafG, setWeightPerLoafG] = useState(bake?.weightPerLoafG ? String(bake.weightPerLoafG) : "");
  const [costPerLoaf, setCostPerLoaf] = useState(bake?.costPerLoaf ? String(bake.costPerLoaf) : "");
  const [crumbRating, setCrumbRating] = useState(bake?.crumbRating || 0);
  const [starterId, setStarterId] = useState(bake?.starterId || liveStarters[0]?.id || "");
  const [notes, setNotes] = useState(bake?.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    if (!date || !recipe.trim()) return;
    onSave({
      id: bake?.id || newId(),
      date,
      recipe: recipe.trim(),
      loafCount: parseInt(loafCount) || 1,
      weightPerLoafG: parseFloat(weightPerLoafG) || 0,
      costPerLoaf: parseFloat(costPerLoaf) || 0,
      crumbRating: Number(crumbRating) || 0,
      starterId: starterId || null,
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <ModalShell title={bake ? "Edit bake" : "Log a bake"} onClose={onClose}>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} />
      </Field>
      <Field label="Recipe / loaf type">
        <input style={inputStyle} list="recipe-suggestions" value={recipe} onChange={e=>setRecipe(e.target.value)} placeholder="Country Loaf" />
        <datalist id="recipe-suggestions">
          {RECIPE_SUGGESTIONS.map(r => <option key={r} value={r} />)}
        </datalist>
      </Field>
      <div style={{ display:"flex",gap:12 }}>
        <div style={{ flex:1 }}>
          <Field label="Loaves baked">
            <input type="number" min={1} style={inputStyle} value={loafCount} onChange={e=>setLoafCount(e.target.value)} />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Weight each (g, optional)">
            <input type="number" style={inputStyle} value={weightPerLoafG} onChange={e=>setWeightPerLoafG(e.target.value)} placeholder="900" />
          </Field>
        </div>
      </div>
      <Field label="Cost per loaf (flour + salt + electricity, optional)">
        <input type="number" step="0.01" style={inputStyle} value={costPerLoaf} onChange={e=>setCostPerLoaf(e.target.value)} placeholder="2.50" />
      </Field>
      {liveStarters.length > 1 && (
        <Field label="Which starter?">
          <select style={inputStyle} value={starterId} onChange={e=>setStarterId(e.target.value)}>
            {liveStarters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Crumb rating (optional)">
        <div style={{ display:"flex",gap:6 }}>
          {[1,2,3,4,5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setCrumbRating(crumbRating === n ? 0 : n)}
              style={{
                flex:1, padding:"10px 0", borderRadius:8,
                border:`1.5px solid ${crumbRating>=n?palette.yolk:palette.line}`,
                background:crumbRating>=n?palette.yolkSoft:palette.card,
                cursor:"pointer", fontSize:18,
              }}
            >⭐</button>
          ))}
        </div>
      </Field>
      <Field label="Notes (optional)">
        <textarea style={{ ...inputStyle,minHeight:50,resize:"vertical" }} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Great oven spring, slight gummy crumb" />
      </Field>
      <div style={{ display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap" }}>
        {bake && onDelete && (
          !confirmDelete
            ? <Btn variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Btn>
            : <Btn variant="danger" onClick={() => { onDelete(bake.id); onClose(); }}>Confirm delete</Btn>
        )}
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={!date || !recipe.trim()}>Save</Btn>
      </div>
    </ModalShell>
  );
}

// ============ MAIN HOME PAGE ============
export default function SourdoughPage({ hobby, data, update, setModal }) {
  const [starterModal, setStarterModal] = useState({ open: false, starter: null });
  const [bakeModal, setBakeModal] = useState({ open: false, bake: null });

  const starters = (hobby?.starters || []);
  const liveStarters = starters.filter(s => !s.archived);
  const archivedStarters = starters.filter(s => s.archived);
  const bakes = (hobby?.bakes || []).slice().sort((a,b) => (b.date||"").localeCompare(a.date||""));
  const recentBakes = bakes.slice(0, 6);

  // Quick stats
  const totalBakes = bakes.length;
  const totalLoaves = bakes.reduce((s,b) => s + (Number(b.loafCount)||0), 0);
  const last30dBakes = bakes.filter(b => {
    const d = parseLocalDate(b.date);
    return Date.now() - d.getTime() < 30 * 24 * 60 * 60 * 1000;
  });
  const last30dLoaves = last30dBakes.reduce((s,b) => s + (Number(b.loafCount)||0), 0);

  // Save / delete handlers
  const saveStarter = (starter) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.starters)) h.starters = [];
      const idx = h.starters.findIndex(x => x.id === starter.id);
      if (idx >= 0) h.starters[idx] = starter; else h.starters.push(starter);
      return d;
    });
  };
  const deleteStarter = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h) h.starters = (h.starters||[]).filter(s => s.id !== id);
      return d;
    });
  };
  const feedStarter = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      const s = (h?.starters || []).find(x => x.id === id);
      if (s) s.lastFedAt = Date.now();
      return d;
    });
  };
  const saveBake = (bake) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.bakes)) h.bakes = [];
      const idx = h.bakes.findIndex(x => x.id === bake.id);
      if (idx >= 0) h.bakes[idx] = bake; else h.bakes.push(bake);
      return d;
    });
  };
  const deleteBake = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h) h.bakes = (h.bakes||[]).filter(b => b.id !== id);
      return d;
    });
  };

  // Auto-create a default starter if user has none yet — keeps UX friction-free
  // for new users who just want to log a bake without thinking about starters.
  React.useEffect(() => {
    if (!hobby) return;
    if ((hobby.starters || []).length === 0 && (hobby.bakes || []).length === 0) {
      // Don't auto-create — leave it up to user. Empty state will guide them.
    }
  }, [hobby]);

  return (
    <div>
      {starterModal.open && (
        <StarterModal
          starter={starterModal.starter}
          onClose={() => setStarterModal({ open: false, starter: null })}
          onSave={saveStarter}
          onDelete={deleteStarter}
        />
      )}
      {bakeModal.open && (
        <BakeModal
          bake={bakeModal.bake}
          starters={starters}
          onClose={() => setBakeModal({ open: false, bake: null })}
          onSave={saveBake}
          onDelete={deleteBake}
        />
      )}

      {/* Quick stats */}
      <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:16 }}>
        <StatCard label="Total bakes" value={totalBakes} accent={palette.accent} />
        <StatCard label="Total loaves" value={totalLoaves} accent={palette.yolk} />
        <StatCard label="Last 30 days" value={`${last30dBakes.length} bake${last30dBakes.length===1?"":"s"}`} sub={`${last30dLoaves} loaves`} accent={palette.leaf} />
      </div>

      {/* Quick actions */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8,marginBottom:18 }}>
        <Btn variant="accent" onClick={() => setBakeModal({ open: true, bake: null })} style={{ width:"100%" }}>🍞 Log a bake</Btn>
        <Btn variant="leaf" small onClick={() => setStarterModal({ open: true, starter: null })} style={{ width:"100%" }}>+ Add starter</Btn>
      </div>

      {/* Starters */}
      <div style={{ marginBottom:24 }}>
        <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:18,margin:"0 0 10px",color:palette.ink }}>🌾 Your starters</h3>
        {liveStarters.length === 0 ? (
          <div style={{ background:palette.card,border:`1.5px dashed ${palette.line}`,borderRadius:10,padding:16,textAlign:"center" }}>
            <div style={{ fontSize:13,color:palette.inkSoft,marginBottom:8 }}>No starters tracked yet — add one to track its feeding rhythm.</div>
            <Btn small variant="leaf" onClick={() => setStarterModal({ open: true, starter: null })}>+ Add a starter</Btn>
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {liveStarters.map(s => {
              const days = daysSince(s.lastFedAt);
              const fedColor = days === null ? palette.inkSoft : days === 0 ? palette.leaf : days <= 2 ? palette.yolk : palette.accent;
              const fedLabel = days === null ? "Not fed yet" : days === 0 ? "Fed today" : days === 1 ? "Fed yesterday" : `${days} days ago`;
              return (
                <div key={s.id}
                  style={{ padding:"12px 14px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10 }}
                >
                  <div onClick={() => setStarterModal({ open: true, starter: s })} style={{ flex:1,minWidth:0,cursor:"pointer" }}>
                    <div style={{ fontWeight:700,fontSize:15,color:palette.ink }}>🌾 {s.name}</div>
                    <div style={{ fontSize:11,color:fedColor,marginTop:2,fontWeight:600 }}>
                      {fedLabel}{s.hydration ? ` · ${s.hydration}% hydration` : ""}
                    </div>
                  </div>
                  <Btn small variant="leaf" onClick={() => feedStarter(s.id)}>🍽 Fed</Btn>
                </div>
              );
            })}
          </div>
        )}
        {archivedStarters.length > 0 && (
          <details style={{ marginTop:8 }}>
            <summary style={{ cursor:"pointer",color:palette.inkSoft,fontSize:13,padding:6 }}>Archived starters ({archivedStarters.length})</summary>
            <div style={{ marginTop:8,display:"flex",flexDirection:"column",gap:4 }}>
              {archivedStarters.map(s => (
                <div key={s.id} style={{ padding:"6px 10px",background:palette.bgAlt,borderRadius:6,fontSize:12,color:palette.inkSoft }}>
                  {s.name} — {s.archivedReason || "archived"}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Recent bakes */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
          <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:18,margin:0,color:palette.ink }}>🍞 Recent bakes</h3>
          {bakes.length > 0 && <Btn small onClick={() => setBakeModal({ open: true, bake: null })}>+ New bake</Btn>}
        </div>
        {bakes.length === 0 ? (
          <div style={{ background:palette.card,border:`1.5px dashed ${palette.line}`,borderRadius:12,padding:32,textAlign:"center" }}>
            <div style={{ fontSize:32,marginBottom:8 }}>🍞</div>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,color:palette.ink,marginBottom:6 }}>No bakes yet</div>
            <div style={{ fontSize:13,color:palette.inkSoft,marginBottom:14 }}>Log your first bake to start tracking your loaf count, recipes, and profit.</div>
            <Btn variant="accent" onClick={() => setBakeModal({ open: true, bake: null })}>🍞 Log your first bake</Btn>
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {recentBakes.map(b => {
              const stars = "⭐".repeat(b.crumbRating || 0);
              return (
                <div key={b.id}
                  onClick={() => setBakeModal({ open: true, bake: b })}
                  style={{ padding:"10px 12px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer" }}
                >
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:600,fontSize:14,color:palette.ink }}>
                      {b.loafCount} × {b.recipe}{stars ? ` · ${stars}` : ""}
                    </div>
                    <div style={{ fontSize:11,color:palette.inkSoft,marginTop:2 }}>
                      {fmtDate(b.date)}
                      {b.costPerLoaf > 0 && ` · ${fmtMoney(b.costPerLoaf)}/loaf cost`}
                    </div>
                  </div>
                  <Edit3 size={14} style={{ color:palette.inkSoft,flexShrink:0 }} />
                </div>
              );
            })}
            {bakes.length > recentBakes.length && (
              <div style={{ fontSize:12,color:palette.inkSoft,textAlign:"center",marginTop:6,fontStyle:"italic" }}>
                Showing {recentBakes.length} of {bakes.length} bakes — see full history in Stats.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SOURDOUGH ANALYTICS
// ============================================================================
export function SourdoughAnalytics({ hobby, sales = [] }) {
  if (!hobby) {
    return <div style={{ padding:40,textAlign:"center",color:palette.inkSoft }}>Loading…</div>;
  }

  const bakes = hobby.bakes || [];
  const starters = hobby.starters || [];

  if (bakes.length === 0 && starters.length === 0) {
    return (
      <div style={{ padding:40,textAlign:"center",color:palette.inkSoft }}>
        <div style={{ fontSize:36,marginBottom:8 }}>📊</div>
        <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,color:palette.ink,marginBottom:6 }}>No sourdough data yet</div>
        <div style={{ fontSize:13 }}>Log a few bakes to see your stats.</div>
      </div>
    );
  }

  const totalBakes = bakes.length;
  const totalLoaves = bakes.reduce((s,b) => s + (Number(b.loafCount)||0), 0);
  const totalCost = bakes.reduce((s,b) => s + (Number(b.loafCount)||0) * (Number(b.costPerLoaf)||0), 0);
  const avgCostPerLoaf = totalLoaves > 0 ? totalCost / totalLoaves : 0;
  const avgRating = (() => {
    const rated = bakes.filter(b => b.crumbRating > 0);
    if (rated.length === 0) return null;
    return rated.reduce((s,b) => s + b.crumbRating, 0) / rated.length;
  })();

  // Sales — read sourdough sales from data.sales (filtered & passed in by parent)
  const sourdoughSales = (sales || []).filter(s => s.hobbyType === "sourdough");
  const totalRevenue = sourdoughSales.reduce((s,x) => s + (Number(x.totalRevenue)||0), 0);
  const totalSaleCost = sourdoughSales.reduce((s,x) => s + (Number(x.totalCost)||0), 0);
  const totalProfit = totalRevenue - totalSaleCost;
  const loavesSold = sourdoughSales.reduce((s,x) => s + (Number(x.qty)||0), 0);

  // Top recipe by count
  const recipeCount = {};
  bakes.forEach(b => {
    const r = b.recipe || "Other";
    recipeCount[r] = (recipeCount[r]||0) + (Number(b.loafCount)||0);
  });
  const topRecipeEntry = Object.entries(recipeCount).sort((a,b)=>b[1]-a[1])[0];
  const topRecipe = topRecipeEntry ? { name: topRecipeEntry[0], loaves: topRecipeEntry[1] } : null;

  // Bakes by month (last 12 months)
  const monthlyBakes = (() => {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const label = d.toLocaleDateString("en-US",{month:"short"});
      const monthBakes = bakes.filter(b => (b.date||"").startsWith(key));
      const loaves = monthBakes.reduce((s,b) => s + (Number(b.loafCount)||0), 0);
      months.push({ key, label, loaves });
    }
    return months;
  })();

  return (
    <div>
      <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:20,margin:"0 0 12px",color:palette.ink }}>🍞 Bake totals</h3>
      <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:18 }}>
        <StatCard label="Total bakes" value={totalBakes} accent={palette.accent} />
        <StatCard label="Total loaves" value={totalLoaves} sub={topRecipe ? `Top: ${topRecipe.name}` : null} accent={palette.yolk} />
        {totalCost > 0 && (
          <StatCard label="Avg cost / loaf" value={fmtMoney(avgCostPerLoaf)} sub={`${fmtMoney(totalCost)} total`} accent={palette.feather} />
        )}
        {avgRating !== null && (
          <StatCard label="Avg crumb rating" value={`${avgRating.toFixed(1)} ⭐`} accent={palette.leaf} />
        )}
      </div>

      {/* Monthly bake chart */}
      {monthlyBakes.some(m => m.loaves > 0) && (
        <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:18 }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:14,color:palette.ink,marginBottom:10 }}>Loaves per month — last 12</div>
          <div style={{ width:"100%",height:180 }}>
            <ResponsiveContainer>
              <BarChart data={monthlyBakes} margin={{ top:10,right:8,left:-10,bottom:0 }}>
                <XAxis dataKey="label" stroke={palette.inkSoft} fontSize={11} />
                <YAxis stroke={palette.inkSoft} fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background:palette.bg,border:`1.5px solid ${palette.line}`,borderRadius:8,fontFamily:FONT_BODY,fontSize:13 }} />
                <Bar dataKey="loaves" fill={palette.yolk} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Sales section */}
      {sourdoughSales.length > 0 && (
        <>
          <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:18,margin:"0 0 10px",color:palette.ink }}>💰 Sales</h3>
          <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:18 }}>
            <StatCard label="Loaves sold" value={loavesSold} accent={palette.leaf} />
            <StatCard label="Revenue" value={fmtMoney(totalRevenue)} accent={palette.leaf} />
            <StatCard label="Profit" value={fmtMoney(totalProfit)} sub={`${sourdoughSales.length} sale${sourdoughSales.length===1?"":"s"}`} accent={totalProfit >= 0 ? palette.leaf : palette.accent} />
          </div>
        </>
      )}

      {/* Starter list */}
      {starters.length > 0 && (
        <>
          <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:18,margin:"0 0 10px",color:palette.ink }}>🌾 Starters</h3>
          <div style={{ display:"flex",flexDirection:"column",gap:6,marginBottom:18 }}>
            {starters.filter(s => !s.archived).map(s => {
              const days = daysSince(s.lastFedAt);
              const fedLabel = days === null ? "Never fed" : days === 0 ? "Today" : `${days} day${days===1?"":"s"} ago`;
              return (
                <div key={s.id} style={{ padding:"10px 12px",background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:8,display:"flex",justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontWeight:600,fontSize:13,color:palette.ink }}>🌾 {s.name}</div>
                    <div style={{ fontSize:11,color:palette.inkSoft }}>Last fed: {fedLabel}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
