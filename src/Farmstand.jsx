// ============================================================================
// FARMSTAND PAGE
// ----------------------------------------------------------------------------
// Hobby for tracking what you sell at a roadside / driveway / farmstand.
// Sales themselves live in data.sales[] with hobbyType="farmstand" — same as
// manually-entered farmstand sales from the Sales tab — so this page does NOT
// duplicate sale storage. It adds a saved-items catalog at hobby.items[] so
// users can one-tap log "sold 3 cookies" instead of retyping price + cost
// every time, then pipes that straight into data.sales.
//
// Data shape:
//   hobby.items[] = [{ id, name, costPerUnit, pricePerUnit, unit, archived }]
// ============================================================================

import React, { useState, useMemo } from "react";
import { X, Edit3 } from "lucide-react";
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

const ITEM_UNITS = ["each", "lbs", "dozen", "quart", "pint", "bunch", "bag", "jar", "loaf"];

const newId = () => Math.random().toString(36).slice(2, 10);
const localDateStr = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const todayStr = () => localDateStr(new Date());
const parseLocalDate = (s) => { if (!s) return new Date(); const [y,m,d] = s.split("-").map(Number); return new Date(y,(m||1)-1,d||1); };
const fmtDate = (s) => { if (!s) return ""; return parseLocalDate(s).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); };
const fmtMoney = (n) => `$${(Number(n)||0).toFixed(2)}`;

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

