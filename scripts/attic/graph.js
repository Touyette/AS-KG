const GROUP = {
  triggers:'mechanism', deactivates:'mechanism', manifests_as:'mechanism',
  defends_against:'structure', sustains:'structure', originates_in:'structure', characterizes:'structure',
  healed_by:'healing', regulates:'healing', requires:'healing',
  mirrors:'compare', contrasts_with:'compare', mistaken_for:'compare', part_of:'compare',
  derived_from:'structure',
};
const PROV = new Set(['described_in']);   // timestamped citation only; lineage is drawn
const SVGNS = 'http://www.w3.org/2000/svg';
const el = (t,a={}) => { const n=document.createElementNS(SVGNS,t);
  for(const k in a) n.setAttribute(k,a[k]); return n; };
const mmss = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

let D, N, L, byId, state = { lens:'all', groups:new Set(['mechanism','structure','healing']), q:'', sel:null, cycle:null, hover:null };

fetch('../static/typed-graph-data.json').then(r=>r.json()).then(data=>{ D=data; init(); });

function init(){
  byId = new Map(D.nodes.map(n=>[n.id,n]));
  // Provenance is not drawn: 68 citation edges would swamp the mechanism. It
  // lives in the detail panel instead, where the timestamps are actually usable.
  N = D.nodes.filter(n=>n.type!=='video');
  const ok = new Set(N.map(n=>n.id));
  L = D.edges.filter(e=>!PROV.has(e.predicate) && ok.has(e.source) && ok.has(e.target) && !e.derived);
  const prov = D.edges.filter(e => PROV.has(e.predicate)).length;
  document.getElementById('counts').textContent =
    `${N.length} concepts · ${L.length} relationships drawn · ${prov} source citations · ` +
    `${D.cycles.length} loops · hover any node to read it`;
  layout(); renderCycles(); draw(); wire(); buildTable();
}

// --- force layout ----------------------------------------------------------
// Deliberately conservative: repulsion is capped, each step is capped, and the
// whole thing cools. An uncapped inverse-square force blows the graph apart and
// pins every node to the frame, which is exactly what happened before.
function layout(){
  // Retuned for ~540 drawn nodes: the frame grew with the corpus, and the
  // parameters were swept against measured overlap and crowding rather than eyeballed.
  const W=1600, H=1060, REP=6500, LINK=210, SPRING=0.055, MAXF=1.8, MAXSTEP=14;
  const CUT=542, PULLX=0.0008, PULLY=0.028, TICKS=640;
  const deg=new Map();
  L.forEach(e=>{deg.set(e.source,(deg.get(e.source)||0)+1);deg.set(e.target,(deg.get(e.target)||0)+1);});
  N.forEach((n,i)=>{ const a=i/N.length*Math.PI*2, r=180+((i*37)%140);
    n.x=W/2+Math.cos(a)*r*1.45; n.y=H/2+Math.sin(a)*r*0.8;
    n.vx=0; n.vy=0; n.deg=deg.get(n.id)||0;
    n.r = 6.5 + Math.min(8, Math.sqrt(n.citations||0)*2.8) + Math.min(4, n.deg*0.22);
  });
  const idx=new Map(N.map((n,i)=>[n.id,i]));
  const links=L.map(e=>[idx.get(e.source),idx.get(e.target)]).filter(p=>p[0]!=null&&p[1]!=null);

  for(let t=0;t<TICKS;t++){
    const alpha=Math.max(0.05, 1-t/TICKS);
    for(let i=0;i<N.length;i++) for(let j=i+1;j<N.length;j++){
      const a=N[i], b=N[j];
      let dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy);
      if(d>CUT) continue;
      if(d<0.5){ dx=(Math.random()-0.5); dy=(Math.random()-0.5); d=1; }
      let f=REP/(d*d); if(f>MAXF) f=MAXF;      // cap: no singularity at close range
      dx/=d; dy/=d;
      a.vx-=dx*f; a.vy-=dy*f; b.vx+=dx*f; b.vy+=dy*f;
    }
    for(const [i,j] of links){
      const a=N[i], b=N[j];
      let dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||0.01;
      const f=(d-LINK)*SPRING*alpha; dx/=d; dy/=d;
      a.vx+=dx*f; a.vy+=dy*f; b.vx-=dx*f; b.vy-=dy*f;
    }
    for(const n of N){
      n.vx+=(W/2-n.x)*PULLX*alpha; n.vy+=(H/2-n.y)*PULLY*alpha;
      let vx=n.vx, vy=n.vy, sp=Math.hypot(vx,vy);
      if(sp>MAXSTEP){ vx=vx/sp*MAXSTEP; vy=vy/sp*MAXSTEP; }   // cap the step
      n.x+=vx; n.y+=vy; n.vx*=0.78; n.vy*=0.78;
    }
  }

  // Fit to the frame once, at the end — never clamp mid-run, which is what
  // stacked every node onto the boundary last time.
  const xs=N.map(n=>n.x), ys=N.map(n=>n.y);
  const x0=Math.min(...xs), x1=Math.max(...xs), y0=Math.min(...ys), y1=Math.max(...ys);
  const sx=(W-170)/Math.max(1,x1-x0), sy=(H-100)/Math.max(1,y1-y0), k=Math.min(sx,sy);
  const cx=(x0+x1)/2, cy=(y0+y1)/2;
  for(const n of N){ n.x=W/2+(n.x-cx)*k; n.y=H/2+(n.y-cy)*k; }

  // Labelling all 400 at once is unreadable; only the load-bearing nodes are
  // labelled at rest, the rest appear on hover, search, selection or a loop.
  // Importance picks the candidates; a greedy box test decides which of them
  // actually fit, so a label is never drawn on top of another one.
  const rank=[...N].sort((a,b)=>(b.citations*2+b.deg)-(a.citations*2+a.deg));
  const boxes=[];
  const hits=(a,b)=>!(a.x1<b.x0||b.x1<a.x0||a.y1<b.y0||b.y1<a.y0);
  N.forEach(n=>{ n.keyNode=false; });
  for(const n of rank.slice(0,75)){
    const txt = n.title.length>26 ? n.title.slice(0,25)+'\u2026' : n.title;
    const w = txt.length*7.1+22, h=26, cy = n.y-n.r-5-9;
    const box={x0:n.x-w/2, x1:n.x+w/2, y0:cy-h/2, y1:cy+h/2};
    if(box.x0<4||box.x1>W-4||box.y0<4) continue;
    if(boxes.some(b=>hits(box,b))) continue;
    boxes.push(box); n.keyNode=true;
  }
}

