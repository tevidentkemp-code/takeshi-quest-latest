const assert = require('assert');
const fs = require('fs');
const path = require('path');
const H = require('./harness');

// Linux WebKit's full matrix exceeded the unchanged 180s command budget
// while every completed case passed. Keep complete groups independently runnable.
const qaPart=process.env.SQ_SC065_PART || 'all';
assert(['all','late','early','lifecycle'].includes(qaPart),'Invalid SQ_SC065_PART: '+qaPart);
const widths=[320,390,430],counts=[2,3,4,5],earlyModes=['match','tournament','practice'];
const lifecycleCases=['Turbo/2 players','Turbo/5 players','solo and historical six preservation','Undo during motion','navigation during motion','reload during motion','new game during motion','pad scoring during motion','rapid round completion','reduced motion'];
const caseGroups={
  late:widths.flatMap(width=>counts.map(count=>'late '+width+'px/'+count+' players')),
  early:earlyModes.flatMap(mode=>counts.flatMap(count=>[0,1,2].map(round=>'early '+mode+'/'+count+' players/round '+round))),
  lifecycle:lifecycleCases
};
const plannedCases=Object.entries(caseGroups).filter(([part])=>qaPart==='all' || qaPart===part).flatMap(([,cases])=>cases);
const completedCases=[];
const qaStarted=Date.now();
let qaCase='boot';
function progress(stage,label){
  if(stage==='START') qaCase=label;
  if(stage==='PASS') completedCases.push(label);
  console.log('SC065 '+new Date().toISOString()+' +'+(Date.now()-qaStarted)+'ms '+stage+' '+label);
}
async function frames(page,count,label){
  await page.evaluate(({count,label})=>new Promise((resolve,reject)=>{
    let left=count;
    const timer=setTimeout(()=>{
      const panel=document.getElementById('liveV2Panel'),rows=document.getElementById('v2Rows');
      reject(new Error('SC065 RAF deadline '+JSON.stringify({label,remaining:left,visibility:document.visibilityState,hidden:document.hidden,ready:document.readyState,page:document.body.dataset.page,panelHidden:panel?.hidden,panelDisplay:panel?getComputedStyle(panel).display:null,gridConnected:rows?.isConnected,gridRect:rows?.getBoundingClientRect().toJSON(),animations:rows?.getAnimations().map(a=>({state:a.playState,pending:a.pending,time:a.currentTime})),round:state.currentRound,token:state.__gameToken,history:state.history.length})));
    },8000);
    const tick=()=>{if(--left===0){clearTimeout(timer);resolve();}else requestAnimationFrame(tick);};
    requestAnimationFrame(tick);
  }),{count,label:qaCase+': '+label});
}

