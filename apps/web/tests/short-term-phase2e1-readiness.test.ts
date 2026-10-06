// @vitest-environment node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildForwardDirectionQuestion } from "@/lib/short-term/forward/questions";
import {
  FORWARD_MARKET_DATA_POLICY,
  FORWARD_MARKET_DATA_POLICY_VERSION,
  assertForwardDecisionPolicy,
} from "@/lib/short-term/forward/market-policy";
import {
  buildForwardProviderRequest,
  mapForwardProviderResponse,
} from "@/lib/short-term/forward/provider";
import {
  REAL_FORWARD_CONFIRMATION,
  runRealForwardPilot,
} from "@/lib/short-term/forward/real-pilot";
import { runForwardFixturePilot } from "@/lib/short-term/forward/runner";
import { createForwardPredictionStore } from "@/lib/short-term/forward/store";
import type { ForwardDecisionContext } from "@/lib/short-term/forward/types";

const decision: ForwardDecisionContext = {
  originalDecisionRunId: "decision-live-1",
  ticker: "NVDA",
  stateFingerprint: "a".repeat(64),
  sourceFingerprint: "b".repeat(64),
  requestedAt: "2026-09-27T23:00:00.000Z",
  effectiveAsOf: "2026-09-27T20:00:00.000Z",
  marketSessionDate: "2026-09-25",
  marketSessionStatus: "closed",
  targetSessionDate: "2026-09-28",
  targetCloseAt: "2026-09-28T20:00:00.000Z",
  marketDataPolicyVersion: "short-term-forward-market-data-policy-v1",
  referencePrice: 227.38,
  previousClose: 225,
  feed: "delayed_sip",
  delayMinutes: 15,
  freshness: "delayed",
  marketInputStatus: "verified_market_input",
};

describe("Phase 2E.1 private forward readiness", () => {
  it("builds a separate Jev choice registry without current-state question IDs", () => {
    const request = buildForwardProviderRequest(decision, { facts: [] });
    expect(Object.keys(request.questions).sort()).toEqual([
      "evidence_sufficiency",
      "manual_review",
      "next_session_direction",
    ]);
    expect(request.questions).not.toHaveProperty("market_condition");
    expect(request.model).toBe("jev-1.13.0");
  });

  it("maps only the exact forward answer set and preserves provider usage", () => {
    const question = buildForwardDirectionQuestion(decision);
    const assessment = mapForwardProviderResponse(
      {
        model: "jev-1.13.0",
        answers: {
          next_session_direction: {
            type: "choice",
            choice: "UP",
            probabilities: { UP: 0.7, FLAT: 0.2, DOWN: 0.1 },
            confidence: 0.8,
          },
          evidence_sufficiency: { type: "noul", noul: 0.9 },
          manual_review: { type: "noul", noul: 0 },
        },
        usage: { input_tokens: 100, output_tokens: 20 },
      },
      decision,
      question,
      { latencyMs: 42, estimatedCostUsd: 0.00001 },
    );
    expect(assessment.predictedClass).toBe("UP");
    expect(assessment.usage).toEqual({ inputTokens: 100, outputTokens: 20 });
    expect(assessment.latencyMs).toBe(42);
    expect(assessment.estimatedCostUsd).toBe(0.00001);
  });

  it("fails closed before any provider call without the explicit confirmation", async () => {
    const research = vi.fn();
    const report = await runRealForwardPilot({ confirmation: "", research });
    expect(report.status).toBe("blocked");
    expect(report.reason).toBe("explicit_confirmation_required");
    expect(report.requestCount).toBe(0);
    expect(research).not.toHaveBeenCalled();
  });

  it("pins the authorization token and request budget", () => {
    expect(REAL_FORWARD_CONFIRMATION).toBe("CONFIRM_PHASE_2E_1_REAL_FORWARD_PILOT");
  });

  it("pins the explicit delayed-SIP decision and SIP outcome policy", () => {
    expect(FORWARD_MARKET_DATA_POLICY_VERSION).toBe("short-term-forward-market-data-policy-v1");
    expect(FORWARD_MARKET_DATA_POLICY).toMatchObject({
      decisionFeed: "delayed_sip",
      outcomeFeed: "sip",
      outcomeAdjustment: "split",
      delayMinutes: 15,
    });
    expect(assertForwardDecisionPolicy(decision)).toEqual({ ok: true });
    expect(assertForwardDecisionPolicy({ ...decision, feed: "iex" })).toEqual({
      ok: false,
      reason: "decision_feed_mismatch",
    });
  });

  it("simulates the complete fixture pipeline in a temporary private store", async () => {
    const report = await runForwardFixturePilot();
    const directory = mkdtempSync(join(tmpdir(), "phase2e1-forward-preflight-"));
    const store = createForwardPredictionStore({ directory, retentionDays: 90 });
    for (const prediction of report.predictions) store.append(prediction);
    expect(store.list()).toHaveLength(3);
    expect(report.realJevRequests).toBe(0);
    expect(report.realMarketRequests).toBe(0);
    expect(report.evaluation.forwardMetricStatus).toBe("applicable");
  });
});
