import "server-only";
import { MarketDataError } from "@/lib/market-data/errors";
import type { MacroDataConfig } from "../config";
import { normalizeTwelveGold, type TwelvePrice, type TwelveTimeSeries } from "../normalize";
import { MACRO_SIGNALS } from "../symbols";
import { unavailableMacroSnapshot, type MacroProviderResult } from "../types";

/**
 * Twelve Data provider — Gold only (XAU/USD) for Phase 2.
 *
 * Reliable endpoints only (real-key validated):
 *   GET /price?symbol=XAU/USD                       → current spot price
 *   GET /time_series?symbol=XAU/USD&interval=1day&outputsize=3 → daily bars
 *
 * Twelve Data never requests WTI in any form — WTI moved to FRED (DCOILWTICO)
 * because bare `WTI` resolves to the W&T Offshore stock, not crude oil.
 * AUTHENTICATION: server-side `apikey` query param only; never in the browser.
 *
 * CACHE CADENCE: current price ~60s, daily history 15 min. The previous
 * COMPLETED daily close changes once a day, so re-requesting /time_series on
 * every 60s price poll would waste credits.
 */
const PRICE_CACHE_MS = 60_000; // current spot price
const HISTORY_CACHE_MS = 15 * 60_000; // previous daily close

interface TwelveUpstreamEntry {
  body: unknown;
  fetchedAt: number;
}

const upstreamCache = new Map<string, TwelveUpstreamEntry>();
const upstreamInflight = new Map<string, Promise<unknown>>();

/** Per-endpoint TTL cache with in-flight dedup (mirrors provider-cache rules). */
async function withUpstreamTtl<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = upstreamCache.get(key);
  if (hit && now - hit.fetchedAt < ttlMs) return hit.body as T;

  const pending = upstreamInflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = loader()
    .then((body) => {
      upstreamCache.set(key, { body, fetchedAt: Date.now() });
      return body;
    })
    .finally(() => {
      upstreamInflight.delete(key);
    });

  upstreamInflight.set(key, promise);
  return promise;
}

/** Test-only reset — cached upstream responses must never leak between tests. */
export function resetTwelveUpstreamCacheForTests(): void {
  upstreamCache.clear();
  upstreamInflight.clear();
}

export async function getTwelveSignals(
  config: MacroDataConfig,
  fetchImpl?: typeof fetch,
): Promise<MacroProviderResult> {
  const gold = MACRO_SIGNALS.gold;
  if (!config.twelveDataApiKey) {
    return {
      provider: "twelve",
      signals: [unavailableMacroSnapshot("gold", gold.frequency)],
      degraded: false,
    };
  }

  const symbol = gold.twelveSymbol ?? "XAU/USD";

  // Current spot price is required — without it Gold is unavailable.
  let priceBody: unknown;
  try {
    priceBody = await withUpstreamTtl(priceCacheKey(config, symbol), PRICE_CACHE_MS, () =>
      fetchTwelveJson(config, "/price", { symbol }, fetchImpl),
    );
  } catch {
    return {
      provider: "twelve",
      signals: [unavailableMacroSnapshot("gold", gold.frequency)],
      degraded: false,
    };
  }

  // Daily history is a comparison input only: when it fails or has no
  // completed close, Gold still shows the live price with change/changePct
  // null rather than blanking the whole signal.
  let historyBody: unknown = null;
  try {
    historyBody = await withUpstreamTtl(historyCacheKey(config, symbol), HISTORY_CACHE_MS, () =>
      fetchTwelveJson(
        config,
        "/time_series",
        { symbol, interval: "1day", outputsize: "3" },
        fetchImpl,
      ),
    );
  } catch {
    historyBody = null;
  }

  return {
    provider: "twelve",
    signals: [
      normalizeTwelveGold(
        "gold",
        priceBody as TwelvePrice | null,
        historyBody as TwelveTimeSeries | null,
        Date.now(),
      ),
    ],
    degraded: false,
  };
}

function priceCacheKey(config: MacroDataConfig, symbol: string): string {
  return `${config.twelveDataBaseUrl}|price|${symbol}`;
}

function historyCacheKey(config: MacroDataConfig, symbol: string): string {
  return `${config.twelveDataBaseUrl}|time_series|1day|${symbol}`;
}

interface TwelveJsonResponse {
  status?: string;
  code?: number;
  message?: string;
}

/** Twelve Data JSON GET with server-side `apikey` auth; HTTP/JSON errors → MarketDataError. */
async function fetchTwelveJson(
  config: MacroDataConfig,
  path: string,
  params: Record<string, string>,
  fetchImpl?: typeof fetch,
): Promise<TwelveJsonResponse> {
  const doFetch = fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const query = new URLSearchParams({ ...params, apikey: config.twelveDataApiKey ?? "" });
  const url = `${config.twelveDataBaseUrl}${path}?${query.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  let response: Response;
  try {
    response = await doFetch(url, { signal: controller.signal, cache: "no-store" });
  } catch (error) {
    const category = error instanceof Error && error.name === "AbortError" ? "timeout" : "network";
    throw new MarketDataError(category, `${category} while reaching Twelve Data`);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    throw new MarketDataError(
      "auth",
      `Twelve Data rejected API key (${response.status})`,
      response.status,
    );
  }
  if (response.status === 429) {
    throw new MarketDataError("rate_limit", "Twelve Data rate limit exceeded", response.status);
  }
  if (response.status >= 500) {
    throw new MarketDataError(
      "server",
      `Twelve Data upstream error (${response.status})`,
      response.status,
    );
  }
  if (!response.ok) {
    throw new MarketDataError(
      "unknown",
      `Twelve Data returned ${response.status}`,
      response.status,
    );
  }

  const text = await response.text();
  try {
    const payload = JSON.parse(text) as TwelveJsonResponse;
    // Provider error payloads (e.g. "symbol not found") carry no usable data.
    if (payload && typeof payload === "object" && payload.status === "error") {
      throw new MarketDataError("unknown", payload.message ?? "Twelve Data symbol lookup failed");
    }
    return payload;
  } catch (error) {
    if (error instanceof MarketDataError) throw error;
    throw new MarketDataError("malformed", "Twelve Data returned malformed JSON");
  }
}
