import { decodeVin, getRecallsDetailed } from '../src/index.ts';

const vin = process.argv[2] ?? '1HGCM82633A004352';

const specs = await decodeVin(vin);
if (!specs?.year || !specs.make || !specs.model) {
  throw new Error(`Could not decode ${vin}`);
}

console.log(`${specs.year} ${specs.make} ${specs.model}${specs.trim ? ` ${specs.trim}` : ''}`);

const recalls = await getRecallsDetailed({
  year: specs.year,
  make: specs.make,
  model: specs.model,
});

if (recalls === null) {
  console.log('Recalls: source unavailable');
} else {
  console.log(`Recalls: ${recalls.length} campaign${recalls.length === 1 ? '' : 's'}`);
}
