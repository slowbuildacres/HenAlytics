// ============================================================================
// Orders — customer pre-order requests and email list sign-ups (3.0.3)
// ----------------------------------------------------------------------------
// Separate from the farm stand (not everyone sells meat birds or bread there).
// The homestead turns on an order page (henalytics.com/o/<token>), shares the
// link or prints a QR sign, and customers send requests. No money changes
// hands: the owner accepts or declines, marks it ready, and the customer gets
// a short email at each step if the owner wants.
//
// Settings live in the homestead's own data (data.orderPage, see
// src/orderShared.js). Requests live on the server (api/orders.js), so this
// screen needs a signed-in, synced homestead.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { ChevronLeft, Link2, QrCode, Settings2, Mail, Phone, Check, X as XIcon, ShoppingBag, UserPlus, Plus, Trash2, ChevronDown, Share2, Copy, Lock, Receipt } from "lucide-react";
import { nl, font, type } from "./newlook/theme.js";
import { Card, CardHeader, Row, Button, Badge, Sheet, Chip } from "./newlook/ui.jsx";
import { supabase, isSupabaseConfigured } from "./supabase.js";
import { getActiveHomesteadId } from "./sync.js";
import { apiUrl } from "./apiBase.js";
import { shareImageBlob, shareUrl } from "./shareCard.js";
import { cleanPageSettings, ORDER_LIMITS, itemLine, moneyText, orderTotal, orderPrettyDate } from "./orderShared.js";
import { ownerMenu, creditChoices, guessCredit, standItems, orderLines, lineTotals, salesFromLines, takeStock, stockOnStand, stockInBack, orderInSales, isoToday } from "./orderSales.js";

export const ORDER_SITE = "https://henalytics.com/o/";
const newId = () => Math.random().toString(36).slice(2, 10);
export function newOrderToken() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
const ago = (iso) => {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 60) return m <= 1 ? "just now" : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
};

export async function callOrders(action, payload = {}) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Sign in to take orders.");
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in (free) to take orders.");
  const homesteadId = getActiveHomesteadId();
  if (!homesteadId) throw new Error("Your homestead hasn't synced yet. Try again in a moment.");
  const r = await fetch(apiUrl("/api/orders"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, homesteadId, ...payload }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || "Something went wrong. Try again.");
  return body;
}

