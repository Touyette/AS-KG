#!/usr/bin/env node
// Generates INDEX.md — the one file an assistant reads to orient itself.
//
//   node tools/index.mjs            # write INDEX.md
//   node tools/index.mjs --stdout   # print it instead
//   node tools/index.mjs --check    # fail if INDEX.md is out of date
//
// It is generated rather than written, so adding to the corpus re-ranks it and
// it cannot drift from the notes. Every entry carries its own typed links, so
// reading the index already makes the first hop — the point being that the value
// of this graph is the edges, and an index of titles alone would train an
// assistant to treat the material as a vocabulary list.
import fs from 'node:fs';
import path from 'node:path';
import { loadNotes, buildIndex } from '../scripts/lib/notes.mjs';
import { gloss } from '../scripts/lib/gloss.mjs';

const OUT = 'INDEX.md';
// Allocated per group rather than by one global ranking. The causal core — what
// fires what — is only ~110 nodes and it is what an assistant reasons *with*, so
// it gets most of the room. Concepts number 245 and are what you look *up*, so
// the tail of those is left to grep.
const GLOSS = 165;         // characters of gloss per entry
const LINKS = 4;           // typed links shown per entry

/* Which links actually tell you something, best first. `characterizes` is left
 * out because the style line already says it, and provenance is left out
 * because the note carries the timestamps anyway. */
const LINK_RANK = [
  'mirrors', 'triggers', 'deactivates', 'manifests_as', 'healed_by',
  'originates_in', 'sustains', 'defends_against', 'regulates', 'requires',
  'part_of', 'mistaken_for', 'contrasts_with',
];
const SYMMETRIC = new Set(['mirrors', 'contrasts_with']);
const SKIP_LINK = new Set(['described_in', 'derived_from', 'characterizes']);

const GROUPS = [
  ['How the pattern runs', ['trigger', 'state', 'strategy', 'behavior'], 62,
   'What sets the system off, what is felt underneath, what the system does about it, and what that looks like from outside.'],
  ['How it is built', ['belief', 'origin', 'style'], 40,
   'The conclusion that keeps a strategy running, and the developmental condition that made the conclusion reasonable at the time.'],
  ['What changes it', ['practice'], 28,
   'Things she describes someone actually doing. Each is linked to what it is meant to unwind, so reach these through a `healed_by` or `regulates` link rather than picking off a list.'],
  ['Named ideas', ['concept'], 38,
   'Her own vocabulary and framings. The largest group in the corpus and the one most worth grepping rather than browsing — only the most cited are here.'],
];

const STYLE_SHORT = {
  'anxious-preoccupied': 'anxious',
  'dismissive-avoidant': 'avoidant',
  'fearful-avoidant': 'fearful-avoidant',
  'secure': 'secure',
};
const LENS_SHORT = { core: 'core', secondary: 'secondary', alternating: 'alt', feared: 'feared', 'secure-form': 'secure-form' };

/* ------------------------------------------------------------------ gather */

const notes = loadNotes('content');
const index = buildIndex(notes);
const byPath = new Map(notes.map((n) => [n.path, n]));

const degree = new Map(), cites = new Map();
const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
const incoming = new Map();          // path -> [{predicate, from}]

for (const n of notes) {
  const videos = new Set();
  for (const r of n.rels) {
    const t = index.resolve(r.target);
    if (!t) continue;
    if (r.predicate === 'described_in') { videos.add(t.slug); continue; }
    if (r.src) videos.add(r.src.videoId);
    bump(degree, n.path);
    bump(degree, t.path);
    if (!incoming.has(t.path)) incoming.set(t.path, []);
    incoming.get(t.path).push({ predicate: r.predicate, from: n.path });
  }
  cites.set(n.path, videos.size);
}
const weight = (n) => (cites.get(n.path) ?? 0) * 2 + (degree.get(n.path) ?? 0) * 0.25;

/* ------------------------------------------------------------------ format */

const clip = (s, n) => (s && s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : (s || ''));

const styleLine = (n) => {
  const l = n.data.lens;
  if (!l) return '';
  const parts = Object.entries(l)
    .filter(([, v]) => v && v !== 'absent')
    .map(([k, v]) => `${STYLE_SHORT[k] ?? k}(${LENS_SHORT[v] ?? v})`);
  return parts.join(' ');
};

