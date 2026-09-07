const pptx = require('pptxgenjs');
const fs = require('fs');
// Written by scripts/deck/deck-data.mjs — see the README in this folder.
const M = JSON.parse(fs.readFileSync('deck-data.json', 'utf8'));

const p = new pptx();
p.layout = 'LAYOUT_WIDE';                       // 13.333 x 7.5
const W = 13.333, H = 7.5;

/* palette — taken from the graph's own node colours, so the deck and the site
   speak the same visual language */
const INK = '22222A', DARK = '16161C', MUTED = '6A6875', FAINT = '807C8A';
const LINE = 'E5E2E8', TINT = 'F7F5FA', WHITE = 'FFFFFF';
const ACCENT = '7B4BD8';
const T = {
  trigger: 'F2643E', state: 'EDA72C', strategy: 'E04F86', behavior: 'C56AD9',
  belief: '5B83E8', origin: '3C5FA8', style: '7A5CF0',
  concept: '2BB0A3', practice: '5BB84F', video: '8B8B96', source: '6F7480',
};
const HEAD = 'Cambria', BODY = 'Calibri';
const MX = 0.72;                                 // side margin
const CW = W - MX * 2;

const clip = (s, n) => (s && s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : (s || ''));

/* ------------------------------------------------------------------ chrome */
let pageNo = 0;
function slide(dark) {
  const s = p.addSlide();
  s.background = { color: dark ? DARK : WHITE };
  pageNo++;
  // top right: bottom right kept colliding with cards and footnotes
  s.addText(String(pageNo), {
    x: W - MX - 0.5, y: 0.42, w: 0.5, h: 0.26, align: 'right',
    fontSize: 9, color: dark ? '52505C' : FAINT, fontFace: BODY, isTextBox: true, margin: 0,
  });
  return s;
}
function heading(s, kicker, title, opts = {}) {
  const dark = !!opts.dark;
  let y = 0.52;
  if (kicker) {
    s.addText(kicker.toUpperCase(), {
      x: MX, y, w: CW, h: 0.24, fontSize: 10.5, bold: true, charSpacing: 1.6,
      color: dark ? '9E86E8' : ACCENT, fontFace: BODY, isTextBox: true, margin: 0,
    });
    y += 0.32;
  }
  s.addText(title, {
    x: MX, y, w: opts.w || CW, h: opts.h || 0.72, fontSize: opts.size || 32, bold: true,
    color: dark ? WHITE : INK, fontFace: HEAD, isTextBox: true, margin: 0,
  });
  return y + (opts.h || 0.72) + 0.2;
}
function lede(s, text, y, opts = {}) {
  s.addText(text, {
    x: MX, y, w: opts.w || CW * 0.78, h: opts.h || 0.6, fontSize: opts.size || 14.5,
    color: opts.dark ? 'BDB9C6' : MUTED, fontFace: BODY, lineSpacing: 21,
    isTextBox: true, margin: 0,
  });
  return y + (opts.h || 0.6) + 0.22;
}
/* the motif: a node dot in its type colour, exactly as the graph draws it */
function nodeRow(s, { x, y, w, color, title, gloss, meta, dotSize = 0.17, titleSize = 13.5, glossSize = 11 }) {
  s.addShape(p.ShapeType.ellipse, {
    x, y: y + 0.055, w: dotSize, h: dotSize, fill: { color }, line: { color, width: 0 },
  });
  const tx = x + dotSize + 0.16;
  const tw = w - dotSize - 0.16;
  s.addText(title, {
    x: tx, y, w: tw, h: 0.26, fontSize: titleSize, bold: true, color: INK,
    fontFace: BODY, isTextBox: true, margin: 0,
  });
  let yy = y + 0.27;
  if (meta) {
    s.addText(meta, {
      x: tx, y: yy, w: tw, h: 0.2, fontSize: 9.5, color: FAINT, fontFace: BODY,
      isTextBox: true, margin: 0, charSpacing: 0.3,
    });
    yy += 0.22;
  }
  if (gloss) {
    s.addText(gloss, {
      x: tx, y: yy, w: tw, h: 0.78, fontSize: glossSize, color: MUTED, fontFace: BODY,
      lineSpacing: 15.5, isTextBox: true, margin: 0,
    });
  }
}
function card(s, { x, y, w, h, fill = TINT }) {
  s.addShape(p.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: LINE, width: 0.75 },
  });
}
function stat(s, { x, y, w, value, label, color = ACCENT, size = 40 }) {
  s.addText(String(value), {
    x, y, w, h: 0.62, fontSize: size, bold: true, color, fontFace: HEAD,
    isTextBox: true, margin: 0,
  });
  s.addText(label, {
    x, y: y + 0.62, w, h: 0.44, fontSize: 10.5, color: MUTED, fontFace: BODY,
    isTextBox: true, margin: 0, lineSpacing: 13,
  });
}
// Abbreviated: the full style names wrapped the meta line in a narrow column,
// which pushed the gloss down a line on some rows and not others.
const SHORT = { dismissive: 'DA', anxious: 'AP', fearful: 'FA', secure: 'S' };
const typeMeta = (n) => {
  const bits = [];
  if (n.c) bits.push(`${n.c} video${n.c === 1 ? '' : 's'}`);
  if (n.lens) bits.push(n.lens.replace(/(\w+):/g, (m, k) => (SHORT[k] || k) + ':'));
  return bits.join('   ·   ');
};

/* ============================================================= 1. title */
{
  const s = slide(true);
  s.addText('Attachment,\nas a graph', {
    x: MX, y: 1.55, w: 7.4, h: 2.5, fontSize: 54, bold: true, color: WHITE,
    fontFace: HEAD, lineSpacing: 58, isTextBox: true, margin: 0,
  });
  s.addText(
    'A knowledge graph of Heidi Priebe’s work on attachment theory — and the tooling that lets an AI teach from it instead of from memory.',
    { x: MX, y: 4.25, w: 6.6, h: 1.0, fontSize: 15, color: 'B9B5C4', fontFace: BODY, lineSpacing: 23, isTextBox: true, margin: 0 },
  );
  const dots = ['strategy', 'state', 'belief', 'practice', 'concept', 'origin', 'trigger', 'behavior'];
  dots.forEach((k, i) => {
    s.addShape(p.ShapeType.ellipse, {
      x: MX + i * 0.34, y: 5.55, w: 0.2, h: 0.2, fill: { color: T[k] }, line: { width: 0 },
    });
  });
  const cells = [
    [M.videos, 'videos mined'],
    [M.counts.nodes, 'nodes'],
    [M.counts.edges, 'typed edges'],
    [M.counts.cycles, 'loops found'],
  ];
  cells.forEach(([v, l], i) => {
    const x = 8.55, y = 1.75 + i * 1.05;
    s.addText(String(v), {
      x, y, w: 1.5, h: 0.55, fontSize: 34, bold: true, color: WHITE, fontFace: HEAD,
      align: 'right', isTextBox: true, margin: 0,
    });
    s.addText(l, {
      x: x + 1.65, y: y + 0.16, w: 2.4, h: 0.35, fontSize: 12.5, color: '9B97A6',
      fontFace: BODY, isTextBox: true, margin: 0,
    });
  });
  s.addText('An extended readme  ·  what it is, how it was built, and what it is for', {
    x: MX, y: 6.5, w: CW, h: 0.3, fontSize: 11, color: '76727F', fontFace: BODY, isTextBox: true, margin: 0,
  });
  s.addNotes('Opening frame: this is a derivative index of Heidi Priebe’s work. All credit for the ideas is hers. Nothing here reproduces her transcripts.');
}

