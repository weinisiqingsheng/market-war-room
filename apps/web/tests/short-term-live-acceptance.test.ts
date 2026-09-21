// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createProductionTickerDeps } from "@/lib/ticker-context/production-service";
import { researchTicker } from "@/lib/ticker-context/service";
import { runVerifiedTickerShadow } from "@/lib/short-term/shadow/runner";
import { createInMemoryShadowStore } from "@/lib/short-term/shadow/store";

const liveAcceptanceEnabled =
  process.env.SHORT_TERM_LIVE_ACCEPTANCE === "1" &&
  process.env.MARKET_DATA_MODE === "live" &&
  process.env.TICKER_RESEARCH_MODE === "live";

describe.skipIf(!liveAcceptanceEnabled)("Short-Term live market acceptance", () => {
  it("runs bounded NVDA, TSLA, and AAPL snapshots through fixture Jev", async () => {
    const symbols = ["NVDA", "TSLA", "AAPL"] as const;
    const deps = createProductionTickerDeps();
    const observations: Array<{
      symbol: string;
      contextFingerprint: string;
      stateFingerprint: string;
      effectiveAsOf: string | null;
      marketSessionAsOf: string | null;
      feed: string | null;
      freshness: string;
    }> = [];
    const blocked: string[] = [];

    for (const ticker of symbols) {
      const sourceResult = await researchTicker(ticker, deps);
      if (
        sourceResult.status !== "ok" &&
        sourceResult.status !== "partial" &&
        sourceResult.status !== "insufficient_data"
      ) {
        blocked.push(
          `${ticker}:${sourceResult.status}:${"reason" in sourceResult ? sourceResult.reason : "unknown"}`,
        );
        continue;
      }

      const store = createInMemoryShadowStore();
      const result = await runVerifiedTickerShadow(
        { ticker, strategyId: "risk-first", horizonHours: 1, maxLossPct: 1 },
        {
          research: async () => sourceResult,
          researchDeps: deps,
          store,
        },
      );
      expect(result.status).toBe("ready");
      if (result.status !== "ready") throw new Error(`shadow unavailable for ${ticker}`);

      const contextPrice = result.contextStatus;
      expect(contextPrice).toMatch(/^(ok|partial|insufficient_data)$/);
      expect(result.marketInputStatus).toBe("verified_market_input");
      expect(result.modelOutputStatus).toBe("fixture_model_output");
      expect(result.assessment.status).toBe("fixture");
      expect(result.shadowRecord.marketInputStatus).toBe("verified_market_input");
      expect(result.shadowRecord.modelOutputStatus).toBe("fixture_model_output");
      expect(result.shadowRecord.sanitizedState.provenance.sourceFingerprint).toBe(
        result.context.fingerprint,
      );
      expect(store.list()).toHaveLength(1);
      observations.push({
        symbol: ticker,
        contextFingerprint: result.context.fingerprint,
        stateFingerprint: result.assessment.stateFingerprint,
        effectiveAsOf: result.state.effectiveAsOf,
        marketSessionAsOf: result.state.marketSessionAsOf,
        feed: result.state.feed,
        freshness: result.state.freshness,
      });
    }

    if (blocked.length > 0) {
      throw new Error(`LIVE_ACCEPTANCE_BLOCKED:${blocked.join(",")}`);
    }

    expect(observations).toHaveLength(3);
    expect(new Set(observations.map((item) => item.symbol))).toEqual(
      new Set(["NVDA", "TSLA", "AAPL"]),
    );
    for (const observation of observations) {
      expect(observation.contextFingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(observation.stateFingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(observation.feed === null || observation.feed === "delayed_sip").toBe(true);
      expect(["fresh", "delayed", "stale", "unavailable"]).toContain(observation.freshness);
    }
  }, 30_000);
});
