# Schema

> **Reconstructed 2026-09-06.** The original was lost when the working tree was
> discarded before its first commit. The predicate table, lens values and actor
> values below are generated from `scripts/schema.mjs`, which survived, so they
> are exact. The prose is a reconstruction of the reasoning, written from the
> decisions the code and the corpus actually encode.

## Source policy

Transcripts are working input only. They live in `transcripts/`, are gitignored,
and are never published. No note reproduces transcript text. Every note
paraphrases, and every claim carries a `described_in` edge with the video and the
timestamp it came from.

The site is an index into Heidi Priebe's corpus, not a replacement for it.

## Node types

    concept · state · behavior · belief · strategy · practice
    trigger · origin · style · source · video

Healing markers are not a type — they are `state` or `behavior` nodes with
`marker: true`. Borrowed frameworks are not a type — they are `concept` with
`attribution: literature` and a `derived_from` edge.

## Predicates (closed set)

Author one direction only; backlinks supply the inverse. The build materialises
reciprocals for the symmetric predicates. Domain and range are enforced by
`scripts/validate.mjs`, and again at author time by `scripts/authoring/mknote.py`,
which refuses a batch rather than writing a bad edge.

### activation

    triggers         trigger|state|behavior                        ->  state|strategy
    deactivates      strategy|practice                             ->  state|strategy
    regulates        practice|strategy                             ->  state

### defense

    defends_against  strategy|belief                               ->  state|belief
    manifests_as     strategy|state|practice                       ->  behavior
    sustains         belief                                        ->  strategy
    originates_in    strategy|belief|style|state|behavior|concept  ->  origin

### identity

    characterizes    strategy|belief|behavior|trigger|state|concept ->  style
    mirrors          any                                           ->  any   (symmetric)
    contrasts_with   any                                           ->  any   (symmetric)
    mistaken_for     any                                           ->  any
    part_of          any                                           ->  concept

### healing

    healed_by        state|strategy|belief                         ->  practice
    requires         practice                                      ->  practice

### provenance

    described_in     any                                           ->  video
    derived_from     concept|strategy|practice                     ->  source

## Two classes of predicate

The **flow predicates** — `triggers`, `deactivates`, `manifests_as`, `healed_by`,
`sustains` — encode the mechanism, and their domains are deliberately tight. When
one of them rejects an edge, the edge is wrong: the fix is to route it to the
right node, never to widen the predicate. Every rejection of this kind so far has
turned out to be a genuine authoring error.

The **descriptive predicates** — `characterizes`, `originates_in`, `part_of` —
say what a thing is and where it belongs. These were drafted too narrowly and have
been widened as real cases appeared: states and behaviours have developmental
origins, a trigger can be a style's signature, and a role belongs to the framework
that names it. Widening these costs nothing, because they carry no causal claim.

Two further widenings happened while the last third of the corpus was mined, both
of the same kind. `originates_in` now accepts a **concept** as its domain: some
concepts genuinely are developmental — "the threat was also the refuge" is a claim
about where a pattern came from, not a definition. And `derived_from` now accepts
a **practice**, because a practice can be credited to a named source as squarely
as an idea can: Priebe takes expressing anger at low volume from Radical Honesty.
Both are provenance and description, not mechanism. No flow predicate has been
widened, and the flow predicates rejected roughly a dozen edges during that pass —
every one of them an authoring error, fixed by rerouting rather than relaxing.

## Beliefs never point straight at behaviour

There is deliberately no `belief -> behavior` predicate. A belief `sustains` a
strategy, and the strategy `manifests_as` the behaviour. When a link seems to run
straight from a conviction to an act, the strategy in between is missing and
should be named — that intermediate node is usually the most useful thing in the
chain, because it is the level at which the pattern is actually changeable.

`healed_by` follows the same rule and is the easiest one to get wrong. A practice
works on the state, strategy or belief driving a behaviour, never on the behaviour
itself.

## Cycles, and two kinds of them

Cycle detection runs over the flow predicates only, and a cycle found there is a
**finding**: a self-reinforcing loop that nobody authored, assembled from edges
written weeks apart. These are surfaced on the graph page.

A cycle in `requires` is the opposite — a **hard error**. A prerequisite loop
among practices describes a practice nobody could ever begin.

## Frontmatter

    ---
    title: Deactivating Strategies
    type: strategy
    aliases: [deactivation, shutting down, going cold, switching off]
    attribution: literature       # literature | priebe | synthesis
    domain: attachment
    actor: self                   # self | partner | dyad
    marker: false
    lens:
      dismissive-avoidant: core
      fearful-avoidant: alternating
      anxious-preoccupied: feared
      secure: absent
    status: reviewed              # draft | reviewed
    ---

`aliases` is the load-bearing field at scale. It is what stops "shutting down",
"going cold" and "deactivation" from becoming three nodes across fifty videos.
Every alias an extraction pass encounters is either added here or resolved to an
existing node.

`lens` values are closed: `core | secondary | alternating | feared | absent |
secure-form`. `alternating` is how fearful-avoidant is carried: the node belongs
to that lens, but as one pole the system swings between rather than a steady
position. `feared` marks something a style dreads in the other person rather than
does itself. They drive the four-lens toggle on the graph page, and a node absent
from a lens is hidden in that view.

`actor` says whose system a node belongs to. Attachment dynamics close across two
people: a loop typically runs self -> partner -> self. Only `state`, `behavior`,
`trigger`, `strategy` and `belief` may carry a non-`self` actor, and the field
defaults to `self`.

`attribution` marks the seam between the underlying literature, Priebe's own
coinages and framings, and our synthesis across her videos. It records where an
idea came from — not whether it has been verified.
