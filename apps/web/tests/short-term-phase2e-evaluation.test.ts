import { describe, expect, it } from "vitest";
import {
  alwaysFlatBaseline,
  frozenMomentumBaseline,
  historicalMajorityBaseline,
} from "@/lib/short-term/forward/baselines";
import { evaluateForwardBatch } from "@/lib/short-term/forward/evaluate";
import type {
  ForwardDirectionPredictionRecord,
  ForwardObservedOutcome,
} from "@/lib/short-term/forward/types";

function prediction(
  id: string,
  ticker: string,
  predictedClass: "UP" | "FLAT" | "DOWN",
  referencePrice: number,
  previousClose: number,
): ForwardDirectionPredictionRecord {
  return {
    schemaVersion: "short-term-forward-prediction-v1",
    predictionId: id,
    taskId: "next_session_direction_v1",
    taskVersion: "short-term-forward-direction-v1",
    horizon: "next_session_close",
    ticker,
    originalDecisionRunId: id,
    stateFingerprint: `${id}-state`.padEnd(64, "a"),
    sourceFingerprint: `${id}-source`.padEnd(64, "b"),
    requestedAt: "2026-09-21T23:29:38.161Z",
    effectiveAsOf: "2026-09-21T20:00:00.000Z",
    marketSessionDate: "2026-09-21",
    targetSessionDate: "2026-09-22",
    targetCloseAt: "2026-09-22T20:00:00.000Z",
    marketDataPolicyVersion: "short-term-forward-market-data-policy-v1",
    referencePrice,
    previousClose,
    feed: "delayed_sip",
    delayMinutes: 15,
    freshness: "delayed",
    marketInputStatus: "fixture_market_input",
    model: "jev-1.13.0",
    questionSetVersion: "short-term-forward-questions-v1",
    predictedClass,
    classDistribution: { UP: 0.6, FLAT: 0.3, DOWN: 0.1 },
    confidence: 0.7,
    evidenceSufficiency: 0.8,
    manualReview: false,
    modelOutputStatus: "fixture_model_output",
    baselines: {
      alwaysFlat: "FLAT",
      frozenMomentum: "UP",
      historicalMajority: null,
      historicalMajorityStatus: "not_available",
    },
    outputFingerprint: "c".repeat(64),
    latencyMs: 0,
    estimatedCostUsd: 0,
    usage: { inputTokens: 1, outputTokens: 1 },
    createdAt: "2026-09-21T23:29:39.000Z",
  };
}

function outcome(
  predictionRecord: ForwardDirectionPredictionRecord,
  label: "UP" | "FLAT" | "DOWN",
): ForwardObservedOutcome {
  return {
    originalDecisionRunId: predictionRecord.originalDecisionRunId,
    ticker: predictionRecord.ticker,
    stateFingerprint: predictionRecord.stateFingerprint,
    targetSessionDate: predictionRecord.targetSessionDate,
    observedAt: "2026-09-22T20:00:00.000Z",
    sourceFingerprint: `${predictionRecord.ticker}-outcome`.padEnd(64, "c"),
    returnPct: label === "UP" ? 1 : label === "DOWN" ? -1 : 0,
    label,
  };
}

describe("Phase 2E forward evaluation", () => {
  it("computes multiclass metrics and compares predeclared baselines", () => {
    const predictions = [
      prediction("p1", "NVDA", "UP", 101, 100),
      prediction("p2", "TSLA", "FLAT", 100, 100),
      prediction("p3", "AAPL", "DOWN", 99, 100),
    ];
    const outcomes = [
      outcome(predictions[0], "UP"),
      outcome(predictions[1], "DOWN"),
      outcome(predictions[2], "FLAT"),
    ];
    const result = evaluateForwardBatch(predictions, outcomes, {
      historicalCounts: { UP: 2, FLAT: 1, DOWN: 0 },
    });

    expect(result).toMatchObject({
      sampleSize: 3,
      accuracy: 1 / 3,
      forwardMetricStatus: "applicable",
    });
    expect(result.confusionMatrix.UP).toEqual({ UP: 1, FLAT: 0, DOWN: 0 });
    expect(result.confusionMatrix.FLAT).toEqual({ UP: 0, FLAT: 0, DOWN: 1 });
    expect(result.confusionMatrix.DOWN).toEqual({ UP: 0, FLAT: 1, DOWN: 0 });
    expect(result.baselines.alwaysFlat.accuracy).toBeCloseTo(1 / 3);
    expect(result.baselines.historicalMajority.label).toBe("UP");
    expect(result.baselines.frozenMomentum.accuracy).toBeCloseTo(1 / 3);
    expect(result.pairedAgainstAlwaysFlat).toMatchObject({ wins: 0, losses: 0, ties: 3 });
  });

  it("defines deterministic baseline behavior and rejects mismatched outcomes", () => {
    expect(alwaysFlatBaseline()).toBe("FLAT");
    expect(historicalMajorityBaseline({ UP: 2, FLAT: 2, DOWN: 0 })).toBe("FLAT");
    expect(frozenMomentumBaseline(100.2, 100)).toBe("UP");
    expect(frozenMomentumBaseline(99.8, 100)).toBe("DOWN");
    expect(frozenMomentumBaseline(100.05, 100)).toBe("FLAT");

    const p = prediction("p1", "NVDA", "UP", 100, 100);
    expect(() =>
      evaluateForwardBatch([p], [outcome({ ...p, ticker: "TSLA" }, "UP")], {
        historicalCounts: { UP: 1 },
      }),
    ).toThrow(/identity/i);
  });

  it("does not expose calibration metrics for judgment weights", () => {
    const p = prediction("p1", "NVDA", "UP", 100, 100);
    const result = evaluateForwardBatch([p], [outcome(p, "UP")], { historicalCounts: { UP: 1 } });
    expect(result).not.toHaveProperty("brierScore");
    expect(result).not.toHaveProperty("logLoss");
  });
});
