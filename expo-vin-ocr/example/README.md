# Example

A minimal Expo screen that picks a photo and reads a VIN.

## Setup

```bash
npx create-expo-app vin-ocr-example
cd vin-ocr-example
npx expo install expo-image-picker
npm install ../..        # vehicle-research
npm install ../../expo-vin-ocr
npx expo prebuild
npx expo run:ios
```

Copy `App.tsx` into the example project. It will not run in Expo Go.
