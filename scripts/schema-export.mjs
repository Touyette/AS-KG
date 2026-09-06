// Emits the schema as JSON so the authoring generator can enforce it at write
// time. Single source of truth — the table below is never hand-copied.
import fs from 'node:fs';
import { NODE_TYPES, PREDICATES, LENS_VALUES, ATTRIBUTION, ACTORS } from './schema.mjs';
fs.writeFileSync('_meta/schema.json', JSON.stringify({
  nodeTypes: NODE_TYPES, lensValues: LENS_VALUES, attribution: ATTRIBUTION, actors: ACTORS,
  predicates: Object.fromEntries(Object.entries(PREDICATES).map(([k, v]) =>
    [k, { domain: v.domain === '*' ? '*' : v.domain, range: v.range === '*' ? '*' : v.range }])),
}, null, 1));
console.log('_meta/schema.json written');
