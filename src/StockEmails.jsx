// ============================================================================
// CUSTOMER EMAILS — "Here's what's fresh at <homestead>"
// ----------------------------------------------------------------------------
// Each seller keeps their own customer contacts (name + email) sorted into
// lists (Eggs, Milk, Cookies…). To announce what's in stock they tap items
// from their Farm Stand inventory, set quantities, add a note and photos if
// they like, choose lists, send themselves a test, and send. Sending,
// unsubscribe links and limits live on the server (api/stock-email.js); the
// email itself comes from the shared template (stockEmail.js), so the
// preview here is exactly what customers get.
//
// Data (in the homestead's own data, synced like everything else):
//   data.customers[]         += { email, groups: [listId], emailOk }
//                               (shared with the Sales tab's customers)
//   data.customerGroups      = [{ id, name, emoji }]           (the lists)
//   data.stockEmailSettings  = { fromName, replyTo, mailingAddress }
//   data.stockEmailLog       = [{ id, date, subject, count }]  (last 20)
//   data.tutorialsSeen.stockEmails = true once the tutorial's been shown
// ============================================================================

import { legacyPalette, legacyStyle } from "./newlook/legacyTheme.js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabase.js";
import { getActiveHomesteadId, compressImage } from "./sync.js";
import { apiUrl } from "./apiBase.js";
import { buildStockEmail, defaultSubject, stockFromName, STOCK_EMAIL_LIMITS } from "./stockEmail.js";

const palette = legacyPalette({
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", line: "#2C181030", card: "#FAF5EA",
});
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;
const inputStyle = legacyStyle(() => ({
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
}));
const newId = () => Math.random().toString(36).slice(2, 10);
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const validEmail = (e) => EMAIL_RE.test(String(e || "").trim());

const SUGGESTED_LISTS = [
  { name: "Eggs", emoji: "🥚" }, { name: "Milk", emoji: "🥛" }, { name: "Baked goods", emoji: "🍪" },
  { name: "Produce", emoji: "🥕" }, { name: "Honey", emoji: "🍯" }, { name: "Meat", emoji: "🥩" },
];

const fmtPrice = (n, unit) => {
  const v = Number(n);
  if (!(v > 0)) return "";
  const s = v.toLocaleString(undefined, { style: "currency", currency: "USD" });
  return unit ? `${s}/${unit}` : s;
};

// Items to pick from: Farm Stand inventory first, then quick picks for the
// hobbies the homestead has on.
function inventoryOptions(data) {
  const out = [];
  const fs = (data.hobbies || []).find((h) => h && h.type === "farmstand");
  (fs && Array.isArray(fs.items) ? fs.items : []).filter((i) => i && !i.archived && i.name).forEach((i) => {
    const qty = i.trackStock && Number(i.stock) > 0 ? String(i.stock) : "";
    out.push({ key: `fs:${i.id}`, name: i.name, unit: i.unit || "", qty, price: fmtPrice(i.pricePerUnit, i.unit), fromStand: true });
  });
  const on = new Set((data.hobbies || []).filter((h) => h && !h.hidden).map((h) => h.type));
  const quick = [];
  if (on.has("egg_layers")) quick.push({ name: "Fresh eggs", unit: "dozen" });
  if (on.has("garden")) quick.push({ name: "Fresh produce", unit: "" });
  if (on.has("bees")) quick.push({ name: "Honey", unit: "jar" });
  if (on.has("goats") || on.has("cows")) quick.push({ name: "Fresh milk", unit: "gallon" });
  if (on.has("sourdough")) quick.push({ name: "Sourdough bread", unit: "loaf" });
  if (on.has("baking")) quick.push({ name: "Baked goods", unit: "" });
  if (on.has("canning")) quick.push({ name: "Canned goods", unit: "jar" });
  quick.forEach((q) => { if (!out.some((o) => o.name.toLowerCase() === q.name.toLowerCase())) out.push({ key: `q:${q.name}`, name: q.name, unit: q.unit, qty: "", price: "" }); });
  return out;
}

