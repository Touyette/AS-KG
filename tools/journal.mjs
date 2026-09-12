#!/usr/bin/env node
// What is in journal/, and — separately — what it says.
//
// The split is the point. An assistant may look at *whether* notes exist without
// looking at them, so that "I found notes from before, read them or start
// fresh?" is a real question rather than a courtesy asked after the fact.
//
//   node tools/journal.mjs              # what exists, and when. Reads nothing.
//   node tools/journal.mjs --read       # everything, once they have said yes
//   node tools/journal.mjs --read profile
//   node tools/journal.mjs --read 2026-09-12
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(process.env.ASKG_JOURNAL ?? 'journal');
const SESSIONS = path.join(DIR, 'sessions');

const args = process.argv.slice(2);
const readIdx = args.indexOf('--read');
const wantRead = readIdx !== -1;
const which = wantRead ? (args[readIdx + 1] ?? 'all') : null;

const days = (ms) => Math.round((Date.now() - ms) / 86400000);
const ago = (ms) => {
  const d = days(ms);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 60) return `${d} days ago`;
  return `${Math.round(d / 30)} months ago — treat as where they were then`;
};

const listSessions = () => {
  try {
    return fs.readdirSync(SESSIONS)
      .filter((f) => f.endsWith('.md'))
      .map((f) => ({ f, at: fs.statSync(path.join(SESSIONS, f)).mtimeMs }))
      .sort((a, b) => b.at - a.at);
  } catch { return []; }
};

if (!fs.existsSync(DIR)) {
  console.log('no journal/ folder here. Nothing has ever been stored.');
  process.exit(0);
}

/* ------------------------------------------------------------------- reading */

if (wantRead) {
  const dump = (file, label) => {
    console.log(`\n===== ${label} =====\n`);
    console.log(fs.readFileSync(file, 'utf8').trim());
  };
  let shown = 0;
  const profile = path.join(DIR, 'profile.md');
  if ((which === 'all' || which === 'profile') && fs.existsSync(profile)) {
    dump(profile, 'profile.md'); shown++;
  }
  for (const { f } of listSessions()) {
    const match = which === 'all' || f.startsWith(which) || f === which || f === which + '.md';
    if (!match) continue;
    dump(path.join(SESSIONS, f), `sessions/${f}`); shown++;
  }
  if (!shown) console.log(`nothing matching "${which}".`);
  process.exit(0);
}

/* -------------------------------------------------------- checking, not reading */

const profile = path.join(DIR, 'profile.md');
const hasProfile = fs.existsSync(profile);
const sessions = listSessions();

if (!hasProfile && !sessions.length) {
  console.log('journal/ is empty. Nothing has been stored yet — this is a first conversation.');
  process.exit(0);
}

console.log('There are notes from before. Ask whether to read them before you do.\n');
if (hasProfile) {
  const at = fs.statSync(profile).mtimeMs;
  console.log(`  profile.md      updated ${ago(at)}`);
}
if (sessions.length) {
  console.log(`  sessions/       ${sessions.length} conversation${sessions.length === 1 ? '' : 's'}, latest ${ago(sessions[0].at)}`);
  for (const { f, at } of sessions.slice(0, 5)) {
    console.log(`                  ${f.replace(/\.md$/, '')}  (${ago(at)})`);
  }
  if (sessions.length > 5) console.log(`                  …and ${sessions.length - 5} more`);
}
console.log(`
Ask them plainly, and mean both options:
  "I found notes from before. Would you like me to read them, or start fresh?"

Starting fresh is a real answer. If they say yes:
  node tools/journal.mjs --read profile      (the cheap one — what landed before)
  node tools/journal.mjs --read              (everything, including conversations)`);