/* ============================================================= 2. why */
{
  const s = slide();
  let y = heading(s, 'the problem', 'Good material, wrong shape');
  y = lede(s,
    'Priebe’s attachment work is roughly forty hours of video across 54 uploads. The ideas are densely cross-referenced — a strategy in one video is the mirror of a strategy in another, and a practice in a third is the thing that unwinds both. But video is linear and unaddressable.',
    y, { w: 6.5, h: 1.5 });
  s.addText('You cannot ask a video what connects to what.', {
    x: MX, y: 3.5, w: 6.5, h: 0.5, fontSize: 20, bold: true, color: ACCENT, fontFace: HEAD,
    isTextBox: true, margin: 0,
  });
  s.addText(
    'You cannot ask it which move in the avoidant pattern is the same move as one in the anxious pattern, or what she said heals a given belief, or where a claim came from. Recognising yourself in the material requires holding all of it in your head at once — which is exactly what someone in the middle of a difficult relationship cannot do.',
    { x: MX, y: 4.15, w: 6.5, h: 1.7, fontSize: 13.5, color: MUTED, fontFace: BODY, lineSpacing: 20, isTextBox: true, margin: 0 },
  );
  card(s, { x: 7.7, y: 1.5, w: 4.9, h: 4.55 });
  s.addText('What the graph adds', {
    x: 8.05, y: 1.78, w: 4.2, h: 0.32, fontSize: 15, bold: true, color: INK, fontFace: BODY, isTextBox: true, margin: 0,
  });
  const adds = [
    ['An address for every idea', 'Each claim is a node with a stable id, a one-line gloss and a page.'],
    ['A named relationship', 'Not "these are related" but triggers, defends_against, mirrors, healed_by.'],
    ['A receipt on every edge', 'The video and the second where she says it. 2,290 of them.'],
    ['A machine to read it', 'One JSON file an assistant can traverse, with rules it has to follow.'],
  ];
  adds.forEach(([t, d], i) => {
    const yy = 2.3 + i * 0.94;
    s.addShape(p.ShapeType.ellipse, { x: 8.05, y: yy + 0.05, w: 0.15, h: 0.15, fill: { color: ACCENT }, line: { width: 0 } });
    s.addText(t, { x: 8.34, y: yy, w: 4.0, h: 0.26, fontSize: 12.5, bold: true, color: INK, fontFace: BODY, isTextBox: true, margin: 0 });
    s.addText(d, { x: 8.34, y: yy + 0.27, w: 4.0, h: 0.6, fontSize: 10.5, color: MUTED, fontFace: BODY, lineSpacing: 14.5, isTextBox: true, margin: 0 });
  });
}

/* ============================================================= 3. the point */
{
  const s = slide(true);
  heading(s, 'what it is for', 'The point is not the website', { dark: true, size: 36 });
  s.addText(
    'The graph exists so that an assistant can teach the pattern — accurately, with receipts, and inside constraints it cannot talk its way out of.',
    { x: MX, y: 1.95, w: 8.6, h: 1.1, fontSize: 19, color: 'D6D2DE', fontFace: BODY, lineSpacing: 29, isTextBox: true, margin: 0 },
  );
  const pts = [
    ['Works from the corpus, not from memory', 'Every claim traces to a video and a timestamp, so the answer is hers and checkable — not a plausible average of everything a model has read about attachment.'],
    ['Refuses what it cannot trace', 'Cite it or do not say it. Anything untraceable is flagged as inference or left out.'],
    ['Screens before it reframes', 'Attachment patterns amplify real signals; they do not manufacture them. The safety gate comes first, and it is enforced in code rather than trusted to good intentions.'],
    ['Never hands anyone a label', 'No style is assigned, no partner is diagnosed, nothing is scored. Recognition, not classification.'],
  ];
  pts.forEach(([t, d], i) => {
    const x = MX + (i % 2) * 6.15;
    const y = 3.35 + Math.floor(i / 2) * 1.85;
    s.addShape(p.ShapeType.roundRect, {
      x, y, w: 5.8, h: 1.6, rectRadius: 0.08, fill: { color: '20202A' }, line: { color: '30303C', width: 0.75 },
    });
    s.addText(t, { x: x + 0.3, y: y + 0.2, w: 5.2, h: 0.3, fontSize: 13.5, bold: true, color: WHITE, fontFace: BODY, isTextBox: true, margin: 0 });
    s.addText(d, { x: x + 0.3, y: y + 0.54, w: 5.2, h: 0.92, fontSize: 10.5, color: '9C98A8', fontFace: BODY, lineSpacing: 14.5, isTextBox: true, margin: 0 });
  });
  s.addNotes('This is the framing to lead with: the site is a by-product. The deliverable is a cited, rule-bound corpus an assistant can work from.');
}

/* ============================================================= 4. surfaces */
{
  const s = slide();
  let y = heading(s, 'what has been built', 'One graph, three surfaces');
  const cards = [
    ['The site', 'typed-graph', '590 note pages plus an explorer that opens on one idea and its neighbourhood, rather than drawing a 590-node hairball nobody can read.', T.concept],
    ['The toolbox', '12 flows', 'Short question sequences for when something is happening right now. Each opens with a safety gate and stops rather than reframing something that is actually going wrong.', T.practice],
    ['The agent kit', 'graph.json', 'The machine-readable surface: the whole graph, the schema, the operating rules and the flows, plus a URL format for showing someone the nodes being talked about.', T.strategy],
  ];
  cards.forEach(([t, tag, d, c], i) => {
    const x = MX + i * (CW / 3 + 0.05) * 0.985;
    const w = CW / 3 - 0.22;
    card(s, { x, y: 1.62, w, h: 2.45 });
    s.addShape(p.ShapeType.ellipse, { x: x + 0.28, y: 1.9, w: 0.22, h: 0.22, fill: { color: c }, line: { width: 0 } });
    s.addText(t, { x: x + 0.62, y: 1.86, w: w - 0.9, h: 0.3, fontSize: 16, bold: true, color: INK, fontFace: BODY, isTextBox: true, margin: 0 });
    s.addText(tag, { x: x + 0.28, y: 2.28, w: w - 0.56, h: 0.25, fontSize: 10, color: c, fontFace: 'Courier New', bold: true, isTextBox: true, margin: 0 });
    s.addText(d, { x: x + 0.28, y: 2.6, w: w - 0.56, h: 1.3, fontSize: 11, color: MUTED, fontFace: BODY, lineSpacing: 15.5, isTextBox: true, margin: 0 });
  });
  s.addImage({ path: 'scripts/deck/assets/deck-explore.png', x: MX, y: 4.34, w: 4.6, h: 2.69 });
  s.addText(
    'The explorer, open on one strategy. Colour is the kind of node; the arrows are the sixteen relationship types, coloured by family. Neighbours are one click away, and the whole state of the view lives in the URL — which is what lets an assistant hand you a picture of what it just said.',
    { x: 5.65, y: 4.42, w: CW - 4.93, h: 2.1, fontSize: 12.5, color: MUTED, fontFace: BODY, lineSpacing: 19, isTextBox: true, margin: 0 },
  );
}

