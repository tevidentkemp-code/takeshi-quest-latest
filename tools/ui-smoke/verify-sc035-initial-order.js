const assert = require('assert');
const fs = require('fs');
const path = require('path');
const H = require('./harness');

async function seed(page, count=3) {
  await page.evaluate(n => {
    const token=Number(state.__gameToken||0);
    state=JSON.parse(JSON.stringify(baseState));
    state.__gameToken=token;
    state.players=Array.from({length:n},(_,i)=>({id:'sc035-player-'+i,name:'PLAYER '+(i+1),initials:'P'+(i+1),avatar_id:i+1,color:'#ff7a00'}));
    assignUniqueColors(state.players);
    state.match={id:'sc035-offline',gameNumber:1,targetWins:3,autoRotateOrder:true,wins:Array(n).fill(0),history:[],mode:'match',gameFormat:'match_play',gameVariant:'classic'};
    startNewGame(true);
  }, count);
  await page.waitForFunction(() => document.body.dataset.page==='game' && document.getElementById('gameLoadOverlay')?.getAttribute('aria-hidden')==='true');
  await page.waitForTimeout(250);
}
async function snapshot(page) {
  return page.evaluate(() => ({
    token:state.__gameToken,round:state.currentRound,dart:state.currentDart,
    active:state.players[state.currentPlayer]?.id,
    order:state.players.map(p=>p.id),auto:state.match.autoRotateOrder,
    values:Object.fromEntries(state.players.map((p,i)=>[p.id,{player:p,score:state.score[i],wins:state.match.wins[i],hits:state.matchAgg?.hits?.[i],t60:state.matchAgg?.totals60?.[i],t100:state.matchAgg?.totals100?.[i],t140:state.matchAgg?.totals140?.[i]}])),
    history:state.history.map(h=>({owner:state.players[h.player]?.id,round:h.round,dart:h.dartIndex,throw:h.throw,type:h.type,cursorOwner:state.players[h.absenceCursorBefore?.player]?.id,jobOwners:(h.catchUpStateBefore?.jobs||[]).map(j=>state.players[j.playerIndex]?.id)})),
    jobs:(state.__sqCatchUp?.jobs||[]).map(j=>({owner:state.players[j.playerIndex]?.id,pending:j.pendingRounds,key:j.playerKey})),
    held:state.players[state.uiLastGo?.player]?.id,
  }));
}
async function openAmend(page) {
  await page.evaluate(() => window.__sqOpenGameMenu106());
  await page.getByRole('button',{name:/Amend Initial Order/}).click();
  await page.waitForSelector('.modal-throworder-amend');
}
async function rotateDraft(page, count) {
  for(let i=0;i<count-1;i++) await page.locator('.modal-throworder-amend .to-row').nth(i).locator('.to-arrow-btn').nth(1).click();
}
async function apply(page) {
  await page.getByRole('button',{name:'APPLY CORRECTION',exact:true}).click();
  await page.waitForFunction(() => !document.querySelector('.modal-throworder-amend'));
}
async function visit(page) {
  return page.evaluate(() => {
    const owner=state.players[state.currentPlayer].id;
    const round=state.currentRound;
    for(let d=state.currentDart;d<3;d++) recordThrow({kind:'S',number:ROUNDS[round].target});
    return owner;
  });
}

