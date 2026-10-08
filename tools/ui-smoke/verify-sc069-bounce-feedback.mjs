import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createController, makeMessage } from '../../src/live-game/dmd/controller.mjs';
import { createMotionSafeBackend } from '../../src/live-game/dmd/motion.mjs';

function scheduler() {
  let id = 0, now = 0;
  const jobs = new Map();
  return {
    set(fn, ms) { jobs.set(++id, { fn, at: now + ms }); return id; },
    clear(key) { jobs.delete(key); },
    // Let a native release win while a due timer remains undelivered.
    elapse(ms) { now += ms; },
    retain(key) { return jobs.get(key)?.fn; },
    run(key) { const job = jobs.get(key); if (!job) return false; jobs.delete(key); now = job.at; job.fn(); return true; },
    advance(ms) { const end = now + ms; for (;;) { const next = [...jobs].filter(([, j]) => j.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) break; this.run(next[0]); } now = end; },
    now: () => now,
    pending: () => [...jobs.keys()]
  };
}

const message = makeMessage({ kind: 'BOUNCE_OUT' });
assert.deepEqual(message, { priority: 10, headline: 'BOUNCE', subline: 'OUT', type: 'flash', duration: 520, fx: 'impact', bounceOut: true, haptic: null });

{
  const clock = scheduler(), renders = [], calls = [];
  const c = createController({ scheduler: clock, now: clock.now, maxQueue: 4, render: (z, o) => renders.push({ z, o }), clear: () => calls.push('clear'), restoreIdle: () => calls.push('idle'), haptics: { pulse() {}, cancel() {} } });
  c.emit({ kind: 'SHATEKI_RECORD', gameScore: 900 });
  c.emit({ kind: 'BOUNCE_OUT' });
  c.emit({ kind: 'MISS', dart: 2 });
  const activeTimer = clock.pending()[0];
  c.cancelBounceOut();
  assert.equal(c.snapshot().active.headline, 'NEW SHATEKI RECORD', 'BO cancellation preserves the active record');
  assert.deepEqual(c.snapshot().queue.map(m => m.headline), ['MISS'], 'only queued BO is removed');
  assert.deepEqual(clock.pending(), [activeTimer], 'record timer is untouched');
  assert.equal(renders.length, 1, 'queued cancellation does not force rendering');
  const unchanged = { state: c.snapshot(), timers: clock.pending(), calls: [...calls], renders: [...renders] };
  c.cancelBounceOut();
  assert.deepEqual({ state: c.snapshot(), timers: clock.pending(), calls, renders }, unchanged, 'non-BO cancellation is a complete no-op');
  c.emit({ kind: 'UNDO' });
  clock.run(activeTimer);
  assert.equal(c.snapshot().active, null, 'existing900ms low-priority stale filtering remains intact after the1150ms record');
  assert(!renders.some(r => r.z.z2 === 'BOUNCE' && r.z.z3 === 'OUT'), 'cancelled BO never replays after the record/Undo');
}

{
  const clock = scheduler(), renders = [], nativeCalls = [];
  const host = { __sqDmdShowTransientZones: (z, o) => { nativeCalls.push('transient'); renders.push({ z, o }); }, __sqDmdCancelTransientScenes: () => nativeCalls.push('cancel'), sqDmdShowZones: () => nativeCalls.push('legacy'), __sqDmdHardClearQueue: () => nativeCalls.push('hard-clear') };
  const { detectExistingBackend } = await import('../../src/live-game/dmd/controller.mjs');
  const c = createController({ ...detectExistingBackend(host), scheduler: clock, now: clock.now, haptics: { pulse() {}, cancel() {} } });
  c.emit({ kind: 'BOUNCE_OUT' });
  const removedTimer = clock.pending()[0];
  assert.deepEqual(renders[0], { z: { z2: 'BOUNCE', z3: 'OUT' }, o: { type: 'flash', ms: 520, fx: 'impact', bounceOut: true } });
  c.cancelBounceOut();
  c.emit({ kind: 'UNDO' });
  assert.equal(clock.run(removedTimer), false, 'active BO timer is retired');
  clock.advance(700);
  assert.equal(c.snapshot().active, null, 'Undo settles without BO replay');
  assert.deepEqual(renders.map(r => r.z.z2), ['BOUNCE OUT', 'THROW UNDONE']);
  assert(!nativeCalls.includes('legacy') && !nativeCalls.includes('hard-clear'), 'native legacy queue and baseline are never broadly cleared');
}

