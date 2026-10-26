/**
 * VIN validation + extraction, shared by the iOS app's camera scanner and the
 * website's photo-upload scan. A VIN read (from a door-jamb barcode, or OCR of
 * a dashboard / title / registration photo) is only useful if we can trust it.
 * This module answers three questions with no I/O:
 *   1. Is this string a well-formed VIN?            (isVinFormat)
 *   2. Does it pass the ISO 3779 check digit?       (isCheckDigitValid)
 *   3. Given noisy OCR text, what's the best VIN?   (extractVins / pickBestVin)
 *
 * Pure functions only, no camera, no network, so it's fully unit-testable and
 * safe to run in either a React Native app or an Astro server route.
 */

export const VIN_LENGTH = 17;

// A VIN is 17 chars from a 33-symbol alphabet: I, O, and Q are excluded so
// they can't be confused with 1, 0, and 0.
const VIN_ALLOWED = /^[A-HJ-NPR-Z0-9]{17}$/;

// ISO 3779 transliteration values for the check-digit computation.
const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
};

// Positional weights; position 9 (index 8) is the check digit itself (weight 0).
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Strip whitespace and punctuation and upcase. Labels are deliberately not
 * removed: "VIN" is also a legal WMI prefix, so deleting it could corrupt a
 * real VIN. Callers that need to remove a label should do so before calling.
 */
