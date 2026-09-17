const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./harness');

const OUT = process.env.SQ_SCREENSHOTS || path.join(__dirname, '../../qa-artifacts');
fs.mkdirSync(OUT, { recursive: true });
const shot = name => path.join(OUT, name);
const stage = name => console.log(`[SC-038] ${name}`);

function makeRoundRows(values) {
  return values.map((roundTotal, index) => {
    let darts;
    if (index === 11) {
      darts = [{ kind:'D', sector:roundTotal / 2, points:roundTotal }, { kind:'Miss', points:0 }, { kind:'Miss', points:0 }];
    } else if (index === 12) {
      darts = [{ kind:'T', sector:roundTotal / 3, points:roundTotal }, { kind:'Miss', points:0 }, { kind:'Miss', points:0 }];
    } else if (index === 13) {
      darts = [{ kind:'B', bull:roundTotal === 50 ? 'Inner' : 'Outer', points:roundTotal }, { kind:'Miss', points:0 }, { kind:'Miss', points:0 }];
    } else {
      let left = Number(roundTotal || 0);
      darts = Array.from({ length:3 }, () => {
        const points = Math.max(0, Math.min(20, left));
        left -= points;
        return points > 0 ? { kind:'S', sector:points, points } : { kind:'Miss', points:0 };
      });
    }
    return { darts, roundTotal };
  });
}

