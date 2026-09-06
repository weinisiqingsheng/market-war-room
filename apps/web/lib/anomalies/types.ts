/**
 * Market Anomaly domain types (S&P 500 delayed-SIP statistical scanner).
 *
 * Deterministic anomaly-v1 — detects unusual statistical behavior, never a
 * prediction, recommendation, or catalyst explanation.
 */
export const ANOMALY_ENGINE_VERSION = "anomaly-v1";

export type AnomalyDirection = "up" | "down" | "flat";
export type AnomalySeverity = "NORMAL" | "ELEVATED" | "HIGH" | "EXTREME";

export type AnomalyComponentId =
  | "returnShock"
  | "sectorDivergence"
  | "gapShock"
  | "rangeExpansion"
  | "volumeParticipation"
  | "breakout";

export type AnomalyTrigger =
  | "RETURN SHOCK"
  | "SECTOR DIVERGENCE"
  | "GAP SHOCK"
  | "RANGE EXPANSION"
  | "VOLUME SURGE"
  | "20D BREAKOUT"
  | "20D BREAKDOWN";

export interface AnomalyMetricValues {
  returnSigma: number;
  sectorRelativePct: number | null;
  sectorRelativeSigma: number | null;
  gapPct: number | null;
  gapAtrRatio: number | null;
  rangeExpansionRatio: number | null;
  volumeParticipation: number | null;
  breakout20: boolean;
  breakdown20: boolean;
}

export type AnomalyComponentScores = Record<AnomalyComponentId, number | null>;

export interface AnomalyCandidate {
  ticker: string;
  name: string;
  sector: string;
  sectorEtf: string;
  price: number;
  dailyMovePct: number;
  direction: AnomalyDirection;
  anomalyScore: number;
  displayScore: number;
  severity: AnomalySeverity;
  primaryTrigger: AnomalyTrigger;
  metrics: AnomalyMetricValues;
  componentScores: AnomalyComponentScores;
  /** Deterministic template reasons (no LLM, no catalyst claims). */
  reasons: string[];
  dataCoverage: number;
  /** Provider timestamp of the price data scored for this name, if available. */
  priceAsOf?: string | null;
}

export type AnomalyConfidence = "high" | "medium" | "low" | "insufficient";

export interface AnomalyMeta {
  provider: "alpaca";
  feed: "delayed_sip";
  delayMinutes: number;
  /** Effective timestamp of the price data used by anomaly-v1. */
  asOf: string | null;
  marketOpen: boolean | null;
  /** True when the feed looks older than expected delayed-SIP semantics. */
  stale: boolean;
  /** When the overview was computed/requested (orchestration time). */
  generatedAt?: string | null;
  /** Effective market-data time of the scored prices (never orchestration time). */
  effectiveAsOf?: string | null;
  /** ET session date of the scored prices (from actual bars). */
  sessionDate?: string | null;
}

export interface AnomalyUniverseInfo {
  name: "S&P 500";
  version: string;
  asOf: string;
  count: number;
}

export interface AnomalyOverview {
  mode: "demo" | "live";
  engineVersion: string;
  universe: AnomalyUniverseInfo;
  meta: AnomalyMeta;
  universeCount: number;
  eligibleCount: number;
  scoredCount: number;
  coveragePct: number;
  confidence: AnomalyConfidence;
  topOverall: AnomalyCandidate[];
  topPositive: AnomalyCandidate[];
  topNegative: AnomalyCandidate[];
  asOf: string | null;
}
