// ============================================================================
// WEATHER MODULE
// ----------------------------------------------------------------------------
// Fetches daily weather (high, low, precipitation) for a given location and
// date. Default source is Open-Meteo's high-resolution forecast models (free,
// no key). Users can connect their own station (Weather Underground PWS or
// Ambient Weather) or turn auto-weather off and enter it by hand.
//
// Open-Meteo Historical API:
//   https://open-meteo.com/en/docs/historical-weather-api
//
// Cache results in localStorage keyed by `${date}-${lat.toFixed(2)}-${lon.toFixed(2)}`
// so we don't refetch the same day's weather repeatedly. Today's weather might
// not be final until end-of-day; we use the "forecast" endpoint for today and
// "archive" for past dates.
// ============================================================================

const CACHE_KEY_PREFIX = 'henalytics_weather_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Prune expired weather cache keys. Runs once per session (called lazily on
// first cache write below). localStorage is capped at ~5MB; without pruning,
// a long-running user accumulates thousands of stale keys until writes fail
// silently.
let _prunedThisSession = false;
function pruneWeatherCache() {
  if (_prunedThisSession) return;
  _prunedThisSession = true;
  try {
    const now = Date.now();
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(CACHE_KEY_PREFIX)) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!parsed.t || now - parsed.t > CACHE_TTL_MS) {
          toRemove.push(key);
        }
      } catch (_) {
        // Corrupt entry — just drop it
        toRemove.push(key);
      }
    }
    toRemove.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
  } catch (_) {}
}

function cacheKey(date, lat, lon, tag = 'model') {
  return `${CACHE_KEY_PREFIX}${tag}_${date}-${lat.toFixed(2)}-${lon.toFixed(2)}`;
}

function readCache(date, lat, lon, tag) {
  try {
    const raw = localStorage.getItem(cacheKey(date, lat, lon, tag));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.t && Date.now() - parsed.t < CACHE_TTL_MS) {
      return parsed.data;
    }
  } catch (e) {}
  return null;
}

function writeCache(date, lat, lon, data, tag) {
  pruneWeatherCache();
  try {
    localStorage.setItem(
      cacheKey(date, lat, lon, tag),
      JSON.stringify({ t: Date.now(), data })
    );
  } catch (e) {}
}

// BUGFIX: this used toISOString(), which is the UTC date. In US time zones
// that rolls over to "tomorrow" in the evening (6–7pm Central), so evening
// logs asked for the wrong day. Local calendar date now.
function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function daysBetween(a, b) {
  // a, b are YYYY-MM-DD; whole local days from a to b.
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

// Convert Open-Meteo's metric values to user-facing imperial.
// Returns null if the API didn't return usable values.
function shapeWeather(rawDaily, idx, source = 'model') {
  const tmaxC = rawDaily.temperature_2m_max && rawDaily.temperature_2m_max[idx];
  const tminC = rawDaily.temperature_2m_min && rawDaily.temperature_2m_min[idx];
  const precipMm = rawDaily.precipitation_sum && rawDaily.precipitation_sum[idx];

  if (tmaxC == null && tminC == null && precipMm == null) return null;

  const cToF = (c) => (c == null ? null : Math.round(c * 9 / 5 + 32));
  const mmToIn = (mm) => (mm == null ? null : Math.round(mm * 0.0393701 * 100) / 100);

  return {
    highF: cToF(tmaxC),
    lowF: cToF(tminC),
    precipIn: mmToIn(precipMm),
    source,
    fetchedAt: new Date().toISOString(),
  };
}

const DAILY_VARS = 'temperature_2m_max,temperature_2m_min,precipitation_sum';

// ACCURACY: the old code used the ERA5 "archive" reanalysis for anything older
// than a week. ERA5 is a ~25 km grid — it averages your yard with everything
// around it, which flattens hot afternoons and cold, clear frost nights (the
// exact days people care about). Now:
//   • last 92 days  → forecast API (high-res local models, ~1–3 km in the US)
//   • older         → historical-forecast API (same models, archived)
//   • fallback      → ERA5 archive, only if the above have nothing
function modelUrls(dateStr, lat, lon) {
  const today = todayStr();
  const dayDiff = daysBetween(dateStr, today);
  const urls = [];
  if (dayDiff < 0) return urls; // future
  if (dayDiff <= 92) {
    urls.push(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=${DAILY_VARS}&timezone=auto&past_days=${Math.max(1, dayDiff)}&forecast_days=1`);
  }
  urls.push(`https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${dateStr}&end_date=${dateStr}&daily=${DAILY_VARS}&timezone=auto`);
  urls.push(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dateStr}&end_date=${dateStr}&daily=${DAILY_VARS}&timezone=auto`);
  return urls;
}

async function fetchModelDay(dateStr, lat, lon) {
  for (const url of modelUrls(dateStr, lat, lon)) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      if (!json.daily || !json.daily.time) continue;
      const idx = json.daily.time.indexOf(dateStr);
      if (idx === -1) continue;
      const shaped = shapeWeather(json.daily, idx, 'model');
      if (shaped && (shaped.highF != null || shaped.lowF != null)) return shaped;
    } catch (e) {
      // try the next source
    }
  }
  return null;
}

