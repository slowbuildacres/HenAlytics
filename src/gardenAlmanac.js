// ============================================================================
// GARDEN ALMANAC DATA
// ----------------------------------------------------------------------------
// Hardiness zone lookup + crop planting windows. Supports multiple zone
// systems (USDA, Canada, RHS, ANHGA, NZ, EU) — see hardiness.js for the
// per-system zone definitions and country mappings.
//
// All frost dates are approximate averages — local microclimates vary.
// Sources: USDA Plant Hardiness Zone Map 2023; NOAA climate normals;
// almanac/extension service planting guides; RHS hardiness ratings; ANHGA.
// ============================================================================

import {
  HARDINESS_SYSTEMS,
  getZoneInfo,
  estimateZoneForSystem,
} from "./hardiness.js";

// Re-export the USDA zone map as ZONE_INFO for backward compatibility.
// Existing code that imports `ZONE_INFO` from this file still works — it
// just only sees USDA zones. For multi-system support, use getZoneInfo()
// from hardiness.js, or pass a `system` parameter to getFrostDates() below.
export const ZONE_INFO = HARDINESS_SYSTEMS.USDA.zones;

// Estimate USDA zone from latitude. Preserved for backward compatibility —
// new code should use estimateZoneForSystem() from hardiness.js to get a
// zone in the user's preferred system.
export function estimateZone(lat, lon) {
  return estimateZoneForSystem("USDA", lat, lon);
}

// Get the actual last/first frost date for a year, given a zone.
// Returns Date objects for THIS year.
//
// The `system` parameter (default "USDA") tells us which zone system to look
// up the zone in. Existing callers that don't pass a system continue working
// as before since "USDA" is the default.
export function getFrostDates(zone, year = new Date().getFullYear(), system = "USDA") {
  const info = getZoneInfo(system, zone);
  const [lfMonth, lfDay] = info.lastFrost.split("-").map(Number);
  const [ffMonth, ffDay] = info.firstFrost.split("-").map(Number);
  return {
    lastFrost: new Date(year, lfMonth - 1, lfDay),
    firstFrost: new Date(year, ffMonth - 1, ffDay),
    label: info.label,
    zone,
    system,
  };
}

// ============================================================================
// CROPS — planting windows relative to last frost
// ============================================================================
//
// Each crop has up to 3 planting strategies:
//   - indoor:    weeks BEFORE last frost to start seeds indoors
//   - direct:    weeks relative to last frost for direct sow (negative = before, positive = after)
//   - transplant: weeks AFTER last frost to transplant outdoors
//
// daysToHarvest is when fruit/produce typically becomes available
// (counted from when you transplant, or direct-sow date for direct crops).
// ============================================================================

