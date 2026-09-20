/**
 * Deterministic demo AnomalyOverview fixture (ANOMALIES_MODE=demo).
 * Clearly labeled demo in the UI; never labeled LIVE.
 *
 * V1.1E: `buildDemoAnomaliesOverview(universeId)` re-labels the same
 * deterministic demo candidates for the selected anomaly universe (membership
 * filter + derived counts). It never fabricates live data and never replaces a
 * failed live response — demo output only exists when ANOMALIES_MODE=demo.
 */
import {
  DEFAULT_ANOMALY_UNIVERSE_ID,
  anomalyUniverseOrDefault,
  type AnomalyUniverseId,
} from "./universe/registry";
import type { AnomalyOverview } from "./types";

export const demoAnomaliesOverview: AnomalyOverview = {
  mode: "demo",
  engineVersion: "anomaly-v1",
  universe: {
    id: "sp500",
    label: "S&P 500",
    name: "S&P 500",
    version: "sp500-v1",
    asOf: "2026-09-05",
    count: 503,
  },
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

/**
 * Deterministic demo overview for the selected universe.
 *
 * - Universe metadata (id/label/version/asOf/count) comes from the versioned
 *   universe definition.
 * - Demo candidates are filtered to universe membership (falling back to the
 *   canonical demo rows when none overlap, e.g. a small future universe).
 * - Counts keep the fixture's coverage ratio scaled to the universe size —
 *   deterministic arithmetic on demo data, never read from the provider.
 */
export function buildDemoAnomaliesOverview(
  universeId: AnomalyUniverseId = DEFAULT_ANOMALY_UNIVERSE_ID,
): AnomalyOverview {
  const universe = anomalyUniverseOrDefault(universeId);
  if (universeId === DEFAULT_ANOMALY_UNIVERSE_ID) {
    return {
      ...demoAnomaliesOverview,
      universe: {
        ...demoAnomaliesOverview.universe,
        id: universe.id,
        label: universe.label,
        name: universe.label,
        version: universe.version,
        asOf: universe.asOf,
        count: universe.count,
      },
    };
  }
  const symbols = new Set(universe.symbols);
  const filtered = demoAnomaliesOverview.topOverall.filter((candidate) =>
    symbols.has(candidate.ticker),
  );
  const ratio =
    demoAnomaliesOverview.universeCount > 0
      ? demoAnomaliesOverview.eligibleCount / demoAnomaliesOverview.universeCount
      : 0;
  const eligible = Math.min(universe.count, Math.round(universe.count * ratio));
  return {
    ...demoAnomaliesOverview,
    universe: {
      id: universe.id,
      label: universe.label,
      name: universe.label,
      version: universe.version,
      asOf: universe.asOf,
      count: universe.count,
    },
    universeCount: universe.count,
    eligibleCount: eligible,
    scoredCount: eligible,
    coveragePct: universe.count > 0 ? eligible / universe.count : 0,
    topOverall: filtered.length > 0 ? filtered : demoAnomaliesOverview.topOverall,
  };
}