// ============================================================================
// PERSONAL WEATHER STATION
// ----------------------------------------------------------------------------
// settings.station = {
//   provider: "wu"       → Weather Underground PWS (stationId + apiKey)
//            "ambient"  → Ambient Weather (macAddress + apiKey + applicationKey)
// }
// Both are the owner's own keys, stored only in their homestead data. Any
// station that uploads to Weather Underground (Ecowitt, Davis, AcuRite,
// Tempest via WU upload, etc.) works through the "wu" provider.
// Returns the same shape as the model, with source "station", or null.
// ============================================================================
function ymdCompact(dateStr) { return dateStr.replace(/-/g, ''); }

async function fetchWundergroundDay(dateStr, st) {
  if (!st.stationId || !st.apiKey) return null;
  const base = 'https://api.weather.com/v2/pws';
  const q = `stationId=${encodeURIComponent(st.stationId)}&format=json&units=e&numericPrecision=decimal&apiKey=${encodeURIComponent(st.apiKey)}`;
  const isToday = dateStr === todayStr();
  const url = isToday
    ? `${base}/observations/all/1day?${q}`
    : `${base}/history/daily?${q}&date=${ymdCompact(dateStr)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const obs = (json && json.observations) || [];
  if (!obs.length) return null;
  let hi = null, lo = null, rain = null;
  obs.forEach((o) => {
    const im = o.imperial || {};
    const h = im.tempHigh != null ? im.tempHigh : im.temp;
    const l = im.tempLow != null ? im.tempLow : im.temp;
    if (h != null && (hi == null || h > hi)) hi = h;
    if (l != null && (lo == null || l < lo)) lo = l;
    if (im.precipTotal != null && (rain == null || im.precipTotal > rain)) rain = im.precipTotal;
  });
  if (hi == null && lo == null) return null;
  return {
    highF: hi != null ? Math.round(hi) : null,
    lowF: lo != null ? Math.round(lo) : null,
    precipIn: rain != null ? Math.round(rain * 100) / 100 : null,
    source: 'station',
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchAmbientDay(dateStr, st) {
  if (!st.macAddress || !st.apiKey || !st.applicationKey) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayStart = new Date(y, m - 1, d, 0, 0, 0).getTime();
  const dayEnd = new Date(y, m - 1, d, 23, 59, 59).getTime();
  const url = `https://rt.ambientweather.net/v1/devices/${encodeURIComponent(st.macAddress)}`
    + `?apiKey=${encodeURIComponent(st.apiKey)}&applicationKey=${encodeURIComponent(st.applicationKey)}`
    + `&endDate=${Math.min(dayEnd, Date.now())}&limit=288`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const rows = await res.json();
  if (!Array.isArray(rows)) return null;
  let hi = null, lo = null, rain = null;
  rows.forEach((r) => {
    const t = r.dateutc != null ? r.dateutc : Date.parse(r.date);
    if (!(t >= dayStart && t <= dayEnd)) return;
    if (r.tempf != null) {
      if (hi == null || r.tempf > hi) hi = r.tempf;
      if (lo == null || r.tempf < lo) lo = r.tempf;
    }
    if (r.dailyrainin != null && (rain == null || r.dailyrainin > rain)) rain = r.dailyrainin;
  });
  if (hi == null && lo == null) return null;
  return {
    highF: Math.round(hi), lowF: Math.round(lo),
    precipIn: rain != null ? Math.round(rain * 100) / 100 : null,
    source: 'station',
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchStationDay(dateStr, station) {
  if (!station || !station.provider) return null;
  try {
    if (station.provider === 'wu') return await fetchWundergroundDay(dateStr, station);
    if (station.provider === 'ambient') return await fetchAmbientDay(dateStr, station);
  } catch (e) {
    console.warn('Station weather fetch failed', e);
  }
  return null;
}

// Public: quick check used by the "Test connection" button in settings.
// Returns { ok: true, sample } or { ok: false, message }.
export async function testStation(station) {
  if (!station || !station.provider) return { ok: false, message: 'Pick a station type first.' };
  try {
    const sample = await fetchStationDay(todayStr(), station);
    if (sample) return { ok: true, sample };
    return { ok: false, message: 'Connected, but no readings came back for today. Double-check the station ID and keys.' };
  } catch (e) {
    return { ok: false, message: e.message || 'Could not reach the station.' };
  }
}

// Public: fetch weather for a single date and location.
// settings (optional) = data.weatherSettings:
//   { source: "auto" | "station" | "off", station: {...} }
//   • auto    — local forecast models (default)
//   • station — your own station first, models as backup
//   • off     — never auto-attach (you enter it yourself, or skip it)
// Returns { highF, lowF, precipIn, source, fetchedAt } or null.
export async function getDailyWeather(dateStr, lat, lon, settings) {
  if (!dateStr) return null;
  const mode = (settings && settings.source) || 'auto';
  if (mode === 'off') return null;
  if (daysBetween(dateStr, todayStr()) < 0) return null; // future date

  if (mode === 'station' && settings.station && settings.station.provider) {
    const tag = `st_${settings.station.provider}_${settings.station.stationId || settings.station.macAddress || ''}`;
    const isToday = dateStr === todayStr();
    // Don't cache today's station reading — the day isn't over yet.
    const cachedSt = !isToday && lat != null && lon != null ? readCache(dateStr, lat, lon, tag) : null;
    if (cachedSt) return cachedSt;
    const st = await fetchStationDay(dateStr, settings.station);
    if (st) {
      if (!isToday && lat != null && lon != null) writeCache(dateStr, lat, lon, st, tag);
      return st;
    }
    // fall through to the model if the station had nothing
  }

  if (lat == null || lon == null) return null;
  const isToday = dateStr === todayStr();
  const cached = isToday ? null : readCache(dateStr, lat, lon, 'model');
  if (cached) return cached;
  const shaped = await fetchModelDay(dateStr, lat, lon);
  if (shaped && !isToday) writeCache(dateStr, lat, lon, shaped, 'model');
  return shaped;
}

// ============================================================================
// WHOLE-YEAR SUMMARY — real hottest/coldest day, total rain, frost dates
// ----------------------------------------------------------------------------
// Year in Review used to compute "hottest day" only from days you happened to
// log something, so a 95° day you didn't log never counted. This pulls every
// day of the year in one call. Cached 12h.
// Returns {
//   hottestDay: { date, highF }, coldestDay: { date, lowF }, totalRainIn,
//   lastSpringFrost: "YYYY-MM-DD" | null,   // last ≤32°F night before July 1
//   firstFallFrost:  "YYYY-MM-DD" | null,   // first ≤32°F night from July 1
//   days, throughDate,
// } or null.
// (Northern-hemisphere frost logic; southern callers can ignore frost fields.)
// ============================================================================
const YEAR_CACHE_PREFIX = 'henalytics_wyear_';
const YEAR_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

export async function getYearWeather(lat, lon, year) {
  if (lat == null || lon == null || !year) return null;
  const key = `${YEAR_CACHE_PREFIX}${year}-${lat.toFixed(2)}-${lon.toFixed(2)}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const p = JSON.parse(raw);
      if (p.t && Date.now() - p.t < YEAR_CACHE_TTL_MS) return p.data;
    }
  } catch (e) {}

  const today = todayStr();
  const start = `${year}-01-01`;
  if (daysBetween(start, today) < 0) return null;
  const endFull = `${year}-12-31`;
  const end = daysBetween(endFull, today) >= 0 ? endFull : today;

  // Pull the year from the historical-forecast archive, then patch the last
  // 92 days from the live forecast API (the archive can lag a few days).
  const merged = {}; // date -> { tmax, tmin, p }
  const absorb = (json) => {
    const dly = json && json.daily;
    if (!dly || !Array.isArray(dly.time)) return;
    dly.time.forEach((t, i) => {
      if (t < start || t > end) return;
      const tmax = dly.temperature_2m_max ? dly.temperature_2m_max[i] : null;
      const tmin = dly.temperature_2m_min ? dly.temperature_2m_min[i] : null;
      if (tmax == null && tmin == null) return;
      merged[t] = { tmax, tmin, p: dly.precipitation_sum ? dly.precipitation_sum[i] : null };
    });
  };
  const sources = [
    `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&daily=${DAILY_VARS}&timezone=auto`,
  ];
  if (end === today || daysBetween(end, today) <= 92) {
    sources.push(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=${DAILY_VARS}&timezone=auto&past_days=92&forecast_days=1`);
  }
  for (const url of sources) {
    try {
      const res = await fetch(url);
      if (res.ok) absorb(await res.json());
    } catch (e) {}
  }
  if (Object.keys(merged).length === 0) {
    try {
      const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&daily=${DAILY_VARS}&timezone=auto`);
      if (res.ok) absorb(await res.json());
    } catch (e) {}
  }
  const dates = Object.keys(merged).sort();
  if (!dates.length) return null;

  const cToF = (c) => Math.round(c * 9 / 5 + 32);
  let hottestDay = null, coldestDay = null, mm = 0;
  let lastSpringFrost = null, firstFallFrost = null;
  const midYear = `${year}-07-01`;
  dates.forEach((d) => {
    const r = merged[d];
    if (r.tmax != null) {
      const hf = cToF(r.tmax);
      if (!hottestDay || hf > hottestDay.highF) hottestDay = { date: d, highF: hf };
    }
    if (r.tmin != null) {
      const lf = cToF(r.tmin);
      if (!coldestDay || lf < coldestDay.lowF) coldestDay = { date: d, lowF: lf };
      if (lf <= 32) {
        if (d < midYear) lastSpringFrost = d;
        else if (!firstFallFrost) firstFallFrost = d;
      }
    }
    if (typeof r.p === 'number' && !Number.isNaN(r.p)) mm += r.p;
  });
  const result = {
    hottestDay, coldestDay,
    totalRainIn: Math.round(mm * 0.0393701 * 10) / 10,
    lastSpringFrost, firstFallFrost,
    days: dates.length, throughDate: dates[dates.length - 1],
  };
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), data: result })); } catch (e) {}
  return result;
}

// Public: ask the browser for the user's current location.
// Returns { lat, lon } or throws an error if denied.
export function requestBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser doesn't support location detection."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      }),
      (err) => {
        if (err.code === 1) reject(new Error("Location permission denied."));
        else if (err.code === 2) reject(new Error("Could not determine location."));
        else if (err.code === 3) reject(new Error("Location request timed out."));
        else reject(new Error(err.message || "Location lookup failed."));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 24 * 60 * 60 * 1000 }
    );
  });
}

// Public: reverse-geocode a lat/lon into a friendly city name using
// Open-Meteo's free reverse geocoding API.
// Returns { label, countryCode } or null on failure.
// (Previously returned just the label string; now wrapped in an object so
// callers can auto-pick the user's hardiness system from their country.)
export async function reverseGeocode(lat, lon) {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.results && json.results[0];
    if (!result) return null;
    const parts = [result.name, result.admin1].filter(Boolean);
    const label = parts.join(', ') || null;
    return {
      label,
      countryCode: result.country_code || null,
    };
  } catch (e) {
    return null;
  }
}

// Public: forward-geocode a city name to lat/lon. For users who'd rather type
// their location than share device GPS.
// Returns { lat, lon, label, countryCode } or null.
export async function geocodePlace(query) {
  if (!query || !query.trim()) return null;
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.results && json.results[0];
    if (!result) return null;
    const parts = [result.name, result.admin1, result.country_code].filter(Boolean);
    return {
      lat: result.latitude,
      lon: result.longitude,
      label: parts.join(', '),
      countryCode: result.country_code || null,
    };
  } catch (e) {
    return null;
  }
}

// Public: pretty-format weather for inline display.
// e.g., { highF: 72, precipIn: 0.34 } -> "72°F, 0.34" rain"
export function formatWeather(w) {
  if (!w) return null;
  const bits = [];
  if (w.highF != null && w.lowF != null) bits.push(`${w.highF}°/${w.lowF}°F`);
  else if (w.highF != null) bits.push(`${w.highF}°F`);
  if (w.precipIn != null) {
    if (w.precipIn === 0) bits.push("no rain");
    else bits.push(`${w.precipIn}" rain`);
  }
  return bits.length ? bits.join(' · ') : null;
}

// ============================================================================
// FORECAST (next 2 days) — used by the freeze warning banner
// ----------------------------------------------------------------------------
// Calls Open-Meteo's forecast endpoint asking for today + tomorrow. We cache
// the result for 2 hours (forecasts update slowly; no need to hammer the API
// on every page render). The cache is separate from the daily-weather cache
// since this returns a different shape.
//
// Returns:
//   {
//     today: { lowF, highF, date: "YYYY-MM-DD" },
//     tomorrow: { lowF, highF, date: "YYYY-MM-DD" },
//   }
// or null if anything goes wrong (offline, API down, missing data, etc.).
// Callers should treat null as "no data available — don't show a warning."
// ============================================================================

const FORECAST_CACHE_KEY_PREFIX = 'henalytics_forecast_';
const FORECAST_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function forecastCacheKey(lat, lon) {
  return `${FORECAST_CACHE_KEY_PREFIX}${lat.toFixed(2)}-${lon.toFixed(2)}`;
}

function readForecastCache(lat, lon) {
  try {
    const raw = localStorage.getItem(forecastCacheKey(lat, lon));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.t && Date.now() - parsed.t < FORECAST_CACHE_TTL_MS) {
      return parsed.data;
    }
  } catch (e) {}
  return null;
}

