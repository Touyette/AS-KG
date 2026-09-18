const pptx = require('pptxgenjs');
const fs = require('fs');
// Written by scripts/deck/deck-data.mjs — see the README in this folder.
const M = JSON.parse(fs.readFileSync('deck-data.json', 'utf8'));
const C = M.counts.byType;   // so no slide has to hardcode a count that will drift

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



/* ===========================================================================
 * The overview deck: twelve slides, sent rather than presented.
 *
 * That is the constraint everything here answers to. Nobody opens speaker
 * notes in a PDF, so the substance is on the slides; and half of it is "how
 * to use this", because a deck that explains a tool without saying how to
 * start it has not done its job. The long deck (deck.js) goes deeper into
 * the material. Both read deck-data.json, so they cannot disagree.
 * ======================================================================== */

const NOTE = (s, t) => s.addNotes(t);

/* -------------------------------------------------------------------- 1 */
{
  const s = slide(true);
  s.addText('Attachment,\nas a graph', {
    x: MX, y: 2.2, w: 8.6, h: 2.0, fontSize: 52, bold: true, color: WHITE,
    fontFace: HEAD, lineSpacing: 58, isTextBox: true, margin: 0,
  });
  s.addText(`${M.videos} videos of Heidi Priebe's work on attachment theory, taken apart into something you can ask questions of — and three ways to use it.`, {
    x: MX, y: 4.4, w: 7.6, h: 1.0, fontSize: 16, color: 'BDB9C6', fontFace: BODY, lineSpacing: 24, isTextBox: true, margin: 0,
  });
  s.addText('touyette.github.io/AS-KG', {
    x: MX, y: 5.6, w: 7, h: 0.34, fontSize: 13, color: '9E86E8', fontFace: 'Courier New', isTextBox: true, margin: 0,
  });
  ['trigger', 'state', 'strategy', 'behavior', 'belief', 'origin', 'practice', 'concept'].forEach((k, i) => {
    s.addShape(p.ShapeType.ellipse, { x: MX + i * 0.36, y: 6.3, w: 0.22, h: 0.22, fill: { color: T[k] }, line: { width: 0 } });
  });
  NOTE(s, 'A derivative index of her work. All credit for the ideas is hers.');
}

/* -------------------------------------------------------------------- 2 */
{
  const s = slide();
  heading(s, 'the problem', 'Video is linear. Ideas are not.', { size: 38 });
  s.addText('You cannot ask a video what connects to what.', {
    x: MX, y: 2.2, w: 10.5, h: 0.6, fontSize: 24, bold: true, color: ACCENT, fontFace: HEAD, isTextBox: true, margin: 0,
  });
  const bits = [
    ['A strategy explained in one video', 'is the mirror of one explained in another.'],
    ['The practice that unwinds both', 'is in a third.'],
    ['Recognising yourself in it', 'means holding all of that at once — which is exactly what someone in the middle of a hard relationship cannot do.'],
  ];
  bits.forEach(([a, b], i) => {
    const yy = 3.25 + i * 1.12;
    s.addShape(p.ShapeType.ellipse, { x: MX, y: yy + 0.16, w: 0.15, h: 0.15, fill: { color: FAINT }, line: { width: 0 } });
    s.addText(a, { x: MX + 0.42, y: yy, w: 4.0, h: 0.4, fontSize: 15, bold: true, color: INK, fontFace: BODY, lineSpacing: 20, valign: 'top', isTextBox: true, margin: 0 });
    s.addText(b, { x: MX + 4.5, y: yy - 0.01, w: CW - 4.5, h: 0.85, fontSize: 14.5, color: MUTED, fontFace: BODY, lineSpacing: 20, valign: 'top', isTextBox: true, margin: 0 });
  });
  s.addText('The material is not the problem — it is very good. The shape is.', {
    x: MX, y: 6.7, w: CW, h: 0.4, fontSize: 13, italic: true, color: FAINT, fontFace: BODY, isTextBox: true, margin: 0,
  });
}

