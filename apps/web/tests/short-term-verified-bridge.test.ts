import { describe, expect, it } from "vitest";
import type { JSONObject } from "@/lib/ai-brief/types";
import type { TickerResearchContext } from "@/lib/ticker-context/types";
import {
  bridgeTickerResearchResult,
  loadVerifiedTickerState,
} from "@/lib/short-term/market-data/verified-bridge";
import { fingerprintMarketState } from "@/lib/short-term/market-data/canonicalize";

const SOURCE_FINGERPRINT = "a".repeat(64);

function fact(
  id: string,
  domain: "price" | "volume" | "volatility" | "sector",
  data: JSONObject,
  overrides: Partial<TickerResearchContext["facts"][number]> = {},
) {
  return {
    id,
    domain,
    text: "This prose intentionally contains a misleading price 999999.",
    data,
    asOf: "2026-09-18T20:00:00.000Z",
    freshness: "delayed" as const,
    confidence: "high" as const,
    sourceVersion: "ticker-context-v1",
    ...overrides,
  };
}

function contextFixture(overrides: Partial<TickerResearchContext> = {}): TickerResearchContext {
  return {
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
    requestedAt: "2026-09-18T21:00:02.000Z",
    generatedAt: "2026-09-18T21:00:02.000Z",
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
        available: true,
        asOf: "2026-09-18T21:00:00.000Z",
        freshness: "fresh",
        confidence: "high",
        version: "sp500-v1",
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
      history: true,
      volume: true,
      volatility: true,
      sector: true,
      news: false,
      sec: false,
      corporateActions: false,
    },
    facts: [
      fact("ticker.NVDA.price", "price", {
        value: 104,
        previousClose: 100,
        changePct: 4,
        direction: "advancer",
        sessionDate: "2026-09-18",
        feed: "delayed_sip",
        delayMinutes: 15,
        tradePrice: 104.1,
        tradeTimestamp: "2026-09-18T20:00:00.000Z",
      }),
      fact("ticker.NVDA.volume", "volume", {
        sessionVolume: 12_000_000,
        avgVolume20: 10_000_000,
        relativeVolume: 1.2,
        partialSessionVolumePctOfAvg: null,
        sessionCompleted: true,
        sessionDate: "2026-09-18",
      }),
      fact("ticker.NVDA.volatility", "volatility", {
        returnVol20Pct: 2.5,
        latestMoveSigma: 1.6,
        historySessionCount: 20,
        windowSessions: 20,
      }),
      fact("ticker.NVDA.sector", "sector", {
        sector: "Information Technology",
        benchmarkEtf: "XLK",
        benchmarkChangePct: 1.1,
        classificationSource: "sp500-v1",
      }),
    ],
    confidence: { score: 0.9, label: "high" },
    fingerprint: SOURCE_FINGERPRINT,
    ...overrides,
  };
}

