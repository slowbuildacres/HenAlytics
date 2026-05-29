// ============================================================================
// Suggestions.jsx — Celebrations engine + inline home-screen card
// ----------------------------------------------------------------------------
// The "neighbor leaning on the fence" feature. Notices a real moment, says one
// quiet thing, and gets out of the way. NOT a badge system, not a nag, not a
// parade. See henalytics-tone-guide.md for the voice rules this code serves.
//
// DESIGN CONTRACT (do not break these without re-reading the tone guide):
//   1. A celebration fires ONCE per id, ever. Dismissed = gone forever.
//      Repeating milestones (100 jars, 200 jars) each get their own id.
//   2. We never fire retroactively. On first run for an existing user we record
//      a silent baseline so someone who already has 5,000 eggs isn't ambushed
//      with "First egg!" — that moment already passed.
//   3. We only react to INCREASES, detected in-session, after data has loaded.
//   4. The engine is pure + data-shape-faithful. Field paths were read from the
//      real HomesteadApp data, not guessed:
//        - eggs:    data.entries.egg_layers[], action "eggs"|"eggs_laid",
//                   numeric `count`, attributed to a flock via `flockId`
//        - jars:    hobby.batches[].jarsMade  (canning lives in batches, NOT entries)
//        - harvest: garden harvest entries carry a per-entry `unit`; you CANNOT
//                   sum across units. We count lbs-unit entries only (plus legacy
//                   no-unit entries, which are implicitly lbs).
//
// PUBLIC API:
//   defaultCelebrationState()        -> object for defaultData()
//   migrateCelebrationState(data)    -> call inside migrateData(); back-marks
//                                       already-passed milestones as celebrated
//   detectCelebrations(data, prev)   -> returns the single celebration to show
//                                       now (or null). `prev` is the in-session
//                                       baseline ref value.
//   computeCelebrationSignals(data)  -> the raw numbers, exposed for the baseline
//   <CelebrationCard celebration onDismiss palette />  -> the inline card
// ============================================================================

import React from "react";

