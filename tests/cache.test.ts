import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cachedJson,
  configureCache,
  type CacheBackend,
  type CacheEnvelope,
} from '../src/index';

function memoryBackend() {
  const map = new Map<string, CacheEnvelope<unknown>>();
  const backend: CacheBackend = {
    async get<T>(key: string) {
      return (map.get(key) as CacheEnvelope<T> | undefined) ?? null;
    },
    async set<T>(key: string, env: CacheEnvelope<T>) {
      map.set(key, env);
    },
  };
  return backend;
}

beforeEach(() => configureCache(memoryBackend()));
afterEach(() => vi.restoreAllMocks());

describe('cachedJson', () => {
  it('returns a fresh hit without calling the loader', async () => {
    const loader = vi.fn(async () => ({ n: 1 }));
    const first = await cachedJson('k', 1_000, loader, 100);
    const second = await cachedJson('k', 1_000, loader, 200);

    expect(first).toEqual({ n: 1 });
    expect(second).toEqual({ n: 1 });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reloads after the entry expires', async () => {
    const loader = vi
      .fn<() => Promise<{ n: number }>>()
      .mockResolvedValueOnce({ n: 1 })
      .mockResolvedValueOnce({ n: 2 });

    await cachedJson('k', 1_000, loader, 100);
    const second = await cachedJson('k', 1_000, loader, 2_000);

    expect(second).toEqual({ n: 2 });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('serves the stale value when an expired loader fails', async () => {
    const loader = vi
      .fn<() => Promise<{ n: number } | null>>()
      .mockResolvedValueOnce({ n: 1 })
      .mockResolvedValueOnce(null);

    await cachedJson('k', 1_000, loader, 100);
    const stale = await cachedJson('k', 1_000, loader, 2_000);

    expect(stale).toEqual({ n: 1 });
  });

  it('returns null when nothing is cached and the loader fails', async () => {
    const result = await cachedJson('missing', 1_000, async () => null, 100);
    expect(result).toBeNull();
  });

  it('does not cache a null result', async () => {
    const loader = vi
      .fn<() => Promise<{ n: number } | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ n: 3 });

    expect(await cachedJson('k', 1_000, loader, 100)).toBeNull();
    expect(await cachedJson('k', 1_000, loader, 200)).toEqual({ n: 3 });
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
