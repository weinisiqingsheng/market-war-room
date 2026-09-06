import { afterEach, describe, expect, it } from "vitest";
import { getMarketDataConfig } from "@/lib/market-data/config";

const ENV_KEYS = [
  "MARKET_DATA_MODE",
  "ALPACA_DATA_FEED",
  "ALPACA_API_KEY_ID",
  "ALPACA_API_SECRET_KEY",
  "ALPACA_DATA_BASE_URL",
  "ALPACA_TRADING_BASE_URL",
  "MARKET_DATA_TIMEOUT_MS",
  "MARKET_DATA_STALE_AFTER_MS",
];

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("getMarketDataConfig", () => {
  it("defaults to demo mode with the IEX feed", () => {
    const cfg = getMarketDataConfig();
    expect(cfg.mode).toBe("demo");
    expect(cfg.feed).toBe("iex");
  });

  it("accepts live mode", () => {
    process.env.MARKET_DATA_MODE = "live";
    expect(getMarketDataConfig().mode).toBe("live");
  });

  it("reads credentials from the server environment", () => {
    process.env.MARKET_DATA_MODE = "live";
    process.env.ALPACA_API_KEY_ID = "pk_test_123";
    process.env.ALPACA_API_SECRET_KEY = "sk_test_456";
    const cfg = getMarketDataConfig();
    expect(cfg.apiKeyId).toBe("pk_test_123");
    expect(cfg.apiSecretKey).toBe("sk_test_456");
  });

  it("applies sensible defaults for numeric tuning", () => {
    const cfg = getMarketDataConfig();
    expect(cfg.timeoutMs).toBe(8000);
    expect(cfg.staleThresholdMs).toBe(120000);
  });
});
