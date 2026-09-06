/**
 * History-based anomaly statistics computed from SPLIT-ADJUSTED completed daily
 * bars (adjustment=split). Split-adjustment is essential for anomaly math:
 * close-to-close returns, ATR and 20D ranges must not fabricate anomalies from
 * stock-split jumps. Raw and adjusted series are never mixed.
 */
import { NEW_HIGH_LOW_WINDOW } from "@/lib/breadth/constants";
import { completedSessions } from "@/lib/breadth/history";
import type { AlpacaBreadthBar } from "@/lib/breadth/normalize";

export interface AnomalyHistory {
  sessionCount: number;
  /** Sample stddev of close-to-close % returns over the last 20 sessions. */
  returnVol20Pct: number | null;
  /** Mean true range over the last 20 completed sessions (price units). */
  atr20: number | null;
  /** Mean volume over the last 20 completed sessions. */
  avgVolume20: number | null;
  /** High/low over the last 20 completed sessions (excludes the forming one). */
  prior20High: number | null;
  prior20Low: number | null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Sample standard deviation (ddof=1). */
function sampleStddev(values: number[]): number | null {
  if (values.length < 2) return null;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** True range of a session given the prior session's close. */
function trueRange(bar: AlpacaBreadthBar, previousClose: number | null): number | null {
  const high = num(bar.h);
  const low = num(bar.l);
  if (high === null || low === null) return null;
  if (previousClose === null) return high - low;
  return Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose));
}

export function computeAnomalyHistory(
  bars: AlpacaBreadthBar[] | undefined,
  boundaryDate: string | null,
): AnomalyHistory {
  // Newest-first completed sessions (current/forming session already excluded).
  const newestFirst = completedSessions(bars, boundaryDate);
  const sessionCount = newestFirst.length;

  if (sessionCount === 0) {
    return {
      sessionCount,
      returnVol20Pct: null,
      atr20: null,
      avgVolume20: null,
      prior20High: null,
      prior20Low: null,
    };
  }

  const window = newestFirst.slice(0, Math.max(NEW_HIGH_LOW_WINDOW, 21));

  // Close-to-close % returns across consecutive sessions (newest first).
  const closes = window.map((bar) => num(bar.c));
  const returns: number[] = [];
  for (let i = 0; i < closes.length - 1; i += 1) {
    const newer = closes[i];
    const older = closes[i + 1];
    if (newer !== null && older !== null && older !== 0) {
      returns.push(((newer - older) / older) * 100);
    }
  }
  const recent20 = returns.slice(0, 20);
  const returnVol20Pct = recent20.length >= 20 ? sampleStddev(recent20) : sampleStddev(returns);

  // ATR20 over the last 20 sessions.
  const atrCandidates: number[] = [];
  const volumeCandidates: number[] = [];
  for (let i = 0; i < window.length; i += 1) {
    const volume = num(window[i].v);
    if (volume !== null) volumeCandidates.push(volume);
    const next = i + 1 < window.length ? window[i + 1] : null;
    const nextClose = next ? num(next.c) : null;
    const range = trueRange(window[i], nextClose);
    if (range !== null) atrCandidates.push(range);
    if (atrCandidates.length >= 20 && volumeCandidates.length >= 20) break;
  }
  const atr20 = atrCandidates.length >= 20 ? mean(atrCandidates.slice(0, 20)) : null;
  const avgVolume20 = volumeCandidates.length >= 20 ? mean(volumeCandidates.slice(0, 20)) : null;

  const rangeWindow = newestFirst.slice(0, NEW_HIGH_LOW_WINDOW);
  let prior20High: number | null = null;
  let prior20Low: number | null = null;
  if (rangeWindow.length >= NEW_HIGH_LOW_WINDOW) {
    const highs = rangeWindow.map((bar) => num(bar.h)).filter((v): v is number => v !== null);
    const lows = rangeWindow.map((bar) => num(bar.l)).filter((v): v is number => v !== null);
    if (highs.length >= NEW_HIGH_LOW_WINDOW) prior20High = Math.max(...highs);
    if (lows.length >= NEW_HIGH_LOW_WINDOW) prior20Low = Math.min(...lows);
  }

  return {
    sessionCount,
    returnVol20Pct: returnVol20Pct !== null ? Math.max(returnVol20Pct, 0) : null,
    atr20,
    avgVolume20,
    prior20High,
    prior20Low,
  };
}

/** Eligibility: valid return volatility requires ≥20 close-to-close returns. */
export function anomalyHistoryEligible(history: AnomalyHistory): boolean {
  return history.sessionCount >= 21 && history.returnVol20Pct !== null;
}
