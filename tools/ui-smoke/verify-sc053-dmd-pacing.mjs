import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(p,'utf8');
const engine=read('src/game/engine.js');
const missOwner=read('src/legacy/scripts/inline-025.js');
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

assert(missOwner.includes('var DMD_STEP_MS=75,DMD_HOLD_AFTER_MS=105,BUSY_EXTRA_MS=150;'),'MISS xN cadence contract missing');
assert(missOwner.includes("var opts={type:'snap',ms:125,revealMs:90,amp:2.8,fx:'impact'};"),'MISS xN must use 125ms SNAP impact');
assert(missOwner.includes("},340);}setTimeout(function(){try{btn.classList.remove('sq-missx3-hit95');}catch(_){}},390);"),'MISS xN button ghost must be shortened');
assert(missOwner.includes("['pointerdown','touchstart','click'].forEach(function(type){document.addEventListener(type,handleMissX3,true);});"),'Fix95 capture ownership must remain explicit');

assert(renderer.includes('active.type === "snap"'),'renderer missing SNAP motion');
assert(renderer.includes('active.type === "shutter"'),'renderer missing SHUTTER motion');
assert(renderer.includes("prefers-reduced-motion: reduce"),'new motion primitives must respect reduced motion');
assert(renderer.includes('const bands = 4'),'shutter must use four alternating bands');
assert(renderer.includes('fxScale = 1 + (0.055 * decay)'),'snap must have a bounded slam scale');

for(const needle of [
  "__sqShowStoryBeat(__sqCommentaryVisitBeat, 1200, 'hold')"
]) assert(compat.includes(needle),`generated compatibility runtime missing: ${needle}`);

console.log('SC-053 DMD pacing + motion static acceptance PASS');
