import { describe, expect, it } from "vitest";
import type { ShortTermShadowRecord } from "@/lib/short-term/shadow/types";
import type { ProspectiveOutcomeRecord } from "@/lib/short-term/prospective/types";
import { evaluateProspectivePair } from "@/lib/short-term/prospective/evaluate";

function record(overrides: Partial<ShortTermShadowRecord> = {}): ShortTermShadowRecord {
  return {
    version: "short-term-shadow-record-v1",
    runId: "phase2d-eval-1",
    requestedAt: "2026-09-21T13:35:00.000Z",
    ticker: "NVDA",
    strategyId: "risk-first",
    horizonHours: 1,
    maxLossPct: 1,
    stateFingerprint: "a".repeat(64),
    inputContractVersion: "short-term-jev-assessment-v1",
    questionSetVersion: "short-term-jev-questions-v1",
    pinnedModel: "jev-1.13.0",
    sanitizedState: {
      version: "short-term-market-state-v1",
      symbol: "NVDA",
      security: {
        name: "NVIDIA",
        exchange: "NASDAQ",
        assetClass: "us_equity",
        status: "active",
        tradable: true,
      },
      effectiveAsOf: "2026-09-21T13:45:00.000Z",
      marketSessionAsOf: "2026-09-21",
      marketSessionStatus: "regular",
      feed: "delayed_sip",
      delayMinutes: 15,
      availability: { price: true, volume: true, history: true, volatility: true, sector: true },
      freshness: "delayed",
      facts: [],
      provenance: { source: "ticker-context-v1", sourceFingerprint: "b".repeat(64) },
    },
    answers: {
      evidence_sufficiency: { type: "noul", noul: 0.8 },
      market_condition: {
        type: "choice",
        choice: "mixed",
        probabilities: { bullish: 0.2, mixed: 0.6, defensive: 0.2 },
        confidence: 0.6,
      },
      downside_concern: {
        type: "score",
        score: 1,
        legend: { "0": "Low", "1": "Moderate", "2": "High" },
        probabilities: { "0": 0, "1": 1, "2": 0 },
        confidence: 0.6,
      },
      manual_review: { type: "noul", noul: 0.2 },
    },
    usage: { inputTokens: 1, outputTokens: 1, estimatedCostUsd: 0 },
    latencyMs: 1,
    resultStatus: "fixture",
    marketInputStatus: "verified_market_input",
    modelOutputStatus: "fixture_model_output",
    provenance: {
      kind: "verified_market_snapshot",
      source: "ticker-context-v1",
      sourceFingerprint: "b".repeat(64),
    },
    cacheHit: false,
    ...overrides,
  };
}

function outcome(overrides: Partial<ProspectiveOutcomeRecord> = {}): ProspectiveOutcomeRecord {
  return {
    schemaVersion: "short-term-prospective-outcome-v2",
    runId: "phase2d-eval-1",
    ticker: "NVDA",
    stateFingerprint: "a".repeat(64),
    horizon: "session_close",
    decisionEffectiveAsOf: "2026-09-21T13:45:00.000Z",
    referencePrice: 100,
    observedPrice: 101,
    observedAt: "2026-09-21T20:01:00.000Z",
    sessionDate: "2026-09-21",
    provider: "fixture-market",
    feed: "delayed_sip",
    delayMinutes: 15,
    freshness: "delayed",
    availability: "available",
    priceReferenceType: "fixture_close",
    sourceVersion: "phase-2d-fixture-market-v2",
    sourceFingerprint: "d".repeat(64),
    completeness: "complete",
    returnPct: 1,
    label: "up",
    reason: null,
    ...overrides,
  };
}

describe("Phase 2D prospective evaluation", () => {
  it("reuses current-state validation and compares the naive flat baseline", () => {
    const result = evaluateProspectivePair({ shadowRecord: record(), outcome: outcome() });
    expect(result.currentState).toMatchObject({ responseValid: true, provenanceComplete: true });
    expect(result.baseline).toMatchObject({ label: "flat", outcomeLabel: "up", matches: false });
    expect(result.forward).toMatchObject({ status: "not_applicable" });
  });

  it("does not map existing Jev classifications or confidence to forward direction", () => {
    const result = evaluateProspectivePair({
      shadowRecord: record(),
      outcome: outcome({ label: "down" }),
    });
    expect(result.forward).toMatchObject({ status: "not_applicable" });
    expect(result.forward.reason).toContain("future-direction");
    expect(result).not.toHaveProperty("calibration");
  });

  it("retains the historical TSLA exclusion from verified Score consistency", () => {
    const result = evaluateProspectivePair({
      shadowRecord: record({
        ticker: "TSLA",
        runId: "short-term-1981f035e3c261a384354a87",
        stateFingerprint: "1981f035e3c261a384354a87fdd3f3a5ac887951cb56bd979cebdcf39e73e007",
        answers: {
          ...record().answers,
          downside_concern: {
            type: "score",
            score: 0.93,
            legend: { "0": "Low", "1": "Moderate", "2": "High" },
            probabilities: { "0": 0.18, "1": 0.7, "2": 0.12 },
            confidence: 0.5,
          },
        },
      }),
      outcome: outcome({
        ticker: "TSLA",
        runId: "short-term-1981f035e3c261a384354a87",
        stateFingerprint: "1981f035e3c261a384354a87fdd3f3a5ac887951cb56bd979cebdcf39e73e007",
      }),
    });
    expect(result.currentState.scoreConsistencyStatus).toBe("weighted_consistency_unverified");
  });

  it("marks unavailable outcomes as non-comparable", () => {
    const result = evaluateProspectivePair({
      shadowRecord: record(),
      outcome: outcome({
        label: "not_observable",
        completeness: "unavailable",
        observedPrice: null,
        returnPct: null,
      }),
    });
    expect(result.baseline.matches).toBeNull();
    expect(result.forward.status).toBe("not_applicable");
  });
});
