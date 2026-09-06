/**
 * Deterministic per-stock anomaly metric extraction (delayed-SIP regular
 * session). Depends only on normalized current state + split-adjusted history.
 */
import { ATR_PCT_FLOOR, VOLATILITY_FLOOR_PCT } from "./constants";
import type { BreadthSymbolState } from "@/lib/breadth/normalize";
import type { AlpacaBreadthSnapshot } from "@/lib/breadth/normalize";
import type { AnomalyDirection } from "./types";
import type { AnomalyHistory } from "./history-metrics";

export const ANOMALY_FLAT_EPSILON_PCT = 0.001;

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function classifyDirection(dailyMovePct: number): AnomalyDirection {
  if (dailyMovePct > ANOMALY_FLAT_EPSILON_PCT) return "up";
  if (dailyMovePct < -ANOMALY_FLAT_EPSILON_PCT) return "down";
  return "flat";
}

export interface AnomalyMetricDraft {
  dailyMovePct: number;
  direction: AnomalyDirection;
  returnSigma: number | null;
  sectorRelativePct: number | null;
  sectorRelativeSigma: number | null;
  gapPct: number | null;
  gapAtrRatio: number | null;
  rangeExpansionRatio: number | null;
  volumeParticipation: number | null;
  breakout20: boolean;
  breakdown20: boolean;
}

/**
 * Extracts anomaly-v1 metrics for one constituent.
 * `sectorState` is the member's GICS sector ETF, fetched on the SAME delayed-SIP
 * feed (feed consistency matters — never delayed-SIP stock vs live-IEX sector).
 */
export function computeAnomalyMetrics(
  state: BreadthSymbolState,
  snapshot: AlpacaBreadthSnapshot | undefined,
  sectorState: BreadthSymbolState | null,
  history: AnomalyHistory,
): AnomalyMetricDraft {
  const refPrice = state.refPrice;
  const previousClose = state.previousClose;
  const returnVol20 = history.returnVol20Pct;

  const dailyMovePct =
    refPrice !== null && previousClose !== null && previousClose > 0
      ? ((refPrice - previousClose) / previousClose) * 100
      : 0;

  const direction = classifyDirection(dailyMovePct);
  const volFloor = Math.max(returnVol20 ?? 0, VOLATILITY_FLOOR_PCT);
  const returnSigma =
    returnVol20 !== null && refPrice !== null && previousClose !== null
      ? Math.abs(dailyMovePct) / volFloor
      : null;

  const sectorRelativePct =
    sectorState?.changePct !== null && sectorState?.changePct !== undefined
      ? dailyMovePct - sectorState.changePct
      : null;
  const sectorRelativeSigma =
    sectorRelativePct !== null && returnVol20 !== null
      ? Math.abs(sectorRelativePct) / volFloor
      : null;

  const open = num(snapshot?.dailyBar?.o);
  const high = num(snapshot?.dailyBar?.h);
  const low = num(snapshot?.dailyBar?.l);
  const volume = num(snapshot?.dailyBar?.v);

  const gapPct =
    open !== null && previousClose !== null && previousClose > 0
      ? ((open - previousClose) / previousClose) * 100
      : null;

  const atr20 = history.atr20;
  const atr20Pct =
    atr20 !== null && previousClose !== null && previousClose > 0
      ? (atr20 / previousClose) * 100
      : null;
  const gapAtrRatio =
    gapPct !== null && atr20Pct !== null
      ? Math.abs(gapPct) / Math.max(atr20Pct, ATR_PCT_FLOOR)
      : null;

  const currentTrueRange =
    high !== null && low !== null
      ? Math.max(
          high - low,
          previousClose !== null ? Math.abs(high - previousClose) : 0,
          previousClose !== null ? Math.abs(low - previousClose) : 0,
        )
      : null;
  const rangeExpansionRatio =
    currentTrueRange !== null && atr20 !== null ? currentTrueRange / atr20 : null;

  const volumeParticipation =
    volume !== null && history.avgVolume20 !== null && history.avgVolume20 > 0
      ? volume / history.avgVolume20
      : null;

  const breakout20 =
    refPrice !== null && history.prior20High !== null && refPrice > history.prior20High;
  const breakdown20 =
    refPrice !== null && history.prior20Low !== null && refPrice < history.prior20Low;

  return {
    dailyMovePct,
    direction,
    returnSigma,
    sectorRelativePct,
    sectorRelativeSigma,
    gapPct,
    gapAtrRatio,
    rangeExpansionRatio,
    volumeParticipation,
    breakout20,
    breakdown20,
  };
}
