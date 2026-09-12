#!/usr/bin/env node
// The companion window.
//
// An assistant helping someone through a situation reaches for nodes in this
// graph as it goes. This serves the explorer locally and gives the assistant two
// verbs: push a set of nodes into the window, and read back what the person did
// with them. The window is for the person — a way past the assistant's own
// sentences into the material itself — not a debug trace.
//
// Zero dependencies, one process, Ctrl-C to stop. Serving the site locally is
// also what makes the inline note reader work without any CORS contortions.
//
//   node tools/companion.mjs            # start it
//   node tools/show.mjs <id> …          # push nodes (starts this if needed)
//   node tools/show.mjs --activity      # what the person opened since last asked
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.env.ASKG_ROOT ?? 'public');
const PORT = Number(process.env.ASKG_PORT ?? 7777);

// The built pages carry the published base path in their absolute URLs
// (/AS-KG/typed-graph/explorer.js and so on), so serve on that prefix rather
// than rewriting the build. Read it from the site config; fall back to root.
const BASE = (() => {
  try {
    const m = /^\s*baseUrl:\s*"?([^"\s#]+)"?/m.exec(fs.readFileSync('quartz.config.yaml', 'utf8'));
    if (!m) return '';
    return new URL('https://' + m[1].replace(/^https?:\/\//, '')).pathname.replace(/\/$/, '');
  } catch { return ''; }
})();
const MAX_HISTORY = 40;
const MAX_ACTIVITY = 200;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.tsv': 'text/tab-separated-values; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

/* --------------------------------------------------------------------- state */

let current = { nodes: [], why: '', depth: 1, at: null, turn: 0 };
const history = [];    // what was shown before, newest last
const activity = [];   // what the person did, drained by the assistant
const clients = new Set();

const sse = (res, event, data) => {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};
const broadcast = (event, data) => {
  for (const c of [...clients]) {
    try { sse(c, event, data); } catch { clients.delete(c); }
  }
};

/* --------------------------------------------------------------------- utils */

const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

const readBody = (req) => new Promise((ok, fail) => {
  let b = '';
  req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); });
  req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { fail(e); } });
  req.on('error', fail);
});

/* Static files, with the two resolutions GitHub Pages does and Node does not:
 * a directory means its index.html, and /foo means foo.html. Kept inside ROOT. */
function resolveFile(urlPath) {
  let p = urlPath.split('?')[0];
  if (BASE && (p === BASE || p.startsWith(BASE + '/'))) p = p.slice(BASE.length) || '/';
  const clean = decodeURIComponent(p).replace(/\/+$/, '') || '/';
  const base = path.normalize(path.join(ROOT, clean));
  if (!base.startsWith(ROOT)) return null;                      // no climbing out
  for (const candidate of [base, base + '.html', path.join(base, 'index.html')]) {
    try { if (fs.statSync(candidate).isFile()) return candidate; } catch { /* next */ }
  }
  return null;
}

/* ------------------------------------------------------------------- routing */

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';

  if (url.startsWith('/companion/')) {
    const route = url.split('?')[0];

    if (route === '/companion/ping') {
      return json(res, 200, { ok: true, root: ROOT, base: BASE, showing: current.nodes.length, viewers: clients.size });
    }

    if (route === '/companion/state') {
      return json(res, 200, { current, history: history.slice(-MAX_HISTORY) });
    }

    if (route === '/companion/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      });
      res.write(': companion\n\n');
      clients.add(res);
      if (current.nodes.length) sse(res, 'show', current);
      const beat = setInterval(() => { try { res.write(': beat\n\n'); } catch { /* gone */ } }, 25000);
      req.on('close', () => { clearInterval(beat); clients.delete(res); });
      return undefined;
    }

    if (route === '/companion/show' && req.method === 'POST') {
      let b;
      try { b = await readBody(req); } catch { return json(res, 400, { error: 'bad json' }); }
      const nodes = Array.isArray(b.nodes) ? b.nodes.map(String).filter(Boolean).slice(0, 40) : [];
      if (!nodes.length) return json(res, 400, { error: 'nodes is required' });
      if (current.nodes.length) history.push(current);
      while (history.length > MAX_HISTORY) history.shift();
      current = {
        nodes,
        why: String(b.why ?? '').slice(0, 300),
        depth: [0, 1, 2].includes(Number(b.depth)) ? Number(b.depth) : 1,
        at: new Date().toISOString(),
        turn: current.turn + 1,
      };
      broadcast('show', current);
      return json(res, 200, { ok: true, showing: nodes.length, viewers: clients.size, turn: current.turn });
    }

    if (route === '/companion/activity' && req.method === 'POST') {
      let b;
      try { b = await readBody(req); } catch { return json(res, 400, { error: 'bad json' }); }
      activity.push({
        kind: String(b.kind ?? 'unknown').slice(0, 32),
        node: b.node ? String(b.node).slice(0, 200) : null,
        text: b.text ? String(b.text).slice(0, 200) : null,
        at: new Date().toISOString(),
      });
      while (activity.length > MAX_ACTIVITY) activity.shift();
      return json(res, 200, { ok: true });
    }

    if (route === '/companion/activity') {
      // Draining is the default: the assistant asks "what happened since I last
      // asked", and a second call should not repeat itself.
      const peek = /[?&]peek=1/.test(url);
      const out = activity.slice();
      if (!peek) activity.length = 0;
      return json(res, 200, { activity: out });
    }

    return json(res, 404, { error: 'no such companion route' });
  }

  if (url === '/' || url === '' || url === BASE || url === BASE + '/') {
    res.writeHead(302, { location: `${BASE}/typed-graph/` });
    return res.end();
  }

  const file = resolveFile(url);
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('not found');
  }
  res.writeHead(200, {
    'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  return fs.createReadStream(file).pipe(res);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`port ${PORT} is already in use — the companion may already be running.`);
    console.error(`check with:  curl -s http://localhost:${PORT}/companion/ping`);
    process.exit(2);
  }
  throw err;
});

if (!fs.existsSync(ROOT)) {
  console.error(`no built site at ${ROOT}.`);
  console.error('build it first (npx quartz build, then the scripts/ builders), or set ASKG_ROOT.');
  process.exit(1);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`companion  http://localhost:${PORT}${BASE}/typed-graph/`);
  console.log(`  serving  ${ROOT}${BASE ? ` at ${BASE}` : ''}`);
  console.log(`  show     node tools/show.mjs <node-id> [more…] --why "one line"`);
  console.log(`  read     node tools/show.mjs --activity`);
});