{
  const calls = [], base = { render: (z, o) => { calls.push({ z, o }); return 'ok'; } };
  const normal = createMotionSafeBackend(base, { matchMedia: () => ({ matches: false }) });
  const reduced = createMotionSafeBackend(base, { matchMedia: () => ({ matches: true }) });
  const opts = { type: 'flash', ms: 520, fx: 'impact', bounceOut: true };
  assert.equal(normal.render({ z2: 'BOUNCE', z3: 'OUT' }, opts), 'ok');
  assert.deepEqual(calls.at(-1).o, opts, 'normal BO flash/impact options remain intact');
  reduced.render({ z2: 'BOUNCE', z3: 'OUT' }, opts);
  assert.deepEqual(calls.at(-1).o, { type: 'hold', ms: 520, bounceOut: true, amp: 0 }, 'reduced BO removes both strobe type and impact FX');
  reduced.render({ z2: 'OTHER' }, { type: 'lastDartImg', ms: 900, fx: 'impact', amp: 3.4 });
  assert.deepEqual(calls.at(-1).o, { type: 'hold', ms: 900, fx: 'impact', amp: 0 }, 'existing non-BO adapter behaviour is unchanged');
}

// Model the exact production gesture owner with controlled timers and canonical
// record receipts. These are unit events; native click evidence belongs to the
// separate browser regression and retained public baseline traces.
const stageCss = fs.readFileSync(new URL('../../src/styles/live-game/classic-stage1.css', import.meta.url), 'utf8');
assert(stageCss.includes('#padBar.sq-bounce-out-flash button'), 'Bounce Out alert must target every throwpad button');
assert(stageCss.includes('background:#b4232f !important'), 'Bounce Out alert must force the red button surface');
assert(stageCss.includes('@media (prefers-reduced-motion:reduce)'), 'Bounce Out alert must retain a reduced-motion treatment');

const source = fs.readFileSync(new URL('../../src/live-game/live-v2.js', import.meta.url), 'utf8');
const start = source.indexOf('let __sqMissBouncePendingCancel = null;');
const end = source.indexOf("if (!window.__sqQuickEntryClickGuardBound)", start);
assert(start >= 0 && end > start);
const gestureSource = source.slice(start, end);
function fixture({ reject = false, feedbackThrows = false, catchUp = false } = {}) {
  const clock = scheduler(), events = [], classes = new Set(), padClasses = new Set(), handlers = new Map();
  const button = { style: {}, classList: { add: n => classes.add(n), remove: n => classes.delete(n) }, setPointerCapture() {}, addEventListener: (name, fn) => { handlers.set(name, fn); } };
  const padBar = { classList: { add: n => padClasses.add(n), remove: n => padClasses.delete(n), contains: n => padClasses.has(n) }, get offsetWidth(){ return 320; } };
  const state = { __gameToken: 1, currentPlayer: 0, currentRound: 0, currentDart: 0, history: [], players: ['ALPHA', 'BETA'] };
  const context = { state, document: { body: { dataset: { page: 'game' } }, getElementById: id => id === 'padBar' ? padBar : null }, window: { __sqDmdV2: { emit: e => { events.push(['feedback', e]); if (feedbackThrows) throw Error('display unavailable'); }, cancelBounceOut: () => events.push(['cancel-feedback']) } }, navigator: { vibrate: n => events.push(['vibrate', n]) }, performance: { now: clock.now }, setTimeout: clock.set.bind(clock), clearTimeout: clock.clear.bind(clock), __SQ_QUICK_ENTRY_HOLD_MS: 360,
    recordThrow(spec) { events.push(['record', spec]); if (reject) return; const s = context.state; s.history.push({ player: catchUp ? 1 : s.currentPlayer, round: s.currentRound, dartIndex: s.currentDart, throw: { kind: 'Miss', points: 0, ...(spec.kind === 'BounceOut' ? { bounceOut: true } : {}) } }); s.currentDart++; } };
  vm.createContext(context); vm.runInContext(gestureSource + '\n__sqBindMissBounceHold(button);', Object.assign(context, { button }));
  function fire(name, pointer = {}) { const e = { type: name, pointerType: 'mouse', button: 0, pointerId: 1, clientX: 10, clientY: 10, ...pointer, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; } }; handlers.get(name)?.(e); return e; }
  // Model the existing native click after the gesture's capture guard.
  function click() { const e = fire('click'); if (!e.stopped) context.recordThrow({ kind: 'Miss' }); return e; }
  return { context, clock, events, padClasses, fire, click, cancel: () => vm.runInContext('__sqCancelMissBounceFeedback()', context) };
}