// First cold early fixture only. Forward native scheduling and builders without
// changing their results, polling, or deadlines; restore on success and error.
let coldFixtureObserved=false;
async function beginColdFixtureDiagnostic(page){
  await page.evaluate(()=>{
    const trace=window.__sqSc065ColdDiagnostic={scope:'first cold fixture; main world only',limits:{records:512,owners:64,bookkeepingMs:25},records:[],owners:[],dropped:0,bookkeepingMs:0,stopped:null,restored:false,restoreConflicts:[]};
    let active=true;
    const restores=[],owners=new WeakMap();
    let observer=null;
    window.__sqSc065RestoreColdDiagnostic=()=>{
      if(trace.restored)return null;
      active=false;observer?.disconnect();
      for(const restore of restores.reverse())restore();
      trace.restored=true;return trace;
    };
    const clock=()=>performance.now();
    function note(kind,fields){
      if(!active)return null;
      if(trace.records.length>=trace.limits.records){trace.dropped++;trace.stopped='record cap';active=false;return null;}
      const item={kind,at:clock(),...fields};trace.records.push(item);return item;
    }
    function observe(fn){
      if(!active)return null;
      const start=clock();
      try{return fn();}catch(error){trace.observerError=String(error);trace.stopped='observer error';active=false;return null;}
      finally{
        trace.bookkeepingMs+=clock()-start;
        if(trace.bookkeepingMs>=trace.limits.bookkeepingMs){trace.stopped='bookkeeping cap';active=false;}
      }
    }
    function owner(callback){
      if(owners.has(callback))return owners.get(callback);
      if(trace.owners.length>=trace.limits.owners)return null;
      const id=trace.owners.length;
      trace.owners.push({id,name:callback.name||'',stack:String(new Error().stack||'').split('\n').slice(2,7).join('\n').slice(0,800)});
      owners.set(callback,id);return id;
    }
    function replace(name,make){
      const original=window[name];if(typeof original!=='function')return;
      const wrapped=make(original);window[name]=wrapped;
      restores.push(()=>{if(window[name]===wrapped)window[name]=original;else trace.restoreConflicts.push(name);});
    }
    replace('requestAnimationFrame',original=>function(callback){
      if(!active||typeof callback!=='function')return Reflect.apply(original,this,arguments);
      const item=observe(()=>note('raf',{scheduledAt:clock(),owner:owner(callback)}));
      if(!item)return Reflect.apply(original,this,arguments);
      const args=Array.from(arguments);
      args[0]=function(){
        observe(()=>{item.firedAt=clock();item.frameStamp=arguments[0];});
        try{return Reflect.apply(callback,this,arguments);}
        finally{observe(()=>{item.returnedAt=clock();});}
      };
      return Reflect.apply(original,this,args);
    });
    replace('setTimeout',original=>function(callback,delay){
      if(!active||typeof callback!=='function'||(delay!==undefined&&delay!==0))return Reflect.apply(original,this,arguments);
      const item=observe(()=>note('timer',{scheduledAt:clock(),delay:delay??0,owner:owner(callback)}));
      if(!item)return Reflect.apply(original,this,arguments);
      const args=Array.from(arguments);
      args[0]=function(){
        observe(()=>{item.firedAt=clock();});
        try{return Reflect.apply(callback,this,arguments);}
        finally{observe(()=>{item.returnedAt=clock();});}
      };
      return Reflect.apply(original,this,args);
    });
    const builders=['buildScoreHeader','buildScoreBody','buildFloatingHeader','buildStatsHeader','buildStatsBody','buildMatchStatsHeader','buildMatchStatsBody','setupScrollSync'];
    for(const name of [...builders,'show','updateUI','__sqShowGameLoadOverlay','__sqHideGameLoadOverlay']){
      replace(name,original=>function(){
        if(!active)return Reflect.apply(original,this,arguments);
        const item=observe(()=>note(builders.includes(name)?'builder':'transition',{name,startAt:clock()}));
        try{return Reflect.apply(original,this,arguments);}
        finally{if(item)observe(()=>{item.returnedAt=clock();});}
      });
    }
    observer=new MutationObserver(records=>{
      observe(()=>note('attributes',{changes:records.map(r=>({target:r.target.id||r.target.tagName,attribute:r.attributeName})),page:document.body.dataset.page,overlayAriaHidden:document.getElementById('gameLoadOverlay')?.getAttribute('aria-hidden')}));
    });
    const overlay=document.getElementById('gameLoadOverlay');
    if(overlay)observer.observe(overlay,{attributes:true,attributeFilter:['aria-hidden','class']});
    observer.observe(document.body,{attributes:true,attributeFilter:['data-page']});
  });
}
async function finishColdFixtureDiagnostic(page,outcome){
  try{
    const diagnostic=await page.evaluate(()=>window.__sqSc065RestoreColdDiagnostic?.());
    if(diagnostic)console.log('SC065 cold fixture diagnostic '+JSON.stringify({outcome,diagnostic}));
  }catch(error){console.error('SC065 cold fixture diagnostic capture failed '+String(error));}
}