export const CROPS = [
  // ========== Solanaceae (warm-season, frost-tender) ==========
  {
    id: "tomatoes",
    name: "Tomatoes",
    emoji: "🍅",
    methods: {
      indoor:     { weeksBeforeLastFrost: 6 },
      transplant: { weeksAfterLastFrost: 2 },
    },
    daysToHarvest: 75,
    notes: "Wait until soil is consistently above 60°F. Warm-loving.",
  },
  {
    id: "peppers",
    name: "Peppers (sweet & hot)",
    emoji: "🌶️",
    methods: {
      indoor:     { weeksBeforeLastFrost: 8 },
      transplant: { weeksAfterLastFrost: 3 },
    },
    daysToHarvest: 80,
    notes: "Need warm soil. Don't rush them out — slow growth in cool weather.",
  },
  {
    id: "eggplant",
    name: "Eggplant",
    emoji: "🍆",
    methods: {
      indoor:     { weeksBeforeLastFrost: 8 },
      transplant: { weeksAfterLastFrost: 3 },
    },
    daysToHarvest: 80,
    notes: "Loves heat. Direct seed only in long-season climates.",
  },

  // ========== Cucurbits (warm-season, frost-tender) ==========
  {
    id: "cucumbers",
    name: "Cucumbers",
    emoji: "🥒",
    methods: {
      indoor:     { weeksBeforeLastFrost: 3 },
      direct:     { weeksRelativeToLastFrost: 1 },
      transplant: { weeksAfterLastFrost: 2 },
    },
    daysToHarvest: 60,
    notes: "Direct-sown often catches up to transplants. Trellis for cleaner fruit.",
  },
  {
    id: "summer_squash",
    name: "Summer squash / Zucchini",
    emoji: "🥒",
    methods: {
      indoor:     { weeksBeforeLastFrost: 3 },
      direct:     { weeksRelativeToLastFrost: 1 },
    },
    daysToHarvest: 50,
    notes: "Famously prolific. Just 2-3 plants can feed a family.",
  },
  {
    id: "winter_squash",
    name: "Winter squash / Pumpkins",
    emoji: "🎃",
    methods: {
      direct: { weeksRelativeToLastFrost: 2 },
    },
    daysToHarvest: 100,
    notes: "Need long, hot summer. Direct-sow in warm soil.",
  },
  {
    id: "melons",
    name: "Melons (watermelon, cantaloupe)",
    emoji: "🍉",
    methods: {
      indoor:     { weeksBeforeLastFrost: 3 },
      direct:     { weeksRelativeToLastFrost: 2 },
      transplant: { weeksAfterLastFrost: 2 },
    },
    daysToHarvest: 85,
    notes: "Need heat. Black plastic mulch helps in cooler zones.",
  },

  // ========== Beans & peas ==========
  {
    id: "bush_beans",
    name: "Bush beans",
    emoji: "🫘",
    methods: {
      direct: { weeksRelativeToLastFrost: 1 },
    },
    daysToHarvest: 55,
    notes: "Plant successively every 2 weeks for continuous harvest.",
  },
  {
    id: "pole_beans",
    name: "Pole beans",
    emoji: "🫘",
    methods: {
      direct: { weeksRelativeToLastFrost: 1 },
    },
    daysToHarvest: 65,
    notes: "Set up trellis before planting. Crop all season.",
  },
  {
    id: "peas",
    name: "Peas (snap, snow, shelling)",
    emoji: "🌱",
    methods: {
      direct: { weeksRelativeToLastFrost: -4 },
    },
    daysToHarvest: 65,
    notes: "Cool season crop. Plant as soon as soil can be worked.",
  },

  // ========== Brassicas (cool-season) ==========
  {
    id: "broccoli",
    name: "Broccoli",
    emoji: "🥦",
    methods: {
      indoor:     { weeksBeforeLastFrost: 6 },
      transplant: { weeksAfterLastFrost: -2 },
    },
    daysToHarvest: 65,
    notes: "Cool weather crop. Spring or fall planting.",
  },
  {
    id: "cauliflower",
    name: "Cauliflower",
    emoji: "🥬",
    methods: {
      indoor:     { weeksBeforeLastFrost: 6 },
      transplant: { weeksAfterLastFrost: -2 },
    },
    daysToHarvest: 70,
    notes: "Tricky in heat. Fall planting often more reliable.",
  },
  {
    id: "cabbage",
    name: "Cabbage",
    emoji: "🥬",
    methods: {
      indoor:     { weeksBeforeLastFrost: 6 },
      transplant: { weeksAfterLastFrost: -2 },
    },
    daysToHarvest: 75,
    notes: "Hardy. Tolerates light frost.",
  },
  {
    id: "kale",
    name: "Kale",
    emoji: "🥬",
    methods: {
      direct:     { weeksRelativeToLastFrost: -3 },
      transplant: { weeksAfterLastFrost: -2 },
    },
    daysToHarvest: 55,
    notes: "Frost-tolerant — sweetens after a frost. Plant spring or fall.",
  },
  {
    id: "brussels_sprouts",
    name: "Brussels sprouts",
    emoji: "🌱",
    methods: {
      indoor:     { weeksBeforeLastFrost: 4 },
      transplant: { weeksAfterLastFrost: 16 }, // For fall harvest
    },
    daysToHarvest: 100,
    notes: "Long season. Most growers plant for fall harvest after frost.",
  },

  // ========== Roots ==========
  {
    id: "carrots",
    name: "Carrots",
    emoji: "🥕",
    methods: {
      direct: { weeksRelativeToLastFrost: -2 },
    },
    daysToHarvest: 70,
    notes: "Loose soil = straight carrots. Don't transplant.",
  },
  {
    id: "beets",
    name: "Beets",
    emoji: "🌱",
    methods: {
      direct: { weeksRelativeToLastFrost: -2 },
    },
    daysToHarvest: 60,
    notes: "Greens are edible too. Successive planting works well.",
  },
  {
    id: "radishes",
    name: "Radishes",
    emoji: "🌱",
    methods: {
      direct: { weeksRelativeToLastFrost: -3 },
    },
    daysToHarvest: 30,
    notes: "Fastest crop. Plant every 2 weeks for ongoing harvest.",
  },
  {
    id: "turnips",
    name: "Turnips",
    emoji: "🌱",
    methods: {
      direct: { weeksRelativeToLastFrost: -3 },
    },
    daysToHarvest: 50,
    notes: "Roots and greens both edible. Spring or fall.",
  },
  {
    id: "potatoes",
    name: "Potatoes",
    emoji: "🥔",
    methods: {
      direct: { weeksRelativeToLastFrost: -2 },
    },
    daysToHarvest: 90,
    notes: "Plant seed potatoes 4-6\" deep. Hill soil as plants grow.",
  },
  {
    id: "sweet_potatoes",
    name: "Sweet potatoes",
    emoji: "🍠",
    methods: {
      transplant: { weeksAfterLastFrost: 3 },
    },
    daysToHarvest: 110,
    notes: "Plant slips, not seeds. Need warm soil & long season.",
  },
  {
    id: "onions",
    name: "Onions",
    emoji: "🧅",
    methods: {
      indoor:     { weeksBeforeLastFrost: 10 },
      direct:     { weeksRelativeToLastFrost: -4 },
      transplant: { weeksAfterLastFrost: -3 },
    },
    daysToHarvest: 100,
    notes: "Day-length sensitive — pick variety for your latitude.",
  },
  {
    id: "garlic",
    name: "Garlic",
    emoji: "🧄",
    methods: {
      direct: { weeksRelativeToLastFrost: 24 }, // Plant in fall, ~6 months after last frost
    },
    daysToHarvest: 240,
    notes: "Plant cloves in fall (around first frost) for next summer harvest.",
  },

  // ========== Greens & lettuces ==========
  {
    id: "lettuce",
    name: "Lettuce",
    emoji: "🥬",
    methods: {
      indoor:     { weeksBeforeLastFrost: 4 },
      direct:     { weeksRelativeToLastFrost: -2 },
      transplant: { weeksAfterLastFrost: -2 },
    },
    daysToHarvest: 50,
    notes: "Bolts in heat. Plant spring + fall. Successive planting helps.",
  },
  {
    id: "spinach",
    name: "Spinach",
    emoji: "🥬",
    methods: {
      direct: { weeksRelativeToLastFrost: -4 },
    },
    daysToHarvest: 45,
    notes: "Loves cool weather. Bolts quickly when warm.",
  },
  {
    id: "swiss_chard",
    name: "Swiss chard",
    emoji: "🥬",
    methods: {
      direct:     { weeksRelativeToLastFrost: -2 },
      transplant: { weeksAfterLastFrost: 0 },
    },
    daysToHarvest: 55,
    notes: "Heat-tolerant. Cut-and-come-again all season.",
  },
  {
    id: "arugula",
    name: "Arugula",
    emoji: "🌱",
    methods: {
      direct: { weeksRelativeToLastFrost: -3 },
    },
    daysToHarvest: 35,
    notes: "Fast and easy. Bolts in heat — plant spring + fall.",
  },

  // ========== Alliums & herbs ==========
  {
    id: "basil",
    name: "Basil",
    emoji: "🌿",
    methods: {
      indoor:     { weeksBeforeLastFrost: 6 },
      direct:     { weeksRelativeToLastFrost: 2 },
      transplant: { weeksAfterLastFrost: 2 },
    },
    daysToHarvest: 65,
    notes: "Frost-tender. Pinch flowers for continuous harvest.",
  },
  {
    id: "cilantro",
    name: "Cilantro",
    emoji: "🌿",
    methods: {
      direct: { weeksRelativeToLastFrost: -2 },
    },
    daysToHarvest: 50,
    notes: "Bolts fast in heat. Plant every 3 weeks for continuous supply.",
  },
  {
    id: "parsley",
    name: "Parsley",
    emoji: "🌿",
    methods: {
      indoor:     { weeksBeforeLastFrost: 8 },
      direct:     { weeksRelativeToLastFrost: -2 },
      transplant: { weeksAfterLastFrost: -2 },
    },
    daysToHarvest: 75,
    notes: "Slow to germinate. Soak seeds overnight to speed it up.",
  },
  {
    id: "dill",
    name: "Dill",
    emoji: "🌿",
    methods: {
      direct: { weeksRelativeToLastFrost: -1 },
    },
    daysToHarvest: 60,
    notes: "Self-seeds readily. Doesn't transplant well — direct sow.",
  },

  // ========== Corn ==========
  {
    id: "sweet_corn",
    name: "Sweet corn",
    emoji: "🌽",
    methods: {
      direct: { weeksRelativeToLastFrost: 1 },
    },
    daysToHarvest: 80,
    notes: "Plant in blocks (not rows) for pollination. Soil ≥60°F.",
  },
];

