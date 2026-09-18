const assert = require('node:assert/strict');
const H = require('./harness');

(async () => {
  const { browser, page, consoleErrs } = await H.launch({ width:390, height:844 });
  try {
    await H.boot(page, { settle:2600 });
    await page.waitForFunction(() =>
      typeof window.openGameCompleteDialog === 'function' &&
      typeof window.showLeaderboard === 'function' &&
      typeof window.startNewGame === 'function' &&
      typeof window.recordThrow === 'function'
    );

    await page.evaluate(() => {
      const mkRounds = (base) => Array.from({ length:14 }, (_, i) => ({
        darts:[
          { kind:'S', sector:10, points:i === 0 ? base : 0 },
          { kind:'Miss', points:0 },
          { kind:'Miss', points:0 },
        ],
        roundTotal:i === 0 ? base : 0,
      }));
      state.players = [
        { id:'p1', name:'Test One', initials:'T1', color:'#64d8ff' },
        { id:'p2', name:'Test Two', initials:'T2', color:'#7be0a0' },
      ];
      state.score = [mkRounds(105), mkRounds(204)];
      state.currentRound = 13;
      state.currentPlayer = 1;
      state.currentDart = 0;
      state.finished = true;
      state.gameAwarded = false;
      state.history = [];
      state.match = {
        id:'sc042-postgame-polish',
        targetWins:3,
        gameNumber:2,
        wins:[0,1],
        completedLogged:false,
        history:[{
          totals:[105,204],
          board:[mkRounds(105), mkRounds(204)],
        }],
      };

      window.__sqSc042PostgameDmdWrites = [];
      const original = window.sqDmdShowZones;
      window.sqDmdShowZones = function(zones, opts) {
        try {
          window.__sqSc042PostgameDmdWrites.push({
            z2:String(zones && zones.z2 || ''),
            z3:String(zones && zones.z3 || ''),
            type:String(opts && opts.type || ''),
          });
        } catch (_) {}
        return original ? original.apply(this, arguments) : undefined;
      };

      try { show('game'); } catch (_) {}
      try { if (typeof updateUI === 'function') updateUI(); } catch (_) {}
    });

    await page.waitForFunction(() => document.body.dataset.page === 'game');
    await page.waitForTimeout(180);
    await page.evaluate(() => openGameCompleteDialog());
    await page.waitForSelector('.sq-gamecomplete-backdrop');
    const gameOver = await page.evaluate(() =>
      (window.__sqSc042PostgameDmdWrites || []).find(w => w.z2 === 'GAME OVER' && w.type === 'pulseFull') || null
    );
    assert(gameOver, 'GAME OVER centered pulse was not written when completion opened');

    const dmdMetric = async () => page.evaluate(() => {
      const c=document.getElementById('sqDmdCanvas');
      const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let minX=c.width,maxX=-1,minY=c.height,maxY=-1,lit=0;
      for(let y=0;y<c.height;y++) for(let x=0;x<c.width;x++){
        const i=(y*c.width+x)*4, r=d[i],g=d[i+1],b=d[i+2],a=d[i+3];
        if(!(a>80 && r>110 && g>45 && b<130 && r>g*1.18)) continue;
        lit++; if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
      }
      const bbox=maxX>=0?{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1}:{x:0,y:0,w:0,h:0};
      return {w:c.width,h:c.height,lit,bbox,cx:bbox.x+bbox.w/2};
    });
    await page.waitForTimeout(240); const pulseA=await dmdMetric();
    await page.waitForTimeout(900); const pulseB=await dmdMetric();
    assert(pulseA.lit>0 && pulseB.lit>0, 'GAME OVER pulse is not visibly rendered');
    assert(Math.abs(pulseA.cx-pulseA.w/2)<pulseA.w*0.08, 'GAME OVER is not centered in early pulse frame');
    assert(Math.abs(pulseB.cx-pulseB.w/2)<pulseB.w*0.08, 'GAME OVER is not centered in later pulse frame');
    assert(Math.abs(pulseA.cx-pulseB.cx)<pulseA.w*0.03, 'GAME OVER is travelling horizontally instead of pulsing in place');

    await page.evaluate(() => {
      document.querySelectorAll('.sq-gamecomplete-backdrop').forEach(n => n.remove());
      showLeaderboard();
    });
    await page.waitForFunction(() => document.body.dataset.page === 'leaderboard');
    await page.waitForSelector('#leaderboard #lbTable tbody tr');

    const board = await page.evaluate(() => {
      const box = document.querySelector('#leaderboard .lb-box');
      const table = document.querySelector('#leaderboard #lbTable');
      const rows = Array.from(document.querySelectorAll('#leaderboard #lbTable tbody tr'));
      const first = rows[0] && rows[0].querySelector('td');
      const wins = rows[rows.length - 1] && rows[rows.length - 1].querySelector('td');
      const next = document.getElementById('nextGameBtn');
      const bs = box ? getComputedStyle(box) : null;
      const ts = table ? getComputedStyle(table) : null;
      const fs = first ? getComputedStyle(first) : null;
      const ws = wins ? getComputedStyle(wins) : null;
      const ns = next ? getComputedStyle(next) : null;
      return {
        rows:rows.length,
        radius:bs ? parseFloat(bs.borderTopLeftRadius) : 0,
        spacing:ts ? ts.borderSpacing : '',
        firstRadius:fs ? parseFloat(fs.borderTopLeftRadius) : 0,
        firstLeft:fs ? parseFloat(fs.borderLeftWidth) : 0,
        firstBg:fs ? fs.backgroundImage : '',
        winsColor:ws ? ws.color : '',
        winsBg:ws ? ws.backgroundImage : '',
        nextBg:ns ? ns.backgroundImage : '',
        nextVisible:!!(next && !next.classList.contains('hidden')),
      };
    });

    console.log('SC-042 leaderboard computed style', JSON.stringify(board));
    assert.equal(board.rows, 4, 'leaderboard data rows changed');
    assert.ok(board.radius >= 14, 'leaderboard shell lost its rounded post-game surface');
    assert.match(board.spacing, /8px/, 'leaderboard rows are not visually separated into cards');
    assert.ok(board.firstRadius >= 10, 'leaderboard card row has no rounded leading edge');
    assert.ok(board.firstLeft >= 3, 'leaderboard card row lost its accent rail');
    assert.match(board.firstBg, /gradient/i, 'leaderboard row is not using the raised gradient card surface');
    assert.match(board.winsBg, /gradient/i, 'WINS row is not using the highlighted card treatment');
    assert.match(board.nextBg, /gradient/i, 'NEXT GAME is not using the post-game primary treatment');
    assert.equal(board.nextVisible, true, 'NEXT GAME lifecycle changed');

    await page.waitForTimeout(750);
    const leaderboardActions = await page.evaluate(() => {
      const stats=document.getElementById('statsHubBtnFinal');
      const stack=document.querySelector('#leaderboard .stacked-actions');
      const scores=document.getElementById('gameScoresBtn');
      return {
        statsVisible:!!(stats && stats.offsetParent),
        statsInStack:!!(stats && stack && stats.parentElement===stack),
        scoresWired:!!(scores && scores.__sqModernGameScoresWired)
      };
    });
    assert.equal(leaderboardActions.statsVisible, false, 'STATS must be removed from Match Leaderboard');
    assert.equal(leaderboardActions.statsInStack, false, 'STATS must not be relocated into Match Leaderboard actions');
    assert.equal(leaderboardActions.scoresWired, true, 'GAME SCORES was not rewired to the post-game scorecard component');

    await page.click('#gameScoresBtn');
    await page.waitForSelector('.sq-pg-history-modal .sq-pg-history-scorecard');
    const scoresUi=await page.evaluate(() => ({
      legacyTables:document.querySelectorAll('.sq-pg-history-modal table.hs-table').length,
      cards:document.querySelectorAll('.sq-pg-history-modal .sq-pg-history-scorecard').length,
      title:document.querySelector('.sq-pg-history-modal .sq-pg-scorecard-title')?.textContent?.trim()||'',
      rows:Array.from(document.querySelectorAll('.sq-pg-history-modal .sq-pg-score-row')).map(r=>r.textContent.replace(/\s+/g,' ').trim())
    }));
    assert.equal(scoresUi.legacyTables,0,'legacy round-by-round GAME SCORES table is still being used');
    assert.equal(scoresUi.cards,1,'expected one modern post-game scorecard for one completed game');
    assert.equal(scoresUi.title,'GAME 1 SCORECARD','modern GAME SCORES title mismatch');
    assert(scoresUi.rows.some(t=>/Test Two/i.test(t) && /204/.test(t)),'modern GAME SCORES missing winning player score');
    assert(scoresUi.rows.some(t=>/Test One/i.test(t) && /105/.test(t)),'modern GAME SCORES missing other player score');

    const unexpected = consoleErrs.filter(e => !/supabase|failed to fetch|networkerror|aborterror|failed to load resource:\s*net::err_failed/i.test(e));
    assert.deepEqual(unexpected, [], 'Unexpected console/page errors: ' + unexpected.join(' | '));
    console.log('SC-042 postgame presentation acceptance: PASS');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
