import assert from 'node:assert/strict';
import fs from 'node:fs';

const live=fs.readFileSync('src/live-game/live-v2.js','utf8');
const engine=fs.readFileSync('src/game/engine.js','utf8');
const dmd=fs.readFileSync('src/legacy/scripts/inline-007.js','utf8');

assert(live.includes("SXP-04 Gate 2: presentation is additive only"), 'Gate 2 Vs Shadow guard missing');
assert(!/setTimeout\s*\(\s*\(\)\s*=>\s*\{\s*try\{\s*missGo\(\)/s.test(live),
  'Vs Shadow SKIP must not delay missGo behind presentation');
assert(live.includes("try{ missGo(); }catch(_){ }\n      try{ window.__sqSkipInProgress = false; }catch(_){ }"),
  'Vs Shadow SKIP must commit canonical state synchronously');

assert(live.includes("b.onclick = ()=>{ try{ window.__sqDmdHardClearQueue?.(); }catch(_){ } recordThrow({ kind: k }); };"),
  'number-round S/D/T must call recordThrow directly after presentation cancel');
assert(live.includes("b.onclick = () => { try{ window.__sqDmdHardClearQueue?.(); }catch(_){ } recordThrow({ sector: s }); };"),
  'D/T sector input must call recordThrow directly');
assert(live.includes("outerBtn.onclick = () => { try{ window.__sqDmdHardClearQueue?.(); }catch(_){ } recordThrow({ bull: 'Outer' }); };"),
  'Outer Bull must call recordThrow directly');
assert(live.includes("innerBtn.onclick = () => { try{ window.__sqDmdHardClearQueue?.(); }catch(_){ } recordThrow({ bull: 'Inner' }); };"),
  'Inner Bull must call recordThrow directly');

assert.equal((live.match(/await new Promise\(r=>setTimeout\(r,280\)\);/g)||[]).length,0,
  'MISS scoring must not wait on 280ms presentation');
assert.equal((live.match(/SXP-04 Gate 1: gameplay\/state commits first/g)||[]).length,2,
  'both canonical MISS paths must remain state-first');

const undoPos=live.indexOf('function __sqRunUndoActionWithDmd()');
assert(undoPos>=0,'Undo action helper missing');
const undoBlock=live.slice(undoPos,live.indexOf('function __sqRunSkipActionWithDmd()',undoPos));
assert(undoBlock.indexOf('undo();')>=0,'Undo must mutate state synchronously');
assert(undoBlock.indexOf('undo();') < undoBlock.lastIndexOf("window.__sqDmdV2.emit({ kind:'UNDO' })"),
  'normal Undo presentation must follow state mutation');

assert(engine.includes('const __sqDmdStage3Token = Number(window.__sqDmdFlowToken || 0);'),
  'delayed visit presentation must carry a flow token');
assert(engine.includes('Number(window.__sqDmdFlowToken || 0) === __sqDmdStage3Token'),
  'delayed visit presentation must cancel when a newer input owns the DMD');
assert(dmd.includes('window.__sqDmdFlowToken = (Number(window.__sqDmdFlowToken || 0) + 1);'),
  'hard-clear must invalidate transient presentation ownership');

console.log('SXP-04 Gate 2 contract PASS: SCORE/MISS/UNDO/SKIP state is not timer-gated by presentation.');
