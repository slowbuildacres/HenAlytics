// ============================================================================
// Customers — everyone who buys from the homestead, in one place (Orders tab)
// ----------------------------------------------------------------------------
// Name, email, phone, "OK to text", "gets your emails", lists and notes, with
// what each person has bought (Sales records linked by buyerId). From here
// the owner adds people, pastes a list, manages lists, emails a list (the
// stock email screen) and texts a list (TextCustomers.jsx).
//
// Data (shared with Sales, stock emails and Orders):
//   data.customers[]    = { id, name, email, phone, textOk, emailOk, groups: [listId], note }
//   data.customerGroups = [{ id, name, emoji }]
// Works signed out too; it's all in the homestead's own data.
// ============================================================================

import React, { useMemo, useState } from "react";
import { Search, UserPlus, ClipboardList, Tags, Mail, MessageSquare, Trash2, Check } from "lucide-react";
import { nl, font } from "./newlook/theme.js";
import { Card, Row, Button, Sheet } from "./newlook/ui.jsx";
import { computeRevenue } from "./Sales.jsx";
import { fmtMoney } from "./units.js";
import TextCustomersSheet, { textable } from "./TextCustomers.jsx";

const newId = () => Math.random().toString(36).slice(2, 10);
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const digits = (p) => String(p || "").replace(/[^0-9]/g, "");
const SUGGESTED = [
  { name: "Eggs", emoji: "🥚" }, { name: "Baked goods", emoji: "🍞" }, { name: "Meat", emoji: "🍗" },
  { name: "Produce", emoji: "🥕" }, { name: "Honey", emoji: "🍯" }, { name: "Milk", emoji: "🥛" },
];
const inputStyle = {
  width: "100%", minHeight: 48, padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${nl.line}`,
  background: nl.card, color: nl.ink, font: `400 16px ${font.body}`, boxSizing: "border-box",
};
const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: nl.soft, margin: "12px 2px 6px" };
const chip = (on) => ({
  minHeight: 40, padding: "0 14px", borderRadius: 20, border: `1.5px solid ${on ? nl.good : nl.field}`,
  background: on ? nl.goodTint : "transparent", color: on ? nl.goodInk : nl.ink, font: `600 14px ${font.body}`, cursor: "pointer",
});
const ic = (I) => <I size={20} strokeWidth={1.8} aria-hidden="true" />;

// What each customer has bought: { [id]: { spent, count, last, sales } }
export function customerHistory(data) {
  const out = {};
  (Array.isArray(data.sales) ? data.sales : []).forEach((s) => {
    if (!s || !s.buyerId) return;
    const h = out[s.buyerId] || (out[s.buyerId] = { spent: 0, count: 0, last: "", sales: [] });
    h.spent += computeRevenue(s);
    h.count += 1;
    if (String(s.date || "") > h.last) h.last = String(s.date || "");
    h.sales.push(s);
  });
  Object.values(out).forEach((h) => h.sales.sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))));
  return out;
}
const saleLine = (s) => {
  const what = s.crop || s.otherItem || (s.hobbyType === "eggs" ? `${s.qty} ${s.unit === "dozen" ? "dozen eggs" : "eggs"}` : s.hobbyType) || "Sale";
  return `${what}${s.crop && s.qty ? ` × ${s.qty}` : ""}`;
};
const prettyDay = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ""))) return "";
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: y === new Date().getFullYear() ? undefined : "numeric" });
};

function ListChips({ lists, sel, onToggle }) {
  if (!lists.length) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {lists.map((g) => <button key={g.id} type="button" aria-pressed={sel.includes(g.id)} onClick={() => onToggle(g.id)} style={chip(sel.includes(g.id))}>{[g.emoji, g.name].filter(Boolean).join(" ")}</button>)}
    </div>
  );
}

// ---------------------------------------------------------------- one customer
function CustomerSheet({ customer, data, update, history, onClose }) {
  const isNew = !customer;
  const lists = Array.isArray(data.customerGroups) ? data.customerGroups.filter((g) => g && g.id) : [];
  const [name, setName] = useState(customer?.name || "");
  const [email, setEmail] = useState(customer?.email || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [textOk, setTextOk] = useState(customer?.textOk === true);
  const [emailOk, setEmailOk] = useState(customer?.emailOk !== false);
  const [groups, setGroups] = useState(Array.isArray(customer?.groups) ? customer.groups : []);
  const [note, setNote] = useState(customer?.note || "");
  const [confirmDel, setConfirmDel] = useState(false);
  const em = email.trim().toLowerCase();
  const badEmail = em && !EMAIL_RE.test(em);
  const dupe = em && (data.customers || []).some((c) => c && c.id !== customer?.id && String(c.email || "").toLowerCase() === em);
  const phoneOk = digits(phone).length >= 7;
  const ok = name.trim() && !badEmail && !dupe;
  const h = customer ? history[customer.id] : null;
  const save = () => {
    if (!ok) return;
    const next = { ...(customer || {}), id: customer?.id || newId(), name: name.trim().slice(0, 60), email: em, phone: phone.trim().slice(0, 30), textOk: phoneOk && textOk, emailOk, groups, note: note.trim().slice(0, 300) };
    update((d) => {
      if (!Array.isArray(d.customers)) d.customers = [];
      const i = d.customers.findIndex((c) => c && c.id === next.id);
      if (i >= 0) d.customers[i] = { ...d.customers[i], ...next }; else d.customers.push(next);
      return d;
    });
    onClose(isNew ? `${next.name} added.` : "Saved.");
  };
  const remove = () => {
    update((d) => { d.customers = (d.customers || []).filter((c) => c && c.id !== customer.id); return d; });
    onClose(`${customer.name || "Customer"} deleted.`);
  };
  return (
    <Sheet open onClose={() => onClose("")} label={isNew ? "Add a customer" : `Customer ${customer.name || ""}`} showClose maxHeight="92vh">
      <h2 style={{ margin: "0 4px 4px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>{isNew ? "Add a customer" : customer.name || "Customer"}</h2>
      {h && <p style={{ margin: "0 4px 6px", fontSize: 14, color: nl.soft }}>{fmtMoney(h.spent)} over {h.count} sale{h.count === 1 ? "" : "s"}{h.last ? ` · last ${prettyDay(h.last)}` : ""}</p>}
      <label style={labelStyle} htmlFor="cu-name">Name</label>
      <input id="cu-name" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" autoFocus={isNew} />
      <label style={labelStyle} htmlFor="cu-email">Email</label>
      <input id="cu-email" style={{ ...inputStyle, borderColor: badEmail || dupe ? nl.alert : nl.line }} type="email" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
      {(badEmail || dupe) && <div role="alert" style={{ fontSize: 13, color: nl.alert, margin: "4px 2px 0" }}>{dupe ? "Someone else already has that email." : "That email doesn't look right."}</div>}
      <label style={labelStyle} htmlFor="cu-phone">Phone</label>
      <input id="cu-phone" style={inputStyle} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="555-123-4567" />
      <div style={{ marginTop: 10, background: nl.card, border: `1px solid ${nl.line}`, borderRadius: 16, padding: "2px 10px" }}>
        <Toggle on={emailOk} onChange={setEmailOk} label="Gets your emails" sub={emailOk ? "Included when you email a list" : "Left out of list emails"} />
        <div style={{ borderTop: `1px solid ${nl.rule}` }}>
          <Toggle on={phoneOk && textOk} disabled={!phoneOk} onChange={setTextOk} label="OK to text" sub={phoneOk ? "Only if they said you can text them" : "Add a phone number first"} />
        </div>
      </div>
      {lists.length > 0 && <><div style={labelStyle}>Lists</div><ListChips lists={lists} sel={groups} onToggle={(id) => setGroups((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]))} /></>}
      <label style={labelStyle} htmlFor="cu-note">Notes</label>
      <input id="cu-note" style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Neighbor, likes the blue eggs" />
      {h && h.sales.length > 0 && (
        <>
          <div style={labelStyle}>What they've bought</div>
          <div style={{ background: nl.card, border: `1px solid ${nl.line}`, borderRadius: 16 }}>
            {h.sales.slice(0, 6).map((s, i) => (
              <div key={s.id || i} style={{ display: "flex", gap: 10, padding: "10px 12px", borderTop: i ? `1px solid ${nl.rule}` : "none", fontSize: 14 }}>
                <span style={{ color: nl.soft, minWidth: 56 }}>{prettyDay(s.date)}</span>
                <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{saleLine(s)}</span>
                <span style={{ fontWeight: 600 }}>{fmtMoney(computeRevenue(s))}</span>
              </div>
            ))}
          </div>
          {h.sales.length > 6 && <div style={{ fontSize: 13, color: nl.soft, margin: "6px 4px 0" }}>And {h.sales.length - 6} more in Sales.</div>}
        </>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <Button onClick={save} disabled={!ok}>{isNew ? "Add customer" : "Save"}</Button>
        <Button kind="quiet" onClick={() => onClose("")}>Cancel</Button>
      </div>
      {!isNew && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${nl.rule}` }}>
          {confirmDel
            ? <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><span style={{ fontSize: 14 }}>Delete {customer.name}? Their past sales stay in Sales.</span><Button small kind="quiet" onClick={remove}>Yes, delete</Button><Button small kind="link" onClick={() => setConfirmDel(false)}>Keep</Button></div>
            : <Button small kind="quiet" icon={<Trash2 size={16} />} onClick={() => setConfirmDel(true)}>Delete customer</Button>}
        </div>
      )}
    </Sheet>
  );
}

