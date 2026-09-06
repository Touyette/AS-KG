# Parked: literature cross-check

Status: **not integrated.** The project is Priebe-only for now; this file exists
so the work is not lost when the scope widens. Nothing here is published — the
site builds from `content/` and never reads `_meta/`.

Three books were read against the 101 nodes carrying `attribution: literature`.
Two claims in the corpus do not survive contact with the field.

## 1. Base rates — `concepts/how-common-each-style-is`

The node reports Priebe's figures: ~50–60% secure, ~20% anxious, ~20% avoidant,
fearful-avoidant "the rarest by a wide margin" (~2%).

- Bartholomew & Horowitz (1991) normative sample, the four-category adult model
  that maps onto her four styles: 49% secure, 12% preoccupied, 18% dismissing,
  **21% fearful**.
- AAI meta-analysis, nonclinical samples: 58% autonomous, 24% dismissing, 18%
  preoccupied. Four-way with unresolved/cannot-classify combined: 56 / 16 / 9 / **18**.

Fearful-avoidant runs ~18–21%, comparable to the other insecure categories.
Her secure and avoidant figures hold; anxious is slightly high but in range.
Her four numbers sum to 102%, which is itself a sign they are not one distribution.

Propagates to `concepts/mistyping-into-the-middle`, which uses the rarity to
explain over-claiming. The over-claiming may well be real; the stated reason is not.

## 2. The shock experiment — `concepts/the-shock-experiment`

The node says anxious participants calmed when someone was present and avoidant
participants became more stressed.

The study is Coan, Schaefer & Davidson (2006): married women under threat of
electric shock in an fMRI, holding a husband's hand, a stranger's hand, or no
hand. Handholding reduced activation in stress-related regions. **The moderator
was marital quality, not attachment style.** The avoidant half of the claim is
not a finding of this study. Priebe hedged her own source at the time.

Convergence worth keeping: a 2013 follow-up found the effect absent in distressed
couples and restored after emotionally focused therapy — first author S. M. Johnson,
i.e. Sue Johnson, one of the three books.

## 3. Held up

Crittenden's Dynamic Maturation Model: Brown & Elliott confirm she treats
alternating anxious/avoidant patterns as classifiable, organised strategies
rather than disorganised. `concepts/dynamic-maturation-model` stands.

Window of tolerance and psychic equivalence do not appear in these three books
(Siegel and Fonagy respectively). Unverified, not contradicted.

## Note on why nothing was changed

`attribution` marks *where an idea came from*, not whether it has been verified.
Both nodes above are correctly labelled `literature` — the ideas do originate
there. And as a faithful index of her corpus, a node that accurately records what
she said is doing its job. Correcting the underlying claims means the graph starts
speaking in its own voice against hers, which is a change in what the site is —
a decision for the extension phase, not a bug fix.

## Books used

- Mikulincer & Shaver, *Attachment in Adulthood*, 2nd ed. — the empirical spine
- Brown, Elliott et al., *Attachment Disturbances in Adults* — the Three Pillars
  treatment model, which the graph has no analogue for
- Sue Johnson, *The Hold Me Tight Workbook* — dyadic, which the graph is not
