import "server-only";
import type { ForwardDirectionPredictionRecord, ForwardObservedOutcome } from "./types";
import type { ProspectiveSessionCalendar } from "../prospective/types";

export const FORWARD_OUTCOME_SCHEMA_VERSION = "short-term-forward-outcome-v1" as const;
export const FORWARD_OUTCOME_SOURCE_VERSION = "alpaca-v2-stocks-bars-1day-sip-split-v1" as const;
export const FORWARD_OUTCOME_DELAY_MINUTES = 15 as const;
export const FORWARD_OUTCOME_FLAT_BAND_PCT = 0.1 as const;

export interface ForwardOutcomeObservation {
  ticker: string;
  stateFingerprint: string;
  sessionDate: string;
  observedAt: string;
  observedPrice: number;
  provider: string;
  feed: string;
  delayMinutes: number;
  freshness: "delayed";
  availability: "available";
  completeness: "complete";
  regularSession: boolean;
  halted: boolean;
  priceReferenceType: "daily_bar_close_split_adjusted";
  sourceVersion: string;
  sourceFingerprint: string;
}

export interface ForwardOutcomeRecord {
  schemaVersion: typeof FORWARD_OUTCOME_SCHEMA_VERSION;
  predictionId: string;
  originalDecisionRunId: string;
  ticker: string;
  taskId: "next_session_direction_v1";
  taskVersion: "short-term-forward-direction-v1";
  questionSetVersion: "short-term-forward-questions-v1";
  horizon: "next_session_close";
  marketDataPolicyVersion: "short-term-forward-market-data-policy-v1";
  targetSessionDate: string;
  targetCloseAt: string;
  decisionRequestedAt: string;
  decisionEffectiveAsOf: string;
  stateFingerprint: string;
  predictionOutputFingerprint: string;
  referencePrice: number;
  observedPrice: number;
  observedAt: string;
  sessionDate: string;
  provider: "alpaca";
  feed: "sip";
  delayMinutes: 15;
  freshness: "delayed";
  availability: "available";
  completeness: "complete";
  priceReferenceType: "daily_bar_close_split_adjusted";
  sourceVersion: typeof FORWARD_OUTCOME_SOURCE_VERSION;
  sourceFingerprint: string;
  returnPct: number;
  label: ForwardObservedOutcome["label"];
  collectedAt: string;
}

