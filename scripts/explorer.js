/* The typed-graph explorer.
 *
 * Two things drive the same view. A person clicks outward from one node; an
 * assistant hands over a set of nodes in the URL and the page draws exactly
 * those. There is no server and no socket: the link *is* the transport, which is
 * what lets this work on a static host and with any assistant that can type.
 *
 * Two visual channels, deliberately separate. Colour is the attachment style a
 * node belongs to. Shape is the kind of node it is. A reader can therefore scan
 * for "the anxious side of this" and "which of these are practices" at the same
 * time without the two questions fighting for the same encoding.
 *
 * The whole graph is never drawn. 600-odd nodes at once is a hairball nobody can
 * read; a node plus its neighbourhood is a picture with a claim in it.
 */
'use strict';

const DATA = '__BASE__/static/typed-graph-data.json';
const SITE = '__BASE__';                 // both rewritten at build time from baseUrl

/* Colour = attachment style. */
const STYLE_COLOR = {
  'anxious-preoccupied': '#e8a33d',   // C
  'dismissive-avoidant': '#4a86e8',   // A
  'fearful-avoidant': '#e0524f',
  'secure': '#49b06d',
};
const STYLE_LABEL = {
  'anxious-preoccupied': 'Anxious',
  'dismissive-avoidant': 'Dismissive-avoidant',
  'fearful-avoidant': 'Fearful-avoidant',
  'secure': 'Secure',
};
const STYLE_ORDER = ['anxious-preoccupied', 'dismissive-avoidant', 'fearful-avoidant', 'secure'];
const ACROSS = '#8b8f9e';     // belongs to more than one style — not style-specific
const OFFSTAGE = '#6f7482';   // videos, sources, the style pages themselves
const CORE = new Set(['core', 'secure-form']);

/* Shape = kind of node. */
const SHAPE_LABEL = {
  trigger: 'trigger', state: 'state', strategy: 'strategy', behavior: 'behaviour',
  belief: 'belief', origin: 'origin', style: 'style', concept: 'concept',
  practice: 'practice', video: 'video', source: 'source',
};

const GROUP_COLOR = {
  activation: '#c9922f', defense: '#c2557a', identity: '#5878c2',
  healing: '#4f9a5c', provenance: '#8b8b96',
};
const GROUP_LABEL = {
  activation: 'what fires what', defense: 'how it is built', identity: 'how it compares',
  healing: 'what changes it', provenance: 'where it came from',
};
const GROUP_ORDER = ['activation', 'defense', 'identity', 'healing', 'provenance'];

const MAX_RING1 = 30;
const MAX_RING2 = 60;
const OVERVIEW_N = 46;
const STAGGER = [0.40, 0.58, 0.48, 0.67, 0.44, 0.62];
const CHAR_W = 6.4;