// ---- Celebration catalog ----------------------------------------------------
// Each entry: id (stable, unique, one-time), the copy (tone-guide voice), and
// an optional `reviewWorthy` flag — these are the happy moments we also let the
// App Store review prompt piggyback on (the big, unambiguous wins).
//
// COPY RULES (from the tone guide), applied here:
//   - Lead with the thing, not a congratulation. "One hundred jars." not
//     "Congrats on 100 jars!"
//   - A nod, not a parade. No exclamation pile-ups, no "You're crushing it!"
//   - Short. One or two lines.
const CELEBRATIONS = {
  first_egg: {
    id: "first_egg",
    emoji: "🥚",
    title: "Your first egg.",
    body: "The flock's laying. That's the one you remember.",
    hobby: "egg_layers", // matches activeHobby — only shows on the egg-layers tab
    reviewWorthy: false, // emotional, but very early in a user's journey
  },
  jars_100: {
    id: "jars_100",
    emoji: "🫙",
    title: "One hundred jars.",
    body: "That's a real shelf full. A season's worth of work, put up.",
    hobby: "canning",
    reviewWorthy: true,
  },
  harvest_100lb: {
    id: "harvest_100lb",
    emoji: "🧺",
    title: "A hundred pounds out of the garden.",
    body: "That's a lot of dinners that started as seeds.",
    hobby: "garden",
    reviewWorthy: true,
  },
  eggs_1000: {
    id: "eggs_1000",
    emoji: "🥚",
    title: "A thousand eggs collected.",
    body: "The coop's earned its keep.",
    hobby: "egg_layers",
    // The existing egg-milestone system already owns the review ask at 1,000,
    // so the celebration card stays a pure nod — no double prompt.
    reviewWorthy: false,
  },
  eggs_5000: {
    id: "eggs_5000",
    emoji: "🥚",
    title: "Five thousand eggs.",
    body: "That's a lot of mornings out to the coop.",
    hobby: "egg_layers",
    reviewWorthy: false,
  },
  bakes_50: {
    id: "bakes_50",
    emoji: "🍞",
    title: "Fifty loaves out of your oven.",
    body: "The starter's earned its name by now.",
    hobby: "sourdough",
    reviewWorthy: true,
  },
  first_hatch: {
    id: "first_hatch",
    emoji: "🐣",
    title: "First chicks hatched.",
    body: "From egg to peeping in three weeks — never not a small miracle.",
    hobby: "incubator",
    reviewWorthy: false, // first-of-something, often early — keep it pure joy
  },
  hatched_100: {
    id: "hatched_100",
    emoji: "🐣",
    title: "A hundred chicks hatched.",
    body: "That's a real hatchery you're running.",
    hobby: "incubator",
    reviewWorthy: true,
  },
  jars_500: {
    id: "jars_500",
    emoji: "🫙",
    title: "Five hundred jars.",
    body: "The pantry's the envy of the county.",
    hobby: "canning",
    reviewWorthy: true,
  },
  // --- Livestock births. Fire only when offspring were born (>= 1) and NEVER
  // cite the count — a birth record may also carry losses, and "6 puppies!" on a
  // litter that lost two would land terribly. A warm, count-free nod is safe. ---
  first_litter_dogs: {
    id: "first_litter_dogs",
    emoji: "🐶",
    title: "Your first litter.",
    body: "Whelping box to wagging tails. Long nights ahead, good ones too.",
    hobby: "dogs",
    reviewWorthy: false, // emotional moment, not a "rate us" moment
  },
  first_litter_cats: {
    id: "first_litter_cats",
    emoji: "🐱",
    title: "Your first litter.",
    body: "Kittens on the homestead. The barn just got busier.",
    hobby: "cats",
    reviewWorthy: false,
  },
  first_lambing: {
    id: "first_lambing",
    emoji: "🐑",
    title: "Your first lambing.",
    body: "Lambs on the ground. The flock carries forward.",
    hobby: "sheep",
    reviewWorthy: false,
  },
  first_foal: {
    id: "first_foal",
    emoji: "🐴",
    title: "Your first foal.",
    body: "Long-legged and brand new. That's a morning you don't forget.",
    hobby: "horses",
    reviewWorthy: false,
  },
  first_calf: {
    id: "first_calf",
    emoji: "🐄",
    title: "Your first calf.",
    body: "New on the pasture. The herd grows.",
    hobby: "cows",
    reviewWorthy: false,
  },
  first_kid: {
    id: "first_kid",
    emoji: "🐐",
    title: "Your first kid.",
    body: "Wobbly and already climbing things. Goats will be goats.",
    hobby: "goats",
    reviewWorthy: false,
  },
  // --- Output / volume firsts and milestones ---
  first_syrup: {
    id: "first_syrup",
    emoji: "🍁",
    title: "First syrup off the evaporator.",
    body: "Forty gallons of sap for this. Worth every hour of boiling.",
    hobby: "maple_syrup",
    reviewWorthy: false,
  },
  first_meat_batch: {
    id: "first_meat_batch",
    emoji: "🐔",
    title: "First batch raised to harvest.",
    body: "Start to finish, you saw it through. That's the whole point.",
    hobby: "meat_chickens",
    reviewWorthy: true,
  },
  freeze_25: {
    id: "freeze_25",
    emoji: "❄️",
    title: "Twenty-five batches freeze-dried.",
    body: "A pantry that'll outlast the power going out.",
    hobby: "freeze_drying",
    reviewWorthy: true,
  },
  dehydrate_25: {
    id: "dehydrate_25",
    emoji: "🌬️",
    title: "Twenty-five batches dried.",
    body: "Jerky, fruit, herbs — the dehydrator's earned its shelf space.",
    hobby: "dehydrating",
    reviewWorthy: true,
  },
  ferment_25: {
    id: "ferment_25",
    emoji: "🫧",
    title: "Twenty-five ferments going.",
    body: "Kraut, kimchi, a crock always bubbling. The good kind of busy.",
    hobby: "fermentation",
    reviewWorthy: true,
  },
};

// Repeating milestones (e.g. 200, 300 jars) would extend the catalog with
// per-threshold ids like `jars_200`. Kept to the first crossing for now per the
// "ship 3, watch, then layer" plan.

// ---- State shape ------------------------------------------------------------
// celebrationsShown: array of ids already shown (one-time lock, like
//   seenMilestones). Dismissing or showing an id adds it here forever.
// pendingCelebration: the id queued to show on the home card right now, or null.
//   We persist the *pending* one so a mid-session reload still shows it once.
export function defaultCelebrationState() {
  return {
    celebrationsShown: [],
    pendingCelebration: null,
  };
}

