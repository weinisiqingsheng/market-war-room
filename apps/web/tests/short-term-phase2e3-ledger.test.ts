// @vitest-environment node
import { describe, expect, it } from "vitest";
import { summarizeForwardExperiment } from "@/lib/short-term/forward/ledger";
import type {
  ForwardDirectionPredictionRecord,
  ForwardObservedOutcome,
} from "@/lib/short-term/forward/types";

function prediction(
  id: string,
  ticker: string,
  predictedClass: "UP" | "FLAT" | "DOWN",
  model = "jev-1.13.0",
  previousClose = 99,
): ForwardDirectionPredictionRecord {
  return {
    schemaVersion: "short-term-forward-prediction-v1",
    predictionId: id,
    taskId: "next_session_direction_v1",
    taskVersion: "short-term-forward-direction-v1",
    horizon: "next_session_close",
    ticker,
    originalDecisionRunId: `${id}-run`,
    stateFingerprint: `${id}-state`.padEnd(64, "a"),
    sourceFingerprint: `${id}-source`.padEnd(64, "b"),
    requestedAt: "2026-09-27T23:00:00.000Z",
    effectiveAsOf: "2026-09-27T20:00:00.000Z",
    marketSessionDate: "2026-09-25",
    targetSessionDate: "2026-09-28",
    targetCloseAt: "2026-09-28T20:00:00.000Z",
    marketDataPolicyVersion: "short-term-forward-market-data-policy-v1",
    referencePrice: 100,
    previousClose,
    feed: "delayed_sip",
    delayMinutes: 15,
    freshness: "delayed",
    marketInputStatus: "fixture_market_input",
    model,
    questionSetVersion: "short-term-forward-questions-v1",
    predictedClass,
    classDistribution: { UP: 0.6, FLAT: 0.3, DOWN: 0.1 },
    confidence: 0.7,
    evidenceSufficiency: 0.8,
    manualReview: false,
    modelOutputStatus: "fixture_model_output",
    baselines: {
      alwaysFlat: "FLAT",
      frozenMomentum: previousClose < 100 ? "UP" : "DOWN",
      historicalMajority: null,
      historicalMajorityStatus: "not_available",
    },
    outputFingerprint: `${id}-output`.padEnd(64, "c"),
    latencyMs: 0,
    estimatedCostUsd: 0,
    usage: { inputTokens: 1, outputTokens: 1 },
    createdAt: "2026-09-27T23:01:00.000Z",
  };
}

function outcome(
  record: ForwardDirectionPredictionRecord,
  label: "UP" | "FLAT" | "DOWN",
): ForwardObservedOutcome {
  return {
    originalDecisionRunId: record.originalDecisionRunId,
    ticker: record.ticker,
    stateFingerprint: record.stateFingerprint,
    targetSessionDate: record.targetSessionDate,
    observedAt: record.targetCloseAt,
    sourceFingerprint: `${record.ticker}-outcome`.padEnd(64, "d"),
    returnPct: label === "UP" ? 1 : label === "DOWN" ? -1 : 0,
    label,
  };
}

