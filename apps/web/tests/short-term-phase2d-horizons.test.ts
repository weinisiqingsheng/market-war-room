import { describe, expect, it } from "vitest";
import type {
  FrozenProspectiveDecision,
  ProspectiveObservationCandidate,
  ProspectiveSessionCalendar,
  ProspectiveSessionWindow,
} from "@/lib/short-term/prospective/types";
import { evaluateHorizonEligibility } from "@/lib/short-term/prospective/horizons";

const sessions: Record<string, ProspectiveSessionWindow> = {
  "2026-09-21": {
    sessionDate: "2026-09-21",
    openAt: "2026-09-21T13:30:00.000Z",
    closeAt: "2026-09-21T20:00:00.000Z",
    regular: true,
    earlyClose: false,
  },
  "2026-09-22": {
    sessionDate: "2026-09-22",
    openAt: "2026-09-22T13:30:00.000Z",
    closeAt: "2026-09-22T17:00:00.000Z",
    regular: true,
    earlyClose: true,
  },
  "2026-09-24": {
    sessionDate: "2026-09-24",
    openAt: "2026-09-24T13:30:00.000Z",
    closeAt: "2026-09-24T20:00:00.000Z",
    regular: true,
    earlyClose: false,
  },
};

const calendar: ProspectiveSessionCalendar = {
  sessionFor: (date) => sessions[date] ?? null,
  nextSessionAfter: (date) =>
    Object.values(sessions)
      .filter((session) => session.sessionDate > date)
      .sort((left, right) => left.sessionDate.localeCompare(right.sessionDate))[0] ?? null,
  containsRegularInstant: (window, instant) => {
    const value = Date.parse(instant);
    return value >= Date.parse(window.openAt) && value <= Date.parse(window.closeAt);
  },
};

const decision: FrozenProspectiveDecision = {
  schemaVersion: "short-term-prospective-decision-v1",
  runId: "horizon-1",
  ticker: "NVDA",
  marketInputStatus: "fixture_market_input",
  identity: {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    exchange: "NASDAQ",
    assetClass: "us_equity",
    status: "active",
    tradable: true,
  },
  strategyId: "risk-first",
  horizon: "one_hour",
  requestedAt: "2026-09-21T13:35:00.000Z",
  effectiveAsOf: "2026-09-21T13:45:00.000Z",
  marketSessionDate: "2026-09-21",
  marketSessionStatus: "regular",
  referencePrice: 142,
  previousClose: 141,
  feed: "delayed_sip",
  delayMinutes: 15,
  freshness: "delayed",
  availability: { price: true, volume: true, history: true, volatility: true, sector: true },
  stateFingerprint: "a".repeat(64),
  sourceFingerprint: "b".repeat(64),
  inputContractVersion: "short-term-jev-assessment-v1",
  questionSetVersion: "short-term-jev-questions-v1",
  pinnedModel: "jev-1.13.0",
  protocolVersion: "short-term-prospective-protocol-v1",
  deterministicBaseline: "flat",
  assessment: {
    answers: {} as never,
    usage: { inputTokens: 1, outputTokens: 1, estimatedCostUsd: 0 },
    latencyMs: 1,
    resultStatus: "fixture",
    modelOutputStatus: "fixture_model_output",
  },
};

function observation(overrides: Partial<ProspectiveObservationCandidate> = {}) {
  return {
    observedAt: "2026-09-21T14:46:00.000Z",
    sessionDate: "2026-09-21",
    price: 143,
    provider: "fixture-market",
    feed: "delayed_sip",
    freshness: "delayed" as const,
    availability: "available" as const,
    delayMinutes: 15,
    priceReferenceType: "fixture_close" as const,
    sourceVersion: "phase-2d-fixture-market-v2",
    sourceFingerprint: "d".repeat(64),
    completeness: "complete" as const,
    regularSession: true,
    halted: false,
    ...overrides,
  } as ProspectiveObservationCandidate;
}

describe("Phase 2D injected horizon eligibility", () => {
  it("accepts a one-hour regular-session observation without using a calendar-day shortcut", () => {
    expect(
      evaluateHorizonEligibility({
        decision,
        observation: observation(),
        calendar,
      }),
    ).toMatchObject({ eligible: true, expectedSessionDate: "2026-09-21" });
  });

  it("skips weekends and holidays for next-session-close and honors early close", () => {
    const weekendDecision = {
      ...decision,
      marketSessionDate: "2026-09-21",
      horizon: "next_session_close" as const,
    };
    expect(
      evaluateHorizonEligibility({
        decision: weekendDecision,
        observation: observation({
          observedAt: "2026-09-22T17:01:00.000Z",
          sessionDate: "2026-09-22",
        }),
        calendar,
      }),
    ).toMatchObject({ eligible: true, expectedSessionDate: "2026-09-22" });
  });

  it.each([
    ["stale", { freshness: "stale" as const }],
    ["partial", { completeness: "partial" as const }],
    ["halted", { halted: true }],
    ["outside session", { regularSession: false }],
  ])("rejects %s observations", (_label, overrides) => {
    expect(
      evaluateHorizonEligibility({ decision, observation: observation(overrides), calendar }),
    ).toMatchObject({ eligible: false });
  });

  it("rejects look-ahead and unavailable one-hour observations", () => {
    expect(
      evaluateHorizonEligibility({
        decision,
        observation: observation({ observedAt: "2026-09-21T13:40:00.000Z" }),
        calendar,
      }),
    ).toMatchObject({ eligible: false, reason: "look_ahead" });
    expect(
      evaluateHorizonEligibility({
        decision,
        observation: observation({ completeness: "unavailable", price: null }),
        calendar,
      }),
    ).toMatchObject({ eligible: false, reason: "observation_unavailable" });
  });

  it("uses the actual session close for a current close and rejects closed-session relabeling", () => {
    const closeDecision = { ...decision, horizon: "session_close" as const };
    expect(
      evaluateHorizonEligibility({
        decision: closeDecision,
        observation: observation({ observedAt: "2026-09-21T20:00:00.000Z" }),
        calendar,
      }),
    ).toMatchObject({ eligible: true, expectedSessionDate: "2026-09-21" });
    expect(
      evaluateHorizonEligibility({
        decision: { ...closeDecision, marketSessionStatus: "closed" },
        observation: observation({ observedAt: "2026-09-21T20:01:00.000Z" }),
        calendar,
      }),
    ).toMatchObject({ eligible: false, reason: "session_already_closed" });
  });

  it("does not allow a decision at the relevant close to evaluate against that same close", () => {
    expect(
      evaluateHorizonEligibility({
        decision: {
          ...decision,
          horizon: "session_close",
          requestedAt: "2026-09-21T20:00:00.000Z",
          effectiveAsOf: "2026-09-21T20:00:00.000Z",
        },
        observation: observation({ observedAt: "2026-09-21T20:01:00.000Z" }),
        calendar,
      }),
    ).toMatchObject({ eligible: false, reason: "decision_at_or_after_close" });
  });
});
