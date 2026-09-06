import { describe, expect, it } from "vitest";
import { demoMarketData } from "@/data/demo-market";

describe("demo market data", () => {
  it("exposes all homepage modules in the approved information architecture", () => {
    expect(Object.keys(demoMarketData)).toEqual([
      "regime",
      "regimeDrivers",
      "indices",
      "macro",
      "sectors",
      "benchmark",
      "breadth",
      "anomalies",
      "catalysts",
      "brief",
      "suggestedQuestions",
    ]);
  });

  it("has a valid risk-off regime score on the 0-100 spectrum", () => {
    const { regime } = demoMarketData;
    expect(regime.score).toBeGreaterThanOrEqual(0);
    expect(regime.score).toBeLessThanOrEqual(100);
    expect(regime.score).toBeLessThan(50);
    expect(regime.label).toMatch(/risk-off/i);
    expect(regime.explanation.length).toBeGreaterThan(20);
  });

  it("provides four pulse indices on four distinct pastel surfaces", () => {
    expect(demoMarketData.indices.map((index) => index.ticker)).toEqual([
      "SPY",
      "QQQ",
      "IWM",
      "DIA",
    ]);
    expect(new Set(demoMarketData.indices.map((index) => index.surface)).size).toBe(4);
    for (const index of demoMarketData.indices) {
      expect(index.sparkline?.length ?? 0).toBeGreaterThan(5);
      if (index.high !== null && index.low !== null) {
        expect(index.high).toBeGreaterThanOrEqual(index.low);
      }
    }
  });

  it("keeps raw direction separate from interpretation tone (macro)", () => {
    const wti = demoMarketData.macro.find((signal) => signal.id === "wti");
    expect(wti).toBeDefined();
    expect(wti?.change).toBeGreaterThan(0); // price direction: up
    expect(wti?.tone).toBe("negative"); // interpretation: inflation risk
    expect(wti?.displayUnit).toBe("price");
  });

  it("normalizes sector strengths to 0-100 with relative returns", () => {
    for (const sector of demoMarketData.sectors) {
      expect(sector.strength).toBeGreaterThanOrEqual(0);
      expect(sector.strength).toBeLessThanOrEqual(100);
      expect(typeof sector.relativeReturnPct).toBe("number");
      expect(sector.etf).toMatch(/^X[A-Z]{2}$/);
    }
  });

  it("keeps breadth internally consistent", () => {
    const { breadth } = demoMarketData;
    expect(breadth.advancingPct + breadth.decliningPct).toBe(100);
    expect(breadth.score).toBeLessThan(50); // visually negative breadth
  });

  it("shapes anomaly rows with all required fields", () => {
    for (const anomaly of demoMarketData.anomalies) {
      expect(anomaly.symbol.length).toBeGreaterThan(0);
      expect(anomaly.relativeVolume).toBeGreaterThan(0);
      expect(anomaly.score).toBeGreaterThanOrEqual(0);
      expect(anomaly.score).toBeLessThanOrEqual(100);
      expect(anomaly.relativeStrength).toBeGreaterThanOrEqual(1);
      expect(anomaly.relativeStrength).toBeLessThanOrEqual(3);
    }
  });

  it("labels every brief element as a design fixture", () => {
    expect(demoMarketData.brief.provenance).toMatch(/design preview/i);
    expect(demoMarketData.brief.sourceCount).toBeGreaterThan(0);
  });
});
