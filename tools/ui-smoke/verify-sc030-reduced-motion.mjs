import assert from 'node:assert/strict';
import { createMotionSafeBackend, prefersReducedMotion } from '../../src/live-game/dmd/motion.mjs';

assert.equal(prefersReducedMotion({ matchMedia: () => ({ matches: true }) }), true);
assert.equal(prefersReducedMotion({ matchMedia: () => ({ matches: false }) }), false);
assert.equal(prefersReducedMotion({}), false);

const reducedCalls = [];
const reducedBase = {
  render(zones, opts) { reducedCalls.push({ kind:'zones', zones, opts }); return 'ok'; },
  renderScene(scene) { reducedCalls.push({ kind:'scene', scene }); return 'scene-ok'; },
  clear() {},
  restoreIdle() {},
  transient: true,
};
const reduced = createMotionSafeBackend(reducedBase, { matchMedia: () => ({ matches: true }) });
assert.equal(reduced.transient, true, 'backend metadata is preserved');
assert.equal(reduced.render({ z2: 'LAST DART HERO' }, { type: 'lastDartImg', amp: 3.4, ms: 900 }), 'ok');
assert.equal(reducedCalls[0].opts.type, 'hold', 'legacy motion scene becomes static hold');
assert.equal(reducedCalls[0].opts.amp, 0, 'legacy motion amplitude is removed');
assert.equal(reducedCalls[0].opts.ms, 900, 'legacy message timing remains unchanged');

assert.equal(reduced.renderScene({
  sceneId:'LAST_DART_HERO',
  renderType:'lastDartImg',
  amp:3.4,
  duration:900,
  headline:'LAST DART HERO',
  subline:'TOTAL 321',
}), 'scene-ok');
assert.equal(reducedCalls[1].kind, 'scene');
assert.equal(reducedCalls[1].scene.renderType, 'hold', 'scene descriptor becomes static hold');
assert.equal(reducedCalls[1].scene.amp, 0, 'scene descriptor amplitude is removed');
assert.equal(reducedCalls[1].scene.motion, 'reduced', 'scene descriptor records reduced-motion policy');
assert.equal(reducedCalls[1].scene.duration, 900, 'scene timing remains unchanged');

const normalCalls = [];
const normalBase = {
  render(zones, opts) { normalCalls.push({ kind:'zones', zones, opts }); },
  renderScene(scene) { normalCalls.push({ kind:'scene', scene }); },
  clear() {},
  restoreIdle() {},
};
const normal = createMotionSafeBackend(normalBase, { matchMedia: () => ({ matches: false }) });
normal.render({ z2: 'VOLDY' }, { type: 'voldyImg', amp: 2.6, ms: 900 });
assert.equal(normalCalls[0].opts.type, 'voldyImg', 'normal legacy motion presentation is preserved');
assert.equal(normalCalls[0].opts.amp, 2.6);
normal.renderScene({ sceneId:'VOLDY', renderType:'voldyImg', amp:2.6, duration:900 });
assert.equal(normalCalls[1].scene.renderType, 'voldyImg', 'normal scene descriptor presentation is preserved');
assert.equal(normalCalls[1].scene.amp, 2.6);

console.log('SC-030 / SXP05 REDUCED MOTION ADAPTER: ALL PASS');
