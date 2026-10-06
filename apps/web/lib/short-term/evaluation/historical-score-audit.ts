export const TSLA_HISTORICAL_RUN_ID = "short-term-1981f035e3c261a384354a87" as const;
export const TSLA_HISTORICAL_STATE_FINGERPRINT =
  "1981f035e3c261a384354a87fdd3f3a5ac887951cb56bd979cebdcf39e73e007" as const;

export type HistoricalScoreAuditStatus = "weighted_consistency_unverified" | "not_applicable";

export interface HistoricalScoreAudit {
  status: HistoricalScoreAuditStatus;
  ticker: string;
  runId: string;
  stateFingerprint: string;
  score?: number;
  weightedScore?: number;
  reason?: string;
}

export function auditHistoricalScoreRecord(input: {
  ticker: string;
  runId: string;
  stateFingerprint: string;
  score: number;
  probabilities: Record<string, number>;
}): HistoricalScoreAudit {
  const weightedScore =
    input.probabilities["1"] + 2 * input.probabilities["2"] + 0 * input.probabilities["0"];
  const exactTslaRecord =
    input.ticker === "TSLA" &&
    input.runId === TSLA_HISTORICAL_RUN_ID &&
    input.stateFingerprint === TSLA_HISTORICAL_STATE_FINGERPRINT &&
    input.score === 0.93 &&
    input.probabilities["0"] === 0.18 &&
    input.probabilities["1"] === 0.7 &&
    input.probabilities["2"] === 0.12;
  if (exactTslaRecord) {
    return {
      status: "weighted_consistency_unverified",
      ticker: input.ticker,
      runId: input.runId,
      stateFingerprint: input.stateFingerprint,
      score: input.score,
      weightedScore,
      reason:
        "Stored TSLA Score 0.93 differs from the 0.94 weighted result computed from stored probabilities; no higher-precision provider data or documented rounding rule is available.",
    };
  }
  return {
    status: "not_applicable",
    ticker: input.ticker,
    runId: input.runId,
    stateFingerprint: input.stateFingerprint,
  };
}
