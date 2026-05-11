import React, { useState, useEffect, useRef } from "react";
import {
  Sprout, Egg, Drumstick, Plus, Droplet, Sun, Scissors, AlertTriangle,
  Skull, Bird, Home, BarChart3, X, ChevronDown, Calendar, DollarSign, Sparkles,
  Snowflake, Archive, Trash2, Edit3, Save, Settings, ArrowLeft,
  Mail, Lightbulb, UserCircle, Lock, Heart, NotebookPen, Hammer, Leaf, LogOut, Download,
  Camera, Cloud, CloudOff, Loader2, Image as ImageIcon, UserPlus, CheckCircle,
  MapPin, CloudRain, Thermometer, Share2, Store
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import AuthModal from "./AuthModal.jsx";
import FarmhandModal from "./FarmhandModal.jsx";
import { supabase, isSupabaseConfigured } from "./supabase.js";
import {
  loadHomestead, saveHomestead, readLocalHomestead, clearLocalHomestead,
  uploadPhoto, getPhotoUrl, deletePhoto,
  sendFeedback, notifySignup, acceptInvite, deleteAccount,
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
    { id: "meat_chickens", name: "Meat Chickens", type: "meat_chickens", icon: "drumstick", currentBatch: null, archivedBatches: [] },
    { id: "rabbits", name: "Rabbits 🐇 (Beta)", type: "rabbits", icon: "rabbit", hutches: [], hidden: true },
    { id: "bees", name: "Beekeeping 🐝 (Beta)", type: "bees", icon: "bee", hives: [], hidden: true },
    { id: "incubator", name: "Incubator 🥚", type: "incubator", icon: "egg", runs: [], hidden: true },
    { id: "goats", name: "Goats 🐐", type: "goats", icon: "sprout", animals: [], hidden: true },
    { id: "cows", name: "Cows 🐄", type: "cows", icon: "sprout", animals: [], hidden: true },
    { id: "pigs", name: "Pigs 🐷", type: "pigs", icon: "sprout", animals: [], hidden: true },
    { id: "sheep", name: "Sheep 🐑", type: "sheep", icon: "sprout", animals: [], breedings: [], shearings: [], subType: "mixed", hidden: true },
    { id: "horses", name: "Horses 🐴", type: "horses", icon: "sprout", animals: [], breedings: [], farrier: [], vet: [], deworming: [], rides: [], hidden: true },
    { id: "sourdough", name: "Sourdough 🍞", type: "sourdough", icon: "sprout", starters: [], bakes: [], hidden: true },
    { id: "farmstand", name: "Farmstand 🧾", type: "farmstand", icon: "store", items: [], hidden: true },
  ],
  entries: {}, // { hobbyId: [entries] }
  plantings: [], // garden plantings to track
  butchered: [], // butcher events for current batch
  calendarEvents: [], // user-created calendar events { id, date, title, type, notes, cropId? }
  tutorialDismissed: false, // true after user completes or skips tutorial
  lastSeenVersion: 0,        // tracks what's new popup
  salesHidden: false,        // true if user hides the Sales tab
  spouseMode: false,         // true = dark mode + fudged costs/production for "spouse presentation"
  sales: [],            // unified sales log
  customers: [],        // repeat buyer directory
  freezerLog: [],       // universal butcher records: { id, date, hobbyId, flockId, flockName, birdType, count, avgWeight, note }
  supportersDismissedMonth: null, // "YYYY-MM" of last dismissed monthly thank-you
  appStoreFundDismissedMonth: null, // "YYYY-MM" of last dismissed app-store-fundraiser popup
  userHasTipped: false, // set true after a Stripe checkout completes (manual flag user can mark themselves)
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
  if (typeof data.userHasTipped !== "boolean") {
    data.userHasTipped = false;
  }

  // Migrate legacy sold_eggs entries from egg_layers entries into data.sales
  const eggLayerEntries = data.entries["egg_layers"] || [];
  const existingSaleIds = new Set((data.sales || []).map(s => s.id));
  eggLayerEntries.forEach(e => {
    if (e.action === "sold_eggs" && !existingSaleIds.has(e.id)) {
      const qty = Number(e.count) || 0;
      const pricePerDozen = Number(e.pricePerDozen) || 0;
      const revenue = (qty / 12) * pricePerDozen;
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
      if (typeof h.hidden === "undefined") h.hidden = true;
    }
    if (h.type === "meat_chickens") {
      if (!("currentBatch" in h)) h.currentBatch = null;
      if (!Array.isArray(h.archivedBatches)) h.archivedBatches = [];
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
    data.hobbies.push({ id: "rabbits", name: "Rabbits 🐇 (Beta)", type: "rabbits", icon: "rabbit", hutches: [], hidden: true });
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
    if (h.type === "incubator") { if (!Array.isArray(h.runs)) h.runs = []; }
  });
  const gardenHobby = data.hobbies.find(h => h.type === "garden");
  if (gardenHobby && !Array.isArray(gardenHobby.perennials)) gardenHobby.perennials = [];
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
  const flockScopedActions = ["fed","bedding","death","eggs","eggs_laid","sold_eggs","note","issue"];
  if (eggLayersHobby && Array.isArray(eggLayersHobby.flocks) && eggLayersHobby.flocks.length > 0) {
    const defaultFlockId = eggLayersHobby.flocks[0].id;
    const eggLayerEntries = data.entries[eggLayersHobby.id] || [];
    eggLayerEntries.forEach(e => {
      if (!e.flockId && flockScopedActions.includes(e.action)) {
        e.flockId = defaultFlockId;
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
function exportAllAsCsv(data) {
  // Collect all entries into one flat array, with hobby info attached.
  const rows = [];
  const hobbies = data.hobbies || [];

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

  // Sort newest first
  rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // Define columns. Order matters — most useful first.
  const columns = [
    "date", "hobbyName", "action", "count", "quantity", "unit", "plant",
    "lbs", "gallons", "cost", "pricePerDozen", "avgWeight", "cuft",
    "item", "cause", "issueType", "detail", "note",
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
const parseLocalDate = (s) => {
  if (!s || typeof s !== "string") return new Date();
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const fmtDate = (s) => {
  if (!s) return "";
  const d = parseLocalDate(s);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

const newId = () => Math.random().toString(36).slice(2, 10);

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
// ============================================================================
const APP_STORE_FUND_GOAL = 200;
const APP_STORE_FUND_RAISED = 0; // Update manually as Stripe tips come in. Keep this <= GOAL.

const CURRENT_VERSION = 13;

const WHATS_NEW = [
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

const getSeason = (dateStr) => {
  const d = parseLocalDate(dateStr);
  const m = d.getMonth();
  const y = d.getFullYear();
  if (getCurrentHemisphere() === "south") {
    // Southern hemisphere: months are 6 apart from northern.
    // Sep-Nov = Spring, Dec-Feb = Summer, Mar-May = Fall, Jun-Aug = Winter.
    if (m >= 8 && m <= 10) return `Spring ${y}`;
    if (m === 11) return `Summer ${y + 1}`; // Dec → next year's summer
    if (m >= 0 && m <= 1) return `Summer ${y}`; // Jan-Feb
    if (m >= 2 && m <= 4) return `Fall ${y}`;
    return `Winter ${y}`;
  }
  // Northern hemisphere (default)
  if (m >= 2 && m <= 4) return `Spring ${y}`;
  if (m >= 5 && m <= 7) return `Summer ${y}`;
  if (m >= 8 && m <= 10) return `Fall ${y}`;
  return `Winter ${y}`;
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
        display: "flex", alignItems: "center", gap: 4,
        padding: "4px 8px", borderRadius: 6,
        background: palette.bgAlt, color,
        fontSize: 11, fontWeight: 600,
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
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // "owner" | "member" | null
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured); // if Supabase isn't configured, "ready" immediately

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
    whatsNewShownRef.current = true;
    const timer = setTimeout(() => setShowWhatsNew(true), 1500);
    return () => clearTimeout(timer);
  }, [data?.onboardedAt, data?.lastSeenVersion]);

  // ---- Monthly supporter thank-you ----
  // Shows once on the 9th-11th of each month if the user hasn't dismissed it yet
  // for this calendar month. Tracked in data.supportersDismissedMonth ("YYYY-MM").
  // 3-day window so users who don't open the app on the 9th still see it.
  const supporterThanksShownRef = React.useRef(false);
  useEffect(() => {
    if (supporterThanksShownRef.current) return;
    if (!data?.onboardedAt) return;
    const now = new Date();
    const dayOfMonth = now.getDate();
    if (dayOfMonth < 9 || dayOfMonth > 11) return; // only show 9th-11th of the month
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (data?.supportersDismissedMonth === monthKey) return;
    supporterThanksShownRef.current = true;
    const timer = setTimeout(() => setShowSupporterThanks(true), 2200);
    return () => clearTimeout(timer);
  }, [data?.onboardedAt, data?.supportersDismissedMonth]);

  // ---- App Store fundraiser popup ----
  // Fires once per calendar month for users who haven't tipped yet and haven't
  // dismissed it for the current month. Shows on a 4s delay to let the page
  // settle in. Tracked in data.appStoreFundDismissedMonth ("YYYY-MM") and
  // data.userHasTipped (boolean). We don't fire on the same days as the monthly
  // supporter thank-you (9th-11th) so users don't get hit with two popups.
  const [showAppStoreFund, setShowAppStoreFund] = useState(false);
  const appStoreFundShownRef = React.useRef(false);
  useEffect(() => {
    if (appStoreFundShownRef.current) return;
    if (!data?.onboardedAt) return;
    if (data?.userHasTipped) return;
    const now = new Date();
    const dayOfMonth = now.getDate();
    // Fire 21st-23rd of each month — separate from monthly thank-you (9th-11th)
    // so users never get hit with two donation popups in the same week.
    if (dayOfMonth < 21 || dayOfMonth > 23) return;
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (data?.appStoreFundDismissedMonth === monthKey) return;
    appStoreFundShownRef.current = true;
    const timer = setTimeout(() => setShowAppStoreFund(true), 4000);
    return () => clearTimeout(timer);
  }, [data?.onboardedAt, data?.appStoreFundDismissedMonth, data?.userHasTipped]);

  // ---- Sync user units (currency, temperature, hemisphere) to the module-level
  // formatters whenever data.units or homestead location changes. fmtMoney() and
  // fmtTemp() are called from many components and read these globals.
  useEffect(() => {
    setUserUnits(data?.units, data?.homesteadLocation);
  }, [data?.units?.currency, data?.units?.temperature, data?.units?.hemisphere, data?.homesteadLocation?.lat]);

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
      const hobbyPages = ["rabbits", "bees", "incubator", "goats", "cows", "pigs", "sheep", "horses", "sourdough", "farmstand"];
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
      setUser(session?.user || null);
      setAuthReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

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
  useEffect(() => {
    if (!data) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSyncStatus("saving");
    saveTimerRef.current = setTimeout(async () => {
      const result = await saveHomestead(user, data);
      setSyncStatus((result.ok || result.skipped) ? "saved" : "error");
      // After "saved" briefly shows, fade back to "idle"
      if (result.ok) {
        setTimeout(() => setSyncStatus((s) => (s === "saved" ? "idle" : s)), 1500);
      }
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [data, user]);

  const update = (mutator) => {
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

  const hobby = data.hobbies.find((h) => h.id === (activeHobby === "rabbits" && page !== "rabbits" && page !== "analytics" ? "garden" : activeHobby));
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
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap');
        body { margin: 0; }
        input, select, textarea { font-family: ${FONT_BODY}; }
        input:focus, select:focus, textarea:focus { outline: 2px solid ${palette.accent}; outline-offset: -1px; }
        button { font-family: ${FONT_BODY}; }
        .tile:hover { background: ${palette.bgAlt} !important; }
      `}</style>

      {signedOutRemotely && (
        <div
          onClick={() => setModal({ type: "auth" })}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
            background: "#C84B31", color: "#FAF5EA",
            padding: "12px 20px",
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
      {showAppStoreFund && !showWhatsNew && !showSupporterThanks && (
        <AppStoreFundModal
          onClose={() => {
            setShowAppStoreFund(false);
            const now = new Date();
            const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            update(d => { d.appStoreFundDismissedMonth = monthKey; return d; });
          }}
          onLeaveTip={() => {
            setShowAppStoreFund(false);
            const now = new Date();
            const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            update(d => {
              d.appStoreFundDismissedMonth = monthKey;
              // Optimistically mark as tipped so we don't pester them again.
              // (User can untip in Settings if they didn't actually complete checkout.)
              d.userHasTipped = true;
              return d;
            });
          }}
        />
      )}

      {/* Tutorial prompt — shown once after onboarding */}
      {showTutorialPrompt && !showTutorial && (
        <TutorialPrompt
          onStart={() => { setShowTutorialPrompt(false); setShowTutorial(true); }}
          onSkip={() => {
            setShowTutorialPrompt(false);
            update((d) => { d.tutorialDismissed = true; return d; });
          }}
        />
      )}

      {/* Tutorial modal */}
      {showTutorial && (
        <TutorialModal onClose={() => {
          setShowTutorial(false);
          update((d) => { d.tutorialDismissed = true; return d; });
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
            <button
              onClick={() => setModal({ type: "barn" })}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: palette.ink }}
              title="Your homestead"
              aria-label="Your homestead"
            >
              <BarnIcon size={22} />
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
        {page !== "sales" && page !== "year" && page !== "calendar" && (
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
              {hobby.name}
            </span>
            <ChevronDown size={18} style={{ transform: hobbyMenuOpen ? "rotate(180deg)" : "", transition: "transform 0.2s" }} />
          </button>
          {hobbyMenuOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
              background: palette.card, border: `1.5px solid ${palette.ink}`,
              borderRadius: 10, zIndex: 60, overflow: "hidden",
              boxShadow: "3px 4px 0 " + palette.line,
            }}>
              {data.hobbies.filter((h) => !h.hidden).map((h) => (
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
          <HomePage hobby={hobby} data={data} update={update} setModal={setModal} />
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
        {page === "analytics" && activeHobby === "horses" && (
          <AnalyticsShareWrapper hobby={data.hobbies.find(h=>h.id==="horses")} entries={[]} data={data}>
            <HorsesAnalytics hobby={data.hobbies.find(h=>h.id==="horses")} sales={data.sales || []} />
          </AnalyticsShareWrapper>
        )}
        {page === "analytics" && activeHobby === "sourdough" && (
          <AnalyticsShareWrapper hobby={data.hobbies.find(h=>h.id==="sourdough")} entries={[]} data={data}>
            <SourdoughAnalytics hobby={data.hobbies.find(h=>h.id==="sourdough")} sales={data.sales || []} />
          </AnalyticsShareWrapper>
        )}
        {page === "analytics" && activeHobby === "farmstand" && (
          <AnalyticsShareWrapper hobby={data.hobbies.find(h=>h.id==="farmstand")} entries={[]} data={data}>
            <FarmstandAnalytics hobby={data.hobbies.find(h=>h.id==="farmstand")} sales={data.sales || []} spouseMode={data.spouseMode} />
          </AnalyticsShareWrapper>
        )}
        {page === "analytics" && activeHobby !== "rabbits" && activeHobby !== "bees" && activeHobby !== "incubator" && activeHobby !== "goats" && activeHobby !== "cows" && activeHobby !== "pigs" && activeHobby !== "sheep" && activeHobby !== "horses" && activeHobby !== "sourdough" && activeHobby !== "farmstand" && (
          <AnalyticsPage hobby={hobby} data={data} seasonFilter={seasonFilter} setSeasonFilter={setSeasonFilter} spouseMode={data.spouseMode} />
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
        {page === "sheep" && (
          <SheepPage hobby={data.hobbies.find(h=>h.id==="sheep")} data={data} update={update} setModal={setModal} />
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
        <NavTab active={page === "home" || page === "rabbits" || page === "bees" || page === "incubator" || page === "goats" || page === "cows" || page === "pigs" || page === "sheep" || page === "horses" || page === "sourdough" || page === "farmstand"} onClick={() => { if (activeHobby === "rabbits") setPage("rabbits"); else if (activeHobby === "bees") setPage("bees"); else if (activeHobby === "incubator") setPage("incubator"); else if (activeHobby === "goats") setPage("goats"); else if (activeHobby === "cows") setPage("cows"); else if (activeHobby === "pigs") setPage("pigs"); else if (activeHobby === "sheep") setPage("sheep"); else if (activeHobby === "horses") setPage("horses"); else if (activeHobby === "sourdough") setPage("sourdough"); else if (activeHobby === "farmstand") setPage("farmstand"); else setPage("home"); }} icon={Home} label="Home" />
        <NavTab active={page === "analytics"} onClick={() => setPage("analytics")} icon={BarChart3} label="Stats" />
        <NavTab active={page === "calendar"} onClick={() => setPage("calendar")} icon={Calendar} label="Calendar" />
        {!data.salesHidden && <NavTab active={page === "sales"} onClick={() => setPage("sales")} icon={DollarSign} label="Sales" />}
        <NavTab active={page === "year"} onClick={() => setPage("year")} icon={Sparkles} label="Year" />
      </nav>

      {/* MODALS */}
      <ModalRouter modal={modal} setModal={setModal} data={data} update={update} activeHobby={activeHobby} user={user} role={role} setActiveHobby={setActiveHobby} setPage={setPage} />
    </div>
  );
}

// ============ HOME PAGE ============
function HomePage({ hobby, data, update, setModal }) {
  const entries = data.entries[hobby.id] || [];
  const recent = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created).slice(0, 8);

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
                  return d;
                });
              }}
            />
          ))}
        </div>
      )}
    </div>
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
        <Tile icon={Sprout} label="Planted" color={palette.leaf} onClick={() => setModal({ type: "log", action: "planted" })} />
        <Tile icon={Scissors} label="Harvested" color={palette.accent} onClick={() => setModal({ type: "log", action: "harvested" })} />
        <Tile icon={AlertTriangle} label="Report Issue" color={palette.yolk} onClick={() => setModal({ type: "log", action: "issue" })} />
        <Tile icon={NotebookPen} label="Note" color={palette.feather} onClick={() => setModal({ type: "log", action: "note" })} />
        <Tile icon={Leaf} label="Close Season" color={palette.ink} onClick={() => setModal({ type: "closeGardenSeason" })} />
      </div>
    );
  }
  if (hobby.type === "egg_layers") {
    return (
      <div style={grid}>
        <Tile icon={Sun} label="Fed" color={palette.feather} onClick={() => setModal({ type: "log", action: "fed" })} />
        <Tile icon={Droplet} label="Watered" color="#3F7CAC" onClick={() => setModal({ type: "log", action: "watered" })} />
        <Tile icon={Bird} label="Free Range" color={palette.leaf} onClick={() => setModal({ type: "log", action: "free_range" })} />
        <Tile icon={Egg} label="Eggs Laid" color={palette.yolk} onClick={() => setModal({ type: "log", action: "eggs" })} />
        <Tile icon={DollarSign} label="Sold Eggs" color={palette.accent} onClick={() => setModal({ type: "log", action: "sold_eggs" })} />
        <Tile icon={Archive} label="Bedding" color={palette.featherSoft} onClick={() => setModal({ type: "log", action: "bedding" })} />
        <Tile icon={Skull} label="Report Death" color={palette.accent} onClick={() => setModal({ type: "log", action: "death" })} />
        <Tile icon={Hammer} label="Infrastructure" color={palette.feather} onClick={() => setModal({ type: "log", action: "infrastructure" })} />
        <Tile icon={NotebookPen} label="Note" color={palette.inkSoft} onClick={() => setModal({ type: "log", action: "note" })} />
        <Tile icon={Plus} label="Add Flock" color={palette.ink} onClick={() => setModal({ type: "addFlock", hobbyId: hobby.id })} />
      </div>
    );
  }
  if (hobby.type === "meat_chickens") {
    // Disable actions until a batch is started (the Summary card has the Hatch CTA)
    if (!hobby.currentBatch) {
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

  if (hobby.type === "meat_chickens" && hobby.currentBatch) {
    const batch = hobby.currentBatch;
    const startDate = batch.startDate ? new Date(batch.startDate + "T12:00") : null;
    if (startDate) {
      const ageWeeks = Math.floor((today.getTime() - startDate.getTime()) / (7 * dayMs));
      if (ageWeeks >= 7 && ageWeeks <= 9) {
        nudges.push({
          icon: "🍗",
          text: `Birds are ${ageWeeks} weeks old`,
          sub: "Cornish Cross typically butcher around 7-8 weeks",
          action: () => setModal({ type: "hatchBatch" }),
          actionLabel: "Send to freezer camp",
        });
      } else if (ageWeeks > 9) {
        nudges.push({
          icon: "🍗",
          text: `Birds are ${ageWeeks} weeks old — past typical butcher age`,
          sub: "Each extra week means more feed cost",
          action: () => setModal({ type: "hatchBatch" }),
          actionLabel: "Send to freezer camp",
        });
      }
    }
    // Feed
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

// ============ HOBBY SUMMARIES ============
function GardenSummary({ hobby, data, update, setModal }) {
  // Track which perennial is currently in "confirm delete?" state, so we can
  // replace the native window.confirm() dialog with inline UI (mobile-friendly).
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
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
  const hasMap = season.gardenMap && season.gardenMap.photoPath;
  const pinCount = hasMap ? (season.gardenMap.pins || []).length : 0;
  return (
    <div>
      {/* Perennials section */}
      {perennials.length > 0 && (
        <div style={{ background:palette.card,border:`1.5px solid ${palette.line}`,borderRadius:12,padding:14,marginBottom:14 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
            <div style={{ fontFamily:FONT_DISPLAY,fontSize:18,color:palette.ink }}>🌳 Perennials</div>
            <button onClick={() => setModal({ type:"addPerennial",hobbyId:hobby.id })} style={{ background:"none",border:`1.5px dashed ${palette.line}`,borderRadius:8,padding:"4px 10px",fontSize:12,color:palette.inkSoft,cursor:"pointer",fontFamily:FONT_BODY }}>+ Add</button>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {perennials.map(p => (
              <div key={p.id} style={{ display:"flex",alignItems:"flex-start",gap:8,padding:"8px 10px",background:palette.bgAlt,borderRadius:8 }}>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontWeight:600,fontSize:13,color:palette.ink }}>{p.name}{p.variety ? ` — ${p.variety}` : ""}</div>
                  <div style={{ fontSize:11,color:palette.inkSoft }}>Planted {p.plantDate||"unknown"}{p.totalHarvest ? ` · ${p.totalHarvest} lbs harvested` : ""}</div>
                  {p.harvests && p.harvests.length > 0 && (
                    <div style={{ marginTop:4,display:"flex",flexDirection:"column",gap:2 }}>
                      {[...p.harvests].reverse().slice(0,3).map(h => (
                        <div key={h.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,color:palette.inkSoft,gap:6 }}>
                          <span>{h.date} · {h.qty} {h.unit}</span>
                          <button onClick={() => update(d => {
                            const hob = d.hobbies.find(x => x.id === hobby.id);
                            if (!hob) return d;
                            const per = (hob.perennials||[]).find(x => x.id === p.id);
                            if (!per) return d;
                            const removed = per.harvests.find(x => x.id === h.id);
                            per.harvests = per.harvests.filter(x => x.id !== h.id);
                            if (removed && h.unit === "lbs") per.totalHarvest = Math.max(0,(per.totalHarvest||0)-(removed.qty||0));
                            return d;
                          })} aria-label="Remove harvest" style={{ background:"none",border:"none",cursor:"pointer",color:palette.accent,fontSize:11,padding:"0 2px",lineHeight:1 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display:"flex",gap:5,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end" }}>
                  <button onClick={() => setModal({ type:"logPerennialHarvest",hobbyId:hobby.id,perennialId:p.id })} style={{ background:palette.leaf,border:"none",borderRadius:6,padding:"4px 8px",fontSize:11,color:"#fff",cursor:"pointer",fontFamily:FONT_BODY,fontWeight:600,whiteSpace:"nowrap" }}>Log harvest</button>
                  <button onClick={() => setModal({ type:"editPerennial",hobbyId:hobby.id,perennialId:p.id })} style={{ background:"none",border:`1.5px solid ${palette.line}`,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer",color:palette.inkSoft,fontFamily:FONT_BODY }}>Edit</button>
                  {confirmDeleteId === p.id ? (
                    <>
                      <button
                        onClick={() => {
                          update(d => { const h=d.hobbies.find(x=>x.id===hobby.id); if(h) h.perennials=(h.perennials||[]).filter(x=>x.id!==p.id); return d; });
                          setConfirmDeleteId(null);
                        }}
                        style={{ background:palette.accent,border:"none",borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer",color:palette.bg,fontFamily:FONT_BODY,fontWeight:600 }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        style={{ background:"none",border:`1.5px solid ${palette.line}`,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer",color:palette.inkSoft,fontFamily:FONT_BODY }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(p.id)} style={{ background:"none",border:`1.5px solid ${palette.line}`,borderRadius:6,padding:"4px 8px",fontSize:11,cursor:"pointer",color:palette.accent,fontFamily:FONT_BODY }}>Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {perennials.length === 0 && (
        <button onClick={() => setModal({ type:"addPerennial",hobbyId:hobby.id })} style={{ width:"100%",marginBottom:14,padding:"10px",background:"transparent",border:`1.5px dashed ${palette.line}`,borderRadius:10,cursor:"pointer",fontSize:13,color:palette.inkSoft,fontFamily:FONT_BODY }}>
          🌳 Track perennials (fruit trees, asparagus, berry bushes...)
        </button>
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
  const birdEmoji = { Chicken: "🐔", Duck: "🦆", Turkey: "🦃", Quail: "🐦", Goose: "🪿", Guinea: "🐦", Other: "🐣" };

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
            <span style={{ fontSize: 11, color: palette.inkSoft, background: palette.card, padding: "2px 8px", borderRadius: 4 }}>{flock.birdType} · {flock.birdCount} birds</span>
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
    </div>
  );
}

function MeatChickensSummary({ hobby, entries, update, setModal }) {
  if (!hobby.currentBatch) {
    return (
      <div style={{
        background: palette.card, border: `2px dashed ${palette.ink}`, borderRadius: 12,
        padding: 24, textAlign: "center",
      }}>
        <Bird size={32} color={palette.ink} strokeWidth={1.5} style={{ marginBottom: 10 }} />
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, marginBottom: 6 }}>No active batch</div>
        <div style={{ color: palette.inkSoft, marginBottom: 14, fontSize: 14 }}>
          Start a new batch when your chicks arrive.
        </div>
        <Btn variant="accent" onClick={() => setModal({ type: "hatchBatch" })}>
          🐣 Hatch new batch
        </Btn>
      </div>
    );
  }
  const batch = hobby.currentBatch;
  const days = Math.floor((Date.now() - new Date(batch.startDate).getTime()) / (1000 * 60 * 60 * 24));
  const weeks = (days / 7).toFixed(1);
  const deaths = entries
    .filter((e) => e.action === "death" && e.batchId === batch.id)
    .reduce((s, e) => s + (Number(e.count) || 1), 0);
  const alive = batch.startCount - deaths;
  return (
    <div>
      <div
        onClick={() => setModal({ type: "editBatch", hobbyId: hobby.id })}
        style={{
          background: palette.ink, color: palette.bg, borderRadius: 12, padding: 14,
          marginBottom: 10, cursor: "pointer",
        }}
      >
        <div style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Active Batch · {batch.name}</span>
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
  };
  const icons = {
    watered: Droplet, planted: Sprout, harvested: Scissors, issue: AlertTriangle,
    fed: Sun, free_range: Bird, eggs: Egg, eggs_laid: Egg, bedding: Archive, death: Skull,
    butcher: Snowflake, note: NotebookPen, sold_eggs: DollarSign, infrastructure: Hammer,
  };
  const Icon = icons[entry.action] || Edit3;
  let detail = "";
  switch (entry.action) {
    case "watered": detail = entry.gallons ? `${entry.gallons} gal` : (entry.amount || ""); break;
    case "planted": detail = `${entry.plant || ""} ${entry.quantity ? "× " + entry.quantity : ""}`.trim(); break;
    case "harvested": detail = `${entry.plant || ""} · ${entry.quantity || 0} ${entry.unit || "lbs"}`; break;
    case "fed": detail = `${entry.lbs || 0} lbs · ${fmtMoney(entry.cost)}`; break;
    case "eggs": detail = `${entry.count || 0} eggs`; break;
    case "eggs_laid": detail = `${entry.count || 0} eggs`; break;
    case "sold_eggs": {
      const dozens = (Number(entry.count) || 0) / 12;
      const revenue = dozens * (Number(entry.pricePerDozen) || 0);
      detail = `${entry.count || 0} eggs · ${fmtMoney(revenue)} @ ${fmtMoney(entry.pricePerDozen)}/dz`;
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
    case "butcher": detail = `${entry.count || 0} birds · avg ${entry.avgWeight || 0} lbs`; break;
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
function AnalyticsPage({ hobby, data, seasonFilter, setSeasonFilter, spouseMode }) {
  const [showShare, setShowShare] = useState(false);
  // Defensive: hobby may be undefined for one render frame during transitions
  if (!hobby) return <EmptyState text="Loading…" />;
  // Garden uses explicit seasons; other hobbies use date-derived seasons
  if (hobby.type === "garden") {
    return <GardenAnalyticsPage hobby={hobby} data={data} seasonFilter={seasonFilter} setSeasonFilter={setSeasonFilter} spouseMode={spouseMode} />;
  }

  let entries = data.entries[hobby.id] || [];
  const allSeasons = Array.from(new Set(entries.map((e) => getSeason(e.date)))).sort();

  if (seasonFilter !== "all") {
    entries = entries.filter((e) => getSeason(e.date) === seasonFilter);
  }

  return (
    <div>
      {showShare && <ShareStatsModal hobby={hobby} allEntries={data.entries[hobby.id] || []} data={data} onClose={() => setShowShare(false)} />}
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
            <Btn key={s} small variant={seasonFilter === s ? "primary" : "ghost"} onClick={() => setSeasonFilter(s)}>
              {s}
            </Btn>
          ))}
        </div>
      </div>

      {hobby.type === "egg_layers" && <EggLayersAnalytics hobby={hobby} entries={entries} spouseMode={spouseMode} />}
      {hobby.type === "meat_chickens" && <MeatChickensAnalytics hobby={hobby} entries={entries} seasonFilter={seasonFilter} spouseMode={spouseMode} />}
    </div>
  );
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
              const birdEmoji = { Chicken:"🐔", Duck:"🦆", Turkey:"🦃", Quail:"🐦", Goose:"🪿", Guinea:"🐦", Other:"🐣" };
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

function MeatChickensAnalytics({ hobby, entries, seasonFilter, spouseMode }) {
  // Defensive: hobby may be undefined for one render frame during hobby
  // transitions (e.g. switching activeHobby while still on the analytics tab).
  if (!hobby) return <EmptyState text="Loading…" />;

  // Combine current batch (in-progress) + archived batches
  const currentBatch = hobby.currentBatch;
  const archived = hobby.archivedBatches || [];

  // For all-time: show summary across all batches (archived + active)
  // For seasonal filter: filter batches whose start date falls in that season
  let batches = [...archived];
  if (currentBatch) batches.push({
    ...currentBatch,
    isActive: true,
    butchered: currentBatch.butchered || [],
    finalEntries: entries.filter(e => e.batchId === currentBatch.id),
  });

  if (seasonFilter !== "all") {
    batches = batches.filter((b) => getSeason(b.startDate) === seasonFilter);
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
          const days = (new Date(e.date) - new Date(b.startDate)) / (1000 * 60 * 60 * 24);
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

  // Feed Conversion Ratio: lbs feed consumed / lbs meat produced
  let totalFeedLbs = 0;
  batches.forEach(b => {
    const bEntries = entries.filter(e => e.batchId === b.id && e.action === "fed");
    totalFeedLbs += bEntries.reduce((s, e) => s + (Number(e.lbs)||0), 0);
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

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Total Birds Started" value={totalStart} accent={palette.feather} />
        <StatCard label="Total Butchered" value={adjButchered} accent={palette.ink} />
        <StatCard label="Mortality Rate" value={`${mortalityRate}%`} sub={`${totalDeaths} deaths`} accent={palette.accent} />
        <StatCard label="Avg Final Weight" value={`${avgWeight} lbs`} accent={palette.leaf} />
        {fcr !== "—" && <StatCard label="Feed Conversion (FCR)" value={fcr} sub="lbs feed per lb meat" accent={palette.feather} />}
        <StatCard label="Cost / Bird" value={typeof costPerBird === "string" ? costPerBird : fmtMoney(costPerBird)} sub="all-in" accent={palette.yolk} />
        <StatCard label="Total Cost" value={fmtMoney(totalCost)} sub={`feed ${fmtMoney(adjFeedCost)}${adjInfraCost > 0 ? " + infra " + fmtMoney(adjInfraCost) : ""}`} accent={palette.feather} />
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

      <ChartCard title={`Batches ${seasonFilter === "all" ? "(all-time)" : "(" + seasonFilter + ")"}`}>
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
      if (hobby.currentBatch) {
        const photos = expandPhotos(allEntries.filter((e) => e.batchId === hobby.currentBatch.id));
        if (photos.length > 0) {
          groups.push({
            id: hobby.currentBatch.id,
            label: `${hobby.currentBatch.name} (active)`,
            photos,
            dateForSort: hobby.currentBatch.startDate,
            active: true,
          });
        }
      }
      groups.sort((a, b) => (b.dateForSort || "").localeCompare(a.dateForSort || ""));
      return { hobby, groups };
    }

    // Other hobbies (egg layers, custom): group by date-derived season.
    const photosFlat = expandPhotos(allEntries);
    const bySeason = {};
    photosFlat.forEach((p) => {
      const s = getSeason(p.date);
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
function ModalRouter({ modal, setModal, data, update, activeHobby, user, role, setActiveHobby, setPage }) {
  const close = () => setModal(null);
  if (!modal) return null;

  const hobby = data.hobbies.find((h) => h.id === (activeHobby === "rabbits" && page !== "rabbits" && page !== "analytics" ? "garden" : activeHobby));

  if (modal.type === "settings") return <SettingsModal data={data} update={update} onClose={close} setModal={setModal} user={user} />;
  if (modal.type === "barn") return <BarnModal data={data} update={update} onClose={close} setModal={setModal} user={user} role={role} />;
  if (modal.type === "about") return <AboutModal onClose={close} />;
  if (modal.type === "support") return <SupportModal onClose={close} />;
  if (modal.type === "renameHomestead") return <RenameHomesteadModal data={data} update={update} onClose={close} />;
  if (modal.type === "feedback") return <FeedbackModal onClose={close} presetCategory={modal.presetCategory} user={user} />;
  if (modal.type === "signin") return <AuthModal onClose={close} initialMode="signin" />;
  if (modal.type === "signup") return <AuthModal onClose={close} initialMode="signup" />;
  if (modal.type === "firstSignIn") return <FirstSignInModal user={user} localData={modal.localData} onClose={close} />;
  if (modal.type === "addHobby") return <AddHobbyModal update={update} onClose={close} />;
  if (modal.type === "manageHobbies") return <ManageHobbiesModal data={data} update={update} onClose={close} setActiveHobby={setActiveHobby} setPage={setPage} setModal={setModal} />
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
  if (modal.type === "butcherFlock") {
    const targetHobby = data.hobbies.find(h => h.id === modal.hobbyId);
    if (!targetHobby) { close(); return null; }
    const targetFlock = (targetHobby.flocks || []).find(f => f.id === modal.flockId);
    if (!targetFlock) { close(); return null; }
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
    return <AddPerennialModal hobbyId={modal.hobbyId} update={update} onClose={close} />;
  }
  if (modal.type === "logPerennialHarvest") {
    const gardenHobby = data.hobbies.find(h => h.type === "garden");
    if (!gardenHobby) { close(); return null; }
    const perennial = (gardenHobby.perennials||[]).find(p => p.id === modal.perennialId);
    if (!perennial) { close(); return null; }
    return <LogPerennialHarvestModal hobbyId={modal.hobbyId} perennial={perennial} update={update} onClose={close} />;
  }
  if (modal.type === "editBatch") {
    const targetHobby = data.hobbies.find((h) => h.id === modal.hobbyId);
    if (!targetHobby) { close(); return null; }
    return <EditBatchModal hobby={targetHobby} update={update} onClose={close} />;
  }
  if (modal.type === "butcher") return <ButcherModal hobby={hobby} entries={data.entries[activeHobby] || []} update={update} onClose={close} />;
  if (modal.type === "startGardenSeason") return <StartGardenSeasonModal hobby={hobby} update={update} onClose={close} />;
  if (modal.type === "closeGardenSeason") return <CloseGardenSeasonModal hobby={hobby} entries={data.entries[activeHobby] || []} update={update} onClose={close} />;
  if (modal.type === "log") return <LogModal hobby={hobby} action={modal.action} data={data} update={update} onClose={close} user={user} existingEntry={modal.existingEntry} />;
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

      <SectionBtn
        icon={NotebookPen}
        label="Blog"
        sub="Notes on homesteading, gardens & chickens"
        accent={palette.leaf}
        onClick={() => { window.location.href = "/blog/"; }}
      />

      <SectionBtn
        icon={Heart}
        label="Support Henalytics"
        sub="Tip jar to help cover hosting costs"
        accent={palette.yolk}
        onClick={() => { onClose(); setTimeout(() => setModal({ type: "support" }), 0); }}
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
    meat_chickens: "Meat Chickens",
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
      // The server has already deleted the auth row. Sign out locally to
      // clear the session token so the next page load shows the auth UI.
      try {
        if (supabase) await supabase.auth.signOut();
      } catch (e) {
        // Already deleted server-side, signOut will fail but that's fine
      }
      // Force a full page reload to clear all React state and start fresh.
      window.location.href = "/";
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
        <a
          href="https://henalytics.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, color: palette.inkSoft, textDecoration: "underline" }}
        >
          Privacy policy
        </a>
        <a
          href="https://henalytics.com/terms"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, color: palette.inkSoft, textDecoration: "underline" }}
        >
          Terms of service
        </a>
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
            Reset popup dismissal flags so What's New, the monthly supporter thank-you, and the App Store fundraiser re-fire on next page load. Only you can see this.
          </div>
          <Btn variant="ghost" small onClick={() => {
            update((d) => {
              d.lastSeenVersion = 0;
              d.supportersDismissedMonth = null;
              d.appStoreFundDismissedMonth = null;
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
          Henalytics is just me. No company, no investors, no ads. The site costs me about $10/year in domain fees and that's it. It will stay free.
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
  // Stripe Payment Links — Apple Pay / Google Pay show automatically on supported devices
  const STRIPE_ONE_TIME_URL = "https://buy.stripe.com/dRmdRbb3K2kWbDj2XK9MY00"; // $5 one-time
  const STRIPE_MONTHLY_URL = "https://buy.stripe.com/cNi9AV7Ry4t4cHnfKw9MY02"; // $5/month, qty adjustable

  // Ko-fi kept commented out as backup — flip back if Stripe doesn't work out
  // const KO_FI_URL = "https://ko-fi.com/henalytics";
  // const KO_FI_EMBED_URL = "https://ko-fi.com/henalytics/?hidefeed=true&widget=true&embed=true&preview=true";

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
          The site costs me about $10/year in domain fees, plus my time. There's no company behind it, no investors, no ads. Just me — a homesteader in Kansas — building it in the evenings.
        </p>

        <p>
          If Henalytics has been useful and you'd like to chip in a few dollars to help keep it running, I'd genuinely appreciate it. Even a few bucks goes a long way around here.
        </p>

        <p style={{ fontStyle: "italic", color: palette.inkSoft, fontSize: 13 }}>
          But please don't feel any pressure. The app is and will stay free for everyone, whether or not you chip in.
        </p>

        {/* Stripe Payment Link buttons — secure checkout with Apple Pay / Google Pay */}
        <div style={{
          marginTop: 20,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}>
          <a
            href={STRIPE_ONE_TIME_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: "1 1 140px",
              padding: "16px 14px",
              borderRadius: 12,
              border: `2px solid ${palette.ink}`,
              background: palette.yolk,
              color: palette.ink,
              textDecoration: "none",
              textAlign: "center",
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 15,
              boxShadow: "2px 2px 0 " + palette.line,
              display: "block",
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 4 }}>🌾</div>
            <div>One-time</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, marginTop: 2 }}>$5</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: palette.inkSoft, marginTop: 2 }}>Bag of feed</div>
          </a>
          <a
            href={STRIPE_MONTHLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: "1 1 140px",
              padding: "16px 14px",
              borderRadius: 12,
              border: `2px solid ${palette.ink}`,
              background: palette.leaf,
              color: palette.bg,
              textDecoration: "none",
              textAlign: "center",
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 15,
              boxShadow: "2px 2px 0 " + palette.line,
              display: "block",
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 4 }}>💚</div>
            <div>Monthly</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, marginTop: 2 }}>$5</div>
            <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>Sustaining tip</div>
          </a>
        </div>

        <div style={{
          marginTop: 12, textAlign: "center", fontSize: 12, color: palette.inkSoft, lineHeight: 1.5,
        }}>
          Secure checkout via Stripe — Apple Pay & Google Pay supported.
          <br/>
          You can adjust the amount on the next page.
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

function FirstSignInModal({ user, localData, onClose }) {
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
    // Tell the parent to refresh its state by signaling a reload via location refresh —
    // simplest, most reliable. (In practice this is rare and a reload is fine UX.)
    window.location.reload();
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

  const send = async () => {
    setError("");
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
      setError(e.message || "Could not send. Please try the fallback options below.");
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

      {error && (
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
            <a
              href={gmailHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 12px", borderRadius: 8, textDecoration: "none",
                fontSize: 12, fontWeight: 600,
                background: palette.ink, color: palette.bg,
                border: `1.5px solid ${palette.ink}`,
              }}
            >
              <Mail size={12} /> Open in Gmail
            </a>
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
          <option value="meat_chickens">Like Meat Chickens (seasonal batches)</option>
          <option value="custom">Custom (just notes)</option>
        </select>
      </Field>
      <Btn variant="primary" onClick={() => {
        if (!name.trim()) return;
        update((d) => {
          const id = name.toLowerCase().replace(/\s+/g, "_") + "_" + newId().slice(0, 4);
          const newHobby = { id, name: name.trim(), type, icon: "sprout" };
          if (type === "egg_layers") { newHobby.flockSize = 0; newHobby.flockHistory = []; }
          if (type === "meat_chickens") { newHobby.currentBatch = null; newHobby.archivedBatches = []; }
          d.hobbies.push(newHobby);
          return d;
        });
        onClose();
      }}>Add hobby</Btn>
    </Modal>
  );
}

function ManageHobbiesModal({ data, update, onClose, setActiveHobby, setPage, setModal }) {
  const friendlyType = { garden: "Garden", egg_layers: "Egg Layers", meat_chickens: "Meat Chickens", rabbits: "Rabbits", bees: "Beekeeping", incubator: "Incubator", goats: "Goats", cows: "Cows", pigs: "Pigs" };
  return (
    <Modal open onClose={onClose} title="Manage Hobbies">
      <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Toggle hobbies on or off. Hidden hobbies keep their data — they just won't show in the menu.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {data.hobbies.map(h => (
          <div key={h.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: palette.card, border: `1.5px solid ${palette.line}`, borderRadius: 10 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: palette.ink }}>{h.name}</div>
              <div style={{ fontSize: 11, color: palette.inkSoft }}>{friendlyType[h.type] || h.type}</div>
            </div>
            <button
              onClick={() => {
                update(d => { const hob = d.hobbies.find(x => x.id === h.id); if (hob) hob.hidden = !hob.hidden; return d; });
                if (h.hidden) {
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
                  else { setActiveHobby(h.id); if (page !== "analytics") setPage("home"); }
                  onClose();
                }
              }}
              style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${palette.line}`, background: h.hidden ? palette.ink : palette.bgAlt, color: h.hidden ? palette.bg : palette.inkSoft, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              {h.hidden ? "Enable" : "Visible ✓"}
            </button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, paddingTop: 12, borderTop: `1.5px solid ${palette.line}`, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 11, color: palette.inkSoft, textAlign: "center" }}>Go to Settings to toggle visibility anytime.</div>
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

function AddFlockModal({ hobbyId, update, onClose }) {
  const BIRD_TYPES = ["Chicken", "Duck", "Turkey", "Quail", "Goose", "Guinea", "Other"];
  const [name, setName] = useState("");
  const [birdType, setBirdType] = useState("Chicken");
  const [count, setCount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [cost, setCost] = useState("");
  const [purchasedFrom, setPurchasedFrom] = useState("");
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
      <Field label="How many birds?">
        <input type="number" style={inputStyle} value={count} onChange={(e) => setCount(e.target.value)} placeholder="0" />
      </Field>
      <Field label="Date acquired">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Cost (optional)">
        <input type="number" step="0.01" style={inputStyle} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="$" />
      </Field>
      <Field label="Where purchased (optional)">
        <input style={inputStyle} value={purchasedFrom} onChange={(e) => setPurchasedFrom(e.target.value)} placeholder="e.g. Murray McMurray, Tractor Supply, neighbor" />
      </Field>
      <Btn variant="primary" onClick={() => {
        const n = parseInt(count);
        if (!n || n < 1 || !name.trim()) return;
        update((d) => {
          const h = d.hobbies.find((x) => x.id === hobbyId);
          if (!h) return d;
          if (!Array.isArray(h.flocks)) h.flocks = [];
          h.flocks.push({ id: Math.random().toString(36).slice(2,10), name: name.trim(), birdType, birdCount: n, startDate: date, cost: parseFloat(cost) || 0, purchasedFrom: purchasedFrom.trim(), history: [{ date, count: n, cost: parseFloat(cost)||0, purchasedFrom: purchasedFrom.trim() }], eggBasket: null });
          return d;
        });
        onClose();
      }}>Add flock</Btn>
    </Modal>
  );
}

function EditFlockModal({ hobbyId, flockId, hobby, update, onClose, setModal }) {
  const BIRD_TYPES = ["Chicken", "Duck", "Turkey", "Quail", "Goose", "Guinea", "Other"];
  const flock = (hobby.flocks || []).find(f => f.id === flockId);
  const [name, setName] = useState(flock?.name || "");
  const [birdType, setBirdType] = useState(flock?.birdType || "Chicken");
  const [count, setCount] = useState(String(flock?.birdCount || 0));
  const [date, setDate] = useState(flock?.startDate || todayStr());
  const [cost, setCost] = useState(flock?.cost ? String(flock.cost) : "");
  const [purchasedFrom, setPurchasedFrom] = useState(flock?.purchasedFrom || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!flock) { onClose(); return null; }

  const save = () => {
    const n = parseInt(count);
    if (!n || n < 1 || !name.trim()) return;
    update((d) => {
      const h = d.hobbies.find(x => x.id === hobbyId);
      if (!h) return d;
      const fl = (h.flocks||[]).find(x=>x.id===flockId);
      if (fl) {
        fl.name = name.trim();
        fl.birdType = birdType;
        fl.birdCount = n;
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
      <Field label="Number of birds">
        <input type="number" style={inputStyle} value={count} onChange={e=>setCount(e.target.value)} />
      </Field>
      <Field label="Start date">
        <input type="date" style={inputStyle} value={date} onChange={e=>setDate(e.target.value)} />
      </Field>
      <Field label="Total cost (optional)">
        <input type="number" step="0.01" style={inputStyle} value={cost} onChange={e=>setCost(e.target.value)} placeholder="$" />
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
        <input type="number" style={inputStyle} value={count} onChange={(e) => setCount(e.target.value)} />
      </Field>
      <Field label="Date acquired">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Cost (optional)">
        <input type="number" step="0.01" style={inputStyle} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="$" />
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
function EditBatchModal({ hobby, update, onClose }) {
  const batch = hobby.currentBatch;
  if (!batch) {
    onClose();
    return null;
  }
  const [name, setName] = useState(batch.name || "");
  const [count, setCount] = useState(String(batch.startCount || 0));
  const [date, setDate] = useState(batch.startDate || todayStr());
  const [cost, setCost] = useState(batch.chickCost ? String(batch.chickCost) : "");

  const save = () => {
    const n = parseInt(count);
    if (!n || n < 1 || !name.trim()) return;
    update((d) => {
      const h = d.hobbies.find((x) => x.id === hobby.id);
      if (!h || !h.currentBatch) return d;
      h.currentBatch = {
        ...h.currentBatch,
        name: name.trim(),
        startDate: date,
        startCount: n,
        chickCost: parseFloat(cost) || 0,
      };
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Edit batch">
      <Field label="Batch name">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Number of chicks (started with)">
        <input type="number" style={inputStyle} value={count} onChange={(e) => setCount(e.target.value)} />
      </Field>
      <Field label="Start date">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Cost of chicks">
        <input type="number" step="0.01" style={inputStyle} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="$" />
      </Field>
      <Btn variant="primary" onClick={save}>Save changes</Btn>
    </Modal>
  );
}

function HatchBatchModal({ hobby, update, onClose }) {
  const [name, setName] = useState(`Batch ${(hobby.archivedBatches || []).length + 1}`);
  const [count, setCount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [cost, setCost] = useState("");
  return (
    <Modal open onClose={onClose} title="🐣 Hatch new batch">
      <Field label="Batch name">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Number of chicks">
        <input type="number" style={inputStyle} value={count} onChange={(e) => setCount(e.target.value)} />
      </Field>
      <Field label="Start date">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Cost of chicks (optional)">
        <input type="number" step="0.01" style={inputStyle} value={cost} onChange={(e) => setCost(e.target.value)} />
      </Field>
      <Btn variant="primary" onClick={() => {
        const n = parseInt(count);
        if (!n || n < 1 || !name.trim()) return;
        update((d) => {
          const h = d.hobbies.find((x) => x.id === hobby.id);
          h.currentBatch = {
            id: newId(),
            name: name.trim(),
            startDate: date,
            startCount: n,
            chickCost: parseFloat(cost) || 0,
          };
          return d;
        });
        onClose();
      }}>Start batch</Btn>
    </Modal>
  );
}

function ButcherModal({ hobby, entries, update, onClose }) {
  const [count, setCount] = useState("");
  const [avgWeight, setAvgWeight] = useState("");
  const [date, setDate] = useState(todayStr());
  const [showFinalize, setShowFinalize] = useState(false);
  const [validationError, setValidationError] = useState("");
  const batch = hobby.currentBatch;

  if (!batch) {
    return (
      <Modal open onClose={onClose} title="Butcher">
        <div>No active batch. Hatch one first.</div>
      </Modal>
    );
  }

  const deaths = entries
    .filter((e) => e.action === "death" && e.batchId === batch.id)
    .reduce((s, e) => s + (Number(e.count) || 1), 0);
  const previouslyButchered = (hobby.currentBatch.butchered || []).reduce((s, x) => s + (x.count || 0), 0);
  const remaining = batch.startCount - deaths - previouslyButchered;

  return (
    <Modal open onClose={onClose} title={showFinalize ? "Send to freezer camp?" : `Butcher · ${batch.name}`}>
      {!showFinalize ? (
        <>
          <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 12 }}>
            {remaining} birds remaining in this batch.
          </div>
          <Field label="Date">
            <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="How many butchered?">
            <input type="number" style={inputStyle} value={count} onChange={(e) => { setCount(e.target.value); setValidationError(""); }} placeholder="e.g. 25" />
          </Field>
          <Field label="Average weight (lbs)">
            <input type="number" step="0.01" style={inputStyle} value={avgWeight} onChange={(e) => { setAvgWeight(e.target.value); setValidationError(""); }} placeholder="e.g. 5.5" />
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn variant="primary" onClick={() => {
              const n = parseInt(count);
              const w = parseFloat(avgWeight);
              // Be explicit about what's missing so the user knows why the
              // button "doesn't work" — previously this was a silent fail.
              if (!count || isNaN(n) || n <= 0) {
                setValidationError("Enter the number of birds butchered (must be greater than 0).");
                return;
              }
              if (n > remaining) {
                setValidationError(`Can't butcher more than ${remaining} birds — that's all that's left in this batch.`);
                return;
              }
              if (!avgWeight || isNaN(w) || w <= 0) {
                setValidationError("Enter the average weight in pounds (must be greater than 0). If you haven't weighed yet, estimate or use 0.01 as a placeholder.");
                return;
              }
              update((d) => {
                const h = d.hobbies.find((x) => x.id === hobby.id);
                h.currentBatch.butchered = h.currentBatch.butchered || [];
                h.currentBatch.butchered.push({ date, count: n, avgWeight: w });
                d.entries[hobby.id] = d.entries[hobby.id] || [];
                d.entries[hobby.id].push({
                  id: newId(), date, action: "butcher", count: n, avgWeight: w,
                  batchId: batch.id, created: Date.now(),
                });
                return d;
              });
              setCount(""); setAvgWeight("");
              onClose();
            }}>Save butcher entry</Btn>
            <Btn variant="accent" onClick={() => setShowFinalize(true)}>❄️ Send to freezer camp</Btn>
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 16, padding: 12, background: palette.bgAlt, borderRadius: 8, fontSize: 14 }}>
            This will <strong>finalize {batch.name}</strong>, archive its data to analytics, and clear the dashboard so you can hatch a new batch.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="danger" onClick={() => {
              update((d) => {
                const h = d.hobbies.find((x) => x.id === hobby.id);
                const finalBatch = JSON.parse(JSON.stringify(h.currentBatch));
                finalBatch.endDate = todayStr();
                // attach all entries that belong to this batch
                finalBatch.finalEntries = (d.entries[hobby.id] || []).filter((e) => e.batchId === batch.id);
                h.archivedBatches = h.archivedBatches || [];
                h.archivedBatches.push(finalBatch);
                // remove batch entries from active log
                d.entries[hobby.id] = (d.entries[hobby.id] || []).filter((e) => e.batchId !== batch.id);
                h.currentBatch = null;
                return d;
              });
              onClose();
            }}>Yes, finalize batch</Btn>
            <Btn variant="ghost" onClick={() => setShowFinalize(false)}>Back</Btn>
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
  const [reason, setReason] = useState("butchered");
  const [count, setCount] = useState("");
  const [avgWeight, setAvgWeight] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [validationError, setValidationError] = useState("");

  const remaining = Number(flock.birdCount) || 0;

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
    <Modal open onClose={onClose} title={`Remove from ${flock.name}`}>
      <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 12 }}>
        {remaining} {flock.birdType?.toLowerCase() || "bird"}{remaining === 1 ? "" : "s"} in this flock.
      </div>

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
        <input type="number" style={inputStyle} value={count} onChange={(e) => { setCount(e.target.value); setValidationError(""); }} placeholder="0" />
      </Field>

      {/* Average weight only matters for butcher (freezer log) and is optional
          for everything else. Keep it accessible for sold-for-meat scenarios. */}
      {isButcher && (
        <Field label="Average weight (lbs)">
          <input type="number" step="0.01" style={inputStyle} value={avgWeight} onChange={(e) => { setAvgWeight(e.target.value); setValidationError(""); }} placeholder="0.0" />
        </Field>
      )}
      {!isButcher && (
        <Field label="Average weight (lbs, optional)">
          <input type="number" step="0.01" style={inputStyle} value={avgWeight} onChange={(e) => setAvgWeight(e.target.value)} placeholder="0.0" />
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
            const fl = (h.flocks || []).find((x) => x.id === flock.id);
            if (fl) fl.birdCount = Math.max(0, (fl.birdCount || 0) - n);

            // Butchered → freezer log + butcher entry (preserves existing flow)
            if (isButcher) {
              if (!Array.isArray(d.freezerLog)) d.freezerLog = [];
              d.freezerLog.push({
                id: newId(),
                date,
                hobbyId: hobby.id,
                flockId: flock.id,
                flockName: flock.name,
                birdType: flock.birdType || "Bird",
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
                flockId: flock.id,
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
                flockId: flock.id,
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
                note: `${reasonLabel} · ${n} ${flock.birdType?.toLowerCase() || "bird"}${n === 1 ? "" : "s"}${note.trim() ? " · " + note.trim() : ""}`,
                flockId: flock.id,
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
                type="number"
                style={inputStyle}
                value={totalCount}
                onChange={(e) => { setTotalCount(e.target.value); setValidationError(""); }}
                placeholder="e.g. 500"
              />
            </Field>
          ) : (
            <Field label="Average eggs per day">
              <input
                type="number"
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

  // Pre-populate from existingEntry when editing.
  const [date, setDate] = useState(() => existingEntry ? existingEntry.date : todayStr());
  const [fields, setFields] = useState(() => {
    if (!existingEntry) return {};
    // Copy all fields except metadata
    const { id, date: _d, action: _a, created, photoPath, photoPaths, weather, batchId, seasonId, ...rest } = existingEntry;
    return rest;
  });
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

  // Which actions support attaching photos
  const supportsPhoto = ["note", "harvested", "planted", "issue"].includes(action);
  const MAX_PHOTOS = 5;
  const totalPhotoCount = existingPaths.length + photoFiles.length;

  const submit = async () => {
    // Coerce numeric fields from string inputs to actual numbers
    const numericKeys = ["quantity", "cost", "lbs", "gallons", "count", "cuft", "avgWeight", "pricePerDozen"];
    const cleanFields = { ...fields };
    numericKeys.forEach((k) => {
      if (cleanFields[k] !== undefined && cleanFields[k] !== "") {
        const n = parseFloat(cleanFields[k]);
        cleanFields[k] = isNaN(n) ? 0 : n;
      }
    });

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
        // attach to current batch for meat chickens
        if (hobby.type === "meat_chickens" && hobby.currentBatch) {
          entry.batchId = hobby.currentBatch.id;
        }
        // tag egg-layer entries with flock so per-flock analytics work.
        // Picker UI sets flockId for multi-flock users; this fallback covers
        // single-flock users (no picker shown) AND any edge case where the
        // picker was missed.
        const flockScopedActions = ["fed","bedding","death","eggs","eggs_laid","sold_eggs","note","issue"];
        if (hobby.type === "egg_layers" && !entry.flockId && flockScopedActions.includes(action)) {
          const firstFlock = (hobby.flocks || [])[0];
          if (firstFlock) entry.flockId = firstFlock.id;
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

        d.entries[hobby.id].push(entry);
      } else {
        // Edit: replace the existing entry in place
        const idx = d.entries[hobby.id].findIndex((e) => e.id === existingEntry.id);
        if (idx !== -1) {
          d.entries[hobby.id][idx] = entry;
        } else {
          // If somehow it's missing (e.g., removed elsewhere), add it back
          d.entries[hobby.id].push(entry);
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
    eggs_laid: "eggs laid",
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
          to keep entries from going un-flocked. */}
      {hobby.type === "egg_layers" && Array.isArray(hobby.flocks) && hobby.flocks.length > 1 &&
        ["fed","bedding","death","eggs","sold_eggs","note","issue"].includes(action) && (
        <Field label="Which flock?">
          <select
            style={inputStyle}
            value={fields.flockId || hobby.flocks[0]?.id || ""}
            onChange={(e) => set("flockId", e.target.value)}
          >
            {hobby.flocks.map(f => (
              <option key={f.id} value={f.id}>
                {f.name}{f.birdType ? ` (${f.birdType})` : ""}
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
          <input type="number" step="0.1" style={inputStyle} value={fields.gallons || ""} onChange={(e) => set("gallons", e.target.value)} />
        </Field>
      )}

      {action === "planted" && (
        <>
          <Field label="Plant / crop">
            <input style={inputStyle} list="plant-list" value={fields.plant || ""} onChange={(e) => set("plant", e.target.value)} placeholder="Tomato, Kale..." />
            <datalist id="plant-list">{plants.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
          <Field label="How many">
            <input type="number" style={inputStyle} value={fields.quantity || ""} onChange={(e) => set("quantity", e.target.value)} />
          </Field>
          <Field label="Bed / location (optional)">
            <input style={inputStyle} value={fields.bed || ""} onChange={(e) => set("bed", e.target.value)} />
          </Field>
          <Field label="Cost (seeds, soil — optional)">
            <input type="number" step="0.01" style={inputStyle} value={fields.cost || ""} onChange={(e) => set("cost", e.target.value)} />
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
            <input type="number" step="0.01" style={inputStyle} value={fields.quantity || ""} onChange={(e) => set("quantity", e.target.value)} />
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
          <Field label="Pounds of feed">
            <input type="number" step="0.1" style={inputStyle} value={fields.lbs || ""} onChange={(e) => set("lbs", e.target.value)} />
          </Field>
          <Field label="Cost of bag (or this feeding)">
            <input type="number" step="0.01" style={inputStyle} value={fields.cost || ""} onChange={(e) => set("cost", e.target.value)} />
          </Field>
        </>
      )}

      {action === "free_range" && (
        <Field label="Notes (optional)">
          <input style={inputStyle} value={fields.note || ""} onChange={(e) => set("note", e.target.value)} placeholder="e.g. 4 hours in pasture" />
        </Field>
      )}

      {(action === "eggs" || action === "eggs_laid") && (
        <Field label="Eggs collected">
          <input type="number" style={inputStyle} value={fields.count || ""} onChange={(e) => set("count", e.target.value)} />
        </Field>
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
            <input type="number" step="0.1" style={inputStyle} value={fields.cuft || ""} onChange={(e) => set("cuft", e.target.value)} placeholder="leave blank for rinse / power wash / poop tray" />
          </Field>
          <Field label="Cost (optional)">
            <input type="number" step="0.01" style={inputStyle} value={fields.cost || ""} onChange={(e) => set("cost", e.target.value)} placeholder="0 for water-only cleanings" />
          </Field>
          <Field label="Notes (optional)">
            <input style={inputStyle} value={fields.note || ""} onChange={(e) => set("note", e.target.value)} placeholder="e.g. left hutch, quail run, ammonia getting strong" />
          </Field>
        </>
      )}

      {action === "death" && (
        <>
          <Field label="How many died?">
            <input type="number" min="1" style={inputStyle} value={fields.count || ""} onChange={(e) => set("count", e.target.value)} placeholder="1" />
          </Field>
          <Field label="Cause / reason (optional)">
            <input style={inputStyle} value={fields.cause || ""} onChange={(e) => set("cause", e.target.value)} placeholder="predator, illness, unknown..." />
          </Field>
        </>
      )}

      {action === "sold_eggs" && (
        <>
          <Field label="Number of eggs sold">
            <input type="number" style={inputStyle} value={fields.count || ""} onChange={(e) => set("count", e.target.value)} placeholder="e.g. 24 (= 2 dozen)" />
          </Field>
          <Field label="Price per dozen ($)">
            <input type="number" step="0.01" style={inputStyle} value={fields.pricePerDozen || ""} onChange={(e) => set("pricePerDozen", e.target.value)} placeholder="e.g. 6.00" />
          </Field>
          <Field label="Sold to / notes (optional)">
            <input style={inputStyle} value={fields.note || ""} onChange={(e) => set("note", e.target.value)} placeholder="neighbor, farmer's market..." />
          </Field>
          {fields.count && fields.pricePerDozen && (
            <div style={{
              padding: 10, background: palette.yolkSoft, borderRadius: 6,
              fontSize: 13, color: palette.ink, marginBottom: 14, textAlign: "center",
            }}>
              Revenue: <strong>{fmtMoney(((Number(fields.count) || 0) / 12) * (Number(fields.pricePerDozen) || 0))}</strong>
            </div>
          )}
        </>
      )}

      {action === "infrastructure" && (
        <>
          <Field label="What was built / repaired / bought?">
            <input style={inputStyle} value={fields.item || ""} onChange={(e) => set("item", e.target.value)} placeholder="new coop, run extension, fencing..." />
          </Field>
          <Field label="Cost ($)">
            <input type="number" step="0.01" style={inputStyle} value={fields.cost || ""} onChange={(e) => set("cost", e.target.value)} />
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

          {/* Add-photo button — disabled when at max */}
          {totalPhotoCount < MAX_PHOTOS && (
            <label style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "14px", borderRadius: 8,
              border: `1.5px dashed ${palette.line}`, background: palette.bgAlt,
              cursor: "pointer", color: palette.inkSoft, fontSize: 13,
            }}>
              <Camera size={18} strokeWidth={1.8} />
              {totalPhotoCount === 0 ? "Tap to add photos" : "Add another photo"}
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
  const [hobbies, setHobbies] = useState({ garden: true, egg_layers: true, meat_chickens: true, rabbits: false, bees: false, incubator: false, goats: false, cows: false, pigs: false, sheep: false, horses: false, sourdough: false, farmstand: false });

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
      // Filter hobbies down to just the ones they wanted
      const wantedTypes = Object.keys(hobbies).filter((k) => hobbies[k]);
      d.hobbies = (d.hobbies || []).map((h) => {
        if (["garden","egg_layers","meat_chickens","rabbits","bees","incubator","goats","cows","pigs","sheep","horses","sourdough","farmstand"].includes(h.type)) {
          h.hidden = !wantedTypes.includes(h.type);
        }
        return h;
      });
      return d;
    });
    onClose();
  };

  // Wizard uses its own modal styling — distinct from regular modals so it
  // feels like a welcome experience, not a settings dialog.
  return (
    <div style={{
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
              label="Meat chickens"
              sub="Per-batch tracking, butcher day"
            />
            <HobbyCheckbox
              checked={hobbies.rabbits}
              onToggle={() => setHobbies((h) => ({ ...h, rabbits: !h.rabbits }))}
              icon="🐇"
              label="Rabbits (Beta)"
              sub="Hutch management, breeding reminders, kindle dates"
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
                <strong>Real costs, transparently:</strong> the domain is about $10/year, plus my time building features. There's no company, no investors, just me — Riley — coding in the evenings.
              </div>

              <p style={{ fontSize: 14, color: palette.ink, lineHeight: 1.65, marginBottom: 14 }}>
                If down the line you find Henalytics useful and want to chip in a few bucks to help keep it running, that genuinely makes a difference. Totally optional — but it's how I keep the lights on and keep building.
              </p>

              <p style={{ fontSize: 13, color: palette.inkSoft, fontStyle: "italic", marginBottom: 16, lineHeight: 1.5 }}>
                You'll find a "Support Henalytics" option in the 🏚 Barn menu anytime. No pressure, no popups bugging you about it.
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
// (Rabbits, Bees, Incubator, Goats, Cows, Pigs, Farmstand).
// ============================================================================
function AnalyticsShareWrapper({ hobby, entries, data, children }) {
  const [showShare, setShowShare] = useState(false);
  if (!hobby) return children; // safety: don't render the button if hobby missing
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
      <div style={{ display:"flex",justifyContent:"flex-end",marginBottom:10 }}>
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
      {children}
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
      return {
        emoji: "🥚", label: "Egg Layers",
        stats: [
          { label: "Eggs collected", value: totalEggs.toLocaleString() },
          { label: "Birds in flock", value: totalBirds },
          { label: "Cost / dozen", value: costPerDozen > 0 ? fmtMoney(costPerDozen) : "—" },
          { label: "Feed cost", value: totalCost > 0 ? fmtMoney(totalCost) : "—" },
        ],
      };
    }
    if (hobby.type === "meat_chickens") {
      const archived = hobby.archivedBatches || [];
      const current = hobby.currentBatch;
      const allBatches = current ? [...archived, current] : archived;
      const totalBirds = allBatches.reduce((s, b) => s + (b.startCount||0), 0);
      const totalButchered = allBatches.reduce((s, b) => s + (b.butchered||[]).reduce((ss, bu) => ss + (bu.count||0), 0), 0);
      const totalWeight = allBatches.reduce((s, b) => s + (b.butchered||[]).reduce((ss, bu) => ss + (bu.count||0)*(bu.avgWeight||0), 0), 0);
      const avgWeight = totalButchered > 0 ? (totalWeight/totalButchered).toFixed(1) : "—";
      const deaths = entries.filter(e => e.action === "death").reduce((s,e)=>s+(Number(e.count)||1),0);
      return {
        emoji: "🍗", label: "Meat Chickens",
        stats: [
          { label: "Birds raised", value: totalBirds },
          { label: "Butchered", value: totalButchered },
          { label: "Avg weight", value: `${avgWeight} lbs` },
          { label: "Deaths", value: deaths },
        ],
      };
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
      const butchered = entries.filter(e => e.action === "butcher").reduce((s, e) => s + (Number(e.count)||0), 0);
      const hutches = (hobby.hutches||[]).length;
      return {
        emoji: "🐇", label: "Rabbits",
        stats: [
          { label: "Litters", value: litters.length },
          { label: "Kits born", value: totalKits },
          { label: "Butchered", value: butchered },
          { label: "Hutches", value: hutches },
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
      // Incubator data lives on hobby.runs[], not entries — but entries are
      // the date-filterable thing. We filter runs by setDate falling in window.
      const allRuns = hobby.runs || [];
      const runsInRange = allRuns.filter(r => {
        if (!r.setDate) return filter === "all";
        if (filter === "all") return true;
        const d = new Date(r.setDate + "T12:00");
        if (filter === "today") return r.setDate === todayStr;
        if (filter === "week")  return d >= oneWeekAgo;
        if (filter === "year")  return d >= oneYearAgo;
        return true;
      });
      const eggsSet = runsInRange.reduce((s,r) => s + (Number(r.eggsSet)||0), 0);
      const eggsHatched = runsInRange.reduce((s,r) => s + (Number(r.hatched)||0), 0);
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
      const goatCount = (hobby.animals||[]).length;
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
      const cowCount = (hobby.animals||[]).length;
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
      const pigCount = (hobby.animals||[]).length;
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
    return { emoji: "📊", label: hobby.name, stats: [] };
  };

  const { emoji, label, stats } = buildStats(filteredEntries);
  const homesteadName = data.homesteadName || "My Homestead";
  const dateLabel = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Load html2canvas dynamically
  const loadHtml2Canvas = () => new Promise((resolve, reject) => {
    if (window.html2canvas) { resolve(window.html2canvas); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    s.onload = () => resolve(window.html2canvas);
    s.onerror = reject;
    document.head.appendChild(s);
  });

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

  const btnLabel = () => {
    if (shareStatus === "sharing") return "Preparing image...";
    if (shareStatus === "done") return "✓ Image saved!";
    if (shareStatus === "error") return "Something went wrong";
    // On mobile with Web Share API, show Share; otherwise Download
    const canShareFiles = navigator.canShare && navigator.canShare({ files: [new File([""], "t.png", { type: "image/png" })] });
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
    title: "Welcome to HenAlytics",
    body: "HenAlytics helps you track eggs, harvests, costs, and sales across everything on your homestead — chickens, garden, bees, rabbits, and more. This quick tour covers the essentials.",
    tip: null,
  },
  {
    emoji: "🔧",
    title: "Enable the hobbies you do",
    body: "You only see what's relevant to you. Hide meat chickens if you don't raise them. Enable Ducks, Rabbits, or Bees when you're ready.",
    tip: "Tap 'More hobbies?' on the home screen, or go to ⚙️ Settings. You can also hide the Sales tab there if you don't sell anything.",
  },
  {
    emoji: "🥚",
    title: "The egg basket",
    body: "Tap + each time you collect an egg during your rounds. When you're done, hit 'Done — log N eggs' to save it to your records.",
    tip: "The basket resets automatically each day. Each flock has its own basket.",
  },
  {
    emoji: "🐔",
    title: "Multiple flocks",
    body: "Chickens are the default, but you can add Duck, Turkey, Quail, Goose, or Guinea flocks too. Each flock tracks separately with its own basket and stats.",
    tip: "Tap 'Add Flock' on the Egg Layers home tab to get started.",
  },
  {
    emoji: "💵",
    title: "Track what your birds cost",
    body: "When you add a flock, log the cost and where you bought them — hatchery name, feed store, or a neighbor. Pairs with feed costs to give you real cost-per-egg numbers later.",
    tip: "Already added a flock? Tap it on the home screen to edit and add the cost + source.",
  },
  {
    emoji: "❄️",
    title: "Butcher any bird",
    body: "It's not just for meat chickens. Process a few quail, an extra rooster, a duck — any bird from any flock can go to the freezer log with date, count, and average weight.",
    tip: "Tap a flock on the Egg Layers home tab and choose 'Butcher' to send some birds to the freezer log.",
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
    body: "Tap the Calendar tab and plan a crop. HenAlytics calculates suggested planting dates based on your hardiness zone and last frost date.",
    tip: "All dates are editable — adjust any of them before adding to your calendar.",
  },
  {
    emoji: "💰",
    title: "Sales tab",
    body: "Log what you sell — eggs (by bird type, eating vs hatching), honey, meat chickens, rabbits, or garden produce. Track repeat customers and see revenue over time.",
    tip: "Old 'Sold Eggs' entries from Egg Layers show up here automatically. Don't sell anything? Hide this tab in ⚙️ Settings.",
  },
  {
    emoji: "🏚",
    title: "The Barn icon",
    body: "Tap the barn in the top-right corner to access: invite a farmhand (share with your partner or family), leave a tip to keep the app free, set your location for weather, and manage your photos.",
    tip: "Farmhands see the same data in real time — great for couples running the homestead together.",
  },
  {
    emoji: "✨",
    title: "Year in Review",
    body: "Tap the ✨ tab at any time to see a summary of your year — total eggs, harvests, costs, sales, and highlights across every hobby.",
    tip: "It updates live as you log, so you can check it any time of year.",
  },
  {
    emoji: "📬",
    title: "Weekly digest email",
    body: "Opt in to get a Sunday morning email recap of your week — eggs laid, feed costs, harvests, and more. A nice way to stay on top of your homestead.",
    tip: "Enable it in ⚙️ Settings after signing in. You can turn it off anytime.",
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
function AddPerennialModal({ hobbyId, update, onClose }) {
  const [name, setName] = useState("");
  const [variety, setVariety] = useState("");
  const [plantDate, setPlantDate] = useState("");
  const [notes, setNotes] = useState("");
  const SUGGESTIONS = ["Apple tree","Pear tree","Peach tree","Cherry tree","Plum tree","Fig tree","Blueberry bush","Raspberry bush","Blackberry bush","Strawberry bed","Asparagus","Rhubarb","Horseradish","Artichoke","Grape vine","Kiwi vine"];
  return (
    <Modal open onClose={onClose} title="Add a perennial">
      <Field label="Plant / tree name">
        <input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} placeholder="Apple tree, asparagus, blueberries..." autoFocus />
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
        <input style={inputStyle} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Location, spacing, notes..." />
      </Field>
      <Btn variant="primary" onClick={() => {
        if (!name.trim()) return;
        update(d => {
          const h = d.hobbies.find(x => x.id === hobbyId);
          if (!h) return d;
          if (!Array.isArray(h.perennials)) h.perennials = [];
          h.perennials.push({ id: newId(), name: name.trim(), variety, plantDate, notes, totalHarvest: 0, harvests: [], created: Date.now() });
          return d;
        });
        onClose();
      }}>Add {name || "perennial"}</Btn>
    </Modal>
  );
}

// ============================================================================
// EDIT PERENNIAL MODAL
// ============================================================================
function EditPerennialModal({ hobbyId, perennial, update, onClose }) {
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
      if (p) { p.name = name.trim(); p.variety = variety; p.plantDate = plantDate; p.notes = notes; }
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
            <input type="number" min={0} step="0.1" style={inputStyle} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" autoFocus />
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

// ============================================================================
// APP STORE FUNDRAISER MODAL — fires once/month for users who haven't tipped yet
// ----------------------------------------------------------------------------
// Soft, honest ask to help fund the Apple ($99/yr) and Google Play ($25) fees
// so Henalytics can launch officially. Trust signals throughout: real costs
// disclosed, Stripe checkout, refund mention, easy dismiss, no urgency tactics.
// ============================================================================
function AppStoreFundModal({ onClose, onLeaveTip }) {
  const STRIPE_ONE_TIME_URL = "https://buy.stripe.com/dRmdRbb3K2kWbDj2XK9MY00";
  const goal = APP_STORE_FUND_GOAL;
  const raised = Math.max(0, Math.min(APP_STORE_FUND_RAISED, goal));
  const percent = goal > 0 ? Math.round((raised / goal) * 100) : 0;

  const handleTip = () => {
    if (onLeaveTip) onLeaveTip();
    window.open(STRIPE_ONE_TIME_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(44,24,16,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: palette.bg, borderRadius: 20, maxWidth: 440, width: "100%",
        border: `2px solid ${palette.ink}`, boxShadow: `6px 8px 0 ${palette.line}`,
        fontFamily: FONT_BODY, overflow: "hidden", maxHeight: "92vh",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          background: palette.yolk, padding: "20px 24px 16px",
          textAlign: "center", position: "relative", flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute", top: 12, right: 12,
              background: "transparent", border: "none", cursor: "pointer",
              color: palette.ink, padding: 6, borderRadius: 6,
            }}
          >
            <X size={20} />
          </button>
          <div style={{ fontSize: 36, marginBottom: 4 }}>📱</div>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, margin: "0 0 4px", color: palette.ink, lineHeight: 1.2 }}>
            Help bring Henalytics to the App Store
          </h2>
          <p style={{ fontSize: 13, color: palette.ink, margin: 0, opacity: 0.85 }}>
            Totally optional · easy dismiss · no pressure
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: "1 1 auto" }}>
          <p style={{ fontSize: 14, color: palette.ink, lineHeight: 1.65, marginTop: 0, marginBottom: 14 }}>
            Henalytics is a website right now. To get it on the iPhone App Store and Google Play, I have to pay developer fees and put in the build work. The app stays <strong>100% free</strong> for everyone — this just covers the upfront costs.
          </p>

          {/* Cost breakdown — transparency is the trust builder */}
          <div style={{
            padding: "12px 14px", background: palette.bgAlt, borderRadius: 10,
            marginBottom: 14, fontSize: 13, color: palette.ink, lineHeight: 1.7,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>What it actually costs:</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>🍎 Apple Developer fee</span>
              <span>$99/year</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>🤖 Google Play fee</span>
              <span>$25 one-time</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>🎨 Icons, screenshots, my time</span>
              <span>~$76</span>
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between",
              paddingTop: 6, marginTop: 6, borderTop: `1px solid ${palette.line}`,
              fontWeight: 700,
            }}>
              <span>Goal</span>
              <span>${goal}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontSize: 12, color: palette.inkSoft, marginBottom: 6, fontWeight: 600,
            }}>
              <span>Raised so far</span>
              <span>${raised} of ${goal}</span>
            </div>
            <div style={{
              height: 12, background: palette.bgAlt, borderRadius: 6,
              overflow: "hidden", border: `1px solid ${palette.line}`,
            }}>
              <div style={{
                width: `${percent}%`, height: "100%",
                background: palette.leaf, transition: "width 0.4s ease",
              }} />
            </div>
            <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4, fontStyle: "italic" }}>
              {percent}% there{percent < 100 ? " — every bit helps." : " — goal reached, thank you!"}
            </div>
          </div>

          <p style={{ fontSize: 13, color: palette.ink, lineHeight: 1.6, margin: "0 0 14px" }}>
            If you'd like to chip in a few bucks toward making it happen, that means a lot. If not, no worries at all — just keep using and enjoying Henalytics.
          </p>

          <p style={{ fontSize: 13, color: palette.ink, lineHeight: 1.6, margin: "0 0 14px", fontStyle: "italic" }}>
            — Riley, the Henalytics maker
          </p>

          {/* Tip button */}
          <button
            onClick={handleTip}
            style={{
              width: "100%", padding: "14px 16px", borderRadius: 10,
              background: palette.leaf, color: palette.bg,
              border: `2px solid ${palette.ink}`, boxShadow: `3px 3px 0 ${palette.line}`,
              fontFamily: FONT_BODY, fontWeight: 700, fontSize: 15, cursor: "pointer",
              marginBottom: 10,
            }}
          >
            💚 Chip in $5 toward the App Store launch
          </button>

          <button
            onClick={onClose}
            style={{
              width: "100%", padding: "10px 16px", borderRadius: 10,
              background: "transparent", color: palette.inkSoft,
              border: `1.5px solid ${palette.line}`,
              fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13, cursor: "pointer",
              marginBottom: 14,
            }}
          >
            Maybe later
          </button>

          {/* Trust signals — small print at the bottom */}
          <div style={{
            padding: "10px 12px", background: palette.card, borderRadius: 8,
            border: `1.5px solid ${palette.line}`, fontSize: 11, color: palette.inkSoft,
            lineHeight: 1.55,
          }}>
            <div style={{ marginBottom: 4 }}>
              🔒 <strong>Secure checkout via Stripe.</strong> Apple Pay & Google Pay supported. Stripe sends a receipt to your email.
            </div>
            <div>
              💌 Changed your mind? Email <strong>slowbuildacres@gmail.com</strong> for a full refund — no questions asked.
            </div>
          </div>

          {/* Sign-off */}
          <p style={{
            fontSize: 12, color: palette.inkSoft, textAlign: "center",
            marginTop: 14, marginBottom: 0, fontStyle: "italic", lineHeight: 1.5,
          }}>
            Thank you for helping me support homesteads around the globe.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============ SUPPORTER THANKS MODAL — shown on the 9th-11th of each month ============
// Generic thank-you to everyone who's chipped in.
// Includes mission statement and two Stripe Payment Link buttons (one-time + monthly).
// Marks the month as dismissed when the user closes OR taps a tip button.
function SupporterThanksModal({ onClose, onLeaveTip }) {
  // Stripe Payment Links — same URLs as SupportModal
  const STRIPE_ONE_TIME_URL = "https://buy.stripe.com/dRmdRbb3K2kWbDj2XK9MY00";
  const STRIPE_MONTHLY_URL = "https://buy.stripe.com/cNi9AV7Ry4t4cHnfKw9MY02";

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
          <p style={{ fontSize:14,color:palette.ink,lineHeight:1.6,margin:"0 0 12px" }}>
            My goal is to let as many homesteaders as possible benefit from this app without ever needing a paid subscription. Honestly, that wouldn't be possible without your feedback and the tips you leave — they're what let me keep working on it and making it better.
          </p>
          <p style={{ fontStyle:"italic",fontSize:13,color:palette.inkSoft,margin:"0 0 16px" }}>
            🌾 With gratitude, from one homestead to another.
          </p>

          {/* Two big buttons side-by-side — One-time / Monthly. Tapping either
              dismisses this popup for the month (via onLeaveTip) and opens
              the Stripe payment page in a new tab. */}
          <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
            <a
              href={STRIPE_ONE_TIME_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onLeaveTip}
              style={{
                flex: "1 1 140px",
                padding: "14px 12px",
                borderRadius: 12,
                border: `2px solid ${palette.ink}`,
                background: palette.yolk,
                color: palette.ink,
                textDecoration: "none",
                textAlign: "center",
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 14,
                boxShadow: "2px 2px 0 " + palette.line,
                display: "block",
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 2 }}>🌾</div>
              <div>One-time</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, marginTop: 2 }}>$5</div>
              <div style={{ fontSize: 10, fontWeight: 500, color: palette.inkSoft, marginTop: 2 }}>Bag of feed</div>
            </a>
            <a
              href={STRIPE_MONTHLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onLeaveTip}
              style={{
                flex: "1 1 140px",
                padding: "14px 12px",
                borderRadius: 12,
                border: `2px solid ${palette.ink}`,
                background: palette.leaf,
                color: palette.bg,
                textDecoration: "none",
                textAlign: "center",
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 14,
                boxShadow: "2px 2px 0 " + palette.line,
                display: "block",
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 2 }}>💚</div>
              <div>Monthly</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, marginTop: 2 }}>$5</div>
              <div style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>Sustaining tip</div>
            </a>
          </div>

          <div style={{
            marginTop: 10, textAlign: "center", fontSize: 11, color: palette.inkSoft, lineHeight: 1.5,
          }}>
            Secure checkout via Stripe — Apple Pay & Google Pay supported.
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
