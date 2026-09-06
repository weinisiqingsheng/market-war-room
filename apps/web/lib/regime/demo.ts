/**
 * Deterministic demo RegimeResult fixture for REGIME_MODE=demo.
 *
 * Demo mode must keep working with no analytics service running and must be
 * clearly labeled DEMO in the UI — it is never presented as a live score.
 */
import type { RegimeOverview, RegimeResult } from "@war-room/types";

export const demoRegimeResult: RegimeResult = {
  score: 42,
  displayScore: 42,
  label: "CAUTIOUS / NEUTRAL",
  coverage: 1,
  confidence: "high",
  components: [
    { id: "equity", name: "Equity Tape", score: 38, weight: 0.3 },
    { id: "sectors", name: "Sector Participation", score: 46, weight: 0.2 },
    { id: "volatility", name: "Volatility", score: 62, weight: 0.15 },
    { id: "rates", name: "Rates", score: 33, weight: 0.15 },
    { id: "macro", name: "Macro Pressure", score: 35, weight: 0.15 },
    { id: "crypto", name: "Crypto Risk Appetite", score: 58, weight: 0.05 },
  ],
  positiveDrivers: [
    {
      id: "vix",
      name: "VIX",
      direction: "positive",
      impact: 2.4,
      reason: "VIX is low at 15.4",
    },
    {
      id: "crypto",
      name: "BTC",
      direction: "positive",
      impact: 0.4,
      reason: "BTC rose +1.4%",
    },
  ],
  negativeDrivers: [
    {
      id: "us10y",
      name: "US 10Y",
      direction: "negative",
      impact: -3.8,
      reason: "US 10Y rose 8 bp",
    },
    {
      id: "wti",
      name: "WTI",
      direction: "negative",
      impact: -2.6,
      reason: "WTI rose +2.5%, increasing inflation pressure",
    },
  ],
  staleInputs: [],
  missingInputs: [],
  asOf: null,
  engineVersion: "regime-v1",
};

export const demoRegimeOverview: RegimeOverview = {
  mode: "demo",
  meta: { mode: "demo", asOf: null },
  result: demoRegimeResult,
};
