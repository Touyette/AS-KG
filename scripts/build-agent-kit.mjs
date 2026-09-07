// Builds /agent/ — everything a model needs to use this corpus, and nothing it
// has to guess. The site is static, so there is no query API and no server: the
// contract is one JSON file, one index, the rules, and a URL format that lets an
// agent hand a person a picture of what it just said.
//
// Run after build-typed-graph.mjs (the data), build-toolbox.mjs (the flows) and
// bundle.mjs (the markdown slices). Generated from the repo, so it cannot drift
// from the site.
import fs from 'node:fs';
import path from 'node:path';
import { PREDICATES } from './schema.mjs';

const OUT = process.argv[2] ?? 'public/agent';
const GRAPH = 'public/static/typed-graph-data.json';

if (!fs.existsSync(GRAPH)) {
  console.error(`missing ${GRAPH} — run build-typed-graph.mjs first`);
  process.exit(1);
}
const G = JSON.parse(fs.readFileSync(GRAPH, 'utf8'));

// The published origin, read from the site config so the documented links are
// the real ones rather than a copy that rots.
let base = 'https://example.invalid';
try {
  const m = /^\s*baseUrl:\s*"?([^"\s#]+)"?/m.exec(fs.readFileSync('quartz.config.yaml', 'utf8'));
  if (m) base = 'https://' + m[1].replace(/^https?:\/\//, '').replace(/\/$/, '');
} catch { /* config unreadable — the placeholder is obvious enough to notice */ }

fs.mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------------- payload */

// Shipped minified: the pretty-printed copy the site reads is a third bigger
// for no benefit to something that parses it.
const graphMin = JSON.stringify(G);
fs.writeFileSync(path.join(OUT, 'graph.json'), graphMin);
const graphKB = Math.round(graphMin.length / 1024);

for (const [from, to] of [
  ['_meta/schema.json', 'schema.json'],
  ['_meta/operating-rules.md', 'operating-rules.md'],
  ['public/static/flows.json', 'flows.json'],
]) {
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(OUT, to));
  else console.warn(`  (skipped ${from} — not built)`);
}

// One line per node: enough to choose what to look at without pulling the
// whole graph first.
const index = G.nodes
  .slice()
  .sort((a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title))
  .map((n) => `${n.id}\t${n.type}\t${n.title}\t${n.gloss ?? ''}`);
const tsv = 'id\ttype\ttitle\tgloss\n' + index.join('\n') + '\n';
fs.writeFileSync(path.join(OUT, 'nodes.tsv'), tsv);
const tsvKB = Math.round(tsv.length / 1024);

// The markdown bundle, if it was built into place: the same graph written for a
// context window rather than for a parser.
const hasContext = fs.existsSync(path.join(OUT, 'context', '00-index.md'));
if (!hasContext) console.warn('  (no context/ — run `node scripts/bundle.mjs public/agent/context` first)');

/* -------------------------------------------------------------------- README */

const B = '`';                       // keeps the template literals below readable
const predTable = Object.entries(PREDICATES).map(([name, p]) => {
  const d = p.domain === '*' ? 'any' : p.domain.join(', ');
  const r = p.range === '*' ? 'any' : p.range.join(', ');
  const n = G.counts.byPredicate[name] ?? 0;
  return `| ${B}${name}${B} | ${p.group} | ${d} | ${r} | ${n} |`;
}).join('\n');

const typeTable = Object.entries(G.counts.byType)
  .sort((a, b) => b[1] - a[1])
  .map(([t, n]) => `${B}${t}${B} (${n})`).join(' · ');

const EXAMPLE = 'strategies/affect-suppression,states/unregistered-hurt';
const contextRow = hasContext
  ? `\n| [${B}context/${B}](context/) | The whole graph as markdown, sliced for loading into a context window. |`
  : '';
const contextBullet = hasContext
  ? `- **You are reading it into a context window.** Take [${B}context/${B}](context/) —
  the same graph written as markdown and split into slices you can load one at a
  time, with the rules and the flows alongside. ${B}context/README.md${B} gives the
  token cost of each piece.\n`
  : '';

