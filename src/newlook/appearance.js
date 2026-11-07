// ============================================================================
// New look (3.0) — Look & app icon
// ----------------------------------------------------------------------------
// { look: "farmhouse"|"meadow"|"barn", mode: "system"|"light"|"dark", icon }
// is kept on this phone (localStorage), not in the homestead's synced data:
// it's a personal choice, and farmhands sharing a homestead each pick their
// own (Supporter perks belong to the person, too).
// Dark mode and Farmhouse are free for everyone; Meadow, Barn and the extra
// app icons are Supporter perks. If a supporter's membership ends, the app
// quietly goes back to Farmhouse (their pick is kept, so it comes back if
// they rejoin).
//
// Supporter status arrives a moment after launch, so the last answer is kept
// in localStorage to avoid a flash of Farmhouse every time a supporter opens
// the app.
// ============================================================================

import { useEffect, useState } from "react";
import { LOOKS, applyLook } from "./theme.js";

const CACHE = "henalytics_supporter_cache";
const KEY = "henalytics_appearance";
function readPref() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (_) { return {}; }
}

function readCache() {
  try { return localStorage.getItem(CACHE) === "1"; } catch (_) { return false; }
}
function writeCache(v) {
  try { localStorage.setItem(CACHE, v ? "1" : "0"); } catch (_) { /* ignore */ }
}

function systemDark() {
  try { return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); } catch (_) { return false; }
}

export function appearanceOf(raw) {
  const a = raw || {};
  return {
    look: LOOKS[a.look] ? a.look : "farmhouse",
    mode: a.mode === "light" || a.mode === "dark" ? a.mode : "system",
    icon: a.icon || "default",
  };
}

// supporterStatus: "unknown" | "yes" | "no" (definitive answers only).
export function useAppearance({ enabled, isSupporter, supporterStatus }) {
  const [sysDark, setSysDark] = useState(systemDark);
  const [raw, setRaw] = useState(readPref);
  const set = (patch) => setRaw((cur) => {
    const next = { ...cur, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (_) { /* ignore */ }
    return next;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setSysDark(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", on); else if (mq.addListener) mq.addListener(on);
    return () => { if (mq.removeEventListener) mq.removeEventListener("change", on); else if (mq.removeListener) mq.removeListener(on); };
  }, []);

  useEffect(() => {
    if (supporterStatus === "yes") writeCache(true);
    else if (supporterStatus === "no") writeCache(false);
  }, [supporterStatus]);

  const pref = appearanceOf(raw);
  const supporterOk = isSupporter || (supporterStatus === "unknown" && readCache());
  const look = LOOKS[pref.look].supporter && !supporterOk ? "farmhouse" : pref.look;
  const dark = pref.mode === "dark" || (pref.mode === "system" && sysDark);
  // The old design has no dark mode or looks; it always shows its own colors.
  const effLook = enabled ? look : "farmhouse";
  const effDark = enabled ? dark : false;
  // Applied during render, before any child reads nl.*.
  applyLook(effLook, effDark);

  // Status bar text color on the phones.
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        if (!off) await StatusBar.setStyle({ style: effDark ? Style.Dark : Style.Light });
      } catch (_) { /* plugin missing on web */ }
    })();
    return () => { off = true; };
  }, [effDark]);

  return { ...pref, effectiveLook: effLook, dark: effDark, supporterOk, sysDark, set };
}
