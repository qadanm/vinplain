# Market research: vinplain

Date: 26 October 2026. Download counts are npm last-month figures at the time of writing. They move; treat them as order-of-magnitude, not a market size claim.

## What already exists

| Package | Last-month downloads | What it actually does | What it does not do |
| --- | ---: | --- | --- |
| `@shaggytools/nhtsa-api-wrapper` | 37.7k | Broad wrapper over NHTSA vPIC endpoints | No recalls, complaints, NCAP, or EPA |
| `@cardog/corgi` | 13.0k | Fast offline VIN decode for Node, browsers, Workers | Live recalls, complaints, ratings, economy |
| `vin-validator` | 12.3k | Format and check-digit validation | Any vehicle data |
| `universal-vin-decoder` | 1.7k | VIN decode | Public records beyond decode |
| `vin-decoder` | 1.0k | VIN decode | Public records |
| `vin-decoder-mcp` | 664 | MCP tool for basic decode | Recalls, complaints, ratings, economy |
| `vin-mcp` | 42 | MCP + REST: decode, recalls, complaints, safety, fuel, photos | Local/keyless library; it is a hosted-style product |
| `nhtsa` | 93 | Light NHTSA client | Typed, tested multi-source layer |

Commercial APIs (CarsXE, VinAudit, MarketCheck, Vincario) sell vehicle history, valuations, listings, and NMVTIS data. They charge per lookup or by plan and require a key. They solve a different problem: history and transactions, not the free public record.

The pattern is clear:

- **Offline decoders own volume.** They are fast, local, and good at turning a VIN into year/make/model.
- **NHTSA wrappers own depth on one source.** They expose vPIC, but stop before recalls, complaints, NCAP, and EPA.
- **MCP servers are emerging.** Most wrap a hosted API or expose only basic decode.
- **Commercial APIs own history.** They are paid, keyed, and broad.

## The gap

There is no widely used, typed, zero-dependency client that combines the **public record** across vPIC, NHTSA, and EPA with honest failure states.

Specifically:

1. **One call for the whole public record.** Decode plus recalls, complaints, investigations, crash ratings, and fuel economy. Today a developer stitches together four services, four response shapes, and four failure modes.
2. **No key, no per-lookup cost.** The sources are free and public. Most wrappers either stop at decode or hide the sources behind a paid API.
3. **Failure semantics that a safety product can trust.** `null` means "could not check"; `[]` means "checked, nothing on file". Most packages collapse both into an empty array or a thrown error.
4. **Cache and timeout injection.** Government APIs are slow and throttle. A library that hard-codes a cache or a timeout is hard to use in a serverless function, an Expo app, or a test.
5. **Typed and tested against live shapes.** Many wrappers type the happy path and guess the rest. The tests here use response shapes confirmed against the live APIs, including the 400-means-two-things recall problem.
6. **A companion for VIN photos.** The OCR module completes the path from camera to validated VIN without sending the photo anywhere.

## Who it is for

| User | Job | Why this package |
| --- | --- | --- |
| Indie iOS/Expo developer | Add recalls or safety data to a car app | No key, no server, no per-scan cost |
| Marketplace or fleet tool | Enrich a VIN list with public safety and economy data | Typed results and injectable cache |
| QA or test harness author | Build deterministic vehicle fixtures | Same domain as elmulator; scenarios and records |
| AI agent or research tool | Answer "does this car have recalls?" from public data | CLI JSON output, no vendor account |
| Design engineer | Prototype an automotive interface quickly | One install, one summary call |

## Positioning

**The public-record layer for vehicle apps.**

Not a VIN history report. Not an offline decoder. Not a paid vehicle API. The package is the typed, auditable layer between a VIN and the agencies that already publish the answers.

The one-line pitch:

> VIN decode, recalls, complaints, crash ratings, and fuel economy from US public sources. Typed. No API key. No runtime dependencies.

## Product decisions that follow

### Built

- `getVehicleSummary()`: one call, every public section, per-section status.
- `decodeVin()`, `getRecallsDetailed()`, `getComplaints()`, `getSafetyRatings()`, `getFuelEconomy()`.
- VIN validation and OCR extraction, including the ISO 3779 check digit.
- A CLI: `vinplain <VIN>` returns a readable summary or `--json`.
- `expo-vin-ocr`: on-device VIN OCR for Expo, iOS.
- Injectable cache and timeouts; zero runtime dependencies.

### Deliberately not built

- **Offline VIN decoding.** `@cardog/corgi` and `vin-validator` already do this well; an offline database would add weight and staleness.
- **Vehicle history, valuations, auctions, listings.** That is commercial data with licensing and privacy obligations.
- **A hosted REST API.** It would turn a library into an operations burden and undermine the no-key promise.
- **An MCP server, for now.** `vin-mcp` already covers the MCP surface and is broader. The CLI plus JSON output is enough for agent use without adding a second product to maintain. Revisit if a local, keyless MCP server becomes a real distribution channel.
- **A React hook layer.** Framework bindings multiply maintenance; the core is small enough to call directly.

## Risks

| Risk | Mitigation |
| --- | --- |
| Government APIs throttle or change shape | Cache, configurable timeouts, live smoke tests, response fixtures |
| Small addressable market | Narrow, high-trust niche; distribution through the Expo/automotive communities and the existing elmulator audience |
| Commercial APIs have data we do not | Position explicitly as public records, not history |
| Name is broad | The scope is narrow in the README and package description; `@qadanm/vinplain` is the scoped alternative if the unscoped name is contested |
| Maintenance burden | Zero runtime dependencies; three upstream sources; weekly Dependabot |

## Success signals to watch

- npm downloads and the ratio of installs to GitHub stars.
- Issues that ask for **data we do not cover** versus **bugs in data we do cover**. The first is scope creep; the second is the product working.
- Whether the summary call is used more than the individual functions. If it is, the product is the aggregation, not the wrappers.
- Whether the CLI is used by agent/tool builders. If it is, a local MCP server becomes worth the maintenance.

No adoption numbers are claimed. The package was published on GitHub in October 2026 and has not yet been published to npm.
