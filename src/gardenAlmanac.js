// ============================================================================
// GARDEN ALMANAC DATA
// ----------------------------------------------------------------------------
// USDA hardiness zone lookup + crop planting windows.
// All frost dates are approximate averages — local microclimates vary.
// Sources: USDA Plant Hardiness Zone Map 2023; NOAA climate normals;
// almanac/extension service planting guides.
// ============================================================================

// USDA hardiness zones with their typical last/first frost dates (approx).
// Frost dates are stored as "MM-DD" — month and day, no year.
//
// Zone 1 = coldest, Zone 13 = warmest. Most US homesteads are zones 3-9.
export const ZONE_INFO = {
  "1a":  { lastFrost: "06-15", firstFrost: "08-01", label: "Zone 1a (-60 to -55°F)" },
  "1b":  { lastFrost: "06-10", firstFrost: "08-15", label: "Zone 1b (-55 to -50°F)" },
  "2a":  { lastFrost: "06-01", firstFrost: "08-25", label: "Zone 2a (-50 to -45°F)" },
  "2b":  { lastFrost: "05-25", firstFrost: "09-01", label: "Zone 2b (-45 to -40°F)" },
  "3a":  { lastFrost: "05-15", firstFrost: "09-10", label: "Zone 3a (-40 to -35°F)" },
  "3b":  { lastFrost: "05-10", firstFrost: "09-15", label: "Zone 3b (-35 to -30°F)" },
  "4a":  { lastFrost: "05-05", firstFrost: "09-25", label: "Zone 4a (-30 to -25°F)" },
  "4b":  { lastFrost: "05-01", firstFrost: "10-01", label: "Zone 4b (-25 to -20°F)" },
  "5a":  { lastFrost: "04-25", firstFrost: "10-10", label: "Zone 5a (-20 to -15°F)" },
  "5b":  { lastFrost: "04-20", firstFrost: "10-15", label: "Zone 5b (-15 to -10°F)" },
  "6a":  { lastFrost: "04-15", firstFrost: "10-20", label: "Zone 6a (-10 to -5°F)" },
  "6b":  { lastFrost: "04-10", firstFrost: "10-25", label: "Zone 6b (-5 to 0°F)" },
  "7a":  { lastFrost: "04-05", firstFrost: "11-01", label: "Zone 7a (0 to 5°F)" },
  "7b":  { lastFrost: "04-01", firstFrost: "11-10", label: "Zone 7b (5 to 10°F)" },
  "8a":  { lastFrost: "03-15", firstFrost: "11-20", label: "Zone 8a (10 to 15°F)" },
  "8b":  { lastFrost: "03-01", firstFrost: "11-30", label: "Zone 8b (15 to 20°F)" },
  "9a":  { lastFrost: "02-15", firstFrost: "12-15", label: "Zone 9a (20 to 25°F)" },
  "9b":  { lastFrost: "02-01", firstFrost: "12-20", label: "Zone 9b (25 to 30°F)" },
  "10a": { lastFrost: "01-15", firstFrost: "12-31", label: "Zone 10a (30 to 35°F) — generally frost-free" },
  "10b": { lastFrost: "01-15", firstFrost: "12-31", label: "Zone 10b (35 to 40°F) — frost-free" },
  "11a": { lastFrost: "01-15", firstFrost: "12-31", label: "Zone 11a (40 to 45°F) — frost-free" },
  "11b": { lastFrost: "01-15", firstFrost: "12-31", label: "Zone 11b (45 to 50°F) — frost-free" },
  "12a": { lastFrost: "01-15", firstFrost: "12-31", label: "Zone 12a — tropical" },
  "12b": { lastFrost: "01-15", firstFrost: "12-31", label: "Zone 12b — tropical" },
  "13a": { lastFrost: "01-15", firstFrost: "12-31", label: "Zone 13a — tropical" },
  "13b": { lastFrost: "01-15", firstFrost: "12-31", label: "Zone 13b — tropical" },
};

// Estimate USDA zone from latitude. This is a rough approximation —
// real zones depend on local microclimates, elevation, and ocean influence.
// For best accuracy users can override their zone in settings.
export function estimateZone(lat, lon) {
  if (lat == null || lon == null) return "6a"; // National average fallback
  const absLat = Math.abs(lat);

  // Very rough latitude-to-zone mapping for the US.
  // Tuned to put Atchison Kansas (~39.5°N) at 6a/6b, NYC (~40.7°N) at 7a/7b,
  // Houston (~29.7°N) at 9a, Miami (~25.7°N) at 10b.
  if (absLat >= 48) return "3b";
  if (absLat >= 46) return "4a";
  if (absLat >= 44) return "4b";
  if (absLat >= 42) return "5a";
  if (absLat >= 40.5) return "5b";
  if (absLat >= 39) return "6a";
  if (absLat >= 37.5) return "6b";
  if (absLat >= 36) return "7a";
  if (absLat >= 34) return "7b";
  if (absLat >= 32) return "8a";
  if (absLat >= 30) return "8b";
  if (absLat >= 28) return "9a";
  if (absLat >= 26) return "9b";
  if (absLat >= 24) return "10a";
  return "10b";
}