function Toggle({ on, onChange, label, sub, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => !disabled && onChange(!on)} style={{
      display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 56, padding: "10px 4px", border: "none", background: "none", color: nl.ink, font: "inherit", textAlign: "left", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1,
    }}>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{label}</span>
        {sub && <span style={{ display: "block", fontSize: 13, color: nl.soft }}>{sub}</span>}
      </span>
      <span aria-hidden="true" style={{ width: 48, height: 28, borderRadius: 14, background: on ? nl.good : nl.field, position: "relative", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 22, height: 22, borderRadius: 11, background: "#fff" }} />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- lists
function ListsSheet({ data, update, onClose }) {
  const lists = Array.isArray(data.customerGroups) ? data.customerGroups.filter((g) => g && g.id) : [];
  const customers = Array.isArray(data.customers) ? data.customers : [];
  const [name, setName] = useState("");
  const [del, setDel] = useState("");
  const mutate = (fn) => update((d) => { d.customers = Array.isArray(d.customers) ? d.customers : []; d.customerGroups = Array.isArray(d.customerGroups) ? d.customerGroups : []; fn(d); return d; });
  const add = (nm, emoji = "🏷️") => {
    const n = String(nm || "").trim().slice(0, 30);
    if (!n) return;
    mutate((d) => { if (!d.customerGroups.some((g) => String(g.name).toLowerCase() === n.toLowerCase())) d.customerGroups.push({ id: newId(), name: n, emoji }); });
    setName("");
  };
  const rename = (id, nm) => mutate((d) => { const g = d.customerGroups.find((x) => x.id === id); if (g) g.name = String(nm).slice(0, 30); });
  const removeList = (id) => { mutate((d) => { d.customerGroups = d.customerGroups.filter((x) => x.id !== id); d.customers.forEach((c) => { if (c && Array.isArray(c.groups)) c.groups = c.groups.filter((x) => x !== id); }); }); setDel(""); };
  const suggestions = SUGGESTED.filter((s) => !lists.some((g) => String(g.name).toLowerCase() === s.name.toLowerCase()));
  return (
    <Sheet open onClose={onClose} label="Your lists" showClose maxHeight="92vh">
      <h2 style={{ margin: "0 4px 4px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>Your lists</h2>
      <p style={{ margin: "0 4px 10px", fontSize: 14, color: nl.soft, lineHeight: 1.45 }}>Lists are for who wants what, like eggs or baked goods. Someone can be on several. Email or text a whole list at once.</p>
      {lists.length > 0 && (
        <div style={{ background: nl.card, border: `1px solid ${nl.line}`, borderRadius: 16 }}>
          {lists.map((g, i) => {
            const n = customers.filter((c) => c && Array.isArray(c.groups) && c.groups.includes(g.id)).length;
            return (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderTop: i ? `1px solid ${nl.rule}` : "none" }}>
                <span style={{ fontSize: 20, width: 28, textAlign: "center" }} aria-hidden="true">{g.emoji || "🏷️"}</span>
                <input aria-label={`Name of list ${g.name}`} style={{ ...inputStyle, minHeight: 40, flex: 1 }} defaultValue={g.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== g.name) rename(g.id, v); }} />
                <span style={{ fontSize: 13, color: nl.soft, whiteSpace: "nowrap" }}>{n} {n === 1 ? "person" : "people"}</span>
                {del === g.id
                  ? <Button small kind="quiet" onClick={() => removeList(g.id)}>Delete</Button>
                  : <button type="button" aria-label={`Delete list ${g.name}`} onClick={() => setDel(g.id)} style={{ width: 40, height: 40, border: "none", background: "none", color: nl.soft, cursor: "pointer" }}><Trash2 size={18} /></button>}
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input aria-label="New list name" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(name); }} placeholder="New list, like Duck eggs" />
        <Button onClick={() => add(name)} disabled={!name.trim()}>Add</Button>
      </div>
      {suggestions.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {suggestions.map((s) => <button key={s.name} type="button" onClick={() => add(s.name, s.emoji)} style={chip(false)}>+ {s.emoji} {s.name}</button>)}
        </div>
      )}
      <div style={{ marginTop: 14 }}><Button kind="quiet" onClick={onClose}>Done</Button></div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- paste a list
export function parsePasted(text) {
  return String(text || "").split(/\n+/).map((line) => {
    const m = line.match(/[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+/);
    const ph = line.match(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    if (!m && !ph) return null;
    const name = line.replace(m ? m[0] : "", "").replace(ph ? ph[0] : "", "").replace(/[<>,;:()"\t–-]+/g, " ").replace(/\s+/g, " ").trim();
    return { name: name || (m ? m[0].split("@")[0] : "Customer"), email: m ? m[0].toLowerCase() : "", phone: ph ? ph[0].trim() : "" };
  }).filter(Boolean);
}
function PasteSheet({ data, update, onClose }) {
  const lists = Array.isArray(data.customerGroups) ? data.customerGroups.filter((g) => g && g.id) : [];
  const [text, setText] = useState("");
  const [sel, setSel] = useState([]);
  const rows = parsePasted(text);
  const add = () => {
    update((d) => {
      if (!Array.isArray(d.customers)) d.customers = [];
      const have = new Map(d.customers.filter((c) => c && c.email).map((c) => [String(c.email).toLowerCase(), c]));
      const phones = new Map(d.customers.filter((c) => c && digits(c.phone).length >= 7).map((c) => [digits(c.phone), c]));
      rows.forEach((r) => {
        const found = (r.email && have.get(r.email)) || (r.phone && phones.get(digits(r.phone)));
        if (found) {
          found.groups = Array.from(new Set([...(Array.isArray(found.groups) ? found.groups : []), ...sel]));
          if (!found.phone && r.phone) found.phone = r.phone;
          if (!found.email && r.email) found.email = r.email;
          return;
        }
        const c = { id: newId(), name: r.name.slice(0, 60), email: r.email, phone: r.phone, groups: [...sel], note: "" };
        d.customers.push(c);
        if (c.email) have.set(c.email, c);
        if (c.phone) phones.set(digits(c.phone), c);
      });
      return d;
    });
    onClose(`${rows.length} ${rows.length === 1 ? "person" : "people"} added or updated.`);
  };
  return (
    <Sheet open onClose={() => onClose("")} label="Paste a list" showClose maxHeight="92vh">
      <h2 style={{ margin: "0 4px 4px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>Paste a list</h2>
      <p style={{ margin: "0 4px 10px", fontSize: 14, color: nl.soft, lineHeight: 1.45 }}>One person per line with a name and an email and/or phone, like "Pat Smith pat@email.com 555-123-4567". Pasting from a spreadsheet works too. People already here get updated, not doubled.</p>
      <textarea aria-label="People to add" value={text} onChange={(e) => setText(e.target.value)} style={{ ...inputStyle, minHeight: 130 }} placeholder={"Pat Smith pat@email.com\nJo Miller 555-123-4567"} />
      {rows.length > 0 && <div style={{ fontSize: 13, color: nl.soft, margin: "6px 2px 0" }}>Found {rows.length}: {rows.slice(0, 3).map((r) => r.name).join(", ")}{rows.length > 3 ? "…" : ""}</div>}
      {lists.length > 0 && <><div style={labelStyle}>Add them to</div><ListChips lists={lists} sel={sel} onToggle={(id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} /></>}
      <p style={{ fontSize: 13, color: nl.soft, margin: "10px 4px 0" }}>Pasted phone numbers aren't marked OK to text. Turn that on for each person who said yes.</p>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Button onClick={add} disabled={!rows.length}>Add {rows.length || ""} {rows.length === 1 ? "person" : "people"}</Button>
        <Button kind="quiet" onClick={() => onClose("")}>Cancel</Button>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- the panel
export default function CustomersPanel({ data, update, onEmail, toast }) {
  const customers = useMemo(() => (Array.isArray(data.customers) ? data.customers.filter((c) => c && c.id) : []), [data.customers]);
  const lists = Array.isArray(data.customerGroups) ? data.customerGroups.filter((g) => g && g.id) : [];
  const history = useMemo(() => customerHistory(data), [data]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(null); // customer | "new"
  const [sheet, setSheet] = useState(""); // lists | paste | text
  const say = (m) => { if (m && toast) toast(m); };
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return customers
      .filter((c) => (filter === "all" ? true : filter === "text" ? textable(c) : filter === "noemail" ? !EMAIL_RE.test(String(c.email || "")) : Array.isArray(c.groups) && c.groups.includes(filter)))
      .filter((c) => !s || [c.name, c.email, c.phone, c.note].some((v) => String(v || "").toLowerCase().includes(s)) || (s.replace(/[^0-9]/g, "").length >= 3 && digits(c.phone).includes(s.replace(/[^0-9]/g, ""))))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [customers, q, filter]);
  const withEmail = customers.filter((c) => EMAIL_RE.test(String(c.email || "")) && c.emailOk !== false).length;
  const okText = customers.filter(textable).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card>
        <Row first icon={ic(Mail)} title="Email your customers" sub={withEmail ? `${withEmail} with an email` : "Add emails to send what's fresh"} onClick={onEmail} chevron />
        <Row icon={ic(MessageSquare)} title="Text your customers" sub={okText ? `${okText} said it's OK to text` : "From your own phone, free"} onClick={() => setSheet("text")} chevron />
        <Row icon={ic(Tags)} title="Lists" sub={lists.length ? lists.map((g) => [g.emoji, g.name].filter(Boolean).join(" ")).join(", ") : "Group people by what they buy"} onClick={() => setSheet("lists")} chevron />
      </Card>

      <div style={{ display: "flex", gap: 8 }}>
        <Button icon={<UserPlus size={18} />} onClick={() => setOpen("new")}>Add a customer</Button>
        <Button kind="quiet" icon={<ClipboardList size={18} />} onClick={() => setSheet("paste")}>Paste a list</Button>
      </div>

      {customers.length > 0 && (
        <>
          <label style={{ position: "relative", display: "block" }}>
            <Search size={18} color={nl.soft} aria-hidden="true" style={{ position: "absolute", left: 12, top: 15 }} />
            <input aria-label="Search customers" type="search" style={{ ...inputStyle, paddingLeft: 38 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or phone" />
          </label>
          <div role="group" aria-label="Show" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
            {[["all", `Everyone (${customers.length})`], ...lists.map((g) => [g.id, [g.emoji, g.name].filter(Boolean).join(" ")]), ["text", "OK to text"], ["noemail", "No email"]].map(([id, label]) => (
              <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} style={{ ...chip(filter === id), flexShrink: 0 }}>{label}</button>
            ))}
          </div>
        </>
      )}

      {customers.length === 0 ? (
        <Card padded>
          <div style={{ fontFamily: font.display, fontSize: 20 }}>No customers yet</div>
          <div style={{ fontSize: 14, color: nl.soft, marginTop: 4, lineHeight: 1.5 }}>Add the people who buy from you, paste a list, or save them from an order. People who join your list from your order page show up here too.</div>
        </Card>
      ) : (
        <Card>
          {shown.length === 0 && <div style={{ padding: 14, fontSize: 14, color: nl.soft }}>Nobody matches that.</div>}
          {shown.map((c, i) => {
            const h = history[c.id];
            const sub = [c.email || null, c.phone || null].filter(Boolean).join(" · ") || "No email or phone yet";
            const tags = (Array.isArray(c.groups) ? c.groups : []).map((g) => (lists.find((x) => x.id === g) || {}).emoji).filter(Boolean).join(" ");
            return (
              <button key={c.id} type="button" onClick={() => setOpen(c)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 14px", border: "none", borderTop: i ? `1px solid ${nl.rule}` : "none", background: "none", color: nl.ink, font: "inherit", textAlign: "left", cursor: "pointer" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 600, overflowWrap: "anywhere" }}>{c.name || "Customer"} {tags && <span style={{ fontWeight: 400 }}>{tags}</span>}</span>
                  <span style={{ display: "block", fontSize: 13, color: nl.soft, overflowWrap: "anywhere" }}>{sub}</span>
                  <span style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, marginTop: 2 }}>
                    {textable(c) && <span style={{ color: nl.goodInk, display: "inline-flex", alignItems: "center", gap: 3 }}><Check size={12} aria-hidden="true" />OK to text</span>}
                    {c.emailOk === false && <span style={{ color: nl.soft }}>No emails</span>}
                  </span>
                </span>
                {h && <span style={{ textAlign: "right", fontSize: 13, color: nl.soft, whiteSpace: "nowrap" }}><span style={{ display: "block", fontWeight: 600, color: nl.ink }}>{fmtMoney(h.spent)}</span>{h.last ? prettyDay(h.last) : ""}</span>}
              </button>
            );
          })}
        </Card>
      )}

      {open && <CustomerSheet key={open === "new" ? "new" : open.id} customer={open === "new" ? null : open} data={data} update={update} history={history} onClose={(m) => { setOpen(null); say(m); }} />}
      {sheet === "lists" && <ListsSheet data={data} update={update} onClose={() => setSheet("")} />}
      {sheet === "paste" && <PasteSheet data={data} update={update} onClose={(m) => { setSheet(""); say(m); }} />}
      {sheet === "text" && <TextCustomersSheet open onClose={() => setSheet("")} data={data} />}
    </div>
  );
}
