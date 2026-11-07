// ============================================================================
// In-app "Are you sure?" sheet
// ----------------------------------------------------------------------------
// window.confirm() can be silently swallowed in the phone apps' web view, so a
// button that asked first would quietly do nothing. askConfirm() / askChoice()
// show a sheet in the app instead and resolve with the answer.
//
//   if (!(await askConfirm({ title: "Delete this expense?", confirmLabel: "Delete" }))) return;
//   const pick = await askChoice({ title: "Delete a repeating expense", choices: [
//     { label: "Just this one", value: "one" }, { label: "The whole series", value: "all", danger: true } ] });
//
// <ConfirmHost /> is mounted once at the top of the app.
// ============================================================================
import React, { useEffect, useState } from "react";
import { nl, font } from "./theme.js";
import { Sheet } from "./ui.jsx";

const EVENT = "henalytics-confirm";

export function askChoice({ title, message = "", choices = [], cancelLabel = "Cancel", input = null }) {
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { title, message, choices, cancelLabel, input, resolve } }));
  });
}

// A typed answer (in place of window.prompt): the text, or null if canceled.
export function askText({ title, message = "", value = "", placeholder = "", inputMode, confirmLabel = "Save" }) {
  return askChoice({ title, message, input: { value: String(value ?? ""), placeholder, inputMode }, choices: [{ label: confirmLabel, value: "__text__" }] });
}

export function askConfirm({ title, message = "", confirmLabel = "OK", danger = true, cancelLabel = "Cancel" }) {
  return askChoice({ title, message, cancelLabel, choices: [{ label: confirmLabel, value: true, danger }] }).then((v) => v === true);
}

export function ConfirmHost() {
  const [ask, setAsk] = useState(null);
  useEffect(() => {
    const on = (e) => {
      const d = e && e.detail;
      if (!d) return;
      setAsk((prev) => { if (prev) prev.resolve(null); return d; });
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  if (!ask) return null;
  const done = (v) => { const r = ask.resolve; const text = ask.text; setAsk(null); r(v === "__text__" ? (text ?? (ask.input && ask.input.value) ?? "") : v); };
  const btn = (danger, primary) => ({
    width: "100%", minHeight: 50, borderRadius: 14, cursor: "pointer", font: `700 16px ${font.body}`,
    border: primary ? "none" : `1.5px solid ${nl.field}`,
    background: primary ? (danger ? nl.alert : nl.yolk) : "transparent",
    color: primary ? (danger ? nl.paper : nl.onYolk) : nl.ink,
  });
  return (
    <Sheet open onClose={() => done(null)} label={ask.title}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "4px 0 2px" }}>
        <div style={{ fontFamily: font.display, fontSize: 22, lineHeight: 1.2 }}>{ask.title}</div>
        {ask.message && <div style={{ fontSize: 15, lineHeight: 1.45, color: nl.soft, whiteSpace: "pre-line" }}>{ask.message}</div>}
        {ask.input && (
          <input autoFocus aria-label={ask.title} defaultValue={ask.input.value} placeholder={ask.input.placeholder} inputMode={ask.input.inputMode}
            onChange={(e) => { ask.text = e.target.value; }}
            onKeyDown={(e) => { if (e.key === "Enter") done("__text__"); }}
            style={{ minHeight: 50, borderRadius: 12, border: `1.5px solid ${nl.field}`, background: nl.card, color: nl.ink, padding: "0 14px", font: `500 16px ${font.body}`, marginTop: 4 }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          {ask.choices.map((c, i) => (
            <button key={i} type="button" onClick={() => done(c.value)} style={btn(!!c.danger, true)}>{c.label}</button>
          ))}
          <button type="button" onClick={() => done(null)} style={btn(false, false)}>{ask.cancelLabel}</button>
        </div>
      </div>
    </Sheet>
  );
}
