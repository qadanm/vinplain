# Getting started

## Install

The package is not on npm yet. Build from source:

```bash
git clone https://github.com/qadanm/vinplain.git
cd vinplain
npm install
npm run build
```

Once published, `npm install vinplain`.

Requires Node 18 or later, a browser, or an edge runtime with `fetch`. React Native and Expo need a `fetch` polyfill on older SDKs and a durable cache backend.

## One call

```ts
import { getVehicleSummary } from 'vinplain';

const record = await getVehicleSummary({ vin: '1HGCM82633A004352' });

console.log(record.specs?.year);        // 2003
console.log(record.specs?.make);        // Honda
console.log(record.recalls?.length);    // 24
console.log(record.status.recalls);     // 'ok'
```

The summary contains:

- `specs`
- `recalls`
- `complaints`
- `safety`
- `fuelEconomy`
- `investigations`
- `status`, one entry per section

A VIN is enough. You can pass `year`, `make`, and `model` as fallback hints, but the decoded values take priority.

## Separate calls

Use the individual functions when you only need one section:

```ts
import {
  decodeVin,
  getComplaints,
  getFuelEconomy,
  getRecallsDetailed,
  getSafetyRatings,
} from 'vinplain';

const specs = await decodeVin('1HGCM82633A004352');
if (!specs?.year || !specs.make || !specs.model) {
  throw new Error('Could not decode that VIN');
}

const query = { year: specs.year, make: specs.make, model: specs.model };

const [recalls, complaints, safety, fuel] = await Promise.all([
  getRecallsDetailed(query),
  getComplaints(query),
  getSafetyRatings(query),
  getFuelEconomy(query),
]);
```

Every function returns `null` when the source fails. `getRecallsDetailed` returns `[]` when the source answered and the vehicle has no campaigns.

## Validate a VIN first

```ts
import { computeCheckDigit, isCheckDigitValid, isVinFormat } from 'vinplain';

const vin = '1HGCM82633A004352';

if (!isVinFormat(vin)) {
  throw new Error('Not a 17-character VIN');
}

if (!isCheckDigitValid(vin)) {
  throw new Error(`Check digit should be ${computeCheckDigit(vin)}`);
}
```

The check digit is only authoritative for North American VINs. Use `wmiRegion(vin).usesCheckDigit` when the VIN may come from another market.

## CLI

```bash
npx vinplain 1HGCM82633A004352
npx vinplain 1HGCM82633A004352 --json
```

The default output is a readable record. `--json` prints the full summary.

## Cache

The default cache is a per-process `Map`. Pass a durable backend once at startup:

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

The backend only needs `get` and `set`. Freshness is stored in the envelope, so a backend without TTL support still works.

## Timeouts

Defaults are 15 seconds for most requests and 30 seconds for complaints. Complaints can return several megabytes for high-volume models.

```ts
import { configureHttp } from 'vinplain';

configureHttp({
  defaultTimeoutMs: 15_000,
  complaintsTimeoutMs: 30_000,
});
```

## Next

- [API reference](api.md)
- [Failure model](failure-model.md)
- [Data sources](data-sources.md)
- [FAQ](faq.md)
