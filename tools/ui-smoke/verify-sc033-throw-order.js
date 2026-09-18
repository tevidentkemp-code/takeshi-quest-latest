const assert = require('assert');
const fs = require('fs');
const path = require('path');
const H = require('./harness');

const shots = process.env.SQ_SCREENSHOTS;
async function shot(page, name, selector) {
  if (!shots) return;
  fs.mkdirSync(shots, { recursive: true });
  const file = path.join(shots, name + '.png');
  if (selector) await page.locator(selector).screenshot({ path: file });
  else await page.screenshot({ path: file, fullPage: false });
}

async function dismissCompletion(page) {
  await page.waitForSelector('.sq-gamecomplete-backdrop', { timeout: 12000 });
  const close = await page.$('.sq-gamecomplete-backdrop [data-action="gcClose"]');
  if (close) {
    await close.click();
  } else {
    await page.evaluate(() => {
      const ov = document.querySelector('.sq-gamecomplete-backdrop');
      if (ov) ov.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }
  await page.waitForFunction(() => !document.querySelector('.sq-gamecomplete-backdrop'), { timeout: 8000 }).catch(() => {});
}

async function finishToLeaderboard(page) {
  const buttons = await page.$$('#pad button');
  let clicked = false;
  for (const b of buttons) {
    const txt = String(await b.textContent() || '').trim();
    if (/Finish Game/i.test(txt)) {
      await b.click();
      clicked = true;
      break;
    }
  }
  assert(clicked, 'Finish Game control was not available');
  await page.waitForFunction(() => document.body.dataset.page === 'leaderboard', { timeout: 15000 });
}

function rotated(values) {
  return values.length > 1 ? values.slice(1).concat(values[0]) : values.slice();
}

(async () => {
  const { browser, page, consoleErrs } = await H.launch({ width: 390, height: 844 });
  try {
    await H.boot(page, { settle: 2500 });

    // Contract-level identity checks for every supported Match Play player count.
    for (let n = 2; n <= 6; n++) {
      const got = await page.evaluate((count) => {
        const players = Array.from({ length: count }, (_, i) => ({ name: 'P' + (i + 1), color: 'c' + (i + 1) }));
        state.players = players;
        state.score = [];
        state.currentRound = 0;
        state.currentPlayer = 0;
        state.currentDart = 0;
        state.history = [];
        state.finished = true;
        state.gameAwarded = true;
        state.match = {
          id: 'sc033-' + count,
          mode: 'match',
          gameFormat: 'match_play',
          gameVariant: 'classic',
          targetWins: 3,
          gameNumber: 2,
          autoRotateOrder: true,
          wins: Array.from({ length: count }, (_, i) => 10 + i),
          history: [{
            totals: Array.from({ length: count }, (_, i) => 100 + i),
            board: Array.from({ length: count }, (_, i) => [{ owner: 'P' + (i + 1), roundTotal: i + 1, darts: [null, null, null] }]),
          }],
          completedLogged: false,
        };
        state.matchAgg = {
          hits: Array.from({ length: count }, (_, i) => ({ owner: 'P' + (i + 1) })),
          totals60: Array.from({ length: count }, (_, i) => 20 + i),
          totals100: Array.from({ length: count }, (_, i) => 30 + i),
          totals140: Array.from({ length: count }, (_, i) => 40 + i),
        };

        const before = {
          names: state.players.map(p => p.name),
          wins: state.match.wins.slice(),
          totals: state.match.history[0].totals.slice(),
          boards: state.match.history[0].board.map(rows => rows[0].owner),
          hits: state.matchAgg.hits.map(x => x.owner),
          t60: state.matchAgg.totals60.slice(),
          t100: state.matchAgg.totals100.slice(),
          t140: state.matchAgg.totals140.slice(),
        };
        const enabled = __sqAutoThrowOrderEnabled();
        const didRotate = __sqRotateThrowOrderOnePlace();
        return {
          enabled,
          didRotate,
          before,
          after: {
            names: state.players.map(p => p.name),
            wins: state.match.wins.slice(),
            totals: state.match.history[0].totals.slice(),
            boards: state.match.history[0].board.map(rows => rows[0].owner),
            hits: state.matchAgg.hits.map(x => x.owner),
            t60: state.matchAgg.totals60.slice(),
            t100: state.matchAgg.totals100.slice(),
            t140: state.matchAgg.totals140.slice(),
          },
        };
      }, n);

      assert.equal(got.enabled, true, n + '-player Match Play should enable AUTO');
      assert.equal(got.didRotate, true, n + '-player rotation should execute');
      for (const key of ['names', 'wins', 'totals', 'boards', 'hits', 't60', 't100', 't140']) {
        assert.deepEqual(got.after[key], rotated(got.before[key]), n + '-player ' + key + ' did not stay identity-aligned');
      }
    }

    // Mode isolation: Practice and Tournament must not inherit Match Play AUTO.
    const isolated = await page.evaluate(() => {
      const run = (match) => {
        state.players = [{ name: 'A' }, { name: 'B' }];
        state.match = Object.assign({
          gameFormat: 'match_play',
          autoRotateOrder: true,
          wins: [0, 0],
          history: [],
        }, match);
        const before = state.players.map(p => p.name);
        const enabled = __sqAutoThrowOrderEnabled();
        const rotated = __sqRotateThrowOrderOnePlace();
        return { enabled, rotated, before, after: state.players.map(p => p.name) };
      };
      return {
        // Non-Match modes never receive the boolean Match Play order policy.
        practice: run({ mode: 'practice', forcePractice: true, practiceType: 'classic', autoRotateOrder: undefined }),
        vsShadow: run({ mode: 'practice', forcePractice: true, practiceType: 'vsshadow' }),
        tournament: run({ tournament: true, tournamentType: 'classic' }),
      };
    });
    for (const [name, result] of Object.entries(isolated)) {
      assert.equal(result.enabled, false, name + ' must not enable SC-033 AUTO');
      assert.equal(result.rotated, false, name + ' must not rotate through SC-033');
      assert.deepEqual(result.after, result.before, name + ' player order changed');
    }

    // Reload to restore a clean UI/runtime, then prove the actual Match Play flow.
    await H.boot(page, { settle: 1800 });
    await H.toMatchCard(page);
    await H.addGuests(page, ['ALPHA', 'BETA']);

    await page.click('#startMatchBtn');
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const seg = document.querySelector('#mlGrid .mlw-seg[data-value="3"]');
      if (!seg) throw new Error('FT3 match-length segment missing');
      seg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.click('#mlStartBtn');
    await page.waitForSelector('.modal-throworder');

    const initialDialog = await page.evaluate(() => {
      const toggle = document.querySelector('.modal-throworder .to-auto-toggle');
      return {
        order: (state.players || []).map(p => p.name),
        gameNumberText: document.querySelector('.modal-throworder .to-subtitle')?.textContent || '',
        toggleText: toggle?.textContent || '',
        pressed: toggle?.getAttribute('aria-pressed') || '',
      };
    });
    assert.deepEqual(initialDialog.order, ['ALPHA', 'BETA'], 'Game 1 confirmed order changed before start');
    assert.match(initialDialog.gameNumberText, /GAME 1/i, 'Throw Order did not identify Game 1');
    assert.equal(initialDialog.toggleText.trim(), 'AUTO ON', 'AUTO should default ON for new Match Play');
    assert.equal(initialDialog.pressed, 'true', 'AUTO toggle aria state should default ON');

    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
      await page.waitForTimeout(120);
      const fit = await page.evaluate(() => {
        const modal = document.querySelector('.modal-throworder');
        const toggle = modal && modal.querySelector('.to-auto-toggle');
        const mr = modal && modal.getBoundingClientRect();
        const tr = toggle && toggle.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          modalLeft: mr ? mr.left : -999,
          modalRight: mr ? mr.right : 99999,
          toggleHeight: tr ? tr.height : 0,
        };
      });
      assert.equal(fit.overflow, false, width + 'px Throw Order must not create horizontal overflow');
      assert(fit.modalLeft >= -1 && fit.modalRight <= width + 1, width + 'px Throw Order modal must stay within viewport');
      assert(fit.toggleHeight >= 43.5, width + 'px AUTO toggle must preserve the canonical 44px minimum tap target');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(120);
    await shot(page, 'sc033-throw-order-auto-on', '.modal-throworder');

    // AUTO OFF must preserve the existing manual throw-order step between games.
    await page.click('.modal-throworder .to-auto-toggle');
    assert.equal(await page.getAttribute('.modal-throworder .to-auto-toggle', 'aria-pressed'), 'false');
    await page.click('.modal-throworder .to-start');
    await page.waitForFunction(() => document.body.dataset.page === 'game', { timeout: 15000 });
    await page.waitForTimeout(900);

    const game1 = await page.evaluate(() => ({
      order: state.players.map(p => p.name),
      auto: state.match.autoRotateOrder,
    }));
    assert.deepEqual(game1.order, ['ALPHA', 'BETA'], 'Game 1 order must stay as confirmed');
    assert.equal(game1.auto, false, 'AUTO OFF choice did not persist into game state');

    await H.playToCompletion(page, { strongPlayerName: 'ALPHA' });
    await dismissCompletion(page);
    await finishToLeaderboard(page);
    const offState = await page.evaluate(() => ({
      order: state.players.map(p => p.name),
      auto: state.match.autoRotateOrder,
      autoType: typeof state.match.autoRotateOrder,
      mode: state.match.mode || null,
      forcePractice: state.match.forcePractice === true,
    }));
    assert.equal(offState.autoType, 'boolean', 'Guest Match Play lost its explicit throw-order policy after Game 1 classification');
    assert.equal(offState.auto, false, 'AUTO OFF preference changed during Game 1 completion');
    const offBefore = offState.order;
    await page.click('#nextGameBtn');
    await page.waitForSelector('.modal-throworder');
    const offDialog = await page.evaluate(() => ({
      order: state.players.map(p => p.name),
      text: document.querySelector('.modal-throworder .to-auto-toggle')?.textContent || '',
      game: document.querySelector('.modal-throworder .to-subtitle')?.textContent || '',
    }));
    assert.deepEqual(offDialog.order, offBefore, 'AUTO OFF changed order before manual confirmation');
    assert.equal(offDialog.text.trim(), 'AUTO OFF', 'AUTO OFF was not retained for Game 2');
    assert.match(offDialog.game, /GAME 2/i, 'Throw Order did not identify Game 2');

    // Re-enable AUTO. The current Game 2 order stays manually confirmed; Game 3 rotates.
    await page.click('.modal-throworder .to-auto-toggle');
    await page.click('.modal-throworder .to-start');
    await page.waitForFunction(() => document.body.dataset.page === 'game', { timeout: 15000 });
    await page.waitForTimeout(900);
    const game2 = await page.evaluate(() => ({
      order: state.players.map(p => p.name),
      auto: state.match.autoRotateOrder,
    }));
    assert.deepEqual(game2.order, offBefore, 'Re-enabling AUTO must not rotate the current manually confirmed game');
    assert.equal(game2.auto, true, 'AUTO ON did not persist for subsequent games');

    await H.playToCompletion(page, { strongPlayerName: 'ALPHA' });
    await dismissCompletion(page);
    await finishToLeaderboard(page);
    const autoBefore = await page.evaluate(() => state.players.map(p => p.name));
    await page.click('#nextGameBtn');
    await page.waitForFunction(() => document.body.dataset.page === 'game', { timeout: 15000 });
    await page.waitForTimeout(1100);

    const game3 = await page.evaluate(() => ({
      order: state.players.map(p => p.name),
      auto: state.match.autoRotateOrder,
      gameNumber: state.match.gameNumber,
      modal: !!document.querySelector('.modal-throworder'),
    }));
    assert.deepEqual(game3.order, rotated(autoBefore), 'AUTO ON did not rotate exactly one place for Game 3');
    assert.equal(game3.auto, true, 'AUTO state was lost after automatic rotation');
    assert.equal(game3.modal, false, 'AUTO ON should bypass the manual Throw Order dialog');
    assert.equal(game3.gameNumber, 3, 'Match game number should be Game 3');

    // Existing local match save is the canonical resume cache; verify preference + order survive it.
    await page.evaluate(() => save());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const b = document.getElementById('bootSplash');
      return !b || b.hidden || getComputedStyle(b).display === 'none' || getComputedStyle(b).opacity === '0';
    }, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1800);
    assert(await page.isVisible('#resumeBtn'), 'Resume should be available for the saved in-progress Game 3');

    await page.click('#resumeBtn');
    await page.waitForFunction(() => document.body.dataset.page === 'game', { timeout: 15000 });
    await page.waitForTimeout(1000);
    const resumed = await page.evaluate(() => ({
      order: state.players.map(p => p.name),
      auto: state.match.autoRotateOrder,
      gameNumber: state.match.gameNumber,
    }));
    assert.deepEqual(resumed.order, game3.order, 'Refresh/resume changed the rotated player order');
    assert.equal(resumed.auto, true, 'Refresh/resume lost AUTO preference');
    assert.equal(resumed.gameNumber, 3, 'Refresh/resume changed game number');

    const pageErrors = consoleErrs.filter(x => String(x).startsWith('pageerror:'));
    assert.deepEqual(pageErrors, [], 'Unexpected page errors: ' + JSON.stringify(pageErrors));

    console.log('SC-033 throw-order rotation PASS');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
