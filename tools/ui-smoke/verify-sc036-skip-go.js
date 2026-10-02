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
      typeof window.__sqResumeAbsenceOnScoreInput === 'function' &&
      typeof window.__sqEnsureFinalBullReturnTimer === 'function' &&
      typeof window.__sqFinalBullReturnTimerActive === 'function' &&
      typeof window.__sqExpireFinalBullReturnTimer === 'function'
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
        delete state.__sqFinalBullCutoffs;
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

    const skipMark = await page.evaluate(() => {
      const sub=document.querySelector('#cell-sub-1-2');
      const cs=sub?getComputedStyle(sub):null;
      return {
        text:String(sub?.textContent||'').trim(),
        marked:!!sub?.classList.contains('sq-skip-cell-mark'),
        color:cs?.color||'',
        animation:cs?.animationName||''
      };
    });
    assert(skipMark.text==='»»»' && skipMark.marked, 'skipped round must show three fast-forward chevrons instead of zero');
    assert(/rgb\(255,\s*106,\s*0\)/i.test(skipMark.color), 'skipped-round marker must use Shateki orange');
    assert(skipMark.animation && skipMark.animation!=='none', 'skipped-round marker must have a subtle pulse animation');

    const liveSkipMark = await page.evaluate(() => {
      const el=document.querySelector('#v2Rows .v2Cell[data-p="1"][data-round="2"] .sq-skip-cell-mark');
      const cell=document.querySelector('#v2Rows .v2Cell[data-p="1"][data-round="2"]');
      const cs=el?getComputedStyle(el):null;
      return {
        text:String(el?.textContent||'').trim(),
        cellText:String(cell?.textContent||'').trim(),
        color:cs?.color||'',
        animation:cs?.animationName||''
      };
    });
    assert(liveSkipMark.text==='»»»', 'visible Live V2 skipped cell must replace displayed zero with three fast-forward chevrons');
    assert(!/^0(?:\s|$)/.test(liveSkipMark.cellText), 'visible Live V2 skipped cell must not display zero as its score');
    assert(/rgb\(255,\s*106,\s*0\)/i.test(liveSkipMark.color), 'visible Live V2 skipped marker must use Shateki orange');
    assert(liveSkipMark.animation && liveSkipMark.animation!=='none', 'visible Live V2 skipped marker must pulse subtly');

    // Game Menu must NOT expose the retired manual return path.
    await page.evaluate(() => window.__sqOpenGameMenu106());
    await page.waitForTimeout(100);
    const menuText = await page.locator('.sq-menu106-modal').last().innerText().catch(()=> '');
    assert(!/PLAYER RETURNED/i.test(menuText), 'Game Menu must not expose retired Player Returned control');
    await page.keyboard.press('Escape').catch(()=>{});

    // Finish GAMMA round 2, then ALPHA round 3. BETA reaches their next scheduled turn.
    await page.evaluate(() => {
      recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'});
    });
    await page.evaluate(() => {
      if(state.currentPlayer!==0 || state.currentRound!==3) throw new Error('expected ALPHA round 3');
      recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'});
    });
    s = await page.evaluate(() => ({p:state.currentPlayer,r:state.currentRound,d:state.currentDart,active:!!state.__sqCatchUp?.active}));
    assert(s.p===1 && s.r===3 && s.d===0 && s.active===false, 'skipped player should simply reach their next scheduled turn');

    // Before any score input, presentation must already show the oldest recoverable
    // missed round as the orange target while keeping the table viewport/live row
    // on the scheduled round.
    await page.waitForFunction(() =>
      Number(document.querySelector('#v2Rows .v2Badge.active')?.dataset?.round)===2 &&
      Number(document.querySelector('#v2Rows .v2Cell.active[data-p="1"]')?.dataset?.round)===2
    );
    const previewFocus = await page.evaluate(() => {
      const wrap=document.querySelector('#liveV2Panel .v2RowsWrap');
      const activeBadge=document.querySelector('#v2Rows .v2Badge.active');
      const liveBadge=document.querySelector('#v2Rows .v2Badge.liveRow');
      const activeCell=document.querySelector('#v2Rows .v2Cell.active[data-p="1"]');
      const scheduledCell=document.querySelector('#v2Rows .v2Cell.liveRow[data-p="1"]');
      return {
        activeBadgeRound:Number(activeBadge?.dataset?.round),
        liveBadgeRound:Number(liveBadge?.dataset?.round),
        activeCellRound:Number(activeCell?.dataset?.round),
        scheduledCellRound:Number(scheduledCell?.dataset?.round),
        activeText:String(activeCell?.textContent||'').trim(),
        scrollTop:Number(wrap?.scrollTop||0)
      };
    });
    assert(previewFocus.activeBadgeRound===2 && previewFocus.activeCellRound===2, 'returning player orange focus must preview the oldest skipped round before scoring');
    assert(previewFocus.liveBadgeRound===3 && previewFocus.scheduledCellRound===3, 'table live row must stay on the scheduled round while catch-up is previewed');
    assert(/»»»/.test(previewFocus.activeText), 'orange catch-up focus must sit on the skipped chevron cell');

    // First scoring input automatically resumes from the oldest retained missed round.
    await page.evaluate(() => recordThrow({kind:'Miss'}));
    await page.waitForTimeout(140);
    s = await page.evaluate(() => {
      const job=state.__sqCatchUp.jobs.find(j=>j.kind==='absence'&&!j.completed&&j.playerIndex===1);
      const wrap=document.querySelector('#liveV2Panel .v2RowsWrap');
      const activeBadge=document.querySelector('#v2Rows .v2Badge.active');
      const liveBadge=document.querySelector('#v2Rows .v2Badge.liveRow');
      const activeCell=document.querySelector('#v2Rows .v2Cell.active[data-p="1"]');
      return {
        p:state.currentPlayer,r:state.currentRound,d:state.currentDart,active:!!state.__sqCatchUp.active,returned:!!job?.returned,pending:job?.pendingRounds?.slice()||[],
        activeBadgeRound:Number(activeBadge?.dataset?.round),
        liveBadgeRound:Number(liveBadge?.dataset?.round),
        activeCellRound:Number(activeCell?.dataset?.round),
        scrollTop:Number(wrap?.scrollTop||0)
      };
    });
    assert(s.p===1 && s.r===2 && s.d===1 && s.active===true && s.returned===true, 'first score input must auto-resume BETA at oldest missed round');
    assert(s.pending.join(',')==='2', 'single skipped round should remain the active catch-up round until completed');
    assert(s.activeBadgeRound===2 && s.activeCellRound===2 && s.liveBadgeRound===3, 'active orange edge must stay on catch-up round while live table row remains scheduled round');
    assert(Math.abs(s.scrollTop-previewFocus.scrollTop)<=4, 'starting catch-up must not move the score viewport backwards');
    const resumedCellText = await page.evaluate(() => String(document.querySelector('#v2Rows .v2Cell.active[data-p="1"][data-round="2"]')?.textContent||'').trim());
    assert(!/»»»/.test(resumedCellText), 'once catch-up scoring starts, the active cell must show the live score rather than retain the pending arrows');

    await page.evaluate(() => { recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); });
    s = await page.evaluate(() => ({p:state.currentPlayer,r:state.currentRound,d:state.currentDart,active:!!state.__sqCatchUp.active}));
    assert(s.p===1 && s.r===3 && s.d===0 && s.active===false, 'after catch-up, player must resume the scheduled turn that triggered return');

    // Build a four-round absence backlog. Only the latest three remain recoverable.
    await reset(2,1,3);
    async function finishPlayer(expectedPlayer, round) {
      await page.evaluate(({expectedPlayer,round}) => {
        if(state.currentPlayer!==expectedPlayer || state.currentRound!==round) throw new Error('unexpected cursor '+state.currentPlayer+'/'+state.currentRound);
        recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'});
      }, {expectedPlayer,round});
    }
    assert(await page.evaluate(() => window.__sqSkipAbsentVisit())===true, 'round 2 absence skip should succeed');
    await finishPlayer(2,2);
    for (const round of [3,4]) {
      await finishPlayer(0,round);
      assert(await page.evaluate(() => window.__sqSkipAbsentVisit())===true, 'absence skip round '+round+' should succeed');
      await finishPlayer(2,round);
    }
    await finishPlayer(0,5);
    assert(await page.evaluate(() => window.__sqSkipAbsentVisit())===true, 'fourth absence skip should succeed');

    s = await page.evaluate(() => {
      const job=state.__sqCatchUp.jobs.find(j=>j.kind==='absence'&&!j.completed&&j.playerIndex===1);
      return {
        pending:job.pendingRounds.slice(),
        scratched:job.scratchedRounds.slice(),
        r2:JSON.parse(JSON.stringify(state.score[1][2]))
      };
    });
    assert(s.pending.join(',')==='3,4,5', 'only the most recent three skipped rounds stay recoverable');
    assert(s.scratched.join(',')==='2', 'oldest skipped round must be scratched after backlog exceeds three');
    assert(s.r2.darts.every(d=>d && d.kind==='Scratch' && d.points===0), 'oldest scratched round must materialise as zero');

    await page.waitForFunction(() => document.querySelector('#v2Rows .v2Cell[data-p="1"][data-round="2"]')?.textContent.trim()==='X');
    const cappedMarkers = await page.evaluate(() => {
      const text=(r)=>String(document.querySelector(`#v2Rows .v2Cell[data-p="1"][data-round="${r}"]`)?.textContent||'').trim();
      return {r2:text(2),r3:text(3),r4:text(4),r5:text(5)};
    });
    assert(cappedMarkers.r2==='X', 'skipped rounds older than the recoverable latest three must display X: '+JSON.stringify(cappedMarkers));
    assert(/»»»/.test(cappedMarkers.r3) && /»»»/.test(cappedMarkers.r4) && /»»»/.test(cappedMarkers.r5), 'latest three recoverable skipped rounds must retain fast-forward markers');

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
    assert(s.p===1 && s.r===5 && s.d===0, 'Undo must restore skipped player/round cursor');
    assert(s.pending.join(',')==='2,3,4' && s.scratched.length===0, 'Undo must restore absence queue exactly');
    assert(s.r2.darts.every(d=>d===null), 'Undo must restore pre-scratch board state');

    assert(await page.evaluate(() => window.__sqSkipAbsentVisit())===true, 'reapplied absence skip should succeed');
    await finishPlayer(2,5);
    await finishPlayer(0,6);
    s=await page.evaluate(() => ({p:state.currentPlayer,r:state.currentRound,d:state.currentDart}));
    assert(s.p===1 && s.r===6 && s.d===0, 'BETA should reach scheduled round 6 before automatic catch-up');

    // First score at round 6 rewinds to round 3, then 4, then 5, and finally returns to round 6.
    await page.evaluate(() => recordThrow({kind:'Miss'}));
    s=await page.evaluate(() => ({p:state.currentPlayer,r:state.currentRound,d:state.currentDart,active:!!state.__sqCatchUp.active}));
    assert(s.p===1 && s.r===3 && s.d===1 && s.active===true, 'automatic resume must rewind to oldest of latest-three missed rounds');

    await page.evaluate(() => { recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); });
    for (const round of [4,5]) {
      const pos=await page.evaluate(() => ({p:state.currentPlayer,r:state.currentRound,d:state.currentDart}));
      assert(pos.p===1 && pos.r===round && pos.d===0, 'unexpected catch-up position '+JSON.stringify(pos));
      await page.evaluate(() => { recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); });
    }
    s=await page.evaluate(() => {
      const job=state.__sqCatchUp.jobs.find(j=>j.kind==='absence'&&j.playerIndex===1);
      return {p:state.currentPlayer,r:state.currentRound,d:state.currentDart,active:!!state.__sqCatchUp.active,completed:!!job.completed};
    });
    assert(s.p===1 && s.r===6 && s.d===0 && s.active===false && s.completed===true, 'after max-three catch-up, player must resume scheduled round 6');

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

    // Game Rules §§9.8–9.11: retained catch-up at the scheduled Bull visit
    // starts a 30s return gate. Skip cannot bypass it; first Bull dart clears it.
    await reset(13,1,2);
    await page.evaluate(() => {
      state.score[1][0]={roundTotal:10,darts:[{kind:'S',points:10},null,null]};
      state.__sqCatchUp={
        version:1,
        active:false,
        jobs:[{
          kind:'absence',
          playerIndex:1,
          playerKey:'p1',
          joinedRound:10,
          pendingRounds:[10,11,12],
          scratchedRounds:[],
          returned:false,
          absent:true,
          completed:false
        }]
      };
      window.__sqSc036DmdTimerFrames=[];
      const original=window.sqDmdShowZones;
      if(!window.__sqSc036DmdOriginal) window.__sqSc036DmdOriginal=original;
      window.sqDmdShowZones=(zones,opts)=>{
        try{ window.__sqSc036DmdTimerFrames.push({zones:JSON.parse(JSON.stringify(zones||{})),opts:JSON.parse(JSON.stringify(opts||{}))}); }catch(_){}
        return window.__sqSc036DmdOriginal?.(zones,opts);
      };
      save();
      updateUI();
      window.__sqEnsureFinalBullReturnTimer();
    });
    await page.waitForTimeout(120);
    s=await page.evaluate(() => {
      const job=state.__sqCatchUp.jobs[0];
      return {
        active:window.__sqFinalBullReturnTimerActive(1),
        remaining:Number(job.bullReturnDeadlineAt||0)-Date.now(),
        frames:(window.__sqSc036DmdTimerFrames||[]).slice(),
        pending:job.pendingRounds.slice(),scratched:job.scratchedRounds.slice(),
        rows:[10,11,12].map(r=>state.score[1][r])
      };
    });
    assert(s.active===true && s.remaining>28500 && s.remaining<=30000, 'scheduled Bull with retained catch-up must start a persisted 30-second return timer');
    assert(!s.pending.length && s.scratched.join(',')==='10,11,12' && s.rows.every(row=>row.roundTotal===0 && row.darts.every(d=>d.kind==='Scratch')), 'v11 scratches missed rounds immediately at scheduled Bull');
    assert(s.frames.some(f=>/BULL RETURN/i.test(String(f.zones?.z1||'')) && /BETA/i.test(String(f.zones?.z2||'')) && /SECONDS/i.test(String(f.zones?.z3||''))), 'DMD must show affected player and Bull return countdown');

    const blockedSkip=await page.evaluate(() => {
      const before={p:state.currentPlayer,r:state.currentRound,d:state.currentDart,h:state.history.length};
      const handled=window.__sqSkipAbsentVisit();
      return {handled,before,after:{p:state.currentPlayer,r:state.currentRound,d:state.currentDart,h:state.history.length}};
    });
    assert(blockedSkip.handled===true && JSON.stringify(blockedSkip.before)===JSON.stringify(blockedSkip.after), 'Skip Go must not bypass the active final-Bull return timer');
    const originalDeadline=await page.evaluate(()=>state.__sqCatchUp.jobs[0].bullReturnDeadlineAt);
    await page.evaluate(()=>save());
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForSelector('#resumeBtn',{state:'visible'});
    await page.click('#resumeBtn');
    await page.waitForFunction(()=>document.body.dataset.page==='game');
    assert(await page.evaluate(deadline=>state.__sqCatchUp.jobs[0].bullReturnDeadlineAt===deadline && !state.__sqCatchUp.jobs[0].pendingRounds.length,originalDeadline), 'refresh preserves the existing Bull deadline and permanent scratches');

    await page.evaluate(() => recordThrow({kind:'Miss'}));
    s=await page.evaluate(() => {
      const job=state.__sqCatchUp.jobs[0];
      return {d:state.currentDart,deadline:job.bullReturnDeadlineAt,first:job.bullReturnFirstDartAt,returned:job.returned,avg:__sqV2LiveAveragePair(1,13)};
    });
    assert(s.d===1 && !s.deadline && Number.isFinite(Number(s.first)) && s.returned===true, 'first Bull dart must stop the return timer and continue the Bull visit');
    assert(s.avg.darts===2 && s.avg.game===15 && s.avg.mtc===15, 'scratched missed visits must not count as thrown darts in GAV/MAV');
    await page.evaluate(()=>undo());
    assert(await page.evaluate(()=>state.currentRound===13 && state.currentDart===0 && !state.__sqCatchUp.jobs[0].pendingRounds.length && state.score[1][10].darts.every(d=>d.kind==='Scratch') && window.__sqFinalBullReturnTimerActive(1)), 'Undo of the first Bull dart restores only Bull and its return gate');
    await page.evaluate(()=>recordThrow({kind:'Miss'}));
    await page.evaluate(()=>save());
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForSelector('#resumeBtn',{state:'visible'});
    await page.click('#resumeBtn');
    await page.waitForFunction(()=>document.body.dataset.page==='game' && state.currentDart===1);
    assert(await page.evaluate(()=>state.currentRound===13 && !state.__sqCatchUp.jobs[0].pendingRounds.length && state.score[1][10].darts.every(d=>d.kind==='Scratch')), 'Bull-only state and permanent scratches survive refresh');

    // v11 regression: completing Bull can never restore earlier missed rounds.
    await page.evaluate(() => { recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); });
    s=await page.evaluate(() => {
      const job=state.__sqCatchUp.jobs[0];
      return {p:state.currentPlayer,r:state.currentRound,d:state.currentDart,active:!!state.__sqCatchUp.active,finished:!!state.finished,pending:job.pendingRounds.slice(),returned:job.returned};
    });
    assert(s.r===13 && s.active===false && s.finished===true && !s.pending.length, 'table Bull completion must finish without a pre-Bull rewind');
    s=await page.evaluate(() => ({
      finished:!!state.finished,
      active:!!state.__sqCatchUp?.active,
      bull:JSON.parse(JSON.stringify(state.score[1][13])),
      job:JSON.parse(JSON.stringify(state.__sqCatchUp.jobs[0]))
    }));
    assert(s.finished===true && s.active===false && !s.job.pendingRounds.length, 'no catch-up remains after Bull');
    assert(s.bull.darts.every(d=>d && d.kind==='Miss'), 'completed Bull visit must remain intact');

    // Expiry scratches every retained catch-up round plus the complete Bull visit to zero.
    await reset(13,1,2);
    const expiredEnforced = await page.evaluate(() => {
      state.__sqCatchUp={
        version:1,
        active:false,
        jobs:[{
          kind:'absence',
          playerIndex:1,
          playerKey:'p1',
          joinedRound:10,
          pendingRounds:[10,11,12],
          scratchedRounds:[],
          returned:false,
          absent:true,
          completed:false
        }]
      };
      save();
      updateUI();
      window.__sqEnsureFinalBullReturnTimer();
      const expired = Date.now()-1;
      state.__sqCatchUp.jobs[0].bullReturnDeadlineAt = expired;
      // Set and enforce the synthetic expired deadline atomically so the
      // production 250ms watchdog cannot legitimately win the test race.
      return window.__sqExpireFinalBullReturnTimer(1, expired);
    });
    assert(expiredEnforced===true, 'expired final-Bull return timer must enforce timeout');
    s=await page.evaluate(() => {
      const job=state.__sqCatchUp.jobs[0];
      return {
        finished:state.finished,
        pending:job.pendingRounds.slice(),
        scratched:job.scratchedRounds.slice(),
        completed:job.completed,
        timedOut:job.bullTimedOut,
        rows:[10,11,12,13].map(r=>JSON.parse(JSON.stringify(state.score[1][r]))),
        hist:state.history[state.history.length-1]
      };
    });
    assert(s.finished===true && s.completed===true && s.timedOut===true && s.pending.length===0, 'timeout must close catch-up and allow the game to complete');
    assert(s.scratched.join(',')==='10,11,12,13', 'timeout must scratch retained rounds and Bull');
    assert(s.rows.every(row=>row.roundTotal===0 && row.darts.every(d=>d && d.kind==='Scratch' && d.points===0)), 'timeout scratches must be materialised as zero rows');
    assert(s.hist?.type==='absenceBullTimeout', 'final-Bull timeout must be an explicit undoable history event');

    await page.evaluate(() => {
      document.querySelectorAll('.sq-gamecomplete-backdrop').forEach(n=>n.remove());
      undo();
    });
    s=await page.evaluate(() => {
      const job=state.__sqCatchUp.jobs[0];
      return {
        finished:state.finished,p:state.currentPlayer,r:state.currentRound,d:state.currentDart,
        pending:job.pendingRounds.slice(),scratched:job.scratchedRounds.slice(),
        deadline:Number(job.bullReturnDeadlineAt||0)-Date.now()
      };
    });
    assert(s.finished===false && s.p===1 && s.r===13 && s.d===0, 'Undo must restore the timed Bull cursor');
    assert(!s.pending.length && s.scratched.join(',')==='10,11,12' && s.deadline>28500, 'Undo may restore Bull but cannot recover permanently scratched missed rounds');

    // Final-round edge: a skipped Bull remains unscored until the player presses a score button again.
    await reset(13,1,2);
    assert(await page.evaluate(() => window.__sqSkipAbsentVisit())===true, 'final-round absence skip should be handled');
    s=await page.evaluate(() => ({finished:state.finished,awaiting:!!state.__sqCatchUp?.awaitingReturn,p:state.currentPlayer,r:state.currentRound}));
    assert(s.finished===false && s.awaiting===true && s.p===1 && s.r===13, 'game must wait with Bull score untouched');
    await page.evaluate(() => recordThrow({kind:'Miss'}));
    s=await page.evaluate(() => ({active:!!state.__sqCatchUp?.active,p:state.currentPlayer,r:state.currentRound,d:state.currentDart}));
    assert(s.active===true && s.p===1 && s.r===13 && s.d===1, 'first Bull score input must implicitly resume the skipped Bull');
    await page.evaluate(() => { recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); });
    assert(await page.evaluate(() => state.finished===true), 'game should finish after the resumed Bull visit completes');

    // First Bull Bounce Out is a real zero-point dart, including for a player
    // whose outstanding job originated with late entry. All supported lineup
    // sizes must stop the timer and Undo must restore Bull without old targets.
    for(const players of [2,3,4,5]){
      for(const kind of ['absence','lateJoin']){
        await reset(13,1,players);
        await page.evaluate(kind=>{
          state.__sqCatchUp={version:1,active:false,jobs:[{
            kind,playerIndex:1,playerKey:'p1',joinedRound:6,
            pendingRounds:[3,4,5],scratchedRounds:[],
            returned:false,absent:kind==='absence',completed:false
          }]};
          window.__sqEnsureFinalBullReturnTimer();
        },kind);
        assert(await page.evaluate(()=>window.__sqFinalBullReturnTimerActive(1) &&
          !state.__sqCatchUp.jobs[0].pendingRounds.length &&
          [3,4,5].every(r=>state.score[1][r].darts.every(d=>d?.kind==='Scratch'))
        ), `${players}-player ${kind} reaches Bull with earlier visits permanently scratched`);
        await page.evaluate(()=>recordThrow({kind:'BounceOut'}));
        assert(await page.evaluate(()=>state.currentRound===13 && state.currentDart===1 &&
          state.score[1][13].darts[0]?.bounceOut===true &&
          !state.__sqCatchUp.jobs[0].bullReturnDeadlineAt &&
          !state.__sqCatchUp.active && __sqV2LiveAveragePair(1,13).darts===1
        ), `${players}-player ${kind} first Bull Bounce Out stops the timer and counts exactly one thrown dart`);
        await page.evaluate(()=>undo());
        assert(await page.evaluate(()=>state.currentRound===13 && state.currentDart===0 &&
          window.__sqFinalBullReturnTimerActive(1) &&
          !state.__sqCatchUp.jobs[0].pendingRounds.length &&
          [3,4,5].every(r=>state.score[1][r].darts.every(d=>d?.kind==='Scratch'))
        ), `${players}-player ${kind} Bounce Out Undo re-arms Bull without recovering old visits`);
      }
    }

    // The cutoff belongs to each player's scheduled visit, not the table's first Bull dart.
    await reset(13,0,3);
    await page.evaluate(()=>{
      state.__sqCatchUp={version:1,active:false,jobs:[{kind:'absence',playerIndex:1,playerKey:'p1',joinedRound:10,pendingRounds:[10,11,12],scratchedRounds:[],returned:false,absent:true,completed:false}]};
      window.__sqEnsureFinalBullReturnTimer();
    });
    assert(await page.evaluate(()=>state.__sqCatchUp.jobs[0].pendingRounds.length===3 && !state.__sqCatchUp.jobs[0].bullReturnDeadlineAt), 'another player beginning Bull cannot scratch a future thrower early');
    await page.evaluate(()=>{recordThrow({kind:'Miss'});recordThrow({kind:'Miss'});recordThrow({kind:'Miss'});});
    assert(await page.evaluate(()=>state.currentPlayer===1 && state.currentRound===13 && !state.__sqCatchUp.jobs[0].pendingRounds.length && window.__sqFinalBullReturnTimerActive(1)), 'the affected player becoming active immediately scratches the backlog and starts the timer');
    await page.evaluate(()=>{recordThrow({kind:'Miss'});recordThrow({kind:'Miss'});recordThrow({kind:'Miss'});});
    assert(await page.evaluate(()=>state.currentPlayer===2 && state.currentRound===13 && !state.__sqCatchUp.active), 'Bull continues to the next real thrower without a rewind');

    await reset(12,1,3);
    await page.evaluate(()=>{
      window.__sqSkipAbsentVisit();
      state.currentRound=13;state.currentPlayer=1;state.currentDart=0;
      window.__sqEnsureFinalBullReturnTimer();
    });
    const permanent=await page.evaluate(()=>JSON.stringify({round:state.currentRound,player:state.currentPlayer,score:state.score,history:state.history}));
    await page.evaluate(()=>undo());
    assert(await page.evaluate(before=>JSON.stringify({round:state.currentRound,player:state.currentPlayer,score:state.score,history:state.history})===before,permanent), 'Undo cannot reopen an absence Skip event permanently closed at Bull');
    await page.evaluate(()=>startNewGame(true));
    assert(await page.evaluate(()=>!state.__sqFinalBullCutoffs && !state.__sqCatchUp && state.currentRound===0), 'new game clears previous-game Bull cutoffs');

    console.log('SC-036 SKIP GO: PASS');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error('SC-036 SKIP GO: FAIL');
  console.error(err && err.stack || err);
  process.exit(1);
});
