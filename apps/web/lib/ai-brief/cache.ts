/**
 * Phase 7C.2A — generic in-memory TTL cache for validated service artifacts.
 * Knows nothing about domains/LLM/grounding. Lazy expiry, no background sweep.
 */
export interface AiBriefCacheEntry<T> {
  value: T;
  cachedAt: number;
  expiresAt: number;
}

export interface AiBriefCache<T> {
  get(key: string, now?: number): T | undefined;
  set(key: string, value: T, now?: number): void;
  delete(key: string): void;
  clear(): void;
}

export function createAiBriefCache<T>(options: { ttlMs?: number; now?: () => number } = {}): AiBriefCache<T> {
  const ttlMs = options.ttlMs ?? 180_000;
  const store = new Map<string, AiBriefCacheEntry<T>>();

  return {
    get(key, now) {
      const at = now ?? (options.now ? options.now() : Date.now());
      const entry = store.get(key);
      if (!entry) return undefined;
      if (at >= entry.expiresAt) {
        store.delete(key); // lazy removal
        return undefined;
      }
      return entry.value;
    },
    set(key, value, now) {
      const at = now ?? (options.now ? options.now() : Date.now());
      store.set(key, { value, cachedAt: at, expiresAt: at + ttlMs });
    },
    delete(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}
