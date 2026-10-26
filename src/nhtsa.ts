/**
 * NHTSA integrations — vPIC extended VIN decode + owner complaints.
 *
 *  - VIN decode uses DecodeVinValuesExtended and maps every buyer-useful field
 *    the payload commonly returns (ICE + EV), with clean empty-value handling.
 *  - Complaints aggregate the serious-incident signal the API returns
 *    (crashes, fires, injuries, deaths), not just counts by component.
 *
 * All endpoints are free, unauthenticated, JSON. Each call has a timeout and
 * degrades to null rather than throwing.
 */
import { cachedJson, fetchJson, getComplaintsTimeoutMs } from './http';
import {
  cleanNum,
  cleanStr,
  formatAirbags,
  formatPlant,
  isUsableVpicDecode,
  prettyLabel,
  round1,
} from './normalize';
import type { ComplaintSummary, VehicleSpecs } from './types';

const VPIC_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles';
const NHTSA_BASE = 'https://api.nhtsa.gov';

const DAY = 24 * 60 * 60 * 1000;

interface VPicDecodeRow {
  ModelYear?: string;
  Make?: string;
  Model?: string;
  Trim?: string;
  Series?: string;
  EngineModel?: string;
  DisplacementL?: string;
  EngineCylinders?: string;
  EngineHP?: string;
  ValveTrainDesign?: string;
  EngineConfiguration?: string;
  OtherEngineInfo?: string;
  FuelTypePrimary?: string;
  FuelTypeSecondary?: string;
  ElectrificationLevel?: string;
  BatteryKWh?: string;
  BatteryType?: string;
  EVDriveUnit?: string;
  Motor?: string;
  TransmissionStyle?: string;
  TransmissionSpeeds?: string;
  DriveType?: string;
  BodyClass?: string;
  Doors?: string;
  GVWR?: string;
  PlantCity?: string;
  PlantState?: string;
  PlantCountry?: string;
  Manufacturer?: string;
  VehicleType?: string;
  AirBagLocFront?: string;
  AirBagLocSide?: string;
  AirBagLocCurtain?: string;
  SeatBeltsAll?: string;
  Seats?: string;
  // Factory safety + driver-assistance equipment (Standard/Optional/Not Available).
  ABS?: string;
  ESC?: string;
  TractionControl?: string;
  TPMS?: string;
  ForwardCollisionWarning?: string;
  CIB?: string;
  BlindSpotMon?: string;
  LaneDepartureWarning?: string;
  LaneKeepSystem?: string;
  AdaptiveCruiseControl?: string;
  RearVisibilitySystem?: string;
  RearCrossTrafficAlert?: string;
  ParkAssist?: string;
  ErrorCode?: string;
  ErrorText?: string;
}

interface ComplaintApiRow {
  components?: string;
  summary?: string;
  crash?: boolean | string;
  fire?: boolean | string;
  numberOfInjuries?: number;
  numberOfDeaths?: number;
}

const truthy = (v: boolean | string | undefined): boolean =>
  v === true || v === 'Yes' || v === 'yes' || v === 'true';

