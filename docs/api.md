# API reference

All network functions resolve; they do not throw for a failed source. A failed source returns `null`, and a successful empty result returns `[]` where the return type is an array.

## `getVehicleSummary(input)`

```ts
getVehicleSummary(input: VehicleSummaryInput): Promise<VehicleSummary>
```

`VehicleSummaryInput` is either `{ vin: string }` with optional `year`, `make`, `model`, and hints, or a full `VehicleQuery`.

The VIN is decoded first. The decoded year, make, and model drive the record lookups. Each lookup runs in parallel and resolves independently.

`VehicleSummary`:

| Field | Type |
| --- | --- |
| `query` | `VehicleQuery` |
| `specs` | `VehicleSpecs \| undefined` |
| `recalls` | `RecallCampaign[] \| undefined` |
| `complaints` | `ComplaintSummary \| undefined` |
| `safety` | `SafetyRating \| undefined` |
| `fuelEconomy` | `FuelEconomy \| undefined` |
| `investigations` | `boolean \| undefined` |
| `status` | `{ decode, recalls, complaints, safety, fuelEconomy, investigations }` |

Each status is `'ok'`, `'empty'`, `'unavailable'`, or `'skipped'`.

## `decodeVin(vin)`

```ts
decodeVin(vin: string): Promise<VehicleSpecs | null>
```

Uses vPIC `DecodeVinValuesExtended`. Returns `null` when the response has no usable year, make, or model. A check-digit failure does not block decoding when the year, make, and model are present.

Cached for 30 days per VIN.

## `getRecallsDetailed(query)`

```ts
getRecallsDetailed(query: { year: number; make: string; model: string }): Promise<RecallCampaign[] | null>
```

Returns up to 50 campaigns. `[]` means the source answered and there are no campaigns. `null` means the lookup failed.

NHTSA's recall endpoint returns HTTP 400 both for a valid vehicle with no campaigns and for a model spelling it does not recognize. The function tries several spellings and only reports `[]` when every attempt returned an empty answer without a transport failure.

## `getComplaints(query)`

```ts
getComplaints(query: { year: number; make: string; model: string }): Promise<ComplaintSummary | null>
```

Returns totals by component plus crash, fire, injury, and death counts. `null` means the source failed.

## `hasInvestigations(query)`

```ts
hasInvestigations(query: { year: number; make: string; model: string }): Promise<boolean | null>
```

`true` means the model appears in NHTSA's investigations list for that year. `null` means the lookup failed.

## `getSafetyRatings(query)`

```ts
getSafetyRatings(query: VehicleQuery): Promise<SafetyRating | null>
```

Returns NCAP stars for the chosen variant, or `null` when NCAP has no rating or the lookup failed. The function uses `driveHint`, `bodyHint`, and the model name to pick a variant when several exist.

## `getFuelEconomy(query)`

```ts
getFuelEconomy(query: VehicleQuery): Promise<FuelEconomy | null>
```

Returns MPG, annual fuel cost, CO2, volumes, EV range, and the EPA variant the numbers describe. When several EPA variants share a nameplate and no hint discriminates, `variantAmbiguous` is true and `combinedMpgRange` gives the spread.

## `getEpaSpecs(query)`

```ts
getEpaSpecs(query: VehicleQuery): Promise<VehicleSpecs | null>
```

Returns the EPA record as `VehicleSpecs`, useful when a VIN decode is missing fields.

## `getMakes()`, `getModels(make, year)`, `getYears()`

```ts
getMakes(signal?: AbortSignal): Promise<string[]>
getModels(make: string, year: number, signal?: AbortSignal): Promise<string[]>
getYears(): number[]
```

`getMakes` filters to consumer passenger-vehicle makes and sorts them. `getModels` merges car, truck, and MPV results and de-duplicates them. `getYears` returns model years from 1996 through next year.

## `resolveNhtsaModel(issueType, query)`

```ts
resolveNhtsaModel(
  issueType: 'r' | 'c' | 'i',
  query: Pick<VehicleQuery, 'year' | 'make' | 'model'>,
): Promise<string>
```

Maps a vPIC model name to the spelling used by NHTSA's recall, complaint, or investigation endpoints.

## VIN helpers

| Function | Returns |
| --- | --- |
| `isVinFormat(value)` | `boolean` |
| `normalizeVin(value)` | `string` |
| `computeCheckDigit(vin)` | `string` |
| `isCheckDigitValid(vin)` | `boolean` |
| `wmiRegion(vinOrWmi)` | `{ region, market, usesCheckDigit }` |
| `extractVins(text)` | `VinCandidate[]` |
| `pickBestVin(text)` | `VinCandidate \| null` |

`extractVins` finds 17-character candidates in OCR text, normalizes I/O/Q confusions, and attempts a single-character repair on North American VINs. `pickBestVin` returns the first candidate.

## Configuration

| Function | Purpose |
| --- | --- |
| `configureCache(backend)` | Set a durable cache backend |
| `getCacheBackend()` | Read the current backend |
| `configureHttp({ defaultTimeoutMs, complaintsTimeoutMs })` | Change timeouts |
| `fetchJson(url, options)` | Fetch JSON, returning `null` on failure |
| `cachedJson(key, maxAgeMs, loader, now?)` | Read-through cache with stale fallback |

## Types

The package exports `VehicleQuery`, `VehicleSpecs`, `RecallCampaign`, `ComplaintSummary`, `SafetyRating`, `FuelEconomy`, `VehicleSummary`, `VehicleSummaryInput`, `SectionStatus`, `VinCandidate`, and `VinRegion`.
