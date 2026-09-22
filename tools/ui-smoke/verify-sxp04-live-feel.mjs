import assert from 'node:assert/strict';
import fs from 'node:fs';

const engine = fs.readFileSync('src/game/engine.js','utf8');
const perf = fs.readFileSync('src/legacy/scripts/inline-040.js','utf8');

assert(perf.includes('window.__sqLiveV2Immediate === true'),
  'Live V2 performance wrapper must retain bounded immediate-render escape hatch');
assert(engine.includes('window.__sqLiveV2Immediate = true;'),
  'canonical scoring path must request immediate Live V2 paint');
assert(engine.includes('window.__sqLiveV2Immediate = __sqPrevLiveV2Immediate;'),
  'canonical scoring path must restore prior immediate-render state');
assert(!engine.includes("toast(nm+' skipped • score unchanged')"),
  'redundant skipped-go toast must remain removed');
assert(engine.includes("type:'absenceSkip'"),
  'skip mechanics/history must remain present');
assert(engine.includes('updateUI();'),
  'canonical scoring path must still update UI');

console.log('SXP-04 live-feel static regression PASS: immediate scoring paint, skip mechanics preserved, duplicate skip toast removed.');
