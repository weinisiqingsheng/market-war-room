import type { MacroFrequency, MacroSignalId, Tone } from "@war-room/types";
import { countElapsedBusinessDays } from "./business-days";
import type { MacroDataConfig } from "./config";
import { parseIsoMs } from "./normalize";

export interface MacroInterpretation {
  interpretation: string;
  tone: Tone;
}

/**
 * Deterministic DISPLAY interpretations only — UI labels, not causal claims
 * and not Market Regime scoring (that arrives in a later phase).
 *
 * Raw price direction and market interpretation are deliberately kept
 * separate: e.g. WTI +2.5% is an "up" price move, but its interpretation is
 * "Inflation Risk" (negative tone).
 */
export function interpretMacroSignal(
  id: MacroSignalId,
  value: number | null,
  change: number | null,
  changePct: number | null,
): MacroInterpretation | null {
  if (value === null || change === null) return null;

  switch (id) {
    case "vix": {
      if (changePct !== null && changePct <= -3) {
        return { interpretation: "Volatility Calm", tone: "positive" };
      }
      if (changePct !== null && changePct >= 5) {
        return { interpretation: "Volatility Rising", tone: "warning" };
      }
      if (change < 0) return { interpretation: "Volatility Easing", tone: "positive" };
      if (change > 0) return { interpretation: "Volatility Firm", tone: "neutral" };
      return { interpretation: "Neutral", tone: "neutral" };
    }
    case "us10y": {
      if (change > 0) return { interpretation: "Rate Pressure", tone: "warning" };
      if (change < 0) return { interpretation: "Rate Relief", tone: "positive" };
      return { interpretation: "Neutral", tone: "neutral" };
    }
    case "wti": {
      if (changePct !== null && changePct >= 1) {
        return { interpretation: "Inflation Risk", tone: "negative" };
      }
      if (changePct !== null && changePct <= -1) {
        return { interpretation: "Inflation Relief", tone: "positive" };
      }
      return { interpretation: "Neutral", tone: "neutral" };
    }
    // Nominal Broad U.S. Dollar Index (FRED DTWEXBGS). "Near-zero" is a small
    // absolute index move (0.05 pts on a ~118 index) — not ICE DXY, so no DXY
    // labels ever appear here.
    case "usd_broad": {
      if (change > 0.05) return { interpretation: "Dollar Strength", tone: "neutral" };
      if (change < -0.05) return { interpretation: "Dollar Softening", tone: "neutral" };
      return { interpretation: "Dollar Neutral", tone: "neutral" };
    }
    case "gold": {
      if (change > 0) return { interpretation: "Safe-Haven Bid", tone: "positive" };
      return { interpretation: "Neutral", tone: "neutral" };
    }
    case "btc": {
      if (change > 0) return { interpretation: "Risk Appetite", tone: "positive" };
      if (change < 0) return { interpretation: "Risk Sentiment Weak", tone: "negative" };
      return { interpretation: "Neutral", tone: "neutral" };
    }
  }
}

/**
 * Freshness depends on source frequency, never one blanket threshold:
 * - realtime (BTC): tight 24/7 threshold
 * - intraday (Twelve Data): tight provider-defined threshold
 * - daily (FRED): business-day aware — a Friday observation viewed Saturday or
 *   Sunday is normal, and weekend calendar time is not counted as missing
 *   daily observations. Stale only once more than 2 expected US business-day
 *   observations are missing.
 */
export function computeMacroStale(
  frequency: MacroFrequency,
  asOf: string | null,
  config: MacroDataConfig,
  now: number,
): boolean {
  if (asOf === null) return true; // data present but no timestamp → treat stale
  if (frequency === "daily") return computeDailyStale(asOf, now);

  const timestamp = parseIsoMs(asOf);
  if (timestamp === null) return true;
  const threshold = config.staleAfterMs[frequency];
  return now - timestamp > threshold;
}

const DAILY_STALE_ELAPSED_BUSINESS_DAYS = 3; // stale when >2 expected obs missing

/**
 * Business-day-aware daily (FRED) freshness.
 * `asOf` carries a US observation date; `now` is evaluated on the current US
 * (Eastern) calendar date so an evening US run doesn't roll into the next UTC
 * day. Fresh when ≤1 US business day has elapsed since the observation,
 * boundary at 2, stale at 3+.
 */
export function computeDailyStale(asOf: string, now: number): boolean {
  const obsDate = asOf.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(obsDate)) return true;

  const today = usDateKey(now);
  return countElapsedBusinessDays(obsDate, today) >= DAILY_STALE_ELAPSED_BUSINESS_DAYS;
}

/** Current date (YYYY-MM-DD) in the US Eastern timezone. */
function usDateKey(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}
