import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/breadth/overview/route";
import { MarketDataError } from "@/lib/market-data/errors";
import { resetBreadthCachesForTests } from "@/lib/breadth/overview";
import { getUniverseTickers } from "@/lib/breadth/symbols";

vi.mock("@/lib/breadth/provider", () => ({
  fetchAllSnapshots: vi.fn(),
  fetchMarketClock: vi.fn(),
  fetchAllDailyBars: vi.fn(),
}));

import { fetchAllDailyBars, fetchAllSnapshots, fetchMarketClock } from "@/lib/breadth/provider";

const ENV_KEYS = ["BREADTH_MODE", "ALPACA_API_KEY_ID", "ALPACA_API_SECRET_KEY", "MARKET_DATA_MODE"];

function setEnv(overrides: Record<string, string>): void {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, overrides);
}

/** Deterministic canned breadth dataset across the full universe. */
function buildCannedDataset() {
  const tickers = getUniverseTickers();
  const snapshots: Record<
    string,
    {
      dailyBar: { t: string; c: number; h: number; l: number };
      prevDailyBar: { t: string; c: number };
      latestTrade: { t: string; p: number };
    }
  > = {};
  const bars = new Map<string, Array<{ t: string; c: number; h: number; l: number; v: number }>>();
  const now = Date.now();

  const bucket = (index: number) => {
    if (index % 10 < 6) return 101.2; // advancer
    if (index % 10 < 8) return 99.0; // decliner
    return 100.0; // unchanged
  };

  tickers.forEach((ticker, index) => {
    const price = bucket(index);
    snapshots[ticker] = {
      dailyBar: { t: new Date(now).toISOString(), c: price, h: price + 1, l: price - 1 },
      prevDailyBar: { t: new Date(now - 86_400_000).toISOString(), c: 100 },
      latestTrade: { t: new Date(now).toISOString(), p: price },
    };
    const symbolBars: Array<{ t: string; c: number; h: number; l: number; v: number }> = [];
    for (let j = 1; j <= 55; j += 1) {
      const close = 50 + j * 0.2; // history stays well below current prices
      symbolBars.push({
        t: new Date(now - j * 86_400_000).toISOString(),
        c: close,
        h: close + 0.2,
        l: close - 0.2,
        v: 1000,
      });
    }
    bars.set(ticker, symbolBars);
  });

  // Benchmark SPY is up for participation classification.
  snapshots["SPY"] = {
    dailyBar: { t: new Date(now).toISOString(), c: 505, h: 506, l: 499 },
    prevDailyBar: { t: new Date(now - 86_400_000).toISOString(), c: 500 },
    latestTrade: { t: new Date(now).toISOString(), p: 505 },
  };

  return { snapshots, bars };
}

const canned = buildCannedDataset();

beforeEach(() => {
  resetBreadthCachesForTests();
  vi.mocked(fetchMarketClock).mockResolvedValue({
    isOpen: true,
    timestamp: new Date().toISOString(),
  });
  vi.mocked(fetchAllSnapshots).mockResolvedValue(canned.snapshots);
  vi.mocked(fetchAllDailyBars).mockResolvedValue(canned.bars);
});

afterEach(() => {
  setEnv({});
  vi.clearAllMocks();
});

describe("GET /api/breadth/overview", () => {
  it("returns the demo fixture in demo mode without provider calls", async () => {
    setEnv({ BREADTH_MODE: "demo", MARKET_DATA_MODE: "demo" });
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mode).toBe("demo");
    expect(body.engineVersion).toBe("breadth-v1");
    expect(fetchAllSnapshots).not.toHaveBeenCalled();
  });

  it("returns 503 CONFIG in live mode without Alpaca credentials", async () => {
    setEnv({ BREADTH_MODE: "live", MARKET_DATA_MODE: "live" });
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("CONFIG");
    expect(fetchAllSnapshots).not.toHaveBeenCalled();
  });

  it("returns a live delayed-SIP breadth overview and never leaks credentials", async () => {
    setEnv({
      BREADTH_MODE: "live",
      MARKET_DATA_MODE: "live",
      ALPACA_API_KEY_ID: "pk_breadth_secret",
      ALPACA_API_SECRET_KEY: "sk_breadth_secret",
    });
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mode).toBe("live");
    expect(body.engineVersion).toBe("breadth-v1");
    expect(body.universe.version).toBe("sp500-v1");
    expect(body.universe.count).toBe(503);
    expect(body.meta.feed).toBe("delayed_sip");
    expect(body.meta.delayMinutes).toBe(15);
    expect(body.metrics.universeCount).toBe(503);
    expect(body.metrics.currentCoverageCount).toBe(503);
    expect(body.metrics.advancers).toBeGreaterThan(body.metrics.decliners);
    expect(body.confidence).toBe("high");
    expect(typeof body.score).toBe("number");
    expect(body.metrics.newHighs20).toBeGreaterThan(0);

    const text = JSON.stringify(body);
    expect(text).not.toContain("pk_breadth_secret");
    expect(text).not.toContain("sk_breadth_secret");
    expect(text).not.toContain("APCA-API");
    expect(text).not.toContain("dailyBar");
    expect(text).not.toContain("latestTrade");
  });

  it("maps provider failures to 502 without a demo fallback", async () => {
    setEnv({
      BREADTH_MODE: "live",
      MARKET_DATA_MODE: "live",
      ALPACA_API_KEY_ID: "pk_d",
      ALPACA_API_SECRET_KEY: "sk_d",
    });
    vi.mocked(fetchAllSnapshots).mockRejectedValue(
      new MarketDataError("rate_limit", "Alpaca rate limit exceeded", 429),
    );
    const response = await GET();
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.code).toBe("UPSTREAM");
    expect(JSON.stringify(body)).not.toContain("breadth-v1");
  });
});