// ---- Raw signal computation -------------------------------------------------
// Pure read of the three numbers the detectors care about. No side effects.
export function computeCelebrationSignals(data) {
  if (!data) return {
    eggTotal: 0, jarsTotal: 0, harvestLbs: 0, bakesTotal: 0, hatchedTotal: 0,
    puppiesBorn: 0, kittensBorn: 0, lambsBorn: 0, foalsBorn: 0, calvesBorn: 0, kidsBorn: 0,
    syrupTotal: 0, meatBatches: 0, freezeBatches: 0, dehydrateBatches: 0, fermentCount: 0,
  };

  // Eggs: sum count across egg_layers entries that are egg actions.
  const eggEntries = Array.isArray(data?.entries?.egg_layers)
    ? data.entries.egg_layers
    : [];
  const eggTotal = eggEntries
    .filter((e) => e && (e.action === "eggs" || e.action === "eggs_laid"))
    .reduce((s, e) => s + (Number(e.count) || 0), 0);

  // Jars: canning lives in hobby.batches[].jarsMade — NOT in data.entries.
  const hobbies = Array.isArray(data?.hobbies) ? data.hobbies : [];
  const jarsTotal = hobbies
    .filter((h) => h && h.type === "canning" && Array.isArray(h.batches))
    .reduce(
      (s, h) =>
        s + h.batches.reduce((bs, b) => bs + (Number(b && b.jarsMade) || 0), 0),
      0
    );

  // Harvest: lbs-unit entries only (plus legacy no-unit, implicitly lbs).
  // Mirrors harvestTotalsByUnit's field handling: `quantity` or `qty`.
  // Garden harvest entries live in data.entries.garden with action "harvested".
  const gardenEntries = Array.isArray(data?.entries?.garden)
    ? data.entries.garden
    : [];
  const harvestLbs = gardenEntries
    .filter((e) => {
      if (!e) return false;
      const isHarvest =
        e.action === "harvested" ||
        e.action === "harvest" ||
        e.harvested === true ||
        e.qty != null ||
        e.quantity != null;
      if (!isHarvest) return false;
      const unit = e.unit ? e.unit : "lbs";
      return unit === "lbs";
    })
    .reduce((s, e) => {
      const raw = e.quantity != null ? e.quantity : e.qty;
      return s + (Number(raw) || 0);
    }, 0);

  // Sourdough: bakes are a countable array on the sourdough hobby (hobby.bakes[]).
  const bakesTotal = hobbies
    .filter((h) => h && h.type === "sourdough" && Array.isArray(h.bakes))
    .reduce((s, h) => s + h.bakes.length, 0);

  // Incubator: hatched chicks live on hobby.runs[].eggsHatched (NOT `hatched`).
  const hatchedTotal = hobbies
    .filter((h) => h && h.type === "incubator" && Array.isArray(h.runs))
    .reduce(
      (s, h) =>
        s + h.runs.reduce((rs, r) => rs + (Number(r && r.eggsHatched) || 0), 0),
      0
    );

  // --- Livestock births. Each returns the count of offspring BORN so the
  // detector can gate on >= 1. Field shapes verified against Year in Review.

  // Dogs/cats: litters[] with totalBorn (or puppies/kittens array length).
  const litterBorn = (type, kidField) =>
    hobbies
      .filter((h) => h && h.type === type && Array.isArray(h.litters))
      .reduce(
        (s, h) =>
          s +
          h.litters.reduce(
            (ls, l) =>
              ls +
              (Number(l && l.totalBorn) ||
                (Array.isArray(l && l[kidField]) ? l[kidField].length : 0)),
            0
          ),
        0
      );
  const puppiesBorn = litterBorn("dogs", "puppies");
  const kittensBorn = litterBorn("cats", "kittens");

  // Sheep/horses: breedings[] with a completed-birth date + a born count.
  const breedingBorn = (type, dateField, countField) =>
    hobbies
      .filter((h) => h && h.type === type && Array.isArray(h.breedings))
      .reduce(
        (s, h) =>
          s +
          h.breedings
            .filter((b) => b && b[dateField])
            .reduce((bs, b) => bs + (Number(b[countField]) || 0), 0),
        0
      );
  const lambsBorn = breedingBorn("sheep", "lambedDate", "lambsBorn");
  const foalsBorn = breedingBorn("horses", "foaledDate", "foalsBorn");

  // Cows/goats: birth is an ENTRY with an action ("calf" / "kid"), count field.
  const entryActionTotal = (hobbyType, action) => {
    const arr = Array.isArray(data?.entries?.[hobbyType])
      ? data.entries[hobbyType]
      : [];
    return arr
      .filter((e) => e && e.action === action)
      .reduce((s, e) => s + (Number(e.count) || 1), 0);
  };
  const calvesBorn = entryActionTotal("cows", "calf");
  const kidsBorn = entryActionTotal("goats", "kid");

  // Maple: syrup volume summed from entries (e.syrupGal).
  const mapleEntries = Array.isArray(data?.entries?.maple_syrup)
    ? data.entries.maple_syrup
    : [];
  const syrupTotal = mapleEntries.reduce(
    (s, e) => s + (Number(e && e.syrupGal) || 0),
    0
  );

  // Meat birds: count of FINALIZED batches (archivedBatches[]).
  const meatBatches = hobbies
    .filter(
      (h) => h && h.type === "meat_chickens" && Array.isArray(h.archivedBatches)
    )
    .reduce((s, h) => s + h.archivedBatches.length, 0);

  // Preserving siblings: countable batch/ferment arrays.
  const countArr = (type, field) =>
    hobbies
      .filter((h) => h && h.type === type && Array.isArray(h[field]))
      .reduce((s, h) => s + h[field].length, 0);
  const freezeBatches = countArr("freeze_drying", "batches");
  const dehydrateBatches = countArr("dehydrating", "batches");
  const fermentCount = countArr("fermentation", "ferments");

  return {
    eggTotal, jarsTotal, harvestLbs, bakesTotal, hatchedTotal,
    puppiesBorn, kittensBorn, lambsBorn, foalsBorn, calvesBorn, kidsBorn,
    syrupTotal, meatBatches, freezeBatches, dehydrateBatches, fermentCount,
  };
}