/** Map a raw vPIC Extended row into VehicleSpecs. Pure — used by decodeVin + tests. */
export function mapVpicRow(row: VPicDecodeRow): VehicleSpecs | null {
  if (!isUsableVpicDecode(row)) return null;

  const yearNum = cleanNum(row.ModelYear);
  const displRaw = cleanNum(row.DisplacementL);
  const displNum = displRaw != null ? round1(displRaw) : null;
  const cylNum = cleanNum(row.EngineCylinders);
  const hpNum = cleanNum(row.EngineHP);
  const doorsNum = cleanNum(row.Doors);
  const speedsNum = cleanNum(row.TransmissionSpeeds);
  const batteryKWh = cleanNum(row.BatteryKWh);

  const engineModel = cleanStr(row.EngineModel);
  const otherEngine = cleanStr(row.OtherEngineInfo);
  const motor = cleanStr(row.Motor);
  const engineBits = [
    engineModel,
    displNum != null ? `${displNum}L` : undefined,
    !engineModel && otherEngine ? otherEngine : undefined,
    !engineModel && !otherEngine && motor ? motor : undefined,
  ].filter(Boolean);
  const engine = engineBits.length ? engineBits.join(' ') : undefined;

  const make = prettyLabel(row.Make) ?? cleanStr(row.Make);
  const model = cleanStr(row.Model);
  // Prefer Trim; Series is often a chassis code (AXAA52L…) — only use when trim empty
  // and Series looks human (has a letter+space or common trim pattern), else skip.
  const trim = cleanStr(row.Trim) ?? humanSeries(row.Series);

  return {
    year: yearNum ?? undefined,
    make: make || undefined,
    model: model || undefined,
    trim: trim || undefined,
    engine,
    displacementL: displNum ?? undefined,
    cylinders: cylNum != null && cylNum > 0 ? cylNum : undefined,
    horsepower: hpNum != null && hpNum > 0 ? Math.round(hpNum) : undefined,
    valveTrain: prettyLabel(row.ValveTrainDesign) ?? cleanStr(row.ValveTrainDesign),
    engineConfig: prettyLabel(row.EngineConfiguration) ?? cleanStr(row.EngineConfiguration),
    fuelType: prettyLabel(row.FuelTypePrimary) ?? cleanStr(row.FuelTypePrimary),
    fuelTypeSecondary: prettyLabel(row.FuelTypeSecondary) ?? cleanStr(row.FuelTypeSecondary),
    electrification: cleanStr(row.ElectrificationLevel),
    batteryKWh: batteryKWh != null && batteryKWh > 0 ? round1(batteryKWh) : undefined,
    evDriveUnit: prettyLabel(row.EVDriveUnit) ?? cleanStr(row.EVDriveUnit),
    transmission: prettyLabel(row.TransmissionStyle) ?? cleanStr(row.TransmissionStyle),
    transmissionSpeeds: speedsNum != null && speedsNum > 0 ? speedsNum : undefined,
    drive: cleanStr(row.DriveType),
    bodyClass: cleanStr(row.BodyClass),
    doors: doorsNum != null && doorsNum > 0 ? doorsNum : undefined,
    gvwr: cleanStr(row.GVWR),
    plant: formatPlant(row.PlantCity, row.PlantState, row.PlantCountry),
    manufacturer: prettyLabel(row.Manufacturer) ?? cleanStr(row.Manufacturer),
    vehicleType: prettyLabel(row.VehicleType) ?? cleanStr(row.VehicleType),
    airbags: formatAirbags(row.AirBagLocFront, row.AirBagLocSide, row.AirBagLocCurtain),
    seatBelts: prettyLabel(row.SeatBeltsAll) ?? cleanStr(row.SeatBeltsAll),
    seats: cleanNum(row.Seats) != null && cleanNum(row.Seats)! > 0 ? cleanNum(row.Seats)! : undefined,
    // Factory safety + driver-assistance equipment — raw presence strings, kept
    // as-is; buildSafetyEquipmentRows decides which to show.
    abs: cleanStr(row.ABS),
    esc: cleanStr(row.ESC),
    tractionControl: cleanStr(row.TractionControl),
    tpms: cleanStr(row.TPMS),
    forwardCollisionWarning: cleanStr(row.ForwardCollisionWarning),
    autoEmergencyBraking: cleanStr(row.CIB),
    blindSpotMonitor: cleanStr(row.BlindSpotMon),
    laneDepartureWarning: cleanStr(row.LaneDepartureWarning),
    laneKeepAssist: cleanStr(row.LaneKeepSystem),
    adaptiveCruiseControl: cleanStr(row.AdaptiveCruiseControl),
    backupCamera: cleanStr(row.RearVisibilitySystem),
    rearCrossTrafficAlert: cleanStr(row.RearCrossTrafficAlert),
    parkAssist: cleanStr(row.ParkAssist),
  };
}