const $ = (s) => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (n, a = {}) => {
  const e = document.createElementNS(NS, n);
  for (const [k, v] of Object.entries(a)) if (v !== '' && v != null) e.setAttribute(k, v);
  return e;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const titled = (el, text) => { const t = svgEl('title'); t.textContent = text; el.appendChild(t); return el; };

let G = null;
let byId = new Map();
let byLoose = new Map();
const out = new Map(), inc = new Map();
const weight = new Map();

const state = {
  focus: [], reading: null, mode: 'explore', depth: 1, why: '',
  styles: new Set(STYLE_ORDER), groups: new Set(GROUP_ORDER),
  trace: null, expand: false,
};
let view = { x: 0, y: 0, k: 1 };
let dragged = false;

/* ------------------------------------------------------------- style & shape */

const lensOf = (n) => n.lens || null;
const coreStyles = (n) => {
  const l = lensOf(n);
  if (!l) return [];
  return STYLE_ORDER.filter((s) => CORE.has(l[s]));
};
const allStyles = () => state.styles.size === STYLE_ORDER.length;

/* A node is visible when it belongs to at least one of the selected styles.
 * Videos, sources and the style pages carry no lens and are structural, so they
 * stay — except a style page itself, which follows its own style. */
function styleOK(n) {
  if (allStyles()) return true;
  if (n.type === 'style') return state.styles.has(n.slug);
  const l = lensOf(n);
  if (!l) return true;
  return [...state.styles].some((s) => l[s] && l[s] !== 'absent');
}

const RANK = { core: 4, 'secure-form': 4, alternating: 3, secondary: 2, feared: 1 };

/* Fill and outline for a node. With all four styles on, colour says which style
 * a node belongs to and grey says "more than one, so not style-specific". With a
 * filter on, colour says how strongly it belongs to what you selected. */
function paint(n) {
  const l = lensOf(n);
  if (!l) return { fill: OFFSTAGE, stroke: null };

  if (!allStyles()) {
    let best = null, bestRank = 0;
    for (const s of state.styles) {
      const r = RANK[l[s]] ?? 0;
      if (r > bestRank) { bestRank = r; best = s; }
    }
    if (!best) return { fill: OFFSTAGE, stroke: null };
    const c = STYLE_COLOR[best];
    if (bestRank === 4) return { fill: c, stroke: null };
    if (bestRank === 1) return { fill: 'none', stroke: c };   // feared: present as a threat
    return { fill: c, stroke: null, soft: true };             // alternating / secondary
  }

  const cs = coreStyles(n);
  if (cs.length === 1) return { fill: STYLE_COLOR[cs[0]], stroke: null };
  if (cs.length > 1) return { fill: ACROSS, stroke: null };
  return { fill: OFFSTAGE, stroke: null };
}

const poly = (sides, r, rot = -Math.PI / 2) => {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * 2 * Math.PI) / sides;
    pts.push(`${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(' ');
};
const star = (points, r, inner) => {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const rr = i % 2 ? inner : r;
    pts.push(`${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)}`);
  }
  return pts.join(' ');
};

function glyph(type, r) {
  switch (type) {
    case 'belief':   return svgEl('polygon', { points: poly(4, r * 1.05, -Math.PI / 4) });
    case 'state':    return svgEl('polygon', { points: poly(4, r * 1.2) });
    case 'strategy': return svgEl('polygon', { points: poly(3, r * 1.25) });
    case 'behavior': return svgEl('polygon', { points: poly(3, r * 1.25, Math.PI / 2) });
    case 'origin':   return svgEl('polygon', { points: poly(5, r * 1.14) });
    case 'practice': return svgEl('polygon', { points: poly(6, r * 1.1) });
    case 'trigger':  return svgEl('polygon', { points: star(4, r * 1.42, r * 0.56) });
    case 'video':    return svgEl('rect', { x: -r * 1.28, y: -r * 0.66, width: r * 2.56, height: r * 1.32, rx: r * 0.32 });
    case 'source':   return svgEl('polygon', { points: [
      `${-r*0.36},${-r*1.1} ${r*0.36},${-r*1.1} ${r*0.36},${-r*0.36} ${r*1.1},${-r*0.36}`,
      `${r*1.1},${r*0.36} ${r*0.36},${r*0.36} ${r*0.36},${r*1.1} ${-r*0.36},${r*1.1}`,
      `${-r*0.36},${r*0.36} ${-r*1.1},${r*0.36} ${-r*1.1},${-r*0.36} ${-r*0.36},${-r*0.36}`,
    ].join(' ') });
    case 'style':    return svgEl('circle', { r: r * 1.08 });
    default:         return svgEl('circle', { r });
  }
}

/* ---------------------------------------------------------------- url state */

function resolve(s) {
  if (!s) return null;
  if (byId.has(s)) return s;
  return byLoose.get(s.toLowerCase().replace(/^\//, '')) ?? null;
}

function readHash() {
  const p = new URLSearchParams(location.hash.replace(/^#/, ''));
  state.focus = (p.get('focus') || '').split(',').map((s) => resolve(s.trim())).filter(Boolean);
  state.focus = [...new Set(state.focus)];
  state.reading = resolve((p.get('read') || '').trim()) || null;
  state.mode = p.get('mode') === 'discussion' ? 'discussion' : 'explore';
  state.depth = ['0', '1', '2'].includes(p.get('depth')) ? Number(p.get('depth')) : 1;
  state.why = (p.get('why') || '').slice(0, 300);

  // `style` takes a list; `lens` is the older single-style spelling and still works
  const st = p.get('style'), lens = p.get('lens');
  if (st) {
    const picked = st.split(',').map((s) => s.trim()).filter((s) => STYLE_ORDER.includes(s));
    state.styles = new Set(picked.length ? picked : STYLE_ORDER);
  } else if (lens && STYLE_ORDER.includes(lens)) {
    state.styles = new Set([lens]);
  } else {
    state.styles = new Set(STYLE_ORDER);
  }

  const g = p.get('rel');
  state.groups = g ? new Set(g.split(',').filter((x) => GROUP_ORDER.includes(x))) : new Set(GROUP_ORDER);
  if (!state.groups.size) state.groups = new Set(GROUP_ORDER);

  const t = (p.get('trace') || '').split('>').map((s) => resolve(s.trim()));
  state.trace = t.length === 2 && t.every(Boolean) ? t : null;
  state.expand = p.get('all') === '1';
}

function writeHash(push) {
  const p = new URLSearchParams();
  if (state.focus.length) p.set('focus', state.focus.join(','));
  if (state.reading && state.reading !== state.focus[0]) p.set('read', state.reading);
  if (state.mode !== 'explore') p.set('mode', state.mode);
  if (state.depth !== 1) p.set('depth', String(state.depth));
  if (state.why) p.set('why', state.why);
  if (!allStyles()) p.set('style', [...state.styles].join(','));
  if (state.groups.size !== GROUP_ORDER.length) p.set('rel', [...state.groups].join(','));
  if (state.trace) p.set('trace', state.trace.join('>'));
  if (state.expand) p.set('all', '1');
  const h = '#' + p.toString();
  if (h === location.hash) return;
  if (push) history.pushState(null, '', h); else history.replaceState(null, '', h);
}

/* ------------------------------------------------------------------ helpers */

const edgeOK = (e) =>
  state.groups.has(e.group) && styleOK(byId.get(e.source)) && styleOK(byId.get(e.target));

function neighbours(id) {
  const seen = new Map();
  for (const e of out.get(id) ?? []) if (edgeOK(e)) seen.set(e.target, e);
  for (const e of inc.get(id) ?? []) if (edgeOK(e) && !seen.has(e.source)) seen.set(e.source, e);
  seen.delete(id);
  return seen;
}

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

function select() {
  const level = new Map();
  const via = new Map();
  let folded = 0;

  if (state.trace) {
    const chain = shortestPath(state.trace[0], state.trace[1]);
    if (chain) return { kind: 'trace', chain, level: new Map(chain.map((c, i) => [c.id, i])), via, folded: 0 };
  }

  if (!state.focus.length) {
    const top = [...byId.values()].filter(styleOK)
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
    const R0 = Math.max(84, (l0.length * 74) / (2 * Math.PI));
    l0.forEach((id, i) => {
      const a = ((i + 0.5) / l0.length) * 2 * Math.PI - Math.PI / 2;
      pos.set(id, { x: Math.cos(a) * R0, y: Math.sin(a) * R0, a });
    });
  }

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

const isCentral = (sel, id) =>
  (sel.level.get(id) === 0 && sel.kind === 'ego') || sel.kind === 'trace';
const radius = (n, lvl) =>
  (lvl === 0 ? 5 : 0) + 7 + Math.min(8, Math.sqrt(n.citations || 0) * 2.5) + Math.min(4, n.degree * 0.12);

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
      'stroke-width': e.group === 'provenance' ? 1 : 1.4,
      'stroke-opacity': e.group === 'provenance' ? 0.26 : 0.46,
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

  const picking = state.mode === 'discussion' && sel.kind === 'ego';
  for (const [id, p] of pos) {
    const n = byId.get(id);
    const lvl = sel.level.get(id);
    const r = radius(n, lvl);
    const cls = ['node'];
    if (lvl === 0) cls.push('focus');
    if (state.focus.length > 1 && lvl === 0) cls.push('picked');
    if (picking) cls.push(lvl === 0 ? 'picked' : 'dim');
    const g = svgEl('g', { class: cls.join(' '), transform: `translate(${p.x},${p.y})` });
    g.dataset.id = id;

    g.appendChild(svgEl('circle', { r: r + 9, fill: 'transparent' }));   // hit area
    if (n.marker) {
      g.appendChild(svgEl('circle', {
        r: r + 4.5, fill: 'none', stroke: paint(n).fill === 'none' ? ACROSS : paint(n).fill,
        'stroke-opacity': 0.4, 'stroke-width': 1.1, 'stroke-dasharray': '2 2.5',
      }));
    }
    const { fill, stroke, soft } = paint(n);
    const sh = glyph(n.type, r);
    sh.setAttribute('class', 'glyph');
    sh.setAttribute('fill', fill === 'none' ? 'none' : fill);
    if (fill !== 'none' && soft) sh.setAttribute('fill-opacity', lvl === 2 ? 0.34 : 0.5);
    else if (fill !== 'none') sh.setAttribute('fill-opacity', lvl === 2 ? 0.62 : 1);
    if (stroke) { sh.setAttribute('stroke', stroke); sh.setAttribute('stroke-width', 2); }
    if (n.type === 'style') {                       // a ring, not a disc
      sh.setAttribute('fill', 'none');
      sh.setAttribute('stroke', fill === 'none' ? ACROSS : fill);
      sh.setAttribute('stroke-width', 3.4);
    }
    g.appendChild(sh);

    const label = svgEl('text');
    label.textContent = n.title.length > 34 ? n.title.slice(0, 33) + '…' : n.title;
    if (isCentral(sel, id)) {
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('y', r + 16);
    } else {
      const deg = (p.a * 180) / Math.PI;
      const flip = Math.cos(p.a) < 0;
      label.setAttribute('text-anchor', flip ? 'end' : 'start');
      label.setAttribute('transform',
        `rotate(${deg}) translate(${flip ? -(r + 8) : r + 8},0) rotate(${flip ? 180 : 0})`);
      label.setAttribute('dy', '0.34em');
    }
    g.appendChild(label);
    titled(g, `${n.title} — ${SHAPE_LABEL[n.type] ?? n.type}${n.gloss ? '\n' + n.gloss : ''}`);
    gNodes.appendChild(g);

    g.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (dragged) return;
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return togglePick(id);
      // With a set on screen — usually one an assistant pushed — a plain click
      // reads the node and leaves the set alone. Losing five nodes to a stray
      // click costs more than the extra step of re-centring deliberately.
      if (state.focus.length > 1) readNode(id);
      else focusOn(id);
    });
    g.addEventListener('dblclick', (ev) => {
      ev.stopPropagation();
      if (!dragged) focusOn(id);
    });
    g.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openMenu(ev.clientX, ev.clientY, id);
    });
    g.addEventListener('mouseenter', () => setHot(id));
    g.addEventListener('mouseleave', () => setHot(null));
  }

  fit(pos, svg);
  paintHint(sel, drawn);
  paintLegend(sel);
  const l = $('#loading');
  if (l) l.style.display = 'none';
}

function fit(pos, svg) {
  const box = svg.getBoundingClientRect();
  let minX = -60, maxX = 60, minY = -60, maxY = 60;
  const grow = (x, y) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  };
  const sel = { level: new Map(), kind: '' };
  for (const [id, p] of pos) {
    grow(p.x, p.y);
    const n = byId.get(id);
    const chars = Math.min(34, (n?.title ?? '').length);
    const reach = 20 + chars * CHAR_W;
    grow(p.x + Math.cos(p.a) * reach, p.y + Math.sin(p.a) * reach);
    grow(p.x - Math.cos(p.a) * 24, p.y - Math.sin(p.a) * 24);
  }
  const pad = 40;
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
  // Hover highlights the graph and nothing else. It used to rewrite the side
  // panel, which meant the panel described whatever the cursor last passed over
  // rather than what you had selected — so "Read the note" could open the wrong
  // note. The node's own tooltip carries the title and the opening line.
}

function paintHint(sel, drawn) {
  const bits = [];
  if (sel.kind === 'trace') bits.push(`shortest path · ${sel.chain.length} nodes`);
  else if (sel.kind === 'overview') bits.push(`the ${drawn.size} most-cited nodes · click one to open it`);
  else bits.push(`${drawn.size} of ${G.counts.nodes} nodes`);
  if (state.focus.length > 1) bits.push(`<b>${state.focus.length} selected</b>`);
  let html = `<span>${bits.join(' · ')}</span>`;
  if (state.focus.length > 1) html += '<button class="btn" id="clearpick">Clear selection</button>';
  if (sel.folded) html += `<button class="btn" id="expand">Show ${sel.folded} more</button>`;
  else if (state.expand) html += '<button class="btn" id="expand">Fold back</button>';
  if (state.trace) html += '<button class="btn" id="untrace">Clear the trace</button>';
  if (state.focus.length <= 1) html += '<span style="opacity:.75">⌘/ctrl-click to add a node</span>';
  $('#hint').innerHTML = html;
  const ex = $('#expand');
  if (ex) ex.onclick = () => { state.expand = !state.expand; writeHash(false); render(); };
  const un = $('#untrace');
  if (un) un.onclick = () => { state.trace = null; writeHash(true); render(); };
  const cp = $('#clearpick');
  if (cp) cp.onclick = () => { state.focus = state.focus.slice(0, 1); state.reading = state.focus[0]; writeHash(true); render(); showPanel(); };
}

function miniGlyph(type, colour) {
  const s = svgEl('svg', { width: 16, height: 16, viewBox: '-9 -9 18 18' });
  const g = glyph(type, 6);
  g.setAttribute('fill', colour);
  if (type === 'style') { g.setAttribute('fill', 'none'); g.setAttribute('stroke', colour); g.setAttribute('stroke-width', 2.4); }
  s.appendChild(g);
  return s.outerHTML;
}

function paintLegend(sel) {
  const types = [...new Set([...sel.level.keys()].map((id) => byId.get(id).type))]
    .sort((a, b) => (SHAPE_LABEL[a] ?? a).localeCompare(SHAPE_LABEL[b] ?? b));
  const shapes = types.map((t) =>
    `<span class="row">${miniGlyph(t, 'currentColor')}${SHAPE_LABEL[t] ?? t}</span>`).join('');
  const colours = STYLE_ORDER
    .filter((s) => state.styles.has(s))
    .map((s) => `<span class="row"><i class="dot" style="background:${STYLE_COLOR[s]}"></i>${STYLE_LABEL[s]}</span>`)
    .join('') + `<span class="row"><i class="dot" style="background:${ACROSS}"></i>across styles</span>`;
  let shut = false;
  try { shut = localStorage.getItem('askg-legend') === 'off'; } catch { /* private mode */ }
  const el = $('#legend');
  el.classList.toggle('closed', shut);
  el.innerHTML =
    `<button class="fold" id="legendfold">${shut ? '▸' : '▾'} legend</button>` +
    `<div class="cols">` +
      `<div class="col"><h3>shape = kind</h3>${shapes}</div>` +
      `<div class="col"><h3>colour = style</h3>${colours}</div>` +
    `</div>`;
  $('#legendfold').addEventListener('click', () => {
    const off = !el.classList.contains('closed');
    el.classList.toggle('closed', off);
    $('#legendfold').textContent = (off ? '▸' : '▾') + ' legend';
    try { localStorage.setItem('askg-legend', off ? 'off' : 'on'); } catch { /* ignore */ }
  });
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

function styleTags(n) {
  const l = lensOf(n);
  if (!l) return '';
  return STYLE_ORDER.filter((s) => l[s] && l[s] !== 'absent')
    .map((s) => `<span class="tag style" style="background:${STYLE_COLOR[s]}">${STYLE_LABEL[s]}</span>`)
    .join('');
}

/* Two jobs, two pieces of state. `state.focus` is the selection — what is drawn,
 * what the link carries, what an assistant pushes. `state.reading` is whose
 * content is in the panel. Changing one never clears the other, which is the
 * whole point: a pushed set is exactly when you most want to read its nodes. */

function detailHTML(id) {
  const n = byId.get(id);
  if (!n) return '';
  const l = lensOf(n);
  const lens = l ? STYLE_ORDER.filter((s) => l[s] && l[s] !== 'absent') : [];
  return `
    <h3>${esc(n.title)}</h3>
    <div class="meta">
      <span class="tag">${miniGlyph(n.type, 'currentColor')} ${esc(SHAPE_LABEL[n.type] ?? n.type)}</span>
      ${n.attribution ? `<span class="tag">${esc(n.attribution)}</span>` : ''}
      ${n.actor !== 'self' ? `<span class="tag">${esc(n.actor)}</span>` : ''}
      ${n.marker ? '<span class="tag">sign of change</span>' : ''}
      <span class="tag">${n.citations} video${n.citations === 1 ? '' : 's'}</span>
    </div>
    <div id="notebody">${n.gloss ? `<p class="gloss">${esc(n.gloss)}</p>` : ''}</div>
    <div class="acts">
      <button class="btn" data-more="${esc(id)}">Read the rest</button>
      ${state.focus.includes(id) ? '' : `<button class="btn" data-add="${esc(id)}">Add to selection</button>`}
      ${state.focus.length === 1 && state.focus[0] !== id ? `<button class="btn" data-trace="${esc(id)}">Trace from the focus</button>` : ''}
      <a class="btn" data-router-ignore href="${esc(SITE + n.url)}">Full page ↗</a>
    </div>
    ${lens.length ? `<h2>Through each style</h2><div class="lensrow">${lens.map((s) =>
      `<i class="dot" style="background:${STYLE_COLOR[s]}"></i><span>${STYLE_LABEL[s]}</span><span class="v">${l[s]}</span>`).join('')}</div>` : ''}
    <h2>Relationships</h2>
    ${relBlocks(id)}
  `;
}

function stripHTML() {
  const items = state.focus.map((id) => {
    const n = byId.get(id);
    const { fill } = paint(n);
    return `<li class="${id === state.reading ? 'on' : ''}">
      <button class="pick" data-pick="${esc(id)}" title="Read this one">
        <i class="dot" style="background:${fill === 'none' ? ACROSS : fill}"></i>
        <span>${esc(n.title)}</span>
      </button>
      <button class="drop" data-drop="${esc(id)}" title="Remove from the selection">✕</button>
    </li>`;
  }).join('');
  return `
    <div class="strip">
      <div class="striphead">
        <b>${state.focus.length} selected</b>
        <span class="spacer"></span>
        <button class="lnk" id="selcopy">Copy link</button>
        <button class="lnk" id="selclear">Clear</button>
      </div>
      <ul class="multi">${items}</ul>
      <p class="hint">Click one to read it · ⌘/ctrl-click the graph to add · right-click for more</p>
    </div>`;
}

function showPanel() {
  if (!state.focus.length && !state.reading) return;
  if (!state.reading || !byId.has(state.reading)) state.reading = state.focus[0] ?? null;
  if (!state.reading) return;
  $('#detail').innerHTML =
    (state.focus.length > 1 ? stripHTML() : '') + detailHTML(state.reading);
  wirePanel();
}

/* Read a node without touching the selection. */
function readNode(id) {
  if (!byId.has(id)) return;
  state.reading = id;
  report('read', id);
  writeHash(false);
  render();
  showPanel();
}

function wirePanel() {
  const d = $('#detail');
  d.querySelectorAll('[data-pick]').forEach((b) =>
    b.addEventListener('click', () => readNode(b.dataset.pick)));
  d.querySelectorAll('[data-drop]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.drop;
      if (state.focus.length <= 1) return;
      state.focus = state.focus.filter((x) => x !== id);
      if (state.reading === id) state.reading = state.focus[0];
      report('deselected', id);
      writeHash(true); render(); showPanel();
    }));
  const clr = d.querySelector('#selclear');
  if (clr) clr.onclick = () => {
    const keep = state.focus.includes(state.reading) ? state.reading : state.focus[0];
    state.focus = [keep];
    state.reading = keep;
    writeHash(true); render(); showPanel();
  };
  const cpy = d.querySelector('#selcopy');
  if (cpy) cpy.onclick = () => copyLink(cpy);

  d.querySelectorAll('[data-go]').forEach((a) =>
    a.addEventListener('click', () => focusOn(a.dataset.go)));
  const more = d.querySelector('[data-more]');
  if (more) more.addEventListener('click', () => expandNote(more.dataset.more, more));
  const add = d.querySelector('[data-add]');
  if (add) add.addEventListener('click', () => togglePick(add.dataset.add));
  const tr = d.querySelector('[data-trace]');
  if (tr) tr.addEventListener('click', () => {
    state.trace = [state.focus[0], tr.dataset.trace];
    writeHash(true); render();
  });
}

/* ------------------------------------------------------------------ the note */

/* The gloss is built from the first ~165 characters of the note, so the panel is
 * already showing the beginning of the prose. "Read the rest" fetches the page
 * and swaps in the whole thing — nothing is fetched until someone asks, and
 * there is no second panel that can drift out of step with the graph. */
async function expandNote(id, btn) {
  const n = byId.get(id);
  if (!n) return;
  const host = $('#notebody');
  if (!host) return;
  report('read', id);
  btn.disabled = true;
  btn.textContent = 'Loading…';
  try {
    // GitHub Pages resolves /foo to foo.html; not every static host does, so
    // fall back rather than showing an error for a note that is plainly there.
    let res = await fetch(SITE + n.url);
    if (!res.ok) res = await fetch(SITE + n.url + '.html');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const art = doc.querySelector('article') || doc.querySelector('.popover-hint') || doc.querySelector('main');
    if (!art) throw new Error('no article in the page');
    art.querySelectorAll('script,style,noscript').forEach((e) => e.remove());

    // drop the Relationships section — the panel below shows it in a better form
    const h = [...art.querySelectorAll('h1,h2,h3')].find((x) => /^relationships$/i.test(x.textContent.trim()));
    if (h) { let cur = h; while (cur) { const next = cur.nextSibling; cur.remove(); cur = next; } }
    // and the title, which is already the panel heading
    const t = art.querySelector('h1');
    if (t && t.textContent.trim() === n.title) t.remove();

    art.className = 'note';
    host.innerHTML = '';
    host.appendChild(art);
    btn.remove();

    // internal links move the graph instead of leaving the page
    host.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href || /^(https?:)?\/\//.test(href) || href.startsWith('#')) {
        if (/^https?:/.test(href || '')) { a.target = '_blank'; a.rel = 'noopener'; }
        return;
      }
      let path;
      try {
        path = new URL(href, location.origin + SITE + '/x/').pathname
          .replace(new RegExp('^' + SITE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/'), '')
          .replace(/\.html$/, '').replace(/^\//, '');
      } catch { return; }
      const target = resolve(path);
      if (target) {
        a.href = 'javascript:void 0';
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          if (state.focus.length > 1) readNode(target); else focusOn(target);
        });
      } else {
        a.href = SITE + '/' + path;
        a.setAttribute('data-router-ignore', '');
      }
    });
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Read the rest';
    host.insertAdjacentHTML('beforeend',
      `<p class="empty-note">Could not load the note here (${esc(err.message)}). ` +
      `<a data-router-ignore href="${esc(SITE + n.url)}">Open the full page ↗</a></p>`);
  }
}

/* ------------------------------------------------------- the right-click menu */

let menuFor = null;

function openMenu(x, y, id) {
  const n = byId.get(id);
  if (!n) return;
  menuFor = id;
  const picked = state.focus.includes(id);
  const m = $('#menu');
  m.innerHTML = `
    <div class="who">${esc(n.title)}</div>
    <button data-m="read">Read the note</button>
    <button data-m="pick">${picked ? 'Remove from selection' : 'Add to selection'}</button>
    <button data-m="centre">Centre the graph here</button>
    <div class="sep"></div>
    <a data-router-ignore target="_blank" rel="noopener" href="${esc(SITE + n.url)}">Open the full page ↗</a>`;
  m.hidden = false;
  // keep it on screen when the click lands near an edge
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
  m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  m.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
    const what = b.dataset.m;
    closeMenu();
    if (what === 'read') readNode(id);
    else if (what === 'pick') togglePick(id);
    else focusOn(id);
  }));
  m.querySelector('a').addEventListener('click', closeMenu);
}

function closeMenu() {
  menuFor = null;
  const m = $('#menu');
  if (m) m.hidden = true;
}

/* ------------------------------------------------------------------ actions */

function focusOn(id) {
  if (!byId.has(id)) return;
  report('opened', id);
  state.focus = [id];
  state.trace = null;
  state.expand = false;
  if (state.mode === 'discussion') { state.mode = 'explore'; state.why = ''; }
  state.reading = id;
  writeHash(true);
  paintChrome();
  render();
  showPanel();
}

function togglePick(id) {
  if (!byId.has(id)) return;
  const i = state.focus.indexOf(id);
  report(i >= 0 ? 'deselected' : 'selected', id);
  if (i >= 0) {
    if (state.focus.length === 1) return;
    state.focus.splice(i, 1);
    if (state.reading === id) state.reading = state.focus[0];
  } else {
    state.focus.push(id);
    state.reading = id;          // you added it to look at it
  }
  state.trace = null;
  if (state.mode === 'discussion') { state.mode = 'explore'; state.why = ''; }
  writeHash(true);
  paintChrome();
  render();
  showPanel();
}

async function copyLink(btn) {
  const label = btn.textContent;
  try { await navigator.clipboard.writeText(location.href); btn.textContent = 'Copied'; }
  catch { btn.textContent = 'Copy failed'; }
  setTimeout(() => { btn.textContent = label; }, 1400);
}

/* ------------------------------------------------------------------- chrome */

function paintChrome() {
  const showWhy = state.mode === 'discussion' && state.why;
  $('#why').hidden = !showWhy;
  $('#whytext').textContent = state.why;
  $('#depth').value = String(state.depth);
  document.querySelectorAll('#styles .chip').forEach((c) =>
    c.setAttribute('aria-pressed', String(state.styles.has(c.dataset.s))));
  document.querySelectorAll('#groups .chip').forEach((c) =>
    c.setAttribute('aria-pressed', String(state.groups.has(c.dataset.g))));
}

function buildControls() {
  $('#styles').innerHTML = STYLE_ORDER.map((s) =>
    `<button class="chip" data-s="${s}" title="${STYLE_LABEL[s]}"><i class="dot" style="background:${STYLE_COLOR[s]}"></i>${STYLE_LABEL[s]}</button>`).join('');
  document.querySelectorAll('#styles .chip').forEach((c) => c.addEventListener('click', () => {
    const s = c.dataset.s;
    if (state.styles.has(s)) state.styles.delete(s); else state.styles.add(s);
    if (!state.styles.size) state.styles = new Set(STYLE_ORDER);
    writeHash(false); paintChrome(); render();
  }));

  $('#groups').innerHTML = GROUP_ORDER.map((g) =>
    `<button class="chip" data-g="${g}" title="${GROUP_LABEL[g]}"><i class="dot" style="background:${GROUP_COLOR[g]}"></i>${g}</button>`).join('');
  document.querySelectorAll('#groups .chip').forEach((c) => c.addEventListener('click', () => {
    const g = c.dataset.g;
    if (state.groups.has(g)) state.groups.delete(g); else state.groups.add(g);
    if (!state.groups.size) state.groups = new Set(GROUP_ORDER);
    writeHash(false); paintChrome(); render();
  }));

  $('#depth').addEventListener('change', (e) => { state.depth = Number(e.target.value); writeHash(false); render(); });

  $('#cycles').innerHTML = G.cycles.map((c) => {
    const styles = new Set();
    for (const id of c.nodes) for (const s of coreStyles(byId.get(id) ?? {})) styles.add(s);
    const sw = STYLE_ORDER.filter((s) => styles.has(s))
      .map((s) => `<i class="dot" style="background:${STYLE_COLOR[s]}" title="${STYLE_LABEL[s]}"></i>`).join('');
    const names = c.nodes.map((id) => esc(byId.get(id) ? byId.get(id).title : id)).join(' → ');
    return `<li><button data-cycle="${c.id}">${sw ? `<span class="sw">${sw}</span>` : ''}${names} → ↺<span class="n"> · ${c.length} steps</span></button></li>`;
  }).join('') || '<li><span class="n">No loops under the current filters.</span></li>';
  document.querySelectorAll('#cycles button').forEach((b) => b.addEventListener('click', () => {
    const c = G.cycles.find((x) => x.id === b.dataset.cycle);
    report('loop', c.id, c.nodes.map((id) => byId.get(id)?.title).join(' → '));
    state.focus = c.nodes.slice();
    state.depth = 0;
    state.trace = null;
    state.mode = 'explore'; state.why = '';
    writeHash(true); paintChrome(); render();
    $('#detail').innerHTML =
      `<h3>A loop</h3><p class="gloss">${c.nodes.map((id) => esc(byId.get(id).title)).join(' → ')} → back to the start.</p>
       <p class="empty-note">Each one fires the next, and the last returns to the first — which is why the pattern keeps itself running. Click any node in it to open that node's own neighbourhood.</p>`;
  }));

  $('#leavewhy').addEventListener('click', () => {
    state.mode = 'explore'; state.why = '';
    writeHash(true); paintChrome(); render();
  });

  $('#copy').addEventListener('click', () => copyLink($('#copy')));

  // Both rails fold, because on a laptop the graph is the part worth the pixels.
  const rail = $('#railtoggle');
  const setRail = (off) => {
    document.querySelector('main').classList.toggle('norail', off);
    rail.classList.toggle('on', !off);
    try { localStorage.setItem('askg-rail', off ? 'off' : 'on'); } catch { /* private mode */ }
    render();
  };
  let railOff = false;
  try { railOff = localStorage.getItem('askg-rail') === 'off'; } catch { /* ignore */ }
  setRail(railOff);
  rail.addEventListener('click', () => setRail(!document.querySelector('main').classList.contains('norail')));


  try {
    const saved = localStorage.getItem('askg-theme');
    if (saved) document.documentElement.dataset.theme = saved;
  } catch { /* private mode — the system theme still applies */ }
  $('#theme').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme === 'dark' ||
      (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('askg-theme', next); } catch { /* ignore */ }
    render();
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
    res.innerHTML = hits.slice(0, 40).map(({ n }) => {
      const { fill } = paint(n);
      return `<li data-id="${esc(n.id)}">${miniGlyph(n.type, fill === 'none' ? ACROSS : fill)} ${esc(n.title)}<span class="t">${esc(SHAPE_LABEL[n.type] ?? n.type)}</span></li>`;
    }).join('') || '<li><span class="t">Nothing matches.</span></li>';
    res.querySelectorAll('li[data-id]').forEach((li) =>
      li.addEventListener('click', (ev) => {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey) togglePick(li.dataset.id);
        else { focusOn(li.dataset.id); q.value = ''; res.innerHTML = ''; }
      }));
  };
  q.addEventListener('input', run);
  q.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = res.querySelector('li[data-id]');
    if (first) { report('searched', null, q.value.trim()); focusOn(first.dataset.id); q.value = ''; res.innerHTML = ''; }
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

  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  addEventListener('pointerdown', (e) => { if (menuFor && !e.target.closest('#menu')) closeMenu(); }, true);
  addEventListener('scroll', closeMenu, true);
  addEventListener('contextmenu', (e) => { if (!e.target.closest('.node')) closeMenu(); });

  let t = null;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(render, 180); });
  const onHash = () => {
    readHash();
    paintChrome();
    render();
    showPanel();
  };
  addEventListener('hashchange', onHash);
  addEventListener('popstate', onHash);
}

