// Client-side flow runner. Deliberately deterministic: the same questions in the
// same order for everyone, nothing inferred, nothing sent anywhere. Answers live
// in memory only and die with the tab.
let DATA, flow = null, stepId = null, history = [], answers = {};
const app = () => document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const nl = (s) => esc(s).replace(/\n/g, '<br>');

fetch('__BASE__/static/flows.json').then((r) => r.json()).then((d) => {
  DATA = d;
  addEventListener('hashchange', route);
  route();
});

function route() {
  const id = location.hash.replace(/^#/, '');
  const f = DATA.flows.find((x) => x.id === id);
  if (f) start(f); else index();
}

function index() {
  flow = null;
  app().innerHTML = `<h1>Toolbox</h1>
    <p class="lede">Eight sets of questions for the moments when a pattern is running and it is hard to tell
    what is actually happening. They do not give advice and they do not tell you what you are —
    they help you separate what you saw from what you concluded, and hand you back your own words.</p>
    ${DATA.flows.map((f) => `<div class="card" onclick="location.hash='${f.id}'">
      <h3>${esc(f.title)}</h3><p>${esc(f.blurb)}</p></div>`).join('')}
    <p class="cites" style="margin-top:22px">Before using any of these, it is worth reading
    <a href="/moc/how-not-to-use-this">how not to use this</a>.</p>`;
}

function start(f) { flow = f; stepId = f.steps[0].id; history = []; answers = {}; render(); }
const step = () => flow.steps.find((s) => s.id === stepId);

function go(next, value) {
  if (value !== undefined) answers[stepId] = value;
  history.push(stepId); stepId = next; render(); scrollTo(0, 0);
}
function back() { if (history.length) { stepId = history.pop(); render(); } }

function cites(s) {
  if (!s.cites?.length) return '';
  const links = s.cites.map((c) => {
    const p = DATA.nodes[c.toLowerCase()];
    return p ? `<a href="/${p}">${esc(c)}</a>` : esc(c);
  });
  return `<div class="cites">In the graph: ${links.join(' · ')}</div>`;
}

function render() {
  const s = step();
  const i = flow.steps.indexOf(s), pct = Math.round(((i + 1) / flow.steps.length) * 100);
  const head = `<div class="prog"><i style="width:${pct}%"></i></div>`;
  const nav = `<div class="nav">${history.length ? '<button class="ghost" onclick="back()">Back</button>' : ''}
    <button class="ghost" onclick="location.hash=''">Leave this</button></div>`;
  let body = '';

  if (s.kind === 'scale') {
    body = `<p class="q">${nl(s.ask)}</p>${s.help ? `<div class="help">${nl(s.help)}</div>` : ''}
      <div class="scale">${[1,2,3,4,5,6,7,8,9,10].map((n) => `<button onclick="pick(${n})">${n}</button>`).join('')}</div>`;
  } else if (s.kind === 'choice') {
    body = `<p class="q">${nl(s.ask)}</p>${s.help ? `<div class="help">${nl(s.help)}</div>` : ''}
      ${s.options.map((o, k) => `<button class="opt" onclick="opt(${k})">${esc(o.label)}</button>`).join('')}`;
  } else if (s.kind === 'text') {
    body = `<p class="q">${nl(s.ask)}</p>${s.help ? `<div class="help">${nl(s.help)}</div>` : ''}
      <textarea id="t" placeholder="Take your time."></textarea>
      <div class="nav"><button class="go" onclick="go('${s.goto}', document.getElementById('t').value)">Continue</button></div>`;
  } else if (s.kind === 'split') {
    body = `<label class="fld">${esc(s.ask_a)}</label>${s.help_a ? `<div class="help">${nl(s.help_a)}</div>` : ''}
      <textarea id="a"></textarea>
      <label class="fld" style="margin-top:20px">${esc(s.ask_b)}</label>${s.help_b ? `<div class="help">${nl(s.help_b)}</div>` : ''}
      <textarea id="b"></textarea>
      <div class="nav"><button class="go" onclick="go('${s.goto}', {a:document.getElementById('a').value, b:document.getElementById('b').value})">Continue</button></div>`;
  } else if (s.kind === 'reflect') {
    const prev = Object.values(answers).find((v) => v && v.a !== undefined);
    body = `${prev ? `<div class="pair"><b>What you saw</b><div>${nl(prev.a) || '—'}</div></div>
      <div class="pair"><b>What you concluded</b><div>${nl(prev.b) || '—'}</div></div>` : ''}
      <p class="q" style="font-size:17px;color:var(--text-secondary)">${nl(s.say)}</p>
      <div class="nav"><button class="go" onclick="go('${s.goto}')">Continue</button></div>`;
  } else if (s.kind === 'stop') {
    body = `<div class="stop"><h2>${esc(s.title ?? 'Stop here')}</h2><p>${nl(s.say)}</p></div>`;
  } else if (s.kind === 'end') {
    body = `<p class="q">${nl(s.say)}</p>${summary()}`;
  }
  app().innerHTML = head + body + cites(s) + (s.kind === 'scale' || s.kind === 'choice' ? nav : s.kind === 'stop' || s.kind === 'end' ? nav : '');
}

function pick(n) {
  const s = step();
  const b = s.branches.find((x) => x.when !== '*' && matches(x.when, n)) ?? s.branches.find((x) => x.when === '*');
  go(b.goto, n);
}
const matches = (when, n) => {
  const m = /^(>=|<=|>|<)(\d+)$/.exec(when); if (!m) return false;
  const v = +m[2];
  return { '>=': n >= v, '<=': n <= v, '>': n > v, '<': n < v }[m[1]];
};
function opt(k) { const o = step().options[k]; go(o.goto, { label: o.label, names: o.names }); }

function summary() {
  const rows = [];
  for (const [id, v] of Object.entries(answers)) {
    const s = flow.steps.find((x) => x.id === id); if (!s) continue;
    if (v && v.a !== undefined) {
      rows.push([s.ask_a, v.a], [s.ask_b, v.b]);
    } else if (v && v.label) {
      rows.push([s.ask, v.label + (v.names ? ` — ${v.names}` : '')]);
    } else if (typeof v === 'string' && v.trim()) {
      rows.push([s.ask, v]);
    } else if (typeof v === 'number') {
      rows.push([s.ask, String(v)]);
    }
  }
  return rows.map(([q, a]) => `<div class="pair"><b>${esc(q)}</b><div>${nl(a) || '—'}</div></div>`).join('')
    + `<div class="nav"><button class="go" onclick="copy()">Copy this</button>
       <button class="ghost" onclick="location.hash=''">Done</button></div>
       <textarea id="cp" style="position:absolute;left:-9999px"></textarea>`;
}
function copy() {
  const text = [...document.querySelectorAll('.pair')].map((p) =>
    `${p.querySelector('b').textContent}\n${p.querySelector('div').innerText}`).join('\n\n');
  const t = document.getElementById('cp'); t.value = text; t.select();
  document.execCommand('copy');
  event.target.textContent = 'Copied';
}
