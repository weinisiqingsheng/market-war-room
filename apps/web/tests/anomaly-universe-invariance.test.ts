import { describe, expect, it } from "vitest";
import {
  SCORE_WEIGHTS,
  SEVERITY_ELEVATED,
  SEVERITY_EXTREME,
  SEVERITY_HIGH,
} from "@/lib/anomalies/constants";
import type { AnomalyMetricDraft } from "@/lib/anomalies/metrics";
import {
  anomalySeverity,
  compareAnomalies,
  componentScores,
  overallAnomalyScore,
} from "@/lib/anomalies/score";
import { sectorEtfFor } from "@/lib/anomalies/sector-map";
import { sp500AnomalyUniverse } from "@/lib/anomalies/universe/sp500";
import { nasdaq100AnomalyUniverse } from "@/lib/anomalies/universe/nasdaq100";
import type { AnomalyCandidate } from "@/lib/anomalies/types";

/** Identical market-data inputs for the overlap-invariance check. */
const draft: AnomalyMetricDraft = {
  dailyMovePct: -4.2,
  direction: "down",
  returnSigma: 2.8,
  sectorRelativePct: -3.1,
  sectorRelativeSigma: 2.1,
  gapPct: -1.7,
  gapAtrRatio: 0.9,
  rangeExpansionRatio: 1.8,
  volumeParticipation: 1.6,
  breakout20: false,
  breakdown20: true,
};

function candidate(overrides: Partial<AnomalyCandidate>): AnomalyCandidate {
  return {
    ticker: "TEST",
    name: "Test",
    sector: "Information Technology",
    sectorEtf: "XLK",
    price: 100,
    dailyMovePct: -4.2,
    direction: "down",
    anomalyScore: 70,
    displayScore: 70,
    severity: "HIGH",
    primaryTrigger: "RETURN SHOCK",
    metrics: {
      returnSigma: 2.8,
      sectorRelativePct: -3.1,
      sectorRelativeSigma: 2.1,
      gapPct: -1.7,
      gapAtrRatio: 0.9,
      rangeExpansionRatio: 1.8,
      volumeParticipation: 1.6,
      breakout20: false,
      breakdown20: true,
    },
    componentScores: {
      returnShock: 81,
      sectorDivergence: 76,
      gapShock: 55,
      rangeExpansion: 82,
      volumeParticipation: 74,
      breakout: 100,
    },
    reasons: [],
    dataCoverage: 1,
    ...overrides,
  };
}

describe("anomaly-v1 semantics are universe-independent (V1.1E)", () => {
  it("keeps the sealed score weights and severity thresholds unchanged", () => {
    expect(SCORE_WEIGHTS).toEqual({
      returnShock: 0.35,
      sectorDivergence: 0.2,
      gapShock: 0.15,
      rangeExpansion: 0.15,
      volumeParticipation: 0.1,
      breakout: 0.05,
    });
    expect([SEVERITY_ELEVATED, SEVERITY_HIGH, SEVERITY_EXTREME]).toEqual([50, 65, 80]);
    expect(anomalySeverity(80)).toBe("EXTREME");
    expect(anomalySeverity(65)).toBe("HIGH");
    expect(anomalySeverity(50)).toBe("ELEVATED");
    expect(anomalySeverity(49.9)).toBe("NORMAL");
  });

  it("keeps the deterministic ranking comparator unchanged", () => {
    const higherScore = candidate({ ticker: "AAA", anomalyScore: 80 });
    const lowerScore = candidate({ ticker: "BBB", anomalyScore: 70 });
    const tiedHigherSigma = candidate({
      ticker: "CCC",
      anomalyScore: 70,
      metrics: { ...candidate({}).metrics, returnSigma: 3.2 },
    });
    const sorted = [lowerScore, higherScore, tiedHigherSigma].sort(compareAnomalies);
    expect(sorted.map((item) => item.ticker)).toEqual(["AAA", "CCC", "BBB"]);
  });

  it("produces identical metrics, components and score for a given input", () => {
    const before = componentScores(draft);
    const after = componentScores(draft);
    expect(after).toEqual(before);
    expect(overallAnomalyScore(after)).toBe(overallAnomalyScore(before));
    expect(overallAnomalyScore(after)).not.toBeNull();
  });

  it("keeps overlapping symbols on the same sector and sector ETF in both universes", () => {
    const spSectors = new Map(
      sp500AnomalyUniverse.members.map((member) => [member.ticker, member.sector]),
    );
    const overlaps = nasdaq100AnomalyUniverse.members.filter((member) =>
      spSectors.has(member.ticker),
    );
    expect(overlaps.length).toBeGreaterThan(50);
    for (const member of overlaps) {
      const spSector = spSectors.get(member.ticker)!;
      expect(member.sector).toBe(spSector);
      expect(sectorEtfFor(member.sector)).toBe(sectorEtfFor(spSector));
    }
  });

  it("scores an overlapping symbol identically when only the selected universe differs", () => {
    const scopes = [sp500AnomalyUniverse, nasdaq100AnomalyUniverse];
    expect(scopes[0].members.length).not.toBe(scopes[1].members.length);

    const results = scopes.map((universe) => {
      const member = universe.members.find((entry) => entry.ticker === "NVDA");
      expect(member).toBeDefined();
      const components = componentScores(draft);
      const score = overallAnomalyScore(components);
      return {
        sector: member!.sector,
        sectorEtf: sectorEtfFor(member!.sector),
        componentScores: components,
        anomalyScore: score,
        severity: score === null ? null : anomalySeverity(score),
      };
    });

    expect(results[0]).toEqual(results[1]);
    expect(results[0].sectorEtf).toBe("XLK");
  });
});
