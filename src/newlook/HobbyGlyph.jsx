// ============================================================================
// New look (3.0) — one line icon per hobby
// ----------------------------------------------------------------------------
// The old hobby icons fell back to the same sprout for 14 of 21 hobbies. Each
// hobby type gets its own glyph here (lucide where one fits, a small drawn
// one for goats).
// ============================================================================

import React from "react";
import {
  Egg, Drumstick, Rabbit, Hexagon, Thermometer, Milk, PiggyBank, PawPrint, Dog, Cat,
  Sprout, TreeDeciduous, Crosshair, Wheat, CakeSlice, CookingPot, FlaskConical, Droplets, Store, Leaf,
} from "lucide-react";

const GoatIcon = ({ size = 20, strokeWidth = 1.8, color = "currentColor", ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    <path d="M6 10c0-3 3-5 6-5s6 2 6 5v5a6 6 0 0 1-12 0z" />
    <path d="M6 8L3 6M18 8l3-2" />
    <path d="M10 18h4" />
  </svg>
);

const BY_TYPE = {
  egg_layers: Egg, meat_chickens: Drumstick, rabbits: Rabbit, bees: Hexagon, incubator: Thermometer,
  goats: GoatIcon, cows: Milk, pigs: PiggyBank, sheep: PawPrint, horses: PawPrint, dogs: Dog, cats: Cat,
  garden: Sprout, maple_syrup: TreeDeciduous, hunting: Crosshair, sourdough: Wheat, baking: CakeSlice,
  preserving: CookingPot, canning: CookingPot, freeze_drying: CookingPot, dehydrating: CookingPot, fermentation: CookingPot,
  herbalism: FlaskConical, tincture: FlaskConical, oil_infusion: FlaskConical, salve: FlaskConical, tea: Leaf,
  soap: Droplets, farmstand: Store,
};

export default function HobbyGlyph({ type, size = 20, strokeWidth = 1.8, color }) {
  const Icon = BY_TYPE[type] || Sprout;
  return <Icon size={size} strokeWidth={strokeWidth} color={color} aria-hidden="true" />;
}