// ============================================================================
// FALL / SECOND-SEASON PLANTING
// ----------------------------------------------------------------------------
// Spring planting (above) is anchored to the LAST frost — you plant once the
// danger of frost has passed and grow into the warming year. Fall planting is
// the mirror image: it's anchored to the FIRST frost and you count BACKWARDS,
// so a crop matures (or is harvested) right around the time cold returns.
//
// Only cool-season crops belong here. Frost-tender summer crops (tomatoes,
// peppers, melons, squash, basil, corn…) can't reliably mature before frost in
// most zones, so they're intentionally absent — the planner won't offer them
// for fall.
//
// Each entry:
//   hardiness — how the crop relates to frost, which sets how close to the
//               first frost we let it mature (see FALL_FROST_BUFFER below):
//                 "tender"     — frost kills it; finish ~2 wks before frost
//                 "semitender" — light frost OK; finish ~1 wk before frost
//                 "hardy"      — shrugs off light frost; mature around frost
//                 "veryhardy"  — sweetens in frost / overwinters; ride past it
//   methods   — which planting methods make sense for a fall sowing, in order.
//   special   — "overwinter" crops (garlic) are planted AROUND the first frost
//               and harvested the following summer, so they use their own math.
//
// Dates are derived from each crop's existing daysToHarvest (single source of
// truth — no second dataset to drift), padded by FALL_FACTOR_DAYS to account
// for slower growth as days shorten. See generateFallCropEvents().
// ============================================================================

const FALL_PLANTING = {
  broccoli:         { hardiness: "hardy",      methods: ["indoor", "transplant", "direct"] },
  cauliflower:      { hardiness: "semitender", methods: ["indoor", "transplant"] },
  cabbage:          { hardiness: "hardy",      methods: ["indoor", "transplant", "direct"] },
  kale:             { hardiness: "veryhardy",  methods: ["direct", "transplant"] },
  brussels_sprouts: { hardiness: "hardy",      methods: ["indoor", "transplant"] },
  carrots:          { hardiness: "hardy",      methods: ["direct"] },
  beets:            { hardiness: "hardy",      methods: ["direct"] },
  radishes:         { hardiness: "hardy",      methods: ["direct"] },
  turnips:          { hardiness: "hardy",      methods: ["direct"] },
  lettuce:          { hardiness: "semitender", methods: ["direct", "transplant", "indoor"] },
  spinach:          { hardiness: "veryhardy",  methods: ["direct"] },
  swiss_chard:      { hardiness: "hardy",      methods: ["direct", "transplant"] },
  arugula:          { hardiness: "hardy",      methods: ["direct"] },
  cilantro:         { hardiness: "hardy",      methods: ["direct"] },
  dill:             { hardiness: "semitender", methods: ["direct"] },
  peas:             { hardiness: "hardy",      methods: ["direct"] },
  bush_beans:       { hardiness: "tender",     methods: ["direct"] },
  garlic:           { special: "overwinter",   methods: ["direct"] },
};

// Attach the fall config onto the matching crop objects so `crop.fall` is
// available everywhere a crop is in hand. Crops with no entry simply have no
// `.fall` — that's the signal they're spring-only.
CROPS.forEach((c) => {
  if (FALL_PLANTING[c.id]) c.fall = FALL_PLANTING[c.id];
});

// Extra days added to a crop's days-to-harvest for fall sowings. Shortening
// days and cooling soil slow growth noticeably in late season; almanacs call
// this the "fall factor." Two weeks is the common rule of thumb.
const FALL_FACTOR_DAYS = 14;

// How many days BEFORE the first frost a crop should reach maturity, by
// hardiness. Negative = it's fine to mature after the first frost (it survives,
// and often improves). These shift the whole fall timeline earlier or later.
const FALL_FROST_BUFFER = {
  tender: 14,
  semitender: 7,
  hardy: 0,
  veryhardy: -10,
};

