import { describe, expect, it } from "vitest";
import { CHANGE_EPSILON_PCT } from "@/lib/breadth/constants";
import { normalizeBreadthSymbol } from "@/lib/breadth/normalize";
import type { AlpacaBreadthSnapshot } from "@/lib/breadth/normalize";

const NOW = Date.parse("2026-09-02T15:00:00Z"); // 11:00 ET Tue (session open)

function snapshot(overrides: Partial<AlpacaBreadthSnapshot> = {}): AlpacaBreadthSnapshot {
  return {
    dailyBar: { t: "2026-09-02T20:00:00Z", o: 100, h: 101, l: 99, c: 101, v: 1000 },
    prevDailyBar: { t: "2026-09-01T20:00:00Z", c: 100 },
    latestTrade: { t: "2026-09-02T14:59:00Z", p: 101.5 },
    ...overrides,
  };
}

describe("normalizeBreadthSymbol", () => {
  it("classifies an advancer when the session price is up", () => {
    const state = normalizeBreadthSymbol("AAA", snapshot(), true, NOW);
    expect(state.available).toBe(true);
    expect(state.move).toBe("advancer");
    expect(state.changePct).toBeCloseTo(1.0, 5);
  });

  it("classifies a decliner when the session price is down", () => {
    const raw = snapshot();
    raw.dailyBar = { ...raw.dailyBar, c: 99.4 };
    const state = normalizeBreadthSymbol("AAA", raw, true, NOW);
    expect(state.move).toBe("decliner");
  });

  it("uses the epsilon to keep near-zero moves unchanged (floating-point noise)", () => {
    const raw = snapshot();
    raw.dailyBar = { ...raw.dailyBar, c: 100 + CHANGE_EPSILON_PCT / 2 };
    expect(normalizeBreadthSymbol("AAA", raw, true, NOW).move).toBe("unchanged");
  });

  it("never classifies a missing snapshot as unchanged", () => {
    const state = normalizeBreadthSymbol("AAA", undefined, true, NOW);
    expect(state.available).toBe(false);
    expect(state.move).toBe("unavailable");
  });

  it("never classifies missing previous close as unchanged", () => {
    const raw = snapshot({ prevDailyBar: undefined });
    const state = normalizeBreadthSymbol("AAA", raw, true, NOW);
    expect(state.available).toBe(false);
    expect(state.move).toBe("unavailable");
  });

  it("uses the regular-session daily close after hours, ignoring after-hours trades", () => {
    // Market closed; latestTrade is an after-hours/overnight price → ignored.
    const raw = snapshot();
    raw.latestTrade = { t: "2026-09-02T22:30:00Z", p: 110 };
    const state = normalizeBreadthSymbol("AAA", raw, false, NOW);
    expect(state.refPrice).toBe(101); // daily close, not 110
  });

  it("uses the running daily close during the session even when trades exist", () => {
    const state = normalizeBreadthSymbol("AAA", snapshot(), true, NOW);
    expect(state.refPrice).toBe(101);
  });

  it("carries the session date of the current daily bar", () => {
    const state = normalizeBreadthSymbol("AAA", snapshot(), true, NOW);
    expect(state.sessionDate).toBe("2026-09-02");
  });
});
