import { describe, expect, it } from "vitest";
import {
  FORWARD_DIRECTION_CLASSES,
  FORWARD_HORIZON,
  FORWARD_TASK_ID,
  FORWARD_TASK_VERSION,
  labelForwardReturn,
} from "@/lib/short-term/forward/contract";
import {
  buildForwardDirectionQuestion,
  FORWARD_QUESTION_SET_VERSION,
} from "@/lib/short-term/forward/questions";
import type { ForwardDecisionContext } from "@/lib/short-term/forward/types";

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

describe("Phase 2E forward contract", () => {
  it("pins the task, horizon, version, and exact direction classes", () => {
    expect(FORWARD_TASK_ID).toBe("next_session_direction_v1");
    expect(FORWARD_TASK_VERSION).toBe("short-term-forward-direction-v1");
    expect(FORWARD_HORIZON).toBe("next_session_close");
    expect(FORWARD_DIRECTION_CLASSES).toEqual(["UP", "FLAT", "DOWN"]);
  });

  it.each([
    [0.1000001, "UP"],
    [0.1, "FLAT"],
    [0, "FLAT"],
    [-0.1, "FLAT"],
    [-0.1000001, "DOWN"],
  ] as const)("uses the frozen inclusive flat-band boundaries for %s", (value, expected) => {
    expect(labelForwardReturn(value)).toBe(expected);
  });

  it("builds a temporal question that separates current state from the next close", () => {
    const question = buildForwardDirectionQuestion(decision);
    expect(FORWARD_QUESTION_SET_VERSION).toBe("short-term-forward-questions-v1");
    expect(question.id).toBe("next_session_direction");
    expect(question.horizon).toBe("next_session_close");
    expect(question.classes).toEqual(["UP", "FLAT", "DOWN"]);
    expect(question.prompt).toContain(decision.requestedAt);
    expect(question.prompt).toContain(decision.effectiveAsOf);
    expect(question.prompt).toContain(decision.targetSessionDate);
    expect(question.prompt).toContain(decision.targetCloseAt);
    expect(question.prompt).toContain("only decision-time evidence");
    expect(question.prompt).toContain("current market state");
    expect(question.prompt).toContain("next-session close direction");
  });
});
