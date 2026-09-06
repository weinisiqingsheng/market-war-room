import "server-only";
import type { MacroProviderId } from "@war-room/types";
import type { MacroProviderResult } from "./types";

/**
 * Per-source cache with source-specific TTLs.
 *
 * Macro assets refresh at different speeds, so one aggressive 15s TTL is
 * wrong: FRED is a daily feed (cache 15 min), Twelve Data is intraday
 * (60s), Alpaca crypto is real-time 24/7 (30s). Concurrent requests for the
 * same provider are coalesced into a single upstream call.
 *
 * On an upstream failure, a recent (< 5 min) previous result is served and
 * flagged `degraded` (rendered stale) rather than dropping the signal.
 */
const CACHE_TTL_MS: Record<MacroProviderId, number> = {
  fred: 15 * 60_000,
  twelve: 60_000,
  "alpaca-crypto": 30_000,
};

const MAX_DEGRADED_SERVE_MS = 5 * 60_000;

interface CacheEntry {
  data: MacroProviderResult;
  fetchedAt: number;
}

const cache = new Map<MacroProviderId, CacheEntry>();
const inflight = new Map<MacroProviderId, Promise<MacroProviderResult>>();

export async function withMacroProviderCache(
  provider: MacroProviderId,
  loader: () => Promise<MacroProviderResult>,
): Promise<MacroProviderResult> {
  const ttl = CACHE_TTL_MS[provider];
  const now = Date.now();
  const entry = cache.get(provider);

  if (entry && now - entry.fetchedAt < ttl) return entry.data;

  const pending = inflight.get(provider);
  if (pending) return pending;

  const promise = loader()
    .then((data) => {
      cache.set(provider, { data, fetchedAt: Date.now() });
      return data;
    })
    .catch((error: unknown) => {
      if (entry && now - entry.fetchedAt < MAX_DEGRADED_SERVE_MS) {
        return { ...entry.data, degraded: true };
      }
      throw error;
    })
    .finally(() => {
      inflight.delete(provider);
    });

  inflight.set(provider, promise);
  return promise;
}

/** Test-only: clears cached provider results so tests are deterministic. */
export function resetMacroProviderCacheForTests(): void {
  cache.clear();
  inflight.clear();
}