async function callApi(action, payload = {}) {
  if (!isSupabaseConfigured || !supabase) throw new Error("Sign in to email customers.");
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in (free) to email customers.");
  const homesteadId = getActiveHomesteadId();
  if (!homesteadId) throw new Error("Your homestead hasn't synced yet. Try again in a moment.");
  const r = await fetch(apiUrl("/api/stock-email"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, homesteadId, ...payload }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || "Something went wrong. Try again.");
  return body;
}

async function uploadEmailPhoto(file) {
  const { data: { user } = {} } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to add photos.");
  const blob = await compressImage(file, 1400, 0.82);
  const path = `${user.id}/${Date.now().toString(36)}-${newId()}.jpg`;
  const { error } = await supabase.storage.from("email-photos").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw new Error("Couldn't upload that photo.");
  return supabase.storage.from("email-photos").getPublicUrl(path).data.publicUrl;
}

// ---- small UI ---------------------------------------------------------------
function Chip({ active, onClick, children, tone, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      padding: "6px 11px", borderRadius: 999, fontSize: 13, fontFamily: FONT_BODY, cursor: disabled ? "default" : "pointer",
      border: `1.5px solid ${active ? (tone || palette.ink) : palette.line}`,
      background: active ? (tone || palette.ink) : "transparent",
      color: active ? palette.bg : palette.ink, fontWeight: active ? 600 : 400, opacity: disabled ? 0.5 : 1,
    }}>{children}</button>
  );
}
const btn = (variant = "primary", disabled = false) => ({
  padding: "12px 14px", borderRadius: 10, cursor: disabled ? "default" : "pointer", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14,
  border: `2px solid ${palette.ink}`, opacity: disabled ? 0.55 : 1,
  background: variant === "primary" ? palette.ink : variant === "yolk" ? palette.yolk : "transparent",
  color: variant === "primary" ? palette.bg : palette.ink, textAlign: "center",
});
const Label = ({ children }) => <div style={{ fontSize: 12, color: palette.inkSoft, margin: "12px 0 6px", fontWeight: 700 }}>{children}</div>;
const linkBtn = legacyStyle(() => ({ background: "none", border: "none", padding: 0, color: palette.leaf, fontWeight: 600, cursor: "pointer", textDecoration: "underline", fontFamily: FONT_BODY, fontSize: 13 }));

// ---- Tutorial ---------------------------------------------------------------
const TUTORIAL = [
  { icon: "📧", title: "Tell customers what's fresh", body: "Send your customers a pretty \"Here's what's fresh\" email straight from Henalytics, with your homestead's name on it. Replies come right to your own email." },
  { icon: "👥", title: "Add customers and lists", body: "Add the people who buy from you with their email. Sort them into lists like Eggs, Milk or Cookies, so each email only goes to people who want it. Someone can be on several lists." },
  { icon: "🧺", title: "Tap what's in stock", body: "Pick items from your Farm Stand inventory (prices fill in for you), set how many you have, add a note like \"Porch cooler until 6\", and add photos if you want." },
  { icon: "✅", title: "Test it, then send", body: "Send yourself a test to see exactly what customers get, then pick your lists and send. Every email has an unsubscribe link, and Henalytics handles it for you." },
];

export function StockEmailTutorial({ onClose, onStart }) {
  const [i, setI] = useState(0);
  const s = TUTORIAL[i];
  const last = i === TUTORIAL.length - 1;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(44,24,16,0.55)", zIndex: 220, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: palette.bg, border: `2px solid ${palette.ink}`, borderRadius: 18, padding: "22px 20px 18px", fontFamily: FONT_BODY, textAlign: "center", boxShadow: `5px 6px 0 ${palette.line}` }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: palette.inkSoft, marginBottom: 8 }}>New · Customer emails</div>
        <div style={{ fontSize: 46, lineHeight: 1, marginBottom: 10 }}>{s.icon}</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, color: palette.ink, marginBottom: 8 }}>{s.title}</div>
        <div style={{ fontSize: 14, color: palette.inkSoft, lineHeight: 1.55, minHeight: 88 }}>{s.body}</div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "14px 0" }}>
          {TUTORIAL.map((_, k) => <span key={k} style={{ width: 8, height: 8, borderRadius: 4, background: k === i ? palette.ink : palette.line }} />)}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {i > 0 && <button type="button" onClick={() => setI(i - 1)} style={{ ...btn("ghost"), flex: 1 }}>Back</button>}
          {!last && <button type="button" onClick={() => setI(i + 1)} style={{ ...btn("primary"), flex: 2 }}>Next</button>}
          {last && <button type="button" onClick={() => { onClose(); onStart && onStart(); }} style={{ ...btn("primary"), flex: 2 }}>Set up my customers</button>}
        </div>
        <button type="button" onClick={onClose} style={{ ...linkBtn, color: palette.inkSoft, marginTop: 12, fontWeight: 400 }}>{last ? "Maybe later" : "Skip"}</button>
      </div>
    </div>
  );
}

