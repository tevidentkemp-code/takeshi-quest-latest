const assert = require('assert/strict');
const DMD = require('../../assets/js/dmd-v2.js');

function fakeScheduler(){
  let next = 1;
  const jobs = new Map();
  return {
    set(fn, ms){ const id = next++; jobs.set(id, {fn,ms}); return id; },
    clear(id){ jobs.delete(id); },
    run(id){ const job = jobs.get(id); if (!job) return false; jobs.delete(id); job.fn(); return true; },
    runNext(){ const id = [...jobs.keys()][0]; return id ? this.run(id) : false; },
    size(){ return jobs.size; }
  };
}

(function testCopyContract(){
  assert.equal(DMD.makeMessage({kind:'HIT_SINGLE',points:17,total:217}).headline, 'SINGLE +17');
  assert.equal(DMD.makeMessage({kind:'HIT_DOUBLE',points:34,total:234}).headline, 'DOUBLE +34');
  assert.equal(DMD.makeMessage({kind:'HIT_TREBLE',points:51,total:251}).headline, 'TREBLE +51');
  assert.equal(DMD.makeMessage({kind:'MISS',dart:2}).subline, 'DART 2 OF 3');
  assert.deepEqual(
    [DMD.makeMessage({kind:'ROUND_DOUBLES'}).headline, DMD.makeMessage({kind:'ROUND_TREBLES'}).headline, DMD.makeMessage({kind:'ROUND_BULL'}).headline],
    ['DOUBLES','TREBLES','BULL']
  );
  assert.equal(DMD.makeMessage({kind:'LAST_DART_HERO'}).type, 'lastDartImg');
  assert.equal(DMD.makeMessage({kind:'DESMOND_DELIGHT'}).type, 'desmondImg');
  assert.equal(DMD.makeMessage({kind:'VOLDY'}).type, 'voldyImg');
  assert.equal(DMD.makeMessage({kind:'PB_PACE'}).headline, 'PB_PACE', 'unapproved pace concepts are not a canonical catalogue event');
  console.log('PASS copy catalogue + special-round + legacy image mapping');
})();

(function testPriorityAndStaleTimerProtection(){
  const scheduler = fakeScheduler();
  const renders = [];
  let clears = 0;
  let idle = 0;
  const c = DMD.createController({
    scheduler,
    render:(z,o)=>renders.push({z,o}),
    clear:()=>{clears++;},
    restoreIdle:()=>{idle++;},
    haptics:{pulse(){},cancel(){}},
    maxQueue:2
  });
  c.emit({kind:'HIT_SINGLE',points:16,total:100});
  const throwTimer = 1;
  c.emit({kind:'SHATEKI_RECORD',gameScore:800});
  assert.equal(c.snapshot().active.headline, 'NEW SHATEKI RECORD');
  assert.equal(renders.at(-1).z.z2, 'NEW SHATEKI RECORD');
  assert.equal(scheduler.run(throwTimer), false, 'preempted throw timer was cancelled');
  scheduler.runNext();
  assert.equal(idle, 1, 'latest event alone restores idle');
  assert(clears >= 2, 'backend queue clears on priority replacement');
  console.log('PASS priority preemption + stale timer cancellation');
})();

(function testBoundedQueue(){
  const scheduler = fakeScheduler();
  const c = DMD.createController({scheduler, render(){}, clear(){}, restoreIdle(){}, haptics:{pulse(){},cancel(){}}, maxQueue:2});
  c.emit({kind:'SHATEKI_RECORD',gameScore:900});
  c.emit({kind:'HIT_SINGLE',points:10,total:10});
  c.emit({kind:'VISIT_COMPLETE',visitPoints:30,total:30});
  c.emit({kind:'MISS',dart:1});
  const queued = c.snapshot().queue;
  assert.equal(queued.length, 2);
  assert.deepEqual(queued.map(x=>x.headline), ['VISIT +30','SINGLE +10'], 'queue keeps the two most valuable pending events');
  console.log('PASS bounded priority queue');
})();

(function testHapticCapabilitySafety(){
  const calls = [];
  const supported = DMD.createHaptics({navigator:{vibrate:(p)=>{calls.push(p);return true;}},enabled:true});
  assert.equal(supported.supported(), true);
  assert.equal(supported.pulse('treble'), true);
  assert.deepEqual(calls[0], DMD.HAPTIC_PATTERNS.treble);
  const unsupported = DMD.createHaptics({navigator:{},enabled:true});
  assert.equal(unsupported.supported(), false);
  assert.equal(unsupported.pulse('hit'), false);
  console.log('PASS haptics capability-safe / unsupported browsers fail closed');
})();

(function testVisualShellContract(){
  const css = DMD.visualCss();
  assert(css.includes('#v2InfoDmd'));
  assert(css.includes('#sqDmdCanvas'));
  assert(css.includes('prefers-reduced-motion'));
  assert(!css.includes('height:'), 'module does not change fixed DMD height');
  console.log('PASS visual shell preserves footprint + reduced-motion path');
})();

console.log('SC-030 DMD V2 MODULE: ALL PASS');
