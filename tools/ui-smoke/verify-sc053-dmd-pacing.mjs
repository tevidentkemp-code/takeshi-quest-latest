import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(p,'utf8');
const engine=read('src/game/engine.js');
const live=read('src/live-game/live-v2.js');
const renderer=read('src/legacy/scripts/inline-007.js');
const compat=read('src/legacy/scripts/inline-005.js');

assert(engine.includes("{ type:'roll', ms:900, fx:'impact' }"),'ROUND SCORE must use 900ms roll');
assert(engine.includes("__sqShowStoryBeat(__sqCommentaryVisitBeat, 1200, 'hold')"),'visit story must hold 1200ms');
assert(engine.includes("__sqShowStoryBeat(__sqCommentaryRoundBeat, 1380, 'hold')"),'round punchline must hold 1380ms');
assert(engine.includes("{ type:'shutter', ms:900, revealMs:280, fx:'smear' }"),'round complete must use split shutter');
assert(engine.includes("z2:(nextLbl ? `NEXT: ${String(nextLbl).toUpperCase()}` : 'NEXT')"),'round handoff must combine next target');
assert(!engine.includes("{ z2: 'NEXT UP', z3:'' }"),'standalone NEXT UP card should be removed from canonical Stage 3');
assert(engine.includes("{ type:'snap', ms:380, revealMs:120, amp:2.2, fx:'impact' }"),'ordinary miss must be short snap');
assert(engine.includes("{ type:'wipe', ms:440, revealMs:110, fx:'smear' }"),'ordinary single must be shortened');

const specialMissCount=(live.match(/const specialMissSeq = \(dart >= 0 && dart <= 2 && n >= 2\);/g)||[]).length;
assert.equal(specialMissCount,2,'both canonical MISS xN paths must reserve special sequence for x2/x3');
assert.equal((live.match(/type:'snap', ms:150, revealMs:125, amp:2.6, fx:'impact'/g)||[]).length,2,'both MISS xN paths must use 150ms snap');
assert.equal((live.match(/setTimeout\(r,165\)/g)||[]).length,2,'both MISS xN paths must use 165ms cadence');

assert(renderer.includes('active.type === "snap"'),'renderer missing SNAP motion');
assert(renderer.includes('active.type === "shutter"'),'renderer missing SHUTTER motion');
assert(renderer.includes("prefers-reduced-motion: reduce"),'new motion primitives must respect reduced motion');
assert(renderer.includes('const bands = 4'),'shutter must use four alternating bands');
assert(renderer.includes('fxScale = 1 + (0.055 * decay)'),'snap must have a bounded slam scale');

for(const needle of [
  "__sqShowStoryBeat(__sqCommentaryVisitBeat, 1200, 'hold')",
  "const specialMissSeq = (dart >= 0 && dart <= 2 && n >= 2);",
  "type:'snap', ms:150, revealMs:125"
]) assert(compat.includes(needle),`generated compatibility runtime missing: ${needle}`);

console.log('SC-053 DMD pacing + motion static acceptance PASS');
