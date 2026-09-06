/**
 * Deterministic demo AnomalyOverview fixture (ANOMALIES_MODE=demo).
 * Clearly labeled demo in the UI; never labeled LIVE.
 */
import type { AnomalyOverview } from "./types";

export const demoAnomaliesOverview: AnomalyOverview = {
  mode: "demo",
  engineVersion: "anomaly-v1",
  universe: { name: "S&P 500", version: "sp500-v1", asOf: "2026-09-05", count: 503 },
  meta: {
    provider: "alpaca",
    feed: "delayed_sip",
    delayMinutes: 15,
    asOf: null,
    marketOpen: null,
    stale: false,
  },
  universeCount: 503,
  eligibleCount: 500,
  scoredCount: 500,
  coveragePct: 500 / 503,
  confidence: "high",
  topOverall: [
    {
      ticker: "NVDA",
      name: "NVIDIA",
      sector: "Information Technology",
      sectorEtf: "XLK",
      price: 512,
      dailyMovePct: 4.2,
      direction: "up",
      anomalyScore: 86.3,
      displayScore: 86,
      severity: "EXTREME",
      primaryTrigger: "RETURN SHOCK",
      metrics: {
        returnSigma: 2.8,
        sectorRelativePct: 3.1,
        sectorRelativeSigma: 2.1,
        gapPct: 1.7,
        gapAtrRatio: 0.9,
        rangeExpansionRatio: 1.8,
        volumeParticipation: 1.6,
        breakout20: true,
        breakdown20: false,
      },
      componentScores: {
        returnShock: 81,
        sectorDivergence: 76,
        gapShock: 55,
        rangeExpansion: 82,
        volumeParticipation: 74,
        breakout: 100,
      },
      reasons: [
        "+4.2% move equals 2.8× its 20D daily volatility",
        "Outperforming XLK by 3.1 percentage points",
        "Trading above its prior 20-day high",
      ],
      dataCoverage: 1,
    },
  ],
  topPositive: [],
  topNegative: [],
  asOf: null,
};