(async()=>{
  const {browser,ctx,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    // Commentary and the record chart warm unrelated history on game start.
    // Give their exact reads offline fixtures: WebKit may report aborted Fetch
    // as a pageerror even when the caller handles the rejection.
    // Every other Supabase request still hits the harness's network blockade.
    await ctx.route('**.supabase.co/rest/v1/**',route=>{
      const url=new URL(route.request().url());
      const method=route.request().method();
      const table=url.pathname.split('/').pop();
      const select=url.searchParams.get('select');
      const limit=url.searchParams.get('limit');
      const commentary=table==='v_player_game_scores_official_clean' && select==='game_id,ts,player_index,player_name,score' && limit==='260';
      const legacyRecord=['high_scores','high_scores_sp'].includes(table) && select==='player_id,name,score,ts,game_id' && limit==='1';
      if(method==='GET' && (commentary || legacyRecord)){
        return route.fulfill({status:200,contentType:'application/json',body:'[]'});
      }
      // Empty legacy records attempt the existing backfill probe. Keep that
      // path unavailable without invoking a native aborted-Fetch pageerror.
      if(method==='HEAD' && ['high_scores','high_scores_sp'].includes(table) && select==='game_id' && limit==='1'){
        return route.fulfill({status:503,body:''});
      }
      return route.abort('failed');
    });
    await H.boot(page,{settle:1200});
    assert(await page.evaluate(()=>typeof __sqInitialOrderAmendEligibility==='function'),'SC-035 correction is missing');

    // Actual menu/dialog controls: no canonical mutation before Apply; every
    // dismissal discards the draft and Back restores the launching Game Menu.
    await seed(page,5);
    for(const dismissal of ['back','close','escape','overlay']){
      const before=await snapshot(page);
      await openAmend(page);await rotateDraft(page,5);
      assert.deepEqual(await snapshot(page),before,'Draft arrows mutated the active game');
      if(dismissal==='back') await page.locator('.to-amend-nav').getByRole('button',{name:'← Back',exact:true}).click();
      if(dismissal==='close') await page.locator('.to-amend-nav').getByRole('button',{name:'Close',exact:true}).click();
      if(dismissal==='escape') await page.keyboard.press('Escape');
      if(dismissal==='overlay') await page.locator('.modal-throworder-amend').evaluate(m=>m.parentElement.dispatchEvent(new MouseEvent('click',{bubbles:true})));
      assert.deepEqual(await snapshot(page),before,dismissal+' discarded scored state');
      if(dismissal==='back') assert(await page.locator('.sq-menu106-title').getByText('Game Menu',{exact:true}).isVisible(),'Back must restore Game Menu');
      await page.evaluate(()=>document.querySelectorAll('.sq-menu106-bd').forEach(n=>n.remove()));
    }
    await openAmend(page);
    for(const width of [320,390,430]){
      await page.setViewportSize({width,height:width===320?568:844});
      const fit=await page.evaluate(()=>{
        const m=document.querySelector('.modal-throworder-amend'),r=m.getBoundingClientRect();
        const taps=[...m.querySelectorAll('button')].map(b=>({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height}));
        return {left:r.left,right:r.right,overflow:document.documentElement.scrollWidth>innerWidth+1,taps,scroll:m.querySelector('.to-body').scrollHeight>m.querySelector('.to-body').clientHeight};
      });
      assert(!fit.overflow && fit.left>=-1 && fit.right<=width+1,width+'px amendment must remain contained');
      assert(fit.taps.every(t=>t.w>=43.5&&t.h>=43.5),width+'px amendment controls must be at least 44px');
      if(process.env.SQ_SCREENSHOTS){fs.mkdirSync(process.env.SQ_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.SQ_SCREENSHOTS,'sc035-amend-'+width+'.png')});}
    }
    await page.keyboard.press('Escape');await page.setViewportSize({width:390,height:844});

    // Before any dart the correction immediately selects the new first thrower.
    await seed(page,3);await openAmend(page);await rotateDraft(page,3);await apply(page);
    assert.equal((await snapshot(page)).active,'sc035-player-1','Pre-dart correction did not select the new first thrower');

    for(let count=2;count<=5;count++){
      await seed(page,count);
      await page.evaluate(()=>{recordThrow({kind:'S',number:10});recordThrow({kind:'Miss'});recordThrow({kind:'D',number:10});recordThrow({kind:'D',number:10});});
      const before=await snapshot(page);
      await openAmend(page);await rotateDraft(page,count);
      if(count>2) await rotateDraft(page,count);
      assert.deepEqual(await snapshot(page),before,'Partial-visit draft changed canonical state');
      assert.equal(await page.locator('.modal-throworder-amend .to-auto-toggle').count(),0,'Correction must not change AUTO policy');
      await apply(page);
      const after=await snapshot(page);
      assert.deepEqual(after.values,before.values,count+'-player score/identity/aggregate ownership changed');
      assert.deepEqual(after.history,before.history,count+'-player Undo history ownership changed');
      assert.equal(after.token,before.token,'Correction restarted the game');
      assert.equal(after.active,before.active,'Partial visit switched its actor');
      assert.equal(after.dart,1,'Partial visit cursor changed');assert.equal(after.auto,true,'AUTO preference changed');
      assert.equal(after.held,before.held,'Completed-go presentation moved to another player');

      await page.evaluate(()=>undo());
      let undone=await snapshot(page);
      assert.equal(undone.active,'sc035-player-1','Undo reverted a dart for the wrong player');
      assert.equal(undone.values['sc035-player-1'].score[0].roundTotal,0,'Undo did not remove the intended player’s dart');
      assert.equal(undone.values['sc035-player-0'].score[0].roundTotal,30,'Undo changed the earlier player’s score');
      await page.evaluate(()=>recordThrow({kind:'D',number:10}));
      const visited=[await visit(page)];
      while((await snapshot(page)).round===0){visited.push(await visit(page));assert(visited.length<=count,'Round 1 repeated a completed visit');}
      assert.deepEqual(new Set(visited),new Set(before.order.filter(id=>id!=='sc035-player-0')),'Corrected order skipped or repeated a remaining player');
      assert.equal((await snapshot(page)).round,1,'Round 2 started before all remaining first-round visits');
      assert.equal(await page.evaluate(()=>__sqInitialOrderAmendEligibility().ok),false,'Amendment remained available after Round 1');
      await page.evaluate(()=>undo());
      assert.equal((await snapshot(page)).round,0,'Undo did not restore the last first-round dart');
      assert.equal(await page.evaluate(()=>__sqInitialOrderAmendEligibility().ok),false,'Undo reopened an already completed Round 1 correction window');
      await visit(page);
    }

    // Skip Go and its Undo snapshots follow identity through correction; a
    // skipped first-round visit counts as accounted for without fake darts.
    await seed(page,3);await page.evaluate(()=>{__sqSkipAbsentVisit();__sqSkipAbsentVisit();});
    const skipped=await snapshot(page);
    await openAmend(page);await rotateDraft(page,3);await apply(page);
    const correctedSkip=await snapshot(page);
    assert.deepEqual(correctedSkip.jobs,skipped.jobs,'Absence jobs detached from their player');
    assert.deepEqual(correctedSkip.history,skipped.history,'Skip Undo snapshot detached from its player');
    assert.equal(correctedSkip.active,'sc035-player-2','Skipped player was scheduled again');
    await page.evaluate(()=>undo());
    assert.equal((await snapshot(page)).active,'sc035-player-1','Skip Undo restored the wrong actor');
    assert.deepEqual((await snapshot(page)).jobs.map(j=>j.owner),['sc035-player-0'],'Skip Undo failed to preserve the earlier remapped job');
    await page.evaluate(()=>__sqSkipAbsentVisit());
    await visit(page);
    assert.equal((await snapshot(page)).round,1,'Skip caused a duplicate first-round visit');

    // A rebuild is one guarded transition: repeated Apply, Escape, Undo and
    // score/Skip entry cannot interleave or hang on the legacy miss loop.
    await seed(page,3);await page.evaluate(()=>recordThrow({kind:'S'}));
    const beforeBusy=await snapshot(page);await openAmend(page);await rotateDraft(page,3);
    await page.evaluate(()=>{
      window.__sqSc035BuildOriginal=buildEverythingChunked;
      buildEverythingChunked=async()=>{await new Promise(resolve=>{window.__sqSc035ReleaseBuild=resolve;});return window.__sqSc035BuildOriginal();};
    });
    await page.getByRole('button',{name:'APPLY CORRECTION',exact:true}).click();
    await page.waitForFunction(()=>window.__sqInitialOrderApplying===true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.modal-throworder-amend').count(),1,'Escape dismissed a correction during the guarded rebuild');
    await page.evaluate(()=>{
      recordThrow({kind:'S'});__sqSkipAbsentVisit();undo();missGo();
      const skip=document.querySelector('#pad .dtActBtn.skip');
      if(!skip) throw new Error('LiveV2 generic Skip control is missing');
      skip.click();
      document.querySelector('.modal-throworder-amend .to-start').click();
    });
    const duringBusy=await snapshot(page);
    assert.deepEqual(duringBusy.values,beforeBusy.values,'Score entry interleaved with the correction');
    assert.deepEqual(duringBusy.history,beforeBusy.history,'Repeated Apply/score entry duplicated canonical history');
    await page.evaluate(()=>window.__sqSc035ReleaseBuild());
    await page.waitForFunction(()=>!document.querySelector('.modal-throworder-amend'));
    await page.evaluate(()=>{buildEverythingChunked=window.__sqSc035BuildOriginal;delete window.__sqSc035BuildOriginal;delete window.__sqSc035ReleaseBuild;});

    // If presentation rebuilding fails, restore the full pre-apply game and
    // leave the correction dialog available for dismissal/retry.
    await seed(page,3);await page.evaluate(()=>recordThrow({kind:'S'}));
    const beforeFailure=await snapshot(page);await openAmend(page);await rotateDraft(page,3);
    await page.evaluate(()=>{
      window.__sqSc035BuildOriginal=buildEverythingChunked;
      let first=true;
      buildEverythingChunked=async()=>{if(first){first=false;throw new Error('SC-035 injected rebuild failure');}return window.__sqSc035BuildOriginal();};
    });
    await page.getByRole('button',{name:'APPLY CORRECTION',exact:true}).click();
    await page.waitForFunction(()=>window.__sqInitialOrderApplying===false);
    assert.deepEqual(await snapshot(page),beforeFailure,'Failed rebuild did not recover the pre-correction game');
    await page.evaluate(()=>{buildEverythingChunked=window.__sqSc035BuildOriginal;delete window.__sqSc035BuildOriginal;});
    await page.keyboard.press('Escape');

    // Existing recovery cache preserves corrected order, darts and cursor.
    await seed(page,5);await page.evaluate(()=>recordThrow({kind:'S',number:10}));
    await openAmend(page);await rotateDraft(page,5);await apply(page);
    const saved=await snapshot(page);await page.evaluate(()=>save());
    await H.boot(page,{settle:1200});await page.click('#resumeBtn');
    await page.waitForFunction(()=>document.body.dataset.page==='game');
    const resumed=await snapshot(page);
    assert.deepEqual(resumed,saved,'Refresh/resume changed the correction or score ownership');

    // A stale open dialog may never apply against a different game cursor.
    await openAmend(page);await rotateDraft(page,5);
    await page.evaluate(()=>{state.__gameToken++;});
    const stale=await snapshot(page);
    await page.getByRole('button',{name:'APPLY CORRECTION',exact:true}).click();
    assert.deepEqual(await snapshot(page),stale,'Stale dialog mutated the current game');
    await page.keyboard.press('Escape');

    const guards=await page.evaluate(()=>{
      const good=JSON.parse(JSON.stringify(state));
      const check=patch=>{state=JSON.parse(JSON.stringify(good));patch();return __sqInitialOrderAmendEligibility().ok;};
      const result={game2:check(()=>state.match.gameNumber=2),round2:check(()=>state.currentRound=1),turboStart:check(()=>{state.match.gameVariant='turbo';state.currentRound=7;}),finished:check(()=>state.finished=true),tiebreak:check(()=>state.suddenDeath.active=true),catchup:check(()=>state.__sqCatchUp={active:true,jobs:[]}),practice:check(()=>delete state.match.autoRotateOrder),training:check(()=>{delete state.match.autoRotateOrder;state.match.practiceType='training';}),shadow:check(()=>state.match.practiceType='vsshadow'),tournament:check(()=>state.match.tournament=true),historicalSix:check(()=>state.players.push({name:'SIXTH'}))};
      state=good;return result;
    });
    assert(Object.values(guards).every(v=>v===false),'An ineligible mode/game/round allowed correction: '+JSON.stringify(guards));

    // The existing NEXT GAME control rotates the corrected baseline exactly once.
    const baseline=(await snapshot(page)).order;
    await page.evaluate(()=>{state.finished=true;state.gameAwarded=true;state.match.gameNumber=2;state.match.history=[{totals:state.players.map((_,i)=>100+i),board:JSON.parse(JSON.stringify(state.score))}];showLeaderboard();show('leaderboard');});
    await page.click('#nextGameBtn');await page.waitForFunction(()=>document.body.dataset.page==='game');
    await page.waitForTimeout(250);
    const next=await snapshot(page);
    assert.deepEqual(next.order,baseline.slice(1).concat(baseline[0]),'Later-game AUTO did not rotate the amended baseline exactly once');
    assert.equal(await page.evaluate(()=>!!state.__sqInitialOrderAmended||!!state.__sqInitialRoundComplete),false,'New game retained the amendment/round-completion marker');
    assert.equal(next.token,saved.token+2,'Correction or next-game startup changed the game token incorrectly');
    assert(next.order.every(id=>next.values[id].score.every(r=>r.darts.every(d=>d===null))),'New game failed to reset the board');

    const errors=consoleErrs.filter(e=>e.startsWith('pageerror:'));
    assert.deepEqual(errors,[],'Unexpected browser errors: '+JSON.stringify(errors));
    console.log('SC-035 initial-order correction PASS: staged UI, 2–5 player partial darts, Undo, Skip, refresh, guards, AUTO and mobile geometry');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
