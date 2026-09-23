import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as DMD from '../../src/live-game/dmd/controller.mjs';
import { createModernHdProofBackend } from '../../src/live-game/dmd/modern-hd-backend.mjs';

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

(function testCopyAndPriorityContract(){
  assert.equal(DMD.makeMessage({kind:'HIT_SINGLE',points:17,total:217}).headline, 'SINGLE +17');
  assert.equal(DMD.makeMessage({kind:'HIT_DOUBLE',points:34,total:234}).headline, 'DOUBLE +34');
  assert.equal(DMD.makeMessage({kind:'HIT_TREBLE',points:51,total:251}).headline, 'TREBLE +51');
  assert.equal(DMD.makeMessage({kind:'MISS',dart:2}).subline, 'DART 2 OF 3');
  assert.equal(DMD.makeMessage({kind:'BULLSEYE'}).priority, DMD.PRIORITY.THROW, 'Bullseye remains THROW tier');
  assert.equal(DMD.makeMessage({kind:'ROUND_DOUBLES'}).priority, DMD.PRIORITY.VISIT, 'round transition is VISIT');
  assert.equal(DMD.makeMessage({kind:'ROUND_TREBLES'}).priority, DMD.PRIORITY.VISIT, 'round transition is VISIT');
  assert.equal(DMD.makeMessage({kind:'ROUND_BULL'}).priority, DMD.PRIORITY.VISIT, 'round transition is VISIT');
  assert.equal(DMD.makeMessage({kind:'LAST_DART_HERO'}).type, 'lastDartImg');
  assert.equal(DMD.makeMessage({kind:'DESMOND_DELIGHT'}).type, 'desmondImg');
  assert.equal(DMD.makeMessage({kind:'VOLDY'}).type, 'voldyImg');
  assert.equal(DMD.makeMessage({kind:'PB_PACE'}).headline, 'PB_PACE', 'unapproved pace concepts stay generic');
  console.log('PASS copy catalogue + Experience 03 priority corrections');
})();

(function testSceneDescriptorContract(){
  const dynamic = DMD.makeSceneDescriptor(
    {kind:'HIT_SINGLE',points:20,total:100,eventToken:'game1-r1-d1'},
    DMD.makeMessage({kind:'HIT_SINGLE',points:20,total:100})
  );
  assert.equal(dynamic.architecture, DMD.ARCHITECTURE);
  assert.equal(dynamic.family, 'THROW');
  assert.equal(dynamic.sceneType, 'dynamic');
  assert.equal(dynamic.token, 'GAME1-R1-D1');

  const replacement = DMD.makeSceneDescriptor(
    {kind:'BULLSEYE',total:150,eventToken:'game1-bull'},
    DMD.makeMessage({kind:'BULLSEYE',total:150})
  );
  assert.equal(replacement.family, 'THROW');
  assert.equal(replacement.sceneType, 'replacement', 'premium Bull remains THROW but uses replacement presentation path');
  console.log('PASS renderer-neutral semantic scene descriptor');
})();

(function testPriorityPreemptionAndTimerProtection(){
  const scheduler = fakeScheduler();
  const renders = [];
  let clears = 0;
  let idle = 0;
  const c = DMD.createController({
    scheduler,
    render:(z,o)=>renders.push({z,o}),
    clear:()=>{ clears++; },
    restoreIdle:()=>{ idle++; },
    haptics:{pulse(){},cancel(){}}
  });
  c.emit({kind:'HIT_SINGLE',points:16,total:100,eventToken:'throw-1'});
  const throwTimer = 1;
  c.emit({kind:'SHATEKI_RECORD',gameScore:800,eventToken:'record-1'});
  assert.equal(c.snapshot().active.headline, 'NEW SHATEKI RECORD');
  assert.equal(renders.at(-1).z.z2, 'NEW SHATEKI RECORD');
  assert.equal(scheduler.run(throwTimer), false, 'pre-empted throw timer is cancelled');
  scheduler.runNext();
  assert.equal(idle, 1, 'latest event restores idle');
  assert(clears >= 2, 'backend clears on priority replacement');
  console.log('PASS priority pre-emption + stale timer cancellation');
})();