/* -------------------------------------------------------------------- 3 */
{
  const s = slide();
  heading(s, 'what it is', 'Every idea is a node. Every link says how.', { size: 34 });
  card(s, { x: MX, y: 1.9, w: CW, h: 1.75 });
  s.addText([
    { text: 'Deactivating Strategies', options: { fontSize: 18, bold: true, color: INK, fontFace: BODY } },
    { text: '     mirrors     ', options: { fontSize: 15, color: ACCENT, fontFace: 'Courier New' } },
    { text: 'Hyperactivating Strategies', options: { fontSize: 18, bold: true, color: INK, fontFace: BODY } },
    { text: '     @ 6:05', options: { fontSize: 13, color: FAINT, fontFace: BODY } },
  ], { x: MX + 0.42, y: 2.22, w: CW - 0.84, h: 0.45, isTextBox: true, margin: 0 });
  s.addText('Not "these are related". The avoidant move and the anxious move are the same move — one scanning for cost, the other for signs the bond is at risk. And the claim carries the video and the second where she says it, so you can check her rather than take my word for it.', {
    x: MX + 0.42, y: 2.76, w: CW - 0.84, h: 0.8, fontSize: 13.5, color: MUTED, fontFace: BODY, lineSpacing: 19, isTextBox: true, margin: 0,
  });
  const facts = [
    [`${M.counts.nodes} nodes`, 'one per idea, each with its own page'],
    [`${M.counts.edges} links`, 'sixteen kinds: what fires, defends, heals, mirrors'],
    [`${M.videos} videos`, 'every claim traced to one, at a timestamp'],
    [`${M.counts.cycles} loops`, 'found by searching, not asserted'],
  ];
  facts.forEach(([a, b], i) => {
    const yy = 4.1 + i * 0.72;
    s.addText(a, { x: MX, y: yy, w: 2.4, h: 0.4, fontSize: 17, bold: true, color: ACCENT, fontFace: HEAD, isTextBox: true, margin: 0 });
    s.addText(b, { x: MX + 2.6, y: yy + 0.05, w: CW - 2.6, h: 0.4, fontSize: 13.5, color: MUTED, fontFace: BODY, isTextBox: true, margin: 0 });
  });
}

/* -------------------------------------------------------------------- 4 */
{
  const s = slide();
  let y = heading(s, 'how to use it', 'Two ways in');
  y = lede(s, 'Pick by what you are doing. The first is a website and needs nothing installed; the second runs on your own machine.', y, { h: 0.5, w: CW * 0.84 });
  const cards = [
    ['1', 'the explorer', 'Reading around', 'You want to understand a pattern and follow it outward — on your own, at your own pace.', T.concept],
    ['2', 'the assistant', 'Talking it through', 'You have a situation and want to be asked about it rather than lectured at.', T.strategy],
  ];
  cards.forEach(([n, tag, t, d, c], i) => {
    const w = 5.3;
    const x = MX + i * (w + 0.9);
    card(s, { x, y: 2.35, w, h: 2.85 });
    s.addShape(p.ShapeType.ellipse, { x: x + 0.34, y: 2.68, w: 0.34, h: 0.34, fill: { color: c }, line: { width: 0 } });
    s.addText(n, { x: x + 0.34, y: 2.68, w: 0.34, h: 0.34, fontSize: 12, bold: true, color: WHITE, fontFace: BODY, align: 'center', valign: 'middle', isTextBox: true, margin: 0 });
    s.addText(tag, { x: x + 0.34, y: 3.15, w: w - 0.68, h: 0.3, fontSize: 10.5, color: c, fontFace: 'Courier New', bold: true, isTextBox: true, margin: 0 });
    s.addText(t, { x: x + 0.34, y: 3.5, w: w - 0.68, h: 0.6, fontSize: 17, bold: true, color: INK, fontFace: BODY, lineSpacing: 22, valign: 'top', isTextBox: true, margin: 0 });
    s.addText(d, { x: x + 0.34, y: 4.25, w: w - 0.68, h: 0.85, fontSize: 12, color: MUTED, fontFace: BODY, lineSpacing: 16.5, valign: 'top', isTextBox: true, margin: 0 });
  });
  s.addText('Neither will tell you your attachment style, score you, or diagnose anyone. That is a design decision, not an omission.', {
    x: MX, y: 5.5, w: CW, h: 0.5, fontSize: 13.5, color: MUTED, fontFace: BODY, isTextBox: true, margin: 0,
  });
}

