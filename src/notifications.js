// ============================================================================
// notifications.js — Phase 1: local (on-device) reminders
// ----------------------------------------------------------------------------
// Surfaces the dated reminders Henalytics already writes into
// `data.calendarEvents` ({ id, date: "YYYY-MM-DD", title, notes, ... }) as
// native device notifications, using @capacitor/local-notifications.
//
// This is LOCAL notifications only — scheduled on the device, no server, no
// Firebase/APNs. (Server push for farmhand activity is Phase 2.)
//
// Key constraints baked in here:
//   • iOS allows at most 64 *pending* local notifications per app. We schedule
//     only the nearest MAX_SCHEDULED upcoming events and re-reconcile (cancel +
//     reschedule the window) on app open and whenever events change, so the
//     window rolls forward over time.
//   • Calendar events are day-granular (no clock time), so each fires at a
//     fixed local hour (REMINDER_HOUR). An event whose time has already passed
//     today is nudged a minute out so it still surfaces.
//   • Everything is a no-op on web / when the plugin isn't installed, so the
//     web build and pre-native builds are unaffected.
//
// Native install step (Riley, local): `npm i @capacitor/local-notifications`
// then `npx cap sync`. iOS/Android then need a rebuild + store resubmission.
// ============================================================================

const MAX_SCHEDULED = 52;      // calendar reminders; + 7 daily nudges + 3 frost alerts stays under iOS's 64 cap
const REMINDER_HOUR = 8;       // 8:00 AM local — change here to retune
const ID_BASE = 100000;        // namespace our ids away from any other source

