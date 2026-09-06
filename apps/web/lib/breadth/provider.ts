import "server-only";
import { MarketDataError } from "@/lib/market-data/errors";
import { alpacaFetch } from "@/lib/market-data/providers/alpaca-http";
import type { AlpacaBreadthBar, AlpacaBreadthSnapshot } from "./normalize";

export interface BreadthCredentials {
  apiKeyId: string;
  apiSecretKey: string;
  dataBaseUrl: string;
  tradingBaseUrl: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

interface AlpacaClock {
  timestamp?: string;
  is_open?: boolean;
}

export interface MarketClock {
  isOpen: boolean | null;
  timestamp: string | null;
}

interface BarsPayload {
  bars?: Record<string, AlpacaBreadthBar[]>;
  next_page_token?: string | null;
}

async function request(credentials: BreadthCredentials, baseUrl: string, path: string) {
  return alpacaFetch({
    baseUrl,
    path,
    apiKeyId: credentials.apiKeyId,
    apiSecretKey: credentials.apiSecretKey,
    timeoutMs: credentials.timeoutMs,
    fetchImpl: credentials.fetchImpl,
  });
}

function chunk(symbols: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < symbols.length; i += size) out.push(symbols.slice(i, i + size));
  return out;
}

/**
 * Multi-symbol delayed-SIP snapshots in a few large batches — never ~500
 * individual requests.
 */
export async function fetchAllSnapshots(
  credentials: BreadthCredentials,
  symbols: string[],
  batchSize: number,
): Promise<Record<string, AlpacaBreadthSnapshot | undefined>> {
  const merged: Record<string, AlpacaBreadthSnapshot | undefined> = {};
  for (const batch of chunk(symbols, batchSize)) {
    const query = new URLSearchParams({
      symbols: batch.join(","),
      feed: "delayed_sip",
    });
    const payload = (await request(
      credentials,
      credentials.dataBaseUrl,
      `/v2/stocks/snapshots?${query.toString()}`,
    )) as Record<string, unknown>;
    if (!payload || typeof payload !== "object") {
      throw new MarketDataError("malformed", "Alpaca snapshots response is not an object");
    }
    for (const symbol of batch) {
      const raw = payload[symbol];
      if (raw && typeof raw === "object") {
        merged[symbol] = raw as AlpacaBreadthSnapshot;
      }
    }
  }
  return merged;
}

export async function fetchMarketClock(credentials: BreadthCredentials): Promise<MarketClock> {
  const payload = (await request(
    credentials,
    credentials.tradingBaseUrl,
    "/v2/clock",
  )) as AlpacaClock;
  return {
    isOpen: typeof payload?.is_open === "boolean" ? payload.is_open : null,
    timestamp: typeof payload?.timestamp === "string" ? payload.timestamp : null,
  };
}

/**
 * Multi-symbol 1Day historical bars with pagination, in batches.
 *
 * Basic entitlement: SIP history is requested only up to `end` (safely set
 * outside the restricted recent window by the caller); `feed=sip` gives the
 * delayed history series.
 */
export async function fetchAllDailyBars(
  credentials: BreadthCredentials,
  symbols: string[],
  startIso: string,
  endIso: string,
  batchSize: number,
  maxPagesPerBatch = 6,
  adjustment: "raw" | "split" = "raw",
): Promise<Map<string, AlpacaBreadthBar[]>> {
  const merged = new Map<string, AlpacaBreadthBar[]>();

  for (const batch of chunk(symbols, batchSize)) {
    const params = new URLSearchParams({
      symbols: batch.join(","),
      timeframe: "1Day",
      start: startIso,
      end: endIso,
      limit: "10000",
      adjustment,
      feed: "sip",
    });

    let pageToken: string | null = null;
    for (let page = 0; page < maxPagesPerBatch; page += 1) {
      const query = pageToken
        ? `${params.toString()}&page_token=${encodeURIComponent(pageToken)}`
        : params.toString();
      const payload = (await request(
        credentials,
        credentials.dataBaseUrl,
        `/v2/stocks/bars?${query}`,
      )) as BarsPayload;
      if (!payload || typeof payload !== "object") {
        throw new MarketDataError("malformed", "Alpaca bars response is not an object");
      }
      if (payload.bars) {
        for (const [symbol, bars] of Object.entries(payload.bars)) {
          if (!merged.has(symbol)) merged.set(symbol, []);
          merged.get(symbol)?.push(...(Array.isArray(bars) ? bars : []));
        }
      }
      pageToken = typeof payload.next_page_token === "string" ? payload.next_page_token : null;
      if (!pageToken) break;
    }
  }

  return merged;
}
