import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MacroOverview, MarketOverview, RegimeResult } from "@war-room/types";
import { GET } from "@/app/api/regime/overview/route";
import { MarketDataError } from "@/lib/market-data/errors";

vi.mock("@/lib/market-data/cache", () => ({
  getCachedOverview: vi.fn(),
}));
vi.mock("@/lib/macro-data/overview", () => ({
  buildMacroOverview: vi.fn(),
}));
vi.mock("@/lib/regime/client", () => ({
  evaluateRegime: vi.fn(),
}));

import { getCachedOverview } from "@/lib/market-data/cache";
import { buildMacroOverview } from "@/lib/macro-data/overview";
import { evaluateRegime } from "@/lib/regime/client";

const ENV_KEYS = [
  "MARKET_DATA_MODE",
  "MACRO_DATA_MODE",
  "REGIME_MODE",
  "ANALYTICS_BASE_URL",
  "ALPACA_API_KEY_ID",
  "ALPACA_API_SECRET_KEY",
  "FRED_API_KEY",
  "TWELVE_DATA_API_KEY",
];

function setEnv(overrides: Record<string, string>): void {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, overrides);
}

const cannedMarket: MarketOverview = {
  meta: {
    mode: "live",
    provider: "alpaca",
    feed: "iex",
    asOf: "2026-09-01T13:00:00Z",
    marketOpen: true,
    nextOpen: null,
    nextClose: null,
    stale: false,
  },
  indices: [
    {
      ticker: "SPY",
      name: "S&P 500 ETF",
      price: 560,
      changePct: -0.4,
      open: 562,
      high: 565,
      low: 559,
      surface: "sakura",
    },
  ],
  sectors: [
    {
      id: "XLK",
      sector: "Technology",
      etf: "XLK",
      dailyReturnPct: 0.4,
      relativeReturnPct: 0.8,
      signal: "Strong",
      tone: "positive",
      strength: 70,
    },
  ],
};

const cannedMacro: MacroOverview = {
  meta: { mode: "live", asOf: "2026-09-01T12:00:00Z", stale: false, providers: ["fred"] },
  signals: [
    {
      id: "vix",
      label: "VIX",
      value: 14.3,
      displayUnit: "index",
      change: -0.8,
      changePct: -5.3,
      interpretation: "Volatility Easing",
      tone: "positive",
      source: "FRED",
      frequency: "daily",
      asOf: "2026-08-28T00:00:00Z",
      stale: false,
      available: true,
    },
    {
      id: "us10y",
      label: "US 10Y",
      value: 4.77,
      displayUnit: "percent",
      change: 0.08,
      changePct: 1.7,
      interpretation: "Rate Pressure",
      tone: "warning",
      source: "FRED",
      frequency: "daily",
      asOf: "2026-08-28T00:00:00Z",
      stale: false,
      available: true,
    },
    {
      id: "usd_broad",
      label: "US Dollar",
      value: 118.75,
      displayUnit: "index",
      change: -0.28,
      changePct: -0.24,
      interpretation: "Dollar Softening",
      tone: "neutral",
      source: "FRED",
      frequency: "daily",
      asOf: "2026-08-28T00:00:00Z",
      stale: false,
      available: true,
    },
    {
      id: "wti",
      label: "WTI",
      value: 78.5,
      displayUnit: "price",
      change: 1.9,
      changePct: 2.5,
      interpretation: "Inflation Risk",
      tone: "negative",
      source: "FRED",
      frequency: "daily",
      asOf: "2026-08-28T00:00:00Z",
      stale: false,
      available: true,
    },
    {
      id: "gold",
      label: "Gold",
      value: 2438.1,
      displayUnit: "price",
      change: 21.75,
      changePct: 0.9,
      interpretation: "Safe-Haven Bid",
      tone: "positive",
      source: "Twelve Data",
      frequency: "intraday",
      asOf: "2026-09-01T11:00:00Z",
      stale: false,
      available: true,
    },
    {
      id: "btc",
      label: "BTC",
      value: 62000,
      displayUnit: "price",
      change: 850,
      changePct: 1.4,
      interpretation: "Risk Appetite",
      tone: "positive",
      source: "Alpaca",
      frequency: "realtime",
      asOf: "2026-09-01T12:00:00Z",
      stale: false,
      available: true,
    },
  ],
};

