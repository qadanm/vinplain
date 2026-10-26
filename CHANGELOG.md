# Changelog

## 0.2.3 (2026-10-26)

Point the package homepage at the product site and publish the README with the site and case-study links. No API changes.

## 0.2.2 (2026-10-26)

Move provenance from `publishConfig` to the release workflow. Provenance requires a CI provider with OIDC, so a local publish cannot generate it.

## 0.2.1 (2026-10-26)

New public-record artwork and a documentation pass. No API changes.

## 0.2.0 (2026-10-26)

Renamed to vinplain.

- New identity and README: "The public record, in plain code."
- Adds `getVehicleSummary()` with per-section status.
- Adds the `vinplain` CLI, including `--json`.
- Adds a release workflow for npm provenance.
- Cache keys move to the `vinplain:` namespace.

## 0.1.2 (2026-10-26)

Build automatically before packing, so a clean checkout cannot publish an empty `dist`.

## 0.1.1 (2026-10-26)

Correct the license section. MIT is approved and included.

## 0.1.0 (2026-10-26)

Initial extraction from VINly's private research package.

- VIN format validation, ISO 3779 check digit, WMI region, OCR extraction and single-character repair.
- vPIC extended VIN decode.
- NHTSA recalls, complaints, investigations, and NCAP crash ratings.
- EPA fuel economy and specification lookup.
- Consumer make/model/year lists.
- Injectable cache and timeouts; no runtime dependencies.
- 30 deterministic tests and 4 opt-in live integration tests.
