"""Write notes from a JSON batch. Keeps authoring data separate from formatting
so every note comes out in exactly the shape _meta/schema.md specifies."""
import json, os, sys, re

# Author-time schema check. The validator catches these after the fact; catching
# them here means a bad batch never reaches content/ in the first place.
SCHEMA = json.load(open('_meta/schema.json', encoding='utf-8'))
def check(batch):
    types = {n['path'].split('/')[-1]: n['type'] for n in batch['notes']}
    problems = []
    for n in batch['notes']:
        for rel in n['rels']:
            pred, target = rel[0], rel[1]
            spec = SCHEMA['predicates'].get(pred)
            if not spec:
                problems.append(f"{n['path']}: unknown predicate '{pred}'"); continue
            dom = spec['domain']
            if dom != '*' and n['type'] not in dom:
                problems.append(f"{n['path']}: {pred} not allowed from '{n['type']}' (needs {'|'.join(dom)})")
    return problems



# Resolve link targets against what is already on disk plus what this batch adds.
# The validator catches a broken [[link]] after the fact; catching it here stops
# a batch from landing half-wired.
import glob
def _keys():
    ks = {}
    for fn in glob.glob('content/**/*.md', recursive=True):
        path = fn[len('content/'):-3].replace(os.sep, '/')
        txt = open(fn, encoding='utf-8').read()
        ks[path.lower()] = path
        m = re.search(r'^title:\s*(.+)$', txt, re.M)
        if m: ks[m.group(1).strip().lower()] = path
        m = re.search(r'^aliases:\s*\[(.*)\]\s*$', txt, re.M)
        if m:
            for a in m.group(1).split(','):
                a = a.strip()
                if a: ks.setdefault(a.lower(), path)
    return ks

def _types():
    ts = {}
    for fn in glob.glob('content/**/*.md', recursive=True):
        path = fn[len('content/'):-3].replace(os.sep, '/')
        m = re.search(r'^type:\s*(\S+)$', open(fn, encoding='utf-8').read(), re.M)
        if m: ts[path] = m.group(1)
    return ts

def check_links(batch):
    ks = _keys()
    ts = _types()
    for n in batch['notes']:
        ks[n['path'].lower()] = n['path']
        ks[n['title'].strip().lower()] = n['path']
        for a in n['aliases']: ks[a.strip().lower()] = n['path']
        ts[n['path']] = n['type']
    bad = []
    for n in batch['notes']:
        for rel in n['rels']:
            key = rel[1].split('|')[0].strip().lower()
            if key not in ks:
                bad.append(f"{n['path']}: unresolved [[{rel[1]}]]"); continue
            tgt = ks[key]
            spec = SCHEMA['predicates'].get(rel[0])
            rng = spec.get('range') if spec else None
            if rng and rng != '*' and tgt in ts and ts[tgt] not in rng:
                bad.append(f"{n['path']}: {rel[0]} -> {tgt} is '{ts[tgt]}' (range needs {'|'.join(rng)})")
    return bad


LENS = {
 'DA':  {'dismissive-avoidant':'core','anxious-preoccupied':'absent','fearful-avoidant':'alternating','secure':'absent'},
 'DAF': {'dismissive-avoidant':'core','anxious-preoccupied':'feared','fearful-avoidant':'alternating','secure':'absent'},
 'AP':  {'dismissive-avoidant':'absent','anxious-preoccupied':'core','fearful-avoidant':'alternating','secure':'absent'},
 'FA':  {'dismissive-avoidant':'alternating','anxious-preoccupied':'alternating','fearful-avoidant':'core','secure':'absent'},
 'SEC': {'dismissive-avoidant':'absent','anxious-preoccupied':'absent','fearful-avoidant':'absent','secure':'secure-form'},
 'ALL': {'dismissive-avoidant':'core','anxious-preoccupied':'core','fearful-avoidant':'core','secure':'secondary'},
}

def link(vid, s):
    return f"https://youtu.be/{vid}?t={s}", f"{s//60}:{s%60:02d}"

batch = json.load(open(sys.argv[1], encoding='utf-8'))
bad = check(batch) + check_links(batch)
if bad:
    print('refusing to write — schema violations:')
    for b in bad: print('   ' + b)
    sys.exit(1)
vid, vpath, vtitle = batch['video_id'], batch['video_path'], batch['video_title']
for n in batch['notes']:
    fn = f"content/{n['path']}.md"
    os.makedirs(os.path.dirname(fn), exist_ok=True)
    rels = []
    for rel in n['rels']:
        pred, target = rel[0], rel[1]
        sec = rel[2] if len(rel) > 2 else None   # provenance timestamp is optional
        url, lbl = link(vid, sec) if sec else (None, None)
        rels.append(f"- **{pred}** → [[{target}]]" + (f" · [{lbl}]({url})" if sec else ""))
    if not any('described_in' in r for r in rels):
        first = n['rels'][0]
        url, lbl = link(vid, (first[2] if len(first) > 2 else None) or 2)
        rels.append(f"- **described_in** → [[{vpath}|{vtitle}]] · [{lbl}]({url})")
    lens = LENS[n['lens']]
    open(fn, 'w', encoding='utf-8').write(
        "---\n"
        f"title: {n['title']}\ntype: {n['type']}\n"
        f"aliases: [{', '.join(n['aliases'])}]\n"
        f"attribution: {n['attribution']}\ndomain: attachment\nactor: {n.get('actor','self')}\nmarker: {str(n.get('marker', False)).lower()}\n" 
        "lens:\n" + ''.join(f"  {k}: {v}\n" for k, v in lens.items()) +
        "status: reviewed\n---\n\n"
        f"{n['summary']}\n\n## Relationships\n\n" + "\n".join(rels) + "\n")
print(f"wrote {len(batch['notes'])} notes")
