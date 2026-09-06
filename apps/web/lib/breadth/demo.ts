/**
 * Deterministic demo BreadthOverview fixture for BREADTH_MODE=demo.
 * Clearly labeled demo in the UI; never labeled LIVE.
 */
import type { BreadthOverview } from "./types";

export const demoBreadthOverview: BreadthOverview = {
  mode: "demo",
  score: 38,
  displayScore: 38,
  engineVersion: "breadth-v1",
  state: { key: "MIXED_PARTICIPATION", label: "Mixed Participation" },
  metrics: {
    universeCount: 503,
    currentCoverageCount: 503,
    historical20CoverageCount: 500,
    historical50CoverageCount: 498,
    coveragePct: 1,
    advancers: 211,
    decliners: 284,
    unchanged: 8,
    advanceRatio: 211 / (211 + 284),
    above20Pct: 0.42,
    above50Pct: 0.42,
    newHighs20: 22,
    newLows20: 64,
  },
  universe: { name: "S&P 500", version: "sp500-v1", asOf: "2026-09-05", count: 503 },
  meta: { provider: "alpaca", feed: "delayed_sip", delayMinutes: 15, asOf: null, marketOpen: null },
  confidence: "high",
};
