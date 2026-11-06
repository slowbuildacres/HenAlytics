// ============================================================================
// New look (3.0) — "Saved 9 eggs · Undo"
// ----------------------------------------------------------------------------
// After a save (and, as screens are rebuilt, a delete) a small bar shows for
// six seconds above the nav bar with an Undo button, instead of asking
// "Are you sure?" first. showUndo() can be called from anywhere; the bar only
// appears where <UndoHost /> is mounted (the new look).
// ============================================================================

import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { nl, font, NAV_HEIGHT } from "./theme.js";

const EVENT = "henalytics-undo";
const SHOW_MS = 6000;

export function showUndo(message, onUndo) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, onUndo } }));
}

// ---------------------------------------------------------------------------
// undoable(update, message)(mutator) — runs a save like update(mutator) and
// shows "message · Undo". Undo puts back only what that save changed: each
// hobby (by id), each entries list (by hobby key) and any other top-level
// field it touched. Anything else that changed in the meantime (a farmhand's
// sync, another save) is left alone. Good for saves whose side effects are
// spread out (pantry stock, expenses, the batch itself) and not worth
// hand-coding an exact reverse for.
// ---------------------------------------------------------------------------
const j = (v) => (v === undefined ? "\u0000u" : JSON.stringify(v));
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function diffSave(pre, after) {
  const out = { hobbies: [], entries: [], keys: [] };
  const keys = new Set([...Object.keys(pre), ...Object.keys(after || {})]);
  for (const k of keys) {
    if (k === "hobbies") {
      const was = Array.isArray(pre.hobbies) ? pre.hobbies : [];
      const now = Array.isArray(after.hobbies) ? after.hobbies : [];
      const wasById = new Map(was.map((h, i) => [h && h.id, { h, i }]));
      const nowById = new Map(now.map((h) => [h && h.id, h]));
      for (const [id, { h, i }] of wasById) {
        const n = nowById.get(id);
        if (!n || j(n) !== j(h)) out.hobbies.push({ id, before: clone(h), index: i });
      }
      for (const [id] of nowById) if (!wasById.has(id)) out.hobbies.push({ id, before: null });
    } else if (k === "entries") {
      const was = pre.entries || {};
      const now = (after && after.entries) || {};
      for (const ek of new Set([...Object.keys(was), ...Object.keys(now)])) {
        if (j(was[ek]) !== j(now[ek])) out.entries.push({ key: ek, before: clone(was[ek]), afterIds: new Set((Array.isArray(now[ek]) ? now[ek] : []).map((e) => e && e.id)), beforeIds: new Set((Array.isArray(was[ek]) ? was[ek] : []).map((e) => e && e.id)) });
      }
    } else if (j(pre[k]) !== j(after && after[k])) {
      out.keys.push({ key: k, before: clone(pre[k]) });
    }
  }
  return out;
}

function restoreSave(d, s) {
  if (!s) return d;
  if (s.hobbies.length) {
    let list = Array.isArray(d.hobbies) ? [...d.hobbies] : [];
    for (const { id, before, index } of s.hobbies) {
      const at = list.findIndex((h) => h && h.id === id);
      if (before == null) { if (at >= 0) list.splice(at, 1); }
      else if (at >= 0) list[at] = before;
      else list.splice(Math.min(index ?? list.length, list.length), 0, before);
    }
    d.hobbies = list;
  }
  for (const { key, before, afterIds, beforeIds } of s.entries) {
    d.entries = d.entries || {};
    // Entries are lists that other saves add to as well, so put back the
    // save's own rows instead of the whole list: drop rows it added, restore
    // rows it changed or removed.
    const cur = Array.isArray(d.entries[key]) ? d.entries[key] : [];
    const was = Array.isArray(before) ? before : [];
    const wasById = new Map(was.map((e) => [e && e.id, e]));
    const next = cur.filter((e) => !(e && afterIds.has(e.id) && !beforeIds.has(e.id))).map((e) => (e && wasById.has(e.id) ? wasById.get(e.id) : e));
    for (const e of was) if (e && !next.some((x) => x && x.id === e.id)) next.push(e);
    if (before === undefined && !next.length) delete d.entries[key]; else d.entries[key] = next;
  }
  for (const { key, before } of s.keys) {
    if (before === undefined) delete d[key]; else d[key] = before;
  }
  return d;
}

