import { describe, expect, it } from "vitest";
import type { TickerResearchResult } from "@/lib/ticker-context/types";
import { createInMemoryShadowStore } from "@/lib/short-term/shadow/store";
import { runVerifiedTickerShadow } from "@/lib/short-term/shadow/runner";

function liveContextResult(): TickerResearchResult {
  return {
    status: "ok",
    context: {
      version: "ticker-context-v1",
      status: "ok",
      requestedSymbol: "NVDA",
      symbol: "NVDA",
      identity: {
        symbol: "NVDA",
        name: "NVIDIA Corporation",
        exchange: "NASDAQ",
        assetClass: "us_equity",
        status: "active",
        tradable: true,
      },
      requestedAt: "2026-09-18T21:00:00.000Z",
      generatedAt: "2026-09-18T21:00:00.000Z",
      providerAsOf: "2026-09-18T20:00:00.000Z",
      marketSessionAsOf: "2026-09-18",
      effectiveAsOf: "2026-09-18T20:00:00.000Z",
      session: { marketOpen: false, phase: "closed", sessionDate: "2026-09-18" },
      sources: {
        market: {
          available: true,
          asOf: "2026-09-18T20:00:00.000Z",
          freshness: "delayed",
          confidence: "high",
          version: "alpaca-v1",
        },
        identity: {
          available: true,
          asOf: "2026-09-18T21:00:00.000Z",
          freshness: "fresh",
          confidence: "high",
          version: "alpaca-assets-v1",
        },
        sector: {
          available: false,
          asOf: null,
          freshness: "unavailable",
          confidence: null,
          version: null,
        },
        news: {
          available: false,
          asOf: null,
          freshness: "unavailable",
          confidence: null,
          version: null,
        },
        sec: {
          available: false,
          asOf: null,
          freshness: "unavailable",
          confidence: null,
          version: null,
        },
      },
      availability: {
        price: true,
        history: false,
        volume: true,
        volatility: false,
        sector: false,
        news: false,
        sec: false,
        corporateActions: false,
      },
      facts: [
        {
          id: "ticker.NVDA.price",
          domain: "price",
          text: "Verified delayed-SIP price prose.",
          data: {
            value: 104,
            previousClose: 100,
            changePct: 4,
            direction: "advancer",
            sessionDate: "2026-09-18",
            feed: "delayed_sip",
            delayMinutes: 15,
          },
          asOf: "2026-09-18T20:00:00.000Z",
          freshness: "delayed",
          confidence: "high",
          sourceVersion: "ticker-context-v1",
        },
      ],
      confidence: { score: 0.7, label: "medium" },
      fingerprint: "b".repeat(64),
    },
  };
}

describe("Short-Term verified-input shadow runner", () => {
  it("runs verified market input through fixture Jev and records explicit labels", async () => {
    const store = createInMemoryShadowStore();
    const result = await runVerifiedTickerShadow(
      { ticker: "NVDA", strategyId: "risk-first", horizonHours: 1, maxLossPct: 1 },
      { research: async () => liveContextResult(), store },
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("expected ready shadow result");
    expect(result.marketInputStatus).toBe("verified_market_input");
    expect(result.modelOutputStatus).toBe("fixture_model_output");
    expect(result.assessment.status).toBe("fixture");
    expect(result.assessment.provenance.kind).toBe("fixture");
    expect(result.state.symbol).toBe("NVDA");
    expect(result.shadowRecord.marketInputStatus).toBe("verified_market_input");
    expect(result.shadowRecord.modelOutputStatus).toBe("fixture_model_output");
    expect(store.list()).toEqual([result.shadowRecord]);
    expect(JSON.stringify(result.shadowRecord)).not.toMatch(/authorization|api[_-]?key/i);
  });

  it("does not create a fixture market snapshot when live research fails", async () => {
    const store = createInMemoryShadowStore();
    const result = await runVerifiedTickerShadow(
      { ticker: "TSLA", strategyId: "momentum-watch", horizonHours: 4, maxLossPct: 2 },
      {
        research: async () => ({
          status: "unavailable",
          requestedSymbol: "TSLA",
          symbol: null,
          reason: "provider_unavailable",
          mode: "live",
        }),
        store,
      },
    );
    expect(result).toEqual({
      status: "unavailable",
      requestedSymbol: "TSLA",
      reason: "provider_unavailable",
    });
    expect(store.list()).toEqual([]);
  });
});