// ============================================================================
// PLANT FAMILIES + COMPANION PLANTING
// ----------------------------------------------------------------------------
// Two related datasets:
//
//   1. FAMILY — each crop's botanical family. This is the backbone of crop
//      rotation (don't follow a crop with another from the same family — they
//      share soil pests and nutrient demands) and informs companion advice.
//
//   2. COMPANIONS — curated "plant near / keep apart" guidance per crop, plus
//      a short plain-language note. Entries reference our own crop ids where a
//      specific tracked crop is meant (so the UI can show its emoji), or a
//      capitalized free-text name for plants/groups we don't track (Marigolds,
//      Nasturtiums, Brassicas, etc.).
//
// All of this is approximate, traditional companion-planting lore — helpful as
// a planning nudge, not hard science. The UI frames it that way.
// ============================================================================

// Friendly display names for each family code.
export const PLANT_FAMILIES = {
  solanaceae:     "Nightshades",
  brassicaceae:   "Brassicas (cabbage family)",
  cucurbitaceae:  "Cucurbits (squash family)",
  fabaceae:       "Legumes",
  apiaceae:       "Carrot & parsley family",
  amaranthaceae:  "Beet & chard family",
  asteraceae:     "Lettuce & daisy family",
  amaryllidaceae: "Alliums (onion family)",
  poaceae:        "Grasses",
  lamiaceae:      "Mint & basil family",
  convolvulaceae: "Morning-glory family",
};

// cropId → family code.
const FAMILY = {
  tomatoes: "solanaceae", peppers: "solanaceae", eggplant: "solanaceae", potatoes: "solanaceae",
  sweet_potatoes: "convolvulaceae",
  cucumbers: "cucurbitaceae", summer_squash: "cucurbitaceae", winter_squash: "cucurbitaceae", melons: "cucurbitaceae",
  bush_beans: "fabaceae", pole_beans: "fabaceae", peas: "fabaceae",
  broccoli: "brassicaceae", cauliflower: "brassicaceae", cabbage: "brassicaceae", kale: "brassicaceae",
  brussels_sprouts: "brassicaceae", radishes: "brassicaceae", turnips: "brassicaceae", arugula: "brassicaceae",
  carrots: "apiaceae", parsley: "apiaceae", dill: "apiaceae", cilantro: "apiaceae",
  beets: "amaranthaceae", spinach: "amaranthaceae", swiss_chard: "amaranthaceae",
  lettuce: "asteraceae",
  onions: "amaryllidaceae", garlic: "amaryllidaceae",
  sweet_corn: "poaceae",
  basil: "lamiaceae",
};

// Attach family onto each crop object (same pattern as the fall config).
CROPS.forEach((c) => { if (FAMILY[c.id]) c.family = FAMILY[c.id]; });

