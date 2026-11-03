// ============================================================================
// EGG INSIGHTS — "Is my flock okay?"
// ----------------------------------------------------------------------------
// Every fall, laying drops and people worry. Hens need about 14 hours of light
// to lay steadily and slow down below ~12, so most fall and winter drops are
// just daylight (and molting). This compares the last two weeks of logged
// eggs with the flock's best two-week stretch of the past four months and
// explains the change against today's day length at the homestead's latitude.
//
// Day length uses the standard solar declination approximation (accurate to
// a few minutes, no network). Works in either hemisphere: latitude sign does
// the work, and the molt season flips for the south.
// ============================================================================

const DAY = 86400000;

const localIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / DAY);
}

// Hours of daylight (sunrise→sunset, including the usual refraction
// allowance) at latitude `lat` on date `d`.
export function daylightHours(lat, d = new Date()) {
  const rad = Math.PI / 180;
  const n = dayOfYear(d);
  const decl = 23.44 * Math.sin(rad * (360 / 365) * (n - 81));
  const phi = Math.max(-89.5, Math.min(89.5, Number(lat) || 0)) * rad;
  const cosH = (Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(decl * rad)) / (Math.cos(phi) * Math.cos(decl * rad));
  if (cosH <= -1) return 24;
  if (cosH >= 1) return 0;
  return (2 * Math.acos(cosH)) / rad / 15;
}

export function fmtHours(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm === 60 ? `${hh + 1} hr` : `${hh} hr ${mm} min`;
}

// First date after `from` when day length rises above `hours`. null if never
// within a year (polar edge cases).
export function nextDaylightAbove(lat, hours, from = new Date()) {
  let prev = daylightHours(lat, from);
  for (let i = 1; i <= 366; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const h = daylightHours(lat, d);
    if (h >= hours && prev < hours) return d;
    prev = h;
  }
  return null;
}

// Eggs per calendar day for the window [end-days+1 .. end] plus how many of
// those days have any egg log.
function windowStats(byDay, end, days) {
  let sum = 0, logged = 0;
  for (let i = 0; i < days; i++) {
    const key = localIso(new Date(end.getFullYear(), end.getMonth(), end.getDate() - i));
    if (byDay.has(key)) { sum += byDay.get(key); logged++; }
  }
  return { perDay: sum / days, logged };
}

const fmtMonthDay = (d) => d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

// entries: egg_layers entries; lat: homestead latitude.
// Returns { tone: "calm" | "check" | "good", icon, title, body, daylight } or null.
export function eggInsight({ entries = [], lat, now = new Date() } = {}) {
  if (lat == null || Number.isNaN(Number(lat))) return null;
  const byDay = new Map();
  for (const e of entries) {
    if (!e || !e.date || (e.action !== 'eggs' && e.action !== 'eggs_laid')) continue;
    byDay.set(e.date, (byDay.get(e.date) || 0) + (Number(e.count) || 0));
  }
  if (byDay.size < 10) return null;

  // Last 14 complete days (yesterday back), so a half-logged today doesn't skew it.
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const recent = windowStats(byDay, yesterday, 14);
  if (recent.logged < 6) return null; // not logging often enough to judge

  // Best 14-day stretch over the prior ~4 months (needs regular logging too).
  let peak = 0;
  for (let back = 15; back <= 120; back += 3) {
    const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() - back);
    const w = windowStats(byDay, end, 14);
    if (w.logged >= 6 && w.perDay > peak) peak = w.perDay;
  }
  if (peak <= 0) return null;

  const daylight = daylightHours(lat, now);
  const weekAgo = daylightHours(lat, new Date(now.getTime() - 7 * DAY));
  const lengthening = daylight > weekAgo;
  const drop = 1 - recent.perDay / peak;
  const pct = Math.round(drop * 100);
  const south = Number(lat) < 0;
  const m = now.getMonth();
  const moltSeason = south ? (m >= 1 && m <= 4) : (m >= 7 && m <= 10);
  const dl = fmtHours(daylight);
  const perDay = recent.perDay >= 10 ? Math.round(recent.perDay) : Math.round(recent.perDay * 10) / 10;

  if (drop >= 0.25 && daylight < 13) {
    // Most flocks start recovering once days pass ~11 hours (early-mid
    // February at mid-northern latitudes) and are back to full speed by spring.
    const back = daylight >= 11 ? null : nextDaylightAbove(lat, 11, now);
    const when = lengthening
      ? (back ? `Days are getting longer again; laying usually starts picking up around ${fmtMonthDay(back)}, when days pass 11 hours.` : 'Days are getting longer again, so laying should pick up soon.')
      : (back ? `After the solstice days start getting longer; most flocks start picking back up around ${fmtMonthDay(back)}, when days pass 11 hours.` : 'It usually picks back up as the days get longer after the solstice.');
    return {
      tone: 'calm', icon: '🌅', daylight,
      title: `Laying is down ${pct}%, and that's normal right now`,
      body: `Hens need about 14 hours of light to lay steadily, and you're getting ${dl}. ${when}${moltSeason ? ' Fall is molting season too: loose feathers and a pause of 8 to 12 weeks are normal.' : ''}`.trim(),
    };
  }
  if (drop >= 0.5 && daylight >= 13) {
    return {
      tone: 'check', icon: '🔎', daylight,
      title: `Laying is down ${pct}%, but days are still long`,
      body: `With ${dl} of daylight it's probably not the season. Common causes: molting, heat, a hidden nest or broody hen, stress from a predator, or running short on water or layer feed. Worth a look around the coop.`,
    };
  }
  if (drop <= 0.1 && daylight < 12) {
    return {
      tone: 'good', icon: '🎉', daylight,
      title: `Holding steady at ${perDay} eggs a day`,
      body: `That's impressive with only ${dl} of daylight. Most flocks slow down below 12 hours.`,
    };
  }
  if (lengthening && daylight < 13.5 && recent.perDay > peak * 0.75 && drop > 0.1) {
    return {
      tone: 'good', icon: '🌱', daylight,
      title: 'Laying is coming back',
      body: `You're at ${perDay} eggs a day and days are getting longer (${dl} today). It usually keeps climbing into spring.`,
    };
  }
  return null;
}
