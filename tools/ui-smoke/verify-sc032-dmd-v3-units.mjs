import assert from 'node:assert/strict';
import {
  DMD_V3_RESOLUTIONS,
  DMD_V3_SCENES,
  buildSceneFrame,
  deterministicSceneSignature,
  getSceneDuration,
} from '../../src/live-game/dmd/v3/scene-registry.mjs';

assert.deepEqual(
  DMD_V3_RESOLUTIONS.DENSE_256,
  { id: '640x160@256x64', width: 640, height: 160, dotColumns: 256, dotRows: 64 },
  'balanced candidate keeps 640x160 authoring with 256x64 dot treatment',
);
assert.deepEqual(
  DMD_V3_RESOLUTIONS.DENSE_320,
  { id: '640x160@320x80', width: 640, height: 160, dotColumns: 320, dotRows: 80 },
  'digital candidate keeps 640x160 authoring with 320x80 dot treatment',
);
assert.equal(DMD_V3_RESOLUTIONS.DENSE_256.width, DMD_V3_RESOLUTIONS.DENSE_320.width, 'candidate comparison holds logical width constant');
assert.equal(DMD_V3_RESOLUTIONS.DENSE_256.height, DMD_V3_RESOLUTIONS.DENSE_320.height, 'candidate comparison holds logical height constant');

for (const sceneId of DMD_V3_SCENES) {
  const duration = getSceneDuration(sceneId);
  assert(duration > 0 && duration <= 1500, `${sceneId} uses bounded scene duration`);
  for (const timeMs of [0, Math.round(duration * 0.25), Math.round(duration * 0.5), duration]) {
    const first = deterministicSceneSignature(sceneId, timeMs);
    const second = deterministicSceneSignature(sceneId, timeMs);
    assert.equal(first, second, `${sceneId}@${timeMs}ms deterministic frame model`);
    const frame = buildSceneFrame(sceneId, timeMs);
    assert.equal(frame.id, sceneId, `${sceneId} frame identity`);
    assert(Array.isArray(frame.layers) && frame.layers.length > 0, `${sceneId} has authored layers`);
    for (const layer of frame.layers) {
      for (const key of ['x','y','x1','y1','x2','y2','size','radius','alpha','scale','offsetX','offsetY']) {
        if (layer[key] == null) continue;
        assert(Number.isFinite(Number(layer[key])), `${sceneId} ${layer.kind}.${key} is finite`);
      }
    }
  }
}

const trebleNormal = buildSceneFrame('TREBLE', 180, { points: 60, total: 220, target: '20' });
const trebleReduced = buildSceneFrame('TREBLE', 180, { points: 60, total: 220, target: '20' }, { reducedMotion: true });
assert(trebleNormal.layers.some(layer => layer.kind === 'ring'), 'normal Treble includes radial motion language');
assert(!trebleReduced.layers.some(layer => layer.kind === 'ring'), 'reduced-motion Treble removes radial motion');

const voldyNormal = buildSceneFrame('VOLDY', 240);
const voldyReduced = buildSceneFrame('VOLDY', 240, {}, { reducedMotion: true });
const voldyImageNormal = voldyNormal.layers.find(layer => layer.kind === 'image');
const voldyImageReduced = voldyReduced.layers.find(layer => layer.kind === 'image');
assert(voldyImageNormal && (voldyImageNormal.offsetX !== 0 || voldyImageNormal.offsetY !== 0), 'normal Voldy may use bounded jitter');
assert.deepEqual([voldyImageReduced.offsetX, voldyImageReduced.offsetY], [0,0], 'reduced-motion Voldy removes jitter');

const pbStart = buildSceneFrame('PERSONAL_BEST', 0, { previousScore: 286, score: 332 });
const pbMid = buildSceneFrame('PERSONAL_BEST', 380, { previousScore: 286, score: 332 });
const pbEnd = buildSceneFrame('PERSONAL_BEST', 1050, { previousScore: 286, score: 332 });
const scoreOf = frame => Number(frame.layers.find(layer => layer.kind === 'number')?.text);
assert.equal(scoreOf(pbStart), 286, 'PB count starts from previous score');
assert(scoreOf(pbMid) > 286 && scoreOf(pbMid) < 332, 'PB count transitions through an intermediate value');
assert.equal(scoreOf(pbEnd), 332, 'PB count resolves to authoritative score');

for (const [sceneId, assetKey] of [['LAST_DART_HERO','lastDart'],['DESMOND','desmond'],['VOLDY','voldy']]) {
  const frame = buildSceneFrame(sceneId, Math.round(getSceneDuration(sceneId) * 0.4));
  assert.equal(frame.layers.find(layer => layer.kind === 'image')?.assetKey, assetKey, `${sceneId} maps to its own artwork asset`);
}

console.log('PASS SC-032 DMD V3 deterministic scene/smooth-authoring/dot-density/reduced-motion contracts');
