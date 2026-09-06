import "server-only";
import type { MarketDataProvider } from "@war-room/types";
import type { MarketDataConfig } from "./config";
import { MarketDataError } from "./errors";
import { createAlpacaProvider } from "./providers/alpaca";

/**
 * Provider factory. Components never see providers — they consume normalized
 * domain data from `GET /api/market/overview`. This boundary is the only place
 * the app couples to a specific data source.
 */
export function getMarketDataProvider(config: MarketDataConfig): MarketDataProvider {
  if (config.mode === "demo") {
    return new DemoMarketDataProvider();
  }
  if (!config.apiKeyId || !config.apiSecretKey) {
    throw new MarketDataError(
      "config",
      "ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY are not configured",
      503,
    );
  }
  return createAlpacaProvider({
    apiKeyId: config.apiKeyId,
    apiSecretKey: config.apiSecretKey,
    feed: config.feed,
    dataBaseUrl: config.dataBaseUrl,
    tradingBaseUrl: config.tradingBaseUrl,
    timeoutMs: config.timeoutMs,
  });
}

/** No-op provider for demo mode — the demo path never fetches upstream. */
class DemoMarketDataProvider implements MarketDataProvider {
  async getSnapshots(): Promise<never> {
    throw new MarketDataError("config", "Demo mode does not fetch market data", 503);
  }

  async getMarketClock() {
    return { marketOpen: null, nextOpen: null, nextClose: null };
  }
}
