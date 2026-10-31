// Offline end-to-end regression: real Supabase client, history loader, mode
// classification, Premier League and VIDE consume a capped HTTP fixture.
// Run against source and dist via SQ_APP_URL. No production traffic is allowed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// The incident is a London calendar day. Browser processes inherit TZ from
// this test, avoiding the host's unrelated timezone at the midnight boundary.
process.env.TZ = 'Europe/London';
const H = require('./harness');

const clock = '2026-10-30T23:34:00.000Z';
const ids = {
  Hassan: '10000000-0000-4000-8000-000000000001',
  Liam: '10000000-0000-4000-8000-000000000002',
  Chris: '10000000-0000-4000-8000-000000000003',
  Michael: '10000000-0000-4000-8000-000000000004'
};
const players = Object.entries(ids).map(([name, id]) => ({ id, name, first_name: name, last_name: '', initials: name.slice(0, 2).toUpperCase(), created_at: '2026-01-01T12:00:00.000Z', deleted_at: null }));
function game(index, ts, names, totals, mode = 'official', archived = false) {
  return {
    id: '20000000-0000-4000-8000-' + String(index).padStart(12, '0'),
    created_at: ts, archived_at: archived ? clock : null,
    match_id: mode === 'practice' ? null : '30000000-0000-4000-8000-' + String(index).padStart(12, '0'),
    game_number: 1, totals,
    state: { mode, is_practice: mode === 'practice', players: names.map(name => ({ id: ids[name], name })), board: [], total_players: names.length }
  };
}
const games = Array.from({ length: 1100 }, (_, i) => game(
  i, new Date(Date.UTC(2026, 8, 1) + Math.floor(i / 4) * 60000).toISOString(),
  ['Chris', 'Michael'], [i === 0 ? 900 : 400, 300]
));
// Hassan must already have completed five Official games when scoring 681:
 // one September game and four October games. The fixture stays at 1,108 rows
 // and does not change the October/Today/Yesterday/This Week qualifications.
games[1099] = game(1099, games[1099].created_at, ['Hassan', 'Liam'], [400, 200]);
games.push(
  game(1100, '2026-10-29T20:00:00.000Z', ['Hassan', 'Liam'], [600, 400]),
  game(1101, '2026-10-29T21:00:00.000Z', ['Hassan', 'Liam'], [650, 410]),
  game(1102, '2026-10-30T20:00:00.000Z', ['Hassan', 'Liam'], [610, 450]),
  game(1103, '2026-10-30T20:30:00.000Z', ['Hassan', 'Liam'], [640, 460]),
  game(1104, '2026-10-30T21:00:00.000Z', ['Hassan', 'Liam'], [681, 470]),
  game(1105, '2026-10-30T22:00:00.000Z', ['Hassan', 'Liam'], [950, 940], 'turbo'),
  game(1106, '2026-10-30T22:30:00.000Z', ['Hassan'], [960], 'practice'),
  game(1107, '2026-10-30T23:00:00.000Z', ['Hassan', 'Liam'], [9999, 9998], 'official', true)
);
games.reverse(); // Stable request ordering must work across timestamp ties.

