/**
 * Public types for the vinplain data layer.
 * Sources: NHTSA vPIC, NHTSA recalls/complaints/NCAP, and the US DOE
 * fuel-economy API.
 */

export interface VehicleQuery {
  year: number;
  make: string;
  model: string;
  trim?: string;
  vin?: string;
  /** Optional hints from a VIN decode, used to pick better NCAP/EPA variants. */
  driveHint?: string;
  bodyHint?: string;
  cylindersHint?: number;
  /** Fuel / electrification ("Hybrid", "Electric", "Diesel"). Load-bearing:
   *  EPA puts electrification in the model name ("RAV4 Hybrid AWD"), not the
   *  option text, so without this a hybrid can resolve to the gas trim. */
  fuelHint?: string;
}

/** Engine and specification block, from a vPIC decode or an EPA record. */
export interface VehicleSpecs {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  engine?: string;
  displacementL?: number;
  cylinders?: number;
  /** Engine horsepower when vPIC provides it. */
  horsepower?: number;
  /** e.g. "Dual Overhead Cam (DOHC)". */
  valveTrain?: string;
  /** e.g. "V-Shaped", "In-Line". */
  engineConfig?: string;
  fuelType?: string;
  /** Secondary fuel when present. */
  fuelTypeSecondary?: string;
  /** e.g. "BEV (Battery Electric Vehicle)". */
  electrification?: string;
  /** Battery capacity kWh for EVs when present. */
  batteryKWh?: number;
  /** e.g. "Dual Motor", "Quad Motor". */
  evDriveUnit?: string;
  transmission?: string;
  transmissionSpeeds?: number;
  drive?: string;
  bodyClass?: string;
  doors?: number;
  gvwr?: string;
  /** Formatted "City, State, Country" when available. */
  plant?: string;
  manufacturer?: string;
  vehicleType?: string;
  /** Compact airbag location summary. */
  airbags?: string;
  seatBelts?: string;
  /** Factory seating capacity (vPIC Seats). */
  seats?: number;
  // Factory safety and driver-assistance equipment, as vPIC reports it:
  // "Standard" | "Optional" | "Not Available" (TPMS: "Direct" | "Indirect").
  abs?: string;
  esc?: string;
  tractionControl?: string;
  tpms?: string;
  forwardCollisionWarning?: string;
  autoEmergencyBraking?: string;
  blindSpotMonitor?: string;
  laneDepartureWarning?: string;
  laneKeepAssist?: string;
  adaptiveCruiseControl?: string;
  backupCamera?: string;
  rearCrossTrafficAlert?: string;
  parkAssist?: string;
}

/** One NHTSA recall campaign. */
export interface RecallCampaign {
  campaignId?: string;
  component: string;
  summary: string;
  consequence?: string;
  remedy?: string;
  reportedDate?: string;
}

/** Aggregated NHTSA owner complaints, including serious-incident tallies. */
export interface ComplaintSummary {
  total: number;
  topComponents: Array<{
    component: string;
    count: number;
    sampleSummary: string;
  }>;
  crashes: number;
  fires: number;
  injuries: number;
  deaths: number;
}

/** NCAP equipment presence for crash-avoidance technology. */
export type AdasPresence = 'standard' | 'optional' | 'not_available';

/** NCAP crash-test ratings. Stars are 1-5, or null when not tested. */
export interface SafetyRating {
  vehicleDescription: string;
  variantCount: number;
  overall: number | null;
  frontal: number | null;
  side: number | null;
  sidePole?: number | null;
  rollover: number | null;
  /** Probability of rollover in a single-vehicle crash, 0-1 when published. */
  rolloverPossibility?: number | null;
  electronicStabilityControl?: AdasPresence;
  forwardCollisionWarning?: AdasPresence;
  laneDepartureWarning?: AdasPresence;
  /** NHTSA CDN URL for the frontal crash still, when published. */
  frontalCrashPictureUrl?: string;
  sideCrashPictureUrl?: string;
}

/** EPA fuel-economy and estimated annual fuel cost. */
export interface FuelEconomy {
  cityMpg: number | null;
  highwayMpg: number | null;
  combinedMpg: number | null;
  fuelType?: string;
  /** EPA annual fuel cost estimate, USD/year at 15k miles. */
  annualFuelCost: number | null;
  /** Tailpipe CO2, grams per mile. */
  co2GramsPerMile: number | null;
  transmission?: string;
  /** EPA "you save/spend" versus average over five years (negative = spend more). */
  youSaveSpend?: number | null;
  /** Passenger volume in cubic feet, preferring the 4-door figure. */
  passengerVolumeCuFt?: number | null;
  /** Luggage or cargo volume in cubic feet. */
  luggageVolumeCuFt?: number | null;
  /** EV range in miles when published. */
  evRangeMiles?: number | null;
  /** Distinguishing part of the EPA model used, e.g. "Hybrid AWD" or "Base". */
  variantLabel?: string;
  /** How many EPA variants share this nameplate. 1 means unambiguous. */
  variantCount?: number;
  /** Several variants exist and nothing discriminated between them, so these
   *  numbers are the base trim and may not be this car. */
  variantAmbiguous?: boolean;
  /** Combined-mpg spread across variants, only set when ambiguous. */
  combinedMpgRange?: { min: number; max: number };
}
