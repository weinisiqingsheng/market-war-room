import "server-only";
import type { MarketDataMode, MarketFeed } from "@war-room/types";

/**
 * Server-side market-data configuration.
 *
 * Credentials are read from `process.env` ONLY here and only ever used inside
 * server code (route handlers). They are never exposed via NEXT_PUBLIC_ and
 * never serialized into API responses.
 */
export interface MarketDataConfig {
  mode: MarketDataMode;
  feed: MarketFeed;
  dataBaseUrl: string;
  tradingBaseUrl: string;
  apiKeyId: string | null;
  apiSecretKey: string | null;
  timeoutMs: number;
  staleThresholdMs: number;
}

const DEFAULT_DATA_BASE_URL = "https://data.alpaca.markets";
const DEFAULT_TRADING_BASE_URL = "https://paper-api.alpaca.markets";
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_STALE_AFTER_MS = 120_000;

function toMode(raw: string | undefined): MarketDataMode {
  return raw === "live" ? "live" : "demo";
}

function toFeed(raw: string | undefined): MarketFeed {
  const value = (raw ?? "iex").toLowerCase();
  if (value === "sip") return "sip";
  if (value === "delayed_sip") return "delayed_sip";
  return "iex";
}

function toPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

/**
 * Reads configuration fresh on every call (no module-level cache) so tests
 * and multi-instance deployments always observe current environment values.
 */
export function getMarketDataConfig(): MarketDataConfig {
  return {
    mode: toMode(process.env.MARKET_DATA_MODE),
    feed: toFeed(process.env.ALPACA_DATA_FEED),
    dataBaseUrl: process.env.ALPACA_DATA_BASE_URL ?? DEFAULT_DATA_BASE_URL,
    tradingBaseUrl: process.env.ALPACA_TRADING_BASE_URL ?? DEFAULT_TRADING_BASE_URL,
    apiKeyId: process.env.ALPACA_API_KEY_ID ?? null,
    apiSecretKey: process.env.ALPACA_API_SECRET_KEY ?? null,
    timeoutMs: toPositiveInt(process.env.MARKET_DATA_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    staleThresholdMs: toPositiveInt(process.env.MARKET_DATA_STALE_AFTER_MS, DEFAULT_STALE_AFTER_MS),
  };
}
