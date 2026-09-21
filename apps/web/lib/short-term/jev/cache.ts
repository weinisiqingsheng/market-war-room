import "server-only";

export interface JevCache<T> {
  get(key: string, now?: number): T | null;
  set(key: string, value: T, now?: number): void;
  clear(): void;
}

export function createJevCache<T>(ttlMs = 60_000): JevCache<T> {
  const entries = new Map<string, { value: T; expiresAt: number }>();
  return {
    get(key, now = Date.now()) {
      const entry = entries.get(key);
      if (!entry || entry.expiresAt <= now) {
        entries.delete(key);
        return null;
      }
      return entry.value;
    },
    set(key, value, now = Date.now()) {
      entries.set(key, { value, expiresAt: now + ttlMs });
    },
    clear() {
      entries.clear();
    },
  };
}
