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
    // For Siri's "log a feeding", "log milk" and "log a harvest" (3.0).
    animals: voiceAnimals(data),
    garden: hobbies.some((h) => h && h.type === 'garden' && !h.hidden),
  };
}

// Animal hobbies Siri can log a feeding (and, for dairy, milk) for.
const FEED_TYPES = ['egg_layers', 'meat_chickens', 'rabbits', 'goats', 'cows', 'pigs', 'sheep', 'horses'];
const MILK_TYPES = ['goats', 'cows', 'sheep'];
export function voiceAnimals(data) {
  return ((data && data.hobbies) || [])
    .filter((h) => h && !h.hidden && FEED_TYPES.includes(h.type))
    .map((h) => ({
      id: String(h.id),
      name: String(stripEmoji(h.name || h.type) || h.type).slice(0, 30),
      type: h.type,
      milk: MILK_TYPES.includes(h.type) && !(h.type === 'sheep' && h.subType && h.subType !== 'milk' && h.subType !== 'mixed'),
    }));
}

// Siri logs other than eggs wait in the App Group (key "voiceLogs") as
// [{ id, kind: "feed"|"harvest"|"milk", date, hobbyId?, lbs?, crop?, oz? }].
export async function takeVoiceLogs() {
  const p = plugin();
  if (!p || typeof p.takeVoiceLogs !== 'function') return [];
  try {
    const r = await p.takeVoiceLogs();
    const list = r && r.json ? JSON.parse(r.json) : [];
    return Array.isArray(list) ? list : [];
  } catch (_) {
    return [];
  }
}

// Pure: turn queued Siri logs into the same records the app's forms save.
// Mutates and returns { d, changed, done: [labels] }. Unknown hobbies, bad
// numbers and repeats (same id already saved) are dropped.
export function applyVoiceLogs(d, logs, today) {
  const done = [];
  let changed = false;
  if (!d || !Array.isArray(logs)) return { d, changed, done };
  d.entries = d.entries || {};
  const seen = new Set();
  for (const arr of Object.values(d.entries)) for (const e of Array.isArray(arr) ? arr : []) if (e && e.voiceId) seen.add(e.voiceId);
  for (const l of logs) {
    if (!l || !l.id || seen.has(l.id)) continue;
    seen.add(l.id);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(l.date || '') && l.date <= today ? l.date : today;
    const base = { id: Math.random().toString(36).slice(2, 10), date, voiceId: l.id, source: 'siri', created: Date.now() };
    if (l.kind === 'harvest') {
      const g = (d.hobbies || []).find((h) => h && h.type === 'garden');
      const qty = Number(l.lbs);
      const crop = String(l.crop || '').trim().slice(0, 60);
      if (!g || !(qty > 0) || !crop) continue;
      const plant = crop.replace(/^./, (c) => c.toUpperCase());
      const season = g.currentSeason;
      d.entries.garden = [...(d.entries.garden || []), { ...base, action: 'harvested', plant, quantity: Math.round(qty * 100) / 100, unit: 'lbs', seasonId: season && (!season.startDate || date >= season.startDate) ? season.id : null, notes: '' }];
      done.push(`${plant}`);
      changed = true;
      continue;
    }
    const h = (d.hobbies || []).find((x) => x && String(x.id) === String(l.hobbyId));
    if (!h) continue;
    const list = d.entries[h.id] || [];
    if (l.kind === 'feed') {
      const lbs = Number(l.lbs) || 0;
      d.entries[h.id] = [...list, { ...base, action: 'fed', lbs: lbs > 0 ? Math.round(lbs * 100) / 100 : 0, cost: 0, notes: '', herdWide: true, animalIds: [], animalId: null }];
      done.push(`feeding`);
      changed = true;
    } else if (l.kind === 'milk' && MILK_TYPES.includes(h.type)) {
      const oz = Number(l.oz);
      if (!(oz > 0) || oz > 4000) continue;
      const rec = { ...base, action: 'milk', animalId: null, animalName: '', oz: Math.round(oz * 10) / 10, notes: '' };
      if (h.type === 'cows') rec.gallons = Math.round((oz / 128) * 100) / 100;
      d.entries[h.id] = [...list, rec];
      done.push('milk');
      changed = true;
    }
  }
  return { d, changed, done };
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

// iOS: a Siri voice log ("log eggs in Henalytics", ios/App/App/VoiceIntents.swift)
// adds to the same tally while the app may already be open. The native side
// fires "tallyChanged" so we can take it right away. Returns an unsubscribe fn.
export function onWidgetTallyChanged(cb) {
  const p = plugin();
  if (!p || typeof p.addListener !== 'function' || typeof cb !== 'function') return () => {};
  let handle = null;
  let removed = false;
  try {
    Promise.resolve(p.addListener('tallyChanged', () => cb())).then((h) => {
      handle = h;
      if (removed && h && typeof h.remove === 'function') h.remove();
    }).catch(() => {});
  } catch (_) {}
  return () => {
    removed = true;
    try { if (handle && typeof handle.remove === 'function') handle.remove(); } catch (_) {}
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
