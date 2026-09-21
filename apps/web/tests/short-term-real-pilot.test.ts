import { describe, expect, it, vi } from "vitest";
import { JevAdapterError } from "@/lib/short-term/jev/errors";
import { createFixtureTransport } from "@/lib/short-term/jev/fixture-transport";
import type { JevTransport } from "@/lib/short-term/jev/types";
import type { TickerResearchResult } from "@/lib/ticker-context/types";
import { createInMemoryShadowStore } from "@/lib/short-term/shadow/store";
import {
  REAL_JEV_PILOT_CONFIRMATION,
  runRealJevShadowPilot,
} from "@/lib/short-term/pilot/real-shadow-pilot";

function verifiedContext(symbol: string): TickerResearchResult {
  return {
    status: "ok",
    context: {
      version: "ticker-context-v1",
      status: "ok",
      requestedSymbol: symbol,
      symbol,
      identity: {
        symbol,
        name: `${symbol} Corporation`,
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
          id: `ticker.${symbol}.price`,
          domain: "price",
          text: "Verified delayed-SIP price.",
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
      fingerprint: "a".repeat(64),
    },
  };
}

function realTransport(): JevTransport {
  const fixture = createFixtureTransport();
  return {
    async evaluate(request, fingerprint) {
      const response = await fixture.evaluate(request, fingerprint);
      return { ...response, transport: "http", latencyMs: 12 };
    },
  };
}

describe("private real Jev shadow pilot", () => {
  it("requires explicit confirmation without sending a request", async () => {
    const evaluate = vi.fn();
    const result = await runRealJevShadowPilot({
      confirmation: "",
      apiKey: "test-secret",
      transport: { evaluate },
      shadowStore: createInMemoryShadowStore(),
    });

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") throw new Error("expected blocked result");
    expect(result.reason).toBe("explicit_confirmation_required");
    expect(result.requestCount).toBe(0);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("records verified market input and real Jev output with one bounded request", async () => {
    const store = createInMemoryShadowStore();
    const result = await runRealJevShadowPilot({
      confirmation: REAL_JEV_PILOT_CONFIRMATION,
      apiKey: "test-secret",
      symbols: ["NVDA"],
      research: async () => verifiedContext("NVDA"),
      transport: realTransport(),
      shadowStore: store,
    });

    expect(result.status).toBe("completed");
    expect(result.requestCount).toBe(1);
    expect(result.symbols[0]).toMatchObject({
      symbol: "NVDA",
      status: "ready",
      model: "jev-1.13.0",
      marketInputStatus: "verified_market_input",
      modelOutputStatus: "real_jev_model_output",
      answerIds: ["downside_concern", "evidence_sufficiency", "manual_review", "market_condition"],
      providerHttpStatus: 200,
    });
    expect(store.list()).toHaveLength(1);
    expect(JSON.stringify(store.list())).not.toContain("test-secret");
  });

  it("stops after the first failed request without retries or later symbols", async () => {
    const evaluate = vi.fn(async () => {
      throw new JevAdapterError("PROVIDER_UNAVAILABLE", "provider unavailable");
    });
    const research = vi.fn(async (symbol: unknown) => verifiedContext(String(symbol)));
    const result = await runRealJevShadowPilot({
      confirmation: REAL_JEV_PILOT_CONFIRMATION,
      apiKey: "test-secret",
      research,
      transport: { evaluate },
      shadowStore: createInMemoryShadowStore(),
    });

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") throw new Error("expected blocked result");
    expect(result.reason).toBe("PROVIDER_UNAVAILABLE");
    expect(result.requestCount).toBe(1);
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(research).toHaveBeenCalledTimes(1);
  });

  it("blocks a request before transport when the conservative cost budget is too low", async () => {
    const evaluate = vi.fn();
    const result = await runRealJevShadowPilot({
      confirmation: REAL_JEV_PILOT_CONFIRMATION,
      apiKey: "test-secret",
      symbols: ["AAPL"],
      research: async () => verifiedContext("AAPL"),
      transport: { evaluate },
      maxEstimatedCostUsd: 0.0000001,
      shadowStore: createInMemoryShadowStore(),
    });

    expect(result.status).toBe("blocked");
    if (result.status !== "blocked") throw new Error("expected blocked result");
    expect(result.reason).toBe("BUDGET_EXCEEDED");
    expect(result.requestCount).toBe(0);
    expect(evaluate).not.toHaveBeenCalled();
  });
});