// New-request count for the badge on More and the Home notice. Checks on
// open, when the app comes back to the front, and every 5 minutes.
export function useOrderCount(data, user) {
  const on = !!(data && data.orderPage && data.orderPage.on) && !!user;
  const [count, setCount] = useState({ newOrders: 0, newJoins: 0 });
  const refresh = useCallback(() => {
    if (!on) { setCount({ newOrders: 0, newJoins: 0 }); return; }
    callOrders("count").then((c) => setCount({ newOrders: Number(c.newOrders) || 0, newJoins: Number(c.newJoins) || 0 })).catch(() => {});
  }, [on]);
  useEffect(() => {
    refresh();
    if (!on) return undefined;
    const t = setInterval(refresh, 5 * 60 * 1000);
    const vis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [on, refresh]);
  return { ...count, total: count.newOrders + count.newJoins, refresh };
}

const inputStyle = {
  width: "100%", minHeight: 48, padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${nl.line}`,
  background: nl.card, color: nl.ink, font: `400 16px ${font.body}`, boxSizing: "border-box",
};
const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: nl.soft, margin: "12px 2px 6px" };
const ic = (I) => <I size={20} strokeWidth={1.8} aria-hidden="true" />;

function Toggle({ on, onChange, label, sub }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} style={{
      display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 56, padding: "10px 4px", border: "none", background: "none", color: nl.ink, font: "inherit", textAlign: "left", cursor: "pointer",
    }}>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{label}</span>
        {sub && <span style={{ display: "block", fontSize: 13, color: nl.soft }}>{sub}</span>}
      </span>
      <span aria-hidden="true" style={{ width: 48, height: 28, borderRadius: 14, background: on ? nl.good : nl.field, position: "relative", flexShrink: 0, transition: "background .15s" }}>
        <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 22, height: 22, borderRadius: 11, background: "#fff", transition: "left .15s" }} />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- settings
const miniLabel = { display: "block", fontSize: 12, fontWeight: 600, color: nl.soft, margin: "0 2px 4px" };

// The owner-only part of a menu item: cost to make, where sales count, and
// the farm stand item it comes from. Never sent to the public page.
function PrivateBox({ m, setItem, credits, stand, data }) {
  const credit = m.credit || guessCredit(m, data);
  const choices = credits.some((c) => c.id === credit) ? credits : [...credits, { id: credit, label: credit }];
  const price = Number(m.price) || 0;
  const cost = m.cost === "" || m.cost == null ? null : Number(m.cost) || 0;
  return (
    <div style={{ background: nl.chip, borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: nl.soft }}>
        <Lock size={14} aria-hidden="true" /> Only you see this
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <label style={{ flex: 1, minWidth: 0 }}>
          <span style={miniLabel}>Cost to make one</span>
          <input aria-label={`Cost to make one ${m.name || "item"} (private)`} type="number" inputMode="decimal" min={0} step="0.01" style={inputStyle} value={m.cost == null ? "" : m.cost} onChange={(e) => setItem(m.id, { cost: e.target.value === "" ? null : e.target.value })} placeholder="$ Optional" />
        </label>
        <label style={{ flex: 1, minWidth: 0 }}>
          <span style={miniLabel}>Count sales under</span>
          <select aria-label={`Count ${m.name || "item"} sales under`} style={inputStyle} value={credit} onChange={(e) => setItem(m.id, { credit: e.target.value })}>
            {choices.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
      </div>
      {stand.length > 0 && (
        <label>
          <span style={miniLabel}>Comes from this farm stand item</span>
          <select aria-label={`Farm stand item for ${m.name || "item"}`} style={inputStyle} value={m.standItemId || ""} onChange={(e) => setItem(m.id, { standItemId: e.target.value, ...(e.target.value ? { credit: "farmstand" } : {}) })}>
            <option value="">Not linked</option>
            {stand.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </label>
      )}
      <div style={{ fontSize: 13, color: nl.soft, lineHeight: 1.4 }}>
        {price > 0 && cost != null ? `You make about ${moneyText(price - cost)} on each one. ` : ""}
        {m.standItemId ? "Picked-up orders take it off your farm stand stock." : ""}
      </div>
    </div>
  );
}

function PageSettingsSheet({ open, onClose, data, update }) {
  const op = cleanPageSettings(data.orderPage || {});
  const [intro, setIntro] = useState(op.intro);
  const [pickup, setPickup] = useState(op.pickup);
  const [menu, setMenu] = useState(() => ownerMenu((data.orderPage || {}).menu));
  const [joinList, setJoinList] = useState(op.joinList);
  const [joinGroupId, setJoinGroupId] = useState(op.joinGroupId);
  const [emailMe, setEmailMe] = useState(op.emailMe);
  const [confirmNew, setConfirmNew] = useState(false);
  useEffect(() => {
    if (!open) return;
    const o = cleanPageSettings(data.orderPage || {});
    setIntro(o.intro); setPickup(o.pickup); setMenu(ownerMenu((data.orderPage || {}).menu)); setJoinList(o.joinList); setJoinGroupId(o.joinGroupId); setEmailMe(o.emailMe); setConfirmNew(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const stand = standItems(data);
  const standToAdd = stand.filter((i) => !menu.some((m) => m.standItemId === i.id || m.name.toLowerCase() === String(i.name).toLowerCase()));
  const credits = creditChoices(data);
  const groups = Array.isArray(data.customerGroups) ? data.customerGroups.filter((g) => g && g.id && g.name) : [];
  const setItem = (id, patch) => setMenu((m) => m.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const save = (extra = {}) => {
    update((d) => {
      const prev = d.orderPage && typeof d.orderPage === "object" ? d.orderPage : {};
      d.orderPage = {
        ...prev, intro: intro.slice(0, ORDER_LIMITS.intro), pickup: pickup.slice(0, ORDER_LIMITS.pickupText),
        menu: menu.filter((m) => m.name.trim()).slice(0, ORDER_LIMITS.menu).map((m) => ({ ...m, name: m.name.trim().slice(0, ORDER_LIMITS.menuName), price: Number(m.price) > 0 ? Math.round(Number(m.price) * 100) / 100 : null, cost: m.cost === "" || m.cost == null || !(Number(m.cost) >= 0) ? null : Math.round(Number(m.cost) * 100) / 100 })),
        joinList, joinGroupId, emailMe, ...extra,
      };
      return d;
    });
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} label="Order page settings" showClose maxHeight="92vh">
      <h2 style={{ margin: "0 4px 4px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>Your order page</h2>
      <p style={{ margin: "0 4px 6px", fontSize: 14, color: nl.soft, lineHeight: 1.45 }}>What customers see when they open your link or scan your sign.</p>

      <label style={labelStyle} htmlFor="op-intro">A short hello (optional)</label>
      <textarea id="op-intro" style={{ ...inputStyle, minHeight: 80 }} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Farm-fresh eggs, sourdough and seasonal veggies from our family homestead." maxLength={ORDER_LIMITS.intro} />
      <label style={labelStyle} htmlFor="op-pickup">Pickup details (optional)</label>
      <input id="op-pickup" style={inputStyle} value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Saturdays 9 to noon at the stand" maxLength={ORDER_LIMITS.pickupText} />

      <div style={{ ...labelStyle, marginTop: 18 }}>What people can order</div>
      <p style={{ margin: "0 4px 8px", fontSize: 13, color: nl.soft, lineHeight: 1.45 }}>Customers see each item's name, price, unit and note. What it costs you to make stays private, just for you.</p>
      <div style={{ background: nl.card, border: `1px solid ${nl.line}`, borderRadius: 16 }}>
        {menu.length === 0 && <div style={{ padding: 14, fontSize: 14, color: nl.soft }}>Nothing yet. Add eggs, bread, meat birds, anything. Customers can also write what they want in a note.</div>}
        {menu.map((m, i) => (
          <div key={m.id} style={{ padding: 12, borderTop: i ? `1px solid ${nl.rule}` : "none", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input aria-label="Item name" style={{ ...inputStyle, flex: 2 }} value={m.name} onChange={(e) => setItem(m.id, { name: e.target.value })} placeholder="Dozen eggs" maxLength={ORDER_LIMITS.menuName} />
              <button type="button" aria-label={`Remove ${m.name || "item"}`} onClick={() => setMenu((x) => x.filter((y) => y.id !== m.id))} style={{ width: 48, height: 48, border: "none", background: "none", color: nl.soft, cursor: "pointer" }}><Trash2 size={18} /></button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <label style={{ flex: 1, minWidth: 0 }}>
                <span style={miniLabel}>Price customers see</span>
                <input aria-label="Price customers see (optional)" type="number" inputMode="decimal" min={0} step="0.01" style={inputStyle} value={m.price == null ? "" : m.price} onChange={(e) => setItem(m.id, { price: e.target.value === "" ? null : e.target.value })} placeholder="$ Price" />
              </label>
              <label style={{ flex: 1, minWidth: 0 }}>
                <span style={miniLabel}>Unit</span>
                <input aria-label="Unit (optional)" style={inputStyle} value={m.unit} onChange={(e) => setItem(m.id, { unit: e.target.value.slice(0, ORDER_LIMITS.unit) })} placeholder="dozen, loaf, bird" />
              </label>
            </div>
            <input aria-label="Note for customers (optional)" style={inputStyle} value={m.note} onChange={(e) => setItem(m.id, { note: e.target.value.slice(0, ORDER_LIMITS.menuNote) })} placeholder="Note, like Brown and blue eggs, or Ready mid-June" />
            <PrivateBox m={m} setItem={setItem} credits={credits} stand={stand} data={data} />
            <Toggle on={m.available} onChange={(v) => setItem(m.id, { available: v })} label="Taking orders for this" sub={m.available ? null : "Hidden from your order page for now"} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <Button small kind="quiet" icon={<Plus size={18} />} onClick={() => setMenu((m) => [...m, { id: newId(), name: "", unit: "", price: null, cost: null, credit: "", standItemId: "", note: "", available: true }])} disabled={menu.length >= ORDER_LIMITS.menu}>Add an item</Button>
        {standToAdd.length > 0 && <Button small kind="quiet" onClick={() => setMenu((m) => [...m, ...standToAdd.slice(0, ORDER_LIMITS.menu - m.length).map((i) => ({ id: newId(), name: String(i.name).slice(0, ORDER_LIMITS.menuName), unit: String(i.unit || "").slice(0, ORDER_LIMITS.unit), price: Number(i.pricePerUnit) > 0 ? Number(i.pricePerUnit) : null, cost: Number(i.costPerUnit) > 0 ? Number(i.costPerUnit) : null, credit: "farmstand", standItemId: i.id, note: "", available: true }))])}>Add my farm stand items ({standToAdd.length})</Button>}
      </div>

      <div style={{ marginTop: 14, background: nl.card, border: `1px solid ${nl.line}`, borderRadius: 16, padding: "2px 10px" }}>
        <Toggle on={joinList} onChange={setJoinList} label="Let people join my email list" sub="They show up here so you can add them to your customers" />
        {joinList && groups.length > 0 && (
          <div style={{ padding: "0 4px 12px" }}>
            <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="op-group">Put them on this list</label>
            <select id="op-group" style={inputStyle} value={joinGroupId} onChange={(e) => setJoinGroupId(e.target.value)}>
              <option value="">No particular list</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{[g.emoji, g.name].filter(Boolean).join(" ")}</option>)}
            </select>
          </div>
        )}
        <div style={{ borderTop: `1px solid ${nl.rule}` }}>
          <Toggle on={emailMe} onChange={setEmailMe} label="Email me new requests" sub="They always show in Orders too" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <Button onClick={() => save()}>Save</Button>
        <Button kind="quiet" onClick={onClose}>Cancel</Button>
      </div>
      <div style={{ marginTop: 18, paddingTop: 12, borderTop: `1px solid ${nl.rule}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {confirmNew
          ? <Button small kind="quiet" onClick={() => save({ token: newOrderToken() })}>Yes, make a new link</Button>
          : <Button small kind="quiet" onClick={() => setConfirmNew(true)}>Make a new link</Button>}
        <Button small kind="quiet" onClick={() => save({ on: false })}>Turn off my order page</Button>
      </div>
      {confirmNew && <p style={{ fontSize: 13, color: nl.soft, margin: "8px 4px 0" }}>The old link and QR sign stop working. Print a new sign after.</p>}
    </Sheet>
  );
}