const cannedResult: RegimeResult = {
  score: 41.8,
  displayScore: 42,
  label: "CAUTIOUS / NEUTRAL",
  coverage: 0.9,
  confidence: "high",
  components: [
    { id: "equity", name: "Equity Tape", score: 40, weight: 0.3 },
    { id: "sectors", name: "Sector Participation", score: 55, weight: 0.2 },
    { id: "volatility", name: "Volatility", score: 70, weight: 0.15 },
    { id: "rates", name: "Rates", score: 35, weight: 0.15 },
    { id: "macro", name: "Macro Pressure", score: 40, weight: 0.15 },
    { id: "crypto", name: "Crypto Risk Appetite", score: 60, weight: 0.05 },
  ],
  positiveDrivers: [
    { id: "vix", name: "VIX", direction: "positive", impact: 3, reason: "VIX fell 5.3% to 14.3" },
  ],
  negativeDrivers: [
    {
      id: "us10y",
      name: "US 10Y",
      direction: "negative",
      impact: -2.3,
      reason: "US 10Y rose 8 bp",
    },
  ],
  staleInputs: [],
  missingInputs: [],
  asOf: "2026-09-01T13:00:00Z",
  engineVersion: "regime-v1",
};

beforeEach(() => {
  vi.mocked(getCachedOverview).mockResolvedValue(cannedMarket);
  vi.mocked(buildMacroOverview).mockResolvedValue(cannedMacro);
  vi.mocked(evaluateRegime).mockResolvedValue(cannedResult);
});

afterEach(() => {
  setEnv({});
  vi.clearAllMocks();
});

describe("GET /api/regime/overview", () => {
  it("returns the deterministic demo fixture in demo mode (no analytics call)", async () => {
    setEnv({ REGIME_MODE: "demo", MARKET_DATA_MODE: "demo", MACRO_DATA_MODE: "demo" });
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mode).toBe("demo");
    expect(body.result.engineVersion).toBe("regime-v1");
    expect(body.result.score).toBe(42);
    expect(evaluateRegime).not.toHaveBeenCalled();
  });

  it("returns 503 CONFIG when REGIME_MODE=live but underlying data is not live", async () => {
    setEnv({ REGIME_MODE: "live", MARKET_DATA_MODE: "demo", MACRO_DATA_MODE: "demo" });
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("CONFIG");
    expect(evaluateRegime).not.toHaveBeenCalled();
  });

  it("returns a normalized live result and never leaks credentials or raw shapes", async () => {
    setEnv({
      REGIME_MODE: "live",
      MARKET_DATA_MODE: "live",
      MACRO_DATA_MODE: "live",
      ALPACA_API_KEY_ID: "pk_regime_secret",
      ALPACA_API_SECRET_KEY: "sk_regime_secret",
      FRED_API_KEY: "fred_regime_secret",
      TWELVE_DATA_API_KEY: "twelve_regime_secret",
    });
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mode).toBe("live");
    expect(body.result.engineVersion).toBe("regime-v1");
    expect(body.result.displayScore).toBe(42);
    expect(body.result.components).toHaveLength(6);

    const text = JSON.stringify(body);
    expect(text).not.toContain("pk_regime_secret");
    expect(text).not.toContain("sk_regime_secret");
    expect(text).not.toContain("fred_regime_secret");
    expect(text).not.toContain("twelve_regime_secret");
    expect(text).not.toContain("previous_close");
    expect(text).not.toContain("observations");
  });

  it("maps an analytics timeout to 502 (short engine timeout enforced)", async () => {
    setEnv({
      REGIME_MODE: "live",
      MARKET_DATA_MODE: "live",
      MACRO_DATA_MODE: "live",
      ALPACA_API_KEY_ID: "pk_d",
      ALPACA_API_SECRET_KEY: "sk_d",
      FRED_API_KEY: "fred_d",
      TWELVE_DATA_API_KEY: "twelve_d",
    });
    vi.mocked(evaluateRegime).mockRejectedValue(
      new MarketDataError(
        "timeout",
        "timeout while reaching the regime engine",
        undefined,
        "regime",
      ),
    );
    const response = await GET();
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.code).toBe("UPSTREAM");
  });

  it("maps an analytics failure to 502 without a demo fallback", async () => {
    setEnv({
      REGIME_MODE: "live",
      MARKET_DATA_MODE: "live",
      MACRO_DATA_MODE: "live",
      ALPACA_API_KEY_ID: "pk_d",
      ALPACA_API_SECRET_KEY: "sk_d",
      FRED_API_KEY: "fred_d",
      TWELVE_DATA_API_KEY: "twelve_d",
    });
    vi.mocked(evaluateRegime).mockRejectedValue(
      new MarketDataError("server", "Regime engine returned 500", 500, "regime"),
    );
    const response = await GET();
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.code).toBe("UPSTREAM");
    expect(JSON.stringify(body)).not.toContain("regime-v1");
  });
});
