import { plusDays } from "./dayMath.js";
// ============================================================================
// Feed supply estimate (moved out of HomesteadApp.jsx for 3.0)
// ============================================================================

const pad2 = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };

export const FEED_BURN_WINDOW_DAYS = 21;
export const feedEntryLbs = (e, cupsPerLb) => {
  if (!e || e.action !== "fed") return 0;
  if (e.feedUnit === "cups") {
    const cups = Number(e.feedAmount) || 0;
    return cups / (cupsPerLb > 0 ? cupsPerLb : 4);
  }
  return Number(e.lbs ?? e.feedAmount) || 0;
};
export function computeFeedStatus(hobby, entries) {
  const ft = hobby && hobby.feedTracker;
  if (!ft || !ft.enabled) return null;
  const cupsPerLb = Number(ft.cupsPerLb) > 0 ? Number(ft.cupsPerLb) : 4;
  const warnDays = Number(ft.warnDays) > 0 ? Number(ft.warnDays) : 5;
  const since = Number(ft.startTs) || 0;
  const today = todayStr();
  const toLocalDate = (s) => {
    const p = String(s || "").split("-").map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  };
  const todayDate = toLocalDate(today);
  const windowStart = plusDays(todayDate, -((FEED_BURN_WINDOW_DAYS - 1)));

  let consumedLbs = 0;   // since the last count — drains the on-hand pile
  let windowLbs = 0;     // burn-rate window
  let windowCount = 0;
  let earliestWindowDate = null;
  (entries || []).forEach((e) => {
    if (!e || e.action !== "fed") return;
    const lbs = feedEntryLbs(e, cupsPerLb);
    if (lbs <= 0) return;
    if ((Number(e.created) || 0) >= since) consumedLbs += lbs;
    const d = e.date ? toLocalDate(e.date) : null;
    if (d && d >= windowStart && d <= todayDate) {
      windowLbs += lbs;
      windowCount += 1;
      if (!earliestWindowDate || d < earliestWindowDate) earliestWindowDate = d;
    }
  });

  const remainingLbs = (Number(ft.onHandLbs) || 0) - consumedLbs;
  if (windowCount < 3 || windowLbs <= 0) {
    return { state: "learning", remainingLbs, dailyBurnLbs: 0, daysLeft: null, runOutDate: null, warnDays, cupsPerLb, windowCount };
  }
  const spanDays = Math.max(1, Math.min(FEED_BURN_WINDOW_DAYS, Math.round((todayDate - earliestWindowDate) / 86400000) + 1));
  const dailyBurnLbs = windowLbs / spanDays;
  const daysLeft = remainingLbs > 0 ? remainingLbs / dailyBurnLbs : 0;
  const runOut = plusDays(todayDate, Math.floor(daysLeft));
  const pad = (n) => String(n).padStart(2, "0");
  const runOutDate = `${runOut.getFullYear()}-${pad(runOut.getMonth() + 1)}-${pad(runOut.getDate())}`;
  const state = remainingLbs <= 0 ? "out" : (daysLeft <= warnDays ? "low" : "ok");
  return { state, remainingLbs, dailyBurnLbs, daysLeft, runOutDate, warnDays, cupsPerLb, windowCount };
}
