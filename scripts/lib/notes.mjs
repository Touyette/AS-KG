// Zero-dependency reader for the note format described in _meta/schema.md.
import fs from 'node:fs';
import path from 'node:path';

const REL_RE = /^-\s+\*\*([a-z_]+)\*\*\s*(?:→|->)\s*\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]\s*(?:·\s*\[[^\]]*\]\(([^)]+)\))?\s*$/;
const SRC_RE = /(?:youtu\.be\/|v=)([\w-]{11}).*?[?&]t=(\d+)/;

function parseScalar(raw) {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s.startsWith('[') && s.endsWith(']')) {
    return s.slice(1, -1).split(',').map(parseScalar).filter((v) => v !== null);
  }
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return Number(s);
  return s;
}

// Supports scalars, inline arrays and one level of nested mapping (`lens:`).
export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { data: {}, body: text };
  const data = {};
  let parent = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const kv = /^(\s*)([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, indent, key, rest] = kv;
    if (indent.length >= 2 && parent) {
      data[parent][key] = parseScalar(rest);
    } else if (rest.trim() === '') {
      parent = key;
      data[key] = {};
    } else {
      data[key] = parseScalar(rest);
      parent = null;
    }
  }
  return { data, body: text.slice(m[0].length) };
}

// Only the `## Relationships` section is scanned, so example bullets elsewhere
// in a note are never mistaken for edges.
export function parseRelationships(body) {
  const start = body.search(/^##\s+Relationships\s*$/m);
  if (start === -1) return [];
  const section = body.slice(start).split(/\n(?=##\s)/)[0];
  const out = [];
  for (const line of section.split(/\r?\n/)) {
    const m = REL_RE.exec(line.trim());
    if (!m) continue;
    const [, predicate, target, href] = m;
    const s = href && SRC_RE.exec(href);
    out.push({
      predicate,
      target: target.trim(),
      src: s ? { videoId: s[1], seconds: Number(s[2]) } : null,
      raw: line.trim(),
    });
  }
  return out;
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

export function loadNotes(contentDir = 'content') {
  return walk(contentDir).map((file) => {
    const text = fs.readFileSync(file, 'utf8');
    const { data, body } = parseFrontmatter(text);
    const rel = path.relative(contentDir, file).replace(/\\/g, '/');
    return {
      file,
      path: rel.replace(/\.md$/, ''),
      slug: path.basename(file, '.md'),
      title: data.title ?? path.basename(file, '.md'),
      type: data.type ?? null,
      data,
      body,
      rels: parseRelationships(body),
    };
  });
}

const norm = (s) => String(s).trim().toLowerCase();

// Wikilink targets resolve by path, slug, title or alias — all case-insensitive.
export function buildIndex(notes) {
  const index = new Map();
  const collisions = [];
  const add = (key, note) => {
    const k = norm(key);
    if (!k) return;
    const existing = index.get(k);
    if (existing && existing !== note) collisions.push({ key: k, a: existing.path, b: note.path });
    else index.set(k, note);
  };
  for (const n of notes) {
    add(n.path, n);
    add(n.slug, n);
    add(n.title, n);
    for (const a of n.data.aliases ?? []) add(a, n);
  }
  return {
    collisions,
    resolve(target) {
      const t = norm(target);
      return index.get(t) ?? index.get(t.replace(/^.*\//, '')) ?? null;
    },
  };
}