// Per-crop companion guidance. `good` / `bad` mix tracked crop ids and
// free-text names; `note` is one short sentence of plain-language advice.
const COMPANIONS = {
  tomatoes: {
    good: ["basil", "carrots", "onions", "garlic", "lettuce", "parsley", "Marigolds", "Nasturtiums", "Borage"],
    bad: ["potatoes", "Brassicas", "sweet_corn", "Fennel"],
    note: "Basil is the classic partner — said to improve flavor and repel pests. Keep away from brassicas, corn, and fennel.",
  },
  peppers: {
    good: ["basil", "onions", "carrots", "lettuce", "spinach", "parsley", "Marigolds"],
    bad: ["Brassicas", "Fennel"],
    note: "Likes the same friends as tomatoes. Keep fennel and cabbage-family crops well away.",
  },
  eggplant: {
    good: ["bush_beans", "peppers", "spinach", "basil", "Marigolds", "Tarragon"],
    bad: ["Fennel"],
    note: "Beans nearby fix nitrogen; marigolds deter the flea beetles that love eggplant.",
  },
  potatoes: {
    good: ["bush_beans", "sweet_corn", "cabbage", "Horseradish", "Marigolds"],
    bad: ["tomatoes", "cucumbers", "winter_squash", "Sunflowers", "Fennel"],
    note: "Keep away from tomatoes (shared blight) and sprawling cucurbits. Horseradish at the corners wards off potato beetles.",
  },
  sweet_potatoes: {
    good: ["bush_beans", "dill", "Thyme", "Oregano"],
    bad: ["winter_squash", "summer_squash"],
    note: "Sprawling vines — give them room away from other sprawlers like squash.",
  },
  cucumbers: {
    good: ["bush_beans", "peas", "sweet_corn", "radishes", "lettuce", "dill", "Nasturtiums", "Sunflowers"],
    bad: ["potatoes", "Sage", "melons"],
    note: "Beans and peas feed them nitrogen; radishes lure off cucumber beetles. Strong herbs like sage stunt them.",
  },
  summer_squash: {
    good: ["sweet_corn", "bush_beans", "peas", "radishes", "Nasturtiums", "Marigolds"],
    bad: ["potatoes"],
    note: "Part of the Three Sisters — corn, beans, and squash thrive together.",
  },
  winter_squash: {
    good: ["sweet_corn", "bush_beans", "Nasturtiums", "Marigolds"],
    bad: ["potatoes"],
    note: "Classic Three Sisters companion: it shades the soil while corn climbs and beans feed the bed.",
  },
  melons: {
    good: ["sweet_corn", "bush_beans", "radishes", "Nasturtiums", "Marigolds"],
    bad: ["potatoes", "cucumbers"],
    note: "Heat-lovers that need room; nasturtiums draw aphids away from the vines.",
  },
  bush_beans: {
    good: ["sweet_corn", "cucumbers", "summer_squash", "carrots", "cabbage", "potatoes", "Strawberries"],
    bad: ["onions", "garlic", "Fennel"],
    note: "Fixes its own nitrogen — a great lead-in to heavy feeders. Onions and garlic stunt it.",
  },
  pole_beans: {
    good: ["sweet_corn", "summer_squash", "radishes", "lettuce", "carrots"],
    bad: ["onions", "garlic", "beets", "Fennel"],
    note: "Let it climb corn as a living trellis (Three Sisters). Keep alliums and beets away.",
  },
  peas: {
    good: ["carrots", "radishes", "cucumbers", "sweet_corn", "turnips", "Mint"],
    bad: ["onions", "garlic"],
    note: "A nitrogen-fixer — follow it with leafy greens. Alliums inhibit its growth.",
  },
  broccoli: {
    good: ["onions", "garlic", "beets", "dill", "lettuce", "potatoes", "Chamomile", "Celery"],
    bad: ["tomatoes", "peppers", "Strawberries", "pole_beans"],
    note: "Aromatic alliums and dill deter cabbage pests. Keep away from nightshades and strawberries.",
  },
  cauliflower: {
    good: ["onions", "bush_beans", "beets", "Celery", "Chamomile"],
    bad: ["tomatoes", "Strawberries"],
    note: "A heavy feeder — beans nearby help. Avoid nightshades.",
  },
  cabbage: {
    good: ["onions", "garlic", "dill", "beets", "potatoes", "Celery", "Nasturtiums", "Chamomile"],
    bad: ["tomatoes", "Strawberries", "pole_beans"],
    note: "Dill draws beneficial wasps; nasturtiums act as an aphid trap crop.",
  },
  kale: {
    good: ["onions", "garlic", "beets", "dill", "cilantro", "lettuce"],
    bad: ["tomatoes", "Strawberries", "pole_beans"],
    note: "Interplant with alliums and aromatic herbs to confuse cabbage moths.",
  },
  brussels_sprouts: {
    good: ["onions", "garlic", "dill", "beets", "potatoes", "Thyme"],
    bad: ["tomatoes", "Strawberries"],
    note: "Tall and slow — underplant with low crops; alliums help deter aphids.",
  },
  radishes: {
    good: ["carrots", "lettuce", "cucumbers", "peas", "spinach", "Nasturtiums"],
    bad: ["Hyssop"],
    note: "Fast and useful — sow between slower crops and use them to lure flea beetles away.",
  },
  turnips: {
    good: ["peas", "bush_beans", "lettuce", "onions"],
    bad: ["potatoes"],
    note: "Peas and beans feed it nitrogen; keep clear of heavy feeders like potatoes.",
  },
  arugula: {
    good: ["lettuce", "spinach", "carrots", "bush_beans", "Nasturtiums"],
    bad: [],
    note: "Quick cut-and-come-again — tuck it between rows of slower crops.",
  },
  carrots: {
    good: ["onions", "lettuce", "radishes", "peas", "tomatoes", "Rosemary", "Sage", "Leeks"],
    bad: ["dill", "Fennel", "Parsnips"],
    note: "Onions and leeks mask the scent that draws carrot fly. Keep dill and fennel away.",
  },
  parsley: {
    good: ["tomatoes", "peppers", "carrots", "sweet_corn", "Asparagus"],
    bad: ["lettuce", "Mint"],
    note: "Let some flower to draw hoverflies and parasitic wasps.",
  },
  dill: {
    good: ["cabbage", "broccoli", "onions", "lettuce", "cucumbers", "sweet_corn"],
    bad: ["carrots", "tomatoes"],
    note: "A magnet for beneficial insects — but mature plants stunt carrots and tomatoes, so site it apart.",
  },
  cilantro: {
    good: ["spinach", "lettuce", "bush_beans", "peas", "tomatoes"],
    bad: ["Fennel"],
    note: "Let it bolt to attract pollinators and predatory insects.",
  },
  beets: {
    good: ["onions", "garlic", "lettuce", "cabbage", "broccoli", "bush_beans"],
    bad: ["pole_beans"],
    note: "Adds minerals back to the soil; happy alongside brassicas and alliums.",
  },
  spinach: {
    good: ["Strawberries", "peas", "bush_beans", "radishes", "lettuce", "cabbage"],
    bad: [],
    note: "Grows happily in the cool shade of taller crops like beans and corn.",
  },
  swiss_chard: {
    good: ["bush_beans", "onions", "cabbage", "lettuce"],
    bad: [],
    note: "Heat-tolerant and easygoing — pairs well with alliums and brassicas.",
  },
  lettuce: {
    good: ["carrots", "radishes", "onions", "beets", "cucumbers", "Strawberries"],
    bad: ["parsley"],
    note: "Tuck it under taller crops for afternoon shade to slow bolting.",
  },
  onions: {
    good: ["carrots", "beets", "lettuce", "cabbage", "broccoli", "tomatoes", "Strawberries"],
    bad: ["bush_beans", "peas", "Asparagus"],
    note: "Their scent deters many pests — but they stunt beans and peas, so keep legumes apart.",
  },
  garlic: {
    good: ["tomatoes", "cabbage", "broccoli", "carrots", "beets", "Roses", "Fruit trees"],
    bad: ["bush_beans", "peas"],
    note: "A broad-spectrum pest deterrent; just keep it away from legumes.",
  },
  sweet_corn: {
    good: ["bush_beans", "pole_beans", "summer_squash", "winter_squash", "cucumbers", "peas", "melons"],
    bad: ["tomatoes"],
    note: "The Three Sisters anchor — beans climb it and squash shades its roots. Shares pests with tomatoes.",
  },
  basil: {
    good: ["tomatoes", "peppers", "Oregano", "Asparagus"],
    bad: ["Sage", "Rue"],
    note: "Boosts tomato and pepper vigor and repels thrips and flies.",
  },
};

// Resolve a companion token to a display object. Tracked crop ids gain their
// emoji + proper name; free-text names pass through as-is.
function resolveCompanion(token) {
  const crop = CROPS.find((c) => c.id === token);
  if (crop) return { id: crop.id, label: crop.name, emoji: crop.emoji };
  return { id: null, label: token, emoji: null };
}