(async () => {
  const { browser, page, consoleErrs } = await H.launch({ width:390, height:844 });
  try {
    await H.boot(page, { settle:3200 });
    stage('booted');

    const runtime = await page.evaluate(() => ({
      wrapped: !!(window.openGameCompleteDialog && window.openGameCompleteDialog.__sqSc038Wrapped),
      hotfix: !!window.__sqSc038Hotfix,
      detectorFixed: !!(window.SQ_ACH && window.SQ_ACH.detectGame && window.SQ_ACH.detectGame.__sqSc038UntouchableFixed),
      xpRenderer: typeof window.__sqGcXpReveal === 'function',
      leaderboardRoute: typeof window.awardAndShowLeaderboard === 'function' && typeof window.showLeaderboard === 'function',
    }));
    assert.deepEqual(runtime, {
      wrapped:true,
      hotfix:true,
      detectorFixed:true,
      xpRenderer:true,
      leaderboardRoute:true,
    }, 'Required SC-038 runtime contracts are not installed');

    const alphaRounds = [30,33,36,39,42,45,48,51,54,57,60,40,54,50];
    const betaRounds  = [20,22,24,26,28,30,32,34,36,38,40,32,42,25];

    await page.evaluate(({ alpha, beta }) => {
      const mkQuery = rows => {
        const q = {};
        ['select','eq','neq','ilike','like','or','in','order','limit','gte','lte','is','not','maybeSingle','single'].forEach(k => {
          q[k] = () => q;
        });
        q.then = (resolve, reject) => Promise.resolve({ data:rows, error:null }).then(resolve, reject);
        return q;
      };
      const recordRows = [
        { player_id:'11111111-1111-1111-1111-111111111111', player_name:'Test Alpha', best_score:310, best_score_pos:2 },
        { player_id:'22222222-2222-2222-2222-222222222222', player_name:'Test Beta', best_score:340, best_score_pos:1 },
      ];
      window.sb = {
        from(table) {
          if (table === 'v_player_best_official_ranked') return mkQuery(recordRows);
          if (table === 'v_player_xp') return mkQuery([
            { player_id:'11111111-1111-1111-1111-111111111111', name:'Test Alpha', total_xp:240 },
            { player_id:'22222222-2222-2222-2222-222222222222', name:'Test Beta', total_xp:180 },
          ]);
          return mkQuery([]);
        },
      };
      window.__sb = window.sb;

      // The post-game test owns presentation/navigation. Give the real animated
      // renderer deterministic pre-game XP so CI never waits on an offline
      // Supabase request or a stale cache/in-flight promise.
      if (window.SQ_XP) {
        window.SQ_XP._cache = null;
        window.SQ_XP._cacheAt = 0;
        window.SQ_XP._inflight = null;
        window.__sqSc038OriginalXpForName = window.SQ_XP.forName;
        window.SQ_XP.forName = async name => ({
          name,
          total_xp: /Alpha/i.test(String(name || '')) ? 240 : 180,
        });
      }
      if (window.SQ_ACH) {
        window.SQ_ACH._cache = {};
        window.SQ_ACH._playerDirectoryCache = null;
        window.SQ_ACH._playerDirectoryCacheAt = 0;
        window.SQ_ACH._playerDirectoryInflight = null;
      }

      state.players = [
        { id:'11111111-1111-1111-1111-111111111111', player_id:'11111111-1111-1111-1111-111111111111', name:'Test Alpha', first_name:'Test', last_name:'Alpha', nickname:'Captain Double', initials:'TA', type:'registered' },
        { id:'22222222-2222-2222-2222-222222222222', player_id:'22222222-2222-2222-2222-222222222222', name:'Test Beta', first_name:'Test', last_name:'Beta', nickname:'The Verifier', initials:'TB', type:'registered' },
      ];
      state.score = [alpha, beta];
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
        history:[], wins:[0,0], completedLogged:false,
      });
      window.__sqComputeGameMode = () => 'official';
      try { delete state._decider; } catch (_) {}
      try { delete state.__sqGameCompleteOpen; } catch (_) {}
      try { delete state.__sqXpRevealedTok; } catch (_) {}

      const originalXpReveal = window.__sqGcXpReveal;
      window.__sqSc038XpCalls = 0;
      window.__sqGcXpReveal = function(...args) {
        window.__sqSc038XpCalls += 1;
        return originalXpReveal.apply(this, args);
      };

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
    }, { alpha:makeRoundRows(alphaRounds), beta:makeRoundRows(betaRounds) });
    stage('fixture installed');

    const outerSel = '#pad #sc038BullProbe .dtBullBtn:first-child:not(.inner)';
    const innerSel = '#pad #sc038BullProbe .dtBullBtn.inner';
    await page.waitForSelector(outerSel);
    const bullColors = await page.evaluate(({ outerSel, innerSel }) => {
      const outer = getComputedStyle(document.querySelector(outerSel));
      const inner = getComputedStyle(document.querySelector(innerSel));
      return { outerBg:outer.backgroundImage, innerBg:inner.backgroundImage };
    }, { outerSel, innerSel });
    assert.match(bullColors.outerBg, /18, 92, 52|rgb\(18, 92, 52\)/, 'Outer Bull is not green');
    assert.match(bullColors.innerBg, /126, 27, 42|rgb\(126, 27, 42\)/, 'Inner Bull is not red');
    await page.locator('#sc038BullProbe').screenshot({ path:shot('sc038-bull-runtime.png') });
    await page.evaluate(() => document.getElementById('sc038BullProbe')?.remove());
    stage('bull colours passed');

    await page.evaluate(() => { state.finished = true; openGameCompleteDialog(); });
    await page.waitForSelector('.sq-gamecomplete-backdrop[data-sq-sc038="1"] .sq-pg-result:not([hidden])');
    await page.waitForTimeout(250);
    assert.equal((await page.locator('.gc-arcade-kicker').textContent()).trim(), 'GAME COMPLETE');
    assert.equal((await page.locator('.sq-pg-mainname').textContent()).trim(), 'Test Alpha');
    assert.match((await page.locator('.sq-pg-nickname').textContent()).trim(), /Captain Double/);
    assert.equal((await page.locator('.gc-statRow').filter({ hasText:'Best Round' }).locator('.gc-statValue').textContent()).trim(), 'R11 / 60');
    const statStyle = await page.locator('.gc-statRow').filter({ hasText:'Final Score' }).locator('.gc-statValue').evaluate(el => {
      const s = getComputedStyle(el);
      return { size:parseFloat(s.fontSize), weight:Number(s.fontWeight) };
    });
    assert.ok(statStyle.size <= 24, 'Game Complete numbers are still too large');
    assert.ok(statStyle.weight <= 500, 'Game Complete numbers are still bold');
    assert.equal((await page.locator('.modal-gamecomplete button:visible').allTextContents()).some(t => /VIEW BREAKDOWN|SCORECARD|END MATCH|NEXT ROUND/i.test(t)), false, 'Legacy result actions remain visible');
    await page.screenshot({ path:shot('sc038-result-runtime.png'), fullPage:false });
    stage('game complete passed');

    await page.locator('.sq-pg-next').click();
    await page.waitForSelector('.sq-pg-scorecard:not([hidden])');
    assert.equal(await page.locator('.sq-pg-score-row').count(), 2);
    assert.equal((await page.locator('.sq-pg-score-row').first().locator('.sq-pg-best').textContent()).trim(), 'R11 / 60');
    assert.equal(await page.locator('.sq-pg-badge.pb').count(), 2, 'PB badges missing');
    assert.equal(await page.locator('.sq-pg-badge.wr').count(), 1, 'WR badge missing');
    await page.screenshot({ path:shot('sc038-scorecard-runtime.png'), fullPage:false });
    stage('scorecard passed');

    await page.locator('.sq-pg-next').click();
    await page.waitForSelector('.sq-pg-xp-screen:not([hidden])');
    await page.waitForFunction(() => /XP EARNED/.test(document.querySelector('.sq-pg-xp-screen:not([hidden]) .gc-xp-title')?.textContent || ''), null, { timeout:8000 });
    await page.waitForFunction(() => document.querySelectorAll('.sq-pg-xp-screen:not([hidden]) .gc-xp-row').length === 2, null, { timeout:8000 });
    await page.waitForFunction(() => {
      const b = document.querySelector('.sq-pg-next');
      return b && !b.disabled && /MATCH LEADERBOARD/.test(b.textContent || '');
    }, null, { timeout:8000 });
    assert.equal(await page.locator('.sq-pg-xp-screen .gc-xp-row').count(), 2, 'Animated XP rows did not render');
    assert.equal(await page.evaluate(() => window.__sqSc038XpCalls), 1, 'XP renderer did not run exactly once');
    assert.equal(await page.evaluate(() => ('uniqueWon' in window) || ('neverBehind' in window)), false, 'Detector compatibility globals leaked');
    await page.screenshot({ path:shot('sc038-xp-runtime.png'), fullPage:false });
    stage('animated XP passed');

    await page.evaluate(() => {
      window.__sqSc038LeaderboardCalls = 0;
      window.awardAndShowLeaderboard = async function() {
        window.__sqSc038LeaderboardCalls += 1;
        state.gameAwarded = true;
        showLeaderboard();
      };
    });
    await page.locator('.sq-pg-next').click();
    await page.waitForFunction(() => document.body.getAttribute('data-page') === 'leaderboard', null, { timeout:4000 });
    assert.equal(await page.evaluate(() => window.__sqSc038LeaderboardCalls), 1, 'Match Leaderboard handoff did not run exactly once');
    assert.equal(await page.locator('.sq-gamecomplete-backdrop').count(), 0, 'Game Complete overlay remained open');
    await page.screenshot({ path:shot('sc038-match-leaderboard-runtime.png'), fullPage:false });
    stage('match leaderboard passed');

    const unexpected = consoleErrs.filter(e => !/supabase|failed to fetch|networkerror|aborterror|failed to load resource:\s*net::err_failed/i.test(e));
    assert.deepEqual(unexpected, [], 'Unexpected console/page errors: ' + unexpected.join(' | '));

    console.log('SC-038 runtime UI PASS');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
