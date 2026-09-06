// Compiles the graph and the flows into a folder you can hand to a model:
// operating rules, the concept graph, the decision flows. Generated from the
// repo so it cannot drift from the site.
import fs from 'node:fs';
import path from 'node:path';
import { loadNotes, buildIndex } from './lib/notes.mjs';
import { loadFlows, validateFlows } from './flows.mjs';

const OUT = process.argv[2] ?? 'dist';
fs.mkdirSync(OUT, { recursive: true });

const notes = loadNotes('content');
const index = buildIndex(notes);
const concepts = notes.filter((n) => n.type && n.type !== 'video');
const videos = new Map(notes.filter((n) => n.type === 'video').map((n) => [n.path, n]));

const flows = loadFlows('flows');
const flowErrors = validateFlows(flows);
if (flowErrors.length) { console.error('refusing to bundle invalid flows:'); flowErrors.forEach(e=>console.error('  '+e)); process.exit(1); }

// --- 1. operating rules ------------------------------------------------------
fs.copyFileSync('_meta/operating-rules.md', path.join(OUT, '01-operating-rules.md'));

// --- 2. the graph ------------------------------------------------------------
const lensOf = (n) => Object.entries(n.data.lens ?? {}).filter(([, v]) => v !== 'absent')
  .map(([k, v]) => `${k}=${v}`).join(' ');
const byType = {};
for (const n of concepts) (byType[n.type] ??= []).push(n);

let kg = `# The graph\n\n${concepts.length} concepts from Heidi Priebe's attachment work, linked by typed\nrelationships. Every claim carries the video and timestamp it came from.\n\n` +
  `Relationship types: triggers, deactivates, manifests_as (how the pattern runs) ·\n` +
  `defends_against, sustains, originates_in, characterizes (how it is built) ·\n` +
  `healed_by, regulates, requires (what changes it) · mirrors, contrasts_with,\n` +
  `mistaken_for, part_of (how things relate) · described_in, derived_from (sources).\n\n` +
  `\`mirrors\` is the most useful one when helping someone: it pairs a move in one\nstyle with its counterpart in another.\n\n`;

const nodeBlock = (n) => {
  const body = n.body.split('\n## Relationships')[0].trim();
  const lens = lensOf(n);
  let out = `\n### ${n.title}\n`;
  out += `*${n.type}${n.data.actor === 'partner' ? ' · the partner\'s side' : ''} · ${n.data.attribution ?? 'unattributed'}${lens ? ` · ${lens}` : ''}${n.data.marker === true ? ' · sign of change' : ''}*\n\n`;
  out += body + '\n';
  const rels = n.rels.map((r) => {
    const t = index.resolve(r.target);
    if (!t) return null;
    if (r.predicate === 'described_in') {
      const v = videos.get(t.path);
      return `  - source: ${v ? v.title : t.title}${r.src ? ` @${r.src.seconds}s — https://youtu.be/${r.src.videoId}?t=${r.src.seconds}` : ''}`;
    }
    return `  - ${r.predicate} → ${t.title}${r.src ? ` (https://youtu.be/${r.src.videoId}?t=${r.src.seconds})` : ''}`;
  }).filter(Boolean);
  if (rels.length) out += '\n' + rels.join('\n') + '\n';
  return out;
};

for (const [type, list] of Object.entries(byType).sort()) {
  kg += `\n## ${type}\n`;
  for (const n of list.sort((a, b) => a.title.localeCompare(b.title))) kg += nodeBlock(n);
}
fs.writeFileSync(path.join(OUT, '02-graph.md'), kg);

// --- 2b. index and slices ----------------------------------------------------
// At 536 concepts the graph is ~60k tokens, which is too much to paste at the
// head of every conversation and mostly irrelevant to any one question. So the
// same content is also emitted as a cheap index plus loadable slices. Nothing is
// removed: 02-graph.md remains the whole thing for anyone who wants it.
const oneLine = (n) => {
  const body = n.body.split('\n## Relationships')[0].replace(/<!--[\s\S]*?-->/g, '').trim();
  const first = (body.split(/\n\s*\n/)[0] ?? '').replace(/\s+/g, ' ').trim();
  const m = first.match(/^(.{40,180}?[.!?])(\s|$)/);
  return m ? m[1] : first.slice(0, 170).replace(/\s\S*$/, '') + (first.length > 170 ? '…' : '');
};

const GROUP = {
  mechanism: ['state', 'strategy', 'trigger', 'behavior'],
  ideas:     ['concept'],
  structure: ['belief', 'origin', 'style'],
  healing:   ['practice'],
  sources:   ['source'],
};
const groupOf = (t) => Object.entries(GROUP).find(([, ts]) => ts.includes(t))?.[0] ?? 'structure';

let idx = `# Index\n\nEvery node in the graph, one line each, with the slice it lives in. Use this to\nfind what is relevant, then load only that slice. Titles here are exactly the\nnames the flows cite and the graph links by.\n\n`;
for (const [type, list] of Object.entries(byType).sort()) {
  idx += `\n## ${type} (${list.length}) — in \`02-graph-${groupOf(type)}.md\`\n\n`;
  for (const n of list.sort((a, b) => a.title.localeCompare(b.title))) {
    const lens = lensOf(n).replace(/=\S+/g, '').split(' ').filter(Boolean).join('/');
    idx += `- **${n.title}**${n.data.marker === true ? ' [sign of change]' : ''}${lens ? ` — ${lens}` : ''} — ${oneLine(n)}\n`;
  }
}
fs.writeFileSync(path.join(OUT, '00-index.md'), idx);

const slices = {};
for (const [type, list] of Object.entries(byType)) (slices[groupOf(type)] ??= []).push([type, list]);
const sliceFiles = [];
for (const [g, entries] of Object.entries(slices)) {
  let out = `# Graph slice: ${g}\n\nPart of the graph. The full vocabulary is in \`00-index.md\`; the other slices\nare \`02-graph-*.md\`. Every claim carries the video and timestamp it came from.\n`;
  for (const [type, list] of entries.sort()) {
    out += `\n## ${type}\n`;
    for (const n of list.sort((a, b) => a.title.localeCompare(b.title))) out += nodeBlock(n);
  }
  const f = `02-graph-${g}.md`;
  fs.writeFileSync(path.join(OUT, f), out);
  sliceFiles.push([f, out]);
}

// --- 3. the flows ------------------------------------------------------------
let fl = `# Decision flows\n\n${flows.length} flows. Follow the steps in order, one question at a time.\nThe step marked SAFETY GATE must be answered before any pattern is named —\nsee the operating rules.\n\n`;
for (const f of flows) {
  fl += `\n---\n\n## ${f.title}\n\`${f.id}\`${f.mirror ? ` · mirror of \`${f.mirror}\`` : ''}\n\n${f.blurb}\n\n`;
  fl += `**Use when someone says things like:** ${f.entry_signals.map((s) => `"${s}"`).join(', ')}\n\n`;
  for (const s of f.steps) {
    fl += `### ${s.id}${s.safety_gate ? '  — SAFETY GATE' : ''}${s.kind === 'stop' ? '  — EXIT, do not continue the flow' : ''}\n`;
    if (s.title) fl += `**${s.title}**\n\n`;
    if (s.ask) fl += `Ask: ${s.ask}\n`;
    if (s.ask_a) fl += `Ask: ${s.ask_a}\nThen ask: ${s.ask_b}\n`;
    if (s.say) fl += `${s.say}\n`;
    if (s.help) fl += `\n> ${s.help.replace(/\n/g, '\n> ')}\n`;
    if (s.help_a) fl += `\n> ${s.help_a}\n> ${s.help_b}\n`;
    for (const b of s.branches ?? []) fl += `- if ${b.when} → ${b.goto}\n`;
    for (const o of s.options ?? []) fl += `- "${o.label}"${o.names ? ` → names: ${o.names}` : ''} → ${o.goto}\n`;
    if (s.goto) fl += `- continue → ${s.goto}\n`;
    if (s.cites?.length) fl += `\nGraph: ${s.cites.join(' · ')}\n`;
    fl += '\n';
  }
}
fs.writeFileSync(path.join(OUT, '03-flows.md'), fl);