/* -------------------------------------------------------------------- 5 */
{
  const s = slide();
  heading(s, 'way one', 'Read around an idea');
  s.addImage({ path: 'scripts/deck/assets/deck-explore.png', x: MX, y: 1.5, w: 7.7, h: 4.81 });
  const notes = [
    ['Colour is the style', 'Blue avoidant, orange anxious, red fearful-avoidant, green secure. Grey belongs to more than one.'],
    ['Shape is the kind of idea', 'Triangle a strategy, diamond a state, square a belief, pentagon a developmental origin.'],
    ['It never draws everything', `One idea and its neighbours. A ${M.counts.nodes}-node hairball tells you nothing.`],
    ['Click reads, double-click moves', 'So you can read your way around without losing your place.'],
  ];
  notes.forEach(([t, d], i) => {
    const yy = 1.62 + i * 1.28;
    s.addText(t, { x: 8.7, y: yy, w: CW - 7.98, h: 0.32, fontSize: 13, bold: true, color: INK, fontFace: BODY, isTextBox: true, margin: 0 });
    s.addText(d, { x: 8.7, y: yy + 0.34, w: CW - 7.98, h: 0.9, fontSize: 11, color: MUTED, fontFace: BODY, lineSpacing: 15, valign: 'top', isTextBox: true, margin: 0 });
  });
  s.addText('touyette.github.io/AS-KG/typed-graph/', { x: MX, y: 6.45, w: 7.7, h: 0.3, fontSize: 11.5, color: ACCENT, fontFace: 'Courier New', isTextBox: true, margin: 0 });
}

/* -------------------------------------------------------------------- 7 */
{
  const s = slide();
  heading(s, 'way two', 'Talk it through with an assistant');
  s.addImage({ path: 'scripts/deck/assets/deck-discussion.png', x: MX, y: 1.5, w: 7.7, h: 4.81 });
  s.addText('Three commands', { x: 8.7, y: 1.62, w: CW - 7.98, h: 0.3, fontSize: 13, bold: true, color: INK, fontFace: BODY, isTextBox: true, margin: 0 });
  card(s, { x: 8.7, y: 2.0, w: CW - 7.98, h: 1.12 });
  s.addText('git clone\n  github.com/touyette/AS-KG\ncd AS-KG\nclaude', {
    x: 8.9, y: 2.12, w: CW - 8.38, h: 0.95, fontSize: 9.5, color: ACCENT, fontFace: 'Courier New', lineSpacing: 13, isTextBox: true, margin: 0,
  });
  const notes = [
    ['It reads the briefing first', 'AGENTS.md tells it what the material is for, what to read, and the rules it works inside. You do not have to prompt any of that.'],
    ['It shows its working', 'A window opens with the nodes it is drawing on, so you can read the material yourself instead of taking its summary.'],
    ['Nothing leaves your machine', 'No account and no service. The corpus, the rules and the tools are all in the folder you downloaded.'],
  ];
  notes.forEach(([t, d], i) => {
    const yy = 3.35 + i * 1.12;
    s.addText(t, { x: 8.7, y: yy, w: CW - 7.98, h: 0.3, fontSize: 12.5, bold: true, color: INK, fontFace: BODY, isTextBox: true, margin: 0 });
    s.addText(d, { x: 8.7, y: yy + 0.32, w: CW - 7.98, h: 0.78, fontSize: 10.5, color: MUTED, fontFace: BODY, lineSpacing: 14, valign: 'top', isTextBox: true, margin: 0 });
  });
  s.addText('Works with Claude Code, Codex, or anything else that can read files and run a command.', {
    x: MX, y: 6.45, w: 7.7, h: 0.3, fontSize: 11.5, italic: true, color: FAINT, fontFace: BODY, isTextBox: true, margin: 0,
  });
}

