/* The typed-graph explorer.
 *
 * Two things drive the same view. In explore mode a person clicks outward from
 * one node. In discussion mode an agent hands over a focus set in the URL and
 * the page draws exactly that. There is no server and no socket: the link *is*
 * the transport, which is what lets this work on a static host and with any
 * assistant that can type a URL.
 *
 * The whole graph is never drawn. 590 nodes at once is a hairball nobody can
 * read; a node plus its neighbourhood is a picture with a claim in it.
 */
'use strict';

const DATA = '__BASE__/static/typed-graph-data.json';
const SITE = '__BASE__';                 // both are rewritten at build time from baseUrl

const TYPE_COLOR = {
  trigger: '#f2643e', state: '#eda72c', strategy: '#e04f86', behavior: '#c56ad9',
  belief: '#5b83e8', origin: '#3c5fa8', style: '#7a5cf0',
  concept: '#2bb0a3', practice: '#5bb84f',
  video: '#8b8b96', source: '#6f7480',
};
const GROUP_COLOR = {
  activation: '#eda72c', defense: '#e04f86', identity: '#5b83e8',
  healing: '#5bb84f', provenance: '#8b8b96',
};
const GROUP_LABEL = {
  activation: 'what fires what', defense: 'how it is built', identity: 'how it compares',
  healing: 'what changes it', provenance: 'where it came from',
};
const GROUP_ORDER = ['activation', 'defense', 'identity', 'healing', 'provenance'];

const MAX_RING1 = 30;   // neighbours drawn around the focus before folding
const MAX_RING2 = 60;   // second-hop budget
const OVERVIEW_N = 46;
// Fractions along a spoke at which to drop its predicate label, cycled so
// neighbouring spokes never place theirs at the same radius.
const STAGGER = [0.40, 0.58, 0.48, 0.67, 0.44, 0.62];
const CHAR_W = 6.4;   // rough advance width of the label font, for bounds

