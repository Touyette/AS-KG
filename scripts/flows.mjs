// Flow definitions are data, compiled to two surfaces: the static toolbox on the
// site, and the bundle a model follows. One source of truth, so a flow corrected
// once is corrected in both.
//
// The load-bearing rule is `safety_gate`: no flow may present an attachment
// reading before its safety step has been answered. validateFlows() enforces it
// structurally rather than trusting the author (or the model) to remember.
import fs from 'node:fs';
import path from 'node:path';
import { loadNotes, buildIndex } from './lib/notes.mjs';

export const STEP_KINDS = ['scale', 'choice', 'text', 'split', 'reflect', 'stop', 'end'];

export function loadFlows(dir = 'flows') {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: path.join(dir, f), ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }));
}

export function validateFlows(flows, contentDir = 'content') {
  const index = buildIndex(loadNotes(contentDir));
  const errors = [];
  const ids = new Set();

  for (const f of flows) {
    const at = (m) => errors.push(`${f.id}: ${m}`);
    if (!f.id || !f.title) { at('needs an id and a title'); continue; }
    if (ids.has(f.id)) at('duplicate flow id');
    ids.add(f.id);

    const stepIds = new Set(f.steps.map((s) => s.id));
    const gateIdx = f.steps.findIndex((s) => s.safety_gate);
    if (gateIdx === -1) at('no step marked safety_gate — every flow must screen before it reframes');

    f.steps.forEach((s, i) => {
      if (!STEP_KINDS.includes(s.kind)) at(`step "${s.id}" has unknown kind "${s.kind}"`);
      // Anything that names a node must name one that exists. This is what keeps
      // the flows from drifting away from the graph as the graph changes.
      for (const c of s.cites ?? []) {
        if (!index.resolve(c)) at(`step "${s.id}" cites "${c}", which is not in the graph`);
      }
      // A step that reads the person's pattern back to them is a reframe, and no
      // reframe may sit before the gate.
      if (s.reframe && gateIdx !== -1 && i < gateIdx) {
        at(`step "${s.id}" offers a reframe before the safety gate`);
      }
      for (const b of [...(s.branches ?? []), ...(s.options ?? [])]) {
        if (b.goto && !stepIds.has(b.goto)) at(`step "${s.id}" branches to unknown step "${b.goto}"`);
      }
      if (s.goto && !stepIds.has(s.goto)) at(`step "${s.id}" continues to unknown step "${s.goto}"`);
    });

    // Every path must terminate, and at least one must be an exit that does not
    // pass through the reframe (the "something is actually happening" route).
    if (!f.steps.some((s) => s.kind === 'stop')) at('has no stop step — the safety branch needs somewhere to go');
    if (!f.steps.some((s) => s.kind === 'end')) at('has no end step');

    // A step that is not an exit must lead somewhere. Without this a flow can be
    // schema-valid and still strand whoever is in it.
    for (const s of f.steps) {
      const exits = (s.branches?.length ?? 0) + (s.options?.length ?? 0) + (s.goto ? 1 : 0);
      if (!['stop', 'end'].includes(s.kind) && exits === 0) at(`step "${s.id}" is a dead end — no goto, branches or options`);
      if (['stop', 'end'].includes(s.kind) && exits > 0) at(`step "${s.id}" is kind "${s.kind}" but still leads somewhere`);
    }

    // And every step must be reachable from the first, or it is content nobody
    // can ever see.
    const seen = new Set([f.steps[0]?.id]);
    for (let changed = true; changed; ) {
      changed = false;
      for (const s of f.steps) {
        if (!seen.has(s.id)) continue;
        const targets = [...(s.branches ?? []), ...(s.options ?? [])].map((b) => b.goto).concat(s.goto ? [s.goto] : []);
        for (const t of targets) if (t && !seen.has(t)) { seen.add(t); changed = true; }
      }
    }
    for (const s of f.steps) if (!seen.has(s.id)) at(`step "${s.id}" is unreachable from the first step`);
    if (f.mirror && !flows.some((o) => o.id === f.mirror)) at(`names mirror "${f.mirror}", which does not exist`);
  }
  return errors;
}