// ---------------------------------------------------------------- QR sign
async function drawSign(url, farm) {
  const W = 1200, H = 1600;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#F4EDE0"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#2C1810"; g.textAlign = "center";
  g.font = "64px Georgia, serif";
  const name = farm.length > 26 ? `${farm.slice(0, 25)}…` : farm;
  g.fillText(name, W / 2, 170);
  g.font = "600 46px -apple-system, Segoe UI, Roboto, sans-serif";
  g.fillText("Order ahead or join our list", W / 2, 250);
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, url, { width: 820, margin: 2, errorCorrectionLevel: "M", color: { dark: "#2C1810", light: "#FFFFFF" } });
  g.fillStyle = "#FFFFFF"; g.fillRect(W / 2 - 440, 320, 880, 880);
  g.drawImage(qr, W / 2 - 410, 350, 820, 820);
  g.fillStyle = "#2C1810";
  g.font = "40px -apple-system, Segoe UI, Roboto, sans-serif";
  g.fillText("Point your phone camera here", W / 2, 1290);
  g.fillStyle = "#5C4530"; g.font = "30px -apple-system, Segoe UI, Roboto, sans-serif";
  g.fillText(url.replace(/^https:\/\//, ""), W / 2, 1360);
  g.fillText("No payment online. Just a request we'll reply to.", W / 2, 1420);
  return new Promise((ok) => c.toBlob((b) => ok(b), "image/png"));
}

function QrSheet({ open, onClose, url, farm }) {
  const [src, setSrc] = useState("");
  const [msg, setMsg] = useState("");
  const blobRef = useRef(null);
  useEffect(() => {
    if (!open || !url) return undefined;
    let off = false;
    setMsg("");
    drawSign(url, farm).then((b) => { if (off || !b) return; blobRef.current = b; setSrc(URL.createObjectURL(b)); }).catch(() => setMsg("Couldn't make the sign. Try again."));
    return () => { off = true; };
  }, [open, url, farm]);
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);
  return (
    <Sheet open={open} onClose={onClose} label="QR code sign" showClose maxHeight="92vh">
      <h2 style={{ margin: "0 4px 4px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>Sign for your stand</h2>
      <p style={{ margin: "0 4px 10px", fontSize: 14, color: nl.soft, lineHeight: 1.45 }}>Print it and tape it up at the stand. Customers scan it to send a request or join your list.</p>
      {src ? <img src={src} alt={`QR code sign for ${farm}`} style={{ width: "100%", maxWidth: 360, display: "block", margin: "0 auto", borderRadius: 12, border: `1px solid ${nl.line}` }} />
        : <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: nl.soft }}>{msg || "Making your sign…"}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <Button icon={<Share2 size={18} />} disabled={!src} onClick={async () => { const r = await shareImageBlob(blobRef.current, { filename: "order-sign.png", title: `${farm} order sign` }); setMsg(r === "downloaded" ? "Saved. Print it from your photos or downloads." : ""); }}>Save or print the sign</Button>
      </div>
      {msg && src && <p style={{ fontSize: 13, color: nl.soft, margin: "8px 4px 0" }}>{msg}</p>}
    </Sheet>
  );
}

// ---------------------------------------------------------------- update sheet
const NEXT = {
  accept: { status: "accepted", title: "Accept this order", button: "Accept", hint: "They'll get an email saying you've got it." , placeholder: "Thanks! I'll have them ready Saturday morning." },
  ready: { status: "ready", title: "Mark it ready", button: "It's ready", hint: "They'll get an email saying it's ready to pick up.", placeholder: "Ready in the cooler by the stand." },
  decline: { status: "declined", title: "Can't fill this one", button: "Decline", hint: "They'll get a kind email saying you can't fill it.", placeholder: "Sorry, the hens are on a break until spring!" },
};
function UpdateSheet({ req, step, onClose, onDone }) {
  const s = NEXT[step];
  const [message, setMessage] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!req || !s) return null;
  const go = async () => {
    setBusy(true); setErr("");
    try {
      const r = await callOrders("update", { id: req.id, status: s.status, message: message.trim(), notify });
      onDone(r && r.emailError ? `Saved, but ${r.emailError.charAt(0).toLowerCase()}${r.emailError.slice(1)}` : notify && r && r.emailed ? `Done. ${req.customer_name} got an email.` : "Done.");
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} label={s.title} showClose>
      <h2 style={{ margin: "0 4px 4px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>{s.title}</h2>
      <p style={{ margin: "0 4px 8px", fontSize: 14, color: nl.soft }}>{req.customer_name} · {(req.items || []).map(itemLine).join(", ") || req.note}</p>
      <div style={{ background: nl.card, border: `1px solid ${nl.line}`, borderRadius: 16, padding: "2px 10px" }}>
        <Toggle on={notify} onChange={setNotify} label={`Email ${req.customer_name}`} sub={notify ? s.hint : "No email. Let them know yourself."} />
      </div>
      {notify && (
        <>
          <label style={labelStyle} htmlFor="ou-msg">Add a message (optional)</label>
          <textarea id="ou-msg" style={{ ...inputStyle, minHeight: 80 }} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={s.placeholder} maxLength={ORDER_LIMITS.message} />
        </>
      )}
      {err && <p role="alert" style={{ color: nl.alert, fontSize: 14, margin: "10px 4px 0" }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <Button onClick={go} disabled={busy}>{busy ? "Saving…" : s.button}</Button>
        <Button kind="quiet" onClick={onClose}>Cancel</Button>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- picked up → Sales
// Marks the order picked up and, if the owner wants, adds each item to Sales
// and takes linked farm stand items off stock. Amounts start from the order
// and the menu, and every one can be changed first. addOnly is for an order
// that was already picked up before it was added to Sales.
function PickedUpSheet({ req, data, update, addOnly, onClose, onDone }) {
  const already = orderInSales(data, req.id);
  const [lines, setLines] = useState(() => orderLines(req, (data.orderPage || {}).menu, data));
  const [toSales, setToSales] = useState(!already);
  const [date, setDate] = useState(isoToday());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const stand = standItems(data);
  const credits = creditChoices(data);
  const setLine = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const t = lineTotals(lines);
  const go = async () => {
    setBusy(true); setErr("");
    try {
      if (!addOnly) await callOrders("update", { id: req.id, status: "done", notify: false });
    } catch (e) { setErr(e.message); setBusy(false); return; }
    let added = null;
    if (toSales && !orderInSales(data, req.id)) {
      const em = String(req.email || "").toLowerCase();
      const buyer = em && Array.isArray(data.customers) ? data.customers.find((c) => c && String(c.email || "").toLowerCase() === em) : null;
      const sales = salesFromLines(lines, { req, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : isoToday(), buyerId: buyer ? buyer.id : null });
      added = sales.length ? sales.reduce((n, x) => n + x.totalRevenue, 0) : null;
      if (sales.length) update((d) => {
        if (!Array.isArray(d.sales)) d.sales = [];
        if (d.sales.some((x) => x && x.fromOrder === req.id)) return d;
        d.sales.push(...sales);
        const h = (d.hobbies || []).find((x) => x && x.id === "farmstand");
        lines.forEach((l) => {
          if (!l.standItemId || l.from === "none") return;
          const it = h && Array.isArray(h.items) ? h.items.find((x) => x && x.id === l.standItemId) : null;
          if (it) takeStock(it, Number(l.qty) || 0, l.from);
        });
        return d;
      });
    }
    const head = addOnly ? "Added to Sales." : "Marked picked up.";
    onDone(added != null ? `${addOnly ? "Added" : "Picked up."} ${moneyText(added)} ${addOnly ? "to Sales." : "added to Sales."}` : head);
  };
  return (
    <Sheet open onClose={onClose} label={addOnly ? "Add this order to Sales" : "Picked up"} showClose maxHeight="92vh">
      <h2 style={{ margin: "0 4px 4px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>{addOnly ? "Add to Sales" : "Picked up"}</h2>
      <p style={{ margin: "0 4px 8px", fontSize: 14, color: nl.soft }}>{req.customer_name} · {(req.items || []).map(itemLine).join(", ") || req.note}</p>
      {already ? (
        <div style={{ background: nl.chip, borderRadius: 12, padding: "10px 12px", fontSize: 14 }}>This order is already in Sales. Change it there if anything's off.</div>
      ) : (
        <>
          {!addOnly && (
            <div style={{ background: nl.card, border: `1px solid ${nl.line}`, borderRadius: 16, padding: "2px 10px" }}>
              <Toggle on={toSales} onChange={setToSales} label="Add it to Sales" sub={toSales ? "Check the amounts below" : "Just mark it picked up"} />
            </div>
          )}
          {toSales && (
            <>
              <label style={labelStyle} htmlFor="pu-date">Sale date</label>
              <input id="pu-date" type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                {lines.map((l) => {
                  const it = stand.find((x) => x.id === l.standItemId);
                  const choices = credits.some((c) => c.id === l.credit) ? credits : [...credits, { id: l.credit, label: l.credit }];
                  return (
                    <div key={l.key} style={{ background: nl.card, border: `1px solid ${nl.line}`, borderRadius: 16, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      {l.free
                        ? <label><span style={miniLabel}>What they got</span><input aria-label="What they got" style={inputStyle} value={l.name} onChange={(e) => setLine(l.key, { name: e.target.value.slice(0, ORDER_LIMITS.menuName) })} /></label>
                        : <div style={{ fontSize: 16, fontWeight: 600 }}>{l.name}{l.unit ? <span style={{ fontWeight: 400, color: nl.soft }}> · {l.unit}</span> : null}</div>}
                      <div style={{ display: "flex", gap: 8 }}>
                        <label style={{ flex: 1, minWidth: 0 }}><span style={miniLabel}>How many</span>
                          <input aria-label={`How many ${l.name}`} type="number" inputMode="decimal" min={0} style={inputStyle} value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value })} /></label>
                        <label style={{ flex: 1, minWidth: 0 }}><span style={miniLabel}>Price each</span>
                          <input aria-label={`Price each for ${l.name}`} type="number" inputMode="decimal" min={0} step="0.01" style={inputStyle} value={l.price} onChange={(e) => setLine(l.key, { price: e.target.value })} placeholder="$" /></label>
                        <label style={{ flex: 1, minWidth: 0 }}><span style={miniLabel}>Cost each <Lock size={11} aria-hidden="true" /></span>
                          <input aria-label={`Cost to make each ${l.name} (private)`} type="number" inputMode="decimal" min={0} step="0.01" style={inputStyle} value={l.cost} onChange={(e) => setLine(l.key, { cost: e.target.value })} placeholder="$" /></label>
                      </div>
                      <label><span style={miniLabel}>Count it under</span>
                        <select aria-label={`Count ${l.name} under`} style={inputStyle} value={l.credit} onChange={(e) => setLine(l.key, { credit: e.target.value })}>
                          {choices.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select></label>
                      {l.credit === "eggs" && (
                        <label><span style={miniLabel}>Eggs in each {l.unit || "one"}</span>
                          <input aria-label={`Eggs in each ${l.unit || "one"}`} type="number" inputMode="numeric" min={1} style={inputStyle} value={l.eggsPer} onChange={(e) => setLine(l.key, { eggsPer: e.target.value })} /></label>
                      )}
                      {it && (
                        <label><span style={miniLabel}>Farm stand stock for {it.name}</span>
                          <select aria-label={`Farm stand stock for ${it.name}`} style={inputStyle} value={l.from} onChange={(e) => setLine(l.key, { from: e.target.value })}>
                            {stockOnStand(it) != null && <option value="stand">Take {Number(l.qty) || 0} off the stand ({stockOnStand(it)} there)</option>}
                            {stockInBack(it) > 0 && <option value="back">Take {Number(l.qty) || 0} from back stock ({stockInBack(it)} there)</option>}
                            <option value="none">Don't change stock</option>
                          </select></label>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 12, padding: "10px 12px", background: nl.chip, borderRadius: 12, fontSize: 14, lineHeight: 1.5 }}>
                <div><strong>{moneyText(t.revenue)}</strong> goes into Sales{t.cost > 0 ? ` · costs ${moneyText(t.cost)} · about ${moneyText(t.revenue - t.cost)} profit` : ""}</div>
                <div style={{ color: nl.soft, fontSize: 13 }}>Your costs stay private. The customer never sees them.</div>
              </div>
            </>
          )}
        </>
      )}
      {err && <p role="alert" style={{ color: nl.alert, fontSize: 14, margin: "10px 4px 0" }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <Button onClick={go} disabled={busy || (addOnly && (already || !t.count))}>{busy ? "Saving…" : addOnly ? "Add to Sales" : "Mark picked up"}</Button>
        <Button kind="quiet" onClick={onClose}>Cancel</Button>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- cards
function OrderCard({ req, onStep, onPickedUp, onRemove, inSales }) {
  const items = Array.isArray(req.items) ? req.items : [];
  const total = orderTotal(items);
  const when = orderPrettyDate(req.pickup_date);
  const actions = req.status === "new"
    ? [{ label: "Accept", primary: true, run: () => onStep(req, "accept") }, { label: "Can't fill it", run: () => onStep(req, "decline") }]
    : req.status === "accepted"
      ? [{ label: "It's ready", primary: true, run: () => onStep(req, "ready") }, { label: "Picked up", run: () => onPickedUp(req) }]
      : req.status === "ready"
        ? [{ label: "Picked up", primary: true, run: () => onPickedUp(req) }]
        : [...(req.status === "done" && !inSales ? [{ label: "Add to Sales", run: () => onPickedUp(req, true) }] : []), { label: "Remove", run: () => onRemove(req) }];
  const badge = { new: { tone: "ready", text: "New" }, accepted: { tone: "quiet", text: "Accepted" }, ready: { tone: "good", text: "Ready" }, done: { tone: "quiet", text: "Picked up" }, declined: { tone: "alert", text: "Declined" } }[req.status];
  return (
    <div style={{ padding: "12px 14px", borderTop: `1px solid ${nl.rule}`, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, overflowWrap: "anywhere" }}>{req.customer_name}</div>
          <div style={{ fontSize: 13, color: nl.soft }}>{[ago(req.created_at), when ? `wants it ${when}` : null].filter(Boolean).join(" · ")}</div>
        </div>
        {inSales && <span title="In Sales" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: nl.soft }}><Receipt size={14} aria-hidden="true" />In Sales</span>}
        {badge && <Badge tone={badge.tone}>{badge.text}</Badge>}
      </div>
      {items.length > 0 && (
        <div style={{ fontSize: 15, lineHeight: 1.5 }}>
          {items.map((i, k) => <div key={`${i.id || k}`}>{itemLine(i)}{Number(i.price) > 0 ? <span style={{ color: nl.soft }}> · {moneyText(Number(i.price) * Number(i.qty))}</span> : null}</div>)}
          {total != null && items.length > 1 && <div style={{ color: nl.soft, fontSize: 14 }}>About {moneyText(total)} total</div>}
        </div>
      )}
      {req.note && <div style={{ fontSize: 14, background: nl.chip, borderRadius: 10, padding: "8px 10px", overflowWrap: "anywhere" }}>{req.note}</div>}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 14 }}>
        <a href={`mailto:${req.email}`} style={{ color: nl.goodInk, display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32 }}><Mail size={16} aria-hidden="true" />{req.email}</a>
        {req.phone && <a href={`tel:${req.phone.replace(/[^0-9+]/g, "")}`} style={{ color: nl.goodInk, display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32 }}><Phone size={16} aria-hidden="true" />{req.phone}</a>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {actions.map((a) => <Button key={a.label} small kind={a.primary ? "primary" : "quiet"} onClick={a.run}>{a.label}</Button>)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- screen
export default function OrdersScreen({ data, update, user, onBack, onSignIn, onCountChange }) {
  const op = cleanPageSettings(data.orderPage || {});
  const farm = String(((data.stockEmailSettings || {}).fromName) || data.homesteadName || "").trim() || "Our farm stand";
  const url = op.token ? `${ORDER_SITE}${op.token}` : "";
  const [reqs, setReqs] = useState(null);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  const [settings, setSettings] = useState(false);
  const [qr, setQr] = useState(false);
  const [step, setStep] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const signedIn = !!user;

  const load = useCallback(() => {
    if (!signedIn || !op.on) return;
    setErr("");
    callOrders("list").then((r) => { setReqs(Array.isArray(r.requests) ? r.requests : []); if (onCountChange) onCountChange(); }).catch((e) => { setErr(e.message); setReqs((x) => x || []); });
  }, [signedIn, op.on, onCountChange]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(""), 4000); return () => clearTimeout(t); }, [toast]);

  const turnOn = () => {
    update((d) => {
      const prev = d.orderPage && typeof d.orderPage === "object" ? d.orderPage : {};
      d.orderPage = { joinList: true, emailMe: true, menu: [], ...prev, on: true, token: /^[a-f0-9]{40}$/.test(prev.token || "") ? prev.token : newOrderToken() };
      return d;
    });
    setSettings(true);
  };
  const [pickup, setPickup] = useState(null);
  const remove = async (req) => {
    try { await callOrders("remove", { id: req.id }); load(); } catch (e) { setToast(e.message); }
  };
  const addJoins = async (list) => {
    const op2 = cleanPageSettings(data.orderPage || {});
    update((d) => {
      if (!Array.isArray(d.customers)) d.customers = [];
      list.forEach((j) => {
        const em = String(j.email || "").toLowerCase();
        const have = d.customers.find((c) => c && String(c.email || "").toLowerCase() === em);
        if (have) {
          have.groups = Array.isArray(have.groups) ? have.groups : [];
          if (op2.joinGroupId && !have.groups.includes(op2.joinGroupId)) have.groups.push(op2.joinGroupId);
          if (have.emailOk === false) have.emailOk = true;
        } else {
          d.customers.push({ id: newId(), name: String(j.customer_name || "").slice(0, 60), email: em, groups: op2.joinGroupId ? [op2.joinGroupId] : [], note: "Joined from your order page", emailOk: true });
        }
      });
      return d;
    });
    await Promise.all(list.map((j) => callOrders("update", { id: j.id, status: "added" }).catch(() => {})));
    setToast(list.length === 1 ? `${list[0].customer_name} is on your list.` : `${list.length} people added to your list.`);
    load();
  };
  const ignoreJoin = async (j) => { try { await callOrders("update", { id: j.id, status: "ignored" }); load(); } catch (e) { setToast(e.message); } };

  const groups = useMemo(() => {
    const list = Array.isArray(reqs) ? reqs : [];
    const orders = list.filter((r) => r.kind === "order");
    return {
      fresh: orders.filter((r) => r.status === "new"),
      open: orders.filter((r) => r.status === "accepted" || r.status === "ready"),
      past: orders.filter((r) => r.status === "done" || r.status === "declined"),
      joins: list.filter((r) => r.kind === "join" && r.status === "new"),
    };
  }, [reqs]);

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: onBack ? -10 : 0 }}>
      {onBack && (
        <button type="button" aria-label="Back to More" onClick={onBack} style={{ width: 44, height: 44, border: "none", background: "none", cursor: "pointer", color: nl.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
      )}
      <h1 style={{ margin: 0, fontFamily: font.display, fontWeight: 400, fontSize: type.title }}>Orders</h1>
    </div>
  );

  if (!signedIn || !op.on) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {header}
        <Card padded>
          <div style={{ fontFamily: font.display, fontSize: 22 }}>Take pre-orders from customers</div>
          <div style={{ fontSize: 15, color: nl.soft, marginTop: 6, lineHeight: 1.5 }}>
            Get a link and a QR sign for your stand. Customers pick what they'd like (eggs, bread, meat birds, anything you list) or ask to join your email list. You see every request here, accept or decline it, and mark it ready. No payments, just a simple way to talk.
          </div>
          <div style={{ marginTop: 14 }}>
            {signedIn ? <Button icon={<ShoppingBag size={20} />} onClick={turnOn}>Set up my order page</Button>
              : <Button onClick={onSignIn}>Sign in (free) to take orders</Button>}
          </div>
        </Card>
        <PageSettingsSheet open={settings} onClose={() => setSettings(false)} data={data} update={update} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {header}
      {toast && <div role="status" style={{ background: nl.deep, color: nl.onDeep, borderRadius: 14, padding: "10px 14px", fontSize: 14 }}>{toast}</div>}

      <Card>
        <CardHeader title="Your order page" right={<Badge tone="good">On</Badge>} />
        <Row icon={ic(Link2)} title="Share your link" sub={url.replace(/^https:\/\//, "")} onClick={async () => { const r = await shareUrl(url, `Order from ${farm}:`); if (r === "copied") setToast("Link copied."); }} chevron />
        <Row icon={ic(QrCode)} title="QR code sign for the stand" sub="Print it and tape it up" onClick={() => setQr(true)} chevron />
        <Row icon={ic(Settings2)} title="Menu and page settings" sub={op.menu.length ? `${op.menu.filter((m) => m.available).length} of ${op.menu.length} items taking orders` : "Add what people can order"} onClick={() => setSettings(true)} chevron />
        <Row icon={ic(Copy)} title="Copy link" onClick={async () => { try { await navigator.clipboard.writeText(url); setToast("Link copied."); } catch (_) { setToast(url); } }} />
      </Card>

      {err && <Card padded><div role="alert" style={{ fontSize: 14, color: nl.alert }}>{err}</div><div style={{ marginTop: 8 }}><Button small kind="quiet" onClick={load}>Try again</Button></div></Card>}
      {reqs === null && !err && <div style={{ color: nl.soft, fontSize: 14, padding: "0 4px" }}>Checking for requests…</div>}

      {groups.fresh.length > 0 && (
        <Card>
          <CardHeader title="New requests" right={`${groups.fresh.length}`} />
          {groups.fresh.map((r) => <OrderCard key={r.id} req={r} onStep={(q, s) => setStep({ req: q, s })} onPickedUp={(q, addOnly) => setPickup({ req: q, addOnly: !!addOnly })} onRemove={remove} inSales={orderInSales(data, r.id)} />)}
        </Card>
      )}
      {groups.joins.length > 0 && (
        <Card>
          <CardHeader title="Want to join your list" right={groups.joins.length > 1 ? <Button kind="link" onClick={() => addJoins(groups.joins)}>Add all</Button> : null} />
          {groups.joins.map((j) => (
            <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: `1px solid ${nl.rule}` }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: nl.chip, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{ic(UserPlus)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 600, overflowWrap: "anywhere" }}>{j.customer_name}</span>
                <span style={{ display: "block", fontSize: 13, color: nl.soft, overflowWrap: "anywhere" }}>{j.email} · {ago(j.created_at)}</span>
              </span>
              <button type="button" aria-label={`Add ${j.customer_name} to your list`} onClick={() => addJoins([j])} style={{ width: 44, height: 44, borderRadius: 22, border: `1.5px solid ${nl.good}`, background: "transparent", color: nl.goodInk, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={20} /></button>
              <button type="button" aria-label={`Ignore ${j.customer_name}`} onClick={() => ignoreJoin(j)} style={{ width: 44, height: 44, borderRadius: 22, border: `1.5px solid ${nl.field}`, background: "transparent", color: nl.soft, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon size={20} /></button>
            </div>
          ))}
        </Card>
      )}
      {groups.open.length > 0 && (
        <Card>
          <CardHeader title="To fill" right={`${groups.open.length}`} />
          {groups.open.map((r) => <OrderCard key={r.id} req={r} onStep={(q, s) => setStep({ req: q, s })} onPickedUp={(q, addOnly) => setPickup({ req: q, addOnly: !!addOnly })} onRemove={remove} inSales={orderInSales(data, r.id)} />)}
        </Card>
      )}
      {reqs && !groups.fresh.length && !groups.open.length && !groups.joins.length && (
        <Card padded>
          <div style={{ fontFamily: font.display, fontSize: 20 }}>No requests right now</div>
          <div style={{ fontSize: 14, color: nl.soft, marginTop: 4, lineHeight: 1.45 }}>Share your link or put the QR sign up at the stand. New requests show up here{op.emailMe ? " and in your email" : ""}.</div>
        </Card>
      )}
      {groups.past.length > 0 && (
        <Card>
          <Row first title={`Past orders (${groups.past.length})`} sub="Picked up and declined, last 6 months" onClick={() => setShowPast((v) => !v)}
            trailing={<ChevronDown size={18} color={nl.soft} style={{ transform: showPast ? "rotate(180deg)" : "none" }} aria-hidden="true" />} />
          {showPast && groups.past.map((r) => <OrderCard key={r.id} req={r} onStep={() => {}} onPickedUp={(q, addOnly) => setPickup({ req: q, addOnly: !!addOnly })} onRemove={remove} inSales={orderInSales(data, r.id)} />)}
        </Card>
      )}

      <PageSettingsSheet open={settings} onClose={() => setSettings(false)} data={data} update={update} />
      <QrSheet open={qr} onClose={() => setQr(false)} url={url} farm={farm} />
      {pickup && <PickedUpSheet key={pickup.req.id} req={pickup.req} addOnly={pickup.addOnly} data={data} update={update} onClose={() => setPickup(null)} onDone={(m) => { setPickup(null); setToast(m); load(); }} />}
      {step && <UpdateSheet req={step.req} step={step.s} onClose={() => setStep(null)} onDone={(m) => { setStep(null); setToast(m); load(); }} />}
    </div>
  );
}

export function ordersMoreLine(count) {
  if (!count || !count.total) return null;
  const parts = [];
  if (count.newOrders) parts.push(`${count.newOrders} new request${count.newOrders === 1 ? "" : "s"}`);
  if (count.newJoins) parts.push(`${count.newJoins} want${count.newJoins === 1 ? "s" : ""} to join your list`);
  return parts.join(" · ");
}