// ============ ADD / EDIT ITEM MODAL ============
function ItemModal({ item, onSave, onDelete, onClose }) {
  const [name, setName] = useState(item?.name || "");
  const [unit, setUnit] = useState(item?.unit || "each");
  const [costPerUnit, setCostPerUnit] = useState(item?.costPerUnit ? String(item.costPerUnit) : "");
  const [pricePerUnit, setPricePerUnit] = useState(item?.pricePerUnit ? String(item.pricePerUnit) : "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: item?.id || newId(),
      name: name.trim(),
      unit,
      costPerUnit: parseFloat(costPerUnit) || 0,
      pricePerUnit: parseFloat(pricePerUnit) || 0,
      archived: item?.archived || false,
    });
    onClose();
  };

  const profit = (parseFloat(pricePerUnit) || 0) - (parseFloat(costPerUnit) || 0);
  const margin = (parseFloat(pricePerUnit) || 0) > 0 ? (profit / (parseFloat(pricePerUnit) || 1)) * 100 : 0;

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(44,24,16,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:palette.bg,borderRadius:16,maxWidth:460,width:"100%",maxHeight:"90vh",overflow:"auto",border:`2px solid ${palette.ink}`,boxShadow:`6px 8px 0 ${palette.line}` }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1.5px solid ${palette.line}` }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:22,color:palette.ink }}>{item ? "Edit item" : "Add item"}</div>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:palette.ink,padding:4 }}><X size={22}/></button>
        </div>
        <div style={{ padding:20 }}>
          <Field label="Item name">
            <input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Chocolate chip cookie, Strawberry jam, Sourdough loaf" autoFocus />
          </Field>
          <Field label="Unit">
            <select style={inputStyle} value={unit} onChange={e=>setUnit(e.target.value)}>
              {ITEM_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <div style={{ display:"flex",gap:12 }}>
            <div style={{ flex:1 }}>
              <Field label="Cost to make / per unit">
                <input type="number" step="0.01" min={0} style={inputStyle} value={costPerUnit} onChange={e=>setCostPerUnit(e.target.value)} placeholder="$0.00" />
              </Field>
            </div>
            <div style={{ flex:1 }}>
              <Field label="Sale price / per unit">
                <input type="number" step="0.01" min={0} style={inputStyle} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} placeholder="$0.00" />
              </Field>
            </div>
          </div>
          {(parseFloat(pricePerUnit) || 0) > 0 && (
            <div style={{ background:palette.bgAlt,borderRadius:8,padding:"10px 12px",marginBottom:12,fontSize:13,color:palette.ink }}>
              Profit per {unit}: <strong style={{ color: profit >= 0 ? palette.leaf : palette.accent }}>{fmtMoney(profit)}</strong>
              {" · "}Margin: <strong>{margin.toFixed(0)}%</strong>
            </div>
          )}
          <div style={{ display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap",marginTop:8 }}>
            {item && onDelete && (
              !confirmDelete ? (
                <Btn variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Btn>
              ) : (
                <Btn variant="danger" onClick={() => { onDelete(item.id); onClose(); }}>Confirm delete</Btn>
              )
            )}
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn onClick={handleSave} disabled={!name.trim()}>Save item</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ QUICK SELL MODAL ============
// Tap an item -> this opens with quantity prefilled at 1, cost/price pulled
// from the saved item. Logs straight into data.sales as a farmstand sale.
function QuickSellModal({ item, onSell, onClose }) {
  const [qty, setQty] = useState("1");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState(String(item.pricePerUnit || 0));
  const [costPerUnit, setCostPerUnit] = useState(String(item.costPerUnit || 0));

  const q = parseFloat(qty) || 0;
  const p = parseFloat(pricePerUnit) || 0;
  const c = parseFloat(costPerUnit) || 0;
  const revenue = q * p;
  const cost = q * c;
  const profit = revenue - cost;

  const handleSell = () => {
    if (q <= 0) return;
    onSell({
      qty: q,
      date,
      pricePerUnit: p,
      costPerUnit: c,
      revenue,
      cost,
      profit,
      note: note.trim(),
    });
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(44,24,16,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:palette.bg,borderRadius:16,maxWidth:420,width:"100%",maxHeight:"90vh",overflow:"auto",border:`2px solid ${palette.ink}`,boxShadow:`6px 8px 0 ${palette.line}` }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1.5px solid ${palette.line}` }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:22,color:palette.ink }}>Sold {item.name}</div>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:palette.ink,padding:4 }}><X size={22}/></button>
        </div>
        <div style={{ padding:20 }}>
          <Field label={`How many ${item.unit}${q===1?"":"s"}?`}>
            <input type="number" step="0.1" min={0} style={inputStyle} value={qty} onChange={e=>setQty(e.target.value)} autoFocus />
          </Field>
          <Field label="Date">
            <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} />
          </Field>
          <div style={{ display:"flex",gap:12 }}>
            <div style={{ flex:1 }}>
              <Field label="Price / unit">
                <input type="number" step="0.01" min={0} style={inputStyle} value={pricePerUnit} onChange={e=>setPricePerUnit(e.target.value)} />
              </Field>
            </div>
            <div style={{ flex:1 }}>
              <Field label="Cost / unit">
                <input type="number" step="0.01" min={0} style={inputStyle} value={costPerUnit} onChange={e=>setCostPerUnit(e.target.value)} />
              </Field>
            </div>
          </div>
          <Field label="Note (optional)">
            <input style={inputStyle} value={note} onChange={e=>setNote(e.target.value)} placeholder="Repeat customer, payment type, etc." />
          </Field>
          <div style={{ background:palette.bgAlt,borderRadius:8,padding:"12px 14px",marginBottom:14 }}>
            <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4 }}>
              <span style={{ color:palette.inkSoft }}>Revenue</span>
              <strong>{fmtMoney(revenue)}</strong>
            </div>
            <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4 }}>
              <span style={{ color:palette.inkSoft }}>Cost</span>
              <span>{fmtMoney(cost)}</span>
            </div>
            <div style={{ display:"flex",justifyContent:"space-between",fontSize:14,paddingTop:6,borderTop:`1px solid ${palette.line}` }}>
              <strong>Profit</strong>
              <strong style={{ color: profit >= 0 ? palette.leaf : palette.accent }}>{fmtMoney(profit)}</strong>
            </div>
          </div>
          <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn variant="leaf" onClick={handleSell} disabled={q<=0}>Log sale</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ ITEM CARD ============