/** Series like "Sport" ok; chassis codes like "AXAA52L/AXAA54L" are not trim. */
function humanSeries(series: string | undefined): string | undefined {
  const s = cleanStr(series);
  if (!s) return undefined;
  if (/^[A-Z0-9]+(\/[A-Z0-9]+)+$/i.test(s)) return undefined;
  if (/^[A-Z]{2,}\d+[A-Z0-9-]*$/i.test(s) && !/\s/.test(s)) return undefined;
  return s;
}

/**
 * Decode a VIN via vPIC's extended endpoint. Returns the full spec block.
 * Accepts check-digit failures when year/make/model still decode (common for
 * slightly-wrong OCR VINs that still identify the vehicle).
 */
export async function decodeVin(vin: string): Promise<VehicleSpecs | null> {
  const cleaned = vin?.trim().toUpperCase();
  if (!cleaned || cleaned.length < 11) return null;
  // Cache decodes 30 days, keyed by VIN. A VIN's factory record never changes,
  // so re-scans are instant, and — via cachedJson's degrade-on-error stale
  // fallback — a transient vPIC outage on a VIN we've decoded before returns
  // the known car instead of collapsing to "couldn't decode" (or worse, an
  // empty report). An unusable decode (mapVpicRow → null) is not cached, so a
  // real failure is never frozen as undecodable.
  return cachedJson<VehicleSpecs>(`vinplain:decode:v1:${cleaned}`, 30 * DAY, async () => {
    const url = `${VPIC_BASE}/DecodeVinValuesExtended/${encodeURIComponent(cleaned)}?format=json`;
    const data = await fetchJson<{ Results?: VPicDecodeRow[] }>(url);
    const row = data?.Results?.[0];
    if (!row) return null;
    return mapVpicRow(row);
  });
}

/**
 * Aggregate owner complaints by component, plus serious-incident tallies.
 * Returns null only when the fetch itself fails (so the section can show
 * "unavailable"); an empty result set returns a real total-of-0 summary.
 */
export async function lookupComplaints(opts: {
  make?: string;
  model?: string;
  year?: number;
}): Promise<ComplaintSummary | null> {
  if (!opts.make || !opts.model || !opts.year) return null;
  const url =
    `${NHTSA_BASE}/complaints/complaintsByVehicle?make=${encodeURIComponent(opts.make)}` +
    `&model=${encodeURIComponent(opts.model)}&modelYear=${opts.year}`;
  // Complaints payloads are multi-MB for high-volume nameplates (a 2003 Accord
  // is ~1.9MB / 2000+ rows and takes ~7s cold), so use the generous, configurable
  // complaints timeout rather than dropping the data. Repeat fetches are fast
  // (server-cached + our own cache), so this only costs the first render.
  const data = await fetchJson<{ results?: ComplaintApiRow[] }>(url, {
    timeoutMs: getComplaintsTimeoutMs(),
  });
  if (!data) return null;
  const results = data.results ?? [];

  const byComponent = new Map<string, { count: number; sample: string }>();
  let crashes = 0;
  let fires = 0;
  let injuries = 0;
  let deaths = 0;
  for (const c of results) {
    const comp = (c.components || 'Other').split(',')[0]!.trim();
    const entry = byComponent.get(comp);
    if (entry) entry.count += 1;
    else byComponent.set(comp, { count: 1, sample: (c.summary || '').slice(0, 240) });
    if (truthy(c.crash)) crashes += 1;
    if (truthy(c.fire)) fires += 1;
    injuries += Number(c.numberOfInjuries) || 0;
    deaths += Number(c.numberOfDeaths) || 0;
  }

  const topComponents = Array.from(byComponent.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([component, v]) => ({ component, count: v.count, sampleSummary: v.sample }));

  return { total: results.length, topComponents, crashes, fires, injuries, deaths };
}