// ---- Migration: back-mark already-passed milestones -------------------------
// On first run for an existing user, anything they've ALREADY achieved is added
// to celebrationsShown so it never fires retroactively. Idempotent: safe to call
// on every migrateData pass.
export function migrateCelebrationState(data) {
  if (!data) return data;
  if (!Array.isArray(data.celebrationsShown)) data.celebrationsShown = [];
  if (typeof data.pendingCelebration === "undefined")
    data.pendingCelebration = null;

  // Only back-mark on the very first introduction of this feature, signaled by
  // the absence of our marker. After that, real crossings are handled live.
  if (!data._celebrationsInitialized) {
    const sig = computeCelebrationSignals(data);
    const markIf = (cond, id) => {
      if (cond && !data.celebrationsShown.includes(id))
        data.celebrationsShown.push(id);
    };
    markIf(sig.eggTotal >= 1, CELEBRATIONS.first_egg.id);
    markIf(sig.eggTotal >= 1000, CELEBRATIONS.eggs_1000.id);
    markIf(sig.eggTotal >= 5000, CELEBRATIONS.eggs_5000.id);
    markIf(sig.jarsTotal >= 100, CELEBRATIONS.jars_100.id);
    markIf(sig.jarsTotal >= 500, CELEBRATIONS.jars_500.id);
    markIf(sig.harvestLbs >= 100, CELEBRATIONS.harvest_100lb.id);
    markIf(sig.bakesTotal >= 50, CELEBRATIONS.bakes_50.id);
    markIf(sig.hatchedTotal >= 1, CELEBRATIONS.first_hatch.id);
    markIf(sig.hatchedTotal >= 100, CELEBRATIONS.hatched_100.id);
    markIf(sig.puppiesBorn >= 1, CELEBRATIONS.first_litter_dogs.id);
    markIf(sig.kittensBorn >= 1, CELEBRATIONS.first_litter_cats.id);
    markIf(sig.lambsBorn >= 1, CELEBRATIONS.first_lambing.id);
    markIf(sig.foalsBorn >= 1, CELEBRATIONS.first_foal.id);
    markIf(sig.calvesBorn >= 1, CELEBRATIONS.first_calf.id);
    markIf(sig.kidsBorn >= 1, CELEBRATIONS.first_kid.id);
    markIf(sig.syrupTotal > 0, CELEBRATIONS.first_syrup.id);
    markIf(sig.meatBatches >= 1, CELEBRATIONS.first_meat_batch.id);
    markIf(sig.freezeBatches >= 25, CELEBRATIONS.freeze_25.id);
    markIf(sig.dehydrateBatches >= 25, CELEBRATIONS.dehydrate_25.id);
    markIf(sig.fermentCount >= 25, CELEBRATIONS.ferment_25.id);
    data._celebrationsInitialized = true;
  }
  return data;
}

