import { describe, expect, it } from "vitest";
import { computeSymbolHistory, completedSessions } from "@/lib/breadth/history";
import type { AlpacaBreadthBar } from "@/lib/breadth/normalize";
import { aggregateBreadth } from "@/lib/breadth/metrics";
import { normalizeBreadthSymbol } from "@/lib/breadth/normalize";

const BOUNDARY = "2026-09-02";
const NOW = Date.parse("2026-09-02T15:00:00Z");

/** Builds `count` completed daily bars ending the day before `BOUNDARY`. */
function dailyBars(count: number): AlpacaBreadthBar[] {
  const bars: AlpacaBreadthBar[] = [];
  for (let j = count; j >= 1; j -= 1) {
    const day = -j; // -1 = yesterday, ... -count = oldest requested day
    const iso = new Date(Date.parse(`${BOUNDARY}T20:00:00Z`) + day * 86_400_000).toISOString();
    const value = 100 + (count - j + 1); // oldest 101 → newest 100 + count
    bars.push({ t: iso, o: value - 1, h: value + 2, l: value - 1, c: value, v: 1000 });
  }
  return bars;
}

describe("completedSessions / computeSymbolHistory", () => {
  it("excludes the currently-forming session from the completed window", () => {
    const bars = [...dailyBars(50), { t: `${BOUNDARY}T20:00:00Z`, c: 9999, h: 9999, l: 0 }];
    const sessions = completedSessions(bars, BOUNDARY);
    expect(sessions.length).toBe(50);
    expect(sessions.some((bar) => bar.c === 9999)).toBe(false);
  });

  it("computes SMA20 from the last 20 completed closes", () => {
    const history = computeSymbolHistory(dailyBars(50), BOUNDARY);
    expect(history.sma20).not.toBeNull();
    expect(history.sessionCount).toBe(50);
    // Newest completed close is 100 + 50 = 150; oldest of the last 20 is 100 + 31.
    const expected =
      dailyBars(50)
        .map((bar) => bar.c as number)
        .sort((a, b) => b - a)
        .slice(0, 20)
        .reduce((sum, value) => sum + value, 0) / 20;
    expect(history.sma20).toBeCloseTo(expected, 5);
  });

  it("computes SMA50 when at least 50 completed closes exist", () => {
    const history = computeSymbolHistory(dailyBars(60), BOUNDARY);
    expect(history.sma50).not.toBeNull();
    expect(history.sma20).not.toBeNull();
  });

  it("returns null SMA when history is insufficient", () => {
    const history = computeSymbolHistory(dailyBars(10), BOUNDARY);
    expect(history.sma20).toBeNull();
    expect(history.sma50).toBeNull();
  });

  it("computes 20D high/low over the previous 20 completed sessions", () => {
    const history = computeSymbolHistory(dailyBars(30), BOUNDARY);
    expect(history.high20).toBeCloseTo(100 + 30 + 2, 5); // newest session high
    expect(history.low20).toBeCloseTo(100 + (30 - 19) - 1, 5); // oldest in the 20-window low
    expect(history.high20).not.toBeNull();
  });

  it("returns null 20D range when fewer than 20 completed sessions exist", () => {
    const history = computeSymbolHistory(dailyBars(12), BOUNDARY);
    expect(history.high20).toBeNull();
    expect(history.low20).toBeNull();
  });
});

describe("aggregateBreadth", () => {
  function stateFor(
    ticker: string,
    move: "advancer" | "decliner" | "unchanged",
    price: number,
    prev: number,
  ) {
    const raw = {
      dailyBar: { t: `${BOUNDARY}T20:00:00Z`, c: price, h: price, l: price - 1 },
      prevDailyBar: { t: "2026-09-01T20:00:00Z", c: prev },
    };
    return normalizeBreadthSymbol(ticker, raw, true, NOW);
  }

  it("counts advancers/decliners/unchanged and excludes unavailable names from the denominator", () => {
    const states = [
      stateFor("AAA", "advancer", 102, 100),
      stateFor("BBB", "decliner", 98, 100),
      stateFor("CCC", "unchanged", 100.0004, 100),
      { ...normalizeBreadthSymbol("DDD", undefined, true, NOW) }, // unavailable
    ];
    const aggregate = aggregateBreadth(states, new Map(), states.length);
    expect(aggregate.advancers).toBe(1);
    expect(aggregate.decliners).toBe(1);
    expect(aggregate.unchanged).toBe(1);
    expect(aggregate.advanceRatio).toBeCloseTo(0.5, 5);
    expect(aggregate.currentCoverageCount).toBe(3);
    expect(aggregate.coveragePct).toBeCloseTo(0.75, 5);
  });
});
