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

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Which ideas came out of which video. A node belongs to a video when it cites
// it with described_in; it is merely referenced there when some other edge of
// its own carries a timestamp from that tape. The difference matters — one is
// where the idea was introduced — so the page keeps them apart.
const videos = notes.filter((n) => n.type === 'video');
const vById = new Map(videos.filter((n) => n.data.video_id).map((n) => [n.data.video_id, n]));
const cited = new Map(videos.map((n) => [n.path, { intro: new Map(), also: new Map() }]));
const earliest = (m, k, secs) => {
  if (!m.has(k) || secs < m.get(k)) m.set(k, secs);
};
for (const n of notes) {
  if (!n.type || n.type === 'video') continue;
  const introduced = new Set();
  for (const r of n.rels) {
    if (r.predicate !== 'described_in') continue;
    const t = resolve(r.target);
    if (!t || !cited.has(t.path)) continue;
    introduced.add(t.path);
    earliest(cited.get(t.path).intro, n.path, r.src?.seconds ?? Infinity);
  }
  for (const r of n.rels) {
    if (!r.src) continue;
    const v = vById.get(r.src.videoId);
    if (!v || introduced.has(v.path)) continue;
    earliest(cited.get(v.path).also, n.path, r.src.seconds);
  }
}

const entry = (p, secs, videoId, withGloss) => {
  const n = byPath.get(p);
  if (!n) return null;
  const at = Number.isFinite(secs) ? ` · [${mmss(secs)}](https://youtu.be/${videoId}?t=${secs})` : '';
  const g = withGloss ? gloss(n) : '';
  return `- [[${n.path}|${n.title}]] _(${n.type})_${at}${marked(n)}${g ? ` — ${g}` : ''}`;
};

const videoBody = (self) => {
  const id = self.data.video_id;
  const c = cited.get(self.path) ?? { intro: new Map(), also: new Map() };
  const ordered = (m) => [...m.entries()].sort((a, b) => a[1] - b[1]);
  const intro = ordered(c.intro), also = ordered(c.also);
  const out = [];

  if (self.data.status === 'no-captions') {
    return [
      '> [!warning] Nothing was mined from this one',
      '> No transcript could be fetched for this video, so none of its ideas are in',
      '> the graph. It is listed here so the gap is visible rather than silent — the',
      `> pages it should have fed are simply thinner than the rest. [Watch it on`,
      `> YouTube](https://youtu.be/${id}).`,
    ].join('\n');
  }

  const styles = (self.data.styles ?? []).join(', ');
  out.push(
    `**${intro.length} ${intro.length === 1 ? 'idea' : 'ideas'} in the graph come from this video**` +
    (also.length ? `, and ${also.length} more are referenced in it` : '') +
    (styles ? ` · ${styles}` : '') + '.',
  );

  const approx = self.data.timestamps === 'approximate';
  if (approx) {
    out.push('',
      '> [!note] The timestamps here are estimates',
      '> No caption file exists for this video, so the transcript arrived without cue',
      '> times and each timestamp is derived from where the point falls in the text.',
      '> They land close, not exact. Everywhere else in the graph a timestamp is read',
      '> straight off the captions.');
  }
  if (intro.length) {
    out.push('', '## What comes out of this video', '',
      approx
        ? 'In the order she reaches them. The timestamps are estimated, as above.'
        : 'In the order she reaches them. Each timestamp opens the video at the moment the point is made.', '',
      intro.map(([p, secs]) => entry(p, secs, id, true)).filter(Boolean).join('\n'));
  }
  if (also.length) {
    out.push('', '## Also referenced here', '',
      '<details>',
      `<summary>${also.length} ideas introduced elsewhere that this video touches</summary>`,
      '',
      also.map(([p, secs]) => entry(p, secs, id, false)).filter(Boolean).join('\n'),
      '', '</details>');
  }

  const sibs = videos
    .filter((n) => n.path !== self.path && n.data.series && n.data.series === self.data.series)
    .sort((a, b) => a.title.localeCompare(b.title));
  if (sibs.length) {
    out.push('', '## The rest of this set', '',
      'Her material comes in parallel sets across the styles. The others in this one:', '',
      sibs.map((n) => `- [[${n.path}|${n.title}]]`).join('\n'));
  }
  return out.join('\n');
};

const expand = (marker, attrs, self) => {
  if (marker === 'video') return videoBody(self);
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
    const out = expand(marker, attrs, n);
    return out === null ? whole : out;
  });
  if (next !== n.body) {
    const fm = fs.readFileSync(n.file, 'utf8').split(/\n---\n/)[0];
    fs.writeFileSync(n.file, `${fm}\n---\n${next}`);
    changed++;
  }
}
console.log(`expanded markers in ${changed} pages`);
