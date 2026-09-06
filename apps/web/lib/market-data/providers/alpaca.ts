import "server-only";
import type { MarketDataProvider, MarketFeed, MarketSnapshotMap } from "@war-room/types";
import { alpacaFetch } from "./alpaca-http";
import { normalizeAlpacaSnapshot, type AlpacaSymbolSnapshot } from "../normalize";
import { MarketDataError } from "../errors";

/**
 * Alpaca Market Data API provider (equities snapshots + US market clock).
 *
 * Security: credentials are attached as headers server-side only and never
 * leave this module. Upstream payloads are normalized into Market War Room
 * domain types — raw Alpaca JSON never reaches the UI.
 */

interface AlpacaClock {
  timestamp?: string;
  is_open?: boolean;
  next_open?: string;
  next_close?: string;
}

export interface AlpacaProviderOptions {
  apiKeyId: string;
  apiSecretKey: string;
  feed: MarketFeed;
  dataBaseUrl: string;
  tradingBaseUrl: string;
  timeoutMs: number;
  /** Injectable fetch for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export function createAlpacaProvider(options: AlpacaProviderOptions): MarketDataProvider {
  const request = (baseUrl: string, path: string) =>
    alpacaFetch({
      baseUrl,
      path,
      apiKeyId: options.apiKeyId,
      apiSecretKey: options.apiSecretKey,
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
    });

  return {
    async getSnapshots(symbols: string[]): Promise<MarketSnapshotMap> {
      const query = new URLSearchParams({
        symbols: symbols.join(","),
        feed: options.feed === "demo" ? "iex" : options.feed,
      });
      const payload = (await request(
        options.dataBaseUrl,
        `/v2/stocks/snapshots?${query.toString()}`,
      )) as Record<string, unknown>;

      if (!payload || typeof payload !== "object") {
        throw new MarketDataError("malformed", "Alpaca snapshots response is not an object");
      }

      const map: MarketSnapshotMap = {};
      for (const symbol of symbols) {
        map[symbol] = normalizeAlpacaSnapshot(
          symbol,
          payload[symbol] as AlpacaSymbolSnapshot | null | undefined,
          options.feed === "demo" ? "iex" : options.feed,
        );
      }
      return map;
    },

    async getMarketClock() {
      const payload = (await request(options.tradingBaseUrl, "/v2/clock")) as AlpacaClock;
      return {
        marketOpen: typeof payload?.is_open === "boolean" ? payload.is_open : null,
        nextOpen: typeof payload?.next_open === "string" ? payload.next_open : null,
        nextClose: typeof payload?.next_close === "string" ? payload.next_close : null,
      };
    },
  };
}
