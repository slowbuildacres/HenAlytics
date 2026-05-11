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

export function generateCropEvents(cropId, method, frostDates, variety = null) {
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

  if (method === "indoor" && crop.methods.indoor) {
    const seedDate = addWeeks(lf, -crop.methods.indoor.weeksBeforeLastFrost);
    events.push({
      id: `crop-${cropId}${varietySuffix}-indoor-${seedDate.getTime()}`,
      date: dateToISO(seedDate),
      title: `🌱 Start ${displayName} seeds indoors`,
      type: "garden",
      cropId,
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
          ...varietyMeta,
          notes: `~${harvestDays} days from transplant.`,
        });
      }
    }
  } else if (method === "direct" && crop.methods.direct) {
    const sowDate = addWeeks(lf, crop.methods.direct.weeksRelativeToLastFrost);
    events.push({
      id: `crop-${cropId}${varietySuffix}-direct-${sowDate.getTime()}`,
      date: dateToISO(sowDate),
      title: `🌱 Direct sow ${displayName}`,
      type: "garden",
      cropId,
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
        ...varietyMeta,
        notes: `~${harvestDays} days from transplant.`,
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