// Public: family info for a crop → { code, label } or null.
export function getCropFamily(cropId) {
  const crop = CROPS.find((c) => c.id === cropId);
  if (!crop || !crop.family) return null;
  return { code: crop.family, label: PLANT_FAMILIES[crop.family] || crop.family };
}

// Public: companion guidance for a crop, with tokens resolved for display.
// Returns { good: [{id,label,emoji}], bad: [...], note } or null if we have
// no companion data for this crop (e.g. the user's "Other / custom" crops).
export function getCompanions(cropId) {
  const c = COMPANIONS[cropId];
  if (!c) return null;
  return {
    good: (c.good || []).map(resolveCompanion),
    bad: (c.bad || []).map(resolveCompanion),
    note: c.note || "",
  };
}

// Public: crops that share a family with the given crop (excluding itself).
// The basis for rotation warnings later — exported now so it's ready.
export function sameFamilyCrops(cropId) {
  const crop = CROPS.find((c) => c.id === cropId);
  if (!crop || !crop.family) return [];
  return CROPS.filter((c) => c.id !== cropId && c.family === crop.family);
}

// ============================================================================
// CROP ROTATION
// ----------------------------------------------------------------------------
// The rule of thumb: don't grow a crop where the same botanical family grew
// last year — families share soil-borne pests and nutrient demands, so
// repeating them depletes the bed and lets problems build up. These tips give
// a friendly "what to follow with" nudge per family.
// ============================================================================
const FAMILY_ROTATION_TIP = {
  solanaceae:     "Follow nightshades with legumes (beans, peas) or leafy greens to rebuild the soil.",
  brassicaceae:   "Follow brassicas with legumes or fruiting crops — avoid back-to-back cabbage-family crops.",
  cucurbitaceae:  "Cucurbits are hungry feeders — follow them with legumes or root crops.",
  fabaceae:       "Legumes leave nitrogen behind — a perfect lead-in to heavy feeders like brassicas or nightshades.",
  apiaceae:       "Rotate carrots and their relatives off this spot to dodge carrot fly and root diseases.",
  amaranthaceae:  "Follow beets and chard with legumes or alliums.",
  asteraceae:     "Lettuce is light on the soil — most crops follow it happily.",
  amaryllidaceae: "Follow alliums with legumes or fruiting crops; keep onions off the same ground a year or two.",
  poaceae:        "Corn is a heavy feeder — follow it with legumes to restore nitrogen.",
  lamiaceae:      "",
  convolvulaceae: "",
};

// Public: given a crop the user wants to plant and the crop ids that grew in
// the SAME bed in a prior season, return a rotation conflict if they share a
// family — otherwise null.
//
//   candidateCropId — what they're planting now
//   priorCropIds    — what grew there before (any season but the current one)
//
// Returns { family: {code,label}, conflictingCrops: [names], tip } or null.
export function rotationConflict(candidateCropId, priorCropIds = []) {
  const fam = getCropFamily(candidateCropId);
  if (!fam) return null;
  // Resolve prior crops, keep only those sharing the candidate's family, and
  // de-dupe by name so "Tomatoes, Tomatoes" collapses to one.
  const seen = new Set();
  const conflictingCrops = [];
  for (const id of priorCropIds) {
    if (id === candidateCropId) {
      // Same exact crop repeated — still a conflict; label it by its own name.
    }
    const f = getCropFamily(id);
    if (!f || f.code !== fam.code) continue;
    const crop = CROPS.find((c) => c.id === id);
    const name = crop ? crop.name : id;
    if (seen.has(name)) continue;
    seen.add(name);
    conflictingCrops.push(name);
  }
  if (conflictingCrops.length === 0) return null;
  return {
    family: fam,
    conflictingCrops,
    tip: FAMILY_ROTATION_TIP[fam.code] || "Try a crop from a different family here this year.",
  };
}

// ============================================================================
// EVENT GENERATION FROM A CROP
// ============================================================================
//
// Given a crop ID, a frost-date pair, and which method the user wants to use
// (indoor / direct / transplant), generate a list of calendar events.
// Each event has: date (Date object), title, type ("garden"), and a notes field.
//
// Push 5: optional `variety` parameter for per-variety harvest timeframes.
// Shape: { id, name, daysToHarvest } — when provided, the variety's name
// appears in event titles instead of the generic crop name (so users with
// six tomato cultivars see "🧺 Sungold should be ready" not "🧺 Tomatoes
// should be ready"), and daysToHarvest drives the harvest-date math.
// When `variety` is null/undefined we use the crop-wide defaults — this is
// the legacy code path and behaves exactly as before.
// ============================================================================

const dayMs = 1000 * 60 * 60 * 24;

