// ============================================================================
// WIDGET BRIDGE — feeds the "Today" home-screen widget
// ----------------------------------------------------------------------------
// Widgets can't run the app, so the app leaves them a small snapshot:
//   { v: 1, day: "YYYY-MM-DD", updatedAt, name,
//     eggsToday: number | null,      // null when egg layers are off
//     frost: { lowText, crops } | null,  // tonight, only if tender crops are in
//     tasks: [{ date, title }]       // next calendar items, today → +7 days
//   }
// Native side:
//   iOS     — App/WidgetBridge.swift writes it to the App Group
//             (group.com.henalytics.app) UserDefaults key "today" and reloads
//             WidgetKit timelines; HenalyticsWidget.swift reads it.
//   Android — WidgetBridgePlugin.java writes SharedPreferences
//             "henalytics_widget"/"today" and refreshes TodayWidget.
// The widgets drop eggs/frost for a stale day and filter past tasks, so an
// old snapshot never shows yesterday's numbers as today's.
// ============================================================================

let _plugin = null;
function plugin() {
  if (_plugin) return _plugin;
  try {
    const cap = typeof window !== 'undefined' && window.Capacitor;
    if (cap && cap.isNativePlatform && cap.isNativePlatform() && typeof cap.registerPlugin === 'function') {
      const p = cap.registerPlugin('WidgetBridge');
      if (p) _plugin = p;
    }
  } catch (_) {}
  return _plugin;
}

const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const stripEmoji = (s) => String(s || '').replace(/^\p{Extended_Pictographic}️?\s*/u, '').trim();

// Pure: build the snapshot from app data. `frost` is passed in (the caller
// knows the forecast + crops).
export function buildWidgetSnapshot(data, { now = new Date(), frost = null } = {}) {
  const day = localDay(now);
  const hobbies = (data && data.hobbies) || [];
  const eggsOn = hobbies.some((h) => h && h.type === 'egg_layers' && !h.hidden);
  let eggsToday = null;
  if (eggsOn) {
    const ents = (data.entries && data.entries.egg_layers) || [];
    eggsToday = ents
      .filter((e) => e && e.date === day && (e.action === 'eggs' || e.action === 'eggs_laid'))
      .reduce((s, e) => s + (Number(e.count) || 0), 0);
  }
  const end = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));
  const tasks = ((data && data.calendarEvents) || [])
    .filter((e) => e && e.date && e.date >= day && e.date <= end && !e.done && !e.completed)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, 6)
    .map((e) => ({ date: e.date, title: stripEmoji(e.title).slice(0, 60) || 'Reminder' }));
  return {
    v: 1,
    day,
    updatedAt: now.toISOString(),
    name: String((data && data.homesteadName) || '').slice(0, 40),
    eggsToday,
    frost,
    tasks,
  };
}

let _last = '';
// Send the snapshot to the native widget store. No-op on web; skips writes
// when nothing changed (WidgetKit reloads are budgeted).
export async function pushWidgetSnapshot(snapshot) {
  const p = plugin();
  if (!p || !snapshot) return false;
  const { updatedAt, ...rest } = snapshot;
  const key = JSON.stringify(rest);
  if (key === _last) return false;
  try {
    await p.setToday({ json: JSON.stringify(snapshot) });
    _last = key;
    return true;
  } catch (_) {
    return false; // older native build without the plugin
  }
}
