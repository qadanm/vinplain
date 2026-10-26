/**
 * Injectable cache backend. The shared logic stays pure (no AsyncStorage, no
 * Redis): each consumer calls configureCache() once with its own adapter.
 * Default is a per-process in-memory map, so the package works untouched in
 * tests and before configuration.
 *
 *   App: configureCache(asyncStorageBackend)   (React Native)
 *   Web: configureCache(redisBackend())         (Node / Upstash)
 */
export interface CacheEnvelope<T> {
  ts: number;
  data: T;
}

export interface CacheBackend {
  get<T>(key: string): Promise<CacheEnvelope<T> | null>;
  /** Persist an envelope. ttlSeconds is a hint (e.g. for Redis EX); backends
   *  that don't support TTL may ignore it — freshness is gated on the envelope
   *  ts + maxAgeMs by cachedJson, not on backend eviction. */
  set<T>(key: string, env: CacheEnvelope<T>, ttlSeconds: number): Promise<void>;
}

/** Keep entries far longer than their logical freshness so a source outage can
 *  still be served stale. Freshness is gated on the envelope ts, not eviction. */
export const STALE_TTL_SECONDS = 90 * 24 * 60 * 60;

const memory = new Map<string, CacheEnvelope<unknown>>();
const memoryBackend: CacheBackend = {
  async get<T>(key: string) {
    return (memory.get(key) as CacheEnvelope<T> | undefined) ?? null;
  },
  async set<T>(key: string, env: CacheEnvelope<T>) {
    memory.set(key, env);
  },
};

let backend: CacheBackend = memoryBackend;

export function configureCache(b: CacheBackend): void {
  backend = b;
}

export function getCacheBackend(): CacheBackend {
  return backend;
}
