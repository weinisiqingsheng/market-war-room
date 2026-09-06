import { describe, expect, it } from "vitest";
import {
  advanceScore,
  aboveMaScore,
  breadthConfidence,
  classifyParticipation,
  computeBreadthScore,
  highLowScore,
} from "@/lib/breadth/score";

describe("breadth-v1 sub-scores", () => {
  it("advance ratio maps piecewise (0.50 → 50 neutral, 0.60 → 75)", () => {
    expect(advanceScore(0.5)).toBe(50);
    expect(advanceScore(0.6)).toBe(75);
    expect(advanceScore(0.45)).toBeCloseTo(37.5, 5);
    expect(advanceScore(0.3)).toBe(0);
    expect(advanceScore(0.8)).toBe(100);
  });

  it("above-MA maps piecewise", () => {
    expect(aboveMaScore(0.5)).toBe(50);
    expect(aboveMaScore(0.65)).toBe(75);
    expect(aboveMaScore(0.8)).toBe(100);
    expect(aboveMaScore(0.2)).toBe(0);
    expect(aboveMaScore(0.35)).toBe(25);
  });

  it("new high/low balance is neutral when both are zero", () => {
    expect(highLowScore(0, 0)).toBe(50);
  });

  it("high-dominant and low-dominant extremes map linearly", () => {
    expect(highLowScore(100, 0)).toBe(100);
    expect(highLowScore(0, 100)).toBe(0);
    expect(highLowScore(50, 50)).toBe(50);
  });
});

describe("computeBreadthScore", () => {
  it("composes weighted sub-scores deterministically", () => {
    const score = computeBreadthScore({
      advanceRatio: 0.5,
      above20Pct: 0.65,
      above50Pct: 0.8,
      newHighs20: 50,
      newLows20: 0,
    });
    expect(score).toBeCloseTo(0.35 * 50 + 0.25 * 75 + 0.25 * 100 + 0.15 * 100, 5);
  });

  it("returns null when no advance ratio exists (never guesses)", () => {
    expect(
      computeBreadthScore({
        advanceRatio: null,
        above20Pct: 0.8,
        above50Pct: 0.8,
        newHighs20: 5,
        newLows20: 5,
      }),
    ).toBeNull();
  });

  it("is deterministic for identical input", () => {
    const input = {
      advanceRatio: 0.62,
      above20Pct: 0.58,
      above50Pct: 0.55,
      newHighs20: 41,
      newLows20: 17,
    };
    expect(computeBreadthScore(input)).toBe(computeBreadthScore(input));
  });
});

describe("participation state rules", () => {
  it("broad rally", () => {
    expect(
      classifyParticipation({ spyChangePct: 0.5, advanceRatio: 0.65, above20Pct: 0.6 }).key,
    ).toBe("BROAD_RALLY");
  });

  it("narrow rally (SPY up but breadth thin)", () => {
    expect(
      classifyParticipation({ spyChangePct: 0.5, advanceRatio: 0.4, above20Pct: 0.5 }).key,
    ).toBe("NARROW_RALLY");
  });

  it("broad selloff", () => {
    expect(
      classifyParticipation({ spyChangePct: -1, advanceRatio: 0.3, above20Pct: 0.2 }).key,
    ).toBe("BROAD_SELLOFF");
  });

  it("internal resilience (SPY down but breadth holding)", () => {
    expect(
      classifyParticipation({ spyChangePct: -1, advanceRatio: 0.6, above20Pct: 0.2 }).key,
    ).toBe("INTERNAL_RESILIENCE");
  });

  it("mixed participation otherwise", () => {
    expect(
      classifyParticipation({ spyChangePct: 0.2, advanceRatio: 0.5, above20Pct: 0.4 }).key,
    ).toBe("MIXED_PARTICIPATION");
    expect(
      classifyParticipation({ spyChangePct: null, advanceRatio: 0.6, above20Pct: 0.6 }).key,
    ).toBe("MIXED_PARTICIPATION");
  });
});

describe("breadth confidence", () => {
  it("maps coverage bands: >=95 high, 85–95 medium, 70–85 low, <70 insufficient", () => {
    expect(breadthConfidence(0.97)).toBe("high");
    expect(breadthConfidence(0.95)).toBe("high");
    expect(breadthConfidence(0.9)).toBe("medium");
    expect(breadthConfidence(0.85)).toBe("medium");
    expect(breadthConfidence(0.8)).toBe("low");
    expect(breadthConfidence(0.7)).toBe("low");
    expect(breadthConfidence(0.69)).toBe("insufficient");
  });
});
