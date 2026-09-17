import assert from 'node:assert/strict';
import fs from 'node:fs';
import { detectImmediateMisfires, appliedMisfirePenalty } from '../../src/live-game/xp-breakdown.mjs';

const rows = values => values.map(roundTotal => ({ roundTotal, darts:[{kind:roundTotal ? 'S' : 'Miss', points:roundTotal || 0}] }));

assert.deepEqual(detectImmediateMisfires(rows([10,11,12,13,14,15,16,17,18,19,20,20,30,25]), 230), []);

const allScratch = detectImmediateMisfires(rows(Array(14).fill(0)), 0);
assert.deepEqual(
  allScratch.map(event => event.code),
  ['cold_start','ghost_town','deep_freeze','sub_ton','special_delivery_failed','bull_blind']
);
assert.equal(appliedMisfirePenalty(allScratch), -3, 'Only the single worst current-game Misfire penalty should apply');
assert.equal(appliedMisfirePenalty([{ penalty:-8 }]), -5, 'Negative XP must remain capped at -5 per game');
assert.equal(appliedMisfirePenalty([]), 0);

const source = fs.readFileSync(new URL('../../src/live-game/xp-breakdown.mjs', import.meta.url), 'utf8');
for (const required of ['BASE XP','POSITIVE','NEGATIVE','overflow-x:auto','gc-xp-rankstack','LEVEL UP!']) {
  assert.ok(source.includes(required), `Missing XP breakdown contract: ${required}`);
}

console.log('SC-038 XP breakdown contract PASS');