{
  const f = fixture(); f.fire('pointerdown'); f.clock.advance(359);
  assert.equal(f.context.state.history.length, 0, 'threshold remains 360ms');
  f.clock.advance(1);
  assert.equal(f.context.state.history.length, 1);
  assert.deepEqual(f.events.map(e => e[0]), ['record', 'feedback', 'vibrate'], 'one accepted canonical record precedes optional feedback');
  assert.equal(f.padClasses.has('sq-bounce-out-flash'), true, 'accepted Bounce Out activates the full throwpad red alert');
  f.fire('pointerup'); assert(f.fire('click').stopped, 'held compatibility click is consumed');
  f.clock.advance(30); f.fire('pointerdown'); f.fire('pointerup');
  assert.equal(f.fire('click').stopped, false, 'a genuine next press within220ms remains usable');
  assert.equal(f.events.filter(e => e[0] === 'record').length, 1, 'quick tap has no second hold record');
  f.clock.advance(490);
  assert.equal(f.padClasses.has('sq-bounce-out-flash'), false, 'throwpad alert clears after its bounded window');
}
for (const opts of [{ reject: true }, { feedbackThrows: true }, { catchUp: true }]) {
  const f = fixture(opts); f.fire('pointerdown'); f.clock.advance(360);
  assert.equal(f.events.filter(e => e[0] === 'record').length, 1);
  assert.equal(f.context.state.history.length, opts.reject ? 0 : 1);
  assert.equal(f.events.filter(e => e[0] === 'feedback').length, opts.reject ? 0 : 1, 'feedback requires actual explicit BO receipt, including canonical catch-up cursor');
  assert.equal(f.padClasses.has('sq-bounce-out-flash'), !opts.reject, 'red pad alert follows only an accepted explicit Bounce Out receipt');
}
for (const mutate of [f => { f.context.document.body.dataset.page = 'details'; }, f => { f.context.state.__gameToken++; }, f => { f.context.state.currentPlayer = 1; }, f => { f.context.state.history = []; }, f => { f.context.state = { ...f.context.state }; }]) {
  const f = fixture(); f.fire('pointerdown'); mutate(f); f.clock.advance(360);
  assert.equal(f.events.filter(e => e[0] === 'record' || e[0] === 'feedback' || e[0] === 'vibrate').length, 0, 'stale page/game/cursor/history cannot record or cue');
  assert(f.fire('click').stopped, 'cancelled gesture consumes its late compatibility click');
}
{
  const f = fixture(); f.fire('pointerdown'); f.clock.advance(30); f.cancel(); f.clock.advance(600);
  assert.equal(f.context.state.history.length, 0, 'route cancellation retires the timer');
  assert.equal(f.events.filter(e => e[0] === 'record' || e[0] === 'feedback').length, 0);
  assert(f.fire('click').stopped);
}


