<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.svg">
  <img src="assets/banner-light.svg" alt="vinplain: the public record, in plain code. A typed, keyless client for VIN decode, NHTSA recalls, complaints, crash ratings, and EPA fuel economy." width="880">
</picture>

<p align="center">
  <a href="https://github.com/qadanm/vinplain/actions/workflows/ci.yml"><img src="https://github.com/qadanm/vinplain/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/qadanm/vinplain/releases"><img src="https://img.shields.io/github/v/release/qadanm/vinplain?label=release&color=0B5FFF" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-0B5FFF" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/runtime%20deps-0-0B5FFF" alt="Zero runtime dependencies">
</p>

**The public record, in plain code.**

`vinplain` is a typed, keyless TypeScript client for US vehicle data. Give it a VIN and it returns the decode, recall campaigns, owner complaints, crash-test ratings, and fuel economy from the agencies that publish them.

No API key. No per-lookup fee. No black box. Zero runtime dependencies.

> Not a vehicle history report. Not an offline decoder. The public-record layer for vehicle apps.

## Why this exists

Most vehicle packages stop at year, make, and model. The paid APIs go further, but they hide the sources, charge per lookup, and turn a public record into a product you rent.

`vinplain` reads the public record directly:

- **vPIC** decodes the VIN and lists makes and models.
- **NHTSA** publishes recalls, complaints, investigations, and NCAP crash ratings.
- **EPA** publishes fuel economy, annual fuel cost, CO2, and EV range.

One typed client, one cache, one failure model. The data is public; the client should be too.

## Install

The package is not on npm yet. Use the GitHub release or build from source:

```bash
git clone https://github.com/qadanm/vinplain.git
cd vinplain
npm install
npm run build
```

Once published:

```bash
npm install vinplain
```

Requires Node 18 or later, or any runtime with `fetch`, `AbortController`, and `setTimeout`.

## Quickstart

```ts
import { getVehicleSummary } from 'vinplain';

const summary = await getVehicleSummary({ vin: '1HGCM82633A004352' });

console.log(summary.specs);            // 2003 Honda Accord EX-V6
console.log(summary.recalls?.length);  // 24
console.log(summary.status.recalls);   // 'ok' | 'empty' | 'unavailable' | 'skipped'
```

`getVehicleSummary` decodes the VIN first, then runs every record lookup in parallel. Each section resolves independently, so a slow or failed source does not sink the rest.

## CLI

```bash
npx vinplain 1HGCM82633A004352
```

```text
2003 Honda Accord EX-V6
  VIN            1HGCM82633A004352
  Recalls        24 campaign(s)
  Complaints     2013 (158 crash, 19 fire, 157 injury, 1 death)
  Safety         overall n/a, frontal n/a, side n/a
  Fuel           22 mpg combined, $2900/year
  Investigations listed
```

Use `--json` for the full typed summary.

## What you get

| Capability | Detail |
| --- | --- |
| **VIN validation** | 17-character format, ISO 3779 check digit, WMI region, OCR extraction and single-character repair |
| **VIN decode** | Engine, displacement, horsepower, transmission, drivetrain, body, plant, airbags, seating, driver assistance |
| **Recalls** | Campaign number, component, summary, consequence, remedy, date |
| **Complaints** | Aggregated by component, with crash, fire, injury, and death tallies |
| **Investigations** | Whether the model appears in NHTSA's investigations list |
| **Safety ratings** | Overall, frontal, side, side-pole, rollover, rollover probability, ADAS availability |
| **Fuel economy** | City, highway, combined MPG, annual fuel cost, CO2, volumes, EV range, EPA variant |
| **Vehicle lists** | Consumer makes, models by year, model-year range |
| **Injection** | Cache backend and timeouts, no framework or storage assumptions |

## Sources

| Source | Used for | Auth |
| --- | --- | --- |
| [NHTSA vPIC](https://vpic.nhtsa.dot.gov/api/) | VIN decode, makes, models, years | None |
| [NHTSA](https://api.nhtsa.gov/) | Recalls, complaints, investigations, NCAP | None |
| [fueleconomy.gov](https://www.fueleconomy.gov/feg/ws/) | MPG, fuel cost, CO2, EV range | None |

All three are US federal services. Check each source's terms before commercial use. The package does not relicense their data.

## API

| Function | Returns |
| --- | --- |
| `getVehicleSummary({ vin })` | `VehicleSummary` with per-section status |
| `decodeVin(vin)` | `VehicleSpecs \| null` |
| `getRecallsDetailed({ year, make, model })` | `RecallCampaign[] \| null` |
| `getComplaints({ year, make, model })` | `ComplaintSummary \| null` |
| `hasInvestigations({ year, make, model })` | `boolean \| null` |
| `getSafetyRatings(query)` | `SafetyRating \| null` |
| `getFuelEconomy(query)` | `FuelEconomy \| null` |
| `getEpaSpecs(query)` | `VehicleSpecs \| null` |
| `getMakes()` / `getModels(make, year)` | `string[]` |
| `getYears()` | `number[]` |
| `mergeSpecs(primary, fallback)` | `VehicleSpecs \| undefined` |

VIN helpers: `isVinFormat`, `isCheckDigitValid`, `computeCheckDigit`, `normalizeVin`, `wmiRegion`, `extractVins`, `pickBestVin`.

### `null` is not `[]`

This is the contract the package is built around:

- `[]` means the source answered and there is nothing on file.
- `null` means the source could not be reached or returned an unusable response.
- `getVehicleSummary` makes the same distinction in `status`, per section.

Do not render `null` as "no recalls". A failed check is not a clean record.

## Configuration

The default cache is a per-process `Map`. Inject a durable backend once at startup:

```ts
import { configureCache, type CacheBackend } from 'vinplain';

const cache: CacheBackend = {
  async get(key) {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  },
  async set(key, value, ttlSeconds) {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  },
};

configureCache(cache);
```

Timeouts are configurable. Complaints can be multi-megabyte payloads.

```ts
import { configureHttp } from 'vinplain';

configureHttp({
  defaultTimeoutMs: 15_000,
  complaintsTimeoutMs: 30_000,
});
```

## Companions

[`expo-vin-ocr`](expo-vin-ocr/) reads a VIN from a photo with Apple Vision, on device, and returns a validated candidate from `vinplain`. iOS 16+, Expo SDK 52+, development build or prebuild. Not part of the core package.

## Documentation

- [Market positioning and competitor research](docs/market.md)
- [Publishing and trusted publishing](docs/PUBLISHING.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

## Testing

```bash
npm test        # 34 deterministic tests
npm run test:live   # 4 live integration tests
npm run check   # typecheck + tests + build
```

The deterministic suite mocks `fetch` with response shapes confirmed against the live services. The live suite is opt-in and not run in CI because government APIs throttle.

## License

MIT. See [LICENSE](LICENSE).

## Status

| | |
| --- | --- |
| Version | 0.2.0 |
| npm | **Pending** — no registry credentials configured |
| GitHub release | v0.2.0 |
| Runtime dependencies | 0 |
| Node | 18+ |
| Tests | 34 deterministic, 4 live, 3 OCR |

The package is pre-1.0. Minor versions may change the API.
