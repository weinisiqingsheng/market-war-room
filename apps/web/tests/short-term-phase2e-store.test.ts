import { mkdtempSync, readFileSync, writeFileSync, chmodSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createForwardPredictionStore } from "@/lib/short-term/forward/store";
import type { ForwardDirectionPredictionRecord } from "@/lib/short-term/forward/types";

function record(id: string): ForwardDirectionPredictionRecord {
  return Object.freeze({
    schemaVersion: "short-term-forward-prediction-v1",
    predictionId: id,
    taskId: "next_session_direction_v1",
    taskVersion: "short-term-forward-direction-v1",
    horizon: "next_session_close",
    ticker: "NVDA",
    originalDecisionRunId: "decision-1",
    stateFingerprint: "a".repeat(64),
    sourceFingerprint: "b".repeat(64),
    requestedAt: "2026-09-21T23:29:38.161Z",
    effectiveAsOf: "2026-09-21T20:00:00.000Z",
    marketSessionDate: "2026-09-21",
    targetSessionDate: "2026-09-22",
    targetCloseAt: "2026-09-22T20:00:00.000Z",
    marketDataPolicyVersion: "short-term-forward-market-data-policy-v1",
    referencePrice: 100,
    previousClose: 99,
    feed: "delayed_sip",
    delayMinutes: 15,
    freshness: "delayed",
    marketInputStatus: "fixture_market_input",
    model: "jev-1.13.0",
    questionSetVersion: "short-term-forward-questions-v1",
    predictedClass: "UP",
    classDistribution: Object.freeze({ UP: 0.6, FLAT: 0.3, DOWN: 0.1 }),
    confidence: 0.7,
    evidenceSufficiency: 0.8,
    manualReview: false,
    modelOutputStatus: "fixture_model_output",
    baselines: Object.freeze({
      alwaysFlat: "FLAT",
      frozenMomentum: "UP",
      historicalMajority: null,
      historicalMajorityStatus: "not_available",
    }),
    outputFingerprint: "c".repeat(64),
    latencyMs: 0,
    estimatedCostUsd: 0,
    usage: Object.freeze({ inputTokens: 1, outputTokens: 1 }),
    createdAt: "2026-09-21T23:29:39.000Z",
  });
}

describe("Phase 2E private prediction store", () => {
  it("writes outside the repository with restrictive permissions and rejects duplicates", () => {
    const directory = mkdtempSync(join(tmpdir(), "phase2e-store-"));
    const repositoryRoot = mkdtempSync(join(tmpdir(), "phase2e-repo-"));
    const store = createForwardPredictionStore({ directory, repositoryRoot, retentionDays: 90 });
    const first = record("prediction-1");
    store.append(first);
    expect(store.list()).toEqual([first]);
    expect(() => store.append(first)).toThrow(/duplicate/i);
    expect(statSync(directory).mode & 0o077).toBe(0);
    expect(statSync(store.filePath).mode & 0o077).toBe(0);
  });

  it("rejects repository paths and malformed or partial JSONL", () => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "phase2e-repo-"));
    expect(() =>
      createForwardPredictionStore({
        directory: join(repositoryRoot, "predictions"),
        repositoryRoot,
        retentionDays: 90,
      }),
    ).toThrow(/outside/i);

    const directory = mkdtempSync(join(tmpdir(), "phase2e-store-"));
    const store = createForwardPredictionStore({ directory, retentionDays: 90 });
    writeFileSync(store.filePath, `${JSON.stringify(record("prediction-1"))}\n{"broken"`, {
      mode: 0o600,
    });
    chmodSync(store.filePath, 0o600);
    expect(() => store.list()).toThrow(/malformed|partial/i);
  });

  it("prunes records using the declared retention policy", () => {
    const directory = mkdtempSync(join(tmpdir(), "phase2e-store-"));
    const store = createForwardPredictionStore({ directory, retentionDays: 1 });
    store.append(record("prediction-old"));
    expect(store.pruneExpired(new Date("2026-09-24T00:00:00.000Z"))).toBe(1);
    expect(readFileSync(store.filePath, "utf8")).toBe("");
  });
});
