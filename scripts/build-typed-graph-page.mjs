// Copies the standalone typed-graph page into the built site. Run after
// `quartz build` and `build-typed-graph.mjs`, so it lands beside the data.
import fs from 'node:fs';
import path from 'node:path';
const OUT = process.argv[2] ?? 'public/typed-graph';
fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync('scripts/typed-graph.html', path.join(OUT, 'index.html'));
fs.copyFileSync('scripts/graph.js', path.join(OUT, 'graph.js'));
console.log(`typed-graph page → ${OUT}/`);