function draw(){
  const svg=document.getElementById('svg');
  svg.setAttribute('viewBox','0 0 1600 1060'); svg.innerHTML='';
  const gE=el('g'), gN=el('g'); svg.append(gE,gN);
  for(const e of L){
    const a=byId.get(e.source), b=byId.get(e.target); if(!a||!b) continue;
    const p=el('path',{class:`edge ${GROUP[e.predicate]} ${e.predicate}`});
    const mx=(a.x+b.x)/2, my=(a.y+b.y)/2, dx=b.x-a.x, dy=b.y-a.y;
    p.setAttribute('d',`M${a.x},${a.y} Q${mx-dy*0.09},${my+dx*0.09} ${b.x},${b.y}`);
    p.dataset.s=e.source; p.dataset.t=e.target; p.dataset.g=GROUP[e.predicate];
    const tip = el('title');
    tip.textContent = `${a.title} — ${e.predicate.replace(/_/g,' ')} → ${b.title}`;
    p.append(tip);
    gE.append(p); e._el=p;
  }
  for(const n of N){
    const g=el('g',{class:'node'}); g.dataset.id=n.id;
    const sh = n.actor==='partner'
      ? el('rect',{x:n.x-n.r,y:n.y-n.r,width:n.r*2,height:n.r*2,rx:2,class:'n-shape partner'})
      : el('circle',{cx:n.x,cy:n.y,r:n.r,class:'n-shape'});
    const tx=el('text',{x:n.x,y:n.y-n.r-5,'text-anchor':'middle',class:'n-label'});
    tx.textContent = n.title.length>26 ? n.title.slice(0,25)+'…' : n.title;
    g.append(sh,tx);
    g.addEventListener('click',()=>select(n.id));
    g.addEventListener('mouseenter',()=>{ state.hover=n.id; apply(); });
    g.addEventListener('mouseleave',()=>{ state.hover=null; apply(); });
    gN.append(g); n._el=g;
  }
  apply();
}

function apply(){
  const q=state.q.toLowerCase();
  const inLens = n => state.lens==='all' || (n.lens && n.lens[state.lens] && n.lens[state.lens]!=='absent');
  const cyc = state.cycle!=null ? new Set(D.cycles[state.cycle].nodes) : null;
  const hot = new Set();
  if(state.sel){ hot.add(state.sel);
    L.forEach(e=>{ if(e.source===state.sel) hot.add(e.target); if(e.target===state.sel) hot.add(e.source); }); }
  for(const n of N){
    const vis = inLens(n) && (!cyc || cyc.has(n.id));
    const match = q && n.title.toLowerCase().includes(q);
    const dim = !vis || (q && !match) || (hot.size>0 && !hot.has(n.id));
    n._el.classList.toggle('dim', dim);
    n._el.classList.toggle('hot', match || (cyc&&cyc.has(n.id)) || n.id===state.sel || n.id===state.hover);
    // At rest only the load-bearing nodes are labelled; everything else earns a
    // label by being hovered, searched, selected, or part of the shown loop.
    const named = !dim && (n.keyNode || n.id===state.hover || n.id===state.sel
                  || match || (cyc&&cyc.has(n.id)) || (hot.size>0 && hot.has(n.id)));
    n._el.classList.toggle('lbl', !!named);
  }
  for(const e of L){
    const a=byId.get(e.source), b=byId.get(e.target);
    const gOn = state.groups.has(GROUP[e.predicate]);
    let vis = gOn && inLens(a) && inLens(b);
    let isCyc=false;
    if(cyc){ const ns=D.cycles[state.cycle].nodes;
      for(let i=0;i<ns.length;i++) if(ns[i]===e.source && ns[(i+1)%ns.length]===e.target) isCyc=true;
      vis = isCyc; }
    e._el.classList.toggle('dim', !vis || (hot.size>0 && !(hot.has(e.source)&&hot.has(e.target))));
    e._el.classList.toggle('hot', isCyc);
  }
}

