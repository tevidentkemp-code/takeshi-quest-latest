import assert from 'node:assert/strict';
import { createMotionSafeBackend, prefersReducedMotion } from '../../src/live-game/dmd/motion.mjs';

assert.equal(prefersReducedMotion({ matchMedia: () => ({ matches: true }) }), true);
assert.equal(prefersReducedMotion({ matchMedia: () => ({ matches: false }) }), false);
assert.equal(prefersReducedMotion({}), false);

const reducedCalls = [];
const reducedBase = {
  render(zones, opts) { reducedCalls.push({ zones, opts }); return 'ok'; },
  clear() {},
  restoreIdle() {},
  transient: true,
};
const reduced = createMotionSafeBackend(reducedBase, { matchMedia: () => ({ matches: true }) });
assert.equal(reduced.transient, true, 'backend metadata is preserved');
assert.equal(reduced.render({ z2: 'LAST DART HERO' }, { type: 'lastDartImg', amp: 3.4, ms: 900 }), 'ok');
assert.equal(reducedCalls.length, 1);
assert.equal(reducedCalls[0].opts.type, 'hold', 'motion scene becomes static hold');
assert.equal(reducedCalls[0].opts.amp, 0, 'motion amplitude is removed');
assert.equal(reducedCalls[0].opts.ms, 900, 'message timing remains unchanged');

const normalCalls = [];
const normalBase = {
  render(zones, opts) { normalCalls.push({ zones, opts }); },
  clear() {},
  restoreIdle() {},
};
const normal = createMotionSafeBackend(normalBase, { matchMedia: () => ({ matches: false }) });
normal.render({ z2: 'VOLDY' }, { type: 'voldyImg', amp: 2.6, ms: 900 });
assert.equal(normalCalls[0].opts.type, 'voldyImg', 'normal motion presentation is preserved');
assert.equal(normalCalls[0].opts.amp, 2.6);

console.log('SC-030 REDUCED MOTION ADAPTER: ALL PASS');
