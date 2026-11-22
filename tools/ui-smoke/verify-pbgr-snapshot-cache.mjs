// Execute the actual PBGR cache helper with an offline snapshot provider and
// controlled clock. An optional source path supports pre-fix counterfactuals.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const sourcePath = process.argv[2] || fileURLToPath(new URL('../../src/app/router-ui.js', import.meta.url));
const source = fs.readFileSync(sourcePath, 'utf8');
const start = source.indexOf('async function __sqEnsurePBGRSnapshot(){');
const end = source.indexOf('function __sqCatForRoundIdx(', start);
assert(start >= 0 && end > start, 'Actual PBGR snapshot cache helper source anchors');
const implementation = source.slice(start, end);

function snapshot(points = 30) {
  const meta = { val:points, player:'Fixture Alpha' };
  return { byTargetMeta:{ 10:meta }, byPlayerMeta:new Map([['fixture alpha', { 10:meta }]]) };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function environment(provider) {
  let now = 1_000_000, reads = 0, read = provider;
  class Clock extends Date { static now() { return now; } }
  const context = vm.createContext({
    window:{}, Date:Clock,
    getPBGRSnapshot() { reads++; return read(); },
  });
  vm.runInContext(implementation, context, { filename:sourcePath });
  return {
    fetch:() => context.__sqEnsurePBGRSnapshot(),
    advance:ms => { now += ms; },
    provider:next => { read = next; },
    get now() { return now; },
    get reads() { return reads; },
    get cache() { return context.window.__pbgrSnapshot; },
    get pending() { return context.window.__pbgrSnapshotPromise; },
  };
}
let passed = 0;
async function test(name, run) {
  await run();
  passed++;
  console.log('PASS ' + name);
}

await test('a successful provider result is returned and cached', async () => {
  const value = snapshot(), e = environment(() => Promise.resolve(value));
  assert.equal(await e.fetch(), value, 'A successful PBGR response must not be swallowed as null');
  assert.equal(e.cache, value);
  assert.equal(e.cache.__ts, e.now);
  assert.deepEqual(Object.keys(e.cache), ['byTargetMeta', 'byPlayerMeta'], 'Cache timestamp is not record data');
  assert.equal(e.reads, 1);
  assert.equal(e.pending, null, 'Successful request clears its pending promise');
});

await test('repeat access inside 60 seconds makes no duplicate provider request', async () => {
  const value = snapshot(), e = environment(() => Promise.resolve(value));
  await e.fetch();
  assert.equal(await e.fetch(), value);
  e.advance(59_999);
  assert.equal(await e.fetch(), value);
  assert.equal(e.reads, 1);
  assert.equal(e.pending, null);
});

await test('concurrent callers share one pending provider read and the same result', async () => {
  const gate = deferred(), value = snapshot(), e = environment(() => gate.promise);
  const first = e.fetch(), second = e.fetch(), third = e.fetch();
  assert.equal(e.reads, 1, 'One request must serve overlapping consumers');
  assert(e.pending && typeof e.pending.then === 'function');
  assert.equal(e.cache, undefined, 'Pending results must not be published');
  gate.resolve(value);
  for (const result of await Promise.all([first, second, third])) assert.equal(result, value);
  assert.equal(e.cache, value);
  assert.equal(e.pending, null);
});

await test('the 60-second boundary refreshes once and caches the new result', async () => {
  const first = snapshot(30), next = snapshot(60), e = environment(() => Promise.resolve(first));
  await e.fetch();
  e.provider(() => Promise.resolve(next));
  e.advance(60_000);
  assert.equal(await e.fetch(), next);
  assert.equal(e.cache.__ts, e.now);
  assert.equal(e.reads, 2);
  assert.equal(await e.fetch(), next);
  assert.equal(e.reads, 2, 'The refreshed snapshot must serve subsequent reads');
  assert.equal(e.pending, null);
});

await test('a failed refresh preserves cached records without renewing their age and can retry', async () => {
  const previous = snapshot(30), next = snapshot(60), e = environment(() => Promise.resolve(previous));
  await e.fetch();
  const at = e.cache.__ts;
  e.advance(60_000);
  const gate = deferred();
  e.provider(() => gate.promise);
  const first = e.fetch(), second = e.fetch();
  assert.equal(e.reads, 2);
  gate.reject(new Error('Offline fixture: refresh unavailable'));
  assert.deepEqual(await Promise.all([first, second]), [previous, previous]);
  assert.equal(e.cache, previous);
  assert.equal(e.cache.__ts, at, 'Failure must not make old records appear newly fetched');
  assert.equal(e.pending, null, 'Failed request clears its pending promise');
  e.provider(() => Promise.resolve(next));
  assert.equal(await e.fetch(), next);
  assert.equal(e.reads, 3);
  assert.equal(e.pending, null);
});

await test('failure without a cache returns null, clears pending state and permits recovery', async () => {
  const value = snapshot(), e = environment(() => Promise.reject(new Error('Offline fixture: unavailable')));
  assert.equal(await e.fetch(), null);
  assert.equal(e.cache, undefined);
  assert.equal(e.pending, null);
  e.provider(() => Promise.resolve(value));
  assert.equal(await e.fetch(), value);
  assert.equal(e.reads, 2);
  assert.equal(e.pending, null);
});

console.log('PBGR snapshot cache: ' + passed + ' cases passed; no network or database access');
