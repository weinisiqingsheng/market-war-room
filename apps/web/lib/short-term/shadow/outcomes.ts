export interface ShadowDecisionBoundary {
  requestedAt: string;
  effectiveAsOf: string | null;
}

export interface ObservedMarketOutcome {
  observedAt: string;
  horizonHours: number;
  label: string;
}

export function joinObservedOutcome(
  boundary: ShadowDecisionBoundary,
  outcome: ObservedMarketOutcome,
): { observedAt: string; horizonHours: number; label: string } {
  const requestedMs = Date.parse(boundary.requestedAt);
  const effectiveMs = boundary.effectiveAsOf ? Date.parse(boundary.effectiveAsOf) : requestedMs;
  const observedMs = Date.parse(outcome.observedAt);
  if (![requestedMs, effectiveMs, observedMs].every(Number.isFinite))
    throw new Error("Outcome timestamps are invalid");
  if (observedMs <= requestedMs || observedMs < effectiveMs)
    throw new Error("Outcome violates look-ahead protection");
  if (!Number.isInteger(outcome.horizonHours) || outcome.horizonHours <= 0)
    throw new Error("Outcome horizon is invalid");
  return outcome;
}