export function normalizeVin(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** 17 chars from the legal VIN alphabet (no I/O/Q). Does not check the digit. */
export function isVinFormat(candidate: string): boolean {
  return VIN_ALLOWED.test(candidate);
}

/**
 * ISO 3779 check digit for a 17-char VIN. Returns '0'-'9' or 'X', or '' if the
 * string contains a character with no transliteration value.
 */
export function computeCheckDigit(vin: string): string {
  if (vin.length !== VIN_LENGTH) return '';
  let sum = 0;
  for (let i = 0; i < VIN_LENGTH; i++) {
    const value = TRANSLIT[vin[i]!];
    if (value === undefined) return '';
    sum += value * WEIGHTS[i]!;
  }
  const mod = sum % 11;
  return mod === 10 ? 'X' : String(mod);
}

/**
 * Full validity: well-formed AND the check digit matches. This is the strong
 * signal we require before auto-accepting an OCR read.
 *
 * Note: a handful of (mostly older / non-US) manufacturers don't implement the
 * check digit, so a real VIN can fail this. That's why the scanner treats a
 * format-valid-but-check-failed barcode read as "confirm with the user" rather
 * than "reject" — see extractVins()' `checkDigitValid` flag.
 */
export function isCheckDigitValid(candidate: string): boolean {
  const vin = candidate.toUpperCase();
  if (!isVinFormat(vin)) return false;
  return computeCheckDigit(vin) === vin[8];
}

// ── WMI region (ISO 3780) ────────────────────────────────────────────────

export interface VinRegion {
  /** Coarse assembling region from the WMI first character. */
  region:
    | 'north_america'
    | 'south_america'
    | 'oceania'
    | 'africa'
    | 'asia'
    | 'europe'
    | 'unknown';
  /** Best-effort country/market label for the first character, for messaging. */
  market: string;
  /**
   * The ISO 3779 check digit is mandatory and reliable ONLY for North-American
   * VINs (WMI first char 1-5). Elsewhere manufacturers routinely leave position
   * 9 as filler, so a failing check digit there means nothing — it must never
   * trigger a single-char "repair" (which invents a character and corrupts a
   * real VIN) or a silent reject of a correctly-read VIN.
   */
  usesCheckDigit: boolean;
}

/** First-WMI-character → assembling country/region, for honest messaging. */
const FIRST_CHAR_MARKET: Record<string, string> = {
  '1': 'the United States', '4': 'the United States', '5': 'the United States',
  '2': 'Canada', '3': 'Mexico',
  '6': 'Australia', '7': 'New Zealand',
  '8': 'South America', '9': 'Brazil',
  J: 'Japan', K: 'South Korea', L: 'China', M: 'India', N: 'Turkey',
  P: 'Southeast Asia', R: 'Taiwan',
  S: 'the United Kingdom', T: 'Switzerland', U: 'Europe', V: 'France or Spain',
  W: 'Germany', X: 'Russia', Y: 'Northern Europe', Z: 'Italy',
};

/**
 * Classify a VIN (or bare WMI) by its first character. Pure, no I/O. Used to
 * decide whether the check digit is authoritative and to explain, honestly, why
 * a non-US-market VIN doesn't return US government records.
 */
export function wmiRegion(vinOrWmi: string): VinRegion {
  const c = (vinOrWmi?.[0] ?? '').toUpperCase();
  if (!c) return { region: 'unknown', market: 'an unlisted region', usesCheckDigit: false };
  let region: VinRegion['region'] = 'unknown';
  if ('12345'.includes(c)) region = 'north_america';
  else if ('67'.includes(c)) region = 'oceania';
  else if ('89'.includes(c)) region = 'south_america';
  else if (c >= 'A' && c <= 'H') region = 'africa';
  else if (c >= 'J' && c <= 'R') region = 'asia';
  else if (c >= 'S' && c <= 'Z') region = 'europe';
  return {
    region,
    market: FIRST_CHAR_MARKET[c] ?? 'an unlisted region',
    usesCheckDigit: region === 'north_america',
  };
}

// Classic OCR confusions, keyed by the illegal/misread character. We only ever
// substitute *toward* the legal VIN alphabet. I/O/Q are illegal in a VIN, so a
// read containing them is always an OCR error we can safely rewrite.
const OCR_FIXES: Record<string, string[]> = {
  I: ['1'],
  O: ['0'],
  Q: ['0'],
  // Ambiguous but legal glyphs — only tried when the raw read fails the check
  // digit, to recover a single misread character.
  B: ['8'],
  S: ['5'],
  Z: ['2'],
  G: ['6'],
  D: ['0'],
  T: ['7'],
  '1': ['I', '7'],
  '0': ['D', 'Q'],
  '8': ['B'],
  '5': ['S'],
  '2': ['Z'],
  '6': ['G'],
};

/**
 * Try to recover a check-digit-valid VIN from a 17-char read that failed the
 * check, by repairing a single misread character using the OCR confusion map.
 * Returns the repaired VIN or null. Bounded: at most one substitution, so it's
 * O(17 * alternatives) — cheap and conservative (won't invent a random VIN).
 */
function repairSingleChar(candidate: string): string | null {
  for (let i = 0; i < VIN_LENGTH; i++) {
    const alternatives = OCR_FIXES[candidate[i]!];
    if (!alternatives) continue;
    for (const alt of alternatives) {
      const attempt = candidate.slice(0, i) + alt + candidate.slice(i + 1);
      if (isCheckDigitValid(attempt)) return attempt;
    }
  }
  return null;
}

export interface VinCandidate {
  vin: string;
  /** True when the check digit matches — safe to auto-accept. */
  checkDigitValid: boolean;
  /**
   * Whether the ISO 3779 check digit is authoritative for this VIN's region
   * (North America only). When false, `checkDigitValid` being false is
   * meaningless — the manufacturer simply doesn't implement it — so the read is
   * not suspect and callers must confirm rather than silently drop it.
   */
  checkDigitApplies: boolean;
  /** True when we rewrote OCR misreads (I→1, O→0, or a single-char repair). */
  repaired: boolean;
}

/**
 * Pull every plausible VIN out of a block of (possibly messy) OCR text, best
 * first. "Best" = check-digit-valid before format-only; unrepaired before
 * repaired. De-duplicated.
 *
 * Strategy: scan both the raw text and a separator-stripped copy for 17-char
 * windows over the extended alphabet (including I/O/Q so we can repair them),
 * then normalize + validate + attempt a single-char repair on each.
 */
export function extractVins(text: string): VinCandidate[] {
  if (!text) return [];
  const haystacks = [
    text.toUpperCase(),
    // Stripped copy catches VINs printed with spaces/hyphens between groups.
    text.toUpperCase().replace(/[\s-]+/g, ''),
  ];

  const seen = new Set<string>();
  const candidates: VinCandidate[] = [];

  for (const hay of haystacks) {
    // 17 chars over the *extended* alphabet (A-Z0-9), bounded so we don't slice
    // the middle out of a longer run. I/O/Q are allowed here only so repair can
    // rewrite them; validation still rejects them if left in place.
    const re = /(?<![A-Z0-9])[A-Z0-9]{17}(?![A-Z0-9])/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(hay)) !== null) {
      const raw = match[0];

      // 1) Rewrite the always-illegal glyphs (I/O/Q) first.
      const normalized = raw.replace(/I/g, '1').replace(/[OQ]/g, '0');

      let vin = normalized;
      let checkDigitValid = isCheckDigitValid(normalized);
      let repaired = normalized !== raw;
      const checkDigitApplies = wmiRegion(normalized).usesCheckDigit;

      // 2) If it's the right shape but the check digit is off, try to recover a
      //    single OCR misread — but ONLY for North-American VINs, where the
      //    check digit is authoritative. For other regions position 9 is often
      //    filler, so "repairing" a correctly-read EU/JDM VIN would invent a
      //    character and corrupt the identity (e.g. an Italian VIN mutated into
      //    a Ford-Canada WMI). Leave those exactly as read.
      if (!checkDigitValid && isVinFormat(normalized) && checkDigitApplies) {
        const fixed = repairSingleChar(normalized);
        if (fixed) {
          vin = fixed;
          checkDigitValid = true;
          repaired = true;
        }
      }

      if (!isVinFormat(vin)) continue; // still not a legal VIN → drop it
      if (seen.has(vin)) continue;
      seen.add(vin);
      candidates.push({ vin, checkDigitValid, checkDigitApplies, repaired });
    }
  }

  // Check-valid first; among equals, prefer unrepaired (closer to what we saw).
  return candidates.sort((a, b) => {
    if (a.checkDigitValid !== b.checkDigitValid) return a.checkDigitValid ? -1 : 1;
    if (a.repaired !== b.repaired) return a.repaired ? 1 : -1;
    return 0;
  });
}

/**
 * The single best VIN from OCR text, or null if nothing plausible was found.
 * Callers should surface `checkDigitValid: false` results as "we think it's
 * this — confirm?" rather than auto-submitting them.
 */
export function pickBestVin(text: string): VinCandidate | null {
  return extractVins(text)[0] ?? null;
}
