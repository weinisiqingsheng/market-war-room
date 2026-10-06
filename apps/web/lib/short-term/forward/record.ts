import { createHash } from "node:crypto";
import { FORWARD_HORIZON, FORWARD_TASK_ID, FORWARD_TASK_VERSION } from "./contract";
import { FORWARD_QUESTION_SET_VERSION } from "./questions";
import { frozenMomentumBaseline } from "./baselines";
import { FORWARD_MARKET_DATA_POLICY_VERSION } from "./market-policy";
import type {
  ForwardDecisionContext,
  ForwardDirectionPredictionRecord,
  ModelOutputStatus,
  ValidatedForwardAssessment,
} from "./types";

function iso(value: string, name: string): number {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error(`Invalid ${name} timestamp`);
  return time;
}
function hash(value: string, name: string): void {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error(`Invalid ${name} fingerprint`);
}

export function buildForwardPredictionRecord(input: {
  decision: ForwardDecisionContext;
  assessment: ValidatedForwardAssessment;
  createdAt: string;
  modelOutputStatus: ModelOutputStatus;
}): ForwardDirectionPredictionRecord {
  const { decision, assessment } = input;
  const requestedAt = iso(decision.requestedAt, "requestedAt");
  const effectiveAsOf = iso(decision.effectiveAsOf, "effectiveAsOf");
  const targetCloseAt = iso(decision.targetCloseAt, "targetCloseAt");
  const createdAt = iso(input.createdAt, "createdAt");
  if (decision.freshness === "stale" || decision.freshness === "unavailable")
    throw new Error("Cannot freeze stale or unavailable market input");
  if (requestedAt >= targetCloseAt || effectiveAsOf >= targetCloseAt || createdAt >= targetCloseAt)
    throw new Error("Decision timestamps must precede target close");
  if (decision.targetSessionDate <= decision.marketSessionDate)
    throw new Error("Target session must follow decision session");
  hash(decision.stateFingerprint, "state");
  hash(decision.sourceFingerprint, "source");
  if (
    ![decision.referencePrice, decision.previousClose].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    throw new Error("Prices must be positive and finite");
  if (
    assessment.targetSessionDate !== decision.targetSessionDate ||
    assessment.targetCloseAt !== decision.targetCloseAt
  )
    throw new Error("Assessment target does not match decision");
  if (assessment.questionSetVersion !== FORWARD_QUESTION_SET_VERSION)
    throw new Error("Unexpected question set");
  const predictionId = `forward-${createHash("sha256").update(`${decision.originalDecisionRunId}:${FORWARD_TASK_VERSION}`).digest("hex").slice(0, 24)}`;
  const outputFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        model: assessment.model,
        questionSetVersion: assessment.questionSetVersion,
        predictedClass: assessment.predictedClass,
        classDistribution: assessment.classDistribution,
        confidence: assessment.confidence,
        evidenceSufficiency: assessment.evidenceSufficiency,
        manualReview: assessment.manualReview,
        usage: assessment.usage,
      }),
    )
    .digest("hex");
  const record: ForwardDirectionPredictionRecord = {
    schemaVersion: "short-term-forward-prediction-v1",
    predictionId,
    taskId: FORWARD_TASK_ID,
    taskVersion: FORWARD_TASK_VERSION,
    horizon: FORWARD_HORIZON,
    ticker: decision.ticker,
    originalDecisionRunId: decision.originalDecisionRunId,
    stateFingerprint: decision.stateFingerprint,
    sourceFingerprint: decision.sourceFingerprint,
    requestedAt: decision.requestedAt,
    effectiveAsOf: decision.effectiveAsOf,
    marketSessionDate: decision.marketSessionDate,
    targetSessionDate: decision.targetSessionDate,
    targetCloseAt: decision.targetCloseAt,
    marketDataPolicyVersion: FORWARD_MARKET_DATA_POLICY_VERSION,
    referencePrice: decision.referencePrice,
    previousClose: decision.previousClose,
    feed: decision.feed,
    delayMinutes: decision.delayMinutes,
    freshness: decision.freshness,
    marketInputStatus: decision.marketInputStatus,
    model: assessment.model,
    questionSetVersion: assessment.questionSetVersion,
    predictedClass: assessment.predictedClass,
    classDistribution: Object.freeze({ ...assessment.classDistribution }),
    confidence: assessment.confidence,
    evidenceSufficiency: assessment.evidenceSufficiency,
    manualReview: assessment.manualReview,
    modelOutputStatus: input.modelOutputStatus,
    baselines: Object.freeze({
      alwaysFlat: "FLAT",
      frozenMomentum: frozenMomentumBaseline(decision.referencePrice, decision.previousClose),
      historicalMajority: null,
      historicalMajorityStatus: "not_available",
    }),
    outputFingerprint,
    latencyMs: assessment.latencyMs,
    estimatedCostUsd: assessment.estimatedCostUsd,
    usage: Object.freeze({ ...assessment.usage }),
    createdAt: input.createdAt,
  };
  return Object.freeze(record);
}