describe("Phase 2E.3 cumulative experiment ledger", () => {
  it("summarizes completed observations without mutating source records", () => {
    const predictions = [
      prediction("p1", "NVDA", "FLAT"),
      prediction("p2", "TSLA", "DOWN", "jev-1.13.0", 101),
      prediction("p3", "AAPL", "FLAT"),
    ];
    const outcomes = [
      outcome(predictions[0], "UP"),
      outcome(predictions[1], "DOWN"),
      outcome(predictions[2], "DOWN"),
    ];
    const result = summarizeForwardExperiment({
      predictions,
      outcomes,
      attempts: predictions.map((item) => ({
        attemptId: `${item.ticker}-attempt`,
        ticker: item.ticker,
        taskId: item.taskId,
        taskVersion: item.taskVersion,
        questionSetVersion: item.questionSetVersion,
        marketDataPolicyVersion: item.marketDataPolicyVersion,
        model: item.model,
        status: "completed" as const,
        predictionId: item.predictionId,
      })),
    });

    expect(result.schemaVersion).toBe("short-term-forward-ledger-v1");
    expect(result.observationCount).toBe(3);
    expect(result.completedCount).toBe(3);
    expect(result.accuracy).toBe(1 / 3);
    expect(result.baselines).not.toBeNull();
    expect(result.pairedJevVsBaseline).not.toBeNull();
    if (!result.baselines || !result.pairedJevVsBaseline) throw new Error("expected metrics");
    expect(result.baselines.alwaysFlat.accuracy).toBe(0);
    expect(result.baselines.frozenMomentum.accuracy).toBe(2 / 3);
    expect(result.baselines.historicalMajority.status).toBe("NOT_AVAILABLE");
    expect(result.pairedJevVsBaseline.alwaysFlat).toEqual({ wins: 1, losses: 0, ties: 2 });
    expect(result.macroF1).toBe("NOT_ENOUGH_DATA");
    expect(result.sourceRecordsMutated).toBe(false);
  });

  it("exposes pending and failure categories instead of silently dropping attempts", () => {
    const completed = prediction("p1", "NVDA", "UP");
    const pending = prediction("p2", "TSLA", "FLAT");
    const result = summarizeForwardExperiment({
      predictions: [completed, pending],
      outcomes: [outcome(completed, "UP")],
      attempts: [
        {
          attemptId: "nvda-attempt",
          ticker: "NVDA",
          taskId: completed.taskId,
          taskVersion: completed.taskVersion,
          questionSetVersion: completed.questionSetVersion,
          marketDataPolicyVersion: completed.marketDataPolicyVersion,
          model: completed.model,
          status: "completed",
          predictionId: completed.predictionId,
        },
        {
          attemptId: "tsla-attempt",
          ticker: "TSLA",
          taskId: pending.taskId,
          taskVersion: pending.taskVersion,
          questionSetVersion: pending.questionSetVersion,
          marketDataPolicyVersion: pending.marketDataPolicyVersion,
          model: pending.model,
          status: "outcome_unavailable",
          predictionId: pending.predictionId,
        },
        {
          attemptId: "aapl-attempt",
          ticker: "AAPL",
          taskId: pending.taskId,
          taskVersion: pending.taskVersion,
          questionSetVersion: pending.questionSetVersion,
          marketDataPolicyVersion: pending.marketDataPolicyVersion,
          model: pending.model,
          status: "validation_failure",
        },
      ],
    });

    expect(result.completedCount).toBe(1);
    expect(result.pendingCount).toBe(1);
    expect(result.invalidCount).toBe(1);
    expect(result.failureCounts).toMatchObject({
      validationFailure: 1,
      outcomeUnavailable: 1,
      marketInputUnavailable: 0,
      providerFailure: 0,
    });
    expect(result.untrackedAttemptCount).toBe(0);
  });

  it("keeps model and contract versions in separate breakdowns", () => {
    const first = prediction("p1", "NVDA", "UP", "jev-1.13.0");
    const second = prediction("p2", "TSLA", "DOWN", "fixture-jev-direction");
    const attempts = [first, second].map((item) => ({
      attemptId: `${item.ticker}-attempt`,
      ticker: item.ticker,
      taskId: item.taskId,
      taskVersion: item.taskVersion,
      questionSetVersion: item.questionSetVersion,
      marketDataPolicyVersion: item.marketDataPolicyVersion,
      model: item.model,
      status: "completed" as const,
      predictionId: item.predictionId,
    }));
    const result = summarizeForwardExperiment({
      predictions: [first, second],
      outcomes: [outcome(first, "UP"), outcome(second, "DOWN")],
      attempts,
    });
    expect(result.breakdowns).toHaveLength(2);
    expect(result.breakdowns.map((item) => item.version.model).sort()).toEqual([
      "fixture-jev-direction",
      "jev-1.13.0",
    ]);
  });
});
