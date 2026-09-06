/**
 * breadth-v1 scoring + participation-state rules (deterministic).
 *
 * These are the ONLY place breadth score thresholds live (besides constants).
 * Regime-v1 is intentionally untouched — breadth is not a regime-v1 input in
 * this phase (a future regime-v2 integration is documented, not built).
 */
import {
  ABOVE_MA_POINTS,
  ADVANCE_RATIO_POINTS,
  CONFIDENCE_HIGH,
  CONFIDENCE_LOW,
  CONFIDENCE_MEDIUM,
  SCORE_WEIGHTS,
} from "./constants";
import type { BreadthConfidence, BreadthState, BreadthStateKey } from "./types";

export interface BreadthScoreInput {
  advanceRatio: number | null;
  above20Pct: number | null;
  above50Pct: number | null;
  newHighs20: number;
  newLows20: number;
}

/** Piecewise-linear map over (x, y) points; flat/clamped outside endpoints. */
export function mapRatio(x: number, points: ReadonlyArray<readonly [number, number]>): number {
  if (x <= points[0][0]) return points[0][1];
  if (x >= points[points.length - 1][0]) return points[points.length - 1][1];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x0 <= x && x <= x1) {
      const span = x1 - x0;
      return span === 0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / span;
    }
  }
  return points[points.length - 1][1];
}

export function advanceScore(advanceRatio: number): number {
  return mapRatio(advanceRatio, ADVANCE_RATIO_POINTS);
}

export function aboveMaScore(pct: number): number {
  return mapRatio(pct, ABOVE_MA_POINTS);
}

export function highLowScore(newHighs: number, newLows: number): number {
  if (newHighs + newLows === 0) return 50; // no extremes → neutral
  const highRatio = newHighs / (newHighs + newLows);
  return highRatio * 100; // linear 0 → 0, 0.5 → 50, 1 → 100
}

/**
 * Weighted composition, renormalized over available components. Missing
 * components never become neutral 50 — they are simply not counted.
 */
export function computeBreadthScore(input: BreadthScoreInput): number | null {
  if (input.advanceRatio === null) return null;

  const present: Array<[number, number]> = [];
  if (input.advanceRatio !== null) {
    present.push([advanceScore(input.advanceRatio), SCORE_WEIGHTS.advance]);
  }
  if (input.above20Pct !== null) {
    present.push([aboveMaScore(input.above20Pct), SCORE_WEIGHTS.above20]);
  }
  if (input.above50Pct !== null) {
    present.push([aboveMaScore(input.above50Pct), SCORE_WEIGHTS.above50]);
  }
  present.push([highLowScore(input.newHighs20, input.newLows20), SCORE_WEIGHTS.highLow]);

  const totalWeight = present.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight <= 0) return null;
  return present.reduce((sum, [value, weight]) => sum + (value * weight) / totalWeight, 0);
}

/** Deterministic confidence from current coverage (>= .95 high, etc). */
export function breadthConfidence(coveragePct: number): BreadthConfidence {
  if (coveragePct >= CONFIDENCE_HIGH) return "high";
  if (coveragePct >= CONFIDENCE_MEDIUM) return "medium";
  if (coveragePct >= CONFIDENCE_LOW) return "low";
  return "insufficient";
}

const STATE_LABELS: Record<BreadthStateKey, string> = {
  BROAD_RALLY: "Broad Rally",
  NARROW_RALLY: "Narrow Rally",
  BROAD_SELLOFF: "Broad Selloff",
  INTERNAL_RESILIENCE: "Internal Resilience",
  MIXED_PARTICIPATION: "Mixed Participation",
};

function state(key: BreadthStateKey): BreadthState {
  return { key, label: STATE_LABELS[key] };
}

/**
 * Deterministic participation rules (order matters):
 *  SPY up   & advanceRatio >= 0.60 & above20Pct >= 0.55 → BROAD RALLY
 *  SPY up   & advanceRatio <  0.45                     → NARROW RALLY
 *  SPY down & advanceRatio <= 0.40                     → BROAD SELLOFF
 *  SPY down & advanceRatio >  0.55                     → INTERNAL RESILIENCE
 *  otherwise                                           → MIXED PARTICIPATION
 */
export function classifyParticipation(params: {
  spyChangePct: number | null;
  advanceRatio: number | null;
  above20Pct: number | null;
}): BreadthState {
  const { spyChangePct, advanceRatio, above20Pct } = params;
  if (spyChangePct === null || advanceRatio === null) return state("MIXED_PARTICIPATION");

  if (spyChangePct > 0) {
    if (advanceRatio >= 0.6 && above20Pct !== null && above20Pct >= 0.55) {
      return state("BROAD_RALLY");
    }
    if (advanceRatio < 0.45) return state("NARROW_RALLY");
    return state("MIXED_PARTICIPATION");
  }

  if (spyChangePct < 0) {
    if (advanceRatio <= 0.4) return state("BROAD_SELLOFF");
    if (advanceRatio > 0.55) return state("INTERNAL_RESILIENCE");
    return state("MIXED_PARTICIPATION");
  }

  return state("MIXED_PARTICIPATION");
}
