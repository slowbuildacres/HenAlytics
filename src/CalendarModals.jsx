// ============================================================================
// CALENDAR MODALS
// ----------------------------------------------------------------------------
// All the modal dialogs the calendar tab uses:
//   - PlanCropModal: pick a crop + method, generates a sequence of events
//   - PlanBirdsModal: pick chicken event type, set date
//   - AddCalendarEventModal: blank custom event
//   - EditCalendarEventModal: edit/delete an existing event
//   - EditZoneModal: override the auto-detected USDA zone
//   - ViewDayEventsModal: show all events on a single day
// ============================================================================

import React, { useState } from "react";
import {
  ZONE_INFO, CROPS, cropsForSeason, methodsForCrop, generateCropEvents, getFrostDates, estimateZone,
} from "./gardenAlmanac.js";
import { CompanionPanel } from "./CompanionInfo.jsx";
import {
  HARDINESS_SYSTEMS, estimateZoneForSystem, getZoneInfo,
} from "./hardiness.js";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47",
  card: "#FAF5EA", line: "#2C181030",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

const inputStyle = {
  width: "100%", padding: "10px 12px",
  borderRadius: 8, border: `1.5px solid ${palette.line}`,
  fontFamily: FONT_BODY, fontSize: 14, background: "white", color: palette.ink,
  boxSizing: "border-box",
};

