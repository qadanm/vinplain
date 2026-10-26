/**
 * HTTP + cache helpers. `fetchJson` wraps every request in an abort timeout and
 * degrades to null rather than throwing. `cachedJson` is read-through with
 * degrade-on-error (stale fallback when the loader fails), backed by whatever
 * CacheBackend was injected via configureCache().
 *
 * Pure: global fetch + AbortController are available in both React Native
 * (Hermes) and Node 18+.
 */
import { getCacheBackend, STALE_TTL_SECONDS } from './cache';

// Generous, configurable timeouts. The point is to wait for slow-but-working
// government APIs rather than drop data — a slow section just shows its loading
// state longer. Each consumer tunes these for its environment via
// configureHttp(): the app can wait a long time (per-section async loaders),
// the web is bounded by its serverless function's maxDuration.
let defaultTimeoutMs = 15000;
let complaintsTimeoutMs = 30000;

export function configureHttp(opts: { defaultTimeoutMs?: number; complaintsTimeoutMs?: number }): void {
  if (typeof opts.defaultTimeoutMs === 'number') defaultTimeoutMs = opts.defaultTimeoutMs;
  if (typeof opts.complaintsTimeoutMs === 'number') complaintsTimeoutMs = opts.complaintsTimeoutMs;
}

/** Timeout for the complaints endpoint (large, multi-MB payloads). */
export function getComplaintsTimeoutMs(): number {
  return complaintsTimeoutMs;
}

interface FetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Fetch JSON with an abort timeout. Returns null on ANY failure (timeout,
 * network error, non-2xx) — callers treat null as "couldn't load" (distinct
 * from a successful response with empty results, which returns the parsed body).
 */
export async function fetchJson<T>(
  url: string,
  { timeoutMs = defaultTimeoutMs, headers, signal }: FetchOptions = {},
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort);
  }
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Read-through TTL cache. Fresh hit → return it; miss/stale → run `loader`,
 * cache a non-null result, return it; loader returns null but a stale value
 * exists → return the stale value (degrade-on-error).
 */
export async function cachedJson<T>(
  key: string,
  maxAgeMs: number,
  loader: () => Promise<T | null>,
  now: number = Date.now(),
): Promise<T | null> {
  const backend = getCacheBackend();
  let stale: T | null = null;

  const env = await backend.get<T>(key);
  if (env && typeof env.ts === 'number') {
    if (now - env.ts < maxAgeMs) return env.data;
    stale = env.data;
  }

  const fresh = await loader();
  if (fresh != null) {
    await backend.set(key, { ts: now, data: fresh }, STALE_TTL_SECONDS);
    return fresh;
  }

  return stale;
}
