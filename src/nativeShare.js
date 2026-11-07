// ============================================================================
// Share sheet for the Android app
// ----------------------------------------------------------------------------
// Every "save a file" or "share" button (Export to CSV, the year-end report,
// 4-H record PDFs, the calendar file, Wrapped and share cards) hands its file
// to navigator.share, falling back to a browser download. Android's in-app
// web view has neither: navigator.share isn't there and downloads are
// ignored, so those buttons did nothing in the Android app.
//
// installNativeShare() fills in navigator.share / navigator.canShare with
// Capacitor's Share plugin: files are written to the app's cache folder
// (Filesystem) and handed to the system share sheet, where people pick Save
// to device, Drive, Gmail and so on. It only fills a gap: when the web view
// already has navigator.share (the iPhone app), nothing changes.
// ============================================================================

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error || new Error("Could not read file"));
    r.readAsDataURL(blob);
  });
}

function abortError() {
  try { return new DOMException("Share canceled", "AbortError"); } catch (_) { const e = new Error("Share canceled"); e.name = "AbortError"; return e; }
}

export function installNativeShare() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  const cap = window.Capacitor;
  if (!(cap && cap.isNativePlatform && cap.isNativePlatform())) return;
  if (typeof navigator.share === "function") return; // the web view has its own

  const share = async (data = {}) => {
    const [{ Share }, { Filesystem, Directory }] = await Promise.all([
      import("@capacitor/share"),
      import("@capacitor/filesystem"),
    ]);
    const uris = [];
    for (const f of data.files || []) {
      const name = String(f.name || "henalytics-file").replace(/[^\w.\- ]+/g, "_");
      const res = await Filesystem.writeFile({
        path: `share/${Date.now()}-${name}`,
        data: await blobToBase64(f),
        directory: Directory.Cache,
        recursive: true,
      });
      uris.push(res.uri);
    }
    try {
      await Share.share({
        title: data.title || undefined,
        text: data.text || undefined,
        url: data.url || undefined,
        files: uris.length ? uris : undefined,
        dialogTitle: data.title || "Share",
      });
    } catch (e) {
      if (/cancel/i.test(String((e && e.message) || ""))) throw abortError();
      throw e;
    }
  };
  try {
    Object.defineProperty(navigator, "share", { value: share, configurable: true, writable: true });
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true, writable: true });
  } catch (_) {
    try { navigator.share = share; navigator.canShare = () => true; } catch (__) { /* ignore */ }
  }
}
