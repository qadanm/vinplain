/**
 * vinplain
 *
 * Public data sources only: NHTSA vPIC, NHTSA recalls/complaints/NCAP, and
 * the US Department of Energy fuel-economy API. No API keys, no app code,
 * no listing integrations.
 */

export { configureCache, getCacheBackend, STALE_TTL_SECONDS } from './cache';
export type { CacheBackend, CacheEnvelope } from './cache';

export { configureHttp, fetchJson, cachedJson } from './http';

export { decodeVin, lookupComplaints, mapVpicRow } from './nhtsa';

export { getVehicleSummary } from './summary';
export type { VehicleSummary, VehicleSummaryInput, SectionStatus } from './summary';

export {
  getYears,
  getMakes,
  getModels,
  resolveNhtsaModel,
  nhtsaModelCandidates,
  getRecallsDetailed,
  getComplaints,
  hasInvestigations,
  getSafetyRatings,
  getFuelEconomy,
  getEpaSpecs,
  mergeSpecs,
  titleCaseComponent,
  normalizeMake,
  CONSUMER_MAKES,
} from './vehicle';

export {
  VIN_LENGTH,
  normalizeVin,
  isVinFormat,
  computeCheckDigit,
  isCheckDigitValid,
  wmiRegion,
  extractVins,
  pickBestVin,
} from './vin';
export type { VinCandidate, VinRegion } from './vin';

export type {
  VehicleQuery,
  VehicleSpecs,
  RecallCampaign,
  ComplaintSummary,
  SafetyRating,
  FuelEconomy,
  AdasPresence,
} from './types';
