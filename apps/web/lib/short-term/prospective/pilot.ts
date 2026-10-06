import "server-only";
import { createHash } from "node:crypto";
import { fingerprintMarketState } from "../market-data/canonicalize";
import { createFixtureMarketState } from "../market-data/fixture";
import type { ShortTermMarketState } from "../market-data/types";
import { createFixtureTransport } from "../jev/fixture-transport";
import { createJevService } from "../jev/service";
import type { ShortTermJevAssessmentRequest } from "../jev/types";
import { buildShadowRecord } from "../shadow/record";
import type { ShortTermShadowRecord } from "../shadow/types";
import { createFixtureObservationProvider } from "./observations";
import { collectProspectiveOutcome } from "./outcomes";
import { freezeProspectiveDecision } from "./freeze";
import { evaluateProspectivePair, type ProspectivePairEvaluation } from "./evaluate";
import type {
  FrozenProspectiveDecision,
  ProspectiveObservationCandidate,
  ProspectiveOutcomeRecord,
  ProspectiveSessionCalendar,
  ProspectiveSessionWindow,
} from "./types";

export const PROSPECTIVE_PILOT_SYMBOLS = ["NVDA", "TSLA", "AAPL"] as const;

export interface ProspectiveFixtureResult {
  symbol: string;
  shadowRecord: ShortTermShadowRecord;
  decision: FrozenProspectiveDecision;
  outcome: ProspectiveOutcomeRecord;
  evaluation: ProspectivePairEvaluation;
}

export interface ProspectiveFixtureReport {
  status: "fixture_dry_run";
  realProviderRequests: 0;
  results: ProspectiveFixtureResult[];
}

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
    closeAt: "2026-09-22T20:00:00.000Z",
    regular: true,
    earlyClose: false,
  },
};

const fixtureCalendar: ProspectiveSessionCalendar = {
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

function fixtureState(symbol: string, price: number): ShortTermMarketState {
  const base = createFixtureMarketState(symbol);
  const state: ShortTermMarketState = {
    ...base,
    security: {
      name: `${symbol} Fixture Security`,
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
        id: `ticker.${symbol}.price`,
        domain: "price",
        values: {
          symbol,
          price,
          previousClose: price - 1,
          sessionDate: "2026-09-21",
          feed: "delayed_sip",
          delayMinutes: 15,
        },
        asOf: "2026-09-21T13:45:00.000Z",
        freshness: "delayed",
        sourceVersion: "phase-2d-fixture-market-v1",
      },
    ],
    provenance: { source: "phase-2d-fixture-market-v1", sourceFingerprint: "" },
  };
  return {
    ...state,
    provenance: { ...state.provenance, sourceFingerprint: fingerprintMarketState(state) },
  };
}

function fixtureObservation(
  decision: FrozenProspectiveDecision,
  price: number,
): ProspectiveObservationCandidate {
  return {
    ticker: decision.ticker,
    stateFingerprint: decision.stateFingerprint,
    observedAt: "2026-09-22T20:01:00.000Z",
    sessionDate: "2026-09-22",
    price,
    provider: "phase-2d-fixture-market-v1",
    feed: "delayed_sip",
    freshness: "delayed",
    availability: "available",
    delayMinutes: 15,
    priceReferenceType: "fixture_close",
    sourceVersion: "phase-2d-fixture-market-v2",
    sourceFingerprint: createHash("sha256")
      .update(JSON.stringify({ ticker: decision.ticker, sessionDate: "2026-09-22", price }))
      .digest("hex"),
    completeness: "complete",
    regularSession: true,
    halted: false,
  };
}

function request(ticker: string): ShortTermJevAssessmentRequest {
  return { ticker, strategyId: "risk-first", horizonHours: 1, maxLossPct: 1 };
}

export async function runProspectiveFixtureDryRun(
  symbols: readonly string[] = PROSPECTIVE_PILOT_SYMBOLS,
): Promise<ProspectiveFixtureReport> {
  const jev = createJevService({
    transport: createFixtureTransport(),
    now: () => Date.parse("2026-09-21T14:00:00.000Z"),
  });
  const results: ProspectiveFixtureResult[] = [];
  for (const [index, symbol] of symbols.entries()) {
    const marketState = fixtureState(symbol, 100 + index * 10);
    const assessment = await jev.assess(request(symbol), marketState);
    if (assessment.status !== "fixture")
      throw new Error(`Fixture Jev assessment failed for ${symbol}.`);
    const shadowRecord = buildShadowRecord({
      assessment,
      request: request(symbol),
      marketState,
      marketInputStatus: "fixture_market_input",
      modelOutputStatus: "fixture_model_output",
    });
    const decision = freezeProspectiveDecision(shadowRecord, "next_session_close", {
      allowFixtureInput: true,
    });
    const observationProvider = createFixtureObservationProvider({
      [`${decision.runId}:${decision.horizon}:2026-09-22`]: fixtureObservation(
        decision,
        100 + index * 10 + 1,
      ),
    });
    const observation = await observationProvider.observe(decision, "2026-09-22");
    const outcome = collectProspectiveOutcome({ decision, observation, calendar: fixtureCalendar });
    const evaluation = evaluateProspectivePair({ shadowRecord, outcome });
    results.push({ symbol, shadowRecord, decision, outcome, evaluation });
  }
  return { status: "fixture_dry_run", realProviderRequests: 0, results };
}
