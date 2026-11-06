// ============================================================================
// New look (3.0) — dark mode and color looks for the older screens
// ----------------------------------------------------------------------------
// The forms, "All the numbers" sections and other screens built before 3.0
// each have their own `palette` object (bg, card, ink, yolk…). They're now
// made with legacyPalette({...}) and changed in place whenever the look or
// dark mode changes, so those screens follow the rest of the app.
//
// Style objects built once at load (inputStyle and friends) are made with
// legacyStyle(() => ({...})) and rebuilt in place after the palettes change.
//
// Extra keys every palette gets, for colors that used to be typed in:
//   onYolk   text on a yolk-yellow fill (always dark)
//   onColor  text on a red, green or brown fill (always cream)
//   onInk    text on an ink fill (cream in light, dark in dark)
//   white    "white" panels and inputs
//   dangerBg / goodBg / warnBg   pale red, green and yellow panels
//
// Farmhouse in light mode keeps the original colors exactly.
// ============================================================================

const palettes = [];
const styles = [];

const FARMHOUSE_LIGHT_LEGACY = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", accentSoft: "#E8A07A", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47", featherSoft: "#C9A77B",
  line: "#2C181030", card: "#FAF5EA",
  onYolk: "#2C1810", onColor: "#FFFAF2", onInk: "#FAF5EA", white: "#FFFFFF",
  dangerBg: "#FBE5DE", goodBg: "#EAF3DD", warnBg: "#FFF3CD",
};

let state = { look: "farmhouse", dark: false, t: null };

function mapped(t, dark) {
  if (!t) return FARMHOUSE_LIGHT_LEGACY;
  if (!dark) {
    // Meadow and Barn in light mode: their paper, cards and text; the
    // hobby colors (egg yellow, garden green, barn red) stay as they were.
    return {
      ...FARMHOUSE_LIGHT_LEGACY,
      bg: t.paper, bgAlt: t.chip, card: t.card, ink: t.ink, inkSoft: t.soft,
      line: `${t.ink}30`, onInk: t.paper, white: t.card,
    };
  }
  return {
    bg: t.paper, bgAlt: t.chip, card: t.card, ink: t.ink, inkSoft: t.soft,
    accent: t.alert, accentSoft: "#B5664A", leaf: t.good, leafSoft: "#4E6B38",
    yolk: "#E8B04A", yolkSoft: t.yolkTint, feather: "#C2A57E", featherSoft: "#6B5640",
    line: `${t.ink}30`, onYolk: "#1A130F", onColor: "#FFFAF2", onInk: t.paper, white: t.card,
    dangerBg: t.alertTint, goodBg: t.goodTint, warnBg: t.yolkTint,
  };
}

function fill(p) {
  const v = mapped(state.t, state.dark);
  const base = p.__base;
  for (const k of Object.keys(base)) {
    // Farmhouse light: each file's own colors, untouched. Otherwise shared
    // keys follow the look; keys only one file has keep their color in light
    // mode and borrow the closest shared color in dark mode.
    p[k] = !state.t ? base[k] : k in v ? v[k] : (state.dark ? guessDark(k, base[k], v) : base[k]);
  }
  for (const k of Object.keys(v)) if (!(k in base)) p[k] = v[k];
}

function guessDark(key, value, v) {
  const k = key.toLowerCase();
  if (/soft|tint|bg|light|pale/.test(k)) return v.bgAlt;
  if (/ink|text|dark/.test(k)) return v.ink;
  if (/line|border|rule/.test(k)) return v.line;
  if (/green|leaf|good|success/.test(k)) return v.leaf;
  if (/red|accent|danger|alert/.test(k)) return v.accent;
  if (/yolk|gold|yellow|warn|honey/.test(k)) return v.yolk;
  return value;
}

export function legacyPalette(base) {
  const p = {};
  Object.defineProperty(p, "__base", { value: { ...base }, enumerable: false });
  fill(p);
  palettes.push(p);
  return p;
}

export function legacyStyle(build) {
  const o = build();
  styles.push({ o, build });
  return o;
}

// Called from applyLook() whenever the look or dark mode changes.
export function applyLegacyTheme(look, dark, tokens) {
  state = { look, dark: !!dark, t: look === "farmhouse" && !dark ? null : { ...tokens } };
  for (const p of palettes) fill(p);
  for (const s of styles) {
    const next = s.build();
    for (const k of Object.keys(s.o)) if (!(k in next)) delete s.o[k];
    Object.assign(s.o, next);
  }
}

// Section titles in the older screens started with an emoji ("📊 Cost
// breakdown"); the new look doesn't use emoji in headings.
const LEAD_EMOJI = /^(?:[☀-➿️‍]|\p{Extended_Pictographic}|\p{Emoji_Modifier})+\s*/u;
export function plainTitle(t) {
  return typeof t === "string" ? t.replace(LEAD_EMOJI, "") : t;
}