/* ------------------------------------------------------- the companion window
 *
 * When this page is served by tools/companion.mjs, an assistant working through
 * a situation with someone can push a set of nodes into the window, and the
 * window reports back what the person opened. The window is for the person — a
 * way past the assistant's own sentences and into the material — so a push
 * changes what is drawn but never closes what they are reading.
 *
 * On the hosted site the endpoint is absent: the probe fails once and nothing
 * else here ever runs.
 */
let companion = false;

async function connectCompanion() {
  if (!/^https?:$/.test(location.protocol)) return;
  try {
    const r = await fetch('/companion/ping', { signal: AbortSignal.timeout(900) });
    if (!r.ok) return;
  } catch { return; }

  companion = true;
  const pill = document.createElement('span');
  pill.id = 'live';
  pill.title = 'An assistant can put nodes in this window';
  pill.textContent = 'live';
  document.querySelector('header .spacer').before(pill);

  const es = new EventSource('/companion/events');
  es.addEventListener('show', (ev) => {
    let p;
    try { p = JSON.parse(ev.data); } catch { return; }
    const ids = [...new Set((p.nodes || []).map(resolve).filter(Boolean))];
    if (!ids.length) return;
    state.focus = ids;
    state.why = String(p.why || '').slice(0, 300);
    state.mode = state.why ? 'discussion' : 'explore';
    state.depth = [0, 1, 2].includes(p.depth) ? p.depth : 1;
    state.trace = null;
    state.expand = false;
    writeHash(false);
    paintChrome();
    render();
    // If what they are reading is still in the new set, leave them on it — being
    // moved mid-paragraph because the assistant spoke is the opposite of the point.
    if (!state.focus.includes(state.reading)) state.reading = state.focus[0];
    showPanel();
  });
}

const report = (kind, node, text) => {
  if (!companion) return;
  fetch('/companion/activity', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, node: node ?? null, text: text ?? null }),
  }).catch(() => { /* the window still works if the assistant has gone */ });
};

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
  window.__askgReady = true;
  connectCompanion();
  if (state.focus.length) showPanel();
  else {
    $('#detail').innerHTML =
      '<p class="empty-note">Search for something, or click any node.<br><br>' +
      'Colour is the attachment style a node belongs to; shape is the kind of node. ' +
      'This view opens on one idea and its neighbourhood — it never draws all ' +
      G.counts.nodes + ' at once, because that picture says nothing.<br><br>' +
      'Hold ⌘ or ctrl while clicking to select several.</p>';
  }
}).catch((err) => {
  const l = $('#loading');
  if (l) l.textContent = 'Could not load the graph data. ' + err;
});