/* ============================================================= 5. material */
{
  const s = slide();
  let y = heading(s, 'the material', 'Fifty-four videos, and a receipt on every claim');
  const stats = [
    [M.videos, 'videos mined,\nnone reproduced'],
    [M.counts.nodes, 'nodes, each with\na page and an id'],
    [M.counts.edges, 'typed edges between\nthem'],
    ['542', 'edges carrying a video\nand a second'],
  ];
  stats.forEach(([v, l], i) => {
    stat(s, { x: MX + i * 2.3, y: 1.72, w: 2.15, value: v, label: l, color: INK, size: 36 });
  });
  s.addText('Where each idea comes from', {
    x: MX, y: 3.5, w: 5.6, h: 0.32, fontSize: 15, bold: true, color: INK, fontFace: BODY, isTextBox: true, margin: 0,
  });
  s.addText(
    'Every node records whether the idea is standard attachment literature, Priebe’s own framing, or a connection drawn here. It is a provenance label, not a confidence score — a Priebe-only graph faithfully recording her claim is doing its job.',
    { x: MX, y: 3.9, w: 5.6, h: 1.4, fontSize: 12.5, color: MUTED, fontFace: BODY, lineSpacing: 18.5, isTextBox: true, margin: 0 },
  );
  s.addText(
    'The transcripts themselves are working input only. They are gitignored, never committed and never published, and no note reproduces her words — every note paraphrases and links back to the moment.',
    { x: MX, y: 5.45, w: 5.6, h: 1.2, fontSize: 12.5, color: MUTED, fontFace: BODY, lineSpacing: 18.5, isTextBox: true, margin: 0 },
  );
  s.addChart(p.ChartType.doughnut, [{
    name: 'Attribution',
    labels: ['Priebe’s own framing', 'Standard literature', 'Synthesis drawn here'],
    values: [M.attribution.priebe, M.attribution.literature, M.attribution.synthesis],
  }], {
    x: 6.9, y: 2.9, w: 5.9, h: 3.9,
    holeSize: 55, showLegend: true, legendPos: 'b', legendFontSize: 11, legendColor: INK,
    chartColors: [ACCENT.replace('#', ''), '5B83E8', '2BB0A3'],
    showValue: true, dataLabelColor: 'FFFFFF', dataLabelFontSize: 12, dataLabelFontBold: true,
    showTitle: true, title: '536 idea nodes by attribution', titleFontSize: 13, titleColor: INK,
  });
}

/* ============================================================= 6. anatomy */
{
  const s = slide();
  const ex = M.example;
  let y = heading(s, 'anatomy', 'What one node holds');
  card(s, { x: MX, y: 1.55, w: 6.1, h: 4.9, fill: WHITE });
  s.addShape(p.ShapeType.ellipse, { x: MX + 0.35, y: 1.9, w: 0.24, h: 0.24, fill: { color: T.strategy }, line: { width: 0 } });
  s.addText(ex.title, { x: MX + 0.72, y: 1.84, w: 5.1, h: 0.36, fontSize: 19, bold: true, color: INK, fontFace: HEAD, isTextBox: true, margin: 0 });
  s.addText('strategy   ·   literature   ·   6 videos   ·   10 neighbours', {
    x: MX + 0.35, y: 2.3, w: 5.4, h: 0.26, fontSize: 10.5, color: FAINT, fontFace: BODY, isTextBox: true, margin: 0,
  });
  s.addText(clip(ex.gloss, 210), {
    x: MX + 0.35, y: 2.66, w: 5.4, h: 1.1, fontSize: 12, color: MUTED, fontFace: BODY, lineSpacing: 17, isTextBox: true, margin: 0,
  });
  s.addText('ALSO KNOWN AS', { x: MX + 0.35, y: 3.85, w: 5.4, h: 0.22, fontSize: 9, bold: true, charSpacing: 1.2, color: FAINT, fontFace: BODY, isTextBox: true, margin: 0 });
  s.addText(ex.aliases.slice(0, 4).join('  ·  '), {
    x: MX + 0.35, y: 4.09, w: 5.4, h: 0.3, fontSize: 11, color: INK, fontFace: BODY, isTextBox: true, margin: 0,
  });
  s.addText('RELATIONSHIPS', { x: MX + 0.35, y: 4.56, w: 5.4, h: 0.22, fontSize: 9, bold: true, charSpacing: 1.2, color: FAINT, fontFace: BODY, isTextBox: true, margin: 0 });
  const rels = ex.rels.filter((r) => !r.startsWith('described_in')).slice(0, 5);
  rels.forEach((r, i) => {
    const [pred, rest] = r.split(' → ');
    s.addText([
      { text: pred, options: { color: pred === 'mirrors' ? T.belief : (pred === 'characterizes' ? T.belief : T.state), bold: true, fontFace: 'Courier New', fontSize: 10 } },
      { text: '  ' + rest, options: { color: INK, fontFace: BODY, fontSize: 11 } },
    ], { x: MX + 0.35, y: 4.82 + i * 0.31, w: 5.4, h: 0.28, isTextBox: true, margin: 0 });
  });
  const notes = [
    ['A stable id', 'strategies/hyperactivating-strategies — the same string names it in the JSON, in a URL and on the site.'],
    ['Aliases', 'So a search for "protest behaviour" or "chasing connection" lands on it, and so an assistant can resolve a name it was given loosely.'],
    ['A lens per style', 'core for anxious-preoccupied, alternating for fearful-avoidant, absent for the other two. The same topology reads differently through each.'],
    ['Typed, cited edges', 'Not "see also". mirrors → Deactivating Strategies, at 6:05 of a named video.'],
  ];
  notes.forEach(([t, d], i) => {
    const yy = 1.72 + i * 1.24;
    s.addText(t, { x: 7.2, y: yy, w: 5.4, h: 0.28, fontSize: 13.5, bold: true, color: ACCENT, fontFace: BODY, isTextBox: true, margin: 0 });
    s.addText(d, { x: 7.2, y: yy + 0.3, w: 5.4, h: 0.85, fontSize: 11.5, color: MUTED, fontFace: BODY, lineSpacing: 16.5, isTextBox: true, margin: 0 });
  });
}

/* ============================================================= 7. node types */
{
  const s = slide();
  let y = heading(s, 'the vocabulary', 'Eleven kinds of node');
  y = lede(s, 'A closed list. Nothing gets written into the graph that does not fit it, and the validator refuses anything that does not.', y, { h: 0.4 });
  const defs = [
    ['trigger', 'What sets the system off', T.trigger],
    ['state', 'What is felt underneath', T.state],
    ['strategy', 'What the system does about it', T.strategy],
    ['behavior', 'What that looks like from outside', T.behavior],
    ['belief', 'The conclusion that keeps it running', T.belief],
    ['origin', 'The developmental condition behind it', T.origin],
    ['style', 'The four attachment patterns', T.style],
    ['concept', 'A named idea in her framework', T.concept],
    ['practice', 'Something you can actually do', T.practice],
    ['video', 'A source upload', T.video],
    ['source', 'A book or paper referenced', T.source],
  ];
  defs.forEach(([k, d, c], i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = MX + col * 4.15, yy = 2.5 + row * 1.08;
    s.addShape(p.ShapeType.ellipse, { x, y: yy + 0.06, w: 0.2, h: 0.2, fill: { color: c }, line: { width: 0 } });
    s.addText([
      { text: k, options: { fontSize: 14, bold: true, color: INK, fontFace: BODY } },
      { text: `   ${M.counts.byType[k] ?? 0}`, options: { fontSize: 12, color: c, fontFace: BODY, bold: true } },
    ], { x: x + 0.32, y: yy, w: 3.5, h: 0.28, isTextBox: true, margin: 0 });
    s.addText(d, { x: x + 0.32, y: yy + 0.3, w: 3.5, h: 0.55, fontSize: 11, color: MUTED, fontFace: BODY, lineSpacing: 15, isTextBox: true, margin: 0 });
  });
  s.addText(
    'The four styles are not categories anyone is put into. They are lenses the same material is read through.',
    { x: MX, y: 6.8, w: CW, h: 0.4, fontSize: 12, italic: true, color: FAINT, fontFace: BODY, isTextBox: true, margin: 0 },
  );
}

