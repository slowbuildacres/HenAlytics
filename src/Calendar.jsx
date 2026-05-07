// ============================================================================
// CALENDAR TAB
// ----------------------------------------------------------------------------
// A master calendar showing:
//   - Almanac frost-date markers (last/first frost for the user's zone)
//   - User-planned events (planting, butchering, custom tasks)
//   - "Plan a crop" wizard generates a sequence of events for a chosen crop
//
// Two views: timeline (chronological list) and month grid (calendar style).
// All events are stored in data.calendarEvents. Auto-generated almanac events
// (frost dates) are computed from the user's zone, not stored.
// ============================================================================

import React, { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight,
  X, Edit3, Sprout, Drumstick, Star,
} from "lucide-react";
import {
  ZONE_INFO, estimateZone, getFrostDates, frostDateEvents,
  CROPS, methodsForCrop, generateCropEvents,
} from "./gardenAlmanac.js";

const palette = {
  bg: "#F4EDE0", bgAlt: "#EBE0CC", ink: "#2C1810", inkSoft: "#5C4530",
  accent: "#C84B31", leaf: "#5A7A3C", leafSoft: "#A8C078",
  yolk: "#E8B547", yolkSoft: "#F2D58A", feather: "#8B6F47", featherSoft: "#C9A77B",
  card: "#FAF5EA", line: "#2C181030",
};
const FONT_DISPLAY = `'DM Serif Display', Georgia, serif`;
const FONT_BODY = `'Be Vietnam Pro', -apple-system, sans-serif`;

const monthNames = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function CalendarPage({ data, update, setModal }) {
  const [view, setView] = useState("timeline"); // "timeline" | "month"

  const userZone = data.userZone || estimateZone(
    data.homesteadLocation?.lat,
    data.homesteadLocation?.lon
  );
  const year = new Date().getFullYear();
  const frostDates = useMemo(() => getFrostDates(userZone, year), [userZone, year]);

  // Combine user events with almanac frost events
  const userEvents = data.calendarEvents || [];
  const allEvents = useMemo(() => {
    const frostEvts = frostDateEvents(frostDates);
    return [...userEvents, ...frostEvts].sort((a, b) => a.date.localeCompare(b.date));
  }, [userEvents, frostDates]);

  return (
    <div>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14, flexWrap: "wrap", gap: 10,
      }}>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, margin: 0, color: palette.ink }}>
          calendar
        </h2>
        <div style={{ display: "flex", gap: 6 }}>
          <ToggleBtn active={view === "timeline"} onClick={() => setView("timeline")}>Timeline</ToggleBtn>
          <ToggleBtn active={view === "month"} onClick={() => setView("month")}>Month</ToggleBtn>
        </div>
      </div>

      {/* Zone & frost reference card */}
      <ZoneCard frostDates={frostDates} userZone={userZone} setModal={setModal} hasLocation={!!data.homesteadLocation} />

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <QuickActionBtn icon={Sprout} label="Plan a crop" onClick={() => setModal({ type: "planCrop" })} />
        <QuickActionBtn icon={Drumstick} label="Plan birds" onClick={() => setModal({ type: "planBirds" })} />
        <QuickActionBtn icon={Star} label="Custom event" onClick={() => setModal({ type: "addCalendarEvent" })} />
      </div>

      {/* Main view */}
      {view === "timeline" && (
        <TimelineView events={allEvents} update={update} setModal={setModal} userEvents={userEvents} />
      )}
      {view === "month" && (
        <MonthView events={allEvents} update={update} setModal={setModal} userEvents={userEvents} />
      )}
    </div>
  );
}

// ============================================================================
// HEADER COMPONENTS
// ============================================================================

function ToggleBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 6,
        border: `1.5px solid ${palette.line}`,
        background: active ? palette.ink : palette.card,
        color: active ? palette.bg : palette.ink,
        fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ZoneCard({ frostDates, userZone, setModal, hasLocation }) {
  const fmtMonth = (d) => `${monthShort[d.getMonth()]} ${d.getDate()}`;
  return (
    <div
      onClick={() => setModal({ type: "editZone" })}
      style={{
        background: palette.card,
        border: `1.5px solid ${palette.line}`,
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
        cursor: "pointer",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 6,
      }}>
        <div style={{ fontSize: 10, color: palette.inkSoft, textTransform: "uppercase", letterSpacing: 1 }}>
          Your growing zone
        </div>
        <Edit3 size={14} color={palette.inkSoft} />
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink, marginBottom: 6 }}>
        {ZONE_INFO[userZone]?.label || `Zone ${userZone}`}
      </div>
      <div style={{ fontSize: 13, color: palette.inkSoft, lineHeight: 1.5 }}>
        Last frost: <strong style={{ color: palette.ink }}>{fmtMonth(frostDates.lastFrost)}</strong> · First frost: <strong style={{ color: palette.ink }}>{fmtMonth(frostDates.firstFrost)}</strong>
        {!hasLocation && (
          <div style={{ fontSize: 11, fontStyle: "italic", marginTop: 4 }}>
            Set your location in settings for a more accurate zone.
          </div>
        )}
      </div>
    </div>
  );
}

function QuickActionBtn({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: "1 1 100px",
        padding: "10px 14px",
        background: palette.card,
        border: `1.5px solid ${palette.line}`,
        borderRadius: 10,
        cursor: "pointer",
        fontFamily: FONT_BODY,
        fontSize: 13,
        fontWeight: 600,
        color: palette.ink,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <Icon size={16} strokeWidth={2} />
      {label}
    </button>
  );
}

// ============================================================================
// TIMELINE VIEW
// ============================================================================

