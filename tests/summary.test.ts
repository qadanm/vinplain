import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/nhtsa', () => ({ decodeVin: vi.fn() }));
vi.mock('../src/vehicle', () => ({
  getRecallsDetailed: vi.fn(),
  getComplaints: vi.fn(),
  getSafetyRatings: vi.fn(),
  getFuelEconomy: vi.fn(),
  hasInvestigations: vi.fn(),
}));

import { decodeVin } from '../src/nhtsa';
import {
  getComplaints,
  getFuelEconomy,
  getRecallsDetailed,
  getSafetyRatings,
  hasInvestigations,
} from '../src/vehicle';
import { getVehicleSummary } from '../src/summary';

const specs = {
  year: 2018,
  make: 'Honda',
  model: 'Civic',
  trim: 'EX',
  drive: 'FWD',
  bodyClass: 'Sedan',
  cylinders: 4,
  fuelType: 'Gasoline',
};

const recall = { campaignId: '18V001', component: 'Air Bags', summary: 'Inflator may rupture.' };
const complaints = {
  total: 2,
  topComponents: [{ component: 'Air Bags', count: 2, sampleSummary: 'Warning' }],
  crashes: 1,
  fires: 0,
  injuries: 0,
  deaths: 0,
};
const safety = {
  vehicleDescription: '2018 Honda Civic 4 DR FWD',
  variantCount: 1,
  overall: 5,
  frontal: 5,
  side: 5,
  rollover: null,
};
const fuel = {
  cityMpg: 31,
  highwayMpg: 40,
  combinedMpg: 34,
  annualFuelCost: 1850,
  co2GramsPerMile: 257,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('getVehicleSummary', () => {
  it('decodes a VIN and uses it for every lookup', async () => {
    vi.mocked(decodeVin).mockResolvedValue(specs);
    vi.mocked(getRecallsDetailed).mockResolvedValue([recall]);
    vi.mocked(getComplaints).mockResolvedValue(complaints);
    vi.mocked(getSafetyRatings).mockResolvedValue(safety);
    vi.mocked(getFuelEconomy).mockResolvedValue(fuel);
    vi.mocked(hasInvestigations).mockResolvedValue(false);

    const summary = await getVehicleSummary({ vin: '1HGCM82633A004352' });

    expect(decodeVin).toHaveBeenCalledWith('1HGCM82633A004352');
    expect(summary.query).toMatchObject({ year: 2018, make: 'Honda', model: 'Civic' });
    expect(summary.status).toEqual({
      decode: 'ok',
      recalls: 'ok',
      complaints: 'ok',
      safety: 'ok',
      fuelEconomy: 'ok',
      investigations: 'ok',
    });
    expect(summary.specs?.trim).toBe('EX');
    expect(summary.investigations).toBe(false);
  });

  it('keeps partial results when sources fail', async () => {
    vi.mocked(decodeVin).mockResolvedValue(null);
    vi.mocked(getRecallsDetailed).mockResolvedValue(null);
    vi.mocked(getComplaints).mockRejectedValue(new Error('complaints failed'));
    vi.mocked(getSafetyRatings).mockResolvedValue(null);
    vi.mocked(getFuelEconomy).mockResolvedValue(null);
    vi.mocked(hasInvestigations).mockRejectedValue(new Error('investigations failed'));

    const summary = await getVehicleSummary({ year: 2010, make: 'Ford', model: 'Focus' });

    expect(summary.status).toEqual({
      decode: 'skipped',
      recalls: 'unavailable',
      complaints: 'unavailable',
      safety: 'unavailable',
      fuelEconomy: 'unavailable',
      investigations: 'unavailable',
    });
    expect(summary.query).toMatchObject({ year: 2010, make: 'Ford', model: 'Focus' });
    expect(summary.recalls).toBeUndefined();
  });

  it('marks a checked-but-empty recall set as empty, not unavailable', async () => {
    vi.mocked(getRecallsDetailed).mockResolvedValue([]);
    vi.mocked(getComplaints).mockResolvedValue({ ...complaints, total: 0, topComponents: [] });
    vi.mocked(getSafetyRatings).mockResolvedValue(safety);
    vi.mocked(getFuelEconomy).mockResolvedValue(fuel);
    vi.mocked(hasInvestigations).mockResolvedValue(false);

    const summary = await getVehicleSummary({ year: 2022, make: 'Toyota', model: 'Corolla' });

    expect(summary.status.recalls).toBe('empty');
    expect(summary.status.complaints).toBe('ok');
    expect(summary.recalls).toEqual([]);
  });

  it('skips record lookups when the query has no usable year/make/model', async () => {
    const summary = await getVehicleSummary({ year: 0, make: '', model: '' });

    expect(summary.status).toEqual({
      decode: 'skipped',
      recalls: 'skipped',
      complaints: 'skipped',
      safety: 'skipped',
      fuelEconomy: 'skipped',
      investigations: 'skipped',
    });
    expect(getRecallsDetailed).not.toHaveBeenCalled();
    expect(getSafetyRatings).not.toHaveBeenCalled();
  });
});