/* ============================================================= 8. predicates */
{
  const s = slide();
  let y = heading(s, 'the grammar', 'Sixteen relationships, in five families');
  y = lede(s, 'Direction is enforced at authoring time, so it can be relied on downstream: A triggers B means A fires B, never the reverse.', y, { h: 0.4 });
  const fams = [
    ['activation', 'what fires what', T.state, ['triggers', 'deactivates', 'regulates']],
    ['defense', 'how the pattern is built', T.strategy, ['defends_against', 'manifests_as', 'sustains', 'originates_in']],
    ['identity', 'how things compare', T.belief, ['characterizes', 'mirrors', 'contrasts_with', 'mistaken_for', 'part_of']],
    ['healing', 'what changes it', T.practice, ['healed_by', 'requires']],
    ['provenance', 'where it came from', T.video, ['described_in', 'derived_from']],
  ];
  let yy = 2.58;
  fams.forEach(([fam, what, c, preds]) => {
    const h = 0.42 + Math.ceil(preds.length / 5) * 0.34;
    s.addShape(p.ShapeType.ellipse, { x: MX, y: yy + 0.08, w: 0.18, h: 0.18, fill: { color: c }, line: { width: 0 } });
    s.addText([
      { text: fam, options: { fontSize: 13.5, bold: true, color: INK, fontFace: BODY } },
      { text: `   ${what}`, options: { fontSize: 11.5, color: FAINT, fontFace: BODY } },
    ], { x: MX + 0.3, y: yy, w: 3.6, h: 0.3, isTextBox: true, margin: 0 });
    preds.forEach((pr, j) => {
      const px = 4.32 + j * 1.68;
      s.addShape(p.ShapeType.roundRect, {
        x: px, y: yy - 0.02, w: 1.56, h: 0.36, rectRadius: 0.06,
        fill: { color: TINT }, line: { color: LINE, width: 0.75 },
      });
      s.addText(pr, {
        x: px, y: yy - 0.02, w: 1.56, h: 0.36, fontSize: 9.5, color: c, bold: true,
        fontFace: 'Courier New', align: 'center', valign: 'middle', isTextBox: true, margin: 0,
      });
      s.addText(String(M.counts.byPredicate[pr] ?? 0), {
        x: px, y: yy + 0.36, w: 1.56, h: 0.22, fontSize: 9, color: MUTED,
        fontFace: BODY, align: 'center', isTextBox: true, margin: 0,
      });
    });
    yy += 0.78;
  });
  s.addText(
    'Flow predicates — triggers, deactivates, manifests_as — stay narrow on purpose: a rejection there is an authoring mistake, not a gap in the schema. Descriptive ones widen as real cases turn up.',
    { x: MX, y: 6.68, w: CW, h: 0.5, fontSize: 11.5, italic: true, color: FAINT, fontFace: BODY, lineSpacing: 16, isTextBox: true, margin: 0 },
  );
}

/* ============================================================= 9. why typed */
{
  const s = slide();
  let y = heading(s, 'why bother', 'A link graph says "related". This says how.');
  const cols = [
    ['An ordinary link graph', LINE, MUTED, [
      'Affect Suppression — Contempt',
      'Affect Suppression — Unregistered Hurt',
      'Affect Suppression — Self-Regulation',
      'Affect Suppression — Amplifying The Signal',
    ], 'Four undifferentiated links. You cannot tell what any of them mean, so you cannot answer a question with them.'],
    ['The same node, typed', ACCENT, INK, [
      'manifests_as → Looking Down On The Partner',
      'deactivates → Unregistered Hurt',
      'mistaken_for → Self-Regulation',
      'mirrors → Amplifying The Signal',
    ], 'Now each link answers a different question: what it looks like from outside, what it shuts off, what it gets confused with, and what the anxious equivalent is.'],
  ];
  cols.forEach(([t, edge, txt, rows, note], i) => {
    const x = MX + i * 6.2;
    card(s, { x, y: 1.72, w: 5.7, h: 3.0, fill: i ? WHITE : TINT });
    s.addText(t, { x: x + 0.32, y: 1.98, w: 5.2, h: 0.3, fontSize: 14.5, bold: true, color: i ? ACCENT : MUTED, fontFace: BODY, isTextBox: true, margin: 0 });
    rows.forEach((r, j) => {
      const parts = r.split(' → ');
      if (parts.length === 2) {
        s.addText([
          { text: parts[0], options: { fontFace: 'Courier New', fontSize: 10, bold: true, color: ACCENT } },
          { text: '  ' + parts[1], options: { fontFace: BODY, fontSize: 11.5, color: txt } },
        ], { x: x + 0.32, y: 2.45 + j * 0.44, w: 5.2, h: 0.34, isTextBox: true, margin: 0 });
      } else {
        s.addText(r, { x: x + 0.32, y: 2.45 + j * 0.44, w: 5.2, h: 0.34, fontSize: 11.5, color: txt, fontFace: BODY, isTextBox: true, margin: 0 });
      }
    });
    s.addText(note, { x, y: 4.9, w: 5.7, h: 1.1, fontSize: 12, color: MUTED, fontFace: BODY, lineSpacing: 17.5, isTextBox: true, margin: 0 });
  });
  s.addText(
    'This is also what makes the corpus usable by a model: it can walk a mechanism rather than pattern-match a topic.',
    { x: MX, y: 6.35, w: CW, h: 0.4, fontSize: 13, bold: true, color: INK, fontFace: BODY, isTextBox: true, margin: 0 },
  );
}

/* ============================================================= 10. divider */
{
  const s = slide(true);
  s.addText('What is in it', { x: MX, y: 2.9, w: 8, h: 0.9, fontSize: 44, bold: true, color: WHITE, fontFace: HEAD, isTextBox: true, margin: 0 });
  s.addText('A few nodes from each part of the graph — out of 590. Every gloss below is the note’s own first sentence.', {
    x: MX, y: 3.95, w: 7.4, h: 0.7, fontSize: 14, color: '9C98A8', fontFace: BODY, lineSpacing: 21, isTextBox: true, margin: 0,
  });
  ['trigger', 'state', 'strategy', 'behavior', 'belief', 'origin', 'practice', 'concept'].forEach((k, i) => {
    s.addShape(p.ShapeType.ellipse, { x: MX + i * 0.36, y: 5.1, w: 0.22, h: 0.22, fill: { color: T[k] }, line: { width: 0 } });
  });
}

/* --------------------------------------------------- theme slides, generated */
function themeSlide(kicker, title, blurb, groups, note) {
  const s = slide();
  let y = heading(s, kicker, title);
  lede(s, blurb, y, { h: 0.62, w: CW * 0.86 });
  const flat = [];
  groups.forEach(([type, items]) => items.forEach((n) => flat.push([type, n])));
  flat.forEach(([type, n], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    nodeRow(s, {
      x: MX + col * 6.2, y: 2.72 + row * 1.92, w: 5.7, color: T[type],
      title: n.t, gloss: clip(n.g, 240), meta: typeMeta(n),
      titleSize: 14.5, glossSize: 11.5, dotSize: 0.19,
    });
  });
  if (note) {
    s.addText(note, {
      x: MX, y: 6.6, w: CW, h: 0.45, fontSize: 11.5, italic: true, color: FAINT,
      fontFace: BODY, lineSpacing: 16, isTextBox: true, margin: 0,
    });
  }
  return s;
}