const $ = (s) => document.querySelector(s);
const svgEl = (n, a = {}) => {
  const e = document.createElementNS('http://www.w3.org/2000/svg', n);
  for (const [k, v] of Object.entries(a)) if (v !== '') e.setAttribute(k, v);
  return e;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const titled = (el, text) => { const t = svgEl('title'); t.textContent = text; el.appendChild(t); return el; };

let G = null;                 // the loaded graph
let byId = new Map();
const out = new Map(), inc = new Map();
const weight = new Map();

const state = {
  focus: [], mode: 'explore', depth: 1, why: '', lens: '',
  groups: new Set(GROUP_ORDER), trace: null, expand: false,
};
let view = { x: 0, y: 0, k: 1 };
let dragged = false;   // set while panning, so a drag never re-centres the graph

/* ---------------------------------------------------------------- url state */

function readHash() {
  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  const ids = (p.get('focus') || '').split(',').map((s) => s.trim()).filter(Boolean);
  state.focus = ids.map(resolve).filter(Boolean);
  state.mode = p.get('mode') === 'discussion' ? 'discussion' : 'explore';
  state.depth = ['0', '1', '2'].includes(p.get('depth')) ? Number(p.get('depth')) : 1;
  state.why = (p.get('why') || '').slice(0, 300);
  state.lens = G.styles.includes(p.get('lens')) ? p.get('lens') : '';
  const g = p.get('rel');
  state.groups = g ? new Set(g.split(',').filter((x) => GROUP_ORDER.includes(x))) : new Set(GROUP_ORDER);
  if (!state.groups.size) state.groups = new Set(GROUP_ORDER);
  const t = (p.get('trace') || '').split('>').map((s) => resolve(s.trim()));
  state.trace = t.length === 2 && t.every(Boolean) ? t : null;
  state.expand = p.get('all') === '1';
}

/* An agent writing a link should not have to know our folder names, so a focus
 * id resolves by full path, by slug, or by title. */
let byLoose = new Map();
function resolve(s) {
  if (!s) return null;
  if (byId.has(s)) return s;
  return byLoose.get(s.toLowerCase().replace(/^\//, '')) ?? null;
}

function writeHash(push) {
  const p = new URLSearchParams();
  if (state.focus.length) p.set('focus', state.focus.join(','));
  if (state.mode !== 'explore') p.set('mode', state.mode);
  if (state.depth !== 1) p.set('depth', String(state.depth));
  if (state.why) p.set('why', state.why);
  if (state.lens) p.set('lens', state.lens);
  if (state.groups.size !== GROUP_ORDER.length) p.set('rel', [...state.groups].join(','));
  if (state.trace) p.set('trace', state.trace.join('>'));
  if (state.expand) p.set('all', '1');
  const h = '#' + p.toString();
  if (h === location.hash) return;
  if (push) history.pushState(null, '', h); else history.replaceState(null, '', h);
}

/* ------------------------------------------------------------------ helpers */

const lensOK = (n) => {
  if (!state.lens) return true;
  if (!n.lens) return true;                 // videos, sources and styles carry no lens
  return n.lens[state.lens] && n.lens[state.lens] !== 'absent';
};
const edgeOK = (e) =>
  state.groups.has(e.group) && lensOK(byId.get(e.source)) && lensOK(byId.get(e.target));

function neighbours(id) {
  const seen = new Map();
  for (const e of out.get(id) ?? []) if (edgeOK(e)) seen.set(e.target, e);
  for (const e of inc.get(id) ?? []) if (edgeOK(e) && !seen.has(e.source)) seen.set(e.source, e);
  seen.delete(id);
  return seen;                              // neighbour id -> the edge that reached it
}

/* Shortest path, undirected over the filtered graph. Direction is kept on each
 * hop so the drawn chain still shows which way the arrow points. */
function shortestPath(a, b) {
  if (a === b) return null;
  const prev = new Map([[a, null]]);
  let frontier = [a];
  while (frontier.length) {
    const next = [];
    for (const id of frontier) {
      for (const [nb, e] of neighbours(id)) {
        if (prev.has(nb)) continue;
        prev.set(nb, { from: id, edge: e });
        if (nb === b) {
          const chain = [];
          let cur = b;
          while (prev.get(cur)) { chain.unshift({ id: cur, ...prev.get(cur) }); cur = prev.get(cur).from; }
          return [{ id: a, from: null, edge: null }, ...chain];
        }
        next.push(nb);
      }
    }
    frontier = next;
  }
  return null;
}

/* --------------------------------------------------------------- node select */

/* The drawn set: one ring per hop, capped, plus a count of what was folded
 * away — so the page says so rather than quietly showing you less. */
function select() {
  const level = new Map();
  const via = new Map();
  let folded = 0;

  if (state.trace) {
    const chain = shortestPath(state.trace[0], state.trace[1]);
    if (chain) return { kind: 'trace', chain, level: new Map(chain.map((c, i) => [c.id, i])), via, folded: 0 };
  }

  if (!state.focus.length) {                            // overview: the hubs
    const top = [...byId.values()].filter(lensOK)
      .sort((a, b) => weight.get(b.id) - weight.get(a.id)).slice(0, OVERVIEW_N);
    for (const n of top) level.set(n.id, 1);
    return { kind: 'overview', level, via, folded: 0 };
  }

  for (const id of state.focus) level.set(id, 0);
  if (state.depth === 0) return { kind: 'ego', level, via, folded: 0 };

  const cap1 = state.expand ? Infinity : MAX_RING1;
  const ring1 = new Map();
  for (const id of state.focus) {
    for (const [nb, e] of neighbours(id)) {
      if (level.has(nb) || ring1.has(nb)) continue;
      ring1.set(nb, e);
    }
  }
  const r1 = [...ring1.keys()].sort((a, b) => weight.get(b) - weight.get(a));
  const keep1 = r1.slice(0, cap1);
  folded += r1.length - keep1.length;
  for (const id of keep1) { level.set(id, 1); via.set(id, ring1.get(id)); }

  if (state.depth >= 2) {
    const cap2 = state.expand ? Infinity : MAX_RING2;
    const ring2 = new Map();
    for (const id of keep1) {
      const nbs = [...neighbours(id)].filter(([nb]) => !level.has(nb))
        .sort((a, b) => weight.get(b[0]) - weight.get(a[0])).slice(0, 4);
      for (const [nb, e] of nbs) if (!ring2.has(nb)) ring2.set(nb, { edge: e, parent: id });
    }
    const r2 = [...ring2.keys()].sort((a, b) => weight.get(b) - weight.get(a));
    const keep2 = r2.slice(0, cap2);
    folded += r2.length - keep2.length;
    for (const id of keep2) {
      level.set(id, 2);
      via.set(id, ring2.get(id).edge);
      via.set(id + '|parent', ring2.get(id).parent);
    }
  }
  return { kind: 'ego', level, via, folded };
}

/* -------------------------------------------------------------------- layout */

function place(sel) {
  const pos = new Map();
  const ids = [...sel.level.keys()];

  if (sel.kind === 'trace') {
    const gap = 215;
    const x0 = -((sel.chain.length - 1) * gap) / 2;
    sel.chain.forEach((c, i) => pos.set(c.id, { x: x0 + i * gap, y: i % 2 ? 36 : -36, a: 0 }));
    return pos;
  }

  if (sel.kind === 'overview') {
    const ring = ids.slice().sort((a, b) => {
      const ta = byId.get(a).type, tb = byId.get(b).type;
      return ta === tb ? weight.get(b) - weight.get(a) : ta.localeCompare(tb);
    });
    const R = Math.max(255, (ring.length * 40) / (2 * Math.PI));
    ring.forEach((id, i) => {
      const a = ((i + 0.5) / ring.length) * 2 * Math.PI - Math.PI / 2;
      pos.set(id, { x: Math.cos(a) * R, y: Math.sin(a) * R, a });
    });
    return pos;
  }

  const l0 = ids.filter((id) => sel.level.get(id) === 0);
  if (l0.length === 1) {
    pos.set(l0[0], { x: 0, y: 0, a: 0 });
  } else {
    const R0 = Math.max(78, (l0.length * 68) / (2 * Math.PI));
    l0.forEach((id, i) => {
      const a = ((i + 0.5) / l0.length) * 2 * Math.PI - Math.PI / 2;
      pos.set(id, { x: Math.cos(a) * R0, y: Math.sin(a) * R0, a });
    });
  }

  // Ring one clusters by the kind of relationship that reached each node, so
  // "what fires this" and "what heals this" sit in different parts of the dial.
  const l1 = ids.filter((id) => sel.level.get(id) === 1);
  const ordered = GROUP_ORDER.flatMap((g) =>
    l1.filter((id) => (sel.via.get(id)?.group ?? 'identity') === g)
      .sort((a, b) => weight.get(b) - weight.get(a)));
  const R1 = Math.max(240, (ordered.length * 44) / (2 * Math.PI));
  ordered.forEach((id, i) => {
    const a = ((i + 0.5) / Math.max(1, ordered.length)) * 2 * Math.PI - Math.PI / 2;
    pos.set(id, { x: Math.cos(a) * R1, y: Math.sin(a) * R1, a });
  });

  const l2 = ids.filter((id) => sel.level.get(id) === 2);
  if (l2.length) {
    const R2 = Math.max(R1 + 210, (l2.length * 40) / (2 * Math.PI));
    const angleOf = (id) => pos.get(sel.via.get(id + '|parent'))?.a ?? 0;
    const sorted = l2.slice().sort((a, b) => angleOf(a) - angleOf(b));
    sorted.forEach((id, i) => {
      const a = ((i + 0.5) / sorted.length) * 2 * Math.PI - Math.PI / 2;
      pos.set(id, { x: Math.cos(a) * R2, y: Math.sin(a) * R2, a });
    });
  }
  return pos;
}

// Focus nodes and trace steps get their label underneath; everything on a ring
// gets a radial one.
const isCentral = (sel, id) =>
  (sel.level.get(id) === 0 && sel.kind === 'ego') || sel.kind === 'trace';

const radius = (n, lvl) =>
  (lvl === 0 ? 6 : 0) + 7 + Math.min(9, Math.sqrt(n.citations || 0) * 2.7) + Math.min(4, n.degree * 0.13);

/* -------------------------------------------------------------------- render */

let gRoot = null;

function render() {
  const svg = $('#svg');
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const sel = select();
  const pos = place(sel);
  const drawn = new Set(pos.keys());

  const defs = svgEl('defs');
  for (const [g, c] of Object.entries(GROUP_COLOR)) {
    const m = svgEl('marker', {
      id: 'arw-' + g, viewBox: '0 0 10 10', refX: '10', refY: '5',
      markerWidth: '5.5', markerHeight: '5.5', orient: 'auto-start-reverse',
    });
    m.appendChild(svgEl('path', { d: 'M0,1 L10,5 L0,9 z', fill: c }));
    defs.appendChild(m);
  }
  svg.appendChild(defs);

  gRoot = svgEl('g');
  const gEdges = svgEl('g'), gLabels = svgEl('g'), gNodes = svgEl('g');
  gRoot.appendChild(gEdges); gRoot.appendChild(gLabels); gRoot.appendChild(gNodes);
  svg.appendChild(gRoot);

  const edges = G.edges.filter((e) =>
    drawn.has(e.source) && drawn.has(e.target) && edgeOK(e) && !e.derived && e.source !== e.target);
  const spokes = new Set(edges.filter((e) => sel.level.get(e.source) === 0 || sel.level.get(e.target) === 0));
  const labelled = sel.kind === 'trace' ? new Set(edges) : (spokes.size <= 26 ? spokes : new Set());

  const seenPair = new Map();
  let labelIndex = 0;
  for (const e of edges) {
    const a = pos.get(e.source), b = pos.get(e.target);
    const key = [e.source, e.target].sort().join('|');
    const n = seenPair.get(key) ?? 0;
    seenPair.set(key, n + 1);
    const sameRing = sel.level.get(e.source) === sel.level.get(e.target) && sel.kind !== 'trace';
    const bow = (sameRing ? 0.7 : 1) - n * 0.1;
    const mx = ((a.x + b.x) / 2) * bow, my = ((a.y + b.y) / 2) * bow;
    const straight = !sameRing && n === 0;
    const p = svgEl('path', {
      d: straight ? `M${a.x},${a.y} L${b.x},${b.y}` : `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`,
      class: 'edge', fill: 'none', stroke: GROUP_COLOR[e.group],
      'stroke-width': e.group === 'provenance' ? 1 : 1.5,
      'stroke-opacity': e.group === 'provenance' ? 0.3 : 0.55,
      'marker-end': G.predicates[e.predicate].symmetric ? '' : `url(#arw-${e.group})`,
    });
    p.dataset.a = e.source; p.dataset.b = e.target;
    titled(p, `${byId.get(e.source).title} — ${e.predicate} → ${byId.get(e.target).title}`);
    gEdges.appendChild(p);

    if (labelled.has(e)) {
      const t0 = STAGGER[labelIndex++ % STAGGER.length];
      const lx = a.x + (b.x - a.x) * t0, ly = a.y + (b.y - a.y) * t0;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const flip = Math.cos(ang) < 0;
      const t = svgEl('text', { class: 'elabel', 'text-anchor': 'middle', fill: GROUP_COLOR[e.group] });
      t.setAttribute('transform',
        `translate(${lx},${ly}) rotate(${(ang * 180) / Math.PI + (flip ? 180 : 0)}) translate(0,-4)`);
      t.textContent = e.predicate;
      gLabels.appendChild(t);
    }
  }

  for (const [id, p] of pos) {
    const n = byId.get(id);
    const lvl = sel.level.get(id);
    const r = radius(n, lvl);
    const picked = state.mode === 'discussion' && sel.kind === 'ego';
    const g = svgEl('g', {
      class: 'node' + (lvl === 0 ? ' focus' : '') +
        (picked ? (lvl === 0 ? ' pick' : ' dim') : ''),
      transform: `translate(${p.x},${p.y})`,
    });
    g.dataset.id = id;
    if (n.marker) {
      g.appendChild(svgEl('circle', {
        r: r + 3.5, fill: 'none', stroke: TYPE_COLOR[n.type] ?? '#888',
        'stroke-opacity': 0.45, 'stroke-width': 1.2,
      }));
    }
    // A transparent disc a little larger than the dot: small nodes are hard to
    // hit otherwise, and the label itself takes no pointer events.
    g.appendChild(svgEl('circle', { r: r + 9, fill: 'transparent' }));
    g.appendChild(svgEl('circle', {
      r, fill: TYPE_COLOR[n.type] ?? '#888', 'fill-opacity': lvl === 2 ? 0.62 : 1,
    }));

    const label = svgEl('text');
    label.textContent = n.title.length > 34 ? n.title.slice(0, 33) + '…' : n.title;
    const central = isCentral(sel, id);
    if (central) {
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('y', r + 15);
    } else {
      // Radial labels read outward along the spoke, so a crowded ring never
      // collides with itself however many nodes are on it.
      const deg = (p.a * 180) / Math.PI;
      const flip = Math.cos(p.a) < 0;
      label.setAttribute('text-anchor', flip ? 'end' : 'start');
      label.setAttribute('transform',
        `rotate(${deg}) translate(${flip ? -(r + 7) : r + 7},0) rotate(${flip ? 180 : 0})`);
      label.setAttribute('dy', '0.34em');
    }
    g.appendChild(label);
    titled(g, n.gloss || n.title);
    gNodes.appendChild(g);

    g.addEventListener('click', (ev) => { ev.stopPropagation(); if (!dragged) focusOn(id); });
    g.addEventListener('mouseenter', () => setHot(id));
    g.addEventListener('mouseleave', () => setHot(null));
  }

  fit(pos, svg, sel);
  paintHint(sel, drawn);
  paintLegend(sel);
  const l = $('#loading');
  if (l) l.style.display = 'none';
}

function fit(pos, svg, sel) {
  const box = svg.getBoundingClientRect();
  let minX = -60, maxX = 60, minY = -60, maxY = 60;
  const grow = (x, y) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  };
  for (const [id, p] of pos) {
    grow(p.x, p.y);
    const n = byId.get(id);
    const chars = Math.min(34, (n?.title ?? '').length);
    const reach = radius(n, sel.level.get(id)) + 9 + chars * CHAR_W;
    if (isCentral(sel, id)) { grow(p.x - reach / 2, p.y - 22); grow(p.x + reach / 2, p.y + 26); }
    else grow(p.x + Math.cos(p.a) * reach, p.y + Math.sin(p.a) * reach);
  }
  const pad = 34;
  const w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;
  const k = Math.min((box.width || 900) / w, (box.height || 600) / h, 1.35);
  view = {
    k,
    x: (box.width || 900) / 2 - ((minX + maxX) / 2) * k,
    y: (box.height || 600) / 2 - ((minY + maxY) / 2) * k,
  };
  applyView();
}
const applyView = () => {
  if (gRoot) gRoot.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);
};

function setHot(id) {
  const nodes = document.querySelectorAll('.node');
  const edges = document.querySelectorAll('.edge');
  if (!id) {
    nodes.forEach((n) => n.classList.remove('faded', 'hot'));
    edges.forEach((e) => e.classList.remove('faded'));
    return;
  }
  const near = new Set([id]);
  edges.forEach((e) => {
    const on = e.dataset.a === id || e.dataset.b === id;
    e.classList.toggle('faded', !on);
    if (on) { near.add(e.dataset.a); near.add(e.dataset.b); }
  });
  nodes.forEach((n) => {
    n.classList.toggle('faded', !near.has(n.dataset.id));
    n.classList.toggle('hot', n.dataset.id === id);
  });
  showDetail(id, true);
}

function paintHint(sel, drawn) {
  let text;
  if (sel.kind === 'trace') text = `shortest path · ${sel.chain.length} nodes`;
  else if (sel.kind === 'overview') text = `the ${drawn.size} most-cited nodes · search, or click one to open it`;
  else text = `${drawn.size} of ${G.counts.nodes} nodes`;
  let html = `<span>${text}</span>`;
  if (sel.folded) html += `<button class="btn" id="expand">Show ${sel.folded} more</button>`;
  else if (state.expand) html += '<button class="btn" id="expand">Fold back</button>';
  if (state.trace) html += '<button class="btn" id="untrace">Clear the trace</button>';
  $('#hint').innerHTML = html;
  const ex = $('#expand');
  if (ex) ex.onclick = () => { state.expand = !state.expand; writeHash(false); render(); };
  const un = $('#untrace');
  if (un) un.onclick = () => { state.trace = null; writeHash(true); render(); };
}

function paintLegend(sel) {
  const types = [...new Set([...sel.level.keys()].map((id) => byId.get(id).type))].sort();
  $('#legend').innerHTML = types
    .map((t) => `<span><i class="dot" style="background:${TYPE_COLOR[t] ?? '#888'}"></i>${t}</span>`).join('');
}

/* --------------------------------------------------------------------- panels */

function relBlocks(id) {
  const rows = [];
  const add = (pred, dir, other, src) => {
    let r = rows.find((x) => x.pred === pred && x.dir === dir);
    if (!r) { r = { pred, dir, group: G.predicates[pred].group, items: [] }; rows.push(r); }
    r.items.push({ other, src });
  };
  for (const e of out.get(id) ?? []) if (!e.derived) add(e.predicate, 'out', e.target, e.src);
  for (const e of inc.get(id) ?? []) {
    if (e.derived || G.predicates[e.predicate].symmetric) continue;
    add(e.predicate, 'in', e.source, e.src);
  }
  rows.sort((a, b) =>
    GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
    a.pred.localeCompare(b.pred) || a.dir.localeCompare(b.dir));
  return rows.map((r) => {
    const items = r.items.map(({ other, src }) => {
      const n = byId.get(other);
      if (!n) return '';
      const mm = src ? `${Math.floor(src.seconds / 60)}:${String(src.seconds % 60).padStart(2, '0')}` : '';
      const ts = src ? ` <a class="ts" target="_blank" rel="noopener" href="https://youtu.be/${src.videoId}?t=${src.seconds}">${mm}</a>` : '';
      return `<li><a data-go="${esc(other)}">${esc(n.title)}</a>${ts}</li>`;
    }).join('');
    const arrow = r.dir === 'out' ? '' : '<span style="opacity:.5">← </span>';
    return `<div class="rel"><h4 style="color:${GROUP_COLOR[r.group]}">${arrow}${r.pred}</h4><ul>${items}</ul></div>`;
  }).join('');
}

function showDetail(id, preview) {
  const n = byId.get(id);
  if (!n) return;
  const lens = n.lens ? Object.entries(n.lens).filter(([, v]) => v && v !== 'absent') : [];
  $('#detail').innerHTML = `
    <h3>${esc(n.title)}</h3>
    <div class="meta">
      <span class="tag type" style="background:${TYPE_COLOR[n.type] ?? '#888'}">${esc(n.type)}</span>
      ${n.attribution ? `<span class="tag">${esc(n.attribution)}</span>` : ''}
      ${n.actor !== 'self' ? `<span class="tag">${esc(n.actor)}</span>` : ''}
      ${n.marker ? '<span class="tag">sign of change</span>' : ''}
      <span class="tag">${n.citations} video${n.citations === 1 ? '' : 's'}</span>
    </div>
    ${n.gloss ? `<p class="gloss">${esc(n.gloss)}</p>` : ''}
    <div class="acts">
      <a class="btn" href="${SITE}${esc(n.url)}">Open the note ↗</a>
      ${preview ? `<button class="btn" data-go="${esc(id)}">Centre here</button>` : ''}
      ${state.focus.length === 1 && state.focus[0] !== id ? `<button class="btn" data-trace="${esc(id)}">Trace from the focus</button>` : ''}
    </div>
    ${lens.length ? `<h2>Through each lens</h2><div class="lensrow">${lens.map(([k, v]) => `<span>${esc(k)}</span><span>${esc(v)}</span>`).join('')}</div>` : ''}
    <h2>Relationships</h2>
    ${relBlocks(id)}
  `;
  $('#detail').querySelectorAll('[data-go]').forEach((a) =>
    a.addEventListener('click', () => focusOn(a.dataset.go)));
  const tr = $('#detail [data-trace]');
  if (tr) {
    tr.addEventListener('click', () => {
      state.trace = [state.focus[0], tr.dataset.trace];
      writeHash(true);
      render();
    });
  }
}

function focusOn(id) {
  if (!byId.has(id)) return;
  state.focus = [id];
  state.trace = null;
  state.expand = false;
  if (state.mode === 'discussion') { state.mode = 'explore'; state.why = ''; }
  writeHash(true);
  paintChrome();
  render();
  showDetail(id, false);
}

/* ------------------------------------------------------------------- controls */

function paintChrome() {
  document.querySelectorAll('#modes button').forEach((b) =>
    b.setAttribute('aria-selected', String(b.dataset.mode === state.mode)));
  $('#why').hidden = !(state.mode === 'discussion' && state.why);
  $('#whytext').textContent = state.why;
  $('#depth').value = String(state.depth);
  $('#lens').value = state.lens;
  document.querySelectorAll('#groups .chip').forEach((c) =>
    c.setAttribute('aria-pressed', String(state.groups.has(c.dataset.g))));
}

function buildControls() {
  $('#groups').innerHTML = GROUP_ORDER.map((g) =>
    `<button class="chip" data-g="${g}" title="${GROUP_LABEL[g]}"><i class="dot" style="background:${GROUP_COLOR[g]}"></i>${g}</button>`).join('');
  document.querySelectorAll('#groups .chip').forEach((c) => c.addEventListener('click', () => {
    const g = c.dataset.g;
    if (state.groups.has(g)) state.groups.delete(g); else state.groups.add(g);
    if (!state.groups.size) state.groups = new Set(GROUP_ORDER);
    writeHash(false); paintChrome(); render();
  }));

  $('#lens').innerHTML = '<option value="">All four at once</option>' +
    G.styles.map((s) => `<option value="${s}">${s}</option>`).join('');
  $('#lens').addEventListener('change', (e) => { state.lens = e.target.value; writeHash(false); render(); });
  $('#depth').addEventListener('change', (e) => { state.depth = Number(e.target.value); writeHash(false); render(); });

  $('#cycles').innerHTML = G.cycles.map((c) =>
    `<li><button data-cycle="${c.id}">${c.nodes.map((id) => esc(byId.get(id) ? byId.get(id).title : id)).join(' → ')}<span class="n"> · ${c.length} steps</span></button></li>`).join('')
    || '<li><span class="n">No loops under the current filters.</span></li>';
  document.querySelectorAll('#cycles button').forEach((b) => b.addEventListener('click', () => {
    const c = G.cycles.find((x) => x.id === b.dataset.cycle);
    state.focus = c.nodes.slice();
    state.depth = 0;
    state.trace = null;
    writeHash(true); paintChrome(); render();
    $('#detail').innerHTML = `<h3>A loop</h3><p class="gloss">${c.nodes.map((id) => esc(byId.get(id).title)).join(' → ')} → back to the start.</p><p class="empty-note">Click any node in it to open that node's own neighbourhood.</p>`;
  }));

  document.querySelectorAll('#modes button').forEach((b) => b.addEventListener('click', () => {
    state.mode = b.dataset.mode;
    if (state.mode === 'explore') state.why = '';
    writeHash(false); paintChrome(); render();
  }));

  $('#copy').addEventListener('click', async () => {
    const btn = $('#copy');
    try { await navigator.clipboard.writeText(location.href); btn.textContent = 'Copied'; }
    catch { btn.textContent = 'Copy failed'; }
    setTimeout(() => { btn.textContent = 'Copy link'; }, 1400);
  });

  try {
    const saved = localStorage.getItem('askg-theme');
    if (saved) document.documentElement.dataset.theme = saved;
  } catch { /* private mode, or storage blocked — the system theme still applies */ }
  $('#theme').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme === 'dark' ||
      (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('askg-theme', next); } catch { /* ignore */ }
  });

  const q = $('#q'), res = $('#results');
  const run = () => {
    const s = q.value.trim().toLowerCase();
    if (!s) { res.innerHTML = ''; return; }
    const hits = [];
    for (const n of byId.values()) {
      const t = n.title.toLowerCase();
      let score = 0;
      if (t === s) score = 100;
      else if (t.startsWith(s)) score = 60;
      else if (t.includes(s)) score = 40;
      else if (n.aliases.some((a) => a.toLowerCase().includes(s))) score = 30;
      else if ((n.gloss || '').toLowerCase().includes(s)) score = 10;
      if (score) hits.push({ n, score: score + Math.min(12, weight.get(n.id) / 4) });
    }
    hits.sort((a, b) => b.score - a.score);
    res.innerHTML = hits.slice(0, 40).map(({ n }) =>
      `<li data-id="${esc(n.id)}">${esc(n.title)}<span class="t">${esc(n.type)}</span></li>`).join('')
      || '<li><span class="t">Nothing matches.</span></li>';
    res.querySelectorAll('li[data-id]').forEach((li) =>
      li.addEventListener('click', () => { focusOn(li.dataset.id); q.value = ''; res.innerHTML = ''; }));
  };
  q.addEventListener('input', run);
  q.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = res.querySelector('li[data-id]');
    if (first) { focusOn(first.dataset.id); q.value = ''; res.innerHTML = ''; }
  });

  const svg = $('#svg');
  let drag = null;
  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    dragged = false;
    svg.classList.add('drag');
  });
  // On the window, not the svg, and without setPointerCapture: capturing
  // retargets the click that follows to the <svg>, which quietly breaks every
  // node click. Listening on the window keeps a drag alive off-canvas anyway.
  addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true;
    view.x = drag.vx + dx;
    view.y = drag.vy + dy;
    applyView();
  });
  const stop = () => { drag = null; svg.classList.remove('drag'); };
  addEventListener('pointerup', stop);
  addEventListener('pointercancel', stop);
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const box = svg.getBoundingClientRect();
    const mx = e.clientX - box.left, my = e.clientY - box.top;
    const k = Math.max(0.25, Math.min(3.5, view.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    view.x = mx - ((mx - view.x) / view.k) * k;
    view.y = my - ((my - view.y) / view.k) * k;
    view.k = k;
    applyView();
  }, { passive: false });

  let t = null;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(render, 180); });
  const onHash = () => {
    readHash();
    paintChrome();
    render();
    if (state.focus.length === 1) showDetail(state.focus[0], false);
  };
  addEventListener('hashchange', onHash);
  addEventListener('popstate', onHash);
}

