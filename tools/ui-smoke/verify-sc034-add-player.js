const assert = require('assert');
const H = require('./harness');

function emptyRows(n=14){
  return Array.from({length:n},()=>({darts:[null,null,null],roundTotal:0}));
}

(async () => {
  const { browser, page, consoleErrs } = await H.launch({ width:390, height:844 });
  try{
    await H.boot(page,{settle:1800});

    const result = await page.evaluate(() => {
      const mkRows = () => Array.from({length:MAX_ROUNDS},()=>({darts:[null,null,null],roundTotal:0}));
      setSavedPlayers([
        {id:'a',name:'ALPHA',initials:'A'},
        {id:'b',name:'BETA',initials:'B'},
        {id:'c',name:'CHARLIE',initials:'C'},
        {id:'d',name:'DELTA',initials:'D'},
        {id:'e',name:'ECHO',initials:'E'},
        {id:'f',name:'FOXTROT',initials:'F'}
      ]);
      state.players=[
        {id:'a',name:'ALPHA',initials:'A'},
        {id:'b',name:'BETA',initials:'B'}
      ];
      state.score=[mkRows(),mkRows()];
      state.currentRound=6; // 16s
      state.currentPlayer=1;
      state.currentDart=0;
      state.history=[];
      state.finished=false;
      state.suddenDeath={active:false,participants:[],turnIndex:0,throws:[],round:1};
      state.match={
        id:'sc034-fixture',
        mode:'official',
        gameMode:'official',
        gameFormat:'match_play',
        gameVariant:'classic',
        targetWins:3,
        gameNumber:2,
        autoRotateOrder:true,
        wins:[1,0],
        history:[{
          totals:[101,88],
          board:[mkRows(),mkRows()]
        }],
        completedLogged:false
      };
      state.matchAgg={
        hits:[{x:1},{x:2}],
        totals60:[2,3],
        totals100:[1,1],
        totals140:[0,1]
      };
      const gateBefore=window.__sqLateJoinStatus();
      const add=window.__sqAppendLatePlayer({id:'c',name:'CHARLIE',initials:'C'});
      const snapshot={
        gateBefore,
        add,
        names:state.players.map(p=>p.name),
        wins:state.match.wins.slice(),
        historyTotals:state.match.history[0].totals.slice(),
        historyBoardSlots:state.match.history[0].board.map(x=>x===null?'NULL':'BOARD'),
        aggLens:{
          hits:state.matchAgg.hits.length,
          t60:state.matchAgg.totals60.length,
          t100:state.matchAgg.totals100.length,
          t140:state.matchAgg.totals140.length
        },
        current:{round:state.currentRound,player:state.currentPlayer,dart:state.currentDart},
        pending:state.lateJoinJobs[0].pendingRounds.slice(),
        scratch:state.lateJoinJobs[0].scratchRounds.slice(),
        scratchMarkers:state.lateJoinJobs[0].scratchRounds.map(r=>state.score[2][r].lateJoinStatus),
        pendingMarkers:state.lateJoinJobs[0].pendingRounds.map(r=>state.score[2][r].lateJoinStatus),
        persisted:JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')
      };
      return snapshot;
    });

    assert.equal(result.gateBefore.ok,true,'Classic Match Play should allow late join before 17s');
    assert.equal(result.add.ok,true,'registered player should be added');
    assert.deepEqual(result.names,['ALPHA','BETA','CHARLIE'],'late player must be final thrower');
    assert.deepEqual(result.wins,[1,0,0],'match wins must expand without changing existing values');
    assert.deepEqual(result.historyTotals,[101,88,null],'prior completed game must use null absence slot');
    assert.deepEqual(result.historyBoardSlots,['BOARD','BOARD','NULL'],'prior board must use null absence slot');
    assert.deepEqual(result.aggLens,{hits:3,t60:3,t100:3,t140:3},'match aggregates must expand atomically');
    assert.deepEqual(result.current,{round:6,player:1,dart:0},'active turn cursor must not move when player joins');
    assert.deepEqual(result.pending,[3,4,5],'latest three completed Classic rounds should queue for catch-up');
    assert.deepEqual(result.scratch,[0,1,2],'older missed Classic rounds should scratch');
    assert(result.scratchMarkers.every(x=>x==='scratch'),'scratch rounds must be explicitly marked');
    assert(result.pendingMarkers.every(x=>x==='pending'),'catch-up rounds must be explicitly marked');
    assert.equal(result.persisted.players.length,3,'late join must persist for refresh/resume');
    assert.equal(result.persisted.lateJoinJobs.length,1,'catch-up queue must persist for refresh/resume');

    // BETA finishes live 16s, then CHARLIE takes 16s normally as final thrower.
    await page.evaluate(() => {
      state.currentPlayer=1; state.currentRound=6; state.currentDart=0;
      recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'});
    });
    let cur=await page.evaluate(()=>({p:state.currentPlayer,r:state.currentRound,d:state.currentDart,catch:!!state.__sqLateJoinCatchUp?.active}));
    assert.deepEqual(cur,{p:2,r:6,d:0,catch:false},'new player should take current live round last');

    // CHARLIE completes live 16s. Catch-up begins only after the table round closes.
    await page.evaluate(() => {
      recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'}); recordThrow({kind:'Miss'});
    });
    cur=await page.evaluate(()=>({p:state.currentPlayer,r:state.currentRound,d:state.currentDart,catch:!!state.__sqLateJoinCatchUp?.active}));
    assert.deepEqual(cur,{p:2,r:3,d:0,catch:true},'catch-up must begin after live table round and start at oldest retained round');

    // Three retained catch-up visits: rounds 13,14,15 (indexes 3,4,5).
    for(let i=0;i<9;i++) await page.evaluate(()=>recordThrow({kind:'Miss'}));
    cur=await page.evaluate(()=>({
      p:state.currentPlayer,r:state.currentRound,d:state.currentDart,
      catch:!!state.__sqLateJoinCatchUp?.active,
      jobDone:state.lateJoinJobs[0].completed,
      statuses:state.lateJoinJobs[0].pendingRounds.map(r=>state.score[2][r].lateJoinStatus),
      scratchDarts:state.lateJoinJobs[0].scratchRounds.map(r=>state.score[2][r].darts.filter(Boolean).length)
    }));
    assert.equal(cur.p,0,'next live round must restart at first thrower');
    assert.equal(cur.r,7,'live game must resume at 17s');
    assert.equal(cur.d,0,'live game must resume before first 17s dart');
    assert.equal(cur.catch,false,'catch-up mode should close after retained rounds');
    assert.equal(cur.jobDone,true,'late-join catch-up job should complete');
    assert(cur.statuses.every(x=>x==='caughtUp'),'retained rounds should be marked caught up');
    assert(cur.scratchDarts.every(n=>n===0),'scratched rounds must never fabricate dart throws');

    // The first actual 17s dart closes late entry.
    await page.evaluate(()=>recordThrow({kind:'Miss'}));
    const cutoff=await page.evaluate(()=>window.__sqLateJoinStatus());
    assert.equal(cutoff.ok,false,'late entry must close after first 17s dart');
    assert.match(cutoff.reason,/17s/i,'cutoff reason should explain 17s gate');

    // Maximum six players.
    const cap=await page.evaluate(()=>{
      const mkRows=()=>Array.from({length:MAX_ROUNDS},()=>({darts:[null,null,null],roundTotal:0}));
      state.players=['ALPHA','BETA','CHARLIE','DELTA','ECHO'].map((name,i)=>({id:String(i+1),name}));
      setSavedPlayers(state.players.concat([{id:'6',name:'FOXTROT'}]));
      state.score=state.players.map(()=>mkRows());
      state.currentRound=0; state.currentPlayer=0; state.currentDart=0; state.history=[]; state.finished=false;
      state.match={mode:'official',gameMode:'official',gameFormat:'match_play',wins:[0,0,0,0,0],history:[]};
      state.matchAgg={hits:[{},{},{},{},{}],totals60:[0,0,0,0,0],totals100:[0,0,0,0,0],totals140:[0,0,0,0,0]};
      state.lateJoinJobs=[];
      const add=window.__sqAppendLatePlayer({id:'6',name:'FOXTROT'});
      const after=window.__sqLateJoinStatus();
      return {add,names:state.players.map(p=>p.name),after};
    });
    assert.equal(cap.add.ok,true,'fifth-to-sixth player join should be allowed');
    assert.equal(cap.names[5],'FOXTROT','sixth player must append last');
    assert.equal(cap.after.ok,false,'seventh player must be blocked');
    assert.match(cap.after.reason,/6 players/i,'cap reason should explain six-player maximum');

    // Practice / Tournament / Vs Shadow isolation.
    const isolation=await page.evaluate(()=>{
      const base=()=>{
        state.players=[{id:'a',name:'ALPHA'},{id:'b',name:'BETA'}];
        state.score=[Array.from({length:MAX_ROUNDS},()=>({darts:[null,null,null],roundTotal:0})),Array.from({length:MAX_ROUNDS},()=>({darts:[null,null,null],roundTotal:0}))];
        state.currentRound=0; state.currentPlayer=0; state.currentDart=0; state.history=[]; state.finished=false;
        state.suddenDeath={active:false}; state.lateJoinJobs=[]; delete state.__sqLateJoinCatchUp;
      };
      base(); state.match={mode:'practice',forcePractice:true,wins:[0,0],history:[]}; const practice=window.__sqLateJoinStatus();
      base(); state.match={mode:'official',tournament:true,wins:[0,0],history:[]}; const tournament=window.__sqLateJoinStatus();
      base(); state.match={mode:'practice',forcePractice:true,practiceType:'vsshadow',wins:[0,0],history:[]}; state.shadow={mode:'vsshadow'}; const shadow=window.__sqLateJoinStatus(); delete state.shadow;
      return {practice,tournament,shadow};
    });
    assert.equal(isolation.practice.ok,false,'Practice must be isolated');
    assert.equal(isolation.tournament.ok,false,'Tournament must be isolated');
    assert.equal(isolation.shadow.ok,false,'Vs Shadow must be isolated');

    // Game Menu exposes the action and uses the same eligibility gate.
    await page.evaluate(()=>{
      setSavedPlayers([{id:'a',name:'ALPHA'},{id:'b',name:'BETA'}]);
      state.players=[{id:'a',name:'ALPHA'},{id:'b',name:'BETA'}];
      state.score=[Array.from({length:MAX_ROUNDS},()=>({darts:[null,null,null],roundTotal:0})),Array.from({length:MAX_ROUNDS},()=>({darts:[null,null,null],roundTotal:0}))];
      state.currentRound=0; state.currentPlayer=0; state.currentDart=0; state.history=[]; state.finished=false;
      state.match={mode:'official',gameMode:'official',gameFormat:'match_play',wins:[0,0],history:[]};
      window.__sqOpenGameMenu106();
    });
    const menu=await page.evaluate(()=>{
      const rows=Array.from(document.querySelectorAll('.sq-menu106-row'));
      const add=rows.find(b=>/add player/i.test(b.textContent||''));
      return {found:!!add,disabled:!!add?.disabled,text:add?.textContent||''};
    });
    assert.equal(menu.found,true,'Game Menu must expose Add Player');
    assert.equal(menu.disabled,false,'Add Player should be enabled in eligible Match Play');

    assert.equal(consoleErrs.length,0,'console errors: '+consoleErrs.join('\n'));
    console.log('SC-034 ADD PLAYER: PASS');
  } finally {
    await browser.close();
  }
})().catch(err=>{ console.error(err); process.exit(1); });