const readme = `# Using this graph

A knowledge graph of Heidi Priebe's work on attachment theory: ${G.counts.nodes}
nodes and ${G.counts.edges} typed edges, every claim carrying the video and the
timestamp it came from. This page is the contract. Read the operating rules
before you use any of it.

Generated ${G.generated.slice(0, 10)} · format ${B}${G.format}${B}.

## Files

| File | What it is |
|---|---|
| [${B}graph.json${B}](graph.json) | The whole graph. Nodes, typed edges, per-style lens membership, detected loops. ${graphKB} KB. |
| [${B}nodes.tsv${B}](nodes.tsv) | ${B}id · type · title · gloss${B}, one line per node. ${tsvKB} KB. |
| [${B}schema.json${B}](schema.json) | The closed vocabulary the graph is validated against. |
| [${B}operating-rules.md${B}](operating-rules.md) | Binding constraints. Not advisory. |
| [${B}flows.json${B}](flows.json) | The decision flows behind [the toolbox](../toolbox/) — questions with safety gates, not advice. |${contextRow}

There is no query endpoint — the site is static. Which file you want depends on
what you can do with it:

- **You can run code.** Fetch ${B}graph.json${B} and traverse it. ${graphKB} KB, which is
  nothing for a program and far too much to paste into a context window.
${contextBullet}- **You only need to decide what to look at.** ${B}nodes.tsv${B}, ${tsvKB} KB, one line
  per node, then fetch the notes you want from the site.

## Shape

${B}${B}${B}json
{
  "format": "${G.format}",
  "nodes": [{
    "id": "strategies/affect-suppression",   // stable; also the site path
    "title": "Affect Suppression",
    "type": "strategy",
    "url": "/strategies/affect-suppression",
    "gloss": "one sentence, taken from the note",
    "aliases": ["suppression", "emotionally unavailable"],
    "attribution": "literature | priebe | synthesis",
    "actor": "self | partner | dyad",
    "marker": false,                        // true = a sign of change, not a problem
    "lens": { "dismissive-avoidant": "core", "anxious-preoccupied": "feared" },
    "citations": 5,                         // distinct videos citing it
    "degree": 22                            // distinct neighbours
  }],
  "edges": [{
    "source": "...", "target": "...",
    "predicate": "deactivates", "group": "activation",
    "src": { "videoId": "7mElEzMpbeE", "seconds": 970 },  // the receipt; may be null
    "derived": false                        // true = an auto-generated reciprocal
  }],
  "cycles": [{ "id": "cycle-1", "length": 3, "nodes": ["..."] }]
}
${B}${B}${B}

Node types: ${typeTable}.

${B}derived: true${B} edges are reciprocals materialised for symmetric predicates.
Skip them when listing a node's relationships, or you will show everything twice.

${B}attribution${B} records where an idea came from, not how well it is established:
${B}literature${B} for standard attachment theory, ${B}priebe${B} for her own framing,
${B}synthesis${B} for a connection drawn here. It is not a confidence score.

## Predicates

Direction matters and is enforced at authoring time, so you can rely on it:
${B}A triggers B${B} means A fires B, never the reverse.

| predicate | group | domain | range | count |
|---|---|---|---|---|
${predTable}

The groups answer different questions. **activation** — what fires what.
**defense** — how the pattern is built. **identity** — how things compare across
styles. **healing** — what changes it. **provenance** — where it came from.

${B}mirrors${B} is the most useful predicate when helping someone: it pairs a move in
one style with its counterpart in another, without claiming anything about who
is running which.

## Lenses

The same topology reads differently through each style. Every node carries a
${B}lens${B} map with one of ${B}core${B}, ${B}secondary${B}, ${B}alternating${B}, ${B}feared${B}, ${B}absent${B},
${B}secure-form${B} per style. ${B}alternating${B} is how fearful-avoidant is carried — the
node belongs to that style by oscillation rather than by default. ${B}absent${B} means
the node does not belong to that lens at all; drop it rather than showing it
greyed out.

## Loops

${G.counts.cycles} cycles are detected over the flow predicates
(${G.cyclePredicates.join(', ')}) and listed under ${B}cycles${B}. They are the point of
modelling this as a directed graph — the pursue/withdraw loop, the shame spiral.
A loop is a finding, not an error.

## Showing someone what you are talking about

The explorer at [${B}/typed-graph/${B}](../typed-graph/) reads its entire state from
the URL fragment, so the link is the transport. Write one and the person sees
exactly the nodes you meant, with your sentence above them.

${B}${B}${B}
${base}/typed-graph/#focus=${EXAMPLE}&mode=discussion&why=Two%20sides%20of%20the%20same%20move
${B}${B}${B}

| parameter | value |
|---|---|
| ${B}focus${B} | comma-separated node ids. A full path, a slug or a title all resolve. |
| ${B}mode${B} | ${B}discussion${B} (you chose these) or ${B}explore${B} (default, the person is browsing) |
| ${B}why${B} | one line shown above the graph. URL-encode it. |
| ${B}depth${B} | ${B}0${B} focus only · ${B}1${B} plus neighbours (default) · ${B}2${B} two hops |
| ${B}style${B} | one or more of ${G.styles.join(', ')}, comma-separated — colours and filters by attachment style. ${B}lens${B} is the older single-style spelling and still works. |
| ${B}rel${B} | comma-separated groups to keep: activation, defense, identity, healing, provenance |
| ${B}trace${B} | ${B}a%3Eb${B} — draws the shortest path between two nodes |

Rules of thumb: two to six ids reads well, more than about ten is a hairball.
Use ${B}depth=0${B} when the focus set is already the whole point (a loop, a pair of
mirrored moves) and ${B}depth=1${B} when you want the person to be able to wander.
Always write a ${B}why${B} — a link with no sentence attached is one the person has to
guess at.

## What not to do with this

The full rules are in [${B}operating-rules.md${B}](operating-rules.md) and they bind.
The short version:

1. **Screen before you reframe.** Attachment patterns amplify real signals; they
   do not manufacture them. Establish that nothing bad is actually happening
   before offering a reading of the pattern.
2. **Never tell anyone their attachment style.** Not as a guess, not as "this
   sounds like". The material is for recognition, not classification.
3. **Never type an absent partner.** Describe patterns, not people.
4. **Cite it or do not say it.** Every claim here traces to a video and a
   timestamp; carry the citation through.
5. **No diagnosis, no quiz, no scoring.**
6. **Hand off in a crisis.** A person, not a decision tree.
7. **This is not therapy** and inherits the ceiling of its source.

This is a derivative index of Heidi Priebe's
[work](https://www.youtube.com/@heidipriebe1), built to help someone re-find her
material, not to replace watching it. All credit for the ideas is hers. No note
reproduces transcript text.
`;
fs.writeFileSync(path.join(OUT, 'README.md'), readme);

