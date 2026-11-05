// ============================================================================
// WIDGET BRIDGE — feeds the "Today" home-screen widget
// ----------------------------------------------------------------------------
// Widgets can't run the app, so the app leaves them a small snapshot:
//   { v: 1, day: "YYYY-MM-DD", updatedAt, name,
//     eggsToday: number | null,      // null when egg layers are off
//     frost: { lowText, crops } | null,  // tonight, only if tender crops are in
//     tasks: [{ date, title }],      // next calendar items, today → +7 days
//     flocks: [{ id, name, emoji, basket, logged }]  // egg tally widget
//   }
// Egg tally widget: tapping + / − on the widget adds to a per-flock, per-day
// tally the widget keeps in the same native store (key "eggTally",
// { flockId: { "YYYY-MM-DD": n } }). The app takes it with takeWidgetTally()
// on launch/resume and folds it into the flock's egg basket with
// applyWidgetTally(), so it saves to that day exactly like the in-app counter
// (today's basket; past days become eggs_laid entries on their own date).
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

const BIRD_EMOJI = { Chicken: '🐔', Duck: '🦆', Turkey: '🦃', Quail: '🐦', Goose: '🪿', Guinea: '🐦', Peafowl: '🦚', Other: '🐣' };

// Every visible egg-layer flock, for the egg tally widget's flock picker.
export function widgetFlocks(data, day) {
  const out = [];
  for (const h of (data && data.hobbies) || []) {
    if (!h || h.type !== 'egg_layers' || h.hidden) continue;
    const ents = (data.entries && data.entries[h.id]) || [];
    for (const fl of h.flocks || []) {
      if (!fl || !fl.id || fl.archived) continue;
      const b = fl.eggBasket;
      out.push({
        id: String(fl.id),
        name: String(fl.name || 'Flock').slice(0, 30),
        emoji: BIRD_EMOJI[fl.birdType] || '🐔',
        basket: b && b.date === day ? Math.max(0, Number(b.count) || 0) : 0,
        logged: ents
          .filter((e) => e && e.flockId === fl.id && e.date === day && (e.action === 'eggs' || e.action === 'eggs_laid'))
          .reduce((n, e) => n + (Number(e.count) || 0), 0),
      });
    }
  }
  return out.slice(0, 20);
}

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
    flocks: eggsOn ? widgetFlocks(data, day) : [],
  };
}

// Pure: fold a widget tally ({ flockId: { day: n } }) into app data `d`
// (mutates and returns it). Today → the flock's egg basket (an older basket
// is committed first, like the stale-basket sweep). Past days → added to a
// basket on that day, else an eggs_laid entry on that day. Unknown flocks
// and non-positive totals are dropped. Returns { d, changed }.
export function applyWidgetTally(d, tally, today) {
  let changed = false;
  if (!d || !tally || typeof tally !== 'object') return { d, changed };
  const newId = () => Math.random().toString(36).slice(2, 10);
  for (const [flockId, days] of Object.entries(tally)) {
    if (!days || typeof days !== 'object') continue;
    let hobby = null, fl = null;
    for (const h of d.hobbies || []) {
      if (!h || h.type !== 'egg_layers') continue;
      const f = (h.flocks || []).find((x) => x && String(x.id) === String(flockId));
      if (f) { hobby = h; fl = f; break; }
    }
    if (!fl) continue;
    const push = (date, count) => {
      if (!(count > 0)) return;
      d.entries = d.entries || {};
      d.entries[hobby.id] = d.entries[hobby.id] || [];
      d.entries[hobby.id].push({
        id: newId(), date, action: 'eggs_laid', count, flockId: fl.id, birdType: fl.birdType,
        autoCommitted: true, source: 'widget', created: Date.now(),
      });
      changed = true;
    };
    for (const [rawDay, rawN] of Object.entries(days).sort(([a], [b]) => (a < b ? -1 : 1))) {
      const n = Math.round(Number(rawN) || 0);
      if (!n || !/^\d{4}-\d{2}-\d{2}$/.test(rawDay)) continue;
      const day = rawDay > today ? today : rawDay; // clock skew → today
      const b = fl.eggBasket;
      if (b && b.date === day) {
        const next = Math.max(0, (Number(b.count) || 0) + n);
        fl.eggBasket = next > 0 ? { date: day, count: next } : null;
        changed = true;
      } else if (day === today) {
        if (b && b.date && b.date < today) push(b.date, Number(b.count) || 0);
        fl.eggBasket = n > 0 ? { date: today, count: n } : null;
        changed = true;
      } else {
        push(day, n);
      }
    }
  }
  return { d, changed };
}

// Take (read and clear) the widget's pending egg tally. Returns null on web
// or older native builds.
export async function takeWidgetTally() {
  const p = plugin();
  if (!p || typeof p.takeTally !== 'function') return null;
  try {
    const r = await p.takeTally();
    if (!r || !r.json) return null;
    const t = JSON.parse(r.json);
    return t && typeof t === 'object' ? t : null;
  } catch (_) {
    return null;
  }
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
