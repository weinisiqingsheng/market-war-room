import "server-only";
import { MarketDataError } from "@/lib/market-data/errors";
import { logProviderIssue } from "@/lib/market-data/log";
import { getMarketDataConfig } from "@/lib/market-data/config";
import { alpacaFetch } from "@/lib/market-data/providers/alpaca-http";
import { withBreadthCache } from "@/lib/breadth/cache";
import {
  fetchAllDailyBars,
  fetchAllSnapshots,
  fetchMarketClock,
  type BreadthCredentials,
} from "@/lib/breadth/provider";
import {
  ANOMALY_CACHE_TTL_CLOCK_MS,
  ANOMALY_CACHE_TTL_HISTORY_MS,
  ANOMALY_CACHE_TTL_SNAPSHOTS_MS,
} from "@/lib/anomalies/constants";
import { secUserAgent } from "@/lib/catalysts/config";
import type { CatalystWindow } from "@/lib/catalysts/time-window";
import {
  fetchAlpacaNews,
  fetchCorporateActions,
  fetchSecSubmissions,
  type SecClient,
} from "@/lib/catalysts/providers";
import { resolveTickerSector } from "./sector";
import type { TickerResearchDeps } from "./service";
import type { ProviderAsset } from "./symbol";

/**
 * Provider-call budget per ticker lookup (bounded, documented):
 * - cold: asset (1) + clock (1) + snapshots (1) + daily bars (1, ≤6 pages) +
 *   news (1, ≤3 pages) + SEC directory (1, amortized 24h) + SEC submissions (1)
 *   + corporate actions (1) ≈ 8 upstream calls;
 * - warm (within TTLs): 0–3 calls (clock 15s / snapshots 60s / news 60s;
 *   bars 30min, SEC 10min, directory 24h, asset 24h).
 * Max concurrency inside one lookup: 3 (news + CIK directory + actions).
 */
export const TICKER_TTL = {
  asset: 24 * 60 * 60_000,
  secDirectory: 24 * 60 * 60_000,
  news: 60_000,
  sec: 600_000,
  actions: 600_000,
} as const;

export function resolveTickerResearchMode(): "demo" | "live" {
  return process.env.TICKER_RESEARCH_MODE === "live" ? "live" : "demo";
}

function credentials(): BreadthCredentials {
  const market = getMarketDataConfig();
  if (market.mode !== "live" || !market.apiKeyId || !market.apiSecretKey) {
    throw new MarketDataError(
      "config",
      "TICKER_RESEARCH_MODE=live requires live market data + Alpaca credentials",
      503,
      "ticker-context",
    );
  }
  return {
    apiKeyId: market.apiKeyId,
    apiSecretKey: market.apiSecretKey,
    dataBaseUrl: market.dataBaseUrl,
    tradingBaseUrl: market.tradingBaseUrl,
    timeoutMs: market.timeoutMs,
  };
}

async function lookupAsset(
  providerSymbol: string,
  creds: BreadthCredentials,
): Promise<{ ok: true; asset: ProviderAsset } | { ok: false; reason: "not_found" | "error" }> {
  try {
    const payload = await alpacaFetch({
      baseUrl: creds.tradingBaseUrl,
      path: `/v2/assets/${encodeURIComponent(providerSymbol)}`,
      apiKeyId: creds.apiKeyId,
      apiSecretKey: creds.apiSecretKey,
      timeoutMs: creds.timeoutMs,
      fetchImpl: creds.fetchImpl,
    });
    if (!payload || typeof payload !== "object") return { ok: false, reason: "error" };
    return { ok: true, asset: payload as ProviderAsset };
  } catch (error) {
    if (error instanceof MarketDataError && error.status === 404) {
      return { ok: false, reason: "not_found" };
    }
    return { ok: false, reason: "error" };
  }
}

interface SecDirectoryRaw {
  cik_str?: number;
  ticker?: string;
}

