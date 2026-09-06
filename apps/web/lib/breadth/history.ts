/**
 * Per-constituent completed-history aggregation (20D/50D).
 *
 * A daily bar is "completed" when its session date is strictly before the
 * boundary session (the current daily bar for that symbol, which may still be
 * forming). The currently-forming session is never included in an SMA window or
 * in the 20-session high/low comparison window.
 */
import { MA20_WINDOW, MA50_WINDOW, NEW_HIGH_LOW_WINDOW } from "./constants";
import { barSessionDate } from "./dates";
import type { AlpacaBreadthBar } from "./normalize";

export interface SymbolHistory {
  /** Completed sessions count (before the boundary date). */
  sessionCount: number;
  sma20: number | null;
  sma50: number | null;
  /** Highest high / lowest low over the last 20 completed sessions. */
  high20: number | null;
  low20: number | null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Completed sessions (sorted newest-first) with a session date strictly before
 * `boundaryDate` (YYYY-MM-DD).
 */
export function completedSessions(
  bars: AlpacaBreadthBar[] | undefined,
  boundaryDate: string | null,
): AlpacaBreadthBar[] {
  if (!Array.isArray(bars)) return [];
  const completed = bars.filter((bar) => {
    const session = barSessionDate(bar?.t);
    if (!session || !boundaryDate) return false;
    return session < boundaryDate;
  });
  // Sort newest-first by timestamp for stable windowing.
  return completed.sort((a, b) => {
    const ta = typeof a.t === "string" ? a.t : "";
    const tb = typeof b.t === "string" ? b.t : "";
    return tb.localeCompare(ta);
  });
}

function meanOfLast(values: Array<number | null>, count: number): number | null {
  const usable = values.filter((value): value is number => value !== null).slice(0, count);
  if (usable.length < count) return null;
  return usable.reduce((sum, value) => sum + value, 0) / count;
}

/** Aggregates SMA20/SMA50 and 20-session high/low from completed history. */
export function computeSymbolHistory(
  bars: AlpacaBreadthBar[] | undefined,
  boundaryDate: string | null,
): SymbolHistory {
  const newestFirst = completedSessions(bars, boundaryDate);

  const closes = newestFirst.map((bar) => num(bar.c));
  const sma20 = meanOfLast(closes, MA20_WINDOW);
  const sma50 = meanOfLast(closes, MA50_WINDOW);

  const window = newestFirst.slice(0, NEW_HIGH_LOW_WINDOW);
  let high20: number | null = null;
  let low20: number | null = null;
  if (window.length >= NEW_HIGH_LOW_WINDOW) {
    const highs = window.map((bar) => num(bar.h)).filter((v): v is number => v !== null);
    const lows = window.map((bar) => num(bar.l)).filter((v): v is number => v !== null);
    if (highs.length >= NEW_HIGH_LOW_WINDOW) high20 = Math.max(...highs);
    if (lows.length >= NEW_HIGH_LOW_WINDOW) low20 = Math.min(...lows);
  }

  return { sessionCount: newestFirst.length, sma20, sma50, high20, low20 };
}

export interface BreadthAboveFlags {
  above20: boolean | null;
  above50: boolean | null;
}

export function classifyAboveMA(
  refPrice: number | null,
  history: SymbolHistory,
): BreadthAboveFlags {
  if (refPrice === null) return { above20: null, above50: null };
  return {
    above20: history.sma20 !== null ? refPrice > history.sma20 : null,
    above50: history.sma50 !== null ? refPrice > history.sma50 : null,
  };
}
