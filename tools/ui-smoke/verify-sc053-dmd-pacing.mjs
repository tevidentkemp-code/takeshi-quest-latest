import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=p=>fs.readFileSync(p,'utf8');
const engine=read('src/game/engine.js');
const missOwner=read('src/legacy/scripts/inline-025.js');
const renderer=read('src/legacy/scripts/inline-007.js');
const compat=read('src/legacy/scripts/inline-005.js');

assert(engine.includes("{ type:'roll', ms:1050, fx:'impact' }"),'ROUND SCORE must use 1050ms roll');
assert(engine.includes("const base = kind === 'round' ? 1900 : 1600;"),'story minimum read windows missing');
assert(engine.includes("const max = kind === 'round' ? 2450 : 2200;"),'story maximum read windows missing');
assert(engine.includes("__sqShowStoryBeat(__sqCommentaryVisitBeat, __visitStoryMs, 'hold')"),'visit story must use adaptive hold');
assert(engine.includes("__sqShowStoryBeat(__sqCommentaryRoundBeat, __roundStoryMs, 'hold')"),'round punchline must use adaptive hold');
assert(engine.includes("{ type:'shutter', ms:950, revealMs:280, fx:'smear' }"),'round complete must use split shutter');
assert(engine.includes("if (__active && Number(__active.priority || 0) <= 20) window.__sqDmdCancelTransientScenes?.();"),'important story must clear only low-priority controller transients');
assert(engine.includes("Math.max(1450, Math.min(1850, 1250 + (__sqDartStoryChars * 14)))"),'major per-dart commentary must have readable adaptive hold');
assert(engine.includes("z2:(nextLbl ? `NEXT: ${String(nextLbl).toUpperCase()}` : 'NEXT')"),'round handoff must combine next target');
assert(!engine.includes("{ z2: 'NEXT UP', z3:'' }"),'standalone NEXT UP card should be removed from canonical Stage 3');
assert(engine.includes("{ type:'snap', ms:380, revealMs:120, amp:2.2, fx:'impact' }"),'ordinary miss must be short snap');
assert(engine.includes("{ type:'wipe', ms:440, revealMs:110, fx:'smear' }"),'ordinary single must be shortened');

assert(missOwner.includes('var DMD_STEP_MS=75,DMD_HOLD_AFTER_MS=105,BUSY_EXTRA_MS=150;'),'MISS xN cadence contract missing');
assert(missOwner.includes("var opts={type:'snap',ms:125,revealMs:90,amp:2.8,fx:'impact'};"),'MISS xN must use 125ms SNAP impact');
assert(missOwner.includes('function dartToken(d,round)'),'MISS xN must derive existing dart tokens');
assert(missOwner.includes('function currentVisitSnapshot()'),'MISS xN must snapshot the current visit before animating');
assert(missOwner.includes("for(var i=0;i<Math.min(start,3,darts.length);i++)if(darts[i])cells[i]=dartToken(darts[i],round);"),'MISS xN snapshot must preserve prior scored darts');
assert(missOwner.includes("for(var i=0;i<step&&start+i<3;i++)cells[start+i]='X';"),'MISS xN must place new Xs from the current dart slot');
assert(missOwner.includes("},340);}setTimeout(function(){try{btn.classList.remove('sq-missx3-hit95');}catch(_){}},390);"),'MISS xN button ghost must be shortened');
assert(missOwner.includes("['pointerdown','touchstart','click'].forEach(function(type){document.addEventListener(type,handleMissX3,true);});"),'Fix95 capture ownership must remain explicit');

assert(renderer.includes('active.type === "snap"'),'renderer missing SNAP motion');
assert(renderer.includes('active.type === "shutter"'),'renderer missing SHUTTER motion');
assert(renderer.includes("prefers-reduced-motion: reduce"),'new motion primitives must respect reduced motion');
assert(renderer.includes('const bands = 4'),'shutter must use four alternating bands');
assert(renderer.includes('fxScale = 1 + (0.055 * decay)'),'snap must have a bounded slam scale');

for(const needle of [
  "__sqShowStoryBeat(__sqCommentaryVisitBeat, __visitStoryMs, 'hold')",
  "const base = kind === 'round' ? 1900 : 1600;"
]) assert(compat.includes(needle),`generated compatibility runtime missing: ${needle}`);

console.log('SC-053 DMD pacing + motion static acceptance PASS');
