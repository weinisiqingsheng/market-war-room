/**
 * Candidate-specific catalyst cutoffs (catalyst-match-v1 temporal hardening).
 *
 * During an open session, anomaly candidates can carry slightly different
 * provider price timestamps. Evidence must therefore be judged against the
 * candidate's own priceAsOf rather than a single overview-level effectiveAsOf.
 *
 *   candidateCatalystCutoff = min(valid candidate.priceAsOf, overview.effectiveAsOf)
 *
 * Missing priceAsOf → overview effectiveAsOf. A priceAsOf later than the
 * overview effective time is clamped. Closed-market (completed-session)
 * candidates resolve to the same regular-session close as the overview, so
 * Friday/weekend behavior is unchanged.
 */
import type { CatalystWindow } from "./time-window";

function parseMs(iso: string): number | null {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? null : parsed;
}

export function resolveCandidateCutoff(input: {
  priceAsOf: string | null | undefined;
  overviewEffectiveAsOf: string | null;
  marketOpen: boolean | null;
}): string | null {
  const { priceAsOf, overviewEffectiveAsOf, marketOpen } = input;
  if (!overviewEffectiveAsOf) return priceAsOf ?? null;

  // Closed market: prices are the completed regular session, so the overview
  // effectiveAsOf (session close) is already the correct per-candidate cutoff.
  if (marketOpen !== true) return overviewEffectiveAsOf;

  const priceMs = priceAsOf ? parseMs(priceAsOf) : null;
  const overviewMs = parseMs(overviewEffectiveAsOf);
  if (priceMs === null || overviewMs === null || Number.isNaN(priceMs)) {
    return overviewEffectiveAsOf;
  }
  // Clamp: a candidate timestamp later than the overview is invalid.
  return priceMs <= overviewMs ? priceAsOf! : overviewEffectiveAsOf;
}

/** Per-candidate window: same start, candidate-specific inclusive cutoff. */
export function applyCandidateWindow(
  base: CatalystWindow,
  candidateCutoff: string | null,
): CatalystWindow {
  return {
    startIso: base.startIso,
    cutoffIso: candidateCutoff,
    currentSessionDate: base.currentSessionDate,
  };
}
