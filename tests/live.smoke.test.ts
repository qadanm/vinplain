import { describe, expect, it } from 'vitest';
import {
  configureCache,
  decodeVin,
  getFuelEconomy,
  getRecallsDetailed,
  getSafetyRatings,
} from '../src/index';

/**
 * Opt-in integration check against the real, keyless government endpoints.
 * Not part of CI: these services throttle and occasionally change shape.
 *
 *   npm run test:live
 */
const live = process.env.RUN_LIVE === '1';

function freshCache() {
  const map = new Map<string, { ts: number; data: unknown }>();
  configureCache({
    async get<T>(key: string) {
      return (map.get(key) as { ts: number; data: T } | undefined) ?? null;
    },
    async set<T>(key: string, env: { ts: number; data: T }) {
      map.set(key, env);
    },
  });
}

describe.skipIf(!live)('live public APIs', () => {
  it('decodes a known VIN through vPIC', async () => {
    freshCache();
    const specs = await decodeVin('1HGCM82633A004352');
    expect(specs?.make).toBe('Honda');
    expect(specs?.model).toBe('Accord');
    expect(specs?.year).toBe(2003);
  }, 30_000);

  it('returns recall campaigns for a known vehicle', async () => {
    freshCache();
    const recalls = await getRecallsDetailed({ year: 2018, make: 'Honda', model: 'Civic' });
    expect(Array.isArray(recalls)).toBe(true);
    expect((recalls ?? []).length).toBeGreaterThan(0);
  }, 30_000);

  it('returns NCAP ratings for a known vehicle', async () => {
    freshCache();
    const safety = await getSafetyRatings({ year: 2018, make: 'Honda', model: 'Civic' });
    expect(safety).not.toBeNull();
    expect(safety?.overall).toBeGreaterThanOrEqual(1);
    expect(safety?.overall).toBeLessThanOrEqual(5);
  }, 30_000);

  it('returns EPA fuel economy for a known vehicle', async () => {
    freshCache();
    const fuel = await getFuelEconomy({ year: 2018, make: 'Honda', model: 'Civic' });
    expect(fuel).not.toBeNull();
    expect(fuel?.combinedMpg).toBeGreaterThan(0);
  }, 30_000);
});