// --- Capacitor access ------------------------------------------------------
const isNativeApp = () => {
  try {
    return !!(typeof window !== "undefined" && window.Capacitor &&
      window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch (_) { return false; }
};

// Resolve the native LocalNotifications plugin SYNCHRONOUSLY and memoize it.
//
// Two things matter here, both learned the hard way:
//   1. window.Capacitor.registerPlugin("LocalNotifications") returns a Proxy
//      bound to the compiled-in native plugin. We must NOT return it from an
//      async function or `await` it: awaiting a value reads its `.then`, and
//      the proxy turns that read into a native call `LocalNotifications.then()`,
//      which doesn't exist → "not implemented on ios". So this accessor is sync
//      and callers use the proxy directly, only awaiting its METHOD calls.
//   2. registerPlugin must be called once. Calling it repeatedly logs
//      "plugin already registered". Hence the memo in `_ln`.
//
// Returns null when not inside the native shell (web/dev), so every public fn
// degrades to a no-op there.
//
// IMPORTANT: we only cache a SUCCESSFUL resolution. An earlier version cached
// null too, so if lnPlugin() ran once before window.Capacitor.registerPlugin
// was ready, it locked in null forever and every later call (including the
// toggle) saw hasLN:false even though the plugin was available by then.
let _ln = null;
function lnPlugin() {
  if (_ln) return _ln;
  try {
    if (typeof window !== "undefined" && window.Capacitor &&
        typeof window.Capacitor.registerPlugin === "function") {
      const p = window.Capacitor.registerPlugin("LocalNotifications");
      if (p) _ln = p;            // cache only on success; retry next time if not
      return _ln;
    }
  } catch (_) { /* not ready / unavailable — leave _ln null and retry later */ }
  return _ln;
}

// Parse a "YYYY-MM-DD" string into a local Date at the given hour. Built from
// numeric parts (not new Date(string)) to avoid UTC-parsing surprises.
function eventFireDate(dateStr, hour) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

// ----------------------------------------------------------------------------
// Capability + permission
// ----------------------------------------------------------------------------

// True only inside the native shell with the plugin available.
export async function areRemindersSupported() {
  if (!isNativeApp()) return false;
  return !!lnPlugin();
}

// Returns the permission state without prompting: 'granted' | 'denied' | 'prompt'.
export async function getReminderPermission() {
  const LN = isNativeApp() ? lnPlugin() : null;
  if (!LN) return "unsupported";
  try {
    const res = await LN.checkPermissions();
    return res?.display || "prompt";
  } catch (_) { return "unsupported"; }
}

// Prompts for permission if needed. Returns true iff granted.
export async function requestReminderPermission() {
  const LN = isNativeApp() ? lnPlugin() : null;
  if (!LN) return false;
  try {
    let res = await LN.checkPermissions();
    if (res?.display !== "granted") {
      res = await LN.requestPermissions();
    }
    return res?.display === "granted";
  } catch (e) {
    console.warn("[reminders] permission request failed", e?.message || e);
    return false;
  }
}

// ----------------------------------------------------------------------------
// Scheduling
// ----------------------------------------------------------------------------

// Cancel every reminder we previously scheduled. Cancels by our id namespace
// only, so it won't touch notifications scheduled by anything else.
export async function cancelAllReminders() {
  const LN = isNativeApp() ? lnPlugin() : null;
  if (!LN) return;
  try {
    const pending = await LN.getPending();
    const ours = (pending?.notifications || []).filter(
      // Fixed 100-id window (not MAX_SCHEDULED) so lowering the cap still
      // cancels ids scheduled by older builds.
      (n) => typeof n.id === "number" && n.id >= ID_BASE && n.id < ID_BASE + 100
    );
    if (ours.length) await LN.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  } catch (e) {
    console.warn("[reminders] cancelAll failed", e?.message || e);
  }
}

// Build the schedule payload from upcoming calendar events. Pure + testable:
// no Capacitor calls, just the date/window/cap logic.
export function buildReminderSchedule(calendarEvents, opts = {}) {
  const hour = typeof opts.hour === "number" ? opts.hour : REMINDER_HOUR;
  const now = opts.now instanceof Date ? opts.now : new Date();
  const max = typeof opts.max === "number" ? opts.max : MAX_SCHEDULED;

  const events = Array.isArray(calendarEvents) ? calendarEvents : [];

  const upcoming = events
    .map((e) => {
      const at = eventFireDate(e.date, hour);
      return at ? { event: e, at } : null;
    })
    .filter(Boolean)
    // Keep anything whose fire-time is still in the future. For an event dated
    // today whose hour already passed, nudge it a minute out so it still fires.
    .map((x) => {
      if (x.at.getTime() <= now.getTime()) {
        const sameDay =
          x.at.getFullYear() === now.getFullYear() &&
          x.at.getMonth() === now.getMonth() &&
          x.at.getDate() === now.getDate();
        if (sameDay) return { ...x, at: new Date(now.getTime() + 60 * 1000) };
        return null; // genuinely in the past — skip
      }
      return x;
    })
    .filter(Boolean)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, max);

  return upcoming.map((x, i) => ({
    id: ID_BASE + i,
    title: x.event.title || "Homestead reminder",
    body: x.event.notes || "",
    schedule: { at: x.at },
    extra: { eventId: x.event.id, type: x.event.type || null },
  }));
}

// Reconcile device notifications to match the current upcoming events: cancel
// our previously-scheduled set, then schedule the fresh window. Safe to call
// often (on app open, on calendarEvents change). No-op on web / when disabled.
export async function reconcileReminders(calendarEvents, opts = {}) {
  const LN = isNativeApp() ? lnPlugin() : null;
  if (!LN) return { scheduled: 0, skipped: "unsupported" };
  // Don't prompt here — only schedule if permission is already granted.
  const perm = await getReminderPermission();
  if (perm !== "granted") return { scheduled: 0, skipped: perm };

  await cancelAllReminders();

  const notifications = buildReminderSchedule(calendarEvents, opts);
  if (notifications.length === 0) return { scheduled: 0 };

  try {
    await LN.schedule({ notifications });
    return { scheduled: notifications.length };
  } catch (e) {
    console.warn("[reminders] schedule failed", e?.message || e);
    return { scheduled: 0, error: e?.message || String(e) };
  }
}

// Optional: route a tapped reminder somewhere useful. `onOpen(extra)` receives
// the { eventId, type } we stashed. Returns an unsubscribe fn (or no-op).
export async function initReminderTapHandling(onOpen) {
  const LN = isNativeApp() ? lnPlugin() : null;
  if (!LN) return () => {};
  try {
    const handle = await LN.addListener("localNotificationActionPerformed", (action) => {
      const extra = action?.notification?.extra || {};
      try { onOpen && onOpen(extra); } catch (_) {}
    });
    return () => { try { handle.remove(); } catch (_) {} };
  } catch (_) {
    return () => {};
  }
}

// ============================================================================
// DAILY NUDGE — "did you log today?"
// ----------------------------------------------------------------------------
// One reminder a day at the user's chosen time, for the next NUDGE_DAYS days.
// If they've already logged something today, today's nudge is skipped (no
// nagging). The window is rebuilt whenever the app opens or entries change,
// so it keeps rolling forward; if someone stops opening the app entirely the
// nudges stop after a week instead of pestering forever.
//
// Settings live on data.dailyNudge = { enabled: true, time: "18:00" }.
// Tapping a nudge opens the app straight to a log form via extra.url
// (the same henalytics:// links the home-screen widget uses).
// ============================================================================
const NUDGE_ID_BASE = 200000;
const NUDGE_DAYS = 7;

// messages: [{ title, body, url }]. Pure + testable.
export function buildNudgeSchedule({ time = "18:00", loggedToday = false, now = new Date(), messages = [] } = {}) {
  const [hh, mm] = String(time || "18:00").split(":").map(Number);
  const hour = Number.isFinite(hh) ? Math.min(23, Math.max(0, hh)) : 18;
  const minute = Number.isFinite(mm) ? Math.min(59, Math.max(0, mm)) : 0;
  const pool = messages.length ? messages : [{ title: "📝 Quick homestead log", body: "Anything happen today? One tap and you're done.", url: "henalytics://log?hobby=any&action=note" }];
  const out = [];
  for (let i = 0; out.length < NUDGE_DAYS && i <= NUDGE_DAYS; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour, minute, 0, 0);
    if (at.getTime() <= now.getTime()) continue;   // today's time already passed
    if (i === 0 && loggedToday) continue;           // already logged today — skip
    const msg = pool[(at.getDate() + at.getMonth()) % pool.length];
    out.push({
      id: NUDGE_ID_BASE + out.length,
      title: msg.title,
      body: msg.body,
      schedule: { at, allowWhileIdle: true },
      extra: { kind: "nudge", url: msg.url || null },
    });
  }
  return out;
}

