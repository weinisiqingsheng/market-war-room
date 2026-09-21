import type { ShortTermJevAssessment, ShortTermJevAssessmentRequest } from "../jev/types";
import type { ShortTermMarketState } from "../market-data/types";

export const SHORT_TERM_SHADOW_RECORD_VERSION = "short-term-shadow-record-v1" as const;

export interface ShortTermShadowRecord {
  version: typeof SHORT_TERM_SHADOW_RECORD_VERSION;
  runId: string;
  requestedAt: string;
  ticker: string;
  strategyId: ShortTermJevAssessmentRequest["strategyId"];
  horizonHours: number;
  maxLossPct: number;
  stateFingerprint: string;
  inputContractVersion: string;
  questionSetVersion: string;
  pinnedModel: string;
  sanitizedState: ShortTermMarketState;
  answers: ShortTermJevAssessment["answers"];
  usage: ShortTermJevAssessment["usage"];
  latencyMs: number;
  resultStatus: ShortTermJevAssessment["status"];
  provenance: ShortTermJevAssessment["provenance"];
  cacheHit: boolean;
}
