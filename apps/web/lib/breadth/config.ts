import "server-only";
import type { MarketDataMode } from "@war-room/types";
import { getMarketDataConfig } from "@/lib/market-data/config";

/**
 * Breadth configuration (server-side).
 *
 * BREADTH_MODE (demo | live, default demo). Live mode uses the Alpaca
 * credentials already owned by the Phase 1 market data config — credentials
 * are never duplicated here and never exposed to the browser.
 */
export interface BreadthDataConfig {
  mode: MarketDataMode;
  apiKeyId: string | null;
  apiSecretKey: string | null;
  dataBaseUrl: string;
  tradingBaseUrl: string;
  timeoutMs: number;
}

/** Reads configuration fresh on every call (no module cache) — test friendly. */
export function getBreadthDataConfig(): BreadthDataConfig {
  const market = getMarketDataConfig();
  return {
    mode: process.env.BREADTH_MODE === "live" ? "live" : "demo",
    apiKeyId: market.apiKeyId,
    apiSecretKey: market.apiSecretKey,
    dataBaseUrl: market.dataBaseUrl,
    tradingBaseUrl: market.tradingBaseUrl,
    timeoutMs: market.timeoutMs,
  };
}
