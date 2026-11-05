// ============================================================================
// New look (3.0) — hobby map
// ----------------------------------------------------------------------------
// Pure helpers shared by the switcher, the Log picker, Home and the headers:
// which page a hobby opens, how hobbies group, display names, and the quick
// log actions each hobby offers in the Log picker.
// ============================================================================

// Garden, egg layers and meat birds render on the generic "home" page (keyed
// off activeHobby); every other hobby has a page named after its type.
export const HOME_PAGE_TYPES = ["garden", "egg_layers", "meat_chickens"];
export const PRESERVING_TYPES = ["canning", "freeze_drying", "dehydrating", "fermentation"];
export const HERBAL_TYPES = ["tincture", "oil_infusion", "salve", "tea"];

// Hobby names as people typed them sometimes carry emoji ("Rabbits 🐇"); the
// new look shows plain words with a line icon instead.
export function cleanName(name) {
  return String(name || "").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/\s{2,}/g, " ").trim();
}

export function hobbyPage(h) {
  if (!h) return "home";
  return HOME_PAGE_TYPES.includes(h.type) ? "home" : h.type;
}

// Every page that shows one hobby (gets the hobby-name header in the new look).
export const HOBBY_PAGES = [
  "home", "rabbits", "bees", "incubator", "goats", "cows", "pigs", "sheep", "horses",
  "sourdough", "farmstand", "baking", ...PRESERVING_TYPES, ...HERBAL_TYPES,
  "dogs", "cats", "maple_syrup", "hunting", "soap",
];

export const GROUPS = [
  { key: "animals", label: "Animals", types: ["egg_layers", "meat_chickens", "rabbits", "bees", "incubator", "goats", "cows", "pigs", "sheep", "horses", "dogs", "cats"] },
  { key: "land", label: "Garden & land", types: ["garden", "maple_syrup", "hunting"] },
  { key: "kitchen", label: "Kitchen & pantry", types: ["sourdough", "baking", "preserving"] },
  { key: "crafts", label: "Crafts & herbal", types: ["soap", "herbalism"] },
  { key: "selling", label: "Selling", types: ["farmstand"] },
];

// Visible hobbies as switcher entries. Preserving and herbalism sub-hobbies
// collapse into one entry each (their pages carry their own tabs).
export function switcherEntries(hobbies) {
  const vis = (hobbies || []).filter((h) => h && !h.hidden);
  const out = [];
  const pres = vis.filter((h) => PRESERVING_TYPES.includes(h.type));
  const herb = vis.filter((h) => HERBAL_TYPES.includes(h.type));
  for (const h of vis) {
    if (PRESERVING_TYPES.includes(h.type) || HERBAL_TYPES.includes(h.type)) continue;
    out.push({ key: h.id, type: h.type, name: cleanName(h.name) || h.type, icon: h.icon, hobby: h, ids: [h.id] });
  }
  if (pres.length) {
    const first = PRESERVING_TYPES.map((t) => pres.find((h) => h.type === t)).find(Boolean);
    out.push({ key: "preserving", type: "preserving", name: "Preserving", icon: first.icon, hobby: first, ids: pres.map((h) => h.id) });
  }
  if (herb.length) {
    const first = HERBAL_TYPES.map((t) => herb.find((h) => h.type === t)).find(Boolean);
    out.push({ key: "herbalism", type: "herbalism", name: "Herbalism", icon: first.icon, hobby: first, ids: herb.map((h) => h.id) });
  }
  return out;
}

export function groupedEntries(hobbies) {
  const entries = switcherEntries(hobbies);
  const used = new Set();
  const groups = GROUPS.map((g) => {
    const items = entries.filter((e) => g.types.includes(e.type));
    items.forEach((e) => used.add(e.key));
    return { ...g, items };
  }).filter((g) => g.items.length);
  const rest = entries.filter((e) => !used.has(e.key));
  if (rest.length) groups.push({ key: "other", label: "Other", types: [], items: rest });
  return groups;
}

// The switcher entry that contains the active hobby.
export function entryForHobby(hobbies, activeHobbyId) {
  return switcherEntries(hobbies).find((e) => e.ids.includes(activeHobbyId)) || null;
}

