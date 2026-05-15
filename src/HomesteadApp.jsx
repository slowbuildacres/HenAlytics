import React, { useState, useEffect, useRef } from "react";
import {
  Sprout, Egg, Drumstick, Plus, Droplet, Sun, Scissors, AlertTriangle,
  Skull, Bird, Home, BarChart3, X, ChevronDown, ChevronUp, Calendar, DollarSign, Sparkles,
  Snowflake, Archive, Trash2, Edit3, Save, Settings, ArrowLeft,
  Mail, Lightbulb, UserCircle, Lock, Heart, NotebookPen, Hammer, Leaf, LogOut, Download,
  Camera, Cloud, CloudOff, Loader2, Image as ImageIcon, UserPlus, CheckCircle,
  MapPin, CloudRain, Thermometer, Share2, Store, BookOpen, Truck
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import AuthModal from "./AuthModal.jsx";
import FarmhandModal from "./FarmhandModal.jsx";
import { supabase, isSupabaseConfigured } from "./supabase.js";
import {
  loadHomestead, saveHomestead, readLocalHomestead, clearLocalHomestead,
  uploadPhoto, getPhotoUrl, deletePhoto,
  sendFeedback, acceptInvite, deleteAccount,
} from "./sync.js";
import {
  getDailyWeather, requestBrowserLocation, reverseGeocode, geocodePlace, formatWeather,
} from "./weather.js";
import { autoDetectHardiness } from "./hardiness.js";
import { SeasonalDecorations, getTimeOfDayAccent } from "./seasons.jsx";
import YearInReviewPage from "./YearInReview.jsx";
import CalendarPage from "./Calendar.jsx";
import {
  PlanCropModal, PlanBirdsModal, AddCalendarEventModal,
  EditCalendarEventModal, EditZoneModal, ViewDayEventsModal,
  PlanForDayModal,
} from "./CalendarModals.jsx";
import GardenMapModal from "./GardenMap.jsx";
import RabbitsPage, { RabbitsAnalytics } from "./Rabbits.jsx";
import SalesPage from "./Sales.jsx";
import BeesPage, { BeesAnalytics } from "./Bees.jsx";
import IncubatorPage, { IncubatorAnalytics } from "./Incubator.jsx";
import GoatsPage, { GoatsAnalytics } from "./Goats.jsx";
import CowsPage, { CowsAnalytics } from "./Cows.jsx";
import PigsPage, { PigsAnalytics } from "./Pigs.jsx";
import SheepPage, { SheepAnalytics } from "./Sheep.jsx";
import HorsesPage, { HorsesAnalytics } from "./Horses.jsx";
import SourdoughPage, { SourdoughAnalytics } from "./Sourdough.jsx";
import FarmstandPage, { FarmstandAnalytics } from "./Farmstand.jsx";
import BakingPage, { BakingAnalytics } from "./Baking.jsx";
import CanningPage, { CanningAnalytics } from "./Canning.jsx";
import FreezeDryingPage, { FreezeDryingAnalytics } from "./FreezeDrying.jsx";
import DehydratingPage, { DehydratingAnalytics } from "./Dehydrating.jsx";
import FermentationPage, { FermentationAnalytics } from "./Fermentation.jsx";
import TincturePage, { TinctureAnalytics } from "./Tincture.jsx";
import OilInfusionPage, { OilInfusionAnalytics } from "./OilInfusion.jsx";
import SalvePage, { SalveAnalytics } from "./Salve.jsx";
import TeaPage, { TeaAnalytics } from "./Tea.jsx";
import DogsPage, { DogsAnalytics } from "./Dogs.jsx";
import CatsPage, { CatsAnalytics } from "./Cats.jsx";
import MapleSyrupPage, { MapleSyrupAnalytics } from "./MapleSyrup.jsx";
import {
  initIap, identifyIapUser, purchaseProduct, restorePurchases,
  hasActiveSubscription, openManageSubscriptions, TIER_TO_IAP_PRODUCT,
} from "./IapManager.js";

// ============ DESIGN TOKENS ============
const palette = {
  bg: "#F4EDE0",         // warm parchment
  bgAlt: "#EBE0CC",      // deeper parchment
  ink: "#2C1810",        // dark coffee
  inkSoft: "#5C4530",    // softer brown
  accent: "#C84B31",     // barn red
  accentSoft: "#E8A07A", // terracotta
  leaf: "#5A7A3C",       // garden green
  leafSoft: "#A8C078",
  yolk: "#E8B547",       // egg yellow
  yolkSoft: "#F2D58A",
  feather: "#8B6F47",    // chicken brown
  featherSoft: "#C9A77B",
  line: "#2C181030",
  card: "#FAF5EA",
};

// ============ STORAGE HELPERS ============
const defaultData = () => ({
  homesteadName: "",
  homesteadLocation: null, // { lat, lon, label } once set
  hobbies: [
    { id: "garden", name: "Garden", type: "garden", icon: "sprout", currentSeason: null, archivedSeasons: [] },
    { id: "egg_layers", name: "Egg Layers", type: "egg_layers", icon: "egg", flocks: [] },
    { id: "meat_chickens", name: "Meat Birds", type: "meat_chickens", icon: "drumstick", currentBatches: [], archivedBatches: [] },
    { id: "rabbits", name: "Rabbits 🐇", type: "rabbits", icon: "rabbit", animals: [], hutches: [], hidden: true },
    { id: "bees", name: "Beekeeping 🐝 (Beta)", type: "bees", icon: "bee", hives: [], hidden: true },
    { id: "incubator", name: "Incubator 🥚", type: "incubator", icon: "egg", runs: [], hidden: true },
    { id: "goats", name: "Goats 🐐", type: "goats", icon: "sprout", animals: [], hidden: true },
    { id: "cows", name: "Cows 🐄", type: "cows", icon: "sprout", animals: [], hidden: true },
    { id: "pigs", name: "Pigs 🐷", type: "pigs", icon: "sprout", animals: [], hidden: true },
    { id: "sheep", name: "Sheep 🐑", type: "sheep", icon: "sprout", animals: [], breedings: [], shearings: [], subType: "mixed", hidden: true },
    { id: "horses", name: "Horses 🐴", type: "horses", icon: "sprout", animals: [], breedings: [], farrier: [], vet: [], deworming: [], rides: [], hidden: true },
    { id: "sourdough", name: "Sourdough 🍞", type: "sourdough", icon: "sprout", starters: [], bakes: [], hidden: true },
    { id: "farmstand", name: "Farmstand 🧾", type: "farmstand", icon: "store", items: [], hidden: true },
    { id: "baking", name: "Baking 🥧", type: "baking", icon: "sprout", recipes: [], hidden: true },
    { id: "canning", name: "Canning 🫙", type: "canning", icon: "sprout", batches: [], hidden: true },
    // Preserving sub-types — grouped with canning under "Preserving" in the picker UI.
    // Each is its own hobby with its own data shape; PreservingPage routes between them
    // via tabs. No data migration needed — adding these as siblings keeps canning's
    // existing data untouched.
    { id: "freeze_drying", name: "Freeze Drying ❄️", type: "freeze_drying", icon: "sprout", batches: [], hidden: true },
    { id: "dehydrating", name: "Dehydrating 🌬️", type: "dehydrating", icon: "sprout", batches: [], hidden: true },
    { id: "fermentation", name: "Fermentation 🫧", type: "fermentation", icon: "sprout", ferments: [], recipes: [], hidden: true },
    { id: "dogs", name: "Dogs 🐕", type: "dogs", icon: "sprout", animals: [], breedings: [], litters: [], attacks: [], hidden: true },
    { id: "cats", name: "Cats 🐈", type: "cats", icon: "sprout", animals: [], breedings: [], litters: [], attacks: [], hidden: true },
    { id: "maple_syrup", name: "Maple Syrup 🍁", type: "maple_syrup", icon: "sprout", seasons: [], hidden: true },
  ],
  entries: {}, // { hobbyId: [entries] }
  plantings: [], // garden plantings to track
  butchered: [], // butcher events for current batch
  calendarEvents: [], // user-created calendar events { id, date, title, type, notes, cropId?, varietyId?, varietyName? }
  varieties: {},      // Push 5 — per-crop variety registry { cropId: [{ id, name, daysToHarvest }] }
  tutorialDismissed: false, // true after user completes or skips tutorial (web)
  nativeTutorialDismissed: false, // true after user completes or skips the native iOS/Android tutorial — tracked separately so web-completed users still see the native walkthrough on first app launch
  lastSeenVersion: 0,        // tracks what's new popup
  salesHidden: false,        // true if user hides the Sales tab
  spouseMode: false,         // true = dark mode + fudged costs/production for "spouse presentation"
  sales: [],            // unified sales log
  customers: [],        // repeat buyer directory
  freezerLog: [],       // universal butcher records: { id, date, hobbyId, flockId, flockName, birdType, count, avgWeight, note }
  supportersDismissedMonth: null, // "YYYY-MM" of last dismissed monthly thank-you
  appStoreFundDismissedMonth: null, // "YYYY-MM" of last dismissed app-store-fundraiser popup
  weeklyChoreEmailOptIn: false, // master switch for weekly Sunday-evening chore digest
  userHasTipped: false, // set true after a Stripe checkout completes (manual flag user can mark themselves)
  seenMilestones: [], // milestone keys (e.g. "milestone_2k") the user has already been shown the popup for
  units: {
    temperature: "F",      // "F" or "C"
    currency: "USD",       // ISO currency code: USD, AUD, CAD, GBP, EUR, NZD
    hemisphere: "auto",    // "auto" | "north" | "south" — controls garden seasons
  },
});

// Migrate older data shapes to the current schema. Safe to call on fresh data too.
function migrateData(data) {
  if (!data || typeof data !== "object") return defaultData();
  if (!Array.isArray(data.hobbies)) data.hobbies = defaultData().hobbies;
  if (!data.entries || typeof data.entries !== "object") data.entries = {};
  if (!Array.isArray(data.plantings)) data.plantings = [];
  if (!Array.isArray(data.calendarEvents)) data.calendarEvents = [];
  if (!Array.isArray(data.sales)) data.sales = [];
  if (!Array.isArray(data.freezerLog)) data.freezerLog = [];
  if (typeof data.supportersDismissedMonth !== "string" && data.supportersDismissedMonth !== null) {
    data.supportersDismissedMonth = null;
  }
  if (typeof data.appStoreFundDismissedMonth !== "string" && data.appStoreFundDismissedMonth !== null) {
    data.appStoreFundDismissedMonth = null;
  }
  if (typeof data.weeklyChoreEmailOptIn !== "boolean") {
    data.weeklyChoreEmailOptIn = false;
  }
  if (typeof data.userHasTipped !== "boolean") {
    data.userHasTipped = false;
  }
  // Tutorial dismissal flags. The web tutorial (`tutorialDismissed`) and
  // the native iOS/Android tutorial (`nativeTutorialDismissed`) are tracked
  // separately so a user who dismissed the tutorial on the web still gets
  // a brief native walkthrough on their first app open. Both default to
  // false so existing data accounts without these fields see the tutorial.
  if (typeof data.tutorialDismissed !== "boolean") {
    data.tutorialDismissed = false;
  }
  if (typeof data.nativeTutorialDismissed !== "boolean") {
    data.nativeTutorialDismissed = false;
  }

  // Migrate legacy sold_eggs entries from egg_layers entries into data.sales
  const eggLayerEntries = data.entries["egg_layers"] || [];
  const existingSaleIds = new Set((data.sales || []).map(s => s.id));
  eggLayerEntries.forEach(e => {
    if (e.action === "sold_eggs" && !existingSaleIds.has(e.id)) {
      // Robust revenue derivation. Different versions of the sold_eggs form
      // have written different field combinations over the months, and a few
      // user reports surfaced sales landing in the Sales tab at $0 because the
      // migration only looked at e.pricePerDozen — which can be missing on
      // entries created before the unit-based selling form was introduced, or
      // when the form's derivation guard didn't fire (e.g. unitQty empty).
      // Try every known shape before giving up at 0. derivedQty fills in
      // when the entry has unit-based fields but `count` was never set.
      let qty = Number(e.count) || 0;
      let pricePerDozen = Number(e.pricePerDozen) || 0;
      let revenue = 0;

      if (pricePerDozen > 0 && qty > 0) {
        // Canonical path — current form writes both fields.
        revenue = (qty / 12) * pricePerDozen;
      } else if (Number(e.unitQty) > 0 && Number(e.pricePerUnit) > 0) {
        // Form-fields path — derivation guard didn't run (e.g. older code or
        // empty unitQty at save time), but the raw inputs are still there.
        const unitToCount = {
          single: 1, half_dozen: 6, dozen: 12, eighteen: 18, flat: 30,
          custom: Number(e.customEggsPerUnit) || 0,
        };
        const eggsPerUnit = unitToCount[e.unit] || 12;
        const totalEggs = Number(e.unitQty) * eggsPerUnit;
        revenue = Number(e.unitQty) * Number(e.pricePerUnit);
        if (totalEggs > 0) {
          pricePerDozen = revenue / (totalEggs / 12);
          if (qty === 0) qty = totalEggs;
        }
      } else if (Number(e.pricePerUnit) > 0 && qty > 0) {
        // Old-old shape — some pre-unit-based entries stored pricePerUnit as
        // "$/dozen" and put total eggs in count. Treat pricePerUnit as $/dozen.
        pricePerDozen = Number(e.pricePerUnit);
        revenue = (qty / 12) * pricePerDozen;
      } else if (Number(e.totalRevenue) > 0) {
        // Last-ditch — entry has a stashed totalRevenue from some other path.
        revenue = Number(e.totalRevenue);
        if (qty > 0) pricePerDozen = revenue / (qty / 12);
      }
      // If all four paths fail, revenue stays 0 — the entry genuinely has no
      // price info and the user will need to edit it. At least now we've tried.

      data.sales.push({
        id: e.id,
        date: e.date,
        hobbyType: "eggs",
        eggType: "Chicken",
        eggPurpose: "Eating",
        qty,
        unit: "eggs",
        pricePerUnit: pricePerDozen,
        totalRevenue: revenue,
        note: e.note || "",
        buyerId: null,
        created: e.created || Date.now(),
        migratedFromEntries: true,
      });
      existingSaleIds.add(e.id);
    }
  });
  if (typeof data.salesHidden !== "boolean") data.salesHidden = false;
  if (typeof data.spouseMode !== "boolean") data.spouseMode = false;
  if (!Array.isArray(data.customers)) data.customers = [];
  if (!Array.isArray(data.seenMilestones)) data.seenMilestones = [];
  if (typeof data.homesteadName !== "string") data.homesteadName = "";
  if (data.homesteadLocation !== null && (!data.homesteadLocation || typeof data.homesteadLocation !== "object")) {
    data.homesteadLocation = null;
  }

  data.hobbies.forEach((h) => {
    if (h.type === "garden") {
      if (!("currentSeason" in h)) h.currentSeason = null;
      if (!Array.isArray(h.archivedSeasons)) h.archivedSeasons = [];
    }
    if (h.type === "egg_layers") {
      // Multi-flock migration: convert old flockSize/flockHistory/eggBasket to flocks[]
      if (!Array.isArray(h.flocks)) {
        h.flocks = [];
        // If there's legacy single-flock data, migrate it to flocks[0]
        if (typeof h.flockSize === "number" && h.flockSize > 0) {
          const flockId = h._defaultFlockId || Math.random().toString(36).slice(2, 10);
          h._defaultFlockId = flockId;
          h.flocks.push({
            id: flockId,
            name: "My Flock",
            birdType: "Chicken",
            birdCount: h.flockSize,
            startDate: (h.flockHistory && h.flockHistory[0] && h.flockHistory[0].date) || null,
            cost: (h.flockHistory && h.flockHistory[0] && h.flockHistory[0].cost) || 0,
            history: h.flockHistory || [],
            eggBasket: h.eggBasket || null,
          });
        }
      }
      // Ensure all flocks have required fields
      h.flocks.forEach(fl => {
        if (!fl.id) fl.id = Math.random().toString(36).slice(2, 10);
        if (!fl.birdType) fl.birdType = "Chicken";
        if (!Array.isArray(fl.history)) fl.history = [];
        if (fl.eggBasket === undefined) fl.eggBasket = null;
      });
    }
    if (h.type === "rabbits") {
      if (!Array.isArray(h.hutches)) h.hutches = [];
      // Push 7b — per-animal rabbits. Ensure animals[] exists for the new shape.
      // Actual hutch→animals migration happens in Rabbits.jsx via runMigrationIfNeeded,
      // gated by data.rabbitsMigratedV7b.
      if (!Array.isArray(h.animals)) h.animals = [];
      if (typeof h.hidden === "undefined") h.hidden = true;
      // Push 7b — graduating from Beta. Auto-rename if user hasn't customized.
      if (h.name === "Rabbits 🐇 (Beta)" || h.name === "Rabbits (Beta)") h.name = "Rabbits 🐇";
    }
    if (h.type === "meat_chickens") {
      // Push 4b — multi-batch support. Old shape: hobby.currentBatch (single
      // object or null). New shape: hobby.currentBatches (array, can have
      // 0+ active batches at once — e.g. running broilers and turkeys side
      // by side). Migrate any pre-4b data by wrapping the legacy single
      // batch into the array, then null out the legacy field so we can
      // detect un-migrated data later if a bug ever rolls back the shape.
      if (!Array.isArray(h.currentBatches)) h.currentBatches = [];
      if (!Array.isArray(h.archivedBatches)) h.archivedBatches = [];
      if (h.currentBatch) {
        // CRITICAL: only rehydrate if the legacy batch isn't already
        // archived. Without this check, a batch that the user finalized
        // would get pushed back into currentBatches on every load — the
        // long-standing "finalize doesn't stick" bug. We check archivedBatches
        // by id; if the user already archived this batch (via the new
        // EditBatchModal or ButcherModal "also finalize" paths), leave the
        // legacy field cleared and don't re-push.
        const alreadyArchived = h.archivedBatches.some(b => b.id === h.currentBatch.id);
        const alreadyInCurrent = h.currentBatches.some(b => b.id === h.currentBatch.id);
        if (!alreadyArchived && !alreadyInCurrent) {
          h.currentBatches.push(h.currentBatch);
        }
        h.currentBatch = null;
      }
      // BRUTE-FORCE DEFENSIVE: if a batch ID appears in BOTH currentBatches
      // and archivedBatches, the archived version wins and we remove it from
      // currentBatches. This catches cases where past code paths (or stale
      // cloud data overwriting fresh local) ended up with the same batch in
      // both arrays. Without this, a finalized batch can stick around in
      // currentBatches forever if the cloud version happens to include it.
      // We also de-dupe currentBatches by id (keep first occurrence) to
      // guard against any historical bug that double-pushed.
      const archivedIds = new Set(h.archivedBatches.map(b => b.id));
      const seenCurrentIds = new Set();
      h.currentBatches = h.currentBatches.filter(b => {
        if (archivedIds.has(b.id)) return false; // archived wins
        if (seenCurrentIds.has(b.id)) return false; // duplicate
        seenCurrentIds.add(b.id);
        return true;
      });
      // Also: if any batch in currentBatches has an endDate set (which is
      // only written by the finalize flows), it means the batch was finalized
      // but never made it to archivedBatches due to some past bug. Promote
      // it to archived now.
      const orphanedFinalized = h.currentBatches.filter(b => b.endDate);
      if (orphanedFinalized.length > 0) {
        orphanedFinalized.forEach(b => {
          if (!archivedIds.has(b.id)) {
            h.archivedBatches.push(b);
            archivedIds.add(b.id);
          }
        });
        h.currentBatches = h.currentBatches.filter(b => !b.endDate);
      }
      // Rename old "Meat Chickens" to "Meat Birds" — the hobby now supports
      // any bird type (turkey, duck, goose, etc.) at batch creation time.
      // Only auto-rename if user hasn't customized the name to something else.
      if (h.name === "Meat Chickens") h.name = "Meat Birds";
    }
    // Backfill move_tractor entries that pre-date the prefill-effect fix.
    // Early versions of the move-tractor flow displayed the flock default in
    // the input but never WROTE it to fields.distanceFeet — so users who
    // tapped Save without retyping ended up with entries where distanceFeet
    // is 0 or missing. We retroactively fill those from the current flock /
    // batch default. This runs every load (idempotent — once an entry has a
    // valid distanceFeet, it's skipped).
    if (h.type === "egg_layers" || h.type === "meat_chickens") {
      const flockArr = h.type === "meat_chickens" ? "currentBatches" : "flocks";
      const flockList = Array.isArray(h[flockArr]) ? h[flockArr] : [];
      const archived = h.type === "meat_chickens" ? (h.archivedBatches || []) : [];
      // Use whichever flock/batch has a distance set as the default. Most
      // homesteads have one tractor per coop so any non-zero value is fine.
      const defaultDist =
        flockList.find(f => Number(f.tractorDistanceFeet) > 0)?.tractorDistanceFeet ||
        archived.find(b => Number(b.tractorDistanceFeet) > 0)?.tractorDistanceFeet ||
        0;
      if (defaultDist > 0) {
        const entriesForHobby = data.entries[h.id] || [];
        entriesForHobby.forEach(e => {
          if (e.action === "move_tractor" && (!Number(e.distanceFeet) || Number(e.distanceFeet) <= 0)) {
            e.distanceFeet = Number(defaultDist);
            e._backfilledDistance = true; // marker for debugging
          }
        });
      }
    }
  });

  // Tag old egg_layers entries with flockId if missing
  const eggLayersHobby = data.hobbies.find(h => h.type === "egg_layers");
  if (eggLayersHobby && eggLayersHobby._defaultFlockId && Array.isArray(data.entries["egg_layers"])) {
    data.entries["egg_layers"].forEach(e => {
      if (!e.flockId) e.flockId = eggLayersHobby._defaultFlockId;
    });
  }

  // Add rabbits hobby if missing (added in later version)
  const hasRabbits = data.hobbies.some(h => h.id === "rabbits");
  if (!hasRabbits) {
    data.hobbies.push({ id: "rabbits", name: "Rabbits 🐇", type: "rabbits", icon: "rabbit", animals: [], hutches: [], hidden: true });
  }
const hasGoats = data.hobbies.some(h => h.id === "goats");
  if (!hasGoats) data.hobbies.push({ id: "goats", name: "Goats 🐐", type: "goats", icon: "sprout", animals: [], hidden: true });
  const hasCows = data.hobbies.some(h => h.id === "cows");
  if (!hasCows) data.hobbies.push({ id: "cows", name: "Cows 🐄", type: "cows", icon: "sprout", animals: [], hidden: true });
  const hasPigs = data.hobbies.some(h => h.id === "pigs");
  if (!hasPigs) data.hobbies.push({ id: "pigs", name: "Pigs 🐷", type: "pigs", icon: "sprout", animals: [], hidden: true });
  data.hobbies.forEach(h => {
    if (h.type === "goats" || h.type === "cows" || h.type === "pigs") {
      if (!Array.isArray(h.animals)) h.animals = [];
    }
  });
  const hasIncubator = data.hobbies.some(h => h.id === "incubator");
  if (!hasIncubator) {
    data.hobbies.push({ id: "incubator", name: "Incubator 🥚", type: "incubator", icon: "egg", runs: [], hidden: true });
  }
  data.hobbies.forEach(h => {
    if (h.type === "incubator") {
      if (!Array.isArray(h.runs)) h.runs = [];
      // Brooder workflow: after a run hatches, chicks move into a brooder
      // batch. Each batch tracks dispositions (sold, moved to flock, died,
      // kept) which sum down toward the initial count.
      if (!Array.isArray(h.brooderBatches)) h.brooderBatches = [];
    }
  });
  const gardenHobby = data.hobbies.find(h => h.type === "garden");
  if (gardenHobby && !Array.isArray(gardenHobby.perennials)) gardenHobby.perennials = [];
  // Backfill category + actions log on existing perennials.
  // Heuristic: anything with "tree" in the name becomes an orchard tree;
  // everything else (bushes, vines, asparagus, rhubarb, strawberries) stays as a plant.
  if (gardenHobby) {
    gardenHobby.perennials.forEach(p => {
      if (!p.category) {
        p.category = /\btree\b/i.test(p.name || "") ? "tree" : "plant";
      }
      if (!Array.isArray(p.actions)) p.actions = [];
    });
  }
  if (typeof data.lastSeenVersion !== "number") data.lastSeenVersion = 0;
  const hasBees = data.hobbies.some(h => h.id === "bees");
  if (!hasBees) {
    data.hobbies.push({ id: "bees", name: "Beekeeping 🐝 (Beta)", type: "bees", icon: "bee", hives: [], hidden: true });
  }
  data.hobbies.forEach((h) => {
    if (h.type === "bees") {
      if (!Array.isArray(h.hives)) h.hives = [];
      if (typeof h.hidden === "undefined") h.hidden = true;
    }
  });
  // ---- Farmstand hobby ----
  const hasFarmstand = data.hobbies.some(h => h.id === "farmstand");
  if (!hasFarmstand) {
    data.hobbies.push({ id: "farmstand", name: "Farmstand 🧾", type: "farmstand", icon: "store", items: [], hidden: true });
  }
  // Push 7c — Farmstand inventory migration. Existing items predate the
  // trackStock flag; without this migration they'd stay invisible to the new
  // inventory UI (no Restock button, no stock pill). Flip them all to tracked
  // once, defaulting stock to 0 (user can edit each to set a real number).
  // Gated by data.farmstandInventoryMigratedV7c so we don't reset stock counts
  // on every load if the user later turns tracking off on a specific item.
  if (!data.farmstandInventoryMigratedV7c) {
    const farmstandHobby = data.hobbies.find(h => h.id === "farmstand");
    if (farmstandHobby && Array.isArray(farmstandHobby.items)) {
      farmstandHobby.items.forEach(it => {
        if (typeof it.trackStock !== "boolean") it.trackStock = true;
        if (typeof it.stock !== "number") it.stock = 0;
        if (typeof it.lowStockAt !== "number") it.lowStockAt = 3;
      });
    }
    data.farmstandInventoryMigratedV7c = true;
  }
  // ---- Baking hobby (Push 7d) ----
  const hasBaking = data.hobbies.some(h => h.id === "baking");
  if (!hasBaking) {
    data.hobbies.push({ id: "baking", name: "Baking 🥧", type: "baking", icon: "sprout", recipes: [], hidden: true });
  }
  data.hobbies.forEach((h) => {
    if (h.type === "baking") {
      if (!Array.isArray(h.recipes)) h.recipes = [];
      if (typeof h.hidden === "undefined") h.hidden = true;
    }
  });
  // ---- Canning hobby (Push 7d) ----
  const hasCanning = data.hobbies.some(h => h.id === "canning");
  if (!hasCanning) {
    data.hobbies.push({ id: "canning", name: "Canning 🫙", type: "canning", icon: "sprout", batches: [], hidden: true });
  }
  data.hobbies.forEach((h) => {
    if (h.type === "canning") {
      if (!Array.isArray(h.batches)) h.batches = [];
      if (typeof h.hidden === "undefined") h.hidden = true;
    }
  });
  // ---- Preserving sub-types (freeze drying / dehydrating / fermentation) ----
  // Backfill missing sub-hobbies so the PreservingPage tab bar always has all
  // four destinations. New users get them defaulted to hidden via defaultData;
  // existing users (who never saw these hobbies before) get them backfilled here.
  // Critically: hidden=true for everyone unless they were already enabled by
  // the user. We don't want to silently un-hide hobbies users didn't ask for.
  const preservingTypes = [
    { id: "freeze_drying", name: "Freeze Drying ❄️", type: "freeze_drying", icon: "sprout", batches: [] },
    { id: "dehydrating",   name: "Dehydrating 🌬️", type: "dehydrating", icon: "sprout", batches: [] },
    { id: "fermentation",  name: "Fermentation 🫧", type: "fermentation", icon: "sprout", ferments: [], recipes: [] },
  ];
  preservingTypes.forEach(({ id, name, type, icon, ...shape }) => {
    if (!data.hobbies.some(h => h.id === id)) {
      data.hobbies.push({ id, name, type, icon, hidden: true, ...shape });
    }
  });

  // Herbalism — virtual wrapper hobby with four sub-types (tincture, oil
  // infusion, salve, tea). Each is its own real hobby on data.hobbies so
  // analytics / sales / reordering all work the existing way. The
  // HerbalismPage component routes between them via a tab bar, same
  // pattern as PreservingPage.
  const herbalismTypes = [
    { id: "tincture",     name: "Tinctures 🌿",     type: "tincture",     icon: "sprout", batches: [] },
    { id: "oil_infusion", name: "Oil Infusions 🫒", type: "oil_infusion", icon: "sprout", batches: [] },
    { id: "salve",        name: "Salves 🪻",         type: "salve",        icon: "sprout", batches: [] },
    { id: "tea",          name: "Tea Blends 🍵",    type: "tea",          icon: "sprout", batches: [] },
  ];
  herbalismTypes.forEach(({ id, name, type, icon, ...shape }) => {
    if (!data.hobbies.some(h => h.id === id)) {
      data.hobbies.push({ id, name, type, icon, hidden: true, ...shape });
    }
  });
  data.hobbies.forEach((h) => {
    if (h.type === "freeze_drying") {
      if (!Array.isArray(h.batches)) h.batches = [];
      if (typeof h.hidden === "undefined") h.hidden = true;
      // Heal name in case it was missing or got corrupted to the id
      if (!h.name || h.name === "freeze_drying" || h.name === "Freeze_drying") {
        h.name = "Freeze Drying ❄️";
      }
    }
    if (h.type === "dehydrating") {
      if (!Array.isArray(h.batches)) h.batches = [];
      if (typeof h.hidden === "undefined") h.hidden = true;
      if (!h.name || h.name === "dehydrating" || h.name === "Dehydrating") {
        h.name = "Dehydrating 🌬️";
      }
    }
    if (h.type === "fermentation") {
      if (!Array.isArray(h.ferments)) h.ferments = [];
      if (!Array.isArray(h.recipes)) h.recipes = [];
      if (typeof h.hidden === "undefined") h.hidden = true;
      if (!h.name || h.name === "fermentation" || h.name === "Fermentation") {
        h.name = "Fermentation 🫧";
      }
    }
    // Herbalism sub-types — same heal pattern as preserving. Each batch
    // record lives on h.batches[]; specific fields differ per sub-type
    // (tinctures have menstruum, oils have carrier, etc.) and are
    // defined in the per-sub-type page files.
    if (h.type === "tincture") {
      if (!Array.isArray(h.batches)) h.batches = [];
      if (typeof h.hidden === "undefined") h.hidden = true;
      if (!h.name || h.name === "tincture" || h.name === "Tincture") {
        h.name = "Tinctures 🌿";
      }
    }
    if (h.type === "oil_infusion") {
      if (!Array.isArray(h.batches)) h.batches = [];
      if (typeof h.hidden === "undefined") h.hidden = true;
      if (!h.name || h.name === "oil_infusion" || h.name === "Oil_infusion") {
        h.name = "Oil Infusions 🫒";
      }
    }
    if (h.type === "salve") {
      if (!Array.isArray(h.batches)) h.batches = [];
      if (typeof h.hidden === "undefined") h.hidden = true;
      if (!h.name || h.name === "salve" || h.name === "Salve") {
        h.name = "Salves 🪻";
      }
    }
    if (h.type === "tea") {
      if (!Array.isArray(h.batches)) h.batches = [];
      if (typeof h.hidden === "undefined") h.hidden = true;
      if (!h.name || h.name === "tea" || h.name === "Tea") {
        h.name = "Tea Blends 🍵";
      }
    }
  });
  // ---- Dogs hobby ----
  // Backfill so existing users get the new hobby (hidden by default).
  // Data shape: animals, breedings, litters, attacks (LGD attack logs).
  const hasDogs = data.hobbies.some(h => h.id === "dogs");
  if (!hasDogs) {
    data.hobbies.push({ id: "dogs", name: "Dogs 🐕", type: "dogs", icon: "sprout", animals: [], breedings: [], litters: [], attacks: [], hidden: true });
  }
  data.hobbies.forEach((h) => {
    if (h.type === "dogs") {
      if (!Array.isArray(h.animals)) h.animals = [];
      if (!Array.isArray(h.breedings)) h.breedings = [];
      if (!Array.isArray(h.litters)) h.litters = [];
      if (!Array.isArray(h.attacks)) h.attacks = [];
      if (typeof h.hidden === "undefined") h.hidden = true;
      if (!h.name || h.name === "dogs" || h.name === "Dogs") {
        h.name = "Dogs 🐕";
      }
    }
  });
  // ---- Cats hobby ----
  // Same data shape as dogs (animals/breedings/litters/attacks). Attacks
  // record kills/pest-catches for barn cats.
  const hasCats = data.hobbies.some(h => h.id === "cats");
  if (!hasCats) {
    data.hobbies.push({ id: "cats", name: "Cats 🐈", type: "cats", icon: "sprout", animals: [], breedings: [], litters: [], attacks: [], hidden: true });
  }
  data.hobbies.forEach((h) => {
    if (h.type === "cats") {
      if (!Array.isArray(h.animals)) h.animals = [];
      if (!Array.isArray(h.breedings)) h.breedings = [];
      if (!Array.isArray(h.litters)) h.litters = [];
      if (!Array.isArray(h.attacks)) h.attacks = [];
      if (typeof h.hidden === "undefined") h.hidden = true;
      if (!h.name || h.name === "cats" || h.name === "Cats") {
        h.name = "Cats 🐈";
      }
    }
  });
  // ---- Maple Syrup hobby ----
  // Per-season aggregate model. Each season tracks total taps + start/end
  // dates; entries (sap_collected, boil, supplies, infrastructure) attach
  // to a seasonId.
  const hasMapleSyrup = data.hobbies.some(h => h.id === "maple_syrup");
  if (!hasMapleSyrup) {
    data.hobbies.push({ id: "maple_syrup", name: "Maple Syrup 🍁", type: "maple_syrup", icon: "sprout", seasons: [], hidden: true });
  }
  data.hobbies.forEach((h) => {
    if (h.type === "maple_syrup") {
      if (!Array.isArray(h.seasons)) h.seasons = [];
      if (typeof h.hidden === "undefined") h.hidden = true;
      if (!h.name || h.name === "maple_syrup" || h.name === "Maple Syrup") {
        h.name = "Maple Syrup 🍁";
      }
    }
  });
  // ---- Sheep hobby ----
  const hasSheep = data.hobbies.some(h => h.id === "sheep");
  if (!hasSheep) {
    data.hobbies.push({ id: "sheep", name: "Sheep 🐑", type: "sheep", icon: "sprout", animals: [], breedings: [], shearings: [], subType: "mixed", hidden: true });
  }
  data.hobbies.forEach((h) => {
    if (h.type === "sheep") {
      if (!Array.isArray(h.animals)) h.animals = [];
      if (!Array.isArray(h.breedings)) h.breedings = [];
      if (!Array.isArray(h.shearings)) h.shearings = [];
      if (!h.subType) h.subType = "mixed";
      if (typeof h.hidden === "undefined") h.hidden = true;
    }
  });

  // ---- Horses hobby ----
  const hasHorses = data.hobbies.some(h => h.id === "horses");
  if (!hasHorses) {
    data.hobbies.push({ id: "horses", name: "Horses 🐴", type: "horses", icon: "sprout", animals: [], breedings: [], farrier: [], vet: [], deworming: [], rides: [], hidden: true });
  }
  data.hobbies.forEach((h) => {
    if (h.type === "horses") {
      if (!Array.isArray(h.animals)) h.animals = [];
      if (!Array.isArray(h.breedings)) h.breedings = [];
      if (!Array.isArray(h.farrier)) h.farrier = [];
      if (!Array.isArray(h.vet)) h.vet = [];
      if (!Array.isArray(h.deworming)) h.deworming = [];
      if (!Array.isArray(h.rides)) h.rides = [];
      if (typeof h.hidden === "undefined") h.hidden = true;
    }
  });

  // ---- Sourdough hobby ----
  const hasSourdough = data.hobbies.some(h => h.id === "sourdough");
  if (!hasSourdough) {
    data.hobbies.push({ id: "sourdough", name: "Sourdough 🍞", type: "sourdough", icon: "sprout", starters: [], bakes: [], hidden: true });
  }
  data.hobbies.forEach((h) => {
    if (h.type === "sourdough") {
      if (!Array.isArray(h.starters)) h.starters = [];
      if (!Array.isArray(h.bakes)) h.bakes = [];
      if (typeof h.hidden === "undefined") h.hidden = true;
    }
  });
  data.hobbies.forEach((h) => {
    if (h.type === "farmstand") {
      if (!Array.isArray(h.items)) h.items = [];
      if (typeof h.hidden === "undefined") h.hidden = true;
      // Auto-rename users who got the old 🏪 emoji to the new 🧾 (one-time)
      if (h.name === "Farmstand 🏪") h.name = "Farmstand 🧾";
    }
  });
  // Backfill onboardedAt for existing accounts that have data but somehow
  // never had the flag set (e.g. old test accounts, or pre-onboarding-wizard
  // signups). Anyone with a homestead name OR any entries OR any hobbies
  // beyond the defaults is treated as already-onboarded.
  if (!data.onboardedAt) {
    const hasName = typeof data.homesteadName === "string" && data.homesteadName.trim().length > 0;
    const hasEntries = Object.values(data.entries || {}).some(
      (arr) => Array.isArray(arr) && arr.length > 0
    );
    const hasFlocks = (data.hobbies || []).some(h => Array.isArray(h.flocks) && h.flocks.length > 0);
    const hasItems = (data.hobbies || []).some(h => Array.isArray(h.items) && h.items.length > 0);
    const hasSales = Array.isArray(data.sales) && data.sales.length > 0;
    if (hasName || hasEntries || hasFlocks || hasItems || hasSales) {
      data.onboardedAt = Date.now();
    }
  }
  // Backfill flockId on un-flocked egg-layer entries. Existing accounts with
  // entries logged before flock-scoping was added had no flockId. Assign them
  // all to the first flock for that hobby so per-flock analytics work cleanly.
  // This is a one-time backfill — once entries have flockId, this runs without
  // effect. Only touches entries with actions that are flock-scoped.
  const flockScopedActions = ["fed","bedding","death","eggs","eggs_laid","sold_eggs","note","issue","broody"];
  if (eggLayersHobby && Array.isArray(eggLayersHobby.flocks) && eggLayersHobby.flocks.length > 0) {
    const defaultFlockId = eggLayersHobby.flocks[0].id;
    const eggLayerEntries = data.entries[eggLayersHobby.id] || [];
    eggLayerEntries.forEach(e => {
      if (!e.flockId && flockScopedActions.includes(e.action)) {
        e.flockId = defaultFlockId;
      }
    });
  }

  // Sex split + broody backfill — each flock gets `females` and `males` ints
  // (default everyone to female, since most laying flocks are all hens) and
  // `broodyCount` (default 0). namedBirds gain a `broody` boolean too.
  // Done unconditionally so existing flocks pick up the new fields cleanly.
  if (eggLayersHobby && Array.isArray(eggLayersHobby.flocks)) {
    eggLayersHobby.flocks.forEach(fl => {
      const total = Number(fl.birdCount) || 0;
      if (typeof fl.females !== "number") fl.females = total;
      if (typeof fl.males !== "number") fl.males = 0;
      if (typeof fl.broodyCount !== "number") fl.broodyCount = 0;
      if (Array.isArray(fl.namedBirds)) {
        fl.namedBirds.forEach(b => {
          if (typeof b.broody !== "boolean") b.broody = false;
        });
      }
    });
  }

  // International support — units backfill. Defaults to USD/Fahrenheit/auto
  // for existing accounts. Hemisphere auto-detects from saved location lat.
  if (!data.units || typeof data.units !== "object") {
    data.units = { temperature: "F", currency: "USD", hemisphere: "auto" };
  } else {
    if (!data.units.temperature) data.units.temperature = "F";
    if (!data.units.currency) data.units.currency = "USD";
    if (!data.units.hemisphere) data.units.hemisphere = "auto";
  }

  // One-time: reconcile death entries with animal archive state. Before this
  // change, Cows/Goats/Pigs would log a death entry with animalId set but
  // never archive the animal — so the animal stayed in the active list.
  // Now we walk existing entries and:
  //   1. If a death entry has animalId and that animal isn't archived → archive it.
  //   2. If a death entry has no animalId AND the hobby has exactly one
  //      un-archived animal → attribute the death to that animal and archive
  //      it. (Per user request — only acts when the attribution is unambiguous.)
  // Guarded by a flag so it only runs once per account.
  // Sheep & Dogs already handle this correctly in their own save handlers,
  // but the migration still applies to any old entries on those hobbies
  // where the animal was somehow never archived. Defensive.
  if (!data.deathArchiveMigrationV1) {
    const livestockTypes = new Set(["cows", "goats", "pigs", "sheep", "horses", "dogs", "cats"]);
    for (const h of data.hobbies || []) {
      if (!livestockTypes.has(h.type)) continue;
      if (!Array.isArray(h.animals)) continue;
      const entries = data.entries?.[h.id];
      if (!Array.isArray(entries)) continue;
      const deaths = entries.filter(e => e && e.action === "death");
      for (const e of deaths) {
        let animal = null;
        if (e.animalId) {
          animal = h.animals.find(a => a.id === e.animalId);
        } else {
          // Try unambiguous attribution: exactly one un-archived animal.
          const alive = h.animals.filter(a => !a.archived);
          if (alive.length === 1) {
            animal = alive[0];
            e.animalId = animal.id;
            e.animalName = animal.name;
          }
        }
        if (animal && !animal.archived) {
          animal.archived = true;
          animal.archivedReason = e.cause ? `Died: ${e.cause}` : "Died";
          animal.archivedDate = e.date || todayStr();
        }
      }
    }
    data.deathArchiveMigrationV1 = true;
  }

  return data;
}

// ============ PHOTO HELPERS ============
// Backwards compatibility: old entries use `entry.photoPath` (single string),
// new entries use `entry.photoPaths` (array). This helper returns a unified array
// of photo paths for any entry, regardless of which shape it has.
function getEntryPhotos(entry) {
  if (!entry) return [];
  if (Array.isArray(entry.photoPaths) && entry.photoPaths.length > 0) {
    return entry.photoPaths;
  }
  if (entry.photoPath) {
    return [entry.photoPath];
  }
  return [];
}
// Returns the first/primary photo path for thumbnail uses, or null.
function getEntryPrimaryPhoto(entry) {
  const all = getEntryPhotos(entry);
  return all.length > 0 ? all[0] : null;
}

// ============ CSV EXPORT ============
// Bundles all the user's entries into a multi-sheet zip-friendly format.
// Since real CSV multi-sheet would need a library, we instead make ONE wide CSV
// with a "Hobby" column, plus separate downloads for cleaner per-hobby files.
// We'll trigger one combined CSV download — the simplest, most useful default.
//
// Sources of rows in the export:
//   1. data.entries[hobbyId]              — log entries per hobby (feed, eggs,
//                                            harvests, butcher events, etc.)
//   2. h.archivedSeasons[].finalEntries   — snapshotted entries for finished
//                                            garden seasons
//   3. h.archivedBatches[].finalEntries   — snapshotted entries for finalized
//                                            meat-bird batches
//   4. data.sales[]                       — top-level sale records (Sales tab)
//                                            with full price/buyer/totals
function exportAllAsCsv(data) {
  // Collect all entries into one flat array, with hobby info attached.
  const rows = [];
  const hobbies = data.hobbies || [];
  const hobbiesByType = new Map(hobbies.map(h => [h.type, h]));
  const customersById = new Map((data.customers || []).map(c => [c.id, c.name]));

  hobbies.forEach((h) => {
    const liveEntries = (data.entries[h.id] || []).map((e) => ({ ...e, hobbyName: h.name, hobbyType: h.type, archived: false }));
    rows.push(...liveEntries);

    // Pull from archived seasons / batches
    (h.archivedSeasons || []).forEach((s) => {
      (s.finalEntries || []).forEach((e) => {
        rows.push({ ...e, hobbyName: h.name, hobbyType: h.type, archived: true, contextName: s.name || "" });
      });
    });
    (h.archivedBatches || []).forEach((b) => {
      (b.finalEntries || []).forEach((e) => {
        rows.push({ ...e, hobbyName: h.name, hobbyType: h.type, archived: true, contextName: b.name || "" });
      });
    });
  });

  // ALSO walk data.sales[] — these are top-level sale records logged via
  // the Sales tab. They never live under data.entries, which is why an
  // earlier version of this export silently dropped them.
  (data.sales || []).forEach((s) => {
    if (!s) return;
    const sourceHobby = s.hobbyId ? hobbies.find(h => h.id === s.hobbyId) : hobbiesByType.get(s.hobbyType);
    const hobbyName = sourceHobby ? sourceHobby.name : (s.hobbyType || "Sale");
    rows.push({
      ...s,
      action: "sale",
      hobbyName,
      // Salvage qty into the canonical CSV columns. Sales store qty on
      // `qty`; entries store qty on `count` or `quantity` depending on
      // the action. The columns below check all three.
      hobbyType: s.hobbyType || "",
      buyer: customersById.get(s.buyerId) || s.buyerName || "",
      // Keep the original for traceability in case a power-user reconciles
      archived: false,
    });
  });

  // Sort newest first
  rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // Define columns. Order matters — most useful first. Sales-relevant columns
  // (revenue/price/buyer/totals) sit near the start so they're visible
  // without horizontal scrolling in spreadsheet apps.
  const columns = [
    "date", "hobbyName", "hobbyType", "action",
    // quantities — sales use `qty`, log entries use `count` or `quantity`
    "qty", "count", "quantity", "unit",
    // money — covers every sale shape (per-unit, per-lb, per-dozen, flat)
    // plus expense entries (cost). totalRevenue and totalCost get filled in
    // for farmstand/sourdough/baking/canning sale rows.
    "pricePerUnit", "pricePerLb", "pricePerDozen", "flatPrice",
    "costPerUnit", "cost", "totalRevenue", "totalCost",
    // entity / who bought / what was sold
    "buyer", "crop", "plant", "item", "saleForm", "saleType",
    "eggType", "eggPurpose", "eggTypeCustom",
    "honeyForm", "honeyContainer", "gardenUnit", "birdType",
    // measurements
    "lbs", "gallons", "avgWeight", "avgWeightLbs", "cuft",
    // events / context
    "cause", "issueType", "detail", "note",
    // weather (live entries only — sales don't have it)
    "weather_highF", "weather_lowF", "weather_precipIn", "weather_summary",
    "contextName", "archived",
  ];

  const escape = (val) => {
    if (val == null) return "";
    const s = String(val);
    // If has comma, quote, or newline, wrap in quotes and double internal quotes
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };

  const headerRow = columns.join(",");
  const bodyRows = rows.map((r) => columns.map((c) => {
    if (c === "weather_highF") return escape(r.weather && r.weather.highF != null ? r.weather.highF : "");
    if (c === "weather_lowF")  return escape(r.weather && r.weather.lowF  != null ? r.weather.lowF  : "");
    if (c === "weather_precipIn") return escape(r.weather && r.weather.precipIn != null ? r.weather.precipIn : "");
    if (c === "weather_summary") return escape(r.weather && r.weather.summary ? r.weather.summary : "");
    return escape(r[c]);
  }).join(","));

  const csv = [headerRow, ...bodyRows].join("\n");

  // Download as file
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const dateStr = localDateStr(new Date());
  const safeName = (data.homesteadName || "homestead").replace(/[^a-zA-Z0-9-_]/g, "_") || "homestead";
  a.download = `${safeName}-export-${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============ UTIL ============
// ============ DATE UTILITIES ============
// All entry dates are stored as "YYYY-MM-DD" strings representing the LOCAL
// calendar date the user logged the entry. We parse and format using local
// time, NOT UTC, so an entry logged on May 6 doesn't display as May 5 for
// users in Western timezones.
// Convert any Date object to "YYYY-MM-DD" using LOCAL calendar date.
// Use this everywhere instead of `.toISOString().slice(0, 10)` which gives
// UTC date, off-by-one for Western timezones near midnight.
const localDateStr = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
// Parse a "YYYY-MM-DD" string as local-time midnight (avoids the UTC drift
// issue with `new Date("2026-05-06")` which interprets as UTC midnight and
// shifts to the previous day for Western timezones at display time).
//
// Returns today's Date for unparseable input. Previously the helper coerced
// missing components — `2024-0-0` would silently become Dec 1, 2023, which
// was much worse than treating the input as junk. Now we validate strictly
// and fall back to "now" only when the input is clearly empty/malformed.
const parseLocalDate = (s) => {
  if (!s || typeof s !== "string") return new Date();
  const parts = s.split("-");
  if (parts.length < 3) return new Date();
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  // Validate: year reasonable, month 1-12, day 1-31. Anything outside =>
  // return today rather than producing a sneaky wrong date.
  if (!Number.isFinite(y) || y < 1900 || y > 2200) return new Date();
  if (!Number.isFinite(m) || m < 1 || m > 12) return new Date();
  if (!Number.isFinite(d) || d < 1 || d > 31) return new Date();
  return new Date(y, m - 1, d);
};
const fmtDate = (s) => {
  if (!s) return "";
  const d = parseLocalDate(s);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// ============================================================================
// CHICKEN TRACTOR DISTANCE — fun-fact comparisons
// ----------------------------------------------------------------------------
// Given a number of feet, returns a one-line "this is like..." comparison
// that's relatable at the given scale. Picks the most relatable equivalent
// based on magnitude (no point saying "1/4 of a football field" for someone
// who's logged 75 feet). The seed argument makes selection deterministic per
// surface so the same stat doesn't keep flipping on every re-render — pass
// the same seed value (e.g. the stat label) everywhere this is computed.
//
// Returns null when the distance is too small to be fun (under 25 ft).
// ============================================================================
const FEET_PER_MILE = 5280;
const tractorFunFact = (totalFeet, seed = "") => {
  const ft = Number(totalFeet) || 0;
  if (ft < 25) return null;
  // Hash the seed to a stable index into the equivalents list for that tier.
  // Same seed always picks the same equivalent, but different seeds vary
  // (so Stats tab can show one and Year in Review another).
  const seedHash = String(seed).split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);

  // Tiered equivalents. Each item: { test, formula }. test=function(ft)->bool;
  // formula=function(ft, seedHash)->string. Picked in order — first matching
  // tier wins, then within that tier seedHash chooses among the variants.
  const tiers = [
    {
      // 25 ft - 1 football field (300 ft)
      test: (f) => f < 300,
      variants: [
        (f) => `That's about ${Math.round(f / 6)} of your own steps 👣`,
        (f) => `Roughly the height of ${(f / 152).toFixed(1)} blue whales 🐋`,
        (f) => `${Math.round(f / 60)} school buses end-to-end 🚌`,
      ],
    },
    {
      // 1-10 football fields (300-3000 ft)
      test: (f) => f < 3000,
      variants: [
        (f) => `That's ${(f / 300).toFixed(1)} football fields end-to-end 🏈`,
        (f) => `${Math.round(f / 305)} Statues of Liberty laid end-to-end 🗽`,
        (f) => `${Math.round(f / 555)} Washington Monuments stacked 🏛️`,
      ],
    },
    {
      // half-mile to a mile (3000-5280 ft)
      test: (f) => f < FEET_PER_MILE,
      variants: [
        (f) => `That's ${(f / 300).toFixed(0)} football fields end-to-end 🏈`,
        (f) => `Almost a mile — you've moved ${(f / FEET_PER_MILE).toFixed(2)} miles 🚜`,
        (f) => `${Math.round(f / 264)} city blocks 🏙️`,
      ],
    },
    {
      // 1-5 miles
      test: (f) => f < 5 * FEET_PER_MILE,
      variants: [
        (f) => `That's ${(f / FEET_PER_MILE).toFixed(1)} miles — a solid walk 🚶`,
        (f) => `${(f / FEET_PER_MILE).toFixed(1)} miles, or ${Math.round(f / 300)} football fields 🏈`,
        (f) => `${(f / FEET_PER_MILE / 0.8).toFixed(1)} laps around Central Park 🌳`,
      ],
    },
    {
      // 5-30 miles (marathon territory)
      test: (f) => f < 30 * FEET_PER_MILE,
      variants: [
        (f) => `${(f / FEET_PER_MILE).toFixed(1)} miles — ${(f / FEET_PER_MILE / 26.2 * 100).toFixed(0)}% of a marathon 🏃`,
        (f) => `${(f / FEET_PER_MILE).toFixed(1)} miles — about the width of Manhattan ${Math.round(f / FEET_PER_MILE / 2.3)} times over 🗽`,
        (f) => `That's ${(f / FEET_PER_MILE).toFixed(1)} miles, or roughly ${Math.round(f / FEET_PER_MILE / 3.1)} 5Ks 👟`,
      ],
    },
    {
      // 30-50 miles (Rhode Island scale)
      test: (f) => f < 50 * FEET_PER_MILE,
      variants: [
        (f) => `${(f / FEET_PER_MILE).toFixed(0)} miles — about the length of Rhode Island 🌊`,
        (f) => `${(f / FEET_PER_MILE).toFixed(0)} miles, or ${(f / FEET_PER_MILE / 26.2).toFixed(1)} marathons 🏃`,
        (f) => `${(f / FEET_PER_MILE).toFixed(0)} miles — like walking from one coast of Rhode Island to the other 🦞`,
      ],
    },
    {
      // 50-200 miles
      test: (f) => f < 200 * FEET_PER_MILE,
      variants: [
        (f) => `${(f / FEET_PER_MILE).toFixed(0)} miles — that's like crossing Connecticut end-to-end 🍃`,
        (f) => `${(f / FEET_PER_MILE).toFixed(0)} miles, or ${(f / FEET_PER_MILE / 26.2).toFixed(1)} marathons 🏃`,
        (f) => `${(f / FEET_PER_MILE).toFixed(0)} miles — ${(f / FEET_PER_MILE / 50).toFixed(1)}× the length of Rhode Island 🌊`,
      ],
    },
    {
      // 200+ miles (epic territory)
      test: () => true,
      variants: [
        (f) => `${(f / FEET_PER_MILE).toLocaleString(undefined, {maximumFractionDigits:0})} miles — that's a road trip distance 🛻`,
        (f) => `${(f / FEET_PER_MILE).toLocaleString(undefined, {maximumFractionDigits:0})} miles, or ${(f / FEET_PER_MILE / 26.2).toFixed(0)} marathons 🏃`,
        (f) => `${(f / FEET_PER_MILE).toLocaleString(undefined, {maximumFractionDigits:0})} miles — your chickens have seen things 👀`,
      ],
    },
  ];

  const tier = tiers.find(t => t.test(ft));
  const idx = Math.abs(seedHash) % tier.variants.length;
  return tier.variants[idx](ft);
};

// Format raw feet for display. Switches to miles once over 1000 ft so the
// number stays digestible. Kept compact since this is used in tight cards.
const fmtTractorDistance = (totalFeet) => {
  const ft = Number(totalFeet) || 0;
  if (ft < 1000) return `${ft.toLocaleString()} ft`;
  const miles = ft / FEET_PER_MILE;
  return miles < 10
    ? `${miles.toFixed(2)} mi`
    : `${miles.toLocaleString(undefined, { maximumFractionDigits: 0 })} mi`;
};

// ============================================================================
// INTERNATIONAL FORMATTING — currency, temperature, hemisphere
// ----------------------------------------------------------------------------
// Helpers live in ./units.js so per-hobby files (Sheep, Farmstand, YearInReview,
// Sales, Bees) can import them too. The main App component (below) calls
// setUserUnits() in a useEffect to keep the module-level state in sync with
// data.units.
// ============================================================================
import { fmtMoney, fmtTemp, setUserUnits, getCurrentHemisphere, currencySymbol } from "./units.js";

// Generate a unique ID. Prefers crypto.randomUUID() (available on all modern
// browsers + iOS/Android WebViews); falls back to Math.random for ancient
// runtimes. The fallback is a 12-char base36 string, much wider than the
// old 8-char version it replaced, so the collision risk in legacy environments
// also drops by ~16,000x.
const newId = () => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (_) {}
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6)
  );
};

// What's New version — bump this with each notable release.
// Convention: when adding a new release item, prepend it to the top of
// WHATS_NEW and trim the array to keep ~6-8 items (oldest roll off).
// Bumping CURRENT_VERSION causes the popup to re-show once for every user
// who hasn't seen this version yet.
// ============================================================================
// APP STORE FUNDRAISER — config
// ----------------------------------------------------------------------------
// Apple Developer: $99/year + Google Play: $25 one-time + buffer for icons,
// screenshots, and my time = $200 goal. UPDATE THE RAISED AMOUNT BELOW MANUALLY
// as tips come in via Stripe. (Auto-pulling from Stripe is a future enhancement.)

const CURRENT_VERSION = 39;

const WHATS_NEW = [
  "🍎 Supporting Henalytics on iOS now uses Apple's In-App Purchase system — same tip tiers, same gratitude, but Apple handles the checkout natively. You can also restore prior purchases and manage your subscription right from the Support menu. (Web continues to use the existing checkout flow.)",
  "📊 Year in Review now covers every hobby — Dogs, Cats, Maple Syrup, Dehydrating, Fermentation, and Freeze Drying all get their own card on the Year in Review page if you have the hobby enabled. New stats include puppies/kittens born, vet visits, kills/pests caught for working cats, syrup made and boil ratio for maple, batches and output ounces for the preserving hobbies. Stats only show for hobbies you actually use, so the page stays focused.",
  "🔨 Infrastructure tracking in every hobby — Sourdough, Baking, Canning, Farmstand, Dehydrating, and Fermentation now have a 🔨 Infrastructure button to log one-time costs like a new oven, pressure canner, dehydrator, fermentation crocks, or a roadside stand build. Each hobby's stats page now totals what you've spent on infrastructure separately from ongoing costs, so you can see the real investment side by side with what you're producing. (Cats inherited this from Dogs, and Maple Syrup already had it.)",
  "🐈 New hobby: Cats — track cats like dogs, with vet/feed/weight logs, breeding records, litters with named kittens, and full pedigree. Plus a Barn cat toggle that unlocks pest-catch tracking: log every mouse, rat, vole, or other pest your working cat catches, by date and what they were protecting. Stats show kills per cat and pest type.",
  "🍁 New hobby: Maple Syrup — track each sugaring season with total taps, sap collected, syrup yielded, and supplies/infrastructure costs. Includes the 40:1 industry rule of thumb so you can see your boil efficiency, plus year-over-year syrup yield charts when you've got multiple seasons logged.",
  "💕 Breeding for cows, goats, and sheep — log who bred with whom (or an external/unknown sire), method (Natural / AI / Embryo transfer / Other), and breed date. Expected calving / kidding / lambing date auto-fills based on species gestation (cows 283 days, goats 150, sheep 147) and gets added to your calendar. All editable in case your breed runs shorter or longer. Sheep breeding records also now show method in the history view.",
  "🐣 Chick sales fixed and editable — sales from the brooder now show up properly in the Sales tab with the right icon and details, and you can edit or delete them like any other sale. Edits sync back to the brooder so your remaining-chick count stays correct.",
  "🥚 Log eggs as \"Total\" across all flocks — multi-flock users can now pick \"Total — split evenly across all flocks\" when logging eggs collected. If the count doesn't divide evenly, the remainder spreads one egg at a time (e.g. 13 across 4 flocks → 4/3/3/3). Per-flock analytics still work because we create one entry per flock under the hood.",
  "↕️ Reorder your hobbies — open Manage Hobbies in Settings and tap \"Reorder hobbies\" to set the order they appear in the picker dropdown. Whichever one you put at the top becomes the default tab that opens when you reload the app.",
  "📧 Weekly chore email — turn it on in Settings and we'll email what's on your calendar every Sunday evening. Quiet weeks get a warm hello; busy weeks get a tidy checklist sorted by day. Farmhands can each independently opt in or out from the Farmhands menu.",
  "🌱 New $1/month Seedling tier — added a $1 option alongside $3, $5, and $10 in the support menu, for anyone who'd like to chip in but doesn't want to commit to more. Every little bit helps keep Henalytics running ad-free.",
  "📦 Past batches on the meat birds page — when you finalize a batch, it now shows up in a collapsible \"Past batches\" section at the bottom of the meat birds home page. Each row shows the batch name, dates, total started, butchered count, and total weight. Full per-batch records still live in the Analytics tab.",
  "🍖 Feed logging for dogs — Dogs now have a Fed button alongside Weight, Vet/meds, etc. Log how much food the pack went through (or per-dog if you want), with the lbs/cups toggle.",
  "🥣 Cups or lbs for feed — egg layers, meat birds, rabbits, and dogs can now log feed in cups instead of pounds. Tap the unit toggle in the feed log to switch. Stats show whichever unit you logged in. Feed Conversion Ratio still needs lbs since it's defined that way, but everything else just shows the amount.",
  "📊 Stats filter shows your active batches — if you filter by \"Past 7 days\" or \"Past 30 days\" and a batch was active during that window (even if it started before), it now shows up with the entries logged in that window. Same fix for incubator runs. Previously a 35-day-old active batch would silently drop out of \"This week\" stats even though you'd been feeding it all week.",
  "🐔 Pick a breed when you name a bird — egg layers and meat birds now have a breed dropdown in the Name a bird form, with the right breed list based on whether your flock is chickens, ducks, turkeys, quail, geese, guineas, or peafowl. Already-named birds can have a breed added/changed too. Totally optional. Dogs and rabbits already had breed pickers from the start.",
  "🚜 Move chicken tractor — egg layers and meat birds now have a Move Tractor tile. First time you log it, Henalytics asks roughly how far you move it; after that it's a one-tap log. Your total tractor distance shows up on the share card and adds up over time. (Year-in-review is going to be fun.)",
  "🐎 Apply vet/farrier/dewormer to multiple horses at once — when you log a visit, tap each horse it applied to (or tap \"Select all\" if the whole barn got the same treatment). The visit shows up in every selected horse's history. Saves you from logging the same thing 8 times.",
  "🥚 Incubator share stats fixed — the share card now correctly shows eggs set, hatched, hatch rate, and run count across today/week/year/all-time filters. (It was reading the wrong fields, so everything looked empty.)",
  "🌾 Monthly supporter shout-out — on the 1st-3rd of each month, the thank-you popup now lists out the homestead names of everyone who chipped in the prior month. (If you donated and want your homestead featured, you'll get a chance to add your name after your next tip.) Anonymous donors stay anonymous.",
  "🍼 Track calves as their own animals — when you log a calf born, you can now name it, set its sex, and add a tag number. Named calves show up in your cow list alongside their mother, with the same milk/feed/health/sale/death buttons and a 📜 history of their own. The pedigree automatically links the calf to its dam. Leave the name blank to just record the birth count like before.",
  "🐴 Tidier horse rows — each horse now shows just 🧬 Pedigree and 📜 History on its card, matching the other livestock pages. 🏷️ Sale and 🪦 Died moved up into the top action buttons; tap one and pick which horse from the dropdown.",
  "📜 Animal history view — tap the new 📜 History button on any horse, cow, goat, sheep, pig, rabbit, or dog to see a full timeline of everything ever logged for that animal: weight, milk, vet visits, farrier, deworming, rides, breedings, shearings, sales, and death. Sorted newest-first so the latest event is at the top.",
  "🏷️ Log a sale or report a death from any animal page — sold/leased/rehomed/died moves the animal to archived and (for sales) creates a record in your Sales tab. Plus new horse breeds (Warmblood, Sport horse, Draft type) and activities (Driving, Lunging, Trails, Show).",
  "🌱 Pin any plant to your garden map — added an \"Other\" option to the garden map's plant picker. Tap it, type any plant name (watermelon radish, marigold, yarrow, whatever you grow), and drop a pin. The custom name shows up on the pin and in its detail view.",
  "🌳 Orchard + plant action logs — perennials are now split into 🌿 Perennial Plants (berry bushes, asparagus, rhubarb, vines) and 🌳 Orchard (fruit and nut trees), each in its own expandable section. Tap any plant or tree to open its detail page where you can log actions like spray, prune, fertilize, mulch, or treat — each one dated and saved to that plant's history. Existing perennials with 'tree' in the name automatically moved to the Orchard; you can move any item between sections from its edit screen.",
  "💀 Death logs now archive the animal — when you report a death on a cow, goat, pig, or a named bird in a flock, that animal moves out of your active list (with the cause noted, if you added one). Old death entries on your account were tidied up too. Tap an archived animal to restore it if it was a misclick.",
  "🥧 Baking + 🫙 Canning hobbies — save your favorite recipes (with links and notes), log bakes with ratings, and track canning batches in a pantry view with eat-by date warnings. Both can sell into the Sales tab so you can track loaves sold and jars sold alongside everything else. Find them in Settings → Manage Hobbies.",
  "📦 Farmstand inventory + restock — items now track stock, with low-stock warnings on the page and inside the sell modal. New 📦 Restock button on each item lets you add batches with optional batch cost. Quantity presets (+½ doz, +1 lb, etc) make logging sales by the dozen or pound one tap. Reset password emails now properly drop you into a 'set new password' form. The ❤️ Support Henalytics button moved out of the barn into its own icon at the top of the screen so it's easier to find.",
  "🐇 Rabbits redesigned — per-rabbit tracking instead of hutch counts. Each rabbit gets a name, breed, sex, role, pedigree, breeding history, and weight log. Does have a 🐇 Bred button that auto-creates a kindle reminder 31 days out. Each rabbit can have a hutch label, and the page auto-groups by hutch once you have two or more (a flat list when you only have one). Your old hutches were automatically converted to individual rabbits (you can rename them anytime). Old log entries are kept under a 'Legacy log entries' section so nothing's lost.",
  "🧬 Livestock pedigree — visual family tree showing sire, dam, and registry info on your goats, cows, pigs, sheep, horses, and rabbits. Each animal has a 🧬 Pedigree button that shows ancestors fanning up and descendants fanning down, up to 3 generations. Tap any relative to view their pedigree.",
  "🔪 Butcher tile for egg layers — log butchering, sales, rehoming, deaths, and other reasons birds leave the flock, with the same full set of options the meat-bird hobby has. Find the new Butcher tile on your egg-layer dashboard.",
  "🌱 Per-variety harvest timeframes — got 6 kinds of tomatoes? Add each variety with its own days-to-harvest. Sungold ripens in 65 days, San Marzano in 80, and your calendar shows each one ready at the right time. Find it in the new 'Which variety?' step when planning a crop.",
  "🐣 Multiple meat-bird batches — run more than one batch of meat chickens at the same time. Each batch has its own age, feed log, and butcher records. Pick which batch you're logging to when you have more than one going.",
  "🐴 Horses hobby — per-horse tracking with rides, farrier visits, vet, deworming, breeding & foaling reminders",
  "🐑 Custom breeds — added \"Other\" option to breed dropdowns on Sheep, Goats, Cows, and Horses so you can type in any breed",
  "🍞 Sourdough hobby — track starters with feeding logs, bakes with cost & profit, recipes, and crumb ratings",
  "🐝 Beekeeping upgrades — log hive cost when you add a hive, plus a varroa mite testing log with high-mite alerts",
  "🌍 International friends — pick your currency (USD, AUD, GBP, EUR, etc), Celsius or Fahrenheit, and southern-hemisphere seasons. Find it in Settings.",
  "🐑 Sheep hobby — dairy, meat, wool, or mixed flocks with lambing tracking, shearing logs, and calendar reminders",
  "🐔 Per-flock tracking — feed, bedding, deaths, and sold eggs now attach to a specific flock so you get real per-flock cost-per-egg numbers",
  "🙏 Monthly thank-you got an upgrade — clearer mission note + a 'Buy Henalytics a bag of feed' button to support the app",
  "🧾 Farmstand hobby — saved items with cost & price for one-tap sales, plus profit + top-seller analytics in the Stats tab",
  "❄️ Butcher any bird — chickens, ducks, quail, geese, turkeys all go to the freezer log with date + weight",
  "💵 Hatchery tracking — log where you got each flock and how much you paid",
  "🐐 Goats, 🐄 Cows & 🐷 Pigs — three new hobbies with per-animal tracking, milk logging, FCR, and butcher stats",
];

// Spouse Mode helpers — fudge numbers for "presentation" purposes
// Costs shown at 10%, production shown at 200%
const spouseCost = (n, spouseMode) => spouseMode ? (Number(n) || 0) * 0.1 : (Number(n) || 0);
const spouseProd = (n, spouseMode) => spouseMode ? Math.round((Number(n) || 0) * 2) : (Number(n) || 0);

// ============================================================================
// NATIVE BRIDGE (Capacitor) — graceful web fallback
// ----------------------------------------------------------------------------
// Henalytics wraps for iOS/Android via Capacitor. Inside the native shell,
// window.location.href = "https://..." can hijack the WebView and strand the
// user outside our app (no nav bar, no back button). The @capacitor/browser
// plugin opens external URLs in an in-app browser tab the user can dismiss
// back to Henalytics. window.open and target="_blank" have the same issue.
//
// All helpers here degrade to plain web behavior when Capacitor is absent,
// so the same code works in the browser, the PWA, and the native apps.
// ============================================================================
const isNativeApp = () => {
  try {
    return !!(typeof window !== "undefined" && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch (_) { return false; }
};

const getNativePlatform = () => {
  try {
    if (typeof window !== "undefined" && window.Capacitor && window.Capacitor.getPlatform) {
      return window.Capacitor.getPlatform(); // "ios" | "android" | "web"
    }
  } catch (_) {}
  return "web";
};

// Open an external URL. In native: uses @capacitor/browser (in-app safari/
// chrome custom tab — user swipes/taps to dismiss back to Henalytics).
// On the web: opens a new tab. The dynamic imports below go through
// `loadCapacitor()` which hides the package specifier from Vite's static
// analyzer — otherwise the web build fails to resolve @capacitor/* before
// Capacitor is installed (Phase 3 of the native build). Once installed, the
// runtime import resolves normally inside the native shell.
const loadCapacitor = (pkg) => {
  // Indirection: Vite/Rollup can't statically analyze a string built at
  // runtime, so it leaves this alone at build time. The try/catch around the
  // call site handles "package not installed" by falling back to web behavior.
  const spec = /* @vite-ignore */ pkg;
  return import(/* @vite-ignore */ spec);
};

const openExternalUrl = async (url) => {
  if (!url) return;
  if (isNativeApp()) {
    try {
      const { Browser } = await loadCapacitor("@capacitor/browser");
      await Browser.open({ url });
      return;
    } catch (e) {
      // Plugin missing or threw — fall back to system handler via App plugin
      try {
        const { App } = await loadCapacitor("@capacitor/app");
        await App.openUrl({ url });
        return;
      } catch (_) {
        // Final fallback: WebView nav (last resort — may strand user, but
        // better than nothing if both plugins are missing).
        try { window.location.href = url; } catch (__) {}
      }
      return;
    }
  }
  // Web: open in a new tab.
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (_) {
    try { window.location.href = url; } catch (__) {}
  }
};

// Soft keyboard listener for native iOS/Android.
//
// Behavior split by platform:
//   - Android: when the keyboard appears, sets --keyboard-height and adds
//     `keyboard-open` to <body>. CSS uses these to shift fixed-position
//     modal overlays up so the focused input stays visible.
//   - iOS: only fires the scrollIntoView fallback. We DO NOT add the
//     `keyboard-open` class, because iOS WKWebView already handles keyboard
//     avoidance natively — adding our CSS shift on top double-compensates
//     and pushes modal content far above the keyboard with a big gap. The
//     ensureFocusedVisible() scroll is a safety net for any input that
//     WKWebView misses (rare).
//   - Web: no-op, browsers handle their own reflow.
const useNativeKeyboardInset = () => {
  React.useEffect(() => {
    if (!isNativeApp()) return;
    let currentHeight = 0;

    // iOS detection. Capacitor exposes the platform via getPlatform(); we use
    // the same window.Capacitor shape that isNativeApp() depends on so we
    // don't take a new dep. Falls back to userAgent sniffing if the API isn't
    // available for some reason (defensive — should never hit).
    const platform = (() => {
      try {
        if (window.Capacitor?.getPlatform) return window.Capacitor.getPlatform();
      } catch (_) {}
      return /iphone|ipad|ipod/i.test(navigator.userAgent || "") ? "ios" : "android";
    })();
    const isIOS = platform === "ios";

    // Scroll the focused input/textarea into view above the keyboard. Uses
    // requestAnimationFrame so layout has settled after the keyboard appears.
    const ensureFocusedVisible = () => {
      const el = document.activeElement;
      if (!el || el === document.body) return;
      const tag = (el.tagName || "").toLowerCase();
      if (tag !== "input" && tag !== "textarea" && tag !== "select" && !el.isContentEditable) return;
      requestAnimationFrame(() => {
        try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {}
      });
    };

    // NOTE: On Android, Keyboard.addListener from @capacitor/keyboard does not
    // fire reliably (the events go to window instead). The plugin docs explicitly
    // mention this fallback: events are dispatched on window for compatibility
    // with cordova-plugin-ionic-keyboard. Listening on window works on both
    // platforms and avoids the plugin-listener bug.
    const onShow = (e) => {
      currentHeight = (e && e.keyboardHeight) || 0;
      document.documentElement.style.setProperty("--keyboard-height", currentHeight + "px");
      // Android-only: enable CSS modal shift. iOS WKWebView handles its own
      // input scroll already; adding our class causes the double-shift bug.
      if (!isIOS) document.body.classList.add("keyboard-open");
      ensureFocusedVisible();
    };
    const onHide = () => {
      currentHeight = 0;
      document.documentElement.style.setProperty("--keyboard-height", "0px");
      document.body.classList.remove("keyboard-open");
    };
    const onFocusIn = () => {
      if (currentHeight > 0) ensureFocusedVisible();
    };

    window.addEventListener("keyboardDidShow", onShow);
    window.addEventListener("keyboardDidHide", onHide);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      window.removeEventListener("keyboardDidShow", onShow);
      window.removeEventListener("keyboardDidHide", onHide);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, []);
};

// Hardware back-button handler for Android. iOS doesn't have one. On the web
// this is a no-op. Pass a function that returns true if it handled the press
// (e.g. closed a modal), false to let the default Capacitor behavior run
// (which on the root screen exits the app — matches Android conventions).
const useNativeBackButton = (handler) => {
  React.useEffect(() => {
    if (!isNativeApp()) return;
    if (getNativePlatform() !== "android") return;
    let removeListener = null;
    let cancelled = false;
    (async () => {
      try {
        const { App } = await loadCapacitor("@capacitor/app");
        const sub = await App.addListener("backButton", () => {
          const handled = handler && handler();
          if (!handled) App.exitApp().catch(() => {});
        });
        if (cancelled) { sub.remove(); return; }
        removeListener = () => sub.remove();
      } catch (_) {}
    })();
    return () => { cancelled = true; if (removeListener) removeListener(); };
  }, [handler]);
};

// Deep-link listener for henalytics:// URLs (password recovery, invite codes).
// On web this is a no-op — the URL hash/query approach handles it. On native
// the Capacitor App plugin fires appUrlOpen when the OS hands us a deep link.
const useNativeDeepLinks = (onUrl) => {
  React.useEffect(() => {
    if (!isNativeApp()) return;
    let removeListener = null;
    let cancelled = false;
    (async () => {
      try {
        const { App } = await loadCapacitor("@capacitor/app");
        const sub = await App.addListener("appUrlOpen", (event) => {
          if (event && event.url && onUrl) onUrl(event.url);
        });
        if (cancelled) { sub.remove(); return; }
        removeListener = () => sub.remove();
      } catch (_) {}
    })();
    return () => { cancelled = true; if (removeListener) removeListener(); };
  }, [onUrl]);
};

// ============================================================================
// TOAST — tiny event-bus message system to replace window.alert
// ----------------------------------------------------------------------------
// window.alert() is unreliable in Capacitor/WKWebView and looks terrible
// across platforms. The <ToastHost /> mounted at the App root listens for
// "henalytics-toast" CustomEvents and renders them as a short-lived banner.
// Call toast("message") from anywhere — no React context needed.
// ============================================================================
const toast = (message, opts = {}) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("henalytics-toast", {
    detail: { message, kind: opts.kind || "info", ms: opts.ms || 4000 },
  }));
};

function ToastHost() {
  const [items, setItems] = React.useState([]);
  React.useEffect(() => {
    const onToast = (e) => {
      const id = Math.random().toString(36).slice(2, 9);
      const { message, kind, ms } = e.detail || {};
      setItems((cur) => [...cur, { id, message, kind }]);
      setTimeout(() => {
        setItems((cur) => cur.filter((t) => t.id !== id));
      }, ms || 4000);
    };
    window.addEventListener("henalytics-toast", onToast);
    return () => window.removeEventListener("henalytics-toast", onToast);
  }, []);
  if (items.length === 0) return null;
  return (
    <div
      data-no-keyboard-shift
      style={{
        position: "fixed",
        // Respect the device notch / Dynamic Island so toasts don't render
        // behind the status bar overlay on modern iPhones. The 16px base is
        // additive to the safe-area inset (0px on non-notched devices, ~50px
        // on iPhone 14 Pro+).
        top: "calc(16px + env(safe-area-inset-top))",
        left: 0, right: 0,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        zIndex: 9999, pointerEvents: "none", padding: "0 16px",
      }}>
      {items.map((t) => (
        <div key={t.id} style={{
          background: t.kind === "error" ? "#C84B31" : "#2C1810",
          color: "#F4EDE0",
          padding: "12px 16px",
          borderRadius: 10,
          fontFamily: `'Be Vietnam Pro', -apple-system, sans-serif`,
          fontSize: 14, fontWeight: 500,
          maxWidth: 420, width: "100%",
          boxShadow: "0 4px 12px rgba(44,24,16,0.25)",
          pointerEvents: "auto",
          textAlign: "center",
        }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// SUPPORTER CHECKOUT (Stripe via /api/create-checkout-session)
// ----------------------------------------------------------------------------
// Replaces the old Stripe Payment Link buttons. Calls our server, which
// creates a Stripe Checkout Session with the user's Henalytics ID baked in
// (via client_reference_id + metadata.user_id). When the user completes
// checkout, Stripe redirects them back to `?supported=<tier>&session_id=...`
// and fires a webhook to /api/stripe-webhook, which writes to the supporters
// table. The in-app effect that watches for `?supported=` then prompts them
// to add a homestead name to the supporter wall.
//
// Tiers: "monthly_1" | "monthly_3" | "monthly_5" | "monthly_10" | "one_time"
//
// Errors are intentionally simple — if anything fails, we fall back to alerting
// the user. The user is not logged in? The fetch fails? They get a clear
// message and can try again. The backend is the source of truth for which
// price they actually get; client-side tier is just a route key.
// ============================================================================
const startCheckout = async (tier) => {
  // ---- IAP branch (native iOS/Android) ----
  // Apple's rules require IAP for digital goods sold to iOS users. Even though
  // Stripe still works on web, on native we route through RevenueCat → Apple
  // IAP. The web (Stripe) path is unchanged below this branch.
  //
  // The feature flag (window.__HENALYTICS_USE_IAP__) is set in main.jsx and
  // only flips true on native. Web is unaffected.
  const useIap = isNativeApp() && (typeof window !== "undefined" && window.__HENALYTICS_USE_IAP__ === true);

  if (useIap) {
    try {
      // Require sign-in BEFORE kicking off the Apple purchase sheet. Apple
      // doesn't care about our Supabase user — it cares about the Apple ID
      // signed into the device — so without a sign-in check here, a user
      // could complete a real purchase and have it credited to an anonymous
      // RevenueCat ID with no Henalytics account behind it. The webhook
      // handler logs that case ("anonymous purchase, awaiting user
      // identification") and skips writing a supporters row, so the supporter
      // wall never sees the purchase. Match the Stripe-branch guard below.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast("Please sign in first so we can connect this contribution to your account.");
        return;
      }

      const productId = TIER_TO_IAP_PRODUCT[tier];
      if (!productId) {
        toast(`Unknown tier: ${tier}`, { kind: "error" });
        return;
      }
      // RC handles the Apple purchase sheet, receipt validation, and webhook
      // delivery. The webhook (api/revenuecat-webhook) fires server-to-server
      // and updates the supporters table BEFORE this function returns.
      const result = await purchaseProduct(productId);
      if (!result.success) {
        if (!result.userCanceled) {
          toast(result.error || "Purchase failed", { kind: "error" });
        }
        // User canceled — silently ignore, same as if they closed Stripe Checkout
        return;
      }
      // Success — dispatch event for the supporterName prompt effect to pick up.
      // We use a custom event instead of URL params (which IAP doesn't have).
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("henalytics-iap-success", {
          detail: { tier, productId },
        }));
      }
      return;
    } catch (e) {
      console.error("startCheckout (IAP) error:", e);
      toast("Couldn't complete purchase. Please try again.", { kind: "error" });
      return;
    }
  }

  // ---- Stripe branch (web, or native with IAP flag off) ----
  try {
    // Need the user's JWT to authenticate with our API.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast("Please sign in first so we can connect this contribution to your account.");
      return;
    }

    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ tier }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.url) {
      const msg = json.error || `Checkout failed (${res.status}). Please try again in a moment.`;
      toast(msg, { kind: "error" });
      return;
    }

    // Open the Stripe Checkout page. On native, we use the in-app browser
    // (Browser plugin); on web we navigate the current tab so the
    // ?supported=... return URL lands back on the same window context.
    if (isNativeApp()) {
      // Native: use the in-app browser. When the user finishes, Stripe redirects
      // to henalytics.com — which the in-app browser presents inside the app
      // (no separate browser app handoff). The return URL hits our app, which
      // is why we made it https://henalytics.com/?supported=... rather than a
      // custom henalytics:// scheme — keeps the round-trip inside the web view.
      await openExternalUrl(json.url);
    } else {
      window.location.href = json.url;
    }
  } catch (e) {
    console.error("startCheckout error:", e);
    toast("Couldn't start checkout. Check your connection and try again.", { kind: "error" });
  }
};

// ============================================================================
// SEASON / FROST-DATE LOGIC
// ----------------------------------------------------------------------------
// Latitude is the strongest predictor of frost dates — way more so than
// hardiness zones (which are based on minimum winter temperature, not frost
// timing). We use a linear approximation derived from the Old Farmer's Almanac
// tables: at low latitudes (lat ~25°) the killing-frost window is narrow and
// late, at high latitudes (lat ~50°) it's wide and earlier. This gets within
// 1-2 weeks of published averages for most North American sites, which is
// plenty accurate for tagging logs as "winter" vs "growing season".
//
// Southern hemisphere is just flipped six months — same physics.
//
// Returns { springFrostDayOfYear, fallFrostDayOfYear } where dayOfYear is 1-365.
// "winter" is the inclusive window from fallFrost (this year) through
// springFrost (next year). Outside that window is the growing season.
// ============================================================================
const estimateFrostDates = (lat) => {
  if (lat == null || Number.isNaN(lat)) return null;
  const absLat = Math.abs(lat);
  // Clamp to a reasonable temperate-zone band. Outside that, frost concepts
  // either don't apply (tropics) or the linear model breaks down (Arctic).
  const clamped = Math.max(20, Math.min(55, absLat));
  // Spring frost (last frost) — March 1 (day 60) at lat 25, May 30 (day 150) at lat 50
  const springDay = Math.round(60 + (clamped - 25) * 3.6);
  // Fall frost (first frost) — Nov 1 (day 305) at lat 25, Sep 2 (day 245) at lat 50
  const fallDay = Math.round(305 - (clamped - 25) * 2.4);
  return { springFrostDayOfYear: springDay, fallFrostDayOfYear: fallDay };
};

// Compute the day-of-year (1-366) for a given Date in local time.
const dayOfYear = (d) => {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = (d - start) + ((start.getTimezoneOffset() - d.getTimezoneOffset()) * 60 * 1000);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const getSeason = (dateStr, data) => {
  const d = parseLocalDate(dateStr);
  const m = d.getMonth();
  const y = d.getFullYear();
  const lat = data?.homesteadLocation?.lat;
  const frost = estimateFrostDates(lat);
  const south = getCurrentHemisphere() === "south";

  // If we have a location, use the frost window. Northern: winter = before
  // springFrost OR after fallFrost. Southern: flip by 6 months — winter is
  // the middle of the calendar year (June-August-ish).
  if (frost) {
    const doy = dayOfYear(d);
    if (south) {
      // Southern hemisphere: shift the frost-window by ~half a year. Winter is
      // (springFrost - 183) to (fallFrost - 183), wrapped.
      const sFrost = ((frost.springFrostDayOfYear + 183 - 1) % 365) + 1;
      const fFrost = ((frost.fallFrostDayOfYear + 183 - 1) % 365) + 1;
      // After flipping, the winter window is fFrost → sFrost (non-wrapping).
      const inWinter = doy >= fFrost && doy <= sFrost;
      if (inWinter) return `Winter ${y}`;
      if (m >= 8 && m <= 10) return `Spring ${y}`;
      if (m === 11) return `Summer ${y + 1}`;
      if (m >= 0 && m <= 1) return `Summer ${y}`;
      return `Fall ${y}`;
    }
    // Northern hemisphere with location
    const beforeSpring = doy < frost.springFrostDayOfYear;
    const afterFall = doy > frost.fallFrostDayOfYear;
    if (beforeSpring) return `Winter ${y}`;
    if (afterFall) return `Winter ${y + 1}`; // Nov 15 → next year's winter
    // Inside the frost-free window: split into spring/summer/fall by calendar month.
    if (m >= 2 && m <= 4) return `Spring ${y}`;
    if (m >= 5 && m <= 7) return `Summer ${y}`;
    return `Fall ${y}`;
  }

  // No location set — fall back to meteorological winter (Dec 1 → Feb 28).
  if (south) {
    if (m >= 8 && m <= 10) return `Spring ${y}`;
    if (m === 11) return `Summer ${y + 1}`;
    if (m >= 0 && m <= 1) return `Summer ${y}`;
    if (m >= 2 && m <= 4) return `Fall ${y}`;
    return `Winter ${y}`;
  }
  // Northern hemisphere meteorological winter: Dec, Jan, Feb. Calendar split
  // for the rest: Mar-May spring, Jun-Aug summer, Sep-Nov fall.
  if (m === 11) return `Winter ${y + 1}`; // Dec → next year's winter
  if (m >= 0 && m <= 1) return `Winter ${y}`; // Jan-Feb
  if (m >= 2 && m <= 4) return `Spring ${y}`;
  if (m >= 5 && m <= 7) return `Summer ${y}`;
  return `Fall ${y}`;
};

// ============================================================================
// SEASON INFO (richer than getSeason) — used by HomePage filter + Journal page
// ----------------------------------------------------------------------------
// Returns a structured object instead of just a label string. Winter labels
// use a year range ("Winter 2025–26") because winter straddles two calendar
// years; the other seasons are single-year. `sortOrder` is a number suitable
// for sorting seasons newest→oldest (or oldest→newest).
//
// Solstices (~June 21 and Sept 21) split the frost-free growing window into
// spring/summer/fall. Outside the frost-free window is winter.
//
// Northern hemisphere with location:
//   • Winter Y/Y+1: from fallFrost(Y) through springFrost(Y+1) inclusive
//   • Spring Y:    springFrost(Y)+1 through June 21 inclusive
//   • Summer Y:    June 22 through Sept 21
//   • Fall Y:      Sept 22 through fallFrost(Y)-1
//
// Returns:
//   {
//     key: "winter-2025",     // stable id (start year for winter, calendar year for others)
//     label: "Winter 2025–26", // human display
//     type: "winter" | "spring" | "summer" | "fall",
//     startYear: 2025,        // for winter: year of fall frost; otherwise calendar year
//     sortOrder: 2025.4       // higher = more recent; winter > fall > summer > spring within a year
//   }
// ============================================================================
const SOLSTICE_SUMMER_START = 172; // June 21 day-of-year (172 in non-leap; off by ≤1 in leap years, close enough)
const SOLSTICE_FALL_START = 264;   // Sept 21
const SEASON_SORT_OFFSET = { winter: 0.4, fall: 0.3, summer: 0.2, spring: 0.1 };

const _makeSeasonInfo = (type, startYear) => {
  const endYY = String((startYear + 1) % 100).padStart(2, "0");
  const label = type === "winter"
    ? `Winter ${startYear}\u2013${endYY}`
    : `${type.charAt(0).toUpperCase() + type.slice(1)} ${startYear}`;
  return {
    key: `${type}-${startYear}`,
    label,
    type,
    startYear,
    sortOrder: startYear + SEASON_SORT_OFFSET[type],
  };
};

const getSeasonInfo = (dateStr, data) => {
  const d = parseLocalDate(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth();
  const doy = dayOfYear(d);
  const lat = data?.homesteadLocation?.lat;
  const frost = estimateFrostDates(lat);
  const south = getCurrentHemisphere() === "south";

  // Southern hemisphere — calendar splits, winter is mid-year, summer straddles Dec→Feb
  if (south) {
    if (frost) {
      const sFrost = ((frost.springFrostDayOfYear + 183 - 1) % 365) + 1;
      const fFrost = ((frost.fallFrostDayOfYear + 183 - 1) % 365) + 1;
      const inWinter = doy >= fFrost && doy <= sFrost;
      if (inWinter) return _makeSeasonInfo("winter", y);
    }
    if (m >= 8 && m <= 10) return _makeSeasonInfo("spring", y);
    if (m === 11) return _makeSeasonInfo("summer", y);             // Dec — start of straddling summer
    if (m >= 0 && m <= 1) return _makeSeasonInfo("summer", y - 1); // Jan/Feb — still last Dec's summer
    return _makeSeasonInfo("fall", y);
  }

  // Northern hemisphere with location — frost-aware winter, solstice-split growing season
  if (frost) {
    const sFrost = frost.springFrostDayOfYear;
    const fFrost = frost.fallFrostDayOfYear;
    if (doy <= sFrost) return _makeSeasonInfo("winter", y - 1);
    if (doy >= fFrost) return _makeSeasonInfo("winter", y);
    if (doy <= SOLSTICE_SUMMER_START) return _makeSeasonInfo("spring", y);
    if (doy <= SOLSTICE_FALL_START) return _makeSeasonInfo("summer", y);
    return _makeSeasonInfo("fall", y);
  }

  // No location — meteorological winter (Dec/Jan/Feb), solstices for the rest
  if (m === 11) return _makeSeasonInfo("winter", y);
  if (m >= 0 && m <= 1) return _makeSeasonInfo("winter", y - 1);
  if (doy <= SOLSTICE_SUMMER_START) return _makeSeasonInfo("spring", y);
  if (doy <= SOLSTICE_FALL_START) return _makeSeasonInfo("summer", y);
  return _makeSeasonInfo("fall", y);
};

// Season info for today. Used by HomePage's current+previous-season filter.
const getCurrentSeasonInfo = (data) => {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return getSeasonInfo(iso, data);
};

// Season info for the season immediately before the given one. Spring Y's
// predecessor is Winter (Y-1)/Y; summer→spring; fall→summer; winter→fall (same year).
const getPreviousSeasonInfo = (info) => {
  if (!info) return null;
  const { type, startYear } = info;
  if (type === "spring") return _makeSeasonInfo("winter", startYear - 1);
  if (type === "summer") return _makeSeasonInfo("spring", startYear);
  if (type === "fall")   return _makeSeasonInfo("summer", startYear);
  return _makeSeasonInfo("fall", startYear); // winter → fall (same start year)
};

// formatWeatherI18n — localized version of formatWeather. Renders the daily
// weather summary using the user's preferred temperature unit. Falls back to
// the original formatWeather for the precipitation/summary text.
function formatWeatherI18n(weather) {
  if (!weather) return "";
  const high = weather.highF != null ? fmtTemp(weather.highF) : null;
  const low = weather.lowF != null ? fmtTemp(weather.lowF) : null;
  const summary = weather.summary || "";
  const precip = weather.precipIn != null && weather.precipIn > 0 ? `${weather.precipIn.toFixed(2)}"` : "";
  const parts = [];
  if (high && low) parts.push(`${high}/${low}`);
  else if (high) parts.push(high);
  else if (low) parts.push(low);
  if (summary) parts.push(summary);
  if (precip) parts.push(precip);
  return parts.join(" · ");
}

// Dark palette used in Spouse Mode
const paletteDark = {
  bg: "#1A1A2E",
  bgAlt: "#16213E",
  ink: "#E0E0E0",
  inkSoft: "#A0A0B0",
  accent: "#E94560",
  accentSoft: "#FF6B8A",
  leaf: "#4CAF7D",
  leafSoft: "#80E0A0",
  yolk: "#FFD700",
  yolkSoft: "#FFE87C",
  feather: "#9B89C4",
  featherSoft: "#C4B5E8",
  line: "#FFFFFF18",
  card: "#0F3460",
};

// ============ STYLED PRIMITIVES ============
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

function Tile({ icon: Icon, label, sub, onClick, color = palette.ink, bg = palette.card, big = false }) {
  return (
    <button
      onClick={onClick}
      className="tile"
      style={{
        background: bg,
        border: `1.5px solid ${palette.line}`,
        borderRadius: 14,
        padding: big ? "20px 14px" : "16px 12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: "pointer",
        fontFamily: FONT_BODY,
        color: palette.ink,
        boxShadow: "2px 3px 0 " + palette.line,
        transition: "transform 0.1s ease, box-shadow 0.1s ease",
        minHeight: big ? 110 : 90,
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "translate(2px, 3px)";
        e.currentTarget.style.boxShadow = "0 0 0 " + palette.line;
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "2px 3px 0 " + palette.line;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "2px 3px 0 " + palette.line;
      }}
    >
      <Icon size={big ? 30 : 24} color={color} strokeWidth={1.5} />
      <div style={{ fontSize: big ? 15 : 13, fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: palette.inkSoft, textAlign: "center" }}>{sub}</div>}
    </button>
  );
}

// Custom barn icon — lucide doesn't ship one, so this is hand-drawn to match
// lucide's stroke-based aesthetic (1.5 stroke, rounded caps, no fills).
function BarnIcon({ size = 22, color = "currentColor" }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Barn outline: pentagon shape with peaked roof */}
      <path d="M3 11 L12 4 L21 11 L21 20 L3 20 Z" />
      {/* Roof line accent */}
      <path d="M3 11 L21 11" />
      {/* Door */}
      <path d="M9 20 L9 14 L15 14 L15 20" />
      {/* Tiny X detail on doors (classic barn) */}
      <path d="M9 14 L15 17" />
      <path d="M15 14 L9 17" />
    </svg>
  );
}

function StatCard({ label, value, sub, accent = palette.accent }) {
  return (
    <div style={{
      background: palette.card,
      border: `1.5px solid ${palette.line}`,
      borderRadius: 12,
      padding: 14,
      flex: "1 1 140px",   // grow + shrink, but never narrower than 140px
      minWidth: 140,
      boxSizing: "border-box",
      overflow: "hidden",  // belt-and-suspenders: prevent any text overflow
      wordBreak: "break-word",
    }}>
      <div style={{
        fontSize: 10, fontFamily: FONT_BODY, color: palette.inkSoft,
        textTransform: "uppercase", letterSpacing: 1, marginBottom: 6,
        whiteSpace: "normal", wordBreak: "break-word",
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 22, fontFamily: FONT_DISPLAY, color: accent, lineHeight: 1.1,
        whiteSpace: "normal", wordBreak: "break-word",
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontSize: 11, color: palette.inkSoft, marginTop: 4, fontFamily: FONT_BODY,
          whiteSpace: "normal", wordBreak: "break-word",
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(44,24,16,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: palette.bg, borderRadius: 16, maxWidth: 460, width: "100%",
          maxHeight: "90vh", overflow: "auto",
          border: `2px solid ${palette.ink}`,
          boxShadow: "6px 8px 0 " + palette.line,
        }}
      >
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: `1.5px solid ${palette.line}`,
        }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.ink }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: palette.ink, padding: 4 }}>
            <X size={22} />
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14, fontFamily: FONT_BODY }}>
      <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>
        {label}
      </div>
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1.5px solid ${palette.line}`, background: palette.card,
  fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
};

function Btn({ children, onClick, variant = "primary", style = {}, type = "button", small = false, disabled = false }) {
  const styles = {
    primary: { background: palette.ink, color: palette.bg, border: `1.5px solid ${palette.ink}` },
    danger: { background: palette.accent, color: palette.bg, border: `1.5px solid ${palette.accent}` },
    ghost: { background: "transparent", color: palette.ink, border: `1.5px solid ${palette.line}` },
    accent: { background: palette.yolk, color: palette.ink, border: `1.5px solid ${palette.ink}` },
  };
  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        padding: small ? "6px 12px" : "10px 18px",
        borderRadius: 8,
        cursor: disabled ? "wait" : "pointer",
        fontFamily: FONT_BODY,
        fontWeight: 600,
        fontSize: small ? 13 : 14,
        opacity: disabled ? 0.7 : 1,
        ...styles[variant],
        boxShadow: "2px 2px 0 " + palette.line,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function NavTab({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, maxWidth: 120, padding: "8px 4px",
        background: active ? palette.yolk : "transparent",
        color: active ? palette.ink : palette.bg,
        border: "none", borderRadius: 10, cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
        fontWeight: 600, fontSize: 11,
      }}
    >
      <Icon size={20} strokeWidth={2} />
      {label}
    </button>
  );
}

// NavTipButton — distinguished "action" button inside the bottom nav.
// Same height as the surrounding NavTabs but visually distinct so it pops.
// Two visual states:
//   - outlined heart (default): user hasn't tipped this month
//   - filled red heart: user has at least one supporter row this calendar
//     month (one-time tip OR subscription payment)
// Replaces the heart icon that used to live in the top-right header —
// multiple users reported missing the support entry point up there.
function NavTipButton({ onClick, filled }) {
  return (
    <button
      onClick={onClick}
      aria-label={filled ? "Thank you for tipping" : "Tip Henalytics"}
      title={filled ? "Thanks for supporting Henalytics this month!" : "Tip Henalytics"}
      style={{
        flex: 1, maxWidth: 120, padding: "6px 4px",
        background: "transparent",
        border: "none", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
        fontWeight: 700, fontSize: 11,
        color: palette.bg,
      }}
    >
      <span style={{
        background: filled ? palette.accent : "transparent",
        color: filled ? "#FFFFFF" : palette.bg,
        width: 36, height: 36, borderRadius: 18,
        border: filled ? "none" : `2px solid ${palette.bg}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: filled ? "0 2px 6px rgba(200,75,49,0.4)" : "none",
        transition: "background 200ms ease, border 200ms ease",
      }}>
        <Heart
          size={18}
          strokeWidth={filled ? 2.5 : 2}
          fill={filled ? "#FFFFFF" : "none"}
        />
      </span>
      Tip
    </button>
  );
}

// ============ ERROR BOUNDARY ============
// Catches render errors in child components and shows a friendly fallback
// instead of a white screen. Resets when the `resetKey` prop changes
// (e.g. when the user switches pages or hobbies).
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("[Henalytics] Render error in", this.props.label || "component", error, info);
  }
  componentDidUpdate(prevProps) {
    // Reset boundary when user navigates to a different page/hobby
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 32, textAlign: "center",
          background: palette.card, border: `1.5px solid ${palette.line}`,
          borderRadius: 12, color: palette.ink, fontFamily: FONT_BODY,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🪴</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, marginBottom: 6 }}>
            Something hiccupped here
          </div>
          <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
            This page hit an unexpected error. Try switching to another tab and back, or reload the page. Your data is safe.
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: "8px 16px", borderRadius: 8,
              border: `1.5px solid ${palette.ink}`, background: palette.ink, color: palette.bg,
              fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============ ICON RESOLVER ============
const iconMap = { sprout: Sprout, egg: Egg, drumstick: Drumstick, rabbit: Bird, bee: Bird, store: Store };
const HobbyIcon = ({ name, ...props }) => {
  const I = iconMap[name] || Sprout;
  return <I {...props} />;
};

// ============ SYNC INDICATOR ============
function SyncIndicator({ status, signedIn }) {
  // Show nothing in the very common idle state for signed-out users —
  // they don't need to think about syncing.
  if (!signedIn && status === "idle") return null;

  let icon, color, label;
  if (!signedIn) {
    icon = <CloudOff size={14} />;
    color = palette.inkSoft;
    label = "Local";
  } else if (status === "saving") {
    icon = <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />;
    color = palette.feather;
    label = "Saving";
  } else if (status === "saved") {
    icon = <Cloud size={14} />;
    color = palette.leaf;
    label = "Saved";
  } else if (status === "error") {
    icon = <AlertTriangle size={14} />;
    color = palette.accent;
    label = "Error";
  } else {
    icon = <Cloud size={14} />;
    color = palette.inkSoft;
    label = "Synced";
  }
  return (
    <div
      title={signedIn ? "Synced to your cloud account" : "Saving locally to this browser"}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
        padding: "4px 8px", borderRadius: 6,
        background: palette.bgAlt, color,
        fontSize: 11, fontWeight: 600,
        minWidth: 76, boxSizing: "border-box",
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {icon}
      <span>{label}</span>
    </div>
  );
}

// ============ MAIN APP ============
export default function HomesteadApp() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState("home");
  const [activeHobby, setActiveHobby] = useState("garden");
  const [hobbyMenuOpen, setHobbyMenuOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [showTutorialPrompt, setShowTutorialPrompt] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showSupporterThanks, setShowSupporterThanks] = useState(false);
  // Milestone popup — fetched from Supabase app_config table. Lets Riley
  // celebrate growth milestones (e.g. "nearly 2,000 users") and ask for
  // optional support, all without shipping an app update. The popup fires
  // after a successful log save (positive emotional moment) once the user
  // has logged at least minLogsRequired entries and hasn't seen this
  // specific milestone yet.
  const [milestoneConfig, setMilestoneConfig] = useState(null);
  const [userCount, setUserCount] = useState(null);
  const [showMilestone, setShowMilestone] = useState(false);
  const lastEntryCountRef = React.useRef(0);
  // Whether the current user has any supporter row created in the current
  // calendar month. Drives the Tip button visual: outlined heart by default,
  // filled red heart when this is true. Refreshed when the user changes.
  const [tippedThisMonth, setTippedThisMonth] = useState(false);
  const [seasonFilter, setSeasonFilter] = useState("all"); // garden-only: season ID
  // Date-range filter for non-garden analytics. dateFilter is one of:
  // "all" | "7d" | "30d" | "60d" | "90d" | "custom". customStart/customEnd
  // are ISO date strings used only when dateFilter === "custom".
  const [dateFilter, setDateFilter] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // "owner" | "member" | null
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured); // if Supabase isn't configured, "ready" immediately
  // Password recovery flow:
  //
  // Supabase JS auto-processes the URL hash/code on client init (createClient
  // sets detectSessionInUrl: true by default). By the time our React component
  // mounts, the token is already in Supabase's internal state and the URL hash
  // has been cleared. So we CANNOT detect recovery from window.location alone.
  //
  // Instead we rely entirely on the `PASSWORD_RECOVERY` event from
  // onAuthStateChange, fired in the useEffect below. To bridge the gap where
  // an event might fire before this state is set up, we also seed the value
  // by checking for the `henalytics-auth` storage key marker that Supabase
  // populates after URL processing — but most of the time the event listener
  // catches it correctly on its own.
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState(false);

  // Show what's new popup once after Supabase data loads.
  // Triggers when (a) onboarding is complete and (b) the user's saved
  // lastSeenVersion is below CURRENT_VERSION. The ref guards against
  // re-triggering inside the same session even if `data` reloads from
  // Supabase mid-flight before the dismiss-write has synced back.
  const whatsNewShownRef = React.useRef(false);
  const whatsNewDismissedRef = React.useRef(false);
  useEffect(() => {
    if (whatsNewShownRef.current) return;
    if (whatsNewDismissedRef.current) return;
    if (!data?.onboardedAt) return;
    if ((data?.lastSeenVersion || 0) >= CURRENT_VERSION) return;
    if (passwordRecoveryPending) return;
    whatsNewShownRef.current = true;
    const timer = setTimeout(() => setShowWhatsNew(true), 1500);
    return () => clearTimeout(timer);
  }, [data?.onboardedAt, data?.lastSeenVersion, passwordRecoveryPending]);

  // ---- Native tutorial prompt (once-per-account) ----
  // Web-completed users coming over to the iOS/Android app deserve to see the
  // native-specific walkthrough (gestures, camera, etc.). The `tutorialDismissed`
  // flag tracks the web tutorial; `nativeTutorialDismissed` tracks the native
  // one. On native, we trigger the prompt once for already-onboarded users
  // whose native flag is still false. Fresh users go through the post-wizard
  // trigger below as normal — their dismiss writes to the native flag because
  // isNativeApp() is true at that moment too.
  const nativeTutorialShownRef = React.useRef(false);
  useEffect(() => {
    if (nativeTutorialShownRef.current) return;
    if (!isNativeApp()) return;
    if (!data?.onboardedAt) return;            // fresh users hit the post-wizard trigger instead
    if (data?.nativeTutorialDismissed) return; // already dismissed on this device/account
    if (passwordRecoveryPending) return;       // don't stack on top of reset flow
    nativeTutorialShownRef.current = true;
    const timer = setTimeout(() => setShowTutorialPrompt(true), 800);
    return () => clearTimeout(timer);
  }, [data?.onboardedAt, data?.nativeTutorialDismissed, passwordRecoveryPending]);

  // ---- Monthly supporter thank-you ----
  // Shows once on the 1st-3rd of each month if the user hasn't dismissed it yet
  // for this calendar month. Tracked in data.supportersDismissedMonth ("YYYY-MM").
  // 3-day window so users who don't open the app on the 1st still see it.
  // Lists out the homestead names of supporters who were active during the
  // PRIOR month, fetched from /api/list-supporters at modal-open time.
  const supporterThanksShownRef = React.useRef(false);
  useEffect(() => {
    if (supporterThanksShownRef.current) return;
    if (!data?.onboardedAt) return;
    const now = new Date();
    const dayOfMonth = now.getDate();
    if (dayOfMonth < 1 || dayOfMonth > 3) return; // only show 1st-3rd of the month
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (data?.supportersDismissedMonth === monthKey) return;
    supporterThanksShownRef.current = true;
    const timer = setTimeout(() => setShowSupporterThanks(true), 2200);
    return () => clearTimeout(timer);
  }, [data?.onboardedAt, data?.supportersDismissedMonth]);
  // ---- Milestone popup ----
  // Pulls config from Supabase app_config table (id='active_milestone') and
  // calls the get_user_count() RPC to get the live signup count. Combines
  // the two to figure out the current milestone (highest threshold ≤ count).
  //
  // The popup fires after a successful log save (positive emotional moment)
  // once the user has logged at least minLogsRequired entries AND we've
  // crossed a threshold the user hasn't already been congratulated on.
  // Tracked per-milestone in data.seenMilestones so each fires exactly once
  // forever for a given user.
  //
  // Config shape (jsonb):
  //   {
  //     enabled: true,
  //     milestones: [1500, 3000, 5000, 10000, 15000, ...],
  //     headline: "{count} homesteaders and growing",
  //     body: "...{count}...",     // {count} gets substituted with real count
  //     minLogsRequired: 3
  //   }
  //
  // Riley can change anything (add more milestones, edit copy, kill the
  // whole feature) by updating the row in Supabase. No app update needed.
  const milestoneShownRef = React.useRef(false);
  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      if (!isSupabaseConfigured) return;
      try {
        // Fetch config row and user count in parallel — both are tiny.
        const [configRes, countRes] = await Promise.all([
          supabase.from("app_config").select("value").eq("id", "active_milestone").maybeSingle(),
          supabase.rpc("get_user_count"),
        ]);
        if (cancelled) return;
        if (configRes.error) {
          console.warn("[milestone] config fetch failed:", configRes.error.message);
        } else if (configRes.data && configRes.data.value && typeof configRes.data.value === "object") {
          setMilestoneConfig(configRes.data.value);
        }
        if (countRes.error) {
          console.warn("[milestone] user count fetch failed:", countRes.error.message);
        } else if (typeof countRes.data === "number") {
          setUserCount(countRes.data);
        }
      } catch (e) {
        if (!cancelled) console.warn("[milestone] fetch threw:", e);
      }
    };
    fetchAll();
    return () => { cancelled = true; };
  }, []);
  // ---- Tipped this month ----
  // Drives the Tip button visual. Queries supporters table for any record
  // this user has created in the current calendar month. Re-runs when user
  // changes. Falls back to data.userHasTipped if DB query fails so degraded
  // conditions don't lose the supporter feedback.
  useEffect(() => {
    let cancelled = false;
    const checkTipped = async () => {
      if (!user || !isSupabaseConfigured) {
        if (!cancelled) setTippedThisMonth(!!data?.userHasTipped);
        return;
      }
      try {
        const now = new Date();
        const monthStartISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { data: rows, error } = await supabase
          .from("supporters")
          .select("id, created_at")
          .eq("user_id", user.id)
          .gte("created_at", monthStartISO)
          .limit(1);
        if (cancelled) return;
        if (error) {
          console.warn("[tip-status] supporters query failed:", error.message);
          setTippedThisMonth(!!data?.userHasTipped);
          return;
        }
        setTippedThisMonth(Array.isArray(rows) && rows.length > 0);
      } catch (e) {
        if (!cancelled) {
          console.warn("[tip-status] query threw:", e);
          setTippedThisMonth(!!data?.userHasTipped);
        }
      }
    };
    checkTipped();
    return () => { cancelled = true; };
  }, [user, data?.userHasTipped]);


  // Compute the current milestone — the highest threshold in the config
  // that's ≤ the live user count. Memoized so the trigger effect below
  // doesn't recompute it on every render.
  const currentMilestone = React.useMemo(() => {
    if (!milestoneConfig || !milestoneConfig.enabled) return null;
    const list = Array.isArray(milestoneConfig.milestones) ? milestoneConfig.milestones : [];
    if (list.length === 0) return null;
    if (typeof userCount !== "number") return null;
    // Find the highest threshold the count has crossed.
    const eligible = list.filter(t => typeof t === "number" && userCount >= t);
    if (eligible.length === 0) return null;
    return Math.max(...eligible);
  }, [milestoneConfig, userCount]);

  // Trigger: watch total entry count. Fires when count INCREASES (a new log
  // saved) AND all gating conditions are met. The ref guards against
  // firing multiple times in one session even if state re-cycles.
  useEffect(() => {
    if (!data?.entries) return;
    const totalEntries = Object.values(data.entries).reduce(
      (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
      0
    );
    // First pass: just record the baseline count, don't trigger. This way
    // we don't fire immediately on app load — only on subsequent increases.
    if (lastEntryCountRef.current === 0 && totalEntries > 0) {
      lastEntryCountRef.current = totalEntries;
      return;
    }
    const didIncrease = totalEntries > lastEntryCountRef.current;
    lastEntryCountRef.current = totalEntries;
    if (!didIncrease) return;
    if (milestoneShownRef.current) return;
    if (!milestoneConfig || !milestoneConfig.enabled) return;
    if (currentMilestone == null) return;
    const minLogs = Number(milestoneConfig.minLogsRequired) || 0;
    if (totalEntries < minLogs) return;
    const milestoneKey = `milestone_${currentMilestone}`;
    const seen = Array.isArray(data.seenMilestones) ? data.seenMilestones : [];
    if (seen.includes(milestoneKey)) return;
    milestoneShownRef.current = true;
    // Small delay so the modal lands after the log toast/animation settles.
    const timer = setTimeout(() => setShowMilestone(true), 1200);
    return () => clearTimeout(timer);
  }, [data?.entries, data?.seenMilestones, milestoneConfig, currentMilestone]);

  // ---- Sync user units (currency, temperature, hemisphere) to the module-level
  // formatters whenever data.units or homestead location changes. fmtMoney() and
  // fmtTemp() are called from many components and read these globals.
  useEffect(() => {
    setUserUnits(data?.units, data?.homesteadLocation);
  }, [data?.units?.currency, data?.units?.temperature, data?.units?.hemisphere, data?.homesteadLocation?.lat]);

  // ---- Default active hobby to user's first visible hobby on first load ----
  // The activeHobby state starts as "garden", but the user might have
  // reordered their hobbies so garden is no longer first (or might have
  // hidden it). On the first render where we have data, snap activeHobby to
  // the first visible hobby in the user's preferred order. We use a ref so
  // this runs exactly once per data load — after that, the user is in
  // control of their selection.
  const initialActiveHobbySetRef = useRef(false);
  useEffect(() => {
    if (!data?.hobbies) return;
    if (initialActiveHobbySetRef.current) return;
    initialActiveHobbySetRef.current = true;
    const firstVisible = data.hobbies.find(h => !h.hidden);
    if (firstVisible && firstVisible.id !== activeHobby) {
      setActiveHobby(firstVisible.id);
    }
  }, [data?.hobbies]);

  // ---- Auto-redirect when the active hobby becomes hidden ----
  // If the user hides their currently-active hobby in Settings, we need to
  // switch them to a visible hobby; otherwise the home/stats pages keep
  // rendering the now-hidden hobby (since activeHobby still points to it).
  useEffect(() => {
    if (!data?.hobbies) return;
    const current = data.hobbies.find(h => h.id === activeHobby);
    // If the active hobby exists and is visible, no action needed
    if (current && !current.hidden) return;
    // Otherwise: pick the first visible hobby, falling back to garden
    const firstVisible = data.hobbies.find(h => !h.hidden);
    const newActive = firstVisible ? firstVisible.id : "garden";
    if (newActive !== activeHobby) {
      setActiveHobby(newActive);
      // Also normalize the page: if we're on a hobby-specific page (e.g. "pigs"),
      // bounce to "home" so we don't stay on a page tied to the hidden hobby.
      const hobbyPages = ["rabbits", "bees", "incubator", "goats", "cows", "pigs", "sheep", "horses", "sourdough", "farmstand", "baking", "canning", "freeze_drying", "dehydrating", "fermentation", "dogs", "cats", "maple_syrup"];
      if (hobbyPages.includes(page)) {
        const newHobbyType = (firstVisible || {}).type;
        if (hobbyPages.includes(newHobbyType)) {
          setPage(newHobbyType);
        } else {
          setPage("home");
        }
      }
    }
  }, [data?.hobbies, activeHobby, page]);

  // ---- Auto-commit stale egg baskets ----
  // The egg counter (FlockBasket) lets users tap +/− to build up a count
  // before tapping "Done" to write an eggs_laid entry. The count itself is
  // persisted to flock.eggBasket so it survives backgrounding/reload — but
  // if the user never taps Done, the basket sits there with a stale date
  // and analytics never see those eggs.
  //
  // Fix: on every render (and once per minute via the date watcher below),
  // scan all flocks; any basket whose date is BEFORE today gets auto-committed
  // as an entry on its own date, then cleared. This covers:
  //   - User collected last night, never tapped Done → commit on yesterday
  //   - User collected yesterday afternoon, app reopened today → commit yesterday
  //   - Multiple days missed → commit on the basket's original date
  useEffect(() => {
    if (!data?.hobbies) return;
    const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
    let needsCommit = false;
    for (const h of data.hobbies) {
      if (h.type !== "egg_layers") continue;
      for (const fl of (h.flocks || [])) {
        if (fl.eggBasket && fl.eggBasket.date && fl.eggBasket.date < today && fl.eggBasket.count > 0) {
          needsCommit = true;
          break;
        }
      }
      if (needsCommit) break;
    }
    if (!needsCommit) return;
    update(d => {
      for (const h of (d.hobbies || [])) {
        if (h.type !== "egg_layers") continue;
        for (const fl of (h.flocks || [])) {
          if (fl.eggBasket && fl.eggBasket.date && fl.eggBasket.date < today && fl.eggBasket.count > 0) {
            d.entries[h.id] = d.entries[h.id] || [];
            d.entries[h.id].push({
              id: Math.random().toString(36).slice(2, 10),
              date: fl.eggBasket.date,
              action: "eggs_laid",
              count: fl.eggBasket.count,
              flockId: fl.id,
              birdType: fl.birdType,
              autoCommitted: true, // marker so we can debug / show in UI later if needed
              created: Date.now(),
            });
            fl.eggBasket = null;
          }
        }
      }
      return d;
    });
    // Re-run when hobbies change (covers basket updates) or activeHobby changes
    // (covers user-driven navigation that might have created a stale basket).
  }, [data?.hobbies, activeHobby]);

  // ---- Midnight ticker: re-run the stale-basket scan when the date rolls over ----
  // The effect above only runs on data/hobby changes. If a user leaves the app
  // open across midnight without any state changes, their basket would stay
  // stale until something else triggers a re-render. This ticker forces a
  // re-render once per minute so the date check above fires soon after midnight.
  const [_dateTick, setDateTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDateTick(t => t + 1), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  // Note: _dateTick is intentionally unused as a value — its purpose is to
  // bump the render cycle so the auto-commit effect re-evaluates against
  // the current date. Including it in the effect's deps would be redundant
  // since data.hobbies hasn't changed; this comment exists so we don't
  // "fix" it later by adding it to deps and breaking the intent.

  const [syncStatus, setSyncStatus] = useState("idle");
  const [signedOutRemotely, setSignedOutRemotely] = useState(false); // idle | saving | saved | error
  const [pendingInviteCode, setPendingInviteCode] = useState(null);
  const [timeOfDayAccent, setTimeOfDayAccent] = useState(() => getTimeOfDayAccent());

  // ---- Refresh the time-of-day accent every 10 minutes so it shifts naturally ----
  useEffect(() => {
    const id = setInterval(() => setTimeOfDayAccent(getTimeOfDayAccent()), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Apply the accent to the palette by mutating the in-memory object.
  // This is safe: palette is a const reference but its properties are mutable,
  // and React re-renders on every state change so all components see the new value.
  palette.yolk = timeOfDayAccent;

  // ---- Detect ?invite=CODE in the URL on first load ----
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("invite");
    if (code) {
      setPendingInviteCode(code);
      // Clean the URL so a refresh doesn't re-trigger
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // ---- Detect ?supported=<tier> in the URL after Stripe return ----
  //
  // Stripe's checkout success_url is configured to return the user to
  //   https://henalytics.com/?supported=<tier>&session_id=<sid>
  // We watch for that param, wait until the user is authenticated, then
  // open the supporter-name prompt. We give the webhook a few seconds of
  // head-start (the webhook creates the supporters row that the modal will
  // update) — if the row isn't there yet, the modal shows a "still
  // processing" message and the user can retry.
  //
  // The supportedReturnHandled ref prevents re-firing if the user refreshes
  // before we've stripped the URL. We also use sessionStorage so multiple
  // useEffect-mount cycles (StrictMode in dev) don't double-open the modal.
  const supportedReturnHandledRef = useRef(false);
  const supportedReturnTimerRef = useRef(null);
  useEffect(() => {
    if (supportedReturnHandledRef.current) return;
    if (!user) return; // wait until auth resolves
    const params = new URLSearchParams(window.location.search);
    const tier = params.get("supported");
    if (!tier) return;
    // Don't re-open if we've already handled this session
    const sessionMarker = "henalytics-supported-handled";
    if (sessionStorage.getItem(sessionMarker)) return;
    sessionStorage.setItem(sessionMarker, "1");
    supportedReturnHandledRef.current = true;

    // Clean the URL so a refresh doesn't re-trigger
    const url = new URL(window.location.href);
    url.searchParams.delete("supported");
    url.searchParams.delete("session_id");
    window.history.replaceState({}, "", url.toString());

    // Brief delay gives Stripe's webhook a chance to land. ~2.5s is enough
    // for Stripe → Vercel → Supabase round-trip in the common case.
    //
    // We deliberately do NOT return a cleanup that clears this timer.
    // Other state changes (data load, supabase auth ticks) cause this
    // component to re-render and this effect to re-run, which would
    // cancel a freshly-scheduled timer mid-flight. Once we've committed
    // to opening the modal, let it happen.
    supportedReturnTimerRef.current = setTimeout(() => {
      setModal({ type: "supporterName" });
    }, 2500);
  }, [user]);

  // ---- IAP success listener (native iOS/Android) ----
  //
  // The IAP path doesn't have a ?supported=<tier> URL round-trip (Apple's
  // purchase sheet is in-app), so after a successful IAP, `startCheckout`
  // dispatches a `henalytics-iap-success` CustomEvent. We watch for it,
  // wait a beat for the RevenueCat webhook to land (which writes the
  // supporters row), then open the supporter-name prompt.
  //
  // We don't bother with URL cleanup here since IAP doesn't change the URL.
  useEffect(() => {
    if (!user) return;
    const onIapSuccess = (e) => {
      const tier = e?.detail?.tier;
      if (!tier) return;
      // Brief delay gives RevenueCat's webhook a chance to land. RC webhooks
      // typically arrive within 1-2s of purchase confirmation; 2.5s matches
      // our Stripe-path delay for consistency.
      const marker = `henalytics-iap-handled-${tier}-${Date.now()}`;
      try { sessionStorage.setItem(marker, "1"); } catch (_) {}
      setTimeout(() => {
        setModal({ type: "supporterName" });
      }, 2500);
    };
    window.addEventListener("henalytics-iap-success", onIapSuccess);
    return () => window.removeEventListener("henalytics-iap-success", onIapSuccess);
  }, [user]);

  // Refs let us detect transitions like "user just signed in"
  const prevUserRef = useRef(null);
  const saveTimerRef = useRef(null);
  const skipNextSaveRef = useRef(false);
  const cloudLoadedRef = useRef(!isSupabaseConfigured); // true once cloud data is confirmed loaded // used when we set state from cloud load — don't re-save it

  // ---- Auth state listener ----
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") setSignedOutRemotely(true);
      if (event === "SIGNED_IN") setSignedOutRemotely(false);
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecoveryPending(true);
        setModal({ type: "setNewPassword" });
      }
      if (event === "USER_UPDATED") {
        setPasswordRecoveryPending(false);
        try { sessionStorage.removeItem("henalytics-recovery-cleaned"); } catch (_) {}
      }
      setUser(session?.user || null);
      setAuthReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // ---- IAP init / identify hook ----
  // No-op on web. On native, initializes RevenueCat and tells it which
  // Supabase user owns this device. On sign-out (user → null) we also call
  // identifyIapUser so RC logs out the current user. IapManager handles
  // dedupe so this is safe to fire on every auth state change.
  //
  // This hook is harmless if IAP is disabled (the IapManager module no-ops
  // when not on native, and the inner init only runs the actual SDK config
  // when the IAP feature flag is off it still tracks user identity for
  // when the flag eventually flips on).
  useEffect(() => {
    if (user?.id) {
      initIap(user.id);
      identifyIapUser(user.id);
    } else {
      initIap(null);
    }
  }, [user?.id]);

  // ---- Keep the setNewPassword modal sticky while recovery is pending ----
  // If anything else clears `modal` (an invite flow, a stray close), re-open it.
  // Cleared only when the user successfully updates their password and AuthModal
  // closes itself — at which point setNewPassword modal closes, and the effect
  // below detects modal=null + still-pending and re-opens. So we ALSO clear the
  // flag here on the close path: AuthModal closes via onClose -> setModal(null),
  // and updateUser fires another auth state change (USER_UPDATED) which we
  // handle below.
  useEffect(() => {
    if (passwordRecoveryPending && modal && modal.type !== "setNewPassword") {
      setModal({ type: "setNewPassword" });
    }
  }, [passwordRecoveryPending, modal]);

  // ---- Native deep-link handler ----
  // Listens for henalytics:// URLs delivered to the app (e.g. password reset
  // emails). On web this is a no-op — the recovery flow comes through the URL
  // hash on first load instead. On native, Supabase's reset email targets a
  // henalytics://reset?type=recovery&token=... URL which the OS hands to us.
  useNativeDeepLinks(React.useCallback((url) => {
    try {
      const u = new URL(url);
      // Supabase stuffs the recovery token in the URL hash (?type=recovery&...
      // is also possible depending on email-template config). Check both.
      if (/type=recovery/.test(u.hash) || /type=recovery/.test(u.search)) {
        setPasswordRecoveryPending(true);
        setModal({ type: "setNewPassword" });
      }
    } catch (_) { /* malformed URL — ignore */ }
  }, []));

  // ---- Native keyboard inset tracking ----
  useNativeKeyboardInset();

  // ---- Android hardware back button ----
  // Priority order, most-specific first:
  //   1. Overlays (modal, drawer, tutorial, what's new, supporter thanks) — dismiss
  //   2. Sub-pages — return to home
  //   3. Fall through — Capacitor exits the app (Android default)
  // On iOS and web this hook is a no-op (no hardware back button).
  useNativeBackButton(React.useCallback(() => {
    if (modal) { setModal(null); return true; }
    if (hobbyMenuOpen) { setHobbyMenuOpen(false); return true; }
    if (showTutorial) { setShowTutorial(false); return true; }
    if (showTutorialPrompt) { setShowTutorialPrompt(false); return true; }
    if (showWhatsNew) { setShowWhatsNew(false); return true; }
    if (showSupporterThanks) { setShowSupporterThanks(false); return true; }
    if (page !== "home") { setPage("home"); return true; }
    return false;
  }, [modal, hobbyMenuOpen, showTutorial, showTutorialPrompt, showWhatsNew, showSupporterThanks, page]));

  // ---- If there's a pending invite and the user isn't signed in, prompt them to ----
  useEffect(() => {
    if (!authReady) return;
    if (pendingInviteCode && !user && !modal) {
      setModal({ type: "inviteSignIn" });
    }
  }, [pendingInviteCode, user, authReady]);

  // ---- Once the user signs in WITH a pending invite, accept it ----
  const inviteHandledRef = useRef(false);
  useEffect(() => {
    if (!user || !pendingInviteCode || inviteHandledRef.current) return;
    inviteHandledRef.current = true;
    (async () => {
      try {
        await acceptInvite(user, pendingInviteCode);
        // Force a fresh load now that membership has changed
        const result = await loadHomestead(user);
        skipNextSaveRef.current = true;
        setData(migrateData(result.data || {}));
        setRole(result.role || "member");
        setPendingInviteCode(null);
        setModal({ type: "inviteAccepted" });
      } catch (e) {
        setPendingInviteCode(null);
        setModal({ type: "inviteError", message: e.message || String(e) });
      }
    })();
  }, [user, pendingInviteCode]);

  // ---- Load data once auth state is known ----
  // Re-runs whenever the user changes (sign in / sign out)
  useEffect(() => {
    if (!authReady) return;

    let cancelled = false;
    (async () => {
      const result = await loadHomestead(user);
      if (cancelled) return;

      // Track the user's role on the active homestead (used by FarmhandModal)
      setRole(result.role || null);

      const prevUser = prevUserRef.current;

      // Case 1: User just signed in (was null, now an object)
      if (user && !prevUser) {
        if (result.source === "cloud" && result.data) {
          // Existing account — pull cloud data down.
          skipNextSaveRef.current = true;
          setData(migrateData(result.data));
        } else if (result.source === "cloud-empty") {
          // No cloud data yet. If they have local data, use it as a starting
          // point. The next user interaction will save it to cloud naturally.
          const localData = readLocalHomestead();
          skipNextSaveRef.current = true;
          setData(migrateData(localData || {}));
        } else {
          // Local fallback (cloud unreachable)
          skipNextSaveRef.current = true;
          setData(result.data ? migrateData(result.data) : defaultData());
        }
      }
      // Case 2: User just signed out (was object, now null)
      else if (!user && prevUser) {
        // Load from local backup. Cloud data isn't accessible without auth.
        skipNextSaveRef.current = true;
        setData(result.data ? migrateData(result.data) : defaultData());
      }
      // Case 3: Initial load (no user transition)
      else {
        skipNextSaveRef.current = true;
        setData(result.data ? migrateData(result.data) : defaultData());
      }

      cloudLoadedRef.current = true;
      prevUserRef.current = user;
    })();
    return () => { cancelled = true; };
  }, [user, authReady]);

  // ---- Save with debouncing whenever data changes ----
  // We don't save on every keystroke — wait 500ms after the last change to coalesce edits.
  // EXCEPT when saveImmediateRef is true, which is a one-shot bypass set by
  // critical actions (e.g. batch finalize) that need to persist NOW because
  // the user is likely to close the app right after.
  useEffect(() => {
    if (!data) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSyncStatus("saving");
    const immediate = saveImmediateRef.current;
    saveImmediateRef.current = false; // one-shot
    const fire = async () => {
      const result = await saveHomestead(user, data);
      console.log("[SAVE] result:", result, "user:", user ? user.email || user.id : "null");
      setSyncStatus((result.ok || result.skipped) ? "saved" : "error");
      if (result.ok) {
        setTimeout(() => setSyncStatus((s) => (s === "saved" ? "idle" : s)), 1500);
      }
    };
    if (immediate) {
      // Fire-and-forget but kicked off synchronously now, not 500ms from now.
      // This is the same "no await" pattern as the visibilitychange flush —
      // we can't reliably await on iOS during a backgrounding event.
      fire();
    } else {
      saveTimerRef.current = setTimeout(fire, 500);
    }
    return () => clearTimeout(saveTimerRef.current);
  }, [data, user]);

  // ---- Save-on-background flush ----
  // The 500ms debounce above means recently-edited data can be lost if the
  // user backgrounds the app inside that window. Classic example: tap
  // "Finalize batch" on a meat-bird batch, immediately swipe up to close
  // the app — the debounce hasn't fired so the cloud save never happened,
  // and on next open the batch shows un-finalized.
  //
  // Fix: when the browser/WebView tells us the app is being hidden or torn
  // down, force-fire the pending save synchronously. visibilitychange covers
  // the "swipe up" / "switch app" cases on iOS+Android+desktop; pagehide
  // covers the rarer "tab being unloaded" case on web; beforeunload covers
  // the desktop "close window" case. All three call into the same flush.
  //
  // We use a ref to the latest data so the listener (attached once on mount)
  // always sees the current snapshot, not the snapshot from when it was wired.
  const latestDataRef = useRef(data);
  const latestUserRef = useRef(user);
  useEffect(() => { latestDataRef.current = data; }, [data]);
  useEffect(() => { latestUserRef.current = user; }, [user]);

  useEffect(() => {
    const flush = () => {
      // Cancel the pending debounce and fire immediately. We don't await
      // here because visibilitychange handlers can't reliably await on iOS
      // — the WebView may freeze before the promise resolves. saveHomestead
      // is fire-and-forget; the cloud write will complete in the background
      // (or, worst case, the local-storage write inside saveHomestead has
      // already persisted synchronously before the WebView freezes).
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const d = latestDataRef.current;
      const u = latestUserRef.current;
      if (!d) return;
      // Skip if we're in the "just loaded from cloud, don't save back" window.
      // The debounced effect resets skipNextSaveRef itself on its first run;
      // we honor the same flag here so a load-triggered flush doesn't echo.
      if (skipNextSaveRef.current) return;
      try {
        saveHomestead(u, d);
      } catch (_) { /* best-effort — nothing we can do if it throws */ }
    };
    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, []);

  // Ref-based one-shot bypass for the debounce. When set to true, the next
  // data-change cycle saves immediately instead of waiting the 500ms debounce.
  // Used by critical actions (e.g. batch finalize) where the user may close
  // the app right after clicking — debounce isn't safe there.
  const saveImmediateRef = useRef(false);

  const update = (mutator, opts) => {
    if (opts && opts.immediate) saveImmediateRef.current = true;
    setData((prev) => mutator(JSON.parse(JSON.stringify(prev))));
  };

  if (!authReady || !data) {
    return null;
  }

  // ---- ONBOARDING ----
  // Show the setup wizard if this is a fresh user (no entries logged AND no
  // onboardedAt timestamp). Existing users with data are auto-marked as onboarded
  // so we never show them the wizard.
  const hasAnyEntries = Object.values(data.entries || {}).some(
    (arr) => Array.isArray(arr) && arr.length > 0
  );
  const hasNotOnboarded = !data.onboardedAt;
  const shouldShowWizard = hasNotOnboarded && !hasAnyEntries && !modal && role !== "member";
  // Note: we render the wizard inline below — only ONE wizard shows at a time,
  // and it blocks until completed/skipped.

  // Push 7b — rabbits is now a first-class hobby; the prior rabbits→garden
  // fallback (when navigating away from the rabbit page) is obsolete and
  // also caused a crash in ModalRouter where `page` wasn't in scope.
  const hobby = data.hobbies.find((h) => h.id === activeHobby);
  const entries = data.entries[activeHobby] || [];

  // Swap palette when spouse mode is on
  const sp = data.spouseMode ? paletteDark : palette;

  return (
    <div style={{
      minHeight: "100vh",
      background: sp.bg,
      backgroundImage: `radial-gradient(${sp.line} 0.5px, transparent 0.5px)`,
      backgroundSize: "20px 20px",
      fontFamily: FONT_BODY,
      color: sp.ink,
      paddingBottom: 100,
      paddingTop: signedOutRemotely ? "calc(env(safe-area-inset-top) + 56px)" : "env(safe-area-inset-top)",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap');
        /* Lock horizontal scrolling — modal/overlay widths can briefly exceed
           viewport on first render (e.g. before flex layout settles) and would
           otherwise create a phantom sideways scroll. Belt-and-suspenders on
           html and body. */
        html, body { margin: 0; overflow-x: hidden; max-width: 100vw; }
        input, select, textarea { font-family: ${FONT_BODY}; }
        input:focus, select:focus, textarea:focus { outline: 2px solid ${palette.accent}; outline-offset: -1px; }
        button { font-family: ${FONT_BODY}; }
        .tile:hover { background: ${palette.bgAlt} !important; }
        /* Suppress iOS Safari/WKWebView blue tap-flash on interactive elements */
        * { -webkit-tap-highlight-color: transparent; }
        /* Soft-keyboard handling: --keyboard-height is set by useNativeKeyboardInset.
           When the keyboard is open, fixed-position modal overlays get a bottom
           padding equal to the keyboard height so centered content shifts up
           enough to keep the focused input visible. */
        :root { --keyboard-height: 0px; }
        /* Modal overlays: any fixed-position element with flex centering.
           Uses align-items as the anchor since every modal overlay in this
           app structures itself that way. Targets both common spacings React
           may use when serializing inline styles.
           The :not([data-no-keyboard-shift]) exclusion prevents the rule from
           accidentally hijacking elements that LOOK like modals to the
           selector but aren't (signed-out banner, toast host, onboarding
           wizard backdrop) — those get visually wrecked when the keyboard
           inset is forced onto them. */
        body.keyboard-open div[style*="position: fixed"][style*="align-items: center"]:not([data-no-keyboard-shift]) {
          padding-bottom: var(--keyboard-height) !important;
          box-sizing: border-box;
          transition: padding-bottom 0.2s ease;
        }
      `}</style>

      {signedOutRemotely && (
        <div
          data-no-keyboard-shift
          onClick={() => setModal({ type: "auth" })}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
            background: "#C84B31", color: "#FAF5EA",
            padding: "12px 20px",
            paddingTop: "calc(12px + env(safe-area-inset-top))",
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 10, cursor: "pointer",
            fontFamily: "'Be Vietnam Pro', sans-serif",
            fontWeight: 600, fontSize: 14,
          }}
        >
          ⚠️ You were signed out on this device — tap to sign back in
        </div>
      )}
      {/* Seasonal ambient decorations (spring flowers, fall leaves, winter snow) */}
      <SeasonalDecorations />

      {/* Toast host — listens for window "henalytics-toast" events */}
      <ToastHost />

      {/* Onboarding wizard: shown only on first-ever load with no data */}
      {shouldShowWizard && (
        <OnboardingWizard
          update={update}
          onClose={() => {
            update((d) => {
              d.onboardedAt = Date.now();
              // Brand-new users start fresh — mark What's New and the
              // monthly supporter thanks as already-seen so they don't
              // get hit with extra popups right after the wizard + tutorial.
              // They'll start seeing popups normally on the next release /
              // next month.
              d.lastSeenVersion = CURRENT_VERSION;
              const now = new Date();
              const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
              d.supportersDismissedMonth = monthKey;
              d.appStoreFundDismissedMonth = monthKey;
              return d;
            });
            // Show tutorial prompt after a short delay so wizard closes cleanly
            setTimeout(() => setShowTutorialPrompt(true), 300);
          }}
        />
      )}

      {/* What's New popup */}
      {showWhatsNew && (
        <WhatsNewModal onClose={() => {
          whatsNewDismissedRef.current = true;
          setShowWhatsNew(false);
          update(d => { d.lastSeenVersion = CURRENT_VERSION; return d; });
        }} />
      )}

      {/* Monthly supporter thank-you popup (9th-11th of each month) */}
      {showSupporterThanks && !showWhatsNew && (
        <SupporterThanksModal
          onClose={() => {
            setShowSupporterThanks(false);
            const now = new Date();
            const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            update(d => { d.supportersDismissedMonth = monthKey; return d; });
          }}
          onLeaveTip={() => {
            // User tapped a Stripe button. The href opens Stripe in a new
            // tab (the <a> tag handles that natively). We just need to
            // mark this month as dismissed and close the popup so they
            // come back to a clean app, not the popup again.
            setShowSupporterThanks(false);
            const now = new Date();
            const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            update(d => { d.supportersDismissedMonth = monthKey; return d; });
          }}
        />
      )}

      {/* App Store fundraiser popup (once per month for non-tippers) */}
      
      {/* Milestone popup — fires after a log save when the user has crossed
          a milestone threshold they haven't seen yet. Marks seen on either
          button so each milestone shows exactly once per user. Tapping
          Support opens the existing SupportModal flow. */}
      {showMilestone && !showWhatsNew && !showSupporterThanks && milestoneConfig && currentMilestone != null && (
        <MilestoneModal
          config={milestoneConfig}
          userCount={userCount}
          milestone={currentMilestone}
          onClose={() => {
            setShowMilestone(false);
            const key = `milestone_${currentMilestone}`;
            update(d => {
              if (!Array.isArray(d.seenMilestones)) d.seenMilestones = [];
              if (!d.seenMilestones.includes(key)) d.seenMilestones.push(key);
              return d;
            });
          }}
          onOpenSupport={() => {
            setShowMilestone(false);
            const key = `milestone_${currentMilestone}`;
            update(d => {
              if (!Array.isArray(d.seenMilestones)) d.seenMilestones = [];
              if (!d.seenMilestones.includes(key)) d.seenMilestones.push(key);
              return d;
            });
            // Open the existing SupportModal — same flow as tapping the heart.
            setModal({ type: "support" });
          }}
        />
      )}

      {/* Tutorial prompt — shown once after onboarding */}
      {showTutorialPrompt && !showTutorial && (
        <TutorialPrompt
          onStart={() => { setShowTutorialPrompt(false); setShowTutorial(true); }}
          onSkip={() => {
            setShowTutorialPrompt(false);
            update((d) => {
              if (isNativeApp()) d.nativeTutorialDismissed = true;
              else d.tutorialDismissed = true;
              return d;
            });
          }}
        />
      )}

      {/* Tutorial modal */}
      {showTutorial && (
        <TutorialModal onClose={() => {
          setShowTutorial(false);
          update((d) => {
            if (isNativeApp()) d.nativeTutorialDismissed = true;
            else d.tutorialDismissed = true;
            return d;
          });
        }} />
      )}
      {/* HEADER */}
      <header style={{
        padding: "20px 20px 12px",
        borderBottom: `2px solid ${palette.ink}`,
        background: palette.bg,
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", maxWidth: 720, margin: "0 auto" }}>
          <button
            onClick={() => setModal({ type: "renameHomestead" })}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              textAlign: "left", color: palette.ink,
            }}
            title="Rename homestead"
          >
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: palette.inkSoft, marginBottom: 2 }}>
              {data.homesteadName ? "your homestead" : "tap to name your homestead"}
            </div>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, margin: 0, color: palette.ink, lineHeight: 1 }}>
              {data.homesteadName || "the homestead"}
            </h1>
          </button>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <SyncIndicator status={syncStatus} signedIn={!!user} />
            {/* Top-right Heart was here — moved to the bottom nav as a
                prominent "Tip" action button since multiple users reported
                missing the support entry point up here. */}
            <button
              onClick={() => setModal({ type: "barn" })}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: palette.ink }}
              title="Your homestead"
              aria-label="Your homestead"
            >
              <BarnIcon size={22} />
            </button>
            <button
              onClick={() => setPage("journal")}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 6,
                color: page === "journal" ? palette.accent : palette.ink,
              }}
              title="Journal"
              aria-label="Journal"
            >
              <BookOpen size={20} />
            </button>
            <button
              onClick={() => setModal({ type: "settings" })}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: palette.ink }}
              title="Settings"
              aria-label="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* HOBBY PICKER (hidden on Photos page since it shows all hobbies) */}
        {page !== "sales" && page !== "year" && page !== "calendar" && page !== "journal" && (
        <div style={{ maxWidth: 720, margin: "16px auto 0", position: "relative" }}>
          <button
            onClick={() => setHobbyMenuOpen(!hobbyMenuOpen)}
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 10,
              background: palette.card, border: `1.5px solid ${palette.ink}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer", fontSize: 16, fontWeight: 600, color: palette.ink,
              boxShadow: "2px 2px 0 " + palette.line,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <HobbyIcon name={hobby.icon} size={20} strokeWidth={1.5} />
              {/* Collapse the four preserving sub-types under one display
                  label so the dropdown matches the picker UX. The active tab
                  inside PreservingPage handles the sub-type distinction. */}
              {(hobby.type === "canning" || hobby.type === "freeze_drying" || hobby.type === "dehydrating" || hobby.type === "fermentation")
                ? "Preserving 🥫"
                : hobby.name}
            </span>
            <ChevronDown size={18} style={{ transform: hobbyMenuOpen ? "rotate(180deg)" : "", transition: "transform 0.2s" }} />
          </button>
          {hobbyMenuOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
              background: palette.card, border: `1.5px solid ${palette.ink}`,
              borderRadius: 10, zIndex: 60,
              // When all hobbies are enabled the list can extend below the
              // fixed bottom nav. Clamp to the available viewport and let
              // the list scroll internally. The 220px subtracts roughly:
              // safe-area-top + the switcher button + the bottom nav +
              // safe-area-bottom + a little breathing room.
              maxHeight: "calc(100vh - 220px - env(safe-area-inset-bottom))",
              overflowY: "auto",
              overflowX: "hidden",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              boxShadow: "3px 4px 0 " + palette.line,
            }}>
              {(() => {
                const preservingTypes = ["canning", "freeze_drying", "dehydrating", "fermentation"];
                const herbalismTypes = ["tincture", "oil_infusion", "salve", "tea"];
                const groupedTypes = [...preservingTypes, ...herbalismTypes];
                const visiblePreserving = data.hobbies.filter(h => preservingTypes.includes(h.type) && !h.hidden);
                const visibleHerbalism = data.hobbies.filter(h => herbalismTypes.includes(h.type) && !h.hidden);
                const isPreservingActive = preservingTypes.includes(activeHobby);
                const isHerbalismActive = herbalismTypes.includes(activeHobby);
                const nonGroupedVisible = data.hobbies.filter(h => !h.hidden && !groupedTypes.includes(h.type));
                return (
                  <>
                    {nonGroupedVisible.map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    setActiveHobby(h.id);
                    setSeasonFilter("all");
                    setHobbyMenuOpen(false);
                    // Set the right page for the picked hobby. Stay on
                    // analytics if user was already there. Otherwise route
                    // to the hobby's home page (or "home" for core hobbies).
                    if (page !== "analytics") {
                      const hobbyTypePages = {
                        rabbits: "rabbits",
                        bees: "bees",
                        incubator: "incubator",
                        goats: "goats",
                        cows: "cows",
                        pigs: "pigs",
                        sheep: "sheep",
                        horses: "horses",
                        sourdough: "sourdough",
                        farmstand: "farmstand",
                        baking: "baking",
                        dogs: "dogs",
                        cats: "cats",
                        maple_syrup: "maple_syrup",
                      };
                      // Garden, egg_layers, meat_chickens all share the
                      // generic "home" page (which keys off activeHobby).
                      setPage(hobbyTypePages[h.type] || "home");
                    }
                  }}
                  style={{
                    width: "100%", padding: "12px 16px", background: h.id === activeHobby ? palette.bgAlt : "transparent",
                    border: "none", borderBottom: `1px solid ${palette.line}`,
                    cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10,
                    color: palette.ink, fontWeight: 500,
                  }}
                >
                  <HobbyIcon name={h.icon} size={18} strokeWidth={1.5} />
                  {h.name}
                </button>
              ))}
                    {visiblePreserving.length > 0 && (
                      <button
                        key="preserving-group"
                        onClick={() => {
                          // Route to whichever preserving sub-type the user
                          // has enabled first (canning preferred since it's
                          // the original). PreservingPage's tab bar will then
                          // let them switch between visible sub-types.
                          const preferredOrder = ["canning", "freeze_drying", "dehydrating", "fermentation"];
                          const target = preferredOrder.find(t =>
                            visiblePreserving.some(h => h.type === t)
                          ) || visiblePreserving[0].type;
                          setActiveHobby(target);
                          setSeasonFilter("all");
                          setHobbyMenuOpen(false);
                          if (page !== "analytics") setPage(target);
                        }}
                        style={{
                          width: "100%", padding: "12px 16px",
                          background: isPreservingActive ? palette.bgAlt : "transparent",
                          border: "none", borderBottom: `1px solid ${palette.line}`,
                          cursor: "pointer", textAlign: "left",
                          display: "flex", alignItems: "center", gap: 10,
                          color: palette.ink, fontWeight: 500,
                        }}
                      >
                        <HobbyIcon name="sprout" size={18} strokeWidth={1.5} />
                        Preserving 🥫
                      </button>
                    )}
                    {visibleHerbalism.length > 0 && (
                      <button
                        key="herbalism-group"
                        onClick={() => {
                          // Route to whichever herbalism sub-type the user
                          // has enabled first. HerbalismPage's tab bar then
                          // lets them switch between visible sub-types.
                          const preferredOrder = ["tincture", "oil_infusion", "salve", "tea"];
                          const target = preferredOrder.find(t =>
                            visibleHerbalism.some(h => h.type === t)
                          ) || visibleHerbalism[0].type;
                          setActiveHobby(target);
                          setSeasonFilter("all");
                          setHobbyMenuOpen(false);
                          if (page !== "analytics") setPage(target);
                        }}
                        style={{
                          width: "100%", padding: "12px 16px",
                          background: isHerbalismActive ? palette.bgAlt : "transparent",
                          border: "none", borderBottom: `1px solid ${palette.line}`,
                          cursor: "pointer", textAlign: "left",
                          display: "flex", alignItems: "center", gap: 10,
                          color: palette.ink, fontWeight: 500,
                        }}
                      >
                        <HobbyIcon name="sprout" size={18} strokeWidth={1.5} />
                        Herbalism 🌿
                      </button>
                    )}
                  </>
                );
              })()}
              <button
                onClick={() => { setHobbyMenuOpen(false); setModal({ type: "manageHobbies" }); }}
                style={{
                  width: "100%", padding: "12px 16px", background: palette.yolkSoft,
                  border: "none", cursor: "pointer", textAlign: "left",
                  display: "flex", alignItems: "center", gap: 10, color: palette.ink, fontWeight: 600,
                }}
              >
                <Plus size={18} strokeWidth={2} /> More hobbies?
              </button>
            </div>
          )}
        </div>
        )}
      </header>

      {/* MAIN */}
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "20px 20px 40px" }}>
        <ErrorBoundary resetKey={`${page}|${activeHobby}`} label={`${page}/${activeHobby}`}>
        {page === "home" && (
          <HomePage hobby={hobby} data={data} update={update} setModal={setModal} setPage={setPage} />
        )}
        {page === "analytics" && activeHobby === "rabbits" && (
          <AnalyticsShareWrapper hobby={data.hobbies.find(h=>h.id==="rabbits")} entries={data.entries["rabbits"] || []} data={data}>
            <RabbitsAnalytics hobby={data.hobbies.find(h=>h.id==="rabbits")} entries={data.entries["rabbits"] || []} spouseMode={data.spouseMode} />
          </AnalyticsShareWrapper>
        )}
        {page === "analytics" && activeHobby === "bees" && (
          <AnalyticsShareWrapper hobby={data.hobbies.find(h=>h.id==="bees")} entries={data.entries["bees"] || []} data={data}>
            <BeesAnalytics hobby={data.hobbies.find(h=>h.id==="bees")} entries={data.entries["bees"] || []} spouseMode={data.spouseMode} />
          </AnalyticsShareWrapper>
        )}
        {page === "analytics" && activeHobby === "incubator" && (
          <AnalyticsShareWrapper hobby={data.hobbies.find(h=>h.id==="incubator")} entries={data.entries["incubator"] || []} data={data}>
            <IncubatorAnalytics hobby={data.hobbies.find(h=>h.id==="incubator")} />
          </AnalyticsShareWrapper>
        )}
        {page === "analytics" && activeHobby === "goats" && (
          <AnalyticsShareWrapper hobby={data.hobbies.find(h=>h.id==="goats")} entries={data.entries["goats"] || []} data={data}>
            <GoatsAnalytics hobby={data.hobbies.find(h=>h.id==="goats")} entries={data.entries["goats"] || []} />
          </AnalyticsShareWrapper>
        )}
        {page === "analytics" && activeHobby === "cows" && (
          <AnalyticsShareWrapper hobby={data.hobbies.find(h=>h.id==="cows")} entries={data.entries["cows"] || []} data={data}>
            <CowsAnalytics hobby={data.hobbies.find(h=>h.id==="cows")} entries={data.entries["cows"] || []} />
          </AnalyticsShareWrapper>
        )}
        {page === "analytics" && activeHobby === "pigs" && (
          <AnalyticsShareWrapper hobby={data.hobbies.find(h=>h.id==="pigs")} entries={data.entries["pigs"] || []} data={data}>
            <PigsAnalytics hobby={data.hobbies.find(h=>h.id==="pigs")} entries={data.entries["pigs"] || []} />
          </AnalyticsShareWrapper>
        )}
        {page === "analytics" && activeHobby === "sheep" && (
          <AnalyticsShareWrapper hobby={data.hobbies.find(h=>h.id==="sheep")} entries={data.entries["sheep"] || []} data={data}>
            <SheepAnalytics hobby={data.hobbies.find(h=>h.id==="sheep")} entries={data.entries["sheep"] || []} />
          </AnalyticsShareWrapper>
        )}
        {page === "analytics" && activeHobby === "dogs" && (
          <AnalyticsShareWrapper hobby={data.hobbies.find(h=>h.id==="dogs")} entries={data.entries["dogs"] || []} data={data}>
            <DogsAnalytics hobby={data.hobbies.find(h=>h.id==="dogs")} />
          </AnalyticsShareWrapper>
        )}
        {page === "analytics" && activeHobby === "cats" && (
          <AnalyticsShareWrapper hobby={data.hobbies.find(h=>h.id==="cats")} entries={data.entries["cats"] || []} data={data}>
            <CatsAnalytics hobby={data.hobbies.find(h=>h.id==="cats")} />
          </AnalyticsShareWrapper>
        )}
        {page === "analytics" && activeHobby === "maple_syrup" && (
          <AnalyticsShareWrapper hobby={data.hobbies.find(h=>h.id==="maple_syrup")} entries={data.entries["maple_syrup"] || []} data={data}>
            <MapleSyrupAnalytics hobby={data.hobbies.find(h=>h.id==="maple_syrup")} entries={data.entries["maple_syrup"] || []} />
          </AnalyticsShareWrapper>
        )}
        {page === "analytics" && activeHobby === "horses" && (
          <AnalyticsShareWrapper hobby={data.hobbies.find(h=>h.id==="horses")} entries={[]} data={data}>
            <HorsesAnalytics hobby={data.hobbies.find(h=>h.id==="horses")} sales={data.sales || []} />
          </AnalyticsShareWrapper>
        )}
        {page === "analytics" && activeHobby === "sourdough" && (
          <AnalyticsShareWrapper hobby={data.hobbies.find(h=>h.id==="sourdough")} entries={[]} data={data}>
            <SourdoughAnalytics hobby={data.hobbies.find(h=>h.id==="sourdough")} sales={data.sales || []} entries={data.entries?.["sourdough"] || []} />
          </AnalyticsShareWrapper>
        )}
        {page === "analytics" && activeHobby === "farmstand" && (
          <AnalyticsShareWrapper hobby={data.hobbies.find(h=>h.id==="farmstand")} entries={[]} data={data}>
            <FarmstandAnalytics hobby={data.hobbies.find(h=>h.id==="farmstand")} sales={data.sales || []} entries={data.entries?.["farmstand"] || []} spouseMode={data.spouseMode} />
          </AnalyticsShareWrapper>
        )}
        {page === "analytics" && activeHobby === "baking" && (
          <AnalyticsShareWrapper hobby={data.hobbies.find(h=>h.id==="baking")} entries={data.entries?.["baking"] || []} data={data}>
            <BakingAnalytics hobby={data.hobbies.find(h=>h.id==="baking")} entries={data.entries?.["baking"] || []} sales={data.sales || []} spouseMode={data.spouseMode} />
          </AnalyticsShareWrapper>
        )}
        {page === "analytics" && (activeHobby === "canning" || activeHobby === "freeze_drying" || activeHobby === "dehydrating" || activeHobby === "fermentation") && (
          <PreservingAnalyticsPage data={data} initialSubType={activeHobby} spouseMode={data.spouseMode} />
        )}
        {page === "analytics" && activeHobby !== "rabbits" && activeHobby !== "bees" && activeHobby !== "incubator" && activeHobby !== "goats" && activeHobby !== "cows" && activeHobby !== "pigs" && activeHobby !== "sheep" && activeHobby !== "horses" && activeHobby !== "sourdough" && activeHobby !== "farmstand" && activeHobby !== "baking" && activeHobby !== "canning" && activeHobby !== "freeze_drying" && activeHobby !== "dehydrating" && activeHobby !== "fermentation" && activeHobby !== "dogs" && activeHobby !== "cats" && activeHobby !== "maple_syrup" && (
          <AnalyticsPage hobby={hobby} data={data} seasonFilter={seasonFilter} setSeasonFilter={setSeasonFilter} dateFilter={dateFilter} setDateFilter={setDateFilter} customStart={customStart} setCustomStart={setCustomStart} customEnd={customEnd} setCustomEnd={setCustomEnd} spouseMode={data.spouseMode} />
        )}
        {page === "photos" && (
          <PhotoLibraryPage data={data} user={user} />
        )}
        {page === "year" && (
          <YearInReviewPage data={data} />
        )}
        {page === "bees" && (
          <BeesPage hobby={data.hobbies.find(h=>h.id==="bees")} data={data} update={update} setModal={setModal} />
        )}
        {page === "incubator" && (
          <IncubatorPage hobby={data.hobbies.find(h=>h.id==="incubator")} data={data} update={update} setModal={setModal} />
        )}
        {page === "goats" && (
          <GoatsPage hobby={data.hobbies.find(h=>h.id==="goats")} data={data} update={update} setModal={setModal} />
        )}
        {page === "cows" && (
          <CowsPage hobby={data.hobbies.find(h=>h.id==="cows")} data={data} update={update} setModal={setModal} />
        )}
        {page === "pigs" && (
          <PigsPage hobby={data.hobbies.find(h=>h.id==="pigs")} data={data} update={update} setModal={setModal} />
        )}
        {page === "rabbits" && (
          <RabbitsPage hobby={data.hobbies.find(h=>h.id==="rabbits")} data={data} update={update} setModal={setModal} />
        )}
        {page === "farmstand" && (
          <FarmstandPage hobby={data.hobbies.find(h=>h.id==="farmstand")} data={data} update={update} setModal={setModal} />
        )}
        {page === "baking" && (
          <BakingPage hobby={data.hobbies.find(h=>h.id==="baking")} data={data} update={update} setModal={setModal} />
        )}
        {page === "canning" && (
          <PreservingPage data={data} update={update} setModal={setModal} initialSubType="canning" />
        )}
        {page === "freeze_drying" && (
          <PreservingPage data={data} update={update} setModal={setModal} initialSubType="freeze_drying" />
        )}
        {page === "dehydrating" && (
          <PreservingPage data={data} update={update} setModal={setModal} initialSubType="dehydrating" />
        )}
        {page === "fermentation" && (
          <PreservingPage data={data} update={update} setModal={setModal} initialSubType="fermentation" />
        )}
        {page === "tincture" && (
          <HerbalismPage data={data} update={update} setModal={setModal} initialSubType="tincture" />
        )}
        {page === "oil_infusion" && (
          <HerbalismPage data={data} update={update} setModal={setModal} initialSubType="oil_infusion" />
        )}
        {page === "salve" && (
          <HerbalismPage data={data} update={update} setModal={setModal} initialSubType="salve" />
        )}
        {page === "tea" && (
          <HerbalismPage data={data} update={update} setModal={setModal} initialSubType="tea" />
        )}
        {page === "sheep" && (
          <SheepPage hobby={data.hobbies.find(h=>h.id==="sheep")} data={data} update={update} setModal={setModal} />
        )}
        {page === "dogs" && (
          <DogsPage hobby={data.hobbies.find(h=>h.id==="dogs")} data={data} update={update} setModal={setModal} />
        )}
        {page === "cats" && (
          <CatsPage hobby={data.hobbies.find(h=>h.id==="cats")} data={data} update={update} setModal={setModal} />
        )}
        {page === "maple_syrup" && (
          <MapleSyrupPage hobby={data.hobbies.find(h=>h.id==="maple_syrup")} data={data} update={update} />
        )}
        {page === "horses" && (
          <HorsesPage hobby={data.hobbies.find(h=>h.id==="horses")} data={data} update={update} setModal={setModal} />
        )}
        {page === "sourdough" && (
          <SourdoughPage hobby={data.hobbies.find(h=>h.id==="sourdough")} data={data} update={update} setModal={setModal} />
        )}
        {page === "calendar" && (
          <CalendarPage data={data} update={update} setModal={setModal} />
        )}
        {page === "journal" && (
          <JournalPage data={data} update={update} setModal={setModal} />
        )}
        {page === "sales" && (
          <SalesPage data={data} update={update} />
        )}
        </ErrorBoundary>
      </main>

      {/* COPYRIGHT FOOTER */}
      <div style={{
        textAlign: "center",
        padding: "12px 20px",
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        fontSize: 11,
        color: palette.inkSoft,
        fontFamily: FONT_BODY,
        lineHeight: 1.6,
        maxWidth: 720,
        margin: "0 auto",
      }}>
        © {new Date().getFullYear()} Henalytics · Built by a homesteader, for homesteaders. Not a company — just someone who wanted to better understand their chickens, garden, and land. Free forever, by intention. Unauthorized commercial use is prohibited.
      </div>
      {/* BOTTOM NAV — 5 tabs, compact layout */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: palette.ink, padding: "8px 4px", paddingBottom: "max(8px, env(safe-area-inset-bottom))",
        display: "flex", justifyContent: "center", gap: 2, zIndex: 50,
      }}>
        <NavTab active={page === "home" || page === "rabbits" || page === "bees" || page === "incubator" || page === "goats" || page === "cows" || page === "pigs" || page === "sheep" || page === "horses" || page === "sourdough" || page === "farmstand" || page === "baking" || page === "canning" || page === "freeze_drying" || page === "dehydrating" || page === "fermentation" || page === "tincture" || page === "oil_infusion" || page === "salve" || page === "tea" || page === "dogs" || page === "cats" || page === "maple_syrup"} onClick={() => { if (activeHobby === "rabbits") setPage("rabbits"); else if (activeHobby === "bees") setPage("bees"); else if (activeHobby === "incubator") setPage("incubator"); else if (activeHobby === "goats") setPage("goats"); else if (activeHobby === "cows") setPage("cows"); else if (activeHobby === "pigs") setPage("pigs"); else if (activeHobby === "sheep") setPage("sheep"); else if (activeHobby === "horses") setPage("horses"); else if (activeHobby === "sourdough") setPage("sourdough"); else if (activeHobby === "farmstand") setPage("farmstand"); else if (activeHobby === "baking") setPage("baking"); else if (activeHobby === "canning") setPage("canning"); else if (activeHobby === "freeze_drying") setPage("freeze_drying"); else if (activeHobby === "dehydrating") setPage("dehydrating"); else if (activeHobby === "fermentation") setPage("fermentation"); else if (activeHobby === "tincture") setPage("tincture"); else if (activeHobby === "oil_infusion") setPage("oil_infusion"); else if (activeHobby === "salve") setPage("salve"); else if (activeHobby === "tea") setPage("tea"); else if (activeHobby === "dogs") setPage("dogs"); else if (activeHobby === "cats") setPage("cats"); else if (activeHobby === "maple_syrup") setPage("maple_syrup"); else setPage("home"); }} icon={Home} label="Home" />
        <NavTab active={page === "analytics"} onClick={() => setPage("analytics")} icon={BarChart3} label="Stats" />
        <NavTab active={page === "calendar"} onClick={() => setPage("calendar")} icon={Calendar} label="Calendar" />
        <NavTipButton filled={tippedThisMonth} onClick={() => setModal({ type: "support" })} />
        {!data.salesHidden && <NavTab active={page === "sales"} onClick={() => setPage("sales")} icon={DollarSign} label="Sales" />}
        <NavTab active={page === "year"} onClick={() => setPage("year")} icon={Sparkles} label="Year" />
      </nav>

      {/* MODALS */}
      <ModalRouter modal={modal} setModal={setModal} data={data} update={update} activeHobby={activeHobby} user={user} role={role} setActiveHobby={setActiveHobby} setPage={setPage} onFreshStart={() => setData(defaultData())} />
    </div>
  );
}

// ============================================================================
// PRESERVING PAGE — wrapper that routes between canning/freeze-drying/
// dehydrating/fermentation via internal tabs. No data migration; each
// sub-type is its own hobby under the hood.
// ============================================================================
function PreservingPage({ data, update, setModal, initialSubType }) {
  const [activeSub, setActiveSub] = useState(initialSubType || "canning");

  const canningHobby = data.hobbies.find(h => h.type === "canning");
  const freezeDryingHobby = data.hobbies.find(h => h.type === "freeze_drying");
  const dehydratingHobby = data.hobbies.find(h => h.type === "dehydrating");
  const fermentationHobby = data.hobbies.find(h => h.type === "fermentation");

  const tabs = [
    { key: "canning",       label: "Canning",       emoji: "🫙", hobby: canningHobby },
    { key: "freeze_drying", label: "Freeze drying", emoji: "❄️", hobby: freezeDryingHobby },
    { key: "dehydrating",   label: "Dehydrating",   emoji: "🌬️", hobby: dehydratingHobby },
    { key: "fermentation",  label: "Fermentation",  emoji: "🫧", hobby: fermentationHobby },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 6, marginBottom: 16,
        overflowX: "auto", WebkitOverflowScrolling: "touch",
        paddingBottom: 2,
      }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveSub(t.key)}
            style={{
              flexShrink: 0,
              padding: "8px 14px", borderRadius: 999,
              border: `1.5px solid ${activeSub === t.key ? palette.ink : palette.line}`,
              background: activeSub === t.key ? palette.ink : palette.card,
              color: activeSub === t.key ? palette.bg : palette.ink,
              fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13,
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Active sub-hobby page */}
      {activeSub === "canning" && canningHobby && (
        <CanningPage hobby={canningHobby} data={data} update={update} setModal={setModal} />
      )}
      {activeSub === "freeze_drying" && freezeDryingHobby && (
        <FreezeDryingPage hobby={freezeDryingHobby} data={data} update={update} setModal={setModal} />
      )}
      {activeSub === "dehydrating" && dehydratingHobby && (
        <DehydratingPage hobby={dehydratingHobby} data={data} update={update} setModal={setModal} />
      )}
      {activeSub === "fermentation" && fermentationHobby && (
        <FermentationPage hobby={fermentationHobby} data={data} update={update} setModal={setModal} />
      )}
    </div>
  );
}

// ============================================================================
// PRESERVING ANALYTICS PAGE — wrapper analytics view for the four preserving
// sub-types. Same tab pattern as PreservingPage so analytics feels unified.
// Each tab renders that sub-type's existing Analytics component wrapped in
// AnalyticsShareWrapper, identical to how the standalone blocks worked.
// ============================================================================
function PreservingAnalyticsPage({ data, initialSubType, spouseMode }) {
  const [activeSub, setActiveSub] = useState(initialSubType || "canning");

  const canningHobby = data.hobbies.find(h => h.type === "canning");
  const freezeDryingHobby = data.hobbies.find(h => h.type === "freeze_drying");
  const dehydratingHobby = data.hobbies.find(h => h.type === "dehydrating");
  const fermentationHobby = data.hobbies.find(h => h.type === "fermentation");

  const tabs = [
    { key: "canning",       label: "Canning",       emoji: "🫙" },
    { key: "freeze_drying", label: "Freeze drying", emoji: "❄️" },
    { key: "dehydrating",   label: "Dehydrating",   emoji: "🌬️" },
    { key: "fermentation",  label: "Fermentation",  emoji: "🫧" },
  ];

  return (
    <div>
      <div style={{
        display: "flex", gap: 6, marginBottom: 16,
        overflowX: "auto", WebkitOverflowScrolling: "touch",
        paddingBottom: 2,
      }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveSub(t.key)}
            style={{
              flexShrink: 0,
              padding: "8px 14px", borderRadius: 999,
              border: `1.5px solid ${activeSub === t.key ? palette.ink : palette.line}`,
              background: activeSub === t.key ? palette.ink : palette.card,
              color: activeSub === t.key ? palette.bg : palette.ink,
              fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13,
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {activeSub === "canning" && canningHobby && (
        <AnalyticsShareWrapper hobby={canningHobby} entries={data.entries?.["canning"] || []} data={data}>
          <CanningAnalytics hobby={canningHobby} entries={data.entries?.["canning"] || []} sales={data.sales || []} spouseMode={spouseMode} />
        </AnalyticsShareWrapper>
      )}
      {activeSub === "freeze_drying" && freezeDryingHobby && (
        <AnalyticsShareWrapper hobby={freezeDryingHobby} entries={data.entries?.["freeze_drying"] || []} data={data}>
          <FreezeDryingAnalytics hobby={freezeDryingHobby} spouseMode={spouseMode} />
        </AnalyticsShareWrapper>
      )}
      {activeSub === "dehydrating" && dehydratingHobby && (
        <AnalyticsShareWrapper hobby={dehydratingHobby} entries={data.entries?.["dehydrating"] || []} data={data}>
          <DehydratingAnalytics hobby={dehydratingHobby} entries={data.entries?.["dehydrating"] || []} spouseMode={spouseMode} />
        </AnalyticsShareWrapper>
      )}
      {activeSub === "fermentation" && fermentationHobby && (
        <AnalyticsShareWrapper hobby={fermentationHobby} entries={data.entries?.["fermentation"] || []} data={data}>
          <FermentationAnalytics hobby={fermentationHobby} entries={data.entries?.["fermentation"] || []} />
        </AnalyticsShareWrapper>
      )}
    </div>
  );
}

// ============================================================================
// HERBALISM — virtual wrapper hobby with four sub-types (tincture, oil
// infusion, salve, tea). Mirrors PreservingPage exactly: tab bar at the
// top, each tab routes to the corresponding sub-type's page component.
// Each sub-type is a real hobby with its own data on data.hobbies, so
// analytics / sales / picker reordering all keep working unchanged.
//
// Tabs only render when their sub-hobby page component is available, so
// future sub-types can be added by dropping the import + tab entry in.
// ============================================================================
function HerbalismPage({ data, update, setModal, initialSubType }) {
  const [activeSub, setActiveSub] = useState(initialSubType || "tincture");

  const tinctureHobby = data.hobbies.find(h => h.type === "tincture");
  const oilHobby = data.hobbies.find(h => h.type === "oil_infusion");
  const salveHobby = data.hobbies.find(h => h.type === "salve");
  const teaHobby = data.hobbies.find(h => h.type === "tea");

  // Tabs are listed in the natural workflow order: tinctures (alcohol) →
  // oils (carrier oil) → salves (oils + beeswax) → teas (dried blends).
  // All four sub-types have real pages now.
  const tabs = [
    { key: "tincture",     label: "Tinctures",     emoji: "🌿", hobby: tinctureHobby },
    { key: "oil_infusion", label: "Oil infusions", emoji: "🫒", hobby: oilHobby       },
    { key: "salve",        label: "Salves",        emoji: "🪻", hobby: salveHobby     },
    { key: "tea",          label: "Tea blends",    emoji: "🍵", hobby: teaHobby       },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 6, marginBottom: 16,
        overflowX: "auto", WebkitOverflowScrolling: "touch",
        paddingBottom: 2,
      }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveSub(t.key)}
            style={{
              flexShrink: 0,
              padding: "8px 14px", borderRadius: 999,
              border: `1.5px solid ${activeSub === t.key ? palette.ink : palette.line}`,
              background: activeSub === t.key ? palette.ink : palette.card,
              color: activeSub === t.key ? palette.bg : palette.ink,
              fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13,
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Active sub-hobby page */}
      {activeSub === "tincture" && tinctureHobby && (
        <TincturePage hobby={tinctureHobby} data={data} update={update} setModal={setModal} />
      )}
      {activeSub === "oil_infusion" && oilHobby && (
        <OilInfusionPage hobby={oilHobby} data={data} update={update} setModal={setModal} />
      )}
      {activeSub === "salve" && salveHobby && (
        <SalvePage hobby={salveHobby} data={data} update={update} setModal={setModal} />
      )}
      {activeSub === "tea" && teaHobby && (
        <TeaPage hobby={teaHobby} data={data} update={update} setModal={setModal} />
      )}
    </div>
  );
}

// Small placeholder for herbalism sub-types whose pages aren't shipped yet.
// Renders inline so the user can still tap the tab and see what's coming
// rather than hitting a blank screen.
function ComingSoonSubHobby({ name, emoji }) {
  return (
    <div style={{
      padding: 28, background: palette.card, border: `2px dashed ${palette.line}`,
      borderRadius: 12, textAlign: "center", color: palette.inkSoft,
    }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>{emoji}</div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink, marginBottom: 6 }}>
        {name} — coming soon
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>
        This sub-hobby is being built. Tinctures are ready now — tap the Tinctures tab to get started.
      </div>
    </div>
  );
}

// Herbalism analytics wrapper — same pattern as PreservingAnalyticsPage.
// Each sub-type's analytics component renders independently inside its tab.
function HerbalismAnalyticsPage({ data, initialSubType, spouseMode }) {
  const [activeSub, setActiveSub] = useState(initialSubType || "tincture");

  const tinctureHobby = data.hobbies.find(h => h.type === "tincture");
  const oilHobby = data.hobbies.find(h => h.type === "oil_infusion");
  const salveHobby = data.hobbies.find(h => h.type === "salve");
  const teaHobby = data.hobbies.find(h => h.type === "tea");

  const tabs = [
    { key: "tincture",     label: "Tinctures",     emoji: "🌿", hobby: tinctureHobby, hasPage: true  },
    { key: "oil_infusion", label: "Oil infusions", emoji: "🫒", hobby: oilHobby,       hasPage: false },
    { key: "salve",        label: "Salves",        emoji: "🪻", hobby: salveHobby,     hasPage: false },
    { key: "tea",          label: "Tea blends",    emoji: "🍵", hobby: teaHobby,       hasPage: false },
  ];

  return (
    <div>
      <div style={{
        display: "flex", gap: 6, marginBottom: 16,
        overflowX: "auto", WebkitOverflowScrolling: "touch",
        paddingBottom: 2,
      }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveSub(t.key)}
            style={{
              flexShrink: 0,
              padding: "8px 14px", borderRadius: 999,
              border: `1.5px solid ${activeSub === t.key ? palette.ink : palette.line}`,
              background: activeSub === t.key ? palette.ink : palette.card,
              color: activeSub === t.key ? palette.bg : palette.ink,
              fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13,
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>
      {activeSub === "tincture" && tinctureHobby && (
        <AnalyticsShareWrapper hobby={tinctureHobby} data={data} spouseMode={spouseMode}>
          <TinctureAnalytics hobby={tinctureHobby} entries={data.entries?.["tincture"] || []} />
        </AnalyticsShareWrapper>
      )}
      {activeSub === "oil_infusion" && oilHobby && (
        <AnalyticsShareWrapper hobby={oilHobby} data={data} spouseMode={spouseMode}>
          <OilInfusionAnalytics hobby={oilHobby} entries={data.entries?.["oil_infusion"] || []} />
        </AnalyticsShareWrapper>
      )}
      {activeSub === "salve" && salveHobby && (
        <AnalyticsShareWrapper hobby={salveHobby} data={data} spouseMode={spouseMode}>
          <SalveAnalytics hobby={salveHobby} entries={data.entries?.["salve"] || []} />
        </AnalyticsShareWrapper>
      )}
      {activeSub === "tea" && teaHobby && (
        <AnalyticsShareWrapper hobby={teaHobby} data={data} spouseMode={spouseMode}>
          <TeaAnalytics hobby={teaHobby} entries={data.entries?.["tea"] || []} />
        </AnalyticsShareWrapper>
      )}
    </div>
  );
}

// ============ HOME PAGE ============
function HomePage({ hobby, data, update, setModal, setPage }) {
  const entries = data.entries[hobby.id] || [];

  // Recent activity scope: keep the main view to the current season plus the
  // previous one (smooth transition — never vanishes mid-season), capped at
  // 20 rows. Anything older or beyond the cap goes to the Journal page.
  // Sorted newest-first the same way as before.
  const recentScope = React.useMemo(() => {
    const current = getCurrentSeasonInfo(data);
    const prev = getPreviousSeasonInfo(current);
    const cutoff = prev ? prev.sortOrder : current.sortOrder;
    const withSeason = entries.map((e) => ({ e, season: getSeasonInfo(e.date, data) }));
    const inWindow = withSeason
      .filter(({ season }) => season.sortOrder >= cutoff)
      .map(({ e }) => e);
    inWindow.sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
    const CAP = 20;
    const visible = inWindow.slice(0, CAP);
    // "Hidden" = anything not visible: older-than-prev-season OR beyond the cap.
    const hidden = entries.length - visible.length;
    return { visible, hidden };
  }, [entries, data]);
  const recent = recentScope.visible;

  return (
    <div>
      {/* WELCOME CARD — shown to recently-onboarded users until they log first entry */}
      {data.onboardedAt && !data.welcomeCardDismissed && entries.length === 0 && (
        <WelcomeCard data={data} update={update} setModal={setModal} />
      )}

      {/* WHAT NEEDS ATTENTION — proactive nudges based on entry history */}
      <NeedsAttentionCard hobby={hobby} entries={entries} setModal={setModal} />

      {/* HOBBY-SPECIFIC SUMMARY */}
      {hobby.type === "egg_layers" && <EggLayersSummary hobby={hobby} entries={entries} update={update} setModal={setModal} />}
      {hobby.type === "meat_chickens" && <MeatChickensSummary hobby={hobby} entries={entries} update={update} setModal={setModal} />}
      {hobby.type === "garden" && <GardenSummary hobby={hobby} data={data} update={update} setModal={setModal} />}

      {/* QUICK LOG TILES */}
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, margin: "24px 0 12px", color: palette.ink }}>
        quick log
      </h2>
      <QuickLogTiles hobby={hobby} setModal={setModal} />

      {/* RECENT ACTIVITY */}
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, margin: "28px 0 12px", color: palette.ink }}>
        recent activity
      </h2>
      {recent.length === 0 ? (
        <div style={{
          padding: 24, background: palette.card, border: `1.5px dashed ${palette.line}`,
          borderRadius: 12, textAlign: "center", color: palette.inkSoft,
        }}>
          No entries yet — tap a tile above to get started.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recent.map((e) => (
            <ActivityRow
              key={e.id}
              entry={e}
              hobbyType={hobby.type}
              onEdit={() => setModal({ type: "log", action: e.action, existingEntry: e })}
              onDelete={() => {
                // Best-effort: clean up ALL photos from storage if there were any.
                getEntryPhotos(e).forEach((p) => deletePhoto(p).catch(() => {}));
                update((d) => {
                  d.entries[hobby.id] = (d.entries[hobby.id] || []).filter((x) => x.id !== e.id);
                  // For butcher entries, also remove the matching record from
                  // currentBatch.butchered (so remaining-birds math recovers)
                  // and from the universal freezer log (which mirrors the
                  // butcher entry). Without this, deleting a butcher row would
                  // leave the batch count permanently low and the freezer log
                  // would keep showing meat the user said was deleted.
                  if (e.action === "butcher") {
                    const h = d.hobbies.find((x) => x.id === hobby.id);
                    // Find which active batch this entry belonged to, then
                    // strip the matching butcher record from THAT batch's
                    // butchered[] so the remaining-bird count recovers. With
                    // multi-batch support, e.batchId tells us which one.
                    if (h && Array.isArray(h.currentBatches)) {
                      const b = h.currentBatches.find((x) => x.id === e.batchId);
                      if (b && Array.isArray(b.butchered)) {
                        b.butchered = b.butchered.filter((bu) => bu.id !== e.id);
                      }
                    }
                    if (Array.isArray(d.freezerLog)) {
                      d.freezerLog = d.freezerLog.filter(
                        (f) => !(f.batchId === e.batchId && f.date === e.date && f.count === e.count)
                      );
                    }
                  }
                  return d;
                });
              }}
            />
          ))}
        </div>
      )}

      {/* Journal overflow footer — surfaces when older entries exist outside the
          current+previous-season window OR beyond the 20-row cap. */}
      {recentScope.hidden > 0 && (
        <button
          onClick={() => { if (setPage) setPage("journal"); }}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "12px 14px",
            background: palette.card,
            border: `1.5px dashed ${palette.line}`,
            borderRadius: 10,
            cursor: "pointer",
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: palette.inkSoft,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          {recentScope.hidden === 1
            ? "1 older entry lives in the Journal"
            : `${recentScope.hidden} older entries live in the Journal`}
          <div style={{ fontSize: 11, marginTop: 2, color: palette.inkSoft, opacity: 0.7 }}>
            📓 Tap to open
          </div>
        </button>
      )}
    </div>
  );
}

// ============================================================================
// JOURNAL PAGE
// ----------------------------------------------------------------------------
// Full historical entry browser, grouped by season. Sorted newest-first.
// HomePage's "recent activity" shows only the current + previous season (capped
// at 20 entries). Everything else lives here. Tap any entry to open the same
// edit modal HomePage uses, so edits/deletes stay consistent.
//
// UX: a "filter by hobby" pill row at the top, then a list of collapsible
// season groups. Each header shows the season label + entry count. Tap a
// header to toggle. Only one season is expanded by default (the most recent
// one with entries) so the page doesn't open as a wall of text.
// ============================================================================
function JournalPage({ data, update, setModal }) {
  const [hobbyFilter, setHobbyFilter] = useState("all");
  const [openSeasons, setOpenSeasons] = useState(() => new Set());
  const initializedRef = useRef(false);

  // Hobbies that actually have entries (avoid showing pills for unused ones).
  // We respect the user's hobby ordering / hidden flags via data.hobbies.
  //
  // Archived meat-bird batches keep their entries in a `finalEntries`
  // snapshot on the batch (so they're removed from data.entries to keep
  // live analytics clean). The Journal is the place to view history, so
  // we include those snapshot entries when deciding which hobbies have
  // anything to show.
  const archivedEntriesByHobby = React.useMemo(() => {
    const map = {};
    for (const h of data.hobbies || []) {
      const batches = Array.isArray(h.archivedBatches) ? h.archivedBatches : [];
      const merged = [];
      for (const b of batches) {
        if (Array.isArray(b.finalEntries)) merged.push(...b.finalEntries);
      }
      if (merged.length > 0) map[h.id] = merged;
    }
    return map;
  }, [data.hobbies]);

  const hobbiesWithEntries = React.useMemo(() => {
    const list = [];
    for (const h of data.hobbies || []) {
      if (h.hidden) continue;
      const arr = data.entries?.[h.id];
      const archived = archivedEntriesByHobby[h.id];
      const liveHas = Array.isArray(arr) && arr.length > 0;
      const archivedHas = Array.isArray(archived) && archived.length > 0;
      if (liveHas || archivedHas) list.push(h);
    }
    return list;
  }, [data.hobbies, data.entries, archivedEntriesByHobby]);

  // Collect all entries (or just the filtered hobby's) and tag with season +
  // hobby info. Then group by season key, sort groups newest-first, sort
  // entries within each group newest-first.
  const grouped = React.useMemo(() => {
    const byKey = new Map(); // key → { info, items: [{ entry, hobby }] }
    const includeHobby = (h) => hobbyFilter === "all" || hobbyFilter === h.id;
    // De-dupe by entry id so that if an entry exists in both data.entries
    // and an archived batch's finalEntries snapshot (shouldn't happen, but
    // belt-and-suspenders), we render it only once.
    const seenIds = new Set();
    const pushEntry = (e, h) => {
      if (!e || !e.date) return;
      if (e.id) {
        if (seenIds.has(e.id)) return;
        seenIds.add(e.id);
      }
      const info = getSeasonInfo(e.date, data);
      if (!byKey.has(info.key)) byKey.set(info.key, { info, items: [] });
      byKey.get(info.key).items.push({ entry: e, hobby: h });
    };
    for (const h of data.hobbies || []) {
      if (h.hidden) continue;
      if (!includeHobby(h)) continue;
      const arr = data.entries?.[h.id];
      if (Array.isArray(arr)) {
        for (const e of arr) pushEntry(e, h);
      }
      const archived = archivedEntriesByHobby[h.id];
      if (Array.isArray(archived)) {
        for (const e of archived) pushEntry(e, h);
      }
    }
    // Sort each group's items newest-first
    for (const g of byKey.values()) {
      g.items.sort((a, b) => b.entry.date.localeCompare(a.entry.date) || (b.entry.created || 0) - (a.entry.created || 0));
    }
    // Sort groups newest season first
    return Array.from(byKey.values()).sort((a, b) => b.info.sortOrder - a.info.sortOrder);
  }, [data.hobbies, data.entries, data.homesteadLocation, hobbyFilter, archivedEntriesByHobby]);

  // On first render (or when filter changes and we have results), expand only
  // the most recent season so the page doesn't open as a giant wall.
  React.useEffect(() => {
    if (grouped.length === 0) return;
    if (!initializedRef.current) {
      setOpenSeasons(new Set([grouped[0].info.key]));
      initializedRef.current = true;
    }
  }, [grouped]);

  const toggleSeason = (key) => {
    setOpenSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Delete handler — mirrors HomePage's logic so the Journal stays consistent
  // (butcher entries also clean up freezerLog + currentBatch.butchered).
  // Also handles entries that live in archived batches' finalEntries
  // snapshot — the Journal surfaces those now, so deletion must reach them.
  const deleteEntry = (entry, hobby) => {
    getEntryPhotos(entry).forEach((p) => deletePhoto(p).catch(() => {}));
    update((d) => {
      d.entries[hobby.id] = (d.entries[hobby.id] || []).filter((x) => x.id !== entry.id);
      // Also strip the entry from any archived batch's finalEntries.
      const hForArchive = d.hobbies.find((x) => x.id === hobby.id);
      if (hForArchive && Array.isArray(hForArchive.archivedBatches)) {
        for (const b of hForArchive.archivedBatches) {
          if (Array.isArray(b.finalEntries)) {
            b.finalEntries = b.finalEntries.filter((x) => x.id !== entry.id);
          }
        }
      }
      if (entry.action === "butcher") {
        const h = d.hobbies.find((x) => x.id === hobby.id);
        if (h && Array.isArray(h.currentBatches)) {
          const b = h.currentBatches.find((x) => x.id === entry.batchId);
          if (b && Array.isArray(b.butchered)) {
            b.butchered = b.butchered.filter((bu) => bu.id !== entry.id);
          }
        }
        if (Array.isArray(d.freezerLog)) {
          d.freezerLog = d.freezerLog.filter(
            (f) => !(f.batchId === entry.batchId && f.date === entry.date && f.count === entry.count)
          );
        }
      }
      return d;
    });
  };

  const totalEntries = grouped.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div>
      {/* PAGE HEADER */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 30, margin: 0, color: palette.ink }}>
          Journal
        </h1>
        <div style={{ fontSize: 13, color: palette.inkSoft, marginTop: 4, lineHeight: 1.5 }}>
          Your full history, organized by season. Tap any entry to view or edit.
        </div>
      </div>

      {/* HOBBY FILTER PILLS — "All" + one per hobby with entries */}
      {hobbiesWithEntries.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
          <PillButton
            active={hobbyFilter === "all"}
            onClick={() => setHobbyFilter("all")}
          >
            All hobbies
          </PillButton>
          {hobbiesWithEntries.map((h) => (
            <PillButton
              key={h.id}
              active={hobbyFilter === h.id}
              onClick={() => setHobbyFilter(h.id)}
            >
              {h.name}
            </PillButton>
          ))}
        </div>
      )}

      {/* EMPTY STATE */}
      {totalEntries === 0 && (
        <div style={{
          padding: 32, background: palette.card, border: `1.5px dashed ${palette.line}`,
          borderRadius: 12, textAlign: "center", color: palette.inkSoft, lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>📓</div>
          {hobbyFilter === "all"
            ? "Nothing in the Journal yet. Log a few entries and they'll appear here organized by season."
            : "No entries for this hobby yet. Switch the filter or log a few entries."}
        </div>
      )}

      {/* SEASON GROUPS */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {grouped.map((g) => {
          const open = openSeasons.has(g.info.key);
          return (
            <div
              key={g.info.key}
              style={{
                background: palette.card,
                border: `1.5px solid ${palette.line}`,
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "2px 2px 0 " + palette.line,
              }}
            >
              <button
                onClick={() => toggleSeason(g.info.key)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: FONT_BODY,
                  fontSize: 15,
                  color: palette.ink,
                  textAlign: "left",
                }}
                aria-expanded={open}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>
                    {g.info.type === "winter" ? "❄️" :
                     g.info.type === "spring" ? "🌱" :
                     g.info.type === "summer" ? "☀️" :
                     "🍂"}
                  </span>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18 }}>{g.info.label}</span>
                  <span style={{ fontSize: 12, color: palette.inkSoft, fontWeight: 500 }}>
                    · {g.items.length} {g.items.length === 1 ? "entry" : "entries"}
                  </span>
                </span>
                <ChevronDown
                  size={18}
                  style={{
                    transform: open ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 150ms ease",
                    color: palette.inkSoft,
                  }}
                />
              </button>
              {open && (
                <div style={{
                  padding: "4px 12px 12px",
                  borderTop: `1px solid ${palette.line}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}>
                  {g.items.map(({ entry, hobby }) => (
                    <div key={`${hobby.id}-${entry.id}`}>
                      {/* When filter is "all", show which hobby each entry belongs to.
                          When filtered, the hobby is already implied — skip the badge. */}
                      {hobbyFilter === "all" && (
                        <div style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: 0.8,
                          color: palette.inkSoft,
                          marginBottom: 3,
                          marginLeft: 2,
                          fontWeight: 600,
                        }}>
                          {hobby.name}
                        </div>
                      )}
                      <ActivityRow
                        entry={entry}
                        hobbyType={hobby.type}
                        onEdit={() => setModal({ type: "log", action: entry.action, existingEntry: entry, hobbyIdOverride: hobby.id })}
                        onDelete={() => deleteEntry(entry, hobby)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Small pill-button used by JournalPage's hobby filter. Kept local because
// nothing else in the file uses this exact look.
function PillButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        border: `1.5px solid ${active ? palette.ink : palette.line}`,
        background: active ? palette.ink : palette.card,
        color: active ? palette.bg : palette.ink,
        cursor: "pointer",
        fontFamily: FONT_BODY,
        fontWeight: 600,
        fontSize: 12,
      }}
    >
      {children}
    </button>
  );
}

function QuickLogTiles({ hobby, setModal }) {
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 };

  if (hobby.type === "garden") {
    // If no active season, hide the action tiles — Summary handles the "start season" CTA
    if (!hobby.currentSeason) {
      return (
        <div style={{
          padding: 16, background: palette.bgAlt, border: `1.5px dashed ${palette.line}`,
          borderRadius: 12, textAlign: "center", color: palette.inkSoft, fontSize: 13,
        }}>
          Start a garden season to begin logging.
        </div>
      );
    }
    return (
      <div style={grid}>
        <Tile icon={Droplet} label="Watered" color="#3F7CAC" onClick={() => setModal({ type: "log", action: "watered" })} />
        <Tile icon={Leaf} label="Fertilized" color={palette.leafSoft || "#A8C078"} onClick={() => setModal({ type: "log", action: "fertilized" })} />
        <Tile icon={Sprout} label="Planted" color={palette.leaf} onClick={() => setModal({ type: "log", action: "planted" })} />
        <Tile icon={Scissors} label="Harvested" color={palette.accent} onClick={() => setModal({ type: "log", action: "harvested" })} />
        <Tile icon={AlertTriangle} label="Report Issue" color={palette.yolk} onClick={() => setModal({ type: "log", action: "issue" })} />
        <Tile icon={NotebookPen} label="Note" color={palette.feather} onClick={() => setModal({ type: "log", action: "note" })} />
        <Tile icon={Leaf} label="Close Season" color={palette.ink} onClick={() => setModal({ type: "closeGardenSeason" })} />
      </div>
    );
  }
  if (hobby.type === "egg_layers") {
    // Push 6 — Butcher tile shows up only when at least one flock has birds.
    // Without this guard, the modal would render its empty state on tap which
    // is fine but the tile would feel useless. Hiding it keeps the grid tight.
    const hasAnyBirds = (hobby.flocks || []).some((f) => (Number(f.birdCount) || 0) > 0);
    return (
      <div style={grid}>
        <Tile icon={Sun} label="Fed" color={palette.feather} onClick={() => setModal({ type: "log", action: "fed" })} />
        <Tile icon={Droplet} label="Watered" color="#3F7CAC" onClick={() => setModal({ type: "log", action: "watered" })} />
        <Tile icon={Bird} label="Free Range" color={palette.leaf} onClick={() => setModal({ type: "log", action: "free_range" })} />
        <Tile icon={Truck} label="Move Tractor" color={palette.feather} onClick={() => setModal({ type: "log", action: "move_tractor" })} />
        <Tile icon={Egg} label="Eggs Laid" color={palette.yolk} onClick={() => setModal({ type: "log", action: "eggs" })} />
        <Tile icon={DollarSign} label="Sold Eggs" color={palette.accent} onClick={() => setModal({ type: "log", action: "sold_eggs" })} />
        <Tile icon={Archive} label="Bedding" color={palette.featherSoft} onClick={() => setModal({ type: "log", action: "bedding" })} />
        <Tile icon={NotebookPen} label="Broody" color={palette.maple || palette.yolkSoft} onClick={() => setModal({ type: "log", action: "broody" })} />
        <Tile icon={Skull} label="Report Death" color={palette.accent} onClick={() => setModal({ type: "log", action: "death" })} />
        <Tile icon={Hammer} label="Infrastructure" color={palette.feather} onClick={() => setModal({ type: "log", action: "infrastructure" })} />
        <Tile icon={NotebookPen} label="Note" color={palette.inkSoft} onClick={() => setModal({ type: "log", action: "note" })} />
        {/* Push 6 — Butcher / Remove birds. Mirrors the meat-bird butcher tile
            but routes through ButcherFlockModal which handles all reasons
            (butcher / sold / rehomed / given away / died / culled / other).
            Modal shows its own flock picker when there's >1 flock with birds. */}
        {hasAnyBirds && (
          <Tile icon={Snowflake} label="Butcher" color={palette.ink} onClick={() => setModal({ type: "butcherFlock", hobbyId: hobby.id })} />
        )}
        <Tile icon={Plus} label="Add Flock" color={palette.ink} onClick={() => setModal({ type: "addFlock", hobbyId: hobby.id })} />
      </div>
    );
  }
  if (hobby.type === "meat_chickens") {
    // Disable actions until at least one batch is started (the Summary card
    // has the Hatch CTA). With multi-batch support, the Log modal will show
    // a batch picker when there's >1 active batch.
    const activeBatches = hobby.currentBatches || [];
    if (activeBatches.length === 0) {
      return (
        <div style={{
          padding: 16, background: palette.bgAlt, border: `1.5px dashed ${palette.line}`,
          borderRadius: 12, textAlign: "center", color: palette.inkSoft, fontSize: 13,
        }}>
          Hatch a batch above to begin logging.
        </div>
      );
    }
    return (
      <div style={grid}>
        <Tile icon={Sun} label="Fed" color={palette.feather} onClick={() => setModal({ type: "log", action: "fed" })} />
        <Tile icon={Droplet} label="Watered" color="#3F7CAC" onClick={() => setModal({ type: "log", action: "watered" })} />
        <Tile icon={Truck} label="Move Tractor" color={palette.feather} onClick={() => setModal({ type: "log", action: "move_tractor" })} />
        <Tile icon={Skull} label="Report Death" color={palette.accent} onClick={() => setModal({ type: "log", action: "death" })} />
        <Tile icon={Hammer} label="Infrastructure" color={palette.feather} onClick={() => setModal({ type: "log", action: "infrastructure" })} />
        <Tile icon={NotebookPen} label="Note" color={palette.inkSoft} onClick={() => setModal({ type: "log", action: "note" })} />
        <Tile icon={Snowflake} label="Butcher" color={palette.ink} onClick={() => setModal({ type: "butcher" })} />
      </div>
    );
  }
  return (
    <div style={grid}>
      <Tile icon={Plus} label="Quick Note" onClick={() => setModal({ type: "log", action: "note" })} />
    </div>
  );
}

// ============================================================================
// NeedsAttentionCard — proactive nudges based on entry history
// ----------------------------------------------------------------------------
// Inspects the entries for this hobby and generates 0-N short messages about
// things that may need attention (haven't watered in a while, no eggs today,
// etc.). Only renders when at least one nudge is active so the home page stays
// clean for active users.
// ============================================================================
function NeedsAttentionCard({ hobby, entries, setModal }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = localDateStr(today);
  const dayMs = 24 * 60 * 60 * 1000;

  const daysSince = (action) => {
    const matching = entries.filter((e) => e.action === action);
    if (matching.length === 0) return null;
    const newest = matching.reduce((latest, e) => (e.date > latest ? e.date : latest), matching[0].date);
    const diffDays = Math.floor((today.getTime() - new Date(newest + "T12:00").getTime()) / dayMs);
    return diffDays;
  };

  const nudges = [];

  if (hobby.type === "egg_layers" && (hobby.flocks || []).some(f => f.birdCount > 0)) {
    // Eggs not collected today (check baskets across all flocks)
    const collectedToday = entries.some((e) => e.date === todayIso && (e.action === "eggs" || e.action === "eggs_laid"));
    const anyBasketToday = (hobby.flocks || []).some(f => f.eggBasket && f.eggBasket.date === todayIso && f.eggBasket.count > 0);
    if (!collectedToday && !anyBasketToday) {
      nudges.push({
        icon: "🥚",
        text: "No eggs logged yet today",
        action: () => setModal({ type: "log", action: "eggs" }),
        actionLabel: "Log eggs",
      });
    }
    // Feed > 7 days
    const feedDays = daysSince("fed");
    if (feedDays === null) {
      nudges.push({
        icon: "🌾",
        text: "No feed costs logged yet",
        sub: "Helps the cost-per-dozen math work",
        action: () => setModal({ type: "log", action: "fed" }),
        actionLabel: "Log feed",
      });
    } else if (feedDays > 14) {
      nudges.push({
        icon: "🌾",
        text: `Last feed entry was ${feedDays} days ago`,
        action: () => setModal({ type: "log", action: "fed" }),
        actionLabel: "Log feed",
      });
    }
  }

  if (hobby.type === "garden" && hobby.currentSeason) {
    // Watered in the last 5 days?
    const wateredDays = daysSince("watered");
    if (wateredDays === null || wateredDays > 5) {
      nudges.push({
        icon: "💧",
        text: wateredDays === null
          ? "No watering logged this season"
          : `Last watered ${wateredDays} days ago`,
        action: () => setModal({ type: "log", action: "watered" }),
        actionLabel: "Log watering",
      });
    }
  }

  if (hobby.type === "meat_chickens") {
    // Per-batch age nudges. Only fire for chicken batches — turkeys, ducks,
    // geese, etc. all have different butcher timelines and the "7-8 week"
    // Cornish Cross window doesn't apply to them. Each batch gets its own
    // nudge so a user with both broilers (ready) and turkeys (months out)
    // doesn't get spammed about the turkeys.
    const activeBatches = hobby.currentBatches || [];
    activeBatches.forEach((batch) => {
      const birdType = batch.birdType || "Chicken";
      if (birdType !== "Chicken") return;
      const startDate = batch.startDate ? new Date(batch.startDate + "T12:00") : null;
      if (!startDate) return;
      const ageWeeks = Math.floor((today.getTime() - startDate.getTime()) / (7 * dayMs));
      // Use the batch name in the message so multi-batch users know WHICH
      // batch the nudge is about. The action opens the butcher modal pre-
      // pointed at this specific batch (modal will skip its internal picker).
      const batchTag = activeBatches.length > 1 ? ` (${batch.name})` : "";
      if (ageWeeks >= 7 && ageWeeks <= 9) {
        nudges.push({
          icon: "🍗",
          text: `Birds are ${ageWeeks} weeks old${batchTag}`,
          sub: "Cornish Cross typically butcher around 7-8 weeks",
          action: () => setModal({ type: "butcher", batchId: batch.id }),
          actionLabel: "Send to freezer camp",
        });
      } else if (ageWeeks > 9) {
        nudges.push({
          icon: "🍗",
          text: `Birds are ${ageWeeks} weeks old — past typical butcher age${batchTag}`,
          sub: "Each extra week means more feed cost",
          action: () => setModal({ type: "butcher", batchId: batch.id }),
          actionLabel: "Send to freezer camp",
        });
      }
    });
    // Feed nudge is hobby-wide (one feeding usually covers all batches in the
    // same coop, and we don't want to nag the user N times if they're behind).
    // Only show once even with multiple active batches.
    if (activeBatches.length > 0) {
      const feedDays = daysSince("fed");
      if (feedDays !== null && feedDays > 7) {
        nudges.push({
          icon: "🌾",
          text: `Last feed entry was ${feedDays} days ago`,
          action: () => setModal({ type: "log", action: "fed" }),
          actionLabel: "Log feed",
        });
      }
    }
  }

  if (nudges.length === 0) return null;

  return (
    <div style={{
      background: palette.yolkSoft,
      border: `1.5px solid ${palette.line}`,
      borderRadius: 12,
      padding: 14,
      marginBottom: 14,
    }}>
      <div style={{ fontSize: 10, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        Needs attention
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {nudges.map((n, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px",
            background: palette.card,
            borderRadius: 8,
            border: `1.5px solid ${palette.line}`,
          }}>
            <div style={{ fontSize: 22, flexShrink: 0 }}>{n.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: palette.ink, fontWeight: 500 }}>
                {n.text}
              </div>
              {n.sub && (
                <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 2 }}>
                  {n.sub}
                </div>
              )}
            </div>
            {n.action && (
              <button
                onClick={n.action}
                style={{
                  padding: "6px 10px", fontSize: 12, fontWeight: 600,
                  background: palette.ink, color: palette.bg,
                  border: "none", borderRadius: 6,
                  cursor: "pointer", flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {n.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ PERENNIAL SECTION (collapsible) ============
function PerennialSection({ title, emptyHint, items, defaultCategory, hobby, setModal }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:14 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom: open ? 10 : 0 }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{ background:"none",border:"none",padding:0,cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:FONT_DISPLAY,fontSize:18,color:palette.ink }}
          aria-expanded={open}
        >
          <span style={{ fontSize:12,display:"inline-block",transform: open ? "rotate(90deg)" : "rotate(0deg)",transition:"transform 0.15s" }}>▶</span>
          {title}
          <span style={{ fontSize:12,color:palette.inkSoft,fontFamily:FONT_BODY,fontWeight:400 }}>
            {items.length > 0 ? `(${items.length})` : ""}
          </span>
        </button>
        <button
          onClick={() => setModal({ type:"addPerennial",hobbyId:hobby.id,category:defaultCategory })}
          style={{ background:"none",border:`1.5px dashed ${palette.line}`,borderRadius:8,padding:"4px 10px",fontSize:12,color:palette.inkSoft,cursor:"pointer",fontFamily:FONT_BODY }}
        >
          + Add
        </button>
      </div>
      {open && (
        <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
          {items.length === 0 ? (
            <div style={{ fontSize:12,color:palette.inkSoft,padding:"6px 4px",fontStyle:"italic" }}>{emptyHint}</div>
          ) : items.map(p => {
            const lastAction = (p.actions || []).slice(-1)[0];
            const lastHarvest = (p.harvests || []).slice(-1)[0];
            const subtitle =
              lastAction ? `Last: ${lastAction.type} · ${lastAction.date}` :
              lastHarvest ? `Last harvest: ${lastHarvest.date}` :
              `Planted ${p.plantDate || "unknown"}`;
            return (
              <button
                key={p.id}
                onClick={() => setModal({ type:"perennialDetail",hobbyId:hobby.id,perennialId:p.id })}
                style={{ display:"flex",alignItems:"center",gap:8,padding:"10px",background:palette.bgAlt,borderRadius:8,border:"none",cursor:"pointer",textAlign:"left",width:"100%",fontFamily:FONT_BODY }}
              >
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontWeight:600,fontSize:13,color:palette.ink }}>{p.name}{p.variety ? ` — ${p.variety}` : ""}</div>
                  <div style={{ fontSize:11,color:palette.inkSoft }}>{subtitle}</div>
                </div>
                <span style={{ fontSize:14,color:palette.inkSoft,flexShrink:0 }}>›</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ HOBBY SUMMARIES ============
function GardenSummary({ hobby, data, update, setModal }) {
  // Perennials section shown at bottom of garden home regardless of season
  const perennials = hobby.perennials || [];

  if (!hobby.currentSeason) {
    const seasonCount = (hobby.archivedSeasons || []).length;
    return (
      <div style={{
        background: palette.card, border: `2px dashed ${palette.ink}`, borderRadius: 12,
        padding: 24, textAlign: "center",
      }}>
        <Sprout size={32} color={palette.ink} strokeWidth={1.5} style={{ marginBottom: 10 }} />
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, marginBottom: 6 }}>No active season</div>
        <div style={{ color: palette.inkSoft, marginBottom: 14, fontSize: 14 }}>
          {seasonCount > 0
            ? `${seasonCount} past season${seasonCount > 1 ? "s" : ""} archived. Start a new one when you're ready to plant.`
            : "Start a new season when you're ready to plant."}
        </div>
        <Btn variant="accent" onClick={() => setModal({ type: "startGardenSeason" })}>
          🌱 Start new season
        </Btn>
      </div>
    );
  }
  const season = hobby.currentSeason;
  const seasonEntries = (data.entries.garden || []).filter((e) => e.seasonId === season.id);
  const harvests = seasonEntries.filter((e) => e.action === "harvested");
  const totalHarvest = harvests.reduce((s, e) => s + (Number(e.quantity) || 0), 0);
  const plantings = seasonEntries.filter((e) => e.action === "planted").length;
  const days = Math.floor((Date.now() - new Date(season.startDate).getTime()) / (1000 * 60 * 60 * 24));
  // Garden map shape changed from { photoPath, pins } to { areas: [{ photoPath, pins }] }.
  // Read the new shape, but stay backwards-compatible for any unmigrated season.
  const gmAreas = Array.isArray(season.gardenMap?.areas) ? season.gardenMap.areas : null;
  const hasMap = gmAreas
    ? gmAreas.some(a => a.photoPath)
    : !!season.gardenMap?.photoPath;
  const pinCount = gmAreas
    ? gmAreas.reduce((n, a) => n + (Array.isArray(a.pins) ? a.pins.length : 0), 0)
    : (season.gardenMap?.pins?.length || 0);
  return (
    <div>
      {/* Perennials section — split into Plants and Orchard */}
      {perennials.length === 0 ? (
        <button onClick={() => setModal({ type:"addPerennial",hobbyId:hobby.id })} style={{ width:"100%",marginBottom:14,padding:"10px",background:"transparent",border:`1.5px dashed ${palette.line}`,borderRadius:10,cursor:"pointer",fontSize:13,color:palette.inkSoft,fontFamily:FONT_BODY }}>
          🌳 Track perennials (fruit trees, asparagus, berry bushes...)
        </button>
      ) : (
        <>
          <PerennialSection
            title="🌿 Perennial Plants"
            emptyHint="Berry bushes, asparagus, rhubarb, vines..."
            items={perennials.filter(p => (p.category || "plant") === "plant")}
            defaultCategory="plant"
            hobby={hobby}
            setModal={setModal}
          />
          <PerennialSection
            title="🌳 Orchard"
            emptyHint="Fruit and nut trees"
            items={perennials.filter(p => p.category === "tree")}
            defaultCategory="tree"
            hobby={hobby}
            setModal={setModal}
          />
        </>
      )}
      <div style={{
        background: palette.ink, color: palette.bg, borderRadius: 12, padding: 14,
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
          Active Season · {season.name}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: palette.leafSoft, lineHeight: 1 }}>{plantings}</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>plantings · {totalHarvest.toFixed(1)} harvested · day {days}</div>
        </div>
      </div>

      {/* Garden Map card — opens the photo-based visualizer */}
      <div
        onClick={() => setModal({ type: "gardenMap" })}
        style={{
          background: palette.card,
          border: `1.5px solid ${palette.line}`,
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
          cursor: "pointer",
          display: "flex", alignItems: "center", gap: 12,
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 10, background: palette.leafSoft,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          fontSize: 24,
        }}>
          🗺️
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
            Garden map
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, lineHeight: 1.2 }}>
            {hasMap
              ? `${pinCount} ${pinCount === 1 ? "plant pinned" : "plants pinned"}`
              : "Tap to start mapping"}
          </div>
          {!hasMap && (
            <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 2 }}>
              Upload a photo, drop pins where things grow
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EggLayersSummary({ hobby, entries, update, setModal }) {
  const today = todayStr();
  const flocks = hobby.flocks || [];
  const totalBirds = flocks.reduce((s, f) => s + (f.birdCount || 0), 0);

  // Weekly egg stats across all flocks
  const eggsLaid = entries.filter((e) => e.action === "eggs_laid" || e.action === "eggs");
  const oneWeekAgo = localDateStr(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const twoWeeksAgo = localDateStr(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));
  const eggsThisWeek = eggsLaid.filter((e) => e.date > oneWeekAgo).reduce((s, e) => s + (Number(e.count) || 0), 0);
  const eggsLastWeek = eggsLaid.filter((e) => e.date > twoWeeksAgo && e.date <= oneWeekAgo).reduce((s, e) => s + (Number(e.count) || 0), 0);
  const diff = eggsThisWeek - eggsLastWeek;

  // Bird type emoji map
  const birdEmoji = { Chicken: "🐔", Duck: "🦆", Turkey: "🦃", Quail: "🐦", Goose: "🪿", Guinea: "🐦", Peafowl: "🦚", Other: "🐣" };

  if (flocks.length === 0) {
    return (
      <div style={{ background: palette.card, border: `2px dashed ${palette.ink}`, borderRadius: 12, padding: 24, textAlign: "center", marginBottom: 14 }}>
        <Egg size={32} color={palette.ink} strokeWidth={1.5} style={{ marginBottom: 10 }} />
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, marginBottom: 6 }}>No flocks yet</div>
        <div style={{ color: palette.inkSoft, marginBottom: 14, fontSize: 14 }}>Add your first flock to start tracking eggs.</div>
        <Btn variant="accent" onClick={() => setModal({ type: "addFlock", hobbyId: hobby.id })}>🐔 Add your first flock</Btn>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
      {/* All flocks egg baskets */}
      {flocks.map(flock => (
        <FlockBasket key={flock.id} flock={flock} hobby={hobby} entries={entries} update={update} setModal={setModal} birdEmoji={birdEmoji} />
      ))}

      {/* + Add Flock button */}
      <button
        onClick={() => setModal({ type: "addFlock", hobbyId: hobby.id })}
        style={{ padding: "10px 14px", background: palette.bgAlt, border: `1.5px dashed ${palette.line}`, borderRadius: 10, cursor: "pointer", fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: palette.inkSoft, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        <Plus size={16} /> Add another flock
      </button>

      {/* Weekly summary across all flocks */}
      {eggsLaid.length > 0 && (
        <div style={{ background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: palette.yolkSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Egg size={24} strokeWidth={1.8} color={palette.ink} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>This week · all flocks</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: palette.ink, lineHeight: 1 }}>
              {eggsThisWeek} <span style={{ fontSize: 14, color: palette.inkSoft }}>egg{eggsThisWeek === 1 ? "" : "s"}</span>
            </div>
            {eggsLastWeek > 0 && (
              <div style={{ fontSize: 12, marginTop: 4, color: diff > 0 ? palette.leaf : diff < 0 ? palette.accent : palette.inkSoft }}>
                {diff > 0 && <>▲ {diff} more than last week</>}
                {diff < 0 && <>▼ {Math.abs(diff)} fewer than last week</>}
                {diff === 0 && <>= same as last week</>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk backfill link — quiet, sits below the weekly summary. Lets users
          import historical egg counts without tapping + 500 times. Only useful
          for people coming from another system or onboarding with old flocks,
          which is why it's a low-prominence text link rather than a button. */}
      <button
        onClick={() => setModal({ type: "bulkEggs", hobbyId: hobby.id })}
        style={{
          background: "none", border: "none", padding: "4px 8px",
          fontFamily: FONT_BODY, fontSize: 12, color: palette.inkSoft,
          cursor: "pointer", textAlign: "center", textDecoration: "underline",
          textDecorationStyle: "dotted", alignSelf: "center", marginTop: 2,
        }}
      >
        📚 Backfill historical eggs in bulk
      </button>
    </div>
  );
}

// Per-flock egg basket with edit/delete flock controls
function FlockBasket({ flock, hobby, entries, update, setModal, birdEmoji }) {
  const today = todayStr();
  const basket = flock.eggBasket;
  const isToday = basket && basket.date === today;
  const count = isToday ? basket.count : 0;
  const emoji = birdEmoji[flock.birdType] || "🐣";

  // Flock-specific egg entries
  const flockEggs = entries.filter(e => e.flockId === flock.id && (e.action === "eggs_laid" || e.action === "eggs"));
  const todayLogged = entries.some(e => e.flockId === flock.id && e.date === today && (e.action === "eggs" || e.action === "eggs_laid"));

  const inc = () => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      const fl = (h.flocks || []).find(x => x.id === flock.id);
      if (!fl) return d;
      const cur = fl.eggBasket && fl.eggBasket.date === today ? fl.eggBasket.count : 0;
      fl.eggBasket = { date: today, count: cur + 1 };
      return d;
    });
  };

  const dec = () => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (!h) return d;
      const fl = (h.flocks || []).find(x => x.id === flock.id);
      if (!fl || !fl.eggBasket) return d;
      const cur = fl.eggBasket.date === today ? fl.eggBasket.count : 0;
      const next = Math.max(0, cur - 1);
      fl.eggBasket = next === 0 ? null : { date: today, count: next };
      return d;
    });
  };

  const commit = () => {
    if (count <= 0) return;
    update(d => {
      d.entries[hobby.id] = d.entries[hobby.id] || [];
      d.entries[hobby.id].push({ id: Math.random().toString(36).slice(2,10), date: today, action: "eggs_laid", count, flockId: flock.id, birdType: flock.birdType, created: Date.now() });
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h) { const fl = (h.flocks||[]).find(x=>x.id===flock.id); if (fl) fl.eggBasket = null; }
      return d;
    });
  };

  const reset = () => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobby.id);
      if (h) { const fl = (h.flocks||[]).find(x=>x.id===flock.id); if (fl) fl.eggBasket = null; }
      return d;
    });
  };

  return (
    <div style={{ background: palette.bgAlt, border: `1.5px solid ${palette.line}`, borderRadius: 12, padding: 14 }}>
      {/* Flock header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>{emoji}</span>
            <span style={{ fontWeight: 600, fontSize: 15, color: palette.ink }}>{flock.name}</span>
            {(() => {
              // Detailed badge — shows total + sex split + active broody count.
              // Falls back to legacy "N birds" if the flock hasn't been migrated.
              const sn = sexNames(flock.birdType);
              const f = typeof flock.females === "number" ? flock.females : null;
              const m = typeof flock.males === "number" ? flock.males : null;
              // Active broody count: prefer named-bird flags if present (more
              // accurate), otherwise fall back to the flock-level counter.
              const broodyNamed = (flock.namedBirds || []).filter(b => b.broody && !b.archived).length;
              const broody = broodyNamed > 0 ? broodyNamed : (Number(flock.broodyCount) || 0);
              const parts = [flock.birdType, `${flock.birdCount} bird${flock.birdCount === 1 ? "" : "s"}`];
              if (f !== null && m !== null && (f + m === flock.birdCount) && (f > 0 || m > 0)) {
                // Replace the generic "N birds" with the sex split for clarity
                parts.splice(1, 1, `${f} ${f === 1 ? sn.female : sn.femalePl} · ${m} ${m === 1 ? sn.male : sn.malePl}`);
              }
              if (broody > 0) parts.push(`${broody} broody`);
              return (
                <span style={{ fontSize: 11, color: palette.inkSoft, background: palette.card, padding: "2px 8px", borderRadius: 4 }}>
                  {parts.join(" · ")}
                </span>
              );
            })()}
          </div>
          {flock.startDate && <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 2, marginLeft: 26 }}>Since {flock.startDate}</div>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setModal({ type: "editFlock", hobbyId: hobby.id, flockId: flock.id })} style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, padding: 4 }}><Edit3 size={14}/></button>
        </div>
      </div>

      {/* Egg basket counter */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
        <button onClick={dec} disabled={count === 0} style={{ width: 44, height: 44, borderRadius: 22, fontSize: 22, fontWeight: 700, border: `1.5px solid ${palette.line}`, background: palette.card, cursor: count === 0 ? "default" : "pointer", color: palette.ink, opacity: count === 0 ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 48, fontFamily: FONT_DISPLAY, color: palette.yolk, lineHeight: 1 }}>{count}</div>
          <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 2 }}>{count === 0 ? (todayLogged ? `✓ logged today` : "tap + to collect") : `egg${count===1?"":"s"} so far today`}</div>
        </div>
        <button onClick={inc} style={{ width: 52, height: 52, borderRadius: 26, fontSize: 28, fontWeight: 700, border: `2px solid ${palette.ink}`, background: palette.yolk, cursor: "pointer", color: palette.ink, boxShadow: "2px 2px 0 " + palette.line, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</button>
      </div>

      {count > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button onClick={commit} style={{ flex: 1, padding: "9px", borderRadius: 8, border: `1.5px solid ${palette.ink}`, background: palette.ink, color: palette.bg, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Done — log {count} {flock.birdType.toLowerCase()} egg{count===1?"":"s"}
          </button>
          <button onClick={reset} style={{ padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${palette.line}`, background: "transparent", color: palette.inkSoft, fontFamily: FONT_BODY, fontSize: 12, cursor: "pointer" }}>Clear</button>
        </div>
      )}

      {/* Named birds — optional sub-list. Users with named favorites can
          track them; flocks without named birds just see a small "Name a bird"
          button. Doesn't replace birdCount — that stays the source of truth.
          Archived (e.g. died) birds are filtered out here; they're still
          accessible via the "Manage named birds" modal under "Past birds". */}
      {(() => {
        const namedBirds = (flock.namedBirds || []).filter(b => !b.archived);
        return (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${palette.line}` }}>
            {namedBirds.length > 0 ? (
              <>
                <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 6 }}>
                  Named birds ({namedBirds.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                  {namedBirds.map(b => (
                    <button
                      key={b.id}
                      onClick={() => setModal({ type: "namedBirds", hobbyId: hobby.id, flockId: flock.id })}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "4px 10px", borderRadius: 999,
                        background: palette.card, border: `1.5px solid ${palette.line}`,
                        fontSize: 12, color: palette.ink, cursor: "pointer",
                        fontFamily: FONT_BODY,
                      }}
                    >
                      {b.bandColor && (
                        <span style={{
                          display: "inline-block", width: 10, height: 10, borderRadius: "50%",
                          background: b.bandColor,
                          border: `1px solid ${palette.line}`,
                        }} />
                      )}
                      <span>{b.name}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <button
              onClick={() => setModal({ type: "namedBirds", hobbyId: hobby.id, flockId: flock.id })}
              style={{
                background: "transparent", border: "none",
                color: palette.inkSoft, fontSize: 12, padding: 0, cursor: "pointer",
                fontFamily: FONT_BODY, textDecoration: "underline",
              }}
            >
              {namedBirds.length > 0 ? "Manage named birds" : "+ Name a bird"}
            </button>
          </div>
        );
      })()}
    </div>
  );
}

function MeatChickensSummary({ hobby, entries, update, setModal }) {
  // Push 4b — multi-batch support. Users can have multiple active batches
  // at once (e.g. broilers + turkeys + ducks). Render one card per batch
  // plus a button to hatch another. Empty state retained for fresh hobbies.
  const activeBatches = hobby.currentBatches || [];
  const archivedBatches = hobby.archivedBatches || [];

  // Inverse of finalize: pop the batch from archivedBatches, push it back to
  // currentBatches with endDate cleared, and re-hydrate its entries into
  // data.entries[hobby.id] from the snapshot we stored at finalize time.
  // Behind a confirm prompt so accidental taps don't shuffle data around.
  const restorePastBatch = (batchId) => {
    update((d) => {
      const h = d.hobbies.find((x) => x.id === hobby.id);
      if (!h || !Array.isArray(h.archivedBatches)) return d;
      const idx = h.archivedBatches.findIndex((b) => b.id === batchId);
      if (idx === -1) return d;
      const target = h.archivedBatches[idx];
      const restored = JSON.parse(JSON.stringify(target));
      // Clear finalize-only fields so the batch reads as active again.
      const snapshotEntries = Array.isArray(restored.finalEntries) ? restored.finalEntries : [];
      delete restored.finalEntries;
      restored.endDate = "";
      h.currentBatches = h.currentBatches || [];
      h.currentBatches.push(restored);
      h.archivedBatches.splice(idx, 1);
      // Re-hydrate the entries. We de-dupe by entry id in case a parallel
      // path already promoted some of them back (shouldn't happen, but
      // belt-and-suspenders since data corruption here would be confusing).
      d.entries[hobby.id] = d.entries[hobby.id] || [];
      const existingIds = new Set(d.entries[hobby.id].map(e => e.id).filter(Boolean));
      for (const e of snapshotEntries) {
        if (!e || (e.id && existingIds.has(e.id))) continue;
        d.entries[hobby.id].push(e);
      }
      return d;
    }, { immediate: true });
  };

  // Past batches section — extracted so we can render it in both the
  // "has active batches" path AND the "no active batches" empty-state path.
  // Without this, users who finalize their only batch would see "No active
  // batch" with no way to access their history.
  const pastBatchesSection = archivedBatches.length > 0 && (
    <details style={{ marginTop: 16 }}>
      <summary style={{
        cursor: "pointer", color: palette.inkSoft, fontSize: 13,
        padding: 8, background: palette.bgAlt, borderRadius: 8,
        userSelect: "none", fontWeight: 600,
      }}>
        📦 Past batches ({archivedBatches.length})
      </summary>
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        {archivedBatches
          .slice()
          .sort((a, b) => (b.endDate || b.startDate || "").localeCompare(a.endDate || a.startDate || ""))
          .map((b) => {
            const startedCount = Number(b.startCount) || 0;
            const butchered = (b.butchered || []).reduce((s, x) => s + (Number(x.count) || 0), 0);
            const totalWeight = (b.butchered || []).reduce((s, x) => s + (Number(x.count) || 0) * (Number(x.avgWeight) || 0), 0);
            const deaths = (b.finalEntries || [])
              .filter(e => e.action === "death")
              .reduce((s, e) => s + (Number(e.count) || 1), 0);
            return (
              <div key={b.id} style={{
                padding: "10px 12px",
                background: palette.bgAlt,
                borderRadius: 8,
                fontSize: 13,
                color: palette.ink,
                lineHeight: 1.5,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                  {b.name}{b.birdType && b.birdType !== "Chicken" ? ` · ${b.birdType}` : ""}
                </div>
                <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 4 }}>
                  {fmtDate(b.startDate)}{b.endDate ? ` → ${fmtDate(b.endDate)}` : ""}
                </div>
                <div style={{ fontSize: 12, color: palette.inkSoft }}>
                  {startedCount > 0 && <>Started <strong style={{ color: palette.ink }}>{startedCount}</strong></>}
                  {butchered > 0 && <> · Butchered <strong style={{ color: palette.ink }}>{butchered}</strong></>}
                  {totalWeight > 0 && <> · <strong style={{ color: palette.ink }}>{totalWeight.toFixed(1)} lbs</strong></>}
                  {deaths > 0 && <> · {deaths} lost</>}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const msg = `Restore "${b.name}" to active batches? Any logged entries for this batch will come back too.`;
                      if (typeof window !== "undefined" && window.confirm && !window.confirm(msg)) return;
                      restorePastBatch(b.id);
                    }}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: `1.5px solid ${palette.line}`,
                      background: palette.bg,
                      color: palette.ink,
                      fontFamily: FONT_BODY,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >↩️ Restore to active</button>
                </div>
              </div>
            );
          })}
        <div style={{ fontSize: 11, color: palette.inkSoft, fontStyle: "italic", padding: "6px 4px", lineHeight: 1.5 }}>
          Full records for past batches show up in the Analytics tab (filter to "All-time" to see everything).
        </div>
      </div>
    </details>
  );

  if (activeBatches.length === 0) {
    return (
      <div>
        <div style={{
          background: palette.card, border: `2px dashed ${palette.ink}`, borderRadius: 12,
          padding: 24, textAlign: "center",
        }}>
          <Bird size={32} color={palette.ink} strokeWidth={1.5} style={{ marginBottom: 10 }} />
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, marginBottom: 6 }}>No active batch</div>
          <div style={{ color: palette.inkSoft, marginBottom: 14, fontSize: 14 }}>
            {archivedBatches.length > 0
              ? "All your batches have been finalized. Start a new one when chicks arrive — or peek at past batches below."
              : "Start a new batch when your chicks arrive."}
          </div>
          <Btn variant="accent" onClick={() => setModal({ type: "hatchBatch" })}>
            🐣 Hatch new batch
          </Btn>
        </div>
        {pastBatchesSection}
      </div>
    );
  }

  return (
    <div>
      {activeBatches.map((batch) => {
        const days = Math.floor((Date.now() - new Date(batch.startDate).getTime()) / (1000 * 60 * 60 * 24));
        const weeks = (days / 7).toFixed(1);
        const deaths = entries
          .filter((e) => e.action === "death" && e.batchId === batch.id)
          .reduce((s, e) => s + (Number(e.count) || 1), 0);
        const butcheredCount = (batch.butchered || []).reduce((s, x) => s + (Number(x.count) || 0), 0);
        const softCulledCount = entries
          .filter((e) => e.action === "note" && e.batchId === batch.id && Number(e.cullCount) > 0)
          .reduce((s, e) => s + Number(e.cullCount), 0);
        const alive = Math.max(0, batch.startCount - deaths - butcheredCount - softCulledCount);
        return (
          <div
            key={batch.id}
            onClick={() => setModal({ type: "editBatch", hobbyId: hobby.id, batchId: batch.id })}
            style={{
              background: palette.ink, color: palette.bg, borderRadius: 12, padding: 14,
              marginBottom: 10, cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Active Batch · {batch.name}{batch.birdType && batch.birdType !== "Chicken" ? ` · ${batch.birdType}` : ""}</span>
              <Edit3 size={12} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 30, color: palette.yolk, lineHeight: 1 }}>{alive}</div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>
                birds · {weeks} weeks · started {fmtDate(batch.startDate)}
                {batch.chickCost > 0 && <> · {fmtMoney(batch.chickCost)}</>}
              </div>
            </div>
          </div>
        );
      })}
      {/* Hatch-another CTA — sits below the active batch cards so multi-batch
          users can easily start another. Uses ghost styling so it doesn't
          compete visually with the active batch cards. */}
      <div style={{ marginTop: 4, marginBottom: 4 }}>
        <Btn variant="ghost" onClick={() => setModal({ type: "hatchBatch" })}>
          🐣 Hatch another batch
        </Btn>
      </div>

      {pastBatchesSection}
    </div>
  );
}

// ============ ACTIVITY ROW ============
function ActivityRow({ entry, hobbyType, onDelete, onEdit }) {
  const labels = {
    watered: "Watered", planted: "Planted", harvested: "Harvested", issue: "Issue Reported",
    fed: "Fed", free_range: "Free range", eggs: "Eggs collected", eggs_laid: "Eggs collected",
    bedding: "Bedding",
    death: "Death reported", note: "Note", butcher: "Butchered",
    sold_eggs: "Eggs sold", infrastructure: "Infrastructure",
    move_tractor: "Moved chicken tractor",
  };
  const icons = {
    watered: Droplet, fertilized: Leaf, planted: Sprout, harvested: Scissors, issue: AlertTriangle,
    fed: Sun, free_range: Bird, eggs: Egg, eggs_laid: Egg, bedding: Archive, death: Skull,
    butcher: Snowflake, note: NotebookPen, sold_eggs: DollarSign, infrastructure: Hammer,
    move_tractor: Truck,
  };
  const Icon = icons[entry.action] || Edit3;
  let detail = "";
  switch (entry.action) {
    case "watered": detail = entry.gallons ? `${entry.gallons} gal` : (entry.amount || ""); break;
    case "fertilized": {
      const typeLabels = {
        compost: "Compost", manure: "Manure", granular: "Granular",
        liquid: "Liquid feed", foliar: "Foliar spray",
        amendment: "Amendment", cover_crop: "Cover crop", other: "Fertilizer",
      };
      const parts = [typeLabels[entry.fertilizerType] || "Fertilizer"];
      if (entry.product) parts.push(entry.product);
      if (entry.amount) parts.push(entry.amount);
      if (entry.bed) parts.push(entry.bed);
      if (entry.cost && Number(entry.cost) > 0) parts.push(fmtMoney(entry.cost));
      detail = parts.filter(Boolean).join(" · ");
      break;
    }
    case "planted": detail = `${entry.plant || ""} ${entry.quantity ? "× " + entry.quantity : ""}`.trim(); break;
    case "harvested": detail = `${entry.plant || ""} · ${entry.quantity || 0} ${entry.unit || "lbs"}`; break;
    case "fed": {
      // Display in whichever unit was logged. Legacy entries have just
      // `lbs`; newer entries with cups have feedUnit="cups" + feedAmount.
      let amt, unit;
      if (entry.feedUnit === "cups") {
        amt = entry.feedAmount || 0;
        unit = "cups";
      } else {
        amt = entry.lbs || entry.feedAmount || 0;
        unit = "lbs";
      }
      detail = `${amt} ${unit} · ${fmtMoney(entry.cost)}`;
      break;
    }
    case "eggs": detail = `${entry.count || 0} eggs`; break;
    case "eggs_laid": detail = `${entry.count || 0} eggs`; break;
    case "sold_eggs": {
      // Robust derivation for all known sold_eggs entry shapes — older entries
      // and ones where the save-time derivation didn't run may not have
      // `count` or `pricePerDozen` set. Derive both from whichever fields
      // are present so the recent-activity row always shows real numbers.
      // Matches deriveSoldEggsRevenue in Sales.jsx so both displays agree.
      let totalEggs = Number(entry.count) || 0;
      let pricePerDozen = Number(entry.pricePerDozen) || 0;
      let revenue = 0;
      if (totalEggs > 0 && pricePerDozen > 0) {
        revenue = (totalEggs / 12) * pricePerDozen;
      } else if (Number(entry.unitQty) > 0 && Number(entry.pricePerUnit) > 0) {
        const unitToCount = {
          single: 1, half_dozen: 6, dozen: 12, eighteen: 18, flat: 30,
          custom: Number(entry.customEggsPerUnit) || 0,
        };
        const eggsPerUnit = unitToCount[entry.unit] || 12;
        totalEggs = Number(entry.unitQty) * eggsPerUnit;
        revenue = Number(entry.unitQty) * Number(entry.pricePerUnit);
        if (totalEggs > 0) pricePerDozen = revenue / (totalEggs / 12);
      } else if (Number(entry.pricePerUnit) > 0 && totalEggs > 0) {
        pricePerDozen = Number(entry.pricePerUnit);
        revenue = (totalEggs / 12) * pricePerDozen;
      } else if (Number(entry.totalRevenue) > 0) {
        revenue = Number(entry.totalRevenue);
        if (totalEggs > 0) pricePerDozen = revenue / (totalEggs / 12);
      }
      detail = `${totalEggs || 0} eggs · ${fmtMoney(revenue)} @ ${fmtMoney(pricePerDozen)}/dz`;
      break;
    }
    case "infrastructure": detail = `${entry.item || "item"} · ${fmtMoney(entry.cost)}`; break;
    case "bedding": {
      const t = entry.changeType || "";
      const parts = [t];
      // Only show cu ft if it was actually entered (skipped for power wash etc)
      if (entry.cuft && Number(entry.cuft) > 0) parts.push(`${entry.cuft} cu ft`);
      if (entry.cost && Number(entry.cost) > 0) parts.push(fmtMoney(entry.cost));
      if (entry.note) parts.push(entry.note.length > 30 ? entry.note.slice(0,30)+"…" : entry.note);
      detail = parts.filter(Boolean).join(" · ");
      break;
    }
    case "death": {
      const n = Number(entry.count) || 1;
      detail = `${n > 1 ? n + " birds · " : ""}${entry.cause || "cause unknown"}`;
      break;
    }
    case "issue": detail = `${entry.issueType}${entry.detail ? ": " + entry.detail : ""}${entry.plant ? " on " + entry.plant : ""}`; break;
    case "free_range": detail = entry.note || ""; break;
    case "move_tractor": {
      const parts = [];
      if (entry.distanceFeet > 0) parts.push(`${entry.distanceFeet} ft`);
      if (entry.note) parts.push(entry.note);
      detail = parts.join(" · ");
      break;
    }
    case "butcher": detail = `${entry.count || 0} birds · avg ${entry.avgWeight || 0} lbs`; break;
    case "broody": {
      const status = entry.broodyStatus === "ended" ? "broke / hatched" : "went broody";
      const parts = [];
      if (entry.namedBirdName) parts.push(entry.namedBirdName);
      parts.push(status);
      if (entry.note) parts.push(entry.note.length > 40 ? entry.note.slice(0, 40) + "…" : entry.note);
      detail = parts.join(" · ");
      break;
    }
    case "note": detail = entry.note ? (entry.note.length > 50 ? entry.note.slice(0, 50) + "…" : entry.note) : ""; break;
    default: detail = entry.note || "";
  }
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
      background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 10,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8, background: palette.bgAlt,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Icon size={18} strokeWidth={1.8} color={palette.ink} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: palette.ink }}>{labels[entry.action] || entry.action}</div>
        <div style={{ fontSize: 12, color: palette.inkSoft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {fmtDate(entry.date)} {detail && "· " + detail}
        </div>
        {entry.weather && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            marginTop: 4, fontSize: 11, color: palette.feather,
            padding: "2px 6px", background: palette.bgAlt, borderRadius: 4,
          }}>
            {entry.weather.precipIn > 0 ? <CloudRain size={11} /> : <Sun size={11} />}
            {formatWeatherI18n(entry.weather)}
          </div>
        )}
      </div>
      {(() => {
        const photos = getEntryPhotos(entry);
        if (photos.length === 0) return null;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <EntryPhotoThumb path={photos[0]} />
            {photos.length > 1 && (
              <span style={{ fontSize: 10, color: palette.inkSoft, fontWeight: 600 }}>
                +{photos.length - 1}
              </span>
            )}
          </div>
        );
      })()}
      {onEdit && (
        <button
          onClick={onEdit}
          style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, padding: 4 }}
          title="Edit"
        >
          <Edit3 size={16} />
        </button>
      )}
      <button
        onClick={onDelete}
        style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, padding: 4 }}
        title="Delete"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

// Small async-loaded thumbnail. Tappable: opens a fullscreen lightbox.
function EntryPhotoThumb({ path, size = 40 }) {
  const [url, setUrl] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPhotoUrl(path).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [path]);

  if (!url) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 6, background: palette.bgAlt,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        border: `1px solid ${palette.line}`,
      }}>
        <ImageIcon size={Math.round(size * 0.4)} color={palette.inkSoft} />
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          width: size, height: size, borderRadius: 6, padding: 0,
          background: `url(${url}) center/cover`,
          border: `1px solid ${palette.line}`,
          cursor: "pointer", flexShrink: 0,
        }}
        title="View photo"
      />
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 200, padding: 20, cursor: "pointer",
          }}
        >
          <img
            src={url}
            alt=""
            style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }}
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              // Signed URLs expire after 1 hour. If the photo failed to load,
              // replace with a placeholder so the user doesn't see a broken icon.
              e.target.style.display = "none";
              const placeholder = e.target.nextSibling;
              if (placeholder && placeholder.dataset?.placeholder) {
                placeholder.style.display = "flex";
              }
            }}
          />
          <div
            data-placeholder="true"
            style={{
              display: "none", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 8, padding: 32, background: "rgba(255,255,255,0.05)", borderRadius: 8,
              color: "rgba(255,255,255,0.7)", fontSize: 14, fontFamily: FONT_BODY,
              minWidth: 200, minHeight: 200,
            }}
          >
            <ImageIcon size={32} color="rgba(255,255,255,0.5)" />
            <div>Photo unavailable</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>Try refreshing the page</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{
              position: "absolute", top: 16, right: 16,
              background: "rgba(255,255,255,0.9)", border: "none",
              borderRadius: 20, width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
        </div>
      )}
    </>
  );
}

// ============ ANALYTICS PAGE ============
function AnalyticsPage({ hobby, data, seasonFilter, setSeasonFilter, dateFilter, setDateFilter, customStart, setCustomStart, customEnd, setCustomEnd, spouseMode }) {
  const [showShare, setShowShare] = useState(false);
  // Defensive: hobby may be undefined for one render frame during transitions
  if (!hobby) return <EmptyState text="Loading…" />;
  // Garden uses explicit user-created seasons; other hobbies use date ranges.
  if (hobby.type === "garden") {
    return <GardenAnalyticsPage hobby={hobby} data={data} seasonFilter={seasonFilter} setSeasonFilter={setSeasonFilter} spouseMode={spouseMode} />;
  }

  // Resolve dateFilter → {start, end} as ISO date strings (inclusive). null
  // bound means "open-ended" on that side.
  const range = resolveDateRange(dateFilter, customStart, customEnd);
  const allEntries = data.entries[hobby.id] || [];
  const entries = filterByDateRange(allEntries, range, (e) => e.date);

  return (
    <div>
      {showShare && <ShareStatsModal hobby={hobby} allEntries={data.entries[hobby.id] || []} data={data} onClose={() => setShowShare(false)} />}
      {/* DATE RANGE FILTER + SHARE */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6 }}>
          <div style={{ fontSize: 10, letterSpacing: 1, color: palette.inkSoft, textTransform: "uppercase", fontWeight: 600 }}>
            View
          </div>
          <button onClick={() => setShowShare(true)} style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:8,border:`1.5px solid ${palette.line}`,background:palette.card,fontFamily:FONT_BODY,fontWeight:600,fontSize:12,color:palette.ink,cursor:"pointer" }}>
            <Share2 size={13} /> Share stats
          </button>
        </div>
        <DateRangeFilter
          value={dateFilter}
          onChange={setDateFilter}
          customStart={customStart}
          setCustomStart={setCustomStart}
          customEnd={customEnd}
          setCustomEnd={setCustomEnd}
        />
      </div>

      {hobby.type === "egg_layers" && <EggLayersAnalytics hobby={hobby} entries={entries} spouseMode={spouseMode} />}
      {hobby.type === "meat_chickens" && <MeatChickensAnalytics hobby={hobby} entries={entries} dateRange={range} spouseMode={spouseMode} />}
    </div>
  );
}

// ============================================================================
// DATE RANGE FILTER — shared UI for per-hobby analytics
// ----------------------------------------------------------------------------
// Renders pill buttons for All time / 7d / 30d / 60d / 90d / Custom. When
// Custom is selected, exposes two date inputs. Parent owns the state; this is
// a controlled component.
// ============================================================================
const DATE_FILTER_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "7d",  label: "Past 7 days" },
  { value: "30d", label: "Past 30 days" },
  { value: "60d", label: "Past 60 days" },
  { value: "90d", label: "Past 90 days" },
  { value: "custom", label: "Custom" },
];

function DateRangeFilter({ value, onChange, customStart, setCustomStart, customEnd, setCustomEnd }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {DATE_FILTER_OPTIONS.map((opt) => (
          <Btn key={opt.value} small variant={value === opt.value ? "primary" : "ghost"} onClick={() => onChange(opt.value)}>
            {opt.label}
          </Btn>
        ))}
      </div>
      {value === "custom" && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontSize: 12, color: palette.inkSoft, fontFamily: FONT_BODY }}>
            From{" "}
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              style={{ padding: "6px 8px", borderRadius: 6, border: `1.5px solid ${palette.line}`, background: palette.card, fontFamily: FONT_BODY, fontSize: 13, color: palette.ink }}
            />
          </label>
          <label style={{ fontSize: 12, color: palette.inkSoft, fontFamily: FONT_BODY }}>
            To{" "}
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              style={{ padding: "6px 8px", borderRadius: 6, border: `1.5px solid ${palette.line}`, background: palette.card, fontFamily: FONT_BODY, fontSize: 13, color: palette.ink }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

// Convert a dateFilter value + optional custom dates into a {start, end} range
// with ISO date strings (YYYY-MM-DD). Either bound may be "" meaning unbounded.
// "all" returns {start: "", end: ""}.
function resolveDateRange(dateFilter, customStart, customEnd) {
  if (dateFilter === "all") return { start: "", end: "" };
  if (dateFilter === "custom") return { start: customStart || "", end: customEnd || "" };
  const days = { "7d": 7, "30d": 30, "60d": 60, "90d": 90 }[dateFilter];
  if (!days) return { start: "", end: "" };
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { start: localDateStr(start), end: localDateStr(end) };
}

// Filter an array of records by the given date range using the supplied
// accessor. Range bounds are inclusive. Records with no/invalid date pass
// through when both bounds are empty, and are excluded otherwise.
function filterByDateRange(records, range, getDate) {
  if (!range || (!range.start && !range.end)) return records;
  return (records || []).filter((r) => {
    const d = getDate(r);
    if (!d) return false;
    if (range.start && d < range.start) return false;
    if (range.end && d > range.end) return false;
    return true;
  });
}

// Build a human-readable label for the current date range. Used in chart titles.
function dateRangeLabel(range) {
  if (!range || (!range.start && !range.end)) return "(all-time)";
  if (range.start && range.end) return `(${range.start} → ${range.end})`;
  if (range.start) return `(since ${range.start})`;
  return `(through ${range.end})`;
}

function GardenAnalyticsPage({ hobby, data, seasonFilter, setSeasonFilter, spouseMode }) {
  const [showShare, setShowShare] = useState(false);
  if (!hobby) return <EmptyState text="Loading…" />;
  // Build season list: archived + (currently active, if any)
  const archived = hobby.archivedSeasons || [];
  const current = hobby.currentSeason;
  const allSeasons = [
    ...archived.map((s) => ({ id: s.id, name: s.name, archived: true })),
    ...(current ? [{ id: current.id, name: current.name + " (active)", archived: false }] : []),
  ];

  // Determine which entries to analyze based on filter
  let analyticsEntries = [];
  let seasonName = "All-time";
  if (seasonFilter === "all") {
    // Combine all archived season entries + current season entries
    analyticsEntries = [
      ...archived.flatMap((s) => s.finalEntries || []),
      ...(data.entries.garden || []),
    ];
  } else {
    // Find that specific season
    const archivedMatch = archived.find((s) => s.id === seasonFilter);
    if (archivedMatch) {
      analyticsEntries = archivedMatch.finalEntries || [];
      seasonName = archivedMatch.name;
    } else if (current && current.id === seasonFilter) {
      analyticsEntries = (data.entries.garden || []).filter((e) => e.seasonId === current.id);
      seasonName = current.name + " (active)";
    }
  }

  return (
    <div>
      {showShare && <ShareStatsModal hobby={hobby} allEntries={data.entries.garden || []} data={data} onClose={() => setShowShare(false)} />}
      {/* SEASON FILTER + SHARE */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6 }}>
          <div style={{ fontSize: 10, letterSpacing: 1, color: palette.inkSoft, textTransform: "uppercase", fontWeight: 600 }}>
            View
          </div>
          <button onClick={() => setShowShare(true)} style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:8,border:`1.5px solid ${palette.line}`,background:palette.card,fontFamily:FONT_BODY,fontWeight:600,fontSize:12,color:palette.ink,cursor:"pointer" }}>
            <Share2 size={13} /> Share stats
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn small variant={seasonFilter === "all" ? "primary" : "ghost"} onClick={() => setSeasonFilter("all")}>
            All-time
          </Btn>
          {allSeasons.map((s) => (
            <Btn key={s.id} small variant={seasonFilter === s.id ? "primary" : "ghost"} onClick={() => setSeasonFilter(s.id)}>
              {s.name}
            </Btn>
          ))}
        </div>
      </div>

      {allSeasons.length === 0 && !analyticsEntries.length && (
        <EmptyState text="No garden seasons yet. Start one from the Home page." />
      )}

      <GardenAnalytics entries={analyticsEntries} data={data} seasonName={seasonName} spouseMode={spouseMode} />
    </div>
  );
}

function GardenAnalytics({ entries, data, seasonName, spouseMode }) {
  const harvests = entries.filter((e) => e.action === "harvested");
  const totalHarvestRaw = harvests.reduce((s, e) => s + (Number(e.quantity) || 0), 0);
  const totalHarvest = spouseProd(totalHarvestRaw, spouseMode);
  const totalCostRaw = entries.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const totalCost = spouseCost(totalCostRaw, spouseMode);
  const waterings = entries.filter((e) => e.action === "watered").length;
  const fertilizations = entries.filter((e) => e.action === "fertilized").length;
  const plantings = entries.filter((e) => e.action === "planted").length;

  // by-plant aggregate
  const byPlant = {};
  harvests.forEach((e) => {
    const p = e.plant || "Unknown";
    byPlant[p] = (byPlant[p] || 0) + (Number(e.quantity) || 0);
  });
  const plantData = Object.entries(byPlant).map(([name, value]) => ({ name, value }));

  const issues = entries.filter((e) => e.action === "issue");
  const issueTypes = {};
  issues.forEach((e) => { issueTypes[e.issueType || "other"] = (issueTypes[e.issueType || "other"] || 0) + 1; });

  if (entries.length === 0) {
    return <EmptyState text={`No entries in ${seasonName || "this view"}.`} />;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Plantings" value={plantings} accent={palette.leaf} />
        <StatCard label="Total Harvest" value={totalHarvest.toFixed(1)} sub="lbs / units" accent={palette.leaf} />
        <StatCard label="Total Cost" value={fmtMoney(totalCost)} accent={palette.accent} />
        <StatCard label="Waterings" value={waterings} accent="#3F7CAC" />
        {fertilizations > 0 && <StatCard label="Fertilizations" value={fertilizations} accent={palette.leafSoft || "#A8C078"} />}
      </div>

      {plantData.length > 0 && (
        <ChartCard title="Harvest by crop">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={plantData}>
              <XAxis dataKey="name" stroke={palette.inkSoft} fontSize={11} />
              <YAxis stroke={palette.inkSoft} fontSize={11} />
              <Tooltip contentStyle={{ background: palette.card, border: `1.5px solid ${palette.ink}`, borderRadius: 8 }} />
              <Bar dataKey="value" fill={palette.leaf} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {issues.length > 0 && (
        <ChartCard title={`Issues reported (${issues.length})`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(issueTypes).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: palette.bgAlt, borderRadius: 6 }}>
                <span style={{ textTransform: "capitalize" }}>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}

function EggLayersAnalytics({ hobby, entries, spouseMode }) {
  if (!hobby) return <EmptyState text="Loading…" />;
  // Count both "eggs" (manual quick-tile) and "eggs_laid" (egg basket commits)
  const eggs = entries.filter((e) => e.action === "eggs" || e.action === "eggs_laid");
  const feeds = entries.filter((e) => e.action === "fed");
  const beddings = entries.filter((e) => e.action === "bedding");
  const deaths = entries.filter((e) => e.action === "death");
  const totalDeathCount = deaths.reduce((s, e) => s + (Number(e.count) || 1), 0);
  const infra = entries.filter((e) => e.action === "infrastructure");

  const totalEggsRaw = eggs.reduce((s, e) => s + (Number(e.count) || 0), 0);
  const totalEggs = spouseProd(totalEggsRaw, spouseMode);
  const feedCostRaw = feeds.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const beddingCostRaw = beddings.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const infraCostRaw = infra.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const feedCost = spouseCost(feedCostRaw, spouseMode);
  const beddingCost = spouseCost(beddingCostRaw, spouseMode);
  const infraCost = spouseCost(infraCostRaw, spouseMode);
  const totalCost = feedCost + beddingCost + infraCost;
  const costPerEgg = totalEggs > 0 ? totalCost / totalEggs : 0;
  const costPerDozen = costPerEgg * 12;
  const flocks = hobby.flocks || [];
  const totalBirds = flocks.reduce((s, f) => s + (f.birdCount || 0), 0);
  const eggsPerHen = totalBirds > 0 ? (totalEggs / totalBirds).toFixed(1) : "—";

  // Chicken tractor: total feet moved across all logged moves. Per-entry
  // distanceFeet preserves history (changes to the default don't retroactively
  // recompute). Only surface the stat once the user has logged at least one
  // move, so the analytics page stays clean for non-tractor flocks.
  const tractorMoves = entries.filter(e => e.action === "move_tractor");
  const tractorFeet = tractorMoves.reduce((s, e) => s + (Number(e.distanceFeet) || 0), 0);
  const tractorMoveCount = tractorMoves.length;

  // egg trend
  const byDate = {};
  eggs.forEach((e) => { byDate[e.date] = (byDate[e.date] || 0) + (Number(e.count) || 0); });
  const eggTrend = Object.entries(byDate).map(([date, count]) => ({ date: date.slice(5), count })).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Total Eggs Laid" value={totalEggs} accent={palette.yolk} />
        <StatCard label="Cost / Egg" value={fmtMoney(costPerEgg)} sub={`${fmtMoney(costPerDozen)}/dozen`} accent={palette.accent} />
        <StatCard label="Eggs / Hen" value={eggsPerHen} sub="lifetime" accent={palette.leaf} />
        {totalDeathCount > 0 && <StatCard label="Deaths" value={totalDeathCount} accent={palette.ink} />}
        {tractorFeet > 0 && (
          <StatCard
            label="🚜 Tractor moved"
            value={fmtTractorDistance(tractorFeet)}
            sub={tractorFunFact(tractorFeet, "eggLayersStats") || `${tractorMoveCount} move${tractorMoveCount === 1 ? "" : "s"}`}
            accent={palette.feather}
          />
        )}
      </div>

      <ChartCard title="📊 Cost breakdown">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <CostRow label="Feed" value={feedCost} total={totalCost} />
          <CostRow label="Bedding" value={beddingCost} total={totalCost} />
          {infraCost > 0 && <CostRow label="Infrastructure" value={infraCost} total={totalCost} />}
          <div style={{
            display: "flex", justifyContent: "space-between", padding: "10px 12px",
            background: palette.ink, color: palette.bg, borderRadius: 6, marginTop: 4, fontWeight: 600,
          }}>
            <span>Total</span>
            <span>{fmtMoney(totalCost)}</span>
          </div>
        </div>
      </ChartCard>

      {eggTrend.length > 0 && (
        <ChartCard title="Egg production">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={eggTrend}>
              <XAxis dataKey="date" stroke={palette.inkSoft} fontSize={11} />
              <YAxis stroke={palette.inkSoft} fontSize={11} />
              <Tooltip contentStyle={{ background: palette.card, border: `1.5px solid ${palette.ink}`, borderRadius: 8 }} />
              <Line type="monotone" dataKey="count" stroke={palette.yolk} strokeWidth={3} dot={{ fill: palette.accent, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {infra.length > 0 && (
        <ChartCard title={`🔨 Infrastructure (${infra.length})`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {infra.map((e) => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: palette.bgAlt, borderRadius: 6, fontSize: 13 }}>
                <span>{e.item || "Item"} <span style={{ color: palette.inkSoft, fontSize: 11 }}>· {fmtDate(e.date)}</span></span>
                <strong>{fmtMoney(e.cost)}</strong>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* Per-flock breakdown */}
      {(hobby.flocks || []).length > 1 && (
        <ChartCard title="Per flock breakdown">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(hobby.flocks || []).map(fl => {
              const flockEggs = eggs.filter(e => e.flockId === fl.id).reduce((s,e)=>s+(Number(e.count)||0),0);
              const flockFeedCost = feeds.filter(e => e.flockId === fl.id).reduce((s,e)=>s+(Number(e.cost)||0),0);
              const flockBeddingCost = beddings.filter(e => e.flockId === fl.id).reduce((s,e)=>s+(Number(e.cost)||0),0);
              const flockDeaths = deaths.filter(e => e.flockId === fl.id).reduce((s,e)=>s+(Number(e.count)||1),0);
              const flockTotalCost = flockFeedCost + flockBeddingCost;
              const flockCostPerEgg = flockEggs > 0 ? flockTotalCost / flockEggs : 0;
              const birdEmoji = { Chicken:"🐔", Duck:"🦆", Turkey:"🦃", Quail:"🐦", Goose:"🪿", Guinea:"🐦", Peafowl:"🦚", Other:"🐣" };
              return (
                <div key={fl.id} style={{ padding:"12px 14px",background:palette.bgAlt,borderRadius:8 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
                    <div>
                      <strong>{birdEmoji[fl.birdType]||"🐣"} {fl.name}</strong>
                      <div style={{ fontSize:12,color:palette.inkSoft }}>{fl.birdType} · {fl.birdCount} birds</div>
                    </div>
                    <div style={{ fontSize:18,fontWeight:700,color:palette.yolk,fontFamily:FONT_DISPLAY }}>
                      {flockEggs}
                      <span style={{ fontSize:11,color:palette.inkSoft,fontWeight:500,marginLeft:4 }}>eggs</span>
                    </div>
                  </div>
                  {(flockTotalCost > 0 || flockDeaths > 0) && (
                    <div style={{ display:"flex",gap:12,fontSize:11,color:palette.inkSoft,paddingTop:6,borderTop:`1px solid ${palette.line}` }}>
                      {flockTotalCost > 0 && <span>💰 {fmtMoney(flockTotalCost)} in costs</span>}
                      {flockEggs > 0 && flockTotalCost > 0 && <span>{fmtMoney(flockCostPerEgg)}/egg</span>}
                      {flockDeaths > 0 && <span>💀 {flockDeaths} death{flockDeaths===1?"":"s"}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}
      {/* Revenue nudge */}
      <div style={{ padding: "10px 14px", background: palette.yolkSoft, borderRadius: 8, fontSize: 13, color: palette.ink, lineHeight: 1.5, marginTop: 8 }}>
        💰 Track egg sales revenue in the <strong>Sales tab</strong> — log by bird type, eating vs hatching, customer, and more.
      </div>

      {entries.length === 0 && <EmptyState text="No egg layer entries yet for this view." />}
    </div>
  );
}

function CostRow({ label, value, total }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: palette.bgAlt, borderRadius: 6, fontSize: 13 }}>
      <span>{label} <span style={{ color: palette.inkSoft, fontSize: 11 }}>({pct.toFixed(0)}%)</span></span>
      <strong>{fmtMoney(value)}</strong>
    </div>
  );
}

function MeatChickensAnalytics({ hobby, entries, dateRange, spouseMode }) {
  // Defensive: hobby may be undefined for one render frame during hobby
  // transitions (e.g. switching activeHobby while still on the analytics tab).
  if (!hobby) return <EmptyState text="Loading…" />;

  // Combine ALL active batches (currentBatches[]) + archived batches.
  // Push 4b — users can have multiple active batches at once, so we walk
  // the array instead of pulling a single currentBatch.
  const activeBatches = hobby.currentBatches || [];
  const archived = hobby.archivedBatches || [];

  // Build a unified batch list, then filter by date-range OVERLAP rather
  // than by startDate. The previous logic compared startDate against the
  // window, which would silently drop an active batch from "Past 7 days"
  // just because it was started 35 days ago — even though that batch's
  // recent feed/death entries were squarely inside the window. Now: a batch
  // is included if any part of its lifetime overlaps the window.
  let batches = [...archived];
  activeBatches.forEach((b) => {
    batches.push({
      ...b,
      isActive: true,
      butchered: b.butchered || [],
      finalEntries: entries.filter((e) => e.batchId === b.id),
    });
  });

  // Overlap filter: keep a batch if its [startDate, endDate-or-today] range
  // intersects the requested [range.start, range.end] window. Active batches
  // (no endDate) extend to today. No-range filters (all-time) include
  // everything.
  if (dateRange && (dateRange.start || dateRange.end)) {
    const todayIso = todayStr();
    batches = batches.filter(b => {
      const bStart = b.startDate || todayIso;
      const bEnd = b.endDate || todayIso; // active batches extend to today
      if (dateRange.start && bEnd < dateRange.start) return false; // batch ended before window
      if (dateRange.end && bStart > dateRange.end) return false;   // batch started after window
      return true;
    });
  }

  if (batches.length === 0) {
    return <EmptyState text="No meat chicken batches in this view." />;
  }

  // Aggregate stats
  let totalStart = 0, totalDeaths = 0, totalButchered = 0, totalFeedCost = 0, totalInfraCost = 0, totalChickCost = 0, totalWeight = 0;
  const deathCauses = {};
  const deathAges = []; // weeks at death

  batches.forEach((b) => {
    totalStart += b.startCount || 0;
    totalChickCost += Number(b.chickCost) || 0;
    const bEntries = b.finalEntries || [];
    bEntries.forEach((e) => {
      if (e.action === "fed") totalFeedCost += Number(e.cost) || 0;
      if (e.action === "infrastructure") totalInfraCost += Number(e.cost) || 0;
      if (e.action === "death") {
        const n = Number(e.count) || 1;
        totalDeaths += n;
        deathCauses[e.cause || "unknown"] = (deathCauses[e.cause || "unknown"] || 0) + n;
        if (e.date && b.startDate) {
          const days = (parseLocalDate(e.date) - parseLocalDate(b.startDate)) / (1000 * 60 * 60 * 24);
          // Push the age once per dead bird so the histogram and average reflect each death
          for (let i = 0; i < n; i++) deathAges.push(days / 7);
        }
      }
    });
    (b.butchered || []).forEach((bu) => {
      totalButchered += bu.count || 0;
      totalWeight += (bu.count || 0) * (bu.avgWeight || 0);
    });
  });

  const totalCostRaw = totalFeedCost + totalInfraCost + totalChickCost;
  const totalCost = spouseCost(totalCostRaw, spouseMode);
  const adjFeedCost = spouseCost(totalFeedCost, spouseMode);
  const adjInfraCost = spouseCost(totalInfraCost, spouseMode);
  const adjChickCost = spouseCost(totalChickCost, spouseMode);
  const adjButchered = spouseProd(totalButchered, spouseMode);
  const mortalityRate = totalStart > 0 ? ((totalDeaths / totalStart) * 100).toFixed(1) : 0;
  const avgWeight = totalButchered > 0 ? (totalWeight / totalButchered).toFixed(2) : 0;
  const costPerBird = adjButchered > 0 ? (totalCost / adjButchered).toFixed(2) : "—";

  // Feed Conversion Ratio: lbs feed consumed / lbs meat produced.
  // FCR is defined in pounds, so cup-logged entries are excluded — when
  // someone logs in cups, FCR shows "—" (correct since the calculation
  // is unit-specific).
  let totalFeedLbs = 0;
  let totalFeedCups = 0;
  batches.forEach(b => {
    const bEntries = entries.filter(e => e.batchId === b.id && e.action === "fed");
    bEntries.forEach(e => {
      // Per-entry feedUnit was added when we introduced the cups option.
      // Legacy entries don't have feedUnit and store amount in `lbs` —
      // treat those as lbs by default.
      if (e.feedUnit === "cups") {
        totalFeedCups += Number(e.feedAmount) || 0;
      } else {
        totalFeedLbs += Number(e.lbs) || Number(e.feedAmount) || 0;
      }
    });
  });
  const totalMeatLbs = totalWeight;
  const fcr = totalFeedLbs > 0 && totalMeatLbs > 0 ? (totalFeedLbs / totalMeatLbs).toFixed(2) : "—";
  const leadingCause = Object.entries(deathCauses).sort((a, b) => b[1] - a[1])[0];
  const avgDeathAge = deathAges.length > 0 ? (deathAges.reduce((a, b) => a + b, 0) / deathAges.length).toFixed(1) : null;

  // distribution of death age in weeks (rounded)
  const ageBuckets = {};
  deathAges.forEach((w) => {
    const bucket = Math.floor(w);
    ageBuckets[bucket] = (ageBuckets[bucket] || 0) + 1;
  });
  const ageData = Object.entries(ageBuckets).map(([w, count]) => ({
    week: `${w}w`,
    count,
    // Guard against div-by-zero in case ageBuckets ever populates from a path
    // that doesn't increment totalDeaths in sync (e.g. data migration edge case)
    pct: totalDeaths > 0 ? ((count / totalDeaths) * 100).toFixed(0) : "0",
  })).sort((a, b) => parseInt(a.week) - parseInt(b.week));

  // Chicken tractor: sum distanceFeet across all move_tractor entries.
  // We pull from TWO sources to avoid silently dropping entries:
  //   1. Entries tagged with a batchId — found on each batch's finalEntries
  //      (active batches' entries are date-filtered; archived batches keep
  //      their entries snapshotted from finalize time)
  //   2. Untagged move_tractor entries — if the user logged a move while
  //      they had 0 batches active (or 2+ and the picker wasn't shown), the
  //      entry exists but has no batchId. Counting these from the raw
  //      `entries` list ensures they still show in stats.
  let tractorFeet = 0;
  let tractorMoveCount = 0;
  const countedEntryIds = new Set();
  batches.forEach(b => {
    const bEntries = b.finalEntries || entries.filter(e => e.batchId === b.id);
    bEntries.forEach(e => {
      if (e.action === "move_tractor" && !countedEntryIds.has(e.id)) {
        tractorFeet += Number(e.distanceFeet) || 0;
        tractorMoveCount++;
        countedEntryIds.add(e.id);
      }
    });
  });
  // Second pass: any move_tractor entries from the date-filtered list that
  // didn't get counted via a batch (no batchId, or batchId pointing at a
  // batch that was filtered out of the date range).
  entries.forEach(e => {
    if (e.action === "move_tractor" && !countedEntryIds.has(e.id)) {
      tractorFeet += Number(e.distanceFeet) || 0;
      tractorMoveCount++;
      countedEntryIds.add(e.id);
    }
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Total Birds Started" value={totalStart} accent={palette.feather} />
        <StatCard label="Total Butchered" value={adjButchered} accent={palette.ink} />
        <StatCard label="Mortality Rate" value={`${mortalityRate}%`} sub={`${totalDeaths} deaths`} accent={palette.accent} />
        <StatCard label="Avg Final Weight" value={`${avgWeight} lbs`} accent={palette.leaf} />
        {fcr !== "—" && <StatCard label="Feed Conversion (FCR)" value={fcr} sub="lbs feed per lb meat" accent={palette.feather} />}
        {(totalFeedLbs > 0 || totalFeedCups > 0) && (
          <StatCard
            label="Total Feed"
            value={
              totalFeedLbs > 0 && totalFeedCups > 0
                ? `${totalFeedLbs.toFixed(1)} lbs + ${totalFeedCups.toFixed(1)} cups`
                : totalFeedLbs > 0
                  ? `${totalFeedLbs.toFixed(1)} lbs`
                  : `${totalFeedCups.toFixed(1)} cups`
            }
            accent={palette.feather}
          />
        )}
        <StatCard label="Cost / Bird" value={typeof costPerBird === "string" ? costPerBird : fmtMoney(costPerBird)} sub="all-in" accent={palette.yolk} />
        <StatCard label="Total Cost" value={fmtMoney(totalCost)} sub={`feed ${fmtMoney(adjFeedCost)}${adjInfraCost > 0 ? " + infra " + fmtMoney(adjInfraCost) : ""}`} accent={palette.feather} />
        {tractorFeet > 0 && (
          <StatCard
            label="🚜 Tractor moved"
            value={fmtTractorDistance(tractorFeet)}
            sub={tractorFunFact(tractorFeet, "meatChickensStats") || `${tractorMoveCount} move${tractorMoveCount === 1 ? "" : "s"}`}
            accent={palette.feather}
          />
        )}
      </div>

      {(totalChickCost > 0 || totalInfraCost > 0) && (
        <ChartCard title="📊 Cost breakdown">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {totalChickCost > 0 && <CostRow label="Chicks" value={totalChickCost} total={totalCost} />}
            <CostRow label="Feed" value={totalFeedCost} total={totalCost} />
            {totalInfraCost > 0 && <CostRow label="Infrastructure" value={totalInfraCost} total={totalCost} />}
            <div style={{
              display: "flex", justifyContent: "space-between", padding: "10px 12px",
              background: palette.ink, color: palette.bg, borderRadius: 6, marginTop: 4, fontWeight: 600,
            }}>
              <span>Total</span>
              <span>{fmtMoney(totalCost)}</span>
            </div>
          </div>
        </ChartCard>
      )}

      {leadingCause && (
        <div style={{
          background: palette.ink, color: palette.bg, borderRadius: 12, padding: 14, marginBottom: 12,
        }}>
          <div style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1.5 }}>
            Leading cause of death
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.yolk, marginTop: 4 }}>
            {leadingCause[0]} <span style={{ fontSize: 14, color: palette.bg, opacity: 0.7 }}>({leadingCause[1]} of {totalDeaths})</span>
          </div>
          {avgDeathAge && (
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
              Avg age at death: {avgDeathAge} weeks
            </div>
          )}
        </div>
      )}

      {ageData.length > 0 && (
        <ChartCard title="Deaths by age (weeks old)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ageData}>
              <XAxis dataKey="week" stroke={palette.inkSoft} fontSize={11} />
              <YAxis stroke={palette.inkSoft} fontSize={11} />
              <Tooltip
                contentStyle={{ background: palette.card, border: `1.5px solid ${palette.ink}`, borderRadius: 8 }}
                formatter={(v, n, p) => [`${v} (${p.payload.pct}%)`, "deaths"]}
              />
              <Bar dataKey="count" fill={palette.accent} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <ChartCard title={`Batches ${dateRangeLabel(dateRange)}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {batches.map((b) => {
            const bd = (b.butchered || []).reduce((s, x) => s + (x.count || 0), 0);
            const bDeaths = (b.finalEntries || [])
              .filter((e) => e.action === "death")
              .reduce((s, e) => s + (Number(e.count) || 1), 0);
            return (
              <div key={b.id} style={{
                padding: "10px 12px", background: palette.bgAlt, borderRadius: 8,
                display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6,
              }}>
                <div>
                  <strong>{b.name}</strong>
                  {b.isActive && <span style={{ background: palette.yolk, color: palette.ink, fontSize: 10, padding: "2px 6px", borderRadius: 4, marginLeft: 8 }}>ACTIVE</span>}
                  <div style={{ fontSize: 12, color: palette.inkSoft }}>
                    Started {fmtDate(b.startDate)} · {b.startCount} birds
                  </div>
                </div>
                <div style={{ fontSize: 12, color: palette.inkSoft, textAlign: "right" }}>
                  {bd > 0 && <div>{bd} butchered</div>}
                  {bDeaths > 0 && <div>{bDeaths} deaths</div>}
                </div>
              </div>
            );
          })}
        </div>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{
      background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 12,
      padding: 14, marginBottom: 12,
    }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, marginBottom: 10, color: palette.ink }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{
      padding: 32, background: palette.card, border: `1.5px dashed ${palette.line}`,
      borderRadius: 12, textAlign: "center", color: palette.inkSoft,
    }}>
      {text}
    </div>
  );
}

// ============ PHOTO LIBRARY ============
function PhotoLibraryPage({ data, user }) {
  if (!user) {
    return (
      <div>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, margin: "0 0 12px", color: palette.ink }}>
          photo library
        </h2>
        <div style={{
          padding: 32, background: palette.card, border: `1.5px dashed ${palette.line}`,
          borderRadius: 12, textAlign: "center", color: palette.inkSoft,
        }}>
          <ImageIcon size={32} strokeWidth={1.5} style={{ marginBottom: 10 }} />
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink, marginBottom: 4 }}>
            Sign in to use the photo library
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            Photos are saved to your account so they sync across devices and stay safe even if your browser data is cleared.
          </div>
        </div>
      </div>
    );
  }

  // Helper: turn a list of entries into a flat list of photo records, expanding
  // multi-photo entries into multiple rows.
  const expandPhotos = (entries) => {
    const out = [];
    entries.forEach((e) => {
      const paths = getEntryPhotos(e);
      paths.forEach((p) => out.push({ path: p, entry: e, date: e.date }));
    });
    return out;
  };

  // Build the photo collections, grouped by hobby and then by season/batch.
  // Each "group" has: { id, label, photos: [{path, entry, date}] }
  const sections = data.hobbies.map((hobby) => {
    const allEntries = data.entries[hobby.id] || [];

    if (hobby.type === "garden") {
      // Garden uses explicit seasons. Collect photos from each archived season + current season.
      const groups = [];
      const archived = hobby.archivedSeasons || [];
      archived.forEach((s) => {
        const photos = expandPhotos(s.finalEntries || []);
        if (photos.length > 0) {
          groups.push({ id: s.id, label: s.name, photos, dateForSort: s.startDate });
        }
      });
      if (hobby.currentSeason) {
        const photos = expandPhotos(allEntries.filter((e) => e.seasonId === hobby.currentSeason.id));
        if (photos.length > 0) {
          groups.push({
            id: hobby.currentSeason.id,
            label: `${hobby.currentSeason.name} (active)`,
            photos,
            dateForSort: hobby.currentSeason.startDate,
            active: true,
          });
        }
      }
      // Sort newest first
      groups.sort((a, b) => (b.dateForSort || "").localeCompare(a.dateForSort || ""));
      return { hobby, groups };
    }

    if (hobby.type === "meat_chickens") {
      const groups = [];
      const archived = hobby.archivedBatches || [];
      archived.forEach((b) => {
        const photos = expandPhotos(b.finalEntries || []);
        if (photos.length > 0) {
          groups.push({ id: b.id, label: b.name, photos, dateForSort: b.startDate });
        }
      });
      // Multi-batch: one group per active batch so users with broilers +
      // turkeys see them separated by batch, same as archived view.
      (hobby.currentBatches || []).forEach((cb) => {
        const photos = expandPhotos(allEntries.filter((e) => e.batchId === cb.id));
        if (photos.length > 0) {
          groups.push({
            id: cb.id,
            label: `${cb.name} (active)`,
            photos,
            dateForSort: cb.startDate,
            active: true,
          });
        }
      });
      groups.sort((a, b) => (b.dateForSort || "").localeCompare(a.dateForSort || ""));
      return { hobby, groups };
    }

    // Other hobbies (egg layers, custom): group by date-derived season.
    const photosFlat = expandPhotos(allEntries);
    const bySeason = {};
    photosFlat.forEach((p) => {
      const s = getSeason(p.date, data);
      if (!bySeason[s]) bySeason[s] = [];
      bySeason[s].push(p);
    });
    const groups = Object.entries(bySeason)
      .map(([label, photos]) => ({ id: label, label, photos, dateForSort: photos[0]?.date }))
      .sort((a, b) => (b.dateForSort || "").localeCompare(a.dateForSort || ""));
    return { hobby, groups };
  });

  const anyPhotos = sections.some((s) => s.groups.length > 0);

  return (
    <div>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, margin: "0 0 12px", color: palette.ink }}>
        photo library
      </h2>

      {!anyPhotos && (
        <div style={{
          padding: 32, background: palette.card, border: `1.5px dashed ${palette.line}`,
          borderRadius: 12, textAlign: "center", color: palette.inkSoft,
        }}>
          <ImageIcon size={32} strokeWidth={1.5} style={{ marginBottom: 10 }} />
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink, marginBottom: 4 }}>
            No photos yet
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            Add photos when logging entries on the Home page — they'll appear here, organized by hobby and season.
          </div>
        </div>
      )}

      {sections.map((section) =>
        section.groups.length > 0 ? (
          <PhotoHobbySection key={section.hobby.id} hobby={section.hobby} groups={section.groups} />
        ) : null
      )}
    </div>
  );
}

function PhotoHobbySection({ hobby, groups }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
        paddingBottom: 8, borderBottom: `1.5px solid ${palette.line}`,
      }}>
        <HobbyIcon name={hobby.icon} size={20} strokeWidth={1.5} />
        <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 20, margin: 0, color: palette.ink }}>
          {hobby.name}
        </h3>
        <span style={{ fontSize: 11, color: palette.inkSoft, marginLeft: "auto" }}>
          {groups.reduce((s, g) => s + g.photos.length, 0)} photos
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {groups.map((g) => (
          <PhotoGroup key={g.id} group={g} />
        ))}
      </div>
    </div>
  );
}

function PhotoGroup({ group }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      background: palette.card, border: `1.5px solid ${palette.line}`,
      borderRadius: 10, overflow: "hidden",
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%", padding: "12px 14px",
          background: expanded ? palette.bgAlt : "transparent",
          border: "none", borderBottom: expanded ? `1px solid ${palette.line}` : "none",
          cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", gap: 10,
          fontFamily: FONT_BODY,
        }}
      >
        <Calendar size={16} color={palette.inkSoft} strokeWidth={1.8} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: palette.ink }}>
            {group.label}
          </div>
          <div style={{ fontSize: 12, color: palette.inkSoft }}>
            {group.photos.length} photo{group.photos.length === 1 ? "" : "s"}
          </div>
        </div>
        <ChevronDown
          size={18}
          color={palette.inkSoft}
          style={{
            transform: expanded ? "rotate(180deg)" : "",
            transition: "transform 0.2s",
          }}
        />
      </button>

      {expanded && (
        <div style={{
          padding: 10,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(95px, 1fr))",
          gap: 8,
        }}>
          {group.photos.map((p) => (
            <PhotoTile key={p.path} photo={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoTile({ photo }) {
  const [url, setUrl] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPhotoUrl(photo.path).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [photo.path]);

  // Build a short caption from the entry: action + plant/item/cause if present
  const caption = (() => {
    const e = photo.entry;
    const bits = [];
    if (e.plant) bits.push(e.plant);
    else if (e.item) bits.push(e.item);
    else if (e.cause) bits.push(e.cause);
    return bits.join(" ");
  })();

  return (
    <>
      <button
        onClick={() => url && setOpen(true)}
        title={`${fmtDate(photo.date)}${caption ? " · " + caption : ""}`}
        style={{
          width: "100%", aspectRatio: "1 / 1",
          padding: 0, border: `1px solid ${palette.line}`,
          borderRadius: 6,
          background: url ? `url(${url}) center/cover` : palette.bgAlt,
          cursor: url ? "pointer" : "default",
          position: "relative", overflow: "hidden",
        }}
      >
        {!url && (
          <ImageIcon
            size={20}
            color={palette.inkSoft}
            style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
          />
        )}
      </button>

      {open && url && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            zIndex: 200, padding: 20, cursor: "pointer", gap: 12,
          }}
        >
          <img
            src={url}
            alt=""
            style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 8 }}
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              e.target.style.display = "none";
              const placeholder = e.target.nextSibling;
              if (placeholder && placeholder.dataset?.placeholder) {
                placeholder.style.display = "flex";
              }
            }}
          />
          <div
            data-placeholder="true"
            style={{
              display: "none", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 8, padding: 32, background: "rgba(255,255,255,0.05)", borderRadius: 8,
              color: "rgba(255,255,255,0.7)", fontSize: 14, fontFamily: FONT_BODY,
              minWidth: 200, minHeight: 200,
            }}
          >
            <ImageIcon size={32} color="rgba(255,255,255,0.5)" />
            <div>Photo unavailable</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>Try refreshing the page</div>
          </div>
          <div style={{
            color: "#fff", fontSize: 13, textAlign: "center",
            background: "rgba(0,0,0,0.4)", padding: "6px 12px", borderRadius: 6,
          }}>
            {fmtDate(photo.date)}{caption ? " · " + caption : ""}
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{
              position: "absolute", top: 16, right: 16,
              background: "rgba(255,255,255,0.9)", border: "none",
              borderRadius: 20, width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
        </div>
      )}
    </>
  );
}

// ============ MODAL ROUTER & FORMS ============
function ModalRouter({ modal, setModal, data, update, activeHobby, user, role, setActiveHobby, setPage, onFreshStart }) {
  const close = () => setModal(null);
  if (!modal) return null;

  // Push 7b — rabbits is now a first-class hobby. Previous version referenced
  // `page` here, but `page` isn't in scope inside ModalRouter — that caused
  // a ReferenceError that crashed the whole tree whenever activeHobby was
  // "rabbits" and any modal was opened.
  const hobby = data.hobbies.find((h) => h.id === activeHobby);

  if (modal.type === "settings") return <SettingsModal data={data} update={update} onClose={close} setModal={setModal} user={user} />;
  if (modal.type === "barn") return <BarnModal data={data} update={update} onClose={close} setModal={setModal} user={user} role={role} />;
  if (modal.type === "about") return <AboutModal onClose={close} />;
  if (modal.type === "support") return <SupportModal onClose={close} />;
  if (modal.type === "supporterName") return <SupporterNamePromptModal user={user} onClose={close} />;
  if (modal.type === "renameHomestead") return <RenameHomesteadModal data={data} update={update} onClose={close} />;
  if (modal.type === "feedback") return <FeedbackModal onClose={close} presetCategory={modal.presetCategory} user={user} />;
  if (modal.type === "signin") return <AuthModal onClose={close} initialMode="signin" />;
  if (modal.type === "signup") return <AuthModal onClose={close} initialMode="signup" />;
  if (modal.type === "setNewPassword") return <AuthModal onClose={close} initialMode="setNewPassword" />;
  if (modal.type === "firstSignIn") return <FirstSignInModal user={user} localData={modal.localData} onClose={close} onFreshStart={onFreshStart} />;
  if (modal.type === "addHobby") return <AddHobbyModal update={update} onClose={close} />;
  if (modal.type === "manageHobbies") return <ManageHobbiesModal data={data} update={update} onClose={close} setActiveHobby={setActiveHobby} setPage={setPage} setModal={setModal} />
  if (modal.type === "reorderHobbies") return <ReorderHobbiesModal data={data} update={update} onClose={close} />
  if (modal.type === "addFlock") {
    const targetHobby = data.hobbies.find(h => h.id === modal.hobbyId);
    if (!targetHobby) { close(); return null; }
    return <AddFlockModal hobbyId={modal.hobbyId} update={update} onClose={close} />;
  }
  if (modal.type === "editFlock") {
    const targetHobby = data.hobbies.find(h => h.id === modal.hobbyId);
    if (!targetHobby) { close(); return null; }
    return <EditFlockModal hobbyId={modal.hobbyId} flockId={modal.flockId} hobby={targetHobby} update={update} onClose={close} setModal={setModal} />;
  }
  if (modal.type === "namedBirds") {
    const targetHobby = data.hobbies.find(h => h.id === modal.hobbyId);
    if (!targetHobby) { close(); return null; }
    return <NamedBirdsModal hobbyId={modal.hobbyId} flockId={modal.flockId} hobby={targetHobby} update={update} onClose={close} />;
  }
  if (modal.type === "butcherFlock") {
    const targetHobby = data.hobbies.find(h => h.id === modal.hobbyId);
    if (!targetHobby) { close(); return null; }
    // Push 6 — flockId is optional now. If passed (e.g. from EditFlockModal's
    // "Remove birds…" button), pre-select that flock. If omitted (e.g. from
    // the top-level Butcher tile on the egg-layer action grid), the modal
    // shows its own flock picker. We still validate the flockId if one was
    // passed — a stale id from a deleted flock falls back to the picker.
    let targetFlock = null;
    if (modal.flockId) {
      targetFlock = (targetHobby.flocks || []).find(f => f.id === modal.flockId) || null;
    }
    return <ButcherFlockModal hobby={targetHobby} flock={targetFlock} update={update} onClose={close} />;
  }
  if (modal.type === "bulkEggs") {
    const targetHobby = data.hobbies.find(h => h.id === modal.hobbyId);
    if (!targetHobby) { close(); return null; }
    return <BulkEggEntryModal hobby={targetHobby} entries={data.entries[targetHobby.id] || []} update={update} onClose={close} />;
  }
  if (modal.type === "hatchBatch") return <HatchBatchModal hobby={hobby} update={update} onClose={close} />;
  // editFlockEntry removed — replaced by editFlock

  if (modal.type === "editPerennial") {
    const gardenHobbyEdit = data.hobbies.find(h => h.type === "garden");
    if (!gardenHobbyEdit) { close(); return null; }
    const perennialToEdit = (gardenHobbyEdit.perennials||[]).find(p => p.id === modal.perennialId);
    if (!perennialToEdit) { close(); return null; }
    return <EditPerennialModal hobbyId={modal.hobbyId} perennial={perennialToEdit} update={update} onClose={close} />;
  }
  if (modal.type === "addPerennial") {
    const gardenHobby = data.hobbies.find(h => h.type === "garden");
    return <AddPerennialModal hobbyId={modal.hobbyId} category={modal.category} update={update} onClose={close} />;
  }
  if (modal.type === "logPerennialHarvest") {
    const gardenHobby = data.hobbies.find(h => h.type === "garden");
    if (!gardenHobby) { close(); return null; }
    const perennial = (gardenHobby.perennials||[]).find(p => p.id === modal.perennialId);
    if (!perennial) { close(); return null; }
    return <LogPerennialHarvestModal hobbyId={modal.hobbyId} perennial={perennial} update={update} onClose={close} />;
  }
  if (modal.type === "perennialDetail") {
    const gardenHobby = data.hobbies.find(h => h.type === "garden");
    if (!gardenHobby) { close(); return null; }
    const perennial = (gardenHobby.perennials||[]).find(p => p.id === modal.perennialId);
    if (!perennial) { close(); return null; }
    return <PerennialDetailModal hobbyId={modal.hobbyId} perennial={perennial} update={update} setModal={setModal} onClose={close} />;
  }
  if (modal.type === "logPerennialAction") {
    const gardenHobby = data.hobbies.find(h => h.type === "garden");
    if (!gardenHobby) { close(); return null; }
    const perennial = (gardenHobby.perennials||[]).find(p => p.id === modal.perennialId);
    if (!perennial) { close(); return null; }
    return <LogPerennialActionModal hobbyId={modal.hobbyId} perennial={perennial} update={update} onClose={close} />;
  }
  if (modal.type === "editBatch") {
    const targetHobby = data.hobbies.find((h) => h.id === modal.hobbyId);
    if (!targetHobby) { close(); return null; }
    return <EditBatchModal hobby={targetHobby} batchId={modal.batchId} update={update} onClose={close} />;
  }
  if (modal.type === "butcher") return <ButcherModal hobby={hobby} batchId={modal.batchId} entries={data.entries[activeHobby] || []} update={update} onClose={close} />;
  if (modal.type === "startGardenSeason") return <StartGardenSeasonModal hobby={hobby} update={update} onClose={close} />;
  if (modal.type === "closeGardenSeason") return <CloseGardenSeasonModal hobby={hobby} entries={data.entries[activeHobby] || []} update={update} onClose={close} />;
  if (modal.type === "log") {
    // Normally the LogModal operates on the currently-active hobby. When the
    // Journal opens an entry from a non-active hobby, it passes a
    // hobbyIdOverride so the edit goes to the right entries array. Fall back
    // to the active hobby for every other call site.
    const targetHobby = modal.hobbyIdOverride
      ? (data.hobbies.find((h) => h.id === modal.hobbyIdOverride) || hobby)
      : hobby;
    return <LogModal hobby={targetHobby} action={modal.action} data={data} update={update} onClose={close} user={user} existingEntry={modal.existingEntry} />;
  }
  if (modal.type === "planCrop") return <PlanCropModal data={data} update={update} onClose={close} />;
  if (modal.type === "planBirds") return <PlanBirdsModal update={update} onClose={close} prefillDate={modal.prefillDate} />;
  if (modal.type === "addCalendarEvent") return <AddCalendarEventModal update={update} onClose={close} prefillDate={modal.prefillDate} />;
  if (modal.type === "planForDay") return <PlanForDayModal date={modal.date} setModal={setModal} onClose={close} />;
  if (modal.type === "editCalendarEvent") return <EditCalendarEventModal data={data} update={update} eventId={modal.eventId} onClose={close} />;
  if (modal.type === "editZone") return <EditZoneModal data={data} update={update} onClose={close} />;
  if (modal.type === "viewDayEvents") return <ViewDayEventsModal data={data} update={update} date={modal.date} setModal={setModal} onClose={close} />;
  if (modal.type === "gardenMap") return <GardenMapModal data={data} update={update} user={user} onClose={close} />;
  if (modal.type === "farmhand") return <FarmhandModal user={user} role={role} homesteadName={data.homesteadName} onClose={close} />;
  if (modal.type === "location") return <LocationModal data={data} update={update} onClose={close} />;
  if (modal.type === "photos") return <PhotosModal data={data} user={user} onClose={close} />;
  if (modal.type === "tutorial") return <TutorialModal onClose={close} />;
  if (modal.type === "whatsNew") return <WhatsNewModal onClose={close} />;
  if (modal.type === "inviteSignIn") return <InviteSignInModal onClose={close} setModal={setModal} />;
  if (modal.type === "inviteAccepted") return <InviteAcceptedModal homesteadName={data.homesteadName} onClose={close} />;
  if (modal.type === "inviteError") return <InviteErrorModal message={modal.message} onClose={close} />;
  return null;
}

function InviteSignInModal({ onClose, setModal }) {
  return (
    <Modal open onClose={onClose} title="You've been invited! 🌱">
      <div style={{
        padding: 12, background: palette.yolkSoft, borderRadius: 8,
        fontSize: 13, color: palette.ink, marginBottom: 16, lineHeight: 1.5,
        border: `1.5px solid ${palette.line}`,
      }}>
        Someone invited you to share their homestead on Henalytics. Sign in or create an account to accept the invite.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="primary" onClick={() => setModal({ type: "signin" })}>Sign in</Btn>
        <Btn variant="accent" onClick={() => setModal({ type: "signup" })}>Create account</Btn>
      </div>
      <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 14, lineHeight: 1.5 }}>
        Your account email must match the email the invitation was sent to.
      </div>
    </Modal>
  );
}

function InviteAcceptedModal({ homesteadName, onClose }) {
  return (
    <Modal open onClose={onClose} title="Welcome to the homestead 🌱">
      <div style={{
        padding: 16, background: palette.leafSoft, borderRadius: 8,
        fontSize: 14, color: palette.ink, marginBottom: 16, lineHeight: 1.5,
        textAlign: "center",
      }}>
        <CheckCircle size={28} style={{ marginBottom: 8 }} />
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, marginBottom: 6 }}>
          You're in!
        </div>
        <div>You've joined <strong>{homesteadName || "the homestead"}</strong> as a farmhand. You can log entries, view photos, and see analytics.</div>
      </div>
      <Btn variant="primary" onClick={onClose}>Get started</Btn>
    </Modal>
  );
}

function InviteErrorModal({ message, onClose }) {
  return (
    <Modal open onClose={onClose} title="Invitation problem">
      <div style={{
        padding: 12, background: "#FBE5DE", border: `1.5px solid ${palette.accent}`,
        borderRadius: 8, fontSize: 13, color: palette.accent, marginBottom: 14,
        display: "flex", alignItems: "flex-start", gap: 8,
      }}>
        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>{message}</span>
      </div>
      <Btn variant="primary" onClick={onClose}>OK</Btn>
    </Modal>
  );
}

// SectionBtn is shared by BarnModal and SettingsModal.
function SectionBtn({ icon: Icon, label, sub, onClick, accent = palette.ink }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", padding: "14px 14px", marginBottom: 8,
        background: palette.card, border: `1.5px solid ${palette.line}`,
        borderRadius: 10, cursor: "pointer", textAlign: "left",
        display: "flex", alignItems: "center", gap: 12,
        boxShadow: "2px 2px 0 " + palette.line,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 8, background: palette.bgAlt,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Icon size={18} strokeWidth={1.8} color={accent} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: palette.ink }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
      </div>
    </button>
  );
}

// ============================================================================
// BARN MODAL — homestead identity + farmhands + about-the-maker
// ----------------------------------------------------------------------------
// "Barn" groups things that describe the homestead itself, distinct from the
// account/preferences in SettingsModal.
// ============================================================================
function BarnModal({ data, update, onClose, setModal, user, role }) {
  return (
    <Modal open onClose={onClose} title="Your homestead">
      <SectionBtn
        icon={Edit3}
        label="Name your homestead"
        sub={data.homesteadName || "Untitled"}
        onClick={() => { onClose(); setTimeout(() => setModal({ type: "renameHomestead" }), 0); }}
      />

      <SectionBtn
        icon={MapPin}
        label="Homestead location"
        sub={data.homesteadLocation
          ? `Set: ${data.homesteadLocation.label || `${data.homesteadLocation.lat.toFixed(2)}, ${data.homesteadLocation.lon.toFixed(2)}`}`
          : "Set your location to auto-attach weather to entries"}
        accent={palette.leaf}
        onClick={() => { onClose(); setTimeout(() => setModal({ type: "location" }), 0); }}
      />

      {user && (
        <SectionBtn
          icon={UserPlus}
          label="Farmhands"
          sub={role === "owner" ? "Invite a farmhand to share your homestead" : "View members of this homestead"}
          accent={palette.feather}
          onClick={() => { onClose(); setTimeout(() => setModal({ type: "farmhand" }), 0); }}
        />
      )}

      <SectionBtn
        icon={ImageIcon}
        label="Photo library"
        sub="All your homestead photos"
        accent={palette.feather}
        onClick={() => { onClose(); setTimeout(() => setModal({ type: "photos" }), 0); }}
      />

      <SectionBtn
        icon={Heart}
        label="About the maker"
        sub="Why I built Henalytics"
        accent={palette.accent}
        onClick={() => { onClose(); setTimeout(() => setModal({ type: "about" }), 0); }}
      />

      {/* Blog lives at /blog/ on the web. In native builds we open it as an
          external URL in the in-app browser (the static blog HTML isn't shipped
          inside the iOS/Android bundle). If you'd rather hide the blog button
          on native entirely, swap the && for `!isNativeApp() && ...` below. */}
      <SectionBtn
        icon={NotebookPen}
        label="Blog"
        sub="Notes on homesteading, gardens & chickens"
        accent={palette.leaf}
        onClick={() => {
          if (isNativeApp()) {
            openExternalUrl("https://henalytics.com/blog/");
          } else {
            window.location.href = "/blog/";
          }
        }}
      />
    </Modal>
  );
}

// ============================================================================
// MANAGE HOBBIES SECTION — collapsible folder inside Settings
// ----------------------------------------------------------------------------
// Replaces the always-expanded Your Hobbies list. Closed by default to keep
// Settings tidy; one tap opens it and shows the full list with hide/show toggles.
// ============================================================================
function ManageHobbiesSection({ data, update }) {
  const [open, setOpen] = useState(false);
  const visibleCount = (data.hobbies || []).filter(h => !h.hidden).length;
  const totalCount = (data.hobbies || []).length;
  const HOBBY_LABELS = {
    garden: "Garden",
    egg_layers: "Egg Layers",
    meat_chickens: "Meat Birds",
    rabbits: "Rabbits",
    bees: "Beekeeping",
    incubator: "Incubator",
    goats: "Goats",
    cows: "Cows",
    pigs: "Pigs",
    sheep: "Sheep",
    horses: "Horses",
    sourdough: "Sourdough",
    farmstand: "Farmstand",
  };

  return (
    <div style={{ marginTop: 16, marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>
        Your Hobbies
      </div>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          background: palette.card,
          border: `1.5px solid ${palette.line}`,
          borderRadius: 8,
          cursor: "pointer",
          fontFamily: FONT_BODY,
          color: palette.ink,
          textAlign: "left",
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {open ? "Hide hobby list" : "Show & manage hobbies"}
          </div>
          <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 2 }}>
            {visibleCount} of {totalCount} visible · tap to {open ? "collapse" : "expand"}
          </div>
        </div>
        <ChevronDown
          size={18}
          style={{
            transform: open ? "rotate(180deg)" : "",
            transition: "transform 0.2s",
            flexShrink: 0,
          }}
        />
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          {(data.hobbies || []).map(h => (
            <div
              key={h.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                background: palette.card,
                border: `1.5px solid ${palette.line}`,
                borderRadius: 8,
                marginBottom: 6,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: palette.ink, wordBreak: "break-word" }}>{h.name}</div>
                <div style={{ fontSize: 11, color: palette.inkSoft }}>
                  {HOBBY_LABELS[h.type] || h.type}
                </div>
              </div>
              <button
                onClick={() => update(d => {
                  const hob = d.hobbies.find(x => x.id === h.id);
                  if (hob) hob.hidden = !hob.hidden;
                  return d;
                })}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: `1.5px solid ${palette.line}`,
                  background: h.hidden ? palette.bgAlt : palette.leaf,
                  color: h.hidden ? palette.inkSoft : palette.bg,
                  fontFamily: FONT_BODY,
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                  flexShrink: 0,
                  marginLeft: 8,
                }}
              >
                {h.hidden ? "Hidden" : "Visible"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// INTERNATIONAL SECTION — collapsible panel inside Settings for non-US users
// ----------------------------------------------------------------------------
// Hemisphere selector (auto from location, or manually override), temperature
// unit (F/C), currency picker (USD/AUD/CAD/GBP/EUR/NZD). Closed by default
// because most users are in the US and don't need to think about it.
// ============================================================================
function InternationalSection({ data, update, setModal, onClose }) {
  const [open, setOpen] = useState(false);
  const units = data.units || {};
  const currency = units.currency || "USD";
  const tempUnit = units.temperature || "F";
  const hemisphere = units.hemisphere || "auto";
  const lat = data.homesteadLocation?.lat;
  const detectedHem = typeof lat === "number" ? (lat < 0 ? "south" : "north") : null;

  const setUnit = (key, value) => {
    update(d => {
      if (!d.units) d.units = {};
      d.units[key] = value;
      return d;
    });
  };

  const CURRENCIES = [
    { code: "USD", label: "USD ($) — US Dollar" },
    { code: "AUD", label: "AUD (A$) — Australian Dollar" },
    { code: "CAD", label: "CAD (C$) — Canadian Dollar" },
    { code: "GBP", label: "GBP (£) — British Pound" },
    { code: "EUR", label: "EUR (€) — Euro" },
    { code: "NZD", label: "NZD (NZ$) — New Zealand Dollar" },
  ];

  return (
    <div style={{ marginTop: 16, marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>
        International friends?
      </div>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 14px", background: palette.card, border: `1.5px solid ${palette.line}`,
          borderRadius: 8, cursor: "pointer", fontFamily: FONT_BODY, color: palette.ink, textAlign: "left",
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {open ? "Hide international settings" : "🌍 Currency, temperature, hemisphere"}
          </div>
          <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 2 }}>
            Currently: {currency} · {tempUnit === "C" ? "°C" : "°F"} · {hemisphere === "auto" ? `${detectedHem || "north"} (auto)` : hemisphere}
          </div>
        </div>
        <ChevronDown
          size={18}
          style={{ transform: open ? "rotate(180deg)" : "", transition: "transform 0.2s", flexShrink: 0 }}
        />
      </button>

      {open && (
        <div style={{ marginTop: 8, padding: 12, background: palette.card, borderRadius: 8, border: `1.5px solid ${palette.line}` }}>
          <p style={{ fontSize: 12, color: palette.inkSoft, margin: "0 0 14px", lineHeight: 1.5 }}>
            Henalytics started in the US so the defaults are dollars, Fahrenheit, and northern-hemisphere seasons. Switch any of these if they don't fit you.
          </p>

          {/* Currency */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 6, fontWeight: 600 }}>💵 Currency</div>
            <select
              style={{ ...inputStyle }}
              value={currency}
              onChange={e => setUnit("currency", e.target.value)}
            >
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4, fontStyle: "italic" }}>
              Note: Ko-fi/Stripe tips are still charged in USD — your card or Apple Pay will handle the conversion automatically.
            </div>
          </div>

          {/* Temperature */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 6, fontWeight: 600 }}>🌡 Temperature</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[{ k: "F", l: "Fahrenheit (°F)" }, { k: "C", l: "Celsius (°C)" }].map(o => (
                <button
                  key={o.k}
                  onClick={() => setUnit("temperature", o.k)}
                  style={{
                    flex: 1, padding: "8px 12px", borderRadius: 8,
                    border: `1.5px solid ${tempUnit === o.k ? palette.ink : palette.line}`,
                    background: tempUnit === o.k ? palette.ink : palette.bg,
                    color: tempUnit === o.k ? palette.bg : palette.ink,
                    fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >{o.l}</button>
              ))}
            </div>
          </div>

          {/* Hemisphere */}
          <div>
            <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 6, fontWeight: 600 }}>🌎 Hemisphere</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { k: "auto", l: detectedHem ? `Auto (${detectedHem})` : "Auto" },
                { k: "north", l: "Northern" },
                { k: "south", l: "Southern" },
              ].map(o => (
                <button
                  key={o.k}
                  onClick={() => setUnit("hemisphere", o.k)}
                  style={{
                    flex: "1 1 90px", padding: "8px 12px", borderRadius: 8,
                    border: `1.5px solid ${hemisphere === o.k ? palette.ink : palette.line}`,
                    background: hemisphere === o.k ? palette.ink : palette.bg,
                    color: hemisphere === o.k ? palette.bg : palette.ink,
                    fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >{o.l}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 6, fontStyle: "italic", lineHeight: 1.5 }}>
              Affects garden seasons (spring/summer/fall/winter labels). Auto-detects from your location if you've set one.
            </div>
          </div>

          {/* Hardiness zone — opens the existing EditZoneModal which now supports
              all 6 systems (USDA, Canada, RHS, EU, ANHGA, NZ). We close the
              Settings modal first so EditZoneModal isn't drawn on top of it. */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 6, fontWeight: 600 }}>🌱 Hardiness zone</div>
            <button
              onClick={() => {
                if (onClose) onClose();
                if (setModal) setTimeout(() => setModal({ type: "editZone" }), 0);
              }}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: `1.5px solid ${palette.line}`, background: palette.bg,
                color: palette.ink, fontFamily: FONT_BODY, fontSize: 13,
                cursor: "pointer", textAlign: "left",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <span>
                {(() => {
                  const sys = data.userZoneSystem || "USDA";
                  const zone = data.userZone || "—";
                  const sysLabel = sys === "USDA" ? "USDA" :
                                   sys === "Canada" ? "Canada" :
                                   sys === "RHS" ? "UK (RHS)" :
                                   sys === "EU" ? "Europe (RHS)" :
                                   sys === "ANHGA" ? "Australia" :
                                   sys === "NZ" ? "New Zealand" : sys;
                  return data.userZone ? `${sysLabel} · Zone ${zone}` : `${sysLabel} (auto-detect)`;
                })()}
              </span>
              <ChevronDown size={14} style={{ transform: "rotate(-90deg)", opacity: 0.5 }} />
            </button>
            <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 6, fontStyle: "italic", lineHeight: 1.5 }}>
              Pick your country's hardiness system (USDA, Australia, UK, etc). Drives the planting suggestions on the Calendar.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SETTINGS MODAL — account, preferences, data, support
// ----------------------------------------------------------------------------
// Slimmed down: no longer holds homestead-identity stuff (now in BarnModal).
// ============================================================================
function SettingsModal({ data, update, onClose, setModal, user }) {
  const [showReset, setShowReset] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Account deletion state — gated behind two confirmations:
  //   showDeleteAccount: false → button only; true → modal opens
  //   deleteConfirmText: must equal "DELETE" to enable the final button
  //   deletingAccount: in-flight indicator
  //   deleteError: any error from the endpoint
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      if (supabase) await supabase.auth.signOut();
      clearLocalHomestead();
    } catch (e) {
      console.error("Sign out failed", e);
    }
    setSigningOut(false);
    onClose();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeletingAccount(true);
    setDeleteError("");
    try {
      await deleteAccount();
      // Clear the local backup so the next render starts from a clean slate.
      // (Without this, signOut would leave the device's last-known data
      // sitting in localStorage and the load effect would pick it back up.)
      try { clearLocalHomestead(); } catch (_) {}
      // The server has already deleted the auth row. Sign out locally to
      // clear the session token. The onAuthStateChange listener fires
      // SIGNED_OUT, user state goes null, and the load effect repopulates
      // from the now-empty local store with defaultData(). Onboarding wizard
      // reopens automatically. This works in web and native — no reload.
      try {
        if (supabase) await supabase.auth.signOut();
      } catch (e) {
        // Already deleted server-side, signOut will fail but that's fine
      }
      // Close the settings modal so the fresh-start UI is visible.
      onClose();
    } catch (e) {
      console.error("Account deletion failed", e);
      setDeleteError(e.message || "Could not delete account. Please email slowbuildacres@gmail.com.");
      setDeletingAccount(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Settings">
      {/* Spouse Mode active banner */}
      {data.spouseMode && (
        <div style={{ background: "#E94560", color: "#fff", textAlign: "center", padding: "8px 12px", fontSize: 12, fontWeight: 700, letterSpacing: 0.5, borderRadius: 8, marginBottom: 12 }}>
          🕵️ SPOUSE MODE ON — your numbers are for presentation only
        </div>
      )}
      {user ? (
        <>
          <div style={{
            padding: "14px 14px", marginBottom: 8,
            background: palette.card, border: `1.5px solid ${palette.line}`,
            borderRadius: 10,
            display: "flex", alignItems: "center", gap: 12,
            boxShadow: "2px 2px 0 " + palette.line,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: palette.leafSoft,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <UserCircle size={18} strokeWidth={1.8} color={palette.ink} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: palette.ink }}>Signed in</div>
              <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.email}
              </div>
            </div>
          </div>

          <SectionBtn
            icon={LogOut}
            label={signingOut ? "Signing out..." : "Sign out"}
            sub="You'll need to sign back in to access your account"
            accent={palette.accent}
            onClick={signingOut ? () => {} : handleSignOut}
          />
        </>
      ) : (
        <SectionBtn
          icon={UserCircle}
          label="Sign in or create account"
          sub={isSupabaseConfigured ? "Save your homestead with an account" : "Coming soon"}
          accent={palette.leaf}
          onClick={() => { onClose(); setTimeout(() => setModal({ type: "signin" }), 0); }}
        />
      )}

      {user && (
        <SectionBtn
          icon={Mail}
          label={data.weeklyDigestOptIn ? "Weekly summary email: ON" : "Weekly summary email: off"}
          sub={data.weeklyDigestOptIn
            ? "We'll email you a recap every Sunday"
            : "Get a weekly recap of your homestead by email"}
          accent={data.weeklyDigestOptIn ? palette.leaf : palette.inkSoft}
          onClick={() => {
            update((d) => {
              d.weeklyDigestOptIn = !d.weeklyDigestOptIn;
              return d;
            });
          }}
        />
      )}

      {user && (
        <SectionBtn
          icon={Mail}
          label={data.weeklyChoreEmailOptIn ? "Weekly chore email: ON" : "Weekly chore email: off"}
          sub={data.weeklyChoreEmailOptIn
            ? "We'll email this week's chores every Sunday evening — you and any opted-in farmhands"
            : "Get this week's chores by email every Sunday evening"}
          accent={data.weeklyChoreEmailOptIn ? palette.leaf : palette.inkSoft}
          onClick={() => {
            update((d) => {
              d.weeklyChoreEmailOptIn = !d.weeklyChoreEmailOptIn;
              return d;
            });
          }}
        />
      )}

      {/* SPOUSE MODE */}
      <div style={{ marginTop: 16, marginBottom: 4 }}>
        <div style={{ fontSize: 11, color: data.spouseMode ? "#A0A0B0" : palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>
          🤫 Spouse Mode
        </div>
        <div style={{
          background: data.spouseMode ? "#0F3460" : palette.card,
          border: `1.5px solid ${data.spouseMode ? "#E94560" : palette.line}`,
          borderRadius: 12, padding: "14px 14px", marginBottom: 6,
          transition: "all 0.3s",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: data.spouseMode ? "#FFD700" : palette.ink, marginBottom: 4 }}>
                {data.spouseMode ? "🕵️ Spouse Mode: ON" : "Spouse Mode"}
              </div>
              <div style={{ fontSize: 12, color: data.spouseMode ? "#A0A0B0" : palette.inkSoft, lineHeight: 1.5 }}>
                {data.spouseMode
                  ? "All costs shown at 10% of actual. Production shown at 200%. Your secret is safe... probably."
                  : "Shows costs at 10% of actual and production at 200% of actual. Perfect for that 'hey look how well this is going' conversation."}
              </div>
            </div>
            <button
              onClick={() => update(d => { d.spouseMode = !d.spouseMode; return d; })}
              style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${data.spouseMode ? "#E94560" : palette.line}`, background: data.spouseMode ? "#E94560" : palette.bgAlt, color: data.spouseMode ? "#fff" : palette.inkSoft, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}
            >
              {data.spouseMode ? "ON 🔴" : "OFF"}
            </button>
          </div>
          {!data.spouseMode && (
            <div style={{ marginTop: 10, padding: "8px 10px", background: palette.yolkSoft, borderRadius: 8, fontSize: 12, color: palette.ink, lineHeight: 1.5 }}>
              ⚠️ <strong>Heads up:</strong> This changes what numbers are displayed — not your actual data. Real data is always preserved. Also, I am not responsible if your spouse gets mad you bought another chicken. 🐔
            </div>
          )}
        </div>
      </div>

      <SectionBtn
        icon={Download}
        label="Export to CSV"
        sub="Download all your entries as spreadsheets"
        accent={palette.leaf}
        onClick={() => {
          exportAllAsCsv(data);
        }}
      />

      <SectionBtn
        icon={Lightbulb}
        label="What's new 🌾"
        sub="See the latest features added to HenAlytics"
        accent={palette.yolk}
        onClick={() => { onClose(); setTimeout(() => setModal({ type: "whatsNew" }), 0); }}
      />

      <SectionBtn
        icon={Lightbulb}
        label="Take the tour 🌾"
        sub="A quick walkthrough of HenAlytics features"
        accent={palette.leaf}
        onClick={() => { onClose(); setTimeout(() => setModal({ type: "tutorial" }), 0); }}
      />

      <SectionBtn
        icon={Lightbulb}
        label="How can I improve?"
        sub="Send the maker your ideas"
        accent={palette.yolk}
        onClick={() => { onClose(); setTimeout(() => setModal({ type: "feedback" }), 0); }}
      />
{/* MANAGE HOBBIES — collapsible to reduce visual clutter */}
      <ManageHobbiesSection data={data} update={update} />
      {/* TABS SECTION */}
      <div style={{ marginTop: 16, marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>
          Tabs
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 8, marginBottom: 6 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: palette.ink }}>💰 Sales tab</div>
            <div style={{ fontSize: 11, color: palette.inkSoft }}>Track what you sell across all hobbies</div>
          </div>
          <button
            onClick={() => update(d => { d.salesHidden = !d.salesHidden; return d; })}
            style={{ padding: "6px 12px", borderRadius: 6, border: `1.5px solid ${palette.line}`, background: data.salesHidden ? palette.bgAlt : palette.leaf, color: data.salesHidden ? palette.inkSoft : palette.bg, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 12, cursor: "pointer" }}
          >
            {data.salesHidden ? "Hidden" : "Visible"}
          </button>
        </div>
      </div>

      <div style={{
        marginTop: 16, padding: 12, background: palette.bgAlt, borderRadius: 8,
        fontSize: 12, color: palette.inkSoft, lineHeight: 1.5,
      }}>
        <strong style={{ color: palette.ink }}>Privacy:</strong> {user
          ? "Your account email is stored only for support and account recovery. Your homestead data syncs to the cloud and to any farmhands you've invited. Nothing is shared or sold."
          : "Your data is saved only to your own browser right now. Nothing is shared or sold. When you sign in, your email is used only for support — never sold or shared."}
      </div>

      {/* Privacy policy / terms of service links — App Store requires these be accessible in-app */}
      <div style={{ marginTop: 10, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => openExternalUrl("https://henalytics.com/privacy")}
          style={{ fontSize: 12, color: palette.inkSoft, textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
        >
          Privacy policy
        </button>
        <button
          type="button"
          onClick={() => openExternalUrl("https://henalytics.com/terms")}
          style={{ fontSize: 12, color: palette.inkSoft, textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
        >
          Terms of service
        </button>
      </div>

      {!showReset ? (
        <button
          onClick={() => setShowReset(true)}
          style={{
            marginTop: 14, background: "none", border: "none",
            color: palette.inkSoft, fontSize: 12, cursor: "pointer",
            textDecoration: "underline", padding: 4,
          }}
        >
          Reset all data
        </button>
      ) : (
        <div style={{ marginTop: 14, padding: 12, background: palette.card, borderRadius: 8, border: `1.5px solid ${palette.accent}` }}>
          <div style={{ fontSize: 13, marginBottom: 10, color: palette.accent, fontWeight: 600 }}>
            This will delete everything. Are you sure?
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="danger" small onClick={async () => {
              clearLocalHomestead();
              const fresh = defaultData();
              update(() => fresh);
              onClose();
            }}>Yes, reset</Btn>
            <Btn variant="ghost" small onClick={() => setShowReset(false)}>Cancel</Btn>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT — Apple App Store guideline 5.1.1(v) requires this be accessible in-app */}
      {user && (
        !showDeleteAccount ? (
          <div style={{ marginTop: 4 }}>
            <button
              onClick={() => { setShowDeleteAccount(true); setDeleteConfirmText(""); setDeleteError(""); }}
              style={{
                background: "none", border: "none",
                color: palette.accent, fontSize: 12, cursor: "pointer",
                textDecoration: "underline", padding: 4,
              }}
            >
              Delete my account
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 14, padding: 14, background: palette.card, borderRadius: 8, border: `2px solid ${palette.accent}` }}>
            <div style={{ fontSize: 14, marginBottom: 8, color: palette.accent, fontWeight: 700 }}>
              ⚠️ Permanently delete your account
            </div>
            <div style={{ fontSize: 12, color: palette.ink, marginBottom: 10, lineHeight: 1.5 }}>
              This will permanently delete:
            </div>
            <ul style={{ fontSize: 12, color: palette.inkSoft, lineHeight: 1.7, marginTop: 0, marginBottom: 12, paddingLeft: 18 }}>
              <li>Your account ({user.email})</li>
              <li>All your homestead data (entries, photos, sales, calendar)</li>
              <li>Any homesteads you own where you're the only member</li>
            </ul>
            <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 10, lineHeight: 1.5 }}>
              If you share a homestead with farmhands, ownership transfers to the next member so they don't lose access.
            </div>
            <div style={{ fontSize: 13, color: palette.ink, fontWeight: 600, marginBottom: 6 }}>
              This cannot be undone.
            </div>
            <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 8 }}>
              Type <strong style={{ color: palette.accent, fontFamily: "monospace" }}>DELETE</strong> below to confirm:
            </div>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE here"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              disabled={deletingAccount}
              style={{
                width: "100%", padding: "10px 12px", marginBottom: 12,
                borderRadius: 6, border: `1.5px solid ${deleteConfirmText === "DELETE" ? palette.accent : palette.line}`,
                background: palette.bg, fontFamily: "monospace", fontSize: 14,
                color: palette.ink, boxSizing: "border-box",
                letterSpacing: 1,
              }}
            />
            {deleteError && (
              <div style={{ fontSize: 12, color: palette.accent, marginBottom: 10, padding: "8px 10px", background: palette.bgAlt, borderRadius: 6, lineHeight: 1.5 }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn
                variant="danger"
                small
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== "DELETE" || deletingAccount}
              >
                {deletingAccount ? "Deleting..." : "Delete my account permanently"}
              </Btn>
              <Btn
                variant="ghost"
                small
                onClick={() => { setShowDeleteAccount(false); setDeleteConfirmText(""); setDeleteError(""); }}
                disabled={deletingAccount}
              >
                Cancel
              </Btn>
            </div>
          </div>
        )
      )}

      {/* International friends? — collapsible panel for users outside the US */}
      <InternationalSection data={data} update={update} setModal={setModal} onClose={onClose} />

      {/* Owner-only debug tools — only visible to 416lulays@gmail.com */}
      {user?.email === "416lulays@gmail.com" && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1.5px dashed ${palette.line}` }}>
          <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>
            🔧 Owner debug tools
          </div>
          <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 10, lineHeight: 1.5 }}>
            Reset popup dismissal flags so What's New and the monthly supporter thank-you re-fire on next page load. Only you can see this.
          </div>
          <Btn variant="ghost" small onClick={() => {
            update((d) => {
              d.lastSeenVersion = 0;
              d.supportersDismissedMonth = null;
              d.userHasTipped = false;
              return d;
            });
            onClose();
          }}>Reset popups</Btn>
        </div>
      )}
    </Modal>
  );
}

// ============================================================================
// ABOUT MODAL — the maker's story
// ============================================================================
function AboutModal({ onClose }) {
  return (
    <Modal open onClose={onClose} title="About the maker">
      <div style={{ fontFamily: FONT_BODY, color: palette.ink, lineHeight: 1.7, fontSize: 14 }}>
        <div style={{
          fontFamily: FONT_DISPLAY, fontSize: 28, marginBottom: 4, color: palette.ink, lineHeight: 1.1,
        }}>
          Hey 👋
        </div>
        <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 18, fontStyle: "italic" }}>
          I'm the guy who built Henalytics.
        </div>

        <p style={{ marginTop: 0 }}>
          I'm an e-commerce manager by day, but my real passion is homesteading and regenerative farming. My wife and I have kept a backyard homestead for a while — gardening, egg layers, even quail for a stretch.
        </p>

        {/* Photo: backyard raised beds (the previous setup) */}
        <figure style={{ margin: "20px -4px" }}>
          <img
            src="/about/about-garden.jpg"
            alt="Raised-bed vegetable garden — our backyard setup before the move"
            style={{
              width: "100%", borderRadius: 10, display: "block",
              border: `1.5px solid ${palette.line}`,
            }}
          />
          <figcaption style={{
            fontSize: 11, color: palette.inkSoft, fontStyle: "italic",
            textAlign: "center", marginTop: 6,
          }}>
            Our backyard raised-bed garden — before the move.
          </figcaption>
        </figure>

        <p>
          In January 2026, we took the leap and bought 4 acres in Kansas (Zone 6a). We're new homesteaders in a real way now, with kids in tow and a lot still to learn.
        </p>

        {/* Photo: the new land */}
        <figure style={{ margin: "20px -4px" }}>
          <img
            src="/about/about-land.jpg"
            alt="Open Kansas field with cloudy sky — our new 4 acres"
            style={{
              width: "100%", borderRadius: 10, display: "block",
              border: `1.5px solid ${palette.line}`,
            }}
          />
          <figcaption style={{
            fontSize: 11, color: palette.inkSoft, fontStyle: "italic",
            textAlign: "center", marginTop: 6,
          }}>
            The new place. Kansas. Zone 6a. Lots of sky.
          </figcaption>
        </figure>

        <p>
          I'm a numbers nerd (you could probably tell from the app). I wanted a free, simple way to track our homestead over time — egg counts, garden harvests, costs, weather, photos — and to surface the patterns you don't normally see. I couldn't find one I liked, so I built it.
        </p>

        {/* Photo: meat bird tractors */}
        <figure style={{ margin: "20px -4px" }}>
          <img
            src="/about/about-chickens.jpg"
            alt="Two pasture-tractor chicken coops on a sunny day"
            style={{
              width: "100%", borderRadius: 10, display: "block",
              border: `1.5px solid ${palette.line}`,
            }}
          />
          <figcaption style={{
            fontSize: 11, color: palette.inkSoft, fontStyle: "italic",
            textAlign: "center", marginTop: 6,
          }}>
            Pasture tractors for our meat birds.
          </figcaption>
        </figure>

        <p>
          Henalytics is just me. No company, no investors, no ads. Between App Store fees and upgrading the tools and services that keep the app running for a growing community, it costs about $500/year to operate. Not terrible — but any community contribution is sincerely appreciated. Anything beyond the minimum maintenance fees goes back into improving the app. Anything beyond that, will get used to feed my chickens.
        </p>

        <p style={{
          marginTop: 24, marginBottom: 8, padding: "16px 14px",
          background: palette.yolkSoft, borderRadius: 10, border: `1.5px solid ${palette.line}`,
          textAlign: "center",
        }}>
          Thanks for being here. Whether you're tracking a backyard flock or 4 acres or 40, you're the reason this is fun to keep building.
        </p>

        <div style={{ textAlign: "center", marginTop: 12, fontSize: 13, color: palette.inkSoft, fontStyle: "italic" }}>
          🌱 — the Henalytics maker
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// SUPPORT MODAL — tip jar / patron tier with Ko-fi link
// ----------------------------------------------------------------------------
// Warm, low-pressure copy that thanks supporters and explains the costs.
// Two CTAs: one-time tip ("buy a bag of feed") and monthly patron tier.
// All flow through Stripe Payment Links (Ko-fi kept commented as backup).
// ============================================================================
function SupportModal({ onClose }) {
  // New design: monthly is featured (3 tiers — $3, $5, $10) with one-time
  // tip as a smaller secondary option below. Each button calls startCheckout
  // which goes through our server (auth + user-ID linking + supporter row).
  //
  // The old Payment Link URLs are deliberately gone — they didn't pass through
  // the Henalytics user ID, which meant we couldn't connect a subscription
  // to a supporter wall entry.

  return (
    <Modal open onClose={onClose} title="Support Henalytics">
      <div style={{ fontFamily: FONT_BODY, color: palette.ink, lineHeight: 1.7, fontSize: 14 }}>
        <div style={{
          fontFamily: FONT_DISPLAY, fontSize: 28, marginBottom: 4, color: palette.ink, lineHeight: 1.1,
        }}>
          🌾 Support Henalytics
        </div>
        <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 18, fontStyle: "italic" }}>
          This app is free, and it stays that way.
        </div>

        <p style={{ marginTop: 0 }}>
          Between App Store fees and upgrading the tools and services that keep the app running for a growing community, it costs about $500/year to operate, plus my time. Not terrible — but any community contribution is sincerely appreciated. There's no company behind it, no investors, no ads. Just me — a homesteader in Kansas — building it in the evenings. Anything beyond the minimum maintenance fees goes back into improving the app. Anything beyond that, will get used to feed my chickens.
        </p>

        <p>
          If Henalytics has been useful and you'd like to chip in a few dollars to help keep it running, I'd genuinely appreciate it. Even a few bucks goes a long way around here.
        </p>

        <p style={{ fontStyle: "italic", color: palette.inkSoft, fontSize: 13 }}>
          But please don't feel any pressure. The app is and will stay free for everyone, whether or not you chip in.
        </p>

        {/* ---- MONTHLY TIERS (featured) ---- */}
        <div style={{
          marginTop: 20, marginBottom: 6,
          fontSize: 11, letterSpacing: 1, color: palette.inkSoft, fontWeight: 600, textTransform: "uppercase",
        }}>
          Monthly support
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { tier: "monthly_1",  amount: 1,  label: "Seedling" },
            { tier: "monthly_3",  amount: 3,  label: "Coffee" },
            { tier: "monthly_5",  amount: 5,  label: "Sustaining", featured: true },
            { tier: "monthly_10", amount: 10, label: "Generous" },
          ].map((t) => (
            <button
              key={t.tier}
              type="button"
              onClick={() => startCheckout(t.tier)}
              style={{
                flex: "1 1 100px",
                padding: "16px 10px",
                borderRadius: 12,
                border: `2px solid ${palette.ink}`,
                background: t.featured ? palette.leaf : palette.card,
                color: t.featured ? palette.bg : palette.ink,
                textAlign: "center",
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 14,
                boxShadow: "2px 2px 0 " + palette.line,
                cursor: "pointer",
                position: "relative",
              }}
            >
              {t.featured && (
                <div style={{
                  position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
                  background: palette.yolk, color: palette.ink, fontSize: 10, fontWeight: 700,
                  letterSpacing: 0.5, padding: "2px 8px", borderRadius: 999,
                  border: `1.5px solid ${palette.ink}`, textTransform: "uppercase",
                }}>
                  Most common
                </div>
              )}
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, marginTop: 2 }}>${t.amount}</div>
              <div style={{ fontSize: 10, fontWeight: 500, color: t.featured ? "rgba(255,255,255,0.75)" : palette.inkSoft, marginTop: 2 }}>
                /month · {t.label}
              </div>
            </button>
          ))}
        </div>

        {/* ---- ONE-TIME TIP (secondary) ---- */}
        <div style={{
          marginTop: 20, marginBottom: 6,
          fontSize: 11, letterSpacing: 1, color: palette.inkSoft, fontWeight: 600, textTransform: "uppercase",
        }}>
          Or, leave a one-time tip
        </div>
        <button
          type="button"
          onClick={() => startCheckout("one_time")}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: `1.5px solid ${palette.ink}`,
            background: palette.yolk,
            color: palette.ink,
            textAlign: "center",
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 14,
            boxShadow: "2px 2px 0 " + palette.line,
            cursor: "pointer",
          }}
        >
          🌾 One-time $5 · Bag of feed
        </button>

        {/* ---- Platform-aware checkout footer ---- */}
        {/* On IAP-enabled native, hide the "Stripe" line entirely — Apple
            doesn't want competing payment systems mentioned in IAP-using apps. */}
        {!(isNativeApp() && typeof window !== "undefined" && window.__HENALYTICS_USE_IAP__ === true) && (
          <div style={{
            marginTop: 12, textAlign: "center", fontSize: 12, color: palette.inkSoft, lineHeight: 1.5,
          }}>
            Secure checkout via Stripe — Apple Pay & Google Pay supported.
          </div>
        )}

        {/* ---- Native IAP only: Restore + Manage Subscription ---- */}
        {/* Apple requires a visible "Restore Purchases" button. We also expose
            "Manage Subscription" so users can cancel/change from inside the app. */}
        {isNativeApp() && typeof window !== "undefined" && window.__HENALYTICS_USE_IAP__ === true && (
          <div style={{
            marginTop: 16,
            display: "flex",
            gap: 8,
            justifyContent: "center",
            flexWrap: "wrap",
          }}>
            <button
              type="button"
              onClick={async () => {
                const r = await restorePurchases();
                if (r.success) {
                  toast("Purchases restored. If you had an active subscription, it should now be reflected.");
                } else {
                  toast(r.error || "Couldn't restore purchases.", { kind: "error" });
                }
              }}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: `1.5px solid ${palette.line}`,
                background: "transparent",
                color: palette.inkSoft,
                fontFamily: FONT_BODY,
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Restore Purchases
            </button>
            <button
              type="button"
              onClick={() => openManageSubscriptions()}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: `1.5px solid ${palette.line}`,
                background: "transparent",
                color: palette.inkSoft,
                fontFamily: FONT_BODY,
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Manage Subscription
            </button>
          </div>
        )}

        {/* Apple-required disclosure block for auto-renewing subscriptions.
            Apple App Review (May 2026) requires this to be visible in the
            same view as the subscription purchase buttons. Includes:
              - Length (monthly, auto-renewing)
              - Cancel-anywhere reassurance
              - Functional links to Privacy Policy AND Terms of Use (EULA) */}
        <div style={{
          marginTop: 18,
          padding: "12px 14px",
          background: palette.card,
          borderRadius: 10,
          border: `1px solid ${palette.line}`,
          fontSize: 11,
          lineHeight: 1.5,
          color: palette.inkSoft,
        }}>
          <div style={{ marginBottom: 6 }}>
            Subscriptions auto-renew monthly at the selected price until
            canceled. You can cancel anytime in your device's subscription
            settings, at least 24 hours before the renewal date. Unused
            portions of a free trial (if any) are forfeited when you
            purchase a subscription.
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
            <button
              type="button"
              onClick={() => openExternalUrl("https://henalytics.com/privacy")}
              style={{
                fontSize: 11, color: palette.ink, textDecoration: "underline",
                background: "none", border: "none", padding: 0, cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => openExternalUrl("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")}
              style={{
                fontSize: 11, color: palette.ink, textDecoration: "underline",
                background: "none", border: "none", padding: 0, cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Terms of Use (EULA)
            </button>
          </div>
        </div>

        <div style={{
          marginTop: 20, textAlign: "center", fontSize: 13, color: palette.inkSoft, fontStyle: "italic",
        }}>
          🌱 Thanks for being here.
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// SUPPORTER NAME PROMPT MODAL
// ----------------------------------------------------------------------------
// Fires after the user returns from a successful Stripe checkout
// (?supported=<tier> on the URL). Invites them to add a homestead name to
// the public monthly supporter wall. Three outcomes:
//
//   1. They enter a name → saved to supporters.homestead_name + visible
//   2. They tap "Stay anonymous" → homestead_name_visible = false
//   3. They close the modal → no DB write; they can revisit from Settings later
//
// Profanity is checked client-side (basic word list — same protection ChatGPT
// uses for usernames) AND flagged server-side for review. Auto-rejected names
// don't get saved at all; flagged-but-borderline names are saved with
// homestead_name_flagged=true and don't appear on the wall until approved.
//
// Why client-side write? Supabase RLS allows authenticated users to update
// their own supporter row (homestead_name + visibility fields only). The
// webhook already created the row with their user_id linked, so we just
// patch the existing row.
// ============================================================================

// Minimal profanity check — covers common words + some obfuscated variants.
// Not bulletproof; just a first line of defense before Riley reviews flagged
// names. Server-side review (homestead_name_flagged + manual approval) is
// the real protection. Names exceeding 60 chars also flagged for review.
const BLOCKED_NAME_PATTERNS = [
  /f+u+c+k/i, /s+h+i+t/i, /b+i+t+c+h/i, /a+s+s+h+o+l+e/i,
  /c+u+n+t/i, /d+i+c+k+h+e+a+d/i, /n+i+g+g+e*r/i, /f+a+g+g*o*t/i,
  /r+e+t+a+r+d/i, /\bk+y+s\b/i, /\bk+m+s\b/i,
];
const isLikelyOK = (name) => {
  const trimmed = (name || "").trim();
  if (!trimmed) return false;
  if (trimmed.length > 60) return false;
  // strip whitespace + punctuation for fuzzy match
  const compact = trimmed.toLowerCase().replace(/[\s\.,\-_'"!?@#$%^&*()+=]/g, "");
  for (const pat of BLOCKED_NAME_PATTERNS) {
    if (pat.test(compact) || pat.test(trimmed)) return false;
  }
  return true;
};

function SupporterNamePromptModal({ user, onClose }) {
  const [name, setName] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submitName = async (visible) => {
    setError("");
    setWorking(true);
    try {
      const trimmed = name.trim();

      // If they want to be visible, the name must pass the basic check.
      // If they're going anonymous, we still save an empty name so Riley
      // doesn't get prompted to fill it later.
      let payload;
      if (visible) {
        if (!trimmed) { setError("Please enter a name, or choose 'Stay anonymous'."); setWorking(false); return; }
        const ok = isLikelyOK(trimmed);
        payload = {
          homestead_name: trimmed,
          homestead_name_visible: true,
          homestead_name_flagged: !ok, // server-side review will clear flagged names
          homestead_name_set_at: new Date().toISOString(),
        };
      } else {
        payload = {
          homestead_name: trimmed || null,
          homestead_name_visible: false,
          homestead_name_set_at: new Date().toISOString(),
        };
      }

      // Update the most recent supporter row for this user.
      // RLS allows this because user_id matches auth.uid().
      const { error: updateErr } = await supabase
        .from("supporters")
        .update(payload)
        .eq("user_id", user.id);

      if (updateErr) {
        // Most likely cause: the webhook hasn't created the row yet. Stripe
        // webhook delivery is usually <2s but can occasionally lag. Surface
        // a friendly retry message rather than a generic error.
        console.error("supporter name update failed:", updateErr);
        if (updateErr.code === "PGRST116" || /not found/i.test(updateErr.message || "")) {
          setError("Your contribution is still processing. Please try again in a minute.");
        } else {
          setError("Couldn't save right now. Please try again.");
        }
        setWorking(false);
        return;
      }

      setDone(true);
      setTimeout(() => onClose(), 1600);
    } catch (e) {
      console.error("submitName error:", e);
      setError("Something went wrong. Please try again.");
      setWorking(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(44,24,16,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200, padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: palette.bg, borderRadius: 20, maxWidth: 460, width: "100%",
        border: `2px solid ${palette.ink}`, boxShadow: `6px 8px 0 ${palette.line}`,
        fontFamily: FONT_BODY, overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          background: palette.leaf, padding: "24px 24px 18px", textAlign: "center",
          position: "relative",
        }}>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute", top: 12, right: 12,
              background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%",
              width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
              color: palette.card, cursor: "pointer", padding: 0,
            }}
          >
            <X size={18} />
          </button>
          <div style={{ fontSize: 40, marginBottom: 6 }}>🙏</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, color: palette.card, lineHeight: 1.2 }}>
            Thank you for chipping in.
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
            It really does help keep this thing running.
          </div>
        </div>

        <div style={{ padding: "20px 24px", overflowY: "auto" }}>
          {done ? (
            <div style={{ textAlign: "center", padding: "8px 0 24px", fontSize: 15, color: palette.ink, lineHeight: 1.6 }}>
              ✅ Saved! See you on the wall.
            </div>
          ) : (
            <>
              <p style={{ fontSize: 14, color: palette.ink, lineHeight: 1.6, margin: "0 0 14px" }}>
                On the 1st of each month, Henalytics shows a thank-you wall listing every supporter who chose to be named. If you'd like to be included, add your homestead name below.
              </p>
              <p style={{ fontSize: 12, color: palette.inkSoft, lineHeight: 1.5, margin: "0 0 16px", fontStyle: "italic" }}>
                Totally optional — anonymous is fine. You can always change this later from Settings.
              </p>

              <label style={{ display: "block", marginBottom: 12 }}>
                <div style={{
                  fontSize: 11, color: palette.inkSoft, marginBottom: 6,
                  textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600,
                }}>
                  Homestead name
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(""); }}
                  placeholder="e.g. Bluebird Hollow Farm"
                  maxLength={60}
                  autoFocus
                  disabled={working}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8,
                    border: `1.5px solid ${palette.line}`, background: palette.card,
                    fontFamily: FONT_BODY, fontSize: 15, color: palette.ink, boxSizing: "border-box",
                  }}
                />
                <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4, lineHeight: 1.4 }}>
                  60 characters max. Names go through a quick review.
                </div>
              </label>

              {error && (
                <div style={{
                  padding: 10, background: "#FBE5DE", border: `1.5px solid ${palette.accent}`,
                  borderRadius: 8, fontSize: 13, color: palette.accent, marginBottom: 12,
                  lineHeight: 1.4,
                }}>
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={() => submitName(true)}
                disabled={working || !name.trim()}
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 10,
                  border: `1.5px solid ${palette.ink}`, background: palette.ink,
                  color: palette.bg, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14,
                  cursor: (working || !name.trim()) ? "wait" : "pointer",
                  boxShadow: "2px 2px 0 " + palette.line,
                  opacity: (working || !name.trim()) ? 0.6 : 1,
                  marginBottom: 8,
                }}
              >
                {working ? "Saving..." : "Add me to the wall"}
              </button>

              <button
                type="button"
                onClick={() => submitName(false)}
                disabled={working}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10,
                  border: `1.5px solid ${palette.line}`, background: "transparent",
                  color: palette.inkSoft, fontFamily: FONT_BODY, fontSize: 13,
                  cursor: working ? "wait" : "pointer",
                }}
              >
                Stay anonymous
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FirstSignInModal({ user, localData, onClose, onFreshStart }) {
  // localData is what was in localStorage when they signed in.
  // We've already optimistically loaded it into state; this modal
  // confirms whether to keep it (uploads to cloud) or start fresh.
  const [working, setWorking] = useState(false);

  const counts = (() => {
    if (!localData) return null;
    const totalEntries = Object.values(localData.entries || {}).reduce(
      (s, arr) => s + (Array.isArray(arr) ? arr.length : 0),
      0,
    );
    return { entries: totalEntries, name: localData.homesteadName };
  })();

  const keepLocal = async () => {
    setWorking(true);
    // Push the local data to the cloud — saveHomestead will handle it.
    await saveHomestead(user, localData);
    onClose();
  };

  const startFresh = async () => {
    setWorking(true);
    // Replace state with a fresh default and clear local backup.
    clearLocalHomestead();
    const fresh = defaultData();
    await saveHomestead(user, fresh);
    // Reset parent state to the fresh default in-place; the onboarding wizard
    // will re-open naturally because there are no entries and no onboardedAt.
    // Works on web and native (no reload needed — reload is unavailable in Capacitor).
    if (onFreshStart) onFreshStart();
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Welcome — what do you want to do?">
      <div style={{
        padding: 12, background: palette.yolkSoft, borderRadius: 8,
        fontSize: 13, color: palette.ink, marginBottom: 16, lineHeight: 1.5,
        border: `1.5px solid ${palette.line}`,
      }}>
        You've been using Henalytics on this device without an account. We found:
        {counts && (
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            {counts.name && <li>Homestead: <strong>{counts.name}</strong></li>}
            <li><strong>{counts.entries}</strong> log entries</li>
          </ul>
        )}
      </div>

      <div style={{ fontSize: 13, color: palette.ink, marginBottom: 14, lineHeight: 1.5 }}>
        Now that you're signed in, you have two options:
      </div>

      <button
        onClick={working ? undefined : keepLocal}
        disabled={working}
        style={{
          width: "100%", padding: "14px", marginBottom: 8,
          background: palette.ink, color: palette.bg,
          border: `1.5px solid ${palette.ink}`, borderRadius: 10,
          cursor: working ? "wait" : "pointer", textAlign: "left",
          boxShadow: "2px 2px 0 " + palette.line,
          fontFamily: FONT_BODY,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
          📤 Upload this homestead to my account
        </div>
        <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.4 }}>
          Save everything you've already logged. Your data syncs across devices going forward.
        </div>
      </button>

      <button
        onClick={working ? undefined : startFresh}
        disabled={working}
        style={{
          width: "100%", padding: "14px",
          background: palette.card, color: palette.ink,
          border: `1.5px solid ${palette.line}`, borderRadius: 10,
          cursor: working ? "wait" : "pointer", textAlign: "left",
          boxShadow: "2px 2px 0 " + palette.line,
          fontFamily: FONT_BODY,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
          🌱 Start fresh on my account
        </div>
        <div style={{ fontSize: 12, color: palette.inkSoft, lineHeight: 1.4 }}>
          Begin with an empty homestead. Your local data will be cleared.
        </div>
      </button>

      <div style={{
        fontSize: 11, color: palette.inkSoft, marginTop: 14, lineHeight: 1.5,
        padding: 10, background: palette.bgAlt, borderRadius: 6,
      }}>
        💡 You can sign out anytime in Settings. Your account email is only used for support — never shared.
      </div>
    </Modal>
  );
}

function RenameHomesteadModal({ data, update, onClose }) {
  const [name, setName] = useState(data.homesteadName || "");
  return (
    <Modal open onClose={onClose} title="Name your homestead">
      <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14 }}>
        Give your place a name. It'll show at the top of every page.
      </div>
      <Field label="Homestead name">
        <input
          style={inputStyle}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Slow Build Acres, Willow Creek Farm..."
          autoFocus
          maxLength={40}
        />
      </Field>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="primary" onClick={() => {
          update((d) => { d.homesteadName = name.trim(); return d; });
          onClose();
        }}>Save name</Btn>
        {data.homesteadName && (
          <Btn variant="ghost" onClick={() => {
            update((d) => { d.homesteadName = ""; return d; });
            onClose();
          }}>Clear</Btn>
        )}
      </div>
    </Modal>
  );
}

function LocationModal({ data, update, onClose }) {
  const current = data.homesteadLocation;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const [searchResults, setSearchResults] = useState(null);

  const useGPS = async () => {
    setBusy(true); setError(""); setSearchResults(null);
    try {
      const { lat, lon } = await requestBrowserLocation();
      const geocode = await reverseGeocode(lat, lon);
      const label = geocode?.label;
      const countryCode = geocode?.countryCode;
      update((d) => {
        d.homesteadLocation = { lat, lon, label: label || `${lat.toFixed(3)}, ${lon.toFixed(3)}` };
        // Auto-detect hardiness system from the resolved country, but only if
        // the user hasn't manually set one yet. Respecting their choice is
        // important — someone who picked USDA Zone 6a deliberately shouldn't
        // get switched to RHS just because their phone is in France.
        if (!d.userZoneSystem && countryCode) {
          const detected = autoDetectHardiness(countryCode, lat, lon);
          d.userZoneSystem = detected.system;
          d.userZone = detected.zone;
        }
        return d;
      });
      onClose();
    } catch (e) {
      setError(e.message || "Could not get location.");
    } finally {
      setBusy(false);
    }
  };

  const useTyped = async (e) => {
    e.preventDefault();
    setBusy(true); setError(""); setSearchResults(null);
    try {
      const result = await geocodePlace(typed);
      if (!result) {
        setError("Couldn't find that place. Try including the state or country.");
      } else {
        setSearchResults(result);
      }
    } catch (e) {
      setError(e.message || "Search failed.");
    } finally {
      setBusy(false);
    }
  };

  const confirmTyped = () => {
    if (!searchResults) return;
    update((d) => {
      d.homesteadLocation = searchResults;
      // Auto-set hardiness system from the geocoded country, if not already set.
      if (!d.userZoneSystem && searchResults.countryCode) {
        const detected = autoDetectHardiness(
          searchResults.countryCode,
          searchResults.lat,
          searchResults.lon
        );
        d.userZoneSystem = detected.system;
        d.userZone = detected.zone;
      }
      return d;
    });
    onClose();
  };

  const clearLocation = () => {
    update((d) => { d.homesteadLocation = null; return d; });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Homestead location">
      <div style={{
        padding: 12, background: palette.yolkSoft, borderRadius: 8,
        fontSize: 13, color: palette.ink, marginBottom: 16, lineHeight: 1.5,
        border: `1.5px solid ${palette.line}`,
      }}>
        Set your location once and Henalytics will auto-attach the day's weather (high temp, rain) to every entry you log. Useful for spotting patterns over time.
      </div>

      {current && (
        <div style={{
          padding: 10, background: palette.leafSoft, borderRadius: 8,
          fontSize: 13, color: palette.ink, marginBottom: 16,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <CheckCircle size={16} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>Currently set</div>
            <div style={{ fontSize: 12 }}>
              {current.label || `${current.lat.toFixed(3)}, ${current.lon.toFixed(3)}`}
            </div>
          </div>
          <button
            onClick={clearLocation}
            style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, padding: 4 }}
            title="Clear location"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      <div style={{
        fontSize: 11, color: palette.inkSoft, marginBottom: 6,
        textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600,
      }}>
        Option 1 — Use my current location
      </div>
      <Btn variant="primary" onClick={useGPS} disabled={busy} style={{ width: "100%", marginBottom: 18 }}>
        {busy ? "Locating..." : "📍 Detect my location"}
      </Btn>

      <div style={{
        fontSize: 11, color: palette.inkSoft, marginBottom: 6,
        textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600,
      }}>
        Option 2 — Type a city
      </div>
      <form onSubmit={useTyped}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            style={inputStyle}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Kansas City"
            disabled={busy}
          />
          <Btn variant="ghost" type="submit" disabled={busy || !typed.trim()}>
            Search
          </Btn>
        </div>
      </form>

      {searchResults && (
        <div style={{
          padding: 12, background: palette.card, border: `1.5px solid ${palette.ink}`,
          borderRadius: 8, marginBottom: 12,
        }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: palette.ink, marginBottom: 4 }}>
            Found: {searchResults.label}
          </div>
          <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 10 }}>
            {searchResults.lat.toFixed(3)}, {searchResults.lon.toFixed(3)}
          </div>
          <Btn variant="primary" onClick={confirmTyped} small>Use this location</Btn>
        </div>
      )}

      {error && (
        <div style={{
          padding: 10, background: "#FBE5DE", border: `1.5px solid ${palette.accent}`,
          borderRadius: 8, fontSize: 13, color: palette.accent, marginTop: 8,
          display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 16, lineHeight: 1.5 }}>
        Your location is stored only in your homestead data — never shared or sold. Weather is fetched from the free Open-Meteo service.
      </div>
    </Modal>
  );
}

function FeedbackModal({ onClose, presetCategory, user }) {
  const isHobbyRequest = presetCategory === "hobby";
  const [message, setMessage] = useState(
    isHobbyRequest
      ? "I'd love to see this hobby added:\n\n(Hobby name)\n\nWhat I'd want to track:\n- \n- \n- "
      : ""
  );
  const [category, setCategory] = useState(presetCategory || "idea");
  const [fromEmail, setFromEmail] = useState(user?.email || "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  // Push 6 — true when the last send failed specifically because our Resend
  // daily quota was hit. The UI renders a friendly yellow info card in this
  // case (instead of the red error box), because it's not really an error,
  // it's a service-level issue users should understand and the email
  // fallbacks still work.
  const [isRateLimit, setIsRateLimit] = useState(false);
  // True for ~2 seconds after the user taps "Copy message" — gives clear
  // confirmation that the action worked. The mailto/Gmail links can silently
  // fail on some native WebViews; copy is the always-works fallback.
  const [justCopied, setJustCopied] = useState(false);

  const copyFallback = async () => {
    const text = `To: slowbuildacres@gmail.com\nSubject: ${subject}\n\n${body}`;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (_) {
      // Older WebView / iOS Safari fallback: select+execCommand
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        ok = true;
      } catch (_) {
        // Truly unsupported environment — leave silently; mailto link is still
        // present and the user can long-press to copy the email manually.
      }
    }
    if (ok) {
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2500);
    }
  };

  const send = async () => {
    setError("");
    setIsRateLimit(false);
    if (!message.trim()) {
      setError("Please write a message first.");
      return;
    }
    setSending(true);
    try {
      await sendFeedback({
        category,
        message,
        fromEmail: fromEmail.trim() || null,
      });
      setSent(true);
    } catch (e) {
      // The sync.js sendEmail helper tags rate-limit errors with .kind === 'rate_limit'
      // so we can show a friendly explanation instead of a generic red error box.
      if (e && e.kind === 'rate_limit') {
        setIsRateLimit(true);
        setError(e.message || "We've hit our daily email send limit. Please try again tomorrow or use the email fallback below.");
      } else {
        setError(e.message || "Could not send. Please try the fallback options below.");
      }
    } finally {
      setSending(false);
    }
  };

  // Fallback: if direct send is failing, give them the old options
  const subject = `Henalytics feedback: ${category}`;
  const body = `Category: ${category}\n\n${message}\n\n${fromEmail ? "From: " + fromEmail + "\n" : ""}---\nSent from Henalytics.`;
  const mailtoHref = `mailto:slowbuildacres@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=slowbuildacres@gmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  if (sent) {
    return (
      <Modal open onClose={onClose} title="Thanks! 🌱">
        <div style={{
          padding: 20, background: palette.leafSoft, borderRadius: 10,
          fontSize: 14, color: palette.ink, marginBottom: 16, lineHeight: 1.5,
          textAlign: "center",
        }}>
          <CheckCircle size={32} style={{ marginBottom: 10 }} />
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, marginBottom: 6 }}>
            Message sent
          </div>
          <div>I'll read it and reply if you included an email. Thanks for helping shape Henalytics!</div>
        </div>
        <Btn variant="primary" onClick={onClose}>Done</Btn>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={isHobbyRequest ? "Request a hobby" : "How can I improve?"}>
      <div style={{
        padding: 12, background: palette.yolkSoft, borderRadius: 8,
        fontSize: 13, color: palette.ink, marginBottom: 16, lineHeight: 1.5,
        border: `1.5px solid ${palette.line}`,
      }}>
        <Heart size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
        {isHobbyRequest
          ? <>What hobby would you like to see added? Tell me what you'd want to track and I'll work on adding it. Your message goes directly to <strong>slowbuildacres@gmail.com</strong>.</>
          : <>Got an idea, bug, or feature request? Type it below and tap Send — your message goes directly to <strong>slowbuildacres@gmail.com</strong>.</>
        }
      </div>

      <Field label="Type of feedback">
        <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="idea">💡 New idea</option>
          <option value="bug">🐛 Bug report</option>
          <option value="hobby">🌱 New hobby/category request</option>
          <option value="other">💬 Other</option>
        </select>
      </Field>

      <Field label="Your message">
        <textarea
          style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What would make this app better for you?"
          autoFocus
          disabled={sending}
        />
      </Field>

      <Field label="Your email (optional, so I can reply)">
        <input
          type="email"
          style={inputStyle}
          value={fromEmail}
          onChange={(e) => setFromEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={sending}
        />
      </Field>

      {error && isRateLimit && (
        // Friendly yellow info card for the rate-limit case. Not really an
        // error from the user's perspective — they did everything right,
        // it's a service-tier issue. The fallback details/Gmail/mailto
        // links below still appear so they have an alternate path.
        <div style={{
          padding: 12, background: palette.yolkSoft, border: `1.5px solid ${palette.yolk}`,
          borderRadius: 8, fontSize: 13, color: palette.ink, marginBottom: 14,
          display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.5,
        }}>
          <Heart size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}

      {error && !isRateLimit && (
        <div style={{
          padding: 10, background: "#FBE5DE", border: `1.5px solid ${palette.accent}`,
          borderRadius: 8, fontSize: 13, color: palette.accent, marginBottom: 14,
          display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      <Btn variant="primary" onClick={send} disabled={sending} style={{ width: "100%" }}>
        {sending ? "Sending..." : "Send message"}
      </Btn>

      {error && (
        <details style={{ marginTop: 14, fontSize: 12, color: palette.inkSoft }}>
          <summary style={{ cursor: "pointer" }}>Or send via your email app instead</summary>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button
              type="button"
              onClick={() => openExternalUrl(gmailHref)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 12px", borderRadius: 8,
                fontSize: 12, fontWeight: 600,
                background: palette.ink, color: palette.bg,
                border: `1.5px solid ${palette.ink}`,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <Mail size={12} /> Open in Gmail
            </button>
            <a
              href={mailtoHref}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 12px", borderRadius: 8, textDecoration: "none",
                fontSize: 12, fontWeight: 600,
                background: palette.yolk, color: palette.ink,
                border: `1.5px solid ${palette.ink}`,
              }}
            >
              <Mail size={12} /> Open mail app
            </a>
            <button
              type="button"
              onClick={copyFallback}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 12px", borderRadius: 8,
                fontSize: 12, fontWeight: 600,
                background: "transparent", color: palette.ink,
                border: `1.5px solid ${palette.line}`,
                cursor: "pointer", fontFamily: FONT_BODY,
              }}
            >
              {justCopied ? "✓ Copied" : "Copy message"}
            </button>
          </div>
        </details>
      )}

      <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 14, lineHeight: 1.5 }}>
        Your email is only used to read & reply to your feedback — never shared.
      </div>
    </Modal>
  );
}



function AddHobbyModal({ update, onClose }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("garden");
  return (
    <Modal open onClose={onClose} title="Add a hobby">
      <Field label="Name">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bees, Goats" />
      </Field>
      <Field label="Behavior template">
        <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="garden">Like Garden (planting/harvest)</option>
          <option value="egg_layers">Like Egg Layers (ongoing flock)</option>
          <option value="meat_chickens">Like Meat Birds (seasonal batches)</option>
          <option value="custom">Custom (just notes)</option>
        </select>
      </Field>
      <Btn variant="primary" onClick={() => {
        if (!name.trim()) return;
        update((d) => {
          const id = name.toLowerCase().replace(/\s+/g, "_") + "_" + newId().slice(0, 4);
          const newHobby = { id, name: name.trim(), type, icon: "sprout" };
          if (type === "egg_layers") { newHobby.flockSize = 0; newHobby.flockHistory = []; }
          if (type === "meat_chickens") { newHobby.currentBatches = []; newHobby.archivedBatches = []; }
          d.hobbies.push(newHobby);
          return d;
        });
        onClose();
      }}>Add hobby</Btn>
    </Modal>
  );
}

function ManageHobbiesModal({ data, update, onClose, setActiveHobby, setPage, setModal }) {
  const friendlyType = { garden: "Garden", egg_layers: "Egg Layers", meat_chickens: "Meat Birds", rabbits: "Rabbits", bees: "Beekeeping", incubator: "Incubator", goats: "Goats", cows: "Cows", pigs: "Pigs", sheep: "Sheep", horses: "Horses", dogs: "Dogs", cats: "Cats", maple_syrup: "Maple Syrup", tincture: "Tinctures", oil_infusion: "Oil Infusions", salve: "Salves", tea: "Tea Blends" };

  // Category groups. Each group is a list of hobby types it contains.
  // Hobby types NOT in any group render flat at the top of the modal.
  const GROUPS = [
    { id: "livestock",  label: "Livestock",     types: ["goats", "cows", "pigs", "sheep", "horses"] },
    { id: "kitchen",    label: "Kitchen",       types: ["baking", "sourdough"] },
    { id: "preserving", label: "Preserving 🥫", types: ["canning", "freeze_drying", "dehydrating", "fermentation"] },
    { id: "herbalism",  label: "Herbalism 🌿",  types: ["tincture", "oil_infusion", "salve", "tea"] },
  ];

  // Per-group "show all" state. Default false so only enabled hobbies show
  // initially — keeps the list short. User taps "See more" to reveal all.
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const init = {};
    GROUPS.forEach(g => { init[g.id] = false; });
    return init;
  });

  // Map hobby type → group id, for partitioning the hobby list
  const typeToGroup = {};
  GROUPS.forEach(g => g.types.forEach(t => { typeToGroup[t] = g.id; }));

  // The "jump to" logic that runs after enabling a hidden hobby. Routes the
  // user straight into the page they just enabled (same as before, but
  // extracted so we can call it from the reusable HobbyRow).
  const jumpToHobby = (h) => {
    if (h.type === "rabbits") { setActiveHobby("rabbits"); setPage("rabbits"); }
    else if (h.type === "bees") { setActiveHobby("bees"); setPage("bees"); }
    else if (h.type === "incubator") { setActiveHobby("incubator"); setPage("incubator"); }
    else if (h.type === "goats") { setActiveHobby("goats"); setPage("goats"); }
    else if (h.type === "cows") { setActiveHobby("cows"); setPage("cows"); }
    else if (h.type === "pigs") { setActiveHobby("pigs"); setPage("pigs"); }
    else if (h.type === "sheep") { setActiveHobby("sheep"); setPage("sheep"); }
    else if (h.type === "horses") { setActiveHobby("horses"); setPage("horses"); }
    else if (h.type === "sourdough") { setActiveHobby("sourdough"); setPage("sourdough"); }
    else if (h.type === "farmstand") { setActiveHobby("farmstand"); setPage("farmstand"); }
    else if (h.type === "baking") { setActiveHobby("baking"); setPage("baking"); }
    else if (h.type === "canning") { setActiveHobby("canning"); setPage("canning"); }
    else if (h.type === "freeze_drying") { setActiveHobby("freeze_drying"); setPage("freeze_drying"); }
    else if (h.type === "dehydrating") { setActiveHobby("dehydrating"); setPage("dehydrating"); }
    else if (h.type === "fermentation") { setActiveHobby("fermentation"); setPage("fermentation"); }
    else if (h.type === "tincture") { setActiveHobby("tincture"); setPage("tincture"); }
    else if (h.type === "oil_infusion") { setActiveHobby("oil_infusion"); setPage("oil_infusion"); }
    else if (h.type === "salve") { setActiveHobby("salve"); setPage("salve"); }
    else if (h.type === "tea") { setActiveHobby("tea"); setPage("tea"); }
    else if (h.type === "dogs") { setActiveHobby("dogs"); setPage("dogs"); }
    else if (h.type === "cats") { setActiveHobby("cats"); setPage("cats"); }
    else if (h.type === "maple_syrup") { setActiveHobby("maple_syrup"); setPage("maple_syrup"); }
    else { setActiveHobby(h.id); setPage("home"); }
    onClose();
  };

  // Render a single hobby row (toggle + name). Extracted so the same JSX
  // works inside groups and in the ungrouped flat list at the top.
  const renderHobbyRow = (h) => (
    <div key={h.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 10 }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: palette.ink }}>{h.name}</div>
        <div style={{ fontSize: 11, color: palette.inkSoft }}>{friendlyType[h.type] || h.type}</div>
      </div>
      <button
        onClick={() => {
          const wasHidden = h.hidden;
          update(d => { const hob = d.hobbies.find(x => x.id === h.id); if (hob) hob.hidden = !hob.hidden; return d; });
          if (wasHidden) jumpToHobby(h);
        }}
        style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${palette.line}`, background: h.hidden ? palette.ink : palette.bgAlt, color: h.hidden ? palette.bg : palette.inkSoft, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
      >
        {h.hidden ? "Enable" : "Visible ✓"}
      </button>
    </div>
  );

  // Partition the hobbies list. Flat = uncategorized; groupedHobbies maps
  // group id → array of hobbies in that group, preserving the original
  // data.hobbies order so the user's mental layout is stable.
  const flatHobbies = data.hobbies.filter(h => !typeToGroup[h.type]);
  const groupedHobbies = {};
  GROUPS.forEach(g => { groupedHobbies[g.id] = []; });
  data.hobbies.forEach(h => {
    if (typeToGroup[h.type]) groupedHobbies[typeToGroup[h.type]].push(h);
  });

  return (
    <Modal open onClose={onClose} title="Manage Hobbies">
      <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Toggle hobbies on or off. Hidden hobbies keep their data — they just won't show in the menu.
      </div>

      {/* Ungrouped hobbies — render flat at the top */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {flatHobbies.map(renderHobbyRow)}
      </div>

      {/* Grouped sections — each is a collapsible card. Tap the header to
          reveal all hobbies in that group. Defaults closed so the modal
          stays short; users expand the categories they care about. */}
      {GROUPS.map(group => {
        const hobbies = groupedHobbies[group.id];
        if (hobbies.length === 0) return null;
        const enabledCount = hobbies.filter(h => !h.hidden).length;
        const isExpanded = expandedGroups[group.id];
        return (
          <div key={group.id} style={{ marginBottom: 12 }}>
            <button
              onClick={() => setExpandedGroups(g => ({ ...g, [group.id]: !g[group.id] }))}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10,
                background: palette.card, border: `1.5px solid ${palette.line}`,
                cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                fontFamily: FONT_DISPLAY, fontSize: 17, color: palette.ink,
              }}
            >
              <span>{group.label}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {enabledCount > 0 && (
                  <span style={{
                    fontFamily: FONT_BODY, fontSize: 11, fontWeight: 600,
                    color: palette.inkSoft,
                    background: palette.bgAlt, padding: "2px 8px", borderRadius: 999,
                  }}>
                    {enabledCount} on
                  </span>
                )}
                <span style={{
                  fontFamily: FONT_BODY, fontSize: 14, color: palette.inkSoft,
                  transform: isExpanded ? "rotate(180deg)" : "",
                  transition: "transform 0.2s", display: "inline-block",
                }}>▼</span>
              </span>
            </button>
            {isExpanded && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {hobbies.map(renderHobbyRow)}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ marginTop: 8, paddingTop: 12, borderTop: `1.5px solid ${palette.line}`, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 11, color: palette.inkSoft, textAlign: "center" }}>Go to Settings to toggle visibility anytime.</div>
        <button
          onClick={() => { onClose(); setTimeout(() => setModal({ type: "reorderHobbies" }), 100); }}
          style={{ width: "100%", padding: "10px", background: palette.bgAlt, border: `1.5px solid ${palette.line}`, borderRadius: 8, cursor: "pointer", fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13, color: palette.ink }}
        >
          ↕ Reorder hobbies
        </button>
        <button
          onClick={() => { onClose(); setTimeout(() => setModal({ type: "feedback", presetCategory: "hobby" }), 100); }}
          style={{ width: "100%", padding: "10px", background: palette.yolkSoft, border: `1.5px solid ${palette.line}`, borderRadius: 8, cursor: "pointer", fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13, color: palette.ink }}
        >
          💡 Suggest a new hobby
        </button>
      </div>
    </Modal>
  );
}

// ============================================================================
// REORDER HOBBIES MODAL
// ----------------------------------------------------------------------------
// Lets the user change the order their visible hobbies appear in the picker
// dropdown. The first hobby in the list becomes the default tab when the app
// loads. Up/down arrows are used instead of drag-and-drop for accessibility
// and to keep mobile interactions predictable.
//
// Preserving sub-types (canning, freeze_drying, dehydrating, fermentation)
// render in the picker as a single "Preserving 🥫" entry, so we treat all
// four as one unit here too — moving "Preserving" moves the whole block.
// ============================================================================
function ReorderHobbiesModal({ data, update, onClose }) {
  const PRESERVING_TYPES = ["canning", "freeze_drying", "dehydrating", "fermentation"];
  const HERBALISM_TYPES = ["tincture", "oil_infusion", "salve", "tea"];

  // Build the "display rows" — same set of items the picker shows. Each row
  // is either a single hobby or the preserving-as-one / herbalism-as-one block.
  // We compute this on every render rather than caching so the modal reflects
  // the latest order as soon as a move lands.
  const buildRows = () => {
    const visible = data.hobbies.filter(h => !h.hidden);
    const rows = [];
    let preservingPlaced = false;
    let herbalismPlaced = false;
    visible.forEach(h => {
      if (PRESERVING_TYPES.includes(h.type)) {
        if (!preservingPlaced) {
          const members = visible.filter(x => PRESERVING_TYPES.includes(x.type));
          rows.push({
            key: "preserving",
            label: "Preserving 🥫",
            icon: "sprout",
            isPreserving: true,
            memberIds: members.map(m => m.id),
          });
          preservingPlaced = true;
        }
      } else if (HERBALISM_TYPES.includes(h.type)) {
        if (!herbalismPlaced) {
          const members = visible.filter(x => HERBALISM_TYPES.includes(x.type));
          rows.push({
            key: "herbalism",
            label: "Herbalism 🌿",
            icon: "sprout",
            isPreserving: false,
            memberIds: members.map(m => m.id),
          });
          herbalismPlaced = true;
        }
      } else {
        rows.push({
          key: h.id,
          label: h.name,
          icon: h.icon,
          isPreserving: false,
          memberIds: [h.id],
        });
      }
    });
    return rows;
  };

  const rows = buildRows();

  // Move a row up or down by one position. "Position" here is logical (the
  // row's index in the rendered list); we translate it into actual moves on
  // data.hobbies, which may involve moving multiple ids (the preserving block).
  const moveRow = (rowIndex, direction) => {
    if (direction === "up" && rowIndex === 0) return;
    if (direction === "down" && rowIndex === rows.length - 1) return;

    const targetIndex = direction === "up" ? rowIndex - 1 : rowIndex + 1;
    const movingRow = rows[rowIndex];
    const swappingRow = rows[targetIndex];

    update(d => {
      // Strategy: rebuild data.hobbies in the new order.
      // 1. Pull out the moving row's members and the swapping row's members
      //    (keeping their original objects)
      // 2. Build a new list: original order, but with the two rows' members
      //    swapped at their respective slots.
      //
      // Because hidden hobbies don't appear in `rows`, we need to interleave
      // them carefully — they stay at the end of the array since they don't
      // affect picker ordering.
      // Map of id → object so we can reconstruct hobbies in any order
      const byId = {};
      d.hobbies.forEach(h => { byId[h.id] = h; });

      // Compute the new order of visible hobby ids.
      // Walk through `rows` in the new order (with rowIndex and targetIndex
      // swapped) and flatten each row's memberIds.
      const newRowOrder = [...rows];
      newRowOrder[rowIndex] = swappingRow;
      newRowOrder[targetIndex] = movingRow;
      const newVisibleIds = newRowOrder.flatMap(r => r.memberIds);

      // Hidden hobbies stay at the end in their existing relative order.
      const hiddenHobbies = d.hobbies.filter(h => h.hidden);
      d.hobbies = [
        ...newVisibleIds.map(id => byId[id]),
        ...hiddenHobbies,
      ];
      return d;
    });
  };

  return (
    <Modal open onClose={onClose} title="Reorder Hobbies">
      <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Set the order your hobbies appear in the picker dropdown. The first one in this list opens by default when you reload the app.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((row, i) => (
          <div
            key={row.key}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px",
              background: palette.card,
              border: `1.5px solid ${palette.line}`,
              borderRadius: 10,
            }}
          >
            <HobbyIcon name={row.icon} size={20} strokeWidth={1.5} />
            <div style={{
              flex: 1, minWidth: 0,
              fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: palette.ink,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {row.label}
            </div>
            <button
              onClick={() => moveRow(i, "up")}
              disabled={i === 0}
              aria-label="Move up"
              style={{
                padding: 8, borderRadius: 6,
                border: `1.5px solid ${palette.line}`,
                background: i === 0 ? palette.bgAlt : palette.bg,
                cursor: i === 0 ? "not-allowed" : "pointer",
                opacity: i === 0 ? 0.4 : 1,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: palette.ink,
              }}
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={() => moveRow(i, "down")}
              disabled={i === rows.length - 1}
              aria-label="Move down"
              style={{
                padding: 8, borderRadius: 6,
                border: `1.5px solid ${palette.line}`,
                background: i === rows.length - 1 ? palette.bgAlt : palette.bg,
                cursor: i === rows.length - 1 ? "not-allowed" : "pointer",
                opacity: i === rows.length - 1 ? 0.4 : 1,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: palette.ink,
              }}
            >
              <ChevronDown size={16} />
            </button>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: palette.inkSoft, fontSize: 13 }}>
          No visible hobbies to reorder. Enable a hobby from the Manage Hobbies menu first.
        </div>
      )}

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1.5px solid ${palette.line}`, fontSize: 11, color: palette.inkSoft, textAlign: "center", lineHeight: 1.5 }}>
        Preserving sub-types (canning, fermentation, etc.) move as a group since they share one tab in the picker.
      </div>
    </Modal>
  );
}

// Species-aware sex names. Returned values are the labels we show in UI;
// the underlying data fields are always `females` / `males` so we never have
// to translate when computing stats. "Hen" doubles as the female word for
// chickens, turkeys, AND quail, so quite a few species share the same label.
// Helpers return both the singular and plural form when count matters.
function sexNames(birdType) {
  const t = birdType || "Chicken";
  if (t === "Duck")    return { female: "duck",   male: "drake",   femalePl: "ducks",   malePl: "drakes" };
  if (t === "Goose")   return { female: "goose",  male: "gander",  femalePl: "geese",   malePl: "ganders" };
  if (t === "Turkey")  return { female: "hen",    male: "tom",     femalePl: "hens",    malePl: "toms" };
  if (t === "Quail")   return { female: "hen",    male: "cock",    femalePl: "hens",    malePl: "cocks" };
  if (t === "Peafowl") return { female: "peahen", male: "peacock", femalePl: "peahens", malePl: "peacocks" };
  // Chicken, Guinea, Other — chicken terms read fine for the rest.
  return { female: "hen", male: "rooster", femalePl: "hens", malePl: "roosters" };
}

function AddFlockModal({ hobbyId, update, onClose }) {
  const BIRD_TYPES = ["Chicken", "Duck", "Turkey", "Quail", "Goose", "Guinea", "Peafowl", "Other"];
  const [name, setName] = useState("");
  const [birdType, setBirdType] = useState("Chicken");
  const [count, setCount] = useState("");
  const [females, setFemales] = useState("");
  const [males, setMales] = useState("");
  const [date, setDate] = useState(todayStr());
  const [cost, setCost] = useState("");
  const [purchasedFrom, setPurchasedFrom] = useState("");
  const sn = sexNames(birdType);
  // Total updates live as the user types — preview goes under the inputs so
  // it's clear they don't have to add the numbers themselves.
  const totalPreview = (parseInt(females) || 0) + (parseInt(males) || 0);
  return (
    <Modal open onClose={onClose} title="Add a flock">
      <Field label="Flock name">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Flock, Duck Pen, Turkey Run" autoFocus />
      </Field>
      <Field label="Bird type">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {BIRD_TYPES.map(t => (
            <button key={t} onClick={() => setBirdType(t)} style={{ padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${birdType===t?palette.ink:palette.line}`, background: birdType===t?palette.ink:palette.card, color: birdType===t?palette.bg:palette.ink, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t}</button>
          ))}
        </div>
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label={`Number of ${sn.femalePl}`}>
            <input type="number" inputMode="numeric" min={0} style={inputStyle} value={females} onChange={(e) => setFemales(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label={`Number of ${sn.malePl}`}>
            <input type="number" inputMode="numeric" min={0} style={inputStyle} value={males} onChange={(e) => setMales(e.target.value)} placeholder="0" />
          </Field>
        </div>
      </div>
      {totalPreview > 0 && (
        <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: -8, marginBottom: 8, fontStyle: "italic" }}>
          Total: {totalPreview} bird{totalPreview === 1 ? "" : "s"}
        </div>
      )}
      <Field label="Date acquired">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Cost (optional)">
        <input type="number" inputMode="decimal" step="0.01" style={inputStyle} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="$" />
      </Field>
      <Field label="Where purchased (optional)">
        <input style={inputStyle} value={purchasedFrom} onChange={(e) => setPurchasedFrom(e.target.value)} placeholder="e.g. Murray McMurray, Tractor Supply, neighbor" />
      </Field>
      <Btn variant="primary" onClick={() => {
        const f = parseInt(females) || 0;
        const m = parseInt(males) || 0;
        const n = f + m;
        if (!n || n < 1 || !name.trim()) return;
        update((d) => {
          const h = d.hobbies.find((x) => x.id === hobbyId);
          if (!h) return d;
          if (!Array.isArray(h.flocks)) h.flocks = [];
          h.flocks.push({ id: Math.random().toString(36).slice(2,10), name: name.trim(), birdType, birdCount: n, females: f, males: m, broodyCount: 0, startDate: date, cost: parseFloat(cost) || 0, purchasedFrom: purchasedFrom.trim(), history: [{ date, count: n, females: f, males: m, cost: parseFloat(cost)||0, purchasedFrom: purchasedFrom.trim() }], eggBasket: null });
          return d;
        });
        onClose();
      }}>Add flock</Btn>
    </Modal>
  );
}

// ============================================================================
// NAMED BIRDS MODAL — optional per-flock list of named individual birds with
// leg band color. Doesn't replace birdCount on the flock — these are favorites
// or otherwise notable birds the user wants to track by name.
// ============================================================================
function NamedBirdsModal({ hobbyId, flockId, hobby, update, onClose }) {
  const flock = (hobby.flocks || []).find(f => f.id === flockId);
  const [birds, setBirds] = useState(() =>
    (flock?.namedBirds || []).map(b => ({ ...b }))
  );
  const [newName, setNewName] = useState("");
  const [newBandColor, setNewBandColor] = useState("");
  // Breed picker — optional, defaults to none. The list is keyed off the
  // flock's birdType so chicken-keepers see chicken breeds, duck-keepers
  // see duck breeds, etc. "Other" surfaces a free-text input for breeds
  // not in our preset list.
  const [newBreed, setNewBreed] = useState("");
  const [newBreedOther, setNewBreedOther] = useState("");
  // Per-bird death confirm state. When set, that bird's row expands to ask
  // for date + cause and commit immediately (death isn't undoable via Cancel).
  const [dyingBirdId, setDyingBirdId] = useState(null);
  const [deathDate, setDeathDate] = useState(todayStr());
  const [deathCause, setDeathCause] = useState("");

  if (!flock) { onClose(); return null; }

  const COMMON_COLORS = [
    { hex: "", label: "(no band)" },
    { hex: "#E63946", label: "Red" },
    { hex: "#F4A261", label: "Orange" },
    { hex: "#E9C46A", label: "Yellow" },
    { hex: "#7AB852", label: "Green" },
    { hex: "#3F7CAC", label: "Blue" },
    { hex: "#7B4F9B", label: "Purple" },
    { hex: "#FF9CCB", label: "Pink" },
    { hex: "#FFFFFF", label: "White" },
    { hex: "#1A1A1A", label: "Black" },
  ];

  // Breed lists per bird type. Curated to the most common breeds homesteaders
  // raise — covering the 90% case while keeping the dropdown short enough to
  // scan. Users with rare/uncommon breeds pick "Other" and type the name.
  const BREEDS_BY_TYPE = {
    Chicken: ["Rhode Island Red", "Plymouth Rock", "Barred Rock", "Buff Orpington", "Australorp", "Leghorn", "Wyandotte", "Easter Egger", "Ameraucana", "Marans", "Brahma", "Cochin", "Silkie", "Sussex", "Welsummer", "Speckled Sussex", "ISA Brown", "Cornish Cross", "Polish", "Sebright", "Mixed", "Other"],
    Duck: ["Pekin", "Khaki Campbell", "Runner", "Welsh Harlequin", "Cayuga", "Rouen", "Muscovy", "Saxony", "Magpie", "Buff", "Mixed", "Other"],
    Turkey: ["Broad Breasted White", "Broad Breasted Bronze", "Bourbon Red", "Narragansett", "Royal Palm", "Heritage", "Midget White", "Mixed", "Other"],
    Quail: ["Coturnix", "Bobwhite", "Button", "California", "Gambel's", "Mixed", "Other"],
    Goose: ["Embden", "Toulouse", "African", "Chinese", "Pilgrim", "American Buff", "Sebastopol", "Mixed", "Other"],
    Guinea: ["Pearl", "White", "Lavender", "Royal Purple", "Buff", "Mixed", "Other"],
    Peafowl: ["Indian Blue", "White", "Black-Shouldered", "Pied", "Spalding", "Mixed", "Other"],
    Other: ["Mixed", "Other"],
  };
  const breedOptions = BREEDS_BY_TYPE[flock.birdType] || BREEDS_BY_TYPE.Other;

  const addBird = () => {
    if (!newName.trim()) return;
    // Resolve breed: "Other" surfaces the free-text input; everything else
    // uses the dropdown value directly. Empty is fine — breed is optional.
    const resolvedBreed = newBreed === "Other"
      ? newBreedOther.trim()
      : newBreed;
    setBirds(prev => [...prev, {
      id: Math.random().toString(36).slice(2, 10),
      name: newName.trim(),
      bandColor: newBandColor,
      breed: resolvedBreed,
      notes: "",
    }]);
    setNewName("");
    setNewBandColor("");
    setNewBreed("");
    setNewBreedOther("");
  };

  const updateBird = (id, patch) => {
    setBirds(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  };

  const removeBird = (id) => {
    setBirds(prev => prev.filter(b => b.id !== id));
  };

  // Mark a named bird as died. This commits IMMEDIATELY (bypassing the modal's
  // local birds state and the Cancel-on-close protection) because:
  //   - A death is a real event the user shouldn't be able to undo by closing.
  //   - It also writes a death entry to d.entries and decrements flock.birdCount.
  // The local birds state is updated in lockstep so the UI reflects the change.
  const commitDeath = (birdId) => {
    const bird = birds.find(b => b.id === birdId);
    if (!bird) return;
    const cause = deathCause.trim();
    const date = deathDate || todayStr();
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      const fl = (h.flocks || []).find(x => x.id === flockId);
      if (!fl) return d;
      // Mark archived on the named-bird record. We DON'T commit the full local
      // `birds` array here — only the targeted bird — so any in-progress
      // edits to other birds aren't accidentally saved.
      fl.namedBirds = (fl.namedBirds || []).map(nb =>
        nb.id === birdId
          ? { ...nb, archived: true, archivedReason: cause ? `Died: ${cause}` : "Died", archivedDate: date }
          : nb
      );
      fl.birdCount = Math.max(0, (Number(fl.birdCount) || 0) - 1);
      // Write a death entry so the journal & analytics pick it up.
      d.entries[hobbyId] = d.entries[hobbyId] || [];
      d.entries[hobbyId].push({
        id: Math.random().toString(36).slice(2, 10),
        date,
        action: "death",
        count: 1,
        cause,
        flockId,
        namedBirdId: birdId,
        namedBirdName: bird.name,
        created: Date.now(),
      });
      // Egg-layer hobby's flockSize fallback (mirrors the count-based death
      // path in LogModal at the egg-layer save handler).
      h.flockSize = Math.max(0, (h.flockSize || 0) - 1);
      return d;
    });
    // Reflect in local state so UI updates without round-trip.
    setBirds(prev => prev.map(b =>
      b.id === birdId
        ? { ...b, archived: true, archivedReason: cause ? `Died: ${cause}` : "Died", archivedDate: date }
        : b
    ));
    setDyingBirdId(null);
    setDeathCause("");
    setDeathDate(todayStr());
  };

  // Restore an accidentally-archived bird. Removes the archived flags locally;
  // the actual flock.namedBirds reflects this on Save like other edits.
  // Note: this does NOT delete the death entry from d.entries, on purpose —
  // the historical record stays. User can delete the entry from the journal.
  // It also does NOT re-increment flock.birdCount because we don't know the
  // user's intent (was the count adjusted manually after?). They can edit
  // the count via the flock-edit modal if needed.
  const restoreBird = (birdId) => {
    setBirds(prev => prev.map(b => {
      if (b.id !== birdId) return b;
      const { archived, archivedReason, archivedDate, ...rest } = b;
      return rest;
    }));
  };

  const save = () => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      const fl = (h.flocks || []).find(x => x.id === flockId);
      if (fl) fl.namedBirds = birds.map(b => ({
        ...b,
        name: (b.name || "").trim(),
        breed: (b.breed || "").trim(),
        notes: (b.notes || "").trim(),
      })).filter(b => b.name);
      return d;
    });
    onClose();
  };

  // Split into live + archived so they render in separate sections.
  const liveBirds = birds.filter(b => !b.archived);
  const archivedBirds = birds.filter(b => b.archived);

  return (
    <Modal open onClose={onClose} title={`Named birds — ${flock.name}`}>
      <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Track individual birds in this flock by name and leg band color. Optional — most flocks don't need this, but it's handy for favorites, breeding stock, or birds with quirks worth remembering.
      </div>

      {/* Existing named birds (live) */}
      {liveBirds.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {liveBirds.map(b => (
            <div key={b.id} style={{
              padding: "10px 12px", marginBottom: 8,
              background: palette.card, border: `1.5px solid ${palette.line}`,
              borderRadius: 10,
            }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                {b.bandColor && (
                  <span style={{
                    display: "inline-block", width: 14, height: 14, borderRadius: "50%",
                    background: b.bandColor, border: `1.5px solid ${palette.line}`, flexShrink: 0,
                  }} />
                )}
                <input
                  style={{ ...inputStyle, flex: 1, padding: "6px 10px" }}
                  value={b.name}
                  onChange={(e) => updateBird(b.id, { name: e.target.value })}
                  placeholder="Bird name"
                />
                <button onClick={() => removeBird(b.id)} aria-label="Remove" style={{
                  background: "none", border: "none", color: palette.accent, cursor: "pointer", padding: 4,
                }}><X size={16} /></button>
              </div>
              <select
                style={{ ...inputStyle, padding: "6px 10px", fontSize: 13 }}
                value={b.bandColor || ""}
                onChange={(e) => updateBird(b.id, { bandColor: e.target.value })}
              >
                {COMMON_COLORS.map(c => (
                  <option key={c.hex || "none"} value={c.hex}>{c.label}</option>
                ))}
              </select>
              {/* Breed editor — pre-populated for existing birds. We use the
                  same "Other" surface pattern as the add form: when the bird's
                  saved breed isn't in our preset list, show "Other" + a text
                  field so users can keep their custom value. */}
              {(() => {
                const savedBreed = b.breed || "";
                const inList = breedOptions.includes(savedBreed);
                const selectVal = !savedBreed ? "" : (inList ? savedBreed : "Other");
                return (
                  <>
                    <select
                      style={{ ...inputStyle, padding: "6px 10px", fontSize: 13, marginTop: 6 }}
                      value={selectVal}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "Other") {
                          // Keep any prior custom value if there was one
                          if (inList || !savedBreed) updateBird(b.id, { breed: "" });
                        } else {
                          updateBird(b.id, { breed: v });
                        }
                      }}
                    >
                      <option value="">— breed (optional) —</option>
                      {breedOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {selectVal === "Other" && (
                      <input
                        style={{ ...inputStyle, padding: "6px 10px", fontSize: 13, marginTop: 6 }}
                        value={!inList ? savedBreed : ""}
                        onChange={(e) => updateBird(b.id, { breed: e.target.value })}
                        placeholder="Breed name"
                      />
                    )}
                  </>
                );
              })()}
              <input
                style={{ ...inputStyle, padding: "6px 10px", fontSize: 13, marginTop: 6 }}
                value={b.notes || ""}
                onChange={(e) => updateBird(b.id, { notes: e.target.value })}
                placeholder="Notes (optional): e.g. broody hen, lays jumbo eggs…"
              />
              {/* Broody toggle — surfaces the bird's current state and lets the
                  user flip it directly from the manage-birds list. Side-effects
                  (updating the flock counter, logging an entry) happen via the
                  Broody tile on the main page, not here; this is just the flag
                  for users who'd rather just track without logging an event. */}
              <button
                type="button"
                onClick={() => updateBird(b.id, { broody: !b.broody })}
                style={{
                  marginTop: 8,
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 10px",
                  background: b.broody ? palette.yolkSoft : "transparent",
                  border: `1.5px solid ${b.broody ? palette.yolk : palette.line}`,
                  borderRadius: 8, cursor: "pointer", fontFamily: FONT_BODY,
                  fontSize: 12, color: palette.ink, width: "100%",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 14 }}>{b.broody ? "🪺" : "○"}</span>
                <span>{b.broody ? "Currently broody" : "Not broody"} — tap to toggle</span>
              </button>
              {dyingBirdId === b.id ? (
                <div style={{ marginTop: 8, padding: 10, background: palette.bgAlt, border: `1.5px solid ${palette.accent}`, borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: palette.ink, marginBottom: 8, lineHeight: 1.5 }}>
                    Mark {b.name} as died? This decrements your flock count by 1 and adds a death entry.
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input type="date" style={{ ...inputStyle, padding: "6px 10px", fontSize: 13, flex: 1 }} value={deathDate} onChange={(e) => setDeathDate(e.target.value)} />
                  </div>
                  <input
                    style={{ ...inputStyle, padding: "6px 10px", fontSize: 13, marginBottom: 8 }}
                    value={deathCause}
                    onChange={(e) => setDeathCause(e.target.value)}
                    placeholder="Cause (optional): predator, illness, unknown…"
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn small variant="ghost" onClick={() => { setDyingBirdId(null); setDeathCause(""); setDeathDate(todayStr()); }}>Cancel</Btn>
                    <Btn small variant="danger" onClick={() => commitDeath(b.id)}>Confirm — mark as died</Btn>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setDyingBirdId(b.id); setDeathDate(todayStr()); setDeathCause(""); }}
                  style={{
                    marginTop: 8, background: "transparent", border: "none",
                    color: palette.accent, fontSize: 12, padding: 0, cursor: "pointer",
                    fontFamily: FONT_BODY, textDecoration: "underline",
                  }}
                >
                  💀 Mark as died
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new bird */}
      <div style={{
        padding: "10px 12px", background: palette.bgAlt, borderRadius: 10,
        border: `1.5px dashed ${palette.line}`, marginBottom: 14,
      }}>
        <div style={{ fontSize: 11, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, marginBottom: 6 }}>
          Add a bird
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (e.g. Henrietta, Big Red)"
            onKeyDown={(e) => { if (e.key === "Enter") addBird(); }}
          />
        </div>
        <select
          style={inputStyle}
          value={newBandColor}
          onChange={(e) => setNewBandColor(e.target.value)}
        >
          {COMMON_COLORS.map(c => (
            <option key={c.hex || "none"} value={c.hex}>{c.label}</option>
          ))}
        </select>
        <select
          style={{ ...inputStyle, marginTop: 8 }}
          value={newBreed}
          onChange={(e) => setNewBreed(e.target.value)}
        >
          <option value="">— breed (optional) —</option>
          {breedOptions.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        {newBreed === "Other" && (
          <input
            style={{ ...inputStyle, marginTop: 8 }}
            value={newBreedOther}
            onChange={(e) => setNewBreedOther(e.target.value)}
            placeholder="Breed name"
          />
        )}
        <Btn small variant="leaf" onClick={addBird} disabled={!newName.trim()} style={{ marginTop: 8, width: "100%" }}>
          + Add bird
        </Btn>
      </div>

      {/* Past birds (archived) — collapsed by default. Tap a row to restore. */}
      {archivedBirds.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <details>
            <summary style={{ cursor: "pointer", color: palette.inkSoft, fontSize: 13, padding: 6 }}>
              Past birds ({archivedBirds.length})
            </summary>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {archivedBirds.map(b => (
                <div key={b.id} style={{
                  padding: "8px 10px", background: palette.bgAlt, borderRadius: 8,
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                }}>
                  <div style={{ fontSize: 12, color: palette.inkSoft }}>
                    <span style={{ color: palette.ink, fontWeight: 600 }}>{b.name}</span>
                    {" — "}{b.archivedReason || "archived"}
                    {b.archivedDate ? ` · ${b.archivedDate}` : ""}
                  </div>
                  <button
                    onClick={() => restoreBird(b.id)}
                    style={{
                      background: "transparent", border: `1.5px solid ${palette.line}`,
                      borderRadius: 6, padding: "4px 8px", fontSize: 11,
                      fontFamily: FONT_BODY, color: palette.ink, cursor: "pointer",
                    }}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 6, marginLeft: 6, lineHeight: 1.5 }}>
              Restoring re-adds the bird to your active list, but doesn't delete the death entry from your journal or change the flock count. Adjust the flock count from the flock edit screen if needed.
            </div>
          </details>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={save}>Save</Btn>
      </div>
    </Modal>
  );
}


function EditFlockModal({ hobbyId, flockId, hobby, update, onClose, setModal }) {
  const BIRD_TYPES = ["Chicken", "Duck", "Turkey", "Quail", "Goose", "Guinea", "Peafowl", "Other"];
  const flock = (hobby.flocks || []).find(f => f.id === flockId);
  // Pre-fill from females/males if present, fall back to legacy birdCount so
  // pre-migration data still loads sensibly.
  const initialFemales = flock && typeof flock.females === "number" ? flock.females
    : (Number(flock?.birdCount) || 0);
  const initialMales = flock && typeof flock.males === "number" ? flock.males : 0;
  const [name, setName] = useState(flock?.name || "");
  const [birdType, setBirdType] = useState(flock?.birdType || "Chicken");
  const [females, setFemales] = useState(String(initialFemales));
  const [males, setMales] = useState(String(initialMales));
  const [date, setDate] = useState(flock?.startDate || todayStr());
  const [cost, setCost] = useState(flock?.cost ? String(flock.cost) : "");
  const [purchasedFrom, setPurchasedFrom] = useState(flock?.purchasedFrom || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!flock) { onClose(); return null; }

  const sn = sexNames(birdType);
  const totalPreview = (parseInt(females) || 0) + (parseInt(males) || 0);

  const save = () => {
    const f = parseInt(females) || 0;
    const m = parseInt(males) || 0;
    const n = f + m;
    if (!n || n < 1 || !name.trim()) return;
    update((d) => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      const fl = (h.flocks||[]).find(x=>x.id===flockId);
      if (fl) {
        fl.name = name.trim();
        fl.birdType = birdType;
        fl.birdCount = n;
        fl.females = f;
        fl.males = m;
        fl.startDate = date;
        fl.cost = parseFloat(cost) || 0;
        fl.purchasedFrom = purchasedFrom.trim();
      }
      return d;
    });
    onClose();
  };

  const remove = () => {
    update((d) => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (h) h.flocks = (h.flocks||[]).filter(x=>x.id!==flockId);
      return d;
    });
    onClose();
  };

  const openButcher = () => {
    onClose();
    if (setModal) {
      setTimeout(() => setModal({ type: "butcherFlock", hobbyId, flockId }), 0);
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit flock">
      <Field label="Flock name">
        <input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} />
      </Field>
      <Field label="Bird type">
        <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
          {BIRD_TYPES.map(t=>(
            <button key={t} onClick={()=>setBirdType(t)} style={{ padding:"8px 12px",borderRadius:8,border:`1.5px solid ${birdType===t?palette.ink:palette.line}`,background:birdType===t?palette.ink:palette.card,color:birdType===t?palette.bg:palette.ink,fontFamily:FONT_BODY,fontSize:13,fontWeight:600,cursor:"pointer" }}>{t}</button>
          ))}
        </div>
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label={`Number of ${sn.femalePl}`}>
            <input type="number" inputMode="numeric" min={0} style={inputStyle} value={females} onChange={e=>setFemales(e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label={`Number of ${sn.malePl}`}>
            <input type="number" inputMode="numeric" min={0} style={inputStyle} value={males} onChange={e=>setMales(e.target.value)} />
          </Field>
        </div>
      </div>
      {totalPreview > 0 && (
        <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: -8, marginBottom: 8, fontStyle: "italic" }}>
          Total: {totalPreview} bird{totalPreview === 1 ? "" : "s"}
        </div>
      )}
      <Field label="Start date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} />
      </Field>
      <Field label="Total cost (optional)">
        <input type="number" inputMode="decimal" step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$" />
      </Field>
      <Field label="Where purchased (optional)">
        <input style={inputStyle} value={purchasedFrom} onChange={e=>setPurchasedFrom(e.target.value)} placeholder="e.g. Murray McMurray, Tractor Supply, neighbor" />
      </Field>
      <div style={{ display:"flex",gap:8,marginTop:8,flexWrap:"wrap" }}>
        <Btn variant="primary" onClick={save}>Save changes</Btn>
        <Btn variant="accent" onClick={openButcher}>Remove birds…</Btn>
        {!confirmDelete && <Btn variant="ghost" onClick={()=>setConfirmDelete(true)}>Delete flock</Btn>}
        {confirmDelete && <Btn variant="danger" onClick={remove}>Confirm delete</Btn>}
      </div>
      {confirmDelete && <div style={{ fontSize:12,color:palette.inkSoft,marginTop:8,fontStyle:"italic" }}>This will delete the flock but keep its egg entries.</div>}
    </Modal>
  );
}

// Edit an existing flock-history entry. Lets the user fix typos in count, date, or cost.
function EditFlockEntryModal({ hobby, index, update, onClose }) {
  const fh = (hobby.flockHistory || [])[index];
  if (!fh) {
    onClose();
    return null;
  }
  const [count, setCount] = useState(String(fh.count || 0));
  const [date, setDate] = useState(fh.date || todayStr());
  const [cost, setCost] = useState(fh.cost ? String(fh.cost) : "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    const n = parseInt(count);
    if (!n || n < 1) return;
    update((d) => {
      const h = d.hobbies.find((x) => x.id === hobby.id);
      if (!h) return d;
      const oldCount = h.flockHistory[index].count || 0;
      h.flockHistory[index] = { date, count: n, cost: parseFloat(cost) || 0 };
      // Keep flockSize in sync with the change
      h.flockSize = Math.max(0, (h.flockSize || 0) - oldCount + n);
      return d;
    });
    onClose();
  };

  const remove = () => {
    update((d) => {
      const h = d.hobbies.find((x) => x.id === hobby.id);
      if (!h) return d;
      const removedCount = h.flockHistory[index].count || 0;
      h.flockHistory.splice(index, 1);
      h.flockSize = Math.max(0, (h.flockSize || 0) - removedCount);
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Edit flock entry">
      <Field label="How many birds?">
        <input type="number" inputMode="numeric" style={inputStyle} value={count} onChange={(e) => setCount(e.target.value)} />
      </Field>
      <Field label="Date acquired">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Cost (optional)">
        <input type="number" inputMode="decimal" step="0.01" style={inputStyle} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="$" />
      </Field>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <Btn variant="primary" onClick={save}>Save changes</Btn>
        {!confirmDelete && (
          <Btn variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Btn>
        )}
        {confirmDelete && (
          <Btn variant="danger" onClick={remove}>Confirm delete</Btn>
        )}
      </div>
      {confirmDelete && (
        <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 8, fontStyle: "italic" }}>
          This will remove these birds from your flock count too.
        </div>
      )}
    </Modal>
  );
}

// Edit the current meat-chicken batch. Lets you fix the name, date, count, or cost.
function EditBatchModal({ hobby, batchId, update, onClose }) {
  // Push 4b — find the specific batch in currentBatches[]. batchId is
  // passed in by the caller (MeatChickensSummary). For safety on stale
  // hobby data (legacy single-batch users mid-migration, etc.) we fall
  // back to the first active batch when batchId isn't found.
  const activeBatches = hobby.currentBatches || [];
  const batch = activeBatches.find((b) => b.id === batchId) || activeBatches[0];
  if (!batch) {
    onClose();
    return null;
  }
  const BIRD_TYPES_LOCAL = ["Chicken", "Duck", "Turkey", "Quail", "Goose", "Guinea", "Peafowl", "Other"];
  const [name, setName] = useState(batch.name || "");
  // Default to Chicken for legacy batches that predate the bird-type field
  const [birdType, setBirdType] = useState(batch.birdType || "Chicken");
  const [count, setCount] = useState(String(batch.startCount || 0));
  const [date, setDate] = useState(batch.startDate || todayStr());
  const [cost, setCost] = useState(batch.chickCost ? String(batch.chickCost) : "");
  // Confirmation gate for the destructive Delete action — we don't want a
  // misclick to nuke an active batch with butcher/death history on it.
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    const n = parseInt(count);
    if (!n || n < 1 || !name.trim()) return;
    update((d) => {
      const h = d.hobbies.find((x) => x.id === hobby.id);
      if (!h || !Array.isArray(h.currentBatches)) return d;
      const idx = h.currentBatches.findIndex((b) => b.id === batch.id);
      if (idx === -1) return d;
      h.currentBatches[idx] = {
        ...h.currentBatches[idx],
        name: name.trim(),
        birdType,
        startDate: date,
        startCount: n,
        chickCost: parseFloat(cost) || 0,
      };
      return d;
    });
    onClose();
  };

  // Finalize: archive this batch to archivedBatches[] and remove from
  // currentBatches[]. Matches the ButcherModal "also finalize" behavior so
  // users with no remaining birds (or who just want to close out an active
  // batch without going through a butcher entry) have a direct path.
  //
  // Also clears the legacy `h.currentBatch` (singular) field if it points at
  // the same batch. Without this, migrateData re-hydrates the finalized
  // batch on the next load — see the migration block in migrateData around
  // line 224. This was the long-standing "meat birds finalize doesn't stick"
  // bug. Same fix applied to the ButcherModal "also finalize" path below.
  const finalize = () => {
    console.log("[FINALIZE] starting for batch:", batch.id, "hobby:", hobby.id);
    update((d) => {
      const h = d.hobbies.find((x) => x.id === hobby.id);
      if (!h || !Array.isArray(h.currentBatches)) {
        console.warn("[FINALIZE] aborted - hobby not found or no currentBatches");
        return d;
      }
      const idx = h.currentBatches.findIndex((b) => b.id === batch.id);
      if (idx === -1) {
        console.warn("[FINALIZE] aborted - batch not in currentBatches");
        return d;
      }
      const target = h.currentBatches[idx];
      const finalBatch = JSON.parse(JSON.stringify(target));
      finalBatch.endDate = todayStr();
      finalBatch.finalEntries = (d.entries[hobby.id] || []).filter((e) => e.batchId === target.id);
      h.archivedBatches = h.archivedBatches || [];
      h.archivedBatches.push(finalBatch);
      d.entries[hobby.id] = (d.entries[hobby.id] || []).filter((e) => e.batchId !== target.id);
      h.currentBatches.splice(idx, 1);
      if (h.currentBatch && h.currentBatch.id === target.id) {
        h.currentBatch = null;
      }
      console.log("[FINALIZE] complete - currentBatches:", h.currentBatches.length, "archivedBatches:", h.archivedBatches.length);
      return d;
    }, { immediate: true });
    onClose();
  };

  // Delete: remove the batch outright, without archiving. Also removes any
  // entries tagged to this batch. Destructive — gated behind a confirm. This
  // is intended for accidentally-created batches the user wants gone rather
  // than archived (e.g. mistyped startCount, never actually used).
  const remove = () => {
    update((d) => {
      const h = d.hobbies.find((x) => x.id === hobby.id);
      if (!h || !Array.isArray(h.currentBatches)) return d;
      h.currentBatches = h.currentBatches.filter((b) => b.id !== batch.id);
      // Also drop entries for this batch — they'd otherwise orphan to a
      // batch that no longer exists, polluting analytics.
      d.entries[hobby.id] = (d.entries[hobby.id] || []).filter((e) => e.batchId !== batch.id);
      // And any freezer-log rows from this batch (mirrored butcher entries)
      if (Array.isArray(d.freezerLog)) {
        d.freezerLog = d.freezerLog.filter((f) => f.batchId !== batch.id);
      }
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Edit batch">
      <Field label="Batch name">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Bird type">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {BIRD_TYPES_LOCAL.map(t => (
            <button
              key={t}
              onClick={() => setBirdType(t)}
              style={{
                padding: "8px 12px", borderRadius: 8,
                border: `1.5px solid ${birdType === t ? palette.ink : palette.line}`,
                background: birdType === t ? palette.ink : palette.card,
                color: birdType === t ? palette.bg : palette.ink,
                fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >{t}</button>
          ))}
        </div>
      </Field>
      <Field label={`Number of ${birdType === "Chicken" ? "chicks" : "birds"} (started with)`}>
        <input type="number" inputMode="numeric" style={inputStyle} value={count} onChange={(e) => setCount(e.target.value)} />
      </Field>
      <Field label="Start date">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label={`Cost of ${birdType === "Chicken" ? "chicks" : "birds"}`}>
        <input type="number" inputMode="decimal" step="0.01" style={inputStyle} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="$" />
      </Field>
      <Btn variant="primary" onClick={save}>Save changes</Btn>
      {/* Finalize / Delete row — separated visually from the primary save
          action by a small gap and explanatory text. Both are gated to
          avoid misclicks: Delete requires explicit confirm; Finalize moves
          the batch to archives (recoverable in the data file). */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${palette.line}` }}>
        <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 8, lineHeight: 1.4 }}>
          Close out this batch without going through a butcher entry, or remove it entirely.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn variant="ghost" onClick={finalize} small>📦 Finalize batch</Btn>
          {!confirmDelete ? (
            <Btn variant="ghost" onClick={() => setConfirmDelete(true)} small>🗑️ Delete batch</Btn>
          ) : (
            <>
              <Btn variant="primary" onClick={remove} small>Yes, delete</Btn>
              <Btn variant="ghost" onClick={() => setConfirmDelete(false)} small>Cancel</Btn>
            </>
          )}
        </div>
        {confirmDelete && (
          <div style={{ fontSize: 11, color: palette.accent, marginTop: 8, lineHeight: 1.4 }}>
            ⚠️ Deletes the batch and all entries tagged to it. This can't be undone.
          </div>
        )}
      </div>
    </Modal>
  );
}

function HatchBatchModal({ hobby, update, onClose }) {
  // Bird type picker — matches BIRD_TYPES from the flock-side modals so the
  // batch knows whether it's meat chickens, ducks, turkeys, etc. The freezer
  // log already reads batch.birdType (with a Chicken fallback) so existing
  // batches without this field continue to work.
  const BIRD_TYPES_LOCAL = ["Chicken", "Duck", "Turkey", "Quail", "Goose", "Guinea", "Peafowl", "Other"];
  // Push 4b — auto-generated name now considers BOTH active batches
  // (currentBatches[]) and archived for numbering so users don't end up
  // with two "Batch 3"s side-by-side.
  const startingCount = ((hobby.archivedBatches || []).length + (hobby.currentBatches || []).length) + 1;
  const [name, setName] = useState(`Batch ${startingCount}`);
  const [birdType, setBirdType] = useState("Chicken");
  const [count, setCount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [cost, setCost] = useState("");
  return (
    <Modal open onClose={onClose} title="🐣 Hatch new batch">
      <Field label="Batch name">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Bird type">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {BIRD_TYPES_LOCAL.map(t => (
            <button
              key={t}
              onClick={() => setBirdType(t)}
              style={{
                padding: "8px 12px", borderRadius: 8,
                border: `1.5px solid ${birdType === t ? palette.ink : palette.line}`,
                background: birdType === t ? palette.ink : palette.card,
                color: birdType === t ? palette.bg : palette.ink,
                fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >{t}</button>
          ))}
        </div>
      </Field>
      <Field label={`Number of ${birdType === "Chicken" ? "chicks" : "birds"}`}>
        <input type="number" inputMode="numeric" style={inputStyle} value={count} onChange={(e) => setCount(e.target.value)} />
      </Field>
      <Field label="Start date">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label={`Cost of ${birdType === "Chicken" ? "chicks" : "birds"} (optional)`}>
        <input type="number" inputMode="decimal" step="0.01" style={inputStyle} value={cost} onChange={(e) => setCost(e.target.value)} />
      </Field>
      <Btn variant="primary" onClick={() => {
        const n = parseInt(count);
        if (!n || n < 1 || !name.trim()) return;
        update((d) => {
          const h = d.hobbies.find((x) => x.id === hobby.id);
          // Push 4b — append to currentBatches[] instead of replacing a
          // single currentBatch. This is what makes multi-batch possible.
          if (!Array.isArray(h.currentBatches)) h.currentBatches = [];
          h.currentBatches.push({
            id: newId(),
            name: name.trim(),
            birdType,
            startDate: date,
            startCount: n,
            chickCost: parseFloat(cost) || 0,
          });
          return d;
        });
        onClose();
      }}>Start batch</Btn>
    </Modal>
  );
}

function ButcherModal({ hobby, batchId, entries, update, onClose }) {
  // Same cull-reason design as the flock-side modal (egg layers), adapted for
  // meat-bird batches. Default reason is butchered since that's the most
  // common reason birds leave a meat-chicken batch, but users can also log
  // sold/rehomed/died/culled etc. Useful for runts given away, breeders kept
  // out for laying, weather losses, or anything that isn't a clean butcher.
  const [reason, setReason] = useState("butchered");
  const [count, setCount] = useState("");
  const [avgWeight, setAvgWeight] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [validationError, setValidationError] = useState("");
  // Two-step flow: form → confirm.
  const [confirming, setConfirming] = useState(false);
  // Auto-tick: see useEffect below `willEmptyBatch` declaration for the logic.
  const [alsoFinalize, setAlsoFinalize] = useState(false);
  const userUncheckedRef = useRef(false);
  const prevWillEmptyRef = useRef(false);

  // Push 4b — multi-batch support. The caller may pass batchId (e.g.
  // from a nudge that already knows which batch); otherwise we show an
  // internal picker when there's >1 active batch. With exactly 1 batch,
  // we just pick it implicitly.
  const activeBatches = hobby.currentBatches || [];
  const [selectedBatchId, setSelectedBatchId] = useState(() => {
    if (batchId && activeBatches.some((b) => b.id === batchId)) return batchId;
    if (activeBatches.length === 1) return activeBatches[0].id;
    return "";
  });
  const batch = activeBatches.find((b) => b.id === selectedBatchId) || null;

  if (activeBatches.length === 0) {
    return (
      <Modal open onClose={onClose} title="Remove from batch">
        <div>No active batch. Hatch one first.</div>
      </Modal>
    );
  }

  const isButcher = reason === "butchered";
  const isSoftCull = ["sold", "rehomed", "given_away"].includes(reason);
  const isDeath = reason === "died" || reason === "culled";

  const reasonOptions = [
    { value: "butchered",   label: "🔪 Butchered",     desc: "Send to freezer log with weight." },
    { value: "sold",        label: "💰 Sold",           desc: "Bird sold live to someone else." },
    { value: "rehomed",     label: "🏡 Rehomed",        desc: "Given to a new home (kept as a layer/pet)." },
    { value: "given_away",  label: "🎁 Given away",     desc: "Gave to a friend or neighbor." },
    { value: "died",        label: "💔 Died",           desc: "Natural causes, illness, predator." },
    { value: "culled",      label: "🩺 Culled",         desc: "Euthanized for health or other reason." },
    { value: "other",       label: "❓ Other",          desc: "Anything else — explain in notes." },
  ];

  // All downstream calcs depend on a selected batch. When the picker hasn't
  // been resolved yet (>1 active batch and user hasn't picked), these stay
  // zeroed so the form renders without throwing.
  const deaths = batch ? entries
    .filter((e) => e.action === "death" && e.batchId === batch.id)
    .reduce((s, e) => s + (Number(e.count) || 1), 0) : 0;
  const previouslyButchered = batch ? (batch.butchered || []).reduce((s, x) => s + (x.count || 0), 0) : 0;
  // Count "removed via note" entries (soft culls) as also gone from the batch.
  const previouslySoftRemoved = batch ? (entries || [])
    .filter((e) => e.action === "note" && e.batchId === batch.id && Number(e.cullCount) > 0)
    .reduce((s, e) => s + Number(e.cullCount), 0) : 0;
  const remaining = batch ? (batch.startCount - deaths - previouslyButchered - previouslySoftRemoved) : 0;

  const plannedCount = parseInt(count) || 0;
  const remainingAfter = Math.max(0, remaining - plannedCount);
  const willEmptyBatch = plannedCount > 0 && remainingAfter === 0;

  // Auto-tick "Also finalize this batch" whenever the planned count would
  // empty the batch — saves users from forgetting the tick and then wondering
  // why the batch is still active on next app open. Only flips on the RISING
  // edge (false → true) so we don't fight the user if they deliberately
  // unticked the box. userUncheckedRef remembers an explicit user untick so
  // we stay out of their way until the count changes back to non-emptying
  // and then back to emptying again.
  useEffect(() => {
    if (willEmptyBatch && !prevWillEmptyRef.current && !userUncheckedRef.current) {
      setAlsoFinalize(true);
    }
    if (!willEmptyBatch) {
      // Reset the "user explicitly unticked" memory whenever the action no
      // longer empties the batch, so a fresh empty-batch attempt gets the
      // auto-tick again.
      userUncheckedRef.current = false;
    }
    prevWillEmptyRef.current = willEmptyBatch;
  }, [willEmptyBatch]);
  const handleAlsoFinalizeChange = (checked) => {
    setAlsoFinalize(checked);
    if (!checked && willEmptyBatch) {
      userUncheckedRef.current = true;
    }
  };

  const validate = () => {
    if (!batch) {
      setValidationError("Pick a batch first.");
      return false;
    }
    const n = parseInt(count);
    const w = parseFloat(avgWeight);
    if (!count || isNaN(n) || n <= 0) {
      setValidationError(`Enter the number of birds (must be greater than 0).`);
      return false;
    }
    if (n > remaining) {
      setValidationError(`Can't remove more than ${remaining} birds — that's all that's left in this batch.`);
      return false;
    }
    // Weight only required for butchered (freezer log needs it)
    if (isButcher && (!avgWeight || isNaN(w) || w <= 0)) {
      setValidationError("Butchered birds need an average weight for the freezer log. If you haven't weighed yet, estimate or use 0.01 as a placeholder.");
      return false;
    }
    setValidationError("");
    return true;
  };

  // Modal title and primary button label vary by reason so the flow doesn't
  // feel weird ("Send to freezer camp" doesn't apply for a sold bird).
  const titleByReason = () => {
    if (confirming) return "Confirm";
    if (!batch) return "Remove from batch";
    if (isButcher) return `❄️ Send to freezer camp · ${batch.name}`;
    if (isSoftCull) return `Remove from ${batch.name}`;
    if (isDeath) return `Log loss in ${batch.name}`;
    return `Remove from ${batch.name}`;
  };
  const primaryByReason = () => {
    if (isButcher) return "❄️ Send to freezer camp";
    return "Save";
  };
  const confirmByReason = () => {
    if (alsoFinalize && willEmptyBatch) {
      return isButcher ? "Send & finalize batch" : "Save & finalize batch";
    }
    return isButcher ? "Confirm butcher" : "Confirm";
  };

  return (
    <Modal open onClose={onClose} title={titleByReason()}>
      {!confirming ? (
        <>
          {/* Batch picker — only shown when caller didn't pre-select a batch
              AND there's more than one active batch to choose from. With
              exactly 1 batch, selectedBatchId was set in initial state, so
              this picker is hidden and the user just sees the form. */}
          {!batchId && activeBatches.length > 1 && (
            <Field label="Which batch?">
              <select
                style={inputStyle}
                value={selectedBatchId}
                onChange={(e) => { setSelectedBatchId(e.target.value); setValidationError(""); }}
              >
                <option value="">— pick a batch —</option>
                {activeBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.birdType && b.birdType !== "Chicken" ? ` (${b.birdType})` : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {batch && (
            <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 12 }}>
              {remaining} bird{remaining === 1 ? "" : "s"} remaining in {batch.name}.
            </div>
          )}

          <Field label="What happened?">
            <select style={inputStyle} value={reason} onChange={(e) => { setReason(e.target.value); setValidationError(""); }}>
              {reasonOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4, lineHeight: 1.4 }}>
              {reasonOptions.find(o => o.value === reason)?.desc}
            </div>
          </Field>

          <Field label="Date">
            <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="How many?">
            <input
              type="number" inputMode="numeric"
              style={inputStyle}
              value={count}
              onChange={(e) => { setCount(e.target.value); setValidationError(""); }}
              placeholder={batch ? `e.g. 5 (of ${remaining})` : "Pick a batch first"}
            />
          </Field>

          {/* Weight is required only for butcher; optional but useful for sold/rehomed
              if user wants to track average growth. */}
          {isButcher ? (
            <Field label="Average weight (lbs)">
              <input
                type="number" inputMode="decimal"
                step="0.01"
                style={inputStyle}
                value={avgWeight}
                onChange={(e) => { setAvgWeight(e.target.value); setValidationError(""); }}
                placeholder="e.g. 5.5"
              />
            </Field>
          ) : (
            <Field label="Average weight (lbs, optional)">
              <input
                type="number" inputMode="decimal"
                step="0.01"
                style={inputStyle}
                value={avgWeight}
                onChange={(e) => setAvgWeight(e.target.value)}
                placeholder="optional"
              />
            </Field>
          )}

          <Field label={isSoftCull ? "Notes (who took them, etc)" : "Notes (cause, details, etc)"}>
            <textarea
              style={{ ...inputStyle, minHeight: 50, resize: "vertical" }}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                reason === "sold" ? "e.g. sold to neighbor for $15 each" :
                reason === "rehomed" ? "e.g. kept this one as a layer, gave to Sarah" :
                reason === "given_away" ? "e.g. runt — friend wanted a pet hen" :
                reason === "died" ? "e.g. predator, found this morning" :
                reason === "culled" ? "e.g. respiratory infection, not recovering" :
                reason === "other" ? "What happened?" :
                "Anything notable about this butcher day..."
              }
            />
          </Field>

          {reason === "sold" && (
            <div style={{
              padding: 10, marginBottom: 12, borderRadius: 6,
              background: palette.yolkSoft, border: `1.5px solid ${palette.line}`,
              fontSize: 12, color: palette.ink, lineHeight: 1.5,
            }}>
              💡 This logs the count reduction. To record sale revenue, also add a sale on the Sales tab.
            </div>
          )}

          {validationError && (
            <div style={{
              padding: 10, marginBottom: 12, borderRadius: 6,
              background: "#FBE5DE", border: `1.5px solid ${palette.accent}`,
              fontSize: 13, color: palette.accent,
            }}>
              {validationError}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="primary" onClick={() => { if (validate()) setConfirming(true); }}>
              {primaryByReason()}
            </Btn>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          </div>
        </>
      ) : (
        // ----- Confirmation step -----
        <>
          <div style={{
            padding: 14, marginBottom: 16, borderRadius: 8,
            background: palette.yolkSoft, border: `1.5px solid ${palette.line}`,
            fontSize: 14, color: palette.ink, lineHeight: 1.6,
          }}>
            {isButcher ? (
              <>
                Sending <strong>{plannedCount} bird{plannedCount === 1 ? "" : "s"}</strong> from <strong>{batch.name}</strong> to the freezer log
                {" "}at <strong>{avgWeight} lbs</strong> avg.
              </>
            ) : (
              <>
                Removing <strong>{plannedCount} bird{plannedCount === 1 ? "" : "s"}</strong> from <strong>{batch.name}</strong>{" "}
                ({reasonOptions.find(o => o.value === reason)?.label.replace(/^.\s/, "").toLowerCase()}).
              </>
            )}
            <div style={{ marginTop: 8, fontSize: 13, color: palette.inkSoft }}>
              {remainingAfter > 0
                ? <>After this, <strong style={{ color: palette.ink }}>{remainingAfter}</strong> bird{remainingAfter === 1 ? "" : "s"} will still be in the batch.</>
                : <>This will empty the batch.</>
              }
            </div>
          </div>

          {willEmptyBatch && (
            <label style={{
              display: "flex", alignItems: "flex-start", gap: 10, padding: 12,
              marginBottom: 14, borderRadius: 8, cursor: "pointer",
              background: palette.bgAlt, border: `1.5px solid ${palette.line}`,
            }}>
              <input
                type="checkbox"
                checked={alsoFinalize}
                onChange={(e) => handleAlsoFinalizeChange(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <div style={{ fontSize: 13, color: palette.ink, lineHeight: 1.5 }}>
                <strong>Also finalize this batch</strong>
                <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 2 }}>
                  Archives {batch.name} to your analytics history and clears the dashboard so you can hatch a new batch.
                </div>
              </div>
            </label>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="primary" onClick={() => {
              if (!validate()) {
                setConfirming(false);
                return;
              }
              const n = parseInt(count);
              const w = parseFloat(avgWeight);
              const entryId = newId();
              const wantImmediate = alsoFinalize && willEmptyBatch;
              update((d) => {
                const h = d.hobbies.find((x) => x.id === hobby.id);
                if (!h || !Array.isArray(h.currentBatches)) return d;
                // Find the target batch in currentBatches[] by id. Anything
                // we mutate (butchered[], finalize) goes through this index.
                const targetIdx = h.currentBatches.findIndex((b) => b.id === batch.id);
                if (targetIdx === -1) return d;
                const target = h.currentBatches[targetIdx];
                d.entries[hobby.id] = d.entries[hobby.id] || [];

                if (isButcher) {
                  // Existing butcher behavior: append to the target batch's
                  // butchered[] (drives remaining-birds math), entries log,
                  // and the universal freezer log.
                  target.butchered = target.butchered || [];
                  target.butchered.push({ id: entryId, date, count: n, avgWeight: w });
                  d.entries[hobby.id].push({
                    id: entryId, date, action: "butcher", count: n, avgWeight: w,
                    batchId: target.id, note: note.trim(), created: Date.now(),
                  });
                  if (!Array.isArray(d.freezerLog)) d.freezerLog = [];
                  d.freezerLog.push({
                    id: newId(), date, hobbyId: hobby.id, batchId: target.id,
                    batchName: target.name, birdType: target.birdType || "Chicken",
                    count: n, avgWeight: w, note: note.trim(), created: Date.now(),
                  });
                } else if (isDeath) {
                  // Died/culled → death entry. Affects mortality analytics.
                  d.entries[hobby.id].push({
                    id: entryId, date, action: "death", count: n,
                    cause: reason === "culled" ? `culled: ${note.trim() || "no detail"}` : (note.trim() || "unknown"),
                    batchId: target.id, created: Date.now(),
                  });
                } else {
                  // Soft cull (sold/rehomed/given_away) or "other" — note-style
                  // entry with cullReason + cullCount metadata. Birds went
                  // somewhere alive, so we don't affect mortality stats.
                  // The remaining-birds calc above sums cullCount on note
                  // entries, so the batch dashboard reflects the change.
                  const reasonLabel = {
                    sold: "Sold",
                    rehomed: "Rehomed",
                    given_away: "Given away",
                    other: "Removed",
                  }[reason] || "Removed";
                  d.entries[hobby.id].push({
                    id: entryId, date, action: "note",
                    note: `${reasonLabel} · ${n} bird${n === 1 ? "" : "s"}${note.trim() ? " · " + note.trim() : ""}`,
                    batchId: target.id,
                    cullReason: reason,
                    cullCount: n,
                    cullAvgWeight: w || undefined,
                    created: Date.now(),
                  });
                }

                // Optional finalize if batch is now empty and user opted in.
                // Push 4b — splice the target out of currentBatches[] rather
                // than nulling a single slot. The other active batches stay.
                // Also clears the legacy h.currentBatch field if it points
                // at the same batch — otherwise migrateData rehydrates the
                // finalized batch on next load. See EditBatchModal.finalize
                // for the original analysis.
                console.log("[BUTCHER-FINALIZE] alsoFinalize:", alsoFinalize, "willEmptyBatch:", willEmptyBatch, "batchId:", target?.id);
                if (alsoFinalize && willEmptyBatch) {
                  const finalBatch = JSON.parse(JSON.stringify(target));
                  finalBatch.endDate = todayStr();
                  finalBatch.finalEntries = (d.entries[hobby.id] || []).filter((e) => e.batchId === target.id);
                  h.archivedBatches = h.archivedBatches || [];
                  h.archivedBatches.push(finalBatch);
                  d.entries[hobby.id] = (d.entries[hobby.id] || []).filter((e) => e.batchId !== target.id);
                  h.currentBatches.splice(targetIdx, 1);
                  if (h.currentBatch && h.currentBatch.id === target.id) {
                    h.currentBatch = null;
                  }
                  console.log("[BUTCHER-FINALIZE] archived - currentBatches:", h.currentBatches.length, "archivedBatches:", h.archivedBatches.length);
                } else {
                  console.warn("[BUTCHER-FINALIZE] SKIPPED archive step - alsoFinalize:", alsoFinalize, "willEmptyBatch:", willEmptyBatch);
                }
                return d;
              }, wantImmediate ? { immediate: true } : undefined);
              onClose();
            }}>
              {confirmByReason()}
            </Btn>
            <Btn variant="ghost" onClick={() => setConfirming(false)}>Back</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

// ============ BUTCHER FLOCK MODAL — universal: any flock, any bird type ============
// Used for chickens/ducks/quail/etc. butchered out of a regular egg-layer flock,
// not just dedicated meat-bird batches. Writes to the top-level data.freezerLog
// so it survives flock deletes and is visible across hobbies.
// ============ REMOVE FROM FLOCK MODAL — handle any reason birds leave a flock ============
// "Butcher" was misleading — users also need to log sales, rehomings, deaths,
// and other cull reasons without lying to the data model. This modal asks
// "what happened?" and routes accordingly:
//   - Butchered  → freezerLog + butcher entry on the hobby
//   - Sold       → reduce flock + log entry (note: actual sale revenue is
//                   logged separately via the Sales tab; this just records
//                   that birds left)
//   - Rehomed    → reduce flock + entry with reason
//   - Given away → same as rehomed
//   - Died       → reduce flock + death entry on the hobby (same as in the
//                   existing death log)
//   - Culled     → reduce flock + entry with reason (e.g. illness, euthanasia)
//   - Other      → free-text reason
function ButcherFlockModal({ hobby, flock, update, onClose }) {
  // Push 6 — when called from the top-level Butcher tile on the egg-layer
  // action grid, no flock is pre-selected. The user needs to pick which one.
  // To stay consistent with the meat-bird ButcherModal pattern (Push 4b),
  // we manage selection inside this modal rather than via an intermediate
  // picker modal. Auto-pick when there's only one viable flock.
  //
  // "Viable" = has birds left. Empty flocks are filtered out so the picker
  // doesn't dangle stale options. If every flock is empty, the modal renders
  // a friendly empty-state.
  const availableFlocks = (hobby.flocks || []).filter((f) => (Number(f.birdCount) || 0) > 0);
  const [selectedFlockId, setSelectedFlockId] = useState(() => {
    if (flock && flock.id) return flock.id;
    if (availableFlocks.length === 1) return availableFlocks[0].id;
    return "";
  });
  // Resolve the active flock from id. We re-read from hobby each render so a
  // bird-count change from a parallel update doesn't go stale.
  const activeFlock = flock || availableFlocks.find((f) => f.id === selectedFlockId) || null;

  const [reason, setReason] = useState("butchered");
  const [count, setCount] = useState("");
  const [avgWeight, setAvgWeight] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [validationError, setValidationError] = useState("");

  const remaining = activeFlock ? (Number(activeFlock.birdCount) || 0) : 0;

  // Empty-state: no flocks have birds in them — nothing to butcher.
  if (availableFlocks.length === 0) {
    return (
      <Modal open onClose={onClose} title="Remove from flock">
        <div style={{
          padding: 16, background: palette.bgAlt, borderRadius: 8,
          fontSize: 13, color: palette.inkSoft, lineHeight: 1.5, marginBottom: 14,
        }}>
          No birds in any flock yet. Add a flock with birds before logging a butcher.
        </div>
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
      </Modal>
    );
  }

  // The "soft cull" reasons (sold, rehomed, given away) are when the birds
  // are still alive somewhere. "Hard cull" reasons (butchered, died, culled)
  // are terminal. We use this to choose the right verb and writeback path.
  const isButcher = reason === "butchered";
  const isSoftCull = ["sold", "rehomed", "given_away"].includes(reason);
  const isDeath = reason === "died" || reason === "culled";

  const reasonOptions = [
    { value: "butchered",   label: "🔪 Butchered",    desc: "Send to freezer log with weight." },
    { value: "sold",        label: "💰 Sold",          desc: "Bird sold to someone else." },
    { value: "rehomed",     label: "🏡 Rehomed",       desc: "Given to a new home (retired breeder, etc.)" },
    { value: "given_away",  label: "🎁 Given away",    desc: "Gave to a friend or neighbor." },
    { value: "died",        label: "💔 Died",          desc: "Natural causes, illness, predator." },
    { value: "culled",      label: "🩺 Culled",        desc: "Euthanized for health or other reason." },
    { value: "other",       label: "❓ Other",         desc: "Anything else — explain in notes." },
  ];

  return (
    <Modal open onClose={onClose} title={activeFlock ? `Remove from ${activeFlock.name}` : "Remove from flock"}>
      {/* Push 6 — flock picker. Only shown when caller didn't pre-select a
          flock AND there's more than one viable flock. With exactly 1 flock,
          selectedFlockId was set in initial state, so this is hidden and the
          user goes straight to the form. Pre-selection (e.g. from Edit Flock)
          also skips the picker. */}
      {!flock && availableFlocks.length > 1 && (
        <Field label="Which flock?">
          <select
            style={inputStyle}
            value={selectedFlockId}
            onChange={(e) => { setSelectedFlockId(e.target.value); setValidationError(""); }}
          >
            <option value="">— pick a flock —</option>
            {availableFlocks.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.birdCount} {f.birdType?.toLowerCase() || "bird"}{f.birdCount === 1 ? "" : "s"})
              </option>
            ))}
          </select>
        </Field>
      )}

      {activeFlock && (
        <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 12 }}>
          {remaining} {activeFlock.birdType?.toLowerCase() || "bird"}{remaining === 1 ? "" : "s"} in this flock.
        </div>
      )}

      <Field label="What happened?">
        <select style={inputStyle} value={reason} onChange={(e) => { setReason(e.target.value); setValidationError(""); }}>
          {reasonOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4, lineHeight: 1.4 }}>
          {reasonOptions.find(o => o.value === reason)?.desc}
        </div>
      </Field>

      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      <Field label="How many?">
        <input
          type="number" inputMode="numeric"
          style={inputStyle}
          value={count}
          onChange={(e) => { setCount(e.target.value); setValidationError(""); }}
          placeholder={activeFlock ? `e.g. 1 (of ${remaining})` : "Pick a flock first"}
        />
      </Field>

      {/* Average weight only matters for butcher (freezer log) and is optional
          for everything else. Keep it accessible for sold-for-meat scenarios. */}
      {isButcher && (
        <Field label="Average weight (lbs)">
          <input type="number" inputMode="decimal" step="0.01" style={inputStyle} value={avgWeight} onChange={(e) => { setAvgWeight(e.target.value); setValidationError(""); }} placeholder="0.0" />
        </Field>
      )}
      {!isButcher && (
        <Field label="Average weight (lbs, optional)">
          <input type="number" inputMode="decimal" step="0.01" style={inputStyle} value={avgWeight} onChange={(e) => setAvgWeight(e.target.value)} placeholder="0.0" />
        </Field>
      )}

      <Field label={isSoftCull ? "Notes (who took them, etc)" : "Notes (cause, details, etc)"}>
        <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} value={note} onChange={(e) => setNote(e.target.value)} placeholder={
          reason === "sold" ? "e.g. sold to neighbor for $15 each" :
          reason === "rehomed" ? "e.g. retired breeders, given to Sarah's farm" :
          reason === "given_away" ? "e.g. friend wanted laying hens" :
          reason === "died" ? "e.g. predator (fox), found this morning" :
          reason === "culled" ? "e.g. respiratory infection, not recovering" :
          reason === "other" ? "What happened?" :
          "Anything notable..."
        } />
      </Field>

      {validationError && (
        <div style={{
          padding: 10, marginBottom: 12, borderRadius: 6,
          background: "#FBE5DE", border: `1.5px solid ${palette.accent}`,
          fontSize: 13, color: palette.accent,
        }}>
          {validationError}
        </div>
      )}

      {/* For sold-bird actions, hint that they should also log the actual
          revenue via the Sales tab. This modal only records the count
          reduction; financial tracking happens elsewhere. */}
      {reason === "sold" && (
        <div style={{
          padding: 10, marginBottom: 12, borderRadius: 6,
          background: palette.yolkSoft, border: `1.5px solid ${palette.line}`,
          fontSize: 12, color: palette.ink, lineHeight: 1.5,
        }}>
          💡 This logs the count reduction. To record the sale revenue, also add a sale on the Sales tab.
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="primary" onClick={() => {
          // Push 6 — gate on flock selection too. activeFlock may be null if
          // the user hasn't picked from the multi-flock picker yet.
          if (!activeFlock) {
            setValidationError("Pick a flock first.");
            return;
          }
          const n = parseInt(count);
          const w = parseFloat(avgWeight);
          if (!count || isNaN(n) || n < 1) {
            setValidationError("Enter the number of birds (must be greater than 0).");
            return;
          }
          if (n > remaining) {
            setValidationError(`Can't remove more than ${remaining} — that's all that's in the flock.`);
            return;
          }
          if (isButcher && (!avgWeight || isNaN(w) || w <= 0)) {
            setValidationError("Butchered birds need an average weight for the freezer log. If you haven't weighed yet, estimate or use 0.01 as a placeholder.");
            return;
          }
          update((d) => {
            // Always: decrement flock count
            const h = d.hobbies.find((x) => x.id === hobby.id);
            if (!h) return d;
            const fl = (h.flocks || []).find((x) => x.id === activeFlock.id);
            if (fl) fl.birdCount = Math.max(0, (fl.birdCount || 0) - n);

            // Butchered → freezer log + butcher entry (preserves existing flow)
            if (isButcher) {
              if (!Array.isArray(d.freezerLog)) d.freezerLog = [];
              d.freezerLog.push({
                id: newId(),
                date,
                hobbyId: hobby.id,
                flockId: activeFlock.id,
                flockName: activeFlock.name,
                birdType: activeFlock.birdType || "Bird",
                count: n,
                avgWeight: w,
                note: note.trim(),
                created: Date.now(),
              });
              d.entries[hobby.id] = d.entries[hobby.id] || [];
              d.entries[hobby.id].push({
                id: newId(),
                date,
                action: "butcher",
                count: n,
                avgWeight: w,
                flockId: activeFlock.id,
                note: note.trim(),
                created: Date.now(),
              });
            } else if (isDeath) {
              // Died/culled both go through the existing death-log path so
              // they show up in mortality stats consistently.
              d.entries[hobby.id] = d.entries[hobby.id] || [];
              d.entries[hobby.id].push({
                id: newId(),
                date,
                action: "death",
                count: n,
                cause: reason === "culled" ? `culled: ${note.trim() || "no detail"}` : (note.trim() || "unknown"),
                flockId: activeFlock.id,
                created: Date.now(),
              });
            } else {
              // Soft-cull or "other" — log a generic note-style entry so the
              // event is captured in the activity feed without affecting
              // death/mortality stats. Birds went somewhere alive.
              const reasonLabel = {
                sold: "Sold",
                rehomed: "Rehomed",
                given_away: "Given away",
                other: "Removed",
              }[reason] || "Removed";
              d.entries[hobby.id] = d.entries[hobby.id] || [];
              d.entries[hobby.id].push({
                id: newId(),
                date,
                action: "note",
                note: `${reasonLabel} · ${n} ${activeFlock.birdType?.toLowerCase() || "bird"}${n === 1 ? "" : "s"}${note.trim() ? " · " + note.trim() : ""}`,
                flockId: activeFlock.id,
                cullReason: reason,
                cullCount: n,
                created: Date.now(),
              });
            }
            return d;
          });
          onClose();
        }}>
          {isButcher ? "Save to freezer log" : "Save"}
        </Btn>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  );
}

// ============================================================================
// BULK EGG ENTRY — backfill historical eggs without tapping + 500 times
// ----------------------------------------------------------------------------
// Two modes for distributing eggs across a date range:
//   - "total" mode: user enters total egg count, we divide evenly across days
//                   (any remainder goes on the last day so totals match exactly)
//   - "perday" mode: user enters average eggs-per-day, we multiply across days
//
// We're careful about existing entries: by default we ADD to whatever's already
// logged on each date (sum the counts). Users can also choose "skip dates that
// already have eggs" if they're filling gaps in partial data.
//
// All bulk-created entries are tagged `bulkBackfill: true` so future updates
// can identify or filter them if needed (e.g. a future "undo last bulk import"
// feature). The same batchId is shared across all entries in one import.
// ============================================================================
function BulkEggEntryModal({ hobby, entries, update, onClose }) {
  const flocks = hobby.flocks || [];
  const today = todayStr();

  // Defaults: 30 days back through yesterday, single flock auto-selected if only one
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [mode, setMode] = useState("total"); // "total" | "perday"
  const [totalCount, setTotalCount] = useState("");
  const [perDayCount, setPerDayCount] = useState("");
  const [flockId, setFlockId] = useState(flocks.length === 1 ? flocks[0].id : "");
  const [conflictMode, setConflictMode] = useState("add"); // "add" | "skip"
  const [validationError, setValidationError] = useState("");
  const [confirming, setConfirming] = useState(false);

  // Compute the date list (inclusive) for the chosen range
  const dateList = (() => {
    if (!startDate || !endDate) return [];
    const start = new Date(startDate + "T12:00");
    const end = new Date(endDate + "T12:00");
    if (start > end) return [];
    const dates = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  })();

  // Compute what the bulk import would create — gives the user a clear preview
  // before they confirm. Returns array of { date, count } that will be added.
  const preview = (() => {
    if (dateList.length === 0) return [];
    const dates = flockId
      ? dateList
      : dateList; // Per-flock targeting handled at submit time
    const existingByDate = new Set();
    if (conflictMode === "skip" && flockId) {
      entries.forEach(e => {
        if (e.flockId === flockId && (e.action === "eggs" || e.action === "eggs_laid")) {
          existingByDate.add(e.date);
        }
      });
    }
    const eligible = dates.filter(d => !existingByDate.has(d));
    if (eligible.length === 0) return [];

    if (mode === "total") {
      const total = parseInt(totalCount);
      if (!total || total <= 0) return [];
      const per = Math.floor(total / eligible.length);
      const remainder = total - per * eligible.length;
      // Distribute the remainder over the last `remainder` days so the sum
      // matches exactly what the user typed. Example: 100 eggs / 30 days =
      // 3 per day, with 10 days getting 4. The +1 days are the most recent.
      return eligible.map((d, i) => ({
        date: d,
        count: per + (i >= eligible.length - remainder ? 1 : 0),
      })).filter(e => e.count > 0);
    } else {
      const per = parseInt(perDayCount);
      if (!per || per <= 0) return [];
      return eligible.map(d => ({ date: d, count: per }));
    }
  })();

  const previewTotal = preview.reduce((s, e) => s + e.count, 0);
  const previewDays = preview.length;
  const skippedDays = dateList.length - previewDays;

  const validate = () => {
    if (!startDate || !endDate) {
      setValidationError("Pick a start and end date.");
      return false;
    }
    if (dateList.length === 0) {
      setValidationError("End date must be on or after start date.");
      return false;
    }
    if (dateList.length > 730) {
      setValidationError("Date range is over 2 years. Split into smaller chunks.");
      return false;
    }
    if (flocks.length > 0 && !flockId) {
      setValidationError("Pick which flock these eggs came from.");
      return false;
    }
    if (mode === "total") {
      const n = parseInt(totalCount);
      if (!totalCount || isNaN(n) || n <= 0) {
        setValidationError("Enter a total egg count greater than 0.");
        return false;
      }
    } else {
      const n = parseInt(perDayCount);
      if (!perDayCount || isNaN(n) || n <= 0) {
        setValidationError("Enter an average eggs-per-day greater than 0.");
        return false;
      }
    }
    if (preview.length === 0) {
      setValidationError("Nothing to add — every date in the range already has eggs logged for this flock. Switch to 'add to existing' if you want to stack on top.");
      return false;
    }
    setValidationError("");
    return true;
  };

  const flockObj = flocks.find(f => f.id === flockId);

  const commit = () => {
    update((d) => {
      d.entries[hobby.id] = d.entries[hobby.id] || [];
      const batchId = `bulk-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const created = Date.now();
      // If "add to existing", we want to SUM with whatever's already there,
      // not stack a separate entry. To keep the data model clean, we still
      // create one entry per backfilled day — analytics already sums entries
      // by date, so stacking is fine. The skip-mode handles the "don't touch
      // already-logged days" case at preview time.
      preview.forEach(({ date, count }) => {
        d.entries[hobby.id].push({
          id: newId(),
          date,
          action: "eggs_laid",
          count,
          flockId: flockId || null,
          birdType: flockObj?.birdType || null,
          bulkBackfill: true,
          bulkBatchId: batchId,
          created,
        });
      });
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={confirming ? "Confirm bulk add" : "Backfill historical eggs"}>
      {!confirming ? (
        <>
          <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
            Add historical egg counts in one go — useful when bringing an existing flock up to date. We'll distribute the count evenly across the date range.
          </div>

          {flocks.length > 1 && (
            <Field label="Which flock?">
              <select style={inputStyle} value={flockId} onChange={(e) => { setFlockId(e.target.value); setValidationError(""); }}>
                <option value="">— pick a flock —</option>
                {flocks.map(f => (
                  <option key={f.id} value={f.id}>{f.name} ({f.birdType || "Bird"})</option>
                ))}
              </select>
            </Field>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Field label="Start date">
                <input type="date" style={inputStyle} value={startDate} max={endDate || today} onChange={(e) => { setStartDate(e.target.value); setValidationError(""); }} />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="End date">
                <input type="date" style={inputStyle} value={endDate} max={today} onChange={(e) => { setEndDate(e.target.value); setValidationError(""); }} />
              </Field>
            </div>
          </div>

          <Field label="How do you want to enter the count?">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { k: "total", l: "Total across range" },
                { k: "perday", l: "Average per day" },
              ].map(o => (
                <button
                  key={o.k}
                  onClick={() => { setMode(o.k); setValidationError(""); }}
                  style={{
                    flex: "1 1 130px", padding: "8px 12px", borderRadius: 8,
                    border: `1.5px solid ${mode === o.k ? palette.ink : palette.line}`,
                    background: mode === o.k ? palette.ink : palette.bg,
                    color: mode === o.k ? palette.bg : palette.ink,
                    fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >{o.l}</button>
              ))}
            </div>
          </Field>

          {mode === "total" ? (
            <Field label="Total eggs across the range">
              <input
                type="number" inputMode="numeric"
                style={inputStyle}
                value={totalCount}
                onChange={(e) => { setTotalCount(e.target.value); setValidationError(""); }}
                placeholder="e.g. 500"
              />
            </Field>
          ) : (
            <Field label="Average eggs per day">
              <input
                type="number" inputMode="numeric"
                style={inputStyle}
                value={perDayCount}
                onChange={(e) => { setPerDayCount(e.target.value); setValidationError(""); }}
                placeholder="e.g. 18"
              />
            </Field>
          )}

          <Field label="If a date already has eggs logged">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { k: "add", l: "Add on top" },
                { k: "skip", l: "Skip those dates" },
              ].map(o => (
                <button
                  key={o.k}
                  onClick={() => setConflictMode(o.k)}
                  style={{
                    flex: "1 1 130px", padding: "8px 12px", borderRadius: 8,
                    border: `1.5px solid ${conflictMode === o.k ? palette.ink : palette.line}`,
                    background: conflictMode === o.k ? palette.ink : palette.bg,
                    color: conflictMode === o.k ? palette.bg : palette.ink,
                    fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >{o.l}</button>
              ))}
            </div>
          </Field>

          {/* Live preview so the user knows exactly what's about to happen */}
          {preview.length > 0 && (
            <div style={{
              padding: 12, marginBottom: 12, borderRadius: 8,
              background: palette.bgAlt, border: `1.5px solid ${palette.line}`,
              fontSize: 13, color: palette.ink, lineHeight: 1.5,
            }}>
              <strong>Preview:</strong> {previewTotal} eggs across {previewDays} day{previewDays === 1 ? "" : "s"}
              {skippedDays > 0 && <> · {skippedDays} day{skippedDays === 1 ? "" : "s"} skipped (already had eggs)</>}
              {mode === "total" && previewTotal > 0 && previewDays > 0 && (
                <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 4 }}>
                  Average: {(previewTotal / previewDays).toFixed(1)} eggs/day
                </div>
              )}
            </div>
          )}

          {validationError && (
            <div style={{
              padding: 10, marginBottom: 12, borderRadius: 6,
              background: "#FBE5DE", border: `1.5px solid ${palette.accent}`,
              fontSize: 13, color: palette.accent,
            }}>
              {validationError}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="primary" onClick={() => { if (validate()) setConfirming(true); }}>Continue</Btn>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          </div>
        </>
      ) : (
        // ----- Confirmation step -----
        // Show the exact number of entries about to be created. This is a
        // potentially heavy operation (could be 500+ entries) and we want the
        // user to have a clear chance to back out.
        <>
          <div style={{
            padding: 14, marginBottom: 16, borderRadius: 8,
            background: palette.yolkSoft, border: `1.5px solid ${palette.line}`,
            fontSize: 14, color: palette.ink, lineHeight: 1.5,
          }}>
            About to add <strong>{previewDays}</strong> egg{previewDays === 1 ? " entry" : " entries"} totaling <strong>{previewTotal}</strong> egg{previewTotal === 1 ? "" : "s"}, from <strong>{startDate}</strong> to <strong>{endDate}</strong>
            {flockObj && <> for <strong>{flockObj.name}</strong></>}.
          </div>
          <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 16, lineHeight: 1.5 }}>
            This can't be undone in one click — but each entry can be edited or deleted individually from the activity log if needed.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="primary" onClick={commit}>Yes, add {previewDays} entries</Btn>
            <Btn variant="ghost" onClick={() => setConfirming(false)}>Back</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

// ============ GARDEN SEASON MODALS ============
function StartGardenSeasonModal({ hobby, update, onClose }) {
  const guess = (() => {
    const m = new Date().getMonth();
    const y = new Date().getFullYear();
    if (m >= 1 && m <= 5) return `Spring ${y}`;
    if (m >= 6 && m <= 8) return `Summer ${y}`;
    if (m >= 9 && m <= 10) return `Fall ${y}`;
    return `Winter ${y}`;
  })();
  const [name, setName] = useState(guess);
  const [date, setDate] = useState(todayStr());

  return (
    <Modal open onClose={onClose} title="🌱 Start new garden season">
      <Field label="Season name">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring 2026" />
      </Field>
      <Field label="Start date">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 14 }}>
        Plantings, harvests, waterings, issues, and notes you log during this season will be archived together when you close it out.
      </div>
      <Btn variant="primary" onClick={() => {
        if (!name.trim()) return;
        update((d) => {
          const h = d.hobbies.find((x) => x.id === hobby.id);
          h.currentSeason = {
            id: newId(),
            name: name.trim(),
            startDate: date,
          };
          return d;
        });
        onClose();
      }}>Start season</Btn>
    </Modal>
  );
}

function CloseGardenSeasonModal({ hobby, entries, update, onClose }) {
  const season = hobby.currentSeason;
  if (!season) {
    return (
      <Modal open onClose={onClose} title="Close season">
        <div>No active season.</div>
      </Modal>
    );
  }
  const seasonEntries = entries.filter((e) => e.seasonId === season.id);
  const harvests = seasonEntries.filter((e) => e.action === "harvested");
  const totalHarvest = harvests.reduce((s, e) => s + (Number(e.quantity) || 0), 0);
  const totalCost = seasonEntries.reduce((s, e) => s + (Number(e.cost) || 0), 0);

  return (
    <Modal open onClose={onClose} title={`Close out ${season.name}?`}>
      <div style={{
        padding: 12, background: palette.bgAlt, borderRadius: 8,
        marginBottom: 14, fontSize: 14, lineHeight: 1.6,
      }}>
        <div style={{ marginBottom: 6 }}>
          <strong>Season summary:</strong>
        </div>
        <div style={{ fontSize: 13, color: palette.inkSoft }}>
          {seasonEntries.length} entries · {harvests.length} harvests · {totalHarvest.toFixed(1)} total yield · {fmtMoney(totalCost)} costs
        </div>
      </div>

      <div style={{
        padding: 12, background: palette.yolkSoft, borderRadius: 8,
        fontSize: 13, color: palette.ink, marginBottom: 16, lineHeight: 1.5,
        border: `1.5px solid ${palette.line}`,
      }}>
        Closing the season archives all entries to your analytics and clears the dashboard. You can start a new season after.
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="danger" onClick={() => {
          update((d) => {
            const h = d.hobbies.find((x) => x.id === hobby.id);
            const finalSeason = JSON.parse(JSON.stringify(h.currentSeason));
            finalSeason.endDate = todayStr();
            // attach all entries that belong to this season
            finalSeason.finalEntries = (d.entries[hobby.id] || []).filter((e) => e.seasonId === season.id);
            h.archivedSeasons = h.archivedSeasons || [];
            h.archivedSeasons.push(finalSeason);
            // remove season entries from active log
            d.entries[hobby.id] = (d.entries[hobby.id] || []).filter((e) => e.seasonId !== season.id);
            h.currentSeason = null;
            return d;
          });
          onClose();
        }}>Yes, close season</Btn>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>
  );
}

// ============ LOG MODAL (DIFFERENT BY ACTION) ============
function LogModal({ hobby, action, data, update, onClose, user, existingEntry }) {
  const isEdit = !!existingEntry;

  // Push 4b — multi-batch support for meat chickens. Active batches live in
  // hobby.currentBatches[] (array). The picker is shown only when there's
  // more than one active batch AND the action is batch-scoped (death, fed,
  // watered, note, etc — anything tied to the birds themselves rather than
  // hobby-wide infrastructure). For single-batch hobbies we auto-attach so
  // the UI stays uncluttered.
  const activeBatches = (hobby.type === "meat_chickens" && Array.isArray(hobby.currentBatches))
    ? hobby.currentBatches
    : [];
  // Actions that belong to a specific batch. "infrastructure" is hobby-wide
  // (coop building, fencing, etc.) and stays un-batched.
  const batchScopedActions = ["fed", "watered", "death", "note", "move_tractor"];
  const isBatchScoped = hobby.type === "meat_chickens" && batchScopedActions.includes(action);
  const needsBatchPicker = isBatchScoped && activeBatches.length > 1 && !isEdit;

  // Pre-populate from existingEntry when editing.
  const [date, setDate] = useState(() => existingEntry ? existingEntry.date : todayStr());
  const [fields, setFields] = useState(() => {
    if (!existingEntry) return {};
    // Copy all fields except metadata
    const { id, date: _d, action: _a, created, photoPath, photoPaths, weather, batchId, seasonId, ...rest } = existingEntry;
    return rest;
  });
  // Selected batch for new meat-chicken entries. Auto-set when only one
  // active batch exists; left empty when multiple, so submit gate fires.
  const [selectedBatchId, setSelectedBatchId] = useState(() => {
    if (isEdit) return existingEntry.batchId || "";
    if (isBatchScoped && activeBatches.length === 1) return activeBatches[0].id;
    return "";
  });
  // Validation error shown inline above the submit button.
  const [validationError, setValidationError] = useState("");
  // existingPaths: paths from already-uploaded photos that we want to KEEP on this entry.
  // (Distinct from new files the user is uploading this session.)
  const [existingPaths, setExistingPaths] = useState(() => {
    if (!existingEntry) return [];
    return getEntryPhotos(existingEntry);
  });
  // photoFiles: NEW File objects selected this session, not yet uploaded.
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");

  const set = (k, v) => setFields((f) => ({ ...f, [k]: v }));

  // Prefill the chicken-tractor distance from the flock/batch default exactly
  // once when the modal mounts for a move_tractor log. We can't just use the
  // default as the input's value fallback — that would lock the field, making
  // it impossible to clear and replace (the input snaps back to the default
  // any time the user types an empty string). Doing it as a one-shot effect
  // means the user can freely delete and re-type after the prefill lands.
  useEffect(() => {
    if (action !== "move_tractor" || isEdit) return;
    const flocks = hobby.flocks || hobby.currentBatches || [];
    const defaultDist = flocks.find(f => Number(f.tractorDistanceFeet) > 0)?.tractorDistanceFeet;
    if (defaultDist && !fields.distanceFeet) {
      set("distanceFeet", String(defaultDist));
    }
    // Intentionally empty deps — fire once when the modal opens for a new
    // move_tractor entry. We don't re-prefill if the user clears the field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Which actions support attaching photos
  const supportsPhoto = ["note", "harvested", "planted", "issue"].includes(action);
  const MAX_PHOTOS = 5;
  const totalPhotoCount = existingPaths.length + photoFiles.length;

  const submit = async () => {
    // Push 4b — gate submission when a batch picker was required but skipped.
    if (needsBatchPicker && !selectedBatchId) {
      setValidationError("Please pick which batch this entry belongs to.");
      return;
    }
    setValidationError("");

    // Coerce numeric fields from string inputs to actual numbers
    const numericKeys = ["quantity", "cost", "lbs", "gallons", "count", "cuft", "avgWeight", "pricePerDozen", "unitQty", "pricePerUnit", "customEggsPerUnit", "distanceFeet", "feedAmount"];
    const cleanFields = { ...fields };
    numericKeys.forEach((k) => {
      if (cleanFields[k] !== undefined && cleanFields[k] !== "") {
        const n = parseFloat(cleanFields[k]);
        cleanFields[k] = isNaN(n) ? 0 : n;
      }
    });

    // For sold_eggs with new unit-based fields, derive the canonical `count`
    // (total eggs) and `pricePerDozen` so existing analytics keep working.
    // Old entries (without unit/unitQty) still have count and pricePerDozen
    // set directly — the derivation only runs when the new fields are present.
    if (action === "sold_eggs" && cleanFields.unit && cleanFields.unitQty) {
      const unitToCount = {
        single: 1, half_dozen: 6, dozen: 12, eighteen: 18, flat: 30,
        custom: cleanFields.customEggsPerUnit || 0,
      };
      const eggsPerUnit = unitToCount[cleanFields.unit] || 12;
      const totalEggs = (cleanFields.unitQty || 0) * eggsPerUnit;
      const totalRevenue = (cleanFields.unitQty || 0) * (cleanFields.pricePerUnit || 0);
      cleanFields.count = totalEggs;
      // Back-compute price per dozen for older analytics (totalRevenue / dozens)
      cleanFields.pricePerDozen = totalEggs > 0 ? (totalRevenue / (totalEggs / 12)) : 0;
    }

    // We need an entry id up front so we can attach photos to it.
    // For edits, we keep the existing id so we don't create a duplicate.
    const entryId = isEdit ? existingEntry.id : newId();

    // Upload any newly-selected photos in parallel. existingPaths are kept as-is.
    let finalPaths = [...existingPaths];

    if (photoFiles.length > 0) {
      if (!user) {
        setPhotoError("Sign in first to upload photos.");
        return;
      }
      setPhotoUploading(true);
      setPhotoError("");
      try {
        const uploaded = await Promise.all(
          photoFiles.map((f) => uploadPhoto(user, entryId, f))
        );
        finalPaths = [...finalPaths, ...uploaded];

        // If editing, also delete photos the user removed from existingPaths
        // (compared to what was originally on the entry).
        if (isEdit) {
          const wasOnEntry = getEntryPhotos(existingEntry);
          const removed = wasOnEntry.filter((p) => !existingPaths.includes(p));
          removed.forEach((p) => deletePhoto(p).catch(() => {}));
        }
      } catch (e) {
        setPhotoError(e.message || "Upload failed. Try again or save without photos.");
        setPhotoUploading(false);
        return;
      }
      setPhotoUploading(false);
    } else if (isEdit) {
      // No new photos uploaded, but we may still need to delete photos
      // the user removed from existingPaths.
      const wasOnEntry = getEntryPhotos(existingEntry);
      const removed = wasOnEntry.filter((p) => !existingPaths.includes(p));
      removed.forEach((p) => deletePhoto(p).catch(() => {}));
    }

    // Fetch weather only for new entries — preserve existing weather on edits.
    let weather = isEdit ? (existingEntry.weather || null) : null;
    if (!isEdit) {
      const loc = data.homesteadLocation;
      if (loc && loc.lat != null && loc.lon != null) {
        try {
          weather = await Promise.race([
            getDailyWeather(date, loc.lat, loc.lon),
            new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
          ]);
        } catch (e) {
          weather = null;
        }
      }
    }

    update((d) => {
      d.entries[hobby.id] = d.entries[hobby.id] || [];
      const entry = {
        id: entryId,
        date,
        action,
        created: isEdit ? existingEntry.created : Date.now(),
        ...cleanFields,
      };
      if (finalPaths.length > 0) entry.photoPaths = finalPaths;
      if (weather) entry.weather = weather;
      // Preserve batch/season association when editing
      if (isEdit) {
        if (existingEntry.batchId) entry.batchId = existingEntry.batchId;
        if (existingEntry.seasonId) entry.seasonId = existingEntry.seasonId;
      }

      // For new entries only, attach context and trigger side-effects.
      if (!isEdit) {
        // Push 4b — attach to selected batch for meat chickens. selectedBatchId
        // is auto-set when only one active batch exists; the picker forces a
        // choice when there are multiple. Batch-scoped actions only — infra
        // entries stay un-batched.
        if (hobby.type === "meat_chickens" && isBatchScoped && selectedBatchId) {
          entry.batchId = selectedBatchId;
        }
        // tag egg-layer entries with flock so per-flock analytics work.
        // Picker UI sets flockId for multi-flock users; this fallback covers
        // single-flock users (no picker shown) AND any edge case where the
        // picker was missed.
        const flockScopedActions = ["fed","bedding","death","eggs","eggs_laid","sold_eggs","note","issue","move_tractor","broody"];
        if (hobby.type === "egg_layers" && !entry.flockId && flockScopedActions.includes(action)) {
          const firstFlock = (hobby.flocks || [])[0];
          if (firstFlock) entry.flockId = firstFlock.id;
        }

        // ---- Chicken tractor: persist the per-move distance to the flock/batch ----
        // First time the user logs move_tractor, the distance they entered
        // becomes the default for future moves on the same flock/batch.
        // We write to ALL flocks/batches in the hobby so multi-flock setups
        // don't have to re-prompt for each one. The per-entry distanceFeet
        // is the source of truth for analytics (preserves historical accuracy
        // if the user later changes the default).
        if (action === "move_tractor" && Number(entry.distanceFeet) > 0) {
          const h = d.hobbies.find(x => x.id === hobby.id);
          if (h) {
            const flockArr = h.type === "meat_chickens" ? "currentBatches" : "flocks";
            if (Array.isArray(h[flockArr])) {
              for (const f of h[flockArr]) {
                if (!Number(f.tractorDistanceFeet) || Number(f.tractorDistanceFeet) <= 0) {
                  f.tractorDistanceFeet = Number(entry.distanceFeet);
                }
              }
            }
          }
        }

        // attach to current season for garden
        if (hobby.type === "garden") {
          const h = d.hobbies.find((x) => x.id === hobby.id);
          if (h && h.currentSeason) {
            entry.seasonId = h.currentSeason.id;
          }
        }

        // garden planting -> create planting record
        if (action === "planted" && cleanFields.plant) {
          d.plantings = d.plantings || [];
          d.plantings.push({
            id: newId(), plant: cleanFields.plant, quantity: cleanFields.quantity,
            date, harvested: false,
          });
        }

        // egg layer death decrements flock by the quantity (default 1)
        if (action === "death" && hobby.type === "egg_layers") {
          const h = d.hobbies.find((x) => x.id === hobby.id);
          const n = Math.max(1, Number(cleanFields.count) || 1);
          h.flockSize = Math.max(0, (h.flockSize || 0) - n);
        }

        // Broody log side-effect: keep the named-bird `broody` flag and the
        // flock-level broodyCount in sync with what the user just logged.
        // "started" → bird goes broody, counter goes up. "ended" → flag off,
        // counter goes down. When no named bird is picked we only touch the
        // flock counter (for users who don't use named birds).
        if (action === "broody" && hobby.type === "egg_layers") {
          const h = d.hobbies.find((x) => x.id === hobby.id);
          const fl = (h.flocks || []).find(x => x.id === entry.flockId);
          if (fl) {
            const status = cleanFields.broodyStatus || "started";
            const namedId = cleanFields.namedBirdId || null;
            if (namedId) {
              const nb = (fl.namedBirds || []).find(b => b.id === namedId);
              if (nb) {
                nb.broody = (status === "started");
                // Stamp the bird's name on the entry so the activity feed
                // and Journal can display "Henrietta — went broody" without
                // an extra lookup later.
                const entryRef = (d.entries[hobby.id] || []).find(e => e.id === entry.id);
                if (entryRef) entryRef.namedBirdName = nb.name;
              }
            } else {
              // Flock-level counter only — bump up or down based on status.
              const cur = Number(fl.broodyCount) || 0;
              fl.broodyCount = status === "started" ? cur + 1 : Math.max(0, cur - 1);
            }
          }
        }

        // "Total" flock divvy: split eggs across all flocks using
        // largest-remainder. 13 eggs / 4 flocks → 4,3,3,3 (the first
        // (remainder) flocks each get +1 to absorb the slack).
        // Creates one entry per flock so per-flock analytics stay accurate;
        // each split entry carries `totalEntryGroup` so they can be
        // recognized as a single user action later.
        if (
          (action === "eggs" || action === "eggs_laid") &&
          hobby.type === "egg_layers" &&
          entry.flockId === "__TOTAL__"
        ) {
          const flocks = (hobby.flocks || []).filter(Boolean);
          if (flocks.length > 0) {
            const total = Math.max(0, Number(entry.count) || 0);
            const base = Math.floor(total / flocks.length);
            const remainder = total - base * flocks.length;
            const groupId = entry.id; // reuse so it's stable
            flocks.forEach((fl, i) => {
              const share = base + (i < remainder ? 1 : 0);
              if (share <= 0 && total > 0) return; // skip 0-share entries when there's at least some count
              d.entries[hobby.id].push({
                ...entry,
                id: newId(),
                count: share,
                flockId: fl.id,
                totalEntryGroup: groupId,
                splitFromTotal: total,
              });
            });
            return d; // skip the default push below
          }
        }

        d.entries[hobby.id].push(entry);
      } else {
        // Edit: replace the existing entry in place. The entry may live in
        // data.entries[hobby.id] OR — for finalized meat-bird batches — on
        // an archivedBatch's finalEntries snapshot. Update wherever it is.
        const idx = d.entries[hobby.id].findIndex((e) => e.id === existingEntry.id);
        if (idx !== -1) {
          d.entries[hobby.id][idx] = entry;
        } else {
          let foundInArchive = false;
          const hForArchive = d.hobbies.find((x) => x.id === hobby.id);
          if (hForArchive && Array.isArray(hForArchive.archivedBatches)) {
            for (const b of hForArchive.archivedBatches) {
              if (!Array.isArray(b.finalEntries)) continue;
              const ai = b.finalEntries.findIndex((e) => e.id === existingEntry.id);
              if (ai !== -1) {
                b.finalEntries[ai] = entry;
                foundInArchive = true;
                break;
              }
            }
          }
          if (!foundInArchive) {
            // Not in live entries OR archived snapshots — add as new to avoid losing the edit.
            d.entries[hobby.id].push(entry);
          }
        }
      }

      return d;
    });
    onClose();
  };

  const titles = {
    watered: "watering", planted: "planting", harvested: "harvest",
    issue: "issue", fed: "feed", free_range: "free-range",
    eggs: "eggs collected", bedding: "bedding change", death: "death",
    note: "a note", butcher: "butcher",
    sold_eggs: "eggs sold", infrastructure: "infrastructure",
    eggs_laid: "eggs laid", broody: "broody hen",
  };
  const titlePrefix = isEdit ? "Edit" : "Log";
  const dynamicTitle = `${titlePrefix} ${titles[action] || "entry"}`;

  // existing plant names from history (for the autocomplete-ish helper)
  const plants = Array.from(new Set((data.plantings || []).map((p) => p.plant).filter(Boolean)));

  return (
    <Modal open onClose={onClose} title={dynamicTitle}>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      {/* Flock picker — egg-layer actions get scoped to a specific flock so
          per-flock cost/death/feed analytics work. Auto-attached to the first
          flock if only one exists; on submit, falls back to the first flock
          to keep entries from going un-flocked.
          For egg-collection actions only, we also offer "Total — split across
          all flocks" which divides the count using largest-remainder (e.g.
          13 across 4 flocks → 4/3/3/3) and creates one entry per flock. */}
      {hobby.type === "egg_layers" && Array.isArray(hobby.flocks) && hobby.flocks.length > 1 &&
        ["fed","bedding","death","eggs","sold_eggs","note","issue"].includes(action) && (
        <Field label="Which flock?">
          <select
            style={inputStyle}
            value={fields.flockId || hobby.flocks[0]?.id || ""}
            onChange={(e) => set("flockId", e.target.value)}
          >
            {(action === "eggs" || action === "eggs_laid") && (
              <option value="__TOTAL__">🥚 Total — split evenly across all flocks</option>
            )}
            {hobby.flocks.map(f => (
              <option key={f.id} value={f.id}>
                {f.name}{f.birdType ? ` (${f.birdType})` : ""}
              </option>
            ))}
          </select>
          {fields.flockId === "__TOTAL__" && (action === "eggs" || action === "eggs_laid") && (
            <div style={{ fontSize:11, color:palette.inkSoft, marginTop:6, lineHeight:1.4 }}>
              Eggs will be divided evenly across all {hobby.flocks.length} flocks. If the count doesn't divide evenly, the remainder is spread one egg at a time (e.g. 13 eggs across 4 flocks → 4/3/3/3).
            </div>
          )}
        </Field>
      )}

      {/* Batch picker — meat-chicken actions get scoped to a specific batch
          when more than one is active. Auto-selected on submit when only one
          batch exists; required (no default) when multiple, so the user is
          forced to choose. Hidden entirely on edits (batchId is already on
          the entry) and for infrastructure actions which are hobby-wide. */}
      {needsBatchPicker && (
        <Field label="Which batch?">
          <select
            style={inputStyle}
            value={selectedBatchId}
            onChange={(e) => { setSelectedBatchId(e.target.value); setValidationError(""); }}
          >
            <option value="">— Pick a batch —</option>
            {activeBatches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name || "Batch"}{b.startCount ? ` (${b.startCount} birds)` : ""}
              </option>
            ))}
          </select>
        </Field>
      )}

      {action === "watered" && hobby.type === "garden" && (
        <Field label="Notes (amount, beds, etc.)">
          <input style={inputStyle} value={fields.amount || ""} onChange={(e) => set("amount", e.target.value)} placeholder="e.g. soaked all beds" />
        </Field>
      )}

      {action === "watered" && hobby.type !== "garden" && (
        <Field label="Gallons">
          <input type="number" inputMode="decimal" step="0.1" style={inputStyle} value={fields.gallons || ""} onChange={(e) => set("gallons", e.target.value)} />
        </Field>
      )}

      {action === "fertilized" && hobby.type === "garden" && (
        <>
          <Field label="Type">
            <select style={inputStyle} value={fields.fertilizerType || "compost"} onChange={(e) => set("fertilizerType", e.target.value)}>
              <option value="compost">Compost</option>
              <option value="manure">Manure</option>
              <option value="granular">Granular (synthetic)</option>
              <option value="liquid">Liquid feed</option>
              <option value="foliar">Foliar spray</option>
              <option value="amendment">Soil amendment (lime, gypsum, etc.)</option>
              <option value="cover_crop">Cover crop / green manure</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Product / source (optional)">
            <input style={inputStyle} value={fields.product || ""} onChange={(e) => set("product", e.target.value)} placeholder="e.g. Espoma Plant-tone, chicken manure" />
          </Field>
          <Field label="Amount (optional)">
            <input style={inputStyle} value={fields.amount || ""} onChange={(e) => set("amount", e.target.value)} placeholder='e.g. "2 lbs", "1 wheelbarrow", "1 gal diluted"' />
          </Field>
          <Field label="Where (optional)">
            <input style={inputStyle} value={fields.bed || ""} onChange={(e) => set("bed", e.target.value)} placeholder="All beds, tomato bed, etc." />
          </Field>
          <Field label="Cost ($, optional)">
            <input type="number" inputMode="decimal" step="0.01" min={0} style={inputStyle} value={fields.cost || ""} onChange={(e) => set("cost", e.target.value)} placeholder="0.00" />
          </Field>
        </>
      )}

      {action === "planted" && (
        <>
          <Field label="Plant / crop">
            <input style={inputStyle} list="plant-list" value={fields.plant || ""} onChange={(e) => set("plant", e.target.value)} placeholder="Tomato, Kale..." />
            <datalist id="plant-list">{plants.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
          <Field label="How many">
            <input type="number" inputMode="numeric" style={inputStyle} value={fields.quantity || ""} onChange={(e) => set("quantity", e.target.value)} />
          </Field>
          <Field label="Bed / location (optional)">
            <input style={inputStyle} value={fields.bed || ""} onChange={(e) => set("bed", e.target.value)} />
          </Field>
          <Field label="Cost (seeds, soil — optional)">
            <input type="number" inputMode="decimal" step="0.01" style={inputStyle} value={fields.cost || ""} onChange={(e) => set("cost", e.target.value)} />
          </Field>
        </>
      )}

      {action === "harvested" && (
        <>
          <Field label="Plant / crop">
            <input style={inputStyle} list="plant-list" value={fields.plant || ""} onChange={(e) => set("plant", e.target.value)} placeholder="Tomato, Kale..." />
            <datalist id="plant-list">{plants.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
          <Field label="Quantity">
            <input type="number" inputMode="decimal" step="0.01" style={inputStyle} value={fields.quantity || ""} onChange={(e) => set("quantity", e.target.value)} />
          </Field>
          <Field label="Unit">
            <select style={inputStyle} value={fields.unit || "lbs"} onChange={(e) => set("unit", e.target.value)}>
              <option value="lbs">lbs</option>
              <option value="oz">oz</option>
              <option value="count">count</option>
              <option value="bunch">bunches</option>
            </select>
          </Field>
        </>
      )}

      {action === "issue" && (
        <>
          <Field label="Type">
            <select style={inputStyle} value={fields.issueType || "disease"} onChange={(e) => set("issueType", e.target.value)}>
              <option value="disease">Disease</option>
              <option value="pest">Pest</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Plant affected (optional)">
            <input style={inputStyle} list="plant-list" value={fields.plant || ""} onChange={(e) => set("plant", e.target.value)} />
          </Field>
          <Field label="Specific (e.g. powdery mildew, aphids)">
            <input style={inputStyle} value={fields.detail || ""} onChange={(e) => set("detail", e.target.value)} />
          </Field>
          <Field label="Notes / solution">
            <textarea style={{ ...inputStyle, minHeight: 70 }} value={fields.notes || ""} onChange={(e) => set("notes", e.target.value)} placeholder="What you'll try..." />
          </Field>
        </>
      )}

      {action === "fed" && (
        <>
          {/* Unit toggle — defaults to lbs (matches existing logs and the
              most common case: buying feed by the bag). Switching to cups
              writes feedUnit=cups + feedAmount; the legacy `lbs` field stays
              empty for cup-logged entries so analytics can sum the two units
              separately rather than incorrectly mixing them. */}
          {(() => {
            const currentUnit = fields.feedUnit || (fields.lbs ? "lbs" : (isEdit ? "lbs" : "lbs"));
            const setUnit = (u) => {
              setFields(f => {
                const next = { ...f, feedUnit: u };
                // Moving amount between fields based on unit so the visible
                // input stays populated when the user toggles.
                if (u === "cups") {
                  // Keep what they typed but stop labeling it as lbs
                  next.feedAmount = next.feedAmount || next.lbs || "";
                  delete next.lbs;
                } else {
                  // Switching back to lbs
                  next.lbs = next.lbs || next.feedAmount || "";
                  delete next.feedAmount;
                }
                return next;
              });
            };
            return (
              <Field label="How much feed?">
                <div style={{ display:"flex",gap:8,marginBottom:8 }}>
                  {["lbs","cups"].map(u => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      style={{
                        flex:1,padding:"8px 10px",borderRadius:8,
                        border:`1.5px solid ${currentUnit===u?palette.ink:palette.line}`,
                        background: currentUnit===u?palette.ink:palette.card,
                        color: currentUnit===u?palette.bg:palette.ink,
                        fontFamily:FONT_BODY,fontSize:13,fontWeight:600,cursor:"pointer",
                      }}
                    >{u}</button>
                  ))}
                </div>
                <input
                  type="number" inputMode="decimal" step="0.1"
                  style={inputStyle}
                  value={currentUnit === "cups" ? (fields.feedAmount || "") : (fields.lbs || "")}
                  onChange={(e) => set(currentUnit === "cups" ? "feedAmount" : "lbs", e.target.value)}
                  placeholder={currentUnit === "cups" ? "Cups of feed" : "Pounds of feed"}
                />
              </Field>
            );
          })()}
          <Field label="Cost of bag (or this feeding)">
            <input type="number" inputMode="decimal" step="0.01" style={inputStyle} value={fields.cost || ""} onChange={(e) => set("cost", e.target.value)} />
          </Field>
        </>
      )}

      {action === "free_range" && (
        <Field label="Notes (optional)">
          <input style={inputStyle} value={fields.note || ""} onChange={(e) => set("note", e.target.value)} placeholder="e.g. 4 hours in pasture" />
        </Field>
      )}

      {action === "move_tractor" && (() => {
        // First-time prompt: if NO flock (egg layers) or batch (meat birds) on
        // this hobby has tractorDistanceFeet set yet, ask for the distance.
        // Once set, subsequent moves auto-reuse the flock's default and just
        // log the event. The user can edit the per-move distance any time
        // by tapping into the note line — but the common case is one tap
        // and done. The per-entry distanceFeet is the source of truth for
        // analytics; the flock's value is just the default for new moves.
        const flocks = hobby.flocks || hobby.currentBatches || [];
        const anyHasDistance = flocks.some(f => Number(f.tractorDistanceFeet) > 0);
        const defaultDist = flocks.find(f => Number(f.tractorDistanceFeet) > 0)?.tractorDistanceFeet || "";
        return (
          <>
            {!anyHasDistance ? (
              <>
                <div style={{ fontSize:12,color:palette.inkSoft,marginBottom:10,padding:"10px 12px",background:palette.bgAlt,borderRadius:8,lineHeight:1.5 }}>
                  🚜 First move! Roughly how far do you move the chicken tractor each time? This lets Henalytics track your "distance covered" stat over time — a fun fact for your year in review.
                </div>
                <Field label="Distance per move (feet)">
                  <input
                    type="number" inputMode="numeric"
                    style={inputStyle}
                    value={fields.distanceFeet || ""}
                    onChange={(e) => set("distanceFeet", e.target.value)}
                    placeholder="e.g. 10"
                    autoFocus
                  />
                </Field>
              </>
            ) : (
              <>
                <div style={{ fontSize:12,color:palette.inkSoft,marginBottom:10,lineHeight:1.5 }}>
                  Tracking {defaultDist} ft per move. Tap save to log it — or edit the distance below if today's move was different.
                </div>
                <Field label="Distance moved (feet)">
                  <input
                    type="number" inputMode="numeric"
                    style={inputStyle}
                    value={fields.distanceFeet ?? ""}
                    onChange={(e) => set("distanceFeet", e.target.value)}
                    placeholder={String(defaultDist)}
                  />
                </Field>
              </>
            )}
            <Field label="Notes (optional)">
              <input style={inputStyle} value={fields.note || ""} onChange={(e) => set("note", e.target.value)} placeholder="e.g. moved to north pasture" />
            </Field>
          </>
        );
      })()}

      {(action === "eggs" || action === "eggs_laid") && (
        <Field label="Eggs collected">
          <input type="number" inputMode="numeric" style={inputStyle} value={fields.count || ""} onChange={(e) => set("count", e.target.value)} />
        </Field>
      )}

      {action === "butcher" && (
        <>
          {/* Editing a butcher entry from the activity log. NOTE: we don't
              re-sync changes back to hobby.currentBatch.butchered[] here —
              that array tracks the running total per batch. Edits to count
              would desync the batch's remaining-bird count.
              For now: editing date and notes is safe; count/weight edits
              should be done by deleting + re-creating via the butcher modal. */}
          <Field label="How many butchered">
            <input
              type="number" inputMode="numeric"
              style={inputStyle}
              value={fields.count || ""}
              onChange={(e) => set("count", e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Average weight (lbs)">
            <input
              type="number" inputMode="decimal"
              step="0.01"
              style={inputStyle}
              value={fields.avgWeight || ""}
              onChange={(e) => set("avgWeight", e.target.value)}
              placeholder="0.0"
            />
          </Field>
          <Field label="Notes (optional)">
            <textarea
              style={{ ...inputStyle, minHeight: 50, resize: "vertical" }}
              value={fields.note || ""}
              onChange={(e) => set("note", e.target.value)}
              placeholder="Anything notable about this butcher day..."
            />
          </Field>
          <div style={{
            padding: 10, marginBottom: 12, borderRadius: 6,
            background: palette.bgAlt, border: `1.5px solid ${palette.line}`,
            fontSize: 11, color: palette.inkSoft, lineHeight: 1.5,
          }}>
            ℹ️ Heads up: changing count/weight here updates this entry but doesn't recalculate the batch's remaining-bird count. For accurate batch math, delete this entry and create a new one via the Butcher tile.
          </div>
        </>
      )}

      {action === "bedding" && (
        <>
          <Field label="Type of change">
            <select style={inputStyle} value={fields.changeType || "Partial"} onChange={(e) => set("changeType", e.target.value)}>
              <option value="Full">Full clean-out (replace bedding)</option>
              <option value="Partial">Partial / topped up</option>
              <option value="Power wash">Power wash (no bedding — wire floor)</option>
              <option value="Water rinse">Water rinse / scrub (no bedding — wire floor)</option>
              <option value="Poop tray">Poop tray dump (under roosts)</option>
              <option value="Other">Other</option>
            </select>
          </Field>
          {/* Bedding amount only matters for changes that actually use bedding —
              power wash / rinse / poop tray dump don't, so keep those fields
              optional rather than removing them, in case users mix patterns. */}
          <Field label="Cubic feet of bedding (optional)">
            <input type="number" inputMode="decimal" step="0.1" style={inputStyle} value={fields.cuft || ""} onChange={(e) => set("cuft", e.target.value)} placeholder="leave blank for rinse / power wash / poop tray" />
          </Field>
          <Field label="Cost (optional)">
            <input type="number" inputMode="decimal" step="0.01" style={inputStyle} value={fields.cost || ""} onChange={(e) => set("cost", e.target.value)} placeholder="0 for water-only cleanings" />
          </Field>
          <Field label="Notes (optional)">
            <input style={inputStyle} value={fields.note || ""} onChange={(e) => set("note", e.target.value)} placeholder="e.g. left hutch, quail run, ammonia getting strong" />
          </Field>
        </>
      )}

      {action === "death" && (
        <>
          <Field label="How many died?">
            <input type="number" inputMode="numeric" min="1" style={inputStyle} value={fields.count || ""} onChange={(e) => set("count", e.target.value)} placeholder="1" />
          </Field>
          <Field label="Cause / reason (optional)">
            <input style={inputStyle} value={fields.cause || ""} onChange={(e) => set("cause", e.target.value)} placeholder="predator, illness, unknown..." />
          </Field>
        </>
      )}

      {action === "sold_eggs" && (
        <>
          {/* Unit-based selling: user picks a unit size and enters quantity
              of units sold plus price per unit. Total egg count is derived
              for downstream analytics (cost/egg, etc.). Unit options match
              how eggs are actually sold at farmer's markets / farm gates. */}
          <Field label="Unit">
            <select style={inputStyle} value={fields.unit || "dozen"} onChange={(e) => set("unit", e.target.value)}>
              <option value="single">Single eggs (1 each)</option>
              <option value="half_dozen">Half dozen (6)</option>
              <option value="dozen">Dozen (12)</option>
              <option value="eighteen">18-pack</option>
              <option value="flat">Flat (30)</option>
              <option value="custom">Custom count</option>
            </select>
          </Field>
          {fields.unit === "custom" && (
            <Field label="Eggs per unit">
              <input type="number" inputMode="numeric" min={1} style={inputStyle} value={fields.customEggsPerUnit || ""} onChange={(e) => set("customEggsPerUnit", e.target.value)} placeholder="e.g. 24" />
            </Field>
          )}
          <Field label="Number of units">
            <input type="number" inputMode="numeric" min={1} style={inputStyle} value={fields.unitQty || ""} onChange={(e) => set("unitQty", e.target.value)} placeholder="how many" />
          </Field>
          <Field label="Price per unit ($)">
            <input type="number" inputMode="decimal" step="0.01" style={inputStyle} value={fields.pricePerUnit || ""} onChange={(e) => set("pricePerUnit", e.target.value)} placeholder="e.g. 6.00" />
          </Field>
          <Field label="Sold to / notes (optional)">
            <input style={inputStyle} value={fields.note || ""} onChange={(e) => set("note", e.target.value)} placeholder="neighbor, farmer's market..." />
          </Field>
          {(() => {
            const unitToCount = {
              single: 1, half_dozen: 6, dozen: 12, eighteen: 18, flat: 30,
              custom: parseInt(fields.customEggsPerUnit, 10) || 0,
            };
            const eggsPerUnit = unitToCount[fields.unit || "dozen"] || 12;
            const units = Number(fields.unitQty) || 0;
            const price = Number(fields.pricePerUnit) || 0;
            const totalEggs = units * eggsPerUnit;
            const totalRevenue = units * price;
            if (units > 0 && price > 0) {
              return (
                <div style={{
                  padding: 10, background: palette.yolkSoft, borderRadius: 6,
                  fontSize: 13, color: palette.ink, marginBottom: 14, textAlign: "center",
                }}>
                  <strong>{totalEggs} eggs</strong> · Revenue: <strong>{fmtMoney(totalRevenue)}</strong>
                </div>
              );
            }
            return null;
          })()}
        </>
      )}

      {action === "infrastructure" && (
        <>
          <Field label="What was built / repaired / bought?">
            <input style={inputStyle} value={fields.item || ""} onChange={(e) => set("item", e.target.value)} placeholder="new coop, run extension, fencing..." />
          </Field>
          <Field label="Cost ($)">
            <input type="number" inputMode="decimal" step="0.01" style={inputStyle} value={fields.cost || ""} onChange={(e) => set("cost", e.target.value)} />
          </Field>
          <Field label="Notes (optional)">
            <textarea style={{ ...inputStyle, minHeight: 60 }} value={fields.note || ""} onChange={(e) => set("note", e.target.value)} placeholder="materials, who built it, etc." />
          </Field>
        </>
      )}

      {action === "note" && (
        <Field label="Note">
          <textarea style={{ ...inputStyle, minHeight: 100 }} value={fields.note || ""} onChange={(e) => set("note", e.target.value)} placeholder="Anything you want to remember about this hobby..." autoFocus />
        </Field>
      )}

      {action === "broody" && (() => {
        // Broody log: pick a named hen if known, or just log against the flock.
        // Status = "started" or "ended" — toggles the hen's broody flag in the
        // save effect below. Females-only — broody is a hen behavior.
        // The flock id comes from the flock picker (fields.flockId), with a
        // fallback to the first flock for single-flock users where the picker
        // isn't shown.
        const flockIdForBroody = fields.flockId || (hobby.flocks || [])[0]?.id;
        const flockForBroody = (hobby.flocks || []).find(f => f.id === flockIdForBroody);
        const broodyCandidates = (flockForBroody?.namedBirds || []).filter(b => !b.archived);
        const status = fields.broodyStatus || "started";
        const sn = sexNames(flockForBroody?.birdType);
        return (
          <>
            <Field label="What happened?">
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { v: "started", l: "🪺 Went broody" },
                  { v: "ended",   l: "✅ Broke / hatched" },
                ].map(o => (
                  <button key={o.v} onClick={() => set("broodyStatus", o.v)} style={{
                    flex: 1, padding: "8px 10px", borderRadius: 8,
                    border: `1.5px solid ${status === o.v ? palette.ink : palette.line}`,
                    background: status === o.v ? palette.ink : palette.card,
                    color: status === o.v ? palette.bg : palette.ink,
                    fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13, cursor: "pointer",
                  }}>{o.l}</button>
                ))}
              </div>
            </Field>
            {broodyCandidates.length > 0 && (
              <Field label={`Which ${sn.female}? (optional)`}>
                <select style={inputStyle} value={fields.namedBirdId || ""} onChange={e => set("namedBirdId", e.target.value)}>
                  <option value="">— No specific bird, just track count —</option>
                  {broodyCandidates.map(b => (
                    <option key={b.id} value={b.id}>{b.name}{b.broody ? " (currently broody)" : ""}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Note (optional)">
              <textarea style={{ ...inputStyle, minHeight: 70 }} value={fields.note || ""} onChange={(e) => set("note", e.target.value)} placeholder={status === "started" ? "Where she's sitting, how long, etc." : "Did chicks hatch? How many?"} />
            </Field>
          </>
        );
      })()}

      {/* PHOTO UPLOAD — supports up to 5 photos per entry */}
      {user && (
        <Field label={`Photos (optional) — ${totalPhotoCount}/${MAX_PHOTOS}`}>
          {/* Existing already-uploaded photos */}
          {existingPaths.length > 0 && (
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8,
            }}>
              {existingPaths.map((p) => (
                <div key={p} style={{ position: "relative" }}>
                  <EntryPhotoThumb path={p} size={64} />
                  <button
                    type="button"
                    onClick={() => setExistingPaths((paths) => paths.filter((x) => x !== p))}
                    style={{
                      position: "absolute", top: -4, right: -4,
                      width: 22, height: 22, borderRadius: 11,
                      background: palette.accent, color: "white",
                      border: "none", cursor: "pointer", fontSize: 12, lineHeight: 1,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    title="Remove this photo"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Newly-selected files (not yet uploaded) */}
          {photoFiles.length > 0 && (
            <div style={{
              display: "flex", flexDirection: "column", gap: 6, marginBottom: 8,
            }}>
              {photoFiles.map((f, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 10px", borderRadius: 8,
                  border: `1.5px solid ${palette.line}`, background: palette.card,
                }}>
                  <ImageIcon size={16} strokeWidth={1.8} color={palette.leaf} />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: palette.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.name} <span style={{ color: palette.inkSoft }}>({Math.round(f.size / 1024)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhotoFiles((files) => files.filter((_, j) => j !== i))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, padding: 4 }}
                    title="Remove"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add-photo controls — disabled when at max.
              Two paths: a multi-select library picker, and a separate camera-only
              shortcut. We can't combine them: `capture="environment"` forces the
              camera path and silently disables multi-select on iOS, so we keep
              them as siblings. */}
          {totalPhotoCount < MAX_PHOTOS && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{
                flex: "2 1 180px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "14px", borderRadius: 8,
                border: `1.5px dashed ${palette.line}`, background: palette.bgAlt,
                cursor: "pointer", color: palette.inkSoft, fontSize: 13,
              }}>
                <ImageIcon size={18} strokeWidth={1.8} />
                {totalPhotoCount === 0 ? "Add from library" : "Add more from library"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    // Cap to remaining slots
                    const remaining = MAX_PHOTOS - totalPhotoCount;
                    setPhotoFiles((current) => [...current, ...files.slice(0, remaining)]);
                    setPhotoError("");
                    // Reset input so picking the same file twice still triggers change
                    e.target.value = "";
                  }}
                />
              </label>
              <label style={{
                flex: "1 1 120px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "14px", borderRadius: 8,
                border: `1.5px dashed ${palette.line}`, background: palette.bgAlt,
                cursor: "pointer", color: palette.inkSoft, fontSize: 13,
              }}>
                <Camera size={18} strokeWidth={1.8} />
                Take photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    const remaining = MAX_PHOTOS - totalPhotoCount;
                    setPhotoFiles((current) => [...current, ...files.slice(0, remaining)]);
                    setPhotoError("");
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          )}

          {photoError && (
            <div style={{ fontSize: 12, color: palette.accent, marginTop: 6 }}>
              {photoError}
            </div>
          )}
        </Field>
      )}

      {!user && (
        <div style={{
          padding: 10, background: palette.bgAlt, borderRadius: 8,
          fontSize: 11, color: palette.inkSoft, marginBottom: 14, textAlign: "center",
        }}>
          📷 Sign in to add photos to your entries.
        </div>
      )}

      {validationError && (
        <div style={{
          padding: 10, marginBottom: 12, borderRadius: 6,
          background: "#FBE5DE", border: `1.5px solid ${palette.accent}`,
          fontSize: 13, color: palette.accent,
        }}>
          {validationError}
        </div>
      )}

      <Btn variant="primary" onClick={submit} disabled={photoUploading}>
        {photoUploading ? "Uploading photo..." : (isEdit ? "Save changes" : "Save entry")}
      </Btn>
    </Modal>
  );
}

// ============================================================================
// ONBOARDING WIZARD
// ----------------------------------------------------------------------------
// Three-screen setup shown to brand-new users (no entries logged + no
// onboardedAt timestamp). Captures: homestead name, location (via zip code),
// active hobbies. All three screens are skippable individually.
// ============================================================================
function OnboardingWizard({ update, onClose }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("us");
  const [zipLookupStatus, setZipLookupStatus] = useState("idle"); // idle | loading | ok | error
  const [zipResult, setZipResult] = useState(null); // { lat, lon, label }
  const [zipError, setZipError] = useState("");
  const [hobbies, setHobbies] = useState({ garden: true, egg_layers: true, meat_chickens: true, rabbits: false, bees: false, incubator: false, goats: false, cows: false, pigs: false, sheep: false, horses: false, sourdough: false, farmstand: false, baking: false, canning: false, freeze_drying: false, dehydrating: false, fermentation: false, dogs: false, cats: false, maple_syrup: false });

  // Look up zip code → coordinates via Zippopotam.us (free, no API key)
  const lookupZip = async () => {
    if (!zip.trim()) return;
    setZipLookupStatus("loading");
    setZipError("");
    try {
      const res = await fetch(`https://api.zippopotam.us/${country}/${encodeURIComponent(zip.trim())}`);
      if (!res.ok) {
        throw new Error("Zip code not found");
      }
      const json = await res.json();
      if (!json.places || json.places.length === 0) {
        throw new Error("No location data for that zip");
      }
      const place = json.places[0];
      const lat = parseFloat(place.latitude);
      const lon = parseFloat(place.longitude);
      const label = `${place["place name"]}, ${place["state abbreviation"] || place.state || ""}`.trim();
      // Zippopotam returns country abbreviation like "US"/"AU"/"GB" — keep
      // it so we can auto-pick the user's hardiness system in finish().
      const countryAbbr = (json["country abbreviation"] || country || "").toUpperCase();
      setZipResult({ lat, lon, label, countryCode: countryAbbr });
      setZipLookupStatus("ok");
    } catch (e) {
      setZipError(e.message || "Couldn't find that zip code. Double-check it.");
      setZipLookupStatus("error");
      setZipResult(null);
    }
  };

  const finish = () => {
    update((d) => {
      if (name.trim()) d.homesteadName = name.trim();
      if (zipResult) {
        d.homesteadLocation = { lat: zipResult.lat, lon: zipResult.lon, label: zipResult.label };
        // Auto-set hardiness system from the resolved country if user hasn't
        // manually picked one yet. This is the first time most users hit the
        // app, so almost everyone gets a sensibly-matched zone system here.
        if (!d.userZoneSystem && zipResult.countryCode) {
          const detected = autoDetectHardiness(zipResult.countryCode, zipResult.lat, zipResult.lon);
          d.userZoneSystem = detected.system;
          d.userZone = detected.zone;
        }
      }
      // Filter hobbies down to just the ones they wanted. Use the hobbies
      // state object as the source of truth for which types the wizard knows
      // about — that way adding a new hobby checkbox above is the only edit
      // needed; this apply logic stays generic. Any hobby type not present
      // as a key in the wizard's state is left untouched (preserves whatever
      // hidden flag it already had).
      d.hobbies = (d.hobbies || []).map((h) => {
        if (Object.prototype.hasOwnProperty.call(hobbies, h.type)) {
          h.hidden = !hobbies[h.type];
        }
        return h;
      });
      return d;
    });
    onClose();
  };

  // Wizard uses its own modal styling — distinct from regular modals so it
  // feels like a welcome experience, not a settings dialog.
  //
  // data-no-keyboard-shift opts this backdrop out of the global keyboard-open
  // CSS that adds padding-bottom to modal overlays. The wizard's inner card is
  // already overflowY:auto and the useNativeKeyboardInset hook scrolls the
  // focused input into view, so the backdrop-padding shift is redundant AND
  // visibly wrong here — it pushes the wizard halfway off-screen on iOS.
  return (
    <div data-no-keyboard-shift style={{
      position: "fixed", inset: 0, background: "rgba(44,24,16,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200, padding: 16,
    }}>
      <div style={{
        background: palette.bg, borderRadius: 14,
        maxWidth: 460, width: "100%", maxHeight: "92vh",
        border: `2px solid ${palette.ink}`,
        boxShadow: "6px 6px 0 " + palette.line,
        // Use overflow:auto with safe-area-aware bottom padding so iOS
        // rubber-band bounce doesn't snap users back before they can tap
        // the Done button at the bottom of the hobby list.
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
        padding: "28px 28px max(28px, env(safe-area-inset-bottom)) 28px",
      }}>
        {/* Step indicator */}
        <div style={{ display: "flex", gap: 4, marginBottom: 18 }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                flex: 1, height: 4, borderRadius: 2,
                background: i <= step ? palette.ink : palette.line,
              }}
            />
          ))}
        </div>

        {step === 1 && (
          <>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 30, margin: "0 0 8px", color: palette.ink, lineHeight: 1.1 }}>
              Welcome to Henalytics 🌱
            </h2>
            <p style={{ fontSize: 14, color: palette.inkSoft, lineHeight: 1.6, marginTop: 0, marginBottom: 18 }}>
              A free homestead tracker for gardens, egg layers, and meat birds. Just me running it, no ads, no fees.
              Let's get you set up — should take about 30 seconds.
            </p>
            <Field label="What's your homestead called? (optional)">
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Slow Build Acres"
                autoFocus
              />
            </Field>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <Btn variant="primary" onClick={() => setStep(2)}>Next</Btn>
              <Btn variant="ghost" onClick={() => setStep(2)}>Skip</Btn>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, margin: "0 0 8px", color: palette.ink, lineHeight: 1.2 }}>
              Where's your homestead? 📍
            </h2>
            <p style={{ fontSize: 13, color: palette.inkSoft, lineHeight: 1.6, marginTop: 0, marginBottom: 18 }}>
              We use this to auto-attach weather to entries and suggest planting dates for your local hardiness zone. Zip code is enough.
            </p>
            <Field label="Country">
              <select
                style={inputStyle}
                value={country}
                onChange={(e) => { setCountry(e.target.value); setZipResult(null); setZipLookupStatus("idle"); }}
              >
                <option value="us">United States</option>
                <option value="ca">Canada</option>
                <option value="gb">United Kingdom</option>
                <option value="ie">Ireland</option>
                <option value="au">Australia</option>
                <option value="nz">New Zealand</option>
                <option value="de">Germany</option>
                <option value="fr">France</option>
                <option value="nl">Netherlands</option>
                <option value="be">Belgium</option>
                <option value="es">Spain</option>
                <option value="it">Italy</option>
                <option value="pt">Portugal</option>
                <option value="se">Sweden</option>
                <option value="no">Norway</option>
                <option value="dk">Denmark</option>
                <option value="fi">Finland</option>
                <option value="ch">Switzerland</option>
                <option value="at">Austria</option>
                <option value="pl">Poland</option>
                <option value="mx">Mexico</option>
              </select>
            </Field>
            <Field label="Zip / postal code">
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={zip}
                  onChange={(e) => { setZip(e.target.value); setZipResult(null); setZipLookupStatus("idle"); }}
                  placeholder="e.g. 66002"
                  inputMode="text"
                  autoComplete="postal-code"
                />
                <Btn variant="primary" onClick={lookupZip} small>
                  {zipLookupStatus === "loading" ? "..." : "Look up"}
                </Btn>
              </div>
            </Field>
            {zipResult && (
              <div style={{
                padding: 10, marginTop: -4, marginBottom: 14, borderRadius: 8,
                background: palette.leafSoft, border: `1.5px solid ${palette.line}`, fontSize: 13, color: palette.ink,
              }}>
                ✓ Found: <strong>{zipResult.label}</strong>
              </div>
            )}
            {zipError && (
              <div style={{
                padding: 10, marginTop: -4, marginBottom: 14, borderRadius: 8,
                background: palette.card, border: `1.5px solid ${palette.accent}`, fontSize: 12, color: palette.accent,
              }}>
                {zipError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <Btn variant="primary" onClick={() => setStep(3)}>Next</Btn>
              <Btn variant="ghost" onClick={() => { setStep(3); }}>Skip</Btn>
            </div>
            <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 10, fontStyle: "italic" }}>
              You can change or remove this anytime in Barn → Location.
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, margin: "0 0 8px", color: palette.ink, lineHeight: 1.2 }}>
              What does your homestead include? 🐔
            </h2>
            <p style={{ fontSize: 13, color: palette.inkSoft, lineHeight: 1.6, marginTop: 0, marginBottom: 18 }}>
              Pick whichever apply. You can always change this later.
            </p>

            <HobbyCheckbox
              checked={hobbies.garden}
              onToggle={() => setHobbies((h) => ({ ...h, garden: !h.garden }))}
              icon="🌱"
              label="Garden"
              sub="Plantings, harvests, watering"
            />
            <HobbyCheckbox
              checked={hobbies.egg_layers}
              onToggle={() => setHobbies((h) => ({ ...h, egg_layers: !h.egg_layers }))}
              icon="🥚"
              label="Egg layers"
              sub="Daily egg counts, feed, costs"
            />
            <HobbyCheckbox
              checked={hobbies.meat_chickens}
              onToggle={() => setHobbies((h) => ({ ...h, meat_chickens: !h.meat_chickens }))}
              icon="🍗"
              label="Meat birds"
              sub="Per-batch tracking, butcher day"
            />
            <HobbyCheckbox
              checked={hobbies.rabbits}
              onToggle={() => setHobbies((h) => ({ ...h, rabbits: !h.rabbits }))}
              icon="🐇"
              label="Rabbits"
              sub="Per-rabbit tracking, pedigree, breeding reminders"
            />
            <HobbyCheckbox
              checked={hobbies.bees}
              onToggle={() => setHobbies((h) => ({ ...h, bees: !h.bees }))}
              icon="🐝"
              label="Beekeeping (Beta)"
            />
            <HobbyCheckbox
              checked={hobbies.incubator || false}
              onToggle={() => setHobbies((h) => ({ ...h, incubator: !h.incubator }))}
              icon="🥚"
              label="Incubator (Beta)"
              sub="Track hatching runs and hatch rates"
            />
            <HobbyCheckbox
              checked={hobbies.goats || false}
              onToggle={() => setHobbies((h) => ({ ...h, goats: !h.goats }))}
              icon="🐐"
              label="Goats"
              sub="Dairy or meat goats, milk tracking, kids"
            />
            <HobbyCheckbox
              checked={hobbies.cows || false}
              onToggle={() => setHobbies((h) => ({ ...h, cows: !h.cows }))}
              icon="🐄"
              label="Cows"
              sub="Dairy or beef cattle, milk production"
            />
            <HobbyCheckbox
              checked={hobbies.pigs || false}
              onToggle={() => setHobbies((h) => ({ ...h, pigs: !h.pigs }))}
              icon="🐷"
              label="Pigs"
              sub="Growth tracking, FCR, litters, butcher"
            />
            <HobbyCheckbox
              checked={hobbies.sheep || false}
              onToggle={() => setHobbies((h) => ({ ...h, sheep: !h.sheep }))}
              icon="🐑"
              label="Sheep"
              sub="Dairy, meat, wool, lambing schedules"
            />
            <HobbyCheckbox
              checked={hobbies.horses || false}
              onToggle={() => setHobbies((h) => ({ ...h, horses: !h.horses }))}
              icon="🐴"
              label="Horses"
              sub="Per-horse rides, farrier, vet, deworming, breeding"
            />
            <HobbyCheckbox
              checked={hobbies.sourdough || false}
              onToggle={() => setHobbies((h) => ({ ...h, sourdough: !h.sourdough }))}
              icon="🍞"
              label="Sourdough"
              sub="Starter feeds, bake log, recipes, profit per loaf"
            />
            <HobbyCheckbox
              checked={hobbies.farmstand || false}
              onToggle={() => setHobbies((h) => ({ ...h, farmstand: !h.farmstand }))}
              icon="🧾"
              label="Farmstand"
              sub="Saved items with cost & price for one-tap sales"
            />
            <HobbyCheckbox
              checked={hobbies.baking || false}
              onToggle={() => setHobbies((h) => ({ ...h, baking: !h.baking }))}
              icon="🥧"
              label="Baking"
              sub="Recipes (with links), bake log, sales"
            />

            {/* Preserving sub-types group — visually grouped under one heading,
                but each is its own hobby under the hood (they share a unified
                Preserving page with tabs once enabled). */}
            <div style={{
              marginTop: 14, marginBottom: 6, fontSize: 11, color: palette.inkSoft,
              textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600,
              paddingLeft: 4,
            }}>
              🥫 Preserving
            </div>
            <HobbyCheckbox
              checked={hobbies.canning || false}
              onToggle={() => setHobbies((h) => ({ ...h, canning: !h.canning }))}
              icon="🫙"
              label="Canning"
              sub="Pantry inventory, eat-by dates, batch tracking"
            />
            <HobbyCheckbox
              checked={hobbies.freeze_drying || false}
              onToggle={() => setHobbies((h) => ({ ...h, freeze_drying: !h.freeze_drying }))}
              icon="❄️"
              label="Freeze drying"
              sub="Batch runs, trays, output weight, storage"
            />
            <HobbyCheckbox
              checked={hobbies.dehydrating || false}
              onToggle={() => setHobbies((h) => ({ ...h, dehydrating: !h.dehydrating }))}
              icon="🌬️"
              label="Dehydrating"
              sub="Batches, dryer hours, temperatures"
            />
            <HobbyCheckbox
              checked={hobbies.fermentation || false}
              onToggle={() => setHobbies((h) => ({ ...h, fermentation: !h.fermentation }))}
              icon="🫧"
              label="Fermentation"
              sub="Day-by-day logs, recipes, reflection notes"
            />

            <HobbyCheckbox
              checked={hobbies.dogs || false}
              onToggle={() => setHobbies((h) => ({ ...h, dogs: !h.dogs }))}
              icon="🐕"
              label="Dogs"
              sub="Breeding, litters, vet/meds, livestock guardian tracking"
            />

            <HobbyCheckbox
              checked={hobbies.cats || false}
              onToggle={() => setHobbies((h) => ({ ...h, cats: !h.cats }))}
              icon="🐈"
              label="Cats"
              sub="Breeding, litters, vet/meds, barn-cat kill log"
            />

            <HobbyCheckbox
              checked={hobbies.maple_syrup || false}
              onToggle={() => setHobbies((h) => ({ ...h, maple_syrup: !h.maple_syrup }))}
              icon="🍁"
              label="Maple Syrup"
              sub="Taps, sap, syrup yield, season-by-season"
            />

            <div style={{
              marginTop: 12, padding: "10px 12px",
              background: palette.bgAlt, borderRadius: 8,
              fontSize: 12, color: palette.inkSoft, lineHeight: 1.5,
            }}>
              💡 Don't see your hobby? You can submit it through Settings → "How can I improve?" — if there's enough push from users, I'll work on adding it!
            </div>

            <div style={{
              position: "sticky",
              bottom: 0,
              marginTop: 14,
              marginLeft: -28,
              marginRight: -28,
              marginBottom: -28,
              padding: "14px 28px max(14px, env(safe-area-inset-bottom)) 28px",
              background: palette.bg,
              borderTop: `1.5px solid ${palette.line}`,
              display: "flex",
              gap: 8,
            }}>
              <Btn variant="primary" onClick={() => setStep(4)} style={{ width: "100%" }}>Next</Btn>
            </div>
          </>
        )}

        {step === 4 && (
          // Internal flex layout so on small screens the content scrolls but
          // the "Got it" button stays visible at the bottom. Mirrors the
          // What's New modal pattern: outer flex column, scrollable middle,
          // flexShrink:0 footer. The negative margins pull this block out
          // to the edges of the wizard's 28px padding.
          <div style={{
            display: "flex",
            flexDirection: "column",
            maxHeight: "calc(92vh - 80px)", // wizard maxHeight minus step indicator + padding
            marginLeft: -28,
            marginRight: -28,
            marginTop: -8,
            marginBottom: -28,
          }}>
            <div style={{
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              padding: "0 28px 16px",
              flex: 1,
              minHeight: 0,
            }}>
              <div style={{ fontSize: 36, marginBottom: 8, textAlign: "center" }}>🌾</div>
              <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, margin: "0 0 8px", color: palette.ink, lineHeight: 1.2, textAlign: "center" }}>
                One last thing
              </h2>
              <p style={{ fontSize: 14, color: palette.ink, lineHeight: 1.65, marginTop: 0, marginBottom: 14 }}>
                Henalytics is and will stay <strong>free for every homestead</strong> — no ads, no paywalls, no upsells. My goal is for as many homesteaders as possible to benefit from it.
              </p>

              <div style={{
                padding: "12px 14px", background: palette.bgAlt, borderRadius: 10,
                marginBottom: 14, fontSize: 13, color: palette.ink, lineHeight: 1.6,
              }}>
                <strong>Real costs, transparently:</strong> between App Store fees and upgrading the tools and services that run the app for a growing community, it costs about $500/year, plus my time. Not terrible — any community contribution is sincerely appreciated. Anything beyond minimum maintenance fees goes back into improving the app. Anything beyond that, will get used to feed my chickens.
              </div>

              <p style={{ fontSize: 14, color: palette.ink, lineHeight: 1.65, marginBottom: 14 }}>
                If down the line you find Henalytics useful and want to chip in a few bucks to help keep it running, that genuinely makes a difference. Totally optional — but it's how I keep the lights on and keep building.
              </p>

              <p style={{ fontSize: 13, color: palette.inkSoft, fontStyle: "italic", marginBottom: 16, lineHeight: 1.5 }}>
                You'll find a ❤️ heart icon at the top of the screen anytime — tap it to support the app. No pressure, no popups bugging you about it.
              </p>

              <div style={{
                padding: "10px 12px", background: palette.card, borderRadius: 8,
                border: `1.5px solid ${palette.line}`, fontSize: 12, color: palette.inkSoft,
                marginBottom: 16, lineHeight: 1.5,
              }}>
                <strong style={{ color: palette.ink }}>How it works:</strong> tips go through Stripe (the same secure checkout used by major retailers). Apple Pay & Google Pay supported. Stripe sends you an email receipt. If you ever want a refund, email me and I'll take care of it.
              </div>

              <p style={{ fontSize: 13, color: palette.ink, marginBottom: 8, fontStyle: "italic" }}>
                — Riley, the Henalytics maker 🌾
              </p>
            </div>

            {/* Fixed footer with action button */}
            <div style={{
              padding: "14px 28px max(14px, env(safe-area-inset-bottom)) 28px",
              background: palette.bg,
              borderTop: `1.5px solid ${palette.line}`,
              flexShrink: 0,
            }}>
              <Btn variant="primary" onClick={finish} style={{ width: "100%" }}>Got it — let's go!</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HobbyCheckbox({ checked, onToggle, icon, label, sub }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: "100%", padding: "12px 14px", marginBottom: 8,
        background: checked ? palette.yolkSoft : palette.card,
        border: `1.5px solid ${checked ? palette.yolk : palette.line}`,
        borderRadius: 10, cursor: "pointer", textAlign: "left",
        display: "flex", alignItems: "center", gap: 12,
        fontFamily: FONT_BODY,
      }}
    >
      <div style={{ fontSize: 26, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: palette.ink }}>{label}</div>
        <div style={{ fontSize: 12, color: palette.inkSoft }}>{sub}</div>
      </div>
      <div style={{
        width: 22, height: 22, borderRadius: 4,
        border: `2px solid ${checked ? palette.ink : palette.line}`,
        background: checked ? palette.ink : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {checked && <span style={{ color: palette.bg, fontSize: 14, lineHeight: 1, fontWeight: 700 }}>✓</span>}
      </div>
    </button>
  );
}

// ============================================================================
// WELCOME CARD
// ----------------------------------------------------------------------------
// Shown on the home page after onboarding completes, until the user logs their
// first entry or dismisses the card. Suggests the first thing to try.
// ============================================================================
function WelcomeCard({ data, update, setModal }) {
  const [showAddToHome, setShowAddToHome] = useState(false);

  const dismiss = () => {
    update((d) => { d.welcomeCardDismissed = true; return d; });
  };

  return (
    <>
      <div style={{
        background: palette.yolkSoft,
        border: `1.5px solid ${palette.line}`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
        position: "relative",
      }}>
        <button
          onClick={dismiss}
          style={{
            position: "absolute", top: 8, right: 8,
            background: "none", border: "none", cursor: "pointer",
            color: palette.inkSoft, padding: 4,
          }}
          title="Dismiss"
          aria-label="Dismiss welcome card"
        >
          <X size={16} />
        </button>
        <div style={{
          fontFamily: FONT_DISPLAY, fontSize: 22, color: palette.ink,
          marginBottom: 8, lineHeight: 1.2,
        }}>
          👋 Try this first
        </div>
        <p style={{ fontSize: 13, color: palette.ink, lineHeight: 1.6, margin: "0 0 12px" }}>
          Tap one of the quick-action tiles below to log your first entry. Everything you log builds your year-in-review and shows up in stats.
        </p>
        <p style={{ fontSize: 12, color: palette.inkSoft, lineHeight: 1.6, margin: 0 }}>
          💡 Want Henalytics on your home screen like an app?{" "}
          <button
            onClick={() => setShowAddToHome(true)}
            style={{
              background: "none", border: "none", padding: 0,
              color: palette.accent, cursor: "pointer", textDecoration: "underline",
              fontFamily: FONT_BODY, fontSize: 12,
            }}
          >
            See how
          </button>
        </p>
      </div>
      {showAddToHome && <AddToHomeScreenModal onClose={() => setShowAddToHome(false)} />}
    </>
  );
}

// ============================================================================
// ADD TO HOME SCREEN MODAL
// ----------------------------------------------------------------------------
// Tabbed iOS / Android instructions for installing the PWA to home screen.
// ============================================================================
function AddToHomeScreenModal({ onClose }) {
  const [tab, setTab] = useState("ios");

  return (
    <Modal open onClose={onClose} title="Add to home screen">
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <button
          onClick={() => setTab("ios")}
          style={{
            flex: 1, padding: "8px 12px", borderRadius: 8,
            background: tab === "ios" ? palette.ink : palette.card,
            color: tab === "ios" ? palette.bg : palette.ink,
            border: `1.5px solid ${palette.line}`,
            cursor: "pointer", fontWeight: 600, fontSize: 13,
            fontFamily: FONT_BODY,
          }}
        >
          iPhone / iPad
        </button>
        <button
          onClick={() => setTab("android")}
          style={{
            flex: 1, padding: "8px 12px", borderRadius: 8,
            background: tab === "android" ? palette.ink : palette.card,
            color: tab === "android" ? palette.bg : palette.ink,
            border: `1.5px solid ${palette.line}`,
            cursor: "pointer", fontWeight: 600, fontSize: 13,
            fontFamily: FONT_BODY,
          }}
        >
          Android
        </button>
      </div>

      {tab === "ios" && (
        <ol style={{ paddingLeft: 20, fontSize: 14, color: palette.ink, lineHeight: 1.7, margin: 0 }}>
          <li>Open <strong>henalytics.com</strong> in <strong>Safari</strong> (must be Safari, not Chrome).</li>
          <li>Tap the <strong>three-dot menu</strong> (•••) in the bottom-right corner of Safari.</li>
          <li>Tap <strong>Share</strong>.</li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
          <li>Tap <strong>Add</strong> in the top right.</li>
        </ol>
      )}

      {tab === "android" && (
        <ol style={{ paddingLeft: 20, fontSize: 14, color: palette.ink, lineHeight: 1.7, margin: 0 }}>
          <li>Open <strong>henalytics.com</strong> in <strong>Chrome</strong>.</li>
          <li>Tap the <strong>three-dot menu</strong> (top right corner).</li>
          <li>Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>.</li>
          <li>Tap <strong>Install</strong> to confirm.</li>
        </ol>
      )}

      <div style={{
        marginTop: 16, padding: 12, background: palette.bgAlt, borderRadius: 8,
        fontSize: 12, color: palette.inkSoft, lineHeight: 1.5,
      }}>
        Once installed, Henalytics opens like a regular app. No app store needed — it just lives on your home screen.
      </div>
    </Modal>
  );
}



// ============================================================================
// ANALYTICS SHARE WRAPPER — adds a "Share stats" button above any analytics
// component. Used for hobbies whose analytics live in separate files
// (Rabbits, Bees, Incubator, Goats, Cows, Pigs, Farmstand, etc).
//
// Also hosts the date-range filter (All time / 7d / 30d / 60d / 90d / Custom).
// The default is "All time" so a hobby's stats look identical on first view —
// the filter only takes effect when the user actively picks a range. Filtered
// entries are passed to the child component via React.cloneElement so each
// individual analytics file (which we can't always edit from here) gets the
// reduced dataset without any signature change.
//
// Sales-based stats (Horses, Sourdough, Farmstand) aren't filtered yet —
// sales live on data.sales rather than data.entries[hobbyId]. Adding that
// filter is a future enhancement; for now the date filter affects entry-based
// numbers in those hobbies and leaves sales totals as-is.
// ============================================================================
function AnalyticsShareWrapper({ hobby, entries, data, children }) {
  const [showShare, setShowShare] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  if (!hobby) return children; // safety: don't render the controls if hobby missing

  const range = resolveDateRange(dateFilter, customStart, customEnd);
  const filteredEntries = filterByDateRange(entries || [], range, (e) => e.date);

  // Pass the filtered entries down. If the child component uses `entries` as
  // a prop (all 12 do today), this transparently replaces the all-entries
  // array with the filtered one. Components that ignore `entries` (e.g. ones
  // that read from data.sales only) are unaffected.
  const childWithFiltered = React.isValidElement(children)
    ? React.cloneElement(children, { entries: filteredEntries })
    : children;

  return (
    <>
      {showShare && (
        <ShareStatsModal
          hobby={hobby}
          allEntries={entries || []}
          data={data}
          onClose={() => setShowShare(false)}
        />
      )}
      {/* Filter + Share row */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6 }}>
          <div style={{ fontSize: 10, letterSpacing: 1, color: palette.inkSoft, textTransform: "uppercase", fontWeight: 600 }}>
            View
          </div>
          <button
            onClick={() => setShowShare(true)}
            style={{
              display:"flex",alignItems:"center",gap:6,
              padding:"6px 12px",borderRadius:8,
              border:`1.5px solid ${palette.line}`,background:palette.card,
              fontFamily:FONT_BODY,fontWeight:600,fontSize:12,
              color:palette.ink,cursor:"pointer",
            }}
          >
            <Share2 size={13} /> Share stats
          </button>
        </div>
        <DateRangeFilter
          value={dateFilter}
          onChange={setDateFilter}
          customStart={customStart}
          setCustomStart={setCustomStart}
          customEnd={customEnd}
          setCustomEnd={setCustomEnd}
        />
      </div>
      {childWithFiltered}
    </>
  );
}

// ============================================================================
// SHARE STATS MODAL — generates a shareable image card for a hobby's stats
// ============================================================================
function ShareStatsModal({ hobby, allEntries, data, onClose }) {
  const [filter, setFilter] = useState("week");
  const [rendering, setRendering] = useState(false);
  const [shareStatus, setShareStatus] = useState(""); // "", "sharing", "saving", "done", "error"
  const cardRef = React.useRef(null);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const oneWeekAgo = new Date(now - 7*24*60*60*1000);
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  const FILTERS = [
    { id: "today", label: "Today" },
    { id: "week",  label: "This week" },
    { id: "year",  label: "This year" },
    { id: "all",   label: "All-time" },
  ];

  const filterLabel = FILTERS.find(f => f.id === filter)?.label || "All-time";

  // Filter entries by the chosen period
  const filteredEntries = allEntries.filter(e => {
    if (!e.date) return filter === "all";
    if (filter === "all") return true;
    const d = new Date(e.date + "T12:00");
    if (filter === "today") return e.date === todayStr;
    if (filter === "week")  return d >= oneWeekAgo;
    if (filter === "year")  return d >= oneYearAgo;
    return true;
  });

  // Build stats for the filtered period
  const buildStats = (entries) => {
    if (hobby.type === "egg_layers") {
      const eggs = entries.filter(e => e.action === "eggs" || e.action === "eggs_laid");
      const totalEggs = eggs.reduce((s, e) => s + (Number(e.count)||0), 0);
      const feeds = entries.filter(e => e.action === "fed");
      const totalCost = feeds.reduce((s, e) => s + (Number(e.cost)||0), 0);
      const costPerDozen = totalEggs > 0 ? (totalCost / totalEggs * 12) : 0;
      const flocks = hobby.flocks || [];
      const totalBirds = flocks.reduce((s, f) => s + (f.birdCount||0), 0);
      // Tractor distance — sum of per-entry distanceFeet (preserves history
      // if the user later changes the default). Only added to the share card
      // when there's at least one logged move, so newcomers aren't confused.
      const tractorMoves = entries.filter(e => e.action === "move_tractor");
      const tractorFeet = tractorMoves.reduce((s, e) => s + (Number(e.distanceFeet)||0), 0);
      const stats = [
        { label: "Eggs collected", value: totalEggs.toLocaleString() },
        { label: "Birds in flock", value: totalBirds },
        { label: "Cost / dozen", value: costPerDozen > 0 ? fmtMoney(costPerDozen) : "—" },
        { label: "Feed cost", value: totalCost > 0 ? fmtMoney(totalCost) : "—" },
      ];
      if (tractorFeet > 0) stats.push({ label: "Tractor moved", value: fmtTractorDistance(tractorFeet) });
      return { emoji: "🥚", label: "Egg Layers", stats };
    }
    if (hobby.type === "meat_chickens") {
      const archived = hobby.archivedBatches || [];
      // Push 4b — currentBatches is an array. Combine all active batches with
      // archived for the lifetime totals shown on the share card.
      const current = Array.isArray(hobby.currentBatches) ? hobby.currentBatches : [];
      const allBatches = [...archived, ...current];
      const totalBirds = allBatches.reduce((s, b) => s + (b.startCount||0), 0);
      const totalButchered = allBatches.reduce((s, b) => s + (b.butchered||[]).reduce((ss, bu) => ss + (bu.count||0), 0), 0);
      const totalWeight = allBatches.reduce((s, b) => s + (b.butchered||[]).reduce((ss, bu) => ss + (bu.count||0)*(bu.avgWeight||0), 0), 0);
      const avgWeight = totalButchered > 0 ? (totalWeight/totalButchered).toFixed(1) : "—";
      const deaths = entries.filter(e => e.action === "death").reduce((s,e)=>s+(Number(e.count)||1),0);
      const tractorMoves = entries.filter(e => e.action === "move_tractor");
      const tractorFeet = tractorMoves.reduce((s, e) => s + (Number(e.distanceFeet)||0), 0);
      const stats = [
        { label: "Birds raised", value: totalBirds },
        { label: "Butchered", value: totalButchered },
        { label: "Avg weight", value: `${avgWeight} lbs` },
        { label: "Deaths", value: deaths },
      ];
      if (tractorFeet > 0) stats.push({ label: "Tractor moved", value: fmtTractorDistance(tractorFeet) });
      return { emoji: "🍗", label: "Meat Birds", stats };
    }
    if (hobby.type === "garden") {
      const harvests = entries.filter(e => e.action === "harvested");
      const totalHarvest = harvests.reduce((s, e) => s + (Number(e.quantity)||0), 0);
      const plantings = entries.filter(e => e.action === "planted").length;
      const waterings = entries.filter(e => e.action === "watered").length;
      const seasonName = hobby.currentSeason ? hobby.currentSeason.name : "—";
      return {
        emoji: "🌱", label: "Garden",
        stats: [
          { label: "Harvest", value: `${totalHarvest.toFixed(1)} lbs` },
          { label: "Plantings", value: plantings },
          { label: "Waterings", value: waterings },
          { label: "Season", value: seasonName },
        ],
      };
    }
    if (hobby.type === "rabbits") {
      const litters = entries.filter(e => e.action === "litter");
      const totalKits = litters.reduce((s, e) => s + (Number(e.kitsAlive)||0), 0);
      // Butcher: new per-rabbit entries don't have `count` (each entry = 1 rabbit).
      // Legacy aggregate entries have `count`. Support both.
      const butchered = entries.filter(e => e.action === "butcher").reduce((s, e) => s + (e.count != null ? (Number(e.count)||0) : 1), 0);
      const rabbits = (hobby.animals||[]).filter(a => !a.archived).length;
      return {
        emoji: "🐇", label: "Rabbits",
        stats: [
          { label: "Rabbits", value: rabbits },
          { label: "Litters", value: litters.length },
          { label: "Kits born", value: totalKits },
          { label: "Butchered", value: butchered },
        ],
      };
    }
    if (hobby.type === "bees") {
      const harvests = entries.filter(e => e.action === "harvest");
      const totalLbs = harvests.reduce((s, e) => s + (Number(e.lbs)||0), 0);
      const inspections = entries.filter(e => e.action === "inspect").length;
      const hives = (hobby.hives||[]).length;
      return {
        emoji: "🐝", label: "Beekeeping",
        stats: [
          { label: "Honey harvested", value: `${totalLbs.toFixed(1)} lbs` },
          { label: "Hives", value: hives },
          { label: "Inspections", value: inspections },
          { label: "Harvests", value: harvests.length },
        ],
      };
    }
    if (hobby.type === "incubator") {
      // Incubator data lives on hobby.runs[], not entries. We want to include
      // a run if any part of its lifetime overlaps the filter window — not
      // just its start date. A run set 35 days ago but still hatching now
      // is squarely active in "this week", and a run set in December that
      // hatched in January should appear in BOTH year filters.
      //
      // Run lifetime: [dateSet → hatchedDate || today]. We check overlap
      // against the [windowStart, today] window for each filter tier.
      //
      // Field-name note: the run record uses dateSet (not setDate) and
      // eggsHatched (not hatched) — see Incubator.jsx. Earlier versions of
      // this code read the wrong field names, which is why share stats
      // always looked empty.
      const allRuns = hobby.runs || [];
      const runsInRange = allRuns.filter(r => {
        if (!r.dateSet) return filter === "all";
        if (filter === "all") return true;
        const runStart = r.dateSet;
        const runEnd = r.hatchedDate || todayStr; // still incubating → extend to today
        if (filter === "today") {
          // Run was active any time today
          return runStart <= todayStr && runEnd >= todayStr;
        }
        // For week/year, window is [oneWeekAgo/oneYearAgo, today]
        const windowStartIso = (filter === "week" ? oneWeekAgo : oneYearAgo).toISOString().slice(0, 10);
        if (runEnd < windowStartIso) return false; // ended before window
        if (runStart > todayStr) return false;     // started after window (future-dated)
        return true;
      });
      const eggsSet = runsInRange.reduce((s,r) => s + (Number(r.eggsSet)||0), 0);
      const eggsHatched = runsInRange.reduce((s,r) => s + (Number(r.eggsHatched)||0), 0);
      const hatchRate = eggsSet > 0 ? Math.round((eggsHatched/eggsSet)*100) : 0;
      return {
        emoji: "🥚", label: "Incubator",
        stats: [
          { label: "Eggs set", value: eggsSet },
          { label: "Hatched", value: eggsHatched },
          { label: "Hatch rate", value: eggsSet > 0 ? `${hatchRate}%` : "—" },
          { label: "Runs", value: runsInRange.length },
        ],
      };
    }
    if (hobby.type === "goats") {
      const milk = entries.filter(e => e.action === "milk");
      const milkOz = milk.reduce((s,e) => s + (Number(e.oz)||0), 0);
      const milkGal = milkOz / 128;
      const kids = entries.filter(e => e.action === "kid").reduce((s,e) => s + (Number(e.count)||1), 0);
      const goatCount = (hobby.animals||[]).filter(a => !a.archived).length;
      const butchered = entries.filter(e => e.action === "butcher").length;
      return {
        emoji: "🐐", label: "Goats",
        stats: [
          { label: "Milk", value: milkGal > 0 ? `${milkGal.toFixed(1)} gal` : "—" },
          { label: "Goats", value: goatCount },
          { label: "Kids born", value: kids },
          { label: "Butchered", value: butchered },
        ],
      };
    }
    if (hobby.type === "cows") {
      const milk = entries.filter(e => e.action === "milk");
      const milkGal = milk.reduce((s,e) => s + (Number(e.gallons)||Number(e.gal)||0), 0);
      const calves = entries.filter(e => e.action === "calf").reduce((s,e) => s + (Number(e.count)||1), 0);
      const cowCount = (hobby.animals||[]).filter(a => !a.archived).length;
      const butchered = entries.filter(e => e.action === "butcher").length;
      return {
        emoji: "🐄", label: "Cows",
        stats: [
          { label: "Milk", value: milkGal > 0 ? `${milkGal.toFixed(1)} gal` : "—" },
          { label: "Cows", value: cowCount },
          { label: "Calves born", value: calves },
          { label: "Butchered", value: butchered },
        ],
      };
    }
    if (hobby.type === "pigs") {
      const litters = entries.filter(e => e.action === "litter").reduce((s,e) => s + (Number(e.count)||1), 0);
      const butchered = entries.filter(e => e.action === "butcher");
      const meatLbs = butchered.reduce((s,e) => s + (Number(e.weight)||0), 0);
      const pigCount = (hobby.animals||[]).filter(a => !a.archived).length;
      return {
        emoji: "🐷", label: "Pigs",
        stats: [
          { label: "Pigs", value: pigCount },
          { label: "Butchered", value: butchered.length },
          { label: "Meat", value: meatLbs > 0 ? `${Math.round(meatLbs)} lbs` : "—" },
          { label: "Piglets born", value: litters },
        ],
      };
    }
    if (hobby.type === "sheep") {
      const milk = entries.filter(e => e.action === "milk");
      const milkOz = milk.reduce((s,e) => s + (Number(e.oz)||0), 0);
      const milkGal = milkOz / 128;
      const butchered = entries.filter(e => e.action === "butcher");
      const meatLbs = butchered.reduce((s,e) => s + (Number(e.weight)||0), 0);
      const liveCount = (hobby.animals || []).filter(a => !a.archived).length;
      const breedings = hobby.breedings || [];
      const completedLambings = breedings.filter(b => b.lambedDate);
      const lambsBorn = completedLambings.reduce((s,b) => s + (Number(b.lambsBorn)||0), 0);
      const woolLbs = (hobby.shearings || []).reduce((s,sh) => s + (Number(sh.woolLbs)||0), 0);
      return {
        emoji: "🐑", label: "Sheep",
        stats: [
          { label: "Sheep", value: liveCount },
          { label: "Lambs born", value: lambsBorn },
          { label: "Milk", value: milkGal > 0 ? `${milkGal.toFixed(1)} gal` : "—" },
          { label: "Wool", value: woolLbs > 0 ? `${woolLbs.toFixed(1)} lbs` : (meatLbs > 0 ? `${Math.round(meatLbs)} lbs meat` : "—") },
        ],
      };
    }
    if (hobby.type === "horses") {
      const rides = hobby.rides || [];
      const ridesInRange = rides.filter(r => {
        if (!r.date) return filter === "all";
        if (filter === "all") return true;
        const d = new Date(r.date + "T12:00");
        if (filter === "today") return r.date === todayStr;
        if (filter === "week")  return d >= oneWeekAgo;
        if (filter === "year")  return d >= oneYearAgo;
        return true;
      });
      const totalMinutes = ridesInRange.reduce((s,r) => s + (Number(r.durationMinutes)||0), 0);
      const liveCount = (hobby.animals || []).filter(h => !h.archived).length;
      const breedings = hobby.breedings || [];
      const completedFoalings = breedings.filter(b => b.foaledDate);
      const foalsBorn = completedFoalings.reduce((s,b) => s + (Number(b.foalsBorn)||0), 0);
      return {
        emoji: "🐴", label: "Horses",
        stats: [
          { label: "Horses", value: liveCount },
          { label: "Rides", value: ridesInRange.length },
          { label: "Time", value: totalMinutes > 0 ? `${(totalMinutes/60).toFixed(1)} hrs` : "—" },
          { label: "Foals born", value: foalsBorn || "—" },
        ],
      };
    }
    if (hobby.type === "sourdough") {
      const allBakes = hobby.bakes || [];
      const bakesInRange = allBakes.filter(b => {
        if (!b.date) return filter === "all";
        if (filter === "all") return true;
        const d = new Date(b.date + "T12:00");
        if (filter === "today") return b.date === todayStr;
        if (filter === "week")  return d >= oneWeekAgo;
        if (filter === "year")  return d >= oneYearAgo;
        return true;
      });
      const totalLoaves = bakesInRange.reduce((s,b) => s + (Number(b.loafCount)||0), 0);
      const recipeCount = {};
      bakesInRange.forEach(b => {
        const r = b.recipe || "Other";
        recipeCount[r] = (recipeCount[r]||0) + (Number(b.loafCount)||0);
      });
      const top = Object.entries(recipeCount).sort((a,b)=>b[1]-a[1])[0];
      const allSales = (data.sales || []).filter(s => s.hobbyType === "sourdough");
      const salesInRange = allSales.filter(s => {
        if (!s.date) return filter === "all";
        if (filter === "all") return true;
        const d = new Date(s.date + "T12:00");
        if (filter === "today") return s.date === todayStr;
        if (filter === "week")  return d >= oneWeekAgo;
        if (filter === "year")  return d >= oneYearAgo;
        return true;
      });
      const revenue = salesInRange.reduce((s,x) => s + (Number(x.totalRevenue)||0), 0);
      return {
        emoji: "🍞", label: "Sourdough",
        stats: [
          { label: "Bakes", value: bakesInRange.length },
          { label: "Loaves", value: totalLoaves },
          { label: "Top recipe", value: top ? top[0] : "—" },
          { label: "Sales revenue", value: revenue > 0 ? fmtMoney(revenue) : "—" },
        ],
      };
    }
    if (hobby.type === "farmstand") {
      // Farmstand data lives in data.sales[] tagged hobbyType === "farmstand",
      // not in entries. Filter sales by date instead.
      const allSales = (data.sales || []).filter(s => s.hobbyType === "farmstand");
      const salesInRange = allSales.filter(s => {
        if (!s.date) return filter === "all";
        if (filter === "all") return true;
        const d = new Date(s.date + "T12:00");
        if (filter === "today") return s.date === todayStr;
        if (filter === "week")  return d >= oneWeekAgo;
        if (filter === "year")  return d >= oneYearAgo;
        return true;
      });
      const revenue = salesInRange.reduce((s,x) => s + (Number(x.totalRevenue)||0), 0);
      const cost = salesInRange.reduce((s,x) => s + (Number(x.totalCost)||0), 0);
      const profit = revenue - cost;
      // Top item
      const byItem = {};
      salesInRange.forEach(s => {
        const n = s.crop || "Other";
        byItem[n] = (byItem[n]||0) + (Number(s.totalRevenue)||0);
      });
      const top = Object.entries(byItem).sort((a,b) => b[1]-a[1])[0];
      return {
        emoji: "🧾", label: "Farmstand",
        stats: [
          { label: "Revenue", value: fmtMoney(revenue) },
          { label: "Profit", value: fmtMoney(profit) },
          { label: "Sales", value: salesInRange.length },
          { label: "Top seller", value: top ? top[0] : "—" },
        ],
      };
    }
    if (hobby.type === "baking") {
      const allBakes = data.entries?.["baking"] || [];
      const bakesInRange = allBakes.filter(b => {
        if (!b.date) return filter === "all";
        if (filter === "all") return true;
        const d = new Date(b.date + "T12:00");
        if (filter === "today") return b.date === todayStr;
        if (filter === "week")  return d >= oneWeekAgo;
        if (filter === "year")  return d >= oneYearAgo;
        return true;
      });
      const totalItems = bakesInRange.reduce((s,b) => s + (Number(b.qty)||0), 0);
      const recipeCount = {};
      bakesInRange.forEach(b => {
        const r = b.recipeName || "Other";
        recipeCount[r] = (recipeCount[r]||0) + (Number(b.qty)||0);
      });
      const top = Object.entries(recipeCount).sort((a,b)=>b[1]-a[1])[0];
      const bakingSalesAll = (data.sales || []).filter(s => s.hobbyType === "baking");
      const bakingSalesInRange = bakingSalesAll.filter(s => {
        if (!s.date) return filter === "all";
        if (filter === "all") return true;
        const d = new Date(s.date + "T12:00");
        if (filter === "today") return s.date === todayStr;
        if (filter === "week")  return d >= oneWeekAgo;
        if (filter === "year")  return d >= oneYearAgo;
        return true;
      });
      const revenue = bakingSalesInRange.reduce((s,x) => s + (Number(x.totalRevenue)||0), 0);
      return {
        emoji: "🥧", label: "Baking",
        stats: [
          { label: "Bakes", value: bakesInRange.length },
          { label: "Items made", value: totalItems },
          { label: "Top recipe", value: top ? top[0] : "—" },
          { label: "Sales revenue", value: revenue > 0 ? fmtMoney(revenue) : "—" },
        ],
      };
    }
    if (hobby.type === "canning") {
      const batches = Array.isArray(hobby.batches) ? hobby.batches : [];
      const batchesInRange = batches.filter(b => {
        if (!b.date) return filter === "all";
        if (filter === "all") return true;
        const d = new Date(b.date + "T12:00");
        if (filter === "today") return b.date === todayStr;
        if (filter === "week")  return d >= oneWeekAgo;
        if (filter === "year")  return d >= oneYearAgo;
        return true;
      });
      const jarsMadeInRange = batchesInRange.reduce((s,b) => s + (Number(b.jarsMade)||0), 0);
      const activeBatches = batches.filter(b => !b.archived);
      const jarsInPantry = activeBatches.reduce((s,b) => s + (Number(b.jarsRemaining)||0), 0);
      const canningSalesAll = (data.sales || []).filter(s => s.hobbyType === "canning");
      const canningSalesInRange = canningSalesAll.filter(s => {
        if (!s.date) return filter === "all";
        if (filter === "all") return true;
        const d = new Date(s.date + "T12:00");
        if (filter === "today") return s.date === todayStr;
        if (filter === "week")  return d >= oneWeekAgo;
        if (filter === "year")  return d >= oneYearAgo;
        return true;
      });
      const revenue = canningSalesInRange.reduce((s,x) => s + (Number(x.totalRevenue)||0), 0);
      return {
        emoji: "🫙", label: "Canning",
        stats: [
          { label: "Batches", value: batchesInRange.length },
          { label: "Jars made", value: jarsMadeInRange },
          { label: "In pantry", value: jarsInPantry },
          { label: "Sales revenue", value: revenue > 0 ? fmtMoney(revenue) : "—" },
        ],
      };
    }
    // Helper for hobbies whose primary records live on the hobby object
    // (not in data.entries) and have their own date field. Mirrors the
    // canning/incubator filter pattern.
    const inRange = (dateStr) => {
      if (!dateStr) return filter === "all";
      if (filter === "all") return true;
      const d = new Date(dateStr + "T12:00");
      if (filter === "today") return dateStr === todayStr;
      if (filter === "week")  return d >= oneWeekAgo;
      if (filter === "year")  return d >= oneYearAgo;
      return true;
    };
    if (hobby.type === "dogs") {
      const dogs = (hobby.animals || []).filter(a => !a.archived);
      const lgds = dogs.filter(a => a.isLGD);
      const litters = (hobby.litters || []).filter(l => inRange(l.whelpDate));
      const pupsBorn = litters.reduce((s, l) => s + (Number(l.totalBorn) || (l.puppies?.length || 0)), 0);
      const attacks = (hobby.attacks || []).filter(a => inRange(a.date));
      const revenue = litters.reduce((s, l) =>
        s + (l.puppies || []).reduce((ps, p) =>
          ps + (p.status === "sold" && inRange(p.placeDate || l.whelpDate) ? (Number(p.placePrice) || 0) : 0), 0)
      , 0);
      const stats = [
        { label: "Dogs", value: dogs.length },
        { label: "Pups born", value: pupsBorn },
      ];
      if (lgds.length > 0) stats.push({ label: "Attacks deterred", value: attacks.length });
      else stats.push({ label: "Litters", value: litters.length });
      stats.push({ label: "Pup revenue", value: revenue > 0 ? fmtMoney(revenue) : "—" });
      return { emoji: "🐕", label: "Dogs", stats };
    }
    if (hobby.type === "cats") {
      const cats = (hobby.animals || []).filter(a => !a.archived);
      const barnCats = cats.filter(a => a.isBarnCat);
      const litters = (hobby.litters || []).filter(l => inRange(l.birthDate));
      const kittensBorn = litters.reduce((s, l) => s + (Number(l.totalBorn) || (l.kittens?.length || 0)), 0);
      const attacks = (hobby.attacks || []).filter(a => inRange(a.date));
      const predatorsKilled = attacks.reduce((s, a) => s + (Number(a.predatorsKilled) || 0), 0);
      const revenue = litters.reduce((s, l) =>
        s + (l.kittens || []).reduce((ps, p) =>
          ps + (p.status === "sold" && inRange(p.placeDate || l.birthDate) ? (Number(p.placePrice) || 0) : 0), 0)
      , 0);
      const stats = [
        { label: "Cats", value: cats.length },
        { label: "Kittens born", value: kittensBorn },
      ];
      if (barnCats.length > 0) {
        stats.push({ label: "Kills logged", value: attacks.length });
        if (predatorsKilled > 0 && attacks.length !== predatorsKilled) {
          // Multi-kill attacks: show total predators caught instead of revenue
          stats.push({ label: "Pests caught", value: predatorsKilled });
        } else {
          stats.push({ label: "Kitten revenue", value: revenue > 0 ? fmtMoney(revenue) : "—" });
        }
      } else {
        stats.push({ label: "Litters", value: litters.length });
        stats.push({ label: "Kitten revenue", value: revenue > 0 ? fmtMoney(revenue) : "—" });
      }
      return { emoji: "🐈", label: "Cats", stats };
    }
    if (hobby.type === "maple_syrup") {
      // entries are already filtered to the time window via filteredEntries
      const sap = entries.filter(e => e.action === "sap_collected")
        .reduce((s, e) => s + (Number(e.gallons) || 0), 0);
      const syrup = entries.filter(e => e.action === "boil")
        .reduce((s, e) => s + (Number(e.syrupGal) || 0), 0);
      const tapEntries = entries.filter(e => e.action === "tap_set")
        .reduce((s, e) => s + (Number(e.count) || 0), 0);
      const cost = entries.filter(e => e.action === "supplies" || e.action === "infrastructure")
        .reduce((s, e) => s + (Number(e.cost) || 0), 0);
      // Seasons in range — use startDate as the season's date
      const seasons = (hobby.seasons || []).filter(s => inRange(s.startDate));
      // For "all-time" filter, surface peak taps from any season; otherwise
      // sum tap_set entries in the window.
      const peakTaps = (hobby.seasons || []).reduce((m, s) => Math.max(m, Number(s.totalTaps) || 0), 0);
      const tapsValue = filter === "all" ? Math.max(peakTaps, tapEntries) : tapEntries;
      return {
        emoji: "🍁", label: "Maple Syrup",
        stats: [
          { label: "Sap collected", value: sap > 0 ? `${sap.toFixed(1)} gal` : "—" },
          { label: "Syrup made", value: syrup > 0 ? `${syrup.toFixed(2)} gal` : "—" },
          { label: filter === "all" ? "Most taps" : "Taps set", value: tapsValue || "—" },
          { label: filter === "all" ? "Seasons" : "Cost", value: filter === "all" ? (hobby.seasons || []).length : (cost > 0 ? fmtMoney(cost) : "—") },
        ],
      };
    }
    if (hobby.type === "dehydrating") {
      const batches = (hobby.batches || []).filter(b => !b.archived && inRange(b.date));
      const totalOz = batches.reduce((s, b) => s + (Number(b.outputOz) || 0), 0);
      const totalCost = batches.reduce((s, b) => s + (Number(b.ingredientsCost) || 0), 0);
      const avgRun = batches.length > 0
        ? batches.reduce((s, b) => s + (Number(b.dryerHours) || 0), 0) / batches.length
        : 0;
      return {
        emoji: "🌬️", label: "Dehydrating",
        stats: [
          { label: "Batches", value: batches.length },
          { label: "Total output", value: totalOz > 0 ? `${totalOz.toFixed(1)} oz` : "—" },
          { label: "Avg run", value: avgRun > 0 ? `${avgRun.toFixed(1)} hr` : "—" },
          { label: "Cost", value: totalCost > 0 ? fmtMoney(totalCost) : "—" },
        ],
      };
    }
    if (hobby.type === "freeze_drying") {
      const batches = (hobby.batches || []).filter(b => !b.archived && inRange(b.date));
      const totalOz = batches.reduce((s, b) => s + (Number(b.outputOz) || 0), 0);
      const totalCost = batches.reduce((s, b) => s + (Number(b.ingredientsCost) || 0), 0);
      const totalHours = batches.reduce((s, b) => s + (Number(b.runHours) || 0), 0);
      return {
        emoji: "❄️", label: "Freeze Drying",
        stats: [
          { label: "Batches", value: batches.length },
          { label: "Total output", value: totalOz > 0 ? `${totalOz.toFixed(1)} oz` : "—" },
          { label: "Run hours", value: totalHours > 0 ? totalHours.toFixed(1) : "—" },
          { label: "Cost", value: totalCost > 0 ? fmtMoney(totalCost) : "—" },
        ],
      };
    }
    if (hobby.type === "fermentation") {
      // Ferments use startDate; stages are dated individually so we count
      // stages whose date falls in the window.
      const ferments = (hobby.ferments || []).filter(f => inRange(f.startDate));
      const active = ferments.filter(f => !f.archived);
      const completed = ferments.filter(f => f.archived);
      const allStages = (hobby.ferments || []).flatMap(f => f.stages || []);
      const stagesInRange = allStages.filter(st => inRange(st.date));
      return {
        emoji: "🫧", label: "Fermentation",
        stats: [
          { label: filter === "all" ? "Active" : "Started", value: filter === "all" ? (hobby.ferments || []).filter(f => !f.archived).length : ferments.length },
          { label: "Completed", value: completed.length },
          { label: "Stage logs", value: stagesInRange.length },
          { label: "Recipes", value: (hobby.recipes || []).length },
        ],
      };
    }
    return { emoji: "📊", label: hobby.name, stats: [] };
  };

  const { emoji, label, stats } = buildStats(filteredEntries);
  const homesteadName = data.homesteadName || "My Homestead";
  const dateLabel = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Load html2canvas. We dynamic-import the npm package rather than injecting
  // a <script src="cdn..."> tag because Capacitor (and strict CSP) blocks
  // runtime CDN script loads — the native iOS/Android build can't fetch from
  // cdnjs at runtime. Make sure html2canvas is in your package.json deps.
  const loadHtml2Canvas = async () => {
    if (window.html2canvas) return window.html2canvas;
    const mod = await import("html2canvas");
    return mod.default || mod;
  };

  const captureCard = async () => {
    const h2c = await loadHtml2Canvas();
    const canvas = await h2c(cardRef.current, {
      scale: 3,
      useCORS: true,
      backgroundColor: null,
      logging: false,
    });
    return canvas;
  };

  const handleShare = async () => {
    setShareStatus("sharing");
    try {
      const canvas = await captureCard();
      canvas.toBlob(async (blob) => {
        const file = new File([blob], "henalytics-stats.png", { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `${homesteadName} — ${label} Stats`,
            });
            setShareStatus("");
          } catch (e) {
            // User cancelled — fall back to download
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = "henalytics-stats.png"; a.click();
            URL.revokeObjectURL(url);
            setShareStatus("done");
            setTimeout(() => setShareStatus(""), 2000);
          }
        } else {
          // Desktop fallback — download
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = "henalytics-stats.png"; a.click();
          URL.revokeObjectURL(url);
          setShareStatus("done");
          setTimeout(() => setShareStatus(""), 2000);
        }
      }, "image/png");
    } catch (e) {
      console.error("Share failed:", e);
      setShareStatus("error");
      setTimeout(() => setShareStatus(""), 3000);
    }
  };

  // Web Share API capability check. Memoized: previously a `new File()` was
  // allocated on every render just to feed navigator.canShare. Capability
  // doesn't change at runtime, so one check per modal mount is plenty.
  const canShareFiles = React.useMemo(() => {
    try {
      if (!navigator.canShare) return false;
      const probe = new File([""], "t.png", { type: "image/png" });
      return navigator.canShare({ files: [probe] });
    } catch (e) {
      return false;
    }
  }, []);

  const btnLabel = () => {
    if (shareStatus === "sharing") return "Preparing image...";
    if (shareStatus === "done") return "✓ Image saved!";
    if (shareStatus === "error") return "Something went wrong";
    // On mobile with Web Share API, show Share; otherwise Download
    return canShareFiles ? "Share image 📤" : "Download image 💾";
  };

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(44,24,16,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16,overflowY:"auto" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:palette.bg,borderRadius:20,maxWidth:400,width:"100%",border:`2px solid ${palette.ink}`,boxShadow:`6px 8px 0 ${palette.line}`,fontFamily:FONT_BODY,overflow:"hidden" }}>

        {/* Period filter */}
        <div style={{ padding:"16px 16px 0",display:"flex",gap:6,justifyContent:"center" }}>
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding:"6px 12px",borderRadius:8,border:`1.5px solid ${filter===f.id?palette.ink:palette.line}`,
              background:filter===f.id?palette.ink:palette.card,
              color:filter===f.id?palette.bg:palette.ink,
              fontFamily:FONT_BODY,fontWeight:600,fontSize:12,cursor:"pointer",
            }}>{f.label}</button>
          ))}
        </div>

        {/* Card — this is what gets captured */}
        <div ref={cardRef} style={{
          margin:"14px 16px 0",
          background:"#2C1810",
          borderRadius:16,
          padding:"28px 24px 24px",
          textAlign:"center",
          fontFamily:"Georgia, serif",
        }}>
          <div style={{ fontSize:11,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:2,marginBottom:6 }}>
            {homesteadName}
          </div>
          <div style={{ fontSize:46,marginBottom:6,lineHeight:1 }}>{emoji}</div>
          <div style={{ fontSize:22,color:"#E8B547",marginBottom:4,fontWeight:700,lineHeight:1.2 }}>
            {label}
          </div>
          <div style={{ fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:20,textTransform:"uppercase",letterSpacing:1 }}>
            {filterLabel}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
            {stats.map((s,i) => (
              <div key={i} style={{ background:"rgba(255,255,255,0.07)",borderRadius:10,padding:"12px 8px" }}>
                <div style={{ fontSize:10,color:"rgba(255,255,255,0.45)",marginBottom:4,textTransform:"uppercase",letterSpacing:0.8 }}>{s.label}</div>
                <div style={{ fontSize:20,color:"#fff",fontWeight:700,lineHeight:1 }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:10,color:"rgba(255,255,255,0.25)",marginTop:18,letterSpacing:1 }}>
            HENALYTICS.COM · {dateLabel.toUpperCase()}
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding:"14px 16px 18px",display:"flex",flexDirection:"column",gap:8 }}>
          <div style={{ fontSize:11,color:palette.inkSoft,textAlign:"center",marginBottom:2 }}>
            Save the image, then share it to Instagram, Facebook, or anywhere 📱
          </div>
          <button
            onClick={handleShare}
            disabled={shareStatus === "sharing"}
            style={{ width:"100%",padding:"13px",borderRadius:10,border:`2px solid ${palette.ink}`,background:shareStatus==="done"?palette.leaf:palette.ink,color:palette.bg,fontFamily:FONT_BODY,fontWeight:700,fontSize:15,cursor:shareStatus==="sharing"?"wait":"pointer",boxShadow:"2px 2px 0 "+palette.line,opacity:shareStatus==="sharing"?0.7:1 }}
          >
            {btnLabel()}
          </button>
          <button
            onClick={onClose}
            style={{ width:"100%",padding:"10px",borderRadius:10,border:`1.5px solid ${palette.line}`,background:"transparent",color:palette.inkSoft,fontFamily:FONT_BODY,fontWeight:600,fontSize:14,cursor:"pointer" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TUTORIAL MODAL — 12-slide feature walkthrough
// ============================================================================
const TUTORIAL_SLIDES = [
  {
    emoji: "🌾",
    title: "Welcome to Henalytics",
    body: "Henalytics is the homestead notebook you actually want to use. Track eggs, harvests, livestock, costs, sales — anything you log on your homestead — without spreadsheets or forms. This quick tour covers the essentials.",
    tip: null,
  },
  {
    emoji: "🔧",
    title: "Enable the hobbies you do",
    body: "You only see what's relevant to you. Hide meat birds if you don't raise them. Enable Goats, Pigs, Rabbits, Horses, Bees, Canning, and more when you're ready — there are 18+ hobbies to pick from.",
    tip: "Tap 'More hobbies?' on the home screen, or go to ⚙️ Settings. You can also hide the Sales tab there if you don't sell anything.",
  },
  {
    emoji: "👆",
    title: "Logging is one tap",
    body: "Every hobby has a grid of quick-log tiles. Watered the garden? Tap 💧. Fed the meat birds? Tap 🍖 and pick lbs or cups. Sold eggs? Tap 💵. Most actions take 2-3 seconds, weather and date auto-attach.",
    tip: "Logs are time-stamped from your phone. Attach photos to any note, harvest, or issue entry for visual history.",
  },
  {
    emoji: "🥚",
    title: "The egg basket",
    body: "Tap + each time you collect an egg during your rounds. When you're done, hit 'Done — log N eggs' to save it to your records.",
    tip: "The basket resets automatically each day. Each flock has its own basket.",
  },
  {
    emoji: "🐔",
    title: "Name your birds",
    body: "Track favorites by name and band color in any flock. Optionally pick the breed — chicken, duck, turkey, quail, goose, guinea, and peafowl breeds are all in the picker. Great for breeding stock, broody hens, or birds with quirks worth remembering.",
    tip: "Tap '+ Name a bird' on any flock to start. Multiple flock types: chickens, ducks, turkeys, quail, geese, guineas, peafowl all run separately with their own baskets and stats.",
  },
  {
    emoji: "💵",
    title: "Track what your birds cost",
    body: "When you add a flock, log the cost and where you bought them — hatchery name, feed store, or a neighbor. Pairs with feed costs (lbs OR cups) to give you real cost-per-egg numbers later.",
    tip: "Already added a flock? Tap it on the home screen to edit and add the cost + source.",
  },
  {
    emoji: "🍗",
    title: "Meat birds: multiple batches at once",
    body: "Running broilers and turkeys side by side? Each batch is independent — its own feed logs, mortality, butcher records, even feed conversion ratio (FCR). When you're done with a batch, hit 'Finalize' and it moves to your Past batches archive.",
    tip: "Past batches are tucked at the bottom of the Meat Birds home page. Full per-batch records always live in the Stats tab.",
  },
  {
    emoji: "❄️",
    title: "Butcher any bird",
    body: "It's not just for meat birds. Process a few quail, an extra rooster, a duck — any bird from any flock can go to the freezer log with date, count, and average weight.",
    tip: "Tap a flock on the Egg Layers home tab and choose 'Butcher' to send some birds to the freezer log.",
  },
  {
    emoji: "🐐",
    title: "Animals: pedigree & history",
    body: "Goats, cows, pigs, sheep, rabbits, dogs, horses — each animal has its own profile, pedigree tree (sire/dam linkage), breeding records, and chronological 📜 History view of everything ever logged for them.",
    tip: "Adding a calf, kid, lamb, or kit through the breeding flow auto-links them to the dam so the pedigree builds itself.",
  },
  {
    emoji: "🐎",
    title: "Horses: rides + apply care to many",
    body: "Log rides with duration, type (trail, arena, lesson), and notes. Track farrier, vet, and dewormer visits — and when one visit applies to multiple horses (the whole barn got their shots), tap each horse it covers or 'Select all' to log once.",
    tip: "Each horse's 📜 History combines rides, vet, farrier, dewormer, breeding, and sales — everything in one timeline.",
  },
  {
    emoji: "🚜",
    title: "Move the chicken tractor",
    body: "Egg layers and meat birds have a Move Tractor tile. First move asks roughly how far you move it each time; after that it's one tap. Year-in-review tells you fun facts about your total distance moved — about football fields, marathons, even how many Rhode Islands.",
    tip: "Your chickens have moved more than you'd think.",
  },
  {
    emoji: "🗺️",
    title: "Garden map",
    body: "Start a garden season, then tap 'Garden Map' to upload a photo of your garden. Drop pins exactly where things grow — each pin tracks what's planted there.",
    tip: "Use any photo: overhead photo, hand-drawn sketch, or satellite screenshot.",
  },
  {
    emoji: "📅",
    title: "Calendar & planting dates",
    body: "Tap the Calendar tab and plan a crop. Henalytics calculates suggested planting dates based on your hardiness zone and last frost date.",
    tip: "All dates are editable — adjust any of them before adding to your calendar. Add custom calendar events for vet visits, hatch days, anything.",
  },
  {
    emoji: "💰",
    title: "Sales + customer directory",
    body: "Log what you sell — eggs (by bird type, eating vs hatching), honey, meat birds, rabbits, garden produce. Build a customer directory and see which buyers come back. Track revenue over time with full breakdowns.",
    tip: "Old 'Sold Eggs' entries from Egg Layers show up here automatically. Don't sell anything? Hide this tab in ⚙️ Settings.",
  },
  {
    emoji: "📊",
    title: "Stats tab + share cards",
    body: "Every hobby has a Stats tab with charts, cost breakdowns, and trends. Filter by time range — today, week, 30/60/90 days, custom, or all-time. Hit 'Share Stats' to generate a shareable image with your homestead's numbers.",
    tip: "Active batches and seasons show up in time-windowed views even if they started earlier — so feed you logged this week shows up under 'Past 7 days' even on a 35-day-old batch.",
  },
  {
    emoji: "🏚",
    title: "Barn, farmhands, Year in Review",
    body: "Tap the 🏚 barn in the top-right to invite a farmhand (share with your partner or family in real time), set your location, and manage photos. Tap ✨ Year in Review any time to see a live summary of your year. The ❤️ next to the barn is a tip jar — leave a tip if Henalytics has saved you time.",
    tip: "Farmhands see the same data live — great for couples running the homestead together. Want a weekly Sunday recap by email? Turn it on in ⚙️ Settings.",
  },
];

export function TutorialModal({ onClose, startSlide = 0 }) {
  const [slide, setSlide] = useState(startSlide);
  const total = TUTORIAL_SLIDES.length;
  const s = TUTORIAL_SLIDES[slide];
  const isLast = slide === total - 1;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(44,24,16,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 200, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: palette.bg, borderRadius: 20, maxWidth: 420, width: "100%",
          border: `2px solid ${palette.ink}`, boxShadow: `6px 8px 0 ${palette.line}`,
          fontFamily: FONT_BODY, overflow: "hidden",
        }}
      >
        {/* Progress bar */}
        <div style={{ height: 4, background: palette.bgAlt }}>
          <div style={{ height: "100%", background: palette.leaf, width: `${((slide + 1) / total) * 100}%`, transition: "width 0.3s" }} />
        </div>

        {/* Content */}
        <div style={{ padding: "28px 24px 20px" }}>
          {/* Progress dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 24 }}>
            {TUTORIAL_SLIDES.map((_, i) => (
              <div
                key={i}
                onClick={() => setSlide(i)}
                style={{
                  width: i === slide ? 18 : 8, height: 8, borderRadius: 4,
                  background: i === slide ? palette.ink : i < slide ? palette.leaf : palette.line,
                  cursor: "pointer", transition: "all 0.2s",
                }}
              />
            ))}
          </div>

          {/* Emoji */}
          <div style={{ fontSize: 56, textAlign: "center", marginBottom: 16, lineHeight: 1 }}>
            {s.emoji}
          </div>

          {/* Title */}
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, color: palette.ink, textAlign: "center", marginBottom: 12, lineHeight: 1.2 }}>
            {s.title}
          </div>

          {/* Body */}
          <div style={{ fontSize: 15, color: palette.ink, lineHeight: 1.6, textAlign: "center", marginBottom: s.tip ? 14 : 0 }}>
            {s.body}
          </div>

          {/* Tip */}
          {s.tip && (
            <div style={{
              background: palette.yolkSoft, border: `1.5px solid ${palette.line}`,
              borderRadius: 10, padding: "10px 14px", fontSize: 13,
              color: palette.ink, lineHeight: 1.5, textAlign: "left",
            }}>
              💡 {s.tip}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div style={{
          display: "flex", gap: 8, padding: "0 24px 24px",
          justifyContent: "space-between", alignItems: "center",
        }}>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, fontFamily: FONT_BODY, fontSize: 13, padding: "8px 4px" }}
          >
            {isLast ? "" : "Skip tour"}
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {slide > 0 && (
              <button
                onClick={() => setSlide(slide - 1)}
                style={{ padding: "10px 16px", borderRadius: 8, border: `1.5px solid ${palette.line}`, background: palette.bgAlt, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14, color: palette.ink, cursor: "pointer" }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={() => isLast ? onClose() : setSlide(slide + 1)}
              style={{ padding: "10px 20px", borderRadius: 8, border: `1.5px solid ${palette.ink}`, background: palette.ink, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14, color: palette.bg, cursor: "pointer", boxShadow: "2px 2px 0 " + palette.line }}
            >
              {isLast ? "Let's go! 🌾" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TUTORIAL PROMPT — shown once after onboarding finishes
// ============================================================================
export function TutorialPrompt({ onStart, onSkip }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(44,24,16,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 200, padding: 16,
      }}
    >
      <div
        style={{
          background: palette.bg, borderRadius: 20, maxWidth: 380, width: "100%",
          border: `2px solid ${palette.ink}`, boxShadow: `6px 8px 0 ${palette.line}`,
          fontFamily: FONT_BODY, padding: "32px 28px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 52, marginBottom: 16 }}>🌾</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, color: palette.ink, marginBottom: 10 }}>
          Want a quick tour?
        </div>
        <div style={{ fontSize: 14, color: palette.inkSoft, lineHeight: 1.6, marginBottom: 24 }}>
          We'll walk you through the key features in about 2 minutes — egg tracking, the garden map, sales, and more.
        </div>
        <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 20, fontStyle: "italic" }}>
          Not now? The tour is always available in ⚙️ Settings.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={onStart}
            style={{
              padding: "12px 20px", borderRadius: 10, border: `2px solid ${palette.ink}`,
              background: palette.ink, color: palette.bg, fontFamily: FONT_BODY,
              fontWeight: 700, fontSize: 15, cursor: "pointer",
              boxShadow: "3px 3px 0 " + palette.line,
            }}
          >
            Let's go! 🌾
          </button>
          <button
            onClick={onSkip}
            style={{
              padding: "10px 20px", borderRadius: 10, border: `1.5px solid ${palette.line}`,
              background: "transparent", color: palette.inkSoft, fontFamily: FONT_BODY,
              fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ADD PERENNIAL MODAL
// ============================================================================
function AddPerennialModal({ hobbyId, category: initialCategory = "plant", update, onClose }) {
  const [category, setCategory] = useState(initialCategory);
  const [name, setName] = useState("");
  const [variety, setVariety] = useState("");
  const [plantDate, setPlantDate] = useState("");
  const [notes, setNotes] = useState("");
  const PLANT_SUGGESTIONS = ["Blueberry bush","Raspberry bush","Blackberry bush","Strawberry bed","Asparagus","Rhubarb","Horseradish","Artichoke","Grape vine","Kiwi vine"];
  const TREE_SUGGESTIONS  = ["Apple tree","Pear tree","Peach tree","Cherry tree","Plum tree","Fig tree","Apricot tree","Pecan tree","Walnut tree"];
  const SUGGESTIONS = category === "tree" ? TREE_SUGGESTIONS : PLANT_SUGGESTIONS;
  return (
    <Modal open onClose={onClose} title={category === "tree" ? "Add a tree" : "Add a perennial plant"}>
      <Field label="Type">
        <div style={{ display:"flex",gap:6 }}>
          {[{id:"plant",label:"🌿 Plant"},{id:"tree",label:"🌳 Tree"}].map(opt => (
            <button key={opt.id} onClick={() => setCategory(opt.id)} style={{
              flex:1,padding:"8px",borderRadius:8,cursor:"pointer",fontFamily:FONT_BODY,fontSize:13,
              border:`1.5px solid ${category===opt.id ? palette.ink : palette.line}`,
              background: category===opt.id ? palette.ink : "transparent",
              color: category===opt.id ? palette.bg : palette.ink,
            }}>{opt.label}</button>
          ))}
        </div>
      </Field>
      <Field label={category === "tree" ? "Tree name" : "Plant name"}>
        <input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} placeholder={category === "tree" ? "Apple tree, peach tree..." : "Blueberries, asparagus..."} autoFocus />
        {!name && (
          <div style={{ display:"flex",flexWrap:"wrap",gap:4,marginTop:6 }}>
            {SUGGESTIONS.slice(0,8).map(s=>(
              <button key={s} onClick={()=>setName(s)} style={{ padding:"3px 8px",fontSize:11,borderRadius:6,border:`1px solid ${palette.line}`,background:palette.bgAlt,cursor:"pointer",fontFamily:FONT_BODY }}>{s}</button>
            ))}
          </div>
        )}
      </Field>
      <Field label="Variety (optional)">
        <input style={inputStyle} value={variety} onChange={e=>setVariety(e.target.value)} placeholder="e.g. Honeycrisp, Jersey Giant..." />
      </Field>
      <Field label="Plant date (optional)">
        <input type="date" style={inputStyle} value={plantDate} onChange={e=>setPlantDate(e.target.value)} />
      </Field>
      <Field label="Notes (optional)">
        <input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Location, spacing, rootstock..." />
      </Field>
      <Btn variant="primary" onClick={() => {
        if (!name.trim()) return;
        update(d => {
          const h = d.hobbies.find(x => x.id === hobbyId);
          if (!h) return d;
          if (!Array.isArray(h.perennials)) h.perennials = [];
          h.perennials.push({ id: newId(), category, name: name.trim(), variety, plantDate, notes, totalHarvest: 0, harvests: [], actions: [], created: Date.now() });
          return d;
        });
        onClose();
      }}>Add {name || (category === "tree" ? "tree" : "plant")}</Btn>
    </Modal>
  );
}

// ============================================================================
// EDIT PERENNIAL MODAL
// ============================================================================
function EditPerennialModal({ hobbyId, perennial, update, onClose }) {
  const [category, setCategory] = useState(perennial.category || "plant");
  const [name, setName] = useState(perennial.name || "");
  const [variety, setVariety] = useState(perennial.variety || "");
  const [plantDate, setPlantDate] = useState(perennial.plantDate || "");
  const [notes, setNotes] = useState(perennial.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = () => {
    if (!name.trim()) return;
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      const p = (h.perennials||[]).find(x => x.id === perennial.id);
      if (p) { p.category = category; p.name = name.trim(); p.variety = variety; p.plantDate = plantDate; p.notes = notes; }
      return d;
    });
    onClose();
  };
  const remove = () => {
    update(d => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (h) h.perennials = (h.perennials||[]).filter(x => x.id !== perennial.id);
      return d;
    });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="Edit perennial">
      <Field label="Type">
        <div style={{ display:"flex",gap:6 }}>
          {[{id:"plant",label:"🌿 Plant"},{id:"tree",label:"🌳 Tree"}].map(opt => (
            <button key={opt.id} onClick={() => setCategory(opt.id)} style={{
              flex:1,padding:"8px",borderRadius:8,cursor:"pointer",fontFamily:FONT_BODY,fontSize:13,
              border:`1.5px solid ${category===opt.id ? palette.ink : palette.line}`,
              background: category===opt.id ? palette.ink : "transparent",
              color: category===opt.id ? palette.bg : palette.ink,
            }}>{opt.label}</button>
          ))}
        </div>
      </Field>
      <Field label="Name"><input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} autoFocus /></Field>
      <Field label="Variety (optional)"><input style={inputStyle} value={variety} onChange={e=>setVariety(e.target.value)} placeholder="e.g. Honeycrisp" /></Field>
      <Field label="Plant date (optional)"><input type="date" style={inputStyle} value={plantDate} onChange={e=>setPlantDate(e.target.value)} /></Field>
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)} /></Field>
      <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
        <Btn variant="primary" onClick={save}>Save changes</Btn>
        {!confirmDelete && <Btn variant="ghost" onClick={()=>setConfirmDelete(true)}>Delete</Btn>}
        {confirmDelete && <Btn variant="danger" onClick={remove}>Confirm delete</Btn>}
      </div>
    </Modal>
  );
}

// ============================================================================
// LOG PERENNIAL HARVEST MODAL
// ============================================================================
function LogPerennialHarvestModal({ hobbyId, perennial, update, onClose }) {
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("lbs");
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  return (
    <Modal open onClose={onClose} title={`Harvest — ${perennial.name}`}>
      <div style={{ display:"flex",gap:12 }}>
        <div style={{ flex:2 }}>
          <Field label="Quantity">
            <input type="number" inputMode="decimal" min={0} step="0.1" style={inputStyle} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" autoFocus />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Unit">
            <select style={inputStyle} value={unit} onChange={e=>setUnit(e.target.value)}>
              {["lbs","oz","count","quart","pint","bunch"].map(u=><option key={u}>{u}</option>)}
            </select>
          </Field>
        </div>
      </div>
      <Field label="Date"><input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} /></Field>
      <Field label="Notes (optional)"><input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)} /></Field>
      <Btn onClick={() => {
        const q = Number(qty);
        if (!q) return;
        update(d => {
          const h = d.hobbies.find(x => x.id === hobbyId);
          if (!h) return d;
          const p = (h.perennials||[]).find(x => x.id === perennial.id);
          if (!p) return d;
          p.harvests = p.harvests || [];
          p.harvests.push({ id: newId(), date, qty: q, unit, notes });
          p.totalHarvest = (p.totalHarvest||0) + (unit === "lbs" ? q : 0);
          return d;
        });
        onClose();
      }}>Log {qty||"0"} {unit}</Btn>
    </Modal>
  );
}

// ============================================================================
// PERENNIAL DETAIL MODAL — shows info, actions, harvests, and entry points
// ============================================================================
function PerennialDetailModal({ hobbyId, perennial, update, setModal, onClose }) {
  const actions = [...(perennial.actions || [])].sort((a,b) => (b.date || "").localeCompare(a.date || ""));
  const harvests = [...(perennial.harvests || [])].sort((a,b) => (b.date || "").localeCompare(a.date || ""));

  const removeAction = (id) => update(d => {
    const h = d.hobbies.find(x => x.id === hobbyId);
    if (!h) return d;
    const p = (h.perennials||[]).find(x => x.id === perennial.id);
    if (p) p.actions = (p.actions||[]).filter(a => a.id !== id);
    return d;
  });

  return (
    <Modal open onClose={onClose} title={perennial.name + (perennial.variety ? ` — ${perennial.variety}` : "")}>
      <div style={{ fontSize:12,color:palette.inkSoft,marginBottom:12 }}>
        {perennial.category === "tree" ? "🌳 Orchard tree" : "🌿 Perennial plant"}
        {perennial.plantDate ? ` · Planted ${perennial.plantDate}` : ""}
        {perennial.totalHarvest ? ` · ${perennial.totalHarvest} lbs lifetime` : ""}
      </div>

      <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:14 }}>
        <Btn variant="primary" onClick={() => setModal({ type:"logPerennialAction",hobbyId,perennialId:perennial.id })}>
          + Log action
        </Btn>
        <Btn onClick={() => setModal({ type:"logPerennialHarvest",hobbyId,perennialId:perennial.id })}>
          🧺 Log harvest
        </Btn>
        <Btn variant="ghost" onClick={() => setModal({ type:"editPerennial",hobbyId,perennialId:perennial.id })}>
          Edit
        </Btn>
      </div>

      {actions.length > 0 && (
        <>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:14,color:palette.ink,marginBottom:6 }}>Action history</div>
          <div style={{ display:"flex",flexDirection:"column",gap:4,marginBottom:14 }}>
            {actions.map(a => (
              <div key={a.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:palette.bgAlt,borderRadius:6,fontSize:12 }}>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ color:palette.ink }}><strong>{a.type}</strong> · {a.date}</div>
                  {a.notes && <div style={{ color:palette.inkSoft,fontSize:11 }}>{a.notes}</div>}
                </div>
                <button onClick={() => removeAction(a.id)} aria-label="Remove" style={{ background:"none",border:"none",cursor:"pointer",color:palette.accent,fontSize:14,padding:"0 4px" }}>✕</button>
              </div>
            ))}
          </div>
        </>
      )}

      {harvests.length > 0 && (
        <>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:14,color:palette.ink,marginBottom:6 }}>Harvest history</div>
          <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
            {harvests.slice(0,10).map(h => (
              <div key={h.id} style={{ padding:"6px 10px",background:palette.bgAlt,borderRadius:6,fontSize:12,color:palette.ink }}>
                {h.date} · {h.qty} {h.unit}{h.notes ? ` — ${h.notes}` : ""}
              </div>
            ))}
          </div>
        </>
      )}

      {actions.length === 0 && harvests.length === 0 && (
        <div style={{ fontSize:12,color:palette.inkSoft,fontStyle:"italic",padding:"8px 0" }}>
          No history yet. Log an action or harvest to start tracking.
        </div>
      )}
    </Modal>
  );
}

// ============================================================================
// LOG PERENNIAL ACTION MODAL
// ============================================================================
const PERENNIAL_ACTION_TYPES = ["Spray","Prune","Fertilize","Mulch","Treat (pest/disease)","Inspect","Water","Thin","Other"];

function LogPerennialActionModal({ hobbyId, perennial, update, onClose }) {
  const [type, setType] = useState("Spray");
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  return (
    <Modal open onClose={onClose} title={`Log action — ${perennial.name}`}>
      <Field label="Action">
        <select style={inputStyle} value={type} onChange={e=>setType(e.target.value)} autoFocus>
          {PERENNIAL_ACTION_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} />
      </Field>
      <Field label="Notes (optional)">
        <input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="What you sprayed, how hard you pruned, etc." />
      </Field>
      <Btn variant="primary" onClick={() => {
        update(d => {
          const h = d.hobbies.find(x => x.id === hobbyId);
          if (!h) return d;
          const p = (h.perennials||[]).find(x => x.id === perennial.id);
          if (!p) return d;
          p.actions = p.actions || [];
          p.actions.push({ id: newId(), type, date, notes, created: Date.now() });
          return d;
        });
        onClose();
      }}>Log {type}</Btn>
    </Modal>
  );
}

// ============================================================================
// WHAT'S NEW MODAL
// ============================================================================
function WhatsNewModal({ onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position:"fixed",inset:0,background:"rgba(44,24,16,0.55)",
        display:"flex",alignItems:"center",justifyContent:"center",
        zIndex:200,padding:16,
      }}
    >
      <div
        onClick={e=>e.stopPropagation()}
        style={{
          background:palette.bg,borderRadius:20,maxWidth:420,width:"100%",
          maxHeight:"min(85vh, 600px)",
          border:`2px solid ${palette.ink}`,boxShadow:`6px 8px 0 ${palette.line}`,
          fontFamily:FONT_BODY,overflow:"hidden",
          display:"flex",flexDirection:"column",
        }}
      >
        {/* Header — fixed, with close button */}
        <div style={{ background:palette.ink,padding:"20px 24px 18px",textAlign:"center",position:"relative",flexShrink:0 }}>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position:"absolute",top:12,right:12,
              background:"rgba(255,255,255,0.1)",border:"none",borderRadius:"50%",
              width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",
              color:palette.bg,cursor:"pointer",padding:0,
            }}
          >
            <X size={18}/>
          </button>
          <div style={{ fontSize:32,marginBottom:6 }}>🌾</div>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:24,color:palette.yolk,lineHeight:1.2 }}>What's new</div>
          <div style={{ fontSize:12,color:"rgba(255,255,255,0.5)",marginTop:4 }}>Fresh off the tractor</div>
        </div>

        {/* Scrollable list — caps around 4 items visible, scrolls for the rest */}
        <div style={{ padding:"16px 20px 8px",overflowY:"auto",flex:1,minHeight:0 }}>
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {WHATS_NEW.map((item,i) => (
              <div
                key={i}
                style={{
                  display:"flex",gap:10,alignItems:"flex-start",
                  padding:"10px 12px",background:palette.card,
                  border:`1.5px solid ${palette.line}`,borderRadius:10,
                  fontSize:13,color:palette.ink,lineHeight:1.5,
                  flexShrink:0,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Footer button — sticky bottom */}
        <div style={{ padding:"12px 20px 16px",flexShrink:0,background:palette.bg,borderTop:`1px solid ${palette.line}` }}>
          <button
            onClick={onClose}
            style={{
              width:"100%",padding:"12px",borderRadius:10,
              border:`2px solid ${palette.ink}`,background:palette.ink,color:palette.bg,
              fontFamily:FONT_BODY,fontWeight:700,fontSize:15,cursor:"pointer",
              boxShadow:"2px 2px 0 "+palette.line,
            }}
          >
            Got it — let's go! 🌾
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ MILESTONE MODAL — celebrates user-growth milestones ============
// Fires after a successful log save (positive emotional moment) when the
// total user count crosses a threshold the user hasn't seen yet. Content
// is driven by the Supabase app_config row so Riley can edit copy or add
// new milestones without shipping an app update.
//
// Config shape (jsonb):
//   {
//     enabled: true,
//     milestones: [1500, 3000, 5000, 10000, ...],   // thresholds, ascending
//     headline: "{count} homesteaders and growing", // {count} → real count
//     body: "...{count}...",                        // {count} → real count
//     minLogsRequired: 3
//   }
//
// Props:
//   - config: the full config object from Supabase
//   - userCount: live integer count from get_user_count()
//   - milestone: the specific threshold this user just crossed (e.g. 1500)
//
// Two buttons:
//   - "Support Henalytics" → marks seen AND opens the existing SupportModal
//   - "Maybe later"        → just marks seen and dismisses
function MilestoneModal({ config, userCount, milestone, onClose, onOpenSupport }) {
  if (!config) return null;
  const palette_local = {
    bg: "#F4EDE0", ink: "#2C1810", inkSoft: "#5C4530",
    accent: "#C84B31", leaf: "#5A7A3C", yolk: "#E8B547",
    card: "#FAF5EA", line: "#2C181020",
  };
  // Display the live count with thousands separator.
  const safeCount = typeof userCount === "number" && userCount > 0 ? userCount : milestone;
  const prettyCount = safeCount.toLocaleString("en-US");
  // Substitute {count} (real number) and {milestone} (the threshold) into copy.
  const substitute = (s) => {
    if (typeof s !== "string") return "";
    return s
      .replace(/\{count\}/g, prettyCount)
      .replace(/\{milestone\}/g, milestone.toLocaleString("en-US"));
  };
  const headline = substitute(config.headline || `${prettyCount} homesteaders and growing`);
  const body = substitute(config.body || "");

  return (
    <div
      data-no-keyboard-shift
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: palette_local.card,
          borderRadius: 16,
          maxWidth: 440,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "32px 28px 24px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
          fontFamily: `'Be Vietnam Pro', -apple-system, sans-serif`,
          color: palette_local.ink,
          textAlign: "center",
          position: "relative",
        }}
      >
        {/* Subtle confetti dots scattered behind the headline */}
        <div aria-hidden style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 120,
          pointerEvents: "none", overflow: "hidden", borderRadius: "16px 16px 0 0",
        }}>
          {[
            { l: "8%", t: 18, c: palette_local.yolk, s: 6 },
            { l: "22%", t: 42, c: palette_local.leaf, s: 4 },
            { l: "35%", t: 12, c: palette_local.accent, s: 5 },
            { l: "55%", t: 30, c: palette_local.yolk, s: 5 },
            { l: "72%", t: 16, c: palette_local.leaf, s: 6 },
            { l: "88%", t: 48, c: palette_local.accent, s: 4 },
          ].map((d, i) => (
            <span key={i} style={{
              position: "absolute", left: d.l, top: d.t,
              width: d.s, height: d.s, borderRadius: "50%", background: d.c,
              opacity: 0.6,
            }} />
          ))}
        </div>

        {/* Big number — the live user count */}
        <div style={{
          fontFamily: `'DM Serif Display', Georgia, serif`,
          fontSize: 64, fontWeight: 700, lineHeight: 1, color: palette_local.yolk,
          marginTop: 8, marginBottom: 4, position: "relative",
        }}>
          {prettyCount}
        </div>
        <div style={{
          fontSize: 12, letterSpacing: 2, textTransform: "uppercase",
          color: palette_local.inkSoft, marginBottom: 20,
        }}>
          homesteaders and growing
        </div>

        {/* Headline */}
        <h2 style={{
          fontFamily: `'DM Serif Display', Georgia, serif`,
          fontSize: 24, margin: "0 0 14px", lineHeight: 1.2,
          color: palette_local.ink,
        }}>
          {headline}
        </h2>

        {/* Body */}
        <p style={{
          fontSize: 15, lineHeight: 1.55, color: palette_local.inkSoft,
          margin: "0 0 24px", textAlign: "left",
        }}>
          {body}
        </p>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => { onOpenSupport(); }}
            style={{
              background: palette_local.ink, color: palette_local.card,
              border: `1.5px solid ${palette_local.ink}`,
              padding: "14px 20px", borderRadius: 12,
              fontFamily: `'Be Vietnam Pro', sans-serif`,
              fontSize: 15, fontWeight: 600,
              cursor: "pointer", width: "100%",
            }}
          >
            💚 Support Henalytics
          </button>
          <button
            onClick={onClose}
            style={{
              background: "transparent", color: palette_local.inkSoft,
              border: `1.5px solid ${palette_local.line}`,
              padding: "12px 20px", borderRadius: 12,
              fontFamily: `'Be Vietnam Pro', sans-serif`,
              fontSize: 14,
              cursor: "pointer", width: "100%",
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}


// Generic thank-you to everyone who's chipped in.
// Includes mission statement and two Stripe Payment Link buttons (one-time + monthly).
// Marks the month as dismissed when the user closes OR taps a tip button.
function SupporterThanksModal({ onClose, onLeaveTip }) {
  // Two buttons matching the prior layout — one-time ($5) and monthly ($5).
  // New checkout flow goes through /api/create-checkout-session so the
  // subscription gets linked to the user account.
  //
  // Names fetched from /api/list-supporters for the PRIOR calendar month.
  // We compute the month key here (not at modal-open) using local time so
  // a user opening the modal on the 1st sees December's supporters, etc.
  // Edge cases handled:
  //   - Network error / endpoint down → silently show the generic thank-you
  //     without a name list (no error UI in a celebratory popup)
  //   - No supporters last month → also fall back to generic thank-you
  //   - Loading → show a small "loading…" line while the fetch runs
  const [supporterNames, setSupporterNames] = React.useState(null); // null = loading, [] = none, [...] = list
  const [priorMonthLabel, setPriorMonthLabel] = React.useState("");

  React.useEffect(() => {
    const now = new Date();
    // Subtract one month from the current calendar month
    const prior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthKey = `${prior.getFullYear()}-${String(prior.getMonth() + 1).padStart(2, "0")}`;
    setPriorMonthLabel(prior.toLocaleDateString("en-US", { month: "long", year: "numeric" }));
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/list-supporters?month=${monthKey}`);
        if (!r.ok) {
          if (!cancelled) setSupporterNames([]);
          return;
        }
        const j = await r.json();
        if (cancelled) return;
        const list = Array.isArray(j.supporters) ? j.supporters.map(s => s.name).filter(Boolean) : [];
        setSupporterNames(list);
      } catch (_) {
        if (!cancelled) setSupporterNames([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(44,24,16,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:palette.bg,borderRadius:20,maxWidth:440,width:"100%",border:`2px solid ${palette.ink}`,boxShadow:`6px 8px 0 ${palette.line}`,fontFamily:FONT_BODY,overflow:"hidden",maxHeight:"92vh",display:"flex",flexDirection:"column" }}>
        <div style={{ background:palette.leaf,padding:"24px 24px 18px",textAlign:"center",position:"relative",flexShrink:0 }}>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position:"absolute",top:12,right:12,
              background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"50%",
              width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",
              color:"#FAF5EA",cursor:"pointer",padding:0,
            }}
          >
            <X size={18}/>
          </button>
          <div style={{ fontSize:40,marginBottom:6 }}>🙏</div>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:24,color:"#FAF5EA",lineHeight:1.2 }}>Thank you</div>
          <div style={{ fontSize:12,color:"rgba(255,255,255,0.7)",marginTop:4 }}>From the whole flock</div>
        </div>
        <div style={{ padding:"20px 24px",overflowY:"auto",flex:1,minHeight:0 }}>
          <p style={{ fontSize:14,color:palette.ink,lineHeight:1.6,margin:"0 0 12px" }}>
            A huge thank-you to every supporter who chipped in this past month. Your tips are what keep Henalytics running and free for every homestead — no ads, no paywalls, no upsells.
          </p>

          {/* Named supporter shout-out — only renders when we have at least one
              visible supporter. Loading state is silent (no spinner) so the
              modal feels celebratory rather than busy. */}
          {supporterNames === null && (
            <div style={{ fontSize:12,color:palette.inkSoft,fontStyle:"italic",margin:"0 0 14px" }}>
              Loading this month's supporter list…
            </div>
          )}
          {Array.isArray(supporterNames) && supporterNames.length > 0 && (
            <div style={{
              margin:"4px 0 16px",
              padding:"14px 16px",
              background:palette.bgAlt || "#EBE0CC",
              border:`1.5px solid ${palette.line}`,
              borderRadius:12,
            }}>
              <div style={{
                fontFamily:FONT_DISPLAY,fontSize:14,color:palette.ink,
                marginBottom:8,textAlign:"center",
              }}>
                🌾 {priorMonthLabel} supporters
              </div>
              <div style={{
                display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",
              }}>
                {supporterNames.map((n, i) => (
                  <span key={i} style={{
                    fontSize:12,fontWeight:600,color:palette.ink,
                    background:palette.bg,
                    border:`1.5px solid ${palette.line}`,
                    borderRadius:999,padding:"4px 10px",
                  }}>{n}</span>
                ))}
              </div>
              <div style={{
                fontSize:11,color:palette.inkSoft,textAlign:"center",
                marginTop:10,fontStyle:"italic",
              }}>
                Thank you for keeping the lights on 💛
              </div>
            </div>
          )}

          <p style={{ fontSize:14,color:palette.ink,lineHeight:1.6,margin:"0 0 12px" }}>
            My goal is to let as many homesteaders as possible benefit from this app without ever needing a paid subscription. Honestly, that wouldn't be possible without your feedback and the tips you leave — they're what let me keep working on it and making it better.
          </p>
          <p style={{ fontStyle:"italic",fontSize:13,color:palette.inkSoft,margin:"0 0 16px" }}>
            🌾 With gratitude, from one homestead to another.
          </p>

          {/* Two big buttons side-by-side — One-time / Monthly. Tapping either
              dismisses this popup for the month (via onLeaveTip) and opens
              the Stripe payment page externally (native browser / new tab). */}
          <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
            <button
              type="button"
              onClick={() => { if (onLeaveTip) onLeaveTip(); startCheckout("one_time"); }}
              style={{
                flex: "1 1 140px",
                padding: "14px 12px",
                borderRadius: 12,
                border: `2px solid ${palette.ink}`,
                background: palette.yolk,
                color: palette.ink,
                textAlign: "center",
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 14,
                boxShadow: "2px 2px 0 " + palette.line,
                display: "block",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 2 }}>🌾</div>
              <div>One-time</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, marginTop: 2 }}>$5</div>
              <div style={{ fontSize: 10, fontWeight: 500, color: palette.inkSoft, marginTop: 2 }}>Bag of feed</div>
            </button>
            <button
              type="button"
              onClick={() => { if (onLeaveTip) onLeaveTip(); startCheckout("monthly_5"); }}
              style={{
                flex: "1 1 140px",
                padding: "14px 12px",
                borderRadius: 12,
                border: `2px solid ${palette.ink}`,
                background: palette.leaf,
                color: palette.bg,
                textAlign: "center",
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 14,
                boxShadow: "2px 2px 0 " + palette.line,
                display: "block",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 2 }}>💚</div>
              <div>Monthly</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, marginTop: 2 }}>$5</div>
              <div style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>Sustaining tip</div>
            </button>
          </div>

          <div style={{
            marginTop: 10, textAlign: "center", fontSize: 11, color: palette.inkSoft, lineHeight: 1.5,
          }}>
            {(isNativeApp() && typeof window !== "undefined" && window.__HENALYTICS_USE_IAP__ === true)
              ? "Secure checkout via Apple."
              : "Secure checkout via Stripe — Apple Pay & Google Pay supported."}
          </div>

          <button
            onClick={onClose}
            style={{
              width:"100%",padding:"10px",borderRadius:10,marginTop:14,
              border:`1.5px solid ${palette.line}`,background:"transparent",color:palette.inkSoft,
              fontFamily:FONT_BODY,fontWeight:600,fontSize:14,cursor:"pointer",
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ PHOTOS MODAL — accessible from Barn icon ============
function PhotosModal({ data, user, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ position:"fixed",inset:0,background:"rgba(44,24,16,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background:palette.bg,borderRadius:16,maxWidth:720,width:"100%",maxHeight:"92vh",overflow:"auto",border:`2px solid ${palette.ink}`,boxShadow:`6px 8px 0 ${palette.line}` }}
      >
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1.5px solid ${palette.line}` }}>
          <div style={{ fontFamily:FONT_DISPLAY,fontSize:22,color:palette.ink }}>Photo library</div>
          <button onClick={onClose} aria-label="Close" style={{ background:"none",border:"none",cursor:"pointer",color:palette.ink,padding:4 }}><X size={22}/></button>
        </div>
        <div style={{ padding:20 }}>
          <PhotoLibraryPage data={data} user={user} />
        </div>
      </div>
    </div>
  );
}