// ---- Detection --------------------------------------------------------------
// Given current data and the previous in-session signals, return the single
// celebration to show now (or null). Caller owns the baseline ref and the
// "only after load" gating; this stays pure.
//
// Returns: { celebration, nextSignals, crossedIds } — caller persists crossedIds
// into celebrationsShown and sets pendingCelebration to celebration?.id.
export function detectCelebrations(data, prevSignals) {
  const next = computeCelebrationSignals(data);

  // First pass: no baseline yet → record silently, fire nothing.
  if (!prevSignals) {
    return { celebration: null, nextSignals: next, crossedIds: [] };
  }

  const shown = Array.isArray(data?.celebrationsShown)
    ? data.celebrationsShown
    : [];

  // Each detector: only counts as "just crossed" if the value INCREASED past the
  // threshold this session AND we haven't shown it. Increase-only guards against
  // edits/recalcs that don't represent a real new achievement.
  const candidates = [];
  const consider = (id, prevVal, nextVal, threshold) => {
    if (shown.includes(id)) return;
    if (nextVal <= prevVal) return; // only react to increases
    if (prevVal >= threshold) return; // already past it before this session
    if (nextVal >= threshold) candidates.push(id);
  };

  consider(CELEBRATIONS.first_egg.id, prevSignals.eggTotal, next.eggTotal, 1);
  consider(CELEBRATIONS.eggs_1000.id, prevSignals.eggTotal, next.eggTotal, 1000);
  consider(CELEBRATIONS.eggs_5000.id, prevSignals.eggTotal, next.eggTotal, 5000);
  consider(CELEBRATIONS.jars_100.id, prevSignals.jarsTotal, next.jarsTotal, 100);
  consider(CELEBRATIONS.jars_500.id, prevSignals.jarsTotal, next.jarsTotal, 500);
  consider(
    CELEBRATIONS.harvest_100lb.id,
    prevSignals.harvestLbs,
    next.harvestLbs,
    100
  );
  consider(CELEBRATIONS.bakes_50.id, prevSignals.bakesTotal, next.bakesTotal, 50);
  consider(
    CELEBRATIONS.first_hatch.id,
    prevSignals.hatchedTotal,
    next.hatchedTotal,
    1
  );
  consider(
    CELEBRATIONS.hatched_100.id,
    prevSignals.hatchedTotal,
    next.hatchedTotal,
    100
  );
  consider(CELEBRATIONS.first_litter_dogs.id, prevSignals.puppiesBorn, next.puppiesBorn, 1);
  consider(CELEBRATIONS.first_litter_cats.id, prevSignals.kittensBorn, next.kittensBorn, 1);
  consider(CELEBRATIONS.first_lambing.id, prevSignals.lambsBorn, next.lambsBorn, 1);
  consider(CELEBRATIONS.first_foal.id, prevSignals.foalsBorn, next.foalsBorn, 1);
  consider(CELEBRATIONS.first_calf.id, prevSignals.calvesBorn, next.calvesBorn, 1);
  consider(CELEBRATIONS.first_kid.id, prevSignals.kidsBorn, next.kidsBorn, 1);
  consider(CELEBRATIONS.first_syrup.id, prevSignals.syrupTotal, next.syrupTotal, 0.0001);
  consider(CELEBRATIONS.first_meat_batch.id, prevSignals.meatBatches, next.meatBatches, 1);
  consider(CELEBRATIONS.freeze_25.id, prevSignals.freezeBatches, next.freezeBatches, 25);
  consider(CELEBRATIONS.dehydrate_25.id, prevSignals.dehydrateBatches, next.dehydrateBatches, 25);
  consider(CELEBRATIONS.ferment_25.id, prevSignals.fermentCount, next.fermentCount, 25);

  if (candidates.length === 0) {
    return { celebration: null, nextSignals: next, crossedIds: [] };
  }

  // If two cross at once (rare), show the "biggest" and mark both so neither
  // re-queues. Order = priority shown to the user; higher milestones first so a
  // big single log that crosses two thresholds shows the more impressive one.
  // Births and big numbers rank above small "first" milestones.
  const priority = [
    CELEBRATIONS.eggs_5000.id,
    CELEBRATIONS.jars_500.id,
    CELEBRATIONS.hatched_100.id,
    CELEBRATIONS.eggs_1000.id,
    CELEBRATIONS.bakes_50.id,
    CELEBRATIONS.freeze_25.id,
    CELEBRATIONS.dehydrate_25.id,
    CELEBRATIONS.ferment_25.id,
    CELEBRATIONS.jars_100.id,
    CELEBRATIONS.harvest_100lb.id,
    CELEBRATIONS.first_litter_dogs.id,
    CELEBRATIONS.first_litter_cats.id,
    CELEBRATIONS.first_lambing.id,
    CELEBRATIONS.first_foal.id,
    CELEBRATIONS.first_calf.id,
    CELEBRATIONS.first_kid.id,
    CELEBRATIONS.first_syrup.id,
    CELEBRATIONS.first_meat_batch.id,
    CELEBRATIONS.first_hatch.id,
    CELEBRATIONS.first_egg.id,
  ];
  const toShowId =
    priority.find((id) => candidates.includes(id)) || candidates[0];

  return {
    celebration: CELEBRATIONS[toShowId],
    nextSignals: next,
    crossedIds: candidates, // mark ALL crossed, show only one
  };
}

