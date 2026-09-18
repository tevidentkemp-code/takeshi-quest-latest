const H = require('./harness');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  const { browser, page } = await H.launch();
  try {
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page, ['ALPHA', 'BETA', 'GAMMA']);
    await H.startMatch(page, 3);

    await page.waitForFunction(() =>
      typeof window.__sqSkipAbsentVisit === 'function' &&
      typeof window.__sqAbsentPlayers === 'function' &&
      typeof window.__sqMarkPlayerReturned === 'function'
    );

    const reset = async (round=2, player=1, players=3) => {
      await page.evaluate(({round,player,players}) => {
        const mk = () => Array.from({length:14}, () => ({darts:[null,null,null],roundTotal:0}));
        const names = ['ALPHA','BETA','GAMMA','DELTA','EPSILON','ZETA'];
        state.players = Array.from({length:players},(_,i)=>({id:'p'+i,name:names[i],initials:names[i].slice(0,2)}));
        state.score = state.players.map(()=>mk());
        state.match = Object.assign({}, state.match || {}, {
          gameFormat:'match_play',
          gameNumber:1,
          wins:Array(players).fill(0),
          history:[],
          autoRotateOrder:true
        });
        delete state.match.tournamentType;
        delete state.match.tournament;
        state.matchAgg={hits:Array(players).fill(null).map(()=>({})),totals60:Array(players).fill(0),totals100:Array(players).fill(0),totals140:Array(players).fill(0)};
        state.currentRound=round;
        state.currentPlayer=player;
        state.currentDart=0;
        state.history=[];
        state.finished=false;
        state.suddenDeath={active:false};
        delete state.__sqCatchUp;
        save();
        updateUI();
      }, {round,player,players});
    };

    // Real Throwpad integration: start-of-turn SKIP GO must create an absence,
    // leave the scoring row untouched and advance without three scored misses.
    await reset(2,1,3);
    await page.waitForSelector('#pad .dtActBtn.skip', {state:'visible'});
    await page.click('#pad .dtActBtn.skip');
    await page.waitForTimeout(200);

    let s = await page.evaluate(() => ({
      p:state.currentPlayer,r:state.currentRound,d:state.currentDart,
      darts:state.score[1][2].darts,
      hist:state.history[state.history.length-1],
      job:JSON.parse(JSON.stringify(state.__sqCatchUp?.jobs?.[0]||null)),
      absent:window.__sqAbsentPlayers()
    }));
    assert(s.p===2 && s.r===2 && s.d===0, 'Skip Go must advance to the next player in the same table round');
    assert(s.darts.every(x=>x===null), 'pending absence round must not be recorded as scored misses');
    assert(s.hist && s.hist.type==='absenceSkip', 'Skip Go must create an undoable absence history event');
    assert(s.job && s.job.kind==='absence' && s.job.pendingRounds.join(',')==='2', 'absence job must retain the skipped round');
    assert(s.absent.length===1 && s.absent[0].name==='BETA', 'BETA should be exposed as absent');

    // Game Menu must expose the explicit return path.
    await page.evaluate(() => window.__sqOpenGameMenu106());
    await page.waitForTimeout(100);
    const menuText = await page.locator('.sq-menu106').last().innerText().catch(()=> '');
    assert(/PLAYER RETURNED/i.test(menuText) && /BETA/i.test(menuText), 'Game Menu must expose Player Returned for absent players');
    await page.keyboard.press('Escape').catch(()=>{});

    // Finish GAMMA's round: because BETA has not returned, play advances normally.
    await page.evaluate(() => {
      recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'});
    });
    s = await page.evaluate(() => ({p:state.currentPlayer,r:state.currentRound,active:!!state.__sqCatchUp?.active}));
    assert(s.p===0 && s.r===3 && s.active===false, 'unreturned player must not interrupt the next table round');

    async function completeAlphaThenSkipBeta(round) {
      await page.evaluate((round) => {
        if(state.currentPlayer!==0 || state.currentRound!==round) throw new Error('expected ALPHA at round '+round);
        recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'});
      }, round);
      const pos = await page.evaluate(() => ({p:state.currentPlayer,r:state.currentRound,d:state.currentDart}));
      assert(pos.p===1 && pos.r===round && pos.d===0, 'BETA should reach scheduled turn before another absence skip');
      const handled = await page.evaluate(() => window.__sqSkipAbsentVisit());
      assert(handled===true, 'start-of-turn absence skip must be handled');
    }
    async function completeGamma(round) {
      await page.evaluate((round) => {
        if(state.currentPlayer!==2 || state.currentRound!==round) throw new Error('expected GAMMA at round '+round);
        recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'});
      }, round);
    }

    await completeAlphaThenSkipBeta(3); await completeGamma(3);
    await completeAlphaThenSkipBeta(4); await completeGamma(4);

    // Fourth missed round should scratch the oldest and remain undoable.
    await page.evaluate(() => {
      if(state.currentPlayer!==0 || state.currentRound!==5) throw new Error('expected ALPHA round 5');
      recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'});
    });
    let handled = await page.evaluate(() => window.__sqSkipAbsentVisit());
    assert(handled===true, 'fourth absence skip should be handled');
    s = await page.evaluate(() => {
      const job=state.__sqCatchUp.jobs.find(j=>j.kind==='absence'&&!j.completed&&j.playerIndex===1);
      return {
        pending:job.pendingRounds.slice(),
        scratched:job.scratchedRounds.slice(),
        r2:JSON.parse(JSON.stringify(state.score[1][2]))
      };
    });
    assert(s.pending.join(',')==='3,4,5', 'only the most recent three missed rounds stay recoverable');
    assert(s.scratched.join(',')==='2', 'oldest missed round must be scratched after backlog exceeds three');
    assert(s.r2.darts.every(d=>d && d.kind==='Scratch' && d.points===0), 'scratched round must be materialised as a zero, not a scored Miss action');

    await page.evaluate(() => undo());
    s = await page.evaluate(() => {
      const job=state.__sqCatchUp.jobs.find(j=>j.kind==='absence'&&!j.completed&&j.playerIndex===1);
      return {
        p:state.currentPlayer,r:state.currentRound,d:state.currentDart,
        pending:job.pendingRounds.slice(),
        scratched:job.scratchedRounds.slice(),
        r2:JSON.parse(JSON.stringify(state.score[1][2]))
      };
    });
    assert(s.p===1 && s.r===5 && s.d===0, 'Undo must restore the skipped player/round cursor');
    assert(s.pending.join(',')==='2,3,4' && s.scratched.length===0, 'Undo must restore absence queue exactly');
    assert(s.r2.darts.every(d=>d===null), 'Undo must restore pre-scratch board state');

    handled = await page.evaluate(() => window.__sqSkipAbsentVisit());
    assert(handled===true, 'reapplied absence skip should succeed');

    // Returning before the table round ends queues catch-up; it must not interrupt GAMMA.
    const returned = await page.evaluate(() => window.__sqMarkPlayerReturned(1));
    assert(returned===true, 'Player Returned must mark the active absence job returned');
    s = await page.evaluate(() => ({p:state.currentPlayer,r:state.currentRound,absent:window.__sqAbsentPlayers(),active:!!state.__sqCatchUp.active}));
    assert(s.p===2 && s.r===5 && s.absent.length===0 && s.active===false, 'return must wait until current table round finishes');

    await completeGamma(5);
    s = await page.evaluate(() => ({p:state.currentPlayer,r:state.currentRound,d:state.currentDart,active:!!state.__sqCatchUp.active}));
    assert(s.p===1 && s.r===3 && s.d===0 && s.active===true, 'catch-up must begin with oldest retained round after table round completes');

    for (const round of [3,4,5]) {
      const pos=await page.evaluate(() => ({p:state.currentPlayer,r:state.currentRound,d:state.currentDart}));
      assert(pos.p===1 && pos.r===round && pos.d===0, 'unexpected catch-up position '+JSON.stringify(pos));
      await page.evaluate(() => {
        recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'});
      });
    }
    s=await page.evaluate(() => {
      const job=state.__sqCatchUp.jobs.find(j=>j.kind==='absence'&&j.playerIndex===1);
      return {p:state.currentPlayer,r:state.currentRound,active:!!state.__sqCatchUp.active,completed:!!job.completed};
    });
    assert(s.p===0 && s.r===6 && s.active===false && s.completed===true, 'normal play must resume at next live round after catch-up');

    // Resume persistence: an unreturned absence must survive refresh and Resume Game.
    await reset(4,1,3);
    assert(await page.evaluate(() => window.__sqSkipAbsentVisit())===true, 'persistence setup skip should succeed');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForTimeout(2200);
    assert(await page.isVisible('#resumeBtn'), 'Resume Game should remain available after absence skip refresh');
    await page.click('#resumeBtn');
    await page.waitForFunction(() => document.body.dataset.page === 'game', {timeout:15000});
    await page.waitForTimeout(500);
    s=await page.evaluate(() => {
      const job=state.__sqCatchUp?.jobs?.find(j=>j.kind==='absence'&&!j.completed);
      return {p:state.currentPlayer,r:state.currentRound,pending:job?.pendingRounds||[],absent:window.__sqAbsentPlayers()};
    });
    assert(s.p===2 && s.r===4 && s.pending.join(',')==='4' && s.absent.length===1, 'absence queue/cursor must survive refresh→Resume');

    // Mid-visit skip is NOT an absence: ordinary skip-remaining-darts semantics stay intact.
    await reset(6,0,2);
    await page.evaluate(() => recordThrow({kind:'S'}));
    const noAbsence = await page.evaluate(() => window.__sqSkipAbsentVisit());
    assert(noAbsence===false, 'mid-visit Skip Go must not create an absence');
    await page.evaluate(() => missGo());
    s=await page.evaluate(() => ({
      row:JSON.parse(JSON.stringify(state.score[0][6])),
      abs:(state.__sqCatchUp?.jobs||[]).filter(j=>j.kind==='absence').length
    }));
    assert(s.row.darts[0]?.kind==='S' && s.row.darts[1]?.kind==='Miss' && s.row.darts[2]?.kind==='Miss', 'mid-visit skip must retain normal miss semantics');
    assert(s.abs===0, 'mid-visit skip must not create an absence job');

    // Tournament / non-Match-Play remains isolated.
    await reset(2,0,2);
    const isolated = await page.evaluate(() => {
      state.match.tournamentType='knockout';
      const before=JSON.stringify(state.__sqCatchUp||null);
      const handled=window.__sqSkipAbsentVisit();
      return {handled,before,after:JSON.stringify(state.__sqCatchUp||null)};
    });
    assert(isolated.handled===false && isolated.before===isolated.after, 'Tournament must remain isolated from absence Skip Go');

    // Final-round edge: game waits for an absent player, then completes after returned catch-up.
    await reset(13,1,2);
    assert(await page.evaluate(() => window.__sqSkipAbsentVisit())===true, 'final-round absence skip should be handled');
    s=await page.evaluate(() => ({finished:state.finished,awaiting:!!state.__sqCatchUp?.awaitingReturn,p:state.currentPlayer,r:state.currentRound}));
    assert(s.finished===false && s.awaiting===true && s.p===1 && s.r===13, 'game must wait rather than falsely complete with an unresolved absence');
    assert(await page.evaluate(() => window.__sqMarkPlayerReturned(1))===true, 'final-round player return should be accepted');
    s=await page.evaluate(() => ({active:!!state.__sqCatchUp?.active,p:state.currentPlayer,r:state.currentRound}));
    assert(s.active===true && s.p===1 && s.r===13, 'final-round catch-up should start immediately from waiting state');
    await page.evaluate(() => {
      recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'});
    });
    assert(await page.evaluate(() => state.finished===true), 'game should finish only after final returned catch-up completes');

    console.log('SC-036 SKIP GO: PASS');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error('SC-036 SKIP GO: FAIL');
  console.error(err && err.stack || err);
  process.exit(1);
});
