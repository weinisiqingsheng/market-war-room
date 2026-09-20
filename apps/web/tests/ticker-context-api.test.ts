import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TickerResearchContext } from "@/lib/ticker-context/types";
import { TICKER_CONTEXT_VERSION } from "@/lib/ticker-context/types";

const production = vi.hoisted(() => ({
  mode: vi.fn(() => "live" as "live" | "demo"),
  deps: vi.fn(() => ({ marker: "fake-deps" })),
}));
const service = vi.hoisted(() => ({ researchTicker: vi.fn() }));

vi.mock("@/lib/ticker-context/production-service", () => ({
  resolveTickerResearchMode: production.mode,
  createProductionTickerDeps: production.deps,
}));
vi.mock("@/lib/ticker-context/service", () => ({ researchTicker: service.researchTicker }));

import { GET } from "@/app/api/intelligence/ticker/route";

const request = (query = "") => new Request(`http://localhost/api/intelligence/ticker${query}`);

function contextFixture(): TickerResearchContext {
  return {
    version: TICKER_CONTEXT_VERSION,
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
        confidence: null,
        version: "alpaca-delayed-sip-v1",
      },
      identity: {
        available: true,
        asOf: null,
        freshness: "fresh",
        confidence: "high",
        version: "alpaca-assets-v1",
      },
      sector: {
        available: true,
        asOf: "2026-09-18T20:00:00.000Z",
        freshness: "delayed",
        confidence: null,
        version: "sp500-v1",
      },
      news: {
        available: true,
        asOf: null,
        freshness: "delayed",
        confidence: null,
        version: "alpaca-news-v1",
      },
      sec: {
        available: true,
        asOf: null,
        freshness: "delayed",
        confidence: null,
        version: "sec-edgar-submissions-v1",
      },
    },
    availability: {
      price: true,
      history: true,
      volume: true,
      volatility: true,
      sector: true,
      news: true,
      sec: true,
      corporateActions: true,
    },
    facts: [
      {
        id: "ticker.NVDA.identity",
        domain: "identity",
        text: "NVDA — NVIDIA Corporation (NASDAQ).",
        data: { symbol: "NVDA" },
        asOf: null,
        freshness: "fresh",
        confidence: "high",
        sourceVersion: "alpaca-assets-v1",
      },
      {
        id: "ticker.NVDA.price",
        domain: "price",
        text: "NVDA regular-session reference price 104 vs previous close 100.",
        data: { price: 104, previousClose: 100 },
        asOf: "2026-09-18T20:00:00.000Z",
        freshness: "delayed",
        confidence: "high",
        sourceVersion: "alpaca-delayed-sip-v1",
      },
    ],
    confidence: { score: 0.95, label: "high" },
    fingerprint: "a".repeat(64),
  };
}

beforeEach(() => {
  production.mode.mockClear();
  production.deps.mockClear();
  production.mode.mockReturnValue("live");
  production.deps.mockReturnValue({ marker: "fake-deps" } as never);
  service.researchTicker.mockReset();
});

describe("GET /api/intelligence/ticker (V1.2A)", () => {
  it("returns a safe evidence projection for a supported ticker", async () => {
    service.researchTicker.mockResolvedValue({ status: "ok", context: contextFixture() });
    const response = await GET(request("?symbol=%20nvda%20"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(service.researchTicker).toHaveBeenCalledWith("NVDA", { marker: "fake-deps" });
    const body = await response.json();
    expect(body).toMatchObject({
      mode: "live",
      status: "ok",
      symbol: "NVDA",
      context: { version: TICKER_CONTEXT_VERSION, factCount: 2 },
    });
    for (const fact of body.context.facts) expect(fact).not.toHaveProperty("data");
    expect(JSON.stringify(body)).not.toContain("previousClose");
  });

  it("maps unknown symbols to 404 and unsupported security types to 422", async () => {
    service.researchTicker.mockResolvedValue({
      status: "unsupported_symbol",
      requestedSymbol: "ZZZZ",
      symbol: null,
      reason: "unknown_symbol",
    });
    const unknown = await GET(request("?symbol=ZZZZ"));
    expect(unknown.status).toBe(404);
    expect((await unknown.json()).error.code).toBe("UNKNOWN_SYMBOL");

    service.researchTicker.mockResolvedValue({
      status: "unsupported_symbol",
      requestedSymbol: "BTCUSD",
      symbol: null,
      reason: "unsupported_security_type",
    });
    const unsupported = await GET(request("?symbol=BTCUSD"));
    expect(unsupported.status).toBe(422);
    expect((await unsupported.json()).error.code).toBe("UNSUPPORTED_SECURITY_TYPE");
  });

  it("rejects malformed queries without calling the service", async () => {
    for (const query of ["", "?symbol=", "?symbol=NV%20DA", "?symbol=NVDA&symbol=TSLA"]) {
      const response = await GET(request(query));
      expect(response.status).toBe(400);
      expect(["MALFORMED_QUERY", "INVALID_SYMBOL"]).toContain((await response.json()).error.code);
    }
    expect(service.researchTicker).not.toHaveBeenCalled();
  });

  it("passes through provider partial failure without fabrication", async () => {
    const context = contextFixture();
    context.status = "partial";
    context.availability = { ...context.availability, sec: false };
    context.sources.sec = {
      available: false,
      asOf: null,
      freshness: "unavailable",
      confidence: null,
      version: null,
    };
    service.researchTicker.mockResolvedValue({ status: "partial", context });
    const response = await GET(request("?symbol=NVDA"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("partial");
    expect(body.context.availability.sec).toBe(false);
  });

  it("returns 503 when every relevant provider fails", async () => {
    service.researchTicker.mockResolvedValue({
      status: "unavailable",
      requestedSymbol: "NVDA",
      symbol: null,
      reason: "provider_unavailable",
      mode: "live",
    });
    const response = await GET(request("?symbol=NVDA"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ status: "unavailable", reason: "provider_unavailable" });
  });

  it("never leaks provider errors or demo values when research throws", async () => {
    service.researchTicker.mockRejectedValue(new Error("boom secret-key-123"));
    const response = await GET(request("?symbol=NVDA"));
    expect(response.status).toBe(503);
    const text = JSON.stringify(await response.json());
    expect(text).not.toContain("secret-key-123");
    expect(text).not.toContain("boom");
    expect(text).not.toMatch(/demo/i);
  });

  it("reports live_data_required in demo mode without calling providers", async () => {
    production.mode.mockReturnValue("demo");
    const response = await GET(request("?symbol=NVDA"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({
      mode: "demo",
      status: "unavailable",
      reason: "live_data_required",
    });
    expect(service.researchTicker).not.toHaveBeenCalled();
    expect(production.deps).not.toHaveBeenCalled();
  });
});
