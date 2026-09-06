import "server-only";
import type { MarketOverview } from "@war-room/types";
import type { MarketDataConfig } from "./config";
import { buildLiveOverview } from "./overview";

/**
 * In-memory server-side cache + request deduplication.
 *
 * Rationale (documented): multiple browser sessions polling every 30s must not
 * each translate into an Alpaca call every cycle. This cache serves a fresh
 * response for TTL_MS (15s) and coalesces concurrent requests into a single
 * upstream call. It lives in process memory — correct for single-instance
 * self-hosted/dev deployments; a shared cache (Redis) belongs to a later
 * phase where multi-instance serving is introduced.
 */
const CACHE_TTL_MS = 15_000;
const MAX_STALE_SERVE_MS = 5 * 60_000;

interface CacheEntry {
  data: MarketOverview;
  fetchedAt: number;
}

let cached: CacheEntry | null = null;
let inflight: Promise<MarketOverview> | null = null;

export async function getCachedOverview(config: MarketDataConfig): Promise<MarketOverview> {
  const now = Date.now();

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  if (!inflight) {
    inflight = buildLiveOverview(config)
      .then((data) => {
        cached = { data, fetchedAt: Date.now() };
        return data;
      })
      .catch((error: unknown) => {
        // Serve the previous successful payload (clearly flagged stale) rather
        // than substituting demo numbers — a short-lived upstream outage should
        // not make fake figures look real.
        if (cached && Date.now() - cached.fetchedAt < MAX_STALE_SERVE_MS) {
          return {
            ...cached.data,
            meta: { ...cached.data.meta, stale: true },
          };
        }
        throw error;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}
