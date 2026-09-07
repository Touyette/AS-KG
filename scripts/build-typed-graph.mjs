// content/ -> typed-graph-data.json
//
// This file is the project's machine-readable surface: the explorer page reads
// it, and so does any agent handed the corpus. Beyond a plain link graph it
// emits typed edges, per-style lens membership, edge-level timestamp provenance,
// a one-line gloss and the aliases for every node, citation-count weight, and
// the cycles in the causal subgraph — the pursue/withdraw and shame-spiral
// loops, which are the point of modelling attachment as a directed graph.
import fs from 'node:fs';
import path from 'node:path';
import { loadNotes, buildIndex } from './lib/notes.mjs';
import { gloss } from './lib/gloss.mjs';
import { PREDICATES, CYCLE_PREDICATES, STYLES, NODE_TYPES, LENS_VALUES } from './schema.mjs';

const OUT = process.argv[2] ?? 'public/static/typed-graph-data.json';
const MAX_CYCLE = 8;

const notes = loadNotes('content');
const index = buildIndex(notes);

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
    gloss: gloss(n.body),
    aliases: (n.data.aliases ?? []).map(String),
    attribution: n.data.attribution ?? null,
    actor: n.data.actor ?? 'self',
    marker: n.data.marker === true,
    lens: n.data.lens ?? null,
    styles: n.data.styles ?? null,
    citations: citations.get(n.path) ?? 0,
    degree: 0,
    status: n.data.status ?? 'draft',
    // Only set where a video had no caption file and its timestamps had to be
    // derived from position in the transcript. A consumer should not treat those
    // as exact, and cannot tell without being told.
    timestamps: n.data.timestamps ?? null,
  }));

const known = new Set(nodes.map((n) => n.id));
const kept = edges.filter((e) => known.has(e.source) && known.has(e.target));

// Degree counts distinct neighbours, not edges: two nodes joined by three
// predicates are one connection to a reader, and the renderer sizes by this.
const nbrs = new Map(nodes.map((n) => [n.id, new Set()]));
for (const e of kept) { nbrs.get(e.source).add(e.target); nbrs.get(e.target).add(e.source); }
for (const n of nodes) n.degree = nbrs.get(n.id).size;

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

const counts = { nodes: nodes.length, edges: kept.length, cycles: cycles.length, byType: {}, byPredicate: {} };
for (const n of nodes) counts.byType[n.type] = (counts.byType[n.type] ?? 0) + 1;
for (const e of kept) counts.byPredicate[e.predicate] = (counts.byPredicate[e.predicate] ?? 0) + 1;

const data = {
  // Bumped whenever the shape changes, so a consumer can fail loudly rather
  // than silently reading a field that moved.
  format: 'as-kg/graph@1',
  generated: new Date().toISOString(),
  styles: STYLES,
  nodeTypes: NODE_TYPES,
  lensValues: LENS_VALUES,
  cyclePredicates: CYCLE_PREDICATES,
  predicates: Object.fromEntries(
    Object.entries(PREDICATES).map(([k, v]) => [k, {
      group: v.group,
      symmetric: !!v.symmetric,
      flow: !!v.flow,
      domain: v.domain === '*' ? 'any' : v.domain,
      range: v.range === '*' ? 'any' : v.range,
    }]),
  ),
  counts,
  nodes,
  edges: kept,
  cycles,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
console.log(`${nodes.length} nodes · ${kept.length} edges · ${cycles.length} cycles → ${OUT}`);
