import "server-only";
import { alpacaFetch } from "@/lib/market-data/providers/alpaca-http";
import type { MacroDataConfig } from "../config";
import { normalizeBtc, type CryptoBar, type CryptoTrade } from "../normalize";
import { MACRO_SIGNALS } from "../symbols";
import {
  unavailableMacroSnapshot,
  type MacroProviderResult,
  type NormalizedMacroSnapshot,
} from "../types";

const BTC_ID = "btc";

interface CryptoLatestTradesResponse {
  trades?: Record<string, CryptoTrade>;
}

interface CryptoBarsResponse {
  bars?: Record<string, CryptoBar[]>;
}

/**
 * Alpaca crypto provider — BTC/USD.
 * Reuses the shared Alpaca HTTP helper (auth headers, timeout, error mapping)
 * from the Phase 1 equities provider. BTC trades 24/7; its freshness is never
 * tied to the US equity market-open state.
 */
export async function getAlpacaCryptoSignals(
  config: MacroDataConfig,
  fetchImpl?: typeof fetch,
): Promise<MacroProviderResult> {
  const { apiKeyId, apiSecretKey, dataBaseUrl, timeoutMs } = config.alpaca;
  const definition = MACRO_SIGNALS[BTC_ID];
  const pair = definition.alpacaCryptoPair ?? "BTC/USD";

  if (!apiKeyId || !apiSecretKey) {
    return {
      provider: "alpaca-crypto",
      signals: [unavailableMacroSnapshot(BTC_ID, definition.frequency)],
      degraded: false,
    };
  }

  const fetchOptions = { apiKeyId, apiSecretKey, timeoutMs, fetchImpl };

  try {
    const [tradesPayload, barsPayload] = await Promise.all([
      alpacaFetch({
        baseUrl: dataBaseUrl,
        path: `/v1beta3/crypto/us/latest/trades?symbols=${encodeURIComponent(pair)}`,
        ...fetchOptions,
      }),
      alpacaFetch({
        baseUrl: dataBaseUrl,
        path: buildCompletedBarsPath(pair),
        ...fetchOptions,
      }),
    ]);

    const trade = (tradesPayload as CryptoLatestTradesResponse)?.trades?.[pair];
    const bars = (barsPayload as CryptoBarsResponse)?.bars?.[pair] ?? [];
    const signals: NormalizedMacroSnapshot[] = [normalizeBtc(BTC_ID, trade, bars)];
    return { provider: "alpaca-crypto", signals, degraded: false };
  } catch {
    return {
      provider: "alpaca-crypto",
      signals: [unavailableMacroSnapshot(BTC_ID, definition.frequency)],
      degraded: false,
    };
  }
}

/**
 * Alpaca crypto bars require explicit start/end to return historical bars —
 * without a window the endpoint returns only the currently-forming bar, which
 * cannot be used as a previous close. We request the last two UTC days so the
 * most recent COMPLETED daily bar (yesterday, or earlier if a data gap) is
 * available; normalizeBtc never uses the still-forming bar.
 */
function buildCompletedBarsPath(pair: string): string {
  const now = new Date();
  const todayStartUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const start = new Date(todayStartUtc - 2 * 24 * 60 * 60_000);
  const end = new Date(todayStartUtc);
  return (
    `/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(pair)}` +
    `&timeframe=1Day&limit=3&sort=desc` +
    `&start=${encodeURIComponent(start.toISOString())}` +
    `&end=${encodeURIComponent(end.toISOString())}`
  );
}
