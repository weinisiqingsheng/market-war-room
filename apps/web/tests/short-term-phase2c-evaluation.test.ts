import { describe, expect, it } from "vitest";
import type { ShortTermShadowRecord } from "@/lib/short-term/shadow/types";
import {
  compareEquivalentOutputs,
  evaluateShadowRecord,
  freezeDecisionInput,
  createProspectiveOutcome,
} from "@/lib/short-term/evaluation/evaluators";
import {
  historicalFrequencyBaseline,
  noChangeBaseline,
} from "@/lib/short-term/evaluation/baselines";
import type { ProspectiveOutcome, EvaluationHorizon } from "@/lib/short-term/evaluation/types";

function record(overrides: Partial<ShortTermShadowRecord> = {}): ShortTermShadowRecord {
  return {
    version: "short-term-shadow-record-v1",
    runId: "run-eval-1",
    requestedAt: "2026-09-18T19:00:00.000Z",
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
      effectiveAsOf: "2026-09-18T18:00:00.000Z",
      marketSessionAsOf: "2026-09-18",
      marketSessionStatus: "closed",
      feed: "delayed_sip",
      delayMinutes: 15,
      availability: { price: true, volume: true, history: true, volatility: true, sector: true },
      freshness: "delayed",
      facts: [],
      provenance: { source: "ticker-context-v1", sourceFingerprint: "b".repeat(64) },
    },
    answers: {
      evidence_sufficiency: { type: "noul", noul: 0.45 },
      market_condition: {
        type: "choice",
        choice: "bullish",
        probabilities: { bullish: 0.7, mixed: 0.2, defensive: 0.1 },
        confidence: 0.6,
      },
      downside_concern: {
        type: "score",
        score: 1.01,
        legend: { "0": "Low", "1": "Moderate", "2": "High" },
        probabilities: { "0": 0.22, "1": 0.55, "2": 0.23 },
        confidence: 0.33,
      },
      manual_review: { type: "noul", noul: 0.83 },
    },
    usage: { inputTokens: 1_944, outputTokens: 100, estimatedCostUsd: 0.000081648 },
    latencyMs: 275,
    resultStatus: "verified",
    marketInputStatus: "verified_market_input",
    modelOutputStatus: "real_jev_model_output",
    provenance: {
      kind: "verified_market_snapshot",
      source: "ticker-context-v1",
      sourceFingerprint: "b".repeat(64),
    },
    cacheHit: false,
    ...overrides,
  };
}

describe("Phase 2C frozen evaluation foundation", () => {
  it("freezes decision-time state without creating an outcome", () => {
    const frozen = freezeDecisionInput(record());

    expect(frozen).toMatchObject({
      schemaVersion: "short-term-evaluation-input-v1",
      runId: "run-eval-1",
      decisionAt: "2026-09-18T19:00:00.000Z",
      effectiveAsOf: "2026-09-18T18:00:00.000Z",
      marketSessionAsOf: "2026-09-18",
      marketSessionStatus: "closed",
      feed: "delayed_sip",
      freshness: "delayed",
      stateFingerprint: "a".repeat(64),
      sourceFingerprint: "b".repeat(64),
    });
    expect("outcome" in frozen).toBe(false);
  });

  it("accepts an independently observed session-aligned outcome after the decision boundary", () => {
    const outcome = createProspectiveOutcome({
      decision: freezeDecisionInput(record()),
      observedAt: "2026-09-19T20:00:00.000Z",
      sessionDate: "2026-09-19",
      horizon: "next_session_close",
      benchmark: "SPY",
      label: "up",
    });

    expect(outcome).toMatchObject<Partial<ProspectiveOutcome>>({
      schemaVersion: "short-term-evaluation-outcome-v1",
      horizon: "next_session_close",
      label: "up",
      benchmark: "SPY",
    });
  });

  it("rejects an outcome that leaks information from before effectiveAsOf", () => {
    expect(() =>
      createProspectiveOutcome({
        decision: freezeDecisionInput(record()),
        observedAt: "2026-09-18T18:30:00.000Z",
        sessionDate: "2026-09-18",
        horizon: "one_hour",
        benchmark: "SPY",
        label: "down",
      }),
    ).toThrow("look-ahead");
  });

  it("evaluates validity, provenance, latency, cost, and complete availability offline", () => {
    const result = evaluateShadowRecord(record());

    expect(result).toMatchObject({
      responseValid: true,
      provenanceComplete: true,
      latencyMs: 275,
      estimatedCostUsd: 0.000081648,
      missingData: [],
      stale: false,
    });
  });

  it("flags a score-contract violation without changing the production validator", () => {
    const base = record();
    const scoreAnswer = base.answers.downside_concern;
    if (scoreAnswer.type !== "score") throw new Error("expected score answer fixture");
    const result = evaluateShadowRecord({
      ...base,
      answers: {
        ...base.answers,
        downside_concern: {
          ...scoreAnswer,
          score: 1.2,
        },
      },
    });

    expect(result.responseValid).toBe(false);
    expect(result.validationIssues).toContain("score_not_probability_weighted");
  });

  it("retains the exact historical TSLA record as unverified rather than consistent", () => {
    const result = evaluateShadowRecord({
      ...record(),
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
          confidence: 0.55,
        },
      },
    });

    expect(result.scoreConsistencyStatus).toBe("weighted_consistency_unverified");
    expect(result.historicalScoreAudit?.reason).toContain("0.94");
  });

  it("reports missing and stale fields without manufacturing values", () => {
    const result = evaluateShadowRecord(
      record({
        sanitizedState: {
          ...record().sanitizedState,
          freshness: "stale",
          availability: {
            price: true,
            volume: false,
            history: false,
            volatility: true,
            sector: false,
          },
        },
      }),
    );

    expect(result.stale).toBe(true);
    expect(result.missingData).toEqual(["volume", "history", "sector"]);
  });

  it("compares stability and keeps evidence-change results descriptive", () => {
    const same = compareEquivalentOutputs(record(), record());
    const changed = compareEquivalentOutputs(
      record(),
      record({ stateFingerprint: "c".repeat(64) }),
    );

    expect(same).toMatchObject({ sameState: true, sameAnswers: true });
    expect(changed).toMatchObject({ sameState: false, sameAnswers: true });
  });

  it("provides explicit naive baselines without labeling Jev classifications", () => {
    expect(noChangeBaseline()).toBe("flat");
    expect(historicalFrequencyBaseline({ up: 2, flat: 5, down: 1 })).toBe("flat");
  });

  it.each(["one_hour", "session_close", "next_session_close"] as EvaluationHorizon[])(
    "accepts the declared horizon %s",
    (horizon) => {
      expect(() =>
        createProspectiveOutcome({
          decision: freezeDecisionInput(record()),
          observedAt: "2026-09-19T20:00:00.000Z",
          sessionDate: "2026-09-19",
          horizon,
          benchmark: "SPY",
          label: "not_observable",
        }),
      ).not.toThrow();
    },
  );
});
