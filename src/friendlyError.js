// ============================================================================
// Plain-words error messages
// ----------------------------------------------------------------------------
// Errors from the network, the browser or a bug read like "Failed to fetch"
// or "Cannot read properties of null". People see these words instead; a
// message that's already meant for people (from our server or sign-in, like
// "Invalid login credentials" or "Monthly limit reached") passes through.
// ============================================================================
export function friendlyError(e, fallback = "Something went wrong", signInText = "Please sign in first.") {
  const m = String((e && e.message) || (typeof e === "string" ? e : ""));
  if (/not signed in|reading 'auth'|authentication required|invalid or expired session|jwt expired/i.test(m)) return signInText;
  if (/failed to fetch|networkerror|load failed|network request failed|the internet connection appears to be offline/i.test(m)) return "Can't reach the internet right now. Check your connection and try again.";
  if (/\((5\d\d)\)|cannot read propert|is not a function|is not defined|undefined|unexpected token|json/i.test(m)) return `${String(fallback).replace(/[.!]$/, "")}. Please try again in a minute.`;
  return m || fallback;
}
