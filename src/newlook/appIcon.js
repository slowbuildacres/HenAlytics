// ============================================================================
// Alternate app icons (3.0, Supporter perk) — iPhone and iPad only for now.
// ----------------------------------------------------------------------------
// Native side: ios/App/App/AppIcon.swift (AppIcon.get / AppIcon.set).
// Android would need the launcher entry moved to an activity-alias, which
// makes some launchers drop the existing home-screen icon on update, so it
// waits for a later release.
// ============================================================================

export const APP_ICONS = [
  { key: "default", name: "Farmhouse", img: "/app-icons/default.png", supporter: false },
  { key: "Meadow", name: "Meadow", img: "/app-icons/meadow.png", supporter: true },
  { key: "Barn", name: "Barn", img: "/app-icons/barn.png", supporter: true },
  { key: "Night", name: "Night", img: "/app-icons/night.png", supporter: true },
  { key: "Spring", name: "Spring", img: "/app-icons/spring.png", supporter: true },
  { key: "Summer", name: "Summer", img: "/app-icons/summer.png", supporter: true },
  { key: "Fall", name: "Fall", img: "/app-icons/fall.png", supporter: true },
  { key: "Winter", name: "Winter", img: "/app-icons/winter.png", supporter: true },
];

let _plugin = null;
function plugin() {
  if (_plugin) return _plugin;
  try {
    const cap = typeof window !== "undefined" && window.Capacitor;
    if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.getPlatform && cap.getPlatform() === "ios" && typeof cap.registerPlugin === "function") {
      _plugin = cap.registerPlugin("AppIcon") || null;
    }
  } catch (_) { _plugin = null; }
  return _plugin;
}

// { supported, name } — supported is false on the web, Android, or an
// older build without the plugin.
export async function getAppIcon() {
  const p = plugin();
  if (!p) return { supported: false, name: "default" };
  try {
    const r = await p.get();
    return { supported: !!(r && r.supported), name: (r && r.name ? String(r.name).replace(/^AppIcon-/, "") : "default") };
  } catch (_) { return { supported: false, name: "default" }; }
}

export async function setAppIcon(key) {
  const p = plugin();
  if (!p) throw new Error("App icons can be changed in the iPhone app.");
  await p.set({ name: key });
  return key;
}