// Lookup helper for the card renderer when only the id is persisted.
export function getCelebrationById(id) {
  return id ? CELEBRATIONS[id] || null : null;
}

// Whether a given celebration id is one we let the review prompt piggyback on.
export function isReviewWorthy(id) {
  const c = getCelebrationById(id);
  return !!(c && c.reviewWorthy);
}

// The activeHobby this celebration belongs to (or null). The render uses this
// to show the card ONLY on its relevant tab — "one hundred jars" appears on the
// canning tab, not on garden or egg-layers.
export function celebrationHobby(id) {
  const c = getCelebrationById(id);
  return c ? c.hobby || null : null;
}

// ---- The inline home-screen card --------------------------------------------
// Quiet by design. Inherits the app palette. A small left accent bar (garden
// green), the app's signature hard offset shadow, a gentle one-time fade/rise on
// mount, and a single dismiss control. No confetti, no buttons demanding action.
export function CelebrationCard({ celebration, onDismiss, palette }) {
  const [leaving, setLeaving] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  if (!celebration) return null;

  const p = palette || {
    bg: "#F4EDE0",
    card: "#FAF5EA",
    ink: "#2C1810",
    inkSoft: "#5C4530",
    accent: "#C84B31",
    leaf: "#5A7A3C",
    line: "#2C181030",
  };

  const handleDismiss = () => {
    setLeaving(true);
    // let the fade-out play before the parent unmounts + persists the dismissal
    setTimeout(() => onDismiss && onDismiss(celebration.id), 220);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        background: p.card,
        border: `1.5px solid ${p.line}`,
        borderLeft: `4px solid ${p.leaf}`,
        borderRadius: 14,
        padding: "16px 18px",
        margin: "12px 0",
        boxShadow: `2px 2px 0 ${p.line}`,
        color: p.ink,
        opacity: leaving ? 0 : mounted ? 1 : 0,
        transform: leaving
          ? "translateY(-4px)"
          : mounted
          ? "translateY(0)"
          : "translateY(6px)",
        transition: "opacity 220ms ease, transform 220ms ease",
      }}
    >
      <div style={{ fontSize: 26, lineHeight: 1, marginTop: 1 }} aria-hidden>
        {celebration.emoji}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: 18,
            lineHeight: 1.25,
            marginBottom: 3,
          }}
        >
          {celebration.title}
        </div>
        <div style={{ fontSize: 14, color: p.inkSoft, lineHeight: 1.5 }}>
          {celebration.body}
        </div>
      </div>

      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: p.inkSoft,
          fontSize: 18,
          lineHeight: 1,
          padding: 4,
          margin: -4,
          borderRadius: 6,
          opacity: 0.6,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
      >
        ✕
      </button>
    </div>
  );
}

export default CelebrationCard;

// ============================================================================
// OBSERVATIONS — the harder, riskier half. A wise neighbor who NOTICES, hedges,
// and offers a thought — never diagnoses, never accuses, never claims to know
// the user's animals better than they do.
// ----------------------------------------------------------------------------
// DESIGN CONTRACT (differs from celebrations — read carefully):
//   1. CONDITION-based, not milestone-based. Each observation computes a live
//      boolean from current data ("is there a 5+ day egg-logging gap right now").
//   2. We observe the LOG, not the animal. "Haven't seen eggs logged" is true
//      and safe. "Your hens stopped laying" is a diagnosis we CANNOT make (could
//      be molt, a break, a broody hen) — so we never say it. We always hedge.
//   3. AUTO-CLEAR: the moment the condition goes false (they log eggs/water), the
//      observation vanishes — no stale nudges. Falls out of being condition-based.
//   4. SNOOZE on dismiss (not forever): dismissing sets a 14-day snooze. The
//      situation is recurring, so a permanent kill would mean never hearing about
//      a real gap months later. When the condition goes false we also clear the
//      snooze, so a NEW gap later is treated fresh.
//   5. Celebrations win. If a celebration is pending on a tab, the observation
//      yields — joy over nudge. The caller enforces this in render order.
//   6. Field paths verified against real data. Age-based observations are
//      deliberately ABSENT: flock.startDate is acquisition date, not hatch date,
//      so "your hens are X years old" would frequently be wrong. Not built.
// ============================================================================

