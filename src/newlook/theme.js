// ============================================================================
// New look (3.0) — design tokens
// ----------------------------------------------------------------------------
// Farmhouse palette from the redesign canvas. Every new-look screen reads
// colors, type and spacing from here so the whole app stays consistent.
// Dark mode (free for everyone) will add a second token set in phase 4; until
// then only `nl` (light) exists. Keep names semantic, never "brown2".
// ============================================================================

export const nl = {
  paper: "#F6F1E7",      // page background
  card: "#FFFDF8",       // cards, sheets
  ink: "#2A1A12",        // text, dark buttons, nav bar
  soft: "#6B5646",       // secondary text
  line: "#E3D8C6",       // card borders
  rule: "#EFE6D6",       // dividers inside cards
  chip: "#F3ECDF",       // icon wells, quiet chips
  field: "#D6CAB6",      // outline buttons, inputs
  yolk: "#E3A92B",       // the one primary action color
  yolkTint: "#F7E3B5",   // highlighted cards, badges
  yolkInk: "#5A3E07",    // text on yolkTint
  good: "#4C6B2F",       // links, positive numbers
  goodTint: "#E3EDD3",
  goodInk: "#2F4A1A",
  alert: "#B4472E",      // frost, warnings
  alertTint: "#FBEDE8",
  alertChip: "#F6D9D0",
  navIdle: "#C9BBA5",
  scrim: "rgba(42,26,18,0.45)",
};

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
