import type { BreadthCredentials } from "@/lib/breadth/provider";
import { getMarketDataConfig } from "@/lib/market-data/config";

export const CATALYST_CANDIDATE_CAP = 12;
export const TTL = { news: 60_000, sec: 600_000, corporateActions: 600_000, result: 60_000 };

export function catalystMode(): "demo" | "live" {
  return process.env.CATALYSTS_MODE === "live" ? "live" : "demo";
}

export function anomaliesEnabled(): boolean {
  return process.env.ANOMALIES_MODE === "live";
}

export function secUserAgent(): string {
  return process.env.SEC_USER_AGENT?.trim() ?? "";
}

export function liveCredentials(): BreadthCredentials {
  const market = getMarketDataConfig();
  if (market.mode !== "live" || !market.apiKeyId || !market.apiSecretKey) {
    throw new Error("CATALYSTS_MODE=live requires live Alpaca market data credentials");
  }
  return {
    apiKeyId: market.apiKeyId,
    apiSecretKey: market.apiSecretKey,
    dataBaseUrl: market.dataBaseUrl,
    tradingBaseUrl: market.tradingBaseUrl,
    timeoutMs: market.timeoutMs,
  };
}
