import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketOverview } from "@war-room/types";
import { GET } from "@/app/api/market/overview/route";
import { getCachedOverview } from "@/lib/market-data/cache";

vi.mock("@/lib/market-data/cache", () => ({
  getCachedOverview: vi.fn(),
}));

const ENV_KEYS = [
  "MARKET_DATA_MODE",
  "ALPACA_DATA_FEED",
  "ALPACA_API_KEY_ID",
  "ALPACA_API_SECRET_KEY",
  "ALPACA_DATA_BASE_URL",
  "ALPACA_TRADING_BASE_URL",
];

function setEnv(overrides: Record<string, string>): void {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, overrides);
}

const fixtureOverview: MarketOverview = {
  meta: {
    mode: "live",
    provider: "alpaca",
    feed: "iex",
    asOf: "2026-08-31T14:30:00Z",
    marketOpen: true,
    nextOpen: "2026-09-01T13:30:00Z",
    nextClose: "2026-08-31T20:00:00Z",
    stale: false,
  },
  indices: [
    {
      ticker: "SPY",
      name: "S&P 500 ETF",
      price: 563.24,
      changePct: -0.24,
      open: 565.1,
      high: 566.2,
      low: 560.4,
      surface: "sakura",
    },
  ],
  sectors: [
    {
      id: "XLE",
      sector: "Energy",
      etf: "XLE",
      dailyReturnPct: 2.1,
      relativeReturnPct: 2.34,
      signal: "Leader",
      tone: "positive",
      strength: 73,
    },
  ],
};

describe("GET /api/market/overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    setEnv({});
  });

  it("returns demo overview in demo mode without credentials", async () => {
    setEnv({ MARKET_DATA_MODE: "demo" });
    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as MarketOverview;
    expect(body.meta.mode).toBe("demo");
    expect(body.meta.provider).toBe("demo");
    expect(body.indices).toHaveLength(4);
    expect(body.sectors.length).toBeGreaterThan(0);
  });

  it("rejects live mode without credentials (503, config error)", async () => {
    setEnv({ MARKET_DATA_MODE: "live" });
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("CONFIG");
    expect(body.error.message).toMatch(/not configured/i);
  });

  it("returns normalized live overview with credentials and cached provider data", async () => {
    setEnv({
      MARKET_DATA_MODE: "live",
      ALPACA_API_KEY_ID: "pk_demo_111",
      ALPACA_API_SECRET_KEY: "sk_demo_222",
    });
    vi.mocked(getCachedOverview).mockResolvedValue(fixtureOverview);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as MarketOverview;
    expect(body.meta.mode).toBe("live");
    expect(body.meta.feed).toBe("iex");
    expect(body.indices[0]?.ticker).toBe("SPY");
    expect(body.sectors[0]?.signal).toBe("Leader");
  });

  it("never returns credentials or raw provider payloads in the response", async () => {
    setEnv({
      MARKET_DATA_MODE: "live",
      ALPACA_API_KEY_ID: "pk_demo_111",
      ALPACA_API_SECRET_KEY: "sk_demo_222",
    });
    vi.mocked(getCachedOverview).mockResolvedValue(fixtureOverview);

    const response = await GET();
    const text = await response.text();
    expect(text).not.toContain("pk_demo_111");
    expect(text).not.toContain("sk_demo_222");
    expect(text).not.toContain("APCA-API-KEY-ID");
    expect(text).not.toContain("APCA-API-SECRET-KEY");
    expect(text).not.toContain("ALPACA_API");
    expect(text).not.toContain("latestTrade"); // raw Alpaca shape must not leak
  });

  it("maps upstream failures to a safe 502 response", async () => {
    setEnv({
      MARKET_DATA_MODE: "live",
      ALPACA_API_KEY_ID: "pk_demo_111",
      ALPACA_API_SECRET_KEY: "sk_demo_222",
    });
    vi.mocked(getCachedOverview).mockRejectedValue(
      new Error("upstream exploded with secrets inside"),
    );

    const response = await GET();
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.code).toBe("UPSTREAM");
    expect(body.error.message).not.toContain("secrets");
    expect(JSON.stringify(body)).not.toContain("pk_demo_111");
  });
});
