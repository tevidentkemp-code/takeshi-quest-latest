import assert from 'node:assert/strict';
import {
  playerDisplayParts,
  bestRoundSummary,
  completedRoundCount,
  recordFlagsFromSnapshot,
  finalAdvanceLabel,
  currentGameWinnerIndex,
  projectedMatchCompletion
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

const matchFixture = {
  players:[{ name:'Alpha' }, { name:'Beta' }],
  score:[
    [{ roundTotal:100 }],
    [{ roundTotal:80 }]
  ],
  gameAwarded:false,
  gameMode:'official',
  __gameToken:55,
  match:{ targetWins:3, wins:[1,0], history:[] }
};
assert.equal(currentGameWinnerIndex(matchFixture), 0);
assert.deepEqual(
  projectedMatchCompletion(matchFixture, 'official'),
  { complete:false, targetWins:3, winnerIndex:0, projectedWins:[2,0], gameWinnerIndex:0, mode:'official' }
);

const finalFixture = {
  ...matchFixture,
  match:{ targetWins:3, wins:[2,1], history:[] }
};
assert.deepEqual(
  projectedMatchCompletion(finalFixture, 'official'),
  { complete:true, targetWins:3, winnerIndex:0, projectedWins:[3,1], gameWinnerIndex:0, mode:'official' }
);

const deciderFixture = {
  ...matchFixture,
  score:[
    [{ roundTotal:90 }],
    [{ roundTotal:90 }]
  ],
  _decider:{ resolved:true, gameToken:55, winner:1 },
  match:{ targetWins:3, wins:[2,2], history:[] }
};
assert.equal(currentGameWinnerIndex(deciderFixture), 1);
assert.deepEqual(
  projectedMatchCompletion(deciderFixture, 'official'),
  { complete:true, targetWins:3, winnerIndex:1, projectedWins:[2,3], gameWinnerIndex:1, mode:'official' }
);

assert.equal(projectedMatchCompletion({
  ...matchFixture,
  gameMode:'practice',
  mode:'practice',
  match:{ targetWins:1, wins:[0,0], history:[] }
}, 'practice').complete, false, 'Practice must never show Match Win');

console.log('SC-038 helper contract PASS');