export function undoable(update, message) {
  return (mutator, opts) => {
    let saved = null;
    update((d) => {
      const pre = {};
      for (const k of Object.keys(d)) pre[k] = clone(d[k]);
      const out = mutator(d) || d;
      try { saved = diffSave(pre, out); } catch (_) { saved = null; }
      return out;
    }, opts);
    // The save runs on React's next render; Undo can only be tapped after.
    showUndo(typeof message === "function" ? message() : message, () => { if (saved) update((d) => restoreSave(d, saved)); });
  };
}

// For forms that save on their own (the older livestock forms): take a
// snapshot when the form opens, then offer Undo for what changed by the time
// it closes. Limited to one hobby, its logs and the calendar, so a farmhand's
// sync landing meanwhile isn't touched. Undo puts back everything the form
// did: the log, a breeding record, the "next heat" reminder it added.
export function undoSnapshot(data, hobbyId) {
  return {
    hobbyId,
    hobbies: clone(((data && data.hobbies) || []).filter((h) => h && h.id === hobbyId)),
    entries: { [hobbyId]: clone(data && data.entries ? data.entries[hobbyId] : undefined) },
    calendarEvents: clone(data ? data.calendarEvents : undefined),
  };
}
export function offerUndoSince(update, snap, data, message) {
  if (!snap) return false;
  const now = {
    hobbies: ((data && data.hobbies) || []).filter((h) => h && h.id === snap.hobbyId),
    entries: { [snap.hobbyId]: data && data.entries ? data.entries[snap.hobbyId] : undefined },
    calendarEvents: data ? data.calendarEvents : undefined,
  };
  let saved;
  try { saved = diffSave(snap, now); } catch (_) { return false; }
  if (!saved.hobbies.length && !saved.entries.length && !saved.keys.length) return false;
  // Calendar: drop only the reminders this save added (others may have been
  // added meanwhile), rather than putting the whole list back.
  const calKey = saved.keys.find((k) => k.key === "calendarEvents");
  const added = calKey ? new Set((now.calendarEvents || []).map((e) => e && e.id).filter((id) => !(snap.calendarEvents || []).some((x) => x && x.id === id))) : null;
  saved.keys = saved.keys.filter((k) => k.key !== "calendarEvents");
  showUndo(message, () => update((d) => {
    restoreSave(d, saved);
    if (added && added.size && Array.isArray(d.calendarEvents)) d.calendarEvents = d.calendarEvents.filter((e) => !(e && added.has(e.id)));
    return d;
  }));
  return true;
}

export function UndoHost() {
  const [item, setItem] = useState(null);
  const timer = useRef(null);
  useEffect(() => {
    const on = (e) => {
      const { message, onUndo } = (e && e.detail) || {};
      if (!message) return;
      clearTimeout(timer.current);
      setItem({ message, onUndo, id: Math.random() });
      timer.current = setTimeout(() => setItem(null), SHOW_MS);
    };
    window.addEventListener(EVENT, on);
    return () => { window.removeEventListener(EVENT, on); clearTimeout(timer.current); };
  }, []);
  if (!item) return null;
  return (
    <div role="status" aria-live="polite" style={{
      position: "fixed", left: 16, right: 16, zIndex: 90, maxWidth: 688, margin: "0 auto",
      bottom: `calc(${NAV_HEIGHT + 12}px + env(safe-area-inset-bottom))`,
      display: "flex", alignItems: "center", gap: 10, padding: "10px 10px 10px 14px", borderRadius: 16,
      background: nl.deep, color: nl.onDeep, boxShadow: `0 8px 24px ${nl.shadow}`, font: `500 15px ${font.body}`,
    }}>
      <Check size={18} color={nl.accentOnDeep} strokeWidth={2.6} aria-hidden="true" />
      <span style={{ flex: 1, minWidth: 0 }}>{item.message}</span>
      {typeof item.onUndo === "function" && (
        <button type="button" onClick={() => { clearTimeout(timer.current); setItem(null); item.onUndo(); }} style={{
          minHeight: 36, padding: "0 14px", borderRadius: 999, border: "none", cursor: "pointer",
          background: nl.yolk, color: nl.onYolk, font: `700 14px ${font.body}`,
        }}>Undo</button>
      )}
    </div>
  );
}
