import "server-only";
import type {
  FrozenProspectiveDecision,
  ProspectiveObservationCandidate,
  ProspectiveSessionCalendar,
} from "./types";

export type HorizonEligibility =
  | { eligible: true; expectedSessionDate: string }
  | { eligible: false; reason: string; expectedSessionDate?: string };

function timestamp(value: string): number {
  return Date.parse(value);
}

function hasIndependentProvenance(
  decision: FrozenProspectiveDecision,
  observation: ProspectiveObservationCandidate,
): boolean {
  return (
    observation.availability === "available" &&
    typeof observation.provider === "string" &&
    observation.provider.length > 0 &&
    typeof observation.feed === "string" &&
    observation.feed.length > 0 &&
    observation.priceReferenceType !== "unknown" &&
    typeof observation.sourceVersion === "string" &&
    observation.sourceVersion.length > 0 &&
    typeof observation.sourceFingerprint === "string" &&
    /^[a-f0-9]{64}$/.test(observation.sourceFingerprint) &&
    observation.sourceFingerprint !== decision.sourceFingerprint
  );
}

export function evaluateHorizonEligibility(input: {
  decision: FrozenProspectiveDecision;
  observation: ProspectiveObservationCandidate;
  calendar: ProspectiveSessionCalendar;
}): HorizonEligibility {
  const { decision, observation, calendar } = input;
  const requestedMs = timestamp(decision.requestedAt);
  const effectiveMs = timestamp(decision.effectiveAsOf);
  const observedMs = timestamp(observation.observedAt);
  if (![requestedMs, effectiveMs, observedMs].every(Number.isFinite))
    return { eligible: false, reason: "invalid_timestamp" };
  if (observedMs <= requestedMs || observedMs <= effectiveMs)
    return { eligible: false, reason: "look_ahead" };
  if (
    observation.availability !== "available" ||
    observation.completeness === "unavailable" ||
    observation.price === null
  )
    return { eligible: false, reason: "observation_unavailable" };
  if (observation.completeness !== "complete")
    return { eligible: false, reason: "observation_incomplete" };
  if (observation.freshness === "stale") return { eligible: false, reason: "observation_stale" };
  if (!hasIndependentProvenance(decision, observation))
    return { eligible: false, reason: "observation_provenance_unverified" };
  if (!observation.regularSession) return { eligible: false, reason: "not_regular_session" };
  if (observation.halted) return { eligible: false, reason: "session_halted" };

  if (decision.horizon === "session_close" && decision.marketSessionStatus !== "regular")
    return { eligible: false, reason: "session_already_closed" };

  const observedSession = calendar.sessionFor(observation.sessionDate);
  if (!observedSession || !observedSession.regular)
    return { eligible: false, reason: "session_not_eligible" };
  const observedInsideSession = calendar.containsRegularInstant(
    observedSession,
    observation.observedAt,
  );
  const observedAtOrAfterClose = observedMs >= timestamp(observedSession.closeAt);
  if (!observedInsideSession && !(decision.horizon !== "one_hour" && observedAtOrAfterClose))
    return { eligible: false, reason: "outside_regular_session" };

  if (decision.horizon === "one_hour") {
    const decisionSession = calendar.sessionFor(decision.marketSessionDate);
    if (!decisionSession || decision.marketSessionStatus !== "regular")
      return { eligible: false, reason: "intraday_window_unavailable" };
    if (observation.sessionDate !== decision.marketSessionDate)
      return { eligible: false, reason: "wrong_session" };
    if (observedMs < effectiveMs + 60 * 60_000)
      return { eligible: false, reason: "one_hour_not_reached" };
    return { eligible: true, expectedSessionDate: decision.marketSessionDate };
  }

  if (decision.horizon === "session_close") {
    const decisionSession = calendar.sessionFor(decision.marketSessionDate);
    if (!decisionSession) return { eligible: false, reason: "session_not_eligible" };
    const closeMs = timestamp(decisionSession.closeAt);
    if (requestedMs >= closeMs || effectiveMs >= closeMs)
      return { eligible: false, reason: "decision_at_or_after_close" };
    if (observation.sessionDate !== decision.marketSessionDate)
      return { eligible: false, reason: "wrong_session" };
    if (observedMs < timestamp(decisionSession.closeAt))
      return { eligible: false, reason: "session_close_not_reached" };
    return { eligible: true, expectedSessionDate: decision.marketSessionDate };
  }

  const nextSession = calendar.nextSessionAfter(decision.marketSessionDate);
  if (!nextSession) return { eligible: false, reason: "next_session_unavailable" };
  if (observation.sessionDate !== nextSession.sessionDate)
    return {
      eligible: false,
      reason: "wrong_session",
      expectedSessionDate: nextSession.sessionDate,
    };
  if (observedMs < timestamp(nextSession.closeAt))
    return {
      eligible: false,
      reason: "next_session_close_not_reached",
      expectedSessionDate: nextSession.sessionDate,
    };
  return { eligible: true, expectedSessionDate: nextSession.sessionDate };
}