function ItemCard({ item, onSell, onEdit }) {
  const profit = (item.pricePerUnit || 0) - (item.costPerUnit || 0);
  return (
    <div style={{
      background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12,
      padding: 14, display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8 }}>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,color:palette.ink,lineHeight:1.2,wordBreak:"break-word" }}>{item.name}</div>
          <div style={{ fontSize:11,color:palette.inkSoft,marginTop:2 }}>per {item.unit}</div>
        </div>
        <button onClick={onEdit} title="Edit" style={{ background:"none",border:"none",cursor:"pointer",color:palette.inkSoft,padding:4,flexShrink:0 }}>
          <Edit3 size={16}/>
        </button>
      </div>
      <div style={{ display:"flex",gap:8,fontSize:12 }}>
        <div style={{ flex:1,background:palette.bgAlt,borderRadius:6,padding:"6px 8px" }}>
          <div style={{ fontSize:9,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:0.8 }}>Price</div>
          <div style={{ fontWeight:700 }}>{fmtMoney(item.pricePerUnit)}</div>
        </div>
        <div style={{ flex:1,background:palette.bgAlt,borderRadius:6,padding:"6px 8px" }}>
          <div style={{ fontSize:9,color:palette.inkSoft,textTransform:"uppercase",letterSpacing:0.8 }}>Profit</div>
          <div style={{ fontWeight:700,color: profit >= 0 ? palette.leaf : palette.accent }}>{fmtMoney(profit)}</div>
        </div>
      </div>
      <Btn variant="leaf" small onClick={onSell} style={{ width:"100%" }}>+ Quick sell</Btn>
    </div>
  );
}

// ============ MAIN HOME PAGE ============
export default function FarmstandPage({ hobby, data, update, setModal }) {
  const [editingItem, setEditingItem] = useState(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [sellingItem, setSellingItem] = useState(null);

  const items = (hobby?.items || []).filter(i => !i.archived);
  const farmstandSales = useMemo(
    () => (data.sales || []).filter(s => s.hobbyType === "farmstand"),
    [data.sales]
  );

  // Month / year revenue
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const yearKey = `${now.getFullYear()}`;
  const monthRevenue = farmstandSales
    .filter(s => (s.date || "").startsWith(monthKey))
    .reduce((sum, s) => sum + (Number(s.totalRevenue) || 0), 0);
  const yearRevenue = farmstandSales
    .filter(s => (s.date || "").startsWith(yearKey))
    .reduce((sum, s) => sum + (Number(s.totalRevenue) || 0), 0);

  const recentSales = farmstandSales.slice().sort((a,b) => (b.date||"").localeCompare(a.date||"")).slice(0, 8);

  const saveItem = (newItem) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      if (!Array.isArray(h.items)) h.items = [];
      const existingIdx = h.items.findIndex(x => x.id === newItem.id);
      if (existingIdx >= 0) h.items[existingIdx] = newItem;
      else h.items.push(newItem);
      return d;
    });
  };

  const deleteItem = (itemId) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h && Array.isArray(h.items)) h.items = h.items.filter(x => x.id !== itemId);
      return d;
    });
  };

  const recordSale = (item, saleData) => {
    update(d => {
      if (!Array.isArray(d.sales)) d.sales = [];
      d.sales.push({
        id: newId(),
        date: saleData.date,
        hobbyType: "farmstand",
        crop: item.name,
        gardenUnit: item.unit,
        qty: saleData.qty,
        unit: item.unit,
        pricePerUnit: saleData.pricePerUnit,
        costPerUnit: saleData.costPerUnit,
        totalRevenue: saleData.revenue,
        totalCost: saleData.cost,
        note: saleData.note || "",
        buyerId: null,
        created: Date.now(),
        fromFarmstandItem: item.id,
      });
      return d;
    });
  };

  return (
    <div>
      {showItemModal && (
        <ItemModal
          item={editingItem}
          onClose={() => { setShowItemModal(false); setEditingItem(null); }}
          onSave={saveItem}
          onDelete={deleteItem}
        />
      )}
      {sellingItem && (
        <QuickSellModal
          item={sellingItem}
          onClose={() => setSellingItem(null)}
          onSell={(saleData) => recordSale(sellingItem, saleData)}
        />
      )}

      {/* Revenue stats */}
      <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:16 }}>
        <StatCard label="This month" value={fmtMoney(monthRevenue)} sub="farmstand revenue" accent={palette.leaf} />
        <StatCard label="This year" value={fmtMoney(yearRevenue)} sub={`${farmstandSales.length} sale${farmstandSales.length===1?"":"s"} total`} accent={palette.feather} />
      </div>

      {/* Items section */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
          <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:20,margin:0,color:palette.ink }}>Items at the stand</h3>
          <Btn small onClick={() => { setEditingItem(null); setShowItemModal(true); }}>+ Add item</Btn>
        </div>

        {items.length === 0 ? (
          <div style={{
            background: palette.card, border: `1.5px dashed ${palette.line}`, borderRadius: 12,
            padding: 32, textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏪</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 6 }}>No items yet</div>
            <div style={{ fontSize: 13, color: palette.inkSoft, margin: "0 auto 14px", maxWidth: 300 }}>
              Add the things you sell — cookies, jam, eggs, bread, soap. Set the cost to make and price you sell for, and you'll be able to log sales in one tap.
            </div>
            <Btn variant="accent" onClick={() => { setEditingItem(null); setShowItemModal(true); }}>+ Add your first item</Btn>
          </div>
        ) : (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10,
          }}>
            {items.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                onSell={() => setSellingItem(item)}
                onEdit={() => { setEditingItem(item); setShowItemModal(true); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent sales */}
      {recentSales.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:20,margin:"0 0 10px",color:palette.ink }}>Recent farmstand sales</h3>
          <div style={{
            background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, overflow: "hidden",
          }}>
            {recentSales.map((s, i) => (
              <div key={s.id || i} style={{
                padding: "10px 14px",
                borderBottom: i < recentSales.length - 1 ? `1px solid ${palette.line}` : "none",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: palette.ink, wordBreak: "break-word" }}>
                    {s.crop || "Item"}
                  </div>
                  <div style={{ fontSize: 11, color: palette.inkSoft }}>
                    {s.qty} {s.unit || s.gardenUnit || "each"} · {fmtDate(s.date)}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: palette.leaf, fontFamily: FONT_DISPLAY, fontSize: 16 }}>
                  {fmtMoney(s.totalRevenue || 0)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 8, textAlign: "center", fontStyle: "italic" }}>
            Manage all sales from the Sales tab.
          </div>
        </div>
      )}

      {/* Archived items */}
      {(hobby?.items || []).some(i => i.archived) && (
        <ArchivedItemsList hobby={hobby} update={update} />
      )}
    </div>
  );
}

