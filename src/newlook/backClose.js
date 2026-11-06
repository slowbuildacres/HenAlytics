// ============================================================================
// Android back: close whatever popup is on top
// ----------------------------------------------------------------------------
// Most forms and sheets are opened by the screen they belong to (a goat's milk
// form, a canning batch, the Log picker's sheets…), so the app-level back
// handler can't see them. Before going back a screen, Android back closes the
// topmost one the same way tapping outside it does: every popup is a
// full-screen fixed layer whose backdrop closes it (old popups: the layer
// itself; new-look sheets: a full-size "Close" button behind the sheet).
//
// closeTopOverlay() returns the layer it tapped, or null when nothing is open.
// ============================================================================

function isOverlay(el) {
  const cs = getComputedStyle(el);
  if (cs.position !== "fixed" || cs.pointerEvents === "none" || cs.visibility === "hidden" || cs.display === "none") return false;
  const r = el.getBoundingClientRect();
  return r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.8;
}

function topOverlay() {
  let best = null; let bestZ = -Infinity; let bestOrder = -1;
  const all = document.body.querySelectorAll("div, section");
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (!isOverlay(el)) continue;
    // Skip layers nested in another overlay; the outer one is the popup.
    let nested = false;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (isOverlay(a)) { nested = true; break; }
    if (nested) continue;
    const z = parseInt(getComputedStyle(el).zIndex, 10) || 0;
    if (z > bestZ || (z === bestZ && i > bestOrder)) { best = el; bestZ = z; bestOrder = i; }
  }
  return best;
}

export function closeTopOverlay() {
  if (typeof document === "undefined") return null;
  const layer = topOverlay();
  if (!layer) return null;
  // New-look sheet: the dimmed backdrop is a full-size Close button.
  const backdrop = [...layer.children].find((c) => c.tagName === "BUTTON" && c.getAttribute("aria-label") === "Close");
  if (backdrop) { backdrop.click(); return layer; }
  // Old popups close when the layer itself (outside the card) is tapped.
  layer.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  return layer;
}
