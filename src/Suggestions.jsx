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
  if (!data) return { eggTotal: 0, jarsTotal: 0, harvestLbs: 0, bakesTotal: 0, hatchedTotal: 0 };

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

  return { eggTotal, jarsTotal, harvestLbs, bakesTotal, hatchedTotal };
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
    const { eggTotal, jarsTotal, harvestLbs, bakesTotal, hatchedTotal } =
      computeCelebrationSignals(data);
    const markIf = (cond, id) => {
      if (cond && !data.celebrationsShown.includes(id))
        data.celebrationsShown.push(id);
    };
    markIf(eggTotal >= 1, CELEBRATIONS.first_egg.id);
    markIf(eggTotal >= 1000, CELEBRATIONS.eggs_1000.id);
    markIf(eggTotal >= 5000, CELEBRATIONS.eggs_5000.id);
    markIf(jarsTotal >= 100, CELEBRATIONS.jars_100.id);
    markIf(jarsTotal >= 500, CELEBRATIONS.jars_500.id);
    markIf(harvestLbs >= 100, CELEBRATIONS.harvest_100lb.id);
    markIf(bakesTotal >= 50, CELEBRATIONS.bakes_50.id);
    markIf(hatchedTotal >= 1, CELEBRATIONS.first_hatch.id);
    markIf(hatchedTotal >= 100, CELEBRATIONS.hatched_100.id);
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

  if (candidates.length === 0) {
    return { celebration: null, nextSignals: next, crossedIds: [] };
  }

  // If two cross at once (rare), show the "biggest" and mark both so neither
  // re-queues. Order = priority shown to the user; higher milestones first so a
  // big single log that crosses two thresholds shows the more impressive one.
  const priority = [
    CELEBRATIONS.eggs_5000.id,
    CELEBRATIONS.jars_500.id,
    CELEBRATIONS.hatched_100.id,
    CELEBRATIONS.eggs_1000.id,
    CELEBRATIONS.bakes_50.id,
    CELEBRATIONS.jars_100.id,
    CELEBRATIONS.harvest_100lb.id,
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
