// ============================================================================
// New look (3.0) — preview switch
// ----------------------------------------------------------------------------
// While 3.0 is being built, the new look is off unless this device turns it
// on: More/Settings → "Try the new look", or open the app with ?newlook=1
// (?newlook=0 turns it back off). Stored per device. At launch, flip
// NEW_LOOK_DEFAULT to true and the switch goes away.
// ============================================================================

import { useCallback, useState } from "react";

export const NEW_LOOK_DEFAULT = false;
const KEY = "henalytics_newlook";

function readInitial() {
  try {
    const q = new URLSearchParams(window.location.search).get("newlook");
    if (q === "1" || q === "0") {
      localStorage.setItem(KEY, q);
      return q === "1";
    }
    const v = localStorage.getItem(KEY);
    if (v === "1" || v === "0") return v === "1";
  } catch (_) { /* private mode / no window */ }
  return NEW_LOOK_DEFAULT;
}

export function useNewLook() {
  const [on, setOn] = useState(readInitial);
  const set = useCallback((next) => {
    setOn(next);
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch (_) {}
  }, []);
  return [on, set];
}
