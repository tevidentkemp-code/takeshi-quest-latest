// Controlled regression for SC-065's observed preparation callback delay.
// Execute the canonical semantic helper and its unchanged eight-step builder;
// no DOM, application state, network, native browser or scoring substitutes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const engine = fs.readFileSync(new URL('../../src/game/engine.js', import.meta.url), 'utf8');
const candidate = engine.match(/function __sqYieldToPaint\(\)\{[\s\S]*?\n\}/)?.[0];
const builder = engine.match(/async function buildEverythingChunked\(\)\{[\s\S]*?\n\}/)?.[0];
assert(candidate && builder, 'Canonical preparation helper/builder source is missing');
// Frozen pre-fix control from main3d411: reproduce serial unbounded frame waits.
const original = `function __sqYieldToPaint(){
  return new Promise((resolve)=>{
    requestAnimationFrame(()=>setTimeout(resolve, 0));
  });
}`;
const expectedBuilders = ['buildScoreHeader', 'buildScoreBody', 'buildFloatingHeader', 'buildStatsHeader', 'buildStatsBody', 'buildMatchStatsHeader', 'buildMatchStatsBody', 'setupScrollSync'];

function environment(options = {}, source = candidate) {
  let now = 0, nextId = options.firstId ?? 1;
  const jobs = new Map(), archive = new Map(), calls = [], built = [];
  const enqueue = (kind, callback, delay, args = []) => {
    const id = nextId++;
    const job = { id, kind, callback, at: now + delay, args };
    jobs.set(id, job); archive.set(id, job); calls.push({ kind: 'schedule-' + kind, id, at: now, due: job.at });
    return id;
  };
  const context = {
    setTimeout(callback, delay, ...args) {
      if (Number(delay) === 100 && options.watchdogThrows) throw Error('timer unavailable');
      if (Number(delay) === 0 && options.zeroTimerThrows) throw Error('post-frame task unavailable');
      return enqueue('timer', callback, Number(delay) === 0 ? (options.zeroDelay ?? 1) : Number(delay), args);
    },
    clearTimeout(id) { calls.push({ kind: 'clear-timer', id, at: now }); jobs.delete(id); },
    requestAnimationFrame(callback) {
      if (options.rafThrows) throw Error('RAF unavailable');
      return enqueue('frame', callback, options.frameDelay ?? 16);
    },
    cancelAnimationFrame(id) {
      calls.push({ kind: 'cancel-frame', id, at: now });
      if (options.cancelFrameThrows) throw Error('frame cancellation unavailable');
      jobs.delete(id);
    },
  };
  if (options.rafMissing) delete context.requestAnimationFrame;
  for (const name of expectedBuilders) context[name] = () => {
    built.push({ name, at: now });
    if (name === options.builderThrows) throw Error('builder failed: ' + name);
  };
  vm.createContext(context); vm.runInContext(source + '\n' + builder, context);
  function runTo(target) {
    while (true) {
      const due = [...jobs.values()].filter(job => job.at <= target).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;
      jobs.delete(due.id); now = due.at; calls.push({ kind: 'fire-' + due.kind, id: due.id, at: now });
      Reflect.apply(due.callback, context, due.kind === 'frame' ? [now] : due.args);
    }
    now = target;
  }
  return { context, jobs, archive, calls, built, runTo, now: () => now };
}
const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
function observe(promise, env) {
  const result = { settled: 0, value: 'pending', at: null };
  promise.then(value => { result.settled++; result.value = value; result.at = env.now(); });
  return result;
}
function noJobs(env) { assert.equal(env.jobs.size, 0, 'no live frame/task/watchdog handles'); }
const results = [];
async function test(name, run) { const detail = await run(); results.push({ name, status: 'PASS', ...detail }); }

