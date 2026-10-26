# FAQ

## Is this a vehicle history report?

No. It reads the public record: VIN decode, recalls, complaints, crash ratings, and fuel economy. It does not include title brands, accidents, odometer readings, auctions, valuations, or owner history. Those come from commercial data sources with their own licensing.

## Does it need an API key?

No. vPIC, NHTSA, and fueleconomy.gov are public and keyless. There is no account and no per-lookup fee.

## Does it work in React Native or Expo?

Yes, if the runtime provides `fetch`, `AbortController`, and `setTimeout`. Older Expo SDKs may need a `fetch` polyfill. Use a durable cache backend such as AsyncStorage or MMKV; the default cache is a per-process `Map`.

The companion [`expo-vin-ocr`](../expo-vin-ocr/) handles VIN photos on iOS.

## Does it work in a browser?

The three sources allow cross-origin requests, so direct browser calls work. A server or edge function is still a better place for high-volume use because the cache is shared and the complaints payload can be large.

## Can it decode a VIN offline?

No. `vinplain` is a network client for the public record, not an offline vehicle database. Packages such as `@cardog/corgi` cover offline decoding.

## Why is the check digit sometimes not validated?

The ISO 3779 check digit is authoritative for North American VINs. In other markets, position nine is often filler. `wmiRegion(vin).usesCheckDigit` tells you whether the digit applies. A failed digit outside North America is reported, not treated as a bad read.

## Why do some functions return `null` instead of an empty array?

`null` means the source failed. `[]` means the source answered and there is nothing on file. A safety product must not show "no recalls" when the recall service was unreachable. See the [failure model](failure-model.md).

## Why no listings, valuations, or history?

Those are commercial datasets with licensing and privacy obligations. Keeping them out keeps the package keyless and small.

## Is it affiliated with NHTSA or the EPA?

No. It calls their public APIs. It is not endorsed by either agency.

## Can I use it commercially?

The code is MIT licensed. The data belongs to the source agencies; review their terms before commercial use.

## Why is there no MCP server?

The CLI with `--json` covers the local agent use case without adding a second package to maintain. There are existing MCP servers for VIN data, including `vin-mcp`. If a local, keyless MCP server becomes a real distribution channel, it can be added later.

## Why is the npm package not published?

The code and release are ready. This machine has no npm credentials, so the registry publish is pending. See [Publishing](PUBLISHING.md).

## How do I report a bug?

Open an issue with the VIN or year/make/model, the function you called, and the response status. Do not include VINs that belong to other people.
