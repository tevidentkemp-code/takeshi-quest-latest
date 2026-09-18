const H = require('./harness');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  const { browser, page } = await H.launch();
  try {
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page, ['ALPHA', 'BETA']);
    await H.startMatch(page, 3);

    await page.waitForFunction(() =>
      typeof window.__sqAppendLatePlayer === 'function' &&
      typeof window.__sqLateJoinEligibility === 'function'
    );

    // Give ALPHA a score so we can prove existing state is untouched by roster expansion.
    await page.evaluate(() => recordThrow({ kind:'S' }));
    const before = await page.evaluate(() => ({
      players: state.players.map(p => p.name),
      alphaRound0: JSON.parse(JSON.stringify(state.score[0][0])),
      wins: (state.match.wins || []).slice(),
      aggLens: state.matchAgg ? {
        hits: state.matchAgg.hits?.length,
        t60: state.matchAgg.totals60?.length,
        t100: state.matchAgg.totals100?.length,
        t140: state.matchAgg.totals140?.length,
      } : null,
    }));

    const added = await page.evaluate(() =>
      window.__sqAppendLatePlayer({ name:'GAMMA', initials:'GA' }, 'guest')
    );
    assert(added === true, 'GAMMA should be added before cutoff');

    const after = await page.evaluate(() => ({
      players: state.players.map(p => p.name),
      alphaRound0: JSON.parse(JSON.stringify(state.score[0][0])),
      scoreLens: state.score.map(b => b.length),
      wins: (state.match.wins || []).slice(),
      aggLens: state.matchAgg ? {
        hits: state.matchAgg.hits?.length,
        t60: state.matchAgg.totals60?.length,
        t100: state.matchAgg.totals100?.length,
        t140: state.matchAgg.totals140?.length,
      } : null,
      job: JSON.parse(JSON.stringify(state.__sqCatchUp?.jobs?.[0] || null)),
    }));

    assert(after.players.join('|') === 'ALPHA|BETA|GAMMA', 'late player must be final thrower');
    assert(JSON.stringify(after.alphaRound0) === JSON.stringify(before.alphaRound0), 'existing score must remain unchanged');
    assert(after.scoreLens.length === 3 && after.scoreLens.every(n => n === 14), 'all players need full 14-round boards');
    assert(after.wins.length === 3 && after.wins[2] === 0, 'match wins must expand');
    assert(after.aggLens && Object.values(after.aggLens).every(n => n === 3), 'match aggregates must expand');
    assert(after.job && after.job.playerIndex === 2 && after.job.pendingRounds.length === 0, 'round-1 join should require no catch-up');

    // Force a clean mid-game state at round index 5 (15s), current table round.
    await page.evaluate(() => {
      const mk = () => Array.from({length:14}, () => ({darts:[null,null,null],roundTotal:0}));
      state.players = state.players.slice(0,2);
      state.score = [mk(), mk()];
      state.match.wins = [0,0];
      state.match.history = [];
      state.matchAgg = {
        hits:[{},{}],
        totals60:[0,0],
        totals100:[0,0],
        totals140:[0,0],
      };
      state.currentRound = 5;
      state.currentPlayer = 0;
      state.currentDart = 0;
      state.history = [];
      state.finished = false;
      delete state.__sqCatchUp;
      save();
      updateUI();
    });

    const addedLate = await page.evaluate(() =>
      window.__sqAppendLatePlayer({ name:'DELTA', initials:'DE' }, 'guest')
    );
    assert(addedLate === true, 'DELTA should be addable at 15s');

    const lateJob = await page.evaluate(() => JSON.parse(JSON.stringify(state.__sqCatchUp.jobs[0])));
    assert(lateJob.pendingRounds.join(',') === '2,3,4', 'late join catch-up should retain most recent three missed rounds');
    assert(lateJob.scratchedRounds.join(',') === '0,1', 'older missed rounds should be scratched');

    // Complete current table round for both incumbents and late player.
    // DELTA is now final thrower. Catch-up should begin only after DELTA completes round 5.
    await page.evaluate(() => {
      // ALPHA round 5
      state.currentPlayer = 0; state.currentRound = 5; state.currentDart = 0;
      recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'});
      // BETA round 5
      recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'});
    });
    let preDelta = await page.evaluate(() => ({p:state.currentPlayer,r:state.currentRound,d:state.currentDart,active:!!state.__sqCatchUp?.active}));
    assert(preDelta.p === 2 && preDelta.r === 5 && preDelta.active === false, 'catch-up must not interrupt the table round');

    await page.evaluate(() => {
      recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'});
    });
    let catch1 = await page.evaluate(() => ({p:state.currentPlayer,r:state.currentRound,d:state.currentDart,active:!!state.__sqCatchUp?.active}));
    assert(catch1.p === 2 && catch1.r === 2 && catch1.active === true, 'catch-up should start with oldest retained missed round');

    // Finish retained catch-up rounds 2,3,4.
    for (const expected of [2,3,4]) {
      const pos = await page.evaluate(() => ({p:state.currentPlayer,r:state.currentRound,d:state.currentDart}));
      assert(pos.p === 2 && pos.r === expected, 'unexpected catch-up round ' + JSON.stringify(pos));
      await page.evaluate(() => {
        recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'});
      });
    }
    const resumed = await page.evaluate(() => ({p:state.currentPlayer,r:state.currentRound,d:state.currentDart,active:!!state.__sqCatchUp?.active}));
    assert(resumed.p === 0 && resumed.r === 6 && resumed.active === false, 'normal play should resume at next live round');

    // Persist and reload during an active catch-up sequence.
    await page.evaluate(() => {
      const mk = () => Array.from({length:14}, () => ({darts:[null,null,null],roundTotal:0}));
      state.players = state.players.slice(0,2);
      state.score = [mk(),mk()];
      state.match.wins = [0,0];
      state.match.history = [];
      state.matchAgg = {hits:[{},{}],totals60:[0,0],totals100:[0,0],totals140:[0,0]};
      state.currentRound = 4; state.currentPlayer = 0; state.currentDart = 0; state.history=[]; state.finished=false;
      delete state.__sqCatchUp;
      window.__sqAppendLatePlayer({name:'EPSILON',initials:'EP'},'guest');
      // manually mark catch-up active in the exact persisted shape and save
      const j=state.__sqCatchUp.jobs[0];
      state.__sqCatchUp.active=true; state.__sqCatchUp.activeJobIndex=0;
      state.__sqCatchUp.resumeRound=5; state.__sqCatchUp.resumePlayer=0; state.__sqCatchUp.startedAfterRound=4;
      state.currentPlayer=j.playerIndex; state.currentRound=j.pendingRounds[0]; state.currentDart=0;
      save();
    });
    const persistedBefore = await page.evaluate(() => ({
      raw: localStorage.getItem(typeof STORAGE_KEY !== 'undefined' ? STORAGE_KEY : 'shateki_quest_scorer_v6'),
      p:state.currentPlayer,r:state.currentRound,cu:JSON.parse(JSON.stringify(state.__sqCatchUp))
    }));
    assert(persistedBefore.raw && persistedBefore.cu.active, 'catch-up state must persist locally');

    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForTimeout(2200);
    assert(await page.isVisible('#resumeBtn'), 'Resume Game should be visible after refresh');
    await page.click('#resumeBtn');
    await page.waitForFunction(() => document.body.dataset.page === 'game', {timeout:15000});
    await page.waitForTimeout(1000);
    const restored = await page.evaluate(() => ({
      p:state.currentPlayer,r:state.currentRound,d:state.currentDart,
      active:!!state.__sqCatchUp?.active,
      jobs:state.__sqCatchUp?.jobs?.length||0
    }));
    assert(restored.active && restored.jobs === 1, 'catch-up queue must survive refresh');
    assert(restored.p === 2, 'late player identity must survive refresh');

    // 17s boundary: no add once any dart at round index 7 has begun.
    const blocked17 = await page.evaluate(() => {
      state.currentRound = 7; state.currentPlayer = 0; state.currentDart = 1;
      state.history.push({player:0,round:7,dartIndex:0,throw:{kind:'Miss',points:0}});
      const gate = window.__sqLateJoinEligibility();
      const added = window.__sqAppendLatePlayer({name:'TOO LATE'},'guest');
      return {gate,added,count:state.players.length};
    });
    assert(blocked17.gate.ok === false && blocked17.added === false, 'late entry must close once 17s starts');

    // Game 2+ must reject mid-game late entry under Game Rules §3.6.
    const game2Blocked = await page.evaluate(() => {
      state.players = state.players.slice(0,2);
      state.score = state.score.slice(0,2);
      state.match.wins = [0,0];
      state.match.gameNumber = 2;
      state.currentRound = 0; state.currentPlayer = 0; state.currentDart = 0;
      state.history = []; state.finished = false;
      delete state.__sqCatchUp;
      const gate = window.__sqLateJoinEligibility();
      const added = window.__sqAppendLatePlayer({name:'GAME2 LATE'},'guest');
      return {gate,added,count:state.players.length};
    });
    assert(game2Blocked.gate.ok === false && game2Blocked.added === false, 'mid-game late entry must be blocked after Game 1');

    // Six-player cap.
    const cap = await page.evaluate(() => {
      const mk = () => Array.from({length:14}, () => ({darts:[null,null,null],roundTotal:0}));
      state.players = Array.from({length:6},(_,i)=>({name:'P'+(i+1),type:'guest'}));
      state.score = state.players.map(()=>mk());
      state.match.wins = Array(6).fill(0);
      state.matchAgg = {hits:Array(6).fill(null).map(()=>({})),totals60:Array(6).fill(0),totals100:Array(6).fill(0),totals140:Array(6).fill(0)};
      state.currentRound=0; state.currentPlayer=0; state.currentDart=0; state.history=[]; state.finished=false;
      delete state.__sqCatchUp;
      const gate=window.__sqLateJoinEligibility();
      const added=window.__sqAppendLatePlayer({name:'P7'},'guest');
      return {gate,added,count:state.players.length};
    });
    assert(cap.gate.ok === false && cap.added === false && cap.count === 6, 'six-player cap must hold');

    console.log('SC-034 ADD PLAYER: PASS');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error('SC-034 ADD PLAYER: FAIL');
  console.error(err && err.stack || err);
  process.exit(1);
});
