import { describe, expect, it } from "vitest";
import { buildForwardDirectionQuestion } from "@/lib/short-term/forward/questions";
import { buildForwardPredictionRecord } from "@/lib/short-term/forward/record";
import { validateForwardResponse } from "@/lib/short-term/forward/validate";
import type {
  ForwardDecisionContext,
  ForwardJevProviderResponse,
} from "@/lib/short-term/forward/types";

const decision: ForwardDecisionContext = {
  originalDecisionRunId: "decision-nvda-1",
  ticker: "NVDA",
  stateFingerprint: "a".repeat(64),
  sourceFingerprint: "b".repeat(64),
  requestedAt: "2026-09-21T23:29:38.161Z",
  effectiveAsOf: "2026-09-21T20:00:00.000Z",
  marketSessionDate: "2026-09-21",
  marketSessionStatus: "closed",
  targetSessionDate: "2026-09-22",
  targetCloseAt: "2026-09-22T20:00:00.000Z",
  marketDataPolicyVersion: "short-term-forward-market-data-policy-v1",
  referencePrice: 227.38,
  previousClose: 222.27,
  feed: "delayed_sip",
  delayMinutes: 15,
  freshness: "delayed",
  marketInputStatus: "verified_market_input",
};

function response(overrides: Partial<ForwardJevProviderResponse> = {}): ForwardJevProviderResponse {
  return {
    taskId: "next_session_direction_v1",
    taskVersion: "short-term-forward-direction-v1",
    horizon: "next_session_close",
    targetSessionDate: decision.targetSessionDate,
    targetCloseAt: decision.targetCloseAt,
    model: "jev-1.13.0",
    questionSetVersion: "short-term-forward-questions-v1",
    answer: {
      predictedClass: "UP",
      classDistribution: { UP: 0.6, FLAT: 0.3, DOWN: 0.1 },
      confidence: 0.7,
      evidenceSufficiency: 0.8,
      manualReview: false,
    },
    usage: { inputTokens: 100, outputTokens: 20 },
    ...overrides,
  };
}

describe("Phase 2E forward validation and records", () => {
  it("accepts exact direction output and creates a deeply frozen decision-time record", () => {
    const question = buildForwardDirectionQuestion(decision);
    const assessment = validateForwardResponse(response(), question);
    const record = buildForwardPredictionRecord({
      decision,
      assessment,
      createdAt: "2026-09-21T23:29:39.000Z",
      modelOutputStatus: "fixture_model_output",
    });

    expect(record).toMatchObject({
      taskId: "next_session_direction_v1",
      taskVersion: "short-term-forward-direction-v1",
      horizon: "next_session_close",
      ticker: "NVDA",
      originalDecisionRunId: decision.originalDecisionRunId,
      targetSessionDate: "2026-09-22",
      predictedClass: "UP",
      modelOutputStatus: "fixture_model_output",
    });
    expect(record).not.toHaveProperty("observedPrice");
    expect(record.outputFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(record.baselines).toMatchObject({
      alwaysFlat: "FLAT",
      historicalMajority: null,
      historicalMajorityStatus: "not_available",
    });
    expect(record).toMatchObject({ latencyMs: 0, estimatedCostUsd: 0 });
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.classDistribution)).toBe(true);
    expect(() => {
      (record as { predictedClass: string }).predictedClass = "DOWN";
    }).toThrow();
  });

  it.each([
    ["class keys", { answer: { ...response().answer, classDistribution: { UP: 1, FLAT: 0 } } }],
    [
      "class normalization",
      {
        answer: { ...response().answer, classDistribution: { UP: 0.6, FLAT: 0.3, DOWN: 0.10001 } },
      },
    ],
    ["confidence", { answer: { ...response().answer, confidence: 1.01 } }],
    ["predicted class", { answer: { ...response().answer, predictedClass: "SIDEWAYS" } }],
    ["target session", { targetSessionDate: "2026-09-21" }],
    ["future outcome field", { observedPrice: 228.87 } as never],
  ])("rejects invalid %s output", (_label, overrides) => {
    const question = buildForwardDirectionQuestion(decision);
    expect(() => validateForwardResponse(response(overrides), question)).toThrow();
  });

  it("rejects stale, unavailable, and future-dated decision inputs", () => {
    const question = buildForwardDirectionQuestion(decision);
    const assessment = validateForwardResponse(response(), question);
    expect(() =>
      buildForwardPredictionRecord({
        decision: { ...decision, freshness: "stale" },
        assessment,
        createdAt: "2026-09-21T23:29:39.000Z",
        modelOutputStatus: "fixture_model_output",
      }),
    ).toThrow(/stale/i);
    expect(() =>
      buildForwardPredictionRecord({
        decision: { ...decision, marketInputStatus: "fixture_market_input" },
        assessment,
        createdAt: "2026-09-21T23:29:39.000Z",
        modelOutputStatus: "fixture_model_output",
      }),
    ).not.toThrow();
    expect(() =>
      buildForwardPredictionRecord({
        decision: { ...decision, requestedAt: "2026-09-23T00:00:00.000Z" },
        assessment,
        createdAt: "2026-09-21T23:29:39.000Z",
        modelOutputStatus: "fixture_model_output",
      }),
    ).toThrow(/target|timestamp|session/i);
  });
});
