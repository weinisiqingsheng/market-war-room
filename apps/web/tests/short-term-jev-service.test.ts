import { describe, expect, it } from "vitest";
import { createJevConfig } from "@/lib/short-term/jev/config";
import { createFixtureTransport } from "@/lib/short-term/jev/fixture-transport";
import { createJevService } from "@/lib/short-term/jev/service";
import type { ShortTermMarketState } from "@/lib/short-term/market-data/types";

const state: ShortTermMarketState = {
  version: "short-term-market-state-v1",
  symbol: "NVDA",
  security: {
    name: "NVIDIA",
    exchange: "NASDAQ",
    assetClass: "us_equity",
    status: "active",
    tradable: true,
  },
  effectiveAsOf: "2026-09-18T20:00:00.000Z",
  marketSessionAsOf: "2026-09-18",
  marketSessionStatus: "closed",
  feed: "delayed_sip",
  delayMinutes: 15,
  availability: { price: false, volume: false, history: false, volatility: false, sector: false },
  freshness: "unavailable",
  facts: [],
  provenance: { source: "fixture", sourceFingerprint: "b".repeat(64) },
};

describe("short-term Jev service", () => {
  it("returns an explicitly fixture-backed assessment", async () => {
    const service = createJevService({ transport: createFixtureTransport() });
    const result = await service.assess(
      { ticker: "NVDA", strategyId: "risk-first", horizonHours: 1, maxLossPct: 1 },
      state,
    );
    expect(result.status).toBe("fixture");
    expect(result.provenance.kind).toBe("fixture");
    expect(result.answers).toHaveProperty("manual_review");
  });

  it("isolates cache entries by market fingerprint", async () => {
    const transport = createFixtureTransport();
    const service = createJevService({ transport });
    const first = await service.assess(
      { ticker: "NVDA", strategyId: "risk-first", horizonHours: 1, maxLossPct: 1 },
      state,
    );
    const second = await service.assess(
      { ticker: "NVDA", strategyId: "risk-first", horizonHours: 1, maxLossPct: 1 },
      { ...state, effectiveAsOf: "2026-09-18T20:01:00.000Z" },
    );
    expect(first.cache.hit).toBe(false);
    expect(second.cache.hit).toBe(false);
  });

  it("serves an identical request from cache", async () => {
    const service = createJevService({ transport: createFixtureTransport() });
    const first = await service.assess(
      { ticker: "NVDA", strategyId: "risk-first", horizonHours: 1, maxLossPct: 1 },
      state,
    );
    const second = await service.assess(
      { ticker: "NVDA", strategyId: "risk-first", horizonHours: 1, maxLossPct: 1 },
      state,
    );
    expect(first.cache.hit).toBe(false);
    expect(second.cache.hit).toBe(true);
  });

  it("returns a typed budget rejection without invoking a provider", async () => {
    const transport = createFixtureTransport();
    let calls = 0;
    const wrapped = {
      evaluate: async (...args: Parameters<typeof transport.evaluate>) => {
        calls += 1;
        return transport.evaluate(...args);
      },
    };
    const service = createJevService({
      transport: wrapped,
      config: { ...createJevConfig(), maxInputTokensPerRequest: 1 },
    });
    const result = await service.assess(
      { ticker: "NVDA", strategyId: "risk-first", horizonHours: 1, maxLossPct: 1 },
      state,
    );
    expect(result).toMatchObject({ status: "unavailable", error: { code: "BUDGET_EXCEEDED" } });
    expect(calls).toBe(0);
  });
});
