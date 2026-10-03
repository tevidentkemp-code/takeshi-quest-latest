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
    run(key) { const job = jobs.get(key); if (!job) return false; jobs.delete(key); now = job.at; job.fn(); return true; },
    advance(ms) { const end = now + ms; for (;;) { const next = [...jobs].filter(([, j]) => j.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!next) break; this.run(next[0]); } now = end; },
    now: () => now,
    pending: () => [...jobs.keys()]
  };
}

const message = makeMessage({ kind: 'BOUNCE_OUT' });
assert.deepEqual(message, { priority: 10, headline: 'BOUNCE OUT', subline: '', type: 'flash', duration: 420, fx: 'impact', bounceOut: true, haptic: null });

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
  assert(!renders.some(r => r.z.z2 === 'BOUNCE OUT'), 'cancelled BO never replays after the record/Undo');
}

{
  const clock = scheduler(), renders = [], nativeCalls = [];
  const host = { __sqDmdShowTransientZones: (z, o) => { nativeCalls.push('transient'); renders.push({ z, o }); }, __sqDmdCancelTransientScenes: () => nativeCalls.push('cancel'), sqDmdShowZones: () => nativeCalls.push('legacy'), __sqDmdHardClearQueue: () => nativeCalls.push('hard-clear') };
  const { detectExistingBackend } = await import('../../src/live-game/dmd/controller.mjs');
  const c = createController({ ...detectExistingBackend(host), scheduler: clock, now: clock.now, haptics: { pulse() {}, cancel() {} } });
  c.emit({ kind: 'BOUNCE_OUT' });
  const removedTimer = clock.pending()[0];
  assert.deepEqual(renders[0], { z: { z2: 'BOUNCE OUT', z3: '' }, o: { type: 'flash', ms: 420, fx: 'impact', bounceOut: true } });
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
  const opts = { type: 'flash', ms: 420, fx: 'impact', bounceOut: true };
  assert.equal(normal.render({ z2: 'BOUNCE OUT' }, opts), 'ok');
  assert.deepEqual(calls.at(-1).o, opts, 'normal BO flash/impact options remain intact');
  reduced.render({ z2: 'BOUNCE OUT' }, opts);
  assert.deepEqual(calls.at(-1).o, { type: 'hold', ms: 420, bounceOut: true, amp: 0 }, 'reduced BO removes both strobe type and impact FX');
  reduced.render({ z2: 'OTHER' }, { type: 'lastDartImg', ms: 900, fx: 'impact', amp: 3.4 });
  assert.deepEqual(calls.at(-1).o, { type: 'hold', ms: 900, fx: 'impact', amp: 0 }, 'existing non-BO adapter behaviour is unchanged');
}

// Model the exact production gesture owner with controlled timers and canonical
// record receipts. These are unit events; native click evidence belongs to the
// separate browser regression and retained public baseline traces.
const source = fs.readFileSync(new URL('../../src/live-game/live-v2.js', import.meta.url), 'utf8');
const start = source.indexOf('let __sqMissBouncePendingCancel = null;');
const end = source.indexOf("if (!window.__sqQuickEntryClickGuardBound)", start);
assert(start >= 0 && end > start);
const gestureSource = source.slice(start, end);
function fixture({ reject = false, feedbackThrows = false, catchUp = false } = {}) {
  const clock = scheduler(), events = [], classes = new Set(), handlers = new Map();
  const button = { style: {}, classList: { add: n => classes.add(n), remove: n => classes.delete(n) }, setPointerCapture() {}, addEventListener: (name, fn) => { handlers.set(name, fn); } };
  const state = { __gameToken: 1, currentPlayer: 0, currentRound: 0, currentDart: 0, history: [], players: ['ALPHA', 'BETA'] };
  const context = { state, document: { body: { dataset: { page: 'game' } } }, window: { __sqDmdV2: { emit: e => { events.push(['feedback', e]); if (feedbackThrows) throw Error('display unavailable'); }, cancelBounceOut: () => events.push(['cancel-feedback']) } }, navigator: { vibrate: n => events.push(['vibrate', n]) }, performance: { now: clock.now }, setTimeout: clock.set.bind(clock), clearTimeout: clock.clear.bind(clock), __SQ_QUICK_ENTRY_HOLD_MS: 360,
    recordThrow(spec) { events.push(['record', spec]); if (reject) return; const s = context.state; s.history.push({ player: catchUp ? 1 : s.currentPlayer, round: s.currentRound, dartIndex: s.currentDart, throw: { kind: 'Miss', points: 0, bounceOut: true } }); s.currentDart++; } };
  vm.createContext(context); vm.runInContext(gestureSource + '\n__sqBindMissBounceHold(button);', Object.assign(context, { button }));
  function fire(name) { const e = { pointerType: 'mouse', button: 0, pointerId: 1, clientX: 10, clientY: 10, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; } }; handlers.get(name)?.(e); return e; }
  return { context, clock, events, fire, cancel: () => vm.runInContext('__sqCancelMissBounceFeedback()', context) };
}

{
  const f = fixture(); f.fire('pointerdown'); f.clock.advance(359);
  assert.equal(f.context.state.history.length, 0, 'threshold remains 360ms');
  f.clock.advance(1);
  assert.equal(f.context.state.history.length, 1);
  assert.deepEqual(f.events.map(e => e[0]), ['record', 'feedback', 'vibrate'], 'one accepted canonical record precedes optional feedback');
  f.fire('pointerup'); assert(f.fire('click').stopped, 'held compatibility click is consumed');
  f.clock.advance(30); f.fire('pointerdown'); f.fire('pointerup');
  assert.equal(f.fire('click').stopped, false, 'a genuine next press within220ms remains usable');
  assert.equal(f.events.filter(e => e[0] === 'record').length, 1, 'quick tap has no second hold record');
}
for (const opts of [{ reject: true }, { feedbackThrows: true }, { catchUp: true }]) {
  const f = fixture(opts); f.fire('pointerdown'); f.clock.advance(360);
  assert.equal(f.events.filter(e => e[0] === 'record').length, 1);
  assert.equal(f.context.state.history.length, opts.reject ? 0 : 1);
  assert.equal(f.events.filter(e => e[0] === 'feedback').length, opts.reject ? 0 : 1, 'feedback requires actual explicit BO receipt, including canonical catch-up cursor');
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

console.log('SC-069 owned Bounce Out gesture/receipt, queue cancellation and reduced-motion contracts PASS');
