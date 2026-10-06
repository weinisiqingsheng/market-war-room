// @vitest-environment node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NYSE_REGULAR_SESSION_CALENDAR } from "@/lib/short-term/prospective/calendar";
import {
  buildForwardOutcomeRecord,
  toForwardObservedOutcome,
} from "@/lib/short-term/forward/outcome";
import { createForwardOutcomeStore } from "@/lib/short-term/forward/outcome-store";
import type { ForwardOutcomeObservation } from "@/lib/short-term/forward/outcome";
import type { ForwardDirectionPredictionRecord } from "@/lib/short-term/forward/types";

function prediction(): ForwardDirectionPredictionRecord {
  return {
    schemaVersion: "short-term-forward-prediction-v1",
    predictionId: "forward-test-1",
    taskId: "next_session_direction_v1",
    taskVersion: "short-term-forward-direction-v1",
    horizon: "next_session_close",
    ticker: "NVDA",
    originalDecisionRunId: "decision-test-1",
    stateFingerprint: "a".repeat(64),
    sourceFingerprint: "b".repeat(64),
    requestedAt: "2026-09-28T04:00:00.000Z",
    effectiveAsOf: "2026-09-25T20:00:00.000Z",
    marketSessionDate: "2026-09-25",
    targetSessionDate: "2026-09-28",
    targetCloseAt: "2026-09-28T20:00:00.000Z",
    marketDataPolicyVersion: "short-term-forward-market-data-policy-v1",
    referencePrice: 100,
    previousClose: 99,
    feed: "delayed_sip",
    delayMinutes: 15,
    freshness: "delayed",
    marketInputStatus: "verified_market_input",
    model: "jev-1.13.0",
    questionSetVersion: "short-term-forward-questions-v1",
    predictedClass: "FLAT",
    classDistribution: { UP: 0.2, FLAT: 0.7, DOWN: 0.1 },
    confidence: 0.5,
    evidenceSufficiency: 0.5,
    manualReview: false,
    modelOutputStatus: "real_jev_model_output",
    baselines: {
      alwaysFlat: "FLAT",
      frozenMomentum: "UP",
      historicalMajority: null,
      historicalMajorityStatus: "not_available",
    },
    outputFingerprint: "c".repeat(64),
    latencyMs: 10,
    estimatedCostUsd: 0,
    usage: { inputTokens: 1, outputTokens: 1 },
    createdAt: "2026-09-28T04:00:01.000Z",
  };
}

function observation(
  overrides: Partial<ForwardOutcomeObservation> = {},
): ForwardOutcomeObservation {
  return {
    ticker: "NVDA",
    stateFingerprint: "a".repeat(64),
    sessionDate: "2026-09-28",
    observedAt: "2026-09-28T20:00:00.000Z",
    observedPrice: 100.2,
    provider: "alpaca",
    feed: "sip",
    delayMinutes: 15,
    freshness: "delayed",
    availability: "available",
    completeness: "complete",
    regularSession: true,
    halted: false,
    priceReferenceType: "daily_bar_close_split_adjusted",
    sourceVersion: "alpaca-v2-stocks-bars-1day-sip-split-v1",
    sourceFingerprint: "d".repeat(64),
    ...overrides,
  };
}

describe("Phase 2E.2 forward outcome records", () => {
  it("freezes an independently sourced outcome and derives the declared label", () => {
    const record = buildForwardOutcomeRecord({
      prediction: prediction(),
      observation: observation(),
      collectedAt: "2026-09-28T21:00:00.000Z",
      calendar: NYSE_REGULAR_SESSION_CALENDAR,
    });
    expect(record.returnPct).toBe(0.2);
    expect(record.label).toBe("UP");
    expect(record.predictionId).toBe("forward-test-1");
    expect(record.predictionOutputFingerprint).toBe("c".repeat(64));
    expect(toForwardObservedOutcome(record)).toMatchObject({
      originalDecisionRunId: "decision-test-1",
      label: "UP",
      returnPct: 0.2,
    });
  });

  it("fails closed on mismatched or non-independent observations", () => {
    expect(() =>
      buildForwardOutcomeRecord({
        prediction: prediction(),
        observation: observation({ stateFingerprint: "e".repeat(64) }),
        collectedAt: "2026-09-28T21:00:00.000Z",
        calendar: NYSE_REGULAR_SESSION_CALENDAR,
      }),
    ).toThrow(/fingerprint/i);
    expect(() =>
      buildForwardOutcomeRecord({
        prediction: prediction(),
        observation: observation({ feed: "iex" }),
        collectedAt: "2026-09-28T21:00:00.000Z",
        calendar: NYSE_REGULAR_SESSION_CALENDAR,
      }),
    ).toThrow(/feed/i);
  });

  it("stores separate outcomes with restrictive permissions and duplicate protection", () => {
    const directory = mkdtempSync(join(tmpdir(), "phase2e2-outcomes-"));
    const store = createForwardOutcomeStore({ directory, repositoryRoot: join(directory, "repo") });
    const record = buildForwardOutcomeRecord({
      prediction: prediction(),
      observation: observation(),
      collectedAt: "2026-09-28T21:00:00.000Z",
      calendar: NYSE_REGULAR_SESSION_CALENDAR,
    });
    store.append(record, prediction());
    expect(store.list()).toEqual([record]);
    expect(() => store.append(record, prediction())).toThrow(/duplicate/i);
  });
});
