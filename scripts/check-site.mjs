// Smoke test over the *published* output, not the source.
//
// Every presentation defect this project has had — entry pages that rendered
// "Nothing here yet", a toolbox nothing linked to, a CI job missing a build
// step — was found by a person looking at the site. The validator checks the
// data; this checks what actually shipped. Run it last, and let it fail the
// build.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] ?? 'public';
const problems = [];
const fail = (msg) => problems.push(msg);

const read = (p) => {
  const f = path.join(ROOT, p);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
};
const need = (p, minBytes = 0) => {
  const body = read(p);
  if (body === null) { fail(`missing: ${p}`); return null; }
  if (body.length < minBytes) fail(`suspiciously small (${body.length}B < ${minBytes}B): ${p}`);
  return body;
};

/* the three built surfaces beyond Quartz's own pages */
need('index.html', 2000);
need('typed-graph/index.html', 3000);
need('typed-graph/explorer.js', 8000);
need('toolbox/index.html', 500);
need('toolbox/toolbox.js', 500);
need('agent/index.html', 2000);
need('agent/README.md', 3000);
need('agent/nodes.tsv', 10000);
need('agent/context/00-index.md', 5000);

/* the data the pages read */
for (const [p, check] of [
  ['static/typed-graph-data.json', (d) => {
    if (!d.nodes?.length) return 'no nodes';
    if (!d.edges?.length) return 'no edges';
    if (d.format !== 'as-kg/graph@1') return `unexpected format "${d.format}"`;
    const noGloss = d.nodes.filter((n) => !n.gloss).length;
    if (noGloss > d.nodes.length * 0.05) return `${noGloss} nodes have no gloss`;
    return null;
  }],
  ['static/flows.json', (d) => (d.flows?.length ? null : 'no flows')],
  ['agent/graph.json', (d) => (d.nodes?.length ? null : 'no nodes')],
]) {
  const body = read(p);
  if (body === null) { fail(`missing: ${p}`); continue; }
  try {
    const err = check(JSON.parse(body));
    if (err) fail(`${p}: ${err}`);
  } catch (e) { fail(`${p}: not valid JSON — ${e.message}`); }
}

/* nothing published should still be reachable only by typing the URL */
const home = read('index.html') ?? '';
for (const target of ['typed-graph', 'toolbox', 'agent']) {
  if (!new RegExp(`href="[^"]*${target}/?"`).test(home)) {
    fail(`the home page does not link to /${target}/ — it is unreachable`);
  }
}

/* the entry pages are templates; an unexpanded one publishes as a stub */
const walk = (dir, acc = []) => {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
};
const pages = walk(path.join(ROOT, 'moc'));
if (!pages.length) fail('no entry pages under moc/ were published at all');
for (const p of pages) {
  const body = fs.readFileSync(p, 'utf8');
  const rel = path.relative(ROOT, p);
  if (body.includes('<!-- auto:')) fail(`${rel}: an auto: marker was never expanded`);
  const empties = (body.match(/Nothing here yet/g) ?? []).length;
  if (empties > 2) fail(`${rel}: ${empties} empty sections — the style key is probably wrong`);
}

/* every note the graph claims exists should have a page */
try {
  const d = JSON.parse(read('static/typed-graph-data.json'));
  const missing = d.nodes.filter((n) => !fs.existsSync(path.join(ROOT, n.id + '.html')));
  if (missing.length) {
    fail(`${missing.length} nodes have no published page, e.g. ${missing.slice(0, 3).map((n) => n.id).join(', ')}`);
  }
} catch { /* already reported above */ }

if (problems.length) {
  console.error(`site check failed — ${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log(`site check passed · ${pages.length} entry pages · ${ROOT}/`);
