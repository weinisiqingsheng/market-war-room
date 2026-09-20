import { describe, expect, it } from "vitest";
import type { AnomalyHistory } from "@/lib/anomalies/history-metrics";
import { computeTickerMetrics } from "@/lib/ticker-context/metrics";

const history: AnomalyHistory = {
  sessionCount: 30,
  returnVol20Pct: 2,
  atr20: 3,
  avgVolume20: 10_000_000,
  prior20High: 110,
  prior20Low: 90,
};

describe("deterministic ticker metrics (V1.2A)", () => {
  it("computes documented formulas for a completed session", () => {
    const metrics = computeTickerMetrics({
      history,
      price: 100,
      dailyChangePct: 4,
      sessionVolume: 15_000_000,
      sessionCompleted: true,
    });
    expect(metrics.latestMoveSigma).toBe(2); // |4%| / max(2%, 0.5%)
    expect(metrics.relativeVolume).toBe(1.5); // 15M / 10M
    expect(metrics.partialSessionVolumePctOfAvg).toBeNull();
    expect(metrics.rangePositionPct).toBe(50); // (100-90)/(110-90)
    expect(metrics.returnVol20Pct).toBe(2);
    expect(metrics.historySessionCount).toBe(30);
  });

  it("applies the shared volatility floor exactly like anomaly-v1 normalization", () => {
    const metrics = computeTickerMetrics({
      history: { ...history, returnVol20Pct: 0.2 },
      price: 100,
      dailyChangePct: -1,
      sessionVolume: 5_000_000,
      sessionCompleted: true,
    });
    expect(metrics.latestMoveSigma).toBe(2); // |−1%| / max(0.2%, 0.5%)
  });

  it("never reports a comparable multiple for an incomplete session", () => {
    const metrics = computeTickerMetrics({
      history,
      price: 100,
      dailyChangePct: 2,
      sessionVolume: 4_000_000,
      sessionCompleted: false,
    });
    expect(metrics.relativeVolume).toBeNull();
    expect(metrics.partialSessionVolumePctOfAvg).toBe(40);
  });

  it("propagates missing data as null instead of zero or a substitute", () => {
    const metrics = computeTickerMetrics({
      history: {
        ...history,
        avgVolume20: null,
        returnVol20Pct: null,
        prior20High: null,
        prior20Low: null,
      },
      price: 100,
      dailyChangePct: 3,
      sessionVolume: 12_000_000,
      sessionCompleted: true,
    });
    expect(metrics.relativeVolume).toBeNull();
    expect(metrics.partialSessionVolumePctOfAvg).toBeNull();
    expect(metrics.latestMoveSigma).toBeNull(); // no volatility → no sigma
    expect(metrics.rangePositionPct).toBeNull();
    expect(metrics.avgVolume20).toBeNull();
  });

  it("guards zero/negative denominators and degenerate ranges", () => {
    const zeroVolume = computeTickerMetrics({
      history: { ...history, avgVolume20: 0 },
      price: 100,
      dailyChangePct: 1,
      sessionVolume: 5_000_000,
      sessionCompleted: true,
    });
    expect(zeroVolume.relativeVolume).toBeNull();

    const flatRange = computeTickerMetrics({
      history: { ...history, prior20High: 100, prior20Low: 100 },
      price: 100,
      dailyChangePct: 0,
      sessionVolume: 5_000_000,
      sessionCompleted: true,
    });
    expect(flatRange.rangePositionPct).toBeNull();
    expect(flatRange.latestMoveSigma).toBe(0);
  });

  it("never reports volatility for a window the sealed engine would reject", () => {
    const metrics = computeTickerMetrics({
      history: { ...history, sessionCount: 5, returnVol20Pct: 3, avgVolume20: 4_000_000 },
      price: 100,
      dailyChangePct: 4,
      sessionVolume: 4_000_000,
      sessionCompleted: true,
    });
    expect(metrics.historyEligible).toBe(false);
    expect(metrics.returnVol20Pct).toBeNull();
    expect(metrics.latestMoveSigma).toBeNull();
    expect(metrics.relativeVolume).toBe(1);
  });

  it("requires no price to compute range position", () => {
    const metrics = computeTickerMetrics({
      history,
      price: null,
      dailyChangePct: null,
      sessionVolume: null,
      sessionCompleted: true,
    });
    expect(metrics.rangePositionPct).toBeNull();
    expect(metrics.latestMoveSigma).toBeNull();
    expect(metrics.relativeVolume).toBeNull();
  });
});
