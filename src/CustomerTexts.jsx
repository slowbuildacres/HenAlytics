// ============================================================================
// CUSTOMER TEXTS — "Eggs are back!" to the people who want to know
// ----------------------------------------------------------------------------
// Sellers keep customers with phone numbers, sort them into groups (Eggs,
// Milk, Cookies…), then announce what's in stock: pick the item, quantity,
// price and pickup details, choose groups, and the phone's own Messages app
// opens with the text filled in. Henalytics never sends texts itself (no
// texting service, no cost, messages come from the seller's own number, like
// any text they'd send).
//
// Two ways to send:
//   • One by one (default, private): each customer gets their own text with
//     their first name, and nobody sees anyone else's number.
//   • Group text: one message to everyone at once. Faster, but everyone sees
//     each other's numbers and replies go to the whole group.
//
// Data (homestead data, synced like everything else):
//   data.customers[]     += { phone, groups: [groupId], textOk }  (shared with
//                           the Sales tab's customer list)
//   data.customerGroups  = [{ id, name, emoji }]
//   data.customerTexts   = [{ id, date, item, groupIds, count, mode }] (last 50)
// ============================================================================

import React, { useMemo, useState } from "react";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", line: "#2C181030", card: "#FAF5EA",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;
const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
};
const newId = () => Math.random().toString(36).slice(2, 10);
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// ---- Phone + SMS links ------------------------------------------------------
export function normalizePhone(raw) {
  const s = String(raw || "").trim();
  const digits = s.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return "";
  return (s.startsWith("+") ? "+" : "") + digits;
}

function platform() {
  try {
    const p = window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform();
    if (p === "ios" || p === "android") return p;
  } catch (_) {}
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "web";
}

// iOS wants "&body=", Android "?body="; iOS group texts use the
// sms:/open?addresses= form.
export function smsHref(phones, body, plat = platform()) {
  const list = (Array.isArray(phones) ? phones : [phones]).filter(Boolean);
  const b = encodeURIComponent(body || "");
  if (list.length > 1) {
    return plat === "ios" ? `sms:/open?addresses=${list.join(",")}&body=${b}` : `sms:${list.join(",")}?body=${b}`;
  }
  return plat === "ios" ? `sms:${list[0]}&body=${b}` : `sms:${list[0]}?body=${b}`;
}

const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";

export function fillMessage(template, name) {
  const fn = firstName(name);
  return String(template || "")
    .replace(/Hi \{name\}!/g, fn ? `Hi ${fn}!` : "Hi!")
    .replace(/\{name\}/g, fn)
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function buildTemplate({ item, qty, price, when, homestead, emoji }) {
  const it = String(item || "").trim() || "Fresh goods";
  const plural = /s$/i.test(it) && !/ss$/i.test(it);
  let msg = `Hi {name}! ${emoji ? `${emoji} ` : ""}${it} ${plural ? "are" : "is"} available`;
  const q = String(qty || "").trim(), p = String(price || "").trim();
  if (q && p) msg += `: ${q} at ${p}`;
  else if (q) msg += `: ${q}`;
  else if (p) msg += ` at ${p}`;
  msg += ".";
  if (String(when || "").trim()) msg += ` ${String(when).trim().replace(/\.?$/, ".")}`;
  msg += " Reply to save some for you!";
  if (homestead) msg += ` – ${homestead}`;
  return msg;
}

const SUGGESTED_GROUPS = [
  { name: "Eggs", emoji: "🥚" }, { name: "Milk", emoji: "🥛" }, { name: "Baked goods", emoji: "🍪" },
  { name: "Produce", emoji: "🥕" }, { name: "Honey", emoji: "🍯" }, { name: "Meat", emoji: "🥩" },
];

// Quick item chips from what the homestead actually has turned on.
function itemSuggestions(data) {
  const on = new Set((data.hobbies || []).filter((h) => h && !h.hidden).map((h) => h.type));
  const out = [];
  const add = (label, emoji) => { if (!out.some((x) => x.label === label)) out.push({ label, emoji }); };
  if (on.has("egg_layers")) add("Fresh eggs", "🥚");
  if (on.has("garden")) add("Fresh produce", "🥕");
  if (on.has("bees")) add("Honey", "🍯");
  if (on.has("goats") || on.has("cows")) add("Fresh milk", "🥛");
  if (on.has("sourdough")) add("Sourdough bread", "🍞");
  if (on.has("baking")) add("Baked goods", "🍪");
  if (on.has("canning")) add("Canned goods", "🫙");
  if (on.has("meat_chickens")) add("Pasture-raised chicken", "🍗");
  const fs = (data.hobbies || []).find((h) => h && h.type === "farmstand" && !h.hidden);
  (fs && Array.isArray(fs.items) ? fs.items : []).filter((i) => i && !i.archived).slice(0, 6).forEach((i) => add(i.name, null));
  return out.slice(0, 10);
}

// ---- Small UI bits ----------------------------------------------------------
function Chip({ active, onClick, children, tone }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "6px 11px", borderRadius: 999, fontSize: 13, fontFamily: FONT_BODY, cursor: "pointer",
      border: `1.5px solid ${active ? (tone || palette.ink) : palette.line}`,
      background: active ? (tone || palette.ink) : "transparent",
      color: active ? palette.bg : palette.ink, fontWeight: active ? 600 : 400,
    }}>{children}</button>
  );
}
const btn = (variant = "primary") => ({
  padding: "11px 14px", borderRadius: 10, cursor: "pointer", fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14,
  border: `2px solid ${palette.ink}`,
  background: variant === "primary" ? palette.ink : variant === "yolk" ? palette.yolk : "transparent",
  color: variant === "primary" ? palette.bg : palette.ink, textDecoration: "none", textAlign: "center", display: "block",
});
const Label = ({ children }) => <div style={{ fontSize: 12, color: palette.inkSoft, margin: "10px 0 6px", fontWeight: 600 }}>{children}</div>;

