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

      openGameCompleteDialog();
    });

    await page.waitForSelector('.sq-gamecomplete-backdrop');
    const gameOver = await page.evaluate(() =>
      (window.__sqSc042PostgameDmdWrites || []).find(w => w.z2 === 'GAME OVER' && w.type === 'marqueeFull') || null
    );
    assert(gameOver, 'GAME OVER full-width marquee was not written when completion opened');

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
