import { describe, expect, it } from "vitest";
import {
  createAlpacaProvider,
  type AlpacaProviderOptions,
} from "@/lib/market-data/providers/alpaca";
import { MarketDataError } from "@/lib/market-data/errors";

function makeOptions(overrides: Partial<AlpacaProviderOptions> = {}): AlpacaProviderOptions {
  return {
    apiKeyId: "key",
    apiSecretKey: "secret",
    feed: "iex",
    dataBaseUrl: "https://data.test",
    tradingBaseUrl: "https://trade.test",
    timeoutMs: 200,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createAlpacaProvider error handling", () => {
  it("throws an auth error on 401", async () => {
    const provider = createAlpacaProvider(
      makeOptions({ fetchImpl: async () => jsonResponse({ message: "nope" }, 401) }),
    );
    await expect(provider.getSnapshots(["SPY"])).rejects.toMatchObject({
      category: "auth",
      status: 401,
    });
  });

  it("throws a rate_limit error on 429", async () => {
    const provider = createAlpacaProvider(
      makeOptions({ fetchImpl: async () => jsonResponse({ message: "slow down" }, 429) }),
    );
    await expect(provider.getSnapshots(["SPY"])).rejects.toMatchObject({
      category: "rate_limit",
      status: 429,
    });
  });

  it("throws a server error on 500", async () => {
    const provider = createAlpacaProvider(
      makeOptions({ fetchImpl: async () => jsonResponse({ message: "boom" }, 500) }),
    );
    await expect(provider.getSnapshots(["SPY"])).rejects.toMatchObject({
      category: "server",
      status: 500,
    });
  });

  it("throws a timeout error when the upstream does not respond in time", async () => {
    const provider = createAlpacaProvider(
      makeOptions({
        timeoutMs: 30,
        fetchImpl: (_url, init) =>
          new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
            });
          }),
      }),
    );
    await expect(provider.getSnapshots(["SPY"])).rejects.toMatchObject({ category: "timeout" });
  });

  it("throws a network error when fetch rejects", async () => {
    const provider = createAlpacaProvider(
      makeOptions({
        fetchImpl: async () => {
          throw new Error("ECONNREFUSED");
        },
      }),
    );
    await expect(provider.getSnapshots(["SPY"])).rejects.toMatchObject({ category: "network" });
  });

  it("throws a malformed error on invalid JSON", async () => {
    const provider = createAlpacaProvider(
      makeOptions({
        fetchImpl: async () => new Response("<html>not json</html>", { status: 200 }),
      }),
    );
    await expect(provider.getSnapshots(["SPY"])).rejects.toMatchObject({ category: "malformed" });
  });

  it("normalizes a full snapshot response and returns one entry per symbol", async () => {
    const provider = createAlpacaProvider(
      makeOptions({
        fetchImpl: async () =>
          jsonResponse({
            SPY: {
              latestTrade: { t: "2026-08-31T14:30:00Z", p: 100.5, s: 1 },
              prevDailyBar: { c: 98.5 },
            },
            QQQ: null,
          }),
      }),
    );
    const map = await provider.getSnapshots(["SPY", "QQQ"]);
    expect(map.SPY.available).toBe(true);
    expect(map.SPY.price).toBe(100.5);
    expect(map.SPY.changePct).toBeCloseTo(((100.5 - 98.5) / 98.5) * 100, 5);
    expect(map.QQQ.available).toBe(false);
  });

  it("throws a typed MarketDataError instance", async () => {
    const provider = createAlpacaProvider(
      makeOptions({ fetchImpl: async () => jsonResponse({}, 429) }),
    );
    try {
      await provider.getSnapshots(["SPY"]);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MarketDataError);
    }
  });
});