function TimelineView({ events, update, setModal, userEvents }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = isoDate(today);

  // Group by month
  const byMonth = {};
  events.forEach((e) => {
    const key = e.date.slice(0, 7); // YYYY-MM
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(e);
  });

  const months = Object.keys(byMonth).sort();

  if (events.length === 0) {
    return (
      <div style={{
        padding: 32, background: palette.card, border: `1.5px dashed ${palette.line}`,
        borderRadius: 12, textAlign: "center", color: palette.inkSoft,
      }}>
        <CalendarIcon size={32} strokeWidth={1.5} style={{ marginBottom: 10 }} />
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink, marginBottom: 4 }}>
          No events yet
        </div>
        <div style={{ fontSize: 13 }}>
          Tap "Plan a crop" or "Custom event" to get started.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {months.map((m) => {
        const [y, mo] = m.split("-");
        const isPast = m < todayStr.slice(0, 7);
        return (
          <div key={m} style={{ opacity: isPast ? 0.55 : 1 }}>
            <div style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 18,
              color: palette.ink,
              marginBottom: 8,
              paddingBottom: 4,
              borderBottom: `1.5px solid ${palette.line}`,
            }}>
              {monthNames[parseInt(mo) - 1]} {y}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {byMonth[m].map((e) => (
                <EventRow
                  key={e.id}
                  event={e}
                  isPast={e.date < todayStr}
                  isToday={e.date === todayStr}
                  isUserEvent={userEvents.some((ue) => ue.id === e.id)}
                  setModal={setModal}
                  update={update}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventRow({ event, isPast, isToday, isUserEvent, setModal, update }) {
  const d = new Date(event.date + "T12:00");
  const accentColor = (
    event.type === "frost" ? "#7AA8B8" :
    event.type === "garden" ? palette.leaf :
    event.type === "chicken" ? palette.feather :
    event.type === "egg_layers" ? palette.yolk :
    palette.ink
  );

  return (
    <div
      onClick={isUserEvent ? () => setModal({ type: "editCalendarEvent", eventId: event.id }) : undefined}
      style={{
        background: isToday ? palette.yolkSoft : palette.card,
        border: `1.5px solid ${isToday ? palette.yolk : palette.line}`,
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: 8,
        padding: "10px 12px",
        cursor: isUserEvent ? "pointer" : "default",
        display: "flex", alignItems: "center", gap: 10,
      }}
    >
      <div style={{
        flexShrink: 0,
        width: 44,
        textAlign: "center",
        borderRight: `1px solid ${palette.line}`,
        paddingRight: 8,
      }}>
        <div style={{ fontSize: 10, color: palette.inkSoft, textTransform: "uppercase" }}>
          {dayShort[d.getDay()].slice(0, 3)}
        </div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: palette.ink, lineHeight: 1 }}>
          {d.getDate()}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: palette.ink, fontWeight: 500, marginBottom: 2 }}>
          {event.title}
        </div>
        {event.notes && (
          <div style={{ fontSize: 11, color: palette.inkSoft, lineHeight: 1.4 }}>
            {event.notes}
          </div>
        )}
      </div>
      {isUserEvent && <Edit3 size={14} color={palette.inkSoft} />}
    </div>
  );
}

// ============================================================================
// MONTH GRID VIEW
// ============================================================================

function MonthView({ events, update, setModal, userEvents }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay(); // 0 = Sunday

  // Build a map of date -> events
  const eventsByDate = {};
  events.forEach((e) => {
    if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
    eventsByDate[e.date].push(e);
  });

  // Build the days array for rendering. Pad start with empty cells to align
  // the first day of the month with the right weekday column.
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const goPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const goNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  return (
    <div>
      {/* Month nav */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10,
      }}>
        <button onClick={goPrev} style={navBtnStyle} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: palette.ink }}>
          {monthNames[viewMonth]} {viewYear}
        </div>
        <button onClick={goNext} style={navBtnStyle} aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 2,
        marginBottom: 4,
      }}>
        {dayShort.map((d) => (
          <div key={d} style={{
            textAlign: "center", fontSize: 10, color: palette.inkSoft,
            textTransform: "uppercase", letterSpacing: 0.5, padding: "4px 0",
          }}>
            {d.slice(0, 1)}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 2,
      }}>
        {cells.map((d, i) => {
          if (d === null) {
            return <div key={i} style={{ aspectRatio: "1 / 1.3" }} />;
          }
          const cellDate = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const cellEvents = eventsByDate[cellDate] || [];
          const isToday = cellDate === isoDate(today);

          return (
            <div
              key={i}
              onClick={() => {
                if (cellEvents.length === 0) {
                  // Empty day — open the "what to plan" picker
                  setModal({ type: "planForDay", date: cellDate });
                } else if (cellEvents.length === 1) {
                  const userEvent = cellEvents.find((e) => userEvents.some((ue) => ue.id === e.id));
                  if (userEvent) {
                    setModal({ type: "editCalendarEvent", eventId: userEvent.id });
                  } else {
                    // It's a frost-date marker — show the day-detail with "+ Add" option
                    setModal({ type: "viewDayEvents", date: cellDate });
                  }
                } else {
                  setModal({ type: "viewDayEvents", date: cellDate });
                }
              }}
              style={{
                aspectRatio: "1 / 1.3",
                padding: 4,
                background: isToday ? palette.yolkSoft : palette.card,
                border: `1px solid ${isToday ? palette.yolk : palette.line}`,
                borderRadius: 6,
                fontSize: 11,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 1,
                overflow: "hidden",
              }}
            >
              <div style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 13,
                color: palette.ink,
                lineHeight: 1,
                marginBottom: 1,
              }}>
                {d}
              </div>
              {cellEvents.slice(0, 2).map((e) => (
                <div
                  key={e.id}
                  style={{
                    fontSize: 9,
                    background: (
                      e.type === "frost" ? "#7AA8B820" :
                      e.type === "garden" ? `${palette.leaf}20` :
                      e.type === "chicken" ? `${palette.feather}25` :
                      `${palette.ink}15`
                    ),
                    color: palette.ink,
                    padding: "1px 3px",
                    borderRadius: 3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: 1.3,
                  }}
                >
                  {e.title}
                </div>
              ))}
              {cellEvents.length > 2 && (
                <div style={{ fontSize: 9, color: palette.inkSoft, fontWeight: 600 }}>
                  +{cellEvents.length - 2} more
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const navBtnStyle = {
  background: palette.card,
  border: `1.5px solid ${palette.line}`,
  borderRadius: 8,
  padding: 6,
  cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: palette.ink,
};

// ============================================================================
// HELPERS
// ============================================================================

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
