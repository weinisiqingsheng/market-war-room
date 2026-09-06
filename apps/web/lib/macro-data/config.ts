import "server-only";
import type { MarketDataMode } from "@war-room/types";
import { getMarketDataConfig } from "@/lib/market-data/config";

/**
 * Server-side macro-data configuration.
 *
 * FRED + Twelve Data keys are read from `process.env` ONLY here and only used
 * inside server code. They are never exposed via NEXT_PUBLIC_ and never
 * serialized into API responses. Alpaca credentials are shared with Phase 1.
 */
export interface MacroDataConfig {
  mode: MarketDataMode;
  fredApiKey: string | null;
  /** FRED API base URL — overridable for local/dev mock validation. */
  fredBaseUrl: string;
  twelveDataApiKey: string | null;
  twelveDataBaseUrl: string;
  timeoutMs: number;
  /** Freshness thresholds by source frequency (see docs for rationale). */
  staleAfterMs: {
    realtime: number; // BTC — trades 24/7, tight threshold
    intraday: number; // Twelve Data — tight, provider-defined freshness
    daily: number; // unused now — FRED daily uses business-day-aware logic
  };
  alpaca: {
    apiKeyId: string | null;
    apiSecretKey: string | null;
    dataBaseUrl: string;
    timeoutMs: number;
  };
}

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_FRED_BASE_URL = "https://api.stlouisfed.org/fred";
const REALTIME_STALE_MS = 5 * 60_000; // 5 min
const INTRADAY_STALE_MS = 15 * 60_000; // 15 min (provider-delayed semantics)
const DAILY_STALE_MS = 3 * 24 * 60 * 60_000; // 3 days (weekend/holiday tolerant)

function toPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

/** Reads configuration fresh on every call (no module cache) — test friendly. */
export function getMacroDataConfig(): MacroDataConfig {
  const market = getMarketDataConfig();
  return {
    mode: process.env.MACRO_DATA_MODE === "live" ? "live" : "demo",
    fredApiKey: process.env.FRED_API_KEY ?? null,
    fredBaseUrl: process.env.FRED_BASE_URL ?? DEFAULT_FRED_BASE_URL,
    twelveDataApiKey: process.env.TWELVE_DATA_API_KEY ?? null,
    twelveDataBaseUrl: process.env.TWELVE_DATA_BASE_URL ?? "https://api.twelvedata.com",
    timeoutMs: toPositiveInt(process.env.MACRO_DATA_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    staleAfterMs: {
      realtime: toPositiveInt(process.env.MACRO_STALE_AFTER_MS_REALTIME, REALTIME_STALE_MS),
      intraday: toPositiveInt(process.env.MACRO_STALE_AFTER_MS_INTRADAY, INTRADAY_STALE_MS),
      daily: toPositiveInt(process.env.MACRO_STALE_AFTER_MS_DAILY, DAILY_STALE_MS),
    },
    alpaca: {
      apiKeyId: market.apiKeyId,
      apiSecretKey: market.apiSecretKey,
      dataBaseUrl: market.dataBaseUrl,
      timeoutMs: market.timeoutMs,
    },
  };
}