export function generateCropEvents(cropId, method, frostDates, variety = null, season = "spring") {
  const crop = CROPS.find((c) => c.id === cropId);
  if (!crop) return [];
  const events = [];
  const lf = frostDates.lastFrost;

  // Resolve the display name + days-to-harvest from variety if present.
  // displayName drives event titles; harvestDays drives the harvest-date math
  // and the "~X days from ..." note. Both fall back to crop-wide defaults.
  const displayName = variety && variety.name ? variety.name : crop.name;
  const harvestDays = (variety && Number.isFinite(variety.daysToHarvest))
    ? variety.daysToHarvest
    : crop.daysToHarvest;
  // Suffix the variety id into event ids so re-planning the same crop with a
  // different variety in the same year doesn't collide with the previous plan.
  const varietySuffix = variety && variety.id ? `-${variety.id}` : "";
  // Variety metadata copied onto every event so the calendar and any future
  // "edit this plan" flow can show which variety the event belongs to.
  const varietyMeta = variety
    ? { varietyId: variety.id || null, varietyName: variety.name || null }
    : {};

  // Helper: add weeks to a Date
  const addWeeks = (d, w) => new Date(d.getTime() + w * 7 * dayMs);

  // Fall planting follows entirely different timing math (anchored to the
  // FIRST frost, counted backwards), so hand it off to its own generator.
  if (season === "fall") {
    return generateFallCropEvents(crop, method, frostDates, {
      displayName, harvestDays, varietySuffix, varietyMeta,
    });
  }

  if (method === "indoor" && crop.methods.indoor) {
    const seedDate = addWeeks(lf, -crop.methods.indoor.weeksBeforeLastFrost);
    events.push({
      id: `crop-${cropId}${varietySuffix}-indoor-${seedDate.getTime()}`,
      date: dateToISO(seedDate),
      title: `🌱 Start ${displayName} seeds indoors`,
      type: "garden",
      cropId,
      kind: "indoor",
      ...varietyMeta,
      notes: crop.notes,
    });

    // If transplant method also exists, add the transplant event
    if (crop.methods.transplant) {
      const transplantDate = addWeeks(lf, crop.methods.transplant.weeksAfterLastFrost);
      events.push({
        id: `crop-${cropId}${varietySuffix}-transplant-${transplantDate.getTime()}`,
        date: dateToISO(transplantDate),
        title: `🌿 Transplant ${displayName} outdoors`,
        type: "garden",
        cropId,
	kind: "transplant",
        ...varietyMeta,
        notes: "Harden off for 7-10 days first.",
      });

      // Estimated harvest start
      if (harvestDays) {
        const harvestDate = new Date(transplantDate.getTime() + harvestDays * dayMs);
        events.push({
          id: `crop-${cropId}${varietySuffix}-harvest-${harvestDate.getTime()}`,
          date: dateToISO(harvestDate),
          title: `🧺 ${displayName} should be ready to harvest`,
          type: "garden",
          cropId,
	  kind: "harvest",
          ...varietyMeta,
          notes: `~${harvestDays} days from transplant.`,
        });
      }
    }
  } else if (method === "direct") {
    // Fall back to "1 week after last frost" when the crop's almanac entry
    // doesn't define direct-sow timing (e.g. tomatoes, peppers). The user
    // can adjust the date in the modal's editable-dates step. We also need
    // a harvestDays fallback for the harvest event — use the indoor or
    // transplant entry's days-to-harvest if available (same plant, same
    // maturation), otherwise skip the harvest event.
    const directWeeks = crop.methods.direct
      ? crop.methods.direct.weeksRelativeToLastFrost
      : 1;
    const sowDate = addWeeks(lf, directWeeks);
    events.push({
      id: `crop-${cropId}${varietySuffix}-direct-${sowDate.getTime()}`,
      date: dateToISO(sowDate),
      title: `🌱 Direct sow ${displayName}`,
      type: "garden",
      cropId,
      kind: "direct",
      ...varietyMeta,
      notes: crop.notes,
    });

    if (harvestDays) {
      const harvestDate = new Date(sowDate.getTime() + harvestDays * dayMs);
      events.push({
        id: `crop-${cropId}${varietySuffix}-harvest-${harvestDate.getTime()}`,
        date: dateToISO(harvestDate),
        title: `🧺 ${displayName} should be ready to harvest`,
        type: "garden",
        cropId,
	kind: "harvest",
        ...varietyMeta,
        notes: `~${harvestDays} days from direct sow.`,
      });
    }
  } else if (method === "transplant" && crop.methods.transplant) {
    const transplantDate = addWeeks(lf, crop.methods.transplant.weeksAfterLastFrost);
    events.push({
      id: `crop-${cropId}${varietySuffix}-transplant-${transplantDate.getTime()}`,
      date: dateToISO(transplantDate),
      title: `🌿 Transplant ${displayName} (from store-bought starts)`,
      type: "garden",
      cropId,
      kind: "transplant",
      ...varietyMeta,
      notes: crop.notes,
    });

    if (harvestDays) {
      const harvestDate = new Date(transplantDate.getTime() + harvestDays * dayMs);
      events.push({
        id: `crop-${cropId}${varietySuffix}-harvest-${harvestDate.getTime()}`,
        date: dateToISO(harvestDate),
        title: `🧺 ${displayName} should be ready to harvest`,
        type: "garden",
        cropId,
	kind: "harvest",
        ...varietyMeta,
        notes: `~${harvestDays} days from transplant.`,
      });
    }
  }

  // Tag every spring event with its season. (Additive — legacy saved events
  // without a season field are treated as "spring" by readers.)
  return events.map((e) => ({ season: "spring", ...e }));
}

