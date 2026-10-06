// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createProductionTickerDeps } from "@/lib/ticker-context/production-service";
import { researchTicker } from "@/lib/ticker-context/service";
import { bridgeTickerResearchResult } from "@/lib/short-term/market-data/verified-bridge";
import { fingerprintMarketState } from "@/lib/short-term/market-data/canonicalize";

const enabled =
  process.env.SHORT_TERM_LIVE_ACCEPTANCE === "1" &&
  process.env.MARKET_DATA_MODE === "live" &&
  process.env.TICKER_RESEARCH_MODE === "live";

describe.skipIf(!enabled)("Phase 2D.2 live market-data readiness", () => {
  it("captures safe verified-input metadata without invoking Jev or persisting a prospective record", async () => {
    const deps = createProductionTickerDeps();
    const observations: Array<Record<string, string | boolean | null>> = [];

    for (const ticker of ["NVDA", "TSLA", "AAPL"] as const) {
      const result = await researchTicker(ticker, deps);
      const bridged = bridgeTickerResearchResult(result);
      if (bridged.status !== "verified_market_input") {
        observations.push({
          ticker,
          status: "unavailable",
          reason: bridged.reason,
          effectiveAsOf: null,
          requestedAt: null,
          marketSessionAsOf: null,
          marketSessionStatus: null,
          feed: null,
          delayMinutes: null,
          freshness: null,
          stateFingerprint: null,
          sourceFingerprint: null,
          provenanceComplete: false,
        });
        continue;
      }

      const state = bridged.state;
      const provenanceComplete =
        Boolean(state.provenance.source) &&
        /^[a-f0-9]{64}$/.test(state.provenance.sourceFingerprint) &&
        Boolean(state.effectiveAsOf) &&
        Boolean(state.marketSessionAsOf) &&
        Boolean(state.feed) &&
        state.availability.price;
      observations.push({
        ticker,
        status: bridged.contextStatus,
        reason: null,
        effectiveAsOf: state.effectiveAsOf,
        requestedAt: bridged.context.requestedAt,
        marketSessionAsOf: state.marketSessionAsOf,
        marketSessionStatus: state.marketSessionStatus,
        feed: state.feed,
        delayMinutes: state.delayMinutes === null ? null : String(state.delayMinutes),
        freshness: state.freshness,
        stateFingerprint: fingerprintMarketState(state),
        sourceFingerprint: state.provenance.sourceFingerprint,
        provenanceComplete,
      });
    }

    console.info(`[short-term-live-readiness] ${JSON.stringify(observations)}`);
    expect(observations).toHaveLength(3);
    expect(observations.every((item) => item.status !== "unavailable")).toBe(true);
    expect(observations.every((item) => item.provenanceComplete === true)).toBe(true);
  }, 30_000);
});
