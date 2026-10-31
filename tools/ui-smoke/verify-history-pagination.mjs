// Exercises the actual shared history loader against an offline PostgREST-like
// transport. The fixture applies the production default 1,000-row response cap;
// no Supabase connection, credentials, writes, or replacement loader are used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const sourcePath = process.argv[2] || fileURLToPath(new URL('../../src/app/router-ui.js', import.meta.url));
const source = fs.readFileSync(sourcePath, 'utf8');
const start = source.indexOf('function mapCloudGameRowToLocal(row){');
const end = source.indexOf('// Efficient: newest', start);
assert(start >= 0 && end > start, 'Actual history mapper, cache and loader source anchors');
const implementation = source.slice(start, end);
const plain = value => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
function fixtureRows(count, prefix = 'game') {
  return Array.from({ length: count }, (_, i) => ({
    id: prefix + '-' + String(i).padStart(6, '0'),
    created_at: new Date(Date.UTC(2026, 8, 1) + Math.floor(i / 7) * 60000).toISOString(),
    archived_at: null,
    totals: [400 + i % 20, 300],
    state: {
      players: [{ player_id: 'hassan-id', name: 'Hassan' }, { player_id: 'liam-id', name: 'Liam' }],
      mode: 'official', is_practice: false, board: [[{ total: 60 }], [{ total: 40 }]]
    },
    match_id: 'match-' + i, game_number: 1
  })).reverse(); // Storage order must never accidentally satisfy stable ordering.
}
function environment(initialRows = [], { beforeResponse } = {}) {
  let rows = initialRows, now = 1000000;
  const queries = [];
  class Clock extends Date { static now() { return now; } }
  const context = vm.createContext({ Date: Clock, console, window: {}, TABLE_GAMES: 'games' });
  context.sb = {
    from(table) {
      const query = { table, columns: null, orders: [], range: null, limit: null };
      let executed;
      const builder = {
        select(columns) { query.columns = columns; return builder; },
        order(column, options) { query.orders.push([column, plain(options)]); return builder; },
        range(from, to) { query.range = [from, to]; return builder; },
        limit(value) { query.limit = value; return builder; },
        then(resolve, reject) {
          if (!executed) {
            query.ordinal = queries.length;
            queries.push(query);
            const ordered = rows.slice().sort((a, b) => {
              for (const [key, opts] of query.orders) {
                const comparison = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
                if (comparison) return opts.ascending === false ? -comparison : comparison;
              }
              return 0;
            });
            const offset = query.range?.[0] ?? 0;
            const wanted = query.range ? query.range[1] - offset + 1 : query.limit ?? 1000;
            const response = { data: plain(ordered.slice(offset, offset + Math.min(1000, wanted))), error: null };
            executed = Promise.resolve().then(async () => {
              const replacement = await beforeResponse?.(query, response);
              return replacement === undefined ? response : replacement;
            });
          }
          return executed.then(resolve, reject);
        }
      };
      return builder;
    }
  };
  vm.runInContext(implementation, context, { filename: sourcePath });
  return {
    context, queries,
    fetch: opts => context.cloudFetchAllGamesAsLocal(opts),
    invalidate: reason => context.window.__sqInvalidateAllGamesFetchCache(reason),
    setRows: value => { rows = value; },
    advance: ms => { now += ms; },
    get cache() { return context.window.__sqAllGamesFetchCache; },
    get at() { return context.window.__sqAllGamesFetchAt; },
    get inFlight() { return context.window.__sqAllGamesFetchInFlight; }
  };
}
function assertQueries(queries, rowCount) {
  assert.equal(queries.length, Math.floor(rowCount / 500) + 1, 'Every full page requires a subsequent page; a short page terminates');
  queries.forEach((q, index) => {
    assert.equal(q.table, 'games');
    assert.equal(q.columns, 'id,created_at,archived_at,state,totals,match_id,game_number');
    assert.deepEqual(q.orders, [['created_at', { ascending: true }], ['id', { ascending: true }]], 'Timestamp ties require stable ID ordering');
    assert.deepEqual(q.range, [index * 500, index * 500 + 499], 'Inclusive ranges have neither gaps nor overlaps');
  });
}
let passed = 0;
async function test(name, run) {
  await run();
  passed++;
  console.log('PASS ' + name);
}

await test('more than 1,000 games includes the latest rows exactly once in stable order', async () => {
  const rows = fixtureRows(1513), e = environment(rows), result = await e.fetch();
  assert.equal(result.length, 1513, 'The original unpaginated request truncates history to 1,000');
  const expected = rows.slice().sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  assert.deepEqual(plain(result.map(r => r.id)), expected.map(r => r.id));
  assert.equal(new Set(result.map(r => r.id)).size, 1513);
  assertQueries(e.queries, rows.length);
  assert.equal(e.cache.length, 1513);
  assert.equal(e.inFlight, null);
  const mapped = result.at(-1), raw = expected.at(-1);
  assert.equal(mapped.ts, raw.created_at);
  assert.deepEqual(plain(mapped.players), [{ id: 'hassan-id', name: 'Hassan' }, { id: 'liam-id', name: 'Liam' }]);
  assert.deepEqual(plain(mapped.totals), raw.totals);
  assert.deepEqual(plain(mapped.board), raw.state.board);
  assert.equal(mapped.mode, 'official');
  assert.equal(mapped.is_practice, false);
  assert.equal(mapped.match_id, raw.match_id);
  assert.equal(mapped.game_number, 1);
});

