// ============================================================================
// WEATHER MODULE
// ----------------------------------------------------------------------------
// Fetches daily weather (high temp + total precipitation) for a given location
// and date from Open-Meteo. Free, no API key needed, generous rate limits.
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

function cacheKey(date, lat, lon) {
  return `${CACHE_KEY_PREFIX}${date}-${lat.toFixed(2)}-${lon.toFixed(2)}`;
}

function readCache(date, lat, lon) {
  try {
    const raw = localStorage.getItem(cacheKey(date, lat, lon));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.t && Date.now() - parsed.t < CACHE_TTL_MS) {
      return parsed.data;
    }
  } catch (e) {}
  return null;
}

function writeCache(date, lat, lon, data) {
  try {
    localStorage.setItem(
      cacheKey(date, lat, lon),
      JSON.stringify({ t: Date.now(), data })
    );
  } catch (e) {}
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Convert Open-Meteo's metric values to user-facing imperial.
// Returns null if the API didn't return usable values.
function shapeWeather(rawDaily, idx) {
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
    fetchedAt: new Date().toISOString(),
  };
}

// Public: fetch weather for a single date and location.
// Returns { highF, lowF, precipIn, fetchedAt } or null if unavailable.
export async function getDailyWeather(dateStr, lat, lon) {
  if (!dateStr || lat == null || lon == null) return null;

  // Cache hit?
  const cached = readCache(dateStr, lat, lon);
  if (cached) return cached;

  // Pick endpoint: archive for past dates, forecast for today/future.
  // Open-Meteo's archive endpoint typically lags ~5 days, so for the most
  // recent week we should use the forecast endpoint with past_days param.
  const today = todayStr();
  const isToday = dateStr === today;
  const dayDiff = (new Date(today) - new Date(dateStr)) / (1000 * 60 * 60 * 24);

  let url;
  if (dayDiff < 0) {
    // Future date — no weather data possible
    return null;
  } else if (dayDiff <= 7 || isToday) {
    // Recent / today: use forecast API with past_days
    const pastDays = Math.max(0, Math.ceil(dayDiff));
    url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&past_days=${pastDays}&forecast_days=1`;
  } else {
    // Older: use archive
    url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dateStr}&end_date=${dateStr}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();

    if (!json.daily || !json.daily.time) return null;
    const idx = json.daily.time.indexOf(dateStr);
    if (idx === -1) return null;

    const shaped = shapeWeather(json.daily, idx);
    if (shaped) writeCache(dateStr, lat, lon, shaped);
    return shaped;
  } catch (e) {
    console.warn('Weather fetch failed', e);
    return null;
  }
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
  if (w.highF != null) bits.push(`${w.highF}°F`);
  if (w.precipIn != null) {
    if (w.precipIn === 0) bits.push("no rain");
    else bits.push(`${w.precipIn}" rain`);
  }
  return bits.length ? bits.join(' · ') : null;
}
