import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as DMD from '../../src/live-game/dmd/controller.mjs';

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

function fakeDocument(){
  const listeners = new Map();
  return {
    hidden:false,
    addEventListener(type, fn){ listeners.set(type, fn); },
    removeEventListener(type, fn){ if (listeners.get(type) === fn) listeners.delete(type); },
    fire(type){ const fn = listeners.get(type); if (fn) fn(); },
    has(type){ return listeners.has(type); }
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
  assert.equal(DMD.makeMessage({kind:'PB_PACE'}).headline, 'PB_PACE', 'unapproved pace concepts stay generic and are not promoted to catalogue semantics');
  console.log('PASS copy catalogue + special-round + existing image mapping');
})();

(function testPriorityAndTimerProtection(){
  const scheduler = fakeScheduler();
  const renders = [];
  let clears = 0;
  let idle = 0;
  const c = DMD.createController({
    scheduler,
    render:(z,o)=>renders.push({z,o}),
    clear:()=>{ clears++; },
    restoreIdle:()=>{ idle++; },
    haptics:{pulse(){},cancel(){}},
    maxQueue:2
  });
  c.emit({kind:'HIT_SINGLE',points:16,total:100});
  const throwTimer = 1;
  c.emit({kind:'SHATEKI_RECORD',gameScore:800});
  assert.equal(c.snapshot().active.headline, 'NEW SHATEKI RECORD');
  assert.equal(renders.at(-1).z.z2, 'NEW SHATEKI RECORD');
  assert.equal(scheduler.run(throwTimer), false, 'pre-empted throw timer is cancelled');
  scheduler.runNext();
  assert.equal(idle, 1, 'latest event restores idle');
  assert(clears >= 2, 'backend queue clears on priority replacement');
  console.log('PASS priority pre-emption + stale timer cancellation');
})();

(function testStaleLowPriorityEviction(){
  const scheduler = fakeScheduler();
  let clock = 0;
  const renders = [];
  const c = DMD.createController({
    scheduler,
    now:()=>clock,
    render:(z)=>renders.push(z.z2),
    clear(){},
    restoreIdle(){},
    haptics:{pulse(){},cancel(){}},
    maxQueue:3,
    staleLowPriorityMs:900
  });
  c.emit({kind:'SHATEKI_RECORD',gameScore:900});
  c.emit({kind:'HIT_SINGLE',points:10,total:10});
  c.emit({kind:'VISIT_COMPLETE',visitPoints:30,total:30});
  assert.equal(c.snapshot().queue.length, 2);
  clock = 1200;
  scheduler.runNext();
  assert.equal(c.snapshot().queue.length, 0, 'stale throw/visit messages are discarded');
  assert.deepEqual(renders, ['NEW SHATEKI RECORD'], 'stale low-priority feedback never replays after record scene');
  console.log('PASS stale low-priority queue eviction');
})();

(function testIdleBaselineSeparation(){
  const scheduler = fakeScheduler();
  const renders = [];
  let restored = null;
  const c = DMD.createController({
    scheduler,
    render:(z)=>renders.push(z.z2),
    clear(){},
    restoreIdle:(idle)=>{ restored = idle; },
    haptics:{pulse(){},cancel(){}}
  });
  c.emit({kind:'PLAYER_UP',player:'THOM',target:'20'});
  assert.equal(c.snapshot().active, null, 'idle baseline is not a transient active scene');
  assert.equal(c.snapshot().idle.headline, 'THOM UP');
  c.emit({kind:'HIT_DOUBLE',points:40,total:40});
  scheduler.runNext();
  assert.equal(restored.headline, 'THOM UP');
  console.log('PASS idle baseline / transient separation');
})();

(function testVisibilityBinding(){
  const doc = fakeDocument();
  const states = [];
  const controller = { suspend(v){ states.push(v); } };
  const unbind = DMD.bindVisibility(controller, doc);
  assert.equal(doc.has('visibilitychange'), true, 'visibility listener binds to document');
  assert.deepEqual(states, [false]);
  doc.hidden = true;
  doc.fire('visibilitychange');
  doc.hidden = false;
  doc.fire('visibilitychange');
  assert.deepEqual(states, [false,true,false]);
  unbind();
  assert.equal(doc.has('visibilitychange'), false);
  console.log('PASS document visibility lifecycle');
})();

(function testHapticCapabilitySafety(){
  const calls = [];
  const supported = DMD.createHaptics({navigator:{vibrate:(p)=>{ calls.push(p); return true; }},enabled:true});
  assert.equal(supported.supported(), true);
  assert.equal(supported.pulse('treble'), true);
  assert.deepEqual(calls[0], DMD.HAPTIC_PATTERNS.treble);
  const defaultOff = DMD.createHaptics({navigator:{vibrate:()=>true}});
  assert.equal(defaultOff.enabled(), false, 'web haptics remain opt-in/off by default');
  const unsupported = DMD.createHaptics({navigator:{},enabled:true});
  assert.equal(unsupported.supported(), false);
  assert.equal(unsupported.pulse('hit'), false);
  console.log('PASS haptics capability-safe / disabled by default');
})();

(function testVisualOwnershipContract(){
  assert.equal(typeof DMD.visualCss, 'undefined', 'controller must not own CSS');
  assert.equal(typeof DMD.installVisualShell, 'undefined', 'controller must not inject style tags');
  const css = fs.readFileSync('src/styles/live-game/topbar.css', 'utf8');
  const start = css.indexOf('/* >>> SC-030 DMD V2 CABINET TREATMENT START */');
  const end = css.indexOf('/* <<< SC-030 DMD V2 CABINET TREATMENT END */');
  assert(start >= 0 && end > start, 'semantic DMD cabinet block exists');
  const block = css.slice(start, end);
  assert(block.includes('#sqDmdWrap'));
  assert(block.includes('#sqDmdCanvas'));
  assert(block.includes('prefers-reduced-motion'));
  assert(block.includes('radial-gradient'));
  assert(!/\bheight\s*:/.test(block), 'DMD skin does not alter the fixed footprint');
  assert(!/mix-blend-mode|rainbow|hsl\(/i.test(block), 'DMD skin avoids flashing-prone/nightclub effects');
  console.log('PASS semantic DMD visual ownership contract');
})();

console.log('SC-030 DMD V2 MODULAR CONTROLLER: ALL PASS');
