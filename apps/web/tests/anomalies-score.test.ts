import { describe, expect, it } from "vitest";
import {
  anomalySeverity,
  breakoutComponentScore,
  buildReasons,
  compareAnomalies,
  componentScores,
  gapShockScore,
  overallAnomalyScore,
  primaryTrigger,
  rangeExpansionScore,
  returnShockScore,
  sectorDivergenceScore,
  volumeParticipationScore,
} from "@/lib/anomalies/score";
import { GICS_TO_SPDR, ALL_SECTOR_ETFS, sectorEtfFor } from "@/lib/anomalies/sector-map";
import type { AnomalyCandidate, AnomalyComponentScores } from "@/lib/anomalies/types";
import type { AnomalyMetricDraft } from "@/lib/anomalies/metrics";

function candidate(partial: Partial<AnomalyCandidate>): AnomalyCandidate {
  return {
    ticker: "AAA",
    name: "Test",
    sector: "Information Technology",
    sectorEtf: "XLK",
    price: 100,
    dailyMovePct: 1,
    direction: "up",
    anomalyScore: 50,
    displayScore: 50,
    severity: "ELEVATED",
    primaryTrigger: "RETURN SHOCK",
    metrics: {
      returnSigma: 1,
      sectorRelativePct: null,
      sectorRelativeSigma: null,
      gapPct: null,
      gapAtrRatio: null,
      rangeExpansionRatio: null,
      volumeParticipation: null,
      breakout20: false,
      breakdown20: false,
    },
    componentScores: {
      returnShock: 25,
      sectorDivergence: null,
      gapShock: null,
      rangeExpansion: null,
      volumeParticipation: null,
      breakout: 0,
    },
    reasons: [],
    dataCoverage: 0.34,
    ...partial,
  };
}

describe("sector mapping", () => {
  it("maps GICS sectors to SPDR ETFs (centralized)", () => {
    expect(GICS_TO_SPDR["Information Technology"]).toBe("XLK");
    expect(GICS_TO_SPDR.Financials).toBe("XLF");
    expect(GICS_TO_SPDR.Energy).toBe("XLE");
    expect(GICS_TO_SPDR["Health Care"]).toBe("XLV");
    expect(sectorEtfFor("Not A Sector")).toBeNull();
    expect(ALL_SECTOR_ETFS).toHaveLength(11);
  });
});

