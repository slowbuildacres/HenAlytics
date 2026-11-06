// ============================================================================
// This month's running costs covered by supporters
// ----------------------------------------------------------------------------
// Reads /api/support-progress (public totals: goal, covered, percent,
// supporters) for the heart button on Home and the bar on the Support page.
// The last answer is kept on the phone so the button shows right away and
// offline; it's only a hint, so a missing or stale copy is fine.
// ============================================================================
import { useEffect, useState } from "react";
import { apiUrl } from "../apiBase.js";

const KEY = "henalytics_support_progress";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function readCache() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && typeof v.percent === "number" ? v : null; } catch (_) { return null; }
}

let inflight = null;
let lastFetch = 0;
export function fetchSupportProgress() {
  // At most once every 10 minutes per launch; the server caches too.
  if (inflight) return inflight;
  if (Date.now() - lastFetch < 10 * 60 * 1000) return Promise.resolve(readCache());
  inflight = fetch(apiUrl("/api/support-progress"))
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      lastFetch = Date.now();
      if (j && typeof j.percent === "number") { try { localStorage.setItem(KEY, JSON.stringify(j)); } catch (_) {} return j; }
      return readCache();
    })
    .catch(() => readCache())
    .finally(() => { inflight = null; });
  return inflight;
}

// The month a progress answer is for, as a name ("November"). A cached
// answer from an earlier month is dropped rather than shown as this month.
export function progressMonthName(p, today = new Date()) {
  if (!p || !p.month) return null;
  const [y, m] = String(p.month).split("-").map(Number);
  if (y !== today.getFullYear() || m !== today.getMonth() + 1) return null;
  return MONTHS[m - 1];
}

export function useSupportProgress() {
  const [p, setP] = useState(() => { const c = readCache(); return progressMonthName(c) ? c : null; });
  useEffect(() => {
    let live = true;
    fetchSupportProgress().then((j) => { if (live && j && progressMonthName(j)) setP(j); });
    return () => { live = false; };
  }, []);
  return p;
}
