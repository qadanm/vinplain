# License decision

**Status: pending owner approval. No license is granted yet.**

The source is an extraction from a private product repository. The code was written by the repository owner, but the extraction has not yet been approved for release under a specific license.

## Proposed license

MIT. It is the same license used by the owner's other public project (`elmulator`), it is compatible with commercial use, and it keeps the package usable by other developers without a negotiation.

## What must be confirmed before release

1. The owner holds the rights to every extracted file. The package is a subset of `fbmp-checker` (VINly), written by the owner; no third-party source was found in the extracted modules.
2. The data sources permit this use. NHTSA, vPIC, and fueleconomy.gov are US federal services; the package does not redistribute their data, it calls their APIs. Their terms should still be reviewed before a commercial release.
3. No product-specific logic or confidential endpoints are included. The extraction excludes listings, record-pulse scoring, peer comparisons, and all UI code.
4. The package name does not conflict. `vehicle-research` returned 404 on the npm registry on 2026-10-26.

## Until approval

- `package.json` has `"private": true` and `"license": "UNLICENSED"`.
- No `LICENSE` file is present.
- Do not publish to npm or redistribute the source.
