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
import { ChevronLeft, Link2, QrCode, Settings2, Mail, Phone, Check, X as XIcon, ShoppingBag, UserPlus, Plus, Trash2, ChevronDown, Share2, Copy, Lock, Receipt, MessageSquare } from "lucide-react";
import { nl, font, type } from "./newlook/theme.js";
import { Card, CardHeader, Row, Button, Badge, Sheet, Chip } from "./newlook/ui.jsx";
import { supabase, isSupabaseConfigured } from "./supabase.js";
import { getActiveHomesteadId } from "./sync.js";
import { apiUrl } from "./apiBase.js";
import { shareImageBlob, shareUrl } from "./shareCard.js";
import { cleanDelivery, repeatLabel, smsGroupHref, GROUP_TEXT_MAX, cleanPageSettings, ORDER_LIMITS, itemLine, moneyText, orderTotal, orderPrettyDate, PAY_METHODS, cleanHandle, cleanPay, payLabel, payLink, payInstructions, WEEKDAYS, cleanDays, smsHref, orderText } from "./orderShared.js";
import CustomersPanel from "./Customers.jsx";
import { ownerMenu, creditChoices, guessCredit, standItems, orderLines, lineTotals, salesFromLines, takeStock, stockOnStand, stockInBack, orderInSales, isoToday } from "./orderSales.js";
import { cleanSupply, sourceKey, guessPer, baseLabel, harvestUnitOf, measureSource, measureSnaps, sameSnaps, planAll, addDays, LIVE_FROM, BIRTH_DEFAULTS, repeatDates } from "./orderSupply.js";
import { hobbyAllEntries } from "./allEntries.js";
import { homeSnaps, homeFromHobbies, standItemFor, putOut } from "./homeInventory.js";
import { matchCustomer } from "./customerMatch.js";

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
  const [count, setCount] = useState({ newOrders: 0, newJoins: 0, pickups: [] });
  const refresh = useCallback(() => {
    if (!on) { setCount({ newOrders: 0, newJoins: 0, pickups: [] }); return; }
    callOrders("count", { today: isoToday() }).then((c) => setCount({ newOrders: Number(c.newOrders) || 0, newJoins: Number(c.newJoins) || 0, pickups: Array.isArray(c.pickups) ? c.pickups : [] })).catch(() => {});
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

// Hens, goats, garden, birds… plus what's at home for farm stand items.
// Odd old data must never stop the app, so a failure just means no numbers.
const allSnaps = (data, menu, today) => {
  let home = {}, live = {};
  try { home = homeSnaps(data, menu, today); } catch (e) { console.warn("[orders] home snaps", e); }
  try { live = measureSnaps(data, menu, today); } catch (e) { console.warn("[orders] snaps", e); }
  return { ...home, ...live };
};

// Keeps the numbers the order page uses for live producers (eggs, milk,
// garden) up to date as logs come in: data.orderPage.snaps. Runs in the app
// because the logs live here; the server only reads the small snapshot.
export function useOrderSupplySnaps(data, update) {
  const op = data && data.orderPage;
  const on = !!(op && op.on);
  useEffect(() => {
    if (!on) return undefined;
    const t = setTimeout(() => {
      const menu = ownerMenu(op.menu);
      const next = allSnaps(data, menu, isoToday());
      if (sameSnaps(next, op.snaps || {})) return;
      update((d) => { if (d.orderPage && typeof d.orderPage === "object") d.orderPage.snaps = allSnaps(d, ownerMenu(d.orderPage.menu), isoToday()); return d; });
    }, 1500);
    return () => clearTimeout(t);
  }, [on, data && data.entries, data && data.sales, data && data.hobbies, op && op.menu]); // eslint-disable-line react-hooks/exhaustive-deps
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
      <SupplyBox m={m} setItem={setItem} stand={stand} data={data} />
      <div style={{ fontSize: 13, color: nl.soft, lineHeight: 1.4 }}>
        {price > 0 && cost != null ? `You make about ${moneyText(price - cost)} on each one. ` : ""}
        {m.standItemId ? "Picked-up orders take it off your farm stand stock." : ""}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- where it comes from
// Pre-orders (src/orderSupply.js): where an item comes from decides how much
// customers can order and when it's likely ready.
// Which hobbies can supply an item, and how.
const LIVE_TYPES = { egg_layers: ["eggs"], goats: ["milk", "births"], cows: ["milk", "births"], sheep: ["milk", "births"], pigs: ["births"], rabbits: ["births"], garden: ["garden"], meat_chickens: ["birds"], incubator: ["hatch"] };
const LIVE_LABEL = { eggs: (n) => `Eggs from ${n}`, milk: (n) => `Milk from ${n}`, garden: (n) => `${n}: a crop`, birds: (n) => `${n}: birds as they're ready`, hatch: (n) => `${n}: chicks as they hatch`, births: (n) => `${n}: young as they're born` };
function supplyChoices(data, stand) {
  const out = [{ value: "", label: "Not tracked (no limit)" }];
  stand.forEach((i) => out.push({ value: `stand:${i.id}`, label: `Farm stand: ${i.name}` }));
  ((data && data.hobbies) || []).filter((h) => h && h.id && !h.hidden && LIVE_TYPES[h.type]).forEach((h) => {
    const name = String(h.name || h.type).replace(/\s*\p{Extended_Pictographic}/gu, "").trim();
    LIVE_TYPES[h.type].forEach((from) => out.push({ value: `${from}:${h.id}`, label: LIVE_LABEL[from](name) }));
  });
  out.push({ value: "make", label: "Made to order (set a limit)" });
  return out;
}
function supplyValue(m) {
  const s = m.supply || {};
  if (s.from === "stand" || (!s.from && m.standItemId)) return m.standItemId ? `stand:${m.standItemId}` : "";
  if (LIVE_FROM.includes(s.from)) return `${s.from}:${s.hobbyId || ""}`;
  if (s.from === "make") return "make";
  return "";
}
// Crops this garden has harvested (most recent first).
function gardenCrops(data, hobbyId) {
  const seen = new Map();
  hobbyAllEntries(data, hobbyId).forEach((e) => {
    if (!e || e.action !== "harvested" || !String(e.plant || "").trim()) return;
    const k = String(e.plant).trim();
    const prev = seen.get(k.toLowerCase());
    if (!prev || String(e.date || "") > prev.date) seen.set(k.toLowerCase(), { name: k, date: String(e.date || "") });
  });
  return [...seen.values()].sort((a, b) => b.date.localeCompare(a.date)).map((x) => x.name).slice(0, 60);
}
const numIn = (v) => (v === "" || v == null ? "" : v);
const fmtNum = (n) => (Math.round(n * 10) / 10).toLocaleString();
function SupplyBox({ m, setItem, stand, data }) {
  const value = supplyValue(m);
  const s = cleanSupply(m.supply, m.unit);
  const choices = supplyChoices(data, stand);
  if (value && !choices.some((c) => c.value === value)) choices.push({ value, label: "Something no longer here" });
  const set = (supply, extra = {}) => setItem(m.id, { supply, ...extra });
  const pick = (v) => {
    if (!v) return setItem(m.id, { supply: { from: "" }, standItemId: "", credit: m.standItemId ? guessCredit({ name: m.name, unit: m.unit }, data) : m.credit });
    if (v.startsWith("stand:")) return setItem(m.id, { supply: { from: "stand" }, standItemId: v.slice(6), credit: "farmstand" });
    if (v === "make") return setItem(m.id, { supply: { from: "make", cap: s.cap || 12, capPer: s.capPer || "pickup" }, standItemId: "", credit: m.standItemId ? guessCredit({ name: m.name, unit: m.unit }, data) : m.credit });
    const [from, hobbyId] = v.split(":");
    const h = (data.hobbies || []).find((x) => x && x.id === hobbyId);
    const crop = from === "garden" ? (gardenCrops(data, hobbyId).find((c) => `${m.name}`.toLowerCase().includes(c.toLowerCase())) || gardenCrops(data, hobbyId)[0] || "") : "";
    const hu = from === "garden" ? harvestUnitOf(hobbyAllEntries(data, hobbyId), crop) : "";
    const credit = from === "eggs" ? "eggs" : from === "garden" ? "garden" : from === "birds" ? "meat_chickens" : guessCredit({ name: m.name, unit: m.unit }, data);
    return setItem(m.id, { supply: { from, hobbyId, flocks: [], animals: [], plant: crop, per: guessPer(from, m.unit, hu), keepPerWeek: 0 }, standItemId: "", credit: h ? credit : m.credit });
  };
  const today = isoToday();
  const live = s.from === "eggs" || s.from === "milk" || s.from === "garden";
  const young = s.from === "birds" || s.from === "hatch" || s.from === "births";
  const h = live || young ? (data.hobbies || []).find((x) => x && x.id === s.hobbyId) : null;
  const measured = (live || young) && h ? measureSource(data, s, today) : null;
  const per = live ? s.per || 1 : 1;
  const unit = m.unit || "one";
  const hu = s.from === "garden" ? harvestUnitOf(hobbyAllEntries(data, s.hobbyId), s.plant) : "";
  const base = baseLabel(s.from, hu);
  const toggleId = (field, id) => {
    const cur = new Set(s[field] || []);
    if (cur.has(id)) cur.delete(id); else cur.add(id);
    set({ ...s, [field]: [...cur] });
  };
  let status = "";
  if (young && measured) {
    const next = (measured.batches || []).slice().sort((a, b) => a.on.localeCompare(b.on))[0];
    const what = s.from === "birds" ? "birds" : s.from === "hatch" ? "chicks" : "young";
    status = `${measured.onHand ? `${measured.onHand} ${what} ready now` : `None ready now`}${next ? `, about ${fmtNum(next.qty)} more ${orderPrettyDate(next.on)}` : ""}${(measured.batches || []).length > 1 ? ` and ${measured.batches.length - 1} more batch${measured.batches.length > 2 ? "es" : ""} after` : ""}.`
      + (s.from === "birds" ? " Counts live batches and birds in the freezer." : s.from === "hatch" ? ` Expects about ${Math.round((measured.rate || 0.7) * 100)}% of eggs to hatch.` : "");
  }
  if (live && measured) {
    const keep = (s.keepPerWeek || 0) / 7;
    const rate = measured.perDay == null ? null : Math.max(0, measured.perDay - keep);
    status = measured.planned
      ? `Not harvesting yet. From ${orderPrettyDate(measured.from)} (your calendar plan) we expect last year's pace, about ${fmtNum(rate / per)} ${unitFor(unit, 2)} a day.`
      : rate == null
      ? (s.from === "garden" ? "No recent harvests. Log some, or plan this crop on the Calendar so estimates can start from its harvest date." : "Not enough logs yet to know how much you get. Log a few days and estimates start.")
 : `Lately about ${fmtNum(rate / per)} ${unitFor(unit, 2)} a day${keep ? " after what you keep" : ""}${s.from === "eggs" ? (measured.counted ? `, with ${Math.floor(measured.onHand / per).toLocaleString()} ${unitFor(unit, Math.floor(measured.onHand / per))} on hand now.` : ". Turn on Eggs on hand (the Use Eggs tile) to count what's in the fridge too.") : "."}`;
  }
  return (
    <>
      <label>
        <span style={miniLabel}>Where it comes from</span>
        <select aria-label={`Where ${m.name || "this item"} comes from`} style={inputStyle} value={value} onChange={(e) => pick(e.target.value)}>
          {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>
      {s.from === "eggs" && h && (h.flocks || []).filter((f) => f && !f.archived).length > 1 && (
        <div>
          <span style={miniLabel}>Which flocks? (none picked = all)</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(h.flocks || []).filter((f) => f && !f.archived).map((f) => <Chip key={f.id} selected={s.flocks.includes(f.id)} onClick={() => toggleId("flocks", f.id)}>{f.name || f.birdType || "Flock"}</Chip>)}
          </div>
        </div>
      )}
      {s.from === "milk" && h && (h.animals || []).filter((a) => a && !a.archived).length > 1 && (
        <div>
          <span style={miniLabel}>Which animals? (none picked = all)</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(h.animals || []).filter((a) => a && !a.archived).slice(0, 30).map((a) => <Chip key={a.id} selected={s.animals.includes(a.id)} onClick={() => toggleId("animals", a.id)}>{a.name || "Unnamed"}</Chip>)}
          </div>
        </div>
      )}
      {s.from === "garden" && (
        <label>
          <span style={miniLabel}>Which crop</span>
          <select aria-label="Which crop" style={inputStyle} value={s.plant} onChange={(e) => { const c = e.target.value; set({ ...s, plant: c, per: guessPer("garden", m.unit, harvestUnitOf(hobbyAllEntries(data, s.hobbyId), c)) }); }}>
            {!s.plant && <option value="">Pick a crop you've harvested</option>}
            {[...new Set([s.plant, ...gardenCrops(data, s.hobbyId)].filter(Boolean))].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      )}
      {live && (
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ flex: 1, minWidth: 0 }}>
            <span style={miniLabel}>{base.charAt(0).toUpperCase() + base.slice(1)} in each {unit}</span>
            <input aria-label={`${base} in each ${unit}`} type="number" inputMode="decimal" min={0} step="any" style={inputStyle} value={numIn(m.supply && m.supply.per != null ? m.supply.per : s.per)} onChange={(e) => set({ ...s, per: e.target.value })} />
          </label>
          <label style={{ flex: 1, minWidth: 0 }}>
            <span style={miniLabel}>Keep for us each week</span>
            <input aria-label={`${unit} to keep for yourself each week`} type="number" inputMode="decimal" min={0} step="any" style={inputStyle} value={s.keepPerWeek ? String(Math.round((s.keepPerWeek / per) * 100) / 100) : ""} placeholder={`0 ${unit}`} onChange={(e) => set({ ...s, keepPerWeek: (Number(e.target.value) || 0) * per })} />
          </label>
        </div>
      )}
      {young && h && (
        <div style={{ display: "flex", gap: 8 }}>
          {s.from !== "hatch" && (
            <label style={{ flex: 1, minWidth: 0 }}>
              <span style={miniLabel}>{s.from === "birds" ? "Ready at (weeks old)" : "Go home at (weeks old)"}</span>
              <input aria-label={s.from === "birds" ? "Weeks old when ready" : "Weeks old when they can go home"} type="number" inputMode="decimal" min={1} style={inputStyle} value={numIn(m.supply && m.supply.readyWeeks)} placeholder={String(s.from === "birds" ? 8 : (BIRTH_DEFAULTS[h.type] || { readyWeeks: 8 }).readyWeeks)} onChange={(e) => set({ ...s, readyWeeks: e.target.value })} />
            </label>
          )}
          {s.from === "births" && (
            <label style={{ flex: 1, minWidth: 0 }}>
              <span style={miniLabel}>Young from each birth</span>
              <input aria-label="Young expected from each birth" type="number" inputMode="decimal" min={0} step="any" style={inputStyle} value={numIn(m.supply && m.supply.perBirth)} placeholder={String((BIRTH_DEFAULTS[h.type] || { perBirth: 1 }).perBirth)} onChange={(e) => set({ ...s, perBirth: e.target.value })} />
            </label>
          )}
          {s.from === "hatch" && (
            <label style={{ flex: 1, minWidth: 0 }}>
              <span style={miniLabel}>Hatch rate (%)</span>
              <input aria-label="Share of eggs that hatch, in percent" type="number" inputMode="numeric" min={1} max={100} style={inputStyle} value={m.supply && m.supply.rate ? Math.round(Number(m.supply.rate) * 100) : ""} placeholder={String(Math.round(((measured && measured.rate) || 0.7) * 100))} onChange={(e) => set({ ...s, rate: e.target.value === "" ? 0 : Number(e.target.value) / 100 })} />
            </label>
          )}
        </div>
      )}
      {s.from === "make" && (
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ flex: 1, minWidth: 0 }}>
            <span style={miniLabel}>I can make up to</span>
            <input aria-label={`How many ${unit} you can make`} type="number" inputMode="numeric" min={1} style={inputStyle} value={numIn(m.supply && m.supply.cap != null ? m.supply.cap : s.cap)} onChange={(e) => set({ ...s, cap: e.target.value })} />
          </label>
          <label style={{ flex: 1, minWidth: 0 }}>
            <span style={miniLabel}>Each</span>
            <select aria-label="Per pickup day or per week" style={inputStyle} value={s.capPer} onChange={(e) => set({ ...s, capPer: e.target.value })}>
              <option value="pickup">Pickup day</option>
              <option value="week">Week</option>
            </select>
          </label>
        </div>
      )}
      {value.startsWith("stand:") && (
        <Toggle on={m.preorder === true} onChange={(v) => setItem(m.id, { preorder: v })} label="Take pre-orders when it runs out" sub={m.preorder ? "People can order more than what's ready. Back stock with a ready date counts toward when." : "People can only order what's ready"} />
      )}
      {sourceKey({ ...m, supply: s }) && (value.startsWith("stand:") ? m.preorder === true : true) && (
        <Toggle on={m.showAhead !== false} onChange={(v) => setItem(m.id, { showAhead: v })} label="Show how much is ordered ahead" sub={m.showAhead !== false ? "Like \"10 dozen already ordered for the next 2 weeks\"" : "Customers only see when it's likely ready"} />
      )}
      {(status || s.from === "make") && (
        <div style={{ fontSize: 13, color: nl.soft, lineHeight: 1.4 }}>
          {status}{s.from === "make" ? `Orders fill each ${s.capPer === "week" ? "week" : "pickup day"} up to ${s.cap || 0}, then move to the next one.` : ""}
          {live || young || s.from === "make" ? " Customers see when their order is likely ready, and can still order more than you have." : ""}
        </div>
      )}
    </>
  );
}

