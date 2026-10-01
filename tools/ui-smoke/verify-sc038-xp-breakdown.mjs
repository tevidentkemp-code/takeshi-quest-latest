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

const bounceRows = rows([10,11,12,13,14,15,16,17,18,19,20,20,30,25]);
bounceRows[0].darts = [
  { kind:'S', points:10 },
  { kind:'Miss', points:0, bounceOut:true },
  { kind:'Miss', points:0, bounceOut:true },
];
const bounceEvents = detectImmediateMisfires(bounceRows, 230);
const bounce = bounceEvents.find(event => event.code === 'bounce_out');
assert.ok(bounce, 'Explicit Bounce Out marker must create a Bounce Out Misfire');
assert.equal(bounce.count, 2, 'Bounce Out history/display count must retain each explicitly recorded dart');
assert.equal(bounce.penalty, -1, 'Bounce Out is a normal -1 XP Misfire');
assert.equal(appliedMisfirePenalty(bounceEvents), -1, 'Repeated Bounce Outs must obey the normal single-worst-per-game rule');
const ordinaryMissRows = rows([10,11,12,13,14,15,16,17,18,19,20,20,30,25]);
ordinaryMissRows[0].darts = [{kind:'S',points:10},{kind:'Miss',points:0},{kind:'Miss',points:0}];
assert.ok(!detectImmediateMisfires(ordinaryMissRows,230).some(event => event.code === 'bounce_out'), 'Ordinary MISS must never be inferred as Bounce Out');


const source = fs.readFileSync(new URL('../../src/live-game/xp-breakdown.mjs', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../../supabase/migrations/20261001213000_sc059_bounce_out_misfire.sql', import.meta.url), 'utf8');
const rollback = fs.readFileSync(new URL('../../supabase/rollbacks/sc059_bounce_out_misfire.sql', import.meta.url), 'utf8');
for (const required of ["private.v_bounce_out_misfire_events","'bounce_out'::text","d.val->>'bounceOut'","v_player_misfires","v_player_misfire_xp","2026-09-05 20:13:15+00"]) {
  assert.ok(migration.includes(required), `Missing SC-059 migration contract: ${required}`);
}
assert.ok(rollback.includes('drop view if exists private.v_bounce_out_misfire_events'), 'SC-059 rollback must remove the internal Bounce Out helper view');
for (const required of ['BASE XP','POSITIVE XP','NEGATIVE XP','overflow-x:auto','gc-xp-rank-title','LEVEL UP!','gc-xp-portrait','aspect-ratio:1 / 1','gc-xp-avatar-sprite','THIS GAME XP','TOTAL XP','gc-xp-source-label-value','data-xp-info']) {
  assert.ok(source.includes(required), `Missing XP breakdown contract: ${required}`);
}

console.log('SC-038 XP breakdown contract PASS');

assert.ok(!source.includes('gc-xp-rankstack'), 'Obsolete right-side XP rank stack must be removed');