themeSlide('the mechanism', 'Triggers and states', 'What sets the system off, and what is running underneath when it does. Small in number and heavily connected — these are the load-bearing nodes.', [
  ['trigger', M.trigger.slice(0, 2)],
  ['state', M.state.slice(0, 2)],
], 'Only 4 triggers and 26 states in the whole graph, against 245 concepts. The causal core is small; almost everything else hangs off it.');

themeSlide('the mechanism', 'Strategies and behaviours', 'What the system does about the state, and what that looks like from the outside. The distinction matters: a strategy is not visible, a behaviour is.', [
  ['strategy', M.strategy.slice(0, 2)],
  ['behavior', M.behavior.slice(0, 2)],
], 'The lens line under each title is what that node is for each style — core, feared, alternating, absent. The same strategy is a defining move for one style and the thing another organises itself against.');

themeSlide('the structure', 'Beliefs and origins', 'The conclusion that keeps a strategy running, and the developmental condition that made the conclusion reasonable at the time.', [
  ['belief', M.belief.slice(0, 2)],
  ['origin', M.origin.slice(0, 2)],
], 'Only 13 origins. They are the most connected nodes in the graph — a single developmental condition sits underneath dozens of adult moves.');

themeSlide('the healing side', 'Practices', '93 of them — the largest type after concepts. Not advice: things she describes someone actually doing, each linked to what it is supposed to unwind.', [
  ['practice', M.practice.slice(0, 4)],
], 'Every practice is joined to what it is meant to unwind by a healed_by or regulates edge, and some require another practice first — so the graph can say what has to come before what.');

themeSlide('the ideas', 'Concepts', '245 nodes, the bulk of the graph: her named ideas and framings, the ones the rest of the material hangs off.', [
  ['concept', M.concept.slice(0, 4)],
], 'Concepts are where her own vocabulary lives, and where a reader most often needs a definition rather than a diagram.');

/* ============================================================= mirrors */
{
  const s = slide();
  let y = heading(s, 'the useful one', 'Mirrors');
  y = lede(s,
    'The predicate that pairs a move in one style with its counterpart in another. It is the most useful relationship in the graph when helping someone, because it describes a pattern without claiming anything about who is running it.',
    y, { h: 0.75, w: CW * 0.8 });
  const pairs = [
    ['Affect Suppression', 'strategy', 'Amplifying The Signal', 'strategy', 'The avoidant move and the anxious move are the same move — turning the volume of a feeling down, or up, so that it does what is needed.'],
    ['Deactivating Strategies', 'strategy', 'Hyperactivating Strategies', 'strategy', 'Both are responses to growing dependency. One scans for cost, the other for signs the bond is at risk.'],
    ['Attachment-Seeking Met With Hostility', 'origin', 'Inconsistent Responsiveness', 'origin', 'Two developmental conditions that produce opposite adaptations from the same unmet need.'],
  ];
  pairs.forEach(([a, ta, b, tb, note], i) => {
    const yy = 2.9 + i * 1.3;
    card(s, { x: MX, y: yy, w: CW, h: 1.15 });
    s.addShape(p.ShapeType.ellipse, { x: MX + 0.3, y: yy + 0.28, w: 0.18, h: 0.18, fill: { color: T[ta] }, line: { width: 0 } });
    s.addText(a, { x: MX + 0.58, y: yy + 0.2, w: 3.6, h: 0.32, fontSize: 13, bold: true, color: INK, fontFace: BODY, isTextBox: true, margin: 0 });
    s.addText('⟷', { x: MX + 4.25, y: yy + 0.2, w: 0.4, h: 0.32, fontSize: 15, color: ACCENT, fontFace: BODY, align: 'center', isTextBox: true, margin: 0 });
    s.addShape(p.ShapeType.ellipse, { x: MX + 4.78, y: yy + 0.28, w: 0.18, h: 0.18, fill: { color: T[tb] }, line: { width: 0 } });
    s.addText(b, { x: MX + 5.06, y: yy + 0.2, w: 3.7, h: 0.32, fontSize: 13, bold: true, color: INK, fontFace: BODY, isTextBox: true, margin: 0 });
    s.addText(note, { x: MX + 0.58, y: yy + 0.58, w: CW - 1.0, h: 0.5, fontSize: 11, color: MUTED, fontFace: BODY, lineSpacing: 15.5, isTextBox: true, margin: 0 });
  });
  s.addText(
    `${M.counts.byPredicate.mirrors} mirror edges. None of them says who is which.`,
    { x: MX, y: 6.82, w: CW, h: 0.35, fontSize: 12, italic: true, color: FAINT, fontFace: BODY, isTextBox: true, margin: 0 },
  );
}

/* ============================================================= loops */
{
  const s = slide();
  let y = heading(s, 'why a directed graph', 'The loops are the point');
  y = lede(s,
    'Cycles are searched for automatically across the causal edges. They are not errors — they are the pursue/withdraw loop, the shame spiral, the on-again-off-again cycle, found in the data rather than asserted.',
    y, { h: 0.7, w: CW * 0.82 });
  const cyc = M.cycles.find((c) => c.len === 4);
  const boxW = 2.66, gap = 0.38, yBox = 2.95;
  const bx0 = (W - (4 * boxW + 3 * gap)) / 2;
  cyc.nodes.forEach((n, i) => {
    const x = bx0 + i * (boxW + gap);
    s.addShape(p.ShapeType.roundRect, {
      x, y: yBox, w: boxW, h: 1.15, rectRadius: 0.08,
      fill: { color: TINT }, line: { color: ACCENT, width: 1 },
    });
    s.addText(n, {
      x: x + 0.16, y: yBox, w: boxW - 0.32, h: 1.15, fontSize: 12, bold: true, color: INK,
      fontFace: BODY, align: 'center', valign: 'middle', lineSpacing: 16, isTextBox: true, margin: 0,
    });
    if (i < cyc.nodes.length - 1) {
      s.addShape(p.ShapeType.line, {
        x: x + boxW + 0.06, y: yBox + 0.575, w: gap - 0.12, h: 0,
        line: { color: ACCENT, width: 1.5, endArrowType: 'triangle' },
      });
    }
  });
  const lastX = bx0 + 3 * (boxW + gap) + boxW;
  s.addShape(p.ShapeType.line, { x: lastX - 0.4, y: yBox + 1.15, w: 0, h: 0.55, line: { color: ACCENT, width: 1.5 } });
  s.addShape(p.ShapeType.line, { x: bx0 + 0.4, y: yBox + 1.7, w: lastX - 0.8 - bx0, h: 0, line: { color: ACCENT, width: 1.5 } });
  s.addShape(p.ShapeType.line, { x: bx0 + 0.4, y: yBox + 1.15, w: 0, h: 0.55, line: { color: ACCENT, width: 1.5, beginArrowType: 'triangle' } });
  s.addText('and round again', {
    x: MX, y: yBox + 1.74, w: CW, h: 0.3, fontSize: 10.5, italic: true, color: ACCENT,
    fontFace: BODY, align: 'center', isTextBox: true, margin: 0,
  });
  s.addText('The other four found in the graph', {
    x: MX, y: 5.35, w: CW, h: 0.3, fontSize: 12.5, bold: true, color: INK, fontFace: BODY, isTextBox: true, margin: 0,
  });
  M.cycles.filter((c) => c.len !== 4).slice(0, 4).forEach((c, i) => {
    s.addText([
      { text: `${c.len} steps   `, options: { fontSize: 10, color: FAINT, fontFace: BODY } },
      { text: clip(c.nodes.join('  →  '), 118), options: { fontSize: 11, color: MUTED, fontFace: BODY } },
    ], { x: MX, y: 5.74 + i * 0.32, w: CW, h: 0.3, isTextBox: true, margin: 0 });
  });
}

