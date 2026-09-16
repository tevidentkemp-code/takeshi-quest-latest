import assert from 'node:assert/strict';
import {
  playerDisplayParts,
  bestRoundSummary,
  completedRoundCount,
  recordFlagsFromSnapshot,
  finalAdvanceLabel
} from '../../src/live-game/postgame-flow.mjs';

assert.deepEqual(
  playerDisplayParts({ name: 'Thomas Kemp', nickname: 'The Dart Knight' }),
  { main: 'Thomas Kemp', nickname: 'The Dart Knight', rawName: 'Thomas Kemp' }
);

assert.equal(
  bestRoundSummary([{ roundTotal: 20 }, { roundTotal: 60 }, { roundTotal: 45 }]).label,
  'R2 / 60'
);

assert.equal(
  completedRoundCount([
    { roundTotal: 0, darts: [{ kind: 'Miss' }, null, null] },
    { roundTotal: 20, darts: [{ points: 20 }, null, null] }
  ]),
  2
);

const snapshot = [
  { player_id: 'p1', player_name: 'Thomas Kemp', best_score: 300, best_score_pos: 2 },
  { player_id: 'p2', player_name: 'Alex', best_score: 350, best_score_pos: 1 }
];

assert.deepEqual(
  recordFlagsFromSnapshot(snapshot, { player_id: 'p1', name: 'Thomas Kemp' }, 360),
  { pb: true, wr: true, previousBest: 300, worldBest: 350 }
);

assert.deepEqual(
  recordFlagsFromSnapshot(snapshot, { player_id: 'p1', name: 'Thomas Kemp' }, 320),
  { pb: true, wr: false, previousBest: 300, worldBest: 350 }
);

assert.equal(finalAdvanceLabel('End Match'), 'FINISH MATCH');
assert.equal(finalAdvanceLabel('Next Round'), 'NEXT GAME');

console.log('SC-038 helper contract PASS');