// --- detail panel: this is where provenance lives -----------------------------
function select(id){
  state.sel = state.sel===id ? null : id; state.cycle=null; apply(); renderCycles();
  const box=document.getElementById('detail');
  if(!state.sel){ box.innerHTML='<h2>Selection</h2><p class="s" id="hint">Click any node to see its typed relationships and the moments in the videos they come from.</p>'; return; }
  const n=byId.get(id);
  const out=D.edges.filter(e=>e.source===id && !e.derived);
  const inc=D.edges.filter(e=>e.target===id && !e.derived && !PROV.has(e.predicate));
  const src=out.filter(e=>PROV.has(e.predicate));
  const rel=out.filter(e=>!PROV.has(e.predicate));
  const lens=n.lens ? Object.entries(n.lens).filter(([,v])=>v!=='absent')
    .map(([k,v])=>`${k.split('-')[0]}: ${v}`).join(' · ') : '';
  const row=(e,dir)=>`<li><span class="p">${dir}${e.predicate.replace(/_/g,' ')}</span><br>
    <a href="/${dir==='← ' ? e.source : e.target}">${(byId.get(dir==='← ' ? e.source : e.target)||{}).title||''}</a>
    ${e.src?` · <a href="https://youtu.be/${e.src.videoId}?t=${e.src.seconds}">${mmss(e.src.seconds)}</a>`:''}</li>`;
  box.innerHTML = `<h2>Selection</h2>
    <p class="t">${n.title}</p>
    <p class="meta">${n.type}${n.actor==='partner'?' · partner':''}${n.attribution?' · '+n.attribution:''}${lens?'<br>'+lens:''}</p>
    <p class="s"><a href="${n.url}">Open the note →</a></p>
    ${rel.length?`<ul>${rel.map(e=>row(e,'')).join('')}</ul>`:''}
    ${inc.length?`<ul>${inc.map(e=>row(e,'← ')).join('')}</ul>`:''}
    ${src.length?`<h2 style="margin-top:12px">Appears in</h2><ul>${src.map(e=>row(e,'')).join('')}</ul>`:''}`;
}

function renderCycles(){
  const box=document.getElementById('cycles');
  box.innerHTML = D.cycles.length ? '' : '<p class="s">No loops detected yet.</p>';
  D.cycles.forEach((c,i)=>{
    const b=document.createElement('div');
    b.className='cycle'; b.setAttribute('aria-pressed', state.cycle===i);
    b.innerHTML=`<b>${c.length}-step loop</b><span>${c.nodes.map(id=>(byId.get(id)||{}).title||id).join(' → ')} →</span>`;
    b.addEventListener('click',()=>{ state.cycle = state.cycle===i?null:i; state.sel=null; apply(); renderCycles(); });
    box.append(b);
  });
}

function wire(){
  document.getElementById('lens').addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b) return;
    state.lens=b.dataset.lens; state.cycle=null;
    [...e.currentTarget.children].forEach(x=>x.setAttribute('aria-pressed', x===b));
    apply();
  });
  document.getElementById('groups').addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b) return;
    const g=b.dataset.g, on=b.getAttribute('aria-pressed')==='true';
    on ? state.groups.delete(g) : state.groups.add(g);
    b.setAttribute('aria-pressed', !on); apply();
  });
  document.getElementById('q').addEventListener('input',e=>{ state.q=e.target.value; state.sel=null; apply(); });
  document.getElementById('view').addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b) return;
    const table = b.dataset.v==='table';
    [...e.currentTarget.children].forEach(x=>x.setAttribute('aria-pressed', x===b));
    document.getElementById('svg').hidden=table;
    document.getElementById('tablewrap').hidden=!table;
  });
}

// Relief for the contrast warning on the aqua slot, and the accessible route
// through the same data for anyone the force layout does not serve.
function buildTable(){
  const rows=L.map(e=>`<tr><td>${(byId.get(e.source)||{}).title||''}</td>
    <td>${e.predicate.replace(/_/g,' ')}</td><td>${(byId.get(e.target)||{}).title||''}</td>
    <td>${e.src?`<a href="https://youtu.be/${e.src.videoId}?t=${e.src.seconds}">${mmss(e.src.seconds)}</a>`:''}</td></tr>`).join('');
  document.getElementById('tablewrap').innerHTML =
    `<table><thead><tr><th>From</th><th>Relationship</th><th>To</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table>`;
}