/* ============================================================= lenses */
{
  const s = slide();
  let y = heading(s, 'four readings', 'The same node, through four lenses');
  y = lede(s,
    'Every node records what it is for each style. Closeness is a threat through one lens and a promise that never arrives through another — same topology, different weight.',
    y, { h: 0.6, w: CW * 0.82 });
  const vals = [
    ['core', 'A defining move of that style — you would expect to find it running.'],
    ['alternating', 'Present by oscillation rather than by default. This is how fearful-avoidant is carried in the graph: not a third style, but both, in turn.'],
    ['secondary', 'Shows up, but is not what defines the pattern.'],
    ['feared', 'The thing that style organises itself against.'],
    ['secure-form', 'What this looks like when it is not a defence.'],
    ['absent', 'Not part of that lens at all. Filtered out rather than greyed.'],
  ];
  vals.forEach(([k, d], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = MX + col * 6.2, yy = 2.6 + row * 1.1;
    s.addText(k, { x, y: yy, w: 5.8, h: 0.28, fontSize: 13, bold: true, color: ACCENT, fontFace: 'Courier New', isTextBox: true, margin: 0 });
    s.addText(d, { x, y: yy + 0.3, w: 5.8, h: 0.72, fontSize: 11.5, color: MUTED, fontFace: BODY, lineSpacing: 16.5, isTextBox: true, margin: 0 });
  });
  card(s, { x: MX, y: 5.9, w: CW, h: 0.98 });
  s.addText([
    { text: 'Affect Suppression', options: { fontSize: 13, bold: true, color: INK, fontFace: BODY } },
    { text: '     dismissive-avoidant ', options: { fontSize: 11.5, color: MUTED, fontFace: BODY } },
    { text: 'core', options: { fontSize: 11.5, bold: true, color: T.strategy, fontFace: BODY } },
    { text: '     anxious-preoccupied ', options: { fontSize: 11.5, color: MUTED, fontFace: BODY } },
    { text: 'feared', options: { fontSize: 11.5, bold: true, color: T.state, fontFace: BODY } },
    { text: '     fearful-avoidant ', options: { fontSize: 11.5, color: MUTED, fontFace: BODY } },
    { text: 'alternating', options: { fontSize: 11.5, bold: true, color: T.belief, fontFace: BODY } },
    { text: '     secure ', options: { fontSize: 11.5, color: MUTED, fontFace: BODY } },
    { text: 'absent', options: { fontSize: 11.5, color: FAINT, fontFace: BODY } },
  ], { x: MX + 0.32, y: 6.1, w: CW - 0.64, h: 0.3, isTextBox: true, margin: 0 });
  s.addText('One node. Four different things depending on who is reading it.', {
    x: MX + 0.32, y: 6.44, w: CW - 0.64, h: 0.3, fontSize: 11, italic: true, color: FAINT, fontFace: BODY, isTextBox: true, margin: 0,
  });
}

/* ============================================================= markers */
{
  const s = slide();
  let y = heading(s, 'the other direction', 'Signs of change');
  y = lede(s,
    'Nodes can be flagged as markers: things that show up when something is working. A graph of only symptoms would be a graph of what is wrong with you, which is not what any of this is for.',
    y, { h: 0.6, w: CW * 0.85 });
  M.markers.slice(0, 5).forEach((m, i) => {
    const [t, ...rest] = m.split(' — ');
    const yy = 2.62 + i * 0.86;
    s.addShape(p.ShapeType.ellipse, { x: MX, y: yy + 0.05, w: 0.19, h: 0.19, fill: { color: WHITE }, line: { color: T.practice, width: 1.5 } });
    s.addText(t, { x: MX + 0.34, y: yy, w: 4.1, h: 0.3, fontSize: 13, bold: true, color: INK, fontFace: BODY, lineSpacing: 16, isTextBox: true, margin: 0 });
    s.addText(clip(rest.join(' — '), 195), {
      x: 5.35, y: yy, w: CW - 4.63, h: 0.78, fontSize: 11.5, color: MUTED, fontFace: BODY,
      lineSpacing: 16, isTextBox: true, margin: 0,
    });
  });
  s.addText('The hollow ring is how the explorer draws them, too.', {
    x: MX, y: 6.85, w: CW, h: 0.3, fontSize: 11, italic: true, color: FAINT, fontFace: BODY, isTextBox: true, margin: 0,
  });
}

/* ============================================================= divider 2 */
{
  const s = slide(true);
  s.addText('How it works', { x: MX, y: 2.9, w: 8, h: 0.9, fontSize: 44, bold: true, color: WHITE, fontFace: HEAD, isTextBox: true, margin: 0 });
  s.addText('The pipeline, what is checked, and what an assistant is actually handed.', {
    x: MX, y: 3.95, w: 7.4, h: 0.5, fontSize: 14, color: '9C98A8', fontFace: BODY, isTextBox: true, margin: 0,
  });
}

/* ============================================================= pipeline */
{
  const s = slide();
  let y = heading(s, 'the build', 'From a transcript to three surfaces');
  const steps = [
    ['Transcript', 'Pulled per video. Working input only — gitignored, never committed, never published.'],
    ['Mining', 'Claims read out by hand into notes: a gloss, a lens map, and typed edges with timestamps.'],
    ['Validate', 'A closed vocabulary, enforced. Domain and range checked on every edge; nothing lands that fails.'],
    ['Build', 'Quartz renders the notes; scripts emit the graph JSON, the explorer, the toolbox and the agent kit.'],
    ['Check', 'A smoke test over the published HTML — not the source — then it deploys.'],
  ];
  const bw = (CW - 4 * 0.38) / 5;
  steps.forEach(([t, d], i) => {
    const x = MX + i * (bw + 0.38);
    card(s, { x, y: 1.9, w: bw, h: 2.55 });
    s.addText(String(i + 1), {
      x: x + 0.24, y: 2.1, w: 0.5, h: 0.4, fontSize: 22, bold: true, color: ACCENT, fontFace: HEAD, isTextBox: true, margin: 0,
    });
    s.addText(t, { x: x + 0.24, y: 2.58, w: bw - 0.48, h: 0.3, fontSize: 14, bold: true, color: INK, fontFace: BODY, isTextBox: true, margin: 0 });
    s.addText(d, { x: x + 0.24, y: 2.92, w: bw - 0.48, h: 1.4, fontSize: 10.5, color: MUTED, fontFace: BODY, lineSpacing: 14.5, isTextBox: true, margin: 0 });
    if (i < 4) {
      s.addShape(p.ShapeType.line, {
        x: x + bw + 0.08, y: 3.15, w: 0.22, h: 0,
        line: { color: FAINT, width: 1.25, endArrowType: 'triangle' },
      });
    }
  });
  s.addText('Everything downstream is generated', {
    x: MX, y: 4.85, w: CW, h: 0.32, fontSize: 15, bold: true, color: INK, fontFace: BODY, isTextBox: true, margin: 0,
  });
  s.addText(
    'The site, the explorer data, the toolbox, the agent kit and this deck are all emitted from the notes by script. Nothing is maintained in two places, so nothing can drift — and the same pipeline runs locally and in CI, so what deploys is what was tested.',
    { x: MX, y: 5.25, w: 7.4, h: 1.2, fontSize: 12.5, color: MUTED, fontFace: BODY, lineSpacing: 18.5, isTextBox: true, margin: 0 },
  );
  s.addText('Zero runtime dependencies', {
    x: 8.6, y: 4.85, w: 4.0, h: 0.32, fontSize: 15, bold: true, color: INK, fontFace: BODY, isTextBox: true, margin: 0,
  });
  s.addText(
    'The note format is parsed by hand-written code — no YAML library, no graph database, no server. The published site is static files, which is also why the whole thing can be handed to an assistant as a folder.',
    { x: 8.6, y: 5.25, w: 4.0, h: 1.2, fontSize: 12.5, color: MUTED, fontFace: BODY, lineSpacing: 18.5, isTextBox: true, margin: 0 },
  );
}