function linkLine(n) {
  const rows = [];
  const seen = new Set();
  const add = (predicate, otherPath, dir) => {
    const o = byPath.get(otherPath);
    if (!o || SKIP_LINK.has(predicate)) return;
    const key = predicate + '|' + otherPath;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ predicate, title: o.title, dir });
  };
  for (const r of n.rels) {
    const t = index.resolve(r.target);
    if (t) add(r.predicate, t.path, SYMMETRIC.has(r.predicate) ? 'sym' : 'out');
  }
  for (const r of incoming.get(n.path) ?? []) {
    if (SYMMETRIC.has(r.predicate)) continue;    // already shown from the other side
    add(r.predicate, r.from, 'in');
  }
  rows.sort((a, b) => {
    const ra = LINK_RANK.indexOf(a.predicate), rb = LINK_RANK.indexOf(b.predicate);
    return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
  });
  const arrow = { out: '→', in: '←', sym: '⟷' };
  return rows.slice(0, LINKS)
    .map((r) => `${arrow[r.dir]} ${r.predicate} **${r.title}**`)
    .join(' · ');
}

const entry = (n) => {
  const s = styleLine(n);
  const links = linkLine(n);
  return [
    `**${n.title}** \`${n.path}\`${s ? ` · *${s}*` : ''}`,
    `  ${clip(gloss(n.body), GLOSS)}`,
    links ? `  ${links}` : null,
  ].filter(Boolean).join('\n');
};

/* -------------------------------------------------------------------- build */

const eligible = notes.filter((n) => n.type && !['video', 'source'].includes(n.type));
const picked = new Map();            // heading -> the notes shown under it
for (const [heading, types, cap] of GROUPS) {
  picked.set(heading, eligible
    .filter((n) => types.includes(n.type))
    .sort((a, b) => weight(b) - weight(a))
    .slice(0, cap));
}
const shown = [...picked.values()].reduce((s, l) => s + l.length, 0);

const counts = {};
for (const n of notes) if (n.type) counts[n.type] = (counts[n.type] ?? 0) + 1;
const total = eligible.length;

let md = `# Index

The ${shown} load-bearing nodes of ${total}, each with its own typed links, so
reading this already makes the first hop. Generated from \`content/\` — regenerate
with \`node tools/index.mjs\`.

**A node's id is its path.** \`strategies/deactivating-strategies\` is
\`content/strategies/deactivating-strategies.md\`, and that file holds the full
prose, every typed link, and the video timestamp for each one. Read the note when
a node matters; do not read them all.

**The ${total - shown} nodes not listed here** are reachable two ways: they turn up as the
targets of links below, and they are greppable —

\`\`\`
grep -ril "the words they used" content/
grep -h "^title:" content/practices/*.md
grep -A20 "^## Relationships" content/<id>.md
\`\`\`

**Reading an entry.** \`→\` is a link out, \`←\` a link in, \`⟷\` symmetric. The
italics say what the node is for each style: \`core\`, \`secondary\`, \`alt\`
(alternating — how fearful-avoidance is carried, both in turn), \`feared\` (what
that style organises itself against). A style not listed means absent.

`;

for (const [heading, types, , blurb] of GROUPS) {
  const list = picked.get(heading);
  if (!list.length) continue;
  const pool = types.reduce((s, t) => s + (counts[t] ?? 0), 0);
  md += `\n## ${heading}\n\n${blurb}\n\n*The ${list.length} most-cited of ${pool} — ${types.join(', ')}.*\n\n`;
  md += list.map(entry).join('\n\n') + '\n';
}

md += `\n---\n\nGenerated ${new Date().toISOString().slice(0, 10)} · ${total} idea nodes, `
  + `${counts.video ?? 0} videos, ${counts.source ?? 0} sources. Do not edit by hand.\n`;

/* ------------------------------------------------------------------- output */

const args = process.argv.slice(2);
if (args.includes('--stdout')) {
  process.stdout.write(md);
} else if (args.includes('--check')) {
  const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  const strip = (s) => s.replace(/^Generated \d{4}-\d{2}-\d{2}.*$/m, '');
  if (strip(have) !== strip(md)) {
    console.error(`${OUT} is out of date. Regenerate it:  node tools/index.mjs`);
    process.exit(1);
  }
  console.log(`${OUT} is current · ${shown} of ${total} nodes`);
} else {
  fs.writeFileSync(OUT, md);
  const kb = Math.round(md.length / 1024);
  console.log(`${OUT} · ${shown} of ${total} nodes · ${kb} KB · ~${Math.round(md.length / 4 / 1000)}k tokens`);
}
