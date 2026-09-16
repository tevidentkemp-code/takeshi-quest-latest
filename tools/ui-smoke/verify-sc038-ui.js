const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness');

const OUT = process.env.SQ_SCREENSHOTS || path.join(__dirname, '../../qa-artifacts');
fs.mkdirSync(OUT, { recursive: true });

function p(name) { return path.join(OUT, name); }

(async () => {
  const { browser, page, consoleErrs } = await H.launch({ width: 390, height: 844 });
  try {
    await H.boot(page, { settle: 3200 });

    const wrapped = await page.evaluate(() => !!(window.openGameCompleteDialog && window.openGameCompleteDialog.__sqSc038Wrapped));
    assert.equal(wrapped, true, 'SC-038 completion wrapper did not install');

    await page.evaluate(() => {
      const mkQuery = (rows) => {
        const q = {};
        ['select','eq','neq','ilike','like','in','order','limit','gte','lte','is','not','maybeSingle','single'].forEach(k => {
          q[k] = () => q;
        });
        q.then = (resolve, reject) => Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        return q;
      };
      const recordRows = [
        { player_id:'11111111-1111-1111-1111-111111111111', player_name:'Test Alpha', best_score:310, best_score_pos:2 },
        { player_id:'22222222-2222-2222-2222-222222222222', player_name:'Test Beta', best_score:340, best_score_pos:1 }
      ];
      window.sb = {
        from(table) {
          if (table === 'v_player_best_official_ranked') return mkQuery(recordRows);
          return mkQuery([]);
        }
      };
      window.__sb = window.sb;

      const alphaRounds = [30,33,36,39,42,45,48,51,54,57,60,40,54,50];
      const betaRounds  = [20,22,24,26,28,30,32,34,36,38,40,32,42,25];
      const regularDarts = (roundTotal) => {
        let left = Number(roundTotal || 0);
        const darts = [];
        for (let i = 0; i < 3; i++) {
          const points = Math.max(0, Math.min(20, left));
          darts.push(points > 0 ? { kind:'S', sector:points, points } : { kind:'Miss', points:0 });
          left -= points;
        }
        return darts;
      };
      const toRows = (arr) => arr.map((roundTotal, index) => {
        let darts;
        if (index === 11) {
          darts = [{ kind:'D', sector:roundTotal / 2, points:roundTotal }, { kind:'Miss', points:0 }, { kind:'Miss', points:0 }];
        } else if (index === 12) {
          darts = [{ kind:'T', sector:roundTotal / 3, points:roundTotal }, { kind:'Miss', points:0 }, { kind:'Miss', points:0 }];
        } else if (index === 13) {
          darts = [{ kind:'B', bull:roundTotal === 50 ? 'Inner' : 'Outer', points:roundTotal }, { kind:'Miss', points:0 }, { kind:'Miss', points:0 }];
        } else {
          darts = regularDarts(roundTotal);
        }
        return { darts, roundTotal };
      });

      state.players = [
        {
          id:'11111111-1111-1111-1111-111111111111',
          player_id:'11111111-1111-1111-1111-111111111111',
          name:'Test Alpha', first_name:'Test', last_name:'Alpha', nickname:'Captain Double', initials:'TA', type:'registered'
        },
        {
          id:'22222222-2222-2222-2222-222222222222',
          player_id:'22222222-2222-2222-2222-222222222222',
          name:'Test Beta', first_name:'Test', last_name:'Beta', nickname:'The Verifier', initials:'TB', type:'registered'
        }
      ];
      state.score = [toRows(alphaRounds), toRows(betaRounds)];
      state.currentRound = 13;
      state.currentPlayer = 0;
      state.currentDart = 0;
      state.finished = false;
      state.gameAwarded = false;
      state.mode = 'official';
      state.gameMode = 'official';
      state.history = Array.from({ length:14 }, (_, round) => ({ round, player:0 }));
      state.__gameToken = 3801;
      state.match = Object.assign({}, state.match || {}, {
        id:'sc038-fixture-match', mode:'official', gameMode:'official', targetWins:3,
        history:[], wins:[0,0], completedLogged:false
      });
      // The production mode resolver verifies registered-player metadata. This
      // fixture is deliberately offline, so pin only the fixture's mode result.
      window.__sqComputeGameMode = () => 'official';
      try { delete state._decider; } catch (_) {}
      try { delete state.__sqGameCompleteOpen; } catch (_) {}
      try { delete state.__sqXpRevealedTok; } catch (_) {}

      // SC-038 owns navigation into the existing XP renderer, not the XP engine.
      // Count that handoff directly so this offline fixture does not need to
      // recreate every XP/achievement database dependency.
      const originalXpReveal = window.__sqGcXpReveal;
      if (typeof originalXpReveal !== 'function') throw new Error('Existing XP renderer missing');
      window.__sqSc038XpCalls = 0;
      window.__sqGcXpReveal = function(...args) {
        window.__sqSc038XpCalls += 1;
        return originalXpReveal.apply(this, args);
      };

      // Mirror the exact canonical Bull-row markup inside the real Throwpad host.
      // Canonical buildPad() does not add data-bull attributes to these controls.
      document.body.setAttribute('data-page', 'game');
      document.body.classList.add('livev2-on');
      const pad = document.getElementById('pad');
      if (!pad) throw new Error('Throwpad host missing');
      pad.innerHTML = '';
      pad.style.display = 'block';
      const probe = document.createElement('div');
      probe.id = 'sc038BullProbe';
      probe.className = 'dtBullRow';
      probe.style.cssText = 'position:fixed;left:12px;right:12px;top:12px;z-index:999999;background:#050812;padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;border-radius:14px';
      probe.innerHTML = '<button class="dtBullBtn" type="button">OUTER BULL</button><button class="dtBullBtn inner" type="button">INNER BULL</button>';
      pad.appendChild(probe);
    });

    const outerSel = '#pad #sc038BullProbe .dtBullBtn:first-child:not(.inner)';
    const innerSel = '#pad #sc038BullProbe .dtBullBtn.inner';
    await page.waitForSelector(outerSel);
    const bullColors = await page.evaluate(({ outerSel, innerSel }) => {
      const outer = document.querySelector(outerSel);
      const inner = document.querySelector(innerSel);
      const a = getComputedStyle(outer);
      const b = getComputedStyle(inner);
      return { outerBg:a.backgroundImage, outerBorder:a.borderTopColor, innerBg:b.backgroundImage, innerBorder:b.borderTopColor };
    }, { outerSel, innerSel });
    assert.match(bullColors.outerBg, /18, 92, 52|rgb\(18, 92, 52\)/, 'Outer Bull is not using the green SC-038 treatment');
    assert.match(bullColors.innerBg, /126, 27, 42|rgb\(126, 27, 42\)/, 'Inner Bull is not using the red SC-038 treatment');
    await page.locator('#sc038BullProbe').screenshot({ path:p('sc038-bull-runtime.png') });
    await page.evaluate(() => document.getElementById('sc038BullProbe')?.remove());

    await page.evaluate(() => {
      state.finished = true;
      openGameCompleteDialog();
    });
    await page.waitForSelector('.sq-gamecomplete-backdrop[data-sq-sc038="1"] .sq-pg-result:not([hidden])');
    await page.waitForTimeout(300);

    assert.equal(await page.locator('.gc-arcade-kicker').textContent(), 'GAME COMPLETE');
    assert.equal((await page.locator('.sq-pg-mainname').textContent()).trim(), 'Test Alpha');
    assert.match((await page.locator('.sq-pg-nickname').textContent()).trim(), /Captain Double/);
    assert.equal((await page.locator('.gc-statRow').filter({ hasText:'Best Round' }).locator('.gc-statValue').textContent()).trim(), 'R11 / 60');
    const statStyle = await page.locator('.gc-statRow').filter({ hasText:'Final Score' }).locator('.gc-statValue').evaluate(el => {
      const s = getComputedStyle(el);
      return { fontSize:parseFloat(s.fontSize), fontWeight:s.fontWeight };
    });
    assert.ok(statStyle.fontSize <= 24, 'Game Complete stat numbers are still too large');
    assert.ok(Number(statStyle.fontWeight) <= 500, 'Game Complete stat numbers are still bold');
    let visibleButtons = (await page.locator('.modal-gamecomplete button:visible').allTextContents()).map(t => t.replace(/\s+/g,' ').trim());
    assert.equal(visibleButtons.some(t => /VIEW BREAKDOWN|SCORECARD|END MATCH|NEXT ROUND/i.test(t)), false, 'Legacy post-game actions are still visible on result screen');
    assert.equal(visibleButtons.some(t => /NEXT/.test(t)), true, 'Result NEXT button missing');
    await page.screenshot({ path:p('sc038-result-runtime.png'), fullPage:false });

    await page.locator('.sq-pg-next').click();
    await page.waitForSelector('.sq-pg-scorecard:not([hidden])');
    await page.waitForTimeout(500);
    assert.equal(await page.locator('.sq-pg-score-row').count(), 2);
    assert.equal((await page.locator('.sq-pg-score-row').first().locator('.sq-pg-best').textContent()).trim(), 'R11 / 60');
    assert.equal(await page.locator('.sq-pg-badge.pb').count(), 2, 'Expected PB badges missing');
    assert.equal(await page.locator('.sq-pg-badge.wr').count(), 1, 'Expected WR badge missing');
    visibleButtons = (await page.locator('.modal-gamecomplete button:visible').allTextContents()).map(t => t.replace(/\s+/g,' ').trim());
    assert.equal(visibleButtons.some(t => /VIEW BREAKDOWN|SCORECARD|END MATCH|NEXT ROUND/i.test(t)), false, 'Legacy actions leaked onto scorecard');
    await page.screenshot({ path:p('sc038-scorecard-runtime.png'), fullPage:false });

    await page.locator('.sq-pg-next').evaluate(el => el.click());
    await page.waitForSelector('.sq-pg-xp-screen:not([hidden])');
    await page.waitForFunction(() => {
      const b = document.querySelector('.sq-pg-next');
      return b && !b.disabled && /NEXT GAME|FINISH MATCH/.test(b.textContent || '');
    }, { timeout:12000 });
    assert.equal((await page.locator('.sq-pg-next').textContent()).trim(), 'NEXT GAME');
    assert.equal(await page.evaluate(() => window.__sqSc038XpCalls), 1, 'Existing XP renderer handoff did not run exactly once');
    await page.screenshot({ path:p('sc038-xp-runtime.png'), fullPage:false });

    // The harness intentionally aborts all non-local requests (including production
    // Supabase and decorative remote assets), which Chromium reports as generic
    // ERR_FAILED console noise. Keep real application/page errors visible.
    const unexpected = consoleErrs.filter(e => !/supabase|failed to fetch|networkerror|aborterror|failed to load resource:\s*net::err_failed/i.test(e));
    assert.deepEqual(unexpected, [], 'Unexpected console/page errors: ' + unexpected.join(' | '));

    console.log('SC-038 runtime UI PASS');
    console.log(JSON.stringify({ screenshots:[
      p('sc038-bull-runtime.png'),
      p('sc038-result-runtime.png'),
      p('sc038-scorecard-runtime.png'),
      p('sc038-xp-runtime.png')
    ] }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
