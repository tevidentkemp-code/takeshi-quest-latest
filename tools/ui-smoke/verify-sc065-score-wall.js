const assert = require('assert');
const fs = require('fs');
const path = require('path');
const H = require('./harness');

async function seed(page, count, round = 10, mode = 'match') {
  await page.evaluate(async ({n,mode}) => {
    const token = Number(state.__gameToken || 0);
    state = JSON.parse(JSON.stringify(baseState)); state.__gameToken = token;
    state.players = Array.from({length:n},(_,i)=>({id:'sc065-'+i,name:'WALL '+i,initials:'W'+i,avatar_id:i+1,color:'#ff7a00'}));
    assignUniqueColors(state.players);
    state.match = {id:'sc065-offline',gameNumber:1,targetWins:3,autoRotateOrder:true,wins:Array(n).fill(0),history:[],mode:'match',gameFormat:'match_play',gameVariant:'classic'};
    if(mode==='tournament') Object.assign(state.match,{tournament:true,tournamentType:'classic',tournamentRules:{startRoundIndex:0,strictTimer:false}});
    if(mode==='practice') Object.assign(state.match,{mode:'practice',forcePractice:true,isPractice:true});
    if(mode==='turbo') Object.assign(state.match,{mode:'turbo',gameVariant:'turbo',startTarget:'17',strictTimer:true,throwLimitSeconds:20});
    startNewGame(true);
  }, {n:count,mode});
  await page.waitForFunction(()=>document.body.dataset.page==='game' && document.getElementById('gameLoadOverlay')?.getAttribute('aria-hidden')==='true');
  if(mode==='turbo'){
    assert.equal(await page.evaluate(()=>state.currentRound),7,'Turbo changed its canonical starting round');
    await page.evaluate(()=>window.__sqReleaseTurboReadyGate());
  }
  await page.evaluate(r=>{let guard=0;while(state.currentRound<r && guard++<200) recordThrow({kind:'S',number:ROUNDS[state.currentRound].target});}, round);
  await rest(page,round);
}
async function rest(page, round) {
  await page.waitForFunction(r=>document.querySelector('#v2Rows .v2Badge.liveRow')?.dataset.round===String(r), round);
  await page.waitForFunction(()=>{
    const rows=document.getElementById('v2Rows');
    const owned=document.getElementById('liveV2Panel').__sqV2Wall?.animation;
    return [owned,...rows.getAnimations()].every(a=>!a || (!a.pending && !['running','paused'].includes(a.playState)));
  });
  // The existing legacy snap runs two frames after the coalesced render.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
}
async function wall(page) {
  return page.evaluate(()=>{
    const wrap=document.querySelector('#liveV2Panel .v2RowsWrap'),wr=wrap.getBoundingClientRect(),rows=document.getElementById('v2Rows');
    const top=wr.top+wrap.clientTop,bottom=top+wrap.clientHeight;
    const round=Number(document.querySelector('#v2Rows .v2Badge.liveRow').dataset.round);
    return {round,top,bottom,scroll:wrap.scrollTop,history:state.history.length,
      entries:Array.from({length:4},(_,k)=>round-3+k).map(r=>{
        const badge=rows.querySelector('.v2Badge[data-round="'+r+'"]'),b=badge.getBoundingClientRect();
        const cells=[...rows.querySelectorAll('.v2Cell[data-round="'+r+'"]')];
        return {r,top:b.top,bottom:b.bottom,height:b.height,
          duplicate:rows.querySelectorAll('.v2Badge[data-round="'+r+'"]').length,
          cells:cells.map((el,i)=>{const rc=el.getBoundingClientRect();return {top:rc.top,bottom:rc.bottom,value:el.querySelector('.v2CellNum')?.textContent || el.querySelector('.v2CellScore')?.textContent || el.textContent,truth:state.score[i][r].roundTotal};})};
      }),running:rows.getAnimations().filter(a=>a.playState==='running').length};
  });
}
function contained(w, label) {
  for(const e of w.entries){
    assert(e.top>=w.top-1 && e.bottom<=w.bottom+1,label+': row '+e.r+' is clipped '+JSON.stringify(w));
    assert(e.cells.every(c=>c.top>=w.top-1 && c.bottom<=w.bottom+1),label+': player cells clipped');
    assert.equal(e.duplicate,1,label+': duplicate round');
    for(const c of e.cells) assert.equal(Number(c.value),c.truth,label+': rendered score differs from truth');
  }
}
async function prepareCompletion(page, round = 10) {
  await page.evaluate(()=>{
    let safety=0;
    while(!(state.currentPlayer===state.players.length-1 && state.currentDart===2) && safety++<20) recordThrow({kind:'S',number:ROUNDS[state.currentRound].target});
  });
  await rest(page,round);
}
async function begin(page) {
  await page.evaluate(()=>{
    // Capture the real native animation at creation. External polling can
    // miss a 300ms motion when several QA browsers share a busy machine.
    const rows=document.getElementById('v2Rows'),native=rows.animate;
    const own=Object.prototype.hasOwnProperty.call(rows,'animate');
    window.__sqSc065Animation=null;window.__sqSc065AnimationStarted=false;
    rows.animate=function(...args){
      if(own) this.animate=native;else delete this.animate;
      const animation=native.apply(this,args);
      window.__sqSc065AnimationStarted=animation.playState==='running';
      animation.pause();window.__sqSc065Animation=animation;
      return animation;
    };
    recordThrow({kind:'S',number:ROUNDS[state.currentRound].target});
  });
  await page.waitForFunction(()=>window.__sqSc065AnimationStarted && window.__sqSc065Animation?.playState==='paused');
}