// Regression for the observed Linux WebKit ordering: the 360ms callback is due,
// but native pointerup arrives first. This controlled scheduler proves the
// gesture mechanism; the existing native source/dist browser legs stay required.
function holdCallback(f) {
  const timer = f.clock.pending()[0], callback = f.clock.retain(timer);
  assert.equal(typeof callback, 'function', 'retain the actual armed hold callback');
  return { timer, callback };
}
function assertAcceptedHold(f, label) {
  assert.equal(f.events.filter(e => e[0] === 'record').length, 1, label + ': one canonical call');
  assert.equal(f.events.find(e => e[0] === 'record')[1].kind, 'BounceOut');
  assert.equal(f.context.state.history.length, 1, label + ': one accepted history entry');
  assert.equal(f.context.state.history[0].throw.bounceOut, true);
  assert.deepEqual(f.events.map(e => e[0]), ['record', 'feedback', 'vibrate'], label + ': feedback follows acceptance');
}
for (const elapsed of [360, 500]) {
  const f = fixture(); f.fire('pointerdown'); const { timer, callback } = holdCallback(f);
  f.clock.elapse(elapsed);
  assert.equal(f.context.state.history.length, 0, 'elapsing time alone does not deliver the hold timer');
  assert(f.clock.pending().includes(timer), 'the due hold callback is still pending before native release');
  const release = f.fire('pointerup');
  assert(release.prevented && release.stopped, 'eligible elapsed release consumes the hold');
  assert(f.click().stopped, 'elapsed release consumes its native compatibility click');
  assertAcceptedHold(f, 'elapsed ' + elapsed);
  assert(!f.clock.pending().includes(timer), 'release retires the pending timer');
  callback(); callback();
  assertAcceptedHold(f, 'late losing callbacks after elapsed ' + elapsed);
}
{
  const f = fixture(); f.fire('pointerdown'); const { callback } = holdCallback(f);
  f.clock.elapse(359.999); f.fire('pointerup');
  assert.equal(f.click().stopped, false, 'release below360ms remains an ordinary native tap');
  assert.equal(f.context.state.history.length, 1);
  assert.equal(f.events.filter(e => e[0] === 'record').length, 1);
  assert.equal(f.events.find(e => e[0] === 'record')[1].kind, 'Miss');
  assert.equal(f.context.state.history[0].throw.bounceOut, undefined);
  callback();
  assert.equal(f.events.filter(e => e[0] === 'record').length, 1, 'a cancelled short-tap callback cannot add a hold');
  assert.equal(f.events.filter(e => e[0] === 'feedback' || e[0] === 'vibrate').length, 0);
}
{
  const f = fixture(); f.fire('pointerdown'); const { callback } = holdCallback(f);
  f.clock.advance(360); assertAcceptedHold(f, 'normal360ms timer');
  f.clock.elapse(90); f.fire('pointerup'); assert(f.click().stopped);
  callback(); assertAcceptedHold(f, 'normal timer wins before release and late callback');
}
{
  const f = fixture(); f.fire('pointerdown'); const { callback } = holdCallback(f);
  f.clock.elapse(500); f.fire('pointercancel'); callback();
  assert.equal(f.events.filter(e => e[0] === 'record' || e[0] === 'feedback' || e[0] === 'vibrate').length, 0, 'overdue pointercancel cannot use the release fallback');
  assert.equal(f.clock.pending().length, 0, 'pointercancel retires the hold timer');
}
for (const distance of [18, 18.001]) {
  const f = fixture(); f.fire('pointerdown'); const { callback } = holdCallback(f);
  f.clock.elapse(100); f.fire('pointermove', { clientX: 10 + distance });
  f.clock.elapse(400); f.fire('pointerup'); const click = f.click(); callback();
  if (distance === 18) {
    assert(click.stopped); assertAcceptedHold(f, 'movement at18px');
  } else {
    assert.equal(click.stopped, false, 'movement beyond18px cancels only the hold');
    assert.deepEqual(f.events.filter(e => e[0] === 'record').map(e => e[1].kind), ['Miss']);
    assert.equal(f.events.filter(e => e[0] === 'feedback' || e[0] === 'vibrate').length, 0, 'movement cancellation cannot cue BO');
  }
}
{
  const f = fixture(); f.fire('pointerdown'); const { timer, callback } = holdCallback(f);
  f.clock.elapse(500); f.fire('pointerup', { pointerId: 2 });
  assert.equal(f.context.state.history.length, 0, 'unrelated pointerup cannot commit');
  assert(f.clock.pending().includes(timer), 'unrelated pointerup cannot retire the rightful gesture');
  f.fire('pointerup'); assert(f.click().stopped); callback(); assertAcceptedHold(f, 'rightful release after unrelated pointer');
}
{
  const f = fixture(); f.fire('pointerdown'); const first = holdCallback(f);
  f.clock.elapse(100); f.fire('pointerdown'); const second = holdCallback(f);
  assert.notEqual(first.timer, second.timer);
  f.clock.elapse(260); first.callback();
  assert.equal(f.context.state.history.length, 0, 'replaced gesture callback cannot commit');
  assert(f.clock.pending().includes(second.timer), 'old callback cannot clear the current hold');
  f.clock.elapse(101); f.fire('pointerup'); assert(f.click().stopped);
  first.callback(); second.callback(); assertAcceptedHold(f, 'replacement gesture owns its callback');
}
const staleReleaseGuards = {
  page: f => { f.context.document.body.dataset.page = 'details'; },
  state: f => { f.context.state = { ...f.context.state }; },
  token: f => { f.context.state.__gameToken++; },
  historyIdentity: f => { f.context.state.history = []; },
  historyLength: f => { f.context.state.history.push({ throw: { kind: 'Miss', points: 0 } }); },
  player: f => { f.context.state.currentPlayer = 1; },
  round: f => { f.context.state.currentRound++; },
  dart: f => { f.context.state.currentDart++; },
  actor: f => { f.context.state.players[0] = 'REPLACEMENT'; }
};
for (const [name, mutate] of Object.entries(staleReleaseGuards)) {
  const f = fixture(); f.fire('pointerdown'); const { callback } = holdCallback(f);
  f.clock.elapse(500); mutate(f); f.fire('pointerup'); assert(f.click().stopped, name + ': stale compatibility click is consumed'); callback();
  assert.equal(f.events.filter(e => e[0] === 'record' || e[0] === 'feedback' || e[0] === 'vibrate').length, 0, name + ': overdue release and old callback cannot record or cue');
  assert.equal(f.clock.pending().length, 0, name + ': stale hold timer is retired');
}
{
  const f = fixture(); f.fire('pointerdown'); const { callback } = holdCallback(f);
  f.clock.elapse(500); f.cancel(); f.fire('pointerup'); assert(f.click().stopped); callback();
  assert.equal(f.context.state.history.length, 0, 'explicit navigation cancellation survives overdue release and callback');
  assert.equal(f.events.filter(e => e[0] === 'record' || e[0] === 'feedback' || e[0] === 'vibrate').length, 0);
}
{
  const f = fixture({ reject: true }); f.fire('pointerdown'); const { callback } = holdCallback(f);
  f.clock.elapse(500); f.fire('pointerup'); assert(f.click().stopped); callback();
  assert.equal(f.events.filter(e => e[0] === 'record').length, 1, 'canonical rejection receives exactlyone attempted hold');
  assert.equal(f.context.state.history.length, 0, 'canonical rejection remains authoritative');
  assert.equal(f.events.filter(e => e[0] === 'feedback' || e[0] === 'vibrate').length, 0, 'unaccepted hold cannot cue or vibrate');
}
{
  const f = fixture(); f.fire('pointerdown'); f.clock.elapse(500); f.fire('pointerup'); assert(f.click().stopped);
  f.clock.elapse(1); f.fire('pointerdown'); f.clock.elapse(1); f.fire('pointerup');
  assert.equal(f.click().stopped, false, 'genuine next press1ms after release remains usable within220ms');
  assert.deepEqual(f.events.filter(e => e[0] === 'record').map(e => e[1].kind), ['BounceOut', 'Miss']);
  assert.equal(f.context.state.history.length, 2);
  assert.equal(f.context.state.history[1].throw.bounceOut, undefined);
  assert.equal(f.events.filter(e => e[0] === 'feedback').length, 1, 'only the accepted hold cues BO');
}

console.log('SC-069 owned Bounce Out gesture/receipt, queue cancellation and reduced-motion contracts PASS');
