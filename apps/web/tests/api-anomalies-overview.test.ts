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
    const response = await GET();
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
    const response = await GET();
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
    const response = await GET();
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
    const response = await GET();
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.code).toBe("UPSTREAM");
    expect(JSON.stringify(body)).not.toContain("anomaly-v1");
  });
});
