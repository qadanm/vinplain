# Publishing

## Why it is not on npm yet

The package is ready, but this machine has no npm authentication (`npm whoami` returns `ENEEDAUTH`). Publishing is a registry write and cannot be done without an account.

`vinplain` is available on npm as of 2026-10-26. The scoped alternative is `@qadanm/vinplain`.

## First publish (manual, 2 minutes)

```bash
cd vinplain
npm login
npm run check
npm publish --access public
```

`prepack` builds `dist`, so a clean checkout cannot publish an empty package.

## First publish through GitHub Actions

1. Create an npm automation token with read/write access to the package.
2. Add it as the repository secret `NPM_TOKEN`.
3. Push a version tag:

```bash
npm version patch
git push --follow-tags
```

The `Release` workflow runs `npm ci`, `npm run check`, then `npm publish --provenance --access public`. If `NPM_TOKEN` is absent, it records a notice and skips the publish step instead of failing the release.

## After the first publish: trusted publishing

npm supports OIDC trusted publishing, so the long-lived token can be removed.

1. On npmjs.com → package → Settings → Trusted publishing, add:
   - Repository: `qadanm/vinplain`
   - Workflow: `release.yml`
   - Environment: leave empty
2. Delete the `NPM_TOKEN` secret.
3. In `release.yml`, remove the `NODE_AUTH_TOKEN` environment line.

The workflow already has `id-token: write`, which provenance and trusted publishing require.

## Versioning

- `0.x`: API may change in a minor release.
- `1.0`: stable public API.
- Tags are `vX.Y.Z` and match `package.json`.

## Adding the npm badge

Once published, add to the README badge row:

```html
<a href="https://www.npmjs.com/package/vinplain"><img src="https://img.shields.io/npm/v/vinplain?color=0B5FFF" alt="npm"></a>
```
