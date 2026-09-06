/**
 * In-memory TTL cache + in-flight dedup for breadth upstream calls.
 *
 * Separate cadences: delayed-SIP current snapshots ~60s, historical daily bars
 * ~30 min, market clock ~15s. No Redis in this phase; the cache is correct for
 * single-instance self-hosted/dev deployments.
 */
import { HISTORY_CACHE_MS, MARKET_CLOCK_CACHE_MS, SNAPSHOT_CACHE_MS } from "./constants";

export const BREADTH_CACHE_TTL_MS = {
  snapshots: SNAPSHOT_CACHE_MS,
  history: HISTORY_CACHE_MS,
  clock: MARKET_CLOCK_CACHE_MS,
} as const;

interface Entry {
  data: unknown;
  fetchedAt: number;
}

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export async function withBreadthCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.fetchedAt < ttlMs) return hit.data as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = loader()
    .then((data) => {
      cache.set(key, { data, fetchedAt: Date.now() });
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/** Test-only reset — cached upstream data must never leak between tests. */
export function resetBreadthCachesForTests(): void {
  cache.clear();
  inflight.clear();
}
