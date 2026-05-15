// ============================================================================
// BARCODE SCANNER — thin wrapper over @capacitor-mlkit/barcode-scanning.
// Used for scanning CCIA cattle RFID tag barcodes (Code128 is most common
// on Canadian cattle tags) but also handles QR, EAN, UPC, etc. since the
// plugin returns whatever it sees.
//
// Three execution paths:
//   1. Native (iOS/Android with the plugin installed) — opens the platform
//      scanner UI, returns the raw barcode string.
//   2. Web with the polyfill — Barcode Detection API via barcode-detector.
//      Works on Chrome/Edge on Android in our PWA shell. Falls back if
//      unsupported.
//   3. Anywhere else — returns { ok: false, reason: "unsupported" } so the
//      caller can show "type it in manually" guidance.
//
// The native scan() call requires camera permission on iOS (we request it
// up-front and tell the user why via NSCameraUsageDescription in
// Info.plist). On Android, Google Code Scanner is permissionless when
// Google Play Services is available, which is most of the install base.
// ============================================================================
import { Capacitor } from "@capacitor/core";

// Lazy-import so web builds without the native plugin still work; the
// import only resolves when we're actually on a native platform.
async function loadMlkitScanner() {
  try {
    const mod = await import("@capacitor-mlkit/barcode-scanning");
    return mod;
  } catch (e) {
    return null;
  }
}

// Available barcode formats — we pass an explicit list to the plugin so
// scanning is fast (smaller search space) and so we don't pick up random
// QR codes in the environment when the user is trying to scan a tag.
// CCIA cattle tags use Code 128 most often, but we include the other
// common 1D formats since some tags vary. QR is included so the same
// scanner can read product packaging, equipment serials, etc. later if
// we expose this same helper for other features.
const DEFAULT_FORMATS_NATIVE = [
  "CODE_128", "EAN_13", "EAN_8", "UPC_A", "UPC_E",
  "CODABAR", "ITF", "CODE_39", "CODE_93", "QR_CODE",
];

// Main entry point. Returns:
//   { ok: true, value: "1240003456789012", format: "CODE_128" } on success
//   { ok: false, reason: "cancelled" }     user backed out
//   { ok: false, reason: "denied" }        user denied camera permission
//   { ok: false, reason: "unsupported" }   no plugin, no Barcode Detection API
//   { ok: false, reason: "error", error }  unexpected runtime failure
export async function scanBarcode() {
  const isNative = Capacitor && typeof Capacitor.isNativePlatform === "function"
    ? Capacitor.isNativePlatform()
    : false;

  if (isNative) {
    const mod = await loadMlkitScanner();
    if (!mod) return { ok: false, reason: "unsupported" };
    const { BarcodeScanner, BarcodeFormat } = mod;

    // Permission check — on iOS this prompts the user the first time;
    // on Android with Google Code Scanner it's a no-op (no permission
    // needed). The plugin handles platform differences internally.
    try {
      const perm = await BarcodeScanner.requestPermissions();
      // The plugin returns { camera: "granted" | "denied" | "prompt" }
      if (perm && perm.camera === "denied") {
        return { ok: false, reason: "denied" };
      }
    } catch (e) {
      // requestPermissions can throw on web builds that managed to load
      // the module; fall through and try scan() anyway.
    }

    try {
      const formats = DEFAULT_FORMATS_NATIVE
        .map(f => BarcodeFormat?.[f])
        .filter(Boolean);
      // scan() opens the platform's ready-to-use UI (Google Code Scanner
      // on Android, AVFoundation viewfinder on iOS). The promise resolves
      // with the scan result OR rejects/returns empty when cancelled.
      const result = await BarcodeScanner.scan(
        formats.length > 0 ? { formats } : undefined
      );
      const codes = result?.barcodes || [];
      if (codes.length === 0) return { ok: false, reason: "cancelled" };
      const first = codes[0];
      return {
        ok: true,
        value: first.rawValue || first.displayValue || "",
        format: first.format || null,
      };
    } catch (e) {
      // The plugin throws on cancel on some platforms. We treat any
      // throw as cancellation rather than surfacing a scary error — the
      // user just closed the scanner.
      return { ok: false, reason: "cancelled", error: e };
    }
  }

  // Web path — Barcode Detection API (Chromium / Android Chrome). We
  // don't ship a fully-built web scanner UI here (would need a camera
  // viewfinder, frame loop, etc.); instead we surface "unsupported" so
  // the caller falls back to manual entry. A future web build could
  // wire ZXing or barcode-detector polyfill if there's demand.
  return { ok: false, reason: "unsupported" };
}

// Convenience: returns true when scanning is actually available on this
// device, so the UI can hide the scan button entirely on web/desktop
// rather than show a button that always fails.
export function isScanSupported() {
  if (!Capacitor || typeof Capacitor.isNativePlatform !== "function") return false;
  return Capacitor.isNativePlatform();
}