const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Generate a unique ID. Prefers crypto.randomUUID() (available on all modern
// browsers + iOS/Android WebViews); falls back to Math.random for ancient
// runtimes.
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

// Recurrence options for calendar events. "none" => a one-off event (stored
// with no `recurrence` field at all, so existing events stay one-offs).
const RECUR_OPTIONS = [
  { id: "none",     label: "Does not repeat" },
  { id: "daily",    label: "Daily" },
  { id: "weekly",   label: "Weekly" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly",  label: "Monthly" },
  { id: "yearly",   label: "Yearly" },
];


// Modal/Field/Btn imported from these prop-bag patterns; we mirror them here
// to keep this file self-contained.
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(44,24,16,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: palette.bg, padding: 24, borderRadius: 12,
          maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto",
          border: `2px solid ${palette.ink}`,
          boxShadow: "4px 4px 0 " + palette.line,
          fontFamily: FONT_BODY, color: palette.ink,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: palette.inkSoft, fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, color: palette.inkSoft, marginBottom: 4, fontWeight: 600 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", disabled = false }) {
  const styles = {
    primary: { background: palette.ink, color: palette.bg, border: `1.5px solid ${palette.ink}` },
    danger: { background: palette.accent, color: palette.bg, border: `1.5px solid ${palette.accent}` },
    ghost: { background: "transparent", color: palette.ink, border: `1.5px solid ${palette.line}` },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        padding: "10px 18px", borderRadius: 8,
        cursor: disabled ? "wait" : "pointer",
        fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14,
        opacity: disabled ? 0.7 : 1,
        boxShadow: "2px 2px 0 " + palette.line,
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

// Decide which planting season to default the planner to. In the run-up to
// the first frost (roughly its preceding ~5 months) people are planning fall
// crops; the rest of the year they're thinking spring. Resolved from the
// user's own zone so it's correct in both hemispheres (southern-hemisphere
// zones already carry their inverted frost dates).
function defaultPlantingSeason(data) {
  try {
    const system = data.userZoneSystem || "USDA";
    const zone = data.userZone || estimateZoneForSystem(
      system, data.homesteadLocation?.lat, data.homesteadLocation?.lon
    );
    const now = new Date();
    const fd = getFrostDates(zone, now.getFullYear(), system);
    const ff = fd.firstFrost.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    if (now.getTime() >= ff - 150 * dayMs && now.getTime() <= ff) return "fall";
    return "spring";
  } catch (_) {
    return "spring";
  }
}

// ============================================================================
// PLAN CROP MODAL — pick a crop, pick a method, generate events
// ============================================================================

export function PlanCropModal({ data, update, onClose, onConfirm }) {
  // Step flow:
  //   1   = pick crop
  //   2   = pick method (start-indoors / direct-sow / transplant)
  //   2.5 = pick variety (Push 5; skippable via "generic" button)
  //   3   = editable date preview
  //   4   = "Other / custom" free-text crop flow (bypasses variety entirely)
  const [step, setStep] = useState(1);
  // Spring vs fall planting. Spring is anchored to last frost (grow into the
  // warming year); fall is anchored to first frost (mature as it cools).
  // Defaults to whichever the calendar is approaching.
  const [season, setSeason] = useState(() => defaultPlantingSeason(data));
  const [cropId, setCropId] = useState(null);
  const [method, setMethod] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  // editableDates: { [eventId]: dateString } — user-overridden dates
  const [editableDates, setEditableDates] = useState({});
  // Push 5 — per-variety harvest timeframes.
  //
  // selectedVariety is either:
  //   - null  → user chose "Use generic {crop}", skipping varieties
  //   - { id, name, daysToHarvest } → a saved variety from data.varieties[cropId]
  //
  // The two `newVariety*` fields back the inline "+ Add variety" sub-form
  // on step 2.5. They're separate state so opening/closing the form doesn't
  // clobber the selected variety, and so the form prefills cleanly.
  const [selectedVariety, setSelectedVariety] = useState(null);
  const [showAddVariety, setShowAddVariety] = useState(false);
  const [newVarietyName, setNewVarietyName] = useState("");
  const [newVarietyDays, setNewVarietyDays] = useState("");
  const [varietyError, setVarietyError] = useState("");
  // "Other crop" path: user types a name + picks a single planting date, and
  // we just create one calendar event. No frost-math, no harvest prediction —
  // it's a reminder. Power users can add more events manually after.
  const [otherName, setOtherName] = useState("");
  const [otherDate, setOtherDate] = useState(() => {
    // Default to one week out so users have a sensible starting point
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [otherError, setOtherError] = useState("");

  const userSystem = data.userZoneSystem || "USDA";
  const userZone = data.userZone || estimateZoneForSystem(
    userSystem,
    data.homesteadLocation?.lat,
    data.homesteadLocation?.lon
  );
  const frostDates = getFrostDates(userZone, year, userSystem);
  const zoneLabel = getZoneInfo(userSystem, userZone).label;
  const crop = CROPS.find((c) => c.id === cropId);
  const methods = cropId ? methodsForCrop(cropId, season) : [];
  // Saved varieties for the chosen crop. data.varieties may be undefined
  // (legacy users); default to empty array, never crash.
  const savedVarieties = (cropId && data.varieties && Array.isArray(data.varieties[cropId]))
    ? data.varieties[cropId]
    : [];
  // Pass selectedVariety into the event generator. null = use crop-wide defaults
  // (legacy behavior preserved). `season` selects spring (last-frost) vs fall
  // (first-frost) timing math.
  const generatedEvents = (cropId && method)
    ? generateCropEvents(cropId, method, frostDates, selectedVariety, season)
    : [];

  // Crops offered for the active season — fall shows only cool-season crops.
  const seasonCrops = cropsForSeason(season);

  // Flip the planting season. Crop/method sets differ between seasons, so
  // start the picker over to avoid carrying a spring-only crop into fall.
  const handleSetSeason = (s) => {
    if (s === season) return;
    setSeason(s);
    setCropId(null);
    setMethod(null);
    setSelectedVariety(null);
    setShowAddVariety(false);
    setEditableDates({});
    setStep(1);
  };

  // When year, method, or variety changes, reset editable dates so suggestions
  // refresh from the new harvest-day math.
  const handleSetMethod = (m) => {
    setMethod(m);
    setEditableDates({});
    // Reset variety selection when method changes — user is starting over.
    setSelectedVariety(null);
    setShowAddVariety(false);
    setVarietyError("");
    setStep(2.5);
  };
  const handleSetYear = (y) => { setYear(y); setEditableDates({}); };

  // Variety picker handlers (Push 5).
  const pickVariety = (v) => {
    setSelectedVariety(v);
    setEditableDates({});
    setStep(3);
  };
  const pickGeneric = () => {
    setSelectedVariety(null);
    setEditableDates({});
    setStep(3);
  };
  const saveNewVariety = () => {
    const name = newVarietyName.trim();
    if (!name) { setVarietyError("Give the variety a name."); return; }
    // Default days-to-harvest to the crop-wide value when user leaves it
    // blank — keeps the form forgiving. Reject obvious garbage (negatives,
    // wild large numbers).
    let days = parseInt(newVarietyDays, 10);
    if (newVarietyDays === "" || isNaN(days)) days = crop?.daysToHarvest || 60;
    if (days < 1 || days > 500) {
      setVarietyError("Days to harvest should be between 1 and 500.");
      return;
    }
    const variety = { id: `var-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, daysToHarvest: days };
    update((d) => {
      d.varieties = d.varieties || {};
      d.varieties[cropId] = Array.isArray(d.varieties[cropId]) ? d.varieties[cropId] : [];
      d.varieties[cropId].push(variety);
      return d;
    });
    // Pre-select the just-added variety and advance to preview.
    setSelectedVariety(variety);
    setShowAddVariety(false);
    setNewVarietyName("");
    setNewVarietyDays("");
    setVarietyError("");
    setEditableDates({});
    setStep(3);
  };

  // Get the final date for an event (user override or generated)
  const getDate = (evt) => editableDates[evt.id] || evt.date;

  // When user changes a date, auto-shift all subsequent event dates by the same delta
  const handleDateChange = (changedEvt, newDateStr) => {
    if (!newDateStr) return;
    const oldDate = getDate(changedEvt);
    const oldMs = new Date(oldDate + "T12:00").getTime();
    const newMs = new Date(newDateStr + "T12:00").getTime();
    const deltaDays = Math.round((newMs - oldMs) / (24 * 60 * 60 * 1000));
    if (deltaDays === 0) return;

    // Find index of changed event in generatedEvents
    const changedIdx = generatedEvents.findIndex(e => e.id === changedEvt.id);

    setEditableDates(prev => {
      const next = { ...prev, [changedEvt.id]: newDateStr };
      // Shift all subsequent events by the same delta
      generatedEvents.forEach((evt, idx) => {
        if (idx <= changedIdx) return; // only shift events AFTER the changed one
        const currentDate = prev[evt.id] || evt.date;
        const shifted = new Date(new Date(currentDate + "T12:00").getTime() + deltaDays * 24 * 60 * 60 * 1000);
        const y = shifted.getFullYear();
        const m = String(shifted.getMonth()+1).padStart(2,"0");
        const d = String(shifted.getDate()).padStart(2,"0");
        next[evt.id] = `${y}-${m}-${d}`;
      });
      return next;
    });
  };

  const confirm = () => {
    if (generatedEvents.length === 0) return;
    // Variety-aware "replace previous plan" filter (Push 5).
    //
    // Pre-Push-5 we wiped every event with this cropId in this year so
    // re-planning didn't double up. With multi-variety support, planning
    // Sungold must NOT clobber Cherokee Purple — both are tomatoes in the
    // same year. So we narrow the filter to (cropId + same varietyId +
    // same year). For the "generic" path (selectedVariety === null), we
    // match events that ALSO have no varietyId, leaving variety-tagged
    // plans untouched.
    const planVarietyId = selectedVariety ? selectedVariety.id : null;
    update((d) => {
      d.calendarEvents = d.calendarEvents || [];
      d.calendarEvents = d.calendarEvents.filter((e) => {
        if (e.cropId !== cropId) return true;
        // Match by the plan's year. Prefer the stored planYear — robust for
        // fall plans whose harvest spills into the next calendar year (garlic
        // planted in October, harvested the following June). Fall back to the
        // date prefix for legacy events saved before planYear existed.
        const eventYear = e.planYear != null
          ? e.planYear
          : parseInt((e.date || "").slice(0, 4), 10);
        if (eventYear !== year) return true;
        // Season scope — a fall plan must not clobber the spring plan for the
        // same crop in the same year (and vice-versa). Legacy events with no
        // season field are treated as spring.
        const eventSeason = e.season || "spring";
        if (eventSeason !== season) return true;
        // Same crop + year + season — now compare variety scope.
        const eventVarietyId = e.varietyId || null;
        if (eventVarietyId !== planVarietyId) return true;
        // Same crop + same year + same season + same variety scope → this is a
        // stale copy of the plan we're about to re-create. Drop it.
        return false;
      });
      const finalEvents = generatedEvents.map((e) => ({
        ...e,
        date: getDate(e),   // use user's edited date if set
        planYear: year,
      }));
      d.calendarEvents.push(...finalEvents);
      return d;
    });
    // Compute the finalEvents again outside the update so we can pass them
    // to onConfirm — update() runs inside a state setter so its locals don't
    // escape. This is the same map as above; cheap to recompute.
    // Also annotate each event with `userEdited: true` if the user changed
    // its date in step 3, so callers can tell "user explicitly picked this
    // date" from "almanac suggested this date." Plant Annual quick-log uses
    // this to date the Recent Activity row correctly (today if untouched,
    // user's date if they backdated).
    const finalEvents = generatedEvents.map((e) => ({
      ...e,
      date: getDate(e),
      planYear: year,
      userEdited: Object.prototype.hasOwnProperty.call(editableDates, e.id),
    }));
    // If caller provided onConfirm (e.g. quick-log Plant Annual), pass back
    // the crop selection AND the generated events so they can pick the right
    // date and create a planting record. Calendar's "Plan a crop" path
    // doesn't provide this callback.
    if (typeof onConfirm === 'function') {
      onConfirm({
        cropId,
        cropName: crop?.name,
        variety: selectedVariety,
        method,
        year,
        season,
        events: finalEvents,
        isCustom: false,
      });
    }
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={
      step === 1 ? "Plan a crop" :
      step === 2 ? `Plan ${crop?.name}` :
      step === 2.5 ? `Which variety?` :
      step === 4 ? "Plan a custom crop" :
      `Preview: ${selectedVariety?.name || crop?.name}`
    }>
      {step === 1 && (
        <>
          {/* Spring vs fall planting toggle. Spring counts forward from the
              last frost; fall counts backward from the first frost. */}
          <div style={{
            display: "flex", gap: 6, marginBottom: 14,
            background: palette.bgAlt, padding: 4, borderRadius: 10,
            border: `1.5px solid ${palette.line}`,
          }}>
            {[
              { id: "spring", label: "🌱 Spring planting" },
              { id: "fall",   label: "🍂 Fall planting" },
            ].map((opt) => {
              const active = season === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleSetSeason(opt.id)}
                  style={{
                    flex: 1, padding: "8px 6px", borderRadius: 7,
                    border: "none", cursor: "pointer",
                    fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600,
                    background: active ? palette.ink : "transparent",
                    color: active ? palette.bg : palette.inkSoft,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: -8, marginBottom: 14, fontStyle: "italic", textAlign: "center" }}>
            Spring and fall are separate planting windows — switch anytime.
          </div>

          <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
            {season === "fall" ? (
              <>Pick a cool-season crop — we'll work backward from your first frost
                (≈ {fmtMonthDay(frostDates.firstFrost)}) so it matures as the season cools.
                Zone {zoneLabel}.</>
            ) : (
              <>Pick a crop and we'll generate planting dates from your last frost
                (≈ {fmtMonthDay(frostDates.lastFrost)}). Zone {zoneLabel}.</>
            )}
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 8,
            maxHeight: 340,
            overflowY: "auto",
            paddingRight: 4,
          }}>
            {seasonCrops.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCropId(c.id); setStep(2); }}
                style={{
                  padding: "10px 8px",
                  background: palette.card,
                  border: `1.5px solid ${palette.line}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: FONT_BODY,
                  fontSize: 12,
                  color: palette.ink,
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 22 }}>{c.emoji}</span>
                <span>{c.name}</span>
              </button>
            ))}
            {/* "Other" tile — opens a simpler custom-crop flow for anything
                not in the built-in list (rare/regional crops, ornamentals, etc) */}
            <button
              onClick={() => setStep(4)}
              style={{
                padding: "10px 8px",
                background: palette.bgAlt,
                border: `1.5px dashed ${palette.line}`,
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: FONT_BODY,
                fontSize: 12,
                color: palette.ink,
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 22 }}>✏️</span>
              <span>Other / custom</span>
            </button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
            Add a custom crop to your calendar. We'll create a single planting reminder for the date you pick — you can add more events manually from the calendar later.
          </div>
          <Field label="Crop name">
            <input
              style={inputStyle}
              value={otherName}
              onChange={(e) => { setOtherName(e.target.value); setOtherError(""); }}
              placeholder="e.g. Black currants, dahlia tubers, asparagus crowns"
              autoFocus
            />
          </Field>
          <Field label="Planting date">
            <input
              type="date"
              style={inputStyle}
              value={otherDate}
              onChange={(e) => setOtherDate(e.target.value)}
            />
          </Field>
          {otherError && (
            <div style={{
              padding: 10, marginBottom: 12, borderRadius: 6,
              background: "#FBE5DE", border: `1.5px solid ${palette.accent}`,
              fontSize: 13, color: palette.accent,
            }}>
              {otherError}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn variant="primary" onClick={() => {
              const name = otherName.trim();
              if (!name) {
                setOtherError("Give your crop a name.");
                return;
              }
              if (!otherDate) {
                setOtherError("Pick a planting date.");
                return;
              }
              update((d) => {
                d.calendarEvents = d.calendarEvents || [];
                d.calendarEvents.push({
                  id: `custom-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
                  date: otherDate,
                  title: `🌱 Plant ${name}`,
                  notes: "Custom crop reminder. Tap to edit or add more events for this crop.",
                  cropId: "custom",
                  cropName: name,
                  type: "user",
                });
                return d;
              });
              if (typeof onConfirm === 'function') {
                onConfirm({
                  cropId: "custom",
                  cropName: name,
                  variety: null,
                  method: null,
                  year: null,
                  isCustom: true,
                  customDate: otherDate,
                });
              }
              onClose();
            }}>Add to calendar</Btn>
            <Btn variant="ghost" onClick={() => setStep(1)}>Back</Btn>
          </div>
        </>
      )}

      {step === 2 && crop && (
        <>
          <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
            How do you want to start your {crop.name.toLowerCase()}?
          </div>
          {crop.notes && (
            <div style={{
              padding: 10, background: palette.bgAlt, borderRadius: 8,
              fontSize: 12, color: palette.inkSoft, marginBottom: 14, fontStyle: "italic", lineHeight: 1.5,
            }}>
              💡 {crop.notes}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {methods.map((m) => (
              <button
                key={m.id}
                onClick={() => handleSetMethod(m.id)}
                style={{
                  padding: "12px 14px",
                  background: palette.card,
                  border: `1.5px solid ${palette.line}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: FONT_BODY,
                  fontSize: 14,
                  color: palette.ink,
                  textAlign: "left",
                  fontWeight: 500,
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          <CompanionPanel cropId={cropId} palette={palette} fonts={{ display: FONT_DISPLAY, body: FONT_BODY }} />
          <div style={{ marginTop: 14 }}>
            <Btn variant="ghost" onClick={() => setStep(1)}>← Pick a different crop</Btn>
          </div>
        </>
      )}

      {/* Step 2.5 — variety picker (Push 5). Lets users name and save per-variety
          days-to-harvest so re-planting the same Sungold next year recalls 65d
          automatically. The "Use generic" escape hatch keeps the flow fast for
          users who don't care about varieties. */}
      {step === 2.5 && crop && (
        <>
          <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
            Got specific varieties of {crop.name.toLowerCase()}? Each one can have its own days-to-harvest so your calendar matches reality. We'll remember them for next time.
          </div>

          {/* Saved varieties — tap to pick */}
          {savedVarieties.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {savedVarieties.map((v) => (
                <button
                  key={v.id}
                  onClick={() => pickVariety(v)}
                  style={{
                    padding: "10px 12px", textAlign: "left",
                    background: palette.card,
                    color: palette.ink,
                    border: `1.5px solid ${palette.line}`,
                    borderRadius: 8, cursor: "pointer",
                    fontFamily: FONT_BODY, fontSize: 13,
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{v.name}</span>
                  <span style={{ fontSize: 12, color: palette.inkSoft }}>{v.daysToHarvest} days</span>
                </button>
              ))}
            </div>
          )}

          {/* Add-variety sub-form (inline, toggled by the + button) */}
          {showAddVariety ? (
            <div style={{
              padding: 12, marginBottom: 12,
              background: palette.bgAlt, borderRadius: 8,
              border: `1.5px solid ${palette.line}`,
            }}>
              <Field label="Variety name">
                <input
                  style={inputStyle}
                  value={newVarietyName}
                  onChange={(e) => { setNewVarietyName(e.target.value); setVarietyError(""); }}
                  placeholder="e.g. Sungold, Cherokee Purple, San Marzano"
                  autoFocus
                />
              </Field>
              <Field label={`Days to harvest (default ${crop.daysToHarvest || "—"})`}>
                <input
                  type="number"
                  style={inputStyle}
                  value={newVarietyDays}
                  onChange={(e) => { setNewVarietyDays(e.target.value); setVarietyError(""); }}
                  placeholder={String(crop.daysToHarvest || 60)}
                  min={1}
                  max={500}
                />
              </Field>
              {varietyError && (
                <div style={{
                  padding: 8, marginBottom: 10, borderRadius: 6,
                  background: "#FBE5DE", border: `1px solid ${palette.accent}`,
                  fontSize: 12, color: palette.accent,
                }}>
                  {varietyError}
                </div>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <Btn variant="primary" onClick={saveNewVariety}>Save variety</Btn>
                <Btn variant="ghost" onClick={() => {
                  setShowAddVariety(false);
                  setNewVarietyName("");
                  setNewVarietyDays("");
                  setVarietyError("");
                }}>Cancel</Btn>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddVariety(true)}
              style={{
                width: "100%",
                padding: "10px 12px", marginBottom: 12,
                background: palette.bgAlt,
                color: palette.ink,
                border: `1.5px dashed ${palette.line}`,
                borderRadius: 8, cursor: "pointer",
                fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600,
              }}
            >
              + Add a variety
            </button>
          )}

          {/* Generic escape hatch — skip varieties entirely */}
          <button
            onClick={pickGeneric}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: palette.card,
              color: palette.inkSoft,
              border: `1.5px solid ${palette.line}`,
              borderRadius: 8, cursor: "pointer",
              fontFamily: FONT_BODY, fontSize: 13,
              fontStyle: "italic",
            }}
          >
            Use generic {crop.name.toLowerCase()} ({crop.daysToHarvest || "—"} days)
          </button>

          <div style={{ marginTop: 14 }}>
            <Btn variant="ghost" onClick={() => setStep(2)}>← Back</Btn>
          </div>
        </>
      )}

      {step === 3 && crop && (
        <>
          <Field label="Plan year">
            <input
              type="number"
              style={inputStyle}
              value={year}
              onChange={(e) => handleSetYear(parseInt(e.target.value) || new Date().getFullYear())}
              min={2024} max={2030}
            />
          </Field>
          <div style={{ fontSize: 12, color: palette.inkSoft, marginBottom: 10, lineHeight: 1.5 }}>
            {season === "fall" ? (
              <>🍂 Fall timing — worked back from your first frost
                (≈ {fmtMonthDay(frostDates.firstFrost)}) and padded for slower
                late-season growth. Tap any date to adjust it.</>
            ) : (
              <>Dates are suggested based on your zone. Tap any date to adjust it.</>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {generatedEvents.map((e) => (
              <div key={e.id} style={{
                background: palette.card, border: `1.5px solid ${palette.line}`,
                borderRadius: 8, padding: "10px 12px",
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: palette.ink }}>{e.title}</div>
                  {editableDates[e.id] && editableDates[e.id] !== e.date && (
                    <div style={{ fontSize: 10, color: palette.inkSoft, marginTop: 2, fontStyle: "italic" }}>
                      Suggested: {fmtFullDate(e.date)}
                    </div>
                  )}
                </div>
                <input
                  type="date"
                  value={getDate(e)}
                  onChange={(ev) => handleDateChange(e, ev.target.value)}
                  style={{
                    padding: "6px 10px", borderRadius: 6,
                    border: `1.5px solid ${editableDates[e.id] && editableDates[e.id] !== e.date ? palette.yolk : palette.line}`,
                    fontFamily: "inherit", fontSize: 13, background: "white",
                    color: palette.ink, flexShrink: 0,
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn variant="primary" onClick={confirm}>
              Add {generatedEvents.length} event{generatedEvents.length === 1 ? "" : "s"} to Calendar
            </Btn>
            <Btn variant="ghost" onClick={() => setStep(2.5)}>← Back</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

// ============================================================================
// PLAN BIRDS MODAL — chicken events (chicks arrive, butcher day, etc)
// ============================================================================

export function PlanBirdsModal({ update, onClose, prefillDate }) {
  const [eventType, setEventType] = useState("");
  const [date, setDate] = useState(prefillDate || todayStr());
  const [count, setCount] = useState("");
  const [notes, setNotes] = useState("");

  const TYPES = [
    { id: "order_chicks",    title: "🐣 Order chicks",        defaultNotes: "Place hatchery order or pick up local." },
    { id: "chicks_arrive",   title: "🐣 Chicks arrive",       defaultNotes: "Set up brooder, food, water before they arrive." },
    { id: "butcher_day",     title: "🔪 Butcher day",         defaultNotes: "Plan supplies, helpers, freezer space." },
    { id: "order_layers",    title: "🐔 Pick up layers",      defaultNotes: "Confirm coop is ready." },
    { id: "coop_clean",      title: "🧹 Deep clean coop",     defaultNotes: "Plan for full bedding refresh." },
    { id: "vaccinate",       title: "💉 Vaccinate flock",     defaultNotes: "" },
  ];

  const submit = () => {
    if (!eventType) return;
    const t = TYPES.find((x) => x.id === eventType);
    update((d) => {
      d.calendarEvents = d.calendarEvents || [];
      d.calendarEvents.push({
        id: newId(),
        date,
        title: count ? `${t.title} (${count})` : t.title,
        type: "chicken",
        notes: notes || t.defaultNotes,
      });
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Plan a chicken event">
      <Field label="Event type">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => { setEventType(t.id); if (!notes) setNotes(t.defaultNotes); }}
              style={{
                padding: "10px 12px", textAlign: "left",
                background: eventType === t.id ? palette.ink : palette.card,
                color: eventType === t.id ? palette.bg : palette.ink,
                border: `1.5px solid ${eventType === t.id ? palette.ink : palette.line}`,
                borderRadius: 8, cursor: "pointer",
                fontFamily: FONT_BODY, fontSize: 13,
              }}
            >
              {t.title}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Number of birds (optional)">
        <input type="number" style={inputStyle} value={count} onChange={(e) => setCount(e.target.value)} />
      </Field>
      <Field label="Notes (optional)">
        <textarea
          style={{ ...inputStyle, minHeight: 60, fontFamily: FONT_BODY }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      <Btn variant="primary" onClick={submit} disabled={!eventType}>Add event</Btn>
    </Modal>
  );
}

// ============================================================================
// ADD CUSTOM EVENT MODAL
// ============================================================================

export function AddCalendarEventModal({ update, onClose, prefillDate }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(prefillDate || todayStr());
  const [notes, setNotes] = useState("");
  const [type, setType] = useState("custom");
  const [preset, setPreset] = useState("custom");
  const [recurrence, setRecurrence] = useState("none");
  const [recurEnd, setRecurEnd] = useState("");

  // Event-type presets. "Custom event" leads the list; the rest pre-fill a
  // title + notes + category. Bird presets folded in from the old Plan Birds
  // modal, which no longer has its own entry point.
  const EVENT_PRESETS = [
    { id: "custom",        title: "",                     emoji: "⭐", cat: "custom",     notes: "" },
    { id: "order_chicks",  title: "Order chicks",         emoji: "🐣", cat: "chicken",    notes: "Place hatchery order or pick up local." },
    { id: "chicks_arrive", title: "Chicks arrive",        emoji: "🐣", cat: "chicken",    notes: "Set up brooder, food, water before they arrive." },
    { id: "butcher_day",   title: "Butcher day",          emoji: "🔪", cat: "chicken",    notes: "Plan supplies, helpers, freezer space." },
    { id: "order_layers",  title: "Pick up layers",       emoji: "🐔", cat: "egg_layers", notes: "Confirm coop is ready." },
    { id: "coop_clean",    title: "Deep clean coop",      emoji: "🧹", cat: "chicken",    notes: "Plan for full bedding refresh." },
    { id: "vaccinate",     title: "Vaccinate flock",      emoji: "💉", cat: "chicken",    notes: "" },
    { id: "order_feed",    title: "Order feed",           emoji: "🌾", cat: "custom",     notes: "" },
  ];

  // Picking a preset pre-fills title/notes/category. "Custom" clears them so
  // the user types their own. Notes/title stay editable after picking.
  const choosePreset = (p) => {
    setPreset(p.id);
    setType(p.cat);
    setTitle(p.title);
    setNotes(p.notes);
  };

  const submit = () => {
    if (!title.trim()) return;
    update((d) => {
      d.calendarEvents = d.calendarEvents || [];
      const evt = {
        id: newId(),
        date,
        title: title.trim(),
        type,
        notes,
      };
      // Only persist recurrence when it's an actual repeat — keeps one-off
      // events clean and identical in shape to every pre-existing event.
      if (recurrence && recurrence !== "none") {
        evt.recurrence = recurrence;
        if (recurEnd) evt.recurEnd = recurEnd;
      }
      d.calendarEvents.push(evt);
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Plan an event">
      <Field label="Event type">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {EVENT_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => choosePreset(p)}
              style={{
                padding: "8px 10px",
                background: preset === p.id ? palette.ink : palette.card,
                color: preset === p.id ? palette.bg : palette.ink,
                border: `1.5px solid ${preset === p.id ? palette.ink : palette.line}`,
                borderRadius: 8, cursor: "pointer",
                fontFamily: FONT_BODY, fontSize: 12.5,
              }}
            >
              {p.emoji} {p.id === "custom" ? "Custom event" : p.title}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Title">
        <input
          style={inputStyle}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Order feed"
          autoFocus
        />
      </Field>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Repeats">
        <select style={inputStyle} value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
          {RECUR_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </Field>
      {recurrence !== "none" && (
        <Field label="Repeat until (optional)">
          <input type="date" style={inputStyle} value={recurEnd} onChange={(e) => setRecurEnd(e.target.value)} />
        </Field>
      )}
      <Field label="Category">
        <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="custom">Custom / general</option>
          <option value="garden">Garden</option>
          <option value="chicken">Meat chicken</option>
          <option value="egg_layers">Egg layers</option>
          <option value="incubator">Incubator</option>
          <option value="rabbits">Rabbits</option>
        </select>
      </Field>
      <Field label="Notes (optional)">
        <textarea
          style={{ ...inputStyle, minHeight: 60, fontFamily: FONT_BODY }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      <Btn variant="primary" onClick={submit} disabled={!title.trim()}>Add event</Btn>
    </Modal>
  );
}

// ============================================================================
// EDIT EVENT MODAL
// ============================================================================

export function EditCalendarEventModal({ data, update, eventId, onClose }) {
  const event = (data.calendarEvents || []).find((e) => e.id === eventId);
  // IMPORTANT: hooks must run on every render. If we conditionally return
  // before the useState calls, removing/deleting the event mid-session would
  // cause "Rendered fewer hooks than expected" on the next render. So we
  // call all hooks unconditionally with safe defaults, then handle the
  // missing-event case in a useEffect.
  const [title, setTitle] = useState(event?.title || "");
  const [date, setDate] = useState(event?.date || "");
  const [notes, setNotes] = useState(event?.notes || "");
  const [recurrence, setRecurrence] = useState(event?.recurrence || "none");
  const [recurEnd, setRecurEnd] = useState(event?.recurEnd || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // If the event disappears (e.g. deleted in another tab / by another user)
  // close the modal cleanly. Doing this in useEffect avoids the hooks-order
  // issue and gives React a moment to settle before unmount.
  React.useEffect(() => {
    if (!event) onClose();
  }, [event, onClose]);

  if (!event) return null;

  const save = () => {
    if (!title.trim()) return;
    update((d) => {
      const evt = (d.calendarEvents || []).find((e) => e.id === eventId);
      if (evt) {
        evt.title = title.trim();
        evt.date = date;
        evt.notes = notes;
        // Series-only recurrence: editing applies to the whole series.
        if (recurrence && recurrence !== "none") {
          evt.recurrence = recurrence;
          if (recurEnd) evt.recurEnd = recurEnd;
          else delete evt.recurEnd;
        } else {
          // Switched back to one-off — strip the recurrence fields.
          delete evt.recurrence;
          delete evt.recurEnd;
        }
      }
      return d;
    });
    onClose();
  };

  const remove = () => {
    update((d) => {
      d.calendarEvents = (d.calendarEvents || []).filter((e) => e.id !== eventId);
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Edit event">
      <Field label="Title">
        <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Date">
        <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Repeats">
        <select style={inputStyle} value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
          {RECUR_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </Field>
      {recurrence !== "none" && (
        <Field label="Repeat until (optional)">
          <input type="date" style={inputStyle} value={recurEnd} onChange={(e) => setRecurEnd(e.target.value)} />
        </Field>
      )}
      {recurrence !== "none" && (
        <div style={{ fontSize: 11, color: palette.inkSoft, marginBottom: 10, lineHeight: 1.4 }}>
          Editing or deleting affects the whole repeating series.
        </div>
      )}
      <Field label="Notes">
        <textarea
          style={{ ...inputStyle, minHeight: 60, fontFamily: FONT_BODY }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
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
    </Modal>
  );
}

// ============================================================================
// EDIT ZONE MODAL — let user override their detected USDA zone
// ============================================================================

export function EditZoneModal({ data, update, onClose }) {
  // System-aware zone picker. User picks the hardiness system first, then the
  // zone within that system. Defaults match the user's existing settings, or
  // are auto-detected from their location's latitude.
  const lat = data.homesteadLocation?.lat;
  const lon = data.homesteadLocation?.lon;

  // Existing user values (may be undefined for first-time setup)
  const existingSystem = data.userZoneSystem || "USDA";
  const existingZone = data.userZone || estimateZoneForSystem(existingSystem, lat, lon);

  const [system, setSystem] = useState(existingSystem);
  const [zone, setZone] = useState(existingZone);

  // When the user changes the system, default the zone to a sensible detected
  // value for that system. This prevents leaving an invalid zone (e.g. USDA
  // "6a" selected when the user just switched to ANHGA which has no "6a").
  const handleSystemChange = (newSystem) => {
    setSystem(newSystem);
    const detected = estimateZoneForSystem(newSystem, lat, lon);
    setZone(detected);
  };

  const save = () => {
    update((d) => {
      d.userZone = zone;
      d.userZoneSystem = system;
      return d;
    });
    onClose();
  };

  const reset = () => {
    update((d) => {
      delete d.userZone;
      delete d.userZoneSystem;
      return d;
    });
    onClose();
  };

  const sys = HARDINESS_SYSTEMS[system] || HARDINESS_SYSTEMS.USDA;
  const zoneIds = Object.keys(sys.zones);

  return (
    <Modal open onClose={onClose} title="Set growing zone">
      <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        Pick the hardiness system used in your country, then your zone within it. We've guessed based on your saved location — adjust if you know better.
      </div>

      <Field label="Hardiness system">
        <select style={inputStyle} value={system} onChange={(e) => handleSystemChange(e.target.value)}>
          {Object.keys(HARDINESS_SYSTEMS).map((sysKey) => (
            <option key={sysKey} value={sysKey}>{HARDINESS_SYSTEMS[sysKey].label}</option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: palette.inkSoft, marginTop: 4, lineHeight: 1.4 }}>
          {sys.description}
        </div>
      </Field>

      <Field label="Your zone">
        <select style={inputStyle} value={zone} onChange={(e) => setZone(e.target.value)}>
          {zoneIds.map((z) => (
            <option key={z} value={z}>{sys.zones[z].label}</option>
          ))}
        </select>
      </Field>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn variant="primary" onClick={save}>Save</Btn>
        {(data.userZone || data.userZoneSystem) && (
          <Btn variant="ghost" onClick={reset}>Reset to auto-detected</Btn>
        )}
      </div>
    </Modal>
  );
}

// ============================================================================
// VIEW DAY EVENTS MODAL — shown when a day in the month grid has multiple events
// ============================================================================

export function ViewDayEventsModal({ data, update, date, setModal, onClose }) {
  // Filter all events to this date (user events + frost dates)
  const userEvents = (data.calendarEvents || []).filter((e) => e.date === date);
  const userSystem = data.userZoneSystem || "USDA";
  const userZone = data.userZone || estimateZoneForSystem(
    userSystem,
    data.homesteadLocation?.lat,
    data.homesteadLocation?.lon
  );
  const year = parseInt(date.slice(0, 4));
  const frostDates = getFrostDates(userZone, year, userSystem);
  const lastFrostStr = isoDateOf(frostDates.lastFrost);
  const firstFrostStr = isoDateOf(frostDates.firstFrost);
  const frostEvents = [];
  if (date === lastFrostStr) frostEvents.push({ id: "frost-l", title: "❄️ Average last frost", notes: "After this date, the risk of frost is generally low.", type: "frost" });
  if (date === firstFrostStr) frostEvents.push({ id: "frost-f", title: "🍂 Average first frost", notes: "Frost-tender plants should be harvested or covered by now.", type: "frost" });
  const all = [...userEvents, ...frostEvents];

  return (
    <Modal open onClose={onClose} title={fmtFullDate(date)}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {all.map((e) => {
          const isUserEvent = userEvents.some((ue) => ue.id === e.id);
          return (
            <div
              key={e.id}
              onClick={isUserEvent ? () => {
                onClose();
                setModal({ type: "editCalendarEvent", eventId: e.id });
              } : undefined}
              style={{
                padding: "10px 12px",
                background: palette.card,
                border: `1.5px solid ${palette.line}`,
                borderRadius: 8,
                cursor: isUserEvent ? "pointer" : "default",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 500, color: palette.ink, marginBottom: 4 }}>
                {e.title}
              </div>
              {e.notes && (
                <div style={{ fontSize: 12, color: palette.inkSoft, lineHeight: 1.4 }}>
                  {e.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add-to-this-day button: opens the planning picker pre-filled with this date */}
      <button
        onClick={() => { onClose(); setTimeout(() => setModal({ type: "planForDay", date }), 0); }}
        style={{
          width: "100%",
          marginTop: 14,
          padding: "12px 14px",
          background: palette.bg,
          color: palette.ink,
          border: `1.5px dashed ${palette.line}`,
          borderRadius: 8,
          cursor: "pointer",
          fontFamily: FONT_BODY,
          fontSize: 14,
          fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}
      >
        + Add to this day
      </button>
    </Modal>
  );
}

// ============================================================================
// PLAN FOR DAY MODAL — shown when user taps an empty day, or hits "+ Add" on a
// day-detail view. Lets them pick what kind of event to plan, then routes to
// the corresponding planner with the date pre-filled.
// ============================================================================

export function PlanForDayModal({ date, setModal, onClose }) {
  const choose = (type) => {
    onClose();
    setTimeout(() => setModal({ type, prefillDate: date }), 0);
  };

  return (
    <Modal open onClose={onClose} title={`Plan for ${fmtFullDate(date)}`}>
      <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
        What would you like to plan for this day?
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <PlanChoice
          icon="🌱"
          label="Plant a crop"
          sub="Pick a crop and we'll generate planting dates"
          onClick={() => {
            // PlanCropModal generates a sequence based on frost dates,
            // not a single date. So we just open the standard crop modal.
            // The date the user tapped is informational only.
            onClose();
            setTimeout(() => setModal({ type: "planCrop" }), 0);
          }}
        />
        <PlanChoice
          icon="⭐"
          label="Plan an event"
          sub="Bird events, feed runs, coop work, anything"
          onClick={() => choose("addCalendarEvent")}
        />
      </div>
    </Modal>
  );
}

function PlanChoice({ icon, label, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "12px 14px",
        background: palette.card,
        border: `1.5px solid ${palette.line}`,
        borderRadius: 10,
        cursor: "pointer",
        textAlign: "left",
        display: "flex", alignItems: "center", gap: 12,
        fontFamily: FONT_BODY,
      }}
    >
      <div style={{ fontSize: 26, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: palette.ink }}>{label}</div>
        <div style={{ fontSize: 12, color: palette.inkSoft, marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function fmtFullDate(isoStr) {
  const d = new Date(isoStr + "T12:00");
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

// Short "Month Day" label for a Date object (e.g. "Oct 15"). Used for the
// frost-date hints in the crop planner.
function fmtMonthDay(d) {
  if (!d) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isoDateOf(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
