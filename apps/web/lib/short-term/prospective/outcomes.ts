import "server-only";
import { evaluateHorizonEligibility } from "./horizons";
import type {
  FrozenProspectiveDecision,
  ProspectiveObservationCandidate,
  ProspectiveOutcomeRecord,
  ProspectiveSessionCalendar,
} from "./types";
import { PROSPECTIVE_OUTCOME_VERSION } from "./types";

export const OUTCOME_FLAT_BAND_PCT = 0.1;

function round(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}

function outcomeLabel(returnPct: number): "up" | "flat" | "down" {
  if (returnPct > OUTCOME_FLAT_BAND_PCT) return "up";
  if (returnPct < -OUTCOME_FLAT_BAND_PCT) return "down";
  return "flat";
}

function unavailableOutcome(
  decision: FrozenProspectiveDecision,
  observation: ProspectiveObservationCandidate,
  reason: string,
): ProspectiveOutcomeRecord {
  return {
    schemaVersion: PROSPECTIVE_OUTCOME_VERSION,
    runId: decision.runId,
    ticker: decision.ticker,
    stateFingerprint: decision.stateFingerprint,
    horizon: decision.horizon,
    decisionEffectiveAsOf: decision.effectiveAsOf,
    referencePrice: decision.referencePrice,
    observedPrice: null,
    observedAt: observation.completeness === "unavailable" ? null : observation.observedAt,
    sessionDate: observation.completeness === "unavailable" ? null : observation.sessionDate,
    provider: observation.provider || null,
    feed: observation.feed || null,
    delayMinutes: observation.delayMinutes,
    freshness: observation.freshness,
    availability: observation.availability,
    priceReferenceType: observation.priceReferenceType,
    sourceVersion: observation.sourceVersion,
    sourceFingerprint: observation.sourceFingerprint,
    completeness: observation.completeness,
    returnPct: null,
    label: "not_observable",
    reason,
  };
}

export function collectProspectiveOutcome(input: {
  decision: FrozenProspectiveDecision;
  observation: ProspectiveObservationCandidate;
  calendar: ProspectiveSessionCalendar;
}): ProspectiveOutcomeRecord {
  const { decision, observation, calendar } = input;
  if (observation.ticker !== decision.ticker)
    throw new Error("Outcome ticker does not match frozen decision ticker.");
  if (observation.stateFingerprint !== decision.stateFingerprint)
    throw new Error("Outcome state fingerprint does not match frozen decision fingerprint.");

  const eligibility = evaluateHorizonEligibility({ decision, observation, calendar });
  if (!eligibility.eligible) {
    if (eligibility.reason === "look_ahead")
      throw new Error("Outcome violates look-ahead protection.");
    return unavailableOutcome(decision, observation, eligibility.reason);
  }
  if (observation.price === null || !Number.isFinite(observation.price) || observation.price <= 0)
    return unavailableOutcome(decision, observation, "observation_price_invalid");

  const returnPct = round(
    ((observation.price - decision.referencePrice) / decision.referencePrice) * 100,
  );
  return {
    schemaVersion: PROSPECTIVE_OUTCOME_VERSION,
    runId: decision.runId,
    ticker: decision.ticker,
    stateFingerprint: decision.stateFingerprint,
    horizon: decision.horizon,
    decisionEffectiveAsOf: decision.effectiveAsOf,
    referencePrice: decision.referencePrice,
    observedPrice: observation.price,
    observedAt: observation.observedAt,
    sessionDate: observation.sessionDate,
    provider: observation.provider,
    feed: observation.feed,
    delayMinutes: observation.delayMinutes,
    freshness: observation.freshness,
    availability: observation.availability,
    priceReferenceType: observation.priceReferenceType,
    sourceVersion: observation.sourceVersion,
    sourceFingerprint: observation.sourceFingerprint,
    completeness: "complete",
    returnPct,
    label: outcomeLabel(returnPct),
    reason: null,
  };
}