async function seed(page, count, round = 10, mode = 'match') {
  progress('FIXTURE',qaCase+' '+mode+'/'+count+' players/round '+round);
  const observeCold=qaPart==='early'&&!coldFixtureObserved;
  try{
  if(observeCold){coldFixtureObserved=true;await beginColdFixtureDiagnostic(page);}
  await page.evaluate(async ({n,mode}) => {
    window.__sqSc065YieldTrace=[];
    if(!window.__sqSc065YieldOriginal){
      window.__sqSc065YieldOriginal=__sqYieldToPaint;
      __sqYieldToPaint=function(){const item={start:performance.now()};window.__sqSc065YieldTrace.push(item);return window.__sqSc065YieldOriginal().then(value=>{item.end=performance.now();return value;});};
    }
    window.__sqSc065FixtureFrame=false;
    requestAnimationFrame(()=>{window.__sqSc065FixtureFrame=true;});
    const token = Number(state.__gameToken || 0);
    state = JSON.parse(JSON.stringify(baseState)); state.__gameToken = token;
    state.players = Array.from({length:n},(_,i)=>({id:'sc065-'+i,name:'WALL '+i,initials:'W'+i,avatar_id:i+1,color:'#ff7a00'}));
    assignUniqueColors(state.players);
    state.match = {id:'sc065-offline',gameNumber:1,targetWins:3,autoRotateOrder:true,wins:Array(n).fill(0),history:[],mode:'match',gameFormat:'match_play',gameVariant:'classic'};
    if(mode==='tournament') Object.assign(state.match,{tournament:true,tournamentType:'classic',tournamentRules:{startRoundIndex:0,strictTimer:false}});
    if(mode==='practice') Object.assign(state.match,{mode:'practice',forcePractice:true,isPractice:true});
    if(mode==='turbo') Object.assign(state.match,{mode:'turbo',gameVariant:'turbo',startTarget:'17',strictTimer:true,throwLimitSeconds:20});
    startNewGame(n>1?false:true);
  }, {n:count,mode});
  if(count>1)await page.click('.to-start');
  if(count>1)await page.waitForFunction(()=>window.__sqThrowOrderRevealPending!==true);
  if(mode==='turbo'){
    // The real Ready button is available while chunked preparation is still
    // painting. Follow that user flow before waiting for the loader to settle.
    await page.waitForFunction(()=>document.body.dataset.page==='game');
    await page.waitForFunction(()=>!state.__sqSecurityPreparing&&state.__sqGameControl&&document.getElementById('gameLoadOverlay')?.getAttribute('aria-hidden')==='true');
    assert.equal(await page.evaluate(()=>state.currentRound),7,'Turbo changed its canonical starting round');
    await page.click('.sq-turbo-ready-start');
    await page.waitForFunction(()=>window.__sqTurboTimerStatus().active && document.querySelector('.sqTurboTimerActive'));
  }
  try{
    await page.waitForFunction(()=>document.body.dataset.page==='game' && document.getElementById('gameLoadOverlay')?.getAttribute('aria-hidden')==='true');
  }catch(error){
    if(observeCold)await finishColdFixtureDiagnostic(page,'loader deadline');
    const diagnostic=await page.evaluate(()=>{
      const overlay=document.getElementById('gameLoadOverlay'),boot=document.getElementById('bootSplash'),panel=document.getElementById('liveV2Panel');
      const status=el=>el?{hidden:el.hidden,ariaHidden:el.getAttribute('aria-hidden'),display:getComputedStyle(el).display,opacity:getComputedStyle(el).opacity,rect:el.getBoundingClientRect().toJSON()}:null;
      return{page:document.body.dataset.page,visibility:document.visibilityState,hidden:document.hidden,ready:document.readyState,fixtureFrame:window.__sqSc065FixtureFrame,yields:window.__sqSc065YieldTrace,overlay:status(overlay),boot:status(boot),panel:status(panel),round:state.currentRound,token:state.__gameToken,history:state.history.length,tableRows:document.querySelectorAll('#tbody tr').length,scriptPaths:[...document.scripts].filter(s=>s.src&&new URL(s.src).origin===location.origin).map(s=>new URL(s.src).pathname)};
    });
    // Playwright caches its original error stack, so an appended message is
    // absent from Node's normal error print. Emit the credential-free state.
    console.error('SC065 fixture deadline '+JSON.stringify({count,round,mode,diagnostic}));
    if(process.env.SQ_SCREENSHOTS){
      fs.mkdirSync(process.env.SQ_SCREENSHOTS,{recursive:true});
      await page.screenshot({path:path.join(process.env.SQ_SCREENSHOTS,'sc065-fixture-failure.png')});
    }
    throw error;
  }
  if(observeCold)await finishColdFixtureDiagnostic(page,'loader ready');
  await page.evaluate(r=>{let guard=0;while(state.currentRound<r && guard++<200) recordThrow({kind:'S',number:ROUNDS[state.currentRound].target});}, round);
  await rest(page,round);
  console.log('SC065 native yield trace '+JSON.stringify(await page.evaluate(()=>({yields:window.__sqSc065YieldTrace}))));
  progress('READY',qaCase+' '+mode+'/'+count+' players/round '+round);
  }finally{
    if(observeCold)await finishColdFixtureDiagnostic(page,'seed cleanup');
  }
}
async function rest(page, round) {
  await page.waitForFunction(r=>document.querySelector('#v2Rows .v2Badge.liveRow')?.dataset.round===String(r), round);
  await page.waitForFunction(()=>{
    const rows=document.getElementById('v2Rows');
    const owned=document.getElementById('liveV2Panel').__sqV2Wall?.animation;
    return [owned,...rows.getAnimations()].every(a=>!a || (!a.pending && !['running','paused'].includes(a.playState)));
  });
  // The existing legacy snap runs two frames after the coalesced render.
  await frames(page,3,'settled legacy snap');
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
  await page.waitForFunction(()=>window.__sqSc065AnimationStarted && window.__sqSc065Animation?.playState==='paused' && !window.__sqSc065Animation.pending);
}

