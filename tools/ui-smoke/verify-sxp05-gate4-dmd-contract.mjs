import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as DMD from '../../src/live-game/dmd/controller.mjs';

function fakeScheduler(){
  let next=1;
  const jobs=new Map();
  return {
    set(fn,ms){ const id=next++; jobs.set(id,{fn,ms}); return id; },
    clear(id){ jobs.delete(id); },
    runNext(){ const id=[...jobs.keys()][0]; if(!id) return false; const job=jobs.get(id); jobs.delete(id); job.fn(); return true; },
    size(){ return jobs.size; }
  };
}

const P=DMD.PRIORITY;
const expected=[
  ['HIT_SINGLE',P.THROW],['HIT_DOUBLE',P.THROW],['HIT_TREBLE',P.THROW],
  ['OUTER_BULL',P.THROW],['BULLSEYE',P.THROW],['MISS',P.THROW],
  ['SCRATCH',P.VISIT],['VISIT_COMPLETE',P.VISIT],
  ['ROUND_TARGET',P.VISIT],['ROUND_DOUBLES',P.VISIT],['ROUND_TREBLES',P.VISIT],['ROUND_BULL',P.VISIT],
  ['UNDO',P.VISIT],['SKIP',P.VISIT],['CATCH_UP',P.VISIT],
  ['NEW_LEADER',P.COMPETITIVE],['TIED',P.COMPETITIVE],['LATE_CLOSE',P.COMPETITIVE],['FINAL_BULL_TIMER',P.COMPETITIVE]
];
for(const [kind,priority] of expected){
  assert.equal(DMD.makeMessage({kind,points:50,seconds:30}).priority,priority,`${kind} priority drift`);
}
const bull=DMD.makeMessage({kind:'BULLSEYE',points:50,total:50});
assert.equal(bull.type,'bullseyeHit');
assert.equal(bull.duration,1300,'Bullseye premium THROW must remain bounded to 1300ms');
const timer=DMD.makeMessage({kind:'FINAL_BULL_TIMER',player:'ALPHA',seconds:30});
assert.equal(timer.duration,0,'Final Bull countdown must be controller-persistent, not an expiring transient');
assert.match(timer.subline,/30S/);

const classic=DMD.makeEventToken({kind:'HIT_SINGLE',mode:'classic',round:1,dart:1,player:'A',points:10});
const practice=DMD.makeEventToken({kind:'HIT_SINGLE',mode:'practice',round:1,dart:1,player:'A',points:10});
assert.notEqual(classic,practice,'event token must isolate game modes');

{
  const scheduler=fakeScheduler();
  let baseline={kind:'PLAYER_UP',player:'ALPHA',target:'10'};
  let restored=null;
  const renders=[];
  const c=DMD.createController({
    scheduler,
    render:(z)=>renders.push(z.z2),
    clear(){},
    restoreIdle:(b)=>{ restored=b; },
    baselineProvider:()=>baseline,
    haptics:{pulse(){},cancel(){}}
  });
  c.emit({kind:'SHATEKI_RECORD',gameScore:900,eventToken:'record'});
  const suppressed=c.emit({kind:'VISIT_COMPLETE',visitPoints:30,eventToken:'low'});
  assert.equal(suppressed.__suppressed,true,'lower-tier async event must drop, never stale-replay');
  assert.equal(c.snapshot().queue.length,0);

  const input=c.emit({kind:'HIT_DOUBLE',points:20,total:20,eventToken:'input',playerInput:true});
  assert.equal(input.headline,'DOUBLE +20');
  assert.equal(c.snapshot().active.headline,'DOUBLE +20','legitimate scoring input must win immediately');
  assert.equal(c.snapshot().lastDecision.action,'input-preempt');

  baseline={kind:'PLAYER_UP',player:'BETA',target:'11'};
  assert.equal(scheduler.runNext(),true);
  assert.equal(restored.headline,'BETA UP','restore must re-read fresh player/target state');
  assert.equal(restored.subline,'TARGET 11');
}

{
  const scheduler=fakeScheduler();
  const renders=[];
  const c=DMD.createController({
    scheduler,now:()=>1000,
    render:(z)=>renders.push(z.z2),clear(){},restoreIdle(){},
    haptics:{pulse(){},cancel(){}}
  });
  c.emit({kind:'MISS',dart:1,eventToken:'same',mode:'classic'});
  const duplicate=c.emit({kind:'MISS',dart:1,eventToken:'same',mode:'classic'});
  assert.equal(duplicate.__deduped,true,'same accepted-event token must not render twice');
  assert.equal(renders.length,1);
}

const engine=fs.readFileSync(new URL('../../src/game/engine.js',import.meta.url),'utf8');
const live=fs.readFileSync(new URL('../../src/live-game/live-v2.js',import.meta.url),'utf8');
assert(engine.includes('const __SQ_FINAL_BULL_RETURN_MS=30000;'),'30-second Final Bull enforcement must remain canonical and presentation-independent');
for(const required of [
  "__sqDmdGate4Emit('CATCH_UP'",
  "__sqDmdGate4Emit('FINAL_BULL_TIMER'",
  "__sqDmdGate4Emit('VISIT_COMPLETE'",
  "__sqDmdGate4Emit('NEW_LEADER'",
  "__sqDmdGate4Emit('TIED'",
  "__sqDmdGate4Emit('LATE_CLOSE'"
]) assert(engine.includes(required),`Gate 4 engine routing missing: ${required}`);
assert(live.includes("__sqDmdGate4Emit('UNDO'"),'successful Undo must route through Gate 4 controller');
assert(live.includes("__sqDmdGate4Emit('SKIP'"),'accepted Skip must route through Gate 4 controller');
assert(live.includes("specialMissSeq && window.__sqDmdGate4ControllerActive?.()"),'bulk Miss must avoid competing legacy frames under Gate 4');

console.log('SXP-05 GATE 4 DMD CONTRACT: ALL PASS');
