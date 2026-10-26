/**
 * Shared string/number cleaners for government API payloads.
 * vPIC/NCAP/EPA return empty strings, "Not Applicable", "0", and ALL-CAPS
 * labels — normalize once here so web + app never diverge on presentation.
 */

const EMPTY_RE = /^(not applicable|n\/a|na|none|null|undefined|-|\.|–|—)$/i;

/** Trim and drop empty / placeholder government strings. */
export function cleanStr(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const t = String(value).trim();
  if (!t || EMPTY_RE.test(t)) return undefined;
  return t;
}

/** Parse a number; treat blank / non-finite / non-positive-zero placeholders as null. */
export function cleanNum(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

export const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Title-case a government label while keeping short vowel-less acronyms
 * (BMW, GMC, USA) and common drivetrain tokens upper.
 */
export function prettyLabel(raw: string | undefined | null): string | undefined {
  const name = cleanStr(raw);
  if (!name) return undefined;
  const keepUpper = new Set(['bmw', 'gmc', 'ram', 'usa', 'suv', 'mpv', 'bev', 'phev', 'hev', 'awd', 'fwd', 'rwd', '4wd', '4x4', 'v6', 'v8', 'v12']);
  return name
    .toLowerCase()
    .split(/(\s+|\/|, )/g)
    .map((part) => {
      if (/^\s+$/.test(part) || part === '/' || part === ', ') return part;
      const tight = part.replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (keepUpper.has(tight)) return part.toUpperCase();
      if (part.length <= 3 && tight.length >= 2 && !/[aeiou]/i.test(tight)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

/** "UNITED STATES (USA)" → "United States"; leave short codes alone. */
export function prettyCountry(raw: string | undefined | null): string | undefined {
  const s = cleanStr(raw);
  if (!s) return undefined;
  const noParen = s.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  return prettyLabel(noParen) ?? prettyLabel(s);
}

/** Build "Marysville, Ohio, United States" from plant parts. */
export function formatPlant(
  city?: string | null,
  state?: string | null,
  country?: string | null,
): string | undefined {
  const parts = [prettyLabel(city), prettyLabel(state), prettyCountry(country)].filter(
    (p): p is string => !!p,
  );
  return parts.length ? parts.join(', ') : undefined;
}

/** Compact airbag summary from vPIC location fields. */
export function formatAirbags(
  front?: string | null,
  side?: string | null,
  curtain?: string | null,
): string | undefined {
  const bits: string[] = [];
  const f = cleanStr(front);
  const s = cleanStr(side);
  const c = cleanStr(curtain);
  if (f) bits.push(`Front (${prettyLabel(f) ?? f})`);
  if (s) bits.push(`Side (${prettyLabel(s) ?? s})`);
  if (c) bits.push(`Curtain (${prettyLabel(c) ?? c})`);
  return bits.length ? bits.join(' · ') : undefined;
}

/**
 * vPIC ErrorCode is a comma-separated list. A decode is usable when year/make/model
 * are present — check-digit failures (code "1") still return real identity for
 * most US VINs. Reject only when identity is missing.
 */
export function isUsableVpicDecode(row: {
  ErrorCode?: string;
  Make?: string;
  Model?: string;
  ModelYear?: string;
}): boolean {
  const make = cleanStr(row.Make);
  const model = cleanStr(row.Model);
  const year = cleanNum(row.ModelYear);
  if (!make || !model || year == null || year < 1980 || year > 2100) return false;
  // Hard reject only when NHTSA reports a complete inability to decode.
  const codes = (row.ErrorCode ?? '0')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  // Code 14 alone with no model is already caught above. Keep permissive.
  if (codes.length === 1 && codes[0] === '7') return false; // manufacturer not registered
  return true;
}

/** NCAP equipment: Standard / Optional / Not Available → normalized. */
export type EquipmentPresence = 'standard' | 'optional' | 'not_available';

export function parseEquipment(raw: string | null | undefined): EquipmentPresence | undefined {
  const s = cleanStr(raw)?.toLowerCase();
  if (!s) return undefined;
  if (s === 'standard' || s === 'std') return 'standard';
  if (s === 'optional' || s === 'opt') return 'optional';
  if (s.includes('not') || s === 'n/a' || s === 'unavailable') return 'not_available';
  return undefined;
}

export function equipmentLabel(v: EquipmentPresence | undefined): string | undefined {
  if (v === 'standard') return 'Standard';
  if (v === 'optional') return 'Optional';
  if (v === 'not_available') return 'Not available';
  return undefined;
}