const OBSERVATION_GAP_DAYS = 5; // gap length before an observation surfaces
const OBSERVATION_SNOOZE_DAYS = 14; // how long a dismiss quiets it

// Catalog. Each: id, emoji, hobby (activeHobby match), and a builder that the
// detector calls with the computed context to produce the title + body. Copy is
// hedged per the tone guide: name the gap, offer the gentle "could be" causes,
// never prescribe.
const OBSERVATIONS = {
  egg_gap: {
    id: "egg_gap",
    emoji: "🥚",
    hobby: "egg_layers",
    build: (ctx) => ({
      title: `No eggs logged from the ${ctx.flockName} in ${ctx.days} days.`,
      body: "Could be a molt or a winter slowdown, could just be a break in logging — you'd know better than us.",
    }),
  },
  water_gap: {
    id: "water_gap",
    emoji: "💧",
    hobby: "garden",
    build: (ctx) => ({
      title: `The garden hasn't been watered in the log for ${ctx.days} days.`,
      body: "Could be rain's been doing the work, could just be unlogged. Just flagging it in case.",
    }),
  },
};

// ---- Observation state ------------------------------------------------------
// snoozedUntil: { observationId: ISO-date-string } — observation hidden until
//   that date. activeObservation: the id currently shown on a tab (or null),
//   plus the context needed to render its copy.
export function defaultObservationState() {
  return {
    observationSnooze: {}, // { obsId: ISO date until which it's snoozed }
    activeObservation: null, // { id, hobby, ctx } currently surfaced, or null
  };
}

export function migrateObservationState(data) {
  if (!data) return data;
  if (!data.observationSnooze || typeof data.observationSnooze !== "object")
    data.observationSnooze = {};
  if (typeof data.activeObservation === "undefined")
    data.activeObservation = null;
  return data;
}

// Days between an ISO date string (YYYY-MM-DD or full ISO) and now.
function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const then = new Date(dateStr);
  if (isNaN(then.getTime())) return Infinity;
  const ms = Date.now() - then.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// Most recent date among entries matching a predicate. null if none.
function latestEntryDate(entries, pred) {
  let latest = null;
  (entries || []).forEach((e) => {
    if (!e || !pred(e) || !e.date) return;
    if (latest === null || e.date > latest) latest = e.date;
  });
  return latest;
}

// ---- Condition detectors ----------------------------------------------------
// Each returns { active: bool, ctx } — active=true means the condition holds
// RIGHT NOW. ctx carries display data (flock name, day count). Pure reads.

function detectEggGap(data) {
  const eggHobby = (data?.hobbies || []).find((h) => h && h.type === "egg_layers");
  if (!eggHobby || !Array.isArray(eggHobby.flocks) || eggHobby.flocks.length === 0)
    return { active: false };
  // Only flocks that actually have birds — a sold/empty flock shouldn't nag.
  const liveFlocks = eggHobby.flocks.filter((f) => f && (Number(f.birdCount) || 0) > 0);
  if (liveFlocks.length === 0) return { active: false };

  const eggEntries = Array.isArray(data?.entries?.egg_layers)
    ? data.entries.egg_layers
    : [];

  // Find the flock with the longest egg-logging gap (and a real history — we
  // don't fire on a brand-new flock that's never been logged yet; that's not a
  // "gap", that's just new. We require at least one prior egg log for the flock).
  let worst = null;
  for (const f of liveFlocks) {
    const flockEggDates = eggEntries.filter(
      (e) => e && (e.action === "eggs" || e.action === "eggs_laid") && e.flockId === f.id
    );
    if (flockEggDates.length === 0) continue; // never logged → not a "gap"
    const last = latestEntryDate(flockEggDates, () => true);
    const gap = daysSince(last);
    if (gap >= OBSERVATION_GAP_DAYS && (!worst || gap > worst.days)) {
      worst = { days: gap, flockName: f.name || "flock", flockId: f.id };
    }
  }
  if (!worst) return { active: false };
  return { active: true, ctx: worst };
}

