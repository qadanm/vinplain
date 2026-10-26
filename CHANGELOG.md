# Changelog

## 0.1.2 — 2026-10-26

Build automatically before packing, so a clean checkout cannot publish an empty `dist`.

## 0.1.1 — 2026-10-26

Correct the license section. MIT is approved and included.

## 0.1.0 — 2026-10-26

Initial extraction from VINly's private research package.

- VIN format validation, ISO 3779 check digit, WMI region, OCR extraction and single-character repair.
- vPIC extended VIN decode.
- NHTSA recalls, complaints, investigations, and NCAP crash ratings.
- EPA fuel economy and specification lookup.
- Consumer make/model/year lists.
- Injectable cache and timeouts; no runtime dependencies.
- 30 deterministic tests and 4 opt-in live integration tests.