/* -------------------------------------------------------------------- 8 */
{
  const s = slide();
  let y = heading(s, 'what that is like', 'It asks before it explains');
  y = lede(s, 'A real first exchange, shortened. The order is the safety mechanism, not a manner: a reading offered to someone who has not been heard arrives as a verdict from a stranger.', y, { h: 0.6, w: CW * 0.84 });
  const turns = [
    ['you', 'I’m dating an avoidant guy and I want it to go well. Sometimes I struggle to feel connected to him, and I tend to feel like it’s my fault.', TINT, INK],
    ['it', 'That sounds like a hard spot — you want it to work, and when the connection does not land you are the one absorbing it. Before I say anything about patterns, three questions.', 'F3EFFB', INK],
    ['it', '— Is it a vibe, or something concrete: going quiet, cancelling, pulling back after good moments?\n— Is there anything that, if a friend described it, you would flag as a real problem rather than "not very expressive"?\n— How new is new, and does the distance cluster around particular moments?', 'F3EFFB', INK],
  ];
  let yy = 2.75;
  turns.forEach(([who, text, bg]) => {
    const lines = text.split('\n').length;
    const h = 0.52 + lines * 0.42;
    card(s, { x: MX + 1.0, y: yy, w: CW - 1.0, h, fill: bg });
    s.addText(who, { x: MX, y: yy + 0.12, w: 0.9, h: 0.3, fontSize: 11, bold: true, color: FAINT, fontFace: BODY, align: 'right', isTextBox: true, margin: 0 });
    s.addText(text, { x: MX + 1.26, y: yy + 0.16, w: CW - 1.55, h: h - 0.3, fontSize: 12.5, color: INK, fontFace: BODY, lineSpacing: 18, valign: 'top', isTextBox: true, margin: 0 });
    yy += h + 0.22;
  });
  s.addText('It also said it would not build a picture of him from her side of the conversation — he is not there to correct it. That is one of the eight rules, and it holds without being asked for.', {
    x: MX, y: 6.62, w: CW, h: 0.5, fontSize: 12, italic: true, color: FAINT, fontFace: BODY, lineSpacing: 17, isTextBox: true, margin: 0,
  });
}