function detectWaterGap(data) {
  const gardenHobby = (data?.hobbies || []).find((h) => h && h.type === "garden");
  // Only when something is actively growing — currentSeason gates out winter.
  if (!gardenHobby || !gardenHobby.currentSeason) return { active: false };

  const gardenEntries = Array.isArray(data?.entries?.garden)
    ? data.entries.garden
    : [];
  // Require an active planting this season, else "you haven't watered" is moot.
  const hasPlanting = gardenEntries.some((e) => e && e.action === "planted");
  if (!hasPlanting) return { active: false };

  const lastWater = latestEntryDate(gardenEntries, (e) => e.action === "watered");
  // Never watered at all but has plantings → could be a real gap; anchor to the
  // most recent planting date so a just-started garden isn't nagged immediately.
  const anchor = lastWater || latestEntryDate(gardenEntries, (e) => e.action === "planted");
  const gap = daysSince(anchor);
  if (gap >= OBSERVATION_GAP_DAYS) {
    return { active: true, ctx: { days: gap } };
  }
  return { active: false };
}

const OBSERVATION_DETECTORS = {
  egg_gap: detectEggGap,
  water_gap: detectWaterGap,
};

// ---- Detection orchestration ------------------------------------------------
// Returns { observation, snoozeClears } — observation to surface now (or null),
// plus ids whose snooze should be cleared because their condition went false
// (this is the "auto-clear when they log again" behavior). The caller persists
// the snooze clears back into data.
export function detectObservations(data) {
  const snooze = data?.observationSnooze || {};
  const now = Date.now();
  const snoozeClears = [];
  let surfaced = null;

  for (const id of Object.keys(OBSERVATIONS)) {
    const det = OBSERVATION_DETECTORS[id];
    const result = det ? det(data) : { active: false };

    if (!result.active) {
      // Condition no longer holds → clear any snooze so a future occurrence is
      // treated fresh (the "auto-clear when they log again" behavior).
      if (snooze[id]) snoozeClears.push(id);
      continue;
    }
    // Condition holds. Honor an active snooze.
    const until = snooze[id] ? new Date(snooze[id]).getTime() : 0;
    if (until && until > now) continue; // still snoozed
    // Eligible to surface. Take the first eligible (egg before water by order).
    if (!surfaced) {
      const obs = OBSERVATIONS[id];
      surfaced = {
        id: obs.id, emoji: obs.emoji, hobby: obs.hobby, ...obs.build(result.ctx),
      };
    }
  }

  return { observation: surfaced, snoozeClears };
}

// Snooze an observation for the standard window. Returns the ISO date string.
export function snoozeObservationUntil() {
  const d = new Date();
  d.setDate(d.getDate() + OBSERVATION_SNOOZE_DAYS);
  return d.toISOString();
}

// The activeHobby an observation belongs to.
export function observationHobby(obs) {
  return obs && obs.hobby ? obs.hobby : null;
}

// ---- The observation card ---------------------------------------------------
// Same shape as CelebrationCard but a quieter, cooler accent (the app's water
// blue) so it reads as a gentle note, not a celebration. Carries a title +
// hedged body and a single dismiss (which snoozes, per the caller).
export function ObservationCard({ observation, onDismiss, palette }) {
  const [leaving, setLeaving] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  if (!observation) return null;

  const p = palette || {
    bg: "#F4EDE0", card: "#FAF5EA", ink: "#2C1810", inkSoft: "#5C4530",
    accent: "#C84B31", leaf: "#5A7A3C", line: "#2C181030",
  };
  // Cooler accent than celebrations — the app's watering blue, calm not festive.
  const accent = "#3F7CAC";

  const handleDismiss = () => {
    setLeaving(true);
    setTimeout(() => onDismiss && onDismiss(observation.id), 220);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        background: p.card,
        border: `1.5px solid ${p.line}`,
        borderLeft: `4px solid ${accent}`,
        borderRadius: 14,
        padding: "16px 18px",
        margin: "12px 0",
        boxShadow: `2px 2px 0 ${p.line}`,
        color: p.ink,
        opacity: leaving ? 0 : mounted ? 1 : 0,
        transform: leaving ? "translateY(-4px)" : mounted ? "translateY(0)" : "translateY(6px)",
        transition: "opacity 220ms ease, transform 220ms ease",
      }}
    >
      <div style={{ fontSize: 24, lineHeight: 1, marginTop: 1 }} aria-hidden>
        {observation.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, marginBottom: 3 }}>
          {observation.title}
        </div>
        <div style={{ fontSize: 14, color: p.inkSoft, lineHeight: 1.5 }}>
          {observation.body}
        </div>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          flexShrink: 0, background: "transparent", border: "none", cursor: "pointer",
          color: p.inkSoft, fontSize: 18, lineHeight: 1, padding: 4, margin: -4,
          borderRadius: 6, opacity: 0.6,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
      >
        ✕
      </button>
    </div>
  );
}