// ---- Customers tab ----------------------------------------------------------
function CustomerForm({ initial, groups, onSave, onCancel, onDelete }) {
  const [name, setName] = useState(initial?.name || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [sel, setSel] = useState(new Set(initial?.groups || []));
  const [textOk, setTextOk] = useState(initial?.textOk !== false);
  const okPhone = !phone.trim() || normalizePhone(phone);
  const valid = name.trim() && okPhone;
  return (
    <div style={{ background: palette.card, border: `1.5px solid ${palette.ink}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={inputStyle} autoFocus={!initial} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" type="tel" inputMode="tel" style={{ ...inputStyle, borderColor: okPhone ? undefined : palette.accent }} />
      </div>
      {groups.length > 0 && (
        <>
          <Label>Groups</Label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {groups.map((g) => (
              <Chip key={g.id} active={sel.has(g.id)} onClick={() => setSel((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}>
                {g.emoji} {g.name}
              </Chip>
            ))}
          </div>
        </>
      )}
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: palette.ink, marginTop: 10 }}>
        <input type="checkbox" checked={textOk} onChange={(e) => setTextOk(e.target.checked)} />
        Okay to text (uncheck if they asked you to stop)
      </label>
      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
        <button type="button" disabled={!valid} onClick={() => onSave({ ...(initial || {}), id: initial?.id || newId(), name: name.trim(), phone: normalizePhone(phone) || "", groups: [...sel], textOk })}
          style={{ ...btn("primary"), flex: 1, opacity: valid ? 1 : 0.5 }}>{initial ? "Save" : "Add customer"}</button>
        <button type="button" onClick={onCancel} style={btn("ghost")}>Cancel</button>
        {onDelete && <button type="button" onClick={onDelete} style={{ background: "none", border: "none", color: palette.accent, cursor: "pointer", textDecoration: "underline", fontFamily: FONT_BODY, fontSize: 13 }}>Delete</button>}
      </div>
    </div>
  );
}

function PasteList({ groups, onAdd, onCancel }) {
  const [text, setText] = useState("");
  const [sel, setSel] = useState(new Set());
  const rows = text.split(/\n+/).map((line) => {
    const phoneMatch = line.match(/\+?[\d][\d\s().-]{6,}\d/);
    const phone = phoneMatch ? normalizePhone(phoneMatch[0]) : "";
    const name = line.replace(phoneMatch ? phoneMatch[0] : "", "").replace(/[,;:–-]+/g, " ").trim();
    return phone ? { name: name || phone, phone } : null;
  }).filter(Boolean);
  return (
    <div style={{ background: palette.card, border: `1.5px solid ${palette.ink}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
      <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 6 }}>One per line: name and number, like "Pat Smith 555-123-4567".</div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} style={{ ...inputStyle, fontSize: 14 }} placeholder={"Pat Smith 555-123-4567\nJo 555-987-6543"} />
      {groups.length > 0 && (
        <>
          <Label>Add them to</Label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {groups.map((g) => <Chip key={g.id} active={sel.has(g.id)} onClick={() => setSel((s) => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; })}>{g.emoji} {g.name}</Chip>)}
          </div>
        </>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" disabled={!rows.length} onClick={() => onAdd(rows.map((r) => ({ id: newId(), name: r.name, phone: r.phone, groups: [...sel], textOk: true, note: "" })))}
          style={{ ...btn("primary"), flex: 1, opacity: rows.length ? 1 : 0.5 }}>Add {rows.length || ""} customer{rows.length === 1 ? "" : "s"}</button>
        <button type="button" onClick={onCancel} style={btn("ghost")}>Cancel</button>
      </div>
    </div>
  );
}

// ---- Main -------------------------------------------------------------------
export default function CustomerTextsModal({ data, update, onClose, preset = {} }) {
  const customers = Array.isArray(data.customers) ? data.customers : [];
  const groups = Array.isArray(data.customerGroups) ? data.customerGroups : [];
  const [tab, setTab] = useState(customers.some((c) => c.phone) ? "send" : "customers");

  // Send form
  const sugg = useMemo(() => itemSuggestions(data), [data]);
  const [item, setItem] = useState(preset.item || "");
  const [emoji, setEmoji] = useState(preset.emoji || (preset.item ? null : (sugg[0] && sugg[0].emoji) || null));
  const [qty, setQty] = useState(preset.qty || "");
  const [price, setPrice] = useState(preset.price || "");
  const [when, setWhen] = useState("");
  const [groupSel, setGroupSel] = useState(() => new Set(preset.groupIds || []));
  const [everyone, setEveryone] = useState(false);
  const [edited, setEdited] = useState(null); // null = follow the form
  const [mode, setMode] = useState("private");
  const [sent, setSent] = useState({});
  const [logged, setLogged] = useState(false);

  // Customers tab
  const [editing, setEditing] = useState(null); // id | "new" | "paste"
  const [newGroup, setNewGroup] = useState("");

  const homestead = String(data.homesteadName || "").trim();
  const template = edited != null ? edited : buildTemplate({ item, qty, price, when, homestead, emoji });

  const recipients = useMemo(() => {
    const seen = new Set();
    return customers.filter((c) => {
      if (!c || c.textOk === false) return false;
      const p = normalizePhone(c.phone);
      if (!p || seen.has(p)) return false;
      const inGroup = everyone || (c.groups || []).some((g) => groupSel.has(g));
      if (!inGroup) return false;
      seen.add(p);
      return true;
    }).map((c) => ({ ...c, phone: normalizePhone(c.phone) }));
  }, [customers, groupSel, everyone]);

  const mutate = (fn) => update((d) => { d.customers = Array.isArray(d.customers) ? d.customers : []; d.customerGroups = Array.isArray(d.customerGroups) ? d.customerGroups : []; fn(d); return d; });
  const saveCustomer = (c) => { mutate((d) => { const i = d.customers.findIndex((x) => x.id === c.id); if (i >= 0) d.customers[i] = { ...d.customers[i], ...c }; else d.customers.push({ note: "", ...c }); }); setEditing(null); };
  const deleteCustomer = (id) => { mutate((d) => { d.customers = d.customers.filter((x) => x.id !== id); }); setEditing(null); };
  const addGroup = (name, em) => {
    const nm = String(name || "").trim(); if (!nm) return;
    mutate((d) => { if (!d.customerGroups.some((g) => g.name.toLowerCase() === nm.toLowerCase())) d.customerGroups.push({ id: newId(), name: nm.slice(0, 30), emoji: em || "🏷️" }); });
  };
  const deleteGroup = (id) => mutate((d) => {
    d.customerGroups = d.customerGroups.filter((g) => g.id !== id);
    d.customers.forEach((c) => { if (Array.isArray(c.groups)) c.groups = c.groups.filter((g) => g !== id); });
  });
  const logSend = (count, how) => {
    if (logged) return;
    setLogged(true);
    update((d) => {
      d.customerTexts = Array.isArray(d.customerTexts) ? d.customerTexts : [];
      d.customerTexts.unshift({ id: newId(), date: todayIso(), item: item || "Announcement", groupIds: everyone ? ["*"] : [...groupSel], count, mode: how });
      d.customerTexts = d.customerTexts.slice(0, 50);
      return d;
    });
  };

  const nextUp = recipients.find((r) => !sent[r.id]);
  const sentCount = recipients.filter((r) => sent[r.id]).length;
  const history = (Array.isArray(data.customerTexts) ? data.customerTexts : []).slice(0, 4);
  const groupName = (id) => id === "*" ? "Everyone" : ((groups.find((g) => g.id === id) || {}).name || "a group");

  const tabBtn = (k, label) => (
    <button type="button" onClick={() => setTab(k)} style={{
      flex: 1, padding: "9px 4px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600,
      background: tab === k ? palette.card : "transparent", boxShadow: tab === k ? "1px 1px 0 " + palette.line : "none", color: palette.ink,
    }}>{label}</button>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(44,24,16,0.55)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "max(16px, env(safe-area-inset-top)) 12px 24px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: palette.bg, borderRadius: 16, border: `2px solid ${palette.ink}`, width: "100%", maxWidth: 520, padding: 16, fontFamily: FONT_BODY, color: palette.ink }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, flex: 1 }}>📣 Text your customers</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: palette.ink, padding: 4 }}>×</button>
        </div>
        <div style={{ display: "flex", gap: 4, padding: 4, background: palette.bgAlt, borderRadius: 10, marginBottom: 12 }}>
          {tabBtn("send", "📣 Send")}
          {tabBtn("customers", `👥 Customers (${customers.length})`)}
          {tabBtn("groups", `🏷️ Groups (${groups.length})`)}
        </div>

        {/* ---------------- SEND ---------------- */}
        {tab === "send" && (
          <div>
            <Label>What's available?</Label>
            <input value={item} onChange={(e) => { setItem(e.target.value); setEdited(null); }} placeholder="Fresh eggs" style={inputStyle} />
            {sugg.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {sugg.map((s) => <Chip key={s.label} active={item === s.label} onClick={() => { setItem(s.label); setEmoji(s.emoji); setEdited(null); }}>{s.emoji ? `${s.emoji} ` : ""}{s.label}</Chip>)}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div><Label>How many (optional)</Label><input value={qty} onChange={(e) => { setQty(e.target.value); setEdited(null); }} placeholder="6 dozen" style={inputStyle} /></div>
              <div><Label>Price (optional)</Label><input value={price} onChange={(e) => { setPrice(e.target.value); setEdited(null); }} placeholder="$5/dozen" style={inputStyle} /></div>
            </div>
            <Label>Pickup / when (optional)</Label>
            <input value={when} onChange={(e) => { setWhen(e.target.value); setEdited(null); }} placeholder="Porch cooler, today until 6" style={inputStyle} />

            <Label>Send to</Label>
            {groups.length === 0 ? (
              <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 6 }}>
                No groups yet. <button type="button" onClick={() => setTab("groups")} style={{ background: "none", border: "none", padding: 0, color: palette.leaf, fontWeight: 600, cursor: "pointer", textDecoration: "underline", fontFamily: FONT_BODY, fontSize: 13 }}>Make groups</button> like Eggs or Milk, or send to everyone.
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Chip active={everyone} onClick={() => { setEveryone((v) => !v); setSent({}); }}>👥 Everyone</Chip>
              {!everyone && groups.map((g) => {
                const n = customers.filter((c) => c.textOk !== false && normalizePhone(c.phone) && (c.groups || []).includes(g.id)).length;
                return <Chip key={g.id} active={groupSel.has(g.id)} onClick={() => { setGroupSel((s) => { const x = new Set(s); if (x.has(g.id)) x.delete(g.id); else x.add(g.id); return x; }); setSent({}); }}>{g.emoji} {g.name} ({n})</Chip>;
              })}
            </div>

            <Label>Message {edited == null ? "" : "(edited)"}</Label>
            <textarea value={template} onChange={(e) => setEdited(e.target.value)} rows={4} style={{ ...inputStyle, fontSize: 14, lineHeight: 1.4 }} />
            <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4 }}>
              {"{name}"} becomes each person's first name when you send one by one.
              {edited != null && <> <button type="button" onClick={() => setEdited(null)} style={{ background: "none", border: "none", padding: 0, color: palette.leaf, cursor: "pointer", textDecoration: "underline", fontSize: 11, fontFamily: FONT_BODY }}>Reset</button></>}
            </div>

            {recipients.length === 0 ? (
              <div style={{ fontSize: 13, color: palette.inkSoft, background: palette.bgAlt, borderRadius: 10, padding: 12, marginTop: 12 }}>
                {customers.some((c) => normalizePhone(c.phone))
                  ? "Pick a group (or Everyone) to see who gets this."
                  : <>No customers with phone numbers yet. <button type="button" onClick={() => setTab("customers")} style={{ background: "none", border: "none", padding: 0, color: palette.leaf, fontWeight: 600, cursor: "pointer", textDecoration: "underline", fontFamily: FONT_BODY, fontSize: 13 }}>Add customers</button></>}
              </div>
            ) : (
              <>
                <Label>How to send</Label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <Chip active={mode === "private"} onClick={() => setMode("private")}>🔒 One by one (private)</Chip>
                  <Chip active={mode === "group"} onClick={() => setMode("group")}>👥 Group text</Chip>
                </div>
                <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 10, lineHeight: 1.45 }}>
                  {mode === "private"
                    ? "Each person gets their own text with their name. Nobody sees anyone else's number."
                    : "One message to everyone at once. Everyone sees each other's numbers, and replies go to the whole group."}
                </div>

                {mode === "group" ? (
                  <a href={smsHref(recipients.map((r) => r.phone), fillMessage(template, ""))} onClick={() => logSend(recipients.length, "group")} style={btn("primary")}>
                    Open Messages: text {recipients.length} {recipients.length === 1 ? "person" : "people"}
                  </a>
                ) : (
                  <>
                    {nextUp ? (
                      <a href={smsHref(nextUp.phone, fillMessage(template, nextUp.name))}
                        onClick={() => { setSent((s) => ({ ...s, [nextUp.id]: true })); logSend(recipients.length, "private"); }}
                        style={btn("primary")}>
                        Text {firstName(nextUp.name) || nextUp.phone} ({sentCount + 1} of {recipients.length})
                      </a>
                    ) : (
                      <div style={{ ...btn("yolk"), cursor: "default" }}>✓ All {recipients.length} texted</div>
                    )}
                    <div style={{ fontSize: 11, color: palette.inkSoft, margin: "6px 0 8px" }}>Messages opens with the text ready. Send it, come back, tap the next name.</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {recipients.map((r) => (
                        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: palette.card, border: `1px solid ${palette.line}` }}>
                          <span style={{ flex: 1, fontSize: 14, color: sent[r.id] ? palette.inkSoft : palette.ink, textDecoration: sent[r.id] ? "line-through" : "none" }}>{r.name}</span>
                          <span style={{ fontSize: 12, color: palette.inkSoft }}>{r.phone}</span>
                          <a href={smsHref(r.phone, fillMessage(template, r.name))} onClick={() => { setSent((s) => ({ ...s, [r.id]: true })); logSend(recipients.length, "private"); }}
                            style={{ fontSize: 12, fontWeight: 700, color: sent[r.id] ? palette.leaf : palette.ink, textDecoration: "none", padding: "3px 8px", border: `1.5px solid ${sent[r.id] ? palette.leaf : palette.ink}`, borderRadius: 6 }}>
                            {sent[r.id] ? "✓ Sent" : "Text"}
                          </a>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 12, lineHeight: 1.5 }}>
              Texts go from your own phone number, like any text you send. Only text people who asked to hear from you, and uncheck "Okay to text" for anyone who asks you to stop.
            </div>
            {history.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${palette.line}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: palette.inkSoft, marginBottom: 4 }}>Recent</div>
                {history.map((h) => (
                  <div key={h.id} style={{ fontSize: 12, color: palette.inkSoft, padding: "2px 0" }}>
                    {h.date} · {h.item} → {(h.groupIds || []).map(groupName).join(", ") || "selected"} ({h.count})
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------------- CUSTOMERS ---------------- */}
        {tab === "customers" && (
          <div>
            {editing === "new" && <CustomerForm groups={groups} onSave={saveCustomer} onCancel={() => setEditing(null)} />}
            {editing === "paste" && <PasteList groups={groups} onCancel={() => setEditing(null)} onAdd={(rows) => { mutate((d) => { d.customers.push(...rows); }); setEditing(null); }} />}
            {editing == null && (
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button type="button" onClick={() => setEditing("new")} style={{ ...btn("primary"), flex: 1 }}>+ Add customer</button>
                <button type="button" onClick={() => setEditing("paste")} style={btn("ghost")}>Paste a list</button>
              </div>
            )}
            {customers.length === 0 && editing == null && (
              <div style={{ fontSize: 13, color: palette.inkSoft, lineHeight: 1.5, padding: 12, background: palette.bgAlt, borderRadius: 10 }}>
                Add the people who buy from you, with their phone numbers. Then sort them into groups (eggs, milk, cookies…) so each announcement only goes to people who want it.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...customers].sort((a, b) => String(a.name).localeCompare(String(b.name))).map((c) => editing === c.id ? (
                <CustomerForm key={c.id} initial={c} groups={groups} onSave={saveCustomer} onCancel={() => setEditing(null)} onDelete={() => deleteCustomer(c.id)} />
              ) : (
                <button key={c.id} type="button" onClick={() => setEditing(c.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, background: palette.card, border: `1.5px solid ${palette.line}`, cursor: "pointer", textAlign: "left", fontFamily: FONT_BODY }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: palette.ink }}>{c.name}{c.textOk === false ? <span style={{ fontWeight: 400, color: palette.accent, fontSize: 12 }}> · not texting</span> : null}</span>
                    <span style={{ display: "block", fontSize: 12, color: palette.inkSoft }}>{c.phone || "No phone yet"}</span>
                  </span>
                  <span style={{ fontSize: 13 }}>{(c.groups || []).map((g) => (groups.find((x) => x.id === g) || {}).emoji).filter(Boolean).join(" ")}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---------------- GROUPS ---------------- */}
        {tab === "groups" && (
          <div>
            <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 10, lineHeight: 1.5 }}>
              Groups are for who wants what. Someone can be in several (eggs and milk).
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {groups.map((g) => {
                const n = customers.filter((c) => (c.groups || []).includes(g.id)).length;
                return (
                  <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, background: palette.card, border: `1.5px solid ${palette.line}` }}>
                    <span style={{ fontSize: 18 }}>{g.emoji}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{g.name}</span>
                    <span style={{ fontSize: 12, color: palette.inkSoft }}>{n} {n === 1 ? "person" : "people"}</span>
                    <button type="button" onClick={() => deleteGroup(g.id)} aria-label={`Delete ${g.name}`} style={{ background: "none", border: "none", cursor: "pointer", color: palette.accent, fontSize: 16 }}>×</button>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="New group (e.g. Duck eggs)" style={inputStyle}
                onKeyDown={(e) => { if (e.key === "Enter") { addGroup(newGroup); setNewGroup(""); } }} />
              <button type="button" onClick={() => { addGroup(newGroup); setNewGroup(""); }} style={btn("primary")}>Add</button>
            </div>
            {SUGGESTED_GROUPS.some((sg) => !groups.some((g) => g.name.toLowerCase() === sg.name.toLowerCase())) && (
              <>
                <Label>Quick add</Label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {SUGGESTED_GROUPS.filter((sg) => !groups.some((g) => g.name.toLowerCase() === sg.name.toLowerCase())).map((sg) => (
                    <Chip key={sg.name} onClick={() => addGroup(sg.name, sg.emoji)}>+ {sg.emoji} {sg.name}</Chip>
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
