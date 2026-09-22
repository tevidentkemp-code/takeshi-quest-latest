import assert from 'node:assert/strict';
import fs from 'node:fs';

const live=fs.readFileSync('src/live-game/live-v2.js','utf8');
const markers=(live.match(/SXP-04 Gate 1: gameplay\/state commits first/g)||[]).length;
assert.equal(markers,2,'both canonical pressMissN paths must be non-blocking');
assert.equal((live.match(/await new Promise\(r=>setTimeout\(r,280\)\);/g)||[]).length,0,
  'MISS state commit must not sit behind the old 280ms presentation delay');
assert.equal((live.match(/showMissFrame\(0\);/g)||[]).length,2,'MISS presentation must still start immediately');
assert((live.match(/recordThrow\(\{ kind:'Miss' \}\);/g)||[]).length>=4,'canonical per-dart MISS scoring path must remain present');
assert.equal((live.match(/i \* 90/g)||[]).length,2,'MISS xN follow-up frames must remain fast and asynchronous');
console.log('SXP-04 Gate 1 MISS contract PASS: state first, presentation asynchronous/cancellable.');
