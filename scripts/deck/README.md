# The decks

Two, both generated — every number, gloss, loop and mirror pair is pulled from
the graph, so neither can quietly go stale and the two cannot disagree.

    Attachment-Knowledge-Graph.pptx   deck.js    32 slides · read alone
    AS-KG-Overview.pptx               short.js   11 slides · stood up and presented

They are not the same deck at two lengths. The long one is an extended readme:
full paragraphs, meant to be sent to someone who will read it without you there.
The short one is the project at readme depth, one idea a slide, with the detail
in the speaker notes — a slide that reads well alone is too full to talk over.

## Rebuilding it

```bash
node scripts/build-typed-graph.mjs          # both decks read the graph data
node scripts/deck/deck-data.mjs > deck-data.json
node scripts/deck/deck.js                   # the long one; needs pptxgenjs
node scripts/deck/short.js                  # the short one
```

`short.js` repeats the chrome from `deck.js` — the palette, `slide()`,
`heading()`, `card()`, `stat()`. Two copies of eighty lines is the cheaper
mistake here: a shared module would have to serve two deliberately different
looks, and the decks are meant to drift apart in layout while agreeing on every
number, which `deck-data.json` already guarantees.

`deck-data.mjs` pulls the material: the top nodes of each type with their
glosses and lens maps, the detected loops, the strongest mirror pairs, the
markers, and the counts. `deck.js` lays it out.

Three screenshots are embedded, in `scripts/deck/assets/`:

    deck-explore.png      one node and its neighbourhood, note expanded
    deck-discussion.png   a pushed set, with the "picked for you" banner
    deck-loop.png         a loop drawn as a loop, cropped to the drawing

Regenerate them by serving `public/` and loading `/typed-graph/`. Shoot at about
1900px wide — larger only inflates the .pptx, which is committed. Crop the loop
shot to the drawing itself; the surrounding chrome is not what it is about.

`pptxgenjs` is the only dependency and it is deliberately not in `package.json`:
the site build has zero runtime dependencies and this keeps it that way. Install
it when you need to rebuild the deck.

## Structure

Two parts, held apart by the divider slides:

  - **Part one — the project, and how to use it.** What it is, what is in it,
    how it is built, and the three ways in: the explorer, the toolbox, and an
    assistant run locally. Ends on the rules and on what this is not.
  - **Part two — inside the graph.** The kinds of node, the most-cited few of
    each, the loops, the mirror pairs, and the four lenses.

Every count in the prose is read out of `deck-data.json` rather than typed in —
several had already drifted by the time this was split.

## What the long deck is for

An extended readme. It explains what the project is, how it was built, what is
in the graph, and what the whole thing is ultimately for — an assistant that can
teach the pattern with receipts, inside constraints it cannot talk its way out
of. It is meant to be sent to someone rather than presented.
