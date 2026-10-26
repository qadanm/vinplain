# Contributing

## Setup

```bash
npm install
npm run typecheck
npm test
npm run build
```

Node 22 or later is required for development. The published package targets Node 18+.

## Tests

- `npm test` runs the deterministic suite. It mocks `fetch`; it must not depend on the network.
- `npm run test:live` calls the real NHTSA, vPIC, and EPA services. It is opt-in and not run in CI.
- New provider behaviour needs a fixture that reflects a real response shape. Add the fixture and a test for the failure path as well as the success path.

## Pull requests

- Keep the change focused. One provider or one bug per pull request.
- Do not add a runtime dependency without a clear reason.
- Preserve the `null` versus `[]` contract. A failed lookup is not an empty result.
- Run `npm run check` before opening the pull request.
- Do not include personal data, VINs belonging to other people, API keys, or private endpoints.

## Commit style

Imperative, lower-case, one line where possible. Example: `fix: treat a 400 with no results as empty, not clean`.