(async()=>{
  if(process.argv.includes('--list-cases')){
    console.log(JSON.stringify({part:qaPart,cases:plannedCases}));return;
  }
  const {browser,ctx,page,consoleErrs}=await H.launch({width:390,height:844});
  try{
    const fixtureHeaders=new Map();
    let fixturePhase='before-reload';
    const pendingReads=new Set();let readRevision=0;
    page.on('request',request=>{
      if(request.url().includes('supabase.co') && ['GET','HEAD','OPTIONS'].includes(request.method())){
        pendingReads.add(request);readRevision++;
      }
    });
    const finishRead=request=>pendingReads.delete(request);
    page.on('requestfinished',finishRead);page.on('requestfailed',finishRead);
    page.on('pageerror',()=>console.log('SC065 offline read diagnostic '+JSON.stringify({phase:fixturePhase,requests:[...fixtureHeaders.values()]})));
    // This is a local canonical-score fixture. Unrelated read-only record
    // warmers receive empty results; writes remain blocked by the harness.
    await ctx.route('**.supabase.co/rest/v1/**',route=>{
      const method=route.request().method();
      const table=new URL(route.request().url()).pathname.split('/').pop();
      const names=Object.keys(route.request().headers()).sort();
      fixtureHeaders.set(method+':'+table,{method,table,headerNames:names});
      // Keep the offline response valid in WebKit. An empty count and empty
      // games response give the unrelated record backfill nothing to write.
      const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET, HEAD, OPTIONS','access-control-allow-headers':'authorization, apikey, accept-profile, content-type, prefer, x-client-info'};
      if(method==='OPTIONS') return route.fulfill({status:204,headers,body:''});
      if(method==='GET') return route.fulfill({status:200,headers,contentType:'application/json',body:'[]'});
      if(method==='HEAD') return route.fulfill({status:200,headers:{...headers,'content-range':'*/0','access-control-expose-headers':'content-range'},body:''});
      return route.abort('failed');
    });
    await H.boot(page,{settle:800});
    if(qaPart==='all' || qaPart==='late'){
    for(const width of widths){
      await page.setViewportSize({width,height:width===320?568:844});
      for(const count of counts){
        progress('START','late '+width+'px/'+count+' players');
        await seed(page,count); contained(await wall(page),width+'px/'+count+' players late round');
        await prepareCompletion(page);
        const before=await wall(page),pitch=before.entries[1].top-before.entries[0].top;
        await begin(page);
        await page.evaluate(()=>{
          const a=window.__sqSc065Animation;
          a.currentTime=Number(a.effect.getTiming().duration)/2;
        });
        await frames(page,2,'midpoint');
        const midpoint=await page.evaluate(()=>document.querySelector('#v2Rows .v2Badge[data-round="9"]').getBoundingClientRect().top);
        const moving=await wall(page);
        await frames(page,3,'delayed snap');
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
        progress('PASS',qaCase);
      }
    }
    }

    // Shared early rounds retain their existing blank-row anchoring and
    // gain the same single motion without creating duplicate completed rows.
    if(qaPart==='all' || qaPart==='early'){
    await page.setViewportSize({width:390,height:844});
    for(const mode of earlyModes) for(const count of counts){
      progress('START','early '+mode+'/'+count+' players');
      await seed(page,count,0,mode);
      for(let round=0;round<3;round++){
        progress('START','early '+mode+'/'+count+' players/round '+round);
        await prepareCompletion(page,round);
        const geometry=await page.evaluate(r=>{
          const b=[...document.querySelectorAll('#v2Rows .v2Badge')],i=b.findIndex(e=>e.classList.contains('liveRow'));
          return {anchor:i===b.length-1,pitch:b[i-1].getBoundingClientRect().top-b[i-2].getBoundingClientRect().top,old:r?b.find(e=>e.dataset.round===String(r-1)).getBoundingClientRect().top:null};
        },round);
        assert(geometry.anchor,mode+' early current row must use the existing blank/trailing anchor');
        await begin(page);
        assert.equal(await page.evaluate(()=>document.getElementById('v2Rows').getAnimations().length),1,'Early completion started duplicate animations');
        await page.evaluate(()=>window.__sqSc065Animation.currentTime=150);
        await frames(page,2,'early midpoint');
        assert.equal(await page.evaluate(()=>document.querySelector('#v2Rows .v2Badge.liveRow').dataset.round),String(round+1));
        if(round){
          // Deferred read completions rebuild row children. Query and measure
          // atomically so a detached Playwright handle cannot report y=0.
          const mid=await page.evaluate(r=>document.querySelector('#v2Rows .v2Badge[data-round="'+r+'"]').getBoundingClientRect().top,round-1);
          assert(geometry.old-mid>1 && geometry.old-mid<geometry.pitch-1,mode+' early history lacks interpolated upward movement: '+JSON.stringify({count,round,geometry,mid}));
        }
        await page.evaluate(()=>window.__sqSc065Animation.play());await rest(page,round+1);
        assert.equal(await page.locator('#v2Rows .v2Badge[data-round="'+round+'"]').count(),1,'Early completion duplicated history');
        if(round){
          const y=await page.evaluate(r=>document.querySelector('#v2Rows .v2Badge[data-round="'+r+'"]').getBoundingClientRect().top,round-1);
          const diagnostic=Math.abs(geometry.old-y-geometry.pitch)<1 ? null : await page.evaluate(()=>({page:document.body.dataset.page,panelHidden:document.getElementById('liveV2Panel').hidden,panelDisplay:getComputedStyle(document.getElementById('liveV2Panel')).display,grid:document.getElementById('v2Rows').getBoundingClientRect().toJSON(),round:state.currentRound,token:state.__gameToken,history:state.history.length,animation:document.getElementById('liveV2Panel').__sqV2Wall?.animation?.playState}));
          assert(Math.abs(geometry.old-y-geometry.pitch)<1,'Early history did not move exactly one row: '+JSON.stringify({mode,count,round,geometry,y,diagnostic}));
        }
        progress('PASS',qaCase);
      }
      contained(await wall(page),mode+' early Round4');
    }
    }

    // Genuine Turbo keeps its Round17 start, strict timer and scoring, while
    // its late wall uses the same history containment and native row motion.
    if(qaPart==='all' || qaPart==='lifecycle'){
    for(const count of [2,5]){
      progress('START','Turbo/'+count+' players');
      await seed(page,count,10,'turbo');contained(await wall(page),'Turbo late round');
      assert(await page.locator('#liveV2Panel .sqTurboTimerActive').count(),'Turbo turn timer disappeared');
      await prepareCompletion(page);await begin(page);
      await page.evaluate(()=>window.__sqSc065Animation.play());await rest(page,11);contained(await wall(page),'Turbo completion');
      progress('PASS',qaCase);
    }

    // Preserve the measured baseline outside active 2–5-player walls. Solo
    // keeps its existing narrow cap, and six is a recovered historical view.
    progress('START','solo and historical six preservation');
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
    progress('PASS',qaCase);

    // Undo while a transition is active removes only the last canonical dart
    // and cancels its presentation, including the delayed legacy snap.
    progress('START','Undo during motion');
    await page.setViewportSize({width:390,height:844});await seed(page,3);await prepareCompletion(page);await begin(page);
    await page.evaluate(()=>undo());await rest(page,10);contained(await wall(page),'Undo during motion');
    assert.equal(await page.evaluate(()=>document.getElementById('v2Rows').getAnimations().length),0,'Undo retained cancelled motion');
    assert.equal(await page.evaluate(()=>state.score[2][10].darts[2]),null,'Undo changed the wrong dart');
    progress('PASS',qaCase);

    // Navigation cancels the moving view. Returning displays current truth.
    progress('START','navigation during motion');
    await begin(page);await page.evaluate(()=>show('details'));
    assert.equal(await page.evaluate(()=>document.getElementById('v2Rows').getAnimations().length),0,'Navigation retained motion');
    await page.evaluate(()=>{show('game');updateUI();});await rest(page,11);contained(await wall(page),'Navigation return');
    progress('PASS',qaCase);

    // Reload discards a transient animation and resumes the saved score truth.
    progress('START','reload during motion');
    await seed(page,2);await prepareCompletion(page);await begin(page);
    const savedHistory=await page.evaluate(()=>state.history.length);
    // waitForLoadState('networkidle') can resolve from an earlier document
    // event while new reads are pending. Do not unload an offline response
    // halfway through fulfillment; drain actual reads across a native paint.
    const readBarrierAt=Date.now();let samples=0,budget;
    const drain=(async()=>{for(;;){const revision=readRevision;await frames(page,1,'offline read completion');samples++;if(!pendingReads.size && readRevision===revision)return;}})();
    try{
      await Promise.race([drain,new Promise((_,reject)=>{budget=setTimeout(()=>reject(new Error('Offline reads did not settle within 8000ms; pending='+pendingReads.size)),8000);})]);
    }finally{clearTimeout(budget);}
    assert(await page.evaluate(()=>document.getElementById('v2Rows').getAnimations().some(a=>a.playState==='paused')),'Reload must still interrupt native wall motion');
    console.log('SC065 read completion '+JSON.stringify({elapsed:Date.now()-readBarrierAt,samples,pending:pendingReads.size}));
    fixturePhase='reload';
    await H.boot(page,{settle:800});await page.click('#resumeBtn');await rest(page,11);
    fixturePhase='after-reload';
    contained(await wall(page),'Reload recovery');assert.equal((await wall(page)).history,savedHistory,'Reload lost canonical score history');
    assert.equal(await page.evaluate(()=>document.getElementById('v2Rows').getAnimations().length),0,'Reload resumed stale motion');
    progress('PASS',qaCase);

    // Starting another game cannot inherit the previous grid movement.
    progress('START','new game during motion');
    await seed(page,2);await prepareCompletion(page);await begin(page);
    await seed(page,4);contained(await wall(page),'New game during motion');
    assert.equal(await page.evaluate(()=>document.getElementById('v2Rows').getAnimations().length),0,'New game inherited stale motion');
    progress('PASS',qaCase);

    // A real pad control accepts a dart while the score wall is moving.
    progress('START','pad scoring during motion');
    await seed(page,3);await prepareCompletion(page);await begin(page);
    await page.evaluate(()=>window.__sqSc065Animation.currentTime=150);
    const controlHistory=await page.evaluate(()=>state.history.length);
    await page.click('#pad .dtActBtn.miss');
    await page.waitForFunction(n=>state.history.length===n+1,controlHistory);
    await frames(page,3,'pad scoring');
    const scoredMoving=await wall(page);
    for(const e of scoredMoving.entries.slice(0,3)) assert(e.cells.every(c=>c.top>=scoredMoving.top-1 && c.bottom<=scoredMoving.bottom+1),'Scoring during motion clipped history');
    await page.evaluate(()=>document.getElementById('v2Rows').getAnimations().forEach(a=>a.play()));await rest(page,11);
    contained(await wall(page),'Pad scoring during motion');
    progress('PASS',qaCase);

    // New scoring never waits on motion. A rapid next-round completion cancels
    // the old animation and presents the newest complete state immediately.
    progress('START','rapid round completion');
    await seed(page,2);await prepareCompletion(page);await begin(page);
    await page.evaluate(()=>{let safe=0;while(state.currentRound===11 && safe++<10) recordThrow({kind:'Miss'});});
    await rest(page,12);contained(await wall(page),'Rapid completion');
    assert.equal((await wall(page)).running,0,'Rapid completion retained stale motion');
    progress('PASS',qaCase);

    progress('START','reduced motion');
    await page.emulateMedia({reducedMotion:'reduce'});await seed(page,5);await prepareCompletion(page);
    await page.evaluate(()=>recordThrow({kind:'S',number:20}));await rest(page,11);
    contained(await wall(page),'Reduced motion');assert.equal((await wall(page)).running,0,'Reduced motion animated');
    progress('PASS',qaCase);
    }
    const errors=consoleErrs.filter(e=>e.startsWith('pageerror:'));
    assert.deepEqual(errors,[],'Unexpected browser errors: '+JSON.stringify(errors));
    assert.deepEqual(completedCases,plannedCases,'Selected SC065 coverage was incomplete or duplicated');
    console.log('SC-065 score-wall PASS: '+qaPart+'; '+completedCases.length+' complete cases, strict errors empty');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
