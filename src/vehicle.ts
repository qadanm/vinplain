/**
 * The free "research any car" data layer.
 * Government calls are wrapped in the injectable `cachedJson`. Sources, all
 * free + keyless:
 *   - vPIC  → make/model lists + extended VIN decode (in ./nhtsa)
 *   - NHTSA → recall campaigns + owner complaints + investigation flag
 *   - NCAP  → 5-star crash-test ratings + ADAS equipment
 *   - EPA   → fuel economy + annual fuel cost + volumes + EV range
 */
import { cachedJson, fetchJson } from './http';
import { lookupComplaints } from './nhtsa';
import { cleanNum, cleanStr, parseEquipment } from './normalize';
import type {
  ComplaintSummary,
  FuelEconomy,
  RecallCampaign,
  SafetyRating,
  VehicleQuery,
  VehicleSpecs,
} from './types';

const VPIC = 'https://vpic.nhtsa.dot.gov/api/vehicles';
const NHTSA = 'https://api.nhtsa.gov';
const FE = 'https://www.fueleconomy.gov/ws/rest';
const FE_JSON = { Accept: 'application/json' };

const DAY = 24 * 60 * 60 * 1000;

// ── Dropdown data (vPIC) ────────────────────────────────────────────────

/** Model years to offer, newest first. vPIC/NCAP/EPA coverage is solid 1996+. */
export function getYears(): number[] {
  const max = new Date().getFullYear() + 1;
  const years: number[] = [];
  for (let y = max; y >= 1996; y--) years.push(y);
  return years;
}

interface VpicMakeRow {
  MakeName?: string;
}

/**
 * Consumer car brands a used-car buyer would actually shop for. vPIC returns
 * hundreds of commercial/one-off manufacturers, so we intersect the live list
 * against this curated set.
 */
export const CONSUMER_MAKES = new Set([
  'acura', 'alfaromeo', 'astonmartin', 'audi', 'bentley', 'bmw', 'buick', 'cadillac',
  'chevrolet', 'chrysler', 'dodge', 'ferrari', 'fiat', 'fisker', 'ford', 'genesis', 'gmc',
  'honda', 'hummer', 'hyundai', 'infiniti', 'jaguar', 'jeep', 'kia', 'lamborghini',
  'landrover', 'lexus', 'lincoln', 'lotus', 'lucid', 'maserati', 'maybach', 'mazda',
  'mclaren', 'mercedesbenz', 'mercury', 'mini', 'mitsubishi', 'nissan', 'oldsmobile',
  'plymouth', 'polestar', 'pontiac', 'porsche', 'ram', 'rivian', 'rollsroyce', 'saab',
  'saturn', 'scion', 'smart', 'subaru', 'suzuki', 'tesla', 'toyota', 'volkswagen', 'volvo',
]);

export const normalizeMake = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Passenger-vehicle makes, de-duped, prettified, filtered to consumer brands. Cached 30 days. */
export async function getMakes(signal?: AbortSignal): Promise<string[]> {
  const result = await cachedJson<string[]>('vinplain:makes:v2', 30 * DAY, async () => {
    const [car, truck, mpv] = await Promise.all([
      fetchJson<{ Results?: VpicMakeRow[] }>(`${VPIC}/GetMakesForVehicleType/car?format=json`, { signal }),
      fetchJson<{ Results?: VpicMakeRow[] }>(`${VPIC}/GetMakesForVehicleType/truck?format=json`, { signal }),
      fetchJson<{ Results?: VpicMakeRow[] }>(`${VPIC}/GetMakesForVehicleType/mpv?format=json`, { signal }),
    ]);
    const rows = [...(car?.Results ?? []), ...(truck?.Results ?? []), ...(mpv?.Results ?? [])];
    if (!rows.length) return null;
    const seen = new Set<string>();
    const names: string[] = [];
    for (const r of rows) {
      const pretty = prettyMake(r.MakeName);
      if (pretty && CONSUMER_MAKES.has(normalizeMake(pretty)) && !seen.has(pretty)) {
        seen.add(pretty);
        names.push(pretty);
      }
    }
    return names.sort((a, b) => a.localeCompare(b));
  });
  return result ?? [];
}

interface VpicModelRow {
  Model_Name?: string;
}

/** Models for a make + year, merged across car/truck/mpv, sorted. Cached 7 days. */
export async function getModels(make: string, year: number, signal?: AbortSignal): Promise<string[]> {
  const key = `vinplain:models:v2:${make.toLowerCase()}:${year}`;
  const result = await cachedJson<string[]>(key, 7 * DAY, async () => {
    const base = `${VPIC}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}`;
    const [car, truck, mpv] = await Promise.all([
      fetchJson<{ Results?: VpicModelRow[] }>(`${base}/vehicleType/car?format=json`, { signal }),
      fetchJson<{ Results?: VpicModelRow[] }>(`${base}/vehicleType/truck?format=json`, { signal }),
      fetchJson<{ Results?: VpicModelRow[] }>(`${base}/vehicleType/mpv?format=json`, { signal }),
    ]);
    const rows = [...(car?.Results ?? []), ...(truck?.Results ?? []), ...(mpv?.Results ?? [])];
    if (!rows.length) return null;
    const seen = new Set<string>();
    const models: string[] = [];
    for (const r of rows) {
      const name = r.Model_Name?.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        models.push(name);
      }
    }
    return models.sort((a, b) => a.localeCompare(b));
  });
  return result ?? [];
}

