# Data sources

`vinplain` calls three US federal services. None requires a key.

## vPIC

Base: `https://vpic.nhtsa.dot.gov/api/vehicles`

Used for VIN decode, makes, models, and model years. The decode endpoint is `DecodeVinValuesExtended`.

Coverage is strongest for vehicles sold in the United States. A VIN that decodes to a make and model but no usable year is treated as undecodable.

CORS: `access-control-allow-origin: *`.

## NHTSA

Base: `https://api.nhtsa.gov`

Used for:

- Recall campaigns: `/recalls/recallsByVehicle`
- Owner complaints: `/complaints/complaintsByVehicle`
- Investigations: `/products/vehicle/models` with `issueType=i`
- NCAP ratings: `/SafetyRatings/modelyear`, `/SafetyRatings/VehicleId`

The recall endpoint returns HTTP 400 for a valid vehicle with no campaigns and for a model spelling it does not recognize. The package tries several spellings before reporting an empty result.

Complaint payloads can exceed a megabyte. The default timeout for that endpoint is 30 seconds.

CORS: the API reflects the request origin and allows browser requests.

NCAP does not rate every vehicle. A missing rating is `null`, which is not the same as a failed request.

## fueleconomy.gov

Base: `https://www.fueleconomy.gov/ws/rest`

Used for fuel economy, annual fuel cost, CO2, passenger and luggage volume, and EV range.

EPA files drivetrain and electrification in the model name. A nameplate can span several records, so the package uses `driveHint`, `bodyHint`, and `fuelHint` to pick one. When no hint discriminates, the result is marked `variantAmbiguous` and includes a combined MPG range.

CORS: `access-control-allow-origin: *`.

## Limits

- Recalls are capped at 50 campaigns per vehicle.
- US market data only.
- The ISO 3779 check digit is authoritative for North American VINs. Other markets often use position nine as filler.
- No vehicle history, auctions, valuations, listings, or NMVTIS data.

## Terms

The sources are US federal services. The package does not relicense their data. Review each source's terms and attribution expectations before commercial use.

This project is not affiliated with or endorsed by NHTSA, the Department of Energy, or vPIC.
