import assert from 'node:assert/strict';
import { DMD_V3_RESOLUTIONS, buildSceneFrame, deterministicSceneSignature, getSceneDuration } from '../../src/live-game/dmd/v3/scene-registry.mjs';
import { createController } from '../../src/live-game/dmd/controller.mjs';

assert.deepEqual(DMD_V3_RESOLUTIONS.HYBRID_288, { id: '640x160@288x72', width: 640, height: 160, dotColumns: 288, dotRows: 72 });
for (const scene of ['PLAYER_UP', 'SINGLE', 'DOUBLE', 'TREBLE', 'OUTER_BULL', 'BULLSEYE', 'MISS']) {
  assert.equal(deterministicSceneSignature(scene, 100, { points: 60, total: 180 }), deterministicSceneSignature(scene, 100, { points: 60, total: 180 }));
  assert.equal(buildSceneFrame(scene, getSceneDuration(scene)).id, scene);
}
const normal = buildSceneFrame('TREBLE', 180);
const reduced = buildSceneFrame('TREBLE', 180, {}, { reducedMotion: true });
assert(normal.layers.some(layer => layer.kind === 'ring'));
assert(!reduced.layers.some(layer => layer.kind === 'ring'));
const rendered = [];
const controller = createController({ render: (zones, opts) => rendered.push({ zones, opts }), clear() {}, restoreIdle() {}, maxQueue: 2 });
for (const kind of ['HIT_SINGLE', 'HIT_DOUBLE', 'HIT_TREBLE', 'OUTER_BULL', 'BULLSEYE', 'MISS']) controller.emit({ kind, headline: 'CUSTOM COPY', points: 20 });
assert.equal(rendered[0].opts.eventKind, 'HIT_SINGLE');
assert.equal(rendered[0].zones.z2, 'SINGLE +20');
assert.equal(controller.emit({ kind: 'PLAYER_UP', headline: 'DIFFERENT COPY' }).eventKind, 'PLAYER_UP');
console.log('PASS SC-032 Phase 1 V3 profile/scenes/determinism/reduced-motion');
