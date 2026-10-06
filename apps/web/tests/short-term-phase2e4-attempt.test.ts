// @vitest-environment node
import { chmodSync, mkdtempSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_SCHEMA_VERSION,
  attemptFailureCategory,
  attemptLifecycleForReason,
  buildForwardExperimentAttempt,
  type ForwardAttemptLifecycleStatus,
} from "@/lib/short-term/forward/attempt";
import { createForwardAttemptStore } from "@/lib/short-term/forward/attempt-store";
import { summarizeForwardExperiment } from "@/lib/short-term/forward/ledger";
import { buildForwardDirectionQuestion } from "@/lib/short-term/forward/questions";
import {
  buildForwardFixtureDecision,
  buildForwardFixtureResponse,
} from "@/lib/short-term/forward/fixture";
import { buildForwardPredictionRecord } from "@/lib/short-term/forward/record";
import { validateForwardResponse } from "@/lib/short-term/forward/validate";

const statuses: ForwardAttemptLifecycleStatus[] = [
  "ATTEMPT_STARTED",
  "MARKET_INPUT_UNAVAILABLE",
  "MARKET_INPUT_STALE",
  "SESSION_NOT_ELIGIBLE",
  "JEV_TRANSPORT_FAILED",
  "JEV_VALIDATION_FAILED",
  "BUDGET_BLOCKED",
  "STORAGE_FAILED",
  "PREDICTION_CREATED",
];

function event(status: ForwardAttemptLifecycleStatus, sequence = 1) {
  return buildForwardExperimentAttempt({
    attemptId: "attempt-nvda",
    sequence,
    requestedAt: "2026-10-05T20:00:00.000Z",
    ticker: "NVDA",
    taskId: "next_session_direction_v1",
    taskVersion: "short-term-forward-direction-v1",
    questionSetVersion: "short-term-forward-questions-v1",
    marketDataPolicyVersion: "short-term-forward-market-data-policy-v1",
    intendedTargetSession: "2026-10-06",
    lifecycleStatus: status,
    providerRequestCount: status === "ATTEMPT_STARTED" ? 0 : 1,
    jevRequestCount: status === "JEV_TRANSPORT_FAILED" ? 1 : 0,
    predictionRecordCreated: status === "PREDICTION_CREATED",
    model: "jev-1.13.0",
  });
}

function prediction() {
  const decision = buildForwardFixtureDecision("NVDA", 0);
  const question = buildForwardDirectionQuestion(decision);
  const assessment = validateForwardResponse(buildForwardFixtureResponse(decision, 0), question);
  return buildForwardPredictionRecord({
    decision,
    assessment,
    createdAt: "2026-09-21T23:29:39.000Z",
    modelOutputStatus: "fixture_model_output",
  });
}

describe("Phase 2E.4 attempt accounting", () => {
  it.each(statuses)("supports explicit lifecycle status %s", (status) => {
    const record = event(status);
    expect(record.schemaVersion).toBe(ATTEMPT_SCHEMA_VERSION);
    expect(record.lifecycleStatus).toBe(status);
  });

  it("maps safe terminal reasons to explicit failure states", () => {
    expect(attemptLifecycleForReason("market_input_unavailable")).toBe("MARKET_INPUT_UNAVAILABLE");
    expect(attemptLifecycleForReason("market_input_not_fresh")).toBe("MARKET_INPUT_STALE");
    expect(attemptLifecycleForReason("target_session_close_passed")).toBe("SESSION_NOT_ELIGIBLE");
    expect(attemptLifecycleForReason("provider_unavailable")).toBe("JEV_TRANSPORT_FAILED");
    expect(attemptLifecycleForReason("response_invalid")).toBe("JEV_VALIDATION_FAILED");
    expect(attemptLifecycleForReason("budget_exceeded")).toBe("BUDGET_BLOCKED");
    expect(attemptLifecycleForReason("attempt_storage_failed")).toBe("STORAGE_FAILED");
    expect(attemptFailureCategory("budget_exceeded")).toBe("budget_failure");
    expect(attemptFailureCategory("provider_unavailable")).toBe("provider_failure");
  });

  it("stores append-only lifecycle events with secure permissions and duplicate protection", () => {
    const directory = mkdtempSync(join(tmpdir(), "phase2e4-attempt-store-"));
    const store = createForwardAttemptStore({ directory, retentionDays: 90 });
    store.append(event("ATTEMPT_STARTED", 1));
    store.append(event("PREDICTION_CREATED", 2));
    expect(store.list()).toHaveLength(2);
    expect(() => store.append(event("PREDICTION_CREATED", 2))).toThrow(/duplicate/i);
    expect(statSync(directory).mode & 0o777).toBe(0o700);
    expect(statSync(store.filePath).mode & 0o777).toBe(0o600);
  });

  it("fails closed on malformed attempt JSONL", () => {
    const directory = mkdtempSync(join(tmpdir(), "phase2e4-attempt-malformed-"));
    const store = createForwardAttemptStore({ directory, retentionDays: 90 });
    writeFileSync(store.filePath, "{not-json}\n");
    chmodSync(store.filePath, 0o600);
    expect(() => store.list()).toThrow(/malformed|partial/i);
  });

  it("reconciles terminal prediction linkage and explicit failure categories", () => {
    const record = prediction();
    const completedStarted = buildForwardExperimentAttempt({
      ...event("ATTEMPT_STARTED", 1),
      attemptId: "completed",
    });
    const completed = buildForwardExperimentAttempt({
      ...event("PREDICTION_CREATED", 2),
      attemptId: "completed",
      linkedPredictionRunId: record.originalDecisionRunId,
    });
    const failed = buildForwardExperimentAttempt({
      ...event("JEV_TRANSPORT_FAILED", 1),
      attemptId: "failed",
      failureCategory: "provider_failure",
      safeErrorCategory: "provider_unavailable",
    });
    const result = summarizeForwardExperiment({
      predictions: [record],
      outcomes: [],
      attempts: [completedStarted, completed, failed],
    });
    expect(result.attemptCount).toBe(2);
    expect(result.successfulPredictionCount).toBe(1);
    expect(result.failedAttemptCount).toBe(1);
    expect(result.providerFailureCount).toBe(1);
    expect(result.untrackedAttemptCount).toBe(0);
    expect(result.predictionReconciliation).toEqual({
      attemptPredictions: 1,
      predictionRecords: 1,
      unmatchedAttemptPredictions: 0,
      unmatchedPredictionRecords: 0,
    });
    expect(result.sourceRecordsMutated).toBe(false);
  });
});
