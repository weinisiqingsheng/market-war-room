import { describe, expect, it } from "vitest";
import { HISTORY_ADJUSTMENT, VOLATILITY_FLOOR_PCT } from "@/lib/anomalies/constants";
import {
  anomalyHistoryEligible,
  computeAnomalyHistory,
  type AnomalyHistory,
} from "@/lib/anomalies/history-metrics";
import { classifyDirection, computeAnomalyMetrics } from "@/lib/anomalies/metrics";
import type { BreadthSymbolState } from "@/lib/breadth/normalize";

const BOUNDARY = "2026-09-02";

function bars(count: number): Array<{ t: string; c: number; h: number; l: number; v: number }> {
  const out = [];
  for (let j = count; j >= 1; j -= 1) {
    const iso = new Date(Date.parse(`${BOUNDARY}T20:00:00Z`) - j * 86_400_000).toISOString();
    const value = 100 + (count - j + 1);
    out.push({ t: iso, c: value, h: value + 2, l: value - 1, v: 1000 + (count - j + 1) * 10 });
  }
  return out;
}

function state(price: number, prev: number, changePct: number): BreadthSymbolState {
  return {
    ticker: "AAA",
    available: true,
    refPrice: price,
    previousClose: prev,
    changePct,
    move: changePct > 0 ? "advancer" : "decliner",
    sessionDate: BOUNDARY,
  };
}

const snapshot = (price: number, open: number, high: number, low: number, volume?: number) => ({
  dailyBar: {
    t: `${BOUNDARY}T20:00:00Z`,
    o: open,
    h: high,
    l: low,
    c: price,
    ...(volume === undefined ? {} : { v: volume }),
  },
  prevDailyBar: { t: "2026-09-01T20:00:00Z", c: 100 },
});

describe("anomaly history metrics", () => {
  it("computes return volatility, ATR20, average volume and 20D range", () => {
    const history = computeAnomalyHistory(bars(40), BOUNDARY);
    expect(history.sessionCount).toBe(40);
    expect(history.returnVol20Pct).not.toBeNull();
    expect(history.atr20).not.toBeNull();
    expect(history.avgVolume20).not.toBeNull();
    expect(history.prior20High).not.toBeNull();
    expect(history.prior20Low).not.toBeNull();
    expect(anomalyHistoryEligible(history)).toBe(true);
  });

  it("marks insufficient history ineligible", () => {
    expect(anomalyHistoryEligible(computeAnomalyHistory(bars(12), BOUNDARY))).toBe(false);
  });

  it("uses split-adjusted semantics", () => {
    expect(HISTORY_ADJUSTMENT).toBe("split");
  });

  it("excludes the forming session from the historical window", () => {
    const history = computeAnomalyHistory(
      [...bars(25), { t: `${BOUNDARY}T20:00:00Z`, c: 9999, h: 9999, l: 0, v: 1 }],
      BOUNDARY,
    );
    expect(history.sessionCount).toBe(25);
    expect(history.prior20High ?? 0).toBeLessThan(9000);
  });
});

describe("current metrics + sector divergence", () => {
  it("computes daily move, direction, and same-feed sector divergence", () => {
    const history = computeAnomalyHistory(bars(40), BOUNDARY);
    const sector = state(51, 50, 2);
    const draft = computeAnomalyMetrics(
      state(105, 100, 5),
      snapshot(105, 102, 108, 99, 2000),
      sector,
      history,
    );
    expect(draft.dailyMovePct).toBeCloseTo(5, 5);
    expect(draft.direction).toBe("up");
    expect(draft.sectorRelativePct).toBeCloseTo(3, 5);
    expect(classifyDirection(-0.2)).toBe("down");
    expect(classifyDirection(0)).toBe("flat");
  });

  it("keeps sector metrics null when the sector ETF is missing", () => {
    const history = computeAnomalyHistory(bars(40), BOUNDARY);
    const draft = computeAnomalyMetrics(
      state(105, 100, 5),
      snapshot(105, 102, 108, 99, 2000),
      null,
      history,
    );
    expect(draft.sectorRelativePct).toBeNull();
    expect(draft.sectorRelativeSigma).toBeNull();
  });

  it("keeps volume participation null when volume is missing", () => {
    const history = computeAnomalyHistory(bars(40), BOUNDARY);
    const draft = computeAnomalyMetrics(
      state(105, 100, 5),
      snapshot(105, 102, 108, 99),
      null,
      history,
    );
    expect(draft.volumeParticipation).toBeNull();
  });

  it("applies the centralized volatility floor", () => {
    expect(VOLATILITY_FLOOR_PCT).toBe(0.5);
    const history: AnomalyHistory = {
      sessionCount: 25,
      returnVol20Pct: 0,
      atr20: 3,
      avgVolume20: 1000,
      prior20High: 150,
      prior20Low: 50,
    };
    const draft = computeAnomalyMetrics(
      state(105, 100, 5),
      snapshot(105, 102, 108, 99, 2000),
      null,
      history,
    );
    expect(draft.returnSigma).toBeCloseTo(10, 5); // 5% / floor(0.5)
  });
});
