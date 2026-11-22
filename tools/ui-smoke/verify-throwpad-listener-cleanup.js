// Real Official scoring with the existing offline game-control/read fixtures.
// Observe runtime subscriptions and their DOM targets; do not replace the scorer.
const assert = require('node:assert/strict');

if (process.env.SQ_BASE && !process.env.SQ_APP_URL) {
  const base = process.env.SQ_BASE.replace(/\/$/, '');
  process.env.SQ_APP_URL = /\/index\.html$/.test(base) ? base : base + '/index.html';
}
const H = require('./harness');
const app = new URL(H.APP_URL);
assert(['localhost', '127.0.0.1', '[::1]'].includes(app.hostname), 'Use a local source/dist server');
const fixturePlayers = [
  { id:'11111111-1111-4111-8111-111111111111', name:'Listener Alpha', initials:'LA' },
  { id:'22222222-2222-4222-8222-222222222222', name:'Listener Bravo', initials:'LB' },
];

(async () => {
  const { browser, ctx, page, consoleErrs } = await H.launch({ width:390, height:844 }, { emptyCloudReads:true });
  const productionWrites = [];
  let rankFixtureReads = 0;
  const checkpoints = [];
  try {
    // The harness fulfills Supabase reads and its SDK locally. Add an exact-origin
    // boundary so no other network request (including a write) can leave this test.
    await ctx.route('**/*', route => {
      const request = route.request(), target = new URL(request.url());
      if (target.hostname.endsWith('.supabase.co')) {
        // This exact POST is the existing read-only rank lookup (as in SC068).
        // Empty rows mean rank unavailable; no rank or production write is faked.
        if (target.pathname === '/rest/v1/rpc/sq_rank_score' && ['POST', 'OPTIONS'].includes(request.method())) {
          const headers = {
            'access-control-allow-origin':'*',
            'access-control-allow-methods':'POST, OPTIONS',
            'access-control-allow-headers':request.headers()['access-control-request-headers'] || '*',
          };
          if (request.method() === 'OPTIONS') return route.fulfill({ status:204, headers, body:'' });
          rankFixtureReads++;
          return route.fulfill({ status:200, headers, contentType:'application/json', body:'[]' });
        }
        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
          productionWrites.push(request.method() + ' ' + target.pathname);
          return route.abort('failed');
        }
        // Home navigation refreshes saved players from this read. Keep the
        // fixture identities consistent so the real classifier stays Official.
        if (target.pathname === '/rest/v1/players') {
          const headers = {
            'access-control-allow-origin':'*',
            'access-control-allow-methods':'GET, HEAD, OPTIONS',
            'access-control-allow-headers':request.headers()['access-control-request-headers'] || '*',
            'access-control-expose-headers':'content-range',
            'content-range':'0-1/2',
          };
          if (request.method() === 'OPTIONS') return route.fulfill({ status:204, headers, body:'' });
          if (request.method() === 'HEAD') return route.fulfill({ status:200, headers, body:'' });
          return route.fulfill({ status:200, headers, contentType:'application/json', body:JSON.stringify(fixturePlayers) });
        }
        return route.fallback();
      }
      if (target.hostname === 'cdn.jsdelivr.net' && target.pathname.includes('supabase')) return route.fallback();
      if (target.origin === app.origin && ['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.fallback();
      return route.abort('failed');
    });
    await ctx.routeWebSocket('**/*', socket => socket.close());
    await H.boot(page, { settle:800 });
    await page.evaluate(() => {
      const bus = window.__sqUIMutationBus;
      if (!bus || typeof bus.on !== 'function') throw new Error('UI mutation bus unavailable');
      const originalOn = bus.on;
      const audit = window.__throwpadListenerAudit = { subscriptions:[], detachedCalls:0, callbackErrors:[] };
      // Boot's persistent subscriptions are already installed. New registrations
      // made while a MISS control exists are associated with that exact DOM node.
      bus.on = function(fn) {
        const button = document.querySelector('#pad .dtX3');
        if (!button) return originalOn.call(this, fn);
        const entry = { button, active:true, calls:0, round:ROUNDS[state.currentRound]?.type };
        audit.subscriptions.push(entry);
        const dispose = originalOn.call(this, function(...args) {
          entry.calls++;
          if (!button.isConnected) audit.detachedCalls++;
          try { return Reflect.apply(fn, this, args); }
          catch (error) { audit.callbackErrors.push(String(error)); throw error; }
        });
        return () => { dispose(); entry.active = false; };
      };
    });

    const probe = async (label, empty = false) => {
      const snapshot = await page.evaluate(async () => {
        // A genuine DOM mutation flushes the production bus, including any
        // callbacks accidentally retained for controls that were replaced.
        const marker = document.createElement('span');
        marker.hidden = true;
        document.body.append(marker);
        marker.remove();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const audit = window.__throwpadListenerAudit;
        return {
          registered:audit.subscriptions.length,
          active:audit.subscriptions.filter(item => item.active).length,
          detachedActive:audit.subscriptions.filter(item => item.active && !item.button.isConnected).length,
          detachedCalls:audit.detachedCalls,
          callbackErrors:audit.callbackErrors.slice(),
          rounds:[...new Set(audit.subscriptions.map(item => item.round))],
        };
      });
      checkpoints.push({ label, empty, ...snapshot });
      return snapshot;
    };
    const expectMissCount = async count => {
      await page.waitForFunction(expected => {
        const button = document.querySelector('#pad .dtX3');
        return button?.dataset.missN === String(expected) && button.textContent === 'MISS\nx' + expected;
      }, count);
    };

    // Registered fixture identities keep this game Official. The offline
    // transport creates its controller; no stored board/history is fabricated.
    await page.evaluate(async players => {
      state.players = players.map(player => ({ ...player }));
      setSavedPlayers(state.players.map(player => ({ ...player, _src:'cloud-cache' })));
      state.match.mode = 'official';
      state.match.targetWins = 3;
      await startNewGame(true);
    }, fixturePlayers);
    await page.waitForFunction(() => document.body.dataset.page === 'game' && window.SQ_GAMEPLAY.canThrow());
    await page.locator('#gameLoadOverlay').waitFor({ state:'hidden' });
    assert.equal(await page.evaluate(() => state.__sqGameControl.mode), 'official');

    // A real scoring dart avoids a tied finish. The two MISS paths must consume
    // exactly the remaining darts while keeping their current label truthful.
    await expectMissCount(3);
    await page.locator('#pad [data-score-label="Single"]').click();
    await page.waitForFunction(() => state.history.length === 1 && state.currentDart === 1);
    await expectMissCount(2);
    await page.locator('#pad .dtActBtn.miss').click();
    await page.waitForFunction(() => state.history.length === 2 && state.currentDart === 2);
    await expectMissCount(1);
    await page.locator('#pad .dtX3').click();
    await page.waitForFunction(() => state.history.length === 3 && state.currentDart === 0);
    await expectMissCount(3);

    for (const [round, type, scoreSelector] of [
      [11, 'doubles', '.dtNumBtn'],
      [12, 'triples', '.dtNumBtn'],
      [13, 'bull', '.dtBullBtn.inner'],
    ]) {
      await page.evaluate(target => {
        let guard = 84;
        while (!state.finished && state.currentRound < target && guard--) recordThrow({ kind:'Miss' });
        if (state.currentRound !== target || state.currentDart !== 0) throw new Error('Target visit not reached');
      }, round);
      await expectMissCount(3);
      await probe(type + ': pad replacement');
      const before = await page.evaluate(() => [state.history.length, state.currentRound, state.currentPlayer, state.currentDart]);
      await page.locator('#pad ' + scoreSelector).first().click();
      await page.waitForFunction(length => state.history.length === length + 1, before[0]);
      await expectMissCount(2);
      await page.locator('#pad .dtActBtn.undo').click();
      await page.waitForFunction(length => state.history.length === length, before[0]);
      await expectMissCount(3);
      assert.deepEqual(await page.evaluate(() => [state.history.length, state.currentRound, state.currentPlayer, state.currentDart]), before);
      await probe(type + ': score and Undo');

      if (type === 'doubles') {
        // Exercise the owning router while a subscribed special-round pad is
        // active, then return without changing the in-progress game.
        await page.evaluate(() => show('details'));
        await probe('leave an unfinished game', true);
        await page.evaluate(() => show('game'));
        await expectMissCount(3);
        assert.deepEqual(await page.evaluate(() => [state.history.length, state.currentRound, state.currentPlayer, state.currentDart]), before);
        await probe('return to the same game');
      }
    }

    await page.evaluate(() => {
      let guard = 84;
      while (!state.finished && guard--) recordThrow({ kind:'Miss' });
    });
    await page.waitForFunction(() => state.finished && state.history.length === 84);
    assert.deepEqual(await page.evaluate(() => [state.__sqGameControl.mode, __sqComputeGameMode()]), ['official', 'official'],
      'Both the controller and current player classification must remain Official');
    await probe('84-dart completion', true);
    await page.waitForTimeout(500);
    const completed = await probe('500 ms after completion', true);
    await page.evaluate(() => show('details'));
    await probe('navigation after completion', true);

    console.log('THROWPAD cleanup receipt ' + JSON.stringify({
      browser:process.env.SQ_BROWSER || 'chromium', rankFixtureReads, completed,
      checkpoints:checkpoints.map(({ label, active, detachedActive, detachedCalls }) => ({ label, active, detachedActive, detachedCalls })),
    }));
    assert(completed.registered > 0, 'Special-round subscriptions were exercised');
    assert.deepEqual(completed.rounds.sort(), ['bull', 'doubles', 'triples'], 'Every subscribed pad type was exercised');
    for (const result of checkpoints) {
      assert.equal(result.detachedActive, 0, result.label + ': callback retained a detached MISS control');
      assert.equal(result.detachedCalls, 0, result.label + ': callback ran for a detached MISS control');
      assert.deepEqual(result.callbackErrors, [], result.label + ': mutation callback errors');
      if (result.empty) assert.equal(result.active, 0, result.label + ': pad subscription remains active');
    }
    assert.deepEqual(productionWrites, [], 'No production mutation requests');
    assert.deepEqual(consoleErrs.filter(error => error.startsWith('pageerror:')), [], 'No uncaught browser errors');
    console.log('PASS Official 84-dart throwpad cleanup: replacements, MISS xN, Undo, completion and navigation');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
