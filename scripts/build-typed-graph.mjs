// content/ -> typed-graph-data.json
//
// Beyond a plain link graph this emits: typed edges, per-style lens membership,
// edge-level timestamp provenance, citation-count node weight, and the cycles in
// the `triggers` subgraph — the pursue/withdraw and shame-spiral loops, which are
// the point of modelling attachment as a directed graph in the first place.
import fs from 'node:fs';
import path from 'node:path';
import { loadNotes, buildIndex } from './lib/notes.mjs';
import { PREDICATES, CYCLE_PREDICATES, STYLES } from './schema.mjs';

const OUT = process.argv[2] ?? 'public/static/typed-graph-data.json';
const MAX_CYCLE = 8;

const notes = loadNotes('content');
const index = buildIndex(notes);
const byPath = new Map(notes.map((n) => [n.path, n]));

const edges = [];
const push = (from, to, predicate, src, derived = false) => {
  edges.push({ source: from, target: to, predicate, group: PREDICATES[predicate].group, src, derived });
};

for (const n of notes) {
  for (const r of n.rels) {
    const t = index.resolve(r.target);
    if (!t || !PREDICATES[r.predicate]) continue;
    push(n.path, t.path, r.predicate, r.src);
  }
}

// Materialise reciprocals for symmetric predicates so the renderer never has to
// care which side an edge was authored on.
const have = new Set(edges.map((e) => `${e.source}|${e.predicate}|${e.target}`));
for (const e of [...edges]) {
  if (!PREDICATES[e.predicate].symmetric) continue;
  const key = `${e.target}|${e.predicate}|${e.source}`;
  if (!have.has(key)) { push(e.target, e.source, e.predicate, e.src, true); have.add(key); }
}

// Node weight = how many distinct videos cite it. A concept she returns to in
// fifteen videos is load-bearing; this surfaces that without hand-ranking.
const citations = new Map();
for (const n of notes) {
  const vids = new Set();
  for (const r of n.rels) {
    if (r.predicate === 'described_in') { const t = index.resolve(r.target); if (t) vids.add(t.slug); }
    if (r.src) vids.add(r.src.videoId);
  }
  citations.set(n.path, vids.size);
}

const nodes = notes
  .filter((n) => n.type)
  .map((n) => ({
    id: n.path,
    title: n.title,
    type: n.type,
    slug: n.slug,
    url: `/${n.path}`,
    attribution: n.data.attribution ?? null,
    actor: n.data.actor ?? 'self',
    marker: n.data.marker === true,
    lens: n.data.lens ?? null,
    styles: n.data.styles ?? null,
    citations: citations.get(n.path) ?? 0,
    status: n.data.status ?? 'draft',
  }));

const known = new Set(nodes.map((n) => n.id));
const kept = edges.filter((e) => known.has(e.source) && known.has(e.target));

// Elementary cycles in the causal subgraph, bounded depth, deduped by rotation.
function findCycles(preds) {
  const adj = new Map();
  for (const e of kept) {
    if (!preds.includes(e.predicate)) continue;
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source).push(e.target);
  }
  const found = new Map();
  const canonical = (cycle) => {
    const i = cycle.indexOf([...cycle].sort()[0]);
    return [...cycle.slice(i), ...cycle.slice(0, i)].join('>');
  };
  const dfs = (start, node, pathArr, seen) => {
    if (pathArr.length > MAX_CYCLE) return;
    for (const next of adj.get(node) ?? []) {
      if (next === start) {
        const key = canonical(pathArr);
        if (!found.has(key)) found.set(key, [...pathArr]);
      } else if (!seen.has(next) && next > start) {
        seen.add(next);
        dfs(start, next, [...pathArr, next], seen);
        seen.delete(next);
      }
    }
  };
  for (const start of adj.keys()) dfs(start, start, [start], new Set([start]));
  return [...found.values()]
    .sort((a, b) => a.length - b.length)
    .map((c, i) => ({ id: `cycle-${i + 1}`, length: c.length, nodes: c }));
}

const cycles = findCycles(CYCLE_PREDICATES);

const data = {
  generated: new Date().toISOString(),
  styles: STYLES,
  predicates: Object.fromEntries(
    Object.entries(PREDICATES).map(([k, v]) => [k, { group: v.group, symmetric: !!v.symmetric }]),
  ),
  nodes,
  edges: kept,
  cycles,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
console.log(`${nodes.length} nodes · ${kept.length} edges · ${cycles.length} cycles → ${OUT}`);