/* ---------------------------------------------------------------------- boot */

fetch(DATA).then((r) => r.json()).then((data) => {
  G = data;
  byId = new Map(G.nodes.map((n) => [n.id, n]));
  byLoose = new Map();
  for (const n of G.nodes) {
    byLoose.set(n.id.toLowerCase(), n.id);
    if (!byLoose.has(n.slug.toLowerCase())) byLoose.set(n.slug.toLowerCase(), n.id);
    if (!byLoose.has(n.title.toLowerCase())) byLoose.set(n.title.toLowerCase(), n.id);
  }
  for (const e of G.edges) {
    if (!out.has(e.source)) out.set(e.source, []);
    if (!inc.has(e.target)) inc.set(e.target, []);
    out.get(e.source).push(e);
    inc.get(e.target).push(e);
  }
  for (const n of G.nodes) weight.set(n.id, (n.citations || 0) * 2 + n.degree * 0.25);
  $('#q').placeholder = `Search ${G.counts.nodes} nodes…`;
  readHash();
  buildControls();
  paintChrome();
  render();
  window.__askgReady = true;          // the inline watchdog in the page reads this
  if (state.focus.length === 1) showDetail(state.focus[0], false);
  else {
    $('#detail').innerHTML = '<p class="empty-note">Search for something, or click any node.<br><br>This view opens on one idea and its neighbourhood. It never draws all ' + G.counts.nodes + ' nodes at once, because that picture says nothing.</p>';
  }
}).catch((err) => {
  const l = $('#loading');
  if (l) l.textContent = 'Could not load the graph data. ' + err;
});