// "How customers can pay": the farm's handles and which ways it takes money.
// Customers pay the farm directly; Henalytics only shows the handle and a
// link that opens the app with the amount filled in.
// Opens a link outside the app (the system browser on phones, so Venmo or
// Cash App can take over). window.Capacitor is set by the native shell.
function openOutside(url) {
  const cap = typeof window !== "undefined" ? window.Capacitor : null;
  if (cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform()) {
    import("@capacitor/browser").then(({ Browser }) => Browser.open({ url })).catch(() => { window.location.href = url; });
    return;
  }
  window.open(url, "_blank", "noopener");
}

const HANDLE_HINT = { venmo: "@username", cashapp: "$cashtag", paypal: "paypal.me name", zelle: "Phone or email for Zelle" };
function PaySettings({ pay, setPay, payWhen, setPayWhen }) {
  const any = PAY_METHODS.some((m) => (m.handle ? String(pay[m.id] || "").trim() : pay[m.id] === true));
  return (
    <>
      <div style={{ ...labelStyle, marginTop: 18 }}>How customers can pay</div>
      <p style={{ margin: "0 4px 8px", fontSize: 13, color: nl.soft, lineHeight: 1.45 }}>Customers pick one when they order, and see your username and a pay button. The money goes straight to you. Henalytics never touches it and can't see when someone pays, so mark orders paid here.</p>
      <div style={{ background: nl.card, border: `1px solid ${nl.line}`, borderRadius: 16, padding: "2px 10px" }}>
        {PAY_METHODS.map((m, i) => {
          const border = i ? { borderTop: `1px solid ${nl.rule}` } : null;
          if (!m.handle) return <div key={m.id} style={border}><Toggle on={pay[m.id] === true} onChange={(v) => setPay((p) => ({ ...p, [m.id]: v }))} label={m.label} /></div>;
          const raw = String(pay[m.id] || "");
          const bad = raw.trim() && !cleanHandle(m.id, raw);
          return (
            <label key={m.id} style={{ display: "block", padding: "10px 4px", ...border }}>
              <span style={{ display: "block", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{m.label}</span>
              <input aria-label={`Your ${m.label} (leave empty if you don't take it)`} style={inputStyle} value={raw} onChange={(e) => setPay((p) => ({ ...p, [m.id]: e.target.value.slice(0, 80) }))} placeholder={`${HANDLE_HINT[m.id]} (empty = don't offer)`} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              {bad && <span role="alert" style={{ display: "block", fontSize: 13, color: nl.alert, marginTop: 4 }}>That doesn't look like a {m.label} {m.id === "cashapp" ? "$cashtag" : "username"}.</span>}
              {!bad && m.id !== "zelle" && cleanHandle(m.id, raw) && (
                <Button small kind="link" onClick={(e) => { e.preventDefault(); openOutside(payLink(m.id, raw)); }}>Check my {m.label} link</Button>
              )}
            </label>
          );
        })}
      </div>
      <p style={{ margin: "8px 4px 0", fontSize: 13, color: nl.soft, lineHeight: 1.45 }}>Double-check each one, and use "Check my link" to make sure it opens your account. Henalytics isn't responsible for payments sent to a wrong or mistyped username, and doesn't process, hold or refund any payments.</p>
      {any && (
        <>
          <label style={labelStyle} htmlFor="op-paywhen">When should they pay?</label>
          <select id="op-paywhen" style={inputStyle} value={payWhen} onChange={(e) => setPayWhen(e.target.value)}>
            <option value="order">Right after they order</option>
            <option value="accepted">After I accept the order</option>
          </select>
          <p style={{ margin: "6px 4px 0", fontSize: 13, color: nl.soft, lineHeight: 1.45 }}>{payWhen === "accepted" ? "They get the pay button in the email when you accept it." : "They see the pay button as soon as they send the order. If you can't fill it, you'd send the money back."}</p>
        </>
      )}
    </>
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
  const [pay, setPay] = useState(op.pay);
  const [payWhen, setPayWhen] = useState(op.payWhen);
  const [pickupDays, setPickupDays] = useState(op.pickupDays);
  const [paused, setPaused] = useState(op.paused);
  const [pausedNote, setPausedNote] = useState(op.pausedNote);
  const [delivery, setDelivery] = useState(op.delivery);
  const [standing, setStanding] = useState(op.standing);
  const [autoAccept, setAutoAccept] = useState(op.autoAccept);
  const [notifyBack, setNotifyBack] = useState(op.notifyBack);
  const [confirmNew, setConfirmNew] = useState(false);
  // A stray tap outside the sheet shouldn't throw away a menu's worth of edits.
  const [leaving, setLeaving] = useState(false);
  const snap = (o, mn) => JSON.stringify([o.intro, o.pickup, mn, o.joinList, o.joinGroupId, o.emailMe, o.pay, o.payWhen, [...o.pickupDays].sort(), o.paused, o.pausedNote, o.delivery, o.standing, o.autoAccept, o.notifyBack]);
  const tryClose = () => {
    const now = snap({ intro, pickup, joinList, joinGroupId, emailMe, pay, payWhen, pickupDays, paused, pausedNote, delivery, standing, autoAccept, notifyBack }, menu);
    if (now !== snap(cleanPageSettings(data.orderPage || {}), ownerMenu((data.orderPage || {}).menu))) setLeaving(true); else onClose();
  };
  useEffect(() => {
    if (!open) return;
    const o = cleanPageSettings(data.orderPage || {});
    setIntro(o.intro); setPickup(o.pickup); setMenu(ownerMenu((data.orderPage || {}).menu)); setJoinList(o.joinList); setJoinGroupId(o.joinGroupId); setEmailMe(o.emailMe); setPay(o.pay); setPayWhen(o.payWhen); setPickupDays(o.pickupDays); setPaused(o.paused); setPausedNote(o.pausedNote); setDelivery(o.delivery); setStanding(o.standing); setAutoAccept(o.autoAccept); setNotifyBack(o.notifyBack); setConfirmNew(false); setLeaving(false);
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
        menu: menu.filter((m) => m.name.trim()).slice(0, ORDER_LIMITS.menu).map((m) => ({ ...m, name: m.name.trim().slice(0, ORDER_LIMITS.menuName), price: Number(m.price) > 0 ? Math.round(Number(m.price) * 100) / 100 : null, cost: m.cost === "" || m.cost == null || !(Number(m.cost) >= 0) ? null : Math.round(Number(m.cost) * 100) / 100, maxEach: Number(m.maxEach) >= 1 ? Math.floor(Number(m.maxEach)) : null, supply: cleanSupply(m.supply, m.unit), preorder: m.preorder === true, showAhead: m.showAhead !== false })),
        joinList, joinGroupId, emailMe, pay: cleanPay(pay), payWhen,
        delivery: cleanDelivery(delivery), standing, autoAccept, notifyBack,
        pickupDays: cleanDays(pickupDays), paused, pausedNote: pausedNote.trim().slice(0, ORDER_LIMITS.pausedNote), ...extra,
      };
      // Measure the hens, goats or garden now, so the page has numbers right away.
      d.orderPage.snaps = allSnaps(d, ownerMenu(d.orderPage.menu), isoToday());
      return d;
    });
    onClose();
  };
  return (
    <Sheet open={open} onClose={tryClose} label="Order page settings" showClose maxHeight="92vh">
      <h2 style={{ margin: "0 4px 4px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>Your order page</h2>
      <p style={{ margin: "0 4px 6px", fontSize: 14, color: nl.soft, lineHeight: 1.45 }}>What customers see when they open your link or scan your sign.</p>

      <label style={labelStyle} htmlFor="op-intro">A short hello (optional)</label>
      <textarea id="op-intro" style={{ ...inputStyle, minHeight: 80 }} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Farm-fresh eggs, sourdough and seasonal veggies from our family homestead." maxLength={ORDER_LIMITS.intro} />
      <label style={labelStyle} htmlFor="op-pickup">Pickup details (optional)</label>
      <input id="op-pickup" style={inputStyle} value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Saturdays 9 to noon at the stand" maxLength={ORDER_LIMITS.pickupText} />
      <div style={labelStyle} id="op-days-label">Pickup days (optional)</div>
      <div role="group" aria-labelledby="op-days-label" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {WEEKDAYS.map((w, d) => {
          const on = pickupDays.includes(d);
          return <button key={w} type="button" aria-pressed={on} onClick={() => setPickupDays((x) => (on ? x.filter((y) => y !== d) : [...x, d]))} style={{ minWidth: 48, minHeight: 44, borderRadius: 22, border: `1.5px solid ${on ? nl.good : nl.field}`, background: on ? nl.goodTint : "transparent", color: on ? nl.goodInk : nl.ink, font: `600 14px ${font.body}`, cursor: "pointer" }}>{w}</button>;
        })}
      </div>
      <p style={{ margin: "6px 4px 0", fontSize: 13, color: nl.soft }}>{pickupDays.length ? "Customers pick one of the next pickup days from a list." : "None picked: customers can ask for any date."}</p>
      <div style={{ marginTop: 14, background: nl.card, border: `1px solid ${nl.line}`, borderRadius: 16, padding: "2px 10px" }}>
        <Toggle on={paused} onChange={setPaused} label="Pause new orders" sub={paused ? "Your page stays up, but the order form is hidden" : "Take a break without turning the page off"} />
        {paused && <div style={{ padding: "0 4px 12px" }}><input aria-label="Message while paused" style={inputStyle} value={pausedNote} onChange={(e) => setPausedNote(e.target.value)} maxLength={ORDER_LIMITS.pausedNote} placeholder="The hens are on break. Back in spring!" /></div>}
        <div style={{ borderTop: `1px solid ${nl.rule}` }}>
          <Toggle on={delivery.on} onChange={(v) => setDelivery((d) => ({ ...d, on: v }))} label="Offer delivery" sub={delivery.on ? "Customers pick pickup or delivery and add their address" : "Porch drop-offs, a town run, anything"} />
          {delivery.on && (
            <div style={{ display: "flex", gap: 8, padding: "0 4px 12px" }}>
              <label style={{ flex: 1, minWidth: 0 }}><span style={miniLabel}>Delivery fee</span>
                <input aria-label="Delivery fee (optional)" type="number" inputMode="decimal" min={0} step="0.01" style={inputStyle} value={delivery.fee == null ? "" : delivery.fee} onChange={(e) => setDelivery((d) => ({ ...d, fee: e.target.value === "" ? null : e.target.value }))} placeholder="$ Free" /></label>
              <label style={{ flex: 2, minWidth: 0 }}><span style={miniLabel}>Where you deliver</span>
                <input aria-label="Where you deliver (optional)" style={inputStyle} value={delivery.note} onChange={(e) => setDelivery((d) => ({ ...d, note: e.target.value.slice(0, ORDER_LIMITS.deliveryNote) }))} placeholder="Within 5 miles, Thursdays" /></label>
            </div>
          )}
        </div>
        <div style={{ borderTop: `1px solid ${nl.rule}` }}>
          <Toggle on={standing} onChange={setStanding} label="Standing orders" sub={!pickupDays.length ? "Pick pickup days above to use this" : standing ? "Customers can ask for the same order every 1 to 4 weeks" : "Like a dozen eggs every Saturday"} />
        </div>
        <div style={{ borderTop: `1px solid ${nl.rule}` }}>
          <Toggle on={autoAccept} onChange={setAutoAccept} label="Accept on their own when there's enough" sub={autoAccept ? "Orders you can clearly fill are accepted right away. You handle the rest." : "You accept every order yourself"} />
        </div>
        <div style={{ borderTop: `1px solid ${nl.rule}` }}>
          <Toggle on={notifyBack} onChange={setNotifyBack} label={'"Email me when it\'s back"'} sub="On sold-out items. You send the note when it's back." />
        </div>
      </div>

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
            <label>
              <span style={miniLabel}>Most one order can get (optional)</span>
              <input aria-label={`Most ${m.unit || "of these"} one order can get (optional)`} type="number" inputMode="numeric" min={1} style={inputStyle} value={m.maxEach == null ? "" : m.maxEach} onChange={(e) => setItem(m.id, { maxEach: e.target.value === "" ? null : e.target.value })} placeholder="No limit" />
            </label>
            <PrivateBox m={m} setItem={setItem} credits={credits} stand={stand} data={data} />
            <Toggle on={m.available} onChange={(v) => setItem(m.id, { available: v })} label="Taking orders for this" sub={m.available ? null : "Hidden from your order page for now"} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <Button small kind="quiet" icon={<Plus size={18} />} onClick={() => setMenu((m) => [...m, { id: newId(), name: "", unit: "", price: null, cost: null, credit: "", standItemId: "", note: "", available: true }])} disabled={menu.length >= ORDER_LIMITS.menu}>Add an item</Button>
        {standToAdd.length > 0 && <Button small kind="quiet" onClick={() => setMenu((m) => [...m, ...standToAdd.slice(0, ORDER_LIMITS.menu - m.length).map((i) => ({ id: newId(), name: String(i.name).slice(0, ORDER_LIMITS.menuName), unit: String(i.unit || "").slice(0, ORDER_LIMITS.unit), price: Number(i.pricePerUnit) > 0 ? Number(i.pricePerUnit) : null, cost: Number(i.costPerUnit) > 0 ? Number(i.costPerUnit) : null, credit: "farmstand", standItemId: i.id, note: "", available: true }))])}>Add my farm stand items ({standToAdd.length})</Button>}
      </div>

      <PaySettings pay={pay} setPay={setPay} payWhen={payWhen} setPayWhen={setPayWhen} />

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
      {leaving && (
        <div role="alertdialog" aria-label="Save your changes?" style={{ position: "sticky", bottom: 0, marginTop: 12, padding: 12, background: nl.card, border: `1.5px solid ${nl.field}`, borderRadius: 16, boxShadow: `0 -6px 18px ${nl.shadow}` }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Save your changes?</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button small onClick={() => save()}>Save</Button>
            <Button small kind="quiet" onClick={onClose}>Don't save</Button>
            <Button small kind="quiet" onClick={() => setLeaving(false)}>Keep editing</Button>
          </div>
        </div>
      )}
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
function UpdateSheet({ req, step, data, onClose, onDone }) {
  const s = NEXT[step];
  const [message, setMessage] = useState("");
  const [notify, setNotify] = useState(true);
  const canText = !!(req && req.phone && req.text_ok);
  const [text, setText] = useState(canText);
  const [textReady, setTextReady] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!req || !s) return null;
  const hint = s.status === "ready" && req.fulfil === "delivery" ? "They'll get an email saying it's ready for delivery." : s.hint;
  const op = cleanPageSettings((data && data.orderPage) || {});
  const farm = String((((data && data.stockEmailSettings) || {}).fromName) || (data && data.homesteadName) || "").trim();
  const total = orderTotal(req.items);
  const pi = req.pay_method && !req.paid && s.status !== "declined" ? payInstructions({ method: req.pay_method, op, amount: total, farm, delivery: req.fulfil === "delivery" }) : null;
  const sms = canText ? smsHref(req.phone, orderText({ status: s.status, name: req.customer_name, farm, items: req.items, message: message.trim(), pickupText: op.pickup, delivery: req.fulfil === "delivery", payLine: pi ? `${pi.line}${pi.link ? ` ${pi.link}` : ""}` : "" })) : "";
  if (textReady) {
    return (
      <Sheet open onClose={() => onDone(textReady)} label="Send the text" showClose>
        <h2 style={{ margin: "0 4px 4px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>Now send the text</h2>
        <p style={{ margin: "0 4px 12px", fontSize: 14, color: nl.soft }}>{textReady} Messages opens with your text to {req.customer_name} filled in. Just hit send.</p>
        <a href={sms} onClick={() => setTimeout(() => onDone(textReady), 400)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 52, borderRadius: 14, background: nl.yolk, color: nl.onYolk, fontWeight: 700, textDecoration: "none" }}><MessageSquare size={20} aria-hidden="true" />Text {req.customer_name}</a>
        <div style={{ marginTop: 8 }}><Button kind="quiet" onClick={() => onDone(textReady)}>Skip the text</Button></div>
      </Sheet>
    );
  }
  const go = async () => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await callOrders("update", { id: req.id, status: s.status, message: message.trim(), notify });
      const said = r && r.already ? `Done. ${req.customer_name} already got that email a few minutes ago.` : r && r.emailError ? `Saved, but ${r.emailError.charAt(0).toLowerCase()}${r.emailError.slice(1)}` : notify && r && r.emailed ? `Done. ${req.customer_name} got an email.` : "Done.";
      if (text && canText) { setBusy(false); setTextReady(said); return; }
      onDone(said);
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} label={s.title} showClose>
      <h2 style={{ margin: "0 4px 4px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>{s.title}</h2>
      <p style={{ margin: "0 4px 8px", fontSize: 14, color: nl.soft }}>{req.customer_name} · {(req.items || []).map(itemLine).join(", ") || req.note}</p>
      <div style={{ background: nl.card, border: `1px solid ${nl.line}`, borderRadius: 16, padding: "2px 10px" }}>
        <Toggle on={notify} onChange={setNotify} label={`Email ${req.customer_name}`} sub={notify ? hint : "No email. Let them know yourself."} />
        {canText
          ? <div style={{ borderTop: `1px solid ${nl.rule}` }}><Toggle on={text} onChange={setText} label={`Text ${req.customer_name}`} sub={text ? `From your phone, to ${req.phone}` : "No text"} /></div>
          : <div style={{ borderTop: `1px solid ${nl.rule}`, padding: "10px 4px", fontSize: 13, color: nl.soft }}>{req.phone ? "They didn't say it's OK to text, so email only." : "No phone number for texting."}</div>}
      </div>
      {(notify || text) && (
        <>
          <label style={labelStyle} htmlFor="ou-msg">Add a message (optional)</label>
          <textarea id="ou-msg" style={{ ...inputStyle, minHeight: 80 }} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={s.placeholder} maxLength={ORDER_LIMITS.message} />
        </>
      )}
      {err && <p role="alert" style={{ color: nl.alert, fontSize: 14, margin: "10px 4px 0" }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <Button onClick={go} disabled={busy}>{busy ? "Saving…" : text && canText ? `${s.button} and text` : s.button}</Button>
        <Button kind="quiet" onClick={onClose}>Cancel</Button>
      </div>
    </Sheet>
  );
}

// The Sales link for an order: a standing order's pickups are each their own.
export const saleKey = (r) => (r && r.repeat_weeks && r.pickup_date ? `${r.id}@${r.pickup_date}` : r && r.id);

// ---------------------------------------------------------------- picked up → Sales
// Marks the order picked up and, if the owner wants, adds each item to Sales
// and takes linked farm stand items off stock. Amounts start from the order
// and the menu, and every one can be changed first. addOnly is for an order
// that was already picked up before it was added to Sales.
function PickedUpSheet({ req: req0, data, update, addOnly, onClose, onDone }) {
  let req = req0;
  // A standing order goes into Sales once per pickup, keyed by its day.
  const key = saleKey(req);
  const already = orderInSales(data, key);
  // Soap, jars or eggs another hobby keeps for a stand item (At home).
  const homeFor = (standItemId) => (standItemId ? homeFromHobbies(data, isoToday()).filter((e) => { const it = standItemFor(data, e); return it && it.id === standItemId; }) : []);
  const [lines, setLines] = useState(() => orderLines(req, (data.orderPage || {}).menu, data).map((l) => {
    // Not enough on the stand or in back stock, but there's some at home in
    // another hobby: take it from there (so it comes off that count too).
    const it = l.standItemId ? standItems(data).find((x) => x.id === l.standItemId) : null;
    const q = Number(l.qty) || 0;
    const home = homeFor(l.standItemId).find((e) => !e.readyOn && e.qty >= q);
    if (it && home && (stockOnStand(it) == null || stockOnStand(it) < q) && stockInBack(it) < q) return { ...l, from: `home:${home.key}` };
    return l;
  }));
  const [toSales, setToSales] = useState(!already);
  const [paidNow, setPaidNow] = useState(true);
  // A standing order's paid mark resets each week, so it isn't asked here;
  // the sale still records how they paid.
  const askPaid = !addOnly && !!req.pay_method && req.paid !== true && !req.repeat_weeks;
  const known = !!findCustomer(data, req);
  const [saveCust, setSaveCust] = useState(!known && !addOnly);
  const [date, setDate] = useState(isoToday());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const stand = standItems(data);
  const credits = creditChoices(data);
  const setLine = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const t = lineTotals(lines);
  const go = async () => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      // Someone already marked it (a second tap, or another phone): don't
      // move a standing order on twice or add the sale again.
      if (!addOnly && req.repeat_weeks) {
        // A standing order: this week's is picked up, the order moves to its next day.
        const r = await callOrders("next", { id: req.id, today: isoToday(), from: req.pickup_date || "" });
        if (r.already) { onDone(`Already marked picked up. Next one ${orderPrettyDate(r.next)}.`); return; }
        req = { ...req, nextDate: r.next };
      } else if (!addOnly) {
        const r = await callOrders("update", { id: req.id, status: "done", notify: false, ...(askPaid ? { paid: paidNow } : {}) });
        if (r.was === "done") { onDone("Already marked picked up."); return; }
      }
    } catch (e) { setErr(e.message); setBusy(false); return; }
    let added = null;
    const newBuyerId = !known && saveCust ? newId() : null;
    if (newBuyerId) update((d) => { saveCustomerInto(d, req, "", newBuyerId); return d; });
    // Already a customer (maybe added by hand with just a name or phone):
    // fill in the email they ordered with.
    else if (known) update((d) => { saveCustomerInto(d, req); return d; });
    if (toSales && !orderInSales(data, key)) {
      const found = findCustomer(data, req);
      const buyer = found || (newBuyerId ? { id: newBuyerId } : null);
      const sales = salesFromLines(lines, { req: { ...req, id: key }, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : isoToday(), buyerId: buyer ? buyer.id : null })
        .map((x) => (req.pay_method ? { ...x, payMethod: req.pay_method, note: `${x.note} · ${payLabel(req.pay_method)}` } : x));
      added = sales.length ? sales.reduce((n, x) => n + x.totalRevenue, 0) : null;
      if (sales.length) update((d) => {
        if (!Array.isArray(d.sales)) d.sales = [];
        if (d.sales.some((x) => x && x.fromOrder === key)) return d;
        d.sales.push(...sales);
        const h = (d.hobbies || []).find((x) => x && x.id === "farmstand");
        lines.forEach((l) => {
          if (!l.standItemId || l.from === "none") return;
          const it = h && Array.isArray(h.items) ? h.items.find((x) => x && x.id === l.standItemId) : null;
          if (!it) return;
          if (String(l.from).startsWith("home:")) {
            // Move it out from the hobby to the stand, then sell it from there.
            const e = homeFromHobbies(d, isoToday()).find((x) => x.key === l.from.slice(5));
            if (e) putOut(d, e, Number(l.qty) || 0, isoToday());
            takeStock(it, Number(l.qty) || 0, "stand");
          } else takeStock(it, Number(l.qty) || 0, l.from);
        });
        return d;
      });
    }
    const head = addOnly ? "Added to Sales." : req.nextDate ? `Picked up. Next one ${orderPrettyDate(req.nextDate)}.` : "Marked picked up.";
    const nextTxt = req.nextDate ? ` Next one ${orderPrettyDate(req.nextDate)}.` : "";
    onDone(added != null ? `${addOnly ? "Added" : "Picked up."} ${moneyText(added)} ${addOnly ? "to Sales." : "added to Sales."}${nextTxt}` : head);
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
              {!known && <div style={{ borderTop: `1px solid ${nl.rule}` }}><Toggle on={saveCust} onChange={setSaveCust} label={`Save ${req.customer_name} to your customers`} sub={req.text_ok ? "With their email, phone and OK to text" : "With their email"} /></div>}
              {askPaid && <div style={{ borderTop: `1px solid ${nl.rule}` }}><Toggle on={paidNow} onChange={setPaidNow} label={`They paid with ${payLabel(req.pay_method)}`} sub={paidNow ? "Marks the order paid" : "Leave it as not paid yet"} /></div>}
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
                            {homeFor(it.id).map((e) => <option key={e.key} value={`home:${e.key}`}>Take {Number(l.qty) || 0} from {e.note} ({e.qty} {e.unit} there)</option>)}
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

// ---------------------------------------------------------------- customers
// The saved customer for an order or sign-up: same email, phone, or a name
// saved without an email (someone added by hand who now ordered). See
// src/customerMatch.js.
export const findCustomer = (data, req) => matchCustomer(data && data.customers, typeof req === "string" ? { email: req } : { email: req && req.email, phone: req && req.phone, name: req && req.customer_name });
// Adds (or updates) a customer from an order or sign-up, keeping what the
// owner already has. Phone and "OK to text" only come in when the customer
// said it's OK to text.
export function saveCustomerInto(d, req, groupId = "", useId = "") {
  if (!Array.isArray(d.customers)) d.customers = [];
  const em = String(req.email || "").trim().toLowerCase();
  let c = findCustomer(d, req);
  // Added by hand without an email: this is it now.
  if (c && em && !String(c.email || "").trim()) c.email = em;
  if (!c) {
    c = { id: useId || newId(), name: String(req.customer_name || "").slice(0, 60), email: em, groups: [], note: req.kind === "join" ? "Joined from your order page" : "From an order", emailOk: true };
    d.customers.push(c);
  }
  if (groupId) { c.groups = Array.isArray(c.groups) ? c.groups : []; if (!c.groups.includes(groupId)) c.groups.push(groupId); }
  if (req.kind === "join" && c.emailOk === false) c.emailOk = true;
  if (req.text_ok && req.phone) { c.phone = String(req.phone).slice(0, 30); c.textOk = true; }
  return c;
}

// ---------------------------------------------------------------- pre-order plan
// When each open order is likely ready, from the same rules the order page
// uses (src/orderSupply.js), with the app's own fresh numbers.
function readyLine(req, plan) {
  if (!plan || !(req.status === "new" || req.status === "accepted") || !plan.orderReady.has(req.id)) return null;
  const d = plan.orderReady.get(req.id);
  if (d == null) return { short: true, text: "Not covered yet: more than you have or have coming." };
  const iso = addDays(plan.today, d);
  // A day that's already gone (not picked up yet) counts as today.
  const want = req.pickup_date && req.pickup_date < plan.today ? plan.today : req.pickup_date;
  const late = want && iso > want;
  if (late) return { short: true, text: `Short: likely ready ${orderPrettyDate(iso)}, after the day they want it.` };
  if (req.pickup_date) return { short: false, text: d === 0 ? "You have enough for this now." : `On track for ${orderPrettyDate(req.pickup_date)}.` };
  return { short: false, text: d === 0 ? "You have enough for this now." : `Likely ready ${orderPrettyDate(iso)}.` };
}
function SupplySummary({ plan, menu }) {
  if (!plan) return null;
  const rows = [];
  plan.sources.forEach((src, key) => {
    const items = menu.filter((m) => sourceKey(m) === key);
    if (!items.length) return;
    const p = plan.plans.get(key);
    const m = items[0];
    const per = src.mode === "slot" ? 1 : perUnitOf(m);
    const unit = m.unit || "";
    const ids = [...p.ready.keys()];
    const days = ids.map((id) => p.ready.get(id));
    const short = (plan.shortIds || new Set());
    const nShort = ids.filter((id) => short.has(id)).length;
    const last = days.some((d) => d == null) ? null : days.reduce((a, d) => Math.max(a, d), 0);
    const parts = [];
    if (src.mode === "stock") {
      const now = Math.floor(src.now / per);
      parts.push(`${now.toLocaleString()} ${unitFor(unit, now)} ready now`);
      if (src.perDay > 0) parts.push(`about ${fmtNum((src.perDay * 7) / per)} ${unitFor(unit, 2)} a week`);
    } else parts.push(`up to ${src.slots[0] ? src.slots[0].cap : 0} each ${m.supply && m.supply.capPer === "week" ? "week" : "pickup day"}`);
    if (p.ahead > 0) parts.push(`${fmtNum(p.ahead / per)} ${unitFor(unit, p.ahead / per)} ordered`);
    const tail = !ids.length ? "Nothing ordered yet." : last == null ? "More is ordered than you have or have coming." : last === 0 ? "You have enough for every open order." : `Caught up around ${orderPrettyDate(addDays(plan.today, last))}.`;
    rows.push(
      <div key={key} style={{ padding: "10px 14px", borderTop: `1px solid ${nl.rule}` }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{items.map((x) => x.name).join(", ")}</div>
        <div style={{ fontSize: 13, color: nl.soft, lineHeight: 1.45 }}>{parts.join(" · ")}</div>
        <div style={{ fontSize: 13, color: nShort || last == null ? nl.alertInk : nl.soft, lineHeight: 1.45 }}>{tail}{nShort ? ` ${nShort} order${nShort === 1 ? "" : "s"} may come up short.` : ""}</div>
      </div>,
    );
  });
  if (!rows.length) return null;
  return (
    <Card>
      <CardHeader title="What you can promise" />
      {rows}
    </Card>
  );
}
// "bird" → "birds" for counts other than one; "dozen" and "lbs" stay.
const unitFor = (unit, n) => {
  const u = String(unit || "").trim();
  if (!u || Math.abs(n - 1) < 1e-9 || /doz|dz/i.test(u) || /s$/i.test(u)) return u;
  if (/[^aeiou]y$/i.test(u)) return `${u.slice(0, -1)}ies`;
  if (/(af|lf)$/i.test(u)) return `${u.slice(0, -1)}ves`;
  if (/(ch|sh|x)$/i.test(u)) return `${u}es`;
  return `${u}s`;
};
const perUnitOf = (m) => { const s = cleanSupply(m.supply, m.unit); return s.per || 1; };

// ---------------------------------------------------------------- pickup day
// Everything for one pickup day: totals to pack, a checklist (ticking one
// marks it ready), and one tap to text or email everyone.
function PackingList({ orders, farm, onReady, onEmailAll }) {
  const today = isoToday();
  const dated = orders.filter((r) => (r.status === "accepted" || r.status === "ready") && r.pickup_date && r.pickup_date >= today);
  const dates = [...new Set(dated.map((r) => r.pickup_date))].sort().slice(0, 6);
  const [day, setDay] = useState(dates[0] || "");
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailedDays, setEmailedDays] = useState([]);
  useEffect(() => { if (!dates.includes(day)) setDay(dates[0] || ""); }, [dates.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!dates.length) return null;
  const list = dated.filter((r) => r.pickup_date === day);
  const waiting = orders.filter((r) => r.status === "new" && r.pickup_date === day).length;
  const totals = new Map();
  let deliveries = 0;
  list.forEach((r) => (r.items || []).forEach((i) => {
    if (!i) return;
    if (i.id === "delivery") { deliveries++; return; }
    const k = `${i.name}|${i.unit || ""}`;
    totals.set(k, { name: i.name, unit: i.unit || "", qty: (totals.get(k) ? totals.get(k).qty : 0) + (Number(i.qty) || 0) });
  }));
  const texters = list.filter((r) => r.text_ok && r.phone).slice(0, GROUP_TEXT_MAX);
  const ios = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent || "");
  const notReady = list.filter((r) => r.status !== "ready");
  return (
    <Card>
      <CardHeader title="Packing list" right={`${list.length} order${list.length === 1 ? "" : "s"}`} />
      {dates.length > 1 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "0 14px 10px" }}>
          {dates.map((d) => <Chip key={d} selected={d === day} onClick={() => setDay(d)}>{d === today ? "Today" : orderPrettyDate(d)}</Chip>)}
        </div>
      )}
      <div style={{ padding: "0 14px 10px", fontSize: 15, lineHeight: 1.6 }}>
        {[...totals.values()].map((t) => <div key={`${t.name}|${t.unit}`}><strong>{t.qty}</strong> {t.unit ? `${t.unit} ` : ""}{t.name}</div>)}
        <div style={{ fontSize: 13, color: nl.soft }}>{[deliveries ? `${deliveries} to deliver` : null, waiting ? `${waiting} more not accepted yet` : null].filter(Boolean).join(" · ")}</div>
      </div>
      <Row title={open ? "Hide the checklist" : "Checklist"} sub={`${list.length - notReady.length} of ${list.length} packed`} onClick={() => setOpen((v) => !v)} trailing={<ChevronDown size={18} color={nl.soft} style={{ transform: open ? "rotate(180deg)" : "none" }} aria-hidden="true" />} />
      {open && list.map((r) => (
        <button key={r.id} type="button" role="checkbox" aria-checked={r.status === "ready"} onClick={() => onReady(r, r.status !== "ready")} style={{ display: "flex", gap: 10, alignItems: "flex-start", width: "100%", padding: "10px 14px", border: "none", borderTop: `1px solid ${nl.rule}`, background: "none", color: nl.ink, font: "inherit", textAlign: "left", cursor: "pointer" }}>
          <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, marginTop: 1, border: `2px solid ${r.status === "ready" ? nl.good : nl.field}`, background: r.status === "ready" ? nl.good : "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{r.status === "ready" ? <Check size={16} strokeWidth={3} /> : null}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontWeight: 600 }}>{r.customer_name}{r.repeat_weeks ? <span style={{ fontWeight: 400, color: nl.soft }}> · {repeatLabel(r.repeat_weeks).toLowerCase()}</span> : null}</span>
            <span style={{ display: "block", fontSize: 14, color: nl.soft }}>{(r.items || []).filter((i) => i && i.id !== "delivery").map(itemLine).join(", ") || r.note}</span>
            {r.fulfil === "delivery" && <span style={{ display: "block", fontSize: 13, color: nl.goodInk }}>Deliver to {r.address}</span>}
          </span>
        </button>
      ))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "10px 14px 14px", borderTop: `1px solid ${nl.rule}` }}>
        {texters.length > 0 && (
          // A link, like Text customers uses: Messages opens with everyone in it.
          <a href={smsGroupHref(texters.map((r) => r.phone), `Hi, it's ${farm}! Your order is ready for ${day === today ? "today" : orderPrettyDate(day)}.`, ios)} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 14px", borderRadius: 20, border: `1.5px solid ${nl.field}`, color: nl.ink, textDecoration: "none", font: `600 14px ${font.body}` }}>
            <MessageSquare size={16} aria-hidden="true" />Text {texters.length === 1 ? texters[0].customer_name : `all ${texters.length}`}
          </a>
        )}
        {/* Everyone on the day, packed or not: ticking the checklist doesn't email. Once per day here. */}
        {list.length > 0 && (emailedDays.includes(day)
          ? <span style={{ alignSelf: "center", fontSize: 13, color: nl.soft }}>Emailed them it's ready.</span>
          : <Button small kind="quiet" icon={<Mail size={16} />} disabled={sending} onClick={async () => { if (sending) return; setSending(true); try { await onEmailAll(list); setEmailedDays((x) => [...x, day]); } finally { setSending(false); } }}>{sending ? "Emailing…" : notReady.length ? "Mark all ready and email them" : "Email them it's ready"}</Button>)}
      </div>
      {texters.length > 1 && ios && <p style={{ margin: "-6px 14px 12px", fontSize: 12, color: nl.soft }}>On iPhone a group text shows everyone's number to each other.</p>}
    </Card>
  );
}

// "Email me when it's back", grouped by item, with one tap to tell them.
function BackRequests({ rows, onSend, onDismiss }) {
  const [sending, setSending] = useState("");
  const byItem = new Map();
  rows.forEach((r) => (r.items || []).forEach((i) => {
    if (!i || !i.id) return;
    if (!byItem.has(i.id)) byItem.set(i.id, { id: i.id, name: i.name, people: [] });
    byItem.get(i.id).people.push(r);
  }));
  if (!byItem.size) return null;
  return (
    <Card>
      <CardHeader title="Want to know when it's back" />
      {[...byItem.values()].map((g) => (
        <div key={g.id} style={{ padding: "10px 14px", borderTop: `1px solid ${nl.rule}`, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{g.name} <span style={{ fontWeight: 400, color: nl.soft }}>· {g.people.length} {g.people.length === 1 ? "person" : "people"}</span></div>
          <div style={{ fontSize: 13, color: nl.soft, overflowWrap: "anywhere" }}>{g.people.map((r) => r.customer_name).join(", ")}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button small icon={<Mail size={16} />} disabled={!!sending} onClick={async () => { if (sending) return; setSending(g.id); try { await onSend(g); } finally { setSending(""); } }}>{sending === g.id ? "Emailing…" : "Email them it's back"}</Button>
            <Button small kind="quiet" onClick={() => onDismiss(g)}>Clear</Button>
          </div>
        </div>
      ))}
    </Card>
  );
}

// ---------------------------------------------------------------- cards
function OrderCard({ req, onStep, onPickedUp, onRemove, inSales, onPaid, customer, onSaveCustomer, farm, plan, onStop }) {
  // Remove deletes it for good: a second tap to be sure.
  const [sure, setSure] = useState(false);
  useEffect(() => { if (!sure) return undefined; const t = setTimeout(() => setSure(false), 4000); return () => clearTimeout(t); }, [sure]);
  const items = Array.isArray(req.items) ? req.items : [];
  const total = orderTotal(items);
  const when = orderPrettyDate(req.pickup_date);
  const est = readyLine(req, plan);
  const actions = req.status === "new"
    ? [{ label: "Accept", primary: true, run: () => onStep(req, "accept") }, { label: "Can't fill it", run: () => onStep(req, "decline") }]
    : req.status === "accepted"
      ? [{ label: "It's ready", primary: true, run: () => onStep(req, "ready") }, { label: "Picked up", run: () => onPickedUp(req) }]
      : req.status === "ready"
        ? [{ label: "Picked up", primary: true, run: () => onPickedUp(req) }]
        : [...(req.status === "done" && !inSales ? [{ label: "Add to Sales", run: () => onPickedUp(req, true) }] : []), { label: sure ? "Tap again to remove" : "Remove", run: () => (sure ? onRemove(req) : setSure(true)) }];
  const badge = { new: { tone: "ready", text: "New" }, accepted: { tone: "quiet", text: "Accepted" }, ready: { tone: "good", text: "Ready" }, done: { tone: "quiet", text: "Picked up" }, declined: { tone: "alert", text: "Declined" }, cancelled: { tone: "alert", text: "They cancelled" } }[req.status];
  const open = ["new", "accepted", "ready"].includes(req.status);
  return (
    <div style={{ padding: "12px 14px", borderTop: `1px solid ${nl.rule}`, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, overflowWrap: "anywhere" }}>{req.customer_name}{customer ? <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: nl.goodInk, background: nl.goodTint, borderRadius: 8, padding: "2px 7px", verticalAlign: "middle" }}>Customer</span> : null}</div>
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
      {(req.fulfil === "delivery" || req.repeat_weeks) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", fontSize: 14 }}>
          {req.repeat_weeks ? <Badge tone="good">{repeatLabel(req.repeat_weeks)}</Badge> : null}
          {req.fulfil === "delivery" ? <><Badge tone="ready">Delivery</Badge><a href={`https://maps.google.com/?q=${encodeURIComponent(req.address || "")}`} target="_blank" rel="noopener noreferrer" style={{ color: nl.goodInk, overflowWrap: "anywhere" }}>{req.address}</a></> : null}
          {req.repeat_weeks && open && onStop ? <Button small kind="link" onClick={() => onStop(req)}>Stop repeating</Button> : null}
        </div>
      )}
      {est && <div style={{ fontSize: 14, fontWeight: est.short ? 600 : 400, color: est.short ? nl.alertInk : nl.soft, background: est.short ? nl.alertTint : "transparent", borderRadius: 10, padding: est.short ? "8px 10px" : 0 }}>{est.text}</div>}
      {req.pay_method && req.status !== "declined" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 14 }}>
          <span>Paying with {payLabel(req.pay_method)}</span>
          {req.paid
            ? <Badge tone="good">Paid</Badge>
            : <span style={{ color: nl.soft }}>· not marked paid</span>}
          <Button small kind="link" onClick={() => onPaid(req, !req.paid)}>{req.paid ? "Undo paid" : "Mark paid"}</Button>
        </div>
      )}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 14 }}>
        <a href={`mailto:${req.email}`} style={{ color: nl.goodInk, display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32 }}><Mail size={16} aria-hidden="true" />{req.email}</a>
        {req.phone && <a href={`tel:${req.phone.replace(/[^0-9+]/g, "")}`} style={{ color: nl.goodInk, display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32 }}><Phone size={16} aria-hidden="true" />{req.phone}</a>}
        {req.phone && req.text_ok && <a href={smsHref(req.phone, orderText({ status: "other", name: req.customer_name, farm }))} style={{ color: nl.goodInk, display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32 }}><MessageSquare size={16} aria-hidden="true" />Text</a>}
        {!customer && <button type="button" onClick={() => onSaveCustomer(req)} style={{ border: "none", background: "none", padding: 0, color: nl.goodInk, font: "inherit", display: "inline-flex", alignItems: "center", gap: 4, minHeight: 32, cursor: "pointer" }}><UserPlus size={16} aria-hidden="true" />Save to customers</button>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {actions.map((a) => <Button key={a.label} small kind={a.primary ? "primary" : "quiet"} onClick={a.run}>{a.label}</Button>)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- screen
export default function OrdersScreen({ data, update, user, onBack, onSignIn, onCountChange, initialTab = "orders", onEmailCustomers, onTour }) {
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
  const [tab, setTab] = useState(initialTab === "customers" ? "customers" : "orders");
  useEffect(() => { setTab(initialTab === "customers" ? "customers" : "orders"); }, [initialTab]);
  const saveOne = (req) => {
    update((d) => { saveCustomerInto(d, req); return d; });
    setToast(`${req.customer_name} saved to your customers.`);
  };
  const setPaid = async (req, paid) => {
    setReqs((list) => (list || []).map((r) => (r.id === req.id ? { ...r, paid } : r)));
    try { await callOrders("paid", { id: req.id, paid }); setToast(paid ? `${req.customer_name} marked paid.` : "Marked not paid."); }
    catch (e) { setToast(e.message); load(); }
  };
  const remove = async (req) => {
    try { await callOrders("remove", { id: req.id }); load(); } catch (e) { setToast(e.message); }
  };
  const addJoins = async (list) => {
    const op2 = cleanPageSettings(data.orderPage || {});
    update((d) => { list.forEach((j) => saveCustomerInto(d, j, op2.joinGroupId)); return d; });
    await Promise.all(list.map((j) => callOrders("update", { id: j.id, status: "added" }).catch(() => {})));
    setToast(list.length === 1 ? `${list[0].customer_name} is on your list.` : `${list.length} people added to your list.`);
    load();
  };
  const stopRepeat = async (req) => {
    try { await callOrders("stop", { id: req.id }); setToast(`${req.customer_name}'s order won't repeat after this one.`); load(); } catch (e) { setToast(e.message); }
  };
  const markReady = async (req, ready) => {
    setReqs((list) => (list || []).map((r) => (r.id === req.id ? { ...r, status: ready ? "ready" : "accepted" } : r)));
    try { await callOrders("update", { id: req.id, status: ready ? "ready" : "accepted", notify: false }); } catch (e) { setToast(e.message); load(); }
  };
  const emailAllReady = async (list) => {
    const ids = new Set(list.map((r) => r.id));
    setReqs((all) => (all || []).map((r) => (ids.has(r.id) ? { ...r, status: "ready" } : r)));
    let n = 0;
    for (const r of list) { try { const x = await callOrders("update", { id: r.id, status: "ready", notify: true }); if (x.emailed) n++; } catch (_) { /* keep going */ } }
    setToast(`${list.length === 1 ? "1 order" : `${list.length} orders`} ready${n ? `, emailed ${n}` : ""}.`);
    load();
  };
  const sendBack = async (g) => {
    try { const r = await callOrders("back", { itemId: g.id }); setToast(r.sent ? `Emailed ${r.sent} ${r.sent === 1 ? "person" : "people"} that ${g.name} is back.` : "No one to email."); load(); } catch (e) { setToast(e.message); }
  };
  const clearBack = async (g) => {
    try { await callOrders("clearBack", { itemId: g.id }); } catch (e) { setToast(e.message); }
    load();
  };
  const ignoreJoin = async (j) => { try { await callOrders("update", { id: j.id, status: "ignored" }); load(); } catch (e) { setToast(e.message); } };

  const ownMenu = useMemo(() => ownerMenu((data.orderPage || {}).menu), [data.orderPage]);
  const plan = useMemo(() => {
    if (!Array.isArray(reqs)) return null;
    const today = isoToday();
    const orders = reqs.filter((r) => r.kind === "order");
    const snaps = allSnaps(data, ownMenu, today);
    const out = planAll(ownMenu, orders, { today, hobbies: data.hobbies, snaps, pickupDays: op.pickupDays });
    if (!out.sources.size) return null;
    const shortIds = new Set(orders.filter((r) => { const l = readyLine(r, { ...out, today }); return l && l.short; }).map((r) => r.id));
    return { ...out, today, shortIds };
  }, [reqs, data, ownMenu, op.pickupDays]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => {
    const list = Array.isArray(reqs) ? reqs : [];
    const orders = list.filter((r) => r.kind === "order");
    return {
      fresh: orders.filter((r) => r.status === "new"),
      today: orders.filter((r) => (r.status === "accepted" || r.status === "ready") && r.pickup_date === isoToday()),
      open: orders.filter((r) => (r.status === "accepted" || r.status === "ready") && r.pickup_date !== isoToday()).sort((a, b) => String(a.pickup_date || "9999").localeCompare(String(b.pickup_date || "9999"))),
      past: orders.filter((r) => r.status === "done" || r.status === "declined" || r.status === "cancelled"),
      backs: list.filter((r) => r.kind === "notify" && r.status === "new"),
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
      <h1 style={{ margin: 0, fontFamily: font.display, fontWeight: 400, fontSize: type.title }}>{tab === "customers" ? "Customers" : "Orders"}</h1>
    </div>
  );
  const nCust = Array.isArray(data.customers) ? data.customers.filter((c) => c && c.id).length : 0;
  const tabs = (
    <div role="tablist" aria-label="Orders and customers" style={{ display: "flex", gap: 4, padding: 4, background: nl.chip, borderRadius: 14 }}>
      {[["orders", groupsCountLabel()], ["customers", `Customers${nCust ? ` (${nCust})` : ""}`]].map(([id, label]) => (
        <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{ flex: 1, minHeight: 44, borderRadius: 11, border: "none", background: tab === id ? nl.card : "transparent", boxShadow: tab === id ? "0 1px 3px rgba(0,0,0,.08)" : "none", color: nl.ink, font: `600 15px ${font.body}`, cursor: "pointer" }}>{label}</button>
      ))}
    </div>
  );
  function groupsCountLabel() {
    const n = groups.fresh.length + groups.joins.length;
    return `Orders${n ? ` (${n} new)` : ""}`;
  }
  const toastEl = toast ? <div role="status" style={{ background: nl.deep, color: nl.onDeep, borderRadius: 14, padding: "10px 14px", fontSize: 14 }}>{toast}</div> : null;

  if (tab === "customers") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {header}
        {tabs}
        {toastEl}
        <CustomersPanel data={data} update={update} onEmail={onEmailCustomers} toast={setToast} />
      </div>
    );
  }

  if (!signedIn || !op.on) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {header}
        {tabs}
        <Card padded>
          <div style={{ fontFamily: font.display, fontSize: 22 }}>Take pre-orders from customers</div>
          <div style={{ fontSize: 15, color: nl.soft, marginTop: 6, lineHeight: 1.5 }}>
            Get a link and a QR sign for your stand. Customers pick what they'd like (eggs, bread, meat birds, anything you list) or ask to join your email list. You see every request here, accept or decline it, and mark it ready. Customers pay you directly; Henalytics never touches the money.
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {signedIn ? <Button icon={<ShoppingBag size={20} />} onClick={turnOn}>Set up my order page</Button>
              : <Button onClick={onSignIn}>Sign in (free) to take orders</Button>}
            {onTour && <Button kind="link" onClick={onTour}>See how it works</Button>}
          </div>
        </Card>
        <PageSettingsSheet open={settings} onClose={() => setSettings(false)} data={data} update={update} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {header}
      {tabs}
      {toastEl}

      <Card>
        <CardHeader title="Your order page" right={op.paused ? <Badge tone="ready">Paused</Badge> : <Badge tone="good">On</Badge>} />
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
          {groups.fresh.map((r) => <OrderCard key={r.id} req={r} onStep={(q, s) => setStep({ req: q, s })} onPickedUp={(q, addOnly) => setPickup({ req: q, addOnly: !!addOnly })} onRemove={remove} inSales={orderInSales(data, saleKey(r))} onPaid={setPaid} customer={findCustomer(data, r)} onSaveCustomer={saveOne} farm={farm} plan={plan} onStop={stopRepeat} />)}
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
      {groups.backs.length > 0 && <BackRequests rows={groups.backs} onSend={sendBack} onDismiss={clearBack} />}
      <PackingList orders={(reqs || []).filter((r) => r.kind === "order")} farm={farm} onReady={markReady} onEmailAll={emailAllReady} />
      {(groups.fresh.length > 0 || groups.open.length > 0 || groups.today.length > 0) && <SupplySummary plan={plan} menu={ownMenu} />}
      {groups.today.length > 0 && (
        <Card>
          <CardHeader title="Picking up today" right={`${groups.today.length}`} />
          {groups.today.map((r) => <OrderCard key={r.id} req={r} onStep={(q, s) => setStep({ req: q, s })} onPickedUp={(q, addOnly) => setPickup({ req: q, addOnly: !!addOnly })} onRemove={remove} inSales={orderInSales(data, saleKey(r))} onPaid={setPaid} customer={findCustomer(data, r)} onSaveCustomer={saveOne} farm={farm} plan={plan} onStop={stopRepeat} />)}
        </Card>
      )}
      {groups.open.length > 0 && (
        <Card>
          <CardHeader title="To fill" right={`${groups.open.length}`} />
          {groups.open.map((r) => <OrderCard key={r.id} req={r} onStep={(q, s) => setStep({ req: q, s })} onPickedUp={(q, addOnly) => setPickup({ req: q, addOnly: !!addOnly })} onRemove={remove} inSales={orderInSales(data, saleKey(r))} onPaid={setPaid} customer={findCustomer(data, r)} onSaveCustomer={saveOne} farm={farm} plan={plan} onStop={stopRepeat} />)}
        </Card>
      )}
      {reqs && !groups.fresh.length && !groups.open.length && !groups.today.length && !groups.joins.length && (
        <Card padded>
          <div style={{ fontFamily: font.display, fontSize: 20 }}>No requests right now</div>
          <div style={{ fontSize: 14, color: nl.soft, marginTop: 4, lineHeight: 1.45 }}>Share your link or put the QR sign up at the stand. New requests show up here{op.emailMe ? " and in your email" : ""}.</div>
        </Card>
      )}
      {groups.past.length > 0 && (
        <Card>
          <Row first title={`Past orders (${groups.past.length})`} sub="Picked up and declined, last 6 months" onClick={() => setShowPast((v) => !v)}
            trailing={<ChevronDown size={18} color={nl.soft} style={{ transform: showPast ? "rotate(180deg)" : "none" }} aria-hidden="true" />} />
          {showPast && groups.past.map((r) => <OrderCard key={r.id} req={r} onStep={() => {}} onPickedUp={(q, addOnly) => setPickup({ req: q, addOnly: !!addOnly })} onRemove={remove} inSales={orderInSales(data, saleKey(r))} onPaid={setPaid} customer={findCustomer(data, r)} onSaveCustomer={saveOne} farm={farm} plan={plan} onStop={stopRepeat} />)}
        </Card>
      )}

      <PageSettingsSheet open={settings} onClose={() => setSettings(false)} data={data} update={update} />
      <QrSheet open={qr} onClose={() => setQr(false)} url={url} farm={farm} />
      {pickup && <PickedUpSheet key={pickup.req.id} req={pickup.req} addOnly={pickup.addOnly} data={data} update={update} onClose={() => setPickup(null)} onDone={(m) => { setPickup(null); setToast(m); load(); }} />}
      {step && <UpdateSheet req={step.req} step={step.s} data={data} onClose={() => setStep(null)} onDone={(m) => { setStep(null); setToast(m); load(); }} />}
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
