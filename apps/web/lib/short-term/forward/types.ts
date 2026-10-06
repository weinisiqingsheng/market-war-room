import type { ForwardDirection } from "./contract";

export type MarketInputStatus = "verified_market_input" | "fixture_market_input";
export type ModelOutputStatus = "fixture_model_output" | "real_jev_model_output";

export interface ForwardDecisionContext {
  originalDecisionRunId: string;
  ticker: string;
  stateFingerprint: string;
  sourceFingerprint: string;
  requestedAt: string;
  effectiveAsOf: string;
  marketSessionDate: string;
  marketSessionStatus: "open" | "closed" | "early_close" | "incomplete";
  targetSessionDate: string;
  targetCloseAt: string;
  marketDataPolicyVersion: "short-term-forward-market-data-policy-v1";
  referencePrice: number;
  previousClose: number;
  feed: string;
  delayMinutes: number;
  freshness: "real_time" | "delayed" | "stale" | "unavailable";
  marketInputStatus: MarketInputStatus;
}

export interface ForwardQuestion {
  id: "next_session_direction";
  taskId: "next_session_direction_v1";
  taskVersion: "short-term-forward-direction-v1";
  horizon: "next_session_close";
  targetSessionDate: string;
  targetCloseAt: string;
  classes: readonly ForwardDirection[];
  prompt: string;
}

export interface ForwardJevProviderResponse {
  taskId: string;
  taskVersion: string;
  horizon: string;
  targetSessionDate: string;
  targetCloseAt: string;
  model: string;
  questionSetVersion: string;
  answer: {
    predictedClass: string;
    classDistribution: Record<string, number>;
    confidence: number;
    evidenceSufficiency: number;
    manualReview: boolean;
  };
  usage: { inputTokens: number; outputTokens: number };
  [key: string]: unknown;
}

export interface ValidatedForwardAssessment {
  taskId: "next_session_direction_v1";
  taskVersion: "short-term-forward-direction-v1";
  horizon: "next_session_close";
  targetSessionDate: string;
  targetCloseAt: string;
  model: string;
  questionSetVersion: string;
  predictedClass: ForwardDirection;
  classDistribution: Record<ForwardDirection, number>;
  confidence: number;
  evidenceSufficiency: number;
  manualReview: boolean;
  usage: { inputTokens: number; outputTokens: number };
  latencyMs: number;
  estimatedCostUsd: number;
}

export interface ForwardDirectionPredictionRecord {
  schemaVersion: "short-term-forward-prediction-v1";
  predictionId: string;
  taskId: "next_session_direction_v1";
  taskVersion: "short-term-forward-direction-v1";
  horizon: "next_session_close";
  ticker: string;
  originalDecisionRunId: string;
  stateFingerprint: string;
  sourceFingerprint: string;
  requestedAt: string;
  effectiveAsOf: string;
  marketSessionDate: string;
  targetSessionDate: string;
  targetCloseAt: string;
  marketDataPolicyVersion: "short-term-forward-market-data-policy-v1";
  referencePrice: number;
  previousClose: number;
  feed: string;
  delayMinutes: number;
  freshness: ForwardDecisionContext["freshness"];
  marketInputStatus: MarketInputStatus;
  model: string;
  questionSetVersion: string;
  predictedClass: ForwardDirection;
  classDistribution: Readonly<Record<ForwardDirection, number>>;
  confidence: number;
  evidenceSufficiency: number;
  manualReview: boolean;
  modelOutputStatus: ModelOutputStatus;
  baselines: Readonly<{
    alwaysFlat: "FLAT";
    frozenMomentum: ForwardDirection;
    historicalMajority: ForwardDirection | null;
    historicalMajorityStatus: "available" | "not_available";
  }>;
  outputFingerprint: string;
  latencyMs: number;
  estimatedCostUsd: number;
  usage: Readonly<{ inputTokens: number; outputTokens: number }>;
  createdAt: string;
}

export interface ForwardObservedOutcome {
  originalDecisionRunId: string;
  ticker: string;
  stateFingerprint: string;
  targetSessionDate: string;
  observedAt: string;
  sourceFingerprint: string;
  returnPct: number;
  label: ForwardDirection;
}

export interface ForwardEvaluationResult {
  forwardMetricStatus: "applicable" | "not_applicable";
  sampleSize: number;
  accuracy: number;
  confusionMatrix: Record<ForwardDirection, Record<ForwardDirection, number>>;
  perClass: Record<ForwardDirection, { precision: number; recall: number; f1: number }>;
  macroF1: number;
  baselines: {
    alwaysFlat: { label: "FLAT"; accuracy: number; delta: number };
    historicalMajority: { label: ForwardDirection; accuracy: number; delta: number };
    frozenMomentum: { accuracy: number; delta: number };
  };
  pairedAgainstAlwaysFlat: { wins: number; losses: number; ties: number };
}
