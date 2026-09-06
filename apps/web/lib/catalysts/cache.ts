/** Minimal catalyst cache with TTL + in-flight dedup. No DB, no Redis. */
const store = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();

export function withCatalystCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const existing = store.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.promise as Promise<T>;
  if (existing) {
    // Reuse in-flight promise even if expired while still running.
    return existing.promise as Promise<T>;
  }
  const promise = loader().catch((error) => {
    store.delete(key);
    throw error;
  });
  store.set(key, { expiresAt: Date.now() + ttlMs, promise });
  return promise;
}

export function resetCatalystCachesForTests(): void {
  store.clear();
}
