import assert from 'node:assert/strict';
import fs from 'node:fs';
import { detectImmediateMisfires, appliedMisfirePenalty } from '../../src/live-game/xp-breakdown.mjs';

const row = (roundTotal, darts) => ({ roundTotal, darts });
const hit = (kind, points, sector) => ({ kind, points, sector });
const miss = () => ({ kind:'Miss', points:0 });

const rows = Array.from({length:14}, (_, i) => row(10, [hit('S',10,10), miss(), miss()]));
rows[11] = row(20, [
  hit('Double',8,4),   // qualifies D1-D5
  hit('Double',12,6),  // does not qualify
  miss(),
]);
rows[12] = row(36, [
  hit('Triple',3,1),   // qualifies T1-T5
  hit('Triple',15,5),  // qualifies T1-T5
  hit('Triple',18,6),  // does not qualify
]);
rows[13] = row(25, [hit('B',25,25), miss(), miss()]);

const volde = detectImmediateMisfires(rows, 201);
assert.deepEqual(volde.map(x => x.code), ['volde_deux','volde_trois']);
assert.deepEqual(
  volde.map(x => ({ code:x.code, count:x.count, penalty:x.penalty })),
  [
    { code:'volde_deux', count:1, penalty:-2 },
    { code:'volde_trois', count:2, penalty:-4 },
  ]
);
assert.equal(appliedMisfirePenalty(volde), -6, 'Volde penalties must stack per qualifying dart and ignore the -5 cap');
assert.equal(
  appliedMisfirePenalty([
    { code:'deep_freeze', penalty:-3 },
    { code:'ghost_town', penalty:-2 },
    { code:'volde_deux', count:3, penalty:-6 },
  ]),
  -9,
  'Volde must stack in addition to the single worst normal Misfire'
);
assert.equal(appliedMisfirePenalty([{ code:'legacy_normal', penalty:-8 }]), -5, 'Normal Misfires remain capped at -5');

const modals = fs.readFileSync('src/ui/modals.js','utf8');
const compat = fs.readFileSync('src/legacy/scripts/inline-005.js','utf8');
const migration = fs.readFileSync('supabase/migrations/20260921190000_sc048_volde_misfires.sql','utf8');

for (const source of [modals, compat]) {
  assert(source.includes("code:'volde_deux'"));
  assert(source.includes("name:'Volde-D’eux'"));
  assert(source.includes("code:'volde_trois'"));
  assert(source.includes("name:'Volde-Trois'"));
  assert(source.includes('stack at -2 XP for every qualifying dart') || source.includes('every qualifying dart is -2 XP'));
}

for (const needle of [
  "g.finished = true",
  "coalesce(g.is_practice, false) = false",
  "coalesce(g.is_tiebreak, false) = false",
  "in ('legacy', 'official')",
  "ridx = 11",
  "kind in ('d', 'double')",
  "ridx = 12",
  "kind in ('t', 'triple')",
  "sector between 1 and 5",
  "2026-09-05 20:13:15+00",
  "greatest(-5, min(e.penalty))",
  "sum(e.penalty)::bigint",
]) assert(migration.includes(needle), `SC-048 migration missing contract: ${needle}`);

console.log('SC-048 Volde client/backend contract PASS');