(async()=>{
  const {browser,ctx,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    // This is a local canonical-score fixture. Unrelated read-only record
    // warmers receive empty results; writes remain blocked by the harness.
    await ctx.route('**.supabase.co/rest/v1/**',route=>{
      const method=route.request().method();
      // Keep the offline response a valid cross-origin response in WebKit,
      // including the unavailable HEAD probe. Production writes stay blocked.
      const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET, HEAD, OPTIONS','access-control-allow-headers':'authorization, apikey, content-type, prefer, x-client-info'};
      if(method==='OPTIONS') return route.fulfill({status:204,headers,body:''});
      if(method==='GET') return route.fulfill({status:200,headers,contentType:'application/json',body:'[]'});
      if(method==='HEAD') return route.fulfill({status:503,headers,body:''});
      return route.abort('failed');
    });
    await H.boot(page,{settle:800});
    for(const width of [320,390,430]){
      await page.setViewportSize({width,height:width===320?568:844});
      for(const count of [2,3,4,5]){
        await seed(page,count); contained(await wall(page),width+'px/'+count+' players late round');
        await prepareCompletion(page);
        const before=await wall(page),pitch=before.entries[1].top-before.entries[0].top;
        await begin(page);
        const midpoint=await page.evaluate(()=>{
          const a=window.__sqSc065Animation;
          a.currentTime=Number(a.effect.getTiming().duration)/2;
          return document.querySelector('#v2Rows .v2Badge[data-round="9"]').getBoundingClientRect().top;
        });
        const moving=await wall(page);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
        const delayed=await wall(page);
        // At completion the older historical row moves upward, with an actual
        // interpolated position rather than a delayed jump to the final row.
        const oldTop=before.entries.find(e=>e.r===9).top;
        assert(oldTop-midpoint>1 && oldTop-midpoint<pitch-1,'Missing interpolated midpoint displacement');
        const delayedTop=delayed.entries.find(e=>e.r===9).top;
        assert(oldTop-delayedTop>1 && oldTop-delayedTop<pitch-1,'Delayed snap replaced the interpolated motion with a jump');
        assert(Math.abs(midpoint-delayedTop)<1,'Paused movement changed position after the delayed snap');
        // Three completed rows remain wholly inside the window while moving.
        for(const sample of [moving,delayed]) for(const e of sample.entries.slice(0,3)){
          assert(e.top>=sample.top-1 && e.bottom<=sample.bottom+1,'History clipped during motion or delayed snap');
          assert(e.cells.every(c=>c.top>=sample.top-1 && c.bottom<=sample.bottom+1),'Moving player cells clipped');
          assert.equal(e.duplicate,1,'Motion duplicated a round');
          for(const c of e.cells) assert.equal(Number(c.value),c.truth,'Moving score differs from canonical truth');
        }
        await page.evaluate(()=>document.getElementById('v2Rows').getAnimations().forEach(a=>a.play()));
        await rest(page,11);
        const after=await wall(page);contained(after,'Completed transition');
        assert(Math.abs((oldTop-after.entries.find(e=>e.r===9).top)-pitch)<1,'Completion did not move exactly one measured row: '+JSON.stringify({width,count,pitch,oldTop,before,after}));
        assert.equal(after.history,before.history+1,'Motion changed canonical history');
        if(process.env.SQ_SCREENSHOTS && (count===2 || count===5)){
          fs.mkdirSync(process.env.SQ_SCREENSHOTS,{recursive:true});
          await page.screenshot({path:path.join(process.env.SQ_SCREENSHOTS,'sc065-wall-'+width+'-'+count+'.png')});
        }
      }
    }

    // Early normal Match rounds retain their existing blank-row anchoring and
    // gain the same single motion without creating duplicate completed rows.
    await page.setViewportSize({width:390,height:844});
    for(const mode of ['match','tournament','practice']) for(const count of [2,3,4,5]){
      await seed(page,count,0,mode);
      for(let round=0;round<3;round++){
        await prepareCompletion(page,round);
        const geometry=await page.evaluate(r=>{
          const b=[...document.querySelectorAll('#v2Rows .v2Badge')],i=b.findIndex(e=>e.classList.contains('liveRow'));
          return {anchor:i===b.length-1,pitch:b[i-1].getBoundingClientRect().top-b[i-2].getBoundingClientRect().top,old:r?b.find(e=>e.dataset.round===String(r-1)).getBoundingClientRect().top:null};
        },round);
        assert(geometry.anchor,mode+' early current row must use the existing blank/trailing anchor');
        await begin(page);
        assert.equal(await page.evaluate(()=>document.getElementById('v2Rows').getAnimations().length),1,'Early completion started duplicate animations');
        await page.evaluate(()=>window.__sqSc065Animation.currentTime=150);
        assert.equal(await page.evaluate(()=>document.querySelector('#v2Rows .v2Badge.liveRow').dataset.round),String(round+1));
        if(round){
          const mid=await page.locator('#v2Rows .v2Badge[data-round="'+(round-1)+'"]').evaluate(e=>e.getBoundingClientRect().top);
          assert(geometry.old-mid>1 && geometry.old-mid<geometry.pitch-1,mode+' early history lacks interpolated upward movement');
        }
        await page.evaluate(()=>window.__sqSc065Animation.play());await rest(page,round+1);
        assert.equal(await page.locator('#v2Rows .v2Badge[data-round="'+round+'"]').count(),1,'Early completion duplicated history');
        if(round){
          const y=await page.locator('#v2Rows .v2Badge[data-round="'+(round-1)+'"]').evaluate(e=>e.getBoundingClientRect().top);
          assert(Math.abs(geometry.old-y-geometry.pitch)<1,'Early history did not move exactly one row: '+JSON.stringify({mode,count,round,geometry,y}));
        }
      }
      contained(await wall(page),mode+' early Round4');
    }

    // Genuine Turbo keeps its Round17 start, strict timer and scoring, while
    // its late wall uses the same history containment and native row motion.
    for(const count of [2,5]){
      await seed(page,count,10,'turbo');contained(await wall(page),'Turbo late round');
      assert(await page.locator('#liveV2Panel .sqTurboTimerActive').count(),'Turbo turn timer disappeared');
      await prepareCompletion(page);await begin(page);
      await page.evaluate(()=>window.__sqSc065Animation.play());await rest(page,11);contained(await wall(page),'Turbo completion');
    }

    // Preserve the measured baseline outside active 2–5-player walls. Solo
    // keeps its existing narrow cap, and six is a recovered historical view.
    await page.setViewportSize({width:320,height:568});await seed(page,1,0,'practice');
    assert.equal(await page.locator('#liveV2Panel .v2RowsWrap').evaluate(e=>e.getBoundingClientRect().height),206,'Solo narrow geometry changed');
    assert.equal(await page.evaluate(()=>document.getElementById('v2Rows').getAnimations().length),0,'Solo gained multiplayer motion');
    await seed(page,5,0);
    await page.evaluate(()=>{
      state.players.push({id:'sc065-historic-6',name:'HISTORIC SIX',initials:'H6',color:'#abcdef'});
      state.score.push(JSON.parse(JSON.stringify(state.score[0])));state.match.wins.push(0);ensureMatchAgg();updateUI();
    });await rest(page,0);
    assert.equal(await page.locator('#liveV2Panel').getAttribute('data-pcount'),'6','Historical sixth player disappeared');
    assert.equal(await page.locator('#liveV2Panel .v2RowsWrap').evaluate(e=>getComputedStyle(e).maxHeight),'206px','Historical narrow cap changed');
    assert.equal(await page.evaluate(()=>document.getElementById('v2Rows').getAnimations().length),0,'Historical six-player view gained motion');

    // Undo while a transition is active removes only the last canonical dart
    // and cancels its presentation, including the delayed legacy snap.
    await page.setViewportSize({width:390,height:844});await seed(page,3);await prepareCompletion(page);await begin(page);
    await page.evaluate(()=>undo());await rest(page,10);contained(await wall(page),'Undo during motion');
    assert.equal(await page.evaluate(()=>document.getElementById('v2Rows').getAnimations().length),0,'Undo retained cancelled motion');
    assert.equal(await page.evaluate(()=>state.score[2][10].darts[2]),null,'Undo changed the wrong dart');

    // Navigation cancels the moving view. Returning displays current truth.
    await begin(page);await page.evaluate(()=>show('details'));
    assert.equal(await page.evaluate(()=>document.getElementById('v2Rows').getAnimations().length),0,'Navigation retained motion');
    await page.evaluate(()=>{show('game');updateUI();});await rest(page,11);contained(await wall(page),'Navigation return');

    // Reload discards a transient animation and resumes the saved score truth.
    await seed(page,2);await prepareCompletion(page);await begin(page);
    const savedHistory=await page.evaluate(()=>state.history.length);
    await page.waitForLoadState('networkidle');
    await H.boot(page,{settle:800});await page.click('#resumeBtn');await rest(page,11);
    contained(await wall(page),'Reload recovery');assert.equal((await wall(page)).history,savedHistory,'Reload lost canonical score history');
    assert.equal(await page.evaluate(()=>document.getElementById('v2Rows').getAnimations().length),0,'Reload resumed stale motion');

    // Starting another game cannot inherit the previous grid movement.
    await seed(page,2);await prepareCompletion(page);await begin(page);
    await seed(page,4);contained(await wall(page),'New game during motion');
    assert.equal(await page.evaluate(()=>document.getElementById('v2Rows').getAnimations().length),0,'New game inherited stale motion');

    // A real pad control accepts a dart while the score wall is moving.
    await seed(page,3);await prepareCompletion(page);await begin(page);
    await page.evaluate(()=>window.__sqSc065Animation.currentTime=150);
    const controlHistory=await page.evaluate(()=>state.history.length);
    await page.click('#pad .dtActBtn.miss');
    await page.waitForFunction(n=>state.history.length===n+1,controlHistory);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
    const scoredMoving=await wall(page);
    for(const e of scoredMoving.entries.slice(0,3)) assert(e.cells.every(c=>c.top>=scoredMoving.top-1 && c.bottom<=scoredMoving.bottom+1),'Scoring during motion clipped history');
    await page.evaluate(()=>document.getElementById('v2Rows').getAnimations().forEach(a=>a.play()));await rest(page,11);
    contained(await wall(page),'Pad scoring during motion');

    // New scoring never waits on motion. A rapid next-round completion cancels
    // the old animation and presents the newest complete state immediately.
    await seed(page,2);await prepareCompletion(page);await begin(page);
    await page.evaluate(()=>{let safe=0;while(state.currentRound===11 && safe++<10) recordThrow({kind:'Miss'});});
    await rest(page,12);contained(await wall(page),'Rapid completion');
    assert.equal((await wall(page)).running,0,'Rapid completion retained stale motion');

    await page.emulateMedia({reducedMotion:'reduce'});await seed(page,5);await prepareCompletion(page);
    await page.evaluate(()=>recordThrow({kind:'S',number:20}));await rest(page,11);
    contained(await wall(page),'Reduced motion');assert.equal((await wall(page)).running,0,'Reduced motion animated');
    const errors=consoleErrs.filter(e=>e.startsWith('pageerror:'));
    assert.deepEqual(errors,[],'Unexpected browser errors: '+JSON.stringify(errors));
    console.log('SC-065 score-wall PASS: 2–5 players, 320/390/430, three completed rows, interpolated one-row motion, Match/Classic Tournament/Practice early rounds, Turbo start/timer, solo/six preservation, truth, Undo/navigation/reload/rapid/reduced motion');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