// ============================================================================
// FALL EVENT GENERATION
// ----------------------------------------------------------------------------
// Mirror of the spring generator, anchored to the FIRST frost and counted
// backwards. The crop's days-to-harvest (variety-aware) is padded by the fall
// factor and offset by the hardiness buffer so the harvest lands near frost:
//
//   fallDays    = harvestDays + FALL_FACTOR_DAYS         (padded maturity)
//   groundDate  = firstFrost − buffer − fallDays         (sow / transplant)
//   harvestDate = groundDate + fallDays  (≈ firstFrost − buffer)
//   indoorStart = groundDate − indoor lead (reused from the spring entry)
//
// Garlic and other "overwinter" crops break this pattern — they're planted
// AROUND the first frost and harvested the next summer — so they get a
// dedicated branch.
//
// Event `kind` values match the spring generator ("indoor" | "transplant" |
// "direct" | "harvest") so downstream consumers (quick-log Plant Annual, the
// calendar) treat them identically. Every event carries season:"fall".
// ============================================================================
function generateFallCropEvents(crop, method, frostDates, ctx) {
  const { displayName, harvestDays, varietySuffix, varietyMeta } = ctx;
  if (!crop.fall) return []; // not a fall-capable crop
  const ff = frostDates.firstFrost;
  const cfg = crop.fall;
  const events = [];

  const mk = (kind, date, title, notes) => ({
    id: `crop-${crop.id}${varietySuffix}-fall-${kind}-${date.getTime()}`,
    date: dateToISO(date),
    title,
    type: "garden",
    cropId: crop.id,
    kind,
    season: "fall",
    ...varietyMeta,
    notes,
  });

  // --- Overwintering crops (garlic): plant around frost, harvest next year ---
  if (cfg.special === "overwinter") {
    const plantDate = new Date(ff.getTime());
    events.push(mk(
      "direct", plantDate,
      `🧄 Plant ${displayName} cloves`,
      "Plant around your first frost and mulch well. Roots establish before the ground freezes."
    ));
    if (harvestDays) {
      const harvestDate = new Date(plantDate.getTime() + harvestDays * dayMs);
      events.push(mk(
        "harvest", harvestDate,
        `🧺 ${displayName} should be ready to harvest`,
        "Harvest next summer once the lower leaves brown."
      ));
    }
    return events;
  }

  // --- Standard fall crops -------------------------------------------------
  const buffer = FALL_FROST_BUFFER[cfg.hardiness] ?? 0;
  const fallDays = (harvestDays || 60) + FALL_FACTOR_DAYS;
  const groundDate = new Date(ff.getTime() - (buffer + fallDays) * dayMs);
  const harvestDate = new Date(groundDate.getTime() + fallDays * dayMs);

  const harvestNote = cfg.hardiness === "veryhardy"
    ? "Frost-hardy — flavor sweetens after a frost. Harvest as needed; it holds in the ground."
    : `~${fallDays} days, padded for slower fall growth. Aim to finish around your first frost.`;

  if (method === "indoor" && (cfg.methods || []).includes("indoor")) {
    // Reuse the spring indoor lead time (weeks before transplant) if defined.
    const leadWeeks = crop.methods.indoor?.weeksBeforeLastFrost || 5;
    const indoorDate = new Date(groundDate.getTime() - leadWeeks * 7 * dayMs);
    events.push(mk(
      "indoor", indoorDate,
      `🌱 Start ${displayName} seeds indoors (fall crop)`,
      `${crop.notes} Start now for a fall harvest.`
    ));
    events.push(mk(
      "transplant", groundDate,
      `🌿 Transplant ${displayName} outdoors`,
      "Harden off for 7-10 days first. Water in well — late-summer soil is warm and dries fast."
    ));
    if (harvestDays) {
      events.push(mk("harvest", harvestDate, `🧺 ${displayName} should be ready to harvest`, harvestNote));
    }
  } else if (method === "transplant" && (cfg.methods || []).includes("transplant")) {
    events.push(mk(
      "transplant", groundDate,
      `🌿 Transplant ${displayName} (fall crop)`,
      "Set out store-bought or home-started seedlings. Shade and extra water help them through late-summer heat."
    ));
    if (harvestDays) {
      events.push(mk("harvest", harvestDate, `🧺 ${displayName} should be ready to harvest`, harvestNote));
    }
  } else {
    // Default / "direct": sow straight into the ground.
    events.push(mk(
      "direct", groundDate,
      `🌱 Direct sow ${displayName} (fall crop)`,
      `${crop.notes} Sown now to mature as the season cools.`
    ));
    if (harvestDays) {
      events.push(mk("harvest", harvestDate, `🧺 ${displayName} should be ready to harvest`, harvestNote));
    }
  }

  return events;
}
export function frostDateEvents(frostDates) {
  return [
    {
      id: `frost-last-${frostDates.lastFrost.getTime()}`,
      date: dateToISO(frostDates.lastFrost),
      title: `❄️ Average last frost`,
      type: "frost",
      notes: "After this date, the risk of frost is generally low.",
    },
    {
      id: `frost-first-${frostDates.firstFrost.getTime()}`,
      date: dateToISO(frostDates.firstFrost),
      title: `🍂 Average first frost`,
      type: "frost",
      notes: "Frost-tender plants should be harvested or covered by now.",
    },
  ];
}

function dateToISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Crops available to plant in a given season. Spring offers everything; fall
// offers only the cool-season crops tagged with a `fall` config.
export function cropsForSeason(season = "spring") {
  if (season === "fall") return CROPS.filter((c) => c.fall);
  return CROPS;
}

// Available planting methods for a crop, in user-facing order.
// `season` ("spring" | "fall") selects which set of methods applies — fall
// uses the curated list from the crop's `fall` config (e.g. carrots are
// direct-sow only, brassicas can be started indoors or transplanted).
export function methodsForCrop(cropId, season = "spring") {
  const crop = CROPS.find((c) => c.id === cropId);
  if (!crop) return [];

  if (season === "fall") {
    if (!crop.fall) return [];
    const labels = {
      indoor: "Start seeds indoors",
      transplant: crop.fall.special === "overwinter"
        ? "Transplant" : "Transplant seedlings",
      direct: crop.fall.special === "overwinter"
        ? "Plant cloves" : "Direct sow outdoors",
    };
    return (crop.fall.methods || ["direct"]).map((id) => ({ id, label: labels[id] || id }));
  }

  const methods = [];
  if (crop.methods.indoor) methods.push({ id: "indoor", label: "Start seeds indoors" });
  // Direct sow is always offered, even on crops that don't traditionally
  // get direct-sown (tomatoes, peppers, etc.) — users have asked for the
  // option universally. When the crop's almanac entry doesn't define
  // direct-sow timing, generateCropEvents falls back to "1 week after
  // last frost" as a safe suggestion (user can override the date).
  methods.push({ id: "direct", label: "Direct sow outdoors" });
  if (crop.methods.transplant) methods.push({ id: "transplant", label: "Transplant store-bought starts" });
  return methods;
}
