import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

function read(path){ return fs.readFileSync(path, 'utf8'); }
function meta(path){
  const body = read(path);
  return {
    path,
    bytes: Buffer.byteLength(body, 'utf8'),
    sha256: crypto.createHash('sha256').update(body).digest('hex'),
  };
}

const fxClick = read('src/legacy/scripts/inline-003.js');
const fxPointer = read('src/legacy/scripts/inline-004.js');
const renderer = read('src/legacy/scripts/inline-007.js');
const engine = read('src/game/engine.js');
const liveV2 = read('src/live-game/live-v2.js');
const turbo = read('src/legacy/scripts/inline-016.js');
const patchManifest = JSON.parse(read('src/legacy/intentional-patches.json'));

// The two old pad-FX compatibility layers may animate buttons, but they must no
// longer own DMD scenes or destructive queue clearing.
for (const [label, body] of [['inline-003', fxClick], ['inline-004', fxPointer]]) {
  assert(!body.includes('sqDmdShowZones'), `${label} must not write DMD scenes`);
  assert(!body.includes('__sqDmdHardClearQueue'), `${label} must not hard-clear the DMD queue`);
}
assert(fxClick.includes("pulse(btn, 'sq-padfx-miss')"), 'inline-003 keeps Miss button feedback');
assert(fxClick.includes("pulse(btn, 'sq-padfx-undo')"), 'inline-003 keeps Undo button feedback');
assert(fxClick.includes("pulse(btn, 'sq-padfx-skip')"), 'inline-003 keeps Skip button feedback');
assert(fxPointer.includes("retrigger(btn, 'sq-padfx-miss-hard'"), 'inline-004 keeps stronger Miss button feedback');
assert(fxPointer.includes("retrigger(btn, 'sq-padfx-undo-hard'"), 'inline-004 keeps stronger Undo button feedback');

// The released renderer/backend and canonical gameplay path remain available.
assert(renderer.includes('sqDmdShowZones'), 'legacy renderer fallback remains present');
assert(engine.includes('CANONICAL DMD COMBO BLOCK'), 'canonical engine combo block remains present');
assert(engine.includes('window.sqDmdShowZones'), 'engine presentation path remains present');
assert(liveV2.includes('__sqDmdV2.emit'), 'Live V2 modular action feedback remains present');
assert(turbo.includes('__sqDmdBulkMiss'), 'Turbo bulk-miss suppression contract remains present');

// SC-032 Stage-3 sequencing contract: Skip must not create the generic visit
// banner, and every delayed frame must prove it still owns the same visit before
// it can render. This is presentation-only and deliberately reuses the released
// renderer flow token + history rather than introducing a second game-state owner.
assert(
  engine.includes("dartIndex === 2 && !window.__sqSkipInProgress"),
  'generic Skip must not start the engine Stage-3 visit sequence'
);
assert(
  engine.includes('const __sqDmdStage3Token = Number(window.__sqDmdFlowToken || 0);'),
  'Stage-3 must capture the released renderer flow token'
);
assert(
  engine.includes('const __sqDmdStage3ExpectedHistory ='),
  'Stage-3 must capture the completed-visit history boundary'
);
assert(
  engine.includes('const __sqDmdStage3Current = () => ('),
  'Stage-3 must expose one ownership predicate for all delayed frames'
);
const stage3GuardCount = (engine.match(/if \(!__sqDmdStage3Current\(\)\) return;/g) || []).length;
assert(
  stage3GuardCount >= 7,
  `Stage-3 outer + delayed frames must all revalidate ownership (found ${stage3GuardCount})`
);

const patchMeta = [
  meta('src/legacy/scripts/inline-003.js'),
  meta('src/legacy/scripts/inline-004.js'),
];
for (const current of patchMeta) {
  const declared = patchManifest.patches.find(entry => entry.file === current.path);
  assert(declared, `${current.path} must be registered as an intentional legacy patch`);
  assert.equal(declared.sha256, current.sha256, `${current.path} patch hash must match live content`);
  assert.equal(declared.bytes, current.bytes, `${current.path} patch byte count must match live content`);
  assert.equal(declared.task, 'SC-032 DMD ownership cleanup', `${current.path} patch must be owned by SC-032`);
}

console.log(`SC032_PATCH_META=${JSON.stringify(patchMeta)}`);
console.log(`SC032_STAGE3_GUARDS=${stage3GuardCount}`);
console.log('SC-032 DMD OWNERSHIP: STATIC CONTRACT PASS');
