/**
 * US business-day utilities for daily (FRED) freshness.
 *
 * A US business day is Monday–Friday excluding US market holidays. The holiday
 * set is a small embedded table (2024–2027, observed dates) — deliberately no
 * external dependency. Extend the table as new years are reached.
 */

const US_MARKET_HOLIDAYS = new Set<string>([
  // 2024
  "2024-01-01",
  "2024-01-15",
  "2024-02-19",
  "2024-03-29",
  "2024-05-27",
  "2024-06-19",
  "2024-07-04",
  "2024-09-02",
  "2024-11-28",
  "2024-12-25",
  // 2025
  "2025-01-01",
  "2025-01-20",
  "2025-02-17",
  "2025-04-18",
  "2025-05-26",
  "2025-06-19",
  "2025-07-04",
  "2025-09-01",
  "2025-11-27",
  "2025-12-25",
  // 2026
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
  // 2027
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
]);

/** True when the given UTC date is a US business day (Mon–Fri, not a holiday). */
export function isUsBusinessDay(date: Date): boolean {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !US_MARKET_HOLIDAYS.has(date.toISOString().slice(0, 10));
}

/**
 * Number of US business days in the half-open interval (obsDate, today],
 * i.e. business days strictly AFTER the observation date through today.
 *
 * Examples (all dates are US calendar dates):
 *   Friday 08-28 observed Saturday 08-29 → 0 (weekend not a business day)
 *   Friday 08-28 observed Sunday 08-30   → 0
 *   Friday 08-28 observed Monday 08-31   → 1 (Monday)
 *   Friday 08-28 observed Tuesday 09-01  → 2 (Monday, Tuesday)
 */
export function countElapsedBusinessDays(obsDate: string, today: string): number {
  const start = Date.parse(`${obsDate}T00:00:00Z`);
  const end = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;

  let count = 0;
  const cursor = new Date(start);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor.getTime() <= end) {
    if (isUsBusinessDay(cursor)) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}
