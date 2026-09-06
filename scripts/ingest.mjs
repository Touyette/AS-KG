// transcripts/*.vtt (+ *.info.json)  ->  transcripts/ingested/<id>.json
//
// Output stays under transcripts/, which is gitignored. Transcript text is
// working input for locating and timestamping ideas; it never enters content/.
// Notes carry paraphrase plus a pointer back to the moment in the video.
import fs from 'node:fs';
import path from 'node:path';
import { loadNotes } from './lib/notes.mjs';

const SRC = 'transcripts';
const OUT = path.join(SRC, 'ingested');

const toSeconds = (ts) => {
  const [h, m, s] = ts.split(':');
  return Number(h) * 3600 + Number(m) * 60 + parseFloat(s);
};

// Strips inline karaoke tags and cue settings, then removes the rolling-window
// duplication that YouTube auto-captions produce (each cue repeats the tail of
// the previous one).
function parseVtt(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const cues = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})/.exec(lines[i]);
    if (!m) continue;
    const body = [];
    for (let j = i + 1; j < lines.length && lines[j].trim() !== ''; j++) body.push(lines[j]);
    const clean = body
      .join(' ')
      .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '')
      .replace(/<\/?c[^>]*>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    if (clean) cues.push({ t: toSeconds(m[1]), end: toSeconds(m[2]), text: clean });
  }
  // YouTube auto-captions roll: each cue repeats a tail of the previous one,
  // sometimes only partially, so prefix/suffix tests are not enough. Merge on the
  // longest word-level overlap between the recent tail and the incoming cue, and
  // keep only what is genuinely new.
  const TAIL = 40;
  const out = [];
  const tail = [];
  for (const cue of cues) {
    const words = cue.text.split(' ').filter(Boolean);
    let k = Math.min(tail.length, words.length, TAIL);
    for (; k > 0; k--) {
      if (tail.slice(tail.length - k).join(' ') === words.slice(0, k).join(' ')) break;
    }
    const fresh = words.slice(k);
    if (!fresh.length) { const prev = out[out.length - 1]; if (prev) prev.end = cue.end; continue; }
    out.push({ t: cue.t, end: cue.end, text: fresh.join(' ') });
    tail.push(...fresh);
    if (tail.length > TAIL) tail.splice(0, tail.length - TAIL);
  }
  return out;
}

// Windows are what an extraction pass reads: long enough to carry an argument,
// short enough that the timestamp on a claim is honest.
function window(lines, chapters, span = 120) {
  const chapterAt = (t) =>
    chapters?.find((c) => t >= c.start_time && t < c.end_time)?.title ?? null;
  const out = [];
  let cur = null;
  for (const l of lines) {
    const chapter = chapterAt(l.t);
    if (!cur || l.t - cur.start >= span || chapter !== cur.chapter) {
      cur = { start: Math.floor(l.t), end: Math.ceil(l.end), chapter, text: l.text };
      out.push(cur);
    } else {
      cur.end = Math.ceil(l.end);
      cur.text += ' ' + l.text;
    }
  }
  return out;
}

if (!fs.existsSync(SRC)) {
  console.error(`no ${SRC}/ directory — nothing to ingest`);
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

const files = fs.readdirSync(SRC);
const notes = loadNotes('content').filter((n) => n.type === 'video');
const bySlug = new Map(notes.map((n) => [n.data.video_id, n]));

let done = 0;
const missing = [];
for (const note of notes) {
  const id = note.data.video_id;
  // Prefer a human-written track over auto-captions when both exist.
  const vtts = files.filter((f) => f.startsWith(id + '.') && f.endsWith('.vtt'));
  const vtt = vtts.find((f) => !/orig|auto/.test(f)) ?? vtts[0];
  if (!vtt) { missing.push(id); continue; }

  const infoPath = path.join(SRC, `${id}.info.json`);
  const info = fs.existsSync(infoPath) ? JSON.parse(fs.readFileSync(infoPath, 'utf8')) : {};
  const lines = parseVtt(fs.readFileSync(path.join(SRC, vtt), 'utf8'));
  const chapters = info.chapters ?? null;
  const windows = window(lines, chapters);

  fs.writeFileSync(
    path.join(OUT, `${id}.json`),
    JSON.stringify({
      video_id: id,
      slug: note.slug,
      title: info.title ?? note.title,
      duration: info.duration ?? note.data.duration,
      upload_date: info.upload_date ?? null,
      caption_track: vtt,
      chapters,
      windows,
    }, null, 2),
  );

  // Fold better metadata back into the note and advance its status. Only
  // frontmatter is touched; no transcript text is written.
  let md = fs.readFileSync(note.file, 'utf8');
  if (info.duration) md = md.replace(/^duration: .*$/m, `duration: ${info.duration}`);
  md = md.replace(/^status: pending$/m, 'status: ingested');
  fs.writeFileSync(note.file, md);
  done++;
}

console.log(`ingested ${done}/${notes.length} videos → ${OUT}`);
if (missing.length) console.log(`no captions found for: ${missing.join(' ')}`);
