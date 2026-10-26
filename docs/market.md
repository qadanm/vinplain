# Market notes

Date: 26 October 2026. npm download counts are last-month figures at the time of writing. They move.

## What exists

| Package | Last-month downloads | What it does | What it leaves out |
| --- | ---: | --- | --- |
| `@shaggytools/nhtsa-api-wrapper` | 37.7k | Broad wrapper over NHTSA vPIC endpoints | Recalls, complaints, NCAP, EPA |
| `@cardog/corgi` | 13.0k | Offline VIN decode for Node, browsers, Workers | Live records |
| `vin-validator` | 12.3k | Format and check-digit validation | Vehicle data |
| `universal-vin-decoder` | 1.7k | VIN decode | Public records |
| `vin-decoder` | 1.0k | VIN decode | Public records |
| `vin-decoder-mcp` | 664 | MCP tool for basic decode | Recalls, complaints, ratings, economy |
| `vin-mcp` | 42 | MCP and REST: decode, recalls, complaints, safety, fuel, photos | A local keyless library |
| `nhtsa` | 93 | Light NHTSA client | Typed multi-source layer |

Commercial APIs such as CarsXE, VinAudit, MarketCheck, and Vincario sell history, valuations, and listings. They require a key and charge per lookup or by plan. They cover a different job.

Offline decoders dominate volume because they are fast and local. NHTSA wrappers cover one source well. MCP servers are appearing, and most wrap a hosted API or expose only decode.

## The gap

Few packages combine the public record across vPIC, NHTSA, and EPA in one typed client.

A developer who wants recalls, complaints, crash ratings, and fuel economy ends up combining several services with different response shapes and failure modes. Most existing packages either stop at decode or hide the sources behind a paid API.

The second gap is failure semantics. Government APIs fail. A client that returns an empty array for both "checked, none" and "could not check" is unsafe for a recall or safety feature. `vinplain` keeps those cases separate and exposes the status per section.

## Who it is for

| User | Job | Why this package |
| --- | --- | --- |
| Indie iOS or Expo developer | Add recalls or safety data to a car app | No key, no server account, no per-scan fee |
| Marketplace or fleet tool | Enrich a VIN list with public safety and economy data | Typed results and injectable cache |
| QA or test harness author | Build deterministic vehicle fixtures | Same domain as elmulator, with live and fixture paths |
| Agent or research tool | Answer a recall question from public data | CLI with JSON output, no vendor account |
| Design engineer | Prototype an automotive interface | One install and one summary call |

## Scope

What the package covers:

- VIN validation and check digit.
- vPIC decode.
- Recalls, complaints, investigations, NCAP.
- EPA fuel economy.
- Makes, models, years.
- A CLI and a summary call.

What it does not cover, and why:

| Excluded | Reason |
| --- | --- |
| Offline VIN database | `@cardog/corgi` and `vin-validator` already do it well, and a database adds weight and staleness |
| History, valuations, auctions, listings | Commercial data with licensing and privacy obligations |
| Hosted REST API | Turns a library into an operations burden and breaks the no-key property |
| MCP server | `vin-mcp` already covers the MCP surface and is broader; the CLI JSON path is enough for now |
| React hooks | Framework bindings multiply maintenance for a small core |

## Risks

| Risk | Mitigation |
| --- | --- |
| Government APIs throttle or change shape | Cache, configurable timeouts, live smoke tests, response fixtures |
| Small market | Narrow, high-trust niche; distribution through Expo and automotive developer communities |
| Commercial APIs have data we do not | Position as public records, not history |
| Broad package name | Narrow scope in the README and package description; `@qadanm/vinplain` is the scoped alternative |
| Maintenance | Zero runtime dependencies, three upstream sources, weekly Dependabot |

## What to watch

- npm downloads, and whether issues ask for data outside the public record or report bugs inside it.
- Whether the summary call is used more than the individual functions. If it is, the aggregation is the product.
- Whether the CLI is used by agent builders. If it is, a local MCP server becomes worth the maintenance.

The package was published on GitHub in October 2026 and has not been published to npm yet. No adoption claims are made.
