import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/anomalies/overview/route";
import { MarketDataError } from "@/lib/market-data/errors";
import type { AnomalyOverview } from "@/lib/anomalies/types";

vi.mock("@/lib/anomalies/overview", () => ({
  buildLiveAnomaliesOverview: vi.fn(),
}));
import { buildLiveAnomaliesOverview } from "@/lib/anomalies/overview";

const ENV_KEYS = [
  "ANOMALIES_MODE",
  "MARKET_DATA_MODE",
  "ALPACA_API_KEY_ID",
  "ALPACA_API_SECRET_KEY",
];
function setEnv(overrides: Record<string, string>): void {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, overrides);
}

const req = (query = "") => new Request(`http://localhost/api/anomalies/overview${query}`);

const cannedOverview: AnomalyOverview = {
  mode: "live",
  engineVersion: "anomaly-v1",
  universe: { name: "S&P 500", version: "sp500-v1", asOf: "2026-09-05", count: 503 },
  meta: {
    provider: "alpaca",
    feed: "delayed_sip",
    delayMinutes: 15,
    asOf: "2026-09-05T13:00:00Z",
    marketOpen: false,
    stale: false,
  },
  universeCount: 503,
  eligibleCount: 500,
  scoredCount: 500,
  coveragePct: 500 / 503,
  confidence: "high",
  topOverall: [],
  topPositive: [],
  topNegative: [],
  asOf: "2026-09-05T13:00:00Z",
};

beforeEach(() => {
  vi.mocked(buildLiveAnomaliesOverview).mockResolvedValue(cannedOverview);
});
afterEach(() => {
  setEnv({});
  vi.clearAllMocks();
});

describe("GET /api/anomalies/overview", () => {
  it("returns the demo fixture without provider calls in demo mode", async () => {
    setEnv({ ANOMALIES_MODE: "demo" });
    const response = await GET(req());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mode).toBe("demo");
    expect(body.engineVersion).toBe("anomaly-v1");
    expect(buildLiveAnomaliesOverview).not.toHaveBeenCalled();
  });

  it("returns a normalized live scanner overview", async () => {
    setEnv({
      ANOMALIES_MODE: "live",
      MARKET_DATA_MODE: "live",
      ALPACA_API_KEY_ID: "pk_a",
      ALPACA_API_SECRET_KEY: "sk_a",
    });
    const response = await GET(req());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mode).toBe("live");
    expect(body.engineVersion).toBe("anomaly-v1");
    expect(body.meta.feed).toBe("delayed_sip");
    expect(body.meta.delayMinutes).toBe(15);
    expect(JSON.stringify(body)).not.toContain("pk_a");
    expect(JSON.stringify(body)).not.toContain("sk_a");
  });

  it("maps config failures to 503", async () => {
    setEnv({ ANOMALIES_MODE: "live", MARKET_DATA_MODE: "live" });
    vi.mocked(buildLiveAnomaliesOverview).mockRejectedValue(
      new MarketDataError(
        "config",
        "ANOMALIES_MODE=live requires live market data",
        503,
        "anomalies",
      ),
    );
    const response = await GET(req());
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("CONFIG");
  });

  it("maps upstream failures to 502 without a demo fallback", async () => {
    setEnv({
      ANOMALIES_MODE: "live",
      MARKET_DATA_MODE: "live",
      ALPACA_API_KEY_ID: "pk_d",
      ALPACA_API_SECRET_KEY: "sk_d",
    });
    vi.mocked(buildLiveAnomaliesOverview).mockRejectedValue(
      new MarketDataError("server", "Alpaca upstream error", 500),
    );
    const response = await GET(req());
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.code).toBe("UPSTREAM");
    expect(JSON.stringify(body)).not.toContain("anomaly-v1");
  });

  it("defaults a missing universe to sp500 without changing the response contract", async () => {
    setEnv({
      ANOMALIES_MODE: "live",
      MARKET_DATA_MODE: "live",
      ALPACA_API_KEY_ID: "pk_a",
      ALPACA_API_SECRET_KEY: "sk_a",
    });
    const response = await GET(req());
    expect(response.status).toBe(200);
    expect(buildLiveAnomaliesOverview).toHaveBeenCalledWith("sp500");
    const body = await response.json();
    // Legacy canned payload (no id/label) is preserved untouched.
    expect(body.universe).toEqual(cannedOverview.universe);
    expect(body.engineVersion).toBe("anomaly-v1");
  });

  it("accepts an explicit sp500 or nasdaq100 universe", async () => {
    setEnv({
      ANOMALIES_MODE: "live",
      MARKET_DATA_MODE: "live",
      ALPACA_API_KEY_ID: "pk_a",
      ALPACA_API_SECRET_KEY: "sk_a",
    });
    const sp500 = await GET(req("?universe=sp500"));
    expect(sp500.status).toBe(200);
    expect(buildLiveAnomaliesOverview).toHaveBeenLastCalledWith("sp500");
    const nasdaq = await GET(req("?universe=nasdaq100"));
    expect(nasdaq.status).toBe(200);
    expect(buildLiveAnomaliesOverview).toHaveBeenLastCalledWith("nasdaq100");
  });

  it("rejects an explicit unsupported universe with a safe 400 — never silently sp500", async () => {
    setEnv({
      ANOMALIES_MODE: "live",
      MARKET_DATA_MODE: "live",
      ALPACA_API_KEY_ID: "pk_a",
      ALPACA_API_SECRET_KEY: "sk_a",
    });
    for (const query of ["?universe=russell2000", "?universe=", "?universe=SP500"]) {
      const response = await GET(req(query));
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe("INVALID_UNIVERSE");
      expect(JSON.stringify(body)).not.toContain("pk_a");
    }
    expect(buildLiveAnomaliesOverview).not.toHaveBeenCalled();
  });

  it("serves universe-aware demo fixtures without provider calls", async () => {
    setEnv({ ANOMALIES_MODE: "demo" });
    const sp500 = await (await GET(req())).json();
    expect(sp500).toMatchObject({
      mode: "demo",
      engineVersion: "anomaly-v1",
      universe: { id: "sp500", label: "S&P 500", version: "sp500-v1", count: 503 },
    });
    expect(sp500.universeCount).toBe(503);

    const nasdaq = await (await GET(req("?universe=nasdaq100"))).json();
    expect(nasdaq).toMatchObject({
      mode: "demo",
      engineVersion: "anomaly-v1",
      universe: { id: "nasdaq100", label: "Nasdaq 100", version: "nasdaq100-v1", count: 101 },
    });
    expect(nasdaq.universeCount).toBe(101);
    const nasdaqSymbols = new Set<string>(
      (await import("@/lib/anomalies/universe/nasdaq100")).nasdaq100AnomalyUniverse.symbols,
    );
    for (const candidate of nasdaq.topOverall)
      expect(nasdaqSymbols.has(candidate.ticker)).toBe(true);
    expect(buildLiveAnomaliesOverview).not.toHaveBeenCalled();
  });
});
