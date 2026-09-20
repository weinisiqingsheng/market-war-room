/**
 * Deterministic ticker metrics (ticker-metrics-v1).
 *
 * Formulas (documented, no invented values):
 * - returnVol20Pct: sample stddev (ddof=1) of the last ≤20 close-to-close %
 *   returns over COMPLETED split-adjusted sessions (sealed anomaly-v1 history
 *   module — identical window/definition, shared, never re-implemented).
 * - avgVolume20: mean volume of the last 20 completed sessions.
 * - latestMoveSigma: |dailyChangePct| / max(returnVol20Pct, VOLATILITY_FLOOR_PCT),
 *   the same normalization anomaly-v1 uses for its return-shock component.
 *   It is a statistical magnitude only — never an anomaly-v1 score.
 * - relativeVolume: completed-session volume / avgVolume20. Only computed for a
 *   COMPLETED regular session; a partial (in-session) volume is reported as a
 *   partial participation percentage instead, never as a comparable multiple.
 * - rangePositionPct: (price − prior20Low) / (prior20High − prior20Low) × 100.
 * Missing inputs propagate as null — never 0, never a substitute benchmark.
 */
import { VOLATILITY_FLOOR_PCT } from "@/lib/anomalies/constants";
import { anomalyHistoryEligible, type AnomalyHistory } from "@/lib/anomalies/history-metrics";

export interface TickerMetrics {
  /** True when the sealed anomaly-v1 history eligibility holds (≥20 returns). */
  historyEligible: boolean;
  historySessionCount: number;
  returnVol20Pct: number | null;
  avgVolume20: number | null;
  prior20High: number | null;
  prior20Low: number | null;
  latestMoveSigma: number | null;
  relativeVolume: number | null;
  partialSessionVolumePctOfAvg: number | null;
  rangePositionPct: number | null;
}

export interface TickerMetricsInput {
  history: AnomalyHistory;
  /** Regular-session reference price (never an after-hours trade). */
  price: number | null;
  dailyChangePct: number | null;
  /** Volume of the session the price belongs to. */
  sessionVolume: number | null;
  /** True when that session has completed (regular session closed). */
  sessionCompleted: boolean;
}

function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return numerator / denominator;
}

export function computeTickerMetrics(input: TickerMetricsInput): TickerMetrics {
  const { history, price, dailyChangePct, sessionVolume, sessionCompleted } = input;

  // Volatility is only reported when the SAME eligibility rule the sealed
  // anomaly-v1 engine uses holds (≥21 completed sessions ⇒ ≥20 returns).
  // A short window must never produce an "invented" volatility figure.
  const historyEligible = anomalyHistoryEligible(history);
  const returnVol20Pct = historyEligible ? history.returnVol20Pct : null;

  // A sigma can only be reported when realized volatility exists at all.
  const sigmaFloor =
    returnVol20Pct === null ? null : Math.max(returnVol20Pct, VOLATILITY_FLOOR_PCT);
  const latestMoveSigma =
    dailyChangePct === null || sigmaFloor === null ? null : Math.abs(dailyChangePct) / sigmaFloor;

  const relativeVolume = sessionCompleted ? ratio(sessionVolume, history.avgVolume20) : null;
  const partialSessionVolumePctOfAvg = !sessionCompleted
    ? ratio(sessionVolume, history.avgVolume20)
    : null;

  const rangePositionPct =
    price !== null &&
    history.prior20High !== null &&
    history.prior20Low !== null &&
    history.prior20High > history.prior20Low
      ? ((price - history.prior20Low) / (history.prior20High - history.prior20Low)) * 100
      : null;

  return {
    historyEligible,
    historySessionCount: history.sessionCount,
    returnVol20Pct,
    avgVolume20: history.avgVolume20,
    prior20High: history.prior20High,
    prior20Low: history.prior20Low,
    latestMoveSigma: latestMoveSigma === null ? null : Math.round(latestMoveSigma * 100) / 100,
    relativeVolume: relativeVolume === null ? null : Math.round(relativeVolume * 100) / 100,
    partialSessionVolumePctOfAvg:
      partialSessionVolumePctOfAvg === null
        ? null
        : Math.round(partialSessionVolumePctOfAvg * 1000) / 10,
    rangePositionPct: rangePositionPct === null ? null : Math.round(rangePositionPct * 10) / 10,
  };
}
