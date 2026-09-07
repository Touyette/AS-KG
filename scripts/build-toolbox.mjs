import fs from 'node:fs';
import path from 'node:path';
import { loadNotes } from './lib/notes.mjs';
import { basePath } from './lib/base.mjs';
import { loadFlows, validateFlows } from './flows.mjs';
const OUT = process.argv[2] ?? 'public/toolbox';
const flows = loadFlows('flows');
const errs = validateFlows(flows);
if (errs.length) { errs.forEach((e) => console.error('  ' + e)); process.exit(1); }
// title -> path, so a flow can cite a node by name and link to its page
const nodes = {};
for (const n of loadNotes('content')) {
  if (n.type === 'video') continue;   // framing pages are untyped and still linkable
  nodes[n.title.toLowerCase()] = n.path;
  for (const a of n.data.aliases ?? []) nodes[String(a).toLowerCase()] = n.path;
}
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync('public/static', { recursive: true });
fs.writeFileSync('public/static/flows.json', JSON.stringify({ flows, nodes }));
const BASE = basePath();
const copy = (from, to) =>
  fs.writeFileSync(path.join(OUT, to), fs.readFileSync(from, 'utf8').replaceAll('__BASE__', BASE));
copy('scripts/toolbox.html', 'index.html');
copy('scripts/toolbox.js', 'toolbox.js');
console.log(`toolbox → ${OUT}/ · ${flows.length} flows · ${Object.keys(nodes).length} node aliases`);
