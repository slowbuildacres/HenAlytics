// ============================================================================
// chore-list.js — Build a chore list for a given week from a user's data blob
// ----------------------------------------------------------------------------
// Lives in api/_lib so both the email endpoint and (eventually) frontend
// helpers can pull chores the same way.
//
// Inputs:
//   data      — the user's full Henalytics data blob (same shape as defaultData)
//   weekStart — Date object representing Monday 00:00 (local) of the week
//   weekEnd   — Date object representing Sunday 23:59:59 (local) of the week
//
// Output: Array of normalized chore objects, sorted by date ascending:
//   {
//     date: "2026-05-18",       // ISO date string
//     dayOfWeek: "Monday",       // Friendly day name for the email
//     title: "Plant tomatoes",   // The event's title
//     type: "garden",            // From calendarEvents.type — controls emoji
//     notes: "San Marzano variety", // Optional, from the event
//   }
//
// We intentionally pull only from data.calendarEvents — the unified event store
// that already aggregates everything from "plan a crop" (planting/harvest dates),
// "plan birds" (butcher dates), rabbit kindle reminders, foaling reminders, vet
// visits, custom events, etc. Frost dates are excluded per product spec
// ("frost dates aren't chores").
// ============================================================================

// Map event types to emoji for the email. Order roughly matches priority for
// reading at a glance. Unknown types fall back to a calendar emoji.
const TYPE_EMOJI = {
  garden:   '🌱',
  chicken:  '🐔',
  bird:     '🐔',
  rabbit:   '🐇',
  goat:     '🐐',
  sheep:    '🐑',
  cow:      '🐄',
  pig:      '🐖',
  horse:    '🐴',
  dog:      '🐕',
  bee:      '🐝',
  fish:     '🐟',
  vet:      '💉',
  farrier:  '🧲',
  butcher:  '🔪',
  harvest:  '🌾',
  hatch:    '🐣',
  custom:   '⭐',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Format a Date to "YYYY-MM-DD" using local calendar date.
 * Matches the isoDate() helper in Calendar.jsx so date comparisons line up
 * with what the frontend stores.
 */
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Get the emoji prefix for an event type. Defaults to 📅.
 */
function emojiForType(type) {
  if (!type) return '📅';
  return TYPE_EMOJI[type.toLowerCase()] || '📅';
}

/**
 * Build the chore list for a given week from a user's data blob.
 */
export function getChoresForWeek(data, weekStart, weekEnd) {
  if (!data || !Array.isArray(data.calendarEvents)) return [];

  const startStr = isoDate(weekStart);
  const endStr = isoDate(weekEnd);

  const chores = data.calendarEvents
    .filter((e) => {
      // Defensive: events from old/buggy state might lack a date
      if (!e || typeof e.date !== 'string') return false;
      return e.date >= startStr && e.date <= endStr;
    })
    .map((e) => {
      // Build a Date object in local time. e.date is "YYYY-MM-DD"; constructing
      // with new Date("YYYY-MM-DD") would parse as UTC midnight and could shift
      // the day-of-week in some timezones. Parse the parts manually instead.
      const [y, m, d] = e.date.split('-').map(Number);
      const eventDate = new Date(y, m - 1, d);
      return {
        date: e.date,
        dayOfWeek: DAY_NAMES[eventDate.getDay()],
        title: e.title || 'Untitled event',
        type: e.type || 'custom',
        emoji: emojiForType(e.type),
        notes: e.notes || '',
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return chores;
}

/**
 * Compute this coming week's Monday-Sunday window from a given "now" date.
 * Returns { weekStart, weekEnd } as Date objects.
 *
 * When sent on Sunday evening, this returns the week that STARTS the next
 * morning (Monday). When called on any other day, it returns the upcoming
 * Mon-Sun window.
 */
export function getUpcomingWeekWindow(now = new Date()) {
  // Normalize to midnight to avoid time-of-day surprises in week math.
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // JavaScript getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday.
  // We want the next Monday (or today if it's already Monday).
  const dayOfWeek = today.getDay();

  // Days until next Monday:
  //   Sunday (0) -> 1 day forward
  //   Monday (1) -> 0 days (today is Monday, return this week)
  //   Tuesday-Saturday (2-6) -> wrap to next Monday
  //
  // For the chore email sent Sunday evening, today=Sunday so this gives +1 day
  // → Monday tomorrow. Exactly what we want.
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + daysUntilMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Sunday
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

/**
 * Format a week window for human display in email subject + body.
 * Example: "May 18 – 24" (or "May 30 – Jun 5" if it spans months).
 */
export function formatWeekRange(weekStart, weekEnd) {
  const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startM = monthShort[weekStart.getMonth()];
  const endM = monthShort[weekEnd.getMonth()];
  const startD = weekStart.getDate();
  const endD = weekEnd.getDate();
  if (startM === endM) {
    return `${startM} ${startD} – ${endD}`;
  }
  return `${startM} ${startD} – ${endM} ${endD}`;
}