(function testSuppressedLowerTierNeverReplays(){
  const scheduler = fakeScheduler();
  const renders = [];
  const c = DMD.createController({
    scheduler,
    render:(z)=>renders.push(z.z2),
    clear(){},
    restoreIdle(){ renders.push('BASELINE'); },
    haptics:{pulse(){},cancel(){}}
  });
  c.emit({kind:'SHATEKI_RECORD',gameScore:900,eventToken:'record-2'});
  const result = c.emit({kind:'HIT_SINGLE',points:10,total:10,eventToken:'async-low'});
  assert.equal(result.__suppressed, true, 'lower-tier async presentation is explicitly suppressed');
  assert.equal(c.snapshot().queue.length, 0, 'suppressed lower-tier presentation is not replay queued');
  assert.equal(c.snapshot().lastDecision.action, 'suppress-drop');
  scheduler.runNext();
  assert.deepEqual(renders, ['NEW SHATEKI RECORD','BASELINE'], 'suppressed throw never replays after record');
  console.log('PASS drop-not-replay suppression');
})();

(function testLegitimateInputAlwaysWins(){
  const scheduler = fakeScheduler();
  const renders = [];
  const c = DMD.createController({
    scheduler,
    render:(z)=>renders.push(z.z2),
    clear(){ renders.push('CLEAR'); },
    restoreIdle(){},
    haptics:{pulse(){},cancel(){}}
  });
  c.emit({kind:'SHATEKI_RECORD',gameScore:900,eventToken:'record-3'});
  const recordTimer = 1;
  c.emit({kind:'HIT_SINGLE',points:20,total:20,eventToken:'accepted-input-1',playerInput:true});
  assert.equal(c.snapshot().active.headline, 'SINGLE +20');
  assert.equal(c.snapshot().lastDecision.action, 'input-preempt');
  assert.equal(scheduler.run(recordTimer), false, 'legitimate input cancels old cinematic timer');
  assert.equal(renders.at(-1), 'SINGLE +20');
  console.log('PASS legitimate player input hard-cancels presentation');
})();

(function testDeterministicTokenDedupe(){
  const scheduler = fakeScheduler();
  const renders = [];
  const haptics = [];
  const c = DMD.createController({
    scheduler,
    render:(z)=>renders.push(z.z2),
    clear(){},
    restoreIdle(){},
    haptics:{pulse(v){haptics.push(v);},cancel(){}},
    now:()=>1000
  });
  c.emit({kind:'HIT_DOUBLE',points:40,total:40,eventToken:'same-event'});
  const duplicate = c.emit({kind:'HIT_DOUBLE',points:40,total:40,eventToken:'same-event'});
  assert.equal(duplicate.__deduped, true);
  assert.deepEqual(renders, ['DOUBLE +40']);
  assert.equal(haptics.length, 1, 'duplicate token cannot duplicate haptic');
  assert.equal(c.snapshot().lastDecision.action, 'dedupe');
  console.log('PASS deterministic event-token de-duplication');
})();

(function testFreshBaselineProvider(){
  const scheduler = fakeScheduler();
  let current = {kind:'PLAYER_UP',player:'THOM',target:'20'};
  let restored = null;
  const c = DMD.createController({
    scheduler,
    render(){},
    clear(){},
    restoreIdle:(idle)=>{ restored = idle; },
    baselineProvider:()=>current,
    haptics:{pulse(){},cancel(){}}
  });
  c.emit(current);
  c.emit({kind:'HIT_DOUBLE',points:40,total:40,eventToken:'throw-fresh'});
  current = {kind:'PLAYER_UP',player:'DAVID',target:'12'};
  scheduler.runNext();
  assert.equal(restored.headline, 'DAVID UP', 'restoration re-reads current baseline instead of cached pre-event baseline');
  assert.equal(restored.subline, 'TARGET 12');
  console.log('PASS fresh current-state baseline restoration hook');
})();

