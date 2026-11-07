// ============================================================================
// Adding days to a date
// ----------------------------------------------------------------------------
// date.getTime() + n * 24h is wrong across a daylight-saving change: the day
// the clocks fall back is 25 hours long, so midnight Oct 31 + 7 × 24h lands at
// 11 pm Nov 6, and a hatch date, due date or "this week" window comes out a
// day early. plusDays() moves along the calendar instead (same time of day).
// ============================================================================
export function plusDays(date, n) {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + Math.floor(Number(n) || 0), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
}

// Whole calendar days from a to b (both dates; time of day ignored).
export function daysBetween(a, b) {
  const x = a instanceof Date ? a : new Date(a);
  const y = b instanceof Date ? b : new Date(b);
  return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 86400000);
}