/* ---------------------------------------------------------------- index.html */

const rows = [
  ['graph.json', `the whole graph · ${G.counts.nodes} nodes, ${G.counts.edges} edges · ${graphKB} KB`],
  ['nodes.tsv', `id, type, title, gloss — one line per node · ${tsvKB} KB`],
  ['schema.json', 'the closed vocabulary'],
  ['operating-rules.md', 'binding constraints'],
  ['flows.json', 'the decision flows behind the toolbox'],
  ['README.md', 'the full contract, as markdown'],
].filter(([f]) => fs.existsSync(path.join(OUT, f)));
if (hasContext) rows.push(['context/', 'the whole graph as markdown, sliced for a context window']);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>For agents — Attachment Theory Knowledge Graph</title>
<meta name="description" content="The machine-readable surface of the graph: one JSON file, the schema, the operating rules, and a URL format for showing someone what you are talking about.">
<style>
:root{--bg:#f6f5f4;--panel:#fffefd;--line:#e2ded9;--ink:#26242b;--dim:#6d6a75;--accent:#7b4bd8}
@media (prefers-color-scheme:dark){:root{--bg:#131318;--panel:#1b1b22;--line:#2c2c36;--ink:#e9e7ee;--dim:#9d9aa8;--accent:#b39bff}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 "Source Sans Pro",-apple-system,BlinkMacSystemFont,system-ui,sans-serif}
.wrap{max-width:720px;margin:0 auto;padding:2.5rem 1.25rem 4rem}
a{color:var(--accent)}
h1{font:600 30px/1.2 "Schibsted Grotesk",system-ui,sans-serif;letter-spacing:-.02em;margin:0 0 .4rem}
h2{font:600 12px/1 "Schibsted Grotesk",system-ui,sans-serif;text-transform:uppercase;letter-spacing:.09em;color:var(--dim);margin:2.4rem 0 .8rem}
.lede{color:var(--dim);margin:0 0 2rem}
ul.files{list-style:none;padding:0;margin:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--panel)}
ul.files li{display:flex;gap:1rem;padding:.7rem .95rem;border-bottom:1px solid var(--line);align-items:baseline;flex-wrap:wrap}
ul.files li:last-child{border-bottom:0}
ul.files a{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:14px;text-decoration:none;flex:none}
ul.files span{color:var(--dim);font-size:14px}
pre{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:.85rem .95rem;overflow-x:auto;font:13px/1.55 "IBM Plex Mono",ui-monospace,monospace}
code{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.92em}
table{border-collapse:collapse;width:100%;font-size:14.5px}
td,th{text-align:left;padding:.38rem .6rem .38rem 0;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--dim);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
ol{padding-left:1.15rem}
ol li{margin-bottom:.35rem}
.back{display:inline-block;margin-bottom:1.6rem;color:var(--dim);text-decoration:none;font-size:14px}
.back:hover{color:var(--ink)}
.foot{color:var(--dim);font-size:14.5px;margin-top:2.5rem}
</style>
</head>
<body>
<div class="wrap">
<a class="back" href="..">← Attachment Theory Knowledge Graph</a>
<h1>For agents</h1>
<p class="lede">The machine-readable surface of this graph: ${G.counts.nodes} nodes and
${G.counts.edges} typed edges, every claim carrying the video and the timestamp it
came from. Read <a href="operating-rules.md">the operating rules</a> before you
use any of it — they bind.</p>

<h2>Files</h2>
<ul class="files">
${rows.map(([f, d]) => `  <li><a href="${f}">${f}</a> <span>${d}</span></li>`).join('\n')}
</ul>
<p class="foot" style="margin-top:1rem">There is no query endpoint, and at this size
there does not need to be one — <code>graph.json</code> loads whole and traverses
in memory. <a href="README.md">The full contract</a> documents the node and edge
shape, all ${Object.keys(PREDICATES).length} predicates with their domain and
range, and what the four lenses mean.</p>

<h2>Showing someone what you mean</h2>
<p>The <a href="../typed-graph/">explorer</a> reads its entire state from the URL
fragment, so the link is the transport — no server, no socket. Write one and the
person sees exactly the nodes you meant, with your sentence above them.</p>
<pre>${base}/typed-graph/#focus=${EXAMPLE}
    &amp;mode=discussion
    &amp;why=Two%20sides%20of%20the%20same%20move</pre>
<table>
<tr><th>parameter</th><th>value</th></tr>
<tr><td><code>focus</code></td><td>comma-separated node ids — a path, a slug or a title all resolve</td></tr>
<tr><td><code>mode</code></td><td><code>discussion</code> (you chose these) or <code>explore</code> (default)</td></tr>
<tr><td><code>why</code></td><td>one line shown above the graph — always write one</td></tr>
<tr><td><code>depth</code></td><td><code>0</code> focus only · <code>1</code> plus neighbours · <code>2</code> two hops</td></tr>
<tr><td><code>style</code></td><td>one or more of ${G.styles.join(', ')}, comma-separated (<code>lens</code> is the older single-style spelling and still works)</td></tr>
<tr><td><code>rel</code></td><td>which relationship groups to keep</td></tr>
<tr><td><code>trace</code></td><td><code>a%3Eb</code> — the shortest path between two nodes</td></tr>
</table>

<h2>The rules, in short</h2>
<ol>
<li><b>Screen before you reframe.</b> Attachment patterns amplify real signals; they do not manufacture them.</li>
<li><b>Never tell anyone their attachment style.</b> The material is for recognition, not classification.</li>
<li><b>Never type an absent partner.</b> Describe patterns, not people.</li>
<li><b>Cite it or do not say it.</b></li>
<li><b>No diagnosis, no quiz, no scoring.</b></li>
<li><b>Hand off in a crisis.</b> A person, not a decision tree.</li>
<li><b>This is not therapy</b> and inherits the ceiling of its source.</li>
</ol>

<p class="foot">A derivative index of
<a href="https://www.youtube.com/@heidipriebe1">Heidi Priebe's work</a>, built to help
someone re-find her material rather than replace watching it. All credit for the
ideas is hers. No note reproduces transcript text.</p>
</div>
</body>
</html>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), html);

console.log(`agent kit → ${OUT}/ · ${rows.length} entries · ${G.counts.nodes} nodes indexed`);
