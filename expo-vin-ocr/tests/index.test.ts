import { beforeEach, describe, expect, it } from 'vitest';
import { __calls, __setLines } from 'expo-modules-core';
import { recognizeText, recognizeVin } from '../index';

beforeEach(() => {
  __setLines([]);
});

describe('recognizeText', () => {
  it('returns native lines unchanged', async () => {
    __setLines(['VIN: 1HGCM82633A004352', 'Honda Accord']);
    await expect(recognizeText('file:///photo.jpg')).resolves.toEqual([
      'VIN: 1HGCM82633A004352',
      'Honda Accord',
    ]);
    expect(__calls()).toContain('file:///photo.jpg');
  });
});

describe('recognizeVin', () => {
  it('returns a validated VIN from noisy OCR lines', async () => {
    __setLines(['some receipt text', 'VIN: 1HG-CM826 33A004352.', 'thank you']);
    const result = await recognizeVin('file:///vin.jpg');
    expect(result?.vin).toBe('1HGCM82633A004352');
    expect(result?.checkDigitValid).toBe(true);
  });

  it('returns null when no VIN is present', async () => {
    __setLines(['no vehicle identification number here']);
    await expect(recognizeVin('file:///empty.jpg')).resolves.toBeNull();
  });
});
