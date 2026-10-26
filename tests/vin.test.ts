import { describe, expect, it } from 'vitest';
import {
  VIN_LENGTH,
  computeCheckDigit,
  extractVins,
  isCheckDigitValid,
  isVinFormat,
  normalizeVin,
  pickBestVin,
  wmiRegion,
} from '../src/index';

// A check-digit-valid 2003 Honda Accord VIN, used throughout the public
// documentation of ISO 3779.
const VIN = '1HGCM82633A004352';

describe('VIN format', () => {
  it('accepts a 17-character VIN and rejects wrong lengths', () => {
    expect(VIN_LENGTH).toBe(17);
    expect(isVinFormat(VIN)).toBe(true);
    expect(isVinFormat(VIN.slice(0, 16))).toBe(false);
    expect(isVinFormat(`${VIN}X`)).toBe(false);
  });

  it('rejects I, O and Q', () => {
    expect(isVinFormat('1HGCM82633A00435I')).toBe(false);
    expect(isVinFormat('1HGCM82633A00435O')).toBe(false);
    expect(isVinFormat('1HGCM82633A00435Q')).toBe(false);
  });

  it('normalises labels, whitespace and separators', () => {
    expect(normalizeVin('  1HG-CM826 33A004352  ')).toBe(VIN);
  });
});

describe('check digit', () => {
  it('computes and validates position nine', () => {
    expect(computeCheckDigit(VIN)).toBe('3');
    expect(isCheckDigitValid(VIN)).toBe(true);
    expect(isCheckDigitValid('1HGCM82643A004352')).toBe(false);
  });

  it('does not treat the check digit as authoritative outside North America', () => {
    expect(wmiRegion(VIN)).toMatchObject({
      region: 'north_america',
      market: 'the United States',
      usesCheckDigit: true,
    });
    expect(wmiRegion('WVWZZZ1JZXW000001')).toMatchObject({
      region: 'europe',
      usesCheckDigit: false,
    });
  });
});

describe('OCR extraction', () => {
  it('finds a VIN printed with spaces and hyphens', () => {
    const found = extractVins('Door jamb reads VIN: 1HG-CM826 33A004352.');
    expect(found[0]?.vin).toBe(VIN);
    expect(found[0]?.checkDigitValid).toBe(true);
  });

  it('repairs I/O glyphs commonly confused by OCR', () => {
    const found = pickBestVin('1HGCM82633AOO4352');
    expect(found?.vin).toBe(VIN);
    expect(found?.repaired).toBe(true);
    expect(found?.checkDigitValid).toBe(true);
  });

  it('prefers a valid candidate over an invalid one', () => {
    const found = extractVins('noise 1HGCM82643A004352 then 1HGCM82633A004352');
    expect(found[0]?.vin).toBe(VIN);
    expect(found[0]?.checkDigitValid).toBe(true);
  });

  it('returns null when no VIN is present', () => {
    expect(pickBestVin('no vehicle identification number here')).toBeNull();
  });
});