// ---- Contacts ---------------------------------------------------------------
function ContactForm({ initial, lists, onSave, onCancel, onDelete }) {
  const [name, setName] = useState(initial?.name || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [sel, setSel] = useState(new Set(initial?.groups || []));
  const okEmail = !email.trim() || validEmail(email);
  const valid = name.trim() && okEmail;
  return (
    <div style={{ background: palette.card, border: `1.5px solid ${palette.ink}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={{ ...inputStyle, marginBottom: 8 }} autoFocus={!initial} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" inputMode="email" autoCapitalize="off"
        style={{ ...inputStyle, borderColor: okEmail ? undefined : palette.accent }} />
      {lists.length > 0 && (
        <>
          <Label>Lists</Label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {lists.map((g) => (
              <Chip key={g.id} active={sel.has(g.id)} onClick={() => setSel((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}>{g.emoji} {g.name}</Chip>
            ))}
          </div>
        </>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
        <button type="button" disabled={!valid} onClick={() => onSave({ ...(initial || {}), id: initial?.id || newId(), name: name.trim(), email: email.trim().toLowerCase(), groups: [...sel] })}
          style={{ ...btn("primary", !valid), flex: 1 }}>{initial ? "Save" : "Add contact"}</button>
        <button type="button" onClick={onCancel} style={btn("ghost")}>Cancel</button>
        {onDelete && <button type="button" onClick={onDelete} style={{ ...linkBtn, color: palette.accent, fontWeight: 400 }}>Delete</button>}
      </div>
    </div>
  );
}

function PasteList({ lists, onAdd, onCancel }) {
  const [text, setText] = useState("");
  const [sel, setSel] = useState(new Set());
  const rows = text.split(/\n+/).map((line) => {
    const m = line.match(/[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+/);
    if (!m) return null;
    const name = line.replace(m[0], "").replace(/[<>,;:()"–-]+/g, " ").trim();
    return { name: name || m[0].split("@")[0], email: m[0].toLowerCase() };
  }).filter(Boolean);
  return (
    <div style={{ background: palette.card, border: `1.5px solid ${palette.ink}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
      <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 6 }}>One per line, like "Pat Smith pat@email.com". Pasting from a spreadsheet works too.</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} style={{ ...inputStyle, fontSize: 14 }} placeholder={"Pat Smith pat@email.com\nJo Miller jo@email.com"} />
      {lists.length > 0 && (
        <>
          <Label>Add them to</Label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {lists.map((g) => <Chip key={g.id} active={sel.has(g.id)} onClick={() => setSel((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}>{g.emoji} {g.name}</Chip>)}
          </div>
        </>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" disabled={!rows.length} onClick={() => onAdd(rows.map((r) => ({ id: newId(), name: r.name, email: r.email, groups: [...sel], note: "" })))}
          style={{ ...btn("primary", !rows.length), flex: 1 }}>Add {rows.length || ""} contact{rows.length === 1 ? "" : "s"}</button>
        <button type="button" onClick={onCancel} style={btn("ghost")}>Cancel</button>
      </div>
    </div>
  );
}

// ---- Main -------------------------------------------------------------------
export default function StockEmailsModal({ data, update, onClose, user, preset = {}, toast }) {
  const customers = Array.isArray(data.customers) ? data.customers : [];
  const lists = Array.isArray(data.customerGroups) ? data.customerGroups : [];
  const settings = data.stockEmailSettings || {};
  const [tab, setTab] = useState(customers.some((c) => validEmail(c.email)) ? "compose" : "contacts");
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null); // { kind: "ok" | "err", text }
  const say = (kind, text) => { setMsg({ kind, text }); if (toast) toast(text, kind === "err" ? { kind: "error", ms: 6000 } : undefined); };

  useEffect(() => {
    if (!user) return;
    let on = true;
    callApi("status").then((s) => { if (on) setStatus(s); }).catch(() => {});
    return () => { on = false; };
  }, [user && user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const unsub = useMemo(() => new Set((status && status.unsubscribed) || []), [status]);

  // ---- compose state
  const options = useMemo(() => inventoryOptions(data), [data]);
  const [picked, setPicked] = useState(() => {
    if (!preset.item) return [];
    const o = options.find((x) => x.name.toLowerCase() === String(preset.item).toLowerCase());
    return [{ key: o ? o.key : `custom:${newId()}`, name: preset.item, unit: preset.unit || (o && o.unit) || "", qty: preset.qty || (o && o.qty) || "", price: preset.price || (o && o.price) || "" }];
  });
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState([]);
  const [subject, setSubject] = useState("");
  const [everyone, setEveryone] = useState(false);
  const [listSel, setListSel] = useState(() => new Set(preset.listIds || []));
  const [showPreview, setShowPreview] = useState(false);
  const [showSender, setShowSender] = useState(!String(settings.mailingAddress || "").trim());
  const [confirm, setConfirm] = useState(false);
  const [customName, setCustomName] = useState("");
  const fileRef = useRef(null);

  // ---- contacts state
  const [editing, setEditing] = useState(null);
  const [newList, setNewList] = useState("");

  const fromName = stockFromName({ fromName: settings.fromName || data.homesteadName });
  const draft = { subject: subject.trim(), note, items: picked.map(({ name, qty, unit, price }) => ({ name, qty, unit, price })), photos };
  const preview = useMemo(() => buildStockEmail(draft, { fromName, mailingAddress: settings.mailingAddress }, { unsubscribeUrl: "#" }),
    [JSON.stringify(draft), fromName, settings.mailingAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  const recipients = useMemo(() => {
    const seen = new Set();
    return customers.filter((c) => {
      const em = String(c.email || "").trim().toLowerCase();
      if (!validEmail(em) || seen.has(em) || unsub.has(em) || c.emailOk === false) return false;
      if (!everyone && !(c.groups || []).some((g) => listSel.has(g))) return false;
      seen.add(em);
      return true;
    });
  }, [customers, listSel, everyone, unsub]);

  const mutate = (fn) => update((d) => { d.customers = Array.isArray(d.customers) ? d.customers : []; d.customerGroups = Array.isArray(d.customerGroups) ? d.customerGroups : []; fn(d); return d; });
  const setSettings = (patch) => update((d) => { d.stockEmailSettings = { ...(d.stockEmailSettings || {}), ...patch }; return d; });
  const togglePick = (o) => setPicked((p) => p.some((x) => x.key === o.key) ? p.filter((x) => x.key !== o.key) : [...p, { key: o.key, name: o.name, unit: o.unit, qty: o.qty, price: o.price }].slice(0, STOCK_EMAIL_LIMITS.items));
  const setPickField = (key, field, val) => setPicked((p) => p.map((x) => x.key === key ? { ...x, [field]: val } : x));

  const addPhotos = async (files) => {
    const list = [...(files || [])].slice(0, STOCK_EMAIL_LIMITS.photos - photos.length);
    if (!list.length) return;
    setBusy("photo");
    try {
      for (const f of list) { const url = await uploadEmailPhoto(f); setPhotos((p) => [...p, url].slice(0, STOCK_EMAIL_LIMITS.photos)); }
    } catch (e) { say("err", e.message || "Couldn't add that photo."); }
    setBusy("");
  };

  const canCompose = picked.length > 0 || note.trim();
  const sendTest = async () => {
    setBusy("test"); setMsg(null);
    try { const r = await callApi("test", { draft }); say("ok", `Test sent to ${r.to}. Check your inbox (and spam, just in case).`); setStatus((s) => s && { ...s, testsToday: (s.testsToday || 0) + 1 }); }
    catch (e) { say("err", e.message); }
    setBusy("");
  };
  const sendReal = async () => {
    setBusy("send"); setMsg(null);
    try {
      const r = await callApi("send", { draft, lists: everyone ? "all" : [...listSel] });
      update((d) => {
        d.stockEmailLog = Array.isArray(d.stockEmailLog) ? d.stockEmailLog : [];
        d.stockEmailLog.unshift({ id: newId(), date: todayIso(), subject: preview.subject, count: r.sent });
        d.stockEmailLog = d.stockEmailLog.slice(0, 20);
        return d;
      });
      setStatus((s) => s && { ...s, sentToday: (s.sentToday || 0) + r.sent });
      say("ok", `Sent to ${r.sent} ${r.sent === 1 ? "person" : "people"}! 🎉${r.failed ? ` (${r.failed} didn't go through.)` : ""}`);
      setConfirm(false);
    } catch (e) { say("err", e.message); setConfirm(false); }
    setBusy("");
  };

  const tabBtn = (k, label) => (
    <button type="button" onClick={() => { setTab(k); setMsg(null); }} style={{
      flex: 1, padding: "9px 4px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600,
      background: tab === k ? palette.card : "transparent", boxShadow: tab === k ? "1px 1px 0 " + palette.line : "none", color: palette.ink,
    }}>{label}</button>
  );
  const withEmail = customers.filter((c) => validEmail(c.email)).length;
  const left = status ? Math.max(0, status.dailyLimit - status.sentToday) : null;
  const needAddress = !String(settings.mailingAddress || "").trim();
  const log = (Array.isArray(data.stockEmailLog) ? data.stockEmailLog : []).slice(0, 3);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(44,24,16,0.55)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "max(16px, env(safe-area-inset-top)) 12px 24px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: palette.bg, borderRadius: 16, border: `2px solid ${palette.ink}`, width: "100%", maxWidth: 540, padding: 16, fontFamily: FONT_BODY, color: palette.ink }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, flex: 1 }}>📧 Email your customers</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: palette.ink, padding: 4, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: "flex", gap: 4, padding: 4, background: palette.bgAlt, borderRadius: 10, marginBottom: 12 }}>
          {tabBtn("compose", "✉️ Send")}
          {tabBtn("contacts", `👥 Contacts (${withEmail})`)}
          {tabBtn("lists", `🏷️ Lists (${lists.length})`)}
        </div>
        {!user && (
          <div style={{ fontSize: 13, background: palette.yolkSoft, borderRadius: 10, padding: 10, marginBottom: 10 }}>
            You can set up contacts now. Sending needs a free account so emails can come from your homestead and handle unsubscribes.
          </div>
        )}

        {/* ================= COMPOSE ================= */}
        {tab === "compose" && (
          <div>
            <Label>What's in stock? Tap to add</Label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {options.map((o) => <Chip key={o.key} active={picked.some((p) => p.key === o.key)} onClick={() => togglePick(o)}>{o.fromStand ? "🧺 " : ""}{o.name}</Chip>)}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Something else (e.g. Duck eggs)" style={{ ...inputStyle, padding: "8px 10px", fontSize: 14 }}
                onKeyDown={(e) => { if (e.key === "Enter" && customName.trim()) { togglePick({ key: `custom:${newId()}`, name: customName.trim(), unit: "", qty: "", price: "" }); setCustomName(""); } }} />
              <button type="button" disabled={!customName.trim()} onClick={() => { togglePick({ key: `custom:${newId()}`, name: customName.trim(), unit: "", qty: "", price: "" }); setCustomName(""); }} style={{ ...btn("ghost", !customName.trim()), padding: "8px 12px" }}>Add</button>
            </div>

            {picked.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                {picked.map((p) => (
                  <div key={p.key} style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 10, padding: "8px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{p.name}</span>
                      <button type="button" onClick={() => setPicked((x) => x.filter((y) => y.key !== p.key))} aria-label={`Remove ${p.name}`} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: palette.inkSoft }}>×</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <input value={p.qty} onChange={(e) => setPickField(p.key, "qty", e.target.value)} placeholder={p.unit ? `How many (${p.unit}s)` : "How many"} style={{ ...inputStyle, padding: "8px 10px", fontSize: 14 }} />
                      <input value={p.price} onChange={(e) => setPickField(p.key, "price", e.target.value)} placeholder="Price (optional)" style={{ ...inputStyle, padding: "8px 10px", fontSize: 14 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Label>Note (optional)</Label>
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, STOCK_EMAIL_LIMITS.note))} rows={3} placeholder="Porch cooler is stocked until 6 tonight. Cash or Venmo!" style={{ ...inputStyle, fontSize: 14 }} />

            <Label>Photos (optional, up to {STOCK_EMAIL_LIMITS.photos})</Label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {photos.map((u) => (
                <div key={u} style={{ position: "relative" }}>
                  <img src={u} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10, border: `1.5px solid ${palette.line}` }} />
                  <button type="button" onClick={() => setPhotos((p) => p.filter((x) => x !== u))} aria-label="Remove photo" style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, border: "none", background: palette.ink, color: palette.bg, cursor: "pointer", fontSize: 13, lineHeight: "22px", padding: 0 }}>×</button>
                </div>
              ))}
              {photos.length < STOCK_EMAIL_LIMITS.photos && (
                <button type="button" disabled={!user || busy === "photo"} onClick={() => fileRef.current && fileRef.current.click()} style={{ width: 72, height: 72, borderRadius: 10, border: `1.5px dashed ${palette.inkSoft}`, background: "transparent", cursor: user ? "pointer" : "default", fontSize: 12, color: palette.inkSoft, fontFamily: FONT_BODY }}>
                  {busy === "photo" ? "Adding…" : "📷 Add"}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
            </div>

            <Label>Send to</Label>
            {lists.length === 0 && <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 6 }}>No lists yet. <button type="button" onClick={() => setTab("lists")} style={linkBtn}>Make lists</button> like Eggs or Milk, or send to all contacts.</div>}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Chip active={everyone} onClick={() => setEveryone((v) => !v)}>👥 All contacts</Chip>
              {!everyone && lists.map((g) => {
                const n = customers.filter((c) => validEmail(c.email) && !unsub.has(String(c.email).toLowerCase()) && (c.groups || []).includes(g.id)).length;
                return <Chip key={g.id} active={listSel.has(g.id)} onClick={() => setListSel((s) => { const x = new Set(s); if (x.has(g.id)) x.delete(g.id); else x.add(g.id); return x; })}>{g.emoji} {g.name} ({n})</Chip>;
              })}
            </div>

            <Label>Subject</Label>
            <input value={subject} onChange={(e) => setSubject(e.target.value.slice(0, STOCK_EMAIL_LIMITS.subject))} placeholder={defaultSubject(fromName, draft.items)} style={{ ...inputStyle, fontSize: 14 }} />

            <div style={{ marginTop: 12, padding: "10px 12px", background: palette.card, border: `1.5px solid ${needAddress ? palette.accent : palette.line}`, borderRadius: 10 }}>
              <button type="button" onClick={() => setShowSender((v) => !v)} style={{ ...linkBtn, color: palette.ink, textDecoration: "none", width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between" }}>
                <span>Sender details{needAddress ? " (mailing address needed)" : ""}</span><span>{showSender ? "▲" : "▼"}</span>
              </button>
              {showSender && (
                <div>
                  <Label>From name</Label>
                  <input defaultValue={settings.fromName || data.homesteadName || ""} onBlur={(e) => setSettings({ fromName: e.target.value.trim().slice(0, 60) })} placeholder="Slow Build Acres" style={{ ...inputStyle, fontSize: 14 }} />
                  <Label>Replies go to</Label>
                  <input type="email" defaultValue={settings.replyTo || (status && status.accountEmail) || (user && user.email) || ""} onBlur={(e) => { const v = e.target.value.trim(); if (!v || validEmail(v)) setSettings({ replyTo: v }); }} placeholder="you@email.com" style={{ ...inputStyle, fontSize: 14 }} />
                  <Label>Mailing address</Label>
                  <input defaultValue={settings.mailingAddress || ""} onBlur={(e) => setSettings({ mailingAddress: e.target.value.trim().slice(0, 200) })} placeholder="PO Box 12, Lawrence, KS 66044" style={{ ...inputStyle, fontSize: 14 }} />
                  <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4, lineHeight: 1.4 }}>US law (CAN-SPAM) requires a mailing address at the bottom of promotional emails. A PO box is fine.</div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" onClick={() => setShowPreview((v) => !v)} disabled={!canCompose} style={{ ...btn("ghost", !canCompose), flex: 1 }}>{showPreview ? "Hide preview" : "👀 Preview"}</button>
              <button type="button" onClick={sendTest} disabled={!user || !canCompose || !!busy} style={{ ...btn("yolk", !user || !canCompose || !!busy), flex: 1 }}>{busy === "test" ? "Sending…" : "📨 Send me a test"}</button>
            </div>
            {showPreview && canCompose && (
              <div style={{ marginTop: 10, border: `1.5px solid ${palette.line}`, borderRadius: 12, overflow: "hidden", background: palette.bg }}>
                <div style={{ fontSize: 12, padding: "8px 10px", background: palette.card, borderBottom: `1px solid ${palette.line}` }}><strong>Subject:</strong> {preview.subject}</div>
                <iframe title="Email preview" srcDoc={preview.html} sandbox="" style={{ width: "100%", height: 520, border: 0, display: "block" }} />
              </div>
            )}

            {msg && <div style={{ marginTop: 10, fontSize: 13, padding: "9px 12px", borderRadius: 10, background: msg.kind === "ok" ? palette.goodBg : palette.dangerBg, color: msg.kind === "ok" ? palette.leaf : palette.accent, fontWeight: 600 }}>{msg.text}</div>}

            <div style={{ marginTop: 12 }}>
              {!confirm ? (
                <button type="button" disabled={!user || !canCompose || !recipients.length || !!busy || needAddress}
                  onClick={() => setConfirm(true)} style={{ ...btn("primary", !user || !canCompose || !recipients.length || !!busy || needAddress), width: "100%" }}>
                  {recipients.length ? `📧 Send to ${recipients.length} ${recipients.length === 1 ? "person" : "people"}` : "📧 Pick a list to send"}
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={sendReal} disabled={!!busy} style={{ ...btn("primary", !!busy), flex: 2 }}>{busy === "send" ? "Sending…" : `Yes, send to ${recipients.length}`}</button>
                  <button type="button" onClick={() => setConfirm(false)} style={{ ...btn("ghost"), flex: 1 }}>Cancel</button>
                </div>
              )}
              <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 6, lineHeight: 1.45, textAlign: "center" }}>
                {needAddress ? "Add your mailing address in Sender details to send. " : ""}
                {left != null ? `${left} of ${status.dailyLimit} emails left today. ` : ""}
                Each person gets their own email with an unsubscribe link. Replies go to {settings.replyTo || (status && status.accountEmail) || "your email"}.
              </div>
            </div>
            {log.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${palette.line}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: palette.inkSoft, marginBottom: 4 }}>Recently sent</div>
                {log.map((h) => <div key={h.id} style={{ fontSize: 12, color: palette.inkSoft, padding: "2px 0" }}>{h.date} · {h.subject} ({h.count})</div>)}
              </div>
            )}
          </div>
        )}

        {/* ================= CONTACTS ================= */}
        {tab === "contacts" && (
          <div>
            {editing === "new" && <ContactForm lists={lists} onSave={(c) => { mutate((d) => { d.customers.push({ note: "", ...c }); }); setEditing(null); }} onCancel={() => setEditing(null)} />}
            {editing === "paste" && <PasteList lists={lists} onCancel={() => setEditing(null)} onAdd={(rows) => { mutate((d) => {
              const have = new Set(d.customers.map((c) => String(c.email || "").toLowerCase()).filter(Boolean));
              rows.forEach((r) => { if (!have.has(r.email)) { d.customers.push(r); have.add(r.email); } });
            }); setEditing(null); }} />}
            {editing == null && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button type="button" onClick={() => setEditing("new")} style={{ ...btn("primary"), flex: 1 }}>+ Add contact</button>
                <button type="button" onClick={() => setEditing("paste")} style={btn("ghost")}>Paste a list</button>
              </div>
            )}
            {customers.length === 0 && editing == null && (
              <div style={{ fontSize: 13, color: palette.inkSoft, lineHeight: 1.5, padding: 12, background: palette.bgAlt, borderRadius: 10 }}>
                Add the people who buy from you, with their email. Only add people who asked to hear from you.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...customers].sort((a, b) => String(a.name).localeCompare(String(b.name))).map((c) => editing === c.id ? (
                <ContactForm key={c.id} initial={c} lists={lists} onCancel={() => setEditing(null)}
                  onSave={(nc) => { mutate((d) => { const i = d.customers.findIndex((x) => x.id === nc.id); if (i >= 0) d.customers[i] = { ...d.customers[i], ...nc }; }); setEditing(null); }}
                  onDelete={() => { mutate((d) => { d.customers = d.customers.filter((x) => x.id !== c.id); }); setEditing(null); }} />
              ) : (
                <button key={c.id} type="button" onClick={() => setEditing(c.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, background: palette.card, border: `1.5px solid ${palette.line}`, cursor: "pointer", textAlign: "left", fontFamily: FONT_BODY }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: palette.ink }}>{c.name}</span>
                    <span style={{ display: "block", fontSize: 12, color: unsub.has(String(c.email || "").toLowerCase()) ? palette.accent : palette.inkSoft, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.email ? c.email : "No email yet"}{unsub.has(String(c.email || "").toLowerCase()) ? " · unsubscribed" : ""}
                    </span>
                  </span>
                  <span style={{ fontSize: 14 }}>{(c.groups || []).map((g) => (lists.find((x) => x.id === g) || {}).emoji).filter(Boolean).join(" ")}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ================= LISTS ================= */}
        {tab === "lists" && (
          <div>
            <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 10, lineHeight: 1.5 }}>Lists are for who wants what. Someone can be on several (eggs and milk).</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {lists.map((g) => {
                const n = customers.filter((c) => (c.groups || []).includes(g.id)).length;
                return (
                  <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, background: palette.card, border: `1.5px solid ${palette.line}` }}>
                    <span style={{ fontSize: 18 }}>{g.emoji}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{g.name}</span>
                    <span style={{ fontSize: 12, color: palette.inkSoft }}>{n} {n === 1 ? "person" : "people"}</span>
                    <button type="button" onClick={() => mutate((d) => { d.customerGroups = d.customerGroups.filter((x) => x.id !== g.id); d.customers.forEach((c) => { if (Array.isArray(c.groups)) c.groups = c.groups.filter((x) => x !== g.id); }); })} aria-label={`Delete ${g.name}`} style={{ background: "none", border: "none", cursor: "pointer", color: palette.accent, fontSize: 18 }}>×</button>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={newList} onChange={(e) => setNewList(e.target.value)} placeholder="New list (e.g. Duck eggs)" style={inputStyle}
                onKeyDown={(e) => { if (e.key === "Enter" && newList.trim()) { const nm = newList.trim(); mutate((d) => { if (!d.customerGroups.some((g) => g.name.toLowerCase() === nm.toLowerCase())) d.customerGroups.push({ id: newId(), name: nm.slice(0, 30), emoji: "🏷️" }); }); setNewList(""); } }} />
              <button type="button" onClick={() => { const nm = newList.trim(); if (!nm) return; mutate((d) => { if (!d.customerGroups.some((g) => g.name.toLowerCase() === nm.toLowerCase())) d.customerGroups.push({ id: newId(), name: nm.slice(0, 30), emoji: "🏷️" }); }); setNewList(""); }} style={btn("primary")}>Add</button>
            </div>
            {SUGGESTED_LISTS.some((s) => !lists.some((g) => g.name.toLowerCase() === s.name.toLowerCase())) && (
              <>
                <Label>Quick add</Label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {SUGGESTED_LISTS.filter((s) => !lists.some((g) => g.name.toLowerCase() === s.name.toLowerCase())).map((s) => (
                    <Chip key={s.name} onClick={() => mutate((d) => { d.customerGroups.push({ id: newId(), name: s.name, emoji: s.emoji }); })}>+ {s.emoji} {s.name}</Chip>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