for (const count of [0, 1, 499, 500, 501, 1000, 1001]) {
  await test('empty/short/exact-page history terminates correctly with ' + count + ' rows', async () => {
    const e = environment(fixtureRows(count)), result = await e.fetch();
    assert.equal(result.length, count);
    assertQueries(e.queries, count);
    const cached = await e.fetch();
    assert.equal(cached.length, count);
    assert.notEqual(cached, result);
    assertQueries(e.queries, count);
  });
}

await test('equal timestamps spanning page boundaries retain every ID in deterministic order', async () => {
  const rows = fixtureRows(1207).map(r => ({ ...r, created_at: '2026-10-30T21:00:00.000Z' }));
  const e = environment(rows), result = await e.fetch();
  assert.deepEqual(plain(result.map(r => r.id)), rows.map(r => r.id).sort());
  assertQueries(e.queries, rows.length);
});

await test('later page error rejects atomically, retains prior cache, and permits a fresh retry', async () => {
  let fail = false;
  const error = { code: '57014', message: 'controlled page-two failure' };
  const e = environment(fixtureRows(2), {
    beforeResponse: q => fail && q.range?.[0] === 500 ? { data: null, error } : undefined
  });
  await e.fetch();
  const previous = e.cache, at = e.at;
  e.setRows(fixtureRows(1001)); e.advance(300000); fail = true;
  await assert.rejects(e.fetch(), err => err === error);
  assert.equal(e.cache, previous, 'A successful first page must never replace the complete old cache');
  assert.equal(e.at, at, 'A failed refresh must not make stale data appear fresh');
  assert.equal(e.inFlight, null);
  fail = false;
  assert.equal((await e.fetch()).length, 1001);
  assert.notEqual(e.cache, previous);
});

await test('thrown transport failure on a later page never publishes partial history', async () => {
  const e = environment(fixtureRows(1001), {
    beforeResponse: q => { if (q.range?.[0] === 500) throw new Error('controlled transport rejection'); }
  });
  await assert.rejects(e.fetch(), /controlled transport rejection/);
  assert.equal(Array.isArray(e.cache), false);
  assert.equal(e.at, 0);
  assert.equal(e.inFlight, null);
});

await test('concurrent callers share one complete pagination sequence and receive separate arrays', async () => {
  const gate = deferred();
  const e = environment(fixtureRows(1001), { beforeResponse: q => q.ordinal === 0 ? gate.promise : undefined });
  const a = e.fetch(), b = e.fetch();
  await flush();
  assert.equal(e.queries.length, 1);
  assert(e.inFlight);
  assert.equal(Array.isArray(e.cache), false, 'In-progress pages must remain unpublished');
  gate.resolve();
  const [first, second] = await Promise.all([a, b]);
  assertQueries(e.queries, 1001);
  assert.equal(first.length, 1001);
  assert.equal(second.length, 1001);
  assert.notEqual(first, second);
  assert.notEqual(first, e.cache);
  first.pop(); second.reverse();
  const third = await e.fetch();
  assert.equal(third.length, 1001);
  assert.equal(third[0].id, 'game-000000');
  assert.equal(e.cache[0].id, 'game-000000');
});

await test('five-minute TTL and explicit force preserve the existing refresh contract', async () => {
  const e = environment(fixtureRows(1));
  await e.fetch();
  const initialAt = e.at;
  e.advance(299999);
  await e.fetch();
  assert.equal(e.queries.length, 1);
  assert.equal(e.at, initialAt);
  e.advance(1);
  await e.fetch();
  assert.equal(e.queries.length, 2);
  assert(e.at > initialAt);
  await e.fetch(true);
  await e.fetch({ force: true });
  assert.equal(e.queries.length, 4);
});

await test('invalidation during pagination prevents stale cache commits and preserves newer in-flight work', async () => {
  const oldPage = deferred(), newPage = deferred();
  const e = environment(fixtureRows(501, 'old'), {
    beforeResponse: q => q.ordinal === 1 ? oldPage.promise : q.ordinal === 2 ? newPage.promise : undefined
  });
  const oldRequest = e.fetch();
  await flush();
  assert.equal(e.queries.length, 2, 'Old request must be waiting on its second page');
  e.invalidate('completed-game');
  e.setRows(fixtureRows(3, 'new'));
  const freshRequest = e.fetch();
  await flush();
  const newerInFlight = e.inFlight;
  assert(newerInFlight);
  assert.equal(e.queries.length, 3);
  oldPage.resolve();
  assert.equal((await oldRequest).length, 501);
  assert.equal(e.cache, null, 'Invalidated generation must not repopulate cache');
  assert.equal(e.at, 0);
  assert.equal(e.inFlight, newerInFlight, 'Old completion must not clear the newer request');
  newPage.resolve();
  assert.equal((await freshRequest).length, 3);
  assert.equal(e.cache.length, 3);
  assert(e.cache.every(r => r.id.startsWith('new-')));
  assert.equal(e.inFlight, null);
  assert.equal(e.context.window.__sqAllGamesFetchInvalidatedFor, 'completed-game');
});

console.log(JSON.stringify({ status: 'PASS', tests: passed, sourcePath, sourceSha256: crypto.createHash('sha256').update(implementation).digest('hex'), network: 'none', productionWrites: 0 }));