/* -------------------------------------------------------------------- 9 */
{
  const s = slide();
  let y = heading(s, 'why a graph at all', 'The loops are the point');
  y = lede(s, 'Cycles are found by searching the causal links, not asserted. Nobody wrote this one down — the notes were written separately, from different videos.', y, { h: 0.55, w: CW * 0.82 });
  const cyc = M.cycles.find((c) => c.len === 4) || M.cycles[0];
  const boxW = 2.66, gap = 0.38, yBox = 2.85;
  const bx0 = (W - (4 * boxW + 3 * gap)) / 2;
  cyc.nodes.slice(0, 4).forEach((n, i) => {
    const x = bx0 + i * (boxW + gap);
    s.addShape(p.ShapeType.roundRect, { x, y: yBox, w: boxW, h: 1.2, rectRadius: 0.08, fill: { color: TINT }, line: { color: ACCENT, width: 1 } });
    s.addText(n, { x: x + 0.16, y: yBox, w: boxW - 0.32, h: 1.2, fontSize: 12.5, bold: true, color: INK, fontFace: BODY, align: 'center', valign: 'middle', lineSpacing: 16, isTextBox: true, margin: 0 });
    if (i < 3) s.addShape(p.ShapeType.line, { x: x + boxW + 0.06, y: yBox + 0.6, w: gap - 0.12, h: 0, line: { color: ACCENT, width: 1.5, endArrowType: 'triangle' } });
  });
  const lastX = bx0 + 3 * (boxW + gap) + boxW;
  s.addShape(p.ShapeType.line, { x: lastX - 0.4, y: yBox + 1.2, w: 0, h: 0.55, line: { color: ACCENT, width: 1.5 } });
  s.addShape(p.ShapeType.line, { x: bx0 + 0.4, y: yBox + 1.75, w: lastX - 0.8 - bx0, h: 0, line: { color: ACCENT, width: 1.5 } });
  s.addShape(p.ShapeType.line, { x: bx0 + 0.4, y: yBox + 1.2, w: 0, h: 0.55, line: { color: ACCENT, width: 1.5, beginArrowType: 'triangle' } });
  s.addText('and round again', { x: MX, y: yBox + 1.8, w: CW, h: 0.3, fontSize: 11, italic: true, color: ACCENT, fontFace: BODY, align: 'center', isTextBox: true, margin: 0 });
  const pts = [
    ['It alternates between the two people', 'which is why it survives good intentions — each is responding reasonably to the step before.'],
    ['A closed pattern needs no new fuel', 'so "where can this be broken" is a better question than "whose fault is it", and the healing links answer it.'],
  ];
  pts.forEach(([t, d], i) => {
    const x = MX + i * 6.2;
    s.addText(t, { x, y: 5.6, w: 5.8, h: 0.34, fontSize: 13, bold: true, color: INK, fontFace: BODY, isTextBox: true, margin: 0 });
    s.addText(d, { x, y: 5.96, w: 5.8, h: 0.8, fontSize: 11.5, color: MUTED, fontFace: BODY, lineSpacing: 16, valign: 'top', isTextBox: true, margin: 0 });
  });
}

/* ------------------------------------------------------------------- 10 */
{
  const s = slide(true);
  heading(s, 'the constraints', 'Eight rules it cannot talk its way out of', { dark: true, size: 32 });
  s.addText('They ship inside the file the assistant reads first, not in a prompt someone has to remember to paste. The first is enforced in code: the validator rejects any flow where a reframe step sits before its safety gate.', {
    x: MX, y: 1.75, w: 9.2, h: 0.8, fontSize: 13, color: 'A9A5B4', fontFace: BODY, lineSpacing: 19, isTextBox: true, margin: 0,
  });
  const rules = [
    ['Screen before you reframe', 'Establish nothing real is happening first.'],
    ['Never tell anyone their style', 'Recognition, not classification.'],
    ['If they say no, it was no', 'They know their life better than the graph does.'],
    ['Never type an absent partner', 'They are not there to correct it.'],
    ['Cite it or do not say it', 'Untraceable claims are flagged or dropped.'],
    ['No diagnosis, no quiz, no scoring', 'Nothing that outputs a category.'],
    ['Hand off in a crisis', 'That needs a person, not a decision tree.'],
    ['Not therapy, no expertise claimed', 'It inherits the ceiling of its source.'],
  ];
  rules.forEach(([t, d], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = MX + col * 6.2, yy = 2.85 + row * 1.02;
    s.addText(String(i + 1), { x, y: yy, w: 0.34, h: 0.3, fontSize: 12.5, bold: true, color: '9E86E8', fontFace: HEAD, isTextBox: true, margin: 0 });
    s.addText(t, { x: x + 0.38, y: yy, w: 5.5, h: 0.3, fontSize: 13.5, bold: true, color: WHITE, fontFace: BODY, isTextBox: true, margin: 0 });
    s.addText(d, { x: x + 0.38, y: yy + 0.32, w: 5.5, h: 0.5, fontSize: 10.5, color: '918D9D', fontFace: BODY, lineSpacing: 14, valign: 'top', isTextBox: true, margin: 0 });
  });
}