(async () => {
  await test('observed 3669ms delayed RAF; 100ms fallback wins', async () => {
    const e = environment({ frameDelay: 3669 }), r = observe(e.context.__sqYieldToPaint(), e);
    e.runTo(99); await flush(); assert.equal(r.settled, 0);
    e.runTo(100); await flush(); assert.equal(r.settled, 1); assert.equal(r.value, undefined); noJobs(e);
    assert(e.calls.some(c => c.kind === 'cancel-frame'), 'fallback cancels pending frame');
    return { modelSettlementMs: r.at };
  });
  await test('normal RAF then macrotask; no synchronous settlement', async () => {
    const e = environment(), r = observe(e.context.__sqYieldToPaint(), e);
    await flush(); assert.equal(r.settled, 0);
    e.runTo(16); await flush(); assert.equal(r.settled, 0, 'frame is not the continuation task');
    e.runTo(17); await flush(); assert.equal(r.settled, 1); assert.equal(r.value, undefined); noJobs(e);
    assert(e.calls.some(c => c.kind === 'clear-timer' && c.id === 1), 'winning frame path clears watchdog');
    return { modelSettlementMs: r.at };
  });
  await test('missing RAF; fallback stays asynchronous', async () => {
    const e = environment({ rafMissing: true }), r = observe(e.context.__sqYieldToPaint(), e);
    await flush(); assert.equal(r.settled, 0);
    e.runTo(100); await flush(); assert.equal(r.settled, 1); noJobs(e);
    return { modelSettlementMs: r.at };
  });
  await test('RAF scheduling throws; watchdog still settles', async () => {
    const e = environment({ rafThrows: true }), r = observe(e.context.__sqYieldToPaint(), e);
    await flush(); assert.equal(r.settled, 0);
    e.runTo(100); await flush(); assert.equal(r.settled, 1); noJobs(e);
    return { modelSettlementMs: r.at };
  });
  await test('RAF callback cannot schedule zero-task; watchdog still settles', async () => {
    const e = environment({ zeroTimerThrows: true }), r = observe(e.context.__sqYieldToPaint(), e);
    e.runTo(16); await flush(); assert.equal(r.settled, 0);
    e.runTo(100); await flush(); assert.equal(r.settled, 1); noJobs(e);
    return { modelSettlementMs: r.at };
  });
  await test('post-frame macrotask delayed past watchdog; loser task cleared', async () => {
    const e = environment({ zeroDelay: 150 }), r = observe(e.context.__sqYieldToPaint(), e);
    e.runTo(16); await flush(); assert.equal(r.settled, 0);
    const afterPaint = [...e.jobs.values()].find(j => j.at === 166); assert(afterPaint);
    e.runTo(100); await flush(); assert.equal(r.settled, 1); noJobs(e);
    assert(e.calls.some(c => c.kind === 'clear-timer' && c.id === afterPaint.id));
    Reflect.apply(afterPaint.callback, e.context, []); await flush(); assert.equal(r.settled, 1); noJobs(e);
    return { modelSettlementMs: r.at, staleMacrotaskIgnored: true };
  });
  await test('100ms race and stale frame delivery; one settlement, zero extra task', async () => {
    const e = environment({ frameDelay: 100, firstId: 0 }), r = observe(e.context.__sqYieldToPaint(), e);
    const frame = [...e.archive.values()].find(j => j.kind === 'frame');
    e.runTo(100); await flush(); assert.equal(r.settled, 1); noJobs(e);
    const callsBefore = e.calls.length;
    Reflect.apply(frame.callback, e.context, [100]); await flush(); assert.equal(r.settled, 1); noJobs(e);
    assert.equal(e.calls.length, callsBefore, 'late frame cannot schedule a continuation');
    assert(e.calls.some(c => c.kind === 'clear-timer' && c.id === 0), 'zero native timer handle also cleaned');
    return { modelSettlementMs: r.at, staleFrameIgnored: true };
  });
  await test('frame cancellation throws; late delivery is inert', async () => {
    const e = environment({ frameDelay: 3669, cancelFrameThrows: true }), r = observe(e.context.__sqYieldToPaint(), e);
    e.runTo(100); await flush(); assert.equal(r.settled, 1);
    assert.equal(e.jobs.size, 1, 'platform refusing cancellation leaves only inert frame');
    e.runTo(3669); await flush(); assert.equal(r.settled, 1); noJobs(e);
    assert.equal(e.calls.filter(c => c.kind === 'schedule-timer').length, 1, 'no task after losing frame');
    return { modelSettlementMs: r.at, cancellationAttempted: true, lateFrameInert: true };
  });
  await test('downstream callback throws; cleanup precedes rejection', async () => {
    const e = environment();
    const p = e.context.__sqYieldToPaint().then(() => { noJobs(e); throw Error('caller failed'); });
    const rejected = assert.rejects(p, /caller failed/);
    e.runTo(17); await flush(); await rejected; noJobs(e);
    const failure = environment({ watchdogThrows: true });
    await assert.rejects(failure.context.__sqYieldToPaint(), /timer unavailable/); noJobs(failure);
    return { downstreamFailurePropagates: true, unavailableTimerRejectsWithoutLeakedFrame: true };
  });
  await test('exact eight-step builder order and meaningful delayed-frame baseline', async () => {
    const delayed = environment({ frameDelay: 3669 }, original);
    let oldDone = false; delayed.context.buildEverythingChunked().then(() => { oldDone = true; });
    for (const deadline of [3669, 3670, 7339, 7340, 8000]) { delayed.runTo(deadline); await flush(); }
    assert.equal(oldDone, false, 'original serial RAF pipeline is unfinished at 8s in controlled model');
    assert.deepEqual(delayed.built.map(x => x.name), expectedBuilders.slice(0, 2));
    const e = environment({ frameDelay: 3669 }); let newDone = false;
    e.context.buildEverythingChunked().then(() => { newDone = true; });
    for (let n = 1; n <= 8; n++) { e.runTo(n * 100); await flush(); }
    assert(newDone); assert.deepEqual(e.built.map(x => x.name), expectedBuilders);
    assert.deepEqual(e.built.map(x => x.at), [100, 200, 300, 400, 500, 600, 700, 800]); noJobs(e);
    const failed = environment({ builderThrows: 'buildScoreBody' });
    const rejection = assert.rejects(failed.context.buildEverythingChunked(), /builder failed: buildScoreBody/);
    failed.runTo(17); await flush(); failed.runTo(34); await flush(); await rejection;
    assert.deepEqual(failed.built.map(x => x.name), expectedBuilders.slice(0, 2)); noJobs(failed);
    return { originalUnfinishedAtModelMs: 8000, fallbackEightYieldsAtModelMs: 800, originalBuilderOrderExact: true, builderFailurePropagates: true, modelExcludesBuilderWorkAndOuterPreparation: true };
  });
  const receipt = { status: 'SC-065 STARTUP YIELD REGRESSION PASS', cases: results.length, results, scope: 'canonical helper/builder scheduler regression; native source/dist acceptance remains separate', budgetsChanged: [], stateSecurityScoringTokensChanged: [], nativeRuns: [] };
  console.log(JSON.stringify(receipt, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
