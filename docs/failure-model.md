# Failure model

The package makes network requests to three government services. Any of them can be slow, throttled, or down. The return values are designed so a failed check cannot be mistaken for a clean record.

## Return values

| Value | Meaning |
| --- | --- |
| `null` | The request failed, timed out, or returned an unusable response. |
| `[]` | The source answered and there is nothing on file. |
| `false` | The source answered and the vehicle is not in the investigations list. |
| `{}` | Not used. An empty object would hide the difference between failure and empty. |

`getRecallsDetailed` is the clearest example:

```ts
const recalls = await getRecallsDetailed({ year: 2022, make: 'Toyota', model: 'Corolla' });

if (recalls === null) {
  // Could not check. Do not say "no recalls".
} else if (recalls.length === 0) {
  // Checked. No campaigns on file.
}
```

## Summary status

`getVehicleSummary` reports a status for each section:

| Status | Meaning |
| --- | --- |
| `ok` | The source answered with data. |
| `empty` | The source answered with no data. |
| `unavailable` | The source failed. The value is absent. |
| `skipped` | There was no usable year, make, and model to query. |

Render from `status`, not from whether a field happens to exist:

```ts
if (record.status.recalls === 'unavailable') {
  renderUnavailable('Recalls');
} else if (record.status.recalls === 'empty') {
  renderEmpty('No recalls on file');
} else {
  renderRecalls(record.recalls ?? []);
}
```

## Partial results

`getVehicleSummary` uses `Promise.allSettled`. One failed source does not reject the whole call. You get the sections that succeeded, with `unavailable` for the ones that did not.

## Stale cache

The cache keeps entries for 90 days and returns a stale value when the loader fails. This keeps a page useful during a short outage, but it means a cached empty recall list can be served while NHTSA is down, and the current API does not mark that value as stale.

If you need strict freshness, use a short cache TTL, or call the individual function with your own cache disabled. A `freshness` field on the cache envelope is a reasonable future addition; it is not implemented.

## Timeouts

The default timeout is 15 seconds. Complaints use 30 seconds because a high-volume model can return several megabytes.

A timeout returns `null`. There is no automatic retry. Government APIs throttle aggressively, so a retry loop in the library would make an outage worse. Let the caller decide whether to retry.

## Rate limits

There is no key and no quota provided by the package. The sources apply their own limits and may return 403 or 429 when a client is too aggressive. Cache results. Do not loop over thousands of VINs without pacing.

## What the package does not do

- It does not invent a clean result when a source fails.
- It does not retry automatically.
- It does not hide a stale cache hit.
- It does not convert a check-digit failure outside North America into a bad read without checking `wmiRegion().usesCheckDigit`.
