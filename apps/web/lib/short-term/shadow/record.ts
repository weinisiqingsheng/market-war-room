import type { ShortTermJevAssessment, ShortTermJevAssessmentRequest } from "../jev/types";
import type { ShortTermMarketState } from "../market-data/types";
import {
  SHORT_TERM_SHADOW_RECORD_VERSION,
  type ShortTermMarketInputStatus,
  type ShortTermModelOutputStatus,
  type ShortTermShadowRecord,
} from "./types";

export function buildShadowRecord(input: {
  assessment: ShortTermJevAssessment;
  request: ShortTermJevAssessmentRequest;
  marketState: ShortTermMarketState;
  marketInputStatus: ShortTermMarketInputStatus;
  modelOutputStatus: ShortTermModelOutputStatus;
}): ShortTermShadowRecord {
  const { assessment, request, marketState } = input;
  return {
    version: SHORT_TERM_SHADOW_RECORD_VERSION,
    runId: assessment.runId,
    requestedAt: assessment.requestedAt,
    ticker: request.ticker,
    strategyId: request.strategyId,
    horizonHours: request.horizonHours,
    maxLossPct: request.maxLossPct,
    stateFingerprint: assessment.stateFingerprint,
    inputContractVersion: assessment.inputContractVersion,
    questionSetVersion: assessment.questionSetVersion,
    pinnedModel: assessment.model,
    sanitizedState: marketState,
    answers: assessment.answers,
    usage: assessment.usage,
    latencyMs: assessment.latencyMs,
    resultStatus: assessment.status,
    marketInputStatus: input.marketInputStatus,
    modelOutputStatus: input.modelOutputStatus,
    provenance: assessment.provenance,
    cacheHit: assessment.cache.hit,
  };
}
