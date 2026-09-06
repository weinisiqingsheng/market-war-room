import { describe, expect, it } from "vitest";
import type { AlpacaSymbolSnapshot } from "@/lib/market-data/normalize";
import {
  classifySectorSignal,
  computeDayPosition,
  computeRelativeReturn,
  computeSectorStrength,
  computeStale,
  normalizeAlpacaSnapshot,
} from "@/lib/market-data/normalize";

function snapshot(partial: Partial<AlpacaSymbolSnapshot> = {}): AlpacaSymbolSnapshot {
  return {
    latestTrade: { t: "2026-08-31T14:30:00Z", p: 100.5, s: 12000 },
    minuteBar: { t: "2026-08-31T14:30:00Z", o: 99.9, h: 101.2, l: 99.8, c: 100.5, v: 5000 },
    dailyBar: { t: "2026-08-31T04:00:00Z", o: 99, h: 101.2, l: 98.5, c: 100.5, v: 400000 },
    prevDailyBar: { t: "2026-08-28T04:00:00Z", o: 98, h: 99.5, l: 97.5, c: 98.5, v: 380000 },
    ...partial,
  };
}

describe("normalizeAlpacaSnapshot", () => {
  it("selects the latest trade price as the current price", () => {
    const result = normalizeAlpacaSnapshot("SPY", snapshot(), "iex");
    expect(result.price).toBe(100.5);
    expect(result.source).toBe("latest_trade");
    expect(result.available).toBe(true);
  });

  it("falls back to the minute bar close when no latest trade price exists", () => {
    const raw = snapshot();
    raw.latestTrade = undefined;
    const result = normalizeAlpacaSnapshot("SPY", raw, "iex");
    expect(result.price).toBe(100.5);
    expect(result.source).toBe("minute_bar");
  });

  it("falls back to the daily bar close when trade and minute bar are missing", () => {
    const raw = snapshot();
    raw.latestTrade = undefined;
    raw.minuteBar = undefined;
    const result = normalizeAlpacaSnapshot("SPY", raw, "iex");
    expect(result.price).toBe(100.5);
    expect(result.source).toBe("daily_bar");
  });

  it("marks a snapshot unavailable when no price source exists", () => {
    const raw = snapshot();
    raw.latestTrade = undefined;
    raw.minuteBar = undefined;
    raw.dailyBar = undefined;
    const result = normalizeAlpacaSnapshot("SPY", raw, "iex");
    expect(result.available).toBe(false);
    expect(result.price).toBeNull();
    expect(result.source).toBe("unavailable");
  });

  it("calculates change and changePct from previous close", () => {
    const result = normalizeAlpacaSnapshot("SPY", snapshot(), "iex");
    expect(result.change).toBeCloseTo(100.5 - 98.5, 5);
    expect(result.changePct).toBeCloseTo(((100.5 - 98.5) / 98.5) * 100, 5);
  });

  it("guards a previousClose of zero (no division by zero, no fabricated change)", () => {
    const raw = snapshot();
    raw.prevDailyBar = { c: 0 };
    const result = normalizeAlpacaSnapshot("SPY", raw, "iex");
    expect(result.price).toBe(100.5);
    expect(result.change).toBeNull();
    expect(result.changePct).toBeNull();
  });

  it("tolerates a null raw entry", () => {
    const result = normalizeAlpacaSnapshot("QQQ", null, "iex");
    expect(result.available).toBe(false);
    expect(result.price).toBeNull();
  });

  it("preserves OHLC and volume from the daily bar", () => {
    const result = normalizeAlpacaSnapshot("SPY", snapshot(), "iex");
    expect(result.open).toBe(99);
    expect(result.high).toBe(101.2);
    expect(result.low).toBe(98.5);
    expect(result.volume).toBe(400000);
  });
});

describe("computeDayPosition", () => {
  it("returns the clamped position within the day range", () => {
    expect(computeDayPosition(105, 100, 110)).toBe(0.5);
    expect(computeDayPosition(110, 100, 110)).toBe(1);
    expect(computeDayPosition(99, 100, 110)).toBe(0);
  });

  it("handles high === low without division by zero", () => {
    expect(computeDayPosition(100, 100, 100)).toBe(0);
  });

  it("returns null when inputs are missing", () => {
    expect(computeDayPosition(null, 100, 110)).toBeNull();
    expect(computeDayPosition(105, null, 110)).toBeNull();
    expect(computeDayPosition(105, 100, null)).toBeNull();
  });
});

describe("sector relative strength", () => {
  it("computes relative return vs the benchmark", () => {
    expect(computeRelativeReturn(2.1, -0.24)).toBeCloseTo(2.34, 5);
    expect(computeRelativeReturn(null, -0.24)).toBeNull();
    expect(computeRelativeReturn(2.1, null)).toBeNull();
  });

  it("classifies deterministic signal labels from thresholds", () => {
    expect(classifySectorSignal(1.2)).toEqual({ signal: "Leader", tone: "positive" });
    expect(classifySectorSignal(0.6)).toEqual({ signal: "Strong", tone: "positive" });
    expect(classifySectorSignal(0.2)).toEqual({ signal: "Firm", tone: "positive" });
    expect(classifySectorSignal(-0.2)).toEqual({ signal: "Neutral", tone: "neutral" });
    expect(classifySectorSignal(-0.6)).toEqual({ signal: "Weak", tone: "negative" });
    expect(classifySectorSignal(-1.2)).toEqual({ signal: "Laggard", tone: "negative" });
    expect(classifySectorSignal(null)).toEqual({ signal: "Unavailable", tone: "neutral" });
  });

  it("maps relative return to a bounded 0–100 strength", () => {
    expect(computeSectorStrength(2.34)).toBeCloseTo(73.4, 1);
    expect(computeSectorStrength(-10)).toBe(5);
    expect(computeSectorStrength(10)).toBe(95);
    expect(computeSectorStrength(null)).toBeNull();
  });
});

describe("computeStale", () => {
  const now = Date.parse("2026-08-31T15:00:00Z");

  it("marks data stale while the market is open and the newest timestamp is old", () => {
    const old = new Date(now - 300_000).toISOString();
    expect(computeStale({ maxTimestamp: old, marketOpen: true, now, thresholdMs: 120_000 })).toBe(
      true,
    );
  });

  it("does not mark fresh data stale while the market is open", () => {
    const fresh = new Date(now - 30_000).toISOString();
    expect(computeStale({ maxTimestamp: fresh, marketOpen: true, now, thresholdMs: 120_000 })).toBe(
      false,
    );
  });

  it("never marks closed-market data stale even if the latest trade is old", () => {
    const old = new Date(now - 86_400_000).toISOString();
    expect(computeStale({ maxTimestamp: old, marketOpen: false, now, thresholdMs: 120_000 })).toBe(
      false,
    );
  });

  it("treats an unknown market state as not stale", () => {
    expect(computeStale({ maxTimestamp: null, marketOpen: null, now, thresholdMs: 120_000 })).toBe(
      false,
    );
  });

  it("treats an open market with no timestamps as stale", () => {
    expect(computeStale({ maxTimestamp: null, marketOpen: true, now, thresholdMs: 120_000 })).toBe(
      true,
    );
  });
});
