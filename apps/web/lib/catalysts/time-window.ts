/**
 * Catalyst time-window logic.
 *
 * Phase 5 anomaly semantics are frozen to the REGULAR session with delayed-SIP
 * price data. The effective timestamp (price data time, NEVER orchestration
 * time) is the hard upper bound — evidence after it cannot explain a snapshot.
 * The window starts at the regular-session close immediately preceding the
 * session whose prices are scored, so post-close earnings, overnight filings,
 * and pre-market news are captured. Both boundaries are inclusive.
 */
import { barSessionDate, etSessionCloseIso, previousETWeekday } from "@/lib/breadth/dates";

export interface CatalystWindow {
  /** ISO instant of the previous regular-session close (ET 20:00 = 4pm ET). */
  startIso: string;
  /** Hard upper bound: the anomaly snapshot's effective price-data time. */
  cutoffIso: string | null;
  /** Session date (YYYY-MM-DD, ET) of the evidence target session. */
  currentSessionDate: string;
}

function parseMs(iso: string): number | null {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Backward-compatible alias: previous weekday from an ET date key.
 * Shared implementation lives in breadth/dates.
 */
export function previousWeekdayDateKey(dateKey: string): string {
  return previousETWeekday(dateKey);
}

export function computeCatalystWindow(asOfIso: string | null, now = Date.now()): CatalystWindow {
  const ms = asOfIso ? parseMs(asOfIso) ?? now : now;
  const currentSessionDate = barSessionDate(new Date(ms).toISOString()) ?? "";
  const previousCloseDate = previousETWeekday(currentSessionDate);
  return {
    startIso: etSessionCloseIso(previousCloseDate),
    cutoffIso: asOfIso,
    currentSessionDate,
  };
}

/**
 * Evidence is only usable inside [start, cutoff] — inclusive on both ends so
 * an article timestamp exactly equal to the effective close still qualifies.
 */
export function inCatalystWindow(
  publishedAtIso: string,
  window: CatalystWindow,
): boolean {
  if (publishedAtIso < window.startIso) return false;
  if (window.cutoffIso !== null && publishedAtIso > window.cutoffIso) return false;
  return true;
}

