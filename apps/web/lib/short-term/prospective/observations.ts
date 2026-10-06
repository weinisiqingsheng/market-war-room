import "server-only";
import { createHash } from "node:crypto";
import { DELAY_MINUTES, HISTORY_FEED } from "@/lib/breadth/constants";
import type {
  FrozenProspectiveDecision,
  ProspectiveObservationCandidate,
  ProspectiveSessionCalendar,
} from "./types";
import { barSessionDate } from "@/lib/breadth/dates";

export interface FutureObservationProvider {
  observe(
    decision: FrozenProspectiveDecision,
    expectedSessionDate: string | null,
  ): Promise<ProspectiveObservationCandidate>;
}

export interface ProductionOutcomeDeps {
  fetchBars: (
    providerSymbol: string,
    startIso: string,
    endIso: string,
  ) => Promise<Array<{ t?: string; c?: number }>>;
  now?: () => number;
}

const DAILY_CLOSE_SOURCE_VERSION = "alpaca-v2-stocks-bars-1day-sip-split-v1";

function sourceFingerprint(input: {
  ticker: string;
  sessionDate: string;
  barTimestamp: string;
  close: number;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        provider: "alpaca",
        feed: HISTORY_FEED,
        priceReferenceType: "daily_bar_close_split_adjusted",
        sourceVersion: DAILY_CLOSE_SOURCE_VERSION,
        adjustment: "split",
        ...input,
      }),
    )
    .digest("hex");
}

function unavailableCandidate(
  decision: FrozenProspectiveDecision,
  sessionDate: string | null,
): ProspectiveObservationCandidate {
  return {
    ticker: decision.ticker,
    stateFingerprint: decision.stateFingerprint,
    observedAt: new Date(Date.parse(decision.effectiveAsOf) + 1).toISOString(),
    sessionDate: sessionDate ?? decision.marketSessionDate,
    price: null,
    provider: "alpaca",
    feed: HISTORY_FEED,
    freshness: "unavailable",
    availability: "unavailable",
    delayMinutes: null,
    priceReferenceType: "unknown",
    sourceVersion: DAILY_CLOSE_SOURCE_VERSION,
    sourceFingerprint: null,
    completeness: "unavailable",
    regularSession: false,
    halted: false,
  };
}

export function createProductionOutcomeProvider(
  calendar: ProspectiveSessionCalendar,
  deps: ProductionOutcomeDeps,
): FutureObservationProvider {
  const now = deps.now ?? Date.now;
  return {
    async observe(decision, expectedSessionDate) {
      if (decision.horizon === "one_hour")
        return unavailableCandidate(decision, expectedSessionDate);
      if (!expectedSessionDate) return unavailableCandidate(decision, null);
      const window = calendar.sessionFor(expectedSessionDate);
      if (!window) return unavailableCandidate(decision, expectedSessionDate);
      const startIso = `${expectedSessionDate}T00:00:00.000Z`;
      const endIso = `${expectedSessionDate}T23:59:59.999Z`;
      const bars = await deps.fetchBars(decision.ticker, startIso, endIso).catch(() => []);
      const bar = bars.find((candidate) => barSessionDate(candidate.t) === expectedSessionDate);
      if (
        typeof bar?.t !== "string" ||
        typeof bar.c !== "number" ||
        !Number.isFinite(bar.c) ||
        bar.c <= 0 ||
        now() < Date.parse(window.closeAt) + DELAY_MINUTES * 60_000
      )
        return unavailableCandidate(decision, expectedSessionDate);
      return {
        ticker: decision.ticker,
        stateFingerprint: decision.stateFingerprint,
        observedAt: window.closeAt,
        sessionDate: expectedSessionDate,
        price: bar.c,
        provider: "alpaca",
        feed: HISTORY_FEED,
        freshness: "delayed",
        availability: "available",
        delayMinutes: DELAY_MINUTES,
        priceReferenceType: "daily_bar_close_split_adjusted",
        sourceVersion: DAILY_CLOSE_SOURCE_VERSION,
        sourceFingerprint: sourceFingerprint({
          ticker: decision.ticker,
          sessionDate: expectedSessionDate,
          barTimestamp: bar.t,
          close: bar.c,
        }),
        completeness: "complete",
        regularSession: true,
        halted: false,
      };
    },
  };
}

export function createFixtureObservationProvider(
  observations: Record<string, ProspectiveObservationCandidate>,
): FutureObservationProvider {
  return {
    async observe(decision, expectedSessionDate) {
      const key = `${decision.runId}:${decision.horizon}:${expectedSessionDate ?? "none"}`;
      return (
        observations[key] ?? {
          ticker: decision.ticker,
          stateFingerprint: decision.stateFingerprint,
          observedAt: new Date(Date.parse(decision.effectiveAsOf) + 1).toISOString(),
          sessionDate: expectedSessionDate ?? decision.marketSessionDate,
          price: null,
          provider: "fixture-market",
          feed: null,
          freshness: "unavailable",
          availability: "unavailable",
          delayMinutes: null,
          priceReferenceType: "unknown",
          sourceVersion: null,
          sourceFingerprint: null,
          completeness: "unavailable",
          regularSession: false,
          halted: false,
        }
      );
    },
  };
}
