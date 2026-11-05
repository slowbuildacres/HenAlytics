// ============================================================================
// New look (3.0) — design tokens
// ----------------------------------------------------------------------------
// Three looks from the redesign canvas, each with a light and a dark set:
//   Farmhouse — free for everyone (the default), dark mode free too
//   Meadow, Barn — Supporter options
// Every new-look screen reads colors from `nl` at render time, so switching
// looks is: applyLook() overwrites the values in place, then the app
// re-renders. Keep names semantic, never "brown2". Never copy a color into a
// module-level constant (it would miss a switch); read nl.x inside render.
// ============================================================================

const FARMHOUSE_LIGHT = {
  paper: "#F6F1E7",      // page background
  card: "#FFFDF8",       // cards, sheets
  ink: "#2A1A12",        // text, outline buttons, selected chips
  soft: "#6B5646",       // secondary text
  line: "#E3D8C6",       // card borders
  rule: "#EFE6D6",       // dividers inside cards
  chip: "#F3ECDF",       // icon wells, quiet chips
  well: "#EDE4D4",       // segmented-control track
  field: "#D6CAB6",      // outline buttons, inputs
  faint: "#B9A88F",      // dashed borders, idle chevrons
  yolk: "#E3A92B",       // the one primary action color
  onYolk: "#2A1A12",     // text and icons on yolk
  yolkTint: "#F7E3B5",   // highlighted cards, badges
  yolkInk: "#5A3E07",    // text on yolkTint
  quietInk: "#5A4433",   // text on chip-colored badges
  good: "#4C6B2F",       // links, positive numbers
  goodTint: "#E3EDD3",
  goodInk: "#2F4A1A",
  alert: "#B4472E",      // frost, warnings
  alertTint: "#FBEDE8",
  alertChip: "#F6D9D0",
  alertInk: "#8E3420",   // text on alertTint, error lines
  deep: "#2A1A12",       // dark feature cards (supporter, garden value, undo bar)
  onDeep: "#F6F1E7",
  onDeepSoft: "#D8CBB8",
  accentOnDeep: "#E3A92B",
  nav: "#2A1A12",        // bottom bar
  navActive: "#E3A92B",
  navIdle: "#C9BBA5",
  scrim: "rgba(42,26,18,0.45)",
  shadow: "rgba(42,26,18,0.18)",
  avatar: "#EADFCB",
};

const FARMHOUSE_DARK = {
  paper: "#1A130F", card: "#241B16", ink: "#F3EADB", soft: "#BCAA94", line: "#3A2D24", rule: "#30251E",
  chip: "#33271F", well: "#2C221B", field: "#55443A", faint: "#7A6857",
  yolk: "#E8B04A", onYolk: "#1A130F", yolkTint: "#47361A", yolkInk: "#F5D58F", quietInk: "#D8C8B3",
  good: "#9CC27A", goodTint: "#25331B", goodInk: "#C9E0B0",
  alert: "#E0795E", alertTint: "#3A1F18", alertChip: "#4C2A22", alertInk: "#F2A893",
  deep: "#33251C", onDeep: "#F3EADB", onDeepSoft: "#BCAA94", accentOnDeep: "#E8B04A",
  nav: "#100B08", navActive: "#E8B04A", navIdle: "#8E7D69",
  scrim: "rgba(0,0,0,0.6)", shadow: "rgba(0,0,0,0.45)", avatar: "#3A2D24",
};

const MEADOW_LIGHT = {
  paper: "#F4F5EF", card: "#FFFFFC", ink: "#1F3326", soft: "#55665A", line: "#DCE3D6", rule: "#E6ECE0",
  chip: "#E8EEE2", well: "#E1E8DA", field: "#C5D0BF", faint: "#9DAE9F",
  yolk: "#E6A23C", onYolk: "#1F3326", yolkTint: "#F8E4BE", yolkInk: "#5A3E07", quietInk: "#3E5245",
  good: "#2F6B45", goodTint: "#DCEBDD", goodInk: "#1E4A2E",
  alert: "#B24A2F", alertTint: "#FBECE6", alertChip: "#F4D6CC", alertInk: "#8A3520",
  deep: "#1F3326", onDeep: "#F4F5EF", onDeepSoft: "#C3D0C6", accentOnDeep: "#E6A23C",
  nav: "#1F3326", navActive: "#E6A23C", navIdle: "#A9B8AC",
  scrim: "rgba(31,51,38,0.45)", shadow: "rgba(31,51,38,0.18)", avatar: "#DCE5D5",
};

