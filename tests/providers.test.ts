import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureCache,
  decodeVin,
  getFuelEconomy,
  getMakes,
  getModels,
  getRecallsDetailed,
  getSafetyRatings,
  lookupComplaints,
  mapVpicRow,
  mergeSpecs,
  resolveNhtsaModel,
} from '../src/index';

type Route = [fragment: string, status: number, body: unknown];

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function mockFetch(routes: Route[]) {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const hit = routes.find(([fragment]) => url.includes(fragment));
    return hit ? response(hit[1], hit[2]) : response(404, {});
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

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

const ICE_ROW = {
  ErrorCode: '0',
  Make: 'HONDA',
  Model: 'Accord',
  ModelYear: '2003',
  Trim: 'EX-V6',
  EngineModel: 'J30A4',
  DisplacementL: '2.998832712',
  EngineCylinders: '6',
  EngineHP: '240',
  TransmissionSpeeds: '5',
  BodyClass: 'Coupe',
  Doors: '2',
  PlantCity: 'MARYSVILLE',
  PlantState: 'OHIO',
  PlantCountry: 'UNITED STATES (USA)',
  FuelTypePrimary: 'Gasoline',
};

beforeEach(() => freshCache());
afterEach(() => vi.unstubAllGlobals());

describe('mapVpicRow', () => {
  it('maps an ICE decode', () => {
    expect(mapVpicRow(ICE_ROW)).toMatchObject({
      year: 2003,
      make: 'Honda',
      model: 'Accord',
      trim: 'EX-V6',
      horsepower: 240,
      cylinders: 6,
      displacementL: 3,
      transmissionSpeeds: 5,
      plant: 'Marysville, Ohio, United States',
    });
  });

  it('maps an EV decode', () => {
    const specs = mapVpicRow({
      ErrorCode: '1',
      Make: 'TESLA',
      Model: 'Model 3',
      ModelYear: '2018',
      FuelTypePrimary: 'Electric',
      ElectrificationLevel: 'BEV (Battery Electric Vehicle)',
      EVDriveUnit: 'Single Motor',
      OtherEngineInfo: 'Single Motor - Standard',
      TransmissionSpeeds: '1',
      BodyClass: 'Sedan/Saloon',
      Doors: '4',
    });
    expect(specs).toMatchObject({ year: 2018, make: 'Tesla', model: 'Model 3' });
    expect(specs?.electrification).toContain('BEV');
    expect(specs?.evDriveUnit).toBe('Single Motor');
    expect(specs?.fuelType).toBe('Electric');
  });

  it('rejects an unusable decode', () => {
    expect(mapVpicRow({ ErrorCode: '0' })).toBeNull();
  });
});

describe('decodeVin', () => {
  it('decodes and caches by VIN', async () => {
    const fetchMock = mockFetch([
      ['DecodeVinValuesExtended/1HGCM82633A004352', 200, { Results: [ICE_ROW] }],
    ]);

    const first = await decodeVin('1hgcm82633a004352');
    const second = await decodeVin('1HGCM82633A004352');

    expect(first?.make).toBe('Honda');
    expect(second?.model).toBe('Accord');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null for an empty VIN', async () => {
    expect(await decodeVin('')).toBeNull();
  });
});

describe('lookupComplaints', () => {
  it('aggregates components and serious incidents', async () => {
    mockFetch([
      [
        'complaintsByVehicle',
        200,
        {
          results: [
            {
              components: 'AIR BAGS, ELECTRICAL',
              summary: 'Airbag warning',
              crash: true,
              fire: false,
              numberOfInjuries: 2,
              numberOfDeaths: 0,
            },
            {
              components: 'AIR BAGS',
              summary: 'Inflator rupture',
              crash: 'Yes',
              fire: true,
              numberOfInjuries: 0,
              numberOfDeaths: 1,
            },
          ],
        },
      ],
    ]);

    const out = await lookupComplaints({ year: 2018, make: 'Honda', model: 'Civic' });
    expect(out).toMatchObject({ total: 2, crashes: 2, fires: 1, injuries: 2, deaths: 1 });
    expect(out?.topComponents[0]).toMatchObject({ component: 'AIR BAGS', count: 2 });
  });
});

describe('vehicle lists', () => {
  it('merges consumer makes, de-dupes and sorts', async () => {
    mockFetch([
      ['GetMakesForVehicleType/car', 200, { Results: [{ MakeName: 'HONDA' }, { MakeName: 'BMW' }] }],
      ['GetMakesForVehicleType/truck', 200, { Results: [{ MakeName: 'HONDA' }, { MakeName: 'GMC' }] }],
      ['GetMakesForVehicleType/mpv', 200, { Results: [{ MakeName: 'TOYOTA' }] }],
    ]);

    expect(await getMakes()).toEqual(['BMW', 'GMC', 'Honda', 'Toyota']);
  });

  it('merges models across vehicle types and de-dupes', async () => {
    mockFetch([
      ['vehicleType/car', 200, { Results: [{ Model_Name: 'Civic' }, { Model_Name: 'Accord' }] }],
      ['vehicleType/truck', 200, { Results: [{ Model_Name: 'Civic' }] }],
      ['vehicleType/mpv', 200, { Results: [] }],
    ]);

    expect(await getModels('Honda', 2018)).toEqual(['Accord', 'Civic']);
  });

  it('resolves a vPIC family name to the NHTSA vocabulary', async () => {
    mockFetch([
      ['products/vehicle/models', 200, { results: [{ model: 'CIVIC' }, { model: 'CIVIC DEL SOL' }] }],
    ]);
    expect(await resolveNhtsaModel('r', { year: 2018, make: 'Honda', model: 'Civic' })).toBe('CIVIC');
  });
});

describe('getRecallsDetailed', () => {
  const campaign = {
    NHTSACampaignNumber: '18V001',
    Component: 'AIR BAGS:FRONTAL',
    Summary: 'Inflator may rupture.',
    Consequence: 'Injury risk.',
    Remedy: 'Dealer replaces inflator.',
    ReportReceivedDate: '2018-01-02',
  };

  it('maps campaigns and trims the component prefix', async () => {
    mockFetch([
      ['products/vehicle/models', 200, { results: [{ model: 'CIVIC' }] }],
      ['recalls/recallsByVehicle', 200, { results: [campaign] }],
    ]);

    const out = await getRecallsDetailed({ year: 2018, make: 'Honda', model: 'Civic' });
    expect(out).toHaveLength(1);
    expect(out?.[0]).toMatchObject({
      campaignId: '18V001',
      component: 'Air Bags',
      summary: 'Inflator may rupture.',
      remedy: 'Dealer replaces inflator.',
    });
  });

  it('returns an empty array for a confirmed zero', async () => {
    mockFetch([
      ['products/vehicle/models', 200, { results: [{ model: 'COROLLA' }] }],
      ['recalls/recallsByVehicle', 400, { Count: 0, results: [] }],
    ]);

    expect(await getRecallsDetailed({ year: 2022, make: 'Toyota', model: 'Corolla' })).toEqual([]);
  });

  it('returns null when the transport fails', async () => {
    mockFetch([
      ['products/vehicle/models', 200, { results: [{ model: 'CIVIC' }] }],
      ['recalls/recallsByVehicle', 503, { error: 'slow down' }],
    ]);

    expect(await getRecallsDetailed({ year: 2019, make: 'Honda', model: 'Civic' })).toBeNull();
  });
});

describe('getSafetyRatings', () => {
  it('walks the variant and detail lookups', async () => {
    mockFetch([
      ['SafetyRatings/VehicleId/12636', 200, {
        Results: [{
          VehicleDescription: '2018 Honda Civic 4 DR FWD',
          OverallRating: '5',
          OverallFrontCrashRating: '5',
          OverallSideCrashRating: '5',
          RolloverRating: 'Not Rated',
        }],
      }],
      ['/model/Civic', 200, {
        Count: 1,
        Results: [{ VehicleId: 12636, VehicleDescription: '2018 Honda Civic 4 DR FWD' }],
      }],
      ['SafetyRatings/modelyear', 200, { Results: [{ Model: 'Civic' }] }],
    ]);

    const out = await getSafetyRatings({ year: 2018, make: 'Honda', model: 'Civic' });
    expect(out).toMatchObject({
      overall: 5,
      frontal: 5,
      side: 5,
      rollover: null,
      variantCount: 1,
    });
  });
});

describe('getFuelEconomy', () => {
  it('matches the EPA model and maps economy fields', async () => {
    mockFetch([
      ['menu/model', 200, { menuItem: [{ text: 'Civic 4Dr', value: 'Civic 4Dr' }] }],
      ['menu/options', 200, { menuItem: [{ text: 'Auto', value: '39566' }] }],
      ['vehicle/39566', 200, {
        city08: '31',
        highway08: '40',
        comb08: '34',
        fuelType1: 'Regular Gasoline',
        fuelCost08: '1850',
        co2TailpipeGpm: '257.0',
        trany: 'Automatic',
        youSaveSpend: '500',
        pv4: '97',
        lv4: '14',
      }],
    ]);

    const out = await getFuelEconomy({ year: 2018, make: 'Honda', model: 'Civic' });
    expect(out).toMatchObject({
      cityMpg: 31,
      highwayMpg: 40,
      combinedMpg: 34,
      annualFuelCost: 1850,
      fuelType: 'Regular Gasoline',
      youSaveSpend: 500,
      passengerVolumeCuFt: 97,
      luggageVolumeCuFt: 14,
    });
  });
});

describe('mergeSpecs', () => {
  it('prefers primary fields and fills gaps from the fallback', () => {
    expect(
      mergeSpecs({ year: 2018, make: 'Honda' }, { year: 2017, model: 'Civic' }),
    ).toEqual({ year: 2018, make: 'Honda', model: 'Civic' });
  });

  it('returns whichever side exists', () => {
    expect(mergeSpecs(null, { make: 'Honda' })).toEqual({ make: 'Honda' });
    expect(mergeSpecs({ make: 'Honda' }, null)).toEqual({ make: 'Honda' });
    expect(mergeSpecs(null, null)).toBeUndefined();
  });
});
