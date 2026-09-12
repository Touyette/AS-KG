#!/usr/bin/env node
// Push nodes into the companion window, or read back what the person did there.
//
//   node tools/show.mjs strategies/deactivating-strategies states/unregistered-hurt \
//        --why "The withdrawal, and the hurt that never got registered"
//   node tools/show.mjs --activity      # what they opened since you last asked
//   node tools/show.mjs --state         # what is on screen now, and before
//
// Node ids resolve loosely: a full path, a slug, or a title all work. If the
// companion is not running this starts it and waits, so an assistant never has
// to think about the process.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const PORT = Number(process.env.ASKG_PORT ?? 7777);
const BASE = `http://localhost:${PORT}`;
// fileURLToPath, not new URL(...).pathname: on Windows the latter yields
// /C:/2%20-%20GitHub/... — a leading slash and percent-encoded spaces — which is
// not a path any filesystem call will accept.
const HERE = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf('--' + name);
  if (i === -1) return null;
  const v = args[i + 1];
  args.splice(i, v && !v.startsWith('--') ? 2 : 1);
  return v && !v.startsWith('--') ? v : true;
};

const wantActivity = !!flag('activity');
const wantState = !!flag('state');
const why = flag('why');
const depth = flag('depth');
const ids = args.filter((a) => !a.startsWith('--'));

// The site's published base path (/AS-KG), learned from the companion on the
// first ping. Every URL handed to a person has to carry it or it 404s, and the
// companion is the only thing that knows it — it reads quartz.config.yaml.
let sitePath = '';
const viewUrl = () => `${BASE}${sitePath}/typed-graph/`;

const ping = async () => {
  try {
    const r = await fetch(BASE + '/companion/ping', { signal: AbortSignal.timeout(1200) });
    if (!r.ok) return false;
    const j = await r.json().catch(() => ({}));
    if (typeof j.base === 'string') sitePath = j.base;
    return true;
  } catch { return false; }
};

async function ensureRunning() {
  if (await ping()) return true;
  const script = path.join(HERE, 'companion.mjs');
  if (!fs.existsSync(script)) {
    console.error(`cannot find ${script}`);
    return false;
  }
  console.error('companion not running — starting it…');
  const child = spawn(process.execPath, [script], {
    detached: true, stdio: 'ignore', cwd: process.cwd(),
  });
  child.unref();
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (await ping()) {
      console.error(`companion up — tell the person to open ${viewUrl()}`);
      return true;
    }
  }
  console.error('companion did not come up. Run it yourself to see why:');
  console.error('  node tools/companion.mjs');
  return false;
}

const post = async (route, body) => {
  const r = await fetch(BASE + route, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, body: await r.json().catch(() => ({})) };
};

if (!(await ensureRunning())) process.exit(1);

if (wantActivity) {
  const r = await fetch(BASE + '/companion/activity');
  const { activity } = await r.json();
  if (!activity.length) console.log('nothing since you last asked.');
  else for (const a of activity) {
    console.log(`${a.at.slice(11, 19)}  ${a.kind}${a.node ? '  ' + a.node : ''}${a.text ? '  "' + a.text + '"' : ''}`);
  }
  process.exit(0);
}

if (wantState) {
  const r = await fetch(BASE + '/companion/state');
  const { current, history } = await r.json();
  console.log(`showing (turn ${current.turn}): ${current.nodes.join(', ') || '—'}`);
  if (current.why) console.log(`why: ${current.why}`);
  if (history.length) {
    console.log(`\nbefore, newest first:`);
    for (const h of history.slice().reverse().slice(0, 8)) {
      console.log(`  turn ${h.turn}  ${h.nodes.join(', ')}${h.why ? '  — ' + h.why : ''}`);
    }
  }
  process.exit(0);
}

if (!ids.length) {
  console.error('give at least one node id, or --activity / --state');
  console.error('  node tools/show.mjs strategies/deactivating-strategies --why "…"');
  process.exit(1);
}

const res = await post('/companion/show', {
  nodes: ids,
  why: typeof why === 'string' ? why : '',
  depth: depth ? Number(depth) : 1,
});
if (!res.ok) {
  console.error('companion refused it:', res.body.error ?? 'unknown');
  process.exit(1);
}
console.log(`showing ${res.body.showing} node(s) · ${res.body.viewers} window(s) open · turn ${res.body.turn}`);
if (!res.body.viewers) console.log(`nobody has the window open yet — ${viewUrl()}`);
