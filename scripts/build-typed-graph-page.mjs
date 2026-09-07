// Copies the explorer into the built site. Run after `quartz build` and
// `build-typed-graph.mjs`, so it lands beside the data it reads.
//
// __BASE__ is substituted here rather than hard-coded in the source, because a
// standalone page reached through Quartz's SPA router has its relative URLs
// resolved against the page you came from.
import fs from 'node:fs';
import path from 'node:path';
import { basePath } from './lib/base.mjs';

const OUT = process.argv[2] ?? 'public/typed-graph';
const BASE = basePath();
const copy = (from, to) =>
  fs.writeFileSync(path.join(OUT, to), fs.readFileSync(from, 'utf8').replaceAll('__BASE__', BASE));

fs.mkdirSync(OUT, { recursive: true });
copy('scripts/explorer.html', 'index.html');
copy('scripts/explorer.js', 'explorer.js');
console.log(`explorer → ${OUT}/ · base "${BASE || '/'}"`);
