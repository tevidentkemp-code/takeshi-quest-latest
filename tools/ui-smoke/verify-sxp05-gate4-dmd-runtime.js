const H = require('./harness');
const assert = require('assert/strict');

(async()=>{
  const {browser,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    await H.boot(page);
    await H.toMatchCard(page);
    await H.addGuests(page,['GATE FOUR A','GATE FOUR B']);
    await H.startMatch(page,3);
    await page.waitForFunction(()=>window.__sqDmdV2Ready===true && window.__sqDmdV2?.snapshot?.().architecture==='sxp05-gate3-scene-contract');

    const direct=await page.evaluate(()=>{
      const before=JSON.stringify({
        currentPlayer:state.currentPlayer,currentRound:state.currentRound,currentDart:state.currentDart,
        history:state.history,score:state.score
      });
      window.__sqDmdV2.emit({kind:'FINAL_BULL_TIMER',player:'GATE FOUR A',seconds:30,mode:'classic',eventToken:'g4-timer'});
      const timer=window.__sqDmdV2.snapshot();
      window.__sqDmdV2.emit({kind:'HIT_SINGLE',points:10,total:10,mode:'classic',eventToken:'g4-classic',playerInput:true});
      const classic=window.__sqDmdV2.snapshot();
      window.__sqDmdV2.emit({kind:'HIT_SINGLE',points:10,total:10,mode:'practice',eventToken:'g4-practice',playerInput:true});
      const practice=window.__sqDmdV2.snapshot();
      const after=JSON.stringify({
        currentPlayer:state.currentPlayer,currentRound:state.currentRound,currentDart:state.currentDart,
        history:state.history,score:state.score
      });
      window.__sqDmdV2.clear({restore:true});
      return {
        before,after,
        timer:{headline:timer.active?.headline,priority:timer.active?.priority,duration:timer.active?.duration},
        classicToken:classic.active?.__scene?.token,
        practiceToken:practice.active?.__scene?.token,
        practiceDecision:practice.lastDecision?.action
      };
    });
    assert.equal(direct.before,direct.after,'DMD presentation events must not mutate canonical game state');
    assert.equal(direct.timer.headline,'BULL RETURN');
    assert.equal(direct.timer.priority,30);
    assert.equal(direct.timer.duration,0);
    assert.notEqual(direct.classicToken,direct.practiceToken,'mode identities must remain isolated');
    assert.equal(direct.practiceDecision,'input-preempt');

    await page.locator('#pad [data-score-label="Single"]').click();
    await page.waitForFunction(()=>state.history.length===1 && state.currentDart===1);

    // The first score may legitimately produce NEW LEADER. The second accepted
    // dart must cancel that higher-tier transient immediately.
    await page.locator('#pad [data-score-label="Double"]').click();
    await page.waitForFunction(()=>state.history.length===2 && state.currentDart===2);
    const second=await page.evaluate(()=>window.__sqDmdV2.snapshot());
    assert.equal(second.active?.headline,'DOUBLE +20','second accepted dart must own the DMD immediately');
    assert.equal(second.lastDecision?.action,'input-preempt','legitimate scoring input must pre-empt stale presentation');

    await page.locator('#pad [data-score-label="Treble"]').click();
    await page.waitForFunction(()=>state.history.length===3 && state.currentPlayer===1 && state.currentDart===0);
    await page.waitForFunction(()=>/^VISIT \+60$/.test(window.__sqDmdV2?.snapshot?.().active?.headline||''));
    const visit=await page.evaluate(()=>({
      active:window.__sqDmdV2.snapshot().active?.headline,
      p:state.currentPlayer,r:state.currentRound,d:state.currentDart,total:state.score[0][0].roundTotal
    }));
    assert.deepEqual(visit,{active:'VISIT +60',p:1,r:0,d:0,total:60},'visit summary must follow canonical state advance');

    const undo=page.locator('#pad .dtActBtn.undo:not([disabled])');
    assert.equal(await undo.count(),1,'Undo must be available after completed visit');
    await undo.click();
    await page.waitForFunction(()=>state.history.length===2 && window.__sqDmdV2?.snapshot?.().active?.headline==='THROW UNDONE');
    const undone=await page.evaluate(()=>({
      p:state.currentPlayer,r:state.currentRound,d:state.currentDart,
      active:window.__sqDmdV2.snapshot().active?.headline
    }));
    assert.deepEqual(undone,{p:0,r:0,d:2,active:'THROW UNDONE'},'Undo feedback must describe already-restored canonical state');

    await page.waitForTimeout(950);
    const restored=await page.evaluate(()=>window.__sqDmdV2.snapshot().idle);
    assert.equal(restored?.headline,'GATE FOUR A UP','post-Undo restoration must use current player, not stale next player');
    assert.equal(restored?.subline,'TARGET 10');

    // Fresh start-of-turn Skip: semantics are still owned by the existing
    // absence/catch-up engine; Gate 4 only owns the transient feedback.
    await page.evaluate(()=>{
      const mk=()=>Array.from({length:14},()=>({darts:[null,null,null],roundTotal:0}));
      state.score=state.players.map(()=>mk());
      state.currentRound=0; state.currentPlayer=0; state.currentDart=0;
      state.history=[]; state.finished=false;
      state.suddenDeath={active:false};
      delete state.__sqCatchUp;
      updateUI();
    });
    await page.waitForSelector('#pad .dtActBtn.skip',{state:'visible'});
    await page.click('#pad .dtActBtn.skip');
    await page.waitForFunction(()=>window.__sqDmdV2?.snapshot?.().active?.headline==='TURN SKIPPED');
    const skipped=await page.evaluate(()=>({
      p:state.currentPlayer,r:state.currentRound,d:state.currentDart,
      darts:state.score[0][0].darts,
      historyType:state.history.at(-1)?.type,
      dmd:window.__sqDmdV2.snapshot().active?.headline
    }));
    assert.equal(skipped.p,1);
    assert.equal(skipped.r,0);
    assert.equal(skipped.d,0);
    assert(skipped.darts.every(x=>x===null),'Skip must remain absence state, never synthetic misses');
    assert.equal(skipped.historyType,'absenceSkip');
    assert.equal(skipped.dmd,'TURN SKIPPED');

    const unexpected=consoleErrs.filter(e=>!/supabase|failed to fetch|networkerror|aborterror|failed to load resource:\s*net::err_failed|content security policy|connect-src/i.test(e));
    assert.deepEqual(unexpected,[],'Unexpected console/page errors: '+unexpected.join(' | '));

    console.log('SXP-05 GATE 4 DMD RUNTIME: PASS');
  }finally{
    await browser.close();
  }
})().catch(err=>{ console.error('SXP-05 GATE 4 DMD RUNTIME: FAIL'); console.error(err?.stack||err); process.exit(1); });
