#!/usr/bin/env node
import { getVehicleSummary } from '../dist/index.js';

const args = process.argv.slice(2);
const vin = args.find((a) => !a.startsWith('-'));
const json = args.includes('--json');

if (!vin || args.includes('--help') || args.includes('-h')) {
  console.log(`vinplain — US public vehicle records

Usage
  vinplain <VIN> [--json]

Examples
  vinplain 1HGCM82633A004352
  vinplain 1HGCM82633A004352 --json

Data: NHTSA vPIC, NHTSA, EPA. No API key.`);
  process.exit(vin ? 0 : 1);
}

const summary = await getVehicleSummary({ vin: vin.toUpperCase() });

if (json) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.status.decode === 'ok' ? 0 : 1);
}

if (summary.status.decode !== 'ok' || !summary.specs) {
  console.error(`Could not decode ${vin}`);
  process.exit(1);
}

const s = summary.specs;
console.log(`${s.year ?? ''} ${s.make ?? ''} ${s.model ?? ''}${s.trim ? ` ${s.trim}` : ''}`.trim());
console.log(`  VIN            ${vin.toUpperCase()}`);

const recalls = summary.status.recalls;
console.log(
  `  Recalls        ${
    recalls === 'ok' ? `${summary.recalls?.length ?? 0} campaign(s)` : recalls === 'empty' ? 'none on file' : 'unavailable'
  }`,
);

const c = summary.complaints;
console.log(
  `  Complaints     ${
    c ? `${c.total} (${c.crashes} crash, ${c.fires} fire, ${c.injuries} injury, ${c.deaths} death)` : 'unavailable'
  }`,
);

const safety = summary.safety;
console.log(
  `  Safety         ${
    safety ? `overall ${safety.overall ?? 'n/a'}, frontal ${safety.frontal ?? 'n/a'}, side ${safety.side ?? 'n/a'}` : 'unavailable'
  }`,
);

const fuel = summary.fuelEconomy;
console.log(
  `  Fuel           ${
    fuel
      ? `${fuel.combinedMpg ?? 'n/a'} mpg combined, $${fuel.annualFuelCost ?? 'n/a'}/year`
      : 'unavailable'
  }`,
);

console.log(
  `  Investigations ${summary.investigations == null ? 'unavailable' : summary.investigations ? 'listed' : 'none'}`,
);