function writeForecastCache(lat, lon, data) {
  try {
    localStorage.setItem(
      forecastCacheKey(lat, lon),
      JSON.stringify({ t: Date.now(), data })
    );
  } catch (e) {}
}

export async function getForecast(lat, lon) {
  if (lat == null || lon == null) return null;

  // Cache hit?
  const cached = readForecastCache(lat, lon);
  if (cached) return cached;

  // forecast_days=2 → today + tomorrow. timezone=auto so the "day" boundaries
  // match the user's local calendar (otherwise UTC days can give weird splits).
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=2`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.daily || !Array.isArray(json.daily.time) || json.daily.time.length < 1) return null;

    const cToF = (c) => (c == null ? null : Math.round(c * 9 / 5 + 32));
    const days = json.daily.time;
    const lows = json.daily.temperature_2m_min || [];
    const highs = json.daily.temperature_2m_max || [];

    const result = {
      today: days[0] ? {
        date: days[0],
        lowF: cToF(lows[0]),
        highF: cToF(highs[0]),
      } : null,
      tomorrow: days[1] ? {
        date: days[1],
        lowF: cToF(lows[1]),
        highF: cToF(highs[1]),
      } : null,
    };

    // Require at least one day's data to consider the response useful.
    if (!result.today && !result.tomorrow) return null;

    writeForecastCache(lat, lon, result);
    return result;
  } catch (e) {
    console.warn('Forecast fetch failed', e);
    return null;
  }
}

// ============================================================================
// WEEKLY PRECIPITATION — "how much has it rained this week"
// ----------------------------------------------------------------------------
// One forecast call (past_days=6 + today = 7 days) summed into a single total,
// so the garden watering nudge can tell the user whether they even need to
// water. Cached 3h like the forecast — rain totals don't change minute to
// minute. Returns { totalIn, days, throughDate } or null.
// ============================================================================

const WEEKPRECIP_CACHE_KEY_PREFIX = 'henalytics_weekprecip_';
const WEEKPRECIP_CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

function weekPrecipCacheKey(lat, lon) {
  return `${WEEKPRECIP_CACHE_KEY_PREFIX}${lat.toFixed(2)}-${lon.toFixed(2)}`;
}

function readWeekPrecipCache(lat, lon) {
  try {
    const raw = localStorage.getItem(weekPrecipCacheKey(lat, lon));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.t && Date.now() - parsed.t < WEEKPRECIP_CACHE_TTL_MS) return parsed.data;
  } catch (e) {}
  return null;
}

function writeWeekPrecipCache(lat, lon, data) {
  try {
    localStorage.setItem(weekPrecipCacheKey(lat, lon), JSON.stringify({ t: Date.now(), data }));
  } catch (e) {}
}

export async function getWeeklyPrecip(lat, lon) {
  if (lat == null || lon == null) return null;

  const cached = readWeekPrecipCache(lat, lon);
  if (cached) return cached;

  // past_days=6 + today = a 7-day window ending today, local calendar days.
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum&timezone=auto&past_days=6&forecast_days=1`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const arr = json.daily && json.daily.precipitation_sum;
    const times = json.daily && json.daily.time;
    if (!Array.isArray(arr) || arr.length === 0) return null;

    let mm = 0;
    for (const v of arr) { if (typeof v === 'number' && !Number.isNaN(v)) mm += v; }
    const totalIn = Math.round(mm * 0.0393701 * 100) / 100;

    const result = {
      totalIn,
      days: arr.length,
      throughDate: Array.isArray(times) && times.length ? times[times.length - 1] : null,
    };
    writeWeekPrecipCache(lat, lon, result);
    return result;
  } catch (e) {
    console.warn('Weekly precip fetch failed', e);
    return null;
  }
}
