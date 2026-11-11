// ============================================================================
// Text your customers — one message, sent one person at a time
// ----------------------------------------------------------------------------
// Texts go out from the owner's own phone: each "Text" button opens
// Messages with that person's number and the message filled in, so replies
// come straight back to the owner, nothing costs anything, and nobody sees
// anyone else's number (no group texts).
//
// Only customers with a phone number who said it's OK to text (textOk, set
// from the order page or by the owner in the customer's details) are listed.
// "{name}" in the message becomes each person's first name.
//
// "Group text" puts up to 20 people in one Messages draft instead. On
// iPhone that's a group chat where everyone sees the others' numbers and
// replies; on Android, with Google Messages set to "Mass text", it goes out
// as separate texts. The sheet says so before anyone picks it.
// ============================================================================

import React, { useMemo, useState } from "react";
import { MessageSquare, Check } from "lucide-react";
import { nl, font } from "./newlook/theme.js";
import { Button, Sheet } from "./newlook/ui.jsx";
import { smsHref, smsGroupHref, GROUP_TEXT_MAX, cleanPageSettings } from "./orderShared.js";

const isIOS = () => {
  if (typeof window === "undefined") return false;
  const cap = window.Capacitor;
  if (cap && typeof cap.getPlatform === "function") return cap.getPlatform() === "ios";
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
};

const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";
const digits = (p) => String(p || "").replace(/[^0-9]/g, "");
export const textable = (c) => !!c && c.textOk === true && digits(c.phone).length >= 7;