/* ============================================================= validator */
{
  const s = slide();
  let y = heading(s, 'what is enforced', 'The checks that refuse a change');
  const checks = [
    ['Closed vocabulary', 'Eleven node types, sixteen predicates. Anything else is rejected outright.'],
    ['Domain and range', 'A practice cannot trigger anything; only a belief can sustain a strategy. Every edge is checked against the table.'],
    ['Every link resolves', 'A wikilink to a title that does not exist fails the build rather than publishing a dead end.'],
    ['No dead ends in a flow', 'A step that is not an exit must lead somewhere, and every step must be reachable from the first.'],
    ['The safety gate comes first', 'A flow whose reframe step sits before its safety gate is rejected. The rule is structural, not remembered.'],
    ['The published site', 'A smoke test over the built HTML: no unexpanded templates, no empty sections, no page the home page fails to link to.'],
  ];
  checks.forEach(([t, d], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = MX + col * 6.2, yy = 1.75 + row * 1.62;
    card(s, { x, y: yy, w: 5.7, h: 1.42 });
    s.addText(t, { x: x + 0.3, y: yy + 0.2, w: 5.25, h: 0.3, fontSize: 13.5, bold: true, color: INK, fontFace: BODY, isTextBox: true, margin: 0 });
    s.addText(d, { x: x + 0.3, y: yy + 0.55, w: 5.25, h: 0.75, fontSize: 11, color: MUTED, fontFace: BODY, lineSpacing: 15.5, isTextBox: true, margin: 0 });
  });
  s.addText(
    'The last one exists because every presentation defect this project has had was found by a person looking, not by a check. The data was always validated; what shipped was not.',
    { x: MX, y: 6.7, w: CW, h: 0.5, fontSize: 11.5, italic: true, color: FAINT, fontFace: BODY, lineSpacing: 16, isTextBox: true, margin: 0 },
  );
}

/* ============================================================= safety */
{
  const s = slide(true);
  heading(s, 'the constraints', 'Seven rules, and one of them is code', { dark: true, size: 34 });
  s.addText(
    'Anything built on this graph inherits these. They are in the repo, they are shipped inside the agent kit, and the first one is enforced by the flow validator rather than trusted to memory.',
    { x: MX, y: 1.85, w: 8.6, h: 0.85, fontSize: 13.5, color: 'A9A5B4', fontFace: BODY, lineSpacing: 20, isTextBox: true, margin: 0 },
  );
  const rules = [
    ['Screen before you reframe', 'Patterns amplify real signals; they do not manufacture them. Establish nothing is actually happening first.'],
    ['Never tell anyone their style', 'Not as a guess, not as "this sounds like". Recognition, not classification.'],
    ['Never type an absent partner', 'The person in the room is the only one whose interior is available.'],
    ['Cite it or do not say it', 'Untraceable claims get flagged as inference or left out.'],
    ['No diagnosis, no quiz, no scoring', 'No instrument that outputs a category.'],
    ['Hand off in a crisis', 'Distress above the working range needs a person, not a decision tree.'],
    ['Not therapy, and no expertise claimed', 'Priebe states her own position plainly. Anything built on the corpus inherits that ceiling.'],
  ];
  rules.forEach(([t, d], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = MX + col * 6.2, yy = 3.0 + row * 1.03;
    s.addText(String(i + 1), {
      x, y: yy, w: 0.32, h: 0.28, fontSize: 12, bold: true, color: '9E86E8', fontFace: HEAD, isTextBox: true, margin: 0,
    });
    s.addText(t, { x: x + 0.34, y: yy, w: 5.5, h: 0.28, fontSize: 12.5, bold: true, color: WHITE, fontFace: BODY, isTextBox: true, margin: 0 });
    s.addText(d, { x: x + 0.34, y: yy + 0.29, w: 5.5, h: 0.6, fontSize: 10.5, color: '918D9D', fontFace: BODY, lineSpacing: 14, isTextBox: true, margin: 0 });
  });
}

/* ============================================================= toolbox */
{
  const s = slide();
  let y = heading(s, 'the toolbox', 'Twelve flows, for when it is happening now');
  y = lede(s,
    'Each flow is data, not prose: a sequence of questions with branches, validated like everything else. It asks; it does not score, diagnose or advise. 141 steps across the twelve, citing 117 nodes.',
    y, { h: 0.65, w: CW * 0.84 });
  const flows = [
    'I think they’re pulling away',
    'I want to message them again',
    'We keep having the same fight',
    'I’ve gone cold on someone and I don’t know why',
    'They asked for space and I’m spiralling',
    'I feel nothing and I think I should',
    'I’m angry and I can’t tell if it’s proportionate',
    'They say I hurt them and I don’t see it',
    'I want to end it and I don’t know if that’s real',
    'I’m thinking about getting back together with them',
    'There’s something I want to say and it feels too small',
    'I messed up and I don’t know what to do now',
  ];
  flows.forEach((f, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = MX + col * 6.2, yy = 2.62 + row * 0.42;
    s.addShape(p.ShapeType.ellipse, { x, y: yy + 0.09, w: 0.13, h: 0.13, fill: { color: T.practice }, line: { width: 0 } });
    s.addText('“' + f + '”', {
      x: x + 0.26, y: yy, w: 5.9, h: 0.32, fontSize: 12, color: INK, fontFace: BODY, isTextBox: true, margin: 0,
    });
  });
  card(s, { x: MX, y: 5.3, w: CW, h: 1.55 });
  s.addText('Every one of them opens with a gate', {
    x: MX + 0.32, y: 5.52, w: CW - 0.64, h: 0.3, fontSize: 14, bold: true, color: INK, fontFace: BODY, isTextBox: true, margin: 0,
  });
  s.addText(
    'Before any attachment reading is offered, the flow asks whether something real may be happening — and stops if it might be. It cuts both ways: an anxious-leaning flow stops when the alarm is correct, and an avoidant-leaning one stops when there is a genuine reason to leave. In "They say I hurt them and I don’t see it", answering that you almost always end up at fault routes to a stop that says more self-scrutiny will deepen the imbalance.',
    { x: MX + 0.32, y: 5.88, w: CW - 0.64, h: 0.9, fontSize: 11.5, color: MUTED, fontFace: BODY, lineSpacing: 16.5, isTextBox: true, margin: 0 },
  );
}

