import { describe, expect, it } from "vitest";
import type { ShortTermShadowRecord } from "@/lib/short-term/shadow/types";
import { freezeProspectiveDecision } from "@/lib/short-term/prospective/freeze";

function record(overrides: Partial<ShortTermShadowRecord> = {}): ShortTermShadowRecord {
  return {
    version: "short-term-shadow-record-v1",
    runId: "phase2d-freeze-1",
    requestedAt: "2026-09-21T14:00:00.000Z",
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
        name: "NVIDIA Corporation",
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
      facts: [
        {
          id: "ticker.NVDA.price",
          domain: "price",
          values: {
            symbol: "NVDA",
            price: 142.35,
            previousClose: 141.9,
            sessionDate: "2026-09-21",
            feed: "delayed_sip",
            delayMinutes: 15,
          },
          asOf: "2026-09-21T13:45:00.000Z",
          freshness: "delayed",
          sourceVersion: "ticker-context-v1",
        },
      ],
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
    usage: { inputTokens: 100, outputTokens: 30, estimatedCostUsd: 0.001 },
    latencyMs: 100,
    resultStatus: "verified",
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

describe("Phase 2D frozen prospective decisions", () => {
  it("freezes structured verified inputs and assessment output without prose parsing", () => {
    const frozen = freezeProspectiveDecision(record(), "session_close");

    expect(frozen).toMatchObject({
      schemaVersion: "short-term-prospective-decision-v1",
      runId: "phase2d-freeze-1",
      ticker: "NVDA",
      horizon: "session_close",
      referencePrice: 142.35,
      previousClose: 141.9,
      effectiveAsOf: "2026-09-21T13:45:00.000Z",
      marketSessionDate: "2026-09-21",
      stateFingerprint: "a".repeat(64),
      sourceFingerprint: "b".repeat(64),
      deterministicBaseline: "flat",
    });
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(frozen.assessment.modelOutputStatus).toBe("fixture_model_output");
  });

  it("rejects non-verified market inputs and unavailable decision states", () => {
    expect(() =>
      freezeProspectiveDecision(record({ marketInputStatus: "fixture_market_input" }), "one_hour"),
    ).toThrow("verified market input");
    expect(() =>
      freezeProspectiveDecision(
        record({
          sanitizedState: {
            ...record().sanitizedState,
            freshness: "stale",
          },
        }),
        "one_hour",
      ),
    ).toThrow("freshness");
  });

  it("preserves the frozen copy when the source record is mutated", () => {
    const source = record();
    const frozen = freezeProspectiveDecision(source, "next_session_close");
    source.sanitizedState.facts[0].values.price = 999;
    expect(frozen.referencePrice).toBe(142.35);
  });
});