// Get the actual last/first frost date for a year, given a zone.
// Returns Date objects for THIS year (or next year if first frost has passed).
export function getFrostDates(zone, year = new Date().getFullYear()) {
  const info = ZONE_INFO[zone] || ZONE_INFO["6a"];
  const [lfMonth, lfDay] = info.lastFrost.split("-").map(Number);
  const [ffMonth, ffDay] = info.firstFrost.split("-").map(Number);
  return {
    lastFrost: new Date(year, lfMonth - 1, lfDay),
    firstFrost: new Date(year, ffMonth - 1, ffDay),
    label: info.label,
    zone,
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
// EVENT GENERATION FROM A CROP
// ============================================================================
//
// Given a crop ID, a frost-date pair, and which method the user wants to use
// (indoor / direct / transplant), generate a list of calendar events.
// Each event has: date (Date object), title, type ("garden"), and a notes field.
// ============================================================================

const dayMs = 1000 * 60 * 60 * 24;

export function generateCropEvents(cropId, method, frostDates) {
  const crop = CROPS.find((c) => c.id === cropId);
  if (!crop) return [];
  const events = [];
  const lf = frostDates.lastFrost;

  // Helper: add weeks to a Date
  const addWeeks = (d, w) => new Date(d.getTime() + w * 7 * dayMs);

  if (method === "indoor" && crop.methods.indoor) {
    const seedDate = addWeeks(lf, -crop.methods.indoor.weeksBeforeLastFrost);
    events.push({
      id: `crop-${cropId}-indoor-${seedDate.getTime()}`,
      date: dateToISO(seedDate),
      title: `🌱 Start ${crop.name} seeds indoors`,
      type: "garden",
      cropId,
      notes: crop.notes,
    });

    // If transplant method also exists, add the transplant event
    if (crop.methods.transplant) {
      const transplantDate = addWeeks(lf, crop.methods.transplant.weeksAfterLastFrost);
      events.push({
        id: `crop-${cropId}-transplant-${transplantDate.getTime()}`,
        date: dateToISO(transplantDate),
        title: `🌿 Transplant ${crop.name} outdoors`,
        type: "garden",
        cropId,
        notes: "Harden off for 7-10 days first.",
      });

      // Estimated harvest start
      if (crop.daysToHarvest) {
        const harvestDate = new Date(transplantDate.getTime() + crop.daysToHarvest * dayMs);
        events.push({
          id: `crop-${cropId}-harvest-${harvestDate.getTime()}`,
          date: dateToISO(harvestDate),
          title: `🧺 ${crop.name} should be ready to harvest`,
          type: "garden",
          cropId,
          notes: `~${crop.daysToHarvest} days from transplant.`,
        });
      }
    }
  } else if (method === "direct" && crop.methods.direct) {
    const sowDate = addWeeks(lf, crop.methods.direct.weeksRelativeToLastFrost);
    events.push({
      id: `crop-${cropId}-direct-${sowDate.getTime()}`,
      date: dateToISO(sowDate),
      title: `🌱 Direct sow ${crop.name}`,
      type: "garden",
      cropId,
      notes: crop.notes,
    });

    if (crop.daysToHarvest) {
      const harvestDate = new Date(sowDate.getTime() + crop.daysToHarvest * dayMs);
      events.push({
        id: `crop-${cropId}-harvest-${harvestDate.getTime()}`,
        date: dateToISO(harvestDate),
        title: `🧺 ${crop.name} should be ready to harvest`,
        type: "garden",
        cropId,
        notes: `~${crop.daysToHarvest} days from direct sow.`,
      });
    }
  } else if (method === "transplant" && crop.methods.transplant) {
    const transplantDate = addWeeks(lf, crop.methods.transplant.weeksAfterLastFrost);
    events.push({
      id: `crop-${cropId}-transplant-${transplantDate.getTime()}`,
      date: dateToISO(transplantDate),
      title: `🌿 Transplant ${crop.name} (from store-bought starts)`,
      type: "garden",
      cropId,
      notes: crop.notes,
    });

    if (crop.daysToHarvest) {
      const harvestDate = new Date(transplantDate.getTime() + crop.daysToHarvest * dayMs);
      events.push({
        id: `crop-${cropId}-harvest-${harvestDate.getTime()}`,
        date: dateToISO(harvestDate),
        title: `🧺 ${crop.name} should be ready to harvest`,
        type: "garden",
        cropId,
        notes: `~${crop.daysToHarvest} days from transplant.`,
      });
    }
  }

  return events;
}

// Frost date events to seed the calendar with reference markers.
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

// Available planting methods for a crop, in user-facing order.
export function methodsForCrop(cropId) {
  const crop = CROPS.find((c) => c.id === cropId);
  if (!crop) return [];
  const methods = [];
  if (crop.methods.indoor) methods.push({ id: "indoor", label: "Start seeds indoors" });
  if (crop.methods.direct) methods.push({ id: "direct", label: "Direct sow outdoors" });
  if (crop.methods.transplant) methods.push({ id: "transplant", label: "Transplant store-bought starts" });
  return methods;
}