// Quick actions per hobby type for the Log picker. `action` = a LogModal
// action; `modal` = another modal type. Hobbies not listed here log on their
// own page for now (each one gets its picker actions when it is rebuilt in
// phase 3), so the picker offers "Open <hobby>" instead.
export const LOG_ACTIONS = {
  egg_layers: [
    { key: "eggs", label: "Eggs", icon: "egg", primary: true },
    { key: "fed", label: "Fed", icon: "feed" },
    { key: "sold_eggs", label: "Sold", icon: "sold" },
    { key: "used_eggs", label: "Used", icon: "used" },
    { key: "broody", label: "Broody", icon: "nest" },
    { key: "bedding", label: "Bedding", icon: "bedding" },
    { key: "note", label: "Note", icon: "note" },
  ],
  garden: [
    { key: "harvested", label: "Harvest", icon: "harvest", primary: true },
    { key: "watered", label: "Watered", icon: "water" },
    { key: "note", label: "Note", icon: "note" },
    { key: "more", label: "More", icon: "more", modal: "gardenMore" },
  ],
  // Goat forms live on the goat page: `onPage` sends the app there and asks
  // the page to open its own form (requestHobbyAction).
  goats: [
    { key: "milk", label: "Milk", icon: "milk", primary: true, onPage: true },
    { key: "fed", label: "Fed", icon: "feed", onPage: true },
    { key: "health", label: "Health", icon: "health", onPage: true },
    { key: "weight", label: "Weight", icon: "weight", onPage: true },
    { key: "kid", label: "Kidding", icon: "kid", onPage: true },
    { key: "breeding", label: "Breeding", icon: "heart", onPage: true },
    { key: "note", label: "Note", icon: "note", onPage: true },
  ],
  cows: [
    { key: "milk", label: "Milk", icon: "milk", primary: true, onPage: true },
    { key: "fed", label: "Fed", icon: "feed", onPage: true },
    { key: "health", label: "Health", icon: "health", onPage: true },
    { key: "weight", label: "Weight", icon: "weight", onPage: true },
    { key: "calf", label: "Calving", icon: "kid", onPage: true },
    { key: "breeding", label: "Breeding", icon: "heart", onPage: true },
    { key: "heat", label: "Heat", icon: "heat", onPage: true },
    { key: "note", label: "Note", icon: "note", onPage: true },
  ],
  pigs: [
    { key: "fed", label: "Fed", icon: "feed", primary: true, onPage: true },
    { key: "bred", label: "Bred", icon: "heart", onPage: true },
    { key: "litter", label: "Farrowing", icon: "kid", onPage: true },
    { key: "weight", label: "Weight", icon: "weight", onPage: true },
    { key: "health", label: "Health", icon: "health", onPage: true },
    { key: "note", label: "Note", icon: "note", onPage: true },
  ],
  sheep: [
    { key: "fed", label: "Fed", icon: "feed", primary: true, onPage: true },
    { key: "milk", label: "Milk", icon: "milk", onPage: true },
    { key: "breeding", label: "Breeding", icon: "heart", onPage: true },
    { key: "shear", label: "Shearing", icon: "shear", onPage: true },
    { key: "weight", label: "Weight", icon: "weight", onPage: true },
    { key: "health", label: "Health", icon: "health", onPage: true },
    { key: "note", label: "Note", icon: "note", onPage: true },
  ],
  horses: [
    { key: "ride", label: "Ride", icon: "ride", primary: true, onPage: true },
    { key: "fed", label: "Fed", icon: "feed", onPage: true },
    { key: "farrier", label: "Farrier", icon: "farrier", onPage: true },
    { key: "vet", label: "Vet", icon: "health", onPage: true },
    { key: "deworming", label: "Dewormer", icon: "pill", onPage: true },
    { key: "breeding", label: "Breeding", icon: "heart", onPage: true },
  ],
  bees: [
    { key: "inspect", label: "Inspect", icon: "inspect", primary: true, onPage: true },
    { key: "harvest", label: "Harvest", icon: "harvest", onPage: true },
    { key: "varroa", label: "Mite test", icon: "bug", onPage: true },
    { key: "feed", label: "Feed", icon: "feed", onPage: true },
    { key: "treatment", label: "Treatment", icon: "pill", onPage: true },
    { key: "note", label: "Note", icon: "note", onPage: true },
  ],
  incubator: [
    { key: "newRun", label: "Set eggs", icon: "egg", primary: true, onPage: true },
    { key: "newBrooder", label: "Add chicks", icon: "nest", onPage: true },
  ],
  rabbits: [
    { key: "fed", label: "Fed", icon: "feed", primary: true, onPage: true },
    { key: "bred", label: "Bred", icon: "heart", onPage: true },
    { key: "litter", label: "Litter", icon: "kid", onPage: true },
    { key: "weight", label: "Weight", icon: "weight", onPage: true },
    { key: "health", label: "Health", icon: "health", onPage: true },
    { key: "note", label: "Note", icon: "note", onPage: true },
  ],
  meat_chickens: [
    { key: "fed", label: "Fed", icon: "feed", primary: true },
    { key: "watered", label: "Watered", icon: "water" },
    { key: "move_tractor", label: "Move tractor", icon: "move" },
    { key: "note", label: "Note", icon: "note" },
  ],
};
