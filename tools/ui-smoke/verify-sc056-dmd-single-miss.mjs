import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync('src/live-game/live-v2.js','utf8');
const conditional="const label = n > 1 ? `MISS x${n}` : 'MISS';";
assert.equal(source.split(conditional).length-1,2,'both Live V2 MISS formatters must suppress x1');
assert.equal(source.includes("const label = `MISS x${n}`;"),false,'unconditional MISS xN DMD label must be removed');
assert(source.includes('pressMissN(1)'),'ordinary MISS action must keep using the shared one-miss path');

const meta=JSON.parse(fs.readFileSync('assets/release-metadata.json','utf8'));
assert.equal(meta.currentVersion,'0.2.1');
assert.equal(meta.currentReleaseId,'SC-056');
assert.equal(meta.releases[0].releaseId,'SC-056');

console.log('SC-056 DMD single-MISS static contract PASS');
