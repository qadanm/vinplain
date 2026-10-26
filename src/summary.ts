import { decodeVin } from './nhtsa';
import {
  getComplaints,
  getFuelEconomy,
  getRecallsDetailed,
  getSafetyRatings,
  hasInvestigations,
} from './vehicle';
import type {
  ComplaintSummary,
  FuelEconomy,
  RecallCampaign,
  SafetyRating,
  VehicleQuery,
  VehicleSpecs,
} from './types';

export type SectionStatus = 'ok' | 'empty' | 'unavailable' | 'skipped';

/** A VIN alone is enough; year/make/model are optional hints or a fallback. */
export type VehicleSummaryInput =
  | ({ vin: string } & Partial<Omit<VehicleQuery, 'vin'>>)
  | VehicleQuery;

export interface VehicleSummary {
  /** The query actually used. When a VIN decodes, year/make/model come from it. */
  query: VehicleQuery;
  specs?: VehicleSpecs;
  recalls?: RecallCampaign[];
  complaints?: ComplaintSummary;
  safety?: SafetyRating;
  fuelEconomy?: FuelEconomy;
  /** Whether the model appears in NHTSA's investigations list for the year. */
  investigations?: boolean;
  /**
   * Per-section outcome. `unavailable` means the source failed and the value is
   * absent; it is not the same as `empty`, which means the source answered with
   * nothing on file.
   */
  status: {
    decode: SectionStatus;
    recalls: SectionStatus;
    complaints: SectionStatus;
    safety: SectionStatus;
    fuelEconomy: SectionStatus;
    investigations: SectionStatus;
  };
}

function arrayStatus(value: RecallCampaign[] | null | undefined): SectionStatus {
  if (value == null) return 'unavailable';
  return value.length === 0 ? 'empty' : 'ok';
}

function objectStatus(value: unknown): SectionStatus {
  return value == null ? 'unavailable' : 'ok';
}

function booleanStatus(value: boolean | null | undefined): SectionStatus {
  return value == null ? 'unavailable' : 'ok';
}

/**
 * Fetch every public section in one call.
 *
 * A VIN is decoded first; the decoded year/make/model drive the record lookups.
 * Each section resolves independently, so one slow or failed source does not
 * sink the rest. Check `status` before rendering a value: `unavailable` is not
 * "clean".
 */
export async function getVehicleSummary(input: VehicleSummaryInput): Promise<VehicleSummary> {
  let specs: VehicleSpecs | null = null;
  let decode: SectionStatus = 'skipped';

  if (input.vin) {
    specs = await decodeVin(input.vin).catch(() => null);
    decode = specs ? 'ok' : 'unavailable';
  }

  const query: VehicleQuery = {
    ...input,
    year: specs?.year ?? input.year ?? 0,
    make: specs?.make ?? input.make ?? '',
    model: specs?.model ?? input.model ?? '',
    trim: specs?.trim ?? input.trim,
    driveHint: specs?.drive ?? input.driveHint,
    bodyHint: specs?.bodyClass ?? input.bodyHint,
    cylindersHint: specs?.cylinders ?? input.cylindersHint,
    fuelHint: specs?.fuelType ?? input.fuelHint,
  };

  const canQuery = Boolean(query.year && query.make && query.model);

  if (!canQuery) {
    return {
      query,
      specs: specs ?? undefined,
      status: {
        decode,
        recalls: 'skipped',
        complaints: 'skipped',
        safety: 'skipped',
        fuelEconomy: 'skipped',
        investigations: 'skipped',
      },
    };
  }

  const [recallsR, complaintsR, safetyR, fuelR, investigationsR] = await Promise.allSettled([
    getRecallsDetailed(query),
    getComplaints(query),
    getSafetyRatings(query),
    getFuelEconomy(query),
    hasInvestigations(query),
  ]);

  const recalls = recallsR.status === 'fulfilled' ? recallsR.value : null;
  const complaints = complaintsR.status === 'fulfilled' ? complaintsR.value : null;
  const safety = safetyR.status === 'fulfilled' ? safetyR.value : null;
  const fuelEconomy = fuelR.status === 'fulfilled' ? fuelR.value : null;
  const investigations = investigationsR.status === 'fulfilled' ? investigationsR.value : null;

  return {
    query,
    specs: specs ?? undefined,
    recalls: recalls ?? undefined,
    complaints: complaints ?? undefined,
    safety: safety ?? undefined,
    fuelEconomy: fuelEconomy ?? undefined,
    investigations: investigations ?? undefined,
    status: {
      decode,
      recalls: arrayStatus(recalls),
      complaints: objectStatus(complaints),
      safety: objectStatus(safety),
      fuelEconomy: objectStatus(fuelEconomy),
      investigations: booleanStatus(investigations),
    },
  };
}