// ── Model resolution ────────────────────────────────────────────────────

/**
 * NHTSA's recall/complaint/investigation model vocabulary differs from vPIC's
 * ("GX 460" → "GX460", "C-Class" → "C-CLASS"). Resolve the picked model against
 * NHTSA's own list for the make/year so the query actually hits.
 */
export async function resolveNhtsaModel(
  issueType: 'r' | 'c' | 'i',
  q: Pick<VehicleQuery, 'year' | 'make' | 'model'>,
): Promise<string> {
  const json = await fetchJson<{ results?: { model?: string }[] }>(
    `${NHTSA}/products/vehicle/models?modelYear=${q.year}&make=${encodeURIComponent(q.make)}&issueType=${issueType}`,
  ).catch(() => null);
  const models = (json?.results ?? []).map((r) => r.model).filter((m): m is string => !!m);
  return matchModel(models, q.model) ?? q.model;
}

/**
 * Every model string worth trying against recalls/complaints, most- to
 * least-confident.
 *
 * Two NHTSA vocabularies disagree, and they disagree silently. The model
 * directory (`/products/vehicle/models`) answers with decorated names, while
 * `recallsByVehicle` rejects exactly those with HTTP 400 and accepts the plain
 * nameplate. Measured against the live API 2026-07-20:
 *
 *   model="MODEL Y (All Variants)"  -> 400, Count 0     2024 Tesla
 *   model="MODEL Y"                 -> 200, Count 5
 *   model="F-150 SUPERCAB"          -> 400, Count 0     2020 Ford
 *   model="F-150"                   -> 200, Count 11
 *   model="F 150"                   -> 400, Count 0     (what deslug produces)
 *
 * Resolving to a single name and trusting it is how "0 NHTSA recalls" came to
 * be published on a Model Y with five open campaigns. So resolve to a list and
 * let the caller keep asking until NHTSA answers 200.
 *
 * Deduped case-insensitively but deliberately NOT punctuation-insensitively:
 * punctuation is the whole thing the endpoint is fussy about, so "F-150" and
 * "F 150" are two distinct attempts, not one.
 */
export async function nhtsaModelCandidates(
  issueType: 'r' | 'c' | 'i',
  q: Pick<VehicleQuery, 'year' | 'make' | 'model'>,
): Promise<string[]> {
  const json = await fetchJson<{ results?: { model?: string }[] }>(
    `${NHTSA}/products/vehicle/models?modelYear=${q.year}&make=${encodeURIComponent(q.make ?? '')}&issueType=${issueType}`,
  ).catch(() => null);
  const vocab = (json?.results ?? []).map((r) => r.model).filter((m): m is string => !!m);
  const model = q.model ?? '';
  const tight = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  const matched = matchModel(vocab, model);
  const ordered = [
    vocab.find((c) => tight(c) === tight(model)), // NHTSA's spelling of this exact nameplate
    model, //                                        what the caller actually asked for
    matched ? nameplatePrefix(matched, model) : null, // "F-150 SUPERCAB" -> "F-150"
    matched, //                                        the decorated name ("GLC-CLASS")
  ];

  const out: string[] = [];
  const seen = new Set<string>();
  for (const candidate of ordered) {
    const value = candidate?.trim();
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    out.push(value);
  }
  return out;
}

/**
 * The leading nameplate of a decorated vocabulary entry, cut where it stops
 * matching the query: ("F-150 SUPERCAB", "F 150") -> "F-150".
 *
 * Slices the original string instead of re-joining tokenizeModel's output, so
 * NHTSA's own punctuation survives the trip — which is the entire point, since
 * "F-150" is accepted where "F 150" is not. Cuts only on a whole-token
 * boundary, so "GLC" can never be sliced out of a hypothetical "GLCX".
 */
function nameplatePrefix(candidate: string, model: string): string | null {
  const target = model.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!target) return null;
  let acc = '';
  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i]!;
    if (/[a-z0-9]/i.test(ch)) acc += ch.toLowerCase();
    if (acc.length > target.length) return null;
    if (acc !== target) continue;
    const next = candidate[i + 1];
    if (next === undefined || !/[a-z0-9]/i.test(next)) return candidate.slice(0, i + 1);
  }
  return null;
}

// ── Recalls (NHTSA) ─────────────────────────────────────────────────────

interface RecallApiRow {
  NHTSACampaignNumber?: string;
  Component?: string;
  Summary?: string;
  Consequence?: string;
  Remedy?: string;
  ReportReceivedDate?: string;
}