/* ------------------------------------------------------------------- 11 */
{
  const s = slide();
  let y = heading(s, 'honesty', 'What this is not');
  const lim = [
    ['One person’s corpus', 'Not a survey of attachment research. Where she diverges from the literature, the graph records her rather than adjudicating.'],
    ['Not a diagnosis or a test', 'Nothing outputs a category. If something built on this ever scores you, that is a bug in it, not a feature of the graph.'],
    ['Not therapy', 'She states her own position plainly — largely self-taught, not an expert. Anything built on the corpus inherits that ceiling.'],
    [`${M.attribution.literature} nodes are unverified`, 'Marked "literature" because she presents them as standard attachment theory. Checking them against the primary sources is parked, and labelled as such.'],
  ];
  lim.forEach(([t, d], i) => {
    const yy = 2.0 + i * 1.18;
    s.addText(t, { x: MX, y: yy, w: 4.0, h: 0.6, fontSize: 14.5, bold: true, color: INK, fontFace: BODY, lineSpacing: 17.5, valign: 'top', isTextBox: true, margin: 0 });
    s.addText(d, { x: 5.1, y: yy - 0.04, w: CW - 4.38, h: 1.0, fontSize: 12.5, color: MUTED, fontFace: BODY, lineSpacing: 17.5, valign: 'top', isTextBox: true, margin: 0 });
  });
  s.addText('Attachment styles are a framework for self-understanding, not a diagnosis, a personality type, or a fixed trait. Nothing here is therapy or a substitute for it. If you are working through something difficult, a qualified therapist is the right place for it.', {
    x: MX, y: 6.55, w: CW, h: 0.6, fontSize: 12, italic: true, color: FAINT, fontFace: BODY, lineSpacing: 17, isTextBox: true, margin: 0,
  });
}

/* ------------------------------------------------------------------- 12 */
{
  const s = slide(true);
  heading(s, 'start here', 'Two links', { dark: true, size: 34 });
  const routes = [
    ['Browse the graph', 'touyette.github.io/AS-KG/typed-graph/', 'Search for something you recognise and follow it outward.', T.concept],
    ['Run it yourself', 'github.com/touyette/AS-KG', 'Clone it, open it with Claude Code or Codex, and say what is going on.', T.strategy],
  ];
  routes.forEach(([t, url, d, c], i) => {
    const yy = 1.95 + i * 1.28;
    s.addShape(p.ShapeType.ellipse, { x: MX, y: yy + 0.1, w: 0.24, h: 0.24, fill: { color: c }, line: { width: 0 } });
    s.addText(t, { x: MX + 0.46, y: yy, w: 4.2, h: 0.36, fontSize: 16, bold: true, color: WHITE, fontFace: BODY, isTextBox: true, margin: 0 });
    s.addText(url, { x: MX + 0.46, y: yy + 0.38, w: 6.0, h: 0.3, fontSize: 11.5, color: '9E86E8', fontFace: 'Courier New', isTextBox: true, margin: 0 });
    s.addText(d, { x: 7.1, y: yy + 0.02, w: CW - 6.38, h: 0.7, fontSize: 12, color: '9C98A8', fontFace: BODY, lineSpacing: 16.5, valign: 'top', isTextBox: true, margin: 0 });
  });
  s.addShape(p.ShapeType.line, { x: MX, y: 5.85, w: CW, h: 0, line: { color: '2E2E38', width: 1 } });
  s.addText('All credit for the ideas belongs to Heidi Priebe — youtube.com/@heidipriebe1', {
    x: MX, y: 6.05, w: 9.5, h: 0.32, fontSize: 13, bold: true, color: WHITE, fontFace: BODY, isTextBox: true, margin: 0,
  });
  s.addText('This is an index into her work, built to help someone re-find it rather than replace watching it. No note reproduces her words. The notes were written by hand from the transcripts; the graph, the site, this deck and the checks that keep them honest were built with Claude Code, and every count on these slides is read out of the graph at build time rather than typed in.', {
    x: MX, y: 6.42, w: CW, h: 0.9, fontSize: 11, color: '76727F', fontFace: BODY, lineSpacing: 15.5, isTextBox: true, margin: 0,
  });
}

p.writeFile({ fileName: 'AS-KG-Overview.pptx' })
  .then((f) => console.log('wrote ' + f + ' · ' + pageNo + ' slides'));
