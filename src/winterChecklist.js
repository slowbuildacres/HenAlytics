// ============================================================================
// Winter on the homestead checklist data (moved out of HomesteadApp.jsx for 3.0)
// ============================================================================

import { getCurrentHemisphere } from "./units.js";

export function winterSeason(now = new Date()) {
  const south = getCurrentHemisphere() === "south";
  const m = now.getMonth(), y = now.getFullYear();
  if (south) return m >= 4 && m <= 7 ? `S${y}` : null;
  if (m >= 10) return `${y}-${y + 1}`;
  if (m <= 1) return `${y - 1}-${y}`;
  return null;
}

export const WINTER_ITEMS = {
  egg_layers: [
    { id: "water", icon: "💧", text: "Keep water from freezing", sub: "A heated base, or swap waterers morning and evening. Hens lay less when they can't drink." },
    { id: "lamp", icon: "🔥", text: "Heat lamp? Secure it twice, or skip it", sub: "Heat lamps start many coop fires. Most cold-hardy breeds are fine without heat." },
    { id: "vent", icon: "🌬️", text: "Check coop ventilation", sub: "Frostbite comes from damp air, not cold. Vents above the roost, no drafts at roost height." },
    { id: "bedding", icon: "🌾", text: "Add deep bedding", sub: "Fresh straw or shavings for warmth. Deep litter composts in place over winter." },
    { id: "collect", icon: "🥚", text: "Collect eggs twice a day", sub: "Eggs can freeze and crack in the nest on cold days." },
  ],
  garden: [
    { id: "seedbox", icon: "🌾", text: "Take stock of your seed box", sub: "Mark what's low or getting old before you order.", action: "seeds" },
    { id: "order", icon: "🛒", text: "Order seeds", sub: "Popular varieties sell out by February.", action: "shop" },
    { id: "plan", icon: "🗺️", text: "Plan next year's beds", sub: "On the garden map, Henalytics flags crops from the same family in the same spot.", action: "map" },
    { id: "tools", icon: "🧰", text: "Clean, sharpen and oil tools", sub: "Saves rust and blisters come spring." },
    { id: "onions", icon: "🧅", text: "Start onions and leeks indoors", sub: "Usually 10 to 12 weeks before your last frost." },
  ],
};