/** Individual recall campaigns (capped at 20). Cached 24h. */
export async function getRecallsDetailed(
  q: Pick<VehicleQuery, 'year' | 'make' | 'model'>,
): Promise<RecallCampaign[] | null> {
  if (!q.make || !q.model || !q.year) return [];
  // v2: bumped with the family-name resolution fix to drop entries cached from
  // the buggy "GX" -> no-match path (e.g. an empty recalls list for a real model).
  // v3: NHTSA returns HTTP 400 + empty results for some YMM with genuinely
  // zero recalls (observed 2022 Corolla) — was mis-cached as "Unavailable".
  // v4: ...but 400 *also* means "I don't recognise that model string", and v3
  // read both as a confident zero. That published "0 NHTSA recalls" on a 2024
  // Model Y with five open campaigns and a 2020 F-150 with eleven. Ask every
  // candidate spelling now, and bump the key to evict the poisoned v3 entries.
  const key = `vinplain:recalls:v4:${q.year}:${q.make.toLowerCase()}:${q.model.toLowerCase()}`;
  const res = await cachedJson<RecallCampaign[]>(key, DAY, async () => {
    const candidates = await nhtsaModelCandidates('r', q);
    let sawEmpty = false;
    let sawFailure = false;
    for (const model of candidates) {
      const url =
        `${NHTSA}/recalls/recallsByVehicle?make=${encodeURIComponent(q.make!)}` +
        `&model=${encodeURIComponent(model)}&modelYear=${q.year}`;
      const data = await fetchRecallsByVehicle(url);
      if (data.status === 'ok') {
        // The cap bounds the payload, but recalls.length is also what the title
        // and meta description publish as the recall count — so a cap of 20 told
        // searchers a 2022 Explorer had 20 campaigns when NHTSA lists 24. Set it
        // clear of any real vehicle instead of near the top of the range.
        return data.results.slice(0, 50).map((r) => ({
          campaignId: r.NHTSACampaignNumber,
          component: titleCaseComponent((r.Component || 'Unknown component').split(':')[0]!.trim()),
          summary: r.Summary?.trim() ?? '',
          consequence: r.Consequence?.trim() || undefined,
          remedy: r.Remedy?.trim() || undefined,
          reportedDate: r.ReportReceivedDate || undefined,
        }));
      }
      if (data.status === 'empty') sawEmpty = true;
      else sawFailure = true;
    }
    // Every spelling came back empty. That is only a real "no recalls on file"
    // if nothing failed in transport on the way — a timeout or a throttled
    // request has to stay null so the page says "couldn't check" rather than
    // inventing a clean bill of health.
    return sawFailure || !sawEmpty ? null : [];
  });
  // null = the fetch failed (couldn't check) — distinct from [] = checked, no
  // recalls on file. Callers must not show "no recalls" on a failure.
  return res;
}

/**
 * One attempt at recallsByVehicle for one model spelling.
 *
 * NHTSA answers HTTP 400 with `{ Count: 0, results: [] }` in two situations the
 * response gives you no way to tell apart:
 *
 *   1. the year/make/model is valid and simply has no campaigns
 *      (live: 2022 Corolla, 2023 CX-5, 2020 GX 460), and
 *   2. the model string is one it does not recognise
 *      (live: "MODEL Y (All Variants)", "F 150").
 *
 * Both come back byte-identical. Reading either as a confident zero is what put
 * "0 NHTSA recalls" on the highest-ranking page on the site. So 400 reports the
 * narrow truth — 'empty', meaning *this spelling* returned nothing — and
 * getRecallsDetailed only calls a car clean once every spelling agrees.
 */
type RecallFetch =
  | { status: 'ok'; results: RecallApiRow[] }
  | { status: 'empty' }
  | { status: 'failed' };

