import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketDataProvider, MarketSnapshotMap } from "@war-room/types";
import type { MarketDataConfig } from "@/lib/market-data/config";
import { getMarketDataProvider } from "@/lib/market-data/provider";
import { buildLiveOverview } from "@/lib/market-data/overview";

vi.mock("@/lib/market-data/provider", () => ({
  getMarketDataProvider: vi.fn(),
}));

let providerOverride: MarketDataProvider;

beforeEach(() => {
  providerOverride = makeProvider({});
});

async function runOverview(cfg: MarketDataConfig, provider?: MarketDataProvider) {
  vi.mocked(getMarketDataProvider).mockReturnValue(provider ?? providerOverride);
  return buildLiveOverview(cfg);
}

function config(overrides: Partial<MarketDataConfig> = {}): MarketDataConfig {
  return {
    mode: "live",
    feed: "iex",
    dataBaseUrl: "https://data.test",
    tradingBaseUrl: "https://trade.test",
    apiKeyId: "key",
    apiSecretKey: "secret",
    timeoutMs: 200,
    staleThresholdMs: 120_000,
    ...overrides,
  };
}

function snapshot(
  symbol: string,
  changePct: number | null,
  opts: { price?: number; t?: string } = {},
) {
  return {
    symbol,
    price: opts.price ?? 100,
    previousClose: opts.price !== undefined ? opts.price / (1 + (changePct ?? 0) / 100) : 100,
    open: 99,
    high: 102,
    low: 98,
    change: 1,
    changePct,
    volume: 1000,
    // Fresh by default so open-market data is not classified stale in tests.
    timestamp: opts.t ?? new Date(Date.now() - 60_000).toISOString(),
    source: "latest_trade" as const,
    feed: "iex" as const,
    stale: false,
    available: changePct !== null,
  };
}

function makeProvider(snapshots: MarketSnapshotMap): MarketDataProvider {
  return {
    async getSnapshots() {
      return snapshots;
    },
    async getMarketClock() {
      return {
        marketOpen: true,
        nextOpen: "2026-09-01T13:30:00Z",
        nextClose: "2026-08-31T20:00:00Z",
      };
    },
  };
}

describe("buildLiveOverview", () => {
  it("builds indices for the full Market Pulse universe", async () => {
    const snapshots: MarketSnapshotMap = {};
    for (const symbol of ["SPY", "QQQ", "IWM", "DIA"]) {
      snapshots[symbol] = snapshot(symbol, -0.24);
    }
    const overview = await runOverview(config(), makeProvider(snapshots));
    expect(overview.indices.map((index) => index.ticker)).toEqual(["SPY", "QQQ", "IWM", "DIA"]);
    expect(overview.indices[0]?.changePct).toBe(-0.24);
  });

  it("does not crash when one ticker is missing — it renders an unavailable card", async () => {
    const snapshots: MarketSnapshotMap = {
      SPY: snapshot("SPY", -0.24),
      QQQ: snapshot("QQQ", -0.31),
      IWM: snapshot("IWM", -0.18),
      // DIA missing entirely
    };
    const overview = await runOverview(config(), makeProvider(snapshots));
    const dia = overview.indices.find((index) => index.ticker === "DIA");
    expect(dia?.price).toBeNull();
    expect(dia?.changePct).toBeNull();
    expect(overview.indices).toHaveLength(4);
  });

  it("computes sector relative returns against SPY and ranks descending", async () => {
    const snapshots: MarketSnapshotMap = {
      SPY: snapshot("SPY", -0.24),
      XLE: snapshot("XLE", 2.1),
      XLK: snapshot("XLK", -0.44),
      XLU: snapshot("XLU", -0.72),
      XLF: snapshot("XLF", 0.62),
    };
    const overview = await runOverview(config(), makeProvider(snapshots));
    const sectors = overview.sectors;
    expect(sectors).toHaveLength(11); // universe always present, unavailable when missing
    expect(sectors[0]?.relativeReturnPct).toBeCloseTo(2.34, 5);
    expect(sectors[0]?.etf).toBe("XLE");
    const relativeReturns = sectors.map((s) => s.relativeReturnPct);
    expect(relativeReturns[0]).toBe(
      Math.max(...relativeReturns.filter((v): v is number => v !== null)),
    );
  });

  it("marks missing sector symbols unavailable with a neutral signal", async () => {
    const snapshots: MarketSnapshotMap = {
      SPY: snapshot("SPY", -0.24),
      XLE: snapshot("XLE", 2.1),
    };
    const overview = await runOverview(config(), makeProvider(snapshots));
    const tech = overview.sectors.find((s) => s.etf === "XLK");
    expect(tech?.dailyReturnPct).toBeNull();
    expect(tech?.relativeReturnPct).toBeNull();
    expect(tech?.signal).toBe("Unavailable");
    expect(tech?.tone).toBe("neutral");
  });

  it("sets meta feed, market state and freshness from provider + clock", async () => {
    const freshTimestamp = new Date(Date.now() - 30_000).toISOString();
    const snapshots: MarketSnapshotMap = {
      SPY: snapshot("SPY", -0.24, { t: freshTimestamp }),
    };
    const overview = await runOverview(config(), makeProvider(snapshots));
    expect(overview.meta).toMatchObject({
      mode: "live",
      provider: "alpaca",
      feed: "iex",
      marketOpen: true,
      stale: false,
    });
    expect(overview.meta.asOf).toBe(freshTimestamp);
    expect(overview.meta.nextOpen).toBe("2026-09-01T13:30:00Z");
  });
});