export default function TextCustomersSheet({ open, onClose, data }) {
  const farm = String(((data.stockEmailSettings || {}).fromName) || data.homesteadName || "").trim() || "our farm";
  const op = cleanPageSettings(data.orderPage || {});
  const orderUrl = op.on && op.token && !op.paused ? `https://henalytics.com/o/${op.token}` : "";
  const groups = Array.isArray(data.customerGroups) ? data.customerGroups.filter((g) => g && g.id && g.name) : [];
  const all = Array.isArray(data.customers) ? data.customers : [];
  const [group, setGroup] = useState("");
  const [msg, setMsg] = useState(`Hi {name}! Fresh this week at ${farm}: `);
  const [withLink, setWithLink] = useState(!!orderUrl);
  const [sent, setSent] = useState(() => new Set());
  const [mode, setMode] = useState("one");
  const people = useMemo(() => {
    const seen = new Set();
    return all.filter((c) => textable(c) && (!group || (Array.isArray(c.groups) && c.groups.includes(group))))
      .filter((c) => { const d = digits(c.phone); if (seen.has(d)) return false; seen.add(d); return true; })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [all, group]);
  const notOk = all.filter((c) => c && digits(c.phone).length >= 7 && c.textOk !== true).length;
  const body = (c) => {
    const text = msg.replace(/\{name\}/gi, firstName(c.name) || "there").replace(/\s+$/, "");
    return withLink && orderUrl ? `${text}\nOrder here: ${orderUrl}` : text;
  };
  const next = people.find((c) => !sent.has(c.id));
  const groupBody = () => {
    const text = msg.replace(/\{name\}/gi, "everyone").replace(/\s+$/, "");
    return withLink && orderUrl ? `${text}\nOrder here: ${orderUrl}` : text;
  };
  const batches = [];
  for (let i = 0; i < people.length; i += GROUP_TEXT_MAX) batches.push(people.slice(i, i + GROUP_TEXT_MAX));
  const ios = isIOS();
  const mark = (c) => setTimeout(() => setSent((s) => new Set(s).add(c.id)), 300);
  const ready = msg.replace(/\{name\}/gi, "").trim().length > 0;
  const chip = (on) => ({ minHeight: 40, padding: "0 14px", borderRadius: 20, border: `1.5px solid ${on ? nl.good : nl.field}`, background: on ? nl.goodTint : "transparent", color: on ? nl.goodInk : nl.ink, font: `600 14px ${font.body}`, cursor: "pointer" });
  const smsBtn = (c, big) => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: big ? 52 : 40, padding: big ? "0 18px" : "0 14px",
    borderRadius: big ? 14 : 20, background: big ? nl.yolk : "transparent", border: big ? "none" : `1.5px solid ${nl.field}`,
    color: big ? nl.onYolk : nl.ink, fontWeight: big ? 700 : 600, fontSize: big ? 16 : 14, textDecoration: "none", pointerEvents: ready ? "auto" : "none", opacity: ready ? 1 : 0.5,
  });
  return (
    <Sheet open={open} onClose={onClose} label="Text your customers" showClose maxHeight="92vh">
      <h2 style={{ margin: "0 4px 4px", fontFamily: font.display, fontWeight: 400, fontSize: 24 }}>Text your customers</h2>
      <p style={{ margin: "0 4px 10px", fontSize: 14, color: nl.soft, lineHeight: 1.45 }}>Texts go from your own phone, so they're free and replies come straight to you. Only people who said it's OK to text are listed.</p>

      {groups.length > 0 && (
        <div role="group" aria-label="Who to text" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <button type="button" aria-pressed={!group} onClick={() => setGroup("")} style={chip(!group)}>Everyone</button>
          {groups.map((g) => <button key={g.id} type="button" aria-pressed={group === g.id} onClick={() => setGroup(g.id)} style={chip(group === g.id)}>{[g.emoji, g.name].filter(Boolean).join(" ")}</button>)}
        </div>
      )}

      <label htmlFor="tc-msg" style={{ display: "block", fontSize: 13, fontWeight: 600, color: nl.soft, margin: "4px 2px 6px" }}>Your message</label>
      <textarea id="tc-msg" value={msg} onChange={(e) => setMsg(e.target.value.slice(0, 600))} style={{ width: "100%", minHeight: 96, padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${nl.line}`, background: nl.card, color: nl.ink, font: `400 16px ${font.body}`, boxSizing: "border-box" }} />
      <div style={{ fontSize: 13, color: nl.soft, margin: "4px 2px 0" }}>{"{name}"} becomes each person's first name.</div>
      {orderUrl && (
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, margin: "10px 2px 0", minHeight: 40 }}>
          <input type="checkbox" checked={withLink} onChange={(e) => setWithLink(e.target.checked)} style={{ width: 20, height: 20 }} /> Add my order page link
        </label>
      )}

      {people.length > 1 && (
        <div role="group" aria-label="How to send" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
          <button type="button" aria-pressed={mode === "one"} onClick={() => setMode("one")} style={chip(mode === "one")}>One at a time (private)</button>
          <button type="button" aria-pressed={mode === "group"} onClick={() => setMode("group")} style={chip(mode === "group")}>Group text</button>
        </div>
      )}

      {people.length > 1 && mode === "group" ? (
        <>
          <div style={{ marginTop: 10, padding: 12, background: nl.chip, borderRadius: 14, fontSize: 14, lineHeight: 1.5 }}>
            {ios
              ? <>Heads up: on iPhone this makes a group chat. <b>Everyone sees each other's numbers</b>, and replies go to the whole group. Best for small lists who know each other.</>
              : <>On Android, everyone gets it as their own text if Google Messages is set to <b>Mass text</b> (Messages settings › Advanced › Group messaging). Otherwise it's a group chat where everyone sees each other's numbers.</>}
            {" "}{"{name}"} becomes "everyone".
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {batches.map((b, i) => (
              <a key={i} href={smsGroupHref(b.map((c) => c.phone), groupBody(), ios)} onClick={() => b.forEach(mark)} style={{ ...smsBtn(null, true), width: "100%", boxSizing: "border-box" }}>
                <MessageSquare size={20} aria-hidden="true" />{batches.length > 1 ? `Group text ${i + 1} of ${batches.length} (${b.length} people)` : `Group text all ${b.length}`}
              </a>
            ))}
          </div>
          {batches.length > 1 && <p style={{ fontSize: 13, color: nl.soft, margin: "8px 4px 0" }}>Split into groups of {GROUP_TEXT_MAX}, since phones and carriers limit how many people fit in one group text.</p>}
        </>
      ) : people.length === 0 ? (
        <div style={{ marginTop: 14, padding: 14, background: nl.chip, borderRadius: 14, fontSize: 14, lineHeight: 1.5 }}>
          Nobody {group ? "on this list " : ""}has said it's OK to text yet. Customers can tick "OK to text me" on your order page, or you can add a phone number and turn on "OK to text" in a customer's details.
        </div>
      ) : (
        <>
          <div style={{ marginTop: 14 }}>
            {next
              ? <a href={smsHref(next.phone, body(next))} onClick={() => mark(next)} style={{ ...smsBtn(next, true), width: "100%", boxSizing: "border-box" }}><MessageSquare size={20} aria-hidden="true" />Text {next.name || next.phone} ({people.indexOf(next) + 1} of {people.length})</a>
              : <div style={{ padding: 12, background: nl.goodTint, color: nl.goodInk, borderRadius: 14, fontWeight: 600, textAlign: "center" }}>All {people.length} done</div>}
          </div>
          <div style={{ marginTop: 10, background: nl.card, border: `1px solid ${nl.line}`, borderRadius: 16 }}>
            {people.map((c, i) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: i ? `1px solid ${nl.rule}` : "none" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 600, overflowWrap: "anywhere" }}>{c.name || "Customer"}</span>
                  <span style={{ display: "block", fontSize: 13, color: nl.soft }}>{c.phone}</span>
                </span>
                {sent.has(c.id)
                  ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: nl.goodInk, fontSize: 14, fontWeight: 600 }}><Check size={16} aria-hidden="true" />Opened</span>
                  : <a href={smsHref(c.phone, body(c))} onClick={() => mark(c)} aria-label={`Text ${c.name || c.phone}`} style={smsBtn(c, false)}>Text</a>}
              </div>
            ))}
          </div>
        </>
      )}
      {notOk > 0 && <p style={{ fontSize: 13, color: nl.soft, margin: "10px 4px 0" }}>{notOk} more {notOk === 1 ? "has" : "have"} a phone number but haven't said it's OK to text.</p>}
      <div style={{ marginTop: 14 }}><Button kind="quiet" onClick={onClose}>Done</Button></div>
    </Sheet>
  );
}