export async function cancelNudges() {
  const LN = isNativeApp() ? lnPlugin() : null;
  if (!LN) return;
  try {
    const pending = await LN.getPending();
    const ours = (pending?.notifications || []).filter(
      (n) => typeof n.id === "number" && n.id >= NUDGE_ID_BASE && n.id < NUDGE_ID_BASE + 50
    );
    if (ours.length) await LN.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  } catch (e) {
    console.warn("[nudge] cancel failed", e?.message || e);
  }
}

// settings = data.dailyNudge; returns { scheduled } like reconcileReminders.
export async function reconcileNudges(settings, opts = {}) {
  const LN = isNativeApp() ? lnPlugin() : null;
  if (!LN) return { scheduled: 0, skipped: "unsupported" };
  if (!settings || !settings.enabled) { await cancelNudges(); return { scheduled: 0, skipped: "off" }; }
  const perm = await getReminderPermission();
  if (perm !== "granted") return { scheduled: 0, skipped: perm };
  await cancelNudges();
  const notifications = buildNudgeSchedule({ time: settings.time, ...opts });
  if (!notifications.length) return { scheduled: 0 };
  try {
    await LN.schedule({ notifications });
    return { scheduled: notifications.length };
  } catch (e) {
    console.warn("[nudge] schedule failed", e?.message || e);
    return { scheduled: 0, error: e?.message || String(e) };
  }
}

// ============================================================================
// FROST ALERTS — schedule payloads come from frostAlerts.js
// buildFrostSchedule(). Own id range (300000+), so they never collide with
// calendar reminders or nudges. Pass [] to clear.
// ============================================================================
const FROST_ID_BASE = 300000;

export async function reconcileFrostAlerts(notifications = []) {
  const LN = isNativeApp() ? lnPlugin() : null;
  if (!LN) return { scheduled: 0, skipped: "unsupported" };
  try {
    const pending = await LN.getPending();
    const ours = (pending?.notifications || []).filter(
      (n) => typeof n.id === "number" && n.id >= FROST_ID_BASE && n.id < FROST_ID_BASE + 50
    );
    if (ours.length) await LN.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  } catch (e) {
    console.warn("[frost] cancel failed", e?.message || e);
  }
  if (!notifications.length) return { scheduled: 0 };
  const perm = await getReminderPermission();
  if (perm !== "granted") return { scheduled: 0, skipped: perm };
  try {
    await LN.schedule({ notifications });
    return { scheduled: notifications.length };
  } catch (e) {
    console.warn("[frost] schedule failed", e?.message || e);
    return { scheduled: 0, error: e?.message || String(e) };
  }
}
