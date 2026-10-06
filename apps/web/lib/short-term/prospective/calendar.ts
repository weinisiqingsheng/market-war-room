import "server-only";
import type { ProspectiveSessionCalendar, ProspectiveSessionWindow } from "./types";

/**
 * Source: NYSE Holidays & Trading Hours, 2026–2028 table and 2026 yearly
 * trading calendar. This bounded snapshot intentionally returns null outside
 * its published coverage instead of inferring an exchange session.
 */
export const NYSE_REGULAR_SESSION_CALENDAR_VERSION = "nyse-core-session-2026-2028-v1" as const;
export const NYSE_REGULAR_SESSION_CALENDAR_SOURCE =
  "https://www.nyse.com/trade/hours-calendars" as const;

const SUPPORTED_START = "2026-01-01";
const SUPPORTED_END = "2028-12-31";
const EASTERN_TIME_ZONE = "America/New_York";

const CLOSED_DATES = new Set([
  // NYSE published 2026 holidays.
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
  // NYSE published 2027 holidays.
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-03-26",
  "2027-05-31",
  "2027-06-18",
  "2027-07-05",
  "2027-09-06",
  "2027-11-25",
  "2027-12-24",
  // NYSE published 2028 holidays. New Year's Day falls on Saturday and is
  // explicitly not observed by the exchange.
  "2028-01-17",
  "2028-02-21",
  "2028-04-14",
  "2028-05-29",
  "2028-06-19",
  "2028-07-04",
  "2028-09-04",
  "2028-11-23",
  "2028-12-25",
]);

const EARLY_CLOSE_DATES = new Set([
  "2026-11-27",
  "2026-12-24",
  "2027-11-26",
  "2028-07-03",
  "2028-11-24",
]);

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`));
}

function isSupported(value: string): boolean {
  return isDateKey(value) && value >= SUPPORTED_START && value <= SUPPORTED_END;
}

function isWeekday(value: string): boolean {
  const day = new Date(`${value}T12:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

function easternOffsetMinutes(dateKey: string): number | null {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    timeZoneName: "longOffset",
  }).formatToParts(new Date(`${dateKey}T12:00:00.000Z`));
  const offset = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!match) return null;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "+" ? minutes : -minutes;
}

function easternInstant(dateKey: string, hour: number, minute: number): string | null {
  const offset = easternOffsetMinutes(dateKey);
  if (offset === null) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offset * 60_000).toISOString();
}

function addCalendarDay(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function sessionFor(dateKey: string): ProspectiveSessionWindow | null {
  if (!isSupported(dateKey) || !isWeekday(dateKey) || CLOSED_DATES.has(dateKey)) return null;
  const earlyClose = EARLY_CLOSE_DATES.has(dateKey);
  const openAt = easternInstant(dateKey, 9, 30);
  const closeAt = easternInstant(dateKey, earlyClose ? 13 : 16, 0);
  if (!openAt || !closeAt) return null;
  return { sessionDate: dateKey, openAt, closeAt, regular: true, earlyClose };
}

export const NYSE_REGULAR_SESSION_CALENDAR: ProspectiveSessionCalendar = {
  sessionFor,
  nextSessionAfter(dateKey) {
    if (!isSupported(dateKey)) return null;
    let candidate = addCalendarDay(dateKey);
    while (candidate <= SUPPORTED_END) {
      const session = sessionFor(candidate);
      if (session) return session;
      candidate = addCalendarDay(candidate);
    }
    return null;
  },
  containsRegularInstant(window, instant) {
    const timestamp = Date.parse(instant);
    return (
      Number.isFinite(timestamp) &&
      timestamp >= Date.parse(window.openAt) &&
      timestamp <= Date.parse(window.closeAt)
    );
  },
};