// --- 4. how to use it --------------------------------------------------------
const est = (t) => Math.round(t.split(/\s+/).length * 1.35 / 1000);
const idxTok = est(idx), flTok = est(fl), rulesTok = est(fs.readFileSync('_meta/operating-rules.md', 'utf8'));
const sliceRows = sliceFiles.sort().map(([f, t]) => `   - \`${f}\` — ~${est(t)}k tokens`).join('\n');

fs.writeFileSync(path.join(OUT, 'README.md'),
`# Bundle

Generated by \`npm run bundle\`. Compiled from the repo — never edit these directly.

The graph is now ~${est(kg)}k tokens, which is more than is worth pasting at the head of
every conversation and mostly irrelevant to any single question. So there are two
ways to load it.

## Always load (~${rulesTok + idxTok + flTok}k tokens)

1. \`01-operating-rules.md\` — binding constraints. Read first, every time.
2. \`00-index.md\` — all ${concepts.length} nodes, one line each, with the slice each lives in.
3. \`03-flows.md\` — ${flows.length} decision flows, ${flows.reduce((n,f)=>n+f.steps.length,0)} steps.

That is enough to run a conversation: the index carries the whole vocabulary and
the exact titles the flows cite, so you can tell what is relevant before spending
context on it.

## Load on demand

When the index points somewhere, pull the slice that holds it:

${sliceRows}

Or \`02-graph.md\` (~${est(kg)}k tokens) for the entire graph in one file, which is what a
Claude Project's knowledge base wants — there the retrieval happens for you and
the split is unnecessary.

## A note on what this is

An index into Heidi Priebe's work, not a replacement for it. Every claim carries
the video and timestamp it came from; send people to the source. Do not use it to
tell anyone what their attachment style is, and never type an absent partner.
`);

const words = (s) => s.split(/\s+/).length;
console.log(`bundle → ${OUT}/`);
console.log(`  graph  ${concepts.length} concepts · ~${Math.round(words(kg)/1000)}k words`);
console.log(`  flows  ${flows.length} flows · ${flows.reduce((n,f)=>n+f.steps.length,0)} steps · ~${Math.round(words(fl)/1000)}k words`);
console.log(`  total  ~${Math.round((words(kg)+words(fl))*1.35/1000)}k tokens`);