const MEADOW_DARK = {
  paper: "#111814", card: "#19231D", ink: "#E4EDE3", soft: "#A1B2A5", line: "#2B3A31", rule: "#243029",
  chip: "#243029", well: "#1F2A23", field: "#3E4E43", faint: "#62756A",
  yolk: "#E6A23C", onYolk: "#111814", yolkTint: "#403216", yolkInk: "#F3D598", quietInk: "#C3D3C6",
  good: "#8CC79E", goodTint: "#1E3426", goodInk: "#C2E4CC",
  alert: "#E2836A", alertTint: "#38201A", alertChip: "#4A2A22", alertInk: "#F2AE99",
  deep: "#22352A", onDeep: "#E4EDE3", onDeepSoft: "#A1B2A5", accentOnDeep: "#E6A23C",
  nav: "#0B110D", navActive: "#E6A23C", navIdle: "#7E8F82",
  scrim: "rgba(0,0,0,0.6)", shadow: "rgba(0,0,0,0.45)", avatar: "#2B3A31",
};

const BARN_LIGHT = {
  paper: "#FAF8F4", card: "#FFFFFF", ink: "#25211D", soft: "#6A625A", line: "#E6E0D7", rule: "#EEE9E1",
  chip: "#F2EDE5", well: "#ECE6DC", field: "#D3CBC0", faint: "#ADA396",
  yolk: "#A63A2B", onYolk: "#FFFFFF", yolkTint: "#F6DED9", yolkInk: "#7A2418", quietInk: "#4E4740",
  good: "#3E6B3A", goodTint: "#E1ECDD", goodInk: "#284A25",
  alert: "#C0392B", alertTint: "#FCEDEA", alertChip: "#F7D5CF", alertInk: "#8E2A20",
  deep: "#25211D", onDeep: "#FAF8F4", onDeepSoft: "#D3CBC0", accentOnDeep: "#E2B866",
  nav: "#25211D", navActive: "#E2B866", navIdle: "#B5ACA2",
  scrim: "rgba(37,33,29,0.45)", shadow: "rgba(37,33,29,0.18)", avatar: "#ECE6DC",
};

const BARN_DARK = {
  paper: "#161311", card: "#201C19", ink: "#F2EEE8", soft: "#B4ABA1", line: "#36302B", rule: "#2C2723",
  chip: "#2E2925", well: "#27221F", field: "#4A423B", faint: "#70675E",
  yolk: "#C9503E", onYolk: "#FFFFFF", yolkTint: "#45201A", yolkInk: "#F4C2B8", quietInk: "#D3CBC0",
  good: "#93C08C", goodTint: "#22331F", goodInk: "#CBE3C5",
  alert: "#E8735F", alertTint: "#3D1E19", alertChip: "#4F2620", alertInk: "#F4AA9C",
  deep: "#2E2724", onDeep: "#F2EEE8", onDeepSoft: "#B4ABA1", accentOnDeep: "#E2B866",
  nav: "#0E0C0A", navActive: "#E2B866", navIdle: "#8A8279",
  scrim: "rgba(0,0,0,0.6)", shadow: "rgba(0,0,0,0.45)", avatar: "#36302B",
};

export const LOOKS = {
  farmhouse: { key: "farmhouse", name: "Farmhouse", blurb: "Warm cream and egg-yolk gold", supporter: false, light: FARMHOUSE_LIGHT, dark: FARMHOUSE_DARK },
  meadow: { key: "meadow", name: "Meadow", blurb: "Fresh greens, like the garden and pasture", supporter: true, light: MEADOW_LIGHT, dark: MEADOW_DARK },
  barn: { key: "barn", name: "Barn", blurb: "Crisp white with barn red and wheat", supporter: true, light: BARN_LIGHT, dark: BARN_DARK },
};

// The live tokens. Starts as Farmhouse light; applyLook() swaps it in place.
export const nl = { ...FARMHOUSE_LIGHT };

let current = { look: "farmhouse", dark: false };
export function currentLook() { return current; }

// look: "farmhouse" | "meadow" | "barn"; dark: boolean. Returns true when it changed.
export function applyLook(look, dark) {
  const L = LOOKS[look] || LOOKS.farmhouse;
  const next = { look: L.key, dark: !!dark };
  if (next.look === current.look && next.dark === current.dark) return false;
  Object.assign(nl, dark ? L.dark : L.light);
  current = next;
  if (typeof document !== "undefined") {
    try {
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
      document.documentElement.dataset.nlLook = `${L.key}${dark ? "-dark" : ""}`;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", nl.paper);
    } catch (_) { /* ignore */ }
  }
  return true;
}

export const font = {
  display: `'DM Serif Display', Georgia, serif`,
  body: `'Be Vietnam Pro', -apple-system, system-ui, sans-serif`,
};

// Type scale (px). Sizes are a floor: layouts use flex/wrap so the phone's
// larger text settings never cut words off.
export const type = {
  title: 28,      // screen titles
  section: 21,    // card titles (serif)
  big: 32,        // headline numbers (serif)
  body: 15,
  small: 13,
  tiny: 11,
};

export const radius = { card: 20, tile: 16, button: 14, pill: 999 };

// Bottom nav height (without the safe area); screens pad their bottom by this.
export const NAV_HEIGHT = 64;