/* ============================================================= agent kit */
{
  const s = slide();
  let y = heading(s, 'the agent kit', 'What an assistant is handed');
  y = lede(s,
    'A static folder at /agent/. No query endpoint and no server — at this size there does not need to be one.',
    y, { h: 0.45, w: CW * 0.8 });
  const files = [
    ['graph.json', '820 KB', 'The whole graph. Fetch it and traverse it — fine for a program, far too much for a context window.'],
    ['context/', '~110k tokens', 'The same graph as markdown, sliced so it can be loaded one piece at a time.'],
    ['nodes.tsv', '115 KB', 'id, type, title, gloss — one line per node, for deciding what to look at.'],
    ['operating-rules.md', 'binding', 'The seven rules. Shipped with the data so they travel with it.'],
    ['schema.json', 'reference', 'The closed vocabulary, so a consumer can check rather than guess.'],
    ['flows.json', '12 flows', 'The decision flows behind the toolbox, with their gates intact.'],
  ];
  files.forEach(([f, tag, d], i) => {
    const yy = 2.36 + i * 0.66;
    s.addText(f, { x: MX, y: yy, w: 2.5, h: 0.28, fontSize: 12, bold: true, color: ACCENT, fontFace: 'Courier New', lineSpacing: 16, isTextBox: true, margin: 0 });
    s.addText(tag, { x: MX + 2.55, y: yy, w: 1.3, h: 0.26, fontSize: 10.5, color: FAINT, fontFace: BODY, lineSpacing: 16, isTextBox: true, margin: 0 });
    s.addText(d, { x: MX + 3.95, y: yy, w: 8.65 - MX - 0.4, h: 0.6, fontSize: 11.5, color: MUTED, fontFace: BODY, lineSpacing: 16, isTextBox: true, margin: 0 });
  });
  card(s, { x: MX, y: 6.32, w: CW, h: 0.66, fill: TINT });
  s.addText(
    'The README is the contract: node and edge shape, all sixteen predicates with domain and range, what the lenses mean, and what not to do with any of it.',
    { x: MX + 0.32, y: 6.32, w: CW - 0.64, h: 0.66, fontSize: 11.5, color: MUTED, fontFace: BODY, valign: 'middle', isTextBox: true, margin: 0 },
  );
}

/* ============================================================= two modes */
{
  const s = slide();
  let y = heading(s, 'the two modes', 'Talking about it, and wandering through it');
  s.addImage({ path: 'scripts/deck/assets/deck-discussion.png', x: MX, y: 1.55, w: 5.9, h: 3.46 });
  s.addText('Discussion', { x: MX, y: 5.28, w: 5.9, h: 0.3, fontSize: 15, bold: true, color: ACCENT, fontFace: BODY, isTextBox: true, margin: 0 });
  s.addText(
    'The assistant picks the nodes and writes a link. The page opens on exactly those, highlighted, with its sentence above them. No server and no socket — the URL is the transport, so it works on a static host and with any assistant that can type.',
    { x: MX, y: 5.62, w: 5.9, h: 1.35, fontSize: 11.5, color: MUTED, fontFace: BODY, lineSpacing: 16.5, isTextBox: true, margin: 0 },
  );
  s.addImage({ path: 'scripts/deck/assets/deck-explore.png', x: 6.72, y: 1.55, w: 5.9, h: 3.46 });
  s.addText('Exploration', { x: 6.72, y: 5.28, w: 5.9, h: 0.3, fontSize: 15, bold: true, color: ACCENT, fontFace: BODY, isTextBox: true, margin: 0 });
  s.addText(
    'You take over. Click any neighbour to re-centre on it, filter by relationship family or by lens, trace the shortest path between two ideas, or step through a loop. The back button walks your path.',
    { x: 6.72, y: 5.62, w: 5.9, h: 1.35, fontSize: 11.5, color: MUTED, fontFace: BODY, lineSpacing: 16.5, isTextBox: true, margin: 0 },
  );
}

/* ============================================================= limits */
{
  const s = slide();
  let y = heading(s, 'honesty', 'What this is not');
  const lim = [
    ['One person’s corpus', 'Everything here is Heidi Priebe’s framing. It is not a survey of attachment research, and where she diverges from the literature the graph records her, faithfully, without adjudicating.'],
    ['A ceiling inherited from the source', 'She states her own position plainly — largely self-taught, doing a master’s, not an expert. Anything built on the corpus inherits that and should not present itself as clinical guidance.'],
    ['101 nodes marked "literature" are unverified', 'They are labelled as standard attachment theory because she presents them that way. Checking them against the primary literature is parked, deliberately, and the label says where an idea came from — not how well established it is.'],
    ['Not a diagnosis, not a test', 'Nothing outputs a category. If it ever does, that is a bug in something built on it, not a feature of the graph.'],
    ['Derivative, and dependent', 'This is an index into her work built to help someone re-find it, not to replace watching it. All credit for the ideas is hers.'],
  ];
  lim.forEach(([t, d], i) => {
    const yy = 1.62 + i * 1.06;
    s.addText(t, { x: MX, y: yy, w: 4.3, h: 0.62, fontSize: 13, bold: true, color: INK, fontFace: BODY, lineSpacing: 16.5, isTextBox: true, margin: 0 });
    s.addText(d, { x: 5.35, y: yy, w: CW - 4.63, h: 0.95, fontSize: 11.5, color: MUTED, fontFace: BODY, lineSpacing: 16.5, isTextBox: true, margin: 0 });
  });
  s.addText(
    'Attachment styles are a framework for self-understanding, not a diagnosis, a personality type, or a fixed trait. Nothing here is therapy or a substitute for it.',
    { x: MX, y: 6.8, w: CW, h: 0.4, fontSize: 11.5, italic: true, color: FAINT, fontFace: BODY, isTextBox: true, margin: 0 },
  );
}

/* ============================================================= close */
{
  const s = slide(true);
  s.addText('Where it goes next', { x: MX, y: 1.5, w: 8, h: 0.8, fontSize: 38, bold: true, color: WHITE, fontFace: HEAD, isTextBox: true, margin: 0 });
  const next = [
    ['Extend beyond one voice', 'The schema already carries an attribution field and a source type. Adding a second corpus is a matter of mining, not redesign.'],
    ['Verify the literature nodes', 'Check the 101 nodes marked "literature" against the primary sources, and record the result separately from where the idea came from.'],
    ['Sharpen the assistant side', 'The kit gives a model the data and the rules. What it does not yet give is worked examples of using them well.'],
  ];
  next.forEach(([t, d], i) => {
    const x = MX + i * 4.15;
    s.addText(t, { x, y: 2.55, w: 3.75, h: 0.6, fontSize: 15, bold: true, color: WHITE, fontFace: BODY, lineSpacing: 20, isTextBox: true, margin: 0 });
    s.addText(d, { x, y: 3.25, w: 3.75, h: 1.4, fontSize: 11.5, color: '918D9D', fontFace: BODY, lineSpacing: 16.5, isTextBox: true, margin: 0 });
  });
  s.addText('All credit for the ideas belongs to Heidi Priebe.', {
    x: MX, y: 5.5, w: 8.5, h: 0.35, fontSize: 15, color: WHITE, fontFace: HEAD, isTextBox: true, margin: 0,
  });
  s.addText('youtube.com/@heidipriebe1', {
    x: MX, y: 5.88, w: 8.5, h: 0.32, fontSize: 12.5, color: '9E86E8', fontFace: BODY, isTextBox: true, margin: 0,
  });
  s.addText('The site, the toolbox and the agent kit are one static build from one set of notes.', {
    x: MX, y: 6.45, w: 9.5, h: 0.35, fontSize: 11.5, color: '76727F', fontFace: BODY, isTextBox: true, margin: 0,
  });
  ['trigger', 'state', 'strategy', 'behavior', 'belief', 'origin', 'practice', 'concept'].forEach((k, i) => {
    s.addShape(p.ShapeType.ellipse, { x: MX + i * 0.36, y: 6.95, w: 0.2, h: 0.2, fill: { color: T[k] }, line: { width: 0 } });
  });
}

p.writeFile({ fileName: 'Attachment-Knowledge-Graph.pptx' })
  .then((f) => console.log('wrote ' + f + ' · ' + pageNo + ' slides'));
