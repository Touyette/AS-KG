// Enforces _meta/schema.md. Exits non-zero on any error.
import { loadNotes, buildIndex } from './lib/notes.mjs';
import { NODE_TYPES, STYLES, LENS_VALUES, ATTRIBUTION, ACTORS, ACTOR_TYPES, PREDICATES, accepts } from './schema.mjs';

const notes = loadNotes('content');
const index = buildIndex(notes);
const errors = [];
const warnings = [];
const at = (n, msg) => `${n.path}: ${msg}`;

for (const c of index.collisions) {
  errors.push(`name collision on "${c.key}": ${c.a} and ${c.b}`);
}

const typed = notes.filter((n) => n.type !== null);
for (const n of typed) {
  if (!NODE_TYPES.includes(n.type)) errors.push(at(n, `unknown type "${n.type}"`));
  if (n.data.attribution && !ATTRIBUTION.includes(n.data.attribution)) {
    errors.push(at(n, `unknown attribution "${n.data.attribution}"`));
  }
  const actor = n.data.actor ?? 'self';
  if (!ACTORS.includes(actor)) errors.push(at(n, `unknown actor "${actor}"`));
  if (actor !== 'self' && !ACTOR_TYPES.includes(n.type)) {
    errors.push(at(n, `type "${n.type}" cannot carry actor "${actor}"`));
  }
  for (const [style, value] of Object.entries(n.data.lens ?? {})) {
    if (!STYLES.includes(style)) errors.push(at(n, `unknown style in lens: "${style}"`));
    if (!LENS_VALUES.includes(value)) errors.push(at(n, `unknown lens value "${value}"`));
  }
  for (const s of n.data.styles ?? []) {
    if (!STYLES.includes(s)) errors.push(at(n, `unknown style "${s}"`));
  }
}

const seen = new Set();
for (const n of notes) {
  for (const r of n.rels) {
    const spec = PREDICATES[r.predicate];
    if (!spec) { errors.push(at(n, `unknown predicate "${r.predicate}"`)); continue; }
    const target = index.resolve(r.target);
    if (!target) { errors.push(at(n, `unresolved target [[${r.target}]]`)); continue; }
    if (n.type && !accepts(spec.domain, n.type)) {
      errors.push(at(n, `${r.predicate} not allowed from type "${n.type}"`));
    }
    if (target.type && !accepts(spec.range, target.type)) {
      errors.push(at(n, `${r.predicate} → ${target.path} (type "${target.type}") violates range`));
    }
    const key = `${n.path}|${r.predicate}|${target.path}`;
    if (seen.has(key)) warnings.push(at(n, `duplicate edge ${r.predicate} → ${target.path}`));
    seen.add(key);
    if (spec.symmetric) {
      const back = target.rels.some(
        (b) => b.predicate === r.predicate && index.resolve(b.target)?.path === n.path,
      );
      if (!back) warnings.push(at(n, `${r.predicate} → ${target.path} has no reciprocal (auto-added at build)`));
    }
  }
}

// --- graph health --------------------------------------------------------
// Editorial signals, not schema violations: a node can be perfectly valid and
// still be doing no work. Orphans are the useful one — a definition nobody
// connected to anything — and they stay invisible until you happen to notice a
// dot floating on its own in the graph.
const drawn = new Map();
const bump = (id) => drawn.set(id, (drawn.get(id) ?? 0) + 1);
const cited = new Set();
const requires = new Map();

for (const n of notes) {
  for (const r of n.rels) {
    const t = index.resolve(r.target);
    if (!t) continue;
    if (r.predicate === 'described_in') { cited.add(t.path); continue; }
    if (t.type === 'video' || n.type === 'video') continue;
    bump(n.path); bump(t.path);
    if (r.predicate === 'requires') {
      if (!requires.has(n.path)) requires.set(n.path, []);
      requires.get(n.path).push(t.path);
    }
  }
}

const concepts = typed.filter((n) => n.type !== 'video');
const videos = typed.filter((n) => n.type === 'video');
const orphans = concepts.filter((n) => !drawn.has(n.path));
// A source with one citation and a trigger pointing at one state are the correct
// shape for those types, not under-wired notes. Only the rest count as thin.
const thin = concepts.filter((n) => drawn.get(n.path) === 1 && n.type !== 'source' && n.type !== 'trigger');
const unmined = videos.filter((n) => !cited.has(n.path) && n.data.status !== 'no-captions');
for (const n of orphans) warnings.push(at(n, 'orphan — cited but wired to nothing. Connect it or drop it.'));

// A prerequisite loop in the healing layer is a genuine defect: it describes a
// practice nobody can ever start.
const done = new Set(), stack = new Set();
const walk = (id, path) => {
  if (stack.has(id)) { errors.push(`requires cycle: ${[...path, id].join(' -> ')}`); return; }
  if (done.has(id)) return;
  done.add(id); stack.add(id);
  for (const nx of requires.get(id) ?? []) walk(nx, [...path, id]);
  stack.delete(id);
};
for (const id of requires.keys()) walk(id, []);

const counts = {};
for (const n of typed) counts[n.type] = (counts[n.type] ?? 0) + 1;
console.log(`${notes.length} notes · ${seen.size} edges`);
console.log(`health · ${orphans.length} orphan · ${thin.length} thin (single edge) · ${unmined.length}/${videos.length} videos not yet mined`);
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t}:${c}`).join('  '));
for (const w of warnings) console.log(`  warn  ${w}`);
for (const e of errors) console.error(`  ERROR ${e}`);
console.log(errors.length ? `\n${errors.length} error(s)` : '\nvalid');
if (process.env.LIST_THIN) { console.log('\n--- THIN ---'); for (const n of thin) console.log(n.path); }

if (process.env.LIST_UNMINED) {
  console.log('\n--- UNMINED ---');
  for (const n of unmined) console.log(`${n.path}\t${n.data.duration ?? '?'}\t${n.data.title ?? n.title}`);
}

process.exit(errors.length ? 1 : 0);
