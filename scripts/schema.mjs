// The closed vocabulary. scripts/validate.mjs enforces it; nothing writes to
// content/ that does not pass. Mirrors _meta/schema.md — keep them in step.

export const NODE_TYPES = [
  'style', 'strategy', 'state', 'trigger', 'belief', 'behavior',
  'origin', 'practice', 'concept', 'source', 'video',
];

export const STYLES = [
  'dismissive-avoidant', 'anxious-preoccupied', 'fearful-avoidant', 'secure',
];

export const LENS_VALUES = ['core', 'secondary', 'alternating', 'feared', 'absent', 'secure-form'];

export const ATTRIBUTION = ['literature', 'priebe', 'synthesis'];

// Whose system a node belongs to. Attachment dynamics close across two people —
// a loop typically runs self -> partner -> self — so the renderer needs to know
// which side a node sits on to lay a cycle out legibly. Defaults to `self`.
export const ACTORS = ['self', 'partner', 'dyad'];
export const ACTOR_TYPES = ['state', 'behavior', 'trigger', 'strategy', 'belief'];

const ANY = '*';

export const PREDICATES = {
  // activation machinery — the causal engine
  triggers:        { domain: ['trigger', 'state', 'behavior'],    range: ['state', 'strategy'],  group: 'activation', flow: true },
  deactivates:     { domain: ['strategy', 'practice'],            range: ['state', 'strategy'],  group: 'activation', flow: true },
  regulates:       { domain: ['practice', 'strategy'],            range: ['state'],              group: 'activation' },

  // structure and defense
  defends_against: { domain: ['strategy', 'belief'],              range: ['state', 'belief'],    group: 'defense' },
  manifests_as:    { domain: ['strategy', 'state', 'practice'],   range: ['behavior'],           group: 'defense', flow: true },
  sustains:        { domain: ['belief'],                          range: ['strategy'],           group: 'defense' },
  originates_in:   { domain: ['strategy', 'belief', 'style', 'state', 'behavior', 'concept'], range: ['origin'],  group: 'defense' },

  // identity and comparison
  characterizes:   { domain: ['strategy', 'belief', 'behavior', 'trigger', 'state', 'concept'], range: ['style'], group: 'identity' },
  mirrors:         { domain: ANY,                                 range: ANY,                    group: 'identity', symmetric: true },
  contrasts_with:  { domain: ANY,                                 range: ANY,                    group: 'identity', symmetric: true },
  mistaken_for:    { domain: ANY,                                 range: ANY,                    group: 'identity' },
  part_of:         { domain: ANY,                                 range: ['concept'],            group: 'identity' },

  // healing
  healed_by:       { domain: ['state', 'strategy', 'belief'],     range: ['practice'],           group: 'healing' },
  requires:        { domain: ['practice'],                        range: ['practice'],           group: 'healing' },

  // provenance
  described_in:    { domain: ANY,                                 range: ['video'],              group: 'provenance' },
  derived_from:    { domain: ['concept', 'strategy', 'practice'], range: ['source'],             group: 'provenance' },
};

export const PREDICATE_NAMES = Object.keys(PREDICATES);
// A loop in this material is not one predicate repeated: a trigger fires a
// strategy, the strategy surfaces as behaviour, the behaviour lands as a state
// that fires the next trigger. Cycles are searched over that whole flow.
export const CYCLE_PREDICATES = PREDICATE_NAMES.filter((p) => PREDICATES[p].flow);

export function accepts(list, type) {
  return list === ANY || list.includes(type);
}