(function testModernHdBackendSeam(){
  const calls = [];
  const base = {
    render(z,o){ calls.push(['render',z,o]); },
    clear(){ calls.push(['clear']); },
    restoreIdle(b){ calls.push(['restore',b]); },
    transient:true
  };
  const backend = createModernHdProofBackend(base);
  assert.equal(backend.architecture, 'modern-hd-proof-backend');
  backend.renderScene({
    architecture:DMD.ARCHITECTURE,
    sceneId:'SHATEKI_RECORD',
    token:'record-token',
    family:'RECORD',
    sceneType:'replacement',
    renderType:'hold',
    duration:1200,
    headline:'NEW SHATEKI RECORD',
    subline:'812',
    amp:3.2
  });
  assert.equal(calls[0][0], 'render');
  assert.equal(calls[0][1].z2, 'NEW SHATEKI RECORD');
  assert.equal(calls[0][2].__sqSceneToken, 'record-token');
  assert.equal(calls[0][2].__sqSceneType, 'replacement');
  console.log('PASS renderer-neutral scene → Modern HD proof backend seam');
})();

(function testTransientBackendAdapter(){
  const calls = [];
  const host = {
    __sqDmdShowTransientZones(z,o){ calls.push(['transient',z,o]); },
    __sqDmdCancelTransientScenes(){ calls.push(['cancel']); },
    sqDmdShowZones(){ calls.push(['legacy-render']); },
    __sqDmdHardClearQueue(){ calls.push(['hard-clear']); },
    sqDmdSetIdle(){ calls.push(['legacy-idle']); }
  };
  const backend = DMD.detectExistingBackend(host);
  assert.equal(backend.transient, true);
  backend.render({z2:'SAFE',z3:'BASELINE'}, {type:'hold',ms:100});
  backend.clear();
  backend.restoreIdle();
  assert.deepEqual(calls.map(x=>x[0]), ['transient','cancel','cancel']);
  console.log('PASS non-destructive transient backend fallback');
})();

(function testVisibilityBinding(){
  const doc = fakeDocument();
  const states = [];
  const controller = { suspend(v){ states.push(v); } };
  const unbind = DMD.bindVisibility(controller, doc);
  assert.equal(doc.has('visibilitychange'), true);
  assert.deepEqual(states, [false]);
  doc.hidden = true; doc.fire('visibilitychange');
  doc.hidden = false; doc.fire('visibilitychange');
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
  assert.equal(defaultOff.enabled(), false);
  const unsupported = DMD.createHaptics({navigator:{},enabled:true});
  assert.equal(unsupported.supported(), false);
  assert.equal(unsupported.pulse('hit'), false);
  console.log('PASS haptics capability-safe / disabled by default');
})();

(function testVisualOwnershipContract(){
  assert.equal(typeof DMD.visualCss, 'undefined');
  assert.equal(typeof DMD.installVisualShell, 'undefined');
  const css = fs.readFileSync('src/styles/live-game/topbar.css', 'utf8');
  const start = css.indexOf('/* >>> SC-030 DMD V2 CABINET TREATMENT START */');
  const end = css.indexOf('/* <<< SC-030 DMD V2 CABINET TREATMENT END */');
  assert(start >= 0 && end > start);
  const block = css.slice(start, end);
  assert(block.includes('#sqDmdWrap'));
  assert(block.includes('#sqDmdCanvas'));
  assert(block.includes('prefers-reduced-motion'));
  assert(!/\bheight\s*:/.test(block), 'DMD proof must not alter fixed footprint');
  console.log('PASS DMD visual ownership boundary');
})();

console.log('SC-030 / SXP05 GATE 3 DMD CONTROLLER: ALL PASS');
