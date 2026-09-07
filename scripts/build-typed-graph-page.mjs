// Copies the explorer into the built site. Run after `quartz build` and
// `build-typed-graph.mjs`, so it lands beside the data it reads.
import fs from 'node:fs';
import path from 'node:path';
const OUT = process.argv[2] ?? 'public/typed-graph';
fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync('scripts/explorer.html', path.join(OUT, 'index.html'));
fs.copyFileSync('scripts/explorer.js', path.join(OUT, 'explorer.js'));
console.log(`explorer → ${OUT}/`);
