import assert from 'node:assert/strict';
import { sceneOf, Sequence, Parallel } from '../../src/live-game/dmd/spike.mjs';

assert.equal(sceneOf('PLAYER_UP'), 'PLAYER_UP');
assert.equal(sceneOf('HIT_TREBLE'), 'TREBLE');
assert.equal(sceneOf('DESMOND_DELIGHT'), 'DESMOND');
assert.equal(sceneOf('HIT_DOUBLE'), null);
assert.equal(new Sequence([{ duration: 10 }, { duration: 20 }]).duration(), 30);
assert.equal(new Parallel([{ duration: 10 }, { duration: 20 }]).duration(), 20);
console.log('PASS SC-032 renderer spike deterministic Stage/Actor/Action proof model');
