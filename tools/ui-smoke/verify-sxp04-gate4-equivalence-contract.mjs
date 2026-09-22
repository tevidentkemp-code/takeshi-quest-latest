import fs from 'node:fs';
import assert from 'node:assert/strict';

const live = fs.readFileSync('src/live-game/live-v2.js','utf8');
const engine = fs.readFileSync('src/game/engine.js','utf8');
const test = fs.readFileSync('tools/ui-smoke/verify-sxp04-gate4-equivalence.js','utf8');

const start = live.indexOf('// >>> SXP-04 GATE 3 / SC-049 QUICK ENTRY PROTOTYPE START');
const end = live.indexOf('// <<< SXP-04 GATE 3 / SC-049 QUICK ENTRY PROTOTYPE END');
assert(start >= 0 && end > start, 'SC-049 quick-entry block must remain present');
const block = live.slice(start,end);

assert(block.includes('recordThrow(Object.assign({}, spec || {}));'),
  'quick-entry repeats must still route through canonical recordThrow once per dart');
assert(!block.includes('state.history.push('),'quick-entry must not write history directly');
assert(!block.includes('localStorage.setItem('),'quick-entry must not create persistence truth');
assert(!block.includes('roundTotal ='),'quick-entry must not calculate round totals itself');
assert(!block.includes('state.matchAgg.'),'quick-entry must not mutate aggregate stats directly');
assert(block.includes('const maxFits = Math.max(0, 3 - startDart);'),'quick-entry must clamp to remaining darts');
assert(block.includes("if (dart >= 1)") && block.includes("id:'rh'"),'RH must remain previous-dart based');
assert(engine.includes('state.history.push({') && engine.includes('throw:     dartObj'),
  'canonical recordThrow history owner must remain intact');

for (const needle of [
  'x3 must be 100% equivalent',
  'Undo after x3 must restore identical canonical state/history/stats/persistence',
  'x2 must be 100% equivalent',
  'RH must be 100% equivalent',
  'SQ_ACH.detectGame',
  'computeStatsForPlayerGame',
  'localStorage.getItem(storageKey)',
  'quick repeat must never spill onto the next player',
  'quick entry must not rewrite mode identity'
]) assert(test.includes(needle), 'Gate 4 browser proof missing: '+needle);

console.log('SXP-04 Gate 4 static equivalence contract PASS.');
