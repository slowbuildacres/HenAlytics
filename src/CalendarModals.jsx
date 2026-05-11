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
  ZONE_INFO, CROPS, methodsForCrop, generateCropEvents, getFrostDates, estimateZone,
} from "./gardenAlmanac.js";
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

const newId = () => Math.random().toString(36).substring(2, 11);

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

// ============================================================================
// PLAN CROP MODAL — pick a crop, pick a method, generate events
// ============================================================================

export function PlanCropModal({ data, update, onClose }) {
  const [step, setStep] = useState(1); // 1 = pick crop, 2 = pick method, 3 = editable preview
  const [cropId, setCropId] = useState(null);
  const [method, setMethod] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  // editableDates: { [eventId]: dateString } — user-overridden dates
  const [editableDates, setEditableDates] = useState({});

  const userSystem = data.userZoneSystem || "USDA";
  const userZone = data.userZone || estimateZoneForSystem(
    userSystem,
    data.homesteadLocation?.lat,
    data.homesteadLocation?.lon
  );
  const frostDates = getFrostDates(userZone, year, userSystem);
  const zoneLabel = getZoneInfo(userSystem, userZone).label;
  const crop = CROPS.find((c) => c.id === cropId);
  const methods = cropId ? methodsForCrop(cropId) : [];
  const generatedEvents = (cropId && method) ? generateCropEvents(cropId, method, frostDates) : [];

  // When year or method changes, reset editable dates so suggestions refresh
  const handleSetMethod = (m) => { setMethod(m); setEditableDates({}); setStep(3); };
  const handleSetYear = (y) => { setYear(y); setEditableDates({}); };

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
    update((d) => {
      d.calendarEvents = d.calendarEvents || [];
      // Replace any existing events for this crop/year combo so re-planning doesn't double up
      d.calendarEvents = d.calendarEvents.filter((e) => !(e.cropId === cropId && e.date.startsWith(String(year))));
      d.calendarEvents.push(...generatedEvents.map((e) => ({
        ...e,
        date: getDate(e),   // use user's edited date if set
        planYear: year,
      })));
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={
      step === 1 ? "Plan a crop" :
      step === 2 ? `Plan ${crop?.name}` :
      `Preview: ${crop?.name}`
    }>
      {step === 1 && (
        <>
          <div style={{ fontSize: 13, color: palette.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
            Pick a crop and we'll generate planting dates based on your zone ({zoneLabel}).
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 8,
            maxHeight: 340,
            overflowY: "auto",
            paddingRight: 4,
          }}>
            {CROPS.map((c) => (
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
          <div style={{ marginTop: 14 }}>
            <Btn variant="ghost" onClick={() => setStep(1)}>← Pick a different crop</Btn>
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
            Dates are suggested based on your zone. Tap any date to adjust it.
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
            <Btn variant="ghost" onClick={() => setStep(2)}>← Back</Btn>
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

  const submit = () => {
    if (!title.trim()) return;
    update((d) => {
      d.calendarEvents = d.calendarEvents || [];
      d.calendarEvents.push({
        id: newId(),
        date,
        title: title.trim(),
        type,
        notes,
      });
      return d;
    });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Add custom event">
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
  if (!event) {
    onClose();
    return null;
  }
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.date);
  const [notes, setNotes] = useState(event.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    if (!title.trim()) return;
    update((d) => {
      const evt = (d.calendarEvents || []).find((e) => e.id === eventId);
      if (evt) {
        evt.title = title.trim();
        evt.date = date;
        evt.notes = notes;
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
          icon="🐔"
          label="Bird event"
          sub="Order chicks, butcher day, deep clean coop, etc."
          onClick={() => choose("planBirds")}
        />
        <PlanChoice
          icon="⭐"
          label="Custom event"
          sub="Order feed, fix coop, anything else"
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

function isoDateOf(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
