# The overview deck

`Attachment-Knowledge-Graph.pptx` at the repo root is generated, not hand-made —
every number, gloss, loop and mirror pair in it is pulled from the graph, so it
cannot quietly go stale.

## Rebuilding it

```bash
node scripts/build-typed-graph.mjs          # the deck reads the graph data
node scripts/deck/deck-data.mjs > deck-data.json
node scripts/deck/deck.js                   # needs pptxgenjs
```

`deck-data.mjs` pulls the material: the top nodes of each type with their
glosses and lens maps, the detected loops, the strongest mirror pairs, the
markers, and the counts. `deck.js` lays it out.

Two screenshots are embedded, in `scripts/deck/assets/`. Regenerate them by
serving `public/` and loading `/typed-graph/` with the left rail hidden — a
still of a scrolling panel always looks truncated, and it is not what either
picture is about.

`pptxgenjs` is the only dependency and it is deliberately not in `package.json`:
the site build has zero runtime dependencies and this keeps it that way. Install
it when you need to rebuild the deck.

## What the deck is for

An extended readme. It explains what the project is, how it was built, what is
in the graph, and what the whole thing is ultimately for — an assistant that can
teach the pattern with receipts, inside constraints it cannot talk its way out
of. It is meant to be sent to someone rather than presented.