describe("Short-Term verified market-data bridge", () => {
  it("copies typed facts and verified provenance without parsing evidence prose", () => {
    const result = bridgeTickerResearchResult({ status: "ok", context: contextFixture() });
    expect(result.status).toBe("verified_market_input");
    if (result.status !== "verified_market_input") throw new Error("expected verified input");

    expect(result.state.symbol).toBe("NVDA");
    expect(result.state.security.name).toBe("NVIDIA Corporation");
    expect(result.state.effectiveAsOf).toBe("2026-09-18T20:00:00.000Z");
    expect(result.state.marketSessionAsOf).toBe("2026-09-18");
    expect(result.state.marketSessionStatus).toBe("closed");
    expect(result.state.feed).toBe("delayed_sip");
    expect(result.state.delayMinutes).toBe(15);
    expect(result.state.freshness).toBe("delayed");
    expect(result.state.provenance).toEqual({
      source: "ticker-context-v1",
      sourceFingerprint: SOURCE_FINGERPRINT,
    });
    expect(result.state.facts.find((item) => item.domain === "price")?.values.value).toBe(104);
    expect(result.state.facts.find((item) => item.domain === "price")?.values.value).not.toBe(
      999999,
    );
  });

  it("preserves partial, stale, missing-sector and in-session semantics", () => {
    const context = contextFixture({
      status: "partial",
      effectiveAsOf: "2026-09-18T14:00:00.000Z",
      marketSessionAsOf: "2026-09-18",
      session: { marketOpen: true, phase: "regular", sessionDate: "2026-09-18" },
      sources: {
        ...contextFixture().sources,
        market: { ...contextFixture().sources.market, freshness: "stale" },
        sector: {
          available: false,
          asOf: null,
          freshness: "unavailable",
          confidence: null,
          version: null,
        },
      },
      availability: { ...contextFixture().availability, sector: false, volatility: false },
      facts: contextFixture()
        .facts.filter((item) => item.domain !== "sector" && item.domain !== "volatility")
        .map((item) =>
          item.domain === "volume"
            ? {
                ...item,
                data: { ...item.data, sessionCompleted: false, relativeVolume: null },
              }
            : item,
        ),
    });
    const result = bridgeTickerResearchResult({ status: "partial", context });
    expect(result.status).toBe("verified_market_input");
    if (result.status !== "verified_market_input") throw new Error("expected verified input");
    expect(result.contextStatus).toBe("partial");
    expect(result.state.freshness).toBe("stale");
    expect(result.state.marketSessionStatus).toBe("regular");
    expect(result.state.availability).toMatchObject({ sector: false, volatility: false });
    expect(result.state.facts.find((item) => item.domain === "volume")?.values).toMatchObject({
      sessionCompleted: false,
      relativeVolume: null,
    });
  });

  it("fails closed for unsupported and unavailable ticker results", () => {
    expect(
      bridgeTickerResearchResult({
        status: "unsupported_symbol",
        requestedSymbol: "ZZZZ",
        symbol: null,
        reason: "unknown_symbol",
      }),
    ).toEqual({ status: "unavailable", reason: "unknown_symbol", requestedSymbol: "ZZZZ" });
    expect(
      bridgeTickerResearchResult({
        status: "unsupported_symbol",
        requestedSymbol: "BTCUSD",
        symbol: null,
        reason: "unsupported_security_type",
      }),
    ).toEqual({
      status: "unavailable",
      reason: "unsupported_security_type",
      requestedSymbol: "BTCUSD",
    });
    expect(
      bridgeTickerResearchResult({
        status: "unavailable",
        requestedSymbol: "NVDA",
        symbol: null,
        reason: "provider_unavailable",
        mode: "live",
      }),
    ).toEqual({ status: "unavailable", reason: "provider_unavailable", requestedSymbol: "NVDA" });
  });

  it("produces stable state fingerprints for the same snapshot and isolates changed prices", () => {
    const first = bridgeTickerResearchResult({ status: "ok", context: contextFixture() });
    const second = bridgeTickerResearchResult({ status: "ok", context: contextFixture() });
    if (first.status !== "verified_market_input" || second.status !== "verified_market_input") {
      throw new Error("expected verified inputs");
    }
    expect(fingerprintMarketState(first.state)).toBe(fingerprintMarketState(second.state));
    const changed = bridgeTickerResearchResult({
      status: "ok",
      context: contextFixture({
        facts: contextFixture().facts.map((item) =>
          item.id === "ticker.NVDA.price" ? { ...item, data: { ...item.data, value: 105 } } : item,
        ),
      }),
    });
    if (changed.status !== "verified_market_input") throw new Error("expected verified input");
    expect(fingerprintMarketState(first.state)).not.toBe(fingerprintMarketState(changed.state));
  });

  it("does not substitute fixture data when the live provider is unavailable", async () => {
    const result = await loadVerifiedTickerState("NVDA", async () => ({
      status: "unavailable",
      requestedSymbol: "NVDA",
      symbol: null,
      reason: "provider_unavailable",
      mode: "live",
    }));
    expect(result).toEqual({
      status: "unavailable",
      reason: "provider_unavailable",
      requestedSymbol: "NVDA",
    });
  });

  it("maps an unexpected provider rejection to an explicit unavailable result", async () => {
    const result = await loadVerifiedTickerState("AAPL", async () => {
      throw new Error("upstream timeout");
    });
    expect(result).toEqual({
      status: "unavailable",
      reason: "provider_unavailable",
      requestedSymbol: "AAPL",
    });
  });
});