const output = process.env.SQ_SCREENSHOTS || path.join(__dirname, '../../output/playwright/history-pagination');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const { browser, ctx, page, consoleErrs } = await H.launch({ width: 390, height: 844 });
  const requests = [], mutations = [];
  try {
    await page.addInitScript(iso => {
      const NativeDate = Date, fixed = NativeDate.parse(iso);
      class FixtureDate extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [fixed])); }
        static now() { return fixed; }
      }
      window.Date = FixtureDate;
    }, clock);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // This route is installed after the harness block, so it fulfils only
    // fixture REST reads. Other external traffic falls through to the blocker.
    await ctx.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (!url.hostname.endsWith('.supabase.co')) return route.fallback();
      if (!url.pathname.startsWith('/rest/v1/')) return route.abort('failed');
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        mutations.push({ method: request.method(), path: url.pathname });
        return route.abort('failed');
      }
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
      const table = url.pathname.split('/').pop();
      let rows = table === 'games' ? games.slice()
        : table === 'v_games_visible' ? games.filter(g => !g.archived_at)
          : table === 'players' ? players.slice() : [];
      for (const [key, filter] of url.searchParams) {
        if (filter.startsWith('gt.')) rows = rows.filter(row => row[key] > filter.slice(3));
        if (filter.startsWith('gte.')) rows = rows.filter(row => row[key] >= filter.slice(4));
        if (filter.startsWith('lt.')) rows = rows.filter(row => row[key] < filter.slice(3));
        if (filter.startsWith('lte.')) rows = rows.filter(row => row[key] <= filter.slice(4));
        if (filter === 'is.null') rows = rows.filter(row => row[key] == null);
        if (filter.startsWith('eq.')) rows = rows.filter(row => String(row[key]) === filter.slice(3));
      }
      const order = url.searchParams.get('order') || '';
      const orders = order.split(',').filter(Boolean).map(item => item.split('.'));
      rows.sort((a, b) => {
        for (const [column, direction] of orders) {
          const comparison = a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0;
          if (comparison) return direction === 'desc' ? -comparison : comparison;
        }
        return 0;
      });
      const total = rows.length;
      const headerRange = (request.headers().range || '').match(/^(\d+)-(\d+)$/);
      const offset = Number(url.searchParams.get('offset') || headerRange?.[1] || 0);
      const requestedLimit = Number(url.searchParams.get('limit') || (headerRange ? Number(headerRange[2]) - offset + 1 : 1000));
      const limit = Math.min(1000, requestedLimit);
      rows = rows.slice(offset, offset + limit);
      requests.push({ table, order, offset, requestedLimit, returned: rows.length, select: url.searchParams.get('select') });
      const contentRange = rows.length ? `${offset}-${offset + rows.length - 1}/${total}` : `*/${total}`;
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', 'content-range': contentRange, 'access-control-allow-origin': '*' },
        body: request.method() === 'HEAD' ? '' : JSON.stringify(rows)
      });
    });
    await H.boot(page, { settle: 1000 });
    const dayStart = await page.evaluate(() => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    });
    assert.equal(dayStart, '2026-10-30T00:00:00.000Z', 'Fixture browser must use the incident\'s Europe/London calendar day');
    const loadedCount = await page.evaluate(async () => (await cloudFetchAllGamesAsLocal()).length);
    assert.equal(loadedCount, games.length, 'The real loader must read all 1,108 rows rather than stop at the default 1,000-row API cap');
    await page.waitForFunction(() => Array.isArray(window.__homeLivePrinterState?.derivedItems) && window.__homeLivePrinterState.derivedItems.some(item => item.line_text === 'GAME PB - Hassan (681)'), null, { timeout: 20000 });
    const feed = await page.evaluate(() => ({
      pb: window.__homeLivePrinterState.derivedItems.filter(item => item.line_text === 'GAME PB - Hassan (681)'),
      lines: window.__homeLivePrinterState.bufLines.slice(),
      cacheLength: window.__sqAllGamesFetchCache?.length,
      freshClone: typeof cloudFetchAllGamesAsLocal === 'function'
    }));
    assert.equal(feed.cacheLength, games.length, 'Shared history cache must include rows beyond the API default cap');
    assert.equal(feed.pb.length, 1, 'Hassan 681 must create exactly one derived PB event');
    assert.equal(feed.pb[0].event_kind, 'game_pb');
    assert.equal(feed.pb[0].event_ts, '2026-10-30T21:00:00.000Z');
    assert(feed.lines.some(line => /GAME\s*PB.*Hassan.*681/i.test(line)), 'The real VIDE feed buffer must contain the recovered PB');
    assert(!feed.lines.some(line => /9999|9998/.test(line)), 'Archived game scores must not reach VIDE');
    assert.equal(feed.freshClone, true);
    await page.screenshot({ path: path.join(output, 'vidi-history.png'), fullPage: true });

    async function leagueRows() {
      return page.locator('.sq136-pl-modal .pl-row').evaluateAll(rows => rows.map(row => {
        const name = row.querySelector('.pl-name');
        return {
          name: name?.getAttribute('data-sq-halloween-original') || name?.textContent,
          games: row.querySelector('.pl-sub')?.textContent,
          average: row.querySelector('.pl-avg')?.textContent,
          best: row.querySelector('.pl-best')?.textContent,
          qualified: !row.classList.contains('unq')
        };
      }));
    }
    async function verifyPeriod(id, count, hassanAverage, liamAverage) {
      await page.locator(`.sq136-pl-modal [data-filter-id="${id}"]`).click();
      await page.waitForFunction(expected => document.querySelector('.sq136-pl-modal [data-filter-id].active')?.dataset.filterId === expected, id);
      const rows = await leagueRows();
      assert.deepEqual(rows.map(r => r.name), ['Hassan', 'Liam']);
      assert.deepEqual(rows.map(r => r.games), [count + ' games', count + ' games'], id + ' must count only eligible games in its date window');
      assert(rows.every(r => r.qualified), id + ' qualifying state');
      assert.equal(rows[0].average, hassanAverage.toFixed(1));
      assert.equal(rows[1].average, liamAverage.toFixed(1));
      assert.equal(rows[0].best, id === 'YESTERDAY' ? 'BEST 650' : 'BEST 681');
      assert(!rows.some(r => /950|960|9999/.test(r.best)), 'Turbo, Practice and archived scores stay outside Official Premier League');
      console.log('PASS actual Premier League ' + id + ': ' + count + ' games each, correct averages, names and best');
    }
    await page.evaluate(() => window.openPremierLeagueDialog());
    await page.waitForSelector('.sq136-pl-modal .pl-row');
    await verifyPeriod('M2026-10', 5, 636.2, 438);
    await page.screenshot({ path: path.join(output, 'premier-october.png'), fullPage: true });
    await verifyPeriod('TODAY', 3, 1931 / 3, 460);
    await verifyPeriod('YESTERDAY', 2, 625, 405);
    await verifyPeriod('THIS_WEEK', 5, 636.2, 438);
    await page.screenshot({ path: path.join(output, 'premier-week.png'), fullPage: true });
    const footer = await page.locator('.sq136-pl-footer').boundingBox();
    assert(footer && footer.y >= 0 && footer.y + footer.height <= 844, 'Mobile Back/Close footer stays visible');
    await page.locator('.sq136-pl-modal .sq136-back').click();
    assert.equal(await page.locator('.sq136-pl-modal').count(), 0, 'Back removes Premier League');
    assert(await page.locator('.modal-backdrop').count() >= 1, 'Back returns to the League menu');
    await page.evaluate(() => window.openPremierLeagueDialog());
    await page.waitForSelector('.sq136-pl-modal .pl-row');
    await page.locator('.sq136-pl-modal .sq136-close').click();
    assert.equal(await page.locator('.sq136-pl-modal').count(), 0, 'Close removes Premier League');

    const historyRequests = requests.filter(q => q.table === 'games' && q.order === 'created_at.asc,id.asc' && q.select === 'id,created_at,archived_at,state,totals,match_id,game_number');
    assert.deepEqual(historyRequests.map(q => [q.offset, q.requestedLimit, q.returned]), [[0, 500, 500], [500, 500, 500], [1000, 500, 108]], 'VIDE and league reuse one complete shared history fetch');
    assert.deepEqual(mutations, [], 'No mutation requests are allowed in this regression');
    assert.deepEqual(consoleErrs.filter(error => error.startsWith('pageerror:')), [], 'No uncaught browser exceptions');
    console.log(JSON.stringify({ status: 'PASS', app: H.APP_URL, fixtureRows: games.length, historyRequests, recoveredPb: feed.pb[0], viewport: '390x844', network: 'offline fixtures only', productionWrites: 0 }));
  } catch (error) {
    console.error(JSON.stringify(await page.evaluate(async () => {
      const now = new Date(), a = new Date(now.getFullYear(), now.getMonth(), now.getDate()), b = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const games = typeof getGamesForMode === 'function' ? await getGamesForMode('official') : [];
      return {
        date: now.toISOString(), start: a.toISOString(), end: b.toISOString(),
        filter: document.querySelector('.sq136-pl-modal [data-filter-id].active')?.dataset.filterId,
        table: document.querySelector('.sq136-pl-table-mount')?.textContent,
        historyCount: window.__sqAllGamesFetchCache?.length,
        recent: games.filter(g => String(g.ts || '').startsWith('2026-10')).map(g => ({ ts: g.ts, mode: g.mode, today: new Date(g.ts) >= a && new Date(g.ts) < b }))
      };
    }).catch(() => ({ diagnostic: 'Page unavailable' }))));
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
