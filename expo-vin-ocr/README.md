# expo-vin-ocr

On-device VIN OCR for Expo, using Apple's Vision framework. It returns a validated VIN candidate, not a pile of raw text.

**Pre-release.** Not published. iOS only.

## Why this exists

Generic OCR gives you lines. A VIN needs more than that: the 17-character format, the ISO 3779 check digit, and repair for the characters OCR most often confuses (I/1, O/0). This package reads the photo on device, then hands the text to [`vehicle-research`](../) for validation.

The photo never leaves the phone.

## Requirements

- Expo SDK 52 or later
- iOS 16 or later
- A development build or prebuild. This uses a native module, so it does **not** run in Expo Go.
- `vehicle-research` as a peer dependency

Android is not supported. There is no fallback.

## Install

Not on npm yet. From this repository:

```bash
cd expo-vin-ocr
npm install
```

Once published:

```bash
npx expo install expo-vin-ocr vehicle-research
npx expo prebuild
```

## Usage

```tsx
import { recognizeVin } from 'expo-vin-ocr';

const result = await recognizeVin(photoUri);

if (!result) {
  // No plausible VIN in the image.
} else if (result.checkDigitValid) {
  console.log(result.vin);
} else {
  // A plausible read that needs confirmation.
  console.log(result.vin, result.checkDigitApply ? 'confirm' : 'non-US VIN');
}
```

`recognizeText(uri)` is also exported if you want the raw lines.

## API

| Function | Returns |
| --- | --- |
| `recognizeText(uri)` | `Promise<string[]>` |
| `recognizeVin(uri)` | `Promise<VinCandidate \| null>` |

`VinCandidate` comes from `vehicle-research`:

- `vin`
- `checkDigitValid`
- `checkDigitApplies` (false outside North America)
- `repaired`

## Privacy

- Vision runs on device.
- No network request, no analytics, no upload.
- The image URI is read locally and discarded after recognition.

## Limitations

- iOS only.
- The module accepts a `file://` URI or a bare path. It does not open the camera itself; pair it with `expo-image-picker` or `expo-camera`.
- OCR quality depends on the photo. Glare, angle, and low light still matter.
- A failed check digit outside North America is not necessarily a bad read. `checkDigitApplies` tells you whether the digit is authoritative.
- This is not a substitute for confirming the VIN against the door jamb or registration.

## Testing

```bash
npm test
npm run typecheck
```

The JavaScript wrapper is tested with a mocked native module. The Swift module needs a simulator or device; the example in [`example/`](example/) is the manual harness.

## License

MIT. See [LICENSE](LICENSE).
