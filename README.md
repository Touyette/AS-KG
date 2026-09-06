# Attachment Theory — Knowledge Graph

A knowledge graph of the ideas in [Heidi Priebe's](https://www.youtube.com/@heidipriebe1)
work on attachment theory: styles, strategies, triggers, beliefs, developmental
origins and practices, linked by typed relationships.

This is a derivative index of her work. All credit for the ideas belongs to her.
Notes here paraphrase her framing in our own words and never reproduce transcript
text — every claim links back to the moment in the source video where she makes
it. The intent is to help people navigate and re-find her material, not to replace
watching it.

## What makes this different from a link graph

Quartz's built-in graph treats every link the same. Here the edges carry meaning,
which lets the site show three things an ordinary wiki cannot:

**Typed relationships.** Fifteen predicates with enforced domain and range —
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

    content/         the notes, one per node, plus one per video and the MOCs
    _meta/           schema.md (the authoring contract) and vocabulary.yaml
    scripts/         validator, graph builder, transcript ingest, page builder
    transcripts/     raw captions — gitignored, never published

## Working on it

    npm install --legacy-peer-deps
    npm run validate      # enforce _meta/schema.md; fails on any bad edge
    npx quartz build --serve

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
graph.
