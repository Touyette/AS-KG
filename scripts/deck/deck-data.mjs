import fs from 'node:fs';
const G = JSON.parse(fs.readFileSync('public/static/typed-graph-data.json','utf8'));
const byId = new Map(G.nodes.map(n=>[n.id,n]));
const w = n => (n.citations||0)*2 + n.degree*0.25;
const top = (type, k=4) => G.nodes.filter(n=>n.type===type).sort((a,b)=>w(b)-w(a)).slice(0,k)
  .map(n=>({t:n.title, g:n.gloss, c:n.citations, d:n.degree, lens:n.lens?Object.entries(n.lens).filter(([,v])=>v!=='absent').map(([k2,v])=>k2.split('-')[0]+':'+v).join(' '):''}));
const out = {};
for (const t of ['strategy','state','belief','behavior','trigger','origin','practice','concept','style']) out[t]=top(t, t==='trigger'?4:4);
out.cycles = G.cycles.map(c=>({len:c.length, nodes:c.nodes.map(i=>byId.get(i).title)}));
// mirrors pairs, ranked
const mir = G.edges.filter(e=>e.predicate==='mirrors' && !e.derived)
  .map(e=>({a:byId.get(e.source),b:byId.get(e.target)}))
  .sort((x,y)=>(w(y.a)+w(y.b))-(w(x.a)+w(x.b))).slice(0,8)
  .map(p=>`${p.a.title} (${p.a.type}) ⟷ ${p.b.title} (${p.b.type})`);
out.mirrors = mir;
out.markers = G.nodes.filter(n=>n.marker).sort((a,b)=>w(b)-w(a)).slice(0,6).map(n=>`${n.title} — ${n.gloss}`);
out.counts = G.counts;
// a fully-worked node
const ex = byId.get('strategies/hyperactivating-strategies') || byId.get('strategies/affect-suppression');
out.example = { ...ex, rels: G.edges.filter(e=>e.source===ex.id && !e.derived).map(e=>`${e.predicate} → ${byId.get(e.target).title}${e.src?` @${e.src.seconds}s`:''}`) };
// attribution split
out.attribution = {};
for (const n of G.nodes) out.attribution[n.attribution??'none'] = (out.attribution[n.attribution??'none']??0)+1;
// videos
out.videos = G.nodes.filter(n=>n.type==='video').length;
console.log(JSON.stringify(out,null,1));
