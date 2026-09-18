// Emits public/static/flows.json — the situation flows, with a title→path map so
// a flow can cite a node by name.
//
// This used to also build /toolbox/, a web page that walked someone through the
// questions. That page is retired: an assistant asks these questions better than
// a decision tree can, because it can follow an answer somewhere the tree had no
// branch for. The flows themselves are not retired — they are the gates and the
// stopping conditions, and AGENTS.md points at them.
import fs from 'node:fs';
import { loadNotes } from './lib/notes.mjs';
import { loadFlows, validateFlows } from './flows.mjs';

const flows = loadFlows('flows');
const errs = validateFlows(flows);
if (errs.length) { errs.forEach((e) => console.error('  ' + e)); process.exit(1); }

// title -> path, so a flow can cite a node by name and a consumer can resolve it
const nodes = {};
for (const n of loadNotes('content')) {
  if (n.type === 'video') continue;   // framing pages are untyped and still linkable
  nodes[n.title.toLowerCase()] = n.path;
  for (const a of n.data.aliases ?? []) nodes[String(a).toLowerCase()] = n.path;
}

fs.mkdirSync('public/static', { recursive: true });
fs.writeFileSync('public/static/flows.json', JSON.stringify({ flows, nodes }));
console.log(`flows → public/static/flows.json · ${flows.length} flows · ${Object.keys(nodes).length} node aliases`);