describe("scoring", () => {
  it("maps component boundaries", () => {
    expect(returnShockScore(0)).toBe(0);
    expect(returnShockScore(1)).toBe(25);
    expect(returnShockScore(2)).toBe(60);
    expect(returnShockScore(3)).toBe(85);
    expect(returnShockScore(5)).toBe(100);
    expect(sectorDivergenceScore(1)).toBe(40);
    expect(gapShockScore(1)).toBe(60);
    expect(rangeExpansionScore(1)).toBe(40);
    expect(volumeParticipationScore(1)).toBe(45);
  });

  it("computes the weighted overall score", () => {
    const draft: AnomalyMetricDraft = {
      dailyMovePct: 2,
      direction: "up",
      returnSigma: 2,
      sectorRelativePct: 1,
      sectorRelativeSigma: 1,
      gapPct: 1,
      gapAtrRatio: 1,
      rangeExpansionRatio: 1,
      volumeParticipation: 1,
      breakout20: false,
      breakdown20: false,
    };
    const score = overallAnomalyScore(componentScores(draft));
    expect(score).toBeCloseTo((0.35 * 60 + 0.2 * 40 + 0.15 * 60 + 0.15 * 40 + 0.1 * 45) / 1, 5);
  });

  it("renormalizes over available components", () => {
    const components: AnomalyComponentScores = {
      returnShock: 60,
      sectorDivergence: null,
      gapShock: 60,
      rangeExpansion: 40,
      volumeParticipation: 45,
      breakout: 0,
    };
    const numerator = 0.35 * 60 + 0.15 * 60 + 0.15 * 40 + 0.1 * 45 + 0.05 * 0;
    expect(overallAnomalyScore(components)).toBeCloseTo(numerator / 0.8, 5);
  });

  it("returns null when return shock is unavailable", () => {
    const components: AnomalyComponentScores = {
      returnShock: null,
      sectorDivergence: 40,
      gapShock: null,
      rangeExpansion: null,
      volumeParticipation: null,
      breakout: 0,
    };
    expect(overallAnomalyScore(components)).toBeNull();
  });

  it("severity boundaries are exact", () => {
    expect(anomalySeverity(49.9)).toBe("NORMAL");
    expect(anomalySeverity(50)).toBe("ELEVATED");
    expect(anomalySeverity(65)).toBe("HIGH");
    expect(anomalySeverity(80)).toBe("EXTREME");
    expect(anomalySeverity(79.9)).toBe("HIGH");
  });

  it("breakout/breakdown are direction-neutral for severity", () => {
    expect(breakoutComponentScore(true, false)).toBe(100);
    expect(breakoutComponentScore(false, true)).toBe(100);
    expect(breakoutComponentScore(false, false)).toBe(0);
  });

  it("reasons never claim a catalyst", () => {
    const draft: AnomalyMetricDraft = {
      dailyMovePct: 4.2,
      direction: "up",
      returnSigma: 2.8,
      sectorRelativePct: 3.1,
      sectorRelativeSigma: 2,
      gapPct: 1.7,
      gapAtrRatio: 0.9,
      rangeExpansionRatio: 1.8,
      volumeParticipation: 1.6,
      breakout20: true,
      breakdown20: false,
    };
    const reasons = buildReasons(draft, "XLK");
    expect(reasons.some((reason) => reason.includes("catalyst not evaluated"))).toBe(true);
    expect(reasons.join(" ")).not.toMatch(/because/i);
  });

  it("picks the primary trigger by weighted contribution", () => {
    const up: AnomalyMetricDraft = {
      dailyMovePct: 5,
      direction: "up",
      returnSigma: 4,
      sectorRelativePct: null,
      sectorRelativeSigma: null,
      gapPct: null,
      gapAtrRatio: null,
      rangeExpansionRatio: null,
      volumeParticipation: null,
      breakout20: true,
      breakdown20: false,
    };
    const both: AnomalyComponentScores = {
      returnShock: 100,
      sectorDivergence: 100,
      gapShock: null,
      rangeExpansion: null,
      volumeParticipation: null,
      breakout: 100,
    };
    expect(primaryTrigger(both, up)).toBe("RETURN SHOCK");
    const breakoutOnly: AnomalyComponentScores = {
      returnShock: null,
      sectorDivergence: null,
      gapShock: null,
      rangeExpansion: null,
      volumeParticipation: null,
      breakout: 100,
    };
    expect(primaryTrigger(breakoutOnly, up)).toBe("20D BREAKOUT");
  });
});

describe("ranking", () => {
  const mk = (ticker: string, score: number, sigma: number, move: number) =>
    candidate({
      ticker,
      anomalyScore: score,
      dailyMovePct: move,
      metrics: {
        returnSigma: sigma,
        sectorRelativePct: null,
        sectorRelativeSigma: null,
        gapPct: null,
        gapAtrRatio: null,
        rangeExpansionRatio: null,
        volumeParticipation: null,
        breakout20: false,
        breakdown20: false,
      },
    });

  it("sorts by score, then sigma, then |move|, then ticker", () => {
    expect(compareAnomalies(mk("MI", 90, 3, 3), mk("LO", 90, 2, 5))).toBeLessThan(0);
    expect(compareAnomalies(mk("HI", 95, 1, 2), mk("MI", 90, 3, 3))).toBeLessThan(0);
    expect(compareAnomalies(mk("XY", 90, 2, 5), mk("AB", 90, 2, 5))).toBeGreaterThan(0);
  });

  it("ranks a large decliner equally with a large gainer", () => {
    const up = candidate({ ticker: "UP", direction: "up", dailyMovePct: 4.5, anomalyScore: 85 });
    const down = candidate({
      ticker: "DN",
      direction: "down",
      dailyMovePct: -4.5,
      anomalyScore: 85,
    });
    expect(compareAnomalies(up, down)).toBeGreaterThan(0);
  });
});
