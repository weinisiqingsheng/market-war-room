/**
 * Deterministic breadth aggregation (pure) — turns normalized symbol states and
 * per-symbol history into breadth metrics/counts.
 *
 * Unavailable constituents never count as unchanged; they are excluded from
 * every numerator and denominator. Above-MA denominators are the number of
 * names with adequate completed history, never the full universe.
 */
import { NEW_HIGH_LOW_WINDOW } from "./constants";
import type { SymbolHistory } from "./history";
import type { BreadthSymbolState } from "./normalize";

export interface BreadthAggregate {
  universeCount: number;
  currentCoverageCount: number;
  historical20CoverageCount: number;
  historical50CoverageCount: number;
  coveragePct: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  advanceRatio: number | null;
  above20Pct: number | null;
  above50Pct: number | null;
  newHighs20: number;
  newLows20: number;
}

export function aggregateBreadth(
  states: BreadthSymbolState[],
  histories: Map<string, SymbolHistory>,
  universeCount: number,
): BreadthAggregate {
  let advancers = 0;
  let decliners = 0;
  let unchanged = 0;
  let currentCoverageCount = 0;

  let above20Numerator = 0;
  let above20Denominator = 0;
  let above50Numerator = 0;
  let above50Denominator = 0;

  let historical20 = 0;
  let historical50 = 0;

  let newHighs20 = 0;
  let newLows20 = 0;

  for (const state of states) {
    if (!state.available) continue;
    currentCoverageCount += 1;

    if (state.move === "advancer") advancers += 1;
    else if (state.move === "decliner") decliners += 1;
    else if (state.move === "unchanged") unchanged += 1;

    const history = histories.get(state.ticker);
    if (history) {
      if (history.sma20 !== null) {
        historical20 += 1;
        if (state.refPrice !== null && state.refPrice > history.sma20) above20Numerator += 1;
        above20Denominator += 1;
      }
      if (history.sma50 !== null) {
        historical50 += 1;
        if (state.refPrice !== null && state.refPrice > history.sma50) above50Numerator += 1;
        above50Denominator += 1;
      }
      if (history.high20 !== null && history.low20 !== null && state.refPrice !== null) {
        if (state.refPrice > history.high20) newHighs20 += 1;
        if (state.refPrice < history.low20) newLows20 += 1;
      }
    }
  }

  const moverTotal = advancers + decliners;
  const advanceRatio = moverTotal > 0 ? advancers / moverTotal : null;
  const coveragePct = universeCount > 0 ? currentCoverageCount / universeCount : 0;

  return {
    universeCount,
    currentCoverageCount,
    historical20CoverageCount: historical20,
    historical50CoverageCount: historical50,
    coveragePct,
    advancers,
    decliners,
    unchanged,
    advanceRatio,
    above20Pct: above20Denominator > 0 ? above20Numerator / above20Denominator : null,
    above50Pct: above50Denominator > 0 ? above50Numerator / above50Denominator : null,
    newHighs20,
    newLows20,
  };
}

/** Only used for the 20D high/low comparison: expose the window constant. */
export const BREADTH_HIGH_LOW_WINDOW = NEW_HIGH_LOW_WINDOW;
