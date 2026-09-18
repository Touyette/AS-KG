# Attachment Theory — Knowledge Graph

A knowledge graph of the ideas in [Heidi Priebe's](https://www.youtube.com/@heidipriebe1)
work on attachment theory: styles, strategies, triggers, beliefs, developmental
origins and practices, linked by typed relationships.

**[Browse it →](https://touyette.github.io/AS-KG/)**

This is a derivative index of her work. All credit for the ideas belongs to her.
Notes here paraphrase her framing in our own words and never reproduce transcript
text — every claim links back to the moment in the source video where she makes
it. The intent is to help people navigate and re-find her material, not to replace
watching it.

## Two ways in

**Browse the graph** at [the site](https://touyette.github.io/AS-KG/typed-graph/).
It opens on one idea and draws its neighbourhood rather than everything at once.

**Run an assistant on it.** This is what the corpus is for, and it is also where
the situation flows live now — `flows/` holds the screening gates and stopping
conditions for twelve common situations, and the assistant works from them
rather than a web page walking you down a fixed branch. Clone the repo and
point Claude Code, Codex, or anything else that reads files at it:

    git clone https://github.com/touyette/AS-KG
    cd AS-KG

`AGENTS.md` is the briefing — what the material is for, what to read, what *not*
to read, and the rules that bind. `INDEX.md` is the 168 load-bearing nodes with
their typed links, so the first hop is already made; it is generated, so run
`node tools/index.mjs` if it is missing. `CLAUDE.md` points Claude Code at both.

Nothing is sent anywhere. `tools/companion.mjs` serves the graph locally so the
assistant can show you the nodes it is drawing on, and `journal/` is yours —
gitignored, never written to without asking.

## What makes this different from a link graph

Quartz's built-in graph treats every link the same. Here the edges carry meaning,
which lets the site show three things an ordinary wiki cannot:

**Typed relationships.** Sixteen predicates with enforced domain and range —
what `triggers` what, which strategy `defends_against` which fear, which practice
a pattern is `healed_by`, and which move in one style `mirrors` a move in another.

**Four lenses.** The same topology reads differently through each attachment
style. Fearful-avoidant is modelled as *oscillation* across the dismissive and
anxious subgraphs rather than as a third parallel set of nodes — and the graph
bears this out: the on-again/off-again loop runs through both the avoidant and
the anxious strategy nodes without containing a fearful-avoidant strategy at all.

**Loops.** Attachment patterns are cycles, and cycles are detected rather than
asserted. The search runs over the whole activation flow — a trigger fires a
strategy, the strategy surfaces as behaviour, the behaviour lands as a state that
fires the next trigger — because real loops alternate predicates rather than
repeating one.

## Layout

    AGENTS.md        the briefing an assistant reads first
    INDEX.md         the load-bearing nodes, generated from content/
    CLAUDE.md        a pointer to AGENTS.md, for Claude Code
    content/         the notes, one per node, plus one per video and the MOCs
    flows/           situation gates and stopping conditions, one JSON each
    _meta/           schema.md — the authoring contract — and the operating rules
    scripts/         validator, graph builder, transcript ingest, page builders
    scripts/deck/    the generated overview deck
    tools/           what an assistant runs locally: the companion window and the journal
    journal/         personal notes, gitignored — ships empty, stays on your machine
    transcripts/     raw captions — gitignored, never published

`Attachment-Knowledge-Graph.pptx` at the root is an extended readme in slide
form, generated from the graph — see `scripts/deck/README.md`.

Anything not in that list is generated: `public/`, `dist/`, `_build/` and
`node_modules/` are all rebuilt by the build and none of them are committed.

## Working on it

    npm install --legacy-peer-deps      # the flag matters: Quartz 5 has a peer conflict
    npm run validate                    # enforce _meta/schema.md; fails on any bad edge
    npm run site                        # the full build: notes, graph, flows, agent kit
    node tools/index.mjs                # regenerate INDEX.md after adding notes

`node tools/index.mjs --check` fails if `INDEX.md` has drifted from `content/`,
and runs in CI for that reason.

The typed graph page is generated separately and is not part of `--serve`'s live
reload. To preview it against a finished build:

    npx quartz build && npm run typed-graph && node scripts/build-typed-graph-page.mjs
    npx serve public

### Transcripts

Captions are working input for locating and timestamping ideas. They are never
committed and never published.

    yt-dlp --skip-download --write-auto-subs --write-subs --sub-langs "en.*" \
      --sub-format vtt --write-info-json --ignore-errors \
      -o "transcripts/%(id)s.%(ext)s" "<playlist url>"
    npm run ingest

`ingest` prefers a human-written caption track over auto-captions, removes the
rolling-window duplication auto-captions produce, splits on chapter markers where
they exist, and windows the rest at 120 seconds.

## Deployment

Pushing to `main` or `AS-KG` runs `.github/workflows/deploy.yml`, which validates the graph
against the schema, builds the site, generates the typed graph, and publishes to
GitHub Pages. A schema violation fails the build rather than shipping a broken
graph. `scripts/check-site.mjs` then checks the published HTML rather than the
data, because every defect this site has shipped was one the validator could not
see.

## Built on Quartz

The site itself is [Quartz 5](https://quartz.jzhao.xyz) by jackyzha0, MIT
licensed — hence the upstream author and repository fields still in
`package.json`. Everything in the list above is ours; everything under
`quartz/` is theirs.
