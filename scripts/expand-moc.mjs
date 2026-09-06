// Expands <!-- auto:… --> markers in the MOCs at build time, so the style entry
// pages stay in step with the graph instead of being hand-maintained lists.
// Runs on the build copy; the source keeps its markers as the template.
import fs from 'node:fs';
import path from 'node:path';
import { loadNotes } from './lib/notes.mjs';
import { loadFlows } from './flows.mjs';

const dir = process.argv[2] ?? 'content';
const notes = loadNotes(dir);
const flows = loadFlows('flows');
const inLens = (n, s) => n.data.lens && n.data.lens[s] && n.data.lens[s] !== 'absent';
const link = (n) => `- [[${n.path}|${n.title}]]`;

// The corpus outgrew a flat alphabetical list: at 500+ nodes a section like
// "Practices" ran to 76 bare links, which is an index, not an entry point. So
// sections are ranked by how load-bearing a node actually is — the same weight
// the graph uses — the leading few carry their opening line, and the tail stays
// reachable behind a disclosure rather than being cut.
const LEAD = 12;

const byPath = new Map(notes.map((n) => [n.path, n]));
const byTitle = new Map(notes.map((n) => [n.title.toLowerCase(), n]));
for (const n of notes) for (const a of n.data.aliases ?? []) {
  const k = String(a).toLowerCase();
  if (!byTitle.has(k)) byTitle.set(k, n);
}
const resolve = (t) => byPath.get(t.split('|')[0].trim()) ?? byTitle.get(t.split('|')[0].trim().toLowerCase());

const degree = new Map(), cites = new Map();
const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
for (const n of notes) {
  for (const r of n.rels) {
    const t = resolve(r.target);
    if (!t) continue;
    if (r.predicate === 'described_in') { bump(cites, n.path); continue; }
    bump(degree, n.path); bump(degree, t.path);
  }
}
const weight = (n) => (cites.get(n.path) ?? 0) * 2 + (degree.get(n.path) ?? 0);

// First sentence of the note, used as the one-line gloss on lead entries.
const gloss = (n) => {
  const body = n.body.split(/^## /m)[0].replace(/<!--[\s\S]*?-->/g, '').trim();
  const first = body.split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();
  if (!first) return '';
  const m = first.match(/^(.{40,220}?[.!?])(\s|$)/);
  let out = m ? m[1] : first.slice(0, 200).replace(/\s\S*$/, '') + '…';
  return out;
};

const marked = (n) => (n.data.marker === true ? ' ·  sign of change' : '');

// Rank, gloss the leaders, fold the rest away. Nothing is dropped.
const section = (list, noun) => {
  if (!list.length) return '_Nothing here yet._';
  const ranked = [...list].sort((a, b) => weight(b) - weight(a) || a.title.localeCompare(b.title));
  if (ranked.length <= LEAD) return ranked.map((n) => `- [[${n.path}|${n.title}]]${marked(n)}`).join('\n');
  const lead = ranked.slice(0, LEAD).map((n) => {
    const g = gloss(n);
    return `- [[${n.path}|${n.title}]]${marked(n)}${g ? ` — ${g}` : ''}`;
  }).join('\n');
  const tail = ranked.slice(LEAD).sort((a, b) => a.title.localeCompare(b.title))
    .map((n) => `- [[${n.path}|${n.title}]]${marked(n)}`).join('\n');
  return `${lead}\n\n<details>\n<summary>The other ${ranked.length - LEAD} ${noun}</summary>\n\n${tail}\n\n</details>`;
};

const expand = (marker, attrs) => {
  const { style, type } = attrs;
  if (marker === 'nodes') {
    const list = notes.filter((n) => n.type === type && inLens(n, style));
    return section(list, `${type === 'belief' ? 'belief' : type}s`);
  }
  if (marker === 'videos') {
    const list = notes.filter((n) => n.type === 'video' && (n.data.styles ?? []).includes(style))
      .sort((a, b) => (b.data.duration ?? 0) - (a.data.duration ?? 0));
    return list.length ? list.map(link).join('\n') : '_Nothing here yet._';
  }
  if (marker === 'mirrors') {
    const out = [];
    for (const n of notes) {
      if (!inLens(n, style)) continue;
      for (const r of n.rels.filter((r) => r.predicate === 'mirrors')) {
        const t = notes.find((x) => x.title.toLowerCase() === r.target.toLowerCase());
        if (t && !inLens(t, style)) out.push(`- [[${n.path}|${n.title}]] ↔ [[${t.path}|${t.title}]]`);
      }
    }
    const uniq = [...new Set(out)];
    if (!uniq.length) return '_Nothing here yet._';
    if (uniq.length <= LEAD) return uniq.join('\n');
    return `${uniq.slice(0, LEAD).join('\n')}\n\n<details>\n<summary>The other ${uniq.length - LEAD} pairs</summary>\n\n${uniq.slice(LEAD).join('\n')}\n\n</details>`;
  }
  if (marker === 'flows') {
    const list = flows.filter((f) => (f.lens ?? []).includes(style));
    return list.length
      ? list.map((f) => `- [**${f.title}**](/toolbox/#${f.id}) — ${f.blurb}`).join('\n')
      : '_Nothing here yet._';
  }
  return null;
};

let changed = 0;
for (const n of notes) {
  const next = n.body.replace(/<!--\s*auto:(\w+)([^>]*?)-->/g, (whole, marker, rest) => {
    const attrs = Object.fromEntries([...rest.matchAll(/(\w+)=([\w-]+)/g)].map((m) => [m[1], m[2]]));
    const out = expand(marker, attrs);
    return out === null ? whole : out;
  });
  if (next !== n.body) {
    const fm = fs.readFileSync(n.file, 'utf8').split(/\n---\n/)[0];
    fs.writeFileSync(n.file, `${fm}\n---\n${next}`);
    changed++;
  }
}
console.log(`expanded markers in ${changed} pages`);
