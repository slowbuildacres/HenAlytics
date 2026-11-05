// ============================================================================
// New look (3.0) — open a hobby's own log form from outside the hobby page
// ----------------------------------------------------------------------------
// Animal hobbies like Goats keep their log forms inside their own page. When
// the Log picker asks for "Milk" on Goats, the app switches to the goat page
// and calls requestHobbyAction(); the page picks it up as it mounts (or right
// away if it is already showing) with useHobbyRequest().
// ============================================================================

import { useEffect, useRef } from "react";

const EVENT = "henalytics-hobby-action";
let pending = null;

export function requestHobbyAction(hobbyId, action) {
  pending = { hobbyId, action, at: Date.now() };
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT));
}

// `accepts(action)` (optional): only take requests this listener handles, so
// two listeners on one hobby (the page and the app) don't steal each other's.
export function useHobbyRequest(hobbyId, handler, accepts) {
  const ref = useRef(handler);
  ref.current = handler;
  const acc = useRef(accepts);
  acc.current = accepts;
  useEffect(() => {
    const take = () => {
      if (!pending || pending.hobbyId !== hobbyId) return;
      if (acc.current && !acc.current(pending.action)) return;
      // Ignore stale requests (the page never opened).
      const p = pending; pending = null;
      if (Date.now() - p.at < 5000) ref.current(p.action);
    };
    take();
    window.addEventListener(EVENT, take);
    return () => window.removeEventListener(EVENT, take);
  }, [hobbyId]);
}
