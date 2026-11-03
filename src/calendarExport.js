// ============================================================================
// CALENDAR EXPORT (.ics)
// ----------------------------------------------------------------------------
// Turns data.calendarEvents into a standard iCalendar file that Google
// Calendar, Outlook and Apple Calendar all import. Every event gets a stable
// UID (henalytics-<id>), so importing again later updates existing events
// instead of duplicating them in Apple Calendar and Outlook. (Google
// Calendar's file import adds new events but skips ones it already has.)
//
// This is a one-time snapshot. A live, auto-updating feed needs a small
// server endpoint that serves the same text from a private URL. buildICS() is
// written so that endpoint can reuse it unchanged.
// ============================================================================

const pad = (n) => String(n).padStart(2, "0");

function ymd(dateStr) {
  return String(dateStr || "").slice(0, 10).replace(/-/g, "");
}

function nextDay(dateStr) {
  const [y, m, d] = String(dateStr).slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
}

function stamp(date = new Date()) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

// RFC 5545 text escaping.
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// RFC 5545 line folding: lines over 75 octets continue on the next line,
// which starts with a space. Folds on UTF-8 byte length, never mid-character.
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = "";
  let curBytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines lose 1 to the leading space
    if (curBytes + b > limit) {
      out.push(cur);
      cur = "";
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  if (cur) out.push(cur);
  return out.join("\r\n ");
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}/.test(String(s || ""));

// Calendar.jsx stores repeats as recurrence: daily|weekly|biweekly|monthly|
// yearly (+ optional recurEnd). Exported as a real repeating event so the
// calendar app keeps showing it past the export date.
const RRULES = {
  daily: "FREQ=DAILY",
  weekly: "FREQ=WEEKLY",
  biweekly: "FREQ=WEEKLY;INTERVAL=2",
  monthly: "FREQ=MONTHLY",
  yearly: "FREQ=YEARLY",
};
function rruleFor(e) {
  const base = RRULES[e.recurrence];
  if (!base) return null;
  return isDate(e.recurEnd) ? `${base};UNTIL=${ymd(e.recurEnd)}` : base;
}

// opts.includePastDays: how far back to include (default 365). Older events
// are left out so the calendar isn't flooded with years of history.
export function buildICS(data, opts = {}) {
  const includePastDays = opts.includePastDays == null ? 365 : opts.includePastDays;
  const name = (data && data.homesteadName) || "Homestead";
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - includePastDays);
  const cutoffStr = `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}`;
  const dtstamp = stamp(now);

  const events = ((data && data.calendarEvents) || [])
    .filter((e) => {
      if (!e || !isDate(e.date)) return false;
      if (e.date.slice(0, 10) >= cutoffStr) return true;
      // An old repeating event still counts if it hasn't ended.
      return !!RRULES[e.recurrence] && (!isDate(e.recurEnd) || e.recurEnd >= cutoffStr);
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Henalytics//Homestead Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(`${name} (Henalytics)`)}`,
    "X-WR-CALDESC:Chores\\, reminders and dates from Henalytics",
  ];

  events.forEach((e) => {
    const title = e.title || "Homestead reminder";
    const desc = [e.notes, e.varietyName && `Variety: ${e.varietyName}`].filter(Boolean).join("\n");
    const end = isDate(e.endDate) && e.endDate > e.date ? nextDay(e.endDate) : nextDay(e.date);
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:henalytics-${esc(e.id || `${ymd(e.date)}-${title}`)}@henalytics.app`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${ymd(e.date)}`);
    lines.push(`DTEND;VALUE=DATE:${end}`);
    const rrule = rruleFor(e);
    if (rrule) lines.push(`RRULE:${rrule}`);
    lines.push(fold(`SUMMARY:${esc(title)}`));
    if (desc) lines.push(fold(`DESCRIPTION:${esc(desc)}`));
    if (e.type) lines.push(fold(`CATEGORIES:${esc(String(e.type).replace(/_/g, " "))}`));
    lines.push("TRANSP:TRANSPARENT"); // all-day reminders shouldn't block "busy" time
    if (e.done || e.completed) lines.push("STATUS:CANCELLED");
    // Morning-of reminder on the phone/computer calendar.
    lines.push("BEGIN:VALARM");
    lines.push("ACTION:DISPLAY");
    lines.push(fold(`DESCRIPTION:${esc(title)}`));
    lines.push("TRIGGER:PT8H"); // 8:00 am on the day (all-day events start at midnight)
    lines.push("END:VALARM");
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return { text: lines.join("\r\n") + "\r\n", count: events.length };
}

// Saves the file. On phones, opens the share sheet (pick Calendar, Outlook,
// Gmail, Files, etc.); on desktop, downloads it.
export async function exportCalendarICS(data, opts) {
  const { text, count } = buildICS(data, opts);
  const safe = ((data && data.homesteadName) || "homestead").replace(/[^a-zA-Z0-9-_]/g, "_") || "homestead";
  const filename = `${safe}-calendar.ics`;
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });

  try {
    if (typeof File !== "undefined" && navigator.canShare) {
      const file = new File([blob], filename, { type: "text/calendar" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Henalytics calendar" });
        return { ok: true, count, method: "share" };
      }
    }
  } catch (e) {
    if (e && e.name === "AbortError") return { ok: false, count, cancelled: true };
    // fall through to download
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true, count, method: "download" };
}
