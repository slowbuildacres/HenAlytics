// ============================================================================
// New look (3.0) — preview switch
// ----------------------------------------------------------------------------
// While 3.0 is being built, the new look is off unless this device turns it
// on (current Settings → "Try the new look", or ?newlook=1; ?newlook=0 turns
// it back off on the web while testing). Stored per device.
// At launch set NEW_LOOK_LAUNCHED = true: everyone gets the new look and
// there is no way back to the old design.
// ============================================================================

import { useCallback, useState } from "react";

export const NEW_LOOK_LAUNCHED = false;
const KEY = "henalytics_newlook";

function readInitial() {
  if (NEW_LOOK_LAUNCHED) return true;
  try {
    const q = new URLSearchParams(window.location.search).get("newlook");
    if (q === "1" || q === "0") {
      localStorage.setItem(KEY, q);
      return q === "1";
    }
    const v = localStorage.getItem(KEY);
    if (v === "1" || v === "0") return v === "1";
  } catch (_) { /* private mode / no window */ }
  return false;
}

export function useNewLook() {
  const [on, setOn] = useState(readInitial);
  const set = useCallback((next) => {
    if (NEW_LOOK_LAUNCHED) return;
    setOn(next);
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch (_) {}
  }, []);
  return [on, set];
}
