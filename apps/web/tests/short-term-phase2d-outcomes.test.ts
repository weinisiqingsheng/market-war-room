import { describe, expect, it } from "vitest";
import type {
  FrozenProspectiveDecision,
  ProspectiveObservationCandidate,
  ProspectiveSessionCalendar,
  ProspectiveSessionWindow,
} from "@/lib/short-term/prospective/types";
import { collectProspectiveOutcome } from "@/lib/short-term/prospective/outcomes";
import { createProductionOutcomeProvider } from "@/lib/short-term/prospective/observations";

const session: ProspectiveSessionWindow = {
  sessionDate: "2026-09-21",
  openAt: "2026-09-21T13:30:00.000Z",
  closeAt: "2026-09-21T20:00:00.000Z",
  regular: true,
  earlyClose: false,
};
const nextSession: ProspectiveSessionWindow = {
  sessionDate: "2026-09-22",
  openAt: "2026-09-22T13:30:00.000Z",
  closeAt: "2026-09-22T20:00:00.000Z",
  regular: true,
  earlyClose: false,
};
const calendar: ProspectiveSessionCalendar = {
  sessionFor: (date) =>
    date === session.sessionDate ? session : date === nextSession.sessionDate ? nextSession : null,
  nextSessionAfter: () => nextSession,
  containsRegularInstant: (window, instant) => {
    const value = Date.parse(instant);
    return value >= Date.parse(window.openAt) && value <= Date.parse(window.closeAt);
  },
};
const decision: FrozenProspectiveDecision = {
  schemaVersion: "short-term-prospective-decision-v1",
  runId: "outcome-1",
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
  horizon: "session_close",
  requestedAt: "2026-09-21T13:35:00.000Z",
  effectiveAsOf: "2026-09-21T13:45:00.000Z",
  marketSessionDate: "2026-09-21",
  marketSessionStatus: "regular",
  referencePrice: 100,
  previousClose: 99,
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

function observation(
  overrides: Partial<ProspectiveObservationCandidate> = {},
): ProspectiveObservationCandidate {
  return {
    ticker: "NVDA",
    stateFingerprint: decision.stateFingerprint,
    observedAt: "2026-09-21T20:01:00.000Z",
    sessionDate: "2026-09-21",
    price: 100.2,
    provider: "fixture-market",
    feed: "delayed_sip",
    freshness: "delayed",
    availability: "available",
    delayMinutes: 15,
    priceReferenceType: "fixture_close",
    sourceVersion: "phase-2d-fixture-market-v2",
    sourceFingerprint: "d".repeat(64),
    completeness: "complete",
    regularSession: true,
    halted: false,
    ...overrides,
  };
}

describe("Phase 2D prospective outcomes", () => {
  it("calculates a complete UP outcome from an independent observation", () => {
    const outcome = collectProspectiveOutcome({
      decision,
      observation: observation({ price: 100.4 }),
      calendar,
    });
    expect(outcome).toMatchObject({
      schemaVersion: "short-term-prospective-outcome-v2",
      runId: "outcome-1",
      ticker: "NVDA",
      stateFingerprint: decision.stateFingerprint,
      returnPct: 0.4,
      label: "up",
      completeness: "complete",
    });
  });

  it.each([
    [100.05, "flat"],
    [99.8, "down"],
  ] as const)("applies the documented flat band to %s", (price, label) => {
    expect(
      collectProspectiveOutcome({ decision, observation: observation({ price }), calendar }).label,
    ).toBe(label);
  });

  it("records unavailable, stale, and partial observations as NOT_OBSERVABLE", () => {
    expect(
      collectProspectiveOutcome({
        decision,
        observation: observation({ completeness: "unavailable", price: null }),
        calendar,
      }),
    ).toMatchObject({ label: "not_observable", returnPct: null, observedPrice: null });
    expect(
      collectProspectiveOutcome({
        decision,
        observation: observation({ freshness: "stale" }),
        calendar,
      }),
    ).toMatchObject({ label: "not_observable", reason: "observation_stale" });
    expect(
      collectProspectiveOutcome({
        decision,
        observation: observation({ completeness: "partial" }),
        calendar,
      }),
    ).toMatchObject({ label: "not_observable", reason: "observation_incomplete" });
  });

  it("rejects identity, fingerprint, and look-ahead violations instead of fabricating outcomes", () => {
    expect(() =>
      collectProspectiveOutcome({
        decision,
        observation: observation({ ticker: "TSLA" }),
        calendar,
      }),
    ).toThrow("ticker");
    expect(() =>
      collectProspectiveOutcome({
        decision,
        observation: observation({ stateFingerprint: "c".repeat(64) }),
        calendar,
      }),
    ).toThrow("fingerprint");
    expect(() =>
      collectProspectiveOutcome({
        decision,
        observation: observation({ observedAt: "2026-09-21T13:40:00.000Z" }),
        calendar,
      }),
    ).toThrow("look-ahead");
  });

  it("honors the next eligible session rather than a calendar-day offset", () => {
    const nextDecision = { ...decision, horizon: "next_session_close" as const };
    const outcome = collectProspectiveOutcome({
      decision: nextDecision,
      observation: observation({
        sessionDate: "2026-09-22",
        observedAt: "2026-09-22T20:01:00.000Z",
        price: 101,
      }),
      calendar,
    });
    expect(outcome).toMatchObject({ label: "up", sessionDate: "2026-09-22" });
  });

  it("uses injected verified daily bars for close horizons and fails closed for one-hour production", async () => {
    let fetchCount = 0;
    const provider = createProductionOutcomeProvider(calendar, {
      now: () => Date.parse("2026-09-22T20:16:00.000Z"),
      async fetchBars() {
        fetchCount += 1;
        return [{ t: "2026-09-22T04:00:00.000Z", c: 101 }];
      },
    });
    const nextDecision = { ...decision, horizon: "next_session_close" as const };
    const next = await provider.observe(nextDecision, "2026-09-22");
    expect(next).toMatchObject({ price: 101, sessionDate: "2026-09-22", completeness: "complete" });
    const oneHour = await provider.observe({ ...decision, horizon: "one_hour" }, "2026-09-21");
    expect(oneHour).toMatchObject({ completeness: "unavailable", price: null });
    expect(fetchCount).toBe(1);
  });

  it("does not treat a not-yet-delayed close or provider failure as a complete future observation", async () => {
    const beforeDelayedClose = createProductionOutcomeProvider(calendar, {
      now: () => Date.parse("2026-09-22T20:05:00.000Z"),
      async fetchBars() {
        return [{ t: "2026-09-22T04:00:00.000Z", c: 101 }];
      },
    });
    const unavailableProvider = createProductionOutcomeProvider(calendar, {
      now: () => Date.parse("2026-09-22T20:16:00.000Z"),
      async fetchBars() {
        throw new Error("provider unavailable");
      },
    });
    const nextDecision = { ...decision, horizon: "next_session_close" as const };

    await expect(beforeDelayedClose.observe(nextDecision, "2026-09-22")).resolves.toMatchObject({
      availability: "unavailable",
      completeness: "unavailable",
      freshness: "unavailable",
      sourceFingerprint: null,
    });
    await expect(unavailableProvider.observe(nextDecision, "2026-09-22")).resolves.toMatchObject({
      availability: "unavailable",
      completeness: "unavailable",
      freshness: "unavailable",
      sourceFingerprint: null,
    });
  });

  it("rejects missing or copied future-observation provenance", () => {
    expect(
      collectProspectiveOutcome({
        decision,
        observation: observation({ sourceFingerprint: null }),
        calendar,
      }),
    ).toMatchObject({ label: "not_observable", reason: "observation_provenance_unverified" });
    expect(
      collectProspectiveOutcome({
        decision,
        observation: observation({ sourceFingerprint: decision.sourceFingerprint }),
        calendar,
      }),
    ).toMatchObject({ label: "not_observable", reason: "observation_provenance_unverified" });
  });
});
