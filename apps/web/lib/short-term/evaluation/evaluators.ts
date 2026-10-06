import "server-only";
import { buildJevQuestions } from "../jev/questions";
import { validateJevProviderResponse } from "../jev/validate";
import type { JevProviderResponse } from "../jev/types";
import type { ShortTermShadowRecord } from "../shadow/types";
import { auditHistoricalScoreRecord, type HistoricalScoreAudit } from "./historical-score-audit";
import { auditScoreAnswer } from "./score-contract";
import {
  SHORT_TERM_EVALUATION_INPUT_VERSION,
  SHORT_TERM_EVALUATION_OUTCOME_VERSION,
  type EvaluationHorizon,
  type FrozenEvaluationInput,
  type OutcomeLabel,
  type ProspectiveOutcome,
} from "./types";

export interface ShadowEvaluationSummary {
  responseValid: boolean;
  validationIssues: string[];
  scoreConsistencyStatus: "verified_consistent" | "weighted_consistency_unverified" | "invalid";
  historicalScoreAudit?: HistoricalScoreAudit;
  provenanceComplete: boolean;
  latencyMs: number;
  estimatedCostUsd: number;
  missingData: string[];
  stale: boolean;
}

export interface ProspectiveOutcomeInput {
  decision: FrozenEvaluationInput;
  observedAt: string;
  sessionDate: string;
  horizon: EvaluationHorizon;
  benchmark: string;
  label: OutcomeLabel;
}

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

export function freezeDecisionInput(record: ShortTermShadowRecord): FrozenEvaluationInput {
  const state = record.sanitizedState;
  return {
    schemaVersion: SHORT_TERM_EVALUATION_INPUT_VERSION,
    runId: record.runId,
    ticker: record.ticker,
    decisionAt: record.requestedAt,
    effectiveAsOf: state.effectiveAsOf,
    marketSessionAsOf: state.marketSessionAsOf,
    marketSessionStatus: state.marketSessionStatus,
    feed: state.feed,
    delayMinutes: state.delayMinutes,
    freshness: state.freshness,
    stateFingerprint: record.stateFingerprint,
    sourceFingerprint: state.provenance.sourceFingerprint,
    availability: { ...state.availability },
    questionSetVersion: record.questionSetVersion,
    pinnedModel: record.pinnedModel,
  };
}

export function createProspectiveOutcome(input: ProspectiveOutcomeInput): ProspectiveOutcome {
  const decisionMs = Date.parse(input.decision.decisionAt);
  const effectiveMs = input.decision.effectiveAsOf
    ? Date.parse(input.decision.effectiveAsOf)
    : decisionMs;
  const observedMs = Date.parse(input.observedAt);
  if (![decisionMs, effectiveMs, observedMs].every(Number.isFinite))
    throw new Error("Outcome timestamps are invalid.");
  if (observedMs <= decisionMs || observedMs < effectiveMs)
    throw new Error("Outcome violates look-ahead protection.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.sessionDate))
    throw new Error("Outcome sessionDate must be an ISO calendar date.");
  if (!Number.isFinite(Date.parse(`${input.sessionDate}T00:00:00.000Z`)))
    throw new Error("Outcome sessionDate must be an ISO calendar date.");
  if (!["one_hour", "session_close", "next_session_close"].includes(input.horizon))
    throw new Error("Outcome horizon is invalid.");
  if (!input.benchmark || !input.benchmark.trim())
    throw new Error("Outcome benchmark is required.");
  if (!["up", "flat", "down", "not_observable"].includes(input.label))
    throw new Error("Outcome label is invalid.");
  return {
    schemaVersion: SHORT_TERM_EVALUATION_OUTCOME_VERSION,
    observedAt: input.observedAt,
    sessionDate: input.sessionDate,
    horizon: input.horizon,
    benchmark: input.benchmark,
    label: input.label,
  };
}

export function evaluateShadowRecord(record: ShortTermShadowRecord): ShadowEvaluationSummary {
  const responseIssues: string[] = [];
  const providerResponse: JevProviderResponse = {
    model: record.pinnedModel,
    answers: record.answers,
    usage: { input_tokens: record.usage.inputTokens, output_tokens: record.usage.outputTokens },
  };
  try {
    validateJevProviderResponse(providerResponse, buildJevQuestions());
  } catch (error) {
    responseIssues.push(error instanceof Error ? error.message : "response_invalid");
  }
  const scoreAnswer = record.answers.downside_concern;
  const scoreQuestion = buildJevQuestions().downside_concern;
  let scoreConsistencyStatus: ShadowEvaluationSummary["scoreConsistencyStatus"] = "invalid";
  let historicalScoreAudit: HistoricalScoreAudit | undefined;
  if (scoreAnswer?.type === "score" && scoreQuestion.type === "score") {
    const scoreAudit = auditScoreAnswer(scoreAnswer, scoreQuestion);
    historicalScoreAudit = auditHistoricalScoreRecord({
      ticker: record.ticker,
      runId: record.runId,
      stateFingerprint: record.stateFingerprint,
      score: scoreAnswer.score,
      probabilities: scoreAnswer.probabilities,
    });
    if (historicalScoreAudit.status === "weighted_consistency_unverified") {
      scoreConsistencyStatus = historicalScoreAudit.status;
    } else if (scoreAudit.valid) {
      scoreConsistencyStatus = "verified_consistent";
    } else {
      scoreConsistencyStatus = "invalid";
      responseIssues.push(...scoreAudit.issues);
    }
  }
  const state = record.sanitizedState;
  const missingData = Object.entries(state.availability)
    .filter(([, available]) => !available)
    .map(([field]) => field);
  const provenanceComplete =
    record.stateFingerprint.length > 0 &&
    state.provenance.source.length > 0 &&
    state.provenance.sourceFingerprint.length > 0 &&
    record.provenance.sourceFingerprint === state.provenance.sourceFingerprint &&
    record.marketInputStatus === "verified_market_input";
  const validationIssues = [...responseIssues];
  if (!provenanceComplete) validationIssues.push("provenance_incomplete");
  if (!isFiniteNonNegative(record.latencyMs)) validationIssues.push("latency_invalid");
  if (!isFiniteNonNegative(record.usage.estimatedCostUsd)) validationIssues.push("cost_invalid");
  return {
    responseValid: responseIssues.length === 0,
    validationIssues,
    scoreConsistencyStatus,
    ...(historicalScoreAudit ? { historicalScoreAudit } : {}),
    provenanceComplete,
    latencyMs: record.latencyMs,
    estimatedCostUsd: record.usage.estimatedCostUsd,
    missingData,
    stale: state.freshness === "stale" || state.facts.some((fact) => fact.freshness === "stale"),
  };
}

export function compareEquivalentOutputs(
  left: ShortTermShadowRecord,
  right: ShortTermShadowRecord,
): { sameState: boolean; sameAnswers: boolean } {
  return {
    sameState: left.stateFingerprint === right.stateFingerprint,
    sameAnswers: stableJson(left.answers) === stableJson(right.answers),
  };
}
