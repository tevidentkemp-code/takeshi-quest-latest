const H = require('./harness');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  const { browser, page } = await H.launch();
  try {
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page, ['ALPHA', 'BETA', 'CAP THREE', 'CAP FOUR', 'CAP FIVE']);
    const setupCap = await page.evaluate(() => {
      const before=__msPlayers.length;
      __msAddGuest();
      return {before,count:__msPlayers.length,guestDisabled:msAddGuestBtn.disabled,savedDisabled:msAddRegisteredBtn.disabled,copy:document.getElementById('msRosterCount').textContent};
    });
    assert(setupCap.before===5 && setupCap.count===5 && setupCap.guestDisabled && setupCap.savedDisabled, 'new guest/saved setup must stop at five');
    assert(/5 \/ 5/.test(setupCap.copy), 'setup must communicate the five-player cap');
    const staleSetup = await page.evaluate(() => {
      __msPlayers.push({name:'STALE SIXTH',type:'guest'});
      __msUpdateStartEnabled();
      const disabled=document.getElementById('startMatchBtn').disabled;
      const before=JSON.stringify(state.players);
      document.getElementById('mlStartBtn').dispatchEvent(new MouseEvent('click',{bubbles:true}));
      const unchanged=before===JSON.stringify(state.players);
      __msPlayers.splice(2);
      __msRenderPlayers();
      return {disabled,unchanged};
    });
    assert(staleSetup.disabled && staleSetup.unchanged, 'a stale six-player setup cannot enter throw order through either start action');
    await H.startMatch(page, 3);

    await page.waitForFunction(() =>
      typeof window.__sqAppendLatePlayer === 'function' &&
      typeof window.__sqLateJoinEligibility === 'function'
    );

    // Production UI contract: Guest Player must remain usable immediately even
    // while the cloud-backed registered-player list is still loading. Long
    // registered-player lists must then scroll above the fixed throwpad, and
    // selection must ask for confirmation before mutation.
    await page.evaluate(() => {
      window.__sc034OrigCloudListPlayers = window.cloudListPlayers;
      window.__sc034CloudResolve = null;
      window.cloudListPlayers = () => new Promise(resolve => {
        window.__sc034CloudResolve = resolve;
      });
      window.__sqOpenGameMenu106();
    });
    const gameMenuAdd = page.locator('.sq-menu106-row').filter({hasText:'Add Player'}).first();
    await gameMenuAdd.waitFor({state:'visible'});
    await gameMenuAdd.click();
    await page.waitForFunction(() =>
      /ADD PLAYER/i.test(document.querySelector('.sq-menu106-title')?.textContent||'') &&
      typeof window.__sc034CloudResolve === 'function'
    );

    const immediateUi = await page.evaluate(() => {
      const body=document.querySelector('.sq-menu106-body');
      const first=body?.querySelector('.sq-menu106-row');
      const loading=body?.querySelector('.sq-add-player-loading');
      const br=body?.getBoundingClientRect();
      const rr=first?.getBoundingClientRect();
      return {
        firstText:String(first?.textContent||''),
        loading:String(loading?.textContent||''),
        guestVisible:!!br && !!rr && rr.top>=br.top-1 && rr.bottom<=br.bottom+1
      };
    });
    assert(/GUEST PLAYER/i.test(immediateUi.firstText), 'Guest Player must render before cloud player discovery finishes');
    assert(/LOADING REGISTERED PLAYERS/i.test(immediateUi.loading), 'Add Player must show an honest registered-player loading state');
    assert(immediateUi.guestVisible, 'Guest Player must be immediately visible inside the Add Player viewport');

    await page.evaluate(() => {
      window.__sc034CloudResolve(Array.from({length:24},(_,i)=>({
        id:'ui-'+i,
        name:'UI PLAYER '+String(i+1).padStart(2,'0')
      })));
    });
    await page.waitForFunction(() => document.querySelectorAll('.sq-menu106-row').length >= 25);
    // Subsequent reopen after a cancelled confirmation should not be left
    // waiting on another synthetic cloud promise.
    await page.evaluate(() => {
      window.cloudListPlayers = async () => Array.from({length:24},(_,i)=>({
        id:'ui-'+i,
        name:'UI PLAYER '+String(i+1).padStart(2,'0')
      }));
    });

    const addUi = await page.evaluate(() => {
      const modal=document.querySelector('.sq-menu106-modal');
      const body=modal?.querySelector('.sq-menu106-body');
      const pad=document.querySelector('.pad-bar');
      const cs=body?getComputedStyle(body):null;
      const bd=document.querySelector('.sq-menu106-bd');
      return {
        scrollable:!!body && body.scrollHeight>body.clientHeight && ['auto','scroll'].includes(cs?.overflowY),
        modalBottom:modal?.getBoundingClientRect().bottom||0,
        viewport:window.innerHeight,
        modalZ:Number(getComputedStyle(bd).zIndex||0),
        padZ:pad?Number(getComputedStyle(pad).zIndex||0):0,
        players:state.players.length
      };
    });
    assert(addUi.scrollable, 'Add Player list must be vertically scrollable');
    assert(addUi.modalBottom <= addUi.viewport + 1, 'Add Player modal must remain inside the viewport');
    assert(addUi.modalZ > addUi.padZ, 'Add Player modal must sit above the fixed throwpad');

    await page.locator('.sq-menu106-row').filter({hasText:'UI PLAYER 01'}).first().click();
    await page.waitForSelector('.sq-confirm-bd .sq-endmatch-no', {state:'visible'});
    const confirmUi = await page.evaluate(() => ({
      message:String(document.querySelector('.sq-confirm-bd .modal-body')?.textContent||''),
      players:state.players.length,
      addListStillOpen:!!document.querySelector('.sq-menu106-bd')
    }));
    assert(/ARE YOU SURE YOU WANT TO ADD UI PLAYER 01\?/i.test(confirmUi.message), 'registered player selection must show explicit confirmation');
    assert(confirmUi.players===2, 'registered player must not be added before confirmation');
    assert(confirmUi.addListStillOpen===false, 'Add Player list must close before confirmation so touch is not trapped by stacked modals');

    await page.locator('.sq-confirm-bd .sq-endmatch-no').click();
    await page.waitForFunction(() => document.querySelectorAll('.sq-menu106-row').length >= 20);
    assert(await page.isVisible('.sq-menu106-modal'), 'cancelling Add Player confirmation must return to the player list');

    await page.evaluate(() => {
      document.querySelectorAll('.sq-menu106-bd').forEach(n=>n.remove());
      window.cloudListPlayers=window.__sc034OrigCloudListPlayers;
      delete window.__sc034OrigCloudListPlayers;
      delete window.__sc034CloudResolve;
    });

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

    // Turbo begins at 17s. Before the first 17s dart a late player may join,
    // but Classic rounds 10-16 never existed and must not become catch-up work.
    await page.evaluate(() => {
      const mk = () => Array.from({length:14}, () => ({darts:[null,null,null],roundTotal:0}));
      state.players = [
        {id:'ta',name:'TURBO A',initials:'TA'},
        {id:'tb',name:'TURBO B',initials:'TB'}
      ];
      state.score = [mk(),mk()];
      state.match = {
        mode:'turbo', gameMode:'turbo', gameVariant:'turbo',
        gameFormat:'match_play', gameNumber:1, wins:[0,0], history:[]
      };
      state.gameMode='turbo';
      state.matchAgg={hits:[{},{}],totals60:[0,0],totals100:[0,0],totals140:[0,0]};
      state.currentRound=7; state.currentPlayer=0; state.currentDart=0;
      state.history=[]; state.finished=false; delete state.__sqCatchUp;
    });
    const turboAdded = await page.evaluate(() =>
      window.__sqAppendLatePlayer({id:'tc',name:'TURBO C',initials:'TC'}, 'registered')
    );
    assert(turboAdded === true, 'Turbo late player should be addable before first 17s dart');
    const turboState = await page.evaluate(() => ({
      players:state.players.map(p=>p.name),
      job:JSON.parse(JSON.stringify(state.__sqCatchUp?.jobs?.[0]||null))
    }));
    assert(turboState.players.join('|') === 'TURBO A|TURBO B|TURBO C', 'Turbo late player must be final thrower');
    assert(turboState.job && turboState.job.pendingRounds.length === 0, 'Turbo must not invent Classic catch-up rounds');
    assert(turboState.job && turboState.job.scratchedRounds.length === 0, 'Turbo must not invent Classic scratched rounds');
    await page.evaluate(() => { delete state.gameMode; });

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

    // New late entry stops at five; existing six-player state is preserved below.
    const cap = await page.evaluate(() => {
      const mk = () => Array.from({length:14}, () => ({darts:[null,null,null],roundTotal:0}));
      state.players = Array.from({length:5},(_,i)=>({name:'P'+(i+1),type:'guest'}));
      state.score = state.players.map(()=>mk());
      state.match.wins = Array(5).fill(0);
      state.matchAgg = {hits:Array(5).fill(null).map(()=>({})),totals60:Array(5).fill(0),totals100:Array(5).fill(0),totals140:Array(5).fill(0)};
      state.currentRound=0; state.currentPlayer=0; state.currentDart=0; state.history=[]; state.finished=false;
      delete state.__sqCatchUp;
      const gate=window.__sqLateJoinEligibility();
      const added=window.__sqAppendLatePlayer({name:'P6'},'guest');
      return {gate,added,count:state.players.length};
    });
    assert(cap.gate.ok === false && cap.added === false && cap.count === 5, 'five-player late-entry cap must hold');
    for (const width of [320,390,430]) {
      await page.setViewportSize({width,height:844});
      for (const count of [2,3,4,5]) {
        const layout = await page.evaluate((n) => {
          const players=state.players, scores=state.score;
          state.players=players.slice(0,n);state.score=scores.slice(0,n);
          liveV2Render();
          const panel=document.getElementById('liveV2Panel');
          const rect=panel.getBoundingClientRect();
          const cells=document.querySelectorAll('#v2Rows .v2Cell').length;
          state.players=players;state.score=scores;
          return {left:rect.left,right:rect.right,width:innerWidth,cells};
        },count);
        assert(layout.left>=-1 && layout.right<=layout.width+1 && layout.cells>0, `${count}-player score wall must render within ${width}px`);
      }
    }
    const historical = await page.evaluate(() => {
      state.players.push({name:'HISTORICAL SIXTH',type:'guest'});
      state.score.push(Array.from({length:14},()=>({darts:[null,null,null],roundTotal:0})));
      state.match.wins.push(0);
      const before=JSON.stringify({players:state.players,score:state.score});
      liveV2Render();
      const added=window.__sqAppendLatePlayer({name:'SEVENTH'},'guest');
      return {added,count:state.players.length,unchanged:before===JSON.stringify({players:state.players,score:state.score}),cells:document.querySelectorAll('#v2Rows .v2Cell').length};
    });
    assert(!historical.added && historical.count===6 && historical.unchanged && historical.cells>0, 'historical six-player state remains readable and unchanged');

    console.log('SC-034 ADD PLAYER: PASS');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error('SC-034 ADD PLAYER: FAIL');
  console.error(err && err.stack || err);
  process.exit(1);
});
