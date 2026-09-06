// Purpose-built export for the overview deck: every node with its prose, its
// edges and its provenance, plus flows, loops and corpus stats. Generated from
// the repo so the deck can never drift from what is actually in the graph.
import fs from 'node:fs';
import { loadNotes, buildIndex } from './lib/notes.mjs';
import { loadFlows } from './flows.mjs';

const notes = loadNotes('content');
const index = buildIndex(notes);
const graph = JSON.parse(fs.readFileSync('public/static/typed-graph-data.json', 'utf8'));
const videos = notes.filter((n) => n.type === 'video');
const vById = new Map(videos.map((v) => [v.data.video_id, v]));

const nodes = notes.filter((n) => n.type && n.type !== 'video').map((n) => ({
  title: n.title, type: n.type, path: n.path,
  attribution: n.data.attribution ?? null,
  actor: n.data.actor ?? 'self',
  aliases: n.data.aliases ?? [],
  lens: n.data.lens ?? null,
  summary: n.body.split('\n## Relationships')[0].trim(),
  rels: n.rels.map((r) => {
    const t = index.resolve(r.target);
    return t ? { p: r.predicate, to: t.title, toType: t.type,
                 src: r.src ? { v: r.src.videoId, t: r.src.seconds,
                                title: vById.get(r.src.videoId)?.title ?? null } : null } : null;
  }).filter(Boolean),
}));

const series = {};
for (const v of videos) (series[v.data.series] ??= []).push({
  title: v.title, id: v.data.video_id, duration: v.data.duration,
  status: v.data.status, styles: v.data.styles ?? [] });

const cited = new Set();
for (const n of notes) for (const r of n.rels) if (r.predicate === 'described_in') {
  const t = index.resolve(r.target); if (t) cited.add(t.slug);
}

fs.writeFileSync('dist/deck-data.json', JSON.stringify({
  nodes,
  cycles: graph.cycles.map((c) => ({ length: c.length,
    steps: c.nodes.map((id) => {
      const nd = graph.nodes.find((x) => x.id === id);
      const nx = c.nodes[(c.nodes.indexOf(id) + 1) % c.nodes.length];
      const e = graph.edges.find((x) => x.source === id && x.target === nx);
      return { from: nd?.title, pred: e?.predicate, to: graph.nodes.find((x) => x.id === nx)?.title };
    }) })),
  flows: loadFlows('flows'),
  series,
  stats: {
    notes: notes.length, nodes: nodes.length, edges: graph.edges.length,
    videos: videos.length,
    mined: videos.filter((v) => cited.has(v.slug)).length,
    noCaptions: videos.filter((v) => v.data.status === 'no-captions').length,
    hours: +(videos.reduce((s, v) => s + (v.data.duration ?? 0), 0) / 3600).toFixed(1),
    byType: nodes.reduce((a, n) => ({ ...a, [n.type]: (a[n.type] ?? 0) + 1 }), {}),
    byAttribution: nodes.reduce((a, n) => ({ ...a, [n.attribution]: (a[n.attribution] ?? 0) + 1 }), {}),
  },
}, null, 1));
console.log('deck-data.json written ·', nodes.length, 'nodes ·', Object.keys(series).length, 'series');
