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
      xpBreakdown: !!window.__sqSc038XpBreakdown,
      leaderboardRoute: typeof window.awardAndShowLeaderboard === 'function' && typeof window.showLeaderboard === 'function',
    }));
    assert.deepEqual(runtime, {
      wrapped:true,
      hotfix:true,
      detectorFixed:true,
      xpRenderer:true,
      xpBreakdown:true,
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
        window.__sqSc038XpForNameCalls = [];
        window.SQ_XP.forName = async name => {
          window.__sqSc038XpForNameCalls.push({ name:String(name || ''), at:performance.now() });
          await new Promise(resolve => setTimeout(resolve, 120));
          return {
            player_id: /Alpha/i.test(String(name || ''))
              ? '11111111-1111-1111-1111-111111111111'
              : '22222222-2222-2222-2222-222222222222',
            name,
            total_xp: /Alpha/i.test(String(name || '')) ? 240 : 180,
          };
        };
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
      try { delete window.__sqGcXpPrefetch; } catch (_) {}

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
    await page.waitForFunction(() => (window.__sqSc038XpForNameCalls || []).length === 2, null, { timeout:1000 });
    const prefetch = await page.evaluate(() => {
      const calls = window.__sqSc038XpForNameCalls || [];
      return {
        count:calls.length,
        startSpread:calls.length >= 2 ? Math.abs(Number(calls[1].at || 0) - Number(calls[0].at || 0)) : 9999,
        key:String(window.__sqGcXpPrefetch && window.__sqGcXpPrefetch.key || '')
      };
    });
    assert.equal(prefetch.count, 2, 'Game Winner did not start XP reads for both players');
    assert.ok(prefetch.startSpread < 50, 'XP reads did not start in parallel at game end: ' + JSON.stringify(prefetch));
    assert.ok(prefetch.key.includes('test alpha') && prefetch.key.includes('test beta'), 'XP prefetch is not keyed to the completed game players');
    await page.waitForFunction(() => Array.isArray(window.__sqGcXpPrefetch?.resolved) && window.__sqGcXpPrefetch.resolved.length === 2, null, { timeout:1000 });
    await page.waitForTimeout(50);
    assert.equal((await page.locator('.gc-arcade-kicker').textContent()).trim(), 'GAME WINNER');
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

    const xpRevealStarted = Date.now();
    await page.locator('.sq-pg-next').click();
    await page.waitForSelector('.sq-pg-xp-screen:not([hidden])');
    await page.waitForFunction(() => /XP EARNED/.test(document.querySelector('.sq-pg-xp-screen:not([hidden]) .gc-xp-title')?.textContent || ''), null, { timeout:1500 });
    await page.waitForFunction(() => document.querySelectorAll('.sq-pg-xp-screen:not([hidden]) .gc-xp-row').length === 2, null, { timeout:1500 });
    const xpFirstPaintMs = Date.now() - xpRevealStarted;
    assert.ok(xpFirstPaintMs < 300, 'Prefetched XP screen did not paint immediately: ' + xpFirstPaintMs + 'ms');
    await page.waitForFunction(() => {
      const b = document.querySelector('.sq-pg-next');
      return b && !b.disabled && /MATCH LEADERBOARD/.test(b.textContent || '');
    }, null, { timeout:8000 });
    assert.equal(await page.locator('.sq-pg-xp-screen .gc-xp-row').count(), 2, 'Animated XP rows did not render');
    assert.equal(await page.evaluate(() => window.__sqSc038XpCalls), 1, 'XP renderer did not run exactly once');
    assert.equal(await page.evaluate(() => ('uniqueWon' in window) || ('neverBehind' in window)), false, 'Detector compatibility globals leaked');

    const xpLayout = await page.locator('.sq-pg-xp-screen .gc-xp-row').first().evaluate(row => {
      const labels = Array.from(row.querySelectorAll('.gc-xp-source-label')).map(el => (el.textContent || '').trim());
      const chipTracks = Array.from(row.querySelectorAll('.gc-xp-source-chips')).map(el => ({
        overflowX:getComputedStyle(el).overflowX,
        scrollWidth:el.scrollWidth,
        clientWidth:el.clientWidth,
      }));
      const nameBox = row.querySelector('.gc-xp-name')?.getBoundingClientRect();
      const rank = row.querySelector('.gc-xp-rankstack');
      const rankBox = rank?.getBoundingClientRect();
      const levelUp = row.querySelector('.gc-xp-lvup');
      const levelUpBox = levelUp?.getBoundingClientRect();
      const badge = row.querySelector('.gc-xp-lvholder')?.firstElementChild;
      const badgeBox = badge?.getBoundingClientRect();
      return {
        labels,
        chipTracks,
        rankText:(rank?.textContent || '').trim(),
        badgeText:(badge?.textContent || '').trim(),
        levelUpText:(levelUp?.textContent || '').trim(),
        rankRight:rankBox?.right || 0,
        nameRight:nameBox?.right || 0,
        badgeTop:badgeBox?.top || 0,
        levelUpTop:levelUpBox?.top || 0,
      };
    });
    assert.deepEqual(
      xpLayout.labels.map(label => label.replace(/\s+[+-]?\d+$/, '')),
      ['BASE XP','POSITIVE','NEGATIVE'],
      'XP breakdown rows are not in the requested order'
    );
    assert.equal(xpLayout.chipTracks.length, 3, 'XP breakdown is missing a horizontal source track');
    xpLayout.chipTracks.forEach((track, index) => {
      assert.equal(track.overflowX, 'auto', `XP source track ${index + 1} is not horizontally scrollable`);
    });
    assert.ok(/LV\s*\d+/i.test(xpLayout.badgeText), 'Level badge is missing from the XP card');
    assert.ok(xpLayout.rankRight > xpLayout.nameRight, 'Level badge stack is not positioned at the right side of the card');
    if (/LEVEL UP!/i.test(xpLayout.rankText)) {
      assert.ok(xpLayout.levelUpTop >= xpLayout.badgeTop, 'LEVEL UP notification is not below the level badge');
    }
    assert.ok(await page.locator('.gc-xp-source-chip.base').count() >= 2, 'Basic XP source chips did not render');
    assert.ok(await page.locator('.gc-xp-source-chip.positive').count() + await page.locator('.gc-xp-source-chip.milestone').count() >= 1, 'Positive XP source chips did not render');
    assert.ok(await page.locator('.gc-xp-source-chip.negative, .gc-xp-source-chip.empty').count() >= 1, 'Negative XP source row did not render');

    const xpHero = await page.locator('.sq-pg-xp-screen .gc-xp-row').first().evaluate(row => {
      const portrait = row.querySelector('.gc-xp-portrait');
      const avatar = row.querySelector('.gc-xp-avatar-sprite');
      const rank = row.querySelector('.gc-xp-current-value');
      const game = row.querySelector('.gc-xp-gamebar-head');
      const total = row.querySelector('.gc-xp-totalbar-head');
      return {
        portrait:!!portrait,
        avatarId:avatar?.dataset.avatarId || '',
        rank:(rank?.textContent || '').trim(),
        game:(game?.textContent || '').trim(),
        total:(total?.textContent || '').trim(),
      };
    });
    assert.equal(xpHero.portrait, true, 'XP card is missing the player profile portrait');
    assert.ok(/^\d+$/.test(xpHero.avatarId), 'XP profile portrait is not using the canonical avatar identity');
    assert.ok(/ROOKIE|AMATEUR|MARKSMAN|SHARPSHOOTER|SNIPER|ACE|MASTER|GRANDMASTER|LEGEND|IMMORTAL/i.test(xpHero.rank), 'Canonical XP rank is not clearly shown on the profile image');
    assert.match(xpHero.game, /THIS GAME XP/i, 'This Game XP hierarchy is missing');
    assert.match(xpHero.total, /TOTAL XP/i, 'Total XP hierarchy is missing');

    const infoChip = page.locator('.sq-pg-xp-screen .gc-xp-source-chip[data-xp-info]').first();
    assert.ok(await infoChip.count(), 'Clickable XP award/source chip missing');
    await infoChip.click();
    await page.waitForSelector('.gc-xp-info-backdrop .gc-xp-info-card');
    assert.ok((await page.locator('.gc-xp-info-copy').textContent()).trim().length > 0, 'XP award explanation popup has no explanation');
    await page.locator('.gc-xp-info-close').click();
    await page.waitForFunction(() => !document.querySelector('.gc-xp-info-backdrop'));

    await page.screenshot({ path:shot('sc038-xp-runtime.png'), fullPage:false });
    stage('animated XP breakdown passed');

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


    // SC-055: the deciding game still shows GAME WIN first. Only after XP may
    // a truly completed match expose the separate MATCH WIN screen.
    await page.evaluate(() => {
      document.body.setAttribute('data-page', 'game');
      state.finished = true;
      state.gameAwarded = false;
      state.mode = 'official';
      state.gameMode = 'official';
      state.match = Object.assign({}, state.match || {}, {
        id:'sc055-final-match', mode:'official', gameMode:'official',
        targetWins:3, history:[], wins:[2,1], completedLogged:false,
      });
      window.__sqComputeGameMode = () => 'official';
      window.__sqSc055LeaderboardCalls = 0;
      window.awardAndShowLeaderboard = async function() {
        window.__sqSc055LeaderboardCalls += 1;
        state.gameAwarded = true;
        showLeaderboard();
      };
      window.__sqGcXpReveal = function(host, done) {
        if (host) host.innerHTML = '<div class="gc-xp-title">XP EARNED</div><div class="gc-xp-row"></div><div class="gc-xp-row"></div>';
        if (typeof done === 'function') done();
      };
      try { delete state.__sqGameCompleteOpen; } catch (_) {}
      openGameCompleteDialog();
    });

    await page.waitForSelector('.sq-gamecomplete-backdrop[data-sq-sc038="1"][data-sq-sc055-match-complete="1"] .sq-pg-result:not([hidden])');
    assert.equal((await page.locator('.gc-arcade-kicker').textContent()).trim(), 'GAME WINNER', 'Deciding game skipped GAME WIN');
    assert.equal(await page.locator('.sq-pg-match-win').count(), 1, 'Completed match did not prepare a Match Win screen');
    assert.equal(await page.locator('.sq-pg-match-win:not([hidden])').count(), 0, 'Match Win appeared before Game Win/Scorecard/XP');

    await page.locator('.sq-pg-next').click();
    await page.waitForSelector('.sq-pg-scorecard:not([hidden])');
    await page.locator('.sq-pg-next').click();
    await page.waitForSelector('.sq-pg-xp-screen:not([hidden])');
    await page.waitForFunction(() => {
      const b = document.querySelector('.sq-pg-next');
      return b && !b.disabled && /MATCH WIN/.test(b.textContent || '');
    }, null, { timeout:3000 });

    assert.equal(await page.locator('.sq-pg-match-win:not([hidden])').count(), 0, 'Match Win appeared before XP finished');
    await page.locator('.sq-pg-next').click();
    await page.waitForSelector('.sq-pg-match-win:not([hidden])');
    assert.equal((await page.locator('.sq-pg-match-kicker').textContent()).trim(), 'MATCH WINNER');
    assert.equal((await page.locator('.sq-pg-match-name').textContent()).trim(), 'Test Alpha');
    assert.equal((await page.locator('.sq-pg-match-score').textContent()).trim(), '3–1');
    assert.equal(await page.locator('.sq-pg-match-celebration').count(), 1, 'Match winner celebration art missing');
    assert.equal(await page.locator('.sq-pg-opponent').count(), 1, 'Actual opponent reaction portrait missing');
    assert.match((await page.locator('.sq-pg-next').textContent()).trim(), /MATCH LEADERBOARD/);
    await page.screenshot({ path:shot('sc055-match-win-runtime.png'), fullPage:false });
    stage('SC-055 match win gate passed');

    await page.locator('.sq-pg-next').click();
    await page.waitForFunction(() => document.body.getAttribute('data-page') === 'leaderboard', null, { timeout:4000 });
    assert.equal(await page.evaluate(() => window.__sqSc055LeaderboardCalls), 1, 'Final Match Leaderboard handoff did not run exactly once');
    assert.equal(await page.locator('.sq-gamecomplete-backdrop').count(), 0, 'Match Win overlay remained open');

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