/** SEC ticker → CIK directory (cached 24h; one call per process lifetime/day). */
async function loadSecDirectory(userAgent: string): Promise<Map<string, string>> {
  const response = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: { "User-Agent": userAgent, Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new MarketDataError(
      "server",
      `SEC directory error (${response.status})`,
      response.status,
      "sec",
    );
  }
  const payload = (await response.json()) as Record<string, SecDirectoryRaw>;
  const map = new Map<string, string>();
  for (const entry of Object.values(payload)) {
    const ticker = typeof entry?.ticker === "string" ? entry.ticker.trim().toUpperCase() : "";
    const cik = typeof entry?.cik_str === "number" ? String(entry.cik_str).padStart(10, "0") : "";
    if (ticker && cik) map.set(ticker, cik);
  }
  return map;
}

export function createProductionTickerDeps(): TickerResearchDeps {
  return {
    mode: "live",
    now: () => Date.now(),
    resolveSector: (symbol) => resolveTickerSector(symbol),

    async lookupAsset(providerSymbol) {
      try {
        const creds = credentials();
        return await withBreadthCache(`ticker:asset:${providerSymbol}`, TICKER_TTL.asset, () =>
          lookupAsset(providerSymbol, creds),
        );
      } catch {
        return { ok: false as const, reason: "error" as const };
      }
    },

    async fetchClock() {
      const creds = credentials();
      return withBreadthCache("ticker:clock", ANOMALY_CACHE_TTL_CLOCK_MS, () =>
        fetchMarketClock(creds),
      );
    },

    async fetchSnapshots(symbols) {
      const creds = credentials();
      const key = `ticker:snapshots:${[...symbols].sort().join(",")}`;
      return withBreadthCache(key, ANOMALY_CACHE_TTL_SNAPSHOTS_MS, () =>
        fetchAllSnapshots(creds, symbols, 200),
      );
    },

    async fetchBars(providerSymbol, startIso, endIso) {
      const creds = credentials();
      const key = `ticker:history:${providerSymbol}:${startIso.slice(0, 10)}:${endIso.slice(0, 10)}`;
      const bars = await withBreadthCache(key, ANOMALY_CACHE_TTL_HISTORY_MS, () =>
        fetchAllDailyBars(creds, [providerSymbol], startIso, endIso, 100, 6, "split"),
      );
      return bars.get(providerSymbol) ?? [];
    },

    async fetchNews(symbol, window: CatalystWindow) {
      const creds = credentials();
      const key = `ticker:news:${symbol}:${window.startIso}:${window.cutoffIso ?? "latest"}`;
      return withBreadthCache(key, TICKER_TTL.news, () => fetchAlpacaNews(creds, [symbol], window));
    },

    async resolveCik(symbol) {
      const userAgent = secUserAgent();
      if (!userAgent) return null;
      const directory = await withBreadthCache(
        "ticker:sec-directory",
        TICKER_TTL.secDirectory,
        () => loadSecDirectory(userAgent),
      );
      return directory.get(symbol.trim().toUpperCase()) ?? null;
    },

    async fetchFilings(symbol, cik, window: CatalystWindow) {
      const userAgent = secUserAgent();
      if (!userAgent) return { filings: [], ok: false };
      const client: SecClient = { enabled: true, userAgent };
      const creds = credentials();
      const key = `ticker:sec:${cik}:${window.startIso}:${window.cutoffIso ?? "latest"}`;
      try {
        const filings = await withBreadthCache(key, TICKER_TTL.sec, () =>
          fetchSecSubmissions(client, cik, symbol, window, creds.timeoutMs),
        );
        return { filings, ok: true };
      } catch (error) {
        logProviderIssue(
          "server",
          502,
          "sec",
          error instanceof Error ? error.message : "SEC failed",
        );
        return { filings: [], ok: false };
      }
    },

    async fetchActions(symbol, window: CatalystWindow) {
      try {
        const creds = credentials();
        const key = `ticker:actions:${symbol}:${window.startIso}`;
        const actions = await withBreadthCache(key, TICKER_TTL.actions, () =>
          fetchCorporateActions(creds, [symbol], window),
        );
        return { actions, ok: true };
      } catch {
        return { actions: [], ok: false };
      }
    },
  };
}
