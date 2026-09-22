import assert from 'node:assert/strict';
import fs from 'node:fs';

const engine=fs.readFileSync('src/game/engine.js','utf8');
const perf=fs.readFileSync('src/legacy/scripts/inline-040.js','utf8');

assert(perf.includes('window.__sqLiveV2Immediate === true'),
  'existing Live V2 wrapper must retain the bounded immediate-render escape hatch');
assert(engine.includes('window.__sqLiveV2Immediate = true;'),
  'scoring path must request immediate Live V2 rendering');
assert(engine.includes('window.__sqLiveV2Immediate = __sqPrevLiveV2Immediate;'),
  'scoring path must restore the prior immediate-render flag');
assert(engine.includes("toast(nm+' skipped • score unchanged')"),
  'Gate 1 must not absorb the separate Skip presentation cleanup');
assert(engine.includes("type:'absenceSkip'"),
  'Skip mechanics/history must remain present');
assert(engine.includes('updateUI();'),
  'canonical scoring path must still call updateUI');

console.log('SXP-04 Gate 1 R2 scope guard PASS: scoring paint only; Skip behaviour/presentation untouched.');