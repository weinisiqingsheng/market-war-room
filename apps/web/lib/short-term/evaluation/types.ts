import type { ShortTermShadowRecord } from "../shadow/types";

export const SHORT_TERM_EVALUATION_INPUT_VERSION = "short-term-evaluation-input-v1" as const;
export const SHORT_TERM_EVALUATION_OUTCOME_VERSION = "short-term-evaluation-outcome-v1" as const;

export type EvaluationHorizon = "one_hour" | "session_close" | "next_session_close";
export type OutcomeLabel = "up" | "flat" | "down" | "not_observable";

export interface FrozenEvaluationInput {
  schemaVersion: typeof SHORT_TERM_EVALUATION_INPUT_VERSION;
  runId: string;
  ticker: string;
  decisionAt: string;
  effectiveAsOf: string | null;
  marketSessionAsOf: string | null;
  marketSessionStatus: "regular" | "closed" | "unknown";
  feed: string | null;
  delayMinutes: number | null;
  freshness: "fresh" | "delayed" | "stale" | "unavailable";
  stateFingerprint: string;
  sourceFingerprint: string;
  availability: ShortTermShadowRecord["sanitizedState"]["availability"];
  questionSetVersion: string;
  pinnedModel: string;
}

export interface ProspectiveOutcome {
  schemaVersion: typeof SHORT_TERM_EVALUATION_OUTCOME_VERSION;
  observedAt: string;
  sessionDate: string;
  horizon: EvaluationHorizon;
  benchmark: string;
  label: OutcomeLabel;
}