function timestamp(value: string, name: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${name} timestamp`);
  return parsed;
}

function fingerprint(value: string, name: string): void {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error(`Invalid ${name} fingerprint`);
}

function label(returnPct: number): ForwardObservedOutcome["label"] {
  if (returnPct > FORWARD_OUTCOME_FLAT_BAND_PCT) return "UP";
  if (returnPct < -FORWARD_OUTCOME_FLAT_BAND_PCT) return "DOWN";
  return "FLAT";
}

function rounded(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}

export function buildForwardOutcomeRecord(input: {
  prediction: ForwardDirectionPredictionRecord;
  observation: ForwardOutcomeObservation;
  collectedAt: string;
  calendar: ProspectiveSessionCalendar;
}): ForwardOutcomeRecord {
  const { prediction, observation } = input;
  const collectedAtMs = timestamp(input.collectedAt, "collectedAt");
  const targetCloseMs = timestamp(prediction.targetCloseAt, "targetCloseAt");
  const observedAtMs = timestamp(observation.observedAt, "observedAt");
  timestamp(prediction.requestedAt, "decisionRequestedAt");
  timestamp(prediction.effectiveAsOf, "decisionEffectiveAsOf");
  if (prediction.taskId !== "next_session_direction_v1") throw new Error("Outcome task mismatch");
  if (prediction.taskVersion !== "short-term-forward-direction-v1")
    throw new Error("Outcome task version mismatch");
  if (prediction.questionSetVersion !== "short-term-forward-questions-v1")
    throw new Error("Outcome question set mismatch");
  if (prediction.horizon !== "next_session_close") throw new Error("Outcome horizon mismatch");
  if (prediction.marketDataPolicyVersion !== "short-term-forward-market-data-policy-v1")
    throw new Error("Outcome market-data policy mismatch");
  if (observation.ticker !== prediction.ticker) throw new Error("Outcome ticker mismatch");
  if (observation.stateFingerprint !== prediction.stateFingerprint)
    throw new Error("Outcome state fingerprint mismatch");
  fingerprint(prediction.stateFingerprint, "prediction state");
  fingerprint(prediction.sourceFingerprint, "prediction source");
  fingerprint(prediction.outputFingerprint, "prediction output");
  fingerprint(observation.sourceFingerprint, "outcome source");
  if (observation.sourceFingerprint === prediction.sourceFingerprint)
    throw new Error("Outcome source must be independent from prediction source");
  if (observation.provider !== "alpaca") throw new Error("Outcome provider mismatch");
  if (observation.feed !== "sip") throw new Error("Outcome feed mismatch");
  if (observation.delayMinutes !== FORWARD_OUTCOME_DELAY_MINUTES)
    throw new Error("Outcome delay mismatch");
  if (observation.freshness !== "delayed") throw new Error("Outcome freshness mismatch");
  if (observation.availability !== "available" || observation.completeness !== "complete")
    throw new Error("Outcome availability or completeness mismatch");
  if (!observation.regularSession || observation.halted)
    throw new Error("Outcome regular-session status invalid");
  if (observation.priceReferenceType !== "daily_bar_close_split_adjusted")
    throw new Error("Outcome price convention mismatch");
  if (observation.sourceVersion !== FORWARD_OUTCOME_SOURCE_VERSION)
    throw new Error("Outcome source version mismatch");
  const session = input.calendar.sessionFor(prediction.targetSessionDate);
  if (!session || !session.regular || session.earlyClose)
    throw new Error("Target session is not a regular full session");
  if (observation.sessionDate !== prediction.targetSessionDate)
    throw new Error("Outcome session mismatch");
  if (observation.observedAt !== session.closeAt || observedAtMs < targetCloseMs)
    throw new Error("Outcome timestamp does not match target close");
  if (collectedAtMs < targetCloseMs + FORWARD_OUTCOME_DELAY_MINUTES * 60_000)
    throw new Error("Outcome collected before delayed-SIP eligibility");
  if (!Number.isFinite(prediction.referencePrice) || prediction.referencePrice <= 0)
    throw new Error("Prediction reference price invalid");
  if (!Number.isFinite(observation.observedPrice) || observation.observedPrice <= 0)
    throw new Error("Outcome observed price invalid");
  const returnPct = rounded(
    ((observation.observedPrice - prediction.referencePrice) / prediction.referencePrice) * 100,
  );
  return Object.freeze({
    schemaVersion: FORWARD_OUTCOME_SCHEMA_VERSION,
    predictionId: prediction.predictionId,
    originalDecisionRunId: prediction.originalDecisionRunId,
    ticker: prediction.ticker,
    taskId: prediction.taskId,
    taskVersion: prediction.taskVersion,
    questionSetVersion: prediction.questionSetVersion,
    horizon: prediction.horizon,
    marketDataPolicyVersion: prediction.marketDataPolicyVersion,
    targetSessionDate: prediction.targetSessionDate,
    targetCloseAt: prediction.targetCloseAt,
    decisionRequestedAt: prediction.requestedAt,
    decisionEffectiveAsOf: prediction.effectiveAsOf,
    stateFingerprint: prediction.stateFingerprint,
    predictionOutputFingerprint: prediction.outputFingerprint,
    referencePrice: prediction.referencePrice,
    observedPrice: observation.observedPrice,
    observedAt: observation.observedAt,
    sessionDate: observation.sessionDate,
    provider: "alpaca",
    feed: "sip",
    delayMinutes: FORWARD_OUTCOME_DELAY_MINUTES,
    freshness: "delayed",
    availability: "available",
    completeness: "complete",
    priceReferenceType: "daily_bar_close_split_adjusted",
    sourceVersion: FORWARD_OUTCOME_SOURCE_VERSION,
    sourceFingerprint: observation.sourceFingerprint,
    returnPct,
    label: label(returnPct),
    collectedAt: input.collectedAt,
  });
}

export function toForwardObservedOutcome(record: ForwardOutcomeRecord): ForwardObservedOutcome {
  return {
    originalDecisionRunId: record.originalDecisionRunId,
    ticker: record.ticker,
    stateFingerprint: record.stateFingerprint,
    targetSessionDate: record.targetSessionDate,
    observedAt: record.observedAt,
    sourceFingerprint: record.sourceFingerprint,
    returnPct: record.returnPct,
    label: record.label,
  };
}