function ArchivedItemsList({ hobby, update }) {
  const [show, setShow] = useState(false);
  const archived = (hobby.items || []).filter(i => i.archived);
  if (archived.length === 0) return null;

  const restore = (id) => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      const it = (h?.items || []).find(x => x.id === id);
      if (it) it.archived = false;
      return d;
    });
  };

  return (
    <div style={{ marginTop: 24 }}>
      <button
        onClick={() => setShow(!show)}
        style={{ background: "none", border: "none", color: palette.inkSoft, cursor: "pointer", fontSize: 13, fontFamily: FONT_BODY, padding: 4 }}
      >
        {show ? "Hide" : "Show"} archived items ({archived.length})
      </button>
      {show && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {archived.map(item => (
            <div key={item.id} style={{
              padding: "8px 12px", background: palette.bgAlt, borderRadius: 8,
              display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13,
            }}>
              <span>{item.name} · {fmtMoney(item.pricePerUnit)}</span>
              <Btn variant="ghost" small onClick={() => restore(item.id)}>Restore</Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FARMSTAND ANALYTICS — rendered under the Stats tab when farmstand is active
// ============================================================================
export function FarmstandAnalytics({ hobby, sales = [], spouseMode = false }) {
  // Defensive: hobby may be undefined if data is mid-load or migration hasn't
  // applied yet. Treat that as an empty state rather than crashing.
  const farmstandSales = useMemo(
    () => (Array.isArray(sales) ? sales : []).filter(s => s && s.hobbyType === "farmstand"),
    [sales]
  );

  if (!hobby || farmstandSales.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: palette.inkSoft }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 6 }}>No farmstand sales yet</div>
        <div style={{ fontSize: 13 }}>
          Once you log a few farmstand sales, you'll see revenue, profit, top sellers, and more here.
        </div>
      </div>
    );
  }

  const fudge = (n) => spouseMode ? n * 0.65 : n;

  const totalRevenue = farmstandSales.reduce((s, sale) => s + fudge(Number(sale.totalRevenue) || 0), 0);
  const totalCost = farmstandSales.reduce((s, sale) => s + (Number(sale.totalCost) || 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const avgSale = totalRevenue / farmstandSales.length;

  // By item
  const byItem = {};
  farmstandSales.forEach(sale => {
    const name = sale.crop || "Other";
    if (!byItem[name]) byItem[name] = { revenue: 0, cost: 0, qty: 0, count: 0 };
    byItem[name].revenue += fudge(Number(sale.totalRevenue) || 0);
    byItem[name].cost += Number(sale.totalCost) || 0;
    byItem[name].qty += Number(sale.qty) || 0;
    byItem[name].count += 1;
  });
  const itemList = Object.entries(byItem)
    .map(([name, d]) => ({ name, ...d, profit: d.revenue - d.cost }))
    .sort((a,b) => b.revenue - a.revenue);

  const topByRevenue = itemList.slice(0, 5);
  const topByProfit = itemList.slice().sort((a,b) => b.profit - a.profit).slice(0, 5);

  // By month for chart
  const byMonth = {};
  farmstandSales.forEach(sale => {
    const m = (sale.date || "").slice(0, 7);
    if (!m) return;
    if (!byMonth[m]) byMonth[m] = { month: m, revenue: 0, profit: 0 };
    byMonth[m].revenue += fudge(Number(sale.totalRevenue) || 0);
    byMonth[m].profit += fudge(Number(sale.totalRevenue) || 0) - (Number(sale.totalCost) || 0);
  });
  const monthChart = Object.values(byMonth).sort((a,b) => a.month.localeCompare(b.month));

  // Unique customers
  const customers = new Set(farmstandSales.map(s => s.buyerId).filter(Boolean));

  return (
    <div>
      <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:20,margin:"0 0 12px",color:palette.ink }}>Farmstand totals</h3>
      <div style={{ display:"flex",gap:10,flexWrap:"wrap",marginBottom:18 }}>
        <StatCard label="Revenue" value={fmtMoney(totalRevenue)} accent={palette.leaf} />
        <StatCard label="Profit" value={fmtMoney(totalProfit)} sub={`${margin.toFixed(0)}% margin`} accent={totalProfit >= 0 ? palette.leaf : palette.accent} />
        <StatCard label="Sales" value={farmstandSales.length} sub={`avg ${fmtMoney(avgSale)}`} accent={palette.feather} />
        {customers.size > 0 && (
          <StatCard label="Customers" value={customers.size} sub="repeat buyers" accent={palette.yolk} />
        )}
      </div>

      <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:18,margin:"0 0 10px",color:palette.ink }}>Top sellers — by revenue</h3>
      <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,overflow:"hidden",marginBottom:18 }}>
        {topByRevenue.map((row, i) => (
          <div key={row.name} style={{
            padding: "10px 14px",
            borderBottom: i < topByRevenue.length - 1 ? `1px solid ${palette.line}` : "none",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: palette.ink, wordBreak: "break-word" }}>{row.name}</div>
              <div style={{ fontSize: 11, color: palette.inkSoft }}>{row.count} sale{row.count===1?"":"s"} · {row.qty.toFixed(1)} sold</div>
            </div>
            <div style={{ fontWeight: 700, color: palette.leaf, fontFamily: FONT_DISPLAY, fontSize: 16 }}>
              {fmtMoney(row.revenue)}
            </div>
          </div>
        ))}
      </div>

      {topByProfit[0]?.name !== topByRevenue[0]?.name && (
        <>
          <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:18,margin:"0 0 10px",color:palette.ink }}>Top sellers — by profit</h3>
          <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,overflow:"hidden",marginBottom:18 }}>
            {topByProfit.map((row, i) => (
              <div key={row.name} style={{
                padding: "10px 14px",
                borderBottom: i < topByProfit.length - 1 ? `1px solid ${palette.line}` : "none",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: palette.ink, wordBreak: "break-word" }}>{row.name}</div>
                  <div style={{ fontSize: 11, color: palette.inkSoft }}>{fmtMoney(row.revenue)} revenue</div>
                </div>
                <div style={{ fontWeight: 700, color: row.profit >= 0 ? palette.leaf : palette.accent, fontFamily: FONT_DISPLAY, fontSize: 16 }}>
                  {fmtMoney(row.profit)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {monthChart.length >= 2 && (
        <>
          <h3 style={{ fontFamily:FONT_DISPLAY,fontSize:18,margin:"0 0 10px",color:palette.ink }}>Revenue & profit by month</h3>
          <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:18 }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthChart}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: palette.inkSoft }} />
                <YAxis tick={{ fontSize: 11, fill: palette.inkSoft }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={{ background: palette.bg, border: `1px solid ${palette.line}`, borderRadius: 8 }} />
                <Bar dataKey="revenue" fill={palette.leaf} name="Revenue" />
                <Bar dataKey="profit" fill={palette.feather} name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
