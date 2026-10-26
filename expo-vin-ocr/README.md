# expo-vin-ocr

On-device VIN OCR for Expo, using Apple's Vision framework. It returns a validated VIN candidate.

Pre-release. Not published. iOS only.

## What it does

It reads text from a VIN photo with `VNRecognizeTextRequest`, on the device, then passes the lines to [`vinplain`](../) for extraction and check-digit validation.

The photo never leaves the phone.

## Requirements

- Expo SDK 52 or later
- iOS 16 or later
- A development build or prebuild. This uses a native module, so it does not run in Expo Go.
- `vinplain` as a peer dependency

Android is not supported.

## Install

Not on npm yet. From this repository:

```bash
cd expo-vin-ocr
npm install
```

Once published:

```bash
npx expo install expo-vin-ocr vinplain
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
  console.log(result.vin, result.checkDigitApplies ? 'confirm' : 'non-US VIN');
}
```

`recognizeText(uri)` returns the raw lines.

## API

| Function | Returns |
| --- | --- |
| `recognizeText(uri)` | `Promise<string[]>` |
| `recognizeVin(uri)` | `Promise<VinCandidate \| null>` |

`VinCandidate` comes from `vinplain`:

- `vin`
- `checkDigitValid`
- `checkDigitApplies`
- `repaired`

## Privacy

Vision runs on device. There is no network request, no analytics, and no upload. The image URI is read locally and discarded after recognition.

## Limits

- iOS only.
- The module accepts a `file://` URI or a bare path. It does not open the camera; pair it with `expo-image-picker` or `expo-camera`.
- OCR quality depends on the photo. Glare, angle, and low light still matter.
- A failed check digit outside North America is not necessarily a bad read. `checkDigitApplies` tells you whether the digit is authoritative.
- It does not replace confirming the VIN against the door jamb or registration.

## Testing

```bash
npm test
npm run typecheck
```

The JavaScript wrapper is tested with a mocked native module. The Swift module needs a simulator or device; the example in [`example/`](example/) is the manual harness.

## License

MIT. See [LICENSE](LICENSE).
