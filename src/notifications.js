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

const MAX_SCHEDULED = 60;      // headroom under the iOS hard cap of 64
const REMINDER_HOUR = 8;       // 8:00 AM local — change here to retune
const ID_BASE = 100000;        // namespace our ids away from any other source

// --- Capacitor access (mirrors HomesteadApp's loadCapacitor indirection so
//     Vite/Rollup don't try to statically resolve the plugin at build time) ---
const isNativeApp = () => {
  try {
    return !!(typeof window !== "undefined" && window.Capacitor &&
      window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch (_) { return false; }
};

const loadPlugin = (pkg) => {
  const spec = /* @vite-ignore */ pkg;
  return import(/* @vite-ignore */ spec);
};

async function getLN() {
  const mod = await loadPlugin("@capacitor/local-notifications");
  return mod.LocalNotifications;
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
  try { await getLN(); return true; } catch (_) { return false; }
}

// Returns the permission state without prompting: 'granted' | 'denied' | 'prompt'.
export async function getReminderPermission() {
  if (!(await areRemindersSupported())) return "unsupported";
  try {
    const LN = await getLN();
    const res = await LN.checkPermissions();
    return res?.display || "prompt";
  } catch (_) { return "unsupported"; }
}

// Prompts for permission if needed. Returns true iff granted.
export async function requestReminderPermission() {
  if (!(await areRemindersSupported())) return false;
  try {
    const LN = await getLN();
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
  if (!(await areRemindersSupported())) return;
  try {
    const LN = await getLN();
    const pending = await LN.getPending();
    const ours = (pending?.notifications || []).filter(
      (n) => typeof n.id === "number" && n.id >= ID_BASE && n.id < ID_BASE + MAX_SCHEDULED + 5
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
  if (!(await areRemindersSupported())) return { scheduled: 0, skipped: "unsupported" };
  // Don't prompt here — only schedule if permission is already granted.
  const perm = await getReminderPermission();
  if (perm !== "granted") return { scheduled: 0, skipped: perm };

  await cancelAllReminders();

  const notifications = buildReminderSchedule(calendarEvents, opts);
  if (notifications.length === 0) return { scheduled: 0 };

  try {
    const LN = await getLN();
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
  if (!(await areRemindersSupported())) return () => {};
  try {
    const LN = await getLN();
    const handle = await LN.addListener("localNotificationActionPerformed", (action) => {
      const extra = action?.notification?.extra || {};
      try { onOpen && onOpen(extra); } catch (_) {}
    });
    return () => { try { handle.remove(); } catch (_) {} };
  } catch (_) {
    return () => {};
  }
}
