// ============================================================================
// Thousands separators for numbers shown in stat cards and similar spots
// ----------------------------------------------------------------------------
// Years of logs make totals like 72461 eggs or 1248.1 gal; they read better as
// 72,461 and 1,248.1. Numbers are formatted directly; in text, a run of 4+
// digits that isn't part of a date, time, money already grouped or a year
// (1990–2099 on its own) gets commas.
// ============================================================================
export function groupDigits(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : v;
  if (typeof v !== "string") return v;
  return v.replace(/(?<![\d,.\-/:])(\d{4,})(\.\d+)?(?![\d\-/:])/g, (m, int, dec = "") => {
    if (!dec && int.length === 4 && +int >= 1990 && +int <= 2099) return m;
    return Number(int).toLocaleString("en-US") + dec;
  });
}
