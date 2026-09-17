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
console.log('SC-032 DMD OWNERSHIP: FIRST-SLICE STATIC CONTRACT PASS');