async function fetchRecallsByVehicle(url: string): Promise<RecallFetch> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const body = (await res.json().catch(() => null)) as {
      results?: RecallApiRow[];
      Count?: number;
      count?: number;
    } | null;
    if (!body) return { status: 'failed' };
    const results = Array.isArray(body.results) ? body.results : [];
    if (res.ok) return { status: 'ok', results };
    if (res.status === 400 && results.length === 0) return { status: 'empty' };
    return { status: 'failed' };
  } catch {
    return { status: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}

// ── Complaints (NHTSA, with serious-incident tallies) ───────────────────

/** Owner complaints for the resolved model. Cached 24h. */
export async function getComplaints(
  q: Pick<VehicleQuery, 'year' | 'make' | 'model'>,
): Promise<ComplaintSummary | null> {
  if (!q.make || !q.model || !q.year) return null;
  // v3: same candidate-list treatment as recalls. A spelling NHTSA rejects
  // returns null here rather than a false zero, so complaints never invented a
  // clean record — but they did silently render "unavailable" for cars that
  // have thousands of filings, on exactly the nameplates recalls got wrong.
  const key = `vinplain:complaints:v3:${q.year}:${q.make.toLowerCase()}:${q.model.toLowerCase()}`;
  return cachedJson<ComplaintSummary>(key, DAY, async () => {
    const candidates = await nhtsaModelCandidates('c', q);
    let emptyAnswer: ComplaintSummary | null = null;
    for (const model of candidates) {
      const summary = await lookupComplaints({ year: q.year, make: q.make, model });
      if (summary?.total) return summary;
      // A zero-total summary is a real answer, but a later spelling may be the
      // one this car's filings actually live under. Hold it and keep looking.
      emptyAnswer ??= summary;
    }
    return emptyAnswer;
  });
}

// ── Investigation flag (NHTSA) ──────────────────────────────────────────

/** Whether the model appears in NHTSA's investigations list for the year. Cached 24h. */
export async function hasInvestigations(
  q: Pick<VehicleQuery, 'year' | 'make' | 'model'>,
): Promise<boolean> {
  if (!q.make || !q.model || !q.year) return false;
  const key = `vinplain:invflag:v2:${q.year}:${q.make.toLowerCase()}:${q.model.toLowerCase()}`;
  const res = await cachedJson<{ v: boolean }>(key, DAY, async () => {
    const json = await fetchJson<{ results?: { model?: string }[] }>(
      `${NHTSA}/products/vehicle/models?modelYear=${q.year}&make=${encodeURIComponent(q.make)}&issueType=i`,
    );
    if (!json) return null;
    const models = (json.results ?? []).map((r) => r.model).filter((m): m is string => !!m);
    return { v: matchModel(models, q.model) != null };
  });
  return res?.v ?? false;
}

// ── Safety ratings (NCAP) ───────────────────────────────────────────────

interface NcapVariantRow {
  VehicleId?: number;
  VehicleDescription?: string;
}
interface NcapRatingRow {
  VehicleDescription?: string;
  OverallRating?: string;
  OverallFrontCrashRating?: string;
  OverallSideCrashRating?: string;
  SidePoleCrashRating?: string;
  RolloverRating?: string;
  RolloverPossibility?: string;
  NHTSAElectronicStabilityControl?: string;
  NHTSAForwardCollisionWarning?: string;
  NHTSALaneDepartureWarning?: string;
  FrontCrashPicture?: string;
  SideCrashPicture?: string;
}

/** Score an NCAP variant description against optional VIN drive/body hints. */
function scoreNcapVariant(desc: string, q: VehicleQuery): number {
  const d = desc.toLowerCase();
  let score = 0;
  const drive = (q.driveHint ?? '').toLowerCase();
  if (drive) {
    if (/(awd|all-?wheel|4wd|4x4)/.test(drive) && /(awd|4wd|4x4)/.test(d)) score += 3;
    else if (/(fwd|front)/.test(drive) && /fwd/.test(d)) score += 3;
    else if (/(rwd|rear)/.test(drive) && /rwd/.test(d)) score += 3;
  }
  const body = (q.bodyHint ?? '').toLowerCase();
  if (body) {
    if (/pickup|truck/.test(body) && /pickup|truck/.test(d)) score += 2;
    if (/suv|multipurpose|mpv|crossover/.test(body) && /(suv|utility|crossover)/.test(d)) score += 2;
    if (/sedan|saloon/.test(body) && /(sedan|4 dr|4dr)/.test(d)) score += 2;
    if (/coupe/.test(body) && /(coupe|2 dr|2dr)/.test(d)) score += 2;
  }
  // Prefer variants that look like passenger cars with door counts in the label.
  if (/\d\s*dr/.test(d)) score += 1;
  return score;
}

function pickNcapVariant(variants: NcapVariantRow[], q: VehicleQuery): NcapVariantRow | undefined {
  const usable = variants.filter((v) => typeof v.VehicleId === 'number');
  if (!usable.length) return undefined;
  let best = usable[0]!;
  let bestScore = -1;
  for (const v of usable) {
    const score = scoreNcapVariant(v.VehicleDescription ?? '', q);
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

function mapNcapRow(row: NcapRatingRow, variant: NcapVariantRow, variantCount: number): SafetyRating {
  const frontalPic = cleanStr(row.FrontCrashPicture);
  const sidePic = cleanStr(row.SideCrashPicture);
  const rolloverPoss = cleanNum(row.RolloverPossibility);
  return {
    vehicleDescription: row.VehicleDescription || variant.VehicleDescription || '',
    variantCount,
    overall: parseStar(row.OverallRating),
    frontal: parseStar(row.OverallFrontCrashRating),
    side: parseStar(row.OverallSideCrashRating),
    sidePole: parseStar(row.SidePoleCrashRating),
    rollover: parseStar(row.RolloverRating),
    rolloverPossibility:
      rolloverPoss != null && rolloverPoss > 0 && rolloverPoss < 1 ? rolloverPoss : null,
    electronicStabilityControl: parseEquipment(row.NHTSAElectronicStabilityControl),
    forwardCollisionWarning: parseEquipment(row.NHTSAForwardCollisionWarning),
    laneDepartureWarning: parseEquipment(row.NHTSALaneDepartureWarning),
    frontalCrashPictureUrl: frontalPic?.startsWith('http') ? frontalPic : undefined,
    sideCrashPictureUrl: sidePic?.startsWith('http') ? sidePic : undefined,
  };
}

/** 5-star crash-test ratings + ADAS. Two-step: list variants → best match. Cached 7d. */
export async function getSafetyRatings(q: VehicleQuery): Promise<SafetyRating | null> {
  if (!q.make || !q.model || !q.year) return null;
  const hintKey = `${(q.driveHint ?? '').toLowerCase()}|${(q.bodyHint ?? '').toLowerCase()}`;
  // v5: back to the two crash stills NHTSA mirrors reliably. v4 carried video
  // URLs and a resolved-media pass; that was removed with the video feature.
  const key = `vinplain:ncap:v5:${q.year}:${q.make.toLowerCase()}:${q.model.toLowerCase()}:${hintKey}`;
  return cachedJson<SafetyRating>(key, 7 * DAY, async () => {
    const allUrl = `${NHTSA}/SafetyRatings/modelyear/${q.year}/make/${encodeURIComponent(q.make)}`;
    const all = await fetchJson<{ Results?: { Model?: string }[] }>(allUrl).catch(() => null);
    const ncapModels = (all?.Results ?? []).map((r) => r.Model).filter((m): m is string => !!m);
    const model = matchModel(ncapModels, q.model) ?? q.model;

    const listUrl = `${NHTSA}/SafetyRatings/modelyear/${q.year}/make/${encodeURIComponent(
      q.make,
    )}/model/${encodeURIComponent(model)}`;
    const list = await fetchJson<{ Count?: number; Results?: NcapVariantRow[] }>(listUrl);
    const variants = list?.Results ?? [];
    const chosen = pickNcapVariant(variants, q);
    if (!chosen?.VehicleId) return null;

    const detail = await fetchJson<{ Results?: NcapRatingRow[] }>(
      `${NHTSA}/SafetyRatings/VehicleId/${chosen.VehicleId}`,
    );
    const row = detail?.Results?.[0];
    if (!row) return null;
    return mapNcapRow(row, chosen, variants.length);
  });
}

// ── Fuel economy + specs (EPA fueleconomy.gov) ──────────────────────────

interface FeMenuItem {
  text?: string;
  value?: string;
}
interface FeVehicle {
  make?: string;
  model?: string;
  city08?: string;
  highway08?: string;
  comb08?: string;
  fuelType?: string;
  fuelType1?: string;
  fuelCost08?: string;
  co2TailpipeGpm?: string;
  trany?: string;
  cylinders?: string;
  displ?: string;
  drive?: string;
  VClass?: string;
  youSaveSpend?: string;
  pv2?: string;
  pv4?: string;
  lv2?: string;
  lv4?: string;
  range?: string;
  rangeCity?: string;
  rangeHwy?: string;
}

/** Score EPA option text against trim / drive / cylinder hints from the query. */
function scoreEpaOption(text: string, q: VehicleQuery): number {
  const t = text.toLowerCase();
  let score = 0;
  const trim = (q.trim ?? '').toLowerCase().trim();
  if (trim) {
    if (t.includes(trim)) score += 5;
    for (const token of trim.split(/[\s/-]+/).filter((x) => x.length > 1)) {
      if (t.includes(token)) score += 2;
    }
  }
  const drive = (q.driveHint ?? '').toLowerCase();
  if (drive) {
    if (/(awd|4wd|4x4)/.test(drive) && /(awd|4wd|4x4)/.test(t)) score += 3;
    if (/(fwd|front)/.test(drive) && /fwd/.test(t)) score += 3;
    if (/(rwd|rear)/.test(drive) && /rwd/.test(t)) score += 3;
  }
  if (q.cylindersHint != null && t.includes(`${q.cylindersHint} cyl`)) score += 2;
  return score;
}

function pickEpaOption(options: FeMenuItem[], q: VehicleQuery): FeMenuItem | undefined {
  if (!options.length) return undefined;
  let best = options[0]!;
  let bestScore = -1;
  for (const o of options) {
    const score = scoreEpaOption(o.text ?? '', q);
    if (score > bestScore) {
      best = o;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Score an EPA model name's variant part against the query's hints. This is
 * where drivetrain and electrification actually live ("RAV4 Hybrid AWD"), so
 * this — not scoreEpaOption — is what decides which car the numbers describe.
 * Wrong-direction matches score negative: a front-wheel-drive car must never
 * land on an AWD trim, and a gas car must never land on the hybrid.
 */
function scoreEpaModelName(full: string, base: string, q: VehicleQuery): number {
  const v = epaVariantLabel(full, base).toLowerCase();
  if (v === 'base') return 0;
  let score = 0;

  const drive = (q.driveHint ?? '').toLowerCase();
  if (drive) {
    const wantsAll = /(awd|4wd|4x4|all.wheel|four.wheel)/.test(drive);
    const wantsFront = /(fwd|front)/.test(drive);
    const wantsRear = /(rwd|rear)/.test(drive);
    const hasAll = /(awd|4wd|4x4|4matic|quattro|xdrive)/.test(v);
    const hasFront = /\bfwd\b/.test(v);
    const hasRear = /\brwd\b/.test(v);
    if (wantsAll && hasAll) score += 4;
    if (wantsFront && hasFront) score += 4;
    if (wantsRear && hasRear) score += 4;
    if ((wantsFront || wantsRear) && hasAll) score -= 4;
    if (wantsAll && (hasFront || hasRear)) score -= 4;
  }

  // Order matters: a vPIC hybrid reads "HEV (Hybrid Electric Vehicle) Gasoline
  // Electric" and contains "electric", so plug-in and hybrid are settled before
  // electric is considered, or every hybrid would match an EV trim.
  const fuel = (q.fuelHint ?? '').toLowerCase();
  const wantsPlug = /(plug-?in|phev)/.test(fuel);
  const wantsHybrid = !wantsPlug && /(hybrid|hev)/.test(fuel);
  const wantsElectric = !wantsPlug && !wantsHybrid && /(electric|bev)/.test(fuel);
  const wantsDiesel = /diesel/.test(fuel);
  const hasPlug = /(plug-?in|phev|prime)/.test(v);
  const hasHybrid = /hybrid/.test(v);
  const hasElectric = /(electric|\bev\b)/.test(v);
  const hasDiesel = /diesel/.test(v);
  if (wantsPlug && hasPlug) score += 6;
  if (wantsHybrid && hasHybrid) score += 5;
  if (wantsElectric && hasElectric) score += 6;
  if (wantsDiesel && hasDiesel) score += 5;
  const wantsElectrified = wantsPlug || wantsHybrid || wantsElectric || wantsDiesel;
  if (!wantsElectrified && (hasPlug || hasHybrid || hasElectric || hasDiesel)) {
    // Either the car is plain gas, or we have no fuel signal at all. Both cases
    // must stay off the electrified trims rather than drift onto them.
    score -= fuel ? 6 : 2;
  }

  const trim = (q.trim ?? '').toLowerCase().trim();
  if (trim) {
    if (v.includes(trim)) score += 3;
    for (const token of trim.split(/[\s/-]+/).filter((x) => x.length > 1)) {
      if (v.includes(token)) score += 1;
    }
  }
  return score;
}

/** A resolved EPA record plus the variant context needed to say honestly how
 *  much the caller should trust it. */
interface EpaResolution {
  vehicle: FeVehicle;
  /** EPA model name the record came from. */
  model: string;
  /** Every EPA model sharing this nameplate, shortest (base) first. */
  candidates: string[];
  /** More than one variant existed and no hint discriminated, so `model` is
   *  the base trim by fallback rather than by evidence. */
  ambiguous: boolean;
}

/** Resolve + fetch the EPA vehicle record once; cached 7d. Powers
 *  getFuelEconomy and getEpaSpecs (later callers hit cache). */
async function fetchEpaVehicle(q: VehicleQuery): Promise<EpaResolution | null> {
  if (!q.make || !q.model || !q.year) return null;
  const hintKey = `${(q.trim ?? '').toLowerCase()}|${(q.driveHint ?? '').toLowerCase()}|${(
    q.fuelHint ?? ''
  ).toLowerCase()}|${q.cylindersHint ?? ''}`;
  // v3: variant-aware model pick — EPA encodes drive/electrification in the name.
  const key = `vinplain:epa:v3:${q.year}:${q.make.toLowerCase()}:${q.model.toLowerCase()}:${hintKey}`;
  return cachedJson<EpaResolution>(key, 7 * DAY, async () => {
    const modelMenu = await fetchJson<{ menuItem?: FeMenuItem | FeMenuItem[] }>(
      `${FE}/vehicle/menu/model?year=${q.year}&make=${encodeURIComponent(q.make)}`,
      { headers: FE_JSON },
    );
    const feModels = asArray(modelMenu?.menuItem)
      .map((m) => m.value)
      .filter((v): v is string => !!v);
    const candidates = matchModelCandidates(feModels, q.model);
    if (!candidates.length) return null;

    const base = candidates[0]!;
    let feModel = base;
    let bestScore = 0;
    for (const c of candidates) {
      const score = scoreEpaModelName(c, base, q);
      if (score > bestScore) {
        bestScore = score;
        feModel = c;
      }
    }
    const ambiguous = candidates.length > 1 && bestScore <= 0;

    const optionMenu = await fetchJson<{ menuItem?: FeMenuItem | FeMenuItem[] }>(
      `${FE}/vehicle/menu/options?year=${q.year}&make=${encodeURIComponent(
        q.make,
      )}&model=${encodeURIComponent(feModel)}`,
      { headers: FE_JSON },
    );
    const options = asArray(optionMenu?.menuItem);
    const chosen = pickEpaOption(options, q);
    if (!chosen?.value) return null;

    const v = await fetchJson<FeVehicle>(`${FE}/vehicle/${chosen.value}`, { headers: FE_JSON });
    if (!v) return null;
    return { vehicle: v, model: feModel, candidates, ambiguous };
  });
}

/** Cap on how many variants get priced for the honest range. This is a
 *  disclosure aid on an already-ambiguous query, not a hot path. */
const EPA_RANGE_MAX_VARIANTS = 5;

/** Combined-mpg spread across a nameplate's variants, so an unresolved query
 *  can say "27-40 depending on trim" instead of stating one arbitrary number
 *  as fact. Only called when ambiguous; cached per nameplate. */
async function epaCombinedMpgRange(
  q: VehicleQuery,
  candidates: string[],
): Promise<{ min: number; max: number } | undefined> {
  const list = candidates.slice(0, EPA_RANGE_MAX_VARIANTS);
  if (list.length < 2) return undefined;
  const key = `vinplain:epa-range:v1:${q.year}:${q.make.toLowerCase()}:${q.model.toLowerCase()}`;
  const range = await cachedJson<{ min: number; max: number }>(key, 7 * DAY, async () => {
    const mpgs = (
      await Promise.all(
        list.map(async (feModel) => {
          try {
            const optionMenu = await fetchJson<{ menuItem?: FeMenuItem | FeMenuItem[] }>(
              `${FE}/vehicle/menu/options?year=${q.year}&make=${encodeURIComponent(
                q.make,
              )}&model=${encodeURIComponent(feModel)}`,
              { headers: FE_JSON },
            );
            const first = asArray(optionMenu?.menuItem)[0];
            if (!first?.value) return null;
            const v = await fetchJson<FeVehicle>(`${FE}/vehicle/${first.value}`, {
              headers: FE_JSON,
            });
            return parseNum(v?.comb08);
          } catch {
            return null;
          }
        }),
      )
    ).filter((n): n is number => n != null && n > 0);
    if (mpgs.length < 2) return null;
    const min = Math.min(...mpgs);
    const max = Math.max(...mpgs);
    return max > min ? { min, max } : null;
  });
  return range ?? undefined;
}
export async function getFuelEconomy(q: VehicleQuery): Promise<FuelEconomy | null> {
  const res = await fetchEpaVehicle(q);
  if (!res) return null;
  const v = res.vehicle;
  const combinedMpgRange = res.ambiguous
    ? await epaCombinedMpgRange(q, res.candidates).catch(() => undefined)
    : undefined;
  const pv4 = parseNum(v.pv4);
  const pv2 = parseNum(v.pv2);
  const lv4 = parseNum(v.lv4);
  const lv2 = parseNum(v.lv2);
  const range = parseNum(v.range);
  const youSaveSpend = parseNum(v.youSaveSpend);
  return {
    cityMpg: parseNum(v.city08),
    highwayMpg: parseNum(v.highway08),
    combinedMpg: parseNum(v.comb08),
    fuelType: cleanStr(v.fuelType1) || cleanStr(v.fuelType) || undefined,
    annualFuelCost: parseNum(v.fuelCost08),
    co2GramsPerMile: parseNum(v.co2TailpipeGpm),
    transmission: cleanStr(v.trany) || undefined,
    youSaveSpend,
    passengerVolumeCuFt: (pv4 != null && pv4 > 0 ? pv4 : pv2 != null && pv2 > 0 ? pv2 : null),
    luggageVolumeCuFt: (lv4 != null && lv4 > 0 ? lv4 : lv2 != null && lv2 > 0 ? lv2 : null),
    evRangeMiles: range != null && range > 0 ? range : null,
    variantLabel: epaVariantLabel(res.model, res.candidates[0] ?? res.model),
    variantCount: res.candidates.length,
    variantAmbiguous: res.ambiguous || undefined,
    combinedMpgRange,
  };
}

export async function getEpaSpecs(q: VehicleQuery): Promise<VehicleSpecs | null> {
  const res = await fetchEpaVehicle(q);
  if (!res) return null;
  const v = res.vehicle;
  const cyl = parseNum(v.cylinders);
  const displ = parseNum(v.displ);
  const engine =
    [cyl ? `${cyl}-cyl` : undefined, displ ? `${displ}L` : undefined].filter(Boolean).join(' ') ||
    undefined;
  return {
    year: q.year,
    // Prefer EPA's canonical casing ("GX 460", "Lexus") over the lowercased query.
    make: cleanStr(v.make) || q.make,
    model: cleanStr(v.model) || q.model,
    engine,
    cylinders: cyl ?? undefined,
    displacementL: displ ?? undefined,
    fuelType: cleanStr(v.fuelType) || cleanStr(v.fuelType1) || undefined,
    transmission: cleanStr(v.trany) || undefined,
    drive: cleanStr(v.drive) || undefined,
    bodyClass: cleanStr(v.VClass) || undefined,
  };
}

/** Prefer primary (usually VIN) fields; fill gaps from fallback (usually EPA). */
export function mergeSpecs(
  primary: VehicleSpecs | null | undefined,
  fallback: VehicleSpecs | null | undefined,
): VehicleSpecs | undefined {
  if (!primary && !fallback) return undefined;
  if (!primary) return fallback ?? undefined;
  if (!fallback) return primary;
  const out: VehicleSpecs = { ...fallback };
  for (const key of Object.keys(primary) as Array<keyof VehicleSpecs>) {
    const v = primary[key];
    if (v != null && v !== '') (out as Record<string, unknown>)[key] = v;
  }
  return out;
}
// ── helpers ─────────────────────────────────────────────────────────────

function asArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function parseNum(s: string | undefined): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseStar(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

/**
 * Resolve a picked model against a provider's model list. The providers don't
 * agree on names: vPIC's dropdown says "GX", NHTSA recalls/NCAP say "GX460",
 * EPA says "GX 460". So:
 *  1. Exact match on a punctuation/space-insensitive key ("GX 460" === "GX460").
 *  2. Whole-token prefix, tokenizing on whitespace, hyphens, AND letter↔digit
 *     boundaries — so "GX460" and "GX 460" both tokenize to [GX, 460] and the
 *     family query "GX" matches as a whole-token prefix. This is what lets a
 *     dropdown "GX" find NHTSA's "GX460" recalls. "F-150" → "F-150 SUPER CREW"
 *     and "GLC" → "GLC-CLASS" resolve too.
 * It still refuses substring matches that span a token boundary, so
 * "GLC" ↛ "GL-CLASS" and "Cherokee" ↛ "Grand Cherokee".
 */
function tokenizeModel(s: string): string[] {
  return s
    .replace(/([a-z])(\d)/gi, '$1 $2') // GX460 -> GX 460
    .replace(/(\d)([a-z])/gi, '$1 $2') // 200t  -> 200 t
    .split(/[\s-]+/)
    .filter(Boolean);
}

function matchModel(candidates: string[], model: string): string | null {
  const tight = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const m = tight(model);
  if (!m) return null;

  const exact = candidates.find((c) => tight(c) === m);
  if (exact) return exact;

  // Prefer the shortest matching candidate so a family query ("GX") resolves to
  // the base nameplate ("GX460"), not a longer trim string.
  let best: string | null = null;
  let bestLen = Infinity;
  for (const c of candidates) {
    let acc = '';
    for (const token of tokenizeModel(c)) {
      acc += tight(token);
      if (acc === m) {
        if (c.length < bestLen) {
          best = c;
          bestLen = c.length;
        }
        break;
      }
      if (acc.length >= m.length) break;
    }
  }
  return best;
}

/**
 * Every provider model that resolves to the queried nameplate, shortest first.
 *
 * matchModel() returns one name and short-circuits on an exact hit. That is
 * right for recalls and NCAP, and wrong for EPA: EPA encodes drivetrain and
 * electrification in the model *name* ("RAV4", "RAV4 AWD", "RAV4 Hybrid AWD"),
 * so an exact hit on "RAV4" discards every other variant before a single hint
 * is read, on the VIN path as well as the dropdown path. Same token rules as
 * matchModel, so "Cherokee" still refuses "Grand Cherokee".
 */
function matchModelCandidates(candidates: string[], model: string): string[] {
  const tight = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const m = tight(model);
  if (!m) return [];

  const out: string[] = [];
  for (const c of candidates) {
    if (tight(c) === m) {
      out.push(c);
      continue;
    }
    let acc = '';
    for (const token of tokenizeModel(c)) {
      acc += tight(token);
      if (acc === m) {
        out.push(c);
        break;
      }
      if (acc.length >= m.length) break;
    }
  }
  // Shortest first: the plain nameplate is the base variant everything else
  // is described relative to.
  return out.sort((a, b) => a.length - b.length || a.localeCompare(b));
}

/**
 * The part of an EPA model name that distinguishes it from the base nameplate.
 *
 *   ("RAV4 Hybrid AWD",    "RAV4")            → "Hybrid AWD"
 *   ("F150 Pickup 4WD",    "F150 Pickup 2WD") → "4WD"
 *   ("F150 RAPTOR 4WD",    "F150 Pickup 2WD") → "RAPTOR 4WD"
 *   ("F-150 Lightning 4WD","F150 Pickup 2WD") → "Lightning 4WD"
 *
 * Drops the longest run of leading tokens the two share, rather than assuming
 * the base is a prefix of its siblings. It often is not: EPA's shortest 2022
 * F-150 name is "F150 Pickup 2WD", which carries its own drivetrain, so the
 * prefix assumption reduced every Raptor to a bare "4WD" and three separate
 * trims collapsed onto one slug. Token comparison ignores punctuation so
 * "F-150" and "F150" match.
 */
function epaVariantLabel(full: string, base: string): string {
  const tight = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (tight(full) === tight(base)) return 'Base';
  const fullTokens = full.split(/\s+/).filter(Boolean);
  const baseTokens = base.split(/\s+/).filter(Boolean);
  let shared = 0;
  while (
    shared < fullTokens.length &&
    shared < baseTokens.length &&
    tight(fullTokens[shared]!) === tight(baseTokens[shared]!)
  ) {
    shared += 1;
  }
  return fullTokens.slice(shared).join(' ').trim() || 'Base';
}

/** Title-case a raw NHTSA component label: "FUEL SYSTEM" → "Fuel System". */
export function titleCaseComponent(raw: string): string {
  return raw.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** Title-case a vPIC make, keeping vowel-less acronyms upper (BMW, GMC). */
function prettyMake(raw: string | undefined): string | null {
  const name = raw?.trim();
  if (!name) return null;
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((word) =>
      word
        .split('-')
        .map((part) => {
          if (part.length <= 3 && !/[aeiou]/.test(part)) return part.toUpperCase();
          return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join('-'),
    )
    .join(' ');
}
