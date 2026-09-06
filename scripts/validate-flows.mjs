import { loadFlows, validateFlows } from './flows.mjs';
const flows = loadFlows('flows');
const errors = validateFlows(flows);
const steps = flows.reduce((n, f) => n + f.steps.length, 0);
const cites = new Set(flows.flatMap((f) => f.steps.flatMap((s) => s.cites ?? [])));
console.log(`${flows.length} flows · ${steps} steps · ${cites.size} distinct nodes cited`);
for (const e of errors) console.error(`  ERROR ${e}`);
console.log(errors.length ? `\n${errors.length} error(s)` : '\nflows valid');
process.exit(errors.length ? 1 : 0);
