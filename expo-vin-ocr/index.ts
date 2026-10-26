import { requireNativeModule } from 'expo-modules-core';
import { pickBestVin, type VinCandidate } from 'vehicle-research';

interface VinOcrNativeModule {
  recognizeText(uri: string): Promise<string[]>;
}

const Native = requireNativeModule<VinOcrNativeModule>('VinOcr');

/**
 * Read every line Apple's Vision framework can see in a photo, on device.
 * The photo never leaves the phone.
 *
 * iOS only.
 */
export async function recognizeText(uri: string): Promise<string[]> {
  return Native.recognizeText(uri);
}

/**
 * Read a VIN from a photo. Vision returns raw lines; selection, OCR confusion
 * repair, and the ISO 3779 check digit are handled by `vehicle-research`.
 *
 * Returns null when no plausible VIN was found.
 */
export async function recognizeVin(uri: string): Promise<VinCandidate | null> {
  const lines = await recognizeText(uri);
  return pickBestVin(lines.join('\n'));
}

export type { VinCandidate };
